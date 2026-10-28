import { WebSocket, WebSocketServer } from 'ws';
import { db, StoredRecord } from '../db.js';
import { getIceServers, turnConfigured } from '../turn.js';

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
  /**
   * A background listener rather than the app itself.
   *
   * The phone keeps one of these open while Two is closed or locked, so the
   * partner can be told a message reached it. It holds no key, so it is sent
   * only the metadata of a record - never the ciphertext - and it can write
   * nothing. It is not a presence either: being "online" means the app is
   * open, and a listener in a pocket is not that.
   */
  passive: boolean;
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

/**
 * The biggest single message the relay will take.
 *
 * Most records are a chat line or a canvas stroke and nowhere near this. The
 * ceiling exists so one client cannot hand the relay something enormous, and
 * it used to be 256 KB - under which a photo in a memory or a voice memo of
 * any length did not fit. Worse, the record was refused with an error the app
 * ignored, so it simply never arrived and nothing said so.
 *
 * A megabyte holds a photo or a few minutes of voice, while still being a
 * bound. The app refuses anything larger before sending, and says why.
 */
const MAX_RECORD_BYTES = 1024 * 1024;

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
const MAX_CLIENTS_PER_SPACE = 24; // ten members, two devices each, spare reconnects

/**
 * How often to check that a socket is still attached to a living device.
 *
 * A socket was only ever removed when it closed cleanly. A phone that loses
 * signal, gets killed by the system, or goes into a tunnel sends no close
 * frame, so its entry sat in the table indefinitely while the device
 * reconnected alongside it. The presence count is taken from that table, which
 * is why a couple with two phones could be told four devices were in their
 * space: two of them were ghosts of themselves.
 */
const LIVENESS_INTERVAL_MS = 30_000;

// Delivery receipts from a background listener. One RECEIVED names at most
// this many records, and a REACHED is sent in pieces no bigger, so neither
// side ever handles an unbounded message.
const MAX_RECEIVED_IDS = 300;
const REACHED_CHUNK = 300;
// How many stored receipts one JOIN may be told about. A phone that has been
// off for a long while catches up on the newest; older ticks arrive anyway
// when the partner next opens Two and confirms delivery the usual way.
const MAX_REACHED_REPLAY = 2000;

export class WebSocketRelay {
  private wss: WebSocketServer;
  private clients = new Set<SpaceClient>();
  private nextConnectionId = 1;

  /** Always answers, with null when there is nothing to give, so no phone waits out its timeout. */
  private async sendIceServers(ws: WebSocket) {
    const set = await getIceServers();
    this.sendJson(ws, {
      type: 'ICE_SERVERS',
      iceServers: set?.iceServers ?? null,
      expiresAt: set?.expiresAt ?? null
    });
  }

  /** Tells every connected phone when durability comes or goes. */
  private announceDurability = (durable: boolean) => {
    for (const client of this.clients) {
      // A listener cannot show it to anybody.
      if (client.passive) continue;
      this.sendJson(client.ws, { type: 'RELAY_STATUS', durable, storage: db.kind });
    }
  };

  constructor(wss: WebSocketServer) {
    db.onHealthChange(this.announceDurability);
    this.wss = wss;
    this.setupServer();
    this.startLivenessChecks();
  }

  /**
   * Drops sockets whose device has gone without saying so.
   *
   * Protocol-level ping, not the JSON PING the app sends: this one is answered
   * by the socket itself, so it detects a device that has stopped existing
   * rather than one that has merely stopped talking. A socket that misses a
   * round is terminated, which fires its close handler and corrects the
   * presence count for everyone still there.
   */
  private startLivenessChecks() {
    const timer = setInterval(() => {
      for (const socket of this.wss.clients) {
        const tracked = socket as WebSocket & { isAlive?: boolean };
        if (tracked.isAlive === false) {
          tracked.terminate();
          continue;
        }
        tracked.isAlive = false;
        try {
          tracked.ping();
        } catch {
          tracked.terminate();
        }
      }
    }, LIVENESS_INTERVAL_MS);

    // A housekeeping timer should never be the reason the process stays up.
    timer.unref?.();
  }

  private setupServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      let currentClient: SpaceClient | null = null;
      const connectionId = this.nextConnectionId++;

