// The kinds of heart you can send, and how each one feels arriving.
//
// Every heart used to arrive the same way - one chime, one double buzz - so a
// hug, a kiss and a heartbeat could not be told apart until the phone was out
// of the pocket and looked at. Each now has a sound and a buzz of its own.
//
// The kind travels in the PULSE record as `kind`. A phone on an older version
// passes over the field and feels every heart as it always has; a kind this
// phone does not know is felt as "thinking of you".
//
// How a buzz feels can only be judged on a real phone, in a hand: the patterns
// here are milliseconds of vibration and pause, as navigator.vibrate takes them.

import type { SoundName } from './sounds';

export type HeartKindId =
  | 'thinking_of_you'
  | 'warm_hug'
  | 'gentle_kiss'
  | 'holding_hands'
  | 'heartbeat_sync'
  | 'love_and_light'
  | 'goodnight_touch';

export interface HeartKind {
  id: HeartKindId;
  emoji: string;
  /** In the picker. */
  title: string;
  /** The words it carries, shown on the card when they say more than its title. */
  note: string;
  /** What it feels like arriving, said plainly - in the picker. */
  feels: string;
  /** The card on your partner's phone: their name, then this. */
  says: string;
  sound: SoundName;
  buzz: number[];
}

export const HEART_KINDS: readonly HeartKind[] = [
  {
    id: 'thinking_of_you',
    emoji: '💖',
    title: 'Thinking of you',
    note: 'Thinking of you right now',
    feels: 'A soft chime and a double buzz',
    says: 'is thinking of you',
    sound: 'gentle-chime',
    buzz: [60, 40, 60]
  },
  {
    id: 'warm_hug',
    emoji: '🫂',
    title: 'A warm hug',
    note: 'A long, warm hug across the distance',
    feels: 'One long, warm buzz and a deep bowl note',
    says: 'sent you a warm hug',
    sound: 'singing-bowl',
    buzz: [700]
  },
  {
    id: 'gentle_kiss',
    emoji: '💋',
    title: 'A gentle kiss',
    note: 'A soft, gentle kiss on your forehead',
    feels: 'Two quick flutters',
    says: 'sent you a gentle kiss',
    sound: 'kiss',
    buzz: [20, 80, 20]
  },
  {
    id: 'holding_hands',
    emoji: '🤝',
    title: 'Holding your hand',
    note: 'Holding your hand quietly. I am right here',
    feels: 'Two slow, steady presses',
    says: 'is holding your hand',
    sound: 'presence',
    buzz: [250, 200, 250]
  },
  {
    id: 'heartbeat_sync',
    emoji: '💓',
    title: 'My heartbeat',
    note: 'Our hearts beating as one',
    feels: 'A heartbeat - lub-dub, lub-dub',
    says: 'sent you their heartbeat',
    sound: 'heartbeat',
    buzz: [80, 120, 50, 600, 80, 120, 50]
  },
  {
    id: 'love_and_light',
    emoji: '✨',
    title: 'Love and peace',
    note: 'Sending you gentle love, peace and warmth',
    feels: 'A light shimmer of small buzzes',
    says: 'is sending you love and peace',
    sound: 'sunlight',
    buzz: [30, 60, 30, 60, 30, 60, 30]
  },
  {
    id: 'goodnight_touch',
    emoji: '🌙',
    title: 'Goodnight',
    note: 'Goodnight, my love. Sweet dreams',
    feels: 'A slow buzz that fades out',
    says: 'says goodnight',
    sound: 'breath-rest',
    buzz: [200, 250, 90]
  }
];

const BY_ID = new Map<string, HeartKind>(HEART_KINDS.map(k => [k.id, k]));

/** The plain heart, as every heart felt before kinds. */
export const PLAIN_HEART = HEART_KINDS[0];

/** The kind a PULSE says it is; the plain heart when it says nothing this phone knows. */
export function heartKind(raw: unknown): HeartKind {
  return (typeof raw === 'string' && BY_ID.get(raw)) || PLAIN_HEART;
}

/** Two hearts that crossed on the way: two heartbeats, the one moment that feels like no other. */
export const SAME_MOMENT_BUZZ = [60, 40, 60, 180, 60, 40, 60];
