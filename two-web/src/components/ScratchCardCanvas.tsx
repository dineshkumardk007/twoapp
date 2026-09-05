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

export const ScratchCardCanvas: React.FC<ScratchCardCanvasProps> = ({
  foilType,
  isCompleted,
  onScratchComplete,
  children
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const [scratchPercent, setScratchPercent] = useState<number>(isCompleted ? 100 : 0);
  const [fullyRevealed, setFullyRevealed] = useState<boolean>(isCompleted);
  const lastSoundTimeRef = useRef<number>(0);

  // Paint realistic metallic foil texture
  const paintFoil = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
  }, [foilType]);

  useEffect(() => {
    if (!isCompleted) {
      paintFoil();
    } else {
      setFullyRevealed(true);
      setScratchPercent(100);
    }
  }, [isCompleted, paintFoil]);

  const checkScratchPercentage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      let transparentPixels = 0;
      const totalPixels = data.length / 4;
      const step = 8; // sample every 8th pixel for fast 60fps performance

      for (let i = 3; i < data.length; i += 4 * step) {
        if (data[i] < 30) {
          transparentPixels += step;
        }
      }

      const percent = Math.min(100, Math.round((transparentPixels / totalPixels) * 100));
      setScratchPercent(percent);

      if (percent >= 52 && !fullyRevealed) {
        setFullyRevealed(true);
        playRevealChime();
        onScratchComplete();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([80, 50, 80]);
          } catch (_) {}
        }
      }
    } catch (_) {}
  };

  const scratchAt = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();

    const now = Date.now();
    if (now - lastSoundTimeRef.current > 70) {
      playScratchFrictionSound();
      lastSoundTimeRef.current = now;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (fullyRevealed) return;
    isDrawingRef.current = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    scratchAt(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || fullyRevealed) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    scratchAt(e.clientX - rect.left, e.clientY - rect.top);
    checkScratchPercentage();
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    checkScratchPercentage();
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
          onPointerLeave={handlePointerUp}
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
