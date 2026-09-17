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
  KintsugiVesselItem,
  MemoryItem
} from '../types';
import { loadSpaceSession } from './space';
import { externalizeMedia, persistMedia } from './media';
import { newId } from './ids';
import { GroupSpace } from './groups';
import { ActivityEvent } from './activity';
import { withoutSampleData, NEUTRAL_CARE_PROFILE, FRESH_GARDEN } from './sampleData';

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
  /** Timeline & Quotes memories. They used to live only in the screen, gone on leaving it. */
  memories: MemoryItem[];
  /**
   * Set once the sample content older versions shipped with has been taken
   * out of this space. See core/sampleData.ts.
   */
  sampleDataRemoved: boolean;
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
  /** When the partner's device last said it was awake; 0 when never heard. */
  partnerLastSeen: number;
  /**
   * Group spaces this device belongs to.
   *
   * Deliberately a separate list rather than a widening of the couple's own
   * fields: everything above describes one space shared by two people, and a
   * group is a different room with different members. Keeping them apart is
   * what lets groups exist without a single couple screen changing.
   */
  groups: GroupSpace[];
  /** What the partner has changed lately, one entry per destination. */
  activity: ActivityEvent[];
  /** When this device last looked at each destination. */
  activitySeen: Record<string, number>;
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
  partnerLastSeen: 0,
  groups: [],
  activity: [],
  activitySeen: {},
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
  // Starts empty. Everything below used to arrive pre-filled with an invented
  // couple's life - see core/sampleData.ts, which takes it back out of spaces
  // created before this. What remains is starter material that does not
  // pretend to be yours: two quotes by their authors, a list of rituals to try
  // with no streaks, and date ideas nobody has done yet.
  journalEntries: [],
  agreements: [],
  lists: [],
  chores: [],
  expenses: [],
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
    }
  ],
  consentLogs: [],
  // Nothing is shared until the person tracking chooses to share it.
  cycleSharingLevel: 'private',
  cycleRecords: [],
  rituals: [
    {
      id: 'r-1',
      title: 'The 6-Second Kiss',
      subtitle: 'Oxytocin reunion reset before opening laptops or tasks',
      duration: '6 seconds',
      category: 'affection',
      completedTodayByUser: false,
      completedTodayByPartner: false,
      streakDays: 0
    },
    {
      id: 'r-2',
      title: 'Morning Silence & Tea',
      subtitle: 'Gentle shared presence before outside notifications start',
      duration: '10 mins',
      category: 'presence',
      completedTodayByUser: false,
      completedTodayByPartner: false,
      streakDays: 0
    },
    {
      id: 'r-3',
      title: 'Workday Boundary Walk',
      subtitle: '10-minute transition stroll to leave work baggage outside',
      duration: '10 mins',
      category: 'presence',
      completedTodayByUser: false,
      completedTodayByPartner: false,
      streakDays: 0
    },
    {
      id: 'r-4',
      title: 'Pillow Talk Gratitude Whisper',
      subtitle: 'One specific, quiet detail appreciated about each other',
      duration: '2 mins',
      category: 'reflection',
      completedTodayByUser: false,
      completedTodayByPartner: false,
      streakDays: 0
    },
    {
      id: 'r-5',
      title: 'Weekly Phone-Free Date Hour',
      subtitle: 'Protected uninterrupted face-to-face dinner or tea',
      duration: '60 mins',
      category: 'play',
      completedTodayByUser: false,
      completedTodayByPartner: false,
      streakDays: 0
    }
  ],
  pebbles: [],
  letters: [],
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
      isCompleted: false
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
  milestones: [],
  constellationStars: [],
  careCompass: {
    user: { ...NEUTRAL_CARE_PROFILE },
    partner: { ...NEUTRAL_CARE_PROFILE }
  },
  comfortBoxes: [],
  recipes: [],
  intuitionRounds: [],
  timeCapsules: [],
  scratchCards: [],
  hearthGarden: { ...FRESH_GARDEN },
  activeSoftLanding: null,
  softLandingHistory: [],
  whisperMemos: [],
  nightstand: {
    userStatus: { isSleeping: false },
    partnerStatus: { isSleeping: false },
    ambientSoundscape: 'none',
    sleepTimerMinutes: 30
  },
  coordinatePins: [],
  midnightRadio: {
    isPlaying: false,
    stationId: 'tokyo_rain',
    startedAt: Date.now(),
    volume: 0.6,
    userListening: false,
    partnerListening: false,
    whispers: []
  },
  activeStateOfUnion: null,
  stateOfUnionHistory: [],
  sharedCanvas: {
    id: 'canvas-1',
    title: 'Our Parchment Doodles',
    background: 'parchment',
    strokes: [],
    lastUpdated: Date.now(),
    savedSketches: []
  },
  repairLetters: [],
  kintsugiMoments: [],
  memories: [],
  sampleDataRemoved: true
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
    const loaded: SpaceState = {
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
      partnerLastSeen: parsed.partnerLastSeen || 0,
      // Groups saved before the creator's name became the shared one have no
      // nameConfirmed; treating them as confirmed keeps the name they already
      // show rather than replacing it with a placeholder.
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      activitySeen:
        parsed.activitySeen && typeof parsed.activitySeen === 'object' ? parsed.activitySeen : {},
      groups: Array.isArray(parsed.groups)
        ? parsed.groups.map((g: any) => ({ ...g, nameConfirmed: g.nameConfirmed !== false }))
        : [],
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
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
    };
    return withoutSampleData(loaded, !parsed.sampleDataRemoved);
  } catch (e) {
    return DEFAULT_STATE;
  }
}

/**
 * Brings a state opened from the PIN-protected vault up to date.
 *
 * That path hands back what was sealed, as it was sealed - so a vault saved
 * before a field existed has no such field, and one saved before the sample
 * content was removed still has it.
 */
export function upgradeState(opened: any): SpaceState {
  const merged: SpaceState = {
    ...DEFAULT_STATE,
    ...opened,
    memories: Array.isArray(opened?.memories) ? opened.memories : []
  };
  return withoutSampleData(merged, !opened?.sampleDataRemoved);
}

// Canvas strokes are the one collection with no natural ceiling: every doodle
// either partner has ever drawn is appended forever, and a single session can
// add hundreds. Unlike messages or letters they carry no lasting meaning once
// the drawing is done, so only a recent window is persisted.
const MAX_PERSISTED_STROKES = 2000;

/**
 * How much of the couple's conversation one device keeps.
 *
 * There was no limit at all, which is generous right up until the vault stops
 * fitting in the storage a browser will give it - and the failure then is not
 * a trimmed history but a save that does not happen. Higher than a group's
 * two thousand because this is the conversation the app is for, and the chat
 * says so when it is reached rather than dropping the oldest in silence.
 */
export const MAX_CHAT_MESSAGES = 5000;

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
 * Exported because the PIN-protected path writes through vault.ts rather than
 * here, and must not skip this - otherwise the one group of people who asked
 * for more protection would be the only ones still filling localStorage with
 * photos.
 *
 * The bytes are written without being waited for. A save happens on every
 * change and must not block the interface, and the reference is already in the
 * snapshot either way - if the write fails, that one photo comes back empty
 * rather than the whole save being lost, which is much the better trade in a
 * store this small.
 */
export function forStorage(state: SpaceState, key?: CryptoKey | null): SpaceState {
  const pruned = pruneForStorage(state);
  const { value, writes } = externalizeMedia(pruned, () => newId());

  if (writes.length > 0) {
    void persistMedia(writes, key);
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
