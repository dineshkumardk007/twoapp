// Photos, voice memos and saved sketches live here rather than in localStorage.
//
// localStorage holds about 5MB and is the same budget the entire vault shares.
// A voice memo is a few hundred KB once base64 has added its third, and a photo
// from a phone camera can be several MB on its own, so a couple of keepsakes
// could fill the store and every subsequent save would fail. IndexedDB has a
// quota measured in hundreds of megabytes or a share of free disk.
//
// What is persisted in localStorage is a short reference. What comes back out
// on load is the original data URL, not an object URL: several handlers
// rebroadcast a whole collection to the other device, and an object URL means
// nothing over there. Keeping the in-memory shape exactly as it was is what
// makes this change invisible to every component and to the relay.

const DB_NAME = 'two-media-v1';
const STORE = 'media';
const REF_PREFIX = 'two-media:';

/**
 * Only strings above this size are worth moving.
 *
 * Small inline SVGs and the like cost more in round trips than they save in
 * space, and a reference is itself about 30 bytes.
 */
const MIN_EXTERNALIZE_CHARS = 2048;

/**
 * Bytes already in the store, so re-saving does not rewrite them.
 *
 * A save runs on every change to the space. Without this, each one would treat
 * the same photo as new, hand it a fresh id and write another copy - so a long
 * session would leave dozens of identical images in IndexedDB, and only the
 * sweep at next startup would notice. Populated both when media is stored and
 * when it is read back, and it lives as long as the tab does.
 */
const knownMedia = new Map<string, string>();

/**
 * What a stored entry looks like.
 *
 * IndexedDB takes an ArrayBuffer directly, so the encrypted form is kept as raw
 * bytes: one byte per character of the data URL plus GCM's 16-byte tag. Coming
 * back through base64 to store it as a string would have added a third on top,
 * and localStorage would have charged two bytes per character on top of that.
 */
type StoredMedia =
  | { v: 1; data: string }
  | { v: 1; iv: number[]; ct: ArrayBuffer };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // A failed open must not be cached forever - private mode can refuse once and
  // allow later.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

export function isMediaRef(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(REF_PREFIX);
}

function refToId(ref: string): string {
  return ref.slice(REF_PREFIX.length);
}

function shouldExternalize(value: string): boolean {
  return value.startsWith('data:') && value.length >= MIN_EXTERNALIZE_CHARS;
}

/**
 * Rebuilds a value, applying `fn` to every string inside it.
 *
 * Deliberately generic: the media fields are spread across a dozen record types
 * under several different names (photoUrl, photoUrls, dataUrl, audio...), and a
 * walker that does not need to know them cannot be left behind when a new one
 * is added. Anything that is not a plain object or array is passed through
 * untouched, so Dates and the like survive.
 */
function mapStrings(value: any, fn: (s: string) => string): any {
  if (typeof value === 'string') return fn(value);

  // The common case by a wide margin - numbers in stroke coordinates - so it is
  // worth answering before anything more expensive.
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    let changed = false;
    const out = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      out[i] = mapStrings(value[i], fn);
      if (out[i] !== value[i]) changed = true;
    }
    return changed ? out : value;
  }

  let changed = false;
  const out: Record<string, any> = {};
  for (const key of Object.keys(value)) {
    out[key] = mapStrings(value[key], fn);
    if (out[key] !== value[key]) changed = true;
  }
  return changed ? out : value;
}

/** True if anything in here still needs fetching before it can be shown. */
export function containsMediaRefs(value: any): boolean {
  if (typeof value === 'string') return isMediaRef(value);
  if (value === null || typeof value !== 'object') return false;

  if (Array.isArray(value)) {
    for (const item of value) if (containsMediaRefs(item)) return true;
    return false;
  }
  for (const key of Object.keys(value)) {
    if (containsMediaRefs(value[key])) return true;
  }
  return false;
}

export interface Externalized<T> {
  /** The same value with heavy media swapped for references. */
  value: T;
  /** Bytes that must reach IndexedDB for those references to resolve. */
  writes: Array<{ id: string; dataUrl: string }>;
}

/**
 * Swaps large data URLs for references, collecting the bytes to be written.
 *
 * The same data URL appearing twice - the identical photo on a timeline entry
 * and a scrapbook page - resolves to one reference and one write.
 */
export function externalizeMedia<T>(value: T, nextId: () => string): Externalized<T> {
  const writes: Array<{ id: string; dataUrl: string }> = [];

  const out = mapStrings(value, (s: string) => {
    if (!shouldExternalize(s)) return s;

    // Already stored, this save or an earlier one: reuse the id and write
    // nothing.
    const known = knownMedia.get(s);
    if (known) return REF_PREFIX + known;

    const id = nextId();
    knownMedia.set(s, id);
    writes.push({ id, dataUrl: s });
    return REF_PREFIX + id;
  });

  return { value: out, writes };
}

