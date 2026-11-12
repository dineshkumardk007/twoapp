import React, { useEffect, useRef, useState } from 'react';
import { getAudioContext } from '../core/audioAlerts';
import { haptic } from '../core/haptics';
import { RUB_ENOUGH, RubGrid, openSecret, secretOpened } from '../core/secretMessage';
import { loadSounds, playOneOf, playSound } from '../core/sounds';

/** How wide the finger rubs, as a share of the foil's width - and never less than this many pixels. */
const RUB_SHARE = 0.09;
const RUB_MIN_PX = 16;
/** No more than one scratching sound this often. */
const SCRATCH_EVERY_MS = 110;
/** How long the last of the foil takes to go. */
const LEAVE_MS = 420;

interface SecretScratchProps {
  /** The message's id: once rubbed open on this phone it stays open. */
  id: string;
  /** What the foil says until it is rubbed: "Rub to read". */
  label: string;
  /** The words under it. */
  children: React.ReactNode;
}

/**
 * A secret message (core/secretMessage): its words under a foil that is
 * rubbed away with a finger. Past a little over half, the rest lifts off by
 * itself with a shimmer. The finger on the foil is the foil's alone: it does
 * not open the message's menu or pull it aside to answer.
 */
export const SecretScratch: React.FC<SecretScratchProps> = ({ id, label, children }) => {
  const [opened, setOpened] = useState(() => secretOpened(id));
  const [leaving, setLeaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const grid = useRef<RubGrid | null>(null);
  const rub = useRef<{ id: number; x: number; y: number } | null>(null);
  const lastSound = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!opened) return loadSounds(['scratch-1', 'scratch-2', 'scratch-3', 'secret-open']);
    return undefined;
  }, [opened]);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  // The foil: painted once at the size of the words under it.
  useEffect(() => {
    const el = canvas.current;
    if (opened || !el) return;
    const paint = () => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(box.width * dpr);
      const h = Math.round(box.height * dpr);
      // Sizing a canvas wipes it: only when the size has really changed, and never once rubbing has begun.
      if ((el.width === w && el.height === h) || (grid.current && grid.current.share > 0)) return;
      el.width = w;
      el.height = h;
      const ctx = el.getContext('2d');
      if (!ctx) return;
      const foil = ctx.createLinearGradient(0, 0, w, h);
      foil.addColorStop(0, '#8b5cf6');
      foil.addColorStop(0.5, '#ec4899');
      foil.addColorStop(1, '#f59e0b');
      ctx.fillStyle = foil;
      ctx.fillRect(0, 0, w, h);
      // A scatter of light specks, the same every time for the same message.
      let seed = 0;
      for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
      const roll = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < Math.max(14, Math.round((w * h) / (900 * dpr * dpr))); i++) {
        const r = (0.8 + roll() * 1.8) * dpr;
        ctx.beginPath();
        ctx.arc(roll() * w, roll() * h, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.font = `800 ${Math.round(12.5 * dpr)}px Manrope, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, w / 2, h / 2, w - 12 * dpr);
      grid.current = new RubGrid(Math.max(6, Math.round(box.width / 12)), Math.max(3, Math.round(box.height / 12)));
    };
    paint();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(paint);
    watch.observe(el);
    return () => watch.disconnect();
  }, [opened, id, label]);

  const finish = () => {
    if (leaving || opened) return;
    rub.current = null;
    openSecret(id);
    setLeaving(true);
    playSound('secret-open');
    haptic('confirm');
    timer.current = window.setTimeout(() => setOpened(true), LEAVE_MS);
  };

  /** Rubs from where the finger was to where it is now. */
  const rubTo = (x: number, y: number) => {
    const el = canvas.current;
    const from = rub.current;
    const cells = grid.current;
    if (!el || !from || !cells) return;
    const box = el.getBoundingClientRect();
    const ctx = el.getContext('2d');
    if (!ctx || !box.width || !box.height) return;
    const scale = el.width / box.width;
    const radius = Math.max(RUB_MIN_PX, box.width * RUB_SHARE);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius * 2 * scale;
    ctx.beginPath();
    ctx.moveTo((from.x - box.left) * scale, (from.y - box.top) * scale);
    ctx.lineTo((x - box.left) * scale, (y - box.top) * scale + 0.01);
    ctx.stroke();
    // The squares along the way count as rubbed.
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / (radius * 0.6)));
    for (let i = 0; i <= steps; i++) {
      const px = from.x + ((x - from.x) * i) / steps;
      const py = from.y + ((y - from.y) * i) / steps;
      cells.rub((px - box.left) / box.width, (py - box.top) / box.height, radius / box.width);
    }
    from.x = x;
    from.y = y;
    const now = Date.now();
    if (now - lastSound.current > SCRATCH_EVERY_MS) {
      lastSound.current = now;
      playOneOf(['scratch-1', 'scratch-2', 'scratch-3'], { rate: 0.9 + Math.random() * 0.25, gain: 0.7 });
    }
    if (cells.share >= RUB_ENOUGH) finish();
  };

  if (opened) return <span className="sc sc-open">{children}</span>;

  return (
    <span className="sc" data-leaving={leaving || undefined}>
      <span className="sc-words">{children}</span>
      <canvas
        ref={canvas}
        className="sc-foil"
        aria-label={label}
        onPointerDown={e => {
          e.stopPropagation();
          if (leaving || rub.current) return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* it still rubs while the finger stays on it */
          }
          getAudioContext();
          rub.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          rubTo(e.clientX, e.clientY);
        }}
        onPointerMove={e => {
          e.stopPropagation();
          if (rub.current?.id === e.pointerId) rubTo(e.clientX, e.clientY);
        }}
        onPointerUp={e => {
          e.stopPropagation();
          if (rub.current?.id === e.pointerId) rub.current = null;
        }}
        onPointerCancel={e => {
          e.stopPropagation();
          if (rub.current?.id === e.pointerId) rub.current = null;
        }}
        onClick={e => e.stopPropagation()}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />
      {leaving && (
        <span className="sc-sparks" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} style={{ left: `${10 + ((i * 29) % 80)}%`, top: `${20 + ((i * 47) % 60)}%`, animationDelay: `${i * 35}ms` }} />
          ))}
        </span>
      )}
    </span>
  );
};
