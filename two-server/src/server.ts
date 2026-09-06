import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { authRouter } from './routes/auth.js';
import { pairingRouter } from './routes/pairing.js';
import { syncRouter } from './routes/sync.js';
import { WebSocketRelay } from './websocket/relay.js';
import { db } from './db.js';
import { isAuthEnforced } from './auth/verifyJwt.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

// In production, pin this to the deployed origin via CORS_ORIGIN. The default
// stays permissive so local development works with no configuration.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : '*';

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10mb' }));

// Healthcheck & Zero-Knowledge Verification
app.get('/health', (req, res) => {
  res.json({
    status: db.isDurable || db.kind === 'memory' ? 'ok' : 'degraded',
    app: 'Two Zero-Knowledge Relay',
    timestamp: new Date().toISOString(),
    storage: db.kind,
    // durable=false means Postgres is configured but currently unreachable:
    // the relay still forwards messages, but they are buffered in memory.
    durable: db.isDurable,
    pending_writes: db.pendingCount,
    // Content is still encrypted on the device before it reaches this relay, so
    // the relay itself never sees plaintext. But when accounts are enabled the
    // pairing code travels through the server in an invite, so the operator is
    // trusted rather than mathematically excluded. Claiming otherwise would be
    // untrue.
    accounts_enabled: isAuthEnforced,
    encrypted_in_transit_and_at_rest: true,
    privacy_note: isAuthEnforced
      ? 'Records are stored as ciphertext. Pairing invitations pass through this server, so the operator is trusted not to read them.'
      : 'Records are stored as ciphertext and pairing codes never reach this server.'
  });
});

app.use('/auth', authRouter);
app.use('/pairing', pairingRouter);
app.use('/sync', syncRouter);

const server = http.createServer(app);

// WebSocket Relay Server
const wss = new WebSocketServer({ server, path: '/relay' });
new WebSocketRelay(wss);

async function start() {
  try {
    await db.init();
  } catch (err) {
    console.error('[Two Relay Server] Storage initialisation error:', err);
  }

  server.listen(PORT, () => {
    console.log(`[Two Relay Server] listening on port ${PORT} (storage: ${db.kind})`);
    console.log(`[Two Relay Server] WebSocket pipe available at /relay`);
  });
}

start();
