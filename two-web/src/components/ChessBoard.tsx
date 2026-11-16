import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pause, Play } from 'lucide-react';
import {
  BISHOP,
  KING,
  KNIGHT,
  PAWN,
  PIECE_VALUE,
  PROMOTIONS,
  QUEEN,
  ROOK,
  chessMove,
  fileOf,
  needsPromotion,
  playChess,
  rankOf,
  sideSign,
  targetsFrom,
  type ChessState
} from '../core/chess';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import { other } from '../core/paperGames';
import { playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import type { BoardProps } from './GameBoards';

// Chess on Canvas of Us (core/chess has the rules).
//
// The classic shapes, so a piece is known at a glance - but the bear's team
// in caramel with little round ears, the bunny's in cream with long ones, and
// the kings and queens in tiny crowns. Your own side is always at the bottom.
// Tap a piece and where it can go lights up; tap one of those to move. Each
// piece glides to its square, on both phones; at the end the whole game can
// be watched again, move by move.

const INK = '#3b2723';
const TEAM = {
  bear: { fill: '#c98a55', shade: '#a66c3d', light: '#f3d9b5', ear: '#a66c3d', inner: '#f3d9b5' },
  bunny: { fill: '#fbf5ee', shade: '#e6d9cc', light: '#ffffff', ear: '#fbf5ee', inner: '#f9a8c0' }
} as const;
type Team = keyof typeof TEAM;
const PIECE_NAMES = ['', 'Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'];
const FILES = 'abcdefgh';

/** Where the top of each piece's head is, in its 100 by 100 box: where its ears go. */
const TOP: Record<number, number> = { [PAWN]: 26, [KNIGHT]: 18, [BISHOP]: 16, [ROOK]: 24, [QUEEN]: 18, [KING]: 16 };

/** The ears of the team, behind the piece's head. */
const Ears: React.FC<{ team: Team; top: number; x?: number }> = ({ team, top, x = 50 }) => {
  const t = TEAM[team];
  const line = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  return team === 'bear' ? (
    <g>
      <circle cx={x - 15} cy={top + 3} r={8.5} fill={t.ear} {...line} />
      <circle cx={x - 15} cy={top + 3} r={4} fill={t.inner} />
      <circle cx={x + 15} cy={top + 3} r={8.5} fill={t.ear} {...line} />
      <circle cx={x + 15} cy={top + 3} r={4} fill={t.inner} />
    </g>
  ) : (
    <g>
      <path d={`M${x - 11},${top + 8} C${x - 20},${top - 14} ${x - 15},${top - 24} ${x - 8},${top - 22} C${x - 3},${top - 20} ${x - 3},${top - 6} ${x - 4},${top + 6} Z`} fill={t.ear} {...line} />
      <path d={`M${x - 9},${top + 2} C${x - 14},${top - 12} ${x - 11},${top - 18} ${x - 8},${top - 17} C${x - 6},${top - 15} ${x - 6},${top - 6} ${x - 6},${top + 2} Z`} fill={t.inner} />
      <path d={`M${x + 11},${top + 8} C${x + 20},${top - 14} ${x + 15},${top - 24} ${x + 8},${top - 22} C${x + 3},${top - 20} ${x + 3},${top - 6} ${x + 4},${top + 6} Z`} fill={t.ear} {...line} />
      <path d={`M${x + 9},${top + 2} C${x + 14},${top - 12} ${x + 11},${top - 18} ${x + 8},${top - 17} C${x + 6},${top - 15} ${x + 6},${top - 6} ${x + 6},${top + 2} Z`} fill={t.inner} />
    </g>
  );
};

const Crown: React.FC<{ y: number; king?: boolean }> = ({ y, king }) => (
  <g>
    <path d={`M37,${y + 6} L39,${y - 4} L44.5,${y + 1} L50,${y - 7} L55.5,${y + 1} L61,${y - 4} L63,${y + 6} Z`} fill="#fbbf24" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
    {king ? <path d={`M50,${y - 16} V${y - 6} M45.5,${y - 12} H54.5`} stroke={INK} strokeWidth={3.4} strokeLinecap="round" /> : <circle cx={50} cy={y - 9} r={3.2} fill="#fbbf24" stroke={INK} strokeWidth={2} />}
  </g>
);

/** One piece, in a 100 by 100 box, its base at the bottom. */
export const PieceArt: React.FC<{ kind: number; team: Team }> = React.memo(({ kind, team }) => {
  const t = TEAM[team];
  const body = { fill: t.fill, stroke: INK, strokeWidth: 3.4, strokeLinejoin: 'round' as const };
  const base = (
    <g>
      <path d="M24,88 C24,80 32,78 50,78 C68,78 76,80 76,88 Z" {...body} />
      <path d="M20,94 C20,88 30,86 50,86 C70,86 80,88 80,94 Z" fill={t.shade} stroke={INK} strokeWidth={3.4} strokeLinejoin="round" />
    </g>
  );
  const shine = (d: string) => <path d={d} fill="none" stroke={t.light} strokeWidth={3} strokeLinecap="round" opacity={0.85} />;
  let shape: React.ReactNode;
  switch (kind) {
    case PAWN:
      shape = (
        <g>
          <path d="M36,80 C38,64 42,56 44,50 H56 C58,56 62,64 64,80 Z" {...body} />
          <path d="M38,52 H62 C62,47 58,45 50,45 C42,45 38,47 38,52 Z" {...body} />
          <circle cx={50} cy={36} r={12} {...body} />
          <circle cx={45.5} cy={35} r={1.8} fill={INK} />
          <circle cx={54.5} cy={35} r={1.8} fill={INK} />
          <ellipse cx={50} cy={39.5} rx={2.4} ry={1.6} fill={INK} />
          {shine('M42,30 Q45,26 49,26')}
        </g>
      );
      break;
    case ROOK:
      shape = (
        <g>
          <path d="M32,80 L36,46 H64 L68,80 Z" {...body} />
          <path d="M30,46 V28 H38 V34 H45 V28 H55 V34 H62 V28 H70 V46 Z" {...body} />
          <path d="M38,58 H62 M37,68 H63" stroke={INK} strokeWidth={2} opacity={0.45} />
          {shine('M40,52 V74')}
        </g>
      );
      break;
    case KNIGHT:
      shape = (
        <g>
          <path d="M30,80 C30,64 38,58 42,50 C34,52 28,50 26,44 C24,38 32,28 40,24 C44,18 52,16 58,18 C70,22 74,36 72,52 C71,62 70,72 70,80 Z" {...body} />
          <path d="M52,20 C58,24 62,32 62,42" fill="none" stroke={INK} strokeWidth={2.2} opacity={0.5} />
          <circle cx={45} cy={32} r={2.4} fill={INK} />
          <ellipse cx={30} cy={42} rx={2} ry={1.5} fill={INK} />
          {shine('M60,30 Q66,40 64,54')}
        </g>
      );
      break;
    case BISHOP:
      shape = (
        <g>
          <path d="M36,80 C38,68 42,62 44,58 H56 C58,62 62,68 64,80 Z" {...body} />
          <path d="M50,18 C62,26 66,38 62,48 C60,54 56,58 50,58 C44,58 40,54 38,48 C34,38 38,26 50,18 Z" {...body} />
          <circle cx={50} cy={14} r={4.5} {...body} />
          <path d="M50,30 L58,40" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          {shine('M42,34 Q42,44 46,50')}
        </g>
      );
      break;
    case QUEEN:
      shape = (
        <g>
          <path d="M32,80 C36,64 40,52 40,40 H60 C60,52 64,64 68,80 Z" {...body} />
          <path d="M36,42 C36,34 42,28 50,28 C58,28 64,34 64,42 Z" {...body} />
          {shine('M44,46 Q42,62 40,74')}
        </g>
      );
      break;
    default:
      shape = (
        <g>
          <path d="M30,80 C34,66 38,54 38,40 H62 C62,54 66,66 70,80 Z" {...body} />
          <path d="M34,42 C34,32 41,26 50,26 C59,26 66,32 66,42 Z" {...body} />
          <path d="M38,60 H62" stroke={INK} strokeWidth={2.4} opacity={0.5} />
          {shine('M44,46 Q42,62 40,74')}
        </g>
      );
  }
  return (
    <svg viewBox="0 0 100 100" className="cs-art" aria-hidden="true" focusable="false">
      <ellipse cx={50} cy={95} rx={30} ry={4} fill="#000" opacity={0.18} />
      <Ears team={team} top={TOP[kind]} x={kind === KNIGHT ? 52 : 50} />
      {base}
      {shape}
      {kind === QUEEN && <Crown y={26} />}
      {kind === KING && <Crown y={24} king />}
    </svg>
  );
});
PieceArt.displayName = 'PieceArt';

/** The game's picture, for its card among the games and its empty board. */
export const ChessIcon: React.FC = () => (
  <svg viewBox="0 0 60 60" className="g-icon" aria-hidden="true">
    <rect x={1.5} y={1.5} width={57} height={57} rx={10} fill="#f6e7cf" stroke="#3b2723" strokeWidth={2.4} />
    {Array.from({ length: 16 }, (_, i) => {
      const r = Math.floor(i / 4);
      const c = i % 4;
      return (r + c) % 2 ? <rect key={i} x={4 + c * 13} y={4 + r * 13} width={13} height={13} fill="#c9a27a" opacity={0.7} /> : null;
    })}
    <g transform="translate(2 10) scale(0.42)">
      <PieceArt kind={KING} team="bear" />
    </g>
    <g transform="translate(29 10) scale(0.42)">
      <PieceArt kind={QUEEN} team="bunny" />
    </g>
  </svg>
);

const teamOf = (seat: Seat): Team => (seat === 'user' ? 'bear' : 'bunny');

/** The pieces a side has taken, small, and how far ahead it is. */
const Taken: React.FC<{ kinds: number[]; team: Team; lead: number }> = ({ kinds, team, lead }) => (
  <span className="cs-taken">
    {[...kinds]
      .sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a] || b - a)
      .map((k, i) => (
        <i key={i}>
          <PieceArt kind={k} team={team} />
        </i>
      ))}
    {lead > 0 && <b>+{lead}</b>}
  </span>
);

