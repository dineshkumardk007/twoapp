import { describe, expect, it } from 'vitest';
import { loudness } from './call';

describe('how loud a voice looks', () => {
  it('runs from a hush to a raised voice', () => {
    expect(loudness(0)).toBe(0);
    expect(loudness(-1)).toBe(0);
    expect(loudness(NaN)).toBe(0);
    // -50 dB and below is still; -6 dB and above is full.
    expect(loudness(10 ** (-50 / 20))).toBeCloseTo(0, 5);
    expect(loudness(10 ** (-60 / 20))).toBe(0);
    expect(loudness(10 ** (-6 / 20))).toBeCloseTo(1, 5);
    expect(loudness(1)).toBe(1);
    // Ordinary speech lands in the middle, not at the floor.
    const speech = loudness(10 ** (-28 / 20));
    expect(speech).toBeGreaterThan(0.4);
    expect(speech).toBeLessThan(0.6);
  });
});
