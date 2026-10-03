// Every ambience in the app, as a recipe of layers and a room.
//
// The engines (soundscapes, nightstand, radio, breathing, soft landing) only
// choose which of these is playing; what each one is lives here, in one
// place, so they are designed together and sit at matching levels.

import { Session, BusOptions } from './kit';
import { rain, fire, ocean, wind, crickets, roomTone, birds } from './nature';
import { keysChords, fingerpick, pad, bells, vinyl, air } from './music';
import { INSTRUMENTS } from './synth';

/*
 * Trims set from offline renders (sound-design/ambient-harness), so that at
 * full volume nature sits around -20 dBFS, sleep sounds a dB lower, music a
 * dB higher, and the drones well under everything - the breathing drone
 * lowest, so the breath cues stay on top. Re-measure after changing a preset.
 */
export interface Preset {
  /** The room and tone of this ambience; volume is supplied by the engine. */
  bus: Omit<BusOptions, 'volume'>;
  build: (s: Session) => void;
}

export const PRESETS = {
  // ------------------------------------------------------ soundscapes
  rain: {
    bus: { room: { rt60: 1.4 }, trim: 0.62 },
    build: s => rain(s, { skylight: true })
  },
  fireplace: {
    bus: { room: { rt60: 1.1, damping: 0.4 }, trim: 0.63 },
    build: s => fire(s)
  },
  ocean: {
    bus: { room: { rt60: 1.8 }, trim: 0.97 },
    build: s => ocean(s)
  },
  forest: {
    bus: { room: { rt60: 1.6 }, trim: 1.7 },
    build: s => {
      wind(s, { pine: true, amount: 0.85 });
      crickets(s);
    }
  },
  cafe: {
    // Indoors, the rain outside, a warm room.
    bus: { room: { rt60: 0.9, damping: 0.35 }, trim: 0.69 },
    build: s => {
      rain(s, { indoor: true, amount: 0.85 });
      roomTone(s, { clinks: true });
    }
  },

  // ------------------------------------------------------ nightstand
  'night-rain': {
    bus: { room: { rt60: 1.4 }, trim: 0.63 },
    build: s => rain(s, { amount: 0.8 })
  },
  'night-theta': {
    // A slow, dark pad around D, with a 4.5 Hz beat between the ears.
    bus: { room: { rt60: 3.2 }, trim: 0.28 },
    build: s => {
      pad(s, { notes: ['D3', 'A3', 'D4', 'F#4'], brightness: 0.15, binaural: 4.5 });
      air(s, { gain: 0.035, tone: 500 });
    }
  },
  'night-campfire': {
    bus: { room: { rt60: 1.1, damping: 0.4 }, trim: 0.63 },
    build: s => fire(s, { amount: 0.9 })
  },
  'night-ocean': {
    bus: { room: { rt60: 1.8 }, trim: 0.81 },
    build: s => ocean(s, { amount: 0.9 })
  },

  // ------------------------------------------------------ midnight radio
  tokyo_rain: {
    // Lo-fi: a soft electric piano behind a rain-streaked window, on an old record.
    bus: { room: { rt60: 1.6 }, lowpass: 4800, trim: 0.6 },
    build: s => {
      keysChords(s, {
        chords: [
          ['F3', 'A3', 'C4', 'E4', 'G4'],
          ['E3', 'G3', 'B3', 'D4', 'F#4'],
          ['D3', 'F3', 'A3', 'C4', 'E4'],
          ['C3', 'E3', 'G3', 'B3', 'D4'],
          ['G3', 'B3', 'D4', 'F4', 'A4'],
          ['A3', 'C4', 'E4', 'G4', 'B4']
        ],
        bar: 4.2,
        melody: ['C5', 'D5', 'E5', 'G5', 'A5'],
        melodyChance: 0.18
      });
      vinyl(s, { gain: 0.55 });
      rain(s, { indoor: true, amount: 0.4 });
    }
  },
  hearthside: {
    // Fingerpicked guitar in D, by a low fire.
    bus: { room: { rt60: 1.3, damping: 0.4 }, trim: 1.12 },
    build: s => {
      fingerpick(s, {
        chords: [
          ['D3', 'A3', 'D4', 'F#4', 'A4'],
          ['A2', 'E3', 'A3', 'C#4', 'E4'],
          ['B2', 'F#3', 'B3', 'D4', 'F#4'],
          ['G2', 'D3', 'G3', 'B3', 'D4']
        ],
        bpm: 76
      });
      fire(s, { amount: 0.3 });
    }
  },
  cosmic_528: {
    // A deep pad on 528 Hz's family, glass bells far off, a 2.5 Hz beat between the ears.
    bus: { room: { rt60: 3.6 }, trim: 0.54 },
    build: s => {
      pad(s, { notes: [132, 198, 264, 396], brightness: 0.3, binaural: 2.5 });
      bells(s, { name: 'glass', notes: [528, 594, 660, 792, 1056], instrument: INSTRUMENTS.glass, every: [5, 11], gain: 0.5 });
    }
  },
  sunday_cafe: {
    // Morning chords in G, a warm room, cups, and birds through an open window.
    bus: { room: { rt60: 1.2, damping: 0.4 }, trim: 0.59 },
    build: s => {
      keysChords(s, {
        chords: [
          ['G3', 'B3', 'D4', 'F#4'],
          ['C3', 'E3', 'G3', 'B3'],
          ['A3', 'C4', 'E4', 'G4'],
          ['D3', 'F#3', 'A3', 'C4']
        ],
        bar: 3.8,
        melody: ['G4', 'A4', 'B4', 'D5', 'E5'],
        melodyChance: 0.2
      });
      roomTone(s, { clinks: true });
      birds(s);
    }
  },

  // ------------------------------------------------------ calm drones
  'soft-landing': {
    // Settling: D, A, D, warm and low, with a 4 Hz beat between the ears.
    bus: { room: { rt60: 3 }, trim: 0.36 },
    build: s => {
      pad(s, { notes: ['D3', 'A3', 'D4'], brightness: 0.3, binaural: 4 });
      air(s, { gain: 0.025 });
    }
  },
  'co-regulation': {
    // Under the breathing exercise: quieter, and a 6 Hz beat between the ears.
    bus: { room: { rt60: 3 }, trim: 0.25 },
    build: s => pad(s, { notes: ['D3', 'A3'], brightness: 0.25, binaural: 6 })
  }
} satisfies Record<string, Preset>;

export type PresetName = keyof typeof PRESETS;

/**
 * Starts a preset on a context: a running session, fading in as soon as
 * what it plays is ready.
 *
 * Never throws. Sound is not worth losing a screen over: the breathing
 * exercise starts its drone from inside a React effect, where a throw takes
 * the whole app down with it. A preset that cannot start is just not heard.
 */
export function startPreset(ctx: BaseAudioContext, name: PresetName, volume: number, fadeIn = 1.5): Session | null {
  let session: Session | null = null;
  try {
    const preset: Preset = PRESETS[name];
    session = new Session(ctx, { ...preset.bus, volume });
    preset.build(session);
    session.start(fadeIn);
    return session;
  } catch (err) {
    console.warn(`The "${name}" ambience could not start`, err);
    try {
      session?.stop(0);
    } catch {
      /* nothing more to undo */
    }
    return null;
  }
}
