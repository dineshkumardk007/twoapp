import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { authRouter } from './routes/auth.js';
import { pairingRouter } from './routes/pairing.js';
import { syncRouter } from './routes/sync.js';
import { WebSocketRelay } from './websocket/relay.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Healthcheck & Zero-Knowledge Verification
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Two Zero-Knowledge Relay',
    timestamp: new Date().toISOString(),
    zero_knowledge: true,
    privacy_guarantee: 'The operator cannot read couple content by design.'
  });
});

app.use('/auth', authRouter);
app.use('/pairing', pairingRouter);
app.use('/sync', syncRouter);

const server = http.createServer(app);

// WebSocket Relay Server
const wss = new WebSocketServer({ server, path: '/relay' });
new WebSocketRelay(wss);

server.listen(PORT, () => {
  console.log(`[Two Relay Server] running at http://localhost:${PORT}`);
  console.log(`[Two Relay Server] WebSocket pipe available at ws://localhost:${PORT}/relay`);
});
