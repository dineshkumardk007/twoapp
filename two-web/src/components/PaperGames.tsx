import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Palette, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { useT } from '../core/i18n';
import { haptic } from '../core/haptics';
import { askConfirm } from '../core/dialog';
import { getAudioContext } from '../core/audioAlerts';
import { loadSounds, playOneOf, playSound } from '../core/sounds';
import { newId } from '../core/ids';
import type { Seat } from '../core/usTwo';
import {
  DEFAULT_DOTS,
  DOT_SIZES,
  INKS,
  MARKS,
  canMove,
  lineAt,
  lookOf,
  newGame,
  other,
  playDots,
  playTtt,
  standing,
  totals,
  withLook,
  withMove,
  type Mark,
  type PaperGame,
  type PaperKind
} from '../core/paperGames';

interface PaperGamesProps {
  kind: PaperKind;
  game?: PaperGame;
  activeUser: Seat;
  /** The other person's name, as this phone knows it. */
  partnerName: string;
  onChange: (game: PaperGame) => void;
}

const INK = '#3b2723';

/** Each mark as strokes around (0, 0), about 56 across: drawn as if by pen. */
function starPath(): string {
  let d = '';
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 12 : 28;
    const a = ((-90 + k * 36) * Math.PI) / 180;
    d += `${k ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)} `;
  }
  return d + 'Z';
}
function flowerPath(): string {
  let d = '';
  for (let k = 0; k < 5; k++) {
    const a = ((-90 + k * 72) * Math.PI) / 180;
    const cx = 15 * Math.cos(a);
    const cy = 15 * Math.sin(a);
    d += `M${(cx + 11).toFixed(1)},${cy.toFixed(1)} A11,11 0 1 1 ${(cx - 11).toFixed(1)},${cy.toFixed(1)} A11,11 0 1 1 ${(cx + 11).toFixed(1)},${cy.toFixed(1)} `;
  }
  return d + 'M6,0 A6,6 0 1 1 -6,0 A6,6 0 1 1 6,0';
}
const MARK_PATHS: Record<Mark, { strokes: string[]; filled: boolean }> = {
  x: { strokes: ['M-23,-23 L23,23', 'M23,-23 L-23,23'], filled: false },
  o: { strokes: ['M0,-25 A25,25 0 1 1 0,25 A25,25 0 1 1 0,-25'], filled: false },
  heart: {
    strokes: ['M0,24 C-10,15 -28,4 -28,-10 C-28,-21 -19,-27 -11,-27 C-5,-27 -1,-23 0,-18 C1,-23 5,-27 11,-27 C19,-27 28,-21 28,-10 C28,4 10,15 0,24 Z'],
    filled: true
  },
  star: { strokes: [starPath()], filled: true },
  moon: { strokes: ['M8,-27 A27,27 0 1 0 27,8 A21,21 0 1 1 8,-27 Z'], filled: true },
  flower: { strokes: [flowerPath()], filled: true }
};

/** A mark in a player's ink: drawn stroke by stroke when new, as it is when not. */
const MarkGlyph: React.FC<{ mark: Mark; ink: string; x: number; y: number; s?: number; fresh: boolean; width?: number; delay?: number; cls?: string }> = ({
  mark,
  ink,
  x,
  y,
  s = 1,
  fresh,
  width = 8,
  delay = 0,
  cls = ''
}) => {
  const look = MARK_PATHS[mark];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={`pg-mark ${cls}`} data-fresh={fresh || undefined}>
        {look.filled && <path d={look.strokes.join(' ')} fill={ink} className="pg-fill" style={{ animationDelay: `${delay + 260}ms` }} />}
        {look.strokes.map((d, i) => (
          <path
            key={i}
            d={d}
            pathLength={1}
            fill="none"
            stroke={ink}
            strokeWidth={width / s}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pg-ink"
            style={{ animationDelay: `${delay + i * 180}ms` }}
          />
        ))}
      </g>
    </g>
  );
};

/** A swatch of a mark, for the picker and the score chips. */
const MarkIcon: React.FC<{ mark: Mark; ink: string; size?: number }> = ({ mark, ink, size = 22 }) => (
  <svg viewBox="-34 -34 68 68" width={size} height={size} aria-hidden="true" focusable="false">
    <MarkGlyph mark={mark} ink={ink} x={0} y={0} fresh={false} width={9} />
  </svg>
);

