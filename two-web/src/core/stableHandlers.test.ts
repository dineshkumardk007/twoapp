import { describe, expect, it } from 'vitest';
import { sameOr, stableHandlers } from './stableHandlers';

describe('the same values kept as the same object', () => {
  it('a list with the same names in the same order is the old one', () => {
    const before = ['a', 'b'];
    expect(sameOr(before, ['a', 'b'])).toBe(before);
  });
  it('a different list is the new one', () => {
    const before = ['a', 'b'];
    const after = ['b', 'a'];
    expect(sameOr(before, after)).toBe(after);
    const shorter = ['a'];
    expect(sameOr(before, shorter)).toBe(shorter);
  });
  it('counts by group, the same, are the old ones', () => {
    const before: Record<string, number> = { g1: 0, g2: 3 };
    expect(sameOr(before, { g2: 3, g1: 0 })).toBe(before);
    const after = { g1: 1, g2: 3 };
    expect(sameOr(before, after)).toBe(after);
    const other = { g1: 0, g3: 3 };
    expect(sameOr(before, other)).toBe(other);
  });
  it('nothing typing, twice, is no change', () => {
    const before: string[] = [];
    expect(sameOr(before, [])).toBe(before);
  });
});

describe('handlers that keep one identity', () => {
  it('a name is the same function on every render', () => {
    const h = stableHandlers();
    h.begin();
    const first = h.stable('send', () => 1);
    h.commit();
    h.begin();
    const second = h.stable('send', () => 2);
    h.commit();
    expect(second).toBe(first);
  });

  it('calls what the render on screen gave', () => {
    const h = stableHandlers();
    const said: string[] = [];
    h.begin();
    const send = h.stable('send', (text: string) => said.push(`one:${text}`));
    h.commit();
    send('a');
    h.begin();
    h.stable('send', (text: string) => said.push(`two:${text}`));
    h.commit();
    send('b');
    expect(said).toEqual(['one:a', 'two:b']);
  });

  it('a render not yet on screen changes nothing a tap does', () => {
    // A tab still loading: its render is worked out, and not shown.
    const h = stableHandlers();
    const said: string[] = [];
    h.begin();
    const send = h.stable('send', () => said.push('shown'));
    h.commit();
    h.begin();
    h.stable('send', () => said.push('loading'));
    send();
    expect(said).toEqual(['shown']);
  });

  it('passes back what the handler returns', () => {
    const h = stableHandlers();
    h.begin();
    const join = h.stable('join', (code: string) => (code ? null : 'empty'));
    h.commit();
    expect(join('')).toBe('empty');
    expect(join('x')).toBeNull();
  });

  it('names stay apart', () => {
    const h = stableHandlers();
    h.begin();
    const a = h.stable('draft:one', () => 'one');
    const b = h.stable('draft:two', () => 'two');
    h.commit();
    expect(a).not.toBe(b);
    expect(a()).toBe('one');
    expect(b()).toBe('two');
  });
});
