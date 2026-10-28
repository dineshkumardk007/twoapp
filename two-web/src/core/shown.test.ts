import { describe, expect, it } from 'vitest';
import { createShown, isShown } from './shown';

/** A page whose visibility the test sets by hand, and what its listener heard. */
function setUp(toldAwayAtStart = false) {
  let visible = true;
  const shown = createShown(() => visible, toldAwayAtStart);
  const heard: boolean[] = [];
  shown.subscribe((now) => heard.push(now));
  return {
    shown,
    heard,
    setVisible(now: boolean) {
      visible = now;
      shown.visibilityChanged();
    }
  };
}

describe('createShown', () => {
  it('goes away when the app says away, and says so once', () => {
    const { shown, heard } = setUp();
    expect(shown.isShown()).toBe(true);
    shown.tell('away');
    expect(shown.isShown()).toBe(false);
    shown.tell('away');
    expect(heard).toEqual([false]);
  });

  it('comes back when the app says here while the page is visible', () => {
    const { shown, heard } = setUp();
    shown.tell('away');
    shown.tell('here');
    expect(shown.isShown()).toBe(true);
    expect(heard).toEqual([false, true]);
  });

  it('stays hidden on here while the page itself is not visible', () => {
    const { shown, heard, setVisible } = setUp();
    shown.tell('away');
    setVisible(false);
    shown.tell('here');
    expect(shown.isShown()).toBe(false);
    expect(heard).toEqual([false]);
  });

  it('follows the page going hidden and coming back with no word from the app', () => {
    const { shown, heard, setVisible } = setUp();
    setVisible(false);
    expect(shown.isShown()).toBe(false);
    setVisible(true);
    expect(shown.isShown()).toBe(true);
    expect(heard).toEqual([false, true]);
  });

  it('clears a stale away when the page comes into view', () => {
    const { shown, heard, setVisible } = setUp();
    shown.tell('away');
    setVisible(false);
    setVisible(true);
    expect(shown.isShown()).toBe(true);
    expect(heard).toEqual([false, true]);
  });

  it('clears an away on a touch, but only while the page is visible', () => {
    const { shown, heard, setVisible } = setUp();
    setVisible(false);
    shown.tell('away');
    shown.touched();
    expect(shown.isShown()).toBe(false);
    setVisible(true);
    shown.tell('away');
    expect(shown.isShown()).toBe(false);
    shown.touched();
    expect(shown.isShown()).toBe(true);
    expect(heard).toEqual([false, true, false, true]);
  });

  it('a touch while shown changes nothing', () => {
    const { shown, heard } = setUp();
    shown.touched();
    expect(shown.isShown()).toBe(true);
    expect(heard).toEqual([]);
  });

  it('ignores anything the app might say that is not away or here', () => {
    const { shown, heard } = setUp();
    shown.tell('x');
    shown.tell(42);
    shown.tell(undefined);
    expect(shown.isShown()).toBe(true);
    shown.tell('away');
    shown.tell('gone');
    expect(shown.isShown()).toBe(false);
    expect(heard).toEqual([false]);
  });

  it('starts hidden when the app said away before the page loaded', () => {
    const { shown, heard } = setUp(true);
    expect(shown.isShown()).toBe(false);
    shown.tell('here');
    expect(shown.isShown()).toBe(true);
    expect(heard).toEqual([true]);
  });

  it('a listener that throws does not stop the others', () => {
    const shown = createShown(() => true);
    const heard: boolean[] = [];
    shown.subscribe(() => {
      throw new Error('broken');
    });
    shown.subscribe((now) => heard.push(now));
    shown.tell('away');
    expect(heard).toEqual([false]);
  });

  it('stops telling a listener once it unsubscribes', () => {
    const shown = createShown(() => true);
    const heard: boolean[] = [];
    const off = shown.subscribe((now) => heard.push(now));
    shown.tell('away');
    off();
    shown.tell('here');
    expect(heard).toEqual([false]);
  });
});

describe('the page-wide value', () => {
  it('is shown with no document and no Android app, and window.__twoLifecycle drives it', () => {
    expect(isShown()).toBe(true);
    const tell = (window as unknown as { __twoLifecycle?: (state: unknown) => void }).__twoLifecycle;
    expect(typeof tell).toBe('function');
    tell!('away');
    expect(isShown()).toBe(false);
    tell!('here');
    expect(isShown()).toBe(true);
  });
});
