// The playful bits of Home (components/UsScene, FunnyNumbersCard), worked out
// from what this phone already holds - the chat as it is here - and never
// sent anywhere: who said good morning first, who had the last word last
// night, how much you are missing each other, and the funny numbers.

import type { ChatMessage } from '../types';

export type Seat = 'user' | 'partner';

const HOUR = 60 * 60 * 1000;
/** A day starts at four in the morning: a message at 1am is still last night. */
const DAY_STARTS_AT_H = 4;

/** Something one of you said: not a call's line, not one taken back. */
function said(m: ChatMessage): boolean {
  return !m.call && !m.unsent && typeof m.sentAt === 'number' && (m.authorId === 'user' || m.authorId === 'partner');
}

/** The day a moment belongs to, starting at four in the morning, as "2026-11-03". */
export function chatDay(at: number): string {
  const d = new Date(at - DAY_STARTS_AT_H * HOUR);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Who said good morning first today - the first message of the day - and
 * for how many days in a row the same one of you has.
 */
export function goodMorning(messages: ChatMessage[], now = Date.now()): { winner: Seat | null; streak: number } {
  const firstOf = new Map<string, Seat>();
  for (const m of messages) {
    if (!said(m) || (m.sentAt as number) > now) continue;
    const day = chatDay(m.sentAt as number);
    if (!firstOf.has(day)) firstOf.set(day, m.authorId as Seat);
  }
  const today = chatDay(now);
  const winner = firstOf.get(today) ?? null;
  if (!winner) return { winner: null, streak: 0 };
  let streak = 0;
  for (let at = now; firstOf.get(chatDay(at)) === winner; at -= 24 * HOUR) streak++;
  return { winner, streak };
}

/** Who sent the last message last night (from 8pm until four), if anyone did. */
export function lastWordLastNight(messages: ChatMessage[], now = Date.now()): Seat | null {
  const today = new Date(now - DAY_STARTS_AT_H * HOUR);
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), DAY_STARTS_AT_H).getTime();
  const from = dayStart - 8 * HOUR;
  let last: Seat | null = null;
  for (const m of messages) {
    if (!said(m)) continue;
    const at = m.sentAt as number;
    if (at >= from && at < dayStart) last = m.authorId as Seat;
  }
  return last;
}

export type MissLevel = 0 | 1 | 2 | 3 | 4;

/**
 * How much you are missing each other: by how long it has been since either
 * of you said anything (or a call), and none at all while they are online.
 */
export function missLevel(messages: ChatMessage[], online: boolean, now = Date.now()): { level: MissLevel; since: number } {
  let last = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.unsent || typeof m.sentAt !== 'number' || m.sentAt > now) continue;
    last = m.sentAt;
    break;
  }
  if (online) return { level: 0, since: last };
  const gap = last ? now - last : Infinity;
  const level: MissLevel = gap < 0.5 * HOUR ? 0 : gap < 2 * HOUR ? 1 : gap < 6 * HOUR ? 2 : gap < 12 * HOUR ? 3 : 4;
  return { level, since: last };
}

export interface FunnyNumbers {
  messages: Record<Seat, number>;
  hearts: number;
  saptiya: number;
  missYou: Record<Seat, number>;
  sorry: Record<Seat, number>;
  nightOwl: number;
  photos: number;
  voiceMinutes: number;
  stickers: number;
  longestCallSeconds: number;
  callSeconds: number;
  topEmoji: { emoji: string; count: number } | null;
  /** The first message on this phone: what the numbers count from. */
  since: number;
  /** "Saptiya?" by who asked it. */
  saptiyaBy: Record<Seat, number>;
  /** Days each of you sent the day's first message - said good morning first. */
  firstHello: Record<Seat, number>;
  /** Nights (8pm to four) each of you sent the last message. */
  lastWord: Record<Seat, number>;
  /** "I love you", by who said it. */
  loveYou: Record<Seat, number>;
  chellam: number;
  kanna: number;
  goodNight: number;
  /** How long each of you usually takes to answer the other (the middle reply), in ms. */
  replyMs: Record<Seat, number | null>;
  /** The most days in a row with a message. */
  longestStreak: number;
  /** The hour of the day you two write the most, 0-23. */
  topHour: number | null;
  /** The day with the most messages. */
  busiestDay: { day: string; count: number } | null;
  /** The very first message on this phone. */
  first: { who: Seat; at: number; text: string; kind: 'text' | 'photo' | 'voice' | 'sticker' } | null;
}

