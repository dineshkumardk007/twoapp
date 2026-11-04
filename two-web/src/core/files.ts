// Files in the chat, like a messenger's documents (components/FileBubble).
//
// A file never goes through the relay. The sending phone cuts it into pieces
// of FILE_PART_BYTES, seals each with AES-GCM under a key made for that file
// alone, and puts the sealed pieces in the relay's files bucket itself, with
// links the relay makes for phones in the space (two-server files.ts). The
// chat message carries what the other phone needs - name, size, type, the
// key, and a fingerprint of the whole file - and, like every message, is
// itself end-to-end encrypted: the relay and the bucket only ever hold
// ciphertext they have no key to.
//
// The other phone fetches the pieces, opens each (GCM refuses a piece that
// is not exactly what was sealed), works out the same fingerprint, and calls
// the file its own only when it matches: an exact copy, or none. Every piece
// is kept here sealed, as it travelled - a file is opened only when it is
// opened, saved or shared - so a dropped connection resumes from the next
// piece, on either side, even after Two has been closed.
//
// The bucket keeps a file for 30 days; each phone keeps its own copy.

import { wsRelay } from './ws';

/** One piece: 4 MiB of the file, sealed. */
export const FILE_PART_BYTES = 4 * 1024 * 1024;
/** The largest file that can be sent. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
/** Fetched by itself when it arrives, up to this size; a bigger one waits for a tap. */
export const AUTO_FETCH_BYTES = 25 * 1024 * 1024;
/** How long the bucket keeps a file (two-server files.ts). */
export const FILE_KEPT_DAYS = 30;
/** Said by the sending phone once every piece is in the bucket: { id }. */
export const CHAT_FILE_READY = 'CHAT_FILE_READY';

/** What a chat message says of its file. */
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  mime: string;
  parts: number;
  /** The file's own AES-GCM key, base64: inside the encrypted message, nowhere else. */
  key: string;
  /** SHA-256 over each piece's SHA-256, hex: what an exact copy adds up to. */
  sha: string;
  /** A small picture of a photo or a video, as a JPEG data URL. */
  thumb?: string;
}

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const MIME_RE = /^[a-z0-9][\w.+-]*\/[\w.+-]+$/i;
const MAX_THUMB_CHARS = 60_000;

/** A name fit to show and to save under: no path, no control characters, not too long. */
export function cleanFileName(raw: unknown): string {
  const name = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 160);
  return name && name !== '.' && name !== '..' ? name : 'file';
}

export const partsFor = (size: number) => Math.max(1, Math.ceil(size / FILE_PART_BYTES));

/** A file as it came from the other phone, checked; none if anything is off. */
export function cleanFileInfo(raw: unknown): FileInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const size = Number(r.size);
  const parts = Number(r.parts);
  if (typeof r.id !== 'string' || !ID_RE.test(r.id)) return undefined;
  if (!Number.isInteger(size) || size < 1 || size > MAX_FILE_BYTES || parts !== partsFor(size)) return undefined;
  if (typeof r.key !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(r.key)) return undefined;
  if (typeof r.sha !== 'string' || !/^[0-9a-f]{64}$/.test(r.sha)) return undefined;
  const mime = typeof r.mime === 'string' && MIME_RE.test(r.mime) && r.mime.length <= 100 ? r.mime.toLowerCase() : 'application/octet-stream';
  const thumb =
    typeof r.thumb === 'string' && r.thumb.length <= MAX_THUMB_CHARS && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.thumb) ? r.thumb : undefined;
  return { id: r.id, name: cleanFileName(r.name), size, mime, parts, key: r.key, sha: r.sha, ...(thumb ? { thumb } : {}) };
}

/** What kind of file it is, for its icon and colour. */
export type FileKind = 'pdf' | 'doc' | 'sheet' | 'slides' | 'zip' | 'image' | 'video' | 'audio' | 'text' | 'app' | 'other';

export function fileKind(info: Pick<FileInfo, 'name' | 'mime'>): FileKind {
  const ext = info.name.toLowerCase().split('.').pop() || '';
  const m = info.mime;
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (/^(docx?|odt|rtf|pages)$/.test(ext) || m.includes('wordprocessing') || m === 'application/msword') return 'doc';
  if (/^(xlsx?|ods|csv|numbers)$/.test(ext) || m.includes('spreadsheet') || m.includes('excel')) return 'sheet';
  if (/^(pptx?|odp|key)$/.test(ext) || m.includes('presentation') || m.includes('powerpoint')) return 'slides';
  if (/^(zip|rar|7z|tar|gz|tgz)$/.test(ext) || /zip|compressed|x-tar|x-7z|x-rar/.test(m)) return 'zip';
  if (ext === 'apk' || m === 'application/vnd.android.package-archive') return 'app';
  if (m.startsWith('text/') || /^(txt|md|json|log|xml|html?)$/.test(ext)) return 'text';
  return 'other';
}

