// Voice notes at your ear: raise the phone and a playing note moves to the
// earpiece, quietly, with the screen dark; lower it and the note stops where
// it was instead of carrying on out loud.
//
// The page can't do this alone - a WebView plays recordings as media, which
// always leaves through the loudspeaker. The phone's half (EarpieceVoice.kt)
// watches the proximity sensor and plays the note as a voice call does. This
// half decides when to hand a note over and takes it back:
//
//   page -> phone   AndroidBridge.earWatch(on)    sensor on/off
//                   AndroidBridge.earPlay(...)     play this note at the ear
//                   AndroidBridge.earStop()        stop playing at the ear
//   phone -> page   window.__twoEar({event: 'near' | 'far'})
//                   window.__twoEar({event: 'stopped', id, positionMs, reason})
//                   reason: lowered | ended | error | busy (a call has the earpiece)
//
// Off with earphones in (the note is already private) and on phones with no
// proximity sensor.

type Bridge = {
  earAvailable?: () => boolean;
  earWatch?: (on: boolean) => void;
  earPlay?: (id: string, base64: string, positionMs: number, rate: number) => void;
  earStop?: () => void;
  isHeadsetConnected?: () => boolean;
};

export type EarReturn = 'lowered' | 'ended' | 'error' | 'busy';

/** What a player hands over while its note is sounding. */
export interface EarNote {
  id: string;
  /** data:audio/...;base64,... - the recording carried in the message. */
  dataUrl: string;
  /** Seconds into the note right now. */
  position: () => number;
  /** The speed it plays at. */
  rate: () => number;
  /** The phone is at an ear: stop sounding here, the earpiece takes over. */
  toEar: () => void;
  /** Back from the ear, and why; where the note got to, in seconds. */
  back: (reason: EarReturn, positionSec: number) => void;
}

/** After a note ends at the ear, how long to keep listening for the next one. */
const NEXT_NOTE_GRACE_MS = 2500;

let note: EarNote | null = null;
let atEar = false;
let near = false;
let watching = false;
let graceTimer: ReturnType<typeof setTimeout> | null = null;

function bridge(): Bridge | null {
  return ((globalThis as unknown as { AndroidBridge?: Bridge }).AndroidBridge) ?? null;
}

/** The phone can play notes at the ear. */
export function earSupported(): boolean {
  const b = bridge();
  if (!b?.earWatch || !b.earPlay) return false;
  try {
    return b.earAvailable ? !!b.earAvailable() : false;
  } catch {
    return false;
  }
}

function setWatch(on: boolean) {
  if (watching === on) return;
  watching = on;
  if (!on) near = false;
  try {
    bridge()?.earWatch?.(on);
  } catch {
    /* no sensor after all */
  }
}

function clearGrace() {
  if (graceTimer) clearTimeout(graceTimer);
  graceTimer = null;
}

/** A note has started sounding on the loudspeaker: watch for the ear. */
export function armEar(n: EarNote) {
  if (!earSupported()) return;
  try {
    if (bridge()?.isHeadsetConnected?.()) return;
  } catch {
    /* treat as no earphones */
  }
  clearGrace();
  if (note && note.id !== n.id && atEar) return;
  note = n;
  setWatch(true);
  // Already at the ear - the next note after one that ended there.
  if (near) handToEar();
}

/** The note stopped here (paused, ended, scrolled away): stop watching. */
export function disarmEar(id: string) {
  if (!note || note.id !== id || atEar) return;
  note = null;
  setWatch(false);
}

/** The bubble is going while its note plays at the ear: stop it there too. */
export function stopEar(id: string) {
  if (!note || note.id !== id || !atEar) return;
  try {
    bridge()?.earStop?.();
  } catch {
    /* it ends with the note */
  }
}

/** A note about to start should go straight to the ear. */
export function earIsNear(): boolean {
  return watching && near;
}

function handToEar() {
  const n = note;
  const b = bridge();
  if (!n || atEar || !b?.earPlay) return;
  const data = /^data:[^,]*;base64,(.*)$/.exec(n.dataUrl);
  if (!data) return;
  atEar = true;
  const at = Math.max(0, n.position());
  n.toEar();
  try {
    b.earPlay(n.id, data[1], Math.round(at * 1000), n.rate());
  } catch {
    atEar = false;
    note = null;
    setWatch(false);
    n.back('error', at);
  }
}

function onEvent(e: unknown) {
  const event = e as { event?: string; id?: string; positionMs?: number; reason?: string } | null;
  if (!event || typeof event !== 'object') return;
  if (event.event === 'near') {
    near = true;
    if (note && !atEar) handToEar();
    return;
  }
  if (event.event === 'far') {
    near = false;
    return;
  }
  if (event.event === 'stopped') {
    const n = note;
    if (!n || n.id !== event.id) return;
    atEar = false;
    note = null;
    const reason = (['lowered', 'ended', 'error', 'busy'] as const).find(r => r === event.reason) ?? 'error';
    if (reason === 'ended') {
      // Chat plays the next note on its own; if the phone is still at the
      // ear, that one should start there too.
      clearGrace();
      graceTimer = setTimeout(() => {
        graceTimer = null;
        if (!note) setWatch(false);
      }, NEXT_NOTE_GRACE_MS);
    } else {
      setWatch(false);
    }
    n.back(reason, Math.max(0, Number(event.positionMs) || 0) / 1000);
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as { __twoEar?: (e: unknown) => void }).__twoEar = onEvent;
}

/** For tests: back to a phone that has heard nothing. */
export function resetEarForTests() {
  clearGrace();
  note = null;
  atEar = false;
  near = false;
  watching = false;
}
