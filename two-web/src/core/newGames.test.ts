import { describe, expect, it } from 'vitest';
import {
  BASE_MAX,
  BASE_MIN,
  BOARD,
  COINS_EACH,
  COIN_R,
  MAX_SHOT,
  STRIKER_R,
  afterShot,
  baselineY,
  carromAfter,
  decodeShot,
  encodeShot,
  forwardOf,
  freshCarrom,
  nearestFree,
  playCarrom,
  recordShot,
  shotAllowed,
  simulateShot,
  spotFree,
  type CarromState,
  type Coin,
  type Shot
} from './carrom';
import {
  SOAK_FULL,
  WB_FAR,
  WB_GROUND,
  WB_HAND_X,
  WB_HEDGE_X,
  decodeThrow,
  encodeThrow,
  flyBalloon,
  hedgeOf,
  playBalloon,
  recordFlight,
  throwAllowed,
  windForThrower,
  windOf
} from './balloonWar';
import { canMove, cleanGame, kindOfRecord, mergeGame, newGame, recordTypeOf, standing, withMove, type PaperGame } from './paperGames';
import type { Seat } from './usTwo';

// Water Balloon War and Carrom (core/balloonWar, core/carrom, core/paperGames).

const carrom = (moves: number[], first: Seat = 'user', id = 'carrom-1'): PaperGame => ({
  kind: 'carrom',
  id,
  startedAt: 1,
  first,
  size: 1,
  moves,
  before: { user: 0, partner: 0, draws: 0 },
  looks: {}
});
const balloon = (moves: number[], first: Seat = 'user', id = 'balloon-1'): PaperGame => ({ ...carrom(moves, first, id), kind: 'balloon' });

