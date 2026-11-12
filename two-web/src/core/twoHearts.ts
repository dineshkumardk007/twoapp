// Two Hearts: the maze for the two of you, on the same side (components/TwoHearts).
//
// A bear and a bunny in one maze, each moved from its own phone. A door opens
// only while somebody stands on the button of its colour - and the button is
// never beside its own door, so it is always the other one who holds it open
// for you. The level is done when both are home.
//
// Each phone says only where its own one is (`MazeHalf`), so the two can walk
// at the same moment and nothing either says can undo the other. A level is
// made from its number, the same on both phones, and every one made here can
// be finished - and only by the two of you together (`solve`).

import type { Seat } from './usTwo';

/** Changing how levels are made changes every level: both phones must make them the same way. */
export const MAZE_MAKING = 1;
/** A phone that has this game, made this way (said with its version, App's CAN_DO). */
export const CAN_MAZE = `maze-${MAZE_MAKING}`;
/** Where each one is, kept on the relay: the newest from each of you. */
export const MAZE_RECORD = 'GAME_MAZE';
/** The same as it happens, and the signs you make to each other: kept nowhere. */
export const MAZE_SIGNAL = 'GAME_MAZE_LIVE';

export interface MazeDoor {
  /** The two squares it stands between. */
  a: number;
  b: number;
  /** The square of its button. */
  plate: number;
}

export interface MazeLevel {
  w: number;
  h: number;
  /** For each square, the squares it opens on to: up, down, left, right; -1 where there is a wall. */
  links: number[][];
  /** The door in each of those openings, or -1. */
  gates: number[][];
  doors: MazeDoor[];
  /** Where each starts and where each has to get to: the bear's, then the bunny's. */
  start: [number, number];
  home: [number, number];
  /** Hearts to pick up on the way, by either of you. */
  hearts: number[];
  /** The fewest steps the two of you need between you. */
  steps: number;
  hard: number;
}

/** The bear is whoever sits in the first seat, as everywhere in Two. */
export const whoIs = (seat: Seat): 0 | 1 => (seat === 'user' ? 0 : 1);

// ------------------------------------------------------------ making a level

function dice(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (roll: () => number, count: number) => Math.min(count - 1, Math.floor(roll() * count));

const STEP: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];
/** The way back from each of those. */
const BACK = [1, 0, 3, 2];

/** A maze with one way, and only one, between any two squares. */
function carve(w: number, h: number, roll: () => number): number[][] {
  const links: number[][] = Array.from({ length: w * h }, () => [-1, -1, -1, -1]);
  const seen: boolean[] = new Array(w * h).fill(false);
  const stack = [pick(roll, w * h)];
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
    const d = ways[pick(roll, ways.length)];
    const next = (r + STEP[d][0]) * w + (c + STEP[d][1]);
    links[cell][d] = next;
    links[next][BACK[d]] = cell;
    seen[next] = true;
    stack.push(next);
  }
  return links;
}

/** The one way from a square to another, through the open maze: the squares after the first. */
function wayThrough(links: number[][], from: number, to: number): number[] {
  const came: number[] = new Array(links.length).fill(-2);
  came[from] = -1;
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if (cell === to) break;
    for (const next of links[cell]) {
      if (next < 0 || came[next] !== -2) continue;
      came[next] = cell;
      queue.push(next);
    }
  }
  const out: number[] = [];
  for (let cell = to; cell !== from && cell >= 0; cell = came[cell]) out.unshift(cell);
  return out;
}

/** Whether a step may be taken: there is an opening, and any door in it is held open by the other one. */
export function canStep(level: MazeLevel, from: number, to: number, other: number): boolean {
  const d = level.links[from]?.indexOf(to) ?? -1;
  if (to < 0 || d < 0) return false;
  const gate = level.gates[from][d];
  return gate < 0 || level.doors[gate].plate === other;
}

/** The doors as they stand: open while either of you is on its button. */
export function openDoors(level: MazeLevel, bear: number, bunny: number): boolean[] {
  return level.doors.map(door => door.plate === bear || door.plate === bunny);
}

