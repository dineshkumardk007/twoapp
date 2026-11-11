// The small box the first time you open each game on Canvas of Us
// (components/GameTour): how it is played, in a few short lines. Each phone
// remembers for itself, so you both see it once, whoever started the game.

import type { PaperKind } from './paperGames';

export interface TourLine {
  icon: string;
  text: string;
}

export const GAME_TOURS: Record<PaperKind, TourLine[]> = {
  boxing: [
    { icon: '🥊', text: 'You both pick a move in secret' },
    { icon: '⚡', text: 'Big punches cost energy' },
    { icon: '🛡️', text: 'Block stops a Jab and gives energy' },
    { icon: '💨', text: 'Dodge makes big punches miss' },
    { icon: '💥', text: 'Uppercut breaks a Block' },
    { icon: '🏆', text: 'Knock them out to win' }
  ],
  penalty: [
    { icon: '⚽', text: 'Take turns to shoot and to keep goal' },
    { icon: '🎯', text: 'Drag the mark to aim your kick' },
    { icon: '💪', text: 'Tap Kick when the power is right' },
    { icon: '🧤', text: 'In goal? Tap where you will dive' },
    { icon: '🏆', text: 'Five kicks each. Most goals wins' }
  ],
  puzzle: [
    { icon: '🧩', text: 'You both get the same puzzle' },
    { icon: '⏱️', text: 'Tap Start. Your own clock runs' },
    { icon: '⚡', text: 'The faster one wins the round' },
    { icon: '❌', text: 'A wrong tap adds time' },
    { icon: '🏆', text: 'First to 4 rounds wins' }
  ],
  balloon: [
    { icon: '👆', text: 'Pull back and let go to throw' },
    { icon: '💨', text: 'Watch the wind. It changes every throw' },
    { icon: '💦', text: 'Each hit makes the other wetter' },
    { icon: '🏆', text: 'Soak them to 10 to win' },
    { icon: '🎈', text: 'You each get one giant balloon' }
  ],
  carrom: [
    { icon: '👆', text: 'Slide the striker, pull back, let go' },
    { icon: '⚪', text: 'Pot your colour to go again' },
    { icon: '👑', text: 'After your first coin, pot the Queen' },
    { icon: '🔒', text: 'Then pot one more coin to keep her' },
    { icon: '⚠️', text: 'Striker in a pocket? One coin comes back' },
    { icon: '🏆', text: 'Queen won? Clear your coins to win' }
  ],
  four: [
    { icon: '🔵', text: 'Take turns dropping a disc' },
    { icon: '🏆', text: 'Four in a line wins: across, down or slanting' }
  ],
  memory: [
    { icon: '🃏', text: 'Turn over two cards each turn' },
    { icon: '💞', text: 'They match? Keep them and go again' },
    { icon: '🏆', text: 'The most pairs wins' }
  ],
  hhk: [
    { icon: '🤫', text: 'You both choose in secret' },
    { icon: '🤗', text: 'Hug beats Heart' },
    { icon: '💋', text: 'Kiss beats Hug' },
    { icon: '❤️', text: 'Heart beats Kiss' },
    { icon: '🏆', text: 'First to 3 wins' }
  ],
  snakes: [
    { icon: '🎲', text: 'Tap the die to move' },
    { icon: '⬆️', text: 'Ladders take you up' },
    { icon: '🐍', text: 'Snakes bring you down' },
    { icon: '6️⃣', text: 'A 6 rolls again' },
    { icon: '🏆', text: 'Land exactly on 100 to win' }
  ],
  ttt: [
    { icon: '✏️', text: 'Take turns' },
    { icon: '🏆', text: 'Three in a row wins' }
  ],
  dots: [
    { icon: '✏️', text: 'Take turns drawing one line' },
    { icon: '📦', text: 'Close a box to claim it and go again' },
    { icon: '🏆', text: 'The most boxes wins' }
  ]
};

/** The same box for Cosy Homes, the one-player puzzle (components/CosyHomes). It is not one of the games for two. */
export const HOMES_TOUR_KEY = 'homes';
export const HOMES_TOUR: TourLine[] = [
  { icon: '👆', text: 'Tap once for ✕. Tap again for a friend' },
  { icon: '↔️', text: 'One friend in every row and column' },
  { icon: '🎨', text: 'One friend in every colour' },
  { icon: '🚫', text: 'Friends cannot touch, even at the corners' },
  { icon: '💡', text: 'Stuck? Tap Hint' },
  { icon: '⭐', text: 'Be quick and use no hints for 3 stars' }
];

const KEY = 'two_game_tours_seen';
/** Also held here, so a phone that cannot save still only shows each one once until Two is closed. */
const thisTime = new Set<string>();

function saved(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Whether this phone has already shown the box for this game. */
export const tourSeen = (kind: PaperKind | typeof HOMES_TOUR_KEY) => thisTime.has(kind) || saved().includes(kind);

export function markTourSeen(kind: PaperKind | typeof HOMES_TOUR_KEY) {
  thisTime.add(kind);
  try {
    const list = saved();
    if (!list.includes(kind)) localStorage.setItem(KEY, JSON.stringify([...list, kind]));
  } catch {
    /* it shows once more next time Two is opened */
  }
}

/** Forgets what this session has shown (for the tests). */
export function forgetToursForTest() {
  thisTime.clear();
}
