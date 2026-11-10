import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../core/i18n';
import { haptic } from '../core/haptics';
import { onAim, sayAim } from '../core/gameAim';
import { playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import {
  BASE_MAX,
  BASE_MIN,
  BASE_Y,
  BOARD,
  COINS_EACH,
  COIN_R,
  FRAME_MS,
  MAX_SHOT,
  MIN_SHOT,
  POCKETS,
  POCKET_AT,
  POCKET_R,
  STRIKER_R,
  baselineY,
  carromAfter,
  coinRoll,
  coinSpeedFrom,
  encodeShot,
  firstContact,
  forwardOf,
  nearestFree,
  playCarrom,
  reachOf,
  recordShot,
  shotAllowed,
  speedAfter,
  strikerAfter,
  type CarromState,
  type Coin,
  type Shot,
  type ShotEvent,
  type ShotRecording
} from '../core/carrom';
import type { BoardProps } from './GameBoards';

// Carrom on Canvas of Us (core/carrom has the rules and the physics).
//
// The table is two canvases: the board, painted once, and the pieces on top.
// Every piece is a small picture painted once too, so a frame is only ever a
// few dozen pictures being placed: nothing a phone of any age has to work at,
// and nothing React is involved in. A shot is worked out whole before the
// first frame, then played back at whatever rate the screen runs at, with
// each piece between its two nearest recorded places - so a 120 Hz phone
// shows 120 Hz, a busy phone drops frames without slowing down, and the coins
// always end up exactly where the other phone says they did.

/** How much of the table's width is frame, each side. */
const FRAME = 0.05;
const FALL_MS = 260;
const FADE_MS = 240;
const POP_MS = 340;
/** Their shot: the striker slides over, draws back, and goes. */
const SLIDE_MS = 240;
const DRAW_MS = 230;
const MAX_PARTS = 120;
/** Their aiming, as it comes in: eased toward the newest, so ten a second looks like one movement. */
const EASE_MS = 90;
/** An aim nothing more is heard of (their phone dropped off) is taken down after this long. */
const THEIR_AIM_MS = 8000;
/** How fast the striker leaves for this much pull. */
const speedOfPower = (power: number) => (MIN_SHOT + (MAX_SHOT - MIN_SHOT) * power ** 1.35) * 0.998;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};
/** Display only (the shot itself uses nothing random): the same grain each time it is painted. */
const grainRandom = (seed: number) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ------------------------------------------------------------ painting

/** The whole board, frame and all. Painted when it opens or changes size. */
function paintBoard(c: CanvasRenderingContext2D, size: number, inset: number, scale: number, pocketR: number) {
  const random = grainRandom(7);
  const bx = (v: number) => inset + v * scale;
  const inner = BOARD * scale;
  c.clearRect(0, 0, size, size);

  // The frame: dark rosewood, mitred at the corners.
  const radius = size * 0.028;
  c.save();
  c.beginPath();
  // Rounded where the phone can (an old WebView just gets square corners).
  if (typeof c.roundRect === 'function') c.roundRect(0, 0, size, size, radius);
  else c.rect(0, 0, size, size);
  c.clip();
  const frame = c.createLinearGradient(0, 0, size, size);
  frame.addColorStop(0, '#5d2f17');
  frame.addColorStop(0.45, '#42200f');
  frame.addColorStop(1, '#2a130a');
  c.fillStyle = frame;
  c.fillRect(0, 0, size, size);
  // Streaks along each side of the frame.
  c.lineWidth = Math.max(1, size * 0.0016);
  for (let i = 0; i < 70; i++) {
    const at = random() * inset;
    const a = 0.05 + random() * 0.12;
    c.strokeStyle = random() < 0.5 ? `rgba(255, 190, 130, ${a})` : `rgba(0, 0, 0, ${a * 1.5})`;
    c.beginPath();
    c.moveTo(at, at);
    c.lineTo(size - at, at);
    c.lineTo(size - at, size - at);
    c.lineTo(at, size - at);
    c.closePath();
    c.stroke();
  }
  // Mitres, and the light catching the top edge.
  c.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  c.lineWidth = Math.max(1, size * 0.002);
  c.beginPath();
  for (const [ax, ay, bbx, bby] of [
    [0, 0, inset, inset],
    [size, 0, size - inset, inset],
    [0, size, inset, size - inset],
    [size, size, size - inset, size - inset]
  ]) {
    c.moveTo(ax, ay);
    c.lineTo(bbx, bby);
  }
  c.stroke();
  const shine = c.createLinearGradient(0, 0, 0, inset);
  shine.addColorStop(0, 'rgba(255, 225, 190, 0.42)');
  shine.addColorStop(0.2, 'rgba(255, 225, 190, 0.05)');
  shine.addColorStop(1, 'rgba(0, 0, 0, 0)');
  c.fillStyle = shine;
  c.fillRect(0, 0, size, inset);
  c.restore();

  // The surface: pale polished maple.
  c.save();
  c.beginPath();
  c.rect(inset, inset, inner, inner);
  c.clip();
  const wood = c.createLinearGradient(inset, inset, inset + inner, inset + inner);
  wood.addColorStop(0, '#f5e3bb');
  wood.addColorStop(0.5, '#eed6a4');
  wood.addColorStop(1, '#e2c288');
  c.fillStyle = wood;
  c.fillRect(inset, inset, inner, inner);
  // The grain: long, slightly wandering lines.
  const lines = 150;
  for (let i = 0; i < lines; i++) {
    const y0 = inset + (i + random()) * (inner / lines);
    const wander = 2 + random() * 5;
    const freq = 0.004 + random() * 0.01;
    const phase = random() * 6.28;
    c.strokeStyle = `rgba(${random() < 0.2 ? '150, 95, 40' : '125, 80, 35'}, ${0.03 + random() * 0.09})`;
    c.lineWidth = Math.max(0.5, (0.4 + random() * 1.3) * (size / 720));
    c.beginPath();
    for (let x = 0; x <= inner; x += inner / 26) {
      const y = y0 + Math.sin(x * freq + phase) * wander * (size / 720);
      if (x === 0) c.moveTo(inset + x, y);
      else c.lineTo(inset + x, y);
    }
    c.stroke();
  }

  // The markings, in dark ink and red lacquer.
  const INK = 'rgba(52, 28, 14, 0.92)';
  const RED = '#b4222e';
  const thin = Math.max(1, 2.2 * scale);
  c.lineCap = 'round';

  const side = (fn: () => void) => {
    for (let k = 0; k < 4; k++) {
      c.save();
      c.translate(bx(BOARD / 2), bx(BOARD / 2));
      c.rotate((k * Math.PI) / 2);
      c.translate(-bx(BOARD / 2), -bx(BOARD / 2));
      fn();
      c.restore();
    }
  };

  // The striker's lines, with a red circle at each end.
  side(() => {
    c.strokeStyle = INK;
    c.lineWidth = thin;
    const near = BOARD - BASE_Y + STRIKER_R;
    const far = BOARD - BASE_Y - STRIKER_R;
    c.beginPath();
    c.moveTo(bx(BASE_MIN), bx(near));
    c.lineTo(bx(BASE_MAX), bx(near));
    c.moveTo(bx(BASE_MIN), bx(far));
    c.lineTo(bx(BASE_MAX), bx(far));
    c.stroke();
    for (const x of [BASE_MIN, BASE_MAX]) {
      c.beginPath();
      c.arc(bx(x), bx(BOARD - BASE_Y), STRIKER_R * scale, 0, Math.PI * 2);
      c.fillStyle = RED;
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(bx(x), bx(BOARD - BASE_Y), STRIKER_R * 0.48 * scale, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255, 240, 210, 0.92)';
      c.fill();
    }
  });

  // The arrows in from the corners, each with its curved bow.
  side(() => {
    const from = POCKET_AT + 76;
    const to = 262;
    c.strokeStyle = INK;
    c.lineWidth = thin;
    c.beginPath();
    c.moveTo(bx(from), bx(from));
    c.lineTo(bx(to), bx(to));
    c.stroke();
    // The head.
    c.beginPath();
    c.moveTo(bx(to), bx(to));
    c.lineTo(bx(to - 28), bx(to - 8));
    c.moveTo(bx(to), bx(to));
    c.lineTo(bx(to - 8), bx(to - 28));
    c.stroke();
    // The bow, across the arrow.
    c.beginPath();
    c.moveTo(bx(from + 54), bx(from - 28));
    c.quadraticCurveTo(bx(from + 22), bx(from + 22), bx(from - 28), bx(from + 54));
    c.stroke();
  });

  // The rosette in the middle.
  const cx = bx(BOARD / 2);
  c.strokeStyle = INK;
  c.lineWidth = thin;
  c.beginPath();
  c.arc(cx, cx, 176 * scale, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = thin * 0.6;
  c.beginPath();
  c.arc(cx, cx, 160 * scale, 0, Math.PI * 2);
  c.stroke();
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    const big = k % 2 === 0;
    const out = (big ? 150 : 104) * scale;
    const wide = (big ? 22 : 17) * scale;
    const start = 32 * scale;
    c.save();
    c.translate(cx, cx);
    c.rotate(a);
    c.beginPath();
    c.moveTo(start, 0);
    c.quadraticCurveTo((start + out) / 2, -wide, out, 0);
    c.quadraticCurveTo((start + out) / 2, wide, start, 0);
    c.closePath();
    c.fillStyle = big ? RED : 'rgba(52, 28, 14, 0.82)';
    c.fill();
    c.restore();
  }
  c.beginPath();
  c.arc(cx, cx, 33 * scale, 0, Math.PI * 2);
  c.fillStyle = RED;
  c.fill();
  c.lineWidth = thin;
  c.strokeStyle = INK;
  c.stroke();
  c.beginPath();
  c.arc(cx, cx, 13 * scale, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255, 240, 210, 0.95)';
  c.fill();

  // Polish: a soft window of light, and the frame's shadow on the wood.
  const gloss = c.createRadialGradient(bx(280), bx(220), 0, bx(280), bx(220), 760 * scale);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
  gloss.addColorStop(0.55, 'rgba(255, 255, 255, 0.06)');
  gloss.addColorStop(1, 'rgba(90, 50, 15, 0.1)');
  c.fillStyle = gloss;
  c.fillRect(inset, inset, inner, inner);
  const edge = 26 * scale;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
    [0, inset, 0, inset + edge, inset, inset, inner, edge],
    [inset, 0, inset + edge, 0, inset, inset, edge, inner]
  ]) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(45, 20, 5, 0.42)');
    g.addColorStop(1, 'rgba(45, 20, 5, 0)');
    c.fillStyle = g;
    c.fillRect(rx, ry, rw, rh);
  }
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
    [0, inset + inner, 0, inset + inner - edge, inset, inset + inner - edge, inner, edge],
    [inset + inner, 0, inset + inner - edge, 0, inset + inner - edge, inset, edge, inner]
  ]) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(45, 20, 5, 0.22)');
    g.addColorStop(1, 'rgba(45, 20, 5, 0)');
    c.fillStyle = g;
    c.fillRect(rx, ry, rw, rh);
  }

  // The pockets: deep, dark, with a worn brass rim.
  for (const [px, py] of POCKETS) {
    const r = pocketR * 1.06 * scale;
    const hole = c.createRadialGradient(bx(px) - r * 0.2, bx(py) - r * 0.2, r * 0.1, bx(px), bx(py), r);
    hole.addColorStop(0, '#000');
    hole.addColorStop(0.72, '#120a06');
    hole.addColorStop(1, '#3a2312');
    c.beginPath();
    c.arc(bx(px), bx(py), r, 0, Math.PI * 2);
    c.fillStyle = hole;
    c.fill();
    const rim = c.createLinearGradient(bx(px) - r, bx(py) - r, bx(px) + r, bx(py) + r);
    rim.addColorStop(0, 'rgba(90, 60, 25, 0.95)');
    rim.addColorStop(0.5, 'rgba(240, 205, 130, 0.9)');
    rim.addColorStop(1, 'rgba(120, 80, 30, 0.95)');
    c.strokeStyle = rim;
    c.lineWidth = Math.max(1.2, 4.2 * scale);
    c.stroke();
  }
  c.restore();

  // The frame's inner lip.
  c.strokeStyle = 'rgba(255, 215, 165, 0.34)';
  c.lineWidth = Math.max(1, size * 0.0022);
  c.strokeRect(inset - c.lineWidth, inset - c.lineWidth, inner + c.lineWidth * 2, inner + c.lineWidth * 2);
}

