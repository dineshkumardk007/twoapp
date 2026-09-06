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
  Share2,
  Sparkles,
  Heart,
  Image as ImageIcon,
  Check,
  Maximize2
} from 'lucide-react';
import { newId } from '../core/ids';

interface CanvasOfUsViewProps {
  canvasState: SharedDrawingCanvasState;
  activeUser: 'user' | 'partner';
  onAddStroke: (stroke: DrawStroke) => void;
  onClearCanvas: () => void;
  onUndoStroke: () => void;
  onSaveSketch: (sketch: CanvasSavedSketch) => void;
  onSendToChat?: (text: string) => void;
}

// Procedural sketch sound effect using gentle filtered white noise bursts
function playSketchSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.02;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, ctx.currentTime);
    filter.Q.setValueAtTime(1.5, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  } catch (e) {
    // ignore
  }
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
  onAddStroke,
  onClearCanvas,
  onUndoStroke,
  onSaveSketch,
  onSendToChat
}) => {
  const partnerName = activeUser === 'user' ? 'Partner' : 'You';

  const [activeTool, setActiveTool] = useState<CanvasTool>('pen');
  const [activeColor, setActiveColor] = useState<string>('#f43f5e');
  const [brushSize, setBrushSize] = useState<number>(4);
  const [backgroundType, setBackgroundType] = useState<CanvasBackground>(
    canvasState.background || 'parchment'
  );
  const [savedFeedback, setSavedFeedback] = useState(false);

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
      authorName: activeUser === 'user' ? 'You' : 'Partner'
    };

    onSaveSketch(sketch);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2200);

    if ('vibrate' in navigator) {
      navigator.vibrate([60, 40, 60]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Palette className="w-5 h-5 text-rose-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-rose-600">
              Tactile Touch Artistry
            </span>
          </div>
          <h2 className="font-serif text-2xl font-bold text-linen-primary mt-1">
            Canvas of Us
          </h2>
          <p className="text-xs text-linen-secondary mt-0.5">
            Draw, trace palms, or leave sweet handwritten notes together in real-time. Every stroke synchronizes across distance.
          </p>
        </div>

        {/* Action buttons: Save / Share / Clear */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={handleSaveToVault}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
          >
            {savedFeedback ? <Check className="w-4 h-4 text-emerald-300" /> : <Sparkles className="w-4 h-4" />}
            <span>{savedFeedback ? 'Saved to Vault!' : 'Save to Vault'}</span>
          </button>

          {onSendToChat && (
            <button
              onClick={() => onSendToChat('🎨 I just drew a sweet doodle on Canvas of Us for you. Come trace it with me.')}
              className="p-2 rounded-2xl border border-linen-border bg-linen-surface text-linen-secondary hover:text-linen-accent transition-colors cursor-pointer"
              title="Share canvas link in Chat"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

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
            <Pencil className="w-4 h-4 text-stone-600" />
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
                  : 'border-white/80 hover:scale-105'
              }`}
              title={c.name}
            />
          ))}
        </div>

        {/* Brush Size + Background Theme Toggles + Undo */}
        <div className="flex items-center space-x-2">
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
            onClick={() => {
              if (window.confirm('Clear the shared drawing board?')) {
                onClearCanvas();
              }
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
        <div className="absolute bottom-3 left-3 pointer-events-none flex items-center space-x-2 bg-linen-surface/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-linen-border/80 text-[11px] font-serif text-linen-secondary shadow-xs">
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
                <div className="p-3">
                  <h4 className="font-serif text-xs font-semibold text-linen-primary truncate">
                    {sketch.title}
                  </h4>
                  <p className="text-[10px] text-linen-secondary mt-0.5">
                    {sketch.date} • {sketch.authorName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
