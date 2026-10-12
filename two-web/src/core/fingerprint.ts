// Opening Two with a fingerprint instead of typing the PIN.
//
// The phone does the real work (FingerprintLock on Android): it keeps one copy
// of the PIN in its keystore, readable only after a fingerprint the phone has
// just checked, and hands it back here to open the vault exactly as a typed PIN
// would. The vault itself does not change - the PIN is still the only key, the
// fingerprint just types it for you.
//
// Only the app has a fingerprint sensor to ask; on the website this reports
// 'unavailable' and nothing offers it.

/**
 * - unavailable: no sensor, or not one Android counts as secure
 * - not-enrolled: a sensor, but no fingerprint saved on the phone
 * - off / on: for this phone
 * - changed: a fingerprint was added to the phone, so it switched itself off
 */
export type FingerprintStatus = 'unavailable' | 'not-enrolled' | 'off' | 'on' | 'changed';

/** Why a prompt did not end in a fingerprint. */
export type FingerprintFailure = 'cancel' | 'lockout' | 'changed' | 'unavailable' | 'off' | 'error';

export type FingerprintResult = { ok: true; pin?: string } | { ok: false; reason: FingerprintFailure };

interface FingerprintBridge {
  fingerprintStatus?: () => string;
  fingerprintEnable?: (id: string, pin: string) => void;
  fingerprintUnlock?: (id: string) => void;
  fingerprintDisable?: () => void;
}

type Reply = { id: string; ok: boolean; pin?: string; reason?: string };

const STATUSES: FingerprintStatus[] = ['unavailable', 'not-enrolled', 'off', 'on', 'changed'];
const FAILURES: FingerprintFailure[] = ['cancel', 'lockout', 'changed', 'unavailable', 'off', 'error'];

function bridge(): FingerprintBridge | null {
  try {
    return (window as unknown as { AndroidBridge?: FingerprintBridge }).AndroidBridge ?? null;
  } catch {
    return null;
  }
}

export function fingerprintStatus(): FingerprintStatus {
  try {
    const raw = bridge()?.fingerprintStatus?.();
    return STATUSES.includes(raw as FingerprintStatus) ? (raw as FingerprintStatus) : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

// One prompt at a time: asking again while one waits answers the first as
// cancelled, so nothing is left waiting forever.
let waiting: { id: string; resolve: (r: FingerprintResult) => void } | null = null;
let counter = 0;

function listen() {
  (window as unknown as { __twoFingerprint?: (reply: Reply) => void }).__twoFingerprint = reply => {
    if (!waiting || !reply || reply.id !== waiting.id) return;
    const { resolve } = waiting;
    waiting = null;
    if (reply.ok) {
      resolve({ ok: true, pin: typeof reply.pin === 'string' ? reply.pin : undefined });
    } else {
      const reason = FAILURES.includes(reply.reason as FingerprintFailure)
        ? (reply.reason as FingerprintFailure)
        : 'error';
      resolve({ ok: false, reason });
    }
  };
}

function ask(start: (b: FingerprintBridge, id: string) => boolean): Promise<FingerprintResult> {
  const b = bridge();
  if (!b) return Promise.resolve({ ok: false, reason: 'unavailable' });
  listen();
  waiting?.resolve({ ok: false, reason: 'cancel' });
  counter += 1;
  const id = `fp${Date.now().toString(36)}${counter}`;
  return new Promise(resolve => {
    waiting = { id, resolve };
    let started = false;
    try {
      started = start(b, id);
    } catch {
      started = false;
    }
    if (!started && waiting?.id === id) {
      waiting = null;
      resolve({ ok: false, reason: 'unavailable' });
    }
  });
}

/** One touch, then the phone keeps [pin] for next time. Check the PIN first. */
export function enableFingerprint(pin: string): Promise<FingerprintResult> {
  return ask((b, id) => {
    if (!b.fingerprintEnable) return false;
    b.fingerprintEnable(id, pin);
    return true;
  });
}

/** Asks for a fingerprint; on success the result carries the PIN. */
export function unlockWithFingerprint(): Promise<FingerprintResult> {
  return ask((b, id) => {
    if (!b.fingerprintUnlock) return false;
    b.fingerprintUnlock(id);
    return true;
  });
}

/** Forgets the PIN the phone kept. Safe to call when it was never on. */
export function disableFingerprint() {
  try {
    bridge()?.fingerprintDisable?.();
  } catch {
    /* an older app has nothing to forget */
  }
}
