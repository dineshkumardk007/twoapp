import React, { useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronUp, Lock, Mic, Send, Square, Trash2 } from 'lucide-react';
import {
  VOICE_MAX_SECONDS,
  VOICE_MIN_MS,
  VOICE_WARN_SECONDS,
  canRecordVoice,
  formatVoiceDuration,
  startVoiceRecording,
  type VoiceLimit,
  type VoiceNote,
  type VoiceRecording
} from '../core/voice';
import { haptic } from '../core/haptics';
import { pushBackLayer } from '../core/backStack';
import { VoiceNotePlayer } from './VoiceNotePlayer';

// Hold-to-talk, for a composer.
//
// Hold the mic and speak; let go and it is sent. Slide left to throw it away,
// or slide up to lock it - then both hands are free, and the note waits to be
// sent, stopped to listen back first, or thrown away. A composer places three
// things:
//
//   const rec = useVoiceRecorder({ onSend, disabled, onActiveChange });
//   <VoiceRecordingStrip rec={rec} className="..." />  - covers the row while recording
//   <VoiceMicButton rec={rec} />                        - where Send sits
//
// The row they share must be `relative`. The strip lies over everything in it
// but the mic, so the text box underneath stays mounted - and focused, if it
// was - and the keyboard does not drop or the layout jump. The className is
// for padding, so the strip's contents line up with the row's own.
//
// The hook keeps the few things a composer needs to know (whether a note is
// under way, so the mic stays in Send's place) as React state. Everything
// that changes many times a second - the level, the timer, the finger's
// position - goes to the strip and the button directly, so a whole
// conversation is not drawn again sixteen times a second while somebody talks.

/** idle, waiting for the microphone, held down, locked hands-free, or stopped to listen back. */
export type VoiceRecorderState = 'idle' | 'starting' | 'holding' | 'locked' | 'review';

export interface UseVoiceRecorderOptions {
  /** A finished note, to be sent. */
  onSend: (note: VoiceNote) => void;
  /** No recording now (a call is on). A note under way is thrown away. */
  disabled?: boolean;
  /** A note has begun or ended - the composer closes its emoji picker and the like. */
  onActiveChange?: (active: boolean) => void;
}

/** How far up the finger goes to lock the recording. */
const LOCK_PX = 70;
/** How far left it goes to cancel - at most this... */
const CANCEL_MAX_PX = 110;
/** ...or this share of the row, on a narrow screen. */
const CANCEL_SHARE = 0.35;
/** How long a hint stays up. */
const HINT_MS = 2200;
/** How long "Cancelled" stays in the strip. */
const FLASH_MS = 600;
/** A microphone slower than this to answer was asking for permission. */
const SLOW_START_MS = 800;
/** A recording cut short by the phone longer ago than this is worth a word. */
const STOPPED_NOTICE_MS = 1000;
/** A lift this close outside the button still counts as a tap on it. */
const TAP_SLOP_PX = 12;

const MIC_REFUSED = "Two can't use the microphone — allow it in the phone's settings";

function startErrorText(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return MIC_REFUSED;
  if (name === 'NotFoundError') return 'No microphone found';
  return "Couldn't start recording";
}

function prefersReducedMotion(): boolean {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * How many recorders are waiting for the microphone right now.
 *
 * The first time, that wait is Android's permission prompt, which takes focus
 * from the page the way leaving the app does. Anything that acts on the page
 * losing focus - the disguise that switches on when you leave - asks this
 * first, as it already does of a call that is asking for the microphone.
 */
let waitingForMic = 0;
export function isVoiceRecorderAskingForMic(): boolean {
  return waitingForMic > 0;
}

type PressKind = 'record' | 'tap' | 'none';

interface Press {
  kind: PressKind;
  pointerId: number;
  x0: number;
  y0: number;
  el: HTMLElement;
  /** For a record press: the recording it started. */
  session: number;
}

/** The fast-changing part, read by the strip and the button without the composer drawing again. */
class LiveState {
  /** How far the finger is from where it went down. */
  dx = 0;
  dy = 0;
  /** How far left cancels, for this row. */
  cancelAt = CANCEL_MAX_PX;
  hint: string | null = null;
  /** "Cancelled" is showing. */
  flash = false;
  /** Bumped at every change, so a subscriber can tell. */
  version = 0;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getVersion = () => this.version;
  getDy = () => this.dy;

  bump() {
    this.version++;
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch {
        /* one subscriber's failure is not the others' */
      }
    });
  }
}

