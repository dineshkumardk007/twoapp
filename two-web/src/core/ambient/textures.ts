// Everything the ambient engines play that is rendered rather than
// synthesised live: the noise beds, the rooms, the textures of rain and fire,
// and every note of the radio's instruments.
//
// Pure functions of their arguments, with no Web Audio in sight, so they run
// in a worker (render.worker.ts) instead of on the thread that draws the app.
// Rendering a station's notes used to happen inside the tap that started it,
// and froze the screen for a second or more on a phone.

import { SR, Stereo, Partial, silence, noise, mode, strike, hz, INSTRUMENTS, rng, roomImpulse, pluck, keys } from './synth';

/** Rendered samples: one channel or two, at a sample rate. */
export interface Rendered {
  channels: Float32Array[];
  rate: number;
}

const stereo = (s: Stereo): Rendered => ({ channels: [s.L, s.R], rate: SR });
const mono = (x: Float32Array): Rendered => ({ channels: [x], rate: SR });

// ---------------------------------------------------------------- noise

export type NoiseKind = 'white' | 'pink' | 'brown';

/**
 * Stereo noise that loops without a seam.
 *
 * Each ear gets its own noise, which is what makes it wide rather than a
 * single point. The end is crossfaded into the beginning: brown noise in
 * particular wanders, and a loop that jumped back to where it started would
 * click every ten seconds. The crossfade is equal-power - the two ends are
 * unrelated noise, so a plain linear one dipped 3 dB in the middle of every
 * seam, a faint pulse once a loop.
 */
function noiseBed(kind: NoiseKind, seconds: number): Stereo {
  const n = Math.floor(seconds * SR);
  const x = Math.floor(0.25 * SR);
  const make = (seed: number) => {
    const raw = new Float32Array(n + x);
    // The generator is written out in the loop, its state a local: that is
    // what lets it run unboxed, several times faster than calling one.
    let s = seed >>> 0 || 1;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, brown = 0;
    for (let i = 0; i < raw.length; i++) {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      const w = s / 2147483648 - 1;
      if (kind === 'white') raw[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      } else {
        brown = (brown + 0.02 * w) / 1.02;
        raw[i] = brown;
      }
    }
    // Remove any DC, then crossfade the tail into the head.
    let mean = 0;
    for (let i = 0; i < raw.length; i++) mean += raw[i];
    mean /= raw.length;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = raw[i] - mean;
    for (let i = 0; i < x; i++) {
      const f = i / x;
      out[i] = out[i] * Math.sqrt(f) + (raw[n + i] - mean) * Math.sqrt(1 - f);
    }
    // Normalised to an RMS of 0.25 so every kind starts at the same level.
    let e = 0;
    for (let i = 0; i < n; i++) e += out[i] * out[i];
    const g = 0.25 / Math.sqrt(e / n || 1);
    for (let i = 0; i < n; i++) out[i] *= g;
    return out;
  };
  return { L: make(1001 + kind.length), R: make(2002 + kind.length * 7) };
}

// ---------------------------------------------------------------- nature

/**
 * A tiny decaying ping, falling slightly in pitch: one drop on a leaf.
 * What synth's mode() does, with the envelopes as running products instead
 * of two exps a sample - there are hundreds of these in a texture.
 */
function ping(out: Stereo, o: { freq: number; amp: number; decay: number; start: number; attack: number; glide: number; glideTime: number; pan: number }) {
  const n0 = Math.floor(o.start * SR);
  const len = Math.min(out.L.length - n0, Math.ceil(o.decay * 8 * SR));
  const atk = Math.max(1, Math.floor(o.attack * SR));
  const a = ((Math.max(-1, Math.min(1, o.pan)) + 1) * Math.PI) / 4;
  const gl = Math.cos(a), gr = Math.sin(a);
  const kEnv = Math.exp(-1 / (o.decay * SR));
  const kGlide = Math.exp(-1 / (o.glideTime * SR));
  const w = (2 * Math.PI * o.freq) / SR;
  let env = o.amp, glide = o.glide, phase = 0;
  for (let i = 0; i < len; i++) {
    phase += w * (1 + glide);
    let e = env;
    if (i < atk) e *= 0.5 - 0.5 * Math.cos((Math.PI * i) / atk);
    const v = e * Math.sin(phase);
    out.L[n0 + i] += v * gl;
    out.R[n0 + i] += v * gr;
    env *= kEnv;
    glide *= kGlide;
  }
}

