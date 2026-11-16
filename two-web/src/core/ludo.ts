// Ludo for two on Canvas of Us (components/LudoBoard).
//
// The classic board, the two of you in opposite corners: the bear (the first
// seat) bottom left, the bunny top right. Each of you has two tokens (Quick)
// or four (Classic), waiting in your corner. Roll a six to bring one out on
// to your start square; go once round the board and up your own home column
// to the middle - by the exact roll. Land on the other's token and it goes
// back to their corner, and you roll again; a six rolls again too, but a
// third six in a row is thrown away. The start squares and the stars are
// safe. All your tokens home wins.
//
// A move is one roll and what was done with it: roll * 8 + the token moved,
// or + 7 when there was nothing it could move (or it was a third six).

import type { Seat } from './usTwo';

export const LUDO_SIZES = [2, 4] as const;
export const DEFAULT_LUDO = 4;
/** A token's progress: in its corner; on the board 0-50; up its home column 51-55; home. */
export const IN_BASE = -1;
export const LAST_ON_TRACK = 50;
export const HOME = 56;
export const PASS = 7;

/** The squares round the board, from the top of the left arm going clockwise, as [row, col] of the 15 by 15 grid. */
export const TRACK: ReadonlyArray<readonly [number, number]> = (() => {
  const t: Array<[number, number]> = [];
  for (let c = 1; c <= 5; c++) t.push([6, c]);
  for (let r = 5; r >= 0; r--) t.push([r, 6]);
  t.push([0, 7]);
  for (let r = 0; r <= 5; r++) t.push([r, 8]);
  for (let c = 9; c <= 14; c++) t.push([6, c]);
  t.push([7, 14]);
  for (let c = 14; c >= 9; c--) t.push([8, c]);
  for (let r = 9; r <= 14; r++) t.push([r, 8]);
  t.push([14, 7]);
  for (let r = 14; r >= 9; r--) t.push([r, 6]);
  for (let c = 5; c >= 0; c--) t.push([8, c]);
  t.push([7, 0]);
  t.push([6, 0]);
  return t;
})();

/** Where each of you comes out on to the board: the bear bottom left, the bunny top right. */
export const START: Record<Seat, number> = { user: 39, partner: 13 };
/** Every corner's start square, and the stars eight on from each: nobody is taken on these. */
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Each of you's home column, from the board in to just short of the middle. */
export const HOME_COLUMN: Record<Seat, ReadonlyArray<readonly [number, number]>> = {
  user: [13, 12, 11, 10, 9].map(r => [r, 7] as const),
  partner: [1, 2, 3, 4, 5].map(r => [r, 7] as const)
};

/** The square of the board a token stands on, round the track: -1 when it is not on the track. */
export const trackSquare = (seat: Seat, p: number) => (p >= 0 && p <= LAST_ON_TRACK ? (START[seat] + p) % TRACK.length : -1);

export interface LudoCapture {
  seat: Seat;
  token: number;
  from: number;
}

export interface LudoStep {
  seat: Seat;
  roll: number;
  /** The token moved, or -1 when the roll could not be used. */
  token: number;
  from: number;
  to: number;
  captured: LudoCapture[];
  /** A third six in a row: thrown away. */
  forfeit: boolean;
  /** It earned another roll. */
  again: boolean;
}

export interface LudoState {
  /** Each of you's tokens, by progress. */
  pos: Record<Seat, number[]>;
  turn: Seat;
  /** Sixes rolled in a row this turn. */
  sixes: number;
  over: boolean;
  winner: Seat | null;
  last: LudoStep | null;
  played: number;
  /** Tokens home, each of you. */
  home: Record<Seat, number>;
}

const other = (seat: Seat): Seat => (seat === 'user' ? 'partner' : 'user');

/** Where a token would go with this roll, or null when it cannot move. */
export function ludoTarget(p: number, roll: number): number | null {
  if (p === IN_BASE) return roll === 6 ? 0 : null;
  if (p >= HOME) return null;
  const to = p + roll;
  return to > HOME ? null : to;
}

/** The tokens that can be moved with this roll. None when it is a third six. */
export function movableTokens(state: Pick<LudoState, 'pos' | 'turn' | 'sixes'>, roll: number): number[] {
  if (roll === 6 && state.sixes >= 2) return [];
  return state.pos[state.turn].map((p, i) => (ludoTarget(p, roll) === null ? -1 : i)).filter(i => i >= 0);
}

export const ludoMove = (roll: number, token: number) => roll * 8 + (token < 0 ? PASS : token);
export const ludoRoll = (move: number) => Math.floor(move / 8);
export const ludoToken = (move: number) => move % 8;

export function playLudo(game: { first: Seat; moves: number[]; size: number }): LudoState {
  const n = (LUDO_SIZES as readonly number[]).includes(game.size) ? game.size : DEFAULT_LUDO;
  const pos: Record<Seat, number[]> = { user: new Array(n).fill(IN_BASE), partner: new Array(n).fill(IN_BASE) };
  let turn = game.first;
  let sixes = 0;
  let winner: Seat | null = null;
  let last: LudoStep | null = null;
  let played = 0;
  for (const move of game.moves) {
    if (winner || !Number.isInteger(move) || move < 8 || move >= 7 * 8) break;
    const roll = ludoRoll(move);
    const token = ludoToken(move);
    const can = movableTokens({ pos, turn, sixes }, roll);
    const forfeit = roll === 6 && sixes >= 2;
    if (can.length ? !can.includes(token) : token !== PASS) break;
    played++;
    const step: LudoStep = { seat: turn, roll, token: can.length ? token : -1, from: 0, to: 0, captured: [], forfeit, again: false };
    if (can.length) {
      const from = pos[turn][token];
      const to = ludoTarget(from, roll)!;
      step.from = from;
      step.to = to;
      pos[turn][token] = to;
      const square = trackSquare(turn, to);
      if (square >= 0 && !SAFE.has(square)) {
        const foe = other(turn);
        pos[foe].forEach((q, i) => {
          if (trackSquare(foe, q) === square) {
            step.captured.push({ seat: foe, token: i, from: q });
            pos[foe][i] = IN_BASE;
          }
        });
      }
      if (pos[turn].every(q => q === HOME)) winner = turn;
    }
    step.again = !forfeit && (roll === 6 || step.captured.length > 0);
    last = step;
    if (winner) break;
    if (step.again) sixes = roll === 6 ? sixes + 1 : 0;
    else {
      sixes = 0;
      turn = other(turn);
    }
  }
  const home = { user: pos.user.filter(q => q === HOME).length, partner: pos.partner.filter(q => q === HOME).length };
  return { pos, turn, sixes, over: !!winner, winner, last, played, home };
}

/** Whether this move may be made now, by whoever's turn it is. */
export function ludoAllowed(state: LudoState, move: number): boolean {
  if (state.over || !Number.isInteger(move)) return false;
  const roll = ludoRoll(move);
  const token = ludoToken(move);
  if (roll < 1 || roll > 6) return false;
  const can = movableTokens(state, roll);
  return can.length ? can.includes(token) : token === PASS;
}
