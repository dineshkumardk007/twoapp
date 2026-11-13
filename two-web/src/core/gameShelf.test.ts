import { beforeEach, describe, expect, it } from 'vitest';
import { DUO_GAMES } from './duo';
import {
  SHELF_GAMES,
  SHELF_RECORD,
  cleanShelf,
  defaultShelf,
  isDefaultShelf,
  laterShelf,
  moveGame,
  readMyShelf,
  setGameShown,
  shownShelf,
  writeMyShelf
} from './gameShelf';
import { PAPER_KINDS } from './paperGames';
import { TA } from './i18n.ta';

describe('the order of the games', () => {
  beforeEach(() => localStorage.clear());

  it('has every game once, Rock Paper Scissors and not Heart Hug Kiss', () => {
    expect(SHELF_RECORD).toBe('GAME_SHELF');
    expect(new Set(SHELF_GAMES).size).toBe(SHELF_GAMES.length);
    expect(SHELF_GAMES).toEqual(['homes', 'maze', ...DUO_GAMES, ...PAPER_KINDS]);
    expect(SHELF_GAMES).toContain('rps');
    expect(SHELF_GAMES).not.toContain('hhk');
    expect(isDefaultShelf(defaultShelf())).toBe(true);
  });

  it('moves a game up or down, and not past either end; switches games off and on', () => {
    const start = defaultShelf();
    const down = moveGame(start, 'homes', 1, 5);
    expect(down.order.slice(0, 2)).toEqual(['maze', 'homes']);
    expect(down.at).toBe(5);
    expect(moveGame(start, 'homes', -1, 5)).toBe(start);
    expect(moveGame(start, SHELF_GAMES[SHELF_GAMES.length - 1], 1, 5)).toBe(start);
    const off = setGameShown(start, 'snakes', false, 6);
    expect(off.hidden).toEqual(['snakes']);
    expect(isDefaultShelf(off)).toBe(false);
    expect(setGameShown(off, 'snakes', true, 7).hidden).toEqual([]);
  });

  it('takes from the other phone only games there are, and puts any it never knew where they go', () => {
    const layout = cleanShelf({ order: ['carrom', 'hhk', 'nonsense', 'carrom', 7, 'maze'], hidden: ['ttt', 'hhk'], at: 12 })!;
    expect(layout.order.length).toBe(SHELF_GAMES.length);
    expect(new Set(layout.order).size).toBe(SHELF_GAMES.length);
    // Cosy Homes, never mentioned and first by default, goes in first; the two sent keep their order;
    // and Four in a Row, never mentioned, goes in just after Carrom, which it follows by default.
    expect(layout.order.slice(0, 3)).toEqual(['homes', 'carrom', 'four']);
    expect(layout.order.indexOf('carrom')).toBeLessThan(layout.order.indexOf('maze'));
    expect(layout.hidden).toEqual(['ttt']);
    expect(layout.at).toBe(12);
    expect(cleanShelf('shelf')).toBeNull();
    expect(cleanShelf({})!.order).toEqual([...SHELF_GAMES]);
  });

  it('believes the later of two arrangements', () => {
    const a = { ...defaultShelf(), at: 5 };
    const b = moveGame(defaultShelf(), 'homes', 1, 9);
    expect(laterShelf(a, b)).toBe(b);
    expect(laterShelf(b, a)).toBe(b);
    expect(laterShelf(undefined, a)).toBe(a);
    expect(laterShelf(a, undefined)).toBe(a);
  });

  it('kept in step, shows the later of its own and the shared; on its own, only its own', () => {
    const mine = moveGame(defaultShelf(), 'homes', 1, 5);
    const theirs = setGameShown(defaultShelf(), 'dots', false, 9);
    expect(shownShelf({ layout: mine, sync: true }, theirs)).toBe(theirs);
    expect(shownShelf({ layout: mine, sync: true }, { ...theirs, at: 2 })).toBe(mine);
    expect(shownShelf({ layout: mine, sync: false }, theirs)).toBe(mine);
    expect(shownShelf({ layout: mine, sync: true }, undefined)).toBe(mine);
  });

  it('this phone remembers its own, and is kept in step unless switched off', () => {
    expect(readMyShelf()).toEqual({ layout: defaultShelf(), sync: true });
    const layout = setGameShown(defaultShelf(), 'four', false, 3);
    writeMyShelf({ layout, sync: false });
    expect(readMyShelf()).toEqual({ layout, sync: false });
    localStorage.setItem('two_game_shelf_v1', 'not json');
    expect(readMyShelf()).toEqual({ layout: defaultShelf(), sync: true });
  });

  it('the words for it are in Tamil too', () => {
    for (const words of ['Arrange the games', 'Same order on both phones', 'What either of you changes here changes on both phones.', 'Rock Paper Scissors', 'Rock', 'Paper', 'Scissors', 'Shoot!']) {
      expect(TA[words], words).toBeTruthy();
    }
  });
});
