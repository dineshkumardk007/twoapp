import React, { useEffect, useRef, useState } from 'react';
import { stickerInfo } from '../core/stickers';

/**
 * Two's stickers, drawn here (core/stickers lists them): a bear and a bunny
 * for the two of you, and a set of squishy faces. Each is a small drawing on
 * a 160 x 160 square with a word under it, and moves a little - a hop, a
 * wobble, hearts floating up - as it comes into view and when tapped
 * (index.css, "Stickers"). Nothing moves while it is off screen.
 *
 * Every colour is the drawing's own, outlined in dark ink, so it reads on a
 * light chat and a dark one alike.
 */

const INK = '#3b2723';
const MOUTH = '#8a2f3a';
const TONGUE = '#ff7d8f';
const CHEEK = '#ff9fb3';
const RED = '#ff4d6d';
const WATER = '#7fd0ff';

const BEAR = '#c4895a';
const MUZZLE = '#f3dcbd';
const BEAR_EAR = '#ef9f98';
const BUNNY = '#fffaf3';
const BUNNY_EAR = '#ffb7c8';

const line = {
  stroke: INK,
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none'
};
const shape = (fill: string, width = 3) => ({
  fill,
  stroke: INK,
  strokeWidth: width,
  strokeLinejoin: 'round' as const
});

/** A part that moves on its own (index.css): a wrapper, so its own position stays put. */
const Part: React.FC<{ cls?: string; delay?: number; children: React.ReactNode }> = ({ cls, delay, children }) =>
  cls ? (
    <g className={`stk-part ${cls}`} style={delay ? { animationDelay: `${delay}s` } : undefined}>
      {children}
    </g>
  ) : (
    <>{children}</>
  );

// ------------------------------------------------------------------ faces

export type Mood =
  | 'smile' | 'grin' | 'happy' | 'love' | 'cry' | 'sad' | 'angry' | 'sleep' | 'shock' | 'laugh'
  | 'wink' | 'kiss' | 'puppy' | 'smug' | 'roll' | 'drool' | 'yawn' | 'think' | 'tight' | 'dead' | 'tongue' | 'content';

interface FaceProps {
  mood: Mood;
  /** Eyes this far either side of the middle, at this height; the mouth at `my`. */
  ex: number;
  ey: number;
  my: number;
  /** How big the features are drawn. */
  k?: number;
  blush?: { x: number; y: number };
}

