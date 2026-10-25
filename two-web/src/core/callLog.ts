// Calls, in the chat: a small line for each one - "Voice call, 12 min",
// "Missed call" - in the conversation at the time it happened.
//
// Calls used to leave nothing behind. A missed call was a toast if it was
// under two minutes old and a line on Home; a call you had was gone the
// moment it ended. Now each phone, when a call ends, writes what it saw as a
// CALL_LOG record, and both phones keep one line per call in the
// conversation. Both write, so the line is there even if one of the two
// apps was closed or killed partway through; and the two accounts of the
// same call merge into one line, by its id.
//
// A phone on an older version ignores CALL_LOG, as it does any record it does
// not know. The line is a ChatMessage (with `call` set), so it is ordered,
// dated, paged and stored with the conversation for free; everything that
// acts on a message - reply, react, edit, pin, search, the unread count -
// leaves it alone.

import { ChatMessage } from '../types';
import type { CallState, EndReason } from './call';
import { tr } from './i18n';

type Seat = 'user' | 'partner';

export const CALL_LOG = 'CALL_LOG';

/** How a call went, as one word both phones agree on. */
export type CallOutcome = 'talked' | 'missed' | 'declined' | 'busy' | 'failed';

export interface ChatCallInfo {
  callId: string;
  /** Whose phone rang the other. */
  caller: Seat;
  /** When it started ringing, epoch ms. */
  startedAt: number;
  /** How long you talked; 0 when you did not. */
  seconds: number;
  outcome: CallOutcome;
  /**
   * The start is a guess: the line came from an older phone's CALL_MISSED,
   * which only says when the ringing stopped. Kept on this phone only; the
   * real start replaces it as soon as a CALL_LOG brings one.
   */
  estimated?: boolean;
}

/**
 * Which account of a call wins when the two phones saw it differently: the
 * one that knows more. A failure outranks a decline: a microphone refused on
 * the phone that answered goes back to the caller as a decline, but the
 * person did not decline.
 */
const RANK: Record<CallOutcome, number> = { missed: 0, busy: 1, declined: 2, failed: 3, talked: 4 };

const OUTCOMES = new Set<CallOutcome>(['talked', 'missed', 'declined', 'busy', 'failed']);

/** A day: longer than any real call, so anything past it is a broken record. */
const MAX_SECONDS = 24 * 60 * 60;

/** How a call ended, as the outcome its line shows. */
export function outcomeOf(reason: EndReason | null, connectedAt: number): CallOutcome {
  if (connectedAt > 0) return 'talked';
  if (reason === 'declined') return 'declined';
  if (reason === 'busy') return 'busy';
  if (reason === 'failed' || reason === 'mic-denied' || reason === 'dropped') return 'failed';
  // no-answer, cancelled, missed, and a hang-up from either side before it connected.
  return 'missed';
}

/**
 * What this phone saw of a call that has just ended - or null when there is
 * nothing to write: no call, or one picked up on another of your devices,
 * which writes its own.
 */
export function callLogFrom(call: CallState, me: Seat): ChatCallInfo | null {
  if (call.phase !== 'ended' || !call.callId || !call.direction) return null;
  if (call.endReason === 'answered-elsewhere') return null;
  const partner: Seat = me === 'user' ? 'partner' : 'user';
  const startedAt = call.startedAt > 0 ? call.startedAt : call.endedAt;
  const talked = call.connectedAt > 0;
  const seconds = talked ? Math.max(0, Math.round(((call.endedAt || Date.now()) - call.connectedAt) / 1000)) : 0;
  return {
    callId: call.callId,
    caller: call.direction === 'out' ? me : partner,
    startedAt,
    seconds: Math.min(seconds, MAX_SECONDS),
    outcome: outcomeOf(call.endReason, call.connectedAt)
  };
}

/** A CALL_LOG payload as it arrived, checked - or null if it is not one. */
export function readCallLog(raw: unknown): ChatCallInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.callId !== 'string' || !r.callId || r.callId.length > 120) return null;
  if (r.caller !== 'user' && r.caller !== 'partner') return null;
  const startedAt = Number(r.startedAt);
  const seconds = Number(r.seconds);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return null;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_SECONDS) return null;
  if (typeof r.outcome !== 'string' || !OUTCOMES.has(r.outcome as CallOutcome)) return null;
  return {
    callId: r.callId,
    caller: r.caller,
    startedAt,
    seconds: Math.round(seconds),
    outcome: r.outcome as CallOutcome
  };
}

