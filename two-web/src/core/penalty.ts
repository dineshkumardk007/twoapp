// Penalty Shootout on Canvas of Us (components/PenaltyBoard).
//
// Kick by kick you take turns to shoot and to keep goal, and for each kick
// you both choose at once: the kicker where to put it and how hard, the
// keeper which way to dive. Neither sees the other's until both have. As in
// Heart Hug Kiss each of you has a list of your own picks - here a pick is a
// shot when it is your kick and a dive when it is theirs - and both phones
// work every kick out from the two lists alone.

import type { Seat } from './usTwo';

/** Kicks each, before sudden death. */
export const PK_EACH = 5;
/** A shootout still level after this many kicks in all is a tie. */
export const PK_MAX = 30;

/** The goal, in its own units: x from -100 (left post) to 100, y from 0 (grass) to 100 (bar). */
export const PK_AIM_X = 120;
export const PK_AIM_Y = 120;

export interface PkShot {
  /** Where it is aimed: beyond 100 either way is wide of the post, above 100 over the bar. */
  x: number;
  y: number;
  /** 0 to 100. Harder is harder to save, and harder to keep on target. */
  power: number;
}

/** Shots start here, so a shot is never mistaken for a dive (0-5). */
const SHOT_BASE = 1000;
export const PK_DIVES = 6;

export function encodeShot(s: PkShot): number {
  return SHOT_BASE + ((s.x + PK_AIM_X) * 128 + s.y) * 128 + s.power;
}
export function decodeShot(pick: number): PkShot {
  const v = pick - SHOT_BASE;
  const power = v % 128;
  const rest = (v - power) / 128;
  const y = rest % 128;
  return { x: (rest - y) / 128 - PK_AIM_X, y, power };
}
export function shotAllowed(pick: number): boolean {
  if (!Number.isInteger(pick) || pick < SHOT_BASE) return false;
  const s = decodeShot(pick);
  return Number.isInteger(s.x) && s.x >= -PK_AIM_X && s.x <= PK_AIM_X && s.y >= 0 && s.y <= PK_AIM_Y && s.power >= 0 && s.power <= 100;
}
export const diveAllowed = (pick: number) => Number.isInteger(pick) && pick >= 0 && pick < PK_DIVES;

/** Where the keeper ends up for each dive: left, middle, right - low and high. */
export const diveSpot = (dive: number): { x: number; y: number } => ({ x: [-66, 0, 66][Math.floor(dive / 2)], y: dive % 2 ? 74 : 28 });

/** Who takes kick `k` (0 is the first): you take turns, the one who started first. */
export const kickerOf = (first: Seat, k: number): Seat => (k % 2 === 0 ? first : first === 'user' ? 'partner' : 'user');

/** A number from -1 to 1 that is the same on both phones for the same words. */
function sway(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

export type PkResult = 'goal' | 'save' | 'post' | 'over' | 'wide';

export interface PkKick {
  kicker: Seat;
  shot: PkShot;
  dive: number;
  /** Where the ball actually went: a hard shot strays from where it was aimed. */
  ball: { x: number; y: number };
  result: PkResult;
}

/** One kick, worked out: the same on both phones. */
export function resolveKick(gameId: string, k: number, kicker: Seat, shot: PkShot, dive: number): PkKick {
  const p = shot.power / 100;
  // The harder it is hit, the further it can stray from where it was aimed.
  const x = shot.x + sway(`${gameId}:${k}:x`) * p * p * 16;
  const y = Math.max(4, shot.y + sway(`${gameId}:${k}:y`) * p * p * 12);
  let result: PkResult;
  if (Math.abs(x) > 104) result = 'wide';
  else if (y > 104) result = 'over';
  else if (Math.abs(x) > 96 || y > 96) result = 'post';
  else {
    const spot = diveSpot(dive);
    // A keeper reaches further for a soft one than for a hard one.
    const reachX = 56 - p * 28;
    const reachY = 36 - p * 10;
    result = Math.abs(x - spot.x) <= reachX && Math.abs(y - spot.y) <= reachY ? 'save' : 'goal';
  }
  return { kicker, shot, dive, ball: { x, y }, result };
}

export interface PenaltyState {
  kicks: PkKick[];
  goals: Record<Seat, number>;
  /** Each of you's kicks so far, in order: scored or not. */
  taken: Record<Seat, boolean[]>;
  /** Who shoots the kick coming up. */
  kicker: Seat;
  suddenDeath: boolean;
  toMove: Seat[];
  over: boolean;
  winner: Seat | null;
  draw: boolean;
  played: Record<Seat, number>;
}

export function playPenalty(game: { id: string; first: Seat; picks?: Record<Seat, number[]> }): PenaltyState {
  const lists: Record<Seat, number[]> = { user: game.picks?.user || [], partner: game.picks?.partner || [] };
  const kicks: PkKick[] = [];
  const goals: Record<Seat, number> = { user: 0, partner: 0 };
  const taken: Record<Seat, boolean[]> = { user: [], partner: [] };
  let over = false;
  let winner: Seat | null = null;
  let draw = false;
  const fits = (seat: Seat, k: number) => {
    const pick = lists[seat][k];
    return kickerOf(game.first, k) === seat ? shotAllowed(pick) : diveAllowed(pick);
  };

  for (let k = 0; k < Math.min(lists.user.length, lists.partner.length) && !over; k++) {
    if (!fits('user', k) || !fits('partner', k)) break;
    const kicker = kickerOf(game.first, k);
    const keeper: Seat = kicker === 'user' ? 'partner' : 'user';
    const kick = resolveKick(game.id, k, kicker, decodeShot(lists[kicker][k]), lists[keeper][k]);
    kicks.push(kick);
    const scored = kick.result === 'goal';
    taken[kicker].push(scored);
    if (scored) goals[kicker]++;

    const n = kicks.length;
    if (n <= PK_EACH * 2) {
      // Decided early once one cannot be caught with the kicks the other has left.
      for (const s of ['user', 'partner'] as Seat[]) {
        const o: Seat = s === 'user' ? 'partner' : 'user';
        if (goals[s] > goals[o] + (PK_EACH - taken[o].length)) {
          over = true;
          winner = s;
        }
      }
    } else if (n % 2 === 0 && goals.user !== goals.partner) {
      // Sudden death: a pair of kicks that leaves one ahead ends it.
      over = true;
      winner = goals.user > goals.partner ? 'user' : 'partner';
    }
    if (!over && n >= PK_MAX) {
      over = true;
      draw = true;
    }
  }

  const done = kicks.length;
  const ahead = (seat: Seat) => (!over && lists[seat].length > done && fits(seat, done) ? done + 1 : done);
  const played = { user: ahead('user'), partner: ahead('partner') };
  const toMove: Seat[] = over ? [] : (['user', 'partner'] as Seat[]).filter(s => played[s] === done);
  return { kicks, goals, taken, kicker: kickerOf(game.first, done), suddenDeath: done >= PK_EACH * 2, toMove, over, winner, draw, played };
}

/** Whether `seat` may make this pick now: a shot if it is their kick, a dive if not. */
export function penaltyAllowed(game: { id: string; first: Seat; picks?: Record<Seat, number[]> }, seat: Seat, pick: number): boolean {
  const s = playPenalty(game);
  if (s.over) return false;
  return s.kicker === seat ? shotAllowed(pick) : diveAllowed(pick);
}
