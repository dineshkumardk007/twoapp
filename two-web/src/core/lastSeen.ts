// "Last seen" - when your partner's device was last awake in this space.
//
// The relay knows who is connected right now and says so, but nobody was
// keeping the answer once they left. This carries it: each device sends an
// encrypted beat while it is open, so the other side can say "last seen today
// at 14:20" instead of falling silent the moment the socket drops.

import { dateLocale, tr } from './i18n';
import { clockTime } from './when';

const SHARE_KEY = 'two_share_last_seen_v1';

/** The record type both ends and the relay agree on. */
export const PRESENCE_BEAT = 'PRESENCE_BEAT';

/**
 * How often an open app says it is still here.
 *
 * Two minutes is a compromise: often enough that "last seen" is not wrong by
 * much, rare enough that it is not a stream of writes. The relay keeps only
 * the newest beat per device, so the cost is one row either way - this is
 * about traffic and battery, not storage.
 */
export const BEAT_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Whether this device shares its own last seen.
 *
 * On by default, matching what people expect from every messenger they have
 * used. The reciprocity below is what keeps that fair.
 */
export function readShareLastSeen(): boolean {
  try {
    return localStorage.getItem(SHARE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeShareLastSeen(share: boolean) {
  try {
    localStorage.setItem(SHARE_KEY, share ? 'true' : 'false');
  } catch {
    /* private mode - this run keeps the value it was given */
  }
}

/**
 * Formats a moment the way a messenger does.
 *
 * Exact times, as asked for - the point of the feature is knowing when, and a
 * vague "a while ago" answers nothing. Only the date part gets softer as it
 * recedes, because "last seen on Tuesday at 21:14" reads better than a date.
 */
export function formatLastSeen(at: number, now = Date.now()): string {
  if (!at || at > now + 60_000) return '';

  const then = new Date(at);
  // The app's own clock words in both languages: "4:45 pm", as everywhere
  // else in Two, not the phone's "04:45 pm" - a character the header has no room for.
  const time = clockTime(at);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);

  if (at >= startOfToday.getTime()) return tr('last seen today at {time}', { time });
  if (at >= startOfYesterday.getTime()) return tr('last seen yesterday at {time}', { time });

  // Inside the last week, the weekday is the more useful handle.
  if (now - at < 7 * 86_400_000) {
    const weekday = then.toLocaleDateString(dateLocale(), { weekday: 'long' });
    return tr('last seen {day} at {time}', { day: weekday, time });
  }

  const date = then.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
  return tr('last seen {day} at {time}', { day: date, time });
}

// --- Read receipts and typing ------------------------------------------------

const RECEIPTS_KEY = 'two_share_receipts_v1';

/** The signal type for "I am writing something", sent and never stored. */
export const TYPING_SIGNAL = 'TYPING';

/** How long a received "typing" stays true without another arriving. */
export const TYPING_TTL_MS = 6000;

/** How often a still-typing device repeats itself. */
export const TYPING_REPEAT_MS = 3000;

/**
 * Whether this device sends read receipts and typing.
 *
 * One switch for both, as WhatsApp has it: they answer the same question -
 * what am I doing in this conversation right now - and splitting them would
 * offer a privacy setting that leaks the thing it claims to hide.
 */
export function readShareReceipts(): boolean {
  try {
    return localStorage.getItem(RECEIPTS_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function writeShareReceipts(share: boolean) {
  try {
    localStorage.setItem(RECEIPTS_KEY, share ? 'true' : 'false');
  } catch {
    /* private mode - this run keeps the value it was given */
  }
}

// --- Online: Two on her screen -----------------------------------------------

/**
 * The signal type for "Two is on my screen", or that it is not: `{ here,
 * device }`. Sent and never stored.
 *
 * "online" used to mean one of her sockets was open on the relay. A phone
 * sent to the background keeps its socket - Android does not pause the page,
 * and Back at Home only hides it - so she showed online in her pocket for as
 * long as the phone let the app live. The socket still says whether her phone
 * can ring; this says whether she is looking.
 */
export const HERE_SIGNAL = 'HERE';

/** How often a phone with Two on screen says so again. */
export const HERE_REPEAT_MS = 30_000;

/**
 * How long a "here" counts with nothing more heard: two repeats and a bit, so
 * one lost on the way does not flicker her away, and a phone killed or cut
 * off with Two open stops counting within it.
 */
export const HERE_TTL_MS = 75_000;

/**
 * Said with the app version (APP_VERSION's `can`): this phone says when Two
 * leaves its screen, so silence from it means away rather than not knowing.
 */
export const CAN_SAY_AWAY = 'away';

/**
 * How long a presence beat keeps a phone on the version before online: one
 * beat and room for it to be late. That phone says nothing as it leaves, and
 * beats only while on screen, so the beats stopping is the only sign.
 */
export const LEGACY_HERE_MS = BEAT_INTERVAL_MS + 45_000;

/**
 * How old her newest beat must be before a phone on the version before is
 * taken to have last seen turned off, and shown by her socket alone. Silence
 * on its own is not enough: that phone beats only while on screen, so one in
 * the background with its socket up says nothing either, and going by the
 * socket then had her online for as long as the radio held it.
 */
export const LAST_SEEN_OFF_AFTER_MS = 86_400_000;

/**
 * A presence beat from this version. It also beats as Two leaves the screen,
 * for last seen, so its beats must not pass for the version before's, which
 * beats only while on screen - one of hers on this version would be kept
 * online for minutes by the beat it sent on leaving.
 */
export function presenceBeat(at: number) {
  return { at, saysHere: true };
}

/** Whether a beat came from a phone on the version before, which says nothing else. */
export function isLegacyBeat(data: any): boolean {
  return data?.saysHere !== true;
}

export interface PartnerPresence {
  /** Her sockets on the relay - whether her phone can ring at all. */
  relayPeers: number;
  /** The last "here" or "away" from each of her devices, timed by this phone's clock when it arrived. */
  devices: Record<string, { at: number; here: boolean }>;
  /** Her phone has said it can (CAN_SAY_AWAY). */
  partnerSaysAway: boolean;
  /**
   * Her last presence beat heard live, by this phone's clock, for a phone that
   * says nothing else (isLegacyBeat); 0 for none.
   */
  legacyBeatAt: number;
  /**
   * When her socket came up, as this phone saw it; 0 for not known. A socket
   * of ours dropping does not move it - only her coming and going does.
   */
  upSince?: number;
  /** Her last beat known from before - history, or kept from an earlier run. */
  earlierBeatAt?: number;
  now?: number;
}

/**
 * Until when she counts as having Two on her screen if nothing more is heard:
 * 0 when she does not now, Infinity when only the relay can say.
 *
 * It runs out, and a signal or a beat arriving is what brings her back - with
 * one exception: a phone on the version before whose newest beat is over
 * LAST_SEEN_OFF_AFTER_MS old goes over to her socket at upSince +
 * LEGACY_HERE_MS. So the screen needs a timer for each.
 */
export function onScreenUntil(p: PartnerPresence): number {
  // No socket at all: whatever was heard last, she has gone.
  if (p.relayPeers <= 0) return 0;
  const now = p.now ?? Date.now();
  const devices = Object.values(p.devices);
  const upSince = p.upSince ?? 0;
  // A beat stamped well ahead of this clock says nothing about now.
  const usable = (at: number) => (at > 0 && at <= now + 60_000 ? at : 0);
  const liveBeat = p.legacyBeatAt >= upSince ? usable(p.legacyBeatAt) : 0;

  // Her phone says when it leaves, so only a fresh "here" counts. Any one
  // device will do: a laptop left in the background says away, and the phone
  // in her hand still says here.
  if (p.partnerSaysAway || devices.length > 0) {
    let until = 0;
    for (const d of devices) {
      if (d.here && d.at + HERE_TTL_MS > now) until = Math.max(until, d.at + HERE_TTL_MS);
    }
    // Saying it is per seat, so a phone of hers still on the version before
    // is in here too, and it only beats. A fresh beat counts unless one of
    // her devices said here or away about then - it may be that device's.
    const explained = devices.some(d => d.at >= liveBeat - HERE_TTL_MS);
    if (liveBeat > 0 && !explained && liveBeat + LEGACY_HERE_MS > now) {
      until = Math.max(until, liveBeat + LEGACY_HERE_MS);
    }
    return until;
  }

  // The version before: her newest beat, heard live or from before.
  const beat = Math.max(usable(p.legacyBeatAt), usable(p.earlierBeatAt ?? 0));
  if (beat > 0 && beat + LEGACY_HERE_MS > now) return beat + LEGACY_HERE_MS;

  // Only her socket to go on - no beat from her ever, so last seen is off
  // there - and "online" is what it always was. So too once her newest beat
  // is a day old and her socket has been up a beat and a bit with none: it
  // beats as Two comes on its screen, so last seen has been turned off since.
  // Short of that, silence is her phone with Two in the background - away -
  // which is the better mistake than online for hours.
  if (beat === 0) return Infinity;
  const quietSinceUp = upSince > 0 && now - upSince >= LEGACY_HERE_MS;
  return quietSinceUp && now - beat > LAST_SEEN_OFF_AFTER_MS ? Infinity : 0;
}
