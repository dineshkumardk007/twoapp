// Paper classics on Canvas of Us (components/PaperGames): Tic-tac-toe and
// Dots and Boxes, played on both phones, turn by turn - live when you are
// both there, or one move now and the next whenever the other opens Two.
//
// A game travels whole: its moves in order, who went first, and the score
// from the games before it. Either phone can work out everything else -
// whose turn it is, who has which box, who won - by playing the moves
// through, so the two phones cannot disagree about a position, and a move
// that is not legal where it stands is simply not played.
//
// Each kind is its own record (GAME_TTT, GAME_DOTS), and the relay keeps
// only the newest from each of you. Only the player whose turn it is can
// move, so the two copies differ only by moves one has not had yet; the
// longer wins (mergeGame).

import type { Seat } from './usTwo';

export type PaperKind = 'ttt' | 'dots';
export const GAME_TTT = 'GAME_TTT';
export const GAME_DOTS = 'GAME_DOTS';
export const recordTypeOf = (kind: PaperKind) => (kind === 'ttt' ? GAME_TTT : GAME_DOTS);

/** Dots and Boxes boards, in boxes along a side: quick, classic and big. */
export const DOT_SIZES = [3, 4, 5] as const;
export const DEFAULT_DOTS = 4;

/** The inks each of you can play in. */
export const INKS = ['#f43f5e', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'] as const;
/** The marks for Tic-tac-toe. */
export const MARKS = ['x', 'o', 'heart', 'star', 'moon', 'flower'] as const;
export type Mark = (typeof MARKS)[number];

export interface PlayerLook {
  ink: string;
  mark: Mark;
  /** When it was chosen: between the two phones, the later choice stands. */
  at: number;
}

export interface Tally {
  user: number;
  partner: number;
  draws: number;
}

export interface PaperGame {
  kind: PaperKind;
  /** A new game is a new id. */
  id: string;
  startedAt: number;
  /** Who moved first. It swaps from one game to the next. */
  first: Seat;
  /** Tic-tac-toe: 3. Dots and Boxes: boxes along a side. */
  size: number;
  /** In order. Tic-tac-toe: a cell, 0-8. Dots and Boxes: a line (lineCount). */
  moves: number[];
  /** Wins and draws in the games before this one. */
  before: Tally;
  looks: { user?: PlayerLook; partner?: PlayerLook };
}

export const other = (seat: Seat): Seat => (seat === 'user' ? 'partner' : 'user');

/** The tab Canvas of Us opens on (views/CanvasOfUsView): drawing, or a game. */
export const CANVAS_MODE_KEY = 'two_canvas_mode';
/** Opens Canvas of Us on this game next time - a move waiting there, say. */
export function rememberCanvasMode(mode: 'draw' | PaperKind) {
  try {
    localStorage.setItem(CANVAS_MODE_KEY, mode);
  } catch {
    /* it opens where it last was */
  }
}
const ZERO: Tally = { user: 0, partner: 0, draws: 0 };
const DEFAULT_LOOK: Record<Seat, Omit<PlayerLook, 'at'>> = {
  user: { ink: '#0ea5e9', mark: 'x' },
  partner: { ink: '#f43f5e', mark: 'heart' }
};

/**
 * How a seat plays: its own choice, or its default. If the two of you ever
 * end up with the same ink or mark (both chose in the same moment), the one
 * who chose later is shown the first one free - the same on both phones.
 */
export function lookOf(game: Pick<PaperGame, 'looks'> | undefined, seat: Seat): Omit<PlayerLook, 'at'> {
  const mine = game?.looks[seat] || { ...DEFAULT_LOOK[seat], at: 0 };
  const theirs = game?.looks[other(seat)] || { ...DEFAULT_LOOK[other(seat)], at: 0 };
  // Ties go to the user's seat, so exactly one of you gives way.
  const yields = mine.at > theirs.at || (mine.at === theirs.at && seat === 'partner');
  const ink = mine.ink === theirs.ink && yields ? INKS.find(i => i !== theirs.ink)! : mine.ink;
  const mark = mine.mark === theirs.mark && yields ? MARKS.find(m => m !== theirs.mark)! : mine.mark;
  return { ink, mark };
}

// ------------------------------------------------------------- Tic-tac-toe

export const TTT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export interface TttState {
  board: (Seat | null)[];
  turn: Seat;
  winner: Seat | null;
  /** The three cells that won. */
  line: number[] | null;
  over: boolean;
  draw: boolean;
  /** How many of the moves were played (the rest were not legal). */
  played: number;
}

export function playTtt(game: Pick<PaperGame, 'first' | 'moves'>): TttState {
  const board: (Seat | null)[] = Array(9).fill(null);
  let turn = game.first;
  let winner: Seat | null = null;
  let line: number[] | null = null;
  let played = 0;
  for (const cell of game.moves) {
    if (winner || !Number.isInteger(cell) || cell < 0 || cell > 8 || board[cell]) break;
    board[cell] = turn;
    played++;
    line = TTT_LINES.find(l => l.every(c => board[c] === turn)) || null;
    if (line) winner = turn;
    else turn = other(turn);
  }
  const full = board.every(Boolean);
  return { board, turn, winner, line, over: !!winner || full, draw: !winner && full, played };
}

// ---------------------------------------------------------- Dots and Boxes
//
// On a board of n boxes a side: the horizontal lines first, row by row
// (n + 1 rows of n), then the vertical ones (n rows of n + 1).

export const lineCount = (n: number) => 2 * n * (n + 1);
export const hLine = (n: number, row: number, col: number) => row * n + col;
export const vLine = (n: number, row: number, col: number) => n * (n + 1) + row * (n + 1) + col;

/** Where a line runs, in dots: from (row, col) one step right or down. */
export function lineAt(n: number, index: number): { row: number; col: number; across: boolean } {
  const h = n * (n + 1);
  if (index < h) return { row: Math.floor(index / n), col: index % n, across: true };
  const i = index - h;
  return { row: Math.floor(i / (n + 1)), col: i % (n + 1), across: false };
}

/** The four sides of box (row, col). */
export function sidesOf(n: number, row: number, col: number): number[] {
  return [hLine(n, row, col), hLine(n, row + 1, col), vLine(n, row, col), vLine(n, row, col + 1)];
}

/** The boxes either side of a line - one at the edge of the board. */
export function boxesBeside(n: number, index: number): number[] {
  const { row, col, across } = lineAt(n, index);
  const out: number[] = [];
  if (across) {
    if (row > 0) out.push((row - 1) * n + col);
    if (row < n) out.push(row * n + col);
  } else {
    if (col > 0) out.push(row * n + col - 1);
    if (col < n) out.push(row * n + col);
  }
  return out;
}

export interface DotsState {
  lines: (Seat | null)[];
  boxes: (Seat | null)[];
  turn: Seat;
  scores: Record<Seat, number>;
  over: boolean;
  winner: Seat | null;
  draw: boolean;
  /** The boxes the last move closed. */
  closed: number[];
  played: number;
}

export function playDots(game: Pick<PaperGame, 'first' | 'moves' | 'size'>): DotsState {
  const n = game.size;
  const lines: (Seat | null)[] = Array(lineCount(n)).fill(null);
  const boxes: (Seat | null)[] = Array(n * n).fill(null);
  const scores: Record<Seat, number> = { user: 0, partner: 0 };
  let turn = game.first;
  let closed: number[] = [];
  let played = 0;
  for (const index of game.moves) {
    if (!Number.isInteger(index) || index < 0 || index >= lines.length || lines[index]) break;
    lines[index] = turn;
    played++;
    closed = boxesBeside(n, index).filter(b => {
      const row = Math.floor(b / n);
      const col = b % n;
      return !boxes[b] && sidesOf(n, row, col).every(s => lines[s]);
    });
    for (const b of closed) boxes[b] = turn;
    scores[turn] += closed.length;
    // Closing a box earns another go; otherwise it passes over.
    if (!closed.length) turn = other(turn);
  }
  const over = lines.every(Boolean);
  const winner = !over || scores.user === scores.partner ? null : scores.user > scores.partner ? 'user' : 'partner';
  return { lines, boxes, turn, scores, over, winner, draw: over && !winner, closed, played };
}

// ------------------------------------------------------------- both games

/** Where a game stands: whose turn, and how it ended if it has. */
export function standing(game: PaperGame): { turn: Seat; over: boolean; winner: Seat | null; draw: boolean } {
  const s = game.kind === 'ttt' ? playTtt(game) : playDots(game);
  return { turn: s.turn, over: s.over, winner: s.winner, draw: s.draw };
}

/** Whether `seat` may make `move` now. */
export function canMove(game: PaperGame, seat: Seat, move: number): boolean {
  const s = game.kind === 'ttt' ? playTtt(game) : playDots(game);
  if (s.over || s.turn !== seat || s.played !== game.moves.length) return false;
  if (game.kind === 'ttt') return Number.isInteger(move) && move >= 0 && move < 9 && !(s as TttState).board[move];
  return Number.isInteger(move) && move >= 0 && move < lineCount(game.size) && !(s as DotsState).lines[move];
}

export const withMove = (game: PaperGame, move: number): PaperGame => ({ ...game, moves: [...game.moves, move] });

/** The score so far, this game included once it has ended. */
export function totals(game: PaperGame): Tally {
  const s = standing(game);
  const t = { ...game.before };
  if (s.winner) t[s.winner]++;
  else if (s.draw) t.draws++;
  return t;
}

/**
 * A fresh game: the score carried over, the looks kept, and the other of
 * you going first this time. The very first game is started by whoever
 * starts it.
 */
export function newGame(kind: PaperKind, prev: PaperGame | undefined, starter: Seat, id: string, now: number, size?: number): PaperGame {
  return {
    kind,
    id,
    startedAt: now,
    first: prev ? other(prev.first) : starter,
    size: kind === 'ttt' ? 3 : (DOT_SIZES as readonly number[]).includes(size ?? 0) ? size! : prev?.size || DEFAULT_DOTS,
    moves: [],
    before: prev ? totals(prev) : { ...ZERO },
    looks: prev ? { ...prev.looks } : {}
  };
}

export const withLook = (game: PaperGame, seat: Seat, look: Partial<Omit<PlayerLook, 'at'>>, now: number): PaperGame => {
  const current = game.looks[seat] || { ...DEFAULT_LOOK[seat], at: 0 };
  return { ...game, looks: { ...game.looks, [seat]: { ...current, ...look, at: now } } };
};

function laterLook(a?: PlayerLook, b?: PlayerLook): PlayerLook | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.at > a.at ? b : a;
}

