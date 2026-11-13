import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getAudioContext } from '../core/audioAlerts';
import { duoOf, onDuo, sayDuo, withDuo } from '../core/duo';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { loadSounds, playSound } from '../core/sounds';
import {
  GUN_BACK_S,
  GUN_SHOTS,
  SHIP_AT,
  SPACE_SECONDS,
  SPACE_SHIELDS,
  cleanSpaceSaid,
  fired,
  flown,
  freshState,
  isGone,
  pilotOf,
  placeOf,
  reachesAt,
  shipAt,
  shipToWire,
  shotToWire,
  spaceHost,
  spaceOver,
  spaceToWire,
  thingsOf,
  type Fate,
  type SpaceState,
  type Thing
} from '../core/spaceCrew';
import type { Seat } from '../core/usTwo';
import type { DuoGameProps } from './BombSquad';
import { DuoCard, DuoShell } from './DuoShell';
import { useGameEmotes } from './Emotes';

const HOST_EVERY_MS = 140;
const SHIP_EVERY_MS = 90;
/** Nothing heard from the phone keeping the score for this long, the round is taken to have stopped. */
const LOST_MS = 3500;
/** How long a burst, and a shot's beam, stay drawn. */
const BURST_S = 0.4;
const BEAM_MS = 170;

const GLYPH: Record<Thing['kind'], string> = { rock: '☄️', big: '☄️', star: '⭐', kit: '🔧' };

/** The game's picture, for its card among the games and its how-to-play box. */
export const SpaceIcon: React.FC = () => (
  <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
    <rect x={1.5} y={1.5} width={57} height={57} rx={10} fill="#0b1026" stroke="#020617" strokeWidth={2.4} />
    {[
      [10, 12],
      [48, 9],
      [38, 24],
      [14, 34],
      [52, 38],
      [24, 8]
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={i % 2 ? 1 : 1.5} fill="#e2e8f0" />
    ))}
    <path d="M30,30 L30,42" stroke="#f472b6" strokeWidth={2.2} strokeLinecap="round" />
    <path d="M30,34 l-9,16 h18 Z" fill="#e2e8f0" stroke="#0f172a" strokeWidth={2} strokeLinejoin="round" transform="translate(0 -4)" />
    <circle cx={30} cy={41} r={3.2} fill="#38bdf8" stroke="#0f172a" strokeWidth={1.4} />
    <path d="M24,46 l-4,7 M36,46 l4,7" stroke="#f97316" strokeWidth={2.4} strokeLinecap="round" />
    <path d="M26,12 q8,-7 13,1 q6,6 -1,11 q-7,5 -12,-1 q-5,-6 0,-11 Z" fill="#78716c" stroke="#1c1917" strokeWidth={1.8} />
    <circle cx={30} cy={15} r={1.8} fill="#44403c" />
    <circle cx={35} cy={20} r={1.3} fill="#44403c" />
  </svg>
);

interface Beam {
  id: number;
  x: number;
  y: number;
  at: number;
}

interface Round {
  e: number;
  seed: number;
  /** Which round of the two of you: who flies follows from it. */
  n: number;
  things: Thing[];
  /** performance.now() at the round's start, as this phone reckons it. */
  t0: number;
  state: SpaceState;
  /** When, into the round, this phone learned what became of each thing. */
  fateAt: Map<number, number>;
  over: boolean;
}

