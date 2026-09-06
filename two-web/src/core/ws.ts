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

class WebSocketRelayClient {
  private ws: WebSocket | null = null;
  private creds: SpaceCredentials | null = null;

  private listeners = new Set<MessageCallback>();
  private statusListeners = new Set<StatusCallback>();

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private stopped = false;

  private status: RelayStatus = 'idle';
  private lamport = Date.now();

  // Inbound records are decrypted asynchronously; chaining them keeps canvas
  // strokes and chat messages in the order the partner sent them.
  private inboundChain: Promise<void> = Promise.resolve();

  // Records sent but not yet acknowledged by the relay. Anything written while
  // the socket is down waits here instead of being dropped, and is replayed on
  // reconnect - a phone asleep, a tunnel, or a sleeping free-tier server must
  // not cost the user a message.
  private outbox: any[] = [];

  // Supabase access token, when the deployment uses accounts. Kept here rather
  // than fetched at JOIN time because JOIN runs inside a sync onopen handler.
  private accessToken: string | null = null;

  // Because the outbox re-sends, the partner can legitimately receive the same
  // record twice. Handlers like CHAT append blindly, so duplicates are filtered
  // here rather than in fifty call sites.
  private appliedIds: string[] = [];
  private appliedSet = new Set<string>();

  /** Supplies the token the relay checks on JOIN; reconnects if it changed. */
  setAccessToken(token: string | null) {
    const changed = this.accessToken !== token;
    this.accessToken = token;
    if (changed && this.isOpen()) this.reconnectNow();
  }

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
        role: this.creds.role,
        accessToken: this.accessToken,
        // Ask only for what we missed while disconnected, so nothing we have
        // already applied gets replayed and duplicated.
        since: this.loadHighWaterMark(this.creds.spaceId)
      });

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

    if (payload?.type === 'UNAUTHORIZED') {
      // Retrying cannot help until the user signs in again.
      console.warn('[Relay] Rejected: not signed in');
      this.stopped = true;
      this.setStatus('idle');
      this.emit(payload);
      return;
    }

    if (payload?.type === 'RECORD_ACK' && payload.recordId) {
      // Confirmed by the relay, so stop re-sending it. `persisted: false` means
      // the relay took it but its database is down; it stays deliverable live,
      // and the relay flushes it to storage on recovery.
      this.ackRecord(payload.recordId);
      this.emit(payload);
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
    } catch {
      // Authentication failed: a stale record from a rotated code, or someone
      // in the room without the key. Dropping it is the correct outcome.
    }
  }

  /** Encrypts `data` and broadcasts it to the partner. Fire-and-forget. */
  broadcastUpdate(type: string, data: any): void {
    void this.encryptAndSend(type, data);
  }

  private async encryptAndSend(type: string, data: any) {
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
        authorId: creds.role,
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

      this.enqueue(record);
      this.flushOutbox();
    } catch (e) {
      console.error('[Relay] Encryption failed', e);
    }
  }

  private enqueue(record: any) {
    this.outbox.push(record);
    if (this.outbox.length > MAX_OUTBOX) this.outbox.shift();
    this.persistOutbox();
  }

  /** Sends everything still awaiting acknowledgement. Safe to call repeatedly. */
  private flushOutbox() {
    if (!this.isOpen() || !this.creds) return;
    for (const record of this.outbox) {
      this.rawSend({ type: 'RECORD', spaceId: record.spaceId, record });
    }
  }

  private ackRecord(recordId: string) {
    const before = this.outbox.length;
    this.outbox = this.outbox.filter(r => r.id !== recordId);
    if (this.outbox.length !== before) this.persistOutbox();
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
      this.outbox = raw ? JSON.parse(raw) : [];
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

export const wsRelay = new WebSocketRelayClient();

// Immediately wake up and reconnect when returning to the tab on mobile browsers or regaining network
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      wsRelay.reconnectNow();
    }
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    wsRelay.reconnectNow();
  });
}
