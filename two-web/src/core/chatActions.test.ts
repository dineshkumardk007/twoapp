import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import {
  EDIT_WINDOW_MS,
  MAX_PINS,
  applyEdit,
  applyPin,
  applyViewed,
  canOpenViewOnce,
  deliveredCopy,
  livePins,
  applyReaction,
  applyUnsend,
  canEdit,
  canUnsend,
  cleanPhotoFields,
  cleanReplyRef,
  highlightParts,
  replyRefFor,
  searchMatches,
  snippetOf
} from './chatActions';

const SENT = 1_760_000_000_000;

function msg(over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', authorId: 'user', authorName: 'You', text: 'See you at eight', timestamp: '', sentAt: SENT, ...over };
}

describe('editing', () => {
  it('lets you change your own words for fifteen minutes', () => {
    expect(canEdit(msg(), 'user', SENT + EDIT_WINDOW_MS - 1)).toBe(true);
    expect(canEdit(msg(), 'user', SENT + EDIT_WINDOW_MS + 1)).toBe(false);
    expect(canEdit(msg(), 'partner', SENT + 1000)).toBe(false);
  });

  it('never offers to edit a voice note, a photo, a request or what was taken back', () => {
    for (const over of [{ isVoiceMemo: true }, { isPhoto: true }, { isNeedCard: true }, { unsent: true }]) {
      expect(canEdit(msg(over as Partial<ChatMessage>), 'user', SENT + 1000)).toBe(false);
    }
  });

  it('nor one still waiting to show; once it has, the usual fifteen minutes from then', () => {
    const later = msg({ sentAt: SENT + 3_600_000, showAt: SENT + 3_600_000 });
    expect(canEdit(later, 'user', SENT + 1000)).toBe(false);
    expect(canEdit(later, 'user', SENT + 3_600_000 + 60_000)).toBe(true);
  });

  it('applies the author\'s edit, inside the window as their phone timed it', () => {
    const out = applyEdit([msg()], 'user', { messageId: 'm1', text: 'See you at nine', editedAt: SENT + 60_000 });
    expect(out?.[0].text).toBe('See you at nine');
    expect(out?.[0].editedAt).toBe(SENT + 60_000);
  });

  it('refuses an edit from the other person, after the window, or out of order', () => {
    expect(applyEdit([msg()], 'partner', { messageId: 'm1', text: 'x', editedAt: SENT + 1 })).toBeNull();
    expect(applyEdit([msg()], 'user', { messageId: 'm1', text: 'x', editedAt: SENT + EDIT_WINDOW_MS + 120_000 })).toBeNull();
    const later = [msg({ text: 'b', editedAt: SENT + 5000 })];
    expect(applyEdit(later, 'user', { messageId: 'm1', text: 'a', editedAt: SENT + 2000 })).toBeNull();
    expect(applyEdit([msg()], 'user', { messageId: 'nope', text: 'x', editedAt: SENT + 1 })).toBeNull();
    expect(applyEdit([msg()], 'user', { messageId: 'm1', text: '   ', editedAt: SENT + 1 })).toBeNull();
  });
});

describe('unsending', () => {
  it('is yours to do, at any time', () => {
    expect(canUnsend(msg(), 'user')).toBe(true);
    expect(canUnsend(msg(), 'partner')).toBe(false);
    expect(canUnsend(msg({ unsent: true }), 'user')).toBe(false);
  });

  it('takes away the words, the recording, the photo and the reactions - and keeps the place', () => {
    const photo = msg({ isPhoto: true, photoDataUrl: 'data:image/jpeg;base64,AAAA', reactions: { partner: '❤️' } });
    const voice = msg({ id: 'm2', isVoiceMemo: true, audioDataUrl: 'data:audio/webm;base64,AAAA' });
    const out = applyUnsend([photo, voice], 'user', { messageId: 'm1' })!;
    expect(out[0]).toEqual({ id: 'm1', authorId: 'user', authorName: 'You', text: '', timestamp: '', sentAt: SENT, delivered: undefined, unsent: true });
    expect(applyUnsend(out, 'user', { messageId: 'm2' })![1].audioDataUrl).toBeUndefined();
  });

  it('refuses the other person, and does nothing twice', () => {
    expect(applyUnsend([msg()], 'partner', { messageId: 'm1' })).toBeNull();
    expect(applyUnsend([msg({ unsent: true })], 'user', { messageId: 'm1' })).toBeNull();
  });
});

