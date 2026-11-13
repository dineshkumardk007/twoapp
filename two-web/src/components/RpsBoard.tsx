import React, { useEffect, useMemo, useRef, useState } from 'react';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { RPS_TO_WIN, playRps, type RpsRound } from '../core/paperGames';
import { playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import { wearOf } from '../core/wear';
import type { Mood } from './StickerArt';
import type { BoardProps } from './GameBoards';
import { BOX, FUR, JOINTS, Rig, at, type RigKind, type RigLayers } from './UsRig';

// Rock Paper Scissors on Canvas of Us (core/paperGames has the rules).
//
// The bear and the bunny of "Us two", in their own outfits, face each other -
// you always on the left. A round is played out the way it is in a
// playground: both paws pump three times to "rock, paper, scissors", come
// down on "shoot!" as the shapes, and then the winning shape does what it
// does to the other one - a rock comes down on scissors and flattens whoever
// threw them, paper flies across and wraps the other one up, scissors snip
// paper in half. Everything moves by the browser's own animations, on parts
// drawn once.

const INK = '#3b2723';
const ROCK = 0;
const PAPER = 1;
const SCISSORS = 2;
const SHAPES = ['Rock', 'Paper', 'Scissors'] as const;
const SHAPE_EMOJI = ['🪨', '📄', '✂️'] as const;
const BEATS_LINE = ['Rock smashes Scissors!', 'Paper wraps Rock!', 'Scissors cut Paper!'] as const;

/** One pump of the paws, and when the shapes come down. */
const BEAT_MS = 430;
const SHOOT_AT = BEAT_MS * 3;
/** When the winning shape does its thing, and when the round is over. */
const ACT_AT = SHOOT_AT + 520;
const DONE_AT = ACT_AT + 2050;
const TIE_DONE_AT = ACT_AT + 1300;

/** The stage, in its own units; and where each of you stands on it. */
const SW = 360;
const SH = 240;
const LEFT_X = 104;
const RIGHT_X = 256;
const FEET_Y = 214;
/** How tall a character is drawn, in stage units, for its whole box. */
const RIG_H = 150;
const K = RIG_H / BOX.h;
const HEAD_Y = FEET_Y - (67 - 0) * K;
/** The throwing arm: from the shoulder to the middle of the paw, in the character's units. */
const ARM_LEN = 27;
const pct = (x: number, y: number): React.CSSProperties => ({ left: `${(x / SW) * 100}%`, top: `${(y / SH) * 100}%` });

/** Where a paw is, held straight out, on the stage: for the bursts and the bits that fly from it. */
function pawAt(side: 'left' | 'right', kind: RigKind): [number, number] {
  const [sx, sy] = JOINTS[kind].shoulder;
  const cx = side === 'left' ? LEFT_X : RIGHT_X;
  const d = side === 'left' ? 1 : -1;
  return [cx + d * (sx + ARM_LEN + 4) * K, HEAD_Y + sy * K];
}

const SNAP = 'cubic-bezier(0.2, 0.85, 0.25, 1)';
const SLAM = 'cubic-bezier(0.6, 0, 0.9, 0.4)';
function run(el: Element | null | undefined, frames: Keyframe[], ms: number, delay = 0, fill: FillMode = 'none') {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return;
  (el as HTMLElement).animate(frames, { duration: ms, delay, easing: 'linear', fill });
}

/**
 * A paw as a shape, drawn pointing right with its middle at (0, 0): a fist
 * (which is rock), a flat open paw (paper), or two fingers out (scissors).
 * `blades` holds the two scissor fingers, so they can be snipped.
 */
const Paw: React.FC<{ shape: number | null; fur: string; blades?: React.MutableRefObject<[SVGGElement | null, SVGGElement | null]> }> = ({ shape, fur, blades }) => {
  const line = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  if (shape === PAPER) {
    return (
      <g>
        {/* Four fingers, spread a little, and the thumb up. */}
        {[-9, -3, 3, 9].map((y, i) => (
          <rect key={i} x={2} y={y - 2.6} width={i === 0 || i === 3 ? 13 : 15} height={5.4} rx={2.7} fill={fur} {...line} transform={`rotate(${(i - 1.5) * 5} 2 ${y})`} />
        ))}
        <ellipse cx={-1} cy={0} rx={9} ry={11.5} fill={fur} {...line} />
        <path d="M-4,-10 C-4,-17 2,-20 5,-16" fill={fur} {...line} />
        <ellipse cx={-1.5} cy={1} rx={4.6} ry={6} fill="#f6b8c4" opacity={0.75} />
      </g>
    );
  }
  if (shape === SCISSORS) {
    return (
      <g>
        <g ref={el => blades && (blades.current[0] = el)} style={{ transformBox: 'view-box', transformOrigin: '0px 0px' } as React.CSSProperties}>
          <rect x={1} y={-7.6} width={19} height={5.6} rx={2.8} fill={fur} {...line} transform="rotate(-14 1 -4.8)" />
        </g>
        <g ref={el => blades && (blades.current[1] = el)} style={{ transformBox: 'view-box', transformOrigin: '0px 0px' } as React.CSSProperties}>
          <rect x={1} y={2} width={19} height={5.6} rx={2.8} fill={fur} {...line} transform="rotate(14 1 4.8)" />
        </g>
        <circle cx={-1} cy={0} r={9.5} fill={fur} {...line} />
        <path d="M-6,3 q4,3 8,0" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    );
  }
  // A fist: the round of it, the knuckles, a thumb across.
  return (
    <g>
      <path d="M-9,-8 C-4,-12 7,-12 10,-6 C13,-1 12,7 8,10 C3,13 -6,12 -9,7 C-11,3 -11,-4 -9,-8 Z" fill={fur} {...line} />
      <path d="M6,-7 V7 M2,-9 V-3 M2,3 V9" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
      <path d="M-6,-3 C-1,-5 4,-4 5,-1" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      {shape === ROCK && <path d="M-4,8 l3,-2 M3,-11 l2,2" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.6} strokeLinecap="round" />}
    </g>
  );
};

