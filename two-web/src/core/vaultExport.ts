// End-to-End Encrypted Vault Export & Import Engine (.two-vault)
import { SpaceState } from './storage';

/**
 * How hard it is to turn the passphrase into the key.
 *
 * This file is the one thing here built to leave the device - onto cloud
 * storage, into an email, onto a stick - which makes it the only artefact an
 * attacker can work on entirely alone: no device to steal, no relay to reach,
 * nothing to throttle them. It was the cheapest of the three derivations in
 * the app at 100,000, below both the space key and the device PIN, which had
 * it exactly backwards. A backup is unlocked once, so the extra fraction of a
 * second is not felt.
 */
const PBKDF2_ITERATIONS = 600_000;

/** What files written before the count was recorded were made with. */
const LEGACY_PBKDF2_ITERATIONS = 100_000;

export interface EncryptedVaultEnvelope {
  version: string;
  format: 'TWO_ENCRYPTED_VAULT';
  /**
   * Absent in files written before this was configurable, which is why import
   * falls back rather than assuming: a backup that could not be opened again
   * is worse than a backup nobody made.
   */
  iterations?: number;
  saltHex: string;
  ivHex: string;
  ciphertextBase64: string;
  exportedAt: string;
  recordCount: {
    messages: number;
    journalEntries: number;
    agreements: number;
    lists: number;
    chores: number;
    expenses: number;
    quotes: number;
  };
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function exportVault(state: SpaceState, passphrase: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassphrase(passphrase, salt, PBKDF2_ITERATIONS);

  const payload = JSON.stringify(state);
  const enc = new TextEncoder();
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    enc.encode(payload)
  );

  const envelope: EncryptedVaultEnvelope = {
    version: '1.1',
    format: 'TWO_ENCRYPTED_VAULT',
    iterations: PBKDF2_ITERATIONS,
    saltHex: bufferToHex(salt.buffer),
    ivHex: bufferToHex(iv.buffer),
    ciphertextBase64: arrayBufferToBase64(ciphertext),
    exportedAt: new Date().toISOString(),
    recordCount: {
      messages: state.messages.length,
      journalEntries: state.journalEntries.length,
      agreements: state.agreements.length,
      lists: state.lists.length,
      chores: state.chores.length,
      expenses: state.expenses.length,
      quotes: state.quotes.length
    }
  };

  return JSON.stringify(envelope, null, 2);
}

export async function importVault(vaultJsonString: string, passphrase: string): Promise<SpaceState> {
  let envelope: EncryptedVaultEnvelope;
  try {
    envelope = JSON.parse(vaultJsonString);
  } catch {
    throw new Error('Invalid vault file format: JSON could not be parsed.');
  }

  if (envelope.format !== 'TWO_ENCRYPTED_VAULT') {
    throw new Error('Unrecognized vault format. Ensure this is a genuine .two-vault file.');
  }

  const salt = hexToBuffer(envelope.saltHex);
  const iv = hexToBuffer(envelope.ivHex);
  // Older files carry no count and were written at the legacy figure.
  const iterations =
    Number.isFinite(Number(envelope.iterations)) && Number(envelope.iterations) > 0
      ? Number(envelope.iterations)
      : LEGACY_PBKDF2_ITERATIONS;
  const key = await deriveKeyFromPassphrase(passphrase, salt, iterations);

  try {
    const ciphertext = base64ToArrayBuffer(envelope.ciphertextBase64);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const stateJson = dec.decode(decrypted);
    const restoredState = JSON.parse(stateJson) as SpaceState;

    if (!restoredState.messages || !Array.isArray(restoredState.messages)) {
      throw new Error('Corrupted state structure inside vault.');
    }

    return restoredState;
  } catch {
    throw new Error('Decryption failed. Incorrect backup passphrase or tampered vault file.');
  }
}

export function downloadVaultFile(content: string, filename: string = 'two-space-backup.two-vault') {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
