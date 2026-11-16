import { describe, expect, it } from 'vitest';
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK, chessAllowed, chessMove, moveFrom, moveTo, needsPromotion, playChess, targetsFrom } from './chess';
import { HOME, IN_BASE, LUDO_SIZES, PASS, SAFE, START, TRACK, ludoMove, ludoTarget, movableTokens, playLudo, trackSquare } from './ludo';
import { canMove, cleanGame, kindOfRecord, newGame, recordTypeOf, sizesOf, standing, withMove, type PaperGame } from './paperGames';
import { GAME_TOURS } from './gameTours';
import { TA } from './i18n.ta';

/** A square by its name: "e4". */
const sq = (name: string) => (name.charCodeAt(0) - 97) + (Number(name[1]) - 1) * 8;
/** A move by its squares: "e2e4", "e7e8q". */
const mv = (text: string) => chessMove(sq(text.slice(0, 2)), sq(text.slice(2, 4)), text[4] ? 'qrbn'.indexOf(text[4]) + 1 : 0);
const chess = (moves: string[], first: 'user' | 'partner' = 'user') => playChess({ first, moves: moves.map(mv) });

/** How many games there are this many moves deep: the standard count, the surest check of a move maker. */
function perft(moves: number[], depth: number): number {
  const s = playChess({ first: 'user', moves });
  if (depth === 0) return 1;
  if (depth === 1) return s.legal.length;
  let n = 0;
  for (const m of s.legal) n += perft([...moves, m], depth - 1);
  return n;
}

