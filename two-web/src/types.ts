export type ThemeMode = 'linen' | 'slate' | 'forest' | 'terracotta';

export type WeatherState = 'SUNNY' | 'CALM' | 'OVERCAST' | 'RAINY' | 'STORMY';

export interface EmotionalReport {
  weather: WeatherState;
  capacity: number; // 0 to 5
  notAboutYouActive: boolean;
  updatedAt: string;
}

export interface NeedItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: string;
  isNeedCard?: boolean;
  isVoiceMemo?: boolean;
  audioDataUrl?: string;
  audioDurationSeconds?: number;
}

export interface JournalEntry {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  date: string;
  isPrivate: boolean; // owner-only cryptographic subkey
}

export interface AgreementItem {
  id: string;
  title: string;
  trigger: string;
  resolution: string;
  date: string;
}

export interface ListItem {
  id: string;
  title: string;
  isCompleted: boolean;
  isHiddenFromPartner: boolean; // Surprise gift toggle
  addedBy: string;
}

export interface ChoreItem {
  id: string;
  task: string;
  rememberedBy: string; // Mental load / planning
  executedBy: string;   // Physical doing
}

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  date: string;
}

export interface QuoteItem {
  id: string;
  quote: string;
  author: string;
  isCustom?: boolean;
}

export interface ConsentLog {
  id: string;
  kind: 'location' | 'cycle' | 'export' | 'ai_refinement';
  action: 'grant' | 'revoke' | 'access';
  details: string;
  timestamp: string;
}

export type CyclePhase = 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATORY' | 'LUTEAL';

export type CycleSharingLevel = 'private' | 'phase_only' | 'phase_and_energy' | 'full';

export interface CycleRecord {
  id: string;
  dayOfCycle: number;
  phase: CyclePhase;
  energyLevel: number; // 1 to 5
  mood: string;
  symptoms: string[];
  privateNotes?: string;
  loggedDate: string;
}

export interface RitualItem {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  category: 'affection' | 'presence' | 'reflection' | 'play';
  completedTodayByUser: boolean;
  completedTodayByPartner: boolean;
  streakDays: number;
}

export interface PebbleStone {
  id: string;
  color: string;
  size: number;
  height: number;
  rotation: number;
  placedAt: string;
  ritualTitle: string;
}

export type WaxColor = 'burgundy' | 'gold' | 'sage' | 'midnight';

export type LetterCondition = 'none' | 'date' | 'anxious' | 'night' | 'travel';

export interface LoveLetter {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  waxColor: WaxColor;
  conditionType: LetterCondition;
  conditionDetail?: string;
  sentDate: string;
  isOpened: boolean;
  openedDate?: string;
}

export type EnergyTier = 'low' | 'medium' | 'high';
export type AdventureCategory = 'home' | 'creative' | 'outdoors' | 'food';
export type AdventureSeason = 'spring' | 'summer' | 'fall' | 'winter' | 'anytime';

export interface AdventureItem {
  id: string;
  title: string;
  description: string;
  energyTier: EnergyTier;
  category: AdventureCategory;
  estimatedCost: '$' | '$$' | 'Free';
  isCompleted: boolean;
  completedDate?: string;
  personalNotes?: string;
  season?: AdventureSeason;
  location?: string;
  photoUrl?: string;
}

export interface RelationshipMilestone {
  id: string;
  title: string;
  date: string;
  category: 'first' | 'home' | 'trip' | 'growth' | 'commitment';
  description: string;
  photoUrl?: string;
}

export interface SensoryPulseEvent {
  senderId: string;
  timestamp: number;
  note?: string;
}

export type StarCategory = 'mornings' | 'support' | 'laughter' | 'affection' | 'visions';

export interface GratitudeStar {
  id: string;
  authorId: string;
  authorName: string;
  note: string;
  category: StarCategory;
  x: number; // percentage 8 to 92
  y: number; // percentage 12 to 88
  magnitude: number; // 1 to 3
  createdAt: string;
}

export interface CareCompassProfile {
  wordsOfAffirmation: number; // 0 to 100
  qualityTime: number;        // 0 to 100
  actsOfService: number;      // 0 to 100
  physicalTouch: number;      // 0 to 100
  thoughtfulSurprises: number;// 0 to 100
  fuelTankPercent: number;    // 0 to 100
  currentCravingNote: string;
  updatedAt: string;
}

export interface ComfortBoxData {
  id: string;
  authorId: string;
  authorName: string;
  reassuranceNote: string;
  whisperAudioUrl?: string;
  photoUrls: string[];
  calmingExercise: '4-7-8' | 'box_breathing' | 'grounding_54321';
  updatedAt: string;
}

