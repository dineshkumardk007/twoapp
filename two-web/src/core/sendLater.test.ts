import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../types';
import {
  MAX_HELD,
  cleanShowAt,
  dueNow,
  fromLocalInput,
  isHeld,
  isWaiting,
  laterChoices,
  newsWithout,
  nextShowAt,
  pickedTimeProblem,
  toLocalInput,
  waitsWith,
  withHeld,
  withHeldMessages,
  withdrawn
} from './sendLater';
import { applyPin, livePins } from './chatActions';
import { aheadLabel, clockTime } from './when';

const at = (h: number, m = 0, day = 22) => new Date(2026, 9, day, h, m, 0, 0).getTime();
const msg = (id: string, authorId: 'user' | 'partner', showAt?: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  authorId,
  authorName: '',
  text: id,
  timestamp: '',
  sentAt: showAt ?? 1,
  ...(showAt !== undefined ? { showAt } : {}),
  ...extra
});

describe('a time to show, as it arrives', () => {
  const now = at(21);
  it('keeps a real time', () => {
    expect(cleanShowAt(at(7, 0, 23), now)).toBe(at(7, 0, 23));
  });
  it('refuses anything that is not one', () => {
    expect(cleanShowAt(undefined, now)).toBeUndefined();
    expect(cleanShowAt('7am', now)).toBeUndefined();
    expect(cleanShowAt(NaN, now)).toBeUndefined();
    expect(cleanShowAt(-5, now)).toBeUndefined();
  });
  it('a time months away is a clock gone wrong: shown, not held', () => {
    expect(cleanShowAt(now + 90 * 86_400_000, now)).toBeUndefined();
  });
});

describe('held and waiting', () => {
  const now = at(21);
  it("the partner's message is held until its time, by this phone's clock", () => {
    expect(isHeld(msg('m', 'partner', at(7, 0, 23)), 'user', now)).toBe(true);
    expect(isHeld(msg('m', 'partner', at(7, 0, 23)), 'user', at(7, 0, 23))).toBe(false);
    expect(isHeld(msg('m', 'partner'), 'user', now)).toBe(false);
  });
  it('your own is never held from you; it waits, and says so', () => {
    expect(isHeld(msg('m', 'user', at(7, 0, 23)), 'user', now)).toBe(false);
    expect(isWaiting(msg('m', 'user', at(7, 0, 23)), 'user', now)).toBe(true);
    expect(isWaiting(msg('m', 'user', at(7, 0, 23), { unsent: true }), 'user', now)).toBe(false);
    expect(isWaiting(msg('m', 'partner', at(7, 0, 23)), 'user', now)).toBe(false);
  });
});

describe('the held list', () => {
  it('soonest first, each once', () => {
    let held = withHeld(undefined, msg('b', 'partner', at(9, 0, 23)));
    held = withHeld(held, msg('a', 'partner', at(7, 0, 23)));
    held = withHeld(held, msg('b', 'partner', at(9, 0, 23)));
    expect(held.map(m => m.id)).toEqual(['a', 'b']);
  });
  it('keeps at most MAX_HELD, dropping the furthest off', () => {
    let held: ChatMessage[] = [];
    for (let i = 0; i < MAX_HELD + 5; i++) held = withHeld(held, msg(`m${i}`, 'partner', at(7) + i * 1000));
    expect(held).toHaveLength(MAX_HELD);
    expect(held[0].id).toBe('m0');
  });
  it('gives up the ones whose time has come', () => {
    const held = [msg('a', 'partner', at(7, 0, 23)), msg('b', 'partner', at(9, 0, 23))];
    const { due, waiting } = dueNow(held, at(8, 0, 23));
    expect(due.map(m => m.id)).toEqual(['a']);
    expect(waiting.map(m => m.id)).toEqual(['b']);
    expect(nextShowAt(held, at(8, 0, 23))).toBe(at(9, 0, 23));
    expect(nextShowAt(held, at(10, 0, 23))).toBeUndefined();
  });
});

describe('taking one back before it shows', () => {
  const now = at(21);
  it("off the partner's held list, leaving no trace", () => {
    const lists = { messages: [msg('x', 'user')], heldMessages: [msg('h', 'partner', at(7, 0, 23))] };
    const out = withdrawn(lists, 'partner', 'h', now);
    expect(out?.heldMessages).toEqual([]);
    expect(out?.messages).toBe(lists.messages);
  });
  it("held here, but taken back after its time by the sender's clock: unsent as usual", () => {
    // Their clock ahead of this one: it had already shown on their phone.
    const lists = { messages: [], heldMessages: [msg('h', 'partner', at(7, 0, 23))] };
    expect(withdrawn(lists, 'partner', 'h', at(7, 5, 23))).toBeNull();
  });
  it('only by the one who wrote it', () => {
    const lists = { messages: [], heldMessages: [msg('h', 'partner', at(7, 0, 23))] };
    expect(withdrawn(lists, 'user', 'h', now)).toBeNull();
  });
  it("out of the sender's own conversation while it waits", () => {
    const lists = { messages: [msg('a', 'user'), msg('w', 'user', at(7, 0, 23))] };
    expect(withdrawn(lists, 'user', 'w', now)?.messages.map(m => m.id)).toEqual(['a']);
  });
  it('once it has shown, it is unsent the usual way', () => {
    const lists = { messages: [msg('w', 'user', at(7, 0, 23))] };
    expect(withdrawn(lists, 'user', 'w', at(8, 0, 23))).toBeNull();
    expect(withdrawn(lists, 'user', 'nothing', now)).toBeNull();
    expect(withdrawn(lists, 'user', 42, now)).toBeNull();
    expect(withdrawn({ messages: [msg('w', 'user', at(7, 0, 23), { unsent: true })] }, 'user', 'w', now)).toBeNull();
  });
  it("taken back in time, but both reach the partner's phone only after: still no trace", () => {
    // Offline all night: the message and its taking back arrive at 8, after its 7 o'clock.
    const lists = { messages: [msg('a', 'user'), msg('w', 'partner', at(7, 0, 23))] };
    expect(withdrawn(lists, 'partner', 'w', at(23))?.messages.map(m => m.id)).toEqual(['a']);
  });
});

