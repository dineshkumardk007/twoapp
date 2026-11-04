// The boop battle's moves (components/UsScene): what each play does to the
// one doing it and the one it is done to, part by part (components/UsRig),
// timed like a cartoon - a wind-up, the hit, a squash, a bounce back, a
// wobble as it settles, ears flopping a beat behind the head.
//
// Every move is a transform or a fade of a layer that is already drawn, run
// by the browser itself (element.animate): the phone's graphics chip plays
// it, so nothing is drawn again while it moves and the page is never held up.

import type { PlayKind } from '../core/usTwo';
import type { Mood } from './StickerArt';
import type { RigLayer, RigLayers } from './UsRig';

export type Act = PlayKind | 'giggle';

/** How long the one doing it takes to hop over. */
export const WALK_MS = 420;
/** How far apart, middle to middle, it stands to do it. */
export const NEAR = 50;
/** The plays done up close: the one doing it hops over first. */
export const NEAR_ACTS: ReadonlySet<Act> = new Set<Act>(['boop', 'tickle', 'pinch', 'pat', 'hug', 'kiss', 'feed', 'nuzzle', 'flower', 'highfive', 'dance', 'tuck']);
/** Closer than that for some: cheek to cheek, arms round them. */
const CLOSE: Partial<Record<Act, number>> = { hug: 30, kiss: 38, nuzzle: 36, highfive: 52, tuck: 46 };
/** How far apart it stands for this play. */
export const nearOf = (act: Act) => CLOSE[act] ?? NEAR;

/** When the first pillow of a run (or a water balloon) is let go, after its wind-up. */
export const FIRST_RELEASE = 430;
/** How long a pillow or a balloon is in the air. */
export const FLIGHT_MS = 360;
/** The beat of the dance (and of its tune, us-dance). */
export const DANCE_BEAT = 360;

/** How long each play lasts, once the one doing it is there. */
export const PLAY_MS: Record<Act, number> = {
  boop: 1000,
  tickle: 1750,
  pinch: 1700,
  pat: 1800,
  pillow: 1950,
  hug: 2100,
  kiss: 1700,
  feed: 1900,
  nuzzle: 1900,
  flower: 2400,
  highfive: 1600,
  balloon: 2300,
  tease: 2000,
  dance: 2400,
  tuck: 3000,
  giggle: 900
};

/** When the words come up, from the start of the play itself: when it lands. */
export const SAY_AT: Record<Act, number> = {
  boop: 240,
  tickle: 200,
  pinch: 300,
  pat: 450,
  pillow: 800,
  hug: 380,
  kiss: 420,
  feed: 620,
  nuzzle: 350,
  flower: 520,
  highfive: 420,
  balloon: FIRST_RELEASE + FLIGHT_MS,
  tease: 700,
  dance: 150,
  tuck: 900,
  giggle: 0
};

/** How each one looks as the play goes on: from `at`, until the next. */
export const MOODS: Record<Act, { at: number; target?: Mood; actor?: Mood }[]> = {
  boop: [{ at: 0, actor: 'grin' }, { at: 240, target: 'shock' }, { at: 470, target: 'laugh' }],
  tickle: [{ at: 0, actor: 'grin' }, { at: 160, target: 'laugh' }, { at: 1300, actor: 'laugh' }],
  pinch: [{ at: 0, actor: 'grin' }, { at: 200, target: 'tight' }, { at: 840, target: 'happy', actor: 'love' }],
  pat: [{ at: 0, actor: 'happy' }, { at: 380, target: 'happy' }, { at: 1250, target: 'love' }],
  pillow: [{ at: 0, actor: 'smug' }, { at: 790, target: 'shock', actor: 'laugh' }, { at: 1080, target: 'dead' }],
  hug: [{ at: 0, actor: 'grin' }, { at: 380, actor: 'happy', target: 'happy' }, { at: 1300, actor: 'love', target: 'love' }],
  kiss: [{ at: 0, actor: 'kiss' }, { at: 420, target: 'shock' }, { at: 640, target: 'love' }, { at: 950, actor: 'happy' }],
  feed: [{ at: 0, actor: 'grin', target: 'drool' }, { at: 620, target: 'tight' }, { at: 900, target: 'happy' }, { at: 1450, target: 'love', actor: 'happy' }],
  nuzzle: [{ at: 0, actor: 'happy' }, { at: 350, target: 'happy' }, { at: 950, actor: 'love', target: 'love' }],
  flower: [{ at: 0, actor: 'happy' }, { at: 270, target: 'shock' }, { at: 520, target: 'kiss' }, { at: 1000, target: 'love', actor: 'love' }],
  highfive: [{ at: 0, actor: 'grin', target: 'grin' }, { at: 420, actor: 'laugh', target: 'laugh' }, { at: 1050, actor: 'happy', target: 'happy' }],
  balloon: [{ at: 0, actor: 'smug' }, { at: 790, target: 'shock', actor: 'laugh' }, { at: 1250, target: 'tight' }, { at: 1900, target: 'laugh' }],
  tease: [{ at: 0, actor: 'tongue' }, { at: 700, target: 'angry' }, { at: 1300, actor: 'laugh' }, { at: 1650, target: 'roll' }],
  dance: [{ at: 0, actor: 'happy', target: 'happy' }, { at: 900, actor: 'wink', target: 'laugh' }, { at: 1800, actor: 'laugh', target: 'happy' }],
  tuck: [{ at: 0, actor: 'happy' }, { at: 250, target: 'yawn' }, { at: 900, target: 'sleep', actor: 'smile' }],
  giggle: [{ at: 0, target: 'laugh' }]
};

/** One part of one of them, moved. */
export interface Move {
  who: 'actor' | 'target';
  layer: RigLayer;
  frames: Keyframe[];
  ms: number;
  delay?: number;
}

const SOFT = 'cubic-bezier(0.33, 0, 0.3, 1)';
const RISE = 'cubic-bezier(0.2, 0.6, 0.4, 1)';
const FALL = 'cubic-bezier(0.6, 0, 0.8, 0.4)';

