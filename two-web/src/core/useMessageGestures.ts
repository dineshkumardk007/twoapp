// A finger on a message, in the couple's chat and in a group's. Held still,
// it opens the message's menu; drawn to the right, it answers the message.

import { useRef, useState } from 'react';
import type React from 'react';
import { haptic } from './haptics';

/** A press held this long without moving opens the message's menu. */
export const LONG_PRESS_MS = 420;
/** A click this soon after a long press or a drag ended belongs to it, not to what is under the finger. */
export const SWALLOW_MS = 800;
/** Dragged this far to the right, a message is answered when let go. */
export const SWIPE_REPLY_PX = 56;

interface GestureOptions {
  /** Held still: the message's menu, beside its bubble. */
  onLongPress: (id: string, bubble: HTMLElement) => void;
  /** Drawn far enough to the right and let go: answer it. */
  onSwipeReply: (id: string) => void;
  /** A menu is open already, so a right click does not open a second. */
  menuOpen: () => boolean;
}

export interface MessageGestures {
  pressStart: (e: React.PointerEvent<HTMLElement>, id: string) => void;
  pressMove: (e: React.PointerEvent<HTMLElement>) => void;
  pressEnd: (e: React.PointerEvent<HTMLElement>) => void;
  /** A right click, or a phone's own long press: the same menu. */
  pressContextMenu: (e: React.MouseEvent<HTMLElement>, id: string) => void;
  /** For the bubble's onClickCapture: eats the click that ends a long press or a drag. */
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

  const pressStart = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[role="slider"]')) return;
    const bubble = e.currentTarget;
    const row = bubble.parentElement;
    if (!row) return;
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
      try {
        p.bubble.setPointerCapture(e.pointerId);
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
    if (!p.swiping) return;
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
    now().onLongPress(id, e.currentTarget);
  };

  const swallowClick = (e: React.MouseEvent<HTMLElement>) => {
    if (Date.now() - swallowAt > SWALLOW_MS) return;
    swallowAt = 0;
    e.stopPropagation();
    e.preventDefault();
  };

  return { pressStart, pressMove, pressEnd, pressContextMenu, swallowClick };
}
