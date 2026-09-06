import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ScratchFoilType } from '../types';

interface ScratchCardCanvasProps {
  foilType: ScratchFoilType;
  isCompleted: boolean;
  onScratchComplete: () => void;
  children: React.ReactNode;
}

function playScratchFrictionSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Filtered pink noise burst simulating scratch texture
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.2;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(3.0, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + 0.05);
  } catch (_) {}
}

function playRevealChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    [528, 660, 792, 1056].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.08;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.3);
    });
  } catch (_) {}
}

/**
 * How much of the foil has to go before the card counts as opened.
 *
 * People stop scratching once they can read the thing, so this is deliberately
 * nowhere near 100.
 */
const REVEAL_AT_PERCENT = 52;

const BRUSH_RADIUS = 24;

/**
 * Progress is tracked on a fixed grid of cells rather than by counting pixels.
 *
 * The grid is a fraction of the card rather than a number of pixels, so the
 * same cell means the same place whatever size the card is rendered at.
 * 48x32 is about 1500 cells: fine enough that the percentage moves smoothly
 * under a finger, coarse enough that marking one brush stroke touches a few
 * dozen bytes.
 */
const GRID_COLS = 48;
const GRID_ROWS = 32;

interface ScratchGrid {
  cells: Uint8Array;
  cleared: number;
}