const k = (offset: number, transform: string, easing = SOFT): Keyframe => ({ offset, transform, easing });
const o = (offset: number, opacity: number): Keyframe => ({ offset, opacity });
const r = (deg: number) => `rotate(${deg}deg)`;
const sc = (x: number, y = x) => `scale(${x}, ${y})`;
const up = (pct: number) => `translateY(${pct}%)`;
const tilt = (deg: number, x: number) => `rotate(${deg}deg) translateX(${x}%)`;
const shove = (x: number, y: number) => `translate(${x}%, ${y}%)`;

/** Values evenly through a move, each eased into the next. */
const even = (values: number[], as: (v: number) => string): Keyframe[] =>
  values.map((v, i) => k(i / (values.length - 1), as(v)));

/** An arm put away while a stretched one does the work. */
const away = (until: number): Keyframe[] => [o(0, 1), o(0.04, 0), o(until, 0), o(1, 1)];

/** The near arm, on the side facing the other one. */
const nearArm = (d: number): RigLayer => (d > 0 ? 'armR' : 'armL');

type Role = Move['who'];

/** Both ears flopping a beat behind a knock at `at` (of `ms`). */
const flop = (who: Role, delay: number, at: number, d: number, ms: number, size = 12): Move[] =>
  (['earL', 'earR'] as const).map(ear => ({
    who,
    layer: ear,
    ms,
    delay,
    frames: [
      k(0, r(0)),
      k(at, r(0)),
      k(at + 0.06, r(-size * d)),
      k(at + 0.13, r(size * 0.6 * d)),
      k(at + 0.2, r(-size * 0.25 * d)),
      k(at + 0.28, r(0)),
      k(1, r(0))
    ]
  }));

/** Both ears waggling the whole way through: happy. */
const waggle = (who: Role, delay: number, ms: number, size = 8): Move[] => [
  { who, layer: 'earL', ms, delay, frames: even([0, -size, size * 0.7, -size, size * 0.7, -size, size * 0.7, 0], r) },
  { who, layer: 'earR', ms, delay, frames: even([0, size, -size * 0.7, size, -size * 0.7, size, -size * 0.7, 0], r) }
];

/** A pillow or a balloon wound up over the head and swung: let go at FIRST_RELEASE. */
const throwUp = (d: number): Move[] => [
  { who: 'actor', layer: 'lean', ms: 900, frames: [k(0, r(0)), k(0.37, r(-10 * d)), k(0.5, r(13 * d)), k(0.65, r(9 * d)), k(1, r(0))] },
  {
    who: 'actor',
    layer: 'squash',
    ms: 900,
    frames: [k(0, sc(1)), k(0.37, sc(1.07, 0.93)), k(0.5, sc(0.94, 1.07)), k(0.7, sc(1.01, 0.99)), k(1, sc(1))]
  },
  { who: 'actor', layer: 'armL', ms: 900, frames: [k(0, r(0)), k(0.22, r(130)), k(0.4, r(140)), k(0.52, r(60)), k(1, r(0))] },
  { who: 'actor', layer: 'armR', ms: 900, frames: [k(0, r(0)), k(0.22, r(-130)), k(0.4, r(-140)), k(0.52, r(-60)), k(1, r(0))] }
];

/** A hop and a lean in the direction it goes: how either of them gets about. */
export function scootMoves(dir: number): Omit<Move, 'who'>[] {
  return [
    {
      layer: 'hop',
      ms: WALK_MS,
      frames: [k(0, up(0), RISE), k(0.35, up(-5.5), FALL), k(0.55, up(0), RISE), k(0.8, up(-3), FALL), k(1, up(0))]
    },
    { layer: 'lean', ms: WALK_MS, frames: [k(0, r(0)), k(0.3, r(8 * dir)), k(0.75, r(5 * dir)), k(1, r(0))] },
    {
      layer: 'squash',
      ms: WALK_MS,
      frames: [k(0, sc(1)), k(0.12, sc(1.05, 0.95)), k(0.35, sc(0.96, 1.04)), k(0.55, sc(1.05, 0.95)), k(0.8, sc(0.98, 1.02)), k(1, sc(1))]
    },
    { layer: 'shadow', ms: WALK_MS, frames: [k(0, sc(1)), k(0.35, sc(0.8)), k(0.55, sc(1)), k(0.8, sc(0.88)), k(1, sc(1))] }
  ];
}

/**
 * Every part's move for one play. `d` is 1 when the one it is done to is to
 * the right of the one doing it; `lead` is how long the one doing it takes
 * to get there first.
 */
