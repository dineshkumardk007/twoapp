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
  createSpace(spaceId: string, creatorId: string, creatorPublicKey: string, sealedKey: string): Promise<StoredSpace>;
  addMemberToSpace(spaceId: string, memberId: string, sealedKey: string): Promise<StoredSpace>;
  saveRecord(record: StoredRecord): Promise<StoredRecord>;
  getRecordsForSpace(spaceId: string, sinceLamport?: number): Promise<StoredRecord[]>;
  rendezvousTokens: Map<string, RendezvousToken>;
}

class InMemoryRelayDb implements RelayDb {
  readonly kind = 'memory' as const;

  users = new Map<string, StoredUser>();
  spaces = new Map<string, StoredSpace>();
  records: StoredRecord[] = [];
  rendezvousTokens = new Map<string, RendezvousToken>();

  async init() {
    console.warn('[Relay DB] DATABASE_URL is not set - using in-memory storage. Records are lost on restart.');
  }

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
    // Replaying the same record must not duplicate it.
    const existing = this.records.findIndex(r => r.id === record.id);
    if (existing >= 0) {
      this.records[existing] = record;
    } else {
      this.records.push(record);
    }
    return record;
  }

  async getRecordsForSpace(spaceId: string, sinceLamport = 0) {
    return this.records
      .filter(r => r.spaceId === spaceId && r.lamportClock > sinceLamport)
      .sort((a, b) => a.lamportClock - b.lamportClock);
  }
}

class PostgresRelayDb implements RelayDb {
  readonly kind = 'postgres' as const;

  // Pairing rendezvous is short-lived and cheap to redo, so it stays in memory.
  rendezvousTokens = new Map<string, RendezvousToken>();

  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000
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
    await this.pool.query(
      `INSERT INTO relay_records
         (id, space_id, author_id, type, payload, nonce, lamport_clock, client_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
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
    return record;
  }

  async getRecordsForSpace(spaceId: string, sinceLamport = 0) {
    const { rows } = await this.pool.query(
      `SELECT id, space_id, author_id, type, payload, nonce, lamport_clock, client_ts, created_at
       FROM relay_records
       WHERE space_id = $1 AND lamport_clock > $2
       ORDER BY lamport_clock ASC`,
      [spaceId, String(sinceLamport)]
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
      createdAt: new Date(r.created_at).toISOString()
    }));
  }
}

export const db: RelayDb = process.env.DATABASE_URL
  ? new PostgresRelayDb(process.env.DATABASE_URL)
  : new InMemoryRelayDb();
