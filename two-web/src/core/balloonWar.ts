// Water Balloon War on Canvas of Us (components/BalloonBoard).
//
// Two of you, a hedge between you, and the wind. A throw travels as its
// velocity; the wind for each throw comes from the game's id and the throw's
// number, so both phones work out the same flight, step by step, and agree on
// exactly where it came down. First to soak the other through wins.

import type { Seat } from './usTwo';

/** The garden, in its own units, seen with the thrower on the left. */
export const WB_W = 1000;
export const WB_H = 760;
export const WB_GROUND = 650;
/** Where the two of you stand. */
export const WB_NEAR = 130;
export const WB_FAR = 870;
/** Where a balloon leaves your hand. */
export const WB_HAND_X = WB_NEAR + 30;
export const WB_HAND_Y = WB_GROUND - 228;
/** Middles and sizes of a target's head and body. */
export const WB_HEAD_Y = WB_GROUND - 124;
export const WB_HEAD_R = 56;
export const WB_BODY_Y = WB_GROUND - 46;
export const WB_BODY_R = 50;
export const WB_BALLOON_R = 15;
export const WB_GIANT_R = 26;
/** The hedge in the middle, half as wide as this. */
export const WB_HEDGE_X = WB_W / 2;
export const WB_HEDGE_HALF = 34;
/** A balloon that lands this near your feet still splashes you. */
export const WB_NEAR_SPLASH = 112;
export const WB_NEAR_SPLASH_GIANT = 176;

export const WB_GRAVITY = 1100;
export const WB_MAX_V = 1200;
export const WB_MIN_VX = 60;
/** A bar of wind pushes the balloon along by this much, every second. */
export const WB_WIND_UNIT = 64;
export const WB_WIND_MAX = 5;
/** How wet you can get before you have lost. */
export const SOAK_FULL = 10;
export const WB_POINTS = { head: 4, body: 3, near: 1 } as const;
export const WB_GIANT_POINTS = { head: 6, body: 5, near: 2 } as const;

const STEP_RATE = 120;
const DT = 1 / STEP_RATE;
export const WB_STEP_MS = 1000 * DT;
const MAX_STEPS = STEP_RATE * 6;

const GIANT_FLAG = 4194304; // 2^22
const V_SCALE = 2048;

export interface BalloonThrowInput {
  vx: number;
  vy: number;
  giant: boolean;
}

export function encodeThrow(t: BalloonThrowInput): number {
  return (t.giant ? GIANT_FLAG : 0) + t.vx * V_SCALE + t.vy;
}
export function decodeThrow(move: number): BalloonThrowInput {
  const giant = move >= GIANT_FLAG;
  const rest = giant ? move - GIANT_FLAG : move;
  const vx = Math.floor(rest / V_SCALE);
  return { vx, vy: rest - vx * V_SCALE, giant };
}

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Stirred once more: ids that differ only at the end should not give similar winds.
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return h >>> 0;
}

/**
 * The wind for throw number `k`, in bars from -5 to 5: plus blows from the
 * user's side toward the partner's. Always some, so no throw is the same as
 * the one before.
 */
export function windOf(id: string, k: number): number {
  const bars = hashOf(`${id}:${k}`) % (WB_WIND_MAX * 2);
  // 0-9 becomes -5..-1 and 1..5.
  return bars < WB_WIND_MAX ? bars - WB_WIND_MAX : bars - WB_WIND_MAX + 1;
}

/** How tall the hedge is in this game. */
export function hedgeOf(id: string): number {
  return 70 + (hashOf(`${id}:hedge`) % 90);
}

export type BalloonHit = 'head' | 'body' | 'near' | 'hedge' | 'miss';

export interface BalloonFlight {
  /** Where it was at every step, seen with the thrower on the left: x, y, x, y... */
  path: Float32Array;
  hit: BalloonHit;
  x: number;
  y: number;
  points: number;
  ms: number;
}

