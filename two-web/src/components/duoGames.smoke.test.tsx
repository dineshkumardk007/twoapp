import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BOMB_SIGN_COUNT, bombOf, cutWire, newRun } from '../core/bombSquad';
import { dropsOf, landsAt } from '../core/catchTogether';
import { lampOf, lit } from '../core/lampMaze';
import { BombBody, BombBook, BombIcon, BombSignFace } from './BombSquad';
import { CatchField, CatchIcon } from './CatchTogether';
import { LampBoard, LampIcon } from './LampMaze';

// The three games for two at once, drawn once each: nothing here checks how
// they look, only that they can be drawn, and that what should be in them is.

describe('Bomb Squad can be drawn', () => {
  it('the bomb: its label, its clock, every wire and every button', () => {
    for (const level of [1, 7, 12, 30]) {
      const bomb = bombOf(level);
      const idle = renderToString(<BombBody bomb={bomb} run={null} left={bomb.seconds} wrong={null} />);
      expect(idle.match(/class="bm-wire"/g)?.length).toBe(bomb.wires.length);
      expect((idle.match(/class="bm-key"/g) ?? []).length).toBe(bomb.pad.length);
      expect(idle).not.toContain('NaN');
      const run = cutWire(newRun(bomb, 1), bomb, bomb.cuts[0]).run;
      const live = renderToString(<BombBody bomb={bomb} run={run} left={12} wrong="w0" onCut={() => {}} onPress={() => {}} />);
      expect(live).toContain('data-cut');
      expect(live).toContain('data-low');
      expect(live).toContain('0:12');
    }
  });

  it('the book: a page for every kind of bomb, and the one picked marked', () => {
    const bomb = bombOf(12);
    const html = renderToString(<BombBook pages={bomb.pages} picked={2} onPick={() => {}} />);
    expect(html.match(/class="bm-page"/g)?.length).toBe(bomb.pages.length);
    expect(html.match(/data-picked/g)?.length).toBe(1);
  });

  it('every sign, and its picture', () => {
    const seen = new Set<string>();
    for (let i = 0; i < BOMB_SIGN_COUNT; i++) seen.add(renderToString(<BombSignFace index={i} />));
    expect(seen.size).toBe(BOMB_SIGN_COUNT);
    expect(renderToString(<BombSignFace index={99} />)).toBe('');
    expect(renderToString(<BombIcon />)).toContain('g-icon');
  });
});

describe('Catch Together can be drawn', () => {
  it('a moment of a round: what is falling, the net, and both hands', () => {
    const drops = dropsOf(77);
    const t = landsAt(drops[3]) + 0.1;
    const html = renderToString(<CatchField drops={drops} t={t} outcomes={new Map([[drops[3].id, 1]])} hands={[0.3, 0.7]} />);
    expect(html).toContain('ct-net-rope');
    expect(html.match(/class="ct-hand"/g)?.length).toBe(2);
    expect(html).toContain('data-caught');
    expect(html).not.toContain('NaN');
    // Nothing falls before the round has begun, or long after it has landed.
    expect(renderToString(<CatchField drops={drops} t={0} outcomes={new Map()} hands={[0.3, 0.7]} />)).not.toContain('ct-drop');
    expect(renderToString(<CatchIcon />)).toContain('g-icon');
  });
});

describe('Light and Shadow can be drawn', () => {
  it('only what the light falls on, the gates, the keys and the two of you', () => {
    for (const level of [1, 8, 30, 70]) {
      const maze = lampOf(level);
      const seen = new Set<number>();
      for (let cell = 0; cell < maze.w * maze.h; cell++) if (lit(maze, cell, maze.start)) seen.add(cell);
      const html = renderToString(<LampBoard maze={maze} lamp={maze.start} shadow={maze.start} keys={0} seen={seen} carrier="user" locked={null} stuck={null} />);
      expect(html.match(/class="lm-tile"/g)?.length).toBe(seen.size);
      expect(html).toContain('lm-exit');
      expect(html.match(/data-part=/g)?.length).toBe(2);
      expect(html).not.toContain('NaN');
      // Everything seen, every gate and key is drawn; a key picked up is gone.
      const all = new Set(Array.from({ length: maze.w * maze.h }, (_, i) => i));
      const whole = renderToString(<LampBoard maze={maze} lamp={maze.start} shadow={maze.start} keys={0} seen={all} carrier="partner" locked={0} stuck="lamp" />);
      expect(whole.match(/class="lm-gate"/g)?.length).toBe(maze.gates.length);
      expect(whole.match(/class="lm-key"/g)?.length).toBe(maze.gates.length);
      const got = renderToString(<LampBoard maze={maze} lamp={maze.start} shadow={maze.start} keys={1} seen={all} carrier="partner" locked={null} stuck={null} />);
      expect((got.match(/class="lm-key"/g) ?? []).length).toBe(maze.gates.length - 1);
      expect(got).toContain('data-open');
    }
    expect(renderToString(<LampIcon />)).toContain('g-icon');
  });
});
