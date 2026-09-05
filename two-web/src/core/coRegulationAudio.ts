// Procedural Acoustic Synthesizer for Co-Regulation Sanctuary via Web Audio API
// Generates warm, grounding 432Hz harmonic chimes, binaural theta relaxation drones,
// and organic chest-resonance heartbeat pulses — completely offline with zero external audio assets.

class CoRegulationAudioEngine {
  private ctx: AudioContext | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private isDroneRunning: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays a phase transition chime tuned to 432Hz harmonic proportions.
   */
  public playPhaseChime(phase: 'inhale' | 'holdIn' | 'exhale' | 'holdOut') {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      if (phase === 'inhale') {
        // Rising, expansive harmonic sweep (432Hz -> 576Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(432, now);
        osc.frequency.exponentialRampToValueAtTime(576, now + 1.2);

        // Overtone shimmer
        const overtone = ctx.createOscillator();
        const overGain = ctx.createGain();
        overtone.type = 'sine';
        overtone.frequency.setValueAtTime(864, now);
        overtone.frequency.exponentialRampToValueAtTime(1152, now + 1.2);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

        overGain.gain.setValueAtTime(0.0001, now);
        overGain.gain.exponentialRampToValueAtTime(0.04, now + 0.3);
        overGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

        osc.connect(gain);
        gain.connect(ctx.destination);
        overtone.connect(overGain);
        overGain.connect(ctx.destination);

        osc.start(now);
        overtone.start(now);
        osc.stop(now + 2.6);
        overtone.stop(now + 2.6);

      } else if (phase === 'holdIn') {
        // Sustained crystal singing bowl tone (432Hz + 648Hz fifth)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(432, now);
        osc2.frequency.setValueAtTime(648, now); // Pure perfect fifth

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.15, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 3.1);
        osc2.stop(now + 3.1);

      } else if (phase === 'exhale') {
        // Soothing downward release chord (576Hz -> 432Hz -> 288Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(576, now);
        osc.frequency.exponentialRampToValueAtTime(288, now + 2.2);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 3.6);

      } else {
        // holdOut: Grounded low octave resting ring (216Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(216, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 2.1);
      }
    } catch (e) {
      console.warn('[CoRegulationAudio] Phase chime suppressed:', e);
    }
  }

  /**
   * Plays a warm, organic chest-resonance heartbeat sound ("lub-dub").
   */
  public playHeartbeat() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Filter to simulate chest cavity warmth
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(110, now);
      filter.connect(ctx.destination);

      // Thump 1: "Lub" (58Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(58, now);
      osc1.frequency.exponentialRampToValueAtTime(38, now + 0.14);

      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc1.connect(gain1);
      gain1.connect(filter);

      osc1.start(now);
      osc1.stop(now + 0.18);

      // Thump 2: "Dub" (slightly softer, ~150ms later, 52Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      const t2 = now + 0.15;
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(52, t2);
      osc2.frequency.exponentialRampToValueAtTime(34, t2 + 0.12);

      gain2.gain.setValueAtTime(0.0001, t2);
      gain2.gain.exponentialRampToValueAtTime(0.24, t2 + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.13);

      osc2.connect(gain2);
      gain2.connect(filter);

      osc2.start(t2);
      osc2.stop(t2 + 0.16);

    } catch (e) {
      console.warn('[CoRegulationAudio] Heartbeat suppressed:', e);
    }
  }

  /**
   * Starts a continuous, ultra-subtle binaural theta drone (432Hz base, 6Hz difference)
   * which naturally prompts parasympathetic relaxation and calm breathing.
   */
  public startThetaDrone() {
    if (this.isDroneRunning) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.droneGain = ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.0001, now);
      this.droneGain.gain.exponentialRampToValueAtTime(0.05, now + 2.0); // Gentle fade-in
      this.droneGain.connect(ctx.destination);

      // Left ear: 432Hz
      this.droneOsc1 = ctx.createOscillator();
      this.droneOsc1.type = 'sine';
      this.droneOsc1.frequency.setValueAtTime(432, now);
      this.droneOsc1.connect(this.droneGain);

      // Right ear: 438Hz (6Hz difference = soothing theta wave)
      this.droneOsc2 = ctx.createOscillator();
      this.droneOsc2.type = 'sine';
      this.droneOsc2.frequency.setValueAtTime(438, now);
      this.droneOsc2.connect(this.droneGain);

      this.droneOsc1.start(now);
      this.droneOsc2.start(now);
      this.isDroneRunning = true;
    } catch (e) {
      console.warn('[CoRegulationAudio] Theta drone error:', e);
    }
  }

  public stopThetaDrone() {
    if (!this.isDroneRunning || !this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      if (this.droneGain) {
        this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, now);
        this.droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      }
      setTimeout(() => {
        try {
          this.droneOsc1?.stop();
          this.droneOsc2?.stop();
          this.droneOsc1?.disconnect();
          this.droneOsc2?.disconnect();
        } catch (_) {}
        this.droneOsc1 = null;
        this.droneOsc2 = null;
        this.droneGain = null;
        this.isDroneRunning = false;
      }, 1300);
    } catch (e) {
      this.isDroneRunning = false;
    }
  }
}

export const coRegulationAudio = new CoRegulationAudioEngine();