/**
 * The gesture and the recording - plain code rather than effects, because
 * almost all of it happens between a finger and a microphone that answers
 * whenever it likes. Every answer that arrives late checks `session` first:
 * anything thrown away, cancelled or unmounted in the meantime bumps it.
 */
class RecorderEngine {
  state: VoiceRecorderState = 'idle';
  /** A recording is being stopped and turned into a note. */
  busy = false;
  draft: VoiceNote | null = null;
  recording: VoiceRecording | null = null;
  session = 0;
  readonly live = new LiveState();
  readonly micRef: React.MutableRefObject<HTMLButtonElement | null> = { current: null };

  private mounted = false;
  private press: Press | null = null;
  private detachPress: (() => void) | null = null;
  private pressAt = 0;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Set by a press on the mic, so the click that follows it is ignored: the
   * pointer handlers have already done what that press meant - and the press
   * that locked a recording must not also send it.
   */
  private clickFromPointer = false;
  private clickGuardTimer: ReturnType<typeof setTimeout> | null = null;
  private viewVersion = 0;
  private viewListeners = new Set<() => void>();

  constructor(private readonly options: () => UseVoiceRecorderOptions) {}

  // ------------------------------------------------------------------ view

  subscribeView = (listener: () => void) => {
    this.viewListeners.add(listener);
    return () => {
      this.viewListeners.delete(listener);
    };
  };
  getViewVersion = () => this.viewVersion;

  private publish() {
    this.viewVersion++;
    this.viewListeners.forEach(listener => listener());
  }

  private setState(next: VoiceRecorderState) {
    if (this.state === next) return;
    this.state = next;
    this.publish();
  }

  private setBusy(next: boolean) {
    if (this.busy === next) return;
    this.busy = next;
    this.publish();
  }

  private toIdle() {
    this.recording = null;
    this.draft = null;
    this.busy = false;
    this.live.dx = 0;
    this.live.dy = 0;
    this.state = 'idle';
    this.publish();
    this.live.bump();
  }

  hint(text: string) {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.live.hint = text;
    this.live.bump();
    // A long sentence gets long enough to be read.
    this.hintTimer = setTimeout(() => {
      this.hintTimer = null;
      this.live.hint = null;
      this.live.bump();
    }, Math.max(HINT_MS, text.length * 55));
  }

  private clearHint() {
    if (!this.live.hint) return;
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    this.live.hint = null;
    this.live.bump();
  }

  private flashCancelled() {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.live.flash = true;
    this.live.bump();
    this.flashTimer = setTimeout(() => {
      this.flashTimer = null;
      this.live.flash = false;
      this.live.bump();
    }, FLASH_MS);
  }

  private clearFlash() {
    if (!this.live.flash) return;
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = null;
    this.live.flash = false;
    this.live.bump();
  }

  private isDisabled() {
    return !!this.options().disabled;
  }

  // ------------------------------------------------------------- lifecycle

  mount() {
    this.mounted = true;
  }

  /** Gone from the screen: the microphone, the radio and the playback claim are all handed back. */
  unmount() {
    this.mounted = false;
    this.session++;
    this.endPressTracking();
    try {
      this.recording?.cancel();
    } catch {
      /* already over */
    }
    this.recording = null;
    this.draft = null;
    this.busy = false;
    this.state = 'idle';
    if (this.hintTimer) clearTimeout(this.hintTimer);
    if (this.flashTimer) clearTimeout(this.flashTimer);
    if (this.clickGuardTimer) clearTimeout(this.clickGuardTimer);
    this.hintTimer = this.flashTimer = this.clickGuardTimer = null;
    this.live.hint = null;
    this.live.flash = false;
  }

