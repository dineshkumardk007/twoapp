// Storage layer for the zero-knowledge relay.
//
// Two backends implement the same interface:
//   * PostgresRelayDb - used whenever DATABASE_URL is set, so a container
//     restart does not lose the couple's history.
//   * InMemoryRelayDb - the zero-config fallback for local development.
//
// Either way the relay only ever stores opaque base64 ciphertext plus the
// routing metadata it needs (space id, author role, lamport clock). It holds no
// key material and cannot read any of it.

import { Pool } from 'pg';

/**
 * A record that says only "this device was here just now".
 *
 * Kept to exactly one row per device per space, because it is the current
 * value that matters and never the history: a beat every couple of minutes
 * would otherwise add hundreds of rows a day, crowd real messages out of the
 * 2000-record replay a new device receives, and hand the retention sweep a
 * pile of noise to carry for ninety days.
 */
export const PRESENCE_BEAT = 'PRESENCE_BEAT';

/**
 * Record types where only the newest from each author is worth keeping.
 *
 * All of them answer a question about right now - am I here, what is my name,
 * how far have I read - so an older answer is not history, it is a stale
 * duplicate. Collapsing them keeps a chatty group from burying its own
 * messages in the 2000-record replay a new device receives.
 */
export const LATEST_ONLY_TYPES = new Set([PRESENCE_BEAT, 'GROUP_HELLO', 'GROUP_READ']);

export interface StoredRecord {
  id: string;
  spaceId: string;
  authorId: string;
  type: string;
  payload: string; // Base64 ciphertext
  nonce: string;   // Base64 nonce
  lamportClock: number;
  clientTs: number;
  createdAt: string;
  /**
   * The order this relay accepted the record in, assigned here and never by a
   * client.
   *
   * Readers resume from a clock the sender chose, which is only sound while
   * senders stamp honestly and promptly. A record queued on a sleeping phone
   * and delivered an hour later arrives behind clocks everyone has already
   * passed, and is skipped by anyone who was away - silently and for good.
   * A number this side issues cannot be late, because it is taken when the
   * record is stored rather than when it was written.
   */
  seq?: number;
}

export interface StoredUser {
  id: string;
  authId: string;
  publicKey: string;
  encryptedPrivateKey: string;
}

export interface StoredSpace {
  id: string;
  members: string[];
  sealedKeys: Record<string, string>;
}

export interface RendezvousToken {
  spaceId: string;
  creatorPublicKey: string;
  sealedKey: string;
}

export interface RelayDb {
  readonly kind: 'postgres' | 'memory';
  init(): Promise<void>;
  createUser(user: StoredUser): Promise<StoredUser>;
  findUserByAuthId(authId: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  createSpace(spaceId: string, creatorId: string, creatorPublicKey: string, sealedKey: string): Promise<StoredSpace>;
  addMemberToSpace(spaceId: string, memberId: string, sealedKey: string): Promise<StoredSpace>;
  saveRecord(record: StoredRecord): Promise<StoredRecord>;
  getRecordsForSpace(
    spaceId: string,
    sinceLamport?: number,
    sinceSeq?: number
  ): Promise<StoredRecord[]>;
  /** Deletes records older than the retention window. Returns how many went. */
  purgeRecordsOlderThan(days: number): Promise<number>;
  rendezvousTokens: Map<string, RendezvousToken>;
}

class InMemoryRelayDb implements RelayDb {
  readonly kind = 'memory' as const;

  users = new Map<string, StoredUser>();
  spaces = new Map<string, StoredSpace>();
  records: StoredRecord[] = [];
  /**
   * Numbers records the way Postgres does, so the resume cursor works the same
   * whether this store is standing in or not. It restarts at one each boot,
   * which is safe precisely because readers only ever raise their cursor.
   */
  private seqCounter = 0;
  rendezvousTokens = new Map<string, RendezvousToken>();

  // Deliberately silent. This store is never used on its own - it is the
  // buffer inside ResilientRelayDb, which is constructed on every boot
  // whether or not Postgres is configured. Announcing "DATABASE_URL is not
  // set" from here therefore said it on every boot, including the ones that
  // went on to connect to Postgres two lines later. Whether the relay is
  // actually durable is ResilientRelayDb's fact to report, and it does.
  async init() {}

  async createUser(user: StoredUser) {
    this.users.set(user.id, user);
    return user;
  }

  async findUserByAuthId(authId: string) {
    for (const u of this.users.values()) {
      if (u.authId === authId) return u;
    }
    return null;
  }

