import { describe, expect, it } from 'vitest';
import {
  CROSS,
  EMPTY,
  FRIEND,
  HOMES_LEVELS,
  HOMES_RECORD,
  HOMES_WORLDS,
  allDone,
  answersOf,
  clashes,
  cleanBoard,
  cleanHomes,
  emptyBoard,
  forgetBoardsForTest,
  freePuzzle,
  friendsOn,
  grade,
  hintFor,
  levelOn,
  levelOpen,
  levelPuzzle,
  levelsDone,
  lineBetween,
  mergeHomes,
  painted,
  saveBoard,
  savedBoard,
  setCell,
  solved,
  starsAt,
  starsFor,
  tapped,
  totalStars,
  withStars,
  worldOf,
  type HomesPuzzle
} from './cosyHomes';

/** The finished board: a friend where the answer has one. */
const finished = (p: HomesPuzzle) => {
  let cells = emptyBoard(p.n);
  p.answer.forEach((c, r) => (cells = setCell(cells, r * p.n + c, FRIEND)));
  return cells;
};

/** A board as a line of letters, for telling two apart. */
const shape = (p: HomesPuzzle) => `${p.n}:${p.homes.join('')}`;

/** A small steady sum of a piece of text. */
function sumOf(text: string, from = 2166136261): number {
  let h = from;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

describe('the sizes of the levels', () => {
  it('a thousand of them, small boards first, with no gaps', () => {
    expect(HOMES_LEVELS).toBe(1000);
    expect(HOMES_WORLDS[0].from).toBe(1);
    expect(HOMES_WORLDS[HOMES_WORLDS.length - 1].to).toBe(HOMES_LEVELS);
    HOMES_WORLDS.forEach((w, i) => {
      expect(w.n).toBe(5 + i);
      if (i) expect(w.from).toBe(HOMES_WORLDS[i - 1].to + 1);
    });
    expect(worldOf(1).n).toBe(5);
    expect(worldOf(60).n).toBe(5);
    expect(worldOf(61).n).toBe(6);
    expect(worldOf(1000).n).toBe(9);
  });
});

describe('every level', () => {
  const seen = new Map<string, number>();
  let sum = 2166136261;
  for (const w of HOMES_WORLDS) {
    it(
      `${w.n} by ${w.n}, levels ${w.from} to ${w.to}: one answer each, never a guess, no two alike`,
      () => {
        for (let level = w.from; level <= w.to; level++) {
          const p = levelPuzzle(level);
          expect(p.n, `level ${level}`).toBe(w.n);
          expect(p.homes.length).toBe(w.n * w.n);
          // As many homes as rows, each in one piece, each with a square.
          for (let h = 0; h < w.n; h++) expect(p.homes.includes(h), `level ${level} home ${h}`).toBe(true);
          expect(p.homes.every(h => h >= 0 && h < w.n)).toBe(true);
          // Exactly the one answer, and it is the one kept.
          const answers = answersOf(p.n, p.homes, 3);
          expect(answers.length, `level ${level}`).toBe(1);
          expect(answers[0]).toEqual(p.answer);
          // Reasoned out a square at a time.
          const hard = grade(p.n, p.homes);
          expect(hard, `level ${level}`).not.toBeNull();
          expect(hard).toBe(p.hard);
          expect(solved(p, finished(p))).toBe(true);
          const key = shape(p);
          expect(seen.get(key), `levels ${seen.get(key)} and ${level} are the same board`).toBeUndefined();
          seen.set(key, level);
          sum = sumOf(key, sum);
        }
      },
      240_000
    );
  }

  it('are the same boards as ever: changing how they are made would change every level on one phone and not the other', () => {
    expect(seen.size).toBe(HOMES_LEVELS);
    expect(sum).toBe(LEVELS_SUM);
  });

  it('is made the same a second time', () => {
    const first = [1, 77, 300, 555, 999].map(l => shape(levelPuzzle(l)));
    forgetBoardsForTest();
    expect([1, 77, 300, 555, 999].map(l => shape(levelPuzzle(l)))).toEqual(first);
  });

  it('starts easy in each size and gets harder', () => {
    for (const w of HOMES_WORLDS) {
      const third = Math.floor((w.to - w.from + 1) / 3);
      const mean = (from: number, to: number) => {
        let total = 0;
        for (let l = from; l <= to; l++) total += levelPuzzle(l).hard;
        return total / (to - from + 1);
      };
      expect(mean(w.from, w.from + third - 1)).toBeLessThan(mean(w.to - third + 1, w.to));
    }
    // The very first boards need nothing but "one square left".
    expect(levelPuzzle(1).hard).toBeLessThan(200);
    expect(levelPuzzle(2).hard).toBeLessThan(200);
  });
});

describe('Free play', () => {
  it('a board of the size asked for, with one answer, and a different one for another seed', () => {
    const boards = new Set<string>();
    for (let n = 5; n <= 9; n++) {
      for (const seed of [1, 2, 3, 123456, 987654321]) {
        const p = freePuzzle(n, seed);
        expect(p.n).toBe(n);
        expect(answersOf(p.n, p.homes, 3)).toEqual([p.answer]);
        expect(grade(p.n, p.homes)).not.toBeNull();
        boards.add(shape(p));
      }
    }
    expect(boards.size).toBe(25);
    expect(shape(freePuzzle(7, 42))).toBe(shape(freePuzzle(7, 42)));
    // A size that is not on offer is brought back to one that is.
    expect(freePuzzle(3, 1).n).toBe(5);
    expect(freePuzzle(20, 1).n).toBe(9);
  });
});

describe('the board as it is played', () => {
  const p = levelPuzzle(1);
  it('a tap goes from nothing to a cross to a friend and back', () => {
    const start = emptyBoard(p.n);
    const once = tapped(start, 7);
    const twice = tapped(once, 7);
    expect(once[7]).toBe(CROSS);
    expect(twice[7]).toBe(FRIEND);
    expect(tapped(twice, 7)).toBe(start);
    expect(friendsOn(twice)).toBe(1);
    // Only that square changes.
    expect([...once].filter((ch, i) => i !== 7).every(ch => ch === EMPTY)).toBe(true);
  });
  it('two friends in a row, a column or a home, or touching, are both marked', () => {
    const at = (r: number, c: number) => r * p.n + c;
    const both = (a: number, b: number) => {
      const bad = clashes(p, setCell(setCell(emptyBoard(p.n), a, FRIEND), b, FRIEND));
      return bad[a] && bad[b] && bad.filter(Boolean).length === 2;
    };
    expect(both(at(0, 0), at(0, 4))).toBe(true); // a row
    expect(both(at(0, 0), at(4, 0))).toBe(true); // a column
    expect(both(at(1, 1), at(2, 2))).toBe(true); // corners touching
    // The same home, away from each other's row, column and corners.
    let found = false;
    for (let a = 0; a < p.n * p.n && !found; a++) {
      for (let b = a + 1; b < p.n * p.n && !found; b++) {
        const dr = Math.abs(Math.floor(a / p.n) - Math.floor(b / p.n));
        const dc = Math.abs((a % p.n) - (b % p.n));
        if (p.homes[a] === p.homes[b] && dr >= 2 && dc >= 2) {
          expect(both(a, b)).toBe(true);
          found = true;
        }
      }
    }
    // One alone breaks nothing.
    expect(clashes(p, setCell(emptyBoard(p.n), 0, FRIEND)).some(Boolean)).toBe(false);
  });
  it('is done only with every friend down and no rule broken', () => {
    const done = finished(p);
    expect(solved(p, done)).toBe(true);
    expect(clashes(p, done).some(Boolean)).toBe(false);
    // One short.
    expect(solved(p, setCell(done, p.answer[0], EMPTY))).toBe(false);
    // Crosses anywhere else do not matter.
    const spare = [...done].findIndex(ch => ch === EMPTY);
    expect(solved(p, setCell(done, spare, CROSS))).toBe(true);
    expect(solved(p, emptyBoard(p.n))).toBe(false);
  });
  it('a finger drawn across puts crosses on empty squares only, or rubs crosses out, and never touches a friend', () => {
    const board = setCell(setCell(emptyBoard(5), 1, CROSS), 2, FRIEND);
    expect(painted(board, 0, 'cross')[0]).toBe(CROSS);
    expect(painted(board, 1, 'cross')).toBe(board);
    expect(painted(board, 2, 'cross')).toBe(board);
    expect(painted(board, 1, 'rub')[1]).toBe(EMPTY);
    expect(painted(board, 0, 'rub')).toBe(board);
    expect(painted(board, 2, 'rub')).toBe(board);
  });
  it('a fast finger that skips squares still marks the ones between', () => {
    // Along a row, down a column, on a slant, and backwards; the square it started on is left out.
    expect(lineBetween(0, 3, 5)).toEqual([1, 2, 3]);
    expect(lineBetween(2, 22, 5)).toEqual([7, 12, 17, 22]);
    expect(lineBetween(0, 24, 5)).toEqual([6, 12, 18, 24]);
    expect(lineBetween(13, 10, 5)).toEqual([12, 11, 10]);
    expect(lineBetween(7, 7, 5)).toEqual([]);
    // Next door is just that square.
    expect(lineBetween(7, 8, 5)).toEqual([8]);
    // Every square it gives is on the board.
    for (let a = 0; a < 81; a += 7) for (let b = 0; b < 81; b += 5) for (const c of lineBetween(a, b, 9)) expect(c >= 0 && c < 81).toBe(true);
  });
  it('a board kept from another size, or with anything else in it, is not used', () => {
    expect(cleanBoard(emptyBoard(5), 5)).toBe(emptyBoard(5));
    expect(cleanBoard(emptyBoard(5), 6)).toBeNull();
    expect(cleanBoard('3'.repeat(25), 5)).toBeNull();
    expect(cleanBoard(12, 5)).toBeNull();
  });
});

describe('a hint', () => {
  it('always points at a square of the answer, all the way to the end, on every size', () => {
    for (const level of [1, 30, 61, 150, 201, 400, 421, 650, 701, 1000]) {
      const p = levelPuzzle(level);
      let cells = emptyBoard(p.n);
      for (let placed = 0; placed < p.n; placed++) {
        const h = hintFor(p, cells);
        expect(h, `level ${level}`).not.toBeNull();
        expect(h!.kind).not.toBe('wrong');
        const r = Math.floor(h!.cell / p.n);
        expect(p.answer[r], `level ${level}`).toBe(h!.cell % p.n);
        expect(cells[h!.cell]).not.toBe(FRIEND);
        cells = setCell(cells, h!.cell, FRIEND);
      }
      expect(solved(p, cells)).toBe(true);
      expect(hintFor(p, cells)).toBeNull();
    }
  });
  it('says which friend is in the wrong place before anything else', () => {
    const p = levelPuzzle(61);
    const wrongCol = (p.answer[0] + 2) % p.n;
    const cells = setCell(emptyBoard(p.n), wrongCol, FRIEND);
    expect(hintFor(p, cells)).toEqual({ kind: 'wrong', cell: wrongCol });
  });
  it('does not trust the crosses: one on the answer does not send it elsewhere', () => {
    const p = levelPuzzle(5);
    let cells = emptyBoard(p.n);
    p.answer.forEach((c, r) => (cells = setCell(cells, r * p.n + c, CROSS)));
    const h = hintFor(p, cells)!;
    expect(p.answer[Math.floor(h.cell / p.n)]).toBe(h.cell % p.n);
  });
  it('gives the reason when one square is all that is left', () => {
    const p = levelPuzzle(1);
    const h = hintFor(p, emptyBoard(p.n))!;
    expect(h.kind).toBe('only');
  });
});

describe('the stars', () => {
  it('three for a good time with no hints, fewer for hints and for being slow, never none', () => {
    expect(starsFor(5, 30_000, 0)).toBe(3);
    expect(starsFor(5, 60_000, 0)).toBe(3);
    expect(starsFor(5, 61_000, 0)).toBe(2);
    expect(starsFor(5, 151_000, 0)).toBe(1);
    expect(starsFor(5, 30_000, 1)).toBe(2);
    expect(starsFor(5, 30_000, 2)).toBe(1);
    expect(starsFor(5, 999_000, 9)).toBe(1);
    expect(starsFor(9, 360_000, 0)).toBe(3);
    expect(starsFor(9, 361_000, 0)).toBe(2);
  });
  it('are kept level by level, the best each time', () => {
    let book = withStars(undefined, 1, 2, 100);
    expect(book).toEqual({ stars: '2', at: 100 });
    expect(levelOn(book)).toBe(2);
    expect(levelOpen(book, 2)).toBe(true);
    expect(levelOpen(book, 3)).toBe(false);
    // A worse go changes nothing, and hands back the same book.
    expect(withStars(book, 1, 1, 200)).toBe(book);
    book = withStars(book, 1, 3, 300);
    expect(book).toEqual({ stars: '3', at: 300 });
    book = withStars(book, 2, 1, 400);
    expect(book.stars).toBe('31');
    expect(starsAt(book, 1)).toBe(3);
    expect(starsAt(book, 2)).toBe(1);
    expect(starsAt(book, 3)).toBe(0);
    expect(totalStars(book)).toBe(4);
    expect(levelsDone(book)).toBe(2);
    expect(levelOn(book)).toBe(3);
    expect(levelOn(undefined)).toBe(1);
    expect(totalStars(undefined)).toBe(0);
    // Out of range is left alone.
    expect(withStars(book, 0, 3, 500)).toBe(book);
    expect(withStars(book, 1001, 3, 500)).toBe(book);
  });
  it('the last level is as far as it goes', () => {
    const book = { stars: '3'.repeat(HOMES_LEVELS), at: 1 };
    expect(levelOn(book)).toBe(HOMES_LEVELS);
    expect(allDone(book)).toBe(true);
    expect(allDone({ stars: '3'.repeat(999), at: 1 })).toBe(false);
    expect(totalStars(book)).toBe(3000);
  });
  it('two copies join to the best of each, and one that adds nothing changes nothing', () => {
    const mine = { stars: '312', at: 10 };
    const older = { stars: '21', at: 5 };
    expect(mergeHomes(mine, older)).toBe(mine);
    expect(mergeHomes(mine, undefined)).toBe(mine);
    expect(mergeHomes(undefined, older)).toBe(older);
    expect(mergeHomes(mine, { stars: '1333', at: 20 })).toEqual({ stars: '3333', at: 20 });
    expect(mergeHomes({ stars: '1', at: 30 }, { stars: '03', at: 2 })).toEqual({ stars: '13', at: 30 });
  });
  it('only a real book is taken from the other phone', () => {
    expect(HOMES_RECORD).toBe('GAME_HOMES');
    expect(cleanHomes({ stars: '3210', at: 5 })).toEqual({ stars: '321', at: 5 });
    expect(cleanHomes({ stars: '', at: 5 })).toEqual({ stars: '', at: 5 });
    expect(cleanHomes({ stars: '34', at: 5 })).toBeNull();
    expect(cleanHomes({ stars: 12, at: 5 })).toBeNull();
    expect(cleanHomes({ stars: '1'.repeat(1001), at: 5 })).toBeNull();
    expect(cleanHomes(null)).toBeNull();
    expect(cleanHomes({ stars: '1', at: 'soon' })).toEqual({ stars: '1', at: 0 });
  });
});

describe('a board left part way through', () => {
  it('is there when you come back, and gone once cleared', () => {
    expect(savedBoard('l3', 5)).toBeNull();
    const cells = setCell(emptyBoard(5), 3, FRIEND);
    saveBoard('l3', { cells, ms: 4200, hints: 1, at: 10 });
    expect(savedBoard('l3', 5)).toEqual({ cells, ms: 4200, hints: 1, at: 10 });
    // Asked for at another size, it is not that board.
    expect(savedBoard('l3', 6)).toBeNull();
    saveBoard('l3', null);
    expect(savedBoard('l3', 5)).toBeNull();
  });
  it('Free play remembers which board it was', () => {
    saveBoard('f7', { cells: emptyBoard(7), ms: 0, hints: 0, seed: 777, at: 5 });
    expect(savedBoard('f7', 7)?.seed).toBe(777);
  });
  it('only the newest few are kept', () => {
    for (let i = 1; i <= 12; i++) saveBoard(`l${i}`, { cells: emptyBoard(5), ms: 0, hints: 0, at: i });
    expect(savedBoard('l12', 5)).not.toBeNull();
    expect(savedBoard('l5', 5)).not.toBeNull();
    expect(savedBoard('l4', 5)).toBeNull();
    expect(savedBoard('l1', 5)).toBeNull();
  });
  it('something else kept under its name does no harm', () => {
    localStorage.setItem('two_homes_boards', 'not json');
    expect(savedBoard('l1', 5)).toBeNull();
    saveBoard('l1', { cells: emptyBoard(5), ms: 1, hints: 0, at: 1 });
    expect(savedBoard('l1', 5)?.ms).toBe(1);
  });
});

/** The sum of all thousand boards as they were first made. */
const LEVELS_SUM = 1036432710;
