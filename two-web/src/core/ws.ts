// WebSocket relay client for real-time end-to-end encrypted sync between partners.
//
// Everything leaving this module is AES-GCM ciphertext: the relay sees a room
// id, an author role, a record type and an opaque blob. Decryption happens here
// on the way in, so subscribers keep receiving `record.payload` as a plaintext
// JSON string exactly as they always have.

import { encryptText, decryptText } from './crypto';
import { getDeviceId } from './space';
import type { SpaceCredentials } from './space';

type MessageCallback = (data: any) => void;

export type RelayStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';

type StatusCallback = (status: RelayStatus) => void;
export interface PresenceInfo {
  /** Devices in the space holding the OTHER role. */
  peers: number;
  /** This person's own other devices. */
  ownDevices: number;
  /** Every socket in the space, as counted by the relay itself. */
  total: number;
}

type PresenceCallback = (partnerOnline: boolean, info: PresenceInfo) => void;

const RELAY_DEV_PORT = 4000;
const MAX_OUTBOX = 500;
const MAX_APPLIED_IDS = 4_000;
const HEARTBEAT_MS = 25_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/**
 * Works out where the relay lives.
 *
 * In production the app is served behind a TLS reverse proxy that forwards
 * `/relay` to the relay server, so the socket is same-origin `wss://`. Using
 * `ws://` from an `https://` page would be blocked as mixed content, which is
 * why the scheme tracks the page scheme rather than being hardcoded.
 */
const PRODUCTION_RELAY_URL = 'wss://twoapp-tfj8.onrender.com/relay';

function resolveRelayUrl(): string {
  // 1. Injected by native Android WebView bridge (if running in APK)
  try {
    const androidUrl = (window as any).AndroidBridge?.getRelayUrl?.();
    if (androidUrl && typeof androidUrl === 'string' && androidUrl.trim()) {
      return androidUrl.trim();
    }
  } catch {}

  // 2. Saved by user in localStorage
  try {
    const saved = localStorage.getItem('two_custom_relay_url');
    if (saved && saved.trim()) return saved.trim();
  } catch {}

  // 3. Explicit Vite env variable
  const override = (import.meta as any)?.env?.VITE_RELAY_URL as string | undefined;
  if (override) return override;

  const loc = window.location;
  const scheme = loc.protocol === 'https:' ? 'wss:' : 'ws:';

  // 4. Local development server
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
    if (loc.port && loc.port !== String(RELAY_DEV_PORT)) {
      return `${scheme}//${loc.hostname}:${RELAY_DEV_PORT}/relay`;
    }
    return `${scheme}//${loc.host}/relay`;
  }

  // 5. Cloud deployment (Android WebView appassets.androidplatform.net, Vercel, or custom domains)
  return PRODUCTION_RELAY_URL;
}

/**
 * One connection to one space.
 *
 * Exported because a group is a second space, held open at the same time as
 * the couple's. Every field below is per-instance and both of the keys it
 * writes to localStorage - the outbox and the high-water mark - are already
 * namespaced by space id, so two clients cannot tread on each other.
 */
export class WebSocketRelayClient {
  private ws: WebSocket | null = null;
  private creds: SpaceCredentials | null = null;

  private listeners = new Set<MessageCallback>();
  private statusListeners = new Set<StatusCallback>();
  private presenceListeners = new Set<PresenceCallback>();
  private partnerOnline = false;
  private presenceInfo: PresenceInfo = { peers: 0, ownDevices: 0, total: 0 };

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private stopped = false;

  private status: RelayStatus = 'idle';
  private lamport = Date.now();

  /** Cursors the last page was asked for at, so a stalled one is not re-asked. */
  private lastReplayCursor = '';

  // Inbound records are decrypted asynchronously; chaining them keeps canvas
  // strokes and chat messages in the order the partner sent them.
  private inboundChain: Promise<void> = Promise.resolve();

  // Records sent but not yet acknowledged by the relay. Anything written while
  // the socket is down waits here instead of being dropped, and is replayed on
  // reconnect - a phone asleep, a tunnel, or a sleeping free-tier server must
  // not cost the user a message.
  private outbox: any[] = [];


  // Because the outbox re-sends, the partner can legitimately receive the same
  // record twice. Handlers like CHAT append blindly, so duplicates are filtered
  // here rather than in fifty call sites.
  private appliedIds: string[] = [];
  private appliedSet = new Set<string>();

