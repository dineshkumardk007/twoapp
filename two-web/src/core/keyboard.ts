// Telling the page the keyboard is up (index.css, under `html.dock-yields`).
//
// In the app the WebView is made shorter for the keyboard, so the page ends at
// the top of the keys. Nothing says "keyboard": the page only sees itself get
// shorter. Focus is not enough on its own. The Back gesture closes the
// keyboard and leaves the box focused, and a tap on the still-focused box
// opens it again with no focus event at all. So it is read from the height,
// against the tallest the screen has been with no keyboard: shorter while
// something is being typed into is the keyboard; shorter with nothing to type
// into is the system bars or the window, and becomes the new full height.
//
// What is published is the full height, as --two-full-h, and nothing per
// frame. CSS takes the keyboard's height as that minus 100dvh, which follows
// the WebView as it is resized, so the dock and the composer move with the
// keys and never behind them.

/** Less than this is the system bars or a window edge, never a keyboard. */
export const KEYBOARD_MIN_PX = 120;

/** The screen as last seen: its width, its height with no keyboard, and its height now. */
export interface ScreenFrame {
  width: number;
  full: number;
  last: number;
}

/**
 * One resize.
 *
 * A new width (rotation, split screen) starts over, and so does reaching the
 * full height again - which is the keyboard closing, focus kept or not.
 * Shorter while typing is the keyboard. Shorter with nothing to type into is
 * the new full height. Taller is a keyboard going away, even once the box has
 * let go of focus (the conversation tapped), so the full height is kept until
 * it is reached.
 */
export function nextFrame(
  prev: ScreenFrame | null,
  width: number,
  height: number,
  typing: boolean
): ScreenFrame {
  if (!prev || width !== prev.width || height >= prev.full) {
    return { width, full: height, last: height };
  }
  if (height < prev.last && !typing) return { width, full: height, last: height };
  return { ...prev, last: height };
}

/** After the box lets go, this long with the height still, for a closing keyboard to give it back. */
export const BLUR_SETTLE_MS = 400;

/**
 * BLUR_SETTLE_MS after the box let go of focus, with nothing typed into since.
 *
 * Still short by then is not a keyboard: it is the screen made shorter while
 * the box had focus - split screen top and bottom keeps the width and halves
 * the height, which looked like a keyboard and hid the dock with no keys
 * there. So the height now is the new full height. A keyboard slower than
 * that to close only makes it too short for a moment: reaching the taller
 * height starts over (nextFrame).
 */
export function settleFrame(frame: ScreenFrame, typing: boolean): ScreenFrame {
  if (typing || frame.last >= frame.full) return frame;
  return { ...frame, full: frame.last };
}

/**
 * Whether the keyboard now covers the whole dock. Only then is the dock taken
 * from touch and TalkBack, so it never vanishes while a part of it still shows.
 */
export function coversDock(frame: ScreenFrame, dockPx: number): boolean {
  return frame.full - frame.last >= Math.max(KEYBOARD_MIN_PX, dockPx);
}

// The kinds of box a keyboard comes up for. A checkbox or a button does not
// bring one up, and neither does a box that cannot be written in.
const TYPED_INTO =
  'textarea, [contenteditable=""], [contenteditable="true"], input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=reset]):not([type=file]):not([type=color])';

function typing(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.matches(TYPED_INTO) && !(el as HTMLInputElement).readOnly;
}

/**
 * Publishes --two-full-h (the height with no keyboard) and html.kb-up (the
 * keyboard covers the whole dock). Runs for the life of the page; the cleanup
 * is for tests.
 */
export function watchKeyboard(): () => void {
  const root = document.documentElement;
  let frame: ScreenFrame | null = null;
  let written = '';
  let up = false;
  let settle: ReturnType<typeof setTimeout> | undefined;

  const look = (settled = false) => {
    frame = nextFrame(frame, window.innerWidth, window.innerHeight, typing());
    if (settled) frame = settleFrame(frame, typing());
    // Written only when it changes: a property on <html> restyles everything
    // that reads it, and this runs on every frame of the keyboard's slide.
    const full = `${frame.full}px`;
    if (full !== written) {
      written = full;
      root.style.setProperty('--two-full-h', full);
    }
    const dock = parseFloat(root.style.getPropertyValue('--two-dock-h')) || 0;
    const nowUp = coversDock(frame, dock);
    if (nowUp !== up) {
      up = nowUp;
      root.classList.toggle('kb-up', up);
    }
  };

  // A settle still waiting starts over while the height moves: a keyboard
  // still sliding away is not yet the screen at rest, and settling half way
  // took a part-closed keyboard for the full height and jumped the chat.
  let settlePending = false;
  const settleSoon = () => {
    clearTimeout(settle);
    settlePending = true;
    settle = setTimeout(() => {
      settlePending = false;
      look(true);
    }, BLUR_SETTLE_MS);
  };
  const resized = () => {
    look();
    if (settlePending) settleSoon();
  };
  // Focus coming and going changes what a shorter screen means, with no
  // resize to say so; and once the box has let go, a screen still short a
  // moment later is the window, not keys (settleFrame).
  const focusIn = () => {
    // Only a box to type into calls the settle off. A tapped button takes
    // focus too, and calling it off then left a split screen looking like a
    // keyboard, the dock hidden with no keys there. settleFrame looks at focus
    // again when the time is up, so a box focused later is still safe.
    if (typing()) {
      clearTimeout(settle);
      settlePending = false;
    }
    look();
  };
  const focusOut = () => {
    look();
    settleSoon();
  };

  look();
  window.addEventListener('resize', resized);
  window.visualViewport?.addEventListener('resize', resized);
  document.addEventListener('focusin', focusIn);
  document.addEventListener('focusout', focusOut);
  return () => {
    clearTimeout(settle);
    window.removeEventListener('resize', resized);
    window.visualViewport?.removeEventListener('resize', resized);
    document.removeEventListener('focusin', focusIn);
    document.removeEventListener('focusout', focusOut);
    root.style.removeProperty('--two-full-h');
    root.classList.remove('kb-up');
  };
}
