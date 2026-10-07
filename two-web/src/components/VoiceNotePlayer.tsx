import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, Pause, Play } from 'lucide-react';
import {
  VOICE_RATES,
  claimVoicePlayback,
  formatVoiceDuration,
  holdRadioDown,
  makeSeekable,
  placeholderPeaks,
  readVoiceRate,
  saveVoiceRate
} from '../core/voice';

/**
 * One voice note, as a bubble shows it: a play button, the shape of the voice
 * and how far through it you are.
 *
 * A conversation can hold hundreds of notes, so a player owns no audio until
 * somebody plays or seeks it; only then is the recording opened, and it is
 * let go again when the bubble leaves the screen. One note plays at a time
 * (claimVoicePlayback), and while one is actually sounding a live radio is
 * turned down under it (holdRadioDown) - both handed back on pause, at the end,
 * on an error and when the bubble goes, so the radio is never left quiet.
 */
export interface VoiceNotePlayerProps {
  /** The message's id: the key for one-voice-at-a-time, and the seed of a stand-in waveform. */
  id: string;
  audioDataUrl?: string;
  /** Measured when it was recorded; the file itself usually says Infinity. */
  durationSeconds?: number;
  /** 0-100 each. A note recorded before notes kept their shape has none. */
  peaks?: number[];
  /** mine: on the dark bubble. theirs: the light one. composer: the review strip. */
  tone: 'mine' | 'theirs' | 'composer';
  /** Mine: the other person has played it. Theirs: I have. */
  heard?: boolean;
  /** Whether to show the heard / not-yet-heard marks at all. */
  showHeard?: boolean;
  /** Once, when playback first actually starts - and only if it was not already heard. */
  onFirstPlay?: () => void;
  /** Played to the end (the next note can start from this). */
  onEnded?: () => void;
  /** A new non-zero value plays it from the start. */
  playSignal?: number;
}

type Tone = VoiceNotePlayerProps['tone'];

const TONES: Record<
  Tone,
  { button: string; played: string; unplayed: string; meta: string; chip: string; ring: string; thumb: string }
> = {
  mine: {
    button: 'bg-linen-surface text-linen-primary hover:bg-linen-variant',
    played: 'bg-linen-surface',
    unplayed: 'bg-linen-surface/35',
    meta: 'text-linen-surface/75',
    chip: 'bg-linen-surface/15 text-linen-surface hover:bg-linen-surface/25',
    ring: 'focus-visible:ring-linen-surface/70',
    thumb: 'bg-linen-surface'
  },
  theirs: {
    button: 'bg-linen-primary text-linen-surface hover:bg-linen-primary/90',
    played: 'bg-linen-primary',
    unplayed: 'bg-linen-primary/25',
    meta: 'text-linen-secondary',
    chip: 'bg-linen-primary/10 text-linen-primary hover:bg-linen-primary/15',
    ring: 'focus-visible:ring-linen-primary/50',
    thumb: 'bg-linen-primary'
  },
  composer: {
    button: 'bg-linen-variant text-linen-primary hover:bg-linen-border',
    played: 'bg-linen-primary',
    unplayed: 'bg-linen-primary/20',
    meta: 'text-linen-secondary',
    chip: 'bg-linen-variant text-linen-primary hover:bg-linen-border',
    ring: 'focus-visible:ring-linen-primary/50',
    thumb: 'bg-linen-primary'
  }
};

/** How far a seek with the arrow keys goes. */
const KEY_STEP_SECONDS = 5;
/** Opening a recording faster than this shows nothing at all. */
const BUSY_AFTER_MS = 150;
/** A finger has to travel this far sideways before a press on the waveform becomes a drag. */
const DRAG_SLOP_PX = 4;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function finiteDuration(audio: HTMLAudioElement | null): number {
  const d = audio?.duration;
  return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : 0;
}

