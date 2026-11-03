import { describe, expect, it } from 'vitest';
import { laidWhileMoving, rideKeyboard, rideOffset } from './keyboardRide';

describe('where the message box goes', () => {
  it('waits for the keyboard to pass the dock, then goes with it', () => {
    expect(rideOffset(40, 0, 60)).toBe(-0);
    expect(rideOffset(160, 0, 60)).toBe(-100);
    expect(rideOffset(300, 0, 0)).toBe(-300);
  });

  it('starts a closing keyboard from where the box was', () => {
    // Laid out for no keyboard at once; the box begins at the keyboard's height.
    expect(rideOffset(300, 0, 0)).toBe(-300);
    expect(rideOffset(0, 0, 0)).toBe(-0);
  });

  it('keeps the taller conversation while the keyboard moves', () => {
    expect(laidWhileMoving(0, 300)).toBe(0);
    expect(laidWhileMoving(300, 0)).toBe(0);
    expect(laidWhileMoving(280, 300)).toBe(280);
  });
});

describe('riding the keyboard', () => {
  it('does nothing where there is no app to ask', () => {
    const stop = rideKeyboard();
    expect(() => stop()).not.toThrow();
  });
});
