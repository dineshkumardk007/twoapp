import {
  EmotionalReport,
  ChatMessage,
  JournalEntry,
  AgreementItem,
  ListItem,
  ChoreItem,
  ExpenseItem,
  QuoteItem,
  ConsentLog,
  CycleRecord,
  CycleSharingLevel,
  RitualItem,
  PebbleStone,
  LoveLetter,
  AdventureItem,
  RelationshipMilestone,
  GratitudeStar,
  CareCompassProfile,
  ComfortBoxData,
  SecretRecipe,
  IntuitionGameRound,
  TimeCapsuleItem
} from '../types';

const STORAGE_KEY = 'two_encrypted_vault_state';

export interface SpaceState {
  isPaired: boolean;
  activeUser: 'user' | 'partner';
  userReport: EmotionalReport;
  partnerReport: EmotionalReport;
  messages: ChatMessage[];
  journalEntries: JournalEntry[];
  agreements: AgreementItem[];
  lists: ListItem[];
  chores: ChoreItem[];
  expenses: ExpenseItem[];
  quotes: QuoteItem[];
  consentLogs: ConsentLog[];
  cycleRecords: CycleRecord[];
  cycleSharingLevel: CycleSharingLevel;
  rituals: RitualItem[];
  pebbles: PebbleStone[];
  letters: LoveLetter[];
  adventures: AdventureItem[];
  milestones: RelationshipMilestone[];
  constellationStars: GratitudeStar[];
  careCompass: { user: CareCompassProfile; partner: CareCompassProfile };
  comfortBoxes: ComfortBoxData[];
  recipes: SecretRecipe[];
  intuitionRounds: IntuitionGameRound[];
  timeCapsules: TimeCapsuleItem[];
}