export interface SecretRecipe {
  id: string;
  title: string;
  story: string;
  prepTime: string;
  servings: string;
  ingredients: { id: string; name: string; checked: boolean }[];
  steps: string[];
  comfortTag: 'rainy_day' | 'celebration' | 'quick_midnight' | 'comfort_classic';
  photoUrl?: string;
  favoriteWineOrDrink?: string;
}

export interface IntuitionDilemma {
  id: string;
  prompt: string;
  optionA: string;
  optionB: string;
  optionC: string;
  category: 'spontaneous' | 'cozy' | 'dream' | 'quirky';
}

export interface IntuitionGameRound {
  id: string;
  date: string;
  dilemma: IntuitionDilemma;
  authorId: string;
  authorChoice?: 'A' | 'B' | 'C';
  partnerGuess?: 'A' | 'B' | 'C';
  revealed: boolean;
}

export type BreathPatternType = '4-7-8' | 'box' | 'gentle';

export interface BreathPatternConfig {
  id: BreathPatternType;
  name: string;
  subtitle: string;
  inhale: number; // seconds
  holdIn: number;
  exhale: number;
  holdOut: number;
  totalDuration: number;
}

export interface CoRegulationSession {
  isActive: boolean;
  pattern: BreathPatternType;
  startedAt: number; // epoch timestamp
  initiatorId: string;
  targetCycles: number;
  completedCycles: number;
  soundEnabled: boolean;
  heartbeatEnabled: boolean;
}

export type CapsuleSealType = 'gold_key' | 'wax_crest' | 'starlight' | 'heart_lock';

export interface TimeCapsuleItem {
  id: string;
  title: string;
  teaserHint: string;
  authorId: 'user' | 'partner';
  authorName: string;
  createdAt: string;
  unlockAt: number; // epoch ms
  unlockDateFormatted: string;
  sealType: CapsuleSealType;
  content: string;
  photoUrls: string[];
  voiceMemoUrl?: string;
  isOpened: boolean;
  openedAt?: number;
}

export type CoPresenceActivity = 'reading' | 'working' | 'writing' | 'crafting' | 'music' | 'resting' | 'tea';
export type CoPresenceRoomId = 'rainy_window' | 'fireside' | 'bookshop' | 'midnight_balcony';

export interface CoPresenceUserStatus {
  userId: 'user' | 'partner';
  name: string;
  activity: CoPresenceActivity;
  room: CoPresenceRoomId;
  customNote?: string;
  isJoined: boolean;
  joinedAt: number;
  timerEndsAt?: number;
}

export interface CoPresenceInteractionEvent {
  type: 'tea' | 'glance' | 'blanket' | 'hand' | 'kiss';
  senderId: string;
  senderName: string;
  timestamp: number;
}

export type ScratchFoilType = 'gold' | 'rose_gold' | 'silver' | 'holographic';
export type ScratchCardCategory = 'coupon' | 'secret_note' | 'date_invitation' | 'compliment';

export interface ScratchCardItem {
  id: string;
  title: string;
  category: ScratchCardCategory;
  foilType: ScratchFoilType;
  authorId: 'user' | 'partner';
  authorName: string;
  recipientId: 'user' | 'partner';
  createdAt: string;
  teaserHeadline: string;
  revealedContent: string;
  revealedPhotoUrl?: string;
  isScratched: boolean;
  scratchedAt?: string;
  isRedeemed: boolean;
  redeemedAt?: string;
}

export interface ScrapbookSettings {
  bookTitle: string;
  subtitle: string;
  dedication: string;
  coupleEstablishedYear: string;
  includeGratitude: boolean;
  includeLetters: boolean;
  includeAdventures: boolean;
  includeMilestones: boolean;
  includeRecipes: boolean;
  includeScratchCards: boolean;
  includeTimeCapsules: boolean;
  includeRituals: boolean;
}

export type BlossomType = 'cherry' | 'jasmine' | 'golden_leaf' | 'lotus';

export interface GardenBlossom {
  id: string;
  type: BlossomType;
  note: string;
  sproutedBy: 'user' | 'partner';
  sproutedByName: string;
  sproutedAt: string;
  xPercent: number; // percentage coordinate 10-90 on canopy
  yPercent: number; // percentage coordinate 15-75 on canopy
}

export interface HearthGardenState {
  level: number; // 1 to 10 growth stages
  stageName: string;
  vitality: number; // 0 to 100%
  waterLevel: number; // 0 to 100%
  sunlightLevel: number; // 0 to 100%
  isDormant: boolean; // gentle winter slumber if inactive
  lastNourishedAt: string;
  totalWaterings: number;
  totalSunbaths: number;
  blossoms: GardenBlossom[];
  growthLog: { id: string; event: string; timestamp: string }[];
}






