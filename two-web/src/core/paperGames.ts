// Games on Canvas of Us (components/PaperGames): Boxing, Penalty Shootout,
// Puzzle Duel, Water Balloon War, Carrom,
// Tic-tac-toe, Dots and Boxes, Four in a Row, Memory Match, Heart Hug Kiss
// and Snakes & Ladders, played on both phones - live when you are both there, or one move now and
// the next whenever the other opens Two.
//
// A game travels whole: its moves in order, who went first, and the score
// from the games before it. Either phone can work out everything else -
// whose turn it is, who has which box, who won - by playing the moves
// through, so the two phones cannot disagree about a position, and a move
// that is not legal where it stands is simply not played.
//
// Each kind is its own record (GAME_TTT and the rest), and the relay keeps
// only the newest from each of you. In the turn-taking games only the
// player whose turn it is can move, so two copies differ only by moves one
// has not had yet; the longer wins (mergeGame). In Heart Hug Kiss, Boxing,
// Penalty Shootout and Puzzle Duel you both choose at once, so each of you
// has a list of your own picks, and each list is merged the same way.

import type { Seat } from './usTwo';
import { decodeThrow, playBalloon, throwAllowed } from './balloonWar';
import { decodeShot, playCarrom, shotAllowed } from './carrom';
import { boxingAllowed, playBoxing } from './boxing';
import { penaltyAllowed, playPenalty } from './penalty';
import { playPuzzle, puzzleAllowed } from './puzzleDuel';

export type PaperKind = 'ttt' | 'dots' | 'four' | 'memory' | 'hhk' | 'snakes' | 'balloon' | 'carrom' | 'boxing' | 'penalty' | 'puzzle';
export const PAPER_KINDS: PaperKind[] = ['boxing', 'penalty', 'puzzle', 'balloon', 'carrom', 'four', 'memory', 'hhk', 'snakes', 'ttt', 'dots'];
/** The games where you both choose at once: each of you has a list of picks, and no moves. */
const PICK_KINDS: PaperKind[] = ['hhk', 'boxing', 'penalty', 'puzzle'];
export const isPickKind = (kind: PaperKind) => PICK_KINDS.includes(kind);
/**
 * What a phone says in its APP_VERSION when it has Boxing, Penalty Shootout
 * and Puzzle Duel. One that does not would never show a move made in them.
 */
export const CAN_PLAY_MORE = 'games-3';
/** The games a phone on the version before does not have. */
export const isNewerKind = (kind: PaperKind) => kind === 'boxing' || kind === 'penalty' || kind === 'puzzle';
const RECORDS: Record<PaperKind, string> = {
  boxing: 'GAME_BOXING',
  penalty: 'GAME_PENALTY',
  puzzle: 'GAME_PUZZLE',
  ttt: 'GAME_TTT',
  dots: 'GAME_DOTS',
  four: 'GAME_FOUR',
  memory: 'GAME_MEMORY',
  hhk: 'GAME_HHK',
  snakes: 'GAME_SNAKES',
  balloon: 'GAME_BALLOON',
  carrom: 'GAME_CARROM'
};
export const GAME_TTT = RECORDS.ttt;
export const GAME_DOTS = RECORDS.dots;
/** Each game's name, in English (shown through tr). */
export const GAME_NAMES: Record<PaperKind, string> = {
  boxing: 'Boxing',
  penalty: 'Penalty Shootout',
  puzzle: 'Puzzle Duel',
  balloon: 'Water Balloon War',
  carrom: 'Carrom',
  four: 'Four in a Row',
  memory: 'Memory Match',
  hhk: 'Heart Hug Kiss',
  snakes: 'Snakes & Ladders',
  ttt: 'Tic-tac-toe',
  dots: 'Dots & Boxes'
};
export const recordTypeOf = (kind: PaperKind) => RECORDS[kind];
/** Which game a record carries, or null when it is not a game. */
export function kindOfRecord(type: string): PaperKind | null {
  return PAPER_KINDS.find(k => RECORDS[k] === type) ?? null;
}

