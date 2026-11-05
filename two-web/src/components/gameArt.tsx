import React from 'react';
import type { Mark } from '../core/paperGames';

// The drawn pieces the games share (components/PaperGames, GameBoards):
// the marks each of you plays with, and a die.

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
export const MARK_PATHS: Record<Mark, { strokes: string[]; filled: boolean }> = {
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
export const MarkGlyph: React.FC<{ mark: Mark; ink: string; x: number; y: number; s?: number; fresh: boolean; width?: number; delay?: number; cls?: string; fill?: number }> = ({
  mark,
  ink,
  x,
  y,
  s = 1,
  fresh,
  width = 8,
  delay = 0,
  cls = '',
  fill
}) => {
  const look = MARK_PATHS[mark];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={`pg-mark ${cls}`} data-fresh={fresh || undefined}>
        {look.filled && (
          <path d={look.strokes.join(' ')} fill={ink} className="pg-fill" style={{ animationDelay: `${delay + 260}ms`, ...(fill !== undefined ? { opacity: fill } : {}) }} />
        )}
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

/** A mark on its own, for the score chips, the pickers and the counters. */
export const MarkIcon: React.FC<{ mark: Mark; ink: string; size?: number; fill?: number }> = ({ mark, ink, size = 22, fill }) => (
  <svg viewBox="-34 -34 68 68" width={size} height={size} aria-hidden="true" focusable="false">
    <MarkGlyph mark={mark} ink={ink} x={0} y={0} fresh={false} width={9} fill={fill} />
  </svg>
);

/** Where the pips sit on each face of a die, on a 3 x 3 grid. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

/** One face of a die. */
export const DieFace: React.FC<{ value: number; ink?: string }> = ({ value, ink = '#3b2723' }) => (
  <span className="g-die-face" aria-hidden="true">
    {Array.from({ length: 9 }, (_, i) => (
      <i key={i} style={PIPS[value]?.includes(i) ? { background: ink } : { visibility: 'hidden' }} />
    ))}
  </span>
);
