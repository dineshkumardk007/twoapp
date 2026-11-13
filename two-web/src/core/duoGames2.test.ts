import { describe, expect, it } from 'vitest';
import { DUO_BY_SCORE, DUO_GAMES } from './duo';
import {
  SHIP_AT,
  SHIP_MAX,
  SHIP_MIN,
  SPACE_SECONDS,
  SPACE_SHIELDS,
  cleanSpaceSaid,
  fired,
  flown,
  freshState,
  isGone,
  pilotOf,
  placeOf,
  reachesAt,
  shipToWire,
  shotToWire,
  spaceHost,
  spaceOver,
  spaceToWire,
  thingsOf,
  type Thing
} from './spaceCrew';
import {
  AIR_GIFT_S,
  CURRENT_COSTS_S,
  DIVE_SIGNS,
  airSent,
  allChests,
  breathed,
  cleanDiveSaid,
  diveOf,
  diveShape,
  diveToWire,
  diverOf,
  inSight,
  newDive,
  nextTo,
  stroke
} from './treasureDive';

const mix = (h: number, text: string) => {
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0;
  return h;
};

// Both phones make a level from its number. If either of these changes, the
// two of you are no longer playing the same thing: change DIVE_MAKING with
// it, on purpose, or do not change how they are made.
const DIVES_SUM = 2993446628;
const THINGS_SUM = 4177586426;

describe('the later games for two at once', () => {
  it('are games like the others, counted by level or by best score', () => {
    expect(DUO_GAMES).toEqual(['bomb', 'catch', 'lamp', 'dive', 'space']);
    expect(DUO_BY_SCORE).toEqual(['catch', 'space']);
  });

  it('every sound they play has been made', () => {
    const files = Object.keys(import.meta.glob('../assets/sounds/g-*.mp3'));
    for (const name of ['g-dv-swim', 'g-dv-chest', 'g-dv-current', 'g-dv-air', 'g-sp-shot', 'g-sp-boom', 'g-sp-crack', 'g-sp-hit', 'g-sp-star', 'g-sp-kit']) {
      expect(files.some(f => f.endsWith(`/${name}.mp3`)), name).toBe(true);
    }
  });
});

