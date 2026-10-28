// A finger on a message, in the couple's chat and in a group's. Held still,
// it opens the message's menu; drawn to the right, it answers the message;
// two quick taps put a heart on it.
//
// The handlers go on the message's whole line, not only its bubble, so a
// pull that starts in the space beside a short message answers it too.

import { useRef, useState } from 'react';
import type React from 'react';
import { haptic } from './haptics';

/** A press held this long without moving opens the message's menu. */
export const LONG_PRESS_MS = 420;
/** A click this soon after a long press or a drag ended belongs to it, not to what is under the finger. */
export const SWALLOW_MS = 800;
/** Dragged this far to the right, a message is answered when let go. */
export const SWIPE_REPLY_PX = 56;
/** What two taps put on a message: the heart, as WhatsApp's double tap. */
export const HEART = '❤️';
/** A second tap this soon after the first, near it, is a double tap. */
export const DOUBLE_TAP_MS = 280;
/** How far apart the two taps of a double tap may land. */
const DOUBLE_TAP_PX = 30;

interface GestureOptions {
  /** Held still: the message's menu, beside its bubble. */
  onLongPress: (id: string, bubble: HTMLElement) => void;
  /** Drawn far enough to the right and let go: answer it. */
  onSwipeReply: (id: string) => void;
  /** A menu is open already, so a right click does not open a second. */
  menuOpen: () => boolean;
  /** Tapped twice: a heart on it, or off it again. */
  onDoubleTap?: (id: string) => void;
}

export interface MessageGestures {
  pressStart: (e: React.PointerEvent<HTMLElement>, id: string) => void;
  pressMove: (e: React.PointerEvent<HTMLElement>) => void;
  pressEnd: (e: React.PointerEvent<HTMLElement>) => void;
  /** A right click, or a phone's own long press: the same menu. */
  pressContextMenu: (e: React.MouseEvent<HTMLElement>, id: string) => void;
  /**
   * For the line's onClickCapture: eats the click that ends a long press, a
   * drag or a double tap, and holds back a tap on a photo (data-tap-wait)
   * for a moment, in case a second tap makes it a heart instead.
   */
  swallowClick: (e: React.MouseEvent<HTMLElement>) => void;
}

/**
 * The handlers for a message's bubble. The same functions for the life of the
 * screen, with what they call read through a ref, so a laid-out conversation
 * that uses them is not built again when the screen around it is.
 *
 * Followed in a ref, with the drag written straight onto the message's row,
 * so neither goes through a render of the conversation. A drag that starts on
 * a voice note's waveform is the player's: that is how it is scrubbed. The
 * row is the bubble's parent; it moves, and its --pull brings the answer
 * arrow into view.
 */
export function useMessageGestures(options: GestureOptions): MessageGestures {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [gestures] = useState(() => makeGestures(() => optionsRef.current));
  return gestures;
}