/** Many tiny impacts: the close-up sound of rain on leaves and glass. */
function patterTexture(seed: number): Stereo {
  const b = silence(8);
  const rand = rng(seed);
  const perSecond = 150;
  for (let i = 0; i < 8 * perSecond; i++) {
    const t = rand() * 7.95;
    const level = 0.08 * Math.pow(rand(), 2.2) + 0.006;
    const pan = rand() * 1.8 - 0.9;
    if (rand() < 0.6) {
      noise(b, { start: t, dur: 0.002 + rand() * 0.003, gain: level, filter: { type: 'bandpass', f: 2500 + rand() * 4500, q: 1.2 }, attack: 0.0003, decay: 0.0015, pan, seed: seed + i });
    } else {
      ping(b, { freq: 2200 + rand() * 3300, amp: level * 0.8, decay: 0.004 + rand() * 0.006, start: t, attack: 0.0004, glide: -0.25, glideTime: 0.004, pan });
    }
  }
  return b;
}

/** A single fat drop landing in water. */
function dripSound(seed: number): Stereo {
  const rand = rng(seed);
  const b = silence(0.25);
  const f = 900 + rand() * 800;
  mode(b, { freq: f, amp: 0.7, decay: 0.025 + rand() * 0.02, attack: 0.0008, glide: -0.4, glideTime: 0.01 });
  mode(b, { freq: f * 1.9, amp: 0.1, decay: 0.012, attack: 0.0008, glide: -0.4, glideTime: 0.01 });
  noise(b, { dur: 0.02, gain: 0.05, filter: { type: 'highpass', f: 3500 }, attack: 0.0004, decay: 0.006, seed: seed + 1 });
  return b;
}

/** A drop striking a skylight: short, glassy. */
function glassTick(seed: number): Stereo {
  const rand = rng(seed);
  const b = silence(0.15);
  const f = 3000 + rand() * 1300;
  mode(b, { freq: f, amp: 0.5, decay: 0.012, attack: 0.0004 });
  mode(b, { freq: f * 2.32, amp: 0.15, decay: 0.006, attack: 0.0004 });
  return b;
}

/** The fizz of a fire: clusters of sharp clicks, each one a tiny resonance. */
function crackleTexture(seed: number): Stereo {
  const b = silence(10);
  const rand = rng(seed);
  let t = 0;
  let k = 0;
  while (t < 9.9) {
    t += -Math.log(1 - rand()) / 3.2; // about three clusters a second, irregularly
    const clicks = 1 + Math.floor(rand() * 5);
    const pan = rand() * 0.8 - 0.4;
    let c = t;
    for (let j = 0; j < clicks && c < 9.95; j++) {
      noise(b, {
        start: c,
        dur: 0.002 + rand() * 0.004,
        gain: 0.06 + 0.3 * Math.pow(rand(), 2),
        filter: { type: 'bandpass', f: 1200 + rand() * 3800, q: 1 + rand() * 2 },
        attack: 0.0002,
        decay: 0.001 + rand() * 0.002,
        pan: pan + (rand() * 0.2 - 0.1),
        seed: seed + ++k
      });
      c += 0.005 + rand() * 0.035;
    }
  }
  return b;
}

