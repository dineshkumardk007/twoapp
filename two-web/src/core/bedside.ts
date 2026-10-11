// Bedside: the Nightstand as a clock left on all night.
//
// A phone turns its screen off after a minute or so - right for a phone,
// wrong for a bedside clock, which is why the Nightstand's old fullscreen
// button never made it one (and in the app that button did nothing at all: a
// WebView has no fullscreen of its own).
//
// In the app, Android does it: keeps the screen on, hides the status and
// navigation bars, and turns the screen's own brightness down - further than
// any dark colour on the page can go. On the website the browser's wake lock
// keeps the screen on where it is offered, and fullscreen hides the rest.

export type BedsideGlow = 'ultra' | 'dim' | 'glow';

/**
 * The screen's own brightness for each glow, 0..1, in the app.
 *
 * The lowest is the panel's minimum in all but name: in a dark room it is
 * readable and lights nothing else.
 */
const SCREEN_BRIGHTNESS: Record<BedsideGlow, number> = {
  ultra: 0.01,
  dim: 0.06,
  glow: 0.2
};

interface BedsideBridge {
  setBedside?: (on: boolean, brightness: number) => void;
}

function nativeBedside(): BedsideBridge['setBedside'] | null {
  try {
    const bridge = (window as unknown as { AndroidBridge?: BedsideBridge }).AndroidBridge;
    return bridge && typeof bridge.setBedside === 'function' ? bridge.setBedside.bind(bridge) : null;
  } catch {
    return null;
  }
}

interface WakeLockLike {
  release(): Promise<void>;
}

let active = false;
let wakeLock: WakeLockLike | null = null;
const leftListeners = new Set<() => void>();

/**
 * Calls back whenever bedside ends - from the screen's own button or from
 * elsewhere, such as a call coming in. Returns a way to stop listening.
 */
export function onBedsideLeft(listener: () => void): () => void {
  leftListeners.add(listener);
  return () => {
    leftListeners.delete(listener);
  };
}

async function holdScreenOn() {
  try {
    const nav = navigator as unknown as { wakeLock?: { request(type: 'screen'): Promise<WakeLockLike> } };
    if (!nav.wakeLock || wakeLock) return;
    const lock = await nav.wakeLock.request('screen');
    if (active) wakeLock = lock;
    else void lock.release().catch(() => {});
  } catch {
    /* refused, or not offered here: the screen sleeps as it normally would */
  }
}

// A browser drops the wake lock whenever the page is hidden; it is asked for
// again on the way back.
function onVisibility() {
  if (!active) return;
  if (document.visibilityState === 'visible') void holdScreenOn();
  else wakeLock = null;
}

/** Whether bedside is on. */
export function inBedside(): boolean {
  return active;
}

export function enterBedside(glow: BedsideGlow) {
  active = true;
  const native = nativeBedside();
  if (native) {
    try {
      native(true, SCREEN_BRIGHTNESS[glow]);
      return;
    } catch {
      /* an older app: fall back to what the page can do */
    }
  }
  document.addEventListener('visibilitychange', onVisibility);
  void holdScreenOn();
  try {
    const request = document.documentElement.requestFullscreen?.();
    request?.catch(() => {});
  } catch {
    /* no fullscreen here */
  }
}

/** A different glow while bedside is on - the screen's brightness follows. */
export function setBedsideGlow(glow: BedsideGlow) {
  if (!active) return;
  try {
    nativeBedside()?.(true, SCREEN_BRIGHTNESS[glow]);
  } catch {
    /* as above */
  }
}

export function leaveBedside() {
  if (!active) return;
  active = false;
  try {
    nativeBedside()?.(false, -1);
  } catch {
    /* as above */
  }
  document.removeEventListener('visibilitychange', onVisibility);
  const lock = wakeLock;
  wakeLock = null;
  if (lock) void lock.release().catch(() => {});
  try {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
  } catch {
    /* nothing to leave */
  }
  for (const listener of [...leftListeners]) {
    try {
      listener();
    } catch {
      /* a listener's problem, not bedside's */
    }
  }
}
