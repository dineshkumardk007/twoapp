import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import {
  EDIT_WINDOW_MS,
  MAX_DELIVERED_IDS,
  MAX_PINS,
  applyDelivered,
  deliveredBatches,
  readDeliveredIds,
  settleRead,
  readByPartner,
  ackedCopy,
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

describe('delivered to her phone', () => {
  const mine = (id: string, over: Partial<ChatMessage> = {}) => msg({ id, delivered: true, ...over });

  it('marks your own messages she names as reached, once', () => {
    const list = [mine('a'), mine('b'), msg({ id: 'c', authorId: 'partner' })];
    const out = applyDelivered(list, 'user', ['a', 'c', 'zzz'])!;
    expect(out[0].reached).toBe(true);
    expect(out[1].reached).toBeUndefined();
    // Hers is not yours to have reached anyone.
    expect(out[2].reached).toBeUndefined();
    expect(applyDelivered(out, 'user', ['a'])).toBeNull();
    expect(applyDelivered(list, 'user', [])).toBeNull();
    expect(applyDelivered(list, 'user', ['zzz'])).toBeNull();
  });

  it('clears a clock whose acknowledgement was lost, and lets go of your view-once picture', () => {
    const lost = mine('a', { delivered: false });
    const once = mine('p', { delivered: false, isPhoto: true, viewOnce: true, photoDataUrl: 'data:image/jpeg;base64,AAAA' });
    const out = applyDelivered([lost, once], 'user', ['a', 'p'])!;
    expect(out[0]).toMatchObject({ delivered: true, reached: true });
    expect(out[1]).toMatchObject({ delivered: true, reached: true, viewOnce: true });
    expect(out[1].photoDataUrl).toBeUndefined();
  });

  it('reads only ids from the wire, at most a batch of them', () => {
    expect(readDeliveredIds({ ids: ['a', 7, '', 'x'.repeat(65), 'b', null] })).toEqual(['a', 'b']);
    expect(readDeliveredIds({ ids: 'a' })).toEqual([]);
    expect(readDeliveredIds(null)).toEqual([]);
    const many = Array.from({ length: MAX_DELIVERED_IDS + 5 }, (_, i) => `m${i}`);
    expect(readDeliveredIds({ ids: many })).toHaveLength(MAX_DELIVERED_IDS);
  });

  it('cuts what landed into batches, each one readable on the other side', () => {
    expect(deliveredBatches([])).toEqual([]);
    expect(deliveredBatches(['a', 'b', 'a'])).toEqual([{ ids: ['a', 'b'] }]);
    const many = Array.from({ length: MAX_DELIVERED_IDS * 2 + 1 }, (_, i) => `m${i}`);
    const batches = deliveredBatches(new Set(many));
    expect(batches.map(b => b.ids.length)).toEqual([MAX_DELIVERED_IDS, MAX_DELIVERED_IDS, 1]);
    expect(batches.flatMap(b => readDeliveredIds(b))).toEqual(many);
  });
});

describe('read by her', () => {
  it('is her watermark alone for one from before leftAt was kept', () => {
    expect(readByPartner(msg({ sentAt: SENT }), SENT, 0)).toBe(true);
    expect(readByPartner(msg({ sentAt: SENT }), SENT - 1, 0)).toBe(false);
    expect(readByPartner(msg({ sentAt: undefined }), SENT, 0)).toBe(false);
  });

  it('is never one still waiting here', () => {
    expect(readByPartner(msg({ sentAt: SENT, delivered: false }), SENT + 5000, SENT + 5000)).toBe(false);
    // Her phone has it, though the acknowledgement was lost: it left.
    expect(readByPartner(msg({ sentAt: SENT, delivered: false, reached: true }), SENT, 0)).toBe(true);
  });

  it('needs a receipt heard after it left here (another phone outbox, or its clock behind)', () => {
    // Typed long ago on the other phone, under her watermark, come here just now.
    const late = msg({ sentAt: SENT, delivered: true, leftAt: SENT + 60_000 });
    expect(readByPartner(late, SENT + 30_000, SENT + 30_000)).toBe(false);
    // Her next receipt, heard after it came: read.
    expect(readByPartner(late, SENT + 90_000, SENT + 90_000)).toBe(true);
    // Heard the same moment it left counts.
    expect(readByPartner(late, SENT, SENT + 60_000)).toBe(true);
    // A receipt heard since still has to reach it.
    expect(readByPartner(late, SENT - 1, SENT + 90_000)).toBe(false);
  });
});

describe('acknowledged by the relay', () => {
  const waiting = () => msg({ sentAt: SENT, delivered: false });

  it('keeps when it left, the first time', () => {
    const acked = ackedCopy(waiting(), 'user', SENT + 5_000, 0);
    expect(acked).toMatchObject({ delivered: true, leftAt: SENT + 5_000 });
    // A receipt heard before it says nothing of it.
    expect(readByPartner(acked, SENT + 1_000, SENT + 4_000)).toBe(false);
    // Acknowledged again: still the first time.
    expect(ackedCopy(acked, 'user', SENT + 9_000, 0).leftAt).toBe(SENT + 5_000);
  });

  it('keeps nothing for one already gone - its first acknowledgement lost, her receipt heard first', () => {
    // Her receipt came back with the history before the one for it sent again.
    const read = ackedCopy(waiting(), 'user', SENT + 60_000, SENT);
    expect(read.leftAt).toBeUndefined();
    expect(readByPartner(read, SENT, SENT + 30_000)).toBe(true);
    // Her phone had said it has it.
    const reached = ackedCopy(msg({ sentAt: SENT, delivered: false, reached: true }), 'user', SENT + 60_000, 0);
    expect(reached.leftAt).toBeUndefined();
  });
});

describe('read past', () => {
  const none = () => false;

  it('marks as left what she has read past, and nothing newer', () => {
    const list = [
      msg({ id: 'a', delivered: false, sentAt: SENT }),
      msg({ id: 'b', delivered: false, sentAt: SENT + 1000 }),
      msg({ id: 'c', authorId: 'partner', delivered: false, sentAt: SENT })
    ];
    const out = settleRead(list, 'user', SENT, none)!;
    expect(out[0].delivered).toBe(true);
    expect(out[1].delivered).toBe(false);
    expect(out[2].delivered).toBe(false);
    // Read is not reached: that only her phone can say.
    expect(out[0].reached).toBeUndefined();
  });

  it('leaves one still waiting in the outbox a clock, whatever her watermark says', () => {
    const list = [msg({ id: 'a', delivered: false }), msg({ id: 'b', delivered: false })];
    const out = settleRead(list, 'user', SENT + 5000, id => id === 'a')!;
    expect(out[0].delivered).toBe(false);
    expect(out[1].delivered).toBe(true);
    expect(settleRead([list[0]], 'user', SENT + 5000, () => true)).toBeNull();
  });

  it('changes nothing with no watermark, or nothing to settle', () => {
    expect(settleRead([msg({ delivered: false })], 'user', 0, none)).toBeNull();
    expect(settleRead([msg({ delivered: true })], 'user', SENT, none)).toBeNull();
    // From before `delivered` was kept: left long ago, nothing to rewrite.
    expect(settleRead([msg()], 'user', SENT, none)).toBeNull();
    expect(settleRead([msg({ delivered: false, sentAt: undefined })], 'user', SENT, none)).toBeNull();
  });
});
