// Chess on Canvas of Us (components/ChessBoard): the whole of the rules.
//
// Whoever moves first in a game has the white pieces - the bear's team or
// the bunny's, by whose turn it is to start - and you swap from one game to
// the next. Every move is checked: castling, taking en passant and promoting
// a pawn included; a move that would leave your own king in check is no move
// at all. The game ends in checkmate, or drawn: stalemate, the same position
// a third time, fifty moves each with no pawn moved and nothing taken, or too
// little left on the board for anyone to mate.
//
// A move is from + to * 64 + promotion * 4096: the squares 0-63 counted from
// white's queen's rook (a1) along each rank, and the piece a pawn becomes on
// the last rank - 1 a queen, 2 a rook, 3 a bishop, 4 a knight - or 0.

import type { Seat } from './usTwo';

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
/** What each piece is worth, for who is ahead. */
export const PIECE_VALUE = [0, 1, 3, 3, 5, 9, 0];
/** The promotions, in the order they are written in a move. */
export const PROMOTIONS = [QUEEN, ROOK, BISHOP, KNIGHT] as const;

export const chessMove = (from: number, to: number, promo = 0) => from + to * 64 + promo * 4096;
export const moveFrom = (m: number) => m % 64;
export const moveTo = (m: number) => Math.floor(m / 64) % 64;
export const movePromo = (m: number) => Math.floor(m / 4096);
export const fileOf = (sq: number) => sq % 8;
export const rankOf = (sq: number) => Math.floor(sq / 8);

const WK = 1;
const WQ = 2;
const BK = 4;
const BQ = 8;

interface Position {
  /** + white, - black; 0 empty. */
  board: Int8Array;
  white: boolean;
  castle: number;
  /** The square a pawn may be taken on en passant, or -1. */
  ep: number;
  half: number;
}

const START_ROW = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];

function startPosition(): Position {
  const board = new Int8Array(64);
  for (let f = 0; f < 8; f++) {
    board[f] = START_ROW[f];
    board[8 + f] = PAWN;
    board[48 + f] = -PAWN;
    board[56 + f] = -START_ROW[f];
  }
  return { board, white: true, castle: WK | WQ | BK | BQ, ep: -1, half: 0 };
}

const KNIGHT_STEPS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2]
];
const KING_STEPS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1]
];
const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
];
const at = (f: number, r: number) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1);

/** Whether a square is attacked by the given side. */
export function attacked(board: Int8Array, sq: number, byWhite: boolean): boolean {
  const s = byWhite ? 1 : -1;
  const f = fileOf(sq);
  const r = rankOf(sq);
  // Pawns attack forward and to the side: a white pawn below, a black one above.
  const pr = byWhite ? r - 1 : r + 1;
  for (const df of [-1, 1]) {
    const q = at(f + df, pr);
    if (q >= 0 && board[q] === s * PAWN) return true;
  }
  for (const [df, dr] of KNIGHT_STEPS) {
    const q = at(f + df, r + dr);
    if (q >= 0 && board[q] === s * KNIGHT) return true;
  }
  for (const [df, dr] of KING_STEPS) {
    const q = at(f + df, r + dr);
    if (q >= 0 && board[q] === s * KING) return true;
  }
  for (const [dirs, kinds] of [
    [ROOK_DIRS, [ROOK, QUEEN]],
    [BISHOP_DIRS, [BISHOP, QUEEN]]
  ] as const) {
    for (const [df, dr] of dirs) {
      for (let k = 1; k < 8; k++) {
        const q = at(f + df * k, r + dr * k);
        if (q < 0) break;
        const p = board[q];
        if (!p) continue;
        if (p * s > 0 && (kinds as readonly number[]).includes(p * s)) return true;
        break;
      }
    }
  }
  return false;
}

const kingSquare = (board: Int8Array, white: boolean) => board.indexOf(white ? KING : -KING);
export const inCheck = (pos: Position) => attacked(pos.board, kingSquare(pos.board, pos.white), !pos.white);

