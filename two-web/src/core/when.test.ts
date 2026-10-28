import { afterEach, describe, expect, it } from 'vitest';
import { chooseLocale } from './i18n';
import { dayAndTime, dayLabel, startOfDay } from './when';

const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo, d, h, mi).getTime();

afterEach(() => chooseLocale('en'));

describe('the name of a day, as a chat says it', () => {
  const now = at(2026, 9, 28, 15);
  it('says Today and Yesterday by the calendar, not by 24 hours', () => {
    expect(dayLabel(startOfDay(at(2026, 9, 28, 0, 5)), now)).toBe('Today');
    expect(dayLabel(startOfDay(at(2026, 9, 27, 23, 59)), now)).toBe('Yesterday');
  });
  it('names an older day of this year without its year', () => {
    const label = dayLabel(startOfDay(at(2026, 9, 12)), now);
    expect(label).toContain('12');
    expect(label).not.toContain('2026');
  });
  it('gives the year for a day in another year', () => {
    expect(dayLabel(startOfDay(at(2025, 2, 3)), now)).toContain('2025');
  });
  it('says Tomorrow only for a message set to show then', () => {
    const tomorrow = startOfDay(at(2026, 9, 29));
    expect(dayLabel(tomorrow, now, true)).toBe('Tomorrow');
    // The other phone's clock running ahead is not news: today.
    expect(dayLabel(tomorrow, now)).toBe('Today');
  });
});

describe('a moment with its day', () => {
  const now = at(2026, 9, 28, 15);
  it('is the day and the time of day', () => {
    expect(dayAndTime(at(2026, 9, 28, 21, 41), now)).toBe('Today, 9:41 pm');
    expect(dayAndTime(at(2026, 9, 27, 7, 2), now)).toBe('Yesterday, 7:02 am');
  });
  it('in Tamil, with the time said the Tamil way', () => {
    chooseLocale('ta');
    expect(dayAndTime(at(2026, 9, 27, 21, 41), now)).toBe('நேற்று, இரவு 9:41');
  });
});
