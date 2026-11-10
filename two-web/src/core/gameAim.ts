// Watching the other one aim, on Canvas of Us (Carrom's striker, the water
// balloon drawn back).
//
// A move is a record: kept, replayed, the same on both phones. Aiming is not.
// It goes down the relay's unkept channel (ws.sendSignal, as "typing..." does):
// a few numbers, several times a second, only while a finger is on the board,
// and forgotten the instant they are drawn. Nothing about the game depends on
// them - a phone that hears none of it plays exactly the same game.
//
// The boards talk to this file directly rather than through App's state: ten
// of these a second through React would redraw the whole of Two each time.

export const GAME_AIM_SIGNAL = 'GAME_AIM';

export type AimKind = 'carrom' | 'balloon';
const KINDS: AimKind[] = ['carrom', 'balloon'];

export interface AimSaid {
  k: AimKind;
  /** Which game, and how many moves it had: aiming at any other board is ignored. */
  g: string;
  n: number;
  /** Whole numbers, each board's own (see its `say`); null when the finger is off for good. */
  a: number[] | null;
}

type Sender = (said: AimSaid) => void;
let sender: Sender | null = null;

/** App gives the way out: the relay's unkept channel. */
export function setAimSender(fn: Sender | null) {
  sender = fn;
}

/** No more than this often: half of what the relay allows a phone, moves and all. */
export const AIM_EVERY_MS = 100;
let lastAt = 0;
let waiting: AimSaid | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSent = '';

function send(said: AimSaid) {
  const text = JSON.stringify(said);
  // A finger held still says nothing new.
  if (text === lastSent) return;
  lastSent = text;
  lastAt = Date.now();
  try {
    sender?.(said);
  } catch {
    /* not connected: nothing to tell */
  }
}

/** Says where this phone's aim is now. The latest always gets through; those between may not. */
export function sayAim(k: AimKind, g: string, n: number, a: number[] | null) {
  const said: AimSaid = { k, g, n, a: a ? a.map(v => Math.round(v)) : null };
  const wait = AIM_EVERY_MS - (Date.now() - lastAt);
  if (!a || wait <= 0) {
    // "Off" goes at once: it must not be dropped behind something older.
    if (timer) clearTimeout(timer);
    timer = null;
    waiting = null;
    send(said);
    return;
  }
  waiting = said;
  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      const next = waiting;
      waiting = null;
      if (next) send(next);
    }, wait);
  }
}

type Listener = (said: AimSaid) => void;
const listeners = new Set<Listener>();

/** A board listens for the other phone's aim. Returns how to stop. */
export function onAim(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Only what a board could have sent: a kind, a game, and a few finite whole numbers. */
export function cleanAim(raw: unknown): AimSaid | null {
  const o = raw as Partial<AimSaid> | null;
  if (!o || typeof o !== 'object') return null;
  if (!KINDS.includes(o.k as AimKind)) return null;
  if (typeof o.g !== 'string' || !o.g || o.g.length > 80) return null;
  if (!Number.isInteger(o.n) || (o.n as number) < 0 || (o.n as number) > 5000) return null;
  let a: number[] | null = null;
  if (o.a !== null && o.a !== undefined) {
    if (!Array.isArray(o.a) || o.a.length < 1 || o.a.length > 8) return null;
    if (!o.a.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100_000)) return null;
    a = o.a.map(v => Math.round(v));
  }
  return { k: o.k as AimKind, g: o.g, n: o.n as number, a };
}

/** App hands over what came from the other phone. */
export function hearAim(raw: unknown) {
  const said = cleanAim(raw);
  if (!said) return;
  listeners.forEach(fn => {
    try {
      fn(said);
    } catch {
      /* one board's trouble is not another's */
    }
  });
}

/** For the tests: as if nothing had been said yet. */
export function forgetAimForTest() {
  if (timer) clearTimeout(timer);
  timer = null;
  waiting = null;
  lastAt = 0;
  lastSent = '';
  listeners.clear();
  sender = null;
}
