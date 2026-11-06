import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Palette, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { useT } from '../core/i18n';
import { haptic } from '../core/haptics';
import { askConfirm } from '../core/dialog';
import { getAudioContext } from '../core/audioAlerts';
import { loadSounds, playSound, type SoundName } from '../core/sounds';
import { newId } from '../core/ids';
import type { Seat } from '../core/usTwo';
import {
  DEFAULT_DOTS,
  DEFAULT_MEMORY,
  FOUR_COLS,
  GAME_NAMES,
  INKS,
  MARKS,
  canMove,
  lookOf,
  newGame,
  other,
  playDots,
  playFour,
  playHhk,
  playMemory,
  playSnakes,
  sizesOf,
  standing,
  totals,
  withLook,
  withMove,
  type Mark,
  type PaperGame,
  type PaperKind
} from '../core/paperGames';
import { playCarrom } from '../core/carrom';
import { MarkIcon } from './gameArt';
import { DotsBoard, FourBoard, HhkBoard, MemoryBoard, SnakesBoard, TttBoard, fourFallMs, type BoardProps } from './GameBoards';
import { BalloonBoard } from './BalloonBoard';
import { CarromBoard } from './CarromBoard';

interface PaperGamesProps {
  kind: PaperKind;
  game?: PaperGame;
  activeUser: Seat;
  /** The other person's name, as this phone knows it. */
  partnerName: string;
  onChange: (game: PaperGame) => void;
  /** Back to all the games. */
  onBack?: () => void;
}

/** How each game is played, in a line. */
export const GAME_HOW: Record<PaperKind, string> = {
  balloon: 'Pull back, let go and allow for the wind. Soak the other one through to win. You each get one giant balloon.',
  carrom: 'Flick the striker to pot your coins. Win the Queen and cover her with a coin of yours. Clear your coins to win.',
  four: 'Drop a disc in turn. Four in a line - across, down or slanting - wins.',
  memory: 'Turn over two cards a turn. Find a pair to keep it - and go again.',
  hhk: 'You both choose at once. Hug holds Heart, Kiss wins Hug, Heart outlasts Kiss. First to three.',
  snakes: 'Roll and race to 100. Ladders take you up, snakes bring you down. A six rolls again.',
  ttt: 'Three in a row wins. Take turns - from wherever you both are.',
  dots: 'Take turns drawing a line. Close a box to claim it - and go again.'
};

/** The sounds each game makes, loaded when it opens. */
const SOUNDS_OF: Record<PaperKind, SoundName[]> = {
  balloon: ['g-wb-stretch', 'g-wb-throw', 'g-wb-burst', 'g-wb-giant', 'g-wb-splat', 'g-wb-hedge', 'g-wb-eek', 'g-wb-wind', 'us-shake'],
  carrom: ['g-cr-strike', 'g-cr-click', 'g-cr-wall', 'g-cr-pocket', 'g-cr-queen', 'g-cr-cover', 'g-cr-foul', 'g-cr-place', 'g-cr-back'],
  ttt: ['g-pen'],
  dots: ['g-chalk', 'g-box'],
  four: ['g-drop'],
  memory: ['g-flip', 'g-match', 'g-miss'],
  hhk: ['g-pick', 'g-reveal', 'g-point', 'g-miss'],
  snakes: ['g-dice', 'g-hop', 'g-ladder', 'g-snake']
};

