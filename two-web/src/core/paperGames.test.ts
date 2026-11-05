import { describe, expect, it } from 'vitest';
import {
  boxesBeside,
  canMove,
  cleanGame,
  hLine,
  lineAt,
  lineCount,
  lookOf,
  mergeGame,
  newGame,
  playDots,
  playTtt,
  sidesOf,
  standing,
  totals,
  vLine,
  withLook,
  withMove,
  type PaperGame
} from './paperGames';

const ttt = (moves: number[], first: 'user' | 'partner' = 'user'): PaperGame => ({
  kind: 'ttt',
  id: 'g1',
  startedAt: 1,
  first,
  size: 3,
  moves,
  before: { user: 0, partner: 0, draws: 0 },
  looks: {}
});
const dots = (moves: number[], size = 3, first: 'user' | 'partner' = 'user'): PaperGame => ({
  kind: 'dots',
  id: 'd1',
  startedAt: 1,
  first,
  size,
  moves,
  before: { user: 0, partner: 0, draws: 0 },
  looks: {}
});
/** Plays moves one at a time, each by whoever's turn it is - as the app does. */
function play(game: PaperGame, moves: number[]): PaperGame {
  return moves.reduce((g, m) => {
    const turn = standing(g).turn;
    if (!canMove(g, turn, m)) throw new Error(`move ${m} not allowed`);
    return withMove(g, m);
  }, game);
}

describe('Tic-tac-toe', () => {
  it('takes turns, starting with whoever goes first', () => {
    expect(playTtt(ttt([], 'partner')).turn).toBe('partner');
    const s = playTtt(ttt([4, 0]));
    expect(s.board[4]).toBe('user');
    expect(s.board[0]).toBe('partner');
    expect(s.turn).toBe('user');
  });

  it('finds a win across, down and corner to corner', () => {
    expect(playTtt(ttt([0, 3, 1, 4, 2])).line).toEqual([0, 1, 2]);
    expect(playTtt(ttt([1, 0, 2, 3, 4, 6])).line).toEqual([0, 3, 6]);
    const diag = playTtt(ttt([0, 1, 4, 2, 8]));
    expect(diag.winner).toBe('user');
    expect(diag.line).toEqual([0, 4, 8]);
    expect(diag.over).toBe(true);
  });

  it('calls a full board with no line a draw', () => {
    // X O X / X O O / O X X
    const s = playTtt(ttt([0, 1, 2, 4, 3, 5, 7, 6, 8]));
    expect(s.winner).toBeNull();
    expect(s.draw).toBe(true);
    expect(s.over).toBe(true);
  });

  it('a win on the last square is a win, not a draw', () => {
    // X O X / O X O / O X [X]
    const s = playTtt(ttt([0, 1, 2, 3, 4, 5, 7, 6, 8]));
    expect(s.winner).toBe('user');
    expect(s.draw).toBe(false);
  });

  it('plays nothing on a taken square, out of range, or after a win', () => {
    expect(playTtt(ttt([4, 4, 0])).played).toBe(1);
    expect(playTtt(ttt([9])).played).toBe(0);
    expect(playTtt(ttt([0, 3, 1, 4, 2, 5])).played).toBe(5);
  });

  it('lets only the player whose turn it is move, on an empty square', () => {
    const g = ttt([4]);
    expect(canMove(g, 'user', 0)).toBe(false);
    expect(canMove(g, 'partner', 4)).toBe(false);
    expect(canMove(g, 'partner', 0)).toBe(true);
    expect(canMove(ttt([0, 3, 1, 4, 2]), 'partner', 8)).toBe(false);
  });
});

