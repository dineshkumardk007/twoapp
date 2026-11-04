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

/**
 * Happy Birthday (a folk tune, free to play), in D, on a music-box kalimba
 * over soft felt chords. Each note: [name, beats]; a beat is `beat` seconds.
 * The whole song, or only its first line.
 */
function birthdayTune(b: Stereo, beat: number, lines: number) {
  const tune: [string, number][][] = [
    [['A4', 0.75], ['A4', 0.25], ['B4', 1], ['A4', 1], ['D5', 1], ['C#5', 2]],
    [['A4', 0.75], ['A4', 0.25], ['B4', 1], ['A4', 1], ['E5', 1], ['D5', 2]],
    [['A4', 0.75], ['A4', 0.25], ['A5', 1], ['F#5', 1], ['D5', 1], ['C#5', 1], ['B4', 2]],
    [['G5', 0.75], ['G5', 0.25], ['F#5', 1], ['D5', 1], ['E5', 1], ['D5', 3]]
  ];
  // The chord under each bar, from the first downbeat (after "Hap-py"), three beats a bar.
  const chords: [string, string][] = [
    ['D4', 'F#4'], ['A3', 'E4'], ['A3', 'G4'], ['D4', 'F#4'], ['D4', 'A4'], ['G3', 'B3'], ['A3', 'C#4'], ['D4', 'F#4']
  ];
  let t = 0;
  let seed = 400;
  tune.slice(0, lines).forEach(line => {
    line.forEach(([note, beats], i) => {
      // The pickup notes lighter, the long ones leaned on a little.
      const gain = beats < 1 ? 0.5 : beats >= 2 ? 0.8 : 0.68;
      strike(b, { note: hz(note), instrument: I.kalimba, start: t, gain, pan: (i % 2 ? 0.08 : -0.08), seed: seed++, decayScale: beats >= 2 ? 1.6 : 1.1, mallet: 0.12 });
      if (beats >= 2) strike(b, { note: hz(note) * 2, instrument: I.glock, start: t, gain: 0.06, mallet: 0, seed: seed++ });
      t += beats * beat;
    });
  });
  const bars = lines === 4 ? chords.length : 2;
  for (let i = 0; i < bars; i++) {
    const at = beat + i * 3 * beat;
    chords[i].forEach((note, j) => strike(b, { note: hz(note), instrument: I.felt, start: at + j * 0.02, gain: 0.16, mallet: 0, seed: 470 + i * 2 + j, decayScale: 1.2 }));
  }
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
  },

  // The newer plays. Each is started so that its hit lands on the frame the
  // move's does (UsScene, soundsFor), and what follows inside it is spaced
  // to the moves (usMoves): the squeezes of a hug, the chews, the rubs.

  'us-hug': {
    use: 'Us two: a hug - a soft squeeze as the arms close, a happy "mmm", two more squeezes',
    dry: () => {
      const b = silence(1.5);
      // As the arms close, and as they squeeze again rocking (0.42 s, 0.88 s).
      [0, 0.42, 0.88].forEach((t, i) => {
        noise(b, { start: t, dur: 0.22, gain: 0.45 - i * 0.08, filter: { type: 'lowpass', f: 1100 }, attack: 0.03, decay: 0.08, pink: true, seed: 501 + i });
        thump(b, t + 0.02, 0.35 - i * 0.06, 150, 504 + i);
      });
      // Mmm: a contented hum, up a little and down.
      voice(b, {
        start: 0.03,
        dur: 0.6,
        freq: t => hz('A4') * (1 + 0.07 * Math.sin((Math.PI * t) / 0.6)) * (1 + 0.012 * Math.sin(2 * Math.PI * 5.5 * t)),
        amp: t => 0.32 * Math.max(0, Math.sin((Math.PI * t) / 0.6)) ** 0.8,
        harmonics: [1, 0.55, 0.3, 0.14]
      });
      run(b, ['F#6', 'A6'], 0.09, { instrument: I.glass, gain: [0.22, 0.2], start: 1.03, seed: 508, mallet: 0.05 });
      return b;
    },
    room: { rt60: 0.6, wet: 0.12 },
    master: { loudness: SOFT + 1, highpass: 140 }
  },

  'us-kiss': {
    use: 'Us two: a kiss on the cheek - mwah!',
    dry: () => {
      const b = silence(0.9);
      // The lips' pop.
      noise(b, { dur: 0.03, gain: 0.9, filter: { type: 'bandpass', f: 1500, q: 1.1 }, attack: 0.0008, decay: 0.007, seed: 511 });
      mode(b, { freq: 700, amp: 0.3, decay: 0.02, glide: -0.3, glideTime: 0.015 });
      // "-wah": a little voice opening up.
      voice(b, {
        start: 0.015,
        dur: 0.2,
        freq: t => 430 * (1 + 0.35 * Math.min(1, t / 0.07)) * (1 - (0.12 * Math.max(0, t - 0.1)) / 0.1),
        amp: t => 0.4 * Math.min(1, t / 0.02) * Math.exp(-t / 0.09),
        harmonics: [1, 0.6, 0.35, 0.15]
      });
      run(b, ['D6', 'F#6'], 0.09, { instrument: I.glass, gain: [0.2, 0.24], start: 0.14, seed: 513, mallet: 0 });
      return b;
    },
    room: { rt60: 0.6, wet: 0.12 },
    master: { loudness: MOMENT - 1, highpass: 200 }
  },

  'us-feed': {
    use: 'Us two: feeding them - spoon on the bowl, "aah", a chomp at 0.56 s, a "nom" with each chew',
    dry: () => {
      const b = silence(1.9);
      strike(b, { note: hz('A6'), instrument: I.bell, gain: 0.3, mallet: 0.5, decayScale: 0.25, seed: 521 });
      // "Aah", mouth wide for it.
      voice(b, {
        start: 0.24,
        dur: 0.26,
        freq: t => 380 * (1 + 0.15 * (t / 0.26)),
        amp: t => 0.22 * Math.max(0, Math.sin((Math.PI * t) / 0.26)) ** 0.7,
        harmonics: [1, 0.5, 0.3, 0.15]
      });
      thump(b, 0.56, 0.7, 170, 522);
      mode(b, { start: 0.56, freq: 1250, amp: 0.25, decay: 0.012 });
      [0.624, 0.928, 1.232].forEach((t, i) => {
        voice(b, {
          start: t,
          dur: 0.15,
          freq: u => (300 - i * 12) * (1 - 0.14 * (u / 0.15)),
          amp: u => 0.42 * Math.max(0, Math.sin((Math.PI * u) / 0.15)) ** 0.6,
          harmonics: [1, 0.75, 0.4, 0.22, 0.1],
          pan: (i - 1) * 0.15
        });
      });
      // Mm! - yummy.
      voice(b, {
        start: 1.44,
        dur: 0.24,
        freq: t => 330 * (1 + 0.32 * Math.min(1, t / 0.14)),
        amp: t => 0.3 * Math.max(0, Math.sin((Math.PI * t) / 0.24)) ** 0.7,
        harmonics: [1, 0.55, 0.3, 0.12]
      });
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: SOFT + 1, highpass: 150 }
  },

  'us-nuzzle': {
    use: 'Us two: a nose rub - a tiny squeak on each of five rubs, 0.216 s apart',
    dry: () => {
      const b = silence(1.4);
      [0, 0.216, 0.432, 0.648, 0.864].forEach((t, i) => {
        const f = hz(i % 2 ? 'D6' : 'F#6');
        voice(b, {
          start: t,
          dur: 0.085,
          freq: u => f * (1 + 0.14 * Math.sin((Math.PI * u) / 0.085)),
          amp: u => 0.3 * Math.max(0, Math.sin((Math.PI * u) / 0.085)) ** 0.7,
          harmonics: [1, 0.22, 0.06],
          pan: i % 2 ? 0.2 : -0.2
        });
        noise(b, { start: t, dur: 0.1, gain: 0.08, filter: { type: 'bandpass', f: 3000, q: 0.8 }, attack: 0.02, decay: 0.04, pink: true, seed: 531 + i });
      });
      strike(b, { note: hz('A6'), instrument: I.glass, start: 1.0, gain: 0.18, mallet: 0, seed: 537 });
      return b;
    },
    room: { rt60: 0.5, wet: 0.1 },
    master: { loudness: SOFT, highpass: 400 }
  },

  'us-flower': {
    use: 'Us two: a flower held out - a soft chime, a long sniff, a sparkle once it is theirs',
    dry: () => {
      const b = silence(1.8);
      run(b, ['D6', 'F#6', 'A6'], 0.07, { instrument: I.glass, gain: [0.28, 0.3, 0.34], seed: 541, mallet: 0.05 });
      [0.3, 0.46].forEach((t, i) =>
        noise(b, { start: t, dur: 0.12, gain: 0.32, filter: { type: 'bandpass', f: 2400, q: 0.9 }, sweepTo: 4200, attack: 0.05, decay: 0.04, pink: true, seed: 544 + i })
      );
      run(b, ['A6', 'D7'], 0.08, { instrument: I.glock, gain: [0.16, 0.2], start: 0.74, seed: 547, mallet: 0 });
      strike(b, { note: hz('D5'), instrument: I.felt, start: 0.74, gain: 0.2, mallet: 0, seed: 549 });
      return b;
    },
    room: { rt60: 1, wet: 0.16 },
    master: { loudness: SOFT, highpass: 200 }
  },

  'us-highfive': {
    use: 'Us two: a high five - smack! and a little cheer',
    dry: () => {
      const b = silence(1.1);
      noise(b, { dur: 0.05, gain: 1, filter: { type: 'bandpass', f: 2300, q: 0.8 }, attack: 0.0005, decay: 0.011, seed: 551 });
      noise(b, { dur: 0.03, gain: 0.5, filter: { type: 'highpass', f: 4000 }, attack: 0.0005, decay: 0.006, seed: 552 });
      thump(b, 0, 0.35, 220, 553);
      // "Yay!" - two voices rising.
      const yay = (start: number, note: string, pan: number) => {
        const f = hz(note);
        voice(b, {
          start,
          dur: 0.32,
          freq: u => f * (0.82 + 0.22 * Math.min(1, u / 0.12)),
          amp: u => 0.26 * Math.min(1, u / 0.03) * Math.exp(-u / 0.16),
          harmonics: [1, 0.45, 0.2, 0.08],
          pan
        });
      };
      yay(0.07, 'A5', -0.25);
      yay(0.09, 'D6', 0.25);
      run(b, ['D6', 'F#6', 'A6', 'D7'], 0.05, { instrument: I.glock, gain: [0.14, 0.16, 0.18, 0.22], start: 0.16, seed: 556, mallet: 0 });
      return b;
    },
    room: { rt60: 0.7, wet: 0.12 },
    master: { loudness: MOMENT, highpass: 150 }
  },

  'us-splash': {
    use: 'Us two: a water balloon bursting on a head - splash, bubbles, and a wet shake 0.49 s later',
    dry: () => {
      const b = silence(1.5);
      noise(b, { dur: 0.32, gain: 1, filter: { type: 'lowpass', f: 3200 }, grain: 0.6, attack: 0.002, decay: 0.09, pink: true, seed: 561 });
      noise(b, { start: 0.01, dur: 0.24, gain: 0.45, filter: { type: 'bandpass', f: 5200, q: 0.8 }, grain: 0.85, attack: 0.002, decay: 0.07, seed: 562 });
      thump(b, 0, 0.4, 130, 563);
      // Bloops of water.
      [0.04, 0.09, 0.15, 0.22].forEach((t, i) => {
        const f0 = 620 + i * 140;
        voice(b, { start: t, dur: 0.06, freq: u => f0 * (1 + 0.9 * (u / 0.06)), amp: u => 0.22 * Math.exp(-u / 0.025), harmonics: [1, 0.15] });
      });
      // Shaken off: a wet flutter, and drops flicked away.
      for (let i = 0; i < 11; i++) {
        noise(b, {
          start: 0.49 + i * 0.04,
          dur: 0.035,
          gain: 0.32 * (1 - i * 0.06),
          filter: { type: 'bandpass', f: 1700, q: 0.8 },
          grain: 0.5,
          attack: 0.002,
          decay: 0.012,
          pan: i % 2 ? 0.3 : -0.3,
          seed: 565 + i
        });
      }
      [0.62, 0.7, 0.8].forEach((t, i) => mode(b, { start: t, freq: 2100 + i * 260, amp: 0.16, decay: 0.03, glide: -0.2, glideTime: 0.02, pan: i % 2 ? 0.4 : -0.4 }));
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: MOMENT - 1, highpass: 120 }
  },

  'us-tease': {
    use: 'Us two: a raspberry - pbbbt - and the other one huffing "hmph" 0.6 s in',
    dry: () => {
      const b = silence(1);
      // Pbbbt: buzzing lips, fluttering about 30 times a second.
      voice(b, {
        start: 0,
        dur: 0.5,
        freq: t => 150 * (1 - 0.12 * (t / 0.5)),
        amp: t => 0.45 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 31 * t)) * Math.min(1, t / 0.02) * Math.min(1, (0.5 - t) / 0.06),
        harmonics: [1, 0.9, 0.8, 0.65, 0.5, 0.4, 0.3, 0.2]
      });
      noise(b, { dur: 0.5, gain: 0.22, filter: { type: 'lowpass', f: 1200 }, grain: 0.95, attack: 0.02, pink: true, seed: 581 });
      // Hmph!
      voice(b, {
        start: 0.6,
        dur: 0.18,
        freq: t => 240 * (1 - 0.25 * (t / 0.18)),
        amp: t => 0.4 * Math.max(0, Math.sin((Math.PI * t) / 0.18)) ** 0.6,
        harmonics: [1, 0.65, 0.35, 0.15]
      });
      noise(b, { start: 0.6, dur: 0.12, gain: 0.25, filter: { type: 'bandpass', f: 700, q: 0.8 }, attack: 0.005, decay: 0.04, pink: true, seed: 582 });
      return b;
    },
    room: { rt60: 0.3, wet: 0.06 },
    master: { loudness: SOFT + 1, highpass: 120 }
  },

  'us-dance': {
    use: 'Us two: dancing together - a bouncy little tune, six beats of 0.36 s',
    dry: () => {
      const b = silence(2.9);
      const beat = 0.36;
      ['D5', 'F#5', 'A5', 'F#5', 'B5', 'A5', 'F#5', 'E5', 'D5', 'E5', 'F#5', 'A5'].forEach((n, i) =>
        strike(b, { note: hz(n), instrument: I.marimba, start: (i * beat) / 2, gain: i % 2 ? 0.42 : 0.55, pan: i % 2 ? 0.12 : -0.12, seed: 591 + i, mallet: 0.2 })
      );
      strike(b, { note: hz('D6'), instrument: I.marimba, start: 6 * beat, gain: 0.6, seed: 605, decayScale: 1.4, mallet: 0.2 });
      strike(b, { note: hz('D7'), instrument: I.glock, start: 6 * beat, gain: 0.14, seed: 606, mallet: 0 });
      // A bounce under it on the beat, and a shaker between.
      ['D4', 'A3', 'D4', 'A3', 'B3', 'A3', 'D4'].forEach((n, i) => {
        strike(b, { note: hz(n), instrument: I.felt, start: i * beat, gain: 0.32, mallet: 0, seed: 610 + i, decayScale: 0.7 });
        if (i < 6) noise(b, { start: i * beat + beat / 2, dur: 0.05, gain: 0.12, filter: { type: 'bandpass', f: 6500, q: 1 }, attack: 0.004, decay: 0.015, seed: 620 + i });
      });
      return b;
    },
    room: { rt60: 0.8, wet: 0.14 },
    master: { loudness: SOFT + 1, highpass: 120, maxSeconds: 2.8, tailFade: 0.5 }
  },

  'us-tuck': {
    use: 'Us two: tucked in - a yawn, the blanket laid down 0.65 s in, a three-note lullaby',
    dry: () => {
      const b = silence(2.8);
      voice(b, {
        start: 0,
        dur: 0.6,
        freq: t => 460 * (1 - 0.42 * (t / 0.6)),
        amp: t => 0.26 * Math.max(0, Math.sin((Math.PI * t) / 0.6)) ** 0.7,
        harmonics: [1, 0.5, 0.25, 0.1]
      });
      noise(b, { dur: 0.6, gain: 0.12, filter: { type: 'bandpass', f: 1000, q: 0.7 }, attack: 0.12, decay: 0.25, pink: true, seed: 631 });
      // The blanket: a soft swoosh, settling.
      noise(b, { start: 0.45, dur: 0.32, gain: 0.45, filter: { type: 'bandpass', f: 700, q: 0.7 }, sweepTo: 260, attack: 0.1, decay: 0.12, pink: true, seed: 632 });
      thump(b, 0.65, 0.2, 120, 633);
      // Rock-a-bye: three notes down, and a shimmer.
      [
        { n: 'A5', t: 0.9 },
        { n: 'F#5', t: 1.25 },
        { n: 'D5', t: 1.6 }
      ].forEach(({ n, t }, i) =>
        strike(b, { note: hz(n), instrument: I.kalimba, start: t, gain: 0.5, decayScale: 1.4, mallet: 0.1, pan: (i - 1) * 0.15, seed: 634 + i })
      );
      strike(b, { note: hz('D6'), instrument: I.glass, start: 1.6, gain: 0.14, decayScale: 1.6, mallet: 0, seed: 638 });
      return b;
    },
    room: { rt60: 1.4, wet: 0.22 },
    master: { loudness: SOFT, highpass: 120, maxSeconds: 2.8, tailFade: 0.7 }
  },

  // A birthday surprise (components/SurpriseReveal) and the party in Us two.

  'birthday-song': {
    use: 'A birthday surprise: Happy Birthday as the cake comes in',
    dry: () => {
      const b = silence(14.5);
      birthdayTune(b, 0.5, 4);
      return b;
    },
    room: { rt60: 1.4, wet: 0.2 },
    master: { loudness: MOMENT, maxSeconds: 14.5, tailFade: 1.2 }
  },

  'birthday-jingle': {
    use: 'Us two on a birthday: the cake tapped - its first line',
    dry: () => {
      const b = silence(4.5);
      birthdayTune(b, 0.42, 1);
      return b;
    },
    room: { rt60: 1.2, wet: 0.18 },
    master: { loudness: SOFT, maxSeconds: 4.2, tailFade: 0.8 }
  },

  'party-pop': {
    use: 'A birthday surprise: candles out - a party popper and a sparkle',
    dry: () => {
      const b = silence(1.6);
      // The pop: a quick crack of air with a little body.
      noise(b, { dur: 0.05, gain: 1, filter: { type: 'bandpass', f: 1800, q: 0.7 }, attack: 0.0008, decay: 0.012, seed: 481 });
      mode(b, { freq: 330, amp: 0.4, decay: 0.04, glide: 0.6, glideTime: 0.01 });
      // Paper streamers fluttering down.
      noise(b, { start: 0.04, dur: 0.6, gain: 0.12, filter: { type: 'bandpass', f: 5200, q: 0.8 }, grain: 0.9, attack: 0.02, decay: 0.25, seed: 482 });
      // And a sparkle up the scale.
      run(b, ['D6', 'F#6', 'A6', 'D7'], 0.06, { instrument: I.glock, gain: [0.22, 0.24, 0.26, 0.3], start: 0.08, seed: 483, mallet: 0 });
      return b;
    },
    room: { rt60: 1, wet: 0.16 },
    master: { loudness: MOMENT, highpass: 150 }
  }
};
