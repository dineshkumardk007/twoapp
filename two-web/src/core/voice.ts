// Voice notes: recording one, and what travels with it.
//
// A voice note is a chat message that carries a recording - in the couple's
// chat and in a group alike. It travels the way every message does: inside
// one encrypted record, so the relay only ever holds ciphertext. That record
// is capped at a megabyte, and the recording is base64 inside the message and
// base64 again once encrypted, so what is sent is about 1.8 times the audio.
// Speech at VOICE_BITS_PER_SECOND keeps three minutes - about 360 KB of audio,
// 640 KB sent - comfortably inside it.
//
// Alongside the audio a note carries its length (measured here, because the
// recordings phones make do not say how long they are - see makeSeekable) and
// the shape of the voice in it: a few dozen levels, sampled while recording,
// that the bubble draws as its waveform.

import { liveRadio } from './liveRadio';

/** The longest note: three minutes. */
export const VOICE_MAX_SECONDS = 180;
/** When the timer starts saying how little is left. */
export const VOICE_WARN_SECONDS = 165;
/** Anything shorter is a tap on the button, not something said. */
export const VOICE_MIN_MS = 700;
/** How many bars a note's waveform has. */
export const VOICE_PEAK_COUNT = 40;

/**
 * Asked of the recorder: speech quality, the rate voice notes are usually sent
 * at. Left to itself a phone records at several times this, and a note over
 * about a minute and a half would then be too big to send.
 */
export const VOICE_BITS_PER_SECOND = 16_000;

/**
 * The most audio a note may hold - about 960 KB once sent. Recording stops
 * here even inside the time limit, for a phone that ignores the rate above.
 */
export const VOICE_MAX_AUDIO_BYTES = 540_000;

/** How often the level is sampled while recording - the live waveform's pace. */
const LEVEL_EVERY_MS = 60;

/** A finished recording, ready to send. */
export interface VoiceNote {
  /** data:audio/...;base64,... */
  dataUrl: string;
  /** Seconds, to one decimal place. */
  durationSeconds: number;
  /** VOICE_PEAK_COUNT levels, each 0-100. */
  peaks: number[];
}

/** The voice-note fields a chat message carries (couple's and group's alike). */
export interface VoiceFields {
  isVoiceMemo: true;
  audioDataUrl: string;
  audioDurationSeconds: number;
  audioPeaks?: number[];
}

/** Whether this browser - or this WebView - can record at all. */
export function canRecordVoice(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder === 'function' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    );
  } catch {
    return false;
  }
}

/** Opus in WebM where the phone has it; otherwise whatever it records by default. */
export function openRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(
    type => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)
  );
  try {
    return new MediaRecorder(stream, { mimeType, audioBitsPerSecond: VOICE_BITS_PER_SECOND });
  } catch {
    return new MediaRecorder(stream);
  }
}

/** "0:07", "2:45". */
export function formatVoiceDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * The words a voice note carries as its text.
 *
 * Never shown in the bubble - that is the player - but it is what a
 * notification, the "while you were away" line and a phone still on an older
 * version of the app show for it, instead of an empty message.
 */
export function voiceNoteLabel(durationSeconds: number): string {
  return `Voice note · ${formatVoiceDuration(durationSeconds)}`;
}

/** The fields a message carries for a finished recording. */
export function voiceFieldsOf(note: VoiceNote): VoiceFields {
  return {
    isVoiceMemo: true,
    audioDataUrl: note.dataUrl,
    audioDurationSeconds: note.durationSeconds,
    audioPeaks: note.peaks
  };
}

/** Longest data URL accepted from another phone: a little over the record cap allows. */
const MAX_INCOMING_DATA_URL = 1_400_000;

/**
 * The voice-note fields of a message from another phone, checked - or nothing.
 *
 * A message can come from the partner's phone or anyone in a group, so a
 * recording is only accepted as a data: URL of audio. Anything else - a web
 * address in particular, which the player would fetch and so tell somebody's
 * server that this phone had opened the message - is dropped, and the
 * message shows as text.
 */
export function cleanVoiceFields(payload: any): VoiceFields | null {
  if (!payload || typeof payload !== 'object' || !payload.isVoiceMemo) return null;
  const url = payload.audioDataUrl;
  if (typeof url !== 'string' || !url.startsWith('data:audio/') || url.length > MAX_INCOMING_DATA_URL) {
    return null;
  }
  const duration = Number(payload.audioDurationSeconds);
  const fields: VoiceFields = {
    isVoiceMemo: true,
    audioDataUrl: url,
    audioDurationSeconds:
      Number.isFinite(duration) && duration > 0 ? Math.min(Math.round(duration * 10) / 10, 600) : 0
  };
  if (Array.isArray(payload.audioPeaks) && payload.audioPeaks.length > 0 && payload.audioPeaks.length <= 64) {
    fields.audioPeaks = payload.audioPeaks.map((p: unknown) => {
      const n = Number(p);
      return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
    });
  }
  return fields;
}

