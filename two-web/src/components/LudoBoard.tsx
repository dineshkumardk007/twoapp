import React, { useEffect, useMemo, useRef, useState } from 'react';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import {
  HOME,
  HOME_COLUMN,
  IN_BASE,
  LAST_ON_TRACK,
  SAFE,
  START,
  TRACK,
  ludoMove,
  movableTokens,
  playLudo,
  type LudoStep
} from '../core/ludo';
import { other } from '../core/paperGames';
import { playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import { wearOf } from '../core/wear';
import { BearFace, BunnyFace } from './CosyHomes';
import { randomRoll, type BoardProps } from './GameBoards';
import { DieFace } from './gameArt';

// Ludo for two on Canvas of Us (core/ludo has the rules).
//
// The board is the classic cross of 15 by 15 squares, turned so that your
// own corner is always bottom left. Your tokens are little bears or bunnies
// in your colour. A roll is made here, on your phone, and what you do with
// it goes to the other phone as one move; each move is played out on both,
// hop by hop, with the die tumbling first.

const ROLL_MS = 650;
const HOP_MS = 165;
const FLY_MS = 560;
const NEUTRAL = ['#93c5fd', '#86efac'];

/** Where a square of the grid is on the board as this phone shows it, in % of its side: its middle. */
const spot = (r: number, c: number, turned: boolean): { x: number; y: number } => {
  const rr = turned ? 14 - r : r;
  const cc = turned ? 14 - c : c;
  return { x: ((cc + 0.5) / 15) * 100, y: ((rr + 0.5) / 15) * 100 };
};

/** The four places in a corner where its tokens wait. */
const BASE_SLOTS: Record<Seat, ReadonlyArray<readonly [number, number]>> = {
  user: [
    [10.5, 1.5],
    [10.5, 3.5],
    [12.5, 1.5],
    [12.5, 3.5]
  ],
  partner: [
    [1.5, 10.5],
    [1.5, 12.5],
    [3.5, 10.5],
    [3.5, 12.5]
  ]
};
/** Where tokens that are home sit, in the middle: on their side's triangle. */
const HOME_SLOTS: Record<Seat, ReadonlyArray<readonly [number, number]>> = {
  user: [
    [7.75, 6.55],
    [7.75, 7.45],
    [8.15, 6.9],
    [8.15, 7.1]
  ],
  partner: [
    [6.25, 7.45],
    [6.25, 6.55],
    [5.85, 7.1],
    [5.85, 6.9]
  ]
};

/** The grid square a token is on, or its waiting place: as [row, col], which may be between squares. */
function placeOf(seat: Seat, token: number, p: number): readonly [number, number] {
  if (p === IN_BASE) return BASE_SLOTS[seat][token];
  if (p >= HOME) return HOME_SLOTS[seat][token];
  if (p > LAST_ON_TRACK) return HOME_COLUMN[seat][p - LAST_ON_TRACK - 1];
  return TRACK[(START[seat] + p) % TRACK.length];
}

/** The board, drawn once for each way round and pair of colours. */
const LudoArt: React.FC<{ turned: boolean; inks: Record<Seat, string> }> = React.memo(({ turned, inks }) => {
  const S = 10;
  const cells: React.ReactNode[] = [];
  const cellAt = (r: number, c: number) => {
    const rr = turned ? 14 - r : r;
    const cc = turned ? 14 - c : c;
    return { x: cc * S, y: rr * S };
  };
  TRACK.forEach(([r, c], i) => {
    const { x, y } = cellAt(r, c);
    const start = i === START.user ? 'user' : i === START.partner ? 'partner' : null;
    const unused = i === 0 || i === 26;
    cells.push(
      <g key={`t${i}`}>
        <rect x={x} y={y} width={S} height={S} className="lu-cell" fill={start ? inks[start] : unused ? NEUTRAL[i === 0 ? 0 : 1] : undefined} fillOpacity={start ? 0.9 : unused ? 0.55 : undefined} />
        {SAFE.has(i) && !start && !unused && <path d={star(x + S / 2, y + S / 2, 3.6)} className="lu-star" />}
        {start && <path d={arrow(x + S / 2, y + S / 2)} className="lu-arrow" />}
      </g>
    );
  });
  (['user', 'partner'] as const).forEach(seat =>
    HOME_COLUMN[seat].forEach(([r, c], i) => {
      const { x, y } = cellAt(r, c);
      cells.push(<rect key={`h${seat}${i}`} x={x} y={y} width={S} height={S} className="lu-cell" fill={inks[seat]} fillOpacity={0.75 - i * 0.05} />);
    })
  );
  // The other two corners' home columns, unused, in their soft colours.
  [
    [7, 1, 5, 0],
    [7, 9, 13, 1]
  ].forEach(([row, from, to, k]) => {
    for (let c = from; c <= to; c++) {
      const { x, y } = cellAt(row, c);
      cells.push(<rect key={`n${k}${c}`} x={x} y={y} width={S} height={S} className="lu-cell" fill={NEUTRAL[k]} fillOpacity={0.35} />);
    }
  });
  const corner = (r0: number, c0: number, fill: string, key: string, mine?: Seat) => {
    const a = cellAt(r0, c0);
    const b = cellAt(r0 + 5, c0 + 5);
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return (
      <g key={key}>
        <rect x={x + 0.6} y={y + 0.6} width={6 * S - 1.2} height={6 * S - 1.2} rx={7} fill={fill} className="lu-corner" data-mine={mine ? '' : undefined} />
        <rect x={x + 9} y={y + 9} width={4 * S + 2} height={4 * S + 2} rx={8} className="lu-yard" />
      </g>
    );
  };
  // The middle: a triangle toward each corner, its colour.
  const m = (r: number, c: number) => {
    // A point, not a square: turned round about the middle of the board.
    const x = turned ? 150 - c * S : c * S;
    const y = turned ? 150 - r * S : r * S;
    return `${x},${y}`;
  };
  return (
    <svg className="lu-art" viewBox="0 0 150 150" aria-hidden="true" focusable="false">
      <rect x={0} y={0} width={150} height={150} rx={10} className="lu-bg" />
      {corner(9, 0, inks.user, 'cu', 'user')}
      {corner(0, 9, inks.partner, 'cp', 'partner')}
      {corner(0, 0, NEUTRAL[0], 'c0')}
      {corner(9, 9, NEUTRAL[1], 'c1')}
      {cells}
      <polygon points={`${m(6, 6)} ${m(6, 9)} ${m(7.5, 7.5)}`} fill={inks.partner} opacity={0.9} />
      <polygon points={`${m(9, 6)} ${m(9, 9)} ${m(7.5, 7.5)}`} fill={inks.user} opacity={0.9} />
      <polygon points={`${m(6, 6)} ${m(9, 6)} ${m(7.5, 7.5)}`} fill={NEUTRAL[0]} opacity={0.6} />
      <polygon points={`${m(6, 9)} ${m(9, 9)} ${m(7.5, 7.5)}`} fill={NEUTRAL[1]} opacity={0.6} />
      <rect x={60} y={60} width={30} height={30} className="lu-middle" />
    </svg>
  );
});
LudoArt.displayName = 'LudoArt';

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}
const arrow = (cx: number, cy: number) => `M${cx - 2.6},${cy - 2} L${cx},${cy + 2} L${cx + 2.6},${cy - 2}`;

