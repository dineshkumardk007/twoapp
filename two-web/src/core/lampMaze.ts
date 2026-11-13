// Light and Shadow: a dark maze for the two of you (components/LampMaze).
//
// One of you carries the lamp. Walls and locked gates stop it, as they would
// anybody. The other is a shadow: it goes straight through walls, but only
// where the lamp's light falls - it cannot take a step into the dark. The key
// to each gate lies where the lamp can never walk to, close enough for its
// light to reach: so the lamp goes and stands near, the shadow slips through
// the wall for the key, and the gate opens. The level is done when both are
// at the way out. You swap who carries the lamp each level.
//
// A level is made from its number, the same on both phones, and every one
// made here can be finished (`solveLamp`). Nothing of a level half done is
// kept: each phone says where its own one is as it goes, and a level left is
// started again.

import type { Seat } from './usTwo';
import { duoDice, duoInt, duoPick } from './duo';

/** Changing how levels are made changes every level: both phones must make them the same way. */
export const LAMP_MAKING = 1;

export interface LampGate {
  /** The two squares it stands between. */
  a: number;
  b: number;
  /** The square its key lies on. */
  key: number;
}

export interface LampLevel {
  level: number;
  w: number;
  h: number;
  /** For each square, the squares it opens on to: up, down, left, right; -1 where there is a wall. */
  links: number[][];
  /** The gate in each of those openings, or -1. */
  gateAt: number[][];
  gates: LampGate[];
  /** Where both begin, and where both have to get to. */
  start: number;
  exit: number;
  /** How far the light reaches: the square of it, in squares. */
  reach2: number;
  /** The fewest steps the two of you need between you. */
  steps: number;
}

const STEP: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];
const BACK = [1, 0, 3, 2];

/** Who carries the lamp on a level: you take it in turns, the first seat on the odd ones. */
export const lampCarrier = (level: number): Seat => (level % 2 === 1 ? 'user' : 'partner');

/** Whether the light of a lamp on one square reaches another. */
export function lit(level: Pick<LampLevel, 'w' | 'reach2'>, cell: number, lamp: number): boolean {
  const dx = (cell % level.w) - (lamp % level.w);
  const dy = Math.floor(cell / level.w) - Math.floor(lamp / level.w);
  return dx * dx + dy * dy <= level.reach2;
}
const far2 = (w: number, a: number, b: number) => {
  const dx = (a % w) - (b % w);
  const dy = Math.floor(a / w) - Math.floor(b / w);
  return dx * dx + dy * dy;
};

/** The square next to one, that way, walls or no walls: -1 off the edge. */
export function beside(level: Pick<LampLevel, 'w' | 'h'>, cell: number, d: number): number {
  const r = Math.floor(cell / level.w) + STEP[d][0];
  const c = (cell % level.w) + STEP[d][1];
  return r >= 0 && r < level.h && c >= 0 && c < level.w ? r * level.w + c : -1;
}

export type LampStop = 'wall' | 'gate' | 'dark';

/** A step for the one with the lamp: where to, or what stops it. It never leaves the shadow in the dark. */
export function lampStep(level: LampLevel, from: number, d: number, keys: number, shadow: number): { to: number } | { stop: LampStop; gate?: number } {
  const to = level.links[from]?.[d] ?? -1;
  if (to < 0) return { stop: 'wall' };
  const gate = level.gateAt[from][d];
  if (gate >= 0 && !(keys & (1 << gate))) return { stop: 'gate', gate };
  if (!lit(level, shadow, to)) return { stop: 'dark' };
  return { to };
}

/**
 * A step for the shadow: through anything, but only on to a square the light
 * reaches. One left in the dark (the lamp having been put back to its start)
 * may still step toward the light.
 */
export function shadowStep(level: LampLevel, from: number, d: number, lamp: number): { to: number } | { stop: 'edge' | 'dark' } {
  const to = beside(level, from, d);
  if (to < 0) return { stop: 'edge' };
  if (lit(level, to, lamp) || far2(level.w, to, lamp) < far2(level.w, from, lamp)) return { to };
  return { stop: 'dark' };
}

/** The gate whose key lies on a square, or -1. */
export const keyOn = (level: LampLevel, cell: number) => level.gates.findIndex(gate => gate.key === cell);

/** Both at the way out. */
export const lampDone = (level: LampLevel, lamp: number, shadow: number) => lamp === level.exit && shadow === level.exit;

