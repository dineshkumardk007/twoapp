// Cosy Homes: the one-player puzzle on Canvas of Us (components/CosyHomes).
//
// A square board cut into coloured homes, as many as it has rows. One friend
// - a bear or a bunny - goes in every row, every column and every home, and
// no two friends may touch, not even at the corners.
//
// Nothing is stored for a level but its number: the board is made from that
// number, the same on every phone, so level 37 is the same puzzle for you
// both. Every board made here has exactly one answer, and one that can be
// reasoned out a square at a time (`grade`), never guessed.

/** How many numbered levels there are. */
export const HOMES_LEVELS = 1000;
export const HOMES_MIN = 5;
export const HOMES_MAX = 9;

/** Changing how boards are made changes every level: this says which making they are from. */
const MAKING = 1;

/** The levels in order of board size: small boards first. */
export const HOMES_WORLDS: ReadonlyArray<{ n: number; from: number; to: number }> = [
  { n: 5, from: 1, to: 60 },
  { n: 6, from: 61, to: 200 },
  { n: 7, from: 201, to: 420 },
  { n: 8, from: 421, to: 700 },
  { n: 9, from: 701, to: HOMES_LEVELS }
];

export const worldOf = (level: number) => HOMES_WORLDS.find(w => level >= w.from && level <= w.to) ?? HOMES_WORLDS[HOMES_WORLDS.length - 1];

export interface HomesPuzzle {
  /** Squares along a side. */
  n: number;
  /** Which home each square is in, row by row: 0 to n-1. */
  homes: number[];
  /** The answer: for each row, the column its friend is in. */
  answer: number[];
  /** How hard it is to reason out: the deepest step it needs, then how many of them. */
  hard: number;
}

// ------------------------------------------------------------- making a board

/** The same numbers from the same seed, on every phone. */
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

/** An answer first: a friend in every row and column, none touching. */
function someAnswer(n: number, roll: () => number): number[] | null {
  const cols: number[] = new Array(n).fill(-1);
  const used: boolean[] = new Array(n).fill(false);
  const place = (r: number): boolean => {
    if (r === n) return true;
    const order = Array.from({ length: n }, (_, c) => c);
    for (let i = n - 1; i > 0; i--) {
      const j = pick(roll, i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const c of order) {
      if (used[c] || (r > 0 && Math.abs(c - cols[r - 1]) < 2)) continue;
      used[c] = true;
      cols[r] = c;
      if (place(r + 1)) return true;
      used[c] = false;
    }
    return false;
  };
  return place(0) ? cols : null;
}

const SIDES: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

/** The squares beside this one: up, down, left and right. */
function beside(n: number, cell: number): number[] {
  const r = Math.floor(cell / n);
  const c = cell % n;
  const out: number[] = [];
  for (const [dr, dc] of SIDES) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
  }
  return out;
}

/** Then a home grown round each friend, some greedier than others, until the board is full. */
function growHomes(n: number, answer: number[], roll: () => number): number[] {
  const homes: number[] = new Array(n * n).fill(-1);
  for (let r = 0; r < n; r++) homes[r * n + answer[r]] = r;
  const greed = Array.from({ length: n }, () => 0.25 + roll() * roll() * 3);
  for (let left = n * n - n; left > 0; left--) {
    const edge: number[][] = Array.from({ length: n }, () => []);
    for (let cell = 0; cell < n * n; cell++) {
      if (homes[cell] !== -1) continue;
      const seen: number[] = [];
      for (const b of beside(n, cell)) {
        const h = homes[b];
        if (h !== -1 && !seen.includes(h)) {
          seen.push(h);
          edge[h].push(cell);
        }
      }
    }
    let total = 0;
    for (let h = 0; h < n; h++) if (edge[h].length) total += greed[h];
    let at = roll() * total;
    let chosen = -1;
    for (let h = 0; h < n; h++) {
      if (!edge[h].length) continue;
      chosen = h;
      at -= greed[h];
      if (at < 0) break;
    }
    homes[edge[chosen][pick(roll, edge[chosen].length)]] = chosen;
  }
  return homes;
}

