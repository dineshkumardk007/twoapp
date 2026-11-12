import { beforeEach, describe, expect, it } from 'vitest';
import { snippetOf } from './chatActions';
import { TA } from './i18n.ta';
import { RUB_ENOUGH, RubGrid, SECRET_WORDS, forgetSecretsForTest, isSecret, openSecret, secretOpened, wrappedSecret as wrapped } from './secretMessage';
import { GLASSES, HATS, NECKS, WEAR_NAMES, WEAR_RECORD, WEAR_SLOTS, bare, cleanWear, latestWear, showWear, wearOf, withWear } from './wear';
import type { ChatMessage } from '../types';

describe('a secret message', () => {
  beforeEach(() => forgetSecretsForTest());
  const words = (extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: 'm1', authorId: 'partner', authorName: 'Partner', text: 'I love you', timestamp: '', ...extra });

  it('is only ever plain words', () => {
    expect(isSecret(words({ secret: true }))).toBe(true);
    expect(isSecret(words())).toBe(false);
    expect(isSecret(words({ secret: true, unsent: true }))).toBe(false);
    expect(isSecret(words({ secret: true, isPhoto: true }))).toBe(false);
    expect(isSecret(words({ secret: true, isVoiceMemo: true }))).toBe(false);
    expect(isSecret(words({ secret: true, sticker: 'hug' }))).toBe(false);
  });

  it('never shows its words in the quote above an answer to it', () => {
    expect(snippetOf(words({ secret: true }))).toBe(SECRET_WORDS);
    expect(snippetOf(words())).toBe('I love you');
    expect(TA[SECRET_WORDS]).toBeTruthy();
  });

  it('stays open on this phone once rubbed open, each one on its own', () => {
    expect(secretOpened('a')).toBe(false);
    openSecret('a');
    expect(secretOpened('a')).toBe(true);
    expect(secretOpened('b')).toBe(false);
    forgetSecretsForTest(); // Two closed and opened again.
    expect(secretOpened('a')).toBe(true);
    openSecret('a');
    expect(JSON.parse(localStorage.getItem('two_secrets_open')!)).toEqual(['a']);
    // Something else under its name does no harm.
    localStorage.setItem('two_secrets_open', '{broken');
    expect(secretOpened('zzz')).toBe(false);
  });

  it('the foil counts what has been rubbed, and a little over half is enough', () => {
    const grid = new RubGrid(20, 5);
    expect(grid.share).toBe(0);
    grid.rub(0.5, 0.5, 0.05);
    const one = grid.share;
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThan(RUB_ENOUGH);
    // The same spot again adds nothing.
    grid.rub(0.5, 0.5, 0.05);
    expect(grid.share).toBe(one);
    // Back and forth along it.
    for (let x = 0; x <= 1; x += 0.04) grid.rub(x, 0.5, 0.09);
    expect(grid.share).toBeGreaterThanOrEqual(RUB_ENOUGH);
    expect(grid.share).toBeLessThanOrEqual(1);
    // Off the edge is no trouble.
    expect(() => grid.rub(-1, 3, 0.2)).not.toThrow();
  });
});

describe('dressing up', () => {
  it('six hats, four glasses, three things for the neck - each with a name, in Tamil too', () => {
    expect(HATS.length).toBe(6);
    expect(GLASSES.length).toBe(4);
    expect(NECKS.length).toBe(3);
    for (const row of WEAR_SLOTS) {
      expect(TA[row.name], row.name).toBeTruthy();
      for (const item of row.items) {
        const name = WEAR_NAMES[item as keyof typeof WEAR_NAMES];
        expect(name, item).toBeTruthy();
        expect(TA[name], name).toBeTruthy();
      }
    }
    expect(WEAR_RECORD).toBe('US_WEAR');
  });

  it('one thing in each place; the same thing again takes it off', () => {
    let wear = withWear(undefined, 'hat', 'crown', 10);
    expect(wear).toEqual({ hat: 'crown', at: 10 });
    wear = withWear(wear, 'eyes', 'hearts', 20);
    wear = withWear(wear, 'neck', 'scarf', 30);
    expect(wear).toEqual({ hat: 'crown', eyes: 'hearts', neck: 'scarf', at: 30 });
    // Another hat takes the first one's place.
    wear = withWear(wear, 'hat', 'chef', 40);
    expect(wear.hat).toBe('chef');
    // The same one again: off.
    wear = withWear(wear, 'hat', 'chef', 50);
    expect(wear.hat).toBeUndefined();
    expect(wear.eyes).toBe('hearts');
    expect(bare(wear)).toBe(false);
    wear = withWear(withWear(wear, 'eyes', 'hearts', 60), 'neck', 'scarf', 70);
    expect(bare(wear)).toBe(true);
    expect(bare(undefined)).toBe(true);
    // Something that is not in the wardrobe, or in the wrong place, is not put on.
    expect(withWear(undefined, 'hat', 'helmet', 80)).toEqual({ at: 80 });
    expect(withWear(undefined, 'hat', 'scarf', 90)).toEqual({ at: 90 });
  });

  it('only what can be worn is taken from the other phone, and the later word is kept', () => {
    expect(cleanWear({ hat: 'cap', eyes: 'stars', neck: 'pearls', at: 5 })).toEqual({ hat: 'cap', eyes: 'stars', neck: 'pearls', at: 5 });
    expect(cleanWear({ hat: 'helmet', eyes: 7, at: 5 })).toEqual({ at: 5 });
    expect(cleanWear({ hat: 'cap' })).toBeNull();
    expect(cleanWear(null)).toBeNull();
    const old = { hat: 'cap' as const, at: 5 };
    const fresh = { at: 9 };
    expect(latestWear(old, fresh)).toBe(fresh);
    expect(latestWear(fresh, old)).toBe(fresh);
    expect(latestWear(undefined, old)).toBe(old);
    expect(latestWear(old, undefined)).toBe(old);
  });

  it('the games look up what each of you wears', () => {
    showWear({ user: { hat: 'crown', at: 1 } });
    expect(wearOf('user')?.hat).toBe('crown');
    expect(wearOf('partner')).toBeUndefined();
    showWear(undefined);
    expect(wearOf('user')).toBeUndefined();
  });
});

describe('a secret typed as !!words!!', () => {
  it('takes the marks off, and leaves other words alone', () => {
    expect(wrapped('!!I miss you!!')).toBe('I miss you');
    expect(wrapped('  !! hi !! ')).toBe('hi');
    expect(wrapped('!wow!')).toBeNull();
    expect(wrapped('!!!!')).toBeNull();
    expect(wrapped('!!!!!!')).toBeNull();
    expect(wrapped('!!hi')).toBeNull();
    expect(wrapped('hello')).toBeNull();
  });
});
