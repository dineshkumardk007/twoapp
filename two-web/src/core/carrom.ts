// Carrom on Canvas of Us (components/CarromBoard).
//
// A shot travels as three whole numbers: where the striker sat on the
// baseline and the velocity it left with. Each phone then works out the same
// shot for itself, in fixed steps of time, using only + - * / and sqrt - the
// operations every phone's processor rounds identically - so the coins end up
// in exactly the same places on both, and nothing else has to be sent.
//
// The whole shot is worked out before any of it is shown, which takes about a
// millisecond: what you then watch is a recording being played back, so the
// picture depends only on how fast the phone can draw, never on the physics.

import type { Seat } from './usTwo';

/** The playing surface, in board units: (0, 0) is the corner to the left of the partner's seat. */
export const BOARD = 1000;
export const COIN_R = 27;
export const STRIKER_R = 35;
/** A pocket's middle, this far along each side from its corner, and how near a piece's middle must come to fall in. */
export const POCKET_AT = 46;
export const POCKET_R = 46;
/** The striker's line: this far from your edge, and how far along it the striker may sit. */
export const BASE_Y = 148;
export const BASE_MIN = 190;
export const BASE_MAX = 810;
/** Fastest and slowest a shot may be, in units a second. */
export const MAX_SHOT = 3000;
export const MIN_SHOT = 120;
export const COINS_EACH = 9;

/** Steps of the shot, a second. */
const STEP_RATE = 240;
const DT = 1 / STEP_RATE;
/** How much speed the powdered board takes from a sliding piece, every step. */
const FRICTION = 1100 / STEP_RATE;
const DRAG = 0.9993;
const COIN_BOUNCE = 0.93;
const WALL_BOUNCE = 0.76;
const STRIKER_MASS = 2.6;
/** Long past any real shot: a piece still moving is simply stopped there. */
const MAX_STEPS = STEP_RATE * 9;
/** Recorded for playback at this many steps a frame: 60 frames a second. */
export const STEPS_PER_FRAME = 4;
export const FRAME_MS = (1000 * STEPS_PER_FRAME) / STEP_RATE;

export type CoinKind = 'white' | 'black' | 'queen';
export interface Coin {
  /** 0 the queen, 1-9 white, 10-18 black. */
  id: number;
  kind: CoinKind;
  x: number;
  y: number;
}

export interface Shot {
  x: number;
  dx: number;
  dy: number;
}

export const POCKETS: ReadonlyArray<readonly [number, number]> = [
  [POCKET_AT, POCKET_AT],
  [BOARD - POCKET_AT, POCKET_AT],
  [POCKET_AT, BOARD - POCKET_AT],
  [BOARD - POCKET_AT, BOARD - POCKET_AT]
];

const kindOfId = (id: number): CoinKind => (id === 0 ? 'queen' : id <= COINS_EACH ? 'white' : 'black');

// Three whole numbers in one, so a shot is one move like any other game's.
const X_SCALE = 67108864; // 2^26
const D_SCALE = 8192; // 2^13
const D_ZERO = 4096;

export function encodeShot(s: Shot): number {
  return s.x * X_SCALE + (s.dx + D_ZERO) * D_SCALE + (s.dy + D_ZERO);
}
export function decodeShot(move: number): Shot {
  const x = Math.floor(move / X_SCALE);
  const rest = move - x * X_SCALE;
  const dx = Math.floor(rest / D_SCALE);
  return { x, dx: dx - D_ZERO, dy: rest - dx * D_SCALE - D_ZERO };
}

// The break: the queen in the middle, six touching her, twelve round them,
// the colours in the classic pattern. Offsets are in coin widths on a hexagon.
const ROOT3_2 = 0.8660254037844386;
const LAYOUT: ReadonlyArray<readonly [number, number, 'w' | 'b']> = [
  // The inner ring, alternating.
  [0, -1, 'w'], [ROOT3_2, -0.5, 'b'], [ROOT3_2, 0.5, 'w'], [0, 1, 'b'], [-ROOT3_2, 0.5, 'w'], [-ROOT3_2, -0.5, 'b'],
  // The outer ring: each coin's colour runs out in a line from the inner ones.
  [0, -2, 'w'], [ROOT3_2, -1.5, 'b'], [2 * ROOT3_2, -1, 'b'], [2 * ROOT3_2, 0, 'w'], [2 * ROOT3_2, 1, 'w'], [ROOT3_2, 1.5, 'b'],
  [0, 2, 'b'], [-ROOT3_2, 1.5, 'w'], [-2 * ROOT3_2, 1, 'w'], [-2 * ROOT3_2, 0, 'b'], [-2 * ROOT3_2, -1, 'b'], [-ROOT3_2, -1.5, 'w']
];
/** A coin's width and a hair, so the rack starts just apart. */
const RACK_GAP = 2 * COIN_R + 0.6;