const HEART_RE = /❤️|❤|♥️|💕|💖|💗|💓|💞|💘|💝|😍|🥰|😘/gu;
// With the colour selector that may follow it, so a red heart stays red.
const EMOJI_RE = /\p{Extended_Pictographic}️?/gu;
const SAPTIYA_RE = /\b(saa?p(p?|t)i?ya|saa?pd?ita|saptiya|sapteengala|saapteengala)\b/giu;
const MISS_YOU_RE = /\bmiss(ing)?\s*(you|u|ya)\b/giu;
const SORRY_RE = /\b(sorry|sry|sowwy|soory)\b/giu;
const LOVE_STICKERS = new Set(['love-you', 'mwah', 'hug', 'chellam', 'so-cute']);
const LOVE_YOU_RE = /\b(i\s*)?(love|luv|lub)\s*(you|u|ya)\b|\bily\b/giu;
const CHELLAM_RE = /\bchell?amm?(e|ey|a)?\b/giu;
const KANNA_RE = /\b(kanna|kannamma|kanne|kannu)\b/giu;
const GOOD_NIGHT_RE = /\b(good\s*night|gud\s*ni(ght|te|yt)|good\s*nyt|gn8?|gnite)\b/giu;
/** Longer than this between the two of you is a new conversation, not a reply. */
const REPLY_WITHIN_MS = 12 * HOUR;
/** The middle one: what is usual, which one slow evening does not move. */
function middle(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
/** Days since 1970, for "the next day" over month ends. */
const dayNumber = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / (24 * HOUR));
};

const count = (text: string, re: RegExp) => (text.match(re) || []).length;

