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
  askRestart,
  cancelRestart,
  canMove,
  declineRestart,
  lookOf,
  newGame,
  openAsk,
  other,
  progressOf,
  refusedOf,
  playDots,
  playFour,
  playMemory,
  playSnakes,
  sizesOf,
  standing,
  totals,
  withLook,
  withMove,
  type Mark,
  type PaperGame,
  type PaperKind,
  atRound,
  isNewerKind,
  isPickKind,
  roundsOf
} from '../core/paperGames';
import { carromId, playCarrom } from '../core/carrom';
import { markTourSeen, tourSeen } from '../core/gameTours';
import { MarkIcon } from './gameArt';
import { DotsBoard, FourBoard, MemoryBoard, SnakesBoard, TttBoard, fourFallMs, type BoardProps } from './GameBoards';
import { RpsBoard, RpsIcon } from './RpsBoard';
import { BalloonBoard } from './BalloonBoard';
import { BoxingBoard } from './BoxingBoard';
import { CarromBoard } from './CarromBoard';
import { PenaltyBoard } from './PenaltyBoard';
import { PuzzleBoard } from './PuzzleBoard';
import { playBoxing } from '../core/boxing';
import { playPenalty } from '../core/penalty';
import { playPuzzle } from '../core/puzzleDuel';
import { GameTour } from './GameTour';
import { EmoteBubble, EmoteKey, HereMark, useGameEmotes } from './Emotes';

interface PaperGamesProps {
  kind: PaperKind;
  game?: PaperGame;
  activeUser: Seat;
  /** The other person's name, as this phone knows it. */
  partnerName: string;
  onChange: (game: PaperGame) => void;
  /** Back to all the games. */
  onBack?: () => void;
  /** Their phone knows Carrom's wider pockets too, so a new game may be played on them (core/carrom). */
  widePockets?: boolean;
  /** Their phone has Boxing, Penalty Shootout and Puzzle Duel (core/paperGames, CAN_PLAY_MORE). */
  moreGames?: boolean;
  /** Their phone has Rock Paper Scissors (core/paperGames, CAN_RPS). */
  rpsReady?: boolean;
  /** Their phone has emotes, and says which game it is on (core/gameEmotes, CAN_EMOTE). */
  emotes?: boolean;
}

/** How each game is played, in a line. */
export const GAME_HOW: Record<PaperKind, string> = {
  boxing: 'You both pick a move in secret, then it is fought out. Big punches cost energy. Knock the other one out to win.',
  penalty: 'Take turns to shoot and to keep goal. Aim and pick your power, or pick your dive - both in secret. Five kicks each.',
  puzzle: 'The same puzzle for you both, each on your own clock. The faster one takes the round. First to four.',
  balloon: 'Pull back, let go and allow for the wind. Soak the other one through to win. You each get one giant balloon.',
  carrom: 'Flick the striker to pot your coins. Win the Queen and cover her with a coin of yours. Clear your coins to win.',
  four: 'Drop a disc in turn. Four in a line - across, down or slanting - wins.',
  memory: 'Turn over two cards a turn. Find a pair to keep it - and go again.',
  rps: 'You both choose at once. Paper wraps Rock, Scissors cut Paper, Rock smashes Scissors. First to three.',
  snakes: 'Roll and race to 100. Ladders take you up, snakes bring you down. A six rolls again.',
  ttt: 'Three in a row wins. Take turns - from wherever you both are.',
  dots: 'Take turns drawing a line. Close a box to claim it - and go again.'
};

/** The sounds each game makes, loaded when it opens. */
const SOUNDS_OF: Record<PaperKind, SoundName[]> = {
  boxing: ['g-bx-bell', 'g-bx-pick', 'g-bx-whoosh', 'g-bx-jab', 'g-bx-hook', 'g-bx-upper', 'g-bx-block', 'g-bx-ko', 'g-bx-crowd'],
  penalty: ['g-pk-whistle', 'g-pk-pick', 'g-pk-kick', 'g-pk-goal', 'g-pk-save', 'g-pk-post', 'g-pk-miss'],
  puzzle: ['g-pz-go', 'g-pz-tap', 'g-pz-wrong', 'g-pz-done', 'g-pz-pad', 'g-reveal', 'g-point', 'g-miss'],
  balloon: ['g-wb-stretch', 'g-wb-throw', 'g-wb-burst', 'g-wb-giant', 'g-wb-splat', 'g-wb-hedge', 'g-wb-eek', 'g-wb-wind', 'us-shake'],
  carrom: ['g-cr-strike', 'g-cr-click', 'g-cr-wall', 'g-cr-pocket', 'g-cr-queen', 'g-cr-cover', 'g-cr-foul', 'g-cr-place', 'g-cr-back'],
  ttt: ['g-pen'],
  dots: ['g-chalk', 'g-box'],
  four: ['g-drop'],
  memory: ['g-flip', 'g-match', 'g-miss'],
  rps: ['g-rps-beat', 'g-rps-shoot', 'g-rps-rock', 'g-rps-paper', 'g-rps-scissors', 'g-rps-tie', 'g-rps-win', 'g-rps-lose', 'g-pick', 'g-turn'],
  snakes: ['g-dice', 'g-hop', 'g-ladder', 'g-snake']
};

