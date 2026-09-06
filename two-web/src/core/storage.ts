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
  TimeCapsuleItem,
  ScratchCardItem,
  HearthGardenState,
  SoftLandingSession,
  WhisperMemoItem,
  NightstandState,
  MemoryCoordinatePin,
  MidnightRadioState,
  RadioWhisper,
  StateOfUnionSession,
  SharedDrawingCanvasState,
  DrawStroke,
  RepairLetter,
  KintsugiVesselItem
} from '../types';
import { loadSpaceSession } from './space';
import { externalizeMedia, persistMedia } from './media';
import { newId } from './ids';

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
  scratchCards: ScratchCardItem[];
  hearthGarden: HearthGardenState;
  activeSoftLanding: SoftLandingSession | null;
  softLandingHistory: SoftLandingSession[];
  whisperMemos: WhisperMemoItem[];
  nightstand: NightstandState;
  coordinatePins: MemoryCoordinatePin[];
  midnightRadio: MidnightRadioState;
  activeStateOfUnion: StateOfUnionSession | null;
  stateOfUnionHistory: StateOfUnionSession[];
  sharedCanvas: SharedDrawingCanvasState;
  repairLetters: RepairLetter[];
  kintsugiMoments: KintsugiVesselItem[];
  userName: string;
  partnerName: string;
  /** Whether PIN protection is on. The PIN itself lives nowhere - see core/vault.ts. */
  pinEnabled: boolean;
  /**
   * What the couple named their space, shown in the header so both know whose
   * sanctuary they are in. Synced as an encrypted record like everything else,
   * so the relay never learns it.
   */
  vaultName: string;
  /**
   * Newest message sentAt the partner has confirmed reading.
   *
   * A single watermark rather than a flag per message: one small record covers
   * an entire backlog, instead of storing hundreds of receipts on the relay
   * forever.
   */
  partnerReadAt: number;
  /**
   * True once anything has ever arrived from the partner.
   *
   * A space with an account but no partner looks identical to a broken one:
   * everything connects, nothing syncs. This is what lets the app say which it
   * is instead of leaving you guessing.
   */
  partnerEverSeen: boolean;
  /**
   * Devices this space has been told about, and whether you have vouched for
   * them.
   *
   * Advisory, not a gate: anyone holding the link code can decrypt regardless
   * and could assert any id they like. Its job is to make an unexpected device
   * visible and give you a reason to rotate the code - which is the only thing
   * that actually shuts someone out.
   */
  knownDevices: KnownDevice[];
  /** How many devices you have accepted as legitimately in this space. */
  approvedDeviceCount: number;
}