export function movesFor(act: Act, d: number, lead: number, combo = 1): Move[] {
  const L = lead;
  switch (act) {
    case 'boop': {
      const moves: Move[] = [
        // A little wind-up, then the poke.
        { who: 'actor', layer: 'lean', ms: 600, delay: L, frames: [k(0, r(0)), k(0.22, r(-5 * d)), k(0.42, r(7 * d)), k(0.62, r(2 * d)), k(1, r(0))] },
        {
          who: 'actor',
          layer: 'squash',
          ms: 600,
          delay: L,
          frames: [k(0, sc(1)), k(0.22, sc(1.05, 0.95)), k(0.42, sc(0.96, 1.05)), k(0.62, sc(1.01, 0.99)), k(1, sc(1))]
        },
        { who: 'actor', layer: nearArm(d), ms: 620, delay: L, frames: away(0.9) },
        // The head knocked back from the nose, and wobbling home.
        {
          who: 'target',
          layer: 'head',
          ms: 1000,
          delay: L,
          frames: [
            k(0, tilt(0, 0)),
            k(0.24, tilt(0, 0)),
            k(0.34, tilt(12 * d, 4 * d)),
            k(0.5, tilt(-6 * d, -1 * d)),
            k(0.66, tilt(3 * d, 0)),
            k(0.82, tilt(-1 * d, 0)),
            k(1, tilt(0, 0))
          ]
        },
        {
          who: 'target',
          layer: 'squash',
          ms: 900,
          delay: L,
          frames: [k(0, sc(1)), k(0.26, sc(1)), k(0.36, sc(1.08, 0.92)), k(0.54, sc(0.96, 1.04)), k(0.72, sc(1.02, 0.98)), k(1, sc(1))]
        }
      ];
      // The ears a beat behind.
      for (const ear of ['earL', 'earR'] as const) {
        moves.push({
          who: 'target',
          layer: ear,
          ms: 1100,
          delay: L,
          frames: [k(0, r(0)), k(0.27, r(0)), k(0.4, r(-16 * d)), k(0.56, r(11 * d)), k(0.72, r(-5 * d)), k(0.86, r(2 * d)), k(1, r(0))]
        });
      }
      // A run of boops sends them up - higher the longer it goes on, and
      // right over at ten.
      if (combo >= 3) {
        const high = combo >= 6 ? -15 : -7;
        moves.push(
          {
            who: 'target',
            layer: 'hop',
            ms: 760,
            delay: L,
            frames: [k(0, up(0)), k(0.3, up(0), RISE), k(0.52, up(high), FALL), k(0.74, up(0), RISE), k(0.86, up(-2), FALL), k(1, up(0))]
          },
          {
            who: 'target',
            layer: 'shadow',
            ms: 760,
            delay: L,
            frames: [k(0, sc(1)), k(0.3, sc(1)), k(0.52, sc(combo >= 6 ? 0.6 : 0.8)), k(0.74, sc(1)), k(0.86, sc(0.95)), k(1, sc(1))]
          }
        );
        if (combo >= 10) {
          moves.push({ who: 'target', layer: 'lean', ms: 760, delay: L, frames: [k(0, r(0)), k(0.3, r(0)), k(0.74, r(360 * d)), k(1, r(360 * d))] });
        }
      }
      return moves;
    }

    case 'tickle': {
      const T = L + 120;
      return [
        { who: 'actor', layer: 'armL', ms: 1500, delay: L, frames: away(0.94) },
        { who: 'actor', layer: 'armR', ms: 1500, delay: L, frames: away(0.94) },
        { who: 'actor', layer: 'lean', ms: 1500, delay: L, frames: [k(0, r(0)), k(0.12, r(6 * d)), k(0.88, r(6 * d)), k(1, r(0))] },
        { who: 'actor', layer: 'squash', ms: 1500, delay: L, frames: even([1, 1.03, 0.99, 1.03, 0.99, 1.03, 0.99, 1.02, 1], v => sc(v, 2 - v)) },
        // Squirming, giggling, ears flapping.
        { who: 'target', layer: 'lean', ms: 1450, delay: T, frames: even([0, -7, 7, -7, 7, -6, 6, -5, 4, -2, 0], r) },
        { who: 'target', layer: 'hop', ms: 1450, delay: T, frames: even([0, -3, 0, -3, 0, -3, 0, -2, 0], up) },
        { who: 'target', layer: 'head', ms: 1450, delay: T, frames: even([0, 5, -5, 5, -5, 4, -3, 0], r) },
        { who: 'target', layer: 'squash', ms: 1450, delay: T, frames: even([1, 1.04, 0.98, 1.04, 0.98, 1.03, 1], v => sc(v, 2 - v)) },
        { who: 'target', layer: 'earL', ms: 1450, delay: T, frames: even([0, -18, 12, -18, 12, -14, 9, -5, 0], r) },
        { who: 'target', layer: 'earR', ms: 1450, delay: T, frames: even([0, 18, -12, 18, -12, 14, -9, 5, 0], r) }
      ];
    }

    case 'pinch': {
      return [
        { who: 'actor', layer: nearArm(d), ms: 1050, delay: L, frames: away(0.86) },
        {
          who: 'actor',
          layer: 'lean',
          ms: 1100,
          delay: L,
          frames: [k(0, r(0)), k(0.18, r(4 * d)), k(0.55, r(-5 * d)), k(0.72, r(-5 * d)), k(0.82, r(3 * d)), k(1, r(0))]
        },
        // The cheek pulled out wide - and let go, springing back.
        {
          who: 'target',
          layer: 'stretch',
          ms: 1300,
          delay: L,
          frames: [
            k(0, sc(1)),
            k(0.15, sc(1)),
            k(0.22, sc(1.04, 0.98)),
            k(0.48, sc(1.2, 0.93)),
            k(0.58, sc(1.2, 0.93), 'cubic-bezier(0.5, 0, 0.7, 0.4)'),
            k(0.65, sc(0.88, 1.06)),
            k(0.74, sc(1.06, 0.97)),
            k(0.84, sc(0.98, 1.01)),
            k(1, sc(1))
          ]
        },
        {
          who: 'target',
          layer: 'head',
          ms: 1300,
          delay: L,
          frames: [k(0, r(0)), k(0.15, r(0)), k(0.48, r(-7 * d)), k(0.58, r(-7 * d)), k(0.66, r(4 * d)), k(0.78, r(-2 * d)), k(1, r(0))]
        },
        { who: 'target', layer: 'blush', ms: 1800, delay: L, frames: [o(0, 0), o(0.12, 0), o(0.22, 1), o(0.85, 1), o(1, 0)] },
        ...(['earL', 'earR'] as const).map(
          (ear): Move => ({
            who: 'target',
            layer: ear,
            ms: 1300,
            delay: L,
            frames: [k(0, r(0)), k(0.58, r(0)), k(0.67, r(14 * d)), k(0.78, r(-8 * d)), k(0.88, r(3 * d)), k(1, r(0))]
          })
        )
      ];
    }

    case 'pat': {
      // Three pats, at these points of the move (index.css, rig-pat).
      const pats = [0.27, 0.47, 0.67];
      const rest = 'translateY(0%) scale(1, 1)';
      const head: Keyframe[] = [k(0, rest)];
      const earL: Keyframe[] = [k(0, r(0))];
      const earR: Keyframe[] = [k(0, r(0))];
      for (const p of pats) {
        head.push(k(p - 0.03, rest), k(p + 0.01, 'translateY(1.2%) scale(1.05, 0.9)'), k(p + 0.08, 'translateY(0%) scale(0.98, 1.02)'));
        earL.push(k(p - 0.03, r(0)), k(p + 0.01, r(-14)), k(p + 0.08, r(4)));
        earR.push(k(p - 0.03, r(0)), k(p + 0.01, r(14)), k(p + 0.08, r(-4)));
      }
      head.push(k(0.85, rest), k(1, rest));
      earL.push(k(0.85, r(0)), k(1, r(0)));
      earR.push(k(0.85, r(0)), k(1, r(0)));
      return [
        { who: 'actor', layer: nearArm(d), ms: 1500, delay: L, frames: away(0.92) },
        { who: 'actor', layer: 'lean', ms: 1500, delay: L, frames: [k(0, r(0)), k(0.14, r(5 * d)), k(0.86, r(5 * d)), k(1, r(0))] },
        { who: 'target', layer: 'head', ms: 1500, delay: L, frames: head },
        { who: 'target', layer: 'earL', ms: 1500, delay: L, frames: earL },
        { who: 'target', layer: 'earR', ms: 1500, delay: L, frames: earR },
        { who: 'target', layer: 'blush', ms: 1800, delay: L, frames: [o(0, 0), o(0.2, 0), o(0.32, 1), o(0.88, 1), o(1, 0)] }
      ];
    }

    case 'pillow':
      return pillowMoves(d, FIRST_RELEASE, true);

    case 'hug':
      return hugMoves(d, L);
    case 'kiss':
      return kissMoves(d, L);
    case 'feed':
      return feedMoves(d, L);
    case 'nuzzle':
      return nuzzleMoves(d, L);
    case 'flower':
      return flowerMoves(d, L);
    case 'highfive':
      return highFiveMoves(d, L);
    case 'balloon':
      return balloonMoves(d);
    case 'tease':
      return teaseMoves(d);
    case 'dance':
      return danceMoves(d, L);
    case 'tuck':
      return tuckMoves(d, L);

    case 'giggle':
      return [
        {
          who: 'target',
          layer: 'hop',
          ms: 700,
          frames: [k(0, up(0)), k(0.2, up(0), RISE), k(0.45, up(-7), FALL), k(0.7, up(0), RISE), k(0.84, up(-2), FALL), k(1, up(0))]
        },
        {
          who: 'target',
          layer: 'squash',
          ms: 700,
          frames: [k(0, sc(1)), k(0.2, sc(1.1, 0.9)), k(0.45, sc(0.94, 1.07)), k(0.7, sc(1.06, 0.94)), k(0.84, sc(0.99, 1.01)), k(1, sc(1))]
        },
        { who: 'target', layer: 'shadow', ms: 700, frames: [k(0, sc(1)), k(0.2, sc(1)), k(0.45, sc(0.7)), k(0.7, sc(1)), k(0.84, sc(0.92)), k(1, sc(1))] },
        { who: 'target', layer: 'head', ms: 700, frames: even([0, 7, -6, 4, -2, 0], r) },
        { who: 'target', layer: 'earL', ms: 800, frames: even([0, -12, 10, -6, 3, 0], r) },
        { who: 'target', layer: 'earR', ms: 800, frames: even([0, 12, -10, 6, -3, 0], r) }
      ];
  }
}

