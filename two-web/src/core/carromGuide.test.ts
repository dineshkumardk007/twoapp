import { describe, expect, it } from 'vitest';
import {
  BOARD,
  CAN_WIDE_POCKETS,
  CARROM_WIDE_MARK,
  COIN_R,
  POCKETS,
  POCKET_R,
  POCKET_R_WIDE,
  STRIKER_R,
  baselineY,
  carromAfter,
  carromId,
  coinRoll,
  coinSpeedFrom,
  encodeShot,
  firstContact,
  freshCarrom,
  playCarrom,
  pocketROf,
  reachOf,
  simulateShot,
  speedAfter,
  strikerAfter,
  type Coin
} from './carrom';
import { cleanGame, newGame } from './paperGames';

const id_ = () => 'abc' + CARROM_WIDE_MARK;
const coin = (id: number, x: number, y: number): Coin => ({ id, kind: id === 0 ? 'queen' : id <= 9 ? 'white' : 'black', x, y });

describe('Carrom: which pockets a game is played on', () => {
  it('a game says wider pockets in its id; one without the mark keeps the old', () => {
    const id = carromId('abc', true);
    expect(id).toBe('abc' + CARROM_WIDE_MARK);
    expect(pocketROf(id)).toBe(POCKET_R_WIDE);
    expect(pocketROf('abc')).toBe(POCKET_R);
    expect(playCarrom({ id, first: 'user', moves: [] }).pocketR).toBe(POCKET_R_WIDE);
    expect(playCarrom({ id: 'abc', first: 'user', moves: [] }).pocketR).toBe(POCKET_R);
    // Marked once only.
    expect(carromId(id, true)).toBe(id);
  });

  it('wider pockets only once the other phone knows them too', () => {
    // A phone still on the version before would work every shot out on the old pockets.
    expect(carromId('abc', false)).toBe('abc');
    expect(pocketROf(carromId('abc', false))).toBe(POCKET_R);
    expect(CAN_WIDE_POCKETS.length).toBeLessThanOrEqual(32);
    // The game itself never changes an id it is given.
    expect(newGame('carrom', undefined, 'user', 'abc', 1).id).toBe('abc');
    expect(newGame('carrom', undefined, 'user', id_(), 1).id).toBe(id_());
  });

  it('the id comes through another phone as it is, so both play on the same pockets', () => {
    const g = newGame('carrom', undefined, 'user', carromId('abc', true), 1);
    const there = cleanGame(JSON.parse(JSON.stringify(g)), 'carrom');
    expect(there?.id).toBe(g.id);
    expect(playCarrom(there!).pocketR).toBe(POCKET_R_WIDE);
  });

  it('wider pockets take a coin the old ones let run past', () => {
    // A coin running along the top side, to pass 50 from the corner pocket's middle.
    const py = POCKETS[0][1];
    const c = coin(1, 500, py + 50);
    expect(coinRoll([c], c, -1, 0, POCKET_R).pocket).toBe(-1);
    expect(coinRoll([c], c, -1, 0, POCKET_R_WIDE).pocket).toBe(0);
  });

  it('a whole shot can end differently on the two: the same game must use the same', () => {
    // The striker itself, sent to pass about 50 from the top-left pocket's middle.
    const [px, py] = POCKETS[0];
    const y0 = baselineY('user');
    const dx = px + 50 - 190;
    const dy = py - y0;
    const len = Math.hypot(dx, dy);
    const shot = { x: 190, dx: Math.round((dx / len) * 2900), dy: Math.round((dy / len) * 2900) };
    // On the old pockets it runs past and comes off the side first; on the wider ones it is in at once.
    const narrow = simulateShot([], 'user', shot, true, POCKET_R).recording!.events[0];
    const wide = simulateShot([], 'user', shot, true, POCKET_R_WIDE).recording!.events[0];
    expect(narrow.type).toBe('wall');
    expect(wide.type).toBe('pot');
    expect(wide.kind).toBe('striker');
  });

  it('replays a game the same every time, on its own pockets', () => {
    const moves = [encodeShot({ x: 500, dx: 0, dy: -2600 }), encodeShot({ x: 480, dx: 300, dy: 2400 })];
    for (const id of ['old', 'new' + CARROM_WIDE_MARK]) {
      const one = JSON.stringify(carromAfter({ id, first: 'user', moves }, 2));
      const again = JSON.stringify(carromAfter({ id: id, first: 'user', moves: moves.slice() }, 2));
      expect(again).toBe(one);
    }
    expect(freshCarrom('user').pocketR).toBe(POCKET_R);
    expect(freshCarrom('user', POCKET_R_WIDE).pocketR).toBe(POCKET_R_WIDE);
  });
});

