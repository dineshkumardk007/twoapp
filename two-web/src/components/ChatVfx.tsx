import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VFX, VFX_EVERY_MS, onVfx, sayVfx, scatter, type Vfx, type VfxId } from '../core/chatVfx';
import { haptic } from '../core/haptics';
import { playSound } from '../core/sounds';

// Effects over the chat (core/chatVfx). Each one is laid out once, from a
// seed, as a few dozen small pieces that only ever move by transform and
// opacity (index.css, "vx-"): the phone's graphics chip plays them by itself
// while the conversation underneath stays as it is, and can be typed in.

/** One effect playing: where it starts from, and the screen it was laid out for. */
export interface VfxPlay {
  key: number;
  vfx: Vfx;
  /** Where the emoji is on the screen, in pixels. */
  ox: number;
  oy: number;
  w: number;
  h: number;
  seed: number;
}

/** Custom properties, as a style. */
const vars = (o: Record<string, string | number>) => o as unknown as React.CSSProperties;
const px = (n: number) => `${Math.round(n * 10) / 10}px`;
const sec = (n: number) => `${Math.round(n * 1000) / 1000}s`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

type Draw = (p: VfxPlay, r: () => number) => React.ReactNode;

const PARTY_COLOURS = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c', '#f72585'];
const BALLOON_COLOURS = ['#ff4d6d', '#ffb703', '#06d6a0', '#4cc9f0', '#b388ff', '#ff7ab6'];

