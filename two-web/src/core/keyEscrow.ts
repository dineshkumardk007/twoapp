// Wrapping the pairing code so it can survive a new device.
//
// The pairing code derives every key in the app, so it must never be stored on
// the server in the clear. Instead it is encrypted twice, under two independent
// secrets the server never sees:
//
//   * the login password  - the everyday path; logging in restores the space
//   * a 12-word recovery phrase - the only way back if the password is lost
//
// Both wrappings hold the same code, so either one opens the space. A password
// reset alone cannot: it changes what you type, not the key the old ciphertext
// was sealed with, which is exactly why the recovery phrase exists.

const WRAP_ITERATIONS = 310_000;

export interface WrappedSecret {
  salt: string;
  nonce: string;
  ct: string;
}

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

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  window.crypto.getRandomValues(bytes);
  return bytes;
}

async function deriveWrapKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: WRAP_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Seals `secret` under `passphrase`. The salt is random per wrapping. */
export async function wrapSecret(secret: string, passphrase: string): Promise<WrappedSecret> {
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = await deriveWrapKey(passphrase, salt);

  const ct = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    new TextEncoder().encode(secret)
  );

  return { salt: toBase64(salt), nonce: toBase64(nonce), ct: toBase64(new Uint8Array(ct)) };
}

/** Opens a wrapping. Returns null on the wrong passphrase rather than throwing. */
export async function unwrapSecret(
  wrapped: WrappedSecret,
  passphrase: string
): Promise<string | null> {
  try {
    const key = await deriveWrapKey(passphrase, fromBase64(wrapped.salt));
    const plaintext = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(wrapped.nonce) },
      key,
      fromBase64(wrapped.ct)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

/**
 * Wraps one secret under both the password and the recovery phrase.
 *
 * Done together so the two copies can never drift apart - a space recoverable
 * by phrase but not by password (or vice versa) is a silent trap.
 */
export async function wrapForEscrow(secret: string, password: string, recoveryPhrase: string) {
  const [byPassword, byRecovery] = await Promise.all([
    wrapSecret(secret, password),
    wrapSecret(secret, recoveryPhrase)
  ]);
  return { byPassword, byRecovery };
}
