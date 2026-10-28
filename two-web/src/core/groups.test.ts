import { describe, expect, it } from 'vitest';
import { stampGroupRead, type GroupMessage } from './groups';
import { canDeleteGroupForMe, deletedHere, withGroupDeletedForMe } from './groupActions';

const SENT = 1_760_000_000_000;
const ME = 'dev-me';
const BALA = 'dev-bala';

function msg(over: Partial<GroupMessage> = {}): GroupMessage {
  return { id: 'gmsg-1', rid: 'rec-1', authorId: ME, authorName: 'Me', text: 'Hello', sentAt: SENT, ...over };
}

describe('when each member read your message, for Info', () => {
  const NOW = SENT + 60_000;

  it('keeps the time for the messages a read position has just moved past', () => {
    const list = [
      msg({ id: 'a', sentAt: SENT - 10 }),
      msg({ id: 'b', sentAt: SENT }),
      msg({ id: 'c', sentAt: SENT + 10 }),
      msg({ id: 'theirs', authorId: BALA, sentAt: SENT })
    ];
    const out = stampGroupRead(list, ME, BALA, SENT - 10, SENT, SENT + 500, NOW)!;
    // Read before: no time of this read.
    expect(out[0].readTimes).toBeUndefined();
    expect(out[1].readTimes).toEqual({ [BALA]: SENT + 500 });
    // Not read yet.
    expect(out[2].readTimes).toBeUndefined();
    expect(out[3].readTimes).toBeUndefined();
  });

  it('never before it was sent nor after now', () => {
    expect(stampGroupRead([msg()], ME, BALA, 0, SENT, SENT - 9000, NOW)![0].readTimes![BALA]).toBe(SENT);
    expect(stampGroupRead([msg()], ME, BALA, 0, SENT, NOW + 9000, NOW)![0].readTimes![BALA]).toBe(NOW);
  });

  it('changes nothing for a read that moves nothing, or one of your own', () => {
    expect(stampGroupRead([msg()], ME, BALA, SENT, SENT, NOW, NOW)).toBeNull();
    expect(stampGroupRead([msg()], ME, ME, 0, SENT, NOW, NOW)).toBeNull();
    const kept = msg({ readTimes: { [BALA]: SENT + 1 } });
    expect(stampGroupRead([kept], ME, BALA, 0, SENT, NOW, NOW)).toBeNull();
  });
});

describe('a group message deleted for you only', () => {
  it('is anybody\'s, but not your own that never left', () => {
    expect(canDeleteGroupForMe(msg({ authorId: BALA }), ME)).toBe(true);
    expect(canDeleteGroupForMe(msg({ delivered: true }), ME)).toBe(true);
    expect(canDeleteGroupForMe(msg({ delivered: false }), ME)).toBe(false);
  });

  it('is known again under either of its ids', () => {
    const deleted = withGroupDeletedForMe(undefined, msg(), 5);
    expect(deleted).toEqual({ 'gmsg-1': 5, 'rec-1': 5 });
    expect(deletedHere(deleted, { id: 'rec-1', rid: 'rec-1' })).toBe(true);
    expect(deletedHere(deleted, { id: 'gmsg-1' })).toBe(true);
    expect(deletedHere(deleted, { id: 'other', rid: 'rec-2' })).toBe(false);
    expect(deletedHere(undefined, msg())).toBe(false);
  });
});
