// The app's sounds: real audio files, played through the one shared context.
//
// Every sound used to be a couple of bare oscillators assembled at the moment
// it played - a pure tone and a fade, which is what made them sound like
// beeps. They are now designed and rendered ahead of time (see
// two-web/sound-design/): bells, kalimba, singing bowls and the rest, built
// from how those objects actually vibrate, all in one key, in one shared
// room. What ships is the finished sound, about 20 KB each.

import { getAudioContext } from './audioAlerts';

/** Every file in assets/sounds, by name - 'message' for message.mp3. */
const FILES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../assets/sounds/*.mp3', { eager: true, import: 'default' }) as Record<string, string>
  ).map(([path, url]) => [path.replace(/^.*\/([^/]+)\.mp3$/, '$1'), url])
);

export type SoundName =
  | 'message' | 'letter' | 'heartbeat' | 'ringtone'
  | 'breath-in' | 'breath-hold' | 'breath-out'
  | 'water-drop' | 'sunlight' | 'blossom-pop'
  | 'scratch-1' | 'scratch-2' | 'scratch-3' | 'reveal' | 'redeem'
  | 'sketch-1' | 'sketch-2' | 'sketch-3'
  | 'gentle-chime' | 'tick' | 'stamp' | 'timer' | 'pin'
  | 'tea' | 'glance' | 'presence'
  | 'match' | 'no-match' | 'reconcile' | 'reconnect' | 'singing-bowl' | 'unseal'
  | 'kiss' | 'breath-rest';

interface Loaded {
  buffer: AudioBuffer;
  /** Seconds of silence a decoder may have put before the sound itself. */
  lead: number;
}

const loaded = new Map<string, Loaded>();
const loading = new Map<string, Promise<Loaded | null>>();

/**
 * Where the sound actually starts.
 *
 * An MP3 decoder can hand back a few tens of milliseconds of the encoder's
 * padding before the first sample - nothing for music, very noticeable on a
 * tap. The files themselves start on the first sample, so anything silent
 * before it is padding.
 */
function leadingSilence(buffer: AudioBuffer): number {
  const limit = Math.min(buffer.length, Math.floor(buffer.sampleRate * 0.1));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < limit; i++) {
    if (channels.some(c => Math.abs(c[i]) > 1e-4)) return Math.max(0, (i - 8) / buffer.sampleRate);
  }
  return 0;
}

function load(name: string): Promise<Loaded | null> {
  const ready = loaded.get(name);
  if (ready) return Promise.resolve(ready);
  const pending = loading.get(name);
  if (pending) return pending;

  const ctx = getAudioContext();
  const url = FILES[name];
  if (!ctx || !url) return Promise.resolve(null);

  const promise = fetch(url)
    .then(res => res.arrayBuffer())
    // The callback form as well as the promise: older WebViews only have the callback.
    .then(data => new Promise<AudioBuffer>((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)))
    .then(buffer => {
      const sound = { buffer, lead: leadingSilence(buffer) };
      loaded.set(name, sound);
      return sound;
    })
    .catch(() => null)
    .finally(() => loading.delete(name));
  loading.set(name, promise);
  return promise;
}

/**
 * Loads the sounds most likely to be needed first, ahead of time - so the
 * first message of the day chimes on time instead of after a fetch and a
 * decode. Everything else loads the first time it plays.
 */
export function preloadSounds() {
  for (const name of ['message', 'letter', 'heartbeat', 'ringtone'] as const) void load(name);
}

export interface PlayOptions {
  /** Playback speed - and with it pitch: 2 is an octave up. */
  rate?: number;
  /** Level against the sound's own (1 = as designed). */
  gain?: number;
}

export interface Playing {
  /** Fades the sound out over a few tens of milliseconds and stops it. */
  stop(): void;
}

/** Plays a sound. Never throws: a sound that cannot play is simply not heard. */
export function playSound(name: SoundName, options: PlayOptions = {}): Playing {
  let stopped = false;
  let source: AudioBufferSourceNode | null = null;
  let level: GainNode | null = null;

  const start = (sound: Loaded) => {
    const ctx = getAudioContext();
    if (!ctx || stopped) return;
    try {
      source = ctx.createBufferSource();
      source.buffer = sound.buffer;
      source.playbackRate.value = options.rate ?? 1;
      level = ctx.createGain();
      level.gain.value = options.gain ?? 1;
      source.connect(level);
      level.connect(ctx.destination);
      source.start(0, sound.lead);
    } catch {
      /* the context is closing, or audio is not allowed yet */
    }
  };

  const ready = loaded.get(name);
  if (ready) start(ready);
  else void load(name).then(sound => sound && start(sound));

  return {
    stop() {
      stopped = true;
      const ctx = getAudioContext();
      if (!ctx || !source || !level) return;
      try {
        level.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
        source.stop(ctx.currentTime + 0.2);
      } catch {
        /* already stopped */
      }
    }
  };
}

/** One of several takes of the same sound, so a repeated scratch never sounds mechanical. */
export function playOneOf(names: SoundName[], options?: PlayOptions): Playing {
  return playSound(names[Math.floor(Math.random() * names.length)], options);
}