/** Dots and Boxes boards, in boxes along a side: quick, classic and big. */
export const DOT_SIZES = [3, 4, 5] as const;
export const DEFAULT_DOTS = 4;
/** Memory Match, in pairs of cards. */
export const MEMORY_SIZES = [6, 8, 10] as const;
export const DEFAULT_MEMORY = 8;
/** The board sizes a kind can be played at, or null when it has one. */
export function sizesOf(kind: PaperKind): readonly number[] | null {
  return kind === 'dots' ? DOT_SIZES : kind === 'memory' ? MEMORY_SIZES : null;
}
const FIXED_SIZE: Record<PaperKind, number> = { ttt: 3, dots: DEFAULT_DOTS, four: 7, memory: DEFAULT_MEMORY, hhk: 3, snakes: 10, balloon: 1, carrom: 1, boxing: 1, penalty: 1, puzzle: 1 };

/** The inks each of you can play in. */
export const INKS = ['#f43f5e', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'] as const;
/** The marks for Tic-tac-toe, and your counter elsewhere. */
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
  /** A new game is a new id. Memory Match deals its cards from it. */
  id: string;
  startedAt: number;
  /** Who moved first. It swaps from one game to the next. */
  first: Seat;
  /** Dots and Boxes: boxes along a side. Memory Match: pairs. Otherwise fixed. */
  size: number;
  /**
   * In order. Tic-tac-toe: a cell, 0-8. Dots and Boxes: a line (lineCount).
   * Four in a Row: a column, 0-6. Memory Match: a card turned over. Snakes &
   * Ladders: what the die showed, 1-6. Water Balloon War: a throw
   * (core/balloonWar). Carrom: a shot (core/carrom).
   */
  moves: number[];
  /** The games where you both choose at once (isPickKind): each of you's picks, round by round. */
  picks?: Record<Seat, number[]>;
  /** Wins and draws in the games before this one. */
  before: Tally;
  looks: { user?: PlayerLook; partner?: PlayerLook };
  /** A new game asked for while this one is still being played. */
  ask?: RestartAsk;
}

/**
 * Starting over in the middle of a game takes both of you: one asks, the game
 * carries on, and the other says yes (which starts the new game) or no. Which
 * state it is in travels with the game; between two copies the later one
 * stands, so each answer overrides the question before it.
 */
export interface RestartAsk {
  /** Who asked. */
  by: Seat;
  at: number;
  /** Still waiting for an answer. */
  open: boolean;
  /** The other said no. */
  no?: boolean;
  /** How far the game had got when they said no: the word stays until the next move. */
  progress?: number;
}

export const other = (seat: Seat): Seat => (seat === 'user' ? 'partner' : 'user');

/** The tab Canvas of Us opens on (views/CanvasOfUsView): drawing, the games, or one game. */
export const CANVAS_MODE_KEY = 'two_canvas_mode';
/**
 * `homes` is Cosy Homes, the puzzle for one (core/cosyHomes), and `maze` Two
 * Hearts, the maze you do together (core/twoHearts): on the shelf with the
 * games, but neither is one of them.
 */
export type CanvasMode = 'draw' | 'games' | 'homes' | 'maze' | 'bomb' | 'catch' | 'lamp' | PaperKind;
/** Opens Canvas of Us here next time - on a game with a move waiting, say. */
export function rememberCanvasMode(mode: CanvasMode) {
  try {
    localStorage.setItem(CANVAS_MODE_KEY, mode);
  } catch {
    /* it opens where it last was */
  }
}

const ZERO: Tally = { user: 0, partner: 0, draws: 0 };

/** How far into a game it is: its moves, or both of your picks. */
export const progressOf = (g?: Pick<PaperGame, 'moves' | 'picks'>) =>
  !g ? 0 : g.moves.length + (g.picks?.user.length || 0) + (g.picks?.partner.length || 0);
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