export const Face: React.FC<FaceProps> = ({ mood, ex, ey, my, k = 1, blush }) => {
  const sw = { ...line, strokeWidth: 3 * Math.min(k, 1.2) };
  const dot = (x: number, y = ey) => (
    <g key={`d${x}`}>
      <circle cx={x} cy={y} r={3.4 * k} fill={INK} />
      <circle cx={x + 1.1 * k} cy={y - 1.2 * k} r={1.1 * k} fill="#fff" />
    </g>
  );
  const arcUp = (x: number) => (
    <path key={`u${x}`} d={`M${x - 4.5 * k},${ey + 1.5 * k} Q${x},${ey - 4.5 * k} ${x + 4.5 * k},${ey + 1.5 * k}`} {...sw} />
  );
  const arcDown = (x: number) => (
    <path key={`n${x}`} d={`M${x - 4.5 * k},${ey - 1 * k} Q${x},${ey + 3.5 * k} ${x + 4.5 * k},${ey - 1 * k}`} {...sw} />
  );
  const chevron = (x: number, dir: 1 | -1) => (
    <path
      key={`c${x}`}
      d={`M${x - 3.5 * k * dir},${ey - 4 * k} L${x + 3.5 * k * dir},${ey} L${x - 3.5 * k * dir},${ey + 4 * k}`}
      {...sw}
    />
  );
  const big = (x: number, py = 0) => (
    <g key={`b${x}`}>
      <circle cx={x} cy={ey} r={6 * k} {...shape('#fff', 2.5 * Math.min(k, 1.2))} />
      <circle cx={x} cy={ey + py * k} r={2.8 * k} fill={INK} />
    </g>
  );
  const puppy = (x: number) => (
    <g key={`p${x}`}>
      <circle cx={x} cy={ey} r={5.6 * k} fill={INK} />
      <circle cx={x + 1.7 * k} cy={ey - 1.9 * k} r={2.2 * k} fill="#fff" />
      <circle cx={x - 1.9 * k} cy={ey + 1.9 * k} r={1 * k} fill="#fff" />
    </g>
  );
  const lid = (x: number) => (
    <g key={`l${x}`}>
      <path d={`M${x - 5 * k},${ey} A${5 * k},${5 * k} 0 0 0 ${x + 5 * k},${ey} Z`} fill={INK} />
      <path d={`M${x - 6 * k},${ey} L${x + 6 * k},${ey}`} {...sw} />
    </g>
  );
  const cross = (x: number) => (
    <path
      key={`x${x}`}
      d={`M${x - 4 * k},${ey - 4 * k} L${x + 4 * k},${ey + 4 * k} M${x + 4 * k},${ey - 4 * k} L${x - 4 * k},${ey + 4 * k}`}
      {...sw}
    />
  );
  const heart = (x: number) => (
    <g key={`h${x}`} transform={`translate(${x} ${ey}) scale(${0.5 * k})`}>
      <path d={HEART_PATH} {...shape(RED, 2.5)} />
    </g>
  );
  const browsAngry = (
    <path
      d={`M${-ex - 5 * k},${ey - 9 * k} L${-ex + 4 * k},${ey - 5.5 * k} M${ex + 5 * k},${ey - 9 * k} L${ex - 4 * k},${ey - 5.5 * k}`}
      {...sw}
    />
  );
  const browsSad = (
    <path
      d={`M${-ex - 4 * k},${ey - 6.5 * k} L${-ex + 4 * k},${ey - 9.5 * k} M${ex + 4 * k},${ey - 6.5 * k} L${ex - 4 * k},${ey - 9.5 * k}`}
      {...sw}
    />
  );

  const smile = <path d={`M${-5 * k},${my} Q0,${my + 5 * k} ${5 * k},${my}`} {...sw} />;
  const open = (
    <g>
      <path d={`M${-6.5 * k},${my - 1 * k} Q0,${my + 11 * k} ${6.5 * k},${my - 1 * k} Z`} {...shape(MOUTH, sw.strokeWidth)} />
      <ellipse cx={0} cy={my + 4.2 * k} rx={2.8 * k} ry={1.8 * k} fill={TONGUE} />
    </g>
  );
  const laugh = (
    <g>
      <path d={`M${-9 * k},${my - 2 * k} Q0,${my + 15 * k} ${9 * k},${my - 2 * k} Z`} {...shape(MOUTH, sw.strokeWidth)} />
      <ellipse cx={0} cy={my + 6 * k} rx={4 * k} ry={2.4 * k} fill={TONGUE} />
    </g>
  );
  const frown = <path d={`M${-5 * k},${my + 3 * k} Q0,${my - 2.5 * k} ${5 * k},${my + 3 * k}`} {...sw} />;
  const wail = <path d={`M${-7 * k},${my + 6 * k} Q0,${my - 6 * k} ${7 * k},${my + 6 * k} Z`} {...shape(MOUTH, sw.strokeWidth)} />;
  const oh = <ellipse cx={0} cy={my + 1.5 * k} rx={3.2 * k} ry={4 * k} {...shape(MOUTH, sw.strokeWidth)} />;
  const bigOh = <ellipse cx={0} cy={my + 3 * k} rx={5 * k} ry={7 * k} {...shape(MOUTH, sw.strokeWidth)} />;
  const wobble = (
    <path d={`M${-6 * k},${my + 2 * k} q${2 * k},${-3 * k} ${4 * k},0 q${2 * k},${3 * k} ${4 * k},0 q${2 * k},${-3 * k} ${4 * k},0`} {...sw} />
  );
  const pucker = (
    <path d={`M${-1 * k},${my - 3 * k} q${5 * k},${1.5 * k} 0,${3.5 * k} q${5 * k},${1.5 * k} 0,${3.5 * k}`} {...sw} />
  );
  const smirk = <path d={`M${-5 * k},${my + 1 * k} Q${1 * k},${my + 4.5 * k} ${6 * k},${my - 2 * k}`} {...sw} />;
  const flat = <path d={`M${-4.5 * k},${my + 1 * k} L${4.5 * k},${my + 1 * k}`} {...sw} />;
  const wavy = (
    <path
      d={`M${-7 * k},${my + 1 * k} q${1.75 * k},${-2.5 * k} ${3.5 * k},0 t${3.5 * k},0 t${3.5 * k},0 t${3.5 * k},0`}
      {...sw}
    />
  );
  const yawn = <ellipse cx={0} cy={my + 3 * k} rx={5.5 * k} ry={7.5 * k} {...shape(MOUTH, sw.strokeWidth)} />;
  // Blowing a raspberry: the tongue right out.
  const tongueOut = (
    <g>
      <path d={`M${-6 * k},${my - 1 * k} Q0,${my + 5 * k} ${6 * k},${my - 1 * k} Z`} {...shape(MOUTH, sw.strokeWidth)} />
      <path
        d={`M${-3.8 * k},${my + 1 * k} L${-3.8 * k},${my + 7 * k} Q0,${my + 12 * k} ${3.8 * k},${my + 7 * k} L${3.8 * k},${my + 1 * k} Z`}
        {...shape(TONGUE, 2.2 * Math.min(k, 1.2))}
      />
      <path d={`M0,${my + 3 * k} L0,${my + 7.5 * k}`} stroke={MOUTH} strokeWidth={1.4 * k} strokeLinecap="round" />
    </g>
  );

  let eyes: React.ReactNode;
  let mouth: React.ReactNode;
  let extra: React.ReactNode = null;
  switch (mood) {
    case 'smile':
      eyes = [dot(-ex), dot(ex)];
      mouth = smile;
      break;
    case 'grin':
      eyes = [dot(-ex), dot(ex)];
      mouth = open;
      break;
    case 'happy':
      eyes = [arcUp(-ex), arcUp(ex)];
      mouth = open;
      break;
    case 'love':
      eyes = [heart(-ex), heart(ex)];
      mouth = open;
      break;
    case 'cry':
      eyes = [arcUp(-ex), arcUp(ex)];
      mouth = wail;
      extra = browsSad;
      break;
    case 'sad':
      eyes = [dot(-ex), dot(ex)];
      mouth = frown;
      extra = browsSad;
      break;
    case 'angry':
      eyes = [dot(-ex), dot(ex)];
      mouth = frown;
      extra = browsAngry;
      break;
    case 'sleep':
      eyes = [arcDown(-ex), arcDown(ex)];
      mouth = oh;
      break;
    case 'shock':
      eyes = [big(-ex), big(ex)];
      mouth = bigOh;
      break;
    case 'laugh':
      eyes = [chevron(-ex, 1), chevron(ex, -1)];
      mouth = laugh;
      break;
    case 'wink':
      eyes = [dot(-ex), arcUp(ex)];
      mouth = open;
      break;
    case 'kiss':
      eyes = [arcUp(-ex), arcUp(ex)];
      mouth = pucker;
      break;
    case 'puppy':
      eyes = [puppy(-ex), puppy(ex)];
      mouth = wobble;
      extra = browsSad;
      break;
    case 'smug':
      eyes = [lid(-ex), lid(ex)];
      mouth = smirk;
      break;
    case 'roll':
      eyes = [big(-ex, -3), big(ex, -3)];
      mouth = flat;
      break;
    case 'drool':
      eyes = [arcUp(-ex), arcUp(ex)];
      mouth = open;
      extra = (
        <g transform={`translate(${5.5 * k} ${my + 9 * k}) scale(${0.55 * k})`}>
          <path d={DROP_PATH} {...shape(WATER, 3)} />
        </g>
      );
      break;
    case 'yawn':
      eyes = [arcDown(-ex), arcDown(ex)];
      mouth = yawn;
      break;
    case 'think':
      eyes = [dot(-ex + 2 * k, ey - 1.5 * k), dot(ex + 2 * k, ey - 1.5 * k)];
      mouth = <path d={`M${-2 * k},${my + 1.5 * k} L${5 * k},${my}`} {...sw} />;
      break;
    case 'tight':
      eyes = [chevron(-ex, 1), chevron(ex, -1)];
      mouth = wavy;
      break;
    case 'dead':
      eyes = [cross(-ex), cross(ex)];
      mouth = wavy;
      break;
    case 'tongue':
      eyes = [chevron(-ex, 1), arcUp(ex)];
      mouth = tongueOut;
      break;
    // Eyes closed, a small smile: held close.
    case 'content':
      eyes = [arcUp(-ex), arcUp(ex)];
      mouth = smile;
      break;
  }

  return (
    <g>
      {blush && (
        <g fill={CHEEK} opacity={0.8}>
          <ellipse cx={-blush.x} cy={blush.y} rx={5.5 * k} ry={3.4 * k} />
          <ellipse cx={blush.x} cy={blush.y} rx={5.5 * k} ry={3.4 * k} />
        </g>
      )}
      {extra}
      {eyes}
      {mouth}
    </g>
  );
};

