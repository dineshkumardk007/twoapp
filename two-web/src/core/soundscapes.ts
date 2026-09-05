// Sovereign Procedural Acoustic Soundscape Synthesizer via Web Audio API
// Generates warm, calming, 100% offline ambient soundscapes without external audio files.

export type SoundscapeId = 'rain' | 'fireplace' | 'ocean' | 'forest' | 'cafe';

export interface SoundscapeMeta {
  id: SoundscapeId;
  name: string;
  tagline: string;
  emoji: string;
  description: string;
  color: string;
}

export const SOUNDSCAPES: SoundscapeMeta[] = [
  {
    id: 'rain',
    name: 'Rain on Attic Skylight',
    tagline: 'Gentle roof patter & distant rainfall',
    emoji: '🌧️',
    description: 'Rhythmic, calming rain washing against glass, soothing racing thoughts.',
    color: 'from-blue-900/40 to-indigo-950/60'
  },
  {
    id: 'fireplace',
    name: 'Cabin Fireplace',
    tagline: 'Warm amber glow & gentle timber crackle',
    emoji: '🔥',
    description: 'Subtle low-frequency hearth rumble with occasional organic wood pops.',
    color: 'from-amber-950/40 to-stone-900/60'
  },
  {
    id: 'ocean',
    name: 'Midnight Ocean Waves',
    tagline: 'Tidal ebb and flow under a starlit shore',
    emoji: '🌊',
    description: 'Slow, rhythmic wave surges synchronizing with deep, peaceful breath.',
    color: 'from-cyan-950/40 to-blue-950/60'
  },
  {
    id: 'forest',
    name: 'Pine Wind & Night Crickets',
    tagline: 'Soft canopy breeze & twilight chirp',
    emoji: '🌲',
    description: 'Whistling evergreen branches paired with distant, delicate crickets.',
    color: 'from-emerald-950/40 to-stone-900/60'
  },
  {
    id: 'cafe',
    name: 'Quiet Rainy Haven',
    tagline: 'Muffled warm indoors with continuous rain',
    emoji: '☕',
    description: 'Cozy acoustic enclosure while a gentle downpour blankets the outside world.',
    color: 'from-stone-800/40 to-neutral-900/60'
  }
];

export interface SoundscapeState {
  currentId: SoundscapeId;
  isPlaying: boolean;
  volume: number; // 0.0 to 1.0
  sleepTimerMinutes: number | null;
  secondsRemaining: number | null;
  syncedWithPartner: boolean;
}

