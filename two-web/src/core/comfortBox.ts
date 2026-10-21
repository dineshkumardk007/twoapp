// The comfort box: a note each of you leaves for the other, for a heavy day.
//
// There used to be one box between the two of you, saved under one id, so the
// note one of you wrote for the other replaced the note written for you - and
// on your own heavy day the box could open on "Your note for <partner>"
// instead of anything for you. Now each of you has your own box, kept under
// its author's seat, and the box opens on the one written for you.

import { ComfortBoxData } from '../types';

type Seat = 'user' | 'partner';

/** The id of the box written by this seat - one each, so neither replaces the other. */
export function comfortBoxId(author: Seat): string {
  return `cb-${author}`;
}

/**
 * The box written for you, and the one you wrote, from everything saved.
 *
 * Boxes are kept newest first, so the first one by each author is that
 * author's latest - which also lets a box saved under the old shared id stand
 * until its author saves again.
 */
export function comfortBoxesFor(
  boxes: ComfortBoxData[],
  me: Seat
): { forMe: ComfortBoxData | undefined; mine: ComfortBoxData | undefined } {
  return {
    forMe: boxes.find(box => box.authorId !== me),
    mine: boxes.find(box => box.authorId === me)
  };
}

/**
 * The boxes with this one saved or arrived: kept under its author's own id,
 * whatever id it came with, and put first.
 *
 * A phone still on the version before this one opens the newest box it holds
 * and saves over it with its own seat - so a note it writes can arrive under
 * the other person's id ("cb-user" from the 'partner' seat). Taken as it came,
 * that replaced the other person's note here too. Filed by author, it can only
 * ever replace that author's own earlier note.
 */
export function withBox(boxes: ComfortBoxData[], box: ComfortBoxData): ComfortBoxData[] {
  if (!box || typeof box !== 'object') return boxes;
  const author = box.authorId;
  const filed = author === 'user' || author === 'partner' ? { ...box, id: comfortBoxId(author) } : box;
  return [filed, ...boxes.filter(b => b.id !== filed.id)];
}

/** Whether a box has anything in it to read or look at. */
export function hasComfort(box: ComfortBoxData | undefined): boolean {
  return !!box && (!!box.reassuranceNote?.trim() || (box.photoUrls?.length ?? 0) > 0);
}