function theBreak(): Coin[] {
  const coins: Coin[] = [{ id: 0, kind: 'queen', x: BOARD / 2, y: BOARD / 2 }];
  let white = 1;
  let black = COINS_EACH + 1;
  for (const [ox, oy, c] of LAYOUT) {
    const id = c === 'w' ? white++ : black++;
    coins.push({ id, kind: kindOfId(id), x: BOARD / 2 + ox * RACK_GAP, y: BOARD / 2 + oy * RACK_GAP });
  }
  return coins;
}

export const baselineY = (seat: Seat) => (seat === 'user' ? BOARD - BASE_Y : BASE_Y);
/** Which way is forward for this seat: -1 up the board from the user's side, 1 down it from the partner's. */
export const forwardOf = (seat: Seat) => (seat === 'user' ? -1 : 1);

/** Whether the striker can sit here without touching a coin. */
export function spotFree(coins: Coin[], seat: Seat, x: number): boolean {
  const y = baselineY(seat);
  const gap = COIN_R + STRIKER_R;
  return coins.every(c => (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y) >= gap * gap);
}

/** The nearest place to `x` the striker can sit, or `x` itself if the whole line is blocked. */
export function nearestFree(coins: Coin[], seat: Seat, x: number): number {
  const at = Math.max(BASE_MIN, Math.min(BASE_MAX, Math.round(x)));
  for (let d = 0; d <= BASE_MAX - BASE_MIN; d++) {
    if (at - d >= BASE_MIN && spotFree(coins, seat, at - d)) return at - d;
    if (at + d <= BASE_MAX && spotFree(coins, seat, at + d)) return at + d;
  }
  return at;
}

function lineBlocked(coins: Coin[], seat: Seat): boolean {
  for (let x = BASE_MIN; x <= BASE_MAX; x += 4) if (spotFree(coins, seat, x)) return false;
  return true;
}

/** Whether a shot is one this seat may play from where the coins are. */
export function shotAllowed(coins: Coin[], seat: Seat, s: Shot): boolean {
  if (!Number.isInteger(s.x) || !Number.isInteger(s.dx) || !Number.isInteger(s.dy)) return false;
  if (s.x < BASE_MIN || s.x > BASE_MAX) return false;
  const forward = s.dy * forwardOf(seat);
  if (forward <= 0 || Math.abs(s.dx) > forward * 4) return false;
  const speed2 = s.dx * s.dx + s.dy * s.dy;
  if (speed2 < MIN_SHOT * MIN_SHOT || speed2 > MAX_SHOT * MAX_SHOT * 1.0001) return false;
  return spotFree(coins, seat, s.x) || lineBlocked(coins, seat);
}

// ------------------------------------------------------------- one shot

/** Something that happens during a shot, for its sound and sparkle. */
export interface ShotEvent {
  /** In ms from the strike. */
  at: number;
  type: 'hit' | 'wall' | 'pot';
  x: number;
  y: number;
  /** How hard, in units a second. */
  power: number;
  /** What fell in, and which pocket's middle it went to. */
  kind?: CoinKind | 'striker';
  pocket?: number;
}

export interface ShotRecording {
  /** The pieces, in the order of `frames`: the coins on the board, then the striker last. */
  ids: number[];
  kinds: (CoinKind | 'striker')[];
  /** Each frame: x and y of every piece. A piece that has fallen in stays where it was and is listed in `goneAt`. */
  frames: Float32Array[];
  /** The frame each piece fell in at, or -1. */
  goneAt: number[];
  events: ShotEvent[];
  ms: number;
}

interface Body {
  id: number;
  kind: CoinKind | 'striker';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
  gone: boolean;
}

interface ShotOutcome {
  /** What is left on the board, in place. */
  coins: Coin[];
  fallen: Coin[];
  strikerIn: boolean;
  recording?: ShotRecording;
}

