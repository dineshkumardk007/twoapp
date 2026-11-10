import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../core/i18n';
import { haptic } from '../core/haptics';
import { playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import {
  BX_BLOCK,
  BX_COST,
  BX_DODGE,
  BX_ENERGY_MAX,
  BX_ENERGY_START,
  BX_HOOK,
  BX_HP,
  BX_JAB,
  BX_UPPER,
  boxingAllowed,
  playBoxing,
  type BxRound,
  type BxWhat
} from '../core/boxing';
import type { BoardProps } from './GameBoards';

// Boxing on Canvas of Us (core/boxing has the rules).
//
// The two of you in a ring, you always on the left. Each boxer is drawn once,
// in pieces - legs, body, head, and an arm for each glove - and a round is
// fought by moving those pieces (the browser's own animations, off the main
// thread): nothing is redrawn while a punch is in the air. What is thrown and
// what it does come from the two picks; this only shows it.

/** The ring, in its own units. */
const W = 400;
const H = 280;
const FLOOR = 234;
const LEFT_X = 128;
const RIGHT_X = 272;
/** An arm, shoulder to the glove's middle, at rest length; and how much of that is forearm showing. */
const ARM = 46;
const FORE = ARM - 22;
/** Where the lead and the rear shoulder sit, from the feet. */
const LEAD = { x: 15, y: -101 };
const REAR = { x: -9, y: -99 };
const HIPS = { x: 0, y: -56 };
const NECK = { x: 5, y: -108 };

/** One exchange, start to settled. */
const FIGHT_MS = 660;
/** When the punches arrive, as a part of that. */
const HIT_AT = 0.36;
const AFTER_MS = 520;
const KO_MS = 1500;

type Arm = [angle: number, reach: number];
interface Pose {
  /** The lead arm (the jab), and the rear one (the big punches). */
  f: Arm;
  b: Arm;
  lean: number;
  head: number;
  x: number;
  y: number;
}
const GUARD: Pose = { f: [-40, 0.7], b: [-66, 0.5], lean: 4, head: 0, x: 0, y: 0 };
type Frame = [at: number, pose: Partial<Pose>];

const MOVES: Frame[][] = [
  // Jab: the lead glove, straight out and back.
  [
    [0, {}],
    [0.14, { f: [-34, 0.56], lean: 0, x: -3 }],
    [HIT_AT, { f: [-19, 1.62], lean: 12, x: 15 }],
    [0.5, { f: [-19, 1.5], lean: 10, x: 13 }],
    [1, {}]
  ],
  // Hook: the rear glove swung round, with the whole body behind it.
  [
    [0, {}],
    [0.18, { b: [-150, 0.8], lean: -11, x: -5 }],
    [HIT_AT, { b: [-21, 1.75], f: [-74, 0.5], lean: 21, x: 19 }],
    [0.54, { b: [14, 1.35], f: [-74, 0.5], lean: 23, x: 19 }],
    [1, {}]
  ],
  // Uppercut: down, and up from the floor.
  [
    [0, {}],
    [0.2, { b: [72, 0.82], lean: 17, y: 11, x: 4 }],
    [HIT_AT, { b: [-16, 1.75], lean: -4, y: -10, x: 36 }],
    [0.56, { b: [-58, 1.4], lean: -7, y: -5, x: 32 }],
    [1, {}]
  ],
  // Block: both gloves up in front of the face.
  [
    [0, {}],
    [0.14, { f: [-64, 0.66], b: [-72, 0.66], lean: -3, head: 7 }],
    [0.72, { f: [-64, 0.66], b: [-72, 0.66], lean: -3, head: 7 }],
    [1, {}]
  ],
  // Dodge: leaning back out of the way.
  [
    [0, {}],
    [0.2, { lean: -27, head: -9, x: -19, f: [-52, 0.6] }],
    [0.58, { lean: -27, head: -9, x: -19, f: [-52, 0.6] }],
    [1, {}]
  ]
];
/** The answer to a punch that missed: a short one from the lead hand, just after. */
const COUNTER: Frame[] = [
  [0, { lean: -20, x: -15 }],
  [0.42, { f: [-19, 1.62], lean: 12, x: 15 }],
  [0.62, { f: [-19, 1.5], lean: 10, x: 13 }],
  [1, {}]
];

interface ArmParts {
  rot: SVGGElement | null;
  fore: SVGGElement | null;
  glove: SVGGElement | null;
}
interface Parts {
  whole: SVGGElement | null;
  torso: SVGGElement | null;
  head: SVGGElement | null;
  f: ArmParts;
  b: ArmParts;
}
const noParts = (): Parts => ({ whole: null, torso: null, head: null, f: { rot: null, fore: null, glove: null }, b: { rot: null, fore: null, glove: null } });

const SNAP = 'cubic-bezier(0.2, 0.85, 0.25, 1)';
// The glove slides out along the arm; the forearm stretches to stay joined to its cuff.
const armCss = (a: Arm) => ({
  rot: `rotate(${a[0]}deg)`,
  fore: `scaleX(${Math.max(0.02, (ARM * a[1] - 22) / FORE).toFixed(3)})`,
  glove: `translateX(${((a[1] - 1) * ARM).toFixed(1)}px)`
});
const REST = armCss(GUARD.f);
const REST_B = armCss(GUARD.b);

function run(el: SVGGElement | null, frames: Keyframe[], ms: number, delay = 0, fill: FillMode = 'none') {
  if (!el || typeof el.animate !== 'function') return;
  el.animate(frames, { duration: ms, delay, easing: 'linear', fill });
}

/** Moves a boxer through a set of poses. */
function act(parts: Parts, frames: Frame[], ms: number, delay = 0) {
  const full = frames.map(([at, p]) => ({ at, pose: { ...GUARD, ...p } }));
  const key = (fn: (p: Pose) => string): Keyframe[] => full.map(({ at, pose }) => ({ offset: at, transform: fn(pose), easing: SNAP }));
  run(parts.whole, key(p => `translate(${p.x}px, ${p.y}px)`), ms, delay);
  run(parts.torso, key(p => `rotate(${p.lean}deg)`), ms, delay);
  run(parts.head, key(p => `rotate(${p.head}deg)`), ms, delay);
  for (const side of ['f', 'b'] as const) {
    run(parts[side].rot, key(p => armCss(p[side]).rot), ms, delay);
    run(parts[side].fore, key(p => armCss(p[side]).fore), ms, delay);
    run(parts[side].glove, key(p => armCss(p[side]).glove), ms, delay);
  }
}

/** Taking one: the head goes back, and the rest follows. `hard` 0 to 1. */
function reel(parts: Parts, hard: number, delay: number, lifted: boolean) {
  const ms = 420 + hard * 160;
  run(
    parts.head,
    [
      { offset: 0, transform: 'rotate(0deg)', easing: SNAP },
      { offset: 0.16, transform: `rotate(${-14 - hard * 20}deg)`, easing: SNAP },
      { offset: 0.5, transform: `rotate(${5 + hard * 4}deg)`, easing: SNAP },
      { offset: 1, transform: 'rotate(0deg)' }
    ],
    ms,
    delay
  );
  run(
    parts.torso,
    [
      { offset: 0, transform: `rotate(${GUARD.lean}deg)`, easing: SNAP },
      { offset: 0.2, transform: `rotate(${-8 - hard * 12}deg)`, easing: SNAP },
      { offset: 1, transform: `rotate(${GUARD.lean}deg)` }
    ],
    ms,
    delay
  );
  run(
    parts.whole,
    [
      { offset: 0, transform: 'translate(0px, 0px)', easing: SNAP },
      { offset: 0.2, transform: `translate(${-7 - hard * 15}px, ${lifted ? -9 : 0}px)`, easing: SNAP },
      { offset: 1, transform: 'translate(0px, 0px)' }
    ],
    ms,
    delay
  );
}

/** A punch on the gloves: a jolt, and no more. */
function jolt(parts: Parts, delay: number) {
  run(
    parts.whole,
    [
      { offset: 0, transform: 'translate(0px, 0px)', easing: SNAP },
      { offset: 0.25, transform: 'translate(-6px, 0px)', easing: SNAP },
      { offset: 1, transform: 'translate(0px, 0px)' }
    ],
    260,
    delay
  );
}

/** Down, and staying down. */
function drop(parts: Parts, delay: number) {
  run(
    parts.whole,
    [
      { offset: 0, transform: 'translate(0px, 0px) rotate(0deg)', easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' },
      { offset: 0.55, transform: 'translate(-26px, -4px) rotate(-78deg)', easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' },
      { offset: 0.72, transform: 'translate(-30px, -10px) rotate(-84deg)', easing: 'ease-in' },
      { offset: 1, transform: 'translate(-30px, -3px) rotate(-88deg)' }
    ],
    620,
    delay,
    'forwards'
  );
}

/** A glove: mitt, thumb, cuff and laces, its middle at the end of the arm. */
const Glove: React.FC<{ ink: string }> = ({ ink }) => (
  <g>
    <rect x={ARM - 25} y={-8} width={11} height={16} rx={3} fill="#fff7ea" stroke="#3b2723" strokeWidth={2.2} />
    <path d={`M${ARM - 15},-11 C${ARM - 6},-15 ${ARM + 13},-14 ${ARM + 14},-1 C${ARM + 15},10 ${ARM + 6},13 ${ARM - 4},12 C${ARM - 10},12 ${ARM - 15},10 ${ARM - 15},6 Z`} fill={ink} stroke="#3b2723" strokeWidth={2.4} strokeLinejoin="round" />
    <path d={`M${ARM - 10},5 C${ARM - 7},12 ${ARM + 3},13 ${ARM + 5},7`} fill={ink} stroke="#3b2723" strokeWidth={2.2} strokeLinecap="round" />
    <path d={`M${ARM - 6},-9 C${ARM + 2},-11 ${ARM + 9},-9 ${ARM + 10},-4`} fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={2.6} strokeLinecap="round" />
    <path d={`M${ARM - 22},-4 h5 M${ARM - 22},0 h5 M${ARM - 22},4 h5`} stroke="#3b2723" strokeOpacity={0.55} strokeWidth={1.2} strokeLinecap="round" />
  </g>
);

interface BoxerProps {
  kind: 'bear' | 'bunny';
  ink: string;
  parts: React.MutableRefObject<Parts>;
  /** Already down when the board opened on a fight that is over. */
  down: boolean;
  hurt: boolean;
}

/** A boxer, facing right, their feet at (0, 0). */
const Boxer: React.FC<BoxerProps> = React.memo(({ kind, ink, parts, down, hurt }) => {
  const fur = kind === 'bear' ? '#c98a55' : '#fbf5ee';
  const shade = kind === 'bear' ? '#a66c3d' : '#e6d9cc';
  const pale = kind === 'bear' ? '#f3d9b5' : '#ffffff';
  const arm = (side: 'f' | 'b', rest: ReturnType<typeof armCss>) => (
    <g transform={`translate(${side === 'f' ? LEAD.x : REAR.x} ${side === 'f' ? LEAD.y : REAR.y})`}>
      <g ref={el => (parts.current[side].rot = el)} style={{ transform: rest.rot }}>
        <g ref={el => (parts.current[side].fore = el)} style={{ transform: rest.fore }}>
          <path d={`M0,0 H${FORE}`} stroke="#3b2723" strokeWidth={15.5} strokeLinecap="round" />
          <path d={`M0,0 H${FORE}`} stroke={side === 'f' ? fur : shade} strokeWidth={11} strokeLinecap="round" />
        </g>
        <g ref={el => (parts.current[side].glove = el)} style={{ transform: rest.glove }}>
          <Glove ink={ink} />
        </g>
      </g>
    </g>
  );
  return (
    <g ref={el => (parts.current.whole = el)} style={down ? { transform: 'translate(-30px, -3px) rotate(-88deg)' } : undefined}>
      <ellipse cx={0} cy={2} rx={34} ry={5.5} fill="#000" opacity={0.22} />
      {/* Legs and boots. */}
      <path d="M-11,-54 L-15,-6 M11,-54 L15,-6" stroke="#3b2723" strokeWidth={17} strokeLinecap="round" />
      <path d="M-11,-54 L-15,-6 M11,-54 L15,-6" stroke={fur} strokeWidth={12.5} strokeLinecap="round" />
      <path d="M-25,-9 h18 q9,0 9,9 h-27 z M5,-9 h18 q9,0 9,9 h-27 z" fill="#2a2440" stroke="#3b2723" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M-23,-5 h14 M7,-5 h14" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.6} strokeLinecap="round" />
      <g transform={`translate(${HIPS.x} ${HIPS.y})`}>
        <g ref={el => (parts.current.torso = el)} style={{ transform: `rotate(${GUARD.lean}deg)` }}>
          <g transform={`translate(${-HIPS.x} ${-HIPS.y})`}>
            {arm('b', REST_B)}
            {/* Body, and the trunks in your colour. */}
            <path d="M-24,-96 C-30,-78 -27,-62 -22,-52 H22 C27,-62 30,-78 24,-96 C14,-106 -14,-106 -24,-96 Z" fill={fur} stroke="#3b2723" strokeWidth={2.6} strokeLinejoin="round" />
            <ellipse cx={3} cy={-78} rx={13} ry={15} fill={pale} opacity={0.9} />
            <path d="M-24,-66 C-26,-52 -25,-42 -23,-36 H-1 L0,-46 L1,-36 H23 C25,-42 26,-52 24,-66 Z" fill={ink} stroke="#3b2723" strokeWidth={2.6} strokeLinejoin="round" />
            <path d="M-24.5,-66 H24.5 V-59 H-24.5 Z" fill="#fff7ea" stroke="#3b2723" strokeWidth={2.2} strokeLinejoin="round" />
            <path d="M-21,-56 V-39 M21,-56 V-39" stroke="#fff" strokeOpacity={0.55} strokeWidth={2.4} strokeLinecap="round" />
            <g transform={`translate(${NECK.x} ${NECK.y})`}>
              <g ref={el => (parts.current.head = el)}>
                {kind === 'bear' ? (
                  <g>
                    <circle cx={-15} cy={-37} r={8.5} fill={fur} stroke="#3b2723" strokeWidth={2.4} />
                    <circle cx={-15} cy={-37} r={4} fill={shade} />
                    <circle cx={15} cy={-38} r={8.5} fill={fur} stroke="#3b2723" strokeWidth={2.4} />
                    <circle cx={15} cy={-38} r={4} fill={shade} />
                  </g>
                ) : (
                  <g>
                    <path d="M-12,-34 C-20,-60 -15,-76 -8,-76 C-1,-76 -1,-56 -3,-36 Z" fill={fur} stroke="#3b2723" strokeWidth={2.4} strokeLinejoin="round" />
                    <path d="M-10,-42 C-14,-58 -12,-68 -8,-68 C-5,-68 -5,-56 -6,-42 Z" fill="#f9a8c0" />
                    <path d="M4,-36 C2,-62 8,-78 15,-76 C22,-74 18,-54 13,-34 Z" fill={fur} stroke="#3b2723" strokeWidth={2.4} strokeLinejoin="round" />
                    <path d="M8,-42 C8,-58 11,-69 14,-68 C17,-67 15,-56 12,-42 Z" fill="#f9a8c0" />
                  </g>
                )}
                <circle cx={2} cy={-20} r={22} fill={fur} stroke="#3b2723" strokeWidth={2.6} />
                {/* The headband. */}
                <path d="M-19,-30 C-8,-38 13,-38 23,-29 L22,-23 C12,-31 -8,-31 -19,-24 Z" fill={ink} stroke="#3b2723" strokeWidth={2} strokeLinejoin="round" />
                <ellipse cx={13} cy={-12} rx={10} ry={8} fill={pale} />
                <ellipse cx={19} cy={-16} rx={3.4} ry={2.6} fill="#3b2723" />
                {hurt ? (
                  <path d="M3,-25 l6,5 M9,-25 l-6,5" stroke="#3b2723" strokeWidth={2.6} strokeLinecap="round" />
                ) : (
                  <g>
                    <ellipse cx={7} cy={-22} rx={2.8} ry={3.6} fill="#3b2723" />
                    <circle cx={8} cy={-23.4} r={1} fill="#fff" />
                    <path d="M1,-29 l11,3" stroke="#3b2723" strokeWidth={2.4} strokeLinecap="round" />
                  </g>
                )}
                <path d={hurt ? 'M10,-7 q5,-4 9,0' : 'M10,-8 q5,3 9,-1'} fill="none" stroke="#3b2723" strokeWidth={2.2} strokeLinecap="round" />
                <ellipse cx={-4} cy={-13} rx={4.6} ry={3} fill="#ff8fa3" opacity={0.55} />
              </g>
            </g>
            {arm('f', REST)}
          </g>
        </g>
      </g>
    </g>
  );
});
Boxer.displayName = 'Boxer';

/** The ring and the hall round it. Drawn once. */
const Ring: React.FC = React.memo(() => (
  <g>
    <defs>
      <linearGradient id="bx-hall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#120a2a" />
        <stop offset="0.6" stopColor="#241449" />
        <stop offset="1" stopColor="#0d0820" />
      </linearGradient>
      <linearGradient id="bx-light" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="bx-canvas" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#dfe9f7" />
        <stop offset="1" stopColor="#b9c9e2" />
      </linearGradient>
      <radialGradient id="bx-pool" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x={0} y={0} width={W} height={H} fill="url(#bx-hall)" />
    {/* The crowd, row on row, a few phones held up. */}
    {[0, 1, 2, 3].map(row =>
      Array.from({ length: 21 - row }, (_, i) => {
        const x = 8 + i * (19 + row * 0.8) + (row % 2) * 9;
        const y = 150 - row * 19;
        return (
          <g key={`${row}-${i}`} opacity={0.5 - row * 0.09}>
            <circle cx={x} cy={y} r={6.5} fill="#3a2a66" />
            <path d={`M${x - 9},${y + 17} q9,-14 18,0 z`} fill="#33245c" />
          </g>
        );
      })
    )}
    {/* The light over the middle of the ring; the ones that sway are layers of their own (.bx-beams). */}
    <path d="M200,-6 L96,236 H304 Z" fill="url(#bx-light)" opacity={0.16} />
    {/* Posts, pads and the far ropes. */}
    <rect x={30} y={132} width={9} height={104} rx={2} fill="#d9dde6" stroke="#3b2723" strokeWidth={2} />
    <rect x={361} y={132} width={9} height={104} rx={2} fill="#d9dde6" stroke="#3b2723" strokeWidth={2} />
    {[146, 168, 190].map((y, i) => (
      <g key={y}>
        <path d={`M36,${y} Q200,${y + 5} 364,${y}`} fill="none" stroke="#3b2723" strokeWidth={4.6} />
        <path d={`M36,${y} Q200,${y + 5} 364,${y}`} fill="none" stroke={i === 1 ? '#f5f7fb' : '#e23a55'} strokeWidth={2.6} />
      </g>
    ))}
    <rect x={25} y={138} width={19} height={60} rx={6} fill="#e23a55" stroke="#3b2723" strokeWidth={2.2} />
    <rect x={356} y={138} width={19} height={60} rx={6} fill="#2f7fe6" stroke="#3b2723" strokeWidth={2.2} />
    {/* The canvas, its apron, and the pool of light on it. */}
    <path d={`M22,${FLOOR - 26} H378 L400,${FLOOR + 22} H0 Z`} fill="url(#bx-canvas)" stroke="#3b2723" strokeWidth={2.4} strokeLinejoin="round" />
    <ellipse cx={200} cy={FLOOR - 2} rx={150} ry={20} fill="url(#bx-pool)" />
    <path d={`M150,${FLOOR + 4} H250`} stroke="#7d8fb0" strokeOpacity={0.45} strokeWidth={2} strokeDasharray="5 6" />
    <rect x={0} y={FLOOR + 22} width={W} height={H - FLOOR - 22} fill="#3a1030" stroke="#3b2723" strokeWidth={2.4} />
    <path d={`M0,${FLOOR + 30} H400`} stroke="#ffd166" strokeOpacity={0.7} strokeWidth={2} />
  </g>
));
Ring.displayName = 'Ring';

/** Phones flashing in the crowd: where, as a part of the picture's width and height. */
const FLASHES = [
  [11, 34],
  [30, 42],
  [51, 31],
  [72, 40],
  [88, 33],
  [40, 49],
  [80, 48]
];

/** What to say over the ring for each thing that can become of a move. */
const SHOUT: Partial<Record<BxWhat, string>> = {
  blocked: 'BLOCKED!',
  broke: 'GUARD BROKEN!',
  missed: 'MISSED!',
  beaten: 'TOO SLOW!',
  slipped: 'DODGED!'
};
const PUNCH_SHOUT = ['JAB!', 'HOOK!', 'UPPERCUT!'];

interface Callout {
  key: number;
  text: string;
  /** Which side of the ring it is over. */
  side: 'me' | 'them' | 'mid';
  tone: 'hit' | 'miss' | 'big';
}
interface Damage {
  key: number;
  side: 'me' | 'them';
  n: number;
}

const MOVE_NAMES = ['Jab', 'Hook', 'Uppercut', 'Block', 'Dodge'];
const MOVE_HINTS = ['Quick. Beats a dodge.', 'Strong. Gets through a guard a little.', 'Huge. Breaks a guard.', 'Stops a jab. Gives you energy.', 'Makes big punches miss, and hits back.'];

/** A small picture for each move's button. */
const MoveIcon: React.FC<{ move: number }> = ({ move }) => {
  const glove = (x: number, y: number, turn: number) => (
    <g transform={`translate(${x} ${y}) rotate(${turn})`}>
      <rect x={-13} y={-5} width={7} height={10} rx={2} fill="#fff7ea" stroke="currentColor" strokeWidth={1.6} />
      <path d="M-7,-7.5 C0,-10 10,-9 10.5,-1 C11,6 6,8.5 -1,8 C-5,8 -7,6.5 -7,4 Z" fill="var(--me)" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    </g>
  );
  return (
    <svg viewBox="0 0 44 36" className="bx-move-icon" aria-hidden="true">
      {move === BX_JAB && (
        <g>
          <path d="M3,18 h14 M6,12 h8 M6,24 h8" stroke="currentColor" strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
          {glove(29, 18, 0)}
        </g>
      )}
      {move === BX_HOOK && (
        <g>
          <path d="M8,30 C4,16 12,6 26,7" fill="none" stroke="currentColor" strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" strokeDasharray="3 4" />
          {glove(29, 13, 24)}
        </g>
      )}
      {move === BX_UPPER && (
        <g>
          <path d="M22,33 V20 M16,31 v-7 M28,31 v-7" stroke="currentColor" strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
          {glove(22, 11, -90)}
        </g>
      )}
      {move === BX_BLOCK && (
        <g>
          {glove(15, 18, -78)}
          {glove(29, 18, -102)}
        </g>
      )}
      {move === BX_DODGE && (
        <g>
          <circle cx={15} cy={13} r={7} fill="none" stroke="currentColor" strokeWidth={2} />
          <path d="M14,20 C11,26 9,29 6,33" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          <path d="M27,10 h13 M30,17 h10 M27,24 h13" stroke="currentColor" strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
};

export const BoxingBoard: React.FC<BoardProps> = React.memo(({ game, me, inkOf, canAct, onMove, onSettled, partnerName }) => {
  const tr = useT();
  const them: Seat = me === 'user' ? 'partner' : 'user';
  const s = useMemo(() => playBoxing(game), [game]);
  const done = s.rounds.length;
  const mine = game.picks?.[me] || [];
  const theirs = game.picks?.[them] || [];

  /** How many rounds have been fought out on this screen. */
  const [shown, setShown] = useState(done);
  const [fighting, setFighting] = useState(false);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [damage, setDamage] = useState<Damage[]>([]);
  const [burst, setBurst] = useState<{ key: number; x: number; y: number; big: boolean } | null>(null);
  const [ko, setKo] = useState<null | 'ko' | 'bell'>(null);
  const [hint, setHint] = useState<number | null>(null);

  const myParts = useRef<Parts>(noParts());
  const theirParts = useRef<Parts>(noParts());
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
  const stopAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    for (const p of [myParts.current, theirParts.current]) {
      for (const el of [p.whole, p.torso, p.head, p.f.rot, p.f.fore, p.f.glove, p.b.rot, p.b.fore, p.b.glove]) el?.getAnimations?.().forEach(a => a.cancel());
    }
  };

  /** One round, fought out: both moves, what they did, and the count if someone goes down. */
  const fight = (round: BxRound, index: number, last: boolean) => {
    running.current = true;
    setFighting(true);
    const key = Date.now();
    const side = (seat: Seat) => (seat === me ? 'me' : 'them') as 'me' | 'them';
    const partsOf = (seat: Seat) => (seat === me ? myParts.current : theirParts.current);
    const hitAt = FIGHT_MS * HIT_AT;
    const shouts: Callout[] = [];
    let biggest = 0;
    let lateHit = false;

    for (const seat of [me, them]) {
      const foe: Seat = seat === me ? them : me;
      const move = round.move[seat];
      const what = round.what[seat];
      act(partsOf(seat), MOVES[move], FIGHT_MS);
      if (move <= BX_UPPER) later(Math.max(0, hitAt - 150), () => playSound('g-bx-whoosh', { rate: move === BX_JAB ? 1.25 : move === BX_HOOK ? 1 : 0.82, gain: 0.7 }));

      if (what === 'landed' || what === 'chipped' || what === 'broke') {
        const hard = Math.min(1, round.took[foe] / 26);
        biggest = Math.max(biggest, hard);
        reel(partsOf(foe), hard, hitAt, move === BX_UPPER);
        later(hitAt, () => playSound(move === BX_JAB ? 'g-bx-jab' : move === BX_HOOK ? 'g-bx-hook' : 'g-bx-upper', { rate: 0.96 + Math.random() * 0.08 }));
        shouts.push({ key: key + shouts.length, text: what === 'broke' ? SHOUT.broke! : PUNCH_SHOUT[move], side: side(seat), tone: what === 'broke' || move === BX_UPPER ? 'big' : 'hit' });
      } else if (what === 'blocked') {
        jolt(partsOf(foe), hitAt);
        later(hitAt, () => playSound('g-bx-block'));
        shouts.push({ key: key + shouts.length, text: SHOUT.blocked!, side: side(foe), tone: 'miss' });
      } else if (what === 'missed') {
        // They were not there - and they answer it.
        lateHit = true;
        const answerAt = FIGHT_MS * 0.62;
        act(partsOf(foe), COUNTER, 360, answerAt);
        reel(partsOf(seat), 0.5, answerAt + 150, false);
        later(answerAt + 150, () => playSound('g-bx-jab', { rate: 1.1 }));
        shouts.push({ key: key + shouts.length, text: SHOUT.slipped!, side: side(foe), tone: 'miss' });
        later(answerAt + 150, () => setCallouts(list => [...list, { key: key + 50, text: 'COUNTER!', side: side(foe), tone: 'hit' }]));
      } else if (what === 'beaten') {
        shouts.push({ key: key + shouts.length, text: SHOUT.beaten!, side: side(seat), tone: 'miss' });
      }
    }

    const tookAny = round.took[me] > 0 || round.took[them] > 0;
    later(hitAt, () => {
      setCallouts(shouts);
      const hits: Damage[] = [];
      for (const seat of [me, them]) if (round.took[seat] > 0 && !(lateHit && round.what[seat] === 'missed')) hits.push({ key: key + (seat === me ? 1 : 2), side: side(seat), n: round.took[seat] });
      setDamage(hits);
      if (tookAny && !lateHit) {
        setBurst({ key, x: 200, y: FLOOR - 118, big: biggest > 0.7 });
        haptic(biggest > 0.7 ? 'confirm' : 'tick');
        if (biggest > 0.4) {
          stage.current?.animate?.(
            [
              { transform: 'translate3d(0, 0, 0)' },
              { transform: `translate3d(${(4 + biggest * 5).toFixed(1)}px, ${(-2 - biggest * 3).toFixed(1)}px, 0)` },
              { transform: `translate3d(${(-3 - biggest * 3).toFixed(1)}px, 2px, 0)` },
              { transform: 'translate3d(0, 0, 0)' }
            ],
            { duration: 220 + biggest * 120, easing: 'ease-out' }
          );
        }
      }
      // The bars fall as the punch lands; a counter's, when it does.
      if (!lateHit) {
        shownRef.current = index + 1;
        setShown(index + 1);
      }
    });
    if (lateHit) {
      later(FIGHT_MS * 0.62 + 150, () => {
        const who = round.what[me] === 'missed' ? me : them;
        setDamage(list => [...list, { key: key + 9, side: side(who), n: round.took[who] }]);
        setBurst({ key: key + 9, x: 200, y: FLOOR - 118, big: false });
        haptic('tick');
        shownRef.current = index + 1;
        setShown(index + 1);
      });
    }

    const down: Seat[] = last ? ([me, them] as Seat[]).filter(seat => round.hp[seat] <= 0) : [];
    const endAt = FIGHT_MS + AFTER_MS + (lateHit ? 180 : 0);
    if (down.length) {
      const at = (lateHit ? FIGHT_MS * 0.62 + 150 : hitAt) + 90;
      down.forEach(seat => drop(partsOf(seat), at));
      later(at, () => {
        playSound('g-bx-ko');
        haptic('confirm');
      });
      later(at + 420, () => {
        setKo('ko');
        playSound('g-bx-bell');
        playSound('g-bx-crowd', { delay: 0.25 });
      });
    } else if (last && stateRef.current.over) {
      // The last bell, with both still standing.
      later(endAt - 200, () => {
        setKo('bell');
        playSound('g-bx-bell');
      });
    }
    later(down.length ? endAt + KO_MS : endAt, () => {
      setCallouts([]);
      setDamage([]);
      setBurst(null);
      running.current = false;
      setFighting(false);
      settledRef.current?.(index + 1);
      pump();
    });
  };

  /** Fights out whatever has been decided and not yet shown. */
  const pump = () => {
    if (running.current) return;
    const st = stateRef.current;
    const k = shownRef.current;
    if (k >= st.rounds.length) return;
    fight(st.rounds[k], k, k === st.rounds.length - 1);
  };
  const pumpRef = useRef(pump);
  pumpRef.current = pump;

  useEffect(() => {
    if (idRef.current !== game.id || done < shownRef.current) {
      // A new fight: both back on their feet, nothing in the air.
      stopAll();
      running.current = false;
      idRef.current = game.id;
      shownRef.current = done;
      setShown(done);
      setFighting(false);
      setCallouts([]);
      setDamage([]);
      setBurst(null);
      setKo(null);
      settledRef.current?.(done);
      return;
    }
    pumpRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, done]);

  useEffect(() => {
    settledRef.current?.(shownRef.current);
    playSound('g-bx-bell', { gain: 0.5 });
    return () => {
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What the bars show: the fight as far as it has been fought out here.
  const at = shown > 0 ? s.rounds[Math.min(shown, done) - 1] : null;
  const hp = at ? at.hp : { user: BX_HP, partner: BX_HP };
  const energy = shown >= done ? s.energy : at ? at.energy : { user: BX_ENERGY_START, partner: BX_ENERGY_START };
  const finished = s.over && shown >= done;
  const downNow = (seat: Seat) => finished && s.hp[seat] <= 0;
  const myPick = mine.length > done ? mine[done] : null;
  const theyPicked = theirs.length > done;
  const onLeft = me === 'user' ? ('bear' as const) : ('bunny' as const);
  const onRight = onLeft === 'bear' ? ('bunny' as const) : ('bear' as const);

  const bar = (seat: Seat) => (
    <div className="bx-side" data-side={seat === me ? 'me' : 'them'} style={{ '--ink': inkOf(seat) } as React.CSSProperties}>
      <span className="bx-name">{seat === me ? tr('You') : partnerName}</span>
      <span className="bx-hp" role="meter" aria-valuemin={0} aria-valuemax={BX_HP} aria-valuenow={hp[seat]} aria-label={tr('Health')}>
        <i className="bx-hp-lag" style={{ transform: `scaleX(${hp[seat] / BX_HP})` }} />
        <i className="bx-hp-now" data-low={hp[seat] <= 30 || undefined} style={{ transform: `scaleX(${hp[seat] / BX_HP})` }} />
        <b>{hp[seat]}</b>
      </span>
      <span className="bx-energy" aria-label={tr('Energy: {n} of {max}', { n: energy[seat], max: BX_ENERGY_MAX })}>
        {Array.from({ length: BX_ENERGY_MAX }, (_, i) => (
          <i key={i} data-on={i < energy[seat] || undefined} />
        ))}
      </span>
    </div>
  );

  return (
    <div className="bx" style={{ '--me': inkOf(me), '--them': inkOf(them) } as React.CSSProperties}>
      <div className="bx-top">
        {bar(me)}
        <span className="bx-round">{finished ? tr('Final bell') : tr('Round {n}', { n: Math.min(shown, done) + 1 })}</span>
        {bar(them)}
      </div>

      <div className="bx-stage" ref={stage} data-ko={ko || undefined}>
        <svg viewBox={`0 0 ${W} ${H}`} className="bx-svg" role="img" aria-label={tr('The ring: you on the left, {name} on the right', { name: partnerName })}>
          <Ring />
          <g transform={`translate(${RIGHT_X} ${FLOOR}) scale(-1 1)`}>
            <Boxer kind={onRight} ink={inkOf(them)} parts={theirParts} down={downNow(them) && !fighting} hurt={finished && s.hp[them] <= 0} />
          </g>
          <g transform={`translate(${LEFT_X} ${FLOOR})`}>
            <Boxer kind={onLeft} ink={inkOf(me)} parts={myParts} down={downNow(me) && !fighting} hurt={finished && s.hp[me] <= 0} />
          </g>
          {burst && (
            <g key={burst.key} transform={`translate(${burst.x} ${burst.y})`}>
              <g className="bx-burst" data-big={burst.big || undefined}>
                <path d="M0,-30 L7,-10 L27,-17 L14,-1 L31,11 L10,11 L9,31 L-2,14 L-19,26 L-13,7 L-31,0 L-12,-8 L-17,-27 L-3,-13 Z" fill="#fff" stroke="#ffcf3f" strokeWidth={4} strokeLinejoin="round" />
              </g>
            </g>
          )}
        </svg>
        <div className="bx-beams" aria-hidden="true">
          <i />
          <i />
        </div>
        <div className="bx-flashes" aria-hidden="true">
          {FLASHES.map(([x, y], i) => (
            <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i * 430) % 2600}ms` }} />
          ))}
        </div>
        {callouts.map(c => (
          <span key={c.key} className="bx-shout" data-side={c.side} data-tone={c.tone}>
            {tr(c.text)}
          </span>
        ))}
        {damage.map(d => (
          <span key={d.key} className="bx-dmg" data-side={d.side}>
            −{d.n}
          </span>
        ))}
        {ko && (
          <div className="bx-ko" key={ko} aria-live="polite">
            {ko === 'ko' ? tr('K.O.!') : tr('Final bell!')}
          </div>
        )}
        {!finished && !fighting && (
          <span className="bx-ready" data-on={theyPicked || undefined}>
            {theyPicked ? tr('{name} is ready', { name: partnerName }) : tr('{name} is choosing', { name: partnerName })}
          </span>
        )}
      </div>

      <div className="bx-moves" role="group" aria-label={tr('Your move')}>
        {MOVE_NAMES.map((name, i) => {
          const cost = BX_COST[i];
          const can = canAct && boxingAllowed(i, s.energy[me]);
          return (
            <button
              key={i}
              type="button"
              className="bx-move"
              data-on={myPick === i || undefined}
              data-punch={i <= BX_UPPER || undefined}
              disabled={!can}
              onClick={() => {
                setHint(null);
                playSound('g-bx-pick');
                onMove(i);
              }}
              onPointerEnter={() => setHint(i)}
              onPointerLeave={() => setHint(h => (h === i ? null : h))}
              aria-label={`${tr(name)}. ${tr(MOVE_HINTS[i])}`}
            >
              <MoveIcon move={i} />
              <small>{tr(name)}</small>
              <span className="bx-cost" data-free={cost === 0 || undefined}>
                {i === BX_BLOCK ? '+⚡' : cost === 0 ? tr('free') : '⚡'.repeat(cost)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="bx-hint">
        {myPick !== null
          ? tr('Locked in: {move}', { move: tr(MOVE_NAMES[myPick]) })
          : hint !== null
            ? tr(MOVE_HINTS[hint])
            : canAct
              ? tr('Jab beats Dodge · Dodge beats Hook and Uppercut · Uppercut beats Block · Block beats Jab')
              : ' '}
      </p>
    </div>
  );
});
BoxingBoard.displayName = 'BoxingBoard';

