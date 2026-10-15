import { describe, it, expect } from 'vitest';
import { routeFor, phraseFor, isNews, withActivity, unseen, dottedTabs, ActivityEvent } from './activity';
import { insertBySentAt } from './ordering';

const event = (tabId: string, type: string, at: number): ActivityEvent => ({ id: `${type}-${at}`, tabId, type, at });

describe('While you were away', () => {
  it('only lists what is worth saying: not presence, versions or chatter between phones', () => {
    for (const quiet of ['PRESENCE_BEAT', 'APP_VERSION', 'GROUP_READ', 'VOICE_HEARD', 'OUR_DATES']) {
      expect(routeFor(quiet)).toBeNull();
    }
  });

  it('says that the daily question was answered, never the answer itself', () => {
    expect(routeFor('DAILY_ANSWER')).toEqual({ tab: 'home', tier: 'for-you' });
    expect(phraseFor('DAILY_ANSWER')).toBe('answered the daily question');
  });

  it("says \"it's not about you\" on Home when it is said, and not when it is taken back", () => {
    expect(routeFor('NOT_ABOUT_YOU')).toEqual({ tab: 'home', tier: 'for-you' });
    expect(isNews('NOT_ABOUT_YOU', { active: true })).toBe(true);
    expect(isNews('NOT_ABOUT_YOU', { active: false })).toBe(false);
    expect(isNews('NOT_ABOUT_YOU', null)).toBe(false);
  });

  it('counts walking into Quiet Together, not every status it sends', () => {
    expect(isNews('CO_PRESENCE_STATUS', { hello: true })).toBe(true);
    expect(isNews('CO_PRESENCE_STATUS', { hello: true, isJoined: false })).toBe(false);
    expect(isNews('CO_PRESENCE_STATUS', {})).toBe(false);
    expect(isNews('CHAT', null)).toBe(true);
    expect(isNews('PRESENCE_BEAT', {})).toBe(false);
  });

  it('says what happened in plain words', () => {
    expect(phraseFor('REPAIR_BRIDGE_SEND')).toBe('said sorry');
    expect(phraseFor('KINTSUGI_ADD')).toBe('added a mended moment');
    expect(phraseFor('GRATITUDE_STAR')).toBe('added a thank-you star');
  });

  it('keeps one line per place, with the newest change', () => {
    let log: ActivityEvent[] = [];
    log = withActivity(log, event('lists', 'LIST_ITEM_SET', 1));
    log = withActivity(log, event('lists', 'LIST_ITEM_SET', 2));
    log = withActivity(log, event('chat', 'CHAT', 3));
    expect(log.map(e => `${e.tabId}@${e.at}`)).toEqual(['lists@2', 'chat@3']);
  });

  it('shows only what has not been looked at, newest first', () => {
    const log = [event('chat', 'CHAT', 10), event('lists', 'LIST_ITEM_SET', 20), event('letters', 'LOVE_LETTER', 30)];
    expect(unseen(log, { chat: 15 }).map(e => e.tabId)).toEqual(['letters', 'lists']);
  });

  it('puts a dot on the dock only for things meant for you', () => {
    const log = [event('chat', 'CHAT', 10), event('lists', 'LIST_ITEM_SET', 20)];
    expect([...dottedTabs(log, {})]).toEqual(['chat']);
  });
});

describe('Message order', () => {
  type M = { id: string; sentAt?: number };

  it('puts a late arrival where it was sent, not at the end', () => {
    const list: M[] = [{ id: 'a', sentAt: 1 }, { id: 'c', sentAt: 3 }];
    expect(insertBySentAt(list, { id: 'b', sentAt: 2 }).map(m => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps arrival order for messages sent in the same moment', () => {
    const list: M[] = [{ id: 'a', sentAt: 5 }];
    expect(insertBySentAt(list, { id: 'b', sentAt: 5 }).map(m => m.id)).toEqual(['a', 'b']);
  });

  it('never moves a message above an undated one', () => {
    const list: M[] = [{ id: 'old' }, { id: 'x', sentAt: 9 }];
    expect(insertBySentAt([{ id: 'old' }], { id: 'new', sentAt: 1 }).map(m => m.id)).toEqual(['old', 'new']);
    expect(insertBySentAt(list, { id: 'y', sentAt: 1 }).map(m => m.id)).toEqual(['old', 'y', 'x']);
  });
});
