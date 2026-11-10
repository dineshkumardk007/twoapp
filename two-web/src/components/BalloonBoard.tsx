import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../core/i18n';
import { haptic } from '../core/haptics';
import { onAim, sayAim } from '../core/gameAim';
import { playSound } from '../core/sounds';
import type { Seat } from '../core/usTwo';
import {
  SOAK_FULL,
  WB_BALLOON_R,
  WB_FAR,
  WB_GIANT_R,
  WB_GRAVITY,
  WB_GROUND,
  WB_H,
  WB_HAND_X,
  WB_HAND_Y,
  WB_HEDGE_X,
  WB_MAX_V,
  WB_MIN_VX,
  WB_NEAR,
  WB_STEP_MS,
  WB_W,
  WB_WIND_MAX,
  encodeThrow,
  playBalloon,
  recordFlight,
  throwAllowed,
  type BalloonFlight,
  type BalloonHit,
  type BalloonState
} from '../core/balloonWar';
import { Rig, type RigLayers } from './UsRig';
import type { Mood } from './StickerArt';
import type { BoardProps } from './GameBoards';

// Water Balloon War on Canvas of Us (core/balloonWar has the rules).
//
// You always stand on the left of your own screen and throw to the right, so
// the same flight is drawn as it is on the phone that threw it and mirrored on
// the other. The garden and the two of you are ordinary layers the graphics
// chip moves about by itself; the balloon, the arc and the water are a
// transparent canvas on top, running only while something is in the air - and
// each drop is a small picture, painted once.

const PARTS_MAX = 150;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** The hand's height, and the arc's dots: this long a flight is shown as you aim. */
const AIM_SHOW_S = 0.5;
const AIM_DOTS = 15;
/** Their throw: they wind up this long before it goes. */
const WIND_UP_MS = 520;
/** Watched drawing it back just now, they let go almost at once. */
const WATCHED_WIND_UP_MS = 150;
/** Their aiming, as it comes in: eased toward the newest. And taken down if nothing more is heard. */
const EASE_MS = 90;
const THEIR_AIM_MS = 8000;
/** After it lands, before the next. */
const REST_HIT_MS = 1350;
const REST_MISS_MS = 800;

const percentX = (x: number) => `${(x / WB_W) * 100}%`;
const percentY = (y: number) => `${(y / WB_H) * 100}%`;

/** Drop, in its own little box: painted once and used for every one of them. */
function dropSprite(size: number, deep: boolean): HTMLCanvasElement {
  const half = Math.max(2, Math.ceil(size));
  const cv = document.createElement('canvas');
  cv.width = half * 2;
  cv.height = half * 2;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(half * 0.72, half * 0.68, 0, half, half, half);
  if (deep) {
    g.addColorStop(0, '#e9f8ff');
    g.addColorStop(0.35, '#7ccbff');
    g.addColorStop(0.92, '#2f8ee0');
    g.addColorStop(1, 'rgba(47, 142, 224, 0)');
  } else {
    g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    g.addColorStop(0.5, 'rgba(170, 225, 255, 0.72)');
    g.addColorStop(1, 'rgba(120, 200, 255, 0)');
  }
  c.fillStyle = g;
  c.fillRect(0, 0, half * 2, half * 2);
  return cv;
}

const BALLOON_PATH = 'M0,-12 C7,-12 11,-6 11,0 C11,7 5,11 0,11 C-5,11 -11,7 -11,0 C-11,-6 -7,-12 0,-12 Z';
const KNOT_PATH = 'M-2.5,11 L2.5,11 L0,14.5 Z';

/** The balloon, painted once. It is only ever turned and squashed. */
function balloonSprite(px: number, giant: boolean): HTMLCanvasElement {
  const k = px / 12;
  const half = Math.ceil(px * 1.6);
  const cv = document.createElement('canvas');
  cv.width = half * 2;
  cv.height = half * 2;
  const c = cv.getContext('2d')!;
  c.translate(half, half);
  c.scale(k, k);
  const g = c.createRadialGradient(-4, -6, 1, 0, 0, 14);
  if (giant) {
    g.addColorStop(0, '#ffe3ef');
    g.addColorStop(0.45, '#ff7fb0');
    g.addColorStop(1, '#d83c80');
  } else {
    g.addColorStop(0, '#e8f7ff');
    g.addColorStop(0.45, '#7cc8ff');
    g.addColorStop(1, '#2b86d9');
  }
  const body = new Path2D(BALLOON_PATH);
  const knot = new Path2D(KNOT_PATH);
  c.fillStyle = g;
  c.strokeStyle = '#3b2723';
  c.lineWidth = 1.9;
  c.lineJoin = 'round';
  c.fill(body);
  c.stroke(body);
  c.fillStyle = giant ? '#d83c80' : '#2b86d9';
  c.fill(knot);
  c.stroke(knot);
  c.fillStyle = 'rgba(255, 255, 255, 0.72)';
  c.beginPath();
  c.ellipse(-4.5, -5, 2.2, 3.8, 0.35, 0, Math.PI * 2);
  c.fill();
  return cv;
}

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  /** 0 a drop that falls, 1 spray that hangs, 2 a scrap of balloon. */
  kind: number;
  spin: number;
}
interface Ring {
  x: number;
  y: number;
  age: number;
  life: number;
  rx: number;
  ry: number;
  flat: boolean;
}
interface Flying {
  flight: BalloonFlight;
  /** Drawn mirrored: thrown by the one on the right. */
  mirror: boolean;
  giant: boolean;
  /** When it left the hand, once it has. */
  at: number;
  waitUntil: number;
  landed: () => void;
  started: () => void;
  didStart: boolean;
}

export interface Aiming {
  vx: number;
  vy: number;
  /** How far back the balloon is pulled, in garden units. */
  pullX: number;
  pullY: number;
  power: number;
  ok: boolean;
  giant: boolean;
}

/** Whatever is in the air: drawn here, away from React. */
class WaterFx {
  private c: CanvasRenderingContext2D;
  private k = 1;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private drop: HTMLCanvasElement | null = null;
  private spray: HTMLCanvasElement | null = null;
  private small: HTMLCanvasElement | null = null;
  private big: HTMLCanvasElement | null = null;
  private parts: Part[] = [];
  private rings: Ring[] = [];
  private flying: Flying | null = null;
  private aiming: Aiming | null = null;
  /** The other one's balloon as their phone says it is drawn back, easing toward `to`. */
  private theirs: { now: Aiming; to: Aiming; heardAt: number; off: boolean } | null = null;
  /** Their drawn-back balloon comes on to the canvas, or leaves it: the still one in their hand hides meanwhile. */
  onTheirs: ((on: boolean) => void) | null = null;
  private raf = 0;
  private last = 0;
  private dead = false;
  private quality = 1;
  private frames = 0;
  private slow = 0;

  constructor(private cv: HTMLCanvasElement) {
    this.c = cv.getContext('2d')!;
  }

