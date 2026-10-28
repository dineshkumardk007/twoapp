// What can happen to a chat message after it is sent: a reaction, an answer,
// a change to its words, taking it back - and finding it again.
//
// Each change travels as a record of its own that names the message
// (CHAT_REACTION, CHAT_EDIT, CHAT_UNSEND, CHAT_PIN, CHAT_VIEWED,
// CHAT_DELIVERED), the way VOICE_HEARD does, rather
// than as the message sent again: a phone that does not know them passes them
// over, and a phone being restored replays them in order, after the messages
// they change. The functions here decide what each one does to the
// conversation - the same on both phones, and nowhere else.

import type { ChatMessage, ChatPin, ChatReplyRef } from '../types';
import type { VoiceFields } from './voice';
import { isWaiting } from './sendLater';

export const CHAT_EDIT = 'CHAT_EDIT';
export const CHAT_UNSEND = 'CHAT_UNSEND';
export const CHAT_REACTION = 'CHAT_REACTION';
export const CHAT_PIN = 'CHAT_PIN';
export const CHAT_VIEWED = 'CHAT_VIEWED';
/**
 * Messages that have landed on one of the receiver's phones: `{ ids }`. Sent by
 * that phone whatever its read receipts say - having a message is not reading
 * it - and turned into two grey ticks on the sender's (applyDelivered).
 */
export const CHAT_DELIVERED = 'CHAT_DELIVERED';
/** At most this many ids in one CHAT_DELIVERED: a page of history goes in one or two. */
export const MAX_DELIVERED_IDS = 300;

/** At most this many messages stay pinned; pinning another lets the oldest go. */
export const MAX_PINS = 3;

/** How long after sending your words can still be changed. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
/** Two phones' clocks are a little apart: an edit is judged with this much grace. */
export const EDIT_GRACE_MS = 60 * 1000;

/** The reactions on offer, in the order the menu shows them. */
export const REACTIONS = ['❤️', '😂', '😮', '😢', '🙏'] as const;

/**
 * Whether this can be a reaction: an emoji, short, with no letters or digits.
 * The same test applyReaction makes of one that arrives - so anything offered
 * here shows on the other phone too, the previous version included.
 */
export function isReactionEmoji(emoji: string): boolean {
  return !!emoji && emoji.length <= 16 && !/[\p{L}\p{N}\s<>]/u.test(emoji);
}

const RECENT_REACTIONS_KEY = 'two_recent_reactions_v1';

/** The reactions you chose from the full list lately, newest first - kept on this phone only. */
export function recentReactions(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_REACTIONS_KEY) || '[]');
    return Array.isArray(list) ? list.filter((e): e is string => typeof e === 'string' && isReactionEmoji(e)).slice(0, 3) : [];
  } catch {
    return [];
  }
}

/** Remembers a reaction chosen from the full list, so it is offered first next time. */
export function rememberReaction(emoji: string): void {
  if (!isReactionEmoji(emoji) || (REACTIONS as readonly string[]).includes(emoji)) return;
  try {
    const next = [emoji, ...recentReactions().filter(e => e !== emoji)].slice(0, 3);
    localStorage.setItem(RECENT_REACTIONS_KEY, JSON.stringify(next));
  } catch {
    /* private mode: offered from the full list again next time */
  }
}

/** The row of reactions the menu offers: yours now, recent ones, then the usual five - five in all. */
export function reactionRow(current: string): string[] {
  const row: string[] = [];
  for (const e of [...recentReactions(), ...REACTIONS]) {
    if (!row.includes(e)) row.push(e);
  }
  // Yours now goes first only when it is not already offered, so it can be
  // taken off; otherwise the row keeps its order.
  return (current && !row.slice(0, 5).includes(current) ? [current, ...row] : row).slice(0, 5);
}

/** A reply's quote: this many characters of what it answers. */
export const SNIPPET_CHARS = 80;
/** Past this, words arriving as an edit are not words anybody typed. */
export const MAX_TEXT_CHARS = 10_000;

/** A photo from the wire is refused past this size (the relay carries 1 MB at most)... */
export const MAX_INCOMING_PHOTO_CHARS = 1_000_000;
/** ...or a side longer than this. */
const MAX_PHOTO_SIDE = 8192;

export type Seat = 'user' | 'partner';

/** Something there to read: not a recording, a photo, or what was taken back. */
function hasWords(m: ChatMessage): boolean {
  // A call's line (core/callLog) has words for older phones, not for this one
  // to edit, quote, pin or search.
  return !m.isVoiceMemo && !m.isPhoto && !m.unsent && !m.call;
}

