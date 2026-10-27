import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../types';
import {
  arrivalTime, chatInFront, countUnread, firstUnreadId, newestArrival, newestFrom, readAtForReceipt, shownCount
} from './unread';

const msg = (id: string, authorId: 'user' | 'partner', sentAt: number, receivedAt?: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  authorId,
  authorName: authorId === 'user' ? 'Dinesh' : 'Priya',
  text: id,
  timestamp: '',
  sentAt,
  ...(receivedAt !== undefined ? { receivedAt } : {}),
  ...extra
});

// On Dinesh's phone (seat 'user'): Priya's messages are the partner's, and
// carry when they arrived here.
const chat = [
  msg('p1', 'partner', 100, 1000),
  msg('d1', 'user', 150),
  msg('p2', 'partner', 200, 2000),
  msg('p3', 'partner', 300, 3000),
  msg('d2', 'user', 350),
  msg('p4', 'partner', 400, 4000)
];

describe('unread messages', () => {
  it('counts the partner\'s messages that arrived after you last looked', () => {
    expect(countUnread(chat, 'user', 1000)).toBe(3);
    expect(countUnread(chat, 'user', 3000)).toBe(1);
    expect(countUnread(chat, 'user', 4000)).toBe(0);
  });

  it('never looked: everything that arrived counts', () => {
    expect(countUnread(chat, 'user', undefined)).toBe(4);
  });

  it('messages kept from before (no arrival time) and history brought back are never new', () => {
    expect(countUnread([msg('old', 'partner', 100)], 'user', undefined)).toBe(0);
  });

  it('your own messages are never unread on your phone', () => {
    expect(countUnread(chat, 'partner', 0)).toBe(0);
  });

  it('an unsent message, or a call\'s line, is not news', () => {
    expect(countUnread([msg('p', 'partner', 1, 10, { unsent: true })], 'user', 0)).toBe(0);
    expect(countUnread([msg('c', 'partner', 1, 10, { call: { callId: 'c', caller: 'partner', startedAt: 1, seconds: 0, outcome: 'missed' } })], 'user', 0)).toBe(0);
  });

  it('a message sent long ago that only arrives now is new, whatever its time says', () => {
    // Sent from an offline laptop at "200", arriving after you read "400".
    const late = [...chat, msg('late', 'partner', 200, 9000)];
    expect(countUnread(late, 'user', 4000)).toBe(1);
    expect(firstUnreadId(late, 'user', 4000)).toBe('late');
  });

  it('finds the first unread message in the conversation', () => {
    expect(firstUnreadId(chat, 'user', 1000)).toBe('p2');
    expect(firstUnreadId(chat, 'user', 4000)).toBeUndefined();
  });

  it('newest arrival, and their newest real message for the read receipt', () => {
    expect(newestArrival(chat)).toBe(4000);
    expect(newestFrom(chat, 'partner')).toBe(400);
    const withCall = [...chat, msg('c', 'partner', 99999, 5000, { call: { callId: 'c', caller: 'partner', startedAt: 99999, seconds: 0, outcome: 'missed' } })];
    expect(newestFrom(withCall, 'partner')).toBe(400);
  });

  it('your other device having read up to a time covers those messages here', () => {
    expect(readAtForReceipt(chat, 'user', 300, 0)).toBe(3000);
    expect(readAtForReceipt(chat, 'user', 300, 5000)).toBe(5000);
    expect(countUnread(chat, 'user', readAtForReceipt(chat, 'user', 300, 0))).toBe(1);
  });
});

describe('when the chat is read as it arrives', () => {
  const inChat = { visible: true, tab: 'chat', groupOpen: false, locked: false, disguised: false, inCall: false };

  it('the chat in front of you: on screen, unlocked, not the calculator, the Chat tab, no group, no call', () => {
    expect(chatInFront(inChat)).toBe(true);
  });

  it('anywhere else it waits as new', () => {
    expect(chatInFront({ ...inChat, tab: 'home' })).toBe(false);
    expect(chatInFront({ ...inChat, visible: false })).toBe(false);
    expect(chatInFront({ ...inChat, locked: true })).toBe(false);
    expect(chatInFront({ ...inChat, disguised: true })).toBe(false);
    expect(chatInFront({ ...inChat, groupOpen: true })).toBe(false);
    expect(chatInFront({ ...inChat, inCall: true })).toBe(false);
  });

  it('nothing is shown while the chat is in front of you, not even before the read is written down', () => {
    expect(shownCount(true, 1)).toBe(0);
    expect(shownCount(false, 3)).toBe(3);
    expect(shownCount(false, 0)).toBe(0);
  });

  it('a message arrives now, and never at or before the last look', () => {
    expect(arrivalTime(undefined, 5)).toBe(5);
    expect(arrivalTime(3, 5)).toBe(5);
    expect(arrivalTime(100, 5)).toBe(101);
  });

  it('a clock put back cannot hide a message: one arriving after a read time in the future still counts', () => {
    const readAt = 10_000;
    const late = [msg('p', 'partner', 1, arrivalTime(readAt, 5))];
    expect(countUnread(late, 'user', readAt)).toBe(1);
    // Reading it, up to the newest arrival, clears it.
    expect(countUnread(late, 'user', Math.max(5, newestArrival(late)))).toBe(0);
  });
});
