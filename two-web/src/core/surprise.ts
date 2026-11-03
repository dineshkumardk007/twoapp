// A surprise one of you plans for the other (components/SurprisePlanner,
// SurpriseReveal) - a birthday at midnight, say. It travels to the other
// phone days ahead, sealed: nothing shows there, no notice and no dot, and
// it opens by itself at the moment chosen, on that phone's own clock, with
// or without a connection then.
//
// The letter and settings are one small record; each photo and the voice
// note is a record of its own (SURPRISE_PART), since a record holds about a
// megabyte. The other phone says when it has every piece (SURPRISE_READY)
// and when it has been opened (SURPRISE_SEEN), so the one who planned it
// knows it is waiting there - and when it was seen.

import type { Seat } from './usTwo';

export const SURPRISE = 'SURPRISE';
export const SURPRISE_PART = 'SURPRISE_PART';
export const SURPRISE_READY = 'SURPRISE_READY';
export const SURPRISE_SEEN = 'SURPRISE_SEEN';

export const MAX_SURPRISE_PHOTOS = 6;
export const MAX_LETTER_CHARS = 4_000;
export const MAX_TITLE_CHARS = 80;
/** A piece bigger than this cannot have come from this app. */
const MAX_PART_CHARS = 1_000_000;
/** How long after its moment a surprise still opens by itself: a week. */
export const OPEN_FOR_MS = 7 * 24 * 60 * 60 * 1000;
/** Pieces still on their way are waited for this long past the moment; then it opens with what has come. */
export const WAIT_FOR_PARTS_MS = 30 * 60 * 1000;

export interface SurprisePlan {
  id: string;
  /** Who planned it. It opens on the other one's phone. */
  author: Seat;
  /** The day, 'YYYY-MM-DD', and the time, 'HH:MM', it opens - on the other phone's clock. */
  day: string;
  time: string;
  title: string;
  letter: string;
  /** Shown on the cake, if given. */
  age?: number;
  /** Happy Birthday plays as the cake comes in. */
  song: boolean;
  /** Its photos' ids, in order, and its voice note's (SurpriseMedia). */
  photoIds: string[];
  voiceId?: string;
  updatedAt: number;
  cancelled?: boolean;
}

export interface SurpriseMedia {
  id: string;
  surpriseId: string;
  kind: 'photo' | 'voice';
  /** data:image/... or data:audio/... */
  dataUrl: string;
  durationSeconds?: number;
  peaks?: number[];
}

export interface SurpriseBook {
  /** The newest plan from each of you. */
  plans: SurprisePlan[];
  /** Their photos and voice notes, by id. */
  media: Record<string, SurpriseMedia>;
  /** Opened on this phone, so each opens by itself only once. */
  opened: string[];
  /** For a plan of mine: the other phone has every piece of this version (its updatedAt). */
  ready: Record<string, number>;
  /** For a plan of mine: when the other one opened it. */
  seen: Record<string, number>;
  /** For a plan of theirs: the version this phone last said it has in full, so that is said once. */
  saidReady: Record<string, number>;
}

export const EMPTY_BOOK: SurpriseBook = { plans: [], media: {}, opened: [], ready: {}, seen: {}, saidReady: {} };
export const bookOf = (b?: Partial<SurpriseBook> | null): SurpriseBook => ({ ...EMPTY_BOOK, ...(b || {}) });

/** A day as 'YYYY-MM-DD', on this phone's clock. */
export function localDay(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** When a plan opens, on this phone's clock. */
export function opensAt(plan: Pick<SurprisePlan, 'day' | 'time'>): number {
  const [y, m, d] = plan.day.split('-').map(Number);
  const [hh, mm] = plan.time.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).getTime();
}

/** Every photo and the voice note it lists are here. */
export function isComplete(plan: SurprisePlan, media: Record<string, SurpriseMedia>): boolean {
  return plan.photoIds.every(id => !!media[id]) && (!plan.voiceId || !!media[plan.voiceId]);
}

const theirs = (book: SurpriseBook, me: Seat) =>
  book.plans.filter(p => p.author !== me && !p.cancelled && !book.opened.includes(p.id));

/**
 * The surprise to open on this phone now, if there is one: theirs, its moment
 * come and not a week gone, not opened yet - and every piece here, or half
 * an hour waited for the rest.
 */
export function dueSurprise(book: SurpriseBook, me: Seat, now: number): SurprisePlan | null {
  for (const p of theirs(book, me)) {
    const at = opensAt(p);
    if (now < at || now > at + OPEN_FOR_MS) continue;
    if (!isComplete(p, book.media) && now < at + WAIT_FOR_PARTS_MS) continue;
    return p;
  }
  return null;
}

