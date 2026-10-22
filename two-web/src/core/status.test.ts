import { describe, expect, it } from 'vitest';
import {
  MAX_STATUS_CHARS,
  applyStatus,
  cleanStatus,
  clearsAtFor,
  liveStatus,
  stampFor,
  statusText,
  statusWords
} from './status';

const HOUR = 3_600_000;
const at = (h: number, m = 0, day = 22) => new Date(2026, 9, day, h, m, 0, 0).getTime();

describe('a status as it arrives', () => {
  const good = { text: 'Reached home', emoji: '🏠', setAt: at(21), clearsAt: at(21) + 3 * HOUR };
  it('keeps a good one', () => expect(cleanStatus(good)).toEqual(good));
  it('refuses anything broken', () => {
    expect(cleanStatus(null)).toBeNull();
    expect(cleanStatus({ ...good, setAt: 'now' })).toBeNull();
    expect(cleanStatus({ ...good, clearsAt: good.setAt - 1 })).toBeNull();
    expect(cleanStatus({ ...good, setAt: 0 })).toBeNull();
  });
  it('tidies the words and drops an emoji that is not one', () => {
    expect(cleanStatus({ ...good, text: '  at   the\nstation ', emoji: 'home' })).toEqual({
      text: 'at the station',
      setAt: good.setAt,
      clearsAt: good.clearsAt
    });
    expect(Array.from(cleanStatus({ ...good, text: '😀'.repeat(60) })!.text)).toHaveLength(MAX_STATUS_CHARS);
  });
  it('lasts a day at the most, whatever it says', () => {
    expect(cleanStatus({ ...good, clearsAt: good.setAt + 100 * HOUR })!.clearsAt).toBe(good.setAt + 24 * HOUR);
  });
  it('a cleared one has no words and no emoji', () => {
    expect(cleanStatus({ ...good, text: '' })).toEqual({ text: '', setAt: good.setAt, clearsAt: good.clearsAt });
  });
});

describe('the newest wins', () => {
  const s = (text: string, setAt: number) => ({ text, setAt, clearsAt: setAt + HOUR });
  it("files it under the seat that set it", () => {
    expect(applyStatus(undefined, 'partner', s('On the way', 10))).toEqual({ partner: s('On the way', 10) });
    expect(applyStatus(undefined, 'someone', s('On the way', 10))).toBeNull();
  });
  it('an older one arriving late changes nothing', () => {
    const now = applyStatus(undefined, 'partner', s('Reached home', 20))!;
    expect(applyStatus(now, 'partner', s('On the way', 10))).toBeNull();
    expect(applyStatus(now, 'partner', s('Reached home', 20))).toBeNull();
    expect(applyStatus(now, 'partner', s('', 30))?.partner?.text).toBe('');
  });
  it("one of you does not touch the other's", () => {
    const both = applyStatus(applyStatus(undefined, 'partner', s('At work', 10))!, 'user', s('Driving', 11))!;
    expect(both.partner?.text).toBe('At work');
    expect(both.user?.text).toBe('Driving');
  });
});

describe('showing it', () => {
  it('until it ends, by this phone', () => {
    const s = { text: 'Free to talk', emoji: '📞', setAt: at(9), clearsAt: at(12) };
    expect(liveStatus(s, at(11))).toBe(s);
    expect(liveStatus(s, at(12))).toBeNull();
    expect(liveStatus({ ...s, text: '' }, at(10))).toBeNull();
    expect(liveStatus(undefined)).toBeNull();
    expect(statusWords(s)).toBe('📞 Free to talk');
    expect(statusWords({ ...s, emoji: undefined })).toBe('Free to talk');
  });
  it('lasts an hour, three, or the rest of today', () => {
    expect(clearsAtFor('hour', at(9))).toBe(at(10));
    expect(clearsAtFor('three', at(9))).toBe(at(12));
    expect(clearsAtFor('today', at(9))).toBe(at(0, 0, 23));
    // Late at night, still half an hour.
    expect(clearsAtFor('today', at(23, 50))).toBe(at(23, 50) + 30 * 60_000);
  });
  it('words typed in are one line, cut to length', () => {
    expect(statusText('  out \n for   dinner ')).toBe('out for dinner');
    expect(statusText('x'.repeat(100))).toHaveLength(MAX_STATUS_CHARS);
  });
});

describe('a clock gone wrong', () => {
  const now = at(12);
  const daysAhead = { text: 'At work', setAt: at(9, 0, 30), clearsAt: at(10, 0, 30) };
  it("ends a day from now at the latest - by this phone's clock too", () => {
    expect(cleanStatus({ text: 'Going to sleep', setAt: at(12, 0, 25), clearsAt: at(20, 0, 25) }, now)!.clearsAt).toBe(
      now + 24 * HOUR
    );
  });
  it('one set days ahead gives way to the next, whatever its stamp', () => {
    const held = applyStatus(undefined, 'partner', daysAhead, now)!;
    expect(applyStatus(held, 'partner', { text: 'Reached home', setAt: now, clearsAt: now + HOUR }, now)?.partner?.text).toBe(
      'Reached home'
    );
    expect(applyStatus(held, 'partner', held.partner, now)).toBeNull();
  });
  it('one a little ahead still beats an older one', () => {
    const held = applyStatus(undefined, 'partner', { text: 'On the way', setAt: now + 2 * HOUR, clearsAt: now + 3 * HOUR }, now)!;
    expect(applyStatus(held, 'partner', { text: 'At work', setAt: now, clearsAt: now + HOUR }, now)).toBeNull();
  });
  it('and is not shown, set while this clock was days ahead', () => {
    expect(liveStatus(daysAhead, now)).toBeNull();
  });
});

describe('stamping your own', () => {
  const now = at(12);
  it('now - or just after the one held, when that came from a clock a little ahead', () => {
    expect(stampFor(undefined, now)).toBe(now);
    expect(stampFor({ text: 'x', setAt: now - HOUR, clearsAt: now }, now)).toBe(now);
    expect(stampFor({ text: 'x', setAt: now + 2 * HOUR, clearsAt: now + 3 * HOUR }, now)).toBe(now + 2 * HOUR + 1);
    expect(stampFor({ text: 'x', setAt: at(9, 0, 30), clearsAt: at(10, 0, 30) }, now)).toBe(now);
  });
  it('and lasting as long from that stamp, so both phones take it', () => {
    const held = { user: { text: 'Busy, talk later', setAt: now + 2 * HOUR, clearsAt: now + 3 * HOUR } };
    const setAt = stampFor(held.user, now);
    const clearsAt = clearsAtFor('hour', now) + (setAt - now);
    const next = applyStatus(held, 'user', { text: 'Free to talk', setAt, clearsAt }, now);
    expect(next?.user?.text).toBe('Free to talk');
    expect(next!.user!.clearsAt - next!.user!.setAt).toBe(HOUR);
  });
});