/** The game's picture, for its card among the games and its empty board. */
export const LudoIcon: React.FC = () => (
  <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
    <rect x={1.5} y={1.5} width={57} height={57} rx={10} fill="#fff7ea" stroke="#3b2723" strokeWidth={2.4} />
    <rect x={4} y={34} width={22} height={22} rx={5} fill="#f59e0b" />
    <rect x={34} y={4} width={22} height={22} rx={5} fill="#f472b6" />
    <rect x={4} y={4} width={22} height={22} rx={5} fill="#93c5fd" opacity={0.7} />
    <rect x={34} y={34} width={22} height={22} rx={5} fill="#86efac" opacity={0.7} />
    <polygon points="26,26 34,26 30,30" fill="#f472b6" />
    <polygon points="26,34 34,34 30,30" fill="#f59e0b" />
    <g transform="translate(6 36) scale(0.38)">
      <BearFace />
    </g>
    <g transform="translate(36 6) scale(0.38)">
      <BunnyFace />
    </g>
    <rect x={22} y={22} width={16} height={16} rx={3.5} fill="#fff" stroke="#3b2723" strokeWidth={1.6} />
    <circle cx={26.5} cy={26.5} r={1.6} fill="#3b2723" />
    <circle cx={30} cy={30} r={1.6} fill="#3b2723" />
    <circle cx={33.5} cy={33.5} r={1.6} fill="#3b2723" />
  </svg>
);

interface Shown {
  pos: Record<Seat, number[]>;
  /** A token flying back to its corner, and the one hopping now. */
  flying: string | null;
  hopping: string | null;
}

