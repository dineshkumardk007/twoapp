import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { swallowLiftClick } from './liftClick';

// A small stand-in for the page's window: its capturing listeners hear an event
// first, then the others (React's own, in the app), as in a real page. Node's
// own EventTarget loses a listener when the one before it removes itself while
// stopping the event, which no browser does.
class FakeWindow {
  private ls: { type: string; fn: (e: Event) => void; capture: boolean }[] = [];
  addEventListener(type: string, fn: (e: Event) => void, capture = false) {
    this.ls.push({ type, fn, capture: !!capture });
  }
  removeEventListener(type: string, fn: (e: Event) => void, capture = false) {
    this.ls = this.ls.filter(l => !(l.type === type && l.fn === fn && l.capture === !!capture));
  }
  dispatchEvent(e: Event) {
    let stopped = false;
    const orig = e.stopImmediatePropagation.bind(e);
    e.stopImmediatePropagation = () => {
      stopped = true;
      orig();
    };
    const order = [...this.ls.filter(l => l.capture), ...this.ls.filter(l => !l.capture)].filter(l => l.type === e.type);
    for (const l of order) {
      if (stopped) break;
      l.fn(e);
    }
    return !e.defaultPrevented;
  }
}

describe('swallowLiftClick (the calculator\'s = opening Two)', () => {
  let win: Window;
  let clicks: number;
  const tap = () => win.dispatchEvent(new Event('click', { cancelable: true }));
  const lift = () => win.dispatchEvent(new Event('pointerup'));
  const start = () => {
    swallowLiftClick(win);
    win.addEventListener('click', () => clicks++);
  };
  beforeEach(() => {
    vi.useFakeTimers();
    win = new FakeWindow() as unknown as Window;
    clicks = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('catches the click the lifting finger makes', () => {
    start();
    lift();
    tap();
    expect(clicks).toBe(0);
  });

  it('catches only that one: the next tap counts', () => {
    start();
    tap();
    tap();
    expect(clicks).toBe(1);
  });

  it('lets go a moment after the finger lifts with no click (it slid away)', () => {
    start();
    lift();
    vi.advanceTimersByTime(450);
    tap();
    expect(clicks).toBe(1);
  });

  it('a finger held down a while still has its lifting click caught', () => {
    start();
    vi.advanceTimersByTime(1500);
    lift();
    tap();
    expect(clicks).toBe(0);
  });

  it('never stays longer than a few seconds', () => {
    start();
    vi.advanceTimersByTime(3100);
    tap();
    expect(clicks).toBe(1);
  });
});