  connect(creds: SpaceCredentials) {
    const switchingSpace = this.creds?.spaceId !== creds.spaceId;
    this.creds = creds;
    this.stopped = false;

    if (this.ws && !switchingSpace) {
      const state = this.ws.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
    }

    if (switchingSpace) {
      this.teardownSocket();
      this.restoreOutbox(creds.spaceId);
    }
    this.open();
  }

  private open() {
    if (!this.creds || this.stopped) return;

    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(resolveRelayUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      if (this.stopped || !this.creds) return;
      this.reconnectAttempts = 0;
      this.setStatus('connected');

      this.rawSend({
        type: 'JOIN',
        spaceId: this.creds.spaceId,
        // Delivery is per device; `role` stays the authorship label.
        userId: getDeviceId(),
        role: this.creds.authorLabel || this.creds.role,
        // Ask only for what we missed while disconnected, so nothing we have
        // already applied gets replayed and duplicated.
        since: this.loadHighWaterMark(this.creds.spaceId),
        // The relay's own numbering, once we have applied a record carrying
        // one. Zero means "no such cursor yet", and the relay falls back to
        // the clock above - which is what happens on the first connection
        // after an upgrade, and for as long as a relay does not number at all.
        sinceSeq: this.loadSeqCursor(this.creds.spaceId)
      });

      // Each connection pages through history from wherever it left off.
      this.lastReplayCursor = '';

      this.startHeartbeat();

      // Deliver anything written while we were offline.
      this.flushOutbox();
    };

    socket.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      if (!raw) return;
      this.inboundChain = this.inboundChain
        .then(() => this.handleInbound(raw))
        .catch(() => undefined);
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      this.setPartnerOnline(false);
      if (this.ws === socket) this.ws = null;
      if (this.stopped) return;
      this.scheduleReconnect();
    };

