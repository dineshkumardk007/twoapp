// Whether Two is really in front of someone right now: the page visible, and
// the Android app (when there is one) not saying it has gone to the background
// or the screen has gone off.
//
// "Online", read receipts, typing and the unread count all used to follow the
// page's own visibility alone. A WebView does not always change that - a phone
// that only pauses the app when the screen goes off kept her online in her
// pocket, ticked his messages blue and counted the chat as read. The Android
// app now tells the page itself (window.__twoLifecycle 'away' / 'here', from
// TwoWebView.kt), and everything that cares asks here instead of the document.
//
// Auto-lock still reads the document on its own (core/autoLock.ts): the
// microphone prompt, the file picker and the camera would lock it otherwise.
//
// No React here - core/ws.ts uses it too.

export type ShownListener = (shown: boolean) => void;

/**
 * The rule on its own, for the tests: `visible` is the page's own visibility,
 * `toldAwayAtStart` what the Android app said before this page loaded.
 */
export function createShown(visible: () => boolean, toldAwayAtStart = false) {
  let toldAway = toldAwayAtStart;
  const isShown = () => visible() && !toldAway;
  let last = isShown();
  const listeners = new Set<ShownListener>();

  // Listeners hear each real change once, not every event that might be one.
  const check = () => {
    const now = isShown();
    if (now === last) return;
    last = now;
    listeners.forEach((listener) => {
      try {
        listener(now);
      } catch {
        // One listener going wrong must not stop the rest hearing it.
      }
    });
  };

  return {
    isShown,
    subscribe(listener: ShownListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** From the Android app. Anything but 'away' or 'here' is ignored. */
    tell(state: unknown) {
      if (state === 'away') toldAway = true;
      else if (state === 'here') toldAway = false;
      else return;
      check();
    },
    /**
     * The page's own visibility changed. Coming into view clears an away the
     * app said earlier: the WebView only becomes visible as the app starts,
     * so a 'here' that went missing does not leave her looking away.
     */
    visibilityChanged() {
      if (visible()) toldAway = false;
      check();
    },
    /** A touch or a key on the page: nobody does that to a phone in a pocket. */
    touched() {
      if (!toldAway || !visible()) return;
      toldAway = false;
      check();
    }
  };
}

const pageVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

// A page that loads while Two is away - auto-lock's reload, the app being
// rebuilt in the background - asks the app once, since nobody will tell it
// until the next change. An older app has no lifecycleState and reads as here.
function awayAtLoad(): boolean {
  try {
    const bridge = (window as unknown as { AndroidBridge?: { lifecycleState?: () => string } }).AndroidBridge;
    return bridge?.lifecycleState?.() === 'away';
  } catch {
    return false;
  }
}

const shown = createShown(pageVisible, typeof window !== 'undefined' && awayAtLoad());

// Set up when this module loads, before any screen subscribes, so a listener
// that hears a change can trust isShown() to say the same.
if (typeof window !== 'undefined') {
  (window as unknown as { __twoLifecycle?: (state: unknown) => void }).__twoLifecycle = (state) => shown.tell(state);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => shown.visibilityChanged());
  }
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pointerdown', () => shown.touched(), { capture: true, passive: true });
    window.addEventListener('keydown', () => shown.touched(), true);
  }
}

/** True while Two is in front of someone: visible, and the Android app has not said away. */
export const isShown = shown.isShown;

/** Hears every change of isShown(); returns the function that stops it. */
export const onShownChange = shown.subscribe;
