// Puzzle Duel on Canvas of Us (components/PuzzleBoard).
//
// Each round you both get the same small puzzle, and whoever solves it in
// less time takes the round. Each phone times its own - from the moment its
// puzzle appears to the moment it is solved - so how long anything takes to
// travel between you makes no difference, and neither of you has to be there
// at the same moment. A pick is that time, in thousandths of a second; as in
// Heart Hug Kiss each of you has a list of your own.
//
// The puzzles are made from the game's id and the round's number, so both
// phones make the same one without it ever being sent.

import type { Seat } from './usTwo';

/** Rounds to win: best of seven. */
export const PZ_TO_WIN = 4;
/** Level after this many rounds (ties count for nobody), it is a tie. */
export const PZ_MAX_ROUNDS = 9;
/** A puzzle not solved in this long is given up. */
export const PZ_LIMIT_MS = 45_000;
/** The pick for a puzzle given up, or run out of time on. */
export const PZ_FAIL = 60_000;

export type PzKind = 'order' | 'odd' | 'pattern' | 'sum' | 'lights';
export const PZ_KINDS: PzKind[] = ['order', 'odd', 'pattern', 'sum', 'lights'];
/** What a wrong tap costs, added to your time. */
export const PZ_PENALTY_MS: Record<PzKind, number> = { order: 1500, odd: 2000, pattern: 4000, sum: 4000, lights: 3000 };

export type Puzzle =
  | { kind: 'order'; /** The number in each of the sixteen cells. */ cells: number[] }
  | { kind: 'odd'; cols: number; /** What fills the grid, the one that differs, and where it is. */ common: string; odd: string; at: number; count: number }
  | { kind: 'pattern'; shown: number[]; options: number[]; answer: number }
  | { kind: 'sum'; text: string; options: number[]; answer: number }
  | { kind: 'lights'; /** Which of the four pads, in order. */ seq: number[] };