const isPrefix = (short: number[], long: number[]) => short.every((m, i) => long[i] === m);

/**
 * What a phone holds once another copy of the game arrives.
 *
 * The newer game wins over an older one. Of two copies of one game, the
 * one further on - the other can only be missing moves, since only one of
 * you can move at a time. Each of you keeps the ink and mark chosen last.
 * Returns `a` itself when nothing changes, so nothing redraws for nothing.
 */
export function mergeGame(a: PaperGame | undefined, b: PaperGame): PaperGame {
  if (!a) return b;
  const looks = { user: laterLook(a.looks.user, b.looks.user), partner: laterLook(a.looks.partner, b.looks.partner) };
  let base = a;
  if (a.id !== b.id) {
    const bNewer = b.startedAt > a.startedAt || (b.startedAt === a.startedAt && b.id > a.id);
    base = bNewer ? b : a;
  } else if (b.moves.length > a.moves.length && isPrefix(a.moves, b.moves)) {
    base = b;
  }
  const sameLooks = looks.user === base.looks.user && looks.partner === base.looks.partner;
  if (base === a && sameLooks) return a;
  const merged: PaperGame = { ...base, looks: {} };
  if (looks.user) merged.looks.user = looks.user;
  if (looks.partner) merged.looks.partner = looks.partner;
  return merged;
}