export const LudoBoard: React.FC<BoardProps> = React.memo(({ game, me, inkOf, canAct, onMove, onSettled, partnerName }) => {
  const tr = useT();
  const them = other(me);
  const final = useMemo(() => playLudo(game), [game]);
  const turned = me === 'partner';
  const inks: Record<Seat, string> = { user: inkOf('user'), partner: inkOf('partner') };

  const [shown, setShown] = useState<Shown>({ pos: final.pos, flying: null, hopping: null });
  const [die, setDie] = useState<{ value: number; rolling: boolean; seat: Seat | null }>({ value: final.last?.roll || 6, rolling: false, seat: final.last?.seat || null });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /** A roll made on this phone and not yet used: the tokens it can move, to pick from. */
  const [pending, setPending] = useState<{ roll: number; can: number[] } | null>(null);
  const shownCount = useRef(game.moves.length);
  const gameRef = useRef(game);
  gameRef.current = game;
  const idRef = useRef(game.id);
  const timers = useRef<number[]>([]);
  const running = useRef(false);
  /** The last roll this phone made and showed itself: not tumbled again when it comes back as a move. */
  const ownRoll = useRef<number | null>(null);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Each move played out in turn: the die, the hops, and anything sent home.
  useEffect(() => {
    if (idRef.current !== game.id) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      running.current = false;
      idRef.current = game.id;
      shownCount.current = game.moves.length;
      setShown({ pos: playLudo(game).pos, flying: null, hopping: null });
      setPending(null);
      setBusy(false);
      setNote(null);
      settledRef.current?.(game.moves.length);
      return;
    }
    const next = () => {
      const g = gameRef.current;
      if (shownCount.current >= g.moves.length) {
        running.current = false;
        setBusy(false);
        settledRef.current?.(shownCount.current);
        return;
      }
      running.current = true;
      setBusy(true);
      const k = shownCount.current;
      const step: LudoStep | null = playLudo({ ...g, moves: g.moves.slice(0, k + 1) }).last;
      if (!step) {
        shownCount.current = k + 1;
        next();
        return;
      }
      const mine = step.seat === me && ownRoll.current === step.roll;
      ownRoll.current = null;
      let t = 0;
      if (!mine) {
        setDie({ value: step.roll, rolling: true, seat: step.seat });
        playSound('g-dice');
        at(ROLL_MS, () => setDie({ value: step.roll, rolling: false, seat: step.seat }));
        t = ROLL_MS + 120;
      }
      const name = (s: Seat, i: number) => `${s}${i}`;
      if (step.token < 0) {
        at(t, () => setNote(step.forfeit ? tr('Three sixes - the turn is lost') : step.seat === me ? tr('No move with that roll') : tr('{name} could not move', { name: partnerName })));
        t += 900;
      } else {
        const from = step.from;
        const path: number[] = from === IN_BASE ? [0] : Array.from({ length: step.to - from }, (_, i) => from + i + 1);
        path.forEach((p, i) => {
          at(t + i * HOP_MS, () => {
            setShown(s => {
              const pos = { ...s.pos, [step.seat]: s.pos[step.seat].slice() };
              pos[step.seat][step.token] = p;
              return { pos, flying: null, hopping: name(step.seat, step.token) };
            });
            if (from === IN_BASE) {
              playSound('g-lu-out');
              haptic('tick');
            } else playSound('g-hop', { rate: 0.94 + i * 0.03 });
          });
        });
        t += path.length * HOP_MS + 80;
        if (step.captured.length) {
          at(t, () => {
            playSound('g-lu-capture');
            haptic('confirm');
            setShown(s => {
              const pos = { ...s.pos, [them]: s.pos[them].slice(), [me]: s.pos[me].slice() };
              for (const c of step.captured) pos[c.seat][c.token] = IN_BASE;
              return { pos, flying: step.captured.map(c => name(c.seat, c.token)).join(','), hopping: null };
            });
            setNote(step.seat === me ? tr('Sent home!') : tr('{name} sent you home!', { name: partnerName }));
          });
          t += FLY_MS + 200;
        } else if (step.to === HOME) {
          at(t, () => {
            playSound('g-lu-home');
            haptic('confirm');
            setNote(step.seat === me ? tr('Home!') : tr('{name} got one home', { name: partnerName }));
          });
          t += 500;
        }
      }
      if (step.again && !playLudo({ ...g, moves: g.moves.slice(0, k + 1) }).over) {
        at(t, () => {
          playSound('g-lu-six');
          setNote(step.seat === me ? tr('Roll again!') : tr('{name} rolls again', { name: partnerName }));
        });
      }
      at(t + 60, () => {
        setShown(s => ({ ...s, flying: null, hopping: null }));
        shownCount.current = k + 1;
        next();
      });
    };
    if (game.moves.length < shownCount.current) {
      shownCount.current = game.moves.length;
      setShown({ pos: final.pos, flying: null, hopping: null });
    }
    if (!running.current) next();
    // Each new move continues the queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // The die's faces while it tumbles.
  const [face, setFace] = useState(die.value);
  useEffect(() => {
    if (!die.rolling) {
      setFace(die.value);
      return;
    }
    const id = setInterval(() => setFace(f => ((f + Math.floor(Math.random() * 5)) % 6) + 1), 70);
    return () => clearInterval(id);
  }, [die]);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 1500);
    return () => clearTimeout(id);
  }, [note]);

  const ready = canAct && !busy && !pending && shownCount.current >= game.moves.length;
  const send = (roll: number, token: number) => {
    setPending(null);
    ownRoll.current = roll;
    onMove(ludoMove(roll, token));
  };
  const roll = () => {
    if (!ready) return;
    const value = randomRoll();
    setDie({ value, rolling: true, seat: me });
    playSound('g-dice');
    haptic('tick');
    setBusy(true);
    at(ROLL_MS, () => {
      setDie({ value, rolling: false, seat: me });
      const can = movableTokens(playLudo(gameRef.current), value);
      setBusy(false);
      if (!can.length) {
        setPending({ roll: value, can: [] });
        at(750, () => send(value, -1));
      } else if (can.length === 1 || new Set(can.map(i => final.pos[me][i])).size === 1) {
        // Only one way to go (or several tokens all in the same place): it goes by itself.
        setPending({ roll: value, can: [can[0]] });
        at(420, () => send(value, can[0]));
      } else {
        setPending({ roll: value, can });
        playSound('g-turn', { gain: 0.6 });
      }
    });
  };

  const token = (seat: Seat, i: number) => {
    const p = shown.pos[seat][i];
    const [r, c] = placeOf(seat, i, p);
    // Tokens sharing a square stand a little apart.
    const sharing = (['user', 'partner'] as const).flatMap(s =>
      shown.pos[s].map((q, j) => ({ s, j, q })).filter(o => o.q !== IN_BASE && o.q < HOME && placeOf(o.s, o.j, o.q).join() === [r, c].join())
    );
    const k = sharing.findIndex(o => o.s === seat && o.j === i);
    const offset = sharing.length > 1 && k >= 0 ? (k - (sharing.length - 1) / 2) * 2.2 : 0;
    const pt = spot(r, c, turned);
    const name = `${seat}${i}`;
    const pick = seat === me && !!pending && pending.can.length > 1 && pending.can.includes(i);
    const Face = seat === 'user' ? BearFace : BunnyFace;
    return (
      <button
        key={name}
        type="button"
        className="lu-token"
        data-fly={shown.flying?.split(',').includes(name) || undefined}
        data-hop={shown.hopping === name || undefined}
        data-pick={pick || undefined}
        data-home={p >= HOME || undefined}
        disabled={!pick}
        onClick={() => pick && pending && send(pending.roll, i)}
        style={{ left: `${pt.x + offset}%`, top: `${pt.y - (sharing.length > 1 ? 0.6 : 0)}%`, '--ink': inks[seat] } as React.CSSProperties}
        aria-label={seat === me ? tr('Your token {n}', { n: i + 1 }) : tr("{name}'s token {n}", { name: partnerName, n: i + 1 })}
      >
        <span className="lu-token-in">
          <Face wear={wearOf(seat)} />
        </span>
      </button>
    );
  };

  const home = { me: final.home[me], them: final.home[them] };
  const hint = pending
    ? pending.can.length > 1
      ? tr('Pick a token to move')
      : pending.can.length === 0
        ? tr('No move with that roll')
        : ''
    : ready
      ? final.pos[me].every(q => q === IN_BASE || q >= HOME)
        ? tr('Roll a 6 to bring a token out')
        : tr('Tap the die to roll')
      : '';

  return (
    <div className="lu">
      <div className="lu-board" data-turned={turned || undefined}>
        <LudoArt turned={turned} inks={inks} />
        <div className="lu-tokens">
          {shown.pos[them].map((_, i) => token(them, i))}
          {shown.pos[me].map((_, i) => token(me, i))}
        </div>
        {note && (
          <span className="lu-note" key={note}>
            {note}
          </span>
        )}
      </div>
      <div className="lu-bar">
        <span className="lu-home" style={{ '--ink': inks[me] } as React.CSSProperties}>
          🏠 {home.me}/{final.pos[me].length}
        </span>
        <button
          type="button"
          className="g-die"
          data-rolling={die.rolling || undefined}
          onClick={roll}
          disabled={!ready}
          style={{ '--ink': die.seat ? inks[die.seat] : '#3b2723' } as React.CSSProperties}
          aria-label={tr('Roll the die')}
        >
          <DieFace value={face} ink={die.seat ? inks[die.seat] : '#3b2723'} />
        </button>
        <span className="lu-home" data-right="" style={{ '--ink': inks[them] } as React.CSSProperties}>
          {home.them}/{final.pos[them].length} 🏠
        </span>
      </div>
      <p className="lu-hint">{hint || ' '}</p>
    </div>
  );
});
LudoBoard.displayName = 'LudoBoard';