// ------------------------------------------------------------ Four in a Row
//
// Seven columns of six, row 0 at the top. A disc dropped in a column lands
// on the lowest empty row; four of one colour in a line wins.

export const FOUR_COLS = 7;
export const FOUR_ROWS = 6;
const FOUR_DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

export interface FourState {
  grid: (Seat | null)[];
  turn: Seat;
  winner: Seat | null;
  /** The cells that won, in order along the line. */
  line: number[] | null;
  over: boolean;
  draw: boolean;
  played: number;
  /** Where the last disc landed. */
  last: number | null;
}

function fourLine(grid: (Seat | null)[], row: number, col: number, seat: Seat): number[] | null {
  for (const [dr, dc] of FOUR_DIRS) {
    const cells = [row * FOUR_COLS + col];
    for (const s of [1, -1]) {
      let r = row + dr * s;
      let c = col + dc * s;
      while (r >= 0 && r < FOUR_ROWS && c >= 0 && c < FOUR_COLS && grid[r * FOUR_COLS + c] === seat) {
        cells.push(r * FOUR_COLS + c);
        r += dr * s;
        c += dc * s;
      }
    }
    if (cells.length >= 4) return cells.sort((a, b) => a - b);
  }
  return null;
}

/** The row a disc dropped in this column would land on, or -1 when it is full. */
export function landingRow(grid: (Seat | null)[], col: number): number {
  for (let r = FOUR_ROWS - 1; r >= 0; r--) if (!grid[r * FOUR_COLS + col]) return r;
  return -1;
}

export function playFour(game: Pick<PaperGame, 'first' | 'moves'>): FourState {
  const grid: (Seat | null)[] = Array(FOUR_COLS * FOUR_ROWS).fill(null);
  let turn = game.first;
  let winner: Seat | null = null;
  let line: number[] | null = null;
  let played = 0;
  let last: number | null = null;
  for (const col of game.moves) {
    if (winner || !Number.isInteger(col) || col < 0 || col >= FOUR_COLS) break;
    const row = landingRow(grid, col);
    if (row < 0) break;
    const cell = row * FOUR_COLS + col;
    grid[cell] = turn;
    played++;
    last = cell;
    line = fourLine(grid, row, col, turn);
    if (line) winner = turn;
    else turn = other(turn);
  }
  const full = grid.every(Boolean);
  return { grid, turn, winner, line, over: !!winner || full, draw: !winner && full, played, last };
}

// ------------------------------------------------------------ Memory Match
//
// The cards are dealt from the game's id, so both phones lay out the same
// deck without sending it. A turn is two cards: a pair is yours and you go
// again; two that differ are turned back and the turn passes over.

