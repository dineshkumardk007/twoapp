// The order of the games on Canvas of Us, and the ones switched off
// (components/ArrangeGamesSheet).
//
// Each phone keeps its own arrangement. With "same order on both phones" on -
// as it is unless switched off - every change is also sent to the other
// phone (a record, the newest from each of you kept on the relay), and the
// latest arrangement from either phone is the one both show. Switched off,
// this phone keeps its own and pays no attention to the other's; switched
// back on, its own becomes the one both show.

import { DUO_GAMES } from './duo';
import { PAPER_KINDS } from './paperGames';

export const SHELF_RECORD = 'GAME_SHELF';

/** Every game on the shelf, in the order it has always had. */
export const SHELF_GAMES: readonly string[] = ['homes', 'maze', ...DUO_GAMES, ...PAPER_KINDS];

export interface ShelfLayout {
  order: string[];
  hidden: string[];
  /** When it was arranged: the later of two is the one shown. 0 for the usual order. */
  at: number;
}

export const defaultShelf = (): ShelfLayout => ({ order: [...SHELF_GAMES], hidden: [], at: 0 });

function ids(raw: unknown): string[] {
  const known = new Set(SHELF_GAMES);
  const list = Array.isArray(raw) ? raw : [];
  return list.filter((id, i): id is string => typeof id === 'string' && known.has(id) && list.indexOf(id) === i);
}

/**
 * A layout as it was stored or sent, made whole: what is not a game is
 * dropped, and a game it does not mention - one added in a later version -
 * goes in after the game it follows by default.
 */
export function cleanShelf(raw: unknown): ShelfLayout | null {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!r) return null;
  const order = ids(r.order);
  SHELF_GAMES.forEach((game, i) => {
    if (order.includes(game)) return;
    const before = SHELF_GAMES.slice(0, i).reverse().find(g => order.includes(g));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, game);
  });
  const at = Number(r.at);
  return { order, hidden: ids(r.hidden), at: Number.isFinite(at) && at > 0 ? at : 0 };
}

export const isDefaultShelf = (layout: ShelfLayout) => !layout.hidden.length && layout.order.every((id, i) => id === SHELF_GAMES[i]);

/** The later of two layouts; the one held when the other is no later. */
export const laterShelf = (held: ShelfLayout | undefined, other: ShelfLayout | undefined): ShelfLayout | undefined =>
  other && (!held || other.at > held.at) ? other : held;

export function moveGame(layout: ShelfLayout, id: string, by: -1 | 1, at: number): ShelfLayout {
  const from = layout.order.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= layout.order.length) return layout;
  const order = layout.order.slice();
  [order[from], order[to]] = [order[to], order[from]];
  return { ...layout, order, at };
}

export function setGameShown(layout: ShelfLayout, id: string, shown: boolean, at: number): ShelfLayout {
  const hidden = layout.hidden.filter(h => h !== id);
  return { ...layout, hidden: shown ? hidden : [...hidden, id], at };
}

// ------------------------------------------------------------- this phone

const KEY = 'two_game_shelf_v1';

export interface MyShelf {
  layout: ShelfLayout;
  /** The same order on both phones. On unless switched off. */
  sync: boolean;
}

export function readMyShelf(): MyShelf {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    const layout = cleanShelf(raw?.layout) ?? defaultShelf();
    return { layout, sync: raw?.sync !== false };
  } catch {
    return { layout: defaultShelf(), sync: true };
  }
}

export function writeMyShelf(mine: MyShelf) {
  try {
    localStorage.setItem(KEY, JSON.stringify(mine));
  } catch {
    /* it holds until Two is closed */
  }
}

/** The layout this phone shows: its own - or, kept in step, whichever of its own and the shared one is later. */
export const shownShelf = (mine: MyShelf, shared: ShelfLayout | undefined): ShelfLayout => (mine.sync ? laterShelf(mine.layout, shared) ?? mine.layout : mine.layout);
