import { describe, expect, it } from 'vitest';
import { BX_BLOCK, BX_DODGE, BX_ENERGY_MAX, BX_HOOK, BX_HP, BX_JAB, BX_UPPER, boxingAllowed, playBoxing } from './boxing';
import { PK_EACH, decodeShot, diveAllowed, diveSpot, encodeShot, kickerOf, playPenalty, resolveKick, shotAllowed } from './penalty';
import { PZ_FAIL, PZ_KINDS, PZ_LIMIT_MS, PZ_MAX_ROUNDS, PZ_TO_WIN, asPick, kindOfRound, playPuzzle, puzzleAllowed, puzzleOf } from './puzzleDuel';
import { PAPER_KINDS, atRound, canMove, cleanGame, isPickKind, kindOfRecord, mergeGame, newGame, recordTypeOf, roundsOf, standing, withMove, type PaperGame } from './paperGames';
import type { Seat } from './usTwo';

const picks = (user: number[], partner: number[]) => ({ picks: { user, partner } });

describe('Boxing', () => {
  it('starts with both fresh, and both to choose', () => {
    const s = playBoxing(picks([], []));
    expect(s.hp).toEqual({ user: BX_HP, partner: BX_HP });
    expect(s.energy).toEqual({ user: 2, partner: 2 });
    expect(s.toMove).toEqual(['user', 'partner']);
    expect(s.over).toBe(false);
  });

  it('punch against punch: both land', () => {
    const s = playBoxing(picks([BX_JAB], [BX_HOOK]));
    expect(s.rounds[0].took).toEqual({ user: 16, partner: 8 });
    expect(s.rounds[0].what).toEqual({ user: 'landed', partner: 'landed' });
  });

  it('a jab gets there before an uppercut does', () => {
    const s = playBoxing(picks([BX_UPPER], [BX_JAB]));
    expect(s.rounds[0].what).toEqual({ user: 'beaten', partner: 'landed' });
    expect(s.rounds[0].took).toEqual({ user: 8, partner: 0 });
  });

  it('a block stops a jab, takes a little of a hook, and is broken by an uppercut', () => {
    expect(playBoxing(picks([BX_JAB], [BX_BLOCK])).rounds[0].took.partner).toBe(0);
    expect(playBoxing(picks([BX_HOOK], [BX_BLOCK])).rounds[0].took.partner).toBe(5);
    const broke = playBoxing(picks([BX_UPPER], [BX_BLOCK])).rounds[0];
    expect(broke.took.partner).toBe(20);
    expect(broke.what).toEqual({ user: 'broke', partner: 'guarded' });
  });

  it('a dodge makes the big punches miss and answers them, but a jab finds it', () => {
    const hook = playBoxing(picks([BX_HOOK], [BX_DODGE])).rounds[0];
    expect(hook.what).toEqual({ user: 'missed', partner: 'slipped' });
    expect(hook.took).toEqual({ user: 12, partner: 0 });
    expect(playBoxing(picks([BX_UPPER], [BX_DODGE])).rounds[0].took).toEqual({ user: 16, partner: 0 });
    const jab = playBoxing(picks([BX_JAB], [BX_DODGE])).rounds[0];
    expect(jab.what).toEqual({ user: 'landed', partner: 'caught' });
    expect(jab.took.partner).toBe(12);
  });

  it('nothing happens when neither throws', () => {
    const r = playBoxing(picks([BX_BLOCK], [BX_DODGE])).rounds[0];
    expect(r.took).toEqual({ user: 0, partner: 0 });
    expect(r.what).toEqual({ user: 'held', partner: 'held' });
  });

  it('big punches cost energy; one comes back each round, and a block earns one more', () => {
    const s = playBoxing(picks([BX_UPPER, BX_BLOCK, BX_JAB], [BX_BLOCK, BX_BLOCK, BX_BLOCK]));
    // 2 - 2 + 1 = 1; then a block: 1 + 1 + 1 = 3; then a jab: 3 + 1 = 4.
    expect(s.rounds.map(r => r.energy.user)).toEqual([1, 3, 4]);
    // And never more than it holds.
    expect(s.rounds.map(r => r.energy.partner)).toEqual([4, BX_ENERGY_MAX, BX_ENERGY_MAX]);
    expect(boxingAllowed(BX_UPPER, 1)).toBe(false);
    expect(boxingAllowed(BX_HOOK, 1)).toBe(true);
    expect(boxingAllowed(BX_JAB, 0)).toBe(true);
    expect(boxingAllowed(5, 4)).toBe(false);
    expect(boxingAllowed(1.5, 4)).toBe(false);
  });

  it('a move there is no energy for does not count, nor anything after it', () => {
    // An uppercut (2) leaves 1: a second uppercut cannot be thrown.
    const s = playBoxing(picks([BX_UPPER, BX_UPPER, BX_JAB], [BX_JAB, BX_JAB, BX_JAB]));
    expect(s.rounds.length).toBe(1);
    expect(s.played).toEqual({ user: 1, partner: 2 });
    expect(s.toMove).toEqual(['user']);
  });

  it('is fought to a knockout', () => {
    // Jab against a guard that never moves: nothing. Hooks through it: five a time.
    const hooks = Array.from({ length: 20 }, (_, i) => (i % 2 ? BX_BLOCK : BX_HOOK));
    const s = playBoxing(picks(hooks, Array(20).fill(BX_BLOCK)));
    expect(s.over).toBe(false);
    expect(s.hp.partner).toBe(BX_HP - 50);
    // Trading hook for jab, the one throwing hooks wins.
    const a: number[] = [];
    const b: number[] = [];
    let e = 2;
    while (playBoxing(picks(a, b)).over === false && a.length < 60) {
      const move = e >= 1 ? BX_HOOK : BX_JAB;
      a.push(move);
      b.push(BX_JAB);
      e = Math.min(BX_ENERGY_MAX, e - (move === BX_HOOK ? 1 : 0) + 1);
    }
    const end = playBoxing(picks(a, b));
    expect(end.over).toBe(true);
    expect(end.winner).toBe('user');
    expect(end.hp.partner).toBe(0);
    expect(end.toMove).toEqual([]);
    // Picks made after the bell count for nothing.
    expect(playBoxing(picks([...a, BX_JAB], [...b, BX_JAB])).rounds.length).toBe(end.rounds.length);
  });

  it('both down at once is a tie', () => {
    const jabs = Array(13).fill(BX_JAB);
    const s = playBoxing(picks(jabs, jabs));
    expect(s.hp).toEqual({ user: 0, partner: 0 });
    expect(s.over && s.draw && s.winner === null).toBe(true);
  });

  it('one pick ahead of the other is the most either can be', () => {
    const s = playBoxing(picks([BX_JAB, BX_JAB], []));
    expect(s.rounds.length).toBe(0);
    expect(s.played).toEqual({ user: 1, partner: 0 });
    expect(s.toMove).toEqual(['partner']);
  });
});