  // ---------------------------------------------------------- the microphone

  /** Asks for the microphone. 'hold' expects the finger still down when it answers; 'locked' (a keyboard) does not. */
  private begin(mode: 'hold' | 'locked'): number {
    const session = ++this.session;
    this.pressAt = performance.now();
    this.clearFlash();
    this.clearHint();
    this.live.dx = 0;
    this.live.dy = 0;
    this.draft = null;
    this.setState('starting');

    waitingForMic++;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      waitingForMic = Math.max(0, waitingForMic - 1);
    };

    startVoiceRecording({
      onLevel: () => {
        if (this.session === session) this.live.bump();
      },
      onLimit: why => {
        if (this.session === session) this.reachedLimit(why);
      }
    }).then(
      recording => {
        settle();
        if (this.session !== session || !this.mounted || this.isDisabled()) {
          recording.cancel();
          return;
        }
        if (mode === 'hold') {
          const press = this.press;
          const fingerDown = !!press && press.kind === 'record' && press.session === session;
          if (!fingerDown) {
            // The finger was lifted before the microphone answered - most
            // often because Android's permission prompt took the gesture.
            // Nothing was meant to be said into this one.
            recording.cancel();
            this.session++;
            this.toIdle();
            this.hint(
              performance.now() - this.pressAt > SLOW_START_MS
                ? 'Microphone ready — hold the button to record'
                : 'Hold to record, release to send'
            );
            return;
          }
        }
        this.recording = recording;
        this.setState(mode === 'hold' ? 'holding' : 'locked');
        haptic('tick');
      },
      err => {
        settle();
        if (this.session !== session) return;
        this.session++;
        this.toIdle();
        this.hint(startErrorText(err));
      }
    );
    return session;
  }

  /** Throws away whatever is under way: a microphone still to answer, a recording, a draft. */
  cancel = () => {
    if (this.state === 'idle') return;
    this.session++;
    try {
      this.recording?.cancel();
    } catch {
      /* already over */
    }
    this.toIdle();
  };

  /** Stops the recording and keeps it, to be listened to before it goes. */
  stopToReview = async () => {
    const recording = this.recording;
    if (!recording || this.busy) return;
    const session = this.session;
    this.setBusy(true);
    let note: VoiceNote | null = null;
    try {
      note = await recording.stop();
    } catch {
      note = null;
    }
    if (this.session !== session) return;
    this.recording = null;
    if (note) {
      this.busy = false;
      this.draft = note;
      this.state = 'review';
      this.publish();
      this.live.bump();
    } else {
      this.toIdle();
      this.hint(recording.elapsedMs() < VOICE_MIN_MS ? 'Too short to send' : "Couldn't keep that recording");
    }
  };

  /** Stops the recording and sends it. */
  private stopAndSend = async () => {
    const recording = this.recording;
    if (!recording || this.busy) return;
    const session = this.session;
    this.setBusy(true);
    let note: VoiceNote | null = null;
    try {
      note = await recording.stop();
    } catch {
      note = null;
    }
    if (this.session !== session) return;
    this.toIdle();
    if (note) this.deliver(note);
    else this.hint(recording.elapsedMs() < VOICE_MIN_MS ? 'Too short to send' : "Couldn't keep that recording");
  };

  /** Sends the note listened back to. */
  sendDraft = () => {
    const draft = this.draft;
    if (this.state !== 'review' || !draft) return;
    this.toIdle();
    this.deliver(draft);
  };

  /** Throws away the note listened back to. */
  discard = () => {
    if (this.state !== 'review') return;
    this.session++;
    this.toIdle();
  };

  /** The trash can, in the strip: locked or reviewing alike. */
  trash = () => {
    if (this.busy) return;
    if (this.state === 'locked') this.cancel();
    else if (this.state === 'review') this.discard();
    else return;
    haptic('reject');
  };

  private deliver(note: VoiceNote) {
    try {
      this.options().onSend(note);
    } catch (e) {
      console.error('Voice note could not be sent', e);
      return;
    }
    haptic('confirm');
  }

  private reachedLimit(_why: VoiceLimit) {
    if (this.busy || (this.state !== 'holding' && this.state !== 'locked')) return;
    // Stopped for the person, finger down or not; the lift that follows then
    // means nothing (the state is no longer 'holding').
    haptic('tick');
    this.hint("That's the longest a voice note can be");
    void this.stopToReview();
  }

  private lock() {
    this.live.dx = 0;
    this.live.dy = 0;
    this.setState('locked');
    this.live.bump();
    haptic('tick');
  }

  private cancelBySlide() {
    this.cancel();
    haptic('reject');
    this.flashCancelled();
  }

  /**
   * Stopped from outside - Back, or the app leaving the screen. A recording
   * worth keeping is kept to be listened to; it is never sent by itself.
   */
  private interrupt() {
    if (this.busy || (this.state !== 'holding' && this.state !== 'locked')) return;
    if ((this.recording?.elapsedMs() ?? 0) >= VOICE_MIN_MS) void this.stopToReview();
    else this.cancel();
  }

  /** The phone's Back button, while a note is under way. */
  back = () => {
    switch (this.state) {
      case 'starting':
        this.cancel();
        return;
      case 'holding':
      case 'locked':
        this.interrupt();
        return;
      case 'review':
        this.discard();
        this.hint('Voice note discarded');
        return;
    }
  };

  onHidden = () => {
    if (document.visibilityState === 'hidden') this.interrupt();
  };

  onDisabled() {
    if (this.state !== 'idle') this.cancel();
  }

  // ------------------------------------------------------------- the button

  /**
   * The mic's own click: a keyboard (Enter or Space) or a screen reader.
   * There is no finger to hold, so it starts straight into the locked state,
   * and the same key then sends.
   */
  onMicClick = () => {
    if (this.clickFromPointer) {
      this.clickFromPointer = false;
      if (this.clickGuardTimer) clearTimeout(this.clickGuardTimer);
      this.clickGuardTimer = null;
      return;
    }
    if (this.isDisabled() || this.busy) return;
    if (this.state === 'idle') this.begin('locked');
    else if (this.state === 'locked') void this.stopAndSend();
    else if (this.state === 'review') this.sendDraft();
  };

  onMicKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // The click this key makes is the keyboard's, whatever a finger did before.
    this.clickFromPointer = false;
    // Holding Enter down repeats it; one press is one action.
    if (e.repeat) e.preventDefault();
  };

  onMicPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !e.isPrimary) return;
    // Keeps focus - and so the keyboard - on the text box.
    e.preventDefault();

    // A press still open from before never got its lift (the page was hidden
    // under it, say). A new primary pointer means that one is over. Closed
    // first, so that the guard it leaves behind cannot lapse during this one.
    if (this.press) this.endPress(this.press, null, true);

    this.clickFromPointer = true;
    if (this.clickGuardTimer) clearTimeout(this.clickGuardTimer);
    this.clickGuardTimer = null;

    const state = this.state;
    let kind: PressKind = 'none';
    if (!this.isDisabled() && !this.busy) {
      if (state === 'idle') kind = 'record';
      else if (state === 'locked' || state === 'review') kind = 'tap';
    }
    this.trackPress(e, kind);
    if (kind !== 'record') return;

    const row = (e.currentTarget.offsetParent as HTMLElement | null) ?? e.currentTarget.parentElement;
    const rowWidth = row?.clientWidth || 360;
    this.live.cancelAt = Math.min(CANCEL_MAX_PX, rowWidth * CANCEL_SHARE);
    const press = this.press as Press | null;
    const session = this.begin('hold');
    if (press) press.session = session;
  };

  /**
   * Follows one press to its end from the window rather than the button, so
   * the lift is caught wherever it happens - even if the button lost the
   * pointer capture or was drawn again in the meantime.
   */
  private trackPress(e: React.PointerEvent<HTMLButtonElement>, kind: PressKind) {
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    try {
      el.setPointerCapture(pointerId);
    } catch {
      /* the window listeners below still see it */
    }
    const press: Press = { kind, pointerId, x0: e.clientX, y0: e.clientY, el, session: -1 };
    this.press = press;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) this.movePress(press, ev);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) this.endPress(press, ev, false);
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) this.endPress(press, ev, true);
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    this.detachPress = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
    };
  }

  private endPressTracking() {
    this.detachPress?.();
    this.detachPress = null;
    this.press = null;
  }

  private movePress(press: Press, ev: PointerEvent) {
    if (press.kind !== 'record' || this.press !== press) return;
    // While the microphone is still answering, nothing is decided yet; the
    // first move after it has will measure from the same start.
    if (this.state !== 'holding' || this.busy || press.session !== this.session) return;
    const dx = ev.clientX - press.x0;
    const dy = ev.clientY - press.y0;
    if (dx < -this.live.cancelAt) {
      this.cancelBySlide();
      return;
    }
    if (dy < -LOCK_PX) {
      this.lock();
      return;
    }
    this.live.dx = dx;
    this.live.dy = dy;
    this.live.bump();
  }

  private endPress(press: Press, ev: PointerEvent | null, cancelled: boolean) {
    if (this.press !== press) return;
    this.endPressTracking();
    // The click this press may still produce is the pointer's. If it never
    // comes, the guard lapses, so a keyboard or screen reader is not ignored.
    if (this.clickGuardTimer) clearTimeout(this.clickGuardTimer);
    this.clickGuardTimer = setTimeout(() => {
      this.clickGuardTimer = null;
      this.clickFromPointer = false;
    }, 1000);

    if (press.kind === 'tap') {
      if (cancelled || !ev || this.busy) return;
      const rect = press.el.getBoundingClientRect();
      const inside =
        ev.clientX >= rect.left - TAP_SLOP_PX &&
        ev.clientX <= rect.right + TAP_SLOP_PX &&
        ev.clientY >= rect.top - TAP_SLOP_PX &&
        ev.clientY <= rect.bottom + TAP_SLOP_PX;
      if (!inside) return;
      if (this.state === 'locked') void this.stopAndSend();
      else if (this.state === 'review') this.sendDraft();
      return;
    }
    if (press.kind !== 'record') return;

    // Still waiting for the microphone: its answer will see the finger has gone.
    if (this.state === 'starting') return;
    // Locked by this very press, stopped by the limit, cancelled by a slide:
    // the lift means nothing now.
    if (this.state !== 'holding' || this.busy || press.session !== this.session) return;

    this.live.dx = 0;
    this.live.dy = 0;
    const recording = this.recording;
    const ran = recording?.elapsedMs() ?? 0;
    if (cancelled) {
      // The phone took the touch (a call, the notification shade).
      this.cancel();
      if (ran > STOPPED_NOTICE_MS) this.hint('Recording stopped');
      return;
    }
    if (ran < VOICE_MIN_MS) {
      this.cancel();
      this.hint('Hold to record, release to send');
      return;
    }
    void this.stopAndSend();
  }
}

