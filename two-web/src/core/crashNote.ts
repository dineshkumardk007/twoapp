// Why Two last closed when it should not have, as the Android app kept it
// (CrashNote.kt, over AndroidBridge.lastCrash): where in the code it stopped,
// the version, the Android and the phone. It stays on the phone; Settings
// offers it to copy, so it can be passed on and fixed, until it is dismissed.

export interface CrashNote {
  /** When it happened, epoch ms. */
  at: number;
  /** What to copy: plain text, technical only - never anything from a message. */
  text: string;
}

type Bridge = { lastCrash?: () => string; clearLastCrash?: () => void };

const bridge = (): Bridge | undefined => (window as unknown as { AndroidBridge?: Bridge }).AndroidBridge;

/** The note, or null when there is none - or no Android app to keep one. */
export function readCrashNote(): CrashNote | null {
  try {
    const raw = bridge()?.lastCrash?.();
    if (!raw || typeof raw !== 'string') return null;
    const parsed = JSON.parse(raw) as { at?: unknown; text?: unknown };
    if (typeof parsed.text !== 'string' || !parsed.text.trim()) return null;
    return { at: Number(parsed.at) || 0, text: parsed.text.slice(0, 20_000) };
  } catch {
    return null;
  }
}

export function dismissCrashNote(): void {
  try {
    bridge()?.clearLastCrash?.();
  } catch {
    /* an older app: nothing to dismiss */
  }
}

const TOLD_KEY = 'two_crash_note_told';

/**
 * Whether this note still needs mentioning when the app opens - once per
 * note, so it is said once and then waits quietly in Settings.
 */
export function crashNoteToTell(): CrashNote | null {
  const note = readCrashNote();
  if (!note) return null;
  try {
    if (localStorage.getItem(TOLD_KEY) === String(note.at)) return null;
    localStorage.setItem(TOLD_KEY, String(note.at));
  } catch {
    /* no storage: it may be said again, which is harmless */
  }
  return note;
}
