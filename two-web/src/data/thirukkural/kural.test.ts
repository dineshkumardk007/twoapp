import { describe, it, expect } from 'vitest';
import { kuralNumberFor, getKural, KURAL_COUNT } from './index';

describe('The kural of the day', () => {
  it('starts the book on its first day and moves on one a day', () => {
    expect(kuralNumberFor('2026-10-13')).toBe(1);
    expect(kuralNumberFor('2026-10-14')).toBe(2);
    expect(kuralNumberFor('2026-11-12')).toBe(31);
  });

  it('goes round again after the 1,330th', () => {
    // 1,329 days after the first day is the last kural; the next day is 1 again.
    expect(kuralNumberFor('2030-06-03')).toBe(1330);
    expect(kuralNumberFor('2030-06-04')).toBe(1);
  });

  it('gives a number in range for days before it began', () => {
    const n = kuralNumberFor('2026-10-12');
    expect(n).toBe(KURAL_COUNT);
  });

  it('has every kural, each with its chapter and book', async () => {
    const first = await getKural(1);
    expect(first.line1).toContain('அகர முதல');
    expect(first.chapter).toEqual({ number: 1, tamil: 'கடவுள் வாழ்த்து', english: 'The Praise of God' });
    expect(first.book.english).toBe('Virtue');
    expect(first.pope.length).toBeGreaterThan(20);
    expect(first.meaning).toMatch(/first/);

    const wealth = await getKural(381);
    expect(wealth.book.english).toBe('Wealth');
    expect(wealth.chapter.number).toBe(39);

    const last = await getKural(1330);
    expect(last.book.english).toBe('Love');
    expect(last.chapter.number).toBe(133);
  });
});
