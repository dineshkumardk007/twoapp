// The chat riding the keyboard (the Android app's ImeRide).
//
// Everywhere else Android makes the page shorter for the keyboard once, as
// the keyboard starts to move. In a chat that made the message box jump: it
// was up at the keyboard's final height while the keys were still sliding
// in, and dropped before they had gone. So while a chat is open the page asks
// to keep its full height, and the app tells it on every frame where the
// keyboard is and where it is going: window.__twoIme(now, to), in CSS pixels.
//
// Between the two the chat keeps the layout with the taller conversation -
// the one before an opening keyboard, the one after a closing one - and the
// message box (with whatever sits on it: an answer's quote) and, when you are
// at the newest message, the messages themselves are moved with the keyboard
// as a picture: a transform, nothing laid out again. When the keyboard stops
// the chat is laid out once for it, and the picture is put back - the chat's
// own pin to the newest message (its ResizeObserver) runs in the same frame,
// so nothing moves.
//
// The layout is read in CSS as --two-ime (index.css, html.ime-ride): the room
// the keyboard takes, which also stands in for --two-kb, so the dock under a
// chat and the emoji panel give way to it as they do to a resizing keyboard.

import { IME_SETTLED_EVENT, KEYBOARD_MIN_PX, noteKeyboardHeight } from './keyboard';

interface RideBridge {
  keyboardOverlay?: (on: boolean) => void;
}

function bridge(): RideBridge | null {
  try {
    return (window as unknown as { AndroidBridge?: RideBridge }).AndroidBridge ?? null;
  } catch {
    return null;
  }
}

/**
 * How far the message box moves from where the layout `laid` puts it, for a
 * keyboard `now` high, over a dock `dock` high: the dock holds the box up
 * until the keyboard is taller than it. Negative is up.
 */
export function rideOffset(now: number, laid: number, dock: number): number {
  return -(Math.max(dock, now) - Math.max(dock, laid));
}

/** The layout kept while the keyboard moves from `from` to `to`: the taller conversation. */
export function laidWhileMoving(from: number, to: number): number {
  return Math.min(from, to);
}

let riders = 0;
let laid = 0;
let lastNow = 0;
let lastTo = 0;
let moving: { riders: HTMLElement[]; content: HTMLElement | null } | null = null;

const root = () => document.documentElement;

function dockHeight(): number {
  if (root().classList.contains('panel-up')) return 0;
  return parseFloat(getComputedStyle(root()).getPropertyValue('--two-dock-h')) || 0;
}

function lay(px: number) {
  laid = px;
  root().style.setProperty('--two-ime', `${px}px`);
  root().classList.toggle('kb-up', px >= Math.max(KEYBOARD_MIN_PX, dockHeight()));
}

/**
 * What moves: everything in the chat that stands below its conversation in
 * the page's flow - the quote of what is being answered, the message box -
 * and the conversation's own contents when it is at its newest message.
 */
function findMoving(): { riders: HTMLElement[]; content: HTMLElement | null } {
  const list = document.querySelector<HTMLElement>('.chat-shell [data-kb-list]');
  const shell = list?.closest<HTMLElement>('.chat-shell');
  if (!list || !shell) return { riders: [], content: null };
  let top: HTMLElement = list;
  while (top.parentElement && top.parentElement !== shell) top = top.parentElement;
  const found: HTMLElement[] = [];
  for (let el = top.nextElementSibling; el; el = el.nextElementSibling) {
    if (!(el instanceof HTMLElement)) continue;
    const position = getComputedStyle(el).position;
    if (position === 'fixed' || position === 'absolute') continue;
    found.push(el);
  }
  const atNewest = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
  const content = atNewest ? list.querySelector<HTMLElement>('[data-kb-content]') : null;
  return { riders: found, content };
}

function place(els: { riders: HTMLElement[]; content: HTMLElement | null }, offset: number) {
  const value = offset ? `translate3d(0, ${offset}px, 0)` : '';
  for (const el of els.riders) el.style.transform = value;
  if (els.content) els.content.style.transform = value;
}

function release(els: { riders: HTMLElement[]; content: HTMLElement | null }) {
  for (const el of els.riders) {
    el.style.transform = '';
    el.style.willChange = '';
  }
  if (els.content) {
    els.content.style.transform = '';
    els.content.style.willChange = '';
  }
}

/** One frame of the keyboard, from the app. */
function step(now: number, to: number) {
  if (riders === 0) return;
  now = Math.max(0, Math.round(now) || 0);
  to = Math.max(0, Math.round(to) || 0);
  // With emoji or stickers in its place the message box stays put: the panel
  // gives way to the keyboard (KeyboardPanel), so only the layout follows.
  const still = root().classList.contains('panel-up');

  if (to !== lastTo || !moving) {
    if (moving) release(moving);
    const from = lastNow;
    lastTo = to;
    moving = still ? { riders: [], content: null } : findMoving();
    for (const el of moving.riders) el.style.willChange = 'transform';
    if (moving.content) moving.content.style.willChange = 'transform';
    lay(laidWhileMoving(from, to));
  }
  lastNow = now;

  if (now === to) {
    // Stopped: laid out for it once, and the picture put back in the same frame.
    lay(to);
    release(moving);
    moving = null;
    if (to >= KEYBOARD_MIN_PX) noteKeyboardHeight(to);
    window.dispatchEvent(new CustomEvent(IME_SETTLED_EVENT, { detail: to }));
    return;
  }
  place(moving, rideOffset(now, laid, dockHeight()));
}

/**
 * While a chat is on screen in the app: the keyboard is ridden, not resized
 * for. Returns the way to stop. A no-op on the website and on an app from
 * before it could.
 */
export function rideKeyboard(): () => void {
  const b = bridge();
  if (!b || typeof b.keyboardOverlay !== 'function') return () => {};
  riders++;
  if (riders === 1) {
    lastNow = 0;
    lastTo = 0;
    moving = null;
    lay(0);
    root().classList.add('ime-ride');
    (window as unknown as { __twoIme?: (now: number, to: number) => void }).__twoIme = step;
    try {
      b.keyboardOverlay!(true);
    } catch {
      /* the ordinary resize, then */
    }
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    riders--;
    if (riders > 0) return;
    try {
      b.keyboardOverlay!(false);
    } catch {
      /* the page is going anyway */
    }
    if (moving) release(moving);
    moving = null;
    root().classList.remove('ime-ride', 'kb-up');
    root().style.removeProperty('--two-ime');
    laid = 0;
  };
}
