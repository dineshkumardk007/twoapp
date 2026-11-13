import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getAudioContext } from '../core/audioAlerts';
import {
  CATCH_LIVES,
  CATCH_SECONDS,
  NET_AT,
  advance,
  catchHost,
  cleanCatchSaid,
  dropsOf,
  freshScore,
  handAt,
  handToWire,
  hostToWire,
  inNet,
  landsAt,
  roundOver,
  type CatchScore,
  type Drop,
  type Outcome
} from '../core/catchTogether';
import { duoOf, onDuo, sayDuo, withDuo } from '../core/duo';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { loadSounds, playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import type { DuoGameProps } from './BombSquad';
import { DuoCard, DuoFace, DuoShell } from './DuoShell';
import { useGameEmotes } from './Emotes';

/** How often the phone keeping the score says how things stand, and the other says where its hand is. */
const HOST_EVERY_MS = 140;
const HAND_EVERY_MS = 90;
/** Nothing heard from the phone keeping the score for this long, the round is taken to have stopped. */
const LOST_MS = 3500;
/** How long something stays drawn after it has landed: caught, a little burst; let go, it falls on out. */
const AFTER_S = 0.45;

const GLYPH: Record<Drop['kind'], string> = { star: '⭐', heart: '💖', bomb: '💣' };

/** The game's picture, for its card among the games and its how-to-play box. */
export const CatchIcon: React.FC = () => (
  <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
    <rect x={1.5} y={1.5} width={57} height={57} rx={10} fill="#1e1b4b" stroke="#0f0d2e" strokeWidth={2.4} />
    <path d="M10,40 Q30,56 50,40" fill="none" stroke="#fde68a" strokeWidth={3} strokeLinecap="round" />
    <path d="M16,43 L18,49 M24,46.5 L25,52 M36,46.5 L35,52 M44,43 L42,49" stroke="#fde68a" strokeWidth={1.6} strokeLinecap="round" />
    <circle cx={10} cy={39} r={5} fill="#c98a55" stroke="#3b2723" strokeWidth={1.6} />
    <circle cx={50} cy={39} r={5} fill="#f9a8c0" stroke="#3b2723" strokeWidth={1.6} />
    <path d="M30,8 l3,7 7.5,0.8 -5.6,5 1.7,7.4 -6.6,-3.9 -6.6,3.9 1.7,-7.4 -5.6,-5 7.5,-0.8 Z" fill="#fbbf24" stroke="#b45309" strokeWidth={1.4} strokeLinejoin="round" />
    <path d="M47,10 l1.6,3.6 3.9,0.4 -2.9,2.6 0.9,3.8 -3.5,-2 -3.5,2 0.9,-3.8 -2.9,-2.6 3.9,-0.4 Z" fill="#fde68a" />
    <circle cx={13} cy={15} r={4.5} fill="#374151" stroke="#0b1220" strokeWidth={1.4} />
    <path d="M15.5,11 l2.5,-3" stroke="#f97316" strokeWidth={1.8} strokeLinecap="round" />
  </svg>
);

interface Round {
  e: number;
  seed: number;
  drops: Drop[];
  /** performance.now() at the round's start, as this phone reckons it. */
  t0: number;
  score: CatchScore;
  /** What became of each drop, by its id. */
  outcomes: Map<number, Outcome>;
  over: boolean;
}

/** One frame of a round, as it is drawn: kept apart so it can be drawn by itself (the tests do). */
export const CatchField: React.FC<{
  drops: Drop[];
  t: number;
  outcomes: ReadonlyMap<number, Outcome>;
  /** Where each hand is: the first seat's, then the other's. */
  hands: [number, number];
  shake?: boolean;
}> = ({ drops, t, outcomes, hands, shake }) => {
  const left = Math.min(hands[0], hands[1]);
  const right = Math.max(hands[0], hands[1]);
  const sag = 4 + (right - left) * 9;
  return (
    <div className="ct-field" data-shake={shake || undefined}>
      <svg className="ct-net" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={`M${left * 100},${NET_AT * 100} Q${((left + right) / 2) * 100},${NET_AT * 100 + sag} ${right * 100},${NET_AT * 100}`} className="ct-net-rope" vectorEffect="non-scaling-stroke" />
        <path d={`M${left * 100},${NET_AT * 100} Q${((left + right) / 2) * 100},${NET_AT * 100 + sag * 1.9} ${right * 100},${NET_AT * 100}`} className="ct-net-mesh" vectorEffect="non-scaling-stroke" />
      </svg>
      {drops.map(drop => {
        if (t < drop.t) return null;
        const lands = landsAt(drop);
        const after = t - lands;
        if (after > AFTER_S) return null;
        const outcome = outcomes.get(drop.id);
        const caught = after >= 0 && outcome === 1;
        const y = caught ? NET_AT : ((t - drop.t) / drop.fall) * NET_AT;
        return (
          <span
            key={drop.id}
            className="ct-drop"
            data-kind={drop.kind}
            data-caught={caught || undefined}
            data-gone={(after >= 0 && !caught) || undefined}
            style={{ left: `${drop.x * 100}%`, top: `${y * 100}%` }}
          >
            {GLYPH[drop.kind]}
          </span>
        );
      })}
      {([0, 1] as const).map(who => (
        <span key={who} className="ct-hand" data-who={who} style={{ left: `${hands[who] * 100}%`, top: `${NET_AT * 100}%` }}>
          <DuoFace seat={who === 0 ? 'user' : 'partner'} />
        </span>
      ))}
    </div>
  );
};

/**
 * Catch Together (core/catchTogether): a net between your two hands, stars
 * and hearts to catch in it, and bombs to keep out of it.
 */
export const CatchTogether: React.FC<DuoGameProps> = ({ mine, theirs, me, partnerName, canPlay, emotes = true, onHalf, onBack }) => {
  const tr = useT();
  const em = useGameEmotes('catch');
  const host = catchHost(me);
  const meIs = me === 'user' ? 0 : 1;
  const best = duoOf(mine, theirs).catch;

  useEffect(() => loadSounds(['g-ct-star', 'g-ct-heart', 'g-ct-bomb', 'g-start', 'g-win', 'g-lose', 'g-pick']), []);

  const round = useRef<Round | null>(null);
  const myX = useRef(meIs === 0 ? 0.3 : 0.7);
  /** Their hand: where it was last said to be, and where it is drawn, which follows that. */
  const theirX = useRef(meIs === 0 ? 0.7 : 0.3);
  const theirShown = useRef(theirX.current);
  const heardAt = useRef(0);
  const [, redraw] = useState(0);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState<{ score: number; best: boolean; lives: number } | null>(null);

  const onHalfRef = useRef(onHalf);
  onHalfRef.current = onHalf;
  const mineRef = useRef(mine);
  mineRef.current = mine;
  const bestRef = useRef(best);
  bestRef.current = best;

  const finish = (r: Round) => {
    if (r.over) return;
    r.over = true;
    const top = r.score.score > bestRef.current;
    setResult({ score: r.score.score, best: top && r.score.score > 0, lives: r.score.lives });
    playSound(r.score.lives > 0 ? 'g-win' : 'g-lose');
    haptic('confirm');
    if (r.score.score > 0) {
      const next = withDuo(mineRef.current, 'catch', r.score.score, Date.now());
      if (next !== mineRef.current) onHalfRef.current(next);
    }
  };

  /** What a drop landing sounds and feels like, as each phone learns of it. */
  const feel = (r: Round, id: number, outcome: Outcome) => {
    if (r.outcomes.has(id)) return;
    r.outcomes.set(id, outcome);
    if (!outcome) return;
    const drop = r.drops.find(d => d.id === id);
    if (!drop) return;
    if (drop.kind === 'bomb') {
      playSound('g-ct-bomb');
      haptic('reject');
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
    } else {
      playSound(drop.kind === 'heart' ? 'g-ct-heart' : 'g-ct-star', { rate: 1 + Math.min(10, r.score.streak) * 0.03 });
      haptic('tick');
    }
  };

  const sayHost = (r: Round, t: number, events: Array<[number, Outcome]>) =>
    sayDuo('catch', hostToWire({ e: r.e, seed: r.seed, t, score: r.score.score, lives: r.score.lives, streak: r.score.streak, done: r.score.done, x: myX.current, events, end: r.over }));

  /** The phone that keeps the score starts a round. */
  const begin = () => {
    if (!host) return;
    getAudioContext();
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const r: Round = { e: Math.floor(Date.now() / 1000) % 10_000_000, seed, drops: dropsOf(seed), t0: performance.now(), score: freshScore(), outcomes: new Map(), over: false };
    round.current = r;
    setResult(null);
    sayHost(r, 0, []);
    playSound('g-start');
    haptic('confirm');
  };
  const beginRef = useRef(begin);
  beginRef.current = begin;

  // Every frame: the phone keeping the score says what has landed; both draw.
  useEffect(() => {
    let frame = 0;
    let lastSaid = 0;
    let lastHand = 0;
    let recent: Array<[number, Outcome]> = [];
    let drawn = '';
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      theirShown.current += (theirX.current - theirShown.current) * 0.35;
      const r = round.current;
      if (r && !r.over) {
        const t = (now - r.t0) / 1000;
        if (host) {
          const stepped = advance(r.score, r.drops, t, myX.current, theirX.current);
          r.score = stepped.score;
          for (const [id, outcome] of stepped.events) feel(r, id, outcome);
          if (stepped.events.length) recent = [...recent, ...stepped.events].slice(-8);
          const over = roundOver(r.score, r.drops, t);
          if (over) finish(r);
          if (over || stepped.events.length || now - lastSaid > HOST_EVERY_MS) {
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
          // Until the word comes, what this phone can see for itself stands in for it.
          for (const drop of r.drops) {
            if (landsAt(drop) > t) break;
            if (!r.outcomes.has(drop.id) && t - landsAt(drop) > 0.4) r.outcomes.set(drop.id, inNet(drop.x, myX.current, theirShown.current) ? 1 : 0);
          }
          if (now - lastHand > HAND_EVERY_MS) {
            lastHand = now;
            sayDuo('catch', handToWire(r.e, myX.current));
          }
          if (Date.now() - heardAt.current > LOST_MS) round.current = null;
        }
      }
      // With no round going there is only something new to draw when a hand has moved.
      const live = !!round.current && !round.current.over;
      const now2 = `${live}:${myX.current.toFixed(3)}:${theirShown.current.toFixed(3)}`;
      if (live || now2 !== drawn) {
        drawn = now2;
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
      onDuo('catch', raw => {
        const said = cleanCatchSaid(raw);
        if (!said) return;
        if (said.go && host) {
          const r = round.current;
          if (!r || r.over) beginRef.current();
        }
        if (said.hand && host) theirX.current = said.hand.x;
        if (said.host && !host) {
          const h = said.host;
          heardAt.current = Date.now();
          theirX.current = h.x;
          let r = round.current;
          if (!r || r.e !== h.e) {
            if (h.end) return;
            r = { e: h.e, seed: h.seed, drops: dropsOf(h.seed), t0: performance.now() - h.t * 1000, score: freshScore(), outcomes: new Map(), over: false };
            round.current = r;
            setResult(null);
            playSound('g-start');
          }
          if (r.over) return;
          // The clock follows theirs: gently, unless it is far out.
          const want = performance.now() - h.t * 1000;
          r.t0 = Math.abs(want - r.t0) > 400 ? want : r.t0 + (want - r.t0) * 0.15;
          r.score = { ...r.score, score: h.score, lives: h.lives, streak: h.streak, done: h.done };
          for (const [id, outcome] of h.events) {
            // What this phone guessed is put right by what really happened.
            if (r.outcomes.get(id) !== outcome) r.outcomes.delete(id);
            feel(r, id, outcome);
          }
          if (h.end) finish(r);
        }
      }),
    // Whose phone this is does not change while the game is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // A finger anywhere on the field moves this phone's hand.
  const field = useRef<HTMLDivElement | null>(null);
  const move = (e: React.PointerEvent) => {
    const box = field.current?.getBoundingClientRect();
    if (!box || !box.width) return;
    myX.current = handAt((e.clientX - box.left) / box.width);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      myX.current = handAt(myX.current + (e.key === 'ArrowLeft' ? -0.06 : 0.06));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const start = () => {
    getAudioContext();
    if (host) begin();
    else {
      sayDuo('catch', { go: 1 });
      setResult(null);
      playSound('g-pick');
      haptic('tick');
    }
  };

  const r = round.current;
  const playing = !!r && !r.over;
  const t = r ? Math.min(CATCH_SECONDS, (performance.now() - r.t0) / 1000) : 0;
  const hands: [number, number] = meIs === 0 ? [myX.current, theirShown.current] : [theirShown.current, myX.current];
  const score = r?.score ?? null;
  const ready = canPlay && em.theirHere;
  const none = useMemo(() => new Map<number, Outcome>(), []);

  let status: string;
  if (!canPlay) status = tr("{name}'s Two needs the latest update to play this one", { name: partnerName });
  else if (!em.theirHere) status = tr('Waiting for {name} to open this game', { name: partnerName });
  else if (!playing) status = tr('Slide your finger to move your end of the net');
  else if (score && score.streak >= 3) status = tr('{n} in a row!', { n: score.streak });
  else status = tr('Stars and hearts in the net. Bombs out of it');

  return (
    <DuoShell
      game="catch"
      sub={best > 0 ? tr('Best {n}', { n: best }) : undefined}
      me={me}
      partnerName={partnerName}
      em={em}
      emotes={emotes}
      art={<CatchIcon />}
      onBack={onBack}
      over={
        result && !playing ? (
          <DuoCard
            title={result.best ? tr('A new best!') : result.lives > 0 ? tr('Time is up!') : tr('Out of lives')}
            line={<>⭐ {result.score}</>}
            tip={result.best ? undefined : tr('Your best together is {n}', { n: Math.max(best, result.score) })}
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
          <i style={{ transform: `scaleX(${playing ? Math.max(0, 1 - t / CATCH_SECONDS) : 1})` }} />
        </span>
        <span className="ct-lives" aria-label={tr('{n} lives', { n: score?.lives ?? CATCH_LIVES })}>
          {Array.from({ length: CATCH_LIVES }, (_, i) => (
            <b key={i} data-on={i < (score?.lives ?? CATCH_LIVES) || undefined}>
              ❤️
            </b>
          ))}
        </span>
      </div>
      <div className="ct-stage" ref={field} onPointerDown={move} onPointerMove={move}>
        <CatchField drops={playing && r ? r.drops : []} t={t} outcomes={r?.outcomes ?? none} hands={hands} shake={shake} />
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
