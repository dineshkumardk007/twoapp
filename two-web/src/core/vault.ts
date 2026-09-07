// Encryption at rest for the on-device vault.
//
// Without this, everything the app holds - messages, journals, letters, and the
// pairing code that unlocks the whole space on the relay - sits in localStorage
// as readable JSON. That undermines the calculator decoy and the emergency exit,
// whose whole point is that someone picking up the phone learns nothing.
//
// When a PIN is set, the vault is AES-GCM encrypted under a key derived from it
// and the PIN itself is never stored: entering the wrong one fails to decrypt.

import type { SpaceState } from './storage';
import type { SpaceSession } from './space';

const VAULT_KEY = 'two_vault_v1';
const VAULT_VERSION = 1;

// A 4-digit PIN is only 10,000 possibilities, so the derivation cost is the
// only thing standing between an attacker with the device and the contents.
// Deliberately heavier than the pairing-code derivation.
const PIN_ITERATIONS = 600_000;

export interface VaultPayload {
  state: SpaceState;
  session: SpaceSession | null;
}

interface EncryptedVault {
  v: number;
  salt: string;
  nonce: string;
  ct: string;
}

// btoa on a spread Uint8Array overflows the call stack once the vault grows to
// a few hundred KB, so encode in chunks.
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(out);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** WebCrypto requires ArrayBuffer-backed views, not the looser ArrayBufferLike. */
function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  window.crypto.getRandomValues(bytes);
  return bytes;
}

async function deriveVaultKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PIN_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function readEnvelope(): EncryptedVault | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EncryptedVault;
    if (!parsed?.ct || !parsed.salt || !parsed.nonce) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** True when a PIN-protected vault exists and the app must unlock before use. */
export function hasEncryptedVault(): boolean {
  return readEnvelope() !== null;
}

async function encryptInto(key: CryptoKey, salt: Uint8Array<ArrayBuffer>, payload: VaultPayload) {
  const nonce = randomBytes(12);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));

  const ct = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    plaintext
  );

  const envelope: EncryptedVault = {
    v: VAULT_VERSION,
    salt: toBase64(salt),
    nonce: toBase64(nonce),
    ct: toBase64(new Uint8Array(ct))
  };

  // Encrypted vaults are ~35% larger than the JSON they hold, so they hit the
  // storage ceiling sooner. Surface the failure rather than dropping the write.
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(envelope));
  } catch (e) {
    console.error('[Vault] Could not persist encrypted vault', e);
    throw e;
  }
}

/**
 * Turns on PIN protection: encrypts the payload and returns the key to keep in
 * memory for subsequent writes. The caller is responsible for clearing whatever
 * plaintext copies existed before.
 *
 * The payload may be given as a function of the key. Media lives outside the
 * vault and is encrypted under the same key, so building the payload needs the
 * key that is about to protect it - and that key does not exist until the salt
 * is drawn here. Passing a plain payload stays valid for callers with no media
 * to place, such as a space being created.
 */
export async function createVault(
  pin: string,
  payload: VaultPayload | ((key: CryptoKey) => VaultPayload | Promise<VaultPayload>)
): Promise<CryptoKey> {
  const salt = randomBytes(16);
  const key = await deriveVaultKey(pin, salt);
  const resolved = typeof payload === 'function' ? await payload(key) : payload;
  await encryptInto(key, salt, resolved);
  return key;
}

/**
 * Attempts to open the vault. Returns null when the PIN is wrong - AES-GCM
 * authentication failing IS the check, so no PIN value is ever stored to
 * compare against.
 */
export async function unlockVault(
  pin: string
): Promise<{ key: CryptoKey; payload: VaultPayload } | null> {
  const envelope = readEnvelope();
  if (!envelope) return null;

  try {
    const salt = fromBase64(envelope.salt);
    const key = await deriveVaultKey(pin, salt);

    const plaintext = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.nonce) },
      key,
      fromBase64(envelope.ct)
    );

    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as VaultPayload;
    return { key, payload };
  } catch {
    return null;
  }
}

/** Persists the payload under an already-derived key, reusing the stored salt. */
export async function writeVault(key: CryptoKey, payload: VaultPayload): Promise<boolean> {
  const envelope = readEnvelope();
  if (!envelope) return false;
  try {
    await encryptInto(key, fromBase64(envelope.salt), payload);
    return true;
  } catch {
    return false;
  }
}

/** Removes PIN protection. The caller must persist the payload in the clear. */
export function destroyVault(): void {
  localStorage.removeItem(VAULT_KEY);
}