/** The shortest walk from a square to another as things stand, the other one staying put: the squares after the first, or none. */
export function walkTo(level: MazeLevel, from: number, to: number, other: number): number[] {
  if (from === to || to < 0 || to >= level.links.length) return [];
  const came: number[] = new Array(level.links.length).fill(-2);
  came[from] = -1;
  const queue = [from];
  for (let i = 0; i < queue.length && came[to] === -2; i++) {
    const cell = queue[i];
    for (const next of level.links[cell]) {
      if (next < 0 || came[next] !== -2 || !canStep(level, cell, next, other)) continue;
      came[next] = cell;
      queue.push(next);
    }
  }
  if (came[to] === -2) return [];
  const out: number[] = [];
  for (let cell = to; cell !== from; cell = came[cell]) out.unshift(cell);
  return out;
}

export interface Solved {
  /** The fewest steps between you to get both home, or -1 when it cannot be done. */
  steps: number;
  /** How many times a door is gone through on that way. */
  crossings: number;
  /** The squares each of you can ever get to. */
  reach: [boolean[], boolean[]];
}

/** Every place the two of you can be, from the start: whether both can get home, and how soon. */
export function solve(level: MazeLevel): Solved {
  const n = level.links.length;
  const dist = new Int32Array(n * n).fill(-1);
  const through = new Int32Array(n * n);
  const first = level.start[0] * n + level.start[1];
  const goal = level.home[0] * n + level.home[1];
  dist[first] = 0;
  const queue = [first];
  const reach: [boolean[], boolean[]] = [new Array(n).fill(false), new Array(n).fill(false)];
  for (let i = 0; i < queue.length; i++) {
    const state = queue[i];
    const bear = Math.floor(state / n);
    const bunny = state % n;
    reach[0][bear] = true;
    reach[1][bunny] = true;
    for (let d = 0; d < 4; d++) {
      const a = level.links[bear][d];
      if (a >= 0 && canStep(level, bear, a, bunny)) {
        const next = a * n + bunny;
        if (dist[next] < 0) {
          dist[next] = dist[state] + 1;
          through[next] = through[state] + (level.gates[bear][d] >= 0 ? 1 : 0);
          queue.push(next);
        }
      }
      const b = level.links[bunny][d];
      if (b >= 0 && canStep(level, bunny, b, bear)) {
        const next = bear * n + b;
        if (dist[next] < 0) {
          dist[next] = dist[state] + 1;
          through[next] = through[state] + (level.gates[bunny][d] >= 0 ? 1 : 0);
          queue.push(next);
        }
      }
    }
  }
  return { steps: dist[goal], crossings: dist[goal] < 0 ? 0 : through[goal], reach };
}

/** Whether one of you could get home with nobody to hold a door. */
export function aloneHome(level: MazeLevel, who: 0 | 1): boolean {
  const seen: boolean[] = new Array(level.links.length).fill(false);
  const queue = [level.start[who]];
  seen[queue[0]] = true;
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    if (cell === level.home[who]) return true;
    for (let d = 0; d < 4; d++) {
      const next = level.links[cell][d];
      if (next < 0 || seen[next] || level.gates[cell][d] >= 0) continue;
      seen[next] = true;
      queue.push(next);
    }
  }
  return false;
}

interface Shape {
  w: number;
  h: number;
  doors: number;
}