describe('Carrom: the aiming guide', () => {
  it('finds the first coin on the line, and how far off', () => {
    const coins = [coin(1, 500, 500), coin(2, 500, 300)];
    const hit = firstContact(coins, 500, baselineY('user'), 0, -1);
    expect(hit.coin?.id).toBe(1);
    expect(hit.t).toBeCloseTo(baselineY('user') - 500 - (COIN_R + STRIKER_R), 5);
    expect(hit.bounce).toBeNull();
  });

  it('with nothing in the way, the side it would come off', () => {
    const hit = firstContact([], 500, baselineY('user'), 0, -1);
    expect(hit.coin).toBeNull();
    expect(hit.t).toBeCloseTo(baselineY('user') - STRIKER_R, 5);
    expect(hit.bounce).toEqual([0, 1]);
  });

  it('a coin goes off exactly along the line between the two, as the guide draws it', () => {
    // A cut shot: the striker passes a little to one side of the coin.
    const target = coin(1, 520, 500);
    const y0 = baselineY('user');
    const hit = firstContact([target], 500, y0, 0, -1);
    const ex = 500;
    const ey = y0 - hit.t;
    const nx = (target.x - ex) / (COIN_R + STRIKER_R);
    const ny = (target.y - ey) / (COIN_R + STRIKER_R);
    // Gently, so it stops before it reaches a side.
    const out = simulateShot([target], 'user', { x: 500, dx: 0, dy: -1000 }, true);
    expect(out.recording!.events.some(e => e.type === 'wall')).toBe(false);
    const moved = out.coins[0];
    const dx = moved.x - target.x;
    const dy = moved.y - target.y;
    const len = Math.hypot(dx, dy);
    expect(len).toBeGreaterThan(50);
    // Within a degree and a half: the shot is worked out in small steps of time.
    const cos = (dx / len) * nx + (dy / len) * ny;
    expect(Math.acos(Math.min(1, cos)) * (180 / Math.PI)).toBeLessThan(1.5);
  });

  it('how far the guide says a coin will go is about how far it goes', () => {
    for (const v of [900, 1500, 2200]) {
      const target = coin(1, 500, 520);
      const y0 = baselineY('user');
      const hit = firstContact([target], 500, y0, 0, -1);
      const said = reachOf(coinSpeedFrom(speedAfter(v, hit.t)));
      const out = simulateShot([target], 'user', { x: 500, dx: 0, dy: -v }, true);
      const wall = out.recording!.events.some(e => e.type === 'wall');
      if (wall) continue;
      const went = Math.hypot(out.coins[0].x - target.x, out.coins[0].y - target.y);
      expect(Math.abs(went - said)).toBeLessThan(Math.max(12, said * 0.06));
    }
  });

  it('speedAfter: slower the further it has gone, and stopped past its reach', () => {
    expect(speedAfter(1000, 0)).toBe(1000);
    expect(speedAfter(1000, 100)).toBeLessThan(1000);
    expect(speedAfter(1000, 100)).toBeGreaterThan(speedAfter(1000, 200));
    const reach = reachOf(1000);
    expect(reach).toBeGreaterThan(200);
    expect(speedAfter(1000, reach + 5)).toBe(0);
    expect(reachOf(0)).toBe(0);
  });

  it('follows a coin to the pocket it is headed for', () => {
    const c = coin(1, 300, 300);
    const [px, py] = POCKETS[0];
    const len = Math.hypot(px - 300, py - 300);
    const roll = coinRoll([c], c, (px - 300) / len, (py - 300) / len);
    expect(roll.pocket).toBe(0);
    expect([roll.x, roll.y]).toEqual([px, py]);
  });

  it('or to the side, or the coin, that stops it first', () => {
    const c = coin(1, 500, 500);
    const side = coinRoll([c], c, 1, 0);
    expect(side.pocket).toBe(-1);
    expect(side.x).toBeGreaterThan(BOARD - COIN_R - 7);
    const blocked = coinRoll([c, coin(2, 700, 500)], c, 1, 0);
    expect(blocked.pocket).toBe(-1);
    expect(blocked.x).toBeLessThan(700 - 2 * COIN_R + 7);
    expect(blocked.x).toBeGreaterThan(700 - 2 * COIN_R - 7);
  });

  it('the striker carries on forward from a full hit, and glances off a thin one', () => {
    // Full on: it follows, straight (it is the heavier).
    expect(strikerAfter(0, -1, 0, -1)).toEqual([0, -1]);
    // A thin cut to the right: the coin goes right, the striker is turned a little left, still going up.
    const n = [Math.SQRT1_2, -Math.SQRT1_2];
    const [ax, ay] = strikerAfter(0, -1, n[0], n[1]);
    expect(ax).toBeLessThan(0);
    expect(ay).toBeLessThan(0);
    expect(Math.hypot(ax, ay)).toBeCloseTo(1, 6);
  });
});
