import React from 'react';
import { Face, PartyHat, type Mood } from './StickerArt';
import type { Wear } from '../core/wear';
import { WornGlasses, WornHat, WornNeck } from './WearArt';

const INK = '#3b2723';
export const FUR = { bear: '#c4895a', bunny: '#fffaf3' } as const;
const MUZZLE = '#f3dcbd';
const BEAR_EAR = '#ef9f98';
const BUNNY_EAR = '#ffb7c8';
const BLUSH = '#ff7d9a';

export type RigKind = 'bear' | 'bunny';
export type RigArms = 'down' | 'up' | 'hold';
/** The parts of a character that are moved by its plays (usMoves). */
export type RigLayer =
  | 'hop' | 'lean' | 'squash' | 'head' | 'stretch' | 'earL' | 'earR' | 'armL' | 'armR' | 'blush' | 'shadow'
  /** The face from the front - turned a little toward the other, or faded for the side view. */
  | 'face'
  /** The face from the side, toward the other one: hidden until a kiss or a nose rub fades it in. */
  | 'side';
export type RigLayers = Partial<Record<RigLayer, HTMLDivElement | null>>;

/**
 * The box every part is drawn in, in the character's own units - the
 * sticker's, with the middle of its head at 0,0. Room for a bunny's ears
 * flopping above and its name below its feet.
 */
export const BOX = { x: -56, y: -82, w: 112, h: 160 };
const VIEW = `${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`;
/** A point of the character, as a place in its box. */
export const at = (x: number, y: number) => `${((x - BOX.x) / BOX.w) * 100}% ${((y - BOX.y) / BOX.h) * 100}%`;
/** Where its feet meet the ground: what it hops, leans and squashes from. */
export const FEET = 67;

/** Where each one's parts are and turn, on its right side (x is mirrored for the left). */
export const JOINTS: Record<
  RigKind,
  {
    neck: number;
    shoulder: [number, number];
    ear: [number, number];
    eyes: [number, number];
    mouth: number;
    cheek: [number, number];
    nose: number;
    top: number;
    tummy: number;
  }
> = {
  bear: { neck: 26, shoulder: [17, 31], ear: [16, -15], eyes: [11, -6], mouth: 11, cheek: [20, 6], nose: 4.5, top: -30, tummy: 42 },
  bunny: { neck: 24, shoulder: [16, 30], ear: [9, -27], eyes: [11, -3], mouth: 10, cheek: [19, 7], nose: 5.5, top: -27, tummy: 41 }
};

const shape = (fill: string, width = 3) => ({ fill, stroke: INK, strokeWidth: width, strokeLinejoin: 'round' as const });

/** One part's drawing, in the character's box. */
const Art: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox={VIEW} className="rig-art" overflow="visible" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/**
 * A layer of the character: the whole box, turning about one of its points.
 * Only ever moved or faded, so once drawn it is never drawn again - the
 * phone's graphics chip does the moving by itself.
 */
const Layer = React.forwardRef<
  HTMLDivElement,
  { origin?: [number, number]; className?: string; style?: React.CSSProperties; children?: React.ReactNode }
>(({ origin, className, style, children }, ref) => (
  <div
    ref={ref}
    className={className ? `rig-l ${className}` : 'rig-l'}
    style={origin ? { transformOrigin: at(origin[0], origin[1]), ...style } : style}
  >
    {children}
  </div>
));
Layer.displayName = 'RigLayer';

/** The moods drawn with eyes open, which blink. */
const OPEN_EYES = new Set<Mood>(['smile', 'grin', 'sad', 'angry', 'puppy']);

const limb = (side: 1 | -1, fill: string) => (
  <ellipse cx={23 * side} cy={40} rx={7} ry={11} transform={`rotate(${-25 * side} ${23 * side} 40)`} {...shape(fill)} />
);

function body(kind: RigKind): React.ReactNode {
  const fur = FUR[kind];
  return kind === 'bear' ? (
    <>
      <ellipse cx={-12} cy={61} rx={9} ry={6} {...shape(fur)} />
      <ellipse cx={12} cy={61} rx={9} ry={6} {...shape(fur)} />
      <ellipse cx={0} cy={42} rx={24} ry={21} {...shape(fur)} />
      <ellipse cx={0} cy={46} rx={14} ry={12} fill={MUZZLE} />
    </>
  ) : (
    <>
      <ellipse cx={-12} cy={60} rx={9} ry={6} {...shape(fur)} />
      <ellipse cx={12} cy={60} rx={9} ry={6} {...shape(fur)} />
      <ellipse cx={0} cy={41} rx={23} ry={20} {...shape(fur)} />
    </>
  );
}

