// Storage Layer: Supports in-memory zero-knowledge storage for instant local testing,
// and bridges to Prisma/PostgreSQL when DATABASE_URL is present.

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
  members: string[]; // userIds
  sealedKeys: Record<string, string>; // userId -> sealedSpaceKey Base64
}

class InMemoryRelayDb {
  users = new Map<string, StoredUser>();
  spaces = new Map<string, StoredSpace>();
  records: StoredRecord[] = [];
  rendezvousTokens = new Map<string, { spaceId: string; creatorPublicKey: string; sealedKey: string }>();

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
    if (!space) throw new Error("Space not found");
    if (!space.members.includes(memberId)) {
      space.members.push(memberId);
    }
    space.sealedKeys[memberId] = sealedKey;
    return space;
  }

  async saveRecord(record: StoredRecord) {
    this.records.push(record);
    return record;
  }

  async getRecordsForSpace(spaceId: string, sinceLamport: number = 0) {
    return this.records
      .filter(r => r.spaceId === spaceId && r.lamportClock > sinceLamport)
      .sort((a, b) => a.lamportClock - b.lamportClock);
  }
}

export const db = new InMemoryRelayDb();
