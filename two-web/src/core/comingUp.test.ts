import { describe, expect, it } from 'vitest';
import { cleanDay, liveDays, mergeDays, upcoming, whenWords, type ComingUpDay } from './comingUp';
import { FESTIVALS } from '../data/festivals';

const day = (over: Partial<ComingUpDay>): ComingUpDay => ({
  id: 'd1', kind: 'birthday', date: '1996-11-02', yearly: true, who: 'partner', at: 100, ...over
});

describe('coming up: the days you set', () => {
  it('merges day by day, the newer setting winning', () => {
    const mine = [day({ id: 'b-user', who: 'user', date: '1995-03-10', at: 100 })];
    const theirs = [day({ id: 'b-partner', who: 'partner', at: 200 }), day({ id: 'b-user', who: 'user', date: '1995-03-11', at: 50 })];
    const merged = mergeDays(mine, theirs);
    expect(merged).toHaveLength(2);
    expect(merged.find(d => d.id === 'b-user')?.date).toBe('1995-03-10');
  });

  it('a day taken off stays off, whatever older copy arrives', () => {
    const removed = mergeDays([day({ at: 100 })], [{ ...day({ at: 300 }), removed: true }]);
    expect(liveDays(removed)).toHaveLength(0);
    expect(liveDays(mergeDays(removed, [day({ at: 100 })]))).toHaveLength(0);
  });

  it('returns the same list when nothing is new', () => {
    const list = [day({})];
    expect(mergeDays(list, [day({})])).toBe(list);
    expect(mergeDays(list, 'nonsense')).toBe(list);
  });

  it('refuses broken days', () => {
    expect(cleanDay({ ...day({}), date: '2026-02-30' })).toBeNull();
    expect(cleanDay({ ...day({}), who: undefined })).toBeNull();
    expect(cleanDay({ ...day({}), kind: 'day', label: '' })).toBeNull();
    expect(cleanDay({ ...day({}), at: 0 })).toBeNull();
    expect(cleanDay({ id: 'x', kind: 'meet', at: 5, removed: true })).toMatchObject({ removed: true });
  });
});

describe('coming up: what shows', () => {
  const opts = { me: 'user' as const, partnerName: 'Priya', festivals: [], today: '2026-10-22' };

  it("your partner's birthday comes with a wish; yours does not", () => {
    const list = upcoming([day({ date: '1996-11-02' }), day({ id: 'b2', who: 'user', date: '1995-10-25' })], opts);
    expect(list.map(u => [u.title, u.daysUntil, !!u.wish])).toEqual([
      ['Your birthday', 3, false],
      ["Priya's birthday", 11, true]
    ]);
    expect(list[1].date).toBe('2026-11-02');
  });

  it('a birthday already past this year is next year\'s, and today counts', () => {
    expect(upcoming([day({ date: '1996-01-05' })], { ...opts, withinDays: 400 })[0].date).toBe('2027-01-05');
    expect(upcoming([day({ date: '1996-10-22' })], opts)[0].daysUntil).toBe(0);
  });

  it('29 February falls on the 28th in other years', () => {
    expect(upcoming([day({ date: '2000-02-29' })], { ...opts, withinDays: 400 })[0].date).toBe('2027-02-28');
  });

  it('a meet-up shows until the day, then goes', () => {
    const meet = day({ id: 'm', kind: 'meet', yearly: false, who: undefined, date: '2026-11-01' });
    expect(upcoming([meet], opts)[0]).toMatchObject({ title: 'You meet', daysUntil: 10 });
    expect(upcoming([meet], { ...opts, today: '2026-11-01' })[0].title).toBe('You meet today');
    expect(upcoming([meet], { ...opts, today: '2026-11-02' })).toEqual([]);
  });

  it('only what is within the window shows', () => {
    expect(upcoming([day({ date: '1996-03-01' })], opts)).toEqual([]);
  });

  it('festivals show with their Tamil name and a wish, and can be hidden', () => {
    const list = upcoming([], { ...opts, festivals: FESTIVALS });
    expect(list.map(u => [u.title, u.date])).toEqual([
      ['Deepavali', '2026-11-08'],
      ['Karthigai Deepam', '2026-11-24']
    ]);
    expect(list[0].sub).toBe('தீபாவளி');
    expect(list[0].wish).toContain('தீபாவளி');
    expect(upcoming([], { ...opts, festivals: FESTIVALS, hiddenFestivals: ['deepavali'] }).map(u => u.title)).toEqual(['Karthigai Deepam']);
  });

  it('every festival date is a real date, in order, at most one a year, 2026 to 2030', () => {
    for (const f of FESTIVALS) {
      const years = f.dates.map(d => Number(d.slice(0, 4)));
      expect(new Set(years).size).toBe(years.length);
      expect([...years].sort()).toEqual(years);
      for (const y of years) expect(y >= 2026 && y <= 2030).toBe(true);
      for (const d of f.dates) expect(new Date(d + 'T00:00:00Z').toISOString().slice(0, 10)).toBe(d);
    }
  });

  it('a year left out for want of a sure date shows nothing, rather than another year', () => {
    // Karthigai Deepam 2027 is not known for sure: nothing in late 2027.
    expect(upcoming([], { ...opts, festivals: FESTIVALS, today: '2027-11-20' }).map(u => u.title)).not.toContain('Karthigai Deepam');
  });

  it('says when in plain words', () => {
    expect(whenWords(0)).toBe('Today');
    expect(whenWords(1)).toBe('Tomorrow');
    expect(whenWords(12)).toBe('In 12 days');
  });
});
