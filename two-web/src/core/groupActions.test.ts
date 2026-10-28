import { describe, expect, it } from 'vitest';
import { EDIT_WINDOW_MS } from './chatActions';
import type { GroupMessage } from './groups';
import { unreadCount } from './groups';
import {
  applyGroupEdit,
  applyGroupReaction,
  applyGroupUnsend,
  canEditGroup,
  canReactGroup,
  canUnsendGroup,
  changeTargetOf,
  cleanGroupReplyRef,
  cleanMessageId,
  findTarget,
  groupMessageFromWire,
  groupReplyRefFor,
  groupSnippetOf,
  holdsGroupMessage,
  reactionSummary
} from './groupActions';

const SENT = 1_760_000_000_000;
const ASHA = 'dev-asha';
const BALA = 'dev-bala';
const CHITRA = 'dev-chitra';

function msg(over: Partial<GroupMessage> = {}): GroupMessage {
  return { id: 'gmsg-1', rid: 'rec-1', authorId: ASHA, authorName: 'Asha', text: 'See you at eight', sentAt: SENT, ...over };
}

describe('which message a change names', () => {
  it('finds it by its own id, or by the record id it travelled in', () => {
    const list = [msg(), msg({ id: 'rec-2', rid: 'rec-2', text: 'two' })];
    expect(findTarget(list, { messageId: 'gmsg-1' })).toBe(0);
    // A phone that got it on the version before filed it under the record id.
    expect(findTarget([msg({ id: 'rec-1', rid: undefined })], { messageId: 'gmsg-1', recordId: 'rec-1' })).toBe(0);
    // The author's phone, from a change made by a phone that only knows the record id.
    expect(findTarget(list, { messageId: 'rec-1' })).toBe(0);
    expect(findTarget(list, { messageId: 'nope' })).toBe(-1);
    expect(findTarget(list, {})).toBe(-1);
    expect(findTarget(list, null)).toBe(-1);
  });
  it('says both ids only when they differ', () => {
    expect(changeTargetOf(msg())).toEqual({ messageId: 'gmsg-1', recordId: 'rec-1' });
    expect(changeTargetOf(msg({ id: 'rec-1' }))).toEqual({ messageId: 'rec-1' });
    expect(changeTargetOf(msg({ rid: undefined }))).toEqual({ messageId: 'gmsg-1' });
  });
  it('takes only a plain id from the wire', () => {
    expect(cleanMessageId('gmsg-abc_1')).toBe('gmsg-abc_1');
    expect(cleanMessageId('a b')).toBe('');
    expect(cleanMessageId('x'.repeat(65))).toBe('');
    expect(cleanMessageId(42)).toBe('');
  });
});

describe('a message as it arrives', () => {
  it('is filed under the sender’s id, with the record id beside it', () => {
    const m = groupMessageFromWire('rec-9', { from: BALA, name: 'Bala', text: 'hi', at: SENT, mid: 'gmsg-9' }, BALA, null);
    expect(m).toEqual({ id: 'gmsg-9', rid: 'rec-9', authorId: BALA, authorName: 'Bala', text: 'hi', sentAt: SENT });
  });
  it('from a phone without `mid`, under the record id', () => {
    expect(groupMessageFromWire('rec-9', { text: 'hi', at: SENT }, BALA, null).id).toBe('rec-9');
  });
  it('never takes reactions, edits, an unsend or sharedId from the wire', () => {
    const m = groupMessageFromWire(
      'rec-9',
      { text: 'hi', at: SENT, mid: 'g', reactions: { x: '❤️' }, editedAt: 5, unsent: true, sharedId: true, heard: true },
      BALA,
      null
    );
    expect(m.reactions).toBeUndefined();
    expect(m.editedAt).toBeUndefined();
    expect(m.unsent).toBeUndefined();
    expect(m.sharedId).toBeUndefined();
    expect(m.heard).toBeUndefined();
  });
  it('keeps a photo only as an image, and a quote only as a quote', () => {
    const photo = { isPhoto: true, photoDataUrl: 'data:image/jpeg;base64,AAAA', photoWidth: 400, photoHeight: 300 };
    const m = groupMessageFromWire('rec-9', { text: 'Photo', at: SENT, ...photo, replyTo: { id: 'gmsg-1', authorId: ASHA, snippet: 'See you' } }, BALA, null);
    expect(m.isPhoto).toBe(true);
    expect(m.photoDataUrl).toBe(photo.photoDataUrl);
    expect(m.replyTo).toEqual({ id: 'gmsg-1', authorId: ASHA, snippet: 'See you' });
    const bad = groupMessageFromWire('rec-9', { text: 'Photo', isPhoto: true, photoDataUrl: 'https://x/y.jpg', replyTo: 'junk' }, BALA, null);
    expect(bad.isPhoto).toBeUndefined();
    expect(bad.photoDataUrl).toBeUndefined();
    expect(bad.replyTo).toBeUndefined();
    expect(bad.text).toBe('Photo');
  });
  it('is held already under either id', () => {
    const list = [msg()];
    expect(holdsGroupMessage(list, msg({ id: 'gmsg-1', rid: 'rec-1' }))).toBe(true);
    expect(holdsGroupMessage([msg({ id: 'rec-1', rid: undefined })], msg({ id: 'gmsg-1', rid: 'rec-1' }))).toBe(true);
    expect(holdsGroupMessage(list, msg({ id: 'gmsg-2', rid: 'rec-2' }))).toBe(false);
  });
});