/** A log giving way: a click, a low knock and a hiss. */
function popSound(seed: number): Stereo {
  const rand = rng(seed);
  const b = silence(0.3);
  noise(b, { dur: 0.008, gain: 0.5, filter: { type: 'bandpass', f: 2000 + rand() * 1500, q: 1.5 }, attack: 0.0002, decay: 0.002, seed });
  mode(b, { freq: 120 + rand() * 60, amp: 0.4, decay: 0.035, attack: 0.001, glide: 0.8, glideTime: 0.012 });
  mode(b, { freq: 360 + rand() * 120, amp: 0.2, decay: 0.02, attack: 0.001, glide: 0.8, glideTime: 0.01 });
  noise(b, { start: 0.005, dur: 0.07, gain: 0.08, filter: { type: 'highpass', f: 4000 }, attack: 0.002, decay: 0.025, seed: seed + 3 });
  return b;
}

/** Leaves moving: soft, high, grainy. */
function rustleTexture(seed: number): Stereo {
  const b = silence(8);
  const rand = rng(seed);
  for (let i = 0; i < 8 * 70; i++) {
    noise(b, { start: rand() * 7.95, dur: 0.005 + rand() * 0.02, gain: 0.03 * rand(), filter: { type: 'highpass', f: 2800 + rand() * 2000, q: 0.8 }, attack: 0.002, decay: 0.006, pan: rand() * 1.6 - 0.8, seed: seed + i });
  }
  return b;
}

/** One cricket's chirp: a few rapid pulses of a high tone. */
function chirpSound(freq: number, pulses: number): Stereo {
  const b = silence(0.15);
  const pulse = 0.013;
  const gap = 0.009;
  for (let p = 0; p < pulses; p++) {
    const start = p * (pulse + gap);
    const n0 = Math.floor(start * SR);
    const n = Math.floor(pulse * SR);
    for (let i = 0; i < n; i++) {
      const env = Math.sin((Math.PI * i) / n) ** 2;
      const t = (n0 + i) / SR;
      const v = env * (Math.sin(2 * Math.PI * freq * t) + 0.15 * Math.sin(4 * Math.PI * freq * t));
      b.L[n0 + i] += v * 0.5;
      b.R[n0 + i] += v * 0.5;
    }
  }
  return b;
}

/** A small songbird phrase, a long way off. */
function birdPhrase(seed: number): Stereo {
  const rand = rng(seed);
  const b = silence(1.2);
  const syllables = 2 + Math.floor(rand() * 4);
  let t = 0;
  const base = 2600 + rand() * 1600;
  for (let s = 0; s < syllables; s++) {
    const dur = 0.04 + rand() * 0.07;
    const f0 = base * (0.85 + rand() * 0.3);
    const f1 = f0 * (rand() < 0.5 ? 1.35 : 0.75);
    const n0 = Math.floor(t * SR);
    const n = Math.floor(dur * SR);
    let ph = 0;
    for (let i = 0; i < n && n0 + i < b.L.length; i++) {
      const p = i / n;
      const f = f0 * Math.pow(f1 / f0, p) * (1 + 0.03 * Math.sin(2 * Math.PI * 38 * (i / SR)));
      ph += (2 * Math.PI * f) / SR;
      const env = Math.sin(Math.PI * p) ** 1.5;
      const v = 0.4 * env * Math.sin(ph);
      b.L[n0 + i] += v;
      b.R[n0 + i] += v;
    }
    t += dur + 0.03 + rand() * 0.08;
  }
  return b;
}

/** A cup set down, a spoon against porcelain - far across the room. */
function clinkSound(seed: number): Stereo {
  const rand = rng(seed);
  const b = silence(1);
  strike(b, { note: hz(rand() < 0.5 ? 'E7' : 'F#7'), instrument: INSTRUMENTS.glass, gain: 0.5, decayScale: 0.18, mallet: 0.5, malletTone: 6000, seed });
  return b;
}

// ---------------------------------------------------------------- music

