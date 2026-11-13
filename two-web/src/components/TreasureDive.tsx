import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { getAudioContext } from '../core/audioAlerts';
import { duoOf, onDuo, sayDuo, withDuo } from '../core/duo';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { loadSounds, playSound } from '../core/sounds';
import {
  AIR_GIFT_EVERY_S,
  DIVE_SIGNS,
  airSent,
  allChests,
  breathed,
  cleanDiveSaid,
  diveOf,
  diveToWire,
  diverOf,
  inSight,
  newDive,
  stroke,
  type DiveDid,
  type DiveLevel,
  type DiveRun
} from '../core/treasureDive';
import type { Seat } from '../core/usTwo';
import type { DuoGameProps } from './BombSquad';
import { DuoCard, DuoFace, DuoShell } from './DuoShell';
import { useGameEmotes } from './Emotes';

/** A square of the sea floor, in the picture's own units. */
const S = 40;
const STEP_MS = 170;
const TAPE = 7;
/** Not heard from the diver's phone for this long, its air is taken to have stopped running. */
const QUIET_MS = 6000;

/** The game's picture, for its card among the games and its how-to-play box. */
export const DiveIcon: React.FC = () => (
  <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
    <defs>
      <linearGradient id="dv-icon-sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#0c4a6e" />
      </linearGradient>
    </defs>
    <rect x={1.5} y={1.5} width={57} height={57} rx={10} fill="url(#dv-icon-sea)" stroke="#082f49" strokeWidth={2.4} />
    <path d="M2,14 q7,-5 14,0 t14,0 t14,0 t14,0" fill="none" stroke="#e0f2fe" strokeWidth={2} strokeLinecap="round" />
    <path d="M18,8 h16 l-3,6 h-10 Z" fill="#fde68a" stroke="#78350f" strokeWidth={1.6} strokeLinejoin="round" />
    <path d="M26,14 V34" stroke="#e0f2fe" strokeWidth={1.4} strokeDasharray="2 3" />
    <circle cx={26} cy={38} r={6} fill="#fbbf24" stroke="#78350f" strokeWidth={1.6} />
    <rect x={22.5} y={36} width={7} height={3.6} rx={1.4} fill="#bae6fd" stroke="#0c4a6e" strokeWidth={1} />
    <circle cx={34} cy={30} r={1.6} fill="#e0f2fe" fillOpacity={0.8} />
    <circle cx={37} cy={24} r={2.2} fill="#e0f2fe" fillOpacity={0.6} />
    <rect x={38} y={44} width={14} height={9} rx={2} fill="#b45309" stroke="#451a03" strokeWidth={1.6} />
    <path d="M38,47.5 h14 M45,47.5 v2.5" stroke="#fde68a" strokeWidth={1.6} strokeLinecap="round" />
    <path d="M6,54 q4,-9 9,-3 q3,-6 7,3 Z" fill="#334155" stroke="#0f172a" strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface BoardProps {
  sea: DiveLevel;
  /** From the boat everything shows; from in the water, only what is right beside the diver. */
  view: 'boat' | 'diver';
  diver: number;
  /** Who is diving. */
  who: Seat;
  /** The chests brought up: a bit for each. */
  got: number;
  /** The rocks the diver has come across, this dive. */
  seen: ReadonlySet<number>;
  /** The diver has just swum into a current, or into a rock. */
  jolt: 'current' | 'rock' | null;
  onCell?: (cell: number) => void;
}

/** The sea floor: the whole chart for the boat, a small patch of it for the diver. */
export const DiveBoard: React.FC<BoardProps> = ({ sea, view, diver, who, got, seen, jolt, onCell }) => {
  const { w, h } = sea;
  const at = (cell: number) => ({ x: (cell % w) * S + S / 2, y: Math.floor(cell / w) * S + S / 2 });
  const cells = useMemo(() => Array.from({ length: w * h }, (_, i) => i), [w, h]);
  const clear = (cell: number) => view === 'boat' || inSight(sea, cell, diver);
  const anchor = at(sea.start);

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCell) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const c = Math.floor(((e.clientX - box.left) / box.width) * w);
    const r = Math.floor(((e.clientY - box.top) / box.height) * h);
    if (c >= 0 && c < w && r >= 0 && r < h) onCell(r * w + c);
  };

  return (
    <div className="th-board dv-board" data-view={view} style={{ '--w': w, '--h': h } as React.CSSProperties} onClick={tap}>
      <svg viewBox={`0 0 ${w * S} ${h * S}`} className="th-svg" aria-hidden="true">
        <defs>
          <linearGradient id={`dv-sea-${view}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={view === 'boat' ? '#7dd3fc' : '#0e7490'} />
            <stop offset="100%" stopColor={view === 'boat' ? '#0369a1' : '#042f2e'} />
          </linearGradient>
        </defs>
        <rect x={-3} y={-3} width={w * S + 6} height={h * S + 6} rx={9} fill={`url(#dv-sea-${view})`} className="dv-sea" />
        {view === 'diver' &&
          cells.map(cell =>
            clear(cell) ? <rect key={`c${cell}`} x={(cell % w) * S} y={Math.floor(cell / w) * S} width={S} height={S} className="dv-clear" /> : null
          )}
        {view === 'boat' && (
          <path
            d={cells.map(cell => `M${(cell % w) * S},${Math.floor(cell / w) * S} h${S} v${S}`).join(' ')}
            className="dv-grid"
          />
        )}
        {/* The anchor: where the dive starts, and where it has to end. */}
        <g transform={`translate(${anchor.x} ${anchor.y})`} className="dv-anchor">
          <circle r={15} className="dv-anchor-ring" />
          <text y={7} textAnchor="middle" fontSize={20}>
            ⚓
          </text>
        </g>
        {cells.map(cell => {
          const p = at(cell);
          if (sea.rock[cell]) {
            if (!clear(cell) && !seen.has(cell)) return null;
            return (
              <path
                key={`r${cell}`}
                d={`M${p.x - 15},${p.y + 13} q-3,-14 5,-19 q5,-9 12,-3 q10,-1 11,9 q5,8 -3,13 Z`}
                className="dv-rock"
                data-dim={!clear(cell) || undefined}
              />
            );
          }
          if (sea.current[cell] && view === 'boat') {
            return (
              <g key={`s${cell}`} transform={`translate(${p.x} ${p.y})`} className="dv-current">
                <path d="M0,0 m-10,0 a10,10 0 1 1 10,10 a6.5,6.5 0 1 1 6.5,-6.5 a3.2,3.2 0 1 1 -3.2,-3.2" />
              </g>
            );
          }
          return null;
        })}
        {sea.chests.map((cell, i) =>
          got & (1 << i) || !clear(cell) ? null : (
            <g key={`t${i}`} transform={`translate(${at(cell).x} ${at(cell).y})`} className="dv-chest">
              <rect x={-12} y={-7} width={24} height={16} rx={3} className="dv-chest-box" />
              <path d="M-12,-1 h24 M0,-1 v4" className="dv-chest-band" />
              <path d="M-12,-7 q12,-9 24,0" className="dv-chest-lid" />
            </g>
          )
        )}
      </svg>
      <div className="th-who dv-who" style={{ transform: `translate(${(diver % w) * 100}%, ${Math.floor(diver / w) * 100}%)` }}>
        <span className="th-who-in" data-jolt={jolt || undefined}>
          <DuoFace seat={who} />
        </span>
        <span className="dv-mask" aria-hidden="true">
          🤿
        </span>
      </div>
    </div>
  );
};

interface Taped {
  who: Seat;
  sign: number;
  id: number;
}

/**
 * Treasure Divers (core/treasureDive): one of you in the murky water, the
 * other on the boat with the chart, and arrow signs between you.
 */
export const TreasureDive: React.FC<DuoGameProps> = ({ mine, theirs, me, partnerName, canPlay, emotes = true, onHalf, onBack }) => {
  const tr = useT();
  const em = useGameEmotes('dive');
  const them: Seat = me === 'user' ? 'partner' : 'user';
  const done = duoOf(mine, theirs).dive;
  /** The level on screen: it stays on the one just done until you move on. */
  const [level, setLevel] = useState(done + 1);
  const levelRef = useRef(level);
  levelRef.current = level;
  const sea = useMemo(() => {
    try {
      return diveOf(level);
    } catch {
      return null;
    }
  }, [level]);
  const seaRef = useRef(sea);
  seaRef.current = sea;
  const diving = diverOf(level) === me;
  const divingRef = useRef(diving);
  divingRef.current = diving;

  useEffect(() => loadSounds(['g-dv-swim', 'g-dv-chest', 'g-dv-current', 'g-dv-air', 'g-bm-tick', 'g-win', 'g-lose', 'g-miss', 'g-pick', 'g-turn', 'g-start']), []);

  const [run, setRunState] = useState<DiveRun | null>(null);
  const runRef = useRef<DiveRun | null>(null);
  const seen = useRef(new Set<number>());
  const look = (r: DiveRun | null) => {
    const s = seaRef.current;
    if (!s || !r) return;
    for (let cell = 0; cell < s.w * s.h; cell++) if (s.rock[cell] && inSight(s, cell, r.pos)) seen.current.add(cell);
  };
  const setRun = (next: DiveRun | null) => {
    if (!next || next.e !== runRef.current?.e) seen.current = new Set();
    runRef.current = next;
    look(next);
    setRunState(next);
  };
  const heardAt = useRef(0);
  const [, redraw] = useState(0);

  const [tape, setTape] = useState<Taped[]>([]);
  const tapeId = useRef(0);
  const addSign = (who: Seat, sign: number) => setTape(list => [...list.slice(-(TAPE - 1)), { who, sign, id: ++tapeId.current }]);
  const [jolt, setJolt] = useState<'current' | 'rock' | null>(null);
  const joltTimer = useRef<number | null>(null);
  const shake = (what: 'current' | 'rock') => {
    setJolt(what);
    if (joltTimer.current !== null) window.clearTimeout(joltTimer.current);
    joltTimer.current = window.setTimeout(() => setJolt(null), 500);
  };
  useEffect(
    () => () => {
      if (joltTimer.current !== null) window.clearTimeout(joltTimer.current);
    },
    []
  );

  const onHalfRef = useRef(onHalf);
  onHalfRef.current = onHalf;
  const mineRef = useRef(mine);
  mineRef.current = mine;
  const wrote = useRef(0);
  /** How a dive ended, as each phone learns of it: the sound of it, and a level done written down once. */
  const ending = (over: 1 | 2, which: number) => {
    playSound(over === 1 ? 'g-win' : 'g-lose');
    haptic(over === 1 ? 'confirm' : 'reject');
    if (over !== 1 || wrote.current >= which) return;
    wrote.current = which;
    const next = withDuo(mineRef.current, 'dive', which, Date.now());
    if (next !== mineRef.current) onHalfRef.current(next);
  };

  const say = (r: DiveRun) => sayDuo('dive', { s: diveToWire(r) });
  const lastGift = useRef(0);
  /** The diver's phone starts a dive. */
  const begin = () => {
    const s = seaRef.current;
    if (!divingRef.current || !s) return;
    getAudioContext();
    const next = newDive(s, Math.floor(Date.now() / 1000) % 1_000_000_000);
    lastGift.current = 0;
    setRun(next);
    setTape([]);
    say(next);
    playSound('g-start');
    haptic('confirm');
  };
  const beginRef = useRef(begin);
  beginRef.current = begin;

  // The air, on the diver's phone; and how the dive stands, said every second.
  useEffect(() => {
    let last = Date.now();
    let sinceSaid = 0;
    const id = window.setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      if (!divingRef.current) {
        // The boat's side only counts down between words from the diver, and its air button comes back.
        redraw(n => n + 1);
        return;
      }
      const held = runRef.current;
      sinceSaid += dt;
      if (held && !held.over) {
        const before = Math.ceil(held.air);
        const next = breathed(held, dt);
        setRun(next);
        if (next.over) {
          ending(2, next.level);
          say(next);
          sinceSaid = 0;
          return;
        }
        if (Math.ceil(next.air) !== before && next.air <= 10) playSound('g-bm-tick', { gain: 0.6 });
      }
      if (sinceSaid >= (held && !held.over ? 1 : 2) && document.visibilityState !== 'hidden' && seaRef.current) {
        sinceSaid = 0;
        // With no dive going it still says so, so the boat knows it is waiting.
        say(runRef.current ?? { ...newDive(seaRef.current, 0), level: levelRef.current });
      }
    }, 250);
    return () => window.clearInterval(id);
    // Everything it reads is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hearing the other phone.
  useEffect(
    () =>
      onDuo('dive', raw => {
        const said = cleanDiveSaid(raw);
        if (!said) return;
        if (said.sign !== undefined) {
          addSign(them, said.sign);
          playSound('g-turn', { gain: 0.8 });
          haptic('tick');
        }
        if (said.air && divingRef.current) {
          const held = runRef.current;
          // No more often than it is allowed, whatever the other phone says.
          if (held && !held.over && Date.now() - lastGift.current > (AIR_GIFT_EVERY_S - 1.5) * 1000) {
            lastGift.current = Date.now();
            const next = airSent(held);
            setRun(next);
            say(next);
            playSound('g-dv-air');
            haptic('confirm');
          }
        }
        if (said.go !== undefined && said.go >= levelRef.current && diverOf(said.go) === me) {
          // The boat asks for the dive to start. It may be a level ahead of what is known here.
          const held = runRef.current;
          if (said.go !== levelRef.current) {
            levelRef.current = said.go;
            try {
              seaRef.current = diveOf(said.go);
            } catch {
              return;
            }
            divingRef.current = true;
            setLevel(said.go);
          } else if (held && !held.over && held.e > 0) return;
          beginRef.current();
        }
        if (said.run && diverOf(said.run.level) !== me) {
          const heard = said.run;
          heardAt.current = Date.now();
          const held = runRef.current;
          if (heard.level > levelRef.current) {
            // They have moved on with nothing going yet: the card of the dive just done stays up here until it is tapped.
            if (heard.e === 0 && held?.over) return;
            levelRef.current = heard.level;
            try {
              seaRef.current = diveOf(heard.level);
            } catch {
              return;
            }
            divingRef.current = false;
            setLevel(heard.level);
            setRun(heard.e > 0 ? heard : null);
            return;
          }
          if (heard.level < levelRef.current) return;
          if (heard.e === 0) {
            if (held && !held.over) setRun(null);
            return;
          }
          if (held && (heard.e < held.e || (heard.e === held.e && held.over && !heard.over))) return;
          const fresh = !held || held.e !== heard.e;
          if (fresh) {
            setTape([]);
            playSound('g-start');
          } else if (held) {
            if (heard.hits > held.hits) {
              playSound('g-dv-current');
              haptic('reject');
              shake('current');
            } else if (heard.got !== held.got) playSound('g-dv-chest');
            else if (heard.gifts > held.gifts) playSound('g-dv-air');
            else if (heard.pos !== held.pos) playSound('g-dv-swim', { gain: 0.5 });
          }
          if (heard.over && !(held && held.e === heard.e && held.over)) ending(heard.over, heard.level);
          setRun(heard);
        }
      }),
    // Whose phone this is does not change while the game is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // The air as the boat shows it: what it last heard, less the time since.
  const quiet = !diving && !!run && !run.over && Date.now() - heardAt.current > QUIET_MS;
  const air = !run ? (sea?.air ?? 0) : diving || run.over || quiet ? run.air : Math.max(0, run.air - (Date.now() - heardAt.current) / 1000);

  // --------------------------------------------------------------- swimming
  const go = (d: number) => {
    const held = runRef.current;
    const s = seaRef.current;
    if (!held || held.over || !s || !divingRef.current) return;
    getAudioContext();
    const result = stroke(held, s, d);
    const did: DiveDid = result.did;
    if (did === 'nothing') return;
    if (did === 'rock' || did === 'edge') {
      playSound('g-miss', { gain: 0.4 });
      if (did === 'rock') {
        // Bumped into: now it is known to be there.
        const rock = [-s.w, s.w, -1, 1][d] + held.pos;
        seen.current.add(rock);
        shake('rock');
      }
      return;
    }
    setRun(result.run);
    say(result.run);
    if (did === 'current' || did === 'out') {
      playSound('g-dv-current');
      haptic('reject');
      shake('current');
    } else if (did === 'chest') {
      playSound('g-dv-chest');
      haptic('confirm');
    } else playSound('g-dv-swim', { gain: 0.7 });
    if (result.run.over) {
      ending(result.run.over, result.run.level);
      // Said twice more: this is the word that must not be lost.
      window.setTimeout(() => runRef.current === result.run && say(result.run), 350);
      window.setTimeout(() => runRef.current === result.run && say(result.run), 1100);
    }
  };
  const goRef = useRef(go);
  goRef.current = go;
  const hold = useRef<number | null>(null);
  const release = () => {
    if (hold.current !== null) window.clearInterval(hold.current);
    hold.current = null;
  };
  useEffect(() => release, []);
  const press = (d: number) => {
    release();
    goRef.current(d);
    hold.current = window.setInterval(() => goRef.current(d), STEP_MS + 40);
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
  /** A tap on a square: one stroke toward it. */
  const toward = (cell: number) => {
    const held = runRef.current;
    const s = seaRef.current;
    if (!held || !s || cell === held.pos) return;
    const dx = (cell % s.w) - (held.pos % s.w);
    const dy = Math.floor(cell / s.w) - Math.floor(held.pos / s.w);
    go(Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 0 : 1) : dx < 0 ? 2 : 3);
  };

  const lastSign = useRef(0);
  const sign = (index: number) => {
    if (Date.now() - lastSign.current < 200) return;
    lastSign.current = Date.now();
    getAudioContext();
    sayDuo('dive', { g: index });
    addSign(me, index);
    playSound('g-pick', { gain: 0.7 });
    haptic('tick');
  };

  // The boat's air: sent down, then a wait before it can be sent again.
  const sentAirAt = useRef(0);
  const airWait = Math.max(0, AIR_GIFT_EVERY_S - (Date.now() - sentAirAt.current) / 1000);
  const sendAir = () => {
    if (airWait > 0 || !run || run.over) return;
    getAudioContext();
    sentAirAt.current = Date.now();
    sayDuo('dive', { air: 1 });
    playSound('g-dv-air', { gain: 0.8 });
    haptic('confirm');
    redraw(n => n + 1);
  };

  const start = () => {
    getAudioContext();
    if (diving) begin();
    else {
      sayDuo('dive', { go: level });
      setRun(null);
      sentAirAt.current = 0;
      playSound('g-pick');
      haptic('tick');
    }
  };
  const next = () => {
    getAudioContext();
    haptic('tick');
    setTape([]);
    setRun(null);
    setLevel(Math.max(level + 1, duoOf(mineRef.current, theirs).dive + 1));
  };

  const live = !!run && !run.over;
  const ready = canPlay && em.theirHere;
  const chestsUp = run && sea ? sea.chests.filter((_, i) => run.got & (1 << i)).length : 0;
  let status: string;
  if (!canPlay) status = tr("{name}'s Two needs the latest update to play this one", { name: partnerName });
  else if (!em.theirHere) status = tr('Waiting for {name} to open this game', { name: partnerName });
  else if (!run) status = diving ? tr('You dive. Start when you are both ready') : tr('You have the chart. Start when you are both ready');
  else if (quiet) status = tr('Waiting for {name}', { name: partnerName });
  else if (jolt === 'current') status = tr('A current! It took some air');
  else if (sea && allChests(sea, run.got)) status = diving ? tr('All the chests! Now back up to the anchor') : tr('All the chests! Guide {name} back to the anchor', { name: partnerName });
  else status = diving ? tr('Follow the arrows {name} signs', { name: partnerName }) : tr('Sign arrows to guide {name}. Keep clear of the currents', { name: partnerName });

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
      game="dive"
      sub={tr('Level {n}', { n: level })}
      me={me}
      partnerName={partnerName}
      em={em}
      emotes={emotes}
      myPart={diving ? tr('the diver') : tr('the boat')}
      theirPart={diving ? tr('the boat') : tr('the diver')}
      art={<DiveIcon />}
      onBack={onBack}
      over={
        run?.over === 1 ? (
          <DuoCard title={tr('All the treasure is up!')} line={<>🫧 {clock(run.air)}</>} tip={tr('Next time you swap: the other one dives.')} party>
            <button type="button" className="ch-go" onClick={next}>
              {tr('Next dive')}
            </button>
          </DuoCard>
        ) : run?.over === 2 ? (
          <DuoCard title={tr('Out of air')} tip={tr('Back to the boat. Take the short way round this time.')}>
            <button type="button" className="ch-go" onClick={start} disabled={!ready}>
              {tr('Try again')}
            </button>
          </DuoCard>
        ) : undefined
      }
    >
      <div className="dv-hud">
        <span className="dv-air" data-low={live && air <= 10 ? '' : undefined}>
          🫧 {clock(air)}
        </span>
        <span className="dv-chests">
          {sea?.chests.map((_, i) => (
            <b key={i} data-got={!!(run && run.got & (1 << i)) || undefined}>
              💰
            </b>
          ))}
        </span>
        {!diving && (
          <button type="button" className="dv-gift" onClick={sendAir} disabled={!live || airWait > 0}>
            {airWait > 0 && live ? tr('Air in {n}', { n: Math.ceil(airWait) }) : tr('Send air')}
          </button>
        )}
      </div>

      <div className="th-stage dv-stage">
        {sea ? (
          <DiveBoard sea={sea} view={diving ? 'diver' : 'boat'} diver={run?.pos ?? sea.start} who={diverOf(level)} got={run?.got ?? 0} seen={seen.current} jolt={jolt} onCell={diving && live ? toward : undefined} />
        ) : (
          <p className="ch-making">{tr('This level could not be made. Go back and try again.')}</p>
        )}
        {!live && !run?.over && sea && (
          <button type="button" className="ch-go ct-start" onClick={start} disabled={!ready}>
            {tr('Start')}
          </button>
        )}
      </div>

      <p className="ch-say th-say" data-warn={jolt === 'current' ? '' : undefined} aria-live="polite">
        {status}
        {live && chestsUp > 0 && sea && !allChests(sea, run!.got) ? ` (${chestsUp}/${sea.chests.length})` : ''}
      </p>

      <div className="bm-tape" aria-label={tr('Signs')}>
        {tape.length === 0 ? (
          <small>{tr('Your signs to each other show here')}</small>
        ) : (
          tape.map(t => (
            <span key={t.id} className="bm-taped" data-mine={t.who === me || undefined}>
              <span className="bm-word">{DIVE_SIGNS[t.sign]}</span>
            </span>
          ))
        )}
      </div>
      <div className="th-hands dv-hands">
        {diving && (
          <div className="th-pad" role="group" aria-label={tr('Swim')}>
            {arrow(0, <ArrowUp className="h-6 w-6" aria-hidden="true" />, tr('Up'), 'up')}
            {arrow(2, <ArrowLeft className="h-6 w-6" aria-hidden="true" />, tr('Left'), 'left')}
            {arrow(3, <ArrowRight className="h-6 w-6" aria-hidden="true" />, tr('Right'), 'right')}
            {arrow(1, <ArrowDown className="h-6 w-6" aria-hidden="true" />, tr('Down'), 'down')}
          </div>
        )}
        <div className="dv-signs" data-wide={!diving || undefined} role="group" aria-label={tr('Signs for {name}', { name: partnerName })}>
          {DIVE_SIGNS.map((emoji, i) => (
            <button key={emoji} type="button" className="th-sign-key" onClick={() => sign(i)}>
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </DuoShell>
  );
};