/** A balloon's flight, seen with the thrower on the left. `wind` in bars, plus blowing toward the target. */
export function flyBalloon(t: BalloonThrowInput, wind: number, hedge: number, record = false): BalloonFlight {
  const r = t.giant ? WB_GIANT_R : WB_BALLOON_R;
  const head = WB_HEAD_R + r;
  const body = WB_BODY_R + r;
  const ax = wind * WB_WIND_UNIT;
  const points = t.giant ? WB_GIANT_POINTS : WB_POINTS;
  const hedgeTop = WB_GROUND - hedge;
  let x = WB_HAND_X;
  let y = WB_HAND_Y;
  let vx = t.vx;
  let vy = -t.vy;
  const trail: number[] = record ? [x, y] : [];
  let hit: BalloonHit = 'miss';
  let got = 0;
  let step = 0;
  for (; step < MAX_STEPS; step++) {
    vx += ax * DT;
    vy += WB_GRAVITY * DT;
    x += vx * DT;
    y += vy * DT;
    if (record) trail.push(x, y);
    const hx = x - WB_FAR;
    const hy = y - WB_HEAD_Y;
    if (hx * hx + hy * hy < head * head) {
      hit = 'head';
      got = points.head;
      break;
    }
    const by = y - WB_BODY_Y;
    if (hx * hx + by * by < body * body) {
      hit = 'body';
      got = points.body;
      break;
    }
    if (x > WB_HEDGE_X - WB_HEDGE_HALF - r && x < WB_HEDGE_X + WB_HEDGE_HALF + r && y > hedgeTop - r) {
      hit = 'hedge';
      break;
    }
    if (y >= WB_GROUND - r * 0.4) {
      y = WB_GROUND;
      const off = Math.abs(x - WB_FAR);
      if (off <= (t.giant ? WB_NEAR_SPLASH_GIANT : WB_NEAR_SPLASH)) {
        hit = 'near';
        got = points.near;
      }
      break;
    }
  }
  return { path: new Float32Array(trail), hit, x, y, points: got, ms: step * DT * 1000 };
}

export interface BalloonStep {
  seat: Seat;
  throw: BalloonThrowInput;
  /** The wind it flew in, in bars: plus blowing from the user's side toward the partner's. */
  wind: number;
  flight: BalloonFlight;
  /** How wet the target is now. */
  soak: number;
}

export interface BalloonState {
  soak: Record<Seat, number>;
  /** Each of you has one giant balloon a game. */
  giantLeft: Record<Seat, boolean>;
  turn: Seat;
  /** The wind on the next throw, in the same bars. */
  wind: number;
  hedge: number;
  over: boolean;
  winner: Seat | null;
  played: number;
  last: BalloonStep | null;
  /** Everywhere a balloon has come down, as the user's-side-on-the-left garden sees it. */
  marks: { x: number; hit: BalloonHit; giant: boolean }[];
}

const otherSeat = (seat: Seat): Seat => (seat === 'user' ? 'partner' : 'user');

/** The wind as the thrower feels it: plus blowing toward the other one. */
export const windForThrower = (wind: number, seat: Seat) => (seat === 'user' ? wind : -wind);

export function throwAllowed(t: BalloonThrowInput, giantLeft: boolean): boolean {
  if (!Number.isInteger(t.vx) || !Number.isInteger(t.vy)) return false;
  if (t.vx < WB_MIN_VX || t.vx > WB_MAX_V || t.vy < 0 || t.vy > WB_MAX_V) return false;
  return !t.giant || giantLeft;
}

export function playBalloon(game: { id: string; first: Seat; moves: number[] }): BalloonState {
  const soak: Record<Seat, number> = { user: 0, partner: 0 };
  const giantLeft: Record<Seat, boolean> = { user: true, partner: true };
  const hedge = hedgeOf(game.id);
  const marks: BalloonState['marks'] = [];
  let turn = game.first;
  let winner: Seat | null = null;
  let last: BalloonStep | null = null;
  let played = 0;
  for (const move of game.moves) {
    if (winner || !Number.isSafeInteger(move) || move < 0) break;
    const t = decodeThrow(move);
    if (!throwAllowed(t, giantLeft[turn])) break;
    const wind = windOf(game.id, played);
    const flight = flyBalloon(t, windForThrower(wind, turn), hedge);
    const target = otherSeat(turn);
    soak[target] = Math.min(SOAK_FULL, soak[target] + flight.points);
    if (t.giant) giantLeft[turn] = false;
    marks.push({ x: turn === 'user' ? flight.x : WB_W - flight.x, hit: flight.hit, giant: t.giant });
    last = { seat: turn, throw: t, wind, flight, soak: soak[target] };
    played++;
    if (soak[target] >= SOAK_FULL) winner = turn;
    else turn = target;
  }
  return { soak, giantLeft, turn, wind: windOf(game.id, played), hedge, over: !!winner, winner, played, last, marks };
}

/** A flight with its path, for showing. */
export function recordFlight(game: { id: string }, k: number, seat: Seat, move: number): BalloonFlight {
  return flyBalloon(decodeThrow(move), windForThrower(windOf(game.id, k), seat), hedgeOf(game.id), true);
}