describe('Penalty Shootout', () => {
  const shot = (x: number, y: number, power = 0) => encodeShot({ x, y, power });
  const game = (user: number[], partner: number[], first: Seat = 'user') => ({ id: 'g', first, ...picks(user, partner) });

  it('a shot travels as one number and comes back the same', () => {
    for (const s of [
      { x: 0, y: 0, power: 0 },
      { x: -120, y: 120, power: 100 },
      { x: 120, y: 3, power: 57 },
      { x: -37, y: 88, power: 1 }
    ]) {
      expect(decodeShot(encodeShot(s))).toEqual(s);
      expect(shotAllowed(encodeShot(s))).toBe(true);
    }
    expect(shotAllowed(3)).toBe(false);
    expect(shotAllowed(encodeShot({ x: 0, y: 0, power: 101 }))).toBe(false);
    expect(shotAllowed(encodeShot({ x: 0, y: 121, power: 10 }))).toBe(false);
    expect(shotAllowed(1.5)).toBe(false);
    expect(diveAllowed(0) && diveAllowed(5)).toBe(true);
    expect(diveAllowed(6) || diveAllowed(-1) || diveAllowed(encodeShot({ x: 0, y: 0, power: 0 }))).toBe(false);
  });

  it('you take turns to shoot, the one who started first', () => {
    expect([0, 1, 2, 3].map(k => kickerOf('user', k))).toEqual(['user', 'partner', 'user', 'partner']);
    expect(kickerOf('partner', 0)).toBe('partner');
  });

  it('where the keeper goes for each dive', () => {
    expect(diveSpot(0)).toEqual({ x: -66, y: 28 });
    expect(diveSpot(1)).toEqual({ x: -66, y: 74 });
    expect(diveSpot(3)).toEqual({ x: 0, y: 74 });
    expect(diveSpot(4)).toEqual({ x: 66, y: 28 });
  });

  it('a soft shot goes where it was aimed: saved if the keeper is there, a goal if not', () => {
    expect(resolveKick('g', 0, 'user', { x: -60, y: 30, power: 0 }, 0).result).toBe('save');
    expect(resolveKick('g', 0, 'user', { x: -60, y: 30, power: 0 }, 4).result).toBe('goal');
    expect(resolveKick('g', 0, 'user', { x: 0, y: 30, power: 0 }, 5).result).toBe('goal');
    expect(resolveKick('g', 0, 'user', { x: 0, y: 30, power: 0 }, 0).ball).toEqual({ x: 0, y: 30 });
  });

  it('off the frame: wide, over, or off the post', () => {
    expect(resolveKick('g', 0, 'user', { x: 115, y: 40, power: 0 }, 0).result).toBe('wide');
    expect(resolveKick('g', 0, 'user', { x: 0, y: 115, power: 0 }, 0).result).toBe('over');
    expect(resolveKick('g', 0, 'user', { x: -99, y: 40, power: 0 }, 0).result).toBe('post');
    expect(resolveKick('g', 0, 'user', { x: 10, y: 99, power: 0 }, 2).result).toBe('post');
  });

  it('a hard shot is harder to save, and can stray - the same way on both phones', () => {
    // Aimed just inside the keeper's reach for a soft shot, outside it for a hard one.
    const soft = resolveKick('g', 0, 'user', { x: -20, y: 30, power: 0 }, 0);
    expect(soft.result).toBe('save');
    const hard = resolveKick('steady', 0, 'user', { x: -20, y: 30, power: 100 }, 0);
    expect(Math.abs(hard.ball.x - -20)).toBeLessThanOrEqual(16);
    expect(Math.abs(hard.ball.y - 30)).toBeLessThanOrEqual(12);
    expect(resolveKick('steady', 0, 'user', { x: -20, y: 30, power: 100 }, 0)).toEqual(hard);
    // Somewhere among a few kicks, full power strays from where it was aimed.
    const strays = [0, 1, 2, 3, 4, 5].some(k => {
      const b = resolveKick('stray', k, 'user', { x: 0, y: 50, power: 100 }, 0).ball;
      return Math.abs(b.x) > 2 || Math.abs(b.y - 50) > 2;
    });
    expect(strays).toBe(true);
  });

  it('is over as soon as one cannot be caught', () => {
    const goal = shot(60, 30); // The keeper always dives the other way (0: low left).
    const miss = shot(115, 30);
    // User scores three; partner misses three: 3-0 with two kicks left each.
    const s = playPenalty(game([goal, 0, goal, 0, goal, 0], [0, miss, 0, miss, 0, miss]));
    expect(s.kicks.length).toBe(6);
    expect(s.goals).toEqual({ user: 3, partner: 0 });
    expect(s.over).toBe(true);
    expect(s.winner).toBe('user');
    expect(s.taken).toEqual({ user: [true, true, true], partner: [false, false, false] });
  });

  it('level after five each goes to sudden death', () => {
    const goal = shot(60, 30);
    const miss = shot(115, 30);
    const u: number[] = [];
    const p: number[] = [];
    for (let i = 0; i < PK_EACH; i++) {
      u.push(goal, 0);
      p.push(0, goal);
    }
    const level = playPenalty(game(u, p));
    expect(level.goals).toEqual({ user: 5, partner: 5 });
    expect(level.over).toBe(false);
    expect(level.suddenDeath).toBe(true);
    // One more each: user scores, partner misses.
    const end = playPenalty(game([...u, goal, 0], [...p, 0, miss]));
    expect(end.over).toBe(true);
    expect(end.winner).toBe('user');
    // But not decided half way through the pair.
    expect(playPenalty(game([...u, goal], [...p, 0])).over).toBe(false);
  });

  it('a dive is no use when it is your kick, nor a shot when it is theirs', () => {
    const s = playPenalty(game([3], [shot(0, 30)]));
    expect(s.kicks.length).toBe(0);
    expect(s.played).toEqual({ user: 0, partner: 0 });
    expect(s.toMove).toEqual(['user', 'partner']);
  });
});

