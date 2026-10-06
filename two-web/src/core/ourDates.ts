// The couple's dates, and the counting done from them.
//
// Everything here works in calendar days on the phone's own clock. A date
// like '2022-04-18' is a day, not a moment: `new Date('2022-04-18')` reads it
// as midnight in London, which in Chennai is 5:30 in the morning - so the
// old counter turned over at breakfast, and on the anniversary itself said
// "1 day remaining" until half past five. Days here are counted from the
// year, month and day alone, so they turn over at local midnight and nothing
// about the hour can move them.

import type { OurDates } from '../types';

const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_DAY = /^(\d{2})-(\d{2})$/;

/** Days in a month, `month` 1-12. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function validFullDate(value: string): boolean {
  const m = FULL_DATE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** 02-29 counts: it is somebody's anniversary. */
function validMonthDay(value: string): boolean {
  const m = MONTH_DAY.exec(value);
  if (!m) return false;
  const month = Number(m[1]);
  const day = Number(m[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(2024, month);
}

/** A real 'YYYY-MM-DD' - not 2023-02-30. */
export function isCalendarDate(value: unknown): value is string {
  return typeof value === 'string' && validFullDate(value);
}

/** A real 'MM-DD'. */
function isMonthDay(value: unknown): value is string {
  return typeof value === 'string' && validMonthDay(value);
}

/** Today on this phone, as 'YYYY-MM-DD'. Changes at local midnight. */
export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A day as a plain number, so two days can be subtracted with no clock involved. */
function dayNumber(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

function parts(key: string): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}

/** Whole days from `from` to `to`, both 'YYYY-MM-DD'. */
function daysFrom(from: string, to: string): number {
  return dayNumber(...parts(to)) - dayNumber(...parts(from));
}

/**
 * The newer of two settings, or null when `incoming` is not newer than
 * `current`.
 *
 * Newest `at` wins. Two changes stamped in the same millisecond are settled
 * by their content, so both phones settle on the same one whichever arrived
 * first.
 */
export function newerOurDates(incoming: OurDates, current: OurDates | undefined): OurDates | null {
  if (!current) return incoming;
  if (incoming.at > current.at) return incoming;
  if (incoming.at < current.at) return null;
  const a = `${incoming.togetherSince || ''}|${incoming.anniversary || ''}`;
  const b = `${current.togetherSince || ''}|${current.anniversary || ''}`;
  return a > b ? incoming : null;
}

/**
 * What arrived from the other phone, kept to what is understood.
 *
 * A date that is not a real date is dropped rather than shown as "NaN days".
 * Null when the record itself is unusable - no time to order it by.
 */
export function cleanOurDates(payload: any): OurDates | null {
  if (!payload || typeof payload !== 'object') return null;
  const at = Number(payload.at);
  if (!Number.isFinite(at) || at <= 0) return null;
  const dates: OurDates = { at };
  if (isCalendarDate(payload.togetherSince)) dates.togetherSince = payload.togetherSince;
  if (isCalendarDate(payload.anniversary) || isMonthDay(payload.anniversary)) {
    dates.anniversary = payload.anniversary;
  }
  return dates;
}

/** Whether there is anything to count from. */
export function hasOurDates(dates: OurDates | undefined): boolean {
  return !!dates && !!anniversarySource(dates);
}

/** Days since the story began: 0 on the day itself, negative if it is still to come. */
export function daysTogether(togetherSince: string, today: string = localDateKey()): number {
  return daysFrom(togetherSince, today);
}

/** The day to celebrate: the anniversary when set, otherwise the day it began. */
function anniversarySource(dates: OurDates): { month: number; day: number; year?: number } | null {
  for (const value of [dates.anniversary, dates.togetherSince]) {
    if (typeof value !== 'string') continue;
    if (validFullDate(value)) {
      const [year, month, day] = parts(value);
      return { year, month, day };
    }
    if (validMonthDay(value)) {
      const [month, day] = value.split('-').map(Number);
      return { month, day };
    }
  }
  return null;
}

export interface NextAnniversary {
  /** 'YYYY-MM-DD' of the coming one - today, on the day. */
  date: string;
  /** 0 on the day itself. */
  daysUntil: number;
  /** Which anniversary it is (1 for the first), when the year is known. */
  years?: number;
}

/**
 * The next time the day comes round, today included.
 *
 * It moves on to the following year the day after, rather than stopping at
 * the one it was written for. A 29 February anniversary is kept on the 28th
 * in the years that have no 29th.
 */
export function nextAnniversary(dates: OurDates, today: string = localDateKey()): NextAnniversary | null {
  const source = anniversarySource(dates);
  if (!source) return null;
  const [ty] = parts(today);

  const onYear = (year: number) => {
    const day = Math.min(source.day, daysInMonth(year, source.month));
    return `${year}-${String(source.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  let date: string;
  if (source.year !== undefined && source.year >= ty) {
    // Begun this year, or still to come. The day itself is not an
    // anniversary: count down to it while it is ahead, and from it to the
    // first one once it has come.
    const origin = onYear(source.year);
    date = daysFrom(today, origin) > 0 ? origin : onYear(ty + 1);
  } else {
    date = onYear(ty);
    if (daysFrom(today, date) < 0) date = onYear(ty + 1);
  }

  const daysUntil = daysFrom(today, date);
  const years = source.year !== undefined ? parts(date)[0] - source.year : undefined;
  return { date, daysUntil, years: years !== undefined && years > 0 ? years : undefined };
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "18 April 2022", or "14 October" without the year. */
export function formatDay(key: string, withYear = true): string {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: withYear ? 'numeric' : undefined
  });
}