describe('Treasure Divers', () => {
  it('makes every sea floor the same way on both phones', () => {
    let sum = 7;
    for (let level = 1; level <= 120; level++) sum = mix(sum, JSON.stringify(diveOf(level)));
    expect(sum).toBe(DIVES_SUM);
  });

  /** The strokes from a square to every other, going round rocks - and currents too, when asked. */
  const far = (sea: ReturnType<typeof diveOf>, from: number, clear: boolean) => {
    const out: number[] = new Array(sea.w * sea.h).fill(-1);
    out[from] = 0;
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      for (let d = 0; d < 4; d++) {
        const next = nextTo(sea, queue[i], d);
        if (next < 0 || out[next] >= 0 || sea.rock[next] || (clear && sea.current[next])) continue;
        out[next] = out[queue[i]] + 1;
        queue.push(next);
      }
    }
    return out;
  };

  it('every chest can be reached, and brought back, without touching a current - and there is air enough to', () => {
    for (let level = 1; level <= 150; level++) {
      const sea = diveOf(level);
      const shape = diveShape(level);
      expect(sea.chests.length).toBe(shape.chests);
      expect(new Set(sea.chests).size).toBe(shape.chests);
      expect(sea.rock[sea.start]).toBe(false);
      expect(sea.current[sea.start]).toBe(false);
      const safe = far(sea, sea.start, true);
      for (const chest of sea.chests) {
        expect(sea.rock[chest] || sea.current[chest]).toBe(false);
        expect(safe[chest], `level ${level}`).toBeGreaterThan(0);
      }
      // A stroke a second, with time over.
      expect(sea.air).toBeGreaterThan(sea.tour + 8);
      expect(sea.tour).toBeGreaterThanOrEqual(sea.w + sea.h);
    }
  });

  it('you dive in turns', () => {
    expect(diverOf(1)).toBe('user');
    expect(diverOf(2)).toBe('partner');
  });

  it('the diver sees only the squares right beside them', () => {
    const sea = diveOf(5);
    const mid = sea.w + 1;
    expect(inSight(sea, mid, mid)).toBe(true);
    expect(inSight(sea, mid + 1, mid)).toBe(true);
    expect(inSight(sea, mid + sea.w + 1, mid)).toBe(true);
    expect(inSight(sea, mid + 2, mid)).toBe(false);
    expect(inSight(sea, mid + 2 * sea.w, mid)).toBe(false);
  });

  it('a dive following the clear way round brings every chest up', () => {
    for (const level of [1, 6, 15, 30, 60]) {
      const sea = diveOf(level);
      let run = newDive(sea, 3);
      const swimTo = (target: number) => {
        // Back along the way from the target.
        const dist = far(sea, target, true);
        // (The way to one chest may pass another, and the anchor: the dive may end on the way.)
        while (run.pos !== target && !run.over) {
          const d = [0, 1, 2, 3].find(way => {
            const next = nextTo(sea, run.pos, way);
            return next >= 0 && dist[next] === dist[run.pos] - 1;
          })!;
          const result = stroke(run, sea, d);
          expect(['swam', 'chest', 'up']).toContain(result.did);
          run = result.run;
        }
      };
      for (const chest of sea.chests) swimTo(chest);
      expect(allChests(sea, run.got)).toBe(true);
      swimTo(sea.start);
      expect(run.over).toBe(1);
      expect(run.hits).toBe(0);
      expect(run.air).toBe(sea.air);
      expect(stroke(run, sea, 1).did).toBe('nothing');
    }
  });

  it('rocks and the edge stop a stroke; a current is swum through and costs air; no air ends the dive', () => {
    const sea = diveOf(12);
    const run = newDive(sea, 1);
    expect(stroke(run, sea, 0).did).toBe('edge');
    const rock = sea.rock.findIndex((is, cell) => is && [0, 1, 2, 3].some(d => nextTo(sea, cell, d) >= 0 && !sea.rock[nextTo(sea, cell, d)]));
    const beside = [0, 1, 2, 3].map(d => nextTo(sea, rock, d)).find(cell => cell >= 0 && !sea.rock[cell])!;
    const toRock = [0, 1, 2, 3].find(d => nextTo(sea, beside, d) === rock)!;
    expect(stroke({ ...run, pos: beside }, sea, toRock)).toEqual({ run: { ...run, pos: beside }, did: 'rock' });
    const current = sea.current.findIndex(Boolean);
    const near = [0, 1, 2, 3].map(d => nextTo(sea, current, d)).find(cell => cell >= 0 && !sea.rock[cell])!;
    const toCurrent = [0, 1, 2, 3].find(d => nextTo(sea, near, d) === current)!;
    const swept = stroke({ ...run, pos: near }, sea, toCurrent);
    expect(swept.did).toBe('current');
    expect(swept.run.pos).toBe(current);
    expect(swept.run.air).toBe(sea.air - CURRENT_COSTS_S);
    expect(swept.run.hits).toBe(1);
    const last = stroke({ ...run, pos: near, air: 2 }, sea, toCurrent);
    expect(last.did).toBe('out');
    expect(last.run.over).toBe(2);
    expect(breathed(run, 10).air).toBe(sea.air - 10);
    expect(breathed(run, sea.air + 1).over).toBe(2);
    expect(airSent(run).air).toBe(sea.air + AIR_GIFT_S);
    expect(airSent(run).gifts).toBe(1);
    expect(airSent({ ...run, over: 2 }).gifts).toBe(0);
  });

  it('takes from the other phone only what a dive could have said', () => {
    const sea = diveOf(3);
    const run = { ...newDive(sea, 4), pos: 9, got: 1, hits: 2, gifts: 1 };
    expect(cleanDiveSaid({ s: diveToWire(run) })?.run).toEqual(run);
    expect(cleanDiveSaid({ g: 3 })).toEqual({ sign: 3 });
    expect(cleanDiveSaid({ g: DIVE_SIGNS.length })).toBeNull();
    expect(cleanDiveSaid({ go: 2 })).toEqual({ go: 2 });
    expect(cleanDiveSaid({ air: 1 })).toEqual({ air: true });
    expect(cleanDiveSaid({ s: { ...diveToWire(run), o: 5 } })).toBeNull();
    expect(cleanDiveSaid('glug')).toBeNull();
  });
});

