// WebSocket Client Relay connection for real-time multi-window E2EE synchronization

type MessageCallback = (data: any) => void;

class WebSocketRelayClient {
  private ws: WebSocket | null = null;
  private spaceId: string = 'default-space-id';
  private userId: string = 'user';
  private listeners: Set<MessageCallback> = new Set();
  private isConnecting: boolean = false;

  connect(spaceId: string, userId: string) {
    this.spaceId = spaceId;
    this.userId = userId;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.isConnecting = true;
      this.ws = new WebSocket('ws://localhost:4000/relay');

      this.ws.onopen = () => {
        this.isConnecting = false;
        // Join space room
        this.send({
          type: 'JOIN',
          spaceId: this.spaceId,
          userId: this.userId
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.listeners.forEach(cb => cb(payload));
        } catch (e) {
          console.error('[WS Parse Error]', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        // Auto-reconnect after 3s
        setTimeout(() => this.connect(this.spaceId, this.userId), 3000);
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
      };
    } catch (e) {
      this.isConnecting = false;
    }
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  broadcastUpdate(type: string, data: any) {
    this.send({
      type: 'RECORD',
      spaceId: this.spaceId,
      record: {
        id: Date.now().toString(),
        spaceId: this.spaceId,
        authorId: this.userId,
        type,
        payload: JSON.stringify(data),
        nonce: '',
        lamportClock: Date.now(),
        clientTs: Date.now(),
        createdAt: new Date().toISOString()
      }
    });
  }

  subscribe(callback: MessageCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const wsRelay = new WebSocketRelayClient();