/** "512 B", "48 KB", "12.4 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** The short type under a file's name: "PDF", "DOCX", or the kind. */
export function typeLabel(info: Pick<FileInfo, 'name' | 'mime'>): string {
  const ext = info.name.includes('.') ? info.name.split('.').pop()!.toUpperCase() : '';
  return ext && ext.length <= 5 ? ext : fileKind(info) === 'other' ? 'FILE' : fileKind(info).toUpperCase();
}

// ---- Sealing -------------------------------------------------------------

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

/** A new key for one file, and the same as base64 for its message. */
export async function newFileKey(): Promise<{ key: CryptoKey; text: string }> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  return { key, text: toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key))) };
}

export const importFileKey = (text: string) => crypto.subtle.importKey('raw', fromBase64(text), 'AES-GCM', false, ['decrypt']);

/** A piece sealed: its own random 12-byte nonce, then the ciphertext and GCM's tag. */
export async function sealPart(key: CryptoKey, plain: ArrayBuffer): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out.buffer;
}

/** A piece opened - or an error, if it is not exactly what was sealed. */
export async function openPart(key: CryptoKey, sealed: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(sealed);
  if (bytes.length < 12 + 16) throw new Error('short-piece');
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
}

/** The fingerprint of a whole file, from its pieces' own SHA-256s in order. */
export async function fingerprint(partHashes: ArrayBuffer[]): Promise<string> {
  const all = new Uint8Array(partHashes.length * 32);
  partHashes.forEach((h, i) => all.set(new Uint8Array(h), i * 32));
  return hex(await crypto.subtle.digest('SHA-256', all));
}

// ---- Kept here: the sealed pieces ---------------------------------------

const DB_NAME = 'two-files-v1';
const STORE = 'parts';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

async function inStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const partKey = (id: string, i: number) => `${id}/${i}`;
const putPart = (id: string, i: number, sealed: ArrayBuffer) => inStore('readwrite', s => s.put(sealed, partKey(id, i)));
const getPart = (id: string, i: number) => inStore<ArrayBuffer | undefined>('readonly', s => s.get(partKey(id, i)));
async function dropParts(id: string, parts: number): Promise<void> {
  for (let i = 0; i < parts; i++) await inStore('readwrite', s => s.delete(partKey(id, i)));
}

// ---- What this phone knows of each file ---------------------------------

/**
 * Kept in localStorage, small: the files this phone holds whole, those whose
 * sender has said they are all in the bucket, and its own still going up -
 * no keys, which stay in the (encrypted) messages.
 */
interface Book {
  have: string[];
  ready: string[];
  sending: Record<string, { parts: number; size: number; up: number[] }>;
}
const BOOK_KEY = 'two_files_v1';
let book: Book = loadBook();

function loadBook(): Book {
  try {
    const raw = JSON.parse(localStorage.getItem(BOOK_KEY) || '{}');
    return {
      have: Array.isArray(raw.have) ? raw.have.filter((x: unknown) => typeof x === 'string') : [],
      ready: Array.isArray(raw.ready) ? raw.ready.filter((x: unknown) => typeof x === 'string') : [],
      sending: raw.sending && typeof raw.sending === 'object' ? raw.sending : {}
    };
  } catch {
    return { have: [], ready: [], sending: {} };
  }
}

function saveBook() {
  book.have = book.have.slice(-2000);
  book.ready = book.ready.slice(-500);
  try {
    localStorage.setItem(BOOK_KEY, JSON.stringify(book));
  } catch {
    /* private mode or full: still right for this session */
  }
}

export const haveFile = (id: string) => book.have.includes(id);
export const isFileReady = (id: string) => book.ready.includes(id);

/** The sender has said every piece is in the bucket (CHAT_FILE_READY). */
export function markFileReady(id: string) {
  if (!ID_RE.test(id) || book.ready.includes(id)) return;
  book.ready.push(id);
  saveBook();
  emit(id);
}

// ---- What each file is doing now, for its bubble ------------------------

