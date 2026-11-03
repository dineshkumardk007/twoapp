import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import { boopsFor, chatDay, funnyNumbers, goodMorning, lastWordLastNight, missLevel, withBoopCount } from './usTwo';

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
});

describe('boops', () => {
  it('only ever goes up, and only for today', () => {
    const today = '2026-11-03';
    const once = withBoopCount(undefined, 'partner', today, 4, today);
    expect(once).toEqual({ day: today, user: 0, partner: 4 });
    expect(withBoopCount(once!, 'partner', today, 3, today)).toBeNull();
    expect(withBoopCount(once!, 'partner', '2026-11-02', 9, today)).toBeNull();
    expect(boopsFor(once!, '2026-11-04')).toEqual({ day: '2026-11-04', user: 0, partner: 0 });
  });
});
