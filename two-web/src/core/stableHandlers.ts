import { useInsertionEffect, useRef } from 'react';

type Handler = (...args: any[]) => any;

/**
 * What a screen is handed to press, under one name, kept the same function
 * from one render to the next.
 *
 * App makes its handlers afresh on every render, and it renders on every
 * record, every "here" from her phone and every few seconds while she types.
 * A screen that is only drawn again when what it shows changes (React.memo)
 * was drawn again anyway, because a new function is a new prop - the whole
 * chat redrawn while she typed, with your tap waiting behind it.
 *
 * Each name keeps one function, which calls whatever was last given under
 * that name. Taken up once the render is on screen (commit), not while it is
 * being worked out: a tab still loading is a render not yet shown, and a tap
 * meanwhile must act on the screen you are looking at - as the handler on
 * that screen always did.
 */
export interface StableHandlers {
  /** Called as a render begins: what it gives replaces what the last one gave. */
  begin(): void;
  /** The one function for `name`; it calls `fn` once this render is on screen. */
  stable<F extends Handler>(name: string, fn: F): F;
  /** The render is on screen: its handlers are the ones called from now on. */
  commit(): void;
}

export function stableHandlers(): StableHandlers {
  const shown = new Map<string, Handler>();
  let given = new Map<string, Handler>();
  const handedOut = new Map<string, Handler>();
  return {
    begin() {
      given = new Map();
    },
    stable<F extends Handler>(name: string, fn: F): F {
      given.set(name, fn);
      let out = handedOut.get(name);
      if (!out) {
        // Only ever pressed once on screen, by when `shown` has it; the
        // second look is for a name no render has yet been committed with.
        out = (...args: any[]) => (shown.get(name) ?? given.get(name))?.(...args);
        handedOut.set(name, out);
      }
      return out as F;
    },
    commit() {
      for (const [name, fn] of given) shown.set(name, fn);
    }
  };
}

/**
 * `next`, or `prev` when it holds the same values, one level deep - so a
 * list or a count worked out afresh each render is no change to a screen
 * drawn only when what it is handed changes.
 */
export function sameOr<T extends readonly unknown[] | Record<string, unknown>>(prev: T, next: T): T {
  if (prev === next) return prev;
  if (Array.isArray(prev) !== Array.isArray(next)) return next;
  const a = Object.keys(prev);
  const b = Object.keys(next);
  if (a.length !== b.length) return next;
  for (const key of b) {
    if (!Object.prototype.hasOwnProperty.call(prev, key)) return next;
    if (!Object.is((prev as Record<string, unknown>)[key], (next as Record<string, unknown>)[key])) return next;
  }
  return prev;
}

/**
 * stableHandlers for one component. Not a hook per handler: App returns
 * early for the lock screen, the calculator and a group, and its handlers
 * are written inline below those returns, where hooks cannot be.
 */
export function useStableHandlers(): StableHandlers['stable'] {
  const ref = useRef<StableHandlers | null>(null);
  if (!ref.current) ref.current = stableHandlers();
  const handlers = ref.current;
  handlers.begin();
  // Before any layout effect below it runs, so a screen's own effects
  // already reach this render's handlers, as they reached its props.
  useInsertionEffect(() => handlers.commit());
  return handlers.stable;
}