type FaceKind = 'white' | 'black' | 'queen' | 'striker';

/** A piece's face: what turns as it travels. The light on it (glossOf) does not. */
function faceOf(kind: FaceKind, rPx: number, ink: string): HTMLCanvasElement {
  const pad = 2;
  const half = Math.ceil(rPx) + pad;
  const cv = canvasOf(half * 2, half * 2);
  const c = cv.getContext('2d')!;
  c.translate(half, half);
  const r = rPx;
  const fills: Record<FaceKind, [string, string, string]> = {
    white: ['#fffef6', '#f4e6c8', '#d8bf8e'],
    black: ['#5a5760', '#2c2a31', '#101014'],
    queen: ['#ff868a', '#e8213f', '#8a0a25'],
    striker: ['#ffffff', '#eff2f7', '#c3cad6']
  };
  const [f0, f1, f2] = fills[kind];
  const body = c.createRadialGradient(-r * 0.3, -r * 0.34, r * 0.08, 0, 0, r);
  body.addColorStop(0, f0);
  body.addColorStop(0.62, f1);
  body.addColorStop(1, f2);
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fillStyle = body;
  c.fill();
  c.lineWidth = Math.max(0.8, r * 0.05);
  c.strokeStyle = kind === 'black' ? 'rgba(0, 0, 0, 0.8)' : kind === 'white' ? 'rgba(125, 95, 55, 0.75)' : kind === 'queen' ? 'rgba(90, 0, 20, 0.8)' : 'rgba(90, 100, 125, 0.75)';
  c.stroke();

  const engraved = kind === 'black' ? 'rgba(232, 208, 165, 0.5)' : kind === 'white' ? 'rgba(125, 92, 52, 0.5)' : kind === 'queen' ? 'rgba(255, 224, 150, 0.95)' : ink;
  c.strokeStyle = engraved;
  c.fillStyle = engraved;
  c.lineWidth = kind === 'striker' ? r * 0.13 : Math.max(0.7, r * 0.06);
  c.beginPath();
  c.arc(0, 0, r * (kind === 'striker' ? 0.74 : 0.76), 0, Math.PI * 2);
  c.stroke();

  if (kind === 'queen') {
    // A little crown of a star.
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = (k % 2 ? 0.2 : 0.47) * r;
      if (k) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  } else if (kind === 'striker') {
    c.beginPath();
    c.arc(0, 0, r * 0.26, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(70, 80, 105, 0.55)';
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      c.beginPath();
      c.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.042, 0, Math.PI * 2);
      c.fill();
    }
  } else {
    // A ring of beads, so you can see it spin.
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      c.beginPath();
      c.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.07, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.arc(0, 0, r * 0.12, 0, Math.PI * 2);
    c.fill();
  }
  return cv;
}

/** The highlight on a piece, always on the same side whichever way it has turned. */
function glossOf(rPx: number, soft: boolean): HTMLCanvasElement {
  const half = Math.ceil(rPx) + 2;
  const cv = canvasOf(half * 2, half * 2);
  const c = cv.getContext('2d')!;
  c.translate(half, half);
  c.beginPath();
  c.arc(0, 0, rPx, 0, Math.PI * 2);
  c.clip();
  const light = c.createRadialGradient(-rPx * 0.36, -rPx * 0.42, 0, -rPx * 0.36, -rPx * 0.42, rPx * 0.9);
  light.addColorStop(0, `rgba(255, 255, 255, ${soft ? 0.5 : 0.72})`);
  light.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
  light.addColorStop(1, 'rgba(255, 255, 255, 0)');
  c.fillStyle = light;
  c.fillRect(-half, -half, half * 2, half * 2);
  const under = c.createLinearGradient(0, -rPx * 0.1, 0, rPx);
  under.addColorStop(0, 'rgba(0, 0, 0, 0)');
  under.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
  c.fillStyle = under;
  c.fillRect(-half, -half, half * 2, half * 2);
  return cv;
}

function shadowOf(rPx: number): HTMLCanvasElement {
  const half = Math.ceil(rPx * 1.42);
  const cv = canvasOf(half * 2, half * 2);
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(half, half, rPx * 0.5, half, half, half);
  g.addColorStop(0, 'rgba(35, 15, 0, 0.55)');
  g.addColorStop(0.62, 'rgba(35, 15, 0, 0.3)');
  g.addColorStop(1, 'rgba(35, 15, 0, 0)');
  c.fillStyle = g;
  c.fillRect(0, 0, half * 2, half * 2);
  return cv;
}

function glowOf(size: number, rgb: string): HTMLCanvasElement {
  const half = Math.max(2, Math.ceil(size));
  const cv = canvasOf(half * 2, half * 2);
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, `rgba(${rgb}, 0.95)`);
  g.addColorStop(0.4, `rgba(${rgb}, 0.4)`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  c.fillStyle = g;
  c.fillRect(0, 0, half * 2, half * 2);
  return cv;
}

// ------------------------------------------------------------ the table

export interface Aim {
  ux: number;
  uy: number;
  /** 0 to 1. */
  power: number;
  ok: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  kind: 'dust' | 'gold' | 'ember';
}