/** Every answer a board has, up to `limit` of them. */
export function answersOf(n: number, homes: number[], limit: number): number[][] {
  const found: number[][] = [];
  const cols: number[] = new Array(n).fill(-1);
  const colUsed: boolean[] = new Array(n).fill(false);
  const homeUsed: boolean[] = new Array(n).fill(false);
  const place = (r: number) => {
    if (r === n) {
      found.push(cols.slice());
      return;
    }
    for (let c = 0; c < n && found.length < limit; c++) {
      const h = homes[r * n + c];
      if (colUsed[c] || homeUsed[h] || (r > 0 && Math.abs(c - cols[r - 1]) < 2)) continue;
      colUsed[c] = true;
      homeUsed[h] = true;
      cols[r] = c;
      place(r + 1);
      colUsed[c] = false;
      homeUsed[h] = false;
    }
  };
  place(0);
  return found;
}

/** Whether a home is still in one piece without this square. */
function holdsTogether(n: number, homes: number[], home: number, without: number, from: number): boolean {
  let size = 0;
  for (let cell = 0; cell < n * n; cell++) if (homes[cell] === home && cell !== without) size++;
  const seen = new Set<number>([from]);
  const queue = [from];
  while (queue.length) {
    const cell = queue.pop()!;
    for (const b of beside(n, cell)) {
      if (b === without || homes[b] !== home || seen.has(b)) continue;
      seen.add(b);
      queue.push(b);
    }
  }
  return seen.size === size;
}

/**
 * Homes moved a square at a time until only the one answer is left: wherever
 * another answer puts a friend, that square is given to the home next door,
 * which then has two in that answer.
 */
function onlyOneAnswer(n: number, homes: number[], answer: number[], roll: () => number): boolean {
  for (let turn = 0; turn < 240; turn++) {
    const other = answersOf(n, homes, 2).find(a => a.some((c, r) => c !== answer[r]));
    if (!other) return true;
    const moves: Array<[number, number]> = [];
    for (let r = 0; r < n; r++) {
      if (other[r] === answer[r]) continue;
      const cell = r * n + other[r];
      const home = homes[cell];
      if (!holdsTogether(n, homes, home, cell, home * n + answer[home])) continue;
      const to: number[] = [];
      for (const b of beside(n, cell)) if (homes[b] !== home && !to.includes(homes[b])) to.push(homes[b]);
      for (const h of to) moves.push([cell, h]);
    }
    if (!moves.length) return false;
    const [cell, to] = moves[pick(roll, moves.length)];
    homes[cell] = to;
  }
  return false;
}

// ---------------------------------------------------- reasoning a board out

/** A row, a column or a home: each must end with exactly one friend. */
export type LineKind = 'row' | 'col' | 'home';

interface Reasoning {
  n: number;
  homes: number[];
  /** Whether a friend may still go on each square. */
  can: boolean[];
  placed: boolean[];
  /** Rows, then columns, then homes: whether each has its friend. */
  done: boolean[];
}

const lineOf = (n: number, kind: LineKind, index: number) => (kind === 'row' ? index : kind === 'col' ? n + index : 2 * n + index);

function begin(n: number, homes: number[]): Reasoning {
  return { n, homes, can: new Array(n * n).fill(true), placed: new Array(n * n).fill(false), done: new Array(3 * n).fill(false) };
}

/** A friend goes down: its row, column, home and the squares round it are closed to the rest. */
function put(s: Reasoning, cell: number) {
  const { n, homes } = s;
  const r = Math.floor(cell / n);
  const c = cell % n;
  s.placed[cell] = true;
  s.done[r] = true;
  s.done[n + c] = true;
  s.done[2 * n + homes[cell]] = true;
  for (let i = 0; i < n * n; i++) {
    const rr = Math.floor(i / n);
    const cc = i % n;
    if (rr === r || cc === c || homes[i] === homes[cell] || (Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1)) s.can[i] = false;
  }
}

/** The squares of a row, column or home a friend may still go on. */
function open(s: Reasoning, line: number): number[] {
  const { n, homes, can } = s;
  const out: number[] = [];
  if (line < n) {
    for (let c = 0; c < n; c++) if (can[line * n + c]) out.push(line * n + c);
  } else if (line < 2 * n) {
    for (let r = 0; r < n; r++) if (can[r * n + (line - n)]) out.push(r * n + (line - n));
  } else {
    for (let i = 0; i < n * n; i++) if (homes[i] === line - 2 * n && can[i]) out.push(i);
  }
  return out;
}