/**
 * Whether this phone may still change these words: its own, plain words,
 * within the window. Not one still waiting to show (core/sendLater): that is
 * taken back and written again, so it never reaches your partner already
 * marked "edited" the first time they see it.
 */
export function canEdit(m: ChatMessage, me: Seat, now = Date.now()): boolean {
  if (typeof m.showAt === 'number' && m.showAt > now) return false;
  return m.authorId === me && hasWords(m) && !m.isNeedCard && !!m.sentAt && now - m.sentAt <= EDIT_WINDOW_MS;
}

/** Whether this phone may take a message back: its own, at any time. */
export function canUnsend(m: ChatMessage, me: Seat): boolean {
  return m.authorId === me && !m.unsent;
}

/** A few words of a message, for the quote above an answer to it. */
export function snippetOf(m: ChatMessage): string {
  if (m.isVoiceMemo) return 'Voice note';
  if (m.isPhoto) return m.viewOnce ? 'View-once photo' : 'Photo';
  const text = (m.text || '').replace(/\s+/g, ' ').trim();
  return text.length > SNIPPET_CHARS ? text.slice(0, SNIPPET_CHARS - 1).trimEnd() + '…' : text;
}

export function replyRefFor(m: ChatMessage): ChatReplyRef {
  return { id: m.id, authorId: m.authorId, snippet: snippetOf(m) };
}

/** A reply's quote as it came from the other phone - kept only if it is one. */
export function cleanReplyRef(raw: unknown): ChatReplyRef | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id || r.id.length > 100) return undefined;
  if (r.authorId !== 'user' && r.authorId !== 'partner') return undefined;
  const snippet = typeof r.snippet === 'string' ? r.snippet.slice(0, SNIPPET_CHARS) : '';
  return { id: r.id, authorId: r.authorId, snippet };
}

/**
 * What a message can carry besides its words: a recording, a photo (which may
 * be view-once), the message it answers, or when it is to show (core/sendLater).
 */
export type MessageExtras = Partial<VoiceFields> &
  Partial<PhotoFields> & { replyTo?: ChatReplyRef; viewOnce?: true; showAt?: number };

export interface PhotoFields {
  isPhoto: true;
  photoDataUrl: string;
  photoWidth: number;
  photoHeight: number;
}

/**
 * A photo as it came from the other phone. Kept only as an image data: URL -
 * nothing that would be fetched from anywhere - and within what the relay can
 * carry. A message that claims a photo and fails keeps its words ("Photo").
 */
export function cleanPhotoFields(raw: unknown): PhotoFields | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!r.isPhoto) return null;
  const url = r.photoDataUrl;
  if (
    typeof url !== 'string' ||
    !/^data:image\/(jpeg|webp|png);base64,/.test(url) ||
    url.length > MAX_INCOMING_PHOTO_CHARS
  ) {
    return null;
  }
  const side = (value: unknown) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_PHOTO_SIDE) : 0;
  };
  return { isPhoto: true, photoDataUrl: url, photoWidth: side(r.photoWidth), photoHeight: side(r.photoHeight) };
}

/** The message a change names. */
function targetOf(payload: unknown): string {
  const id = (payload as { messageId?: unknown } | null | undefined)?.messageId;
  return typeof id === 'string' ? id : '';
}

/**
 * `messages` with one of them changed - or null when the change does nothing:
 * the message is not here (gone, or not arrived yet), or `change` turns it
 * down. Null lets the caller leave the conversation exactly as it was.
 */
function changeOne(
  messages: ChatMessage[],
  id: string,
  change: (m: ChatMessage) => ChatMessage | null
): ChatMessage[] | null {
  if (!id) return null;
  const i = messages.findIndex(m => m.id === id);
  if (i < 0) return null;
  const next = change(messages[i]);
  if (!next) return null;
  const copy = messages.slice();
  copy[i] = next;
  return copy;
}

/**
 * New words for a message. Only from its own author, only for plain words,
 * and only within the window as the author's own phone reckoned it - sending
 * and editing are both timed on that phone, so the two clocks never meet.
 */
export function applyEdit(messages: ChatMessage[], authorId: string, payload: unknown): ChatMessage[] | null {
  const p = (payload || {}) as Record<string, unknown>;
  const text = typeof p.text === 'string' ? p.text.trim() : '';
  const editedAt = Number(p.editedAt);
  if (!text || text.length > MAX_TEXT_CHARS || !Number.isFinite(editedAt)) return null;
  return changeOne(messages, targetOf(payload), m => {
    if (m.authorId !== authorId || !hasWords(m) || m.isNeedCard || !m.sentAt) return null;
    if (editedAt - m.sentAt > EDIT_WINDOW_MS + EDIT_GRACE_MS) return null;
    // An earlier edit arriving after a later one.
    if (m.editedAt && m.editedAt >= editedAt) return null;
    if (m.text === text) return null;
    return { ...m, text, editedAt };
  });
}

