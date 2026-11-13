// Space Crew: one ship, two seats (components/SpaceCrew).
//
// One of you flies: a finger slides the ship left and right, out of the way
// of the rocks and under the stars and the repair kits. The other is on the
// guns: a tap fires at that spot, and a rock hit is a rock gone - but so is a
// star or a kit, so they are left for the pilot. Three rocks into the ship
// and the round is over. You swap seats every round.
//
// What comes down, and when, is made from a seed, the same on both phones.
// One phone (the first seat's) says what was hit and keeps the score; the
// other sends where the ship is, or where it fired, and shows what it is told.

import type { Seat } from './usTwo';
import { duoDice, duoInt } from './duo';

/** How long a round is, in seconds. */
export const SPACE_SECONDS = 60;
export const SPACE_SHIELDS = 3;
/** How far across the ship may go: the field is 0 to 1. */
export const SHIP_MIN = 0.08;
export const SHIP_MAX = 0.92;
/** Where the ship flies, down the field (0 the top, 1 the bottom). */
export const SHIP_AT = 0.86;
/** How near a thing has to come to the ship to touch it, across. */
export const SHIP_REACH = 0.1;
/** How near a shot has to be to a thing to hit it. */
export const SHOT_REACH = 0.11;
/** Shots held ready, and how long each takes to come back. */
export const GUN_SHOTS = 5;
export const GUN_BACK_S = 0.55;

export type ThingKind = 'rock' | 'big' | 'star' | 'kit';
export interface Thing {
  id: number;
  /** When it appears at the top, in seconds from the start. */
  t: number;
  x: number;
  kind: ThingKind;
  /** How long it takes to come down to the ship. */
  fall: number;
  /** How far it drifts across on the way, so a rock does not come straight down. */
  drift: number;
}

/** The phone that says what was hit: the first seat's. */
export const spaceHost = (seat: Seat) => seat === 'user';
/** Who flies in a round: you swap every round, the first seat on the odd ones. */
export const pilotOf = (round: number): Seat => (round % 2 === 1 ? 'user' : 'partner');

/** Everything that comes down in a round, in the order it reaches the ship. */
export function thingsOf(seed: number): Thing[] {
  const roll = duoDice(seed);
  const things: Thing[] = [];
  let t = 1.4;
  for (let id = 0; t < SPACE_SECONDS - 1.5 && id < 500; id++) {
    const through = t / SPACE_SECONDS;
    const r = roll();
    const kind: ThingKind = r < 0.1 ? 'star' : r < 0.16 ? 'kit' : r < 0.16 + 0.1 + through * 0.14 ? 'big' : 'rock';
    const x = SHIP_MIN + roll() * (SHIP_MAX - SHIP_MIN);
    const drift = kind === 'star' || kind === 'kit' ? 0 : (roll() - 0.5) * 0.3;
    things.push({ id, t, x, kind, fall: (kind === 'big' ? 3.6 : 3.0) - through * 1.1, drift });
    t += 0.8 - through * 0.42 + roll() * 0.25;
  }
  return things.sort((a, b) => a.t + a.fall - (b.t + b.fall) || a.id - b.id);
}

/** When a thing reaches the ship. */
export const reachesAt = (thing: Thing) => thing.t + thing.fall;

/** Where a thing is at a moment: across, and down (0 the top, SHIP_AT at the ship). */
export function placeOf(thing: Thing, t: number): { x: number; y: number } {
  const part = (t - thing.t) / thing.fall;
  return { x: Math.min(0.98, Math.max(0.02, thing.x + thing.drift * part)), y: part * SHIP_AT };
}

/**
 * What became of a thing: shot to bits (1), into the ship (2), picked up by
 * the ship (3), or - a big rock - cracked by a first shot and still coming (4).
 */
export type Fate = 1 | 2 | 3 | 4;
export const isGone = (fate: Fate | undefined) => fate === 1 || fate === 2 || fate === 3;

export interface SpaceScore {
  score: number;
  shields: number;
  /** How many things, in the order they reach the ship, have reached it. */
  done: number;
  rocks: number;
  stars: number;
}

export const freshSpace = (): SpaceScore => ({ score: 0, shields: SPACE_SHIELDS, done: 0, rocks: 0, stars: 0 });

export interface SpaceState {
  score: SpaceScore;
  /** What became of each thing, by its id. */
  fates: Map<number, Fate>;
}

export const freshState = (): SpaceState => ({ score: freshSpace(), fates: new Map() });

/** A shot fired at a spot, at a moment: the nearest thing within reach is hit. What it hit, or nothing. */
export function fired(state: SpaceState, things: Thing[], t: number, x: number, y: number): [id: number, fate: Fate] | null {
  let best: Thing | null = null;
  let bestFar = SHOT_REACH * SHOT_REACH;
  for (const thing of things) {
    if (thing.t > t) continue;
    if (reachesAt(thing) < t || isGone(state.fates.get(thing.id))) continue;
    const at = placeOf(thing, t);
    const far = (at.x - x) ** 2 + (at.y - y) ** 2;
    if (far <= bestFar) {
      best = thing;
      bestFar = far;
    }
  }
  if (!best) return null;
  // A big rock takes two.
  if (best.kind === 'big' && state.fates.get(best.id) !== 4) {
    state.fates.set(best.id, 4);
    return [best.id, 4];
  }
  state.fates.set(best.id, 1);
  if (best.kind === 'rock' || best.kind === 'big') {
    state.score = { ...state.score, score: state.score.score + (best.kind === 'big' ? 3 : 1), rocks: state.score.rocks + 1 };
  }
  return [best.id, 1];
}

