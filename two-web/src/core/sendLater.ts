// Send later: a message written now that shows in your partner's chat at a
// time you pick - a good-morning note written the night before.
//
// The message goes to the relay at once, encrypted like any other, carrying
// the time it is to show (ChatMessage.showAt, which is also its sentAt, so it
// takes its place in the conversation at that time). The partner's phone
// keeps it to itself until its own clock gets there: out of the conversation,
// the new-message count, the toast and Home's news, in a list of its own
// (SpaceState.heldMessages). Then it goes in as if it had just arrived.
//
// There is no push, so it shows the next time Two is open at or after the
// time; it does not wake the phone. And it is held on the screen only: the
// partner's phone has the words from the start. A phone that cannot hold a
// message back would show it straight away, so the choice is offered only
// once the partner's phone has said it can (APP_VERSION, CAN_SHOW_LATER).

import { ChatMessage } from '../types';
import type { ActivityEvent } from './activity';
import { tr } from './i18n';

type Seat = 'user' | 'partner';

/** What a phone says in its APP_VERSION when it holds messages back until their time. */
export const CAN_SHOW_LATER = 'showAt';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** As far ahead as a message can be set. */
export const MAX_AHEAD_MS = 30 * DAY;
/** At least this far ahead: anything sooner is simply sent. */
export const MIN_AHEAD_MS = MINUTE;
/** Held messages kept on a phone at most; past that the furthest off are dropped. */
export const MAX_HELD = 200;

/**
 * The time a message is to show, as it came from the other phone - kept only
 * if it is one. A time further off than anyone can set is a clock gone wrong,
 * and the message is shown rather than held for months.
 */
export function cleanShowAt(raw: unknown, now: number = Date.now()): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return undefined;
  if (raw > now + MAX_AHEAD_MS + DAY) return undefined;
  return Math.round(raw);
}

/** Someone else's message, still to be held back on this phone. */
export function isHeld(m: ChatMessage, me: Seat, now: number = Date.now()): boolean {
  return m.authorId !== me && typeof m.showAt === 'number' && m.showAt > now;
}

/** One of your own, not yet due to show on the other phone (by this phone's clock). */
export function isWaiting(m: ChatMessage, me: Seat, now: number = Date.now()): boolean {
  return m.authorId === me && !m.unsent && typeof m.showAt === 'number' && m.showAt > now;
}

/** A message put in the held list: once, soonest first, at most MAX_HELD. */
export function withHeld(held: ChatMessage[] | undefined, m: ChatMessage): ChatMessage[] {
  const list = (held || []).filter(h => h.id !== m.id);
  list.push(m);
  list.sort((a, b) => (a.showAt ?? 0) - (b.showAt ?? 0));
  return list.slice(0, MAX_HELD);
}

/** The held messages whose time has come, and the ones still to wait. */
export function dueNow(
  held: ChatMessage[] | undefined,
  now: number = Date.now()
): { due: ChatMessage[]; waiting: ChatMessage[] } {
  const due: ChatMessage[] = [];
  const waiting: ChatMessage[] = [];
  for (const m of held || []) (typeof m.showAt === 'number' && m.showAt > now ? waiting : due).push(m);
  return { due, waiting };
}

/** The soonest time still ahead among these messages; undefined when there is none. */
export function nextShowAt(messages: readonly ChatMessage[] | undefined, now: number = Date.now()): number | undefined {
  let next: number | undefined;
  for (const m of messages || []) {
    if (typeof m.showAt === 'number' && m.showAt > now && (next === undefined || m.showAt < next)) next = m.showAt;
  }
  return next;
}

/**
 * A message taken back before it was due to show leaves nothing behind - no
 * "unsent" line for something that was never seen. Taken back (`takenBackAt`,
 * by the clock of the phone that did it) before its time: off the held list
 * here, or out of the conversation - on the sender's own phones, and on the
 * partner's when the two arrive only after that time. Null when it had
 * already shown there, even while still held here by a clock behind: then it
 * is unsent as usual, and shows here as unsent.
 */
export function withdrawn(
  lists: { messages: ChatMessage[]; heldMessages?: ChatMessage[] },
  authorId: string,
  messageId: unknown,
  takenBackAt: number = Date.now()
): { messages: ChatMessage[]; heldMessages?: ChatMessage[] } | null {
  if (typeof messageId !== 'string' || !messageId) return null;
  const held = lists.heldMessages?.find(m => m.id === messageId);
  if (held) {
    if (held.authorId !== authorId || (typeof held.showAt === 'number' && held.showAt <= takenBackAt)) return null;
    return { messages: lists.messages, heldMessages: lists.heldMessages!.filter(m => m.id !== messageId) };
  }
  const m = lists.messages.find(x => x.id === messageId);
  if (!m || m.authorId !== authorId || m.unsent || typeof m.showAt !== 'number' || m.showAt <= takenBackAt) return null;
  return { messages: lists.messages.filter(x => x.id !== messageId), heldMessages: lists.heldMessages };
}