export type FilePhase = 'idle' | 'preparing' | 'uploading' | 'sent' | 'downloading' | 'done' | 'waiting' | 'missing' | 'failed';
export interface FileStatus {
  phase: FilePhase;
  /** Bytes of the file moved so far, of `total`. */
  done: number;
  total: number;
  /** Bytes a second, while moving. */
  speed?: number;
  /** Why it failed: 'too-big', 'mismatch', 'offline', 'files-off'... */
  error?: string;
}

const statuses = new Map<string, FileStatus>();
const listeners = new Map<string, Set<() => void>>();

function emit(id: string) {
  listeners.get(id)?.forEach(fn => fn());
}
function setStatus(id: string, status: FileStatus) {
  statuses.set(id, status);
  emit(id);
}

/** Where a file stands on this phone. */
export function fileStatus(info: Pick<FileInfo, 'id' | 'size'>, mine: boolean): FileStatus {
  const now = statuses.get(info.id);
  if (now) return now;
  if (mine) return { phase: book.sending[info.id] ? 'uploading' : 'sent', done: 0, total: info.size };
  return { phase: haveFile(info.id) ? 'done' : 'idle', done: haveFile(info.id) ? info.size : 0, total: info.size };
}

export function subscribeFile(id: string, fn: () => void): () => void {
  let set = listeners.get(id);
  if (!set) listeners.set(id, (set = new Set()));
  set.add(fn);
  return () => set!.delete(fn);
}

/** Progress, with speed over the last few seconds. */
function meter(id: string, phase: FilePhase, total: number) {
  let done = 0;
  const samples: [number, number][] = [];
  return (bytes: number) => {
    done = Math.min(total, bytes);
    const now = performance.now();
    samples.push([now, done]);
    while (samples.length > 2 && now - samples[0][0] > 3000) samples.shift();
    const [t0, b0] = samples[0];
    const speed = now - t0 > 300 ? ((done - b0) / (now - t0)) * 1000 : undefined;
    setStatus(id, { phase, done, total, speed });
  };
}

// ---- Moving pieces ------------------------------------------------------

/** One request with progress: a piece up (PUT) or down (GET). */
function transfer(method: 'PUT' | 'GET', url: string, body: ArrayBuffer | null, onBytes: (n: number) => void): Promise<ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.timeout = 120_000;
    if (method === 'PUT') {
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.upload.onprogress = e => onBytes(e.loaded);
    } else {
      xhr.responseType = 'arraybuffer';
      xhr.onprogress = e => onBytes(e.loaded);
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(method === 'GET' ? (xhr.response as ArrayBuffer) : null);
      else reject(Object.assign(new Error(`http-${xhr.status}`), { status: xhr.status }));
    };
    xhr.onerror = () => reject(new Error('network'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.send(body);
  });
}

const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Tries a piece up to three times, a little longer apart each time. */
async function withRetries<T>(run: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await run();
    } catch (err) {
      last = err;
      // A link refused (expired or wrong) is not fixed by asking again with it.
      const status = (err as { status?: number }).status;
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) break;
      await pause(1000 * 3 ** attempt);
    }
  }
  throw last;
}

const going = new Map<string, Promise<void>>();
/** One move per file at a time: tapping twice, or a resume while it is already going, joins it. */
function once(id: string, run: () => Promise<void>): Promise<void> {
  const already = going.get(id);
  if (already) return already;
  const p = run().finally(() => going.delete(id));
  going.set(id, p);
  return p;
}

// ---- Sending ------------------------------------------------------------

export class FileTooBigError extends Error {}

/** A small picture of a photo or a video, for its bubble: at most 240 pixels, a JPEG. */
async function thumbnailOf(file: File): Promise<string | undefined> {
  try {
    let source: CanvasImageSource;
    let w: number;
    let h: number;
    const url = URL.createObjectURL(file);
    try {
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.src = url;
        await img.decode();
        source = img;
        w = img.naturalWidth;
        h = img.naturalHeight;
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.muted = true;
        video.preload = 'metadata';
        video.src = url;
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error('video'));
          setTimeout(() => reject(new Error('slow')), 4000);
        });
        video.currentTime = Math.min(1, (video.duration || 2) / 4);
        await new Promise<void>(resolve => {
          video.onseeked = () => resolve();
          setTimeout(resolve, 1500);
        });
        source = video;
        w = video.videoWidth;
        h = video.videoHeight;
      } else {
        return undefined;
      }
      if (!w || !h) return undefined;
      const scale = Math.min(1, 240 / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', 0.7);
      return data.length <= MAX_THUMB_CHARS ? data : undefined;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return undefined;
  }
}