export interface Forced {
  cell: number;
  kind: LineKind;
}

/** A row, column or home with one square left: its friend goes there. */
function forced(s: Reasoning): Forced | null {
  const { n } = s;
  // Homes first: the colour is what the eye finds first.
  for (const kind of ['home', 'row', 'col'] as LineKind[]) {
    for (let i = 0; i < n; i++) {
      const line = lineOf(n, kind, i);
      if (s.done[line]) continue;
      const cells = open(s, line);
      if (cells.length === 1) return { cell: cells[0], kind };
    }
  }
  return null;
}

/**
 * Rows `from` to `to` (or columns) and the homes that can only be there. As
 * many homes as rows: the rows are theirs, and closed to every other home.
 * And the other way: the rows can only be filled from as many homes as there
 * are rows, so those homes are closed everywhere else.
 */
function bands(s: Reasoning, span: number): boolean {
  const { n, homes, can } = s;
  let changed = false;
  for (const across of [true, false]) {
    const along = (cell: number) => (across ? Math.floor(cell / n) : cell % n);
    for (let from = 0; from + span <= n; from++) {
      const to = from + span - 1;
      let rows = 0;
      for (let i = from; i <= to; i++) if (!s.done[across ? i : n + i]) rows++;
      if (!rows) continue;
      const inside: boolean[] = new Array(n).fill(false);
      const outside: boolean[] = new Array(n).fill(false);
      for (let cell = 0; cell < n * n; cell++) {
        if (!can[cell]) continue;
        const a = along(cell);
        if (a >= from && a <= to) inside[homes[cell]] = true;
        else outside[homes[cell]] = true;
      }
      const only: number[] = [];
      const any: number[] = [];
      for (let h = 0; h < n; h++) {
        if (s.done[2 * n + h] || !inside[h]) continue;
        any.push(h);
        if (!outside[h]) only.push(h);
      }
      if (only.length === rows) {
        for (let cell = 0; cell < n * n; cell++) {
          const a = along(cell);
          if (can[cell] && a >= from && a <= to && !only.includes(homes[cell])) {
            can[cell] = false;
            changed = true;
          }
        }
      }
      if (any.length === rows) {
        for (let cell = 0; cell < n * n; cell++) {
          const a = along(cell);
          if (can[cell] && (a < from || a > to) && any.includes(homes[cell])) {
            can[cell] = false;
            changed = true;
          }
        }
      }
    }
  }
  return changed;
}

/** A square that, with a friend on it, would leave some row, column or home with nowhere to put its own. */
function starves(s: Reasoning, follow: boolean): boolean {
  const { n } = s;
  let changed = false;
  for (let cell = 0; cell < n * n; cell++) {
    if (!s.can[cell]) continue;
    const t: Reasoning = { ...s, can: s.can.slice(), placed: s.placed.slice(), done: s.done.slice() };
    put(t, cell);
    let dead = false;
    for (;;) {
      for (let line = 0; line < 3 * n && !dead; line++) if (!t.done[line] && open(t, line).length === 0) dead = true;
      if (dead || !follow) break;
      const next = forced(t);
      if (!next) break;
      put(t, next.cell);
    }
    if (dead) {
      s.can[cell] = false;
      changed = true;
    }
  }
  return changed;
}

/** The next friend that can be reasoned out, and how deep the reasoning went: 1 for a single square left. */
function nextStep(s: Reasoning): (Forced & { depth: number }) | null {
  let depth = 1;
  for (;;) {
    const f = forced(s);
    if (f) return { ...f, depth };
    if (bands(s, 1)) {
      depth = Math.max(depth, 2);
      continue;
    }
    let moved = false;
    for (let span = 2; span < s.n && !moved; span++) moved = bands(s, span);
    if (moved) {
      depth = Math.max(depth, 3);
      continue;
    }
    if (starves(s, false)) {
      depth = Math.max(depth, 4);
      continue;
    }
    if (starves(s, true)) {
      depth = Math.max(depth, 5);
      continue;
    }
    return null;
  }
}