describe('answers', () => {
  it('quote a few words, and say a voice note or a photo in fixed words', () => {
    expect(groupSnippetOf(msg({ text: '  lots\n of   space ' }))).toBe('lots of space');
    expect(groupSnippetOf(msg({ isVoiceMemo: true }))).toBe('Voice note');
    expect(groupSnippetOf(msg({ isPhoto: true }))).toBe('Photo');
    expect(groupSnippetOf(msg({ text: 'x'.repeat(200) })).length).toBe(80);
  });
  it('carry the record id too when it differs', () => {
    expect(groupReplyRefFor(msg())).toEqual({ id: 'gmsg-1', rid: 'rec-1', authorId: ASHA, authorName: 'Asha', snippet: 'See you at eight' });
  });
  it('turn down a quote that is not one', () => {
    expect(cleanGroupReplyRef(null)).toBeUndefined();
    expect(cleanGroupReplyRef({ id: 'a b', authorId: ASHA, snippet: '' })).toBeUndefined();
    expect(cleanGroupReplyRef({ id: 'g', authorId: '', snippet: '' })).toBeUndefined();
    expect(cleanGroupReplyRef({ id: 'g', authorId: 'x'.repeat(101), snippet: '' })).toBeUndefined();
    expect(cleanGroupReplyRef({ id: 'g', authorId: ASHA, authorName: 'A'.repeat(90), snippet: 'y'.repeat(200), rid: '<b>' })).toEqual({
      id: 'g',
      authorId: ASHA,
      authorName: 'A'.repeat(40),
      snippet: 'y'.repeat(80)
    });
  });
});

describe('editing', () => {
  it('is offered for your own words for fifteen minutes, once the others can find them', () => {
    expect(canEditGroup(msg(), ASHA, SENT + EDIT_WINDOW_MS - 1)).toBe(true);
    expect(canEditGroup(msg(), ASHA, SENT + EDIT_WINDOW_MS + 1)).toBe(false);
    expect(canEditGroup(msg(), BALA, SENT)).toBe(false);
    // Sent before `mid`: nobody else knows this id.
    expect(canEditGroup(msg({ rid: undefined }), ASHA, SENT)).toBe(false);
    expect(canEditGroup(msg({ rid: undefined, sharedId: true }), ASHA, SENT)).toBe(true);
    expect(canEditGroup(msg({ isVoiceMemo: true }), ASHA, SENT)).toBe(false);
  });
  it('is taken only from the author', () => {
    const edit = { messageId: 'gmsg-1', text: 'Nine, then', editedAt: SENT + 1000 };
    expect(applyGroupEdit([msg()], BALA, edit)).toBeNull();
    expect(applyGroupEdit([msg()], ASHA, edit)?.[0]).toMatchObject({ text: 'Nine, then', editedAt: SENT + 1000 });
  });
  it('is refused outside the window', () => {
    const late = { messageId: 'gmsg-1', text: 'Nine', editedAt: SENT + EDIT_WINDOW_MS + 2 * 60_000 };
    expect(applyGroupEdit([msg()], ASHA, late)).toBeNull();
  });
  it('an older edit arriving after a newer one is passed over', () => {
    const newer = applyGroupEdit([msg()], ASHA, { messageId: 'gmsg-1', text: 'Ten', editedAt: SENT + 2000 })!;
    expect(applyGroupEdit(newer, ASHA, { messageId: 'gmsg-1', text: 'Nine', editedAt: SENT + 1000 })).toBeNull();
  });
  it('the same edit twice changes nothing the second time', () => {
    const edit = { messageId: 'gmsg-1', recordId: 'rec-1', text: 'Nine', editedAt: SENT + 1000 };
    const once = applyGroupEdit([msg()], ASHA, edit)!;
    expect(applyGroupEdit(once, ASHA, edit)).toBeNull();
  });
  it('reaches a phone that filed the message under its record id', () => {
    const old = [msg({ id: 'rec-1', rid: 'rec-1' })];
    expect(applyGroupEdit(old, ASHA, { messageId: 'gmsg-1', recordId: 'rec-1', text: 'Nine', editedAt: SENT + 1 })?.[0].text).toBe('Nine');
  });
});