  async findUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async createSpace(spaceId: string, creatorId: string, creatorPublicKey: string, sealedKey: string) {
    const space: StoredSpace = {
      id: spaceId,
      members: [creatorId],
      sealedKeys: { [creatorId]: sealedKey }
    };
    this.spaces.set(spaceId, space);
    return space;
  }

  async addMemberToSpace(spaceId: string, memberId: string, sealedKey: string) {
    const space = this.spaces.get(spaceId);
    if (!space) throw new Error('Space not found');
    if (!space.members.includes(memberId)) {
      space.members.push(memberId);
    }
    space.sealedKeys[memberId] = sealedKey;
    return space;
  }

  async saveRecord(record: StoredRecord) {
    if (LATEST_ONLY_TYPES.has(record.type)) {
      this.records = this.records.filter(
        r =>
          !(
            r.type === record.type &&
            r.spaceId === record.spaceId &&
            r.authorId === record.authorId
          )
      );
      record.seq = ++this.seqCounter;
      this.records.push(record);
      return record;
    }

    // Replaying the same record must not duplicate it.
    const existing = this.records.findIndex(r => r.id === record.id);
    if (existing >= 0) {
      // Keep the number it was first given; the point of it is not to move.
      record.seq = this.records[existing].seq;
      this.records[existing] = record;
    } else {
      record.seq = ++this.seqCounter;
      this.records.push(record);
    }
    return record;
  }

  async getRecordsForSpace(spaceId: string, sinceLamport = 0, sinceSeq = 0) {
    if (sinceSeq > 0) {
      return this.records
        .filter(r => r.spaceId === spaceId && (r.seq || 0) > sinceSeq)
        .sort((a, b) => (a.seq || 0) - (b.seq || 0));
    }
    return this.records
      .filter(r => r.spaceId === spaceId && r.lamportClock > sinceLamport)
      .sort((a, b) => a.lamportClock - b.lamportClock);
  }

  async purgeRecordsOlderThan(days: number) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const before = this.records.length;
    this.records = this.records.filter(r => {
      const at = r.createdAt ? new Date(r.createdAt).getTime() : Date.now();
      return Number.isFinite(at) ? at >= cutoff : true;
    });
    return before - this.records.length;
  }
}

class PostgresRelayDb implements RelayDb {
  readonly kind = 'postgres' as const;

  // Pairing rendezvous is short-lived and cheap to redo, so it stays in memory.
  rendezvousTokens = new Map<string, RendezvousToken>();

  private pool: Pool;

