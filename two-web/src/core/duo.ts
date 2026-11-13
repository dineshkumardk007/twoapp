// The games the two of you play at the same moment, on the same side:
// Bomb Squad (core/bombSquad), Catch Together (core/catchTogether) and Light
// and Shadow (core/lampMaze).
//
// What happens in one as it is played goes down the relay's unkept channel
// (ws.sendSignal, as a step in Two Hearts does): it is only true for that
// instant, and a game left half-way is simply started again. What is kept is
// small - how far the two of you have got in each - and each phone says only
// its own count, so neither can undo the other: the further of the two is
// where you are.

export const DUO_GAMES = ['bomb', 'catch', 'lamp', 'dive', 'space'] as const;
export type DuoGame = (typeof DUO_GAMES)[number];
export const isDuoGame = (value: unknown): value is DuoGame => typeof value === 'string' && (DUO_GAMES as readonly string[]).includes(value);

/** How far each phone has got, kept on the relay: the newest from each of you. */
export const DUO_RECORD = 'GAME_DUO';
/** A game as it is played: kept nowhere. */
export const DUO_SIGNAL = 'GAME_DUO_LIVE';
/** A phone that has these games (said with its version, App's CAN_DO). */
export const CAN_DUO = 'duo-1';

/** What they are called, on their cards and at their tops. */
export const DUO_NAMES: Record<DuoGame, string> = {
  bomb: 'Bomb Squad',
  catch: 'Catch Together',
  lamp: 'Light and Shadow',
  dive: 'Treasure Divers',
  space: 'Space Crew'
};

/** The ones counted by their best score in a round; the rest by the levels finished. */
export const DUO_BY_SCORE: readonly DuoGame[] = ['catch', 'space'];

/**
 * What one phone has seen the two of you do: for each game, the levels
 * finished - or, for the ones played in rounds, the most scored in one.
 */
export type DuoHalf = Record<DuoGame, number> & { at: number };

const whole = (value: unknown, max: number) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(max, n) : 0;
};
const none = (at: number): DuoHalf => ({ bomb: 0, catch: 0, lamp: 0, dive: 0, space: 0, at });

export function cleanDuoHalf(raw: unknown): DuoHalf | null {
  const r = raw as Partial<Record<keyof DuoHalf, unknown>> | null;
  if (!r || typeof r !== 'object') return null;
  const at = Number(r.at);
  if (!Number.isFinite(at) || at <= 0) return null;
  const half = none(at);
  for (const game of DUO_GAMES) half[game] = whole(r[game], 100_000);
  return half;
}

/** Two words from the same phone, put together: nothing it has counted is ever taken back. */
export function mergeDuo(a: DuoHalf | undefined, b: DuoHalf | undefined): DuoHalf | undefined {
  if (!a || !b) return a ?? b;
  if (DUO_GAMES.every(game => b[game] <= a[game])) return a;
  const half = none(Math.max(a.at, b.at));
  for (const game of DUO_GAMES) half[game] = Math.max(a[game], b[game]);
  return half;
}

/** Where the two of you are: the further of the two phones in each game. */
export function duoOf(mine: DuoHalf | undefined, theirs: DuoHalf | undefined): Record<DuoGame, number> {
  const { at: _at, ...both } = none(0);
  for (const game of DUO_GAMES) both[game] = Math.max(mine?.[game] ?? 0, theirs?.[game] ?? 0);
  return both;
}

/** This phone's half with one count raised. The same half when it was already that high. */
export function withDuo(half: DuoHalf | undefined, game: DuoGame, value: number, at: number): DuoHalf {
  const base = half ?? none(at);
  const next = whole(value, 100_000);
  return next <= base[game] && half ? half : { ...base, [game]: Math.max(base[game], next), at };
}

// ------------------------------------------------- as it happens, kept nowhere

type Sender = (said: { g: DuoGame; b: unknown }) => void;
let sender: Sender | null = null;
/** App gives the way out: the relay's unkept channel. */
export function setDuoSender(fn: Sender | null) {
  sender = fn;
}
export function sayDuo(game: DuoGame, body: unknown) {
  try {
    sender?.({ g: game, b: body });
  } catch {
    /* not connected: nothing to tell */
  }
}

type Listener = (body: unknown) => void;
const listeners = new Map<DuoGame, Set<Listener>>();
/** The game on screen listens here. Returns how to stop. */
export function onDuo(game: DuoGame, listener: Listener): () => void {
  let set = listeners.get(game);
  if (!set) listeners.set(game, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/** Something from the other phone, as it arrived: passed to the game it is for, which reads it with care. */
export function hearDuo(raw: unknown) {
  const r = raw as { g?: unknown; b?: unknown } | null;
  if (!r || typeof r !== 'object' || !isDuoGame(r.g) || !r.b || typeof r.b !== 'object') return;
  listeners.get(r.g)?.forEach(listener => {
    try {
      listener(r.b);
    } catch {
      /* one listener failing does not stop the rest */
    }
  });
}

/** Numbers that look thrown but come out the same for the same seed, on both phones. */
export function duoDice(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** One of `count`, by a roll. */
export const duoPick = (roll: () => number, count: number) => Math.min(count - 1, Math.floor(roll() * count));

/** A whole number from the other phone, within bounds, or null. */
export function duoInt(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}
