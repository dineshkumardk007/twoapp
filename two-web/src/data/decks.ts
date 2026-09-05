export interface DeckCard {
  id: string;
  prompt: string;
  subtext?: string;
}

export interface ConversationDeck {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  cards: DeckCard[];
}

export const CONVERSATION_DECKS: ConversationDeck[] = [
  {
    id: 'deck-know-me',
    title: 'How Well Do You Know Me?',
    description: 'Playful prompts testing your intuitive knowledge of your partner’s inner world.',
    icon: 'Brain',
    color: 'text-linen-accent',
    cards: [
      { id: 'km-1', prompt: 'What is my favorite sensory memory of us from this past year?' },
      { id: 'km-2', prompt: 'When I am quietly stressed, what is the very first physical tell I exhibit?' },
      { id: 'km-3', prompt: 'If I could suddenly take a three-month sabbatical to master any craft, what would I choose?' },
      { id: 'km-4', prompt: 'What is a small, irrational fear I have that always makes you smile?' },
      { id: 'km-5', prompt: 'What would my ideal lazy Sunday morning look like down to the exact beverage and breakfast?' },
      { id: 'km-6', prompt: 'What is a song that instantly reminds you of me when it plays unexpectedly?' },
      { id: 'km-7', prompt: 'If I could replay one single day from our entire relationship, which day do you think I would pick?' },
      { id: 'km-8', prompt: 'What is a compliment you gave me that I visibly cherished the most?' }
    ]
  },
  {
    id: 'deck-vulnerability',
    title: 'Vulnerability & Soft Spots',
    description: 'Gentle, tender questions to explore emotional safety and unspoken feelings.',
    icon: 'Heart',
    color: 'text-rose-600',
    cards: [
      { id: 'vs-1', prompt: 'What is something you find hard to ask for in our relationship, even though you trust me?' },
      { id: 'vs-2', prompt: 'When do you feel most emotionally vulnerable or exposed around me?' },
      { id: 'vs-3', prompt: 'What is an insecure thought you sometimes battle that you wish I could dispel for you?' },
      { id: 'vs-4', prompt: 'In what ways do you feel you have grown softer or more open since we began sharing life?' },
      { id: 'vs-5', prompt: 'What is an emotional boundary you had to learn the hard way before we met?' },
      { id: 'vs-6', prompt: 'What does genuine emotional safety feel like in your chest and shoulders when we are together?' },
      { id: 'vs-7', prompt: 'What is something you wish I noticed without you having to point it out?' },
      { id: 'vs-8', prompt: 'If you could give your younger self one reassurance about love, what would it be?' }
    ]
  },
  {
    id: 'deck-future',
    title: 'Future Visions & Shared Dreams',
    description: 'Aligning on life design, home, creative aspirations, and growing old together.',
    icon: 'Compass',
    color: 'text-amber-600',
    cards: [
      { id: 'fv-1', prompt: 'What is one tradition or ritual you want us to invent and practice together every year?' },
      { id: 'fv-2', prompt: 'When we are 75 years old sitting on a quiet porch, what do you hope we look back on and laugh about?' },
      { id: 'fv-3', prompt: 'What kind of home environment do you want us to cultivate for anyone who walks through our door?' },
      { id: 'fv-4', prompt: 'What is a bold, slightly frightening adventure you still want to embark on with me?' },
      { id: 'fv-5', prompt: 'How do you hope our communication deepens over the next five years?' },
      { id: 'fv-6', prompt: 'What is a skill or shared project you want us to build with our hands together?' },
      { id: 'fv-7', prompt: 'If we could take a one-year sabbatical living in a coastal village or mountain cabin, where would we go?' },
      { id: 'fv-8', prompt: 'What does a truly meaningful, successful life look like to you ten years from now?' }
    ]
  },
  {
    id: 'deck-touch',
    title: 'Sensory, Touch & Closeness',
    description: 'Affection, romantic intimacy, physical presence, and tender closeness.',
    icon: 'Sparkles',
    color: 'text-purple-600',
    cards: [
      { id: 'st-1', prompt: 'What is your favorite everyday physical touch from me (e.g. hand on lower back, head scratch, hug)?' },
      { id: 'st-2', prompt: 'How does your body immediately tell you when you are feeling touched-out vs. touch-starved?' },
      { id: 'st-3', prompt: 'What is a scent, fabric, or ambient light that instantly puts you in a romantic or relaxed mood?' },
      { id: 'st-4', prompt: 'Describe the feeling of our hugs when we haven’t seen each other all day.' },
      { id: 'st-5', prompt: 'What is a physical feature of mine you find yourself admiring when you think I’m not looking?' },
      { id: 'st-6', prompt: 'What kind of kiss speaks most directly to your heart: slow forehead, playful cheek, or lingering lips?' },
      { id: 'st-7', prompt: 'What does bedtime physical closeness look like for you when you are deeply exhausted?' },
      { id: 'st-8', prompt: 'What is something physical you want us to do more often (e.g. slow dancing in the kitchen, massage, long walks)?' }
    ]
  }
];
