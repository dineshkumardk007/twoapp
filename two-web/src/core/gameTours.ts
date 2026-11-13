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
  rps: [
    { icon: '🤫', text: 'You both choose in secret' },
    { icon: '📄', text: 'Paper wraps Rock' },
    { icon: '✂️', text: 'Scissors cut Paper' },
    { icon: '🪨', text: 'Rock smashes Scissors' },
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

/** And for Two Hearts, the maze the two of you do together (components/TwoHearts). */
export const MAZE_TOUR_KEY = 'maze';
export const MAZE_TOUR: TourLine[] = [
  { icon: '👆', text: 'Tap a square or use the arrows to walk' },
  { icon: '🔘', text: 'Stand on a button to open its door' },
  { icon: '🚪', text: 'It stays open only while you stand there' },
  { icon: '🏠', text: 'Get both of you home to finish' },
  { icon: '💖', text: 'Pick up the hearts on the way' },
  { icon: '👋', text: 'Tap a sign to tell the other one' }
];

/** And for the games the two of you play at the same moment (core/duo). */
export const DUO_TOURS: Record<'bomb' | 'catch' | 'lamp' | 'dive' | 'space', TourLine[]> = {
  bomb: [
    { icon: '💣', text: 'One of you has the bomb, the other has the book' },
    { icon: '🏷️', text: 'Bomb: sign the shapes on its label' },
    { icon: '📖', text: 'Book: find the page with that label' },
    { icon: '✂️', text: 'Book signs the wires. Bomb cuts them, in order' },
    { icon: '❌', text: 'Three mistakes, or no time left, and it goes off' },
    { icon: '🔁', text: 'You swap every level' }
  ],
  catch: [
    { icon: '🤝', text: 'You each hold one end of the net' },
    { icon: '👆', text: 'Slide your finger to move your end' },
    { icon: '⭐', text: 'Catch stars and hearts between you' },
    { icon: '💣', text: 'Keep bombs out: close up or step aside' },
    { icon: '❤️', text: 'Three bombs in the net ends the round' }
  ],
  lamp: [
    { icon: '🏮', text: 'One carries the lamp. Walls stop them' },
    { icon: '👤', text: 'The other is a shadow, and walks through walls' },
    { icon: '💡', text: 'The shadow can only step where the light falls' },
    { icon: '🔑', text: 'Shadow: fetch the key to open a gate' },
    { icon: '🚪', text: 'Get both of you to the door' },
    { icon: '🔁', text: 'You swap every level' }
  ],
  dive: [
    { icon: '🤿', text: 'One of you dives, the other stays on the boat' },
    { icon: '🌫️', text: 'Diver: the water is murky. You see only beside you' },
    { icon: '🗺️', text: 'Boat: you have the chart. Sign arrows to guide' },
    { icon: '🌀', text: 'Only the boat sees the currents. They cost air' },
    { icon: '💰', text: 'Get every chest, then back up to the anchor' },
    { icon: '🫧', text: 'Boat: send more air down when it runs low' }
  ],
  space: [
    { icon: '🚀', text: 'One of you flies, the other is on the guns' },
    { icon: '👆', text: 'Pilot: slide your finger to steer' },
    { icon: '☄️', text: 'Guns: tap a rock to shoot it. Big ones take two' },
    { icon: '⭐', text: 'Pilot: fly under the stars and the repair kits' },
    { icon: '🛡️', text: 'Three rocks into the ship ends the round' },
    { icon: '🔁', text: 'You swap seats every round' }
  ]
};

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
type TourKey = PaperKind | typeof HOMES_TOUR_KEY | typeof MAZE_TOUR_KEY | keyof typeof DUO_TOURS;
export const tourSeen = (kind: TourKey) => thisTime.has(kind) || saved().includes(kind);

export function markTourSeen(kind: TourKey) {
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
