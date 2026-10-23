// Love letters: which ones wait for a day, and which can be opened now.
//
// A letter can say "Open on 14 February" (LoveLetter.openOn). Until that day,
// on the reader's own calendar, Two keeps it closed on the screen - a gentle
// wait, not a lock: the words are on the phone from the moment it arrives,
// as with every other letter. The one who wrote it can read it at any time.
//
// Opening is the reader's: a letter you wrote is never marked opened by your
// reading it, so your Sent tray says "opened" only once your partner has.

import type { LoveLetter } from '../types';
import { formatDay, isCalendarDate, localDateKey } from './ourDates';

type Seat = 'user' | 'partner';

/** What a phone says in its APP_VERSION when it keeps a dated letter closed until its day. */
export const CAN_DATE_LETTERS = 'openOn';

/** The day a letter of your partner's is still waiting for, or null when it can be opened. */
export function waitsUntil(letter: LoveLetter, me: Seat, today: string = localDateKey()): string | null {
  if (letter.authorId === me || letter.isOpened || !letter.openOn) return null;
  return letter.openOn > today ? letter.openOn : null;
}

/** Whether reading it now opens it: your partner's, not yet opened, and its day come. */
export function opensNow(letter: LoveLetter, me: Seat, today: string = localDateKey()): boolean {
  return letter.authorId !== me && !letter.isOpened && !waitsUntil(letter, me, today);
}

/** A letter as it came from the other phone, its day kept only if it is a real one. */
export function cleanLetter(raw: unknown): LoveLetter | null {
  if (!raw || typeof raw !== 'object') return null;
  const letter = raw as LoveLetter;
  if (typeof letter.id !== 'string' || !letter.id) return null;
  const { openOn, ...rest } = letter;
  return isCalendarDate(openOn) ? { ...rest, openOn } : rest;
}

/** Whether the one it was written for has opened it - not its writer reading it again. */
export function openedByReader(letter: LoveLetter): boolean {
  return letter.isOpened && !!letter.openedBy && letter.openedBy !== letter.authorId;
}

/** "14 February", or "14 February 2027" when it is not this year. */
export function openOnWords(openOn: string, today: string = localDateKey()): string {
  return formatDay(openOn, openOn.slice(0, 4) !== today.slice(0, 4));
}

/** The earliest day a letter can be set for: tomorrow. Today needs no waiting. */
export function firstOpenOn(today: string = localDateKey()): string {
  const [y, m, d] = today.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + 1));
}
