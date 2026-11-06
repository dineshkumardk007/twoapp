import { describe, expect, it } from 'vitest';
import {
  askRestart,
  askedOf,
  cancelRestart,
  cleanGame,
  declineRestart,
  mergeGame,
  newGame,
  openAsk,
  progressOf,
  refusedOf,
  standing,
  withLook,
  withMove,
  type PaperGame
} from './paperGames';

// Starting over in the middle of a game takes both of you (core/paperGames).

/** Three moves into a game of Tic-tac-toe. */
const midGame = (): PaperGame => {
  let g = newGame('ttt', undefined, 'user', 'game-1', 1000);
  for (const m of [0, 4, 8]) g = withMove(g, m);
  return g;
};

describe('asking for a new game', () => {
  it('a game starts with nothing asked', () => {
    const g = midGame();
    expect(g.ask).toBeUndefined();
    expect(openAsk(g)).toBeNull();
    expect(askedOf(g, 'user')).toBe(false);
    expect(refusedOf(g, 'user')).toBe(false);
  });

  it('asking changes nothing about the game itself', () => {
    const g = midGame();
    const asked = askRestart(g, 'user', 2000);
    expect(asked.id).toBe(g.id);
    expect(asked.moves).toEqual(g.moves);
    expect(standing(asked)).toEqual(standing(g));
  });

  it('it is the other one who is asked', () => {
    const asked = askRestart(midGame(), 'user', 2000);
    expect(openAsk(asked)?.by).toBe('user');
    expect(askedOf(asked, 'partner')).toBe(true);
    expect(askedOf(asked, 'user')).toBe(false);
  });

  it('play carries on while the question waits', () => {
    const asked = askRestart(midGame(), 'user', 2000);
    const moved = withMove(asked, 1);
    expect(moved.moves).toEqual([0, 4, 8, 1]);
    expect(askedOf(moved, 'partner')).toBe(true);
  });

  it('a game that ends takes the question with it', () => {
    let g = newGame('ttt', undefined, 'user', 'game-1', 1000);
    for (const m of [0, 3, 1, 4]) g = withMove(g, m);
    const asked = askRestart(g, 'partner', 2000);
    expect(openAsk(asked)).not.toBeNull();
    const won = withMove(asked, 2); // The user completes the top row.
    expect(standing(won).over).toBe(true);
    expect(openAsk(won)).toBeNull();
    expect(askedOf(won, 'user')).toBe(false);
  });

  it('taking it back closes it, and says nothing to anyone', () => {
    const g = cancelRestart(askRestart(midGame(), 'user', 2000), 3000);
    expect(openAsk(g)).toBeNull();
    expect(g.ask?.by).toBe('user');
    expect(refusedOf(g, 'user')).toBe(false);
    expect(refusedOf(g, 'partner')).toBe(false);
  });

  it('a no closes it, and the one who asked is told', () => {
    const g = declineRestart(askRestart(midGame(), 'user', 2000), 3000);
    expect(openAsk(g)).toBeNull();
    expect(refusedOf(g, 'user')).toBe(true);
    expect(refusedOf(g, 'partner')).toBe(false);
  });

  it('the no is forgotten at the next move', () => {
    const g = declineRestart(askRestart(midGame(), 'user', 2000), 3000);
    expect(refusedOf(withMove(g, 1), 'user')).toBe(false);
  });

  it('you can ask again after a no', () => {
    const g = askRestart(declineRestart(askRestart(midGame(), 'user', 2000), 3000), 'user', 4000);
    expect(askedOf(g, 'partner')).toBe(true);
    expect(refusedOf(g, 'user')).toBe(false);
  });

  it('each step comes after the last, even with a clock running behind', () => {
    const asked = askRestart(midGame(), 'user', 5000);
    const no = declineRestart(asked, 1000); // Their clock is well behind.
    expect(no.ask!.at).toBeGreaterThan(asked.ask!.at);
    expect(mergeGame(asked, no).ask?.open).toBe(false);
    const cancelled = cancelRestart(asked, 1000);
    expect(cancelled.ask!.at).toBeGreaterThan(asked.ask!.at);
    const again = askRestart(no, 'partner', 1000);
    expect(again.ask!.at).toBeGreaterThan(no.ask!.at);
  });

  it('progress counts moves, and both of your picks', () => {
    expect(progressOf(midGame())).toBe(3);
    const hhk = newGame('hhk', undefined, 'user', 'h', 1);
    expect(progressOf(withMove(withMove(hhk, 0, 'user'), 1, 'partner'))).toBe(2);
    expect(progressOf(undefined)).toBe(0);
  });
});