/** Plays one shot through. The same numbers always come out the same. */
export function simulateShot(coins: Coin[], seat: Seat, s: Shot, record = false): ShotOutcome {
  const bodies: Body[] = coins.map(c => ({ id: c.id, kind: c.kind, x: c.x, y: c.y, vx: 0, vy: 0, r: COIN_R, m: 1, gone: false }));
  bodies.push({ id: -1, kind: 'striker', x: s.x, y: baselineY(seat), vx: s.dx, vy: s.dy, r: STRIKER_R, m: STRIKER_MASS, gone: false });
  const n = bodies.length;
  const fallen: Coin[] = [];
  let strikerIn = false;

  const frames: Float32Array[] = [];
  const goneAt: number[] = bodies.map(() => -1);
  const events: ShotEvent[] = [];
  const snapshot = () => {
    const f = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      f[i * 2] = bodies[i].x;
      f[i * 2 + 1] = bodies[i].y;
    }
    frames.push(f);
  };
  if (record) snapshot();

  let step = 0;
  for (; step < MAX_STEPS; step++) {
    let moving = false;

    // Move, and lose a little speed to the board.
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b.gone || (b.vx === 0 && b.vy === 0)) continue;
      moving = true;
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (speed <= FRICTION) {
        b.vx = 0;
        b.vy = 0;
      } else {
        const k = ((speed - FRICTION) / speed) * DRAG;
        b.vx *= k;
        b.vy *= k;
      }
    }
    if (!moving) break;

    // Into a pocket, or off a side.
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b.gone || (b.vx === 0 && b.vy === 0)) continue;
      let pocket = -1;
      for (let p = 0; p < 4; p++) {
        const ax = b.x - POCKETS[p][0];
        const ay = b.y - POCKETS[p][1];
        if (ax * ax + ay * ay < POCKET_R * POCKET_R) {
          pocket = p;
          break;
        }
      }
      if (pocket >= 0) {
        b.gone = true;
        if (record) {
          goneAt[i] = Math.floor(step / STEPS_PER_FRAME);
          events.push({ at: step * DT * 1000, type: 'pot', x: b.x, y: b.y, power: Math.sqrt(b.vx * b.vx + b.vy * b.vy), kind: b.kind, pocket });
        }
        b.vx = 0;
        b.vy = 0;
        if (b.kind === 'striker') strikerIn = true;
        else fallen.push({ id: b.id, kind: b.kind, x: b.x, y: b.y });
        continue;
      }
      let hit = 0;
      if (b.x < b.r) {
        hit = Math.abs(b.vx);
        b.x = b.r;
        b.vx = -b.vx * WALL_BOUNCE;
        b.vy *= 0.97;
      } else if (b.x > BOARD - b.r) {
        hit = Math.abs(b.vx);
        b.x = BOARD - b.r;
        b.vx = -b.vx * WALL_BOUNCE;
        b.vy *= 0.97;
      }
      if (b.y < b.r) {
        hit = Math.max(hit, Math.abs(b.vy));
        b.y = b.r;
        b.vy = -b.vy * WALL_BOUNCE;
        b.vx *= 0.97;
      } else if (b.y > BOARD - b.r) {
        hit = Math.max(hit, Math.abs(b.vy));
        b.y = BOARD - b.r;
        b.vy = -b.vy * WALL_BOUNCE;
        b.vx *= 0.97;
      }
      if (record && hit > 60) events.push({ at: step * DT * 1000, type: 'wall', x: b.x, y: b.y, power: hit });
    }

    // Piece against piece.
    for (let i = 0; i < n; i++) {
      const a = bodies[i];
      if (a.gone) continue;
      const aStill = a.vx === 0 && a.vy === 0;
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j];
        if (b.gone || (aStill && b.vx === 0 && b.vy === 0)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const reach = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= reach * reach || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const total = a.m + b.m;
        // Apart, each by its share.
        const over = reach - d;
        a.x -= nx * over * (b.m / total);
        a.y -= ny * over * (b.m / total);
        b.x += nx * over * (a.m / total);
        b.y += ny * over * (a.m / total);
        const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (closing <= 0) continue;
        const impulse = ((1 + COIN_BOUNCE) * closing) / total;
        a.vx -= impulse * b.m * nx;
        a.vy -= impulse * b.m * ny;
        b.vx += impulse * a.m * nx;
        b.vy += impulse * a.m * ny;
        if (record && closing > 40) {
          events.push({ at: step * DT * 1000, type: 'hit', x: a.x + nx * a.r, y: a.y + ny * a.r, power: closing });
        }
      }
    }

    if (record && step % STEPS_PER_FRAME === STEPS_PER_FRAME - 1) snapshot();
  }

  const left: Coin[] = [];
  for (const b of bodies) if (!b.gone && b.kind !== 'striker') left.push({ id: b.id, kind: b.kind, x: b.x, y: b.y });

  const outcome: ShotOutcome = { coins: left, fallen, strikerIn };
  if (record) {
    snapshot();
    outcome.recording = {
      ids: bodies.map(b => b.id),
      kinds: bodies.map(b => b.kind),
      frames,
      goneAt,
      events,
      ms: step * DT * 1000
    };
  }
  return outcome;
}

