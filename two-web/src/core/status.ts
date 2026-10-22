// One-tap status: "On the way", "Reached home", "Free to talk" - a word to
// your partner about where you are, shown under your name in their chat and
// at the top of Home, and gone by itself a few hours later.
//
// One record, STATUS_SET, carries the whole of a person's status each time
// it changes, and the newest by when it was set wins: the relay keeps every
// copy for its ninety days and replays them all to a phone set up again.
// Clearing it is a status with no words. When it ends is chosen on the phone
// that sets it; each phone stops showing it once its own clock passes that.

import { isReactionEmoji } from './chatActions';

export const STATUS_SET = 'STATUS_SET';

type Seat = 'user' | 'partner';

export interface StatusNote {
  /** Empty once cleared. */
  text: string;
  emoji?: string;
  setAt: number;
  clearsAt: number;
}

/** Each of your statuses, by seat - yours and your partner's. */
export type Statuses = Partial<Record<Seat, StatusNote>>;

/** The ones a single tap sets. */
export const STATUS_PRESETS: ReadonlyArray<{ emoji: string; text: string }> = [
  { emoji: '🚗', text: 'On the way' },
  { emoji: '🏠', text: 'Reached home' },
  { emoji: '💼', text: 'At work' },
  { emoji: '📞', text: 'Free to talk' },
  { emoji: '🔕', text: 'Busy, talk later' },
  { emoji: '😴', text: 'Going to sleep' }
];

export const MAX_STATUS_CHARS = 40;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** No status outlasts this, whatever the phone that set it says. */
const LONGEST = 24 * HOUR;

export type StatusLasts = 'hour' | 'three' | 'today';

export const STATUS_LASTS: ReadonlyArray<{ key: StatusLasts; label: string }> = [
  { key: 'hour', label: '1 hour' },
  { key: 'three', label: '3 hours' },
  { key: 'today', label: 'Rest of today' }
];

/** When a status set now ends. "Rest of today" is midnight - half an hour at the least. */
export function clearsAtFor(lasts: StatusLasts, now: number = Date.now()): number {
  if (lasts === 'hour') return now + HOUR;
  if (lasts === 'three') return now + 3 * HOUR;
  const d = new Date(now);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return Math.max(midnight, now + 30 * MINUTE);
}

/** Words for a status, tidied: one line, at most MAX_STATUS_CHARS characters. */
export function statusText(raw: string): string {
  return Array.from(raw.replace(/\s+/g, ' ').trim()).slice(0, MAX_STATUS_CHARS).join('').trim();
}

/**
 * Set further ahead of this phone's clock than any status lasts: by a clock
 * gone wrong. It cannot be told apart from a newer one by its stamp, so it
 * gives way to whatever comes next.
 */
function wrongClock(s: StatusNote, now: number): boolean {
  return s.setAt > now + LONGEST;
}

/**
 * A STATUS_SET as it came from a phone - kept only if it is one. It ends a
 * day from now at the latest, by this phone's clock as well as the sender's.
 */
export function cleanStatus(raw: unknown, now: number = Date.now()): StatusNote | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const setAt = Number(r.setAt);
  const clearsAt = Number(r.clearsAt);
  if (!Number.isFinite(setAt) || setAt <= 0 || !Number.isFinite(clearsAt) || clearsAt < setAt) return null;
  const text = typeof r.text === 'string' ? statusText(r.text) : '';
  const emoji = text && typeof r.emoji === 'string' && isReactionEmoji(r.emoji) ? r.emoji : undefined;
  return { text, ...(emoji ? { emoji } : {}), setAt, clearsAt: Math.min(clearsAt, setAt + LONGEST, now + LONGEST) };
}

/**
 * A person's statuses with one that arrived folded in: kept if it is newer
 * than the one held, or the one held was set by a clock gone wrong. Null
 * when nothing changes.
 */
export function applyStatus(
  statuses: Statuses | undefined,
  seat: string,
  raw: unknown,
  now: number = Date.now()
): Statuses | null {
  if (seat !== 'user' && seat !== 'partner') return null;
  const incoming = cleanStatus(raw, now);
  if (!incoming) return null;
  const current = statuses?.[seat];
  if (current && current.setAt >= incoming.setAt && !wrongClock(current, now)) return null;
  if (current && current.setAt === incoming.setAt) return null;
  return { ...(statuses || {}), [seat]: incoming };
}

/**
 * When a status set here now is stamped: after the one this seat has, so it
 * wins on both phones even when that one came from a clock a little ahead -
 * but not after one from a clock gone wrong, which gives way anyway.
 */
export function stampFor(current: StatusNote | undefined, now: number = Date.now()): number {
  if (!current || wrongClock(current, now)) return now;
  return Math.max(now, current.setAt + 1);
}

/**
 * A status still to show: with words, and not yet over by this phone's
 * clock - nor ending more than a day off, as only one set while this
 * phone's clock was wrong could.
 */
export function liveStatus(s: StatusNote | undefined, now: number = Date.now()): StatusNote | null {
  return s && s.text && s.clearsAt > now && s.clearsAt <= now + LONGEST ? s : null;
}

/** "🏠 Reached home". */
export function statusWords(s: StatusNote): string {
  return s.emoji ? `${s.emoji} ${s.text}` : s.text;
}
