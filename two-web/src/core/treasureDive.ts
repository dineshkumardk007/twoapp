// Treasure Divers: one of you dives, the other stays on the boat
// (components/TreasureDive).
//
// The water is murky: the diver sees only the squares right beside them. The
// one on the boat has the chart - every rock, every chest, the currents the
// diver cannot see at all, and where the diver is - and guides them with
// arrow signs. All the chests, and back up to the anchor, before the air runs
// out. The boat can also send down a little more air every so often.
//
// A level is made from its number, the same on both phones. The diver's phone
// keeps the air and says how things stand; the boat's shows it.

import type { Seat } from './usTwo';
import { duoDice, duoInt, duoPick } from './duo';

/** Changing how levels are made changes every level: both phones must make them the same way. */
export const DIVE_MAKING = 1;

export interface DiveLevel {
  level: number;
  w: number;
  h: number;
  rock: boolean[];
  /** A current: it cannot be seen from in the water, and swimming into one costs air. */
  current: boolean[];
  /** The squares the chests lie on. */
  chests: number[];
  /** Where the anchor is: the dive starts and ends here. */
  start: number;
  /** Seconds of air to begin with. */
  air: number;
  /** The fewest strokes that get every chest and come back, keeping clear of the currents. */
  tour: number;
}

const STEP: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

/** Who dives on a level: you take it in turns, the first seat on the odd ones. */
export const diverOf = (level: number): Seat => (level % 2 === 1 ? 'user' : 'partner');

/** The square next to one, that way: -1 off the edge. */
export function nextTo(level: Pick<DiveLevel, 'w' | 'h'>, cell: number, d: number): number {
  const r = Math.floor(cell / level.w) + STEP[d][0];
  const c = (cell % level.w) + STEP[d][1];
  return r >= 0 && r < level.h && c >= 0 && c < level.w ? r * level.w + c : -1;
}

/** Whether the diver, on one square, can make out another: only the ones right beside, corners too. */
export function inSight(level: Pick<DiveLevel, 'w'>, cell: number, diver: number): boolean {
  return Math.abs((cell % level.w) - (diver % level.w)) <= 1 && Math.abs(Math.floor(cell / level.w) - Math.floor(diver / level.w)) <= 1;
}

interface Shape {
  w: number;
  h: number;
  chests: number;
  currents: number;
  rocks: number;
  /** Seconds of air for each stroke of the shortest way round, and the seconds on top. */
  perStroke: number;
  spare: number;
}

/** How big the sea floor is and what is on it: small and clear first. */
export function diveShape(level: number): Shape {
  if (level <= 3) return { w: 6, h: 7, chests: 2, currents: 3, rocks: 6, perStroke: 1.6, spare: 16 };
  if (level <= 10) return { w: 6, h: 8, chests: 3, currents: 5, rocks: 8, perStroke: 1.5, spare: 14 };
  if (level <= 20) return { w: 7, h: 9, chests: 3, currents: 8, rocks: 12, perStroke: 1.4, spare: 12 };
  if (level <= 40) return { w: 7, h: 9, chests: 4, currents: 10, rocks: 13, perStroke: 1.3, spare: 10 };
  return { w: 8, h: 10, chests: 4, currents: 13, rocks: 17, perStroke: 1.2, spare: 10 };
}

/** How many strokes every square is from one, going round what is in the way: -1 where there is no way. */
function strokesFrom(w: number, h: number, from: number, shut: (cell: number) => boolean): number[] {
  const far: number[] = new Array(w * h).fill(-1);
  far[from] = 0;
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (let d = 0; d < 4; d++) {
      const next = nextTo({ w, h }, queue[i], d);
      if (next < 0 || far[next] >= 0 || shut(next)) continue;
      far[next] = far[queue[i]] + 1;
      queue.push(next);
    }
  }
  return far;
}

/** The strokes of going to the nearest chest, then the nearest after that, and back: -1 when one cannot be reached. */
function tourOf(w: number, h: number, start: number, chests: number[], shut: (cell: number) => boolean): number {
  let at = start;
  let total = 0;
  const left = [...chests];
  while (left.length) {
    const far = strokesFrom(w, h, at, shut);
    let best = -1;
    for (let i = 0; i < left.length; i++) {
      if (far[left[i]] < 0) return -1;
      if (best < 0 || far[left[i]] < far[left[best]]) best = i;
    }
    total += far[left[best]];
    at = left.splice(best, 1)[0];
  }
  const home = strokesFrom(w, h, at, shut)[start];
  return home < 0 ? -1 : total + home;
}