/** Every move by the side to move, legal or not as far as its own king goes. */
function pseudoMoves(pos: Position): number[] {
  const { board, white } = pos;
  const s = white ? 1 : -1;
  const out: number[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq] * s;
    if (p <= 0) continue;
    const f = fileOf(sq);
    const r = rankOf(sq);
    const add = (to: number) => {
      if (p === PAWN && (rankOf(to) === 7 || rankOf(to) === 0)) for (let k = 1; k <= 4; k++) out.push(chessMove(sq, to, k));
      else out.push(chessMove(sq, to));
    };
    if (p === PAWN) {
      const dr = white ? 1 : -1;
      const one = at(f, r + dr);
      if (one >= 0 && !board[one]) {
        add(one);
        const two = at(f, r + 2 * dr);
        if ((white ? r === 1 : r === 6) && two >= 0 && !board[two]) add(two);
      }
      for (const df of [-1, 1]) {
        const q = at(f + df, r + dr);
        if (q < 0) continue;
        if (board[q] * s < 0 || q === pos.ep) add(q);
      }
    } else if (p === KNIGHT || p === KING) {
      for (const [df, dr] of p === KNIGHT ? KNIGHT_STEPS : KING_STEPS) {
        const q = at(f + df, r + dr);
        if (q >= 0 && board[q] * s <= 0) add(q);
      }
      if (p === KING) {
        // Castling: rights kept, nothing between, and not out of, through or into check.
        const home = white ? 4 : 60;
        if (sq === home && !attacked(board, home, !white)) {
          const short = white ? WK : BK;
          const long = white ? WQ : BQ;
          if (pos.castle & short && !board[home + 1] && !board[home + 2] && board[home + 3] === s * ROOK && !attacked(board, home + 1, !white) && !attacked(board, home + 2, !white)) {
            out.push(chessMove(home, home + 2));
          }
          if (pos.castle & long && !board[home - 1] && !board[home - 2] && !board[home - 3] && board[home - 4] === s * ROOK && !attacked(board, home - 1, !white) && !attacked(board, home - 2, !white)) {
            out.push(chessMove(home, home - 2));
          }
        }
      }
    } else {
      const dirs = p === ROOK ? ROOK_DIRS : p === BISHOP ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
      for (const [df, dr] of dirs) {
        for (let k = 1; k < 8; k++) {
          const q = at(f + df * k, r + dr * k);
          if (q < 0) break;
          if (board[q] * s > 0) break;
          out.push(chessMove(sq, q));
          if (board[q]) break;
        }
      }
    }
  }
  return out;
}

export interface MoveDone {
  from: number;
  to: number;
  /** The piece that moved, signed. */
  piece: number;
  /** The piece taken, signed, or 0; and the square it was taken on (not `to` for en passant). */
  captured: number;
  capturedAt: number;
  castle: 'short' | 'long' | null;
  promo: number;
}

/** The position after a move, and what the move did. Assumes it is at least a pseudo-legal one. */
function make(pos: Position, move: number): { pos: Position; done: MoveDone } {
  const board = pos.board.slice();
  const from = moveFrom(move);
  const to = moveTo(move);
  const piece = board[from];
  const s = piece > 0 ? 1 : -1;
  const kind = piece * s;
  let captured = board[to];
  let capturedAt = to;
  let castle: MoveDone['castle'] = null;
  if (kind === PAWN && to === pos.ep && !captured) {
    capturedAt = to - 8 * s;
    captured = board[capturedAt];
    board[capturedAt] = 0;
  }
  board[to] = piece;
  board[from] = 0;
  const promo = kind === PAWN && (rankOf(to) === 7 || rankOf(to) === 0) ? PROMOTIONS[movePromo(move) - 1] ?? QUEEN : 0;
  if (promo) board[to] = s * promo;
  if (kind === KING && Math.abs(to - from) === 2) {
    castle = to > from ? 'short' : 'long';
    const rookFrom = to > from ? from + 3 : from - 4;
    const rookTo = to > from ? from + 1 : from - 1;
    board[rookTo] = board[rookFrom];
    board[rookFrom] = 0;
  }
  let rights = pos.castle;
  if (kind === KING) rights &= s > 0 ? ~(WK | WQ) : ~(BK | BQ);
  for (const sq of [from, to]) {
    if (sq === 0) rights &= ~WQ;
    if (sq === 7) rights &= ~WK;
    if (sq === 56) rights &= ~BQ;
    if (sq === 63) rights &= ~BK;
  }
  const ep = kind === PAWN && Math.abs(to - from) === 16 ? (from + to) / 2 : -1;
  return {
    pos: { board, white: !pos.white, castle: rights, ep, half: kind === PAWN || captured ? 0 : pos.half + 1 },
    done: { from, to, piece, captured, capturedAt, castle, promo }
  };
}

/** Every legal move by the side to move. */
function legalMoves(pos: Position): number[] {
  return pseudoMoves(pos).filter(m => {
    const next = make(pos, m).pos;
    return !attacked(next.board, kingSquare(next.board, pos.white), !pos.white);
  });
}

/** Whether either side could still possibly mate. */
function enoughToMate(board: Int8Array): boolean {
  const minors: Array<{ kind: number; square: number }> = [];
  for (let sq = 0; sq < 64; sq++) {
    const k = Math.abs(board[sq]);
    if (k === PAWN || k === ROOK || k === QUEEN) return true;
    if (k === KNIGHT || k === BISHOP) minors.push({ kind: k, square: sq });
  }
  if (minors.length <= 1) return false;
  // Only bishops, all on the same colour: no mate can ever be made.
  return !minors.every(m => m.kind === BISHOP && (fileOf(m.square) + rankOf(m.square)) % 2 === (fileOf(minors[0].square) + rankOf(minors[0].square)) % 2);
}

/** A position as the rule of three times the same counts it. */
function keyOf(pos: Position, legal: number[]): string {
  // En passant counts only when it could really be done.
  const ep = pos.ep >= 0 && legal.some(m => moveTo(m) === pos.ep && Math.abs(pos.board[moveFrom(m)]) === PAWN) ? pos.ep : -1;
  return `${Array.from(pos.board).join(',')}|${pos.white ? 'w' : 'b'}|${pos.castle}|${ep}`;
}