/**
 * Writes the bytes behind a set of references. Failures are not fatal.
 *
 * When a key is given the bytes are encrypted with it, because a space with a
 * PIN keeps its vault encrypted at rest and moving photos to another store must
 * not quietly exempt them from that. The id is bound in as additional data, so
 * an entry cannot be swapped for another one under a different id.
 */
export async function persistMedia(
  writes: Array<{ id: string; dataUrl: string }>,
  key?: CryptoKey | null
): Promise<void> {
  for (const { id, dataUrl } of writes) {
    try {
      const record: StoredMedia = key
        ? await encryptEntry(id, dataUrl, key)
        : { v: 1, data: dataUrl };
      await tx('readwrite', store => store.put(record, id));
    } catch (e) {
      console.error('[Media] Could not store', id, e);
      // Do not leave a claim we did not honour: the next save should try again
      // rather than hand out a reference to bytes that never landed.
      knownMedia.delete(dataUrl);
    }
  }
}

async function encryptEntry(id: string, dataUrl: string, key: CryptoKey): Promise<StoredMedia> {
  const iv = new Uint8Array(new ArrayBuffer(12));
  window.crypto.getRandomValues(iv);

  const ct = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) },
    key,
    new TextEncoder().encode(dataUrl)
  );

  // Kept as a plain array: twelve numbers cost nothing, and it avoids
  // handing a possibly-shared buffer back to subtle.decrypt later.
  return { v: 1, iv: Array.from(iv), ct };
}

async function decryptEntry(id: string, record: StoredMedia, key: CryptoKey | null | undefined): Promise<string> {
  if (!('ct' in record)) return record.data;

  // Encrypted, and the key that would open it is not in hand. Better an empty
  // frame than a crash.
  if (!key) return '';

  try {
    const iv = new Uint8Array(new ArrayBuffer(record.iv.length));
    iv.set(record.iv);

    const plain = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(id) },
      key,
      record.ct
    );
    return new TextDecoder().decode(plain);
  } catch {
    return '';
  }
}

/**
 * Resolves every reference back to its data URL.
 *
 * A reference whose bytes have gone - storage cleared, or a device that only
 * ever received the reference - resolves to an empty string rather than being
 * left as `two-media:...`, so an <img> renders as nothing instead of trying to
 * fetch a URL that means nothing to the browser.
 */
export async function hydrateMedia<T>(value: T, key?: CryptoKey | null): Promise<T> {
  if (!containsMediaRefs(value)) return value;

  const wanted = new Set<string>();
  mapStrings(value, s => {
    if (isMediaRef(s)) wanted.add(refToId(s));
    return s;
  });

  const resolved = new Map<string, string>();
  for (const id of wanted) {
    try {
      const stored = await tx<StoredMedia | string | undefined>('readonly', store => store.get(id));

      // A bare string is an entry written before media was given an envelope.
      const dataUrl =
        typeof stored === 'string'
          ? stored
          : stored
          ? await decryptEntry(id, stored, key)
          : '';

      resolved.set(id, dataUrl);

      // Remember what these bytes are already called, so the next save does not
      // store a second copy of them under a new id.
      if (dataUrl) knownMedia.set(dataUrl, id);
    } catch {
      resolved.set(id, '');
    }
  }

  return mapStrings(value, s => (isMediaRef(s) ? resolved.get(refToId(s)) ?? '' : s));
}

/**
 * Drops stored media nothing refers to any more.
 *
 * Deleting a photo removes it from the vault but cannot reach into IndexedDB
 * from wherever that happened, so the bytes would sit there forever. Run once
 * after load, when the set of live references is known and settled.
 */
export async function collectMediaGarbage(liveValue: unknown): Promise<number> {
  const live = new Set<string>();
  mapStrings(liveValue, s => {
    if (isMediaRef(s)) live.add(refToId(s));
    return s;
  });

  try {
    const keys = await tx<IDBValidKey[]>('readonly', store => store.getAllKeys());
    let removed = 0;
    for (const key of keys) {
      if (typeof key !== 'string' || live.has(key)) continue;
      await tx('readwrite', store => store.delete(key));
      removed++;
    }
    return removed;
  } catch {
    return 0;
  }
}

/** Bytes IndexedDB is holding, for the storage readout in Settings. */
export async function estimateMediaBytes(): Promise<number> {
  try {
    const keys = await tx<IDBValidKey[]>('readonly', store => store.getAllKeys());
    let total = 0;
    for (const key of keys) {
      const value = await tx<StoredMedia | string | undefined>('readonly', store =>
        store.get(key as string)
      );
      if (typeof value === 'string') total += value.length;
      else if (value && 'ct' in value) total += value.ct.byteLength;
      else if (value) total += value.data.length;
    }
    return total;
  } catch {
    return 0;
  }
}

/** Removes everything. Used when the space is wiped. */
export async function clearMedia(): Promise<void> {
  knownMedia.clear();
  try {
    await tx('readwrite', store => store.clear());
  } catch {
    /* nothing stored, or no IndexedDB - either way there is nothing to clear */
  }
}
