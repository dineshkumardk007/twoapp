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
export const NEAR_ACTS: ReadonlySet<Act> = new Set<Act>(['boop', 'tickle', 'pinch', 'pat']);

/** How long each play lasts, once the one doing it is there. */
export const PLAY_MS: Record<Act, number> = {
  boop: 1000,
  tickle: 1750,
  pinch: 1700,
  pat: 1800,
  pillow: 1950,
  giggle: 900
};

/** When the words come up, from the start of the play itself. */
export const SAY_AT: Record<Act, number> = { boop: 240, tickle: 200, pinch: 300, pat: 450, pillow: 800, giggle: 0 };

/** How each one looks as the play goes on: from `at`, until the next. */
export const MOODS: Record<Act, { at: number; target?: Mood; actor?: Mood }[]> = {
  boop: [{ at: 0, actor: 'grin' }, { at: 240, target: 'shock' }, { at: 470, target: 'laugh' }],
  tickle: [{ at: 0, actor: 'grin' }, { at: 160, target: 'laugh' }, { at: 1300, actor: 'laugh' }],
  pinch: [{ at: 0, actor: 'grin' }, { at: 200, target: 'tight' }, { at: 840, target: 'happy', actor: 'love' }],
  pat: [{ at: 0, actor: 'happy' }, { at: 380, target: 'happy' }, { at: 1250, target: 'love' }],
  pillow: [{ at: 0, actor: 'smug' }, { at: 790, target: 'shock', actor: 'laugh' }, { at: 1080, target: 'dead' }],
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

/** When the first pillow of a run is let go, after its wind-up. */
export const FIRST_RELEASE = 430;
/** How long a pillow is in the air. */
export const FLIGHT_MS = 360;
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
    ? [
        { who: 'actor', layer: 'lean', ms: 900, frames: [k(0, r(0)), k(0.37, r(-10 * d)), k(0.5, r(13 * d)), k(0.65, r(9 * d)), k(1, r(0))] },
        {
          who: 'actor',
          layer: 'squash',
          ms: 900,
          frames: [k(0, sc(1)), k(0.37, sc(1.07, 0.93)), k(0.5, sc(0.94, 1.07)), k(0.7, sc(1.01, 0.99)), k(1, sc(1))]
        },
        { who: 'actor', layer: 'armL', ms: 900, frames: [k(0, r(0)), k(0.22, r(130)), k(0.4, r(140)), k(0.52, r(60)), k(1, r(0))] },
        { who: 'actor', layer: 'armR', ms: 900, frames: [k(0, r(0)), k(0.22, r(-130)), k(0.4, r(-140)), k(0.52, r(-60)), k(1, r(0))] }
      ]
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