const DRAW: Record<VfxId, Draw> = {
  // Hearts burst out of it, float up the chat, and some pop into little ones.
  heart: (p, r) => (
    <>
      <i className="vx-glow vx-glow-pink" style={vars({ '--x': px(p.ox), '--y': px(p.oy) })} />
      {range(24).map(i => {
        const a = r() * Math.PI * 2;
        const far = 50 + r() * 110;
        return (
          <i
            key={i}
            className="vx-heart"
            style={vars({
              '--x': px(p.ox),
              '--y': px(p.oy),
              '--bx': px(Math.cos(a) * far),
              '--by': px(Math.sin(a) * far * 0.8),
              '--fx': px((r() - 0.5) * 120),
              '--fy': px(-(p.h * (0.35 + r() * 0.5))),
              '--s': 0.6 + r() * 1.1,
              '--d': sec(r() * 0.22),
              '--t': sec(2.2 + r() * 0.8)
            })}
          >
            <b style={vars({ '--d': sec(r() * 0.5) })}>{['❤️', '💖', '💗', '💕'][i % 4]}</b>
          </i>
        );
      })}
      {range(6).map(i => {
        const x = p.w * (0.12 + r() * 0.76);
        const y = p.h * (0.15 + r() * 0.5);
        const d = 0.9 + r() * 0.9;
        return range(5).map(k => {
          const a = (k / 5) * Math.PI * 2 + i;
          return (
            <i
              key={`${i}-${k}`}
              className="vx-mini"
              style={vars({ '--x': px(x), '--y': px(y), '--bx': px(Math.cos(a) * 34), '--by': px(Math.sin(a) * 34), '--d': sec(d) })}
            >
              ❤️
            </i>
          );
        });
      })}
    </>
  ),

  // It bursts into pieces; each piece lands, burns as a flame of its own, and goes out in sparks.
  fire: (p, r) => (
    <>
      <i className="vx-heat" />
      <i className="vx-glow vx-glow-fire" style={vars({ '--x': px(p.ox), '--y': px(p.oy) })} />
      {range(10).map(i => {
        const x = p.w * (0.08 + r() * 0.84);
        const y = p.h * (0.14 + r() * 0.62);
        const d = r() * 0.18;
        return (
          <i
            key={i}
            className="vx-shard"
            style={vars({ '--x': px(x), '--y': px(y), '--fx': px(p.ox - x), '--fy': px(p.oy - y), '--d': sec(d), '--s': 0.8 + r() * 0.9 })}
          >
            <b className="vx-ember" style={vars({ '--r': `${Math.round(r() * 720 - 360)}deg` })} />
            <b className="vx-flame">
              <u>🔥</u>
            </b>
            {range(4).map(k => {
              const a = r() * Math.PI * 2;
              const far = 26 + r() * 46;
              return <s key={k} className="vx-spark" style={vars({ '--sx': px(Math.cos(a) * far), '--sy': px(Math.sin(a) * far - 14) })} />;
            })}
          </i>
        );
      })}
    </>
  ),

  // Laughing faces fall from the top, bounce where they land, and rock about.
  laugh: (p, r) => (
    <>
      {range(20).map(i => (
        <i
          key={i}
          className="vx-drop"
          style={vars({
            '--x': px(p.w * (0.04 + r() * 0.86)),
            '--g': px(p.h - 90 - r() * 90),
            '--b': px(40 + r() * 70),
            '--s': 0.8 + r() * 0.9,
            '--d': sec(r() * 0.9),
            '--r': `${Math.round(r() * 80 - 40)}deg`
          })}
        >
          <b style={vars({ '--d': sec(r() * 0.4) })}>{i % 3 ? '😂' : '🤣'}</b>
        </i>
      ))}
    </>
  ),

  // Confetti from both bottom corners, thrown up and across, turning as it falls.
  party: (p, r) => (
    <>
      <i className="vx-pop" style={vars({ '--x': px(0), '--y': px(p.h) })} />
      <i className="vx-pop" style={vars({ '--x': px(p.w), '--y': px(p.h) })} />
      {range(44).map(i => {
        const left = i % 2 === 0;
        const kind = i % 3;
        return (
          <i
            key={i}
            className="vx-cx"
            style={vars({
              '--x0': px(left ? -10 : p.w + 10),
              '--dx': px((left ? 1 : -1) * p.w * (0.15 + r() * 0.75)),
              '--t': sec(1.9 + r() * 1.1),
              '--d': sec(r() * 0.25)
            })}
          >
            <b
              className="vx-cy"
              data-k={kind}
              style={vars({
                '--y0': px(p.h),
                '--up': px(p.h * (0.45 + r() * 0.5)),
                '--rs': `${Math.round(500 + r() * 900) * (r() < 0.5 ? -1 : 1)}deg`,
                '--c': PARTY_COLOURS[Math.floor(r() * PARTY_COLOURS.length)]
              })}
            />
          </i>
        );
      })}
    </>
  ),

  // One big kiss lands on the screen, and lip prints follow it all around.
  kiss: (p, r) => (
    <>
      <i className="vx-wash vx-wash-pink" />
      <i className="vx-ring" style={vars({ '--x': px(p.w / 2), '--y': px(p.h * 0.42), '--d': '0.32s' })} />
      <i className="vx-stamp" style={vars({ '--x': px(p.w / 2), '--y': px(p.h * 0.42) })}>
        💋
      </i>
      {range(9).map(i => (
        <i
          key={i}
          className="vx-lips"
          style={vars({
            '--x': px(p.w * (0.1 + r() * 0.8)),
            '--y': px(p.h * (0.12 + r() * 0.68)),
            '--s': 0.7 + r() * 0.8,
            '--r': `${Math.round(r() * 70 - 35)}deg`,
            '--d': sec(0.55 + i * 0.11)
          })}
        >
          💋
        </i>
      ))}
      {range(8).map(i => (
        <i
          key={`h${i}`}
          className="vx-rise"
          style={vars({ '--x': px(p.w * (0.1 + r() * 0.8)), '--y': px(p.h * (0.5 + r() * 0.4)), '--fy': px(-(120 + r() * 160)), '--d': sec(0.7 + r() * 0.8), '--s': 0.5 + r() * 0.5 })}
        >
          💗
        </i>
      ))}
    </>
  ),

  // The heart trembles, cracks down the middle, and its halves fall away in pieces.
  broken: (p, r) => (
    <>
      <i className="vx-wash vx-wash-grey" />
      <i className="vx-crack" style={vars({ '--x': px(p.w / 2), '--y': px(p.h * 0.4) })} />
      <i className="vx-half" data-side="l" style={vars({ '--x': px(p.w / 2), '--y': px(p.h * 0.4), '--h': px(p.h * 0.6) })}>
        <b>❤️</b>
      </i>
      <i className="vx-half" data-side="r" style={vars({ '--x': px(p.w / 2), '--y': px(p.h * 0.4), '--h': px(p.h * 0.6) })}>
        <b>❤️</b>
      </i>
      {range(14).map(i => (
        <i
          key={i}
          className="vx-bit"
          style={vars({
            '--x': px(p.w / 2 + (r() - 0.5) * 70),
            '--y': px(p.h * 0.4 + (r() - 0.5) * 60),
            '--fx': px((r() - 0.5) * 220),
            '--fy': px(p.h * (0.35 + r() * 0.35)),
            '--r': `${Math.round(r() * 900 - 450)}deg`,
            '--s': 0.5 + r() * 0.9,
            '--d': sec(0.95 + r() * 0.35)
          })}
        />
      ))}
    </>
  ),

  // The rose blooms, and petals drift down slowly, turning as they come.
  rose: (p, r) => (
    <>
      <i className="vx-wash vx-wash-rose" />
      <i className="vx-bloom" style={vars({ '--x': px(p.ox), '--y': px(p.oy) })}>
        🌹
      </i>
      {range(26).map(i => (
        <i
          key={i}
          className="vx-petal"
          style={vars({
            '--x': px(p.w * (-0.05 + r() * 1.05)),
            '--dx': px((r() - 0.5) * 140),
            '--h': px(p.h + 60),
            '--t': sec(2.8 + r() * 1.5),
            '--d': sec(r() * 1.3),
            '--s': 0.7 + r() * 0.9
          })}
        >
          <b style={vars({ '--t': sec(1.1 + r() * 0.9), '--d': sec(-r() * 2) })} />
        </i>
      ))}
    </>
  ),

  // The lights dip, and a ghost drifts in, rushes right up to you, and is gone.
  ghost: (p, r) => (
    <>
      <i className="vx-wash vx-wash-night" />
      {range(3).map(i => (
        <i key={`t${i}`} className="vx-ghost vx-ghost-trail" style={vars({ '--d': sec(0.07 * (3 - i)), '--o': 0.12 + i * 0.08 })}>
          <b>👻</b>
        </i>
      ))}
      <i className="vx-ghost" style={vars({ '--d': '0s', '--o': 1 })}>
        <b>👻</b>
      </i>
      <i className="vx-boo">BOO!</i>
      {range(7).map(i => (
        <i
          key={i}
          className="vx-rise vx-rise-ghost"
          style={vars({ '--x': px(p.w * (0.06 + r() * 0.84)), '--y': px(p.h * (0.6 + r() * 0.35)), '--fy': px(-(140 + r() * 200)), '--d': sec(1.5 + r() * 0.7), '--s': 0.5 + r() * 0.6 })}
        >
          👻
        </i>
      ))}
    </>
  ),

  // Hearts spiral out of it in a widening ring, with rosy bubbles rising behind.
  adore: (p, r) => (
    <>
      <i className="vx-blush" />
      <i className="vx-ring vx-ring-pink" style={vars({ '--x': px(p.ox), '--y': px(p.oy), '--d': '0s' })} />
      <i className="vx-ring vx-ring-pink" style={vars({ '--x': px(p.ox), '--y': px(p.oy), '--d': '0.35s' })} />
      {range(18).map(i => (
        <i
          key={i}
          className="vx-orbit"
          style={vars({ '--x': px(p.ox), '--y': px(p.oy), '--a': `${i * 20}deg`, '--d': sec(i * 0.045), '--t': sec(2.3 + r() * 0.5) })}
        >
          <b style={vars({ '--rad': px(Math.min(p.w, p.h) * (0.28 + r() * 0.3)), '--s': 0.7 + r() * 0.8 })}>{['💗', '💖', '💕'][i % 3]}</b>
        </i>
      ))}
      {range(10).map(i => (
        <i
          key={`b${i}`}
          className="vx-bubble"
          style={vars({ '--x': px(p.w * (0.05 + r() * 0.9)), '--y': px(p.h + 30), '--fy': px(-(p.h * (0.5 + r() * 0.5))), '--s': 0.5 + r() * 1.3, '--d': sec(r() * 1.1), '--t': sec(2 + r() * 1) })}
        />
      ))}
    </>
  ),

  // The chat shakes, the screen goes red at the edges, and steam shoots out of it.
  // The face itself comes up big, goes red and shakes harder and harder, steam
  // puffing from its head - and then it blows its top: a bang, a burst of
  // steam, and little angry faces flying everywhere.
  rage: (p, r) => {
    const cx = p.w / 2;
    const cy = p.h * 0.42;
    const at = { '--x': px(cx), '--y': px(cy) };
    return (
      <>
        <i className="vx-rg-vign" />
        <i className="vx-rg-flush" style={vars(at)} />
        {/* Steam from the top of its head, in three puffs, each bigger than the last. */}
        {range(3).map(wave =>
          range(4).map(k => {
            const side = k % 2 ? 1 : -1;
            return (
              <i
                key={`s${wave}-${k}`}
                className="vx-rg-puff"
                style={vars({
                  '--x': px(cx + side * (34 + r() * 10)),
                  '--y': px(cy - 52 - r() * 8),
                  '--fx': px(side * (20 + r() * 50 + wave * 18)),
                  '--fy': px(-(60 + r() * 60 + wave * 30)),
                  '--s': 0.7 + wave * 0.35 + r() * 0.4,
                  '--d': sec(0.5 + wave * 0.3 + (k >> 1) * 0.06)
                })}
              />
            );
          })
        )}
        {range(4).map(i => {
          const a = -Math.PI / 2 + (i % 2 ? 1 : -1) * (0.7 + r() * 0.5);
          return (
            <i
              key={`m${i}`}
              className="vx-rg-mark"
              style={vars({ '--x': px(cx + Math.cos(a) * (88 + r() * 20)), '--y': px(cy + Math.sin(a) * (78 + r() * 20)), '--s': 0.8 + r() * 0.5, '--d': sec(0.35 + i * 0.27) })}
            >
              💢
            </i>
          );
        })}
        <i className="vx-rg-face" style={vars({ ...at, '--fx': px(p.ox - cx), '--fy': px(p.oy - cy) })}>
          <b>😡</b>
        </i>
        {/* It blows its top. */}
        <i className="vx-ring vx-rg-ring" style={vars({ ...at, '--d': '1.45s' })} />
        {range(12).map(i => {
          const a = (i / 12) * Math.PI * 2 + r() * 0.3;
          const far = 90 + r() * 90;
          return (
            <i
              key={`b${i}`}
              className="vx-rg-blast"
              style={vars({ ...at, '--fx': px(Math.cos(a) * far), '--fy': px(Math.sin(a) * far * 0.8), '--s': 1 + r() * 1.2, '--d': sec(1.45 + r() * 0.06) })}
            />
          );
        })}
        {range(14).map(i => {
          const a = (i / 14) * Math.PI * 2 + r() * 0.4;
          const far = Math.min(p.w, p.h) * (0.32 + r() * 0.28);
          return (
            <i
              key={`f${i}`}
              className="vx-rg-bit"
              style={vars({
                ...at,
                '--fx': px(Math.cos(a) * far),
                '--fy': px(Math.sin(a) * far),
                '--fall': px(120 + r() * 160),
                '--r': `${Math.round(r() * 720 - 360)}deg`,
                '--s': 0.5 + r() * 0.6,
                '--d': sec(1.47 + r() * 0.08)
              })}
            >
              {i % 3 ? '😡' : '🤬'}
            </i>
          );
        })}
      </>
    );
  },

  // A band of light sweeps across, and gold stars come out and go in all over the screen.
  sparkle: (p, r) => (
    <>
      <i className="vx-sweep" />
      {range(26).map(i => (
        <i
          key={i}
          className="vx-star"
          style={vars({ '--x': px(p.w * (0.04 + r() * 0.92)), '--y': px(p.h * (0.06 + r() * 0.8)), '--s': 0.5 + r() * 1.4, '--d': sec(0.15 + r() * 1.7) })}
        >
          <b />
        </i>
      ))}
      {range(18).map(i => (
        <i
          key={`d${i}`}
          className="vx-dust"
          style={vars({ '--x': px(p.w * r()), '--y': px(p.h * r() * 0.5), '--fy': px(p.h * (0.25 + r() * 0.3)), '--d': sec(r() * 1.4), '--t': sec(1.6 + r() * 1.2) })}
        />
      ))}
    </>
  ),

  // Light breaks into colours from it, and diamonds drop, land, and flash.
  diamond: (p, r) => (
    <>
      <i className="vx-wash vx-wash-ice" />
      {range(8).map(i => (
        <i key={`r${i}`} className="vx-ray" style={vars({ '--x': px(p.ox), '--y': px(p.oy), '--a': `${i * 45 + 10}deg`, '--c': `hsl(${i * 45} 95% 72%)`, '--d': sec(i * 0.03) })} />
      ))}
      {range(14).map(i => {
        const x = p.w * (0.05 + r() * 0.84);
        const g = p.h - 100 - r() * 110;
        const d = 0.2 + r() * 0.9;
        return (
          <React.Fragment key={i}>
            <i className="vx-gem" style={vars({ '--x': px(x), '--g': px(g), '--s': 0.8 + r() * 0.8, '--d': sec(d) })}>
              💎
            </i>
            <i className="vx-glint" style={vars({ '--x': px(x + 14), '--y': px(g + 6), '--d': sec(d + 0.74) })} />
          </React.Fragment>
        );
      })}
    </>
  ),

  // Butterflies leave it one after another and flutter off every way, wings beating.
  butterfly: (p, r) => (
    <>
      <i className="vx-glow vx-glow-sky" style={vars({ '--x': px(p.ox), '--y': px(p.oy) })} />
      {range(12).map(i => {
        const a = (i / 12) * Math.PI * 2 + r() * 0.5;
        const far = Math.max(p.w, p.h) * 0.8;
        const dx = Math.cos(a) * far;
        return (
          <i key={i} className="vx-bfx" style={vars({ '--x0': px(p.ox), '--dx': px(dx), '--t': sec(2.6 + r() * 1.1), '--d': sec(i * 0.09) })}>
            <b className="vx-bfy" style={vars({ '--y0': px(p.oy), '--dy': px(Math.sin(a) * far * 0.8 - 80) })}>
              <u className="vx-bob" style={vars({ '--wob': px(14 + r() * 22), '--t': sec(0.45 + r() * 0.3), '--rot': `${Math.round(dx > 0 ? 20 + r() * 30 : -20 - r() * 30)}deg` })}>
                <s className="vx-flap" style={vars({ '--s': 0.8 + r() * 0.8, '--t': sec(0.11 + r() * 0.06) })}>
                  🦋
                </s>
              </u>
            </b>
          </i>
        );
      })}
    </>
  ),

  // It rumbles where it is, lifts off on a column of smoke, and the stars streak by.
  rocket: (p, r) => (
    <>
      {range(10).map(i => (
        <i
          key={`c${i}`}
          className="vx-smoke"
          style={vars({ '--x': px(p.ox + (r() - 0.5) * 30), '--y': px(p.oy + 26), '--fx': px((r() - 0.5) * 190), '--fy': px(10 + r() * 40), '--s': 1 + r() * 1.6, '--d': sec(0.25 + r() * 0.45) })}
        />
      ))}
      {range(12).map(i => {
        // Along the way up, each left behind as the rocket passes.
        const part = (i + 1) / 13;
        return (
          <i
            key={`t${i}`}
            className="vx-smoke"
            style={vars({ '--x': px(p.ox + (r() - 0.5) * 16), '--y': px(p.oy - (p.oy + 80) * part * part), '--fx': px((r() - 0.5) * 50), '--fy': px(30 + r() * 30), '--s': 0.6 + r() * 0.8, '--d': sec(0.7 + part * 1.34) })}
          />
        );
      })}
      <i className="vx-rocket" style={vars({ '--x': px(p.ox), '--y': px(p.oy), '--up': px(-(p.oy + 180)) })}>
        <b>
          <u>🔥</u>
          <s>🚀</s>
        </b>
      </i>
      {range(14).map(i => (
        <i
          key={`s${i}`}
          className="vx-streak"
          style={vars({ '--x': px(p.w * r()), '--h': px(p.h + 200), '--len': px(50 + r() * 110), '--d': sec(1.25 + r() * 0.9), '--t': sec(0.45 + r() * 0.35) })}
        />
      ))}
    </>
  ),

  // The screen flashes white, a bolt comes down onto it, and it crackles where it struck.
  bolt: (p, r) => {
    const path = (fromX: number, fromY: number, toX: number, toY: number, steps: number, wild: number) => {
      const pts = [`${fromX.toFixed(1)},${fromY.toFixed(1)}`];
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        pts.push(`${(fromX + (toX - fromX) * t + (r() - 0.5) * wild).toFixed(1)},${(fromY + (toY - fromY) * t).toFixed(1)}`);
      }
      pts.push(`${toX.toFixed(1)},${toY.toFixed(1)}`);
      return pts.join(' ');
    };
    const top = p.ox + (r() - 0.5) * p.w * 0.5;
    const main = path(top, -10, p.ox, p.oy, 9, 70);
    const midX = top + (p.ox - top) * 0.45;
    const midY = p.oy * 0.45;
    const branches = [
      path(midX, midY, midX + (r() < 0.5 ? -1 : 1) * (60 + r() * 90), midY + 90 + r() * 80, 5, 40),
      path(top + (p.ox - top) * 0.7, p.oy * 0.7, p.ox + (r() < 0.5 ? -1 : 1) * (70 + r() * 60), p.oy * 0.7 + 70 + r() * 60, 4, 30)
    ];
    return (
      <>
        <i className="vx-strobe" />
        <svg className="vx-bolt" width={p.w} height={p.h} viewBox={`0 0 ${p.w} ${p.h}`} aria-hidden="true">
          <polyline className="vx-bolt-glow" points={main} pathLength={1} />
          <polyline className="vx-bolt-core" points={main} pathLength={1} />
          {branches.map((b, i) => (
            <polyline key={i} className="vx-bolt-core vx-bolt-branch" points={b} pathLength={1} />
          ))}
        </svg>
        <i className="vx-glow vx-glow-bolt" style={vars({ '--x': px(p.ox), '--y': px(p.oy) })} />
        {range(14).map(i => (
          <i
            key={i}
            className="vx-zap"
            style={vars({ '--x': px(p.ox), '--y': px(p.oy), '--a': `${Math.round(r() * 360)}deg`, '--far': px(40 + r() * 90), '--d': sec(0.2 + r() * 0.5) })}
          >
            <b />
          </i>
        ))}
      </>
    );
  },

  // Balloons rise from the bottom on their strings, swaying; a few go pop on the way.
  balloon: (p, r) => (
    <>
      {range(13).map(i => {
        // Four go pop, at the moments the sound has a pop in it.
        const pops = i % 3 === 0 && i < 12;
        const colour = BALLOON_COLOURS[i % BALLOON_COLOURS.length];
        return (
          <i
            key={i}
            className="vx-bal"
            style={vars({ '--x': px(p.w * (0.04 + r() * 0.84)), '--y0': px(p.h + 90), '--up': px(-(p.h + 260)), '--t': sec(2.9 + r() * 1.1), '--d': sec(r() * (pops ? 0.3 : 0.9)), '--s': 0.8 + r() * 0.6 })}
          >
            <b style={vars({ '--t': sec(0.9 + r() * 0.7), '--d': sec(-r() * 2), '--c': colour, '--pd': sec([1.3, 1.9, 2.5, 2.95][i / 3] ?? 9) })}>
              <u className="vx-bal-body" data-pops={pops || undefined} />
              {pops &&
                range(6).map(k => (
                  <s key={k} className="vx-bal-bit" style={vars({ '--a': `${k * 60 + 15}deg` })}>
                    <em />
                  </s>
                ))}
            </b>
          </i>
        );
      })}
    </>
  )
};