export const ChessBoard: React.FC<BoardProps> = React.memo(({ game, me, canAct, onMove, partnerName }) => {
  const tr = useT();
  const them = other(me);
  const live = useMemo(() => playChess(game), [game]);
  /** Watching the game again: how many of its moves are shown, and whether it plays by itself. */
  const [replay, setReplay] = useState<{ at: number; playing: boolean } | null>(null);
  const replayState = useMemo(() => (replay ? playChess({ first: game.first, moves: game.moves.slice(0, replay.at) }) : null), [replay, game.first, game.moves]);
  const s: ChessState = replayState ?? live;
  const myTeam = teamOf(me);
  const theirTeam = teamOf(them);
  const mySign = sideSign(live, me);
  // My side at the bottom.
  const flip = mySign < 0;
  const pos = (sq: number) => {
    const f = fileOf(sq);
    const r = rankOf(sq);
    return { x: (flip ? 7 - f : f) * 12.5, y: (flip ? r : 7 - r) * 12.5 };
  };

  const [picked, setPicked] = useState<number | null>(null);
  const [promoting, setPromoting] = useState<{ from: number; to: number } | null>(null);
  useEffect(() => {
    setPicked(null);
    setPromoting(null);
  }, [game.moves.length, game.id]);
  const myMove = canAct && !replay && !live.over && live.turn === me;
  const targets = picked !== null && myMove ? targetsFrom(live, picked) : [];

  // A move as it arrives, from either of you: its sound.
  const seenMoves = useRef(game.moves.length);
  const seenId = useRef(game.id);
  useEffect(() => {
    if (seenId.current !== game.id) {
      seenId.current = game.id;
      seenMoves.current = game.moves.length;
      setReplay(null);
      return;
    }
    if (game.moves.length <= seenMoves.current) {
      seenMoves.current = game.moves.length;
      return;
    }
    seenMoves.current = game.moves.length;
    const last = live.last;
    if (!last) return;
    if (live.over && live.winner) return; // The celebration says it.
    if (live.check) {
      playSound('g-ch-check');
      haptic('confirm');
    } else if (last.promo) playSound('g-ch-promote');
    else if (last.castle) playSound('g-ch-castle');
    else if (last.captured) {
      playSound('g-ch-capture');
      haptic('tick');
    } else playSound('g-ch-move', { rate: 0.94 + Math.random() * 0.12 });
  }, [game.moves.length, game.id, live]);

  // The replay plays by itself, a move every so often.
  useEffect(() => {
    if (!replay?.playing) return;
    if (replay.at >= game.moves.length) {
      setReplay(r => (r ? { ...r, playing: false } : r));
      return;
    }
    const id = window.setTimeout(() => {
      setReplay(r => (r ? { ...r, at: r.at + 1 } : r));
      playSound('g-ch-move', { gain: 0.6 });
    }, 850);
    return () => window.clearTimeout(id);
  }, [replay, game.moves.length]);

  const tapSquare = (sq: number) => {
    if (!myMove) return;
    const piece = live.board[sq];
    if (picked !== null && targets.includes(sq)) {
      if (needsPromotion(live, picked, sq)) {
        setPromoting({ from: picked, to: sq });
        return;
      }
      onMove(chessMove(picked, sq));
      setPicked(null);
      return;
    }
    if (piece * mySign > 0 && targetsFrom(live, sq).length) {
      setPicked(sq === picked ? null : sq);
      haptic('tick');
      return;
    }
    setPicked(null);
  };

  const squares: React.ReactNode[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = pos(sq);
    const dark = (fileOf(sq) + rankOf(sq)) % 2 === 0;
    const isLast = s.last && (s.last.from === sq || s.last.to === sq);
    const target = targets.includes(sq);
    const kingInCheck = s.check && s.board[sq] === (s.turn === s.whiteSeat ? KING : -KING);
    squares.push(
      <button
        key={sq}
        type="button"
        className="cs-sq"
        data-dark={dark || undefined}
        data-last={isLast || undefined}
        data-picked={picked === sq || undefined}
        data-target={target ? (s.board[sq] ? 'take' : 'go') : undefined}
        data-check={kingInCheck || undefined}
        style={{ left: `${p.x}%`, top: `${p.y}%` }}
        onClick={() => tapSquare(sq)}
        aria-label={`${FILES[fileOf(sq)]}${rankOf(sq) + 1}${s.board[sq] ? `, ${s.board[sq] * mySign > 0 ? tr('your') : tr('their')} ${tr(PIECE_NAMES[Math.abs(s.board[sq])])}` : ''}`}
      >
        {/* The file letters along the bottom, the rank numbers up the side. */}
        {(flip ? rankOf(sq) === 7 : rankOf(sq) === 0) && <small className="cs-file">{FILES[fileOf(sq)]}</small>}
        {(flip ? fileOf(sq) === 7 : fileOf(sq) === 0) && <small className="cs-rank">{rankOf(sq) + 1}</small>}
      </button>
    );
  }

  const pieces: React.ReactNode[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const piece = s.board[sq];
    if (!piece) continue;
    const p = pos(sq);
    const seat: Seat = piece > 0 ? s.whiteSeat : other(s.whiteSeat);
    pieces.push(
      <span key={s.ids[sq] >= 0 ? `p${s.ids[sq]}` : `x${sq}`} className="cs-piece" data-picked={picked === sq || undefined} style={{ transform: `translate(${p.x * 8}%, ${p.y * 8}%)` }}>
        <PieceArt kind={Math.abs(piece)} team={teamOf(seat)} />
      </span>
    );
  }

  const ended = live.over && !replay;
  const result = live.over
    ? live.winner
      ? live.winner === me
        ? tr('Checkmate - you win!')
        : tr('Checkmate - {name} wins', { name: partnerName })
      : live.drawWhy === 'stalemate'
        ? tr('Stalemate - a draw')
        : live.drawWhy === 'repetition'
          ? tr('The same position three times - a draw')
          : live.drawWhy === 'fifty'
            ? tr('Fifty moves with nothing taken - a draw')
            : tr('Not enough left to checkmate - a draw')
    : null;

  return (
    <div className="cs">
      <div className="cs-side">
        <b>{partnerName}</b>
        <Taken kinds={s.taken[them]} team={myTeam} lead={s.lead[them]} />
      </div>
      <div className="cs-board" data-team={myTeam}>
        {squares}
        <div className="cs-pieces" aria-hidden="true">
          {pieces}
        </div>
        {targets.map(sq => {
          const p = pos(sq);
          return <span key={`d${sq}`} className="cs-dot" data-take={!!live.board[sq] || undefined} style={{ left: `${p.x}%`, top: `${p.y}%` }} />;
        })}
        {s.check && !s.over && !replay && (
          <span className="cs-banner" key={`c${game.moves.length}`}>
            {s.turn === me ? tr('Check!') : tr('Check to {name}!', { name: partnerName })}
          </span>
        )}
        {promoting && (
          <div className="cs-promote" role="dialog" aria-label={tr('Choose a piece')}>
            <p>{tr('Your pawn becomes…')}</p>
            <div>
              {PROMOTIONS.map((k, i) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    onMove(chessMove(promoting.from, promoting.to, i + 1));
                    setPromoting(null);
                    setPicked(null);
                  }}
                  aria-label={tr(PIECE_NAMES[k])}
                >
                  <PieceArt kind={k} team={myTeam} />
                </button>
              ))}
            </div>
            <button type="button" className="cs-promote-no" onClick={() => setPromoting(null)}>
              {tr('Cancel')}
            </button>
          </div>
        )}
      </div>
      <div className="cs-side">
        <b>{tr('You')}</b>
        <Taken kinds={s.taken[me]} team={theirTeam} lead={s.lead[me]} />
      </div>

      {result && <p className="cs-result">{result}</p>}
      {(ended || replay) && game.moves.length > 0 && (
        <div className="cs-replay" role="group" aria-label={tr('Watch the replay')}>
          {!replay ? (
            <button type="button" className="cs-replay-go" onClick={() => setReplay({ at: 0, playing: true })}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {tr('Watch the replay')}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setReplay({ at: 0, playing: false })} aria-label={tr('To the start')}>
                <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setReplay(r => (r ? { at: Math.max(0, r.at - 1), playing: false } : r))} aria-label={tr('One move back')}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" className="cs-replay-play" onClick={() => setReplay(r => (r ? { ...r, playing: !r.playing, at: r.at >= game.moves.length ? 0 : r.at } : r))} aria-label={replay.playing ? tr('Pause') : tr('Play')}>
                {replay.playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
              </button>
              <button type="button" onClick={() => setReplay(r => (r ? { at: Math.min(game.moves.length, r.at + 1), playing: false } : r))} aria-label={tr('One move on')}>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setReplay({ at: game.moves.length, playing: false })} aria-label={tr('To the end')}>
                <ChevronsRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="cs-replay-at">{tr('Move {n} of {max}', { n: replay.at, max: game.moves.length })}</span>
              <button type="button" className="cs-replay-done" onClick={() => setReplay(null)}>
                {tr('Done')}
              </button>
            </>
          )}
        </div>
      )}
      {!live.over && !replay && (
        <p className="cs-hint">
          {myMove ? (picked !== null ? tr('Tap a lit square to move there') : tr('Tap one of your pieces')) : tr("{name}'s move", { name: partnerName })}
        </p>
      )}
    </div>
  );
});
ChessBoard.displayName = 'ChessBoard';