describe('Space Crew', () => {
  it('sends the same things down at the same moments on both phones', () => {
    expect(mix(7, JSON.stringify(thingsOf(20261113)))).toBe(THINGS_SUM);
    expect(thingsOf(1)).not.toEqual(thingsOf(2));
  });

  it('a round has rocks to shoot, stars to pick up, and all of it within the field', () => {
    let kits = 0;
    for (const seed of [1, 99, 123456, 0xfffffff0, 7, 8, 9]) {
      const things = thingsOf(seed);
      expect(things.length).toBeGreaterThan(55);
      expect(things.filter(one => one.kind === 'rock' || one.kind === 'big').length).toBeGreaterThan(things.length / 2);
      expect(things.some(one => one.kind === 'star')).toBe(true);
      kits += things.filter(one => one.kind === 'kit').length;
      for (let i = 0; i < things.length; i++) {
        const end = placeOf(things[i], reachesAt(things[i]));
        expect(end.y).toBeCloseTo(SHIP_AT, 6);
        expect(end.x).toBeGreaterThanOrEqual(0.02);
        expect(end.x).toBeLessThanOrEqual(0.98);
        expect(placeOf(things[i], things[i].t).y).toBe(0);
        expect(reachesAt(things[i])).toBeLessThan(SPACE_SECONDS + 3);
        if (i) expect(reachesAt(things[i])).toBeGreaterThanOrEqual(reachesAt(things[i - 1]));
      }
    }
    expect(kits).toBeGreaterThan(5);
  });

  it('you swap seats every round, and the first seat keeps the score', () => {
    expect(pilotOf(1)).toBe('user');
    expect(pilotOf(2)).toBe('partner');
    expect(spaceHost('user')).toBe(true);
    expect(spaceHost('partner')).toBe(false);
  });

  const thing = (id: number, kind: Thing['kind'], x: number): Thing => ({ id, t: 0, x, kind, fall: 2, drift: 0 });

  it('a shot takes the nearest thing within reach: a rock goes at once, a big one in two, and a star is wasted', () => {
    const things = [thing(0, 'rock', 0.3), thing(1, 'big', 0.6), thing(2, 'star', 0.9)];
    const state = freshState();
    const at = (one: Thing) => placeOf(one, 1);
    // Wide of everything: nothing.
    expect(fired(state, things, 1, 0.05, 0.05)).toBeNull();
    expect(fired(state, things, 1, at(things[0]).x + 0.03, at(things[0]).y)).toEqual([0, 1]);
    expect(state.score.score).toBe(1);
    // Already gone: nothing there to hit.
    expect(fired(state, things, 1, at(things[0]).x, at(things[0]).y)).toBeNull();
    expect(fired(state, things, 1, at(things[1]).x, at(things[1]).y)).toEqual([1, 4]);
    expect(isGone(state.fates.get(1))).toBe(false);
    expect(fired(state, things, 1, at(things[1]).x, at(things[1]).y)).toEqual([1, 1]);
    expect(state.score.score).toBe(4);
    expect(fired(state, things, 1, at(things[2]).x, at(things[2]).y)).toEqual([2, 1]);
    expect(state.score.score).toBe(4);
    expect(state.score.rocks).toBe(2);
    // Not yet in the field, or already past the ship: nothing.
    expect(fired(freshState(), [{ ...things[0], t: 5 }], 1, 0.3, 0)).toBeNull();
    expect(fired(freshState(), things, 9, 0.3, SHIP_AT)).toBeNull();
  });

  it('what reaches the ship: a rock costs a shield, a star scores, a kit mends, and a miss is a miss', () => {
    const things = [thing(0, 'rock', 0.5), thing(1, 'star', 0.5), thing(2, 'rock', 0.1), thing(3, 'kit', 0.5), thing(4, 'rock', 0.5)];
    const state = freshState();
    expect(flown(state, things, 1, 0.5)).toEqual([]);
    const events = flown(state, things, 2.5, 0.5);
    expect(events).toEqual([
      [0, 2],
      [1, 3],
      [3, 3],
      [4, 2]
    ]);
    expect(state.score.done).toBe(5);
    expect(state.score.score).toBe(5);
    expect(state.score.stars).toBe(1);
    // One lost, one mended, one lost.
    expect(state.score.shields).toBe(SPACE_SHIELDS - 1);
    // A rock shot before it arrives does nothing to the ship.
    const shot = freshState();
    expect(fired(shot, [things[0]], 1, 0.5, placeOf(things[0], 1).y)).toEqual([0, 1]);
    expect(flown(shot, [things[0]], 2.5, 0.5)).toEqual([]);
    expect(shot.score.shields).toBe(SPACE_SHIELDS);
  });

  it('a ship that sits still under the rocks goes down; the round ends then, or on time', () => {
    const things = thingsOf(4242).map(one => ({ ...one, kind: 'rock' as const, x: 0.5, drift: 0 }));
    const state = freshState();
    const events = flown(state, things, SPACE_SECONDS + 5, 0.5);
    expect(state.score.shields).toBe(0);
    expect(events.length).toBe(SPACE_SHIELDS);
    expect(spaceOver(state.score, things, 5)).toBe(true);
    const clear = freshState();
    flown(clear, things, SPACE_SECONDS + 5, SHIP_MIN);
    expect(clear.score.shields).toBe(SPACE_SHIELDS);
    expect(clear.score.done).toBe(things.length);
    expect(spaceOver(freshState().score, things, 5)).toBe(false);
    expect(spaceOver(freshState().score, things, SPACE_SECONDS)).toBe(true);
  });

  it('takes from the other phone only what a round could have said', () => {
    const host = {
      e: 12,
      seed: 4000000000,
      round: 3,
      t: 12.34,
      score: 9,
      shields: 2,
      done: 14,
      ship: 0.5,
      events: [
        [13, 1],
        [14, 4]
      ] as Array<[number, 1 | 2 | 3 | 4]>,
      shots: [[7, 0.25, 0.5]] as Array<[number, number, number]>,
      end: false
    };
    expect(cleanSpaceSaid(spaceToWire(host))?.host).toEqual(host);
    expect(cleanSpaceSaid(shipToWire(12, 0.25))).toEqual({ ship: { e: 12, x: 0.25 } });
    expect(cleanSpaceSaid(shipToWire(12, 1))?.ship?.x).toBe(SHIP_MAX);
    expect(cleanSpaceSaid(shotToWire(12, 0.25, 0.75))).toEqual({ shot: { e: 12, x: 0.25, y: 0.75 } });
    expect(cleanSpaceSaid({ go: 1 })).toEqual({ go: true });
    expect(cleanSpaceSaid({ h: [1, 2, 3] })).toBeNull();
    expect(cleanSpaceSaid({ f: [1, 2000, 3] })).toBeNull();
    // A fate there is no such thing as is left out.
    expect(cleanSpaceSaid({ ...spaceToWire(host), o: [13 * 8 + 7] })?.host?.events).toEqual([]);
    expect(cleanSpaceSaid('pew')).toBeNull();
  });
});