/** The funny numbers, from every message on this phone. */
export function funnyNumbers(messages: ChatMessage[]): FunnyNumbers {
  const out: FunnyNumbers = {
    messages: { user: 0, partner: 0 },
    hearts: 0,
    saptiya: 0,
    missYou: { user: 0, partner: 0 },
    sorry: { user: 0, partner: 0 },
    nightOwl: 0,
    photos: 0,
    voiceMinutes: 0,
    stickers: 0,
    longestCallSeconds: 0,
    callSeconds: 0,
    topEmoji: null,
    since: 0,
    saptiyaBy: { user: 0, partner: 0 },
    firstHello: { user: 0, partner: 0 },
    lastWord: { user: 0, partner: 0 },
    loveYou: { user: 0, partner: 0 },
    chellam: 0,
    kanna: 0,
    goodNight: 0,
    replyMs: { user: null, partner: null },
    longestStreak: 0,
    topHour: null,
    busiestDay: null,
    first: null
  };
  const emojis = new Map<string, number>();
  const firstOfDay = new Map<string, Seat>();
  const lastOfNight = new Map<string, Seat>();
  const perDay = new Map<string, number>();
  const perHour = new Array<number>(24).fill(0);
  const replies: Record<Seat, number[]> = { user: [], partner: [] };
  let previous: { who: Seat; at: number } | null = null;
  for (const m of messages) {
    if (m.call) {
      out.callSeconds += m.call.seconds || 0;
      out.longestCallSeconds = Math.max(out.longestCallSeconds, m.call.seconds || 0);
      continue;
    }
    if (!said(m)) continue;
    const who = m.authorId as Seat;
    const sentAt = m.sentAt as number;
    if (!out.since) out.since = sentAt;
    if (!out.first) {
      const kind = m.isPhoto ? 'photo' : m.isVoiceMemo ? 'voice' : m.sticker ? 'sticker' : 'text';
      out.first = { who, at: sentAt, kind, text: kind === 'text' ? (m.text || '').slice(0, 80) : '' };
    }
    out.messages[who]++;
    const hour = new Date(sentAt).getHours();
    if (hour < DAY_STARTS_AT_H) out.nightOwl++;
    perHour[hour]++;
    const day = chatDay(sentAt);
    perDay.set(day, (perDay.get(day) || 0) + 1);
    if (!firstOfDay.has(day)) firstOfDay.set(day, who);
    if (hour >= 20 || hour < DAY_STARTS_AT_H) lastOfNight.set(day, who);
    if (previous && previous.who !== who && sentAt - previous.at > 0 && sentAt - previous.at <= REPLY_WITHIN_MS) {
      replies[who].push(sentAt - previous.at);
    }
    previous = { who, at: sentAt };
    for (const r of Object.values(m.reactions || {})) if (r && count(r, HEART_RE)) out.hearts++;
    if (m.isPhoto) out.photos++;
    if (m.isVoiceMemo) out.voiceMinutes += (m.audioDurationSeconds || 0) / 60;
    if (m.sticker) {
      out.stickers++;
      if (LOVE_STICKERS.has(m.sticker)) out.hearts++;
      if (m.sticker === 'saptiya') {
        out.saptiya++;
        out.saptiyaBy[who]++;
      }
      if (m.sticker === 'miss-you') out.missYou[who]++;
      if (m.sticker === 'sorry') out.sorry[who]++;
      if (m.sticker === 'love-you') out.loveYou[who]++;
      if (m.sticker === 'chellam') out.chellam++;
      if (m.sticker === 'good-night') out.goodNight++;
      continue;
    }
    if (m.isPhoto || m.isVoiceMemo) continue;
    const text = m.text || '';
    out.hearts += count(text, HEART_RE);
    const saptiya = count(text, SAPTIYA_RE);
    out.saptiya += saptiya;
    out.saptiyaBy[who] += saptiya;
    out.loveYou[who] += count(text, LOVE_YOU_RE);
    out.chellam += count(text, CHELLAM_RE);
    out.kanna += count(text, KANNA_RE);
    out.goodNight += count(text, GOOD_NIGHT_RE);
    out.missYou[who] += count(text, MISS_YOU_RE);
    out.sorry[who] += count(text, SORRY_RE);
    for (const e of text.match(EMOJI_RE) || []) emojis.set(e, (emojis.get(e) || 0) + 1);
  }
  out.voiceMinutes = Math.round(out.voiceMinutes);
  for (const [emoji, n] of emojis) if (!out.topEmoji || n > out.topEmoji.count) out.topEmoji = { emoji, count: n };
  for (const who of firstOfDay.values()) out.firstHello[who]++;
  for (const who of lastOfNight.values()) out.lastWord[who]++;
  out.replyMs = { user: middle(replies.user), partner: middle(replies.partner) };
  for (const [day, n] of perDay) if (!out.busiestDay || n > out.busiestDay.count) out.busiestDay = { day, count: n };
  const top = Math.max(...perHour);
  out.topHour = top > 0 ? perHour.indexOf(top) : null;
  // Days in a row: each day one after the last.
  const days = [...perDay.keys()].map(dayNumber).sort((a, b) => a - b);
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && d === days[i - 1] + 1 ? run + 1 : 1;
    out.longestStreak = Math.max(out.longestStreak, run);
  });
  return out;
}

/** What one of you can do to the other on Home (components/UsScene). */
export type PlayKind =
  | 'boop' | 'tickle' | 'pinch' | 'pat' | 'pillow'
  | 'hug' | 'kiss' | 'feed' | 'nuzzle' | 'flower'
  | 'highfive' | 'balloon' | 'tease' | 'dance' | 'tuck';
