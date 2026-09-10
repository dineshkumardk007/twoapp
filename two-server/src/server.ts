import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { WebSocketRelay } from './websocket/relay.js';
import { db } from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

/**
 * How long the relay keeps a record before deleting it.
 *
 * The relay is not the archive - every device holds its own full copy - but it
 * IS the only way a replaced or wiped device rebuilds its history, because
 * there is no device-to-device transfer. So this is really the answer to "how
 * far back can a new phone catch up", and the cost of a longer window is
 * database size.
 */
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 90);
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

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
    // Pairing codes are typed by the couple and never reach this server, so the
    // keys are derived somewhere the operator cannot see. Records arrive and
    // are stored as ciphertext.
    encrypted_in_transit_and_at_rest: true,
    privacy_note: 'Records are stored as ciphertext and pairing codes never reach this server.'
  });
});

// The relay speaks WebSocket and nothing else.
//
// It used to also expose /auth, /pairing and /sync - leftovers from an account
// system that was removed. No client called them: the web app never did, and
// the only caller was a Kotlin class referenced by no other file. What they did
// do was accept unauthenticated writes. POST /sync/push needed no key, no space
// id and no credential of any kind, skipped the validation and rate limiting
// the socket path applies, and wrote whatever it was given straight to
// Postgres. Removed rather than secured, because nothing needed them.

const server = http.createServer(app);

// WebSocket Relay Server
const wss = new WebSocketServer({ server, path: '/relay' });
new WebSocketRelay(wss);

/**
 * Deletes anything past the retention window.
 *
 * Runs at boot and then daily. On a host that sleeps when idle the interval
 * will not fire on schedule, which is fine: the boot sweep covers it, and a
 * relay that has been asleep has not been accumulating records either.
 */
async function sweepExpiredRecords() {
  try {
    const removed = await db.purgeRecordsOlderThan(RETENTION_DAYS);
    if (removed > 0) {
      console.log(`[Two Relay Server] Retention sweep removed ${removed} record(s) older than ${RETENTION_DAYS} days`);
    }

    // Depth as well as age: a type can outgrow its usefulness long before it
    // is old enough to expire.
    const trimmed = await db.trimCappedTypes();
    if (trimmed > 0) {
      console.log(`[Two Relay Server] Retention sweep trimmed ${trimmed} record(s) past their per-type depth`);
    }
  } catch (err) {
    // Never fatal - failing to trim history must not take the relay down.
    console.error('[Two Relay Server] Retention sweep error:', err);
  }
}

async function start() {
  try {
    await db.init();
  } catch (err) {
    console.error('[Two Relay Server] Storage initialisation error:', err);
  }

  await sweepExpiredRecords();
  const sweepTimer = setInterval(sweepExpiredRecords, SWEEP_INTERVAL_MS);
  // Do not hold the process open for the sake of a cleanup timer.
  sweepTimer.unref();

  server.listen(PORT, () => {
    console.log(`[Two Relay Server] listening on port ${PORT} (storage: ${db.kind})`);
    console.log(`[Two Relay Server] WebSocket pipe available at /relay`);
    console.log(`[Two Relay Server] Retention: ${RETENTION_DAYS} days`);
  });
}

start();
