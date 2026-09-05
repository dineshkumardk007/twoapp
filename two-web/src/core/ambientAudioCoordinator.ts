// Ambient Audio Coordinator for Two
// Coordinates audio playback across Midnight Radio, Nightstand Soundscape, and Modal Soundscapes.
// Prevents overlapping playback, eliminates phantom oscillators, and provides instant master mute.

type AudioSourceType = 'nightstand' | 'midnight_radio' | 'ambient_modal' | 'none';

class AmbientAudioCoordinator {
  private activeSource: AudioSourceType = 'none';
  private stopNightstandCb: (() => void) | null = null;
  private stopRadioCb: (() => void) | null = null;
  private stopModalCb: (() => void) | null = null;

  public registerNightstand(stopFn: () => void) {
    this.stopNightstandCb = stopFn;
  }

  public registerRadio(stopFn: () => void) {
    this.stopRadioCb = stopFn;
  }

  public registerModal(stopFn: () => void) {
    this.stopModalCb = stopFn;
  }

  public notifyNightstandPlaying() {
    if (this.activeSource === 'midnight_radio' && this.stopRadioCb) {
      this.stopRadioCb();
    }
    if (this.activeSource === 'ambient_modal' && this.stopModalCb) {
      this.stopModalCb();
    }
    this.activeSource = 'nightstand';
  }

  public notifyRadioPlaying() {
    if (this.activeSource === 'nightstand' && this.stopNightstandCb) {
      this.stopNightstandCb();
    }
    if (this.activeSource === 'ambient_modal' && this.stopModalCb) {
      this.stopModalCb();
    }
    this.activeSource = 'midnight_radio';
  }

  public notifyModalPlaying() {
    if (this.activeSource === 'nightstand' && this.stopNightstandCb) {
      this.stopNightstandCb();
    }
    if (this.activeSource === 'midnight_radio' && this.stopRadioCb) {
      this.stopRadioCb();
    }
    this.activeSource = 'ambient_modal';
  }

  public notifyStopped(source: AudioSourceType) {
    if (this.activeSource === source) {
      this.activeSource = 'none';
    }
  }

  public stopAll() {
    if (this.stopNightstandCb) {
      try { this.stopNightstandCb(); } catch (e) {}
    }
    if (this.stopRadioCb) {
      try { this.stopRadioCb(); } catch (e) {}
    }
    if (this.stopModalCb) {
      try { this.stopModalCb(); } catch (e) {}
    }
    this.activeSource = 'none';
  }

  public getActiveSource(): AudioSourceType {
    return this.activeSource;
  }
}

export const ambientAudioCoordinator = new AmbientAudioCoordinator();
