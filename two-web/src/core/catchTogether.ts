// Catch Together: a net held between the two of you (components/CatchTogether).
//
// Each of you holds one end and slides it left and right. Whatever comes down
// between your two hands lands in the net: stars and hearts count for you,
// and a bomb costs one of your three lives - so you spread out for the stars
// and close up, or step aside together, for the bombs.
//
// What falls, and when, is made from a seed, the same on both phones. One
// phone (the first seat's) is the one that says what was caught and keeps the
// score; the other sends where its hand is and shows what it is told.

import type { Seat } from './usTwo';
import { duoDice, duoInt } from './duo';

/** How long a round is, in seconds. */
export const CATCH_SECONDS = 60;
export const CATCH_LIVES = 3;
/** How far across a hand may go: the field is 0 to 1. */
export const HAND_MIN = 0.07;
export const HAND_MAX = 0.93;
/** How far past a hand the net still catches. */
export const NET_REACH = 0.035;
/** Where things land, down the field (0 the top, 1 the bottom). */
export const NET_AT = 0.84;
/** So many in a row without a bomb is a bonus. */
export const STREAK_EVERY = 5;
export const STREAK_BONUS = 2;

export type DropKind = 'star' | 'heart' | 'bomb';
export interface Drop {
  id: number;
  /** When it appears at the top, in seconds from the start. */
  t: number;
  /** Where across the field. */
  x: number;
  kind: DropKind;
  /** How long it takes to come down to the net. */
  fall: number;
}

/** The phone that says what was caught: the first seat's. */
export const catchHost = (seat: Seat) => seat === 'user';

/** Everything that falls in a round, in the order it lands. */
export function dropsOf(seed: number): Drop[] {
  const roll = duoDice(seed);
  const drops: Drop[] = [];
  let t = 1.2;
  let lastX = 0.5;
  for (let id = 0; t < CATCH_SECONDS - 1.5 && id < 400; id++) {
    const through = t / CATCH_SECONDS;
    // Not straight under the one before: there is somewhere to go.
    let x = HAND_MIN + roll() * (HAND_MAX - HAND_MIN);
    if (Math.abs(x - lastX) < 0.09) x = x < 0.5 ? x + 0.2 : x - 0.2;
    lastX = x;
    const r = roll();
    const bombs = 0.18 + through * 0.17;
    const kind: DropKind = r < bombs ? 'bomb' : r < bombs + 0.07 ? 'heart' : 'star';
    drops.push({ id, t, x, kind, fall: 2.7 - through * 1.0 });
    t += 0.95 - through * 0.5 + roll() * 0.25;
  }
  return drops.sort((a, b) => a.t + a.fall - (b.t + b.fall) || a.id - b.id);
}

/** When a drop reaches the net. */
export const landsAt = (drop: Drop) => drop.t + drop.fall;

/** Whether the net between two hands is under this spot. */
export const inNet = (x: number, a: number, b: number) => x >= Math.min(a, b) - NET_REACH && x <= Math.max(a, b) + NET_REACH;

/** What became of a drop: in the net (1) or past it (0). */
export type Outcome = 0 | 1;

export interface CatchScore {
  score: number;
  lives: number;
  streak: number;
  /** Stars and hearts caught, and bombs. */
  caught: number;
  bombs: number;
  /** How many drops, in landing order, have landed. */
  done: number;
}

export const freshScore = (): CatchScore => ({ score: 0, lives: CATCH_LIVES, streak: 0, caught: 0, bombs: 0, done: 0 });

/** One drop landing, with the hands where they are. */
export function landed(score: CatchScore, drop: Drop, a: number, b: number): { score: CatchScore; outcome: Outcome } {
  const next = { ...score, done: score.done + 1 };
  if (!inNet(drop.x, a, b)) {
    // A star let go by ends the run of them; a bomb let go by is just as it should be.
    if (drop.kind !== 'bomb') next.streak = 0;
    return { score: next, outcome: 0 };
  }
  if (drop.kind === 'bomb') {
    next.lives = Math.max(0, score.lives - 1);
    next.bombs = score.bombs + 1;
    next.streak = 0;
    return { score: next, outcome: 1 };
  }
  next.caught = score.caught + 1;
  next.streak = score.streak + 1;
  next.score = score.score + (drop.kind === 'heart' ? 3 : 1) + (next.streak % STREAK_EVERY === 0 ? STREAK_BONUS : 0);
  return { score: next, outcome: 1 };
}

