// End-to-End Encrypted Vault Export & Import Engine (.two-vault)
import { SpaceState } from './storage';

export interface EncryptedVaultEnvelope {
  version: string;
  format: 'TWO_ENCRYPTED_VAULT';
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

async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
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
      iterations: 100000,
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
  const key = await deriveKeyFromPassphrase(passphrase, salt);

  const payload = JSON.stringify(state);
  const enc = new TextEncoder();
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    enc.encode(payload)
  );

  const envelope: EncryptedVaultEnvelope = {
    version: '1.0',
    format: 'TWO_ENCRYPTED_VAULT',
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
  const key = await deriveKeyFromPassphrase(passphrase, salt);

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
