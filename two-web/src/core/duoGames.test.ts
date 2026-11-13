import { afterEach, describe, expect, it } from 'vitest';
import {
  BOMB_COLOURS,
  BOMB_MARKS,
  BOMB_SIGN_COUNT,
  BOMB_STRIKES,
  bombOf,
  bombShape,
  bombSign,
  cleanBombSaid,
  cutWire,
  defuserOf,
  laterRun,
  newRun,
  pressKey,
  runToWire,
  ticked
} from './bombSquad';
import {
  CATCH_LIVES,
  CATCH_SECONDS,
  HAND_MAX,
  HAND_MIN,
  advance,
  catchHost,
  cleanCatchSaid,
  dropsOf,
  freshScore,
  handToWire,
  hostToWire,
  inNet,
  landed,
  landsAt,
  roundOver
} from './catchTogether';
import { CAN_DUO, DUO_GAMES, DUO_NAMES, DUO_RECORD, cleanDuoHalf, duoOf, hearDuo, mergeDuo, onDuo, sayDuo, setDuoSender, withDuo } from './duo';
import { isGameRoom } from './gameEmotes';
import { DUO_TOURS } from './gameTours';
import { TA } from './i18n.ta';
import { beside, cleanLampSaid, keyOn, lampCarrier, lampDone, lampOf, lampShape, lampStep, lampToWire, lit, shadowStep, solveLamp } from './lampMaze';

const mix = (h: number, text: string) => {
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0;
  return h;
};

// Both phones make a level from its number. If any of these change, the two
// of you are no longer playing the same level: change the MAKING number of
// that game with it, on purpose, or do not change how levels are made.
const LAMPS_SUM = 1950335466;
const BOMBS_SUM = 3538870287;
const DROPS_SUM = 4229252612;

describe('the games for two at once: what is kept', () => {
  it('each phone counts only what it has seen, and nothing is ever taken back', () => {
    expect(DUO_RECORD).toBe('GAME_DUO');
    expect(CAN_DUO).toBe('duo-1');
    expect(cleanDuoHalf({ bomb: 3, lamp: 2, catch: 41, at: 5 })).toEqual({ bomb: 3, lamp: 2, catch: 41, at: 5 });
    expect(cleanDuoHalf({ bomb: -3, lamp: 'x', catch: 2.9, at: 5 })).toEqual({ bomb: 0, lamp: 0, catch: 2, at: 5 });
    expect(cleanDuoHalf({ bomb: 1, at: 0 })).toBeNull();
    expect(cleanDuoHalf('duo')).toBeNull();
    const a = { bomb: 3, lamp: 1, catch: 10, at: 5 };
    const b = { bomb: 2, lamp: 4, catch: 10, at: 9 };
    expect(mergeDuo(a, b)).toEqual({ bomb: 3, lamp: 4, catch: 10, at: 9 });
    expect(mergeDuo(a, { bomb: 1, lamp: 1, catch: 2, at: 99 })).toBe(a);
    expect(mergeDuo(undefined, b)).toBe(b);
    expect(duoOf(a, b)).toEqual({ bomb: 3, lamp: 4, catch: 10 });
    expect(duoOf(undefined, undefined)).toEqual({ bomb: 0, lamp: 0, catch: 0 });
    expect(withDuo(a, 'bomb', 2, 20)).toBe(a);
    expect(withDuo(a, 'bomb', 4, 20)).toEqual({ ...a, bomb: 4, at: 20 });
    expect(withDuo(undefined, 'catch', 7, 20)).toEqual({ bomb: 0, lamp: 0, catch: 7, at: 20 });
  });

  it('each is a game the other one can be on, with a name, a how-to-play, and Tamil for both', () => {
    for (const game of DUO_GAMES) {
      expect(isGameRoom(game)).toBe(true);
      expect(TA[DUO_NAMES[game]], game).toBeTruthy();
      expect(DUO_TOURS[game].length).toBeGreaterThanOrEqual(5);
      for (const line of DUO_TOURS[game]) expect(TA[line.text], line.text).toBeTruthy();
    }
  });

  it('every sound they play has been made', () => {
    const files = Object.keys(import.meta.glob('../assets/sounds/g-*.mp3'));
    for (const name of ['g-bm-tick', 'g-bm-cut', 'g-bm-wrong', 'g-bm-boom', 'g-bm-safe', 'g-ct-star', 'g-ct-heart', 'g-ct-bomb', 'g-lm-key', 'g-lm-gate']) {
      expect(files.some(f => f.endsWith(`/${name}.mp3`)), name).toBe(true);
    }
  });
});