/**
 * A waveform for a note recorded before notes kept their shape.
 *
 * Not the voice - there is nothing to draw it from - but a calm, varied shape
 * that is the same every time the same note is shown, rather than one fixed
 * row of bars that made every note look identical.
 */
export function placeholderPeaks(seed: string, count = VOICE_PEAK_COUNT): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const r = ((h >>> 0) % 1000) / 1000;
    // Speech swells and falls: a slow curve with a little grain on top.
    const swell = 0.55 + 0.35 * Math.sin((i / count) * Math.PI * 2.3 + (seed.length % 7));
    peaks.push(Math.round(18 + 62 * Math.max(0, Math.min(1, swell * (0.6 + 0.4 * r)))));
  }
  return peaks;
}

/**
 * The levels sampled while recording, folded into VOICE_PEAK_COUNT bars.
 *
 * Each bar is the loudest moment in its slice, scaled to the loudest moment
 * of the note and eased (square root), so quiet speech still has a shape and
 * a shout does not flatten everything else.
 */
export function summarizePeaks(levels: number[], count = VOICE_PEAK_COUNT): number[] {
  if (levels.length === 0) return new Array(count).fill(10);
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * levels.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / count));
    let max = 0;
    for (let j = from; j < to && j < levels.length; j++) max = Math.max(max, levels[j]);
    bars.push(max);
  }
  const loudest = Math.max(...bars);
  return bars.map(b => {
    const relative = loudest > 0 ? b / loudest : 0;
    return Math.round(8 + 92 * Math.sqrt(relative));
  });
}

/** 0..1 from a slice of samples: speech sits roughly between -50 and 0 dB. */
function levelOf(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  if (rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.max(0, Math.min(1, (db + 50) / 50));
}

// ------------------------------------------------------------------ playback

/**
 * Turns the live radio down for as long as a note is being recorded or
 * played, and back up after. Returns the way to let go; letting go twice is
 * harmless.
 */
export function holdRadioDown(): () => void {
  let held = true;
  try {
    liveRadio.duck(true);
  } catch {
    held = false;
  }
  return () => {
    if (!held) return;
    held = false;
    try {
      liveRadio.duck(false);
    } catch {
      /* the radio is gone; nothing to restore */
    }
  };
}

/**
 * One voice at a time.
 *
 * Starting a note pauses whichever note was playing, and starting to record
 * pauses any note at all - two voices at once is never what anybody wants.
 */
let currentOwner: { id: string; pause: () => void } | null = null;

export function claimVoicePlayback(id: string, pause: () => void): () => void {
  if (currentOwner && currentOwner.id !== id) {
    const previous = currentOwner;
    currentOwner = null;
    try {
      previous.pause();
    } catch {
      /* already stopped */
    }
  }
  const mine = { id, pause };
  currentOwner = mine;
  return () => {
    if (currentOwner === mine) currentOwner = null;
  };
}

const RATE_KEY = 'two_voice_rate_v1';
export const VOICE_RATES = [1, 1.5, 2] as const;

/** The speed notes play at - chosen once, remembered on this phone. */
export function readVoiceRate(): number {
  try {
    const n = Number(localStorage.getItem(RATE_KEY));
    return (VOICE_RATES as readonly number[]).includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

export function saveVoiceRate(rate: number) {
  try {
    localStorage.setItem(RATE_KEY, String(rate));
  } catch {
    /* private mode: it just will not be remembered */
  }
}

/**
 * Makes a phone's own recording seekable.
 *
 * Phones write a recording as it is made, so the file never says how long it
 * is: its duration reads as Infinity, and jumping to a point in it does
 * nothing until the player has been through the whole of it once. Asking for
 * a time far past the end makes the player walk through it and learn the
 * real length; then it goes back to the start. Done once per player, before
 * the first jump.
 */
export function makeSeekable(audio: HTMLAudioElement): Promise<void> {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return Promise.resolve();
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      audio.removeEventListener('durationchange', onChange);
      audio.removeEventListener('timeupdate', onChange);
      clearTimeout(timer);
      try {
        audio.currentTime = 0;
      } catch {
        /* nothing to rewind */
      }
      resolve();
    };
    const onChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) finish();
    };
    const timer = setTimeout(finish, 2000);
    audio.addEventListener('durationchange', onChange);
    audio.addEventListener('timeupdate', onChange);
    const start = () => {
      try {
        audio.currentTime = 1e101;
      } catch {
        finish();
      }
    };
    if (audio.readyState >= 1) start();
    else audio.addEventListener('loadedmetadata', start, { once: true });
  });
}

