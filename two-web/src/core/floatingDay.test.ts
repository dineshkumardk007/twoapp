import { describe, expect, it } from 'vitest';
import { firstBelow } from './floatingDay';

describe('the message at the top of the view', () => {
  // Bubbles 40px tall, one under the other.
  const bottoms = [40, 80, 120, 160, 200];
  const bottomOf = (i: number) => bottoms[i];

  it('is the first whose bottom is below the top', () => {
    expect(firstBelow(bottoms.length, bottomOf, 0)).toBe(0);
    expect(firstBelow(bottoms.length, bottomOf, 40)).toBe(1);
    expect(firstBelow(bottoms.length, bottomOf, 95)).toBe(2);
  });

  it('is none when everything is above it, or there is nothing', () => {
    expect(firstBelow(bottoms.length, bottomOf, 200)).toBe(5);
    expect(firstBelow(0, bottomOf, 0)).toBe(0);
  });

  it('measures only a few of a long conversation', () => {
    let asked = 0;
    const at = firstBelow(5000, i => (asked++, (i + 1) * 40), 40 * 3000 + 1);
    expect(at).toBe(3000);
    expect(asked).toBeLessThan(20);
  });
});
