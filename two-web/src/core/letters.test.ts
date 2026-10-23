import { describe, expect, it } from 'vitest';
import type { LoveLetter } from '../types';
import { cleanLetter, firstOpenOn, openOnWords, openedByReader, opensNow, waitsUntil } from './letters';

const letter = (over: Partial<LoveLetter> = {}): LoveLetter => ({
  id: 'l1',
  authorId: 'partner',
  authorName: 'Priya',
  title: 'For Valentine’s',
  body: 'Words',
  waxColor: 'gold',
  conditionType: 'date',
  sentDate: 'Today',
  isOpened: false,
  ...over
});

describe('a letter for a day', () => {
  it("waits on the reader's phone until that day", () => {
    const l = letter({ openOn: '2027-02-14' });
    expect(waitsUntil(l, 'user', '2027-02-13')).toBe('2027-02-14');
    expect(opensNow(l, 'user', '2027-02-13')).toBe(false);
    expect(waitsUntil(l, 'user', '2027-02-14')).toBeNull();
    expect(opensNow(l, 'user', '2027-02-14')).toBe(true);
  });
  it('never waits for the one who wrote it', () => {
    const l = letter({ openOn: '2027-02-14' });
    expect(waitsUntil(l, 'partner', '2027-01-01')).toBeNull();
  });
  it('a letter with no day opens any time', () => {
    expect(opensNow(letter(), 'user', '2027-01-01')).toBe(true);
  });
});

describe('opening', () => {
  it('is the reader\'s: your own letter is not opened by your reading it', () => {
    expect(opensNow(letter({ authorId: 'user' }), 'user', '2027-01-01')).toBe(false);
  });
  it('once opened, it is not opened again', () => {
    expect(opensNow(letter({ isOpened: true }), 'user', '2027-01-01')).toBe(false);
  });
});

describe('a letter as it arrives', () => {
  it('keeps a real day', () => {
    expect(cleanLetter(letter({ openOn: '2027-02-14' }))?.openOn).toBe('2027-02-14');
  });
  it('drops a day that is not one, keeping the letter', () => {
    const l = cleanLetter(letter({ openOn: '2027-02-30' }));
    expect(l?.id).toBe('l1');
    expect(l).not.toHaveProperty('openOn');
    expect(cleanLetter({ ...letter(), openOn: 'Valentine’s' })).not.toHaveProperty('openOn');
  });
  it('refuses what is not a letter', () => {
    expect(cleanLetter(null)).toBeNull();
    expect(cleanLetter({ title: 'no id' })).toBeNull();
  });
});

describe('opened, in your Sent tray', () => {
  it('only once the one it was written for has opened it', () => {
    expect(openedByReader(letter({ isOpened: true, openedBy: 'user' }))).toBe(true);
    expect(openedByReader(letter({ isOpened: true, openedBy: 'partner' }))).toBe(false);
    // Marked opened by an older version, with nobody named: it cannot say.
    expect(openedByReader(letter({ isOpened: true }))).toBe(false);
    expect(openedByReader(letter())).toBe(false);
  });
});

describe('its day, in words', () => {
  it('with the year only when it is not this one', () => {
    expect(openOnWords('2026-11-14', '2026-10-23')).not.toMatch(/2026/);
    expect(openOnWords('2027-10-30', '2026-10-23')).toMatch(/2027/);
  });
});

describe('the first day it can be set for', () => {
  it('is tomorrow, across a month and a year', () => {
    expect(firstOpenOn('2026-10-22')).toBe('2026-10-23');
    expect(firstOpenOn('2026-10-31')).toBe('2026-11-01');
    expect(firstOpenOn('2026-12-31')).toBe('2027-01-01');
  });
});