/**
 * Sends a file: sealed here piece by piece (kept, so it can go up again
 * after a drop), its message handed to `onMessage` at once - its bubble shows
 * it going up - then every piece put in the bucket, and `onReady` called
 * once all are there.
 */
export async function sendFile(file: File, onMessage: (info: FileInfo) => void, onReady: (id: string) => void): Promise<void> {
  if (file.size > MAX_FILE_BYTES) throw new FileTooBigError();
  if (file.size < 1) throw new Error('empty');
  const id = `fl${Date.now().toString(36)}${toBase64(crypto.getRandomValues(new Uint8Array(9))).replace(/[+/=]/g, '')}`;
  const parts = partsFor(file.size);
  const { key, text } = await newFileKey();
  const preparing = meter(id, 'preparing', file.size);
  preparing(0);
  const hashes: ArrayBuffer[] = [];
  for (let i = 0; i < parts; i++) {
    const plain = await file.slice(i * FILE_PART_BYTES, (i + 1) * FILE_PART_BYTES).arrayBuffer();
    hashes.push(await crypto.subtle.digest('SHA-256', plain));
    await putPart(id, i, await sealPart(key, plain));
    preparing(Math.min(file.size, (i + 1) * FILE_PART_BYTES));
  }
  const thumb = await thumbnailOf(file);
  const info: FileInfo = {
    id,
    name: cleanFileName(file.name),
    size: file.size,
    mime: file.type && MIME_RE.test(file.type) ? file.type.toLowerCase() : 'application/octet-stream',
    parts,
    key: text,
    sha: await fingerprint(hashes),
    ...(thumb ? { thumb } : {})
  };
  book.have.push(id);
  book.sending[id] = { parts, size: file.size, up: [] };
  saveBook();
  onMessage(info);
  await upload(id, onReady);
}

/** Puts a file's pieces still to go in the bucket, from what is kept here. */
function upload(id: string, onReady: (id: string) => void): Promise<void> {
  return once(id, async () => {
    const pending = book.sending[id];
    if (!pending) return;
    const total = pending.size;
    const progress = meter(id, 'uploading', total);
    const sizeOf = (i: number) => Math.min(FILE_PART_BYTES, total - i * FILE_PART_BYTES);
    let base = pending.up.reduce((sum, i) => sum + sizeOf(i), 0);
    progress(base);
    try {
      const urls = await wsRelay.fileLinks('put', id, pending.parts, total);
      for (let i = 0; i < pending.parts; i++) {
        if (pending.up.includes(i)) continue;
        const sealed = await getPart(id, i);
        if (!sealed) throw new Error('lost-piece');
        // Its sealed bytes include a nonce and a tag; progress counts the file's own.
        await withRetries(() => transfer('PUT', urls[i], sealed, n => progress(base + Math.min(sizeOf(i), n))));
        base += sizeOf(i);
        pending.up.push(i);
        saveBook();
        progress(base);
      }
      delete book.sending[id];
      saveBook();
      setStatus(id, { phase: 'sent', done: total, total });
      onReady(id);
    } catch (err) {
      setStatus(id, { phase: 'failed', done: base, total, error: (err as Error).message });
    }
  });
}

/** Tries again: one that failed going up, or (on starting) any left half-way. */
export function resumeUploads(onReady: (id: string) => void, only?: string) {
  for (const id of Object.keys(book.sending)) if (!only || id === only) void upload(id, onReady);
}

export const isUploading = (id: string) => !!book.sending[id];

// ---- Fetching -----------------------------------------------------------

/**
 * Fetches a file's pieces from the bucket - those not already here - opens
 * each to check it, and calls the file this phone's only if the whole of it
 * adds up to the fingerprint its message gave.
 */
