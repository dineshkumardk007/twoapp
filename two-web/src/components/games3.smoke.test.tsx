import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BX_BLOCK, BX_HOOK, BX_JAB } from '../core/boxing';
import { encodeShot } from '../core/penalty';
import { PZ_FAIL } from '../core/puzzleDuel';
import { newGame, type PaperGame } from '../core/paperGames';
import type { Seat } from '../core/usTwo';
import { BoxingBoard } from './BoxingBoard';
import { PenaltyBoard } from './PenaltyBoard';
import { PuzzleBoard } from './PuzzleBoard';
import type { BoardProps } from './GameBoards';
import { GameIcon } from './PaperGames';

// Each board drawn once, as it stands at several points of a game: nothing
// here checks how it looks, only that it can be drawn at all.

const props = (game: PaperGame, me: Seat, canAct: boolean): BoardProps => ({
  game,
  me,
  inkOf: seat => (seat === 'user' ? '#0ea5e9' : '#f43f5e'),
  markOf: seat => (seat === 'user' ? 'x' : 'heart'),
  myLook: { ink: '#0ea5e9', mark: 'x' },
  canAct,
  seen: 0,
  onMove: () => {},
  partnerName: 'Priya',
  onSettled: () => {}
});
const withPicks = (kind: 'boxing' | 'penalty' | 'puzzle', user: number[], partner: number[]): PaperGame => ({ ...newGame(kind, undefined, 'user', `smoke-${kind}`, 1), picks: { user, partner } });

describe('the three new boards can be drawn', () => {
  it('Boxing: fresh, mid-fight, one pick in, and knocked out', () => {
    const jabs = Array(13).fill(BX_JAB);
    for (const g of [withPicks('boxing', [], []), withPicks('boxing', [BX_JAB, BX_HOOK], [BX_BLOCK, BX_JAB]), withPicks('boxing', [BX_JAB], []), withPicks('boxing', jabs, jabs)]) {
      for (const me of ['user', 'partner'] as Seat[]) {
        const html = renderToString(<BoxingBoard {...props(g, me, true)} />);
        expect(html).toContain('bx-stage');
        expect(html).toContain('Priya');
      }
    }
  });

  it('Penalty Shootout: to shoot, to keep goal, part way, and over', () => {
    const goal = encodeShot({ x: 60, y: 30, power: 20 });
    const miss = encodeShot({ x: 115, y: 30, power: 0 });
    for (const g of [
      withPicks('penalty', [], []),
      withPicks('penalty', [goal], []),
      withPicks('penalty', [goal, 0], [0, goal]),
      withPicks('penalty', [goal, 0, goal, 0, goal, 0], [0, miss, 0, miss, 0, miss])
    ]) {
      for (const me of ['user', 'partner'] as Seat[]) {
        const html = renderToString(<PenaltyBoard {...props(g, me, true)} />);
        expect(html).toContain('pk-scene');
      }
    }
    // The one to shoot gets the power bar; the one in goal, the six parts of it.
    expect(renderToString(<PenaltyBoard {...props(withPicks('penalty', [], []), 'user', true)} />)).toContain('pk-power');
    expect(renderToString(<PenaltyBoard {...props(withPicks('penalty', [], []), 'partner', true)} />)).toContain('pk-zones');
  });

  it('Puzzle Duel: ready, waiting, part way, and over', () => {
    for (const g of [
      withPicks('puzzle', [], []),
      withPicks('puzzle', [5000], []),
      withPicks('puzzle', [5000, PZ_FAIL], [6000, PZ_FAIL]),
      withPicks('puzzle', [1000, 1000, 1000, 1000], [2000, 2000, 2000, 2000])
    ]) {
      for (const me of ['user', 'partner'] as Seat[]) {
        const html = renderToString(<PuzzleBoard {...props(g, me, true)} />);
        expect(html).toContain('pz-stage');
      }
    }
  });

  it('each has its picture for the shelf', () => {
    for (const kind of ['boxing', 'penalty', 'puzzle'] as const) expect(renderToString(<GameIcon kind={kind} />)).toContain('g-icon');
  });
});