function ear(kind: RigKind, side: 1 | -1): React.ReactNode {
  if (kind === 'bear') {
    return (
      <>
        <circle cx={22 * side} cy={-21} r={11} {...shape(FUR.bear)} />
        <circle cx={22 * side} cy={-21} r={5.5} fill={BEAR_EAR} />
      </>
    );
  }
  return (
    <g transform={`rotate(${12 * side} ${13 * side} -46)`}>
      <ellipse cx={13 * side} cy={-46} rx={8.5} ry={23} {...shape(FUR.bunny)} />
      <ellipse cx={13 * side} cy={-43} rx={4} ry={15} fill={BUNNY_EAR} />
    </g>
  );
}

function skull(kind: RigKind): React.ReactNode {
  return kind === 'bear' ? (
    <circle cx={0} cy={0} r={30} {...shape(FUR.bear)} />
  ) : (
    <>
      <ellipse cx={0} cy={0} rx={30} ry={27} {...shape(FUR.bunny)} />
      {/* The bow, on the right ear. */}
      <g transform="translate(17 -25) rotate(18)">
        <path d="M0,0 L-9,-6 L-9,6 Z M0,0 L9,-6 L9,6 Z" {...shape('#ff8fb1', 2.5)} />
        <circle cx={0} cy={0} r={2.8} {...shape('#ff8fb1', 2.5)} />
      </g>
    </>
  );
}

/** The muzzle and nose, from the front. */
function features(kind: RigKind): React.ReactNode {
  return kind === 'bear' ? (
    <>
      <ellipse cx={0} cy={9} rx={13} ry={9.5} fill={MUZZLE} />
      <ellipse cx={0} cy={4.5} rx={4.6} ry={3.3} fill={INK} />
    </>
  ) : (
    <path d="M-3,4 L3,4 L0,7 Z" fill="#ff8fa8" stroke="#ff8fa8" strokeWidth={2} strokeLinejoin="round" />
  );
}

/**
 * Where the tip of the nose is, and the puckered lips, in the side view
 * (facing right): what a nose rub touches nose to, and a kiss lands with.
 */
export const NOSE_TIP: Record<RigKind, [number, number]> = { bear: [42, 2.5], bunny: [36.5, 3.5] };
export const PUCKER: Record<RigKind, [number, number]> = { bear: [43, 10.5], bunny: [37, 9] };

// The snout from the side, poking out past the round of the head: from a
// point on the head's edge, round the tip, back to the edge.
const SNOUT: Record<RigKind, string> = {
  bear: 'M29.5,-5 C36,-6 41.5,-1 41.5,6 C41.5,13 34,17 25.4,16',
  bunny: 'M29.8,-3 C34.5,-2 37,3 35.5,8 C34.5,11.5 31,12.6 27.4,11'
};

/**
 * The face from the side, facing right (the layer it is in turns it round
 * to face the other one): an eye closed happily, a small smile under the
 * snout - or lips puckered at its tip for a kiss - and a blush.
 */
function profile(kind: RigKind, mood: Mood): React.ReactNode {
  const bear = kind === 'bear';
  const line = { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const };
  const [px, py] = PUCKER[kind];
  return (
    <>
      <path d={`${SNOUT[kind]} Z`} fill={bear ? MUZZLE : FUR.bunny} />
      <path d={SNOUT[kind]} {...line} />
      {bear ? (
        <ellipse cx={39.5} cy={2.5} rx={3.6} ry={3} fill={INK} />
      ) : (
        <path d="M34,1 L37.2,3.2 L34,5.6 Z" fill="#ff8fa8" stroke="#ff8fa8" strokeWidth={1.6} strokeLinejoin="round" />
      )}
      <path d={bear ? 'M8,-8 Q12.5,-12.5 17,-8' : 'M9,-5 Q13,-9.5 17,-5'} {...line} />
      {mood === 'kiss' ? (
        <path d={`M${px - 1.5},${py - 2.5} q3.4,0.6 1,2.6 q3.4,0.8 -0.4,3`} {...line} strokeWidth={2.4} />
      ) : (
        <path d={bear ? 'M30,12.5 Q34,15 38,11.5' : 'M28,13.5 Q31,15.5 34,12.5'} {...line} strokeWidth={2.4} />
      )}
      <ellipse cx={13} cy={bear ? 6 : 8} rx={6.2} ry={3.8} fill={BLUSH} opacity={0.8} />
    </>
  );
}

