import { describe, expect, it } from 'vitest';
import {
  FOUR_COLS,
  HHK_TO_WIN,
  LADDERS,
  SNAKES,
  canMove,
  cleanGame,
  deckOf,
  hhkBeats,
  kindOfRecord,
  mergeGame,
  newGame,
  playFour,
  playHhk,
  playMemory,
  playSnakes,
  recordTypeOf,
  standing,
  withMove,
  type PaperGame
} from './paperGames';

// Four in a Row, Memory Match, Heart Hug Kiss and Snakes & Ladders
// (core/paperGames; Tic-tac-toe and Dots and Boxes are in paperGames.test).

const base = (kind: PaperGame['kind'], moves: number[], size: number, first: 'user' | 'partner' = 'user'): PaperGame => ({
  kind,
  id: `${kind}-1`,
  startedAt: 1,
  first,
  size,
  moves,
  before: { user: 0, partner: 0, draws: 0 },
  looks: {}
});

describe('records', () => {
  it('each game has its own record type, and finds its way back', () => {
    for (const k of ['ttt', 'dots', 'four', 'memory', 'hhk', 'snakes'] as const) expect(kindOfRecord(recordTypeOf(k))).toBe(k);
    expect(kindOfRecord('CHAT')).toBeNull();
  });
});

describe('Four in a Row', () => {
  const four = (moves: number[], first: 'user' | 'partner' = 'user') => base('four', moves, 7, first);

  it('drops each disc to the lowest free row of its column', () => {
    const s = playFour(four([3, 3, 3]));
    expect(s.grid[5 * FOUR_COLS + 3]).toBe('user');
    expect(s.grid[4 * FOUR_COLS + 3]).toBe('partner');
    expect(s.grid[3 * FOUR_COLS + 3]).toBe('user');
    expect(s.last).toBe(3 * FOUR_COLS + 3);
  });

  it('wins across, down and on both diagonals', () => {
    const across = playFour(four([0, 0, 1, 1, 2, 2, 3]));
    expect(across.winner).toBe('user');
    expect(across.line).toEqual([35, 36, 37, 38]);
    expect(playFour(four([0, 1, 0, 1, 0, 1, 0])).line).toEqual([14, 21, 28, 35]);
    // Up to the right: the user's discs climb a staircase.
    const rising = playFour(four([0, 1, 1, 2, 2, 3, 2, 3, 3, 5, 3]));
    expect(rising.winner).toBe('user');
    expect(rising.line).toEqual([17, 23, 29, 35]);
    // Up to the left, the mirror of it.
    const falling = playFour(four([6, 5, 5, 4, 4, 3, 4, 3, 3, 1, 3]));
    expect(falling.winner).toBe('user');
    expect(falling.line).toEqual([17, 25, 33, 41]);
  });

  it('a full column takes no more, and nothing is played after a win', () => {
    const full = four([2, 2, 2, 2, 2, 2]);
    expect(canMove(full, 'user', 2)).toBe(false);
    expect(canMove(full, 'user', 1)).toBe(true);
    expect(playFour(four([2, 2, 2, 2, 2, 2, 2])).played).toBe(6);
    expect(playFour(four([0, 0, 1, 1, 2, 2, 3, 4])).played).toBe(7);
  });

  it('a full board with no four is a draw', () => {
    // Each column filled user, partner, user, partner... starting from a
    // different seat every column pair, so nothing ever lines up.
    const order: number[] = [];
    for (const [a, b] of [[0, 1], [2, 3], [4, 5]]) {
      for (let k = 0; k < 3; k++) order.push(a, b);
      for (let k = 0; k < 3; k++) order.push(b, a);
    }
    for (let k = 0; k < 6; k++) order.push(6);
    const s = playFour(four(order));
    expect(s.played).toBe(42);
    expect(s.winner).toBeNull();
    expect(s.draw).toBe(true);
    expect(s.over).toBe(true);
  });
});