const DEFAULT_STATE: SpaceState = {
  isPaired: false,
  activeUser: 'user',
  userName: 'You',
  partnerName: 'Partner',
  pinEnabled: false,
  vaultName: '',
  partnerReadAt: 0,
  partnerEverSeen: false,
  knownDevices: [],
  approvedDeviceCount: 1,
  userReport: {
    weather: 'CALM',
    capacity: 4,
    notAboutYouActive: false,
    updatedAt: 'Today'
  },
  partnerReport: {
    weather: 'CALM',
    capacity: 4,
    notAboutYouActive: false,
    updatedAt: 'Today'
  },
  messages: [],
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
  ],
  scratchCards: [
    {
      id: 'scratch-1',
      title: 'Warm Scalp & Shoulder Massage Voucher',
      category: 'coupon',
      foilType: 'gold',
      authorId: 'partner',
      authorName: 'Partner',
      recipientId: 'user',
      createdAt: 'Today',
      teaserHeadline: 'Scratch to reveal tonight’s pampering voucher',
      revealedContent: 'Redeemable for one 30-minute uninterrupted warm scalp, neck, and shoulder massage with lavender oil. Valid anytime you feel exhausted or tender.',
      isScratched: false,
      isRedeemed: false
    },
    {
      id: 'scratch-2',
      title: 'Starlight Balcony Dessert Date',
      category: 'date_invitation',
      foilType: 'rose_gold',
      authorId: 'user',
      authorName: 'You',
      recipientId: 'partner',
      createdAt: 'Yesterday',
      teaserHeadline: 'Scratch for tonight’s sweet surprise after dinner',
      revealedContent: 'Meet me on the balcony at 10 PM. Warm cinnamon apple cider, melted dark chocolate dip with fresh strawberries, and two thick wool blankets.',
      isScratched: false,
      isRedeemed: false
    },
    {
      id: 'scratch-3',
      title: 'Immunity Pass: Movie Choice Without Veto',
      category: 'coupon',
      foilType: 'silver',
      authorId: 'partner',
      authorName: 'Partner',
      recipientId: 'user',
      createdAt: 'Last week',
      teaserHeadline: 'Scratch for an unconditional couple privilege',
      revealedContent: 'You pick whatever movie or show you want tonight, and I will happily watch with freshly popped salted popcorn and zero complaints or side comments.',
      isScratched: true,
      scratchedAt: 'Last Friday',
      isRedeemed: true,
      redeemedAt: 'Last Friday'
    }
  ],
  hearthGarden: {
    level: 3,
    stageName: 'Young Japanese Hearth Bonsai',
    vitality: 88,
    waterLevel: 75,
    sunlightLevel: 80,
    isDormant: false,
    lastNourishedAt: 'Today',
    totalWaterings: 14,
    totalSunbaths: 11,
    blossoms: [
      {
        id: 'blossom-1',
        type: 'cherry',
        note: 'Our first late-night drive to the coast when the fog rolled over the water.',
        sproutedBy: 'user',
        sproutedByName: 'You',
        sproutedAt: 'Yesterday',
        xPercent: 32,
        yPercent: 38
      },
      {
        id: 'blossom-2',
        type: 'jasmine',
        note: 'When you left a warm tea on my desk without saying a word because you saw I was stressed.',
        sproutedBy: 'partner',
        sproutedByName: 'Partner',
        sproutedAt: '3 days ago',
        xPercent: 68,
        yPercent: 34
      },
      {
        id: 'blossom-3',
        type: 'lotus',
        note: 'The unstoppable laughing fit over our burned first attempt at homemade gnocchi.',
        sproutedBy: 'user',
        sproutedByName: 'You',
        sproutedAt: 'Last week',
        xPercent: 50,
        yPercent: 25
      }
    ],
    growthLog: [
      { id: 'log-1', event: 'Garden sprouted: Young Japanese Hearth Bonsai took root.', timestamp: '14 days ago' },
      { id: 'log-2', event: 'Sprouted Cherry Blossom: "Our first late-night drive to the coast".', timestamp: 'Yesterday' },
      { id: 'log-3', event: 'Nourished with Morning Dew: Vitality reached 88%.', timestamp: 'Today' }
    ]
  },
  activeSoftLanding: null,
  softLandingHistory: [],
  whisperMemos: [
    {
      id: 'whisper-1',
      title: 'Morning sunlight on the kitchen floor',
      category: 'morning',
      authorId: 'partner',
      authorName: 'Partner',
      recipientId: 'user',
      recordedAt: 'Yesterday, 8:15 AM',
      durationSeconds: 22,
      transcriptSnippet: 'Just woke up and saw the sun spilling across the kitchen. Left the kettle warm for you. Have the gentlest morning.',
      isListened: true,
      listenedAt: 'Yesterday, 8:40 AM',
      waveformData: [0.2, 0.4, 0.6, 0.8, 0.9, 0.7, 0.5, 0.8, 1.0, 0.8, 0.6, 0.4, 0.7, 0.9, 0.6, 0.3, 0.5, 0.2]
    },
    {
      id: 'whisper-2',
      title: 'Midnight rain on the skylight',
      category: 'midnight',
      authorId: 'user',
      authorName: 'You',
      recipientId: 'partner',
      recordedAt: '3 days ago',
      durationSeconds: 34,
      transcriptSnippet: 'Listening to the steady downpour against the window glass. Hope your dreams are safe and peaceful tonight.',
      isListened: false,
      waveformData: [0.3, 0.5, 0.4, 0.7, 0.8, 0.6, 0.5, 0.7, 0.9, 0.7, 0.5, 0.6, 0.8, 0.5, 0.4, 0.3, 0.2, 0.1]
    }
  ],
  nightstand: {
    userStatus: {
      isSleeping: false,
      sleptAt: undefined,
      wakeAlarmAt: '07:30',
      goodnightNote: 'Rest well tonight, my love.'
    },
    partnerStatus: {
      isSleeping: true,
      sleptAt: Date.now() - 42 * 60 * 1000,
      wakeAlarmAt: '07:00',
      goodnightNote: 'Already dreaming. Leaving a quiet kiss on your pillow.'
    },
    lastMidnightKissAt: Date.now() - 15 * 60 * 1000,
    lastMidnightKissFrom: 'partner',
    lastMidnightKissNote: 'Soft cheek kiss in the dark',
    ambientSoundscape: 'none',
    sleepTimerMinutes: 30
  },
  coordinatePins: [
    {
      id: 'pin-1',
      title: 'Our First Awkward Coffee Date',
      category: 'first_date',
      story: 'We ordered two oat lattes and ended up talking until the barista politely turned the chairs upside down on the tables around us.',
      date: 'Oct 14, 2022',
      latitude: 40.7128,
      longitude: -74.006,
      locationName: 'Little Canal Cafe, Lower East Side',
      authorId: 'partner',
      authorName: 'Partner',
      weatherAtMoment: 'Crisp autumn drizzle, 14°C',
      songSnippet: 'Norah Jones - Come Away With Me',
      isFavorite: true
    },
    {
      id: 'pin-2',
      title: 'The Rooftop Where We Watched the Perseids',
      category: 'secret_spot',
      story: 'Shared a sleeping bag on the gravel roof. Counted seven shooting stars and whispered the wishes we were too shy to say out loud.',
      date: 'Aug 12, 2023',
      latitude: 34.0522,
      longitude: -118.2437,
      locationName: 'Old Brick Building Fire Escape',
      authorId: 'user',
      authorName: 'You',
      weatherAtMoment: 'Warm summer midnight breeze',
      songSnippet: 'Sufjan Stevens - Mystery of Love',
      isFavorite: true
    },
    {
      id: 'pin-3',
      title: 'The Seaside Pier at Midnight',
      category: 'first_kiss',
      story: 'Ocean waves crashing beneath the wooden floorboards. The salty air and cold hands tucked inside oversized coat pockets.',
      date: 'Dec 31, 2022',
      latitude: 37.7749,
      longitude: -122.4194,
      locationName: 'Embarcadero Pier 7',
      authorId: 'partner',
      authorName: 'Partner',
      weatherAtMoment: 'Chilly Pacific mist, foggy',
      songSnippet: 'Lord Huron - The Night We Met',
      isFavorite: false
    }
  ],
  midnightRadio: {
    isPlaying: false,
    stationId: 'tokyo_rain',
    startedAt: Date.now(),
    volume: 0.6,
    userListening: false,
    partnerListening: true,
    whispers: [
      {
        id: 'whisper-radio-1',
        senderId: 'partner',
        senderName: 'Partner',
        text: 'Listening to the quiet rain with you.',
        timestamp: Date.now() - 12 * 60 * 1000
      }
    ]
  },
  activeStateOfUnion: {
    id: 'sou-current',
    weekLabel: 'Week of Sept 1 - Sept 7',
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    isCompleted: false,
    userCheckIn: {
      appreciations: [
        'Making fresh pour-over coffee on Thursday without asking.',
        'Listening patiently while I vented about my project roadblock.',
        'Leaving the heated blanket on my side of the bed.'
      ],
      whatWentWell: 'We navigated the chaotic dinner grocery run with complete teamwork and humor.',
      pebbleInShoe: 'Felt a little lonely on Tuesday evening when we were both glued to our phones.',
      gentleNeed: 'Could we have 30 minutes of screen-free couch tea time after dinner?',
      upcomingWeekCapacity: 4,
      upcomingWeekNote: 'Work looks manageable, excited for the weekend farmers market.',
      dateNightIdea: 'Homemade pizza making night with jazz vinyl.',
      isSubmitted: true,
      submittedAt: 'Yesterday, 8:30 PM'
    },
    partnerCheckIn: {
      appreciations: [
        'How you held my hand during the turbulent plane landing last weekend.',
        'Taking out the compost without a single word of grumbling.',
        'Your warm hug right as I walked through the front door on Friday.'
      ],
      whatWentWell: 'Our deep conversation on the porch under the rain.',
      pebbleInShoe: '',
      gentleNeed: 'Just looking forward to sleeping in together this Sunday.',
      upcomingWeekCapacity: 3,
      upcomingWeekNote: 'Big presentation on Wednesday, might need gentle decompression time.',
      dateNightIdea: 'Quiet walk through the botanical conservatory.',
      isSubmitted: true,
      submittedAt: 'Yesterday, 9:15 PM'
    },
    agreedDateNight: 'Sunday botanical conservatory walk + homemade pizza night'
  },
  stateOfUnionHistory: [],
  sharedCanvas: {
    id: 'canvas-1',
    title: 'Our Parchment Doodles',
    background: 'parchment',
    strokes: [
      {
        id: 'stroke-1',
        authorId: 'partner',
        tool: 'pen',
        color: '#f43f5e',
        size: 4,
        points: [
          { x: 0.48, y: 0.42 },
          { x: 0.46, y: 0.38 },
          { x: 0.44, y: 0.36 },
          { x: 0.41, y: 0.38 },
          { x: 0.40, y: 0.42 },
          { x: 0.43, y: 0.48 },
          { x: 0.50, y: 0.56 },
          { x: 0.57, y: 0.48 },
          { x: 0.60, y: 0.42 },
          { x: 0.59, y: 0.38 },
          { x: 0.56, y: 0.36 },
          { x: 0.54, y: 0.38 },
          { x: 0.52, y: 0.42 }
        ]
      }
    ],
    lastUpdated: Date.now(),
    savedSketches: []
  },
  repairLetters: [
    {
      id: 'repair-1',
      authorId: 'partner',
      authorName: 'Partner',
      recipientId: 'user',
      title: 'Snapping during dinner prep on Tuesday',
      situationSummary: 'I raised my voice and acted irritable when you asked about the weekend groceries.',
      primaryLanguage: 'responsibility',
      expressionOfRegret: 'I am deeply sorry that my tone caused you to feel small and hesitant around me.',
      ownershipNote: 'I was stressed about my work review, but taking that out on you was completely unfair. You did nothing wrong.',
      restitutionOffer: 'I would love to cook our dinner tonight entirely on my own while you rest on the sofa.',
      commitmentForNextTime: 'If I feel overwhelmed coming home, I will name that I have low capacity and ask for 20 minutes of quiet before we start cooking.',
      forgivenessRequest: 'I value your peace more than anything. Will you forgive me when your heart is ready?',
      sentAt: Date.now() - 36 * 60 * 60 * 1000,
      status: 'accepted',
      recipientResponseNote: 'Thank you for owning this so cleanly. I felt seen and loved reading this. I forgive you.',
      resolvedAt: Date.now() - 30 * 60 * 60 * 1000
    }
  ],
  kintsugiMoments: [
    {
      id: 'kintsugi-1',
      title: 'The 4-Month Long-Distance Summer',
      themeTag: 'distance',
      hardshipStory: 'Six hours time zone difference, spotty airport Wi-Fi, and constant tiredness made us snappy and distant for three difficult weeks.',
      wisdomLearned: 'We learned that silence hurts more than admitting loneliness. We created our nightly 10-minute bedtime voice note ritual, which became our strongest emotional anchor.',
      goldSeamIndex: 0,
      overcomeDate: 'Summer 2024',
      inscribedBy: 'partner',
      inscribedByName: 'Partner',
      inscribedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
      isCherished: true,
      cherishedAt: Date.now() - 58 * 24 * 60 * 60 * 1000,
      cherishedNote: 'This scar taught us how to love across oceans.'
    },
    {
      id: 'kintsugi-2',
      title: 'The First Apartment Lease Panic',
      themeTag: 'growth',
      hardshipStory: 'Our first application was rejected suddenly. We turned our anxiety on each other, arguing over neighborhood choices and emergency savings in a rainy parked car.',
      wisdomLearned: 'We recognized that external fear was driving our defensiveness. We agreed: we are always a team against the problem, never against each other. The next place we found was ten times better.',
      goldSeamIndex: 1,
      overcomeDate: 'Autumn 2023',
      inscribedBy: 'user',
      inscribedByName: 'You',
      inscribedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
      isCherished: true,
      cherishedAt: Date.now() - 89 * 24 * 60 * 60 * 1000,
      cherishedNote: 'Best parked-car apology of our lives.'
    },
    {
      id: 'kintsugi-3',
      title: 'Navigating Family Expectations at the Holidays',
      themeTag: 'family',
      hardshipStory: 'Pulled in four different directions by extended relatives. We both felt exhausted, resentful, and unable to protect our quiet time together.',
      wisdomLearned: 'We formulated our Two-Person Sanctuary boundary: we now agree on departure times before walking into family gatherings and hold a sacred 48-hour quiet buffer just for us.',
      goldSeamIndex: 2,
      overcomeDate: 'Winter 2024',
      inscribedBy: 'partner',
      inscribedByName: 'Partner',
      inscribedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      isCherished: false
    }
  ]
};

