import React, { useEffect, useRef, useState } from 'react';
import { Smile, Volume2, VolumeX } from 'lucide-react';
import { getAudioContext } from '../core/audioAlerts';
import { useBackLayer } from '../core/backStack';
import {
  EMOTES,
  EMOTE_EVERY_MS,
  EMOTE_MS,
  HERE_EVERY_MS,
  emotesMuted,
  leaveRoom,
  muteEmotes,
  onGameSaid,
  sayInGame,
  showRoom,
  theyAreHere,
  type Emote,
  type GameRoom
} from '../core/gameEmotes';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { loadSounds, playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import { wearOf } from '../core/wear';
import { WornOnFace } from './WearArt';

// Emotes in the games (core/gameEmotes): each of you as your own one - the
// bear in the first seat, the bunny in the second - pulling a face, with a
// sound, in a bubble by your name. Every face is one small picture; what
// moves in it is moved by CSS (index.css, .em-*).

type Animal = 'bear' | 'bunny';
const INK = '#3b2723';

/** Where the features of each face sit, in its own 48-unit square. */
const LOOK = {
  bear: { fur: '#c98a55', ex: [16.6, 31.4], ey: 24.2, my: 35.6, head: { cx: 24, cy: 27, rx: 17.5, ry: 17.5 }, horns: [17.2, 30.8], hornY: 11.4 },
  bunny: { fur: '#fbf5ee', ex: [17.2, 30.8], ey: 28.4, my: 38.2, head: { cx: 24, cy: 30.5, rx: 16.5, ry: 14.5 }, horns: [17.6, 30.4], hornY: 18 }
} as const;

/** The head with nothing on it but ears, and a nose. */
const Head: React.FC<{ animal: Animal }> = ({ animal }) =>
  animal === 'bear' ? (
    <>
      <circle cx={11.5} cy={13} r={7} fill="#c98a55" stroke={INK} strokeWidth={2} />
      <circle cx={11.5} cy={13} r={3.2} fill="#a66c3d" />
      <circle cx={36.5} cy={13} r={7} fill="#c98a55" stroke={INK} strokeWidth={2} />
      <circle cx={36.5} cy={13} r={3.2} fill="#a66c3d" />
      <circle cx={24} cy={27} r={17.5} fill="#c98a55" stroke={INK} strokeWidth={2} />
      <ellipse cx={24} cy={32.5} rx={8.5} ry={6.5} fill="#f3d9b5" />
      <ellipse cx={24} cy={29.6} rx={3.2} ry={2.3} fill={INK} />
    </>
  ) : (
    <>
      <path d="M12.5,22 C8.5,10 10.5,2.5 15.5,2.5 C20.5,2.5 21,11 20,21 Z" fill="#fbf5ee" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <path d="M14.4,19 C12.4,11.5 13.2,6.5 15.5,6.5 C17.8,6.5 17.9,12 17.4,18.5 Z" fill="#f9a8c0" />
      <path d="M35.5,22 C39.5,10 37.5,2.5 32.5,2.5 C27.5,2.5 27,11 28,21 Z" fill="#fbf5ee" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <path d="M33.6,19 C35.6,11.5 34.8,6.5 32.5,6.5 C30.2,6.5 30.1,12 30.6,18.5 Z" fill="#f9a8c0" />
      <ellipse cx={24} cy={30.5} rx={16.5} ry={14.5} fill="#fbf5ee" stroke={INK} strokeWidth={2} />
      <path d="M22.3,32.4 H25.7 L24,34.4 Z" fill="#f47a9b" stroke={INK} strokeWidth={1} strokeLinejoin="round" />
    </>
  );

const line = { fill: 'none', stroke: INK, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// ------------------------------------------------------------------- eyes
const eyeOpen = (x: number, y: number, r = 2.2) => (
  <g key={`o${x}`}>
    <circle cx={x} cy={y} r={r} fill={INK} />
    <circle cx={x + 0.7} cy={y - 0.7} r={r * 0.32} fill="#fff" />
  </g>
);
/** Shut and happy: an arch. */
const eyeArch = (x: number, y: number) => <path key={`a${x}`} d={`M${x - 3},${y + 1.2} Q${x},${y - 3.4} ${x + 3},${y + 1.2}`} {...line} strokeWidth={1.9} />;
/** Screwed up tight: > and <. */
const eyeTight = (x: number, y: number, left: boolean) => {
  const s = left ? 1 : -1;
  return <path key={`t${x}`} d={`M${x - 2.6 * s},${y - 2.4} L${x + 2.4 * s},${y} L${x - 2.6 * s},${y + 2.4}`} {...line} strokeWidth={1.9} />;
};
/** Shut and sleepy: a dip. */
const eyeSleepy = (x: number, y: number) => <path key={`s${x}`} d={`M${x - 3},${y - 0.4} Q${x},${y + 2.6} ${x + 3},${y - 0.4}`} {...line} strokeWidth={1.9} />;
const eyeWide = (x: number, y: number) => (
  <g key={`w${x}`}>
    <circle cx={x} cy={y} r={3.9} fill="#fff" stroke={INK} strokeWidth={1.5} />
    <circle cx={x} cy={y} r={1.5} fill={INK} />
  </g>
);
/** A brow drawn down towards the nose. */
const browCross = (x: number, y: number, left: boolean) => {
  const s = left ? 1 : -1;
  return <path key={`b${x}`} d={`M${x - 4.2 * s},${y - 6.6} L${x + 3.4 * s},${y - 3.6}`} {...line} strokeWidth={2} />;
};
/** A brow lifted high. */
const browUp = (x: number, y: number) => <path key={`u${x}`} d={`M${x - 3.2},${y - 6.8} Q${x},${y - 8.8} ${x + 3.2},${y - 6.8}`} {...line} strokeWidth={1.6} />;

const cheeks = (animal: Animal, strong = false) => {
  const y = animal === 'bear' ? 30.6 : 34;
  return (
    <>
      <ellipse cx={12.5} cy={y} rx={2.8} ry={1.9} fill="#f58aa0" opacity={strong ? 0.95 : 0.6} />
      <ellipse cx={35.5} cy={y} rx={2.8} ry={1.9} fill="#f58aa0" opacity={strong ? 0.95 : 0.6} />
    </>
  );
};

/** A tear, its point up, round a point. */
const drop = (x: number, y: number, size = 1) => `M${x},${y - 2.6 * size} C${x + 2.4 * size},${y + 0.6 * size} ${x + 1.6 * size},${y + 2.6 * size} ${x},${y + 2.6 * size} C${x - 1.6 * size},${y + 2.6 * size} ${x - 2.4 * size},${y + 0.6 * size} ${x},${y - 2.6 * size} Z`;
const HEART = 'M0,3 C-4.5,-0.5 -4,-4 -1.75,-4 C-0.75,-4 -0.2,-3.4 0,-2.8 C0.2,-3.4 0.75,-4 1.75,-4 C4,-4 4.5,-0.5 0,3 Z';
const SPARK = 'M0,-4 L1,-1 L4,0 L1,1 L0,4 L-1,1 L-4,0 L-1,-1 Z';

interface FaceProps {
  emote: Emote['id'];
  /** Whose it is: the bear in the first seat, the bunny in the second. */
  seat: Seat;
  /** Held still, for its key in the tray. */
  still?: boolean;
}

/** One emote, as the bear or the bunny. */
export const EmoteFace: React.FC<FaceProps> = ({ emote, seat, still }) => {
  const animal: Animal = seat === 'user' ? 'bear' : 'bunny';
  const L = LOOK[animal];
  const [x0, x1] = L.ex;
  const ey = L.ey;
  const my = L.my;
  const dark = '#7a2333';

  let move = 'none';
  let face: React.ReactNode = null;
  /** Things round the head that do not move with it. */
  let around: React.ReactNode = null;

  switch (emote) {
    case 'laugh':
      move = 'bounce';
      face = (
        <>
          {cheeks(animal)}
          {eyeArch(x0, ey)}
          {eyeArch(x1, ey)}
          <path d={`M19,${my - 1.2} Q24,${my + 7.5} 29,${my - 1.2} Z`} fill={dark} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
          <ellipse cx={24} cy={my + 2.9} rx={2.4} ry={1.4} fill="#f47a9b" />
          <path d={drop(x0 - 4.6, ey + 1.6, 0.7)} fill="#7cc8ff" stroke={INK} strokeWidth={0.8} />
          <path d={drop(x1 + 4.6, ey + 1.6, 0.7)} fill="#7cc8ff" stroke={INK} strokeWidth={0.8} />
        </>
      );
      break;
    case 'cry':
      move = 'wobble';
      face = (
        <>
          {eyeTight(x0, ey, true)}
          {eyeTight(x1, ey, false)}
          <path d={`M19.4,${my + 3.6} Q24,${my - 5.6} 28.6,${my + 3.6} Q24,${my + 1.4} 19.4,${my + 3.6} Z`} fill={dark} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
          {[x0 - 1.2, x1 + 1.2].map((x, i) => (
            <g key={i}>
              <path d={`M${x},${ey + 2.6} V${ey + 13}`} stroke="#7cc8ff" strokeWidth={2.6} strokeLinecap="round" opacity={0.55} />
              <path d={drop(x, ey + 5)} fill="#7cc8ff" stroke={INK} strokeWidth={0.9} className="em-tear" style={{ animationDelay: `${-i * 370}ms` }} />
            </g>
          ))}
        </>
      );
      break;
    case 'angry':
      move = 'shake';
      face = (
        <>
          <ellipse cx={L.head.cx} cy={L.head.cy} rx={L.head.rx - 1} ry={L.head.ry - 1} fill="#e11d48" className="em-flush" />
          {browCross(x0, ey, true)}
          {browCross(x1, ey, false)}
          {eyeOpen(x0, ey + 0.4, 1.9)}
          {eyeOpen(x1, ey + 0.4, 1.9)}
          <rect x={19.2} y={my - 1.8} width={9.6} height={4.6} rx={1.6} fill="#fff" stroke={INK} strokeWidth={1.4} />
          <path d={`M21.6,${my - 1.8} V${my + 2.8} M24,${my - 1.8} V${my + 2.8} M26.4,${my - 1.8} V${my + 2.8}`} stroke={INK} strokeWidth={1} />
        </>
      );
      around = (
        <>
          {[
            [0, 7],
            [48, 7]
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <g className="em-steam" style={{ animationDelay: `${i * 300}ms` }}>
                <circle cx={0} cy={0} r={3.4} fill="#fff" stroke={INK} strokeWidth={1.2} />
                <circle cx={i ? 3 : -3} cy={-3.4} r={2.4} fill="#fff" stroke={INK} strokeWidth={1.2} />
              </g>
            </g>
          ))}
        </>
      );
      break;
    case 'thumb':
      move = 'nod';
      face = (
        <>
          {cheeks(animal)}
          {eyeArch(x0, ey)}
          {eyeOpen(x1, ey)}
          <path d={`M19.6,${my - 0.8} Q24,${my + 4.4} 28.4,${my - 0.8}`} {...line} strokeWidth={1.8} />
        </>
      );
      around = (
        <>
          <g transform="translate(43 37)">
            <g className="em-thumb">
              <rect x={-4.8} y={-9.5} width={4.6} height={10} rx={2.3} fill={L.fur} stroke={INK} strokeWidth={1.5} />
              <rect x={-5.4} y={-1.6} width={11} height={9.6} rx={3.4} fill={L.fur} stroke={INK} strokeWidth={1.5} />
              <path d="M0.4,1.6 H5.2 M0.4,4.6 H5.2" stroke={INK} strokeWidth={1} strokeLinecap="round" />
            </g>
          </g>
          <g transform="translate(50 20)">
            <path d={SPARK} fill="#ffd23f" stroke={INK} strokeWidth={0.7} strokeLinejoin="round" className="em-spark" />
          </g>
        </>
      );
      break;
    case 'kiss':
      move = 'tilt';
      face = (
        <>
          {cheeks(animal, true)}
          {eyeArch(x0, ey)}
          {eyeArch(x1, ey)}
          <ellipse cx={24} cy={my + 0.6} rx={1.9} ry={2.3} fill="#e0567a" stroke={INK} strokeWidth={1.2} />
        </>
      );
      around = (
        <g transform={`translate(33 ${my - 3})`}>
          <path d={HEART} fill="#f43f5e" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" className="em-heart" />
        </g>
      );
      break;
    case 'shock':
      move = 'pop';
      face = (
        <>
          {browUp(x0, ey)}
          {browUp(x1, ey)}
          {eyeWide(x0, ey)}
          {eyeWide(x1, ey)}
          <ellipse cx={24} cy={my + 1} rx={2.8} ry={3.8} fill={dark} stroke={INK} strokeWidth={1.4} />
        </>
      );
      around = (
        <>
          <g transform="translate(49 6)">
            <g className="em-bang">
              <path d="M-3.4,-9 h2.6 l-0.5,7.4 h-1.6 Z M-2.1,0.2 m-1.3,0 a1.3,1.3 0 1 0 2.6,0 a1.3,1.3 0 1 0 -2.6,0" fill="#f43f5e" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
              <path d="M1.6,-7 h2.2 l-0.4,5.8 h-1.4 Z M2.7,0.2 m-1.1,0 a1.1,1.1 0 1 0 2.2,0 a1.1,1.1 0 1 0 -2.2,0" fill="#f43f5e" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
            </g>
          </g>
          <path d={drop(2, 20, 0.9)} fill="#7cc8ff" stroke={INK} strokeWidth={0.8} />
        </>
      );
      break;
    case 'tease':
      move = 'tilt';
      face = (
        <>
          {cheeks(animal)}
          {eyeOpen(x0, ey)}
          {eyeArch(x1, ey)}
          <path d={`M19.8,${my - 0.8} Q24,${my + 2.6} 28.2,${my - 0.8}`} {...line} strokeWidth={1.7} />
          <g transform={`translate(24 ${my + 0.6})`}>
            <g className="em-tongue">
              <path d="M-2.3,0 H2.3 V3.6 A2.3,2.3 0 0 1 -2.3,3.6 Z" fill="#f47a9b" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
              <path d="M0,0.6 V3.4" stroke={INK} strokeWidth={0.8} strokeLinecap="round" opacity={0.6} />
            </g>
          </g>
        </>
      );
      break;
    case 'yawn':
      move = 'breathe';
      face = (
        <>
          {eyeSleepy(x0, ey)}
          {eyeSleepy(x1, ey)}
          <g transform={`translate(24 ${my + 1.4})`}>
            <g className="em-yawn">
              <ellipse cx={0} cy={0} rx={3.9} ry={5.2} fill={dark} stroke={INK} strokeWidth={1.4} />
              <ellipse cx={0} cy={3} rx={2.4} ry={1.3} fill="#f47a9b" />
            </g>
          </g>
          <path d={drop(x1 + 4.4, ey + 1.4, 0.65)} fill="#7cc8ff" stroke={INK} strokeWidth={0.8} />
        </>
      );
      around = (
        <>
          {[
            [41, -1, 1],
            [47, -8, 0.75]
          ].map(([x, y, size], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${size})`}>
              <path d="M0,0 H5 L0,6 H5" {...line} strokeWidth={1.7} className="em-z" style={{ animationDelay: `${i * 550}ms` }} />
            </g>
          ))}
        </>
      );
      break;
    case 'cool':
      move = 'nod';
      face = (
        <>
          {eyeOpen(x0, ey)}
          {eyeOpen(x1, ey)}
          <path d={`M20.4,${my + 1} Q25,${my + 2.8} 28.6,${my - 1.8}`} {...line} strokeWidth={1.8} />
          <g className="em-shades">
            <path d={`M${x0 + 5},${ey - 1.4} H${x1 - 5} M${x0 - 5},${ey - 1.6} L${L.head.cx - L.head.rx + 1.5},${ey - 3} M${x1 + 5},${ey - 1.6} L${L.head.cx + L.head.rx - 1.5},${ey - 3}`} {...line} strokeWidth={1.6} />
            <rect x={x0 - 5.4} y={ey - 3.6} width={10.8} height={7.2} rx={2.6} fill="#1c1917" stroke={INK} strokeWidth={1.2} />
            <rect x={x1 - 5.4} y={ey - 3.6} width={10.8} height={7.2} rx={2.6} fill="#1c1917" stroke={INK} strokeWidth={1.2} />
            <path d={`M${x0 - 3.4},${ey + 1.4} L${x0 - 0.4},${ey - 2.2} M${x1 - 3.4},${ey + 1.4} L${x1 - 0.4},${ey - 2.2}`} stroke="#fff" strokeWidth={1.3} strokeLinecap="round" opacity={0.7} />
          </g>
        </>
      );
      around = (
        <g transform={`translate(${x1 + 9} ${ey - 5})`}>
          <path d={SPARK} fill="#fff" stroke={INK} strokeWidth={0.7} strokeLinejoin="round" className="em-spark" style={{ animationDelay: '600ms' }} />
        </g>
      );
      break;
    case 'evil':
      move = 'chuckle';
      face = (
        <>
          {L.horns.map((x, i) => (
            <path
              key={i}
              d={`M${x + (i ? 2.6 : -2.6)},${L.hornY} Q${x + (i ? 3.4 : -3.4)},${L.hornY - 5} ${x + (i ? 2.2 : -2.2)},${L.hornY - 8.4} Q${x + (i ? -1.4 : 1.4)},${L.hornY - 5} ${x + (i ? -2.6 : 2.6)},${L.hornY} Z`}
              fill="#e11d48"
              stroke={INK}
              strokeWidth={1.3}
              strokeLinejoin="round"
            />
          ))}
          <g className="em-brows">
            {browCross(x0, ey, true)}
            {browCross(x1, ey, false)}
          </g>
          {eyeOpen(x0, ey + 0.4, 2)}
          {eyeOpen(x1, ey + 0.4, 2)}
          <path d={`M18.6,${my - 1.6} Q24,${my + 6.4} 29.4,${my - 1.6} Z`} fill="#fff" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
          <path d={`M21.2,${my - 0.8} V${my + 2.3} M24,${my - 0.6} V${my + 3.3} M26.8,${my - 0.8} V${my + 2.3}`} stroke={INK} strokeWidth={1} />
        </>
      );
      break;
  }

  return (
    <svg viewBox="-8 -12 64 64" className="em-face" data-emote={emote} data-still={still || undefined} aria-hidden="true">
      <g className="em-head" data-move={move}>
        <Head animal={animal} />
        {face}
        {/* Its hat, if it wears one - not its glasses, which would hide the face it is pulling. */}
        <WornOnFace kind={animal} wear={wearOf(seat)} glasses={false} />
      </g>
      {around}
    </svg>
  );
};

/** An emote on show: which one, and when it went up. */
export interface EmoteShown {
  i: number;
  at: number;
}

/** The bubble by a name: the emote just sent, for as long as it is up. */
export const EmoteBubble: React.FC<{ shown: EmoteShown | null; seat: Seat; side: 'left' | 'right' }> = ({ shown, seat, side }) =>
  shown ? (
    <span className="em-bubble" data-side={side} key={shown.at}>
      <EmoteFace emote={EMOTES[shown.i].id} seat={seat} />
    </span>
  ) : null;

/** Whether the other one is on this game's screen: a small mark by their name. */
export const HereMark: React.FC<{ here: boolean }> = ({ here }) => {
  const tr = useT();
  return (
    <span className="em-here" data-here={here || undefined}>
      {here ? tr('here') : tr('away')}
    </span>
  );
};

export interface GameEmotes {
  mine: EmoteShown | null;
  theirs: EmoteShown | null;
  send: (i: number) => void;
  muted: boolean;
  mute: (on: boolean) => void;
  /** They are looking at this game too, as far as this phone has heard. */
  theirHere: boolean;
}

/**
 * A game's emotes, and whether the other one is there. While the game is on
 * screen this phone says so every few seconds, and once more as it leaves.
 */
export function useGameEmotes(room: GameRoom): GameEmotes {
  const [mine, setMine] = useState<EmoteShown | null>(null);
  const [theirs, setTheirs] = useState<EmoteShown | null>(null);
  const [muted, setMuted] = useState(emotesMuted);
  const [, tick] = useState(0);

  useEffect(() => loadSounds(EMOTES.map(e => e.sound)), []);

  useEffect(() => {
    showRoom(room);
    const here = () => {
      if (document.visibilityState !== 'hidden') sayInGame({ k: room, h: 1 });
    };
    const seen = () => sayInGame({ k: room, h: document.visibilityState === 'hidden' ? 0 : 1 });
    here();
    const beat = window.setInterval(here, HERE_EVERY_MS);
    document.addEventListener('visibilitychange', seen);
    return () => {
      window.clearInterval(beat);
      document.removeEventListener('visibilitychange', seen);
      leaveRoom(room);
      sayInGame({ k: room, h: 0 });
    };
  }, [room]);

  // Whether they were already known to be here: someone only just arrived is
  // answered at once, so they do not wait for this phone's next turn to say so.
  const known = useRef(theyAreHere(room));
  useEffect(
    () =>
      onGameSaid(said => {
        if (said.k !== room) return;
        if (said.h === 1 && !known.current) sayInGame({ k: room, h: 1 });
        known.current = said.h !== 0;
        // Here or gone: the mark by their name follows.
        tick(t => t + 1);
        if (said.e === undefined || emotesMuted()) return;
        setTheirs({ i: said.e, at: Date.now() });
        playSound(EMOTES[said.e].sound);
        haptic('confirm');
      }),
    [room]
  );
  // "Here" runs out by itself when nothing more is heard.
  useEffect(() => {
    const id = window.setInterval(() => {
      known.current = theyAreHere(room);
      tick(t => t + 1);
    }, 4000);
    return () => window.clearInterval(id);
  }, [room]);

  useEffect(() => {
    if (!mine) return;
    const id = window.setTimeout(() => setMine(null), EMOTE_MS);
    return () => window.clearTimeout(id);
  }, [mine]);
  useEffect(() => {
    if (!theirs) return;
    const id = window.setTimeout(() => setTheirs(null), EMOTE_MS);
    return () => window.clearTimeout(id);
  }, [theirs]);

  const lastSent = useRef(0);
  const send = (i: number) => {
    if (i < 0 || i >= EMOTES.length || Date.now() - lastSent.current < EMOTE_EVERY_MS) return;
    lastSent.current = Date.now();
    getAudioContext();
    sayInGame({ k: room, e: i });
    setMine({ i, at: Date.now() });
    playSound(EMOTES[i].sound, { gain: 0.75 });
    haptic('tick');
  };
  const mute = (on: boolean) => {
    muteEmotes(on);
    setMuted(on);
    if (on) setTheirs(null);
    haptic('tick');
  };

  return { mine, theirs, send, muted, mute, theirHere: theyAreHere(room) };
}

/** The emote button in a game, and the tray it opens: ten faces to send, and a way to quieten theirs. */
export const EmoteKey: React.FC<{ emotes: GameEmotes; seat: Seat; partnerName: string }> = ({ emotes, seat, partnerName }) => {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  useBackLayer(open, () => setOpen(false));
  // A tap anywhere else puts it away.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (box.current && e.target instanceof Node && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]);

  return (
    <div className="em-key" ref={box}>
      <button
        type="button"
        className="em-open"
        data-on={open || undefined}
        aria-expanded={open}
        aria-label={tr('Emotes')}
        onClick={() => {
          haptic('tick');
          setOpen(o => !o);
        }}
      >
        <Smile className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <div className="em-tray" role="dialog" aria-label={tr('Emotes')}>
          <div className="em-grid">
            {EMOTES.map((emote, i) => (
              <button
                key={emote.id}
                type="button"
                className="em-pick"
                aria-label={tr(emote.name)}
                onClick={() => {
                  emotes.send(i);
                  setOpen(false);
                }}
              >
                <EmoteFace emote={emote.id} seat={seat} still />
              </button>
            ))}
          </div>
          <button type="button" className="em-mute" data-on={emotes.muted || undefined} aria-pressed={emotes.muted} onClick={() => emotes.mute(!emotes.muted)}>
            {emotes.muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
            {emotes.muted ? tr("{name}'s emotes are off", { name: partnerName }) : tr("Turn off {name}'s emotes", { name: partnerName })}
          </button>
        </div>
      )}
    </div>
  );
};