export type ChessDrawWhy = 'stalemate' | 'repetition' | 'fifty' | 'material';

export interface ChessState {
  board: Int8Array;
  /** A name for each piece, that goes with it as it moves: for drawing it gliding from square to square. */
  ids: Int16Array;
  /** Whose move it is. */
  turn: Seat;
  /** Who has white: whoever moved first. */
  whiteSeat: Seat;
  check: boolean;
  over: boolean;
  winner: Seat | null;
  draw: boolean;
  drawWhy: ChessDrawWhy | null;
  /** Every legal move now. */
  legal: number[];
  last: MoveDone | null;
  /** The pieces each of you has taken, as kinds. */
  taken: Record<Seat, number[]>;
  /** How far ahead each of you is in what is left on the board. */
  lead: Record<Seat, number>;
  played: number;
}

const otherSeat = (seat: Seat): Seat => (seat === 'user' ? 'partner' : 'user');
const cache = new WeakMap<number[], ChessState>();

/** A game of chess played through, as far as its moves are legal. */
export function playChess(game: { first: Seat; moves: number[] }): ChessState {
  const held = cache.get(game.moves);
  if (held && held.whiteSeat === game.first) return held;
  let pos = startPosition();
  const ids = new Int16Array(64).fill(-1);
  for (let sq = 0; sq < 16; sq++) ids[sq] = sq;
  for (let sq = 48; sq < 64; sq++) ids[sq] = sq;
  const seatOf = (white: boolean): Seat => (white ? game.first : otherSeat(game.first));
  const taken: Record<Seat, number[]> = { user: [], partner: [] };
  const seen = new Map<string, number>();
  let legal = legalMoves(pos);
  seen.set(keyOf(pos, legal), 1);
  let last: MoveDone | null = null;
  let played = 0;
  let repeated = false;
  for (const move of game.moves) {
    if (repeated || pos.half >= 100 || !legal.length || !enoughToMate(pos.board)) break;
    const exact = legal.includes(move);
    if (!exact) break;
    const mover = seatOf(pos.white);
    const { pos: next, done } = make(pos, move);
    // The names go with the pieces.
    const id = ids[done.from];
    if (done.captured) ids[done.capturedAt] = -1;
    ids[done.to] = id;
    ids[done.from] = -1;
    if (done.castle) {
      const rookFrom = done.castle === 'short' ? done.from + 3 : done.from - 4;
      const rookTo = done.castle === 'short' ? done.from + 1 : done.from - 1;
      ids[rookTo] = ids[rookFrom];
      ids[rookFrom] = -1;
    }
    if (done.captured) taken[mover].push(Math.abs(done.captured));
    pos = next;
    last = done;
    played++;
    legal = legalMoves(pos);
    const key = keyOf(pos, legal);
    const times = (seen.get(key) ?? 0) + 1;
    seen.set(key, times);
    if (times >= 3) repeated = true;
  }
  const check = inCheck(pos);
  const turn = seatOf(pos.white);
  let over = false;
  let winner: Seat | null = null;
  let drawWhy: ChessDrawWhy | null = null;
  if (!legal.length) {
    over = true;
    if (check) winner = otherSeat(turn);
    else drawWhy = 'stalemate';
  } else if (repeated) drawWhy = 'repetition';
  else if (pos.half >= 100) drawWhy = 'fifty';
  else if (!enoughToMate(pos.board)) drawWhy = 'material';
  if (drawWhy) over = true;
  let white = 0;
  for (let sq = 0; sq < 64; sq++) white += Math.sign(pos.board[sq]) * PIECE_VALUE[Math.abs(pos.board[sq])];
  const lead = { [game.first]: Math.max(0, white), [otherSeat(game.first)]: Math.max(0, -white) } as Record<Seat, number>;
  const state: ChessState = {
    board: pos.board,
    ids,
    turn,
    whiteSeat: game.first,
    check,
    over,
    winner,
    draw: !!drawWhy,
    drawWhy,
    legal: over ? [] : legal,
    last,
    taken,
    lead,
    played
  };
  cache.set(game.moves, state);
  return state;
}

/** Whether this move may be made now. */
export const chessAllowed = (state: ChessState, move: number) => !state.over && state.legal.includes(move);

/** The squares the piece on a square can move to now. */
export function targetsFrom(state: ChessState, from: number): number[] {
  return [...new Set(state.legal.filter(m => moveFrom(m) === from).map(moveTo))];
}

/** Whether a move from one square to another is a pawn reaching the last rank, so needs a piece chosen. */
export const needsPromotion = (state: ChessState, from: number, to: number) => state.legal.some(m => moveFrom(m) === from && moveTo(m) === to && movePromo(m) > 0);

/** The piece of a seat's side, signed: + for white. */
export const sideSign = (state: Pick<ChessState, 'whiteSeat'>, seat: Seat) => (seat === state.whiteSeat ? 1 : -1);