/** Everything that reaches the ship up to `t`, in order, with the ship where it is. Stops when the last shield goes. */
export function flown(state: SpaceState, things: Thing[], t: number, ship: number): Array<[id: number, fate: Fate]> {
  const events: Array<[number, Fate]> = [];
  while (state.score.shields > 0 && state.score.done < things.length && reachesAt(things[state.score.done]) <= t) {
    const thing = things[state.score.done];
    const score = { ...state.score, done: state.score.done + 1 };
    if (!isGone(state.fates.get(thing.id)) && Math.abs(placeOf(thing, reachesAt(thing)).x - ship) <= SHIP_REACH) {
      if (thing.kind === 'star') {
        score.score += 5;
        score.stars += 1;
        state.fates.set(thing.id, 3);
        events.push([thing.id, 3]);
      } else if (thing.kind === 'kit') {
        score.shields = Math.min(SPACE_SHIELDS, score.shields + 1);
        state.fates.set(thing.id, 3);
        events.push([thing.id, 3]);
      } else {
        score.shields -= 1;
        state.fates.set(thing.id, 2);
        events.push([thing.id, 2]);
      }
    }
    state.score = score;
  }
  return events;
}

/** The round is over: time up, everything down, or no shields left. */
export const spaceOver = (score: SpaceScore, things: Thing[], t: number) => score.shields <= 0 || t >= SPACE_SECONDS || score.done >= things.length;

export const shipAt = (x: number) => Math.min(SHIP_MAX, Math.max(SHIP_MIN, x));

// ------------------------------------------------- as it happens, kept nowhere

/** What the phone keeping the score says, several times a second. */
export interface SpaceHostSaid {
  /** Which round: a new one is a new number. */
  e: number;
  seed: number;
  /** Which round of the two of you it is: who flies follows from it. */
  round: number;
  /** Seconds into it. */
  t: number;
  score: number;
  shields: number;
  done: number;
  /** Where the ship is, as this phone has it. */
  ship: number;
  /** The last few things to meet their fate. */
  events: Array<[number, Fate]>;
  /** The last few shots this phone knows of: a count that goes up with each, and where. */
  shots: Array<[n: number, x: number, y: number]>;
  end: boolean;
}

export interface SpaceSaid {
  host?: SpaceHostSaid;
  /** From the other phone, flying: where the ship is. */
  ship?: { e: number; x: number };
  /** From the other phone, on the guns: a shot. */
  shot?: { e: number; x: number; y: number };
  /** From the other phone: start a round. */
  go?: true;
}

export const spaceToWire = (h: SpaceHostSaid) => ({
  h: [h.e, h.seed, h.round, Math.round(h.t * 100), h.score, h.shields, h.done, Math.round(h.ship * 1000), h.end ? 1 : 0],
  o: h.events.map(([id, fate]) => id * 8 + fate),
  z: h.shots.map(([n, x, y]) => [n, Math.round(x * 1000), Math.round(y * 1000)])
});
export const shipToWire = (e: number, x: number) => ({ x: [e, Math.round(x * 1000)] });
export const shotToWire = (e: number, x: number, y: number) => ({ f: [e, Math.round(x * 1000), Math.round(y * 1000)] });

const unit = (value: unknown) => {
  const n = duoInt(value, 0, 1000);
  return n === null ? null : n / 1000;
};

/** Only what a round could have said. */
export function cleanSpaceSaid(raw: unknown): SpaceSaid | null {
  const r = raw as { h?: unknown; o?: unknown; z?: unknown; x?: unknown; f?: unknown; go?: unknown } | null;
  if (!r || typeof r !== 'object') return null;
  const said: SpaceSaid = {};
  if (Array.isArray(r.h) && r.h.length === 9) {
    const [e, seed, round, t, score, shields, done, ship, end] = r.h.map((value, i) => duoInt(value, 0, i === 1 ? 0xffffffff : 10_000_000));
    const events: Array<[number, Fate]> = [];
    if (Array.isArray(r.o)) {
      for (const code of r.o.slice(0, 16)) {
        const n = duoInt(code, 0, 8000);
        if (n !== null && (n & 7) >= 1 && (n & 7) <= 4) events.push([n >> 3, (n & 7) as Fate]);
      }
    }
    const shots: Array<[number, number, number]> = [];
    if (Array.isArray(r.z)) {
      for (const shot of r.z.slice(0, 6)) {
        if (!Array.isArray(shot) || shot.length !== 3) continue;
        const n = duoInt(shot[0], 0, 10_000_000);
        const x = unit(shot[1]);
        const y = unit(shot[2]);
        if (n !== null && x !== null && y !== null) shots.push([n, x, y]);
      }
    }
    if (e !== null && e > 0 && seed !== null && round !== null && round > 0 && t !== null && score !== null && shields !== null && shields <= SPACE_SHIELDS && done !== null && ship !== null && ship <= 1000 && end !== null) {
      said.host = { e, seed, round, t: t / 100, score, shields, done, ship: shipAt(ship / 1000), events, shots, end: end === 1 };
    }
  }
  if (Array.isArray(r.x) && r.x.length === 2) {
    const e = duoInt(r.x[0], 0, 10_000_000);
    const x = unit(r.x[1]);
    if (e !== null && x !== null) said.ship = { e, x: shipAt(x) };
  }
  if (Array.isArray(r.f) && r.f.length === 3) {
    const e = duoInt(r.f[0], 0, 10_000_000);
    const x = unit(r.f[1]);
    const y = unit(r.f[2]);
    if (e !== null && x !== null && y !== null) said.shot = { e, x, y };
  }
  if (r.go === 1) said.go = true;
  return said.host || said.ship || said.shot || said.go ? said : null;
}
