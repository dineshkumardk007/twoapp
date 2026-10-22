// Which cards Home shows, and in what order - on this phone only.
//
// Home is about ten cards long, and not every couple uses every one of them.
// Each phone keeps its own arrangement: the order of the cards and the ones
// switched off. What cannot wait - news from your partner, reminders, "it's
// not about you" while it is on - is not a card here, and stays at the top.

export type HomeCardId =
  | 'ourDays'
  | 'comingUp'
  | 'kural'
  | 'weather'
  | 'comfort'
  | 'thinking'
  | 'question'
  | 'quote'
  | 'milestones';

export interface HomeCard {
  id: HomeCardId;
  label: string;
  /** When a card that is switched off still shows, because it matters that day. */
  stillShows?: () => string;
}

/** Every card, in the order Home has always had them. */
export const HOME_CARDS: readonly HomeCard[] = [
  { id: 'ourDays', label: 'Our days' },
  { id: 'comingUp', label: 'Coming up' },
  { id: 'kural', label: 'Kural of the day' },
  { id: 'weather', label: 'Emotional weather' },
  { id: 'comfort', label: 'Comfort box', stillShows: () => 'Still shows on a heavy day' },
  { id: 'thinking', label: 'Thinking of you' },
  { id: 'question', label: "Today's question" },
  { id: 'quote', label: 'Quote of the day' },
  { id: 'milestones', label: 'Milestones' }
];

export interface HomeLayout {
  order: HomeCardId[];
  hidden: HomeCardId[];
}

const KEY = 'two_home_layout_v1';

export function defaultLayout(): HomeLayout {
  return { order: HOME_CARDS.map(c => c.id), hidden: [] };
}

function cardIds(raw: unknown): HomeCardId[] {
  const known = new Set<string>(HOME_CARDS.map(c => c.id));
  const list = Array.isArray(raw) ? raw : [];
  return list.filter((id, i): id is HomeCardId => typeof id === 'string' && known.has(id) && list.indexOf(id) === i);
}

/**
 * A layout as it was stored, made whole: what is not a card is dropped, and
 * a card it does not mention - one added in a later version - goes in after
 * the card it follows by default.
 */
export function cleanLayout(raw: unknown): HomeLayout {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const order = cardIds(r.order);
  HOME_CARDS.forEach((card, i) => {
    if (order.includes(card.id)) return;
    const before = HOME_CARDS.slice(0, i).reverse().find(c => order.includes(c.id));
    order.splice(before ? order.indexOf(before.id) + 1 : 0, 0, card.id);
  });
  return { order, hidden: cardIds(r.hidden) };
}

export function isDefaultLayout(layout: HomeLayout): boolean {
  return !layout.hidden.length && layout.order.every((id, i) => id === HOME_CARDS[i]?.id);
}

export function readHomeLayout(): HomeLayout {
  try {
    return cleanLayout(JSON.parse(localStorage.getItem(KEY) || 'null'));
  } catch {
    return defaultLayout();
  }
}

export function writeHomeLayout(layout: HomeLayout) {
  try {
    if (isDefaultLayout(layout)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    /* kept for this visit only */
  }
}

/** `id` one place up (-1) or down (1); unchanged at either end. */
export function moveCard(layout: HomeLayout, id: HomeCardId, by: -1 | 1): HomeLayout {
  const from = layout.order.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= layout.order.length) return layout;
  const order = layout.order.slice();
  [order[from], order[to]] = [order[to], order[from]];
  return { ...layout, order };
}

export function setCardShown(layout: HomeLayout, id: HomeCardId, shown: boolean): HomeLayout {
  const hidden = layout.hidden.filter(h => h !== id);
  return { ...layout, hidden: shown ? hidden : [...hidden, id] };
}