export const ScratchCardCanvas: React.FC<ScratchCardCanvasProps> = ({
  foilType,
  isCompleted,
  onScratchComplete,
  children
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);

  /** The card's size in CSS pixels; the context is scaled so drawing uses it. */
  const sizeRef = useRef({ width: 0, height: 0 });

  const gridRef = useRef<ScratchGrid>({
    cells: new Uint8Array(GRID_COLS * GRID_ROWS),
    cleared: 0
  });

  /**
   * setFullyRevealed does not take effect until the next render, so a burst of
   * pointer events crossing the threshold in one tick would all see the old
   * value and call onScratchComplete several times.
   */
  const completedRef = useRef(isCompleted);
  const [scratchPercent, setScratchPercent] = useState<number>(isCompleted ? 100 : 0);
  const [fullyRevealed, setFullyRevealed] = useState<boolean>(isCompleted);
  const lastSoundTimeRef = useRef<number>(0);

  // Paint realistic metallic foil texture
  const paintFoil = useCallback((preserveProgress = false) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    // The foil used to be painted at CSS resolution and then stretched over a
    // 2x or 3x screen, which is why its lettering looked soft next to the rest
    // of the card. Painting into a backing store at the device resolution and
    // scaling the context once keeps every drawing call below in CSS pixels.
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    sizeRef.current = { width, height };

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Scratching leaves the context in destination-out. Without resetting it, a
    // repaint would erase the foil it is trying to lay down.
    ctx.globalCompositeOperation = 'source-over';

    const previous = preserveProgress ? gridRef.current : null;
    gridRef.current = {
      cells: new Uint8Array(GRID_COLS * GRID_ROWS),
      cleared: 0
    };

    let grad: CanvasGradient;

    if (foilType === 'gold') {
      grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#e5c07b');
      grad.addColorStop(0.3, '#ffd700');
      grad.addColorStop(0.5, '#fff3a8');
      grad.addColorStop(0.7, '#d4af37');
      grad.addColorStop(1, '#aa771c');
    } else if (foilType === 'rose_gold') {
      grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#f8b4b4');
      grad.addColorStop(0.4, '#e5989b');
      grad.addColorStop(0.6, '#ffd5d5');
      grad.addColorStop(1, '#b56576');
    } else if (foilType === 'silver') {
      grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#d1d5db');
      grad.addColorStop(0.3, '#f3f4f6');
      grad.addColorStop(0.6, '#9ca3af');
      grad.addColorStop(1, '#e5e7eb');
    } else {
      // Holographic
      grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#f472b6');
      grad.addColorStop(0.25, '#c084fc');
      grad.addColorStop(0.5, '#60a5fa');
      grad.addColorStop(0.75, '#34d399');
      grad.addColorStop(1, '#fbbf24');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative vintage border & sparkle text
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    ctx.fillStyle = 'rgba(40, 30, 20, 0.65)';
    ctx.font = 'bold 13px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨ SCRATCH WITH FINGER OR MOUSE ✨', width / 2, height / 2 - 12);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(40, 30, 20, 0.5)';
    ctx.fillText('Rub across the foil to reveal your surprise', width / 2, height / 2 + 10);

    // Put back what had already been scratched off. The grid is stored as a
    // fraction of the card, so the marks land in the same relative places at
    // the new size. Replaying them as overlapping circles rather than filling
    // the cells keeps the torn edge looking rubbed rather than pixelated.
    if (previous && previous.cleared > 0) {
      gridRef.current = previous;

      const cellW = width / GRID_COLS;
      const cellH = height / GRID_ROWS;
      const radius = Math.max(cellW, cellH) * 0.8;

      ctx.globalCompositeOperation = 'destination-out';
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          if (!previous.cells[row * GRID_COLS + col]) continue;
          ctx.beginPath();
          ctx.arc((col + 0.5) * cellW, (row + 0.5) * cellH, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [foilType]);

  useEffect(() => {
    if (!isCompleted) {
      paintFoil();
    } else {
      completedRef.current = true;
      setFullyRevealed(true);
      setScratchPercent(100);
    }
  }, [isCompleted, paintFoil]);

  /**
   * Repaint at the new size when the card's box changes.
   *
   * The canvas is stretched over its container by CSS, so without this a
   * rotation leaves the backing store at the old size while pointer positions
   * arrive in the new one - and the foil comes off somewhere other than under
   * the finger. Progress is carried across by replaying the cleared cells.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isCompleted || typeof ResizeObserver === 'undefined') return;

    let first = true;
    const observer = new ResizeObserver(() => {
      // The observer fires once on attach, when nothing has changed yet.
      if (first) {
        first = false;
        return;
      }
      const { width, height } = sizeRef.current;
      if (
        Math.abs(container.clientWidth - width) < 1 &&
        Math.abs(container.clientHeight - height) < 1
      ) {
        return;
      }
      paintFoil(true);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [isCompleted, paintFoil]);

  /**
   * Marks the cells the brush just covered and returns the new percentage.
   *
   * This replaces a getImageData over the whole card on every pointermove. That
   * call is not merely a loop over pixels - it stalls the pipeline to pull the
   * surface back off the GPU, roughly 280KB of it, up to 120 times a second,
   * which is what made scratching stutter. Counting cells touches a few dozen
   * bytes and never reads the canvas at all.
   */
  const markScratched = (x: number, y: number, radius: number): number => {
    const grid = gridRef.current;
    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return 0;

    const cellW = width / GRID_COLS;
    const cellH = height / GRID_ROWS;

    const minCol = Math.max(0, Math.floor((x - radius) / cellW));
    const maxCol = Math.min(GRID_COLS - 1, Math.floor((x + radius) / cellW));
    const minRow = Math.max(0, Math.floor((y - radius) / cellH));
    const maxRow = Math.min(GRID_ROWS - 1, Math.floor((y + radius) / cellH));

    const rSquared = radius * radius;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const index = row * GRID_COLS + col;
        if (grid.cells[index]) continue;

        // A cell counts as gone once the brush covers its centre, which tracks
        // the circle's true area closely enough at this resolution.
        const dx = (col + 0.5) * cellW - x;
        const dy = (row + 0.5) * cellH - y;
        if (dx * dx + dy * dy > rSquared) continue;

        grid.cells[index] = 1;
        grid.cleared++;
      }
    }

    return Math.min(100, Math.round((grid.cleared / (GRID_COLS * GRID_ROWS)) * 100));
  };

  const scratchAt = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    const percent = markScratched(x, y, BRUSH_RADIUS);

    // Only re-render when the number on screen would actually change. Setting
    // it every move re-rendered the whole card list on each pointer event.
    setScratchPercent(prev => (prev === percent ? prev : percent));

    if (percent >= REVEAL_AT_PERCENT && !completedRef.current) {
      completedRef.current = true;
      setFullyRevealed(true);
      playRevealChime();
      onScratchComplete();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([80, 50, 80]);
        } catch (_) {}
      }
    }

    const now = Date.now();
    if (now - lastSoundTimeRef.current > 70) {
      playScratchFrictionSound();
      lastSoundTimeRef.current = now;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (fullyRevealed) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Capture, so a finger that slides off the card keeps scratching it rather
    // than stopping dead at the edge.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    isDrawingRef.current = true;
    scratchAt(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || fullyRevealed) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // A fast rub delivers several positions per frame. Using only the last one
    // left unscratched gaps between the circles.
    const native = e.nativeEvent;
    const batch =
      typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];

    for (const sample of batch.length > 0 ? batch : [native]) {
      scratchAt(sample.clientX - rect.left, sample.clientY - rect.top);
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = false;
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  return (
    <div ref={containerRef} className="relative rounded-3xl overflow-hidden select-none">
      {/* Hidden Content Beneath Foil */}
      <div className="w-full">
        {children}
      </div>

      {/* Foil Scratch Layer */}
      {!fullyRevealed && (
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 cursor-crosshair touch-none transition-opacity duration-500"
          style={{
            opacity: fullyRevealed ? 0 : 1,
            pointerEvents: fullyRevealed ? 'none' : 'auto'
          }}
        />
      )}

      {/* Live Reveal Progress Bar */}
      {!fullyRevealed && scratchPercent > 0 && (
        <div className="absolute bottom-2 right-3 z-10 pointer-events-none bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-full text-[10px] font-mono text-amber-300">
          Revealed: {scratchPercent}%
        </div>
      )}
    </div>
  );
};
