import { WeatherState } from '../types';

export interface LiteraryQuote {
  id: string;
  quote: string;
  author: string;
  source?: string;
  targetWeather: WeatherState[];
  maxCapacityThreshold?: number; // Resurface if capacity <= this number
}

export const LITERARY_QUOTES: LiteraryQuote[] = [
  // --- LOW CAPACITY / RESTORATIVE / GENTLE CARE (Capacity 0-2 / Overcast / Rainy / Stormy) ---
  {
    id: 'lq-1',
    quote: 'Let everything happen to you: beauty and terror. Just keep going. No feeling is final.',
    author: 'Rainer Maria Rilke',
    source: 'Book of Hours',
    targetWeather: ['RAINY', 'STORMY', 'OVERCAST'],
    maxCapacityThreshold: 2
  },
  {
    id: 'lq-2',
    quote: 'There is a crack in everything. That’s how the light gets in.',
    author: 'Leonard Cohen',
    targetWeather: ['RAINY', 'OVERCAST'],
    maxCapacityThreshold: 2
  },
  {
    id: 'lq-3',
    quote: 'Hope is the thing with feathers that perches in the soul, and sings the tune without the words, and never stops at all.',
    author: 'Emily Dickinson',
    targetWeather: ['RAINY', 'STORMY', 'OVERCAST'],
    maxCapacityThreshold: 2
  },
  {
    id: 'lq-4',
    quote: 'I love you not only for what you are, but for what I am when I am with you.',
    author: 'Elizabeth Barrett Browning',
    targetWeather: ['OVERCAST', 'CALM'],
    maxCapacityThreshold: 3
  },
  {
    id: 'lq-5',
    quote: 'You do not have to be good. You do not have to walk on your knees for a hundred miles through the desert repenting. You only have to let the soft animal of your body love what it loves.',
    author: 'Mary Oliver',
    source: 'Wild Geese',
    targetWeather: ['RAINY', 'STORMY', 'OVERCAST'],
    maxCapacityThreshold: 2
  },
  {
    id: 'lq-6',
    quote: 'In the depth of winter, I finally learned that within me there lay an invincible summer.',
    author: 'Albert Camus',
    targetWeather: ['STORMY', 'RAINY'],
    maxCapacityThreshold: 1
  },
  {
    id: 'lq-7',
    quote: 'We are all travelers in the wilderness of this world, and the best that we can find in our travels is an honest friend.',
    author: 'Robert Louis Stevenson',
    targetWeather: ['OVERCAST', 'CALM'],
    maxCapacityThreshold: 3
  },
  {
    id: 'lq-8',
    quote: 'To love and be loved is to feel the sun from both sides.',
    author: 'David Viscott',
    targetWeather: ['CALM', 'SUNNY'],
    maxCapacityThreshold: 5
  },
  {
    id: 'lq-9',
    quote: 'Love does not consist in gazing at each other, but in looking outward together in the same direction.',
    author: 'Antoine de Saint-Exupéry',
    source: 'Wind, Sand and Stars',
    targetWeather: ['CALM', 'SUNNY'],
    maxCapacityThreshold: 5
  },
  {
    id: 'lq-10',
    quote: 'For you, a thousand times over.',
    author: 'Khaled Hosseini',
    targetWeather: ['OVERCAST', 'CALM'],
    maxCapacityThreshold: 3
  },
  {
    id: 'lq-11',
    quote: 'What is done in love is done well.',
    author: 'Vincent van Gogh',
    targetWeather: ['CALM', 'SUNNY'],
    maxCapacityThreshold: 5
  },
  {
    id: 'lq-12',
    quote: 'Whatever our souls are made of, his and mine are the same.',
    author: 'Emily Brontë',
    source: 'Wuthering Heights',
    targetWeather: ['CALM', 'OVERCAST'],
    maxCapacityThreshold: 4
  },
  {
    id: 'lq-13',
    quote: 'It is a narrow mind which cannot look at a subject from various points of view.',
    author: 'George Eliot',
    source: 'Middlemarch',
    targetWeather: ['OVERCAST', 'CALM'],
    maxCapacityThreshold: 3
  },
  {
    id: 'lq-14',
    quote: 'I wish you to know that you have been the last dream of my soul.',
    author: 'Charles Dickens',
    source: 'A Tale of Two Cities',
    targetWeather: ['CALM', 'SUNNY'],
    maxCapacityThreshold: 5
  },
  {
    id: 'lq-15',
    quote: 'There is no charm equal to tenderness of heart.',
    author: 'Jane Austen',
    source: 'Emma',
    targetWeather: ['CALM', 'RAINY'],
    maxCapacityThreshold: 3
  },
  {
    id: 'lq-16',
    quote: 'Let there be spaces in your togetherness, and let the winds of the heavens dance between you.',
    author: 'Kahlil Gibran',
    source: 'The Prophet',
    targetWeather: ['CALM', 'OVERCAST'],
    maxCapacityThreshold: 4
  },
  {
    id: 'lq-17',
    quote: 'I would rather share one lifetime with you than face all the ages of this world alone.',
    author: 'J.R.R. Tolkien',
    source: 'The Fellowship of the Ring',
    targetWeather: ['CALM', 'SUNNY'],
    maxCapacityThreshold: 5
  },
  {
    id: 'lq-18',
    quote: 'To be fully seen by somebody, then, and be loved anyhow—this is a human offering that can border on miraculous.',
    author: 'Elizabeth Gilbert',
    targetWeather: ['CALM', 'OVERCAST'],
    maxCapacityThreshold: 4
  },
  {
    id: 'lq-19',
    quote: 'We loved with a love that was more than love.',
    author: 'Edgar Allan Poe',
    source: 'Annabel Lee',
    targetWeather: ['CALM', 'SUNNY'],
    maxCapacityThreshold: 5
  },
  {
    id: 'lq-20',
    quote: 'I carry your heart with me (I carry it in my heart).',
    author: 'E.E. Cummings',
    targetWeather: ['CALM', 'SUNNY'],
    maxCapacityThreshold: 5
  },
  {
    id: 'lq-21',
    quote: 'The soul should always stand ajar, ready to welcome the ecstatic experience.',
    author: 'Emily Dickinson',
    targetWeather: ['SUNNY', 'CALM'],
    maxCapacityThreshold: 5
  },
  {
    id: 'lq-22',
    quote: 'The best thing to hold onto in life is each other.',
    author: 'Audrey Hepburn',
    targetWeather: ['RAINY', 'OVERCAST', 'CALM'],
    maxCapacityThreshold: 2
  },
  {
    id: 'lq-23',
    quote: 'You have bewitched me, body and soul, and I love, I love, I love you.',
    author: 'Jane Austen',
    source: 'Pride and Prejudice',
    targetWeather: ['SUNNY', 'CALM'],
    maxCapacityThreshold: 5
  },
  {
    id: 'lq-24',
    quote: 'Be soft. Do not let the world make you hard. Do not let pain make you hate. Do not let the bitterness steal your sweetness.',
    author: 'Iain S. Thomas',
    targetWeather: ['RAINY', 'STORMY'],
    maxCapacityThreshold: 1
  },
  {
    id: 'lq-25',
    quote: 'Two souls with but a single thought, two hearts that beat as one.',
    author: 'John Keats',
    targetWeather: ['CALM', 'SUNNY'],
    maxCapacityThreshold: 5
  }
];

export function getResurfacedQuote(weather: WeatherState, capacity: number): LiteraryQuote {
  // Find quotes matching current weather or low capacity
  const matching = LITERARY_QUOTES.filter(q => {
    if (capacity <= 2 && q.maxCapacityThreshold && q.maxCapacityThreshold <= 2) return true;
    return q.targetWeather.includes(weather);
  });

  if (matching.length === 0) return LITERARY_QUOTES[0];
  const idx = Math.floor(Math.random() * matching.length);
  return matching[idx];
}