/** The hand-drawn grid: four lines, each a little off true. */
const TTT_GRID = [
  'M100,14 C97,90 103,205 99,286',
  'M201,12 C204,100 198,190 202,288',
  'M14,101 C90,98 205,104 286,99',
  'M12,200 C100,203 190,197 288,202'
];

const CONFETTI_COUNT = 36;

/**
 * Tic-tac-toe and Dots and Boxes on Canvas of Us (core/paperGames): the
 * board, whose turn it is, the score between you, and your own ink and
 * mark. Moves travel to the other phone the moment they are made.
 */
export const PaperGames: React.FC<PaperGamesProps> = ({ kind, game, activeUser, partnerName, onChange }) => {
  const tr = useT();
  const me = activeUser;
  const them = other(me);
  const [size, setSize] = useState<number>(game?.kind === 'dots' ? game.size : DEFAULT_DOTS);
  const [picking, setPicking] = useState(false);
  const [party, setParty] = useState<{ key: number; inks: string[] } | null>(null);

  useEffect(() => loadSounds(['sketch-1', 'sketch-2', 'sketch-3', 'blossom-pop', 'party-pop', 'gentle-chime']), []);

  // What was on the board when it was opened is shown as it is; only moves
  // made since are drawn in.
  const seen = useRef<{ id?: string; count: number }>({ id: game?.id, count: game?.moves.length ?? 0 });
  if (game && seen.current.id !== game.id) seen.current = { id: game.id, count: 0 };

  const myLook = lookOf(game, me);
  const theirLook = lookOf(game, them);
  const inkOf = (seat: Seat) => (seat === me ? myLook.ink : theirLook.ink);
  const markOf = (seat: Seat) => (seat === me ? myLook.mark : theirLook.mark);
  const nameOf = (seat: Seat) => (seat === me ? tr('You') : partnerName);

  const ttt = useMemo(() => (game?.kind === 'ttt' ? playTtt(game) : null), [game]);
  const dots = useMemo(() => (game?.kind === 'dots' ? playDots(game) : null), [game]);
  /** Dots and Boxes: the move that closed each box, so only boxes closed since opening are drawn in. */
  const closedAt = useMemo(() => {
    const at: number[] = [];
    if (game?.kind !== 'dots') return at;
    for (let k = 0; k < game.moves.length; k++) {
      for (const b of playDots({ ...game, moves: game.moves.slice(0, k + 1) }).closed) at[b] = k;
    }
    return at;
  }, [game]);
  const state = game ? standing(game) : null;
  const score = game ? totals(game) : { user: 0, partner: 0, draws: 0 };
  const myTurn = !!state && !state.over && state.turn === me;

  // Each move as it lands, from either of you: its sound, and at the end
  // confetti in the winner's ink (or both, for a tie).
  const last = useRef({ id: game?.id, n: game?.moves.length ?? 0, over: state?.over ?? false });
  useEffect(() => {
    if (!game || !state) return;
    const before = last.current;
    last.current = { id: game.id, n: game.moves.length, over: state.over };
    if (before.id !== game.id || game.moves.length <= before.n) return;
    if (dots && dots.closed.length) playSound('blossom-pop', { gain: 0.8 });
    else playOneOf(['sketch-1', 'sketch-2', 'sketch-3'], { rate: 0.9 + Math.random() * 0.2 });
    if (state.over && !before.over) {
      const inks = state.winner ? [inkOf(state.winner), '#ffd23f', '#ffffff'] : [myLook.ink, theirLook.ink, '#ffd23f'];
      setTimeout(() => {
        setParty({ key: Date.now(), inks });
        playSound(state.winner ? 'party-pop' : 'gentle-chime');
        haptic('confirm');
      }, 350);
    }
    // Only when the game itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);
  useEffect(() => {
    if (!party) return;
    const t = setTimeout(() => setParty(null), 2800);
    return () => clearTimeout(t);
  }, [party]);

  const move = (m: number) => {
    if (!game || !canMove(game, me, m)) return;
    getAudioContext();
    haptic('tick');
    onChange(withMove(game, m));
  };

  const start = async () => {
    if (game && state && !state.over && game.moves.length > 0) {
      const sure = await askConfirm({
        title: tr('Start a new game?'),
        body: tr('This one will not count.'),
        confirm: tr('New game')
      });
      if (!sure) return;
    }
    getAudioContext();
    haptic('confirm');
    onChange(newGame(kind, game, me, newId('game'), Date.now(), size));
  };

  const pickLook = (look: { ink?: string; mark?: Mark }) => {
    if (!game) return;
    haptic('tick');
    onChange(withLook(game, me, look, Date.now()));
  };

  // ------------------------------------------------------------- the board

  const tttBoard = game && ttt && (
    <div className="pg-board pg-ttt">
      <svg viewBox="0 0 300 300" className="pg-svg" aria-hidden="true" focusable="false">
        {TTT_GRID.map((d, i) => (
          <path
            key={`${game.id}-${i}`}
            d={d}
            pathLength={1}
            className="pg-ink pg-grid"
            data-fresh={seen.current.count === 0 || undefined}
            style={{ animationDelay: `${i * 110}ms` }}
          />
        ))}
        {ttt.board.map((seat, cell) => {
          if (!seat) return null;
          const index = game.moves.indexOf(cell);
          const won = !!ttt.line?.includes(cell);
          return (
            <MarkGlyph
              key={`${game.id}-${cell}`}
              mark={markOf(seat)}
              ink={inkOf(seat)}
              x={(cell % 3) * 100 + 50}
              y={Math.floor(cell / 3) * 100 + 50}
              fresh={index >= seen.current.count}
              cls={`${won ? 'pg-won' : ''} ${index === game.moves.length - 1 && !won ? 'pg-latest' : ''}`}
            />
          );
        })}
        {ttt.line && ttt.winner && (() => {
          const a = ttt.line[0];
          const b = ttt.line[2];
          const ax = (a % 3) * 100 + 50;
          const ay = Math.floor(a / 3) * 100 + 50;
          const bx = (b % 3) * 100 + 50;
          const by = Math.floor(b / 3) * 100 + 50;
          // Run a little past the end marks, as a pen stroke would.
          const dx = (bx - ax) * 0.16;
          const dy = (by - ay) * 0.16;
          return (
            <path
              d={`M${ax - dx},${ay - dy} L${bx + dx},${by + dy}`}
              pathLength={1}
              stroke={inkOf(ttt.winner)}
              strokeWidth={11}
              strokeLinecap="round"
              fill="none"
              className="pg-ink pg-winline"
              data-fresh={game.moves.length > seen.current.count || undefined}
            />
          );
        })()}
      </svg>
      <div className="pg-cells">
        {ttt.board.map((seat, cell) => (
          <button
            key={cell}
            type="button"
            className="pg-cell"
            disabled={!myTurn || !!seat}
            onClick={() => move(cell)}
            style={{ '--ink': myLook.ink } as React.CSSProperties}
            aria-label={tr('Row {r}, column {c}', { r: Math.floor(cell / 3) + 1, c: (cell % 3) + 1 })}
          >
            {!seat && myTurn && (
              <svg viewBox="-34 -34 68 68" className="pg-ghost" aria-hidden="true" focusable="false">
                <MarkGlyph mark={myLook.mark} ink={myLook.ink} x={0} y={0} fresh={false} width={8} />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const S = 60;
  const P = 22;
  const dotsBoard = game && dots && (() => {
    const n = game.size;
    const W = n * S + 2 * P;
    const lastLine = game.moves[game.moves.length - 1];
    const ends = (i: number) => {
      const { row, col, across } = lineAt(n, i);
      const x1 = P + col * S;
      const y1 = P + row * S;
      return { x1, y1, x2: across ? x1 + S : x1, y2: across ? y1 : y1 + S, across, row, col };
    };
    return (
      <div className="pg-board pg-dots">
        <svg viewBox={`0 0 ${W} ${W}`} className="pg-svg">
          {dots.boxes.map((seat, b) => {
            if (!seat) return null;
            const row = Math.floor(b / n);
            const col = b % n;
            const fresh = (closedAt[b] ?? 0) >= seen.current.count;
            return (
              <g key={`${game.id}-b${b}`} className="pg-box" data-fresh={fresh || undefined}>
                <rect x={P + col * S + 5} y={P + row * S + 5} width={S - 10} height={S - 10} rx={9} fill={inkOf(seat)} opacity={0.24} />
                <MarkGlyph mark={markOf(seat)} ink={inkOf(seat)} x={P + col * S + S / 2} y={P + row * S + S / 2} s={0.5} fresh={fresh} width={4.5} delay={120} />
              </g>
            );
          })}
          {dots.lines.map((seat, i) => {
            if (!seat) return null;
            const e = ends(i);
            const index = game.moves.indexOf(i);
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
                className={`pg-ink pg-line ${i === lastLine && !dots.over ? 'pg-latest-line' : ''}`}
                data-fresh={index >= seen.current.count || undefined}
              />
            );
          })}
          {myTurn &&
            dots.lines.map((seat, i) => {
              if (seat) return null;
              const e = ends(i);
              const hit = e.across
                ? { x: e.x1 + 8, y: e.y1 - 16, width: S - 16, height: 32 }
                : { x: e.x1 - 16, y: e.y1 + 8, width: 32, height: S - 16 };
              return (
                <g
                  key={`s${i}`}
                  className="pg-slot"
                  data-line={i}
                  role="button"
                  tabIndex={0}
                  aria-label={tr('Draw this line')}
                  onClick={() => move(i)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      move(i);
                    }
                  }}
                >
                  <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={myLook.ink} strokeWidth={7} strokeLinecap="round" className="pg-preview" />
                  <rect {...hit} fill="transparent" />
                </g>
              );
            })}
          {Array.from({ length: (n + 1) * (n + 1) }, (_, k) => (
            <circle key={k} cx={P + (k % (n + 1)) * S} cy={P + Math.floor(k / (n + 1)) * S} r={5.5} fill={INK} className="pg-dot" />
          ))}
        </svg>
      </div>
    );
  })();

  // ---------------------------------------------------------- around it

  const chip = (seat: Seat) => {
    const turn = !!state && !state.over && state.turn === seat;
    const won = !!state?.over && state.winner === seat;
    return (
      <div className="pg-chip" data-turn={turn || undefined} data-won={won || undefined} style={{ '--ink': inkOf(seat) } as React.CSSProperties}>
        <span className="pg-chip-mark">
          <MarkIcon mark={markOf(seat)} ink={inkOf(seat)} size={26} />
        </span>
        <span className="pg-chip-name">{nameOf(seat)}</span>
        <span className="pg-chip-score" aria-label={tr(score[seat] === 1 ? '{n} win' : '{n} wins', { n: score[seat] })}>
          {score[seat]}
        </span>
        {kind === 'dots' && dots && !dots.over && game && game.moves.length > 0 && (
          <span className="pg-chip-boxes">{tr(dots.scores[seat] === 1 ? '{n} box' : '{n} boxes', { n: dots.scores[seat] })}</span>
        )}
      </div>
    );
  };

  let status: React.ReactNode = null;
  if (!game || !state) status = tr('Who will win this one?');
  else if (state.over) {
    status = state.winner ? (
      <span className="pg-status-win">
        <Trophy className="h-4 w-4" aria-hidden="true" />
        {state.winner === me ? tr('You win!') : tr('{name} wins!', { name: partnerName })}
      </span>
    ) : (
      tr("It's a tie!")
    );
  } else if (myTurn) {
    // The last move closed a box and the turn stayed: it was this player's.
    const again = kind === 'dots' && !!dots && dots.closed.length > 0;
    status = (
      <span className="pg-status-me" style={{ '--ink': myLook.ink } as React.CSSProperties}>
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {again ? tr('A box! Go again') : tr('Your turn')}
      </span>
    );
  } else {
    status = (
      <span className="pg-status-wait">
        {tr("{name}'s turn", { name: partnerName })}
        <span className="pg-dots-wait" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </span>
    );
  }

  const sizes = kind === 'dots' && (!game || state?.over) && (
    <div className="pg-sizes" role="radiogroup" aria-label={tr('Board size')}>
      {DOT_SIZES.map(n => (
        <button key={n} type="button" role="radio" aria-checked={size === n} data-on={size === n || undefined} onClick={() => setSize(n)}>
          {n}×{n}
        </button>
      ))}
    </div>
  );

  return (
    <section className="pg" data-kind={kind} style={{ '--me': myLook.ink, '--them': theirLook.ink } as React.CSSProperties}>
      <div className="pg-players">
        {chip(me)}
        <span className="pg-vs" aria-hidden="true">
          vs
          {score.draws > 0 && <small>{tr(score.draws === 1 ? '{n} tie' : '{n} ties', { n: score.draws })}</small>}
        </span>
        {chip(them)}
      </div>

      <p className="pg-status" aria-live="polite">
        {status}
      </p>

      <div className="pg-stage">
        {game ? (
          kind === 'ttt' ? tttBoard : dotsBoard
        ) : (
          <div className="pg-empty">
            <div className="pg-empty-art" aria-hidden="true">
              {kind === 'ttt' ? (
                <svg viewBox="0 0 300 300">
                  {TTT_GRID.map((d, i) => (
                    <path key={i} d={d} className="pg-ink pg-grid" />
                  ))}
                  <MarkGlyph mark={myLook.mark} ink={myLook.ink} x={50} y={50} fresh={false} />
                  <MarkGlyph mark={theirLook.mark} ink={theirLook.ink} x={150} y={150} fresh={false} />
                  <MarkGlyph mark={myLook.mark} ink={myLook.ink} x={250} y={250} fresh={false} />
                </svg>
              ) : (
                <svg viewBox="0 0 228 228">
                  <line x1={22} y1={22} x2={82} y2={22} stroke={myLook.ink} strokeWidth={7} strokeLinecap="round" />
                  <line x1={22} y1={22} x2={22} y2={82} stroke={theirLook.ink} strokeWidth={7} strokeLinecap="round" />
                  <line x1={82} y1={22} x2={82} y2={82} stroke={myLook.ink} strokeWidth={7} strokeLinecap="round" />
                  <line x1={22} y1={82} x2={82} y2={82} stroke={theirLook.ink} strokeWidth={7} strokeLinecap="round" />
                  <rect x={27} y={27} width={50} height={50} rx={9} fill={theirLook.ink} opacity={0.24} />
                  {Array.from({ length: 16 }, (_, k) => (
                    <circle key={k} cx={22 + (k % 4) * 60} cy={22 + Math.floor(k / 4) * 60} r={5.5} fill={INK} />
                  ))}
                </svg>
              )}
            </div>
            <p className="pg-empty-text">
              {kind === 'ttt'
                ? tr('Three in a row wins. Take turns - from wherever you both are.')
                : tr('Take turns drawing a line. Close a box to claim it - and go again.')}
            </p>
          </div>
        )}
        {party && (
          <div className="pg-party" key={party.key} aria-hidden="true">
            {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
              <i
                key={i}
                style={
                  {
                    background: party.inks[i % party.inks.length],
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
        )}
      </div>

      <div className="pg-actions">
        {sizes}
        {!game || state?.over ? (
          <button type="button" className="pg-play" onClick={() => void start()}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {game ? tr('Play again') : tr('Start a game')}
          </button>
        ) : (
          <button type="button" className="pg-restart" onClick={() => void start()}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {tr('New game')}
          </button>
        )}
        {game && (
          <button type="button" className="pg-restart" onClick={() => setPicking(p => !p)} aria-expanded={picking}>
            <Palette className="h-3.5 w-3.5" aria-hidden="true" />
            {kind === 'ttt' ? tr('Colour & mark') : tr('Colour')}
          </button>
        )}
      </div>

      {game && picking && (
        <div className="pg-picker">
          <p>{tr('Your colour')}</p>
          <div className="pg-swatches">
            {INKS.map(ink => {
              const taken = ink === theirLook.ink;
              return (
                <button
                  key={ink}
                  type="button"
                  className="pg-swatch"
                  style={{ background: ink }}
                  data-on={ink === myLook.ink || undefined}
                  disabled={taken}
                  onClick={() => pickLook({ ink })}
                  aria-label={taken ? tr('{name} has this one', { name: partnerName }) : tr('Use this colour')}
                />
              );
            })}
          </div>
          {kind === 'ttt' && (
            <>
              <p>{tr('Your mark')}</p>
              <div className="pg-swatches">
                {MARKS.map(mark => {
                  const taken = mark === theirLook.mark;
                  return (
                    <button
                      key={mark}
                      type="button"
                      className="pg-markpick"
                      data-on={mark === myLook.mark || undefined}
                      disabled={taken}
                      onClick={() => pickLook({ mark })}
                      aria-label={taken ? tr('{name} has this one', { name: partnerName }) : tr('Use this mark')}
                    >
                      <MarkIcon mark={mark} ink={taken ? '#b8aca4' : myLook.ink} size={28} />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};
