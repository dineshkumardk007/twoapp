// The phone's Back button, answered by the page.
//
// Back should do what it does in every other app: close the popup on top,
// then go back to Home, and only from Home leave the app. The page is the
// only one that knows what is open, so the Android app asks it first
// (window.__twoBack, from TwoWebView) and leaves only when told nothing was
// there to close.
//
// Anything that opens on top - a modal, a sheet, a full-screen overlay - is a
// layer: it registers while open (useBackLayer) and Back closes the newest
// one. With no layer open, the app's own fallback runs (setBackFallback):
// leave a group, go Home.

import { useEffect, useRef } from 'react';

interface Layer {
  close: () => void;
}

const layers: Layer[] = [];
let fallback: (() => boolean) | null = null;

function remove(layer: Layer) {
  const i = layers.lastIndexOf(layer);
  if (i !== -1) layers.splice(i, 1);
}

/** Registers something open on top. Returns how to take it off again. */
export function pushBackLayer(close: () => void): () => void {
  const layer: Layer = { close };
  layers.push(layer);
  return () => remove(layer);
}

/** While `open`, Back calls `close` (the newest open layer first). */
export function useBackLayer(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    return pushBackLayer(() => closeRef.current());
  }, [open]);
}

/**
 * What Back does when nothing is open on top: answers whether it did
 * anything (false at Home, so the app can go to the background).
 */
export function setBackFallback(fn: (() => boolean) | null) {
  fallback = fn;
}

/** One press of Back. True when the page handled it. */
export function handleBack(): boolean {
  const top = layers.pop();
  if (top) {
    try {
      top.close();
    } catch {
      /* a layer that failed to close is still gone from the stack */
    }
    return true;
  }
  try {
    return fallback ? fallback() : false;
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as { __twoBack?: () => boolean }).__twoBack = handleBack;
}
