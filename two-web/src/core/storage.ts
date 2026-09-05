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
  CycleSharingLevel
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
  ]
};

export function loadState(): SpaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return JSON.parse(raw);
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