/** When to look again: the next of theirs to open, or the end of a wait for its pieces. */
export function nextCheck(book: SurpriseBook, me: Seat, now: number): number | null {
  let next: number | null = null;
  for (const p of theirs(book, me)) {
    const at = opensAt(p);
    const when = now < at ? at : !isComplete(p, book.media) && now < at + WAIT_FOR_PARTS_MS ? at + WAIT_FOR_PARTS_MS : null;
    if (when !== null && (next === null || when < next)) next = when;
  }
  return next;
}

/**
 * Whose day it is today, if a surprise is for today: the one it is for.
 * "Us two" has a party all day (components/UsScene).
 */
export function partyFor(book: SurpriseBook, now: number): Seat | null {
  const today = localDay(now);
  const plan = book.plans.find(p => !p.cancelled && p.day === today);
  if (!plan) return null;
  return plan.author === 'user' ? 'partner' : 'user';
}

/**
 * A plan, kept if it is the newest from its author (one plan each), and the
 * pieces of their older plans let go.
 */
export function withPlan(book: SurpriseBook, plan: SurprisePlan): SurpriseBook {
  const current = book.plans.find(p => p.author === plan.author);
  if (current && current.id === plan.id && current.updatedAt >= plan.updatedAt) return book;
  const plans = [...book.plans.filter(p => p.author !== plan.author), plan];
  const live = new Set(plans.map(p => p.id));
  const media: Record<string, SurpriseMedia> = {};
  for (const [id, m] of Object.entries(book.media)) if (live.has(m.surpriseId)) media[id] = m;
  return { ...book, plans, media };
}

/** A photo or voice note of a plan - even one ahead of its plan, which may still be on its way. */
export function withMedia(book: SurpriseBook, part: SurpriseMedia): SurpriseBook {
  if (book.media[part.id]) return book;
  return { ...book, media: { ...book.media, [part.id]: part } };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** A plan as it arrives, checked: anything not shaped as one is nothing. */
export function cleanPlan(raw: any, author: Seat): SurprisePlan | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !/^[a-z0-9-]{4,60}$/i.test(raw.id)) return null;
  if (typeof raw.day !== 'string' || !DAY_RE.test(raw.day)) return null;
  const time = typeof raw.time === 'string' && TIME_RE.test(raw.time) ? raw.time : '00:00';
  const ids = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length <= 60).slice(0, MAX_SURPRISE_PHOTOS) : [];
  const age = Number(raw.age);
  return {
    id: raw.id,
    author,
    day: raw.day,
    time,
    title: String(raw.title ?? '').slice(0, MAX_TITLE_CHARS),
    letter: String(raw.letter ?? '').slice(0, MAX_LETTER_CHARS),
    ...(Number.isInteger(age) && age > 0 && age < 130 ? { age } : {}),
    song: raw.song !== false,
    photoIds: ids(raw.photoIds),
    ...(typeof raw.voiceId === 'string' && raw.voiceId.length <= 60 ? { voiceId: raw.voiceId } : {}),
    updatedAt: Number(raw.updatedAt) || 0,
    ...(raw.cancelled === true ? { cancelled: true } : {})
  };
}

/** A piece as it arrives, checked. */
export function cleanMedia(raw: any): SurpriseMedia | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || raw.id.length > 60 || typeof raw.surpriseId !== 'string') return null;
  const kind = raw.kind === 'voice' ? 'voice' : raw.kind === 'photo' ? 'photo' : null;
  if (!kind || typeof raw.dataUrl !== 'string' || raw.dataUrl.length > MAX_PART_CHARS) return null;
  if (!raw.dataUrl.startsWith(kind === 'photo' ? 'data:image/' : 'data:audio/')) return null;
  const duration = Number(raw.durationSeconds);
  return {
    id: raw.id,
    surpriseId: raw.surpriseId,
    kind,
    dataUrl: raw.dataUrl,
    ...(kind === 'voice' && Number.isFinite(duration) && duration > 0 ? { durationSeconds: duration } : {}),
    ...(kind === 'voice' && Array.isArray(raw.peaks) ? { peaks: raw.peaks.slice(0, 64).map((n: unknown) => Math.max(0, Math.min(100, Number(n) || 0))) } : {})
  };
}

// The party day, for what is not drawn with the book in hand (the sticker tray).
let partySeat: Seat | null = null;
export function setPartyToday(seat: Seat | null) {
  partySeat = seat;
}
/** Today is a party in "Us two": the birthday stickers are out. */
export function isPartyToday(): boolean {
  return partySeat !== null;
}