describe('Memory Match', () => {
  const mem = (moves: number[], size = 6) => base('memory', moves, size);
  const deck = deckOf({ id: 'memory-1', size: 6 });
  const pairOf = (card: number) => deck.findIndex((f, i) => i !== card && f === deck[card]);

  it('deals the same deck from the same game, two of each face', () => {
    const a = deckOf({ id: 'g-1', size: 8 });
    expect(deckOf({ id: 'g-1', size: 8 })).toEqual(a);
    expect(a).toHaveLength(16);
    const counts = new Map<number, number>();
    a.forEach(f => counts.set(f, (counts.get(f) || 0) + 1));
    expect([...counts.values()].every(n => n === 2)).toBe(true);
    expect(deckOf({ id: 'g-2', size: 8 })).not.toEqual(a);
  });

  it('a pair is yours and you go again', () => {
    const s = playMemory(mem([0, pairOf(0)]));
    expect(s.owner[0]).toBe('user');
    expect(s.scores.user).toBe(1);
    expect(s.turn).toBe('user');
    expect(s.result).toBe('match');
    expect(standing(mem([0, pairOf(0)])).again).toBe(true);
  });

  it('a miss passes the turn, and both stay up until the next card is turned', () => {
    const mate = pairOf(0);
    const miss = deck.findIndex((f, i) => i > 1 && i !== mate && f !== deck[1]);
    let s = playMemory(mem([0, mate, 1, miss]));
    expect(s.result).toBe('miss');
    expect(s.turn).toBe('partner');
    expect([...s.up].sort()).toEqual([1, miss].sort());
    s = playMemory(mem([0, mate, 1, miss, 1]));
    expect(s.up).toEqual([1]);
    expect(s.pending).toBe(1);
  });

  it('a found card, or the same card twice, is not a move', () => {
    const mate = pairOf(0);
    expect(playMemory(mem([0, mate, 0])).played).toBe(2);
    expect(playMemory(mem([1, 1])).played).toBe(1);
    expect(canMove(mem([0, mate]), 'user', mate)).toBe(false);
    expect(canMove(mem([0, mate]), 'partner', 1)).toBe(false);
    expect(canMove(mem([0, mate]), 'user', 1)).toBe(true);
  });

  it('ends when every pair is found, the one with more pairs winning', () => {
    const moves: number[] = [];
    const done = new Set<number>();
    for (let c = 0; c < deck.length; c++) {
      if (done.has(c)) continue;
      moves.push(c, pairOf(c));
      done.add(c).add(pairOf(c));
    }
    const s = playMemory(mem(moves));
    expect(s.over).toBe(true);
    expect(s.scores.user).toBe(6);
    expect(s.winner).toBe('user');
    expect(standing(mem(moves)).toMove).toEqual([]);
  });
});

describe('Heart Hug Kiss', () => {
  const hhk = (user: number[], partner: number[]): PaperGame => ({ ...base('hhk', [], 3), picks: { user, partner } });

  it('a hug holds a heart, a kiss wins a hug, a heart outlasts a kiss', () => {
    expect(hhkBeats(1, 0)).toBe(true);
    expect(hhkBeats(2, 1)).toBe(true);
    expect(hhkBeats(0, 2)).toBe(true);
    expect(hhkBeats(0, 1)).toBe(false);
    expect(hhkBeats(1, 1)).toBe(false);
  });

  it('both choose, each once a round, and a round counts once both have', () => {
    let g = hhk([], []);
    expect(standing(g).toMove).toEqual(['user', 'partner']);
    g = withMove(g, 1, 'user');
    expect(standing(g).toMove).toEqual(['partner']);
    expect(canMove(g, 'user', 0)).toBe(false);
    expect(canMove(g, 'partner', 2)).toBe(true);
    expect(playHhk(g).rounds).toHaveLength(0);
    g = withMove(g, 0, 'partner');
    const s = playHhk(g);
    expect(s.rounds).toEqual([{ user: 1, partner: 0, winner: 'user' }]);
    expect(s.points.user).toBe(1);
    expect(standing(g).toMove).toEqual(['user', 'partner']);
  });

  it("the same choice is nobody's round; three rounds win the game", () => {
    const g = hhk([0, 1, 1, 1], [0, 0, 0, 0]);
    const s = playHhk(g);
    expect(s.rounds[0].winner).toBeNull();
    expect(s.points.user).toBe(HHK_TO_WIN);
    expect(s.winner).toBe('user');
    expect(s.over).toBe(true);
    expect(standing(g).toMove).toEqual([]);
  });

  it('picks past the end, two ahead, or not a choice, do not count', () => {
    expect(cleanGame(hhk([1, 1, 1, 1, 2], [0, 0, 0, 0, 0]), 'hhk')!.picks).toEqual({ user: [1, 1, 1], partner: [0, 0, 0] });
    expect(cleanGame(hhk([1, 2, 0], []), 'hhk')!.picks).toEqual({ user: [1], partner: [] });
    expect(cleanGame(hhk([7], []), 'hhk')!.picks).toEqual({ user: [], partner: [] });
  });

  it("merges each of you's picks on its own, so choosing in the same moment loses nothing", () => {
    const m = mergeGame(hhk([1], []), hhk([], [2]));
    expect(m.picks).toEqual({ user: [1], partner: [2] });
    expect(mergeGame(m, hhk([1], []))).toBe(m);
    expect(mergeGame(m, hhk([1], [2]))).toBe(m);
  });
});

