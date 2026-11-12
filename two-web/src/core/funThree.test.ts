import { beforeEach, describe, expect, it } from 'vitest';
import { snippetOf } from './chatActions';
import { TA } from './i18n.ta';
import {
  FULL_FOR_MS,
  PET_DEFAULT_NAME,
  PET_RECORD,
  PLAY_COUNTS_EVERY_MS,
  STROKE_COUNTS_EVERY_MS,
  cleanPetHalf,
  fed,
  latestPetHalf,
  levelOf,
  moodOf,
  named,
  petOf,
  played,
  stroked,
  whatChanged,
  willEat
} from './pet';
import { RUB_ENOUGH, RubGrid, SECRET_WORDS, forgetSecretsForTest, isSecret, openSecret, secretOpened } from './secretMessage';
import { GLASSES, HATS, NECKS, WEAR_NAMES, WEAR_RECORD, WEAR_SLOTS, bare, cleanWear, latestWear, showWear, wearOf, withWear } from './wear';
import type { ChatMessage } from '../types';

const HOUR = 3_600_000;

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

describe('the puppy', () => {
  const t = 10_000_000_000;

  it('starts with nothing done for it, and a name of its own', () => {
    const pet = petOf(undefined, undefined);
    expect(pet).toMatchObject({ name: PET_DEFAULT_NAME, care: 0, fresh: true });
    expect(moodOf(pet, t, 12)).toBe('new');
    expect(willEat(pet, t)).toBe(true);
    expect(PET_RECORD).toBe('US_PET');
  });

  it('is looked after from both phones at once: what each does adds up', () => {
    const mine = played(fed(undefined, t), t + 1000);
    const theirs = stroked(fed(undefined, t + 2000), t + 3000);
    const pet = petOf(mine, theirs);
    // Two meals, a game and a stroke.
    expect(pet.care).toBe(2 + 2 + 2 + 1);
    expect(pet.fedAt).toBe(t + 2000);
    expect(pet.playedAt).toBe(t + 1000);
    expect(pet.strokedAt).toBe(t + 3000);
    // The same from the other phone.
    expect(petOf(theirs, mine)).toEqual(pet);
  });

  it('is full for a while after a meal, whoever gave it', () => {
    const theirs = fed(undefined, t);
    const pet = petOf(undefined, theirs);
    expect(willEat(pet, t + FULL_FOR_MS - 1)).toBe(false);
    expect(willEat(pet, t + FULL_FOR_MS)).toBe(true);
  });

  it('a game or a stroke is always enjoyed, but counts only every so often', () => {
    let half = played(undefined, t);
    half = played(half, t + 1000);
    expect(half.played).toBe(1);
    expect(half.playedAt).toBe(t + 1000);
    half = played(half, t + 1000 + PLAY_COUNTS_EVERY_MS);
    expect(half.played).toBe(2);
    let s = stroked(undefined, t);
    s = stroked(s, t + 5000);
    expect(s.stroked).toBe(1);
    s = stroked(s, t + 5000 + STROKE_COUNTS_EVERY_MS);
    expect(s.stroked).toBe(2);
  });

  it('gets hungry, then bored, then sulks - and sleeps at night unless it is hungry', () => {
    const pet = petOf(played(fed(undefined, t), t), undefined);
    expect(moodOf(pet, t + HOUR, 12)).toBe('happy');
    expect(moodOf(pet, t + 9 * HOUR, 12)).toBe('fine');
    expect(moodOf(pet, t + 9 * HOUR, 2)).toBe('asleep');
    expect(moodOf(pet, t + 13 * HOUR, 12)).toBe('hungry');
    // Hungry at night: awake.
    expect(moodOf(pet, t + 13 * HOUR, 2)).toBe('hungry');
    expect(moodOf(pet, t + 31 * HOUR, 12)).toBe('sulking');
    // Fed but never played with for a day: bored. Two days: sulking.
    const fedOnly = petOf({ ...fed(undefined, t + 20 * HOUR), played: 1, playedAt: t }, undefined);
    expect(moodOf(fedOnly, t + 21 * HOUR, 12)).toBe('bored');
    const kept = petOf({ ...fed(undefined, t + 49 * HOUR), played: 1, playedAt: t }, undefined);
    expect(moodOf(kept, t + 49 * HOUR + 1000, 12)).toBe('sulking');
    // Coming back to it puts it right.
    const back = petOf(played(fed(undefined, t + 50 * HOUR), t + 50 * HOUR), undefined);
    expect(moodOf(back, t + 50 * HOUR + 1000, 12)).toBe('happy');
  });

  it('is called what it was last named, by either of you', () => {
    const mine = named(undefined, '  Bubbles   the   Great and Mighty ', t)!;
    expect(mine.name).toBe('Bubbles the Grea');
    expect(petOf(mine, undefined).name).toBe('Bubbles the Grea');
    const theirs = named(undefined, 'Laddu', t + 5)!;
    expect(petOf(mine, theirs).name).toBe('Laddu');
    expect(petOf(theirs, mine).name).toBe('Laddu');
    expect(named(undefined, '   ', t)).toBeNull();
    // Naming it is not looking after it.
    expect(petOf(mine, theirs).care).toBe(0);
  });

  it('grows a level at a time, each needing a little more', () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, span: 6 });
    expect(levelOf(5)).toEqual({ level: 1, into: 5, span: 6 });
    expect(levelOf(6)).toEqual({ level: 2, into: 0, span: 12 });
    expect(levelOf(17)).toEqual({ level: 2, into: 11, span: 12 });
    expect(levelOf(18)).toEqual({ level: 3, into: 0, span: 18 });
    for (let care = 0; care < 500; care++) {
      const now = levelOf(care);
      const next = levelOf(care + 1);
      expect(next.level).toBeGreaterThanOrEqual(now.level);
      expect(now.into).toBeLessThan(now.span);
    }
  });

  it('the other phone is shown what was just done', () => {
    const a = fed(undefined, t);
    expect(whatChanged(undefined, a)).toBe('fed');
    expect(whatChanged(a, played(a, t + 1))).toBe('played');
    expect(whatChanged(a, stroked(a, t + 1))).toBe('stroked');
    expect(whatChanged(a, named(a, 'Laddu', t + 1)!)).toBe('named');
    expect(whatChanged(a, a)).toBeNull();
    expect(whatChanged(a, undefined)).toBeNull();
  });

  it('only a real half is taken from the other phone, and the later word is kept', () => {
    const half = { fed: 3, fedAt: 50, played: 1, playedAt: 40, stroked: 2, strokedAt: 30, name: 'Laddu', nameAt: 20, at: 60 };
    expect(cleanPetHalf(half)).toEqual(half);
    expect(cleanPetHalf({ ...half, fed: -4, name: 7 })).toEqual({ ...half, fed: 0, name: undefined, nameAt: undefined });
    expect(cleanPetHalf({ ...half, at: 0 })).toBeNull();
    expect(cleanPetHalf('woof')).toBeNull();
    const older = { ...half, at: 10 };
    expect(latestPetHalf(half, older)).toBe(half);
    expect(latestPetHalf(older, half)).toBe(half);
    expect(latestPetHalf(undefined, older)).toBe(older);
  });
});