// ------------------------------------------------------------- characters

export type Arms = 'down' | 'up' | 'hold' | 'cover' | 'cross' | 'phone' | 'run' | 'none';

interface CharacterProps {
  x: number;
  y: number;
  s?: number;
  rot?: number;
  mood: Mood;
  arms?: Arms;
  /** Drawn without a body: a head on its own. */
  head?: boolean;
  /** Something held, drawn between the face and the paws. */
  children?: React.ReactNode;
}

const limb = (cx: number, cy: number, rx: number, ry: number, rot: number, fill: string, key?: string) => (
  <ellipse key={key} cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} {...shape(fill)} />
);

function paws(arms: Arms, fill: string): React.ReactNode {
  switch (arms) {
    case 'down':
      return [limb(-23, 40, 7, 11, 25, fill, 'l'), limb(23, 40, 7, 11, -25, fill, 'r')];
    case 'up':
      return [limb(-32, 12, 7, 12, -32, fill, 'l'), limb(32, 12, 7, 12, 32, fill, 'r')];
    case 'hold':
      return [limb(-15, 40, 7.5, 7, 0, fill, 'l'), limb(15, 40, 7.5, 7, 0, fill, 'r')];
    case 'cover':
      return [limb(-9, 14, 9, 8, -20, fill, 'l'), limb(9, 14, 9, 8, 20, fill, 'r')];
    case 'cross':
      return [limb(-3, 38, 16, 6.5, 14, fill, 'l'), limb(3, 41, 16, 6.5, -14, fill, 'r')];
    case 'phone':
      return [limb(-23, 40, 7, 11, 25, fill, 'l'), limb(27, 10, 7, 12, 22, fill, 'r')];
    case 'run':
      return [limb(-26, 30, 7, 11, 55, fill, 'l'), limb(25, 46, 7, 11, -55, fill, 'r')];
    case 'none':
      return null;
  }
}

export const Bear: React.FC<CharacterProps> = ({ x, y, s = 1, rot = 0, mood, arms = 'down', head, children }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    {!head && (
      <>
        <ellipse cx={-12} cy={61} rx={9} ry={6} {...shape(BEAR)} />
        <ellipse cx={12} cy={61} rx={9} ry={6} {...shape(BEAR)} />
        <ellipse cx={0} cy={42} rx={24} ry={21} {...shape(BEAR)} />
        <ellipse cx={0} cy={46} rx={14} ry={12} fill={MUZZLE} />
      </>
    )}
    <circle cx={-22} cy={-21} r={11} {...shape(BEAR)} />
    <circle cx={22} cy={-21} r={11} {...shape(BEAR)} />
    <circle cx={-22} cy={-21} r={5.5} fill={BEAR_EAR} />
    <circle cx={22} cy={-21} r={5.5} fill={BEAR_EAR} />
    <circle cx={0} cy={0} r={30} {...shape(BEAR)} />
    <ellipse cx={0} cy={9} rx={13} ry={9.5} fill={MUZZLE} />
    <ellipse cx={0} cy={4.5} rx={4.6} ry={3.3} fill={INK} />
    <Face mood={mood} ex={11} ey={-6} my={11} blush={{ x: 20, y: 6 }} />
    {children}
    {!head && paws(arms, BEAR)}
  </g>
);

export const Bunny: React.FC<CharacterProps> = ({ x, y, s = 1, rot = 0, mood, arms = 'down', head, children }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    {!head && (
      <>
        <ellipse cx={-12} cy={60} rx={9} ry={6} {...shape(BUNNY)} />
        <ellipse cx={12} cy={60} rx={9} ry={6} {...shape(BUNNY)} />
        <ellipse cx={0} cy={41} rx={23} ry={20} {...shape(BUNNY)} />
      </>
    )}
    <g transform="rotate(-12 -13 -46)">
      <ellipse cx={-13} cy={-46} rx={8.5} ry={23} {...shape(BUNNY)} />
      <ellipse cx={-13} cy={-43} rx={4} ry={15} fill={BUNNY_EAR} />
    </g>
    <g transform="rotate(12 13 -46)">
      <ellipse cx={13} cy={-46} rx={8.5} ry={23} {...shape(BUNNY)} />
      <ellipse cx={13} cy={-43} rx={4} ry={15} fill={BUNNY_EAR} />
    </g>
    <ellipse cx={0} cy={0} rx={30} ry={27} {...shape(BUNNY)} />
    {/* Her bow, on the right ear. */}
    <g transform="translate(17 -25) rotate(18)">
      <path d="M0,0 L-9,-6 L-9,6 Z M0,0 L9,-6 L9,6 Z" {...shape('#ff8fb1', 2.5)} />
      <circle cx={0} cy={0} r={2.8} {...shape('#ff8fb1', 2.5)} />
    </g>
    <path d="M-3,4 L3,4 L0,7 Z" fill="#ff8fa8" stroke="#ff8fa8" strokeWidth={2} strokeLinejoin="round" />
    <Face mood={mood} ex={11} ey={-3} my={10} blush={{ x: 19, y: 7 }} />
    {children}
    {!head && paws(arms, BUNNY)}
  </g>
);

