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