/** The same numbers on both phones, from the same words. */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rand: () => number, from: number, to: number) => from + Math.floor(rand() * (to - from + 1));
function shuffled<T>(list: T[], rand: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Which kind each round is: all five once, in an order of the game's own, then all five again. */
export function kindOfRound(gameId: string, round: number): PzKind {
  const lap = Math.floor(round / PZ_KINDS.length);
  return shuffled(PZ_KINDS, seeded(`${gameId}:kinds:${lap}`))[round % PZ_KINDS.length];
}

/** Pairs that look alike at a glance: the grid is full of one, with one of the other hidden in it. */
const LOOKALIKES: [string, string][] = [
  ['O', 'Q'],
  ['E', 'F'],
  ['M', 'N'],
  ['6', '9'],
  ['b', 'd'],
  ['p', 'q'],
  ['V', 'Y'],
  ['8', '3'],
  ['C', 'G'],
  ['I', 'T']
];

/** Three wrong answers near the right one, all different, and where the right one sits among them. */
function choices(right: number, rand: () => number): { options: number[]; answer: number } {
  const near = new Set<number>();
  const steps = shuffled([-10, -3, -2, -1, 1, 2, 3, 10], rand);
  for (const s of steps) {
    if (near.size >= 3) break;
    if (right + s >= 0) near.add(right + s);
  }
  const options = shuffled([right, ...near], rand);
  return { options, answer: options.indexOf(right) };
}

export function puzzleOf(gameId: string, round: number): Puzzle {
  const kind = kindOfRound(gameId, round);
  const rand = seeded(`${gameId}:puzzle:${round}`);
  switch (kind) {
    case 'order':
      return { kind, cells: shuffled(Array.from({ length: 16 }, (_, i) => i + 1), rand) };
    case 'odd': {
      const pair = LOOKALIKES[int(rand, 0, LOOKALIKES.length - 1)];
      const flip = rand() < 0.5;
      const count = 30;
      return { kind, cols: 6, common: flip ? pair[1] : pair[0], odd: flip ? pair[0] : pair[1], at: int(rand, 0, count - 1), count };
    }
    case 'pattern': {
      const way = int(rand, 0, 3);
      const start = int(rand, 2, 12);
      const list: number[] = [];
      if (way === 0) {
        // The same step each time.
        const step = int(rand, 3, 9);
        for (let i = 0; i < 6; i++) list.push(start + step * i);
      } else if (way === 1) {
        // Doubling.
        for (let i = 0; i < 6; i++) list.push(start * 2 ** i);
      } else if (way === 2) {
        // Two steps, taking turns.
        const a = int(rand, 2, 6);
        const b = int(rand, 7, 12);
        let v = start;
        for (let i = 0; i < 6; i++) {
          list.push(v);
          v += i % 2 === 0 ? a : b;
        }
      } else {
        // A step that grows by one each time.
        let v = start;
        for (let i = 0; i < 6; i++) {
          list.push(v);
          v += i + 2;
        }
      }
      return { kind, shown: list.slice(0, 5), ...choices(list[5], rand) };
    }
    case 'sum': {
      const way = int(rand, 0, 2);
      let text: string;
      let right: number;
      if (way === 0) {
        const a = int(rand, 12, 49);
        const b = int(rand, 3, 9);
        const c = int(rand, 3, 9);
        text = `${a} + ${b} × ${c}`;
        right = a + b * c;
      } else if (way === 1) {
        const a = int(rand, 40, 95);
        const b = int(rand, 12, 38);
        const c = int(rand, 6, 19);
        text = `${a} − ${b} + ${c}`;
        right = a - b + c;
      } else {
        const a = int(rand, 6, 12);
        const b = int(rand, 6, 12);
        const c = int(rand, 5, 30);
        text = `${a} × ${b} − ${c}`;
        right = a * b - c;
      }
      return { kind, text, ...choices(right, rand) };
    }
    case 'lights': {
      const seq: number[] = [];
      for (let i = 0; i < 5; i++) {
        // Never the same pad twice running: two flashes of one pad read as one.
        let next = int(rand, 0, 3);
        if (seq.length && next === seq[seq.length - 1]) next = (next + 1 + int(rand, 0, 2)) % 4;
        seq.push(next);
      }
      return { kind, seq };
    }
  }
}

/** A time as it is sent: whole thousandths, never zero, and "given up" for anything too long. */
export const asPick = (ms: number, solved: boolean) => (!solved || ms >= PZ_LIMIT_MS ? PZ_FAIL : Math.max(1, Math.min(PZ_LIMIT_MS - 1, Math.round(ms))));
export const puzzleAllowed = (pick: number) => Number.isInteger(pick) && pick >= 1 && pick <= PZ_FAIL && (pick < PZ_LIMIT_MS || pick === PZ_FAIL);

export interface PzRound {
  /** Each of you's time in ms, or PZ_FAIL. */
  time: Record<Seat, number>;
  /** Null when neither solved it, or (to the thousandth) both took as long. */
  winner: Seat | null;
}

export interface PuzzleState {
  rounds: PzRound[];
  points: Record<Seat, number>;
  toMove: Seat[];
  over: boolean;
  winner: Seat | null;
  draw: boolean;
  played: Record<Seat, number>;
}

export function playPuzzle(game: { picks?: Record<Seat, number[]> }): PuzzleState {
  const valid = (list: number[] | undefined) => {
    const out: number[] = [];
    for (const c of list || []) {
      if (!puzzleAllowed(c)) break;
      out.push(c);
    }
    return out;
  };
  const u = valid(game.picks?.user);
  const p = valid(game.picks?.partner);
  const rounds: PzRound[] = [];
  const points: Record<Seat, number> = { user: 0, partner: 0 };
  let over = false;
  let winner: Seat | null = null;
  let draw = false;
  for (let r = 0; r < Math.min(u.length, p.length) && !over; r++) {
    const round: PzRound = { time: { user: u[r], partner: p[r] }, winner: u[r] === p[r] ? null : u[r] < p[r] ? 'user' : 'partner' };
    rounds.push(round);
    if (round.winner && ++points[round.winner] >= PZ_TO_WIN) {
      over = true;
      winner = round.winner;
    } else if (rounds.length >= PZ_MAX_ROUNDS) {
      over = true;
      if (points.user === points.partner) draw = true;
      else winner = points.user > points.partner ? 'user' : 'partner';
    }
  }
  const done = rounds.length;
  const played = { user: over ? done : Math.min(u.length, done + 1), partner: over ? done : Math.min(p.length, done + 1) };
  const toMove: Seat[] = over ? [] : (['user', 'partner'] as Seat[]).filter(s => played[s] === done);
  return { rounds, points, toMove, over, winner, draw, played };
}
