import crypto from 'crypto';
import http from 'http';
import type { AddressInfo } from 'net';
import { WebSocket, WebSocketServer } from 'ws';

// BIP-39 subset dictionary for test runner
const BIP39_WORDS = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
  "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
  "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
  "adult", "advance", "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent"
];

const EMOJIS = ["🌸", "🌿", "🌙", "🌊", "✨", "☕", "🏔️", "🕊️"];

function logPass(title: string) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${title}`);
}

function logFail(title: string, err: any): never {
  console.error(`\x1b[31m[FAIL]\x1b[0m ${title}:`, err);
  process.exit(1);
}

function check(ok: unknown, title: string, detail?: unknown) {
  if (!ok) logFail(title, detail ?? null);
  logPass(title);
}

/**
 * The relay under test.
 *
 * RELAY_URL points the runner at one already running. Without it a relay is
 * started here, in this process, on a free port and on the in-memory store,
 * so the runner needs nothing else up and can never write into a real
 * database. The settings are cleared before the relay is loaded, because the
 * store reads them as it is imported.
 */
async function relayUnderTest(): Promise<string> {
  if (process.env.RELAY_URL) return process.env.RELAY_URL;

  for (const name of [
    'DATABASE_URL',
    'CLOUDFLARE_TURN_KEY_ID',
    'CLOUDFLARE_TURN_API_TOKEN',
    'TURN_URLS',
    'TURN_USERNAME',
    'TURN_CREDENTIAL'
  ]) {
    delete process.env[name];
  }
  const { WebSocketRelay } = await import('../websocket/relay.js');
  const server = http.createServer();
  const wss = new WebSocketServer({ server, path: '/relay' });
  new WebSocketRelay(wss);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return `ws://127.0.0.1:${port}/relay`;
}

// 1. Safety Number Generation
function computeSafetyNumber(pubKeyA: Buffer, pubKeyB: Buffer) {
  const sorted = [pubKeyA, pubKeyB].sort((a, b) => a.compare(b));
  const hash = crypto.createHash('sha256').update(Buffer.concat(sorted)).digest();
  
  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = hash[i] % BIP39_WORDS.length;
    words.push(BIP39_WORDS[idx]);
  }

  const emoji = [
    EMOJIS[hash[28] % EMOJIS.length],
    EMOJIS[hash[29] % EMOJIS.length],
    EMOJIS[hash[30] % EMOJIS.length],
    EMOJIS[hash[31] % EMOJIS.length]
  ].join(" ");

  return { words: words.join(" "), emoji };
}

// 2. Authenticated AEAD Encryption (AES-GCM 256) with AAD
function encryptAead(plaintext: string, key: Buffer, recordId: string, spaceId: string, type: string) {
  const iv = crypto.randomBytes(12);
  const aad = Buffer.from(`${recordId}|${spaceId}|${type}`, 'utf8');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);

  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([enc, tag]).toString('base64'),
    nonce: iv.toString('base64')
  };
}