const DEFAULT_STATE: SpaceState = {
  isPaired: true,
  activeUser: 'user',
  userReport: {
    weather: 'CALM',
    capacity: 4,
    notAboutYouActive: false,
    updatedAt: 'Today, 2:00 PM'
  },
  partnerReport: {
    weather: 'RAINY',
    capacity: 1,
    notAboutYouActive: true,
    updatedAt: 'Today, 1:15 PM'
  },
  messages: [
    {
      id: '1',
      authorId: 'partner',
      authorName: 'Partner',
      text: 'Hey love, how is your afternoon going?',
      timestamp: '2:15 PM'
    },
    {
      id: '2',
      authorId: 'user',
      authorName: 'You',
      text: 'Taking a deep breath after a busy meeting. Loved our morning coffee.',
      timestamp: '2:18 PM'
    },
    {
      id: '3',
      authorId: 'partner',
      authorName: 'Partner',
      text: 'Thinking of you. Take all the time you need today.',
      timestamp: '2:20 PM'
    }
  ],
  journalEntries: [
    {
      id: '1',
      authorId: 'partner',
      authorName: 'Partner',
      title: 'A quiet sunrise',
      content: 'Woke up early and listened to the rain against the window pane. Felt very grateful for our calm home.',
      date: 'Yesterday',
      isPrivate: false
    },
    {
      id: '2',
      authorId: 'user',
      authorName: 'You',
      title: 'Processing end-of-week burnout',
      content: 'Work felt overwhelming today. Writing it down here privately so I don’t bring short-tempered energy to dinner tonight.',
      date: 'Today',
      isPrivate: true
    }
  ],
  agreements: [
    {
      id: '1',
      title: 'Handling low capacity after work',
      trigger: 'When one partner enters with emotional capacity 1/5',
      resolution: 'We grant a 45-minute decompression buffer with zero logistical questioning.',
      date: 'Last month'
    }
  ],
  lists: [
    {
      id: '1',
      title: 'Weekend pottery workshop',
      isCompleted: false,
      isHiddenFromPartner: false,
      addedBy: 'partner'
    },
    {
      id: '2',
      title: 'Watch the animated Japanese feature',
      isCompleted: true,
      isHiddenFromPartner: false,
      addedBy: 'user'
    },
    {
      id: '3',
      title: 'Surprise weekend cabin trip booking',
      isCompleted: false,
      isHiddenFromPartner: true, // Hidden surprise gift!
      addedBy: 'user'
    }
  ],
  chores: [
    {
      id: '1',
      task: 'Book car seasonal service',
      rememberedBy: 'You',
      executedBy: 'Partner'
    },
    {
      id: '2',
      task: 'Plan weekly dinners & ingredients',
      rememberedBy: 'Partner',
      executedBy: 'You'
    },
    {
      id: '3',
      task: 'Order refill on pet medication',
      rememberedBy: 'You',
      executedBy: 'You'
    }
  ],
  expenses: [
    {
      id: '1',
      title: 'Farmers market produce & olive oil',
      amount: 48.50,
      paidBy: 'You',
      date: 'Saturday'
    },
    {
      id: '2',
      title: 'Electricity & heating utility',
      amount: 92.00,
      paidBy: 'Partner',
      date: 'Tuesday'
    }
  ],
  quotes: [
    {
      id: '1',
      quote: 'Whatever our souls are made of, his and mine are the same.',
      author: 'Emily Brontë'
    },
    {
      id: '2',
      quote: 'To be fully seen by somebody, then, and be loved anyhow—this is a human offering that can border on miraculous.',
      author: 'Elizabeth Gilbert'
    },
    {
      id: '3',
      quote: 'Don’t forget to drink water today. You are doing so much better than you realize.',
      author: 'Partner',
      isCustom: true
    }
  ],
  consentLogs: [
    {
      id: '1',
      kind: 'location',
      action: 'revoke',
      details: 'Time-boxed 1-hour location ping expired',
      timestamp: 'Today, 1:00 PM'
    },
    {
      id: '2',
      kind: 'cycle',
      action: 'grant',
      details: 'Phase sharing updated to: Luteal Phase (Low Bandwidth)',
      timestamp: 'Yesterday'
    },
    {
      id: '3',
      kind: 'export',
      action: 'access',
      details: 'Local encrypted database backup exported to JSON',
      timestamp: '3 days ago'
    }
  ],
  cycleSharingLevel: 'phase_and_energy',
  cycleRecords: [
    {
      id: 'cr-1',
      dayOfCycle: 22,
      phase: 'LUTEAL',
      energyLevel: 2,
      mood: 'Introspective & Sensitive',
      symptoms: ['Mild fatigue', 'Lower back soreness', 'Need quiet downtime'],
      privateNotes: 'Cortisol feels a bit sensitive today. Appreciated partner offering to handle dinner.',
      loggedDate: 'Today'
    },
    {
      id: 'cr-2',
      dayOfCycle: 14,
      phase: 'OVULATORY',
      energyLevel: 5,
      mood: 'Radiant & Expressive',
      symptoms: ['High energy', 'Social'],
      loggedDate: '8 days ago'
    },
    {
      id: 'cr-3',
      dayOfCycle: 7,
      phase: 'FOLLICULAR',
      energyLevel: 4,
      mood: 'Clear-headed & Motivated',
      symptoms: ['Creative flow'],
      loggedDate: '15 days ago'
    }
  ],
  rituals: [
    {
      id: 'r-1',
      title: 'The 6-Second Kiss',
      subtitle: 'Oxytocin reunion reset before opening laptops or tasks',
      duration: '6 seconds',
      category: 'affection',
      completedTodayByUser: true,
      completedTodayByPartner: true,
      streakDays: 14
    },
    {
      id: 'r-2',
      title: 'Morning Silence & Tea',
      subtitle: 'Gentle shared presence before outside notifications start',
      duration: '10 mins',
      category: 'presence',
      completedTodayByUser: true,
      completedTodayByPartner: false,
      streakDays: 8
    },
    {
      id: 'r-3',
      title: 'Workday Boundary Walk',
      subtitle: '10-minute transition stroll to leave work baggage outside',
      duration: '10 mins',
      category: 'presence',
      completedTodayByUser: false,
      completedTodayByPartner: false,
      streakDays: 5
    },
    {
      id: 'r-4',
      title: 'Pillow Talk Gratitude Whisper',
      subtitle: 'One specific, quiet detail appreciated about each other',
      duration: '2 mins',
      category: 'reflection',
      completedTodayByUser: false,
      completedTodayByPartner: false,
      streakDays: 21
    },
    {
      id: 'r-5',
      title: 'Weekly Phone-Free Date Hour',
      subtitle: 'Protected uninterrupted face-to-face dinner or tea',
      duration: '60 mins',
      category: 'play',
      completedTodayByUser: true,
      completedTodayByPartner: true,
      streakDays: 4
    }
  ],
  pebbles: [
    { id: 'peb-1', color: '#D4A373', size: 100, height: 26, rotation: -1, placedAt: 'Today', ritualTitle: 'The 6-Second Kiss' },
    { id: 'peb-2', color: '#B5A895', size: 88, height: 24, rotation: 2, placedAt: 'Today', ritualTitle: 'Morning Silence & Tea' },
    { id: 'peb-3', color: '#C48B71', size: 76, height: 22, rotation: -2, placedAt: 'Yesterday', ritualTitle: 'The 6-Second Kiss' },
    { id: 'peb-4', color: '#8F9E8B', size: 66, height: 20, rotation: 1, placedAt: 'Yesterday', ritualTitle: 'Pillow Talk Gratitude Whisper' },
    { id: 'peb-5', color: '#938581', size: 54, height: 18, rotation: 3, placedAt: '2 days ago', ritualTitle: 'Workday Boundary Walk' },
    { id: 'peb-6', color: '#C9ADA7', size: 42, height: 16, rotation: -1, placedAt: '2 days ago', ritualTitle: 'The 6-Second Kiss' }
  ],
  letters: [
    {
      id: 'let-1',
      authorId: 'partner',
      authorName: 'Partner',
      title: 'For Our Next Rainy Sunday Morning',
      body: 'When the rain taps our bedroom window and the kettle starts to whistle, wrap yourself in the olive wool blanket. I want you to know that building this calm life with you has been the single greatest anchor of my days. Take your time getting out of bed today.',
      waxColor: 'gold',
      conditionType: 'night',
      conditionDetail: 'Open on a quiet rainy morning with warm tea',
      sentDate: 'Yesterday',
      isOpened: false
    },
    {
      id: 'let-2',
      authorId: 'user',
      authorName: 'You',
      title: 'A Little Note from 30,000 Feet',
      body: 'Looking down at the patchwork of city lights through the tiny airplane window and thinking about our slow coffee together this morning. Counting down the hours until I can hold your hand again.',
      waxColor: 'burgundy',
      conditionType: 'travel',
      conditionDetail: 'Open when missing each other',
      sentDate: 'Last week',
      isOpened: true,
      openedDate: 'Last week'
    }
  ],
  adventures: [
    {
      id: 'adv-1',
      title: 'Living Room Blanket Fort & Vinyl Night',
      description: 'Build an elaborate blanket fort with couch cushions and string lights. Listen to a full album from start to finish in the dark without checking phones.',
      energyTier: 'low',
      category: 'home',
      estimatedCost: 'Free',
      season: 'winter',
      location: 'Living Room Hearth',
      isCompleted: true,
      completedDate: 'Autumn 2025',
      personalNotes: 'We played Rumours on vinyl, wrapped in three blankets, and drank chamomile tea.'
    },
    {
      id: 'adv-2',
      title: 'Dark Chocolate & Tea Tasting Flight',
      description: 'Gather 3 different single-origin dark chocolates and 3 herbal teas. Conduct a sensory tasting together, blindfolding each other.',
      energyTier: 'low',
      category: 'home',
      estimatedCost: '$',
      season: 'anytime',
      location: 'Kitchen Island',
      isCompleted: false
    },
    {
      id: 'adv-3',
      title: 'Cook a 3-Course Feast from a New Country',
      description: 'Pick a nation neither of us has ever visited. Spend the afternoon finding special spices and cooking traditional recipes together with regional music playing.',
      energyTier: 'medium',
      category: 'food',
      estimatedCost: '$$',
      season: 'fall',
      location: 'Our Kitchen',
      isCompleted: false
    },
    {
      id: 'adv-4',
      title: 'Thrift Store $10 Outfit Challenge',
      description: 'Head to a local vintage shop with a strict $10 budget each. Pick out an outfit for each other to wear directly to dinner tonight.',
      energyTier: 'medium',
      category: 'creative',
      estimatedCost: '$',
      season: 'spring',
      location: 'Vintage Alley',
      isCompleted: false
    },
    {
      id: 'adv-5',
      title: 'Midnight Stargazing Drive with Hot Cider',
      description: 'Drive 30 minutes outside city lights with two thermoses of warm cinnamon apple cider and a thick blanket. Stargaze from the car hood.',
      energyTier: 'high',
      category: 'outdoors',
      estimatedCost: '$',
      season: 'fall',
      location: 'Pine Crest Ridge',
      isCompleted: false
    },
    {
      id: 'adv-6',
      title: 'Sunrise Breakfast Picnic at the Overlook',
      description: 'Set alarms before dawn, bundle into sweaters, grab fresh bakery croissants, and watch the sun break over the horizon together.',
      energyTier: 'high',
      category: 'outdoors',
      estimatedCost: '$',
      season: 'summer',
      location: 'Eastern Bluffs',
      isCompleted: false
    },
    {
      id: 'adv-7',
      title: 'Aurora Borealis in a Glass Igloo',
      description: 'Fall asleep under a ceiling of pure starlight and dancing green northern lights while a wood fire crackles in Lapland.',
      energyTier: 'high',
      category: 'outdoors',
      estimatedCost: '$$',
      season: 'winter',
      location: 'Lapland, Finland',
      isCompleted: false
    },
    {
      id: 'adv-8',
      title: 'Tuscan Farmhouse Handmade Pasta Workshop',
      description: 'Spend an afternoon rolling fresh tagliatelle and ravioli from scratch with a local nonna, sipping Chianti overlooking rolling vineyards.',
      energyTier: 'medium',
      category: 'food',
      estimatedCost: '$$',
      season: 'summer',
      location: 'Val d’Orcia, Tuscany',
      isCompleted: false
    }
  ],
  milestones: [
    {
      id: 'ms-1',
      title: 'The First Rainy Coffee',
      date: 'April 18, 2022',
      category: 'first',
      description: 'The little corner table at the botanical café where three hours flew by like three minutes.'
    },
    {
      id: 'ms-2',
      title: 'Keys to Our First Apartment',
      date: 'September 1, 2023',
      category: 'home',
      description: 'Sitting on packing boxes eating takeout dumplings on our first night in the quiet living room.'
    },
    {
      id: 'ms-3',
      title: 'Adopting Barnaby',
      date: 'November 20, 2024',
      category: 'growth',
      description: 'Bringing our little rescue dog home and watching him fall asleep between us on the rug.'
    },
    {
      id: 'ms-4',
      title: 'Our 4th Anniversary',
      date: 'October 14, 2026',
      category: 'commitment',
      description: 'Four years of choosing each other every single morning with gentleness and humor.'
    }
  ],
  constellationStars: [
    {
      id: 'star-1',
      authorId: 'user',
      authorName: 'You',
      note: 'The way you remembered to put oat milk in my travel mug before my big morning call.',
      category: 'mornings',
      x: 25,
      y: 35,
      magnitude: 2,
      createdAt: '2026-09-01T08:30:00Z'
    },
    {
      id: 'star-2',
      authorId: 'partner',
      authorName: 'Partner',
      note: 'Holding my hand quietly under the table when my anxiety started rising at dinner.',
      category: 'support',
      x: 48,
      y: 28,
      magnitude: 3,
      createdAt: '2026-09-02T20:15:00Z'
    },
    {
      id: 'star-3',
      authorId: 'user',
      authorName: 'You',
      note: 'Our uncontrollable laughing fit trying to fold that fitted sheet together.',
      category: 'laughter',
      x: 70,
      y: 42,
      magnitude: 2,
      createdAt: '2026-09-03T16:45:00Z'
    },
    {
      id: 'star-4',
      authorId: 'partner',
      authorName: 'Partner',
      note: 'Waking up with your arm wrapped around me and breathing softly in my hair.',
      category: 'affection',
      x: 35,
      y: 68,
      magnitude: 3,
      createdAt: '2026-09-04T07:10:00Z'
    },
    {
      id: 'star-5',
      authorId: 'user',
      authorName: 'You',
      note: 'Talking about growing old together in a house with a sunroom full of ferns and books.',
      category: 'visions',
      x: 62,
      y: 72,
      magnitude: 3,
      createdAt: '2026-09-05T11:20:00Z'
    }
  ],
  careCompass: {
    user: {
      wordsOfAffirmation: 85,
      qualityTime: 90,
      actsOfService: 65,
      physicalTouch: 80,
      thoughtfulSurprises: 50,
      fuelTankPercent: 78,
      currentCravingNote: 'Quiet evening together without screens, just vinyl and talking.',
      updatedAt: 'Today'
    },
    partner: {
      wordsOfAffirmation: 95,
      qualityTime: 75,
      actsOfService: 85,
      physicalTouch: 60,
      thoughtfulSurprises: 45,
      fuelTankPercent: 42,
      currentCravingNote: 'Feeling depleted from work; craving verbal reassurance and gentle presence.',
      updatedAt: 'Today'
    }
  },
  comfortBoxes: [
    {
      id: 'cb-1',
      authorId: 'partner',
      authorName: 'Partner',
      reassuranceNote: 'Breathe, my love. You are more than enough. You don’t have to carry the whole world today. I am right here with you.',
      photoUrls: [
        'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&q=80',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'
      ],
      calmingExercise: '4-7-8',
      updatedAt: 'Yesterday'
    }
  ],
  recipes: [
    {
      id: 'rcp-1',
      title: 'Midnight Garlic Butter Ramen',
      story: 'The comforting meal we cooked at 1 AM the night we got stranded in the winter thunderstorm.',
      prepTime: '15 mins',
      servings: '2 bowls',
      comfortTag: 'quick_midnight',
      favoriteWineOrDrink: 'Chilled Jasmine Green Tea or Crisp Pilsner',
      ingredients: [
        { id: 'i1', name: '2 packs wavy ramen noodles', checked: true },
        { id: 'i2', name: '3 cloves garlic, finely grated', checked: true },
        { id: 'i3', name: '2 tbsp salted French butter', checked: false },
        { id: 'i4', name: '1 tbsp low-sodium soy sauce', checked: false },
        { id: 'i5', name: '2 soft-boiled jammy eggs', checked: true },
        { id: 'i6', name: 'Toasted sesame seeds & scallions', checked: false }
      ],
      steps: [
        'Boil ramen noodles for 3 minutes until al dente. Reserve 1/4 cup cooking water.',
        'Melt butter in skillet over low heat, gently fry grated garlic for 60 seconds until fragrant and golden.',
        'Toss noodles in garlic butter with soy sauce and a splash of noodle water.',
        'Top with halved jammy eggs, sesame seeds, and fresh scallions. Eat sitting on the rug.'
      ]
    },
    {
      id: 'rcp-2',
      title: 'Sunday Brioche French Toast',
      story: 'Our slow rainy morning tradition with vanilla, cinnamon, and espresso.',
      prepTime: '20 mins',
      servings: '2 plates',
      comfortTag: 'rainy_day',
      favoriteWineOrDrink: 'Fresh Oat Cappuccino with Nutmeg',
      ingredients: [
        { id: 'i7', name: '4 thick slices brioche bread', checked: true },
        { id: 'i8', name: '3 fresh pasture eggs', checked: true },
        { id: 'i9', name: '1/3 cup whole milk or cream', checked: false },
        { id: 'i10', name: '1 tsp pure vanilla bean paste', checked: true },
        { id: 'i11', name: 'Cinnamon & pure amber maple syrup', checked: false }
      ],
      steps: [
        'Whisk eggs, cream, vanilla paste, and cinnamon in a shallow bowl.',
        'Soak brioche slices for 40 seconds on each side.',
        'Sear in bubbling butter on cast iron until caramelized golden on both sides.',
        'Dust with powdered sugar and drizzle warm maple syrup.'
      ]
    }
  ],
  intuitionRounds: [
    {
      id: 'round-1',
      date: 'Today',
      authorId: 'partner',
      authorChoice: 'A',
      partnerGuess: undefined,
      revealed: false,
      dilemma: {
        id: 'dil-1',
        prompt: 'If we could drop everything and disappear together this Friday evening, what would we do?',
        optionA: 'Cabin in misty woods with a crackling fire and warm cider',
        optionB: 'Secret oceanside cottage listening to waves crash all night',
        optionC: 'Boutique hotel in a walkable city with late-night jazz & pasta',
        category: 'cozy'
      }
    }
  ],
  timeCapsules: [
    {
      id: 'capsule-1',
      title: 'To Our Next Milestone Anniversary',
      teaserHint: 'A private promise, three secret memories from our first month, and a surprise weekend getaway plan.',
      authorId: 'partner',
      authorName: 'Partner',
      createdAt: 'Recorded recently',
      unlockAt: Date.now() + 1000 * 60 * 60 * 24 * 45, // 45 days in future
      unlockDateFormatted: 'October 20, 2026',
      sealType: 'gold_key',
      content: 'If you are reading this, another beautiful year of quiet mornings, shared laughs, and gentle support has passed. Thank you for choosing me every single day through sunny and stormy weather alike. The secret getaway is booked: pack a cozy sweater and an overnight bag for the coast.',
      photoUrls: ['https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=800&q=80'],
      isOpened: false
    },
    {
      id: 'capsule-2',
      title: 'Sealed on the Night We Moved In Together',
      teaserHint: 'A handwritten letter written while eating takeout Thai food surrounded by taped cardboard boxes.',
      authorId: 'user',
      authorName: 'You',
      createdAt: '1 year ago',
      unlockAt: Date.now() - 1000 * 60 * 60 * 24 * 30, // Already unlocked
      unlockDateFormatted: 'Opened 1 month ago',
      sealType: 'wax_crest',
      content: 'We are sitting on the bare wooden floor eating noodles from paper cartons surrounded by mountains of cardboard boxes. The streetlights outside are flickering through the uncurtained windows. I looked across at you laughing with tape stuck to your sweater, and I knew with utter certainty: this is my home. Whatever years come next, I promise to keep this gentleness between us.',
      photoUrls: ['https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80'],
      isOpened: true,
      openedAt: Date.now() - 1000 * 60 * 60 * 24 * 30
    }
  ]
};

export function loadState(): SpaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      rituals: parsed.rituals || DEFAULT_STATE.rituals,
      pebbles: parsed.pebbles || DEFAULT_STATE.pebbles,
      letters: parsed.letters || DEFAULT_STATE.letters,
      adventures: parsed.adventures || DEFAULT_STATE.adventures,
      milestones: parsed.milestones || DEFAULT_STATE.milestones,
      constellationStars: parsed.constellationStars || DEFAULT_STATE.constellationStars,
      careCompass: parsed.careCompass || DEFAULT_STATE.careCompass,
      comfortBoxes: parsed.comfortBoxes || DEFAULT_STATE.comfortBoxes,
      recipes: parsed.recipes || DEFAULT_STATE.recipes,
      intuitionRounds: parsed.intuitionRounds || DEFAULT_STATE.intuitionRounds,
      timeCapsules: parsed.timeCapsules || DEFAULT_STATE.timeCapsules,
    };
  } catch (e) {
    return DEFAULT_STATE;
  }
}

export function saveState(state: SpaceState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Storage error', e);
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