/** A small picture of each game, for its card among the games and its empty board. */
export const GameIcon: React.FC<{ kind: PaperKind }> = ({ kind }) => {
  switch (kind) {
    case 'balloon':
      return (
        <svg viewBox="0 0 64 56" className="g-icon" aria-hidden="true">
          <path d="M6,50 C14,41 16,50 21,44 C27,37 30,47 35,43 C42,38 44,50 52,44 C56,41 58,46 60,50 Z" fill="#7cc8ff" />
          <g fill="#4da7ee">
            <circle cx={11} cy={37} r={2.4} />
            <circle cx={55} cy={33} r={2.8} />
            <circle cx={46} cy={24} r={1.8} />
            <circle cx={17} cy={25} r={1.7} />
          </g>
          <g transform="translate(31 22) rotate(-16)">
            <path d="M0,-18 C10,-18 16,-9 16,0 C16,10 7,16 0,16 C-7,16 -16,10 -16,0 C-16,-9 -10,-18 0,-18 Z" fill="#6dbff9" stroke="#3b2723" strokeWidth={2.6} strokeLinejoin="round" />
            <path d="M-3.5,16 L3.5,16 L0,21 Z" fill="#2b86d9" stroke="#3b2723" strokeWidth={2} strokeLinejoin="round" />
            <ellipse cx={-6} cy={-7} rx={3} ry={5.4} transform="rotate(20 -6 -7)" fill="#fff" opacity={0.78} />
          </g>
        </svg>
      );
    case 'carrom':
      return (
        <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
          <rect x={0} y={0} width={60} height={60} rx={8} fill="#4a2410" />
          <rect x={5} y={5} width={50} height={50} rx={2} fill="#efd8a6" />
          {[[9, 9], [51, 9], [9, 51], [51, 51]].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={3.8} fill="#1a0e07" />
          ))}
          <circle cx={30} cy={30} r={15} fill="none" stroke="#7a4a20" strokeWidth={1} />
          <circle cx={30} cy={30} r={4.2} fill="#e8213f" stroke="#ffd98a" strokeWidth={1} />
          {[[30, 21, 1], [37.8, 25.5, 0], [37.8, 34.5, 1], [30, 39, 0], [22.2, 34.5, 1], [22.2, 25.5, 0]].map(([x, y, w]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={4.2} fill={w ? '#fff8e6' : '#2a2830'} stroke={w ? '#b49a68' : '#000'} strokeWidth={0.8} />
          ))}
          <circle cx={30} cy={48} r={5.2} fill="#fff" stroke="#0ea5e9" strokeWidth={1.8} />
        </svg>
      );
    case 'four':
      return (
        <svg viewBox="0 0 64 56" className="g-icon" aria-hidden="true">
          <rect x={2} y={4} width={60} height={50} rx={9} fill="#3346c8" />
          {Array.from({ length: 12 }, (_, i) => {
            const c = i % 4;
            const r = Math.floor(i / 4);
            const red = r + c === 3;
            const gold = r === 2 && c < 2;
            return <circle key={i} cx={11 + c * 14} cy={15 + r * 14} r={5.6} fill={red ? '#f43f5e' : gold ? '#facc15' : '#1d2a8a'} />;
          })}
        </svg>
      );
    case 'memory':
      return (
        <span className="g-icon g-icon-memory" aria-hidden="true">
          <i>💖</i>
          <i />
        </span>
      );
    case 'hhk':
      return (
        <span className="g-icon g-icon-emoji" aria-hidden="true">
          ❤️🤗💋
        </span>
      );
    case 'snakes':
      return (
        <span className="g-icon g-icon-emoji" aria-hidden="true">
          🐍🎲
        </span>
      );
    case 'ttt':
      return (
        <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
          <rect x={0} y={0} width={60} height={60} rx={10} fill="#fbf6ec" />
          <path d="M21,8 V52 M39,8 V52 M8,21 H52 M8,39 H52" stroke="#3b2723" strokeOpacity={0.7} strokeWidth={2.6} strokeLinecap="round" />
          <path d="M9,9 L17,17 M17,9 L9,17" stroke="#0ea5e9" strokeWidth={3.2} strokeLinecap="round" />
          <path d="M30,34 C27,31 24,30 24,27.5 C24,25.5 26,24.5 27.5,24.5 C28.6,24.5 29.5,25.2 30,26 C30.5,25.2 31.4,24.5 32.5,24.5 C34,24.5 36,25.5 36,27.5 C36,30 33,31 30,34 Z" fill="#f43f5e" />
          <path d="M43,43 L51,51 M51,43 L43,51" stroke="#0ea5e9" strokeWidth={3.2} strokeLinecap="round" />
        </svg>
      );
    case 'dots':
      return (
        <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
          <rect x={0} y={0} width={60} height={60} rx={10} fill="#fbf6ec" />
          <rect x={12} y={12} width={18} height={18} fill="#f43f5e" opacity={0.25} />
          <path d="M10,10 H30 M10,10 V30" stroke="#0ea5e9" strokeWidth={3} strokeLinecap="round" />
          <path d="M30,10 V30 H10" stroke="#f43f5e" strokeWidth={3} strokeLinecap="round" />
          {Array.from({ length: 9 }, (_, k) => (
            <circle key={k} cx={10 + (k % 3) * 20} cy={10 + Math.floor(k / 3) * 20} r={3} fill="#3b2723" />
          ))}
        </svg>
      );
  }
};

