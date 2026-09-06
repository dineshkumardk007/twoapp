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
  /** The shared pairing code, normalised to `word-word-...`. */
  code: string;
  role: SpaceRole;
}

export interface SpaceCredentials {
  spaceId: string;
  key: CryptoKey;
  role: SpaceRole;
}

/** Generates a fresh pairing code for the partner who creates the space. */
export function generatePairingCode(): string {
  const picks = new Uint32Array(PAIRING_WORD_COUNT);
  window.crypto.getRandomValues(picks);

  const words: string[] = [];
  for (let i = 0; i < PAIRING_WORD_COUNT; i++) {
    words.push(BIP39_WORDS[picks[i] % BIP39_WORDS.length]);
  }
  return words.join('-');
}

/**
 * Accepts whatever the joining partner typed and reduces it to canonical form,
 * so "Rabbit Ocean  Velvet" and "rabbit-ocean-velvet" derive the same space.
 */
export function normalizePairingCode(raw: string): string {
  return raw.toLowerCase().split(/[^a-z]+/).filter(Boolean).join('-');
}

export function isPlausiblePairingCode(raw: string): boolean {
  const parts = normalizePairingCode(raw).split('-').filter(Boolean);
  return parts.length === PAIRING_WORD_COUNT;
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
  role: SpaceRole
): Promise<SpaceCredentials> {
  const code = normalizePairingCode(rawCode);
  const material = await importCodeMaterial(code);
  const enc = new TextEncoder();

  const idBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(SALT_SPACE_ID),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    material,
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
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return { spaceId, key, role };
}

export function loadSpaceSession(): SpaceSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SpaceSession>;
    if (!parsed.code || (parsed.role !== 'user' && parsed.role !== 'partner')) {
      return null;
    }
    return { code: parsed.code, role: parsed.role };
  } catch {
    return null;
  }
}

export function saveSpaceSession(session: SpaceSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('[Space] Could not persist session', e);
  }
}

export function clearSpaceSession() {
  localStorage.removeItem(SESSION_KEY);
}
