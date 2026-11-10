import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../core/i18n';
import { haptic } from '../core/haptics';
import { playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import { PK_AIM_X, PK_AIM_Y, PK_EACH, diveSpot, encodeShot, kickerOf, playPenalty, type PkKick, type PkResult } from '../core/penalty';
import type { BoardProps } from './GameBoards';

// Penalty Shootout on Canvas of Us (core/penalty has the rules).
//
// Seen from behind the ball, whoever is shooting. To shoot: drag the mark to
// where you want it and stop the power bar. To keep goal: tap the part of the
// goal you will dive to. When both have chosen, the kick is played out - the
// ball and the keeper are each one picture, moved by the browser's own
// animations.

const W = 400;
const H = 300;
/** The goal on the picture: posts, bar and grass. */
const POST_L = 72;
const POST_R = 328;
const BAR = 64;
const GRASS = 192;
const UNIT = (POST_R - POST_L) / 200;
const gx = (x: number) => 200 + x * UNIT;
const gy = (y: number) => GRASS - y * UNIT;
const SPOT = { x: 200, y: 270 };
const KEEPER_Y = 150;
/** The ball at the goal is this much of its size on the spot. */
const FAR = 0.46;

const WHISTLE_MS = 380;
const AFTER_MS = 1350;
/** The power bar goes up and down once in this long. */
const SWING_MS = 1150;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function run(el: Element | null, frames: Keyframe[], options: KeyframeAnimationOptions) {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return null;
  return (el as HTMLElement).animate(frames, options);
}

const RESULT_TEXT: Record<PkResult, string> = { goal: 'GOAL!', save: 'SAVED!', post: 'OFF THE POST!', over: 'OVER THE BAR!', wide: 'WIDE!' };

/** The keeper, from the front, their middle at (0, 0): bear or bunny, in a shirt and gloves of their colour. */
const Keeper: React.FC<{ kind: 'bear' | 'bunny'; ink: string }> = React.memo(({ kind, ink }) => {
  const fur = kind === 'bear' ? '#c98a55' : '#fbf5ee';
  const shade = kind === 'bear' ? '#a66c3d' : '#e6d9cc';
  const pale = kind === 'bear' ? '#f3d9b5' : '#ffffff';
  return (
    <g>
      <path d="M-9,18 L-12,40 M9,18 L12,40" stroke="#3b2723" strokeWidth={11} strokeLinecap="round" />
      <path d="M-9,18 L-12,40 M9,18 L12,40" stroke={fur} strokeWidth={7.5} strokeLinecap="round" />
      <path d="M-19,38 h12 q5,0 5,5 h-17 z M7,38 h12 q5,0 5,5 h-17 z" fill="#2a2440" stroke="#3b2723" strokeWidth={1.6} strokeLinejoin="round" />
      {/* Arms up and out, a glove on each. */}
      <path d="M-13,-8 L-28,-26 M13,-8 L28,-26" stroke="#3b2723" strokeWidth={10.5} strokeLinecap="round" />
      <path d="M-13,-8 L-28,-26 M13,-8 L28,-26" stroke={ink} strokeWidth={7} strokeLinecap="round" />
      <g fill="#fff7ea" stroke="#3b2723" strokeWidth={1.8} strokeLinejoin="round">
        <path d="M-36,-37 q4,-6 9,-3 l5,9 q1,6 -5,8 q-7,1 -10,-5 z" />
        <path d="M36,-37 q-4,-6 -9,-3 l-5,9 q-1,6 5,8 q7,1 10,-5 z" />
      </g>
      <path d="M-33,-33 l8,-2 M33,-33 l-8,-2" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M-17,-12 C-20,2 -18,14 -15,22 H15 C18,14 20,2 17,-12 C10,-18 -10,-18 -17,-12 Z" fill={ink} stroke="#3b2723" strokeWidth={2} strokeLinejoin="round" />
      <path d="M-5,-15 V21 M5,-15 V21" stroke="#fff" strokeOpacity={0.5} strokeWidth={2.4} />
      <path d="M-15,14 H15 V22 H-15 Z" fill="#2a2440" stroke="#3b2723" strokeWidth={1.8} strokeLinejoin="round" />
      {kind === 'bear' ? (
        <g>
          <circle cx={-12} cy={-39} r={6} fill={fur} stroke="#3b2723" strokeWidth={1.8} />
          <circle cx={-12} cy={-39} r={2.8} fill={shade} />
          <circle cx={12} cy={-39} r={6} fill={fur} stroke="#3b2723" strokeWidth={1.8} />
          <circle cx={12} cy={-39} r={2.8} fill={shade} />
        </g>
      ) : (
        <g>
          <path d="M-9,-36 C-15,-56 -11,-66 -6,-66 C-1,-66 -2,-52 -3,-37 Z" fill={fur} stroke="#3b2723" strokeWidth={1.8} strokeLinejoin="round" />
          <path d="M-8,-42 C-11,-54 -9,-61 -6,-61 C-4,-61 -4,-52 -5,-42 Z" fill="#f9a8c0" />
          <path d="M9,-36 C15,-56 11,-66 6,-66 C1,-66 2,-52 3,-37 Z" fill={fur} stroke="#3b2723" strokeWidth={1.8} strokeLinejoin="round" />
          <path d="M8,-42 C11,-54 9,-61 6,-61 C4,-61 4,-52 5,-42 Z" fill="#f9a8c0" />
        </g>
      )}
      <circle cx={0} cy={-26} r={15} fill={fur} stroke="#3b2723" strokeWidth={2} />
      <ellipse cx={0} cy={-21} rx={7} ry={5.5} fill={pale} />
      <ellipse cx={0} cy={-23.4} rx={2.3} ry={1.7} fill="#3b2723" />
      <circle cx={-5.5} cy={-29} r={1.9} fill="#3b2723" />
      <circle cx={5.5} cy={-29} r={1.9} fill="#3b2723" />
      <path d="M-3.5,-18.5 q3.5,2.6 7,0" fill="none" stroke="#3b2723" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M-9.5,-33.5 l5,1.5 M9.5,-33.5 l-5,1.5" stroke="#3b2723" strokeWidth={1.6} strokeLinecap="round" />
    </g>
  );
});
Keeper.displayName = 'Keeper';

/** The ground, the stand and the goal. Drawn once. */
const Ground: React.FC = React.memo(() => (
  <g>
    <defs>
      <linearGradient id="pk-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#101a44" />
        <stop offset="1" stopColor="#27408f" />
      </linearGradient>
      <linearGradient id="pk-grass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2f9e58" />
        <stop offset="1" stopColor="#1c7a41" />
      </linearGradient>
      <pattern id="pk-net" width="9" height="9" patternUnits="userSpaceOnUse">
        <path d="M0,0 L9,9 M9,0 L0,9" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.9" />
      </pattern>
      <radialGradient id="pk-lamp" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x={0} y={0} width={W} height={GRASS} fill="url(#pk-sky)" />
    {/* Floodlights. */}
    {[48, 352].map(x => (
      <g key={x}>
        <rect x={x - 2} y={10} width={4} height={60} fill="#55608f" />
        <rect x={x - 17} y={3} width={34} height={13} rx={3} fill="#c9d4f5" stroke="#3b2723" strokeWidth={1.4} />
        <circle cx={x} cy={9} r={30} fill="url(#pk-lamp)" opacity={0.6} />
      </g>
    ))}
    {/* The stand, full. */}
    <path d={`M0,${GRASS - 96} H${W} V${GRASS - 6} H0 Z`} fill="#1b2460" />
    {[0, 1, 2, 3, 4].map(row =>
      Array.from({ length: 27 }, (_, i) => {
        const x = 5 + i * 15 + (row % 2) * 7;
        const y = GRASS - 88 + row * 16;
        const c = ['#ff7a8a', '#ffd166', '#7ad3ff', '#b6f58a', '#f5f7ff', '#c79bff'][(i * 7 + row * 3) % 6];
        return <circle key={`${row}-${i}`} cx={x} cy={y} r={4.6} fill={c} opacity={0.5 + ((i + row) % 3) * 0.12} />;
      })
    )}
    <rect x={0} y={GRASS - 10} width={W} height={10} fill="#e9edf8" />
    <path d={`M0,${GRASS - 10} H${W}`} stroke="#3b2723" strokeWidth={1.4} />
    {[18, 110, 204, 300].map((x, i) => (
      <rect key={x} x={x} y={GRASS - 9} width={74} height={8} fill={['#ff5d73', '#ffd166', '#4cc9f0', '#80ed99'][i]} opacity={0.85} />
    ))}
    {/* The pitch, mown in stripes that narrow toward the goal. */}
    <rect x={0} y={GRASS} width={W} height={H - GRASS} fill="url(#pk-grass)" />
    {[0, 1, 2, 3, 4].map(i => {
      const top = [60, 132, 204, 276, 348][i];
      const half = 36;
      const reach = (x: number) => 200 + (x - 200) * 2.4;
      return i % 2 === 0 ? <path key={i} d={`M${top - half},${GRASS} H${top + half} L${reach(top + half)},${H} H${reach(top - half)} Z`} fill="#fff" opacity={0.06} /> : null;
    })}
    <path d={`M20,${GRASS + 1} H380`} stroke="#fff" strokeOpacity={0.85} strokeWidth={2.4} />
    <path d={`M48,${GRASS + 1} L8,${GRASS + 50} H392 L352,${GRASS + 1}`} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={2.2} />
    <ellipse cx={SPOT.x} cy={SPOT.y + 9} rx={7} ry={2.4} fill="#fff" opacity={0.85} />
    {/* The goal: the net, then the frame over it. */}
    <path d={`M${POST_L},${BAR} L${POST_L + 16},${BAR + 14} H${POST_R - 16} L${POST_R},${BAR} Z`} fill="url(#pk-net)" />
    <rect x={POST_L} y={BAR} width={POST_R - POST_L} height={GRASS - BAR} fill="url(#pk-net)" />
    <rect x={POST_L} y={BAR} width={POST_R - POST_L} height={GRASS - BAR} fill="#0b1535" opacity={0.26} />
  </g>
));
Ground.displayName = 'Ground';

const Frame: React.FC = React.memo(() => (
  <g>
    <path d={`M${POST_L},${GRASS + 1} V${BAR} H${POST_R} V${GRASS + 1}`} fill="none" stroke="#3b2723" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
    <path d={`M${POST_L},${GRASS + 1} V${BAR} H${POST_R} V${GRASS + 1}`} fill="none" stroke="#fdfdff" strokeWidth={5.4} strokeLinejoin="round" strokeLinecap="round" />
  </g>
));
Frame.displayName = 'Frame';

/** The ball, its middle at (0, 0). */
const Ball: React.FC = React.memo(() => (
  <g>
    <circle r={12} fill="#fff" stroke="#3b2723" strokeWidth={2.2} />
    <path d="M0,-5.2 L5,-1.6 L3.1,4.2 H-3.1 L-5,-1.6 Z" fill="#2a2440" />
    <path d="M0,-5.2 V-11.6 M5,-1.6 L11,-3.6 M3.1,4.2 L6.8,9.6 M-3.1,4.2 L-6.8,9.6 M-5,-1.6 L-11,-3.6" stroke="#2a2440" strokeWidth={1.7} strokeLinecap="round" />
    <path d="M-7.5,-7 a10.5,10.5 0 0 1 6,-3.6" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
  </g>
));
Ball.displayName = 'Ball';

export const PenaltyBoard: React.FC<BoardProps> = React.memo(({ game, me, inkOf, canAct, onMove, onSettled, partnerName }) => {
  const tr = useT();
  const them: Seat = me === 'user' ? 'partner' : 'user';
  const s = useMemo(() => playPenalty(game), [game]);
  const done = s.kicks.length;
  const mine = game.picks?.[me] || [];
  const theirs = game.picks?.[them] || [];

  /** How many kicks have been played out on this screen; and the one being played out now. */
  const [shown, setShown] = useState(done);
  const [playing, setPlaying] = useState<PkKick | null>(null);
  const [call, setCall] = useState<{ key: number; result: PkResult; mine: boolean } | null>(null);
  const [aim, setAim] = useState({ x: 0, y: 34 });
  const [dragging, setDragging] = useState(false);

  const sceneRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<SVGGElement>(null);
  const spinRef = useRef<SVGGElement>(null);
  const keeperRef = useRef<SVGGElement>(null);
  const netRef = useRef<SVGGElement>(null);
  const powerRef = useRef<HTMLDivElement>(null);
  const powerNow = useRef(0);
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
    for (const el of [ballRef.current, spinRef.current, keeperRef.current, netRef.current]) el?.getAnimations?.().forEach(a => a.cancel());
  };

  /** One kick, played out. */
  const play = (kick: PkKick, index: number) => {
    running.current = true;
    setPlaying(kick);
    setCall(null);
    playSound('g-pk-whistle');
    const p = kick.shot.power / 100;
    const flight = 600 - p * 250;
    // Where it ends up on the picture; off the frame, it stops at the frame.
    const hitPost = kick.result === 'post';
    const bx = hitPost && Math.abs(kick.ball.x) > 96 ? Math.sign(kick.ball.x) * 100 : kick.ball.x;
    const by = hitPost && kick.ball.y > 96 ? 100 : kick.ball.y;
    const tx = gx(bx) - SPOT.x;
    const ty = gy(by) - SPOT.y;
    const at = (x: number, y: number, k: number) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${k})`;

    later(WHISTLE_MS, () => {
      playSound('g-pk-kick', { gain: 0.65 + p * 0.35, rate: 1.08 - p * 0.16 });
      haptic('tick');
      run(ballRef.current, [{ transform: at(0, 0, 1), easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' }, { transform: at(tx, ty, FAR) }], { duration: flight, fill: 'forwards' });
      run(spinRef.current, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${tx < 0 ? -720 : 720}deg)` }], { duration: flight + 500, easing: 'ease-out', fill: 'forwards' });
      // The keeper goes as the ball is struck.
      const spot = diveSpot(kick.dive);
      const col = Math.floor(kick.dive / 2);
      const high = kick.dive % 2 === 1;
      const dx = spot.x * UNIT;
      const dy = gy(spot.y) - KEEPER_Y;
      const turn = col === 0 ? -72 : col === 2 ? 72 : 0;
      const end = col === 1 ? (high ? 'translate(0px, -34px) scale(1.04, 1.1)' : 'translate(0px, 16px) scale(1.14, 0.78)') : `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${turn}deg)`;
      run(
        keeperRef.current,
        [
          { offset: 0, transform: 'translate(0px, 0px) rotate(0deg)', easing: 'cubic-bezier(0.3, 0, 0.6, 1)' },
          { offset: 0.2, transform: 'translate(0px, 7px) scale(1.06, 0.9)', easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)' },
          { offset: 1, transform: end }
        ],
        { duration: Math.max(320, flight * 0.95), delay: 50, fill: 'forwards' }
      );
    });

    later(WHISTLE_MS + flight, () => {
      const out = Math.sign(tx) || 1;
      switch (kick.result) {
        case 'goal':
          playSound('g-pk-goal');
          haptic('confirm');
          run(ballRef.current, [{ transform: at(tx, ty, FAR), easing: 'ease-out' }, { offset: 0.3, transform: at(tx + out * 3, ty - 4, FAR * 0.92), easing: 'ease-in' }, { transform: at(tx + out * 5, GRASS - 7 - SPOT.y, FAR * 0.92) }], { duration: 620, fill: 'forwards' });
          run(netRef.current, [{ transform: 'scale(1)' }, { transform: 'scale(1.035, 1.05)' }, { transform: 'scale(0.992)' }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
          break;
        case 'save':
          playSound('g-pk-save');
          haptic('confirm');
          run(ballRef.current, [{ transform: at(tx, ty, FAR), easing: 'cubic-bezier(0.2, 0.7, 0.5, 1)' }, { transform: at(tx + out * 86, ty + 96, 0.74) }], { duration: 520, fill: 'forwards' });
          break;
        case 'post':
          playSound('g-pk-post');
          haptic('confirm');
          run(ballRef.current, [{ transform: at(tx, ty, FAR), easing: 'cubic-bezier(0.2, 0.7, 0.5, 1)' }, { transform: at(tx * 0.35 - out * 40, 6, 0.95) }], { duration: 600, fill: 'forwards' });
          sceneRef.current?.animate?.([{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(${out * 4}px, -2px, 0)` }, { transform: 'translate3d(0, 0, 0)' }], { duration: 200, easing: 'ease-out' });
          break;
        default:
          playSound('g-pk-miss');
          run(ballRef.current, [{ transform: at(tx, ty, FAR), opacity: 1, easing: 'linear' }, { transform: at(tx * 1.3, ty * 1.3 - 14, FAR * 0.66), opacity: 0 }], { duration: 420, fill: 'forwards' });
      }
      setCall({ key: Date.now(), result: kick.result, mine: kick.kicker === me });
      shownRef.current = index + 1;
      setShown(index + 1);
    });

    later(WHISTLE_MS + flight + AFTER_MS, () => {
      stopAll();
      setPlaying(null);
      setCall(null);
      running.current = false;
      settledRef.current?.(index + 1);
      pump();
    });
  };

  const pump = () => {
    if (running.current) return;
    const st = stateRef.current;
    const k = shownRef.current;
    if (k >= st.kicks.length) return;
    play(st.kicks[k], k);
  };
  const pumpRef = useRef(pump);
  pumpRef.current = pump;

  useEffect(() => {
    if (idRef.current !== game.id || done < shownRef.current) {
      stopAll();
      running.current = false;
      idRef.current = game.id;
      shownRef.current = done;
      setShown(done);
      setPlaying(null);
      setCall(null);
      setAim({ x: 0, y: 34 });
      settledRef.current?.(done);
      return;
    }
    pumpRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, done]);

  useEffect(() => {
    settledRef.current?.(shownRef.current);
    return () => {
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The kick coming up, and who does what in it.
  const finished = s.over && shown >= done;
  const iShoot = kickerOf(game.first, done) === me;
  const myPick = mine.length > done ? mine[done] : null;
  const theyPicked = theirs.length > done;
  const choosing = canAct && !playing && myPick === null;
  const keeperSeat: Seat = playing ? (playing.kicker === 'user' ? 'partner' : 'user') : kickerOf(game.first, done) === 'user' ? 'partner' : 'user';
  const keeperKind = keeperSeat === 'user' ? ('bear' as const) : ('bunny' as const);

  // The power bar, up and down for as long as you have a kick to take.
  useEffect(() => {
    if (!choosing || !iShoot) return;
    let raf = 0;
    const from = performance.now();
    const tick = (now: number) => {
      const t = ((now - from) % SWING_MS) / SWING_MS;
      const v = t < 0.5 ? t * 2 : 2 - t * 2;
      // Quick through the middle, slower at the ends: easier to stop soft or hard than in between.
      const eased = (1 - Math.cos(v * Math.PI)) / 2;
      powerNow.current = Math.round(eased * 100);
      powerRef.current?.style.setProperty('--p', eased.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [choosing, iShoot]);

  /** Where on the goal a point of the screen is. */
  const goalAt = (clientX: number, clientY: number) => {
    const box = sceneRef.current?.getBoundingClientRect();
    if (!box || !box.width) return null;
    const px = ((clientX - box.left) / box.width) * W;
    const py = ((clientY - box.top) / box.height) * H;
    return { x: clamp(Math.round((px - 200) / UNIT), -PK_AIM_X + 4, PK_AIM_X - 4), y: clamp(Math.round((GRASS - py) / UNIT), 3, PK_AIM_Y - 4) };
  };
  const onAimDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!choosing || !iShoot || e.button > 0) return;
    const at = goalAt(e.clientX, e.clientY);
    if (!at) return;
    setAim(at);
    setDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* it still follows while the finger is over it */
    }
  };
  const onAimMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const at = goalAt(e.clientX, e.clientY);
    if (at) setAim(at);
  };
  const kickNow = () => {
    if (!choosing || !iShoot) return;
    const power = clamp(powerNow.current, 0, 100);
    haptic('confirm');
    playSound('g-pk-pick');
    onMove(encodeShot({ x: aim.x, y: aim.y, power }));
  };
  const diveTo = (dive: number) => {
    if (!choosing || iShoot) return;
    haptic('confirm');
    playSound('g-pk-pick');
    onMove(dive);
  };

  const pips = (seat: Seat) => {
    // Each of their kicks so far, as far as they have been played out here.
    const list = s.kicks
      .slice(0, shown)
      .filter(k => k.kicker === seat)
      .map(k => k.result === 'goal');
    const total = Math.max(PK_EACH, list.length + (finished ? 0 : 1));
    return (
      <span className="pk-pips">
        {Array.from({ length: Math.min(total, 8) }, (_, i) => {
          const from = Math.max(0, total - 8);
          const v = list[from + i];
          return <i key={i} data-goal={v === true || undefined} data-miss={v === false || undefined} />;
        })}
      </span>
    );
  };
  // The score as far as the kicks have been played out here.
  const goals = (seat: Seat) => s.kicks.slice(0, shown).filter(k => k.kicker === seat && k.result === 'goal').length;
  const myDive = !iShoot && myPick !== null ? myPick : null;

  return (
    <div className="pk" style={{ '--me': inkOf(me), '--them': inkOf(them) } as React.CSSProperties}>
      <div className="pk-top">
        <span className="pk-side" data-side="me">
          <b>{tr('You')}</b>
          {pips(me)}
        </span>
        <span className="pk-score">
          {goals(me)} <i>-</i> {goals(them)}
        </span>
        <span className="pk-side" data-side="them">
          {pips(them)}
          <b>{partnerName}</b>
        </span>
      </div>

      <div className="pk-scene" ref={sceneRef} data-aim={(choosing && iShoot) || undefined} onPointerDown={onAimDown} onPointerMove={onAimMove} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="pk-svg" role="img" aria-label={tr('The goal, from behind the ball')}>
          <Ground />
          <g ref={netRef} style={{ transformOrigin: `200px ${(BAR + GRASS) / 2}px` }}>
            <rect x={POST_L} y={BAR} width={POST_R - POST_L} height={GRASS - BAR} fill="url(#pk-net)" opacity={0.55} />
          </g>
          <g transform={`translate(200 ${KEEPER_Y})`}>
            <g ref={keeperRef}>
              <Keeper kind={keeperKind} ink={inkOf(keeperSeat)} />
            </g>
          </g>
          <Frame />
          {/* Your own choice, on your own screen only: where you aim, or where you will dive. */}
          {iShoot && !playing && !finished && (
            <g transform={`translate(${gx(aim.x)} ${gy(aim.y)})`} className="pk-mark" data-locked={myPick !== null || undefined}>
              <circle r={15} fill="none" stroke="#3b2723" strokeWidth={5} />
              <circle r={15} fill="none" stroke="#ffe066" strokeWidth={2.6} />
              <path d="M-21,0 h12 M9,0 h12 M0,-21 v12 M0,9 v12" stroke="#3b2723" strokeWidth={5} strokeLinecap="round" />
              <path d="M-21,0 h12 M9,0 h12 M0,-21 v12 M0,9 v12" stroke="#ffe066" strokeWidth={2.6} strokeLinecap="round" />
              <circle r={2.6} fill="#ffe066" stroke="#3b2723" strokeWidth={1.4} />
            </g>
          )}
          <g transform={`translate(${SPOT.x} ${SPOT.y})`}>
            <g ref={ballRef}>
              <ellipse cx={0} cy={11} rx={11} ry={3} fill="#000" opacity={0.25} />
              <g ref={spinRef}>
                <Ball />
              </g>
            </g>
          </g>
        </svg>

        {!iShoot && !playing && !finished && (
          <div className="pk-zones" role="group" aria-label={tr('Where to dive')}>
            {[1, 3, 5, 0, 2, 4].map(dive => (
              <button key={dive} type="button" className="pk-zone" data-on={myDive === dive || undefined} disabled={!choosing} onClick={() => diveTo(dive)} aria-label={tr(['Low left', 'High left', 'Low middle', 'High middle', 'Low right', 'High right'][dive])}>
                <span aria-hidden="true">{['↙', '↖', '↓', '↑', '↘', '↗'][dive]}</span>
              </button>
            ))}
          </div>
        )}
        {call && (
          <div className="pk-call" key={call.key} data-result={call.result} data-good={(call.result === 'goal') === call.mine || undefined} aria-live="polite">
            {tr(RESULT_TEXT[call.result])}
          </div>
        )}
        {!playing && !finished && (
          <span className="pk-role">{iShoot ? tr('Your kick') : tr('You are in goal')}</span>
        )}
        {!playing && !finished && (
          <span className="pk-ready" data-on={theyPicked || undefined}>
            {theyPicked ? tr('{name} is ready', { name: partnerName }) : tr('{name} is choosing', { name: partnerName })}
          </span>
        )}
        {s.suddenDeath && !finished && <span className="pk-sudden">{tr('Sudden death')}</span>}
      </div>

      <div className="pk-bar">
        {finished ? (
          <p className="pk-hint">{tr('Full time')}</p>
        ) : iShoot ? (
          <>
            <div className="pk-power" ref={powerRef} data-off={!choosing || undefined} aria-hidden="true">
              <i />
              <b />
            </div>
            <button type="button" className="pk-kick" disabled={!choosing} onClick={kickNow}>
              {myPick !== null ? tr('Locked in') : tr('Kick!')}
            </button>
          </>
        ) : (
          <p className="pk-hint">{myPick !== null ? tr('Locked in. Waiting for the kick') : choosing ? tr('Tap where you will dive') : ' '}</p>
        )}
      </div>
      {iShoot && !finished && <p className="pk-hint">{myPick !== null ? tr('Waiting for {name} to choose a dive', { name: partnerName }) : choosing ? tr('Drag the mark to aim, then stop the bar: harder is harder to save, and harder to keep on target') : ' '}</p>}
    </div>
  );
});
PenaltyBoard.displayName = 'PenaltyBoard';