/**
 * How hard a board is to reason out, or null when it cannot be done without
 * guessing: the deepest step it takes, then how many of the steps were not
 * the simplest kind.
 */
export function grade(n: number, homes: number[]): number | null {
  const s = begin(n, homes);
  let deepest = 1;
  let deep = 0;
  for (let placed = 0; placed < n; placed++) {
    const step = nextStep(s);
    if (!step) return null;
    if (step.depth > 1) deep++;
    deepest = Math.max(deepest, step.depth);
    put(s, step.cell);
  }
  return deepest * 100 + deep;
}

/** One board from a seed, or null when this seed does not come out well. */
function attempt(n: number, seed: number): HomesPuzzle | null {
  const roll = dice(seed);
  const answer = someAnswer(n, roll);
  if (!answer) return null;
  const homes = growHomes(n, answer, roll);
  if (!onlyOneAnswer(n, homes, answer, roll)) return null;
  // Too many homes of one square and there is nothing left to work out.
  const sizes: number[] = new Array(n).fill(0);
  for (const h of homes) sizes[h]++;
  if (sizes.filter(size => size === 1).length > (n <= 6 ? 1 : 2)) return null;
  const hard = grade(n, homes);
  if (hard === null || hard >= 600) return null;
  return { n, homes, answer, hard };
}

/** How many boards a level is chosen from: the easier of them early in a size, the harder late. */
const CHOICE = 3;

const made = new Map<string, HomesPuzzle>();

function make(n: number, seed: number, choice: number, pickAt: number): HomesPuzzle {
  const key = `${n}:${seed}:${choice}:${pickAt}`;
  const held = made.get(key);
  if (held) return held;
  const found: HomesPuzzle[] = [];
  for (let i = 0; found.length < choice && i < 400; i++) {
    const p = attempt(n, (Math.imul(seed, 2654435761) + Math.imul(i + 1, 40503) + MAKING * 977 + n) >>> 0);
    if (p) found.push(p);
  }
  if (!found.length) throw new Error('no board could be made');
  // Steady when two are as hard as each other: the one made first comes first.
  const sorted = found.map((p, i) => ({ p, i })).sort((a, b) => a.p.hard - b.p.hard || a.i - b.i);
  const puzzle = sorted[Math.min(sorted.length - 1, pickAt)].p;
  if (made.size > 40) made.clear();
  made.set(key, puzzle);
  return puzzle;
}

/** Forgets the boards already made (for the tests). */
export function forgetBoardsForTest() {
  made.clear();
}

/** The board of a numbered level: the same on every phone. */
export function levelPuzzle(level: number): HomesPuzzle {
  const l = Math.max(1, Math.min(HOMES_LEVELS, Math.floor(level)));
  const w = worldOf(l);
  const through = (l - w.from) / (w.to - w.from + 1);
  return make(w.n, l, CHOICE, Math.min(CHOICE - 1, Math.floor(through * CHOICE)));
}

/** A board for Free play, from a seed of its own. */
export function freePuzzle(n: number, seed: number): HomesPuzzle {
  const size = Math.max(HOMES_MIN, Math.min(HOMES_MAX, Math.floor(n)));
  return make(size, (seed >>> 0) + 5_000_000, 1, 0);
}

// ---------------------------------------------------------------- the board

/** What is on a square: nothing, a cross (no friend goes here) or a friend. */
export const EMPTY = '0';
export const CROSS = '1';
export const FRIEND = '2';

export const emptyBoard = (n: number) => EMPTY.repeat(n * n);

/** A board as it was kept, if it is one for this size. */
export function cleanBoard(raw: unknown, n: number): string | null {
  return typeof raw === 'string' && raw.length === n * n && /^[012]*$/.test(raw) ? raw : null;
}

export const setCell = (cells: string, cell: number, to: string) => cells.slice(0, cell) + to + cells.slice(cell + 1);

/** A tap: nothing, then a cross, then a friend, then nothing again. */
export function tapped(cells: string, cell: number): string {
  const now = cells[cell];
  return setCell(cells, cell, now === EMPTY ? CROSS : now === CROSS ? FRIEND : EMPTY);
}

/**
 * A finger drawn across the board: crosses put on the empty squares it passes
 * (`cross`), or crosses rubbed out (`rub`). A friend is never changed by it.
 */
