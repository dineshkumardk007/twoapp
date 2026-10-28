// What a message's Info says: when it went, when it reached her phone and
// when she read it in the couple's chat - or, in a group, who has read it.
// Only what this phone kept. A time it never kept (a message from before it
// kept them, or history brought back) is a dash, never a guess.

import type { ChatMessage } from '../types';
import { readByPartner, type Seat } from './chatActions';
import { readBreakdown, type GroupMember, type GroupMessage } from './groups';
import { tr } from './i18n';
import { dayAndTime } from './when';

/** It happened, but this phone did not keep when. */
export const NO_TIME = '—';

export interface InfoRow {
  key: string;
  label: string;
  value: string;
  /** Blue for read, as the ticks are; quieter for what has not happened or is not shown. */
  tone?: 'read' | 'muted';
}

export interface MessageInfo {
  rows: InfoRow[];
  /** A group's message of yours: who has read it, with when where it was kept, and who has not. */
  readers?: { read: Array<{ id: string; name: string; value: string }>; unread: Array<{ id: string; name: string }> };
  /** A line or two under it: what the rows cannot say. */
  notes: string[];
}

function timeOr(at: number | undefined, now: number): string {
  return at && Number.isFinite(at) ? dayAndTime(at, now) : NO_TIME;
}

const sending = (): InfoRow => ({ key: 'sending', label: tr('Sending'), value: tr('Still on this phone'), tone: 'muted' });

/** When one of theirs was sent (their clock) and, if this phone kept it, when it arrived here. */
function arrivedRows(m: { sentAt?: number; receivedAt?: number }, now: number): InfoRow[] {
  return [
    { key: 'sent', label: tr('Sent'), value: timeOr(m.sentAt, now) },
    ...(m.receivedAt ? [{ key: 'arrived', label: tr('Arrived'), value: dayAndTime(m.receivedAt, now) }] : [])
  ];
}

export interface CoupleInfoContext {
  me: Seat;
  partnerName: string;
  partnerReadAt: number;
  partnerReadHeardAt: number;
  /** This phone shares read receipts: only then is Read shown, as the blue ticks are. */
  shareReceipts: boolean;
  /** Her phone says when a message reaches it (CHAT_DELIVERED); an older one does not. */
  partnerSaysDelivered: boolean;
  now?: number;
}

/** A message's Info in the couple's chat. */
export function coupleInfo(m: ChatMessage, o: CoupleInfoContext): MessageInfo {
  const now = o.now ?? Date.now();
  if (m.authorId !== o.me) return { rows: arrivedRows(m, now), notes: [] };
  if (m.delivered === false && !m.reached) return { rows: [sending()], notes: [] };

  const read = readByPartner(m, o.partnerReadAt, o.partnerReadHeardAt);
  // Read says it reached her too - but only while read is shown at all.
  const reached = !!m.reached || (read && o.shareReceipts);
  const rows: InfoRow[] = [
    { key: 'sent', label: tr('Sent'), value: timeOr(m.sentAt, now) },
    {
      key: 'reached',
      label: tr("Reached {name}'s phone", { name: o.partnerName }),
      value: m.reachedAt ? dayAndTime(m.reachedAt, now) : reached ? NO_TIME : tr('Not yet'),
      ...(m.reachedAt ? {} : { tone: 'muted' as const })
    },
    o.shareReceipts
      ? {
          key: 'read',
          label: tr('Read'),
          value: read ? timeOr(m.readByPartnerAt, now) : tr('Not yet'),
          tone: read ? 'read' : 'muted'
        }
      : { key: 'read', label: tr('Read'), value: tr('Read receipts are off'), tone: 'muted' }
  ];
  // A view-once photo says when it was opened whatever the receipts: its bubble does.
  if (m.viewOnce) {
    rows.push({
      key: 'opened',
      label: tr('Opened'),
      value: m.viewedAt ? dayAndTime(m.viewedAt, now) : tr('Not opened yet'),
      ...(m.viewedAt ? {} : { tone: 'muted' as const })
    });
  }

  const notes: string[] = [];
  if (o.shareReceipts && !read) notes.push(tr('If {name} has read receipts off, Read stays at Not yet.', { name: o.partnerName }));
  if (!o.partnerSaysDelivered && !m.reached) {
    notes.push(tr("{name}'s Two is an older version, which doesn't say when a message reaches it.", { name: o.partnerName }));
  }
  return { rows, notes };
}

/**
 * A message's Info in a group. Who has read one of yours, and when where it
 * was heard here; a group has no record of who has it, only of who read it.
 */
export function groupInfo(
  m: GroupMessage,
  members: GroupMember[],
  myId: string,
  shareReceipts: boolean,
  now: number = Date.now()
): MessageInfo {
  if (m.authorId !== myId) return { rows: arrivedRows(m, now), notes: [] };
  if (m.delivered === false) return { rows: [sending()], notes: [] };

  const rows: InfoRow[] = [{ key: 'sent', label: tr('Sent'), value: timeOr(m.sentAt, now) }];
  const b = readBreakdown(members, m);
  const notes: string[] = [];
  if (b.read.length === 0 && b.unread.length === 0) {
    notes.push(tr('Nobody else has joined yet.'));
    return { rows, notes };
  }
  if (!shareReceipts) {
    rows.push({ key: 'read', label: tr('Read'), value: tr('Read receipts are off'), tone: 'muted' });
    return { rows, notes };
  }
  if (b.unread.length) {
    notes.push(tr('Someone who has switched read receipts off looks the same here as someone who has not read it.'));
  }
  return {
    rows,
    readers: {
      read: b.read.map(r => ({ id: r.id, name: r.name, value: timeOr(m.readTimes?.[r.id], now) })),
      unread: b.unread.map(r => ({ id: r.id, name: r.name }))
    },
    notes
  };
}
