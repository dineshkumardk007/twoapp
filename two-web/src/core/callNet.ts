// How a call copes with a bad network (core/call).
//
// Three things, each decided from what the call measures every two seconds:
// how many bits the voice is sent with, how long the other phone holds what
// arrives before playing it, and - once, at the start - which way the voice is
// packed, so a lost packet is carried again in the next one.

/** The steps a voice is sent at, from the ceiling down to what still sounds like a person. */
export const BITRATE_STEPS = [96, 64, 48, 32, 24, 16] as const;

/** Samples in a row this good before the voice is sent with more bits again. */
const UP_AFTER = 3;

export interface BitrateLook {
  /** What it is sent at now, in kbps. */
  current: number;
  /** The most it may be: the high setting or the saver, whichever both phones allow. */
  ceiling: number;
  /** Packets lost of those due since the last look, in percent. */
  lossPct: number;
  /** Round trip, in ms (0 when unknown). */
  rttMs: number;
  /** Good looks in a row so far. */
  goodStreak: number;
}

/**
 * The next rate for the voice.
 *
 * Down one step at once when packets are being lost or the trip is long - a
 * voice with fewer bits that all arrive sounds better than a full one with
 * holes in it - and two steps when it is very bad. Up one step only after
 * several calm looks, so a rate that has just been cut is not put straight
 * back up into the trouble it left.
 */
export function nextBitrate(look: BitrateLook): { kbps: number; goodStreak: number } {
  const steps = BITRATE_STEPS.filter(s => s <= look.ceiling);
  if (steps.length === 0) return { kbps: look.ceiling, goodStreak: 0 };
  let at = steps.findIndex(s => s <= look.current);
  if (at < 0) at = steps.length - 1;
  const veryBad = look.lossPct >= 15 || look.rttMs >= 900;
  const bad = veryBad || look.lossPct >= 5 || look.rttMs >= 500;
  if (bad) {
    const down = Math.min(steps.length - 1, at + (veryBad ? 2 : 1));
    return { kbps: steps[down], goodStreak: 0 };
  }
  const calm = look.lossPct < 1.5 && (look.rttMs === 0 || look.rttMs < 300);
  if (!calm) return { kbps: steps[at], goodStreak: 0 };
  const streak = look.goodStreak + 1;
  if (streak >= UP_AFTER && at > 0) return { kbps: steps[at - 1], goodStreak: 0 };
  return { kbps: steps[at], goodStreak: streak };
}

/**
 * How long the other phone holds the voice before playing it, in ms.
 *
 * Packets on a shaky connection arrive bunched and late; a little more held
 * back smooths the gaps into a voice instead of crackles. On a calm one it
 * stays near nothing, so nobody talks over each other.
 */
export function playoutTargetMs(lossPct: number, jitterMs: number): number {
  if (lossPct >= 5 || jitterMs >= 60) return 160;
  if (lossPct >= 1.5 || jitterMs >= 30) return 100;
  return 60;
}

/**
 * The codecs in the order a call should ask for them: the voice with its
 * last packet carried again alongside (audio/red) first, when the phone has
 * it, so a burst of lost packets on mobile data does not take the words with
 * it. Everything else stays in the phone's own order, Opus included, so a
 * phone that cannot do it still gets plain Opus.
 */
export function redFirst<T extends { mimeType: string }>(codecs: readonly T[]): T[] {
  const red = codecs.filter(c => c.mimeType.toLowerCase() === 'audio/red');
  if (red.length === 0) return [...codecs];
  return [...red, ...codecs.filter(c => c.mimeType.toLowerCase() !== 'audio/red')];
}

/**
 * Whether the voice is cleaned of the room's noise.
 *
 * Off by default: it is what makes a call voice sound processed. On by itself
 * on the speaker, where the room is in the microphone too - unless the person
 * chose, with the button, for this call.
 */
export function noiseReductionOn(choice: boolean | null, speaker: boolean): boolean {
  return choice ?? speaker;
}