interface RigProps {
  kind: RigKind;
  mood: Mood;
  arms: RigArms;
  asleep?: boolean;
  /** Seconds into its idle moves, so the two never blink or twitch together. */
  phase?: number;
  /** Filled with its moving layers, for its plays (usMoves). */
  layers: React.MutableRefObject<RigLayers>;
  /** A party hat, on a birthday. */
  hat?: boolean;
  /** What it has been dressed in (core/wear): a hat, glasses, something round the neck. */
  wear?: Wear;
  /** Which way the other one is - what its face from the side looks toward: 1 right, -1 left. */
  facing?: 1 | -1;
  /** Drawn in front of it and moving with it: an arm reaching out, a pillow held up. */
  children?: React.ReactNode;
}

/**
 * The bear or the bunny of "Us two" (UsScene), in parts that move on their
 * own: its body hops, leans and squashes from its feet, its head tilts from
 * its neck and its ears flop after it, its arms turn at the shoulder. It
 * breathes, sways, blinks and twitches an ear by itself; everything else is
 * done to it by a play.
 */
export const Rig: React.FC<RigProps> = ({ kind, mood, arms, asleep, phase = 0, layers, hat, wear, facing = 1, children }) => {
  const j = JOINTS[kind];
  const fur = FUR[kind];
  const set = (name: RigLayer) => (el: HTMLDivElement | null) => {
    layers.current[name] = el;
  };
  const after = (s: number): React.CSSProperties => ({ animationDelay: `${-(phase + s)}s` });
  const [ex, ey] = j.eyes;
  const lid = mood === 'puppy' ? 6.8 : 4.8;
  const ears = ([-1, 1] as const).map(side => (
    <Layer key={side} ref={set(side < 0 ? 'earL' : 'earR')} origin={[j.ear[0] * side, j.ear[1]]}>
      <Layer
        className="rig-twitch"
        origin={[j.ear[0] * side, j.ear[1]]}
        style={{ ['--s' as string]: -side, ...after(side < 0 ? 1.3 : 4.2) }}
      >
        <Art>{ear(kind, side)}</Art>
      </Layer>
    </Layer>
  ));
  return (
    <div className="rig" data-arms={arms} data-asleep={asleep || undefined}>
      <Layer ref={set('shadow')} origin={[0, FEET]}>
        <Art>
          <ellipse cx={0} cy={FEET} rx={27} ry={5} className="rig-shadow" />
        </Art>
      </Layer>
      <Layer ref={set('hop')} origin={[0, FEET]}>
        <Layer ref={set('lean')} origin={[0, FEET]}>
          <Layer className="rig-sway" origin={[0, FEET]} style={after(0)}>
            <Layer ref={set('squash')} origin={[0, FEET]}>
              <Layer className="rig-breathe" origin={[0, FEET]} style={after(0.8)}>
                <Art>{body(kind)}</Art>
                <Layer ref={set('head')} className="rig-head" origin={[0, j.neck]}>
                  <Layer ref={set('stretch')}>
                    {ears}
                    <Art>
                      {skull(kind)}
                      {hat &&
                        (kind === 'bear' ? (
                          <PartyHat x={6} y={-26} rot={14} s={0.85} />
                        ) : (
                          <PartyHat x={-1} y={-24} rot={-6} s={0.74} />
                        ))}
                      {/* Its own hat, on any day that is not a birthday. */}
                      {!hat && <WornHat kind={kind} wear={wear} />}
                    </Art>
                    <Layer ref={set('face')} origin={[0, 0]}>
                      <Art>
                        {features(kind)}
                        <Face mood={mood} ex={ex} ey={ey} my={j.mouth} blush={{ x: j.cheek[0], y: j.cheek[1] }} />
                      </Art>
                      <Layer ref={set('blush')} className="rig-blush">
                        <Art>
                          <g fill={BLUSH}>
                            <ellipse cx={-j.cheek[0]} cy={j.cheek[1]} rx={7.5} ry={4.6} />
                            <ellipse cx={j.cheek[0]} cy={j.cheek[1]} rx={7.5} ry={4.6} />
                          </g>
                        </Art>
                      </Layer>
                      {OPEN_EYES.has(mood) && (
                        <Layer className="rig-lids" style={after(phase * 1.7)}>
                          <Art>
                            {[-ex, ex].map(x => (
                              <g key={x}>
                                <circle cx={x} cy={ey} r={lid} fill={fur} />
                                <path
                                  d={`M${x - 4.5},${ey - 0.5} Q${x},${ey + 3.5} ${x + 4.5},${ey - 0.5}`}
                                  fill="none"
                                  stroke={INK}
                                  strokeWidth={3}
                                  strokeLinecap="round"
                                />
                              </g>
                            ))}
                          </Art>
                        </Layer>
                      )}
                      {/* Glasses go on over the eyelids, so a blink does not wipe them away. */}
                      {wear?.eyes && (
                        <Art>
                          <WornGlasses kind={kind} wear={wear} />
                        </Art>
                      )}
                    </Layer>
                    <Layer ref={set('side')} className="rig-side" origin={[0, 0]} style={{ transform: `scaleX(${facing})` }}>
                      <Art>{profile(kind, mood)}</Art>
                    </Layer>
                  </Layer>
                </Layer>
                {wear?.neck && (
                  <Art>
                    <WornNeck kind={kind} wear={wear} />
                  </Art>
                )}
                <Layer ref={set('armL')} className="rig-arm rig-arm-l" origin={[-j.shoulder[0], j.shoulder[1]]}>
                  <Art>{limb(-1, fur)}</Art>
                </Layer>
                <Layer ref={set('armR')} className="rig-arm rig-arm-r" origin={[j.shoulder[0], j.shoulder[1]]}>
                  <Art>{limb(1, fur)}</Art>
                </Layer>
                {children}
              </Layer>
            </Layer>
          </Layer>
        </Layer>
      </Layer>
    </div>
  );
};

