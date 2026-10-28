import React, { useEffect, useRef, useState } from 'react';
import { FADE_AFTER_MS, firstBelow } from '../core/floatingDay';

/** A touch, a wheel or a key this recently, and the scroll that follows is yours. */
const INPUT_MS = 1000;
/** A fling goes on after the finger lifts: a scroll this soon after one of yours is still yours. */
const MOMENTUM_MS = 250;
/** The day's own line this close to the top says the day already. */
const LINE_ROOM_PX = 36;
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

export interface FloatingDay {
  label: string;
  shown: boolean;
  /** Called from the log's own onScroll. */
  onScroll: () => void;
  /** Spread on the log: how a scroll of yours is told from one the chat made. */
  inputHandlers: {
    onTouchMove: () => void;
    onWheel: () => void;
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  };
}

/**
 * The day at the top of a chat's log, while you scroll it: "Today",
 * "Yesterday", "12 Oct". Read from the `data-day` of the first message still
 * in view; a `data-divider` line at the top hides it, as that says it already.
 *
 * Only for your own scrolling. The chat scrolls itself all the time - to a
 * new message, through the keyboard opening, to a quote's message - and a
 * date flashing up each time would be noise. A scroll counts as yours just
 * after a touch, a wheel or a key on the log. The label is set only when it
 * changes, so scrolling within a day draws nothing again.
 */
export function useFloatingDay(logRef: React.RefObject<HTMLElement | null>): FloatingDay {
  const [chip, setChipState] = useState({ label: '', shown: false });
  const chipRef = useRef(chip);
  const setChip = (next: { label: string; shown: boolean }) => {
    if (next.label === chipRef.current.label && next.shown === chipRef.current.shown) return;
    chipRef.current = next;
    setChipState(next);
  };
  const yoursUntilRef = useRef(0);
  const frameRef = useRef(0);
  const timerRef = useRef(0);

  const measure = () => {
    const log = logRef.current;
    if (!log) return;
    const top = log.getBoundingClientRect().top;
    const days = log.querySelectorAll<HTMLElement>('[data-day]');
    const i = firstBelow(days.length, k => days[k].getBoundingClientRect().bottom, top + 4);
    const label = i < days.length ? days[i].dataset.day || '' : '';
    const lines = log.querySelectorAll<HTMLElement>('[data-divider]');
    const j = firstBelow(lines.length, k => lines[k].getBoundingClientRect().bottom, top);
    const lineAtTop = j < lines.length && lines[j].getBoundingClientRect().top < top + LINE_ROOM_PX;
    setChip({ label: label || chipRef.current.label, shown: !!label && !lineAtTop });
  };
  const measureRef = useRef(measure);
  measureRef.current = measure;

  const [handlers] = useState(() => {
    const yours = () => {
      yoursUntilRef.current = Date.now() + INPUT_MS;
    };
    return {
      onTouchMove: yours,
      onWheel: yours,
      // On the log itself, not a message: its scrollbar, dragged.
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.target === e.currentTarget) yours();
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        if (SCROLL_KEYS.has(e.key)) yours();
      }
    };
  });

  const onScroll = () => {
    const now = Date.now();
    if (now > yoursUntilRef.current) return;
    yoursUntilRef.current = Math.max(yoursUntilRef.current, now + MOMENTUM_MS);
    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        measureRef.current();
      });
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setChip({ ...chipRef.current, shown: false }), FADE_AFTER_MS);
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      window.clearTimeout(timerRef.current);
    },
    []
  );

  return { label: chip.label, shown: chip.shown, onScroll, inputHandlers: handlers };
}

/**
 * The floating day, held at the top of the log with no height of its own, so
 * it never moves the conversation. Goes inside the scrolling log, first.
 * Hidden from screen readers: each day's own line says it in its place.
 */
export const FloatingDayChip: React.FC<{ label: string; shown: boolean }> = ({ label, shown }) =>
  label ? (
    <div aria-hidden="true" data-floating-day className="pointer-events-none sticky top-0 z-[3] flex h-0 justify-center">
      <span
        className={`mt-1 rounded-full border border-linen-border bg-linen-surface surface-solid px-3 py-0.5 text-[11px] font-medium text-linen-secondary shadow-sm transition-opacity duration-300 motion-reduce:transition-none ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {label}
      </span>
    </div>
  ) : null;
