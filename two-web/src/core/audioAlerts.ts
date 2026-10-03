// The shared audio context, the alert sounds, and haptic feedback for Two.
// The sounds themselves are designed and rendered audio files - see sounds.ts.
import { playSound } from './sounds';

let sharedContext: AudioContext | null = null;

/**
 * The one AudioContext every short sound in the app plays through.
 *
 * Each chime used to open a context of its own and never close it. Browsers
 * allow only a handful at once - Chrome on Android about six - and after that
 * `new AudioContext()` throws, so every sound in the app went quiet for the
 * rest of the session, the incoming-call ring included. One context, reused,
 * can play any number of them.
 *
 * Resumed on each use: a context created before the first tap starts out
 * suspended, and Android suspends it again when the app goes to the background.
 */
export function getAudioContext(): AudioContext | null {
  try {
    if (!sharedContext || sharedContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      sharedContext = new AudioContextClass() as AudioContext;
    }
    if (sharedContext.state === 'suspended') {
      sharedContext.resume().catch(() => {});
    }
    return sharedContext;
  } catch {
    return null;
  }
}

/** A new message from your partner: two glass-bell notes, a fourth apart. */
export function playMessageChime() {
  playSound('message');
}

/** A love letter or whisper memo: a kalimba arpeggio with a glockenspiel sparkle. */
export function playLetterChime() {
  playSound('letter');
}

/** A nudge, a touch, a pulse: a soft double heartbeat, voiced so a phone speaker carries it. */
export function playHeartbeatSound() {
  playSound('heartbeat');
}

/** Tactile vibration on mobile devices (e.g. [40, 50, 40] for double tap) */
export function triggerHaptic(pattern: number | number[] = [35, 45, 35]) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
}