/** One effect, drawn. Kept apart so it can be drawn by itself (the tests do). */
export const VfxArt: React.FC<{ play: VfxPlay }> = ({ play }) => (
  <div className="vx" data-v={play.vfx.id}>
    {DRAW[play.vfx.id](play, scatter(play.seed))}
  </div>
);

/** How the big emoji in the conversation moves while it waits to be tapped. */
const IDLE: Record<VfxId, 'beat' | 'flicker' | 'rock' | 'float' | 'glint' | 'tremble'> = {
  heart: 'beat',
  fire: 'flicker',
  laugh: 'rock',
  party: 'rock',
  kiss: 'beat',
  broken: 'tremble',
  rose: 'float',
  ghost: 'float',
  adore: 'beat',
  rage: 'tremble',
  sparkle: 'glint',
  diamond: 'glint',
  butterfly: 'float',
  rocket: 'tremble',
  bolt: 'flicker',
  balloon: 'float'
};

/** The emoji as it stands in the conversation: large, alive, and a button that plays it. */
export const VfxEmoji: React.FC<{ vfx: Vfx; id: string; label: string; onPlay: () => void }> = ({ vfx, id, label, onPlay }) => (
  <button
    type="button"
    className="vx-big"
    data-vfx-msg={id}
    data-idle={IDLE[vfx.id]}
    // Waits a moment before it plays, in case a second tap is coming for a heart.
    data-tap-wait
    onClick={onPlay}
    aria-label={label}
  >
    <span aria-hidden="true">{vfx.emoji}</span>
  </button>
);

