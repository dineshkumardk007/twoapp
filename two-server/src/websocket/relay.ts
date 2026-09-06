import { WebSocket, WebSocketServer } from 'ws';
import { db, StoredRecord } from '../db.js';

interface SpaceClient {
  ws: WebSocket;
  /**
   * Server-assigned, unique per socket. Routing keys off THIS rather than
   * anything the client supplies, so two devices are always distinct even when
   * an older client reports the same userId for both (it used to send the
   * user-chosen role, which made the relay treat a couple as one participant
   * and forward nothing between them).
   */
  connectionId: number;
  /** Client-supplied device id where available; diagnostics only. */
  userId: string;
  /** Authorship label ('user' | 'partner'), used to filter a client's own history. */
  authorRole: string;
  spaceId: string;
  /** Token bucket state for rate limiting. */
  tokens: number;
  lastRefill: number;
}

/** Returns false when the caller has exhausted its budget. */
function consumeToken(client: SpaceClient): boolean {
  const now = Date.now();
  const elapsed = (now - client.lastRefill) / 1000;
  client.tokens = Math.min(RECORD_BURST, client.tokens + elapsed * RECORD_REFILL_PER_SEC);
  client.lastRefill = now;

  if (client.tokens < 1) return false;
  client.tokens -= 1;
  return true;
}

// A single record is a chat line, a mood, or a canvas stroke - never media.
const MAX_RECORD_BYTES = 256 * 1024;

// Cap on how much history one JOIN may replay. Raised from 500 because a fresh
// device signs in with no history at all and refills entirely from here: at 500
// a laptop would show a truncated conversation and look broken. Still bounded,
// so a long-dormant device cannot pull an unlimited backlog in one burst.
const MAX_REPLAY_RECORDS = 2000;

// Nothing here was rate limited, so a single socket could pin the relay and the
// database. A couple types and draws; these ceilings are far above human pace
// (canvas strokes are the burstiest traffic) and far below abusive.
const RECORD_BURST = 60;          // tokens in the bucket
const RECORD_REFILL_PER_SEC = 20; // sustained records/second
const MAX_TOTAL_CLIENTS = 2_000;
const MAX_CLIENTS_PER_SPACE = 8;  // two phones, a tablet, spare reconnects

