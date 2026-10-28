// How a message's quote and photo are shown, and saved - the same in the
// couple's chat and in a group's.

import { tr } from './i18n';

/** A photo is shrunk to fit one record with room to spare (core/photo). */
export const PHOTO_MAX_CHARS = 600_000;
/** At most this many photos picked at once go. */
export const PHOTOS_AT_ONCE = 10;
/** The largest a photo is shown in the conversation; tapped, it fills the screen. */
const PHOTO_MAX_W = 240;
const PHOTO_MAX_H = 300;

/** A photo's size in the conversation: its own shape, within PHOTO_MAX_W by PHOTO_MAX_H. */
export function photoSize(m: { photoWidth?: number; photoHeight?: number }): { width: number; height: number } {
  const w = m.photoWidth || 4;
  const h = m.photoHeight || 3;
  const s = Math.min(PHOTO_MAX_W / w, PHOTO_MAX_H / h);
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

/** A data: URL as the bytes it holds, for saving. */
export function dataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(',');
  const type = /^data:([^;,]+)/.exec(url)?.[1] || 'application/octet-stream';
  const bytes = atob(url.slice(comma + 1));
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i);
  return new Blob([out], { type });
}

/** "two-photo-2026-10-14-2141.jpg" */
export function photoFileName(at?: number): string {
  const d = new Date(at && Number.isFinite(at) ? at : Date.now());
  const two = (n: number) => String(n).padStart(2, '0');
  return `two-photo-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.jpg`;
}

/**
 * A reply quote's or the pinned bar's snippet, as shown. The fixed words
 * snippetOf (core/chatActions) puts in travel in English and are said here in
 * this phone's language; a message's own words stay as written.
 */
export function snippetShown(snippet: string | undefined): string {
  switch (snippet) {
    case 'Photo':
      return tr('Photo');
    case 'Voice note':
      return tr('Voice note');
    case 'View-once photo':
      return tr('View-once photo');
    case '':
    case undefined:
      return tr('Message');
    default:
      return snippet;
  }
}