// ------------------------------------------------------------ the rules

/** What a shot came to, in a word: what the board says about it. */
export type ShotNote = 'own' | 'theirs' | 'queen' | 'covered' | 'queen-back' | 'foul' | 'last-back' | 'nothing';

export interface CarromStep {
  seat: Seat;
  note: ShotNote;
  /** The coins put back in the middle, once the shot was over. */
  returned: Coin[];
  /** What fell in: how many of each. */
  fell: { white: number; black: number; queen: boolean; striker: boolean };
}

export interface CarromState {
  coins: Coin[];
  /** Who plays which: whoever breaks plays white. */
  colour: Record<Seat, 'white' | 'black'>;
  /** How many of each of you's coins are still on the board. */
  left: Record<Seat, number>;
  /** The queen: on the board, just pocketed and waiting to be covered, or won. */
  queen: 'board' | 'pending' | Seat;
  turn: Seat;
  /** The player who just shot goes again. */
  again: boolean;
  over: boolean;
  winner: Seat | null;
  played: number;
  last: CarromStep | null;
}

const otherSeat = (seat: Seat): Seat => (seat === 'user' ? 'partner' : 'user');

/** Ring upon ring of places around the middle, for a coin coming back when the middle is taken. */
const RETURN_SPOTS: ReadonlyArray<readonly [number, number]> = (() => {
  const out: [number, number][] = [[0, 0]];
  for (const [ox, oy] of LAYOUT) out.push([ox, oy]);
  // Further out, on the same hexagon.
  for (const [ox, oy] of LAYOUT.slice(6)) out.push([ox * 1.5, oy * 1.5]);
  for (const [ox, oy] of LAYOUT.slice(6)) out.push([ox * 2.1, oy * 2.1]);
  return out;
})();

function placeBack(coins: Coin[], kind: CoinKind): Coin {
  const taken = new Set(coins.map(c => c.id));
  let id = kind === 'queen' ? 0 : kind === 'white' ? 1 : COINS_EACH + 1;
  while (taken.has(id)) id++;
  const gap = 2 * COIN_R + 0.6;
  for (const [ox, oy] of RETURN_SPOTS) {
    const x = BOARD / 2 + ox * gap;
    const y = BOARD / 2 + oy * gap;
    if (coins.every(c => (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y) >= gap * gap)) {
      const coin = { id, kind, x, y };
      coins.push(coin);
      return coin;
    }
  }
  // Nowhere free near the middle: the first shot to touch it will sort them out.
  const coin = { id, kind, x: BOARD / 2, y: BOARD / 2 };
  coins.push(coin);
  return coin;
}

export function freshCarrom(first: Seat): CarromState {
  return {
    coins: theBreak(),
    colour: first === 'user' ? { user: 'white', partner: 'black' } : { user: 'black', partner: 'white' },
    left: { user: COINS_EACH, partner: COINS_EACH },
    queen: 'board',
    turn: first,
    again: false,
    over: false,
    winner: null,
    played: 0,
    last: null
  };
}

/**
 * The rules, once a shot has stopped.
 *
 * Your own coin in: it counts and you go again. Their coin in: it counts for
 * them. The queen can only be taken once you have a coin of your own in, and
 * must be covered - your own coin in, on the same shot or the next - or she
 * goes back to the middle. The striker in is a foul: one of your coins comes
 * back, along with any of yours that fell on that shot. Your last coin cannot
 * go in until the queen is won. Clear your coins, with the queen won, to win.
 */
