// Dressing up the bear and the bunny of "Us two" (components/Wardrobe,
// components/WearArt): a hat, glasses and something round the neck.
//
// Each of you dresses your own one. What it wears is sent whole each time it
// changes, and the newest from each phone is what both show.

import type { Seat } from './usTwo';

export const WEAR_RECORD = 'US_WEAR';
/** A phone that shows what the other one is wearing (said with its version, App's CAN_DO). */
export const CAN_WEAR = 'wear-1';

export const HATS = ['party', 'crown', 'cap', 'beanie', 'flowers', 'chef'] as const;
export const GLASSES = ['round', 'shades', 'hearts', 'stars'] as const;
export const NECKS = ['bowtie', 'scarf', 'pearls'] as const;
export type Hat = (typeof HATS)[number];
export type Glasses = (typeof GLASSES)[number];
export type Neck = (typeof NECKS)[number];

/** The three places something can be worn. */
export type WearSlot = 'hat' | 'eyes' | 'neck';
export const WEAR_SLOTS: ReadonlyArray<{ slot: WearSlot; name: string; items: readonly string[] }> = [
  { slot: 'hat', name: 'Hats', items: HATS },
  { slot: 'eyes', name: 'Glasses', items: GLASSES },
  { slot: 'neck', name: 'Round the neck', items: NECKS }
];

/** What each thing is called. */
export const WEAR_NAMES: Record<Hat | Glasses | Neck, string> = {
  party: 'Party hat',
  crown: 'Crown',
  cap: 'Cap',
  beanie: 'Woolly hat',
  flowers: 'Flower crown',
  chef: "Chef's hat",
  round: 'Round glasses',
  shades: 'Sunglasses',
  hearts: 'Heart glasses',
  stars: 'Star glasses',
  bowtie: 'Bow tie',
  scarf: 'Scarf',
  pearls: 'Pearls'
};

export interface Wear {
  hat?: Hat;
  eyes?: Glasses;
  neck?: Neck;
  /** When it was last changed: the later word from a phone is the one believed. */
  at: number;
}

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | undefined => (list as readonly unknown[]).includes(value) ? (value as T) : undefined;

/** Only what can be worn is taken from the other phone. */
export function cleanWear(raw: unknown): Wear | null {
  const r = raw as { hat?: unknown; eyes?: unknown; neck?: unknown; at?: unknown } | null;
  if (!r || typeof r !== 'object') return null;
  const at = Number(r.at);
  if (!Number.isFinite(at) || at <= 0) return null;
  const hat = oneOf(HATS, r.hat);
  const eyes = oneOf(GLASSES, r.eyes);
  const neck = oneOf(NECKS, r.neck);
  return { ...(hat ? { hat } : {}), ...(eyes ? { eyes } : {}), ...(neck ? { neck } : {}), at };
}

/** The later of two words about what one of you wears; the one held when the other is no later. */
export const latestWear = (held: Wear | undefined, other: Wear | undefined): Wear | undefined => (other && (!held || other.at > held.at) ? other : held);

/** One thing put on, or taken off when it is what is already there. */
export function withWear(held: Wear | undefined, slot: WearSlot, item: string | null, at: number): Wear {
  const next: Wear = { ...(held ?? {}), at };
  const pick =
    slot === 'hat' ? oneOf(HATS, item) : slot === 'eyes' ? oneOf(GLASSES, item) : oneOf(NECKS, item);
  if (!pick || held?.[slot] === pick) delete next[slot];
  else (next as unknown as Record<string, unknown>)[slot] = pick;
  return next;
}

/** Wearing nothing at all. */
export const bare = (wear: Wear | undefined) => !wear || (!wear.hat && !wear.eyes && !wear.neck);

/** What each of you wears, by seat. */
export type WearBook = Partial<Record<Seat, Wear>>;

// The games draw the two of you as well (the maze, the emotes), far from
// where what you wear is kept: App puts it here each time it changes, and
// they look it up as they draw.
let shown: WearBook = {};
export function showWear(book: WearBook | undefined) {
  shown = book ?? {};
}
export const wearOf = (seat: Seat): Wear | undefined => shown[seat];