export const MEMORY_FACES = ['💖', '🧸', '🐰', '🌙', '⭐', '🌸', '🍓', '🎈', '🍰', '💍', '🌈', '🦋', '☕', '🍕', '🎁', '🐱'];

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededRandom(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled<T>(list: T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The deck, as a face (MEMORY_FACES) for each card. */
export function deckOf(game: Pick<PaperGame, 'id' | 'size'>): number[] {
  const random = seededRandom(hashOf(game.id));
  const faces = shuffled(MEMORY_FACES.map((_, i) => i), random).slice(0, game.size);
  return shuffled([...faces, ...faces], random);
}

export interface MemoryState {
  deck: number[];
  /** Whose pair each card is in, once found. */
  owner: (Seat | null)[];
  /** Cards face up but not yet won: the first of a turn, or the two just missed. */
  up: number[];
  /** The first card of the turn under way. */
  pending: number | null;
  /** How the last turn of two cards went, and which two they were. */
  result: 'match' | 'miss' | null;
  pair: number[];
  turn: Seat;
  scores: Record<Seat, number>;
  over: boolean;
  winner: Seat | null;
  draw: boolean;
  played: number;
}

export function playMemory(game: Pick<PaperGame, 'id' | 'size' | 'first' | 'moves'>): MemoryState {
  const deck = deckOf(game);
  const owner: (Seat | null)[] = Array(deck.length).fill(null);
  const scores: Record<Seat, number> = { user: 0, partner: 0 };
  let turn = game.first;
  let pending: number | null = null;
  let missed: number[] = [];
  let result: MemoryState['result'] = null;
  let pair: number[] = [];
  let played = 0;
  for (const card of game.moves) {
    if (!Number.isInteger(card) || card < 0 || card >= deck.length || owner[card] || card === pending) break;
    if (owner.every(Boolean)) break;
    played++;
    if (pending === null) {
      pending = card;
      missed = [];
      result = null;
      continue;
    }
    pair = [pending, card];
    if (deck[pending] === deck[card]) {
      owner[pending] = turn;
      owner[card] = turn;
      scores[turn]++;
      result = 'match';
    } else {
      missed = [pending, card];
      result = 'miss';
      turn = other(turn);
    }
    pending = null;
  }
  const over = owner.every(Boolean);
  const winner = !over || scores.user === scores.partner ? null : scores.user > scores.partner ? 'user' : 'partner';
  return {
    deck,
    owner,
    up: pending !== null ? [pending] : missed,
    pending,
    result,
    pair,
    turn,
    scores,
    over,
    winner,
    draw: over && !winner,
    played
  };
}

// --------------------------------------------------------- Heart Hug Kiss
//
// Rock, paper, scissors, for two: a hug holds a heart, a kiss wins a hug, a
// heart outlasts a kiss. You both choose, neither seeing the other's until
// both have; the first to three rounds wins.

export const HHK_CHOICES = ['heart', 'hug', 'kiss'] as const;
export type HhkChoice = (typeof HHK_CHOICES)[number];
export const HHK_TO_WIN = 3;
/** Whether choice a wins over choice b. */
export const hhkBeats = (a: number, b: number) => (a - b + 3) % 3 === 1;

export interface HhkRound {
  user: number;
  partner: number;
  /** Null when you both chose the same. */
  winner: Seat | null;
}

export interface HhkState {
  rounds: HhkRound[];
  points: Record<Seat, number>;
  /** Who still has to choose this round. */
  toMove: Seat[];
  over: boolean;
  winner: Seat | null;
  /** How many of each of you's picks count (the rest were not legal). */
  played: Record<Seat, number>;
}

export function playHhk(game: Pick<PaperGame, 'picks'>): HhkState {
  const valid = (list: number[] | undefined) => {
    const out: number[] = [];
    for (const c of list || []) {
      if (!Number.isInteger(c) || c < 0 || c > 2) break;
      out.push(c);
    }
    return out;
  };
  const u = valid(game.picks?.user);
  const p = valid(game.picks?.partner);
  const rounds: HhkRound[] = [];
  const points: Record<Seat, number> = { user: 0, partner: 0 };
  let winner: Seat | null = null;
  for (let r = 0; r < Math.min(u.length, p.length) && !winner; r++) {
    const round: HhkRound = { user: u[r], partner: p[r], winner: hhkBeats(u[r], p[r]) ? 'user' : hhkBeats(p[r], u[r]) ? 'partner' : null };
    rounds.push(round);
    if (round.winner && ++points[round.winner] >= HHK_TO_WIN) winner = round.winner;
  }
  const done = rounds.length;
  // One pick ahead of the rounds is the most anyone can have made; none once it is won.
  const played = {
    user: winner ? done : Math.min(u.length, done + 1),
    partner: winner ? done : Math.min(p.length, done + 1)
  };
  const toMove: Seat[] = winner ? [] : (['user', 'partner'] as Seat[]).filter(s => played[s] === done);
  return { rounds, points, toMove, over: !!winner, winner, played };
}

// -------------------------------------------------------- Snakes & Ladders
//
// Squares 1 to 100, both counters starting off the board. Roll and move;
// a ladder's foot takes you up it, a snake's head down it. A six rolls
// again. To win, land on 100 exactly - a roll that would go past it moves
// nothing.

export const LADDERS: Record<number, number> = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
export const SNAKES: Record<number, number> = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 };

export interface SnakesStep {
  seat: Seat;
  roll: number;
  from: number;
  /** Where the roll took the counter, before any ladder or snake. */
  landed: number;
  to: number;
  via: 'ladder' | 'snake' | null;
  /** Too far past 100: it stayed where it was. */
  stayed: boolean;
}

export interface SnakesState {
  pos: Record<Seat, number>;
  turn: Seat;
  over: boolean;
  winner: Seat | null;
  last: SnakesStep | null;
  played: number;
}

export function playSnakes(game: Pick<PaperGame, 'first' | 'moves'>): SnakesState {
  const pos: Record<Seat, number> = { user: 0, partner: 0 };
  let turn = game.first;
  let winner: Seat | null = null;
  let last: SnakesStep | null = null;
  let played = 0;
  for (const roll of game.moves) {
    if (winner || !Number.isInteger(roll) || roll < 1 || roll > 6) break;
    played++;
    const from = pos[turn];
    const stayed = from + roll > 100;
    const landed = stayed ? from : from + roll;
    const via = stayed ? null : LADDERS[landed] ? 'ladder' : SNAKES[landed] ? 'snake' : null;
    const to = via === 'ladder' ? LADDERS[landed] : via === 'snake' ? SNAKES[landed] : landed;
    pos[turn] = to;
    last = { seat: turn, roll, from, landed, to, via, stayed };
    if (to === 100) winner = turn;
    else if (roll !== 6) turn = other(turn);
  }
  return { pos, turn, over: !!winner, winner, last, played };
}

// --------------------------------------------------------------- all games

export interface Standing {
  /** Who may move now: one of you, or in Heart Hug Kiss either or both. */
  toMove: Seat[];
  turn: Seat;
  over: boolean;
  winner: Seat | null;
  draw: boolean;
  /** The last move earned the same player another go: a box, a pair, a six. */
  again: boolean;
}

/** A game of picks, played through: how many rounds are decided, who has still to choose, how it ended. */
interface PicksPlayed {
  rounds: number;
  toMove: Seat[];
  over: boolean;
  winner: Seat | null;
  draw: boolean;
  played: Record<Seat, number>;
}
function picksOf(game: PaperGame): PicksPlayed {
  switch (game.kind) {
    case 'boxing': {
      const s = playBoxing(game);
      return { rounds: s.rounds.length, toMove: s.toMove, over: s.over, winner: s.winner, draw: s.draw, played: s.played };
    }
    case 'penalty': {
      const s = playPenalty(game);
      return { rounds: s.kicks.length, toMove: s.toMove, over: s.over, winner: s.winner, draw: s.draw, played: s.played };
    }
    case 'puzzle': {
      const s = playPuzzle(game);
      return { rounds: s.rounds.length, toMove: s.toMove, over: s.over, winner: s.winner, draw: s.draw, played: s.played };
    }
    default: {
      const s = playHhk(game);
      return { rounds: s.rounds.length, toMove: s.toMove, over: s.over, winner: s.winner, draw: false, played: s.played };
    }
  }
}
/** How many rounds of a game of picks are decided: both of you have chosen, and it has been worked out. */
export const roundsOf = (game?: PaperGame) => (game && isPickKind(game.kind) ? picksOf(game).rounds : 0);
/** A game of picks as it stood after its first `n` rounds, with nothing chosen for the next. */
export const atRound = (game: PaperGame, n: number): PaperGame =>
  !game.picks ? game : { ...game, picks: { user: game.picks.user.slice(0, n), partner: game.picks.partner.slice(0, n) } };

/** Where a game stands: who is to move, and how it ended if it has. */
export function standing(game: PaperGame): Standing {
  const one = (turn: Seat, over: boolean, winner: Seat | null, draw: boolean, again = false): Standing => ({
    toMove: over ? [] : [turn],
    turn,
    over,
    winner,
    draw,
    again: again && !over
  });
  switch (game.kind) {
    case 'ttt': {
      const s = playTtt(game);
      return one(s.turn, s.over, s.winner, s.draw);
    }
    case 'dots': {
      const s = playDots(game);
      return one(s.turn, s.over, s.winner, s.draw, s.closed.length > 0);
    }
    case 'four': {
      const s = playFour(game);
      return one(s.turn, s.over, s.winner, s.draw);
    }
    case 'memory': {
      const s = playMemory(game);
      return one(s.turn, s.over, s.winner, s.draw, s.result === 'match' && s.pending === null);
    }
    case 'hhk':
    case 'boxing':
    case 'penalty':
    case 'puzzle': {
      const s = picksOf(game);
      return { toMove: s.toMove, turn: s.toMove[0] ?? game.first, over: s.over, winner: s.winner, draw: s.draw, again: false };
    }
    case 'snakes': {
      const s = playSnakes(game);
      return one(s.turn, s.over, s.winner, false, !!s.last && s.last.roll === 6);
    }
    case 'balloon': {
      const s = playBalloon(game);
      return one(s.turn, s.over, s.winner, false);
    }
    case 'carrom': {
      const s = playCarrom(game);
      return one(s.turn, s.over, s.winner, false, s.again);
    }
  }
}

/** How many of a game's moves are legal where they stand. */
function playedOf(game: PaperGame): number {
  switch (game.kind) {
    case 'ttt':
      return playTtt(game).played;
    case 'dots':
      return playDots(game).played;
    case 'four':
      return playFour(game).played;
    case 'memory':
      return playMemory(game).played;
    case 'snakes':
      return playSnakes(game).played;
    case 'balloon':
      return playBalloon(game).played;
    case 'carrom':
      return playCarrom(game).played;
    case 'hhk':
    case 'boxing':
    case 'penalty':
    case 'puzzle':
      return 0;
  }
}

/** Whether `seat` may make `move` now. */
export function canMove(game: PaperGame, seat: Seat, move: number): boolean {
  if (!Number.isInteger(move)) return false;
  if (isPickKind(game.kind)) {
    const s = picksOf(game);
    const lists = game.picks || { user: [], partner: [] };
    if (s.played.user !== lists.user.length || s.played.partner !== lists.partner.length) return false;
    if (!s.toMove.includes(seat)) return false;
    switch (game.kind) {
      case 'boxing':
        return boxingAllowed(move, playBoxing(game).energy[seat]);
      case 'penalty':
        return penaltyAllowed(game, seat, move);
      case 'puzzle':
        return puzzleAllowed(move);
      default:
        return move >= 0 && move < HHK_CHOICES.length;
    }
  }
  const st = standing(game);
  if (st.over || st.turn !== seat || playedOf(game) !== game.moves.length) return false;
  switch (game.kind) {
    case 'ttt':
      return move >= 0 && move < 9 && !playTtt(game).board[move];
    case 'dots':
      return move >= 0 && move < lineCount(game.size) && !playDots(game).lines[move];
    case 'four':
      return move >= 0 && move < FOUR_COLS && landingRow(playFour(game).grid, move) >= 0;
    case 'memory': {
      const s = playMemory(game);
      return move >= 0 && move < s.deck.length && !s.owner[move] && move !== s.pending;
    }
    case 'snakes':
      return move >= 1 && move <= 6;
    case 'balloon':
      return Number.isSafeInteger(move) && move >= 0 && throwAllowed(decodeThrow(move), playBalloon(game).giantLeft[seat]);
    case 'carrom':
      return Number.isSafeInteger(move) && move >= 0 && shotAllowed(playCarrom(game).coins, seat, decodeShot(move));
    default:
      return false;
  }
}

/** The game with `seat`'s move made. */
export function withMove(game: PaperGame, move: number, seat?: Seat): PaperGame {
  if (isPickKind(game.kind)) {
    const picks = game.picks || { user: [], partner: [] };
    const who = seat ?? 'user';
    return { ...game, picks: { ...picks, [who]: [...picks[who], move] } };
  }
  return { ...game, moves: [...game.moves, move] };
}

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
  const sizes = sizesOf(kind);
  const game: PaperGame = {
    kind,
    id,
    // Always after the game it replaces, even if this phone's clock is behind the other's:
    // between two copies the newer game wins, and this has to be it.
    startedAt: prev ? Math.max(now, prev.startedAt + 1) : now,
    first: prev ? other(prev.first) : starter,
    size: !sizes ? FIXED_SIZE[kind] : sizes.includes(size ?? 0) ? size! : prev?.size || FIXED_SIZE[kind],
    moves: [],
    before: prev ? totals(prev) : { ...ZERO },
    looks: prev ? { ...prev.looks } : {}
  };
  if (isPickKind(kind)) game.picks = { user: [], partner: [] };
  return game;
}