function prefersReducedMotion(): boolean {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Keeps the keyboard up: a press on a control here must not take focus from the text box. */
const keepFocus = (e: React.SyntheticEvent) => e.preventDefault();

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  id,
  audioDataUrl,
  durationSeconds,
  peaks,
  tone,
  heard = false,
  showHeard = false,
  onFirstPlay,
  onEnded,
  playSignal
}) => {
  const t = TONES[tone];
  // Only a recording carried inside the message is ever played. Anything else
  // - nothing at all, a reference whose media did not come back, a web
  // address - is a note that cannot be played, said quietly.
  const playable = typeof audioDataUrl === 'string' && audioDataUrl.startsWith('data:audio/');
  const measured =
    typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : 0;

  /** Between the element's play and pause events. */
  const [playing, setPlaying] = useState(false);
  /** Asked to play and not sounding yet: the button already offers Pause. */
  const [pending, setPending] = useState(false);
  /** Opening the recording is taking long enough to be worth showing. */
  const [busy, setBusy] = useState(false);
  /** Where playback is, in seconds. */
  const [position, setPosition] = useState(0);
  /** The file's own length, once it knows it. */
  const [mediaDuration, setMediaDuration] = useState(0);
  /** 0..1 while a finger is on the waveform (and until the seek it makes lands). */
  const [drag, setDrag] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rate, setRate] = useState(readVoiceRate);
  const [failed, setFailed] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Takes the element's listeners off again. */
  const detachRef = useRef<(() => void) | null>(null);
  /** makeSeekable, run once per element and shared by whoever needs it first. */
  const preparedRef = useRef<Promise<void> | null>(null);
  /** While makeSeekable walks the file, its jumps are not playback to show. */
  const preparingRef = useRef(false);
  /** Bumped by every play, pause and end, so a play that was overtaken does nothing when it resolves. */
  const intentRef = useRef(0);
  const releaseClaimRef = useRef<(() => void) | null>(null);
  const releaseRadioRef = useRef<(() => void) | null>(null);
  const frameRef = useRef(0);
  const firstPlayDoneRef = useRef(false);
  const mountedRef = useRef(false);
  const pendingRef = useRef(false);
  const rateRef = useRef(rate);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{ pointerId: number; startX: number; moved: boolean } | null>(null);

  // Read by the element's events, which outlive any one render.
  const idRef = useRef(id);
  idRef.current = id;
  const heardRef = useRef(heard);
  heardRef.current = heard;
  const onFirstPlayRef = useRef(onFirstPlay);
  onFirstPlayRef.current = onFirstPlay;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const measuredRef = useRef(measured);
  measuredRef.current = measured;

  const markPending = (on: boolean) => {
    pendingRef.current = on;
    setPending(on);
  };

  const stopFrames = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
  };

  /**
   * Moves the bars every frame while it plays. The element itself reports its
   * time only about four times a second, which steps rather than flows. Under
   * reduced motion those four steps are all there is.
   */
  const startFrames = () => {
    stopFrames();
    if (prefersReducedMotion()) return;
    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused || preparingRef.current) {
        frameRef.current = 0;
        return;
      }
      setPosition(audio.currentTime);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  };

  /** Hands back the radio and the one-voice claim. Safe to call any number of times. */
  const letGo = () => {
    stopFrames();
    releaseRadioRef.current?.();
    releaseRadioRef.current = null;
    releaseClaimRef.current?.();
    releaseClaimRef.current = null;
  };

  /** Pauses, or gives up on a play that has not started sounding yet. */
  const halt = () => {
    intentRef.current++;
    markPending(false);
    setBusy(false);
    letGo();
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      try {
        audio.pause();
      } catch {
        /* already stopped */
      }
    }
  };

  /** Closes the recording and forgets everything about it. */
  const dispose = () => {
    intentRef.current++;
    letGo();
    detachRef.current?.();
    detachRef.current = null;
    const audio = audioRef.current;
    audioRef.current = null;
    preparedRef.current = null;
    preparingRef.current = false;
    if (audio) {
      try {
        audio.pause();
        // Without this the decoded recording stays in memory as long as the
        // element is reachable from anywhere.
        audio.removeAttribute('src');
        audio.load();
      } catch {
        /* nothing more to release */
      }
    }
  };

  /** The element, opened the first time it is needed. */
  const ensureAudio = (): HTMLAudioElement | null => {
    if (audioRef.current) return audioRef.current;
    if (!playable || !audioDataUrl) return null;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.defaultPlaybackRate = rateRef.current;
    audio.playbackRate = rateRef.current;

    const onTime = () => {
      if (!preparingRef.current) setPosition(audio.currentTime);
    };
    const onDuration = () => {
      const d = finiteDuration(audio);
      if (d) setMediaDuration(d);
    };
    const onPlay = () => setPlaying(true);
    const onPlaying = () => {
      if (audio.paused) return;
      markPending(false);
      setBusy(false);
      // Only now, when it is really sounding, does the radio go down.
      if (!releaseRadioRef.current) releaseRadioRef.current = holdRadioDown();
      if (!firstPlayDoneRef.current) {
        firstPlayDoneRef.current = true;
        if (!heardRef.current) {
          try {
            onFirstPlayRef.current?.();
          } catch {
            /* the screen's problem, not the note's */
          }
        }
      }
      startFrames();
    };
    const onPause = () => {
      setPlaying(false);
      letGo();
      if (!preparingRef.current) setPosition(audio.currentTime);
    };
    const onEnd = () => {
      intentRef.current++;
      markPending(false);
      setBusy(false);
      setPlaying(false);
      letGo();
      // Back to the start, ready to be played again.
      try {
        audio.currentTime = 0;
      } catch {
        /* it will start from wherever it is */
      }
      setPosition(0);
      try {
        onEndedRef.current?.();
      } catch {
        /* as above */
      }
    };
    const onError = () => {
      // A recording this phone cannot decode. Said quietly; the button goes
      // back to Play.
      intentRef.current++;
      markPending(false);
      setBusy(false);
      setPlaying(false);
      letGo();
      setFailed(true);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onError);
    detachRef.current = () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onError);
    };
    audio.src = audioDataUrl;
    audioRef.current = audio;
    return audio;
  };

  /**
   * Makes the recording seekable before its first play or seek (see
   * makeSeekable). A file that cannot even be opened stops the wait rather
   * than holding the button busy for the whole fallback.
   */
  const prepare = (audio: HTMLAudioElement): Promise<void> => {
    if (!preparedRef.current) {
      preparingRef.current = true;
      const broken = new Promise<void>(resolve => {
        if (audio.error) resolve();
        else audio.addEventListener('error', () => resolve(), { once: true });
      });
      preparedRef.current = Promise.race([makeSeekable(audio), broken]).then(() => {
        if (audioRef.current !== audio) return;
        preparingRef.current = false;
        setPosition(audio.currentTime || 0);
        const d = finiteDuration(audio);
        if (d) setMediaDuration(d);
      });
    }
    return preparedRef.current;
  };

  /** prepare, with the busy mark if it takes long enough to notice. */
  const prepareVisibly = async (audio: HTMLAudioElement) => {
    if (!preparingRef.current && preparedRef.current) return preparedRef.current;
    const slow = setTimeout(() => {
      if (mountedRef.current) setBusy(true);
    }, BUSY_AFTER_MS);
    try {
      await prepare(audio);
    } finally {
      clearTimeout(slow);
      if (mountedRef.current) setBusy(false);
    }
  };

  const play = async (fromStart: boolean) => {
    const audio = ensureAudio();
    if (!audio) return;
    const token = ++intentRef.current;
    setFailed(false);
    markPending(true);
    // Claimed now rather than once it is ready, so that the last note
    // somebody tapped is the one that plays, even if this one is still opening.
    releaseClaimRef.current?.();
    releaseClaimRef.current = claimVoicePlayback(idRef.current, halt);

    // A note started afresh plays at the speed last chosen on this phone,
    // even if that was chosen on another note since this one was drawn.
    const notStarted = audio.paused && (fromStart || audio.currentTime === 0);
    if (notStarted) {
      const remembered = readVoiceRate();
      if (remembered !== rateRef.current) {
        rateRef.current = remembered;
        setRate(remembered);
      }
    }

    await prepareVisibly(audio);
    if (token !== intentRef.current || !mountedRef.current || audioRef.current !== audio) return;
    if (fromStart) {
      try {
        audio.currentTime = 0;
      } catch {
        /* it starts from where it is */
      }
      setPosition(0);
    }
    audio.defaultPlaybackRate = rateRef.current;
    audio.playbackRate = rateRef.current;
    try {
      await audio.play();
      // Normally 'playing' has already said so; not when it was playing all
      // along (asked to start again from the top), which fires no event.
      if (token === intentRef.current) markPending(false);
    } catch (e) {
      // Paused, ended or overtaken on purpose in the meantime: not a failure.
      if (token !== intentRef.current || (e as { name?: string } | null)?.name === 'AbortError') return;
      intentRef.current++;
      markPending(false);
      setPlaying(false);
      letGo();
      setFailed(true);
    }
  };

  /** Moves to a point in the note without starting or stopping it. */
  const seekTo = async (where: (total: number, now: number) => number) => {
    const audio = ensureAudio();
    if (!audio) return;
    await prepareVisibly(audio);
    if (!mountedRef.current || audioRef.current !== audio) return;
    const total = finiteDuration(audio) || measuredRef.current;
    if (!total) return;
    const target = Math.max(0, Math.min(total, where(total, audio.currentTime)));
    try {
      audio.currentTime = target;
    } catch {
      return;
    }
    setPosition(target);
  };

  const toggle = () => {
    if (!playable) return;
    const audio = audioRef.current;
    if (pendingRef.current || (audio && !audio.paused)) halt();
    else void play(false);
  };

  const cycleRate = () => {
    const rates = VOICE_RATES as readonly number[];
    const next = rates[(rates.indexOf(rateRef.current) + 1) % rates.length];
    rateRef.current = next;
    setRate(next);
    saveVoiceRate(next);
    const audio = audioRef.current;
    if (audio) {
      audio.defaultPlaybackRate = next;
      audio.playbackRate = next;
    }
  };

  // Mounted / gone. Written to survive React's development double-mount,
  // which runs the cleanup once before the real mount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      gestureRef.current = null;
      dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A different recording under the same bubble (its media restored, say):
  // the old element is closed and the player starts over.
  const urlRef = useRef(audioDataUrl);
  useEffect(() => {
    if (urlRef.current === audioDataUrl) return;
    urlRef.current = audioDataUrl;
    dispose();
    markPending(false);
    setBusy(false);
    setPlaying(false);
    setPosition(0);
    setMediaDuration(0);
    setDrag(null);
    setDragging(false);
    setFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioDataUrl]);

  // Asked to play from the start - the note before this one just finished.
  // Only a change counts; a bubble drawn again with the same value stays put.
  const signalRef = useRef(playSignal);
  useEffect(() => {
    if (signalRef.current === playSignal) return;
    signalRef.current = playSignal;
    if (!playSignal) return;
    void play(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playSignal]);

  // --------------------------------------------------------------- seeking

  const fractionAt = (clientX: number): number => {
    const el = waveRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 ? clamp01((clientX - rect.left) / rect.width) : 0;
  };

  /** Seeks to a fraction, keeping the finger's position on screen until it lands. */
  const commitSeek = async (fraction: number) => {
    setDrag(fraction);
    try {
      await seekTo(total => fraction * total);
    } finally {
      if (mountedRef.current && !gestureRef.current) setDrag(null);
    }
  };

  const onWavePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!playable || e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* the events still arrive while the finger stays on the waveform */
    }
    // A mouse drags from the first pixel. A finger has to move sideways
    // first, so that the start of a scroll through the chat is not a seek.
    const mouse = e.pointerType === 'mouse';
    gestureRef.current = { pointerId: e.pointerId, startX: e.clientX, moved: mouse };
    if (mouse) {
      setDragging(true);
      setDrag(fractionAt(e.clientX));
    }
  };

  const onWavePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (!g.moved) {
      if (Math.abs(e.clientX - g.startX) < DRAG_SLOP_PX) return;
      g.moved = true;
      setDragging(true);
    }
    setDrag(fractionAt(e.clientX));
  };

  const onWavePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gestureRef.current = null;
    setDragging(false);
    // A tap and a drag both end here, at where the finger was lifted.
    void commitSeek(fractionAt(e.clientX));
  };

  /** The browser took the touch for a scroll, or the capture was lost: nothing is seeked. */
  const onWavePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gestureRef.current = null;
    setDragging(false);
    setDrag(null);
  };

  const onWaveKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!playable) return;
    let where: ((total: number, now: number) => number) | null = null;
    if (e.key === 'ArrowLeft') where = (_total, now) => now - KEY_STEP_SECONDS;
    else if (e.key === 'ArrowRight') where = (_total, now) => now + KEY_STEP_SECONDS;
    else if (e.key === 'Home') where = () => 0;
    else if (e.key === 'End') where = total => total;
    if (!where) return;
    e.preventDefault();
    void seekTo(where);
  };

  // ------------------------------------------------------------- drawing

  const bars = useMemo(() => {
    const source =
      Array.isArray(peaks) && peaks.length > 0
        ? peaks.map(p => (Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0))
        : placeholderPeaks(id);
    return source.map(p => Math.max(12, p));
  }, [peaks, id]);

  const drawBars = (color: string) => (
    <div className="absolute inset-0 flex items-center justify-between gap-px" aria-hidden="true">
      {bars.map((h, i) => (
        <span key={i} className={`min-w-px max-w-[3px] flex-1 rounded-full ${color}`} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
  // Built once per shape and colour, so a frame of playback only moves the clip.
  const unplayedBars = useMemo(
    () => drawBars(playable ? t.unplayed : `${t.unplayed} opacity-60`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bars, t, playable]
  );
  const playedBars = useMemo(
    () => drawBars(t.played),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bars, t]
  );

  const isPlaying = pending || playing;
  /** What the time and the bars measure against: the file's own length once known, as asked. */
  const progressTotal = mediaDuration || measured;
  /** What is shown as the note's length: the one measured while recording, which the sender saw too. */
  const shownTotal = measured || mediaDuration;
  const shown = drag !== null ? drag : clamp01(position / (progressTotal || 1));
  const started = isPlaying || position > 0;
  const seconds = drag !== null ? drag * progressTotal : position;
  const timeText = drag !== null || started ? formatVoiceDuration(seconds) : formatVoiceDuration(shownTotal);

  const playLabel = isPlaying ? 'Pause voice note' : `Play voice note, ${formatVoiceDuration(shownTotal)}`;

  return (
    <div
      className={`flex items-center gap-2.5 ${tone === 'composer' ? 'w-full min-w-0' : 'w-60 min-w-[200px] max-w-full'}`}
    >
      <button
        type="button"
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
        onClick={toggle}
        disabled={!playable}
        aria-label={playable ? playLabel : 'Voice note unavailable'}
        title={playable ? playLabel : 'Voice note unavailable'}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 ${t.button} ${t.ring} disabled:cursor-default disabled:opacity-50`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" />
        ) : (
          <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true" />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        {playable ? (
          <div
            ref={waveRef}
            role="slider"
            tabIndex={0}
            aria-label="Position in voice note"
            aria-valuemin={0}
            // Whole seconds, rounded down the way the visible "0:03" is, so a
            // screen reader hears the same numbers the label shows.
            aria-valuemax={Math.max(1, Math.floor(progressTotal || shownTotal))}
            aria-valuenow={Math.min(Math.floor(seconds), Math.max(1, Math.floor(progressTotal || shownTotal)))}
            aria-valuetext={`${formatVoiceDuration(seconds)} of ${formatVoiceDuration(shownTotal || progressTotal)}`}
            onPointerDown={onWavePointerDown}
            onPointerMove={onWavePointerMove}
            onPointerUp={onWavePointerUp}
            onPointerCancel={onWavePointerCancel}
            onLostPointerCapture={onWavePointerCancel}
            onMouseDown={keepFocus}
            onKeyDown={onWaveKeyDown}
            className={`relative h-7 w-full min-w-0 cursor-pointer touch-pan-y select-none rounded-sm focus-visible:outline-none focus-visible:ring-2 ${t.ring}`}
          >
            {unplayedBars}
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${(1 - shown) * 100}% 0 0)` }}>
              {playedBars}
            </div>
            {dragging && (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-0 -ml-px w-0.5 rounded-full ${t.thumb}`}
                style={{ left: `${shown * 100}%` }}
              />
            )}
          </div>
        ) : (
          <div className="relative h-7 w-full min-w-0" aria-hidden="true">
            {unplayedBars}
          </div>
        )}

        <div className={`mt-0.5 flex min-h-[20px] items-center justify-between gap-2 text-[11px] leading-none ${t.meta}`}>
          {playable ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="tabular-nums">{timeText}</span>
              {showHeard && tone === 'mine' && (
                <>
                  <Mic className={`h-3 w-3 ${heard ? 'text-sky-300' : 'text-linen-surface/40'}`} aria-hidden="true" />
                  <span className="sr-only">{heard ? 'Heard' : 'Not heard yet'}</span>
                </>
              )}
              {showHeard && tone === 'theirs' && !heard && (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-linen-accent" aria-hidden="true" />
                  <span className="sr-only">New</span>
                </>
              )}
            </span>
          ) : (
            <span>Voice note unavailable</span>
          )}
          {failed ? (
            <span className="truncate">Couldn't play</span>
          ) : playable && started ? (
            <button
              type="button"
              onPointerDown={keepFocus}
              onMouseDown={keepFocus}
              onClick={cycleRate}
              aria-label={`Playback speed ${rate} times. Change speed`}
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 ${t.chip} ${t.ring}`}
            >
              {rate}×
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