/** What useVoiceRecorder hands the composer, and the strip and the button take. */
export interface VoiceRecorderControls {
  state: VoiceRecorderState;
  /** Anything but idle: the mic stays in Send's place and the strip covers the row. */
  active: boolean;
  /** Stopping a recording and turning it into a note. */
  busy: boolean;
  disabled: boolean;
  /** Whether this phone can record at all. The mic button hides itself when not. */
  supported: boolean;
  /** The note being listened back to (review). */
  draft: VoiceNote | null;
  /** Throws away whatever is under way. */
  cancel: () => void;
  /** @internal The strip's and the button's way in. */
  engine: RecorderEngine;
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions): VoiceRecorderControls {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [engine] = useState(() => new RecorderEngine(() => optionsRef.current));
  useSyncExternalStore(engine.subscribeView, engine.getViewVersion);
  const [supported] = useState(canRecordVoice);

  const state = engine.state;
  const active = state !== 'idle';
  const disabled = !!options.disabled;

  useEffect(() => {
    engine.mount();
    return () => engine.unmount();
  }, [engine]);

  useEffect(() => {
    document.addEventListener('visibilitychange', engine.onHidden);
    return () => document.removeEventListener('visibilitychange', engine.onHidden);
  }, [engine]);

  useEffect(() => {
    if (disabled) engine.onDisabled();
  }, [disabled, engine]);

  // Back: stop to listen back, or cancel, or throw the draft away. Back takes
  // a layer off the stack as it closes it, so one that leaves a note still
  // under way (holding -> review) puts a fresh layer back for the next press.
  const [backLayer, setBackLayer] = useState(0);
  useEffect(() => {
    if (!active) return;
    return pushBackLayer(() => {
      engine.back();
      setBackLayer(n => n + 1);
    });
  }, [active, backLayer, engine]);

  const reportedActive = useRef(false);
  useEffect(() => {
    if (reportedActive.current === active) return;
    reportedActive.current = active;
    try {
      optionsRef.current.onActiveChange?.(active);
    } catch {
      /* the composer's problem */
    }
  }, [active]);

  return {
    state,
    active,
    busy: engine.busy,
    disabled,
    supported,
    draft: engine.draft,
    cancel: engine.cancel,
    engine
  };
}