/** A paw's shape for the buttons and the game's card: a small picture of it. */
const ShapeIcon: React.FC<{ shape: number; size?: number }> = ({ shape, size = 44 }) => (
  <svg viewBox="-22 -18 44 36" width={size} height={size * (36 / 44)} aria-hidden="true">
    <g transform="scale(1.25)">
      <Paw shape={shape} fur="#c98a55" />
    </g>
  </svg>
);

/** The game's picture, for its card among the games and its empty board. */
export const RpsIcon: React.FC = () => (
  <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
    <defs>
      <linearGradient id="rps-icon-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fde68a" />
        <stop offset="1" stopColor="#fb7185" />
      </linearGradient>
    </defs>
    <rect x={1.5} y={1.5} width={57} height={57} rx={10} fill="url(#rps-icon-bg)" stroke="#3b2723" strokeWidth={2.4} />
    <g transform="translate(17 20) scale(0.95)">
      <Paw shape={ROCK} fur="#c98a55" />
    </g>
    <g transform="translate(43 21) scale(-0.95 0.95)">
      <Paw shape={PAPER} fur="#fbf5ee" />
    </g>
    <g transform="translate(30 43) rotate(-90) scale(0.95)">
      <Paw shape={SCISSORS} fur="#f3d9b5" />
    </g>
  </svg>
);

interface ArmParts {
  arm: HTMLDivElement | null;
  paw: SVGGElement | null;
  blades: [SVGGElement | null, SVGGElement | null];
}

