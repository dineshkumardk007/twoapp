// WebSocket relay client for real-time end-to-end encrypted sync between partners.
//
// Everything leaving this module is AES-GCM ciphertext: the relay sees a room
// id, an author role, a record type and an opaque blob. Decryption happens here
// on the way in, so subscribers keep receiving `record.payload` as a plaintext
// JSON string exactly as they always have.

import { encryptText, decryptText } from './crypto';
import { getDeviceId } from './space';
import {
  ANSWER_WITHIN_MS,
  HEARTBEAT_MS,
  MISSES_BEFORE_DEAD,
  bytesLeaving,
  isLateBeat,
  missedHeartbeats,
  utf8Length
} from './heartbeat';
import type { SpaceCredentials } from './space';
import { isShown, onShownChange } from './shown';
import { holdAwake } from './background';

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

/**
 * The largest record the relay accepts, matched here so an oversized one is
 * refused where somebody can be told about it.
 *
 * It used to be sent anyway: the relay replied with an error carrying no
 * record id, nothing listened for it, and the record sat in the outbox being
 * retried forever. A voice memo of a few minutes did that, and the screen
 * said it had been sent.
 */
export const MAX_RECORD_BYTES = 1024 * 1024;

/** Everything in a record besides its payload: ids, nonce, clocks, field names. */
const RECORD_ENVELOPE_BYTES = 600;

/**
 * How big `data` will be once encrypted and wrapped as a record - the number
 * MAX_RECORD_BYTES applies to. Mirrors encryptAndSend: the JSON is encrypted
 * (plus a 16-byte tag) and the ciphertext is sent as base64, so anything that
 * is already base64 inside it - a photo, a recording - grows by a third twice.
 */
export function recordSizeOf(data: unknown): number {
  const plain = new TextEncoder().encode(JSON.stringify(data)).length;
  return Math.ceil((plain + 16) / 3) * 4 + RECORD_ENVELOPE_BYTES;
}
const MAX_APPLIED_IDS = 4_000;

/**
 * How many of this phone's own chat messages it remembers the record id of
 * (sentKey). The relay names a message that has reached her phone by its
 * record id alone - it cannot see the message id inside - so this is how
 * that turns back into a message on screen.
 */
export const MAX_SENT_IDS = 2_000;

/** The most entries one REACHED may carry; the relay sends them in chunks of this. */
export const MAX_REACHED_ENTRIES = 300;

/** Ids are uuids; anything much longer than one is not an id. */
const MAX_ID_CHARS = 64;

/** One message of yours the relay says has reached her phone, and when. */
export interface ReachedEntry {
  id: string;
  at: number;
}

/**
 * The entries of a REACHED that can be trusted as far as their shape goes:
 * an id short enough to be one, and a time that is a number. Anything that
 * is not a list, or longer than the relay ever sends, is taken as nothing.
 */
export function readReached(reached: unknown): ReachedEntry[] {
  if (!Array.isArray(reached) || reached.length > MAX_REACHED_ENTRIES) return [];
  const out: ReachedEntry[] = [];
  for (const entry of reached) {
    const id = entry?.id;
    const at = Number(entry?.at);
    if (typeof id !== 'string' || !id || id.length > MAX_ID_CHARS || !Number.isFinite(at)) continue;
    out.push({ id, at });
  }
  return out;
}

/**
 * The message ids of a REACHED, by the time each reached her phone - the
 * shape applyDelivered takes, one time to a call. Anything malformed is left
 * out (readReached).
 */
export function reachedByTime(reached: unknown): Map<number, string[]> {
  const byTime = new Map<number, string[]>();
  for (const { id, at } of readReached(reached)) {
    const ids = byTime.get(at);
    if (ids) ids.push(id);
    else byTime.set(at, [id]);
  }
  return byTime;
}

/**
 * How long a record sent on this connection waits for its acknowledgement
 * before it is sent again. Far longer than an acknowledgement takes - even
 * with the relay and its database on different continents it is well under
 * a second - so only a record that was genuinely lost, refused by the rate
 * limit or swallowed by a dying socket, goes out twice.
 */
const RESEND_AFTER_MS = 15_000;
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

