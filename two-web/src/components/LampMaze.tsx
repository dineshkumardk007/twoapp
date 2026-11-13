import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw } from 'lucide-react';
import { getAudioContext } from '../core/audioAlerts';
import { askConfirm } from '../core/dialog';
import { duoOf, onDuo, sayDuo, withDuo } from '../core/duo';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { cleanLampSaid, keyOn, lampCarrier, lampDone, lampOf, lampStep, lampToWire, lit, shadowStep, type LampLevel } from '../core/lampMaze';
import { loadSounds, playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import type { DuoGameProps } from './BombSquad';
import { DuoCard, DuoFace, DuoShell } from './DuoShell';
import { useGameEmotes } from './Emotes';

/** A square of the board, in the picture's own units. */
const S = 40;
const STEP_MS = 150;
/** How often this phone says where its own one is, steps or no steps. */
const BEAT_MS = 2000;
/** A gate and its key share a colour. */
const INKS = ['#f59e0b', '#38bdf8', '#f472b6', '#4ade80'];

/** The game's picture, for its card among the games and its how-to-play box. */
export const LampIcon: React.FC = () => (
  <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
    <defs>
      <radialGradient id="lm-icon-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" />
        <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x={1.5} y={1.5} width={57} height={57} rx={10} fill="#0f172a" stroke="#020617" strokeWidth={2.4} />
    <circle cx={22} cy={30} r={22} fill="url(#lm-icon-glow)" />
    <path d="M30,6 V26 M30,38 V54 M30,26 H44" stroke="#e2e8f0" strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" />
    <rect x={16} y={24} width={12} height={15} rx={3} fill="#fbbf24" stroke="#78350f" strokeWidth={1.8} />
    <path d="M18,24 q4,-8 8,0 M19,39 h6" stroke="#78350f" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    <circle cx={43} cy={41} r={8} fill="#1e1b4b" stroke="#a78bfa" strokeWidth={1.8} />
    <circle cx={40.5} cy={40} r={1.2} fill="#c4b5fd" />
    <circle cx={45.5} cy={40} r={1.2} fill="#c4b5fd" />
  </svg>
);

interface BoardProps {
  maze: LampLevel;
  lamp: number;
  shadow: number;
  /** The keys picked up: a bit for each gate. */
  keys: number;
  /** The squares the light has ever fallen on, this go. */
  seen: ReadonlySet<number>;
  /** Who carries the lamp. */
  carrier: Seat;
  /** The gate just walked into while locked, to flash it. */
  locked: number | null;
  /** Which one could not go where it was sent, to shake it. */
  stuck: 'lamp' | 'shadow' | null;
  onCell?: (cell: number) => void;
}

/** The maze as the two of you see it: only what the lamp's light falls on, and - dimly - what it has. */
export const LampBoard: React.FC<BoardProps> = ({ maze, lamp, shadow, keys, seen, carrier, locked, stuck, onCell }) => {
  const { w, h, links } = maze;
  const at = (cell: number) => ({ x: (cell % w) * S + S / 2, y: Math.floor(cell / w) * S + S / 2 });
  const { bright, dim, wallsBright, wallsDim } = useMemo(() => {
    const bright: number[] = [];
    const dim: number[] = [];
    let wallsBright = '';
    let wallsDim = '';
    for (let cell = 0; cell < w * h; cell++) {
      const isLit = lit(maze, cell, lamp);
      if (!isLit && !seen.has(cell)) continue;
      (isLit ? bright : dim).push(cell);
      const x = (cell % w) * S;
      const y = Math.floor(cell / w) * S;
      let d = '';
      if (links[cell][0] < 0) d += `M${x},${y} h${S} `;
      if (links[cell][1] < 0) d += `M${x},${y + S} h${S} `;
      if (links[cell][2] < 0) d += `M${x},${y} v${S} `;
      if (links[cell][3] < 0) d += `M${x + S},${y} v${S} `;
      if (isLit) wallsBright += d;
      else wallsDim += d;
    }
    return { bright, dim, wallsBright, wallsDim };
  }, [maze, lamp, seen, w, h, links]);
  const shown = (cell: number) => lit(maze, cell, lamp) || seen.has(cell);
  const lampAt = at(lamp);
  const reach = (Math.sqrt(maze.reach2) + 0.75) * S;
  const exit = at(maze.exit);

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCell) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const c = Math.floor(((e.clientX - box.left) / box.width) * w);
    const r = Math.floor(((e.clientY - box.top) / box.height) * h);
    if (c >= 0 && c < w && r >= 0 && r < h) onCell(r * w + c);
  };

  return (
    <div className="th-board lm-board" style={{ '--w': w, '--h': h } as React.CSSProperties} onClick={tap}>
      <svg viewBox={`0 0 ${w * S} ${h * S}`} className="th-svg" aria-hidden="true">
        <defs>
          <radialGradient id="lm-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.5" />
            <stop offset="70%" stopColor="#fbbf24" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x={-3} y={-3} width={w * S + 6} height={h * S + 6} rx={9} className="lm-dark" />
        {dim.map(cell => (
          <rect key={`d${cell}`} x={(cell % w) * S} y={Math.floor(cell / w) * S} width={S} height={S} className="lm-tile" data-dim="" />
        ))}
        {bright.map(cell => (
          <rect key={`b${cell}`} x={(cell % w) * S} y={Math.floor(cell / w) * S} width={S} height={S} className="lm-tile" />
        ))}
        <circle cx={lampAt.x} cy={lampAt.y} r={reach} fill="url(#lm-glow)" className="lm-glow" />
        {/* The way out: it glows faintly in the dark, so you know which way to head. */}
        <g className="lm-exit" data-lit={lit(maze, maze.exit, lamp) || undefined} transform={`translate(${exit.x} ${exit.y})`}>
          <circle r={15} className="lm-exit-halo" />
          <path d="M-9,13 V-5 a9,9 0 0 1 18,0 V13 Z" className="lm-exit-door" />
          <circle cx={4.5} cy={3} r={1.6} className="lm-exit-knob" />
        </g>
        {/* The keys still lying where they are. */}
        {maze.gates.map((gate, g) =>
          keys & (1 << g) || !shown(gate.key) ? null : (
            <g key={`k${g}`} className="lm-key" transform={`translate(${at(gate.key).x} ${at(gate.key).y})`} style={{ color: INKS[g % INKS.length] }}>
              <circle cx={-4} cy={0} r={5.5} fill="none" stroke="currentColor" strokeWidth={3.2} />
              <path d="M1.5,0 H12 M8,0 V5 M12,0 V4" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" fill="none" />
            </g>
          )
        )}
        <path d={wallsDim} className="lm-walls" data-dim="" />
        <path d={wallsBright} className="lm-walls" />
        {maze.gates.map((gate, g) => {
          if (!shown(gate.a) && !shown(gate.b)) return null;
          const a = at(gate.a);
          const b = at(gate.b);
          const across = Math.floor(gate.a / w) === Math.floor(gate.b / w);
          const x = (a.x + b.x) / 2;
          const y = (a.y + b.y) / 2;
          const half = S / 2 - 3;
          return (
            <g key={`g${g}`} className="lm-gate" data-open={!!(keys & (1 << g)) || undefined} data-locked={locked === g || undefined} style={{ color: INKS[g % INKS.length] }}>
              <path d={across ? `M${x},${y - half} V${y + half}` : `M${x - half},${y} H${x + half}`} className="lm-gate-bar" />
              <circle cx={x} cy={y} r={6.5} className="lm-gate-lock" />
              <path d={`M${x - 2.6},${y - 1} v-2.4 a2.6,2.6 0 0 1 5.2,0 v2.4`} className="lm-gate-hasp" />
            </g>
          );
        })}
      </svg>
      {(['shadow', 'lamp'] as const).map(who => {
        const cell = who === 'lamp' ? lamp : shadow;
        const seat: Seat = who === 'lamp' ? carrier : carrier === 'user' ? 'partner' : 'user';
        return (
          <div key={who} className="th-who lm-who" data-part={who} style={{ transform: `translate(${(cell % w) * 100}%, ${Math.floor(cell / w) * 100}%)` }}>
            <span className="th-who-in" data-side={lamp === shadow ? (who === 'lamp' ? 0 : 1) : undefined} data-stuck={stuck === who || undefined}>
              <DuoFace seat={seat} />
            </span>
            {who === 'lamp' && (
              <span className="lm-lamp" aria-hidden="true">
                🏮
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Light and Shadow (core/lampMaze): one of you carries the lamp, the other
 * is a shadow that goes through walls but only where the light falls.
 */
export const LampMaze: React.FC<DuoGameProps> = ({ mine, theirs, me, partnerName, canPlay, emotes = true, onHalf, onBack }) => {
  const tr = useT();
  const em = useGameEmotes('lamp');
  const done = duoOf(mine, theirs).lamp;
  /** The level on screen: it stays on the one just done until you move on. */
  const [level, setLevel] = useState(done + 1);
  const levelRef = useRef(level);
  levelRef.current = level;
  const maze = useMemo(() => {
    try {
      return lampOf(level);
    } catch {
      return null;
    }
  }, [level]);
  const mazeRef = useRef(maze);
  mazeRef.current = maze;
  const carrier = lampCarrier(level);
  const carrying = carrier === me;
  const carryingRef = useRef(carrying);
  carryingRef.current = carrying;

  useEffect(() => loadSounds(['g-hop', 'g-miss', 'g-win', 'g-lm-key', 'g-lm-gate', 'g-pick']), []);

  // Where the two are, which keys have been picked up, and which go at the level this is.
  const [, redraw] = useState(0);
  const st = useRef({ e: 0, my: maze?.start ?? 0, their: maze?.start ?? 0, keys: 0, seen: new Set<number>(), finished: false });
  const draw = () => redraw(n => n + 1);
  const see = () => {
    const m = mazeRef.current;
    if (!m) return;
    const lamp = carryingRef.current ? st.current.my : st.current.their;
    for (let cell = 0; cell < m.w * m.h; cell++) if (lit(m, cell, lamp)) st.current.seen.add(cell);
  };
  /** Both back at the start, with nothing picked up: a new level, or this one again. */
  const reset = (e: number) => {
    const m = mazeRef.current;
    st.current = { e, my: m?.start ?? 0, their: m?.start ?? 0, keys: 0, seen: new Set<number>(), finished: false };
    see();
  };
  const startedFor = useRef(-1);
  if (startedFor.current !== level) {
    startedFor.current = level;
    reset(0);
  }

  const say = () => {
    if (document.visibilityState === 'hidden') return;
    sayDuo('lamp', lampToWire({ level: levelRef.current, e: st.current.e, pos: st.current.my, keys: st.current.keys }));
  };
  useEffect(() => {
    say();
    const id = window.setInterval(say, BEAT_MS);
    return () => window.clearInterval(id);
    // `say` reads only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onHalfRef = useRef(onHalf);
  onHalfRef.current = onHalf;
  const mineRef = useRef(mine);
  mineRef.current = mine;
  const wrote = useRef(0);
  /** A level done: written down once, by each phone as it sees it. */
  const finish = (which: number) => {
    if (which === levelRef.current && !st.current.finished) {
      st.current.finished = true;
      playSound('g-win');
      haptic('confirm');
      draw();
    }
    if (wrote.current >= which) return;
    wrote.current = which;
    const next = withDuo(mineRef.current, 'lamp', which, Date.now());
    if (next !== mineRef.current) onHalfRef.current(next);
  };
  const check = () => {
    const m = mazeRef.current;
    if (!m || st.current.finished) return;
    const lamp = carryingRef.current ? st.current.my : st.current.their;
    const shadow = carryingRef.current ? st.current.their : st.current.my;
    if (lampDone(m, lamp, shadow)) {
      finish(m.level);
      say();
    }
  };

  // Hearing the other phone.
  useEffect(
    () =>
      onDuo('lamp', raw => {
        const said = cleanLampSaid(raw);
        const m = mazeRef.current;
        if (!said || !m) return;
        if (said.level > levelRef.current) {
          // They are on the next one: this one was finished.
          finish(said.level - 1);
          return;
        }
        if (said.level < levelRef.current || st.current.finished) return;
        if (said.e < st.current.e || said.pos >= m.w * m.h) return;
        if (said.e > st.current.e) {
          // They started it again: so does this phone.
          reset(said.e);
          playSound('g-pick');
        }
        const gained = said.keys & ~st.current.keys;
        st.current.their = said.pos;
        st.current.keys |= said.keys;
        if (gained) {
          playSound('g-lm-gate');
          haptic('confirm');
        }
        see();
        check();
        draw();
      }),
    // Whose phone this is does not change while the game is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ----------------------------------------------------------------- walking
  const [note, setNote] = useState<{ text: string | null; gate: number | null } | null>(null);
  const noteTimer = useRef<number | null>(null);
  const tell = (text: string | null, gate: number | null) => {
    setNote({ text, gate });
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 1500);
  };
  useEffect(
    () => () => {
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    },
    []
  );

  const go = (d: number) => {
    const m = mazeRef.current;
    if (!m || st.current.finished || !canPlay) return;
    getAudioContext();
    const s = st.current;
    if (carryingRef.current) {
      const step = lampStep(m, s.my, d, s.keys, s.their);
      if ('to' in step) {
        s.my = step.to;
        playSound('g-hop', { gain: 0.35, rate: 1.1 });
      } else {
        playSound('g-miss', { gain: step.stop === 'wall' ? 0.3 : 0.5 });
        if (step.stop !== 'wall') haptic('reject');
        tell(
          step.stop === 'gate' ? tr('That gate is locked. Its key opens it') : step.stop === 'dark' ? tr('Do not leave {name} in the dark', { name: partnerName }) : null,
          step.stop === 'gate' ? (step.gate ?? null) : null
        );
        return;
      }
    } else {
      const step = shadowStep(m, s.my, d, s.their);
      if ('to' in step) {
        s.my = step.to;
        const key = lit(m, step.to, s.their) ? keyOn(m, step.to) : -1;
        if (key >= 0 && !(s.keys & (1 << key))) {
          s.keys |= 1 << key;
          playSound('g-lm-key');
          window.setTimeout(() => playSound('g-lm-gate'), 260);
          haptic('confirm');
        } else playSound('g-hop', { gain: 0.3, rate: 1.4 });
      } else {
        playSound('g-miss', { gain: 0.4 });
        if (step.stop === 'dark') haptic('reject');
        tell(step.stop === 'dark' ? tr('Too dark there. Stay in the light') : null, null);
        return;
      }
    }
    see();
    say();
    check();
    draw();
  };
  const goRef = useRef(go);
  goRef.current = go;

  // An arrow held down keeps walking.
  const hold = useRef<number | null>(null);
  const release = () => {
    if (hold.current !== null) window.clearInterval(hold.current);
    hold.current = null;
  };
  useEffect(() => release, []);
  const press = (d: number) => {
    release();
    goRef.current(d);
    hold.current = window.setInterval(() => goRef.current(d), STEP_MS + 30);
  };
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
  /** A tap on a square: one step toward it. */
  const toward = (cell: number) => {
    const m = mazeRef.current;
    if (!m || cell === st.current.my) return;
    const dx = (cell % m.w) - (st.current.my % m.w);
    const dy = Math.floor(cell / m.w) - Math.floor(st.current.my / m.w);
    go(Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 0 : 1) : dx < 0 ? 2 : 3);
  };

  const again = async () => {
    const sure = await askConfirm({
      title: tr('Start this level again?'),
      body: tr('Both of you go back to the start.'),
      confirm: tr('Start again')
    });
    if (!sure || st.current.finished) return;
    reset(st.current.e + 1);
    say();
    haptic('tick');
    draw();
  };

  const next = () => {
    getAudioContext();
    haptic('tick');
    setLevel(Math.max(level + 1, duoOf(mineRef.current, theirs).lamp + 1));
  };

  const s = st.current;
  const lamp = carrying ? s.my : s.their;
  const shadow = carrying ? s.their : s.my;
  let status: string;
  if (!canPlay) status = tr("{name}'s Two needs the latest update to play this one", { name: partnerName });
  else if (note?.text) status = note.text;
  else if (!em.theirHere) status = tr('Waiting for {name} to open this game', { name: partnerName });
  else if (carrying) status = tr('You carry the lamp. Stand near a key so {name} can reach it', { name: partnerName });
  else status = tr('You are the shadow. Walk through walls, but stay in the light');

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

  return (
    <DuoShell
      game="lamp"
      sub={tr('Level {n}', { n: level })}
      me={me}
      partnerName={partnerName}
      em={em}
      emotes={emotes}
      myPart={carrying ? tr('the lamp') : tr('the shadow')}
      theirPart={carrying ? tr('the shadow') : tr('the lamp')}
      art={<LampIcon />}
      onBack={onBack}
      over={
        s.finished ? (
          <DuoCard title={tr('Level {n} done!', { n: level })} tip={tr('Next time you swap: the other one carries the lamp.')} party>
            <button type="button" className="ch-go" onClick={next}>
              {tr('Next level')}
            </button>
          </DuoCard>
        ) : undefined
      }
    >
      <div className="th-stage">
        {maze ? (
          <LampBoard
            maze={maze}
            lamp={lamp}
            shadow={shadow}
            keys={s.keys}
            seen={s.seen}
            carrier={carrier}
            locked={note?.gate ?? null}
            stuck={note ? (carrying ? 'lamp' : 'shadow') : null}
            onCell={s.finished ? undefined : toward}
          />
        ) : (
          <p className="ch-making">{tr('This maze could not be made. Go back and try again.')}</p>
        )}
      </div>

      <p className="ch-say th-say" data-warn={note?.text ? '' : undefined} aria-live="polite">
        {status}
      </p>

      <div className="th-hands lm-hands">
        <div className="lm-keys" aria-label={tr('Keys')}>
          {maze?.gates.map((_, g) => (
            <span key={g} className="lm-keyring" data-got={!!(s.keys & (1 << g)) || undefined} style={{ color: INKS[g % INKS.length] }}>
              🔑
            </span>
          ))}
        </div>
        <div className="th-pad" role="group" aria-label={tr('Walk')}>
          {arrow(0, <ArrowUp className="h-6 w-6" aria-hidden="true" />, tr('Up'), 'up')}
          {arrow(2, <ArrowLeft className="h-6 w-6" aria-hidden="true" />, tr('Left'), 'left')}
          <button type="button" className="th-arrow th-arrow-home" data-at="mid" onClick={() => void again()} aria-label={tr('Start this level again?')}>
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
          </button>
          {arrow(3, <ArrowRight className="h-6 w-6" aria-hidden="true" />, tr('Right'), 'right')}
          {arrow(1, <ArrowDown className="h-6 w-6" aria-hidden="true" />, tr('Down'), 'down')}
        </div>
      </div>
    </DuoShell>
  );
};