/** One level from a seed, or null when this seed does not come out well. */
function attempt(shape: Shape, seed: number): MazeLevel | null {
  const { w, h } = shape;
  const roll = dice(seed);
  const links = carve(w, h, roll);
  const n = w * h;
  // They start along the bottom and live along the top, apart from each other.
  const bottom = Array.from({ length: w }, (_, c) => (h - 1) * w + c);
  const top = Array.from({ length: w }, (_, c) => c);
  const two = (from: number[]): [number, number] => {
    const a = pick(roll, from.length);
    let b = pick(roll, from.length - 1);
    if (b >= a) b++;
    return [from[a], from[b]];
  };
  const start = two(bottom);
  const home = two(top);

  // Each door goes on the one way home of one of you, so that one cannot do without it.
  const ways = [wayThrough(links, start[0], home[0]), wayThrough(links, start[1], home[1])];
  const doors: MazeDoor[] = [];
  const owner: number[] = [];
  const taken = new Set<string>();
  for (let i = 0; i < shape.doors; i++) {
    // Turn about, the bear's way first, so with two doors or more each of you needs the other.
    const way = ways[i % 2];
    const from = [start[i % 2], ...way];
    let placed = false;
    for (let tries = 0; tries < 12 && !placed; tries++) {
      const at = pick(roll, way.length);
      const a = from[at];
      const b = from[at + 1];
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (taken.has(key)) continue;
      taken.add(key);
      doors.push({ a, b, plate: -1 });
      owner.push(i % 2);
      placed = true;
    }
    if (!placed) return null;
  }
  const gates: number[][] = Array.from({ length: n }, () => [-1, -1, -1, -1]);
  doors.forEach((door, i) => {
    gates[door.a][links[door.a].indexOf(door.b)] = i;
    gates[door.b][links[door.b].indexOf(door.a)] = i;
  });

  // Then the buttons, a door at a time, from the starts outward: each goes
  // somewhere the one who has to hold it can already get to. `can` is where
  // each of you could get to so far, were the doors held whenever they can be.
  const can: [boolean[], boolean[]] = [new Array(n).fill(false), new Array(n).fill(false)];
  const spread = () => {
    for (let changed = true; changed; ) {
      changed = false;
      for (const who of [0, 1]) {
        const seen: boolean[] = new Array(n).fill(false);
        const queue = [start[who]];
        seen[start[who]] = true;
        for (let i = 0; i < queue.length; i++) {
          const cell = queue[i];
          for (let d = 0; d < 4; d++) {
            const next = links[cell][d];
            if (next < 0 || seen[next]) continue;
            const g = gates[cell][d];
            if (g >= 0 && !(doors[g].plate >= 0 && can[1 - who][doors[g].plate])) continue;
            seen[next] = true;
            queue.push(next);
          }
        }
        for (let cell = 0; cell < n; cell++) {
          if (seen[cell] && !can[who][cell]) {
            can[who][cell] = true;
            changed = true;
          }
        }
      }
    }
  };
  spread();
  for (let left = doors.length; left > 0; left--) {
    // The doors somebody has come up against: first those in the way of the one they were put there for.
    const own: Array<[number, number]> = [];
    const any: Array<[number, number]> = [];
    doors.forEach((door, g) => {
      if (door.plate >= 0) return;
      for (const who of [0, 1]) if (can[who][door.a] !== can[who][door.b]) (who === owner[g] ? own : any).push([g, who]);
    });
    const met = own.length ? own : any;
    if (!met.length) return null;
    const [g, who] = met[pick(roll, met.length)];
    const spots: number[] = [];
    for (let cell = 0; cell < n; cell++) {
      if (!can[1 - who][cell] || cell === doors[g].a || cell === doors[g].b || start.includes(cell) || home.includes(cell)) continue;
      if (doors.some(door => door.plate === cell)) continue;
      spots.push(cell);
    }
    if (!spots.length) return null;
    doors[g].plate = spots[pick(roll, spots.length)];
    spread();
  }
  const level: MazeLevel = { w, h, links, gates, doors, start, home, hearts: [], steps: 0, hard: 0 };

  const solved = solve(level);
  if (solved.steps < 0) return null;
  // Not over before it has begun.
  if (solved.steps < w + h) return null;
  if (shape.doors >= 2 && (aloneHome(level, 0) || aloneHome(level, 1))) return null;
  if (shape.doors === 1 && aloneHome(level, 0)) return null;

  // Hearts where somebody can get to them, off the beaten track where there is such a place.
  const special = new Set<number>([...start, ...home, ...doors.map(door => door.plate)]);
  const free: number[] = [];
  const ends: number[] = [];
  for (let cell = 0; cell < n; cell++) {
    if (special.has(cell) || !(solved.reach[0][cell] || solved.reach[1][cell])) continue;
    (links[cell].filter(next => next >= 0).length === 1 ? ends : free).push(cell);
  }
  const hearts: number[] = [];
  for (const from of [ends, free]) {
    while (hearts.length < 3 && from.length) hearts.push(from.splice(pick(roll, from.length), 1)[0]);
  }
  if (hearts.length < 3) return null;
  level.hearts = hearts;
  level.steps = solved.steps;
  level.hard = solved.crossings * 25 + solved.steps;
  return level;
}

/** The size of a level and how many doors it has: small and simple first. */
export function shapeOf(level: number): Shape & { from: number; to: number } {
  if (level <= 3) return { w: 5, h: 6, doors: 1, from: 1, to: 3 };
  if (level <= 12) return { w: 5, h: 7, doors: 2, from: 4, to: 12 };
  if (level <= 24) return { w: 6, h: 8, doors: 2, from: 13, to: 24 };
  if (level <= 40) return { w: 6, h: 8, doors: 3, from: 25, to: 40 };
  if (level <= 80) return { w: 7, h: 9, doors: 3, from: 41, to: 80 };
  if (level <= 150) return { w: 7, h: 9, doors: 4, from: 81, to: 150 };
  return { w: 8, h: 10, doors: 4, from: 151, to: 250 };
}