// Each step after the one before, whatever the two phones' clocks say.
const askAt = (game: PaperGame, now: number) => Math.max(now, (game.ask?.at ?? 0) + 1);

/** This seat asks to start over; the game carries on meanwhile. */
export const askRestart = (game: PaperGame, seat: Seat, now: number): PaperGame => ({
  ...game,
  ask: { by: seat, at: askAt(game, now), open: true }
});

/** The one who asked takes it back. */
export const cancelRestart = (game: PaperGame, now: number): PaperGame =>
  game.ask ? { ...game, ask: { by: game.ask.by, at: askAt(game, now), open: false } } : game;

/** The other says no: they want to finish this one. */
export const declineRestart = (game: PaperGame, now: number): PaperGame =>
  game.ask ? { ...game, ask: { by: game.ask.by, at: askAt(game, now), open: false, no: true, progress: progressOf(game) } } : game;

/** The question still waiting for an answer, if there is one. A game that has ended has none. */
export function openAsk(game?: PaperGame): RestartAsk | null {
  return game?.ask?.open && !standing(game).over ? game.ask : null;
}

/** The other asked, and it is this seat's answer they are waiting for. */
export const askedOf = (game: PaperGame | undefined, seat: Seat) => openAsk(game)?.by === other(seat);

/** This seat asked and was told no, and the game has not moved on since. */
export const refusedOf = (game: PaperGame | undefined, seat: Seat) =>
  !!game?.ask && !game.ask.open && !!game.ask.no && game.ask.by === seat && game.ask.progress === progressOf(game) && !standing(game).over;