/**
 * A hug: in with a lunge, both arms round them (UsScene, rig-hug-arm),
 * squeezing three times as the two of them rock side to side together,
 * their head on your shoulder. The arms close at 0.2 - 380 ms.
 */
function hugMoves(d: number, L: number): Move[] {
  const ms = 1900;
  return [
    { who: 'actor', layer: 'armL', ms, delay: L, frames: away(0.9) },
    { who: 'actor', layer: 'armR', ms, delay: L, frames: away(0.9) },
    {
      who: 'actor',
      layer: 'lean',
      ms,
      delay: L,
      frames: [k(0, r(0)), k(0.12, r(-4 * d)), k(0.2, r(10 * d)), k(0.38, r(4 * d)), k(0.52, r(10 * d)), k(0.66, r(4 * d)), k(0.8, r(9 * d)), k(0.9, r(4 * d)), k(1, r(0))]
    },
    {
      who: 'actor',
      layer: 'squash',
      ms,
      delay: L,
      frames: [k(0, sc(1)), k(0.12, sc(1.05, 0.95)), k(0.2, sc(0.95, 1.05)), k(0.3, sc(0.94, 1.04)), k(0.4, sc(0.98, 1.01)), k(0.5, sc(0.94, 1.04)), k(0.62, sc(0.98, 1.01)), k(0.74, sc(0.94, 1.04)), k(0.88, sc(1)), k(1, sc(1))]
    },
    { who: 'actor', layer: 'head', ms, delay: L, frames: [k(0, r(0)), k(0.2, r(8 * d)), k(0.85, r(8 * d)), k(1, r(0))] },
    { who: 'actor', layer: 'blush', ms: 2000, delay: L, frames: [o(0, 0), o(0.22, 0), o(0.32, 1), o(0.88, 1), o(1, 0)] },
    {
      who: 'target',
      layer: 'lean',
      ms,
      delay: L,
      frames: [k(0, r(0)), k(0.18, r(0)), k(0.26, r(3 * d)), k(0.38, r(-6 * d)), k(0.52, r(1 * d)), k(0.66, r(-6 * d)), k(0.8, r(1 * d)), k(0.9, r(-2 * d)), k(1, r(0))]
    },
    {
      who: 'target',
      layer: 'squash',
      ms,
      delay: L,
      frames: [k(0, sc(1)), k(0.18, sc(1)), k(0.24, sc(0.9, 1.07)), k(0.34, sc(0.97, 1.01)), k(0.46, sc(0.92, 1.05)), k(0.58, sc(0.98, 1.01)), k(0.7, sc(0.92, 1.05)), k(0.84, sc(1.02, 0.98)), k(1, sc(1))]
    },
    { who: 'target', layer: 'head', ms, delay: L, frames: [k(0, r(0)), k(0.2, r(0)), k(0.3, r(-10 * d)), k(0.85, r(-10 * d)), k(1, r(0))] },
    { who: 'target', layer: 'blush', ms: 2000, delay: L, frames: [o(0, 0), o(0.2, 0), o(0.28, 1), o(0.9, 1), o(1, 0)] },
    ...flop('target', L, 0.2, d, ms)
  ];
}