/** A small picture of each game, for its card among the games and its empty board. */
export const GameIcon: React.FC<{ kind: PaperKind }> = ({ kind }) => {
  switch (kind) {
    case 'boxing':
      return (
        <svg viewBox="0 0 64 56" className="g-icon" aria-hidden="true">
          <path d="M32,3 l3.4,7.4 8,-3 -3,8 7.4,3.4 -7.4,3.4 3,8 -8,-3 -3.4,7.4 -3.4,-7.4 -8,3 3,-8 -7.4,-3.4 7.4,-3.4 -3,-8 8,3 Z" fill="#ffd23f" opacity={0.9} />
          {[
            [1, '#e23a55'],
            [-1, '#2f7fe6']
          ].map(([dir, ink]) => (
            <g key={String(ink)} transform={`translate(32 31) scale(${dir} 1)`}>
              <rect x={-31} y={-7} width={10} height={14} rx={3} fill="#fff7ea" stroke="#3b2723" strokeWidth={2.2} />
              <path d="M-22,-10 C-13,-15 -1,-13 -1,-1 C-1,9 -8,12 -16,11 C-20,11 -22,9 -22,6 Z" fill={String(ink)} stroke="#3b2723" strokeWidth={2.4} strokeLinejoin="round" />
              <path d="M-18,4 C-16,10 -9,11 -7,6" fill="none" stroke="#3b2723" strokeWidth={2} strokeLinecap="round" />
              <path d="M-15,-8 C-10,-10 -5,-8 -4,-4" fill="none" stroke="#fff" strokeOpacity={0.65} strokeWidth={2.2} strokeLinecap="round" />
            </g>
          ))}
        </svg>
      );
    case 'penalty':
      return (
        <svg viewBox="0 0 64 56" className="g-icon" aria-hidden="true">
          <rect x={0} y={34} width={64} height={22} rx={5} fill="#2f9e58" />
          <path d="M10,36 V8 H54 V36" fill="none" stroke="#3b2723" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
          <path d="M10,36 V8 H54 V36" fill="none" stroke="#fdfdff" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          <path d="M14,12 L50,34 M50,12 L14,34 M23,10 V35 M32,10 V35 M41,10 V35 M12,18 H52 M12,27 H52" stroke="#fff" strokeOpacity={0.55} strokeWidth={0.9} />
          <circle cx={39} cy={41} r={9} fill="#fff" stroke="#3b2723" strokeWidth={2.2} />
          <path d="M39,37 L43,40 L41.5,44.5 H36.5 L35,40 Z" fill="#2a2440" />
        </svg>
      );
    case 'puzzle':
      return (
        <span className="g-icon g-icon-emoji" aria-hidden="true">
          🧠⏱️
        </span>
      );
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
    case 'rps':
      return <RpsIcon />;
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
  boxing: BoxingBoard,
  penalty: PenaltyBoard,
  puzzle: PuzzleBoard,
  balloon: BalloonBoard,
  carrom: CarromBoard,
  ttt: TttBoard,
  dots: DotsBoard,
  four: FourBoard,
  memory: MemoryBoard,
  rps: RpsBoard,
  snakes: SnakesBoard
};

const CONFETTI_COUNT = 36;

/**
 * One game on Canvas of Us (core/paperGames): the players and the score
 * between you, whose turn it is, the board (components/GameBoards), and a
 * new game when this one is done. Moves travel to the other phone the
 * moment they are made; each lands with its own sound on both phones.
 */
export const PaperGames: React.FC<PaperGamesProps> = ({ kind, game, activeUser, partnerName, onChange, onBack, widePockets = false, moreGames = true, rpsReady = true, emotes = true }) => {
  const tr = useT();
  const me = activeUser;
  /** A new game's id. Carrom's says which pockets it is played on. */
  const freshId = () => (kind === 'carrom' ? carromId(newId('game'), widePockets) : newId('game'));
  const them = other(me);
  // The faces you pull at each other, and whether they are looking at this game too.
  const em = useGameEmotes(kind);
  const [size, setSize] = useState<number>(game?.size ?? (kind === 'memory' ? DEFAULT_MEMORY : DEFAULT_DOTS));
  const [picking, setPicking] = useState(false);
  // The first time this game is opened on this phone: how it is played.
  const [touring, setTouring] = useState(() => !tourSeen(kind));
  const tourDone = () => {
    markTourSeen(kind);
    setTouring(false);
    haptic('tick');
  };
  const [party, setParty] = useState<{ key: number; inks: string[]; sad: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => loadSounds([...SOUNDS_OF[kind], 'g-win', 'g-lose', 'g-tie', 'g-start', 'g-turn', 'g-miss']), [kind]);
  // The game as it is now, for what happens after a question has been up on screen.
  const gameRef = useRef(game);
  gameRef.current = game;

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
  // And the ones where a round is played out once you have both chosen: the same, round by round.
  const watchesRounds = kind === 'boxing' || kind === 'penalty' || kind === 'puzzle' || kind === 'rps';
  const [settled, setSettled] = useState(watchesRounds ? roundsOf(game) : (game?.moves.length ?? 0));
  const landing = !!game && (watches ? settled < game.moves.length : watchesRounds ? settled < roundsOf(game) : false);
  const shownGame = useMemo(
    () => (!game || !landing ? game : watches ? { ...game, moves: game.moves.slice(0, settled) } : atRound(game, settled)),
    [game, landing, settled, watches]
  );

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
    // `st` is the game as far as it has been shown, so over means the last round has been played out.
    if (watchesRounds && game && st?.over) celebrate(game);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, game]);

  // Each move as it lands, from either of you: its sound, and at the end the celebration.
  const last = useRef({ id: game?.id, n: progressOf(game), over: st?.over ?? false, mine: 0, theirs: 0, rounds: 0 });
  useEffect(() => {
    if (!game || !st) return;
    const before = last.current;
    const now = {
      id: game.id,
      n: progressOf(game),
      over: st.over,
      mine: game.picks?.[me].length || 0,
      theirs: game.picks?.[them].length || 0,
      rounds: roundsOf(game)
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
      case 'rps':
        // Your pick, a click; theirs, while you still have to choose, a nudge. The round itself is the board's.
        if (now.rounds === before.rounds && now.mine > before.mine) playSound('g-pick');
        else if (now.rounds === before.rounds && now.theirs > before.theirs && now.mine <= now.rounds) playSound('g-turn');
        return;
      case 'boxing':
      case 'penalty':
      case 'puzzle':
        // They have chosen and you have not: a nudge. The rest is the board's.
        if (now.rounds === before.rounds && now.theirs > before.theirs && now.mine <= now.rounds) playSound('g-turn');
        return;
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
    const g = gameRef.current;
    if (g && !standing(g).over && progressOf(g) > 0) {
      // In the middle of a game it takes both of you: this only asks.
      if (g.ask?.open) return;
      const sure = await askConfirm({
        title: tr('Ask {name} for a new game?', { name: partnerName }),
        body: tr('This game carries on until {name} says yes.', { name: partnerName }),
        confirm: tr('Ask')
      });
      if (!sure) return;
      // It may have ended, or they may have asked first, while that was up.
      const latest = gameRef.current;
      if (!latest || latest.id !== g.id || standing(latest).over || latest.ask?.open) return;
      getAudioContext();
      haptic('tick');
      onChange(askRestart(latest, me, Date.now()));
      return;
    }
    getAudioContext();
    haptic('confirm');
    onChange(newGame(kind, g, me, freshId(), Date.now(), size));
    if (!g) playSound('g-start');
  };

  /** Yes: the new game starts, on both phones. */
  const acceptAsk = () => {
    const g = gameRef.current;
    if (!openAsk(g)) return;
    getAudioContext();
    haptic('confirm');
    onChange(newGame(kind, g, me, freshId(), Date.now(), g!.size));
  };
  /** No: this one carries on, and they are told. */
  const declineAsk = () => {
    const g = gameRef.current;
    if (!openAsk(g)) return;
    haptic('tick');
    onChange(declineRestart(g!, Date.now()));
  };
  /** Taking your own question back. */
  const cancelAsk = () => {
    const g = gameRef.current;
    if (!openAsk(g)) return;
    haptic('tick');
    onChange(cancelRestart(g!, Date.now()));
  };

  // The question as it arrives, and the answer: a nudge, not to be missed.
  const askHeard = useRef(game?.ask?.at ?? 0);
  useEffect(() => {
    const a = game?.ask;
    if (!a || a.at === askHeard.current) return;
    askHeard.current = a.at;
    if (a.open && a.by === them) {
      playSound('g-turn');
      haptic('confirm');
    } else if (a.no && a.by === me) {
      playSound('g-miss');
      haptic('tick');
    }
    // Only when the asking changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.ask]);

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
    if (kind === 'boxing' && shownGame) return tr('{n} health', { n: playBoxing(shownGame).hp[seat] });
    if (kind === 'penalty' && shownGame) {
      const n = playPenalty(shownGame).goals[seat];
      return tr(n === 1 ? '{n} goal' : '{n} goals', { n });
    }
    if (kind === 'puzzle' && shownGame) {
      const n = playPuzzle(shownGame).points[seat];
      return tr(n === 1 ? '{n} round' : '{n} rounds', { n });
    }
    return null;
  };

  const chip = (seat: Seat) => {
    const turn = !!st && !st.over && st.toMove.includes(seat) && !isPickKind(kind);
    const won = !!st?.over && st.winner === seat;
    const extra = detail(seat);
    return (
      <div className="pg-chip" data-turn={turn || undefined} data-won={won || undefined} data-them={seat === them || undefined} style={{ '--ink': inkOf(seat) } as React.CSSProperties}>
        <span className="pg-chip-mark">
          <MarkIcon mark={markOf(seat)} ink={inkOf(seat)} size={26} />
        </span>
        <span className="pg-chip-name">{nameOf(seat)}</span>
        <span className="pg-chip-score" aria-label={tr(score[seat] === 1 ? '{n} win' : '{n} wins', { n: score[seat] })}>
          {score[seat]}
        </span>
        {extra && <span className="pg-chip-boxes">{extra}</span>}
        {emotes && seat === them && <HereMark here={em.theirHere} />}
        {emotes && <EmoteBubble shown={seat === me ? em.mine : em.theirs} seat={seat} side={seat === me ? 'left' : 'right'} />}
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
  } else if (landing) {
    status = waiting(tr('Here it goes'));
  } else if (isPickKind(kind)) {
    const meToo = st.toMove.includes(me);
    const themToo = st.toMove.includes(them);
    const first =
      kind === 'boxing'
        ? tr('Pick your move!')
        : kind === 'penalty'
          ? playPenalty(game).kicker === me
            ? tr('Take your kick!')
            : tr('Pick your dive!')
          : kind === 'puzzle'
            ? tr('Your puzzle is ready')
            : tr('Choose one!');
    status =
      meToo && themToo
        ? mePill(first)
        : meToo
          ? mePill(kind === 'rps' ? tr('{name} has chosen - your pick!', { name: partnerName }) : tr('{name} is ready - your go!', { name: partnerName }))
          : waiting(kind === 'rps' ? tr('Waiting for {name} to choose', { name: partnerName }) : tr('Waiting for {name}', { name: partnerName }));
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
  const ask = openAsk(game);

  return (
    <section className="pg" data-kind={kind} style={{ '--me': myLook.ink, '--them': theirLook.ink } as React.CSSProperties}>
      {touring && <GameTour kind={kind} art={<GameIcon kind={kind} />} onDone={tourDone} />}
      <div className="pg-head">
        {onBack && (
          <button type="button" className="pg-back" onClick={onBack} aria-label={tr('All games')}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <h3 className="pg-title">{tr(GAME_NAMES[kind])}</h3>
        {emotes && <EmoteKey emotes={em} seat={me} partnerName={partnerName} />}
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

      {ask && ask.by === them && (
        <div className="pg-ask" data-theirs="" role="alert">
          <p className="pg-ask-text">
            <b>{tr('{name} wants to start a new game', { name: partnerName })}</b>
            <small>{tr('This one will not count.')}</small>
          </p>
          <div className="pg-ask-buttons">
            <button type="button" className="pg-ask-no" onClick={declineAsk}>
              {tr('Keep playing')}
            </button>
            <button type="button" className="pg-ask-yes" onClick={acceptAsk}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {tr('New game')}
            </button>
          </div>
        </div>
      )}
      {ask && ask.by === me && (
        <div className="pg-ask" role="status">
          <p className="pg-ask-text">
            {tr('Waiting for {name} to say yes', { name: partnerName })}
            <span className="pg-dots-wait" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </p>
          <div className="pg-ask-buttons">
            <button type="button" className="pg-ask-no" onClick={cancelAsk}>
              {tr('Cancel')}
            </button>
          </div>
        </div>
      )}
      {((isNewerKind(kind) && !moreGames) || (kind === 'rps' && !rpsReady)) && (
        <p className="pg-ask-note" role="status">
          {tr("{name}'s Two needs the latest update to play this one", { name: partnerName })}
        </p>
      )}
      {!ask && refusedOf(game, me) && (
        <p className="pg-ask-note" role="status">
          {tr('{name} wants to finish this one', { name: partnerName })}
        </p>
      )}

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
        ) : !ask ? (
          <button type="button" className="pg-restart" onClick={() => void start()}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {tr('New game')}
          </button>
        ) : null}
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