export const withLook = (game: PaperGame, seat: Seat, look: Partial<Omit<PlayerLook, 'at'>>, now: number): PaperGame => {
  const current = game.looks[seat] || { ...DEFAULT_LOOK[seat], at: 0 };
  return { ...game, looks: { ...game.looks, [seat]: { ...current, ...look, at: now } } };
};

function laterLook(a?: PlayerLook, b?: PlayerLook): PlayerLook | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.at > a.at ? b : a;
}

/** Of two askings, the later: the same one from either side, even if made in the same moment. */
function laterAsk(a?: RestartAsk, b?: RestartAsk): RestartAsk | undefined {
  if (!a) return b;
  if (!b) return a;
  if (b.at !== a.at) return b.at > a.at ? b : a;
  return b.by > a.by ? b : a;
}

const isPrefix = (short: number[], long: number[]) => short.every((m, i) => long[i] === m);
/** Of two copies of one list of moves: the one further on, if it agrees with the other so far. */
const further = (a: number[], b: number[]) => (b.length > a.length && isPrefix(a, b) ? b : a);

/**
 * What a phone holds once another copy of the game arrives.
 *
 * The newer game wins over an older one. Of two copies of one game, the
 * one further on - the other can only be missing moves. Each of you keeps
 * the ink and mark chosen last. Returns `a` itself when nothing changes, so
 * nothing redraws for nothing.
 */
