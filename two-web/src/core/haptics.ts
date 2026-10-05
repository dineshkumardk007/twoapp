// A light, precise tick under the thumb - the kind the phone's own keyboard
// gives - for the moments that matter: sending, switching screens, a PIN key,
// a heart.
//
// In the Android app the phone makes it (AndroidBridge.haptic), so it is the
// tuned system click and follows the phone's touch-feedback setting. Elsewhere
// it is the shortest buzz the browser allows, or nothing where there is no
// vibration at all.

export type HapticKind =
  /** Moving between things: a dock tab, a toggle. */
  | 'tick'
  /** A key on a keypad. */
  | 'key'
  /** Something done: sent, saved. */
  | 'confirm'
  /** Something refused: a wrong PIN. */
  | 'reject';

export function haptic(kind: HapticKind = 'tick'): void {
  try {
    const bridge = (window as unknown as { AndroidBridge?: { haptic?: (kind: string) => void } }).AndroidBridge;
    if (bridge && typeof bridge.haptic === 'function') {
      bridge.haptic(kind);
      return;
    }
  } catch {
    /* an older app: fall through to the browser's own */
  }
  try {
    navigator.vibrate?.(kind === 'reject' ? [20, 40, 20] : kind === 'confirm' ? 12 : 8);
  } catch {
    /* no vibration here */
  }
}
