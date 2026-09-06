// WebSocket relay client for real-time end-to-end encrypted sync between partners.
//
// Everything leaving this module is AES-GCM ciphertext: the relay sees a room
// id, an author role, a record type and an opaque blob. Decryption happens here
// on the way in, so subscribers keep receiving `record.payload` as a plaintext
// JSON string exactly as they always have.

import { encryptText, decryptText } from './crypto';
import type { SpaceCredentials } from './space';

type MessageCallback = (data: any) => void;

export type RelayStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';

type StatusCallback = (status: RelayStatus) => void;

const RELAY_DEV_PORT = 4000;
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
function resolveRelayUrl(): string {
  const override = (import.meta as any)?.env?.VITE_RELAY_URL as string | undefined;
  if (override) return override;

  const loc = window.location;
  const scheme = loc.protocol === 'https:' ? 'wss:' : 'ws:';

  // Deployed behind the reverse proxy the page is on 80/443, so `port` is empty
  // and the relay is same-origin. Any explicit port means a dev server (vite
  // runs on 3000 here) with the relay alongside it on 4000.
  if (loc.port && loc.port !== String(RELAY_DEV_PORT)) {
    return `${scheme}//${loc.hostname}:${RELAY_DEV_PORT}/relay`;
  }

  return `${scheme}//${loc.host}/relay`;
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

  connect(creds: SpaceCredentials) {
    const switchingSpace = this.creds?.spaceId !== creds.spaceId;
    this.creds = creds;
    this.stopped = false;

    if (this.ws && !switchingSpace) {
      const state = this.ws.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
    }

    if (switchingSpace) this.teardownSocket();
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
        userId: this.creds.role,
        // Ask only for what we missed while disconnected, so nothing we have
        // already applied gets replayed and duplicated.
        since: this.loadHighWaterMark(this.creds.spaceId)
      });

      this.startHeartbeat();
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

    if (payload?.type !== 'REMOTE_RECORD' || !payload.record) {
      this.emit(payload);
      return;
    }

    const creds = this.creds;
    if (!creds) return;

    const record = payload.record;
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
    if (!creds || !this.isOpen()) return;

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

      this.rawSend({
        type: 'RECORD',
        spaceId: creds.spaceId,
        record: {
          id: recordId,
          spaceId: creds.spaceId,
          authorId: creds.role,
          type,
          payload: ciphertext,
          nonce,
          lamportClock: this.lamport,
          clientTs: Date.now(),
          createdAt: new Date().toISOString()
        }
      });
    } catch (e) {
      console.error('[Relay] Encryption failed', e);
    }
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
