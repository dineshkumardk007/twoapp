// What can happen to a group message after it is sent - an answer, a
// reaction, new words, taking it back - the group's side of core/chatActions.
//
// The couple's functions are built around two seats; a group has members, any
// number of them, each named by its device's member id. So the rules are the
// same and the code is its own: each change is a record that names the
// message (GROUP_CHAT_EDIT, GROUP_CHAT_UNSEND, GROUP_CHAT_REACTION), applied
// here the same on every phone, and a replay or a second copy changes nothing.
//
// Which message is meant is the hard part. Until `mid`, the sender kept a
// message under its own id and everyone else under the relay's record id, so
// a change names both: `messageId` (what this phone calls it) and, when it is
// different, `recordId`. A phone that got the message on the version before
// still finds it.

import {
  EDIT_GRACE_MS,
  EDIT_WINDOW_MS,
  MAX_TEXT_CHARS,
  SNIPPET_CHARS,
  cleanPhotoFields,
  isReactionEmoji,
  withDeletedForMe
} from './chatActions';
import type { VoiceFields } from './voice';
import { MAX_GROUP_MESSAGES, type GroupMessage, type GroupReplyRef } from './groups';

/** A message id from the wire: short, and only letters, digits, - and _. */
export function cleanMessageId(raw: unknown): string {
  return typeof raw === 'string' && raw.length <= 64 && /^[\w-]+$/.test(raw) ? raw : '';
}

/** What a change says about the message it names. */
export function changeTargetOf(m: GroupMessage): { messageId: string; recordId?: string } {
  return { messageId: m.id, ...(m.rid && m.rid !== m.id ? { recordId: m.rid } : {}) };
}

/**
 * Where the message a change names is, or -1. Its own id first; then either
 * id against what this phone holds, as a message may be filed under either.
 */
export function findTarget(messages: GroupMessage[], payload: unknown): number {
  const p = (payload || {}) as Record<string, unknown>;
  const messageId = cleanMessageId(p.messageId);
  const recordId = cleanMessageId(p.recordId);
  if (!messageId && !recordId) return -1;
  const exact = messageId ? messages.findIndex(m => m.id === messageId) : -1;
  if (exact >= 0) return exact;
  const keys = [messageId, recordId].filter(Boolean);
  return messages.findIndex(m => keys.includes(m.id) || (!!m.rid && keys.includes(m.rid)));
}

/** Something there to read: not a recording, a photo, or what was taken back. */
export function groupHasWords(m: GroupMessage): boolean {
  return !m.isVoiceMemo && !m.isPhoto && !m.unsent;
}

/**
 * Whether the other phones know this message by an id this one can name.
 * Your own from before `mid` were filed elsewhere under an id this phone
 * never learnt, so a change to one would land nowhere.
 */
export function idKnownToAll(m: GroupMessage): boolean {
  return !!m.sharedId || !!m.rid;
}

/** Your own plain words, within the fifteen minutes, that every phone can find. */
export function canEditGroup(m: GroupMessage, myId: string, now = Date.now()): boolean {
  return m.authorId === myId && idKnownToAll(m) && groupHasWords(m) && !!m.sentAt && now - m.sentAt <= EDIT_WINDOW_MS;
}

/** Your own, at any time, as long as every phone can find it. */
export function canUnsendGroup(m: GroupMessage, myId: string): boolean {
  return m.authorId === myId && idKnownToAll(m) && !m.unsent;
}

/** Anybody's still there; your own only when the others can find it. */
export function canReactGroup(m: GroupMessage, myId: string): boolean {
  return !m.unsent && (m.authorId !== myId || idKnownToAll(m));
}

/** Anybody's, deleted from this phone only - not your own that never left, which has Discard. */
export function canDeleteGroupForMe(m: GroupMessage, myId: string): boolean {
  return !(m.authorId === myId && m.delivered === false);
}

/**
 * Whether this phone deleted a message for itself (GroupSpace.deletedForMe).
 * Asked under both its ids: it arrives again under whichever the sender's
 * version files it by.
 */
