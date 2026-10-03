// Music for the radio stations and the calm drones: real instruments,
// generated live, never repeating.
//
// Notes are rendered once (an electric piano, a plucked string, a bell - see
// textures.ts, which runs off the main thread) and kept; the engine decides
// what to play and when. A station starts once the notes of its first bars
// are ready, and the rest follow in the background. Pads are oscillators, so
// they can hold for as long as anyone listens.

import { Session, Target, Recipe, play, filter, wobble, noise, recipe, random, running, isOffline } from './kit';
import { hz, Partial } from './synth';

/** A note's frequency, whether written as a name ('F#4') or a number of Hz. */
function freq(note: string | number): number {
  return typeof note === 'number' ? note : hz(note);
}

/** Every distinct note in these lists, in order of first appearance. */
function distinct(...lists: ((string | number)[] | undefined)[]): (string | number)[] {
  return [...new Set(lists.flatMap(l => l ?? []))];
}

/** A note's name for lookups, rounded so 'A4' and 440 are the same note. */
function noteKey(note: string | number) {
  return freq(note).toFixed(2);
}

/** The buffers for a set of notes, made by one recipe, looked up by note. */
function byNote(notes: (string | number)[], buffers: AudioBuffer[]) {
  const map = new Map(notes.map((n, i) => [noteKey(n), buffers[i]]));
  return (note: string | number) => map.get(noteKey(note))!;
}

/**
 * An instrument's notes, ready as they are rendered: `first` before the
 * session may start, the rest after, in the background. Waiting for every
 * one of a station's few dozen notes would keep it silent for seconds after
 * the tap. A note not ready yet is not played, so on a cold start the first
 * bars are the chords alone - the melody, and any bell beyond the first,
 * join a few seconds in, once theirs are made.
 */
function noteBank(
  s: Session,
  all: (string | number)[],
  first: (string | number)[],
  make: (note: string | number) => Recipe,
  start: (note: (n: string | number) => AudioBuffer | undefined) => void
) {
  const ready = new Map<string, AudioBuffer>();
  // Offline, the whole render is planned the moment it starts, so every note has to be there.
  if (isOffline(s.ctx)) first = all;
  const firstKeys = new Set(first.map(noteKey));
  // Asked for first, so a worker that is free starts on what is needed now.
  s.when(first.map(make), buffers => {
    first.forEach((n, i) => ready.set(noteKey(n), buffers[i]));
    start(n => ready.get(noteKey(n)));
  });
  for (const n of all) {
    if (firstKeys.has(noteKey(n))) continue;
    s.load(make(n), 'later').then(
      b => ready.set(noteKey(n), b),
      () => { /* that note is left out */ }
    );
  }
}

/**
 * The amplifier a Rhodes plays through: its tremolo moves the sound from ear
 * to ear and back, 4.6 times a second. One for the whole instrument, as on
 * the real thing - it used to be rendered into every note separately.
 */
function tremoloAmp(s: Session, rateHz: number, depth: number): Target {
  const { ctx, bus } = s;
  const input = ctx.createGain();
  const split = ctx.createChannelSplitter(2);
  const merge = ctx.createChannelMerger(2);
  const left = ctx.createGain();
  const right = ctx.createGain();
  left.gain.value = right.gain.value = 1 - depth / 2;
  input.connect(split);
  split.connect(left, 0);
  split.connect(right, 1);
  left.connect(merge, 0, 0);
  right.connect(merge, 0, 1);
  merge.connect(bus.input);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = rateHz;
  const toLeft = ctx.createGain();
  const toRight = ctx.createGain();
  toLeft.gain.value = -depth / 2;
  toRight.gain.value = depth / 2;
  lfo.connect(toLeft);
  lfo.connect(toRight);
  toLeft.connect(left.gain);
  toRight.connect(right.gain);
  lfo.start();
  s.keep(running(lfo));
  return { context: ctx, input, send: bus.send };
}

