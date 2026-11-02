// Two's own stickers: drawn inside the app (components/StickerArt), so a
// sticker travels as nothing but its name, inside the same encrypted message
// as words do. Nothing is fetched from anywhere, and it goes at once on a
// weak connection.
//
// A message's `text` holds "Sticker", for notifications and older phones.

export type StickerSet = 'us' | 'faces';

export interface StickerInfo {
  id: string;
  /** What it says, for a screen reader and the tray; in English, looked up when shown. */
  label: string;
  set: StickerSet;
}

/** In the order the tray shows them. */
export const STICKERS: readonly StickerInfo[] = [
  // The bear and the bunny.
  { id: 'hug', label: 'Hug', set: 'us' },
  { id: 'love-you', label: 'Love you', set: 'us' },
  { id: 'mwah', label: 'Mwah', set: 'us' },
  { id: 'miss-you', label: 'Miss you', set: 'us' },
  { id: 'saptiya', label: 'Saptiya?', set: 'us' },
  { id: 'good-morning', label: 'Good morning', set: 'us' },
  { id: 'good-night', label: 'Good night', set: 'us' },
  { id: 'sorry', label: 'Sorry', set: 'us' },
  { id: 'hmph', label: 'Hmph!', set: 'us' },
  { id: 'on-my-way', label: 'On my way', set: 'us' },
  { id: 'call-me', label: 'Call me', set: 'us' },
  { id: 'hehe', label: 'Hehe', set: 'us' },
  { id: 'yay', label: 'Yay!', set: 'us' },
  { id: 'chellam', label: 'Chellam', set: 'us' },
  { id: 'peek', label: 'Hi', set: 'us' },
  { id: 'mine', label: 'Mine!', set: 'us' },
  // Funny faces.
  { id: 'lol', label: 'LOL', set: 'faces' },
  { id: 'seri', label: 'Seri', set: 'faces' },
  { id: 'enna', label: 'Enna?!', set: 'faces' },
  { id: 'noooo', label: 'Noooo', set: 'faces' },
  { id: 'so-cute', label: 'So cute', set: 'faces' },
  { id: 'grr', label: 'Grr', set: 'faces' },
  { id: 'sleepy', label: 'Sleepy', set: 'faces' },
  { id: 'cool', label: 'Cool', set: 'faces' },
  { id: 'dying', label: 'Dying', set: 'faces' },
  { id: 'ugh', label: 'Ugh', set: 'faces' },
  { id: 'hmm', label: 'Hmm…', set: 'faces' },
  { id: 'party', label: 'Party!', set: 'faces' },
  { id: 'nope', label: 'Nope', set: 'faces' },
  { id: 'pls', label: 'Pls', set: 'faces' }
];

const BY_ID = new Map(STICKERS.map(s => [s.id, s]));

export function stickerInfo(id: string | undefined): StickerInfo | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/**
 * A sticker's name as it came from another phone: kept only if it looks like
 * one. One this version does not know (from a newer pack) is still kept, and
 * shows as its words, "Sticker", until this phone is updated.
 */
export function cleanStickerId(raw: unknown): string | undefined {
  return typeof raw === 'string' && /^[a-z0-9-]{1,40}$/.test(raw) ? raw : undefined;
}

/** The words a sticker message carries, for notifications and older phones. */
export const STICKER_TEXT = 'Sticker';

// The ones you sent last, newest first: this phone's own convenience, kept
// in its browser storage and never sent.
const RECENT_KEY = 'two.recentStickers';
const RECENT_MAX = 8;

export function recentStickers(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(id => typeof id === 'string' && BY_ID.has(id)).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberSticker(id: string): string[] {
  const next = [id, ...recentStickers().filter(x => x !== id)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the tray just shows no recents */
  }
  return next;
}