export class WebSocketRelay {
  private wss: WebSocketServer;
  private clients = new Set<SpaceClient>();
  private nextConnectionId = 1;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.setupServer();
  }

  private setupServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      let currentClient: SpaceClient | null = null;
      const connectionId = this.nextConnectionId++;

      ws.on('message', async (data: Buffer) => {
        if (data.length > MAX_RECORD_BYTES) {
          this.sendJson(ws, { type: 'ERROR', error: 'Record exceeds size limit' });
          return;
        }

        let message: any;
        try {
          message = JSON.parse(data.toString());
        } catch {
          this.sendJson(ws, { type: 'ERROR', error: 'Malformed message' });
          return;
        }

        try {
          // Protocol:
          // 1. JOIN: { type, spaceId, userId, since? }
          // 2. RECORD: { type, spaceId, record }
          // 3. PING: { type }

          if (message.type === 'JOIN') {
            if (!isNonEmptyString(message.spaceId) || !isNonEmptyString(message.userId)) {
              this.sendJson(ws, { type: 'ERROR', error: 'JOIN requires spaceId and userId' });
              return;
            }

            // Re-joining on the same socket replaces the previous membership.
            if (currentClient) this.clients.delete(currentClient);

            if (this.clients.size >= MAX_TOTAL_CLIENTS) {
              this.sendJson(ws, { type: 'ERROR', error: 'Relay at capacity, try again shortly' });
              ws.close();
              return;
            }

            let inSpace = 0;
            for (const c of this.clients) if (c.spaceId === message.spaceId) inSpace++;
            if (inSpace >= MAX_CLIENTS_PER_SPACE) {
              this.sendJson(ws, { type: 'ERROR', error: 'Too many devices in this space' });
              ws.close();
              return;
            }

            currentClient = {
              ws,
              connectionId,
              userId: message.userId,
              // Older clients send only userId, which was the role; falling back
              // to it keeps them working unchanged.
              authorRole: isNonEmptyString(message.role) ? message.role : message.userId,
              spaceId: message.spaceId,
              tokens: RECORD_BURST,
              lastRefill: Date.now()
            };
            this.clients.add(currentClient);

            this.sendJson(ws, {
              type: 'JOINED',
              spaceId: message.spaceId,
              timestamp: Date.now()
            });

            await this.replayMissedRecords(currentClient, message.since);
            // Tell both sides who is present now.
            this.broadcastPresence(currentClient.spaceId);
            return;
          }

          if (message.type === 'RECORD') {
            if (!currentClient) {
              this.sendJson(ws, { type: 'ERROR', error: 'JOIN before sending records' });
              return;
            }

            if (!consumeToken(currentClient)) {
              this.sendJson(ws, { type: 'ERROR', error: 'Rate limit exceeded, slow down' });
              return;
            }

            const record = message.record as StoredRecord;
            if (!isValidRecord(record)) {
              this.sendJson(ws, { type: 'ERROR', error: 'Invalid record' });
              return;
            }

            // A client may only write into the space it joined.
            if (record.spaceId !== currentClient.spaceId) {
              this.sendJson(ws, { type: 'ERROR', error: 'Record does not belong to joined space' });
              return;
            }

            // Commit ciphertext to storage so a partner who is offline right now
            // still receives it when they next connect. A storage outage must not
            // stop live delivery, so forward either way and tell the sender
            // whether the record actually reached durable storage.
            const persisted = await db.saveRecordDurable(record);

            this.broadcastToSpace(currentClient.spaceId, currentClient.connectionId, {
              type: 'REMOTE_RECORD',
              record
            });

            this.sendJson(ws, {
              type: 'RECORD_ACK',
              recordId: record.id,
              lamportClock: record.lamportClock,
              persisted
            });
            return;
          }

          if (message.type === 'PING') {
            this.sendJson(ws, { type: 'PONG', timestamp: Date.now() });
          }
        } catch (err) {
          console.error('[WebSocket Relay Error]', err);
          this.sendJson(ws, { type: 'ERROR', error: 'Internal relay error' });
        }
      });

      ws.on('close', () => {
        if (currentClient) {
          const { spaceId } = currentClient;
          this.clients.delete(currentClient);
          currentClient = null;
          // The partner should see them leave, not wait for a timeout.
          this.broadcastPresence(spaceId);
        }
      });

      ws.on('error', err => console.error('[WebSocket Relay Socket Error]', err));
    });
  }

  /**
   * Sends the records this client missed while it was disconnected.
   *
   * Phones suspend their browser constantly, so without this a message sent
   * while the partner's screen was off would be lost. The client supplies the
   * highest lamport clock it has already applied.
   */
  private async replayMissedRecords(client: SpaceClient, since: unknown) {
    const sinceLamport = Number.isFinite(Number(since)) ? Number(since) : 0;

    let missed: StoredRecord[];
    try {
      missed = await db.getRecordsForSpace(client.spaceId, sinceLamport);
    } catch (err) {
      console.error('[WebSocket Relay] Replay failed', err);
      return;
    }

    // Replay is filtered by authorship, not by the routing id.
    const batch = missed
      .filter(r => r.authorId !== client.authorRole)
      .slice(0, MAX_REPLAY_RECORDS);

    for (const record of batch) {
      if (client.ws.readyState !== WebSocket.OPEN) return;
      this.sendJson(client.ws, { type: 'REMOTE_RECORD', record });
    }

    this.sendJson(client.ws, { type: 'REPLAY_COMPLETE', count: batch.length });
  }

  /** Fans a record out to every OTHER connection in the space, whatever role it holds. */
  private broadcastToSpace(spaceId: string, senderConnectionId: number, payload: any) {
    const raw = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.spaceId === spaceId && client.connectionId !== senderConnectionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  }

  /**
   * Tells everyone in a space how many OTHER devices are currently present.
   *
   * The header used to show "Live" whenever a client reached the relay, which
   * read as "we are connected to each other" even when the partner had never
   * opened the app. This is the signal that actually answers that question.
   */
  private broadcastPresence(spaceId: string) {
    const inSpace: SpaceClient[] = [];
    for (const c of this.clients) {
      if (c.spaceId === spaceId && c.ws.readyState === WebSocket.OPEN) inSpace.push(c);
    }

    for (const client of inSpace) {
      // Count only the OTHER person, not this person's other devices. Someone
      // signed in on a laptop and a phone would otherwise be told their partner
      // is present while they are sitting alone.
      const partners = inSpace.filter(c => c.authorRole !== client.authorRole).length;
      const ownDevices = inSpace.filter(
        c => c.authorRole === client.authorRole && c.connectionId !== client.connectionId
      ).length;

      this.sendJson(client.ws, {
        type: 'PRESENCE',
        peers: partners,
        ownDevices,
        timestamp: Date.now()
      });
    }
  }

  private sendJson(ws: WebSocket, payload: any) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isValidRecord(r: any): r is StoredRecord {
  return (
    !!r &&
    isNonEmptyString(r.id) &&
    isNonEmptyString(r.spaceId) &&
    isNonEmptyString(r.authorId) &&
    isNonEmptyString(r.type) &&
    isNonEmptyString(r.payload) &&
    isNonEmptyString(r.nonce) &&
    Number.isFinite(Number(r.lamportClock))
  );
}