function attempt(levelNumber: number, shape: Shape, seed: number): DiveLevel | null {
  const roll = duoDice(seed);
  const { w, h } = shape;
  const n = w * h;
  const start = Math.floor(w / 2);
  const rock: boolean[] = new Array(n).fill(false);
  for (let placed = 0, guard = 0; placed < shape.rocks && guard < 400; guard++) {
    const cell = duoPick(roll, n);
    // Never on the anchor, nor right under it.
    if (cell === start || cell === start + w || rock[cell]) continue;
    rock[cell] = true;
    placed++;
  }
  const open = strokesFrom(w, h, start, cell => rock[cell]);
  const far = Array.from({ length: n }, (_, cell) => cell).filter(cell => open[cell] >= 3);
  if (far.length < shape.chests + shape.currents) return null;
  const chests: number[] = [];
  while (chests.length < shape.chests && far.length) {
    const cell = far.splice(duoPick(roll, far.length), 1)[0];
    // Not two chests side by side.
    if (chests.some(other => Math.abs((other % w) - (cell % w)) + Math.abs(Math.floor(other / w) - Math.floor(cell / w)) < 2)) continue;
    chests.push(cell);
  }
  if (chests.length < shape.chests) return null;
  const direct = tourOf(w, h, start, chests, cell => rock[cell]);
  if (direct < 0) return null;

  // The currents: wherever they can go and still leave a clear way to every chest and back.
  const current: boolean[] = new Array(n).fill(false);
  const shut = (cell: number) => rock[cell] || current[cell];
  for (let placed = 0, guard = 0; placed < shape.currents && guard < 300; guard++) {
    const cell = duoPick(roll, n);
    if (cell === start || cell === start + w || rock[cell] || current[cell] || chests.includes(cell) || open[cell] < 0) continue;
    current[cell] = true;
    if (tourOf(w, h, start, chests, shut) < 0) {
      current[cell] = false;
      continue;
    }
    placed++;
  }
  const tour = tourOf(w, h, start, chests, shut);
  if (tour < 0 || tour < w + h) return null;
  return { level: levelNumber, w, h, rock, current, chests, start, air: Math.round(tour * shape.perStroke + shape.spare), tour };
}

const made = new Map<number, DiveLevel>();

/** Forgets the levels already made (for the tests). */
export function forgetDivesForTest() {
  made.clear();
}

/** The sea floor of a level: the same on both phones. There is no last level. */
export function diveOf(levelNumber: number): DiveLevel {
  const l = Math.max(1, Math.floor(levelNumber) || 1);
  const held = made.get(l);
  if (held) return held;
  const shape = diveShape(l);
  let found: DiveLevel | null = null;
  for (let i = 0; i < 600 && !found; i++) found = attempt(l, shape, (Math.imul(l, 2654435761) + Math.imul(i + 1, 40503) + DIVE_MAKING * 7919) >>> 0);
  if (!found) throw new Error('no sea floor could be made');
  if (made.size > 30) made.clear();
  made.set(l, found);
  return found;
}

// --------------------------------------------------------------- a dive, live

/** What swimming into a current costs, in seconds of air. */
export const CURRENT_COSTS_S = 6;
/** What the boat sends down, and how often it can. */
export const AIR_GIFT_S = 5;
export const AIR_GIFT_EVERY_S = 12;

/** A dive under way, as the diver's phone keeps it. */
export interface DiveRun {
  level: number;
  /** Which go at this level it is: a new go is a new tank of air. 0 before any. */
  e: number;
  pos: number;
  /** The chests brought up: a bit for each. */
  got: number;
  /** Seconds of air left. */
  air: number;
  /** How many currents have been swum into: so the boat sees each one happen. */
  hits: number;
  /** How many times the boat has sent air down. */
  gifts: number;
  /** Still down (0), back up with everything (1), or out of air (2). */
  over: 0 | 1 | 2;
}