interface BlobProps {
  x: number;
  y: number;
  s?: number;
  color: string;
  mood: Mood;
  melt?: boolean;
  children?: React.ReactNode;
}

const BLOB_PATH = 'M-42,8 C-44,-26 -22,-42 0,-42 C24,-42 44,-26 42,8 C40,32 24,40 0,40 C-24,40 -40,32 -42,8 Z';
const MELT_PATH =
  'M-38,2 C-40,-28 -20,-40 0,-40 C22,-40 40,-28 38,2 C37,16 44,24 54,30 C60,34 55,41 44,41 L-44,41 C-56,41 -60,33 -52,27 C-44,21 -38,14 -38,2 Z';

const Blob: React.FC<BlobProps> = ({ x, y, s = 1, color, mood, melt, children }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d={melt ? MELT_PATH : BLOB_PATH} {...shape(color, 3.4)} />
    <ellipse cx={-20} cy={-25} rx={8} ry={4.5} transform="rotate(-30 -20 -25)" fill="#fff" opacity={0.55} />
    <Face mood={mood} ex={15} ey={-6} my={10} k={1.35} blush={{ x: 26, y: 8 }} />
    {children}
  </g>
);

// ------------------------------------------------------------------ props

const HEART_PATH =
  'M0,8 C-3,5 -12,0 -12,-6 C-12,-11 -8,-13 -5,-13 C-2.5,-13 -1,-11.5 0,-9.5 C1,-11.5 2.5,-13 5,-13 C8,-13 12,-11 12,-6 C12,0 3,5 0,8 Z';
const DROP_PATH = 'M0,-7 C3,-2 5.5,1 5.5,3.5 A5.5,5.5 0 0 1 -5.5,3.5 C-5.5,1 -3,-2 0,-7 Z';
const SPARKLE_PATH = 'M0,-9 C1,-3 3,-1 9,0 C3,1 1,3 0,9 C-1,3 -3,1 -9,0 C-3,-1 -1,-3 0,-9 Z';

interface At {
  x: number;
  y: number;
  s?: number;
  rot?: number;
  cls?: string;
  delay?: number;
}
const at = ({ x, y, s = 1, rot = 0 }: At) => `translate(${x} ${y}) rotate(${rot}) scale(${s})`;

export const Heart: React.FC<At & { fill?: string }> = p => (
  <Part cls={p.cls} delay={p.delay}>
    <g transform={at(p)}>
      <path d={HEART_PATH} {...shape(p.fill || RED, 2.4)} />
      <ellipse cx={-6} cy={-7} rx={2.6} ry={1.6} transform="rotate(-30 -6 -7)" fill="#fff" opacity={0.7} />
    </g>
  </Part>
);

export const Drop: React.FC<At & { fill?: string }> = p => (
  <Part cls={p.cls} delay={p.delay}>
    <g transform={at(p)}>
      <path d={DROP_PATH} {...shape(p.fill || WATER, 2.2)} />
    </g>
  </Part>
);

export const Sparkle: React.FC<At & { fill?: string }> = p => (
  <Part cls={p.cls} delay={p.delay}>
    <g transform={at(p)}>
      <path d={SPARKLE_PATH} {...shape(p.fill || '#ffe066', 2.2)} />
    </g>
  </Part>
);

const Puff: React.FC<At> = p => (
  <Part cls={p.cls} delay={p.delay}>
    <g transform={at(p)} {...shape('#f4f1f1', 2.4)}>
      <circle cx={-6} cy={2} r={6} />
      <circle cx={5} cy={3} r={5} />
      <circle cx={0} cy={-4} r={6.5} />
    </g>
  </Part>
);

export const Zzz: React.FC<At> = p => (
  <Part cls={p.cls} delay={p.delay}>
    <g transform={at(p)} fontFamily="Manrope, system-ui, sans-serif" fontWeight={800} fill="#a99bff" stroke={INK} strokeWidth={1.6} paintOrder="stroke">
      <text x={0} y={0} fontSize={18}>Z</text>
      <text x={13} y={-12} fontSize={13}>z</text>
      <text x={23} y={-21} fontSize={10}>z</text>
    </g>
  </Part>
);

/** The little cross of an angry vein. */
export const Vein: React.FC<At> = p => (
  <Part cls={p.cls} delay={p.delay}>
    <g transform={at(p)} stroke="#ff3b3b" strokeWidth={3.2} strokeLinecap="round" fill="none">
      <path d="M-6,-2 Q-2,-2 -2,-6 M2,-6 Q2,-2 6,-2 M6,2 Q2,2 2,6 M-2,6 Q-2,2 -6,2" />
    </g>
  </Part>
);

const CONFETTI = ['#ff6b8b', '#ffd23f', '#6cc6ff', '#8ee0a1', '#b69cff'];
const Confetti: React.FC<{ bits: [number, number, number][]; cls?: string }> = ({ bits, cls }) => (
  <>
    {bits.map(([x, y, rot], i) => (
      <Part key={i} cls={cls} delay={(i % 4) * 0.15}>
        <rect
          x={x - 3}
          y={y - 5}
          width={6}
          height={10}
          rx={2}
          transform={`rotate(${rot} ${x} ${y})`}
          fill={CONFETTI[i % CONFETTI.length]}
          stroke={INK}
          strokeWidth={1.6}
        />
      </Part>
    ))}
  </>
);

const Bowl: React.FC<At> = p => (
  <g transform={at(p)}>
    <path d="M14,-12 L26,-34 M8,-12 L18,-35" stroke="#8a5a3b" strokeWidth={3.4} strokeLinecap="round" />
    <path d="M-18,-4 q4,-8 8,0 t8,0 t8,0 t8,0" fill="none" stroke="#ffd36b" strokeWidth={4} strokeLinecap="round" />
    <path d="M-22,0 L22,0 C22,13 11,20 0,20 C-11,20 -22,13 -22,0 Z" {...shape('#ff8a65')} />
    <path d="M-12,9 L12,9" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />
  </g>
);

const Phone: React.FC<At> = p => (
  <g transform={at(p)}>
    <rect x={-7} y={-12} width={14} height={24} rx={3.5} {...shape('#6c7bff')} />
    <rect x={-4} y={-8} width={8} height={13} rx={1.5} fill="#cfe3ff" />
  </g>
);

