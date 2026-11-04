import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import {
  addBoop,
  boopsFor,
  champion,
  chatDay,
  cleanTheme,
  funnyNumbers,
  goodMorning,
  lastWordLastNight,
  missLevel,
  weekOf,
  withBoopCount
} from './usTwo';

const H = 60 * 60 * 1000;
let n = 0;
const msg = (authorId: 'user' | 'partner', at: Date, text = 'hi', extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `m${++n}`,
  authorId,
  authorName: authorId,
  text,
  timestamp: '',
  sentAt: at.getTime(),
  ...extra
});
const at = (day: number, hour: number, min = 0) => new Date(2026, 10, day, hour, min);

describe('good morning', () => {
  it('goes to the first message after four, and counts the days in a row', () => {
    const messages = [
      msg('partner', at(1, 7)),
      msg('user', at(1, 8)),
      msg('partner', at(2, 6, 30)),
      msg('user', at(3, 1)), // still the night of the 2nd
      msg('partner', at(3, 9)),
      msg('user', at(3, 9, 5))
    ];
    expect(goodMorning(messages, at(3, 12).getTime())).toEqual({ winner: 'partner', streak: 3 });
  });

  it('is nobody yet before anyone has written today', () => {
    expect(goodMorning([msg('user', at(1, 9))], at(2, 10).getTime())).toEqual({ winner: null, streak: 0 });
  });

  it('starts the day at four in the morning', () => {
    expect(chatDay(at(5, 3, 59).getTime())).toBe('2026-11-04');
    expect(chatDay(at(5, 4).getTime())).toBe('2026-11-05');
  });
});

describe('the last word last night', () => {
  it('is the last message from eight in the evening until four', () => {
    const messages = [msg('user', at(1, 22)), msg('partner', at(2, 0, 40)), msg('user', at(2, 8))];
    expect(lastWordLastNight(messages, at(2, 10).getTime())).toBe('partner');
    expect(lastWordLastNight(messages, at(2, 2).getTime())).toBeNull();
  });
});

describe('the miss-you meter', () => {
  it('rises the longer it has been, and is calm while they are here', () => {
    const last = [msg('user', at(1, 8))];
    expect(missLevel(last, false, at(1, 8, 10).getTime()).level).toBe(0);
    expect(missLevel(last, false, at(1, 9).getTime()).level).toBe(1);
    expect(missLevel(last, false, at(1, 12).getTime()).level).toBe(2);
    expect(missLevel(last, false, at(1, 17).getTime()).level).toBe(3);
    expect(missLevel(last, false, at(2, 8).getTime()).level).toBe(4);
    expect(missLevel(last, true, at(2, 8).getTime()).level).toBe(0);
  });
});

describe('the funny numbers', () => {
  it('counts what is said and by whom', () => {
    const messages = [
      msg('user', at(1, 9), 'saptiya? ❤️❤️'),
      msg('partner', at(1, 9, 1), 'miss you so much 😘'),
      msg('partner', at(1, 23), 'sorry sorry'),
      msg('user', at(2, 1), 'go sleep 😂'),
      msg('user', at(2, 9), 'Sticker', { sticker: 'saptiya' }),
      msg('partner', at(2, 10), 'Sticker', { sticker: 'love-you' }),
      msg('user', at(2, 11), '', { call: { callId: 'c', caller: 'user', startedAt: 0, seconds: 1800, outcome: 'answered' as never } })
    ];
    const n = funnyNumbers(messages);
    expect(n.messages).toEqual({ user: 3, partner: 3 });
    expect(n.saptiya).toBe(2);
    expect(n.hearts).toBe(4);
    expect(n.missYou).toEqual({ user: 0, partner: 1 });
    expect(n.sorry).toEqual({ user: 0, partner: 2 });
    expect(n.nightOwl).toBe(1);
    expect(n.stickers).toBe(2);
    expect(n.longestCallSeconds).toBe(1800);
  });
  it('says who does what more: saptiya, good morning first, the last word, I love you', () => {
    const n = funnyNumbers([
      msg('user', at(1, 8), 'good morning, saptiya?'),
      msg('partner', at(1, 8, 5), 'not yet. saapteengala?'),
      msg('user', at(1, 22), 'I love you chellam'),
      msg('partner', at(1, 23), 'love u too kanna, good night'),
      msg('partner', at(2, 7), 'gm'),
      msg('user', at(2, 21), 'gn'),
      msg('partner', at(2, 9), 'Sticker', { sticker: 'love-you' })
    ]);
    expect(n.saptiyaBy).toEqual({ user: 1, partner: 1 });
    expect(n.firstHello).toEqual({ user: 1, partner: 1 });
    // Night one: the partner's good night at 11pm; night two: the user's gn.
    expect(n.lastWord).toEqual({ user: 1, partner: 1 });
    expect(n.loveYou).toEqual({ user: 1, partner: 2 });
    expect(n.chellam).toBe(1);
    expect(n.kanna).toBe(1);
    expect(n.goodNight).toBe(2);
  });

  it('times the replies, finds the longest run of days, the busiest hour and day, and the first message', () => {
    const n = funnyNumbers([
      msg('user', at(1, 10), 'hi'),
      msg('partner', at(1, 10, 2), 'hey'),
      msg('user', at(1, 10, 3), 'how was work'),
      msg('partner', at(1, 10, 13), 'long'),
      msg('user', at(2, 10), 'morning'),
      msg('user', at(3, 22), 'night'),
      msg('partner', at(5, 10), 'back')
    ]);
    // The partner answered in 2 and 10 minutes; the user in 1 minute.
    expect(n.replyMs.user).toBe(60_000);
    expect(n.replyMs.partner).toBe(600_000);
    expect(n.longestStreak).toBe(3);
    expect(n.topHour).toBe(10);
    expect(n.busiestDay).toEqual({ day: '2026-11-01', count: 4 });
    expect(n.first).toMatchObject({ who: 'user', kind: 'text', text: 'hi' });
  });

  it('does not take a reply from the next day as answering', () => {
    const n = funnyNumbers([msg('user', at(1, 8), 'hi'), msg('partner', at(1, 21), 'sorry, busy day')]);
    expect(n.replyMs.partner).toBeNull();
  });
});