describe('taking back', () => {
  it('is offered for your own, once the others can find it', () => {
    expect(canUnsendGroup(msg(), ASHA)).toBe(true);
    expect(canUnsendGroup(msg(), BALA)).toBe(false);
    expect(canUnsendGroup(msg({ rid: undefined }), ASHA)).toBe(false);
    expect(canUnsendGroup(msg({ unsent: true }), ASHA)).toBe(false);
  });
  it('only by the author; its words, photo and reactions go, its place stays', () => {
    const list = [msg({ isPhoto: true, photoDataUrl: 'data:image/png;base64,AA', reactions: { [BALA]: '❤️' }, replyTo: { id: 'x', authorId: BALA, snippet: 'q' } })];
    expect(applyGroupUnsend(list, BALA, { messageId: 'gmsg-1' })).toBeNull();
    const gone = applyGroupUnsend(list, ASHA, { messageId: 'gmsg-1' })!;
    expect(gone[0]).toEqual({ id: 'gmsg-1', rid: 'rec-1', authorId: ASHA, authorName: 'Asha', text: '', sentAt: SENT, unsent: true });
    expect(applyGroupUnsend(gone, ASHA, { messageId: 'gmsg-1' })).toBeNull();
  });
  it('is not read as something new', () => {
    const group = {
      id: 'g', name: 'G', code: 'c', founder: false, nameConfirmed: true, createdAt: 0,
      members: [{ id: BALA, name: 'Bala', lastSeen: 0, readUpTo: 0 }],
      messages: [msg(), msg({ id: 'gmsg-2', unsent: true, text: '' })]
    };
    expect(unreadCount(group, BALA)).toBe(1);
  });
});

describe('reactions', () => {
  const react = (list: GroupMessage[], from: string, emoji: string) =>
    applyGroupReaction(list, from, { messageId: 'gmsg-1', emoji, at: SENT });

  it('are one from each member: set, changed, taken off', () => {
    const one = react([msg()], BALA, '❤️')!;
    expect(one[0].reactions).toEqual({ [BALA]: '❤️' });
    const two = react(one, CHITRA, '❤️')!;
    expect(two[0].reactions).toEqual({ [BALA]: '❤️', [CHITRA]: '❤️' });
    const changed = react(two, BALA, '🫶')!;
    expect(changed[0].reactions).toEqual({ [BALA]: '🫶', [CHITRA]: '❤️' });
    const off = react(react(changed, BALA, '')!, CHITRA, '')!;
    expect(off[0].reactions).toBeUndefined();
  });
  it('the same reaction twice changes nothing the second time', () => {
    const once = react([msg()], BALA, '❤️')!;
    expect(react(once, BALA, '❤️')).toBeNull();
  });
  it('turn down words, and anything on a message taken back', () => {
    expect(react([msg()], BALA, 'lol')).toBeNull();
    expect(react([msg({ unsent: true })], BALA, '❤️')).toBeNull();
    expect(react([msg()], '', '❤️')).toBeNull();
  });
  it('are offered on your own only once the others can find it', () => {
    expect(canReactGroup(msg({ rid: undefined }), ASHA)).toBe(false);
    expect(canReactGroup(msg({ rid: undefined }), BALA)).toBe(true);
    expect(canReactGroup(msg({ unsent: true }), BALA)).toBe(false);
  });
  it('are summed up the most first, yours marked', () => {
    expect(reactionSummary({ a: '😂', b: '❤️', c: '❤️', [ASHA]: '😂', d: '🙏' }, ASHA)).toEqual([
      { emoji: '😂', count: 2, mine: true },
      { emoji: '❤️', count: 2, mine: false },
      { emoji: '🙏', count: 1, mine: false }
    ]);
    expect(reactionSummary(undefined)).toEqual([]);
  });
});
