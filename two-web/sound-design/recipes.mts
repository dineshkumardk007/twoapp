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

import { Stereo, silence, hz, strike, mode, noise, rng, INSTRUMENTS as I, RoomOptions, MasterOptions, SR } from './dsp.mts';

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
 * A little dance tune for Us two, in time with its moves (components/usMoves,
 * ROUTINES): six beats of 0.36 s. The melody in eighth notes (null a rest)
 * and a last chord on the seventh beat, over a soft bass on each beat - with
 * a kick, hi-hats or claps (at these seconds) if it wants them.
 */
function danceTune(
  b: Stereo,
  o: { melody: (string | null)[]; lead: typeof I.glass; bass: string[]; end: string[]; seed: number; kick?: boolean; hats?: 'off' | 'all'; claps?: number[] }
) {
  const beat = 0.36;
  o.melody.forEach((n, i) => {
    if (n) strike(b, { note: hz(n), instrument: o.lead, start: (i * beat) / 2, gain: i % 2 ? 0.42 : 0.55, pan: i % 2 ? 0.12 : -0.12, seed: o.seed + i, mallet: 0.2 });
  });
  o.end.forEach((n, i) => strike(b, { note: hz(n), instrument: o.lead, start: 6 * beat + i * 0.02, gain: 0.5, seed: o.seed + 20 + i, decayScale: 1.4, mallet: 0.2 }));
  strike(b, { note: hz(o.end[0]) * 2, instrument: I.glock, start: 6 * beat, gain: 0.12, seed: o.seed + 25, mallet: 0 });
  o.bass.forEach((n, i) => strike(b, { note: hz(n), instrument: I.felt, start: i * beat, gain: 0.32, mallet: 0, seed: o.seed + 30 + i, decayScale: 0.7 }));
  if (o.kick) for (let i = 0; i < 7; i++) thump(b, i * beat, 0.45, 110, o.seed + 40 + i);
  const hat = (t: number, i: number) =>
    noise(b, { start: t, dur: 0.05, gain: 0.12, filter: { type: 'bandpass', f: 6500, q: 1 }, attack: 0.004, decay: 0.015, seed: o.seed + 50 + i });
  if (o.hats === 'off') for (let i = 0; i < 6; i++) hat(i * beat + beat / 2, i);
  if (o.hats === 'all') for (let i = 0; i < 12; i++) hat((i * beat) / 2, i);
  (o.claps ?? []).forEach((t, i) => {
    noise(b, { start: t, dur: 0.05, gain: 0.55, filter: { type: 'bandpass', f: 2000, q: 0.8 }, attack: 0.0006, decay: 0.012, seed: o.seed + 70 + i });
    noise(b, { start: t + 0.012, dur: 0.04, gain: 0.35, filter: { type: 'bandpass', f: 2600, q: 0.9 }, attack: 0.0006, decay: 0.01, seed: o.seed + 75 + i });
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

// ------------------------------------------- a surprise opening, as a film
// (components/SurpriseReveal). Each cue is timed from the moment it is
// started on screen; the times here and the ones there go together.

/**
 * A soft string pad: a chord held, swelling in and dying away - sines with
 * their first overtones, each split a little so it breathes like a section
 * of strings rather than an organ.
 */
function pad(b: Stereo, notes: string[], start: number, dur: number, gain: number) {
  notes.forEach((n, i) => {
    const f = hz(n);
    const pan = (i / Math.max(1, notes.length - 1) - 0.5) * 0.6;
    ([[1, 1], [2, 0.26], [3, 0.07]] as const).forEach(([r, a], k) =>
      mode(b, { freq: f * r, amp: gain * a, decay: dur * 0.9, start, attack: Math.min(0.55, dur * 0.35), pan, beat: 0.45 + i * 0.13, phase: i + k })
    );
  });
}

/** A music box: a glockenspiel tine with a kalimba's pluck under it. */
function box(b: Stereo, note: string, start: number, gain: number, seed: number, long = false) {
  strike(b, { note: hz(note), instrument: I.glock, start, gain, pan: ((seed * 7) % 5) / 20 - 0.1, seed, mallet: 0.06, decayScale: long ? 1.2 : 0.75 });
  strike(b, { note: hz(note), instrument: I.kalimba, start, gain: gain * 0.45, seed: seed + 500, mallet: 0, decayScale: long ? 1.5 : 1 });
}

/** A chord on the felt piano, its notes rolled a few milliseconds apart. */
function roll(b: Stereo, notes: string[], start: number, gain: number, seed: number, decayScale = 1.2) {
  notes.forEach((n, i) => strike(b, { note: hz(n), instrument: I.felt, start: start + i * 0.022, gain, pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.4, mallet: 0, seed: seed + i, decayScale }));
}

/** Little lights: high notes scattered across a stretch of time. */
function twinkles(b: Stereo, from: number, to: number, count: number, gain: number, seed: number) {
  const rand = rng(seed);
  const notes = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7'];
  for (let i = 0; i < count; i++) {
    const t = from + ((to - from) * (i + rand() * 0.8)) / count;
    strike(b, {
      note: hz(notes[Math.floor(rand() * notes.length)]),
      instrument: rand() < 0.5 ? I.glock : I.glass,
      start: t,
      gain: gain * (0.55 + rand() * 0.45),
      pan: rand() * 1.4 - 0.7,
      seed: seed + i,
      mallet: 0,
      decayScale: 0.6
    });
  }
}

/** Paper: a sheet moving against another, or folded open. */
function paper(b: Stereo, start: number, dur: number, gain: number, from: number, to: number, seed: number, pan = 0) {
  noise(b, { start, dur, gain, filter: { type: 'bandpass', f: from, q: 0.9 }, sweepTo: to, grain: 0.6, attack: Math.min(0.06, dur / 3), pink: true, pan, seed });
}

/** The chords the waltz and the serenade stand on. */
const CHORD: Record<string, { bass: string; notes: string[] }> = {
  D: { bass: 'D3', notes: ['A3', 'D4', 'F#4'] },
  Bm: { bass: 'B2', notes: ['F#3', 'B3', 'D4'] },
  G: { bass: 'G2', notes: ['D3', 'G3', 'B3'] },
  A: { bass: 'A2', notes: ['E3', 'A3', 'C#4'] },
  Em: { bass: 'E3', notes: ['G3', 'B3', 'E4'] }
};

/**
 * A waltz of our own for the photos - sixteen bars of three, a music box
 * over a felt piano, the strings coming in for the second half.
 */
const WALTZ: [string, number][][] = [
  [['F#5', 2], ['E5', 1]],
  [['D5', 2], ['A4', 1]],
  [['B4', 1], ['D5', 1], ['F#5', 1]],
  [['E5', 3]],
  [['G5', 2], ['F#5', 1]],
  [['E5', 2], ['D5', 1]],
  [['C#5', 1], ['D5', 1], ['E5', 1]],
  [['A4', 3]],
  [['F#5', 2], ['E5', 1]],
  [['D5', 2], ['A4', 1]],
  [['B4', 1], ['D5', 1], ['G5', 1]],
  [['F#5', 2], ['E5', 1]],
  [['D5', 1], ['E5', 1], ['F#5', 1]],
  [['B5', 2], ['A5', 1]],
  [['G5', 1], ['F#5', 1], ['E5', 1]],
  [['D5', 3]]
];
const WALTZ_CHORDS = ['D', 'Bm', 'G', 'A', 'Em', 'G', 'A', 'D', 'D', 'Bm', 'G', 'D', 'Bm', 'G', 'A', 'D'];

function waltz(b: Stereo, start: number, beat: number, bars: number[], seed: number, strings: (bar: number) => number) {
  bars.forEach((bar, k) => {
    const t0 = start + k * 3 * beat;
    const chord = CHORD[WALTZ_CHORDS[bar]];
    strike(b, { note: hz(chord.bass), instrument: I.felt, start: t0, gain: 0.3, mallet: 0, seed: seed + k * 20, decayScale: 1.5 });
    roll(b, chord.notes, t0 + beat, 0.1, seed + k * 20 + 2, 0.8);
    roll(b, chord.notes, t0 + 2 * beat, 0.08, seed + k * 20 + 6, 0.8);
    const s = strings(bar);
    if (s > 0) pad(b, [chord.bass.replace(/\d$/, d => String(Number(d) + 1)), ...chord.notes], t0, 3 * beat + 0.2, s);
    let t = t0;
    WALTZ[bar].forEach(([note, beats], i) => {
      box(b, note, t, beats >= 2 ? 0.46 : 0.38, seed + k * 20 + 10 + i, beats >= 2);
      // The second time through, the piano sings the tune an octave down with it.
      if (bar >= 8) strike(b, { note: hz(note) / 2, instrument: I.felt, start: t, gain: 0.13, mallet: 0, seed: seed + k * 20 + 14 + i, decayScale: 1.1 });
      t += beats * beat;
    });
  });
}

/**
 * Happy Birthday (a folk tune, free to play) as a slow serenade: the felt
 * piano carrying the tune with a music box an octave above it, strings
 * under, a held note on "dear...", and slowing into the last line.
 * [beat, note, beats]; the pickups come before the first chord.
 */
const SERENADE: [number, string, number][] = [
  [0, 'A4', 0.75], [0.75, 'A4', 0.25], [1, 'B4', 1], [2, 'A4', 1], [3, 'D5', 1], [4, 'C#5', 2],
  [6, 'A4', 0.75], [6.75, 'A4', 0.25], [7, 'B4', 1], [8, 'A4', 1], [9, 'E5', 1], [10, 'D5', 2],
  [12, 'A4', 0.75], [12.75, 'A4', 0.25], [13, 'A5', 1], [14, 'F#5', 1], [15, 'D5', 1], [16, 'C#5', 1], [17, 'B4', 2.5],
  [19.5, 'G5', 0.75], [20.25, 'G5', 0.25], [21, 'F#5', 1], [22, 'D5', 1], [23, 'E5', 1], [24, 'D5', 3]
];
const SERENADE_CHORDS: [number, string, number][] = [
  [1, 'D', 3], [4, 'A', 3], [7, 'A', 3], [10, 'D', 3], [13, 'D', 3], [16, 'G', 5], [21, 'D', 2], [23, 'A', 1], [24, 'D', 4]
];
/** Seconds into the song at a beat: steady, then easing off for the last line. */
function serenadeTime(beat: number): number {
  const a = 0.56, b2 = 0.62, c = 0.68;
  if (beat <= 16) return 0.05 + beat * a;
  if (beat <= 24) return 0.05 + 16 * a + (beat - 16) * b2;
  return 0.05 + 16 * a + 8 * b2 + (beat - 24) * c;
}

/** A firework: up on a whistle, the burst, and its glitter crackling as it falls. */
function firework(b: Stereo, launch: number, burst: number, gain: number, seed: number) {
  const up = burst - launch;
  voice(b, {
    start: launch,
    dur: up,
    freq: t => 700 + 1900 * (t / up) ** 1.3,
    amp: t => gain * 0.07 * Math.max(0, Math.sin((Math.PI * t) / up)) ** 0.5,
    harmonics: [1, 0.15],
    pan: ((seed % 3) - 1) * 0.3
  });
  noise(b, { start: launch, dur: up, gain: gain * 0.08, filter: { type: 'bandpass', f: 2500, q: 0.8 }, sweepTo: 6000, attack: 0.1, seed });
  thump(b, burst, gain * 0.9, 90, seed + 1);
  noise(b, { start: burst, dur: 0.07, gain: gain * 0.7, filter: { type: 'bandpass', f: 1500, q: 0.5 }, attack: 0.0006, decay: 0.016, seed: seed + 2 });
  const rand = rng(seed + 3);
  for (let i = 0; i < 46; i++) {
    const t = burst + 0.12 + rand() ** 1.4 * 1.2;
    noise(b, { start: t, dur: 0.014, gain: gain * (0.06 + rand() * 0.2), filter: { type: 'bandpass', f: 3000 + rand() * 4500, q: 1.2 }, attack: 0.0004, decay: 0.003, pan: rand() * 1.6 - 0.8, seed: seed + 10 + i });
  }
  twinkles(b, burst + 0.05, burst + 0.9, 5, gain * 0.16, seed + 70);
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
    use: 'Us two: a water balloon bursting on a head - splash and bubbles (pitched up for each of a run)',
    dry: () => {
      const b = silence(0.8);
      noise(b, { dur: 0.32, gain: 1, filter: { type: 'lowpass', f: 3200 }, grain: 0.6, attack: 0.002, decay: 0.09, pink: true, seed: 561 });
      noise(b, { start: 0.01, dur: 0.24, gain: 0.45, filter: { type: 'bandpass', f: 5200, q: 0.8 }, grain: 0.85, attack: 0.002, decay: 0.07, seed: 562 });
      thump(b, 0, 0.4, 130, 563);
      // Bloops of water.
      [0.04, 0.09, 0.15, 0.22].forEach((t, i) => {
        const f0 = 620 + i * 140;
        voice(b, { start: t, dur: 0.06, freq: u => f0 * (1 + 0.9 * (u / 0.06)), amp: u => 0.22 * Math.exp(-u / 0.025), harmonics: [1, 0.15] });
      });
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: MOMENT - 1, highpass: 120 }
  },

  'us-shake': {
    use: 'Us two: shaking off the water after the last balloon of a run - a wet flutter, drops flicked away',
    dry: () => {
      const b = silence(0.8);
      for (let i = 0; i < 11; i++) {
        noise(b, {
          start: i * 0.04,
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
      [0.13, 0.21, 0.31].forEach((t, i) => mode(b, { start: t, freq: 2100 + i * 260, amp: 0.16, decay: 0.03, glide: -0.2, glideTime: 0.02, pan: i % 2 ? 0.4 : -0.4 }));
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: SOFT, highpass: 300 }
  },

  'us-drip': {
    use: 'Us two: soaked through - drip... drip... off them',
    dry: () => {
      const b = silence(1.6);
      [
        { t: 0, f: 1000 },
        { t: 0.34, f: 820 },
        { t: 0.7, f: 1150 },
        { t: 1.02, f: 900 }
      ].forEach(({ t, f }, i) => {
        voice(b, { start: t, dur: 0.05, freq: u => f * (1 + 0.7 * (u / 0.05)), amp: u => 0.3 * Math.exp(-u / 0.018), harmonics: [1, 0.12], pan: i % 2 ? 0.25 : -0.25 });
        noise(b, { start: t + 0.01, dur: 0.04, gain: 0.08, filter: { type: 'bandpass', f: 3800, q: 1 }, attack: 0.002, decay: 0.01, seed: 591 + i });
      });
      return b;
    },
    room: { rt60: 0.9, wet: 0.2 },
    master: { loudness: MICRO, highpass: 400 }
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

  // The other dances, one tune each (us-dance is the bop).

  'us-dance-2': {
    use: 'Us two: the twist - a rock-and-roll kalimba line, claps on the off beats',
    dry: () => {
      const b = silence(2.9);
      danceTune(b, {
        melody: ['A4', 'D5', 'F#5', 'A5', 'B5', 'A5', 'F#5', 'D5', 'E5', 'F#5', 'E5', 'D5'],
        lead: I.kalimba,
        bass: ['D4', 'A3', 'D4', 'A3', 'D4', 'A3', 'D4'],
        end: ['D5', 'A5'],
        claps: [0.36, 1.08, 1.8],
        hats: 'off',
        seed: 700
      });
      return b;
    },
    room: { rt60: 0.8, wet: 0.14 },
    master: { loudness: SOFT + 1, highpass: 120, maxSeconds: 2.8, tailFade: 0.5 }
  },

  'us-dance-3': {
    use: 'Us two: the spin - a run up and round on the marimba, twice, and a ta-da',
    dry: () => {
      const b = silence(2.9);
      danceTune(b, {
        melody: ['D5', 'F#5', 'A5', 'D6', 'A5', 'F#5', 'A5', 'F#5', 'D5', 'F#5', 'A5', 'D6'],
        lead: I.marimba,
        bass: ['D4', 'D4', 'A3', 'A3', 'D4', 'D4', 'D4'],
        end: ['D6', 'F#6'],
        hats: 'all',
        seed: 730
      });
      return b;
    },
    room: { rt60: 0.8, wet: 0.14 },
    master: { loudness: SOFT + 1, highpass: 120, maxSeconds: 2.8, tailFade: 0.5 }
  },

  'us-dance-4': {
    use: 'Us two: jump and clap - a bouncy tune, a clap at the top of each jump',
    dry: () => {
      const b = silence(2.9);
      danceTune(b, {
        melody: ['F#5', 'A5', 'B5', 'A5', 'F#5', 'A5', 'B5', 'D6', 'B5', 'A5', 'F#5', 'A5'],
        lead: I.marimba,
        bass: ['D4', 'A3', 'B3', 'A3', 'D4', 'A3', 'D4'],
        end: ['D6'],
        claps: [0.36, 1.08, 1.8],
        seed: 760
      });
      return b;
    },
    room: { rt60: 0.8, wet: 0.14 },
    master: { loudness: SOFT + 1, highpass: 120, maxSeconds: 2.8, tailFade: 0.5 }
  },

  'us-dance-5': {
    use: 'Us two: disco - four on the floor, hi-hats between, a syncopated line',
    dry: () => {
      const b = silence(2.9);
      danceTune(b, {
        melody: ['D6', null, 'A5', 'B5', null, 'A5', 'F#5', null, 'D6', null, 'B5', 'A5'],
        lead: I.marimba,
        bass: ['D4', 'D4', 'B3', 'B3', 'A3', 'A3', 'D4'],
        end: ['D6', 'A5'],
        kick: true,
        hats: 'off',
        seed: 790
      });
      return b;
    },
    room: { rt60: 0.8, wet: 0.14 },
    master: { loudness: SOFT + 1, highpass: 110, maxSeconds: 2.8, tailFade: 0.5 }
  },

  'us-dance-6': {
    use: 'Us two: the side shuffle - a skipping kalimba tune over a shaker',
    dry: () => {
      const b = silence(2.9);
      danceTune(b, {
        melody: ['D5', 'D5', 'F#5', 'A5', 'B5', 'B5', 'A5', 'F#5', 'E5', 'E5', 'F#5', 'D5'],
        lead: I.kalimba,
        bass: ['D4', 'A3', 'D4', 'A3', 'B3', 'A3', 'D4'],
        end: ['D5', 'F#5'],
        hats: 'all',
        seed: 820
      });
      return b;
    },
    room: { rt60: 0.8, wet: 0.14 },
    master: { loudness: SOFT + 1, highpass: 120, maxSeconds: 2.8, tailFade: 0.5 }
  },

  'us-tuck': {
    use: 'Us two: tucked into bed - poof, a yawn, a boing on the mattress, the sheet swung over and settling, two pats, a lullaby with soft snores, and poof',
    dry: () => {
      const b = silence(4.9);
      // Poof: the bed.
      const poof = (t: number, seed: number) => {
        noise(b, { start: t, dur: 0.18, gain: 0.55, filter: { type: 'bandpass', f: 1000, q: 0.7 }, attack: 0.004, decay: 0.05, pink: true, seed });
        thump(b, t, 0.25, 150, seed + 1);
        strike(b, { note: hz('A6'), instrument: I.glock, start: t + 0.05, gain: 0.12, mallet: 0, seed: seed + 2 });
      };
      poof(0, 641);
      // A big yawn and a stretch.
      voice(b, {
        start: 0.15,
        dur: 0.55,
        freq: t => 460 * (1 - 0.42 * (t / 0.55)),
        amp: t => 0.26 * Math.max(0, Math.sin((Math.PI * t) / 0.55)) ** 0.7,
        harmonics: [1, 0.5, 0.25, 0.1]
      });
      noise(b, { start: 0.15, dur: 0.55, gain: 0.12, filter: { type: 'bandpass', f: 1000, q: 0.7 }, attack: 0.12, decay: 0.22, pink: true, seed: 645 });
      // Up onto the bed - boing on the mattress, its springs creaking.
      mode(b, { start: 0.68, freq: 520, amp: 0.4, decay: 0.025, glide: -0.25, glideTime: 0.02 });
      boing(b, 0.95, hz('D4'), 0.45);
      mode(b, { start: 0.97, freq: 1300, amp: 0.1, decay: 0.08, glide: -0.1, glideTime: 0.05 });
      // The sheet: flapping as it is swung over, settling with a soft whump.
      for (let i = 0; i < 6; i++) {
        noise(b, { start: 1.1 + i * 0.065, dur: 0.05, gain: 0.3 * (1 - i * 0.08), filter: { type: 'bandpass', f: 900 + i * 90, q: 0.8 }, grain: 0.6, attack: 0.004, decay: 0.02, pink: true, seed: 650 + i });
      }
      noise(b, { start: 1.1, dur: 0.38, gain: 0.25, filter: { type: 'bandpass', f: 500, q: 0.7 }, sweepTo: 1500, attack: 0.1, decay: 0.15, pink: true, seed: 657 });
      noise(b, { start: 1.5, dur: 0.3, gain: 0.42, filter: { type: 'lowpass', f: 700 }, attack: 0.01, decay: 0.12, pink: true, seed: 658 });
      thump(b, 1.5, 0.2, 120, 659);
      // Two pats, tucking it in.
      [1.8, 2.05].forEach((t, i) => {
        thump(b, t, 0.38, 170, 661 + i);
        noise(b, { start: t, dur: 0.05, gain: 0.22, filter: { type: 'lowpass', f: 900 }, attack: 0.002, decay: 0.02, pink: true, seed: 663 + i });
      });
      // Rock-a-bye on a music box, and a shimmer.
      ['A5', 'F#5', 'D5', 'E5', 'F#5', 'D5'].forEach((n, i) =>
        strike(b, { note: hz(n), instrument: I.kalimba, start: 2.25 + i * 0.32, gain: 0.45, decayScale: 1.4, mallet: 0.1, pan: (i % 3 - 1) * 0.15, seed: 670 + i })
      );
      strike(b, { note: hz('D6'), instrument: I.glass, start: 3.85, gain: 0.14, decayScale: 1.6, mallet: 0, seed: 677 });
      // Soft little snores.
      [2.9, 3.6].forEach((t, i) => {
        voice(b, {
          start: t,
          dur: 0.5,
          freq: u => 120 * (1 - 0.15 * (u / 0.5)),
          amp: u => 0.12 * Math.max(0, Math.sin((Math.PI * u) / 0.5)) ** 0.8,
          harmonics: [1, 0.8, 0.6, 0.4]
        });
        noise(b, { start: t, dur: 0.5, gain: 0.06, filter: { type: 'lowpass', f: 600 }, attack: 0.15, decay: 0.2, pink: true, seed: 680 + i });
      });
      // Awake - poof, the bed's gone - and a happy "mmh!" of a stretch.
      poof(4.25, 690);
      voice(b, {
        start: 4.35,
        dur: 0.35,
        freq: t => 300 * (1 + 0.6 * Math.min(1, t / 0.25)),
        amp: t => 0.25 * Math.max(0, Math.sin((Math.PI * t) / 0.35)) ** 0.7,
        harmonics: [1, 0.5, 0.25, 0.1]
      });
      return b;
    },
    room: { rt60: 1.2, wet: 0.2 },
    master: { loudness: SOFT, highpass: 120, maxSeconds: 4.85, tailFade: 0.4 }
  },

  // A birthday surprise (components/SurpriseReveal) and the party in Us two.

  'birthday-song': {
    use: 'A birthday surprise: Happy Birthday, a slow serenade, once the candles are lit',
    dry: () => {
      const b = silence(19);
      SERENADE.forEach(([at, note, beats], i) => {
        const t = serenadeTime(at);
        const gain = beats < 1 ? 0.42 : beats >= 2 ? 0.66 : 0.56;
        strike(b, { note: hz(note), instrument: I.felt, start: t, gain, pan: i % 2 ? 0.06 : -0.06, mallet: 0.05, seed: 600 + i, decayScale: beats >= 2 ? 2 : 1.3 });
        // The music box an octave up, on the notes that land.
        if (beats >= 1) box(b, note.replace(/\d$/, d => String(Number(d) + 1)), t, 0.09, 640 + i, beats >= 2);
      });
      SERENADE_CHORDS.forEach(([at, name, beats], i) => {
        const t = serenadeTime(at);
        const len = serenadeTime(at + beats) - t;
        const chord = CHORD[name];
        strike(b, { note: hz(chord.bass), instrument: I.felt, start: t, gain: 0.3, mallet: 0, seed: 700 + i * 10, decayScale: 1.6 });
        // The chord broken across the bar, then held by the strings.
        for (let k = 1; k < Math.min(3, beats); k++) roll(b, chord.notes, serenadeTime(at + k), 0.085, 702 + i * 10 + k * 3, 0.9);
        pad(b, [chord.bass.replace(/\d$/, d => String(Number(d) + 1)), ...chord.notes], t, len + 0.3, i >= 5 ? 0.06 : 0.045);
      });
      // The last chord, and the music box climbing away above it.
      run(b, ['D6', 'F#6', 'A6', 'D7'], 0.11, { instrument: I.glock, gain: [0.1, 0.11, 0.12, 0.14], start: serenadeTime(24.6), seed: 780, mallet: 0 });
      return b;
    },
    room: { rt60: 1.9, wet: 0.26 },
    master: { loudness: MOMENT, highpass: 80, maxSeconds: 19, tailFade: 2 }
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
  },

  'sr-open': {
    use: 'A surprise: the bow untied, the lid lifted, light pouring out and settling into a heart of stars, the title written',
    dry: () => {
      const b = silence(7.4);
      // The ribbon drawn off - two silky pulls - and the bow letting go.
      paper(b, 0, 0.42, 0.3, 1800, 5200, 801, -0.2);
      paper(b, 0.16, 0.4, 0.24, 2200, 6000, 802, 0.2);
      strike(b, { note: hz('A5'), instrument: I.kalimba, start: 0.04, gain: 0.22, seed: 803, mallet: 0.1 });
      // The lid lifting off.
      thump(b, 0.6, 0.2, 190, 804);
      mode(b, { freq: 420, amp: 0.08, decay: 0.05, start: 0.6 });
      // Light pouring out of the box and rising.
      air(b, { start: 0.65, dur: 1.9, gain: 0.22, from: 600, to: 7000, attack: 0.5, seed: 805 });
      run(b, ['D5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6'], 0.09, { instrument: I.glass, gain: [0.16, 0.18, 0.2, 0.22, 0.24, 0.26, 0.28, 0.3], start: 0.7, seed: 806, mallet: 0, decayScale: 1.2 });
      // The sparks flying up into the sky...
      twinkles(b, 1.05, 2.6, 18, 0.16, 820);
      // ...and settling into the heart: a warm chord, blooming.
      roll(b, ['D3', 'A3', 'D4', 'F#4', 'A4'], 2.7, 0.26, 850, 2);
      strike(b, { note: hz('D5'), instrument: I.bowl, start: 2.7, gain: 0.14, seed: 856, mallet: 0 });
      strike(b, { note: hz('A5'), instrument: I.glass, start: 2.72, gain: 0.22, seed: 857, mallet: 0, decayScale: 1.6 });
      pad(b, ['D4', 'A4', 'D5', 'F#5'], 2.7, 4.2, 0.05);
      // The title, written one letter at a time: a harp-like run.
      ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6'].forEach((n, i) => {
        strike(b, { note: hz(n), instrument: I.kalimba, start: 3.3 + i * 0.17, gain: 0.16 + i * 0.012, pan: (i / 7 - 0.5) * 0.6, seed: 860 + i, mallet: 0.05, decayScale: 1.4 });
        strike(b, { note: hz(n) * 2, instrument: I.glock, start: 3.3 + i * 0.17, gain: 0.03, seed: 870 + i, mallet: 0 });
      });
      strike(b, { note: hz('A6'), instrument: I.glass, start: 4.85, gain: 0.16, seed: 880, mallet: 0, decayScale: 1.8 });
      return b;
    },
    room: { rt60: 2, wet: 0.26 },
    master: { loudness: MOMENT, highpass: 80, maxSeconds: 7.4, tailFade: 1.6 }
  },

  'sr-memories': {
    use: 'A surprise: a waltz under the photos',
    dry: () => {
      const b = silence(28);
      waltz(b, 0.05, 0.5, Array.from({ length: 16 }, (_, i) => i), 900, bar => (bar < 4 ? 0 : bar < 8 ? 0.03 : 0.05));
      // A last shimmer as it closes.
      run(b, ['A6', 'D7'], 0.12, { instrument: I.glock, gain: [0.08, 0.1], start: 0.05 + 15 * 1.5 + 0.6, seed: 1300, mallet: 0 });
      return b;
    },
    room: { rt60: 1.9, wet: 0.24 },
    master: { loudness: MOMENT - 1, highpass: 80, maxSeconds: 28, tailFade: 2.5 }
  },

  'sr-candles': {
    use: 'A surprise: the candles lit one after another, a match struck for the first',
    dry: () => {
      const b = silence(3.4);
      // The match: a scratch, then its flare.
      noise(b, { dur: 0.14, gain: 0.5, filter: { type: 'bandpass', f: 2800, q: 0.9 }, grain: 0.85, attack: 0.002, decay: 0.05, seed: 1401 });
      noise(b, { start: 0.08, dur: 0.5, gain: 0.32, filter: { type: 'lowpass', f: 700, q: 0.7 }, sweepTo: 2600, attack: 0.03, decay: 0.18, pink: true, seed: 1402 });
      ['D6', 'E6', 'F#6', 'A6', 'B6'].forEach((n, i) => {
        const t = i * 0.45;
        // Each wick catching, and a little light ringing out with it.
        noise(b, { start: t + 0.05, dur: 0.3, gain: 0.16, filter: { type: 'bandpass', f: 1200, q: 0.8 }, sweepTo: 2400, attack: 0.02, decay: 0.1, pink: true, pan: (i - 2) * 0.15, seed: 1410 + i });
        strike(b, { note: hz(n), instrument: I.glock, start: t + 0.08, gain: 0.13, pan: (i - 2) * 0.15, seed: 1420 + i, mallet: 0 });
      });
      strike(b, { note: hz('D6'), instrument: I.glass, start: 2.15, gain: 0.1, seed: 1430, mallet: 0, decayScale: 1.6 });
      strike(b, { note: hz('A6'), instrument: I.glass, start: 2.17, gain: 0.08, seed: 1431, mallet: 0, decayScale: 1.6 });
      return b;
    },
    room: { rt60: 1.2, wet: 0.2 },
    master: { loudness: SOFT, maxSeconds: 3.4, tailFade: 0.8 }
  },

  'sr-puff': {
    use: 'A surprise: a candle blown out',
    dry: () => {
      const b = silence(0.6);
      noise(b, { dur: 0.3, gain: 0.6, filter: { type: 'lowpass', f: 900, q: 0.7 }, attack: 0.02, decay: 0.09, pink: true, seed: 1501 });
      noise(b, { start: 0.05, dur: 0.22, gain: 0.05, filter: { type: 'bandpass', f: 4500, q: 1 }, grain: 0.9, attack: 0.01, decay: 0.06, seed: 1502 });
      return b;
    },
    room: { rt60: 0.6, wet: 0.1 },
    master: { loudness: SOFT - 1, highpass: 200 }
  },

  'sr-fireworks': {
    use: 'A surprise: candles out - a hush, then fireworks over the two of them',
    dry: () => {
      const b = silence(6.2);
      firework(b, 1.1, 1.7, 1, 1600);
      firework(b, 2.1, 2.6, 0.8, 1700);
      firework(b, 2.6, 3.2, 0.9, 1800);
      // With the first burst the lights come back up: a warm swell.
      pad(b, ['D4', 'A4', 'E5', 'F#5'], 1.7, 3.4, 0.05);
      run(b, ['D6', 'F#6', 'A6', 'D7'], 0.07, { instrument: I.glock, gain: [0.12, 0.14, 0.16, 0.18], start: 1.75, seed: 1900, mallet: 0 });
      return b;
    },
    room: { rt60: 1.6, wet: 0.2 },
    master: { loudness: MOMENT, highpass: 120, maxSeconds: 6.2, tailFade: 1.4 }
  },

  'sr-envelope': {
    use: 'A surprise: a letter drifting down, landing with a chime',
    dry: () => {
      const b = silence(2.6);
      [0.1, 0.36, 0.6, 0.84, 1.05, 1.24].forEach((t, i) =>
        noise(b, { start: t, dur: 0.13, gain: 0.12 + (i % 2) * 0.05, filter: { type: 'bandpass', f: 1800 + i * 140, q: 0.9 }, grain: 0.6, attack: 0.03, decay: 0.05, pink: true, pan: i % 2 ? 0.25 : -0.25, seed: 2001 + i })
      );
      air(b, { start: 0, dur: 1.3, gain: 0.06, from: 1200, to: 3200, attack: 0.3, seed: 2010 });
      strike(b, { note: hz('D6'), instrument: I.glass, start: 1.5, gain: 0.3, seed: 2011, mallet: 0.1 });
      strike(b, { note: hz('A6'), instrument: I.glass, start: 1.58, gain: 0.2, seed: 2012, mallet: 0.1 });
      strike(b, { note: hz('D4'), instrument: I.felt, start: 1.5, gain: 0.12, seed: 2013, mallet: 0 });
      return b;
    },
    room: { rt60: 1.4, wet: 0.2 },
    master: { loudness: SOFT, maxSeconds: 2.6, tailFade: 0.6 }
  },

  'sr-seal': {
    use: 'A surprise: the wax seal broken, the envelope opened, the letter drawn out and unfolded',
    dry: () => {
      const b = silence(3);
      // The wax giving: two small cracks.
      noise(b, { dur: 0.03, gain: 0.7, filter: { type: 'bandpass', f: 2200, q: 1.2 }, attack: 0.0005, decay: 0.006, seed: 2101 });
      mode(b, { freq: 1400, amp: 0.22, decay: 0.015 });
      noise(b, { start: 0.045, dur: 0.025, gain: 0.4, filter: { type: 'bandpass', f: 2700, q: 1.2 }, attack: 0.0005, decay: 0.005, seed: 2102 });
      // The flap folding back, the letter sliding out, and opened.
      paper(b, 0.28, 0.35, 0.22, 2400, 1600, 2103, -0.15);
      paper(b, 0.75, 0.65, 0.2, 1500, 3200, 2104, 0.1);
      [1.5, 1.72, 1.95].forEach((t, i) =>
        noise(b, { start: t, dur: 0.09, gain: 0.25 - i * 0.03, filter: { type: 'bandpass', f: 3000 - i * 250, q: 0.9 }, grain: 0.8, attack: 0.004, decay: 0.03, pan: (i - 1) * 0.3, seed: 2110 + i })
      );
      strike(b, { note: hz('F#6'), instrument: I.glass, start: 2.15, gain: 0.18, seed: 2120, mallet: 0 });
      strike(b, { note: hz('D6'), instrument: I.glass, start: 2.2, gain: 0.18, seed: 2121, mallet: 0 });
      strike(b, { note: hz('D4'), instrument: I.felt, start: 2.15, gain: 0.1, seed: 2122, mallet: 0 });
      return b;
    },
    room: { rt60: 1.2, wet: 0.16 },
    master: { loudness: SOFT, maxSeconds: 3, tailFade: 0.6 }
  },

  'sr-finale': {
    use: 'A surprise: the end - the two of them under the moon, a shooting star, the waltz once more',
    dry: () => {
      const b = silence(10.5);
      waltz(b, 0.3, 0.6, [12, 13, 14, 15], 2200, () => 0.05);
      // A shooting star across the sky.
      air(b, { start: 1.8, dur: 0.9, gain: 0.1, from: 3000, to: 9000, attack: 0.2, seed: 2300 });
      run(b, ['A6', 'B6', 'D7', 'E7', 'F#7'], 0.05, { instrument: I.glass, gain: 0.07, start: 1.9, seed: 2301, mallet: 0 });
      strike(b, { note: hz('D5'), instrument: I.bell, start: 0.3 + 9 * 0.6, gain: 0.14, seed: 2310, mallet: 0 });
      return b;
    },
    room: { rt60: 2.1, wet: 0.28 },
    master: { loudness: MOMENT - 1, highpass: 80, maxSeconds: 10.5, tailFade: 2.5 }
  },

  // ------------------------------------------- games on Canvas of Us
  // (components/PaperGames). Each game has sounds of its own; winning,
  // losing, a tie and a new game are shared.

  'g-pen': {
    use: 'Tic-tac-toe: a mark drawn in felt-tip',
    dry: () => {
      const b = silence(0.42);
      // Two quick strokes of a felt pen on paper, the second a touch higher.
      noise(b, { dur: 0.12, gain: 0.7, filter: { type: 'bandpass', f: 2600, q: 0.9 }, sweepTo: 3300, grain: 0.6, attack: 0.008, decay: 0.05, pan: -0.1, seed: 3001 });
      noise(b, { start: 0.14, dur: 0.12, gain: 0.6, filter: { type: 'bandpass', f: 3100, q: 0.9 }, sweepTo: 2500, grain: 0.6, attack: 0.008, decay: 0.05, pan: 0.1, seed: 3002 });
      mode(b, { freq: 520, amp: 0.08, decay: 0.02 });
      return b;
    },
    room: { rt60: 0.4, wet: 0.06 },
    master: { loudness: SOFT, highpass: 400 }
  },

  'g-chalk': {
    use: 'Dots and Boxes: a line drawn between two dots',
    dry: () => {
      const b = silence(0.3);
      noise(b, { dur: 0.17, gain: 0.8, filter: { type: 'bandpass', f: 3800, q: 1 }, sweepTo: 2600, grain: 0.85, attack: 0.006, decay: 0.07, seed: 3011 });
      mode(b, { freq: 1400, amp: 0.06, decay: 0.012 });
      return b;
    },
    room: { rt60: 0.4, wet: 0.06 },
    master: { loudness: SOFT - 1, highpass: 500 }
  },

  'g-box': {
    use: 'Dots and Boxes: a box claimed - a pop and two notes up',
    dry: () => {
      const b = silence(0.9);
      noise(b, { dur: 0.04, gain: 0.6, filter: { type: 'lowpass', f: 1800, q: 0.7 }, attack: 0.001, decay: 0.012, seed: 3021 });
      mode(b, { freq: 620, amp: 0.3, decay: 0.05, glide: -0.4, glideTime: 0.03 });
      run(b, ['A5', 'D6'], 0.08, { instrument: I.glock, gain: [0.32, 0.4], start: 0.04, seed: 3022, mallet: 0.05 });
      return b;
    },
    room: { rt60: 0.9, wet: 0.14 },
    master: { loudness: SOFT + 1 }
  },

  'g-drop': {
    use: 'Four in a Row: a disc falling into the frame and landing with a clack',
    dry: () => {
      const b = silence(0.45);
      air(b, { start: 0, dur: 0.1, gain: 0.12, from: 700, to: 2200, attack: 0.03, seed: 3031 });
      // The landing: plastic on plastic, then a smaller bounce.
      for (const [t, g] of [[0.1, 1], [0.19, 0.4]] as const) {
        mode(b, { freq: 1150, amp: 0.5 * g, decay: 0.028, start: t });
        mode(b, { freq: 2350, amp: 0.25 * g, decay: 0.016, start: t });
        mode(b, { freq: 420, amp: 0.3 * g, decay: 0.03, start: t });
        noise(b, { start: t, dur: 0.02, gain: 0.35 * g, filter: { type: 'bandpass', f: 3200, q: 1 }, attack: 0.0005, decay: 0.005, seed: 3032 + Math.round(t * 100) });
      }
      return b;
    },
    room: { rt60: 0.5, wet: 0.08 },
    master: { loudness: SOFT + 1, highpass: 200 }
  },

  'g-flip': {
    use: 'Memory Match: a card turned over',
    dry: () => {
      const b = silence(0.25);
      noise(b, { dur: 0.07, gain: 0.7, filter: { type: 'bandpass', f: 2200, q: 0.8 }, sweepTo: 4200, grain: 0.5, attack: 0.004, decay: 0.025, seed: 3041 });
      mode(b, { freq: 230, amp: 0.35, decay: 0.03, start: 0.05 });
      mode(b, { freq: 690, amp: 0.12, decay: 0.02, start: 0.05 });
      return b;
    },
    room: { rt60: 0.4, wet: 0.06 },
    master: { loudness: SOFT, highpass: 150 }
  },

  'g-match': {
    use: 'Memory Match: a pair found - a sparkling chime',
    dry: () => {
      const b = silence(1.2);
      run(b, ['D6', 'F#6', 'A6', 'D7'], 0.055, { instrument: I.glass, gain: [0.3, 0.32, 0.34, 0.38], seed: 3051, mallet: 0.1, decayScale: 1.2 });
      twinkles(b, 0.2, 0.7, 5, 0.12, 3055);
      return b;
    },
    room: { rt60: 1.2, wet: 0.2 },
    master: { loudness: MOMENT - 1 }
  },

  'g-miss': {
    use: 'Memory Match: not a pair - two soft notes down',
    dry: () => {
      const b = silence(0.8);
      strike(b, { note: hz('A4'), instrument: I.marimba, gain: 0.55, seed: 3061, mallet: 0.2 });
      strike(b, { note: hz('F#4'), instrument: I.marimba, start: 0.16, gain: 0.5, seed: 3062, mallet: 0.2 });
      strike(b, { note: hz('F#3'), instrument: I.felt, start: 0.16, gain: 0.18, seed: 3063, mallet: 0 });
      return b;
    },
    room: { rt60: 0.8, wet: 0.12 },
    master: { loudness: SOFT }
  },

  'g-pick': {
    use: 'Heart Hug Kiss: your choice locked in',
    dry: () => {
      const b = silence(0.45);
      mode(b, { freq: 1600, amp: 0.3, decay: 0.012 });
      mode(b, { freq: 800, amp: 0.2, decay: 0.02 });
      strike(b, { note: hz('D6'), instrument: I.kalimba, start: 0.03, gain: 0.3, seed: 3071, mallet: 0.1 });
      return b;
    },
    room: { rt60: 0.6, wet: 0.1 },
    master: { loudness: SOFT }
  },

  'g-reveal': {
    use: 'Heart Hug Kiss: both have chosen - a quick drum roll, and the reveal',
    dry: () => {
      const b = silence(1.3);
      // A soft roll on a snare, getting a little louder.
      for (let i = 0; i < 16; i++) {
        noise(b, { start: i * 0.032, dur: 0.03, gain: 0.18 + i * 0.016, filter: { type: 'bandpass', f: 2400, q: 0.6 }, attack: 0.001, decay: 0.01, pan: i % 2 ? 0.15 : -0.15, seed: 3080 + i });
      }
      // ...and the reveal: a strike, and two bright notes.
      thump(b, 0.55, 0.5, 130, 3099);
      roll(b, ['D4', 'A4', 'D5', 'F#5'], 0.55, 0.22, 3100, 1.4);
      run(b, ['A5', 'D6'], 0.07, { instrument: I.glock, gain: [0.22, 0.3], start: 0.58, seed: 3105, mallet: 0 });
      return b;
    },
    room: { rt60: 1, wet: 0.16 },
    master: { loudness: MOMENT - 1 }
  },

  'g-point': {
    use: 'Heart Hug Kiss: a round won - a bright ding',
    dry: () => {
      const b = silence(0.9);
      strike(b, { note: hz('D6'), instrument: I.glock, gain: 0.5, seed: 3111, mallet: 0.1 });
      strike(b, { note: hz('A6'), instrument: I.glass, start: 0.06, gain: 0.32, seed: 3112, mallet: 0 });
      return b;
    },
    room: { rt60: 1, wet: 0.16 },
    master: { loudness: SOFT + 1 }
  },

  'g-dice': {
    use: 'Snakes & Ladders: the die shaken and rolled across the table',
    dry: () => {
      const b = silence(0.75);
      const rand = rng(3121);
      // Clicks closer together and quieter as it slows, then the last settle.
      let t = 0;
      for (let i = 0; i < 9; i++) {
        const g = 0.55 - i * 0.04;
        mode(b, { freq: 1800 + rand() * 2200, amp: g * 0.5, decay: 0.012, start: t, pan: rand() * 0.6 - 0.3 });
        noise(b, { start: t, dur: 0.018, gain: g * 0.6, filter: { type: 'bandpass', f: 3000 + rand() * 2000, q: 1.2 }, attack: 0.0005, decay: 0.004, seed: 3122 + i });
        t += 0.085 - i * 0.004;
      }
      mode(b, { freq: 950, amp: 0.3, decay: 0.03, start: t + 0.02 });
      noise(b, { start: t + 0.02, dur: 0.03, gain: 0.3, filter: { type: 'bandpass', f: 1800, q: 0.9 }, attack: 0.001, decay: 0.008, seed: 3140 });
      return b;
    },
    room: { rt60: 0.5, wet: 0.08 },
    master: { loudness: SOFT + 1, highpass: 300 }
  },

  'g-hop': {
    use: 'Snakes & Ladders: the counter hopping one square',
    dry: () => {
      const b = silence(0.2);
      strike(b, { note: hz('A5'), instrument: I.marimba, gain: 0.5, seed: 3151, mallet: 0.35, decayScale: 0.5 });
      mode(b, { freq: 1800, amp: 0.12, decay: 0.01 });
      return b;
    },
    room: { rt60: 0.4, wet: 0.06 },
    master: { loudness: SOFT - 2 }
  },

  'g-ladder': {
    use: 'Snakes & Ladders: climbing a ladder - up the scale',
    dry: () => {
      const b = silence(1.1);
      run(b, ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6'], 0.065, { instrument: I.marimba, gain: [0.4, 0.42, 0.44, 0.46, 0.48, 0.5, 0.52], seed: 3161, mallet: 0.25 });
      strike(b, { note: hz('A6'), instrument: I.glock, start: 0.46, gain: 0.3, seed: 3170, mallet: 0 });
      return b;
    },
    room: { rt60: 0.9, wet: 0.14 },
    master: { loudness: MOMENT - 1 }
  },

  'g-snake': {
    use: 'Snakes & Ladders: down a snake - a slide whistle and a hiss',
    dry: () => {
      const b = silence(1.1);
      voice(b, {
        start: 0,
        dur: 0.75,
        freq: t => (1300 * Math.exp(-t * 2.1) + 260) * (1 + 0.03 * Math.sin(2 * Math.PI * 7 * t)),
        amp: t => 0.28 * Math.min(1, t / 0.03) * Math.max(0, 1 - t / 0.75) ** 0.5,
        harmonics: [1, 0.2, 0.06]
      });
      noise(b, { start: 0.02, dur: 0.6, gain: 0.08, filter: { type: 'bandpass', f: 5200, q: 1.1 }, attack: 0.05, decay: 0.25, seed: 3181 });
      thump(b, 0.78, 0.3, 140, 3182);
      return b;
    },
    room: { rt60: 0.7, wet: 0.1 },
    master: { loudness: MOMENT - 1, highpass: 150 }
  },

  // ---- Water Balloon War: rubber, air and a lot of water.

  'g-wb-stretch': {
    use: 'Water Balloon War: the balloon pulled back - a rubbery creak',
    dry: () => {
      const b = silence(0.3);
      voice(b, {
        start: 0,
        dur: 0.22,
        freq: t => 340 + 520 * (t / 0.22) ** 0.7 + 26 * Math.sin(2 * Math.PI * 38 * t),
        amp: t => 0.2 * Math.min(1, t / 0.02) * Math.max(0, 1 - t / 0.22) ** 0.4,
        harmonics: [1, 0.5, 0.3, 0.12]
      });
      noise(b, { dur: 0.16, gain: 0.08, filter: { type: 'bandpass', f: 1500, q: 2 }, sweepTo: 2600, grain: 0.7, attack: 0.01, decay: 0.08, seed: 3401 });
      return b;
    },
    room: { rt60: 0.3, wet: 0.05 },
    master: { loudness: MICRO, highpass: 250 }
  },

  'g-wb-throw': {
    use: 'Water Balloon War: thrown - a whoosh with the water wobbling inside',
    dry: () => {
      const b = silence(0.55);
      air(b, { start: 0, dur: 0.34, gain: 0.5, from: 480, to: 2100, attack: 0.04, seed: 3411 });
      // The water sloshing inside as it leaves your hand.
      [0.02, 0.09, 0.16].forEach((t, i) => {
        const f0 = 300 + i * 70;
        voice(b, { start: t, dur: 0.07, freq: u => f0 * (1 + 0.8 * (u / 0.07)), amp: u => 0.14 * Math.exp(-u / 0.03), harmonics: [1, 0.2] });
      });
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: SOFT, highpass: 200 }
  },

  'g-wb-burst': {
    use: 'Water Balloon War: a hit - the skin snaps and the water lets go',
    dry: () => {
      const b = silence(1.05);
      const rand = rng(3421);
      // The snap of the rubber, right at the front.
      noise(b, { dur: 0.018, gain: 1, filter: { type: 'bandpass', f: 2400, q: 0.6 }, attack: 0.0004, decay: 0.005, seed: 3422 });
      mode(b, { freq: 1180, amp: 0.34, decay: 0.012 });
      thump(b, 0.004, 0.55, 118, 3423);
      // The sheet of water, and a brighter hiss on top.
      noise(b, { start: 0.008, dur: 0.46, gain: 0.95, filter: { type: 'lowpass', f: 3000 }, grain: 0.55, attack: 0.003, decay: 0.13, pink: true, seed: 3424 });
      noise(b, { start: 0.012, dur: 0.3, gain: 0.42, filter: { type: 'bandpass', f: 5600, q: 0.8 }, grain: 0.85, attack: 0.002, decay: 0.08, seed: 3425 });
      // Bloops.
      for (let i = 0; i < 7; i++) {
        const t = 0.03 + i * 0.045 + rand() * 0.02;
        const f0 = 520 + rand() * 620;
        voice(b, { start: t, dur: 0.065, freq: u => f0 * (1 + 0.95 * (u / 0.065)), amp: u => (0.25 - i * 0.02) * Math.exp(-u / 0.024), harmonics: [1, 0.14], pan: rand() * 0.8 - 0.4 });
      }
      // And it patters back down.
      for (let i = 0; i < 14; i++) {
        noise(b, { start: 0.32 + rand() * 0.55, dur: 0.018, gain: 0.05 + rand() * 0.12, filter: { type: 'bandpass', f: 2600 + rand() * 3400, q: 1.1 }, attack: 0.0005, decay: 0.004, pan: rand() * 1.2 - 0.6, seed: 3430 + i });
      }
      return b;
    },
    room: { rt60: 0.45, wet: 0.09 },
    master: { loudness: MOMENT, highpass: 110, maxSeconds: 1.05, tailFade: 0.25 }
  },

  'g-wb-giant': {
    use: 'Water Balloon War: the giant balloon - a deep sploosh and a flood',
    dry: () => {
      const b = silence(1.9);
      const rand = rng(3451);
      noise(b, { dur: 0.03, gain: 1, filter: { type: 'bandpass', f: 1500, q: 0.5 }, attack: 0.0005, decay: 0.009, seed: 3452 });
      thump(b, 0, 1, 74, 3453);
      thump(b, 0.05, 0.6, 104, 3454);
      noise(b, { start: 0.012, dur: 0.95, gain: 1, filter: { type: 'lowpass', f: 2400 }, grain: 0.42, attack: 0.006, decay: 0.3, pink: true, seed: 3455 });
      noise(b, { start: 0.03, dur: 0.6, gain: 0.5, filter: { type: 'bandpass', f: 4600, q: 0.7 }, grain: 0.8, attack: 0.004, decay: 0.17, seed: 3456 });
      for (let i = 0; i < 12; i++) {
        const t = 0.05 + i * 0.058 + rand() * 0.025;
        const f0 = 260 + rand() * 520;
        voice(b, { start: t, dur: 0.11, freq: u => f0 * (1 + 1.05 * (u / 0.11)), amp: u => 0.3 * Math.exp(-u / 0.04), harmonics: [1, 0.18], pan: rand() * 1.1 - 0.55 });
      }
      for (let i = 0; i < 34; i++) {
        noise(b, { start: 0.55 + rand() ** 1.2 * 1.1, dur: 0.02, gain: 0.04 + rand() * 0.14, filter: { type: 'bandpass', f: 2200 + rand() * 3600, q: 1.1 }, attack: 0.0005, decay: 0.005, pan: rand() * 1.4 - 0.7, seed: 3470 + i });
      }
      return b;
    },
    room: { rt60: 0.6, wet: 0.12 },
    master: { loudness: MOMENT + 1, highpass: 90, maxSeconds: 1.9, tailFade: 0.45 }
  },

  'g-wb-splat': {
    use: 'Water Balloon War: a miss - slapped on the grass',
    dry: () => {
      const b = silence(0.6);
      const rand = rng(3511);
      noise(b, { dur: 0.012, gain: 0.7, filter: { type: 'bandpass', f: 1600, q: 0.6 }, attack: 0.0004, decay: 0.004, seed: 3512 });
      thump(b, 0, 0.32, 150, 3513);
      noise(b, { start: 0.006, dur: 0.2, gain: 0.8, filter: { type: 'lowpass', f: 1900 }, grain: 0.55, attack: 0.002, decay: 0.05, pink: true, seed: 3514 });
      [0.03, 0.08].forEach((t, i) => {
        const f0 = 460 + i * 160;
        voice(b, { start: t, dur: 0.05, freq: u => f0 * (1 + 0.8 * (u / 0.05)), amp: u => 0.18 * Math.exp(-u / 0.018), harmonics: [1, 0.12] });
      });
      for (let i = 0; i < 6; i++) {
        noise(b, { start: 0.14 + rand() * 0.28, dur: 0.014, gain: 0.05 + rand() * 0.08, filter: { type: 'bandpass', f: 2800 + rand() * 2200, q: 1.2 }, attack: 0.0005, decay: 0.004, pan: rand() - 0.5, seed: 3520 + i });
      }
      return b;
    },
    room: { rt60: 0.35, wet: 0.06 },
    master: { loudness: SOFT + 1, highpass: 130 }
  },

  'g-wb-hedge': {
    use: 'Water Balloon War: into the hedge - leaves and a wet splat',
    dry: () => {
      const b = silence(0.7);
      const rand = rng(3531);
      noise(b, { dur: 0.1, gain: 0.55, filter: { type: 'lowpass', f: 1700 }, grain: 0.6, attack: 0.002, decay: 0.03, pink: true, seed: 3532 });
      thump(b, 0, 0.2, 170, 3533);
      // The leaves shaking after it.
      for (let i = 0; i < 12; i++) {
        noise(b, { start: 0.04 + i * 0.03 + rand() * 0.012, dur: 0.035, gain: 0.3 * (1 - i * 0.065), filter: { type: 'bandpass', f: 3400 + rand() * 2600, q: 1.4 }, grain: 0.9, attack: 0.002, decay: 0.01, pan: rand() * 0.9 - 0.45, seed: 3535 + i });
      }
      return b;
    },
    room: { rt60: 0.35, wet: 0.06 },
    master: { loudness: SOFT, highpass: 200 }
  },

  'g-wb-eek': {
    use: 'Water Balloon War: whoever got hit - a little squeak of surprise',
    dry: () => {
      const b = silence(0.42);
      voice(b, {
        start: 0,
        dur: 0.3,
        freq: t => {
          const p = t / 0.3;
          return (680 + 980 * Math.min(1, p * 2.6) - 260 * Math.max(0, p - 0.45)) * (1 + 0.035 * Math.sin(2 * Math.PI * 17 * t));
        },
        amp: t => 0.3 * Math.min(1, t / 0.018) * Math.max(0, 1 - t / 0.3) ** 0.55,
        harmonics: [1, 0.42, 0.2, 0.08]
      });
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: SOFT, highpass: 300 }
  },

  'g-wb-wind': {
    use: 'Water Balloon War: the wind changes - a soft gust',
    dry: () => {
      const b = silence(1);
      noise(b, { dur: 0.95, gain: 0.5, filter: { type: 'bandpass', f: 500, q: 0.9 }, sweepTo: 1300, attack: 0.3, decay: 0.32, pink: true, seed: 3551 });
      noise(b, { start: 0.14, dur: 0.6, gain: 0.14, filter: { type: 'bandpass', f: 2600, q: 1.2 }, sweepTo: 1700, attack: 0.2, decay: 0.2, seed: 3552 });
      return b;
    },
    room: { rt60: 0.5, wet: 0.08 },
    master: { loudness: MICRO, highpass: 180, tailFade: 0.2 }
  },

  // ---- Carrom: real wood, real coins. Short and dry, so a break of coins
  // clicking together stays crisp and never turns to mud.

  'g-cr-strike': {
    use: 'Carrom: the flick and the striker leaving the finger',
    dry: () => {
      const b = silence(0.22);
      // The fingernail.
      noise(b, { dur: 0.007, gain: 0.8, filter: { type: 'bandpass', f: 3900, q: 0.9 }, attack: 0.0003, decay: 0.002, seed: 3601 });
      // The striker's knock, a heavier coin than the others.
      mode(b, { freq: 1720, amp: 0.34, decay: 0.012, start: 0.002 });
      mode(b, { freq: 2960, amp: 0.2, decay: 0.008, start: 0.002 });
      mode(b, { freq: 640, amp: 0.3, decay: 0.022, start: 0.002 });
      mode(b, { freq: 250, amp: 0.3, decay: 0.03, start: 0.002 });
      air(b, { start: 0.008, dur: 0.1, gain: 0.08, from: 1400, to: 3000, attack: 0.01, seed: 3602 });
      return b;
    },
    room: { rt60: 0.3, wet: 0.05 },
    master: { loudness: SOFT + 2, highpass: 110 }
  },

  'g-cr-click': {
    use: 'Carrom: coin against coin - one hard little click (played at many pitches and levels)',
    dry: () => {
      const b = silence(0.1);
      mode(b, { freq: 2750, amp: 0.55, decay: 0.009 });
      mode(b, { freq: 4300, amp: 0.34, decay: 0.006 });
      mode(b, { freq: 6400, amp: 0.2, decay: 0.004 });
      mode(b, { freq: 1180, amp: 0.2, decay: 0.012 });
      noise(b, { dur: 0.005, gain: 0.5, filter: { type: 'bandpass', f: 5200, q: 0.8 }, attack: 0.0002, decay: 0.0015, seed: 3611 });
      return b;
    },
    room: { rt60: 0.22, wet: 0.04 },
    master: { loudness: SOFT, highpass: 500 }
  },

  'g-cr-wall': {
    use: 'Carrom: a coin off the wooden rim',
    dry: () => {
      const b = silence(0.2);
      mode(b, { freq: 212, amp: 0.55, decay: 0.038 });
      mode(b, { freq: 430, amp: 0.45, decay: 0.026 });
      mode(b, { freq: 810, amp: 0.26, decay: 0.016 });
      mode(b, { freq: 1520, amp: 0.1, decay: 0.008 });
      noise(b, { dur: 0.009, gain: 0.35, filter: { type: 'lowpass', f: 1900 }, attack: 0.0004, decay: 0.003, seed: 3621 });
      return b;
    },
    room: { rt60: 0.25, wet: 0.05 },
    master: { loudness: SOFT, highpass: 100 }
  },

  'g-cr-pocket': {
    use: 'Carrom: a coin dropping into the pocket and settling in the net',
    dry: () => {
      const b = silence(0.5);
      // Over the lip...
      mode(b, { freq: 1500, amp: 0.2, decay: 0.008 });
      // ...down into the net.
      mode(b, { freq: 300, amp: 0.55, decay: 0.05, start: 0.05, glide: -0.2, glideTime: 0.04 });
      mode(b, { freq: 620, amp: 0.3, decay: 0.03, start: 0.05 });
      noise(b, { start: 0.05, dur: 0.07, gain: 0.3, filter: { type: 'lowpass', f: 1300 }, attack: 0.002, decay: 0.02, pink: true, seed: 3631 });
      // A little rattle against whatever is in there already.
      [0.13, 0.19, 0.235].forEach((t, i) => {
        mode(b, { freq: 2300 + i * 310, amp: 0.13 - i * 0.03, decay: 0.008, start: t });
      });
      return b;
    },
    room: { rt60: 0.3, wet: 0.05 },
    master: { loudness: SOFT + 2, highpass: 120 }
  },

  'g-cr-queen': {
    use: 'Carrom: the queen in the pocket - a golden shimmer',
    dry: () => {
      const b = silence(1.4);
      mode(b, { freq: 300, amp: 0.5, decay: 0.05 });
      noise(b, { dur: 0.06, gain: 0.25, filter: { type: 'lowpass', f: 1300 }, attack: 0.002, decay: 0.02, pink: true, seed: 3641 });
      run(b, ['D6', 'F#6', 'A6', 'D7'], 0.07, { instrument: I.glass, gain: [0.34, 0.36, 0.38, 0.42], start: 0.05, seed: 3642, mallet: 0.1, decayScale: 1.3 });
      strike(b, { note: hz('D5'), instrument: I.glock, start: 0.05, gain: 0.3, seed: 3647, mallet: 0 });
      twinkles(b, 0.25, 1, 7, 0.13, 3648);
      return b;
    },
    room: { rt60: 1.2, wet: 0.2 },
    master: { loudness: MOMENT - 1, tailFade: 0.3 }
  },

  'g-cr-cover': {
    use: 'Carrom: the queen covered and won - a proud little fanfare',
    dry: () => {
      const b = silence(1.3);
      run(b, ['A5', 'D6', 'F#6'], 0.08, { instrument: I.kalimba, gain: [0.36, 0.4, 0.48], seed: 3661, mallet: 0.15, decayScale: 1.2 });
      roll(b, ['D5', 'A5', 'D6', 'A6'], 0.24, 0.26, 3665, 1.5);
      twinkles(b, 0.32, 1, 5, 0.1, 3670);
      return b;
    },
    room: { rt60: 1.1, wet: 0.18 },
    master: { loudness: MOMENT - 1, tailFade: 0.3 }
  },

  'g-cr-foul': {
    use: 'Carrom: the striker down the pocket - a heavy thunk and two notes down',
    dry: () => {
      const b = silence(1);
      mode(b, { freq: 190, amp: 0.65, decay: 0.07, glide: -0.25, glideTime: 0.05 });
      mode(b, { freq: 380, amp: 0.35, decay: 0.04 });
      noise(b, { dur: 0.08, gain: 0.32, filter: { type: 'lowpass', f: 1100 }, attack: 0.002, decay: 0.024, pink: true, seed: 3681 });
      strike(b, { note: hz('A3'), instrument: I.marimba, start: 0.14, gain: 0.5, seed: 3682, mallet: 0.2 });
      strike(b, { note: hz('E3'), instrument: I.marimba, start: 0.32, gain: 0.5, seed: 3683, mallet: 0.2 });
      return b;
    },
    room: { rt60: 0.6, wet: 0.1 },
    master: { loudness: SOFT + 2, highpass: 110 }
  },

  'g-cr-place': {
    use: 'Carrom: the striker slid along the line - the smallest wooden tick',
    dry: () => {
      const b = silence(0.06);
      mode(b, { freq: 1600, amp: 0.4, decay: 0.005 });
      mode(b, { freq: 3100, amp: 0.16, decay: 0.003 });
      noise(b, { dur: 0.004, gain: 0.2, filter: { type: 'bandpass', f: 4200, q: 1 }, attack: 0.0002, decay: 0.001, seed: 3691 });
      return b;
    },
    room: { rt60: 0.2, wet: 0.03 },
    master: { loudness: MICRO - 2, highpass: 700 }
  },

  'g-cr-back': {
    use: 'Carrom: a coin put back in the middle of the board',
    dry: () => {
      const b = silence(0.35);
      air(b, { start: 0, dur: 0.1, gain: 0.08, from: 2400, to: 1200, attack: 0.02, seed: 3695 });
      mode(b, { freq: 1500, amp: 0.45, decay: 0.012, start: 0.09 });
      mode(b, { freq: 720, amp: 0.3, decay: 0.022, start: 0.09 });
      mode(b, { freq: 1500, amp: 0.14, decay: 0.008, start: 0.145 });
      return b;
    },
    room: { rt60: 0.3, wet: 0.05 },
    master: { loudness: SOFT - 1, highpass: 200 }
  },

  'g-win': {
    use: 'Any game: you won - a short fanfare',
    dry: () => {
      const b = silence(2.2);
      run(b, ['D5', 'F#5', 'A5', 'D6'], 0.09, { instrument: I.kalimba, gain: [0.4, 0.44, 0.48, 0.55], seed: 3191, mallet: 0.15, decayScale: 1.3 });
      run(b, ['D6', 'F#6', 'A6', 'D7'], 0.09, { instrument: I.glock, gain: [0.1, 0.11, 0.12, 0.16], seed: 3195, mallet: 0 });
      roll(b, ['D4', 'A4', 'D5', 'F#5', 'A5'], 0.38, 0.24, 3200, 1.8);
      pad(b, ['D4', 'A4', 'F#5'], 0.38, 1.4, 0.05);
      twinkles(b, 0.5, 1.4, 7, 0.12, 3210);
      return b;
    },
    room: { rt60: 1.4, wet: 0.2 },
    master: { loudness: MOMENT, maxSeconds: 2.2, tailFade: 0.8 }
  },

  'g-lose': {
    use: "Any game: they won - a cute, not-too-sad 'aww'",
    dry: () => {
      const b = silence(1.5);
      // Two little sighs down, like a cartoon "aww".
      const sigh = (start: number, from: number, to: number, len: number, gain: number) =>
        voice(b, {
          start,
          dur: len,
          freq: t => (from + (to - from) * Math.min(1, t / (len * 0.8))) * (1 + 0.025 * Math.sin(2 * Math.PI * 6 * t)),
          amp: t => gain * Math.min(1, t / 0.04) * Math.max(0, 1 - t / len) ** 0.6,
          harmonics: [1, 0.35, 0.12, 0.05]
        });
      sigh(0, hz('A4'), hz('F#4'), 0.42, 0.22);
      sigh(0.45, hz('F#4'), hz('D4'), 0.7, 0.22);
      strike(b, { note: hz('D4'), instrument: I.felt, start: 0.45, gain: 0.16, seed: 3221, mallet: 0 });
      return b;
    },
    room: { rt60: 0.9, wet: 0.14 },
    master: { loudness: SOFT + 1, maxSeconds: 1.5, tailFade: 0.4 }
  },

  'g-tie': {
    use: 'Any game: a tie - two chimes, side by side',
    dry: () => {
      const b = silence(1.2);
      strike(b, { note: hz('A5'), instrument: I.glass, gain: 0.4, pan: -0.3, seed: 3231, mallet: 0.1 });
      strike(b, { note: hz('A5'), instrument: I.glass, start: 0.14, gain: 0.4, pan: 0.3, seed: 3232, mallet: 0.1 });
      strike(b, { note: hz('D5'), instrument: I.felt, start: 0.14, gain: 0.15, seed: 3233, mallet: 0 });
      return b;
    },
    room: { rt60: 1.1, wet: 0.18 },
    master: { loudness: SOFT + 1 }
  },

  'g-start': {
    use: 'Any game: a new game - cards shuffled and a bright ping',
    dry: () => {
      const b = silence(0.8);
      paper(b, 0, 0.28, 0.3, 1800, 4200, 3241, -0.2);
      paper(b, 0.12, 0.22, 0.24, 2200, 4600, 3242, 0.2);
      strike(b, { note: hz('A6'), instrument: I.glock, start: 0.3, gain: 0.3, seed: 3243, mallet: 0 });
      strike(b, { note: hz('D6'), instrument: I.kalimba, start: 0.3, gain: 0.25, seed: 3244, mallet: 0.1 });
      return b;
    },
    room: { rt60: 0.9, wet: 0.14 },
    master: { loudness: SOFT + 1 }
  },

  'g-turn': {
    use: 'Any game: they have moved, or chosen - a gentle nudge that it is you now',
    dry: () => {
      const b = silence(0.8);
      strike(b, { note: hz('F#5'), instrument: I.kalimba, gain: 0.4, seed: 3251, mallet: 0.1 });
      strike(b, { note: hz('B5'), instrument: I.kalimba, start: 0.11, gain: 0.45, seed: 3252, mallet: 0.1 });
      return b;
    },
    room: { rt60: 0.9, wet: 0.14 },
    master: { loudness: SOFT }
  },

  // ------------------------------------------------------------- Boxing

  'g-bx-bell': {
    use: 'Boxing: the ring bell - two bright strikes of a brass bell',
    dry: () => {
      const b = silence(1.9);
      const ding = (start: number, gain: number) => {
        // The hammer, then the bell: partials that are not quite in tune with each other, as brass is.
        noise(b, { start, dur: 0.006, gain: gain * 0.5, filter: { type: 'bandpass', f: 4200, q: 0.8 }, attack: 0.0003, decay: 0.002, seed: 3701 });
        ([[1, 0.5, 0.75], [2.41, 0.42, 0.55], [3.93, 0.26, 0.36], [5.34, 0.16, 0.24], [6.9, 0.09, 0.16]] as const).forEach(([r, a, d], k) => {
          mode(b, { freq: 1046 * r, amp: gain * a, decay: d, start, attack: 0.001, beat: 1.6 + k * 0.7, phase: k });
        });
      };
      ding(0, 1);
      ding(0.2, 0.92);
      return b;
    },
    room: { rt60: 1.3, wet: 0.2 },
    master: { loudness: MOMENT, maxSeconds: 1.9, tailFade: 0.6 }
  },

  'g-bx-pick': {
    use: 'Boxing: a move locked in - two gloves touched together',
    dry: () => {
      const b = silence(0.22);
      noise(b, { dur: 0.05, gain: 0.8, filter: { type: 'lowpass', f: 1500 }, attack: 0.001, decay: 0.014, pink: true, seed: 3711 });
      mode(b, { freq: 240, amp: 0.5, decay: 0.03, glide: 0.85, glideTime: 0.02 });
      mode(b, { freq: 480, amp: 0.3, decay: 0.022 });
      noise(b, { start: 0.002, dur: 0.012, gain: 0.25, filter: { type: 'bandpass', f: 2600, q: 1 }, attack: 0.0005, decay: 0.004, seed: 3712 });
      return b;
    },
    room: { rt60: 0.35, wet: 0.06 },
    master: { loudness: SOFT, highpass: 110 }
  },

  'g-bx-whoosh': {
    use: 'Boxing: a glove through the air, before it lands or misses (played at three pitches)',
    dry: () => {
      const b = silence(0.26);
      noise(b, { dur: 0.17, gain: 1, filter: { type: 'bandpass', f: 620, q: 1.1 }, sweepTo: 2900, attack: 0.05, decay: 0.05, pink: true, seed: 3721 });
      noise(b, { start: 0.03, dur: 0.12, gain: 0.35, filter: { type: 'bandpass', f: 2200, q: 0.8 }, sweepTo: 5200, attack: 0.04, decay: 0.035, seed: 3722 });
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: SOFT - 2, highpass: 300 }
  },

  'g-bx-jab': {
    use: 'Boxing: a jab landing - leather on the cheek, quick and sharp',
    dry: () => {
      const b = silence(0.3);
      // The slap of the leather, right at the front.
      noise(b, { dur: 0.014, gain: 1, filter: { type: 'bandpass', f: 2100, q: 0.7 }, attack: 0.0003, decay: 0.004, seed: 3731 });
      noise(b, { start: 0.001, dur: 0.06, gain: 0.7, filter: { type: 'lowpass', f: 2600 }, attack: 0.0006, decay: 0.016, pink: true, seed: 3732 });
      thump(b, 0.001, 0.62, 165, 3733);
      mode(b, { freq: 720, amp: 0.2, decay: 0.02, start: 0.001 });
      return b;
    },
    room: { rt60: 0.5, wet: 0.1 },
    master: { loudness: SOFT + 3, highpass: 100 }
  },

  'g-bx-hook': {
    use: 'Boxing: a hook landing - heavier, with the whole body behind it',
    dry: () => {
      const b = silence(0.45);
      noise(b, { dur: 0.016, gain: 1, filter: { type: 'bandpass', f: 1500, q: 0.7 }, attack: 0.0003, decay: 0.005, seed: 3741 });
      noise(b, { start: 0.001, dur: 0.11, gain: 0.85, filter: { type: 'lowpass', f: 1900 }, attack: 0.0006, decay: 0.03, pink: true, seed: 3742 });
      thump(b, 0.001, 0.95, 122, 3743);
      thump(b, 0.012, 0.4, 96, 3744);
      mode(b, { freq: 540, amp: 0.2, decay: 0.03, start: 0.001 });
      return b;
    },
    room: { rt60: 0.55, wet: 0.11 },
    master: { loudness: SOFT + 4, highpass: 90 }
  },

  'g-bx-upper': {
    use: 'Boxing: an uppercut landing - the biggest punch there is, a crack and a boom',
    dry: () => {
      const b = silence(0.75);
      // The crack...
      noise(b, { dur: 0.012, gain: 1, filter: { type: 'bandpass', f: 2900, q: 0.6 }, attack: 0.0002, decay: 0.004, seed: 3751 });
      mode(b, { freq: 1500, amp: 0.3, decay: 0.012 });
      // ...the boom under it...
      thump(b, 0.002, 1.1, 98, 3752);
      thump(b, 0.016, 0.6, 148, 3753);
      noise(b, { start: 0.002, dur: 0.2, gain: 0.9, filter: { type: 'lowpass', f: 1500 }, attack: 0.001, decay: 0.055, pink: true, seed: 3754 });
      // ...and the air it pushed, ringing off the hall.
      noise(b, { start: 0.03, dur: 0.4, gain: 0.22, filter: { type: 'bandpass', f: 900, q: 0.6 }, sweepTo: 420, attack: 0.02, decay: 0.14, pink: true, seed: 3755 });
      return b;
    },
    room: { rt60: 0.8, wet: 0.16 },
    master: { loudness: SOFT + 5, highpass: 80 }
  },

  'g-bx-block': {
    use: 'Boxing: a punch stopped on the gloves - a dull pat of leather on leather',
    dry: () => {
      const b = silence(0.26);
      noise(b, { dur: 0.07, gain: 1, filter: { type: 'lowpass', f: 1000 }, attack: 0.0008, decay: 0.02, pink: true, seed: 3761 });
      mode(b, { freq: 250, amp: 0.55, decay: 0.035, glide: 0.88, glideTime: 0.02 });
      mode(b, { freq: 510, amp: 0.25, decay: 0.024 });
      noise(b, { dur: 0.01, gain: 0.3, filter: { type: 'bandpass', f: 1700, q: 0.9 }, attack: 0.0005, decay: 0.003, seed: 3762 });
      return b;
    },
    room: { rt60: 0.45, wet: 0.08 },
    master: { loudness: SOFT + 1, highpass: 110 }
  },

  'g-bx-ko': {
    use: 'Boxing: the knockout - the punch that ends it, and the fall to the canvas',
    dry: () => {
      const b = silence(1.3);
      noise(b, { dur: 0.014, gain: 1, filter: { type: 'bandpass', f: 2600, q: 0.6 }, attack: 0.0002, decay: 0.004, seed: 3771 });
      thump(b, 0.002, 1.2, 88, 3772);
      thump(b, 0.018, 0.7, 132, 3773);
      noise(b, { start: 0.002, dur: 0.34, gain: 1, filter: { type: 'lowpass', f: 1300 }, attack: 0.001, decay: 0.1, pink: true, seed: 3774 });
      // Going down...
      voice(b, { start: 0.08, dur: 0.44, freq: t => 330 * Math.pow(0.34, t / 0.44), amp: t => 0.2 * Math.min(1, t / 0.03) * Math.max(0, 1 - t / 0.44), harmonics: [1, 0.4, 0.2, 0.08] });
      // ...and onto the canvas.
      thump(b, 0.56, 0.9, 104, 3775);
      noise(b, { start: 0.56, dur: 0.16, gain: 0.6, filter: { type: 'lowpass', f: 900 }, attack: 0.001, decay: 0.045, pink: true, seed: 3776 });
      thump(b, 0.7, 0.3, 120, 3777);
      return b;
    },
    room: { rt60: 1.0, wet: 0.18 },
    master: { loudness: MOMENT + 1, highpass: 80, maxSeconds: 1.3, tailFade: 0.3 }
  },

  'g-bx-crowd': {
    use: 'Boxing: the hall on its feet - a roar that swells and settles',
    dry: () => {
      const b = silence(2.4);
      const rand = rng(3781);
      // Many voices: bands of noise at the pitches a crowd shouts at, each swelling on its own.
      ([[480, 0.9, -0.5], [760, 1, 0.4], [1150, 0.8, -0.2], [1700, 0.5, 0.5], [2600, 0.28, 0]] as const).forEach(([f, g, pan], i) => {
        noise(b, { start: i * 0.03, dur: 2.2, gain: g, filter: { type: 'bandpass', f, q: 0.9 }, sweepTo: f * 1.18, attack: 0.3 + i * 0.05, decay: 0.75, pink: true, grain: 0.35, pan, seed: 3782 + i });
      });
      // A few whistles and whoops over the top.
      for (let i = 0; i < 6; i++) {
        const t = 0.3 + rand() * 1.2;
        const f0 = 1500 + rand() * 1300;
        voice(b, { start: t, dur: 0.22, freq: u => f0 * (1 + 0.35 * (u / 0.22)), amp: u => 0.05 * Math.sin((Math.PI * u) / 0.22), harmonics: [1, 0.2], pan: rand() * 1.6 - 0.8 });
      }
      return b;
    },
    room: { rt60: 1.6, wet: 0.3 },
    master: { loudness: MOMENT - 1, highpass: 200, maxSeconds: 2.4, tailFade: 0.9 }
  },

  // ---------------------------------------------------- Penalty Shootout

  'g-pk-whistle': {
    use: "Penalty Shootout: the referee's whistle - a pea whistle, short and sharp",
    dry: () => {
      const b = silence(0.5);
      // The pea rattles the note: fast flutter in both loudness and pitch.
      voice(b, {
        start: 0,
        dur: 0.34,
        freq: t => 2380 * (1 + 0.012 * Math.sin(2 * Math.PI * 42 * t)) * (t < 0.03 ? 0.94 + (0.06 * t) / 0.03 : 1),
        amp: t => 0.5 * Math.min(1, t / 0.012) * Math.min(1, (0.34 - t) / 0.04) * (0.72 + 0.28 * Math.sin(2 * Math.PI * 42 * t)),
        harmonics: [1, 0.22, 0.1, 0.04]
      });
      voice(b, { start: 0, dur: 0.34, freq: () => 2520, amp: t => 0.16 * Math.min(1, t / 0.012) * Math.min(1, (0.34 - t) / 0.04), harmonics: [1, 0.15] });
      noise(b, { dur: 0.34, gain: 0.18, filter: { type: 'bandpass', f: 2600, q: 2 }, attack: 0.01, decay: 0.1, seed: 3801 });
      return b;
    },
    room: { rt60: 1.2, wet: 0.22 },
    master: { loudness: SOFT + 2, highpass: 700 }
  },

  'g-pk-pick': {
    use: 'Penalty Shootout: your choice locked in - a stud pressed into the turf',
    dry: () => {
      const b = silence(0.24);
      noise(b, { dur: 0.05, gain: 0.8, filter: { type: 'lowpass', f: 1200 }, attack: 0.001, decay: 0.014, pink: true, seed: 3811 });
      mode(b, { freq: 210, amp: 0.5, decay: 0.03, glide: 0.86, glideTime: 0.02 });
      noise(b, { start: 0.004, dur: 0.05, gain: 0.3, filter: { type: 'bandpass', f: 3600, q: 0.8 }, grain: 0.8, attack: 0.002, decay: 0.015, seed: 3812 });
      strike(b, { note: hz('A5'), instrument: I.kalimba, start: 0.02, gain: 0.16, seed: 3813, mallet: 0.1 });
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: SOFT, highpass: 110 }
  },

  'g-pk-kick': {
    use: 'Penalty Shootout: boot through the ball',
    dry: () => {
      const b = silence(0.5);
      // Leather on leather, and the air inside the ball answering.
      noise(b, { dur: 0.012, gain: 1, filter: { type: 'bandpass', f: 1300, q: 0.7 }, attack: 0.0003, decay: 0.004, seed: 3821 });
      thump(b, 0.001, 1, 142, 3822);
      mode(b, { freq: 420, amp: 0.4, decay: 0.045, start: 0.002, glide: 0.8, glideTime: 0.03 });
      mode(b, { freq: 840, amp: 0.18, decay: 0.03, start: 0.002 });
      noise(b, { start: 0.002, dur: 0.09, gain: 0.6, filter: { type: 'lowpass', f: 1700 }, attack: 0.001, decay: 0.024, pink: true, seed: 3823 });
      // And away it goes.
      noise(b, { start: 0.03, dur: 0.24, gain: 0.3, filter: { type: 'bandpass', f: 700, q: 1 }, sweepTo: 2300, attack: 0.03, decay: 0.08, pink: true, seed: 3824 });
      return b;
    },
    room: { rt60: 0.7, wet: 0.14 },
    master: { loudness: SOFT + 4, highpass: 90 }
  },

  'g-pk-goal': {
    use: 'Penalty Shootout: a goal - the ball in the net, and the whole ground with it',
    dry: () => {
      const b = silence(2.6);
      const rand = rng(3831);
      // The net taking it.
      noise(b, { dur: 0.3, gain: 0.8, filter: { type: 'bandpass', f: 4200, q: 0.8 }, sweepTo: 1500, grain: 0.75, attack: 0.004, decay: 0.09, seed: 3832 });
      thump(b, 0.01, 0.4, 130, 3833);
      // The ground going up.
      ([[520, 0.95, -0.5], [820, 1, 0.4], [1250, 0.8, -0.15], [1900, 0.5, 0.5], [2900, 0.26, 0]] as const).forEach(([f, g, pan], i) => {
        noise(b, { start: 0.06 + i * 0.02, dur: 2.3, gain: g, filter: { type: 'bandpass', f, q: 0.9 }, sweepTo: f * 1.25, attack: 0.16 + i * 0.04, decay: 0.8, pink: true, grain: 0.35, pan, seed: 3834 + i });
      });
      for (let i = 0; i < 7; i++) {
        const t = 0.25 + rand() * 1.2;
        const f0 = 1500 + rand() * 1400;
        voice(b, { start: t, dur: 0.24, freq: u => f0 * (1 + 0.4 * (u / 0.24)), amp: u => 0.05 * Math.sin((Math.PI * u) / 0.24), harmonics: [1, 0.2], pan: rand() * 1.6 - 0.8 });
      }
      // A bright little flourish over it.
      run(b, ['D5', 'A5', 'D6', 'F#6'], 0.07, { instrument: I.kalimba, gain: [0.2, 0.22, 0.25, 0.28], start: 0.1, seed: 3845, mallet: 0.12 });
      run(b, ['D6', 'A6', 'D7'], 0.07, { instrument: I.glock, gain: 0.08, start: 0.17, seed: 3850, mallet: 0 });
      return b;
    },
    room: { rt60: 1.6, wet: 0.28 },
    master: { loudness: MOMENT, highpass: 160, maxSeconds: 2.6, tailFade: 1 }
  },

  'g-pk-save': {
    use: 'Penalty Shootout: saved - both gloves on the ball, and the ground gasps',
    dry: () => {
      const b = silence(1.3);
      // Two gloves, almost together.
      thump(b, 0, 0.9, 168, 3861);
      thump(b, 0.022, 0.7, 150, 3862);
      noise(b, { dur: 0.08, gain: 0.85, filter: { type: 'lowpass', f: 1500 }, attack: 0.0008, decay: 0.022, pink: true, seed: 3863 });
      noise(b, { dur: 0.012, gain: 0.5, filter: { type: 'bandpass', f: 1900, q: 0.8 }, attack: 0.0004, decay: 0.004, seed: 3864 });
      // "Ohh!"
      ([[430, 1, -0.4], [700, 0.9, 0.4], [1050, 0.5, 0]] as const).forEach(([f, g, pan], i) => {
        noise(b, { start: 0.08, dur: 1, gain: g * 0.7, filter: { type: 'bandpass', f, q: 1.2 }, sweepTo: f * 0.72, attack: 0.06, decay: 0.3, pink: true, grain: 0.3, pan, seed: 3865 + i });
      });
      return b;
    },
    room: { rt60: 1.3, wet: 0.24 },
    master: { loudness: MOMENT - 1, highpass: 110, maxSeconds: 1.3, tailFade: 0.5 }
  },

  'g-pk-post': {
    use: 'Penalty Shootout: off the post - the frame rings',
    dry: () => {
      const b = silence(1.2);
      noise(b, { dur: 0.008, gain: 1, filter: { type: 'bandpass', f: 3200, q: 0.7 }, attack: 0.0002, decay: 0.003, seed: 3871 });
      thump(b, 0.001, 0.5, 150, 3872);
      // A hollow steel tube: partials far apart, the low one the longest.
      ([[1, 0.6, 0.42], [2.76, 0.45, 0.3], [5.4, 0.28, 0.18], [8.93, 0.14, 0.1]] as const).forEach(([r, a, d], k) => {
        mode(b, { freq: 560 * r, amp: a, decay: d, start: 0.001, attack: 0.0006, beat: 2.2 + k, phase: k });
      });
      // A gasp.
      noise(b, { start: 0.1, dur: 0.7, gain: 0.4, filter: { type: 'bandpass', f: 800, q: 1 }, sweepTo: 560, attack: 0.07, decay: 0.22, pink: true, grain: 0.3, seed: 3875 });
      return b;
    },
    room: { rt60: 1.2, wet: 0.22 },
    master: { loudness: MOMENT - 1, highpass: 130, maxSeconds: 1.2, tailFade: 0.4 }
  },

  'g-pk-miss': {
    use: 'Penalty Shootout: over the bar, or wide - the ground groans',
    dry: () => {
      const b = silence(1.3);
      ([[520, 1, -0.4], [800, 0.9, 0.4], [1200, 0.45, 0]] as const).forEach(([f, g, pan], i) => {
        noise(b, { start: i * 0.02, dur: 1.1, gain: g, filter: { type: 'bandpass', f, q: 1.2 }, sweepTo: f * 0.6, attack: 0.09, decay: 0.33, pink: true, grain: 0.3, pan, seed: 3881 + i });
      });
      voice(b, { start: 0.05, dur: 0.6, freq: t => hz('A3') * Math.pow(0.82, t / 0.6), amp: t => 0.08 * Math.min(1, t / 0.08) * Math.max(0, 1 - t / 0.6), harmonics: [1, 0.4, 0.15] });
      return b;
    },
    room: { rt60: 1.3, wet: 0.24 },
    master: { loudness: SOFT + 2, highpass: 150, maxSeconds: 1.3, tailFade: 0.5 }
  },

  // -------------------------------------------------------- Puzzle Duel

  'g-pz-go': {
    use: 'Puzzle Duel: the clock is about to start - three quick rising notes',
    dry: () => {
      const b = silence(0.8);
      run(b, ['D5', 'A5', 'D6'], 0.085, { instrument: I.kalimba, gain: [0.34, 0.38, 0.46], seed: 3901, mallet: 0.12 });
      strike(b, { note: hz('D7'), instrument: I.glock, start: 0.17, gain: 0.12, seed: 3905, mallet: 0 });
      return b;
    },
    room: { rt60: 0.8, wet: 0.14 },
    master: { loudness: SOFT + 1 }
  },

  'g-pz-tap': {
    use: 'Puzzle Duel: a right tap - one small glass tick (played higher as you go)',
    dry: () => {
      const b = silence(0.3);
      strike(b, { note: hz('A5'), instrument: I.glock, gain: 0.5, seed: 3911, mallet: 0.05, decayScale: 0.35 });
      noise(b, { dur: 0.006, gain: 0.2, filter: { type: 'bandpass', f: 3600, q: 1 }, attack: 0.0003, decay: 0.002, seed: 3912 });
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: MICRO + 2, highpass: 300 }
  },

  'g-pz-wrong': {
    use: 'Puzzle Duel: a wrong tap - a soft double buzz, not unkind',
    dry: () => {
      const b = silence(0.45);
      const buzz = (start: number, f: number) =>
        voice(b, { start, dur: 0.11, freq: () => f, amp: t => 0.3 * Math.min(1, t / 0.006) * Math.min(1, (0.11 - t) / 0.03), harmonics: [1, 0, 0.42, 0, 0.2, 0, 0.1] });
      buzz(0, hz('F#3'));
      buzz(0.13, hz('D3'));
      thump(b, 0, 0.3, 150, 3921);
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: SOFT, highpass: 120 }
  },

  'g-pz-done': {
    use: 'Puzzle Duel: solved - the clock stops with a bright run upward',
    dry: () => {
      const b = silence(1.3);
      run(b, ['F#5', 'A5', 'D6', 'F#6'], 0.06, { instrument: I.glass, gain: [0.3, 0.33, 0.38, 0.44], seed: 3931, mallet: 0.1 });
      strike(b, { note: hz('D5'), instrument: I.felt, start: 0.18, gain: 0.2, seed: 3936, mallet: 0 });
      twinkles(b, 0.25, 0.8, 4, 0.1, 3940);
      return b;
    },
    room: { rt60: 1.0, wet: 0.18 },
    master: { loudness: SOFT + 2, maxSeconds: 1.3, tailFade: 0.5 }
  },

  'g-pz-pad': {
    use: 'Puzzle Duel: one of the four lights (played at four pitches)',
    dry: () => {
      const b = silence(0.6);
      strike(b, { note: hz('D5'), instrument: I.glass, gain: 0.45, seed: 3951, mallet: 0.08, decayScale: 0.6 });
      strike(b, { note: hz('D5'), instrument: I.felt, gain: 0.3, seed: 3952, mallet: 0, decayScale: 0.6 });
      return b;
    },
    room: { rt60: 0.6, wet: 0.12 },
    master: { loudness: SOFT + 1 }
  },

  // ------------------------------------------------------------------------
  // Emotes in the games (core/gameEmotes, components/Emotes): one little voice
  // each, so you know which it was without looking.
  // ------------------------------------------------------------------------
  'e-laugh': {
    use: 'Emote: laughing - six quick "ha"s tumbling down',
    dry: () => {
      const b = silence(1.1);
      const notes = [640, 600, 560, 530, 490, 450];
      notes.forEach((f, i) => {
        const start = i * 0.115;
        voice(b, {
          start,
          dur: 0.09,
          freq: t => f * (1 + 0.1 * Math.sin((Math.PI * t) / 0.09)),
          amp: t => (0.55 - i * 0.04) * Math.sin((Math.PI * t) / 0.09) ** 0.6,
          harmonics: [1, 0.55, 0.3, 0.14],
          pan: i % 2 ? 0.12 : -0.12
        });
        noise(b, { start, dur: 0.05, gain: 0.1, filter: { type: 'bandpass', f: 2600, q: 0.9 }, attack: 0.008, decay: 0.02, seed: 4101 + i });
      });
      return b;
    },
    room: { rt60: 0.35, wet: 0.07 },
    master: { loudness: MOMENT, highpass: 200 }
  },

  'e-cry': {
    use: 'Emote: crying - a wobbling "waaah" that sinks, and two sniffs',
    dry: () => {
      const b = silence(1.6);
      voice(b, {
        start: 0,
        dur: 0.95,
        freq: t => (560 - 210 * (t / 0.95)) * (1 + 0.05 * Math.sin(2 * Math.PI * 7 * t) * Math.min(1, t / 0.2)),
        amp: t => 0.5 * Math.min(1, t / 0.05) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 5.5 * t)) * Math.min(1, (0.95 - t) / 0.2),
        harmonics: [1, 0.7, 0.45, 0.25, 0.12]
      });
      for (const [i, start] of [1.05, 1.27].entries()) {
        voice(b, {
          start,
          dur: 0.11,
          freq: t => 380 * (1 + 0.5 * (t / 0.11)),
          amp: t => 0.3 * Math.sin((Math.PI * t) / 0.11),
          harmonics: [1, 0.5, 0.25]
        });
        noise(b, { start, dur: 0.1, gain: 0.16, filter: { type: 'bandpass', f: 1800, q: 0.8 }, sweepTo: 3200, attack: 0.02, pink: true, seed: 4111 + i });
      }
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: MOMENT, highpass: 180 }
  },

  'e-angry': {
    use: 'Emote: angry - a rising growl, then steam let off',
    dry: () => {
      const b = silence(1.3);
      voice(b, {
        start: 0,
        dur: 0.6,
        freq: t => 125 * (1 + 0.35 * (t / 0.6)),
        amp: t => 0.5 * Math.min(1, t / 0.04) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 38 * t)) * Math.min(1, (0.6 - t) / 0.08),
        harmonics: [1, 0.9, 0.8, 0.7, 0.55, 0.4, 0.3, 0.2]
      });
      noise(b, { dur: 0.6, gain: 0.18, filter: { type: 'lowpass', f: 900 }, grain: 0.9, attack: 0.03, pink: true, seed: 4121 });
      // Steam out of the ears.
      noise(b, { start: 0.62, dur: 0.5, gain: 0.5, filter: { type: 'bandpass', f: 3800, q: 1.2 }, sweepTo: 7200, attack: 0.01, decay: 0.2, seed: 4122 });
      thump(b, 0.62, 0.4, 140, 4123);
      return b;
    },
    room: { rt60: 0.3, wet: 0.06 },
    master: { loudness: MOMENT, highpass: 110 }
  },

  'e-thumb': {
    use: 'Emote: thumbs up - a pop and a bright "ding-ding"',
    dry: () => {
      const b = silence(1.1);
      noise(b, { dur: 0.03, gain: 0.5, filter: { type: 'bandpass', f: 1100, q: 1.4 }, attack: 0.0008, decay: 0.008, seed: 4131 });
      mode(b, { freq: 520, amp: 0.35, decay: 0.03, glide: -0.35, glideTime: 0.02 });
      run(b, ['A5', 'D6'], 0.1, { instrument: I.glass, gain: [0.45, 0.55], start: 0.06, seed: 4132, mallet: 0.15 });
      strike(b, { note: hz('D5'), instrument: I.felt, start: 0.16, gain: 0.22, seed: 4135, mallet: 0 });
      twinkles(b, 0.25, 0.6, 3, 0.09, 4136);
      return b;
    },
    room: { rt60: 0.8, wet: 0.15 },
    master: { loudness: MOMENT, maxSeconds: 1.1, tailFade: 0.4 }
  },

  'e-kiss': {
    use: 'Emote: a blown kiss - two quick pecks and a heart floating up',
    dry: () => {
      const b = silence(1.2);
      for (const [i, start] of [0, 0.16].entries()) {
        noise(b, { start, dur: 0.03, gain: 0.8, filter: { type: 'bandpass', f: 1700 + i * 300, q: 1.2 }, attack: 0.0008, decay: 0.007, seed: 4141 + i });
        voice(b, {
          start: start + 0.012,
          dur: 0.1,
          freq: t => (520 + i * 80) * (1 + 0.3 * Math.min(1, t / 0.04)),
          amp: t => 0.3 * Math.min(1, t / 0.015) * Math.exp(-t / 0.05),
          harmonics: [1, 0.5, 0.25]
        });
      }
      // The heart, rising.
      run(b, ['F#6', 'A6', 'D7'], 0.085, { instrument: I.glock, gain: [0.2, 0.24, 0.3], start: 0.36, seed: 4145, mallet: 0 });
      air(b, { start: 0.34, dur: 0.4, gain: 0.08, from: 2500, to: 6000, attack: 0.1, seed: 4149 });
      return b;
    },
    room: { rt60: 0.8, wet: 0.16 },
    master: { loudness: MOMENT, highpass: 250, maxSeconds: 1.2, tailFade: 0.4 }
  },

  'e-shock': {
    use: 'Emote: shocked - a sharp gasp and a "huh?!" that jumps up',
    dry: () => {
      const b = silence(1.0);
      noise(b, { dur: 0.2, gain: 0.5, filter: { type: 'bandpass', f: 900, q: 0.9 }, sweepTo: 3800, attack: 0.05, pink: true, seed: 4151 });
      voice(b, {
        start: 0.2,
        dur: 0.3,
        freq: t => 310 * 2.2 ** Math.min(1, t / 0.09) * (1 + 0.03 * Math.sin(2 * Math.PI * 9 * t)),
        amp: t => 0.5 * Math.min(1, t / 0.012) * Math.min(1, (0.3 - t) / 0.12),
        harmonics: [1, 0.6, 0.35, 0.18]
      });
      boing(b, 0.34, hz('D4'), 0.3);
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: MOMENT, highpass: 160 }
  },

  'e-tease': {
    use: 'Emote: teasing - the playground "nyeh nyeh, nyeh-nyeh nyeh"',
    dry: () => {
      const b = silence(1.25);
      const tune: Array<[string, number, number]> = [
        ['A4', 0, 0.17],
        ['F#4', 0.2, 0.17],
        ['B4', 0.4, 0.1],
        ['A4', 0.52, 0.17],
        ['F#4', 0.72, 0.3]
      ];
      for (const [note, start, dur] of tune) {
        const f = hz(note);
        voice(b, {
          start,
          dur,
          // A nasal little voice: mostly the odd overtones, with a scoop into each note.
          freq: t => f * (1 - 0.06 * Math.exp(-t / 0.02)) * (1 + 0.012 * Math.sin(2 * Math.PI * 6 * t)),
          amp: t => 0.42 * Math.min(1, t / 0.01) * Math.min(1, (dur - t) / 0.04),
          harmonics: [1, 0.15, 0.6, 0.1, 0.4, 0.05, 0.25]
        });
      }
      return b;
    },
    room: { rt60: 0.3, wet: 0.06 },
    master: { loudness: MOMENT - 1, highpass: 200 }
  },

  'e-yawn': {
    use: 'Emote: a yawn - up, a long way up, and all the way down again',
    dry: () => {
      const b = silence(1.6);
      const dur = 1.35;
      voice(b, {
        start: 0,
        dur,
        freq: t => (t < 0.5 ? 210 + 170 * Math.sin((Math.PI * t) / 1) : 380 - 220 * ((t - 0.5) / (dur - 0.5)) ** 0.8),
        amp: t => 0.5 * Math.min(1, t / 0.25) * Math.min(1, (dur - t) / 0.45),
        harmonics: [1, 0.6, 0.3, 0.15, 0.06]
      });
      air(b, { start: 0.05, dur: 0.5, gain: 0.14, from: 500, to: 1500, attack: 0.25, seed: 4171 });
      air(b, { start: 0.75, dur: 0.75, gain: 0.2, from: 1800, to: 500, attack: 0.1, seed: 4172 });
      return b;
    },
    room: { rt60: 0.4, wet: 0.08 },
    master: { loudness: MOMENT - 1, highpass: 140 }
  },

  'e-cool': {
    use: 'Emote: too cool - shades sliding down, a finger snap, and a gleam',
    dry: () => {
      const b = silence(1.2);
      voice(b, {
        start: 0,
        dur: 0.2,
        freq: t => 980 * 0.5 ** (t / 0.2),
        amp: t => 0.3 * Math.min(1, t / 0.01) * Math.min(1, (0.2 - t) / 0.05),
        harmonics: [1, 0.2, 0.05]
      });
      // The snap as they land.
      noise(b, { start: 0.24, dur: 0.035, gain: 0.9, filter: { type: 'bandpass', f: 2400, q: 1.6 }, attack: 0.0006, decay: 0.008, seed: 4181 });
      mode(b, { freq: 1500, amp: 0.25, decay: 0.012, start: 0.24 });
      // And the gleam off the glass.
      strike(b, { note: hz('A6'), instrument: I.bell, start: 0.42, gain: 0.3, seed: 4183, mallet: 0, decayScale: 0.6 });
      strike(b, { note: hz('D7'), instrument: I.glock, start: 0.47, gain: 0.18, seed: 4184, mallet: 0 });
      return b;
    },
    room: { rt60: 0.7, wet: 0.14 },
    master: { loudness: MOMENT, highpass: 250, maxSeconds: 1.2, tailFade: 0.4 }
  },

  'e-evil': {
    use: 'Emote: an evil laugh - a low "mmm" and a "mwa-ha-ha-ha" stepping down',
    dry: () => {
      const b = silence(1.4);
      voice(b, {
        start: 0,
        dur: 0.24,
        freq: t => 150 * (1 + 0.3 * (t / 0.24)),
        amp: t => 0.4 * Math.min(1, t / 0.05) * Math.min(1, (0.24 - t) / 0.04),
        harmonics: [1, 0.7, 0.5, 0.3, 0.2]
      });
      const steps = ['B3', 'A3', 'F#3', 'E3', 'D3'];
      steps.forEach((note, i) => {
        const f = hz(note);
        const start = 0.3 + i * 0.16;
        voice(b, {
          start,
          dur: 0.12,
          freq: t => f * (1 + 0.08 * Math.exp(-t / 0.02)),
          amp: t => 0.55 * Math.min(1, t / 0.008) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 30 * t)) * Math.min(1, (0.12 - t) / 0.04),
          harmonics: [1, 0.85, 0.7, 0.5, 0.35, 0.25, 0.15]
        });
      });
      strike(b, { note: hz('D3'), instrument: I.felt, start: 0.3, gain: 0.3, seed: 4191, mallet: 0, decayScale: 1.6 });
      return b;
    },
    room: { rt60: 0.5, wet: 0.12 },
    master: { loudness: MOMENT, highpass: 110 }
  },

  // ------------------------------------------------------------------------
  // A secret message rubbed open (components/SecretScratch), dressing up
  // (components/Wardrobe) and the puppy on Home (components/PetCard).
  // ------------------------------------------------------------------------
  'secret-open': {
    use: 'Secret message: the last of the foil goes - a shimmer upward and a soft chime',
    dry: () => {
      const b = silence(1.4);
      air(b, { start: 0, dur: 0.45, gain: 0.16, from: 1800, to: 7000, attack: 0.12, seed: 4201 });
      run(b, ['A5', 'D6', 'F#6', 'A6', 'D7'], 0.055, { instrument: I.glock, gain: [0.2, 0.24, 0.28, 0.32, 0.36], start: 0.08, seed: 4202, mallet: 0 });
      strike(b, { note: hz('D5'), instrument: I.glass, start: 0.36, gain: 0.3, seed: 4208, mallet: 0, decayScale: 1.3 });
      twinkles(b, 0.4, 1.0, 5, 0.1, 4210);
      return b;
    },
    room: { rt60: 1.1, wet: 0.2 },
    master: { loudness: MOMENT, highpass: 250, maxSeconds: 1.4, tailFade: 0.5 }
  },

  'wear-on': {
    use: 'Dress-up: something put on - a cloth swish, a pop into place, a little ting',
    dry: () => {
      const b = silence(0.8);
      air(b, { start: 0, dur: 0.14, gain: 0.3, from: 900, to: 3200, attack: 0.03, seed: 4221 });
      mode(b, { freq: 430, amp: 0.5, decay: 0.035, start: 0.13, glide: -0.4, glideTime: 0.025 });
      noise(b, { start: 0.13, dur: 0.03, gain: 0.45, filter: { type: 'bandpass', f: 1300, q: 1.3 }, attack: 0.0008, decay: 0.008, seed: 4222 });
      strike(b, { note: hz('F#6'), instrument: I.glock, start: 0.2, gain: 0.22, seed: 4223, mallet: 0 });
      return b;
    },
    room: { rt60: 0.5, wet: 0.1 },
    master: { loudness: SOFT + 1, highpass: 200, maxSeconds: 0.8, tailFade: 0.3 }
  },

  'wear-off': {
    use: 'Dress-up: something taken off - a pop the other way and a swish',
    dry: () => {
      const b = silence(0.5);
      mode(b, { freq: 300, amp: 0.45, decay: 0.03, glide: 0.5, glideTime: 0.03 });
      air(b, { start: 0.04, dur: 0.16, gain: 0.26, from: 3000, to: 800, attack: 0.02, seed: 4231 });
      return b;
    },
    room: { rt60: 0.3, wet: 0.06 },
    master: { loudness: SOFT, highpass: 180 }
  },

  'pet-eat': {
    use: 'Puppy: eating - kibble rattling in the bowl and five quick munches',
    dry: () => {
      const b = silence(1.5);
      for (let i = 0; i < 4; i++) {
        noise(b, { start: i * 0.035, dur: 0.03, gain: 0.3, filter: { type: 'bandpass', f: 2600 + i * 300, q: 2 }, attack: 0.0008, decay: 0.008, seed: 4241 + i, pan: i % 2 ? 0.2 : -0.2 });
      }
      for (let i = 0; i < 5; i++) {
        const start = 0.24 + i * 0.2;
        // Each bite: a soft crunch, and a tiny "nom" under it.
        noise(b, { start, dur: 0.07, gain: 0.55, filter: { type: 'bandpass', f: 1500, q: 0.9 }, grain: 0.8, attack: 0.002, decay: 0.03, seed: 4250 + i });
        voice(b, {
          start: start + 0.02,
          dur: 0.1,
          freq: t => 300 * (1 - 0.2 * (t / 0.1)),
          amp: t => 0.22 * Math.sin((Math.PI * t) / 0.1),
          harmonics: [1, 0.5, 0.2]
        });
      }
      return b;
    },
    room: { rt60: 0.3, wet: 0.06 },
    master: { loudness: MOMENT - 1, highpass: 160 }
  },

  'pet-bark': {
    use: 'Puppy: two happy little yips',
    dry: () => {
      const b = silence(0.75);
      for (const [i, start] of [0, 0.21].entries()) {
        const f = 620 + i * 90;
        voice(b, {
          start,
          dur: 0.13,
          // A yip: up sharply, then falling away.
          freq: t => f * (1 + 0.5 * Math.exp(-t / 0.012)) * (1 - 0.25 * (t / 0.13)),
          amp: t => 0.55 * Math.min(1, t / 0.006) * Math.exp(-t / 0.06),
          harmonics: [1, 0.8, 0.6, 0.4, 0.25, 0.12]
        });
        noise(b, { start, dur: 0.05, gain: 0.25, filter: { type: 'bandpass', f: 2200, q: 0.8 }, attack: 0.002, decay: 0.02, seed: 4261 + i });
      }
      return b;
    },
    room: { rt60: 0.35, wet: 0.08 },
    master: { loudness: MOMENT, highpass: 250 }
  },

  'pet-squeak': {
    use: 'Puppy: stroked - a pleased little squeak and a pant',
    dry: () => {
      const b = silence(0.9);
      voice(b, {
        start: 0,
        dur: 0.24,
        freq: t => 760 * (1 + 0.28 * Math.sin((Math.PI * t) / 0.24)) * (1 + 0.02 * Math.sin(2 * Math.PI * 22 * t)),
        amp: t => 0.4 * Math.sin((Math.PI * t) / 0.24) ** 0.7,
        harmonics: [1, 0.45, 0.2, 0.08]
      });
      for (let i = 0; i < 3; i++) {
        air(b, { start: 0.32 + i * 0.14, dur: 0.09, gain: 0.16, from: 1200, to: 2400, attack: 0.02, seed: 4271 + i });
      }
      return b;
    },
    room: { rt60: 0.35, wet: 0.08 },
    master: { loudness: SOFT + 2, highpass: 300 }
  },

  'pet-whine': {
    use: 'Puppy: hungry or left alone - a small whine that droops',
    dry: () => {
      const b = silence(1.1);
      voice(b, {
        start: 0,
        dur: 0.8,
        freq: t => (880 - 260 * (t / 0.8) ** 1.4) * (1 + 0.025 * Math.sin(2 * Math.PI * 8 * t)),
        amp: t => 0.4 * Math.min(1, t / 0.08) * Math.min(1, (0.8 - t) / 0.3),
        harmonics: [1, 0.35, 0.15, 0.05]
      });
      return b;
    },
    room: { rt60: 0.5, wet: 0.1 },
    master: { loudness: SOFT + 1, highpass: 300 }
  },

  'pet-ball': {
    use: 'Puppy: a ball thrown - it bounces three times, lower each time',
    dry: () => {
      const b = silence(1.0);
      for (const [i, start] of [0, 0.3, 0.52, 0.67].entries()) {
        const gain = 0.8 * 0.62 ** i;
        mode(b, { freq: 190 + i * 14, amp: gain, decay: 0.05, start, glide: 0.7, glideTime: 0.02 });
        mode(b, { freq: 400 + i * 20, amp: gain * 0.5, decay: 0.03, start, glide: 0.5, glideTime: 0.015 });
        noise(b, { start, dur: 0.03, gain: gain * 0.3, filter: { type: 'bandpass', f: 900, q: 1 }, attack: 0.001, decay: 0.008, seed: 4281 + i });
      }
      return b;
    },
    room: { rt60: 0.4, wet: 0.09 },
    master: { loudness: MOMENT - 1, highpass: 140 }
  }
};