export const PLAY_KINDS: readonly PlayKind[] = [
  'boop', 'tickle', 'pinch', 'pat', 'pillow',
  'hug', 'kiss', 'feed', 'nuzzle', 'flower',
  'highfive', 'balloon', 'tease', 'dance', 'tuck'
];

/**
 * What a phone with an older Two does with a play it does not know: a boop.
 * So both phones need the version that has the newer plays.
 */

export function cleanPlayKind(raw: unknown): PlayKind {
  return PLAY_KINDS.includes(raw as PlayKind) ? (raw as PlayKind) : 'boop';
}

/**
 * The boop battle, as kept on this phone: how many boops (and tickles,
 * pats...) each of you has sent today and this week, and last week's two
 * totals for its trophy. Weeks start on Monday; days at four in the morning.
 */
export interface Boops {
  day: string;
  user: number;
  partner: number;
  week?: string;
  weekUser?: number;
  weekPartner?: number;
  lastWeek?: { week: string; user: number; partner: number };
}

/** The Monday a day's week starts on, as "2026-11-02". */
export function weekOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1, 12);
  const back = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - back);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekBefore(week: string): string {
  const [y, m, d] = week.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, (d || 1) - 7, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * `boops` as of `today`: yesterday's counts start again at nothing, and a
 * week that has ended becomes last week, for its trophy.
 */
export function boopsFor(boops: Boops | undefined, today: string): Boops {
  const week = weekOf(today);
  const out: Boops = {
    day: today,
    user: boops && boops.day === today ? boops.user : 0,
    partner: boops && boops.day === today ? boops.partner : 0,
    week,
    weekUser: boops && boops.week === week ? boops.weekUser || 0 : 0,
    weekPartner: boops && boops.week === week ? boops.weekPartner || 0 : 0
  };
  const previous = weekBefore(week);
  if (boops?.week === previous) {
    out.lastWeek = { week: previous, user: boops.weekUser || 0, partner: boops.weekPartner || 0 };
  } else if (boops?.lastWeek?.week === previous) {
    out.lastWeek = boops.lastWeek;
  }
  return out;
}

/** The weekly champion - last week's, for the trophy - or null for a draw or nobody. */
export function champion(totals: { user: number; partner: number } | undefined): Seat | null {
  if (!totals || totals.user === totals.partner) return null;
  return totals.user > totals.partner ? 'user' : 'partner';
}

/** One more from `seat`, today and this week. */
export function addBoop(boops: Boops | undefined, seat: Seat, today: string): Boops {
  const now = boopsFor(boops, today);
  return seat === 'user'
    ? { ...now, user: now.user + 1, weekUser: (now.weekUser || 0) + 1 }
    : { ...now, partner: now.partner + 1, weekPartner: (now.weekPartner || 0) + 1 };
}

/**
 * The counts a phone sent (BOOP): how many it has sent today and this week,
 * so a count is only ever raised - a replay or a late one changes nothing.
 * A phone from before weeks sends only today's.
 */
export function withBoopCount(
  boops: Boops | undefined,
  seat: Seat,
  sent: { day: string; count: number; week?: string; weekCount?: number },
  today: string
): Boops | null {
  const now = boopsFor(boops, today);
  const clean = (n: unknown) => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.min(Math.floor(Number(n)), 99_999) : -1);
  let changed = false;
  const next = { ...now };
  const day = clean(sent.count);
  if (sent.day === today && day > now[seat]) {
    next[seat] = day;
    changed = true;
  }
  const weekly = clean(sent.weekCount);
  const key = seat === 'user' ? 'weekUser' : 'weekPartner';
  if (sent.week === now.week && weekly > (now[key] || 0)) {
    next[key] = weekly;
    changed = true;
  }
  return changed ? next : null;
}
