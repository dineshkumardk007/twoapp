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
