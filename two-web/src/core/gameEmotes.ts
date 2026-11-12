// Emotes in the games on Canvas of Us, and knowing whether the other one is
// looking at the same game (components/Emotes).
//
// Both go down the relay's unkept channel (ws.sendSignal, as "typing..." and
// a striker being aimed do): an emote is for the moment it is made, and "I am
// on this game's screen" is only true for the next few seconds. Nothing is
// kept anywhere, and a game plays exactly the same without any of it.
//
// A phone says which game it has on screen when it opens one, every few
// seconds while it stays there, and once more as it leaves. The other phone
// uses that for the mark by your name in the game - and, when it is somewhere
// else in Two, for a small pop-up that takes it straight to that game.

import type { PaperKind } from './paperGames';
import { PAPER_KINDS } from './paperGames';
import type { SoundName } from './sounds';

export const GAME_SAY_SIGNAL = 'GAME_SAY';
/** A phone that has emotes (said with its version, App's CAN_DO). */
export const CAN_EMOTE = 'emotes-1';

/** A game with a screen of its own that the two of you can both be on. */
export type GameRoom = PaperKind | 'maze';
const ROOMS: string[] = [...PAPER_KINDS, 'maze'];
export const isGameRoom = (value: unknown): value is GameRoom => typeof value === 'string' && ROOMS.includes(value);

export interface Emote {
  id: 'laugh' | 'cry' | 'angry' | 'thumb' | 'kiss' | 'shock' | 'tease' | 'yawn' | 'cool' | 'evil';
  /** What it is called, for a screen reader. */
  name: string;
  /** Its own sound. */
  sound: SoundName;
  /** The nearest thing in plain emoji, for the pop-up on another screen. */
  emoji: string;
}

/** Each of you sends them as your own one: the bear or the bunny. Their order is what is sent, so it is only ever added to. */
export const EMOTES: readonly Emote[] = [
  { id: 'laugh', name: 'Laugh', sound: 'e-laugh', emoji: '😂' },
  { id: 'cry', name: 'Cry', sound: 'e-cry', emoji: '😭' },
  { id: 'angry', name: 'Angry', sound: 'e-angry', emoji: '😡' },
  { id: 'thumb', name: 'Thumbs up', sound: 'e-thumb', emoji: '👍' },
  { id: 'kiss', name: 'Kiss', sound: 'e-kiss', emoji: '😘' },
  { id: 'shock', name: 'Shocked', sound: 'e-shock', emoji: '😱' },
  { id: 'tease', name: 'Tease', sound: 'e-tease', emoji: '😜' },
  { id: 'yawn', name: 'Yawn', sound: 'e-yawn', emoji: '🥱' },
  { id: 'cool', name: 'Too cool', sound: 'e-cool', emoji: '😎' },
  { id: 'evil', name: 'Evil laugh', sound: 'e-evil', emoji: '😈' }
];

/** How long an emote stays up. */
export const EMOTE_MS = 3000;
/** No more than one this often from a phone. */
export const EMOTE_EVERY_MS = 500;
/** How often a phone says it is still on a game's screen. */
export const HERE_EVERY_MS = 8000;
/** They are taken to be on it for this long after last saying so: two misses and a bit. */
export const HERE_FOR_MS = 20_000;
/** Not heard on a game for this long, the next word from it is them coming in. */
const ARRIVING_AFTER_MS = 30_000;
/** A pop-up about them playing a game, no more than this often for the same game. */
const PLAYING_POP_EVERY_MS = 2 * 60_000;
/** A pop-up about an emote, no more than this often. */
const EMOTE_POP_EVERY_MS = 3000;

export interface GameSaid {
  /** Which game. */
  k: GameRoom;
  /** An emote: its place in EMOTES. */
  e?: number;
  /** On that game's screen (1), or just left it (0). */
  h?: 0 | 1;
}

/** Only what a game could have said. */
export function cleanSaid(raw: unknown): GameSaid | null {
  const r = raw as { k?: unknown; e?: unknown; h?: unknown } | null;
  if (!r || typeof r !== 'object' || !isGameRoom(r.k)) return null;
  const said: GameSaid = { k: r.k };
  if (r.e !== undefined) {
    const e = Number(r.e);
    if (!Number.isInteger(e) || e < 0 || e >= EMOTES.length) return null;
    said.e = e;
  }
  if (r.h !== undefined) {
    if (r.h !== 0 && r.h !== 1) return null;
    said.h = r.h;
  }
  return said.e === undefined && said.h === undefined ? null : said;
}

