// What can happen to a chat message after it is sent: a reaction, an answer,
// a change to its words, taking it back - and finding it again.
//
// Each change travels as a record of its own that names the message
// (CHAT_REACTION, CHAT_EDIT, CHAT_UNSEND), the way VOICE_HEARD does, rather
// than as the message sent again: a phone that does not know them passes them
// over, and a phone being restored replays them in order, after the messages
// they change. The functions here decide what each one does to the
// conversation - the same on both phones, and nowhere else.

import type { ChatMessage, ChatReplyRef } from '../types';
import type { VoiceFields } from './voice';

export const CHAT_EDIT = 'CHAT_EDIT';
export const CHAT_UNSEND = 'CHAT_UNSEND';
export const CHAT_REACTION = 'CHAT_REACTION';

/** How long after sending your words can still be changed. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
/** Two phones' clocks are a little apart: an edit is judged with this much grace. */
const EDIT_GRACE_MS = 60 * 1000;

/** The reactions on offer, in the order the menu shows them. */
export const REACTIONS = ['❤️', '😂', '😮', '😢', '🙏'] as const;

/** A reply's quote: this many characters of what it answers. */
const SNIPPET_CHARS = 80;
/** Past this, words arriving as an edit are not words anybody typed. */
const MAX_TEXT_CHARS = 10_000;

/** A photo from the wire is refused past this size (the relay carries 1 MB at most)... */
export const MAX_INCOMING_PHOTO_CHARS = 1_000_000;
/** ...or a side longer than this. */
const MAX_PHOTO_SIDE = 8192;

export type Seat = 'user' | 'partner';

/** Something there to read: not a recording, a photo, or what was taken back. */
function hasWords(m: ChatMessage): boolean {
  return !m.isVoiceMemo && !m.isPhoto && !m.unsent;
}

/** Whether this phone may still change these words: its own, plain words, within the window. */
export function canEdit(m: ChatMessage, me: Seat, now = Date.now()): boolean {
  return m.authorId === me && hasWords(m) && !m.isNeedCard && !!m.sentAt && now - m.sentAt <= EDIT_WINDOW_MS;
}

/** Whether this phone may take a message back: its own, at any time. */
export function canUnsend(m: ChatMessage, me: Seat): boolean {
  return m.authorId === me && !m.unsent;
}

/** A few words of a message, for the quote above an answer to it. */
export function snippetOf(m: ChatMessage): string {
  if (m.isVoiceMemo) return 'Voice note';
  if (m.isPhoto) return 'Photo';
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

/** What a message can carry besides its words: a recording, a photo, or the message it answers. */
export type MessageExtras = Partial<VoiceFields> & Partial<PhotoFields> & { replyTo?: ChatReplyRef };

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
