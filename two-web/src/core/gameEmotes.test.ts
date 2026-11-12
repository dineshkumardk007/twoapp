import { beforeEach, describe, expect, it } from 'vitest';
import {
  CAN_EMOTE,
  EMOTES,
  GAME_SAY_SIGNAL,
  HERE_EVERY_MS,
  HERE_FOR_MS,
  cleanSaid,
  emotesMuted,
  forgetEmotesForTest,
  hearGameSaid,
  isGameRoom,
  leaveRoom,
  muteEmotes,
  onGameSaid,
  roomOnScreen,
  sayInGame,
  setSaySender,
  showRoom,
  theyAreHere,
  type GameSaid
} from './gameEmotes';
import { TA } from './i18n.ta';
import { PAPER_KINDS } from './paperGames';

beforeEach(() => forgetEmotesForTest());

/** The emote sounds there are files for, by name. */
const SOUND_FILES = Object.keys(import.meta.glob('../assets/sounds/e-*.mp3')).map(path => path.replace(/^.*\/([^/]+)\.mp3$/, '$1'));

describe('the emotes', () => {
  it('ten of them, each with a name, a plain emoji and a sound of its own that is there to be played', () => {
    expect(EMOTES.length).toBe(10);
    expect(new Set(EMOTES.map(e => e.id)).size).toBe(10);
    expect(new Set(EMOTES.map(e => e.sound)).size).toBe(10);
    expect(new Set(EMOTES.map(e => e.emoji)).size).toBe(10);
    for (const emote of EMOTES) {
      expect(emote.sound.startsWith('e-')).toBe(true);
      expect(SOUND_FILES, emote.sound).toContain(emote.sound);
      expect(TA[emote.name], emote.name).toBeTruthy();
    }
    // The eight asked for, in the order they are sent by, and the two extra teases after them.
    expect(EMOTES.map(e => e.id)).toEqual(['laugh', 'cry', 'angry', 'thumb', 'kiss', 'shock', 'tease', 'yawn', 'cool', 'evil']);
    expect(CAN_EMOTE).toBe('emotes-1');
    expect(GAME_SAY_SIGNAL).toBe('GAME_SAY');
  });

  it('every game for two has them: each is somewhere the two of you can both be', () => {
    for (const kind of PAPER_KINDS) expect(isGameRoom(kind)).toBe(true);
    expect(isGameRoom('maze')).toBe(true);
    // Cosy Homes is played alone.
    expect(isGameRoom('homes')).toBe(false);
    expect(isGameRoom('draw')).toBe(false);
    expect(isGameRoom(7)).toBe(false);
  });
});

describe('what a phone says', () => {
  it('only what a game could have said is taken', () => {
    expect(cleanSaid({ k: 'carrom', e: 3 })).toEqual({ k: 'carrom', e: 3 });
    expect(cleanSaid({ k: 'maze', h: 1 })).toEqual({ k: 'maze', h: 1 });
    expect(cleanSaid({ k: 'ttt', h: 0 })).toEqual({ k: 'ttt', h: 0 });
    expect(cleanSaid({ k: 'ttt', e: 0, h: 1, junk: 'x' })).toEqual({ k: 'ttt', e: 0, h: 1 });
    expect(cleanSaid({ k: 'ludo', e: 1 })).toBeNull();
    expect(cleanSaid({ k: 'carrom', e: 10 })).toBeNull();
    expect(cleanSaid({ k: 'carrom', e: -1 })).toBeNull();
    expect(cleanSaid({ k: 'carrom', e: 1.5 })).toBeNull();
    expect(cleanSaid({ k: 'carrom', h: 2 })).toBeNull();
    expect(cleanSaid({ k: 'carrom' })).toBeNull();
    expect(cleanSaid(null)).toBeNull();
    expect(cleanSaid('😂')).toBeNull();
  });

  it('goes out by the way App gives it, and is dropped when there is none', () => {
    const sent: GameSaid[] = [];
    sayInGame({ k: 'four', e: 1 });
    setSaySender(said => sent.push(said));
    sayInGame({ k: 'four', e: 2 });
    sayInGame({ k: 'four', h: 1 });
    expect(sent).toEqual([{ k: 'four', e: 2 }, { k: 'four', h: 1 }]);
    setSaySender(() => {
      throw new Error('not connected');
    });
    expect(() => sayInGame({ k: 'four', h: 0 })).not.toThrow();
  });
});

