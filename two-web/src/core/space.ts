// Space identity & key derivation for Two.
//
// A couple's entire connection is bootstrapped from ONE shared secret: the
// pairing code. From it we deterministically derive both
//
//   * spaceId  - the relay room name (public; the server sees this)
//   * spaceKey - the AES-GCM key protecting every record (private; never sent)
//
// Because both are derived client-side from the same code, two devices that
// type the same words land in the same room holding the same key, and the
// relay operator only ever sees an opaque room id and ciphertext.

import { BIP39_WORDS } from './crypto';

const SESSION_KEY = 'two_space_session_v1';

// 8 words from the wordlist. Brute-forcing this offline means paying the
// PBKDF2 cost below for every guess.
const PAIRING_WORD_COUNT = 8;
const PBKDF2_ITERATIONS = 210_000;

const SALT_SPACE_ID = 'two.space.id.v1';
const SALT_SPACE_KEY = 'two.space.key.v1';

/** Which side of the pair this device represents. Drives `authorId` on the wire. */
export type SpaceRole = 'user' | 'partner';

export interface SpaceSession {
  /** The shared pairing code, normalised to `TWO-XXXX` or words. */
  code: string;
  /**
   * Words the couple speak aloud, never sent anywhere.
   *
   * An invite carries the pairing code through the server, so the code alone no
   * longer keeps the operator out. Mixing this into the content key does: the
   * server can see the room and the ciphertext, but cannot derive the key
   * without words that were only ever spoken.
   */
  joinPhrase?: string;
  role: SpaceRole;
  userName?: string;
  partnerName?: string;
}

export interface SpaceCredentials {
  spaceId: string;
  key: CryptoKey;
  role: SpaceRole;
}

// Ambiguity is the enemy of a code you read aloud over the phone, so 0/O, 1/I/L
// and U are all absent. 30 symbols -> just under 5 bits each.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 12; // ~58.9 bits
const CODE_GROUP = 4;

const JOIN_PHRASE_WORDS = 4; // ~31 bits from the 220-word list

/** Four words that are easy to say down a phone line and hard to guess. */
export function generateJoinPhrase(): string {
  const picks = new Uint32Array(JOIN_PHRASE_WORDS);
  window.crypto.getRandomValues(picks);

  const words: string[] = [];
  for (let i = 0; i < JOIN_PHRASE_WORDS; i++) {
    words.push(BIP39_WORDS[picks[i] % BIP39_WORDS.length]);
  }
  return words.join(' ');
}

/** Forgiving about spacing, case and punctuation, so speaking it works. */
export function normalizeJoinPhrase(raw: string): string {
  return raw.toLowerCase().split(/[^a-z]+/).filter(Boolean).join(' ');
}

/**
 * Draws an unbiased index into CODE_ALPHABET.
 *
 * `% alphabet.length` on a random byte would quietly favour the first few
 * symbols (256 is not a multiple of 30), so values landing in the short tail
 * are rejected and redrawn.
 */
function randomSymbol(): string {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  const buf = new Uint8Array(1);
  for (;;) {
    window.crypto.getRandomValues(buf);
    if (buf[0] < limit) return CODE_ALPHABET[buf[0] % CODE_ALPHABET.length];
  }
}

/**
 * Generates a fresh pairing code, e.g. `TWO-7K2M-9XQP-R4TN`.
 *
 * The code is the ONLY secret protecting a space: both the room id and the
 * AES key derive from it, so its entropy is the ceiling on the whole system's
 * security. At 12 symbols the keyspace is ~5.8e17, which combined with the
 * PBKDF2 cost below puts an offline sweep far out of reach. Math.random() is
 * unsuitable here at any length - it is predictable, not merely short.
 */
export function generatePairingCode(): string {
  let symbols = '';
  for (let i = 0; i < CODE_LENGTH; i++) symbols += randomSymbol();

  const groups: string[] = [];
  for (let i = 0; i < symbols.length; i += CODE_GROUP) {
    groups.push(symbols.slice(i, i + CODE_GROUP));
  }
  return `TWO-${groups.join('-')}`;
}

/**
 * True for codes from the old `PREFIX-NNNN` scheme (~16 bits), whose entire
 * keyspace can be swept in minutes. Such a space should be re-paired.
 */
export function isWeakPairingCode(raw: string): boolean {
  const symbols = normalizePairingCode(raw).replace(/-/g, '');
  return symbols.length < 12;
}

/**
 * Accepts whatever the joining partner typed and reduces it to canonical form,
 * so "two 8492", "TWO-8492" and "two-8492" derive the same space.
 */
export function normalizePairingCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');
}

export function isPlausiblePairingCode(raw: string): boolean {
  const clean = normalizePairingCode(raw);
  return clean.length >= 4;
}

async function importCodeMaterial(code: string): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
}

/**
 * Derives the room id and content key from the pairing code.
 *
 * The two derivations use different salts, so the spaceId the server learns
 * reveals nothing usable about the key that protects the content.
 */
export async function deriveSpaceCredentials(
  rawCode: string,
  role: SpaceRole,
  rawJoinPhrase?: string
): Promise<SpaceCredentials> {
  const code = normalizePairingCode(rawCode);
  const phrase = normalizeJoinPhrase(rawJoinPhrase || '');
  const enc = new TextEncoder();

  // The room is found from the code alone, so partners who disagree about the
  // phrase still meet - and we can tell them the phrase is wrong instead of
  // leaving them in separate empty rooms wondering why nobody arrived.
  const idMaterial = await importCodeMaterial(code);

  // The content key additionally folds in the spoken phrase. An empty phrase
  // must reproduce the original derivation exactly, or every existing space
  // would become unreadable.
  const keyMaterial = phrase
    ? await importCodeMaterial(`${code}::${phrase}`)
    : idMaterial;

  const idBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(SALT_SPACE_ID),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    idMaterial,
    128
  );

  const spaceId = Array.from(new Uint8Array(idBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(SALT_SPACE_KEY),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return { spaceId, key, role };
}

const LAST_CODE_KEY = 'two_last_space_code_v1';

export function getLastSpaceCode(): string | null {
  try {
    return localStorage.getItem(LAST_CODE_KEY);
  } catch {
    return null;
  }
}

const DEVICE_ID_KEY = 'two_device_id_v1';

/**
 * A stable random id for this device.
 *
 * The relay must route between two *devices*, which is not the same thing as
 * the couple's chosen roles: both partners can legitimately hold the role
 * 'user' (reinstalling and picking "I created this space", or both tapping
 * Rejoin). Routing on the role in that case makes the relay treat them as the
 * same participant and silently forward nothing. The role still labels who
 * wrote a record; only delivery keys off this id.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const bytes = new Uint8Array(new ArrayBuffer(16));
    window.crypto.getRandomValues(bytes);
    const id = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // Private mode: a per-session id still beats colliding on the role.
    return `eph-${Math.random().toString(36).slice(2)}`;
  }
}

export function loadSpaceSession(): SpaceSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SpaceSession>;
    if (!parsed.code || (parsed.role !== 'user' && parsed.role !== 'partner')) {
      return null;
    }
    return {
      code: parsed.code,
      role: parsed.role,
      userName: parsed.userName,
      partnerName: parsed.partnerName,
      joinPhrase: parsed.joinPhrase
    };
  } catch {
    return null;
  }
}

export function saveSpaceSession(session: SpaceSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (session.code) {
      localStorage.setItem(LAST_CODE_KEY, session.code);
    }
  } catch (e) {
    console.error('[Space] Could not persist session', e);
  }
}

export function clearSpaceSession() {
  localStorage.removeItem(SESSION_KEY);
}