/**
 * An arm stretched out to the other one - a bendy cartoon arm, from a
 * shoulder to a point, both in the character's own units. It shoots out,
 * does its move and springs back by its own animation (index.css), named in
 * `move`; `wiggle`, if given, moves the paw while it is out.
 */
export const ReachArm: React.FC<{
  kind: RigKind;
  from: [number, number];
  to: [number, number];
  /** 1 when the other one is to its right. */
  d: 1 | -1;
  move: string;
  ms: number;
  delay: number;
  wiggle?: string;
  wiggleDelay?: number;
  /** How far the elbow bows out. */
  bow?: number;
  /** Held in the paw, drawn pointing along the arm from it: a spoon, a flower. */
  item?: React.ReactNode;
}> = ({ kind, from, to, d, move, ms, delay, wiggle, wiggleDelay = 0, bow = 6, item }) => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.max(8, Math.hypot(dx, dy));
  const turn = (Math.atan2(dy, dx) * 180) / Math.PI;
  const half = 14;
  const wide = len + 9;
  const fur = FUR[kind];
  const arm = `M0,0 Q${len / 2},${-bow * d} ${len},0`;
  return (
    <div
      className="rig-reach"
      style={{
        left: `${((from[0] - BOX.x) / BOX.w) * 100}%`,
        top: `${((from[1] - half - BOX.y) / BOX.h) * 100}%`,
        width: `${(wide / BOX.w) * 100}%`,
        height: `${((half * 2) / BOX.h) * 100}%`,
        transform: `rotate(${turn}deg)`,
        ['--d' as string]: d
      }}
    >
      <div className={move} style={{ animationDuration: `${ms}ms`, animationDelay: `${delay}ms` }}>
        <div className={wiggle} style={wiggle ? { animationDelay: `${wiggleDelay}ms`, animationDuration: wiggle === 'rig-pat' ? `${ms}ms` : undefined } : undefined}>
          <svg viewBox={`0 ${-half} ${wide} ${half * 2}`} aria-hidden="true" focusable="false">
            <path d={arm} fill="none" stroke={INK} strokeWidth={12} strokeLinecap="round" />
            <path d={arm} fill="none" stroke={fur} strokeWidth={7.2} strokeLinecap="round" />
            {/* Turned back up the right way when the arm points left. */}
            {item && <g transform={`translate(${len} 0) scale(1 ${d})`}>{item}</g>}
            <circle cx={len} cy={0} r={6.8} {...shape(fur, 2.6)} />
          </svg>
        </div>
      </div>
    </div>
  );
};

/** A pillow, drawn at a point of whatever it is in. */
export const Pillow: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path
      d="M-18,-10 Q0,-15 18,-10 Q22,0 18,10 Q0,15 -18,10 Q-22,0 -18,-10 Z"
      fill="#fdfbff"
      stroke={INK}
      strokeWidth={2.6}
      strokeLinejoin="round"
    />
    <path d="M-11,-1 Q0,3 11,-1" fill="none" stroke="#d6cdee" strokeWidth={2.4} strokeLinecap="round" />
    <path d="M-18,-10 l-4,-3 M18,-10 l4,-3 M-18,10 l-4,3 M18,10 l4,3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
  </g>
);