/** The crackle and hiss of an old record. */
function vinylTexture(seed: number): Stereo {
  const b = silence(9);
  const rand = rng(seed);
  for (let i = 0; i < 9 * 7; i++) {
    noise(b, { start: rand() * 8.95, dur: 0.0015 + rand() * 0.002, gain: 0.08 + 0.4 * Math.pow(rand(), 3), filter: { type: 'highpass', f: 1200 + rand() * 2000 }, attack: 0.0001, decay: 0.0008, pan: rand() * 0.6 - 0.3, seed: seed + i });
  }
  noise(b, { dur: 9, gain: 0.012, filter: { type: 'bandpass', f: 5500, q: 0.6 }, attack: 0.01, seed: seed + 999 });
  return b;
}

/**
 * One electric-piano note, 5.5 s. The last 1.2 s fade, so the release begins
 * at 4.3 s - after the longest bar (4.2 s), so every chord still rings into
 * the next one at its natural level, and only then lets go.
 */
function keysNote(note: number): Float32Array {
  const out = new Float32Array(Math.ceil(5.5 * SR));
  keys(out, { note, gain: 0.5, decay: 1.7 });
  return out;
}

/** One plucked-string note. */
function pluckNote(note: number): Float32Array {
  const out = new Float32Array(3 * SR);
  pluck(out, { note, gain: 0.55, brightness: 0.55, length: 2.9, seed: Math.round(note) });
  return out;
}

/** One bell, bowl or glass note, struck dead centre so it can be kept in mono. */
function bellNote(note: number, instrument: Partial[]): Float32Array {
  const b = silence(4);
  strike(b, { note, instrument, gain: 0.5, mallet: 0.1, attack: 0.004, spread: 0, seed: Math.round(note) });
  // Struck at the centre, each ear carries cos(pi/4) of it; mono is that undone.
  const out = b.L;
  for (let i = 0; i < out.length; i++) out[i] *= Math.SQRT2;
  return out;
}

// ---------------------------------------------------------------- the recipes

/** Everything that can be rendered, by name: what a worker is asked to make. */
export const RECIPES = {
  noise: (a: { kind: NoiseKind; seconds: number }) => stereo(noiseBed(a.kind, a.seconds)),
  room: (a: { rt60: number; damping: number; rate: number }): Rendered => {
    const r = roomImpulse({ rt60: a.rt60, damping: a.damping }, a.rate);
    return { channels: [r.L, r.R], rate: a.rate };
  },
  patter: (a: { seed: number }) => stereo(patterTexture(a.seed)),
  drip: (a: { seed: number }) => stereo(dripSound(a.seed)),
  tick: (a: { seed: number }) => stereo(glassTick(a.seed)),
  crackle: (a: { seed: number }) => stereo(crackleTexture(a.seed)),
  pop: (a: { seed: number }) => stereo(popSound(a.seed)),
  rustle: (a: { seed: number }) => stereo(rustleTexture(a.seed)),
  chirp: (a: { freq: number; pulses: number }) => stereo(chirpSound(a.freq, a.pulses)),
  bird: (a: { seed: number }) => stereo(birdPhrase(a.seed)),
  clink: (a: { seed: number }) => stereo(clinkSound(a.seed)),
  vinyl: (a: { seed: number }) => stereo(vinylTexture(a.seed)),
  keys: (a: { note: number }) => mono(keysNote(a.note)),
  pluck: (a: { note: number }) => mono(pluckNote(a.note)),
  bell: (a: { note: number; instrument: Partial[] }) => mono(bellNote(a.note, a.instrument))
} satisfies Record<string, (args: never) => Rendered>;

export type RecipeName = keyof typeof RECIPES;
export type RecipeArgs<N extends RecipeName> = Parameters<(typeof RECIPES)[N]>[0];

/** A buffer to make: which recipe, with what, and the name it is kept under. */
export interface Recipe {
  name: RecipeName;
  args: unknown;
  key: string;
}

export function recipe<N extends RecipeName>(name: N, args: RecipeArgs<N>, key = `${name}:${JSON.stringify(args)}`): Recipe {
  return { name, args, key };
}

export function renderRecipe(r: { name: RecipeName; args: unknown }): Rendered {
  return (RECIPES[r.name] as (args: unknown) => Rendered)(r.args);
}
