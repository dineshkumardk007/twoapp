import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../core/i18n';
import { haptic } from '../core/haptics';
import { playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import { PZ_FAIL, PZ_LIMIT_MS, PZ_PENALTY_MS, PZ_TO_WIN, asPick, playPuzzle, puzzleOf, type Puzzle, type PzKind } from '../core/puzzleDuel';
import type { BoardProps } from './GameBoards';

// Puzzle Duel on Canvas of Us (core/puzzleDuel has the rules and makes the puzzles).
//
// Each round: press Start, solve the puzzle, and your time is your move. The
// clock is this phone's own, started the moment the puzzle is on the screen,
// and it is written straight to its label many times a second without React
// redrawing anything.

const REVEAL_MS = 2500;
const READY_MS = 650;

const KIND_TITLE: Record<PzKind, string> = {
  order: 'Tap 1 to 16 in order',
  odd: 'Find the odd one out',
  pattern: 'What comes next?',
  sum: 'Work it out',
  lights: 'Repeat the lights'
};
const KIND_ICON: Record<PzKind, string> = { order: '🔢', odd: '🔍', pattern: '🧩', sum: '➗', lights: '🚦' };

const seconds = (ms: number) => (ms / 1000).toFixed(2);

interface PlayProps<P extends Puzzle> {
  puzzle: P;
  onSolved: () => void;
  onWrong: () => void;
}

/** Sixteen numbers, to be tapped from 1 up. */
const OrderPuzzle: React.FC<PlayProps<Extract<Puzzle, { kind: 'order' }>>> = ({ puzzle, onSolved, onWrong }) => {
  const [next, setNext] = useState(1);
  const [bad, setBad] = useState<number | null>(null);
  const tap = (value: number, cell: number) => {
    if (value < next) return;
    if (value !== next) {
      setBad(cell);
      window.setTimeout(() => setBad(b => (b === cell ? null : b)), 320);
      onWrong();
      return;
    }
    playSound('g-pz-tap', { rate: 0.9 + value * 0.035 });
    haptic('key');
    if (value === 16) onSolved();
    setNext(value + 1);
  };
  return (
    <div className="pz-order">
      {puzzle.cells.map((value, cell) => (
        <button key={cell} type="button" className="pz-cell" data-done={value < next || undefined} data-bad={bad === cell || undefined} onPointerDown={() => tap(value, cell)}>
          {value}
        </button>
      ))}
    </div>
  );
};

/** A grid of one letter, with one of another hidden in it. */
const OddPuzzle: React.FC<PlayProps<Extract<Puzzle, { kind: 'odd' }>>> = ({ puzzle, onSolved, onWrong }) => {
  const [tried, setTried] = useState<number[]>([]);
  return (
    <div className="pz-odd" style={{ gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)` }}>
      {Array.from({ length: puzzle.count }, (_, i) => (
        <button
          key={i}
          type="button"
          className="pz-letter"
          disabled={tried.includes(i)}
          onPointerDown={() => {
            if (tried.includes(i)) return;
            if (i === puzzle.at) onSolved();
            else {
              setTried(list => [...list, i]);
              onWrong();
            }
          }}
        >
          {i === puzzle.at ? puzzle.odd : puzzle.common}
        </button>
      ))}
    </div>
  );
};

/** A question with four answers: the next number, or a sum. */
const ChoicePuzzle: React.FC<{ question: React.ReactNode; options: number[]; answer: number; onSolved: () => void; onWrong: () => void }> = ({ question, options, answer, onSolved, onWrong }) => {
  const [tried, setTried] = useState<number[]>([]);
  return (
    <div className="pz-choice">
      <p className="pz-question">{question}</p>
      <div className="pz-options">
        {options.map((value, i) => (
          <button
            key={i}
            type="button"
            className="pz-option"
            disabled={tried.includes(i)}
            onClick={() => {
              if (i === answer) onSolved();
              else {
                setTried(list => [...list, i]);
                onWrong();
              }
            }}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
};

const PAD_RATES = [0.75, 0.94, 1.12, 1.41];

/** Four pads light up in turn; then you play it back. */
const LightsPuzzle: React.FC<PlayProps<Extract<Puzzle, { kind: 'lights' }>>> = ({ puzzle, onSolved, onWrong }) => {
  const tr = useT();
  const [lit, setLit] = useState<number | null>(null);
  const [showing, setShowing] = useState(true);
  const [at, setAt] = useState(0);
  const timers = useRef<number[]>([]);
  const show = (after: number) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setShowing(true);
    setAt(0);
    puzzle.seq.forEach((pad, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setLit(pad);
          playSound('g-pz-pad', { rate: PAD_RATES[pad] });
        }, after + i * 520)
      );
      timers.current.push(window.setTimeout(() => setLit(null), after + i * 520 + 360));
    });
    timers.current.push(window.setTimeout(() => setShowing(false), after + puzzle.seq.length * 520));
  };
  useEffect(() => {
    show(250);
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tap = (pad: number) => {
    if (showing) return;
    playSound('g-pz-pad', { rate: PAD_RATES[pad] });
    haptic('key');
    setLit(pad);
    timers.current.push(window.setTimeout(() => setLit(l => (l === pad ? null : l)), 180));
    if (pad !== puzzle.seq[at]) {
      onWrong();
      // Shown again, so there is always a way through.
      show(650);
      return;
    }
    if (at + 1 === puzzle.seq.length) onSolved();
    setAt(at + 1);
  };
  return (
    <div className="pz-lights">
      <p className="pz-question pz-question-small">{showing ? tr('Watch…') : `${at} / ${puzzle.seq.length}`}</p>
      <div className="pz-pads" data-showing={showing || undefined}>
        {[0, 1, 2, 3].map(pad => (
          <button key={pad} type="button" className="pz-pad" data-pad={pad} data-lit={lit === pad || undefined} onPointerDown={() => tap(pad)} aria-label={tr('Light {n}', { n: pad + 1 })} />
        ))}
      </div>
    </div>
  );
};

export const PuzzleBoard: React.FC<BoardProps> = React.memo(({ game, me, inkOf, canAct, onMove, onSettled, partnerName }) => {
  const tr = useT();
  const them: Seat = me === 'user' ? 'partner' : 'user';
  const s = useMemo(() => playPuzzle(game), [game]);
  const done = s.rounds.length;
  const mine = game.picks?.[me] || [];
  const theirs = game.picks?.[them] || [];
  const myPick = mine.length > done ? mine[done] : null;
  const theyPicked = theirs.length > done;

  /** How many rounds have been shown here, result and all. */
  const [shown, setShown] = useState(done);
  const [phase, setPhase] = useState<'idle' | 'ready' | 'play'>('idle');
  const areaRef = useRef<HTMLDivElement>(null);
  const puzzle = useMemo(() => puzzleOf(game.id, done), [game.id, done]);

  const clockRef = useRef<HTMLSpanElement>(null);
  const started = useRef(0);
  const penalty = useRef(0);
  const finished = useRef(false);
  const idRef = useRef(game.id);
  const shownRef = useRef(done);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  const moveRef = useRef(onMove);
  moveRef.current = onMove;

  // A new game, or a round of theirs and yours both in: the result, for a moment.
  useEffect(() => {
    if (idRef.current !== game.id || done < shownRef.current) {
      idRef.current = game.id;
      shownRef.current = done;
      setShown(done);
      setPhase('idle');
      settledRef.current?.(done);
      return;
    }
    if (done <= shownRef.current) return;
    const round = s.rounds[done - 1];
    playSound('g-reveal');
    const t1 = window.setTimeout(() => playSound(round.winner === me ? 'g-point' : round.winner ? 'g-miss' : 'g-tie'), 650);
    const t2 = window.setTimeout(() => {
      shownRef.current = done;
      setShown(done);
      settledRef.current?.(done);
    }, REVEAL_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, done]);

  useEffect(() => {
    settledRef.current?.(shownRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Not yours to play any more (your time is in, or the game moved on): the puzzle goes away.
  useEffect(() => {
    if (!canAct && phase !== 'idle') setPhase('idle');
  }, [canAct, phase]);

  const finish = (solved: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const ms = performance.now() - started.current + penalty.current;
    playSound(solved ? 'g-pz-done' : 'g-pz-wrong');
    haptic(solved ? 'confirm' : 'reject');
    setPhase('idle');
    moveRef.current(asPick(ms, solved));
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // The clock, while a puzzle is being solved.
  useEffect(() => {
    if (phase !== 'play') return;
    let raf = 0;
    const tick = () => {
      const ms = performance.now() - started.current + penalty.current;
      if (ms >= PZ_LIMIT_MS) {
        finishRef.current(false);
        return;
      }
      if (clockRef.current) clockRef.current.textContent = seconds(ms);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const start = () => {
    if (!canAct || phase !== 'idle') return;
    playSound('g-pz-go');
    haptic('confirm');
    setPhase('ready');
    window.setTimeout(() => {
      started.current = performance.now();
      penalty.current = 0;
      finished.current = false;
      setPhase(p => (p === 'ready' ? 'play' : p));
    }, READY_MS);
  };
  const wrong = () => {
    penalty.current += PZ_PENALTY_MS[puzzle.kind];
    playSound('g-pz-wrong');
    haptic('reject');
    // A shake, and the clock jumps: the cost of a wrong tap.
    areaRef.current?.animate?.(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(0)' }],
      { duration: 280, easing: 'ease-out' }
    );
    clockRef.current?.parentElement?.animate?.([{ color: '#ff5d73', transform: 'scale(1.12)' }, { color: 'inherit', transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
  };
  const solved = () => finish(true);

  const pips = (seat: Seat) => {
    const points = s.rounds.slice(0, shown).filter(r => r.winner === seat).length;
    return (
      <span className="gh-pips" style={{ '--ink': inkOf(seat) } as React.CSSProperties}>
        {Array.from({ length: PZ_TO_WIN }, (_, i) => (
          <i key={i} data-on={points > i || undefined} />
        ))}
      </span>
    );
  };
  const timeText = (ms: number) => (ms >= PZ_FAIL ? tr('not solved') : tr('{n} s', { n: seconds(ms) }));

  const revealing = done > shown ? s.rounds[done - 1] : null;
  const over = s.over && shown >= done;
  const lastRound = shown > 0 ? s.rounds[shown - 1] : null;

  let body: React.ReactNode;
  if (revealing) {
    body = (
      <div className="pz-reveal" key={`r${done}`}>
        <div className="pz-times">
          <span className="pz-time" data-win={revealing.winner === me || undefined} style={{ '--ink': inkOf(me) } as React.CSSProperties}>
            <small>{tr('You')}</small>
            <b>{timeText(revealing.time[me])}</b>
          </span>
          <span className="gh-vs">vs</span>
          <span className="pz-time" data-win={revealing.winner === them || undefined} style={{ '--ink': inkOf(them) } as React.CSSProperties}>
            <small>{partnerName}</small>
            <b>{timeText(revealing.time[them])}</b>
          </span>
        </div>
        <p className="pz-verdict">{revealing.winner === me ? tr('You were faster!') : revealing.winner ? tr('{name} was faster', { name: partnerName }) : tr('Nobody takes this one')}</p>
      </div>
    );
  } else if (over) {
    body = (
      <div className="pz-wait">
        <span className="pz-big" aria-hidden="true">
          🧠
        </span>
        {lastRound && (
          <p className="pz-verdict">
            {tr('Last round')}: {timeText(lastRound.time[me])} · {timeText(lastRound.time[them])}
          </p>
        )}
      </div>
    );
  } else if (phase === 'play') {
    body = (
      <div className="pz-play" key={`p${done}`}>
        <div className="pz-clock">
          <span ref={clockRef}>0.00</span>
          <small>{tr(KIND_TITLE[puzzle.kind])}</small>
        </div>
        <div className="pz-area" ref={areaRef}>
          {puzzle.kind === 'order' && <OrderPuzzle puzzle={puzzle} onSolved={solved} onWrong={wrong} />}
          {puzzle.kind === 'odd' && <OddPuzzle puzzle={puzzle} onSolved={solved} onWrong={wrong} />}
          {puzzle.kind === 'pattern' && <ChoicePuzzle question={`${puzzle.shown.join('   ')}   ?`} options={puzzle.options} answer={puzzle.answer} onSolved={solved} onWrong={wrong} />}
          {puzzle.kind === 'sum' && <ChoicePuzzle question={`${puzzle.text} = ?`} options={puzzle.options} answer={puzzle.answer} onSolved={solved} onWrong={wrong} />}
          {puzzle.kind === 'lights' && <LightsPuzzle puzzle={puzzle} onSolved={solved} onWrong={wrong} />}
        </div>
        <button type="button" className="pz-give" onClick={() => finish(false)}>
          {tr('Give up this one')}
        </button>
      </div>
    );
  } else if (myPick !== null) {
    body = (
      <div className="pz-wait">
        <span className="pz-big" aria-hidden="true">
          ⏱️
        </span>
        <p className="pz-mine">{myPick >= PZ_FAIL ? tr('Not solved this time') : tr('Your time: {n} s', { n: seconds(myPick) })}</p>
        <p className="pz-verdict">{tr('Waiting for {name} to solve it', { name: partnerName })}</p>
      </div>
    );
  } else {
    body = (
      <div className="pz-wait" data-ready={phase === 'ready' || undefined}>
        <span className="pz-big" aria-hidden="true">
          {KIND_ICON[puzzle.kind]}
        </span>
        <p className="pz-mine">{tr(KIND_TITLE[puzzle.kind])}</p>
        {phase === 'ready' ? (
          <p className="pz-go">{tr('Ready…')}</p>
        ) : (
          <button type="button" className="pz-start" disabled={!canAct} onClick={start}>
            {tr('Start the clock')}
          </button>
        )}
        <p className="pz-verdict">{theyPicked ? tr('{name} has finished - your go!', { name: partnerName }) : tr('The clock starts when the puzzle appears')}</p>
      </div>
    );
  }

  return (
    <div className="pz" style={{ '--me': inkOf(me), '--them': inkOf(them) } as React.CSSProperties}>
      <div className="gh-score">
        <span className="gh-side">{pips(me)}</span>
        <span className="gh-round">{over ? tr('Game over') : tr('Round {n}', { n: Math.min(shown, done) + 1 })}</span>
        <span className="gh-side">{pips(them)}</span>
      </div>
      <div className="pz-stage">{body}</div>
    </div>
  );
});
PuzzleBoard.displayName = 'PuzzleBoard';
