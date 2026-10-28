// The date that floats at the top of a chat while you scroll through it
// (components/FloatingDayChip): which day is at the top, and for how long it
// stays once you stop.

/** After the last scroll, the date stays this long, then fades. */
export const FADE_AFTER_MS = 1500;

/**
 * The first of `count` things, in the order they sit down the page, whose
 * bottom is below `y` - or `count` when none is. Found by halving, as they
 * are in order, so a long conversation is not measured message by message on
 * every frame of a scroll.
 */
export function firstBelow(count: number, bottomOf: (i: number) => number, y: number): number {
  let lo = 0;
  let hi = count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bottomOf(mid) > y) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
