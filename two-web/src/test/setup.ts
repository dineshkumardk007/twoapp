// What the code under test expects of a browser, and nothing more.
//
// The modules here read `window.crypto`, `window.AndroidBridge` and
// localStorage. Node has WebCrypto, atob/btoa and TextEncoder already; the
// window is simply the global object, and storage is a Map that starts empty
// for every test.

import { beforeEach } from 'vitest';

class MemoryStorage implements Storage {
  private items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  clear() {
    this.items.clear();
  }

  getItem(key: string) {
    return this.items.has(key) ? (this.items.get(key) as string) : null;
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true, writable: true });

beforeEach(() => {
  storage.clear();
  delete (globalThis as { AndroidBridge?: unknown }).AndroidBridge;
  delete (globalThis as { __twoFingerprint?: unknown }).__twoFingerprint;
  delete (globalThis as { __twoUpdate?: unknown }).__twoUpdate;
});