/** The other one's striker, as their phone says it is while they aim. */
interface Theirs {
  seat: Seat;
  /** Where it is drawn, easing toward where it was last said to be. */
  x: number;
  toX: number;
  ux: number;
  uy: number;
  toUx: number;
  toUy: number;
  power: number;
  toPower: number;
  ok: boolean;
  aiming: boolean;
  heardAt: number;
}

interface Flash {
  x: number;
  y: number;
  at: number;
  ms: number;
  size: number;
}

interface Run {
  rec: ShotRecording;
  shot: Shot;
  seat: Seat;
  phase: 'slide' | 'draw' | 'run';
  /** When this phase began. */
  at: number;
  next: number;
  fromX: number;
  done: () => void;
  pockets: Map<number, number>;
  frameCount: number;
  slowFrames: number;
  lastFrameAt: number;
  own: boolean;
}

/** Draws the table: everything between one frame and the next happens here, away from React. */
class CarromTable {
  private live: CanvasRenderingContext2D;
  private size = 0;
  private inset = 0;
  private scale = 1;
  private flip: boolean;
  private inks: Record<Seat, string>;
  private dprCap = 2.5;
  private partScale = 1;
  private slowShots = 0;
  private cssSize = 0;

  private faces: Partial<Record<FaceKind | 'striker-user' | 'striker-partner', HTMLCanvasElement>> = {};
  private gloss: HTMLCanvasElement | null = null;
  private glossBig: HTMLCanvasElement | null = null;
  private shadow: HTMLCanvasElement | null = null;
  private shadowBig: HTMLCanvasElement | null = null;
  private dust: HTMLCanvasElement | null = null;
  private gold: HTMLCanvasElement | null = null;
  private ember: HTMLCanvasElement | null = null;

  private coins: Coin[] = [];
  private striker: { x: number; seat: Seat } | null = null;
  private aimAt: Aim | null = null;
  private theirs: Theirs | null = null;
  private flashes: Flash[] = [];
  private pocketR = POCKET_R;
  private lastBuzz = 0;
  /** A big moment on the table, for the board round it to answer: the Queen going in. */
  onBig: ((what: 'queen') => void) | null = null;
  private run: Run | null = null;
  private turn = new Map<number, number>();
  private pops = new Map<number, number>();
  private fade: { x: number; y: number; seat: Seat; at: number } | null = null;
  private parts: Particle[] = [];
  private lastTick = 0;
  private dt = 16;
  private raf = 0;
  private lastClick = 0;
  private lastWall = 0;
  private dead = false;

  constructor(private boardCv: HTMLCanvasElement, private liveCv: HTMLCanvasElement, private shaker: HTMLElement, flip: boolean, inks: Record<Seat, string>) {
    this.live = liveCv.getContext('2d')!;
    this.flip = flip;
    this.inks = inks;
  }

