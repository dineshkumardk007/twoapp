import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, CircleHelp, Heart, Home } from 'lucide-react';
import { getAudioContext } from '../core/audioAlerts';
import { useBackLayer } from '../core/backStack';
import { askConfirm } from '../core/dialog';
import { MAZE_TOUR, MAZE_TOUR_KEY, markTourSeen, tourSeen } from '../core/gameTours';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { loadSounds, playSound } from '../core/sounds';
import {
  MAZE_MAKING,
  MAZE_SIGNS,
  bothHome,
  canStep,
  halfAt,
  heartsIn,
  latestHalf,
  levelOfPair,
  mazeOf,
  mergeBooks,
  moveOn,
  onMaze,
  openDoors,
  pairOf,
  sayMaze,
  stepped,
  walkTo,
  whoIs,
  type MazeHalf,
  type MazeLevel
} from '../core/twoHearts';
import type { Seat } from '../core/usTwo';
import { BearFace, BunnyFace } from './CosyHomes';
import { GameTour } from './GameTour';
import { EmoteBubble, EmoteKey, useGameEmotes } from './Emotes';

/** What the game is called, on its card and at its top. */
export const HEARTS_NAME = 'Two Hearts';

interface TwoHeartsProps {
  /** Where each of you is, as last kept: this phone's own one, and the other's. */
  mine?: MazeHalf;
  theirs?: MazeHalf;
  /** Whose phone this is: the bear's or the bunny's. */
  me: Seat;
  /** The other person's name, as this phone knows it. */
  partnerName: string;
  /** Their Two has this game too, with its levels made the same way. */
  canPlay: boolean;
  /** Their phone has emotes (core/gameEmotes, CAN_EMOTE). */
  emotes?: boolean;
  /** This phone's own one has moved: to keep, and to send. */
  onHalf: (half: MazeHalf) => void;
  /** Back to all the games. */
  onBack: () => void;
}

/** A square of the board, in the picture's own units. */
const S = 40;
/** How long a step takes: a walk is one of these after another. */
const STEP_MS = 135;
/** How long after the last step where you are is kept and sent as a record. */
const KEEP_MS = 700;
/** How long a sign stays up. */
const SIGN_MS = 2600;
/** They are taken to be in the maze for this long after anything is heard from them. */
const HERE_MS = 25_000;
/** How often this phone says it is still in the maze. */
const BEAT_MS = 10_000;

/** A door and its button share a colour and a shape. */
const INKS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7'];

/** The shape of a door and its button, drawn round a point. */
const Shape: React.FC<{ kind: number; x: number; y: number; r: number; fill: string }> = ({ kind, x, y, r, fill }) => {
  switch (kind % 5) {
    case 0:
      return <circle cx={x} cy={y} r={r} fill={fill} />;
    case 1:
      return <path d={`M${x},${y - r * 1.1} L${x + r * 1.1},${y + r * 0.85} L${x - r * 1.1},${y + r * 0.85} Z`} fill={fill} />;
    case 2:
      return <rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} rx={r * 0.2} fill={fill} />;
    case 3:
      return <path d={`M${x},${y - r * 1.2} L${x + r * 1.2},${y} L${x},${y + r * 1.2} L${x - r * 1.2},${y} Z`} fill={fill} />;
    default:
      return <path d={`M${x - r * 0.35},${y - r * 1.1} h${r * 0.7} v${r * 0.75} h${r * 0.75} v${r * 0.7} h${-r * 0.75} v${r * 0.75} h${-r * 0.7} v${-r * 0.75} h${-r * 0.75} v${-r * 0.7} h${r * 0.75} Z`} fill={fill} />;
  }
};

const HEART_PATH = 'M0,6 C-9,-1 -8,-8 -3.5,-8 C-1.5,-8 -0.4,-6.8 0,-5.6 C0.4,-6.8 1.5,-8 3.5,-8 C8,-8 9,-1 0,6 Z';

interface BoardProps {
  maze: MazeLevel;
  /** Where the bear is, and the bunny. */
  pos: [number, number];
  /** The hearts picked up: a bit for each. */
  got: number;
  /** A sign held up by each, if any: its place in MAZE_SIGNS. */
  signs: [number | null, number | null];
  /** The door just walked into while shut, to flash it. */
  shut: number | null;
  /** Which one could not go where it was sent, to shake it. */
  stuck: 0 | 1 | null;
  onCell?: (cell: number) => void;
}

