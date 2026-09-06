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
  const assigned = new Map<string, string>();

  const out = mapStrings(value, (s: string) => {
    if (!shouldExternalize(s)) return s;

    const existing = assigned.get(s);
    if (existing) return existing;

    const id = nextId();
    const ref = REF_PREFIX + id;
    assigned.set(s, ref);
    writes.push({ id, dataUrl: s });
    return ref;
  });

  return { value: out, writes };
}

/** Writes the bytes behind a set of references. Failures are not fatal. */
export async function persistMedia(writes: Array<{ id: string; dataUrl: string }>): Promise<void> {
  for (const { id, dataUrl } of writes) {
    try {
      await tx('readwrite', store => store.put(dataUrl, id));
    } catch (e) {
      console.error('[Media] Could not store', id, e);
    }
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
export async function hydrateMedia<T>(value: T): Promise<T> {
  if (!containsMediaRefs(value)) return value;

  const wanted = new Set<string>();
  mapStrings(value, s => {
    if (isMediaRef(s)) wanted.add(refToId(s));
    return s;
  });

  const resolved = new Map<string, string>();
  for (const id of wanted) {
    try {
      const stored = await tx<string | undefined>('readonly', store => store.get(id));
      resolved.set(id, typeof stored === 'string' ? stored : '');
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
      const value = await tx<string | undefined>('readonly', store => store.get(key as string));
      if (typeof value === 'string') total += value.length;
    }
    return total;
  } catch {
    return 0;
  }
}

/** Removes everything. Used when the space is wiped. */
export async function clearMedia(): Promise<void> {
  try {
    await tx('readwrite', store => store.clear());
  } catch {
    /* nothing stored, or no IndexedDB - either way there is nothing to clear */
  }
}