/** One frame of a round, as it is drawn: kept apart so it can be drawn by itself (the tests do). */
export const SpaceField: React.FC<{
  things: Thing[];
  t: number;
  fates: ReadonlyMap<number, Fate>;
  fateAt: ReadonlyMap<number, number>;
  ship: number;
  beams: ReadonlyArray<Pick<Beam, 'id' | 'x' | 'y'>>;
  shake?: boolean;
}> = ({ things, t, fates, fateAt, ship, beams, shake }) => (
  <div className="sp-field" data-shake={shake || undefined}>
    <svg className="sp-beams" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {beams.map(beam => (
        <line key={beam.id} x1={ship * 100} y1={SHIP_AT * 100} x2={beam.x * 100} y2={beam.y * 100} className="sp-beam" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
    {things.map(thing => {
      if (t < thing.t) return null;
      const fate = fates.get(thing.id);
      if (isGone(fate)) {
        const when = fateAt.get(thing.id) ?? t;
        if (t - when > BURST_S) return null;
        const at = placeOf(thing, Math.min(when, reachesAt(thing)));
        return (
          <span key={thing.id} className="sp-burst" data-fate={fate} style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}>
            {fate === 3 ? '✨' : '💥'}
          </span>
        );
      }
      const at = placeOf(thing, t);
      if (at.y > 1.08) return null;
      return (
        <span key={thing.id} className="sp-thing" data-kind={thing.kind} data-cracked={fate === 4 || undefined} style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}>
          {GLYPH[thing.kind]}
        </span>
      );
    })}
    <span className="sp-ship" style={{ left: `${ship * 100}%`, top: `${SHIP_AT * 100}%` }}>
      <i aria-hidden="true">🚀</i>
    </span>
  </div>
);

/**
 * Space Crew (core/spaceCrew): one of you flies the ship, the other is on
 * its guns, and you swap every round.
 */
export const SpaceCrew: React.FC<DuoGameProps> = ({ mine, theirs, me, partnerName, canPlay, emotes = true, onHalf, onBack }) => {
  const tr = useT();
  const em = useGameEmotes('space');
  const host = spaceHost(me);
  const best = duoOf(mine, theirs).space;

  useEffect(() => loadSounds(['g-sp-shot', 'g-sp-boom', 'g-sp-crack', 'g-sp-hit', 'g-sp-star', 'g-sp-kit', 'g-start', 'g-win', 'g-lose', 'g-pick', 'g-miss']), []);

  const round = useRef<Round | null>(null);
  /** The round of the two of you that comes next: who flies in it. */
  const nextRound = useRef(1);
  /** Where the ship is: this phone's finger when it flies, else what it has heard. */
  const ship = useRef(0.5);
  const shipShown = useRef(0.5);
  const heardAt = useRef(0);
  /** Shots waiting for the phone keeping the score to take them. */
  const pending = useRef<Array<[number, number]>>([]);
  const beams = useRef<Beam[]>([]);
  const beamId = useRef(0);
  /** The shots this phone knows of, to tell the other: a count, and where. */
  const shotLog = useRef<Array<[number, number, number]>>([]);
  const shotCount = useRef(0);
  const seenShot = useRef(0);
  /** The gun: how many shots are ready, and when the next comes back. */
  const gun = useRef({ ready: GUN_SHOTS, backAt: 0 });
  const [, redraw] = useState(0);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState<{ score: number; best: boolean; shields: number } | null>(null);

  const onHalfRef = useRef(onHalf);
  onHalfRef.current = onHalf;
  const mineRef = useRef(mine);
  mineRef.current = mine;
  const bestRef = useRef(best);
  bestRef.current = best;

  const flying = (r: Round | null) => pilotOf(r ? r.n : nextRound.current) === me;

  const finish = (r: Round) => {
    if (r.over) return;
    r.over = true;
    nextRound.current = r.n + 1;
    const score = r.state.score;
    const top = score.score > bestRef.current && score.score > 0;
    setResult({ score: score.score, best: top, shields: score.shields });
    playSound(score.shields > 0 ? 'g-win' : 'g-lose');
    haptic('confirm');
    if (score.score > 0) {
      const next = withDuo(mineRef.current, 'space', score.score, Date.now());
      if (next !== mineRef.current) onHalfRef.current(next);
    }
  };

  /** What became of a thing, as each phone learns of it: the sound and the feel of it. */
  const feel = (r: Round, id: number, fate: Fate, t: number) => {
    const thing = r.things.find(one => one.id === id);
    if (!thing) return;
    if (fate !== 4) r.fateAt.set(id, t);
    if (fate === 4) playSound('g-sp-crack', { gain: 0.8 });
    else if (fate === 1) playSound('g-sp-boom', { gain: thing.kind === 'star' || thing.kind === 'kit' ? 0.5 : 0.9, rate: thing.kind === 'big' ? 0.8 : 1 });
    else if (fate === 2) {
      playSound('g-sp-hit');
      haptic('reject');
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
    } else {
      playSound(thing.kind === 'kit' ? 'g-sp-kit' : 'g-sp-star');
      haptic('tick');
    }
  };

  const addBeam = (x: number, y: number) => {
    beams.current = [...beams.current.slice(-5), { id: ++beamId.current, x, y, at: performance.now() }];
  };

  const sayHost = (r: Round, t: number, events: Array<[number, Fate]>) =>
    sayDuo(
      'space',
      spaceToWire({ e: r.e, seed: r.seed, round: r.n, t, score: r.state.score.score, shields: r.state.score.shields, done: r.state.score.done, ship: ship.current, events, shots: shotLog.current, end: r.over })
    );

  /** The phone that keeps the score starts a round. */
  const begin = () => {
    if (!host) return;
    getAudioContext();
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const r: Round = { e: Math.floor(Date.now() / 1000) % 10_000_000, seed, n: nextRound.current, things: thingsOf(seed), t0: performance.now(), state: freshState(), fateAt: new Map(), over: false };
    round.current = r;
    pending.current = [];
    shotLog.current = [];
    gun.current = { ready: GUN_SHOTS, backAt: 0 };
    setResult(null);
    sayHost(r, 0, []);
    playSound('g-start');
    haptic('confirm');
  };
  const beginRef = useRef(begin);
  beginRef.current = begin;

  // Every frame: the phone keeping the score says what was hit; both draw.
  useEffect(() => {
    let frame = 0;
    let lastSaid = 0;
    let lastShip = 0;
    let recent: Array<[number, Fate]> = [];
    let drawn = '';
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      shipShown.current += (ship.current - shipShown.current) * 0.4;
      // The gun comes back a shot at a time.
      const g = gun.current;
      if (g.ready < GUN_SHOTS && now >= g.backAt) {
        g.ready += 1;
        g.backAt = now + GUN_BACK_S * 1000;
      }
      beams.current = beams.current.filter(beam => now - beam.at < BEAM_MS);
      const r = round.current;
      if (r && !r.over) {
        const t = (now - r.t0) / 1000;
        if (host) {
          const events: Array<[number, Fate]> = [];
          for (const [x, y] of pending.current.splice(0)) {
            const hit = fired(r.state, r.things, t, x, y);
            if (hit) events.push(hit);
          }
          events.push(...flown(r.state, r.things, t, ship.current));
          for (const [id, fate] of events) feel(r, id, fate, t);
          if (events.length) recent = [...recent, ...events].slice(-10);
          const over = spaceOver(r.state.score, r.things, t);
          if (over) finish(r);
          if (over || events.length || now - lastSaid > HOST_EVERY_MS) {
            lastSaid = now;
            sayHost(r, t, recent);
            if (over) {
              // Said twice more: this is the word that must not be lost.
              window.setTimeout(() => round.current === r && sayHost(r, t, recent), 300);
              window.setTimeout(() => round.current === r && sayHost(r, t, recent), 1000);
              recent = [];
            }
          }
        } else {
          if (flying(r) && now - lastShip > SHIP_EVERY_MS) {
            lastShip = now;
            sayDuo('space', shipToWire(r.e, ship.current));
          }
          if (Date.now() - heardAt.current > LOST_MS) round.current = null;
        }
      }
      // With no round going there is only something new to draw when the ship has moved.
      const live = !!round.current && !round.current.over;
      const sig = `${live}:${shipShown.current.toFixed(3)}:${beams.current.length}:${gun.current.ready}`;
      if (live || sig !== drawn) {
        drawn = sig;
        redraw(n => (n + 1) % 1_000_000);
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // Everything it reads is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hearing the other phone.
  useEffect(
    () =>
      onDuo('space', raw => {
        const said = cleanSpaceSaid(raw);
        if (!said) return;
        const r = round.current;
        if (said.go && host && (!r || r.over)) beginRef.current();
        if (host && r && !r.over) {
          if (said.ship && said.ship.e === r.e && !flying(r)) ship.current = said.ship.x;
          if (said.shot && said.shot.e === r.e && flying(r)) {
            pending.current.push([said.shot.x, said.shot.y]);
            shotLog.current = [...shotLog.current.slice(-3), [++shotCount.current, said.shot.x, said.shot.y]];
            addBeam(said.shot.x, said.shot.y);
            playSound('g-sp-shot', { gain: 0.5 });
          }
        }
        if (said.host && !host) {
          const h = said.host;
          heardAt.current = Date.now();
          let mine = round.current;
          if (!mine || mine.e !== h.e) {
            if (h.end) return;
            mine = { e: h.e, seed: h.seed, n: h.round, things: thingsOf(h.seed), t0: performance.now() - h.t * 1000, state: freshState(), fateAt: new Map(), over: false };
            round.current = mine;
            gun.current = { ready: GUN_SHOTS, backAt: 0 };
            seenShot.current = 0;
            setResult(null);
            playSound('g-start');
          }
          if (mine.over) return;
          // The clock follows theirs: gently, unless it is far out.
          const want = performance.now() - h.t * 1000;
          mine.t0 = Math.abs(want - mine.t0) > 400 ? want : mine.t0 + (want - mine.t0) * 0.15;
          mine.state.score = { ...mine.state.score, score: h.score, shields: h.shields, done: h.done };
          if (!flying(mine)) ship.current = h.ship;
          const t = (performance.now() - mine.t0) / 1000;
          for (const [id, fate] of h.events) {
            if (mine.state.fates.get(id) === fate) continue;
            mine.state.fates.set(id, fate);
            feel(mine, id, fate, t);
          }
          // Their shots, when this phone is the one flying.
          for (const [n, x, y] of h.shots) {
            if (n <= seenShot.current) continue;
            seenShot.current = n;
            if (flying(mine)) {
              addBeam(x, y);
              playSound('g-sp-shot', { gain: 0.5 });
            }
          }
          if (h.end) finish(mine);
        }
      }),
    // Whose phone this is does not change while the game is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // A finger on the field: it flies the ship, or it fires at that spot.
  const field = useRef<HTMLDivElement | null>(null);
  const spot = (e: React.PointerEvent) => {
    const box = field.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
  };
  const down = (e: React.PointerEvent) => {
    const at = spot(e);
    const r = round.current;
    if (!at) return;
    if (flying(r)) {
      ship.current = shipAt(at.x);
      return;
    }
    if (!r || r.over) return;
    getAudioContext();
    const g = gun.current;
    if (g.ready <= 0) {
      playSound('g-miss', { gain: 0.3, rate: 1.5 });
      return;
    }
    if (g.ready === GUN_SHOTS) g.backAt = performance.now() + GUN_BACK_S * 1000;
    g.ready -= 1;
    const x = Math.min(1, Math.max(0, at.x));
    const y = Math.min(SHIP_AT - 0.02, Math.max(0, at.y));
    addBeam(x, y);
    playSound('g-sp-shot');
    haptic('tick');
    if (host) {
      pending.current.push([x, y]);
      shotLog.current = [...shotLog.current.slice(-3), [++shotCount.current, x, y]];
    } else sayDuo('space', shotToWire(r.e, x, y));
  };
  const move = (e: React.PointerEvent) => {
    if (!flying(round.current)) return;
    const at = spot(e);
    if (at) ship.current = shipAt(at.x);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || !flying(round.current)) return;
      e.preventDefault();
      ship.current = shipAt(ship.current + (e.key === 'ArrowLeft' ? -0.06 : 0.06));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
    // `flying` reads only refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    getAudioContext();
    if (host) begin();
    else {
      sayDuo('space', { go: 1 });
      setResult(null);
      playSound('g-pick');
      haptic('tick');
    }
  };

  const r = round.current;
  const playing = !!r && !r.over;
  const t = r ? Math.min(SPACE_SECONDS, (performance.now() - r.t0) / 1000) : 0;
  const score = r?.state.score ?? null;
  const pilot = flying(r);
  const ready = canPlay && em.theirHere;
  const none = useMemo(() => new Map<number, never>(), []);

  let status: string;
  if (!canPlay) status = tr("{name}'s Two needs the latest update to play this one", { name: partnerName });
  else if (!em.theirHere) status = tr('Waiting for {name} to open this game', { name: partnerName });
  else if (pilot) status = playing ? tr('Dodge the rocks. Fly under the stars and the kits') : tr('You fly this round. Slide your finger to steer');
  else status = playing ? tr('Tap a rock to shoot it. Leave the stars for {name}', { name: partnerName }) : tr('You are on the guns this round. Tap a rock to shoot it');

  return (
    <DuoShell
      game="space"
      sub={best > 0 ? tr('Best {n}', { n: best }) : undefined}
      me={me}
      partnerName={partnerName}
      em={em}
      emotes={emotes}
      myPart={pilot ? tr('the pilot') : tr('the guns')}
      theirPart={pilot ? tr('the guns') : tr('the pilot')}
      art={<SpaceIcon />}
      onBack={onBack}
      over={
        result && !playing ? (
          <DuoCard
            title={result.best ? tr('A new best!') : result.shields > 0 ? tr('You made it through!') : tr('The ship is down')}
            line={<>⭐ {result.score}</>}
            tip={tr('Next round you swap seats.')}
            party={result.best}
          >
            <button type="button" className="ch-go" onClick={start} disabled={!ready}>
              {tr('Play again')}
            </button>
          </DuoCard>
        ) : undefined
      }
    >
      <div className="ct-hud">
        <span className="ct-score">⭐ {score?.score ?? 0}</span>
        <span className="ct-time">
          <i style={{ transform: `scaleX(${playing ? Math.max(0, 1 - t / SPACE_SECONDS) : 1})` }} />
        </span>
        <span className="ct-lives" aria-label={tr('{n} shields', { n: score?.shields ?? SPACE_SHIELDS })}>
          {Array.from({ length: SPACE_SHIELDS }, (_, i) => (
            <b key={i} data-on={i < (score?.shields ?? SPACE_SHIELDS) || undefined}>
              🛡️
            </b>
          ))}
        </span>
      </div>
      <div className="ct-stage sp-stage" ref={field} data-aim={!pilot || undefined} onPointerDown={down} onPointerMove={move}>
        <SpaceField
          things={playing && r ? r.things : []}
          t={t}
          fates={r?.state.fates ?? none}
          fateAt={r?.fateAt ?? none}
          ship={pilot ? ship.current : shipShown.current}
          beams={beams.current}
          shake={shake}
        />
        {!pilot && (
          <span className="sp-gun" aria-label={tr('{n} shots ready', { n: gun.current.ready })}>
            {Array.from({ length: GUN_SHOTS }, (_, i) => (
              <i key={i} data-on={i < gun.current.ready || undefined} />
            ))}
          </span>
        )}
        {!playing && !result && (
          <button type="button" className="ch-go ct-start" onClick={start} disabled={!ready}>
            {tr('Start')}
          </button>
        )}
      </div>
      <p className="ch-say" aria-live="polite">
        {status}
      </p>
    </DuoShell>
  );
};