describe('Snakes & Ladders', () => {
  const snakes = (moves: number[]) => base('snakes', moves, 10);

  it('climbs a ladder from its foot and slides down a snake from its head', () => {
    const up = playSnakes(snakes([4]));
    expect(up.pos.user).toBe(LADDERS[4]);
    expect(up.last?.via).toBe('ladder');
    // The user to 4 and up to 25; the partner 2; the user 2 more: 27, a snake's head.
    const down = playSnakes(snakes([4, 2, 2]));
    expect(down.last).toMatchObject({ seat: 'user', landed: 27, to: SNAKES[27], via: 'snake' });
  });

  it('a six rolls again; anything else passes the die', () => {
    expect(playSnakes(snakes([6])).turn).toBe('user');
    expect(standing(snakes([6])).again).toBe(true);
    expect(playSnakes(snakes([5])).turn).toBe('partner');
  });

  it('needs 100 exactly: a roll past it moves nothing', () => {
    // The user walked to 97 without touching a ladder or a snake; the partner dawdles.
    const path: number[] = [];
    let s = playSnakes(snakes(path));
    for (let guard = 0; s.pos.user !== 97 && guard < 300; guard++) {
      const pos = s.pos[s.turn];
      const safe = (t: number) => !LADDERS[t] && !SNAKES[t];
      const roll = s.turn === 'user' ? [5, 4, 3, 2, 1].find(r => pos + r <= 97 && safe(pos + r)) ?? 1 : [1, 2, 3].find(r => safe(pos + r) && pos + r < 90) ?? 1;
      path.push(roll);
      s = playSnakes(snakes(path));
    }
    expect(s.pos.user).toBe(97);
    const until = (seat: 'user' | 'partner') => {
      while (s.turn !== seat) {
        path.push(1);
        s = playSnakes(snakes(path));
      }
    };
    until('user');
    path.push(5);
    s = playSnakes(snakes(path));
    expect(s.last).toMatchObject({ stayed: true, to: 97 });
    expect(s.over).toBe(false);
    until('user');
    path.push(3);
    s = playSnakes(snakes(path));
    expect(s.winner).toBe('user');
    expect(canMove(snakes(path), 'partner', 2)).toBe(false);
  });

  it("only dice values count, and only for whoever's turn it is", () => {
    expect(playSnakes(snakes([3, 0, 2])).played).toBe(1);
    expect(canMove(snakes([3]), 'user', 4)).toBe(false);
    expect(canMove(snakes([3]), 'partner', 7)).toBe(false);
    expect(canMove(snakes([3]), 'partner', 6)).toBe(true);
  });
});

describe('new games of each kind', () => {
  it('fixed boards keep their size; memory keeps its pairs; Heart Hug Kiss starts with no picks', () => {
    expect(newGame('four', undefined, 'user', 'a', 1).size).toBe(7);
    expect(newGame('snakes', undefined, 'user', 'a', 1).size).toBe(10);
    expect(newGame('memory', undefined, 'user', 'a', 1, 10).size).toBe(10);
    expect(newGame('memory', undefined, 'user', 'a', 1).size).toBe(8);
    expect(newGame('hhk', undefined, 'user', 'a', 1).picks).toEqual({ user: [], partner: [] });
  });

  it('a won Heart Hug Kiss counts for the winner in the next game', () => {
    const won: PaperGame = { ...base('hhk', [], 3), picks: { user: [1, 1, 1], partner: [0, 0, 0] } };
    expect(newGame('hhk', won, 'partner', 'b', 2).before).toEqual({ user: 1, partner: 0, draws: 0 });
  });
});