function makeGestures(now: () => GestureOptions): MessageGestures {
  let press: {
    id: string;
    pointerId: number;
    x: number;
    y: number;
    timer: number;
    bubble: HTMLElement;
    row: HTMLElement;
    swiping: boolean;
    pull: number;
    armed: boolean;
  } | null = null;
  /**
   * When a long press or a drag last ended, so the click that comes straight
   * after it does not also open a photo or follow a quote. A moment later it
   * no longer counts: a click from the keyboard is never eaten.
   */
  let swallowAt = 0;
  /** The last tap, for the second of a double tap. */
  let lastTap: { id: string; at: number; x: number; y: number } | null = null;
  /** A tap on a photo held back until it is clear no second tap is coming. */
  let waiting: { timer: number; target: HTMLElement } | null = null;
  /** True while a held-back tap is being let through. */
  let replaying = false;

  const pressStart = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[role="slider"]')) return;
    const found = parts(e.currentTarget);
    if (!found) return;
    const { bubble, row } = found;
    // A button under the message - its reactions, who has read it - is
    // that button's, not the message's.
    const button = target.closest('button, a');
    if (button && !bubble.contains(button)) return;
    swallowAt = 0;
    window.clearTimeout(press?.timer);
    const timer = window.setTimeout(() => {
      const p = press;
      if (!p || p.swiping) return;
      swallowAt = Date.now();
      press = null;
      now().onLongPress(p.id, p.bubble);
    }, LONG_PRESS_MS);
    press = {
      id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, timer, bubble, row, swiping: false, pull: 0, armed: false
    };
  };

  const pressMove = (e: React.PointerEvent<HTMLElement>) => {
    const p = press;
    if (!p || p.pointerId !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.swiping) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      window.clearTimeout(p.timer);
      // Up and down is scrolling; only a pull to the right answers.
      if (dx <= 0 || Math.abs(dx) < Math.abs(dy) * 1.5) {
        press = null;
        return;
      }
      p.swiping = true;
      lastTap = null;
      try {
        p.row.setPointerCapture(e.pointerId);
      } catch {
        /* the finger is already up */
      }
    }
    p.pull = Math.min(80, dx * 0.6);
    p.row.style.transition = 'none';
    p.row.style.transform = `translateX(${p.pull}px)`;
    p.row.style.setProperty('--pull', String(Math.min(1, p.pull / SWIPE_REPLY_PX)));
    if (p.pull >= SWIPE_REPLY_PX && !p.armed) {
      p.armed = true;
      haptic('tick');
    }
  };

  const pressEnd = (e: React.PointerEvent<HTMLElement>) => {
    const p = press;
    if (!p || p.pointerId !== e.pointerId) return;
    window.clearTimeout(p.timer);
    press = null;
    if (!p.swiping) {
      tapped(p, e);
      return;
    }
    swallowAt = Date.now();
    p.row.style.transition = 'transform 180ms ease-out';
    p.row.style.transform = '';
    p.row.style.setProperty('--pull', '0');
    if (p.pull >= SWIPE_REPLY_PX) now().onSwipeReply(p.id);
  };

  const pressContextMenu = (e: React.MouseEvent<HTMLElement>, id: string) => {
    e.preventDefault();
    if (now().menuOpen()) return;
    const p = press;
    if (p) {
      window.clearTimeout(p.timer);
      press = null;
    }
    swallowAt = Date.now();
    now().onLongPress(id, parts(e.currentTarget)?.bubble ?? e.currentTarget);
  };

  /** A finger down and up again in place: maybe the second of two. */
  const tapped = (p: { id: string; bubble: HTMLElement; row: HTMLElement }, e: React.PointerEvent<HTMLElement>) => {
    const at = Date.now();
    const first = lastTap;
    if (
      first &&
      first.id === p.id &&
      at - first.at < DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - first.x, e.clientY - first.y) < DOUBLE_TAP_PX &&
      now().onDoubleTap
    ) {
      lastTap = null;
      // The photo the first tap would have opened stays shut.
      if (waiting) window.clearTimeout(waiting.timer);
      waiting = null;
      // And the click this second tap makes does nothing else.
      swallowAt = at;
      heartPop(p.row, p.bubble);
      haptic('tick');
      now().onDoubleTap?.(p.id);
      return;
    }
    lastTap = { id: p.id, at, x: e.clientX, y: e.clientY };
  };

  const swallowClick = (e: React.MouseEvent<HTMLElement>) => {
    if (replaying) return;
    if (Date.now() - swallowAt <= SWALLOW_MS) {
      swallowAt = 0;
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    // A tap on a photo opens it a moment late, so two taps can be a heart
    // instead. Not a click from the keyboard (detail 0): that is never a
    // double tap, and never waits.
    if (!now().onDoubleTap || e.detail === 0) return;
    const wait = (e.target as HTMLElement).closest<HTMLElement>('[data-tap-wait]');
    if (!wait) return;
    e.stopPropagation();
    e.preventDefault();
    if (waiting) window.clearTimeout(waiting.timer);
    const timer = window.setTimeout(() => {
      waiting = null;
      replaying = true;
      try {
        wait.click();
      } finally {
        replaying = false;
      }
    }, DOUBLE_TAP_MS);
    waiting = { timer, target: wait };
  };

  return { pressStart, pressMove, pressEnd, pressContextMenu, swallowClick };
}

/**
 * The bubble and the line it sits on, from whichever the handlers are on:
 * the line moves when it is pulled, and the menu opens beside the bubble.
 */
function parts(el: HTMLElement): { bubble: HTMLElement; row: HTMLElement } | null {
  if (el.matches('[data-bubble]')) {
    const row = el.parentElement;
    return row ? { bubble: el, row } : null;
  }
  const bubble = el.querySelector<HTMLElement>('[data-bubble]');
  return bubble ? { bubble, row: el } : null;
}

/**
 * A heart that rises from the middle of the bubble and fades (index.css
 * .like-pop). Put straight onto the line rather than through a render, so
 * the conversation is not drawn again for it; it takes itself away.
 */
function heartPop(row: HTMLElement, bubble: HTMLElement): void {
  if (typeof document === 'undefined') return;
  const heart = document.createElement('span');
  heart.className = 'like-pop';
  heart.setAttribute('aria-hidden', 'true');
  heart.textContent = HEART;
  heart.style.left = `${bubble.offsetLeft + bubble.offsetWidth / 2}px`;
  heart.style.top = `${bubble.offsetTop + bubble.offsetHeight / 2}px`;
  row.appendChild(heart);
  const gone = () => heart.remove();
  heart.addEventListener('animationend', gone);
  window.setTimeout(gone, 1200);
}
