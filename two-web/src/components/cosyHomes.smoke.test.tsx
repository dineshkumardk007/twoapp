import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CROSS, FRIEND, emptyBoard, levelPuzzle, freePuzzle, setCell, type HomesBook } from '../core/cosyHomes';
import { chooseLocale } from '../core/i18n';
import { HomesBoard, HomesIcon, HomesLevels } from './CosyHomes';

// Each screen of Cosy Homes drawn once, as it stands at several points:
// nothing here checks how it looks, only that it can be drawn at all, and
// that what should be on it is.

const nothing = () => {};

describe('the levels of Cosy Homes can be drawn', () => {
  const levels = (mine?: HomesBook, theirs?: HomesBook) =>
    renderToString(<HomesLevels mine={mine} theirs={theirs} partnerName="Priya" me="user" onPlay={nothing} onFree={nothing} onRules={nothing} onBack={nothing} />);

  it('before anything has been played', () => {
    const html = levels();
    expect(html).toContain('Cosy Homes');
    expect(html).toContain('Level 1');
    expect(html).toContain('Priya has not played yet');
    expect(html).toContain('Free play');
    // The five sizes, and the first size open with its sixty levels.
    for (const n of [5, 6, 7, 8, 9]) expect(html).toContain(`${n}×${n}`);
    expect(html.match(/class="ch-tile"/g)?.length).toBe(60);
    // Only level 1 can be played.
    expect(html.match(/data-state="open"/g)?.length).toBe(1);
    expect(html.match(/data-state="locked"/g)?.length).toBe(59);
  });

  it('part way through, with the other one further on', () => {
    const html = levels({ stars: '3'.repeat(72), at: 1 }, { stars: '2'.repeat(140), at: 1 });
    expect(html).toContain('Level 73');
    expect(html).toContain('Priya is on level 141');
    // The size you are on is the one open: 6 by 6, levels 61 to 200.
    expect(html.match(/class="ch-tile"/g)?.length).toBe(140);
    expect(html.match(/data-state="done"/g)?.length).toBe(12);
    expect(html.match(/data-state="open"/g)?.length).toBe(1);
    expect(html.match(/data-here=/g)?.length).toBe(1);
  });

  it('with every level done, by both', () => {
    const all = { stars: '3'.repeat(1000), at: 1 };
    const html = levels(all, all);
    expect(html).toContain('Every level done!');
    expect(html).toContain('Priya has finished every level');
    expect(html).toContain('3000');
    expect(html.match(/class="ch-tile"/g)?.length).toBe(300);
    expect(html).not.toContain('data-state="locked"');
  });

  it('in Tamil', () => {
    chooseLocale('ta');
    try {
      const html = levels({ stars: '31', at: 1 });
      expect(html).toContain('இனிய வீடுகள்');
      expect(html).toContain('நிலை 3');
    } finally {
      chooseLocale('en');
    }
  });
});

describe('a board of Cosy Homes can be drawn', () => {
  const board = (level: number | undefined, n: number, cells?: string, hints = 0) => {
    const puzzle = level ? levelPuzzle(level) : freePuzzle(n, 99);
    return renderToString(
      <HomesBoard
        puzzle={puzzle}
        slot={level ? `l${level}` : `f${n}`}
        title={level ? `Level ${level}` : 'Free play'}
        me="partner"
        level={level}
        seed={level ? undefined : 99}
        best={0}
        start={cells ? { cells, ms: 65_000, hints, at: 1 } : null}
        paused={false}
        onSolved={nothing}
        onLeave={nothing}
        onNext={nothing}
        onRules={nothing}
      />
    );
  };

  it('every size, empty: as many squares as it should have, a home colour on each', () => {
    for (const [level, n] of [
      [1, 5],
      [61, 6],
      [201, 7],
      [421, 8],
      [701, 9]
    ]) {
      const html = board(level, n);
      expect(html.match(/class="ch-cell"/g)?.length).toBe(n * n);
      for (let h = 0; h < n; h++) expect(html).toContain(`data-h="${h}"`);
      expect(html).toContain(`0/${n}`);
      expect(html).toContain('0:00');
      expect(html).not.toContain('ch-friend');
      // The arrows for a move back and a move forward are there, with nothing yet to go back to.
      expect(html).toContain('Back a move');
      expect(html).toContain('Forward a move');
    }
  });

  it('part way through: the crosses and friends that were left, the clock where it was', () => {
    const p = levelPuzzle(61);
    const right = p.answer[0];
    let cells = setCell(emptyBoard(6), right, FRIEND);
    cells = setCell(cells, 6 + ((right + 3) % 6), CROSS);
    const html = board(61, 6, cells, 2);
    expect(html.match(/class="ch-friend"/g)?.length).toBe(1);
    expect(html.match(/class="ch-x"/g)?.length).toBe(1);
    expect(html).toContain('1/6');
    expect(html).toContain('1:05');
    expect(html).not.toContain('data-bad');
  });

  it('two friends that break a rule are both marked', () => {
    const cells = setCell(setCell(emptyBoard(5), 0, FRIEND), 1, FRIEND);
    const html = board(1, 5, cells);
    expect(html.match(/data-bad="true"/g)?.length).toBe(2);
  });

  it('Free play: no clock, and another board on offer', () => {
    const html = board(undefined, 7);
    expect(html.match(/class="ch-cell"/g)?.length).toBe(49);
    expect(html).not.toContain('ch-clock');
    expect(html).toContain('Another board');
  });

  it('the picture for its card', () => {
    expect(renderToString(<HomesIcon />)).toContain('g-icon');
  });
});