export const Flower: React.FC<At> = p => (
  <g transform={at(p)}>
    <path d="M0,4 C2,14 -2,22 0,30" stroke="#37a85a" strokeWidth={3.4} strokeLinecap="round" fill="none" />
    <path d="M0,20 C6,14 12,16 12,16 C10,22 4,22 0,20 Z" {...shape('#6fd08a', 2)} />
    {[0, 72, 144, 216, 288].map(a => (
      <circle key={a} cx={0} cy={-7} r={6} transform={`rotate(${a})`} {...shape('#ff8fb1', 2.2)} />
    ))}
    <circle cx={0} cy={0} r={5} {...shape('#ffd23f', 2.2)} />
  </g>
);

const Cookie: React.FC<At> = p => (
  <g transform={at(p)}>
    <path d="M15,-3 A15,15 0 1 1 6,-14 A5,5 0 0 0 15,-3 Z" {...shape('#e0a865')} />
    {[
      [-6, -4],
      [3, 4],
      [-4, 7],
      [6, -5]
    ].map(([cx, cy]) => (
      <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={2.2} fill="#6b3e26" />
    ))}
  </g>
);

const Moon: React.FC<At> = p => (
  <g transform={at(p)}>
    <path d="M10,-41 A42,42 0 1 0 41,10 A34,34 0 0 1 10,-41 Z" {...shape('#ffe58a', 3.2)} />
    <circle cx={-20} cy={10} r={4} fill="#f5cf5c" />
    <circle cx={-8} cy={26} r={3} fill="#f5cf5c" />
  </g>
);

const Sun: React.FC<At> = p => (
  <Part cls={p.cls} delay={p.delay}>
    <g transform={at(p)}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <path key={a} d="M0,-22 L0,-28" transform={`rotate(${a})`} stroke="#ffb000" strokeWidth={3.6} strokeLinecap="round" />
      ))}
      <circle cx={0} cy={0} r={16} {...shape('#ffd23f')} />
    </g>
  </Part>
);

const Shades: React.FC<At> = p => (
  <g transform={at(p)}>
    <path d="M-4,-4 Q0,-7 4,-4" stroke={INK} strokeWidth={3} fill="none" />
    <rect x={-27} y={-10} width={23} height={15} rx={6} {...shape('#1d1b2f')} />
    <rect x={4} y={-10} width={23} height={15} rx={6} {...shape('#1d1b2f')} />
    <path d="M-22,-6 L-15,-6 M9,-6 L16,-6" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" opacity={0.75} />
  </g>
);

export const PartyHat: React.FC<At> = p => (
  <g transform={at(p)}>
    <path d="M-15,0 L0,-34 L15,0 Z" {...shape('#7c6cff')} />
    <path d="M-10,-11 L9,-6 M-5,-23 L5,-20" stroke="#ffd23f" strokeWidth={3.2} strokeLinecap="round" />
    <circle cx={0} cy={-36} r={5} {...shape('#ff6b8b', 2.4)} />
  </g>
);

const Hand: React.FC<{ x: number; y: number; r?: number; fill: string }> = ({ x, y, r = 7.5, fill }) => (
  <circle cx={x} cy={y} r={r} {...shape(fill)} />
);

/** The word under a sticker: its colour, a white rim, then the ink outline. */
const Caption: React.FC<{ text: string; fill: string; x?: number; y?: number; size?: number }> = ({
  text,
  fill,
  x = 80,
  y = 151,
  size = 25
}) => {
  const fontSize = Math.min(size, Math.floor(150 / (text.length * 0.6)));
  const common = {
    x,
    y,
    textAnchor: 'middle' as const,
    fontFamily: 'Manrope, system-ui, sans-serif',
    fontWeight: 800,
    fontSize,
    letterSpacing: 0.3,
    strokeLinejoin: 'round' as const
  };
  return (
    <g>
      <text {...common} fill={INK} stroke={INK} strokeWidth={9}>
        {text}
      </text>
      <text {...common} fill={fill} stroke="#fff" strokeWidth={4.5} paintOrder="stroke">
        {text}
      </text>
    </g>
  );
};

// ---------------------------------------------------------------- the pack

/** How the whole sticker moves (index.css, ".stk-mover[data-m]"). */
type Motion =
  | 'bounce' | 'hop' | 'pulse' | 'squeeze' | 'shake' | 'sway' | 'wiggle' | 'pop' | 'tilt'
  | 'float' | 'melt' | 'run' | 'stretch' | 'none';

interface Drawing {
  motion: Motion;
  art: React.ReactNode;
  caption?: React.ReactNode;
}

/** A birthday cake with its candles lit, for the birthday stickers. */
const BirthdayCake: React.FC<At> = p => (
  <g transform={at(p)}>
    <ellipse cx={0} cy={36} rx={50} ry={7} {...shape('#eef2ff', 2.6)} />
    <rect x={-46} y={2} width={92} height={34} rx={8} {...shape('#ffb3c7')} />
    <path d="M-46,14 V8 Q-46,2 -38,2 H38 Q46,2 46,8 V14 Q40,22 34,14 Q27,24 20,14 Q12,22 4,14 Q-4,24 -12,14 Q-20,22 -28,14 Q-36,24 -46,14 Z" {...shape('#fff', 2.4)} />
    <rect x={-30} y={-24} width={60} height={28} rx={7} {...shape('#fff1d6')} />
    <path d="M-30,-14 V-18 Q-30,-24 -24,-24 H24 Q30,-24 30,-18 V-14 Q24,-7 18,-14 Q12,-6 6,-14 Q0,-7 -6,-14 Q-12,-6 -18,-14 Q-24,-7 -30,-14 Z" {...shape('#ff8fb1', 2.4)} />
    {[-16, 0, 16].map((x, i) => (
      <g key={x}>
        <rect x={x - 3} y={-44} width={6} height={20} rx={2} {...shape('#fff', 2.2)} />
        <path d={`M${x - 3},-36 L${x + 3},-40 M${x - 3},-29 L${x + 3},-33`} stroke={CONFETTI[i]} strokeWidth={2.4} />
        <Part cls="stk-beat" delay={i * 0.2}>
          <path d={`M${x},-58 C${x + 6},-50 ${x + 5},-46 ${x},-45 C${x - 5},-46 ${x - 6},-50 ${x},-58 Z`} {...shape('#ffd23f', 2)} />
        </Part>
      </g>
    ))}
  </g>
);