  destroy() {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  resize(cssW: number, cssH: number) {
    if (cssW <= 0 || cssH <= 0) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.quality < 1 ? 1.5 : 2.5);
    const w = Math.round(cssW * this.dpr);
    const h = Math.round(cssH * this.dpr);
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.cv.width = w;
    this.cv.height = h;
    this.k = w / WB_W;
    this.drop = dropSprite(11 * this.k, true);
    this.spray = dropSprite(12 * this.k, false);
    this.small = balloonSprite(WB_BALLOON_R * 1.15 * this.k, false);
    this.big = balloonSprite(WB_GIANT_R * 1.15 * this.k, true);
    this.wake();
  }

  aim(a: Aiming | null) {
    this.aiming = a;
    this.wake();
  }

  /** Their aim, from their phone; null when they have let go of it. */
  hear(a: Aiming | null) {
    const t = this.theirs;
    if (!a) {
      if (t) {
        t.off = true;
        t.to = { ...t.to, pullX: 0, pullY: 0, power: 0 };
        this.wake();
      }
      return;
    }
    if (!t) {
      this.theirs = { now: { ...a, pullX: 0, pullY: 0, power: 0 }, to: a, heardAt: performance.now(), off: false };
      this.onTheirs?.(true);
    } else {
      t.to = a;
      t.off = false;
      t.heardAt = performance.now();
    }
    this.wake();
  }

  /** Their drawn-back balloon is put away: the throw is here, or it is not their turn. */
  hush() {
    if (!this.theirs) return;
    this.theirs = null;
    this.onTheirs?.(false);
    this.wake();
  }

  /** Whether they are being watched drawing it back right now. */
  watching(): boolean {
    return !!this.theirs && !this.theirs.off && this.theirs.now.power > 0.08;
  }

  throwNow(f: Omit<Flying, 'at' | 'didStart'>) {
    this.aiming = null;
    if (this.theirs) {
      this.theirs = null;
      this.onTheirs?.(false);
    }
    this.flying = { ...f, at: 0, didStart: false };
    this.frames = 0;
    this.slow = 0;
    this.wake();
  }

  cancel() {
    this.flying = null;
    this.aiming = null;
    if (this.theirs) {
      this.theirs = null;
      this.onTheirs?.(false);
    }
    this.parts.length = 0;
    this.rings.length = 0;
    this.wake();
  }