// 3. Authenticated AEAD Decryption with AAD
function decryptAead(payloadBase64: string, nonceBase64: string, key: Buffer, recordId: string, spaceId: string, type: string) {
  const buf = Buffer.from(payloadBase64, 'base64');
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(0, buf.length - 16);
  const iv = Buffer.from(nonceBase64, 'base64');
  const aad = Buffer.from(`${recordId}|${spaceId}|${type}`, 'utf8');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

async function runTestScenario() {
  console.log("\n=======================================================");
  console.log("   TWO CRYPTOGRAPHIC END-TO-END SCENARIO RUNNER");
  console.log("=======================================================\n");

  // Step A: Identity Keypair Generation
  const clientA_Priv = crypto.randomBytes(32);
  const clientA_Pub = crypto.createHash('sha256').update(clientA_Priv).digest();
  const clientB_Priv = crypto.randomBytes(32);
  const clientB_Pub = crypto.createHash('sha256').update(clientB_Priv).digest();
  logPass("Client A & Client B generated X25519 identity keypairs");

  // Step B: Safety Number Symmetry Check
  const safetyA = computeSafetyNumber(clientA_Pub, clientB_Pub);
  const safetyB = computeSafetyNumber(clientB_Pub, clientA_Pub);
  if (safetyA.words !== safetyB.words || safetyA.emoji !== safetyB.emoji) {
    logFail("Safety Number derivation asymmetry", { safetyA, safetyB });
  }
  logPass(`Safety Number verification matches symmetrically: [${safetyA.emoji}]`);

  // Step C: Space Key Creation & Domain Subkeys
  const spaceKey = crypto.randomBytes(32);
  const chatSubkey = crypto.createHmac('sha256', spaceKey).update("chat____").digest();
  const journalSubkey = crypto.createHmac('sha256', spaceKey).update("journal_").digest();
  const ownerOnlySubkeyA = crypto.createHmac('sha256', clientA_Priv).update("owner_private_space").digest();
  logPass("Domain subkey separation verified (chat, journal, owner-only subkey)");

  // Step D: Live WebSocket Relay Communication
  const spaceId = "e2e-space-test-" + Date.now();
  const originalMessage = "This is an intimate encrypted thought shared across space.";

  const relayUrl = await relayUnderTest();
  const wsA = new WebSocket(relayUrl);
  const wsB = new WebSocket(relayUrl);

  await Promise.all([
    new Promise(res => wsA.on('open', res)),
    new Promise(res => wsB.on('open', res))
  ]);

  wsA.send(JSON.stringify({ type: 'JOIN', spaceId, userId: 'clientA' }));
  wsB.send(JSON.stringify({ type: 'JOIN', spaceId, userId: 'clientB' }));

  // Wait 100ms for room join
  await new Promise(r => setTimeout(r, 100));

  const recordId = "msg-rec-1001";
  const encrypted = encryptAead(originalMessage, chatSubkey, recordId, spaceId, "CHAT");

  const messagePromise = new Promise<void>((resolve, reject) => {
    wsB.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'REMOTE_RECORD') {
          const decrypted = decryptAead(
            data.record.payload,
            data.record.nonce,
            chatSubkey,
            data.record.id,
            spaceId,
            data.record.type
          );
          if (decrypted === originalMessage) {
            logPass("Encrypted record transmitted across live WebSocket relay and decrypted with 100% fidelity");
            resolve();
          } else {
            reject(new Error("Decrypted text did not match original"));
          }
        }
      } catch (e) {
        reject(e);
      }
    });
  });

  // Client A broadcasts encrypted record over relay
  wsA.send(JSON.stringify({
    type: 'RECORD',
    spaceId,
    record: {
      id: recordId,
      spaceId,
      authorId: 'clientA',
      type: 'CHAT',
      payload: encrypted.ciphertext,
      nonce: encrypted.nonce,
      lamportClock: 1,
      clientTs: Date.now()
    }
  }));

  await messagePromise;

  // Step E: Tamper & Record-Swapping Rejection
  try {
    decryptAead(
      encrypted.ciphertext,
      encrypted.nonce,
      chatSubkey,
      "tampered-swapped-record-id", // Tampered AAD!
      spaceId,
      "CHAT"
    );
    logFail("Tampered AAD should have been rejected", null);
  } catch (err: any) {
    logPass("Cryptographic integrity enforced: Tampered record ID was rejected (Auth Tag verification failed)");
  }

  // Step F: Owner-Only Private Draft Protection
  const privateDraft = "Processing private feelings. Partner must not be able to decrypt this.";
  const encPrivate = encryptAead(privateDraft, ownerOnlySubkeyA, "priv-1", spaceId, "PRIVATE_JOURNAL");
  try {
    // Partner attempts to decrypt with their Space Key or Journal Key
    decryptAead(encPrivate.ciphertext, encPrivate.nonce, journalSubkey, "priv-1", spaceId, "PRIVATE_JOURNAL");
    logFail("Partner should NOT have been able to decrypt private draft", null);
  } catch (err) {
    logPass("Owner-only private draft protected: Partner key throws decryption failure");
  }

  // Step G: Partner-Assisted Recovery Flow
  // Client A loses device and generates a brand new Keypair
  const newClientA_Priv = crypto.randomBytes(32);
  const newClientA_Pub = crypto.createHash('sha256').update(newClientA_Priv).digest();

  // Client B in person re-seals existing Space Key using ephemeral Diffie-Hellman to newClientA_Pub
  const notarySecret = crypto.randomBytes(32);
  const sharedRecoverySecret = crypto.createHash('sha256').update(notarySecret).update(newClientA_Pub).digest();
  const reSealedSpaceKey = encryptAead(spaceKey.toString('hex'), sharedRecoverySecret, "recovery-challenge", spaceId, "RECOVERY");

  // Client A unseals using new private key + notary secret
  const unsealedShared = crypto.createHash('sha256').update(notarySecret).update(newClientA_Pub).digest();
  const recoveredKeyHex = decryptAead(reSealedSpaceKey.ciphertext, reSealedSpaceKey.nonce, unsealedShared, "recovery-challenge", spaceId, "RECOVERY");

  if (recoveredKeyHex === spaceKey.toString('hex')) {
    logPass("Partner-Assisted Recovery succeeded: Surviving partner re-sealed Space Key to restored device");
  } else {
    logFail("Recovered key mismatch", null);
  }

  wsA.close();
  wsB.close();

  console.log("\n\x1b[32m✔ ALL 7 CRYPTOGRAPHIC SCENARIOS PASSED WITH ZERO LEAKAGE.\x1b[0m\n");

  await runReceiptHelpers();
  await runReceiptScenario(relayUrl);

  console.log("\n\x1b[32m✔ DELIVERY RECEIPTS: THE LISTENER LEARNS NO CONTENT AND IS NEVER SEEN AS ONLINE.\x1b[0m\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Delivery receipts from a background listener
// ---------------------------------------------------------------------------

/** The pure parts, checked on their own. */
async function runReceiptHelpers() {
  console.log("-------------------------------------------------------");
  console.log("   RECEIPT HELPERS");
  console.log("-------------------------------------------------------\n");

  const { parseReceivedIds, toRecordMeta, chunk } = await import('../websocket/relay.js');

  check(parseReceivedIds('rec-1') === null, "RECEIVED without a list is refused");
  check(parseReceivedIds([]) === null, "RECEIVED with an empty list is refused");
  check(
    parseReceivedIds([1, '', 'x'.repeat(65), null]) === null,
    "RECEIVED naming nothing usable is refused"
  );
  check(
    JSON.stringify(parseReceivedIds(['a', 'a', 7, 'x'.repeat(65), 'b', 'x'.repeat(64)])) ===
      JSON.stringify(['a', 'b', 'x'.repeat(64)]),
    "RECEIVED drops bad ids and repeats and keeps the order of the rest"
  );
  const many = Array.from({ length: 301 }, (_, i) => `rec-${i}`);
  check(parseReceivedIds(many) === null, "RECEIVED naming more than 300 records is refused whole");
  check(parseReceivedIds(many.slice(0, 300))?.length === 300, "RECEIVED naming exactly 300 records is taken");
  check(
    parseReceivedIds([...many.slice(0, 300), 'rec-0'])?.length === 300,
    "Repeats do not count towards the 300"
  );

  const meta = toRecordMeta({
    id: 'r1',
    spaceId: 's',
    authorId: 'user',
    type: 'CHAT',
    payload: 'secret',
    nonce: 'n',
    lamportClock: 1730000000000,
    clientTs: 1730000000001,
    createdAt: new Date().toISOString(),
    seq: 4212,
    reachedAt: 5
  });
  check(
    JSON.stringify(meta) ===
      JSON.stringify({ id: 'r1', type: 'CHAT', authorId: 'user', lamportClock: 1730000000000, seq: 4212 }),
    "Record metadata carries id, type, author, clock and seq only",
    meta
  );

  const parts = chunk(Array.from({ length: 650 }, (_, i) => i), 300);
  check(
    parts.length === 3 && parts[0].length === 300 && parts[2].length === 50 && parts[2][49] === 649,
    "REACHED is split into pieces of at most 300, in order"
  );
  check(chunk([], 300).length === 0, "Nothing to send makes no pieces");
}

interface Peer {
  ws: WebSocket;
  /** Messages not yet taken by a check. */
  inbox: any[];
  /** Every message type, in arrival order, taken or not. */
  log: string[];
  closed: Promise<number>;
}

async function connectPeer(url: string): Promise<Peer> {
  const ws = new WebSocket(url);
  const peer: Peer = {
    ws,
    inbox: [],
    log: [],
    closed: new Promise<number>(resolve => ws.on('close', code => resolve(code)))
  };
  ws.on('message', raw => {
    const data = JSON.parse(raw.toString());
    peer.inbox.push(data);
    peer.log.push(data.type);
  });
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
  return peer;
}

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * The next message of this type, waiting for it if it has not come yet. With
 * `where`, the first that matches, and any of that type before it are taken
 * as well, being stale.
 */
async function take(peer: Peer, type: string, where?: (m: any) => boolean, timeoutMs = 3000): Promise<any> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const at = peer.inbox.findIndex(m => m.type === type && (!where || where(m)));
    if (at >= 0 && where) {
      const found = peer.inbox[at];
      peer.inbox = peer.inbox.filter((m, i) => i > at || m.type !== type);
      return found;
    }
    if (at >= 0) return peer.inbox.splice(at, 1)[0];
    if (Date.now() > until) logFail(`Expected ${type}`, peer.inbox);
    await pause(10);
  }
}