/** The message as it is kept once taken back: that it was there, and nothing it said. */
export function unsentCopy(m: ChatMessage): ChatMessage {
  return {
    id: m.id,
    authorId: m.authorId,
    authorName: m.authorName,
    text: '',
    timestamp: m.timestamp,
    sentAt: m.sentAt,
    delivered: m.delivered,
    unsent: true
  };
}

/** Taken back - only by its author. Its words, recording and photo go; its place stays. */
export function applyUnsend(messages: ChatMessage[], authorId: string, payload: unknown): ChatMessage[] | null {
  return changeOne(messages, targetOf(payload), m =>
    m.authorId !== authorId || m.unsent ? null : unsentCopy(m)
  );
}

/**
 * A reaction set, changed, or taken off ('') - one from each of you.
 *
 * Any short emoji is accepted, not only the five on offer here, so that a
 * newer phone offering more is still understood by this one.
 */
export function applyReaction(messages: ChatMessage[], authorId: string, payload: unknown): ChatMessage[] | null {
  if (authorId !== 'user' && authorId !== 'partner') return null;
  const raw = (payload as { emoji?: unknown } | null | undefined)?.emoji;
  if (typeof raw !== 'string' || raw.length > 16 || /[\p{L}\p{N}\s<>]/u.test(raw)) return null;
  const emoji = raw;
  return changeOne(messages, targetOf(payload), m => {
    if (m.unsent) return null;
    if ((m.reactions?.[authorId] || '') === emoji) return null;
    const reactions = { ...m.reactions };
    if (emoji) reactions[authorId] = emoji;
    else delete reactions[authorId];
    return { ...m, reactions: Object.keys(reactions).length ? reactions : undefined };
  });
}

/** Anything still there can be pinned; what was taken back cannot. */
export function canPin(m: ChatMessage): boolean {
  return !m.unsent;
}

/**
 * The pins that still stand for messages on this phone, newest last. One
 * whose message was since taken back, or is no longer kept here, drops out.
 */
export function livePins(pins: ChatPin[] | undefined, byId: ReadonlyMap<string, ChatMessage>): ChatPin[] {
  if (!Array.isArray(pins) || !pins.length) return [];
  return pins.filter(p => {
    const m = p && byId.get(p.messageId);
    return !!m && canPin(m);
  });
}

/**
 * A message pinned or unpinned by either of you (`pinned`). Pinning puts it
 * last, as the newest - so pinning one already pinned brings it forward - and
 * past MAX_PINS the oldest lets go. Null when nothing changes.
 */
export function applyPin(
  pins: ChatPin[] | undefined,
  messages: ChatMessage[],
  authorId: string,
  payload: unknown
): ChatPin[] | null {
  if (authorId !== 'user' && authorId !== 'partner') return null;
  const p = (payload || {}) as Record<string, unknown>;
  const messageId = targetOf(payload);
  if (!messageId || typeof p.pinned !== 'boolean') return null;
  const byId = new Map(messages.map(m => [m.id, m]));
  const others = livePins(pins, byId).filter(x => x.messageId !== messageId);
  let next = others;
  if (p.pinned) {
    const m = byId.get(messageId);
    if (!m || !canPin(m)) return null;
    const at = Number(p.at);
    const by: Seat = authorId === 'user' ? 'user' : 'partner';
    next = [...others, { messageId, by, at: Number.isFinite(at) && at > 0 ? at : Date.now() }].slice(-MAX_PINS);
  }
  const before = Array.isArray(pins) ? pins : [];
  const same = next.length === before.length && next.every((x, i) => x.messageId === before[i]?.messageId);
  return same ? null : next;
}

/**
 * Whether this phone may open a view-once photo: it was sent to you, it has
 * not been opened, and its picture is here.
 */
export function canOpenViewOnce(m: ChatMessage, me: Seat): boolean {
  return !!m.viewOnce && m.authorId !== me && !m.viewedAt && !m.unsent && !!m.photoDataUrl;
}

/** A message without its picture: a view-once photo nobody may see again on this phone. */
export function withoutPicture(m: ChatMessage): ChatMessage {
  const { photoDataUrl: _picture, ...rest } = m;
  return rest;
}