  /** The water, where it came down. Screen units: left to right as this phone shows it. */
  burst(x: number, y: number, hit: BalloonHit, giant: boolean) {
    const q = this.quality;
    const scale = giant ? 1.7 : 1;
    const direct = hit === 'head' || hit === 'body';
    const drops = Math.round((direct ? 62 : hit === 'near' ? 38 : hit === 'hedge' ? 26 : 30) * q * (giant ? 1.7 : 1));
    for (let i = 0; i < drops && this.parts.length < PARTS_MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = hit === 'miss' || hit === 'near' ? -Math.abs(Math.sin(a)) : Math.sin(a) - 0.35;
      const v = (direct ? 170 + Math.random() * 520 : 110 + Math.random() * 380) * scale;
      this.parts.push({ x, y: y - 6, vx: Math.cos(a) * v, vy: up * v, age: 0, life: 520 + Math.random() * 620, size: 0.32 + Math.random() * 0.9, kind: 0, spin: 0 });
    }
    const sprays = Math.round((direct ? 26 : 12) * q * scale);
    for (let i = 0; i < sprays && this.parts.length < PARTS_MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (40 + Math.random() * 190) * scale;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, age: 0, life: 280 + Math.random() * 380, size: 1 + Math.random() * 1.6, kind: 1, spin: 0 });
    }
    for (let i = 0; i < 4 && this.parts.length < PARTS_MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.push({ x, y, vx: Math.cos(a) * 340 * scale, vy: Math.sin(a) * 340 * scale - 120, age: 0, life: 600, size: 1, kind: 2, spin: Math.random() * 6 });
    }
    const flat = hit !== 'head' && hit !== 'body' && hit !== 'hedge';
    this.rings.push({ x, y: flat ? WB_GROUND : y, age: 0, life: 460, rx: (flat ? 100 : 78) * scale, ry: (flat ? 22 : 74) * scale, flat });
    if (direct) this.rings.push({ x, y, age: -70, life: 520, rx: 120 * scale, ry: 110 * scale, flat: false });
    this.wake();
  }

  /** Water running off someone for a while: a drop now and then. */
  drips(x: number, y: number, count: number) {
    const q = this.quality;
    for (let i = 0; i < Math.round(count * q) && this.parts.length < PARTS_MAX; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * 80,
        y: y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 18,
        vy: 10 + Math.random() * 30,
        age: -Math.random() * 1400,
        life: 720,
        size: 0.36 + Math.random() * 0.34,
        kind: 0,
        spin: 0
      });
    }
    this.wake();
  }

  private wake() {
    if (this.raf || this.dead) return;
    this.raf = requestAnimationFrame(t => {
      this.raf = 0;
      if (this.dead) return;
      if (this.tick(t)) this.wake();
      else {
        this.last = 0;
        this.c.setTransform(1, 0, 0, 1, 0, 0);
        this.c.clearRect(0, 0, this.w, this.h);
      }
    });
  }

  private tick(now: number): boolean {
    const c = this.c;
    if (!this.w) return false;
    const dt = this.last ? Math.min(50, now - this.last) : 16;
    if (this.last && this.flying) {
      this.frames++;
      if (dt > 26) this.slow++;
    }
    this.last = now;
    const k = this.k;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    let more = false;

    if (this.aiming) {
      more = true;
      this.drawAim(this.aiming, false);
    }

    const t = this.theirs;
    if (t && !this.flying) {
      if (!t.off && now - t.heardAt > THEIR_AIM_MS) {
        t.off = true;
        t.to = { ...t.to, pullX: 0, pullY: 0, power: 0 };
      }
      const e = 1 - Math.exp(-dt / EASE_MS);
      const a = t.now;
      a.vx += (t.to.vx - a.vx) * e;
      a.vy += (t.to.vy - a.vy) * e;
      a.pullX += (t.to.pullX - a.pullX) * e;
      a.pullY += (t.to.pullY - a.pullY) * e;
      a.power += (t.to.power - a.power) * e;
      a.ok = t.to.ok;
      a.giant = t.to.giant;
      if (t.off && Math.abs(a.pullX) + Math.abs(a.pullY) < 3) {
        // Let go of: back in their hand.
        this.theirs = null;
        this.onTheirs?.(false);
      } else {
        more = true;
        this.drawAim(a, true);
      }
    }

    const f = this.flying;
    if (f) {
      more = true;
      if (now < f.waitUntil) {
        // Winding up: drawn by the character's own layers.
      } else {
        if (!f.didStart) {
          f.didStart = true;
          f.at = now;
          f.started();
        }
        const path = f.flight.path;
        const steps = path.length / 2;
        const t = (now - f.at) / WB_STEP_MS;
        const i0 = Math.min(steps - 1, Math.floor(t));
        const i1 = Math.min(steps - 1, i0 + 1);
        const u = clamp(t - i0, 0, 1);
        const wx = path[i0 * 2] + (path[i1 * 2] - path[i0 * 2]) * u;
        const y = path[i0 * 2 + 1] + (path[i1 * 2 + 1] - path[i0 * 2 + 1]) * u;
        const x = f.mirror ? WB_W - wx : wx;
        const vx = (path[i1 * 2] - path[i0 * 2]) * (f.mirror ? -1 : 1);
        const vy = path[i1 * 2 + 1] - path[i0 * 2 + 1];
        const speed = Math.hypot(vx, vy);
        // Its shadow on the grass, tightening as it comes down.
        const height = clamp((WB_GROUND - y) / 500, 0, 1);
        c.fillStyle = `rgba(30, 60, 40, ${0.28 * (1 - height * 0.72)})`;
        c.beginPath();
        c.ellipse(x * k, WB_GROUND * k, (f.giant ? 40 : 22) * k * (1 + height * 0.4), (f.giant ? 9 : 5.4) * k, 0, 0, Math.PI * 2);
        c.fill();
        // It leaves a drop or two behind.
        if (this.parts.length < PARTS_MAX && Math.random() < 0.16 * this.quality) {
          this.parts.push({ x, y, vx: vx * 3, vy: 40, age: 0, life: 420, size: 0.3, kind: 0, spin: 0 });
        }
        const img = f.giant ? this.big : this.small;
        if (img) {
          // Stretched along its flight, and wobbling: there is water in there.
          const wobble = Math.sin((now - f.at) * 0.021) * 0.11;
          const stretch = clamp(speed / 16, 0, 0.3);
          const ang = Math.atan2(vy, vx) + Math.PI / 2;
          const cos = Math.cos(ang);
          const sin = Math.sin(ang);
          const sx = 1 - stretch * 0.5 + wobble;
          const sy = 1 + stretch - wobble;
          c.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, x * k, y * k);
          c.drawImage(img, -img.width / 2, -img.height / 2);
          c.setTransform(1, 0, 0, 1, 0, 0);
        }
        if (t >= steps - 1) {
          this.flying = null;
          if (this.frames > 20 && this.slow / this.frames > 0.34 && this.quality === 1) {
            // A phone that is struggling: fewer drops and a softer picture.
            this.quality = 0.55;
            const cssW = this.w / this.dpr;
            const cssH = this.h / this.dpr;
            this.resize(cssW, cssH);
          }
          f.landed();
        }
      }
    }

    // Rings of water opening out.
    if (this.rings.length) {
      more = true;
      let w = 0;
      for (let i = 0; i < this.rings.length; i++) {
        const r = this.rings[i];
        r.age += dt;
        if (r.age >= r.life) continue;
        this.rings[w++] = r;
        if (r.age < 0) continue;
        const t = r.age / r.life;
        const e = 1 - (1 - t) ** 3;
        c.strokeStyle = `rgba(214, 240, 255, ${(1 - t) * 0.9})`;
        c.lineWidth = Math.max(1, (r.flat ? 7 : 11) * k * (1 - t));
        c.beginPath();
        c.ellipse(r.x * k, r.y * k, r.rx * e * k, r.ry * e * k, 0, 0, Math.PI * 2);
        c.stroke();
      }
      this.rings.length = w;
    }

    if (this.parts.length) {
      more = true;
      const s = dt / 1000;
      let w = 0;
      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i];
        p.age += dt;
        if (p.age >= p.life) continue;
        this.parts[w++] = p;
        if (p.age < 0) continue;
        const t = p.age / p.life;
        if (p.kind === 0) {
          p.vy += WB_GRAVITY * 0.9 * s;
          p.x += p.vx * s;
          p.y += p.vy * s;
          if (p.y >= WB_GROUND) {
            p.age = p.life;
            continue;
          }
          const img = this.drop;
          if (img) {
            // A drop stretches as it falls.
            const size = img.width * p.size;
            const sv = Math.min(1.9, 1 + Math.abs(p.vy) / 700);
            c.globalAlpha = 1 - t * t * 0.7;
            c.drawImage(img, p.x * k - size / 2, p.y * k - (size * sv) / 2, size, size * sv);
          }
        } else if (p.kind === 1) {
          p.vy += 120 * s;
          p.vx *= 0.96;
          p.vy *= 0.96;
          p.x += p.vx * s;
          p.y += p.vy * s;
          const img = this.spray;
          if (img) {
            const size = img.width * p.size * (1 + t * 1.4);
            c.globalAlpha = (1 - t) * 0.75;
            c.drawImage(img, p.x * k - size / 2, p.y * k - size / 2, size, size);
          }
        } else {
          p.vy += WB_GRAVITY * s;
          p.x += p.vx * s;
          p.y += p.vy * s;
          p.spin += s * 9;
          c.globalAlpha = 1 - t;
          c.fillStyle = '#5ab0ee';
          c.save();
          c.translate(p.x * k, p.y * k);
          c.rotate(p.spin);
          c.fillRect(-6 * k, -2.5 * k, 12 * k, 5 * k);
          c.restore();
        }
      }
      this.parts.length = w;
      c.globalAlpha = 1;
    }
    return more;
  }

  /** The balloon drawn back, and the start of its arc. `theirs`: the other one's, from the right, its arc paler. */
  private drawAim(a: Aiming, theirs: boolean) {
    const c = this.c;
    const k = this.k;
    const d = theirs ? -1 : 1;
    const hx = theirs ? WB_W - WB_HAND_X : WB_HAND_X;
    const hy = WB_HAND_Y;
    const bx = hx - a.pullX * d;
    const by = hy + a.pullY;
    // The rubber band, from the hand to where it is pulled to.
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(70, 40, 30, 0.75)';
    c.lineWidth = Math.max(1.4, 5 * k * (1 - a.power * 0.55));
    c.beginPath();
    c.moveTo((hx - 13) * k, (hy + 4) * k);
    c.lineTo(bx * k, by * k);
    c.moveTo((hx + 13) * k, (hy + 4) * k);
    c.lineTo(bx * k, by * k);
    c.stroke();

    if (a.ok) {
      // Where it would go at first - but not all the way, and not the wind.
      for (let i = 1; i <= AIM_DOTS; i++) {
        const t = (i / AIM_DOTS) * AIM_SHOW_S;
        const x = hx + a.vx * t * d;
        const y = hy - a.vy * t + 0.5 * WB_GRAVITY * t * t;
        if (y > WB_GROUND) break;
        const fade = 1 - i / (AIM_DOTS + 1);
        c.fillStyle = `rgba(255, 255, 255, ${(theirs ? 0.6 : 0.95) * fade})`;
        c.beginPath();
        c.arc(x * k, y * k, Math.max(1, (a.giant ? 7.5 : 6) * k * (0.45 + fade * 0.55)), 0, Math.PI * 2);
        c.fill();
      }
    }

    const img = a.giant ? this.big : this.small;
    if (img) {
      const st = a.power * 0.26;
      const ang = Math.atan2(a.pullY, -a.pullX * d) - Math.PI / 2;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const sx = 1 + st * 0.6;
      const sy = 1 - st * 0.4;
      c.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, bx * k, by * k);
      c.drawImage(img, -img.width / 2, -img.height / 2);
      c.setTransform(1, 0, 0, 1, 0, 0);
    }
  }
}

