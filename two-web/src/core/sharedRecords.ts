// The everyday shared features that used to stay on the phone they were used on.
//
// Chore Split, Money Light, the Shared Journal, the Quote Jar, Relationship
// Agreements and Cycle Compass all saved locally and sent nothing, so a chore
// or an expense one of you logged never reached the other phone - despite
// names that promise the opposite.
//
// Two things make these different from the features that already synced:
//
// - Who. These screens store people as "You" and "Partner", which is only
//   true on the phone that wrote it: the chore "remembered by You" on one
//   phone is "remembered by Partner" on the other. On the wire every person is
//   the fixed role of the space ('user' or 'partner'), and each phone turns it
//   back into "You" or "Partner" from where it stands.
//
// - What. The journal has private entries and Cycle Compass has a sharing
//   level. Neither is left to the receiving screen to hide: what is private is
//   never sent at all. Everything on the relay is encrypted with the key both
//   of you hold, so leaving something out of the message is the only real way
//   of keeping it from the other phone.

import {
  AgreementItem,
  ChoreItem,
  LoveLetter,
  RelationshipMilestone,
  RitualItem,
  CycleRecord,
  CycleSharingLevel,
  ExpenseItem,
  JournalEntry,
  MemoryItem,
  QuoteItem
} from '../types';
import type { SpaceState } from './storage';

export const CHORE_ADD = 'CHORE_ADD';
export const EXPENSE_ADD = 'EXPENSE_ADD';
export const EXPENSES_SETTLED = 'EXPENSES_SETTLED';
export const JOURNAL_SHARED = 'JOURNAL_SHARED';
export const QUOTE_ADD = 'QUOTE_ADD';
export const AGREEMENT_ADD = 'AGREEMENT_ADD';
export const CYCLE_RECORD = 'CYCLE_RECORD';
export const CYCLE_SHARING = 'CYCLE_SHARING';
export const MEMORY_ADD = 'MEMORY_ADD';
export const LIST_ITEM_SET = 'LIST_ITEM_SET';
export const LIST_ITEM_DELETE = 'LIST_ITEM_DELETE';
export const RITUAL_ADD = 'RITUAL_ADD';
export const MILESTONE_ADD = 'MILESTONE_ADD';
export const LETTER_OPENED = 'LETTER_OPENED';
export const WHISPER_MEMO = 'WHISPER_MEMO';
export const WHISPER_MEMO_HEARD = 'WHISPER_MEMO_HEARD';

export const SHARED_RECORD_TYPES = new Set([
  CHORE_ADD,
  EXPENSE_ADD,
  EXPENSES_SETTLED,
  JOURNAL_SHARED,
  QUOTE_ADD,
  AGREEMENT_ADD,
  CYCLE_RECORD,
  CYCLE_SHARING,
  MEMORY_ADD,
  LIST_ITEM_SET,
  LIST_ITEM_DELETE,
  RITUAL_ADD,
  MILESTONE_ADD,
  LETTER_OPENED,
  WHISPER_MEMO,
  WHISPER_MEMO_HEARD
]);

type Role = 'user' | 'partner';

/** "You" or "Partner", as written on this phone, to the role it means. */
function toRole(who: string, activeUser: Role): Role {
  const other: Role = activeUser === 'user' ? 'partner' : 'user';
  return who === 'Partner' ? other : activeUser;
}

/** A role from the wire, to "You" or "Partner" as seen from this phone. */
function fromRole(role: unknown, activeUser: Role): 'You' | 'Partner' {
  return role === activeUser ? 'You' : 'Partner';
}

const isText = (v: unknown): v is string => typeof v === 'string';

function prependUnique<T extends { id: string }>(list: T[], item: T): T[] {
  return [item, ...list.filter(existing => existing.id !== item.id)];
}

// --- Outgoing ----------------------------------------------------------------

export function choreToWire(chore: ChoreItem, activeUser: Role) {
  return {
    id: chore.id,
    task: chore.task,
    rememberedBy: toRole(chore.rememberedBy, activeUser),
    executedBy: toRole(chore.executedBy, activeUser)
  };
}