describe('Puzzle Duel', () => {
  it('makes the same puzzle from the same game and round, every time', () => {
    for (let r = 0; r < 9; r++) expect(puzzleOf('game-abc', r)).toEqual(puzzleOf('game-abc', r));
    expect(JSON.stringify([0, 1, 2, 3, 4].map(r => puzzleOf('game-abc', r)))).not.toBe(JSON.stringify([0, 1, 2, 3, 4].map(r => puzzleOf('game-xyz', r))));
  });

  it('the first five rounds are the five kinds, once each; then all five again', () => {
    for (const id of ['a', 'game-1', 'zz9']) {
      expect([0, 1, 2, 3, 4].map(r => kindOfRound(id, r)).sort()).toEqual([...PZ_KINDS].sort());
      expect([5, 6, 7, 8, 9].map(r => kindOfRound(id, r)).sort()).toEqual([...PZ_KINDS].sort());
    }
  });

  it('every puzzle can be solved', () => {
    for (const id of ['a', 'b', 'c', 'game-77', 'x1', 'x2', 'x3', 'x4']) {
      for (let r = 0; r < 10; r++) {
        const p = puzzleOf(id, r);
        if (p.kind === 'order') expect([...p.cells].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
        if (p.kind === 'odd') {
          expect(p.common).not.toBe(p.odd);
          expect(p.at).toBeGreaterThanOrEqual(0);
          expect(p.at).toBeLessThan(p.count);
          expect(p.count % p.cols).toBe(0);
        }
        if (p.kind === 'pattern' || p.kind === 'sum') {
          expect(p.options.length).toBe(4);
          expect(new Set(p.options).size).toBe(4);
          expect(p.answer).toBeGreaterThanOrEqual(0);
          expect(p.answer).toBeLessThan(4);
          expect(p.options.every(v => Number.isInteger(v) && v >= 0)).toBe(true);
        }
        if (p.kind === 'sum') {
          // The words say the sum; work it out the way it is written (× before + and −).
          const [a, op1, b, op2, c] = p.text.split(' ');
          const n = (v: string) => Number(v);
          const right = op1 === '×' ? n(a) * n(b) + (op2 === '−' ? -n(c) : n(c)) : op2 === '×' ? n(a) + n(b) * n(c) : n(a) + (op1 === '−' ? -n(b) : n(b)) + (op2 === '−' ? -n(c) : n(c));
          expect(p.options[p.answer]).toBe(right);
        }
        if (p.kind === 'lights') {
          expect(p.seq.length).toBe(5);
          expect(p.seq.every(v => v >= 0 && v <= 3)).toBe(true);
          for (let i = 1; i < p.seq.length; i++) expect(p.seq[i]).not.toBe(p.seq[i - 1]);
        }
      }
    }
  });

  it('a time is sent in whole thousandths; too long, or not solved, is "given up"', () => {
    expect(asPick(8421.6, true)).toBe(8422);
    expect(asPick(0, true)).toBe(1);
    expect(asPick(PZ_LIMIT_MS + 1, true)).toBe(PZ_FAIL);
    expect(asPick(3000, false)).toBe(PZ_FAIL);
    expect(puzzleAllowed(8422) && puzzleAllowed(PZ_FAIL) && puzzleAllowed(1)).toBe(true);
    expect(puzzleAllowed(0) || puzzleAllowed(PZ_LIMIT_MS) || puzzleAllowed(PZ_FAIL + 1) || puzzleAllowed(12.5)).toBe(false);
  });

  it('the faster one takes the round; nobody does if neither solved it', () => {
    const s = playPuzzle(picks([5000, PZ_FAIL, PZ_FAIL, 7000], [9000, 4000, PZ_FAIL, 7000]));
    expect(s.rounds.map(r => r.winner)).toEqual(['user', 'partner', null, null]);
    expect(s.points).toEqual({ user: 1, partner: 1 });
    expect(s.over).toBe(false);
  });

  it('first to four wins, and nothing after it counts', () => {
    const s = playPuzzle(picks([1000, 1000, 1000, 1000, 1000], [2000, 2000, 2000, 2000, 2000]));
    expect(s.rounds.length).toBe(PZ_TO_WIN);
    expect(s.over && s.winner === 'user').toBe(true);
    expect(s.played).toEqual({ user: 4, partner: 4 });
    expect(s.toMove).toEqual([]);
  });

  it('level when the rounds run out is a tie; ahead, a win', () => {
    const fails = Array(PZ_MAX_ROUNDS).fill(PZ_FAIL);
    const tie = playPuzzle(picks(fails, fails));
    expect(tie.over && tie.draw && tie.winner === null).toBe(true);
    const ahead = playPuzzle(picks([1000, ...fails.slice(1)], fails));
    expect(ahead.over && ahead.winner === 'user' && !ahead.draw).toBe(true);
  });
});

describe('the three as games on Canvas of Us', () => {
  const NEW = ['boxing', 'penalty', 'puzzle'] as const;

  it('are on the shelf, each its own kind of record', () => {
    for (const kind of NEW) {
      expect(PAPER_KINDS).toContain(kind);
      expect(isPickKind(kind)).toBe(true);
      expect(kindOfRecord(recordTypeOf(kind))).toBe(kind);
    }
    expect(new Set(PAPER_KINDS.map(recordTypeOf)).size).toBe(PAPER_KINDS.length);
    expect(isPickKind('carrom')).toBe(false);
  });

  it('start with both to choose, and take a pick from each', () => {
    for (const kind of NEW) {
      const g = newGame(kind, undefined, 'user', `id-${kind}`, 1);
      expect(g.picks).toEqual({ user: [], partner: [] });
      expect(standing(g).toMove).toEqual(['user', 'partner']);
      expect(roundsOf(g)).toBe(0);
    }
  });

  it('take only picks that can be made', () => {
    const box = newGame('boxing', undefined, 'user', 'b', 1);
    expect(canMove(box, 'user', BX_JAB)).toBe(true);
    expect(canMove(box, 'user', BX_UPPER)).toBe(true);
    expect(canMove(box, 'user', 7)).toBe(false);
    const after = withMove(box, BX_JAB, 'user');
    // Chosen: no second pick until the round is fought.
    expect(canMove(after, 'user', BX_JAB)).toBe(false);
    expect(canMove(after, 'partner', BX_HOOK)).toBe(true);

    const pen = newGame('penalty', undefined, 'user', 'p', 1);
    expect(canMove(pen, 'user', encodeShot({ x: 0, y: 30, power: 50 }))).toBe(true);
    expect(canMove(pen, 'user', 2)).toBe(false);
    expect(canMove(pen, 'partner', 2)).toBe(true);
    expect(canMove(pen, 'partner', encodeShot({ x: 0, y: 30, power: 50 }))).toBe(false);

    const puz = newGame('puzzle', undefined, 'user', 'z', 1);
    expect(canMove(puz, 'partner', 8421)).toBe(true);
    expect(canMove(puz, 'partner', 0)).toBe(false);
    expect(canMove(puz, 'partner', PZ_FAIL)).toBe(true);
  });

  it('each of you choosing in the same moment: both picks are kept', () => {
    for (const kind of NEW) {
      const g = newGame(kind, undefined, 'user', `m-${kind}`, 1);
      const mine = kind === 'penalty' ? encodeShot({ x: 10, y: 30, power: 40 }) : kind === 'puzzle' ? 5000 : BX_JAB;
      const theirs = kind === 'penalty' ? 1 : kind === 'puzzle' ? 6000 : BX_HOOK;
      const a = withMove(g, mine, 'user');
      const b = withMove(g, theirs, 'partner');
      const onA = mergeGame(a, b);
      const onB = mergeGame(b, a);
      expect(onA.picks).toEqual({ user: [mine], partner: [theirs] });
      expect(onB.picks).toEqual(onA.picks);
      expect(roundsOf(onA)).toBe(1);
    }
  });

  it('a round is shown before the words round it say how it went', () => {
    const g: PaperGame = { ...newGame('boxing', undefined, 'user', 'r', 1), picks: { user: [BX_JAB, BX_HOOK], partner: [BX_JAB] } };
    expect(roundsOf(g)).toBe(1);
    // As it stood before that round was fought: nothing chosen, nothing decided.
    const before = atRound(g, 0);
    expect(before.picks).toEqual({ user: [], partner: [] });
    expect(roundsOf(before)).toBe(0);
    expect(atRound(g, 1).picks).toEqual({ user: [BX_JAB], partner: [BX_JAB] });
  });

  it('what arrives from the other phone is cleaned: picks that could not be made are dropped', () => {
    const raw = { ...newGame('boxing', undefined, 'user', 'c', 1), picks: { user: [BX_UPPER, BX_UPPER, BX_JAB], partner: [BX_JAB, 9] } };
    const clean = cleanGame(JSON.parse(JSON.stringify(raw)), 'boxing')!;
    // One round fought; the second uppercut cannot be thrown (no energy), and 9 is not a move.
    expect(clean.picks).toEqual({ user: [BX_UPPER], partner: [BX_JAB] });
    expect(cleanGame({ ...raw, kind: 'puzzle', picks: { user: [0], partner: ['x'] } }, 'puzzle')!.picks).toEqual({ user: [], partner: [] });
    const pen = cleanGame({ ...newGame('penalty', undefined, 'user', 'p', 1), picks: { user: [2], partner: [2] } }, 'penalty')!;
    // A dive where a shot should be is dropped; the keeper's dive, one pick ahead, stays.
    expect(pen.picks).toEqual({ user: [], partner: [2] });
  });

  it('a won game is won, and a tie is a tie', () => {
    const won: PaperGame = { ...newGame('puzzle', undefined, 'user', 'w', 1), picks: { user: [1000, 1000, 1000, 1000], partner: [2000, 2000, 2000, 2000] } };
    expect(standing(won)).toMatchObject({ over: true, winner: 'user', draw: false, toMove: [] });
    const jabs = Array(13).fill(BX_JAB);
    const tie: PaperGame = { ...newGame('boxing', undefined, 'user', 't', 1), picks: { user: jabs, partner: jabs } };
    expect(standing(tie)).toMatchObject({ over: true, winner: null, draw: true });
  });
});