/** How many levels a level is chosen from: the easier of them early in a size, the harder late. */
const CHOICE = 3;
const made = new Map<number, MazeLevel>();

/** Forgets the levels already made (for the tests). */
export function forgetMazesForTest() {
  made.clear();
}

/** The maze of a level: the same on both phones. There is no last level. */
export function mazeOf(levelNumber: number): MazeLevel {
  const l = Math.max(1, Math.floor(levelNumber) || 1);
  const held = made.get(l);
  if (held) return held;
  const shape = shapeOf(l);
  const found: MazeLevel[] = [];
  for (let doors = shape.doors; doors >= 0 && !found.length; doors--) {
    for (let i = 0; found.length < CHOICE && i < 600; i++) {
      const maze = attempt({ ...shape, doors }, (Math.imul(l, 2654435761) + Math.imul(i + 1, 40503) + MAZE_MAKING * 7919 + doors) >>> 0);
      if (maze) found.push(maze);
    }
  }
  if (!found.length) throw new Error('no maze could be made');
  const sorted = found.map((maze, i) => ({ maze, i })).sort((a, b) => a.maze.hard - b.maze.hard || a.i - b.i);
  const through = Math.min(0.999, (l - shape.from) / (shape.to - shape.from + 1));
  const maze = sorted[Math.min(sorted.length - 1, Math.floor(through * CHOICE))].maze;
  if (made.size > 30) made.clear();
  made.set(l, maze);
  return maze;
}

// ---------------------------------------------------- where each of you is

/** The square of one who has only just come to a level: wherever that level starts it. */
export const NOWHERE = 999;

/** What one phone says about its own one. */
export interface MazeHalf {
  /** How its levels are made: another making is another game. */
  v: number;
  /** The level it is on. */
  level: number;
  /** Its square there. */
  pos: number;
  /** The hearts it has picked up there: a bit for each. */
  got: number;
  /** Counts up with everything it does: the later word from the same phone is the one to believe. */
  n: number;
  /** The hearts found on each level finished, a digit a level. */
  book: string;
  at: number;
}

export function cleanHalf(raw: unknown): MazeHalf | null {
  const r = raw as Partial<Record<keyof MazeHalf, unknown>> | null;
  if (!r || typeof r !== 'object') return null;
  const whole = (value: unknown, max: number) => {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number >= 0 && number <= max ? number : null;
  };
  const v = whole(r.v, 1000);
  const level = whole(r.level, 1_000_000);
  const pos = whole(r.pos, 999);
  const got = whole(r.got, 7);
  const n = whole(r.n, Number.MAX_SAFE_INTEGER);
  if (v === null || !level || pos === null || got === null || n === null) return null;
  const book = typeof r.book === 'string' && /^[0-3]*$/.test(r.book) ? r.book.slice(0, level - 1) : '';
  return { v, level, pos, got, n, book, at: Math.max(0, Number(r.at) || 0) };
}

/** Whether `b` is later word than `a` from the same phone. */
export const laterHalf = (a: MazeHalf | undefined, b: MazeHalf | undefined): boolean => !!b && (!a || b.level > a.level || (b.level === a.level && b.n > a.n));

/** The later of two words from the same phone; the one held when the other is no later. */
export const latestHalf = (held: MazeHalf | undefined, other: MazeHalf | undefined): MazeHalf | undefined => (laterHalf(held, other) ? other : held);

/** The hearts on finished levels, the most either phone knows of for each. */
export function mergeBooks(a: string, b: string): string {
  let out = '';
  for (let i = 0; i < Math.max(a.length, b.length); i++) out += (a[i] ?? '0') >= (b[i] ?? '0') ? (a[i] ?? '0') : b[i];
  return out;
}

export const heartsIn = (book: string) => {
  let sum = 0;
  for (const ch of book) sum += Number(ch) || 0;
  return sum;
};

