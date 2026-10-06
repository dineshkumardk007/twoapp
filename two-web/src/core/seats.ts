// Telling the two seats of a space apart, and putting a phone back in the
// right one.
//
// A space has two seats, 'user' (whoever created it) and 'partner', and
// everything the relay does depends on the two phones holding different ones.
// When they do not, nothing fails loudly; see RoleClashDialog for what breaks
// and how it is noticed.

import { SHARED_RECORD_TYPES, EXPENSES_SETTLED } from './sharedRecords';

/** Names a phone holds before anybody has typed one. They say nothing about who it is. */
const PLACEHOLDER_NAMES = new Set(['', 'you', 'partner']);

/** A name somebody actually chose, as opposed to a placeholder. */
export function isRealName(name: string | null | undefined): boolean {
  return !PLACEHOLDER_NAMES.has((name || '').trim().toLowerCase());
}

const OWN_DEVICE_NAMES_KEY = 'two_own_device_names_v1';

function readOwnDeviceNames(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(OWN_DEVICE_NAMES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Whether this phone has been told that `name` is its own owner on another
 * device - "Dinesh" on the phone, "DK" on the tablet.
 *
 * One person may hold the same seat on two devices under two spellings of
 * their name, and that is not a clash. Kept per device, and only names: there
 * is nothing secret in them.
 */
export function isOwnDeviceName(name: string): boolean {
  const wanted = name.trim().toLowerCase();
  return readOwnDeviceNames().some(n => n.trim().toLowerCase() === wanted);
}

export function rememberOwnDeviceName(name: string) {
  const clean = name.trim();
  if (!clean || isOwnDeviceName(clean)) return;
  try {
    localStorage.setItem(OWN_DEVICE_NAMES_KEY, JSON.stringify([...readOwnDeviceNames(), clean].slice(-10)));
  } catch {
    /* storage unavailable: the question may simply come up again */
  }
}

/**
 * What a phone may apply when it fetches history again after changing seat.
 *
 * While two phones shared a seat, the relay withheld everything the other
 * person wrote while this phone was away - it never replays a seat's own
 * records back to it. Moving seat does not bring those back by itself: the
 * phone's read position is already past them. So after a seat switch the
 * history is fetched once more from the start.
 *
 * Fetched again onto a phone that already holds most of it, history is only
 * safe to apply where applying twice changes nothing: things that are added
 * once by id (and added-only during the catch-up, never replacing what is
 * here), and settings whose every change is in that same history, in order.
 * Everything that acts rather than adds is left out - an undo would take away
 * a second stroke, a toggle would flip back, a settle-up would settle debts
 * added since. Drawing is left out entirely, because strokes without the
 * undos and clears between them would bring back what was rubbed out.
 */
export const CATCH_UP_TYPES = new Set<string>([
  'CHAT',
  // Marks one voice note heard; marking it again changes nothing.
  'VOICE_HEARD',
  'LOVE_LETTER',
  'GRATITUDE_STAR',
  'INTUITION_ROUND',
  'LIST_ITEM',
  'MIDNIGHT_RADIO_WHISPER',
  'STATE_OF_UNION_SEAL',
  'CANVAS_SAVE_SKETCH',
  ...[...SHARED_RECORD_TYPES].filter(type => type !== EXPENSES_SETTLED)
]);

/**
 * `list` with `item` added - unless something with its id is already there.
 *
 * Several handlers used to add whatever arrived, so the same record applied
 * twice (a replay overlapping what was already received, a catch-up) put the
 * same stroke, seal or list entry on screen twice.
 */
export function addOnce<T>(list: T[] | undefined, item: T, where: 'start' | 'end' = 'start'): T[] {
  const current = list || [];
  const id = (item as { id?: unknown } | null)?.id;
  if (id !== undefined && current.some(existing => (existing as { id?: unknown }).id === id)) {
    return current;
  }
  return where === 'start' ? [item, ...current] : [...current, item];
}