/** A kiss on the cheek, up on tiptoe: a happy shiver, then a hop for joy. It lands at 0.28 - 420 ms. */
function kissMoves(d: number, L: number): Move[] {
  const ms = 1500;
  return [
    { who: 'actor', layer: 'lean', ms, delay: L, frames: [k(0, r(0)), k(0.15, r(-3 * d)), k(0.28, r(13 * d)), k(0.42, r(13 * d)), k(0.56, r(3 * d)), k(1, r(0))] },
    { who: 'actor', layer: 'hop', ms, delay: L, frames: [k(0, up(0)), k(0.18, up(0)), k(0.28, up(-2.5)), k(0.44, up(-2.5)), k(0.56, up(0)), k(1, up(0))] },
    { who: 'actor', layer: 'head', ms, delay: L, frames: [k(0, r(0)), k(0.28, r(10 * d)), k(0.44, r(10 * d)), k(0.6, r(0)), k(1, r(0))] },
    { who: 'actor', layer: 'blush', ms: 1700, delay: L, frames: [o(0, 0), o(0.1, 0), o(0.2, 1), o(0.85, 1), o(1, 0)] },
    {
      who: 'target',
      layer: 'head',
      ms,
      delay: L,
      frames: [k(0, tilt(0, 0)), k(0.27, tilt(0, 0)), k(0.32, tilt(6 * d, 1 * d)), k(0.4, tilt(-3 * d, 0)), k(0.5, tilt(2 * d, 0)), k(0.6, tilt(0, 0)), k(1, tilt(0, 0))]
    },
    { who: 'target', layer: 'blush', ms: 1700, delay: L, frames: [o(0, 0), o(0.25, 0), o(0.3, 1), o(0.9, 1), o(1, 0)] },
    {
      who: 'target',
      layer: 'hop',
      ms,
      delay: L,
      frames: [k(0, up(0)), k(0.45, up(0), RISE), k(0.58, up(-6), FALL), k(0.7, up(0), RISE), k(0.78, up(-1.5), FALL), k(0.86, up(0)), k(1, up(0))]
    },
    {
      who: 'target',
      layer: 'squash',
      ms,
      delay: L,
      frames: [k(0, sc(1)), k(0.27, sc(1)), k(0.31, sc(1.03, 0.97)), k(0.42, sc(1.06, 0.94)), k(0.5, sc(0.95, 1.06)), k(0.7, sc(1.06, 0.94)), k(0.8, sc(0.99, 1.01)), k(1, sc(1))]
    },
    { who: 'target', layer: 'shadow', ms, delay: L, frames: [k(0, sc(1)), k(0.45, sc(1)), k(0.58, sc(0.8)), k(0.7, sc(1)), k(1, sc(1))] },
    ...flop('target', L, 0.3, d, ms, 14)
  ];
}

/**
 * Feeding them: a bowl held in one arm, a spoonful swooped in like an
 * aeroplane with the other (UsScene, rig-feed-arm) - mouth wide, a chomp at
 * 0.326 (620 ms), and three chews with the cheeks puffed out.
 */
function feedMoves(d: number, L: number): Move[] {
  const ms = 1900;
  const far: RigLayer = d > 0 ? 'armL' : 'armR';
  const hold = -46 * d;
  return [
    { who: 'actor', layer: nearArm(d), ms: 1500, delay: L, frames: away(0.84) },
    { who: 'actor', layer: far, ms, delay: L, frames: [k(0, r(0)), k(0.08, r(hold)), k(0.86, r(hold)), k(1, r(0))] },
    { who: 'actor', layer: 'lean', ms, delay: L, frames: [k(0, r(0)), k(0.18, r(4 * d)), k(0.32, r(7 * d)), k(0.44, r(7 * d)), k(0.58, r(2 * d)), k(1, r(0))] },
    { who: 'target', layer: 'lean', ms, delay: L, frames: [k(0, r(0)), k(0.16, r(0)), k(0.3, r(-5 * d)), k(0.34, r(-3 * d)), k(0.5, r(-2 * d)), k(0.8, r(0)), k(1, r(0))] },
    {
      who: 'target',
      layer: 'stretch',
      ms,
      delay: L,
      frames: [k(0, sc(1)), k(0.33, sc(1)), k(0.36, sc(1.1, 0.95)), k(0.44, sc(1.02, 1)), k(0.52, sc(1.1, 0.95)), k(0.6, sc(1.02, 1)), k(0.68, sc(1.1, 0.95)), k(0.78, sc(1)), k(1, sc(1))]
    },
    {
      who: 'target',
      layer: 'head',
      ms,
      delay: L,
      frames: [k(0, r(0)), k(0.33, r(0)), k(0.36, r(3)), k(0.44, r(-2)), k(0.52, r(3)), k(0.6, r(-2)), k(0.68, r(3)), k(0.78, r(0)), k(1, r(0))]
    },
    {
      who: 'target',
      layer: 'squash',
      ms,
      delay: L,
      frames: [k(0, sc(1)), k(0.31, sc(1)), k(0.34, sc(1.05, 0.95)), k(0.4, sc(0.98, 1.02)), k(0.46, sc(1)), k(0.8, sc(1)), k(0.86, sc(0.96, 1.05)), k(0.93, sc(1.02, 0.98)), k(1, sc(1))]
    },
    { who: 'target', layer: 'blush', ms, delay: L, frames: [o(0, 0), o(0.7, 0), o(0.78, 1), o(0.95, 1), o(1, 0)] }
  ];
}

/** Cheek to cheek at 0.19 (350 ms), rubbing side to side five times, both blushing. */
function nuzzleMoves(d: number, L: number): Move[] {
  const ms = 1800;
  const rub = (base: number, a: number, b: number): Keyframe[] => [
    k(0, r(0)),
    k(0.19, r(base)),
    k(0.3, r(a)),
    k(0.42, r(b)),
    k(0.54, r(a)),
    k(0.66, r(b)),
    k(0.78, r(a)),
    k(0.88, r(base)),
    k(1, r(0))
  ];
  return [
    { who: 'actor', layer: 'lean', ms, delay: L, frames: [k(0, r(0)), k(0.2, r(9 * d)), k(0.85, r(9 * d)), k(1, r(0))] },
    { who: 'actor', layer: 'head', ms, delay: L, frames: rub(12 * d, 18 * d, 8 * d) },
    { who: 'target', layer: 'lean', ms, delay: L, frames: [k(0, r(0)), k(0.17, r(0)), k(0.22, r(-6 * d)), k(0.85, r(-6 * d)), k(1, r(0))] },
    { who: 'target', layer: 'head', ms, delay: L, frames: rub(-11 * d, -6 * d, -16 * d) },
    { who: 'actor', layer: 'blush', ms: 1900, delay: L, frames: [o(0, 0), o(0.15, 0), o(0.25, 1), o(0.88, 1), o(1, 0)] },
    { who: 'target', layer: 'blush', ms: 1900, delay: L, frames: [o(0, 0), o(0.18, 0), o(0.28, 1), o(0.9, 1), o(1, 0)] },
    ...waggle('actor', L, ms),
    ...waggle('target', L, ms)
  ];
}