export function fetchFile(info: FileInfo): Promise<void> {
  if (haveFile(info.id)) return Promise.resolve();
  return once(info.id, async () => {
    const total = info.size;
    const sizeOf = (i: number) => Math.min(FILE_PART_BYTES, total - i * FILE_PART_BYTES);
    const progress = meter(info.id, 'downloading', total);
    let base = 0;
    progress(0);
    try {
      const key = await importFileKey(info.key);
      const hashes: ArrayBuffer[] = [];
      let urls: string[] | null = null;
      for (let i = 0; i < info.parts; i++) {
        let sealed = await getPart(info.id, i);
        let plain: ArrayBuffer | null = null;
        if (sealed) {
          try {
            plain = await openPart(key, sealed);
          } catch {
            sealed = undefined;
          }
        }
        if (!plain) {
          if (!urls) urls = await wsRelay.fileLinks('get', info.id, info.parts);
          // No link: the bucket does not have it - not there yet, or let go.
          if (!urls[i]) {
            setStatus(info.id, { phase: isFileReady(info.id) ? 'missing' : 'waiting', done: base, total });
            return;
          }
          const url = urls[i];
          const got = await withRetries(() => transfer('GET', url, null, n => progress(base + Math.min(sizeOf(i), n * (sizeOf(i) / (sizeOf(i) + 28))))));
          plain = await openPart(key, got!);
          await putPart(info.id, i, got!);
        }
        hashes.push(await crypto.subtle.digest('SHA-256', plain));
        base += sizeOf(i);
        progress(base);
      }
      if ((await fingerprint(hashes)) !== info.sha) {
        await dropParts(info.id, info.parts);
        setStatus(info.id, { phase: 'failed', done: 0, total, error: 'mismatch' });
        return;
      }
      book.have.push(info.id);
      saveBook();
      setStatus(info.id, { phase: 'done', done: total, total });
    } catch (err) {
      const status = (err as { status?: number }).status;
      setStatus(info.id, {
        phase: status === 400 || status === 404 ? (isFileReady(info.id) ? 'missing' : 'waiting') : 'failed',
        done: base,
        total,
        error: (err as Error).message
      });
    }
  });
}

/** Whether a file is fetched by itself when it arrives: not too big, and not past the bucket's days. */
export const fetchesByItself = (info: FileInfo, sentAt?: number) =>
  info.size <= AUTO_FETCH_BYTES && (!sentAt || Date.now() - sentAt < FILE_KEPT_DAYS * 24 * 60 * 60 * 1000);

/** Takes a file of yours out of the bucket: its message has been unsent. */
export async function forgetRemote(info: FileInfo): Promise<void> {
  try {
    await wsRelay.fileLinks('delete', info.id, info.parts);
  } catch {
    /* gone in 30 days regardless */
  }
}

// ---- Opening, saving, sharing ------------------------------------------

/** The whole file, opened, from the pieces kept here. */
export async function fileBlob(info: FileInfo): Promise<Blob> {
  const key = await importFileKey(info.key);
  const plains: ArrayBuffer[] = [];
  for (let i = 0; i < info.parts; i++) {
    const sealed = await getPart(info.id, i);
    if (!sealed) throw new Error('not-here');
    plains.push(await openPart(key, sealed));
  }
  return new Blob(plains, { type: info.mime });
}

type FileBridge = {
  fileBegin?: (name: string, mime: string) => string;
  fileWrite?: (handle: string, base64: string) => boolean;
  fileDone?: (handle: string, action: string) => boolean;
};
const bridge = (): FileBridge | null => (window as unknown as { AndroidBridge?: FileBridge }).AndroidBridge ?? null;

/**
 * To the phone (Android), in pieces small enough for one call each: opened
 * in the app it belongs to, shared, or saved to Downloads.
 */
async function handToPhone(info: FileInfo, blob: Blob, action: 'open' | 'share' | 'save'): Promise<boolean> {
  const b = bridge();
  if (!b?.fileBegin || !b.fileWrite || !b.fileDone) return false;
  const handle = b.fileBegin(info.name, info.mime);
  if (!handle) return false;
  const step = 768 * 1024;
  for (let at = 0; at < blob.size; at += step) {
    const bytes = new Uint8Array(await blob.slice(at, at + step).arrayBuffer());
    if (!b.fileWrite(handle, toBase64(bytes))) return false;
  }
  return b.fileDone(handle, action);
}

/** Opens it in the app it belongs to - on a computer, in a new tab. */
export async function openFile(info: FileInfo): Promise<boolean> {
  const blob = await fileBlob(info);
  if (bridge()?.fileBegin) return handToPhone(info, blob, 'open');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Saves a copy: to Downloads on the phone, a download on a computer. */
export async function saveFileCopy(info: FileInfo): Promise<boolean> {
  const blob = await fileBlob(info);
  if (bridge()?.fileBegin) return handToPhone(info, blob, 'save');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = info.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Shares it to another app. */
export async function shareFile(info: FileInfo): Promise<boolean> {
  const blob = await fileBlob(info);
  if (bridge()?.fileBegin) return handToPhone(info, blob, 'share');
  const file = new File([blob], info.name, { type: info.mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file] });
    return true;
  }
  return saveFileCopy(info);
}
