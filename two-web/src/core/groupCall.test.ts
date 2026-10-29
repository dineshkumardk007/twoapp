import { describe, expect, it } from 'vitest';
import { inCallNow, offersTo } from './groupCall';

describe('inCallNow', () => {
  it('keeps those heard from lately, in order', () => {
    const now = 100_000;
    const members = {
      a: { name: 'Asha', at: now - 2_000 },
      b: { name: 'Bala', at: now - 20_000 },
      c: { name: 'Chitra', at: now - 12_000 }
    };
    expect(inCallNow(members, now)).toEqual([
      { id: 'a', name: 'Asha' },
      { id: 'c', name: 'Chitra' }
    ]);
  });
});

describe('offersTo', () => {
  it('lets exactly one of a pair make the offer', () => {
    expect(offersTo('a', 'b')).toBe(true);
    expect(offersTo('b', 'a')).toBe(false);
  });
});
