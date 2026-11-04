// Files shared in the chat (two-web core/files), kept for a while in a
// private Supabase Storage bucket.
//
// The relay never carries a file's bytes: the phones put them in the bucket
// and take them out themselves, with links only this server can make - and
// makes only for a phone that has joined the space the file belongs to. What
// goes into the bucket is ciphertext, cut into pieces, each sealed on the
// phone with a key that travels inside the (end-to-end encrypted) chat
// message and nowhere else. Neither this server nor Supabase can open one.
//
// Kept for FILE_DAYS, and within FILE_BUDGET_BYTES altogether: the phones
// keep their own copies of every file they have, so what is let go here is
// only what a phone set up again can no longer fetch.

/** One piece of a file, as the phone cuts it: 4 MiB of the file, sealed. */
export const FILE_PART_BYTES = 4 * 1024 * 1024;
/** The largest file: 25 pieces. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
/** How long the bucket keeps a file. */
const FILE_DAYS = 30;
/** All files together, newest first, up to this much: inside the free plan's 1 GB. */
const FILE_BUDGET_BYTES = 900 * 1024 * 1024;
/** How long a link to fetch a piece lasts. A link to upload one lasts the two hours Supabase gives it. */
const GET_LINK_SECONDS = 60 * 60;

const BUCKET = process.env.FILES_BUCKET || 'two-files';
const FILE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SPACE_RE = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Where the bucket is: SUPABASE_URL if it is set, or else the project the
 * database is in - its host (db.<ref>.supabase.co) or, through the pooler,
 * its user (postgres.<ref>).
 */
function projectUrl(): string | null {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL.replace(/\/+$/, '');
  const db = process.env.DATABASE_URL;
  if (!db) return null;
  try {
    const url = new URL(db);
    const host = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (host) return `https://${host[1]}.supabase.co`;
    const user = decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]+)$/);
    if (user && url.hostname.endsWith('pooler.supabase.com')) return `https://${user[1]}.supabase.co`;
  } catch {
    /* not a URL: no bucket */
  }
  return null;
}

const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BASE = projectUrl();

/** Whether files can be shared at all: a bucket to keep them in, and the key to it. */
export const filesConfigured = (): boolean => !!(BASE && KEY);

function headers(json = true): Record<string, string> {
  return {
    apikey: KEY,
    // A legacy service_role key is a JWT, and goes here too; a newer secret key rides in apikey alone.
    ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}),
    ...(json ? { 'Content-Type': 'application/json' } : {})
  };
}

async function storage(path: string, init: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}/storage/v1${path}`, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`storage ${init.method || 'GET'} ${path.split('?')[0]}: ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/** The pieces of one file, in the bucket: <space>/<file>/<n>. */
function partPaths(spaceId: string, fileId: string, parts: number): string[] {
  return Array.from({ length: parts }, (_, i) => `${spaceId}/${fileId}/${i}`);
}

/** Makes the bucket if it is not there: private, and no piece bigger than a piece. */
export async function ensureBucket(): Promise<void> {
  if (!filesConfigured()) return;
  try {
    await storage(`/bucket/${BUCKET}`, { headers: headers(false) });
  } catch {
    await storage('/bucket', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: FILE_PART_BYTES + 64 * 1024 })
    });
    console.log(`[Files] Made the private bucket "${BUCKET}"`);
  }
}

export type FileSignRequest = { op: unknown; fileId: unknown; parts: unknown; size?: unknown };

/**
 * Links for one file's pieces, for a phone in `spaceId`: to put each one in
 * ('put', checked against the file's size), to fetch each one ('get'), or
 * none, having taken them all away ('delete' - a message unsent).
 */
export async function signFile(spaceId: string, req: FileSignRequest): Promise<{ urls?: string[]; error?: string }> {
  if (!filesConfigured()) return { error: 'files-off' };
  const fileId = typeof req.fileId === 'string' ? req.fileId : '';
  const parts = Number(req.parts);
  if (!SPACE_RE.test(spaceId) || !FILE_ID_RE.test(fileId) || !Number.isInteger(parts) || parts < 1 || parts > MAX_FILE_BYTES / FILE_PART_BYTES) {
    return { error: 'bad-request' };
  }
  const paths = partPaths(spaceId, fileId, parts);
  if (req.op === 'put') {
    const size = Number(req.size);
    if (!Number.isFinite(size) || size < 1 || size > MAX_FILE_BYTES || Math.ceil(size / FILE_PART_BYTES) !== parts) return { error: 'too-big' };
    const urls = await Promise.all(
      paths.map(async path => {
        // Upsert: a piece sent again after a dropped connection takes its own place.
        const signed = await storage(`/object/upload/sign/${BUCKET}/${path}`, { method: 'POST', headers: { ...headers(), 'x-upsert': 'true' }, body: '{}' });
        return `${BASE}/storage/v1${signed.url}`;
      })
    );
    return { urls };
  }
  if (req.op === 'get') {
    const signed: Array<{ signedURL?: string | null; error?: string | null }> = await storage(`/object/sign/${BUCKET}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ expiresIn: GET_LINK_SECONDS, paths })
    });
    // A piece the bucket does not have (never sent, or let go) has no link: ''.
    return { urls: signed.map(s => (s.signedURL ? `${BASE}/storage/v1${s.signedURL}` : '')) };
  }
  if (req.op === 'delete') {
    await removePaths(paths);
    return { urls: [] };
  }
  return { error: 'bad-request' };
}

async function removePaths(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    await storage(`/object/${BUCKET}`, { method: 'DELETE', headers: headers(), body: JSON.stringify({ prefixes: paths.slice(i, i + 100) }) });
  }
}

/** What the bucket holds, piece by piece - from the database the bucket keeps its list in. */
export type StoredPiece = { name: string; createdAt: number; size: number };

/**
 * Lets go of files older than FILE_DAYS, and of the oldest past
 * FILE_BUDGET_BYTES - a whole file at a time, never half of one.
 */
export async function sweepFiles(listPieces: (bucket: string) => Promise<StoredPiece[]>): Promise<number> {
  if (!filesConfigured()) return 0;
  const pieces = await listPieces(BUCKET);
  const files = new Map<string, { newest: number; bytes: number; paths: string[] }>();
  for (const p of pieces) {
    const folder = p.name.split('/').slice(0, 2).join('/');
    const file = files.get(folder) || { newest: 0, bytes: 0, paths: [] };
    file.newest = Math.max(file.newest, p.createdAt);
    file.bytes += p.size;
    file.paths.push(p.name);
    files.set(folder, file);
  }
  const cutoff = Date.now() - FILE_DAYS * 24 * 60 * 60 * 1000;
  let kept = 0;
  const gone: string[] = [];
  let removed = 0;
  for (const file of [...files.values()].sort((a, b) => b.newest - a.newest)) {
    if (file.newest < cutoff || kept + file.bytes > FILE_BUDGET_BYTES) {
      gone.push(...file.paths);
      removed++;
    } else {
      kept += file.bytes;
    }
  }
  if (gone.length) await removePaths(gone);
  return removed;
}
