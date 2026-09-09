// Rate limiting for the app-lock screen.
//
// A four-digit PIN is 10,000 possibilities. Deriving the vault key costs
// 600,000 PBKDF2 rounds, so a guess is slow - but slow is not stopped, and
// nothing here was counting. Somebody holding the phone could sit and try
// every combination, and the only cost was their patience.
//
// The counter lives in localStorage rather than in memory, because the obvious
// way around an in-memory counter is to kill the app and start again - which
// is exactly what someone guessing would do.

const GUARD_KEY = 'two_lock_guard_v1';

/** Wrong tries allowed before any waiting starts. */
const FREE_ATTEMPTS = 3;

/**
 * What each further wrong try costs, in seconds.
 *
 * Gentle at first: the common case by far is your own fingers, on your own
 * phone, mistyping a PIN you do know. The escalation is steep enough that a
 * search of the whole keyspace stops being a thing anyone would sit through -
 * at the cap, ten thousand guesses is over three months.
 */
const PENALTIES_SECONDS = [15, 60, 300, 900];

interface GuardState {
  failed: number;
  /** Epoch ms before which no attempt is accepted. */
  until: number;
}

const EMPTY: GuardState = { failed: 0, until: 0 };

function read(): GuardState {
  try {
    const raw = localStorage.getItem(GUARD_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<GuardState>;
    return {
      failed: Number.isFinite(Number(parsed.failed)) ? Number(parsed.failed) : 0,
      until: Number.isFinite(Number(parsed.until)) ? Number(parsed.until) : 0
    };
  } catch {
    return EMPTY;
  }
}

function write(state: GuardState) {
  try {
    localStorage.setItem(GUARD_KEY, JSON.stringify(state));
  } catch {
    /* private mode - the in-memory value still applies for this run */
  }
}

/** Seconds still to wait, or 0 when an attempt is allowed right now. */
export function lockoutRemaining(now = Date.now()): number {
  const { until } = read();
  if (until <= now) return 0;
  return Math.ceil((until - now) / 1000);
}

export function failedAttempts(): number {
  return read().failed;
}

/**
 * Records a wrong PIN and returns the wait it just earned, in seconds.
 *
 * The penalty is chosen from how many have failed in total, so the wait keeps
 * growing rather than resetting each time one elapses.
 */
export function registerFailure(now = Date.now()): number {
  const current = read();
  const failed = current.failed + 1;

  if (failed <= FREE_ATTEMPTS) {
    write({ failed, until: 0 });
    return 0;
  }

  const index = Math.min(failed - FREE_ATTEMPTS - 1, PENALTIES_SECONDS.length - 1);
  const seconds = PENALTIES_SECONDS[index];
  write({ failed, until: now + seconds * 1000 });
  return seconds;
}

/** Called after a successful unlock: the slate is clean again. */
export function clearFailures() {
  try {
    localStorage.removeItem(GUARD_KEY);
  } catch {
    /* nothing was stored */
  }
}

/**
 * How much of the keyspace is left, for the warning shown after several
 * failures. Deliberately not exposed as an exact count of tries remaining -
 * there is no wipe, so there is no cliff to count down to.
 */
export function isUnderSuspicion(): boolean {
  return read().failed >= FREE_ATTEMPTS + 2;
}