export function deletedHere(deleted: Record<string, number> | undefined, m: { id: string; rid?: string }): boolean {
  return !!deleted && (!!deleted[m.id] || (!!m.rid && !!deleted[m.rid]));
}

/** The group's deleted list with one more message, under both its ids, the newest kept. */
export function withGroupDeletedForMe(
  deleted: Record<string, number> | undefined,
  m: { id: string; rid?: string },
  at: number = Date.now()
): Record<string, number> {
  const max = MAX_GROUP_MESSAGES * 2;
  const next = withDeletedForMe(deleted, m.id, at, max);
  return m.rid && m.rid !== m.id ? withDeletedForMe(next, m.rid, at, max) : next;
}

/** A few words of a message, for the quote above an answer to it. */
export function groupSnippetOf(m: GroupMessage): string {
  if (m.isVoiceMemo) return 'Voice note';
  if (m.isPhoto) return 'Photo';
  const text = (m.text || '').replace(/\s+/g, ' ').trim();
  return text.length > SNIPPET_CHARS ? text.slice(0, SNIPPET_CHARS - 1).trimEnd() + '…' : text;
}

export function groupReplyRefFor(m: GroupMessage): GroupReplyRef {
  return {
    id: m.id,
    ...(m.rid && m.rid !== m.id ? { rid: m.rid } : {}),
    authorId: m.authorId,
    ...(m.authorName ? { authorName: m.authorName.slice(0, 40) } : {}),
    snippet: groupSnippetOf(m)
  };
}

/** A reply's quote as it came from another phone - kept only if it is one. */
export function cleanGroupReplyRef(raw: unknown): GroupReplyRef | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const id = cleanMessageId(r.id);
  if (!id) return undefined;
  if (typeof r.authorId !== 'string' || !r.authorId || r.authorId.length > 100) return undefined;
  const rid = cleanMessageId(r.rid);
  const authorName = typeof r.authorName === 'string' ? r.authorName.slice(0, 40) : '';
  const snippet = typeof r.snippet === 'string' ? r.snippet.slice(0, SNIPPET_CHARS) : '';
  return {
    id,
    ...(rid && rid !== id ? { rid } : {}),
    authorId: r.authorId,
    ...(authorName ? { authorName } : {}),
    snippet
  };
}

/**
 * A GROUP_CHAT as it is kept. Built field by field, so nothing arrives that
 * was not asked for: never `heard`, reactions, an edit, an unsend or
 * `sharedId`, which are this phone's own or come as records of their own. A
 * recording is kept only as `voice`, what cleanVoiceFields made of it (passed
 * in: core/voice brings the radio with it), and a picture only as
 * cleanPhotoFields accepts it; one that fails shows as its words, its label.
 */
export function groupMessageFromWire(recordId: string, parsed: any, from: string, voice: VoiceFields | null): GroupMessage {
  const photo = voice ? null : cleanPhotoFields(parsed);
  const reply = cleanGroupReplyRef(parsed?.replyTo);
  return {
    // Filed under the sender's own id, so every phone names it the same.
    id: cleanMessageId(parsed?.mid) || recordId,
    rid: recordId,
    authorId: from,
    authorName: String(parsed?.name || 'Someone'),
    text: String(parsed?.text || ''),
    sentAt: Number(parsed?.at) || Date.now(),
    ...(voice || photo || {}),
    ...(reply ? { replyTo: reply } : {})
  };
}

/** Whether this phone already holds a GROUP_CHAT, under either of its ids. */
export function holdsGroupMessage(messages: GroupMessage[], message: GroupMessage): boolean {
  return messages.some(m => m.id === message.id || (!!message.rid && (m.rid === message.rid || m.id === message.rid)));
}

/**
 * `messages` with the one named changed - or null when the change does
 * nothing: the message is not here (trimmed, never arrived), or `change`
 * turns it down. Null leaves the group exactly as it was.
 */