      const tracked = ws as WebSocket & { isAlive?: boolean };
      tracked.isAlive = true;
      ws.on('pong', () => {
        tracked.isAlive = true;
      });

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
          // 1. JOIN: { type, spaceId, userId, role?, since?, sinceSeq?, passive?, reachedSince? }
          // 2. RECORD: { type, spaceId, record }
          // 3. REPLAY_MORE: { type, since?, sinceSeq? }
          // 4. PING: { type }
          // 5. RECEIVED: { type, recordIds } - background listeners only
          // Anything else is ignored, so an older phone and a newer relay
          // still get on.

          if (message.type === 'JOIN') {
            if (!isNonEmptyString(message.spaceId) || !isNonEmptyString(message.userId)) {
              this.sendJson(ws, { type: 'ERROR', error: 'JOIN requires spaceId and userId' });
              return;
            }

            // Only exactly true. Every phone before this one sends nothing
            // here and must go on being treated as the app.
            const passive = message.passive === true;

            // A listener steps aside for the app, never the other way round.
            // The app's own JOIN below closes a listener of the same device;
            // if a listener could do the same to the app, a phone that had
            // both up for a moment would have them evict each other forever.
            if (passive) {
              for (const existing of this.clients) {
                if (
                  existing.spaceId === message.spaceId &&
                  existing.userId === message.userId &&
                  existing.ws !== ws &&
                  !existing.passive &&
                  existing.ws.readyState === WebSocket.OPEN
                ) {
                  this.sendJson(ws, { type: 'ERROR', error: 'Device is already connected', code: 'ACTIVE_EXISTS' });
                  try {
                    ws.close(4001, 'Device is already connected');
                  } catch {
                    /* already gone */
                  }
                  return;
                }
              }
            }

            // Re-joining on the same socket replaces the previous membership.
            if (currentClient) this.clients.delete(currentClient);

            // And a device that reconnects replaces its OWN earlier socket
            // rather than sitting beside it. Without this, every reconnect
            // before the liveness check catches up shows as another device in
            // the space - and the alert about unrecognised devices fires at the
            // couple's own phones.
            for (const existing of this.clients) {
              if (
                existing.spaceId === message.spaceId &&
                existing.userId === message.userId &&
                existing.ws !== ws
              ) {
                this.clients.delete(existing);
                try {
                  existing.ws.close(4000, 'Replaced by a newer connection from the same device');
                } catch {
                  /* already gone */
                }
              }
            }

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
              passive,
              tokens: RECORD_BURST,
              lastRefill: Date.now()
            };
            this.clients.add(currentClient);

            this.sendJson(ws, {
              type: 'JOINED',
              spaceId: message.spaceId,
              timestamp: Date.now(),
              // So a phone can say whether what it sends is being kept.
              durable: db.isDurable,
              storage: db.kind,
              // So a phone knows it can leave a listener here, and that a
              // REACHED may come.
              receipts: true,
              passive
            });

            if (passive) {
              // No call servers and no presence: a listener makes no calls,
              // and its partner must not see it as being here.
              await this.replayMissedRecords(currentClient, message.since, message.sinceSeq);
              return;
            }

            // Handed over now so a call made later does not wait for them.
            // Not awaited: a slow answer from Cloudflare must not hold up the
            // history this phone is about to be sent.
            if (turnConfigured) void this.sendIceServers(ws);

            await this.replayMissedRecords(currentClient, message.since, message.sinceSeq);

            // Ticks the partner's listener gave while this phone was away.
            // Absent from every older phone, which then gets nothing new.
            const reachedSince = message.reachedSince;
            if (reachedSince !== undefined && reachedSince !== null && Number.isFinite(Number(reachedSince))) {
              // A whole number in range, because the column is a bigint: a
              // fraction or 1e300 would fail the query, and a failed query
              // puts the whole relay into degraded mode.
              const since = Math.min(Math.max(0, Math.floor(Number(reachedSince))), Number.MAX_SAFE_INTEGER);
              await this.replayReached(currentClient, since);
            }

