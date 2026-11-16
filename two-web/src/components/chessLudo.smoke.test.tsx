import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KING, PAWN, QUEEN, chessMove } from '../core/chess';
import { ludoMove } from '../core/ludo';
import { newGame, type PaperGame } from '../core/paperGames';
import { ChessBoard, ChessIcon, PieceArt } from './ChessBoard';
import { LudoBoard, LudoIcon } from './LudoBoard';

// Drawn once each: nothing here checks how they look, only that they can be
// drawn, and that what should be in them is.

const props = (game: PaperGame, me: 'user' | 'partner' = 'user', canAct = true) => ({
  game,
  me,
  inkOf: (s: 'user' | 'partner') => (s === 'user' ? '#f59e0b' : '#f472b6'),
  markOf: () => 'heart' as const,
  myLook: { ink: '#f59e0b', mark: 'heart' as const },
  canAct,
  seen: 0,
  onMove: () => {},
  partnerName: 'Priya'
});

describe('Ludo can be drawn', () => {
  it('the board, both corners of tokens, and the die', () => {
    const classic = renderToString(<LudoBoard {...props(newGame('ludo', undefined, 'user', 'l1', 1, 4))} />);
    expect(classic.match(/class="lu-token"/g)?.length).toBe(8);
    expect(classic).toContain('g-die');
    expect(classic).toContain('Roll a 6 to bring a token out');
    expect(classic).not.toContain('NaN');
    const quick = renderToString(<LudoBoard {...props(newGame('ludo', undefined, 'user', 'l2', 1, 2), 'partner', false)} />);
    expect(quick.match(/class="lu-token"/g)?.length).toBe(4);
    expect(quick).toContain('data-turned');
    expect(renderToString(<LudoIcon />)).toContain('g-icon');
  });

  it('a token out on the board is drawn there', () => {
    const g = { ...newGame('ludo', undefined, 'user', 'l3', 1, 4), moves: [ludoMove(6, 0), ludoMove(4, 0)] };
    const html = renderToString(<LudoBoard {...props(g)} />);
    expect(html).not.toContain('NaN');
    // None home yet, of four.
    expect(html.replace(/<!-- -->/g, '')).toContain('0/4');
  });
});

describe('Chess can be drawn', () => {
  it('64 squares, 32 pieces, each side at the bottom of its own phone', () => {
    const g = newGame('chess', undefined, 'user', 'c1', 1);
    const mine = renderToString(<ChessBoard {...props(g)} />);
    expect(mine.match(/class="cs-sq"/g)?.length).toBe(64);
    expect(mine.match(/class="cs-piece"/g)?.length).toBe(32);
    expect(mine).toContain('Tap one of your pieces');
    expect(mine).not.toContain('NaN');
    const theirs = renderToString(<ChessBoard {...props(g, 'partner', false)} />);
    expect(theirs).toContain('Priya&#x27;s move');
    expect(theirs).not.toBe(mine);
  });

  it('every piece, in both teams; and a finished game offers its replay', () => {
    const seen = new Set<string>();
    for (const team of ['bear', 'bunny'] as const) for (let k = PAWN; k <= KING; k++) seen.add(renderToString(<PieceArt kind={k} team={team} />));
    expect(seen.size).toBe(12);
    const sq = (n: string) => n.charCodeAt(0) - 97 + (Number(n[1]) - 1) * 8;
    const mate = ['f2f3', 'e7e5', 'g2g4', 'd8h4'].map(m => chessMove(sq(m.slice(0, 2)), sq(m.slice(2))));
    const done = renderToString(<ChessBoard {...props({ ...newGame('chess', undefined, 'user', 'c2', 1), moves: mate })} />);
    expect(done).toContain('Checkmate - Priya wins');
    expect(done).toContain('Watch the replay');
    expect(done).toContain('data-check');
    expect(renderToString(<ChessIcon />)).toContain('g-icon');
    void QUEEN;
  });
});