export function expenseToWire(expense: ExpenseItem, activeUser: Role) {
  return { ...expense, paidBy: toRole(expense.paidBy, activeUser) };
}

export function quoteToWire(quote: QuoteItem, activeUser: Role) {
  return { id: quote.id, quote: quote.quote, author: activeUser };
}

/** Only a shared entry is ever turned into a message. */
export function journalToWire(entry: JournalEntry) {
  return {
    id: entry.id,
    at: entry.at,
    authorId: entry.authorId,
    title: entry.title,
    content: entry.content,
    date: entry.date
  };
}

/**
 * A cycle record cut down to what the sharing level allows.
 *
 * Null at "private": nothing is sent. Private notes are never sent at any
 * level - the screen promises they stay on the phone.
 */
export function cycleRecordToWire(record: CycleRecord, level: CycleSharingLevel) {
  if (level === 'private') return null;
  const withEnergy = level === 'phase_and_energy' || level === 'full';
  const full = level === 'full';
  return {
    id: record.id,
    dayOfCycle: record.dayOfCycle,
    phase: record.phase,
    loggedDate: record.loggedDate,
    energyLevel: withEnergy ? record.energyLevel : 0,
    mood: full ? record.mood : '',
    symptoms: full ? record.symptoms : []
  };
}

export function memoryToWire(memory: MemoryItem, activeUser: Role) {
  return {
    id: memory.id,
    title: memory.title,
    date: memory.date,
    tag: memory.tag,
    desc: memory.desc,
    imageDataUrl: memory.imageDataUrl,
    lockedUntil: memory.lockedUntil,
    authorId: memory.authorId || activeUser
  };
}

/**
 * A ritual as it starts life on the other phone.
 *
 * Whose streak it is does not need translating - a ritual is completed by the
 * two roles of the space, not by "you" - but the tally travels at zero either
 * way, because a ritual arrives new to the person receiving it.
 */
export function ritualToWire(ritual: RitualItem) {
  return {
    id: ritual.id,
    title: ritual.title,
    subtitle: ritual.subtitle,
    duration: ritual.duration,
    category: ritual.category
  };
}

// --- Incoming ----------------------------------------------------------------

const MEMORY_TAGS = new Set(['Milestone', 'Trip', 'Moment', 'Anniversary', 'Whisper']);
const RITUAL_CATEGORIES = new Set(['affection', 'presence', 'reflection', 'play']);
const MILESTONE_CATEGORIES = new Set(['first', 'home', 'trip', 'growth', 'commitment']);

const PHASES = new Set(['MENSTRUAL', 'FOLLICULAR', 'OVULATORY', 'LUTEAL']);
const LEVELS = new Set(['private', 'phase_only', 'phase_and_energy', 'full']);