export const newDive = (level: DiveLevel, e: number): DiveRun => ({ level: level.level, e, pos: level.start, got: 0, air: level.air, hits: 0, gifts: 0, over: 0 });

export const allChests = (level: DiveLevel, got: number) => got === (1 << level.chests.length) - 1;

export type DiveDid = 'swam' | 'rock' | 'edge' | 'current' | 'chest' | 'up' | 'out' | 'nothing';

/** One stroke. A rock or the edge stops it; a current is swum through, at a cost. */
export function stroke(run: DiveRun, level: DiveLevel, d: number): { run: DiveRun; did: DiveDid } {
  if (run.over) return { run, did: 'nothing' };
  const to = nextTo(level, run.pos, d);
  if (to < 0) return { run, did: 'edge' };
  if (level.rock[to]) return { run, did: 'rock' };
  let next: DiveRun = { ...run, pos: to };
  let did: DiveDid = 'swam';
  if (level.current[to]) {
    const air = Math.max(0, run.air - CURRENT_COSTS_S);
    next = { ...next, air, hits: run.hits + 1, over: air <= 0 ? 2 : 0 };
    did = air <= 0 ? 'out' : 'current';
  }
  const chest = level.chests.indexOf(to);
  if (!next.over && chest >= 0 && !(run.got & (1 << chest))) {
    next = { ...next, got: run.got | (1 << chest) };
    did = 'chest';
  }
  if (!next.over && to === level.start && allChests(level, next.got)) {
    next = { ...next, over: 1 };
    did = 'up';
  }
  return { run: next, did };
}

/** The air used by this much time. At nothing, the dive is over. */
export function breathed(run: DiveRun, seconds: number): DiveRun {
  if (run.over || seconds <= 0) return run;
  const air = Math.max(0, run.air - seconds);
  return { ...run, air, over: air <= 0 ? 2 : 0 };
}

/** Air sent down from the boat. */
export const airSent = (run: DiveRun): DiveRun => (run.over ? run : { ...run, air: run.air + AIR_GIFT_S, gifts: run.gifts + 1 });

/** The signs between you, in place of a call. Their order is what is sent, so it is only ever added to. */
export const DIVE_SIGNS = ['⬆️', '⬇️', '⬅️', '➡️', '✋', '✅', '❓', '⚠️'] as const;

/** What goes down the unkept channel. */
export interface DiveSaid {
  run?: DiveRun;
  sign?: number;
  /** From the boat: start this level. */
  go?: number;
  /** From the boat: air sent down. */
  air?: true;
}

export const diveToWire = (run: DiveRun) => ({ l: run.level, e: run.e, p: run.pos, g: run.got, t: Math.round(run.air * 10), c: run.hits, a: run.gifts, o: run.over });

/** Only what a dive could have said. */
export function cleanDiveSaid(raw: unknown): DiveSaid | null {
  const r = raw as { s?: unknown; g?: unknown; go?: unknown; air?: unknown } | null;
  if (!r || typeof r !== 'object') return null;
  const said: DiveSaid = {};
  const s = r.s as Record<string, unknown> | undefined;
  if (s && typeof s === 'object') {
    const level = duoInt(s.l, 1, 1_000_000);
    const e = duoInt(s.e, 0, 1_000_000_000);
    const pos = duoInt(s.p, 0, 999);
    const got = duoInt(s.g, 0, 255);
    const tenths = duoInt(s.t, 0, 100_000);
    const hits = duoInt(s.c, 0, 100_000);
    const gifts = duoInt(s.a, 0, 100_000);
    const over = duoInt(s.o, 0, 2);
    if (level !== null && e !== null && pos !== null && got !== null && tenths !== null && hits !== null && gifts !== null && over !== null) {
      said.run = { level, e, pos, got, air: tenths / 10, hits, gifts, over: over as 0 | 1 | 2 };
    }
  }
  const sign = duoInt(r.g, 0, DIVE_SIGNS.length - 1);
  if (sign !== null) said.sign = sign;
  const go = duoInt(r.go, 1, 1_000_000);
  if (go !== null) said.go = go;
  if (r.air === 1) said.air = true;
  return said.run || said.sign !== undefined || said.go !== undefined || said.air ? said : null;
}
