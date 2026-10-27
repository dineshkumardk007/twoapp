import { describe, expect, it } from 'vitest';
import { KEYBOARD_MIN_PX, ScreenFrame, coversDock, nextFrame, settleFrame } from './keyboard';

const W = 390;
const FULL = 844;

/** The frames a run of heights leaves behind, typing or not at each. */
function run(steps: Array<[number, boolean]>, width = W): ScreenFrame {
  let frame: ScreenFrame | null = null;
  for (const [height, typing] of steps) frame = nextFrame(frame, width, height, typing);
  return frame!;
}

describe('the height with no keyboard', () => {
  it('starts as the first height seen', () => {
    expect(nextFrame(null, W, FULL, false)).toEqual({ width: W, full: FULL, last: FULL });
    // Even while typing: there is nothing to measure a keyboard against yet.
    expect(nextFrame(null, W, 500, true)).toEqual({ width: W, full: 500, last: 500 });
  });

  it('is kept while the screen shrinks under a box being typed into', () => {
    const f = run([[FULL, false], [800, true], [700, true], [544, true]]);
    expect(f).toEqual({ width: W, full: FULL, last: 544 });
  });

  it('is reached again when the keyboard closes with the box still focused (Back)', () => {
    const f = run([[FULL, false], [544, true], [700, true], [FULL, true]]);
    expect(f).toEqual({ width: W, full: FULL, last: FULL });
    // And a tap on the same box opens it again.
    expect(nextFrame(f, W, 600, true)).toEqual({ width: W, full: FULL, last: 600 });
  });

  it('is kept while the keyboard goes away after the box let go (conversation tapped)', () => {
    const f = run([[FULL, false], [544, true], [600, false], [760, false]]);
    expect(f).toEqual({ width: W, full: FULL, last: 760 });
    expect(nextFrame(f, W, FULL, false).full).toBe(FULL);
  });

  it('becomes the shorter height when nothing is being typed into (bars back, split screen)', () => {
    const f = run([[FULL, false], [772, false]]);
    expect(f).toEqual({ width: W, full: 772, last: 772 });
    // From there a keyboard is measured against the new height.
    expect(nextFrame(f, W, 472, true)).toEqual({ width: W, full: 772, last: 472 });
  });

  it('grows with the screen (bars hidden)', () => {
    expect(run([[772, false], [FULL, false]]).full).toBe(FULL);
    expect(run([[772, false], [FULL, true]]).full).toBe(FULL);
  });

  it('starts over on a new width (rotation)', () => {
    const f = run([[FULL, false], [544, true]]);
    expect(nextFrame(f, FULL, W, true)).toEqual({ width: FULL, full: W, last: W });
  });
});

describe('a moment after the box lets go', () => {
  it('takes a screen still short as the new full height (split screen while typing)', () => {
    // Top and bottom split with the composer focused: same width, half the
    // height, read as a keyboard while the box kept focus.
    const f = run([[FULL, false], [422, true]]);
    expect(coversDock(f, 80)).toBe(true);
    // The box let go, and the height never came back.
    const settled = settleFrame(nextFrame(f, W, 422, false), false);
    expect(settled).toEqual({ width: W, full: 422, last: 422 });
    expect(coversDock(settled, 80)).toBe(false);
    // From there a keyboard is measured against the half.
    expect(nextFrame(settled, W, 222, true)).toEqual({ width: W, full: 422, last: 222 });
  });

  it('changes nothing once the keyboard has closed', () => {
    const f = run([[FULL, false], [544, true], [FULL, false]]);
    expect(settleFrame(f, false)).toBe(f);
  });

  it('changes nothing while something is typed into again', () => {
    const f = run([[FULL, false], [544, true]]);
    expect(settleFrame(f, true)).toBe(f);
  });

  it('comes right again when a slow keyboard closes after it', () => {
    const early = settleFrame(run([[FULL, false], [544, true], [700, false]]), false);
    expect(early.full).toBe(700);
    expect(nextFrame(early, W, FULL, false)).toEqual({ width: W, full: FULL, last: FULL });
  });
});

describe('the keyboard covering the dock', () => {
  const dock = 80;
  const at = (kb: number) => coversDock({ width: W, full: FULL, last: FULL - kb }, dock);

  it('is not up with no keyboard, or a strip shorter than a keyboard', () => {
    expect(at(0)).toBe(false);
    expect(at(dock)).toBe(false);
    expect(at(KEYBOARD_MIN_PX - 1)).toBe(false);
  });

  it('is up once a keyboard is past both the dock and the smallest keyboard', () => {
    expect(at(KEYBOARD_MIN_PX)).toBe(true);
    expect(at(300)).toBe(true);
    // A dock taller than the smallest keyboard (largest text) waits until it is all covered.
    const tall = { width: W, full: FULL, last: FULL - 150 };
    expect(coversDock(tall, 160)).toBe(false);
    expect(coversDock({ ...tall, last: FULL - 160 }, 160)).toBe(true);
  });
});