function changeOne(
  messages: GroupMessage[],
  payload: unknown,
  change: (m: GroupMessage) => GroupMessage | null
): GroupMessage[] | null {
  const i = findTarget(messages, payload);
  if (i < 0) return null;
  const next = change(messages[i]);
  if (!next) return null;
  const copy = messages.slice();
  copy[i] = next;
  return copy;
}

/**
 * New words. Only from its author, only for plain words, and only within the
 * window as the author's own phone reckoned it, as in the couple's chat.
 */
export function applyGroupEdit(messages: GroupMessage[], from: string, payload: unknown): GroupMessage[] | null {
  const p = (payload || {}) as Record<string, unknown>;
  const text = typeof p.text === 'string' ? p.text.trim() : '';
  const editedAt = Number(p.editedAt);
  if (!from || !text || text.length > MAX_TEXT_CHARS || !Number.isFinite(editedAt)) return null;
  return changeOne(messages, payload, m => {
    if (m.authorId !== from || !groupHasWords(m) || !m.sentAt) return null;
    if (editedAt - m.sentAt > EDIT_WINDOW_MS + EDIT_GRACE_MS) return null;
    // An earlier edit arriving after a later one.
    if (m.editedAt && m.editedAt >= editedAt) return null;
    if (m.text === text) return null;
    return { ...m, text, editedAt };
  });
}

/** The message as it is kept once taken back: that it was there, and nothing it said. */
export function groupUnsentCopy(m: GroupMessage): GroupMessage {
  return {
    id: m.id,
    ...(m.rid ? { rid: m.rid } : {}),
    ...(m.sharedId ? { sharedId: true as const } : {}),
    authorId: m.authorId,
    authorName: m.authorName,
    text: '',
    sentAt: m.sentAt,
    ...(m.delivered !== undefined ? { delivered: m.delivered } : {}),
    unsent: true
  };
}

/** Taken back - only by its author. Its words, recording, photo and reactions go; its place stays. */
export function applyGroupUnsend(messages: GroupMessage[], from: string, payload: unknown): GroupMessage[] | null {
  if (!from) return null;
  return changeOne(messages, payload, m => (m.authorId !== from || m.unsent ? null : groupUnsentCopy(m)));
}

/**
 * A member's reaction set, changed, or taken off (''). One from each member.
 * Any short emoji is taken, not only those on offer, so a newer phone that
 * offers more is still understood.
 */
export function applyGroupReaction(messages: GroupMessage[], from: string, payload: unknown): GroupMessage[] | null {
  if (!from || from.length > 100) return null;
  const emoji = (payload as { emoji?: unknown } | null | undefined)?.emoji;
  if (typeof emoji !== 'string' || (emoji !== '' && !isReactionEmoji(emoji))) return null;
  return changeOne(messages, payload, m => {
    if (m.unsent) return null;
    if ((m.reactions?.[from] || '') === emoji) return null;
    const reactions = { ...m.reactions };
    if (emoji) reactions[from] = emoji;
    else delete reactions[from];
    return { ...m, reactions: Object.keys(reactions).length ? reactions : undefined };
  });
}

/** The reactions on a message, each emoji once with how many chose it: the most first. */
export function reactionSummary(
  reactions: Record<string, string> | undefined,
  myId?: string
): Array<{ emoji: string; count: number; mine: boolean }> {
  const out: Array<{ emoji: string; count: number; mine: boolean }> = [];
  for (const [who, emoji] of Object.entries(reactions || {})) {
    if (!emoji) continue;
    let entry = out.find(e => e.emoji === emoji);
    if (!entry) {
      entry = { emoji, count: 0, mine: false };
      out.push(entry);
    }
    entry.count++;
    if (who === myId) entry.mine = true;
  }
  // Sorted stably, so a tie keeps the order they were first chosen in.
  return out.map((e, i) => ({ e, i })).sort((a, b) => b.e.count - a.e.count || a.i - b.i).map(x => x.e);
}