/** The arm that throws, out toward the other one from its shoulder, with the paw at its end. */
const ThrowArm: React.FC<{ kind: RigKind; d: 1 | -1; shape: number | null; parts: React.MutableRefObject<ArmParts> }> = ({ kind, d, shape, parts }) => {
  const [sx, sy] = JOINTS[kind].shoulder;
  const fur = FUR[kind];
  const blades = useRef<[SVGGElement | null, SVGGElement | null]>([null, null]);
  parts.current.blades = blades.current;
  return (
    <div ref={el => (parts.current.arm = el)} className="rig-l rps-arm" style={{ transformOrigin: at(sx * d, sy), transform: `rotate(${-12 * d}deg)` }}>
      <svg viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`} className="rig-art" overflow="visible" aria-hidden="true" focusable="false">
        <g transform={`translate(${sx * d} ${sy}) scale(${d} 1)`}>
          <path d={`M0,0 L${ARM_LEN - 6},0`} stroke={INK} strokeWidth={13} strokeLinecap="round" />
          <path d={`M0,0 L${ARM_LEN - 6},0`} stroke={fur} strokeWidth={8.4} strokeLinecap="round" />
          <g transform={`translate(${ARM_LEN} 0)`}>
            <g ref={el => (parts.current.paw = el)} style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties}>
              <Paw shape={shape} fur={fur} blades={blades} />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};

/** What is happening on the stage right now. */
type Act = 'idle' | 'pump' | 'shown' | 'result';
interface Fx {
  key: number;
  kind: 'smash' | 'clash' | 'wrap' | 'snip' | 'stars' | 'sparkle' | 'bits' | 'tufts' | 'halves';
  x: number;
  y: number;
  /** Which way it goes: toward the right (1) or the left (-1). */
  d?: 1 | -1;
}

const noArm = (): ArmParts => ({ arm: null, paw: null, blades: [null, null] });

export const RpsBoard: React.FC<BoardProps> = React.memo(({ game, me, inkOf, canAct, onMove, onSettled, partnerName }) => {
  const tr = useT();
  const them: Seat = me === 'user' ? 'partner' : 'user';
  const s = useMemo(() => playRps(game), [game]);
  const done = s.rounds.length;
  const mine = game.picks?.[me] || [];
  const theirs = game.picks?.[them] || [];
  const leftKind: RigKind = me === 'user' ? 'bear' : 'bunny';
  const rightKind: RigKind = leftKind === 'bear' ? 'bunny' : 'bear';

  /** How many rounds have been played out on this screen. */
  const [shown, setShown] = useState(done);
  const [act, setAct] = useState<Act>('idle');
  const [word, setWord] = useState<{ key: number; text: string; big?: boolean } | null>(null);
  const [shapes, setShapes] = useState<[number | null, number | null]>([null, null]);
  const [moods, setMoods] = useState<[Mood, Mood]>(['smile', 'smile']);
  const [verdict, setVerdict] = useState<{ key: number; text: string; tone: 'win' | 'lose' | 'tie' } | null>(null);
  const [fx, setFx] = useState<Fx[]>([]);
  const [wrapped, setWrapped] = useState<'left' | 'right' | null>(null);

  const rigs = [useRef<RigLayers>({}), useRef<RigLayers>({})] as const;
  const arms = [useRef<ArmParts>(noArm()), useRef<ArmParts>(noArm())] as const;
  const stage = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const idRef = useRef(game.id);
  const shownRef = useRef(done);
  const running = useRef(false);
  const stateRef = useRef(s);
  stateRef.current = s;
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const addFx = (one: Omit<Fx, 'key'>, life = 1600) => {
    const key = Date.now() + Math.random();
    setFx(list => [...list, { ...one, key }]);
    later(life, () => setFx(list => list.filter(f => f.key !== key)));
  };
  const stopAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    for (const r of rigs) for (const el of Object.values(r.current)) el?.getAnimations?.().forEach(a => a.cancel());
    for (const a of arms) {
      for (const el of [a.current.arm, a.current.paw, ...a.current.blades]) el?.getAnimations?.().forEach(x => x.cancel());
    }
  };
  const shake = (hard: number) =>
    stage.current?.animate?.(
      [
        { transform: 'translate3d(0, 0, 0)' },
        { transform: `translate3d(${(3 + hard * 6).toFixed(1)}px, ${(-2 - hard * 4).toFixed(1)}px, 0)` },
        { transform: `translate3d(${(-3 - hard * 4).toFixed(1)}px, ${(2 + hard * 2).toFixed(1)}px, 0)` },
        { transform: `translate3d(${(2 + hard * 2).toFixed(1)}px, -1px, 0)` },
        { transform: 'translate3d(0, 0, 0)' }
      ],
      { duration: 260 + hard * 160, easing: 'ease-out' }
    );

  /** One round, played out: the count, the shapes, and what the winning one does. */
  const play = (round: RpsRound, index: number) => {
    running.current = true;
    const pick: [number, number] = [round[me], round[them]];
    const winner = round.winner === null ? -1 : round.winner === me ? 0 : 1;
    const sides = ['left', 'right'] as const;

    // The count: three pumps, the words, a beat each.
    setAct('pump');
    setShapes([null, null]);
    setVerdict(null);
    setWrapped(null);
    setMoods(['tight', 'tight']);
    const pumpFrames = (d: 1 | -1): Keyframe[] => [
      { offset: 0, transform: `rotate(${-12 * d}deg)`, easing: SNAP },
      ...[0, 1, 2].flatMap(i => [
        { offset: (i + 0.42) / 3, transform: `rotate(${-68 * d}deg)`, easing: SLAM },
        { offset: (i + 0.92) / 3, transform: `rotate(${14 * d}deg)`, easing: SNAP }
      ]),
      { offset: 1, transform: 'rotate(0deg)' }
    ];
    arms.forEach((a, i) => run(a.current.arm, pumpFrames(i === 0 ? 1 : -1), SHOOT_AT, 0, 'forwards'));
    rigs.forEach(r =>
      run(
        r.current.hop,
        ([0, 1, 2].flatMap(i => [
          { offset: i / 3, transform: 'translateY(0)', easing: SNAP },
          { offset: (i + 0.9) / 3, transform: 'translateY(3%)', easing: SNAP }
        ]) as Keyframe[]).concat([{ offset: 1, transform: 'translateY(0)' }]),
        SHOOT_AT
      )
    );
    ['Rock…', 'Paper…', 'Scissors…'].forEach((w, i) =>
      later(i * BEAT_MS + BEAT_MS * 0.8, () => {
        setWord({ key: Date.now() + i, text: w });
        playSound('g-rps-beat', { rate: 1 + i * 0.06 });
        haptic('tick');
      })
    );

    // Shoot: the shapes.
    later(SHOOT_AT, () => {
      setAct('shown');
      setShapes(pick);
      setWord({ key: Date.now(), text: 'Shoot!', big: true });
      playSound('g-rps-shoot');
      haptic('confirm');
      arms.forEach(a =>
        run(
          a.current.paw,
          [
            { offset: 0, transform: 'scale(0.5)', easing: 'cubic-bezier(0.3, 1.8, 0.5, 1)' },
            { offset: 0.6, transform: 'scale(1.35)', easing: SNAP },
            { offset: 1, transform: 'scale(1)' }
          ],
          380
        )
      );
      setMoods(winner < 0 ? ['shock', 'shock'] : ['think', 'think']);
    });

    later(ACT_AT - 120, () => {
      setWord(null);
      setVerdict({
        key: Date.now(),
        text: winner < 0 ? 'Same shape. Again!' : BEATS_LINE[pick[winner as 0 | 1] as 0 | 1 | 2],
        tone: winner < 0 ? 'tie' : winner === 0 ? 'win' : 'lose'
      });
    });

    if (winner < 0) {
      // Both the same: the paws clash, sparks, and both are knocked back a step.
      later(ACT_AT, () => {
        setAct('result');
        arms.forEach((a, i) =>
          run(
            a.current.arm,
            [
              { offset: 0, transform: 'rotate(0deg) translateX(0)', easing: SLAM },
              { offset: 0.35, transform: `rotate(0deg) translateX(${i === 0 ? 9 : -9}%)`, easing: SNAP },
              { offset: 1, transform: 'rotate(0deg) translateX(0)' }
            ],
            520
          )
        );
        later(180, () => {
          addFx({ kind: 'clash', x: (LEFT_X + RIGHT_X) / 2, y: pawAt('left', leftKind)[1] });
          playSound('g-rps-tie');
          shake(0.3);
          haptic('tick');
          rigs.forEach((r, i) =>
            run(
              r.current.lean,
              [
                { offset: 0, transform: 'rotate(0deg)', easing: SNAP },
                { offset: 0.3, transform: `rotate(${i === 0 ? -10 : 10}deg)`, easing: SNAP },
                { offset: 1, transform: 'rotate(0deg)' }
              ],
              600
            )
          );
        });
        later(700, () => setMoods(['puppy', 'puppy']));
      });
    } else {
      const w = winner as 0 | 1;
      const l = (1 - w) as 0 | 1;
      const wd: 1 | -1 = w === 0 ? 1 : -1;
      const loserX = l === 0 ? LEFT_X : RIGHT_X;
      const loserPaw = pawAt(sides[l], l === 0 ? leftKind : rightKind);
      const winnerPaw = pawAt(sides[w], w === 0 ? leftKind : rightKind);
      const shape = pick[w];
      later(ACT_AT, () => setAct('result'));

      if (shape === ROCK) {
        // The fist goes up high, and comes down on the other one.
        run(
          arms[w].current.arm,
          [
            { offset: 0, transform: 'rotate(0deg) translateX(0)', easing: SNAP },
            { offset: 0.42, transform: `rotate(${-100 * wd}deg) translateX(0)`, easing: SLAM },
            { offset: 0.62, transform: `rotate(${38 * wd}deg) translateX(${26 * wd}%)`, easing: SNAP },
            { offset: 0.82, transform: `rotate(${30 * wd}deg) translateX(${22 * wd}%)`, easing: SNAP },
            { offset: 1, transform: 'rotate(0deg) translateX(0)' }
          ],
          900,
          ACT_AT
        );
        run(
          arms[w].current.paw,
          [
            { offset: 0, transform: 'scale(1)' },
            { offset: 0.4, transform: 'scale(1.7)' },
            { offset: 0.62, transform: 'scale(1.9)' },
            { offset: 1, transform: 'scale(1)' }
          ],
          900,
          ACT_AT
        );
        const hit = ACT_AT + 560;
        later(hit, () => {
          playSound('g-rps-rock');
          haptic('confirm');
          shake(1);
          addFx({ kind: 'smash', x: loserX, y: HEAD_Y - 18 * K });
          addFx({ kind: 'bits', x: loserPaw[0], y: loserPaw[1], d: (l === 0 ? -1 : 1) as 1 | -1 });
          addFx({ kind: 'stars', x: loserX, y: HEAD_Y - 42 * K }, 1900);
          setMoods(m => (l === 0 ? ['dead', m[1]] : [m[0], 'dead']));
        });
        // Squashed flat, and springing slowly back.
        run(
          rigs[l].current.squash,
          [
            { offset: 0, transform: 'scale(1, 1)', easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)' },
            { offset: 0.08, transform: 'scale(1.38, 0.5)' },
            { offset: 0.62, transform: 'scale(1.32, 0.56)', easing: 'cubic-bezier(0.3, 1.8, 0.5, 1)' },
            { offset: 0.8, transform: 'scale(0.92, 1.1)', easing: SNAP },
            { offset: 1, transform: 'scale(1, 1)' }
          ],
          1450,
          hit
        );
        // Its own arm knocked down with it.
        run(arms[l].current.arm, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${55 * -wd}deg)` }], 200, hit, 'forwards');
      } else if (shape === PAPER) {
        // The paper leaves the paw, flies over, and wraps the other one up.
        run(
          arms[w].current.arm,
          [
            { offset: 0, transform: 'rotate(0deg)', easing: SNAP },
            { offset: 0.3, transform: `rotate(${-30 * wd}deg)`, easing: SLAM },
            { offset: 0.55, transform: `rotate(${10 * wd}deg) translateX(${10 * wd}%)`, easing: SNAP },
            { offset: 1, transform: 'rotate(0deg)' }
          ],
          700,
          ACT_AT
        );
        later(ACT_AT + 220, () => {
          playSound('g-rps-paper');
          addFx({ kind: 'wrap', x: winnerPaw[0], y: winnerPaw[1], d: wd }, 2000);
        });
        later(ACT_AT + 640, () => {
          setWrapped(sides[l]);
          haptic('confirm');
          setMoods(m => (l === 0 ? ['shock', m[1]] : [m[0], 'shock']));
        });
        // Wriggling inside it.
        run(
          rigs[l].current.lean,
          [
            { offset: 0, transform: 'rotate(0deg)' },
            ...[0, 1, 2, 3, 4, 5].map(i => ({ offset: (i + 1) / 7, transform: `rotate(${i % 2 ? 7 : -7}deg)` })),
            { offset: 1, transform: 'rotate(0deg)' }
          ],
          1100,
          ACT_AT + 700
        );
        later(ACT_AT + 1720, () => {
          setWrapped(null);
          addFx({ kind: 'tufts', x: loserX, y: HEAD_Y, d: 1 }, 1000);
          setMoods(m => (l === 0 ? ['sad', m[1]] : [m[0], 'sad']));
        });
      } else {
        // Scissors: up to the other paw, and snip, snip.
        run(
          arms[w].current.arm,
          [
            { offset: 0, transform: 'rotate(0deg) translateX(0)', easing: SNAP },
            { offset: 0.25, transform: `rotate(${4 * wd}deg) translateX(${30 * wd}%)`, easing: SNAP },
            { offset: 0.8, transform: `rotate(${4 * wd}deg) translateX(${30 * wd}%)`, easing: SNAP },
            { offset: 1, transform: 'rotate(0deg) translateX(0)' }
          ],
          1150,
          ACT_AT
        );
        const [top, bottom] = arms[w].current.blades;
        for (const [blade, sign] of [
          [top, 1],
          [bottom, -1]
        ] as const) {
          run(
            blade,
            ([0, 1, 2].flatMap(i => [
              { offset: (i * 2) / 6, transform: 'rotate(0deg)', easing: SLAM },
              { offset: (i * 2 + 1) / 6, transform: `rotate(${12 * sign}deg)`, easing: SNAP }
            ]) as Keyframe[]).concat([{ offset: 1, transform: 'rotate(0deg)' }]),
            720,
            ACT_AT + 300
          );
        }
        later(ACT_AT + 330, () => playSound('g-rps-scissors'));
        later(ACT_AT + 560, () => {
          haptic('confirm');
          shake(0.35);
          addFx({ kind: 'snip', x: loserPaw[0], y: loserPaw[1] });
          addFx({ kind: 'halves', x: loserPaw[0], y: loserPaw[1], d: (l === 0 ? -1 : 1) as 1 | -1 }, 1500);
          setShapes(p => (l === 0 ? [null, p[1]] : [p[0], null]));
          setMoods(m => (l === 0 ? ['shock', m[1]] : [m[0], 'shock']));
        });
        // And a little haircut, for good measure.
        later(ACT_AT + 900, () => {
          addFx({ kind: 'tufts', x: loserX, y: HEAD_Y - 30 * K, d: 1 }, 1300);
          run(
            rigs[l].current.head,
            [
              { offset: 0, transform: 'rotate(0deg)' },
              { offset: 0.25, transform: 'rotate(-9deg)' },
              { offset: 0.5, transform: 'rotate(8deg)' },
              { offset: 0.75, transform: 'rotate(-5deg)' },
              { offset: 1, transform: 'rotate(0deg)' }
            ],
            600
          );
        });
        later(ACT_AT + 1500, () => setMoods(m => (l === 0 ? ['sad', m[1]] : [m[0], 'sad'])));
      }

      // The winner, pleased with themselves: two hops and a sparkle.
      later(ACT_AT + 1150, () => {
        setMoods(m => (w === 0 ? ['laugh', m[1]] : [m[0], 'laugh']));
        addFx({ kind: 'sparkle', x: w === 0 ? LEFT_X : RIGHT_X, y: HEAD_Y - 40 * K }, 1200);
        playSound(w === 0 ? 'g-rps-win' : 'g-rps-lose');
        run(
          rigs[w].current.hop,
          [
            { offset: 0, transform: 'translateY(0)', easing: 'cubic-bezier(0.2, 0.8, 0.4, 1)' },
            { offset: 0.22, transform: 'translateY(-12%)', easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)' },
            { offset: 0.42, transform: 'translateY(0)', easing: 'cubic-bezier(0.2, 0.8, 0.4, 1)' },
            { offset: 0.66, transform: 'translateY(-8%)', easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)' },
            { offset: 0.86, transform: 'translateY(0)' },
            { offset: 1, transform: 'translateY(0)' }
          ],
          820
        );
        run(
          rigs[w].current.squash,
          [
            { offset: 0, transform: 'scale(1.12, 0.88)' },
            { offset: 0.2, transform: 'scale(0.92, 1.1)' },
            { offset: 0.42, transform: 'scale(1.1, 0.9)' },
            { offset: 0.64, transform: 'scale(0.95, 1.06)' },
            { offset: 0.86, transform: 'scale(1.06, 0.94)' },
            { offset: 1, transform: 'scale(1, 1)' }
          ],
          820
        );
      });
    }

    later(winner < 0 ? TIE_DONE_AT : DONE_AT, () => {
      stopAll();
      shownRef.current = index + 1;
      setShown(index + 1);
      setAct('idle');
      setShapes([null, null]);
      setWrapped(null);
      setFx([]);
      setMoods(['smile', 'smile']);
      running.current = false;
      settledRef.current?.(index + 1);
      pump();
    });
  };

  /** Plays out whatever has been decided and not yet shown. */
  const pump = () => {
    if (running.current) return;
    const st = stateRef.current;
    const k = shownRef.current;
    if (k >= st.rounds.length) return;
    play(st.rounds[k], k);
  };
  const pumpRef = useRef(pump);
  pumpRef.current = pump;

  useEffect(() => {
    if (idRef.current !== game.id || done < shownRef.current) {
      // A new game: both standing ready, nothing in the air.
      stopAll();
      running.current = false;
      idRef.current = game.id;
      shownRef.current = done;
      setShown(done);
      setAct('idle');
      setShapes([null, null]);
      setVerdict(null);
      setWrapped(null);
      setFx([]);
      setWord(null);
      setMoods(['smile', 'smile']);
      settledRef.current?.(done);
      return;
    }
    pumpRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, done]);

  useEffect(() => {
    settledRef.current?.(shownRef.current);
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The score as far as it has been played out here.
  const points: Record<Seat, number> = { user: 0, partner: 0 };
  for (const r of s.rounds.slice(0, Math.min(shown, done))) if (r.winner) points[r.winner]++;
  const finished = s.over && shown >= done;
  const myPick = mine.length > done ? mine[done] : null;
  const theyPicked = theirs.length > done;
  const restMoods: [Mood, Mood] = finished ? (s.winner === me ? ['happy', 'sad'] : ['sad', 'happy']) : myPick !== null ? ['smug', theyPicked ? 'smug' : 'think'] : ['smile', theyPicked ? 'smug' : 'think'];
  const shownMoods = act === 'idle' ? restMoods : moods;

  const pips = (seat: Seat) => (
    <span className="rps-pips" style={{ '--ink': inkOf(seat) } as React.CSSProperties}>
      {Array.from({ length: RPS_TO_WIN }, (_, i) => (
        <i key={i} data-on={points[seat] > i || undefined} />
      ))}
    </span>
  );

  const fighter = (side: 'left' | 'right') => {
    const i = side === 'left' ? 0 : 1;
    const kind = i === 0 ? leftKind : rightKind;
    const seat = i === 0 ? me : them;
    const d: 1 | -1 = i === 0 ? 1 : -1;
    const cx = i === 0 ? LEFT_X : RIGHT_X;
    const boxW = (BOX.w / BOX.h) * RIG_H;
    const top = HEAD_Y + BOX.y * K;
    return (
      <div
        className="rps-who"
        data-side={side}
        data-wrapped={wrapped === side || undefined}
        data-cheer={(finished && s.winner === seat) || undefined}
        style={{ left: `${((cx - boxW / 2) / SW) * 100}%`, top: `${(top / SH) * 100}%`, width: `${(boxW / SW) * 100}%`, height: `${(RIG_H / SH) * 100}%` }}
      >
        <Rig kind={kind} mood={shownMoods[i]} arms={finished && s.winner === seat ? 'up' : 'down'} phase={i * 2.3} layers={rigs[i]} wear={wearOf(seat)} facing={d}>
          {!(finished && s.winner === seat) && <ThrowArm kind={kind} d={d} shape={shapes[i]} parts={arms[i]} />}
        </Rig>
        {wrapped === side && (
          <svg className="rps-wrapped" viewBox="-50 -50 100 100" aria-hidden="true">
            <path d="M-38,-40 L30,-44 L42,-6 L36,40 L-30,44 L-44,4 Z" fill="#fffdf6" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
            <path d="M-30,-20 L20,-26 M-34,0 L32,-6 M-28,20 L30,16" stroke="#cbd5e1" strokeWidth={2} strokeLinecap="round" />
            <path d="M-10,-44 L-4,-30 M24,30 L30,44 M-44,-14 L-30,-10" stroke={INK} strokeOpacity={0.4} strokeWidth={1.6} strokeLinecap="round" />
          </svg>
        )}
        {act !== 'idle' && act !== 'pump' && shapes[i] !== null && (
          <span className="rps-badge" key={`${shown}-${shapes[i]}`}>
            {SHAPE_EMOJI[shapes[i] as number]}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="rps" style={{ '--me': inkOf(me), '--them': inkOf(them) } as React.CSSProperties}>
      <div className="rps-top">
        <span className="rps-side">
          <b>{tr('You')}</b>
          {pips(me)}
        </span>
        <span className="rps-round">{finished ? tr('Game over') : tr('Round {n}', { n: Math.min(shown, done) + 1 })}</span>
        <span className="rps-side" data-right="">
          {pips(them)}
          <b>{partnerName}</b>
        </span>
      </div>

      <div className="rps-stage" ref={stage}>
        <div className="rps-backdrop" aria-hidden="true">
          <i className="rps-spot" data-side="left" />
          <i className="rps-spot" data-side="right" />
          <i className="rps-floor" />
        </div>
        {fighter('left')}
        {fighter('right')}
        {fx.map(f => (
          <span key={f.key} className="rps-fx" data-kind={f.kind} style={{ ...pct(f.x, f.y), '--d': f.d ?? 1 } as React.CSSProperties} aria-hidden="true">
            {f.kind === 'smash' && <b className="rps-boom">💥</b>}
            {f.kind === 'clash' && (
              <>
                <b className="rps-boom">✨</b>
                {Array.from({ length: 8 }, (_, k) => (
                  <i key={k} className="rps-spark" style={{ '--a': `${k * 45}deg` } as React.CSSProperties} />
                ))}
              </>
            )}
            {f.kind === 'stars' && (
              <span className="rps-dizzy">
                {['⭐', '💫', '⭐'].map((e, k) => (
                  <i key={k} style={{ '--a': `${k * 120}deg` } as React.CSSProperties}>
                    {e}
                  </i>
                ))}
              </span>
            )}
            {f.kind === 'sparkle' && (
              <>
                {Array.from({ length: 6 }, (_, k) => (
                  <i key={k} className="rps-twinkle" style={{ '--a': `${k * 60}deg`, animationDelay: `${k * 60}ms` } as React.CSSProperties}>
                    ✦
                  </i>
                ))}
              </>
            )}
            {f.kind === 'bits' &&
              Array.from({ length: 5 }, (_, k) => <i key={k} className="rps-bit" style={{ '--k': k } as React.CSSProperties} />)}
            {f.kind === 'tufts' &&
              Array.from({ length: 4 }, (_, k) => <i key={k} className="rps-tuft" style={{ '--k': k } as React.CSSProperties} />)}
            {f.kind === 'snip' && <b className="rps-snip">✂️</b>}
            {f.kind === 'halves' && (
              <>
                <i className="rps-half" data-h="1" />
                <i className="rps-half" data-h="2" />
              </>
            )}
            {f.kind === 'wrap' && (
              <svg className="rps-sheet" viewBox="-20 -20 40 40">
                <path d="M-15,-16 L14,-17 L17,-2 L15,16 L-13,17 L-17,2 Z" fill="#fffdf6" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
                <path d="M-11,-7 L10,-9 M-12,1 L12,-1 M-10,9 L11,7" stroke="#cbd5e1" strokeWidth={1.4} strokeLinecap="round" />
              </svg>
            )}
          </span>
        ))}
        {word && (
          <span className="rps-word" data-big={word.big || undefined} key={word.key}>
            {tr(word.text)}
          </span>
        )}
        {verdict && act !== 'idle' && (
          <span className="rps-verdict" data-tone={verdict.tone} key={verdict.key}>
            {tr(verdict.text)}
          </span>
        )}
        {!finished && act === 'idle' && (
          <span className="rps-ready" data-on={theyPicked || undefined}>
            {theyPicked ? tr('{name} is ready', { name: partnerName }) : tr('{name} is choosing', { name: partnerName })}
          </span>
        )}
      </div>

      <div className="rps-picks" role="group" aria-label={tr('Your pick')}>
        {SHAPES.map((name, i) => (
          <button
            key={name}
            type="button"
            className="rps-pick"
            data-on={myPick === i || undefined}
            disabled={!canAct || act !== 'idle'}
            onClick={() => onMove(i)}
            aria-label={tr(name)}
          >
            <ShapeIcon shape={i} />
            <small>{tr(name)}</small>
          </button>
        ))}
      </div>
      <p className="rps-rules">{myPick !== null && !finished ? tr('Locked in: {move}', { move: tr(SHAPES[myPick]) }) : tr('Paper wraps Rock · Scissors cut Paper · Rock smashes Scissors')}</p>
    </div>
  );
});
RpsBoard.displayName = 'RpsBoard';
