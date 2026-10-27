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
// from the other phone's clock is involved, so two clocks that disagree, a
// message sent hours ago from an offline laptop, or a call's line cannot hide
// anything or count it twice. Messages kept from before this - and a phone's
// history brought back on setting it up again - have no arrival time, so they
// are never new.

import { ChatMessage } from '../types';

type Seat = 'user' | 'partner';

const otherSeat = (me: Seat): Seat => (me === 'user' ? 'partner' : 'user');

/** One of your partner's messages that is news: theirs, still there, a message, and arrived after you last looked. */
export function isUnread(message: ChatMessage, me: Seat, readAt: number | undefined): boolean {
  return (
    message.authorId === otherSeat(me) &&
    !message.unsent &&
    // A call's line is not a message; a missed one has its own toast and Home line.
    !message.call &&
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

/** What is on this phone's screen, as far as the couple's chat is concerned. */
export interface ChatScreen {
  /** Two on the screen, not in the background or behind the lock of the phone. */
  visible: boolean;
  tab: string;
  groupOpen: boolean;
  locked: boolean;
  /** Showing the calculator. */
  disguised: boolean;
  /** A call's screen, which covers everything, is up. */
  inCall: boolean;
}

/**
 * Whether the chat is what is in front of you, and so read as it arrives:
 * Two on the screen, unlocked, not the calculator, on the Chat tab, with no
 * group open and no call screen over it. Anywhere else, it waits as new.
 */
export function chatInFront(s: ChatScreen): boolean {
  return s.visible && s.tab === 'chat' && !s.groupOpen && !s.locked && !s.disguised && !s.inCall;
}

/**
 * The count every surface shows. The chat in front of you is already read,
 * even before that is written down - so a message landing there never
 * flashes a "1".
 */
export function shownCount(inFront: boolean, unread: number): number {
  return inFront ? 0 : unread;
}

/**
 * When a message arriving now arrived, for the count: now - and never at or
 * before the last look. A phone's clock put back (a network time correction,
 * or by hand) leaves a read time in its future, and every message after it
 * would arrive "before" it and never count until the clock caught up.
 */
export function arrivalTime(readAt: number | undefined, now: number = Date.now()): number {
  return Math.max(now, (readAt ?? 0) + 1);
}

/** When the newest message to arrive here came, by this phone's clock; 0 when none has. */
export function newestArrival(messages: ChatMessage[]): number {
  let newest = 0;
  for (const m of messages) if (typeof m.receivedAt === 'number' && m.receivedAt > newest) newest = m.receivedAt;
  return newest;
}

/**
 * When your partner's newest real message was sent, by their clock - what a
 * read receipt says. Not a call's line (which can carry this phone's clock),
 * nor one taken back. 0 when there is none.
 */
export function newestFrom(messages: ChatMessage[], seat: Seat): number {
  let newest = 0;
  for (const m of messages) {
    if (m.authorId === seat && !m.call && !m.unsent && typeof m.sentAt === 'number' && m.sentAt > newest) newest = m.sentAt;
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