/** The conversation with what is still held, for finding a message by id - one being pinned. */
export function withHeldMessages(lists: { messages: ChatMessage[]; heldMessages?: ChatMessage[] }): ChatMessage[] {
  return lists.heldMessages?.length ? [...lists.messages, ...lists.heldMessages] : lists.messages;
}

/**
 * A reply to a message still held here waits with it, until the time that
 * message shows - before then its quote would show the words early. One can
 * arrive only when the sender's clock is ahead of this phone's. The time it
 * waits until, or undefined when it answers nothing held.
 */
export function waitsWith(m: ChatMessage, held: readonly ChatMessage[] | undefined): number | undefined {
  const id = m.replyTo?.id;
  if (!id || !held?.length) return undefined;
  const at = held.find(h => h.id === id)?.showAt;
  return typeof at === 'number' ? Math.max(at, m.showAt ?? 0) : undefined;
}

/**
 * Home's news, once a message it was about has been withdrawn. withActivity
 * keeps one line per tab, so the chat's line goes back to the newest message
 * still here from the same person that arrived on this phone, or goes. Null
 * when the line was about something else.
 */
export function newsWithout(
  activity: ActivityEvent[],
  messageId: string,
  messages: readonly ChatMessage[],
  authorId: string
): ActivityEvent[] | null {
  const i = activity.findIndex(e => e.tabId === 'chat' && e.id === messageId);
  if (i < 0) return null;
  const rest = activity.filter((_, n) => n !== i);
  for (let n = messages.length - 1; n >= 0; n--) {
    const m = messages[n];
    if (m.id === messageId || m.authorId !== authorId || m.call || m.receivedAt === undefined) continue;
    // When it arrived here, as the chat's lines are: not her clock.
    return [...rest, { id: m.id, tabId: 'chat', type: 'CHAT', at: m.receivedAt }];
  }
  return rest;
}

export interface LaterChoice {
  key: string;
  label: string;
  at: number;
}

/** That day (0 today, 1 tomorrow) at this hour, on this phone's clock. */
function at(now: Date, dayOffset: number, hour: number): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, 0, 0, 0);
  return d.getTime();
}

/**
 * The times offered with one tap: in an hour, tonight at ten while it is
 * still well ahead, and seven and nine in the morning - this morning's, in
 * the small hours, rather than a whole day away.
 */
export function laterChoices(now: Date = new Date()): LaterChoice[] {
  const t = now.getTime();
  const choices: LaterChoice[] = [
    // To the minute, so it reads as a time rather than a timestamp.
    { key: 'hour', label: tr('In an hour'), at: Math.ceil((t + HOUR) / MINUTE) * MINUTE }
  ];
  const tonight = at(now, 0, 22);
  if (tonight - t >= 90 * MINUTE) choices.push({ key: 'tonight', label: tr('Tonight at 10 pm'), at: tonight });
  const smallHours = now.getHours() < 5;
  const morning = smallHours ? 0 : 1;
  choices.push({ key: 'seven', label: smallHours ? tr('This morning at 7 am') : tr('Tomorrow at 7 am'), at: at(now, morning, 7) });
  choices.push({ key: 'nine', label: smallHours ? tr('This morning at 9 am') : tr('Tomorrow at 9 am'), at: at(now, morning, 9) });
  return choices;
}

/** What is wrong with a time picked by hand, or null when it will do. */
export function pickedTimeProblem(atTime: number, now: number = Date.now()): string | null {
  if (!Number.isFinite(atTime)) return tr('Pick a day and a time');
  if (atTime - now < MIN_AHEAD_MS) return tr('Pick a time that is still to come');
  if (atTime - now > MAX_AHEAD_MS) return tr('Up to 30 days ahead');
  return null;
}

/** "2026-10-23T07:00" for a datetime-local field, on this phone's clock. */
export function toLocalInput(atTime: number): string {
  const d = new Date(atTime);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** A datetime-local field's value as a moment on this phone's clock; NaN when it is not one. */
export function fromLocalInput(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (!m) return NaN;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}
