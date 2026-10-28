// The keyboard up for a box the page focused by itself.
//
// Answering a message by pulling it to the right focuses the composer, but a
// pull is not a tap, and Android brings its keyboard up only for a focus a
// tap caused: the box had the caret and no keys came. In the app Android
// itself is asked to show them (AndroidBridge.showKeyboard); in a browser,
// or an app from before it could, the focus is all there is.

interface KeyboardBridge {
  showKeyboard?: () => void;
}

function bridge(): KeyboardBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { AndroidBridge?: KeyboardBridge }).AndroidBridge ?? null;
}

/** Focuses the box and brings the keyboard up for it, where the phone allows. */
export function focusForTyping(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.focus();
  const native = bridge();
  if (native && typeof native.showKeyboard === 'function') {
    try {
      native.showKeyboard();
    } catch {
      /* the focus alone, then */
    }
  }
}