export function loadState(): SpaceState {
  try {
    const session = loadSpaceSession();
    const isPaired = Boolean(session);
    const activeUser = session ? session.role : 'user';

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_STATE,
        isPaired,
        activeUser,
        userName: session?.userName || DEFAULT_STATE.userName,
        partnerName: session?.partnerName || DEFAULT_STATE.partnerName
      };
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      isPaired,
      activeUser,
      userName: parsed.userName || session?.userName || DEFAULT_STATE.userName,
      partnerName: parsed.partnerName || session?.partnerName || DEFAULT_STATE.partnerName,
      // Older vaults stored the PIN in the clear; treat its presence as the flag
      // and drop the value on the next save.
      pinEnabled: parsed.pinEnabled !== undefined ? parsed.pinEnabled : !!parsed.appPin,
      vaultName: parsed.vaultName || '',
      partnerReadAt: parsed.partnerReadAt || 0,
      partnerEverSeen: parsed.partnerEverSeen || false,
      knownDevices: parsed.knownDevices || [],
      approvedDeviceCount: parsed.approvedDeviceCount || 1,
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
      scratchCards: parsed.scratchCards || DEFAULT_STATE.scratchCards,
      hearthGarden: parsed.hearthGarden || DEFAULT_STATE.hearthGarden,
      activeSoftLanding: parsed.activeSoftLanding !== undefined ? parsed.activeSoftLanding : DEFAULT_STATE.activeSoftLanding,
      softLandingHistory: parsed.softLandingHistory || DEFAULT_STATE.softLandingHistory,
      whisperMemos: parsed.whisperMemos || DEFAULT_STATE.whisperMemos,
      nightstand: parsed.nightstand || DEFAULT_STATE.nightstand,
      coordinatePins: parsed.coordinatePins || DEFAULT_STATE.coordinatePins,
      midnightRadio: parsed.midnightRadio || DEFAULT_STATE.midnightRadio,
      activeStateOfUnion: parsed.activeStateOfUnion !== undefined ? parsed.activeStateOfUnion : DEFAULT_STATE.activeStateOfUnion,
      stateOfUnionHistory: parsed.stateOfUnionHistory || DEFAULT_STATE.stateOfUnionHistory,
      sharedCanvas: parsed.sharedCanvas || DEFAULT_STATE.sharedCanvas,
      repairLetters: parsed.repairLetters || DEFAULT_STATE.repairLetters,
      kintsugiMoments: parsed.kintsugiMoments || DEFAULT_STATE.kintsugiMoments,
    };
  } catch (e) {
    return DEFAULT_STATE;
  }
}

