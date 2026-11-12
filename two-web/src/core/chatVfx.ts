// Effects in the chat (components/ChatVfx): a message that is nothing but
// one of these emoji is drawn large, and plays over the whole conversation -
// once as it arrives, and again each time either of you taps it.
//
// The message itself is an ordinary one: a phone without this shows the
// emoji as it always did. A tap is said down the relay's unkept channel
// (ws.sendSignal, as an emote in a game is), so the other phone plays it at
// the same moment if it has the chat open. Nothing about it is kept.

import type { SoundName } from './sounds';

export const VFX_SIGNAL = 'CHAT_VFX';

export type VfxId =
  | 'heart' | 'fire' | 'laugh' | 'party' | 'kiss' | 'broken' | 'rose' | 'ghost'
  | 'adore' | 'rage' | 'sparkle' | 'diamond' | 'butterfly' | 'rocket' | 'bolt' | 'balloon';

export interface Vfx {
  id: VfxId;
  emoji: string;
  /** What it is called, for a screen reader. */
  name: string;
  sound: SoundName;
  /** How long it plays, in milliseconds. */
  ms: number;
}

/** Their order is what a tap sends, so it is only ever added to. */
export const VFX: readonly Vfx[] = [
  { id: 'heart', emoji: '❤️', name: 'Hearts', sound: 'vx-heart', ms: 3200 },
  { id: 'fire', emoji: '🔥', name: 'Fire', sound: 'vx-fire', ms: 3200 },
  { id: 'laugh', emoji: '😂', name: 'Laughing', sound: 'vx-laugh', ms: 3200 },
  { id: 'party', emoji: '🎉', name: 'Confetti', sound: 'vx-party', ms: 3400 },
  { id: 'kiss', emoji: '😘', name: 'Kisses', sound: 'vx-kiss', ms: 2800 },
  { id: 'broken', emoji: '💔', name: 'Broken heart', sound: 'vx-broken', ms: 3000 },
  { id: 'rose', emoji: '🌹', name: 'Rose petals', sound: 'vx-rose', ms: 4600 },
  { id: 'ghost', emoji: '👻', name: 'Ghost', sound: 'vx-ghost', ms: 3200 },
  { id: 'adore', emoji: '🥰', name: 'Adoring', sound: 'vx-adore', ms: 3400 },
  { id: 'rage', emoji: '😡', name: 'Angry', sound: 'vx-rage', ms: 2600 },
  { id: 'sparkle', emoji: '✨', name: 'Sparkles', sound: 'vx-sparkle', ms: 3400 },
  { id: 'diamond', emoji: '💎', name: 'Diamonds', sound: 'vx-diamond', ms: 3200 },
  { id: 'butterfly', emoji: '🦋', name: 'Butterflies', sound: 'vx-butterfly', ms: 4200 },
  { id: 'rocket', emoji: '🚀', name: 'Rocket', sound: 'vx-rocket', ms: 3200 },
  { id: 'bolt', emoji: '⚡', name: 'Lightning', sound: 'vx-bolt', ms: 2400 },
  { id: 'balloon', emoji: '🎈', name: 'Balloons', sound: 'vx-balloon', ms: 4200 }
];

/** An emoji with the "draw me as a picture" mark some keyboards add taken off. */
const bare = (text: string) => text.replace(/️/g, '').trim();
const BY_EMOJI = new Map(VFX.map(v => [bare(v.emoji), v]));

/** The effect a message plays: only when the emoji is all there is of it. */
export function vfxOf(text: string | undefined): Vfx | null {
  if (!text || text.length > 8) return null;
  return BY_EMOJI.get(bare(text)) ?? null;
}

export interface VfxSaid {
  /** Which effect: its place in VFX. */
  k: number;
  /** The message that was tapped, so it starts from where that one is. */
  m?: string;
}

/** Only what a tap could have said. */
export function cleanVfxSaid(raw: unknown): VfxSaid | null {
  const r = raw as { k?: unknown; m?: unknown } | null;
  if (!r || typeof r !== 'object') return null;
  const k = Number(r.k);
  if (!Number.isInteger(k) || k < 0 || k >= VFX.length) return null;
  return typeof r.m === 'string' && r.m.length <= 80 ? { k, m: r.m } : { k };
}

type Sender = (said: VfxSaid) => void;
let sender: Sender | null = null;
/** App gives the way out: the relay's unkept channel. */
export function setVfxSender(fn: Sender | null) {
  sender = fn;
}
export function sayVfx(said: VfxSaid) {
  try {
    sender?.(said);
  } catch {
    /* not connected: it still plays here */
  }
}

const hearers = new Set<(said: VfxSaid) => void>();
/** The chat on this screen listens for their taps. */
export function onVfx(fn: (said: VfxSaid) => void): () => void {
  hearers.add(fn);
  return () => {
    hearers.delete(fn);
  };
}
/** A tap from the other phone, as it arrives. True when a chat was there to play it. */
export function hearVfx(raw: unknown): boolean {
  const said = cleanVfxSaid(raw);
  if (!said || !hearers.size) return false;
  hearers.forEach(fn => fn(said));
  return true;
}

/** No more than one effect this often from a tap: a finger drumming on it is one effect. */
export const VFX_EVERY_MS = 700;
/** A message this new, arriving while the chat is open, plays by itself. */
export const VFX_FRESH_MS = 60_000;

/**
 * Numbers that look thrown but come out the same for the same seed, so an
 * effect is laid out once and stays put while it plays.
 */
export function scatter(seed: number): () => number {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