/** A maze with one way, and only one, between any two squares. */
function carve(w: number, h: number, roll: () => number): number[][] {
  const links: number[][] = Array.from({ length: w * h }, () => [-1, -1, -1, -1]);
  const seen: boolean[] = new Array(w * h).fill(false);
  const stack = [duoPick(roll, w * h)];
  seen[stack[0]] = true;
  while (stack.length) {
    const cell = stack[stack.length - 1];
    const r = Math.floor(cell / w);
    const c = cell % w;
    const ways: number[] = [];
    for (let d = 0; d < 4; d++) {
      const rr = r + STEP[d][0];
      const cc = c + STEP[d][1];
      if (rr >= 0 && rr < h && cc >= 0 && cc < w && !seen[rr * w + cc]) ways.push(d);
    }
    if (!ways.length) {
      stack.pop();
      continue;
    }
    const d = ways[duoPick(roll, ways.length)];
    const next = (r + STEP[d][0]) * w + (c + STEP[d][1]);
    links[cell][d] = next;
    links[next][BACK[d]] = cell;
    seen[next] = true;
    stack.push(next);
  }
  return links;
}

/** How far every square is from one, walking; and the square each is reached from. */
function walkFrom(links: number[][], from: number, shut?: (cell: number, d: number) => boolean): { far: number[]; came: number[] } {
  const far: number[] = new Array(links.length).fill(-1);
  const came: number[] = new Array(links.length).fill(-1);
  far[from] = 0;
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    for (let d = 0; d < 4; d++) {
      const next = links[cell][d];
      if (next < 0 || far[next] >= 0 || shut?.(cell, d)) continue;
      far[next] = far[cell] + 1;
      came[next] = cell;
      queue.push(next);
    }
  }
  return { far, came };
}

/**
 * The fewest steps, between the two of you, to get both to the way out; -1
 * when it cannot be done. Every place the two could be, and every set of
 * gates open, is tried.
 */
export function solveLamp(level: LampLevel): number {
  const n = level.w * level.h;
  const sets = 1 << level.gates.length;
  const size = sets * n * n;
  const far = new Int32Array(size).fill(-1);
  const index = (keys: number, lamp: number, shadow: number) => (keys * n + lamp) * n + shadow;
  const first = index(0, level.start, level.start);
  far[first] = 0;
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  queue[tail++] = first;
  while (head < tail) {
    const at = queue[head++];
    const shadow = at % n;
    const lamp = Math.floor(at / n) % n;
    const keys = Math.floor(at / (n * n));
    if (lampDone(level, lamp, shadow)) return far[at];
    for (let d = 0; d < 4; d++) {
      const a = lampStep(level, lamp, d, keys, shadow);
      if ('to' in a) {
        const next = index(keys, a.to, shadow);
        if (far[next] < 0) {
          far[next] = far[at] + 1;
          queue[tail++] = next;
        }
      }
      const b = shadowStep(level, shadow, d, lamp);
      if ('to' in b && lit(level, b.to, lamp)) {
        const key = keyOn(level, b.to);
        const next = index(key >= 0 ? keys | (1 << key) : keys, lamp, b.to);
        if (far[next] < 0) {
          far[next] = far[at] + 1;
          queue[tail++] = next;
        }
      }
    }
  }
  return -1;
}

interface Shape {
  w: number;
  h: number;
  gates: number;
  reach2: number;
}

/** The size of a level, how many gates it has, and how far the light reaches: small and bright first. */
export function lampShape(level: number): Shape {
  if (level <= 3) return { w: 5, h: 6, gates: 1, reach2: 5 };
  if (level <= 10) return { w: 5, h: 7, gates: 2, reach2: 5 };
  if (level <= 20) return { w: 6, h: 8, gates: 2, reach2: 5 };
  if (level <= 35) return { w: 6, h: 8, gates: 3, reach2: 4 };
  if (level <= 60) return { w: 7, h: 9, gates: 3, reach2: 4 };
  return { w: 7, h: 9, gates: 4, reach2: 4 };
}