describe('the games for two at once: what is said as they are played', () => {
  afterEach(() => setDuoSender(null));

  it('goes out with the game it is for, and reaches only that game', () => {
    const sent: unknown[] = [];
    sayDuo('bomb', { g: 1 });
    setDuoSender(said => sent.push(said));
    sayDuo('catch', { go: 1 });
    expect(sent).toEqual([{ g: 'catch', b: { go: 1 } }]);
    const bomb: unknown[] = [];
    const lamp: unknown[] = [];
    const stopBomb = onDuo('bomb', body => bomb.push(body));
    const stopLamp = onDuo('lamp', body => lamp.push(body));
    hearDuo({ g: 'bomb', b: { g: 3 } });
    hearDuo({ g: 'lamp', b: { l: 1 } });
    hearDuo({ g: 'chess', b: { x: 1 } });
    hearDuo({ g: 'bomb', b: 'boom' });
    hearDuo(null);
    expect(bomb).toEqual([{ g: 3 }]);
    expect(lamp).toEqual([{ l: 1 }]);
    stopBomb();
    stopLamp();
    hearDuo({ g: 'bomb', b: { g: 3 } });
    expect(bomb.length).toBe(1);
  });
});

describe('Bomb Squad', () => {
  it('makes every bomb the same way on both phones', () => {
    let sum = 7;
    for (let level = 1; level <= 120; level++) {
      const m = bombOf(level);
      sum = mix(sum, JSON.stringify([m.tag, m.wires, m.cuts, m.pad, m.press, m.pages, m.truth, m.seconds]));
    }
    expect(sum).toBe(BOMBS_SUM);
  });

  it('every bomb has one right page, told apart from the others by its label alone', () => {
    for (let level = 1; level <= 150; level++) {
      const bomb = bombOf(level);
      const shape = bombShape(level);
      expect(bomb.wires.length).toBe(shape.wires);
      expect(bomb.cuts.length).toBe(shape.cuts);
      expect(new Set(bomb.cuts).size).toBe(shape.cuts);
      expect(bomb.pad.length).toBe(shape.pad);
      expect([...bomb.press].sort()).toEqual(bomb.pad.map((_, i) => i));
      expect(bomb.pages.length).toBe(shape.pages);
      expect(new Set(bomb.pages.map(page => page.tag.join())).size).toBe(shape.pages);
      const page = bomb.pages[bomb.truth];
      expect(page.tag).toEqual(bomb.tag);
      expect(page.steps).toEqual(bomb.cuts.map(i => bomb.wires[i]));
      expect(page.keys).toEqual(bomb.press.map(i => bomb.pad[i]));
      // No two wires look the same, so a step in the book means one wire only.
      expect(new Set(bomb.wires.map(w => `${w.colour}:${w.mark}`)).size).toBe(shape.wires);
      for (const w of bomb.wires) {
        expect(w.colour).toBeLessThan(BOMB_COLOURS.length);
        expect(w.mark).toBeLessThan(BOMB_MARKS.length);
        expect(w.mark >= 0).toBe(shape.marks);
      }
      // No wrong page tells you to do exactly the right thing.
      bomb.pages.forEach((other, p) => {
        if (p !== bomb.truth) expect(JSON.stringify([other.steps, other.keys])).not.toBe(JSON.stringify([page.steps, page.keys]));
      });
    }
  });

  it('you take the bomb in turns', () => {
    expect(defuserOf(1)).toBe('user');
    expect(defuserOf(2)).toBe('partner');
    expect(defuserOf(7)).toBe('user');
  });

  it('is made safe by the right wires and buttons in order, and goes off after three mistakes', () => {
    const bomb = bombOf(8);
    let run = newRun(bomb, 5);
    expect(run.left).toBe(bomb.seconds);
    // A button before the wires are done is nothing.
    expect(pressKey(run, bomb, bomb.press[0]).did).toBe('nothing');
    const wrongWire = bomb.wires.findIndex((_, i) => i !== bomb.cuts[0]);
    let touch = cutWire(run, bomb, wrongWire);
    expect(touch.did).toBe('wrong');
    expect(touch.run.strikes).toBe(1);
    expect(touch.run.cut).toEqual([]);
    expect(touch.run.left).toBeLessThan(run.left);
    run = touch.run;
    for (const wire of bomb.cuts) {
      touch = cutWire(run, bomb, wire);
      expect(touch.did).toBe('ok');
      run = touch.run;
    }
    // A wire already cut, cut again: nothing.
    expect(cutWire(run, bomb, bomb.cuts[0]).did).toBe('nothing');
    touch = pressKey(run, bomb, bomb.press[0]);
    expect(touch.did).toBe('ok');
    // The wrong button: a strike, and the buttons start again.
    const wrongKey = pressKey(touch.run, bomb, bomb.press[2]);
    expect(wrongKey.did).toBe('wrong');
    expect(wrongKey.run.pressed).toBe(0);
    expect(wrongKey.run.strikes).toBe(2);
    run = wrongKey.run;
    bomb.press.forEach((key, i) => {
      touch = pressKey(run, bomb, key);
      expect(touch.did).toBe(i === bomb.press.length - 1 ? 'safe' : 'ok');
      run = touch.run;
    });
    expect(run.over).toBe(1);
    expect(cutWire(run, bomb, 0).did).toBe('nothing');

    let bad = newRun(bomb, 6);
    for (let i = 0; i < BOMB_STRIKES; i++) {
      const hit = cutWire(bad, bomb, wrongWire);
      expect(hit.did).toBe(i === BOMB_STRIKES - 1 ? 'boom' : 'wrong');
      bad = hit.run;
    }
    expect(bad.over).toBe(2);
  });

  it('a bomb with no buttons is safe when its last wire is cut; and the clock running out sets it off', () => {
    const bomb = bombOf(1);
    let run = newRun(bomb, 1);
    bomb.cuts.forEach((wire, i) => {
      const touch = cutWire(run, bomb, wire);
      expect(touch.did).toBe(i === bomb.cuts.length - 1 ? 'safe' : 'ok');
      run = touch.run;
    });
    const late = ticked(newRun(bomb, 2), bomb.seconds + 1);
    expect(late.over).toBe(2);
    expect(late.left).toBe(0);
    expect(ticked(newRun(bomb, 2), 10).left).toBe(bomb.seconds - 10);
    expect(ticked(run, 10)).toBe(run);
  });

  it('takes from the other phone only what a bomb could have said', () => {
    const bomb = bombOf(8);
    const run = cutWire(newRun(bomb, 9), bomb, bomb.cuts[0]).run;
    expect(cleanBombSaid({ s: runToWire(run) })?.run).toEqual(run);
    expect(cleanBombSaid({ g: 4 })).toEqual({ sign: 4 });
    expect(cleanBombSaid({ g: BOMB_SIGN_COUNT })).toBeNull();
    expect(cleanBombSaid({ go: 3 })).toEqual({ go: 3 });
    expect(cleanBombSaid({ s: { ...runToWire(run), c: [1, 1] } })).toBeNull();
    expect(cleanBombSaid({ s: { ...runToWire(run), x: 9 } })).toBeNull();
    expect(cleanBombSaid('tick')).toBeNull();
    expect(bombSign(0)).toEqual({ kind: 'colour', i: 0 });
    expect(bombSign(6)).toEqual({ kind: 'mark', i: 0 });
    expect(bombSign(12)).toEqual({ kind: 'word', i: 0 });
    expect(bombSign(-1)).toBeNull();
  });

  it('believes the later word about a bomb', () => {
    const bomb = bombOf(8);
    const a = newRun(bomb, 5);
    const b = cutWire(a, bomb, bomb.cuts[0]).run;
    expect(laterRun(null, a)).toBe(true);
    expect(laterRun(a, b)).toBe(true);
    expect(laterRun(b, a)).toBe(false);
    expect(laterRun(b, newRun(bomb, 6))).toBe(true);
    expect(laterRun(newRun(bomb, 6), b)).toBe(false);
    // A wrong button puts the buttons back, and is still the later word.
    const pressed = { ...b, cut: bomb.cuts, pressed: 2 };
    expect(laterRun(pressed, { ...pressed, pressed: 0, strikes: 1 })).toBe(true);
    expect(laterRun({ ...b, over: 1 }, b)).toBe(false);
  });
});