/** Keeps the keyboard up: a press in the strip must not take focus from the text box. */
const keepFocus = (e: React.SyntheticEvent) => e.preventDefault();

function useLive(engine: RecorderEngine) {
  useSyncExternalStore(engine.live.subscribe, engine.live.getVersion);
  return engine.live;
}

/** The latest levels, newest on the right; as many as fit, the oldest cut off on the left. */
const LiveWave: React.FC<{ levels: number[] }> = ({ levels }) => {
  const recent = levels.length > 90 ? levels.slice(-90) : levels;
  return (
    <div className="flex h-7 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden" aria-hidden="true">
      {recent.map((level, i) => (
        <span
          key={levels.length - recent.length + i}
          className="w-[3px] shrink-0 rounded-full bg-linen-primary/60"
          style={{ height: `${Math.max(10, Math.round(level * 100))}%` }}
        />
      ))}
    </div>
  );
};

const StripButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, disabled, children }) => (
  <button
    type="button"
    onPointerDown={keepFocus}
    onMouseDown={keepFocus}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-linen-secondary transition-colors hover:bg-linen-variant hover:text-linen-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linen-primary/50 disabled:opacity-40"
  >
    {children}
  </button>
);

/**
 * Where the mic button starts, measured from the row's left padding edge -
 * so the strip can stop exactly there. Layout offsets, not the screen
 * position, because the button grows while held and that must not move it.
 */
