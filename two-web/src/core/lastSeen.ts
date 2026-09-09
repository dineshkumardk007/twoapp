// "Last seen" - when your partner's device was last awake in this space.
//
// The relay knows who is connected right now and says so, but nobody was
// keeping the answer once they left. This carries it: each device sends an
// encrypted beat while it is open, so the other side can say "last seen today
// at 14:20" instead of falling silent the moment the socket drops.

const SHARE_KEY = 'two_share_last_seen_v1';

/** The record type both ends and the relay agree on. */
export const PRESENCE_BEAT = 'PRESENCE_BEAT';

/**
 * How often an open app says it is still here.
 *
 * Two minutes is a compromise: often enough that "last seen" is not wrong by
 * much, rare enough that it is not a stream of writes. The relay keeps only
 * the newest beat per device, so the cost is one row either way - this is
 * about traffic and battery, not storage.
 */
export const BEAT_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Whether this device shares its own last seen.
 *
 * On by default, matching what people expect from every messenger they have
 * used. The reciprocity below is what keeps that fair.
 */
export function readShareLastSeen(): boolean {
  try {
    return localStorage.getItem(SHARE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeShareLastSeen(share: boolean) {
  try {
    localStorage.setItem(SHARE_KEY, share ? 'true' : 'false');
  } catch {
    /* private mode - this run keeps the value it was given */
  }
}

/**
 * Formats a moment the way a messenger does.
 *
 * Exact times, as asked for - the point of the feature is knowing when, and a
 * vague "a while ago" answers nothing. Only the date part gets softer as it
 * recedes, because "last seen on Tuesday at 21:14" reads better than a date.
 */
export function formatLastSeen(at: number, now = Date.now()): string {
  if (!at || at > now + 60_000) return '';

  const then = new Date(at);
  const time = then.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);

  if (at >= startOfToday.getTime()) return `last seen today at ${time}`;
  if (at >= startOfYesterday.getTime()) return `last seen yesterday at ${time}`;

  // Inside the last week, the weekday is the more useful handle.
  if (now - at < 7 * 86_400_000) {
    const weekday = then.toLocaleDateString(undefined, { weekday: 'long' });
    return `last seen ${weekday} at ${time}`;
  }

  const date = then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `last seen ${date} at ${time}`;
}

// --- Read receipts and typing ------------------------------------------------

const RECEIPTS_KEY = 'two_share_receipts_v1';

/** The signal type for "I am writing something", sent and never stored. */
export const TYPING_SIGNAL = 'TYPING';

/** How long a received "typing" stays true without another arriving. */
export const TYPING_TTL_MS = 6000;

/** How often a still-typing device repeats itself. */
export const TYPING_REPEAT_MS = 3000;

/**
 * Whether this device sends read receipts and typing.
 *
 * One switch for both, as WhatsApp has it: they answer the same question -
 * what am I doing in this conversation right now - and splitting them would
 * offer a privacy setting that leaks the thing it claims to hide.
 */
export function readShareReceipts(): boolean {
  try {
    return localStorage.getItem(RECEIPTS_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeShareReceipts(share: boolean) {
  try {
    localStorage.setItem(RECEIPTS_KEY, share ? 'true' : 'false');
  } catch {
    /* private mode - this run keeps the value it was given */
  }
}
