// Telling the native app apart from the website.
//
// The Android build is the same web bundle inside a WebView, which is exactly
// why app-only surfaces belong here rather than in Kotlin: a native dock would
// need its own copy of every destination, and the two lists would drift apart
// the first time a screen was added.
//
// The bridge is injected by the WebView, so its presence is the signal.

export function isAndroidApp(): boolean {
  try {
    return typeof (window as any).AndroidBridge?.isAndroid === 'function';
  } catch {
    return false;
  }
}

/**
 * Rough form factor, used to widen layouts on tablets rather than leaving a
 * phone-width column stranded in the middle of a 10-inch screen.
 */
export type FormFactor = 'phone' | 'tablet';

export function formFactor(): FormFactor {
  if (typeof window === 'undefined') return 'phone';
  const shortest = Math.min(window.innerWidth, window.innerHeight);
  return shortest >= 600 ? 'tablet' : 'phone';
}