            // Tell both sides who is present now.
            this.broadcastPresence(currentClient.spaceId);
            return;
          }

          /**
           * A listener saying "these records are on this phone now".
           *
           * It cannot read them, so this says nothing about what they hold,
           * only that they arrived. The relay notes each one once and tells
           * the author, whose phone shows two grey ticks. Read, the blue
           * tick, stays between the two apps and is never decided here.
           */
          if (message.type === 'RECEIVED') {
            if (!currentClient) {
              this.sendJson(ws, { type: 'ERROR', error: 'JOIN before RECEIVED' });
              return;
            }
            if (!currentClient.passive) {
              // The app confirms delivery itself, end to end, as it always has.
              this.sendJson(ws, { type: 'ERROR', error: 'RECEIVED is for passive connections' });
              return;
            }
            if (!consumeToken(currentClient)) {
              this.sendJson(ws, { type: 'ERROR', error: 'Rate limit exceeded, slow down' });
              return;
            }

            const ids = parseReceivedIds(message.recordIds);
            if (!ids) {
              this.sendJson(ws, { type: 'ERROR', error: 'Invalid RECEIVED' });
              return;
            }

            // Held before the await: the socket can close meanwhile, and the
            // author should still be told.
            const reader = currentClient;
            const at = Date.now();
            const marked = await db.markReached(reader.spaceId, ids, reader.authorRole, at);
            this.announceReached(reader.spaceId, marked, at);
            this.sendJson(ws, { type: 'RECEIVED_ACK', count: marked.length });
            return;
          }

          /**
           * Fresh call relay logins, asked for as a call starts or is answered.
           *
           * Only for a phone that has joined a space: the logins let whoever
           * holds them send traffic through a relay this server pays for.
           */
          if (message.type === 'ICE_SERVERS_REQUEST') {
            if (!currentClient) {
              this.sendJson(ws, { type: 'ERROR', error: 'JOIN before asking for call servers' });
              return;
            }
            if (currentClient.passive) {
              this.sendJson(ws, { type: 'ERROR', error: 'Passive connection is read-only' });
              return;
            }
            if (!consumeToken(currentClient)) {
              this.sendJson(ws, { type: 'ERROR', error: 'Rate limit exceeded, slow down' });
              return;
            }
            await this.sendIceServers(ws);
            return;
          }

          /**
           * The next page of history, for a reader still catching up.
           *
           * Deliberately not a second JOIN, which would work - the handler
           * above replaces a membership on the same socket - but would also
           * re-announce presence to everybody and re-run the capacity checks,
           * none of which has anything to do with reading further back.
           */
          if (message.type === 'REPLAY_MORE') {
            if (!currentClient) {
              this.sendJson(ws, { type: 'ERROR', error: 'REPLAY_MORE requires a JOIN first' });
              return;
            }
            await this.replayMissedRecords(currentClient, message.since, message.sinceSeq);
            return;
          }

          /**
           * A signal: relayed live to the space, never written down.
           *
           * "Typing…" is worthless a second after it is sent, and every other
           * message here is persisted and replayed - so sending typing as a
           * record would have written a row per keystroke burst, replayed
           * stale ones to a device that had been away, and let a two-minute
           * conversation outweigh a year of letters in the record store.
           *
           * The payload is ciphertext exactly like a record's; the relay
           * forwards it without being able to read it, and forgets it the
           * instant it has.
           */
          if (message.type === 'SIGNAL') {
            if (!currentClient) {
              this.sendJson(ws, { type: 'ERROR', error: 'JOIN before sending signals' });
              return;
            }
            if (currentClient.passive) {
              this.sendJson(ws, { type: 'ERROR', error: 'Passive connection is read-only' });
              return;
            }

            if (!consumeToken(currentClient)) {
              this.sendJson(ws, { type: 'ERROR', error: 'Rate limit exceeded, slow down' });
              return;
            }

            const signal = message.signal as any;
            if (
              !signal ||
              !isNonEmptyString(signal.id) ||
              !isNonEmptyString(signal.type) ||
              !isNonEmptyString(signal.payload) ||
              !isNonEmptyString(signal.nonce) ||
              signal.spaceId !== currentClient.spaceId
            ) {
              this.sendJson(ws, { type: 'ERROR', error: 'Invalid signal' });
              return;
            }

            this.broadcastToSpace(currentClient.spaceId, currentClient.connectionId, {
              type: 'REMOTE_SIGNAL',
              signal: { ...signal, authorId: currentClient.authorRole }
            });
            // No ack: nothing was stored, and there is nothing to be sure of.
            return;
          }

          if (message.type === 'RECORD') {
            if (!currentClient) {
              this.sendJson(ws, { type: 'ERROR', error: 'JOIN before sending records' });
              return;
            }
            // Nothing a listener sends is stored. It holds no key, so anything
            // it wrote could only be noise in the couple's history.
            if (currentClient.passive) {
              this.sendJson(ws, { type: 'ERROR', error: 'Passive connection is read-only' });
              return;
            }

            if (!consumeToken(currentClient)) {
              // Naming the record lets the phone send it again promptly, in its
              // place in the queue. Without the id it could only wait and
              // guess, and a newer copy of the same thing could overtake it.
              const refusedId = typeof message.record?.id === 'string' ? message.record.id : undefined;
              this.sendJson(ws, { type: 'ERROR', error: 'Rate limit exceeded, slow down', recordId: refusedId });
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
          const { spaceId, passive } = currentClient;
          this.clients.delete(currentClient);
          currentClient = null;
          // The partner should see them leave, not wait for a timeout. A
          // listener was never counted, so its leaving changes nothing.
          if (!passive) this.broadcastPresence(spaceId);
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
  /**
   * Sends what this reader missed, resuming from whichever cursor it has.
   *
   * `sinceSeq` is this relay's own numbering and is preferred whenever the
   * client has one. `since` is the sender-chosen clock the protocol started
   * with, kept for a client that has not applied a numbered record yet - its
   * first connection after an upgrade, and every older build.
   */
  private async replayMissedRecords(client: SpaceClient, since: unknown, sinceSeq?: unknown) {
    const sinceLamport = Number.isFinite(Number(since)) ? Number(since) : 0;
    const seqCursor = Number.isFinite(Number(sinceSeq)) ? Math.max(0, Number(sinceSeq)) : 0;

    // A listener with no cursor would be sent the whole space's history as
    // "from scratch", and would then confirm a year of messages as just
    // delivered. The phone never sends that, and this makes sure of it.
    if (client.passive && sinceLamport === 0 && seqCursor === 0) {
      this.sendJson(client.ws, { type: 'REPLAY_COMPLETE', count: 0, more: false });
      return;
    }

    let missed: StoredRecord[];
    try {
      missed = await db.getRecordsForSpace(client.spaceId, sinceLamport, seqCursor);
    } catch (err) {
      console.error('[WebSocket Relay] Replay failed', err);
      return;
    }

    /**
     * Whose records come back.
     *
     * A reader that is resuming already holds everything it wrote itself, so
     * its own records are skipped - they would arrive as duplicates of what is
     * already on screen.
     *
     * A reader with no cursor at all is a different thing entirely: a phone
     * that has just been set up, or reinstalled, or wiped. It holds nothing.
     * Until now it was still refused its own side, so somebody restoring after
     * a lost phone got their partner's half of the conversation and none of
     * their own - every letter they wrote, every memo they left, missing, with
     * nothing to say why. A reader starting from nothing gets everything the
     * relay is holding for the space.
     */
    const fromScratch = sinceLamport === 0 && seqCursor === 0;
    const eligible = fromScratch ? missed : missed.filter(r => r.authorId !== client.authorRole);
    const batch = eligible.slice(0, MAX_REPLAY_RECORDS);

    for (const record of batch) {
      if (client.ws.readyState !== WebSocket.OPEN) return;
      this.sendJson(
        client.ws,
        client.passive ? { type: 'RECORD_META', record: toRecordMeta(record) } : { type: 'REMOTE_RECORD', record }
      );
    }

    // `more` is the whole point of the cap being survivable.
    //
    // Records come back oldest first, so a cap keeps the oldest and drops the
    // newest - the opposite of what somebody returning from a fortnight away
    // wants, and it was not said out loud either. Saying so lets the reader ask
    // for the next page and work forward to the present, rather than being left
    // holding old history with the recent part missing and nothing to explain
    // the gap.
    this.sendJson(client.ws, {
      type: 'REPLAY_COMPLETE',
      count: batch.length,
      more: eligible.length > batch.length
    });
  }

  /**
   * Fans a record out to every OTHER connection in the space, whatever role it holds.
   *
   * A listener gets a record's metadata in its place - what it is, who wrote
   * it, where it sits - and never a signal, which is only ever for an open app.
   */
  private broadcastToSpace(spaceId: string, senderConnectionId: number, payload: any) {
    const raw = JSON.stringify(payload);
    let metaRaw: string | null = null;
    for (const client of this.clients) {
      if (client.spaceId === spaceId && client.connectionId !== senderConnectionId && client.ws.readyState === WebSocket.OPEN) {
        if (!client.passive) {
          client.ws.send(raw);
          continue;
        }
        if (payload?.type !== 'REMOTE_RECORD' || !payload.record) continue;
        // Built once, and only if a listener is actually here.
        if (metaRaw === null) {
          metaRaw = JSON.stringify({ type: 'RECORD_META', record: toRecordMeta(payload.record) });
        }
        client.ws.send(metaRaw);
      }
    }
  }

  /**
   * Tells each author which of their records have just reached the reader.
   *
   * Sent to the author's open apps only. One who is away is told when they
   * next JOIN, from what was stored. It names no device.
   */
  private announceReached(spaceId: string, marked: { id: string; authorId: string }[], at: number) {
    const byAuthor = new Map<string, { id: string; at: number }[]>();
    for (const row of marked) {
      const list = byAuthor.get(row.authorId) || [];
      list.push({ id: row.id, at });
      byAuthor.set(row.authorId, list);
    }
    for (const [authorId, reached] of byAuthor) {
      const parts = chunk(reached, REACHED_CHUNK);
      for (const client of this.clients) {
        if (
          client.spaceId === spaceId &&
          client.authorRole === authorId &&
          !client.passive &&
          client.ws.readyState === WebSocket.OPEN
        ) {
          for (const part of parts) this.sendJson(client.ws, { type: 'REACHED', reached: part });
        }
      }
    }
  }

  /** The receipts stored for this phone's own records since it last heard any. */
  private async replayReached(client: SpaceClient, since: number) {
    let reached: { id: string; at: number }[];
    try {
      reached = await db.getReachedSince(client.spaceId, client.authorRole, since, MAX_REACHED_REPLAY);
    } catch (err) {
      // Never worth failing a JOIN over: the ticks come anyway when the
      // partner next opens Two.
      console.error('[WebSocket Relay] Receipt replay failed', err);
      return;
    }
    for (const part of chunk(reached, REACHED_CHUNK)) {
      if (client.ws.readyState !== WebSocket.OPEN) return;
      this.sendJson(client.ws, { type: 'REACHED', reached: part });
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
    // A listener is left out entirely: told nothing, and counted nowhere. It
    // is not the person being there, and as an extra socket it would trip
    // the alert about a device nobody recognises.
    const inSpace: SpaceClient[] = [];
    for (const c of this.clients) {
      if (c.spaceId === spaceId && !c.passive && c.ws.readyState === WebSocket.OPEN) inSpace.push(c);
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
        // The total comes from the relay's own socket table, so unlike anything
        // a client asserts about itself it cannot be forged by someone holding
        // the pairing code. It is what makes an extra listener detectable.
        total: inSpace.length,
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

/**
 * The record ids a RECEIVED names, or null when it names none worth taking.
 *
 * Anything that is not a short string is dropped and repeats are folded, so
 * one bad entry does not cost the rest. Too many at once is refused whole
 * rather than cut, because the phone would have no way to know which part was
 * left out.
 */
export function parseReceivedIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = [...new Set(raw.filter((s): s is string => typeof s === 'string' && s.length >= 1 && s.length <= 64))];
  if (ids.length === 0 || ids.length > MAX_RECEIVED_IDS) return null;
  return ids;
}

/** What a listener may know of a record: never its payload, nonce or the sender's clock. */
export function toRecordMeta(record: StoredRecord) {
  return {
    id: record.id,
    type: record.type,
    authorId: record.authorId,
    lamportClock: record.lamportClock,
    seq: record.seq
  };
}

/** Splits a list into pieces of at most `size`, in order. */
export function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
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
    Number.isFinite(Number(r.lamportClock)) &&
    // clientTs was not checked here, but the INSERT binds it to a bigint
    // column. A record without one was acknowledged to the sender and then
    // failed to store as String(undefined) - 'undefined' - forever.
    Number.isFinite(Number(r.clientTs))
  );
}