export function mergeGame(a: PaperGame | undefined, b: PaperGame): PaperGame {
  if (!a) return b;
  const looks = { user: laterLook(a.looks.user, b.looks.user), partner: laterLook(a.looks.partner, b.looks.partner) };
  let base = a;
  if (a.id !== b.id) {
    const bNewer = b.startedAt > a.startedAt || (b.startedAt === a.startedAt && b.id > a.id);
    base = bNewer ? b : a;
  } else {
    const moves = further(a.moves, b.moves);
    let picks = a.picks;
    if (a.picks || b.picks) {
      const pa = a.picks || { user: [], partner: [] };
      const pb = b.picks || { user: [], partner: [] };
      const user = further(pa.user, pb.user);
      const partner = further(pa.partner, pb.partner);
      if (!a.picks || user !== pa.user || partner !== pa.partner) picks = { user, partner };
    }
    if (moves !== a.moves || picks !== a.picks) {
      base = { ...a, moves };
      if (picks) base.picks = picks;
    }
  }
  // An asking belongs to its game: a new game starts with none.
  const ask = a.id === b.id ? laterAsk(a.ask, b.ask) : base.ask;
  const sameLooks = looks.user === base.looks.user && looks.partner === base.looks.partner;
  if (base === a && sameLooks && ask === a.ask) return a;
  const merged: PaperGame = { ...base, looks: {} };
  if (looks.user) merged.looks.user = looks.user;
  if (looks.partner) merged.looks.partner = looks.partner;
  if (ask) merged.ask = ask;
  else delete merged.ask;
  return merged;
}

