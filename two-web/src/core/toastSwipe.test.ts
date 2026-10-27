import { describe, expect, it } from 'vitest';
import {
  DOWN_GIVE_PX,
  FLING_SIDE,
  FLING_UP,
  SIDE_SHARE,
  SPEED_WINDOW_MS,
  TOAST_SLOP_PX,
  UP_PX,
  liftSpeed,
  swipeAxis,
  swipeFade,
  swipeOffset,
  swipePast,
  swipeVerdict
} from './toastSwipe';

const WIDTH = 360;
const end = (over: Partial<Parameters<typeof swipeVerdict>[0]>) =>
  swipeVerdict({ axis: 'x', dx: 0, dy: 0, vx: 0, vy: 0, width: WIDTH, ...over });

describe('a drag on the notice', () => {
  it('is still a tap inside the slop', () => {
    expect(swipeAxis(0, 0)).toBeNull();
    expect(swipeAxis(TOAST_SLOP_PX - 1, -(TOAST_SLOP_PX - 1))).toBeNull();
  });
  it('sticks to the way it went first', () => {
    expect(swipeAxis(TOAST_SLOP_PX, 2)).toBe('x');
    expect(swipeAxis(-14, 9)).toBe('x');
    expect(swipeAxis(3, -TOAST_SLOP_PX)).toBe('y');
    expect(swipeAxis(12, -12)).toBe('y');
  });
  it('follows the finger exactly sideways and up', () => {
    expect(swipeOffset('x', -120, 40)).toEqual({ x: -120, y: 0 });
    expect(swipeOffset('y', 30, -45)).toEqual({ x: 0, y: -45 });
  });
  it('gives only a little when pulled down', () => {
    expect(swipeOffset('y', 0, 20).y).toBeCloseTo(4);
    expect(swipeOffset('y', 0, 400).y).toBe(DOWN_GIVE_PX);
  });
  it('fades as it goes, never below 40%', () => {
    expect(swipeFade({ x: 0, y: 0 }, WIDTH, 70)).toBe(1);
    expect(swipeFade({ x: -WIDTH / 2, y: 0 }, WIDTH, 70)).toBeCloseTo(0.7);
    expect(swipeFade({ x: 2 * WIDTH, y: 0 }, WIDTH, 70)).toBeCloseTo(0.4);
    expect(swipeFade({ x: 0, y: -35 }, WIDTH, 70)).toBeCloseTo(0.7);
    expect(swipeFade({ x: 0, y: DOWN_GIVE_PX }, WIDTH, 70)).toBe(1);
  });
});

describe('how fast the finger lifted', () => {
  it('is the distance over the last moments', () => {
    const v = liftSpeed([
      { x: 0, y: 0, t: 0 },
      { x: 20, y: -5, t: 40 },
      { x: 60, y: -10, t: 80 }
    ]);
    expect(v.vx).toBeCloseTo(0.75);
    expect(v.vy).toBeCloseTo(-0.125);
  });
  it('counts only the window before the lift', () => {
    const v = liftSpeed([
      { x: 0, y: 0, t: 0 },
      { x: 200, y: 0, t: 50 },
      { x: 210, y: 0, t: 50 + SPEED_WINDOW_MS }
    ]);
    expect(v.vx).toBeCloseTo(10 / SPEED_WINDOW_MS);
  });
  it('is nothing for a finger that stopped before lifting', () => {
    expect(liftSpeed([{ x: 0, y: 0, t: 0 }, { x: 300, y: 0, t: 30 }, { x: 300, y: 0, t: 400 }])).toEqual({
      vx: 0,
      vy: 0
    });
    expect(liftSpeed([{ x: 5, y: 5, t: 10 }])).toEqual({ vx: 0, vy: 0 });
    expect(liftSpeed([])).toEqual({ vx: 0, vy: 0 });
  });
});

describe('when the finger lifts, the notice', () => {
  const side = WIDTH * SIDE_SHARE;

  it('goes off the side it was pushed, once far enough', () => {
    expect(end({ dx: side })).toBe('right');
    expect(end({ dx: -side })).toBe('left');
    expect(swipePast('x', side - 1, 0, WIDTH)).toBe(false);
  });
  it('springs back from a short slow push', () => {
    expect(end({ dx: side - 1, vx: FLING_SIDE / 2 })).toBeNull();
    expect(end({ dx: -30 })).toBeNull();
  });
  it('goes on a quick flick, however short', () => {
    expect(end({ dx: 24, vx: FLING_SIDE })).toBe('right');
    expect(end({ dx: -24, vx: -FLING_SIDE * 2 })).toBe('left');
  });
  it('stays when flicked back towards the middle', () => {
    expect(end({ dx: side + 50, vx: -FLING_SIDE })).toBeNull();
    expect(end({ dx: -(side + 50), vx: FLING_SIDE })).toBeNull();
  });
  it('stays when brought back to the middle', () => {
    expect(end({ dx: 0, vx: FLING_SIDE * 3 })).toBeNull();
  });
  it('goes up, once far enough or flicked', () => {
    expect(end({ axis: 'y', dy: -UP_PX })).toBe('up');
    expect(end({ axis: 'y', dy: -(UP_PX - 1) })).toBeNull();
    expect(end({ axis: 'y', dy: -14, vy: -FLING_UP })).toBe('up');
  });
  it('stays when flicked back down, or pulled down', () => {
    expect(end({ axis: 'y', dy: -(UP_PX + 20), vy: FLING_UP })).toBeNull();
    expect(end({ axis: 'y', dy: 40, vy: -FLING_UP * 3 })).toBeNull();
    expect(end({ axis: 'y', dy: 0, vy: -FLING_UP * 3 })).toBeNull();
  });
  it('never goes sideways from an up-and-down drag, nor up from a sideways one', () => {
    expect(end({ axis: 'y', dx: 300, dy: -2, vx: 3 })).toBeNull();
    expect(end({ axis: 'x', dx: 12, dy: -200, vy: -3 })).toBeNull();
  });
});