const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? Math.min(v as number, 1_000_000) : 0);

function cleanLook(v: unknown): PlayerLook | undefined {
  const o = v as Partial<PlayerLook> | null;
  if (!o || typeof o !== 'object') return undefined;
  if (!(INKS as readonly string[]).includes(String(o.ink)) || !(MARKS as readonly string[]).includes(String(o.mark))) return undefined;
  return { ink: String(o.ink), mark: o.mark as Mark, at: Number.isFinite(o.at) ? Number(o.at) : 0 };
}

/**
 * A game as it arrived from the other phone, or as it was stored: anything
 * malformed dropped, and its moves kept only as far as they are legal.
 */
export function cleanGame(raw: unknown, kind: PaperKind): PaperGame | null {
  const o = raw as Partial<PaperGame> | null;
  if (!o || typeof o !== 'object' || o.kind !== kind) return null;
  if (typeof o.id !== 'string' || !o.id || o.id.length > 80) return null;
  const first: Seat | null = o.first === 'user' || o.first === 'partner' ? o.first : null;
  if (!first) return null;
  const size = kind === 'ttt' ? 3 : (DOT_SIZES as readonly number[]).includes(Number(o.size)) ? Number(o.size) : null;
  if (!size) return null;
  const moves = Array.isArray(o.moves) ? o.moves.slice(0, kind === 'ttt' ? 9 : lineCount(size)).map(Number) : [];
  const game: PaperGame = {
    kind,
    id: o.id,
    startedAt: Number.isFinite(o.startedAt) ? Number(o.startedAt) : 0,
    first,
    size,
    moves,
    before: { user: count(o.before?.user), partner: count(o.before?.partner), draws: count(o.before?.draws) },
    looks: {}
  };
  const user = cleanLook(o.looks?.user);
  const partner = cleanLook(o.looks?.partner);
  if (user) game.looks.user = user;
  if (partner) game.looks.partner = partner;
  const played = (kind === 'ttt' ? playTtt(game) : playDots(game)).played;
  if (played < moves.length) game.moves = moves.slice(0, played);
  return game;
}