/** Everything that lands up to `t`, in order. Stops at once when the last life goes. */
export function advance(score: CatchScore, drops: Drop[], t: number, a: number, b: number): { score: CatchScore; events: Array<[id: number, outcome: Outcome]> } {
  const events: Array<[number, Outcome]> = [];
  let now = score;
  while (now.lives > 0 && now.done < drops.length && landsAt(drops[now.done]) <= t) {
    const drop = drops[now.done];
    const result = landed(now, drop, a, b);
    now = result.score;
    events.push([drop.id, result.outcome]);
  }
  return { score: now, events };
}

/** The round is over: time up, everything down, or no lives left. */
export const roundOver = (score: CatchScore, drops: Drop[], t: number) => score.lives <= 0 || t >= CATCH_SECONDS || score.done >= drops.length;

const clampHand = (x: number) => Math.min(HAND_MAX, Math.max(HAND_MIN, x));
export const handAt = clampHand;

// ------------------------------------------------- as it happens, kept nowhere

/** What the phone keeping the score says, several times a second. */
export interface CatchHostSaid {
  /** Which round: a new one is a new number. */
  e: number;
  seed: number;
  /** Seconds into it. */
  t: number;
  score: number;
  lives: number;
  streak: number;
  done: number;
  /** Its own hand. */
  x: number;
  /** The last few things to land and what became of them. */
  events: Array<[number, Outcome]>;
  /** Over, with this much caught. */
  end: boolean;
}

export interface CatchSaid {
  host?: CatchHostSaid;
  /** The other phone's hand, and the round it is in. */
  hand?: { e: number; x: number };
  /** From the other phone: start a round. */
  go?: true;
}

export const hostToWire = (h: CatchHostSaid) => ({
  h: [h.e, h.seed, Math.round(h.t * 100), h.score, h.lives, h.streak, h.done, Math.round(h.x * 1000), h.end ? 1 : 0],
  o: h.events.map(([id, outcome]) => id * 2 + outcome)
});
export const handToWire = (e: number, x: number) => ({ x: [e, Math.round(x * 1000)] });

/** Only what a round could have said. */
export function cleanCatchSaid(raw: unknown): CatchSaid | null {
  const r = raw as { h?: unknown; o?: unknown; x?: unknown; go?: unknown } | null;
  if (!r || typeof r !== 'object') return null;
  const said: CatchSaid = {};
  if (Array.isArray(r.h) && r.h.length === 9) {
    const [e, seed, t, score, lives, streak, done, x, end] = r.h.map((value, i) => duoInt(value, 0, i === 1 ? 0xffffffff : 10_000_000));
    const events: Array<[number, Outcome]> = [];
    if (Array.isArray(r.o)) {
      for (const code of r.o.slice(0, 12)) {
        const n = duoInt(code, 0, 2000);
        if (n !== null) events.push([n >> 1, (n & 1) as Outcome]);
      }
    }
    if (e !== null && e > 0 && seed !== null && t !== null && score !== null && lives !== null && lives <= CATCH_LIVES && streak !== null && done !== null && x !== null && x <= 1000 && end !== null) {
      said.host = { e, seed, t: t / 100, score, lives, streak, done, x: clampHand(x / 1000), events, end: end === 1 };
    }
  }
  if (Array.isArray(r.x) && r.x.length === 2) {
    const e = duoInt(r.x[0], 0, 10_000_000);
    const x = duoInt(r.x[1], 0, 1000);
    if (e !== null && x !== null) said.hand = { e, x: clampHand(x / 1000) };
  }
  if (r.go === 1) said.go = true;
  return said.host || said.hand || said.go ? said : null;
}