describe('chess: the moves', () => {
  it('makes exactly the moves there are, from the start', () => {
    expect(perft([], 1)).toBe(20);
    expect(perft([], 2)).toBe(400);
    expect(perft([], 3)).toBe(8902);
  });

  it('the one with white is whoever moves first; and no move out of turn', () => {
    const s = chess([]);
    expect(s.whiteSeat).toBe('user');
    expect(s.turn).toBe('user');
    expect(chess(['e2e4']).turn).toBe('partner');
    expect(chess([], 'partner').turn).toBe('partner');
    expect(chessAllowed(s, mv('e7e5'))).toBe(false);
    expect(chessAllowed(s, mv('e2e5'))).toBe(false);
    expect(targetsFrom(s, sq('g1')).sort()).toEqual([sq('f3'), sq('h3')].sort());
  });

  it('a move that is not legal ends the game there: nothing after it counts', () => {
    const s = chess(['e2e4', 'e7e5', 'e1e3', 'd7d6']);
    expect(s.played).toBe(2);
  });

  it("fool's mate is checkmate, and the side that mated wins", () => {
    const s = chess(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(s.check).toBe(true);
    expect(s.over).toBe(true);
    expect(s.winner).toBe('partner');
    expect(s.legal).toEqual([]);
  });

  it('castles on either side, and not through check', () => {
    const short = chess(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1']);
    expect(short.board[sq('g1')]).toBe(KING);
    expect(short.board[sq('f1')]).toBe(ROOK);
    expect(short.board[sq('h1')]).toBe(0);
    expect(short.last?.castle).toBe('short');
    const long = chess(['d2d4', 'd7d5', 'b1c3', 'b8c6', 'c1f4', 'c8f5', 'd1d2', 'd8d7', 'e1c1']);
    expect(long.board[sq('c1')]).toBe(KING);
    expect(long.board[sq('d1')]).toBe(ROOK);
    // A bishop eyeing f1: the king may not castle through it.
    const blocked = chess(['e2e4', 'b7b6', 'g1f3', 'c8a6', 'f1e2', 'a6e2', 'd1e2', 'e7e6', 'e2d3', 'f8c5', 'd3b5', 'c5f2']);
    expect(blocked.check).toBe(true);
    expect(chessAllowed(blocked, mv('e1g1'))).toBe(false);
  });

  it('takes en passant, only straight after the two-square move', () => {
    const s = chess(['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']);
    expect(s.board[sq('d6')]).toBe(PAWN);
    expect(s.board[sq('d5')]).toBe(0);
    expect(s.last?.captured).toBe(-PAWN);
    expect(s.taken.user).toEqual([PAWN]);
    const late = chess(['e2e4', 'a7a6', 'e4e5', 'd7d5', 'h2h3', 'h7h6']);
    expect(chessAllowed(late, mv('e5d6'))).toBe(false);
  });

  it('a pawn on the last rank must become something, and becomes what was chosen', () => {
    const moves = ['h2h4', 'g7g5', 'h4g5', 'h7h6', 'g5h6', 'f8g7', 'h6g7', 'a7a6'];
    const before = chess(moves);
    expect(needsPromotion(before, sq('g7'), sq('h8'))).toBe(true);
    expect(chessAllowed(before, mv('g7h8'))).toBe(false);
    const queen = chess([...moves, 'g7h8q']);
    expect(queen.board[sq('h8')]).toBe(QUEEN);
    expect(queen.last?.promo).toBe(QUEEN);
    expect(chess([...moves, 'g7h8n']).board[sq('h8')]).toBe(KNIGHT);
    expect(chess([...moves, 'g7h8b']).board[sq('h8')]).toBe(BISHOP);
    // Taking on the way up counts the same as going straight.
    expect(chess([...moves, 'g7h8r']).taken.user).toEqual([PAWN, PAWN, BISHOP, ROOK]);
  });

  it('stalemate and too little left are draws; the same position three times is a draw', () => {
    // The quickest stalemate there is.
    const stale = chess(['e2e3', 'a7a5', 'd1h5', 'a8a6', 'h5a5', 'h7h5', 'h2h4', 'a6h6', 'a5c7', 'f7f6', 'c7d7', 'e8f7', 'd7b7', 'd8d3', 'b7b8', 'd3h7', 'b8c8', 'f7g6', 'c8e6']);
    expect(stale.over).toBe(true);
    expect(stale.draw).toBe(true);
    expect(stale.drawWhy).toBe('stalemate');
    const shuffle = chess(['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
    expect(shuffle.drawWhy).toBe('repetition');
    expect(shuffle.over).toBe(true);
  });

  it('keeps who is ahead, and gives each piece a name that goes with it', () => {
    const s = chess(['e2e4', 'd7d5', 'e4d5', 'd8d5']);
    expect(s.taken).toEqual({ user: [PAWN], partner: [PAWN] });
    expect(s.lead).toEqual({ user: 0, partner: 0 });
    const ahead = chess(['e2e4', 'd7d5', 'e4d5', 'g8f6', 'd1f3', 'f6d5', 'f3f7']);
    expect(ahead.lead.user).toBe(1);
    const a = chess(['g1f3']);
    expect(a.ids[sq('f3')]).toBe(sq('g1'));
    expect(a.ids[sq('g1')]).toBe(-1);
    expect(moveFrom(mv('e7e8q'))).toBe(sq('e7'));
    expect(moveTo(mv('e7e8q'))).toBe(sq('e8'));
  });
});

describe('ludo: the rules', () => {
  const lg = (moves: number[], size = 4, first: 'user' | 'partner' = 'user') => playLudo({ first, moves, size });

  it('has 52 squares round the board, every one once, and the two corners opposite', () => {
    expect(TRACK.length).toBe(52);
    expect(new Set(TRACK.map(p => p.join())).size).toBe(52);
    expect((START.partner - START.user + 52) % 52).toBe(26);
    for (const s of [START.user, START.partner]) expect(SAFE.has(s)).toBe(true);
    expect(LUDO_SIZES).toEqual([2, 4]);
    expect(trackSquare('user', 0)).toBe(START.user);
    expect(trackSquare('user', 51)).toBe(-1);
  });

  it('a six brings a token out and rolls again; anything else does not', () => {
    expect(ludoTarget(IN_BASE, 5)).toBeNull();
    expect(ludoTarget(IN_BASE, 6)).toBe(0);
    expect(ludoTarget(54, 2)).toBe(HOME);
    expect(ludoTarget(54, 3)).toBeNull();
    let s = lg([]);
    expect(movableTokens(s, 3)).toEqual([]);
    expect(movableTokens(s, 6)).toEqual([0, 1, 2, 3]);
    s = lg([ludoMove(3, -1)]);
    expect(s.turn).toBe('partner');
    s = lg([ludoMove(6, 0)]);
    expect(s.pos.user[0]).toBe(0);
    expect(s.turn).toBe('user');
    expect(s.last?.again).toBe(true);
    s = lg([ludoMove(6, 0), ludoMove(4, 0)]);
    expect(s.pos.user[0]).toBe(4);
    expect(s.turn).toBe('partner');
  });

  it('a third six in a row is thrown away, and the turn goes over', () => {
    const s = lg([ludoMove(6, 0), ludoMove(6, 0), ludoMove(6, PASS)]);
    expect(s.pos.user[0]).toBe(6);
    expect(s.last?.forfeit).toBe(true);
    expect(s.turn).toBe('partner');
    // Using a third six is no move at all.
    expect(lg([ludoMove(6, 0), ludoMove(6, 0), ludoMove(6, 0)]).played).toBe(2);
  });

  /** The bunny goes first, comes out and walks `steps` round, while the bear (all in its corner) can only pass. */
  const bunnyWalks = (steps: number) => {
    const moves = [ludoMove(6, 0)];
    let left = steps;
    while (left > 0) {
      const r = Math.min(5, left);
      moves.push(ludoMove(r, 0));
      left -= r;
      if (left > 0) moves.push(ludoMove(1, PASS));
    }
    return moves;
  };

  it('landing on the other one sends it home and rolls again', () => {
    // The bunny ends two squares past the bear's start; the bear comes out and lands on it.
    const steps = (START.user + 2 - START.partner + 52) % 52;
    const before = lg(bunnyWalks(steps), 4, 'partner');
    expect(trackSquare('partner', before.pos.partner[0])).toBe((START.user + 2) % 52);
    expect(before.turn).toBe('user');
    const s = lg([...bunnyWalks(steps), ludoMove(6, 0), ludoMove(2, 0)], 4, 'partner');
    expect(s.pos.user[0]).toBe(2);
    expect(s.pos.partner[0]).toBe(IN_BASE);
    expect(s.last?.captured).toEqual([{ seat: 'partner', token: 0, from: steps }]);
    expect(s.last?.again).toBe(true);
    expect(s.turn).toBe('user');
  });

  it('but not on a star or a start square: both stay', () => {
    // The star eight on from the bear's start.
    const steps = (START.user + 8 - START.partner + 52) % 52;
    expect(SAFE.has((START.user + 8) % 52)).toBe(true);
    const s = lg([...bunnyWalks(steps), ludoMove(6, 0), ludoMove(6, 0), ludoMove(2, 0)], 4, 'partner');
    expect(s.pos.user[0]).toBe(8);
    expect(s.pos.partner[0]).toBe(steps);
    expect(s.last?.captured).toEqual([]);
  });

  it('all tokens home wins', () => {
    // Two tokens; walked home by exact rolls, the other one only ever passing.
    const moves: number[] = [];
    for (const token of [0, 1]) {
      moves.push(ludoMove(6, token));
      let p = 0;
      while (p < HOME) {
        const r = Math.min(5, HOME - p);
        moves.push(ludoMove(r, token));
        p += r;
        if (p < HOME || token === 0) moves.push(ludoMove(1, PASS));
      }
    }
    const s = lg(moves, 2);
    expect(s.pos.user).toEqual([HOME, HOME]);
    expect(s.over).toBe(true);
    expect(s.winner).toBe('user');
    expect(s.home.user).toBe(2);
  });
});

describe('ludo and chess as games on Canvas of Us', () => {
  const base = (kind: 'ludo' | 'chess', size?: number): PaperGame => newGame(kind, undefined, 'user', `g-${kind}`, 1, size);

  it('are kept as their own records, with their sizes, a how-to-play and Tamil', () => {
    expect(recordTypeOf('ludo')).toBe('GAME_LUDO');
    expect(recordTypeOf('chess')).toBe('GAME_CHESS');
    expect(kindOfRecord('GAME_CHESS')).toBe('chess');
    expect(sizesOf('ludo')).toEqual([2, 4]);
    expect(base('ludo', 2).size).toBe(2);
    expect(base('ludo').size).toBe(4);
    for (const k of ['ludo', 'chess'] as const) {
      expect(GAME_TOURS[k].length).toBeGreaterThanOrEqual(5);
      for (const line of GAME_TOURS[k]) expect(TA[line.text], line.text).toBeTruthy();
    }
    expect(TA.Ludo).toBeTruthy();
    expect(TA.Chess).toBeTruthy();
  });

  it('only the one whose turn it is may move, and only a legal move', () => {
    const c = base('chess');
    expect(canMove(c, 'user', mv('e2e4'))).toBe(true);
    expect(canMove(c, 'partner', mv('e7e5'))).toBe(false);
    expect(canMove(c, 'user', mv('e2e5'))).toBe(false);
    const after = withMove(c, mv('e2e4'), 'user');
    expect(standing(after).turn).toBe('partner');
    const l = base('ludo');
    expect(canMove(l, 'user', ludoMove(3, PASS))).toBe(true);
    expect(canMove(l, 'user', ludoMove(3, 0))).toBe(false);
    expect(canMove(l, 'user', ludoMove(6, 2))).toBe(true);
    expect(canMove(l, 'partner', ludoMove(6, 0))).toBe(false);
  });

  it('a game from the other phone keeps only its legal moves', () => {
    const c = { ...base('chess'), moves: [mv('e2e4'), mv('e7e5'), mv('e1e5'), mv('d7d6')] };
    expect(cleanGame(c, 'chess')!.moves).toEqual([mv('e2e4'), mv('e7e5')]);
    const l = { ...base('ludo'), moves: [ludoMove(6, 0), ludoMove(6, 0), ludoMove(6, 0)] };
    expect(cleanGame(l, 'ludo')!.moves.length).toBe(2);
    expect(cleanGame({ ...base('ludo'), size: 3 }, 'ludo')).toBeNull();
  });

  it('a new game swaps who has white', () => {
    const first = base('chess');
    expect(playChess(first).whiteSeat).toBe('user');
    const second = newGame('chess', first, 'user', 'g2', 2);
    expect(playChess(second).whiteSeat).toBe('partner');
  });
});