describe('the boop battle', () => {
  it('only ever goes up, and only for today and this week', () => {
    const today = '2026-11-03';
    const once = withBoopCount(undefined, 'partner', { day: today, count: 4, week: '2026-11-02', weekCount: 9 }, today);
    expect(once).toMatchObject({ day: today, user: 0, partner: 4, week: '2026-11-02', weekPartner: 9 });
    expect(withBoopCount(once!, 'partner', { day: today, count: 3, week: '2026-11-02', weekCount: 8 }, today)).toBeNull();
    expect(withBoopCount(once!, 'partner', { day: '2026-11-02', count: 9 }, today)).toBeNull();
    // A phone from before weeks: today's count alone.
    expect(withBoopCount(once!, 'partner', { day: today, count: 6 }, today)).toMatchObject({ partner: 6, weekPartner: 9 });
  });

  it('counts one more today and this week', () => {
    const next = addBoop(addBoop(undefined, 'user', '2026-11-03'), 'user', '2026-11-03');
    expect(next).toMatchObject({ user: 2, weekUser: 2, partner: 0 });
    // A new day starts the day again, not the week.
    expect(addBoop(next, 'user', '2026-11-04')).toMatchObject({ user: 1, weekUser: 3 });
  });

  it('turns a finished week into last week, for its trophy', () => {
    const week = { day: '2026-11-08', user: 1, partner: 5, week: '2026-11-02', weekUser: 20, weekPartner: 31 };
    const monday = boopsFor(week, '2026-11-09');
    expect(monday).toMatchObject({ user: 0, partner: 0, week: '2026-11-09', weekUser: 0, weekPartner: 0 });
    expect(monday.lastWeek).toEqual({ week: '2026-11-02', user: 20, partner: 31 });
    expect(champion(monday.lastWeek)).toBe('partner');
    // Kept through that week; the week after, last week is the quiet one.
    expect(boopsFor(monday, '2026-11-12').lastWeek).toEqual(monday.lastWeek);
    expect(boopsFor(monday, '2026-11-17').lastWeek).toEqual({ week: '2026-11-09', user: 0, partner: 0 });
    expect(champion(boopsFor(monday, '2026-11-17').lastWeek)).toBeNull();
    // Nothing for two weeks: no trophy at all.
    expect(boopsFor(monday, '2026-11-24').lastWeek).toBeUndefined();
  });

  it('starts weeks on Monday', () => {
    expect(weekOf('2026-11-08')).toBe('2026-11-02');
    expect(weekOf('2026-11-09')).toBe('2026-11-09');
  });
});

describe('the sky you picked', () => {
  it('takes only the themes there are, else follows the time of day', () => {
    expect(cleanTheme('winter')).toBe('winter');
    expect(cleanTheme('lava')).toBe('auto');
    expect(cleanTheme(undefined)).toBe('auto');
  });
});