describe('Catch Together', () => {
  it('drops the same things at the same moments on both phones', () => {
    expect(mix(7, JSON.stringify(dropsOf(20261113)))).toBe(DROPS_SUM);
    expect(dropsOf(1)).not.toEqual(dropsOf(2));
  });

  it('a round has plenty to catch, some bombs, and everything within reach', () => {
    for (const seed of [1, 99, 123456, 0xfffffff0]) {
      const drops = dropsOf(seed);
      expect(drops.length).toBeGreaterThan(50);
      const bombs = drops.filter(d => d.kind === 'bomb').length;
      expect(bombs).toBeGreaterThan(5);
      expect(bombs).toBeLessThan(drops.length / 2);
      for (let i = 0; i < drops.length; i++) {
        expect(drops[i].x).toBeGreaterThanOrEqual(HAND_MIN - 0.2);
        expect(drops[i].x).toBeLessThanOrEqual(HAND_MAX + 0.2);
        expect(landsAt(drops[i])).toBeLessThan(CATCH_SECONDS + 2);
        if (i) expect(landsAt(drops[i])).toBeGreaterThanOrEqual(landsAt(drops[i - 1]));
      }
      expect(new Set(drops.map(d => d.id)).size).toBe(drops.length);
    }
  });

  it('what is between your two hands is in the net, whichever way round you stand', () => {
    expect(inNet(0.5, 0.3, 0.7)).toBe(true);
    expect(inNet(0.5, 0.7, 0.3)).toBe(true);
    expect(inNet(0.2, 0.3, 0.7)).toBe(false);
    expect(inNet(0.72, 0.3, 0.7)).toBe(true);
    expect(inNet(0.9, 0.3, 0.7)).toBe(false);
    expect(catchHost('user')).toBe(true);
    expect(catchHost('partner')).toBe(false);
  });

  it('stars and hearts count, a run of five is a bonus, and a bomb costs a life', () => {
    const star = { id: 0, t: 0, x: 0.5, kind: 'star' as const, fall: 2 };
    const heart = { ...star, kind: 'heart' as const };
    const bomb = { ...star, kind: 'bomb' as const };
    let score = freshScore();
    for (let i = 0; i < 4; i++) score = landed(score, star, 0.3, 0.7).score;
    expect(score.score).toBe(4);
    score = landed(score, star, 0.3, 0.7).score;
    expect(score.score).toBe(7);
    expect(landed(score, heart, 0.3, 0.7).score.score).toBe(10);
    // Let go by: no points, and the run of them ends.
    const missed = landed(score, star, 0.1, 0.2);
    expect(missed.outcome).toBe(0);
    expect(missed.score.streak).toBe(0);
    expect(missed.score.score).toBe(7);
    // A bomb let go by is as it should be.
    const dodged = landed(score, bomb, 0.1, 0.2);
    expect(dodged.score.lives).toBe(CATCH_LIVES);
    expect(dodged.score.streak).toBe(5);
    const hit = landed(score, bomb, 0.3, 0.7);
    expect(hit.outcome).toBe(1);
    expect(hit.score.lives).toBe(CATCH_LIVES - 1);
    expect(hit.score.streak).toBe(0);
  });

  it('a round played with the net wide open ends on its third bomb; with no net at all it ends on time, with nothing', () => {
    const drops = dropsOf(4242);
    const wide = advance(freshScore(), drops, CATCH_SECONDS + 5, HAND_MIN, HAND_MAX);
    expect(wide.score.lives).toBe(0);
    expect(wide.score.bombs).toBe(CATCH_LIVES);
    expect(roundOver(wide.score, drops, 10)).toBe(true);
    expect(wide.events.length).toBe(wide.score.done);
    // Away in a corner, hands together, nothing lands in it.
    const none = advance(freshScore(), drops.map(d => ({ ...d, x: 0.5 })), CATCH_SECONDS + 5, HAND_MIN, HAND_MIN);
    expect(none.score.score).toBe(0);
    expect(none.score.lives).toBe(CATCH_LIVES);
    expect(none.score.done).toBe(drops.length);
    expect(roundOver(none.score, drops, 1)).toBe(true);
    expect(roundOver(freshScore(), drops, 1)).toBe(false);
    expect(roundOver(freshScore(), drops, CATCH_SECONDS)).toBe(true);
    // Taken a little at a time, it comes to the same.
    let step = freshScore();
    for (let t = 0; t <= CATCH_SECONDS + 5; t += 0.25) step = advance(step, drops, t, HAND_MIN, HAND_MAX).score;
    expect(step).toEqual(wide.score);
  });

  it('takes from the other phone only what a round could have said', () => {
    const host = { e: 12, seed: 4000000000, t: 12.34, score: 9, lives: 2, streak: 3, done: 14, x: 0.5, events: [[13, 1], [14, 0]] as Array<[number, 0 | 1]>, end: false };
    expect(cleanCatchSaid(hostToWire(host))?.host).toEqual(host);
    expect(cleanCatchSaid(handToWire(12, 0.25))).toEqual({ hand: { e: 12, x: 0.25 } });
    expect(cleanCatchSaid(handToWire(12, 0))?.hand?.x).toBe(HAND_MIN);
    expect(cleanCatchSaid({ go: 1 })).toEqual({ go: true });
    expect(cleanCatchSaid({ h: [1, 2, 3] })).toBeNull();
    expect(cleanCatchSaid({ h: [12, 5, 0, 0, 9, 0, 0, 500, 0] })).toBeNull();
    expect(cleanCatchSaid('star')).toBeNull();
  });
});