/**
 * A pillow held up over its head, swung back and let go (index.css,
 * rig-held) - let go 80% of the way through `ms`.
 */
export const HeldPillow: React.FC<{ d: 1 | -1; ms?: number }> = ({ d, ms = 540 }) => (
  <Layer className="rig-held" origin={[0, -44]} style={{ ['--d' as string]: d, animationDuration: `${ms}ms` }}>
    <Art>
      <Pillow x={0} y={-44} />
    </Art>
  </Layer>
);

/** A water balloon, drawn at a point of whatever it is in. */
export const WaterBalloon: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0,-12 C7,-12 11,-6 11,0 C11,7 5,11 0,11 C-5,11 -11,7 -11,0 C-11,-6 -7,-12 0,-12 Z" {...shape('#7cc8ff', 2.4)} />
    <path d="M-2.5,11 L2.5,11 L0,14.5 Z" {...shape('#7cc8ff', 1.6)} />
    <ellipse cx={-4.5} cy={-5} rx={2.2} ry={3.6} transform="rotate(20 -4.5 -5)" fill="#fff" opacity={0.65} />
  </g>
);

/** A water balloon held up over its head and lobbed, like a pillow (rig-held). */
export const HeldBalloon: React.FC<{ d: 1 | -1; ms?: number }> = ({ d, ms = 540 }) => (
  <Layer className="rig-held" origin={[0, -44]} style={{ ['--d' as string]: d, animationDuration: `${ms}ms` }}>
    <Art>
      <WaterBalloon x={0} y={-44} s={1.1} />
    </Art>
  </Layer>
);

/**
 * Something held or worn for a play, in the character's own units - a bowl,
 * a flower taken, a blanket. It comes and goes by its own animation
 * (index.css): rig-prop pops in, stays and goes.
 */
export const RigProp: React.FC<{ className?: string; origin: [number, number]; ms: number; delay: number; children: React.ReactNode }> = ({
  className = 'rig-prop',
  origin,
  ms,
  delay,
  children
}) => (
  <Layer className={className} origin={origin} style={{ animationDuration: `${ms}ms`, animationDelay: `${delay}ms` }}>
    <Art>{children}</Art>
  </Layer>
);

/** A bowl of rice, at a point. */
export const RiceBowl: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M-10,-3 Q-6,-11 0,-10 Q6,-11 10,-3 Z" {...shape('#fff', 1.6)} />
    <path d="M-13,-3 L13,-3 C13,6 7,11 0,11 C-7,11 -13,6 -13,-3 Z" {...shape('#ff8a65', 2.2)} />
    <path d="M-7,3 L7,3" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
  </g>
);

/**
 * A spoonful, held in a paw (ReachArm's item) and pointing on from it. Its
 * rice is gone once it is eaten (index.css, rig-eaten) - over `ms`, after
 * `delay`, like the arm that holds it.
 */
export const Spoon: React.FC<{ ms: number; delay: number }> = ({ ms, delay }) => (
  <g>
    <path d="M-3,0 L13,0" stroke={INK} strokeWidth={5} strokeLinecap="round" />
    <path d="M-3,0 L13,0" stroke="#d9dee8" strokeWidth={2.6} strokeLinecap="round" />
    <ellipse cx={17} cy={0} rx={5.5} ry={3.6} {...shape('#e6eaf1', 1.8)} />
    <g className="rig-eaten" style={{ animationDuration: `${ms}ms`, animationDelay: `${delay}ms` }}>
      <circle cx={16} cy={-2.6} r={3} {...shape('#fff', 1.2)} />
      <circle cx={19.5} cy={-2} r={2.4} {...shape('#fff', 1.2)} />
      <circle cx={13.5} cy={-1.6} r={2} {...shape('#fff', 1.2)} />
    </g>
  </g>
);

const twinkle = (x: number, y: number) => `M${x},${y - 4} L${x + 1},${y - 1} L${x + 4},${y} L${x + 1},${y + 1} L${x},${y + 4} L${x - 1},${y + 1} L${x - 4},${y} L${x - 1},${y - 1} Z`;

/** A starry bedsheet, folded, held up over the head (in the character's own units): the one tucking someone in. */
export const FoldedSheet: React.FC = () => (
  <g>
    <rect x={-26} y={-72} width={52} height={20} rx={5} {...shape('#b8a6ff', 2.4)} />
    <path d="M-23,-62 L23,-62" stroke="#e6defe" strokeWidth={3} strokeLinecap="round" />
    <path d={twinkle(-12, -67)} fill="#fff6c2" />
    <path d={twinkle(11, -57)} fill="#fff6c2" />
  </g>
);