/** A small deterministic random, so these tests are the same every run. */
function dice(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A legal shot at random from where the coins are. */
function someShot(state: CarromState, random: () => number): number {
  const x = nearestFree(state.coins, state.turn, BASE_MIN + Math.floor(random() * (BASE_MAX - BASE_MIN)));
  const speed = 500 + random() * (MAX_SHOT - 600);
  const lateral = (random() * 2 - 1) * 0.9;
  const forward = Math.sqrt(1 - lateral * lateral);
  return encodeShot({ x, dx: Math.round(speed * lateral), dy: Math.round(speed * forward * forwardOf(state.turn)) });
}

/** A whole game's worth of random shots: each legal where it stands. */
function randomGame(seed: number, shots: number): PaperGame {
  const random = dice(seed);
  let game = carrom([], 'user', `carrom-${seed}`);
  for (let i = 0; i < shots; i++) {
    const state = playCarrom(game);
    if (state.over) break;
    game = withMove(game, someShot(state, random));
  }
  return game;
}

/** A coin of a colour, placed by hand, for testing the rules. */
const coin = (id: number, x = 300, y = 300): Coin => ({ id, kind: id === 0 ? 'queen' : id <= COINS_EACH ? 'white' : 'black', x, y });
const fallen = (ids: number[]) => ids.map(id => coin(id));
/** A state with exactly these coins on the board; the user plays white. */
const withCoins = (ids: number[], over: Partial<CarromState> = {}): CarromState => {
  const state = freshCarrom('user');
  const coins = ids.map((id, i) => coin(id, 200 + (i % 8) * 80, 300 + Math.floor(i / 8) * 80));
  return {
    ...state,
    coins,
    left: {
      user: coins.filter(c => c.kind === 'white').length,
      partner: coins.filter(c => c.kind === 'black').length
    },
    queen: coins.some(c => c.kind === 'queen') ? 'board' : 'pending',
    ...over
  };
};
const BLACKS = [10, 11, 12, 13, 14, 15, 16, 17, 18];

describe('carrom: the board', () => {
  it('sets out nine white, nine black and the queen, none touching', () => {
    const { coins } = freshCarrom('user');
    expect(coins.filter(c => c.kind === 'white')).toHaveLength(9);
    expect(coins.filter(c => c.kind === 'black')).toHaveLength(9);
    expect(coins.filter(c => c.kind === 'queen')).toHaveLength(1);
    for (let i = 0; i < coins.length; i++) {
      for (let j = i + 1; j < coins.length; j++) {
        expect(Math.hypot(coins[i].x - coins[j].x, coins[i].y - coins[j].y)).toBeGreaterThanOrEqual(2 * COIN_R);
      }
    }
  });

  it('whoever breaks plays white', () => {
    expect(freshCarrom('user').colour).toEqual({ user: 'white', partner: 'black' });
    expect(freshCarrom('partner').colour).toEqual({ user: 'black', partner: 'white' });
  });

  it('a shot survives being packed into one number, sign and all', () => {
    for (const s of [
      { x: 190, dx: -3000, dy: -3000 },
      { x: 810, dx: 3000, dy: 3000 },
      { x: 500, dx: 0, dy: -120 },
      { x: 345, dx: -1, dy: 1 }
    ]) {
      expect(decodeShot(encodeShot(s))).toEqual(s);
      expect(Number.isSafeInteger(encodeShot(s))).toBe(true);
    }
  });

  it('keeps the striker to the line, off the coins, and shooting forward', () => {
    const { coins } = freshCarrom('user');
    const ok: Shot = { x: 500, dx: 0, dy: -2000 };
    expect(shotAllowed(coins, 'user', ok)).toBe(true);
    expect(shotAllowed(coins, 'user', { ...ok, x: BASE_MIN - 1 })).toBe(false);
    expect(shotAllowed(coins, 'user', { ...ok, x: BASE_MAX + 1 })).toBe(false);
    expect(shotAllowed(coins, 'user', { ...ok, dy: 2000 })).toBe(false); // backwards
    expect(shotAllowed(coins, 'partner', ok)).toBe(false); // backwards, from the other side
    expect(shotAllowed(coins, 'partner', { ...ok, dy: 2000 })).toBe(true);
    expect(shotAllowed(coins, 'user', { x: 500, dx: 0, dy: -50 })).toBe(false); // too soft
    expect(shotAllowed(coins, 'user', { x: 500, dx: 3000, dy: -3000 })).toBe(false); // too hard
    expect(shotAllowed(coins, 'user', { x: 500, dx: 2000, dy: -100 })).toBe(false); // too far sideways
    expect(shotAllowed(coins, 'user', { x: 500.5, dx: 0, dy: -2000 })).toBe(false); // not a whole number
  });

  it('will not let the striker sit on a coin, and finds the nearest place that is free', () => {
    const y = baselineY('user');
    const coins: Coin[] = [{ id: 1, kind: 'white', x: 500, y }];
    expect(spotFree(coins, 'user', 500)).toBe(false);
    expect(spotFree(coins, 'user', 500 + COIN_R + STRIKER_R)).toBe(true);
    const free = nearestFree(coins, 'user', 500);
    expect(spotFree(coins, 'user', free)).toBe(true);
    expect(Math.abs(free - 500)).toBeLessThanOrEqual(COIN_R + STRIKER_R + 1);
    expect(shotAllowed(coins, 'user', { x: 500, dx: 0, dy: -2000 })).toBe(false);
  });
});

describe('carrom: the physics', () => {
  it('comes out exactly the same every time it is worked out', () => {
    const one = randomGame(1, 40);
    const a = playCarrom(one);
    // Worked out again from nothing: a different game in between empties the memory.
    playCarrom(randomGame(2, 3));
    const b = playCarrom({ ...one });
    expect(b.coins).toEqual(a.coins);
    expect(b.turn).toBe(a.turn);
  });

  it('gives the recording the same ending as the rules', () => {
    const game = randomGame(3, 25);
    for (let k = 0; k < game.moves.length; k++) {
      const before = carromAfter(game, k);
      const shot = decodeShot(game.moves[k]);
      const plain = simulateShot(before.coins, before.turn, shot);
      const { recording } = recordShot(before, game.moves[k]);
      const end = recording.frames[recording.frames.length - 1];
      plain.coins.forEach(c => {
        const i = recording.ids.indexOf(c.id);
        expect(end[i * 2]).toBeCloseTo(c.x, 2);
        expect(end[i * 2 + 1]).toBeCloseTo(c.y, 2);
      });
      expect(recording.goneAt.filter(g => g >= 0).length).toBe(plain.fallen.length + (plain.strikerIn ? 1 : 0));
    }
  });

  it('never loses a coin or lets one off the board, over many random games', () => {
    for (let seed = 10; seed < 30; seed++) {
      const game = randomGame(seed, 60);
      for (let k = 0; k <= game.moves.length; k++) {
        const s = carromAfter(game, k);
        for (const c of s.coins) {
          expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
          expect(c.x).toBeGreaterThanOrEqual(COIN_R - 0.01);
          expect(c.x).toBeLessThanOrEqual(BOARD - COIN_R + 0.01);
          expect(c.y).toBeGreaterThanOrEqual(COIN_R - 0.01);
          expect(c.y).toBeLessThanOrEqual(BOARD - COIN_R + 0.01);
        }
        const ids = s.coins.map(c => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        // What is on the board is what the counts say.
        expect(s.coins.filter(c => c.kind === s.colour.user).length).toBe(s.left.user);
        expect(s.coins.filter(c => c.kind === s.colour.partner).length).toBe(s.left.partner);
        // The queen is on the board exactly when she is said to be.
        expect(s.coins.some(c => c.kind === 'queen')).toBe(s.queen === 'board');
      }
    }
  });

  it('stops in good time, however hard the shot', () => {
    const state = freshCarrom('user');
    const { recording } = recordShot(state, encodeShot({ x: 500, dx: 0, dy: -MAX_SHOT }));
    expect(recording.ms).toBeGreaterThan(300);
    expect(recording.ms).toBeLessThan(6000);
  });

  it('a hard straight break scatters the coins', () => {
    const before = freshCarrom('user');
    const after = simulateShot(before.coins, 'user', { x: 500, dx: 0, dy: -MAX_SHOT });
    const moved = after.coins.filter(c => {
      const b = before.coins.find(o => o.id === c.id)!;
      return Math.hypot(c.x - b.x, c.y - b.y) > 20;
    });
    expect(moved.length).toBeGreaterThan(10);
  });

  it('sends a coin into the pocket it is knocked at', () => {
    // On the straight line from the striker's place to the top left pocket.
    const coins: Coin[] = [{ id: 1, kind: 'white', x: 274, y: 449 }];
    const out = simulateShot(coins, 'user', { x: 502, dx: -1368, dy: -2418 });
    expect(out.fallen.map(c => c.id)).toEqual([1]);
  });

  it('a gentle tap moves a coin a little and no further', () => {
    const coins: Coin[] = [{ id: 1, kind: 'white', x: 500, y: 760 }];
    const out = simulateShot(coins, 'user', { x: 500, dx: 0, dy: -500 });
    expect(out.fallen).toHaveLength(0);
    expect(out.coins[0].y).toBeLessThan(760);
    expect(out.coins[0].y).toBeGreaterThan(500);
  });

  it('works out a long game fast enough for a slow phone', () => {
    const start = performance.now();
    const game = randomGame(99, 100);
    const took = performance.now() - start;
    expect(game.moves.length).toBeGreaterThan(40);
    // Even at a tenth of this machine's speed, an average shot stays under a frame.
    expect(took / game.moves.length).toBeLessThan(1.6);
  });
});

describe('carrom: the rules', () => {
  const none = (state: CarromState) => ({ coins: state.coins, fallen: [] as Coin[], strikerIn: false });
  const dropping = (state: CarromState, ids: number[], strikerIn = false) => ({
    coins: state.coins.filter(c => !ids.includes(c.id)),
    fallen: fallen(ids),
    strikerIn
  });

  it('a shot with nothing in passes the turn', () => {
    const s = freshCarrom('user');
    const next = afterShot(s, none(s));
    expect(next.turn).toBe('partner');
    expect(next.again).toBe(false);
    expect(next.last?.note).toBe('nothing');
  });

  it('your own coin in counts, and you go again', () => {
    const s = freshCarrom('user');
    const next = afterShot(s, dropping(s, [1]));
    expect(next.turn).toBe('user');
    expect(next.again).toBe(true);
    expect(next.left.user).toBe(8);
    expect(next.last?.note).toBe('own');
  });

  it('their coin in counts for them, and the turn passes', () => {
    const s = freshCarrom('user');
    const next = afterShot(s, dropping(s, [10]));
    expect(next.turn).toBe('partner');
    expect(next.left.partner).toBe(8);
    expect(next.left.user).toBe(9);
    expect(next.last?.note).toBe('theirs');
  });

  it('the striker in is a foul: your fallen coin and one more come back', () => {
    // The user has two in already (1 and 2), and drops a third along with the striker.
    const s = withCoins([0, 3, 4, 5, 6, 7, 8, 9, ...BLACKS]);
    expect(s.left.user).toBe(7);
    const next = afterShot(s, dropping(s, [3], true));
    expect(next.left.user).toBe(8);
    expect(next.turn).toBe('partner');
    expect(next.last?.note).toBe('foul');
    expect(next.last?.returned.length).toBe(2);
  });

  it('a foul with nothing in yet costs nothing more', () => {
    const s = freshCarrom('user');
    const next = afterShot(s, dropping(s, [], true));
    expect(next.left.user).toBe(9);
    expect(next.coins).toHaveLength(19);
    expect(next.last?.returned).toHaveLength(0);
    expect(next.turn).toBe('partner');
  });

  it('a foul leaves their coin with them', () => {
    const s = freshCarrom('user');
    const next = afterShot(s, dropping(s, [10], true));
    expect(next.left.partner).toBe(8);
  });

  it('the queen cannot be taken before you have a coin in', () => {
    const s = freshCarrom('user');
    const next = afterShot(s, dropping(s, [0]));
    expect(next.queen).toBe('board');
    expect(next.coins.some(c => c.kind === 'queen')).toBe(true);
    expect(next.turn).toBe('partner');
    expect(next.last?.note).toBe('queen-back');
  });

  it('the queen and your own coin on one shot: she is yours', () => {
    const s = freshCarrom('user');
    const next = afterShot(s, dropping(s, [0, 1]));
    expect(next.queen).toBe('user');
    expect(next.again).toBe(true);
    expect(next.last?.note).toBe('covered');
  });

  it('the queen alone must be covered on the next shot', () => {
    const s = withCoins([0, 2, 3, 4, 5, 6, 7, 8, 9, ...BLACKS]); // one white in already
    const pending = afterShot(s, dropping(s, [0]));
    expect(pending.queen).toBe('pending');
    expect(pending.turn).toBe('user');
    expect(pending.last?.note).toBe('queen');
    const covered = afterShot(pending, dropping(pending, [2]));
    expect(covered.queen).toBe('user');
    expect(covered.turn).toBe('user');
    expect(covered.last?.note).toBe('covered');
  });

  it('not covered: she goes back to the middle and the turn passes', () => {
    const s = withCoins([2, 3, 4, 5, 6, 7, 8, 9, ...BLACKS], { queen: 'pending' });
    const next = afterShot(s, none(s));
    expect(next.queen).toBe('board');
    expect(next.coins.some(c => c.kind === 'queen')).toBe(true);
    expect(next.turn).toBe('partner');
    expect(next.last?.note).toBe('queen-back');
  });

  it('a foul while she waits to be covered sends her back too', () => {
    const s = withCoins([2, 3, 4, 5, 6, 7, 8, 9, ...BLACKS], { queen: 'pending' });
    const next = afterShot(s, dropping(s, [], true));
    expect(next.queen).toBe('board');
    expect(next.coins.some(c => c.kind === 'queen')).toBe(true);
  });

  it('your last coin cannot go in while the queen is still to be won', () => {
    const s = withCoins([0, 9, ...BLACKS]);
    const next = afterShot(s, dropping(s, [9]));
    expect(next.left.user).toBe(1);
    expect(next.over).toBe(false);
    expect(next.turn).toBe('partner');
    expect(next.last?.note).toBe('last-back');
  });

  it('nor can their last coin', () => {
    const s = withCoins([0, 5, 6, 18]);
    const next = afterShot(s, dropping(s, [18]));
    expect(next.left.partner).toBe(1);
    expect(next.over).toBe(false);
  });

  it('clearing your coins with the queen won wins it', () => {
    const s = withCoins([9, 18], { queen: 'user' });
    const next = afterShot(s, dropping(s, [9]));
    expect(next.over).toBe(true);
    expect(next.winner).toBe('user');
  });

  it('the queen won by either of you is enough: clear yours and you win', () => {
    const s = withCoins([9, 18], { queen: 'partner' });
    const next = afterShot(s, dropping(s, [9]));
    expect(next.winner).toBe('user');
  });

  it('covering her with your very last coin wins on the spot', () => {
    const s = withCoins([9, 18], { queen: 'pending' });
    const next = afterShot(s, dropping(s, [9]));
    expect(next.queen).toBe('user');
    expect(next.winner).toBe('user');
  });

  it('putting their last coin in, with the queen won, hands them the game', () => {
    const s = withCoins([5, 18], { queen: 'user' });
    const next = afterShot(s, dropping(s, [18]));
    expect(next.winner).toBe('partner');
  });

  it('a coin coming back to a crowded middle finds a free place', () => {
    const s = freshCarrom('user');
    // Something sitting where the queen came from: she has to go beside it.
    const coins = s.coins.filter(c => c.kind !== 'queen');
    coins.push({ id: 9, kind: 'white', x: BOARD / 2, y: BOARD / 2 });
    const unique = coins.filter((c, i) => coins.findIndex(o => o.id === c.id) === i || c.x === BOARD / 2);
    const next = afterShot({ ...s, queen: 'pending', coins: unique }, { coins: unique, fallen: [], strikerIn: false });
    const queen = next.coins.find(c => c.kind === 'queen')!;
    expect(queen).toBeTruthy();
    for (const c of next.coins) {
      if (c.id === 0) continue;
      expect(Math.hypot(c.x - queen.x, c.y - queen.y)).toBeGreaterThanOrEqual(2 * COIN_R);
    }
  });
});

describe('carrom: as a game on both phones', () => {
  it('has its own record, kept like the others', () => {
    expect(recordTypeOf('carrom')).toBe('GAME_CARROM');
    expect(kindOfRecord('GAME_CARROM')).toBe('carrom');
  });

  it('only the player whose turn it is may shoot, and only a legal shot', () => {
    const g = newGame('carrom', undefined, 'user', 'g1', 1);
    const shot = encodeShot({ x: 500, dx: 0, dy: -2000 });
    expect(canMove(g, 'user', shot)).toBe(true);
    expect(canMove(g, 'partner', encodeShot({ x: 500, dx: 0, dy: 2000 }))).toBe(false);
    expect(canMove(g, 'user', encodeShot({ x: 500, dx: 0, dy: 2000 }))).toBe(false);
    expect(canMove(g, 'user', -1)).toBe(false);
    expect(standing(withMove(g, shot)).toMove).toHaveLength(1);
  });

  it('the longer copy wins, and both phones then agree on every coin', () => {
    const full = randomGame(5, 12);
    const short = { ...full, moves: full.moves.slice(0, 6) };
    expect(mergeGame(short, full).moves).toEqual(full.moves);
    expect(mergeGame(full, short)).toBe(full);
    const here = playCarrom(mergeGame(short, full));
    playCarrom(randomGame(6, 2));
    const there = playCarrom(cleanGame(JSON.parse(JSON.stringify(full)), 'carrom')!);
    expect(there.coins).toEqual(here.coins);
  });

  it('keeps an arriving game only as far as its shots are legal', () => {
    const good = randomGame(6, 5);
    const bad = { ...good, moves: [...good.moves, 7, ...good.moves] };
    const cleaned = cleanGame(JSON.parse(JSON.stringify(bad)), 'carrom')!;
    expect(cleaned.moves).toEqual(good.moves);
  });

  it('swaps who breaks from one game to the next', () => {
    const a = newGame('carrom', undefined, 'user', 'g1', 1);
    const b = newGame('carrom', a, 'partner', 'g2', 2);
    expect(a.first).toBe('user');
    expect(b.first).toBe('partner');
    expect(playCarrom(b).colour.partner).toBe('white');
  });
});

describe('water balloon war', () => {
  const NO_WIND = 0;
  const HEDGE = 80;

  it('a throw survives being packed into one number', () => {
    for (const t of [
      { vx: 60, vy: 0, giant: false },
      { vx: 1200, vy: 1200, giant: true },
      { vx: 555, vy: 777, giant: false }
    ]) {
      expect(decodeThrow(encodeThrow(t))).toEqual(t);
    }
  });

  it('rejects throws out of range, and a second giant', () => {
    expect(throwAllowed({ vx: 500, vy: 500, giant: false }, false)).toBe(true);
    expect(throwAllowed({ vx: 500, vy: 500, giant: true }, true)).toBe(true);
    expect(throwAllowed({ vx: 500, vy: 500, giant: true }, false)).toBe(false);
    expect(throwAllowed({ vx: 10, vy: 500, giant: false }, true)).toBe(false);
    expect(throwAllowed({ vx: 500, vy: 1300, giant: false }, true)).toBe(false);
    expect(throwAllowed({ vx: 500.5, vy: 500, giant: false }, true)).toBe(false);
  });

  it('the wind for a throw is the same on both phones, never nil, and varies', () => {
    const winds = Array.from({ length: 30 }, (_, k) => windOf('game-a', k));
    expect(winds).toEqual(Array.from({ length: 30 }, (_, k) => windOf('game-a', k)));
    expect(winds.every(w => Number.isInteger(w) && w !== 0 && Math.abs(w) <= 5)).toBe(true);
    expect(new Set(winds).size).toBeGreaterThan(4);
    expect(winds.some(w => w > 0) && winds.some(w => w < 0)).toBe(true);
  });

  it('wind pushes the same throw further when it blows your way', () => {
    const t = { vx: 500, vy: 500, giant: false };
    const down = flyBalloon(t, 5, 0);
    const still = flyBalloon(t, NO_WIND, 0);
    const up = flyBalloon(t, -5, 0);
    expect(down.x).toBeGreaterThan(still.x);
    expect(up.x).toBeLessThan(still.x);
  });

  /** A lob that comes down on them, searched for the way a player's eye would. */
  const lobAt = (giant = false) => {
    for (let v = 300; v < 1000; v += 2) {
      const f = flyBalloon({ vx: v, vy: v, giant }, NO_WIND, HEDGE);
      if (f.hit === 'head' || f.hit === 'body') return { v, f };
    }
    throw new Error('no lob');
  };

  it('a good lob hits them for three or four', () => {
    const { f } = lobAt();
    expect([3, 4]).toContain(f.points);
    expect(Math.abs(f.x - WB_FAR)).toBeLessThan(90);
  });

  it('a giant hits harder, and more easily', () => {
    const { f } = lobAt(true);
    expect(f.points).toBeGreaterThanOrEqual(5);
    // Some throw that misses with a small balloon still gets them with a giant.
    let found = false;
    for (let v = 300; v < 900; v += 2) {
      const small = flyBalloon({ vx: v, vy: v, giant: false }, NO_WIND, 0);
      const big = flyBalloon({ vx: v, vy: v, giant: true }, NO_WIND, 0);
      if (small.hit === 'miss' && (big.hit === 'near' || big.hit === 'body' || big.hit === 'head')) found = true;
    }
    expect(found).toBe(true);
  });

  it('landing near them still splashes for one', () => {
    let near = null;
    for (let v = 300; v < 900 && !near; v += 1) {
      const f = flyBalloon({ vx: v, vy: v, giant: false }, NO_WIND, 0);
      if (f.hit === 'near') near = f;
    }
    expect(near?.points).toBe(1);
    expect(near?.y).toBe(WB_GROUND);
  });

  it('a flat throw hits the hedge', () => {
    const f = flyBalloon({ vx: 800, vy: 40, giant: false }, NO_WIND, 150);
    expect(f.hit).toBe('hedge');
    expect(f.points).toBe(0);
    expect(Math.abs(f.x - WB_HEDGE_X)).toBeLessThan(60);
  });

  it('too soft falls short', () => {
    const f = flyBalloon({ vx: 100, vy: 100, giant: false }, NO_WIND, HEDGE);
    expect(f.hit).toBe('miss');
    expect(f.x).toBeLessThan(WB_HEDGE_X);
    expect(f.x).toBeGreaterThan(WB_HAND_X);
  });

  it('takes turns, soaks the one who is hit, and ends at full', () => {
    const id = 'balloon-1';
    // Each throw searched for against its own wind, the way a player would adjust.
    const aimed = (k: number, seat: Seat) => {
      for (let v = 200; v < 1100; v += 1) {
        const t = { vx: v, vy: v, giant: false };
        const f = flyBalloon(t, windForThrower(windOf(id, k), seat), hedgeOf(id));
        if (f.hit === 'head') return encodeThrow(t);
      }
      throw new Error('no aim');
    };
    const wide = encodeThrow({ vx: 100, vy: 100, giant: false });
    let g = balloon([], 'user', id);
    let k = 0;
    // The user only ever hits; the partner always misses.
    while (!standing(g).over) {
      const seat = standing(g).turn;
      const move = seat === 'user' ? aimed(k, seat) : wide;
      expect(canMove(g, seat, move)).toBe(true);
      expect(canMove(g, seat === 'user' ? 'partner' : 'user', move)).toBe(false);
      g = withMove(g, move);
      k++;
      expect(k).toBeLessThan(20);
    }
    const s = playBalloon(g);
    expect(s.winner).toBe('user');
    expect(s.soak.partner).toBe(SOAK_FULL);
    expect(s.soak.user).toBe(0);
    expect(standing(g).winner).toBe('user');
  });

  it('each of you gets one giant balloon a game', () => {
    const wide = encodeThrow({ vx: 100, vy: 100, giant: true });
    const plain = encodeThrow({ vx: 100, vy: 100, giant: false });
    let g = balloon([]);
    expect(playBalloon(g).giantLeft).toEqual({ user: true, partner: true });
    expect(canMove(g, 'user', wide)).toBe(true);
    g = withMove(g, wide);
    expect(playBalloon(g).giantLeft).toEqual({ user: false, partner: true });
    g = withMove(g, plain);
    expect(canMove(g, 'user', wide)).toBe(false);
    expect(canMove(g, 'user', plain)).toBe(true);
    // A second giant arriving from another phone is not played.
    const cheat = { ...g, moves: [...g.moves, wide] };
    expect(cleanGame(JSON.parse(JSON.stringify(cheat)), 'balloon')!.moves).toEqual(g.moves);
  });

  it('the recorded flight ends where the rules say it did', () => {
    const move = encodeThrow({ vx: 520, vy: 560, giant: false });
    const g = balloon([move]);
    const s = playBalloon(g);
    const f = recordFlight(g, 0, 'user', move);
    expect(f.hit).toBe(s.last!.flight.hit);
    expect(f.x).toBe(s.last!.flight.x);
    expect(f.path.length).toBeGreaterThan(20);
  });

  it('a mark on the ground is in the same place on both phones', () => {
    const g = balloon([encodeThrow({ vx: 200, vy: 300, giant: false }), encodeThrow({ vx: 200, vy: 300, giant: false })]);
    const s = playBalloon(g);
    // The user throws left to right; the partner right to left.
    expect(s.marks[0].x).toBeLessThan(500);
    expect(s.marks[1].x).toBeGreaterThan(500);
  });

  it('has its own record, and two copies merge like any other', () => {
    expect(recordTypeOf('balloon')).toBe('GAME_BALLOON');
    expect(kindOfRecord('GAME_BALLOON')).toBe('balloon');
    const a = encodeThrow({ vx: 300, vy: 300, giant: false });
    const b = encodeThrow({ vx: 310, vy: 300, giant: false });
    const long = balloon([a, b]);
    const short = balloon([a]);
    expect(mergeGame(short, long).moves).toEqual([a, b]);
  });
});
