// When an unlocked app should shut itself again.
//
// A PIN protects a closed app. Left on a table unlocked, Two stayed unlocked
// for as long as the screen was on and for as long after as the app lived -
// so the PIN only ever guarded the case where somebody found the phone
// switched off, which is the least likely one.

const SETTING_KEY = 'two_autolock_v1';

/** Off, or the seconds in the background after which the app locks. */
export type AutoLockSetting = 'off' | 0 | 60 | 300;

export const AUTO_LOCK_CHOICES: { value: AutoLockSetting; label: string }[] = [
  { value: 'off', label: 'Never' },
  { value: 0, label: 'Immediately' },
  { value: 60, label: 'After 1 minute' },
  { value: 300, label: 'After 5 minutes' }
];

/**
 * A minute by default.
 *
 * Locking the instant you switch away sounds safer and is worse to live with:
 * glancing at a notification, copying a code, answering a call - each one
 * would cost a PIN. A minute covers the glance and not the walk away.
 */
const DEFAULT: AutoLockSetting = 60;

export function readAutoLock(): AutoLockSetting {
  try {
    const raw = localStorage.getItem(SETTING_KEY);
    if (raw === 'off') return 'off';
    if (raw === '0') return 0;
    if (raw === '60') return 60;
    if (raw === '300') return 300;
    return DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function writeAutoLock(value: AutoLockSetting) {
  try {
    localStorage.setItem(SETTING_KEY, String(value));
  } catch {
    /* private mode - this run keeps the value it was given */
  }
}

/**
 * Locks the app by reloading it.
 *
 * Blunt on purpose. The alternative - clearing the decrypted state in place -
 * means setting state and key to nothing while the effect that persists the
 * vault is still watching both, and an empty state written over a real vault
 * is not a bug worth risking to save a reload. Coming back through the front
 * door guarantees that what is in memory is what an unopened app has: nothing.
 *
 * Everything is already saved: the vault is written on every state change, so
 * there is nothing in flight at the moment this runs.
 */
export function lockNow() {
  window.location.reload();
}

interface WatchOptions {
  /** False while there is no vault to lock, or the app is already locked. */
  enabled: () => boolean;
  getSetting: () => AutoLockSetting;
  onLock: () => void;
}

/**
 * Starts watching for the app leaving the foreground.
 *
 * Two paths, because a phone will freeze timers in a backgrounded WebView and
 * the scheduled one may simply never run:
 *
 *   - a timer, which locks while still hidden, so returning shows the lock
 *     screen already in place rather than a flash of the conversation;
 *   - a check on the way back in, comparing wall clock against when we left,
 *     which catches the case where the timer was frozen.
 */
export function watchForAbsence({ enabled, getSetting, onLock }: WatchOptions): () => void {
  let hiddenAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const onHidden = () => {
    if (!enabled()) return;
    const setting = getSetting();
    if (setting === 'off') return;

    hiddenAt = Date.now();
    cancel();
    timer = setTimeout(() => {
      timer = null;
      if (document.visibilityState === 'hidden' && enabled()) onLock();
    }, setting * 1000);
  };

  const onVisible = () => {
    cancel();
    if (!hiddenAt || !enabled()) {
      hiddenAt = 0;
      return;
    }
    const setting = getSetting();
    const away = (Date.now() - hiddenAt) / 1000;
    hiddenAt = 0;
    if (setting !== 'off' && away >= setting) onLock();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') onHidden();
    else onVisible();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  // Some Android WebViews report a pagehide without a visibilitychange.
  window.addEventListener('pagehide', onHidden);

  return () => {
    cancel();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onHidden);
  };
}