    // An error is always followed by a close event, which drives the retry.
    socket.onerror = () => undefined;
  }

  private async handleInbound(raw: string) {
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    if (payload?.type === 'PRESENCE') {
      this.presenceInfo = {
        peers: Number(payload.peers) || 0,
        ownDevices: Number(payload.ownDevices) || 0,
        total: Number(payload.total) || 0
      };
      this.setPartnerOnline(this.presenceInfo.peers > 0, true);
      this.emit(payload);
      return;
    }

    if (payload?.type === 'REPLAY_COMPLETE') {
      this.emit(payload);
      // A relay that says there is more has capped this batch; ask for the
      // rest. Ordering is safe because inbound messages are chained, so every
      // record in this page has already been applied and both cursors moved
      // before this arrives.
      if (payload.more) this.requestNextReplayPage();
      return;
    }

    if (payload?.type === 'RECORD_ACK' && payload.recordId) {
      // Confirmed by the relay, so stop re-sending it. `persisted: false` means
      // the relay took it but its database is down; it stays deliverable live,
      // and the relay flushes it to storage on recovery.
      const correlationId = this.ackRecord(payload.recordId);
      this.emit({ ...payload, correlationId });
      return;
    }

    if (payload?.type === 'REMOTE_SIGNAL' && payload.signal) {
      const creds = this.creds;
      if (!creds) return;
      const signal = payload.signal;
      try {
        const plaintext = await decryptText(
          signal.payload,
          signal.nonce,
          creds.key,
          signal.id,
          signal.spaceId,
          signal.type
        );
        // Deliberately not marked as applied: signals carry no history, so
        // there is nothing a repeat could corrupt, and the dedupe set should
        // not grow with ids nobody will ever see twice.
        this.emit({ type: 'REMOTE_SIGNAL', signal: { ...signal, payload: plaintext } });
      } catch {
        // Not ours to read: a stale code, or somebody else in the room.
      }
      return;
    }

    if (payload?.type !== 'REMOTE_RECORD' || !payload.record) {
      this.emit(payload);
      return;
    }

    const creds = this.creds;
    if (!creds) return;

    const record = payload.record;

    // A re-sent or replayed record must not be applied twice; handlers such as
    // CHAT append unconditionally.
    if (!record.id || !this.markApplied(record.id)) return;

    try {
      const plaintext = await decryptText(
        record.payload,
        record.nonce,
        creds.key,
        record.id,
        record.spaceId,
        record.type
      );
      // Same shape subscribers have always received: payload is a JSON string.
      this.emit({ type: 'REMOTE_RECORD', record: { ...record, payload: plaintext } });
      this.saveHighWaterMark(creds.spaceId, Number(record.lamportClock));
      this.saveSeqCursor(creds.spaceId, Number(record.seq));
    } catch {
      // Authentication failed: a stale record from a rotated code, or someone
      // in the room without the key. Dropping it is the correct outcome.
    }
  }

  /**
   * Encrypts `data` and broadcasts it to the partner. Fire-and-forget.
   *
   * `correlationId` lets the caller recognise its own record in the relay's
   * acknowledgement - the record id is generated here, so without it a sender
   * cannot tell which of its messages was confirmed.
   */
  broadcastUpdate(type: string, data: any, correlationId?: string): void {
    void this.encryptAndSend(type, data, correlationId);
  }

  /**
   * Sends something the other side should see now and nobody should keep.
   *
   * Same encryption as a record - the relay cannot read it either way - but it
   * goes down a channel that is never persisted, never replayed and never
   * acknowledged. Dropped silently when the socket is down: a signal that
   * arrives late is worse than one that never arrives, so there is no outbox.
   */
  sendSignal(type: string, data: any): void {
    void this.encryptAndSignal(type, data);
  }

  private async encryptAndSignal(type: string, data: any) {
    const creds = this.creds;
    if (!creds || !this.isOpen()) return;

    const id =
      typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const { ciphertext, nonce } = await encryptText(
        JSON.stringify(data),
        creds.key,
        id,
        creds.spaceId,
        type
      );

      this.rawSend({
        type: 'SIGNAL',
        signal: { id, spaceId: creds.spaceId, type, payload: ciphertext, nonce }
      });
    } catch (e) {
      console.error('[Relay] Signal encryption failed', e);
    }
  }

  private async encryptAndSend(type: string, data: any, correlationId?: string) {
    const creds = this.creds;
    // No credentials means no key, so there is nothing safe to queue.
    if (!creds) return;

    const recordId =
      typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const { ciphertext, nonce } = await encryptText(
        JSON.stringify(data),
        creds.key,
        recordId,
        creds.spaceId,
        type
      );

      this.lamport = Math.max(this.lamport + 1, Date.now());

      const record = {
        id: recordId,
        spaceId: creds.spaceId,
        authorId: creds.authorLabel || creds.role,
        type,
        payload: ciphertext,
        nonce,
        lamportClock: this.lamport,
        clientTs: Date.now(),
        createdAt: new Date().toISOString()
      };

      // If the relay ever echoes this back, ignore it: we already applied it
      // locally when the user performed the action.
      this.markApplied(recordId);

      this.enqueue(record, correlationId);
      this.flushOutbox();
    } catch (e) {
      console.error('[Relay] Encryption failed', e);
    }
  }

  private enqueue(record: any, correlationId?: string) {
    this.outbox.push({ record, correlationId });
    if (this.outbox.length > MAX_OUTBOX) this.outbox.shift();
    this.persistOutbox();
  }

  /**
   * Sends everything still awaiting acknowledgement. Safe to call repeatedly.
   *
   * Each record's lamport clock is taken again on the way out, because that
   * clock is what everybody else resumes from. A reader asks the relay for
   * whatever is newer than the highest clock it has applied, so a record that
   * waited an hour in here and then arrived carrying the hour-old clock it was
   * written with would be older than the cursor of anyone who had gone on
   * talking meanwhile - stored, delivered live to whoever happened to be
   * connected, and silently skipped forever by anyone who was not. In a group
   * that is a message some members simply never receive, with nothing on any
   * screen to say so.
   *
   * Re-stamping is only safe because a conversation is now ordered by the
   * sentAt inside the ciphertext rather than by this clock, so moving it
   * forward changes what gets replayed without changing what anybody reads.
   * The id is untouched: acknowledgement, de-duplication and the AAD binding
   * all rest on it.
   *
   * One case stays open. A record the relay stored but could not acknowledge -
   * the socket dying in between - keeps the clock it was first stored under,
   * because the insert ignores a repeated id rather than replacing the row.
   * Closing that needs a sequence the server issues itself, which is the
   * proper fix and a schema change.
   */
  private flushOutbox() {
    if (!this.isOpen() || !this.creds) return;
    for (const entry of this.outbox) {
      this.lamport = Math.max(this.lamport + 1, Date.now());
      entry.record.lamportClock = this.lamport;
      // Only the record goes on the wire; correlationId is a local concern.
      this.rawSend({ type: 'RECORD', spaceId: entry.record.spaceId, record: entry.record });
    }
  }

  /** Removes an acknowledged record and reports which message it belonged to. */
  private ackRecord(recordId: string): string | undefined {
    const entry = this.outbox.find(e => e.record.id === recordId);
    if (!entry) return undefined;
    this.outbox = this.outbox.filter(e => e.record.id !== recordId);
    this.persistOutbox();
    return entry.correlationId;
  }

  /**
   * Erases what this client kept for its space: the queue of records still
   * waiting, and the cursor saying how far it had read.
   *
   * For leaving a room, never for locking or disconnecting. A lock closes
   * every socket and must leave the queue intact, or a message typed just
   * before the screen went dark would be thrown away instead of sent.
   */
  forgetPersisted(spaceIdHint?: string): void {
    const spaceId = this.creds?.spaceId || spaceIdHint;
    this.outbox = [];
    if (!spaceId) return;
    try {
      localStorage.removeItem(this.outboxKey(spaceId));
      localStorage.removeItem(this.highWaterKey(spaceId));
      localStorage.removeItem(this.seqKey(spaceId));
    } catch {
      /* storage unavailable; nothing was written to begin with */
    }
  }

  /**
   * Abandons a record still waiting to be acknowledged.
   *
   * Named by the correlation id its sender gave it, because that is the only
   * handle the rest of the app holds - the record id is generated in here.
   */
  dropPending(correlationId: string): boolean {
    const before = this.outbox.length;
    this.outbox = this.outbox.filter(e => e.correlationId !== correlationId);
    if (this.outbox.length === before) return false;
    this.persistOutbox();
    return true;
  }

  private outboxKey(spaceId: string) {
    return `two_relay_outbox_${spaceId}`;
  }

  // The queue holds ciphertext, so persisting it across reloads costs nothing
  // in confidentiality and means closing the tab offline does not lose work.
  private persistOutbox() {
    if (!this.creds) return;
    try {
      const key = this.outboxKey(this.creds.spaceId);
      if (this.outbox.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(this.outbox));
    } catch {
      /* quota or private mode - delivery falls back to this session only */
    }
  }

  private restoreOutbox(spaceId: string) {
    try {
      const raw = localStorage.getItem(this.outboxKey(spaceId));
      const parsed = raw ? JSON.parse(raw) : [];

      // Earlier builds stored bare records. Upgrading with a non-empty queue
      // would otherwise send `record: undefined` and lose those messages.
      this.outbox = (Array.isArray(parsed) ? parsed : [])
        .map((e: any) => (e && e.record ? e : { record: e, correlationId: undefined }))
        .filter((e: any) => e.record && typeof e.record.id === 'string');
    } catch {
      this.outbox = [];
    }
  }

  /** Returns false when this record was already applied (a re-send or replay overlap). */
  private markApplied(recordId: string): boolean {
    if (this.appliedSet.has(recordId)) return false;
    this.appliedSet.add(recordId);
    this.appliedIds.push(recordId);
    if (this.appliedIds.length > MAX_APPLIED_IDS) {
      const evicted = this.appliedIds.shift();
      if (evicted) this.appliedSet.delete(evicted);
    }
    return true;
  }

  /** Number of records written but not yet confirmed by the relay. */
  getPendingCount(): number {
    return this.outbox.length;
  }

  private rawSend(data: any) {
    if (!this.isOpen()) return;
    try {
      this.ws!.send(JSON.stringify(data));
    } catch (e) {
      console.error('[Relay] Send failed', e);
    }
  }

  private isOpen(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Highest lamport clock already applied for a space, so a reconnect resumes
  // rather than replaying the whole history.
  private highWaterKey(spaceId: string) {
    return `two_relay_seen_${spaceId}`;
  }

  /**
   * Where this space had got to in the relay's own numbering.
   *
   * Kept apart from the clock above rather than replacing it, because the two
   * are not interchangeable and a client can hold one without the other: this
   * one is absent until a numbered record has actually been applied.
   */
  private seqKey(spaceId: string) {
    return `two_relay_seq_${spaceId}`;
  }

  private loadSeqCursor(spaceId: string): number {
    try {
      const parsed = Number(localStorage.getItem(this.seqKey(spaceId)));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Only ever raised, never lowered.
   *
   * A relay standing on its in-memory store while the database is away numbers
   * from one again, so its records carry values far below anything already
   * seen. Refusing to move backwards means such a spell leaves the cursor
   * untouched instead of winding it back and replaying a history.
   */
  private saveSeqCursor(spaceId: string, seq: number) {
    if (!Number.isFinite(seq) || seq <= 0) return;
    try {
      if (seq > this.loadSeqCursor(spaceId)) {
        localStorage.setItem(this.seqKey(spaceId), String(seq));
      }
    } catch {
      /* storage unavailable; the clock cursor still works */
    }
  }

  private loadHighWaterMark(spaceId: string): number {
    try {
      const raw = localStorage.getItem(this.highWaterKey(spaceId));
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHighWaterMark(spaceId: string, lamport: number) {
    if (!Number.isFinite(lamport)) return;
    try {
      if (lamport > this.loadHighWaterMark(spaceId)) {
        localStorage.setItem(this.highWaterKey(spaceId), String(lamport));
      }
    } catch {
      /* storage unavailable; replay just starts from zero next time */
    }
  }

  /**
   * Asks for the next page of history.
   *
   * Guarded on a cursor having actually moved. A page whose records all fail
   * to decrypt - a rotated code, somebody else's room - advances nothing, and
   * asking again would fetch the same page for as long as the socket stayed
   * open. Requiring progress ends that after one wasted round trip, without
   * needing a page limit that would also cap an honest catch-up.
   *
   * Progress means EITHER cursor moving, not whichever one the relay happens
   * to be resuming from. A relay serving from memory answers by the clock and
   * leaves the seq cursor untouched, so watching the seq alone would call a
   * perfectly good catch-up stalled and stop after one page - which is exactly
   * what it did.
   */
  private requestNextReplayPage() {
    const creds = this.creds;
    if (!creds || !this.isOpen()) return;

    const since = this.loadHighWaterMark(creds.spaceId);
    const sinceSeq = this.loadSeqCursor(creds.spaceId);
    const cursor = `${since}:${sinceSeq}`;
    if (cursor === this.lastReplayCursor) return;
    this.lastReplayCursor = cursor;

    this.rawSend({ type: 'REPLAY_MORE', since, sinceSeq });
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;

    this.setStatus('reconnecting');
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_MS
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Idle WebSockets get culled by proxies; a periodic ping keeps the pipe warm.
    this.heartbeatTimer = setInterval(() => this.rawSend({ type: 'PING' }), HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private teardownSocket() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      try {
        socket.close();
      } catch {
        /* already closing */
      }
    }
  }

  disconnect() {
    this.stopped = true;
    this.reconnectAttempts = 0;
    this.teardownSocket();
    this.creds = null;
    this.setStatus('idle');
  }

  private emit(payload: any) {
    this.listeners.forEach(cb => {
      try {
        cb(payload);
      } catch (e) {
        console.error('[Relay] Listener error', e);
      }
    });
  }

  private setStatus(status: RelayStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach(cb => {
      try {
        cb(status);
      } catch {
        /* ignore */
      }
    });
  }

  getStatus(): RelayStatus {
    return this.status;
  }

  private setPartnerOnline(online: boolean, force = false) {
    // Occupancy can change while `online` stays true - a third device arriving
    // is exactly that case - so presence updates must not be deduped on the
    // boolean alone.
    if (this.partnerOnline === online && !force) return;
    this.partnerOnline = online;
    const info = this.presenceInfo;
    this.presenceListeners.forEach(cb => {
      try {
        cb(online, info);
      } catch {
        /* ignore */
      }
    });
  }

  /** Notifies when the partner's device joins or leaves the space. */
  subscribePresence(callback: PresenceCallback) {
    this.presenceListeners.add(callback);
    callback(this.partnerOnline, this.presenceInfo);
    return () => {
      this.presenceListeners.delete(callback);
    };
  }

  reconnectNow() {
    if (this.stopped || !this.creds) return;
    if (this.isOpen()) {
      this.rawSend({ type: 'PING' });
      return;
    }
    this.reconnectAttempts = 0;
    this.teardownSocket();
    this.open();
  }

  subscribe(callback: MessageCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  subscribeStatus(callback: StatusCallback) {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }
}

/** The couple's space. Unchanged: the same object, on the same code path. */
export const wsRelay = new WebSocketRelayClient();

/**
 * Every client that should wake when the tab or the network comes back.
 *
 * These listeners used to name wsRelay directly, which was right while it was
 * the only connection. A group is a second one, and a group that silently
 * failed to reconnect on returning to the app would look exactly like a group
 * where nobody was talking.
 */
const liveClients = new Set<WebSocketRelayClient>([wsRelay]);

export function registerRelayClient(client: WebSocketRelayClient) {
  liveClients.add(client);
}

export function unregisterRelayClient(client: WebSocketRelayClient) {
  liveClients.delete(client);
}

function wakeAll() {
  liveClients.forEach(client => {
    try {
      client.reconnectNow();
    } catch {
      // One bad client must not stop the others waking.
    }
  });
}

// Immediately wake up and reconnect when returning to the tab on mobile browsers or regaining network
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      wakeAll();
    }
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', wakeAll);
}
