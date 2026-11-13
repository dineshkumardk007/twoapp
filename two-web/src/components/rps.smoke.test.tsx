import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultShelf, setGameShown } from '../core/gameShelf';
import type { PaperGame } from '../core/paperGames';
import { ArrangeGamesSheet } from './ArrangeGamesSheet';
import { RpsBoard, RpsIcon } from './RpsBoard';

// Drawn once each: nothing here checks how they look, only that they can be
// drawn, and that what should be in them is.

const game = (user: number[], partner: number[]): PaperGame =>
  ({ id: 'g1', kind: 'rps', size: 3, moves: [], picks: { user, partner }, firstSeat: 'user', startedAt: 1, updatedAt: 1 }) as unknown as PaperGame;

const props = (g: PaperGame, me: 'user' | 'partner' = 'user') => ({
  game: g,
  me,
  inkOf: () => '#f43f5e',
  markOf: () => 'heart' as const,
  myLook: { ink: '#f43f5e', mark: 'heart' as const },
  canAct: true,
  seen: 0,
  onMove: () => {},
  partnerName: 'Priya'
});

describe('Rock Paper Scissors can be drawn', () => {
  it('the bear and the bunny, the score, and three shapes to pick', () => {
    const html = renderToString(<RpsBoard {...props(game([], []))} />);
    expect(html.match(/class="rps-who"/g)?.length).toBe(2);
    expect(html.match(/class="rps-pick"/g)?.length).toBe(3);
    expect(html.match(/class="rig"/g)?.length).toBe(2);
    expect(html.match(/rps-arm/g)?.length).toBe(2);
    expect(html).toContain('Priya is choosing');
    expect(html).not.toContain('NaN');
    expect(renderToString(<RpsBoard {...props(game([], [1]), 'partner')} />)).toContain('Locked in');
  });

  it('a game played out shows the score as it ended, and the winner cheering', () => {
    const html = renderToString(<RpsBoard {...props(game([0, 1, 2], [2, 0, 1]))} />);
    expect(html.match(/<i data-on="true"/g)?.length).toBe(3);
    expect(html).toContain('data-cheer');
    expect(html).toContain('Game over');
    expect(renderToString(<RpsIcon />)).toContain('g-icon');
  });
});

describe('the games can be arranged', () => {
  it('every game this phone has, with a switch each, and the one for both phones', () => {
    const layout = setGameShown(defaultShelf(), 'dots', false, 4);
    const games = ['maze', 'rps', 'dots', 'ttt'];
    const html = renderToString(
      <ArrangeGamesSheet
        layout={layout}
        games={games}
        nameOf={id => id.toUpperCase()}
        iconOf={() => <i />}
        sync
        partnerName="Priya"
        onChange={() => {}}
        onSync={() => {}}
        onClose={() => {}}
      />
    );
    for (const id of games) expect(html).toContain(id.toUpperCase());
    expect(html).not.toContain('CARROM');
    // One switch for each game and one for both phones; the one switched off, off.
    expect(html.match(/role="switch"/g)?.length).toBe(games.length + 1);
    expect(html.match(/aria-checked="false"/g)?.length).toBe(1);
    expect(html).toContain('Same order on both phones');
    expect(html).toContain('Back to the usual order');
  });
});