// ------------------------------------------------------------ the garden

/** The garden behind you both, drawn once. */
const Garden: React.FC<{ hedge: number }> = React.memo(({ hedge }) => {
  const top = WB_GROUND - hedge;
  const hw = 46;
  return (
    <svg className="wb-garden" viewBox={`0 0 ${WB_W} ${WB_H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="wb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#54b6f5" />
          <stop offset="0.6" stopColor="#a6e0fb" />
          <stop offset="1" stopColor="#e6f8f2" />
        </linearGradient>
        <radialGradient id="wb-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="0.3" stopColor="#ffe98f" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffe98f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wb-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#97dd8a" />
          <stop offset="1" stopColor="#61bd6d" />
        </linearGradient>
        <linearGradient id="wb-hill2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b6e8a3" />
          <stop offset="1" stopColor="#86d38c" />
        </linearGradient>
        <linearGradient id="wb-lawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6fcb5d" />
          <stop offset="1" stopColor="#3ea148" />
        </linearGradient>
        <linearGradient id="wb-hedge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f9f4a" />
          <stop offset="1" stopColor="#20713a" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={WB_W} height={WB_H} fill="url(#wb-sky)" />
      <circle cx="820" cy="120" r="150" fill="url(#wb-sun)" />
      <path d="M0,470 C130,400 260,410 400,465 C530,510 690,420 820,430 C900,436 960,462 1000,478 L1000,700 L0,700 Z" fill="url(#wb-hill2)" />
      <path d="M0,560 C170,490 350,525 500,552 C650,580 820,500 1000,545 L1000,700 L0,700 Z" fill="url(#wb-hill)" />
      {/* Fence, far off. */}
      <g fill="#fff7e6" stroke="#b08a60" strokeWidth="2">
        {Array.from({ length: 19 }, (_, i) => (
          <path key={i} d={`M${i * 56 - 2},${WB_GROUND + 2} L${i * 56 - 2},${WB_GROUND - 56} L${i * 56 + 9},${WB_GROUND - 70} L${i * 56 + 20},${WB_GROUND - 56} L${i * 56 + 20},${WB_GROUND + 2} Z`} />
        ))}
        <rect x="-4" y={WB_GROUND - 46} width={WB_W + 8} height="10" />
        <rect x="-4" y={WB_GROUND - 22} width={WB_W + 8} height="10" />
      </g>
      <rect x="0" y={WB_GROUND - 4} width={WB_W} height={WB_H - WB_GROUND + 4} fill="url(#wb-lawn)" />
      {/* Mown stripes. */}
      <g fill="#ffffff" opacity="0.07">
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M${i * 130 - 10},${WB_GROUND} L${i * 130 + 55},${WB_GROUND} L${i * 170 - 30},${WB_H} L${i * 170 - 120},${WB_H} Z`} />
        ))}
      </g>
      {/* Flowers. */}
      {[
        [60, 700, '#ff8fb1'],
        [240, 688, '#ffe066'],
        [330, 726, '#ffffff'],
        [440, 694, '#ff8fb1'],
        [590, 722, '#ffe066'],
        [690, 690, '#ffffff'],
        [770, 730, '#ff8fb1'],
        [950, 702, '#ffe066']
      ].map(([x, y, col], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          {[0, 72, 144, 216, 288].map(a => (
            <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 6.5} cy={Math.sin((a * Math.PI) / 180) * 5} r="5" fill={col as string} />
          ))}
          <circle r="3.4" fill="#f59e0b" />
        </g>
      ))}
      {/* The hedge. */}
      <g>
        <ellipse cx={WB_HEDGE_X} cy={WB_GROUND + 4} rx={hw + 22} ry="13" fill="rgb(20 60 30 / 0.28)" />
        <path
          d={`M${WB_HEDGE_X - hw},${WB_GROUND + 4} L${WB_HEDGE_X - hw},${top + 28} C${WB_HEDGE_X - hw},${top + 4} ${WB_HEDGE_X - hw + 24},${top - 8} ${WB_HEDGE_X - 14},${top + 2} C${WB_HEDGE_X - 8},${top - 12} ${WB_HEDGE_X + 18},${top - 12} ${WB_HEDGE_X + 22},${top + 3} C${WB_HEDGE_X + 36},${top - 4} ${WB_HEDGE_X + hw},${top + 8} ${WB_HEDGE_X + hw},${top + 28} L${WB_HEDGE_X + hw},${WB_GROUND + 4} Z`}
          fill="url(#wb-hedge)"
          stroke="#1a5f30"
          strokeWidth="3"
        />
        <g fill="#7bd06f" opacity="0.5">
          {Array.from({ length: Math.round(hedge / 12) }, (_, i) => (
            <ellipse key={i} cx={WB_HEDGE_X - 30 + ((i * 37) % 60)} cy={top + 18 + ((i * 53) % Math.max(10, hedge - 26))} rx="8" ry="5" />
          ))}
        </g>
      </g>
    </svg>
  );
});
Garden.displayName = 'Garden';

/** A cloud, drifting whichever way the wind is going. */
const CLOUDS = [
  { y: 8, s: 1, delay: 0 },
  { y: 21, s: 0.68, delay: -0.42 },
  { y: 3, s: 0.52, delay: -0.73 }
];