type Sender = (said: GameSaid) => void;
let sender: Sender | null = null;
/** App gives the way out: the relay's unkept channel. */
export function setSaySender(fn: Sender | null) {
  sender = fn;
}
export function sayInGame(said: GameSaid) {
  try {
    sender?.(said);
  } catch {
    /* not connected: nothing to tell */
  }
}

// ---------------------------------------------------------- this phone's side

let onScreen: GameRoom | null = null;
/** The game on this phone's screen now, or none. */
export const roomOnScreen = () => onScreen;
export function showRoom(room: GameRoom | null) {
  onScreen = room;
}
/** A game leaving the screen: only if it is still the one there (another may have opened first). */
export function leaveRoom(room: GameRoom) {
  if (onScreen === room) onScreen = null;
}

const MUTED_KEY = 'two_emotes_muted';
let muted: boolean | null = null;
/** Their emotes are not shown or heard. Kept on this phone. */
export function emotesMuted(): boolean {
  if (muted === null) {
    try {
      muted = localStorage.getItem(MUTED_KEY) === '1';
    } catch {
      muted = false;
    }
  }
  return muted;
}
export function muteEmotes(on: boolean) {
  muted = on;
  try {
    if (on) localStorage.setItem(MUTED_KEY, '1');
    else localStorage.removeItem(MUTED_KEY);
  } catch {
    /* it holds until Two is closed */
  }
}

// ------------------------------------------------------------- hearing them

/** When they last said they were on each game's screen. */
const hereAt = new Map<GameRoom, number>();
const playingPopAt = new Map<GameRoom, number>();
let emotePopAt = 0;

/** Whether they are on this game's screen, as far as this phone has heard. */
export const theyAreHere = (room: GameRoom, now = Date.now()) => now - (hereAt.get(room) ?? 0) < HERE_FOR_MS;

type Listener = (said: GameSaid) => void;
const listeners = new Set<Listener>();
/** The game on screen listens here. Returns how to stop. */
export function onGameSaid(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** What to tell this phone's owner in a pop-up, when they are not looking at that game. */
export type GamePop = { room: GameRoom; kind: 'emote'; emote: Emote } | { room: GameRoom; kind: 'playing' };

/**
 * Something from the other phone, as it arrived. The game on screen is told;
 * and when this phone is anywhere else, what comes back is the pop-up to
 * show, if any: an emote they sent, or that they have just started on a game.
 */
export function hearGameSaid(raw: unknown, now = Date.now()): GamePop | null {
  const said = cleanSaid(raw);
  if (!said) return null;
  const before = hereAt.get(said.k) ?? 0;
  // An emote is them being there too; leaving is the only thing that is not.
  hereAt.set(said.k, said.h === 0 ? 0 : now);
  listeners.forEach(listener => {
    try {
      listener(said);
    } catch {
      /* one listener failing does not stop the rest */
    }
  });
  if (onScreen === said.k) return null;
  if (said.e !== undefined) {
    if (emotesMuted() || now - emotePopAt < EMOTE_POP_EVERY_MS) return null;
    emotePopAt = now;
    return { room: said.k, kind: 'emote', emote: EMOTES[said.e] };
  }
  if (said.h === 1 && now - before > ARRIVING_AFTER_MS && now - (playingPopAt.get(said.k) ?? 0) > PLAYING_POP_EVERY_MS) {
    playingPopAt.set(said.k, now);
    return { room: said.k, kind: 'playing' };
  }
  return null;
}

/** Forgets everything heard and shown (for the tests). */
export function forgetEmotesForTest() {
  hereAt.clear();
  playingPopAt.clear();
  emotePopAt = 0;
  onScreen = null;
  muted = null;
  listeners.clear();
  sender = null;
}

/** The event that takes Canvas of Us to a game, from a pop-up tapped while it is already open. */
export const OPEN_GAME_EVENT = 'two:open-game';