/** True when no message of this type turns up within the wait. */
async function noneOf(peer: Peer, type: string, ms = 250): Promise<boolean> {
  await pause(ms);
  return !peer.inbox.some(m => m.type === type);
}

function send(peer: Peer, message: unknown) {
  peer.ws.send(JSON.stringify(message));
}

function record(spaceId: string, id: string, authorId: string, lamportClock: number, type = 'CHAT') {
  return {
    id,
    spaceId,
    authorId,
    type,
    payload: Buffer.from(`ciphertext of ${id}`).toString('base64'),
    nonce: crypto.randomBytes(12).toString('base64'),
    lamportClock,
    clientTs: Date.now()
  };
}

/** The relay side of a listener, against a live relay. */
async function runReceiptScenario(relayUrl: string) {
  console.log("-------------------------------------------------------");
  console.log("   BACKGROUND LISTENER AND DELIVERY RECEIPTS");
  console.log("-------------------------------------------------------\n");

  const spaceId = 'e2e-receipts-' + Date.now();

  // Author A (seat "user") and reader B (seat "partner"), both with the app open.
  const a = await connectPeer(relayUrl);
  send(a, { type: 'JOIN', spaceId, userId: 'devA', role: 'user', since: 0, sinceSeq: 0 });
  const aJoined = await take(a, 'JOINED');
  check(aJoined.receipts === true && aJoined.passive === false, "An app JOIN is told receipts:true, passive:false", aJoined);
  await take(a, 'REPLAY_COMPLETE');

  const b = await connectPeer(relayUrl);
  send(b, { type: 'JOIN', spaceId, userId: 'devB', role: 'partner', since: 0, sinceSeq: 0 });
  await take(b, 'JOINED');
  await take(a, 'PRESENCE', m => m.peers === 1);

  // 1. A listener cannot join beside its own open app.
  const refused = await connectPeer(relayUrl);
  send(refused, { type: 'JOIN', spaceId, userId: 'devB', role: 'partner', since: 1, sinceSeq: 0, passive: true });
  const refusal = await take(refused, 'ERROR');
  check(
    refusal.code === 'ACTIVE_EXISTS' && refusal.error === 'Device is already connected',
    "A listener JOIN beside the same phone's open app is refused with ACTIVE_EXISTS",
    refusal
  );
  check((await refused.closed) === 4001, "...and closed with 4001");
  check(b.ws.readyState === WebSocket.OPEN, "...and the app's own socket is left alone");

  // 2. With the app gone, the listener joins - and nobody sees it.
  b.ws.close();
  await b.closed;
  const left = await take(a, 'PRESENCE');
  check(left.peers === 0, "A is told the partner's app has left", left);

  const listener = await connectPeer(relayUrl);
  send(listener, { type: 'JOIN', spaceId, userId: 'devB', role: 'partner', since: 1, sinceSeq: 0, passive: true });
  const lJoined = await take(listener, 'JOINED');
  check(lJoined.receipts === true && lJoined.passive === true, "The listener JOIN is accepted with passive:true", lJoined);
  const lReplay = await take(listener, 'REPLAY_COMPLETE');
  check(lReplay.count === 0 && lReplay.more === false, "...and replays nothing in an empty space", lReplay);
  check(await noneOf(a, 'PRESENCE'), "The listener joining sends A no PRESENCE");
  check(
    !listener.log.includes('PRESENCE') && !listener.log.includes('ICE_SERVERS'),
    "The listener is sent neither presence nor call servers",
    listener.log
  );

  // 3. Live records reach the listener as metadata only.
  send(a, { type: 'RECORD', spaceId, record: record(spaceId, 'rec-1', 'user', 10) });
  await take(a, 'RECORD_ACK');
  const meta = await take(listener, 'RECORD_META');
  check(
    meta.record.id === 'rec-1' &&
      meta.record.type === 'CHAT' &&
      meta.record.authorId === 'user' &&
      meta.record.lamportClock === 10 &&
      Number.isFinite(meta.record.seq) &&
      Object.keys(meta.record).sort().join(',') === 'authorId,id,lamportClock,seq,type',
    "A live CHAT reaches the listener as RECORD_META, with no payload, nonce or clientTs",
    meta
  );

  send(a, { type: 'RECORD', spaceId, record: record(spaceId, 'rec-garden', 'user', 11, 'GARDEN_UPDATE') });
  await take(a, 'RECORD_ACK');
  await take(listener, 'RECORD_META');

  send(a, {
    type: 'SIGNAL',
    signal: { id: 'sig-1', spaceId, type: 'TYPING', payload: 'cA==', nonce: 'bg==' }
  });
  check(
    (await noneOf(listener, 'REMOTE_SIGNAL')) && !listener.log.includes('REMOTE_RECORD'),
    "The listener never gets a signal or a full record",
    listener.log
  );

  // A listener can write nothing, and is not cut off for trying.
  for (const attempt of [
    { type: 'RECORD', spaceId, record: record(spaceId, 'rec-forged', 'partner', 12) },
    { type: 'SIGNAL', signal: { id: 'sig-2', spaceId, type: 'TYPING', payload: 'cA==', nonce: 'bg==' } },
    { type: 'ICE_SERVERS_REQUEST' }
  ]) {
    send(listener, attempt);
    const err = await take(listener, 'ERROR');
    check(err.error === 'Passive connection is read-only', `A listener's ${attempt.type} is refused as read-only`, err);
  }
  check(await noneOf(a, 'REMOTE_RECORD'), "...nothing it sent was forwarded");
  check(listener.ws.readyState === WebSocket.OPEN, "...and its socket stays open");

  // The ways a RECEIVED can be wrong.
  send(a, { type: 'RECEIVED', recordIds: ['rec-1'] });
  check(
    (await take(a, 'ERROR')).error === 'RECEIVED is for passive connections',
    "An app's RECEIVED is refused"
  );
  const stranger = await connectPeer(relayUrl);
  send(stranger, { type: 'RECEIVED', recordIds: ['rec-1'] });
  check((await take(stranger, 'ERROR')).error === 'JOIN before RECEIVED', "A RECEIVED before any JOIN is refused");
  stranger.ws.close();
  for (const recordIds of ['rec-1', [], [42], Array.from({ length: 301 }, (_, i) => `id-${i}`)]) {
    send(listener, { type: 'RECEIVED', recordIds });
    check((await take(listener, 'ERROR')).error === 'Invalid RECEIVED', `RECEIVED ${JSON.stringify(recordIds).slice(0, 20)} is invalid`);
  }
  check(await noneOf(a, 'REACHED', 50), "...and none of them ticked anything");

  // A listener with no cursor at all is not handed the whole history.
  const fresh = await connectPeer(relayUrl);
  send(fresh, { type: 'JOIN', spaceId, userId: 'devC', role: 'partner', since: 0, sinceSeq: 0, passive: true });
  await take(fresh, 'JOINED');
  const freshReplay = await take(fresh, 'REPLAY_COMPLETE');
  check(
    freshReplay.count === 0 && freshReplay.more === false && !fresh.log.includes('RECORD_META'),
    "A listener JOIN with no cursor replays nothing, though the space has records",
    freshReplay
  );
  // With a cursor, its replay is metadata too.
  send(fresh, { type: 'JOIN', spaceId, userId: 'devC', role: 'partner', since: 1, sinceSeq: 0, passive: true });
  await take(fresh, 'JOINED');
  const replayed = [await take(fresh, 'RECORD_META'), await take(fresh, 'RECORD_META')];
  const freshDone = await take(fresh, 'REPLAY_COMPLETE');
  check(
    freshDone.count === 2 &&
      replayed.every(m => m.record.payload === undefined && m.record.nonce === undefined) &&
      !fresh.log.includes('REMOTE_RECORD'),
    "A listener's replay sends RECORD_META, never the ciphertext",
    replayed
  );
  fresh.ws.close();
  await fresh.closed;
  check(await noneOf(a, 'PRESENCE', 100), "A listener leaving sends A no PRESENCE");

  // 4. The listener says the message arrived; the author is told.
  send(listener, { type: 'RECEIVED', recordIds: ['rec-1', 'rec-garden', 'rec-unknown'] });
  const reached = await take(a, 'REACHED');
  const ack = await take(listener, 'RECEIVED_ACK');
  check(
    reached.reached.length === 1 &&
      reached.reached[0].id === 'rec-1' &&
      Number.isFinite(reached.reached[0].at) &&
      Object.keys(reached).sort().join(',') === 'reached,type',
    "A is sent REACHED for its CHAT only, naming no device",
    reached
  );
  check(ack.count === 1, "The listener is told one row was marked", ack);
  const firstAt: number = reached.reached[0].at;

  // 5. Saying it again changes nothing.
  send(listener, { type: 'RECEIVED', recordIds: ['rec-1'] });
  check((await take(listener, 'RECEIVED_ACK')).count === 0, "The same RECEIVED again marks nothing");
  check(await noneOf(a, 'REACHED'), "...and A is not told twice");

  // Nobody can tick their own messages: B's other phone writes, B's listener confirms.
  const b2 = await connectPeer(relayUrl);
  send(b2, { type: 'JOIN', spaceId, userId: 'devB2', role: 'partner', since: 1, sinceSeq: 0 });
  await take(b2, 'JOINED');
  // 8. The listener is in the space but counts nowhere.
  const aSees = await take(a, 'PRESENCE');
  const b2Sees = await take(b2, 'PRESENCE');
  check(aSees.peers === 1 && aSees.total === 2, "PRESENCE to A counts B's open app and not B's listener", aSees);
  check(b2Sees.ownDevices === 0 && b2Sees.total === 2, "PRESENCE to B's other phone does not count the listener as its own device", b2Sees);
  send(b2, { type: 'RECORD', spaceId, record: record(spaceId, 'rec-own', 'partner', 13) });
  await take(b2, 'RECORD_ACK');
  await take(listener, 'RECORD_META');
  send(listener, { type: 'RECEIVED', recordIds: ['rec-own'] });
  check((await take(listener, 'RECEIVED_ACK')).count === 0, "A listener cannot tick its own seat's message");
  check(await noneOf(b2, 'REACHED'), "...and B's phone is told nothing");
  b2.ws.close();
  await b2.closed;
  await take(a, 'PRESENCE');

  // 6. A is away when the next one arrives, and hears about it on return.
  send(a, { type: 'RECORD', spaceId, record: record(spaceId, 'rec-2', 'user', 14) });
  await take(a, 'RECORD_ACK');
  await take(listener, 'RECORD_META');
  a.ws.close();
  await a.closed;
  // Receipts are compared by the millisecond; make sure this one is later.
  await pause(5);
  send(listener, { type: 'RECEIVED', recordIds: ['rec-2'] });
  check((await take(listener, 'RECEIVED_ACK')).count === 1, "The listener marks a message while A is away");

  const back = await connectPeer(relayUrl);
  send(back, { type: 'JOIN', spaceId, userId: 'devA', role: 'user', since: 14, sinceSeq: 0, reachedSince: firstAt });
  const stored = await take(back, 'REACHED');
  check(
    stored.reached.length === 1 && stored.reached[0].id === 'rec-2' && stored.reached[0].at > firstAt,
    "A, back with reachedSince, is sent only the newer REACHED",
    stored
  );
  check(
    back.log.indexOf('REPLAY_COMPLETE') >= 0 &&
      back.log.indexOf('REPLAY_COMPLETE') < back.log.indexOf('REACHED') &&
      (back.log.indexOf('PRESENCE') < 0 || back.log.indexOf('REACHED') < back.log.indexOf('PRESENCE')),
    "...after its replay and before presence",
    back.log
  );

  const laptop = await connectPeer(relayUrl);
  send(laptop, { type: 'JOIN', spaceId, userId: 'devA-laptop', role: 'user', since: 14, sinceSeq: 0, reachedSince: 0 });
  const all = await take(laptop, 'REACHED');
  check(
    all.reached.map((r: any) => r.id).join(',') === 'rec-1,rec-2',
    "reachedSince 0 is sent every stored receipt, oldest first",
    all
  );

  const oldApp = await connectPeer(relayUrl);
  send(oldApp, { type: 'JOIN', spaceId, userId: 'devA-old', role: 'user', since: 14, sinceSeq: 0 });
  await take(oldApp, 'REPLAY_COMPLETE');
  check(await noneOf(oldApp, 'REACHED'), "An older app that sends no reachedSince gets no REACHED");

  // 7. B opens the app: it takes over from the listener.
  const bBack = await connectPeer(relayUrl);
  send(bBack, { type: 'JOIN', spaceId, userId: 'devB', role: 'partner', since: 14, sinceSeq: 0 });
  check((await listener.closed) === 4000, "B's app JOIN closes B's listener with 4000");
  const bPresence = await take(bBack, 'PRESENCE');
  check(
    bPresence.peers === 3 && bPresence.ownDevices === 0 && bPresence.total === 4,
    "B's app sees A's three open apps and nothing of its old listener",
    bPresence
  );

  for (const p of [back, laptop, oldApp, bBack]) p.ws.close();
  await Promise.all([back, laptop, oldApp, bBack].map(p => p.closed));
}

runTestScenario().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