describe('the times offered', () => {
  it('in the evening: an hour, tonight at ten, tomorrow at seven and nine', () => {
    const c = laterChoices(new Date(at(19, 20)));
    expect(c.map(x => x.label)).toEqual(['In an hour', 'Tonight at 10 pm', 'Tomorrow at 7 am', 'Tomorrow at 9 am']);
    expect(c[0].at).toBe(at(20, 20));
    expect(c[1].at).toBe(at(22));
    expect(c[2].at).toBe(at(7, 0, 23));
    expect(c[3].at).toBe(at(9, 0, 23));
  });
  it('tonight is left out once ten is close', () => {
    expect(laterChoices(new Date(at(21))).map(x => x.key)).toEqual(['hour', 'seven', 'nine']);
  });
  it("in the small hours, it is this morning's seven", () => {
    const c = laterChoices(new Date(at(1, 30)));
    expect(c.map(x => x.label)).toContain('This morning at 7 am');
    expect(c.find(x => x.key === 'seven')?.at).toBe(at(7));
  });
  it('the hour is rounded up to a whole minute', () => {
    const c = laterChoices(new Date(at(19, 20) + 15_500));
    expect(c[0].at).toBe(at(20, 21));
  });
});

describe('a time picked by hand', () => {
  const now = at(21);
  it('must be ahead, and not too far', () => {
    expect(pickedTimeProblem(at(7, 0, 23), now)).toBeNull();
    expect(pickedTimeProblem(now - 1000, now)).toBe('Pick a time that is still to come');
    expect(pickedTimeProblem(now + 40 * 86_400_000, now)).toBe('Up to 30 days ahead');
    expect(pickedTimeProblem(NaN, now)).toBe('Pick a day and a time');
  });
  it("round-trips the phone's date-and-time field", () => {
    expect(toLocalInput(at(7, 5, 23))).toBe('2026-10-23T07:05');
    expect(fromLocalInput('2026-10-23T07:05')).toBe(at(7, 5, 23));
    expect(fromLocalInput('2026-10-23T07:05:00')).toBe(at(7, 5, 23));
    expect(fromLocalInput('tomorrow')).toBeNaN();
  });
});

describe('saying when', () => {
  it('a time of day', () => {
    expect(clockTime(at(7))).toBe('7:00 am');
    expect(clockTime(at(0, 5))).toBe('12:05 am');
    expect(clockTime(at(12, 30))).toBe('12:30 pm');
    expect(clockTime(at(22))).toBe('10:00 pm');
  });
  it('a moment ahead', () => {
    const now = at(21);
    expect(aheadLabel(at(22), now)).toBe('today at 10:00 pm');
    expect(aheadLabel(at(7, 0, 23), now)).toBe('tomorrow at 7:00 am');
    expect(aheadLabel(at(7, 0, 29), now)).toBe('on Thu 29 Oct at 7:00 am');
  });
});

describe('what goes with one still held', () => {
  const held = [msg('w', 'partner', at(7, 0, 23))];
  const reply = (extra: Partial<ChatMessage> = {}) =>
    msg('r', 'partner', undefined, { replyTo: { id: 'w', authorId: 'partner', snippet: 'Good morning' }, ...extra });
  it('a reply to it waits until it shows - its quote would give the words away', () => {
    expect(waitsWith(reply(), held)).toBe(at(7, 0, 23));
    expect(waitsWith(reply({ showAt: at(9, 0, 23) }), held)).toBe(at(9, 0, 23));
    expect(waitsWith(reply(), [])).toBeUndefined();
    expect(waitsWith(reply(), undefined)).toBeUndefined();
    expect(waitsWith(msg('n', 'partner'), held)).toBeUndefined();
  });
  it('a pin on it is kept, and shows when it does', () => {
    const lists = { messages: [msg('a', 'partner')], heldMessages: held };
    const pins = applyPin(undefined, withHeldMessages(lists), 'partner', { messageId: 'w', pinned: true, at: 5 });
    expect(pins?.map(p => p.messageId)).toEqual(['w']);
    expect(livePins(pins!, new Map(lists.messages.map(m => [m.id, m])))).toEqual([]);
    expect(withHeldMessages({ messages: lists.messages })).toBe(lists.messages);
  });
});

describe("Home's news, once a message it was about is withdrawn", () => {
  const line = (id: string, at = 5) => ({ id, tabId: 'chat', type: 'CHAT', at });
  const dates = { id: 'd', tabId: 'home', type: 'OUR_DATES', at: 1 };
  it('goes back to the newest of theirs that arrived here', () => {
    const messages = [
      msg('a', 'partner', undefined, { sentAt: 3, receivedAt: 4 }),
      msg('b', 'partner', undefined, { sentAt: 4 }),
      msg('c', 'user', undefined, { sentAt: 5 })
    ];
    expect(newsWithout([dates, line('w')], 'w', messages, 'partner')).toEqual([dates, line('a', 4)]);
  });
  it('or goes, when none did', () => {
    expect(newsWithout([dates, line('w')], 'w', [msg('b', 'partner')], 'partner')).toEqual([dates]);
  });
  it('a line about something else stays', () => {
    expect(newsWithout([line('x')], 'w', [], 'partner')).toBeNull();
  });
});