/** Wet marks on someone, in the character's own units: more of them the wetter they get. */
const WetMarks: React.FC<{ level: number }> = React.memo(({ level }) => (
  <div className="rig-l wb-wet" data-level={level}>
    <svg viewBox="-56 -82 112 160" className="rig-art" overflow="visible" aria-hidden="true" focusable="false">
      <g fill="#5fb4f5" opacity="0.5">
        <path className="wb-w1" d="M-13,-27 C-16,-16 -11,-14 -9,-8 C-8,-4 -14,-3 -14,-9 C-15,-14 -20,-16 -19,-26 Z" />
        <path className="wb-w1" d="M15,-28 C13,-20 19,-16 19,-11 C19,-7 14,-7 14,-12 C13,-16 9,-19 9,-28 Z" />
        <path className="wb-w2" d="M-23,18 C-26,29 -22,41 -18,47 C-14,50 -14,43 -17,38 C-19,31 -17,24 -16,20 Z" />
        <path className="wb-w2" d="M18,20 C21,28 19,40 15,47 C11,50 11,43 13,38 C14,31 12,25 12,21 Z" />
        <path className="wb-w3" d="M-29,-8 C-20,-30 20,-31 29,-9 C31,-2 25,-5 22,-11 C13,-20 -13,-21 -22,-10 C-25,-5 -31,-2 -29,-8 Z" />
        <path className="wb-w3" d="M-20,30 C-10,24 10,24 20,30 C24,44 18,57 0,58 C-18,57 -24,44 -20,30 Z" opacity="0.55" />
      </g>
      {/* Beads of water, catching the light. */}
      <g fill="#dff4ff" stroke="#59aee6" strokeWidth="1">
        <path className="wb-w1" d="M-22,-13 q-3.4,5.6 0,7.6 q3.4,-2 0,-7.6 Z" />
        <path className="wb-w2" d="M23,6 q-3.2,5.2 0,7 q3.2,-1.8 0,-7 Z" />
        <path className="wb-w2" d="M-5,20 q-3,5 0,6.8 q3,-1.8 0,-6.8 Z" />
        <path className="wb-w3" d="M9,-22 q-3.2,5.2 0,7 q3.2,-1.8 0,-7 Z" />
        <path className="wb-w3" d="M-26,34 q-3.2,5.2 0,7 q3.2,-1.8 0,-7 Z" />
        <path className="wb-w3" d="M25,38 q-3.2,5.2 0,7 q3.2,-1.8 0,-7 Z" />
      </g>
    </svg>
  </div>
));
WetMarks.displayName = 'WetMarks';

/** How wet someone looks, from how soaked they are. */
const wetLevel = (soak: number) => (soak <= 0 ? 0 : soak < 4 ? 1 : soak < 8 ? 2 : 3);

// What the reactions do to the character's layers (usMoves in the same manner).
const SOFT = 'cubic-bezier(0.33, 0, 0.3, 1)';
const r = (d: number) => `rotate(${d}deg)`;
const sc = (x: number, y = x) => `scale(${x}, ${y})`;
const frames = (list: [number, string][]): Keyframe[] => list.map(([offset, transform]) => ({ offset, transform, easing: SOFT }));

function animate(el: HTMLElement | null | undefined, list: [number, string][], ms: number, delay = 0) {
  if (!el || typeof el.animate !== 'function') return;
  el.animate(frames(list), { duration: ms, delay, easing: 'linear', fill: 'none' });
}

/** The arm comes over and lets go; the body leans into it. `d`: which way the other one is. */
function throwMoves(rig: RigLayers, d: number, windUp: number) {
  const ms = windUp + 300;
  const release = windUp / ms;
  const away = d > 0 ? rig.armR : rig.armL;
  const over = d > 0 ? rig.armL : rig.armR;
  const armSign = d > 0 ? -1 : 1;
  animate(rig.lean, [[0, r(0)], [release * 0.9, r(-11 * d)], [release + 0.1, r(13 * d)], [release + 0.3, r(6 * d)], [1, r(0)]], ms);
  animate(rig.squash, [[0, sc(1)], [release * 0.9, sc(1.06, 0.94)], [release + 0.1, sc(0.95, 1.07)], [1, sc(1)]], ms);
  animate(away, [[0, r(0)], [release * 0.5, r(armSign * 140)], [release * 0.95, r(armSign * 160)], [release + 0.16, r(armSign * 60)], [1, r(0)]], ms);
  animate(over, [[0, r(0)], [release * 0.5, r(armSign * -40)], [1, r(0)]], ms);
}

/** Hit: squashed, knocked back, and shaken off like a wet puppy. */
function hitMoves(rig: RigLayers, d: number, hard: number) {
  const ms = 1500;
  const shake = [-11, 11, -11, 11, -9, 8, -5, 3, 0].map(v => v * hard);
  const at = [0.34, 0.39, 0.44, 0.49, 0.54, 0.59, 0.65, 0.71, 0.79];
  animate(rig.squash, [[0, sc(1)], [0.035, sc(1 + 0.16 * hard, 1 - 0.18 * hard)], [0.14, sc(0.93, 1.07)], [0.24, sc(1.03, 0.97)], [0.32, sc(1)], [1, sc(1)]], ms);
  animate(rig.lean, [[0, r(0)], [0.05, r(-13 * d * hard)], [0.26, r(0)], ...at.map((a, i): [number, string] => [a, r(shake[i])]), [1, r(0)]], ms);
  animate(rig.head, [[0, r(0)], [0.3, r(0)], ...at.map((a, i): [number, string] => [a, r(-shake[i] * 0.7)]), [1, r(0)]], ms);
  for (const [ear, side] of [[rig.earL, 1], [rig.earR, -1]] as const) {
    animate(ear, [[0, r(0)], [0.04, r(-22 * side)], [0.15, r(9 * side)], [0.3, r(0)], ...at.map((a, i): [number, string] => [a, r(shake[i] * -2.2)]), [1, r(0)]], ms);
  }
}

/** A flinch at a near miss. */
function flinchMoves(rig: RigLayers, d: number) {
  animate(rig.lean, [[0, r(0)], [0.12, r(-9 * d)], [0.5, r(-4 * d)], [1, r(0)]], 620);
  animate(rig.squash, [[0, sc(1)], [0.12, sc(1.07, 0.93)], [0.4, sc(0.98, 1.02)], [1, sc(1)]], 620);
}

/** A little hop, for joy. */
function cheerMoves(rig: RigLayers, times = 2) {
  const ms = 520 * times;
  const hops: [number, string][] = [[0, 'translateY(0%)']];
  for (let i = 0; i < times; i++) {
    const s = i / times;
    const w = 1 / times;
    hops.push([s + w * 0.4, 'translateY(-11%)'], [s + w * 0.82, 'translateY(0%)']);
  }
  hops.push([1, 'translateY(0%)']);
  animate(rig.hop, hops, ms);
  animate(rig.armL, [[0, r(0)], [0.14, r(125)], [0.86, r(125)], [1, r(0)]], ms);
  animate(rig.armR, [[0, r(0)], [0.14, r(-125)], [0.86, r(-125)], [1, r(0)]], ms);
}

const WORDS: Record<BalloonHit, string[]> = {
  head: ['SPLOOSH!', 'BULLSEYE!', 'SOAKED!'],
  body: ['SPLASH!', 'GOT YOU!', 'DRENCHED!'],
  near: ['Splashed!', 'So close!'],
  hedge: ['The hedge got wet'],
  miss: ['Missed!', 'Too far off', 'Plop.']
};

interface Pop {
  key: number;
  text: string;
  x: number;
  y: number;
  points: number;
  big: boolean;
}