// ----------------------------------------------------------------- recording

/** Why a recording ended by itself. */
export type VoiceLimit = 'time' | 'size';

export interface VoiceRecording {
  /** Levels sampled so far, 0..1, oldest first - the live waveform. */
  levels(): number[];
  /** How long it has been recording. */
  elapsedMs(): number;
  /** Ends it and hands back the note - or null for a tap-length one or a failure. */
  stop(): Promise<VoiceNote | null>;
  /** Ends it and throws it away. */
  cancel(): void;
}

export interface StartOptions {
  /** Each new level, as it is sampled. */
  onLevel?: (level: number) => void;
  /** The note reached the time or size limit. Recording carries on until stopped. */
  onLimit?: (why: VoiceLimit) => void;
}

/**
 * Starts recording from the microphone.
 *
 * Rejects as getUserMedia does - NotAllowedError when the microphone was
 * refused - so the caller can say what happened. While it runs, a live radio
 * is turned down (or its sound would be in the note) and any note that was
 * playing is paused.
 */
export async function startVoiceRecording(options: StartOptions = {}): Promise<VoiceRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1
    }
  });

  const releaseRadio = holdRadioDown();
  const releasePlayback = claimVoicePlayback('__recorder__', () => {});

  let recorder: MediaRecorder;
  try {
    recorder = openRecorder(stream);
  } catch (e) {
    stream.getTracks().forEach(t => t.stop());
    releaseRadio();
    releasePlayback();
    throw e;
  }

  const chunks: Blob[] = [];
  let bytes = 0;
  let limitSaid = false;
  const sayLimit = (why: VoiceLimit) => {
    if (limitSaid) return;
    limitSaid = true;
    try {
      options.onLimit?.(why);
    } catch {
      /* the screen's problem, not the recording's */
    }
  };

  recorder.ondataavailable = e => {
    if (!e.data || e.data.size === 0) return;
    chunks.push(e.data);
    bytes += e.data.size;
    if (bytes >= VOICE_MAX_AUDIO_BYTES) sayLimit('size');
  };

  // The live level, from the same microphone. A failure here costs the
  // waveform, never the recording.
  const levels: number[] = [];
  let context: AudioContext | null = null;
  let sampler: ReturnType<typeof setInterval> | null = null;
  try {
    const Ctx: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context = new Ctx();
    // Started by a press on the button, so this is allowed; a context that
    // still comes up suspended would only ever read silence.
    void context.resume().catch(() => {});
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    sampler = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      const level = levelOf(buffer);
      levels.push(level);
      try {
        options.onLevel?.(level);
      } catch {
        /* as above */
      }
    }, LEVEL_EVERY_MS);
  } catch {
    context = null;
  }

  const startedAt = performance.now();
  const timeLimit = setTimeout(() => sayLimit('time'), VOICE_MAX_SECONDS * 1000);
  recorder.start(250);

  let finished = false;
  let finalElapsed = 0;
  const release = () => {
    clearTimeout(timeLimit);
    if (sampler) clearInterval(sampler);
    sampler = null;
    stream.getTracks().forEach(t => t.stop());
    if (context) void context.close().catch(() => {});
    context = null;
    releaseRadio();
    releasePlayback();
  };

  const stopRecorder = (): Promise<void> =>
    new Promise(resolve => {
      if (recorder.state === 'inactive') {
        resolve();
        return;
      }
      recorder.addEventListener('stop', () => resolve(), { once: true });
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });

  return {
    levels: () => levels,
    elapsedMs: () => (finished ? finalElapsed : performance.now() - startedAt),
    async stop() {
      if (finished) return null;
      finished = true;
      const elapsed = Math.min(performance.now() - startedAt, VOICE_MAX_SECONDS * 1000 + 500);
      finalElapsed = elapsed;
      await stopRecorder();
      release();
      if (elapsed < VOICE_MIN_MS || chunks.length === 0) return null;
      const type = recorder.mimeType || chunks[0].type || 'audio/webm';
      const blob = new Blob(chunks, { type });
      const dataUrl = await new Promise<string | null>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (!dataUrl || !dataUrl.startsWith('data:audio/')) return null;
      return {
        dataUrl,
        durationSeconds: Math.max(1, Math.round(elapsed / 100) / 10),
        peaks: summarizePeaks(levels)
      };
    },
    cancel() {
      if (finished) return;
      finished = true;
      finalElapsed = performance.now() - startedAt;
      recorder.ondataavailable = null;
      void stopRecorder();
      release();
    }
  };
}