function attempt(levelNumber: number, shape: Shape, seed: number): LampLevel | null {
  const roll = duoDice(seed);
  const { w, h } = shape;
  const n = w * h;
  const links = carve(w, h, roll);
  const start = duoPick(roll, n);
  const open = walkFrom(links, start);
  // The way out is as far from the start as the maze goes.
  let exit = start;
  for (let cell = 0; cell < n; cell++) if (open.far[cell] > open.far[exit]) exit = cell;
  const way: number[] = [];
  for (let cell = exit; cell !== start && cell >= 0; cell = open.came[cell]) way.unshift(cell);
  if (way.length < shape.gates * 3 + 3) return null;

  // The gates, spread along the one way there.
  const gateAt: number[][] = Array.from({ length: n }, () => [-1, -1, -1, -1]);
  const gates: LampGate[] = [];
  let last = 1;
  for (let g = 0; g < shape.gates; g++) {
    const want = Math.floor(((g + 1) * way.length) / (shape.gates + 1)) + duoPick(roll, 3) - 1;
    const at = Math.min(way.length - 2, Math.max(last + 1, want));
    if (at <= last) return null;
    last = at;
    const a = way[at - 1];
    const b = way[at];
    const d = links[a].indexOf(b);
    gateAt[a][d] = g;
    gateAt[b][BACK[d]] = g;
    gates.push({ a, b, key: -1 });
  }
  // Each key: where the lamp cannot yet walk, but its light, from somewhere it can, reaches.
  const taken = new Set<number>([start, exit]);
  for (let g = 0; g < gates.length; g++) {
    const here = walkFrom(links, start, (cell, d) => gateAt[cell][d] >= g).far;
    const spots: number[] = [];
    for (let cell = 0; cell < n; cell++) {
      if (here[cell] >= 0 || taken.has(cell)) continue;
      let seen = false;
      for (let from = 0; from < n && !seen; from++) seen = here[from] >= 0 && lit({ w, reach2: shape.reach2 }, cell, from);
      if (seen) spots.push(cell);
    }
    if (!spots.length) return null;
    // Not the square just the other side of the gate, where there is any other.
    const better = spots.filter(cell => cell !== gates[g].b);
    const from = better.length ? better : spots;
    gates[g].key = from[duoPick(roll, from.length)];
    taken.add(gates[g].key);
  }
  const level: LampLevel = { level: levelNumber, w, h, links, gateAt, gates, start, exit, reach2: shape.reach2, steps: 0 };
  const steps = solveLamp(level);
  if (steps < w + h) return null;
  level.steps = steps;
  return level;
}

const made = new Map<number, LampLevel>();

/** Forgets the levels already made (for the tests). */
export function forgetLampsForTest() {
  made.clear();
}

/** The maze of a level: the same on both phones. There is no last level. */
export function lampOf(levelNumber: number): LampLevel {
  const l = Math.max(1, Math.floor(levelNumber) || 1);
  const held = made.get(l);
  if (held) return held;
  const shape = lampShape(l);
  let found: LampLevel | null = null;
  for (let gates = shape.gates; gates >= 1 && !found; gates--) {
    for (let i = 0; i < 400 && !found; i++) {
      found = attempt(l, { ...shape, gates }, (Math.imul(l, 2654435761) + Math.imul(i + 1, 40503) + LAMP_MAKING * 7919 + gates) >>> 0);
    }
  }
  if (!found) throw new Error('no maze could be made');
  if (made.size > 30) made.clear();
  made.set(l, found);
  return found;
}

// ------------------------------------------------- as it happens, kept nowhere

/** What each phone says about its own one, with every step and every couple of seconds. */
export interface LampSaid {
  /** The level it is on. */
  level: number;
  /** Which go at it: starting it again is a new number, and both go back to the start. */
  e: number;
  /** Its square. */
  pos: number;
  /** The keys the shadow has picked up: a bit for each gate. */
  keys: number;
}

export const lampToWire = (said: LampSaid) => ({ l: said.level, e: said.e, p: said.pos, k: said.keys });

/** Only what a maze could have said. */
export function cleanLampSaid(raw: unknown): LampSaid | null {
  const r = raw as { l?: unknown; e?: unknown; p?: unknown; k?: unknown } | null;
  if (!r || typeof r !== 'object') return null;
  const level = duoInt(r.l, 1, 1_000_000);
  const e = duoInt(r.e, 0, 1_000_000_000);
  const pos = duoInt(r.p, 0, 999);
  const keys = duoInt(r.k, 0, 255);
  return level === null || e === null || pos === null || keys === null ? null : { level, e, pos, keys };
}