export const BalloonBoard: React.FC<BoardProps> = React.memo(({ game, me, canAct, onMove, onSettled, inkOf, partnerName }) => {
  const tr = useT();
  const them: Seat = me === 'user' ? 'partner' : 'user';
  const flip = me === 'partner';
  const sceneRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<WaterFx | null>(null);
  const cloudsRef = useRef<HTMLDivElement>(null);
  const myRig = useRef<RigLayers>({});
  const theirRig = useRef<RigLayers>({});

  const [shown, setShown] = useState<BalloonState>(() => playBalloon(game));
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState(true);
  const [giantOn, setGiantOn] = useState(false);
  const [aiming, setAiming] = useState(false);
  const [pop, setPop] = useState<Pop | null>(null);
  const [moods, setMoods] = useState<{ me: Mood | null; them: Mood | null }>({ me: null, them: null });

  const gameRef = useRef(game);
  gameRef.current = game;
  const idRef = useRef(game.id);
  const shownCount = useRef(game.moves.length);
  const running = useRef(false);
  const ownMove = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  const trRef = useRef(tr);
  trRef.current = tr;
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const moodFor = (seat: Seat, soak: number, winner: Seat | null): Mood => {
    if (winner) return winner === seat ? 'laugh' : 'cry';
    return soak >= 8 ? 'sad' : soak >= 4 ? 'tight' : 'smile';
  };

  const pump = useCallback(() => {
    const fx = engine.current;
    if (running.current || !fx) return;
    const g = gameRef.current;
    const k = shownCount.current;
    if (k >= g.moves.length) {
      setBusy(false);
      settledRef.current?.(k);
      return;
    }
    const before = playBalloon({ id: g.id, first: g.first, moves: g.moves.slice(0, k) });
    if (before.played !== k) {
      shownCount.current = g.moves.length;
      setBusy(false);
      settledRef.current?.(g.moves.length);
      return;
    }
    running.current = true;
    setBusy(true);
    const seat = before.turn;
    const target: Seat = seat === 'user' ? 'partner' : 'user';
    const move = g.moves[k];
    const flight = recordFlight(g, k, seat, move);
    const after = playBalloon({ id: g.id, first: g.first, moves: g.moves.slice(0, k + 1) });
    const giant = after.last?.throw.giant ?? false;
    const own = ownMove.current === move;
    if (own) ownMove.current = null;
    const iThrew = seat === me;
    const thrower = iThrew ? myRig.current : theirRig.current;
    const hit = iThrew ? theirRig.current : myRig.current;
    const dThrow = iThrew ? 1 : -1;
    // Watched drawing it back, they let go at once: no winding up a second time.
    const watched = !own && fx.watching();
    const wait = own ? 0 : watched ? WATCHED_WIND_UP_MS : WIND_UP_MS;
    const windUp = own ? 110 : wait;
    throwMoves(thrower, dThrow, windUp);
    setHolding(false);
    setMoods(m => ({ ...m, [iThrew ? 'me' : 'them']: 'tight' }));
    fx.throwNow({
      flight,
      mirror: !iThrew,
      giant,
      waitUntil: performance.now() + wait,
      // Your own was heard the moment your finger lifted.
      started: () => {
        if (!own) playSound('g-wb-throw', { rate: giant ? 0.78 : 1 });
      },
      landed: () => {
        const sx = iThrew ? flight.x : WB_W - flight.x;
        const sy = flight.hit === 'near' || flight.hit === 'miss' ? WB_GROUND : flight.y;
        const direct = flight.hit === 'head' || flight.hit === 'body';
        fx.burst(sx, sy, flight.hit, giant);
        if (direct) {
          playSound(giant ? 'g-wb-giant' : 'g-wb-burst');
          playSound('g-wb-eek', { rate: (target === 'user' ? 0.9 : 1.08) + Math.random() * 0.06, delay: 0.12 });
          playSound('us-shake', { delay: 0.76 });
          haptic('confirm');
          const hard = (giant ? 1.35 : 1) * (flight.hit === 'head' ? 1.1 : 0.92);
          hitMoves(hit, -dThrow, hard);
          fx.drips(sx, WB_GROUND - 120, giant ? 26 : 13);
          // The garden jolts.
          shakeRef.current?.animate?.(
            [
              { transform: 'translate3d(0, 0, 0)' },
              { transform: `translate3d(${dThrow * (giant ? 7 : 4)}px, ${giant ? 5 : 3}px, 0)` },
              { transform: `translate3d(${-dThrow * (giant ? 4 : 2)}px, -2px, 0)` },
              { transform: 'translate3d(0, 0, 0)' }
            ],
            { duration: giant ? 340 : 240, easing: 'ease-out' }
          );
        } else {
          playSound(flight.hit === 'hedge' ? 'g-wb-hedge' : 'g-wb-splat', { rate: giant ? 0.74 : 0.96 + Math.random() * 0.1, gain: flight.hit === 'miss' && flight.x > WB_W ? 0.4 : 1 });
          if (flight.hit === 'near') {
            flinchMoves(hit, -dThrow);
            playSound('g-wb-eek', { rate: 1.2, gain: 0.55 });
            haptic('tick');
          }
        }
        // How it went, on both faces.
        setMoods({
          me: iThrew ? (flight.points > 0 ? 'laugh' : 'sad') : direct ? 'shock' : flight.points > 0 ? 'shock' : 'smug',
          them: !iThrew ? (flight.points > 0 ? 'laugh' : 'sad') : direct ? 'shock' : flight.points > 0 ? 'shock' : 'smug'
        });
        if (flight.points > 0) cheerMoves(thrower, 1);
        const t = trRef.current;
        const words = WORDS[flight.hit];
        const word = words[(k + flight.points) % words.length];
        setPop({
          key: Date.now(),
          text: t(word),
          // Far enough in that the word, at its biggest, stays on the screen (it wraps if long).
          x: clamp(sx, 360, WB_W - 360),
          y: clamp(flight.hit === 'miss' || flight.hit === 'near' ? WB_GROUND - 210 : sy - 170, 150, WB_GROUND - 120),
          points: flight.points,
          big: direct
        });
        setShown(after);
        const rest = direct ? REST_HIT_MS : REST_MISS_MS;
        later(rest, () => {
          setMoods({ me: null, them: null });
          setPop(null);
          shownCount.current = k + 1;
          running.current = false;
          const more = gameRef.current.moves.length > k + 1;
          if (more) {
            pumpRef.current();
          } else {
            setHolding(true);
            setGiantOn(false);
            if (!after.over) playSound('g-wb-wind');
            pumpRef.current();
          }
        });
      }
    });
    // `me` never changes under a board; `them` follows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pumpRef = useRef(pump);
  pumpRef.current = pump;

  // The water canvas: made once, told the size whenever it changes.
  useEffect(() => {
    const scene = sceneRef.current;
    const cv = fxRef.current;
    if (!scene || !cv) return;
    const fx = new WaterFx(cv);
    engine.current = fx;
    fx.onTheirs = on => {
      if (on) scene.dataset.theirAim = '';
      else delete scene.dataset.theirAim;
    };
    const size = () => fx.resize(scene.clientWidth, scene.clientHeight);
    size();
    const seen = new ResizeObserver(size);
    seen.observe(scene);
    pumpRef.current();
    return () => {
      seen.disconnect();
      fx.destroy();
      engine.current = null;
      running.current = false;
      // Whatever is waiting by then, not what was waiting now.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timers.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const fx = engine.current;
    if (!fx) return;
    if (idRef.current !== game.id || game.moves.length < shownCount.current) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      fx.cancel();
      running.current = false;
      idRef.current = game.id;
      shownCount.current = game.moves.length;
      ownMove.current = null;
      setShown(playBalloon(game));
      setBusy(false);
      setHolding(true);
      setGiantOn(false);
      setMoods({ me: null, them: null });
      setPop(null);
      settledRef.current?.(game.moves.length);
      return;
    }
    if (!running.current) pumpRef.current();
  }, [game]);

  // The wind for the throw coming up: which way it blows on this screen, and how hard.
  const windHere = flip ? -shown.wind : shown.wind;
  useEffect(() => {
    const list = cloudsRef.current?.querySelectorAll<HTMLElement>('.wb-cloud');
    list?.forEach((el, i) => {
      const anim = el.getAnimations?.()[0];
      if (!anim) return;
      const rate = (windHere / WB_WIND_MAX) * 1.5 * (1 + i * 0.25);
      // Running backward from near its start would simply stop it: many laps on is the same place.
      const now = Number(anim.currentTime) || 0;
      if (rate < 0 && now < 3.8e7) anim.currentTime = now + 3.8e7;
      anim.playbackRate = rate;
    });
  }, [windHere]);

  // ------------------------------------------- their aim, as it comes

  const turnRef = useRef<Seat | null>(null);
  turnRef.current = shown.over ? null : shown.turn;
  useEffect(
    () =>
      onAim(said => {
        if (said.k !== 'balloon') return;
        const fx = engine.current;
        const g = gameRef.current;
        // Only for the garden as it stands here, while it is theirs to throw.
        if (!fx || said.g !== g.id || said.n !== g.moves.length || said.n !== shownCount.current || running.current || turnRef.current !== them) return;
        const a = said.a;
        if (!a || a.length < 7) {
          fx.hear(null);
          return;
        }
        fx.hear({
          vx: clamp(a[0], 0, WB_MAX_V),
          vy: clamp(a[1], 0, WB_MAX_V),
          pullX: clamp(a[2], -160, 160),
          pullY: clamp(a[3], -160, 160),
          power: clamp(a[4] / 1000, 0, 1),
          ok: a[5] === 1,
          giant: a[6] === 1
        });
      }),
    [them]
  );
  // Your turn: nothing of theirs is left drawn back.
  useEffect(() => {
    if (canAct) engine.current?.hush();
  }, [canAct]);
  /** Tells their phone how the balloon is drawn back (core/gameAim); null when it is let go of. */
  const say = (a: Aiming | null) => {
    const g = gameRef.current;
    sayAim('balloon', g.id, g.moves.length, a ? [a.vx, a.vy, a.pullX, a.pullY, a.power * 1000, a.ok ? 1 : 0, a.giant ? 1 : 0] : null);
  };
  // Leaving the garden, or the turn passing: their phone puts it back in your hand.
  useEffect(() => {
    if (!canAct) return;
    return () => {
      const g = gameRef.current;
      sayAim('balloon', g.id, g.moves.length, null);
    };
  }, [canAct]);

  // ---------------------------------------------------------- aiming

  const pull = useRef<{ x: number; y: number; id: number } | null>(null);
  const giantRef = useRef(giantOn);
  giantRef.current = giantOn;
  const stretched = useRef(false);

  const aimFrom = (clientX: number, clientY: number): Aiming | null => {
    const start = pull.current;
    const scene = sceneRef.current;
    if (!start || !scene) return null;
    const width = scene.clientWidth || 1;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) return null;
    const full = width * 0.42;
    const perPx = (WB_MAX_V * 1.3) / full;
    const vx = clamp(Math.round(-dx * perPx), 0, WB_MAX_V);
    const vy = clamp(Math.round(dy * perPx), 0, WB_MAX_V);
    const power = clamp(dist / full, 0, 1);
    const toGarden = WB_W / width;
    // Drawn back, but only so far: it stays near the hand.
    const reach = Math.min(1, 120 / (dist * toGarden || 1));
    return {
      vx,
      vy,
      pullX: -dx * toGarden * reach,
      pullY: dy * toGarden * reach,
      power,
      ok: vx >= WB_MIN_VX,
      giant: giantRef.current
    };
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canAct || busy || e.button > 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    pull.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    stretched.current = false;
    setAiming(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* it still follows while the finger is over it */
    }
  };
  const onDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pull.current || pull.current.id !== e.pointerId) return;
    const a = aimFrom(e.clientX, e.clientY);
    if (a && !stretched.current) {
      stretched.current = true;
      playSound('g-wb-stretch');
      haptic('tick');
    }
    engine.current?.aim(a);
    say(a);
  };
  const onEnd = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pull.current || pull.current.id !== e.pointerId) return;
    const a = cancelled ? null : aimFrom(e.clientX, e.clientY);
    pull.current = null;
    setAiming(false);
    engine.current?.aim(null);
    const input = a && a.ok && canAct && !busy ? { vx: a.vx, vy: a.vy, giant: a.giant } : null;
    if (!a || !input || !throwAllowed(input, playBalloon(gameRef.current).giantLeft[me])) {
      // Let go without a throw: their phone sees it back in your hand.
      say(null);
      return;
    }
    const move = encodeThrow(input);
    ownMove.current = move;
    // Heard the instant the finger lifts.
    playSound('g-wb-throw', { rate: a.giant ? 0.78 : 1 });
    onMove(move);
  };

  // ------------------------------------------------------------ draw

  const myMood = moods.me ?? moodFor(me, shown.soak[me], shown.winner);
  const theirMood = moods.them ?? moodFor(them, shown.soak[them], shown.winner);
  const tube = (seat: Seat) => {
    const soak = shown.soak[seat];
    return (
      <div className="wb-tube" data-side={seat === me ? 'me' : 'them'} role="meter" aria-valuemin={0} aria-valuemax={SOAK_FULL} aria-valuenow={soak} aria-label={tr('How wet')}>
        <i style={{ transform: `scaleX(${soak / SOAK_FULL})` }} />
        <b>{soak}/{SOAK_FULL}</b>
      </div>
    );
  };
  const puddle = (seat: Seat) => {
    const soak = shown.soak[seat];
    const x = seat === me ? WB_NEAR : WB_FAR;
    return (
      <span
        key={seat}
        className="wb-puddle"
        style={{ left: percentX(x), top: percentY(WB_GROUND + 8), transform: `translate(-50%, -50%) scale(${soak ? 0.32 + (soak / SOAK_FULL) * 0.8 : 0})` }}
        aria-hidden="true"
      />
    );
  };
  const marks = useMemo(
    () =>
      shown.marks
        .filter(m => m.hit === 'miss' || m.hit === 'near')
        .slice(-7)
        .map(m => ({ x: flip ? WB_W - m.x : m.x, giant: m.giant })),
    [shown.marks, flip]
  );
  const onLeft = useMemo(() => (me === 'user' ? ('bear' as const) : ('bunny' as const)), [me]);
  const onRight = onLeft === 'bear' ? ('bunny' as const) : ('bear' as const);
  const myTurnHolding = canAct && !busy && holding && !aiming;
  const myArmsUp = canAct && !busy && holding;
  const theyHold = !canAct && !busy && holding && !shown.over;
  const windBars = Math.abs(windHere);

  return (
    <div className="wb" style={{ '--me': inkOf(me), '--them': inkOf(them) } as React.CSSProperties}>
      <div className="wb-frame">
        <div
          className="wb-scene"
          ref={sceneRef}
          data-aim={(canAct && !busy) || undefined}
          onPointerDown={onDown}
          onPointerMove={onDrag}
          onPointerUp={e => onEnd(e, false)}
          onPointerCancel={e => onEnd(e, true)}
          role="img"
          aria-label={tr('The garden: you on the left, {name} on the right', { name: partnerName })}
        >
          <div className="wb-world" ref={shakeRef}>
            <Garden hedge={shown.hedge} />
            <div className="wb-clouds" ref={cloudsRef} aria-hidden="true">
              {CLOUDS.map((c, i) => (
                <span key={i} className="wb-cloud" style={{ top: `${c.y * 2}%`, '--s': c.s, animationDelay: `${c.delay * 38}s` } as React.CSSProperties} />
              ))}
            </div>
            {marks.map((m, i) => (
              <span key={i} className="wb-mark" data-giant={m.giant || undefined} style={{ left: percentX(m.x), top: percentY(WB_GROUND + 14) }} aria-hidden="true" />
            ))}
            {puddle(me)}
            {puddle(them)}
            <div className="wb-who" style={{ left: percentX(WB_NEAR) }} data-soaked={shown.soak[me] >= 8 || undefined}>
              <Rig kind={onLeft} mood={myMood} arms={myArmsUp ? 'up' : 'down'} phase={0} layers={myRig} facing={1}>
                <WetMarks level={wetLevel(shown.soak[me])} />
              </Rig>
              {shown.over && shown.winner === them && <RainCloud />}
            </div>
            <div className="wb-who" style={{ left: percentX(WB_FAR) }} data-soaked={shown.soak[them] >= 8 || undefined}>
              <Rig kind={onRight} mood={theirMood} arms={theyHold ? 'up' : 'down'} phase={2.1} layers={theirRig} facing={-1}>
                <WetMarks level={wetLevel(shown.soak[them])} />
              </Rig>
              {shown.over && shown.winner === me && <RainCloud />}
            </div>
            {myTurnHolding && <HeldBalloon giant={giantOn} left={WB_HAND_X} side="me" />}
            {theyHold && <HeldBalloon giant={false} left={WB_W - WB_HAND_X} side="them" />}
            <canvas ref={fxRef} className="wb-fx" aria-hidden="true" />
          </div>
          <div className="wb-hud">
            {tube(me)}
            <div className="wb-wind" data-dir={windHere > 0 ? 'right' : 'left'} aria-label={tr('Wind: {n} of {max}', { n: windBars, max: WB_WIND_MAX })}>
              <span className="wb-wind-arrow" aria-hidden="true">
                <svg viewBox="0 0 28 14">
                  <path d="M1,7 H22 M16,2 L23,7 L16,12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="wb-wind-bars" aria-hidden="true">
                {Array.from({ length: WB_WIND_MAX }, (_, i) => (
                  <i key={i} data-on={i < windBars || undefined} />
                ))}
              </span>
            </div>
            {tube(them)}
          </div>
          {pop && (
            <div className="wb-pop" key={pop.key} data-big={pop.big || undefined} data-none={pop.points === 0 || undefined} style={{ left: percentX(pop.x), top: percentY(pop.y) }} aria-live="polite">
              {pop.text}
              {pop.points > 0 && <small>+{pop.points}</small>}
            </div>
          )}
        </div>
      </div>
      <div className="wb-bar">
        <button
          type="button"
          className="wb-giant"
          data-on={giantOn || undefined}
          disabled={!canAct || busy || !shown.giantLeft[me]}
          onClick={() => {
            setGiantOn(on => !on);
            haptic('tick');
          }}
          aria-pressed={giantOn}
        >
          <span className="wb-giant-art" aria-hidden="true" />
          {shown.giantLeft[me] ? tr('Giant balloon') : tr('Giant used')}
        </button>
        <span className="wb-hint">{canAct && !busy ? (aiming ? tr('Let go to throw') : tr('Pull back anywhere and let go')) : ''}</span>
      </div>
    </div>
  );
});
BalloonBoard.displayName = 'BalloonBoard';

