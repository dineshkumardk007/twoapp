// The intuition game's question bank.
//
// Lifted out of IntuitionGameView so App can seed a round from it without
// importing the view, which would pull that whole screen into the first load
// and undo its code split.
import { IntuitionDilemma } from '../types';

export const CURATED_DILEMMAS: IntuitionDilemma[] = [
  {
    id: 'dil-1',
    prompt: 'If we could drop everything and disappear together this Friday evening, what would we do?',
    optionA: 'Cabin in misty woods with a crackling fire and warm cider',
    optionB: 'Secret oceanside cottage listening to waves crash all night',
    optionC: 'Boutique hotel in a walkable city with late-night jazz & pasta',
    category: 'cozy'
  },
  {
    id: 'dil-2',
    prompt: 'What nostalgic comfort food would instantly turn an exhausting day around for me?',
    optionA: 'Warm sourdough toast with salted butter & honey',
    optionB: 'A huge bowl of piping-hot garlic ramen with jammy eggs',
    optionC: 'Fresh warm chocolate chip cookies straight out of the oven',
    category: 'cozy'
  },
  {
    id: 'dil-3',
    prompt: 'If we were granted one magical superpower for our home, which would you pick?',
    optionA: 'Self-cleaning kitchen counters & dishes in 1 second',
    optionB: 'A secret doorway that opens directly to any quiet beach',
    optionC: 'An enchanted bed where 5 hours of sleep feels like 10 hours of deep rest',
    category: 'dream'
  },
  {
    id: 'dil-4',
    prompt: 'Which spontaneous date night spark would make you smile most this week?',
    optionA: 'Living room blanket fort with fairy lights and our favorite animated movie',
    optionB: 'Midnight stargazing drive into the hills with hot thermoses',
    optionC: 'A $15 supermarket challenge where we each pick 3 wild ingredients to cook',
    category: 'spontaneous'
  },
  {
    id: 'dil-5',
    prompt: 'If we could wake up tomorrow with an eccentric shared hobby, what would it be?',
    optionA: 'Wheel-thrown pottery and making our own morning ceramic mugs',
    optionB: 'Midnight stargazing with a high-powered telescope and field notebook',
    optionC: 'Baking artisanal sourdough and trading loaves with neighbors',
    category: 'quirky'
  },
  {
    id: 'dil-6',
    prompt: 'What is our ultimate rainy Sunday energy?',
    optionA: 'Never leaving bed until 2 PM with coffee and reading books aloud',
    optionB: 'Simmering a 4-hour pot of stew while classic vinyl records play',
    optionC: 'Putting on rain boots, splashing through puddles, and getting warm pastries',
    category: 'cozy'
  }
];