const bits = (mask: number) => (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
export const heartsGot = bits;

export interface MazePair {
  /** The level the two of you are on: the furthest either has got. */
  level: number;
  /** Where the bear is, and the bunny. One who has not got to this level yet is at its start. */
  pos: [number, number];
  /** The hearts picked up on it, by either. */
  got: number;
  book: string;
}

/** The level the two of you are on: the furthest either has got. */
export const levelOfPair = (mine: MazeHalf | undefined, theirs: MazeHalf | undefined) => Math.max(mine?.level ?? 1, theirs?.level ?? 1);

/** The two halves put together, on the maze of the level you are on. `seat` is whose phone this is. */
export function pairOf(mine: MazeHalf | undefined, theirs: MazeHalf | undefined, seat: Seat, maze: MazeLevel): MazePair {
  const level = levelOfPair(mine, theirs);
  const me = whoIs(seat);
  const them = me === 0 ? 1 : 0;
  const on = (half: MazeHalf | undefined, who: 0 | 1) => (half && half.level === level && half.pos < maze.links.length ? half.pos : maze.start[who]);
  const pos: [number, number] = [0, 0];
  pos[me] = on(mine, me);
  pos[them] = on(theirs, them);
  const got = (mine && mine.level === level ? mine.got : 0) | (theirs && theirs.level === level ? theirs.got : 0);
  return { level, pos, got, book: mergeBooks(mine?.book ?? '', theirs?.book ?? '').slice(0, level - 1).padEnd(level - 1, '0') };
}

/** Both home. */
export const bothHome = (maze: MazeLevel, pos: [number, number]) => pos[0] === maze.home[0] && pos[1] === maze.home[1];

/**
 * This phone's half as it starts on a level. Its square is left for the maze
 * to say: one not on the board yet is taken to be at its start (`pairOf`).
 */
export function halfAt(level: number, n: number, book: string, at: number): MazeHalf {
  return { v: MAZE_MAKING, level, pos: NOWHERE, got: 0, n, book: book.slice(0, level - 1).padEnd(level - 1, '0'), at };
}

/** A step taken: where it is now, and the heart picked up there if nobody had it yet. */
export function stepped(half: MazeHalf, maze: MazeLevel, to: number, gotByEither: number, at: number): MazeHalf {
  const heart = maze.hearts.indexOf(to);
  const got = heart >= 0 && !(gotByEither & (1 << heart)) ? half.got | (1 << heart) : half.got;
  return { ...half, pos: to, got, n: half.n + 1, at };
}

/** The level finished: on to the next, with its hearts written down. */
export function moveOn(half: MazeHalf | undefined, pair: MazePair, at: number): MazeHalf {
  const book = pair.book.slice(0, pair.level - 1).padEnd(pair.level - 1, '0') + String(Math.min(3, bits(pair.got)));
  return halfAt(pair.level + 1, (half?.n ?? 0) + 1, book, at);
}

// ------------------------------------------------- as it happens, kept nowhere

/** The signs you can make to each other, in place of a call. */
export const MAZE_SIGNS = ['👋', '✋', '👍', '🤔', '❤️'] as const;

/** What goes down the unkept channel: where this one is now, or a sign. */
export interface MazeSaid {
  /** Where it is: the same as its half, without the book. */
  h?: Pick<MazeHalf, 'v' | 'level' | 'pos' | 'got' | 'n'>;
  /** A sign: its place in MAZE_SIGNS. */
  s?: number;
}

type Sender = (said: MazeSaid) => void;
let sender: Sender | null = null;
/** App gives the way out: the relay's unkept channel. */
export function setMazeSender(fn: Sender | null) {
  sender = fn;
}
export function sayMaze(said: MazeSaid) {
  try {
    sender?.(said);
  } catch {
    /* not connected: nothing to tell */
  }
}

type Listener = (said: MazeSaid) => void;
const listeners = new Set<Listener>();
/** The maze on screen listens here. Returns how to stop. */
export function onMaze(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Something from the other phone, as it arrived: only what a maze could have said is passed on. */
export function hearMaze(raw: unknown) {
  const r = raw as { h?: unknown; s?: unknown } | null;
  if (!r || typeof r !== 'object') return;
  const said: MazeSaid = {};
  if (r.h !== undefined) {
    const half = cleanHalf({ ...(r.h as object), book: '', at: 0 });
    if (half) said.h = { v: half.v, level: half.level, pos: half.pos, got: half.got, n: half.n };
  }
  const sign = Math.floor(Number(r.s));
  if (r.s !== undefined && Number.isFinite(sign) && sign >= 0 && sign < MAZE_SIGNS.length) said.s = sign;
  if (said.h === undefined && said.s === undefined) return;
  listeners.forEach(listener => {
    try {
      listener(said);
    } catch {
      /* one listener failing does not stop the rest */
    }
  });
}