/**
 * A flower, held out a little shyly (UsScene, rig-give) at 0.15: "oh!", a
 * long sniff, and it is theirs - held up beside their face from 0.53.
 */
function flowerMoves(d: number, L: number): Move[] {
  const ms = 1800;
  return [
    { who: 'actor', layer: nearArm(d), ms: 1500, delay: L, frames: away(0.86) },
    { who: 'actor', layer: 'lean', ms, delay: L, frames: [k(0, r(0)), k(0.15, r(6 * d)), k(0.5, r(6 * d)), k(0.62, r(-2 * d)), k(0.75, r(0)), k(1, r(0))] },
    { who: 'actor', layer: 'head', ms, delay: L, frames: [k(0, r(0)), k(0.15, r(-6 * d)), k(0.55, r(-6 * d)), k(0.7, r(0)), k(1, r(0))] },
    { who: 'actor', layer: 'blush', ms: 2200, delay: L, frames: [o(0, 0), o(0.05, 0), o(0.14, 1), o(0.85, 1), o(1, 0)] },
    { who: 'target', layer: 'lean', ms, delay: L, frames: [k(0, r(0)), k(0.2, r(0)), k(0.3, r(-6 * d)), k(0.48, r(-6 * d)), k(0.58, r(0)), k(1, r(0))] },
    {
      who: 'target',
      layer: 'squash',
      ms,
      delay: L,
      frames: [k(0, sc(1)), k(0.15, sc(1)), k(0.18, sc(0.95, 1.05)), k(0.24, sc(1)), k(0.3, sc(1)), k(0.42, sc(0.97, 1.05)), k(0.5, sc(1.03, 0.97)), k(0.58, sc(1)), k(1, sc(1))]
    },
    { who: 'target', layer: 'head', ms, delay: L, frames: [k(0, r(0)), k(0.5, r(0)), k(0.6, r(-8 * d)), k(0.9, r(-8 * d)), k(1, r(0))] },
    { who: 'target', layer: nearArm(-d), ms: 2300, delay: L, frames: [k(0, r(0)), k(0.4, r(0)), k(0.46, r(70 * d)), k(0.9, r(70 * d)), k(1, r(0))] },
    { who: 'target', layer: 'blush', ms: 2300, delay: L, frames: [o(0, 0), o(0.4, 0), o(0.48, 1), o(0.9, 1), o(1, 0)] }
  ];
}

/** Both crouch, jump and smack palms (UsScene, rig-high5) at 0.26 - 420 ms - and land. */
function highFiveMoves(d: number, L: number): Move[] {
  const ms = 1600;
  const one = (who: Role, toward: number): Move[] => [
    { who, layer: nearArm(toward), ms, delay: L, frames: away(0.68) },
    {
      who,
      layer: 'hop',
      ms,
      delay: L,
      frames: [k(0, up(0)), k(0.14, up(0), RISE), k(0.27, up(-7), FALL), k(0.42, up(0), RISE), k(0.48, up(-1.5), FALL), k(0.54, up(0)), k(1, up(0))]
    },
    {
      who,
      layer: 'squash',
      ms,
      delay: L,
      frames: [k(0, sc(1)), k(0.12, sc(1.08, 0.92)), k(0.18, sc(0.94, 1.07)), k(0.27, sc(1.02, 0.98)), k(0.42, sc(1.08, 0.92)), k(0.5, sc(0.98, 1.02)), k(0.6, sc(1)), k(1, sc(1))]
    },
    { who, layer: 'shadow', ms, delay: L, frames: [k(0, sc(1)), k(0.14, sc(1)), k(0.27, sc(0.7)), k(0.42, sc(1)), k(1, sc(1))] },
    { who, layer: 'lean', ms, delay: L, frames: [k(0, r(0)), k(0.12, r(-3 * toward)), k(0.26, r(7 * toward)), k(0.36, r(4 * toward)), k(0.55, r(0)), k(1, r(0))] },
    ...flop(who, L, 0.42, toward, ms, 10)
  ];
  return [...one('actor', d), ...one('target', -d)];
}

/**
 * A water balloon: wound up and lobbed like a pillow, bursting on their head
 * at 790 ms - squashed, soaked - and shaken off like a wet puppy.
 */
function balloonMoves(d: number): Move[] {
  const hit = FIRST_RELEASE + FLIGHT_MS;
  const ms = 1400;
  const shakeAt = [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.66, 0.72, 0.8];
  const shakeBy = [-11, 11, -11, 11, -9, 8, -5, 3, 0];
  const shook = (by: number): Keyframe[] => [k(0, r(0)), k(0.3, r(0)), ...shakeAt.map((at, i) => k(at, r(shakeBy[i] * by))), k(1, r(0))];
  const ear = (side: 1 | -1): Keyframe[] => [
    k(0, r(0)),
    k(0.04, r(-20 * side)),
    k(0.14, r(8 * side)),
    k(0.3, r(0)),
    ...shakeAt.map((at, i) => k(at, r(shakeBy[i] * -2.2))),
    k(1, r(0))
  ];
  return [
    ...throwUp(d),
    {
      who: 'target',
      layer: 'squash',
      ms,
      delay: hit,
      frames: [k(0, sc(1)), k(0.04, sc(1.12, 0.86)), k(0.14, sc(0.95, 1.05)), k(0.24, sc(1.02, 0.98)), k(0.32, sc(1)), k(1, sc(1))]
    },
    { who: 'target', layer: 'hop', ms, delay: hit, frames: [k(0, shove(0, 0)), k(0.04, shove(0, 2)), k(0.16, shove(0, 0)), k(1, shove(0, 0))] },
    { who: 'target', layer: 'lean', ms, delay: hit, frames: shook(1) },
    { who: 'target', layer: 'head', ms, delay: hit, frames: shook(-0.7) },
    { who: 'target', layer: 'earL', ms, delay: hit, frames: ear(1) },
    { who: 'target', layer: 'earR', ms, delay: hit, frames: ear(-1) }
  ];
}

