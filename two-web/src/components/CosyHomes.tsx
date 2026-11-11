import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, CircleHelp, Lightbulb, Lock, Play, Redo2, RotateCcw, Shuffle, Star, Timer, Undo2 } from 'lucide-react';
import { getAudioContext } from '../core/audioAlerts';
import { useBackLayer } from '../core/backStack';
import {
  CROSS,
  EMPTY,
  FRIEND,
  HOMES_LEVELS,
  HOMES_MAX,
  HOMES_MIN,
  HOMES_WORLDS,
  allDone,
  clashes,
  emptyBoard,
  freePuzzle,
  friendsOn,
  hintFor,
  levelOn,
  levelOpen,
  levelPuzzle,
  levelsDone,
  lineBetween,
  painted,
  saveBoard,
  savedBoard,
  solved,
  starsAt,
  starsFor,
  tapped,
  totalStars,
  worldOf,
  type Hint,
  type HomesBook,
  type HomesPuzzle,
  type HomesSave
} from '../core/cosyHomes';
import { HOMES_TOUR, HOMES_TOUR_KEY, markTourSeen, tourSeen } from '../core/gameTours';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { loadSounds, playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import { GameTour } from './GameTour';

/** What the game is called, on its card and at its top. */
export const HOMES_NAME = 'Cosy Homes';

interface CosyHomesProps {
  /** The stars on each level: yours, and the other person's. */
  mine?: HomesBook;
  theirs?: HomesBook;
  /** The other person's name, as this phone knows it. */
  partnerName: string;
  /** Whose phone this is: the bear's or the bunny's. */
  me: Seat;
  /** A numbered level finished, with its stars. */
  onFinish: (level: number, stars: number) => void;
  /** Back to all the games. */
  onBack: () => void;
}

/** What is being played: a numbered level, or a Free play board of a size, made from a seed. */
type Playing = { level: number } | { free: number; seed: number };

const BearFace: React.FC = () => (
  <svg viewBox="0 0 48 48" className="ch-face" aria-hidden="true">
    <circle cx={11.5} cy={13} r={7} fill="#c98a55" stroke="#3b2723" strokeWidth={2} />
    <circle cx={11.5} cy={13} r={3.2} fill="#a66c3d" />
    <circle cx={36.5} cy={13} r={7} fill="#c98a55" stroke="#3b2723" strokeWidth={2} />
    <circle cx={36.5} cy={13} r={3.2} fill="#a66c3d" />
    <circle cx={24} cy={27} r={17.5} fill="#c98a55" stroke="#3b2723" strokeWidth={2} />
    <ellipse cx={24} cy={32.5} rx={8.5} ry={6.5} fill="#f3d9b5" />
    <ellipse cx={24} cy={29.6} rx={3.2} ry={2.3} fill="#3b2723" />
    <path d="M24,31.8 V34 M20.6,35 Q24,37.6 27.4,35" fill="none" stroke="#3b2723" strokeWidth={1.6} strokeLinecap="round" />
    <circle cx={16.6} cy={24.2} r={2.2} fill="#3b2723" />
    <circle cx={31.4} cy={24.2} r={2.2} fill="#3b2723" />
    <circle cx={17.3} cy={23.5} r={0.7} fill="#fff" />
    <circle cx={32.1} cy={23.5} r={0.7} fill="#fff" />
    <ellipse cx={12.4} cy={30.6} rx={2.8} ry={1.9} fill="#f58aa0" opacity={0.6} />
    <ellipse cx={35.6} cy={30.6} rx={2.8} ry={1.9} fill="#f58aa0" opacity={0.6} />
  </svg>
);

const BunnyFace: React.FC = () => (
  <svg viewBox="0 0 48 48" className="ch-face" aria-hidden="true">
    <path d="M12.5,22 C8.5,10 10.5,2.5 15.5,2.5 C20.5,2.5 21,11 20,21 Z" fill="#fbf5ee" stroke="#3b2723" strokeWidth={2} strokeLinejoin="round" />
    <path d="M14.4,19 C12.4,11.5 13.2,6.5 15.5,6.5 C17.8,6.5 17.9,12 17.4,18.5 Z" fill="#f9a8c0" />
    <path d="M35.5,22 C39.5,10 37.5,2.5 32.5,2.5 C27.5,2.5 27,11 28,21 Z" fill="#fbf5ee" stroke="#3b2723" strokeWidth={2} strokeLinejoin="round" />
    <path d="M33.6,19 C35.6,11.5 34.8,6.5 32.5,6.5 C30.2,6.5 30.1,12 30.6,18.5 Z" fill="#f9a8c0" />
    <ellipse cx={24} cy={30.5} rx={16.5} ry={14.5} fill="#fbf5ee" stroke="#3b2723" strokeWidth={2} />
    <circle cx={17.2} cy={28.4} r={2.2} fill="#3b2723" />
    <circle cx={30.8} cy={28.4} r={2.2} fill="#3b2723" />
    <circle cx={17.9} cy={27.7} r={0.7} fill="#fff" />
    <circle cx={31.5} cy={27.7} r={0.7} fill="#fff" />
    <path d="M22.3,32.4 H25.7 L24,34.4 Z" fill="#f47a9b" stroke="#3b2723" strokeWidth={1} strokeLinejoin="round" />
    <path d="M24,34.4 V36 M20.8,37 Q22.4,38.6 24,36.6 Q25.6,38.6 27.2,37" fill="none" stroke="#3b2723" strokeWidth={1.5} strokeLinecap="round" />
    <ellipse cx={12.6} cy={34} rx={2.8} ry={1.9} fill="#f58aa0" opacity={0.6} />
    <ellipse cx={35.4} cy={34} rx={2.8} ry={1.9} fill="#f58aa0" opacity={0.6} />
  </svg>
);

/** Each of you has a face, the same as everywhere else in Two: the bear and the bunny. */
const FaceOf: React.FC<{ seat: Seat }> = ({ seat }) => (seat === 'user' ? <BearFace /> : <BunnyFace />);

/** The friend that lives in a home: a bear in one, a bunny in the next. */
const Friend: React.FC<{ home: number }> = ({ home }) => (home % 2 ? <BunnyFace /> : <BearFace />);

/** The game's picture, for its card among the games and its how-to-play box. */
export const HomesIcon: React.FC = () => (
  <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
    <rect x={1.5} y={1.5} width={57} height={57} rx={10} fill="#fff7ea" stroke="#3b2723" strokeWidth={2.4} />
    <path d="M3,3 H30 V30 H3 Z" fill="#ffc9a3" />
    <path d="M30,3 H57 V30 H30 Z" fill="#a5d8ff" />
    <path d="M3,30 H30 V57 H3 Z" fill="#b5ecb1" />
    <path d="M30,30 H57 V57 H30 Z" fill="#d0bfff" />
    <rect x={1.5} y={1.5} width={57} height={57} rx={10} fill="none" stroke="#3b2723" strokeWidth={2.4} />
    <path d="M30,3 V57 M3,30 H57" stroke="#3b2723" strokeWidth={2} />
    <g transform="translate(4.5 4.5) scale(0.48)">
      <BearFaceParts />
    </g>
    <g transform="translate(32.5 32.5) scale(0.48)">
      <BunnyFaceParts />
    </g>
    <path d="M38,11 L49,22 M49,11 L38,22" stroke="#3b2723" strokeOpacity={0.55} strokeWidth={2.6} strokeLinecap="round" />
    <path d="M11,38 L22,49 M22,38 L11,49" stroke="#3b2723" strokeOpacity={0.55} strokeWidth={2.6} strokeLinecap="round" />
  </svg>
);

/** The same two faces without their own frame, to sit inside another picture. */
function BearFaceParts() {
  return (
    <>
      <circle cx={11.5} cy={13} r={7} fill="#c98a55" stroke="#3b2723" strokeWidth={2.4} />
      <circle cx={36.5} cy={13} r={7} fill="#c98a55" stroke="#3b2723" strokeWidth={2.4} />
      <circle cx={24} cy={27} r={17.5} fill="#c98a55" stroke="#3b2723" strokeWidth={2.4} />
      <ellipse cx={24} cy={32.5} rx={8.5} ry={6.5} fill="#f3d9b5" />
      <ellipse cx={24} cy={29.6} rx={3.4} ry={2.5} fill="#3b2723" />
      <circle cx={16.6} cy={24.2} r={2.6} fill="#3b2723" />
      <circle cx={31.4} cy={24.2} r={2.6} fill="#3b2723" />
    </>
  );
}
function BunnyFaceParts() {
  return (
    <>
      <path d="M12.5,22 C8.5,10 10.5,2.5 15.5,2.5 C20.5,2.5 21,11 20,21 Z" fill="#fbf5ee" stroke="#3b2723" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M35.5,22 C39.5,10 37.5,2.5 32.5,2.5 C27.5,2.5 27,11 28,21 Z" fill="#fbf5ee" stroke="#3b2723" strokeWidth={2.4} strokeLinejoin="round" />
      <ellipse cx={24} cy={30.5} rx={16.5} ry={14.5} fill="#fbf5ee" stroke="#3b2723" strokeWidth={2.4} />
      <circle cx={17.2} cy={28.4} r={2.6} fill="#3b2723" />
      <circle cx={30.8} cy={28.4} r={2.6} fill="#3b2723" />
      <path d="M22,32.4 H26 L24,34.8 Z" fill="#f47a9b" />
    </>
  );
}

/** Minutes and seconds on the clock. */
const clockText = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** A seed for a new Free play board. */
const newSeed = () => 1 + Math.floor(Math.random() * 2_000_000_000);

/** Up to three stars, the ones won filled in. */
const Stars: React.FC<{ count: number; size?: number; pop?: boolean }> = ({ count, size = 12, pop }) => (
  <span className="ch-stars" data-pop={pop || undefined} aria-hidden="true">
    {[1, 2, 3].map(i => (
      <Star key={i} width={size} height={size} data-on={i <= count || undefined} style={pop ? { animationDelay: `${250 + i * 260}ms` } : undefined} />
    ))}
  </span>
);

// ------------------------------------------------------------ all the levels

interface LevelsProps {
  mine?: HomesBook;
  theirs?: HomesBook;
  partnerName: string;
  me: Seat;
  onPlay: (level: number) => void;
  onFree: (n: number) => void;
  onRules: () => void;
  onBack: () => void;
}

export const HomesLevels: React.FC<LevelsProps> = ({ mine, theirs, partnerName, me, onPlay, onFree, onRules, onBack }) => {
  const tr = useT();
  const current = levelOn(mine);
  const finished = allDone(mine);
  const [openWorld, setOpenWorld] = useState<number | null>(worldOf(current).n);
  const carryOn = !finished && !!savedBoard(`l${current}`, worldOf(current).n);
  // The level you are on, brought into view when its size is opened by hand.
  // Not as the page opens: that would carry "Play" off the top of the screen.
  const here = useRef<HTMLButtonElement | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    here.current?.scrollIntoView({ block: 'center' });
  }, [openWorld]);

  const theirLine = !theirs
    ? tr('{name} has not played yet', { name: partnerName })
    : allDone(theirs)
      ? tr('{name} has finished every level', { name: partnerName })
      : tr('{name} is on level {n}', { name: partnerName, n: levelOn(theirs) });

  return (
    <div className="ch-page">
      <header className="ch-top">
        <button type="button" className="ch-round" onClick={onBack} aria-label={tr('All games')}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="ch-title">{tr(HOMES_NAME)}</h2>
        <span className="ch-total" aria-label={tr('{n} stars', { n: totalStars(mine) })}>
          <Star width={15} height={15} data-on="" aria-hidden="true" />
          {totalStars(mine)}
        </span>
        <button type="button" className="ch-round" onClick={onRules} aria-label={tr('How to play')}>
          <CircleHelp className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="ch-scroll">
        <section className="ch-now">
          <p className="ch-now-label">{finished ? tr('Every level done!') : tr('Level {n}', { n: current })}</p>
          <p className="ch-now-sub">
            {finished ? tr('Play any of them again for more stars') : `${worldOf(current).n}×${worldOf(current).n} · ${tr('{n} of {total} done', { n: levelsDone(mine), total: HOMES_LEVELS })}`}
          </p>
          {!finished && (
            <button type="button" className="ch-go" onClick={() => onPlay(current)}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {carryOn ? tr('Carry on') : tr('Play')}
            </button>
          )}
        </section>

        <p className="ch-them">
          <span className="ch-them-face" aria-hidden="true">
            <FaceOf seat={me === 'user' ? 'partner' : 'user'} />
          </span>
          <span className="ch-them-text">{theirLine}</span>
          {theirs && (
            <span className="ch-them-stars">
              <Star width={13} height={13} data-on="" aria-hidden="true" />
              {totalStars(theirs)}
            </span>
          )}
        </p>

        <section className="ch-free">
          <h3 className="ch-h">{tr('Free play')}</h3>
          <p className="ch-free-sub">{tr('Any size. No clock, no stars.')}</p>
          <div className="ch-sizes">
            {Array.from({ length: HOMES_MAX - HOMES_MIN + 1 }, (_, i) => HOMES_MIN + i).map(n => (
              <button key={n} type="button" onClick={() => onFree(n)}>
                {`${n}×${n}`}
              </button>
            ))}
          </div>
        </section>

        <h3 className="ch-h">{tr('Levels')}</h3>
        {HOMES_WORLDS.map(w => {
          const open = openWorld === w.n;
          let done = 0;
          for (let l = w.from; l <= w.to; l++) if (starsAt(mine, l) > 0) done++;
          return (
            <section key={w.n} className="ch-world" data-open={open || undefined}>
              <button type="button" className="ch-world-head" aria-expanded={open} onClick={() => setOpenWorld(open ? null : w.n)}>
                <span className="ch-world-size">{`${w.n}×${w.n}`}</span>
                <span className="ch-world-range">
                  {tr('Levels {from} to {to}', { from: w.from, to: w.to })}
                </span>
                <span className="ch-world-done">{`${done}/${w.to - w.from + 1}`}</span>
                <ChevronDown className="ch-world-arrow h-4 w-4" aria-hidden="true" />
              </button>
              {open && (
                <div className="ch-tiles">
                  {Array.from({ length: w.to - w.from + 1 }, (_, i) => w.from + i).map(level => {
                    const stars = starsAt(mine, level);
                    const canPlay = levelOpen(mine, level);
                    const isHere = level === current && !finished;
                    return (
                      <button
                        key={level}
                        ref={isHere ? here : undefined}
                        type="button"
                        className="ch-tile"
                        data-state={stars ? 'done' : canPlay ? 'open' : 'locked'}
                        data-here={isHere || undefined}
                        disabled={!canPlay}
                        onClick={() => onPlay(level)}
                        aria-label={canPlay ? tr('Level {n}', { n: level }) : tr('Level {n}, locked', { n: level })}
                      >
                        <span className="ch-tile-n">{level}</span>
                        {canPlay ? <Stars count={stars} size={10} /> : <Lock width={11} height={11} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------- one board

/** The clock on its own, so the board is not drawn again every second. */
const HomesClock: React.FC<{ read: () => number; running: boolean }> = ({ read, running }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => tick(t => t + 1), 500);
    return () => window.clearInterval(id);
  }, [running]);
  return (
    <span className="ch-clock">
      <Timer width={14} height={14} aria-hidden="true" />
      {clockText(read())}
    </span>
  );
};

const HISTORY_KEPT = 400;
const CONFETTI = 30;
const CONFETTI_INKS = ['#f43f5e', '#ffd23f', '#0ea5e9', '#22c55e', '#ffffff'];

interface BoardProps {
  puzzle: HomesPuzzle;
  /** Where a board left part way through is kept: "l37", "f7". */
  slot: string;
  title: string;
  me: Seat;
  /** A numbered level: on the clock, for stars. Free play is neither. */
  level?: number;
  seed?: number;
  /** The stars already won on this level. */
  best: number;
  start: HomesSave | null;
  /** The how-to-play box is up: the clock waits. */
  paused: boolean;
  onSolved: (stars: number) => void;
  onLeave: () => void;
  /** The next level, or another Free play board. Absent after the last level. */
  onNext?: () => void;
  onRules: () => void;
}

export const HomesBoard: React.FC<BoardProps> = ({ puzzle, slot, title, me, level, seed, best, start, paused, onSolved, onLeave, onNext, onRules }) => {
  const tr = useT();
  const { n, homes } = puzzle;
  const timed = level !== undefined;

  const [history, setHistory] = useState(() => ({ list: [start?.cells ?? emptyBoard(n)], at: 0 }));
  const cells = history.list[history.at];
  /** A row of crosses being drawn with a finger, before it is let go. */
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? cells;
  const [hints, setHints] = useState(start?.hints ?? 0);
  const [hint, setHint] = useState<Hint | null>(null);
  const [done, setDone] = useState<{ stars: number; ms: number; hints: number } | null>(null);
  const [card, setCard] = useState(false);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');

  // The clock: what was on it before, and since when it has been running.
  const clock = useRef({ base: start?.ms ?? 0, since: 0 });
  const elapsed = () => clock.current.base + (clock.current.since ? Date.now() - clock.current.since : 0);
  const running = !done && !paused && visible;
  useEffect(() => {
    if (!running) return;
    clock.current.since = Date.now();
    return () => {
      clock.current.base += Date.now() - clock.current.since;
      clock.current.since = 0;
    };
  }, [running]);
  useEffect(() => {
    const seen = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', seen);
    return () => document.removeEventListener('visibilitychange', seen);
  }, []);

  // Kept as it goes, so it is still there after Two has been closed. A level
  // with nothing on it yet is not: there is nothing to come back to.
  const latest = useRef({ cells, hints, done: false });
  latest.current = { cells, hints, done: !!done };
  const keep = () => {
    const now = latest.current;
    if (now.done) return;
    const untouched = now.cells === emptyBoard(n);
    saveBoard(slot, untouched && timed ? null : { cells: now.cells, ms: elapsed(), hints: now.hints, ...(seed ? { seed } : {}), at: Date.now() });
  };
  const keepRef = useRef(keep);
  keepRef.current = keep;
  useEffect(() => {
    keepRef.current();
  }, [cells, hints, visible]);
  useEffect(() => () => keepRef.current(), []);

  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), []);

  // The last friend down: the board is finished.
  useEffect(() => {
    if (done || !solved(puzzle, cells)) return;
    const ms = elapsed();
    const stars = timed ? starsFor(n, ms, hints) : 0;
    setDone({ stars, ms, hints });
    setHint(null);
    saveBoard(slot, null);
    onSolved(stars);
    haptic('confirm');
    playSound('g-pz-done');
    timers.current.push(
      window.setTimeout(() => {
        setCard(true);
        playSound('g-win');
      }, 900)
    );
    if (timed) for (let i = 1; i <= stars; i++) timers.current.push(window.setTimeout(() => playSound('g-point', { rate: 0.9 + i * 0.12 }), 900 + 250 + i * 260));
    // Only when the board changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells]);

  /** A move: what came after it, if anything had been taken back, is gone. */
  const commit = (next: string) => {
    setHint(null);
    setHistory(h => {
      if (next === h.list[h.at]) return h;
      const list = [...h.list.slice(0, h.at + 1), next].slice(-HISTORY_KEPT);
      return { list, at: list.length - 1 };
    });
  };
  const canUndo = !done && history.at > 0;
  const canRedo = !done && history.at < history.list.length - 1;
  const step = (by: number) => {
    setHint(null);
    haptic('tick');
    playSound('g-pz-tap', { rate: by < 0 ? 0.85 : 1.15 });
    setHistory(h => {
      const at = h.at + by;
      return at < 0 || at >= h.list.length ? h : { ...h, at };
    });
  };
  const restart = () => {
    if (done || cells === emptyBoard(n)) return;
    haptic('tick');
    playSound('g-start');
    commit(emptyBoard(n));
  };
  const askHint = () => {
    if (done) return;
    const h = hintFor(puzzle, cells);
    if (!h) return;
    // The same hint asked for again is the same hint, not another one.
    if (!hint || hint.cell !== h.cell || hint.kind !== h.kind) setHints(c => c + 1);
    setHint(h);
    haptic('tick');
    playSound('g-turn');
  };

  /** One tap on a square. */
  const tap = (cell: number) => {
    const next = tapped(cells, cell);
    if (next[cell] === FRIEND) {
      const bad = clashes(puzzle, next)[cell];
      haptic(bad ? 'reject' : 'tick');
      playSound(bad ? 'g-pz-wrong' : 'g-pick');
    } else {
      haptic('tick');
      playSound('g-pz-tap', { rate: next[cell] === CROSS ? 1 : 0.8 });
    }
    commit(next);
  };

  // A finger on the board. Lifted where it went down, it is a tap. Dragged
  // from an empty square it draws crosses on the empty squares it crosses;
  // from a cross, it rubs crosses out. A friend is never moved by a drag.
  const grid = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: number; start: number; last: number; x: number; y: number; mode: 'tap' | 'cross' | 'rub' | 'none'; work: string } | null>(null);
  const cellAt = (x: number, y: number) => {
    const box = grid.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return -1;
    const c = Math.floor(((x - box.left) / box.width) * n);
    const r = Math.floor(((y - box.top) / box.height) * n);
    return c < 0 || c >= n || r < 0 || r >= n ? -1 : r * n + c;
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (done || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell < 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* it still works without: the finger just has to stay on the board */
    }
    getAudioContext();
    drag.current = { id: e.pointerId, start: cell, last: cell, x: e.clientX, y: e.clientY, mode: 'tap', work: cells };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell < 0 || cell === d.last) return;
    if (d.mode === 'tap') {
      // A finger that only wobbled over the edge of its square is still a tap.
      const side = (grid.current?.getBoundingClientRect().width ?? 0) / n;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < side * 0.5) return;
      const was = d.work[d.start];
      d.mode = was === EMPTY ? 'cross' : was === CROSS ? 'rub' : 'none';
      if (d.mode !== 'none') d.work = painted(d.work, d.start, d.mode);
    }
    if (d.mode === 'cross' || d.mode === 'rub') {
      const before = d.work;
      for (const c of lineBetween(d.last, cell, n)) d.work = painted(d.work, c, d.mode);
      if (d.work !== before) playSound('g-pz-tap', { rate: d.mode === 'cross' ? 1.05 : 0.85, gain: 0.6 });
      setDraft(d.work);
    }
    d.last = cell;
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDraft(null);
    if (done) return;
    if (d.mode === 'tap') {
      // Let go well away from where it went down - off the board, say - it was not meant.
      const side = (grid.current?.getBoundingClientRect().width ?? 0) / n;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) <= side) tap(d.start);
    } else if (d.mode !== 'none') {
      haptic('tick');
      commit(d.work);
    }
  };
  const onCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDraft(null);
  };

  // Where one home ends and the next begins: a thick line on that side.
  const edges = useMemo(
    () =>
      homes.map((h, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        return {
          t: r === 0 || homes[i - n] !== h,
          b: r === n - 1 || homes[i + n] !== h,
          l: c === 0 || homes[i - 1] !== h,
          r: c === n - 1 || homes[i + 1] !== h
        };
      }),
    [homes, n]
  );
  const bad = useMemo(() => clashes(puzzle, shown), [puzzle, shown]);
  const placed = friendsOn(shown);
  /** The row, column or home a hint is about, lit up with it. */
  const inHintLine = (i: number) =>
    !!hint &&
    hint.kind === 'only' &&
    (hint.line === 'row' ? Math.floor(i / n) === Math.floor(hint.cell / n) : hint.line === 'col' ? i % n === hint.cell % n : homes[i] === homes[hint.cell]);

  const hintText = !hint
    ? null
    : hint.kind === 'wrong'
      ? tr('This one is not in the right place')
      : hint.kind === 'here'
        ? tr('A friend goes here')
        : hint.line === 'row'
          ? tr('Only one square is left in this row')
          : hint.line === 'col'
            ? tr('Only one square is left in this column')
            : tr('Only one square is left in this colour');

  return (
    <div className="ch-page ch-play" data-done={done ? '' : undefined}>
      <header className="ch-top">
        <button type="button" className="ch-round" onClick={onLeave} aria-label={tr('Levels')}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="ch-title">
          {title}
          <small>{`${n}×${n}`}</small>
        </h2>
        {timed && <HomesClock read={elapsed} running={running} />}
        <button type="button" className="ch-round" onClick={onRules} aria-label={tr('How to play')}>
          <CircleHelp className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="ch-tools">
        <button type="button" className="ch-tool" onClick={() => step(-1)} disabled={!canUndo} aria-label={tr('Back a move')}>
          <Undo2 className="h-5 w-5" aria-hidden="true" />
          <span>{tr('Back')}</span>
        </button>
        <button type="button" className="ch-tool" onClick={() => step(1)} disabled={!canRedo} aria-label={tr('Forward a move')}>
          <Redo2 className="h-5 w-5" aria-hidden="true" />
          <span>{tr('Forward')}</span>
        </button>
        <span className="ch-count" aria-label={tr('{n} of {total} friends placed', { n: placed, total: n })}>
          <span className="ch-count-face" aria-hidden="true">
            <FaceOf seat={me} />
          </span>
          {`${placed}/${n}`}
        </span>
        <button type="button" className="ch-tool" onClick={askHint} disabled={!!done} aria-label={tr('Hint')}>
          <Lightbulb className="h-5 w-5" aria-hidden="true" />
          <span>
            {tr('Hint')}
            {timed && hints > 0 ? ` ${hints}` : ''}
          </span>
        </button>
        <button type="button" className="ch-tool" onClick={restart} disabled={!!done || cells === emptyBoard(n)} aria-label={tr('Start this board again')}>
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
          <span>{tr('Restart')}</span>
        </button>
      </div>

      <div className="ch-stage">
        <div
          ref={grid}
          className="ch-grid"
          data-n={n}
          style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
          onLostPointerCapture={onCancel}
          role="img"
          aria-label={tr('{n} of {total} friends placed', { n: placed, total: n })}
        >
          {homes.map((h, i) => {
            const v = shown[i];
            const e = edges[i];
            return (
              <div
                key={i}
                className="ch-cell"
                data-h={h}
                data-t={e.t || undefined}
                data-b={e.b || undefined}
                data-l={e.l || undefined}
                data-r={e.r || undefined}
                data-bad={(v === FRIEND && bad[i]) || undefined}
                data-hint={hint?.cell === i ? hint.kind : undefined}
                data-line={inHintLine(i) || undefined}
              >
                {v === CROSS && <i className="ch-x" />}
                {v === FRIEND && (
                  <span className="ch-friend" style={done ? { animationDelay: `${(Math.floor(i / n) + (i % n)) * 45}ms` } : undefined}>
                    <Friend home={h} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="ch-say" data-hint={hint ? hint.kind : undefined} aria-live="polite">
        {done ? tr('Everyone is home!') : (hintText ?? tr('Tap once for ✕. Tap again for a friend.'))}
      </p>

      {!timed && !done && onNext && (
        <div className="ch-under">
          <button type="button" className="ch-plain" onClick={onNext}>
            <Shuffle className="h-4 w-4" aria-hidden="true" />
            {tr('Another board')}
          </button>
        </div>
      )}

      {done && card && (
        <div className="ch-shade">
          <div className="pg-party" aria-hidden="true">
            {Array.from({ length: CONFETTI }, (_, i) => (
              <i
                key={i}
                style={
                  {
                    background: CONFETTI_INKS[i % CONFETTI_INKS.length],
                    left: `${8 + ((i * 37) % 84)}%`,
                    '--dx': `${((i * 53) % 120) - 60}px`,
                    '--spin': `${((i * 97) % 720) - 360}deg`,
                    animationDelay: `${(i % 9) * 40}ms`,
                    borderRadius: i % 3 ? '2px' : '50%'
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          <div className="ch-card" role="dialog" aria-modal="true" aria-labelledby="ch-card-title">
            <h3 id="ch-card-title" className="ch-card-title">
              {timed ? tr('Level {n} done!', { n: level }) : tr('Done!')}
            </h3>
            {timed && <Stars count={done.stars} size={38} pop />}
            {timed && (
              <p className="ch-card-line">
                <Timer width={15} height={15} aria-hidden="true" />
                {clockText(done.ms)}
                {done.hints > 0 && <span> · {tr(done.hints === 1 ? '{n} hint' : '{n} hints', { n: done.hints })}</span>}
              </p>
            )}
            {timed && done.stars < 3 && best < 3 && <p className="ch-card-tip">{tr('Be quick and use no hints for 3 stars')}</p>}
            {timed && best > done.stars && <p className="ch-card-tip">{tr('Your best here is still {n} stars', { n: best })}</p>}
            <div className="ch-card-buttons">
              {onNext && (
                <button type="button" className="ch-go" onClick={onNext}>
                  {timed ? tr('Next level') : tr('Another board')}
                </button>
              )}
              <button type="button" className="ch-plain" onClick={onLeave}>
                {tr('Levels')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------- the whole game

/**
 * Cosy Homes: a puzzle for one, over the whole screen (core/cosyHomes). A
 * thousand levels in order, and Free play at any size. Each of you plays your
 * own; the other's progress shows above the levels.
 */
export const CosyHomes: React.FC<CosyHomesProps> = ({ mine, theirs, partnerName, me, onFinish, onBack }) => {
  const tr = useT();
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [touring, setTouring] = useState(() => !tourSeen(HOMES_TOUR_KEY));
  const tourDone = () => {
    markTourSeen(HOMES_TOUR_KEY);
    setTouring(false);
    haptic('tick');
  };

  // The phone's Back: from a board to the levels, from the levels to the games.
  useBackLayer(true, onBack);
  useBackLayer(!!playing, () => setPlaying(null));
  // The how-to-play box goes up after those, so Back closes it first.
  const [settled, setSettled] = useState(false);
  useEffect(() => setSettled(true), []);

  useEffect(() => loadSounds(['g-pz-tap', 'g-pick', 'g-pz-wrong', 'g-pz-done', 'g-win', 'g-point', 'g-turn', 'g-start']), []);

  // The board is made a moment after the screen has changed, so a big one
  // never holds the tap that asked for it.
  const [board, setBoard] = useState<{ key: string; puzzle: HomesPuzzle; start: HomesSave | null } | 'failed' | null>(null);
  const playKey = !playing ? null : 'level' in playing ? `l${playing.level}` : `f${playing.free}:${playing.seed}`;
  useEffect(() => {
    setBoard(null);
    if (!playing || !playKey) return;
    const id = window.setTimeout(() => {
      try {
        if ('level' in playing) {
          const puzzle = levelPuzzle(playing.level);
          setBoard({ key: playKey, puzzle, start: savedBoard(`l${playing.level}`, puzzle.n) });
        } else {
          const puzzle = freePuzzle(playing.free, playing.seed);
          const save = savedBoard(`f${playing.free}`, puzzle.n);
          setBoard({ key: playKey, puzzle, start: save && save.seed === playing.seed ? save : null });
        }
      } catch {
        setBoard('failed');
      }
    }, 30);
    return () => window.clearTimeout(id);
    // `playKey` says all there is to say about `playing`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]);

  const openLevel = (level: number) => {
    getAudioContext();
    haptic('tick');
    setPlaying({ level });
  };
  /** Free play at a size: the board left there last time, or a new one. */
  const openFree = (n: number, fresh = false) => {
    getAudioContext();
    haptic('tick');
    const held = fresh ? null : savedBoard(`f${n}`, n);
    setPlaying({ free: n, seed: held?.seed ?? newSeed() });
  };

  const ready = playing && board && board !== 'failed' && board.key === playKey ? board : null;

  return createPortal(
    <div className="ch fixed inset-0 z-[46]">
      {!playing ? (
        <HomesLevels mine={mine} theirs={theirs} partnerName={partnerName} me={me} onPlay={openLevel} onFree={n => openFree(n)} onRules={() => setTouring(true)} onBack={onBack} />
      ) : ready ? (
        <HomesBoard
          key={ready.key}
          puzzle={ready.puzzle}
          slot={'level' in playing ? `l${playing.level}` : `f${playing.free}`}
          title={'level' in playing ? tr('Level {n}', { n: playing.level }) : tr('Free play')}
          me={me}
          level={'level' in playing ? playing.level : undefined}
          seed={'level' in playing ? undefined : playing.seed}
          best={'level' in playing ? starsAt(mine, playing.level) : 0}
          start={ready.start}
          paused={touring}
          onSolved={stars => {
            if ('level' in playing) onFinish(playing.level, stars);
          }}
          onLeave={() => setPlaying(null)}
          onNext={
            'level' in playing
              ? playing.level < HOMES_LEVELS
                ? () => openLevel(playing.level + 1)
                : undefined
              : () => openFree(playing.free, true)
          }
          onRules={() => setTouring(true)}
        />
      ) : (
        <div className="ch-page">
          <header className="ch-top">
            <button type="button" className="ch-round" onClick={() => setPlaying(null)} aria-label={tr('Levels')}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="ch-title">{'level' in playing ? tr('Level {n}', { n: playing.level }) : tr('Free play')}</h2>
          </header>
          <p className="ch-making">{board === 'failed' ? tr('This board could not be made. Go back and try again.') : tr('Making your board…')}</p>
        </div>
      )}
      {touring && settled && <GameTour title={HOMES_NAME} lines={HOMES_TOUR} art={<HomesIcon />} onDone={tourDone} />}
    </div>,
    document.body
  );
};