function micLeftIn(row: HTMLElement, mic: HTMLElement): number | null {
  let x = 0;
  let node: HTMLElement | null = mic;
  while (node && node !== row) {
    x += node.offsetLeft;
    const parent = node.offsetParent as HTMLElement | null;
    if (parent && parent !== row) x += parent.clientLeft;
    node = parent;
  }
  return node === row ? x : null;
}

/** Fallback when the mic cannot be measured: its 42px and the row's usual gap. */
const MIC_SLOT_PX = 50;

/**
 * Lies over the composer row while a note is under way (and says "Cancelled"
 * for a moment after a slide). Renders always: while idle, only the place
 * where hints appear, above the row.
 */
export const VoiceRecordingStrip: React.FC<{ rec: VoiceRecorderControls; className?: string }> = ({
  rec,
  className = ''
}) => {
  const engine = rec.engine;
  const live = useLive(engine);
  const { state, busy, draft } = rec;
  const visible = state !== 'idle' || live.flash;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const flashRef = useRef<HTMLSpanElement | null>(null);
  const [right, setRight] = useState<number | null>(null);

  // Stops short of the mic, whatever the composer's padding and gaps are, and
  // again if the row changes size (the phone turned) while it is up.
  useLayoutEffect(() => {
    if (!visible) return;
    const root = rootRef.current;
    const row = root?.offsetParent as HTMLElement | null;
    if (!root || !row) return;
    const measure = () => {
      const mic = engine.micRef.current;
      const left = mic ? micLeftIn(row, mic) : null;
      setRight(left === null ? MIC_SLOT_PX : Math.max(0, row.clientWidth - left));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [visible, engine]);

  // The timer: the levels already redraw the strip every 60ms, but a phone
  // whose level meter failed must still see the seconds go by.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const recordingNow = (state === 'holding' || state === 'locked') && !busy;
  useEffect(() => {
    if (!recordingNow) return;
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [recordingNow]);

  // A short shake for "Cancelled" - none under reduced motion.
  useEffect(() => {
    if (!live.flash || prefersReducedMotion()) return;
    const el = flashRef.current;
    if (!el || typeof el.animate !== 'function') return;
    const animation = el.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(2px)' },
        { transform: 'translateX(0)' }
      ],
      { duration: 360, easing: 'ease-out' }
    );
    return () => animation.cancel();
  }, [live.flash]);

  const recording = engine.recording;
  const elapsedMs = recording ? recording.elapsedMs() : 0;
  const seconds = elapsedMs / 1000;
  const warn = seconds >= VOICE_WARN_SECONDS;
  const timerText = warn
    ? `${formatVoiceDuration(Math.max(0, Math.ceil(VOICE_MAX_SECONDS - seconds)))} left`
    : formatVoiceDuration(seconds);
  const levels = recording ? recording.levels() : [];

  const status = state === 'locked' ? 'Recording' : state === 'review' ? 'Recording stopped. Ready to send' : '';

  const dot = (
    <span
      aria-hidden="true"
      className={`h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500 ${
        recordingNow ? 'animate-pulse motion-reduce:animate-none' : 'opacity-40'
      }`}
    />
  );
  const timer = (
    <span
      className={`shrink-0 text-sm tabular-nums ${warn ? 'font-medium text-linen-accent' : 'text-linen-primary'}`}
    >
      {timerText}
    </span>
  );

  let body: React.ReactNode = null;
  if (state === 'idle') {
    // Only "Cancelled", for a moment after a slide.
    body = (
      <span ref={flashRef} className="flex items-center gap-1.5 pl-1 text-sm font-medium text-rose-600">
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Cancelled
      </span>
    );
  } else if (state === 'starting') {
    body = (
      <>
        {dot}
        {timer}
      </>
    );
  } else if (state === 'holding') {
    const dx = Math.min(0, live.dx);
    const fade = Math.min(1, -dx / Math.max(1, live.cancelAt));
    body = (
      <>
        {dot}
        {timer}
        <LiveWave levels={levels} />
        {!busy && (
          // The background stays solid as the words fade, and runs the full
          // height of the row, so the waveform it slides over is covered
          // rather than showing through the words or above and below them.
          <span
            className="relative flex shrink-0 items-center self-stretch bg-linen-surface pl-2"
            style={{ transform: `translateX(${dx}px)` }}
          >
            <span
              className="flex items-center gap-0.5 text-xs text-linen-secondary"
              style={{ opacity: 1 - fade * 0.85 }}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Slide to cancel
            </span>
          </span>
        )}
      </>
    );
  } else if (state === 'locked') {
    body = (
      <>
        <StripButton label="Delete recording" onClick={engine.trash} disabled={busy}>
          <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
        </StripButton>
        {dot}
        {timer}
        <LiveWave levels={levels} />
        <StripButton label="Stop recording" onClick={() => void engine.stopToReview()} disabled={busy}>
          <Square className="h-3.5 w-3.5 text-rose-600" fill="currentColor" aria-hidden="true" />
        </StripButton>
      </>
    );
  } else if (state === 'review' && draft) {
    body = (
      <>
        <StripButton label="Delete voice note" onClick={engine.trash}>
          <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
        </StripButton>
        <div className="min-w-0 flex-1">
          <VoiceNotePlayer
            key={engine.session}
            id={`voice-draft-${engine.session}`}
            audioDataUrl={draft.dataUrl}
            durationSeconds={draft.durationSeconds}
            peaks={draft.peaks}
            tone="composer"
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div
        aria-live="polite"
        className="pointer-events-none absolute bottom-full left-0 right-0 z-20 mb-2 flex justify-center px-4"
      >
        {live.hint && (
          <span className="max-w-full rounded-full bg-linen-primary/90 px-3 py-1 text-center text-[11px] font-medium leading-snug text-linen-surface shadow-xs">
            {live.hint}
          </span>
        )}
        {status && <span className="sr-only">{status}</span>}
      </div>
      {visible && (
        <div
          ref={rootRef}
          role="group"
          aria-label="Voice note"
          className={`absolute inset-y-0 left-0 z-10 flex min-w-0 items-center gap-2 bg-linen-surface pr-2 animate-in fade-in slide-in-from-right-2 duration-200 ${className}`}
          style={{ right: right ?? MIC_SLOT_PX }}
        >
          {body}
        </div>
      )}
    </>
  );
};

/** The lock that floats above the held mic, following the finger up and filling as it nears. */
const LockPill: React.FC<{ engine: RecorderEngine }> = ({ engine }) => {
  const dy = useSyncExternalStore(engine.live.subscribe, engine.live.getDy);
  const up = Math.max(0, Math.min(LOCK_PX, -dy));
  const progress = up / LOCK_PX;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-full left-1/2 mb-2 flex w-8 flex-col items-center overflow-hidden rounded-full border border-linen-border bg-linen-surface py-2 text-linen-primary shadow-xs animate-in fade-in slide-in-from-bottom-2"
      style={{ transform: `translate(-50%, ${-up * 0.5}px)` }}
    >
      <span className="absolute inset-x-0 bottom-0 bg-linen-primary/15" style={{ height: `${progress * 100}%` }} />
      <Lock className="relative h-3.5 w-3.5" />
      <ChevronUp className="relative mt-1 h-3.5 w-3.5 opacity-60" />
    </span>
  );
};

/**
 * The mic, in Send's place: hold to record, release to send. While a note is
 * locked or being listened back to it becomes Send. Hidden on a phone that
 * cannot record at all.
 */
export const VoiceMicButton: React.FC<{
  rec: VoiceRecorderControls;
  /** Why it is disabled, when it is. */
  disabledLabel?: string;
  className?: string;
}> = ({ rec, disabledLabel = 'Not during a call', className = '' }) => {
  const engine = rec.engine;
  if (!rec.supported) return null;
  const { state, busy } = rec;
  const pressed = (state === 'starting' || state === 'holding') && !busy;
  const sends = state === 'locked' || state === 'review';
  const label = rec.disabled
    ? disabledLabel
    : sends
    ? 'Send voice note'
    : state === 'holding'
    ? 'Recording, release to send'
    : 'Hold to record a voice note';

  return (
    <button
      ref={engine.micRef}
      type="button"
      disabled={rec.disabled}
      onPointerDown={engine.onMicPointerDown}
      onMouseDown={keepFocus}
      onContextMenu={keepFocus}
      onClick={engine.onMicClick}
      onKeyDown={engine.onMicKeyDown}
      aria-label={label}
      title={label}
      className={`relative z-20 flex h-[42px] w-[42px] shrink-0 touch-none select-none items-center justify-center rounded-xl bg-linen-primary text-linen-surface transition-[transform,box-shadow,opacity] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linen-primary/50 focus-visible:ring-offset-2 disabled:opacity-40 motion-reduce:transition-none ${
        pressed ? 'scale-110 ring-4 ring-linen-primary/15' : ''
      } ${className}`}
      style={{ WebkitTouchCallout: 'none' }}
    >
      {sends ? <Send className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-[18px] w-[18px]" aria-hidden="true" />}
      {state === 'holding' && !busy && <LockPill engine={engine} />}
    </button>
  );
};