// Canvas strokes are the one collection with no natural ceiling: every doodle
// either partner has ever drawn is appended forever, and a single session can
// add hundreds. Unlike messages or letters they carry no lasting meaning once
// the drawing is done, so only a recent window is persisted.
const MAX_PERSISTED_STROKES = 2000;

export interface KnownDevice {
  id: string;
  label: string;
  firstSeenAt: number;
  approved: boolean;
}

export interface SaveResult {
  ok: boolean;
  /** Storage is full - the write was lost and the user needs to know. */
  quotaExceeded: boolean;
}

function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  // Browsers disagree on the name; Firefox and Safari use their own.
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.name === 'QUOTA_EXCEEDED_ERR'
  );
}

/** Trims the unbounded collections so a long-lived space cannot fill storage. */
export function pruneForStorage(state: SpaceState): SpaceState {
  const strokes = state.sharedCanvas?.strokes;
  if (!strokes || strokes.length <= MAX_PERSISTED_STROKES) return state;

  return {
    ...state,
    sharedCanvas: {
      ...state.sharedCanvas,
      strokes: strokes.slice(-MAX_PERSISTED_STROKES)
    }
  };
}

/**
 * Persists the vault in the clear (used when no PIN is set).
 *
 * Returns the outcome rather than swallowing it: a silent QuotaExceededError
 * means the app keeps working from memory while saving nothing, and the user
 * loses everything on refresh without ever being told.
 */