const BOARDS: Record<PaperKind, React.FC<BoardProps>> = {
  balloon: BalloonBoard,
  carrom: CarromBoard,
  ttt: TttBoard,
  dots: DotsBoard,
  four: FourBoard,
  memory: MemoryBoard,
  hhk: HhkBoard,
  snakes: SnakesBoard
};

/** How far into a game it is: moves, or both of your picks. */
const progressOf = (g?: PaperGame) => (!g ? 0 : g.kind === 'hhk' ? (g.picks?.user.length || 0) + (g.picks?.partner.length || 0) : g.moves.length);

const CONFETTI_COUNT = 36;

/**
 * One game on Canvas of Us (core/paperGames): the players and the score
 * between you, whose turn it is, the board (components/GameBoards), and a
 * new game when this one is done. Moves travel to the other phone the
 * moment they are made; each lands with its own sound on both phones.
 */
export const PaperGames: React.FC<PaperGamesProps> = ({ kind, game, activeUser, partnerName, onChange, onBack }) => {
  const tr = useT();
  const me = activeUser;
  const them = other(me);
  const [size, setSize] = useState<number>(game?.size ?? (kind === 'memory' ? DEFAULT_MEMORY : DEFAULT_DOTS));
  const [picking, setPicking] = useState(false);
  const [party, setParty] = useState<{ key: number; inks: string[]; sad: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => loadSounds([...SOUNDS_OF[kind], 'g-win', 'g-lose', 'g-tie', 'g-start', 'g-turn']), [kind]);

  // What was on the board when it was opened is shown as it is; only what
  // is played after is drawn in.
  const seen = useRef<{ id?: string; count: number }>({ id: game?.id, count: progressOf(game) });
  if (game && seen.current.id !== game.id) seen.current = { id: game.id, count: 0 };

  const myLook = lookOf(game, me);
  const theirLook = lookOf(game, them);
  const inkOf = (seat: Seat) => (seat === me ? myLook.ink : theirLook.ink);
  const markOf = (seat: Seat) => (seat === me ? myLook.mark : theirLook.mark);
  const nameOf = (seat: Seat) => (seat === me ? tr('You') : partnerName);

  // The games with a shot to watch: the words round the board wait for it to land, so
  // they never tell you how it went before you have seen it.
  const watches = kind === 'balloon' || kind === 'carrom';
  const [settled, setSettled] = useState(game?.moves.length ?? 0);
  const landing = watches && !!game && settled < game.moves.length;
  const shownGame = useMemo(() => (game && landing ? { ...game, moves: game.moves.slice(0, settled) } : game), [game, landing, settled]);

  const st = shownGame ? standing(shownGame) : null;
  const score = shownGame ? totals(shownGame) : { user: 0, partner: 0, draws: 0 };
  const canAct = !!st && !st.over && st.toMove.includes(me) && !landing;

  /** The end of a game: a fanfare and confetti for a win, an "aww" for a loss, chimes for a tie. */
  const celebrated = useRef<string | null>(game && st?.over ? game.id : null);
  const celebrate = (g: PaperGame) => {
    if (celebrated.current === g.id) return;
    celebrated.current = g.id;
    const s = standing(g);
    if (s.winner === me) {
      playSound('g-win');
      haptic('confirm');
      setParty({ key: Date.now(), inks: [myLook.ink, '#ffd23f', '#ffffff'], sad: false });
    } else if (s.winner) {
      playSound('g-lose');
      haptic('tick');
      setParty({ key: Date.now(), inks: [theirLook.ink, '#ffd23f'], sad: true });
    } else {
      playSound('g-tie');
      haptic('tick');
      setParty({ key: Date.now(), inks: [myLook.ink, theirLook.ink, '#ffd23f'], sad: false });
    }
  };
  useEffect(() => {
    if (!party) return;
    const t = setTimeout(() => setParty(null), 2800);
    return () => clearTimeout(t);
  }, [party]);

  // Snakes & Ladders ends when the winner's counter gets there, not when the die stops;
  // Water Balloon War and Carrom when the last of it has landed.
  useEffect(() => {
    if ((kind === 'snakes' || watches) && game && st?.over && settled >= game.moves.length) celebrate(game);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, game]);

  // Each move as it lands, from either of you: its sound, and at the end the celebration.
  const last = useRef({ id: game?.id, n: progressOf(game), over: st?.over ?? false, mine: 0, theirs: 0, rounds: 0 });
  useEffect(() => {
    if (!game || !st) return;
    const before = last.current;
    const hhk = game.kind === 'hhk' ? playHhk(game) : null;
    const now = {
      id: game.id,
      n: progressOf(game),
      over: st.over,
      mine: game.picks?.[me].length || 0,
      theirs: game.picks?.[them].length || 0,
      rounds: hhk?.rounds.length || 0
    };
    last.current = now;
    if (before.id !== game.id) {
      // A new game, from either of you.
      if (before.id !== undefined && now.n === 0) playSound('g-start');
      return;
    }
    if (now.n <= before.n) return;
    let end = 400;
    switch (game.kind) {
      case 'ttt':
        playSound('g-pen', { rate: 0.92 + Math.random() * 0.16 });
        end = 450;
        break;
      case 'dots':
        playSound(playDots(game).closed.length ? 'g-box' : 'g-chalk', { rate: 0.94 + Math.random() * 0.12 });
        end = 550;
        break;
      case 'four': {
        const s = playFour(game);
        const row = s.last !== null ? Math.floor(s.last / FOUR_COLS) : 0;
        // The clack lands with the disc.
        later(Math.max(0, fourFallMs(row) - 100), () => playSound('g-drop', { rate: 1.06 - row * 0.03 }));
        end = fourFallMs(row) + 350;
        break;
      }
      case 'memory': {
        const s = playMemory(game);
        playSound('g-flip', { rate: 0.95 + Math.random() * 0.1 });
        if (s.pending === null && s.result) later(s.result === 'match' ? 380 : 480, () => playSound(s.result === 'match' ? 'g-match' : 'g-miss'));
        end = 1100;
        break;
      }
      case 'hhk': {
        if (now.rounds > before.rounds && hhk) {
          // Both have chosen: the drum roll, the reveal, and who took the round.
          const round = hhk.rounds[hhk.rounds.length - 1];
          playSound('g-reveal');
          later(700, () => playSound(round.winner === me ? 'g-point' : round.winner ? 'g-miss' : 'g-tie'));
          end = 1500;
        } else if (now.mine > before.mine) {
          playSound('g-pick');
        } else if (now.theirs > before.theirs) {
          // They have chosen and you have not: a nudge.
          playSound('g-turn');
        }
        break;
      }
      case 'snakes':
      case 'balloon':
      case 'carrom':
        // Their boards play it all out, with their sounds, and say when they are done.
        return;
    }
    if (st.over && !before.over) later(end, () => celebrate(game));
    // Only when the game itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  const move = (m: number) => {
    if (!game || !canMove(game, me, m)) return;
    getAudioContext();
    haptic('tick');
    onChange(withMove(game, m, me));
  };

  const start = async () => {
    if (game && st && !st.over && progressOf(game) > 0) {
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
    if (!game) playSound('g-start');
  };

  const pickLook = (look: { ink?: string; mark?: Mark }) => {
    if (!game) return;
    haptic('tick');
    onChange(withLook(game, me, look, Date.now()));
  };

  // ---------------------------------------------------------- around it

  const detail = (seat: Seat): string | null => {
    if (kind === 'carrom' && shownGame && !st?.over) {
      const c = playCarrom(shownGame);
      return `${tr(c.colour[seat] === 'white' ? 'White' : 'Black')} · ${tr('{n} left', { n: c.left[seat] })}`;
    }
    if (!game || st?.over || progressOf(game) === 0) return null;
    if (kind === 'dots') {
      const n = playDots(game).scores[seat];
      return tr(n === 1 ? '{n} box' : '{n} boxes', { n });
    }
    if (kind === 'memory') {
      const n = playMemory(game).scores[seat];
      return tr(n === 1 ? '{n} pair' : '{n} pairs', { n });
    }
    if (kind === 'snakes') {
      const n = playSnakes(game).pos[seat];
      return n ? tr('on {n}', { n }) : tr('at the start');
    }
    return null;
  };

  const chip = (seat: Seat) => {
    const turn = !!st && !st.over && st.toMove.includes(seat) && kind !== 'hhk';
    const won = !!st?.over && st.winner === seat;
    const extra = detail(seat);
    return (
      <div className="pg-chip" data-turn={turn || undefined} data-won={won || undefined} style={{ '--ink': inkOf(seat) } as React.CSSProperties}>
        <span className="pg-chip-mark">
          <MarkIcon mark={markOf(seat)} ink={inkOf(seat)} size={26} />
        </span>
        <span className="pg-chip-name">{nameOf(seat)}</span>
        <span className="pg-chip-score" aria-label={tr(score[seat] === 1 ? '{n} win' : '{n} wins', { n: score[seat] })}>
          {score[seat]}
        </span>
        {extra && <span className="pg-chip-boxes">{extra}</span>}
      </div>
    );
  };

  let status: React.ReactNode = null;
  const mePill = (text: string) => (
    <span className="pg-status-me" style={{ '--ink': myLook.ink } as React.CSSProperties}>
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      {text}
    </span>
  );
  const waiting = (text: string) => (
    <span className="pg-status-wait">
      {text}
      <span className="pg-dots-wait" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
  if (!game || !st) status = tr('Who will win this one?');
  else if (st.over) {
    status = st.winner ? (
      <span className="pg-status-win">
        <Trophy className="h-4 w-4" aria-hidden="true" />
        {st.winner === me ? tr('You win!') : tr('{name} wins!', { name: partnerName })}
      </span>
    ) : (
      tr("It's a tie!")
    );
  } else if (kind === 'hhk') {
    const meToo = st.toMove.includes(me);
    const themToo = st.toMove.includes(them);
    status =
      meToo && themToo
        ? mePill(tr('Choose one!'))
        : meToo
          ? mePill(tr('{name} has chosen - your pick!', { name: partnerName }))
          : waiting(tr('Waiting for {name} to choose', { name: partnerName }));
  } else if (landing) {
    status = waiting(tr('Here it goes'));
  } else if (canAct) {
    const pending = kind === 'memory' && playMemory(game).pending !== null;
    status = mePill(
      st.again
        ? kind === 'dots'
          ? tr('A box! Go again')
          : kind === 'memory'
            ? tr('A pair! Go again')
            : kind === 'carrom'
              ? playCarrom(game).queen === 'pending'
                ? tr('Now cover the Queen!')
                : tr('Go again!')
              : tr('A six! Roll again')
        : pending
          ? tr('Now find its pair')
          : kind === 'snakes'
            ? tr('Your roll')
            : kind === 'balloon'
              ? tr('Your throw')
              : kind === 'carrom'
                ? tr('Your shot')
                : tr('Your turn')
    );
  } else {
    status = waiting(tr("{name}'s turn", { name: partnerName }));
  }

  const sizes = sizesOf(kind);
  const sizePicker = sizes && (!game || st?.over) && (
    <div className="pg-sizes" role="radiogroup" aria-label={tr('Board size')}>
      {sizes.map(n => (
        <button key={n} type="button" role="radio" aria-checked={size === n} data-on={size === n || undefined} onClick={() => setSize(n)}>
          {kind === 'memory' ? tr('{n} cards', { n: n * 2 }) : `${n}×${n}`}
        </button>
      ))}
    </div>
  );

  const Board = BOARDS[kind];

  return (
    <section className="pg" data-kind={kind} style={{ '--me': myLook.ink, '--them': theirLook.ink } as React.CSSProperties}>
      <div className="pg-head">
        {onBack && (
          <button type="button" className="pg-back" onClick={onBack} aria-label={tr('All games')}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <h3 className="pg-title">{tr(GAME_NAMES[kind])}</h3>
      </div>

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
          <Board
            game={game}
            me={me}
            inkOf={inkOf}
            markOf={markOf}
            myLook={myLook}
            canAct={canAct}
            seen={seen.current.count}
            onMove={move}
            partnerName={partnerName}
            onSettled={setSettled}
          />
        ) : (
          <div className="pg-empty">
            <div className="pg-empty-art">
              <GameIcon kind={kind} />
            </div>
            <p className="pg-empty-text">{tr(GAME_HOW[kind])}</p>
          </div>
        )}
        {party && (
          <div className="pg-party" data-sad={party.sad || undefined} key={party.key} aria-hidden="true">
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
        {sizePicker}
        {!game || st?.over ? (
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
            {tr('Colour & mark')}
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
        </div>
      )}
    </section>
  );
};
