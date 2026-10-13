// A gentle nudge to save a backup.
//
// Everything in Two lives on the two phones, and the relay keeps only what a
// phone has not collected yet. If a phone is lost before a backup exists,
// what was on it goes with it. So Home asks, now and then, and never nags:
//
//   - never backed up:  a week after this phone starts watching, then
//   - after a backup:   thirty days after the last one
//   - "Later":          quiet for a week
//
// Only times are kept here, never anything from the backup itself.

const LAST_KEY = 'two_last_backup_v1';
const SINCE_KEY = 'two_backup_watch_since_v1';
const SNOOZE_KEY = 'two_backup_snooze_until_v1';
const OPEN_KEY = 'two_open_backup_v1';

const DAY = 86_400_000;
export const FIRST_NUDGE_DAYS = 7;
export const BACKUP_EVERY_DAYS = 30;
export const SNOOZE_DAYS = 7;

export interface BackupNudge {
  /** False until the first backup has been made on this phone. */
  everBackedUp: boolean;
  /** Whole days since the last backup; 0 when there has never been one. */
  daysSince: number;
}

function read(key: string): number {
  try {
    return Number(localStorage.getItem(key) || 0) || 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: number | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {
    /* private mode: the nudge simply never shows */
  }
}

/** Called when a backup has been saved. */
export function recordBackup(now = Date.now()) {
  write(LAST_KEY, now);
  write(SNOOZE_KEY, null);
}

/** "Later": quiet for a week. */
export function snoozeBackupNudge(now = Date.now()) {
  write(SNOOZE_KEY, now + SNOOZE_DAYS * DAY);
}

/** Whether Home should ask for a backup now, and how to put it. */
export function backupNudge(now = Date.now()): BackupNudge | null {
  if (read(SNOOZE_KEY) > now) return null;
  const last = read(LAST_KEY);
  if (last) {
    const days = Math.floor((now - last) / DAY);
    return days >= BACKUP_EVERY_DAYS ? { everBackedUp: true, daysSince: days } : null;
  }
  let since = read(SINCE_KEY);
  if (!since) {
    since = now;
    write(SINCE_KEY, now);
  }
  return now - since >= FIRST_NUDGE_DAYS * DAY ? { everBackedUp: false, daysSince: 0 } : null;
}

/** Home's "Back up now": Settings opens its backup pop-up when it next shows. */
export function requestBackupOnOpen() {
  try {
    sessionStorage.setItem(OPEN_KEY, '1');
  } catch {
    /* Settings opens without it; the backup is one tap away there */
  }
}

/** Settings asks once, when it opens. */
export function takeBackupRequest(): boolean {
  try {
    const asked = sessionStorage.getItem(OPEN_KEY) === '1';
    sessionStorage.removeItem(OPEN_KEY);
    return asked;
  } catch {
    return false;
  }
}
