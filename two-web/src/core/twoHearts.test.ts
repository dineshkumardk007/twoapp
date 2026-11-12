import { afterEach, describe, expect, it } from 'vitest';
import {
  CAN_MAZE,
  MAZE_MAKING,
  MAZE_RECORD,
  MAZE_SIGNS,
  NOWHERE,
  aloneHome,
  bothHome,
  canStep,
  cleanHalf,
  forgetMazesForTest,
  halfAt,
  hearMaze,
  heartsGot,
  heartsIn,
  laterHalf,
  latestHalf,
  levelOfPair,
  mazeOf,
  mergeBooks,
  moveOn,
  onMaze,
  openDoors,
  pairOf,
  sayMaze,
  setMazeSender,
  shapeOf,
  solve,
  stepped,
  walkTo,
  whoIs,
  type MazeHalf,
  type MazeLevel,
  type MazeSaid
} from './twoHearts';

/** A maze as a line of text, for telling two apart. */
const shape = (m: MazeLevel) => `${m.w}x${m.h}|${m.links.map(l => l.join(',')).join(';')}|${m.doors.map(d => `${d.a}-${d.b}@${d.plate}`).join(';')}|${m.start}|${m.home}|${m.hearts}`;

function sumOf(text: string, from = 2166136261): number {
  let h = from;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** The shortest way for the two to get home: who steps, and where to, in order. */
function wayHome(maze: MazeLevel): Array<[0 | 1, number]> {
  const n = maze.links.length;
  const came = new Map<number, { from: number; move: [0 | 1, number] } | null>();
  const first = maze.start[0] * n + maze.start[1];
  const goal = maze.home[0] * n + maze.home[1];
  came.set(first, null);
  const queue = [first];
  for (let i = 0; i < queue.length && !came.has(goal); i++) {
    const state = queue[i];
    const bear = Math.floor(state / n);
    const bunny = state % n;
    for (const to of maze.links[bear]) {
      if (to >= 0 && canStep(maze, bear, to, bunny) && !came.has(to * n + bunny)) {
        came.set(to * n + bunny, { from: state, move: [0, to] });
        queue.push(to * n + bunny);
      }
    }
    for (const to of maze.links[bunny]) {
      if (to >= 0 && canStep(maze, bunny, to, bear) && !came.has(bear * n + to)) {
        came.set(bear * n + to, { from: state, move: [1, to] });
        queue.push(bear * n + to);
      }
    }
  }
  const moves: Array<[0 | 1, number]> = [];
  for (let at = came.get(goal); at; at = came.get(at.from)) moves.unshift(at.move);
  return moves;
}

describe('the sizes of the levels', () => {
  it('small with one door first, then bigger with more', () => {
    expect(shapeOf(1)).toMatchObject({ w: 5, h: 6, doors: 1 });
    expect(shapeOf(4)).toMatchObject({ w: 5, h: 7, doors: 2 });
    expect(shapeOf(30)).toMatchObject({ w: 6, h: 8, doors: 3 });
    expect(shapeOf(100)).toMatchObject({ w: 7, h: 9, doors: 4 });
    expect(shapeOf(151)).toMatchObject({ w: 8, h: 10, doors: 4 });
    // There is no last level.
    expect(shapeOf(5000)).toMatchObject({ w: 8, h: 10, doors: 4 });
    for (let l = 2; l <= 400; l++) {
      const before = shapeOf(l - 1);
      const now = shapeOf(l);
      expect(now.w * now.h).toBeGreaterThanOrEqual(before.w * before.h);
      expect(now.doors).toBeGreaterThanOrEqual(before.doors);
    }
  });
});

describe('every maze', () => {
  let sum = 2166136261;
  const seen = new Set<string>();
  const LEVELS = 300;

  it(
    'can be finished, only by the two of you together, with all its doors, buttons and hearts in sensible places',
    () => {
      for (let l = 1; l <= LEVELS; l++) {
        const m = mazeOf(l);
        const want = shapeOf(l);
        const n = m.w * m.h;
        expect([m.w, m.h, m.doors.length], `level ${l}`).toEqual([want.w, want.h, want.doors]);
        expect(m.links.length).toBe(n);

        // Every opening goes both ways and only to the square next door; one way between any two squares.
        let openings = 0;
        for (let cell = 0; cell < n; cell++) {
          for (let d = 0; d < 4; d++) {
            const to = m.links[cell][d];
            if (to < 0) continue;
            openings++;
            expect(m.links[to].includes(cell), `level ${l}`).toBe(true);
            const dr = Math.abs(Math.floor(to / m.w) - Math.floor(cell / m.w));
            const dc = Math.abs((to % m.w) - (cell % m.w));
            expect(dr + dc).toBe(1);
            expect(m.gates[to][m.links[to].indexOf(cell)]).toBe(m.gates[cell][d]);
          }
        }
        expect(openings / 2).toBe(n - 1);

        // Starts along the bottom, homes along the top, all four apart.
        expect(new Set([...m.start, ...m.home]).size).toBe(4);
        for (const cell of m.start) expect(Math.floor(cell / m.w)).toBe(m.h - 1);
        for (const cell of m.home) expect(Math.floor(cell / m.w)).toBe(0);

        // A button is never beside its own door, nor on a start, a home or another button.
        const plates = m.doors.map(d => d.plate);
        expect(new Set(plates).size).toBe(plates.length);
        m.doors.forEach((door, g) => {
          expect(m.links[door.a].includes(door.b)).toBe(true);
          expect(m.gates[door.a][m.links[door.a].indexOf(door.b)]).toBe(g);
          expect(door.plate === door.a || door.plate === door.b, `level ${l}`).toBe(false);
          expect([...m.start, ...m.home].includes(door.plate)).toBe(false);
        });

        // It can be done - and not alone.
        const solved = solve(m);
        expect(solved.steps, `level ${l}`).toBeGreaterThan(0);
        expect(solved.steps).toBe(m.steps);
        expect(aloneHome(m, 0), `level ${l}`).toBe(false);
        if (m.doors.length >= 2) expect(aloneHome(m, 1), `level ${l}`).toBe(false);

        // Three hearts, each where one of you can get to, none on anything else.
        expect(new Set(m.hearts).size).toBe(3);
        for (const heart of m.hearts) {
          expect(solved.reach[0][heart] || solved.reach[1][heart], `level ${l}`).toBe(true);
          expect([...m.start, ...m.home, ...plates].includes(heart)).toBe(false);
        }

        const key = shape(m);
        expect(seen.has(key), `level ${l} is the same as an earlier one`).toBe(false);
        seen.add(key);
        sum = sumOf(key, sum);
      }
    },
    240_000
  );

  it('is the same maze as ever: both phones must make each level alike', () => {
    expect(seen.size).toBe(LEVELS);
    expect(sum).toBe(MAZES_SUM);
    expect(CAN_MAZE).toBe(`maze-${MAZE_MAKING}`);
  });

  it('is made the same a second time', () => {
    const first = [1, 9, 50, 120, 200].map(l => shape(mazeOf(l)));
    forgetMazesForTest();
    expect([1, 9, 50, 120, 200].map(l => shape(mazeOf(l)))).toEqual(first);
  });

  it('is not too long a walk', () => {
    for (let l = 1; l <= LEVELS; l += 3) {
      const m = mazeOf(l);
      expect(m.steps).toBeGreaterThanOrEqual(m.w + m.h);
      expect(m.steps).toBeLessThan(260);
    }
  });
});

describe('walking', () => {
  const m = mazeOf(30);
  const door = m.doors[0];

  it('a wall stops you, an opening does not', () => {
    const cell = m.start[0];
    for (let d = 0; d < 4; d++) {
      const to = m.links[cell][d];
      if (to >= 0 && m.gates[cell][d] < 0) expect(canStep(m, cell, to, m.start[1])).toBe(true);
    }
    // Not next door at all, and off the board.
    expect(canStep(m, 0, m.w * m.h - 1, 5)).toBe(false);
    expect(canStep(m, 0, -1, 5)).toBe(false);
    // A wall: two squares side by side with no opening between them.
    let found = false;
    for (let cell2 = 0; cell2 < m.w * m.h - 1 && !found; cell2++) {
      if ((cell2 + 1) % m.w !== 0 && !m.links[cell2].includes(cell2 + 1)) {
        expect(canStep(m, cell2, cell2 + 1, 0)).toBe(false);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('a door opens only while the other one is on its button', () => {
    const elsewhere = m.start[1] === door.plate ? m.start[0] : m.start[1];
    expect(canStep(m, door.a, door.b, elsewhere)).toBe(false);
    expect(canStep(m, door.b, door.a, elsewhere)).toBe(false);
    expect(canStep(m, door.a, door.b, door.plate)).toBe(true);
    expect(canStep(m, door.b, door.a, door.plate)).toBe(true);
    // Shown open while either of you stands there.
    expect(openDoors(m, door.plate, 0)[0]).toBe(true);
    expect(openDoors(m, 0, door.plate)[0]).toBe(true);
    expect(openDoors(m, m.start[0], m.start[1]).some(Boolean)).toBe(false);
  });

  it('a tap far off walks the shortest way there, and nowhere when a shut door is in the way', () => {
    const other = m.start[1];
    const from = m.start[0];
    // Every square the bear can get to alone: each step of the walk there is one it may take.
    let walked = 0;
    for (let to = 0; to < m.w * m.h; to++) {
      const way = walkTo(m, from, to, other);
      if (!way.length) continue;
      walked++;
      expect(way[way.length - 1]).toBe(to);
      let at = from;
      for (const next of way) {
        expect(canStep(m, at, next, other)).toBe(true);
        at = next;
      }
    }
    expect(walked).toBeGreaterThan(0);
    expect(walkTo(m, from, from, other)).toEqual([]);
    expect(walkTo(m, from, 9999, other)).toEqual([]);
    // Across a door: no way while it is shut, a way while it is held.
    const far = canStep(m, door.a, door.b, door.plate) ? [door.a, door.b] : [door.b, door.a];
    expect(walkTo(m, far[0], far[1], door.plate === 0 ? 1 : 0)).toEqual([]);
    expect(walkTo(m, far[0], far[1], door.plate)).toEqual([far[1]]);
  });
});

describe('two phones playing a level through', () => {
  it('each saying only where its own one is, they both get home and move on together', () => {
    for (const level of [1, 5, 20, 45, 90, 160]) {
      const m = mazeOf(level);
      // Both start with nothing said at all on level 1, or with the level reached.
      let bear: MazeHalf | undefined = level === 1 ? undefined : halfAt(level, 1, '0'.repeat(level - 1), 1);
      let bunny: MazeHalf | undefined = level === 1 ? undefined : halfAt(level, 1, '0'.repeat(level - 1), 1);
      const moves = wayHome(m);
      expect(moves.length).toBe(m.steps);
      for (const [who, to] of moves) {
        // Each phone sees the pair from its own side, and they agree.
        const seenByBear = pairOf(bear, bunny, 'user', m);
        const seenByBunny = pairOf(bunny, bear, 'partner', m);
        expect(seenByBear.pos).toEqual(seenByBunny.pos);
        expect(bothHome(m, seenByBear.pos)).toBe(false);
        const pair = who === 0 ? seenByBear : seenByBunny;
        expect(canStep(m, pair.pos[who], to, pair.pos[who === 0 ? 1 : 0]), `level ${level}`).toBe(true);
        const mine: MazeHalf = (who === 0 ? bear : bunny) ?? halfAt(level, 1, '', 1);
        const next = stepped({ ...mine, pos: pair.pos[who] }, m, to, pair.got, 2);
        expect(laterHalf(who === 0 ? bear : bunny, next)).toBe(true);
        if (who === 0) bear = next;
        else bunny = next;
      }
      const end = pairOf(bear, bunny, 'user', m);
      expect(end.level).toBe(level);
      expect(bothHome(m, end.pos)).toBe(true);
      // The bear's phone sees it first and moves on; the bunny's follows from that alone.
      const bearOn = moveOn(bear, end, 3);
      expect(bearOn.level).toBe(level + 1);
      expect(bearOn.book.length).toBe(level);
      expect(Number(bearOn.book[level - 1])).toBe(heartsGot(end.got));
      expect(laterHalf(bear, bearOn)).toBe(true);
      const next = mazeOf(level + 1);
      const after = pairOf(bunny, bearOn, 'partner', next);
      expect(after.level).toBe(level + 1);
      expect(after.pos).toEqual(next.start);
      expect(after.got).toBe(0);
      expect(after.book).toBe(bearOn.book);
    }
  });
});

describe('what each phone says', () => {
  it('a heart is picked up once, by whoever steps on it first', () => {
    const m = mazeOf(2);
    const base = halfAt(2, 5, '2', 1);
    const got = stepped(base, m, m.hearts[1], 0, 9);
    expect(got).toMatchObject({ pos: m.hearts[1], got: 2, n: 6, at: 9, level: 2 });
    // Already picked up by the other one: just a step.
    expect(stepped(base, m, m.hearts[1], 2, 9).got).toBe(0);
    // Not a heart at all.
    expect(stepped(base, m, m.start[0], 0, 9).got).toBe(0);
    expect(heartsGot(0)).toBe(0);
    expect(heartsGot(5)).toBe(2);
    expect(heartsGot(7)).toBe(3);
  });

  it('the later word from a phone is the one believed', () => {
    const a = halfAt(3, 4, '12', 1);
    const b = { ...a, n: 5, pos: 7 };
    const c = halfAt(4, 1, '123', 1);
    expect(laterHalf(a, b)).toBe(true);
    expect(laterHalf(b, a)).toBe(false);
    expect(laterHalf(a, a)).toBe(false);
    // A higher level is later whatever its count.
    expect(laterHalf(b, c)).toBe(true);
    expect(laterHalf(c, b)).toBe(false);
    expect(laterHalf(undefined, a)).toBe(true);
    expect(laterHalf(a, undefined)).toBe(false);
    expect(latestHalf(a, b)).toBe(b);
    expect(latestHalf(b, a)).toBe(b);
    expect(latestHalf(undefined, undefined)).toBeUndefined();
  });

  it('the pair is on the furthest level either has reached, the other waiting at its start', () => {
    const m = mazeOf(6);
    const mine = { ...halfAt(6, 3, '12301', 1), pos: m.hearts[0], got: 1 };
    const theirs = { ...halfAt(5, 40, '1230', 1), pos: 3, got: 4 };
    expect(levelOfPair(mine, theirs)).toBe(6);
    expect(levelOfPair(undefined, undefined)).toBe(1);
    const pair = pairOf(mine, theirs, 'user', m);
    expect(pair.level).toBe(6);
    expect(pair.pos).toEqual([m.hearts[0], m.start[1]]);
    // Hearts from a level left behind do not count here.
    expect(pair.got).toBe(1);
    expect(pair.book).toBe('12301');
    // From the other phone: the same, the other way round.
    expect(pairOf(theirs, mine, 'partner', m).pos).toEqual([m.hearts[0], m.start[1]]);
    // One only just arrived is at the start.
    expect(halfAt(6, 1, '', 1).pos).toBe(NOWHERE);
    expect(pairOf(halfAt(6, 1, '', 1), undefined, 'partner', m).pos).toEqual(m.start);
    // Nothing said by anyone: level 1, both at the start.
    const one = mazeOf(1);
    expect(pairOf(undefined, undefined, 'user', one)).toEqual({ level: 1, pos: one.start, got: 0, book: '' });
    expect(whoIs('user')).toBe(0);
    expect(whoIs('partner')).toBe(1);
  });

  it('the hearts of finished levels are the most either phone knows of', () => {
    expect(mergeBooks('120', '03')).toBe('130');
    expect(mergeBooks('', '21')).toBe('21');
    expect(mergeBooks('3', '')).toBe('3');
    expect(heartsIn('1302')).toBe(6);
    expect(heartsIn('')).toBe(0);
  });

  it('only a real half is taken from the other phone', () => {
    expect(MAZE_RECORD).toBe('GAME_MAZE');
    const good = { v: 1, level: 3, pos: 12, got: 5, n: 40, book: '31', at: 99 };
    expect(cleanHalf(good)).toEqual(good);
    // A book longer than the levels behind it is cut to them.
    expect(cleanHalf({ ...good, book: '3123' })?.book).toBe('31');
    expect(cleanHalf({ ...good, book: 'x' })?.book).toBe('');
    expect(cleanHalf({ ...good, level: 0 })).toBeNull();
    expect(cleanHalf({ ...good, pos: -1 })).toBeNull();
    expect(cleanHalf({ ...good, pos: 5000 })).toBeNull();
    expect(cleanHalf({ ...good, got: 8 })).toBeNull();
    expect(cleanHalf({ ...good, n: 'many' })).toBeNull();
    expect(cleanHalf(null)).toBeNull();
    expect(cleanHalf('half')).toBeNull();
    // A square that is not on that level's board is read as its start.
    const m = mazeOf(3);
    expect(pairOf(undefined, cleanHalf({ ...good, pos: 500 })!, 'user', m).pos).toEqual(m.start);
  });
});

describe('as it happens', () => {
  afterEach(() => setMazeSender(null));

  it('goes out by the way App gives it, and is dropped when there is none', () => {
    const sent: MazeSaid[] = [];
    sayMaze({ s: 1 });
    setMazeSender(said => sent.push(said));
    sayMaze({ s: 2 });
    sayMaze({ h: { v: 1, level: 2, pos: 4, got: 0, n: 9 } });
    expect(sent).toEqual([{ s: 2 }, { h: { v: 1, level: 2, pos: 4, got: 0, n: 9 } }]);
    setMazeSender(() => {
      throw new Error('not connected');
    });
    expect(() => sayMaze({ s: 0 })).not.toThrow();
  });

  it('only what a maze could have said reaches the maze on screen', () => {
    const heard: MazeSaid[] = [];
    const stop = onMaze(said => heard.push(said));
    hearMaze({ s: 3 });
    hearMaze({ h: { v: 1, level: 2, pos: 4, got: 1, n: 9, book: 'junk' } });
    hearMaze({ s: MAZE_SIGNS.length });
    hearMaze({ s: -1 });
    hearMaze({ h: { level: 0 } });
    hearMaze(null);
    hearMaze('hello');
    hearMaze({});
    expect(heard).toEqual([{ s: 3 }, { h: { v: 1, level: 2, pos: 4, got: 1, n: 9 } }]);
    stop();
    hearMaze({ s: 1 });
    expect(heard.length).toBe(2);
  });
});

/** The sum of the first three hundred mazes as they were first made. */
const MAZES_SUM = 2390087418;