describe('reactions', () => {
  it('keeps one from each of you, changes it, and takes it off', () => {
    let list: ChatMessage[] = [msg()];
    list = applyReaction(list, 'partner', { messageId: 'm1', emoji: '❤️' })!;
    list = applyReaction(list, 'user', { messageId: 'm1', emoji: '😂' })!;
    expect(list[0].reactions).toEqual({ partner: '❤️', user: '😂' });
    list = applyReaction(list, 'partner', { messageId: 'm1', emoji: '🙏' })!;
    expect(list[0].reactions?.partner).toBe('🙏');
    list = applyReaction(list, 'partner', { messageId: 'm1', emoji: '' })!;
    list = applyReaction(list, 'user', { messageId: 'm1', emoji: '' })!;
    expect(list[0].reactions).toBeUndefined();
  });

  it('turns down words, the same reaction again, strangers and what was taken back', () => {
    expect(applyReaction([msg()], 'partner', { messageId: 'm1', emoji: 'hello' })).toBeNull();
    expect(applyReaction([msg({ reactions: { partner: '❤️' } })], 'partner', { messageId: 'm1', emoji: '❤️' })).toBeNull();
    expect(applyReaction([msg()], 'someone', { messageId: 'm1', emoji: '❤️' })).toBeNull();
    expect(applyReaction([msg({ unsent: true })], 'partner', { messageId: 'm1', emoji: '❤️' })).toBeNull();
  });
});

describe('replies', () => {
  it('quotes a few words, or says what kind of message it was', () => {
    expect(snippetOf(msg({ text: 'a'.repeat(200) })).length).toBeLessThanOrEqual(80);
    expect(snippetOf(msg({ isVoiceMemo: true }))).toBe('Voice note');
    expect(snippetOf(msg({ isPhoto: true }))).toBe('Photo');
    expect(replyRefFor(msg())).toEqual({ id: 'm1', authorId: 'user', snippet: 'See you at eight' });
  });

  it('keeps a quote from the wire only if it is one', () => {
    expect(cleanReplyRef({ id: 'm1', authorId: 'partner', snippet: 'hi' })).toEqual({ id: 'm1', authorId: 'partner', snippet: 'hi' });
    expect(cleanReplyRef({ id: 'm1', authorId: 'stranger', snippet: 'hi' })).toBeUndefined();
    expect(cleanReplyRef('m1')).toBeUndefined();
  });
});

describe('photos from the wire', () => {
  it('keeps an image data: URL and its size', () => {
    expect(cleanPhotoFields({ isPhoto: true, photoDataUrl: 'data:image/jpeg;base64,AAAA', photoWidth: 1600, photoHeight: 1200 }))
      .toEqual({ isPhoto: true, photoDataUrl: 'data:image/jpeg;base64,AAAA', photoWidth: 1600, photoHeight: 1200 });
  });

  it('refuses anything that would be fetched, is not an image, or is too large', () => {
    expect(cleanPhotoFields({ isPhoto: true, photoDataUrl: 'https://example.com/a.jpg' })).toBeNull();
    expect(cleanPhotoFields({ isPhoto: true, photoDataUrl: 'data:text/html;base64,AAAA' })).toBeNull();
    expect(cleanPhotoFields({ isPhoto: true, photoDataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(1_000_001) })).toBeNull();
  });
});

describe('search', () => {
  const list = [
    msg({ id: 'a', text: 'Dinner at eight?' }),
    msg({ id: 'b', text: 'Voice note · 0:12', isVoiceMemo: true }),
    msg({ id: 'c', text: 'EIGHT is fine' }),
    msg({ id: 'd', text: '', unsent: true })
  ];

  it('finds words in any case, oldest first, leaving out notes, photos and what was taken back', () => {
    expect(searchMatches(list, 'eight')).toEqual(['a', 'c']);
    expect(searchMatches(list, 'note')).toEqual([]);
    expect(searchMatches(list, '  ')).toEqual([]);
  });

  it('marks every place the words appear', () => {
    expect(highlightParts('Eight, then eight', 'eight')).toEqual([
      { text: 'Eight', match: true },
      { text: ', then ', match: false },
      { text: 'eight', match: true }
    ]);
  });
});

