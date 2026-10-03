// Sound for the breathing exercise: a cue as each phase begins, a heartbeat
// to breathe with, and a drone underneath.
//
// The cues and the heartbeat are the app's designed sounds (see sounds.ts):
// singing bowls for the breath, and a heartbeat voiced so a phone speaker
// can carry it - the one here used to sit at 38-58 Hz behind a 110 Hz
// filter, which a phone plays almost nothing of. The drone is live (see
// ambient/presets.ts): a warm pad with a true binaural beat, a slightly
// different pitch in each ear. The old one sent both tones to both ears,
// which makes a beat in the air, not between the ears.

import { playSound } from './sounds';
import { Session, liveContext } from './ambient/kit';
import { startPreset } from './ambient/presets';
import { ambientAudioCoordinator } from './ambientAudioCoordinator';

type Phase = 'inhale' | 'holdIn' | 'exhale' | 'holdOut';

const PHASE_SOUND = {
  inhale: 'breath-in',
  holdIn: 'breath-hold',
  exhale: 'breath-out',
  holdOut: 'breath-rest'
} as const;

class CoRegulationAudioEngine {
  private drone: Session | null = null;

  constructor() {
    // Another ambience starting stops the drone; the drone starting stops it.
    ambientAudioCoordinator.register('co_regulation', () => this.stopThetaDrone());
  }

  /** The cue for the phase just beginning. */
  public playPhaseChime(phase: Phase) {
    playSound(PHASE_SOUND[phase]);
  }

  /** One heartbeat, lub-dub - softer than an alert, since it repeats. */
  public playHeartbeat() {
    playSound('heartbeat', { gain: 0.65 });
  }

  public startThetaDrone() {
    if (this.drone) return;
    const ctx = liveContext();
    if (!ctx) return;
    ambientAudioCoordinator.notifyPlaying('co_regulation');
    this.drone = startPreset(ctx, 'co-regulation', 1, 2);
  }

  public stopThetaDrone() {
    this.drone?.stop(1.2);
    this.drone = null;
    ambientAudioCoordinator.notifyStopped('co_regulation');
  }
}

export const coRegulationAudio = new CoRegulationAudioEngine();