/**
 * Teasing: paws waggling beside the face, tongue out, a buzzing raspberry -
 * and they puff up in a huff at 700 ms, arms crossed, turned away, and then
 * roll their eyes.
 */
function teaseMoves(d: number): Move[] {
  const ms = 1900;
  const paws = (side: 1 | -1): Keyframe[] => [
    k(0, r(0)),
    k(0.1, r(120 * side)),
    ...[0.16, 0.22, 0.28, 0.34, 0.4, 0.46, 0.52, 0.58].map((at, i) => k(at, r((i % 2 ? 130 : 110) * side))),
    k(0.66, r(120 * side)),
    k(0.78, r(0)),
    k(1, r(0))
  ];
  const buzz = [0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26, 0.29].map((at, i) => k(at, r(i % 2 ? -3 : 3)));
  const laugh = [0.7, 0.75, 0.8, 0.85].map((at, i) => k(at, r(i % 2 ? -6 : 6)));
  return [
    { who: 'actor', layer: 'armL', ms, frames: paws(1) },
    { who: 'actor', layer: 'armR', ms, frames: paws(-1) },
    { who: 'actor', layer: 'lean', ms, frames: [k(0, r(0)), k(0.08, r(6 * d)), k(0.32, r(6 * d)), k(0.66, r(4 * d)), k(0.8, r(0)), k(1, r(0))] },
    { who: 'actor', layer: 'head', ms, frames: [k(0, r(0)), k(0.05, r(0)), ...buzz, k(0.32, r(0)), k(0.66, r(0)), ...laugh, k(0.92, r(0)), k(1, r(0))] },
    {
      who: 'target',
      layer: 'squash',
      ms,
      frames: [k(0, sc(1)), k(0.35, sc(1)), k(0.39, sc(1.07, 0.94)), k(0.45, sc(1.04, 0.97)), k(0.85, sc(1.04, 0.97)), k(0.95, sc(1)), k(1, sc(1))]
    },
    { who: 'target', layer: 'hop', ms, frames: [k(0, up(0)), k(0.35, up(0), RISE), k(0.4, up(-3), FALL), k(0.46, up(0)), k(1, up(0))] },
    { who: 'target', layer: 'lean', ms, frames: [k(0, r(0)), k(0.36, r(0)), k(0.44, r(5 * d)), k(0.88, r(5 * d)), k(1, r(0))] },
    { who: 'target', layer: 'head', ms, frames: [k(0, r(0)), k(0.36, r(0)), k(0.44, r(10 * d)), k(0.86, r(10 * d)), k(1, r(0))] },
    { who: 'target', layer: 'armL', ms, frames: [k(0, r(0)), k(0.36, r(0)), k(0.42, r(-60)), k(0.88, r(-60)), k(1, r(0))] },
    { who: 'target', layer: 'armR', ms, frames: [k(0, r(0)), k(0.36, r(0)), k(0.42, r(60)), k(0.88, r(60)), k(1, r(0))] },
    {
      who: 'target',
      layer: 'stretch',
      ms,
      frames: [k(0, sc(1)), k(0.36, sc(1)), k(0.41, sc(1.08, 0.97)), k(0.84, sc(1.08, 0.97)), k(0.92, sc(1)), k(1, sc(1))]
    }
  ];
}

/**
 * Dancing together to its tune (us-dance): six beats of DANCE_BEAT, a
 * bounce landing on each, swaying toward each other and apart, arms up and
 * swinging.
 */
function danceMoves(d: number, L: number): Move[] {
  const ms = 2200;
  const beat = DANCE_BEAT / ms;
  const one = (who: Role, toward: number): Move[] => {
    const hop: Keyframe[] = [k(0, up(0))];
    const squash: Keyframe[] = [k(0, sc(1))];
    const lean: Keyframe[] = [k(0, r(0))];
    const head: Keyframe[] = [k(0, r(0))];
    const armL: Keyframe[] = [k(0, r(0)), k(0.06, r(115))];
    const armR: Keyframe[] = [k(0, r(0)), k(0.06, r(-115))];
    for (let i = 0; i < 6; i++) {
      const mid = (i + 0.5) * beat;
      const land = (i + 1) * beat;
      const side = i % 2 ? -1 : 1;
      hop.push(k(mid, up(-4), FALL), k(land, up(0), RISE));
      squash.push(k(mid, sc(0.97, 1.03)), k(land, sc(1.05, 0.95)));
      lean.push(k(mid, r(8 * side * toward)));
      head.push(k(mid, r(-5 * side * toward)));
      armL.push(k(mid, r(i % 2 ? 100 : 135)));
      armR.push(k(mid, r(i % 2 ? -135 : -100)));
    }
    hop.push(k(1, up(0)));
    squash.push(k(1, sc(1)));
    lean.push(k(1, r(0)));
    head.push(k(1, r(0)));
    armL.push(k(1, r(0)));
    armR.push(k(1, r(0)));
    return [
      { who, layer: 'hop', ms, delay: L, frames: hop },
      { who, layer: 'squash', ms, delay: L, frames: squash },
      { who, layer: 'lean', ms, delay: L, frames: lean },
      { who, layer: 'head', ms, delay: L, frames: head },
      { who, layer: 'armL', ms, delay: L, frames: armL },
      { who, layer: 'armR', ms, delay: L, frames: armR },
      ...waggle(who, L, ms, 10)
    ];
  };
  return [...one('actor', d), ...one('target', -d)];
}

/**
 * Tucking them in: a blanket lifted over (UsScene, rig-blanket) as they
 * yawn, laid down at 0.35 (900 ms), and they nod off, breathing slowly.
 */