const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? Math.min(v as number, 1_000_000) : 0);

function cleanLook(v: unknown): PlayerLook | undefined {
  const o = v as Partial<PlayerLook> | null;
  if (!o || typeof o !== 'object') return undefined;
  if (!(INKS as readonly string[]).includes(String(o.ink)) || !(MARKS as readonly string[]).includes(String(o.mark))) return undefined;
  return { ink: String(o.ink), mark: o.mark as Mark, at: Number.isFinite(o.at) ? Number(o.at) : 0 };
}

function cleanAsk(v: unknown): RestartAsk | undefined {
  const o = v as Partial<RestartAsk> | null;
  if (!o || typeof o !== 'object' || (o.by !== 'user' && o.by !== 'partner') || !Number.isFinite(o.at)) return undefined;
  const ask: RestartAsk = { by: o.by, at: Number(o.at), open: o.open === true };
  if (o.no === true && !ask.open) {
    ask.no = true;
    ask.progress = count(o.progress);
  }
  return ask;
}

/** The most moves a kind can have; turning cards and rolling dice can go on. */
function maxMoves(kind: PaperKind, size: number): number {
  switch (kind) {
    case 'ttt':
      return 9;
    case 'dots':
      return lineCount(size);
    case 'four':
      return FOUR_COLS * FOUR_ROWS;
    case 'balloon':
    case 'carrom':
      return 600;
    default:
      return 4000;
  }
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
  const sizes = sizesOf(kind);
  const size = !sizes ? FIXED_SIZE[kind] : sizes.includes(Number(o.size)) ? Number(o.size) : null;
  if (!size) return null;
  const moves = !isPickKind(kind) && Array.isArray(o.moves) ? o.moves.slice(0, maxMoves(kind, size)).map(Number) : [];
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
  const ask = cleanAsk(o.ask);
  if (ask) game.ask = ask;
  if (isPickKind(kind)) {
    const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, 200).map(Number) : []);
    game.picks = { user: list(o.picks?.user), partner: list(o.picks?.partner) };
    const s = picksOf(game);
    game.picks = { user: game.picks.user.slice(0, s.played.user), partner: game.picks.partner.slice(0, s.played.partner) };
    return game;
  }
  const played = playedOf(game);
  if (played < moves.length) game.moves = moves.slice(0, played);
  return game;
}
