import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../types';
import { countUnread, firstUnreadId, newestArrival, newestFrom, readAtForReceipt } from './unread';

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

  it('an unsent message is not news', () => {
    expect(countUnread([msg('p', 'partner', 1, 10, { unsent: true })], 'user', 0)).toBe(0);
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

  it('newest arrival, and their newest message for the read receipt', () => {
    expect(newestArrival(chat)).toBe(4000);
    expect(newestFrom(chat, 'partner')).toBe(400);
  });

  it('your other device having read up to a time covers those messages here', () => {
    expect(readAtForReceipt(chat, 'user', 300, 0)).toBe(3000);
    expect(readAtForReceipt(chat, 'user', 300, 5000)).toBe(5000);
    expect(countUnread(chat, 'user', readAtForReceipt(chat, 'user', 300, 0))).toBe(1);
  });
});
