// How many of your partner's messages you have not seen yet - on this phone,
// across restarts, including the ones that came while Two was closed.
//
// The count used to live only in memory and only counted messages that
// arrived live with the chat closed. Everything that came while the app was
// shut arrives as a replay when it opens, and was skipped - so opening Two to
// a conversation full of new messages showed no count at all, the widget said
// "No new messages", and any restart reset it to nothing.
//
// Now every message of your partner's is stamped with when it arrived on this
// phone (ChatMessage.receivedAt, by this phone's own clock), and this phone
// keeps when you last had the chat open in front of you (SpaceState.chatReadAt,
// the same clock). Unread is simply: arrived after you last looked. No time
// from the other phone's clock is involved, so two clocks that disagree, or a
// message sent hours ago from an offline laptop, cannot hide anything or count
// it twice. Messages kept from before this - and a phone's history brought
// back on setting it up again - have no arrival time, so they are never new.

import { ChatMessage } from '../types';

type Seat = 'user' | 'partner';

const otherSeat = (me: Seat): Seat => (me === 'user' ? 'partner' : 'user');

/** One of your partner's messages that is news: theirs, still there, a message, and arrived after you last looked. */
export function isUnread(message: ChatMessage, me: Seat, readAt: number | undefined): boolean {
  return (
    message.authorId === otherSeat(me) &&
    !message.unsent &&
    typeof message.receivedAt === 'number' &&
    message.receivedAt > (readAt ?? 0)
  );
}

/** How many of your partner's messages arrived after you last had the chat open. */
export function countUnread(messages: ChatMessage[], me: Seat, readAt: number | undefined): number {
  let count = 0;
  for (const m of messages) if (isUnread(m, me, readAt)) count++;
  return count;
}

/** The first of them in the conversation - where "New messages" goes. */
export function firstUnreadId(messages: ChatMessage[], me: Seat, readAt: number | undefined): string | undefined {
  return messages.find(m => isUnread(m, me, readAt))?.id;
}

/** When the newest message to arrive here came, by this phone's clock; 0 when none has. */
export function newestArrival(messages: ChatMessage[]): number {
  let newest = 0;
  for (const m of messages) if (typeof m.receivedAt === 'number' && m.receivedAt > newest) newest = m.receivedAt;
  return newest;
}

/**
 * When your partner's newest message was sent, by their clock - what a read
 * receipt says. Not one taken back. 0 when there is none.
 */
export function newestFrom(messages: ChatMessage[], seat: Seat): number {
  let newest = 0;
  for (const m of messages) {
    if (m.authorId === seat && !m.unsent && typeof m.sentAt === 'number' && m.sentAt > newest) newest = m.sentAt;
  }
  return newest;
}

/**
 * Your own other device (on the same seat) says it has read your partner's
 * messages up to `upTo` (their clock): the read point here moves on to cover
 * those messages, by when they arrived here.
 */
export function readAtForReceipt(messages: ChatMessage[], me: Seat, upTo: number, readAt: number | undefined): number {
  let at = readAt ?? 0;
  for (const m of messages) {
    if (
      m.authorId === otherSeat(me) &&
      typeof m.sentAt === 'number' &&
      m.sentAt <= upTo &&
      typeof m.receivedAt === 'number' &&
      m.receivedAt > at
    ) {
      at = m.receivedAt;
    }
  }
  return at;
}
