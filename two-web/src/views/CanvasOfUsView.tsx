import React, { useState, useRef, useEffect } from 'react';
import {
  SharedDrawingCanvasState,
  DrawStroke,
  CanvasSavedSketch
} from '../types';
import {
  Palette,
  Edit3,
  Brush,
  Eraser,
  Pencil,
  Undo2,
  Trash2,
  Download,
  Send,
  Sparkles,
  Heart,
  Image as ImageIcon,
  Check,
  Maximize2,
  Gamepad2
} from 'lucide-react';
import { newId } from '../core/ids';
import { getAudioContext } from '../core/audioAlerts';
import { playOneOf } from '../core/sounds';
import { who } from '../core/who';
import { askConfirm } from '../core/dialog';
import { useT } from '../core/i18n';
import { haptic } from '../core/haptics';
import { shrinkPhoto, type ShrunkPhoto } from '../core/photo';
import { PHOTO_MAX_CHARS, dataUrlToBlob } from '../core/chatShow';
import { GameIcon, PaperGames } from '../components/PaperGames';
import { CosyHomes, HOMES_NAME, HomesIcon } from '../components/CosyHomes';
import { allDone, levelOn, totalStars, type HomesBook } from '../core/cosyHomes';
import { HEARTS_NAME, HeartsIcon, TwoHearts } from '../components/TwoHearts';
import { heartsIn, levelOfPair, mergeBooks, type MazeHalf } from '../core/twoHearts';
import { OPEN_GAME_EVENT, isGameRoom } from '../core/gameEmotes';
import { DUO_GAMES, DUO_NAMES, duoOf, isDuoGame, type DuoGame, type DuoHalf } from '../core/duo';
import { BombIcon, BombSquad } from '../components/BombSquad';
import { CatchIcon, CatchTogether } from '../components/CatchTogether';
import { LampIcon, LampMaze } from '../components/LampMaze';
import {
  CANVAS_MODE_KEY,
  GAME_NAMES,
  PAPER_KINDS,
  askedOf,
  rememberCanvasMode,
  standing,
  totals,
  type CanvasMode,
  type PaperGame,
  type PaperKind
} from '../core/paperGames';

interface CanvasOfUsViewProps {
  canvasState: SharedDrawingCanvasState;
  activeUser: 'user' | 'partner';
  /** The other person's name, as this phone knows it. */
  partnerName?: string;
  onAddStroke: (stroke: DrawStroke) => void;
  onClearCanvas: () => void;
  onUndoStroke: () => void;
  onSaveSketch: (sketch: CanvasSavedSketch) => void;
  /** A drawing into the chat, as a photo message. */
  onSendDrawing?: (picture: ShrunkPhoto) => void;
  /** Their phone knows Carrom's wider pockets (core/carrom): a new game may use them. */
  widePockets?: boolean;
  /** Their phone has the newest games too (core/paperGames, CAN_PLAY_MORE). */
  moreGames?: boolean;
  /** The games (core/paperGames), as this phone has them. */
  games?: Partial<Record<PaperKind, PaperGame>>;
  /** A move, a new game or a new look: to keep, and to send. */
  onGame?: (game: PaperGame) => void;
  /** Cosy Homes, the puzzle for one (core/cosyHomes): the stars each of you has. */
  homes?: { mine?: HomesBook; theirs?: HomesBook };
  /** A level of it finished, with its stars. */
  onHomes?: (level: number, stars: number) => void;
  /** Two Hearts, the maze for two (core/twoHearts): where each of you is. */
  maze?: { mine?: MazeHalf; theirs?: MazeHalf };
  /** This phone's own one has moved: to keep, and to send. */
  onMaze?: (half: MazeHalf) => void;
  /** Their phone has the maze too, with its levels made the same way. */
  mazeReady?: boolean;
  /** Their phone has emotes in the games (core/gameEmotes). */
  emotesReady?: boolean;
  /** The games for two at once (core/duo): how far each phone has seen the two of you get. */
  duo?: { mine?: DuoHalf; theirs?: DuoHalf };
  /** This phone has seen the two of you get further in one of them. */
  onDuo?: (half: DuoHalf) => void;
  /** Their phone has those games too. */
  duoReady?: boolean;
}