describe('Dots and Boxes', () => {
  it('numbers every line once, and finds each line again', () => {
    for (const n of [3, 4, 5]) {
      const seen = new Set<number>();
      for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) seen.add(hLine(n, r, c));
      for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) seen.add(vLine(n, r, c));
      expect(seen.size).toBe(lineCount(n));
      expect(Math.max(...seen)).toBe(lineCount(n) - 1);
      for (let i = 0; i < lineCount(n); i++) {
        const { row, col, across } = lineAt(n, i);
        expect(across ? hLine(n, row, col) : vLine(n, row, col)).toBe(i);
      }
    }
  });

  it('knows the box or two beside each line', () => {
    expect(boxesBeside(3, hLine(3, 0, 1))).toEqual([1]);
    expect(boxesBeside(3, hLine(3, 1, 1))).toEqual([1, 4]);
    expect(boxesBeside(3, vLine(3, 2, 0))).toEqual([6]);
    expect(boxesBeside(3, vLine(3, 1, 3))).toEqual([5]);
    expect(boxesBeside(3, vLine(3, 1, 1))).toEqual([3, 4]);
  });

  it('passes the turn when no box closes, and gives the box and another go when one does', () => {
    const [top, bottom, left, right] = sidesOf(3, 0, 0);
    let g = play(dots([]), [top, bottom, left]);
    expect(playDots(g).turn).toBe('partner');
    g = play(g, [right]);
    const s = playDots(g);
    expect(s.boxes[0]).toBe('partner');
    expect(s.scores.partner).toBe(1);
    expect(s.closed).toEqual([0]);
    expect(s.turn).toBe('partner');
  });

  it('closes two boxes with one line', () => {
    // Boxes 0 and 1 share the line between them; draw everything else first.
    const shared = vLine(3, 0, 1);
    const others = [...new Set([...sidesOf(3, 0, 0), ...sidesOf(3, 0, 1)])].filter(l => l !== shared);
    const g = play(dots([]), [...others, shared]);
    const s = playDots(g);
    expect(s.closed.sort()).toEqual([0, 1]);
    expect(s.boxes[0]).toBe(s.boxes[1]);
  });

  it('ends when every line is drawn, with the boxes all given and the winner counted', () => {
    let g = dots([], 3);
    for (let i = 0; i < lineCount(3); i++) g = play(g, [i]);
    const s = playDots(g);
    expect(s.over).toBe(true);
    expect(s.boxes.every(Boolean)).toBe(true);
    expect(s.scores.user + s.scores.partner).toBe(9);
    expect(s.winner).toBe(s.scores.user > s.scores.partner ? 'user' : 'partner');
    expect(s.draw).toBe(false);
  });

  it('allows a draw on an even board', () => {
    let g = dots([], 4);
    for (let i = 0; i < lineCount(4); i++) g = play(g, [i]);
    const s = playDots(g);
    expect(s.over).toBe(true);
    expect(s.scores.user + s.scores.partner).toBe(16);
    expect(s.draw).toBe(s.scores.user === 8);
  });

  it('plays nothing twice, nothing off the board, nothing out of turn', () => {
    expect(playDots(dots([0, 0, 1])).played).toBe(1);
    expect(playDots(dots([lineCount(3)])).played).toBe(0);
    const g = dots([0]);
    expect(canMove(g, 'user', 1)).toBe(false);
    expect(canMove(g, 'partner', 0)).toBe(false);
    expect(canMove(g, 'partner', 1)).toBe(true);
  });
});

describe('games over time', () => {
  it('a new game carries the score on, swaps who goes first, keeps the looks', () => {
    const won = withLook(ttt([0, 3, 1, 4, 2]), 'partner', { ink: '#10b981' }, 5);
    expect(totals(won)).toEqual({ user: 1, partner: 0, draws: 0 });
    const next = newGame('ttt', won, 'partner', 'g2', 10);
    expect(next.first).toBe('partner');
    expect(next.before).toEqual({ user: 1, partner: 0, draws: 0 });
    expect(next.moves).toEqual([]);
    expect(next.looks.partner?.ink).toBe('#10b981');
  });

  it('an abandoned game counts for nobody', () => {
    const next = newGame('ttt', ttt([0, 4]), 'user', 'g2', 10);
    expect(next.before).toEqual({ user: 0, partner: 0, draws: 0 });
  });

  it('the very first game is started by its starter; dots keeps its board size', () => {
    expect(newGame('ttt', undefined, 'partner', 'a', 1).first).toBe('partner');
    expect(newGame('dots', undefined, 'user', 'a', 1, 5).size).toBe(5);
    expect(newGame('dots', dots([], 5), 'user', 'b', 2).size).toBe(5);
    expect(newGame('dots', undefined, 'user', 'a', 1, 9).size).toBe(4);
  });
});

