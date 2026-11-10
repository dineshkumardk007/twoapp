import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIM_EVERY_MS, cleanAim, forgetAimForTest, hearAim, onAim, sayAim, setAimSender, type AimSaid } from './gameAim';

describe('gameAim: watching the other one aim', () => {
  let sent: AimSaid[];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    forgetAimForTest();
    sent = [];
    setAimSender(said => sent.push(said));
  });
  afterEach(() => {
    forgetAimForTest();
    vi.useRealTimers();
  });

  it('sends the first at once, as whole numbers', () => {
    sayAim('carrom', 'g~2', 3, [500.4, -312.6, 949.9, 640.2, 1]);
    expect(sent).toEqual([{ k: 'carrom', g: 'g~2', n: 3, a: [500, -313, 950, 640, 1] }]);
  });

  it('never more often than the limit, and the latest always gets through', () => {
    for (let i = 0; i < 50; i++) {
      sayAim('carrom', 'g', 0, [200 + i]);
      vi.advanceTimersByTime(10);
    }
    // Half a second of dragging: about five, never fifty.
    expect(sent.length).toBeGreaterThanOrEqual(4);
    expect(sent.length).toBeLessThanOrEqual(6);
    vi.advanceTimersByTime(AIM_EVERY_MS);
    expect(sent[sent.length - 1].a).toEqual([249]);
    for (let i = 1; i < sent.length; i++) expect(sent[i].a![0]).toBeGreaterThan(sent[i - 1].a![0]);
  });

  it('a finger held still says nothing new', () => {
    sayAim('balloon', 'g', 1, [400, 500, 60, 40, 700, 1, 0]);
    vi.advanceTimersByTime(300);
    sayAim('balloon', 'g', 1, [400, 500, 60, 40, 700, 1, 0]);
    vi.advanceTimersByTime(300);
    expect(sent.length).toBe(1);
  });

  it('"off" goes at once, ahead of anything still waiting', () => {
    sayAim('carrom', 'g', 0, [300]);
    sayAim('carrom', 'g', 0, [320]);
    sayAim('carrom', 'g', 0, null);
    expect(sent.map(s => s.a)).toEqual([[300], null]);
    vi.advanceTimersByTime(500);
    expect(sent.length).toBe(2);
  });

  it('with nowhere to send, nothing breaks', () => {
    setAimSender(null);
    expect(() => sayAim('carrom', 'g', 0, [1])).not.toThrow();
    setAimSender(() => {
      throw new Error('socket closed');
    });
    expect(() => sayAim('carrom', 'g', 0, [2])).not.toThrow();
  });

  it('hands what came from the other phone to the boards listening', () => {
    const heard: AimSaid[] = [];
    const stop = onAim(said => heard.push(said));
    hearAim({ k: 'carrom', g: 'g', n: 2, a: [400, 0, -1000, 500, 1] });
    hearAim({ k: 'balloon', g: 'g', n: 2, a: null });
    stop();
    hearAim({ k: 'carrom', g: 'g', n: 2, a: [401] });
    expect(heard).toEqual([
      { k: 'carrom', g: 'g', n: 2, a: [400, 0, -1000, 500, 1] },
      { k: 'balloon', g: 'g', n: 2, a: null }
    ]);
  });

  it('one board failing does not stop another hearing', () => {
    const heard: AimSaid[] = [];
    onAim(() => {
      throw new Error('boom');
    });
    onAim(said => heard.push(said));
    expect(() => hearAim({ k: 'carrom', g: 'g', n: 0, a: [1] })).not.toThrow();
    expect(heard.length).toBe(1);
  });

  it('takes only what a board could have sent', () => {
    expect(cleanAim(null)).toBeNull();
    expect(cleanAim('carrom')).toBeNull();
    expect(cleanAim({ k: 'chess', g: 'g', n: 0, a: [1] })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: '', n: 0, a: [1] })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: 'x'.repeat(81), n: 0, a: [1] })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: 'g', n: -1, a: [1] })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: 'g', n: 1.5, a: [1] })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: 'g', n: 0, a: [] })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: 'g', n: 0, a: [1, 2, 3, 4, 5, 6, 7, 8, 9] })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: 'g', n: 0, a: [1, 'x'] })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: 'g', n: 0, a: [NaN] })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: 'g', n: 0, a: [Infinity] })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: 'g', n: 0, a: [1e9] })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: 'g', n: 0, a: 'no' })).toBeNull();
    expect(cleanAim({ k: 'carrom', g: 'g', n: 0 })).toEqual({ k: 'carrom', g: 'g', n: 0, a: null });
    expect(cleanAim({ k: 'balloon', g: 'g', n: 4, a: [1.4, 2.6], extra: 'dropped' })).toEqual({ k: 'balloon', g: 'g', n: 4, a: [1, 3] });
  });
});