const ART: Record<string, Drawing> = {
  // ------------------------------------------------ the bear and the bunny
  hug: {
    motion: 'squeeze',
    art: (
      <>
        <Bear x={58} y={64} s={0.82} mood="happy" arms="none" />
        <Bunny x={104} y={70} s={0.78} mood="happy" arms="none" />
        {limb(92, 96, 14, 6.5, -18, BEAR)}
        {limb(70, 101, 13, 6, 16, BUNNY)}
        <Heart x={81} y={24} s={0.8} cls="stk-rise" />
        <Heart x={50} y={22} s={0.5} cls="stk-rise" delay={0.4} />
        <Heart x={130} y={34} s={0.55} cls="stk-rise" delay={0.8} />
      </>
    ),
    caption: <Caption text="hug!" fill="#ff6b8b" />
  },
  'love-you': {
    motion: 'bounce',
    art: (
      <Bear x={80} y={56} mood="happy" arms="hold">
        <Heart x={0} y={44} s={1.55} cls="stk-beat" />
      </Bear>
    ),
    caption: <Caption text="love you" fill={RED} />
  },
  mwah: {
    motion: 'hop',
    art: (
      <>
        <Bunny x={74} y={70} s={0.9} mood="kiss" />
        <Heart x={114} y={64} s={0.7} cls="stk-rise" />
        <Heart x={128} y={44} s={0.45} cls="stk-rise" delay={0.5} />
      </>
    ),
    caption: <Caption text="mwah" fill="#ff6b9a" />
  },
  'miss-you': {
    motion: 'sway',
    art: (
      <>
        <Bunny x={80} y={70} s={0.9} mood="cry" arms="hold">
          <Heart x={0} y={40} s={0.9} />
        </Bunny>
        <Drop x={64} y={82} s={0.8} cls="stk-drip" />
        <Drop x={96} y={82} s={0.8} cls="stk-drip" delay={0.5} />
      </>
    ),
    caption: <Caption text="miss you" fill="#5b9dff" />
  },
  saptiya: {
    motion: 'bounce',
    art: (
      <>
        <Bear x={80} y={54} mood="drool" arms="hold">
          <Bowl x={0} y={42} />
        </Bear>
        <Sparkle x={34} y={40} s={0.8} cls="stk-spin" />
      </>
    ),
    caption: <Caption text="saptiya?" fill="#ff9f43" />
  },
  'good-morning': {
    motion: 'stretch',
    art: (
      <>
        <Sun x={124} y={34} cls="stk-spin" />
        <Bear x={72} y={62} s={0.95} mood="yawn" arms="up" />
      </>
    ),
    caption: <Caption text="good morning" fill="#ffb000" />
  },
  'good-night': {
    motion: 'float',
    art: (
      <>
        <Sparkle x={28} y={34} s={0.7} cls="stk-blink" />
        <Sparkle x={138} y={84} s={0.55} cls="stk-blink" delay={0.6} />
        <Moon x={70} y={82} s={1.1} />
        <Bunny x={94} y={68} s={0.62} mood="sleep" head />
        <Zzz x={116} y={34} cls="stk-rise" />
      </>
    ),
    caption: <Caption text="good night" fill="#8e7bff" />
  },
  sorry: {
    motion: 'sway',
    art: (
      <Bunny x={80} y={70} s={0.9} mood="puppy" arms="hold">
        <Flower x={0} y={34} />
      </Bunny>
    ),
    caption: <Caption text="sorry" fill="#ff7aa2" />
  },
  hmph: {
    motion: 'shake',
    art: (
      <>
        <Bunny x={80} y={70} s={0.9} mood="angry" arms="cross" />
        <Puff x={36} y={58} cls="stk-rise" />
        <Puff x={126} y={58} cls="stk-rise" delay={0.4} />
        <Vein x={112} y={40} cls="stk-beat" />
      </>
    ),
    caption: <Caption text="hmph!" fill="#ff5252" />
  },
  'on-my-way': {
    motion: 'run',
    art: (
      <>
        <g stroke={INK} strokeWidth={3.4} strokeLinecap="round" opacity={0.55}>
          <path d="M16,66 L38,66 M10,84 L36,84 M18,102 L40,102" />
        </g>
        <Bear x={86} y={58} s={0.92} rot={8} mood="grin" arms="run" />
        <Drop x={124} y={36} s={0.8} fill="#bfe8ff" cls="stk-drip" />
      </>
    ),
    caption: <Caption text="on my way" fill="#2bb673" />
  },
  'call-me': {
    motion: 'wiggle',
    art: (
      <>
        <Bear x={76} y={58} mood="wink" arms="phone">
          <Phone x={33} y={-4} rot={18} />
        </Bear>
        <Part cls="stk-blink">
          <path d="M124,38 Q130,46 124,54 M131,32 Q141,46 131,60" {...line} stroke="#6c7bff" />
        </Part>
      </>
    ),
    caption: <Caption text="call me" fill="#6c7bff" />
  },
  hehe: {
    motion: 'wiggle',
    art: (
      <>
        <Bear x={80} y={58} mood="happy" arms="cover" />
        <Heart x={124} y={36} s={0.55} fill="#ff8fb1" cls="stk-rise" />
        <Heart x={36} y={42} s={0.45} fill="#ff8fb1" cls="stk-rise" delay={0.5} />
      </>
    ),
    caption: <Caption text="hehe" fill="#ff8fb1" />
  },
  yay: {
    motion: 'hop',
    art: (
      <>
        <Confetti
          cls="stk-blink"
          bits={[
            [24, 30, -20],
            [44, 14, 30],
            [118, 16, -35],
            [138, 38, 20],
            [20, 74, 45],
            [142, 80, -15]
          ]}
        />
        <Bunny x={80} y={74} s={0.86} mood="happy" arms="up" />
      </>
    ),
    caption: <Caption text="yay!" fill="#ffb000" />
  },
  chellam: {
    motion: 'squeeze',
    art: (
      <>
        <Bear x={58} y={80} s={0.85} rot={-8} mood="happy" head />
        <Bunny x={104} y={84} s={0.8} rot={8} mood="kiss" head />
        <Heart x={82} y={34} s={1.1} cls="stk-beat" />
      </>
    ),
    caption: <Caption text="chellam" fill="#ff4d8d" />
  },
  peek: {
    motion: 'none',
    art: (
      <>
        <Part cls="stk-peek">
          <Bunny x={80} y={112} mood="smile" head />
        </Part>
        <rect x={12} y={128} width={136} height={22} rx={10} {...shape('#ffd6e0')} />
        <ellipse cx={60} cy={130} rx={9} ry={7} {...shape(BUNNY)} />
        <ellipse cx={100} cy={130} rx={9} ry={7} {...shape(BUNNY)} />
      </>
    ),
    caption: <Caption text="hi!" fill="#ff7aa2" x={128} y={46} size={28} />
  },
  mine: {
    motion: 'wiggle',
    art: (
      <>
        <Bunny x={80} y={70} s={0.9} mood="smug" arms="hold">
          <Cookie x={0} y={40} s={1.05} />
        </Bunny>
        <circle cx={46} cy={118} r={2.4} fill="#c98b4a" />
        <circle cx={118} cy={114} r={2} fill="#c98b4a" />
      </>
    ),
    caption: <Caption text="mine!" fill="#d98a3d" />
  },

  // ------------------------------------------------------- funny faces
  lol: {
    motion: 'shake',
    art: (
      <>
        <Blob x={80} y={72} color="#ffd25e" mood="laugh" />
        <Drop x={30} y={60} rot={-60} cls="stk-drip" />
        <Drop x={130} y={60} rot={60} cls="stk-drip" delay={0.3} />
      </>
    ),
    caption: <Caption text="LOL" fill="#ff9f1c" size={30} />
  },
  seri: {
    motion: 'bounce',
    art: (
      <Blob x={76} y={72} color="#8fe3a6" mood="grin">
        <g className="stk-part stk-beat">
          <ellipse cx={50} cy={-14} rx={5.5} ry={10} {...shape('#8fe3a6')} />
          <circle cx={48} cy={2} r={11} {...shape('#8fe3a6')} />
        </g>
      </Blob>
    ),
    caption: <Caption text="seri" fill="#22a95b" />
  },
  enna: {
    motion: 'pop',
    art: (
      <>
        <Blob x={80} y={74} color="#c6a8ff" mood="shock">
          <Hand x={-40} y={14} fill="#c6a8ff" />
          <Hand x={40} y={14} fill="#c6a8ff" />
        </Blob>
        <Part cls="stk-beat">
          <text x={126} y={36} fontFamily="Manrope, system-ui, sans-serif" fontWeight={800} fontSize={30} fill="#8a5cff" stroke={INK} strokeWidth={2} paintOrder="stroke">
            ?!
          </text>
        </Part>
      </>
    ),
    caption: <Caption text="enna?!" fill="#8a5cff" />
  },
  noooo: {
    motion: 'sway',
    art: (
      <>
        <Blob x={80} y={70} color="#9fd3ff" mood="cry" />
        <Drop x={62} y={84} cls="stk-drip" />
        <Drop x={98} y={84} cls="stk-drip" delay={0.35} />
        <Drop x={58} y={102} s={0.8} cls="stk-drip" delay={0.7} />
        <Drop x={102} y={102} s={0.8} cls="stk-drip" delay={1} />
      </>
    ),
    caption: <Caption text="noooo" fill="#3f8cff" />
  },
  'so-cute': {
    motion: 'pulse',
    art: (
      <>
        <Blob x={80} y={74} color="#ffa6c9" mood="love" />
        <Heart x={30} y={36} s={0.6} cls="stk-rise" />
        <Heart x={132} y={30} s={0.7} cls="stk-rise" delay={0.4} />
        <Heart x={140} y={74} s={0.45} cls="stk-rise" delay={0.8} />
      </>
    ),
    caption: <Caption text="so cute" fill="#ff4d8d" />
  },
  grr: {
    motion: 'shake',
    art: (
      <>
        <Blob x={80} y={74} color="#ff7b6b" mood="angry" />
        <Puff x={34} y={30} cls="stk-rise" />
        <Puff x={126} y={30} cls="stk-rise" delay={0.4} />
        <Vein x={110} y={48} cls="stk-beat" />
      </>
    ),
    caption: <Caption text="grr" fill="#e63946" size={30} />
  },
  sleepy: {
    motion: 'sway',
    art: (
      <>
        <Blob x={76} y={74} color="#d8c8ff" mood="yawn" />
        <Zzz x={112} y={34} cls="stk-rise" />
      </>
    ),
    caption: <Caption text="sleepy" fill="#7d6bd6" />
  },
  cool: {
    motion: 'tilt',
    art: (
      <>
        <Blob x={80} y={74} color="#ffb86b" mood="smug">
          <Shades x={0} y={-6} />
        </Blob>
        <Sparkle x={128} y={36} cls="stk-spin" />
        <Sparkle x={32} y={44} s={0.6} cls="stk-spin" delay={0.5} />
      </>
    ),
    caption: <Caption text="cool" fill="#ff7b00" />
  },
  dying: {
    motion: 'melt',
    art: (
      <>
        <Blob x={80} y={76} color="#ffe066" mood="dead" melt />
        <Drop x={30} y={110} s={0.9} fill="#ffe066" />
      </>
    ),
    caption: <Caption text="dying" fill="#ff9f1c" />
  },
  ugh: {
    motion: 'tilt',
    art: <Blob x={80} y={74} color="#88e1d9" mood="roll" />,
    caption: <Caption text="ugh" fill="#14a39a" size={30} />
  },
  hmm: {
    motion: 'sway',
    art: (
      <>
        <Blob x={74} y={76} color="#ffd9a8" mood="think">
          <Hand x={22} y={34} fill="#ffd9a8" />
        </Blob>
        <Part cls="stk-blink">
          <circle cx={116} cy={36} r={4} {...shape('#fff', 2.2)} />
        </Part>
        <Part cls="stk-blink" delay={0.25}>
          <circle cx={128} cy={24} r={5.5} {...shape('#fff', 2.2)} />
        </Part>
        <Part cls="stk-blink" delay={0.5}>
          <circle cx={143} cy={12} r={7} {...shape('#fff', 2.2)} />
        </Part>
      </>
    ),
    caption: <Caption text="hmm…" fill="#c07a2c" />
  },
  party: {
    motion: 'hop',
    art: (
      <>
        <Confetti
          cls="stk-blink"
          bits={[
            [22, 40, 25],
            [40, 18, -30],
            [126, 20, 40],
            [140, 54, -20],
            [24, 92, -40],
            [138, 100, 30]
          ]}
        />
        <Blob x={80} y={78} color="#ffb3d1" mood="happy">
          <PartyHat x={14} y={-38} rot={16} />
        </Blob>
      </>
    ),
    caption: <Caption text="party!" fill="#ff3d8b" />
  },
  // ------------------------------------------------ on a birthday
  'happy-birthday': {
    motion: 'bounce',
    art: (
      <>
        <Confetti
          cls="stk-blink"
          bits={[
            [24, 30, 25],
            [136, 26, -30],
            [18, 84, -20],
            [142, 80, 35]
          ]}
        />
        <BirthdayCake x={80} y={86} />
      </>
    ),
    caption: <Caption text="happy birthday!" fill="#ff3d8b" />
  },
  'party-bear': {
    motion: 'hop',
    art: (
      <>
        <Confetti
          cls="stk-blink"
          bits={[
            [22, 34, 25],
            [138, 30, -30],
            [26, 96, -40],
            [136, 100, 30]
          ]}
        />
        <Bear x={80} y={62} mood="laugh" arms="up">
          <PartyHat x={6} y={-26} rot={14} s={0.85} />
        </Bear>
      </>
    ),
    caption: <Caption text="yaaay!" fill="#7c6cff" />
  },
  'my-day': {
    motion: 'pulse',
    art: (
      <>
        <Bunny x={80} y={66} mood="love" arms="hold">
          <PartyHat x={-2} y={-25} rot={-8} s={0.78} />
        </Bunny>
        <Heart x={130} y={34} s={0.6} cls="stk-rise" />
        <Heart x={28} y={44} s={0.5} cls="stk-rise" delay={0.5} />
      </>
    ),
    caption: <Caption text="it's my day!" fill="#ff6b8b" />
  },
  nope: {
    motion: 'shake',
    art: (
      <Blob x={80} y={72} color="#b7c3d9" mood="tight">
        <rect x={-6} y={22} width={12} height={34} rx={6} transform="rotate(45 0 39)" {...shape('#b7c3d9')} />
        <rect x={-6} y={22} width={12} height={34} rx={6} transform="rotate(-45 0 39)" {...shape('#b7c3d9')} />
      </Blob>
    ),
    caption: <Caption text="nope" fill="#5b6b8c" />
  },
  pls: {
    motion: 'sway',
    art: (
      <>
        <Blob x={80} y={72} color="#ffe4b8" mood="puppy">
          <Hand x={-7} y={34} fill="#ffe4b8" />
          <Hand x={7} y={34} fill="#ffe4b8" />
        </Blob>
        <Sparkle x={34} y={34} s={0.7} cls="stk-blink" />
        <Sparkle x={128} y={40} s={0.55} cls="stk-blink" delay={0.5} />
      </>
    ),
    caption: <Caption text="pls" fill="#ff8a3d" size={30} />
  }
};

