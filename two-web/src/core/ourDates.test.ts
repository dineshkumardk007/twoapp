import { describe, it, expect } from 'vitest';
import { daysTogether, nextAnniversary, newerOurDates, cleanOurDates, ordinal, localDateKey } from './ourDates';

describe('Days together', () => {
  it('counts whole days, 0 on the day itself', () => {
    expect(daysTogether('2026-10-12', '2026-10-12')).toBe(0);
    expect(daysTogether('2025-10-12', '2026-10-12')).toBe(365);
  });

  it('counts across a leap year', () => {
    expect(daysTogether('2024-01-01', '2025-01-01')).toBe(366);
  });

  it('is unmoved by clock changes: days, not hours', () => {
    // Daylight-saving shifts in Europe and the US fall inside these ranges.
    expect(daysTogether('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysTogether('2026-10-20', '2026-11-10')).toBe(21);
  });
});

describe('Next anniversary', () => {
  it('counts down to the coming one and says which it is', () => {
    expect(nextAnniversary({ at: 1, togetherSince: '2022-02-14' }, '2026-02-10')).toEqual({
      date: '2026-02-14',
      daysUntil: 4,
      years: 4
    });
  });

  it('is today on the day', () => {
    expect(nextAnniversary({ at: 1, togetherSince: '2022-02-14' }, '2026-02-14')?.daysUntil).toBe(0);
  });

  it('moves on to next year the day after', () => {
    expect(nextAnniversary({ at: 1, togetherSince: '2022-02-14' }, '2026-02-15')?.date).toBe('2027-02-14');
  });

  it('keeps 29 February on the 28th in a year without one', () => {
    expect(nextAnniversary({ at: 1, togetherSince: '2020-02-29' }, '2026-01-01')?.date).toBe('2026-02-28');
    expect(nextAnniversary({ at: 1, togetherSince: '2020-02-29' }, '2028-01-01')?.date).toBe('2028-02-29');
  });

  it('prefers the anniversary over the day it began, and works without a year', () => {
    const next = nextAnniversary({ at: 1, togetherSince: '2020-05-01', anniversary: '12-25' }, '2026-12-01');
    expect(next).toEqual({ date: '2026-12-25', daysUntil: 24, years: undefined });
  });

  it('is nothing at all with no dates', () => {
    expect(nextAnniversary({ at: 1 }, '2026-01-01')).toBeNull();
  });
});

describe('Dates set on both phones', () => {
  it('lets the newest setting win, whichever phone it came from', () => {
    const older = { at: 100, togetherSince: '2021-01-01' };
    const newer = { at: 200, togetherSince: '2022-02-14' };
    expect(newerOurDates(newer, older)).toBe(newer);
    expect(newerOurDates(older, newer)).toBeNull();
  });

  it('settles a same-moment tie the same way on both phones', () => {
    const a = { at: 100, togetherSince: '2021-01-01' };
    const b = { at: 100, togetherSince: '2022-02-14' };
    const onPhoneOne = newerOurDates(a, b) ?? b;
    const onPhoneTwo = newerOurDates(b, a) ?? a;
    expect(onPhoneOne).toEqual(onPhoneTwo);
  });

  it('drops a date that is not a real date', () => {
    expect(cleanOurDates({ at: 5, togetherSince: '2026-02-30' })).toEqual({ at: 5 });
    expect(cleanOurDates({ togetherSince: '2026-02-01' })).toBeNull();
  });
});

describe('Small helpers', () => {
  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st'
    ]);
  });

  it("names the phone's own day, not the UTC one", () => {
    expect(localDateKey(new Date(2026, 0, 1, 23, 30))).toBe('2026-01-01');
  });
});