  constructor(connectionString: string) {
    const isRemote = connectionString.includes('supabase.co') ||
                     connectionString.includes('pooler.supabase.com') ||
                     connectionString.includes('sslmode=require') ||
                     process.env.NODE_ENV === 'production';

    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl: isRemote ? { rejectUnauthorized: false } : undefined
    });
    this.pool.on('error', err => console.error('[Relay DB] Idle client error', err));
  }

  async init() {
    // The relay owns a handful of tables and no migration history, so creating
    // them if absent keeps deployment to a single `docker compose up`.
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS relay_users (
        id TEXT PRIMARY KEY,
        auth_id TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS relay_spaces (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS relay_space_members (
        space_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        sealed_key TEXT NOT NULL,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (space_id, member_id)
      );

      CREATE TABLE IF NOT EXISTS relay_records (
        id TEXT PRIMARY KEY,
        space_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        nonce TEXT NOT NULL,
        lamport_clock BIGINT NOT NULL,
        client_ts BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS relay_records_space_lamport_idx
        ON relay_records (space_id, lamport_clock);

      -- Added after the table existed, so it is an ALTER rather than a column
      -- in the CREATE above. BIGSERIAL fills the rows already there; their
      -- exact order does not matter, only that every later insert is higher.
      ALTER TABLE relay_records ADD COLUMN IF NOT EXISTS seq BIGSERIAL;

      CREATE INDEX IF NOT EXISTS relay_records_space_seq_idx
        ON relay_records (space_id, seq);
    `);

    console.log('[Relay DB] PostgreSQL storage ready.');
  }

  async createUser(user: StoredUser) {
    await this.pool.query(
      `INSERT INTO relay_users (id, auth_id, public_key, encrypted_private_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET public_key = EXCLUDED.public_key,
             encrypted_private_key = EXCLUDED.encrypted_private_key`,
      [user.id, user.authId, user.publicKey, user.encryptedPrivateKey]
    );
    return user;
  }

  async findUserByAuthId(authId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, auth_id, public_key, encrypted_private_key
       FROM relay_users WHERE auth_id = $1 LIMIT 1`,
      [authId]
    );
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      authId: r.auth_id,
      publicKey: r.public_key,
      encryptedPrivateKey: r.encrypted_private_key
    };
  }

  async findUserById(id: string) {
    const { rows } = await this.pool.query(
      `SELECT id, auth_id, public_key, encrypted_private_key
       FROM relay_users WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      authId: r.auth_id,
      publicKey: r.public_key,
      encryptedPrivateKey: r.encrypted_private_key
    };
  }

  async createSpace(spaceId: string, creatorId: string, _creatorPublicKey: string, sealedKey: string) {
    await this.pool.query(
      `INSERT INTO relay_spaces (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [spaceId]
    );
    await this.pool.query(
      `INSERT INTO relay_space_members (space_id, member_id, sealed_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (space_id, member_id) DO UPDATE SET sealed_key = EXCLUDED.sealed_key`,
      [spaceId, creatorId, sealedKey]
    );
    return this.readSpace(spaceId);
  }

  async addMemberToSpace(spaceId: string, memberId: string, sealedKey: string) {
    const { rowCount } = await this.pool.query(`SELECT 1 FROM relay_spaces WHERE id = $1`, [spaceId]);
    if (!rowCount) throw new Error('Space not found');

    await this.pool.query(
      `INSERT INTO relay_space_members (space_id, member_id, sealed_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (space_id, member_id) DO UPDATE SET sealed_key = EXCLUDED.sealed_key`,
      [spaceId, memberId, sealedKey]
    );
    return this.readSpace(spaceId);
  }

  private async readSpace(spaceId: string): Promise<StoredSpace> {
    const { rows } = await this.pool.query(
      `SELECT member_id, sealed_key FROM relay_space_members WHERE space_id = $1 ORDER BY joined_at`,
      [spaceId]
    );
    const sealedKeys: Record<string, string> = {};
    for (const r of rows) sealedKeys[r.member_id] = r.sealed_key;

    return { id: spaceId, members: rows.map(r => r.member_id), sealedKeys };
  }

  async saveRecord(record: StoredRecord) {
    // One beat per device: the previous one is worthless the moment a newer
    // arrives, and each carries a fresh id because the clients dedupe inbound
    // records by id - a stable id would be applied once and every later beat
    // silently ignored.
    if (LATEST_ONLY_TYPES.has(record.type)) {
      await this.pool.query(
        `DELETE FROM relay_records
          WHERE space_id = $1 AND author_id = $2 AND type = $3`,
        [record.spaceId, record.authorId, record.type]
      );
    }

    const inserted = await this.pool.query(
      `INSERT INTO relay_records
         (id, space_id, author_id, type, payload, nonce, lamport_clock, client_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING
       RETURNING seq`,
      [
        record.id,
        record.spaceId,
        record.authorId,
        record.type,
        record.payload,
        record.nonce,
        String(record.lamportClock),
        String(record.clientTs)
      ]
    );

    // No row back means the id was already there and the insert did nothing,
    // so the number to report is the one that row already carries.
    if (inserted.rows[0]?.seq !== undefined) {
      record.seq = Number(inserted.rows[0].seq);
    } else {
      const { rows } = await this.pool.query(
        `SELECT seq FROM relay_records WHERE id = $1`,
        [record.id]
      );
      if (rows[0]?.seq !== undefined) record.seq = Number(rows[0].seq);
    }
    return record;
  }

  async getRecordsForSpace(spaceId: string, sinceLamport = 0, sinceSeq = 0) {
    // A reader that has never applied a record carrying a seq has nothing to
    // resume from yet and falls back to the clock, exactly as before. It picks
    // up seq values from this very batch and uses them from then on.
    const bySeq = sinceSeq > 0;
    const { rows } = await this.pool.query(
      bySeq
        ? `SELECT id, space_id, author_id, type, payload, nonce, lamport_clock, client_ts, created_at, seq
           FROM relay_records
           WHERE space_id = $1 AND seq > $2
           ORDER BY seq ASC`
        : `SELECT id, space_id, author_id, type, payload, nonce, lamport_clock, client_ts, created_at, seq
           FROM relay_records
           WHERE space_id = $1 AND lamport_clock > $2
           ORDER BY lamport_clock ASC`,
      [spaceId, String(bySeq ? sinceSeq : sinceLamport)]
    );

    // BIGINT arrives as a string from pg; JSON needs real numbers.
    return rows.map(r => ({
      id: r.id,
      spaceId: r.space_id,
      authorId: r.author_id,
      type: r.type,
      payload: r.payload,
      nonce: r.nonce,
      lamportClock: Number(r.lamport_clock),
      clientTs: Number(r.client_ts),
      createdAt: new Date(r.created_at).toISOString(),
      seq: r.seq === undefined || r.seq === null ? undefined : Number(r.seq)
    }));
  }

  async purgeRecordsOlderThan(days: number) {
    // created_at is the server's own clock. client_ts is whatever the sending
    // device believed the time was, and a phone with a wrong clock could
    // otherwise have its records deleted the moment they arrived.
    const { rowCount } = await this.pool.query(
      `DELETE FROM relay_records
       WHERE created_at < now() - ($1 || ' days')::interval`,
      [String(days)]
    );
    return rowCount ?? 0;
  }
}

/**
 * Wraps PostgreSQL with a degraded mode instead of a one-way trapdoor.
 *
 * The previous behaviour switched to in-memory on the first connection error
 * and never went back, so a brief Postgres hiccup at boot silently cost the
 * couple every message until someone noticed and restarted the process. Here a
 * failure marks the relay degraded, buffers writes in memory, and keeps
 * retrying; when Postgres returns the buffer is drained into it.
 */
/**
 * True for a failure that retrying cannot fix.
 *
 * SQLSTATE class 22 is a data exception (a value the column cannot hold) and
 * class 23 an integrity violation. Everything else - dropped sockets, class 08
 * connection errors, a sleeping database - is worth waiting out.
 */
function isPermanentWriteError(err: any): boolean {
  const code = typeof err?.code === 'string' ? err.code : '';
  return /^(22|23)/.test(code) && code.length === 5;
}

class ResilientRelayDb implements RelayDb {
  private postgres: RelayDb | null;
  private memory = new InMemoryRelayDb();

  /** False while Postgres is unreachable. Reported by /health. */
  private healthy = true;

  /** Records accepted while degraded, replayed into Postgres on recovery. */
  private pending: StoredRecord[] = [];
  private static readonly MAX_PENDING = 10_000;

  private retryTimer: NodeJS.Timeout | null = null;
  private retryDelayMs = 5_000;
  private static readonly MAX_RETRY_MS = 60_000;

  constructor() {
    this.postgres = process.env.DATABASE_URL
      ? new PostgresRelayDb(process.env.DATABASE_URL)
      : null;
    if (!this.postgres) this.healthy = false;
  }

  get kind() {
    return this.postgres ? ('postgres' as const) : ('memory' as const);
  }

  /** True when running on Postgres and currently connected. */
  get isDurable() {
    return this.postgres !== null && this.healthy;
  }

  get pendingCount() {
    return this.pending.length;
  }

  get rendezvousTokens() {
    return this.memory.rendezvousTokens;
  }

  /**
   * Trims history past the retention window.
   *
   * Skipped entirely while degraded: the buffered writes have not reached
   * Postgres yet, and deleting from a database we are not currently able to
   * write to is the wrong move while an outage is in progress.
   */
  async purgeRecordsOlderThan(days: number) {
    if (!this.postgres || !this.healthy) return 0;
    try {
      return await this.postgres.purgeRecordsOlderThan(days);
    } catch (err: any) {
      console.error('[Relay DB] Retention sweep failed:', err?.message || err);
      return 0;
    }
  }

  async init() {
    await this.memory.init();

    if (!this.postgres) {
      console.warn(
        '[Relay DB] DATABASE_URL is not set - using in-memory storage. Records are lost on restart.'
      );
      return;
    }

    try {
      await this.postgres.init();
      this.healthy = true;
      console.log('[Relay DB] PostgreSQL connected.');
    } catch (err: any) {
      this.healthy = false;
      console.error('[Relay DB] PostgreSQL unavailable at startup:', err?.message || err);
      console.warn('[Relay DB] Serving in DEGRADED mode - writes are buffered in memory and retried.');
      this.scheduleRetry();
    }
  }

  private scheduleRetry() {
    if (this.retryTimer || !this.postgres) return;

    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      try {
        await this.postgres!.init();
        this.healthy = true;
        this.retryDelayMs = 5_000;
        console.log('[Relay DB] PostgreSQL recovered.');
        await this.drainPending();
      } catch (err: any) {
        // Back off, but keep trying - the outage may outlast a few attempts.
        this.retryDelayMs = Math.min(this.retryDelayMs * 2, ResilientRelayDb.MAX_RETRY_MS);
        console.warn(`[Relay DB] Still unavailable, retrying in ${this.retryDelayMs / 1000}s`);
        this.scheduleRetry();
      }
    }, this.retryDelayMs);

    // A pending reconnect must never hold the process open.
    if (typeof this.retryTimer.unref === 'function') this.retryTimer.unref();
  }

  private async drainPending() {
    if (!this.postgres || this.pending.length === 0) return;

    const batch = this.pending;
    this.pending = [];
    let flushed = 0;

    for (const record of batch) {
      try {
        await this.postgres.saveRecord(record);
        flushed++;
      } catch (err: any) {
        if (isPermanentWriteError(err)) {
          // This record will never insert, however long we wait. Re-queuing it
          // meant every drain failed on it, which put the relay back into
          // degraded mode, which scheduled another drain - so one malformed
          // record stopped ALL later records from ever reaching Postgres.
          // Drop it loudly instead of holding durability hostage to it.
          console.error(
            `[Relay DB] Discarding record ${record.id} - it cannot be stored: ${err?.message || err}`
          );
          continue;
        }
        // Went down again mid-drain; keep the remainder for the next attempt.
        this.pending.push(record);
      }
    }
    console.log(`[Relay DB] Flushed ${flushed} buffered record(s); ${this.pending.length} still pending.`);

    if (this.pending.length > 0) {
      this.healthy = false;
      this.scheduleRetry();
    }
  }

  private degrade(err: unknown) {
    if (this.healthy) {
      console.error('[Relay DB] Write failed, entering degraded mode:', (err as any)?.message || err);
    }
    this.healthy = false;
    this.scheduleRetry();
  }

  /**
   * Persists a record, returning whether it reached durable storage. The relay
   * forwards the message either way; the caller tells the sender the truth.
   */
  async saveRecordDurable(record: StoredRecord): Promise<boolean> {
    await this.memory.saveRecord(record);

    if (!this.postgres) return false;

    if (this.healthy) {
      try {
        await this.postgres.saveRecord(record);
        return true;
      } catch (err) {
        this.degrade(err);
      }
    }

    if (this.pending.length < ResilientRelayDb.MAX_PENDING) {
      this.pending.push(record);
    } else {
      console.error('[Relay DB] Pending buffer full - dropping oldest buffered record.');
      this.pending.shift();
      this.pending.push(record);
    }
    return false;
  }

  async saveRecord(record: StoredRecord) {
    await this.saveRecordDurable(record);
    return record;
  }

  async getRecordsForSpace(spaceId: string, sinceLamport = 0, sinceSeq = 0) {
    if (this.postgres && this.healthy) {
      try {
        return await this.postgres.getRecordsForSpace(spaceId, sinceLamport, sinceSeq);
      } catch (err) {
        this.degrade(err);
      }
    }
    // Degraded: serve whatever this process still holds rather than nothing.
    //
    // This store numbers from one each boot, so its seq values sit far below
    // anything Postgres has issued. Readers only ever raise their cursor, so a
    // low number is ignored rather than dragging them backwards - a degraded
    // spell leaves the cursor where it was instead of corrupting it.
    return this.memory.getRecordsForSpace(spaceId, sinceLamport, sinceSeq);
  }

  private async viaPostgres<T>(op: (db: RelayDb) => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (this.postgres && this.healthy) {
      try {
        return await op(this.postgres);
      } catch (err) {
        this.degrade(err);
      }
    }
    return fallback();
  }

  createUser(user: StoredUser) {
    return this.viaPostgres(db => db.createUser(user), () => this.memory.createUser(user));
  }
  findUserByAuthId(authId: string) {
    return this.viaPostgres(db => db.findUserByAuthId(authId), () => this.memory.findUserByAuthId(authId));
  }
  findUserById(id: string) {
    return this.viaPostgres(db => db.findUserById(id), () => this.memory.findUserById(id));
  }
  createSpace(spaceId: string, creatorId: string, creatorPublicKey: string, sealedKey: string) {
    return this.viaPostgres(
      db => db.createSpace(spaceId, creatorId, creatorPublicKey, sealedKey),
      () => this.memory.createSpace(spaceId, creatorId, creatorPublicKey, sealedKey)
    );
  }
  addMemberToSpace(spaceId: string, memberId: string, sealedKey: string) {
    return this.viaPostgres(
      db => db.addMemberToSpace(spaceId, memberId, sealedKey),
      () => this.memory.addMemberToSpace(spaceId, memberId, sealedKey)
    );
  }
}

export const db = new ResilientRelayDb();
