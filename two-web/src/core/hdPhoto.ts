// HD photos: the HD button when sending.
//
// Every photo still goes as it always has - shrunk to fit one record (core/
// photo), shown at once, and all an older phone ever sees. With HD on, the
// same photo goes a second time beside it, much larger (up to 2560 pixels on
// the long side), cut into pieces because no one record can hold it: one
// CHAT_PHOTO_PART (GROUP_PHOTO_PART in a group) each, encrypted like any
// record. The message names the HD copy (`photoHd`); the phone that receives
// every piece puts them back together, keeps the HD copy in its photo store
// - not in memory, where a chat full of them would not fit - and opens it
// when the photo is opened full screen or saved.
//
// The relay keeps only the newest pieces (two-server CAPPED_TYPES): a phone
// set up again gets the ordinary photo of older ones, never nothing.

/** One piece: as much as a photo has always been allowed in one record. */
export const HD_PART_CHARS = 600_000;
export const HD_MAX_PARTS = 6;
export const HD_MAX_CHARS = HD_PART_CHARS * HD_MAX_PARTS;
const MAX_SIDE = 8192;

export const CHAT_PHOTO_PART = 'CHAT_PHOTO_PART';
export const GROUP_PHOTO_PART = 'GROUP_PHOTO_PART';

/** What a message says of its HD copy. */
export interface HdInfo {
  id: string;
  width: number;
  height: number;
  parts: number;
}

/** One piece of an HD copy, as it travels. */
export interface HdPart {
  photoId: string;
  index: number;
  total: number;
  data: string;
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function newHdId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return 'hd' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** The pieces `dataUrl` travels in. */
export function splitHd(photoId: string, dataUrl: string): HdPart[] {
  const total = Math.max(1, Math.ceil(dataUrl.length / HD_PART_CHARS));
  return Array.from({ length: total }, (_, index) => ({
    photoId,
    index,
    total,
    data: dataUrl.slice(index * HD_PART_CHARS, (index + 1) * HD_PART_CHARS)
  }));
}

/** A message's HD note as it came from another phone: kept only if it is one. */
export function cleanHdInfo(raw: unknown): HdInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' && ID_RE.test(r.id) ? r.id : '';
  const side = (v: unknown) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 && n <= MAX_SIDE ? n : 0;
  };
  const parts = Math.round(Number(r.parts));
  const width = side(r.width);
  const height = side(r.height);
  if (!id || !width || !height || !(parts >= 1 && parts <= HD_MAX_PARTS)) return undefined;
  return { id, width, height, parts };
}

/** A piece as it came from another phone, or null. */
export function cleanHdPart(raw: unknown): HdPart | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const photoId = typeof r.photoId === 'string' && ID_RE.test(r.photoId) ? r.photoId : '';
  const total = Number(r.total);
  const index = Number(r.index);
  if (!photoId || !Number.isInteger(total) || total < 1 || total > HD_MAX_PARTS) return null;
  if (!Number.isInteger(index) || index < 0 || index >= total) return null;
  if (typeof r.data !== 'string' || !r.data || r.data.length > HD_PART_CHARS) return null;
  return { photoId, index, total, data: r.data };
}

/** Pieces not completed within this are let go: what came is all that will. */
const GIVE_UP_MS = 30 * 60 * 1000;

/**
 * Puts the pieces back together, in memory, until the last arrives. The same
 * piece twice changes nothing; a whole that is not a JPEG data: URL within
 * the limit is thrown away.
 */
export class HdAssembler {
  private waiting = new Map<string, { total: number; parts: Array<string | undefined>; got: number; at: number }>();

  /** The whole photo once `part` completes it; otherwise null. `scope` keeps a group's apart from the couple's. */
  add(scope: string, part: HdPart, now = Date.now()): string | null {
    for (const [key, entry] of this.waiting) if (now - entry.at > GIVE_UP_MS) this.waiting.delete(key);
    const key = `${scope}:${part.photoId}`;
    let entry = this.waiting.get(key);
    if (!entry || entry.total !== part.total) {
      entry = { total: part.total, parts: new Array(part.total), got: 0, at: now };
      this.waiting.set(key, entry);
    }
    if (entry.parts[part.index] === undefined) {
      entry.parts[part.index] = part.data;
      entry.got++;
    }
    if (entry.got < entry.total) return null;
    this.waiting.delete(key);
    const whole = entry.parts.join('');
    return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(whole) && whole.length <= HD_MAX_CHARS ? whole : null;
  }
}

// The HD switch remembers its last answer, on this phone only.
const CHOICE_KEY = 'two.photoHd';

export function readHdChoice(): boolean {
  try {
    return localStorage.getItem(CHOICE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveHdChoice(on: boolean): void {
  try {
    localStorage.setItem(CHOICE_KEY, on ? '1' : '0');
  } catch {
    /* asked again next time */
  }
}