/** The picture of each game for two at once, for its card. */
const DUO_ICONS: Record<DuoGame, React.FC> = { bomb: BombIcon, catch: CatchIcon, lamp: LampIcon };

/** Where this was last left - drawing, the games, or one game - so a game you were playing is still there. */
function savedMode(): CanvasMode {
  try {
    const m = localStorage.getItem(CANVAS_MODE_KEY);
    return m === 'games' || m === 'homes' || m === 'maze' || isDuoGame(m) || (PAPER_KINDS as string[]).includes(m || '') ? (m as CanvasMode) : 'draw';
  } catch {
    return 'draw';
  }
}

/**
 * Whose seat a saved sketch came from.
 *
 * Sketches carry `authorId` now. Older ones only have the name they were saved
 * with, and that name was only ever "You" (written from the 'user' seat) or
 * "Partner" (from the 'partner' seat) - so the seat can still be read off it,
 * and the sketch named correctly on both phones.
 */
function sketchSeat(sketch: CanvasSavedSketch): 'user' | 'partner' | undefined {
  if (sketch.authorId) return sketch.authorId;
  if (sketch.authorName === 'You') return 'user';
  if (sketch.authorName === 'Partner') return 'partner';
  return undefined;
}

// A pencil touching the paper, a different take each stroke.
function playSketchSound() {
  playOneOf(['sketch-1', 'sketch-2', 'sketch-3'], { rate: 0.95 + Math.random() * 0.1 });
}

const PALETTE_COLORS = [
  { name: 'Charcoal Ink', hex: '#262626' },
  { name: 'Rose Blush', hex: '#f43f5e' },
  { name: 'Sunset Terracotta', hex: '#ea580c' },
  { name: 'Warm Amber', hex: '#d97706' },
  { name: 'Forest Sage', hex: '#059669' },
  { name: 'Midnight Indigo', hex: '#4f46e5' },
  { name: 'Lavender Mist', hex: '#a855f7' },
  { name: 'Chalk White', hex: '#f8fafc' }
];

type CanvasTool = 'pen' | 'watercolor' | 'pencil' | 'eraser';
type CanvasBackground = 'parchment' | 'night_sky' | 'clean_linen';

const BACKGROUND_INK: Record<CanvasBackground, string> = {
  night_sky: '#0f172a',
  parchment: '#f6f2e8',
  clean_linen: '#ffffff'
};

/**
 * The single definition of how a tool looks.
 *
 * The live preview and the committed redraw used to carry separate copies of
 * this, so a stroke could visibly change the instant you lifted your finger.
 */
function applyToolStyle(
  ctx: CanvasRenderingContext2D,
  tool: CanvasTool,
  color: string,
  size: number,
  background: CanvasBackground
) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (tool) {
    case 'eraser':
      ctx.strokeStyle = BACKGROUND_INK[background];
      ctx.lineWidth = size * 2.5;
      break;
    case 'watercolor':
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = size * 3.5;
      break;
    case 'pencil':
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = Math.max(1, size * 0.7);
      break;
    default:
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = size;
  }
}

/**
 * Traces a stroke as quadratic curves through the midpoints of its samples.
 *
 * Joining raw samples with straight lines turns every hand tremor into a
 * visible corner, which is what made a slow, deliberate line look shaky.
 * Curving through the midpoints keeps the path where the finger actually went
 * while removing the faceting.
 */
function tracePath(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  width: number,
  height: number
) {
  const px = (p: { x: number; y: number }) => ({ x: p.x * width, y: p.y * height });

  const first = px(points[0]);
  ctx.moveTo(first.x, first.y);

  if (points.length === 2) {
    const second = px(points[1]);
    ctx.lineTo(second.x, second.y);
    return;
  }

  for (let i = 1; i < points.length - 1; i++) {
    const current = px(points[i]);
    const next = px(points[i + 1]);
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }

  // The last sample is only a control point above, so finish on it explicitly
  // or the stroke stops short of where the finger lifted.
  const last = px(points[points.length - 1]);
  ctx.lineTo(last.x, last.y);
}

