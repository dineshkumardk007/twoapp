// What your partner changed, and where to find it.
//
// Thirty-odd features, and until now exactly two of them said anything when the
// other person touched something: chat and love letters. Everything else was
// silent, so the only way to learn that a scratch card had been left for you
// was to open the scratch card screen and look. The dock cannot fix that by
// itself - it is a horizontal rail of thirty-two tabs with four or five in view
// at a time, so a dot on the tenth is a dot you find by scrolling the whole bar
// hunting for dots, which is the problem again with extra steps.
//
// So there are two surfaces over one record: a dot on the tab, for when you are
// already scrolling, and a list on the home screen, which is where you land
// anyway and which needs no hunting at all.

/** A thing the partner did, once, somewhere. */
export interface ActivityEvent {
  id: string;
  /** Destination this belongs to, matching the dock's ids. */
  tabId: string;
  /** The record type, kept so the wording can stay specific. */
  type: string;
  at: number;
}

/**
 * How much a change is worth interrupting for.
 *
 * A letter written to you and a chore ticked off are not the same event, and
 * giving them the same red dot teaches you to ignore red dots inside a week.
 * Only the first tier marks the dock; the second is worth knowing and not worth
 * a dot, so it appears on the home list alone.
 */
export type ActivityTier = 'for-you' | 'changed';

/**
 * Which destination each record type belongs to, and how loud it is.
 *
 * An allowlist rather than a default, deliberately. Presence beats, read
 * receipts, typing signals, name exchanges and device hellos all arrive as
 * records too, several a minute, and any of them lighting up a tab would make
 * the whole thing noise. A type absent from here is plumbing and says nothing.
 */
const ROUTES: Record<string, { tab: string; tier: ActivityTier }> = {
  // Meant for you.
  CHAT: { tab: 'chat', tier: 'for-you' },
  CALL_MISSED: { tab: 'chat', tier: 'for-you' },
  LOVE_LETTER: { tab: 'letters', tier: 'for-you' },
  WHISPER_MEMO_UPDATE: { tab: 'whispers', tier: 'for-you' },
  SCRATCH_CARD_UPDATE: { tab: 'scratch', tier: 'for-you' },
  REPAIR_BRIDGE_SEND: { tab: 'repairbridge', tier: 'for-you' },
  REPAIR_BRIDGE_RESPOND: { tab: 'repairbridge', tier: 'for-you' },
  NOT_ABOUT_YOU: { tab: 'softlanding', tier: 'for-you' },
  KINTSUGI_CHERISH: { tab: 'kintsugi', tier: 'for-you' },
  NIGHTSTAND_KISS: { tab: 'nightstand', tier: 'for-you' },
  TIME_CAPSULE_UPDATE: { tab: 'capsules', tier: 'for-you' },
  MIDNIGHT_RADIO_WHISPER: { tab: 'radio', tier: 'for-you' },
  COMFORT_BOX: { tab: 'softlanding', tier: 'for-you' },
  GRATITUDE_STAR: { tab: 'constellation', tier: 'for-you' },
  STATE_OF_UNION_SEAL: { tab: 'stateofunion', tier: 'for-you' },
  JOURNAL_SHARED: { tab: 'journal', tier: 'for-you' },
  AGREEMENT_ADD: { tab: 'repair', tier: 'for-you' },
  MEMORY_ADD: { tab: 'timeline', tier: 'for-you' },

  // Worth knowing, not worth interrupting for.
  LIST_ITEM: { tab: 'lists', tier: 'changed' },
  RECIPE_ADD: { tab: 'recipes', tier: 'changed' },
  INGREDIENT_TOGGLE: { tab: 'recipes', tier: 'changed' },
  GARDEN_UPDATE: { tab: 'garden', tier: 'changed' },
  RITUAL_COMPLETE: { tab: 'rituals', tier: 'changed' },
  ADVENTURE_UPDATE: { tab: 'scrapbook', tier: 'changed' },
  COORDINATES_UPDATE: { tab: 'coordinates', tier: 'changed' },
  CANVAS_SAVE_SKETCH: { tab: 'canvas', tier: 'changed' },
  KINTSUGI_ADD: { tab: 'kintsugi', tier: 'changed' },
  INTUITION_ROUND: { tab: 'intuition', tier: 'changed' },
  CARE_COMPASS: { tab: 'compass', tier: 'changed' },
  STATE_OF_UNION_UPDATE: { tab: 'stateofunion', tier: 'changed' },
  SOFT_LANDING_UPDATE: { tab: 'softlanding', tier: 'changed' },
  MIDNIGHT_RADIO_SYNC: { tab: 'radio', tier: 'changed' },
  NIGHTSTAND_UPDATE: { tab: 'nightstand', tier: 'changed' },
  CO_PRESENCE_STATUS: { tab: 'presence', tier: 'changed' },
  WEATHER: { tab: 'home', tier: 'changed' },
  CHORE_ADD: { tab: 'chores', tier: 'changed' },
  EXPENSE_ADD: { tab: 'money', tier: 'changed' },
  EXPENSES_SETTLED: { tab: 'money', tier: 'changed' },
  QUOTE_ADD: { tab: 'timeline', tier: 'changed' },
  CYCLE_RECORD: { tab: 'cycle', tier: 'changed' },
  CYCLE_SHARING: { tab: 'cycle', tier: 'changed' }
};

