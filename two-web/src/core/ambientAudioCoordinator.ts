// Ambient Audio Coordinator for Two
// Keeps one ambience playing at a time across the app: the soundscapes, the
// Nightstand, Midnight Radio, and the drones under Soft Landing and the
// breathing exercise. Whichever starts stops whichever was playing.
//
// It used to know only the Nightstand and the radio - which App shows one at
// a time anyway - while the ones that really could overlap (a soundscape
// started from anywhere, the two drones, each with its own beat between the
// ears) all played on top of each other.

type AudioSourceType = 'nightstand' | 'midnight_radio' | 'ambient_modal' | 'soft_landing' | 'co_regulation' | 'none';

class AmbientAudioCoordinator {
  private activeSource: AudioSourceType = 'none';
  private stoppers = new Map<AudioSourceType, () => void>();

  /** How to stop this source when another starts. The latest registration wins. */
  public register(source: Exclude<AudioSourceType, 'none'>, stopFn: () => void) {
    this.stoppers.set(source, stopFn);
  }

  /** This source has started: whichever other one was playing is stopped. */
  public notifyPlaying(source: Exclude<AudioSourceType, 'none'>) {
    const previous = this.activeSource;
    if (previous !== 'none' && previous !== source) {
      try {
        this.stoppers.get(previous)?.();
      } catch {
        /* it was stopping anyway */
      }
    }
    this.activeSource = source;
  }

  public notifyStopped(source: AudioSourceType) {
    if (this.activeSource === source) {
      this.activeSource = 'none';
    }
  }

  public registerNightstand(stopFn: () => void) {
    this.register('nightstand', stopFn);
  }

  public registerRadio(stopFn: () => void) {
    this.register('midnight_radio', stopFn);
  }

  public registerModal(stopFn: () => void) {
    this.register('ambient_modal', stopFn);
  }

  public notifyNightstandPlaying() {
    this.notifyPlaying('nightstand');
  }

  public notifyRadioPlaying() {
    this.notifyPlaying('midnight_radio');
  }

  public notifyModalPlaying() {
    this.notifyPlaying('ambient_modal');
  }

  public stopAll() {
    for (const stop of this.stoppers.values()) {
      try {
        stop();
      } catch {
        /* keep stopping the rest */
      }
    }
    this.activeSource = 'none';
  }

  public getActiveSource(): AudioSourceType {
    return this.activeSource;
  }
}

export const ambientAudioCoordinator = new AmbientAudioCoordinator();
