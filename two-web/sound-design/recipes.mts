// Every sound in Two, as a recipe.
//
// One key throughout - D major pentatonic (D E F# A B) - so any two sounds that
// overlap still agree with each other, and the app has a sound of its own.
//
// Levels are set per kind of sound, as the loudest 300 ms in dBFS RMS:
// something meant to reach you across a room (a message, a call) sits above a
// celebration, which sits above the quiet feedback of a tap or a stroke.
//
// Phone speakers play almost nothing below ~150 Hz, so weight that matters -
// a heartbeat, a stamp - is carried by overtones they can reproduce.

import { Stereo, silence, hz, strike, mode, noise, INSTRUMENTS as I, RoomOptions, MasterOptions, SR } from './dsp.mts';

const ALERT = -19;
const MOMENT = -21;
const SOFT = -24;
const MICRO = -26;

export interface Recipe {
  /** What it is for, for the render report. */
  use: string;
  dry: () => Stereo;
  room?: RoomOptions;
  master: MasterOptions;
}

/**
 * A soft thump with overtones a phone can play: heartbeat, stamp.
 *
 * A real thump lives below 100 Hz, which a phone speaker barely reproduces -
 * so the felt weight is carried by its overtones (2x-4x the base) and a short
 * body knock around 300-900 Hz, both of which a phone does play. The ear fills
 * in the missing fundamental from the overtones.
 */
function thump(b: Stereo, start: number, gain: number, base: number, seed: number) {
  mode(b, { freq: base, amp: gain * 0.7, decay: 0.07, start, attack: 0.003, glide: 0.9, glideTime: 0.025 });
  mode(b, { freq: base * 2, amp: gain * 0.8, decay: 0.055, start, attack: 0.002, glide: 0.9, glideTime: 0.02 });
  mode(b, { freq: base * 3, amp: gain * 0.5, decay: 0.04, start, attack: 0.002, glide: 0.9, glideTime: 0.018 });
  mode(b, { freq: base * 4, amp: gain * 0.25, decay: 0.03, start, attack: 0.002, glide: 0.9, glideTime: 0.015 });
  noise(b, { start, dur: 0.06, gain: gain * 0.45, filter: { type: 'bandpass', f: 520, q: 0.9 }, attack: 0.001, decay: 0.014, seed });
}

/** A run of notes on one instrument. */
function run(b: Stereo, notes: string[], gap: number, opts: { instrument: typeof I.glass; gain: number[] | number; start?: number; seed: number; decayScale?: number; brightness?: number; mallet?: number; attack?: number }) {
  notes.forEach((n, i) => {
    strike(b, {
      note: hz(n),
      instrument: opts.instrument,
      start: (opts.start ?? 0) + i * gap,
      gain: Array.isArray(opts.gain) ? opts.gain[i] : opts.gain,
      pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.5,
      seed: opts.seed + i,
      decayScale: opts.decayScale,
      brightness: opts.brightness,
      mallet: opts.mallet,
      attack: opts.attack
    });
  });
}

/** A whisper of air, for sparkle or breath. */
function air(b: Stereo, o: { start: number; dur: number; gain: number; from: number; to: number; attack: number; seed: number }) {
  noise(b, { start: o.start, dur: o.dur, gain: o.gain, filter: { type: 'bandpass', f: o.from, q: 0.7 }, sweepTo: o.to, attack: o.attack, pink: true, seed: o.seed });
}

function scratch(seed: number, center: number): Recipe {
  return {
    use: 'scratch card foil, one grain of the scratch',
    dry: () => {
      const b = silence(0.2);
      noise(b, { dur: 0.09, gain: 1, filter: { type: 'bandpass', f: center, q: 1.4 }, grain: 0.7, attack: 0.004, decay: 0.04, seed });
      return b;
    },
    room: { rt60: 0.3, wet: 0.05 },
    master: { loudness: MICRO - 1, highpass: 600 }
  };
}

