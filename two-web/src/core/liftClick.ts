// A key that acts as the finger lands (the calculator's =) can take its own
// screen away before the finger lifts. The phone still sends a click when it
// lifts, and that click goes to whatever is under the finger by then - for the
// calculator's =, the dock's "All", which sits in the same corner. Two opened
// with every destination spread over it, every time.

/**
 * Catches the one click that the finger now down will make when it lifts, so
 * it reaches nothing. Gone again as soon as that click has come, a moment
 * after the finger lifts if no click comes (a finger that slid away makes
 * none), and in any case after a few seconds - so no later tap is ever lost.
 */
export function swallowLiftClick(win: Window = window) {
  let soon: ReturnType<typeof setTimeout> | null = null;
  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    done();
  };
  const lifted = () => {
    if (soon) clearTimeout(soon);
    soon = setTimeout(done, 400);
  };
  const done = () => {
    win.removeEventListener('click', swallow, true);
    win.removeEventListener('pointerup', lifted, true);
    win.removeEventListener('pointercancel', lifted, true);
    win.removeEventListener('touchend', lifted, true);
    if (soon) clearTimeout(soon);
    clearTimeout(cap);
  };
  const cap = setTimeout(done, 3000);
  win.addEventListener('click', swallow, true);
  win.addEventListener('pointerup', lifted, true);
  win.addEventListener('pointercancel', lifted, true);
  win.addEventListener('touchend', lifted, true);
  return done;
}