function tuckMoves(d: number, L: number): Move[] {
  const ms = 2600;
  const lift = (side: 1 | -1): Keyframe[] => [k(0, r(0)), k(0.12, r(125 * side)), k(0.24, r(125 * side)), k(0.34, r(60 * side)), k(0.42, r(25 * side)), k(0.56, r(0)), k(1, r(0))];
  return [
    { who: 'actor', layer: 'armL', ms, delay: L, frames: lift(1) },
    { who: 'actor', layer: 'armR', ms, delay: L, frames: lift(-1) },
    { who: 'actor', layer: 'lean', ms, delay: L, frames: [k(0, r(0)), k(0.2, r(-3 * d)), k(0.34, r(9 * d)), k(0.48, r(6 * d)), k(0.62, r(0)), k(1, r(0))] },
    { who: 'actor', layer: 'hop', ms, delay: L, frames: [k(0, up(0)), k(0.12, up(-2)), k(0.26, up(-2)), k(0.36, up(0)), k(1, up(0))] },
    {
      who: 'target',
      layer: 'squash',
      ms: 2900,
      delay: L,
      frames: [k(0, sc(1)), k(0.08, sc(1)), k(0.16, sc(0.96, 1.05)), k(0.26, sc(0.97, 1.04)), k(0.31, sc(1.04, 0.96)), k(0.36, sc(1)), k(0.5, sc(1.02, 0.98)), k(0.62, sc(1)), k(0.74, sc(1.02, 0.98)), k(0.86, sc(1)), k(1, sc(1))]
    },
    {
      who: 'target',
      layer: 'head',
      ms: 2900,
      delay: L,
      frames: [k(0, r(0)), k(0.08, r(0)), k(0.16, r(5 * d)), k(0.26, r(4 * d)), k(0.32, r(0)), k(0.42, r(-9 * d)), k(0.9, r(-9 * d)), k(1, r(0))]
    },
    ...flop('target', L, 0.31, d, 2900, 8)
  ];
}

/** When, in the bonk, the pillow lands. */
const BONK_AT = 0.07 * 1300;

/**
 * One pillow: let go `release` ms in, landing FLIGHT_MS later. The first of
 * a run is wound up over the head and swung; every one after it - another
 * tap while pillows are still flying - is a quick flick timed to its own
 * let-go, so a run of them comes out as one smooth flurry.
 */
export function pillowMoves(d: number, release: number, first: boolean): Move[] {
  const hit = release + FLIGHT_MS - BONK_AT;
  const flick = 240;
  const throwing: Move[] = first
    ? throwUp(d)
    : [
        // Forward at 55% - the let-go.
        { who: 'actor', layer: 'lean', ms: flick, delay: release - flick * 0.55, frames: [k(0, r(2 * d)), k(0.3, r(-6 * d)), k(0.55, r(11 * d)), k(1, r(2 * d))] },
        {
          who: 'actor',
          layer: 'squash',
          ms: flick,
          delay: release - flick * 0.55,
          frames: [k(0, sc(1)), k(0.3, sc(1.05, 0.95)), k(0.55, sc(0.95, 1.05)), k(1, sc(1))]
        },
        { who: 'actor', layer: 'armL', ms: flick, delay: release - flick * 0.55, frames: [k(0, r(40)), k(0.3, r(125)), k(0.6, r(45)), k(1, r(40))] },
        { who: 'actor', layer: 'armR', ms: flick, delay: release - flick * 0.55, frames: [k(0, r(-40)), k(0.3, r(-125)), k(0.6, r(-45)), k(1, r(-40))] }
      ];
  const moves: Move[] = [
    ...throwing,
    // Bonk: knocked back, squashed flat, bouncing up dizzy.
    {
      who: 'target',
      layer: 'head',
      ms: 1300,
      delay: hit,
      frames: [
        k(0, tilt(0, 0)),
        k(0.07, tilt(0, 0)),
        k(0.16, tilt(18 * d, 5 * d)),
        k(0.32, tilt(-9 * d, -1 * d)),
        k(0.48, tilt(5 * d, 0)),
        k(0.64, tilt(-2 * d, 0)),
        k(0.8, tilt(0, 0)),
        k(1, tilt(0, 0))
      ]
    },
    {
      who: 'target',
      layer: 'squash',
      ms: 1300,
      delay: hit,
      frames: [k(0, sc(1)), k(0.07, sc(1)), k(0.14, sc(1.16, 0.8)), k(0.28, sc(0.94, 1.07)), k(0.42, sc(1.03, 0.97)), k(0.56, sc(1)), k(1, sc(1))]
    },
    {
      who: 'target',
      layer: 'hop',
      ms: 1300,
      delay: hit,
      frames: [k(0, shove(0, 0)), k(0.07, shove(0, 0)), k(0.17, shove(5 * d, -3)), k(0.36, shove(0, 0)), k(1, shove(0, 0))]
    },
    { who: 'target', layer: 'shadow', ms: 1300, delay: hit, frames: [k(0, sc(1)), k(0.07, sc(1)), k(0.17, sc(0.85)), k(0.36, sc(1)), k(1, sc(1))] }
  ];
  for (const ear of ['earL', 'earR'] as const) {
    moves.push({
      who: 'target',
      layer: ear,
      ms: 1300,
      delay: hit,
      frames: [k(0, r(0)), k(0.07, r(0)), k(0.18, r(-26 * d)), k(0.32, r(18 * d)), k(0.46, r(-10 * d)), k(0.6, r(5 * d)), k(0.74, r(-2 * d)), k(1, r(0))]
    });
  }
  return moves;
}

/** Plays moves on the two of them; what is running, so it can be stopped. */
export function perform(moves: Move[], cast: { actor?: RigLayers; target: RigLayers }): Animation[] {
  const running: Animation[] = [];
  for (const m of moves) {
    const el = (m.who === 'actor' ? cast.actor : cast.target)?.[m.layer];
    if (!el || typeof el.animate !== 'function') continue;
    running.push(el.animate(m.frames, { duration: m.ms, delay: m.delay ?? 0, easing: 'linear', fill: 'none' }));
  }
  return running;
}