function sketch(seed: number, center: number): Recipe {
  return {
    use: 'pencil touching the shared canvas',
    dry: () => {
      const b = silence(0.25);
      noise(b, { dur: 0.14, gain: 1, filter: { type: 'bandpass', f: center, q: 0.8 }, grain: 0.85, attack: 0.006, decay: 0.06, seed });
      return b;
    },
    room: { rt60: 0.3, wet: 0.04 },
    master: { loudness: MICRO - 2, highpass: 800 }
  };
}

/**
 * A voice whose pitch follows a curve: a cartoon squeak, a boing, a chirp.
 * Struck sounds ring at one pitch; these bend, which is most of what makes
 * a sound read as a cartoon.
 */
function voice(
  b: Stereo,
  o: { start: number; dur: number; freq: (t: number) => number; amp: (t: number) => number; harmonics?: number[]; pan?: number }
) {
  const n0 = Math.floor(o.start * SR);
  const len = Math.min(b.L.length - n0, Math.ceil(o.dur * SR));
  if (len <= 0) return;
  const h = o.harmonics ?? [1];
  const a = (((o.pan ?? 0) + 1) * Math.PI) / 4;
  const gl = Math.cos(a);
  const gr = Math.sin(a);
  const fadeIn = Math.floor(0.003 * SR);
  const fadeOut = Math.floor(0.008 * SR);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * o.freq(t)) / SR;
    let s = 0;
    for (let k = 0; k < h.length; k++) s += h[k] * Math.sin(phase * (k + 1));
    let env = o.amp(t);
    if (i < fadeIn) env *= i / fadeIn;
    if (i > len - fadeOut) env *= (len - i) / fadeOut;
    b.L[n0 + i] += env * s * gl;
    b.R[n0 + i] += env * s * gr;
  }
}

/** One squeaky "hee" of a giggle: up a little and back down. */
function hee(b: Stereo, start: number, note: number, gain: number, pan: number, seed: number) {
  const dur = 0.075;
  voice(b, {
    start,
    dur,
    freq: t => note * (1 + 0.16 * Math.sin((Math.PI * t) / dur)),
    amp: t => gain * Math.sin((Math.PI * t) / dur) ** 0.7,
    harmonics: [1, 0.35, 0.12],
    pan
  });
  noise(b, { start, dur: 0.05, gain: gain * 0.12, filter: { type: 'bandpass', f: 3200, q: 1 }, attack: 0.01, decay: 0.02, pan, seed });
}

/** A jaw-harp "boing": a drop in pitch that keeps wobbling as it dies. */
function boing(b: Stereo, start: number, base: number, gain: number) {
  voice(b, {
    start,
    dur: 0.55,
    freq: t => base * (1 + 0.6 * Math.exp(-t / 0.04)) * (1 + 0.18 * Math.sin(2 * Math.PI * 14 * t) * Math.exp(-t / 0.3)),
    amp: t => gain * Math.exp(-t / 0.2),
    harmonics: [1, 0.3, 0.1]
  });
}

