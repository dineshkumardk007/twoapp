// Daily rituals: who did which one, and on which day.
//
// A ritual used to remember one tick per person and nothing else - no day -
// so "Done today" was still showing a week later, beside a streak that went
// up on every tap (un-ticking included) and a header that always said 14.
//
// What is kept now is the days themselves. Each of you has a short list of
// the calendar days you did a ritual on. "Done today" is today being in your
// list, so it is fresh every morning without anything having to reset it,
// and a streak is counted from the two lists rather than kept as a number
// that can drift away from what actually happened.

import type { RitualItem } from '../types';

export type Seat = 'user' | 'partner';

/**
 * How many done days each of you keeps per ritual.
 *
 * Three months of every day is far longer than any streak needs to look
 * back, and small enough that it never matters for storage.
 */
export const RITUAL_HISTORY_DAYS = 90;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A day on the phone's own calendar, as 'YYYY-MM-DD'.
 *
 * Local, not UTC: a ritual done at half past one in the morning belongs to
 * that night here, not to the previous day in Greenwich. Built by hand
 * rather than with a locale format, which older WebViews do not all honour.
 */
export function localDay(at: number | Date = Date.now()): string {
  const d = at instanceof Date ? at : new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isLocalDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** The calendar day before `day`. Worked out at midday, clear of any clock change. */
function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d - 1, 12));
}

/**
 * The days `seat` did this ritual.
 *
 * Tolerant of a ritual from before days were kept - a backup restored as it
 * was saved, say - which simply has none.
 */
export function daysDone(ritual: RitualItem | undefined, seat: Seat): string[] {
  const list = ritual?.doneOn?.[seat];
  return Array.isArray(list) ? list : [];
}

export function isDoneOn(ritual: RitualItem | undefined, seat: Seat, day: string = localDay()): boolean {
  return daysDone(ritual, seat).includes(day);
}

/** Oldest first, each day once, and only the most recent RITUAL_HISTORY_DAYS. */
function tidy(days: string[]): string[] {
  return Array.from(new Set(days.filter(isLocalDay))).sort().slice(-RITUAL_HISTORY_DAYS);
}

/**
 * `rituals` with one person's tick for one day set to `done` - or null when
 * that is already how it stands.
 *
 * Set, never toggled: the same change arriving twice (a replay, the relay
 * and the local network both delivering it, a second device) lands in the
 * same place instead of flipping back.
 */
export function withRitualDay(
  rituals: RitualItem[],
  ritualId: string,
  seat: Seat,
  day: string,
  done: boolean
): RitualItem[] | null {
  let changed = false;
  const next = rituals.map(ritual => {
    if (ritual.id !== ritualId) return ritual;
    const days = daysDone(ritual, seat);
    if (days.includes(day) === done) return ritual;
    changed = true;
    return {
      ...ritual,
      doneOn: {
        user: daysDone(ritual, 'user'),
        partner: daysDone(ritual, 'partner'),
        [seat]: done ? tidy([...days, day]) : days.filter(d => d !== day)
      }
    };
  });
  return changed ? next : null;
}

/** How many days in a row `both` holds, ending today - or yesterday, while today is still open. */
function runEndingToday(both: (day: string) => boolean, today: string): number {
  // Today is not over. A run that reached yesterday is not broken at
  // breakfast just because nobody has had their tea yet.
  let day = both(today) ? today : dayBefore(today);
  let run = 0;
  while (both(day)) {
    run += 1;
    day = dayBefore(day);
  }
  return run;
}

/**
 * The days in a row on which both of you did at least one ritual - not
 * necessarily the same one - ending today or yesterday. Zero when there is
 * no such run, and the screen then says nothing rather than a number.
 */
export function togetherStreak(rituals: RitualItem[], today: string = localDay()): number {
  const user = new Set<string>();
  const partner = new Set<string>();
  for (const ritual of rituals) {
    daysDone(ritual, 'user').forEach(day => user.add(day));
    daysDone(ritual, 'partner').forEach(day => partner.add(day));
  }
  return runEndingToday(day => user.has(day) && partner.has(day), today);
}

/** The same count for one ritual: the days in a row you both did this one. */
export function ritualStreak(ritual: RitualItem, today: string = localDay()): number {
  const user = new Set(daysDone(ritual, 'user'));
  const partner = new Set(daysDone(ritual, 'partner'));
  return runEndingToday(day => user.has(day) && partner.has(day), today);
}

/**
 * A ritual as any version stored it, in the shape this one uses.
 *
 * Before days were kept, a tick was a bare `true` with no date. There is no
 * telling whether it was ticked this morning or last month, so it is not
 * carried over: the ritual itself is kept exactly as it was, and starts the
 * day un-ticked - which is what the screen should have been showing anyway.
 * The old tally (`streakDays`) counted taps, not days, and goes with it.
 */
export function upgradeRitual(stored: any): RitualItem | null {
  if (!stored || typeof stored !== 'object' || typeof stored.id !== 'string') return null;
  const ritual: any = { ...stored };
  delete ritual.completedTodayByUser;
  delete ritual.completedTodayByPartner;
  delete ritual.streakDays;
  ritual.doneOn = {
    user: tidy(Array.isArray(stored.doneOn?.user) ? stored.doneOn.user : []),
    partner: tidy(Array.isArray(stored.doneOn?.partner) ? stored.doneOn.partner : [])
  };
  return ritual as RitualItem;
}

export function upgradeRituals(stored: unknown): RitualItem[] | null {
  if (!Array.isArray(stored)) return null;
  return stored.map(upgradeRitual).filter((r): r is RitualItem => r !== null);
}