/** The relay this device connects to - also what Settings shows. */
export function resolveRelayUrl(): string {
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
  private durableListeners = new Set<(durable: boolean) => void>();

  /**
   * Whether the relay is keeping what it is given.
   *
   * Null until it says. False means messages still reach a partner who is
   * online now, but nothing is being stored for a phone that is not.
   */
  private durable: boolean | null = null;

  /**
   * Call relay (TURN) logins, handed over by the relay. Null until it does,
   * or when it has none to give - a call then uses STUN alone, as it always
   * did.
   */
  private iceServers: { servers: RTCIceServer[]; expiresAt: number } | null = null;
  private iceWaiters: Array<() => void> = [];

  /**
   * True between asking for history and being told there is no more of it.
   *
   * Records arriving inside that window are history rather than news, which is
   * the difference between a quiet restore and four hundred message chimes.
   */
  private replaying = false;

  /**
   * True when this device asked for history from nothing - a reinstall, a new
   * phone. Everything it receives is being restored, not happening now.
   */
  private restoring = false;

  /**
   * True while history is being fetched again after a seat switch - see
   * CATCH_UP_TYPES in seats.ts. Records arriving in that replay are marked,
   * so the screen applies only what is safe to apply twice.
   */
  private catchingUp = false;

  /**
   * Bumped whenever the read position is wound back.
   *
   * A record is handed to the screen first and its position saved after -
   * and the screen can wind the position back from inside that handover (a
   * name heard from the other seat ends a clash, and fetches everything
   * again). Saving the position afterwards would put it straight back past
   * what the rewind was for, so a record handed over before a rewind does
   * not get to save one.
   */
  private cursorGeneration = 0;

  /** A flush waiting to retry records the relay turned away for coming too fast. */
  private retryFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private partnerOnline = false;
  private presenceInfo: PresenceInfo = { peers: 0, ownDevices: 0, total: 0 };

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * When anything last arrived on the current socket, and when its last PING
   * went out. A socket can stay OPEN long after the network under it has gone
   * - a phone asleep while its NAT mapping lapsed - and says nothing until TCP
   * gives up minutes later, with the partner still shown as she was before.
   * A PING that nothing follows is how to tell.
   */
  private lastInboundAt = 0;
  private pingSentAt = 0;
  /** Heartbeats in a row with no answer, and what the socket held at the last (core/heartbeat). */
  private missedBeats = 0;
  private bufferedAtBeat = -1;
  /**
   * Bytes handed to this socket so far, and the count at the last heartbeat:
   * what it holds is only judged against what it was given since.
   */
  private bytesHanded = 0;
  private bytesHandedAtBeat = 0;
  /** Waiting to see whether the PING sent on coming back was answered. */
  private answerTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * When the last heartbeat ran; 0 before the first on this socket. A gap far
   * longer than a beat means the phone held the timers back (isLateBeat).
   */
  private lastBeatAt = 0;
  /** When the phone was last asked to stay awake for something arriving. */
  private heldAwakeAt = 0;
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
  /**
   * Correlation ids handed to broadcastUpdate whose record is still being
   * encrypted, so not in the outbox yet - waiting all the same (isPending).
   */
  private preparing = new Set<string>();

  /**
   * When each waiting record last went out on the current socket, by id.
   *
   * Every new record used to send the entire outbox along with it, so three
   * messages typed while the first was still unacknowledged went out as six,
   * and a burst of drawing as a triangle number of them - each one a database
   * write and a broadcast on the relay, at exactly the moment it was busiest.
   * Cleared whenever a socket opens, so a new connection still sends
   * everything that was waiting. Not persisted: it describes one socket.
   */
  private sentOnSocket = new Map<string, number>();


  // Because the outbox re-sends, the partner can legitimately receive the same
  // record twice. Handlers like CHAT append blindly, so duplicates are filtered
  // here rather than in fifty call sites.
  private appliedIds: string[] = [];
  private appliedSet = new Set<string>();

  /**
   * Record id -> message id for this phone's own chat messages, read from
   * sentKey once per space and kept here, so a restore that brings back a
   * thousand of them does not write the whole list a thousand times.
   */
  private sent: { spaceId: string; pairs: Array<[string, string]>; byRecord: Map<string, string> } | null = null;
  private sentSaveTimer: ReturnType<typeof setTimeout> | null = null;

  connect(creds: SpaceCredentials) {
    const switchingSpace = this.creds?.spaceId !== creds.spaceId;
    // The seat is announced once, when the socket joins. A device switched to
    // the other seat kept its open socket - and with it the old seat, which
    // the relay uses to decide what to replay and who counts as the partner -
    // until something happened to reconnect it.
    const previousSeat = this.creds ? this.creds.authorLabel || this.creds.role : null;
    const switchingSeat =
      !switchingSpace && previousSeat !== null && previousSeat !== (creds.authorLabel || creds.role);
    this.creds = creds;
    this.stopped = false;

    if (this.ws && !switchingSpace && !switchingSeat) {
      const state = this.ws.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
    }

    if (switchingSpace) {
      this.teardownSocket();
      this.restoreOutbox(creds.spaceId);
    } else if (switchingSeat) {
      this.teardownSocket();
      this.takeNewSeat(creds);
    }
    this.open();
  }

  /**
   * Moves what this client holds over to the seat it has just taken.
   *
   * Records still waiting to go were written for the old seat and would be
   * sent under it - where the phone that still sits there takes them for its
   * own. The author is not part of what the encryption binds (the record id,
   * space and type are), so it can be corrected without re-encrypting.
   *
   * And the read position is wound back to the start. While two phones shared
   * a seat, the relay withheld from each everything the other wrote while it
   * was away, and the position had already moved past all of it. Fetching the
   * history again is the only way to get it; what is safe to apply from it is
   * decided on the other side (see catchingUp).
   */
  private takeNewSeat(creds: SpaceCredentials) {
    const seat = creds.authorLabel || creds.role;
    for (const entry of this.outbox) entry.record.authorId = seat;
    this.persistOutbox();
    this.cursorGeneration++;
    try {
      localStorage.removeItem(this.highWaterKey(creds.spaceId));
      localStorage.removeItem(this.seqKey(creds.spaceId));
      // Messages sent from the old seat: the relay files any "reached" for
      // them under that seat, never this one.
      localStorage.removeItem(this.sentKey(creds.spaceId));
      localStorage.removeItem(this.reachedKey(creds.spaceId));
    } catch {
      /* storage unavailable: nothing to wind back */
    }
    this.forgetSentCache(creds.spaceId);
    this.catchingUp = true;
  }

  /**
   * Fetches the history again for a phone that kept its seat through a clash.
   *
   * While both phones sat in one seat, everything the other person wrote was
   * filed under this phone's own seat - and the relay never replays a seat's
   * own records back to it. Once the other phone has moved, those records are
   * still only reachable by asking for everything; the phone that moved does
   * the same thing as part of moving (see takeNewSeat).
   */
  catchUpAfterClash() {
    if (!this.creds || this.stopped) return;
    this.teardownSocket();
    this.takeNewSeat(this.creds);
    this.open();
  }

  /** The seat this client is connected (or connecting) in, or null with none. */
  currentSeat(): string | null {
    return this.creds ? this.creds.authorLabel || this.creds.role : null;
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
    // Nothing has been sent on this socket yet.
    this.sentOnSocket.clear();
    this.pingSentAt = 0;
    this.missedBeats = 0;
    this.bufferedAtBeat = -1;
    this.bytesHanded = 0;
    this.bytesHandedAtBeat = 0;

    socket.onopen = () => {
      if (this.stopped || !this.creds) return;
      this.reconnectAttempts = 0;
      this.setStatus('connected');

      const highWater = this.loadHighWaterMark(this.creds.spaceId);
      const seqCursor = this.loadSeqCursor(this.creds.spaceId);
      this.replaying = true;
      // A phone with nothing yet is being given its history. That stays so
      // until the history has all come - across a dropped connection too,
      // when the cursors have moved but the rest is still history.
      const fresh = highWater === 0 && seqCursor === 0;
      try {
        if (fresh) localStorage.setItem(this.restoreKey(this.creds.spaceId), '1');
        this.restoring = fresh || localStorage.getItem(this.restoreKey(this.creds.spaceId)) === '1';
      } catch {
        this.restoring = fresh;
      }

      this.rawSend({
        type: 'JOIN',
        spaceId: this.creds.spaceId,
        // Delivery is per device; `role` stays the authorship label.
        userId: getDeviceId(),
        role: this.creds.authorLabel || this.creds.role,
        // Ask only for what we missed while disconnected, so nothing we have
        // already applied gets replayed and duplicated.
        since: highWater,
        // The relay's own numbering, once we have applied a record carrying
        // one. Zero means "no such cursor yet", and the relay falls back to
        // the clock above - which is what happens on the first connection
        // after an upgrade, and for as long as a relay does not number at all.
        sinceSeq: seqCursor,
        // The newest "reached her phone" this device has heard. A relay that
        // kept some while this phone was away sends the ones after it; an
        // older relay ignores it.
        reachedSince: this.loadReachedCursor(this.creds.spaceId)
      });

      // Each connection pages through history from wherever it left off.
      this.lastReplayCursor = '';

      this.startHeartbeat();

      // Deliver anything written while we were offline.
      this.flushOutbox();
    };

    socket.onmessage = (event) => {
      this.lastInboundAt = Date.now();
      // In the background the phone may sleep again before what just arrived
      // is decrypted and answered - her message never said to have landed.
      // A moment awake is enough; asked at most every two seconds, so a page
      // of history does not ask a hundred times.
      if (!isShown() && this.lastInboundAt - this.heldAwakeAt >= 2_000) {
        this.heldAwakeAt = this.lastInboundAt;
        holdAwake(5_000);
      }
      const raw = typeof event.data === 'string' ? event.data : '';
      if (!raw) return;
      this.inboundChain = this.inboundChain
        .then(() => this.handleInbound(raw))
        .catch(() => undefined);
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      this.setPartnerOnline(false);
      this.durable = null;
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

    if (payload?.type === 'JOINED' || payload?.type === 'RELAY_STATUS') {
      this.setDurable(payload.storage === 'memory' ? false : payload.durable !== false);
      if (payload.type === 'RELAY_STATUS') return;
    }

    if (payload?.type === 'ICE_SERVERS') {
      const servers = Array.isArray(payload.iceServers) ? (payload.iceServers as RTCIceServer[]) : null;
      const expiresAt = Number(payload.expiresAt);
      if (servers && servers.length > 0 && Number.isFinite(expiresAt)) {
        this.iceServers = { servers, expiresAt };
      }
      const waiters = this.iceWaiters;
      this.iceWaiters = [];
      waiters.forEach(done => done());
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
      if (!payload.more) {
        this.replaying = false;
        this.restoring = false;
        this.catchingUp = false;
        try {
          if (this.creds) localStorage.removeItem(this.restoreKey(this.creds.spaceId));
        } catch {
          /* storage unavailable */
        }
      }
      this.emit({ ...payload, restoring: this.restoring });
      // A relay that says there is more has capped this batch; ask for the
      // rest. Ordering is safe because inbound messages are chained, so every
      // record in this page has already been applied and both cursors moved
      // before this arrives.
      if (payload.more) this.requestNextReplayPage();
      return;
    }

    if (payload?.type === 'ERROR' && typeof payload.recordId === 'string') {
      // The relay turned this record away for arriving too fast. It is not on
      // its way after all, so it goes back to being unsent - and the next
      // flush sends it in its place in the queue, ahead of anything newer,
      // instead of a newer copy of the same thing overtaking it.
      this.sentOnSocket.delete(payload.recordId);
      this.scheduleRetryFlush();
    }

    if (payload?.type === 'REACHED') {
      this.handleReached(payload.reached);
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
      // My own message, written on my other device: when it reaches her
      // phone the relay tells both of mine, by record id.
      if (record.type === 'CHAT' && record.authorId === this.currentSeat()) {
        this.rememberOwnChat(creds.spaceId, record.id, plaintext);
      }
      const generation = this.cursorGeneration;
      // Same shape subscribers have always received: payload is a JSON string.
      this.emit({
        type: 'REMOTE_RECORD',
        record: { ...record, payload: plaintext },
        // History, not news: the screen treats the two differently.
        replay: this.replaying,
        restoring: this.restoring,
        catchUp: this.catchingUp && this.replaying
      });
      // Not if the position was wound back while this record was being
      // handled - see cursorGeneration.
      if (generation === this.cursorGeneration) {
        this.saveHighWaterMark(creds.spaceId, Number(record.lamportClock));
        this.saveSeqCursor(creds.spaceId, Number(record.seq));
      }
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
    if (!correlationId) {
      void this.encryptAndSend(type, data);
      return;
    }
    this.preparing.add(correlationId);
    void this.encryptAndSend(type, data, correlationId).finally(() => this.preparing.delete(correlationId));
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

      const bytes = new TextEncoder().encode(JSON.stringify(record)).length;
      if (bytes > MAX_RECORD_BYTES) {
        // Not queued: the relay would refuse it, and a queue full of records
        // that can never be accepted blocks nothing but is retried forever.
        console.error(`[Relay] ${type} is ${bytes} bytes, over the ${MAX_RECORD_BYTES} limit - not sent`);
        this.emit({ type: 'RECORD_TOO_LARGE', recordType: type, bytes, correlationId });
        return;
      }

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
    // Remembered now, not when the relay acknowledges it: her phone can say
    // it has the message before the acknowledgement gets back here.
    if (correlationId && record.type === 'CHAT') {
      this.rememberSent(record.spaceId, record.id, correlationId, true);
    }
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
    const now = Date.now();
    for (const entry of this.outbox) {
      // Already on its way over this socket, and not long enough ago to count
      // as lost. See sentOnSocket.
      const sentAt = this.sentOnSocket.get(entry.record.id);
      if (sentAt !== undefined && now - sentAt < RESEND_AFTER_MS) continue;
      // Sent before but not acknowledged: worth repeating only once the socket
      // has actually finished sending. A photo going up a slow connection can
      // take longer than the wait above, and repeating it then just queues the
      // same megabyte behind itself.
      if (sentAt !== undefined && (this.ws?.bufferedAmount ?? 0) > 0) continue;

      this.lamport = Math.max(this.lamport + 1, Date.now());
      entry.record.lamportClock = this.lamport;
      this.sentOnSocket.set(entry.record.id, now);
      // Only the record goes on the wire; correlationId is a local concern.
      this.rawSend({ type: 'RECORD', spaceId: entry.record.spaceId, record: entry.record });
    }
  }

  /** Removes an acknowledged record and reports which message it belonged to. */
  private ackRecord(recordId: string): string | undefined {
    const entry = this.outbox.find(e => e.record.id === recordId);
    if (!entry) return undefined;
    this.sentOnSocket.delete(recordId);
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
      localStorage.removeItem(this.restoreKey(spaceId));
      localStorage.removeItem(this.sentKey(spaceId));
      localStorage.removeItem(this.reachedKey(spaceId));
    } catch {
      /* storage unavailable; nothing was written to begin with */
    }
    this.forgetSentCache(spaceId);
  }

  /**
   * The room details the phone keeps outside the PIN vault, so it can confirm
   * delivery while Two is closed or locked (core/background): the room id,
   * this device, its seat and how far it has read. Null with no room.
   *
   * Never the key or the code. Without those nothing the relay hands over can
   * be opened, and the room id already sits in plain storage, in the names of
   * the keys below.
   */
  roomDetails(): { spaceId: string; deviceId: string; seat: string; since: number; sinceSeq: number } | null {
    const creds = this.creds;
    if (!creds) return null;
    return {
      spaceId: creds.spaceId,
      deviceId: getDeviceId(),
      seat: creds.authorLabel || creds.role,
      since: this.loadHighWaterMark(creds.spaceId),
      sinceSeq: this.loadSeqCursor(creds.spaceId)
    };
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

  /**
   * Whether a record is still waiting to go - being encrypted, or in the
   * outbox unacknowledged. Named by its correlation id, as for dropPending.
   */
  isPending(correlationId: string): boolean {
    return this.preparing.has(correlationId) || this.outbox.some(e => e.correlationId === correlationId);
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
      const text = JSON.stringify(data);
      this.ws!.send(text);
      this.bytesHanded += utf8Length(text);
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

  /** Set while a phone's history is still being brought back to it. */
  private restoreKey(spaceId: string) {
    return `two_relay_restoring_${spaceId}`;
  }

  /**
   * This phone's own chat messages, as [record id, message id] pairs, oldest
   * first. Ids only: nothing in here says what a message said.
   */
  private sentKey(spaceId: string) {
    return `two_relay_sent_${spaceId}`;
  }

  /** The newest time in any REACHED heard here, so a reconnect asks only for later ones. */
  private reachedKey(spaceId: string) {
    return `two_relay_reached_${spaceId}`;
  }

  private loadReachedCursor(spaceId: string): number {
    try {
      const parsed = Number(localStorage.getItem(this.reachedKey(spaceId)));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveReachedCursor(spaceId: string, at: number) {
    if (!Number.isFinite(at) || at <= 0) return;
    try {
      if (at > this.loadReachedCursor(spaceId)) localStorage.setItem(this.reachedKey(spaceId), String(at));
    } catch {
      /* storage unavailable: the relay sends them again next time */
    }
  }

  private sentFor(spaceId: string) {
    if (this.sent?.spaceId === spaceId) return this.sent;
    let pairs: Array<[string, string]> = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(this.sentKey(spaceId)) || '[]');
      if (Array.isArray(parsed)) {
        pairs = parsed.filter(
          (p: unknown): p is [string, string] =>
            Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string'
        );
      }
    } catch {
      pairs = [];
    }
    // A write still waiting belongs to the space it was made in.
    if (this.sentSaveTimer) this.saveSent();
    this.sent = { spaceId, pairs, byRecord: new Map(pairs) };
    return this.sent;
  }

  /**
   * Remembers which message a record of mine carried. `now` writes it at
   * once - a message just typed, which a reload must not lose; otherwise the
   * write waits a moment, for the rest of a page of history to join it.
   */
  private rememberSent(spaceId: string, recordId: string, messageId: string, now: boolean) {
    if (!recordId || !messageId || recordId.length > MAX_ID_CHARS || messageId.length > MAX_ID_CHARS) return;
    const sent = this.sentFor(spaceId);
    if (sent.byRecord.has(recordId)) return;
    sent.pairs.push([recordId, messageId]);
    sent.byRecord.set(recordId, messageId);
    while (sent.pairs.length > MAX_SENT_IDS) {
      const evicted = sent.pairs.shift();
      if (evicted) sent.byRecord.delete(evicted[0]);
    }
    if (now) this.saveSent();
    else if (!this.sentSaveTimer) {
      this.sentSaveTimer = setTimeout(() => {
        this.sentSaveTimer = null;
        this.saveSent();
      }, 500);
    }
  }

  private rememberOwnChat(spaceId: string, recordId: string, plaintext: string) {
    try {
      const messageId = JSON.parse(plaintext)?.id;
      if (typeof messageId === 'string') this.rememberSent(spaceId, recordId, messageId, false);
    } catch {
      /* not a message after all: nothing to remember */
    }
  }

  private saveSent() {
    if (this.sentSaveTimer) {
      clearTimeout(this.sentSaveTimer);
      this.sentSaveTimer = null;
    }
    const sent = this.sent;
    if (!sent) return;
    try {
      localStorage.setItem(this.sentKey(sent.spaceId), JSON.stringify(sent.pairs));
    } catch {
      /* quota: kept for this session, and her opening Two still ticks it */
    }
  }

  private forgetSentCache(spaceId: string) {
    if (this.sent?.spaceId !== spaceId) return;
    if (this.sentSaveTimer) {
      clearTimeout(this.sentSaveTimer);
      this.sentSaveTimer = null;
    }
    this.sent = null;
  }

  /**
   * The relay saying messages of mine have reached her phone - told by her
   * phone's listener while Two was closed or locked there. It names them by
   * record id; those are turned back into message ids here, and the ones this
   * phone did not send (or no longer remembers) are let go.
   *
   * The time is kept whether or not anything maps, so the next connection
   * does not ask for the same ones again.
   */
  private handleReached(reached: unknown) {
    const creds = this.creds;
    if (!creds) return;
    const entries = readReached(reached);
    if (!entries.length) return;
    this.saveReachedCursor(creds.spaceId, Math.max(...entries.map(e => e.at)));
    const sent = this.sentFor(creds.spaceId);
    const mapped: ReachedEntry[] = [];
    for (const entry of entries) {
      const messageId = sent.byRecord.get(entry.id);
      if (messageId) mapped.push({ id: messageId, at: entry.at });
    }
    if (mapped.length) this.emit({ type: 'REACHED', reached: mapped });
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

  /** Flushes again shortly - after the relay's rate limit has had time to refill. */
  private scheduleRetryFlush() {
    if (this.retryFlushTimer) return;
    this.retryFlushTimer = setTimeout(() => {
      this.retryFlushTimer = null;
      this.flushOutbox();
    }, 1_500);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastBeatAt = 0;
    // Idle WebSockets get culled by proxies; a periodic ping keeps the pipe warm.
    // It is also when a record that never got its acknowledgement - refused by
    // the rate limit, say, which says so without naming the record - goes out
    // again, instead of waiting for the next thing somebody happens to send.
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const late = isLateBeat(this.lastBeatAt, now);
      this.lastBeatAt = now;
      // PINGs that have each had a whole beat and nothing came: open in name
      // only. Judged from the PING, not from quiet - a quiet room says nothing
      // for minutes. A socket still sending a photo is judged by its bytes
      // leaving instead (core/heartbeat).
      //
      // In the background too, as long as the beats come when they should:
      // Two now stays connected there, and a socket that died while the phone
      // was in a pocket used to be kept until Two was opened again. Only a
      // beat that comes late is not trusted to judge - the phone held the
      // timers back, perhaps past an answer that did come - so it asks once
      // more instead, and checkAlive replaces the socket if nothing answers.
      const buffered = this.ws?.bufferedAmount ?? 0;
      if (!isShown() && late) {
        this.missedBeats = 0;
        this.bufferedAtBeat = buffered > 0 ? buffered : -1;
        this.bytesHandedAtBeat = this.bytesHanded;
        this.flushOutbox();
        this.checkAlive();
        return;
      }
      this.missedBeats = missedHeartbeats({
        buffered,
        bufferedBefore: this.bufferedAtBeat,
        queuedSince: this.bytesHanded - this.bytesHandedAtBeat,
        pingSentAt: this.pingSentAt,
        lastInboundAt: this.lastInboundAt,
        missed: this.missedBeats,
        now
      });
      this.bufferedAtBeat = buffered > 0 ? buffered : -1;
      this.bytesHandedAtBeat = this.bytesHanded;
      if (this.missedBeats >= MISSES_BEFORE_DEAD) {
        this.replaceSocket();
        return;
      }
      // What waits goes before the PING, not after: flushOutbox holds back a
      // repeat while anything is still leaving, and the PING just handed over
      // counted as that - so a record whose acknowledgement was lost on a
      // socket that stayed up was never sent again.
      this.flushOutbox();
      this.ping();
    }, HEARTBEAT_MS);
  }

  private ping() {
    if (!this.isOpen()) return;
    // Behind something still going up, its answer waits on all of that, so
    // the time it went proves nothing. The PING still goes.
    if ((this.ws?.bufferedAmount ?? 0) === 0) this.pingSentAt = Date.now();
    this.rawSend({ type: 'PING' });
  }

  /** Drops a socket that has stopped answering, and opens a new one. */
  private replaceSocket() {
    this.teardownSocket();
    this.open();
  }

  /**
   * Sends a PING and replaces the socket if nothing at all arrives after it.
   * Any message will do: the relay answers a PING at once, so silence means
   * the socket is gone.
   *
   * A check still waiting is started again rather than left to answer: the
   * answer to a PING sent before the network went proves nothing after.
   *
   * Nor is a socket still sending a photo judged: the PING is queued behind
   * it, so the wait starts over while its bytes are leaving, and once more
   * after it has gone for the answer. Bytes that have not moved for two waits
   * in a row are a socket with nothing under it, replaced like a silent one
   * (core/heartbeat).
   */
  private checkAlive() {
    if (this.answerTimer) clearTimeout(this.answerTimer);
    const socket = this.ws;
    const asked = Date.now();
    this.ping();
    let wasSending = false;
    let stuck = 0;
    let bufferedBefore = socket?.bufferedAmount ?? 0;
    let handedBefore = this.bytesHanded;
    const judge = () => {
      this.answerTimer = null;
      if (this.stopped || this.ws !== socket || this.lastInboundAt >= asked) return;
      const buffered = socket?.bufferedAmount ?? 0;
      if (buffered > 0) {
        stuck = bytesLeaving(buffered, bufferedBefore, this.bytesHanded - handedBefore) ? 0 : stuck + 1;
        bufferedBefore = buffered;
        handedBefore = this.bytesHanded;
        wasSending = true;
        if (stuck < MISSES_BEFORE_DEAD) {
          this.answerTimer = setTimeout(judge, ANSWER_WITHIN_MS);
          return;
        }
      } else if (wasSending) {
        wasSending = false;
        this.answerTimer = setTimeout(judge, ANSWER_WITHIN_MS);
        return;
      }
      this.replaceSocket();
    };
    this.answerTimer = setTimeout(judge, ANSWER_WITHIN_MS);
  }

  private stopHeartbeat() {
    this.lastBeatAt = 0;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private teardownSocket() {
    this.stopHeartbeat();
    if (this.retryFlushTimer) {
      clearTimeout(this.retryFlushTimer);
      this.retryFlushTimer = null;
    }
    if (this.answerTimer) {
      clearTimeout(this.answerTimer);
      this.answerTimer = null;
    }
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
    // The onclose that says so was taken off above, and with no socket there
    // is nobody to say she is there.
    this.setPartnerOnline(false);
  }

  disconnect() {
    // A write of the sent list still waiting goes now, while it has its room.
    if (this.sentSaveTimer) this.saveSent();
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

  private setDurable(durable: boolean) {
    if (this.durable === durable) return;
    this.durable = durable;
    this.durableListeners.forEach(cb => {
      try {
        cb(durable);
      } catch {
        /* ignore */
      }
    });
  }

  /**
   * Notifies when the relay starts or stops keeping what it is sent.
   *
   * Called immediately with what is known, which may be null - not yet
   * connected, and so nothing to report either way.
   */
  subscribeDurable(callback: (durable: boolean) => void) {
    this.durableListeners.add(callback);
    if (this.durable !== null) callback(this.durable);
    return () => {
      this.durableListeners.delete(callback);
    };
  }

  /**
   * Call relay servers for a call about to connect, or null for none.
   *
   * Uses what the relay handed over on joining while it has comfortably
   * longer to run than any call; otherwise asks again. Never waits longer
   * than `timeoutMs` - a relay that has not answered by then, or an older one
   * that does not know the question, leaves the call exactly as it was before
   * there was any TURN at all.
   */
  async getIceServers(timeoutMs = 2_000): Promise<RTCIceServer[] | null> {
    const fresh = () =>
      this.iceServers && this.iceServers.expiresAt - Date.now() > 60 * 60 * 1000 ? this.iceServers.servers : null;
    if (fresh()) return fresh();
    if (!this.isOpen() || !this.creds) return this.usableIceServers();

    await new Promise<void>(resolve => {
      const timer = setTimeout(done, timeoutMs);
      function done() {
        clearTimeout(timer);
        resolve();
      }
      this.iceWaiters.push(done);
      this.rawSend({ type: 'ICE_SERVERS_REQUEST' });
    });
    return this.usableIceServers();
  }

  /** Whatever is held and not yet expired - old logins still beat none. */
  private usableIceServers(): RTCIceServer[] | null {
    return this.iceServers && this.iceServers.expiresAt > Date.now() ? this.iceServers.servers : null;
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
      // Open, perhaps only in name: a phone back from sleep can hold a socket
      // whose network went away under it, still showing the partner as she
      // was. Trusting it is what kept "online" up for minutes.
      this.checkAlive();
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

// Immediately wake up and reconnect when returning to the tab on mobile browsers or regaining network.
// Coming back is the page shown again (core/shown.ts): visible, and the
// Android app no longer saying it is in the background or the screen is off.
onShownChange(shown => {
  if (shown) wakeAll();
});
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('online', wakeAll);
}
