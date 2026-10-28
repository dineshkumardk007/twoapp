// When something happened, said the way a person would say it.
//
// Most of this app used to store the word rather than the moment: an entry
// written in March was saved as "Today" and still said Today in November, a
// letter said "Sent Today" for as long as it existed, and every line of the
// garden log said "Just now". Nothing was lying on purpose - the word was
// simply written down once and never revisited.
//
// Entries made before this keep whatever word they were given, because their
// real date is genuinely not known any more. Everything new carries the
// moment it happened and is described from it, however long ago that gets.

import { activeLocale, dateLocale, tr } from './i18n';

/** Rounded down, so "yesterday" means yesterday's date, not 24 hours ago. */
function daysBetween(then: Date, now: Date): number {
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * "Just now", "Today", "Yesterday", "4 days ago", "12 March", "12 Mar 2025".
 *
 * `fallback` is what to say when there is no timestamp: the word an older
 * entry was stored with, which is the best that can be done for it.
 */
export function whenLabel(at?: number, fallback = ''): string {
  if (!at || !Number.isFinite(at)) return fallback;

  const then = new Date(at);
  const now = new Date();
  const minutes = Math.floor((now.getTime() - at) / 60_000);

  // A moment in the future is a clock disagreeing, not a prediction.
  if (minutes < 1) return tr('Just now');

  const days = daysBetween(then, now);
  if (days <= 0) return minutes < 60 ? tr('{n} min ago', { n: minutes }) : tr('Today');
  if (days === 1) return tr('Yesterday');
  if (days < 7) return tr('{n} days ago', { n: days });

  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(dateLocale(), {
    day: 'numeric',
    month: sameYear ? 'long' : 'short',
    year: sameYear ? undefined : 'numeric'
  });
}

/** The same, with the time of day - for things that happened rather than were written. */
export function whenLabelWithTime(at?: number, fallback = ''): string {
  if (!at || !Number.isFinite(at)) return fallback;
  const label = whenLabel(at, fallback);
  // "Just now" and "12 min ago" say it already.
  const now = new Date();
  if (now.getTime() - at < 60 * 60_000 && daysBetween(new Date(at), now) <= 0) return label;
  const time = activeLocale() === 'ta' ? clockTime(at) : new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${label}, ${time}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The part of the day a Tamil time is said with: காலை (morning), மதியம்
 * (afternoon), மாலை (evening), இரவு (night).
 */
function tamilPartOfDay(h: number): string {
  if (h >= 4 && h < 12) return 'காலை';
  if (h >= 12 && h < 16) return 'மதியம்';
  if (h >= 16 && h < 19) return 'மாலை';
  return 'இரவு';
}

/**
 * "7:00 am", "10:30 pm" - a time of day on this phone's clock, the way the chat
 * writes it. In Tamil, "காலை 7:00", "இரவு 10:30".
 */
export function clockTime(at: number): string {
  const d = new Date(at);
  const h = d.getHours();
  const hm = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (activeLocale() === 'ta') return `${tamilPartOfDay(h)} ${hm}`;
  return `${hm} ${h < 12 ? 'am' : 'pm'}`;
}

/**
 * "today at 10:00 pm", "tomorrow at 7:00 am", "on Thu 23 Oct at 7:00 am" - a
 * moment still to come, for something set to happen then.
 */
export function aheadLabel(at: number, now: number = Date.now()): string {
  const then = new Date(at);
  const days = -daysBetween(then, new Date(now));
  const time = clockTime(at);
  if (days <= 0) return tr('today at {time}', { time });
  if (days === 1) return tr('tomorrow at {time}', { time });
  const date =
    activeLocale() === 'ta'
      ? then.toLocaleDateString('ta-IN', { weekday: 'short', day: 'numeric', month: 'short' })
      : `${DAY_NAMES[then.getDay()]} ${then.getDate()} ${MONTH_NAMES[then.getMonth()]}`;
  return tr('on {date} at {time}', { date, time });
}

/** The start of the local calendar day `at` falls on. */
export function startOfDay(at: number): number {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Built once. Formatting a date makes a formatter each time it is asked, and a
// conversation of a few thousand messages asked for one per day on every
// keystroke in the composer.
const DAY_FORMAT = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const OLD_DAY_FORMAT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
/** The same day names in another language (core/i18n), each built the first time it is wanted. */
const OTHER_DAY_FORMATS = new Map<string, Intl.DateTimeFormat>();
function dayFormat(old: boolean): Intl.DateTimeFormat {
  const locale = dateLocale();
  if (!locale) return old ? OLD_DAY_FORMAT : DAY_FORMAT;
  const key = `${locale}|${old}`;
  let format = OTHER_DAY_FORMATS.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(
      locale,
      old ? { day: 'numeric', month: 'short', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' }
    );
    OTHER_DAY_FORMATS.set(key, format);
  }
  return format;
}

/**
 * "Today", "Yesterday", "Sat, 3 Oct" - the name of a day (`day`, a
 * startOfDay), for the line between days in a chat and the date that floats
 * over it while you scroll.
 *
 * Not whenLabel above, which answers "how long ago" ("4 days ago") where a
 * divider has to name the day itself.
 */
export function dayLabel(day: number, now: number, ahead = false): string {
  const days = Math.round((startOfDay(now) - day) / 86_400_000);
  // A day in the future is the other phone's clock running ahead, not news -
  // unless it is a message set to show later (core/sendLater), which says
  // the day it is to show.
  if (days < 0 && ahead) return days === -1 ? tr('Tomorrow') : dayFormat(false).format(day);
  if (days <= 0) return tr('Today');
  if (days === 1) return tr('Yesterday');
  return new Date(day).getFullYear() === new Date(now).getFullYear()
    ? dayFormat(false).format(day)
    : dayFormat(true).format(day);
}

/** "Today, 9:41 pm", "Sat, 3 Oct, 7:02 am" - a moment, its day named the way a chat names it. */
export function dayAndTime(at: number, now: number = Date.now()): string {
  return `${dayLabel(startOfDay(at), now)}, ${clockTime(at)}`;
}