/**
 * A message once the relay has it. Your own view-once photo keeps no picture
 * from then on - it is not to be seen on the phone that sent it - and not
 * before, because until then it may have to be sent again.
 */
export function deliveredCopy(m: ChatMessage, me: Seat): ChatMessage {
  const delivered = m.delivered ? m : { ...m, delivered: true };
  return delivered.viewOnce && delivered.authorId === me && delivered.photoDataUrl
    ? withoutPicture(delivered)
    : delivered;
}

/** `ids` as the CHAT_DELIVERED payloads that carry them, MAX_DELIVERED_IDS to each. */
export function deliveredBatches(ids: Iterable<string>): Array<{ ids: string[] }> {
  const all = [...new Set(ids)].filter(Boolean);
  const batches: Array<{ ids: string[] }> = [];
  for (let i = 0; i < all.length; i += MAX_DELIVERED_IDS) batches.push({ ids: all.slice(i, i + MAX_DELIVERED_IDS) });
  return batches;
}

/** The ids a CHAT_DELIVERED names, kept only if they could be message ids. */
export function readDeliveredIds(payload: unknown): string[] {
  const ids = (payload as { ids?: unknown } | null | undefined)?.ids;
  if (!Array.isArray(ids)) return [];
  return ids
    .filter((id): id is string => typeof id === 'string' && !!id && id.length <= 64)
    .slice(0, MAX_DELIVERED_IDS);
}

/**
 * Your messages one of the partner's phones says it has (CHAT_DELIVERED): two
 * grey ticks. On her phone means the relay had it too, so this also clears a
 * clock whose acknowledgement was lost - and your own view-once photo lets go
 * of its picture, as it does then. Null when nothing changes.
 *
 * When (`at`) goes with it, for its Info - only on the change, so a message
 * that reached her before this was kept stays without a time rather than
 * taking this one.
 */
export function applyDelivered(
  messages: ChatMessage[],
  me: Seat,
  ids: readonly string[],
  at: number = Date.now(),
  now: number = Date.now()
): ChatMessage[] | null {
  if (!ids.length) return null;
  const named = new Set(ids);
  let changed = false;
  const next = messages.map(m => {
    if (!named.has(m.id) || m.authorId !== me || m.reached) return m;
    changed = true;
    return { ...deliveredCopy(m, me), reached: true, reachedAt: heardTime(at, m, now) };
  });
  return changed ? next : null;
}

/**
 * A time her phone gave, as one of your messages keeps it. Her clock is not
 * this phone's: never before the message left here, never after now.
 */
function heardTime(at: number, m: ChatMessage, now: number): number {
  const floor = m.leftAt ?? m.sentAt ?? 0;
  const t = Number.isFinite(at) && at > 0 ? at : now;
  return Math.min(now, Math.max(t, floor));
}

/**
 * Your messages that a receipt has just turned read (readByPartner, from
 * `before` to `after`), with when (`at`) kept for their Info. Only those that
 * change: the first receipt after this was kept must not give every message
 * read long ago this one's time. Null when none changes.
 */
export function stampRead(
  messages: ChatMessage[],
  me: Seat,
  before: { readAt: number; heardAt: number },
  after: { readAt: number; heardAt: number },
  at: number,
  now: number = Date.now()
): ChatMessage[] | null {
  let changed = false;
  const next = messages.map(m => {
    if (
      m.authorId !== me ||
      m.readByPartnerAt ||
      readByPartner(m, before.readAt, before.heardAt) ||
      !readByPartner(m, after.readAt, after.heardAt)
    ) {
      return m;
    }
    changed = true;
    return { ...m, readByPartnerAt: heardTime(at, m, now) };
  });
  return changed ? next : null;
}

/** At most this many messages deleted for you are remembered, newest kept. */
export const MAX_DELETED_FOR_ME = 5000;

/**
 * Whether a message can be deleted from this phone only. Not a call's line,
 * one of yours waiting to show (that has Don't send), or one of yours that
 * never left (that has Discard).
 */
export function canDeleteForMe(m: ChatMessage, me: Seat, now: number = Date.now()): boolean {
  if (m.call || isWaiting(m, me, now)) return false;
  return !(m.authorId === me && m.delivered === false && !m.reached);
}

/**
 * The messages deleted on this phone, id to when, with one more. Kept so a
 * replay, a restore or a catch-up cannot bring it back. Past `max`, the
 * oldest deletions are let go.
 */
export function withDeletedForMe(
  list: Record<string, number> | undefined,
  id: string,
  at: number = Date.now(),
  max: number = MAX_DELETED_FOR_ME
): Record<string, number> {
  const next = { ...(list || {}), [id]: at };
  const ids = Object.keys(next);
  if (ids.length <= max) return next;
  const kept = ids.sort((a, b) => next[b] - next[a]).slice(0, max);
  return Object.fromEntries(kept.map(k => [k, next[k]]));
}

