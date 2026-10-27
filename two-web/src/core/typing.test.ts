import { describe, expect, it } from 'vitest';
import {
  TYPING_BLUR_GRACE_MS,
  TYPING_IDLE_MS,
  TYPING_TTL_WITH_STOPS_MS,
  createTypingSender,
  typingEndedBy,
  typingNow,
  typingTtlFor,
  type TypingClock
} from './typing';
import { TYPING_REPEAT_MS, TYPING_TTL_MS } from './lastSeen';

/** A clock the test moves by hand, firing timers as it passes them. */
function fakeClock() {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: TypingClock = {
    now: () => now,
    later: (fn, ms) => {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    cancel: id => {
      timers.delete(id as number);
    }
  };
  const advance = (ms: number) => {
    const until = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = until;
  };
  return { clock, advance, at: () => now };
}

function rig() {
  const c = fakeClock();
  const said: { typing: boolean; at: number }[] = [];
  const sender = createTypingSender(typing => said.push({ typing, at: c.at() }), c.clock);
  return { ...c, said, sender };
}

describe('saying typing', () => {
  it('says so on the first key, at once', () => {
    const { sender, said } = rig();
    sender.keystroke();
    expect(said).toEqual([{ typing: true, at: 0 }]);
  });

  it('repeats at the old cadence while keys keep coming, and no faster', () => {
    const { sender, said, advance } = rig();
    for (let t = 0; t <= 7000; t += 500) {
      sender.keystroke();
      advance(500);
    }
    expect(said.filter(s => s.typing).map(s => s.at)).toEqual([0, TYPING_REPEAT_MS, TYPING_REPEAT_MS * 2]);
  });

  it('stops a few seconds after the last key, words in the box or not', () => {
    const { sender, said, advance } = rig();
    sender.keystroke();
    advance(1000);
    sender.keystroke();
    advance(TYPING_IDLE_MS - 1);
    expect(said).toHaveLength(1);
    advance(1);
    expect(said[1]).toEqual({ typing: false, at: 1000 + TYPING_IDLE_MS });
    advance(10_000);
    expect(said).toHaveLength(2);
  });

  it('never leaves a gap from somebody still writing wider than the safety lapse', () => {
    const { sender, said, advance } = rig();
    // A key just short of each repeat, then a pause just short of idle, over and over.
    for (let round = 0; round < 4; round++) {
      sender.keystroke();
      advance(TYPING_REPEAT_MS - 1);
      sender.keystroke();
      advance(TYPING_IDLE_MS - 1);
    }
    const starts = said.filter(s => s.typing).map(s => s.at);
    expect(said.some(s => !s.typing)).toBe(false);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeLessThan(TYPING_TTL_WITH_STOPS_MS);
  });

  it('says nothing at Send, and the next message starts at once', () => {
    const { sender, said, advance } = rig();
    sender.keystroke();
    advance(500);
    sender.sent();
    advance(10_000);
    expect(said).toEqual([{ typing: true, at: 0 }]);
    // Within the repeat of the last TYPING: not swallowed.
    const { sender: s2, said: said2, advance: adv2 } = rig();
    s2.keystroke();
    adv2(1000);
    s2.sent();
    s2.keystroke();
    expect(said2.map(s => s.typing)).toEqual([true, true]);
  });

  it('says stop when asked, once, and only if it had said typing', () => {
    const { sender, said, advance } = rig();
    sender.stop();
    expect(said).toEqual([]);
    sender.keystroke();
    advance(200);
    sender.stop();
    sender.stop();
    expect(said.map(s => s.typing)).toEqual([true, false]);
    advance(10_000);
    expect(said).toHaveLength(2);
  });

  it('a blur stops it after a short grace, unless a key or a send comes first', () => {
    const blurred = rig();
    blurred.sender.keystroke();
    blurred.sender.stopSoon();
    blurred.advance(TYPING_BLUR_GRACE_MS);
    expect(blurred.said.map(s => s.typing)).toEqual([true, false]);

    const tapped = rig();
    tapped.sender.keystroke();
    tapped.sender.stopSoon();
    tapped.advance(TYPING_BLUR_GRACE_MS - 100);
    tapped.sender.keystroke(); // the emoji just picked
    tapped.advance(TYPING_BLUR_GRACE_MS);
    expect(tapped.said.map(s => s.typing)).toEqual([true]);

    const sentNow = rig();
    sentNow.sender.keystroke();
    sentNow.sender.stopSoon();
    sentNow.sender.sent();
    sentNow.advance(10_000);
    expect(sentNow.said.map(s => s.typing)).toEqual([true]);
  });

  it('a blur while not typing says nothing', () => {
    const { sender, said, advance } = rig();
    sender.stopSoon();
    advance(10_000);
    expect(said).toEqual([]);
  });
});

describe('hearing typing', () => {
  it('ends with her message, by her own clock', () => {
    expect(typingEndedBy(0, 500)).toBe(true);
    expect(typingEndedBy(100, 200)).toBe(true);
    expect(typingEndedBy(200, 200)).toBe(true);
    // Said after the message went: she is writing the next one.
    expect(typingEndedBy(300, 200)).toBe(false);
    expect(typingEndedBy(100, 0)).toBe(true);
  });

  it('holds longer from a phone that says when it stops', () => {
    expect(typingTtlFor({ at: 1, stops: true })).toBe(TYPING_TTL_WITH_STOPS_MS);
    expect(typingTtlFor({ at: 1 })).toBe(TYPING_TTL_MS);
    expect(typingTtlFor({ stops: 'yes' })).toBe(TYPING_TTL_MS);
    expect(typingTtlFor(null)).toBe(TYPING_TTL_MS);
    expect(typingTtlFor(undefined)).toBe(TYPING_TTL_MS);
  });

  it('counts in a group only those not yet lapsed', () => {
    expect(typingNow(undefined, 10)).toEqual([]);
    expect(typingNow({ a: { until: 11 }, b: { until: 10 }, c: { until: 50 } }, 10)).toEqual(['a', 'c']);
  });
});