export function saveState(state: SpaceState): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(forStorage(state)));
    return { ok: true, quotaExceeded: false };
  } catch (e) {
    const quota = isQuotaError(e);
    console.error(quota ? '[Storage] Quota exceeded - nothing was saved' : '[Storage] Save failed', e);
    return { ok: false, quotaExceeded: quota };
  }
}

/**
 * The form the vault is written in: trimmed, with media moved out to IndexedDB.
 *
 * The bytes are written without being waited for. A save happens on every
 * change and must not block the interface, and the reference is already in the
 * snapshot either way - if the write fails, that one photo comes back empty
 * rather than the whole save being lost, which is much the better trade in a
 * store this small.
 */
function forStorage(state: SpaceState): SpaceState {
  const pruned = pruneForStorage(state);
  const { value, writes } = externalizeMedia(pruned, () => newId());

  if (writes.length > 0) {
    void persistMedia(writes);
  }
  return value;
}

/**
 * Rough share of the localStorage budget in use.
 *
 * This is the vault only. Photos and voice memos live in IndexedDB on a much
 * larger quota - add estimateMediaBytes() from core/media if you ever want the
 * whole picture.
 */
export function estimateStorageBytes(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      total += k.length + (localStorage.getItem(k)?.length || 0);
    }
    return total * 2; // UTF-16 code units
  } catch {
    return 0;
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
