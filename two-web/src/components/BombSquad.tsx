import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getAudioContext } from '../core/audioAlerts';
import {
  BOMB_COLOURS,
  BOMB_MARKS,
  BOMB_MARK_NAMES,
  BOMB_SIGN_COUNT,
  BOMB_STRIKES,
  BOMB_WORDS,
  bombOf,
  bombSign,
  cleanBombSaid,
  cutWire,
  defuserOf,
  laterRun,
  newRun,
  pressKey,
  runToWire,
  ticked,
  type BombLevel,
  type BombPage,
  type BombRun,
  type BombTouch,
  type BombWire
} from '../core/bombSquad';
import { duoOf, onDuo, sayDuo, withDuo, type DuoHalf } from '../core/duo';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { loadSounds, playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import { DuoCard, DuoShell } from './DuoShell';
import { useGameEmotes } from './Emotes';

export interface DuoGameProps {
  /** How far each phone has seen the two of you get (core/duo). */
  mine?: DuoHalf;
  theirs?: DuoHalf;
  me: Seat;
  partnerName: string;
  /** Their Two has this game too. */
  canPlay: boolean;
  /** Their phone has emotes. */
  emotes?: boolean;
  /** This phone has seen the two of you get further: to keep, and to send. */
  onHalf: (half: DuoHalf) => void;
  onBack: () => void;
}

/** How many signs stay on the tape. */
const TAPE = 7;
/** Not heard from the phone with the bomb for this long, its clock is taken to have stopped. */
const QUIET_MS = 6000;

/** The game's picture, for its card among the games and its how-to-play box. */
export const BombIcon: React.FC = () => (
  <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
    <rect x={1.5} y={1.5} width={57} height={57} rx={10} fill="#1f2937" stroke="#0b1220" strokeWidth={2.4} />
    <circle cx={27} cy={35} r={15} fill="#374151" stroke="#0b1220" strokeWidth={2.4} />
    <path d="M36,23 l6,-7" stroke="#9ca3af" strokeWidth={4} strokeLinecap="round" />
    <path d="M42,16 q4,-6 9,-3" stroke="#fbbf24" strokeWidth={2.4} fill="none" strokeLinecap="round" />
    <path d="M51,9 l1.5,3.5 3.5,1.5 -3.5,1.5 -1.5,3.5 -1.5,-3.5 -3.5,-1.5 3.5,-1.5 Z" fill="#f97316" />
    <rect x={16} y={29} width={22} height={11} rx={3} fill="#0b1220" />
    <text x={27} y={38} textAnchor="middle" fontSize={9} fontWeight={800} fill="#f87171" fontFamily="ui-monospace, monospace">
      0:59
    </text>
    <circle cx={21} cy={24} r={2.2} fill="#f8fafc" fillOpacity={0.35} />
  </svg>
);

const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** A wire as the book and the bomb both show it: its colour, and the shape tied to it if it has one. */
const WireChip: React.FC<{ wire: BombWire; n?: number }> = ({ wire, n }) => (
  <span className="bm-chip">
    {n !== undefined && <small>{n}</small>}
    <i style={{ background: BOMB_COLOURS[wire.colour]?.ink ?? '#888' }} />
    {wire.mark >= 0 && <b>{BOMB_MARKS[wire.mark]}</b>}
  </span>
);

/** One sign, as it is drawn on a key and on the tape. */
export const BombSignFace: React.FC<{ index: number }> = ({ index }) => {
  const sign = bombSign(index);
  if (!sign) return null;
  if (sign.kind === 'colour') return <i className="bm-dot" style={{ background: BOMB_COLOURS[sign.i].ink }} />;
  return <span className={sign.kind === 'mark' ? 'bm-mark' : 'bm-word'}>{sign.kind === 'mark' ? BOMB_MARKS[sign.i] : BOMB_WORDS[sign.i]}</span>;
};

/** The bomb, as the one who has it sees it: its label, its clock, its wires and its buttons. */
export const BombBody: React.FC<{
  bomb: BombLevel;
  run: BombRun | null;
  left: number;
  /** The wire or button just got wrong, to shake it. */
  wrong: string | null;
  onCut?: (wire: number) => void;
  onPress?: (key: number) => void;
}> = ({ bomb, run, left, wrong, onCut, onPress }) => {
  const tr = useT();
  const cut = run?.cut ?? [];
  const wiresDone = cut.length >= bomb.cuts.length;
  const pressedKeys = bomb.press.slice(0, run?.pressed ?? 0);
  return (
    <div className="bm-bomb" data-live={run && !run.over ? '' : undefined} data-over={run?.over || undefined}>
      <div className="bm-head">
        <span className="bm-label" aria-label={tr('The label: {marks}', { marks: bomb.tag.map(m => tr(BOMB_MARK_NAMES[m])).join(', ') })}>
          {bomb.tag.map((mark, i) => (
            <b key={i}>{BOMB_MARKS[mark]}</b>
          ))}
        </span>
        <span className="bm-clock" data-low={run && !run.over && left <= 15 ? '' : undefined}>
          {clock(run ? left : bomb.seconds)}
        </span>
        <span className="bm-strikes" aria-label={tr('{n} of {max} mistakes', { n: run?.strikes ?? 0, max: BOMB_STRIKES })}>
          {Array.from({ length: BOMB_STRIKES }, (_, i) => (
            <i key={i} data-on={i < (run?.strikes ?? 0) || undefined} />
          ))}
        </span>
      </div>
      <div className="bm-wires">
        {bomb.wires.map((wire, i) => {
          const isCut = cut.includes(i);
          return (
            <button
              key={i}
              type="button"
              className="bm-wire"
              data-cut={isCut || undefined}
              data-wrong={wrong === `w${i}` || undefined}
              disabled={!onCut || isCut || wiresDone}
              onClick={() => onCut?.(i)}
              aria-label={`${tr(BOMB_COLOURS[wire.colour].name)}${wire.mark >= 0 ? `, ${tr(BOMB_MARK_NAMES[wire.mark])}` : ''}${isCut ? `, ${tr('cut')}` : ''}`}
              style={{ color: BOMB_COLOURS[wire.colour].ink }}
            >
              <span className="bm-wire-end" />
              <span className="bm-wire-line">
                <span />
                <span />
              </span>
              {wire.mark >= 0 && <span className="bm-wire-tag">{BOMB_MARKS[wire.mark]}</span>}
              <span className="bm-wire-end" />
            </button>
          );
        })}
      </div>
      {bomb.pad.length > 0 && (
        <div className="bm-pad" data-ready={wiresDone || undefined}>
          {bomb.pad.map((mark, i) => (
            <button
              key={i}
              type="button"
              className="bm-key"
              data-down={pressedKeys.includes(i) || undefined}
              data-wrong={wrong === `k${i}` || undefined}
              disabled={!onPress || !wiresDone || pressedKeys.includes(i)}
              onClick={() => onPress?.(i)}
              aria-label={tr(BOMB_MARK_NAMES[mark])}
            >
              {BOMB_MARKS[mark]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** The book, as the one who has it sees it: a page for each kind of bomb. */
export const BombBook: React.FC<{ pages: BombPage[]; picked: number | null; onPick: (page: number) => void }> = ({ pages, picked, onPick }) => {
  const tr = useT();
  return (
    <div className="bm-book">
      {pages.map((page, p) => (
        <button key={p} type="button" className="bm-page" data-picked={picked === p || undefined} onClick={() => onPick(p)} aria-pressed={picked === p}>
          <span className="bm-page-tag">
            {page.tag.map((mark, i) => (
              <b key={i}>{BOMB_MARKS[mark]}</b>
            ))}
          </span>
          <span className="bm-page-row">
            <small>{tr('Cut')}</small>
            {page.steps.map((wire, i) => (
              <WireChip key={i} wire={wire} n={i + 1} />
            ))}
          </span>
          {page.keys.length > 0 && (
            <span className="bm-page-row">
              <small>{tr('Press')}</small>
              {page.keys.map((mark, i) => (
                <span key={i} className="bm-chip">
                  <small>{i + 1}</small>
                  <b>{BOMB_MARKS[mark]}</b>
                </span>
              ))}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

interface Taped {
  who: Seat;
  sign: number;
  id: number;
}

/**
 * Bomb Squad (core/bombSquad): one of you has the bomb, the other the book,
 * and picture signs between you in place of a call.
 */
export const BombSquad: React.FC<DuoGameProps> = ({ mine, theirs, me, partnerName, canPlay, emotes = true, onHalf, onBack }) => {
  const tr = useT();
  const em = useGameEmotes('bomb');
  const them: Seat = me === 'user' ? 'partner' : 'user';
  const done = duoOf(mine, theirs).bomb;
  /** The level on screen: it stays on the one just done until you move on. */
  const [level, setLevel] = useState(done + 1);
  const levelRef = useRef(level);
  levelRef.current = level;
  const bomb = useMemo(() => bombOf(level), [level]);
  const bombRef = useRef(bomb);
  bombRef.current = bomb;
  const mineBomb = defuserOf(level) === me;
  const mineBombRef = useRef(mineBomb);
  mineBombRef.current = mineBomb;

  useEffect(() => loadSounds(['g-bm-tick', 'g-bm-cut', 'g-bm-wrong', 'g-bm-boom', 'g-bm-safe', 'g-pick', 'g-turn', 'g-start']), []);

  const [run, setRunState] = useState<BombRun | null>(null);
  const runRef = useRef<BombRun | null>(null);
  const setRun = (next: BombRun | null) => {
    runRef.current = next;
    setRunState(next);
  };
  /** When the bomb was last heard of, on the phone with the book. */
  const heardAt = useRef(0);
  const [, redraw] = useState(0);

  const [tape, setTape] = useState<Taped[]>([]);
  const tapeId = useRef(0);
  const addSign = (who: Seat, sign: number) => setTape(list => [...list.slice(-(TAPE - 1)), { who, sign, id: ++tapeId.current }]);
  const [wrong, setWrong] = useState<string | null>(null);
  const wrongTimer = useRef<number | null>(null);
  const flashWrong = (what: string) => {
    setWrong(what);
    if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    wrongTimer.current = window.setTimeout(() => setWrong(null), 600);
  };
  useEffect(
    () => () => {
      if (wrongTimer.current !== null) window.clearTimeout(wrongTimer.current);
    },
    []
  );
  const [picked, setPicked] = useState<number | null>(null);

  const onHalfRef = useRef(onHalf);
  onHalfRef.current = onHalf;
  const mineRef = useRef(mine);
  mineRef.current = mine;
  /** A bomb made safe: written down once, by each phone as it sees it. */
  const wrote = useRef(0);
  const madeSafe = (which: number) => {
    if (wrote.current >= which) return;
    wrote.current = which;
    const next = withDuo(mineRef.current, 'bomb', which, Date.now());
    if (next !== mineRef.current) onHalfRef.current(next);
  };
  const ending = (did: BombTouch | 'time', level: number) => {
    if (did === 'safe') {
      playSound('g-bm-safe');
      haptic('confirm');
      madeSafe(level);
    } else {
      playSound('g-bm-boom');
      haptic('reject');
    }
  };

  const say = (next: BombRun) => sayDuo('bomb', { s: runToWire(next) });
  /** The phone with the bomb starts a go at it. */
  const begin = () => {
    if (!mineBombRef.current) return;
    getAudioContext();
    const next = newRun(bombRef.current, Math.floor(Date.now() / 1000) % 1_000_000_000);
    setRun(next);
    setTape([]);
    say(next);
    playSound('g-start');
    haptic('confirm');
  };
  const beginRef = useRef(begin);
  beginRef.current = begin;

  // The clock, on the phone with the bomb; and how it stands, said every second.
  useEffect(() => {
    let last = Date.now();
    let sinceSaid = 0;
    const id = window.setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      if (!mineBombRef.current) {
        // The book's side only counts down between words from the bomb.
        if (runRef.current && !runRef.current.over) redraw(n => n + 1);
        return;
      }
      const held = runRef.current;
      sinceSaid += dt;
      if (held && !held.over) {
        const before = Math.ceil(held.left);
        const next = ticked(held, dt);
        setRun(next);
        if (next.over) {
          ending('time', next.level);
          say(next);
          sinceSaid = 0;
          return;
        }
        if (Math.ceil(next.left) !== before && next.left <= 15) playSound('g-bm-tick', { gain: 0.7 });
      }
      if (sinceSaid >= (held && !held.over ? 1 : 2) && document.visibilityState !== 'hidden') {
        sinceSaid = 0;
        // With no bomb going it still says so, so the book knows it is waiting.
        say(runRef.current ?? { level: levelRef.current, e: 0, cut: [], pressed: 0, strikes: 0, left: bombRef.current.seconds, over: 0 });
      }
    }, 250);
    return () => window.clearInterval(id);
    // Everything it reads is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hearing the other phone.
  useEffect(
    () =>
      onDuo('bomb', raw => {
        const said = cleanBombSaid(raw);
        if (!said) return;
        if (said.sign !== undefined) {
          addSign(them, said.sign);
          playSound('g-turn', { gain: 0.8 });
          haptic('tick');
        }
        if (said.go !== undefined && said.go >= levelRef.current && defuserOf(said.go) === me) {
          // The one with the book asks for it to start. They may be a level ahead of what is known here.
          const held = runRef.current;
          if (said.go !== levelRef.current) {
            levelRef.current = said.go;
            bombRef.current = bombOf(said.go);
            mineBombRef.current = true;
            setLevel(said.go);
          } else if (held && !held.over && held.e > 0) return;
          beginRef.current();
        }
        if (said.run && defuserOf(said.run.level) !== me) {
          const heard = said.run;
          heardAt.current = Date.now();
          const held = runRef.current;
          if (heard.level > levelRef.current) {
            // They have moved on with nothing going yet: the card of the bomb just done stays up here until it is tapped.
            if (heard.e === 0 && held?.over) return;
            levelRef.current = heard.level;
            bombRef.current = bombOf(heard.level);
            mineBombRef.current = false;
            setLevel(heard.level);
            setPicked(null);
            setRun(heard.e > 0 ? heard : null);
            return;
          }
          if (heard.level < levelRef.current) return;
          if (heard.e === 0) {
            // Nothing going over there: unless the card of the last go is still up here.
            if (held && !held.over) setRun(null);
            return;
          }
          if (!laterRun(held, heard)) return;
          const fresh = !held || held.e !== heard.e;
          if (fresh) setTape([]);
          if (held && !fresh) {
            if (heard.strikes > held.strikes && !heard.over) {
              playSound('g-bm-wrong');
              haptic('reject');
            } else if (heard.cut.length > held.cut.length || heard.pressed > held.pressed) {
              playSound('g-bm-cut', { gain: 0.8 });
            }
          } else if (fresh) playSound('g-start');
          if (heard.over && !(held && held.e === heard.e && held.over)) ending(heard.over === 1 ? 'safe' : 'boom', heard.level);
          setRun(heard);
        }
      }),
    // Whose phone this is does not change while the game is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  []
  );

  // The clock as the phone with the book shows it: what it last heard, less the time since.
  const quiet = !mineBomb && !!run && !run.over && Date.now() - heardAt.current > QUIET_MS;
  const left = !run ? bomb.seconds : mineBomb || run.over || quiet ? run.left : Math.max(0, run.left - (Date.now() - heardAt.current) / 1000);
  const lastTick = useRef(-1);
  useEffect(() => {
    if (mineBomb || !run || run.over) return;
    const whole = Math.ceil(left);
    if (whole !== lastTick.current && whole <= 15 && whole > 0 && lastTick.current !== -1) playSound('g-bm-tick', { gain: 0.6 });
    lastTick.current = whole;
  });

  const touch = (result: { run: BombRun; did: BombTouch }, what: string) => {
    if (result.did === 'nothing') return;
    setRun(result.run);
    say(result.run);
    if (result.did === 'ok') {
      playSound('g-bm-cut');
      haptic('tick');
    } else if (result.did === 'wrong') {
      playSound('g-bm-wrong');
      haptic('reject');
      flashWrong(what);
    } else {
      if (result.did === 'boom') flashWrong(what);
      ending(result.did, result.run.level);
      // Said twice more: this is the word that must not be lost.
      window.setTimeout(() => runRef.current === result.run && say(result.run), 350);
      window.setTimeout(() => runRef.current === result.run && say(result.run), 1100);
    }
  };
  const cut = (wire: number) => {
    const held = runRef.current;
    if (!held || !mineBomb) return;
    getAudioContext();
    touch(cutWire(held, bomb, wire), `w${wire}`);
  };
  const press = (key: number) => {
    const held = runRef.current;
    if (!held || !mineBomb) return;
    getAudioContext();
    touch(pressKey(held, bomb, key), `k${key}`);
  };

  const lastSign = useRef(0);
  const sign = (index: number) => {
    if (Date.now() - lastSign.current < 250) return;
    lastSign.current = Date.now();
    getAudioContext();
    sayDuo('bomb', { g: index });
    addSign(me, index);
    playSound('g-pick', { gain: 0.7 });
    haptic('tick');
  };

  const start = () => {
    getAudioContext();
    if (mineBomb) begin();
    else {
      sayDuo('bomb', { go: level });
      setRun(null);
      playSound('g-pick');
      haptic('tick');
    }
  };
  const next = () => {
    getAudioContext();
    haptic('tick');
    setPicked(null);
    setTape([]);
    setRun(null);
    setLevel(Math.max(level + 1, duoOf(mineRef.current, theirs).bomb + 1));
  };

  const live = !!run && !run.over;
  const ready = canPlay && em.theirHere;
  let status: string;
  if (!canPlay) status = tr("{name}'s Two needs the latest update to play this one", { name: partnerName });
  else if (!em.theirHere) status = tr('Waiting for {name} to open this game', { name: partnerName });
  else if (!run) status = mineBomb ? tr('You have the bomb. Start when you are both ready') : tr('You have the book. Start when you are both ready');
  else if (quiet) status = tr('Waiting for {name}', { name: partnerName });
  else if (mineBomb) status = run.cut.length >= bomb.cuts.length ? tr('Wires done. Now the buttons, in order') : tr('Show {name} the label, then cut what they sign', { name: partnerName });
  else status = picked === null ? tr('Find the page with the label {name} signs', { name: partnerName }) : tr('Sign the wires to cut, in order');

  return (
    <DuoShell
      game="bomb"
      sub={tr('Level {n}', { n: level })}
      me={me}
      partnerName={partnerName}
      em={em}
      emotes={emotes}
      myPart={mineBomb ? tr('the bomb') : tr('the book')}
      theirPart={mineBomb ? tr('the book') : tr('the bomb')}
      art={<BombIcon />}
      onBack={onBack}
      over={
        run?.over === 1 ? (
          <DuoCard title={tr('Bomb made safe!')} line={<>⏱ {clock(run.left)}</>} tip={tr('Next time you swap: the other one gets the bomb.')} party>
            <button type="button" className="ch-go" onClick={next}>
              {tr('Next bomb')}
            </button>
          </DuoCard>
        ) : run?.over === 2 ? (
          <DuoCard title={tr('Boom!')} tip={run.strikes >= BOMB_STRIKES ? tr('Three mistakes. Take it slower this time.') : tr('Out of time. Be quicker with the signs this time.')}>
            <button type="button" className="ch-go" onClick={start} disabled={!ready}>
              {tr('Try again')}
            </button>
          </DuoCard>
        ) : undefined
      }
    >
      <div className="bm-stage">
        {mineBomb ? (
          <BombBody bomb={bomb} run={run} left={left} wrong={wrong} onCut={live ? cut : undefined} onPress={live ? press : undefined} />
        ) : (
          <>
            <div className="bm-far" data-low={live && left <= 15 ? '' : undefined}>
              <span className="bm-clock">{clock(left)}</span>
              <span className="bm-strikes">
                {Array.from({ length: BOMB_STRIKES }, (_, i) => (
                  <i key={i} data-on={i < (run?.strikes ?? 0) || undefined} />
                ))}
              </span>
              <span className="bm-far-done">
                ✂️ {run?.cut.length ?? 0}/{bomb.cuts.length}
                {bomb.press.length > 0 && (
                  <>
                    {' '}
                    🔘 {run?.pressed ?? 0}/{bomb.press.length}
                  </>
                )}
              </span>
            </div>
            <BombBook pages={bomb.pages} picked={picked} onPick={p => setPicked(prev => (prev === p ? null : p))} />
          </>
        )}
        {!live && !run?.over && (
          <button type="button" className="ch-go bm-start" onClick={start} disabled={!ready}>
            {tr('Start')}
          </button>
        )}
      </div>

      <p className="ch-say" aria-live="polite">
        {status}
      </p>

      <div className="bm-tape" aria-label={tr('Signs')}>
        {tape.length === 0 ? (
          <small>{tr('Your signs to each other show here')}</small>
        ) : (
          tape.map(t => (
            <span key={t.id} className="bm-taped" data-mine={t.who === me || undefined}>
              <BombSignFace index={t.sign} />
            </span>
          ))
        )}
      </div>
      <div className="bm-signs" role="group" aria-label={tr('Signs for {name}', { name: partnerName })}>
        {Array.from({ length: BOMB_SIGN_COUNT }, (_, i) => {
          const s = bombSign(i)!;
          const label = s.kind === 'colour' ? tr(BOMB_COLOURS[s.i].name) : s.kind === 'mark' ? tr(BOMB_MARK_NAMES[s.i]) : BOMB_WORDS[s.i];
          return (
            <button key={i} type="button" className="bm-sign" onClick={() => sign(i)} aria-label={label}>
              <BombSignFace index={i} />
            </button>
          );
        })}
      </div>
    </DuoShell>
  );
};