export interface ChordOptions {
  /** Chords low to high, as note names or Hz. */
  chords: (string | number)[][];
  /** Seconds each chord lasts. */
  bar: number;
  gain?: number;
  /** Notes a melody may wander over, an octave or so above the chords. */
  melody?: (string | number)[];
  /** 0..1: how often the melody speaks. */
  melodyChance?: number;
}

/**
 * Electric-piano chords, strummed softly from the bottom up, with a sparse
 * melody drifting over them - played a little differently every time.
 */
export function keysChords(s: Session, o: ChordOptions) {
  const gain = o.gain ?? 1;
  // The first two chords cover the scheduler's first look ahead.
  const first = distinct(o.chords[0], o.chords[1]);
  const make = (n: string | number) => recipe('keys', { note: freq(n) }, `keys:${noteKey(n)}`);
  noteBank(s, distinct(...o.chords, o.melody), first, make, note => {
    const amp = tremoloAmp(s, 4.6, 0.18);
    let index = 0;
    s.sched.every(when => {
      const chord = o.chords[index % o.chords.length];
      index++;
      const strum = random.between(0.018, 0.04);
      chord.forEach((n, i) => {
        const buffer = note(n);
        if (!buffer) return;
        play(amp, buffer, {
          when: when + i * strum + random.between(0, 0.01),
          gain: gain * random.between(0.75, 1) * (i === 0 ? 1 : 0.8),
          pan: (i / Math.max(1, chord.length - 1) - 0.5) * 0.6,
          room: 0.3,
          // A hair of tape-like drift: no two chords quite the same.
          rate: 1 + random.between(-0.002, 0.002)
        });
      });
      if (o.melody?.length) {
        const eighth = o.bar / 8;
        for (let k = 1; k < 8; k++) {
          if (!random.chance(o.melodyChance ?? 0.22)) continue;
          const playable = o.melody.filter(n => note(n));
          if (!playable.length) continue;
          play(amp, note(random.pick(playable))!, {
            when: when + k * eighth + (k % 2 ? eighth * 0.12 : 0), // a little swing
            gain: gain * random.between(0.35, 0.6),
            pan: random.between(-0.35, 0.35),
            room: 0.35
          });
        }
      }
      return o.bar;
    }, 0.3);
  });
}

export interface PickOptions {
  /** Each chord: [bass, alternate bass, then the treble strings]. */
  chords: (string | number)[][];
  /** Eighth notes per minute / 2: the feel of the picking. */
  bpm: number;
  gain?: number;
}

/**
 * Fingerpicked guitar: the thumb alternating on the bass, the fingers
 * answering on the treble - the pattern under a thousand folk songs.
 */
export function fingerpick(s: Session, o: PickOptions) {
  const { bus } = s;
  const gain = o.gain ?? 1;
  const eighth = 60 / o.bpm / 2;
  const notes = distinct(...o.chords);
  s.when(notes.map(n => recipe('pluck', { note: freq(n) }, `pluck:${noteKey(n)}`)), buffers => {
    const note = byNote(notes, buffers);
    let bar = 0;
    s.sched.every(when => {
      const c = o.chords[Math.floor(bar / 2) % o.chords.length];
      bar++;
      const [bass, alt, ...treble] = c;
      const pattern: (string | number | undefined)[] = [bass, treble[0], alt, treble[1] ?? treble[0], bass, treble[2] ?? treble[0], alt, treble[1] ?? treble[0]];
      pattern.forEach((n, i) => {
        if (n === undefined) return;
        const isBass = i % 2 === 0;
        play(bus, note(n), {
          when: when + i * eighth + random.between(-0.008, 0.012),
          gain: gain * (isBass ? 0.9 : 0.6) * random.between(0.8, 1.05),
          pan: isBass ? -0.12 : 0.18,
          room: 0.25
        });
      });
      return eighth * 8;
    }, 0.3);
  });
}

export interface PadOptions {
  notes: (string | number)[];
  gain?: number;
  /** 0..1: dark to open. */
  brightness?: number;
  /**
   * A true binaural beat at this many Hz: the lowest note sounds at slightly
   * different pitches in each ear, so the beat happens between the ears
   * rather than in the air - which is the whole point of one, and needs
   * headphones to work.
   */
  binaural?: number;
}

