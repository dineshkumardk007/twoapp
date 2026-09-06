import { WebSocket, WebSocketServer } from 'ws';
import { db, StoredRecord } from '../db.js';

interface SpaceClient {
  ws: WebSocket;
  userId: string;
  spaceId: string;
}

// A single record is a chat line, a mood, or a canvas stroke - never media.
const MAX_RECORD_BYTES = 256 * 1024;

// Cap on how much history one JOIN may replay, so a long-dormant device cannot
// pull an unbounded backlog in a single burst.
const MAX_REPLAY_RECORDS = 500;

export class WebSocketRelay {
  private wss: WebSocketServer;
  private clients = new Set<SpaceClient>();

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.setupServer();
  }

  private setupServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      let currentClient: SpaceClient | null = null;

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

            currentClient = { ws, userId: message.userId, spaceId: message.spaceId };
            this.clients.add(currentClient);

            this.sendJson(ws, {
              type: 'JOINED',
              spaceId: message.spaceId,
              timestamp: Date.now()
            });

            await this.replayMissedRecords(currentClient, message.since);
            return;
          }

          if (message.type === 'RECORD') {
            if (!currentClient) {
              this.sendJson(ws, { type: 'ERROR', error: 'JOIN before sending records' });
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
            // still receives it when they next connect.
            await db.saveRecord(record);

            this.broadcastToSpace(currentClient.spaceId, currentClient.userId, {
              type: 'REMOTE_RECORD',
              record
            });

            this.sendJson(ws, {
              type: 'RECORD_ACK',
              recordId: record.id,
              lamportClock: record.lamportClock
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
          this.clients.delete(currentClient);
          currentClient = null;
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

    const batch = missed
      .filter(r => r.authorId !== client.userId)
      .slice(0, MAX_REPLAY_RECORDS);

    for (const record of batch) {
      if (client.ws.readyState !== WebSocket.OPEN) return;
      this.sendJson(client.ws, { type: 'REMOTE_RECORD', record });
    }

    this.sendJson(client.ws, { type: 'REPLAY_COMPLETE', count: batch.length });
  }

  private broadcastToSpace(spaceId: string, senderUserId: string, payload: any) {
    const raw = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.spaceId === spaceId && client.userId !== senderUserId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
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