/** How this reads on the home screen. Present tense, the partner as subject. */
const PHRASES: Record<string, string> = {
  CHAT: 'sent a message',
  CALL_MISSED: 'tried to call you',
  LOVE_LETTER: 'wrote you a letter',
  WHISPER_MEMO_UPDATE: 'left a whisper',
  SCRATCH_CARD_UPDATE: 'left a scratch card',
  REPAIR_BRIDGE_SEND: 'reached across the repair bridge',
  REPAIR_BRIDGE_RESPOND: 'answered on the repair bridge',
  NOT_ABOUT_YOU: 'said it is not about you',
  KINTSUGI_CHERISH: 'cherished a scar',
  KINTSUGI_ADD: 'added a scar',
  NIGHTSTAND_KISS: 'left a goodnight',
  NIGHTSTAND_UPDATE: 'changed the nightstand',
  TIME_CAPSULE_UPDATE: 'sealed something for later',
  MIDNIGHT_RADIO_WHISPER: 'whispered on the radio',
  MIDNIGHT_RADIO_SYNC: 'put something on the radio',
  COMFORT_BOX: 'added to the comfort box',
  GRATITUDE_STAR: 'hung a star for you',
  STATE_OF_UNION_SEAL: 'sealed a state of the union',
  STATE_OF_UNION_UPDATE: 'wrote in the state of the union',
  LIST_ITEM: 'changed a shared list',
  RECIPE_ADD: 'added a recipe',
  INGREDIENT_TOGGLE: 'ticked off an ingredient',
  GARDEN_UPDATE: 'tended the garden',
  RITUAL_COMPLETE: 'completed a ritual',
  ADVENTURE_UPDATE: 'added to the scrapbook',
  COORDINATES_UPDATE: 'shared where they are',
  CANVAS_SAVE_SKETCH: 'saved a sketch',
  INTUITION_ROUND: 'played a round',
  CARE_COMPASS: 'updated the care compass',
  SOFT_LANDING_UPDATE: 'changed a soft landing',
  CO_PRESENCE_STATUS: 'is sitting with you',
  WEATHER: 'changed their weather',
  JOURNAL_SHARED: 'shared a journal entry',
  AGREEMENT_ADD: 'added an agreement',
  MEMORY_ADD: 'added a memory',
  CHORE_ADD: 'logged a chore',
  EXPENSE_ADD: 'added an expense',
  EXPENSES_SETTLED: 'settled up',
  QUOTE_ADD: 'left a note in the quote jar',
  CYCLE_RECORD: 'updated their cycle',
  CYCLE_SHARING: 'changed what they share of their cycle'
};

/** Where a record belongs, or null when it is plumbing. */
export function routeFor(type: string): { tab: string; tier: ActivityTier } | null {
  return ROUTES[type] || null;
}

export function phraseFor(type: string): string {
  return PHRASES[type] || 'changed something';
}

/** Nothing older than this is worth surfacing as news. */
export const MAX_ACTIVITY_EVENTS = 100;

/**
 * Folds a new event into the log.
 *
 * One entry per tab, not per event: fifty list edits are one line saying the
 * list changed, because the point is to say where to look rather than to keep
 * a ledger. The count rides along so the line can admit there were fifty.
 */
export function withActivity(events: ActivityEvent[], incoming: ActivityEvent): ActivityEvent[] {
  const others = events.filter(e => e.tabId !== incoming.tabId);
  return [...others, incoming].slice(-MAX_ACTIVITY_EVENTS);
}

/** Events the reader has not looked at yet, newest first. */
export function unseen(
  events: ActivityEvent[],
  seen: Record<string, number>
): ActivityEvent[] {
  return events
    .filter(e => e.at > (seen[e.tabId] || 0))
    .sort((a, b) => b.at - a.at);
}

/** Tabs that should carry a dot: unseen, and loud enough to deserve one. */
export function dottedTabs(
  events: ActivityEvent[],
  seen: Record<string, number>
): Set<string> {
  const tabs = new Set<string>();
  for (const e of unseen(events, seen)) {
    if (routeFor(e.type)?.tier === 'for-you') tabs.add(e.tabId);
  }
  return tabs;
}
