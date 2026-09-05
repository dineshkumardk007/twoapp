import { WebSocket, WebSocketServer } from 'ws';
import { db, StoredRecord } from '../db.js';

interface SpaceClient {
  ws: WebSocket;
  userId: string;
  spaceId: string;
}

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

      ws.on('message', async (data: string) => {
        try {
          const message = JSON.parse(data.toString());

          // Protocol:
          // 1. JOIN: { type: 'JOIN', spaceId: string, userId: string }
          // 2. ENCRYPTED_RECORD: { type: 'RECORD', spaceId: string, record: StoredRecord }
          // 3. HEARTBEAT: { type: 'PING' }

          if (message.type === 'JOIN') {
            currentClient = { ws, userId: message.userId, spaceId: message.spaceId };
            this.clients.add(currentClient);

            ws.send(JSON.stringify({
              type: 'JOINED',
              spaceId: message.spaceId,
              timestamp: Date.now()
            }));
            return;
          }

          if (message.type === 'RECORD' && currentClient) {
            const record: StoredRecord = message.record;

            // Commit ciphertext to database
            await db.saveRecord(record);

            // Forward ciphertext to other space members
            this.broadcastToSpace(currentClient.spaceId, currentClient.userId, {
              type: 'REMOTE_RECORD',
              record
            });

            // ACK to sender
            ws.send(JSON.stringify({
              type: 'RECORD_ACK',
              recordId: record.id,
              lamportClock: record.lamportClock
            }));
          }

          if (message.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        } catch (err) {
          console.error('[WebSocket Relay Error]', err);
        }
      });

      ws.on('close', () => {
        if (currentClient) {
          this.clients.delete(currentClient);
        }
      });
    });
  }

  private broadcastToSpace(spaceId: string, senderUserId: string, payload: any) {
    const raw = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.spaceId === spaceId && client.userId !== senderUserId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  }
}