describe('the game on this screen', () => {
  it('hears their emotes, and gets no pop-up about what it is already looking at', () => {
    const heard: GameSaid[] = [];
    onGameSaid(said => heard.push(said));
    showRoom('carrom');
    expect(roomOnScreen()).toBe('carrom');
    expect(hearGameSaid({ k: 'carrom', e: 4 }, 1000)).toBeNull();
    expect(hearGameSaid({ k: 'carrom', h: 1 }, 1100)).toBeNull();
    expect(heard).toEqual([{ k: 'carrom', e: 4 }, { k: 'carrom', h: 1 }]);
    // Rubbish reaches nobody.
    expect(hearGameSaid({ k: 'carrom', e: 99 }, 1200)).toBeNull();
    expect(heard.length).toBe(2);
  });

  it('one game leaving the screen does not clear another that has since opened', () => {
    showRoom('carrom');
    showRoom('maze');
    leaveRoom('carrom');
    expect(roomOnScreen()).toBe('maze');
    leaveRoom('maze');
    expect(roomOnScreen()).toBeNull();
  });
});

describe('whether they are on the game too', () => {
  it('here once they say so, for a little longer than they take to say it again, and gone when they say so', () => {
    const t = 1_000_000;
    expect(theyAreHere('ttt', t)).toBe(false);
    hearGameSaid({ k: 'ttt', h: 1 }, t);
    expect(theyAreHere('ttt', t)).toBe(true);
    // Not on any other game.
    expect(theyAreHere('four', t)).toBe(false);
    // One beat missed is forgiven; silence is not.
    expect(HERE_FOR_MS).toBeGreaterThan(HERE_EVERY_MS * 2);
    expect(theyAreHere('ttt', t + HERE_EVERY_MS * 2)).toBe(true);
    expect(theyAreHere('ttt', t + HERE_FOR_MS + 1)).toBe(false);
    hearGameSaid({ k: 'ttt', h: 1 }, t + 30_000);
    hearGameSaid({ k: 'ttt', h: 0 }, t + 31_000);
    expect(theyAreHere('ttt', t + 31_001)).toBe(false);
    // An emote from a game is them being there.
    hearGameSaid({ k: 'ttt', e: 0 }, t + 40_000);
    expect(theyAreHere('ttt', t + 40_001)).toBe(true);
  });
});

describe('the pop-up when this phone is somewhere else', () => {
  const t = 5_000_000;

  it('an emote: which one, and which game to open', () => {
    const pop = hearGameSaid({ k: 'boxing', e: 2 }, t);
    expect(pop).toEqual({ room: 'boxing', kind: 'emote', emote: EMOTES[2] });
    // On another game counts as somewhere else too.
    showRoom('carrom');
    expect(hearGameSaid({ k: 'boxing', e: 0 }, t + 10_000)).toMatchObject({ room: 'boxing', kind: 'emote' });
  });

  it('a burst of emotes is one pop-up, not one each', () => {
    expect(hearGameSaid({ k: 'ttt', e: 0 }, t)).not.toBeNull();
    expect(hearGameSaid({ k: 'ttt', e: 1 }, t + 600)).toBeNull();
    expect(hearGameSaid({ k: 'ttt', e: 2 }, t + 1200)).toBeNull();
    expect(hearGameSaid({ k: 'ttt', e: 3 }, t + 3100)).not.toBeNull();
  });

  it('none for emotes that are turned off, though it still knows they are there', () => {
    expect(emotesMuted()).toBe(false);
    muteEmotes(true);
    expect(emotesMuted()).toBe(true);
    expect(hearGameSaid({ k: 'ttt', e: 0 }, t)).toBeNull();
    expect(theyAreHere('ttt', t)).toBe(true);
    // Kept on this phone.
    forgetEmotesForTest();
    expect(emotesMuted()).toBe(true);
    muteEmotes(false);
    forgetEmotesForTest();
    expect(emotesMuted()).toBe(false);
  });

  it('they have just started on a game: said once as they come in, not on every beat after', () => {
    expect(hearGameSaid({ k: 'carrom', h: 1 }, t)).toEqual({ room: 'carrom', kind: 'playing' });
    for (let i = 1; i <= 10; i++) expect(hearGameSaid({ k: 'carrom', h: 1 }, t + i * HERE_EVERY_MS)).toBeNull();
    // Another game is its own news.
    expect(hearGameSaid({ k: 'maze', h: 1 }, t + 1000)).toEqual({ room: 'maze', kind: 'playing' });
  });

  it('leaving says nothing; coming back says it again, but not within a couple of minutes', () => {
    expect(hearGameSaid({ k: 'four', h: 1 }, t)).not.toBeNull();
    expect(hearGameSaid({ k: 'four', h: 0 }, t + 5000)).toBeNull();
    // Straight back in: they were only away a moment.
    expect(hearGameSaid({ k: 'four', h: 1 }, t + 40_000)).toBeNull();
    expect(hearGameSaid({ k: 'four', h: 0 }, t + 45_000)).toBeNull();
    // Later on, it is news again.
    expect(hearGameSaid({ k: 'four', h: 1 }, t + 200_000)).toEqual({ room: 'four', kind: 'playing' });
  });

  it('none of it while this phone is on that game', () => {
    showRoom('four');
    expect(hearGameSaid({ k: 'four', h: 1 }, t)).toBeNull();
    expect(hearGameSaid({ k: 'four', e: 5 }, t + 1)).toBeNull();
  });
});
