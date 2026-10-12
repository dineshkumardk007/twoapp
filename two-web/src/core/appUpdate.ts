// New versions of the app, without a store.
//
// The phone does the work (AppUpdater on Android): it reads the newest release
// CI published, downloads the APK, checks its fingerprint and signing key, and
// opens Android's installer, which asks before installing. This module asks it
// to, keeps the checks to a sensible rate, and remembers a "Later".
//
// The website is always the newest version and has nothing to update.

export interface AppVersion {
  code: number;
  name: string;
  /** False for a developer's debug build, which releases cannot update. */
  updatable: boolean;
}

export interface UpdateInfo {
  code: number;
  name: string;
  /** Bytes, when known. */
  size: number;
  /** What is new, one line each. */
  notes: string[];
}

export type UpdateFailure = 'permission' | 'none' | 'network' | 'verify' | 'busy' | 'error' | 'unavailable';

interface UpdateBridge {
  appVersion?: () => string;
  updateCheck?: (id: string) => void;
  updateInstall?: (id: string) => void;
}

type Reply = {
  id: string;
  ok?: boolean;
  available?: boolean;
  code?: number;
  name?: string;
  size?: number;
  notes?: unknown;
  reason?: string;
  progress?: number;
};

/** How often the app asks on its own. A tap on "Check for updates" always asks. */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
/** "Later" quiets one version for this long. */
const LATER_MS = 24 * 60 * 60 * 1000;

const CHECKED_KEY = 'two_update_checked_v1';
const LATER_KEY = 'two_update_later_v1';
/** The last update a check found, so it is offered again on the next open. */
const FOUND_KEY = 'two_update_found_v1';

const FAILURES: UpdateFailure[] = ['permission', 'none', 'network', 'verify', 'busy', 'error', 'unavailable'];

function bridge(): UpdateBridge | null {
  try {
    return (window as unknown as { AndroidBridge?: UpdateBridge }).AndroidBridge ?? null;
  } catch {
    return null;
  }
}

/** This phone's version, or null on the website or an app too old to say. */
export function appVersion(): AppVersion | null {
  try {
    const raw = bridge()?.appVersion?.();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppVersion>;
    const code = Number(parsed.code);
    if (!Number.isFinite(code) || code <= 0) return null;
    return { code, name: String(parsed.name || code), updatable: parsed.updatable !== false };
  } catch {
    return null;
  }
}

// One request of each kind at a time; replies are matched by id.
const waiting = new Map<string, { resolve: (reply: Reply) => void; onProgress?: (fraction: number) => void }>();
let counter = 0;

function listen() {
  (window as unknown as { __twoUpdate?: (reply: Reply) => void }).__twoUpdate = reply => {
    const entry = reply && waiting.get(reply.id);
    if (!entry) return;
    if (typeof reply.progress === 'number' && reply.ok === undefined) {
      entry.onProgress?.(Math.max(0, Math.min(1, reply.progress)));
      return;
    }
    waiting.delete(reply.id);
    entry.resolve(reply);
  };
}

function ask(
  start: (b: UpdateBridge, id: string) => boolean,
  onProgress?: (fraction: number) => void
): Promise<Reply> {
  const b = bridge();
  if (!b) return Promise.resolve({ id: '', ok: false, reason: 'unavailable' });
  listen();
  counter += 1;
  const id = `up${Date.now().toString(36)}${counter}`;
  return new Promise(resolve => {
    waiting.set(id, { resolve, onProgress });
    let started = false;
    try {
      started = start(b, id);
    } catch {
      started = false;
    }
    if (!started) {
      waiting.delete(id);
      resolve({ id, ok: false, reason: 'unavailable' });
    }
  });
}

function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

export type CheckResult =
  | { status: 'found'; update: UpdateInfo }
  | { status: 'none' }
  | { status: 'failed' }
  /** Not asked: the website, a debug build, or asked too recently with nothing found. */
  | { status: 'skipped' };

function readFound(): UpdateInfo | null {
  try {
    const raw = JSON.parse(localStorage.getItem(FOUND_KEY) || 'null') as UpdateInfo | null;
    if (!raw || !Number.isFinite(raw.code)) return null;
    return {
      code: raw.code,
      name: String(raw.name || raw.code),
      size: Number(raw.size) || 0,
      notes: Array.isArray(raw.notes) ? raw.notes.filter(n => typeof n === 'string').slice(0, 8) : []
    };
  } catch {
    return null;
  }
}

function keepFound(update: UpdateInfo | null) {
  try {
    if (update) localStorage.setItem(FOUND_KEY, JSON.stringify(update));
    else localStorage.removeItem(FOUND_KEY);
  } catch {
    /* found again on the next check */
  }
}

/**
 * Asks whether a newer version is out. On its own the app asks at most every
 * few hours - in between, an update already found is offered again; [force]
 * asks now.
 */
export async function checkForUpdate(force = false): Promise<CheckResult> {
  const mine = appVersion();
  if (!mine || !mine.updatable) return { status: 'skipped' };
  if (!force && Date.now() - readNumber(CHECKED_KEY) < CHECK_EVERY_MS) {
    const kept = readFound();
    return kept && kept.code > mine.code ? { status: 'found', update: kept } : { status: 'skipped' };
  }
  const reply = await ask((b, id) => {
    if (!b.updateCheck) return false;
    b.updateCheck(id);
    return true;
  });
  if (!reply.ok) return { status: 'failed' };
  try {
    localStorage.setItem(CHECKED_KEY, String(Date.now()));
  } catch {
    /* asked again next time */
  }
  const code = Number(reply.code);
  if (!reply.available || !Number.isFinite(code) || code <= mine.code) {
    keepFound(null);
    return { status: 'none' };
  }
  const notes = Array.isArray(reply.notes)
    ? reply.notes.filter((n): n is string => typeof n === 'string' && n.trim() !== '').slice(0, 8)
    : [];
  const update: UpdateInfo = { code, name: String(reply.name || code), size: Number(reply.size) || 0, notes };
  keepFound(update);
  return { status: 'found', update };
}

export type InstallResult = { ok: true } | { ok: false; reason: UpdateFailure };

/** Downloads the update and opens Android's installer on it. */
export async function installUpdate(onProgress: (fraction: number) => void): Promise<InstallResult> {
  const reply = await ask((b, id) => {
    if (!b.updateInstall) return false;
    b.updateInstall(id);
    return true;
  }, onProgress);
  if (reply.ok) return { ok: true };
  const reason = FAILURES.includes(reply.reason as UpdateFailure) ? (reply.reason as UpdateFailure) : 'error';
  return { ok: false, reason };
}

/** "Later": this version is not offered again for a day. */
export function remindLater(code: number) {
  try {
    localStorage.setItem(LATER_KEY, JSON.stringify({ code, until: Date.now() + LATER_MS }));
  } catch {
    /* it asks again next time, which is no harm */
  }
}

export function isPutOff(code: number): boolean {
  try {
    const raw = JSON.parse(localStorage.getItem(LATER_KEY) || 'null') as { code?: number; until?: number } | null;
    return !!raw && raw.code === code && Number(raw.until) > Date.now();
  } catch {
    return false;
  }
}

/** "4.1 MB" */
export function sizeLabel(bytes: number): string {
  if (!bytes) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