/**
 * Two accounts of one call as one: the fuller outcome, the longer talk, and
 * the start first heard - unless that was only a guess and this one knows.
 */
export function mergeCallInfo(kept: ChatCallInfo, other: ChatCallInfo): ChatCallInfo {
  const outcome = RANK[other.outcome] > RANK[kept.outcome] ? other.outcome : kept.outcome;
  const known = kept.estimated && !other.estimated;
  const merged: ChatCallInfo = {
    ...kept,
    startedAt: known ? other.startedAt : kept.startedAt,
    outcome,
    seconds: outcome === 'talked' ? Math.max(kept.seconds, other.seconds) : 0
  };
  if (known || !kept.estimated) delete merged.estimated;
  return merged;
}

/** Words for a phone on an older version, which shows the line as plain text. */
function plainWords(info: ChatCallInfo): string {
  switch (info.outcome) {
    case 'talked':
      return `Voice call, ${durationWords(info.seconds)}`;
    case 'declined':
      return 'Call declined';
    case 'failed':
      return "Call didn't connect";
    default:
      return 'Missed voice call';
  }
}

/** "45 sec", "12 min", "1 hr 5 min". */
export function durationWords(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} sec`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** durationWords, in this phone's language - for showing; durationWords is what is kept. */
function durationShown(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return tr('{n} sec', { n: s });
  const minutes = Math.round(s / 60);
  if (minutes < 60) return tr('{n} min', { n: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? tr('{h} hr {m} min', { h, m }) : tr('{h} hr', { h });
}

/** The conversation line for a call. */
export function callLine(info: ChatCallInfo): ChatMessage {
  return {
    id: `call-${info.callId}`,
    authorId: info.caller,
    authorName: '',
    text: plainWords(info),
    timestamp: '',
    sentAt: info.startedAt,
    delivered: true,
    call: info
  };
}

/**
 * The conversation with this call's line in it: added at the time the call
 * started, or - when the line is already there - the two accounts merged.
 * The same list back when nothing changes.
 */
export function applyCallLog(
  messages: ChatMessage[],
  info: ChatCallInfo,
  insert: (list: ChatMessage[], m: ChatMessage) => ChatMessage[]
): ChatMessage[] {
  const id = `call-${info.callId}`;
  const at = messages.findIndex(m => m.id === id);
  if (at < 0) return insert(messages, callLine(info));
  const existing = messages[at];
  if (!existing.call) return messages;
  const merged = mergeCallInfo(existing.call, info);
  if (merged.startedAt !== existing.call.startedAt) {
    // A guessed start has been replaced by the real one: the line moves to it.
    const without = messages.slice(0, at).concat(messages.slice(at + 1));
    return insert(without, { ...existing, sentAt: merged.startedAt, text: plainWords(merged), call: merged });
  }
  if (
    merged.outcome === existing.call.outcome &&
    merged.seconds === existing.call.seconds &&
    !!merged.estimated === !!existing.call.estimated
  ) {
    return messages;
  }
  const next = messages.slice();
  next[at] = { ...existing, text: plainWords(merged), call: merged };
  return next;
}

/** What the line says on this phone, which depends on who rang whom. */
export function callWords(info: ChatCallInfo, me: Seat, partnerName: string): { title: string; detail?: string } {
  const mine = info.caller === me;
  switch (info.outcome) {
    case 'talked':
      return { title: tr('Voice call'), detail: durationShown(info.seconds) };
    case 'declined':
      return { title: mine ? tr('{name} declined', { name: partnerName }) : tr('You declined') };
    case 'busy':
      return mine
        ? { title: tr('No answer'), detail: tr('{name} was on another call', { name: partnerName }) }
        : { title: tr('Missed call') };
    case 'failed':
      return { title: tr("Call didn't connect") };
    default:
      return { title: mine ? tr('No answer') : tr('Missed call') };
  }
}
