/**
 * "Typing…": when this phone says it, and how long the other side keeps it.
 *
 * TYPING goes on the first key and again at most every TYPING_REPEAT_MS while
 * keys keep coming - the cadence every version has had, so a phone on the
 * version before lapses exactly when it always did. What is new is the end:
 * TYPING_STOP when the box is emptied, a few seconds pass with no key, the box
 * is left, or Two goes to the background or locks.
 *
 * Never at Send. The relay forwards a signal at once but a message only once
 * it is stored, so a stop sent with the message would always land first, and
 * the dots would vanish a moment before her words took their place. The
 * message itself is the end: the phone it lands on clears "typing…" in the
 * same update that puts it on screen (typingEndedBy).
 */
import { useEffect, useRef } from 'react';
import { BEFORE_LOCK_EVENT } from './autoLock';
import { TYPING_REPEAT_MS, TYPING_TTL_MS } from './lastSeen';
import { onShownChange } from './shown';

/** "Stopped writing". A phone on the version before ignores a signal it does not know. */
export const TYPING_STOP_SIGNAL = 'TYPING_STOP';

/** No key for this long: stopped, words in the box or not. */
export const TYPING_IDLE_MS = 4_000;

/** A blur this short is a tap on a button beside the box, not leaving it. */
export const TYPING_BLUR_GRACE_MS = 400;

/**
 * From a phone that says when it stops, the lapse is only a safety net. It is
 * longer than the widest gap between two TYPINGs from somebody still writing
 * (a repeat, then a pause just short of idle), so it never flickers off.
 */
export const TYPING_TTL_WITH_STOPS_MS = TYPING_REPEAT_MS + TYPING_IDLE_MS + 1_000;

/** How long a TYPING holds here, by what it said: a phone on the version before says nothing of stops. */
export function typingTtlFor(said: unknown): number {
  return (said as { stops?: unknown } | null)?.stops === true ? TYPING_TTL_WITH_STOPS_MS : TYPING_TTL_MS;
}

/**
 * Whether a message of hers ends the "typing…" she last said.
 *
 * Both times are by her clock - the TYPING's `at` and the message's own - so
 * however wrong one phone's clock is against the other's, it cannot matter.
 * A TYPING stamped after the message means she has started the next one.
 * Either time unknown (a group member on the version before sends no `at`):
 * the message ends it.
 */
export function typingEndedBy(saidAt: number, messageAt: number): boolean {
  return !saidAt || !messageAt || saidAt <= messageAt;
}

/** Who is typing in a group right now: those whose last TYPING has not lapsed. */
export function typingNow(members: Record<string, { until: number }> | undefined, now: number): string[] {
  return Object.entries(members || {})
    .filter(([, t]) => t.until > now)
    .map(([id]) => id);
}

/** Time and timers, handed in so the tests can drive them. */
export interface TypingClock {
  now(): number;
  later(fn: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
}

// performance.now, not Date.now: a clock set back while writing (or the test
// rig moving Date) must not hold the next TYPING back for hours.
const realClock: TypingClock = {
  now: () => performance.now(),
  later: (fn, ms) => setTimeout(fn, ms),
  cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>)
};

export interface TypingSender {
  /** A key, or an emoji picked: something is being written. */
  keystroke(): void;
  /** Stopped: the box emptied, an edit begun, the chat left. Says so if it had said typing. */
  stop(): void;
  /** The message went. Says nothing: her phone takes the message itself as the end. */
  sent(): void;
  /** The box lost focus: stopped, unless a key comes back within the grace. */
  stopSoon(): void;
}

/** `say(true)` is a TYPING to send, `say(false)` a TYPING_STOP. */
export function createTypingSender(say: (typing: boolean) => void, clock: TypingClock = realClock): TypingSender {
  let typing = false;
  let saidAt = 0;
  let idle: unknown = null;
  let soon: unknown = null;
  const cancel = () => {
    if (idle !== null) clock.cancel(idle);
    if (soon !== null) clock.cancel(soon);
    idle = soon = null;
  };
  const end = (aloud: boolean) => {
    const was = typing;
    typing = false;
    saidAt = 0;
    cancel();
    if (was && aloud) say(false);
  };
  return {
    keystroke() {
      const now = clock.now();
      if (soon !== null) {
        clock.cancel(soon);
        soon = null;
      }
      if (idle !== null) clock.cancel(idle);
      idle = clock.later(() => {
        idle = null;
        end(true);
      }, TYPING_IDLE_MS);
      if (typing && now - saidAt < TYPING_REPEAT_MS) return;
      typing = true;
      saidAt = now;
      say(true);
    },
    stop: () => end(true),
    sent: () => end(false),
    stopSoon() {
      if (!typing || soon !== null) return;
      soon = clock.later(() => {
        soon = null;
        end(true);
      }, TYPING_BLUR_GRACE_MS);
    }
  };
}

/**
 * The sender for one chat screen. Stops by itself when Two goes to the
 * background or the phone's screen goes off (core/shown.ts), the page goes,
 * Two locks, or the screen closes.
 */
export function useTypingSender(onTyping?: (typing: boolean) => void): TypingSender {
  const callback = useRef(onTyping);
  callback.current = onTyping;
  const ref = useRef<TypingSender | null>(null);
  if (!ref.current) ref.current = createTypingSender(typing => callback.current?.(typing));
  useEffect(() => {
    const sender = ref.current!;
    const offShown = onShownChange(shown => {
      if (!shown) sender.stop();
    });
    const gone = () => sender.stop();
    window.addEventListener('pagehide', gone);
    window.addEventListener(BEFORE_LOCK_EVENT, gone);
    return () => {
      offShown();
      window.removeEventListener('pagehide', gone);
      window.removeEventListener(BEFORE_LOCK_EVENT, gone);
      sender.stop();
    };
  }, []);
  return ref.current;
}