type StateListener = (state: SoundscapeState) => void;

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentId: SoundscapeId = 'rain';
  private isPlaying: boolean = false;
  private volume: number = 0.5;
  private sleepTimerMinutes: number | null = null;
  private timerInterval: any = null;
  private secondsRemaining: number | null = null;
  private syncedWithPartner: boolean = false;
  private listeners: Set<StateListener> = new Set();

  // Active nodes for current sound
  private activeNodes: { [key: string]: any } = {};
  private scheduledCrackles: any[] = [];

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  // Create loopable Pink Noise buffer
  private createPinkNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error('No context');
    const bufferSize = this.ctx.sampleRate * 4; // 4 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  // Create Brown Noise buffer (deep warm low-pass noise)
  private createBrownNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error('No context');
    const bufferSize = this.ctx.sampleRate * 4; // 4 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Gain boost
    }
    return buffer;
  }

  // Stop currently running procedural sound generator nodes
  private stopCurrentGenerators() {
    this.scheduledCrackles.forEach(timer => clearTimeout(timer));
    this.scheduledCrackles = [];

    Object.values(this.activeNodes).forEach(node => {
      try {
        if (node && typeof node.stop === 'function') {
          node.stop();
        }
        if (node && typeof node.disconnect === 'function') {
          node.disconnect();
        }
      } catch (e) {}
    });
    this.activeNodes = {};
  }

  // 1. Rain Synthesizer
  private startRain() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const pinkBuffer = this.createPinkNoiseBuffer();
    const source = this.ctx.createBufferSource();
    source.buffer = pinkBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(850, now);
    filter.Q.setValueAtTime(0.8, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);

    this.activeNodes['rainSource'] = source;
    this.activeNodes['rainGain'] = gain;
    this.activeNodes['rainFilter'] = filter;

    // Random water droplets
    const triggerDrop = () => {
      if (!this.isPlaying || this.currentId !== 'rain' || !this.ctx || !this.masterGain) return;
      try {
        const dropOsc = this.ctx.createOscillator();
        const dropGain = this.ctx.createGain();
        const t = this.ctx.currentTime;
        const freq = 1200 + Math.random() * 1400;
        dropOsc.type = 'sine';
        dropOsc.frequency.setValueAtTime(freq, t);
        dropOsc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.05);

        dropGain.gain.setValueAtTime(0.001, t);
        dropGain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.05, t + 0.01);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

        dropOsc.connect(dropGain);
        dropGain.connect(this.masterGain);
        dropOsc.start(t);
        dropOsc.stop(t + 0.07);
      } catch (e) {}

      const nextDropDelay = 150 + Math.random() * 400;
      const tid = setTimeout(triggerDrop, nextDropDelay);
      this.scheduledCrackles.push(tid);
    };
    triggerDrop();
  }

  // 2. Fireplace Synthesizer
  private startFireplace() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const brownBuffer = this.createBrownNoiseBuffer();
    const source = this.ctx.createBufferSource();
    source.buffer = brownBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.85, now);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);

    this.activeNodes['fireRumble'] = source;
    this.activeNodes['fireGain'] = gain;

    const triggerCrackle = () => {
      if (!this.isPlaying || this.currentId !== 'fireplace' || !this.ctx || !this.masterGain) return;
      try {
        const t = this.ctx.currentTime;
        const popOsc = this.ctx.createOscillator();
        const popGain = this.ctx.createGain();
        const popFilter = this.ctx.createBiquadFilter();

        popFilter.type = 'bandpass';
        popFilter.frequency.setValueAtTime(800 + Math.random() * 2500, t);
        popFilter.Q.setValueAtTime(3.5, t);

        popOsc.type = 'triangle';
        popOsc.frequency.setValueAtTime(100 + Math.random() * 400, t);

        popGain.gain.setValueAtTime(0.001, t);
        popGain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.12, t + 0.005);
        popGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04 + Math.random() * 0.05);

        popOsc.connect(popFilter);
        popFilter.connect(popGain);
        popGain.connect(this.masterGain);

        popOsc.start(t);
        popOsc.stop(t + 0.1);
      } catch (e) {}

      const delay = Math.random() < 0.35 ? (40 + Math.random() * 100) : (250 + Math.random() * 900);
      const tid = setTimeout(triggerCrackle, delay);
      this.scheduledCrackles.push(tid);
    };
    triggerCrackle();
  }

  // 3. Ocean Waves Synthesizer
  private startOcean() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const brownBuffer = this.createBrownNoiseBuffer();
    const source = this.ctx.createBufferSource();
    source.buffer = brownBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);
    filter.Q.setValueAtTime(1.2, now);

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.075, now);
    lfo.connect(filter.frequency);

    const waveGain = this.ctx.createGain();
    waveGain.gain.setValueAtTime(0.55, now);

    source.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(this.masterGain);

    source.start(now);
    lfo.start(now);

    this.activeNodes['oceanSource'] = source;
    this.activeNodes['oceanLfo'] = lfo;
    this.activeNodes['oceanFilter'] = filter;
    this.activeNodes['oceanGain'] = waveGain;
  }

  // 4. Pine Forest Wind & Crickets Synthesizer
  private startForest() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const pinkBuffer = this.createPinkNoiseBuffer();
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = pinkBuffer;
    windSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(450, now);
    windFilter.Q.setValueAtTime(2.0, now);

    const windLfo = this.ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.setValueAtTime(0.06, now);
    windLfo.connect(windFilter.frequency);

    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0.45, now);

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.masterGain);

    windSource.start(now);
    windLfo.start(now);

    this.activeNodes['forestWindSource'] = windSource;
    this.activeNodes['forestWindLfo'] = windLfo;
    this.activeNodes['forestWindGain'] = windGain;

    const triggerCricketPulse = () => {
      if (!this.isPlaying || this.currentId !== 'forest' || !this.ctx || !this.masterGain) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(4600 + Math.random() * 200, t);

        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.02, t + 0.02);
        g.gain.linearRampToValueAtTime(0.002, t + 0.05);
        g.gain.linearRampToValueAtTime(0.025, t + 0.08);
        g.gain.linearRampToValueAtTime(0.001, t + 0.12);
        g.gain.linearRampToValueAtTime(0.02, t + 0.15);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.25);
      } catch (e) {}

      const nextDelay = 1800 + Math.random() * 3200;
      const tid = setTimeout(triggerCricketPulse, nextDelay);
      this.scheduledCrackles.push(tid);
    };
    triggerCricketPulse();
  }

  // 5. Quiet Rainy Café Synthesizer
  private startCafe() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const pinkBuffer = this.createPinkNoiseBuffer();
    const source = this.ctx.createBufferSource();
    source.buffer = pinkBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);

    const roomFilter = this.ctx.createBiquadFilter();
    roomFilter.type = 'peaking';
    roomFilter.frequency.setValueAtTime(280, now);
    roomFilter.gain.setValueAtTime(3.0, now);
    roomFilter.Q.setValueAtTime(1.5, now);

    source.connect(filter);
    filter.connect(roomFilter);
    roomFilter.connect(gain);
    gain.connect(this.masterGain);

    source.start(now);

    this.activeNodes['cafeSource'] = source;
    this.activeNodes['cafeGain'] = gain;
  }

  public play(id?: SoundscapeId) {
    this.initContext();
    if (id) {
      this.currentId = id;
    }
    this.stopCurrentGenerators();

    switch (this.currentId) {
      case 'rain':
        this.startRain();
        break;
      case 'fireplace':
        this.startFireplace();
        break;
      case 'ocean':
        this.startOcean();
        break;
      case 'forest':
        this.startForest();
        break;
      case 'cafe':
        this.startCafe();
        break;
    }

    this.isPlaying = true;
    this.notify();
  }

  public pause() {
    this.stopCurrentGenerators();
    this.isPlaying = false;
    this.notify();
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play(this.currentId);
    }
  }

  public selectSoundscape(id: SoundscapeId) {
    this.currentId = id;
    if (this.isPlaying) {
      this.play(id);
    } else {
      this.notify();
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    this.notify();
  }

  public setSleepTimer(minutes: number | null) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.sleepTimerMinutes = minutes;
    if (minutes === null || minutes <= 0) {
      this.secondsRemaining = null;
      this.notify();
      return;
    }

    this.secondsRemaining = minutes * 60;
    this.notify();

    this.timerInterval = setInterval(() => {
      if (this.secondsRemaining === null || this.secondsRemaining <= 1) {
        this.stopSleepTimerFadeOut();
      } else {
        this.secondsRemaining -= 1;
        if (this.secondsRemaining <= 30 && this.masterGain && this.ctx) {
          const fadeRatio = this.secondsRemaining / 30;
          this.masterGain.gain.setValueAtTime(this.volume * fadeRatio, this.ctx.currentTime);
        }
        this.notify();
      }
    }, 1000);
  }

  private stopSleepTimerFadeOut() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.secondsRemaining = null;
    this.sleepTimerMinutes = null;
    this.pause();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    this.notify();
  }

  public setSyncedWithPartner(synced: boolean) {
    this.syncedWithPartner = synced;
    this.notify();
  }

  public getState(): SoundscapeState {
    return {
      currentId: this.currentId,
      isPlaying: this.isPlaying,
      volume: this.volume,
      sleepTimerMinutes: this.sleepTimerMinutes,
      secondsRemaining: this.secondsRemaining,
      syncedWithPartner: this.syncedWithPartner
    };
  }

  public subscribe(listener: StateListener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(cb => cb(state));
  }
}

export const soundscapeEngine = new SoundscapeEngine();