describe('saying yes', () => {
  it('starts a fresh game with nothing asked, the other one going first, and the score kept', () => {
    const asked = askRestart(midGame(), 'user', 2000);
    const fresh = newGame('ttt', asked, 'partner', 'game-2', 3000, asked.size);
    expect(fresh.id).toBe('game-2');
    expect(fresh.moves).toEqual([]);
    expect(fresh.ask).toBeUndefined();
    expect(fresh.first).toBe('partner');
    expect(fresh.before).toEqual(asked.before);
  });

  it('wins over the old game on both phones, however the clocks disagree', () => {
    const asked = askRestart(midGame(), 'user', 2000);
    // The phone saying yes has a clock far behind the phone that started the old game.
    const fresh = newGame('ttt', asked, 'partner', 'game-2', 10, asked.size);
    expect(fresh.startedAt).toBeGreaterThan(asked.startedAt);
    expect(mergeGame(asked, fresh).id).toBe('game-2');
    expect(mergeGame(fresh, asked).id).toBe('game-2');
    expect(mergeGame(asked, fresh).ask).toBeUndefined();
    expect(mergeGame(fresh, asked).ask).toBeUndefined();
  });

  it('an old question arriving late cannot touch the new game', () => {
    const asked = askRestart(midGame(), 'user', 2000);
    const fresh = newGame('ttt', asked, 'partner', 'game-2', 3000, asked.size);
    expect(mergeGame(fresh, asked)).toBe(fresh);
  });

  it('keeps the same board size', () => {
    let g = newGame('dots', undefined, 'user', 'd1', 1, 5);
    g = withMove(g, 0);
    const fresh = newGame('dots', askRestart(g, 'user', 2), 'partner', 'd2', 3, g.size);
    expect(fresh.size).toBe(5);
  });
});

describe('between the two phones', () => {
  it('the question reaches the other phone', () => {
    const g = midGame();
    const merged = mergeGame(g, askRestart(g, 'user', 2000));
    expect(askedOf(merged, 'partner')).toBe(true);
  });

  it('an answer overrides the question, whichever arrives first', () => {
    const asked = askRestart(midGame(), 'user', 2000);
    const no = declineRestart(asked, 3000);
    expect(mergeGame(asked, no).ask).toEqual(no.ask);
    expect(mergeGame(no, asked).ask).toEqual(no.ask);
  });

  it('a question and a move made at the same moment both survive', () => {
    const g = midGame();
    const asked = askRestart(g, 'user', 2000); // On one phone.
    const moved = withMove(g, 1); // On the other.
    for (const merged of [mergeGame(asked, moved), mergeGame(moved, asked)]) {
      expect(merged.moves).toEqual([0, 4, 8, 1]);
      expect(askedOf(merged, 'partner')).toBe(true);
    }
  });

  it('asking at the very same moment: both phones settle on the same question', () => {
    const g = midGame();
    const one = askRestart(g, 'user', 2000);
    const two = askRestart(g, 'partner', 2000);
    expect(mergeGame(one, two).ask).toEqual(mergeGame(two, one).ask);
    expect(openAsk(mergeGame(one, two))).not.toBeNull();
  });

  it('nothing new: nothing changes, so nothing redraws', () => {
    const asked = askRestart(midGame(), 'user', 2000);
    expect(mergeGame(asked, { ...asked, ask: { ...asked.ask! } })).toBe(asked);
    expect(mergeGame(asked, midGame())).toBe(asked);
  });

  it('a new look does not disturb the question', () => {
    const asked = askRestart(midGame(), 'user', 2000);
    const looked = withLook(asked, 'partner', { ink: '#10b981' }, 3000);
    expect(askedOf(mergeGame(asked, looked), 'partner')).toBe(true);
  });

  it('survives being saved and sent', () => {
    const no = declineRestart(askRestart(midGame(), 'user', 2000), 3000);
    const back = cleanGame(JSON.parse(JSON.stringify(no)), 'ttt')!;
    expect(back.ask).toEqual(no.ask);
    expect(refusedOf(back, 'user')).toBe(true);
  });

  it('survives in the game where you both choose at once', () => {
    let g = newGame('hhk', undefined, 'user', 'h', 1);
    g = withMove(g, 0, 'user');
    const asked = askRestart(g, 'partner', 5);
    const back = cleanGame(JSON.parse(JSON.stringify(asked)), 'hhk')!;
    expect(askedOf(back, 'user')).toBe(true);
    expect(back.picks).toEqual(asked.picks);
  });

  it('anything malformed is dropped, and the game kept', () => {
    const good = midGame();
    for (const ask of ['yes', 7, { by: 'nobody', at: 1, open: true }, { by: 'user', open: true }, { by: 'user', at: 'soon', open: true }]) {
      const back = cleanGame(JSON.parse(JSON.stringify({ ...good, ask })), 'ttt')!;
      expect(back.ask).toBeUndefined();
      expect(back.moves).toEqual(good.moves);
    }
  });

  it('"open" must truly be true, and a no cannot also be open', () => {
    const good = midGame();
    const weird = cleanGame(JSON.parse(JSON.stringify({ ...good, ask: { by: 'user', at: 2, open: 'yes' } })), 'ttt')!;
    expect(weird.ask?.open).toBe(false);
    const both = cleanGame(JSON.parse(JSON.stringify({ ...good, ask: { by: 'user', at: 2, open: true, no: true } })), 'ttt')!;
    expect(both.ask?.open).toBe(true);
    expect(both.ask?.no).toBeUndefined();
  });
});
