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
  if (minutes < 1) return 'Just now';

  const days = daysBetween(then, now);
  if (days <= 0) return minutes < 60 ? `${minutes} min ago` : 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(undefined, {
    day: 'numeric',
    month: sameYear ? 'long' : 'short',
    year: sameYear ? undefined : 'numeric'
  });
}

/** The same, with the time of day - for things that happened rather than were written. */
export function whenLabelWithTime(at?: number, fallback = ''): string {
  if (!at || !Number.isFinite(at)) return fallback;
  const label = whenLabel(at, fallback);
  if (label === 'Just now' || label.endsWith('min ago')) return label;
  const time = new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${label}, ${time}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "7:00 am", "10:30 pm" - a time of day on this phone's clock, the way the chat writes it. */
export function clockTime(at: number): string {
  const d = new Date(at);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/**
 * "today at 10:00 pm", "tomorrow at 7:00 am", "on Thu 23 Oct at 7:00 am" - a
 * moment still to come, for something set to happen then.
 */
export function aheadLabel(at: number, now: number = Date.now()): string {
  const then = new Date(at);
  const days = -daysBetween(then, new Date(now));
  const time = clockTime(at);
  if (days <= 0) return `today at ${time}`;
  if (days === 1) return `tomorrow at ${time}`;
  return `on ${DAY_NAMES[then.getDay()]} ${then.getDate()} ${MONTH_NAMES[then.getMonth()]} at ${time}`;
}