/** Shakes the conversation for a moment (the angry one, a rocket leaving, a bolt landing). */
const SHAKES: Partial<Record<VfxId, [how: string, delay: number, ms: number]>> = {
  rage: ['hard', 1450, 520],
  rocket: ['soft', 250, 700],
  bolt: ['soft', 100, 400]
};

let nextKey = 1;

/**
 * The chat's effects: `stage` goes anywhere in what is drawn (it puts itself
 * over the whole screen), `play` starts one - from a message's emoji when it
 * is on screen, from the middle when it is not - and `tap` is a finger on one,
 * which the other phone is told about too.
 */
export function useChatVfx(shakeTarget?: React.RefObject<HTMLElement | null>) {
  const [plays, setPlays] = useState<VfxPlay[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const lastTap = useRef(0);
  useEffect(() => {
    const held = timers.current;
    return () => held.forEach(clearTimeout);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  }, []);

  const play = useCallback(
    (vfx: Vfx, messageId?: string) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      let ox = w / 2;
      let oy = h * 0.45;
      if (messageId) {
        const at = Array.from(document.querySelectorAll<HTMLElement>('[data-vfx-msg]')).find(el => el.dataset.vfxMsg === messageId);
        const box = at?.getBoundingClientRect();
        if (box && box.width && box.bottom > 0 && box.top < h) {
          ox = box.left + box.width / 2;
          oy = box.top + box.height / 2;
        }
      }
      const key = nextKey++;
      // No more than three at once: a fourth takes the place of the oldest.
      setPlays(list => [...list.slice(-2), { key, vfx, ox, oy, w, h, seed: (Date.now() ^ (key * 7919)) | 0 }]);
      later(() => setPlays(list => list.filter(p => p.key !== key)), vfx.ms + 250);
      playSound(vfx.sound);
      haptic('confirm');
      const shake = SHAKES[vfx.id];
      const target = shakeTarget?.current;
      if (shake && target) {
        later(() => {
          target.dataset.vxShake = shake[0];
          later(() => {
            if (target.dataset.vxShake === shake[0]) delete target.dataset.vxShake;
          }, shake[2]);
        }, shake[1]);
      }
    },
    [later, shakeTarget]
  );

  /** A finger on one: it plays here, and their phone is told. */
  const tap = useCallback(
    (vfx: Vfx, messageId: string) => {
      const now = Date.now();
      if (now - lastTap.current < VFX_EVERY_MS) return;
      lastTap.current = now;
      play(vfx, messageId);
      sayVfx({ k: VFX.indexOf(vfx), m: messageId });
    },
    [play]
  );

  // Their finger on one, as it happens.
  useEffect(() => onVfx(said => play(VFX[said.k], said.m)), [play]);

  const stage =
    plays.length && typeof document !== 'undefined'
      ? createPortal(
          <div className="vx-stage" aria-hidden="true">
            {plays.map(p => (
              <VfxArt key={p.key} play={p} />
            ))}
          </div>,
          document.body
        )
      : null;

  return { stage, play, tap };
}