export const RECIPES: Record<string, Recipe> = {
  message: {
    use: 'a new message from your partner',
    dry: () => {
      const b = silence(2);
      strike(b, { note: hz('A5'), instrument: I.glass, gain: 0.7, pan: -0.12, mallet: 0.18, seed: 11, decayScale: 0.9 });
      strike(b, { note: hz('D6'), instrument: I.glass, start: 0.085, gain: 0.85, pan: 0.12, mallet: 0.18, seed: 12 });
      // Body an octave below, so a phone speaker has something warm under the glass.
      strike(b, { note: hz('D5'), instrument: I.felt, start: 0.085, gain: 0.18, mallet: 0, seed: 13, decayScale: 0.7 });
      return b;
    },
    room: { rt60: 1.3, wet: 0.16 },
    master: { loudness: ALERT }
  },

  letter: {
    use: 'a love letter or whisper memo arriving',
    dry: () => {
      const b = silence(3);
      strike(b, { note: hz('D4'), instrument: I.felt, gain: 0.2, mallet: 0, seed: 21, decayScale: 1.4 });
      run(b, ['D5', 'F#5', 'A5', 'D6'], 0.09, { instrument: I.kalimba, gain: [0.55, 0.6, 0.65, 0.8], seed: 22 });
      strike(b, { note: hz('D7'), instrument: I.glock, start: 0.27, gain: 0.16, mallet: 0, seed: 27 });
      return b;
    },
    room: { rt60: 1.9, wet: 0.26 },
    master: { loudness: ALERT - 1 }
  },

  heartbeat: {
    use: 'a nudge, a touch, a sensory pulse',
    dry: () => {
      const b = silence(0.8);
      thump(b, 0, 1, 92, 31);
      thump(b, 0.25, 0.75, 84, 32);
      return b;
    },
    room: { rt60: 0.5, wet: 0.08, damping: 0.3 },
    // Cut below what a phone can play, so the level is set by what is heard.
    master: { loudness: MOMENT, highpass: 110 }
  },

  'breath-in': {
    use: 'comfort box: breathe in',
    dry: () => {
      const b = silence(2.6);
      strike(b, { note: hz('A4'), instrument: I.bowl, gain: 0.5, attack: 0.25, mallet: 0, seed: 41, decayScale: 0.5 });
      air(b, { start: 0, dur: 1.2, gain: 0.08, from: 500, to: 2200, attack: 0.5, seed: 42 });
      return b;
    },
    room: { rt60: 2.2, wet: 0.25 },
    master: { loudness: SOFT, maxSeconds: 2.2, tailFade: 0.8 }
  },

  'breath-hold': {
    use: 'comfort box: hold',
    dry: () => {
      const b = silence(2.8);
      strike(b, { note: hz('E4'), instrument: I.bowl, gain: 0.45, attack: 0.08, mallet: 0, seed: 43, decayScale: 0.6 });
      strike(b, { note: hz('E5'), instrument: I.glass, gain: 0.12, attack: 0.05, mallet: 0, seed: 44, decayScale: 1.6 });
      return b;
    },
    room: { rt60: 2.2, wet: 0.25 },
    master: { loudness: SOFT - 1, maxSeconds: 2.4, tailFade: 0.9 }
  },

  'breath-out': {
    use: 'comfort box: breathe out',
    dry: () => {
      const b = silence(3);
      strike(b, { note: hz('D4'), instrument: I.bowl, gain: 0.5, attack: 0.05, mallet: 0, seed: 45, decayScale: 0.7 });
      air(b, { start: 0, dur: 1.6, gain: 0.07, from: 1800, to: 400, attack: 0.1, seed: 46 });
      return b;
    },
    room: { rt60: 2.4, wet: 0.25 },
    master: { loudness: SOFT, maxSeconds: 2.6, tailFade: 1 }
  },

  'water-drop': {
    use: 'garden: watering',
    dry: () => {
      const b = silence(0.8);
      // A bubble's pitch rises as it closes: that rise is the "plink".
      mode(b, { freq: 1250, amp: 0.8, decay: 0.045, attack: 0.0008, glide: -0.45, glideTime: 0.012 });
      mode(b, { freq: 2500, amp: 0.1, decay: 0.02, attack: 0.0008, glide: -0.45, glideTime: 0.012 });
      mode(b, { freq: 1650, amp: 0.35, decay: 0.035, start: 0.11, attack: 0.0008, glide: -0.4, glideTime: 0.01, pan: 0.2 });
      noise(b, { dur: 0.03, gain: 0.08, filter: { type: 'highpass', f: 3000 }, attack: 0.0005, decay: 0.008, seed: 51 });
      return b;
    },
    room: { rt60: 0.9, wet: 0.22 },
    master: { loudness: MICRO }
  },

  sunlight: {
    use: 'garden: sunlight',
    dry: () => {
      const b = silence(2.4);
      run(b, ['F#6', 'A6', 'D7', 'F#7'], 0.05, { instrument: I.glock, gain: [0.5, 0.45, 0.4, 0.3], seed: 52, mallet: 0.1 });
      air(b, { start: 0, dur: 1.0, gain: 0.03, from: 6000, to: 9000, attack: 0.2, seed: 53 });
      return b;
    },
    room: { rt60: 1.8, wet: 0.3 },
    master: { loudness: SOFT }
  },

  'blossom-pop': {
    use: 'garden: a flower opening',
    dry: () => {
      const b = silence(1);
      mode(b, { freq: 520, amp: 0.9, decay: 0.03, attack: 0.001, glide: -0.5, glideTime: 0.015 });
      noise(b, { dur: 0.012, gain: 0.25, filter: { type: 'bandpass', f: 1800, q: 1.2 }, attack: 0.0005, decay: 0.004, seed: 54 });
      strike(b, { note: hz('B5'), instrument: I.kalimba, start: 0.045, gain: 0.35, brightness: 0.8, seed: 55 });
      return b;
    },
    room: { rt60: 0.9, wet: 0.15 },
    master: { loudness: MICRO }
  },

  'scratch-1': scratch(61, 2800),
  'scratch-2': scratch(62, 3400),
  'scratch-3': scratch(63, 4100),

  reveal: {
    use: 'scratch card fully revealed',
    dry: () => {
      const b = silence(2.4);
      run(b, ['A5', 'B5', 'D6', 'F#6'], 0.06, { instrument: I.kalimba, gain: [0.5, 0.5, 0.55, 0.6], seed: 64 });
      strike(b, { note: hz('A6'), instrument: I.glock, start: 0.24, gain: 0.35, seed: 68 });
      strike(b, { note: hz('D7'), instrument: I.glock, start: 0.3, gain: 0.28, seed: 69 });
      air(b, { start: 0.2, dur: 0.6, gain: 0.025, from: 5000, to: 8000, attack: 0.1, seed: 70 });
      return b;
    },
    room: { rt60: 1.6, wet: 0.25 },
    master: { loudness: MOMENT }
  },

  'gentle-chime': {
    use: 'a sensory pulse arriving',
    dry: () => {
      const b = silence(3);
      strike(b, { note: hz('D5'), instrument: I.glass, gain: 0.6, pan: -0.2, attack: 0.02, mallet: 0, seed: 71, decayScale: 2.2 });
      strike(b, { note: hz('A5'), instrument: I.glass, gain: 0.45, pan: 0.2, attack: 0.02, mallet: 0, seed: 72, decayScale: 2.0 });
      return b;
    },
    room: { rt60: 2.0, wet: 0.28 },
    master: { loudness: SOFT, maxSeconds: 2.6, tailFade: 0.9 }
  },

  tick: {
    use: 'adventure roulette ticking (pitched up as it spins)',
    dry: () => {
      const b = silence(0.3);
      strike(b, { note: hz('D6'), instrument: I.marimba, gain: 1, decayScale: 0.35, mallet: 0.5, malletTone: 5000, seed: 81 });
      return b;
    },
    room: { rt60: 0.4, wet: 0.05 },
    master: { loudness: MICRO + 1 }
  },

  stamp: {
    use: 'an adventure stamped complete',
    dry: () => {
      const b = silence(2);
      thump(b, 0, 0.9, 160, 82);
      noise(b, { dur: 0.07, gain: 0.6, filter: { type: 'bandpass', f: 1100, q: 0.9 }, grain: 0.3, attack: 0.001, decay: 0.02, seed: 83 });
      strike(b, { note: hz('D5'), instrument: I.kalimba, start: 0.12, gain: 0.5, seed: 84 });
      strike(b, { note: hz('A5'), instrument: I.kalimba, start: 0.2, gain: 0.6, seed: 85 });
      strike(b, { note: hz('D7'), instrument: I.glock, start: 0.26, gain: 0.15, mallet: 0, seed: 86 });
      return b;
    },
    room: { rt60: 1.2, wet: 0.18 },
    master: { loudness: MOMENT, highpass: 70 }
  },

  'sketch-1': sketch(91, 4000),
  'sketch-2': sketch(92, 4800),
  'sketch-3': sketch(93, 5600),

  timer: {
    use: 'cookbook timer done',
    dry: () => {
      const b = silence(3.2);
      strike(b, { note: hz('D6'), instrument: I.bell, gain: 0.8, mallet: 0.4, seed: 101 });
      strike(b, { note: hz('D6'), instrument: I.bell, start: 0.5, gain: 0.7, mallet: 0.4, seed: 102 });
      return b;
    },
    room: { rt60: 1.6, wet: 0.2 },
    master: { loudness: MOMENT, maxSeconds: 2.8, tailFade: 1 }
  },

  pin: {
    use: 'a pin dropped on the coordinates map (pitched per pin)',
    dry: () => {
      const b = silence(1.4);
      strike(b, { note: hz('A5'), instrument: I.glass, gain: 0.8, decayScale: 0.55, mallet: 0.3, seed: 111 });
      return b;
    },
    room: { rt60: 1.4, wet: 0.3 },
    master: { loudness: SOFT }
  },

  tea: {
    use: 'co-presence: tea together (porcelain clink)',
    dry: () => {
      const b = silence(0.6);
      strike(b, { note: hz('E7'), instrument: I.glass, gain: 0.5, decayScale: 0.12, mallet: 0.6, malletTone: 6000, seed: 121, pan: -0.15 });
      strike(b, { note: hz('F#7'), instrument: I.glass, start: 0.085, gain: 0.35, decayScale: 0.1, mallet: 0.6, malletTone: 6500, seed: 122, pan: 0.15 });
      return b;
    },
    room: { rt60: 0.6, wet: 0.1 },
    master: { loudness: MICRO }
  },

  glance: {
    use: 'co-presence: a glance',
    dry: () => {
      const b = silence(1.6);
      strike(b, { note: hz('F#5'), instrument: I.felt, gain: 0.45, attack: 0.006, decayScale: 0.8, mallet: 0, seed: 123, pan: -0.15 });
      strike(b, { note: hz('A5'), instrument: I.felt, start: 0.12, gain: 0.5, attack: 0.006, decayScale: 0.8, mallet: 0, seed: 124, pan: 0.15 });
      return b;
    },
    room: { rt60: 1.4, wet: 0.22 },
    master: { loudness: SOFT }
  },

  presence: {
    use: 'co-presence: being here together',
    dry: () => {
      const b = silence(2.6);
      strike(b, { note: hz('A4'), instrument: I.bowl, gain: 0.6, attack: 0.03, mallet: 0, seed: 125, decayScale: 0.8 });
      strike(b, { note: hz('A5'), instrument: I.glass, gain: 0.15, attack: 0.02, mallet: 0, seed: 126 });
      return b;
    },
    room: { rt60: 1.8, wet: 0.25 },
    master: { loudness: SOFT, maxSeconds: 2.3, tailFade: 0.9 }
  },

  match: {
    use: 'intuition game: you both chose the same',
    dry: () => {
      const b = silence(2.6);
      strike(b, { note: hz('D4'), instrument: I.felt, gain: 0.2, mallet: 0, seed: 131, decayScale: 1.2 });
      run(b, ['D5', 'F#5', 'A5', 'D6'], 0.07, { instrument: I.kalimba, gain: [0.5, 0.55, 0.6, 0.7], seed: 132 });
      strike(b, { note: hz('D7'), instrument: I.glock, start: 0.28, gain: 0.25, seed: 137 });
      return b;
    },
    room: { rt60: 1.7, wet: 0.25 },
    master: { loudness: MOMENT }
  },

  'no-match': {
    use: 'intuition game: you chose differently (friendly, never a buzzer)',
    dry: () => {
      const b = silence(1.8);
      strike(b, { note: hz('A5'), instrument: I.felt, gain: 0.45, decayScale: 0.9, mallet: 0, seed: 138 });
      strike(b, { note: hz('F#5'), instrument: I.felt, start: 0.14, gain: 0.4, decayScale: 0.9, mallet: 0, seed: 139 });
      return b;
    },
    room: { rt60: 1.4, wet: 0.2 },
    master: { loudness: SOFT }
  },

  reconcile: {
    use: 'repair bridge: coming back together',
    dry: () => {
      const b = silence(3.4);
      strike(b, { note: hz('D5'), instrument: I.bowl, gain: 0.5, attack: 0.02, mallet: 0.1, malletTone: 1500, seed: 141, decayScale: 0.7 });
      strike(b, { note: hz('A5'), instrument: I.bowl, start: 0.35, gain: 0.35, attack: 0.02, mallet: 0.1, malletTone: 1500, seed: 142, decayScale: 0.6 });
      return b;
    },
    room: { rt60: 2.4, wet: 0.28 },
    master: { loudness: MOMENT - 1, maxSeconds: 3, tailFade: 1.1 }
  },

  redeem: {
    use: 'a scratch card redeemed',
    dry: () => {
      const b = silence(1.8);
      thump(b, 0, 0.8, 150, 151);
      noise(b, { dur: 0.06, gain: 0.5, filter: { type: 'bandpass', f: 1200, q: 0.9 }, grain: 0.3, attack: 0.001, decay: 0.018, seed: 152 });
      strike(b, { note: hz('B6'), instrument: I.glock, start: 0.09, gain: 0.5, mallet: 0.6, seed: 153 });
      strike(b, { note: hz('E7'), instrument: I.glock, start: 0.11, gain: 0.3, mallet: 0.4, seed: 154 });
      return b;
    },
    room: { rt60: 1.2, wet: 0.18 },
    master: { loudness: MOMENT, highpass: 70 }
  },

  reconnect: {
    use: 'soft landing: reconnecting after a hard moment',
    dry: () => {
      const b = silence(3);
      run(b, ['D4', 'A4', 'D5', 'F#5'], 0.18, { instrument: I.felt, gain: [0.5, 0.5, 0.55, 0.5], seed: 161, decayScale: 1.3, mallet: 0, attack: 0.008 });
      return b;
    },
    room: { rt60: 2.0, wet: 0.24 },
    master: { loudness: MOMENT - 1, maxSeconds: 2.8, tailFade: 0.9 }
  },

  'singing-bowl': {
    use: 'state of the union sealed',
    dry: () => {
      const b = silence(5);
      strike(b, { note: hz('D4'), instrument: I.bowl, gain: 0.9, attack: 0.004, mallet: 0.15, malletTone: 1500, seed: 171, decayScale: 1.2 });
      return b;
    },
    room: { rt60: 2.6, wet: 0.22 },
    master: { loudness: MOMENT, maxSeconds: 4.5, tailFade: 1.6 }
  },

  unseal: {
    use: 'a time capsule opened',
    dry: () => {
      const b = silence(3);
      noise(b, { dur: 0.55, gain: 0.5, filter: { type: 'bandpass', f: 300, q: 0.8 }, sweepTo: 2500, attack: 0.25, pink: true, seed: 181 });
      run(b, ['D6', 'F#6', 'A6', 'D7'], 0.07, { instrument: I.glock, start: 0.45, gain: [0.45, 0.45, 0.45, 0.5], seed: 182 });
      return b;
    },
    room: { rt60: 2.0, wet: 0.3 },
    master: { loudness: MOMENT, maxSeconds: 2.8, tailFade: 0.9 }
  },

  kiss: {
    use: 'nightstand: a goodnight kiss sent across',
    dry: () => {
      const b = silence(2.6);
      strike(b, { note: hz('F#5'), instrument: I.felt, gain: 0.4, attack: 0.012, decayScale: 0.9, mallet: 0, seed: 211, pan: -0.15 });
      strike(b, { note: hz('A5'), instrument: I.felt, start: 0.16, gain: 0.45, attack: 0.012, decayScale: 0.9, mallet: 0, seed: 212, pan: 0.15 });
      strike(b, { note: hz('D6'), instrument: I.glass, start: 0.32, gain: 0.22, attack: 0.02, decayScale: 1.4, mallet: 0, seed: 213 });
      return b;
    },
    room: { rt60: 1.8, wet: 0.3 },
    master: { loudness: SOFT + 1, maxSeconds: 2.4, tailFade: 0.8 }
  },

  'breath-rest': {
    use: 'breathing exercise: resting, lungs empty',
    dry: () => {
      const b = silence(2.6);
      strike(b, { note: hz('D4'), instrument: I.bowl, gain: 0.4, attack: 0.03, mallet: 0, seed: 221, decayScale: 0.5 });
      return b;
    },
    room: { rt60: 2.2, wet: 0.25 },
    master: { loudness: SOFT - 2, maxSeconds: 2.2, tailFade: 0.8 }
  },

  ringtone: {
    use: 'incoming call - repeats every 2.2 s',
    dry: () => {
      const b = silence(2.6);
      const notes: [string, number, number][] = [['D5', 0, 0.8], ['A5', 0.17, 0.75], ['F#5', 0.34, 0.75], ['D6', 0.55, 0.9]];
      notes.forEach(([n, t, g], i) => {
        strike(b, { note: hz(n), instrument: I.glass, start: t, gain: g, mallet: 0.22, seed: 191 + i, decayScale: 0.9, pan: (i - 1.5) * 0.12 });
      });
      strike(b, { note: hz('D4'), instrument: I.felt, gain: 0.25, mallet: 0, seed: 199, decayScale: 0.8 });
      strike(b, { note: hz('D5'), instrument: I.felt, start: 0.55, gain: 0.25, mallet: 0, seed: 200, decayScale: 0.8 });
      return b;
    },
    room: { rt60: 1.2, wet: 0.16 },
    // It has to be heard from the next room, and finish before it starts again.
    master: { loudness: ALERT + 1, maxSeconds: 2.1, tailFade: 0.5 }
  },

  // The boop battle (components/UsScene). Each starts on the frame its hit
  // lands, so what happens inside one is spaced to match the moves
  // (components/usMoves): the pats 0.3 s apart, the pinch let go at 0.58 s.

  'us-boop': {
    use: 'Us two: a boop on the nose (pitched up for a run of them)',
    dry: () => {
      const b = silence(0.4);
      voice(b, {
        start: 0,
        dur: 0.3,
        freq: t => hz('A5') * (1 + 0.55 * Math.exp(-t / 0.025)),
        amp: t => 0.9 * Math.exp(-t / 0.07),
        harmonics: [1, 0.25, 0.08]
      });
      mode(b, { freq: hz('A4'), amp: 0.35, decay: 0.06, glide: 0.4, glideTime: 0.02 });
      noise(b, { dur: 0.012, gain: 0.3, filter: { type: 'bandpass', f: 2500, q: 1 }, attack: 0.0005, decay: 0.003, seed: 301 });
      return b;
    },
    room: { rt60: 0.25, wet: 0.05 },
    master: { loudness: MOMENT, highpass: 150 }
  },

  'us-tickle': {
    use: 'Us two: a tickle - a run of squeaky giggles',
    dry: () => {
      const b = silence(1.4);
      const notes = ['B5', 'D6', 'B5', 'A5', 'D6', 'E6', 'D6', 'B5', 'A5', 'B5', 'D6'];
      notes.forEach((n, i) => hee(b, i * 0.1 + (i % 3) * 0.008, hz(n), 0.6 * (1 - i * 0.03), i % 2 ? 0.15 : -0.15, 310 + i));
      return b;
    },
    room: { rt60: 0.3, wet: 0.06 },
    master: { loudness: SOFT + 1, highpass: 300 }
  },

  'us-hehe': {
    use: 'Us two: tapping your own one - a little giggle',
    dry: () => {
      const b = silence(0.4);
      hee(b, 0, hz('D6'), 0.6, -0.1, 331);
      hee(b, 0.14, hz('B5'), 0.55, 0.1, 332);
      return b;
    },
    room: { rt60: 0.3, wet: 0.06 },
    master: { loudness: SOFT, highpass: 300 }
  },

  'us-pinch': {
    use: 'Us two: a cheek pulled out with a rubbery stretch, and let go - boing',
    dry: () => {
      const b = silence(1.3);
      // The pull, as the cheek stretches.
      voice(b, {
        start: 0,
        dur: 0.44,
        freq: t => 230 * 2.2 ** (t / 0.44),
        amp: t => 0.32 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 28 * t)) * Math.min(1, t / 0.05),
        harmonics: [1, 0.6, 0.45, 0.3, 0.2]
      });
      // Let go, as it snaps back.
      boing(b, 0.58, hz('A4'), 0.85);
      return b;
    },
    room: { rt60: 0.3, wet: 0.06 },
    master: { loudness: MOMENT - 1, highpass: 150 }
  },

  'us-pat': {
    use: 'Us two: three soft pats on the head, then an aww',
    dry: () => {
      const b = silence(1.6);
      [0, 0.3, 0.6].forEach((t, i) => {
        thump(b, t, 0.8 - i * 0.05, 170, 340 + i);
        noise(b, { start: t, dur: 0.05, gain: 0.3, filter: { type: 'lowpass', f: 900 }, attack: 0.002, decay: 0.02, pink: true, seed: 345 + i });
      });
      run(b, ['F#6', 'A6'], 0.08, { instrument: I.glass, gain: [0.35, 0.3], start: 0.7, seed: 350, mallet: 0.1 });
      return b;
    },
    room: { rt60: 0.6, wet: 0.1 },
    master: { loudness: SOFT, highpass: 140 }
  },

  'us-whoosh': {
    use: 'Us two: a pillow flying through the air',
    dry: () => {
      const b = silence(0.5);
      noise(b, { dur: 0.22, gain: 0.8, filter: { type: 'bandpass', f: 450, q: 0.8 }, sweepTo: 2200, attack: 0.15, pink: true, seed: 361 });
      noise(b, { start: 0.18, dur: 0.2, gain: 0.6, filter: { type: 'bandpass', f: 2200, q: 0.8 }, sweepTo: 900, attack: 0.01, decay: 0.08, pink: true, seed: 362 });
      return b;
    },
    room: { rt60: 0.3, wet: 0.05 },
    master: { loudness: SOFT, highpass: 200 }
  },

  'us-bonk': {
    use: 'Us two: a pillow landing on a head - fwump, bonk',
    dry: () => {
      const b = silence(0.6);
      thump(b, 0, 1, 110, 371);
      noise(b, { dur: 0.1, gain: 0.7, filter: { type: 'lowpass', f: 1400 }, attack: 0.002, decay: 0.03, pink: true, seed: 372 });
      mode(b, { freq: hz('A5'), amp: 0.45, decay: 0.045, glide: 0.35, glideTime: 0.01 });
      mode(b, { freq: hz('A5') * 1.5, amp: 0.15, decay: 0.03, glide: 0.35, glideTime: 0.01 });
      return b;
    },
    room: { rt60: 0.3, wet: 0.06 },
    master: { loudness: MOMENT, highpass: 120 }
  },

  'us-dizzy': {
    use: 'Us two: stars round a bonked head - tweet tweet',
    dry: () => {
      const b = silence(0.9);
      ['D7', 'F#7', 'E7'].forEach((n, i) => {
        const f = hz(n);
        voice(b, {
          start: i * 0.16,
          dur: 0.09,
          freq: t => f * (1 + 0.25 * (t / 0.09)) * (1 + 0.03 * Math.sin(2 * Math.PI * 40 * t)),
          amp: t => 0.35 * Math.sin((Math.PI * t) / 0.09),
          pan: (i - 1) * 0.3
        });
      });
      return b;
    },
    room: { rt60: 0.5, wet: 0.1 },
    master: { loudness: SOFT - 1, highpass: 500 }
  },

  'us-hop': {
    use: 'Us two: a little hop as one of them moves',
    dry: () => {
      const b = silence(0.15);
      mode(b, { freq: 520, amp: 0.6, decay: 0.025, glide: -0.25, glideTime: 0.02 });
      noise(b, { dur: 0.02, gain: 0.2, filter: { type: 'bandpass', f: 1500, q: 1 }, attack: 0.001, decay: 0.006, seed: 381 });
      return b;
    },
    room: { rt60: 0.2, wet: 0.04 },
    master: { loudness: MICRO, highpass: 200 }
  },

  'us-shh': {
    use: 'Us two: shh - they are asleep',
    dry: () => {
      const b = silence(0.75);
      noise(b, { dur: 0.6, gain: 0.7, filter: { type: 'bandpass', f: 3600, q: 0.9 }, attack: 0.18, pink: true, seed: 391 });
      return b;
    },
    room: { rt60: 0.3, wet: 0.05 },
    master: { loudness: MICRO, highpass: 800 }
  }
};