describe('pins', () => {
  const three = ['a', 'b', 'c', 'd'].map(id => msg({ id, text: `message ${id}` }));
  const pin = (pins: ReturnType<typeof applyPin>, id: string, by = 'user', at = SENT) =>
    applyPin(pins ?? undefined, three, by, { messageId: id, pinned: true, at });

  it('keeps the newest last, and lets the oldest go past three', () => {
    let pins = pin(null, 'a');
    pins = pin(pins, 'b', 'partner');
    pins = pin(pins, 'c');
    expect(pins?.map(p => p.messageId)).toEqual(['a', 'b', 'c']);
    pins = pin(pins, 'd');
    expect(pins?.length).toBe(MAX_PINS);
    expect(pins?.map(p => p.messageId)).toEqual(['b', 'c', 'd']);
    expect(pins?.find(p => p.messageId === 'b')?.by).toBe('partner');
  });

  it('brings a pinned message forward when it is pinned again, and unpins', () => {
    const pins = pin(pin(pin(null, 'a'), 'b'), 'a');
    expect(pins?.map(p => p.messageId)).toEqual(['b', 'a']);
    const unpinned = applyPin(pins ?? undefined, three, 'partner', { messageId: 'a', pinned: false });
    expect(unpinned?.map(p => p.messageId)).toEqual(['b']);
  });

  it('changes nothing for a message that is not here, was taken back, or is already where it would go', () => {
    expect(pin(null, 'zzz')).toBeNull();
    expect(applyPin(undefined, [msg({ unsent: true })], 'user', { messageId: 'm1', pinned: true })).toBeNull();
    const pins = pin(null, 'a');
    expect(pin(pins, 'a')).toBeNull();
    expect(applyPin(pins ?? undefined, three, 'user', { messageId: 'b', pinned: false })).toBeNull();
    expect(applyPin(undefined, three, 'stranger', { messageId: 'a', pinned: true })).toBeNull();
  });

  it('drops a pin whose message was since taken back', () => {
    const pins = pin(pin(null, 'a'), 'b') ?? [];
    const byId = new Map(three.map(m => [m.id, m.id === 'a' ? { ...m, unsent: true } : m]));
    expect(livePins(pins, byId).map(p => p.messageId)).toEqual(['b']);
  });
});

describe('view-once photos', () => {
  const photo = msg({ id: 'p1', authorId: 'partner', text: 'Photo', isPhoto: true, viewOnce: true, photoDataUrl: 'data:image/jpeg;base64,AAAA' });

  it('opens once, for the person it was sent to', () => {
    expect(canOpenViewOnce(photo, 'user')).toBe(true);
    expect(canOpenViewOnce(photo, 'partner')).toBe(false);
    const opened = applyViewed([photo], 'user', { messageId: 'p1', at: SENT + 5000 });
    expect(opened?.[0].viewedAt).toBe(SENT + 5000);
    expect(opened?.[0].photoDataUrl).toBeUndefined();
    expect(canOpenViewOnce(opened![0], 'user')).toBe(false);
    expect(applyViewed(opened!, 'user', { messageId: 'p1', at: SENT + 9000 })).toBeNull();
  });

  it('cannot be marked opened by its own sender, nor an ordinary photo', () => {
    expect(applyViewed([photo], 'partner', { messageId: 'p1', at: SENT })).toBeNull();
    expect(applyViewed([{ ...photo, viewOnce: false }], 'user', { messageId: 'p1', at: SENT })).toBeNull();
  });

  it('leaves the sender without the picture once the relay has it', () => {
    const mine = { ...photo, authorId: 'user', delivered: false };
    expect(deliveredCopy(mine, 'user')).toMatchObject({ delivered: true, viewOnce: true });
    expect(deliveredCopy(mine, 'user').photoDataUrl).toBeUndefined();
    // Not someone else's, and not an ordinary photo.
    expect(deliveredCopy(photo, 'user').photoDataUrl).toBe(photo.photoDataUrl);
    expect(deliveredCopy({ ...mine, viewOnce: false }, 'user').photoDataUrl).toBe(photo.photoDataUrl);
  });

  it('is quoted as a view-once photo', () => {
    expect(snippetOf(photo)).toBe('View-once photo');
  });
});
