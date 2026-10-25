// Your own name, changed in Settings: on your partner's phone, and on any
// other device of yours in the same seat.
//
// A name travels in NAME_EXCHANGE, which every phone sends again each time it
// connects. Until a name could be changed, the last one heard was always the
// right one. Now an announcement can be out of date - another device of yours
// that has not heard of the change yet, coming online and saying the old name
// - so a name chosen here carries when it was chosen (`setAt`), and the
// newest wins on every phone. One with no time, from a phone on the version
// before or from before anybody changed a name, counts only while no chosen
// time is known: exactly how names behaved until now.

import { isRealName } from './seats';

/** As long as a name can be, here and when you first set up Two. */
export const MAX_NAME_CHARS = 30;

/** A name as typed: one line, single spaces, at most MAX_NAME_CHARS characters. */
export function cleanName(raw: string): string {
  return Array.from(raw.replace(/\s+/g, ' ').trim()).slice(0, MAX_NAME_CHARS).join('').trim();
}

/** What is wrong with a name typed in Settings, or null when it will do. */
export function nameProblem(raw: string): string | null {
  const name = cleanName(raw);
  if (!name) return 'Type a name';
  if (!isRealName(name)) return 'Pick a name of your own';
  return null;
}

/** Names of their own a device sends with a changed one, at most. */
const MAX_WAS = 10;

export interface HeardName {
  name: string;
  /** When it was chosen; absent for one never changed, or from a phone on the version before. */
  setAt?: number;
  /**
   * The names its owner went by before. Another device in the same seat takes
   * a changed name only if it started from one of its own, so somebody else's
   * phone sitting in your seat is still noticed rather than renaming you.
   */
  was: string[];
}

/** A NAME_EXCHANGE as it came from a phone. */
export function readNameExchange(raw: unknown): HeardName | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string') return null;
  const name = cleanName(r.name);
  if (!name) return null;
  const setAt = Number(r.setAt);
  const was = Array.isArray(r.was)
    ? r.was.filter((n): n is string => typeof n === 'string').map(cleanName).filter(Boolean).slice(0, MAX_WAS)
    : [];
  return { name, ...(Number.isFinite(setAt) && setAt > 0 ? { setAt } : {}), was };
}

/** Whether a changed name heard from your own seat started from a name of yours. */
export function startedFromMine(heard: HeardName, mine: string, isMine: (name: string) => boolean): boolean {
  const same = (n: string) => n.toLowerCase() === mine.trim().toLowerCase() || isMine(n);
  return same(heard.name) || heard.was.some(same);
}

/**
 * Whether a name heard should replace the one held: chosen later than it, or,
 * with no time on it, only while the one held has none either.
 */
export function takesOver(heardSetAt: number | undefined, heldSetAt: number | undefined): boolean {
  if (heardSetAt === undefined) return heldSetAt === undefined;
  return heldSetAt === undefined || heardSetAt > heldSetAt;
}

/** When a name chosen here now is stamped: after the one held, so it wins everywhere. */
export function nameStampFor(heldSetAt: number | undefined, now: number = Date.now()): number {
  return Math.max(now, (heldSetAt ?? 0) + 1);
}