  destroy() {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize(css: number) {
    if (css <= 0) return;
    this.cssSize = css;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const size = Math.round(css * dpr);
    if (size === this.size) return;
    this.size = size;
    this.inset = size * FRAME;
    this.scale = (size - this.inset * 2) / BOARD;
    for (const cv of [this.boardCv, this.liveCv]) {
      cv.width = size;
      cv.height = size;
    }
    const c = this.boardCv.getContext('2d');
    if (c) paintBoard(c, size, this.inset, this.scale, this.pocketR);
    this.paintPieces();
    this.wake();
  }

  /** The pockets this game is played on (core/carrom, pocketROf). */
  setPocketR(r: number) {
    if (r === this.pocketR) return;
    this.pocketR = r;
    const c = this.boardCv.getContext('2d');
    if (c && this.size) paintBoard(c, this.size, this.inset, this.scale, r);
  }

  private paintPieces() {
    const r = COIN_R * this.scale;
    const rs = STRIKER_R * this.scale;
    this.faces = {
      white: faceOf('white', r, ''),
      black: faceOf('black', r, ''),
      queen: faceOf('queen', r, ''),
      'striker-user': faceOf('striker', rs, this.inks.user),
      'striker-partner': faceOf('striker', rs, this.inks.partner)
    };
    this.gloss = glossOf(r, false);
    this.glossBig = glossOf(rs, true);
    this.shadow = shadowOf(r);
    this.shadowBig = shadowOf(rs);
    this.dust = glowOf(14 * this.scale, '255, 248, 235');
    this.gold = glowOf(10 * this.scale, '255, 214, 110');
    this.ember = glowOf(7 * this.scale, '255, 255, 235');
  }

  setInks(inks: Record<Seat, string>) {
    if (inks.user === this.inks.user && inks.partner === this.inks.partner) return;
    this.inks = inks;
    if (this.size) this.paintPieces();
    this.wake();
  }

  /** Where everything rests now. */
  show(coins: Coin[], striker: { x: number; seat: Seat } | null) {
    this.coins = coins;
    this.striker = striker;
    this.wake();
  }

  setStriker(striker: { x: number; seat: Seat } | null) {
    this.striker = striker;
    this.wake();
  }

  aim(aim: Aim | null) {
    this.aimAt = aim;
    this.wake();
  }

  cancel() {
    this.run = null;
    this.fade = null;
    this.pops.clear();
    this.parts.length = 0;
    this.flashes.length = 0;
    this.aimAt = null;
    this.theirs = null;
  }

  /** Their striker, from their phone: where it sits, and how they are aiming (or not). */
  hear(seat: Seat, x: number, aim: Aim | null) {
    const now = performance.now();
    const t = this.theirs;
    if (!t || t.seat !== seat) {
      this.theirs = {
        seat,
        x,
        toX: x,
        ux: aim?.ux ?? 0,
        uy: aim?.uy ?? forwardOf(seat),
        toUx: aim?.ux ?? 0,
        toUy: aim?.uy ?? forwardOf(seat),
        power: 0,
        toPower: aim?.power ?? 0,
        ok: aim?.ok ?? false,
        aiming: !!aim,
        heardAt: now
      };
    } else {
      t.toX = x;
      if (aim) {
        if (!t.aiming) {
          // A new pull starts where it is, not swinging round from the last one.
          t.ux = aim.ux;
          t.uy = aim.uy;
          t.power = 0;
        }
        t.toUx = aim.ux;
        t.toUy = aim.uy;
        t.toPower = aim.power;
        t.ok = aim.ok;
      } else {
        t.toPower = 0;
      }
      t.aiming = !!aim;
      t.heardAt = now;
    }
    this.wake();
  }

  /** Their striker is put away: their shot is here, or it is no longer their turn. */
  hush() {
    if (!this.theirs) return;
    this.theirs = null;
    this.wake();
  }

  /** Where their striker is showing, if it is: their shot starts from there. */
  theirShown(): { x: number; aiming: boolean } | null {
    return this.theirs ? { x: this.theirs.x, aiming: this.theirs.aiming && this.theirs.power > 0.05 } : null;
  }

  /** Gold over the whole table: the Queen is won. */
  celebrate() {
    const now = performance.now();
    for (let i = 0; i < 5; i++) {
      const x = 180 + Math.random() * 640;
      const y = 180 + Math.random() * 640;
      this.flashes.push({ x, y, at: now + i * 110, ms: 620, size: 150 });
      this.sparkle(x, y, 14);
    }
    this.wake();
  }

  /** Puts these back on the board, popping in as they come. */
  popIn(ids: number[]) {
    const now = performance.now();
    ids.forEach((id, i) => this.pops.set(id, now + i * 120));
    this.wake();
  }

  /** Plays a recorded shot, then calls `done`. Your own goes at once; theirs slides over and draws back first. */
  playShot(rec: ShotRecording, shot: Shot, seat: Seat, own: boolean, fromX: number, done: () => void, drawn = false) {
    // Which pocket each piece went to: the one nearest its last place.
    const pockets = new Map<number, number>();
    rec.goneAt.forEach((g, i) => {
      if (g < 0) return;
      const f = rec.frames[Math.min(g, rec.frames.length - 1)];
      let best = 0;
      let bestD = Infinity;
      POCKETS.forEach(([px, py], p) => {
        const d = (f[i * 2] - px) ** 2 + (f[i * 2 + 1] - py) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      });
      pockets.set(i, best);
    });
    this.aimAt = null;
    this.striker = null;
    this.theirs = null;
    this.fade = null;
    this.run = {
      rec,
      shot,
      seat,
      // Theirs, watched being drawn back just now, goes as yours does: at once.
      phase: own || drawn ? 'run' : 'slide',
      at: performance.now(),
      next: 0,
      fromX,
      done,
      pockets,
      frameCount: 0,
      slowFrames: 0,
      lastFrameAt: 0,
      own
    };
    if (own || drawn) this.onStrike(shot, seat, own);
    this.wake();
  }

  private onStrike(shot: Shot, seat: Seat, own: boolean) {
    const power = Math.sqrt(shot.dx * shot.dx + shot.dy * shot.dy) / MAX_SHOT;
    if (!own) playSound('g-cr-strike', { gain: 0.55 + power * 0.45 });
    // The hardest shots give the table a tiny knock.
    if (power > 0.7 && typeof this.shaker.animate === 'function') {
      const by = (power - 0.7) * 6 + 0.6;
      this.shaker.animate(
        [
          { transform: 'translate3d(0, 0, 0)' },
          { transform: `translate3d(0, ${(forwardOf(seat) * (this.flip ? -1 : 1) * by).toFixed(2)}px, 0)` },
          { transform: 'translate3d(0, 0, 0)' }
        ],
        { duration: 130, easing: 'ease-out' }
      );
    }
  }

  private wake() {
    if (this.raf || this.dead) return;
    this.raf = requestAnimationFrame(t => {
      this.raf = 0;
      if (this.dead) return;
      if (this.tick(t)) this.wake();
    });
  }

  private sx(x: number) {
    return this.inset + (this.flip ? BOARD - x : x) * this.scale;
  }
  private sy(y: number) {
    return this.inset + (this.flip ? BOARD - y : y) * this.scale;
  }

  private addPart(p: Omit<Particle, 'age'>) {
    if (this.parts.length >= MAX_PARTS) return;
    this.parts.push({ ...p, age: 0 });
  }

  private puff(x: number, y: number, count: number, force: number) {
    const n = Math.round(count * this.partScale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = force * (0.3 + Math.random() * 0.7);
      this.addPart({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 240 + Math.random() * 260, size: 0.5 + Math.random() * 0.8, kind: 'dust' });
    }
  }

  private sparkle(x: number, y: number, count: number) {
    const n = Math.round(count * this.partScale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 300;
      this.addPart({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 340 + Math.random() * 420, size: 0.5 + Math.random() * 0.9, kind: i % 3 ? 'gold' : 'ember' });
    }
  }

  private fire(e: ShotEvent, now: number, late: boolean) {
    const gain = (power: number, lo: number) => clamp(lo + power / 2400, lo, 1);
    if (e.type === 'hit') {
      if (!late && now - this.lastClick > 26) {
        this.lastClick = now;
        playSound('g-cr-click', { gain: gain(e.power, 0.14), rate: 0.86 + Math.random() * 0.34 });
      }
      // A hard knock is felt as well as heard - but not every click of a break.
      if (!late && e.power > 1300 && now - this.lastBuzz > 150) {
        this.lastBuzz = now;
        haptic('tick');
      }
      if (e.power > 900) this.puff(e.x, e.y, e.power > 1800 ? 5 : 3, e.power * 0.1);
    } else if (e.type === 'wall') {
      if (!late && now - this.lastWall > 45) {
        this.lastWall = now;
        playSound('g-cr-wall', { gain: gain(e.power, 0.16), rate: 0.9 + Math.random() * 0.2 });
      }
      if (e.power > 1100) this.puff(e.x, e.y, 2, e.power * 0.07);
    } else {
      const [px, py] = POCKETS[e.pocket ?? 0];
      if (e.kind === 'striker') {
        if (!late) playSound('g-cr-foul');
        haptic('reject');
      } else if (e.kind === 'queen') {
        // The Queen: gold from the pocket, a ring of light, and the table feels it.
        if (!late) playSound('g-cr-queen', { rate: 0.95 + Math.random() * 0.1 });
        haptic('confirm');
        this.sparkle(px, py, 40);
        this.flashes.push({ x: px, y: py, at: now, ms: 700, size: 330 }, { x: px, y: py, at: now + 130, ms: 700, size: 240 });
        if (typeof this.shaker.animate === 'function') {
          this.shaker.animate(
            [
              { transform: 'translate3d(0, 0, 0) scale(1)' },
              { transform: 'translate3d(0, 0, 0) scale(1.014)' },
              { transform: 'translate3d(0, 0, 0) scale(1)' }
            ],
            { duration: 320, easing: 'ease-out' }
          );
        }
        this.onBig?.('queen');
      } else {
        if (!late) playSound('g-cr-pocket', { rate: 0.95 + Math.random() * 0.1 });
        haptic('confirm');
        this.sparkle(px, py, 12);
        this.flashes.push({ x: px, y: py, at: now, ms: 380, size: 120 });
      }
    }
  }

  /** One picture. Whether there is more to come. */
  private tick(now: number): boolean {
    const c = this.live;
    if (!this.size) return false;
    const dt = this.lastTick ? Math.min(50, now - this.lastTick) : 16;
    this.lastTick = now;
    this.dt = dt;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.size, this.size);
    let more = false;

    const run = this.run;
    if (run) {
      more = true;
      this.drawRun(run, now);
    } else {
      this.drawResting(now);
    }

    if (this.aimAt && this.striker) this.drawAim(this.striker, this.aimAt, false);
    else if (!run && !this.striker && this.theirs) {
      const t = this.theirs;
      if (t.aiming && now - t.heardAt > THEIR_AIM_MS) {
        t.aiming = false;
        t.toPower = 0;
      }
      if (t.power > 0.02) {
        const len = Math.sqrt(t.ux * t.ux + t.uy * t.uy) || 1;
        this.drawAim({ x: t.x, seat: t.seat }, { ux: t.ux / len, uy: t.uy / len, power: t.power, ok: t.ok }, true);
      }
      // Still easing toward what was last heard, or waiting to hear more.
      if (t.aiming || Math.abs(t.toX - t.x) > 0.4 || Math.abs(t.toPower - t.power) > 0.004) more = true;
    }

    if (this.flashes.length) {
      let w = 0;
      for (const f of this.flashes) {
        const t = (now - f.at) / f.ms;
        if (t >= 1) continue;
        this.flashes[w++] = f;
        if (t < 0) continue;
        const e = 1 - (1 - t) ** 3;
        c.globalAlpha = (1 - t) * 0.9;
        c.strokeStyle = '#ffe08a';
        c.lineWidth = Math.max(1.5, (1 - t) * 14 * this.scale);
        c.beginPath();
        c.arc(this.sx(f.x), this.sy(f.y), Math.max(1, e * f.size * this.scale), 0, Math.PI * 2);
        c.stroke();
      }
      this.flashes.length = w;
      c.globalAlpha = 1;
      if (w) more = true;
    }

    if (this.fade) {
      const t = (now - this.fade.at) / FADE_MS;
      if (t >= 1) this.fade = null;
      else {
        more = true;
        this.drawStriker(this.fade.x, this.fade.y, this.fade.seat, 1 - t, 1 + t * 0.12);
      }
    }

    if (this.pops.size) more = true;

    // Dust and sparks, on top.
    if (this.parts.length) {
      more = true;
      const k = dt / 1000;
      let w = 0;
      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i];
        p.age += dt;
        if (p.age >= p.life) continue;
        p.x += p.vx * k;
        p.y += p.vy * k;
        p.vx *= 0.94;
        p.vy *= 0.94;
        const t = p.age / p.life;
        const img = p.kind === 'dust' ? this.dust : p.kind === 'gold' ? this.gold : this.ember;
        if (img) {
          const s = (p.kind === 'dust' ? 1 + t * 1.7 : 1 - t * 0.55) * p.size;
          c.globalAlpha = p.kind === 'dust' ? (1 - t) * 0.42 : 1 - t * t;
          c.globalCompositeOperation = p.kind === 'dust' ? 'source-over' : 'lighter';
          const w2 = img.width * s;
          c.drawImage(img, this.sx(p.x) - w2 / 2, this.sy(p.y) - w2 / 2, w2, w2);
        }
        this.parts[w++] = p;
      }
      this.parts.length = w;
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }

    if (!more) this.lastTick = 0;
    return more;
  }

  private drawStriker(x: number, y: number, seat: Seat, alpha = 1, scale = 1, spin = 0) {
    const c = this.live;
    const face = this.faces[seat === 'user' ? 'striker-user' : 'striker-partner'];
    if (!face || !this.shadowBig || !this.glossBig) return;
    const px = this.sx(x);
    const py = this.sy(y);
    const lift = this.scale * 4;
    c.globalAlpha = alpha;
    const sw = this.shadowBig.width * scale;
    c.drawImage(this.shadowBig, px - sw / 2 + lift, py - sw / 2 + lift * 1.4, sw, sw);
    const w = face.width * scale;
    c.save();
    c.translate(px, py);
    c.rotate(spin);
    c.drawImage(face, -w / 2, -w / 2, w, w);
    c.restore();
    const gw = this.glossBig.width * scale;
    c.drawImage(this.glossBig, px - gw / 2, py - gw / 2, gw, gw);
    c.globalAlpha = 1;
  }

  private drawCoin(kind: Coin['kind'], px: number, py: number, spin: number, scale: number, alpha: number, shadow: boolean) {
    const c = this.live;
    const face = this.faces[kind];
    if (!face || !this.gloss || !this.shadow) return;
    const lift = this.scale * 3;
    c.globalAlpha = alpha;
    if (shadow) {
      const sw = this.shadow.width * scale;
      c.drawImage(this.shadow, px - sw / 2 + lift, py - sw / 2 + lift * 1.4, sw, sw);
    }
    const w = face.width * scale;
    if (spin) {
      const cos = Math.cos(spin);
      const sin = Math.sin(spin);
      c.setTransform(cos, sin, -sin, cos, px, py);
      c.drawImage(face, -w / 2, -w / 2, w, w);
      c.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      c.drawImage(face, px - w / 2, py - w / 2, w, w);
    }
    const gw = this.gloss.width * scale;
    c.drawImage(this.gloss, px - gw / 2, py - gw / 2, gw, gw);
    c.globalAlpha = 1;
  }

  private drawResting(now: number) {
    // Shadows and pieces in one pass: nothing moves, so nothing overlaps.
    for (const coin of this.coins) {
      let scale = 1;
      let alpha = 1;
      const pop = this.pops.get(coin.id);
      if (pop !== undefined) {
        const t = (now - pop) / POP_MS;
        if (t >= 1) this.pops.delete(coin.id);
        else if (t <= 0) continue;
        else {
          // Over and back, like a coin dropped in place.
          const e = 1 - (1 - t) ** 3;
          scale = e * (1 + 0.28 * Math.sin(t * Math.PI));
          alpha = Math.min(1, t * 3);
        }
      }
      this.drawCoin(coin.kind, this.sx(coin.x), this.sy(coin.y), this.turn.get(coin.id) ?? 0, scale, alpha, true);
    }
    if (this.striker) {
      const s = this.striker;
      const aim = this.aimAt;
      // Drawn back along the line as you pull: it springs forward when you let go.
      const back = aim && aim.ok ? aim.power * 24 : 0;
      this.drawStriker(s.x - (aim ? aim.ux : 0) * back, baselineY(s.seat) - (aim ? aim.uy : 0) * back, s.seat);
    } else if (this.theirs) {
      // Theirs, following their finger a moment behind.
      const t = this.theirs;
      const k = 1 - Math.exp(-this.dt / EASE_MS);
      t.x += (t.toX - t.x) * k;
      t.ux += (t.toUx - t.ux) * k;
      t.uy += (t.toUy - t.uy) * k;
      t.power += (t.toPower - t.power) * k;
      const len = Math.sqrt(t.ux * t.ux + t.uy * t.uy) || 1;
      const back = t.ok ? t.power * 24 : 0;
      this.drawStriker(t.x - (t.ux / len) * back, baselineY(t.seat) - (t.uy / len) * back, t.seat);
    }
  }

  private drawRun(run: Run, now: number) {
    const rec = run.rec;
    const y0 = baselineY(run.seat);
    if (run.phase !== 'run') {
      // Their turn: the striker comes over, draws back and goes.
      for (const coin of this.coins) this.drawCoin(coin.kind, this.sx(coin.x), this.sy(coin.y), this.turn.get(coin.id) ?? 0, 1, 1, true);
      const speed = Math.sqrt(run.shot.dx * run.shot.dx + run.shot.dy * run.shot.dy) || 1;
      if (run.phase === 'slide') {
        const t = (now - run.at) / SLIDE_MS;
        if (t >= 1) {
          run.phase = 'draw';
          run.at = now;
        }
        const e = clamp(t, 0, 1);
        const eased = e * e * (3 - 2 * e);
        this.drawStriker(run.fromX + (run.shot.x - run.fromX) * eased, y0, run.seat, Math.min(1, e * 3));
        return;
      }
      const t = (now - run.at) / DRAW_MS;
      if (t >= 1) {
        run.phase = 'run';
        run.at = now;
        this.onStrike(run.shot, run.seat, false);
      } else {
        const back = 26 * (speed / MAX_SHOT + 0.3) * (1 - (1 - t) ** 3);
        this.drawStriker(run.shot.x - (run.shot.dx / speed) * back, y0 - (run.shot.dy / speed) * back, run.seat);
        return;
      }
    }

    const elapsed = now - run.at;
    // A late start (the phone was busy) is not made up by jumping: the sound and the picture stay together.
    if (run.lastFrameAt) {
      run.frameCount++;
      if (now - run.lastFrameAt > 26) run.slowFrames++;
    }
    run.lastFrameAt = now;

    const events = rec.events;
    while (run.next < events.length && events[run.next].at <= elapsed) {
      const e = events[run.next++];
      this.fire(e, now, elapsed - e.at > 180);
    }

    const framesTotal = rec.frames.length;
    const f = clamp(elapsed / FRAME_MS, 0, framesTotal - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(i0 + 1, framesTotal - 1);
    const u = f - i0;
    const a = rec.frames[i0];
    const b = rec.frames[i1];
    const n = rec.ids.length;
    const c = this.live;

    // Shadows first, so no piece's shadow falls on another piece.
    const lift = this.scale * 3;
    for (let i = 0; i < n; i++) {
      const gone = rec.goneAt[i];
      if (gone >= 0 && i0 >= gone) continue;
      const x = a[i * 2] + (b[i * 2] - a[i * 2]) * u;
      const y = a[i * 2 + 1] + (b[i * 2 + 1] - a[i * 2 + 1]) * u;
      const big = rec.kinds[i] === 'striker';
      const img = big ? this.shadowBig : this.shadow;
      if (!img) continue;
      const k = big ? 1.3 : 1;
      c.drawImage(img, this.sx(x) - img.width / 2 + lift * k, this.sy(y) - img.height / 2 + lift * 1.4 * k);
    }

    for (let i = 0; i < n; i++) {
      const id = rec.ids[i];
      const gone = rec.goneAt[i];
      const kind = rec.kinds[i];
      const px0 = a[i * 2];
      const py0 = a[i * 2 + 1];
      if (gone >= 0 && i0 >= gone) {
        // Falling in: toward the pocket's middle, smaller and into the dark.
        const t = (elapsed - gone * FRAME_MS) / FALL_MS;
        if (t >= 1) continue;
        const from = rec.frames[Math.min(gone, framesTotal - 1)];
        const [hx, hy] = POCKETS[run.pockets.get(i) ?? 0];
        const e = t * t;
        const x = from[i * 2] + (hx - from[i * 2]) * Math.min(1, t * 1.5);
        const y = from[i * 2 + 1] + (hy - from[i * 2 + 1]) * Math.min(1, t * 1.5);
        const scale = 1 - e * 0.62;
        const alpha = 1 - e;
        if (kind === 'striker') this.drawStriker(x, y, run.seat, alpha, scale);
        else this.drawCoin(kind, this.sx(x), this.sy(y), this.turn.get(id) ?? 0, scale, alpha, false);
        continue;
      }
      const dx = b[i * 2] - px0;
      const dy = b[i * 2 + 1] - py0;
      const x = px0 + dx * u;
      const y = py0 + dy * u;
      const step = Math.sqrt(dx * dx + dy * dy);
      // It turns a little as it travels.
      let spin = this.turn.get(id) ?? 0;
      if (step > 0.01) {
        spin += ((step * (this.dt / FRAME_MS) * 0.5) / (kind === 'striker' ? STRIKER_R : COIN_R)) * (id % 2 ? 1 : -1);
        this.turn.set(id, spin);
      }
      if (kind === 'striker') {
        // A fast striker leaves the faintest trace of where it just was.
        if (step > 22) this.drawStrikerFace(x - dx * 0.9, y - dy * 0.9, run.seat, 0.2, spin);
        this.drawStrikerFace(x, y, run.seat, 1, spin);
      } else {
        if (step > 22) this.drawCoin(kind, this.sx(x - dx * 0.9), this.sy(y - dy * 0.9), spin, 1, 0.2, false);
        this.drawCoin(kind, this.sx(x), this.sy(y), spin, 1, 1, false);
      }
    }

    if (elapsed >= rec.ms + 40) {
      // Done. The striker fades from where it stopped.
      const iS = rec.ids.indexOf(-1);
      const end = rec.frames[framesTotal - 1];
      if (rec.goneAt[iS] < 0) this.fade = { x: end[iS * 2], y: end[iS * 2 + 1], seat: run.seat, at: now };
      this.noteSpeed(run);
      this.run = null;
      run.done();
    }
  }

  /** A phone struggling to keep up gets a slightly softer picture, so its frames stay even. */
  private noteSpeed(run: Run) {
    if (run.frameCount < 12) return;
    if (run.slowFrames / run.frameCount > 0.3) this.slowShots++;
    else this.slowShots = 0;
    if (this.slowShots >= 2 && this.dprCap > 1.25) {
      this.slowShots = 0;
      this.dprCap = this.dprCap > 2 ? 2 : this.dprCap > 1.5 ? 1.5 : 1.25;
      this.partScale = 0.55;
      if (this.cssSize) this.resize(this.cssSize);
    }
  }

  private drawStrikerFace(x: number, y: number, seat: Seat, alpha: number, spin: number) {
    const c = this.live;
    const face = this.faces[seat === 'user' ? 'striker-user' : 'striker-partner'];
    if (!face || !this.glossBig) return;
    const px = this.sx(x);
    const py = this.sy(y);
    c.globalAlpha = alpha;
    const cos = Math.cos(spin);
    const sin = Math.sin(spin);
    c.setTransform(cos, sin, -sin, cos, px, py);
    c.drawImage(face, -face.width / 2, -face.height / 2);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.glossBig, px - this.glossBig.width / 2, py - this.glossBig.height / 2);
    c.globalAlpha = 1;
  }

  /**
   * The aiming line: to whatever the striker would touch first; the path the
   * coin it touches would take, all the way to the pocket or the side it is
   * headed for; how far along that this much power would carry it; and which
   * way the striker itself goes on. `theirs`: the other one's aim, drawn paler.
   */
  private drawAim(s: { x: number; seat: Seat }, aim: Aim, theirs: boolean) {
    const c = this.live;
    const sx0 = s.x;
    const sy0 = baselineY(s.seat);
    const r = STRIKER_R * this.scale;
    const hue = aim.ok ? (aim.power < 0.5 ? '#34d399' : aim.power < 0.8 ? '#f59e0b' : '#ef4444') : '#9ca3af';
    const see = theirs ? 0.6 : 1;
    c.globalAlpha = see;

    // How hard: a ring round the striker, closing as you pull.
    c.lineCap = 'round';
    c.lineWidth = Math.max(2, 5 * this.scale);
    c.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    c.beginPath();
    c.arc(this.sx(sx0), this.sy(sy0), r * 1.32, 0, Math.PI * 2);
    c.stroke();
    if (aim.ok) {
      c.strokeStyle = hue;
      c.beginPath();
      c.arc(this.sx(sx0), this.sy(sy0), r * 1.32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.03, aim.power));
      c.stroke();
    }
    if (!aim.ok) {
      c.globalAlpha = 1;
      return;
    }

    const hit = firstContact(this.coins, sx0, sy0, aim.ux, aim.uy);
    const ex = sx0 + aim.ux * hit.t;
    const ey = sy0 + aim.uy * hit.t;
    const DARK = 'rgba(45, 22, 8, 0.6)';
    const dash = [Math.max(4, 14 * this.scale), Math.max(4, 12 * this.scale)];

    /** A line in board units: dark underneath, so it reads on pale wood and dark coins alike. */
    const line = (x0: number, y0: number, x1: number, y1: number, colour: string, width: number, dashed: boolean) => {
      c.beginPath();
      c.moveTo(this.sx(x0), this.sy(y0));
      c.lineTo(this.sx(x1), this.sy(y1));
      c.strokeStyle = DARK;
      c.lineWidth = Math.max(2.5, (width + 3.5) * this.scale);
      c.stroke();
      c.strokeStyle = colour;
      c.lineWidth = Math.max(1.5, width * this.scale);
      if (dashed) c.setLineDash(dash);
      c.stroke();
      c.setLineDash([]);
    };

    const from = STRIKER_R * 1.4;
    if (hit.t > from) line(sx0 + aim.ux * from, sy0 + aim.uy * from, ex, ey, '#ffffff', 4, true);

    // Where the striker would be when it touches.
    c.strokeStyle = DARK;
    c.lineWidth = Math.max(2.5, 6.5 * this.scale);
    c.beginPath();
    c.arc(this.sx(ex), this.sy(ey), r, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#ffffff';
    c.lineWidth = Math.max(1.2, 3.2 * this.scale);
    c.stroke();
    c.fillStyle = 'rgba(255, 255, 255, 0.22)';
    c.fill();

    const speed = speedAfter(speedOfPower(aim.power), hit.t);
    if (hit.coin) {
      const coin = hit.coin;
      const nx = (coin.x - ex) / (COIN_R + STRIKER_R);
      const ny = (coin.y - ey) / (COIN_R + STRIKER_R);
      // The coin's whole path, faint; and as far as this much power sends it, bright.
      const roll = coinRoll(this.coins, coin, nx, ny, this.pocketR);
      const far = Math.sqrt((roll.x - coin.x) ** 2 + (roll.y - coin.y) ** 2);
      const reach = reachOf(coinSpeedFrom(speed * (aim.ux * nx + aim.uy * ny)));
      const lit = Math.min(far, reach);
      if (far > COIN_R) line(coin.x + nx * COIN_R, coin.y + ny * COIN_R, coin.x + nx * far, coin.y + ny * far, 'rgba(255, 255, 255, 0.75)', 3, true);
      if (lit > COIN_R) line(coin.x + nx * COIN_R, coin.y + ny * COIN_R, coin.x + nx * lit, coin.y + ny * lit, hue, 5, false);
      if (roll.pocket >= 0) {
        // Headed for a pocket: it lights up, brighter if this is enough to get there.
        const makes = reach >= far - this.pocketR * 0.5;
        const [px, py] = POCKETS[roll.pocket];
        c.beginPath();
        c.arc(this.sx(px), this.sy(py), this.pocketR * 1.12 * this.scale, 0, Math.PI * 2);
        c.fillStyle = makes ? 'rgba(52, 211, 153, 0.4)' : 'rgba(255, 255, 255, 0.16)';
        c.fill();
        c.strokeStyle = makes ? '#34d399' : 'rgba(255, 255, 255, 0.8)';
        c.lineWidth = Math.max(2, (makes ? 6.5 : 4) * this.scale);
        c.stroke();
      }
      // And the striker, carrying on.
      const [ax, ay] = strikerAfter(aim.ux, aim.uy, nx, ny);
      if (ax || ay) line(ex + ax * STRIKER_R, ey + ay * STRIKER_R, ex + ax * (STRIKER_R + 110), ey + ay * (STRIKER_R + 110), 'rgba(255, 255, 255, 0.85)', 2.6, false);
    } else if (hit.bounce) {
      const len = Math.min(340, Math.max(120, reachOf(speed * 0.76)));
      line(ex, ey, ex + hit.bounce[0] * len, ey + hit.bounce[1] * len, 'rgba(255, 255, 255, 0.85)', 3.4, false);
    }
    c.globalAlpha = 1;
  }
}