/** The balloon held up, gently bobbing. */
const HeldBalloon: React.FC<{ giant: boolean; left: number; side: 'me' | 'them' }> = ({ giant, left, side }) => (
  <span className="wb-held" data-giant={giant || undefined} data-side={side} style={{ left: percentX(left), top: percentY(WB_HAND_Y) }} aria-hidden="true">
    <svg viewBox="-14 -15 28 32">
      <path d={BALLOON_PATH} fill={giant ? '#ff7fb0' : '#7cc8ff'} stroke="#3b2723" strokeWidth="2" strokeLinejoin="round" />
      <path d={KNOT_PATH} fill={giant ? '#d83c80' : '#2b86d9'} stroke="#3b2723" strokeWidth="1.4" strokeLinejoin="round" />
      <ellipse cx="-4.5" cy="-5" rx="2.2" ry="3.8" transform="rotate(20 -4.5 -5)" fill="#fff" opacity="0.75" />
    </svg>
  </span>
);

/** The little rain cloud that follows whoever lost. */
const RainCloud: React.FC = () => (
  <span className="wb-rain" aria-hidden="true">
    <svg viewBox="0 0 60 30">
      <path d="M12,28 C4,28 1,21 5,16 C3,9 11,5 16,8 C19,1 32,0 36,8 C43,5 51,9 50,16 C57,18 58,28 48,28 Z" fill="#8ba1b8" stroke="#3b2723" strokeWidth="2" strokeLinejoin="round" />
    </svg>
    {Array.from({ length: 6 }, (_, i) => (
      <i key={i} style={{ left: `${14 + i * 14}%`, animationDelay: `${(i * 137) % 600}ms` }} />
    ))}
  </span>
);