/** Applies one of the records above, or returns null if it is not well formed. */
export function applySharedRecord(
  prev: SpaceState,
  type: string,
  payload: any,
  authorId: string
): SpaceState | null {
  if (!payload || typeof payload !== 'object') return null;
  // Everything that adds an item names it; the two that change a whole list do not.
  const needsId = type !== CYCLE_SHARING && type !== EXPENSES_SETTLED;
  if (needsId && !isText(payload.id)) return null;
  const me = prev.activeUser as Role;

  switch (type) {
    case CHORE_ADD: {
      if (!isText(payload.task)) return null;
      const chore: ChoreItem = {
        id: payload.id,
        task: payload.task,
        rememberedBy: fromRole(payload.rememberedBy, me),
        executedBy: fromRole(payload.executedBy, me)
      };
      return { ...prev, chores: prependUnique(prev.chores, chore) };
    }

    case EXPENSE_ADD: {
      const amount = Number(payload.amount);
      if (!isText(payload.title) || !Number.isFinite(amount) || amount <= 0) return null;
      const expense: ExpenseItem = {
        id: payload.id,
        title: payload.title,
        amount,
        paidBy: fromRole(payload.paidBy, me),
        date: isText(payload.date) ? payload.date : ''
      };
      return { ...prev, expenses: prependUnique(prev.expenses, expense) };
    }

    case EXPENSES_SETTLED: {
      // The expenses that were on the tab when it was settled, by id - not
      // "everything". An expense the other phone added in the same moment,
      // before this arrived, is still owed and stays.
      if (!Array.isArray(payload.ids)) return null;
      const settled = new Set(payload.ids.filter(isText));
      return { ...prev, expenses: prev.expenses.filter(e => !settled.has(e.id)) };
    }

    case JOURNAL_SHARED: {
      if (!isText(payload.title) || !isText(payload.content)) return null;
      const author = payload.authorId === 'user' || payload.authorId === 'partner' ? payload.authorId : authorId;
      const entry: JournalEntry = {
        id: payload.id,
        at: Number.isFinite(Number(payload.at)) ? Number(payload.at) : undefined,
        authorId: author,
        authorName: fromRole(author, me),
        title: payload.title,
        content: payload.content,
        date: isText(payload.date) ? payload.date : '',
        isPrivate: false
      };
      // Replaces a private copy of the same entry on the author's other phone,
      // which is how "share this" reaches that phone too.
      return { ...prev, journalEntries: prependUnique(prev.journalEntries, entry) };
    }

    case QUOTE_ADD: {
      if (!isText(payload.quote)) return null;
      const quote: QuoteItem = {
        id: payload.id,
        quote: payload.quote,
        author: fromRole(payload.author, me),
        isCustom: true
      };
      return { ...prev, quotes: prependUnique(prev.quotes, quote) };
    }

    case AGREEMENT_ADD: {
      if (!isText(payload.title) || !isText(payload.trigger) || !isText(payload.resolution)) return null;
      const agreement: AgreementItem = {
        id: payload.id,
        title: payload.title,
        trigger: payload.trigger,
        resolution: payload.resolution,
        date: isText(payload.date) ? payload.date : ''
      };
      return { ...prev, agreements: prependUnique(prev.agreements, agreement) };
    }

    case CYCLE_RECORD: {
      if (!PHASES.has(payload.phase) || !Number.isFinite(Number(payload.dayOfCycle))) return null;
      // The tracker's own other phone keeps its fuller local copy.
      if (authorId === me && prev.cycleRecords.some(r => r.id === payload.id)) return null;
      const record: CycleRecord = {
        id: payload.id,
        dayOfCycle: Number(payload.dayOfCycle),
        phase: payload.phase,
        energyLevel: Number(payload.energyLevel) || 0,
        mood: isText(payload.mood) ? payload.mood : '',
        symptoms: Array.isArray(payload.symptoms) ? payload.symptoms.filter(isText) : [],
        loggedDate: isText(payload.loggedDate) ? payload.loggedDate : ''
      };
      return { ...prev, cycleRecords: prependUnique(prev.cycleRecords, record) };
    }

    case MEMORY_ADD: {
      if (!isText(payload.title) || !isText(payload.desc)) return null;
      // Only a photo carried inside the memory itself. A web address here
      // would make the other phone fetch it - telling some server when a
      // memory was opened, and from where.
      const image =
        isText(payload.imageDataUrl) && payload.imageDataUrl.startsWith('data:image/')
          ? payload.imageDataUrl
          : undefined;
      const author: Role = payload.authorId === 'user' || payload.authorId === 'partner' ? payload.authorId : (authorId as Role);
      const memory: MemoryItem = {
        id: payload.id,
        title: payload.title,
        date: isText(payload.date) ? payload.date : '',
        tag: MEMORY_TAGS.has(payload.tag) ? payload.tag : 'Moment',
        desc: payload.desc,
        imageDataUrl: image,
        lockedUntil: isText(payload.lockedUntil) && /^\d{4}-\d{2}-\d{2}$/.test(payload.lockedUntil) ? payload.lockedUntil : undefined,
        authorId: author,
        authorName: fromRole(author, me)
      };
      return { ...prev, memories: prependUnique(prev.memories || [], memory) };
    }

    case LIST_ITEM_SET: {
      // The resulting state, not "toggle". A flip applied twice - a replay, a
      // second device - would land back where it started and tick an item
      // nobody ticked.
      const done = payload.isCompleted === true;
      return {
        ...prev,
        lists: prev.lists.map(item => (item.id === payload.id ? { ...item, isCompleted: done } : item))
      };
    }

    case LIST_ITEM_DELETE: {
      return { ...prev, lists: prev.lists.filter(item => item.id !== payload.id) };
    }

    case RITUAL_ADD: {
      if (!isText(payload.title)) return null;
      const ritual: RitualItem = {
        id: payload.id,
        title: payload.title,
        subtitle: isText(payload.subtitle) ? payload.subtitle : '',
        duration: isText(payload.duration) ? payload.duration : '',
        category: RITUAL_CATEGORIES.has(payload.category) ? payload.category : 'presence',
        completedTodayByUser: false,
        completedTodayByPartner: false,
        streakDays: 0
      };
      if (prev.rituals.some(r => r.id === ritual.id)) return null;
      return { ...prev, rituals: [...prev.rituals, ritual] };
    }

    case MILESTONE_ADD: {
      if (!isText(payload.title)) return null;
      const milestone: RelationshipMilestone = {
        id: payload.id,
        title: payload.title,
        date: isText(payload.date) ? payload.date : '',
        category: MILESTONE_CATEGORIES.has(payload.category) ? payload.category : 'growth',
        description: isText(payload.description) ? payload.description : '',
        photoUrl: isText(payload.photoUrl) && payload.photoUrl.startsWith('data:image/') ? payload.photoUrl : undefined
      };
      if (prev.milestones.some(m => m.id === milestone.id)) return null;
      return { ...prev, milestones: [...prev.milestones, milestone] };
    }

    case LETTER_OPENED: {
      // Only ever sets opened. A letter cannot become unread, and nothing
      // should be able to make it look that way.
      let changed = false;
      const letters: LoveLetter[] = prev.letters.map(letter => {
        if (letter.id !== payload.id || letter.isOpened) return letter;
        changed = true;
        return { ...letter, isOpened: true, openedDate: isText(payload.openedDate) ? payload.openedDate : 'Today' };
      });
      return changed ? { ...prev, letters } : null;
    }

    case WHISPER_MEMO: {
      if (!isText(payload.title)) return null;
      // Whatever the memo carries, minus anything that would make the other
      // phone fetch something: a recording is embedded or it is not there.
      const audio =
        isText(payload.audioDataUrl) && payload.audioDataUrl.startsWith('data:audio/')
          ? payload.audioDataUrl
          : undefined;
      const memo = {
        ...payload,
        audioDataUrl: audio,
        isListened: payload.isListened === true
      } as SpaceState['whisperMemos'][number];
      return { ...prev, whisperMemos: prependUnique(prev.whisperMemos, memo) };
    }

    case WHISPER_MEMO_HEARD: {
      let changed = false;
      const whisperMemos = prev.whisperMemos.map(memo => {
        if (memo.id !== payload.id || memo.isListened) return memo;
        changed = true;
        return { ...memo, isListened: true, listenedAt: 'Just now' };
      });
      return changed ? { ...prev, whisperMemos } : null;
    }

    case CYCLE_SHARING: {
      if (!LEVELS.has(payload.level)) return null;
      const level = payload.level as CycleSharingLevel;
      if (authorId === me) return { ...prev, cycleSharingLevel: level };

      // Sharing narrowed: what this phone already received is cut back to the
      // new level too, so taking something back actually takes it back.
      const kept = prev.cycleRecords
        .map(r => cycleRecordToWire(r, level))
        .filter((r): r is NonNullable<typeof r> => r !== null);
      let cycleRecords: CycleRecord[] = kept;
      const latest = payload.latest ? applySharedRecord(
        { ...prev, cycleRecords },
        CYCLE_RECORD,
        payload.latest,
        authorId
      ) : null;
      if (latest) cycleRecords = latest.cycleRecords;
      return { ...prev, cycleSharingLevel: level, cycleRecords };
    }
  }
  return null;
}