export function painted(cells: string, cell: number, mode: 'cross' | 'rub'): string {
  if (mode === 'cross') return cells[cell] === EMPTY ? setCell(cells, cell, CROSS) : cells;
  return cells[cell] === CROSS ? setCell(cells, cell, EMPTY) : cells;
}

/** The squares from one to another in a straight line, the first left out: a fast finger skips some. */
export function lineBetween(from: number, to: number, n: number): number[] {
  const r0 = Math.floor(from / n);
  const c0 = from % n;
  const r1 = Math.floor(to / n);
  const c1 = to % n;
  const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
  const out: number[] = [];
  for (let i = 1; i <= steps; i++) out.push(Math.round(r0 + ((r1 - r0) * i) / steps) * n + Math.round(c0 + ((c1 - c0) * i) / steps));
  return out;
}

export const friendsOn = (cells: string) => {
  let count = 0;
  for (const ch of cells) if (ch === FRIEND) count++;
  return count;
};

/** The friends that break a rule: two in a row, a column or a home, or two touching. */
export function clashes(p: HomesPuzzle, cells: string): boolean[] {
  const { n, homes } = p;
  const bad: boolean[] = new Array(n * n).fill(false);
  const at: number[] = [];
  for (let i = 0; i < n * n; i++) if (cells[i] === FRIEND) at.push(i);
  for (let i = 0; i < at.length; i++) {
    for (let j = i + 1; j < at.length; j++) {
      const a = at[i];
      const b = at[j];
      const dr = Math.abs(Math.floor(a / n) - Math.floor(b / n));
      const dc = Math.abs((a % n) - (b % n));
      if (dr === 0 || dc === 0 || homes[a] === homes[b] || (dr <= 1 && dc <= 1)) {
        bad[a] = true;
        bad[b] = true;
      }
    }
  }
  return bad;
}

/** Done: as many friends as rows, and none breaking a rule. There is only the one way to do that. */
export function solved(p: HomesPuzzle, cells: string): boolean {
  return friendsOn(cells) === p.n && !clashes(p, cells).some(Boolean);
}

export type Hint =
  /** A friend that is not where the answer has one. */
  | { kind: 'wrong'; cell: number }
  /** The only square left in its row, column or home. */
  | { kind: 'only'; cell: number; line: LineKind }
  /** Where a friend goes, when the reason is longer than a line. */
  | { kind: 'here'; cell: number };

/** What to look at next, from the friends placed so far. The crosses are yours and are not trusted. */
export function hintFor(p: HomesPuzzle, cells: string): Hint | null {
  const { n, homes, answer } = p;
  for (let i = 0; i < n * n; i++) if (cells[i] === FRIEND && answer[Math.floor(i / n)] !== i % n) return { kind: 'wrong', cell: i };
  const s = begin(n, homes);
  for (let i = 0; i < n * n; i++) if (cells[i] === FRIEND) put(s, i);
  const step = nextStep(s);
  if (step) return step.depth === 1 ? { kind: 'only', cell: step.cell, line: step.kind } : { kind: 'here', cell: step.cell };
  for (let r = 0; r < n; r++) if (cells[r * n + answer[r]] !== FRIEND) return { kind: 'here', cell: r * n + answer[r] };
  return null;
}

// ---------------------------------------------------------------- the stars

/** A good time for a board of each size, in seconds. */
const PAR: Record<number, number> = { 5: 60, 6: 100, 7: 160, 8: 240, 9: 360 };

export const parSeconds = (n: number) => PAR[n] ?? 360;

/** Three stars for a good time with no hints; one less for each hint, and for being slow. Never fewer than one. */
export function starsFor(n: number, ms: number, hints: number): number {
  const par = parSeconds(n) * 1000;
  const slow = ms > par * 2.5 ? 2 : ms > par ? 1 : 0;
  return Math.max(1, 3 - slow - Math.max(0, hints));
}

/** The stars on every level finished, a digit a level: '3', '2', '1', or '0' for one not done. */
export interface HomesBook {
  stars: string;
  /** When it last changed. */
  at: number;
}

export const HOMES_RECORD = 'GAME_HOMES';

const trimmed = (stars: string) => stars.replace(/0+$/, '');