export function hasStickerArt(id: string | undefined): id is string {
  return !!id && id in ART;
}

// Only what is on screen moves: one watcher for every sticker, and each
// starts its moves again as it comes back into view.
let watcher: IntersectionObserver | null = null;
const onSeen = new Map<Element, () => void>();
function watchInView(el: Element, seen: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    seen();
    return () => {};
  }
  watcher ??= new IntersectionObserver(
    entries => {
      for (const entry of entries) if (entry.isIntersecting) onSeen.get(entry.target)?.();
    },
    { threshold: 0.6 }
  );
  onSeen.set(el, seen);
  watcher.observe(el);
  return () => {
    onSeen.delete(el);
    watcher?.unobserve(el);
  };
}

interface StickerArtProps {
  id: string;
  size: number;
  /** For the tray: drawn still, and nothing watches it. */
  still?: boolean;
  /** Tapping it plays it again. Put in the chat, a button. */
  onTapLabel?: string;
}

/** One sticker, `size` pixels square - or nothing, for a name this version does not know. */
export const StickerArt: React.FC<StickerArtProps> = ({ id, size, still, onTapLabel }) => {
  const drawing = ART[id];
  const ref = useRef<HTMLElement>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (still || !el) return;
    return watchInView(el, () => setRound(r => r + 1));
  }, [still]);
  if (!drawing) return null;

  const label = stickerInfo(id)?.label || 'Sticker';
  const svg = (
    // A fresh drawing each round, so its moves start from the beginning. The
    // whole sticker moves as a layer of its own (stk-mover, index.css) - a
    // move the phone's graphics chip makes by itself, so a chat full of
    // stickers scrolls as smoothly as one of words.
    <span key={round} className="stk-mover" data-m={drawing.motion}>
      <svg viewBox="0 0 160 160" width={size} height={size} aria-hidden="true" focusable="false" className="block overflow-visible">
        <g className="stk-body">{drawing.art}</g>
        {drawing.caption}
      </svg>
    </span>
  );
  const props = {
    className: 'stk block',
    'data-play': !still && round > 0 ? 'true' : undefined,
    style: { width: size, height: size }
  };
  return onTapLabel ? (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type="button"
      // Waits a moment before it plays, in case a second tap is coming for a heart.
      data-tap-wait
      onClick={() => setRound(r => r + 1)}
      aria-label={onTapLabel}
      {...props}
    >
      {svg}
    </button>
  ) : (
    // In the tray its button says what it is.
    <span
      ref={ref as React.RefObject<HTMLSpanElement>}
      {...(still ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
      {...props}
    >
      {svg}
    </span>
  );
};
