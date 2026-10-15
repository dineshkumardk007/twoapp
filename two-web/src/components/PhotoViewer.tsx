import React, { useRef } from 'react';
import { Download, X } from 'lucide-react';
import { useBackLayer } from '../core/backStack';

interface PhotoViewerProps {
  src: string;
  /** Who sent it and when, along the top. */
  caption: string;
  onClose: () => void;
  /** Absent where there is nowhere to save to, or the photo is not to be kept. */
  onSave?: () => void;
  /** A line along the bottom: what is special about this photo. */
  note?: string;
}

const MAX_SCALE = 5;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 280;

/**
 * A photo from the chat with the whole screen to itself: pinch or double-tap
 * to look closer, drag to look around, Back or the cross to close.
 *
 * The page cannot be pinch-zoomed inside the app, so the photo zooms itself.
 * Each move is written straight onto the image rather than through React
 * state, so following a pinch costs a style change per frame, not a render.
 */
export const PhotoViewer: React.FC<PhotoViewerProps> = ({ src, caption, onClose, onSave, note }) => {
  useBackLayer(true, onClose);
  const imgRef = useRef<HTMLImageElement>(null);
  const view = useRef({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number; midX: number; midY: number; x: number; y: number } | null>(null);
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);
  const moved = useRef(false);

  const centre = () => ({ cx: window.innerWidth / 2, cy: window.innerHeight / 2 });

  const apply = (animate: boolean) => {
    const img = imgRef.current;
    if (!img) return;
    const { scale, x, y } = view.current;
    img.style.transition = animate ? 'transform 200ms ease-out' : 'none';
    img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  };

  /** Back to the whole photo when it is no bigger than the screen; never dragged off it. */
  const settle = () => {
    const img = imgRef.current;
    let { scale, x, y } = view.current;
    if (scale <= 1.02 || !img) {
      scale = 1;
      x = 0;
      y = 0;
    } else {
      const maxX = Math.max(0, (img.offsetWidth * scale - window.innerWidth) / 2);
      const maxY = Math.max(0, (img.offsetHeight * scale - window.innerHeight) / 2);
      x = Math.min(maxX, Math.max(-maxX, x));
      y = Math.min(maxY, Math.max(-maxY, y));
    }
    view.current = { scale, x, y };
    apply(true);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        scale: view.current.scale,
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        x: view.current.x,
        y: view.current.y
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const before = pointers.current.get(e.pointerId);
    if (!before) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (Math.hypot(now.x - before.x, now.y - before.y) > 2) moved.current = true;
    const p = pinch.current;
    if (pointers.current.size >= 2 && p) {
      // The point of the photo that was between the fingers stays between them.
      const [a, b] = [...pointers.current.values()];
      const scale = Math.min(MAX_SCALE, Math.max(1, (p.scale * Math.hypot(a.x - b.x, a.y - b.y)) / p.dist));
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const { cx, cy } = centre();
      const k = scale / p.scale;
      view.current = { scale, x: midX - cx - (p.midX - cx - p.x) * k, y: midY - cy - (p.midY - cy - p.y) * k };
      apply(false);
    } else if (view.current.scale > 1) {
      const v = view.current;
      view.current = { ...v, x: v.x + now.x - before.x, y: v.y + now.y - before.y };
      apply(false);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size > 0) return;
    if (!moved.current) {
      const at = Date.now();
      const tap = lastTap.current;
      if (tap && at - tap.at < DOUBLE_TAP_MS && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 30) {
        // A double tap: closer, at the place tapped - or back out.
        lastTap.current = null;
        if (view.current.scale > 1) {
          view.current = { scale: 1, x: 0, y: 0 };
        } else {
          const { cx, cy } = centre();
          const s = DOUBLE_TAP_ZOOM;
          view.current = { scale: s, x: (e.clientX - cx) * (1 - s), y: (e.clientY - cy) * (1 - s) };
        }
        settle();
        return;
      }
      lastTap.current = { at, x: e.clientX, y: e.clientY };
    }
    settle();
  };

  return (
    <div
      className="no-remap fixed inset-0 z-[85] flex items-center justify-center bg-black select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={e => e.preventDefault()}
    >
      <img
        ref={imgRef}
        src={src}
        alt={caption}
        draggable={false}
        className="max-h-full max-w-full object-contain will-change-transform"
      />
      <div
        className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/75 to-transparent px-2 pb-6 pt-[max(env(safe-area-inset-top),10px)]"
        onPointerDown={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10"
        >
          <X className="h-6 w-6" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm text-white/80">{caption}</span>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            className="flex h-11 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium text-white hover:bg-white/10"
          >
            <Download className="h-5 w-5" />
            Save
          </button>
        )}
      </div>
      {note && (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pt-8 pb-[max(env(safe-area-inset-bottom),16px)] text-center text-xs text-white/80">
          {note}
        </p>
      )}
    </div>
  );
};