export function cleanHomes(raw: unknown): HomesBook | null {
  const r = raw as { stars?: unknown; at?: unknown } | null;
  if (!r || typeof r.stars !== 'string' || r.stars.length > HOMES_LEVELS || !/^[0-3]*$/.test(r.stars)) return null;
  const at = Number(r.at);
  return { stars: trimmed(r.stars), at: Number.isFinite(at) && at > 0 ? at : 0 };
}

export const starsAt = (book: HomesBook | undefined, level: number) => Number(book?.stars[level - 1] ?? 0) || 0;

/** The best of two copies, level by level. The one held is handed back when the other adds nothing. */
export function mergeHomes(held: HomesBook | undefined, other: HomesBook | undefined): HomesBook | undefined {
  if (!other) return held;
  if (!held) return other;
  const length = Math.max(held.stars.length, other.stars.length);
  let stars = '';
  for (let i = 0; i < length; i++) stars += (held.stars[i] ?? '0') >= (other.stars[i] ?? '0') ? (held.stars[i] ?? '0') : other.stars[i];
  stars = trimmed(stars);
  return stars === held.stars ? held : { stars, at: Math.max(held.at, other.at) };
}

/** A level finished: its stars kept if they are the best yet. */
export function withStars(book: HomesBook | undefined, level: number, stars: number, at: number): HomesBook {
  if (level < 1 || level > HOMES_LEVELS) return book ?? { stars: '', at };
  const base = (book?.stars ?? '').padEnd(level, '0');
  const best = Math.max(Number(base[level - 1]) || 0, Math.max(1, Math.min(3, Math.floor(stars))));
  const next = trimmed(base.slice(0, level - 1) + String(best) + base.slice(level));
  return book && next === book.stars ? book : { stars: next, at };
}

/** The level you are on: the first one not finished. */
export function levelOn(book: HomesBook | undefined): number {
  const stars = book?.stars ?? '';
  const gap = stars.indexOf('0');
  return Math.min(HOMES_LEVELS, (gap === -1 ? stars.length : gap) + 1);
}

/** A level opens when the one before it is finished. */
export const levelOpen = (book: HomesBook | undefined, level: number) => level === 1 || starsAt(book, level - 1) > 0;

export const totalStars = (book: HomesBook | undefined) => {
  let sum = 0;
  for (const ch of book?.stars ?? '') sum += Number(ch) || 0;
  return sum;
};

export const levelsDone = (book: HomesBook | undefined) => {
  let count = 0;
  for (const ch of book?.stars ?? '') if (ch !== '0') count++;
  return count;
};

/** Every level finished. */
export const allDone = (book: HomesBook | undefined) => levelsDone(book) >= HOMES_LEVELS;

// --------------------------------------------- a board left part way through

export interface HomesSave {
  cells: string;
  /** Time on the clock so far. */
  ms: number;
  hints: number;
  /** Free play: which board it is. */
  seed?: number;
  at: number;
}

const SAVES_KEY = 'two_homes_boards';
const SAVES_KEPT = 8;

function saves(): Record<string, HomesSave> {
  try {
    const all = JSON.parse(localStorage.getItem(SAVES_KEY) || '{}');
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

/** `slot` is "l37" for level 37, "f7" for Free play at 7 by 7. */
export function savedBoard(slot: string, n: number): HomesSave | null {
  const s = saves()[slot];
  const cells = cleanBoard(s?.cells, n);
  if (!s || !cells) return null;
  const seed = Number(s.seed);
  return {
    cells,
    ms: Math.max(0, Number(s.ms) || 0),
    hints: Math.max(0, Math.floor(Number(s.hints) || 0)),
    ...(Number.isFinite(seed) && seed > 0 ? { seed } : {}),
    at: Number(s.at) || 0
  };
}

export function saveBoard(slot: string, save: HomesSave | null) {
  try {
    const all = saves();
    if (save) all[slot] = save;
    else delete all[slot];
    const kept = Object.entries(all)
      .sort((a, b) => (Number(b[1]?.at) || 0) - (Number(a[1]?.at) || 0))
      .slice(0, SAVES_KEPT);
    localStorage.setItem(SAVES_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    /* a board that cannot be kept starts again next time */
  }
}
