import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../core/i18n';
import { playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import {
  FOUR_COLS,
  FOUR_ROWS,
  RPS_CHOICES,
  LADDERS,
  MEMORY_FACES,
  SNAKES,
  rpsBeats,
  landingRow,
  lineAt,
  other,
  playDots,
  playFour,
  playRps,
  playMemory,
  playSnakes,
  playTtt,
  type Mark,
  type PaperGame
} from '../core/paperGames';
import { DieFace, MarkGlyph, MarkIcon } from './gameArt';

// The boards of the games on Canvas of Us (components/PaperGames). Each
// draws its game as the moves leave it and turns a tap into a move; the
// frame around it - players, score, turn, sounds at the end - is the
// shell's. A board draws in, with its own sound, only what was played
// since it was opened: `seen` is how many moves were already there.

export interface BoardProps {
  game: PaperGame;
  me: Seat;
  inkOf: (seat: Seat) => string;
  markOf: (seat: Seat) => Mark;
  myLook: { ink: string; mark: Mark };
  /** This phone may move now. */
  canAct: boolean;
  seen: number;
  onMove: (move: number) => void;
  partnerName: string;
  /** Snakes & Ladders: its counters have caught up with this many moves. */
  onSettled?: (count: number) => void;
}

const INK = '#3b2723';

// ------------------------------------------------------------- Tic-tac-toe

/** The hand-drawn grid: four lines, each a little off true. */
export const TTT_GRID = [
  'M100,14 C97,90 103,205 99,286',
  'M201,12 C204,100 198,190 202,288',
  'M14,101 C90,98 205,104 286,99',
  'M12,200 C100,203 190,197 288,202'
];

export const TttBoard: React.FC<BoardProps> = React.memo(({ game, inkOf, markOf, myLook, canAct, seen, onMove }) => {
  const tr = useT();
  const s = useMemo(() => playTtt(game), [game]);
  const line = s.line && s.winner ? s.line : null;
  return (
    <div className="pg-board pg-ttt">
      <svg viewBox="0 0 300 300" className="pg-svg" aria-hidden="true" focusable="false">
        {TTT_GRID.map((d, i) => (
          <path key={`${game.id}-${i}`} d={d} pathLength={1} className="pg-ink pg-grid" data-fresh={seen === 0 || undefined} style={{ animationDelay: `${i * 110}ms` }} />
        ))}
        {s.board.map((seat, cell) => {
          if (!seat) return null;
          const index = game.moves.indexOf(cell);
          const won = !!line?.includes(cell);
          return (
            <MarkGlyph
              key={`${game.id}-${cell}`}
              mark={markOf(seat)}
              ink={inkOf(seat)}
              x={(cell % 3) * 100 + 50}
              y={Math.floor(cell / 3) * 100 + 50}
              fresh={index >= seen}
              cls={won ? 'pg-won' : ''}
            />
          );
        })}
        {line &&
          s.winner &&
          (() => {
            const at = (c: number) => [(c % 3) * 100 + 50, Math.floor(c / 3) * 100 + 50];
            const [ax, ay] = at(line[0]);
            const [bx, by] = at(line[2]);
            // Run a little past the end marks, as a pen stroke would.
            const dx = (bx - ax) * 0.16;
            const dy = (by - ay) * 0.16;
            return (
              <path
                d={`M${ax - dx},${ay - dy} L${bx + dx},${by + dy}`}
                pathLength={1}
                stroke={inkOf(s.winner)}
                strokeWidth={11}
                strokeLinecap="round"
                fill="none"
                className="pg-ink pg-winline"
                data-fresh={game.moves.length > seen || undefined}
              />
            );
          })()}
      </svg>
      <div className="pg-cells">
        {s.board.map((seat, cell) => (
          <button
            key={cell}
            type="button"
            className="pg-cell"
            disabled={!canAct || !!seat}
            onClick={() => onMove(cell)}
            style={{ '--ink': myLook.ink } as React.CSSProperties}
            aria-label={tr('Row {r}, column {c}', { r: Math.floor(cell / 3) + 1, c: (cell % 3) + 1 })}
          >
            {!seat && canAct && (
              <svg viewBox="-34 -34 68 68" className="pg-ghost" aria-hidden="true" focusable="false">
                <MarkGlyph mark={myLook.mark} ink={myLook.ink} x={0} y={0} fresh={false} width={8} />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
});

// ---------------------------------------------------------- Dots and Boxes

const S = 60;
const P = 22;

export const DotsBoard: React.FC<BoardProps> = React.memo(({ game, inkOf, markOf, myLook, canAct, seen, onMove }) => {
  const tr = useT();
  const s = useMemo(() => playDots(game), [game]);
  // The move that closed each box, so only boxes closed since opening are drawn in.
  const closedAt = useMemo(() => {
    const at: number[] = [];
    for (let k = 0; k < game.moves.length; k++) {
      for (const b of playDots({ ...game, moves: game.moves.slice(0, k + 1) }).closed) at[b] = k;
    }
    return at;
  }, [game]);
  const n = game.size;
  const W = n * S + 2 * P;
  const lastLine = game.moves[game.moves.length - 1];
  const ends = (i: number) => {
    const { row, col, across } = lineAt(n, i);
    const x1 = P + col * S;
    const y1 = P + row * S;
    return { x1, y1, x2: across ? x1 + S : x1, y2: across ? y1 : y1 + S, across };
  };
  return (
    <div className="pg-board pg-dots">
      <svg viewBox={`0 0 ${W} ${W}`} className="pg-svg">
        {s.boxes.map((seat, b) => {
          if (!seat) return null;
          const row = Math.floor(b / n);
          const col = b % n;
          const fresh = (closedAt[b] ?? 0) >= seen;
          return (
            <g key={`${game.id}-b${b}`} className="pg-box" data-fresh={fresh || undefined}>
              <rect x={P + col * S + 5} y={P + row * S + 5} width={S - 10} height={S - 10} rx={9} fill={inkOf(seat)} opacity={0.24} />
              <MarkGlyph mark={markOf(seat)} ink={inkOf(seat)} x={P + col * S + S / 2} y={P + row * S + S / 2} s={0.5} fresh={fresh} width={4.5} delay={120} />
            </g>
          );
        })}
        {s.lines.map((seat, i) => {
          if (!seat) return null;
          const e = ends(i);
          return (
            <line
              key={`${game.id}-l${i}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              pathLength={1}
              stroke={inkOf(seat)}
              strokeWidth={7}
              strokeLinecap="round"
              className={`pg-ink pg-line ${i === lastLine && !s.over ? 'pg-latest-line' : ''}`}
              data-fresh={game.moves.indexOf(i) >= seen || undefined}
            />
          );
        })}
        {canAct &&
          s.lines.map((seat, i) => {
            if (seat) return null;
            const e = ends(i);
            const hit = e.across ? { x: e.x1 + 8, y: e.y1 - 16, width: S - 16, height: 32 } : { x: e.x1 - 16, y: e.y1 + 8, width: 32, height: S - 16 };
            return (
              <g
                key={`s${i}`}
                className="pg-slot"
                data-line={i}
                role="button"
                tabIndex={0}
                aria-label={tr('Draw this line')}
                onClick={() => onMove(i)}
                onKeyDown={ev => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    onMove(i);
                  }
                }}
              >
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={myLook.ink} strokeWidth={7} strokeLinecap="round" className="pg-preview" />
                <rect {...hit} fill="transparent" />
              </g>
            );
          })}
        {Array.from({ length: (n + 1) * (n + 1) }, (_, k) => (
          <circle key={k} cx={P + (k % (n + 1)) * S} cy={P + Math.floor(k / (n + 1)) * S} r={5.5} fill={INK} />
        ))}
      </svg>
    </div>
  );
});

// ------------------------------------------------------------ Four in a Row

/** How long a disc falls to a row, ms: further down, a touch longer. */
export const fourFallMs = (row: number) => 260 + row * 50;

export const FourBoard: React.FC<BoardProps> = React.memo(({ game, inkOf, myLook, canAct, seen, onMove }) => {
  const tr = useT();
  const s = useMemo(() => playFour(game), [game]);
  // Which move dropped the disc in each cell.
  const moveAt = useMemo(() => {
    const grid: (Seat | null)[] = Array(FOUR_COLS * FOUR_ROWS).fill(null);
    const at: number[] = [];
    let turn = game.first;
    game.moves.forEach((col, k) => {
      const row = landingRow(grid, col);
      if (row < 0) return;
      grid[row * FOUR_COLS + col] = turn;
      at[row * FOUR_COLS + col] = k;
      turn = other(turn);
    });
    return at;
  }, [game]);
  const [aim, setAim] = useState<number | null>(null);
  const won = new Set(s.line || []);
  return (
    <div className="g4" style={{ '--me': myLook.ink } as React.CSSProperties}>
      <div className="g4-aim">
        {canAct && aim !== null && <span className="g4-ghost" style={{ left: `${((aim + 0.5) / FOUR_COLS) * 100}%` }} />}
      </div>
      <div className="g4-frame">
        {Array.from({ length: FOUR_COLS * FOUR_ROWS }, (_, cell) => {
          const row = Math.floor(cell / FOUR_COLS);
          const col = cell % FOUR_COLS;
          return <span key={cell} className="g4-hole" style={{ left: `${((col + 0.5) / FOUR_COLS) * 100}%`, top: `${((row + 0.5) / FOUR_ROWS) * 100}%` }} />;
        })}
        {s.grid.map((seat, cell) => {
          if (!seat) return null;
          const row = Math.floor(cell / FOUR_COLS);
          const col = cell % FOUR_COLS;
          const fresh = (moveAt[cell] ?? 0) >= seen;
          return (
            <span
              key={`${game.id}-${cell}`}
              className="g4-disc"
              data-fresh={fresh || undefined}
              data-won={won.has(cell) || undefined}
              data-last={cell === s.last && !s.over ? true : undefined}
              style={
                {
                  left: `${((col + 0.5) / FOUR_COLS) * 100}%`,
                  top: `${((row + 0.5) / FOUR_ROWS) * 100}%`,
                  '--ink': inkOf(seat),
                  '--drop': `${-50 - (row + 1.4) * 122}%`,
                  animationDuration: fresh ? `${fourFallMs(row)}ms` : undefined
                } as React.CSSProperties
              }
            />
          );
        })}
        <div className="g4-cols">
          {Array.from({ length: FOUR_COLS }, (_, col) => (
            <button
              key={col}
              type="button"
              className="g4-col"
              disabled={!canAct || landingRow(s.grid, col) < 0}
              onPointerEnter={() => setAim(col)}
              onPointerLeave={() => setAim(a => (a === col ? null : a))}
              onFocus={() => setAim(col)}
              onClick={() => {
                setAim(null);
                onMove(col);
              }}
              aria-label={tr('Column {n}', { n: col + 1 })}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// ------------------------------------------------------------ Memory Match

export const MemoryBoard: React.FC<BoardProps> = React.memo(({ game, inkOf, markOf, canAct, seen, onMove }) => {
  const tr = useT();
  const s = useMemo(() => playMemory(game), [game]);
  const missed = s.result === 'miss' && s.pending === null ? new Set(s.up) : new Set<number>();
  const justMatched = s.result === 'match' && s.pending === null && game.moves.length > seen ? new Set(s.pair) : new Set<number>();
  return (
    <div className="gm" data-cards={s.deck.length}>
      {s.deck.map((face, card) => {
        const owner = s.owner[card];
        const up = !!owner || s.up.includes(card);
        return (
          <button
            key={`${game.id}-${card}`}
            type="button"
            className="gm-card"
            data-up={up || undefined}
            data-owner={owner || undefined}
            data-missed={missed.has(card) || undefined}
            data-matched={justMatched.has(card) || undefined}
            disabled={!canAct || !!owner || card === s.pending}
            onClick={() => onMove(card)}
            style={owner ? ({ '--ink': inkOf(owner) } as React.CSSProperties) : undefined}
            aria-label={up ? MEMORY_FACES[face] : tr('Card {n}', { n: card + 1 })}
          >
            <span className="gm-inner">
              <span className="gm-back" aria-hidden="true">
                <svg viewBox="-13 -14 26 24">
                  <path d="M0,8 C-3,5 -12,0 -12,-6 C-12,-11 -8,-13 -5,-13 C-2.5,-13 -1,-11.5 0,-9.5 C1,-11.5 2.5,-13 5,-13 C8,-13 12,-11 12,-6 C12,0 3,5 0,8 Z" fill="rgb(255 255 255 / 0.85)" />
                </svg>
              </span>
              <span className="gm-face" aria-hidden="true">
                <span className="gm-emoji">{MEMORY_FACES[face]}</span>
                {owner && (
                  <span className="gm-badge">
                    <MarkIcon mark={markOf(owner)} ink={inkOf(owner)} size={14} />
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
});

// -------------------------------------------------------- Snakes & Ladders

/** The die tumbles this long; a counter hops a square in HOP_MS; a ladder or snake takes SLIDE_MS. */
export const ROLL_MS = 650;
export const HOP_MS = 150;
export const SLIDE_MS = 850;

/** Where a square is on the board, in % from its top left: 1 bottom left, back and forth to 100. */
function squareAt(n: number): { x: number; y: number } {
  if (n <= 0) return { x: 5, y: 105.5 };
  const r = Math.floor((n - 1) / 10);
  const c = r % 2 === 0 ? (n - 1) % 10 : 9 - ((n - 1) % 10);
  return { x: c * 10 + 5, y: (9 - r) * 10 + 5 };
}
const SQUARE_TINTS = ['#fde2e4', '#fff1c1', '#dcf3e6', '#dbe7ff', '#f1e2ff'];
const SNAKE_COLOURS = [['#16a34a', '#86efac'], ['#7c3aed', '#c4b5fd'], ['#ea580c', '#fdba74'], ['#db2777', '#f9a8d4'], ['#0891b2', '#67e8f9'], ['#ca8a04', '#fde047'], ['#4f46e5', '#a5b4fc'], ['#dc2626', '#fca5a5']];

/** The board itself - squares, ladders, snakes - drawn once. */
const SnakesArt: React.FC = React.memo(() => (
  <>
    <div className="gs-squares" aria-hidden="true">
      {Array.from({ length: 100 }, (_, i) => {
        // Drawn top row first: square 100 is at the top left.
        const row = Math.floor(i / 10);
        const col = i % 10;
        const r = 9 - row;
        const n = r * 10 + (r % 2 === 0 ? col + 1 : 10 - col);
        return (
          <span key={n} style={{ background: SQUARE_TINTS[(row + col) % SQUARE_TINTS.length] }}>
            <b>{n === 100 ? '👑' : n}</b>
          </span>
        );
      })}
    </div>
    <svg className="gs-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {Object.entries(LADDERS).map(([foot, top]) => {
        const a = squareAt(Number(foot));
        const b = squareAt(top);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const ux = (b.x - a.x) / len;
        const uy = (b.y - a.y) / len;
        const px = -uy * 2.1;
        const py = ux * 2.1;
        const rungs = Math.max(2, Math.floor(len / 4.2));
        return (
          <g key={foot} className="gs-ladder">
            <line x1={a.x + px} y1={a.y + py} x2={b.x + px} y2={b.y + py} />
            <line x1={a.x - px} y1={a.y - py} x2={b.x - px} y2={b.y - py} />
            {Array.from({ length: rungs }, (_, k) => {
              const t = (k + 0.6) / (rungs + 0.2);
              const cx = a.x + (b.x - a.x) * t;
              const cy = a.y + (b.y - a.y) * t;
              return <line key={k} x1={cx + px} y1={cy + py} x2={cx - px} y2={cy - py} className="gs-rung" />;
            })}
          </g>
        );
      })}
      {Object.entries(SNAKES).map(([head, tail], k) => {
        const a = squareAt(Number(head));
        const b = squareAt(tail);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        const nx = -dy / len;
        const ny = dx / len;
        const w = Math.min(9, len / 4) * (k % 2 ? 1 : -1);
        const d = `M${a.x},${a.y} C${a.x + dx * 0.3 + nx * w},${a.y + dy * 0.3 + ny * w} ${a.x + dx * 0.7 - nx * w},${a.y + dy * 0.7 - ny * w} ${b.x},${b.y}`;
        const [body, belly] = SNAKE_COLOURS[k % SNAKE_COLOURS.length];
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <g key={head} className="gs-snake">
            <path d={d} stroke={body} strokeWidth={3.6} />
            <path d={d} stroke={belly} strokeWidth={1.3} strokeDasharray="1.6 2.4" />
            <g transform={`translate(${a.x} ${a.y}) rotate(${ang - 90})`}>
              <path d="M0,-3.4 L-0.5,-5.2 M0,-3.4 L0.5,-5.2" stroke="#ef4444" strokeWidth={0.5} />
              <ellipse rx={2.6} ry={3.2} fill={body} />
              <circle cx={-1.1} cy={-1} r={0.85} fill="#fff" />
              <circle cx={1.1} cy={-1} r={0.85} fill="#fff" />
              <circle cx={-1.1} cy={-0.8} r={0.42} fill="#111" />
              <circle cx={1.1} cy={-0.8} r={0.42} fill="#111" />
            </g>
          </g>
        );
      })}
    </svg>
  </>
));

const randomRoll = () => {
  try {
    const a = new Uint8Array(1);
    // 252 is the largest multiple of 6 under 256: anything above is rolled again, so every face is as likely.
    do crypto.getRandomValues(a);
    while (a[0] >= 252);
    return (a[0] % 6) + 1;
  } catch {
    return 1 + Math.floor(Math.random() * 6);
  }
};

export const SnakesBoard: React.FC<BoardProps> = React.memo(({ game, me, inkOf, markOf, canAct, onMove, onSettled, partnerName }) => {
  const tr = useT();
  const final = useMemo(() => playSnakes(game), [game]);
  // The counters as shown: they catch up with the moves one roll at a time.
  const [shown, setShown] = useState<Record<Seat, number>>(final.pos);
  const [die, setDie] = useState<{ value: number; rolling: boolean; seat: Seat | null }>({ value: final.last?.roll || 6, rolling: false, seat: final.last?.seat || null });
  const [sliding, setSliding] = useState<Seat | null>(null);
  const [busy, setBusy] = useState(false);
  const shownCount = useRef(game.moves.length);
  const gameRef = useRef(game);
  gameRef.current = game;
  const idRef = useRef(game.id);
  const timers = useRef<number[]>([]);
  const running = useRef(false);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (idRef.current !== game.id) {
      // A new game: everything back to the start, at once.
      timers.current.forEach(clearTimeout);
      timers.current = [];
      running.current = false;
      idRef.current = game.id;
      shownCount.current = game.moves.length;
      setShown(playSnakes(game).pos);
      setSliding(null);
      setBusy(false);
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
      const step = playSnakes({ ...g, moves: g.moves.slice(0, k + 1) }).last;
      if (!step) {
        shownCount.current = k + 1;
        next();
        return;
      }
      const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
      // The die tumbles, showing faces at random, and lands.
      setDie({ value: step.roll, rolling: true, seat: step.seat });
      playSound('g-dice');
      at(ROLL_MS, () => setDie({ value: step.roll, rolling: false, seat: step.seat }));
      // Hop by hop to the square it landed on.
      const hops = step.landed - step.from;
      for (let i = 1; i <= hops; i++) {
        at(ROLL_MS + i * HOP_MS, () => {
          setShown(p => ({ ...p, [step.seat]: step.from + i }));
          playSound('g-hop', { rate: 0.92 + i * 0.035 });
        });
      }
      let end = ROLL_MS + hops * HOP_MS + 120;
      if (step.via) {
        at(end + 160, () => {
          setSliding(step.seat);
          setShown(p => ({ ...p, [step.seat]: step.to }));
          playSound(step.via === 'ladder' ? 'g-ladder' : 'g-snake');
        });
        end += 160 + SLIDE_MS;
      }
      at(end, () => {
        setSliding(null);
        shownCount.current = k + 1;
        next();
      });
    };
    if (game.moves.length < shownCount.current) {
      shownCount.current = game.moves.length;
      setShown(final.pos);
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
    // Any face but the one showing, so it visibly tumbles.
    const t = setInterval(() => setFace(f => ((f + Math.floor(Math.random() * 5)) % 6) + 1), 70);
    return () => clearInterval(t);
  }, [die]);

  const roll = () => {
    if (!canAct || busy) return;
    onMove(randomRoll());
  };

  const token = (seat: Seat) => {
    const p = squareAt(shown[seat]);
    const together = shown.user === shown.partner;
    const dx = together ? (seat === me ? -2.2 : 2.2) : 0;
    return (
      <span
        key={seat}
        className="gs-token"
        data-slide={sliding === seat || undefined}
        style={{ transform: `translate(${p.x + dx}%, ${p.y}%)`, '--ink': inkOf(seat) } as React.CSSProperties}
        aria-label={seat === me ? tr('You are on {n}', { n: shown[seat] }) : tr('{name} is on {n}', { name: partnerName, n: shown[seat] })}
      >
        <span className="gs-token-face">
          <MarkIcon mark={markOf(seat)} ink={inkOf(seat)} size={18} fill={0.35} />
        </span>
      </span>
    );
  };

  return (
    <div className="gs">
      <div className="gs-board">
        <SnakesArt />
        <div className="gs-tokens">
          {token(other(me))}
          {token(me)}
        </div>
      </div>
      <div className="gs-bar">
        <button type="button" className="g-die" data-rolling={die.rolling || undefined} onClick={roll} disabled={!canAct || busy} style={{ '--ink': die.seat ? inkOf(die.seat) : INK } as React.CSSProperties} aria-label={tr('Roll the die')}>
          <DieFace value={face} ink={die.seat ? inkOf(die.seat) : INK} />
        </button>
        <span className="gs-hint">{canAct && !busy ? tr('Tap the die to roll') : ''}</span>
      </div>
    </div>
  );
});
