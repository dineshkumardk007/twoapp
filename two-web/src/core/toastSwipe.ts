// Pushing the floating notice away (components/InAppNotificationToast).
//
// A finger on the notice can send it up, or off either side, the way a phone's
// own banner goes. While the finger is down the notice follows it exactly;
// let go, it either carries on out of the way it was pushed or springs back to
// where it was. What decides is here, apart from the component, so the lines
// it has to cross can be checked: far enough, or quick enough, and in the
// direction it is already going. A flick back towards the middle keeps it,
// however far it had been dragged.

/** Which way a notice leaves the screen. */
export type ToastExit = 'up' | 'left' | 'right';

/** Sideways or up and down: a drag sticks to the one it started in. */
export type SwipeAxis = 'x' | 'y';

/** Where the finger was, and when (an event's timeStamp, in ms). */
export interface SwipeSample {
  x: number;
  y: number;
  t: number;
}

/** A finger that has moved less than this, either way, is still a tap. */
export const TOAST_SLOP_PX = 10;
/** Pushed sideways past this share of its own width, it goes when let go. */
export const SIDE_SHARE = 0.35;
/** Pushed up this far, it goes when let go. It is short, and starts near the top. */
export const UP_PX = 32;
/** Flicked sideways at least this fast, in px per ms, it goes however short the push. */
export const FLING_SIDE = 0.3;
/** The same for a flick up. */
export const FLING_UP = 0.3;
/** The finger's speed is taken over the last this-many ms before it lifts. */
export const SPEED_WINDOW_MS = 100;
/** Pulled down, where it has nowhere to go, it gives this much at most. */
export const DOWN_GIVE_PX = 12;

/** Which way a drag has gone once the finger is past the slop; null while it is still a tap. */
export function swipeAxis(dx: number, dy: number): SwipeAxis | null {
  if (Math.abs(dx) < TOAST_SLOP_PX && Math.abs(dy) < TOAST_SLOP_PX) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}

/** Where the notice sits under the finger: with it, sideways or up; pulled down, a little and no more. */
export function swipeOffset(axis: SwipeAxis, dx: number, dy: number): { x: number; y: number } {
  if (axis === 'x') return { x: dx, y: 0 };
  return { x: 0, y: dy < 0 ? dy : Math.min(DOWN_GIVE_PX, dy * 0.2) };
}

/**
 * How solid it is on the way out: fading as it goes, to 40% by the time it
 * has travelled its own width sideways or its own height up.
 */
export function swipeFade(offset: { x: number; y: number }, width: number, height: number): number {
  const gone = offset.x !== 0
    ? Math.abs(offset.x) / Math.max(1, width)
    : Math.max(0, -offset.y) / Math.max(1, height);
  return 1 - Math.min(1, gone) * 0.6;
}

/** Whether it has been pushed far enough to go when let go, as the finger is now. */
export function swipePast(axis: SwipeAxis, dx: number, dy: number, width: number): boolean {
  return axis === 'x' ? Math.abs(dx) >= width * SIDE_SHARE : dy <= -UP_PX;
}

/**
 * How fast the finger was going as it lifted, in px per ms, from the samples
 * in order with the lift itself last. Only the last SPEED_WINDOW_MS count, so
 * a finger that stopped before lifting has no speed, however fast it moved
 * before it stopped.
 */
export function liftSpeed(samples: readonly SwipeSample[]): { vx: number; vy: number } {
  const last = samples[samples.length - 1];
  if (!last) return { vx: 0, vy: 0 };
  const first = samples.find(s => last.t - s.t <= SPEED_WINDOW_MS);
  if (!first || first === last || last.t <= first.t) return { vx: 0, vy: 0 };
  const dt = last.t - first.t;
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

/**
 * Where a notice goes when the finger lifts, or null when it springs back.
 * dx and dy are from where the finger came down; vx and vy its speed as it
 * lifted (liftSpeed); width the notice's own.
 */
export function swipeVerdict(end: {
  axis: SwipeAxis;
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  width: number;
}): ToastExit | null {
  const { axis, dx, dy, vx, vy, width } = end;
  if (axis === 'x') {
    if (dx === 0) return null;
    const flung = Math.abs(vx) >= FLING_SIDE;
    // Flicked back towards the middle: it stays.
    if (flung && Math.sign(vx) !== Math.sign(dx)) return null;
    if (!flung && !swipePast(axis, dx, dy, width)) return null;
    return dx < 0 ? 'left' : 'right';
  }
  // Pulled down, or brought back below where it started: it has nowhere to go.
  if (dy >= 0) return null;
  if (vy >= FLING_UP) return null;
  return vy <= -FLING_UP || swipePast(axis, dx, dy, width) ? 'up' : null;
}