export function afterShot(state: CarromState, outcome: Pick<ShotOutcome, 'coins' | 'fallen' | 'strikerIn'>): CarromState {
  const me = state.turn;
  const them = otherSeat(me);
  const mine = state.colour[me];
  const theirs = state.colour[them];
  const coins = outcome.coins.map(c => ({ ...c }));
  const returned: Coin[] = [];
  const back = (kind: CoinKind) => returned.push(placeBack(coins, kind));
  const fell = {
    white: outcome.fallen.filter(c => c.kind === 'white').length,
    black: outcome.fallen.filter(c => c.kind === 'black').length,
    queen: outcome.fallen.some(c => c.kind === 'queen'),
    striker: outcome.strikerIn
  };
  const ownIn = fell[mine];
  const theirIn = fell[theirs];
  const queenIn = fell.queen;

  const count = (colour: 'white' | 'black') => coins.filter(c => c.kind === colour).length;
  let queen = state.queen;
  let note: ShotNote = 'nothing';
  let again = false;

  if (outcome.strikerIn) {
    // Your coins that fell go back, and one more from those you had in.
    for (let i = 0; i < ownIn; i++) back(mine);
    const had = COINS_EACH - count(mine);
    if (had > 0) back(mine);
    if (queenIn) back('queen');
    if (queen === 'pending') {
      back('queen');
      queen = 'board';
    }
    note = 'foul';
  } else {
    const haveOne = COINS_EACH - count(mine) > 0;
    if (queenIn) {
      if (!haveOne) {
        back('queen');
        note = 'queen-back';
      } else if (ownIn > 0) {
        queen = me;
        note = 'covered';
        again = true;
      } else {
        queen = 'pending';
        note = 'queen';
        again = true;
      }
    } else if (queen === 'pending') {
      if (ownIn > 0) {
        queen = me;
        note = 'covered';
        again = true;
      } else {
        back('queen');
        queen = 'board';
        note = 'queen-back';
      }
    } else if (ownIn > 0) {
      note = 'own';
      again = true;
    } else if (theirIn > 0) {
      note = 'theirs';
    }
  }

  // Nobody's last coin goes in until the queen has been won.
  const queenWon = queen === 'user' || queen === 'partner';
  if (!queenWon) {
    for (const colour of [mine, theirs]) {
      if (count(colour) === 0) {
        back(colour);
        if (colour === mine) {
          again = false;
          note = 'last-back';
        }
      }
    }
  }

  const left = { [me]: count(mine), [them]: count(theirs) } as Record<Seat, number>;
  const finished: Seat | null = queenWon ? (left[me] === 0 ? me : left[them] === 0 ? them : null) : null;
  return {
    coins,
    colour: state.colour,
    left,
    queen,
    turn: finished || again ? me : them,
    again: again && !finished,
    over: !!finished,
    winner: finished,
    played: state.played + 1,
    last: { seat: me, note, returned, fell }
  };
}

// --------------------------------------------------------- a whole game

interface Run {
  id: string;
  first: Seat;
  moves: number[];
  /** states[k]: the game after k moves. */
  states: CarromState[];
}
let run: Run | null = null;

/**
 * Every state of a game, worked out once. A new move only adds one shot, and
 * replaying a game of a hundred shots from nothing takes a few milliseconds
 * - but this is asked for on every draw.
 */
function statesOf(game: { id: string; first: Seat; moves: number[] }): CarromState[] {
  const same = !!run && run.id === game.id && run.first === game.first;
  let keep = 0;
  if (same) {
    const limit = Math.min(run!.moves.length, game.moves.length);
    while (keep < limit && run!.moves[keep] === game.moves[keep]) keep++;
  }
  // Keep what still agrees; anything after that is worked out afresh.
  const states = same ? run!.states.slice(0, keep + 1) : [freshCarrom(game.first)];
  for (let k = states.length - 1; k < game.moves.length; k++) {
    const state = states[k];
    const move = game.moves[k];
    if (state.over || !Number.isSafeInteger(move) || move < 0) break;
    const shot = decodeShot(move);
    if (!shotAllowed(state.coins, state.turn, shot)) break;
    states.push(afterShot(state, simulateShot(state.coins, state.turn, shot)));
  }
  run = { id: game.id, first: game.first, moves: game.moves.slice(), states };
  return states;
}

/** The game as far as its moves are legal. */
export function playCarrom(game: { id: string; first: Seat; moves: number[] }): CarromState {
  const states = statesOf(game);
  return states[states.length - 1];
}

/** The game after its first `k` moves. */
export function carromAfter(game: { id: string; first: Seat; moves: number[] }, k: number): CarromState {
  const states = statesOf(game);
  return states[Math.max(0, Math.min(k, states.length - 1))];
}

/** A shot from where a state stands, recorded for showing. The rules' verdict comes from the same numbers. */
export function recordShot(state: CarromState, move: number): { recording: ShotRecording; shot: Shot } {
  const shot = decodeShot(move);
  return { recording: simulateShot(state.coins, state.turn, shot, true).recording!, shot };
}
