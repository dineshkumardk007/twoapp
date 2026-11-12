// The puppy the two of you look after together, on Home (components/PetCard).
//
// It is fed, played with and stroked from either phone. Each phone says only
// what it has done itself (`PetHalf`: how many times, and when last), so both
// can look after it in the same minute and nothing either says undoes the
// other. The puppy as it is - when it last ate, how well loved it is - is the
// two halves put together (`petOf`), the same on both phones.
//
// It never comes to harm. Left alone it gets hungry, then bored, then sulks
// until somebody comes back to it.

export const PET_RECORD = 'US_PET';
/** A phone that has the puppy (said with its version, App's CAN_DO). */
export const CAN_PET = 'pet-1';

export const PET_DEFAULT_NAME = 'Mochi';
const NAME_MAX = 16;

const MIN = 60_000;
const HOUR = 60 * MIN;
/** A meal keeps it full for this long: asked again sooner, it has had enough. */
export const FULL_FOR_MS = 30 * MIN;
/** A stroke counts towards how well loved it is this often; in between it is still enjoyed. */
export const STROKE_COUNTS_EVERY_MS = 10 * MIN;
/** A game counts this often. */
export const PLAY_COUNTS_EVERY_MS = 5 * MIN;

/** What one phone says it has done for the puppy. */
export interface PetHalf {
  fed: number;
  fedAt: number;
  played: number;
  playedAt: number;
  stroked: number;
  strokedAt: number;
  /** The name it gave, and when: the later naming from either phone is the one used. */
  name?: string;
  nameAt?: number;
  /** When this half last changed. */
  at: number;
}

export const emptyHalf = (): PetHalf => ({ fed: 0, fedAt: 0, played: 0, playedAt: 0, stroked: 0, strokedAt: 0, at: 0 });

const whole = (value: unknown, max = Number.MAX_SAFE_INTEGER): number => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};

export function cleanName(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';
}

export function cleanPetHalf(raw: unknown): PetHalf | null {
  const r = raw as Partial<Record<keyof PetHalf, unknown>> | null;
  if (!r || typeof r !== 'object') return null;
  const at = whole(r.at);
  if (!at) return null;
  const name = cleanName(r.name);
  const nameAt = whole(r.nameAt);
  return {
    fed: whole(r.fed, 1_000_000),
    fedAt: whole(r.fedAt),
    played: whole(r.played, 1_000_000),
    playedAt: whole(r.playedAt),
    stroked: whole(r.stroked, 1_000_000),
    strokedAt: whole(r.strokedAt),
    ...(name && nameAt ? { name, nameAt } : {}),
    at
  };
}

/** The later of two words from the same phone; the one held when the other is no later. */
export const latestPetHalf = (held: PetHalf | undefined, other: PetHalf | undefined): PetHalf | undefined =>
  other && (!held || other.at > held.at) ? other : held;

/** The puppy as it is, from what both phones have done. */
export interface Pet {
  name: string;
  fedAt: number;
  playedAt: number;
  strokedAt: number;
  /** How well loved: two for a meal or a game, one for a stroke. */
  care: number;
  /** Nobody has done anything for it yet. */
  fresh: boolean;
}

export function petOf(mine: PetHalf | undefined, theirs: PetHalf | undefined): Pet {
  const a = mine ?? emptyHalf();
  const b = theirs ?? emptyHalf();
  const named = (a.nameAt ?? 0) >= (b.nameAt ?? 0) ? a : b;
  const care = (a.fed + b.fed) * 2 + (a.played + b.played) * 2 + a.stroked + b.stroked;
  return {
    name: named.name || PET_DEFAULT_NAME,
    fedAt: Math.max(a.fedAt, b.fedAt),
    playedAt: Math.max(a.playedAt, b.playedAt),
    strokedAt: Math.max(a.strokedAt, b.strokedAt),
    care,
    fresh: care === 0
  };
}

export type PetMood = 'new' | 'happy' | 'fine' | 'hungry' | 'bored' | 'sulking' | 'asleep';

/**
 * How it is now. `hour` is the hour of the day on this phone, 0 to 23: it
 * sleeps at night unless it is hungry.
 */
export function moodOf(pet: Pet, now: number, hour: number): PetMood {
  if (pet.fresh) return 'new';
  const sinceFed = now - pet.fedAt;
  const sincePlayed = now - Math.max(pet.playedAt, pet.strokedAt);
  // A puppy never fed at all is as hungry as one not fed for a day.
  const hungry = pet.fedAt === 0 || sinceFed > 12 * HOUR;
  if ((pet.fedAt === 0 ? false : sinceFed > 30 * HOUR) || sincePlayed > 48 * HOUR) return 'sulking';
  if (hungry) return 'hungry';
  if (hour >= 23 || hour < 6) return 'asleep';
  if (sincePlayed > 18 * HOUR) return 'bored';
  if (sinceFed < 5 * HOUR && sincePlayed < 8 * HOUR) return 'happy';
  return 'fine';
}

/** Whether it will eat: not while it is still full from the last meal. */
export const willEat = (pet: Pet, now: number) => pet.fedAt === 0 || now - pet.fedAt >= FULL_FOR_MS;

/** A meal from this phone. */
export function fed(half: PetHalf | undefined, now: number): PetHalf {
  const h = half ?? emptyHalf();
  return { ...h, fed: h.fed + 1, fedAt: now, at: now };
}

/** A game from this phone: always played, counted towards its love every few minutes. */
export function played(half: PetHalf | undefined, now: number): PetHalf {
  const h = half ?? emptyHalf();
  const counts = h.playedAt === 0 || now - h.playedAt >= PLAY_COUNTS_EVERY_MS;
  return { ...h, played: h.played + (counts ? 1 : 0), playedAt: now, at: now };
}

/** A stroke from this phone. */
export function stroked(half: PetHalf | undefined, now: number): PetHalf {
  const h = half ?? emptyHalf();
  const counts = h.strokedAt === 0 || now - h.strokedAt >= STROKE_COUNTS_EVERY_MS;
  return { ...h, stroked: h.stroked + (counts ? 1 : 0), strokedAt: now, at: now };
}

/** A new name from this phone; null when there is nothing left of it once tidied. */
export function named(half: PetHalf | undefined, name: string, now: number): PetHalf | null {
  const clean = cleanName(name);
  if (!clean) return null;
  return { ...(half ?? emptyHalf()), name: clean, nameAt: now, at: now };
}

/** Its level: 1 to begin with, and a little more care needed for each one after. */
export function levelOf(care: number): { level: number; into: number; span: number } {
  let level = 1;
  let floor = 0;
  // Level n is left behind after 6n more points: 6, 18, 36, 60...
  while (care >= floor + 6 * level) {
    floor += 6 * level;
    level++;
  }
  return { level, into: care - floor, span: 6 * level };
}

/** What just happened to it, from one phone's half before and after: for the other phone to show as it arrives. */
export function whatChanged(before: PetHalf | undefined, after: PetHalf | undefined): 'fed' | 'played' | 'stroked' | 'named' | null {
  if (!after) return null;
  const b = before ?? emptyHalf();
  if (after.fedAt > b.fedAt) return 'fed';
  if (after.playedAt > b.playedAt) return 'played';
  if (after.strokedAt > b.strokedAt) return 'stroked';
  if ((after.nameAt ?? 0) > (b.nameAt ?? 0)) return 'named';
  return null;
}