export const CanvasOfUsView: React.FC<CanvasOfUsViewProps> = ({
  canvasState,
  activeUser,
  partnerName,
  onAddStroke,
  onClearCanvas,
  onUndoStroke,
  onSaveSketch,
  onSendDrawing,
  widePockets,
  moreGames,
  games,
  onGame,
  homes,
  onHomes,
  maze,
  onMaze,
  mazeReady = true,
  emotesReady = true,
  duo,
  onDuo,
  duoReady = true
}) => {
  const tr = useT();
  const [mode, setMode] = useState<CanvasMode>(() => (onGame ? savedMode() : 'draw'));
  const chooseMode = (m: CanvasMode) => {
    setMode(m);
    rememberCanvasMode(m);
  };
  // A pop-up about a game, tapped while this page is already open: straight to that game.
  useEffect(() => {
    if (!onGame) return;
    const open = (e: Event) => {
      const room = (e as CustomEvent).detail;
      if (!isGameRoom(room) || (room === 'maze' && !onMaze) || (isDuoGame(room) && !onDuo)) return;
      setMode(room);
      rememberCanvasMode(room);
    };
    window.addEventListener(OPEN_GAME_EVENT, open);
    return () => window.removeEventListener(OPEN_GAME_EVENT, open);
    // Whether there are games at all does not change while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** A game gets the screen to itself: its own back button takes the place of the page's title and tabs. */
  const inGame = !!onGame && mode !== 'draw' && mode !== 'games';
  // Each starts at the top: a game opened from low down the list opens with its board in view.
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [mode]);
  /** A game waiting on you - a move, or an answer: a dot on its card, and on the Games tab. */
  const yourTurn = (g?: PaperGame) => !!g && (standing(g).toMove.includes(activeUser) || askedOf(g, activeUser));
  const anyTurn = PAPER_KINDS.some(k => yourTurn(games?.[k]));
  const them = partnerName && partnerName !== 'Partner' ? partnerName : tr('Partner');
  /** A game's card among the games: where it stands, and the score. */
  const shelfLine = (k: PaperKind): { text: string; tone: 'me' | 'wait' | 'done' | 'new' } => {
    const g = games?.[k];
    if (!g) return { text: tr('New - tap to play'), tone: 'new' };
    const s = standing(g);
    if (s.over) return { text: s.winner === activeUser ? tr('You won!') : s.winner ? tr('{name} won', { name: them }) : tr("It's a tie!"), tone: 'done' };
    if (askedOf(g, activeUser)) return { text: tr('{name} wants a new game', { name: them }), tone: 'me' };
    if (s.toMove.includes(activeUser)) return { text: tr('Your turn'), tone: 'me' };
    return { text: tr("{name}'s turn", { name: them }), tone: 'wait' };
  };
  const [activeTool, setActiveTool] = useState<CanvasTool>('pen');
  const [activeColor, setActiveColor] = useState<string>('#f43f5e');
  const [brushSize, setBrushSize] = useState<number>(4);
  const [backgroundType, setBackgroundType] = useState<CanvasBackground>(
    canvasState.background || 'parchment'
  );
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [sending, setSending] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  /** The saved sketch just sent from the gallery, ticked for a moment. */
  const [sentSketch, setSentSketch] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);

  /**
   * The canvas size in CSS pixels.
   *
   * The backing store is sized in device pixels and the context is scaled by
   * that same ratio once, so every drawing call below works in CSS pixels.
   * Reading `canvas.width` here instead applies the ratio a SECOND time, which
   * is what put strokes away from the finger that drew them: at a device ratio
   * of 3 a point tapped halfway across the board rendered one and a half board
   * widths off, and the error grew with the distance from the top-left corner.
   * Desktops mostly hid it because their ratio is 1, where multiplying twice
   * changes nothing.
   */
  const sizeRef = useRef({ width: 0, height: 0 });

  // Render all committed strokes onto the HTML5 Canvas
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return;

    ctx.clearRect(0, 0, width, height);

    // Background styling
    if (backgroundType === 'night_sky') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
    } else if (backgroundType === 'parchment') {
      ctx.fillStyle = '#f6f2e8';
      ctx.fillRect(0, 0, width, height);

      // Subtle texture lines
      ctx.strokeStyle = 'rgba(180, 160, 140, 0.12)';
      ctx.lineWidth = 1;
      const step = 32;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    // Render strokes
    canvasState.strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.save();
      applyToolStyle(ctx, stroke.tool as CanvasTool, stroke.color, stroke.size, backgroundType);
      ctx.beginPath();
      tracePath(ctx, stroke.points, width, height);
      ctx.stroke();
      ctx.restore();
    });
  };

  // The resize observer below is set up once and must not capture the redraw
  // from the render that installed it, or it repaints with a stale background
  // and stroke list after every rotation.
  const redrawRef = useRef(redrawCanvas);
  redrawRef.current = redrawCanvas;

  // Match the backing store to the display and redraw at the new size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateDimensions = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Beyond 3x there is nothing left for an eye to resolve, and every extra
      // pixel is paid for on every repaint of every stroke.
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const nextWidth = Math.round(rect.width * dpr);
      const nextHeight = Math.round(rect.height * dpr);

      // Assigning width or height clears the canvas even when the value is
      // unchanged, so an observer callback that changes nothing must not touch
      // them - otherwise a stray layout pass wipes the board mid-stroke.
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      sizeRef.current = { width: rect.width, height: rect.height };

      // Resizing resets the transform, so the ratio is reapplied here rather
      // than once at mount. setTransform rather than scale: scale multiplies
      // into whatever is already there and would compound on every call.
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      redrawRef.current();
    };

    updateDimensions();

    // The board is a share of a flexible column: opening the dock, rotating the
    // phone or the address bar collapsing all change its size without ever
    // firing a window resize.
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateDimensions);
      observer.observe(canvas);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Redraw whenever strokes change
  useEffect(() => {
    redrawCanvas();
  }, [canvasState.strokes, backgroundType]);

  // Points are stored as a fraction of the board, so a stroke drawn on a phone
  // lands in the same place on a laptop that is showing a wider board.
  const normalizedFrom = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    currentPointsRef.current = [normalizedFrom(e.clientX, e.clientY)];
    playSketchSound();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = sizeRef.current;
    if (!ctx || width === 0) return;

    // A 120Hz screen delivers several positions per frame but React only hands
    // us the last one. Asking for the coalesced batch is the difference between
    // a fast stroke arriving as a smooth arc and as three long chords.
    const native = e.nativeEvent;
    const batch =
      typeof native.getCoalescedEvents === 'function'
        ? native.getCoalescedEvents()
        : [native];

    for (const sample of batch.length > 0 ? batch : [native]) {
      const pt = normalizedFrom(sample.clientX, sample.clientY);
      const pts = currentPointsRef.current;
      const prev = pts[pts.length - 1];

      // Sub-pixel repeats add nothing to the picture and go out over the relay
      // encrypted, one by one, to the other phone.
      if (prev) {
        const dx = (pt.x - prev.x) * width;
        const dy = (pt.y - prev.y) * height;
        if (dx * dx + dy * dy < 0.5) continue;
      }
      pts.push(pt);

      if (pts.length < 2) continue;

      ctx.save();
      applyToolStyle(ctx, activeTool, activeColor, brushSize, backgroundType);
      ctx.beginPath();

      const toPx = (p: { x: number; y: number }) => ({ x: p.x * width, y: p.y * height });
      const b = toPx(pts[pts.length - 2]);
      const c = toPx(pts[pts.length - 1]);

      if (pts.length === 2) {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
      } else {
        // Draw the same midpoint-to-midpoint curve the finished stroke will be
        // rendered with, so nothing shifts when the stroke is committed.
        const a = toPx(pts[pts.length - 3]);
        ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
        ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
      }

      ctx.stroke();
      ctx.restore();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Already released, e.g. the pointer was cancelled by the system.
    }

    const points = currentPointsRef.current;
    currentPointsRef.current = [];

    // A tap is a dot, not nothing. Repeating the point gives the round line cap
    // something to draw, which is what a pen touched to paper actually leaves.
    if (points.length === 1) points.push({ ...points[0] });
    if (points.length < 2) return;

    onAddStroke({
      id: newId('stroke'),
      authorId: activeUser,
      tool: activeTool,
      color: activeColor,
      size: brushSize,
      points
    });
  };

  const handleSaveToVault = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const sketch: CanvasSavedSketch = {
      id: newId('sketch'),
      title: `Love Sketch #${(canvasState.savedSketches?.length || 0) + 1}`,
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      dataUrl,
      authorId: activeUser,
      authorName: activeUser === 'user' ? 'You' : 'Partner'
    };

    onSaveSketch(sketch);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2200);

    if ('vibrate' in navigator) {
      navigator.vibrate([60, 40, 60]);
    }
  };

  /**
   * A drawing into the chat, as a photo: the canvas as it looks, paper and
   * all, shrunk the way any photo is to fit one record (core/photo).
   */
  const sendPicture = async (source: Blob): Promise<boolean> => {
    if (!onSendDrawing) return false;
    try {
      onSendDrawing(await shrinkPhoto(source, PHOTO_MAX_CHARS));
      haptic('confirm');
      return true;
    } catch {
      return false;
    }
  };

  const handleSendDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas || sending === 'sending') return;
    setSending('sending');
    canvas.toBlob(async blob => {
      const ok = !!blob && (await sendPicture(blob));
      setSending(ok ? 'sent' : 'failed');
      setTimeout(() => setSending('idle'), 2200);
    }, 'image/png');
  };

  const handleSendSketch = async (sketch: CanvasSavedSketch) => {
    let ok = false;
    try {
      ok = await sendPicture(dataUrlToBlob(sketch.dataUrl));
    } catch {
      ok = false;
    }
    if (!ok) return;
    setSentSketch(sketch.id);
    setTimeout(() => setSentSketch(current => (current === sketch.id ? null : current)), 2200);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      {!inGame && (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Palette className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              Draw together
            </span>
          </div>
          <h2 className="font-serif text-2xl font-bold text-linen-primary mt-1">
            Canvas of Us
          </h2>
          <p className="text-xs text-linen-secondary mt-0.5">
            Draw, doodle or leave a handwritten note. Every line appears on both phones as you draw.
          </p>
        </div>

        {/* Action buttons: Save / Share / Clear */}
        <div className={`flex items-center space-x-2 self-start sm:self-auto ${mode === 'draw' ? '' : 'hidden'}`}>
          <button
            onClick={handleSaveToVault}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
          >
            {savedFeedback ? <Check className="w-4 h-4 text-emerald-300" /> : <Sparkles className="w-4 h-4" />}
            <span>{savedFeedback ? 'Saved!' : 'Save drawing'}</span>
          </button>

          {onSendDrawing && (
            <button
              onClick={handleSendDrawing}
              disabled={canvasState.strokes.length === 0 || sending === 'sending'}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl border border-linen-border bg-linen-surface text-xs font-medium text-linen-secondary hover:text-linen-accent transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
            >
              {sending === 'sent' ? <Check className="w-4 h-4 text-emerald-500" /> : <Send className="w-4 h-4" />}
              <span>{sending === 'sent' ? tr('Sent') : sending === 'failed' ? tr('Send again') : tr('Send to chat')}</span>
            </button>
          )}
        </div>
      </div>
      )}

      {onGame && !inGame && (
        <div className="cv-modes" role="tablist" aria-label={tr('Canvas of Us')}>
          <button type="button" role="tab" aria-selected={mode === 'draw'} className="cv-mode" data-on={mode === 'draw' || undefined} onClick={() => chooseMode('draw')}>
            <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{tr('Draw')}</span>
          </button>
          <button type="button" role="tab" aria-selected={mode !== 'draw'} className="cv-mode" data-on={mode !== 'draw' || undefined} onClick={() => chooseMode('games')}>
            <Gamepad2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{tr('Games')}</span>
            {anyTurn && <span className="cv-mode-dot" aria-label={tr('Your turn')} />}
          </button>
        </div>
      )}

      {onGame && mode === 'games' && (
        <div className="cv-shelf">
          {onHomes && (
            <button type="button" className="cv-game" data-kind="homes" onClick={() => chooseMode('homes')}>
              <span className="cv-game-tag">{tr('1 player')}</span>
              <span className="cv-game-art">
                <HomesIcon />
              </span>
              <span className="cv-game-name">{tr(HOMES_NAME)}</span>
              <span className="cv-game-line" data-tone={homes?.mine ? 'wait' : 'new'}>
                {!homes?.mine ? tr('New - tap to play') : allDone(homes.mine) ? tr('Every level done!') : tr('Level {n}', { n: levelOn(homes.mine) })}
              </span>
              {homes?.mine ? <span className="cv-game-score">⭐ {totalStars(homes.mine)}</span> : null}
            </button>
          )}
          {onMaze && (
            <button type="button" className="cv-game" data-kind="maze" onClick={() => chooseMode('maze')}>
              <span className="cv-game-tag">{tr('Together')}</span>
              <span className="cv-game-art">
                <HeartsIcon />
              </span>
              <span className="cv-game-name">{tr(HEARTS_NAME)}</span>
              <span className="cv-game-line" data-tone={maze?.mine || maze?.theirs ? 'wait' : 'new'}>
                {maze?.mine || maze?.theirs ? tr('Level {n}', { n: levelOfPair(maze?.mine, maze?.theirs) }) : tr('New - tap to play')}
              </span>
              {maze?.mine || maze?.theirs ? (
                <span className="cv-game-score">💖 {heartsIn(mergeBooks(maze?.mine?.book ?? '', maze?.theirs?.book ?? ''))}</span>
              ) : null}
            </button>
          )}
          {onDuo &&
            DUO_GAMES.map(g => {
              const Icon = DUO_ICONS[g];
              const got = duoOf(duo?.mine, duo?.theirs)[g];
              return (
                <button key={g} type="button" className="cv-game" data-kind={g} onClick={() => chooseMode(g)}>
                  <span className="cv-game-tag">{tr('Together')}</span>
                  <span className="cv-game-art">
                    <Icon />
                  </span>
                  <span className="cv-game-name">{tr(DUO_NAMES[g])}</span>
                  <span className="cv-game-line" data-tone={got ? 'wait' : 'new'}>
                    {!got ? tr('New - tap to play') : g === 'catch' ? tr('Best {n}', { n: got }) : tr('Level {n}', { n: got + 1 })}
                  </span>
                </button>
              );
            })}
          {PAPER_KINDS.map(k => {
            const line = shelfLine(k);
            const g = games?.[k];
            const t = g ? totals(g) : null;
            return (
              <button key={k} type="button" className="cv-game" data-kind={k} onClick={() => chooseMode(k)}>
                {line.tone === 'me' && <span className="cv-mode-dot" aria-hidden="true" />}
                <span className="cv-game-art">
                  <GameIcon kind={k} />
                </span>
                <span className="cv-game-name">{tr(GAME_NAMES[k])}</span>
                <span className="cv-game-line" data-tone={line.tone}>
                  {line.text}
                </span>
                {t && (t.user || t.partner || t.draws) ? (
                  <span className="cv-game-score">
                    {tr('You')} {t[activeUser]} · {t[activeUser === 'user' ? 'partner' : 'user']} {them}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {onHomes && mode === 'homes' && (
        <CosyHomes
          mine={homes?.mine}
          theirs={homes?.theirs}
          partnerName={them}
          me={activeUser}
          onFinish={onHomes}
          onBack={() => chooseMode('games')}
        />
      )}

      {onMaze && mode === 'maze' && (
        <TwoHearts
          mine={maze?.mine}
          theirs={maze?.theirs}
          me={activeUser}
          partnerName={them}
          canPlay={mazeReady}
          emotes={emotesReady}
          onHalf={onMaze}
          onBack={() => chooseMode('games')}
        />
      )}

      {onDuo && isDuoGame(mode) && (
        (() => {
          const Game = mode === 'bomb' ? BombSquad : mode === 'catch' ? CatchTogether : LampMaze;
          return (
            <Game
              key={mode}
              mine={duo?.mine}
              theirs={duo?.theirs}
              me={activeUser}
              partnerName={them}
              canPlay={duoReady}
              emotes={emotesReady}
              onHalf={onDuo}
              onBack={() => chooseMode('games')}
            />
          );
        })()
      )}

      {onGame && mode !== 'draw' && mode !== 'games' && mode !== 'homes' && mode !== 'maze' && !isDuoGame(mode) && (
        <PaperGames
          key={mode}
          kind={mode}
          game={games?.[mode]}
          activeUser={activeUser}
          partnerName={them}
          onChange={onGame}
          onBack={() => chooseMode('games')}
          widePockets={widePockets}
          moreGames={moreGames}
          emotes={emotesReady}
        />
      )}

      {/* The drawing stays where it is under a game - only hidden, so its
          board keeps its size and strokes for when you come back to it. */}
      <div className={mode === 'draw' ? 'space-y-6' : 'hidden'}>
      {/* Brush & Color Toolbar Ribbon */}
      <div className="rounded-3xl border border-linen-border bg-linen-surface p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Tool Selectors: Pen, Watercolor, Pencil, Eraser */}
        <div className="flex items-center space-x-1.5 bg-linen-variant/40 p-1 rounded-2xl border border-linen-border/60">
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-2 rounded-xl text-xs font-serif transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTool === 'pen' ? 'bg-linen-surface text-linen-primary shadow-xs font-semibold' : 'text-linen-secondary hover:text-linen-primary'
            }`}
            title="Fountain Pen (Calligraphic Ink)"
          >
            <Edit3 className="w-4 h-4 text-rose-600" />
            <span className="hidden sm:inline">Pen</span>
          </button>

          <button
            onClick={() => setActiveTool('watercolor')}
            className={`p-2 rounded-xl text-xs font-serif transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTool === 'watercolor' ? 'bg-linen-surface text-linen-primary shadow-xs font-semibold' : 'text-linen-secondary hover:text-linen-primary'
            }`}
            title="Watercolor Wash (Soft Blending)"
          >
            <Brush className="w-4 h-4 text-sky-600" />
            <span className="hidden sm:inline">Watercolor</span>
          </button>

          <button
            onClick={() => setActiveTool('pencil')}
            className={`p-2 rounded-xl text-xs font-serif transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTool === 'pencil' ? 'bg-linen-surface text-linen-primary shadow-xs font-semibold' : 'text-linen-secondary hover:text-linen-primary'
            }`}
            title="Pencil (Light Graphite)"
          >
            <Pencil className="w-4 h-4 text-linen-secondary" />
            <span className="hidden sm:inline">Pencil</span>
          </button>

          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-2 rounded-xl text-xs font-serif transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTool === 'eraser' ? 'bg-linen-surface text-linen-primary shadow-xs font-semibold' : 'text-linen-secondary hover:text-linen-primary'
            }`}
            title="Soft Eraser"
          >
            <Eraser className="w-4 h-4 text-amber-700" />
            <span className="hidden sm:inline">Eraser</span>
          </button>
        </div>

        {/* Color Palette Swatches */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1">
          {PALETTE_COLORS.map(c => (
            <button
              key={c.hex}
              onClick={() => {
                setActiveColor(c.hex);
                if (activeTool === 'eraser') setActiveTool('pen');
              }}
              style={{ backgroundColor: c.hex }}
              className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer shadow-xs ${
                activeColor === c.hex && activeTool !== 'eraser'
                  ? 'scale-115 border-linen-primary ring-2 ring-linen-accent/40'
                  : 'border-linen-primary/30 hover:scale-105'
              }`}
              title={c.name}
            />
          ))}
        </div>

        {/* Brush Size + Background Theme Toggles + Undo */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Brush Size Selector */}
          <div className="flex items-center space-x-1 bg-linen-variant/40 px-2.5 py-1.5 rounded-2xl border border-linen-border/60">
            {[2, 5, 12].map(sz => (
              <button
                key={sz}
                onClick={() => setBrushSize(sz)}
                className={`w-6 h-6 rounded-lg text-xs font-mono transition-colors cursor-pointer flex items-center justify-center ${
                  brushSize === sz ? 'bg-linen-surface text-linen-primary font-bold shadow-xs' : 'text-linen-secondary hover:text-linen-primary'
                }`}
              >
                {sz === 2 ? 'S' : sz === 5 ? 'M' : 'L'}
              </button>
            ))}
          </div>

          {/* Background Selector */}
          <select
            value={backgroundType}
            onChange={e => setBackgroundType(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs font-serif rounded-2xl bg-linen-variant/40 border border-linen-border/60 text-linen-primary focus:outline-none cursor-pointer"
          >
            <option value="parchment">Parchment</option>
            <option value="night_sky">Night Sky</option>
            <option value="clean_linen">Clean Linen</option>
          </select>

          {/* Undo and Clear */}
          <button
            onClick={onUndoStroke}
            disabled={canvasState.strokes.length === 0}
            className="p-2 rounded-2xl border border-linen-border bg-linen-surface text-linen-secondary hover:text-linen-primary disabled:opacity-30 cursor-pointer transition-colors"
            title="Undo Last Stroke"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={async () => {
              const sure = await askConfirm({
                title: 'Clear the drawing board?',
                body: 'It clears for both of you.',
                confirm: 'Clear it',
                danger: true
              });
              if (sure) onClearCanvas();
            }}
            className="p-2 rounded-2xl border border-linen-border bg-linen-surface text-linen-secondary hover:text-rose-600 transition-colors cursor-pointer"
            title="Clear Board"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* The HTML5 Interactive Canvas Board */}
      <div className="rounded-3xl border-2 border-linen-border shadow-md overflow-hidden relative select-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          // Without this, a stroke interrupted by an incoming call or a system
          // gesture is silently thrown away instead of being kept.
          onPointerCancel={handlePointerUp}
          className="w-full h-[52vh] max-h-[500px] min-h-[300px] sm:h-[500px] touch-none cursor-crosshair block"
        />

        {/* Bottom Canvas Telemetry Badge */}
        <div className="absolute bottom-3 left-3 pointer-events-none flex items-center space-x-2 bg-linen-surface/85 px-3 py-1.5 rounded-full border border-linen-border/80 text-[11px] font-serif text-linen-secondary shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-linen-accent" />
          <span>{canvasState.strokes.length} strokes drawn together</span>
        </div>
      </div>

      {/* Saved Sketches Gallery Vault */}
      {canvasState.savedSketches && canvasState.savedSketches.length > 0 && (
        <div className="rounded-3xl border border-linen-border bg-linen-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-4 h-4 text-linen-accent" />
            <h3 className="font-serif text-base font-semibold text-linen-primary">
              Saved Sketches Gallery ({canvasState.savedSketches.length})
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {canvasState.savedSketches.map(sketch => (
              <div
                key={sketch.id}
                className="rounded-2xl border border-linen-border/80 bg-linen-bg overflow-hidden shadow-xs hover:border-linen-accent/40 transition-colors group"
              >
                <div className="w-full h-32 bg-linen-variant/40 flex items-center justify-center overflow-hidden">
                  <img
                    src={sketch.dataUrl}
                    alt={sketch.title}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="p-3 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-serif text-xs font-semibold text-linen-primary truncate">
                      {sketch.title}
                    </h4>
                    <p className="text-[10px] text-linen-secondary mt-0.5">
                      {sketch.date} • {who(sketchSeat(sketch), activeUser, partnerName, sketch.authorName)}
                    </p>
                  </div>
                  {onSendDrawing && (
                    <button
                      type="button"
                      onClick={() => void handleSendSketch(sketch)}
                      aria-label={tr('Send to chat')}
                      title={tr('Send to chat')}
                      className="shrink-0 -m-1 p-1.5 rounded-xl text-linen-secondary hover:text-linen-accent transition-colors cursor-pointer"
                    >
                      {sentSketch === sketch.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Send className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