describe('Light and Shadow', () => {
  it('makes every maze the same way on both phones', () => {
    let sum = 7;
    for (let level = 1; level <= 120; level++) {
      const m = lampOf(level);
      sum = mix(sum, JSON.stringify([m.w, m.h, m.links, m.gates, m.start, m.exit, m.reach2, m.steps]));
    }
    expect(sum).toBe(LAMPS_SUM);
  });

  it('every maze can be finished, and only by the two of you together', () => {
    for (let level = 1; level <= 150; level++) {
      const maze = lampOf(level);
      const shape = lampShape(level);
      expect(maze.gates.length).toBe(shape.gates);
      expect(maze.steps).toBe(solveLamp(maze));
      expect(maze.steps).toBeGreaterThanOrEqual(maze.w + maze.h);
      expect(maze.exit).not.toBe(maze.start);
      // No key lies where the lamp could walk to with that gate still locked.
      maze.gates.forEach((gate, g) => {
        const seen = new Set([maze.start]);
        const queue = [maze.start];
        for (let i = 0; i < queue.length; i++) {
          for (let d = 0; d < 4; d++) {
            const next = maze.links[queue[i]][d];
            if (next < 0 || seen.has(next) || maze.gateAt[queue[i]][d] >= g) continue;
            seen.add(next);
            queue.push(next);
          }
        }
        expect(seen.has(gate.key), `level ${level} gate ${g}`).toBe(false);
        expect(keyOn(maze, gate.key)).toBe(g);
        // But its light, from somewhere it can, reaches the key.
        expect([...seen].some(cell => lit(maze, gate.key, cell))).toBe(true);
      });
      // The lamp by itself gets nowhere: the first gate is on its only way.
      expect(solveLamp({ ...maze, gates: maze.gates.map(g => ({ ...g, key: -1 })) })).toBe(-1);
    }
  });

  it('you carry the lamp in turns', () => {
    expect(lampCarrier(1)).toBe('user');
    expect(lampCarrier(2)).toBe('partner');
  });

  it('walls and locked gates stop the lamp, and it never leaves the shadow in the dark', () => {
    const maze = lampOf(5);
    const gate = maze.gates[0];
    const d = maze.links[gate.a].indexOf(gate.b);
    expect(lampStep(maze, gate.a, d, 0, gate.a)).toEqual({ stop: 'gate', gate: 0 });
    expect(lampStep(maze, gate.a, d, 1, gate.a)).toEqual({ to: gate.b });
    const wall = maze.links[maze.start].indexOf(-1);
    expect(lampStep(maze, maze.start, wall, 0, maze.start)).toEqual({ stop: 'wall' });
    // A shadow far off: any step that leaves it unlit is refused.
    const open = maze.links[maze.start].findIndex(next => next >= 0);
    const farAway = Array.from({ length: maze.w * maze.h }, (_, cell) => cell).find(cell => !lit(maze, cell, maze.links[maze.start][open]))!;
    expect(lampStep(maze, maze.start, open, 0, farAway)).toEqual({ stop: 'dark' });
  });

  it('the shadow goes through walls, but only where the light falls', () => {
    const maze = lampOf(5);
    const wall = maze.links[maze.start].findIndex((next, d) => next < 0 && beside(maze, maze.start, d) >= 0);
    if (wall >= 0) expect(shadowStep(maze, maze.start, wall, maze.start)).toEqual({ to: beside(maze, maze.start, wall) });
    // Off the edge of the board there is nowhere to go.
    expect(shadowStep(maze, 0, 0, 0)).toEqual({ stop: 'edge' });
    // Away from a lamp that is already out of reach: too dark. Toward it: allowed.
    const lamp = 0;
    const far = maze.w * maze.h - 1;
    expect(lit(maze, far, lamp)).toBe(false);
    expect(shadowStep(maze, far - maze.w, 1, lamp)).toEqual({ stop: 'dark' });
    expect(shadowStep(maze, far, 0, lamp)).toEqual({ to: far - maze.w });
    expect(lampDone(maze, maze.exit, maze.exit)).toBe(true);
    expect(lampDone(maze, maze.exit, maze.start)).toBe(false);
  });

  it('takes from the other phone only what a maze could have said', () => {
    expect(cleanLampSaid(lampToWire({ level: 3, e: 2, pos: 17, keys: 5 }))).toEqual({ level: 3, e: 2, pos: 17, keys: 5 });
    expect(cleanLampSaid({ l: 0, e: 0, p: 0, k: 0 })).toBeNull();
    expect(cleanLampSaid({ l: 1, e: 0, p: -1, k: 0 })).toBeNull();
    expect(cleanLampSaid({ l: 1, e: 0, p: 1.5, k: 0 })).toBeNull();
    expect(cleanLampSaid('lamp')).toBeNull();
  });
});
