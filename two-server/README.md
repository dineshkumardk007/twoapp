# Two — Zero-Knowledge Backend Relay Server

The zero-knowledge relay server for **Two**, built in Node.js, Express, TypeScript, PostgreSQL (Prisma), and WebSockets.

---

## Architectural Guarantees

1. **Total Operator Blindness:** The server stores and relays only ciphertext payloads, random UUIDs, blinded timestamps, and public keys.
2. **No Presence / Typing Tracking:** The WebSocket pipe relays discrete encrypted records only, without streaming keystrokes, online indicators, or read receipts.
3. **Data-Only Push Readiness:** Designed to trigger silent data-only wake-up pings to Android clients.

---

## Running the Server

```bash
cd two-server
npm install
npm run dev
```

The server will listen on port `4000`, providing:
* REST API: `http://localhost:4000`
* WebSocket Relay Pipe: `ws://localhost:4000/relay`
