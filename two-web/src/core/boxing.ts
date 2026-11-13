// Boxing on Canvas of Us (components/BoxingBoard).
//
// You both choose a move at once, neither seeing the other's until both have
// (as in Rock Paper Scissors: each of you has a list of your own picks), and the
// round is fought out from the two of them. Everything that follows - who
// was hit, how hard, who is left standing - comes from the picks alone, so
// both phones fight the same fight.

import type { Seat } from './usTwo';

export const BX_MOVES = ['jab', 'hook', 'upper', 'block', 'dodge'] as const;
export type BxMove = (typeof BX_MOVES)[number];
export const BX_JAB = 0;
export const BX_HOOK = 1;
export const BX_UPPER = 2;
export const BX_BLOCK = 3;
export const BX_DODGE = 4;

export const BX_HP = 100;
export const BX_ENERGY_MAX = 4;
export const BX_ENERGY_START = 2;
/** What each move costs in energy. One comes back every round; a block earns one more. */
export const BX_COST = [0, 1, 2, 0, 1] as const;
/** What each punch does when it lands clean. */
export const BX_DAMAGE = [8, 16, 26] as const;
/** A fight that long is decided on who has more left. */
export const BX_MAX_ROUNDS = 40;

/**
 * What became of a move:
 * landed - a punch that hit; blocked - a jab on the gloves; chipped - a hook
 * that got a little through a guard; broke - an uppercut through a guard;
 * missed - a punch at someone who was not there (and they answered it);
 * beaten - an uppercut stopped by a jab before it got going;
 * held - a guard or a slip with nothing to meet; guarded - a guard that took
 * a punch; slipped - a dodge that made them miss; caught - a dodge the jab
 * found anyway.
 */
export type BxWhat = 'landed' | 'blocked' | 'chipped' | 'broke' | 'missed' | 'beaten' | 'held' | 'guarded' | 'slipped' | 'caught';

export interface BxRound {
  move: Record<Seat, number>;
  what: Record<Seat, BxWhat>;
  /** What each of you took this round. */
  took: Record<Seat, number>;
  /** After it. */
  hp: Record<Seat, number>;
  energy: Record<Seat, number>;
}

export interface BoxingState {
  rounds: BxRound[];
  hp: Record<Seat, number>;
  energy: Record<Seat, number>;
  toMove: Seat[];
  over: boolean;
  winner: Seat | null;
  /** Both down at once, or level when the last bell goes. */
  draw: boolean;
  played: Record<Seat, number>;
}

const isPunch = (m: number) => m <= BX_UPPER;

/** One side of a round: what `mine` does to them, having met `theirs`. */
function throwAt(mine: number, theirs: number): { hurts: number; costsMe: number; what: BxWhat } {
  if (!isPunch(mine)) {
    if (mine === BX_BLOCK) return { hurts: 0, costsMe: 0, what: isPunch(theirs) ? 'guarded' : 'held' };
    return { hurts: 0, costsMe: 0, what: theirs === BX_JAB ? 'caught' : isPunch(theirs) ? 'slipped' : 'held' };
  }
  if (theirs === BX_BLOCK) {
    if (mine === BX_JAB) return { hurts: 0, costsMe: 0, what: 'blocked' };
    if (mine === BX_HOOK) return { hurts: 5, costsMe: 0, what: 'chipped' };
    return { hurts: 20, costsMe: 0, what: 'broke' };
  }
  if (theirs === BX_DODGE) {
    // A jab is too quick to slip; the big ones sail past, and are answered.
    if (mine === BX_JAB) return { hurts: 12, costsMe: 0, what: 'landed' };
    return { hurts: 0, costsMe: mine === BX_HOOK ? 12 : 16, what: 'missed' };
  }
  // Punch against punch: both land, but a jab gets there before an uppercut does.
  if (mine === BX_UPPER && theirs === BX_JAB) return { hurts: 0, costsMe: 0, what: 'beaten' };
  return { hurts: BX_DAMAGE[mine], costsMe: 0, what: 'landed' };
}

/** Whether this move can be made with this much energy. */
export const boxingAllowed = (move: number, energy: number) =>
  Number.isInteger(move) && move >= 0 && move < BX_MOVES.length && BX_COST[move] <= energy;

const after = (energy: number, move: number) => Math.min(BX_ENERGY_MAX, energy - BX_COST[move] + 1 + (move === BX_BLOCK ? 1 : 0));

export function playBoxing(game: { picks?: Record<Seat, number[]> }): BoxingState {
  const u = game.picks?.user || [];
  const p = game.picks?.partner || [];
  const hp: Record<Seat, number> = { user: BX_HP, partner: BX_HP };
  const energy: Record<Seat, number> = { user: BX_ENERGY_START, partner: BX_ENERGY_START };
  const rounds: BxRound[] = [];
  let over = false;
  let winner: Seat | null = null;
  let draw = false;
  // A pick that cannot be made where it stands ends what counts of that list.
  let bad: Record<Seat, boolean> = { user: false, partner: false };

  for (let r = 0; r < Math.min(u.length, p.length) && !over; r++) {
    if (!boxingAllowed(u[r], energy.user)) bad = { ...bad, user: true };
    if (!boxingAllowed(p[r], energy.partner)) bad = { ...bad, partner: true };
    if (bad.user || bad.partner) break;
    const a = throwAt(u[r], p[r]);
    const b = throwAt(p[r], u[r]);
    const took = { user: b.hurts + a.costsMe, partner: a.hurts + b.costsMe };
    hp.user = Math.max(0, hp.user - took.user);
    hp.partner = Math.max(0, hp.partner - took.partner);
    energy.user = after(energy.user, u[r]);
    energy.partner = after(energy.partner, p[r]);
    rounds.push({ move: { user: u[r], partner: p[r] }, what: { user: a.what, partner: b.what }, took, hp: { ...hp }, energy: { ...energy } });
    if (hp.user <= 0 || hp.partner <= 0) {
      over = true;
      if (hp.user <= 0 && hp.partner <= 0) draw = true;
      else winner = hp.user <= 0 ? 'partner' : 'user';
    } else if (rounds.length >= BX_MAX_ROUNDS) {
      over = true;
      if (hp.user === hp.partner) draw = true;
      else winner = hp.user > hp.partner ? 'user' : 'partner';
    }
  }

  const done = rounds.length;
  // One pick ahead of the rounds is the most anyone can have made, if it is one they could make.
  const ahead = (list: number[], seat: Seat) => (!over && !bad[seat] && list.length > done && boxingAllowed(list[done], energy[seat]) ? done + 1 : done);
  const played = { user: ahead(u, 'user'), partner: ahead(p, 'partner') };
  const toMove: Seat[] = over ? [] : (['user', 'partner'] as Seat[]).filter(s => played[s] === done);
  return { rounds, hp, energy, toMove, over, winner, draw, played };
}