/**
 * Your messages the partner has read past (`readAt`, her READ_RECEIPT),
 * marked as having left this phone: she cannot have read what the relay never
 * had, so a clock whose acknowledgement was lost goes. Not one still waiting
 * here to go (`pending`): her watermark is your clock, and a message stuck in
 * the outbox behind one sent from your other phone, or one set for later, can
 * fall under it without ever having left. One with no `delivered` at all is
 * from before it was kept, and counts as gone already. Null when nothing
 * changes.
 */
export function settleRead(
  messages: ChatMessage[],
  me: Seat,
  readAt: number,
  pending: (id: string) => boolean
): ChatMessage[] | null {
  if (!(readAt > 0)) return null;
  let changed = false;
  const next = messages.map(m => {
    if (m.authorId !== me || m.delivered !== false || !m.sentAt || m.sentAt > readAt || pending(m.id)) return m;
    changed = true;
    return deliveredCopy(m, me);
  });
  return changed ? next : null;
}

/**
 * Your message as read by her: blue ticks.
 *
 * Her watermark (`readAt`) is a time on your clock, and a message can fall
 * under it without her ever having seen it: one that waited in your other
 * phone's outbox, or that phone's clock running behind this one. So a
 * message that keeps when it left or arrived here (`leftAt`) counts as read
 * only by a receipt heard here after that (`heardAt`, this phone's clock as
 * well). One from before leftAt was kept is read by the watermark alone.
 */
export function readByPartner(m: ChatMessage, readAt: number, heardAt: number): boolean {
  // Left this phone: the relay said so, or her phone did. One with no
  // `delivered` at all is from before it was kept, and left long ago.
  const left = m.delivered !== false || !!m.reached;
  if (!left || !m.sentAt || readAt < m.sentAt) return false;
  return m.leftAt === undefined || heardAt >= m.leftAt;
}

/**
 * Your message as the relay's acknowledgement leaves it: gone, and when it
 * went (`leftAt`, this phone's clock, `at`) kept the first time - only her
 * receipts heard after that turn it blue (readByPartner).
 *
 * Not kept for one that had already left by other word: her phone said it
 * has it (`reached`), or a receipt already heard (`readAt`) reaches it. That
 * is a message whose first acknowledgement was lost, sent again - kept then,
 * the receipt heard before this one turned a read message grey. The cost is
 * one from this phone's outbox under a watermark her other reading set,
 * blue a little early, as it was before leftAt was kept.
 */
export function ackedCopy(m: ChatMessage, me: Seat, at: number, readAt: number): ChatMessage {
  const copy = deliveredCopy(m, me);
  if (m.delivered !== false || m.leftAt !== undefined || m.reached) return copy;
  if (m.sentAt && readAt >= m.sentAt) return copy;
  return { ...copy, leftAt: at };
}

/**
 * A view-once photo opened by the person it was sent to (CHAT_VIEWED, from
 * either of their phones): the picture goes, and the bubble says it was
 * opened. Only the receiver's seat opens it, and only once.
 */
export function applyViewed(messages: ChatMessage[], viewerId: string, payload: unknown): ChatMessage[] | null {
  if (viewerId !== 'user' && viewerId !== 'partner') return null;
  const at = Number((payload as { at?: unknown } | null | undefined)?.at);
  return changeOne(messages, targetOf(payload), m => {
    if (!m.viewOnce || m.authorId === viewerId || m.viewedAt || m.unsent) return null;
    return { ...withoutPicture(m), viewedAt: Number.isFinite(at) && at > 0 ? at : Date.now() };
  });
}

/** Can be found by searching: anything with words still in it. */
function searchable(m: ChatMessage): boolean {
  return hasWords(m) && !!m.text;
}

/** The ids of the messages that hold `query`, in any case - oldest first, as the search steps through them. */
export function searchMatches(messages: ChatMessage[], query: string): string[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  return messages.filter(m => searchable(m) && m.text.toLocaleLowerCase().includes(q)).map(m => m.id);
}

/** `text` cut where `query` appears, so the matches can be marked. */
export function highlightParts(text: string, query: string): Array<{ text: string; match: boolean }> {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [{ text, match: false }];
  const lower = text.toLocaleLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let from = 0;
  for (let at = lower.indexOf(q); at >= 0; at = lower.indexOf(q, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + q.length), match: true });
    from = at + q.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}
