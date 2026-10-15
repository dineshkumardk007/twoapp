// How each of you has felt lately: the last two weeks on the Emotional
// Weather card, and thirty days behind "See 30 days".
//
// The relay keeps only the newest WEATHER record from each of you - an older
// one is a stale "how are you now" - so the history cannot be read back out
// of it. Instead each phone keeps its own days, the last weather set on each,
// and sends all of them inside every WEATHER record. Whoever gets the newest
// record has the whole recent history with it, however long their phone was
// off.
//
// Only the days a weather was set are kept. A day in between shows the
// weather carried on from before it, because that is what the card showed
// that day; before the first one kept there is nothing to show.

import type { EmotionalReport, WeatherState } from '../types';
import { localDateKey } from './ourDates';

/** How many days each phone keeps and sends: the thirty shown, and a little spare. */
export const WEATHER_DAYS_KEPT = 40;

const STATES: readonly WeatherState[] = ['SUNNY', 'CALM', 'OVERCAST', 'RAINY', 'STORMY'];
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isWeatherState(value: unknown): value is WeatherState {
  return typeof value === 'string' && (STATES as readonly string[]).includes(value);
}

/** `days` with `weather` as the last set on `day`, the oldest let go past WEATHER_DAYS_KEPT. */
export function recordDay(
  days: Record<string, WeatherState> | undefined,
  day: string,
  weather: WeatherState
): Record<string, WeatherState> {
  const next: Record<string, WeatherState> = { ...(days || {}), [day]: weather };
  const keys = Object.keys(next).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - WEATHER_DAYS_KEPT))) delete next[key];
  return next;
}

/** Days as they came from the other phone: only real dates and real weathers, the newest few. */
export function cleanWeatherDays(raw: unknown): Record<string, WeatherState> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const kept = Object.entries(raw as Record<string, unknown>)
    .filter((entry): entry is [string, WeatherState] => DATE_KEY.test(entry[0]) && isWeatherState(entry[1]))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(-WEATHER_DAYS_KEPT);
  return kept.length ? Object.fromEntries(kept) : undefined;
}

/**
 * A report from the wire (a WEATHER record) laid over the one held here.
 *
 * Only what a report holds is taken, and checked. Its days replace those held,
 * because its author sends all of theirs. A report from a phone too old to
 * send days still counts for `day`, the day it was sent - when that is known.
 */
export function mergeReport(held: EmotionalReport, raw: unknown, day: string | null): EmotionalReport {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const next: EmotionalReport = { ...held };
  if (isWeatherState(r.weather)) next.weather = r.weather;
  if (typeof r.capacity === 'number' && Number.isFinite(r.capacity)) {
    next.capacity = Math.max(0, Math.min(5, Math.round(r.capacity)));
  }
  if (typeof r.notAboutYouActive === 'boolean') next.notAboutYouActive = r.notAboutYouActive;
  if (typeof r.updatedAt === 'string') next.updatedAt = r.updatedAt.slice(0, 64);
  const days = cleanWeatherDays(r.days);
  if (days) next.days = days;
  else if (day && isWeatherState(r.weather)) next.days = recordDay(held.days, day, r.weather);
  return next;
}

/** The `count` local dates up to and including `now`'s, oldest first. */
export function lastDays(count: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let back = count - 1; back >= 0; back--) {
    // Midday, so a clock change overnight cannot land on the wrong date.
    out.push(localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, 12)));
  }
  return out;
}

/**
 * The weather on each of `dayKeys` (oldest first): the last set that day, or
 * else carried on from an earlier day, and null before anything was kept.
 * `today` is always the weather now.
 */
export function weatherByDay(report: EmotionalReport, dayKeys: string[], today: string): (WeatherState | null)[] {
  const days = report.days || {};
  const known = Object.keys(days).sort();
  return dayKeys.map(key => {
    if (key === today) return report.weather;
    if (days[key]) return days[key];
    let carried: WeatherState | null = null;
    for (const k of known) {
      if (k > key) break;
      carried = days[k];
    }
    return carried;
  });
}
