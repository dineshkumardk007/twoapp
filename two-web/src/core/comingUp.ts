// "Coming up" on Home: each other's birthdays, the next time you meet, days
// of your own, and Tamil festivals.
//
// The days you set are shared by both phones in one COMING_UP record holding
// every day, each with its own time stamp, so the two phones merge day by
// day: one of you adding a birthday while the other moves the meet-up keeps
// both. A day taken off stays as a marker, so the other phone's copy cannot
// bring it back. Like the anniversary (OUR_DATES), the record goes out again
// on every connection, so a phone on an older version when a day was set
// gets it after updating, and the relay never forgets it after a year.
// An older phone ignores the record.

import { FESTIVALS, type Festival } from '../data/festivals';
import { localDateKey } from './ourDates';

export const COMING_UP = 'COMING_UP';

type Seat = 'user' | 'partner';

export interface ComingUpDay {
  id: string;
  /** A birthday (of `who`), the next time you meet, or a day of your own. */
  kind: 'birthday' | 'meet' | 'day';
  /** 'YYYY-MM-DD'. */
  date: string;
  /** Every year on that day, or just the once. Birthdays are yearly; a meet-up is once. */
  yearly: boolean;
  /** Whose birthday. */
  who?: Seat;
  /** What a day of your own is called. */
  label?: string;
  /** When it was last set or taken off, epoch ms - the newer wins. */
  at: number;
  /** Taken off: kept so the other phone's older copy does not bring it back. */
  removed?: boolean;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function realDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return y >= 1900 && y <= 2200 && mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** One day as it arrived, checked - or null. */
export function cleanDay(raw: unknown): ComingUpDay | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id || r.id.length > 80) return null;
  if (r.kind !== 'birthday' && r.kind !== 'meet' && r.kind !== 'day') return null;
  const at = Number(r.at);
  if (!Number.isFinite(at) || at <= 0) return null;
  const removed = r.removed === true;
  if (!removed && !realDate(r.date)) return null;
  const who = r.who === 'user' || r.who === 'partner' ? r.who : undefined;
  if (r.kind === 'birthday' && !who && !removed) return null;
  const label = typeof r.label === 'string' ? r.label.trim().slice(0, 60) : undefined;
  if (r.kind === 'day' && !label && !removed) return null;
  return {
    id: r.id,
    kind: r.kind,
    date: realDate(r.date) ? r.date : '',
    yearly: r.kind === 'birthday' ? true : r.kind === 'meet' ? false : r.yearly === true,
    ...(who ? { who } : {}),
    ...(label ? { label } : {}),
    at,
    ...(removed ? { removed: true } : {})
  };
}

/** Both lists as one, day by day: for each, the newer setting (a tie settled by content, the same on both phones). */
export function mergeDays(current: ComingUpDay[] | undefined, incoming: unknown): ComingUpDay[] {
  const byId = new Map<string, ComingUpDay>();
  for (const d of current || []) byId.set(d.id, d);
  const list = Array.isArray(incoming) ? incoming : [];
  let changed = false;
  for (const raw of list) {
    const day = cleanDay(raw);
    if (!day) continue;
    const have = byId.get(day.id);
    const newer =
      !have ||
      day.at > have.at ||
      (day.at === have.at && JSON.stringify(day) > JSON.stringify(have));
    if (newer) {
      byId.set(day.id, day);
      changed = true;
    }
  }
  return changed ? [...byId.values()] : current || [];
}

/** The days still set (not taken off). */
export function liveDays(days: ComingUpDay[] | undefined): ComingUpDay[] {
  return (days || []).filter(d => !d.removed);
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The next time a yearly day comes, today included; 29 February falls on the 28th in other years. */
function nextYearly(date: string, today: string): string {
  const [, m, d] = date.split('-').map(Number);
  const ty = Number(today.slice(0, 4));
  const on = (year: number) => {
    const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
    return `${year}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
  };
  const thisYear = on(ty);
  return dayNumber(thisYear) >= dayNumber(today) ? thisYear : on(ty + 1);
}

export interface Upcoming {
  key: string;
  /** "Priya's birthday", "You meet", "Pongal". */
  title: string;
  /** A smaller line under it: the Tamil name of a festival. */
  sub?: string;
  emoji: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** 0 today. */
  daysUntil: number;
  /** A one-tap wish for the chat, on the day - for your partner's birthday and festivals. */
  wish?: string;
}

/**
 * What is coming, soonest first: every day you set within `withinDays`,
 * and festivals that are switched on - today included.
 */
export function upcoming(
  days: ComingUpDay[] | undefined,
  options: {
    me: Seat;
    partnerName: string;
    hiddenFestivals?: string[];
    today?: string;
    withinDays?: number;
    festivals?: readonly Festival[];
  }
): Upcoming[] {
  const today = options.today ?? localDateKey();
  const within = options.withinDays ?? 60;
  const t = dayNumber(today);
  const out: Upcoming[] = [];
  const partner = options.partnerName.trim() || 'Partner';

  for (const d of liveDays(days)) {
    if (!d.date) continue;
    const date = d.yearly ? nextYearly(d.date, today) : d.date;
    const daysUntil = dayNumber(date) - t;
    if (daysUntil < 0 || daysUntil > within) continue;
    if (d.kind === 'birthday') {
      const mine = d.who === options.me;
      out.push({
        key: d.id,
        title: mine ? 'Your birthday' : `${partner}'s birthday`,
        emoji: '🎂',
        date,
        daysUntil,
        ...(mine ? {} : { wish: `Happy birthday, ${partner}! 🎂❤️` })
      });
    } else if (d.kind === 'meet') {
      out.push({ key: d.id, title: daysUntil === 0 ? 'You meet today' : 'You meet', emoji: '🤍', date, daysUntil });
    } else {
      out.push({ key: d.id, title: d.label || 'A day of yours', emoji: '📅', date, daysUntil });
    }
  }

  const hidden = new Set(options.hiddenFestivals || []);
  for (const f of options.festivals ?? FESTIVALS) {
    if (hidden.has(f.id)) continue;
    const date = f.dates.find(x => dayNumber(x) >= t);
    if (!date) continue;
    const daysUntil = dayNumber(date) - t;
    if (daysUntil > within) continue;
    out.push({ key: `fest-${f.id}-${date}`, title: f.name, sub: f.tamil, emoji: f.emoji, date, daysUntil, wish: f.wish });
  }

  return out.sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title));
}

/** "Today", "Tomorrow", "In 12 days". */
export function whenWords(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

const HIDDEN_KEY = 'two_hidden_festivals_v1';

/** The festivals switched off on this phone. */
export function readHiddenFestivals(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function writeHiddenFestivals(ids: string[]): void {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
  } catch {
    /* private mode: this run keeps the choice */
  }
}