/** The maze as it stands: walls, doors, buttons, homes, hearts, and the two of you. */
export const MazeBoard: React.FC<BoardProps> = ({ maze, pos, got, signs, shut, stuck, onCell }) => {
  const { w, h, links } = maze;
  const open = openDoors(maze, pos[0], pos[1]);
  const walls = useMemo(() => {
    let d = '';
    for (let cell = 0; cell < w * h; cell++) {
      const x = (cell % w) * S;
      const y = Math.floor(cell / w) * S;
      if (links[cell][0] < 0) d += `M${x},${y} h${S} `;
      if (links[cell][2] < 0) d += `M${x},${y} v${S} `;
      if (links[cell][1] < 0 && Math.floor(cell / w) === h - 1) d += `M${x},${y + S} h${S} `;
      if (links[cell][3] < 0 && cell % w === w - 1) d += `M${x + S},${y} v${S} `;
    }
    return d;
  }, [links, w, h]);
  const at = (cell: number) => ({ x: (cell % w) * S + S / 2, y: Math.floor(cell / w) * S + S / 2 });
  const together = pos[0] === pos[1];

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCell) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const c = Math.floor(((e.clientX - box.left) / box.width) * w);
    const r = Math.floor(((e.clientY - box.top) / box.height) * h);
    if (c >= 0 && c < w && r >= 0 && r < h) onCell(r * w + c);
  };

  return (
    <div className="th-board" style={{ '--w': w, '--h': h } as React.CSSProperties} onClick={tap}>
      <svg viewBox={`0 0 ${w * S} ${h * S}`} className="th-svg" aria-hidden="true">
        <rect x={-3} y={-3} width={w * S + 6} height={h * S + 6} rx={9} className="th-floor" />
        {/* Where each has to get to: a little house in its own colour. */}
        {([0, 1] as const).map(who => {
          const p = at(maze.home[who]);
          return (
            <g key={who} className="th-home" data-who={who} data-in={pos[who] === maze.home[who] || undefined} transform={`translate(${p.x} ${p.y})`}>
              <rect x={-16} y={-16} width={32} height={32} rx={9} className="th-home-mat" />
              <path d="M-11,-1 L0,-12 L11,-1 V11 H-11 Z" className="th-home-house" />
              <path d="M-3.5,11 V3 H3.5 V11" className="th-home-door" />
            </g>
          );
        })}
        {/* The buttons. */}
        {maze.doors.map((door, g) => {
          const p = at(door.plate);
          return (
            <g key={g} className="th-plate" data-down={open[g] || undefined} transform={`translate(${p.x} ${p.y})`} style={{ color: INKS[g % INKS.length] }}>
              <rect x={-14} y={-14} width={28} height={28} rx={8} className="th-plate-pad" />
              <Shape kind={g} x={0} y={0} r={6} fill="currentColor" />
            </g>
          );
        })}
        {/* The hearts still to be picked up. */}
        {maze.hearts.map((cell, i) =>
          got & (1 << i) ? null : (
            <path key={i} d={HEART_PATH} className="th-heart" transform={`translate(${at(cell).x} ${at(cell).y + 1}) scale(1.25)`} />
          )
        )}
        <path d={walls} className="th-walls" />
        {/* The doors: a bar across the opening, drawn back while its button is held. */}
        {maze.doors.map((door, g) => {
          const a = at(door.a);
          const b = at(door.b);
          const across = Math.floor(door.a / w) === Math.floor(door.b / w);
          const x = (a.x + b.x) / 2;
          const y = (a.y + b.y) / 2;
          const reach = S / 2 - 3;
          return (
            <g key={g} className="th-door" data-open={open[g] || undefined} data-shut={shut === g || undefined} style={{ color: INKS[g % INKS.length] }}>
              <path d={across ? `M${x},${y - reach} V${y + reach}` : `M${x - reach},${y} H${x + reach}`} className="th-door-bar" />
              <path
                d={across ? `M${x},${y - reach} v6 M${x},${y + reach} v-6` : `M${x - reach},${y} h6 M${x + reach},${y} h-6`}
                className="th-door-ends"
              />
              <g className="th-door-sign">
                <circle cx={x} cy={y} r={7.5} className="th-door-disc" />
                <Shape kind={g} x={x} y={y} r={4.2} fill="currentColor" />
              </g>
            </g>
          );
        })}
      </svg>
      {([0, 1] as const).map(who => (
        <div
          key={who}
          className="th-who"
          data-who={who}
          style={{ transform: `translate(${(pos[who] % w) * 100}%, ${Math.floor(pos[who] / w) * 100}%)` }}
        >
          <span className="th-who-in" data-side={together ? who : undefined} data-stuck={stuck === who || undefined}>
            {who === 0 ? <BearFace /> : <BunnyFace />}
          </span>
          {signs[who] !== null && (
            <span className="th-sign" key={`s${signs[who]}`}>
              {MAZE_SIGNS[signs[who] as number]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

/** Up to three hearts, the ones found filled in. */
const Hearts: React.FC<{ count: number; size: number }> = ({ count, size }) => (
  <span className="th-hearts" aria-hidden="true">
    {[1, 2, 3].map(i => (
      <Heart key={i} width={size} height={size} data-on={i <= count || undefined} style={{ animationDelay: `${150 + i * 220}ms` }} />
    ))}
  </span>
);

/** The game's picture, for its card among the games and its how-to-play box. */
export const HeartsIcon: React.FC = () => (
  <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
    <rect x={1.5} y={1.5} width={57} height={57} rx={10} fill="#fff7ea" stroke="#3b2723" strokeWidth={2.4} />
    <path d="M30,2 V22 M30,38 V58 M2,30 H16" stroke="#3b2723" strokeWidth={3} strokeLinecap="round" />
    <path d="M30,24 V36" stroke="#ef4444" strokeWidth={4.5} strokeLinecap="round" />
    <rect x={38} y={38} width={15} height={15} rx={4.5} fill="#ef4444" fillOpacity={0.3} stroke="#ef4444" strokeWidth={2.2} />
    <circle cx={45.5} cy={45.5} r={3} fill="#ef4444" />
    <g transform="translate(3.5 34) scale(0.47)">
      <BearFace />
    </g>
    <g transform="translate(33.5 3) scale(0.47)">
      <BunnyFace />
    </g>
    <path d={HEART_PATH} fill="#f43f5e" stroke="#fff" strokeWidth={0.8} transform="translate(15 14) scale(1.05)" />
  </svg>
);

/**
 * Two Hearts: the maze for the two of you, over the whole screen
 * (core/twoHearts). You each move your own one; a door opens only while the
 * other stands on its button; the level is done when both are home.
 */
export const TwoHearts: React.FC<TwoHeartsProps> = ({ mine, theirs, me, partnerName, canPlay, emotes = true, onHalf, onBack }) => {
  const tr = useT();
  const meIs = whoIs(me);
  const themIs: 0 | 1 = meIs === 0 ? 1 : 0;
  // The faces you pull at each other, as in every game for two.
  const em = useGameEmotes('maze');

  const [touring, setTouring] = useState(() => !tourSeen(MAZE_TOUR_KEY));
  const tourDone = () => {
    markTourSeen(MAZE_TOUR_KEY);
    setTouring(false);
    haptic('tick');
  };
  useBackLayer(true, onBack);
  // The how-to-play box goes up after that, so Back closes it first.
  const [settled, setSettled] = useState(false);
  useEffect(() => setSettled(true), []);
  useEffect(() => loadSounds(['g-hop', 'g-flip', 'g-match', 'g-miss', 'g-win', 'g-turn', 'g-pick', 'g-point']), []);

  // This phone's own one, as it is this instant: ahead of what has been kept
  // and sent, which follows a moment after it stops.
  const [my, setMy] = useState<MazeHalf | undefined>(mine);
  const myRef = useRef(my);
  useEffect(() => {
    // Brought back from the relay with more in it than is here: a restore.
    const later = latestHalf(myRef.current, mine);
    if (later !== myRef.current) {
      myRef.current = later;
      setMy(later);
    }
  }, [mine]);

  // The other one: what was last kept, or what has just been heard, whichever is later.
  const [live, setLive] = useState<MazeHalf | undefined>(undefined);
  const kept = theirs && theirs.v === MAZE_MAKING ? theirs : undefined;
  const their = useMemo(() => {
    const later = latestHalf(kept, live);
    return later && later === live ? { ...later, book: mergeBooks(later.book, kept?.book ?? '') } : later;
  }, [kept, live]);
  const theirRef = useRef(their);
  theirRef.current = their;

  const level = levelOfPair(my, their);
  /** The level on screen: it stays on the one just finished until you move on. */
  const [shown, setShown] = useState(level);
  const finished = shown < level;

  // The maze is made a moment after the screen has changed, so a big one never holds a tap.
  const [made, setMade] = useState<{ level: number; maze: MazeLevel } | 'failed' | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        setMade({ level: shown, maze: mazeOf(shown) });
      } catch {
        setMade('failed');
      }
    }, 20);
    return () => window.clearTimeout(id);
  }, [shown]);
  const maze = made && made !== 'failed' && made.level === shown ? made.maze : null;
  const mazeRef = useRef<MazeLevel | null>(null);
  mazeRef.current = maze && !finished ? maze : null;

  const pair = useMemo(() => (maze && !finished ? pairOf(my, their, me, maze) : null), [maze, finished, my, their, me]);
  const book = mergeBooks(my?.book ?? '', their?.book ?? '');

  // ------------------------------------------------------ keeping and sending
  const keepTimer = useRef<number | null>(null);
  const onHalfRef = useRef(onHalf);
  onHalfRef.current = onHalf;
  const keptN = useRef<string>(mine ? `${mine.level}:${mine.n}` : '');
  const keepNow = () => {
    if (keepTimer.current !== null) window.clearTimeout(keepTimer.current);
    keepTimer.current = null;
    const half = myRef.current;
    if (!half || keptN.current === `${half.level}:${half.n}`) return;
    keptN.current = `${half.level}:${half.n}`;
    onHalfRef.current(half);
  };
  /** Said at once down the unkept channel; kept and sent as a record when it stops, or now. */
  const apply = (half: MazeHalf, now = false) => {
    myRef.current = half;
    setMy(half);
    sayMaze({ h: { v: half.v, level: half.level, pos: half.pos, got: half.got, n: half.n } });
    if (now) keepNow();
    else {
      if (keepTimer.current !== null) window.clearTimeout(keepTimer.current);
      keepTimer.current = window.setTimeout(keepNow, KEEP_MS);
    }
  };
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') keepNow();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      keepNow();
    };
    // `keepNow` reads only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------- hearing the other phone
  const [heardAt, setHeardAt] = useState(0);
  const [signs, setSigns] = useState<[number | null, number | null]>([null, null]);
  const signTimers = useRef<[number | null, number | null]>([null, null]);
  const showSign = (who: 0 | 1, sign: number) => {
    setSigns(prev => (who === 0 ? [sign, prev[1]] : [prev[0], sign]));
    const old = signTimers.current[who];
    if (old !== null) window.clearTimeout(old);
    signTimers.current[who] = window.setTimeout(() => {
      signTimers.current[who] = null;
      setSigns(prev => (who === 0 ? [null, prev[1]] : [prev[0], null]));
    }, SIGN_MS);
  };
  useEffect(
    () =>
      onMaze(said => {
        setHeardAt(Date.now());
        if (said.h && said.h.v === MAZE_MAKING) {
          const heard: MazeHalf = { ...said.h, book: '', at: Date.now() };
          setLive(prev => latestHalf(prev, heard));
        }
        if (said.s !== undefined) {
          showSign(themIs, said.s);
          playSound('g-turn');
          haptic('confirm');
        }
      }),
    // Whose phone this is does not change while the maze is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  // A record from them while this is open is them being here, too.
  const firstTheirs = useRef(true);
  useEffect(() => {
    if (firstTheirs.current) {
      firstTheirs.current = false;
      return;
    }
    if (theirs) setHeardAt(Date.now());
  }, [theirs]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!heardAt) return;
    const id = window.setTimeout(() => tick(t => t + 1), HERE_MS + 200);
    return () => window.clearTimeout(id);
  }, [heardAt]);
  const hereNow = heardAt > 0 && Date.now() - heardAt < HERE_MS;
  // And this phone says it is here: where its own one is, now and every so often.
  useEffect(() => {
    const beat = () => {
      const half = myRef.current;
      if (document.visibilityState === 'hidden') return;
      sayMaze(half ? { h: { v: half.v, level: half.level, pos: half.pos, got: half.got, n: half.n } } : { h: { v: MAZE_MAKING, level: 1, pos: 999, got: 0, n: 0 } });
    };
    beat();
    const id = window.setInterval(beat, BEAT_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(
    () => () => {
      for (const t of signTimers.current) if (t !== null) window.clearTimeout(t);
    },
    []
  );

  // ----------------------------------------------------------------- walking
  const [shut, setShut] = useState<number | null>(null);
  const [stuck, setStuck] = useState<0 | 1 | null>(null);
  const [say, setSay] = useState<string | null>(null);
  const noteTimer = useRef<number | null>(null);
  const note = (text: string | null, door: number | null) => {
    setSay(text);
    setShut(door);
    setStuck(meIs);
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => {
      noteTimer.current = null;
      setSay(null);
      setShut(null);
      setStuck(null);
    }, 1400);
  };
  useEffect(
    () => () => {
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    },
    []
  );

  /** Where the two are this instant, from what is held now rather than what was last drawn. */
  const nowPair = () => {
    const m = mazeRef.current;
    return m ? { maze: m, pair: pairOf(myRef.current, theirRef.current, me, m) } : null;
  };
  /** One step for this phone's own one. False when it may not be taken. */
  const act = (to: number): boolean => {
    const now = nowPair();
    if (!now) return false;
    const { maze: m, pair: p } = now;
    const from = p.pos[meIs];
    if (!canStep(m, from, to, p.pos[themIs])) return false;
    const held = myRef.current;
    const base = held && held.level === p.level ? { ...held, pos: from } : { ...halfAt(p.level, (held?.n ?? 0) + 1, p.book, Date.now()), pos: from };
    const next = stepped(base, m, to, p.got, Date.now());
    apply(next);
    if (next.got !== base.got) {
      playSound('g-match');
      haptic('confirm');
    } else if (m.doors.some(door => door.plate === to)) {
      playSound('g-pick');
      haptic('tick');
    } else {
      playSound('g-hop', { gain: 0.35, rate: 1.25 });
    }
    return true;
  };

  const walk = useRef<{ way: number[]; timer: number } | null>(null);
  const stopWalk = () => {
    if (walk.current) window.clearInterval(walk.current.timer);
    walk.current = null;
  };
  useEffect(() => stopWalk, []);
  const startWalk = (way: number[]) => {
    stopWalk();
    if (!way.length) return;
    const next = () => {
      const w = walk.current;
      if (!w) return;
      const to = w.way.shift();
      if (to === undefined || !act(to) || !w.way.length) stopWalk();
    };
    walk.current = { way: [...way], timer: window.setInterval(next, STEP_MS) };
    next();
  };

  /** A tap on a square: walk there, if there is a way as things stand. */
  const goTo = (cell: number) => {
    const now = nowPair();
    if (!now || !canPlay) return;
    getAudioContext();
    const from = now.pair.pos[meIs];
    if (cell === from) return;
    const way = walkTo(now.maze, from, cell, now.pair.pos[themIs]);
    if (!way.length) {
      stopWalk();
      playSound('g-miss', { gain: 0.5 });
      note(tr('No way there yet'), null);
      return;
    }
    haptic('tick');
    startWalk(way);
  };

  /** An arrow: one step that way. */
  const go = (d: number) => {
    const now = nowPair();
    if (!now || !canPlay) return;
    getAudioContext();
    stopWalk();
    const from = now.pair.pos[meIs];
    const to = now.maze.links[from][d];
    if (to < 0) {
      playSound('g-miss', { gain: 0.35, rate: 1.3 });
      note(null, null);
      return;
    }
    if (!act(to)) {
      playSound('g-miss', { gain: 0.5 });
      haptic('reject');
      note(tr('That door is shut. Its button opens it'), now.maze.gates[from][d]);
    }
  };
  // An arrow held down keeps walking.
  const hold = useRef<number | null>(null);
  const release = () => {
    if (hold.current !== null) window.clearInterval(hold.current);
    hold.current = null;
  };
  useEffect(() => release, []);
  const press = (d: number) => {
    release();
    go(d);
    hold.current = window.setInterval(() => go(d), STEP_MS + 25);
  };
  // And the arrow keys, where there is a keyboard.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const d = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key);
      if (d < 0) return;
      e.preventDefault();
      goRef.current(d);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const goHome = async () => {
    const now = nowPair();
    if (!now || now.pair.pos[meIs] === now.maze.start[meIs]) return;
    const sure = await askConfirm({
      title: tr('Go back to where you started?'),
      body: tr('Only your own one goes back.'),
      confirm: tr('Go back')
    });
    const after = nowPair();
    if (!sure || !after) return;
    stopWalk();
    const held = myRef.current;
    const base = held && held.level === after.pair.level ? held : halfAt(after.pair.level, (held?.n ?? 0) + 1, after.pair.book, Date.now());
    apply({ ...base, pos: after.maze.start[meIs], n: base.n + 1, at: Date.now() });
    haptic('tick');
  };

  const lastSign = useRef(0);
  const sign = (i: number) => {
    if (Date.now() - lastSign.current < 500) return;
    lastSign.current = Date.now();
    getAudioContext();
    sayMaze({ s: i });
    showSign(meIs, i);
    playSound('g-pick');
    haptic('tick');
  };

  // ------------------------------------------------------- what happens by itself
  // Both home: on to the next level, said at once.
  const bearAt = pair?.pos[0];
  const bunnyAt = pair?.pos[1];
  useEffect(() => {
    const now = nowPair();
    if (!now || !bothHome(now.maze, now.pair.pos)) return;
    stopWalk();
    release();
    apply(moveOn(myRef.current, now.pair, Date.now()), true);
    // Only when one of the two has moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bearAt, bunnyAt, maze]);

  // A level finished, by either phone's telling: a cheer.
  const cheered = useRef(shown);
  useEffect(() => {
    if (!finished || cheered.current === shown + 1) return;
    cheered.current = shown + 1;
    stopWalk();
    release();
    playSound('g-win');
    haptic('confirm');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, shown]);

  // A door opening or shutting, as it is seen here.
  const doorsNow = maze && pair ? openDoors(maze, pair.pos[0], pair.pos[1]).join() : '';
  const doorsBefore = useRef(doorsNow);
  useEffect(() => {
    if (doorsBefore.current && doorsNow && doorsBefore.current !== doorsNow && doorsBefore.current.length === doorsNow.length) playSound('g-flip', { gain: 0.6 });
    doorsBefore.current = doorsNow;
  }, [doorsNow]);

  // ------------------------------------------------------------- what it says
  let status: string;
  if (!canPlay) status = tr("{name}'s Two needs the latest update to play this one", { name: partnerName });
  else if (say) status = say;
  else if (!maze || !pair) status = '';
  else {
    const meHome = pair.pos[meIs] === maze.home[meIs];
    const themHome = pair.pos[themIs] === maze.home[themIs];
    const meHolding = maze.doors.some(door => door.plate === pair.pos[meIs]);
    const themHolding = maze.doors.some(door => door.plate === pair.pos[themIs]);
    status = meHolding
      ? tr('You are holding a door open')
      : themHolding
        ? tr('{name} is holding a door open', { name: partnerName })
        : meHome && !themHome
          ? tr('You are home. Now help {name} home', { name: partnerName })
          : themHome && !meHome
            ? tr('{name} is home. Now you', { name: partnerName })
            : tr('Get both of you home');
  }

  const foundHere = finished ? Number(book[shown - 1] ?? 0) || 0 : 0;
  const arrow = (d: number, icon: React.ReactNode, label: string, where: string) => (
    <button
      type="button"
      className="th-arrow"
      data-at={where}
      aria-label={label}
      onPointerDown={e => {
        e.preventDefault();
        press(d);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={e => e.preventDefault()}
    >
      {icon}
    </button>
  );

  return createPortal(
    <div className="ch th fixed inset-0 z-[46]">
      <div className="ch-page">
        <header className="ch-top">
          <button type="button" className="ch-round" onClick={onBack} aria-label={tr('All games')}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h2 className="ch-title">
            {tr(HEARTS_NAME)}
            <small>{tr('Level {n}', { n: shown })}</small>
          </h2>
          <span className="ch-total" aria-label={tr('{n} hearts found', { n: heartsIn(book) })}>
            <Heart width={15} height={15} data-on="" aria-hidden="true" />
            {heartsIn(book)}
          </span>
          {emotes && <EmoteKey emotes={em} seat={me} partnerName={partnerName} />}
          <button type="button" className="ch-round" onClick={() => setTouring(true)} aria-label={tr('How to play')}>
            <CircleHelp className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="th-two">
          <span className="th-chip" data-who={meIs}>
            <span className="th-chip-face" aria-hidden="true">
              {meIs === 0 ? <BearFace /> : <BunnyFace />}
            </span>
            {tr('You')}
            {emotes && <EmoteBubble shown={em.mine} seat={me} side="left" />}
          </span>
          <span className="th-chip" data-who={themIs} data-here={hereNow || undefined}>
            <span className="th-chip-face" aria-hidden="true">
              {themIs === 0 ? <BearFace /> : <BunnyFace />}
            </span>
            <span className="th-chip-name">{partnerName}</span>
            <small>{hereNow ? tr('here now') : tr('not here now')}</small>
            {emotes && <EmoteBubble shown={em.theirs} seat={me === 'user' ? 'partner' : 'user'} side="left" />}
          </span>
        </div>

        <div className="th-stage">
          {maze ? (
            <MazeBoard
              maze={maze}
              pos={pair ? pair.pos : maze.home}
              got={pair ? pair.got : 7}
              signs={signs}
              shut={shut}
              stuck={stuck}
              onCell={finished ? undefined : goTo}
            />
          ) : (
            <p className="ch-making">{made === 'failed' ? tr('This maze could not be made. Go back and try again.') : tr('Making your maze…')}</p>
          )}
        </div>

        <p className="ch-say th-say" data-warn={say ? '' : undefined} aria-live="polite">
          {status}
        </p>

        <div className="th-hands">
          <div className="th-pad" role="group" aria-label={tr('Walk')}>
            {arrow(0, <ArrowUp className="h-6 w-6" aria-hidden="true" />, tr('Up'), 'up')}
            {arrow(2, <ArrowLeft className="h-6 w-6" aria-hidden="true" />, tr('Left'), 'left')}
            <button type="button" className="th-arrow th-arrow-home" data-at="mid" onClick={() => void goHome()} aria-label={tr('Go back to where you started?')}>
              <Home className="h-5 w-5" aria-hidden="true" />
            </button>
            {arrow(3, <ArrowRight className="h-6 w-6" aria-hidden="true" />, tr('Right'), 'right')}
            {arrow(1, <ArrowDown className="h-6 w-6" aria-hidden="true" />, tr('Down'), 'down')}
          </div>
          <div className="th-signs" role="group" aria-label={tr('Signs for {name}', { name: partnerName })}>
            {MAZE_SIGNS.map((emoji, i) => (
              <button key={emoji} type="button" className="th-sign-key" onClick={() => sign(i)}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {finished && (
        <div className="ch-shade">
          <div className="pg-party" aria-hidden="true">
            {Array.from({ length: 30 }, (_, i) => (
              <i
                key={i}
                style={
                  {
                    background: ['#f43f5e', '#ffd23f', '#0ea5e9', '#22c55e', '#ffffff'][i % 5],
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
          <div className="ch-card" role="dialog" aria-modal="true" aria-labelledby="th-card-title">
            <h3 id="th-card-title" className="ch-card-title">
              {tr('Level {n} done!', { n: shown })}
            </h3>
            <Hearts count={foundHere} size={38} />
            <p className="ch-card-tip">{tr('You both got home, together.')}</p>
            <div className="ch-card-buttons">
              <button
                type="button"
                className="ch-go"
                onClick={() => {
                  getAudioContext();
                  haptic('tick');
                  setShown(level);
                }}
              >
                {tr('Next level')}
              </button>
            </div>
          </div>
        </div>
      )}
      {touring && settled && <GameTour title={HEARTS_NAME} lines={MAZE_TOUR} art={<HeartsIcon />} onDone={tourDone} />}
    </div>,
    document.body
  );
};
