import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import type { GroupMember, GroupMessage } from './groups';
import { NO_TIME, coupleInfo, groupInfo, type CoupleInfoContext } from './messageInfo';
import { dayAndTime } from './when';

const NOW = new Date(2026, 9, 28, 15, 0).getTime();
const SENT = NOW - 60 * 60_000;

function msg(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', authorId: 'user', authorName: 'You', text: 'Hi', timestamp: '', sentAt: SENT, delivered: true, ...over };
}
const ctx = (over: Partial<CoupleInfoContext> = {}): CoupleInfoContext => ({
  me: 'user',
  partnerName: 'Meera',
  partnerReadAt: 0,
  partnerReadHeardAt: 0,
  shareReceipts: true,
  partnerSaysDelivered: true,
  now: NOW,
  ...over
});
const value = (info: { rows: { key: string; value: string }[] }, key: string) => info.rows.find(r => r.key === key)?.value;

describe('Info on one of yours, in the couple chat', () => {
  it('gives the times it kept', () => {
    const info = coupleInfo(msg({ reached: true, reachedAt: SENT + 1000, readByPartnerAt: SENT + 2000 }), ctx({ partnerReadAt: SENT, partnerReadHeardAt: NOW }));
    expect(value(info, 'sent')).toBe(dayAndTime(SENT, NOW));
    expect(info.rows[1].label).toBe("Reached Meera's phone");
    expect(value(info, 'reached')).toBe(dayAndTime(SENT + 1000, NOW));
    expect(value(info, 'read')).toBe(dayAndTime(SENT + 2000, NOW));
    expect(info.rows[2].tone).toBe('read');
    expect(info.notes).toEqual([]);
  });

  it('says Not yet for what has not happened, and a dash for a time not kept', () => {
    expect(value(coupleInfo(msg(), ctx()), 'reached')).toBe('Not yet');
    expect(value(coupleInfo(msg(), ctx()), 'read')).toBe('Not yet');
    // Reached and read before the times were kept.
    const old = coupleInfo(msg({ reached: true }), ctx({ partnerReadAt: SENT, partnerReadHeardAt: NOW }));
    expect(value(old, 'reached')).toBe(NO_TIME);
    expect(value(old, 'read')).toBe(NO_TIME);
  });

  it('shows no read with receipts off here, and does not let read say it reached her', () => {
    const info = coupleInfo(msg(), ctx({ shareReceipts: false, partnerReadAt: SENT, partnerReadHeardAt: NOW }));
    expect(value(info, 'read')).toBe('Read receipts are off');
    expect(value(info, 'reached')).toBe('Not yet');
    expect(info.notes).toEqual([]);
  });

  it('says why Read may stay at Not yet, and why an older Two never says it reached her', () => {
    expect(coupleInfo(msg(), ctx()).notes).toEqual(['If Meera has read receipts off, Read stays at Not yet.']);
    expect(coupleInfo(msg(), ctx({ partnerSaysDelivered: false })).notes[1]).toBe(
      "Meera's Two is an older version, which doesn't say when a message reaches it."
    );
  });

  it('says a message still here is still here', () => {
    const info = coupleInfo(msg({ delivered: false }), ctx());
    expect(info.rows).toHaveLength(1);
    expect(value(info, 'sending')).toBe('Still on this phone');
  });
});

describe('Info on one of hers', () => {
  it('says when it arrived here, and when it was sent by her clock', () => {
    const info = coupleInfo(msg({ authorId: 'partner', receivedAt: SENT + 5000 }), ctx());
    expect(value(info, 'sent')).toBe(dayAndTime(SENT, NOW));
    expect(value(info, 'arrived')).toBe(dayAndTime(SENT + 5000, NOW));
  });
  it('without an arrival kept, only when it was sent', () => {
    const info = coupleInfo(msg({ authorId: 'partner' }), ctx());
    expect(info.rows.map(r => r.key)).toEqual(['sent']);
  });
});

describe('Info in a group', () => {
  const ME = 'dev-me';
  const member = (id: string, name: string, readUpTo: number): GroupMember => ({ id, name, lastSeen: 0, readUpTo });
  const gmsg = (over: Partial<GroupMessage> = {}): GroupMessage => ({ id: 'g1', authorId: ME, authorName: 'Me', text: 'Hi', sentAt: SENT, ...over });
  const members = [member(ME, 'Me', SENT), member('a', 'Asha', SENT), member('b', 'Bala', SENT), member('c', 'Chitra', 0)];

  it('lists who has read yours, with when where it was kept, and who has not', () => {
    const info = groupInfo(gmsg({ readTimes: { a: SENT + 100 } }), members, ME, true, NOW);
    expect(info.readers!.read).toEqual([
      { id: 'a', name: 'Asha', value: dayAndTime(SENT + 100, NOW) },
      { id: 'b', name: 'Bala', value: NO_TIME }
    ]);
    expect(info.readers!.unread).toEqual([{ id: 'c', name: 'Chitra' }]);
    expect(info.notes).toHaveLength(1);
  });

  it('shows no readers with receipts off here', () => {
    const info = groupInfo(gmsg(), members, ME, false, NOW);
    expect(info.readers).toBeUndefined();
    expect(value(info, 'read')).toBe('Read receipts are off');
  });

  it('says so when nobody else is in it yet', () => {
    expect(groupInfo(gmsg(), [member(ME, 'Me', 0)], ME, true, NOW).notes).toEqual(['Nobody else has joined yet.']);
  });

  it('for somebody else\'s, when it was sent and arrived', () => {
    const info = groupInfo(gmsg({ authorId: 'a', receivedAt: SENT + 9 }), members, ME, true, NOW);
    expect(info.rows.map(r => r.key)).toEqual(['sent', 'arrived']);
    expect(info.readers).toBeUndefined();
  });
});