/** A warm, slowly moving pad that holds for as long as it is wanted. */
export function pad(s: Session, o: PadOptions) {
  const { ctx, bus } = s;
  const gain = o.gain ?? 1;
  const tone = filter(ctx, 'lowpass', 500 + 1400 * (o.brightness ?? 0.4), 0.6);
  const level = ctx.createGain();
  level.gain.value = gain * 0.12 / Math.sqrt(o.notes.length);
  tone.connect(level);
  level.connect(bus.input);
  const send = ctx.createGain();
  send.gain.value = 0.6;
  level.connect(send);
  send.connect(bus.send);
  s.keep(wobble(ctx, tone.frequency, 0.045, 260));
  s.keep(wobble(ctx, level.gain, 0.031, gain * 0.025));

  // With a binaural beat, the lowest note is played by the beat's pair alone.
  // Were it in the pad as well, each ear would hear the pair's tone beating
  // against the pad's own - a deep throb a few times a second, different in
  // each ear, drowning out the beat between them.
  const voiced = o.binaural ? o.notes.slice(1) : o.notes;
  for (const note of voiced) {
    const f = freq(note);
    // Two voices a few cents apart: the slow chorus that makes a pad warm.
    for (const [type, cents, amp] of [['triangle', -4, 1], ['sine', 5, 0.8], ['sawtooth', 0, 0.12]] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f;
      osc.detune.value = cents;
      const g = ctx.createGain();
      g.gain.value = amp;
      osc.connect(g);
      g.connect(tone);
      osc.start();
      s.keep(running(osc));
    }
  }

  if (o.binaural) {
    const f = freq(o.notes[0]);
    const merger = ctx.createChannelMerger(2);
    // As loud in each ear as the pad's voice for that note would have been
    // (its triangle and sine together), and into the room like the rest of
    // the pad - a stereo room keeps the ears apart.
    const pair = ctx.createGain();
    pair.gain.value = 1.14;
    [f - o.binaural / 2, f + o.binaural / 2].forEach((hzEar, ear) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = hzEar;
      osc.connect(merger, 0, ear);
      osc.start();
      s.keep(running(osc));
    });
    merger.connect(pair);
    pair.connect(level);
  }
}

export interface BellOptions {
  notes: (string | number)[];
  instrument: Partial[];
  name: string;
  /** Seconds between bells, at random within this. */
  every: [number, number];
  gain?: number;
}

/** Bells, bowls or glass, struck now and then. */
export function bells(s: Session, o: BellOptions) {
  const { bus } = s;
  const notes = distinct(o.notes);
  const make = (n: string | number) => recipe('bell', { note: freq(n), instrument: o.instrument }, `bell:${o.name}:${noteKey(n)}`);
  // One bell to start with; the others join as they are made.
  noteBank(s, notes, notes.slice(0, 1), make, note => {
    s.sched.every(when => {
      const playable = o.notes.filter(n => note(n));
      play(bus, note(random.pick(playable))!, {
        when, gain: (o.gain ?? 1) * random.between(0.5, 1), pan: random.between(-0.5, 0.5), room: 0.6
      });
      return random.between(o.every[0], o.every[1]);
    }, random.between(0.5, 2));
  });
}

/** The crackle and hiss of an old record. */
export function vinyl(s: Session, o: { gain?: number } = {}) {
  s.when([recipe('vinyl', { seed: 61 })], ([record]) => {
    const v = play(s.bus, record, { loop: true, gain: o.gain ?? 1, offset: random.between(0, 8) });
    s.keep({ stop: () => v.source.stop() });
  });
}

/** Faint air under a drone, so silence is never quite empty. */
export function air(s: Session, o: { gain?: number; tone?: number } = {}) {
  s.when([noise('pink')], ([pink]) => {
    const a = play(s.bus, pink, {
      loop: true, gain: o.gain ?? 0.05, offset: random.between(0, 9),
      through: [filter(s.ctx, 'lowpass', o.tone ?? 700, 0.5)]
    });
    s.keep({ stop: () => a.source.stop() });
  });
}