// ------------------------------------------------------------ the board

const TrayCoin: React.FC<{ kind: 'white' | 'black' | 'queen' }> = ({ kind }) => <i className="cr-coin" data-kind={kind} aria-hidden="true" />;

/** A finger on the board: not yet known which (it began on the striker), aiming, or moving the striker along. */
interface Touch {
  x: number;
  y: number;
  id: number;
  mode: 'undecided' | 'aim' | 'move';
  /** Moving the striker: how far its middle was from the finger when it was picked up. */
  off: number;
}

export const CarromBoard: React.FC<BoardProps> = React.memo(({ game, me, inkOf, canAct, onMove, onSettled, partnerName }) => {
  const tr = useT();
  const them: Seat = me === 'user' ? 'partner' : 'user';
  const flip = me === 'partner';
  const wrapRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const powerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<CarromTable | null>(null);

  const [shown, setShown] = useState<CarromState>(() => playCarrom(game));
  const [wanted, setWanted] = useState(BOARD / 2);
  const [busy, setBusy] = useState(false);
  const [aiming, setAiming] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [note, setNote] = useState<{ key: number; text: string; tone: 'good' | 'bad' | 'gold'; big?: boolean } | null>(null);

  const gameRef = useRef(game);
  gameRef.current = game;
  const idRef = useRef(game.id);
  const shownCount = useRef(game.moves.length);
  const running = useRef(false);
  const ownMove = useRef<number | null>(null);
  const timer = useRef(0);
  const flashTimer = useRef(0);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  const nameRef = useRef(partnerName);
  nameRef.current = partnerName;
  const trRef = useRef(tr);
  trRef.current = tr;
  const lastX = useRef<Record<Seat, number>>({ user: BOARD / 2, partner: BOARD / 2 });
  const inks = useMemo(() => ({ user: inkOf('user'), partner: inkOf('partner') }), [inkOf]);
  const inksRef = useRef(inks);
  inksRef.current = inks;

  // Where the striker is: as near as it can be to where you last put it.
  const strikerX = useMemo(() => nearestFree(shown.coins, me, wanted), [shown.coins, me, wanted]);
  const strikerRef = useRef(strikerX);
  strikerRef.current = strikerX;

  /** A wash of gold over the table for a moment (index.css, .cr-table[data-flash]). */
  const flash = useCallback((what: 'queen' | 'crown') => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    delete wrap.dataset.flash;
    // Read back, so the same flash twice running starts over.
    void wrap.offsetWidth;
    wrap.dataset.flash = what;
    clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => delete wrap.dataset.flash, 1300);
  }, []);

  const announce = useCallback((after: CarromState) => {
    const last = after.last;
    if (!last) return;
    const mine = last.seat === (me as Seat);
    const t = trRef.current;
    const name = nameRef.current;
    let text = '';
    let tone: 'good' | 'bad' | 'gold' = 'good';
    let big = false;
    switch (last.note) {
      case 'own':
        text = mine ? t('In! Go again') : t('{name} pots one', { name });
        break;
      case 'theirs':
        text = mine ? t('That one was theirs') : t('A gift from {name}!', { name });
        tone = mine ? 'bad' : 'good';
        break;
      case 'queen':
        text = mine ? t('The Queen! Now cover her') : t('{name} has the Queen - for now', { name });
        tone = 'gold';
        break;
      case 'covered':
        // The Queen is won: the biggest moment short of the game itself.
        text = mine ? t('The Queen is yours!') : t('The Queen goes to {name}', { name });
        tone = 'gold';
        big = true;
        playSound('g-cr-cover');
        tableRef.current?.celebrate();
        flash('crown');
        haptic('confirm');
        window.setTimeout(() => haptic('confirm'), 160);
        break;
      case 'queen-back':
        text = t('The Queen goes back');
        tone = 'bad';
        break;
      case 'foul':
        text = mine ? t('Foul! Striker in the pocket') : t('Foul by {name}!', { name });
        tone = 'bad';
        break;
      case 'last-back':
        text = t('Win the Queen before your last coin');
        tone = 'bad';
        break;
      default:
        return;
    }
    setNote({ key: Date.now(), text, tone, big });
  }, [me, flash]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), note.big ? 2600 : 1900);
    return () => clearTimeout(t);
  }, [note]);

  // Each shot in turn, as it comes in.
  const pump = useCallback(() => {
    const table = tableRef.current;
    if (running.current || !table) return;
    const g = gameRef.current;
    const k = shownCount.current;
    if (k >= g.moves.length) {
      setBusy(false);
      settledRef.current?.(k);
      return;
    }
    const before = carromAfter(g, k);
    if (before.played !== k) {
      // Not legal where it stands: the phones have already dropped it.
      shownCount.current = g.moves.length;
      setBusy(false);
      settledRef.current?.(g.moves.length);
      return;
    }
    running.current = true;
    setBusy(true);
    const move = g.moves[k];
    const { recording, shot } = recordShot(before, move);
    const own = ownMove.current === move;
    if (own) ownMove.current = null;
    // Their striker, if it was showing as they aimed: the shot goes from where it is.
    const watched = own ? null : table.theirShown();
    table.show(before.coins, null);
    const seat = before.turn;
    const fromX = watched ? watched.x : lastX.current[seat];
    lastX.current[seat] = shot.x;
    table.playShot(
      recording,
      shot,
      seat,
      own,
      fromX,
      () => {
        const after = carromAfter(gameRef.current, k + 1);
        table.show(after.coins, null);
        const returned = after.last?.returned.map(c => c.id) ?? [];
        if (returned.length) {
          table.popIn(returned);
          playSound('g-cr-back');
        }
        setShown(after);
        announce(after);
        shownCount.current = k + 1;
        running.current = false;
        const more = gameRef.current.moves.length > k + 1;
        timer.current = window.setTimeout(pump, more ? 520 : 40);
      },
      !!watched?.aiming
    );
  }, [announce]);
  const pumpRef = useRef(pump);
  pumpRef.current = pump;

  // The table itself: made once, and told the size whenever that changes.
  useEffect(() => {
    const wrap = wrapRef.current;
    const board = boardRef.current;
    const live = liveRef.current;
    if (!wrap || !board || !live) return;
    const table = new CarromTable(board, live, wrap, flip, inksRef.current);
    tableRef.current = table;
    const start = playCarrom(gameRef.current);
    table.setPocketR(start.pocketR);
    table.onBig = () => flash('queen');
    table.resize(wrap.clientWidth);
    table.show(start.coins, null);
    const seen = new ResizeObserver(() => table.resize(wrap.clientWidth));
    seen.observe(wrap);
    pumpRef.current();
    return () => {
      seen.disconnect();
      table.destroy();
      tableRef.current = null;
      running.current = false;
      clearTimeout(timer.current);
      clearTimeout(flashTimer.current);
    };
    // Only the once: `flip` follows the seat, which does not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => tableRef.current?.setInks(inks), [inks]);
  useEffect(() => tableRef.current?.setPocketR(shown.pocketR), [shown.pocketR]);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    if (idRef.current !== game.id || game.moves.length < shownCount.current) {
      // A new game: everything back in place, at once.
      clearTimeout(timer.current);
      table.cancel();
      running.current = false;
      idRef.current = game.id;
      shownCount.current = game.moves.length;
      ownMove.current = null;
      const fresh = playCarrom(game);
      setShown(fresh);
      setNote(null);
      setBusy(false);
      setReplaying(false);
      setWanted(BOARD / 2);
      table.setPocketR(fresh.pocketR);
      table.show(fresh.coins, null);
      settledRef.current?.(game.moves.length);
      return;
    }
    if (!running.current) pumpRef.current();
  }, [game]);

  // The striker on your line, while it is your shot.
  useEffect(() => {
    const table = tableRef.current;
    if (!table || running.current || busy) return;
    table.setStriker(canAct ? { x: strikerX, seat: me } : null);
    if (canAct) table.hush();
  }, [canAct, busy, strikerX, me, shown]);

  // ------------------------------------------------ their aim, as it comes

  const turnRef = useRef<Seat | null>(null);
  turnRef.current = shown.over ? null : shown.turn;
  useEffect(
    () =>
      onAim(said => {
        if (said.k !== 'carrom') return;
        const table = tableRef.current;
        const g = gameRef.current;
        // Only for the board as it stands here, while it is theirs to shoot.
        if (!table || said.g !== g.id || said.n !== g.moves.length || said.n !== shownCount.current || running.current || turnRef.current !== them) return;
        const a = said.a;
        if (!a) {
          table.hush();
          return;
        }
        const x = clamp(a[0], BASE_MIN, BASE_MAX);
        const ux = (a[1] ?? 0) / 1000;
        const uy = (a[2] ?? 0) / 1000;
        const pulling = a.length >= 5 && (ux !== 0 || uy !== 0);
        table.hear(them, x, pulling ? { ux, uy, power: clamp((a[3] ?? 0) / 1000, 0, 1), ok: a[4] === 1 } : null);
      }),
    [them]
  );

  /** Tells their phone where the striker is and how it is being aimed (core/gameAim). */
  const say = (x: number, aim: Aim | null) => {
    const g = gameRef.current;
    sayAim('carrom', g.id, g.moves.length, aim ? [x, aim.ux * 1000, aim.uy * 1000, aim.power * 1000, aim.ok ? 1 : 0] : [x]);
  };
  // Leaving the board, or the turn passing: their phone takes the striker down.
  useEffect(() => {
    if (!canAct) return;
    return () => {
      const g = gameRef.current;
      sayAim('carrom', g.id, g.moves.length, null);
    };
  }, [canAct]);

  // ------------------------------------------------------------- aiming

  const pull = useRef<Touch | null>(null);
  const aimRef = useRef<Aim | null>(null);

  /** How hard, on the bar at the side: written straight to it, not through React. */
  const showPower = (aim: Aim | null) => {
    const bar = powerRef.current;
    if (!bar) return;
    if (!aim || !aim.ok) {
      delete bar.dataset.on;
      return;
    }
    bar.dataset.on = '';
    bar.dataset.level = aim.power < 0.5 ? 'soft' : aim.power < 0.8 ? 'firm' : 'hard';
    bar.style.setProperty('--p', aim.power.toFixed(3));
    const label = bar.lastElementChild;
    if (label) label.textContent = `${Math.round(aim.power * 100)}`;
  };

  /** Where on the board a point of the screen is, in board units. */
  const boardAt = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const box = liveRef.current?.getBoundingClientRect();
    if (!box || !box.width) return null;
    const along = (v: number) => (v - FRAME) / (1 - 2 * FRAME);
    const x = along((clientX - box.left) / box.width) * BOARD;
    const y = along((clientY - box.top) / box.height) * BOARD;
    return flip ? { x: BOARD - x, y: BOARD - y } : { x, y };
  };

  const aimFrom = (clientX: number, clientY: number): Aim | null => {
    const start = pull.current;
    const wrap = wrapRef.current;
    if (!start || !wrap) return null;
    const px = start.x - clientX;
    const py = start.y - clientY;
    const dist = Math.hypot(px, py);
    if (dist < 12) return null;
    const sign = flip ? -1 : 1;
    let dx = px * sign;
    const dy = py * sign;
    const forward = dy * forwardOf(me);
    if (forward <= 0) {
      const len = Math.hypot(dx, dy) || 1;
      return { ux: dx / len, uy: dy / len, power: 0, ok: false };
    }
    if (Math.abs(dx) > forward * 3.8) dx = Math.sign(dx) * forward * 3.8;
    const len = Math.hypot(dx, dy);
    const power = clamp((dist - 12) / (wrap.clientWidth * 0.4), 0, 1);
    return { ux: dx / len, uy: dy / len, power, ok: true };
  };

  const lastTick = useRef(0);
  /** The striker, put at `x` along its line (or as near as the coins allow). */
  const place = (x: number) => {
    const at = clamp(x, BASE_MIN, BASE_MAX);
    setWanted(at);
    const free = nearestFree(shown.coins, me, at);
    tableRef.current?.setStriker({ x: free, seat: me });
    say(free, null);
    if (Math.abs(at - lastTick.current) >= 34) {
      lastTick.current = at;
      playSound('g-cr-place', { rate: 0.9 + ((flip ? BOARD - at : at) / BOARD) * 0.3 });
      haptic('tick');
    }
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canAct || busy || e.button > 0) return;
    // A finger landing on the striker may be picking it up to move it along
    // its line, or pulling it back to shoot: which way it first goes says.
    const at = boardAt(e.clientX, e.clientY);
    const onStriker = !!at && Math.hypot(at.x - strikerX, at.y - baselineY(me)) < STRIKER_R * 2.3;
    pull.current = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: onStriker ? 'undecided' : 'aim', off: at ? strikerX - at.x : 0 };
    aimRef.current = null;
    if (!onStriker) setAiming(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* it still follows while the finger is over it */
    }
  };
  const onMoveAim = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const touch = pull.current;
    if (!touch || touch.id !== e.pointerId) return;
    if (touch.mode === 'undecided') {
      const dx = Math.abs(e.clientX - touch.x);
      const dy = Math.abs(e.clientY - touch.y);
      if (dx < 9 && dy < 9) return;
      touch.mode = dx > dy * 1.25 ? 'move' : 'aim';
      if (touch.mode === 'aim') setAiming(true);
    }
    if (touch.mode === 'move') {
      const at = boardAt(e.clientX, e.clientY);
      if (at) place(at.x + touch.off);
      return;
    }
    const aim = aimFrom(e.clientX, e.clientY);
    aimRef.current = aim;
    tableRef.current?.aim(aim);
    showPower(aim);
    say(strikerX, aim);
  };
  const onEnd = (e: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const touch = pull.current;
    if (!touch || touch.id !== e.pointerId) return;
    const aim = cancelled || touch.mode !== 'aim' ? null : aimFrom(e.clientX, e.clientY);
    pull.current = null;
    aimRef.current = null;
    setAiming(false);
    tableRef.current?.aim(null);
    showPower(null);
    const shot: Shot | null =
      aim && aim.ok && canAct && !busy
        ? (() => {
            const speed = speedOfPower(aim.power);
            return { x: strikerX, dx: Math.round(aim.ux * speed), dy: Math.round(aim.uy * speed) };
          })()
        : null;
    if (!shot || !shotAllowed(playCarrom(gameRef.current).coins, me, shot)) {
      // Let go without a shot: their phone sees the striker at rest again.
      if (touch.mode === 'aim') say(strikerX, null);
      return;
    }
    const move = encodeShot(shot);
    ownMove.current = move;
    lastX.current[me] = strikerX;
    // Heard, and felt, the instant the finger lifts.
    playSound('g-cr-strike', { gain: 0.55 + aim!.power * 0.45 });
    haptic(aim!.power > 0.6 ? 'confirm' : 'tick');
    onMove(move);
  };

  // The slider, left to right as you see it.
  const sliderValue = flip ? BOARD - strikerX : strikerX;
  const onSlide = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    place(flip ? BOARD - v : v);
  };

  // ------------------------------------------------- the last shot, again

  const canReplay = !busy && !aiming && shown.played > 0 && shown.played === game.moves.length;
  const replay = () => {
    const table = tableRef.current;
    const g = gameRef.current;
    const k = shownCount.current;
    if (!table || running.current || busy || k < 1 || k !== g.moves.length) return;
    const before = carromAfter(g, k - 1);
    if (before.played !== k - 1) return;
    running.current = true;
    setBusy(true);
    setReplaying(true);
    setNote(null);
    haptic('tick');
    const { recording, shot } = recordShot(before, g.moves[k - 1]);
    table.hush();
    table.show(before.coins, null);
    table.playShot(recording, shot, before.turn, false, shot.x, () => {
      table.show(carromAfter(gameRef.current, k).coins, null);
      running.current = false;
      setReplaying(false);
      // Back to the game: anything that came in meanwhile plays now.
      timer.current = window.setTimeout(() => pumpRef.current(), 60);
    });
  };

  const tray = (seat: Seat) => {
    const colour = shown.colour[seat];
    const inCount = COINS_EACH - shown.left[seat];
    const hasQueen = shown.queen === seat;
    const pending = shown.queen === 'pending' && shown.turn === seat;
    const turn = !shown.over && shown.turn === seat;
    const who = seat === me ? tr('You') : partnerName;
    return (
      <div
        className="cr-tray"
        data-seat={seat === me ? 'me' : 'them'}
        data-turn={turn || undefined}
        aria-label={`${who}: ${tr('{n} of 9 in', { n: inCount })}${hasQueen ? `, ${tr('has the Queen')}` : ''}${turn ? `, ${tr('to play')}` : ''}`}
      >
        <span className="cr-who" aria-hidden="true">
          <i className="cr-coin cr-who-coin" data-kind={colour} />
          <b>{who}</b>
          {hasQueen && <span className="cr-crown">👑</span>}
          <em>{tr('{n} left', { n: shown.left[seat] })}</em>
        </span>
        <span className="cr-tray-slots" aria-hidden="true">
          {Array.from({ length: COINS_EACH }, (_, i) => (
            <span key={i} className="cr-slot">
              {i < inCount && <TrayCoin kind={colour} />}
            </span>
          ))}
        </span>
        <span className="cr-slot cr-slot-queen" data-pending={pending || undefined} data-won={hasQueen || undefined} aria-hidden="true">
          {(hasQueen || pending) && <TrayCoin kind="queen" />}
        </span>
      </div>
    );
  };

  const ringLeft = `${(FRAME + (sliderValue / BOARD) * (1 - 2 * FRAME)) * 100}%`;
  const ringTop = `${(FRAME + ((BOARD - BASE_Y) / BOARD) * (1 - 2 * FRAME)) * 100}%`;

  return (
    <div className="cr">
      {tray(them)}
      <div className="cr-table" ref={wrapRef} data-aim={(canAct && !busy) || undefined}>
        <canvas ref={boardRef} className="cr-canvas" aria-hidden="true" />
        <canvas
          ref={liveRef}
          className="cr-canvas cr-live"
          role="img"
          aria-label={tr('Carrom board')}
          onPointerDown={onDown}
          onPointerMove={onMoveAim}
          onPointerUp={e => onEnd(e, false)}
          onPointerCancel={e => onEnd(e, true)}
        />
        {canAct && !busy && !aiming && <span className="cr-ring" style={{ left: ringLeft, top: ringTop }} aria-hidden="true" />}
        <div className="cr-power" ref={powerRef} aria-hidden="true">
          <i />
          <b />
        </div>
        {replaying && <div className="cr-replaying">{tr('Last shot')}</div>}
        {note && (
          <div className="cr-note" key={note.key} data-tone={note.tone} data-big={note.big || undefined} aria-live="polite">
            {note.big && <span aria-hidden="true">👑 </span>}
            {note.text}
          </div>
        )}
      </div>
      <div className="cr-controls">
        <div className="cr-slider" data-off={!canAct || busy || undefined}>
          <input
            type="range"
            min={BASE_MIN}
            max={BASE_MAX}
            step={1}
            value={sliderValue}
            disabled={!canAct || busy}
            onChange={onSlide}
            aria-label={tr('Move the striker along its line')}
          />
        </div>
        <button type="button" className="cr-again" onClick={replay} disabled={!canReplay} aria-label={tr('Watch the last shot again')} title={tr('Watch the last shot again')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {tray(me)}
      <p className="cr-hint">{canAct && !busy ? (aiming ? tr('Let go to shoot') : tr('Drag the striker along its line, then pull back and let go')) : ' '}</p>
    </div>
  );
});
CarromBoard.displayName = 'CarromBoard';