describe('mergeGame', () => {
  it('takes the copy further on, and keeps its own when the other is behind', () => {
    const a = ttt([4]);
    const b = ttt([4, 0]);
    expect(mergeGame(a, b).moves).toEqual([4, 0]);
    expect(mergeGame(b, a)).toBe(b);
    expect(mergeGame(a, ttt([4]))).toBe(a);
  });

  it('never takes a copy that disagrees about the moves so far', () => {
    const a = ttt([4, 0]);
    expect(mergeGame(a, ttt([1, 2, 3]))).toBe(a);
  });

  it('a newer game replaces an older one, the same way on both phones', () => {
    const old = ttt([4, 0]);
    const fresh = { ...ttt([]), id: 'g2', startedAt: 5 };
    expect(mergeGame(old, fresh).id).toBe('g2');
    expect(mergeGame(fresh, old).id).toBe('g2');
    // Started in the same millisecond: decided by id, on both phones alike.
    const x = { ...ttt([]), id: 'x', startedAt: 7 };
    const y = { ...ttt([]), id: 'y', startedAt: 7 };
    expect(mergeGame(x, y).id).toBe('y');
    expect(mergeGame(y, x).id).toBe('y');
  });

  it('each of you keeps the look chosen last, whichever copy has the moves', () => {
    const mine = withLook(ttt([4]), 'user', { ink: '#8b5cf6' }, 20);
    const theirs = withLook(ttt([4, 0]), 'partner', { mark: 'star' }, 15);
    const m = mergeGame(mine, theirs);
    expect(m.moves).toEqual([4, 0]);
    expect(m.looks.user?.ink).toBe('#8b5cf6');
    expect(m.looks.partner?.mark).toBe('star');
  });
});

describe('lookOf', () => {
  it('gives each seat its default until chosen', () => {
    expect(lookOf(undefined, 'user')).toEqual({ ink: '#0ea5e9', mark: 'x' });
    expect(lookOf(undefined, 'partner')).toEqual({ ink: '#f43f5e', mark: 'heart' });
  });

  it('never shows the two of you in the same ink or mark', () => {
    let g = withLook(ttt([]), 'user', { ink: '#10b981', mark: 'star' }, 10);
    g = withLook(g, 'partner', { ink: '#10b981', mark: 'star' }, 12);
    const u = lookOf(g, 'user');
    const p = lookOf(g, 'partner');
    expect(u).toEqual({ ink: '#10b981', mark: 'star' });
    expect(p.ink).not.toBe(u.ink);
    expect(p.mark).not.toBe(u.mark);
  });
});

describe('cleanGame', () => {
  it('keeps a good game as it is', () => {
    const g = withLook(ttt([4, 0]), 'user', { ink: '#8b5cf6' }, 3);
    expect(cleanGame(JSON.parse(JSON.stringify(g)), 'ttt')).toEqual(g);
  });

  it('drops anything malformed, and moves past the first illegal one', () => {
    expect(cleanGame(null, 'ttt')).toBeNull();
    expect(cleanGame({ ...ttt([]), kind: 'dots' }, 'ttt')).toBeNull();
    expect(cleanGame({ ...ttt([]), first: 'someone' }, 'ttt')).toBeNull();
    expect(cleanGame({ ...dots([]), size: 12 }, 'dots')).toBeNull();
    expect(cleanGame({ ...ttt([4, 4, 1]) }, 'ttt')?.moves).toEqual([4]);
    const odd = cleanGame({ ...ttt([]), looks: { user: { ink: 'red', mark: 'x', at: 1 } }, before: { user: -3, partner: 'x', draws: 2 } }, 'ttt');
    expect(odd?.looks.user).toBeUndefined();
    expect(odd?.before).toEqual({ user: 0, partner: 0, draws: 2 });
  });
});
