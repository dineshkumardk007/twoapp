import React, { useState, useEffect, useRef } from 'react';
import { SpaceState } from '../core/storage';
import { NightstandState, SleepPartnerStatus } from '../types';
import {
  Moon,
  Sun,
  Heart,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  Bed,
  Bell,
  Coffee,
  Check,
  Send,
  Sliders
} from 'lucide-react';

interface NightstandClockViewProps {
  state: SpaceState;
  onUpdateNightstand: (updated: NightstandState) => void;
  onSendMidnightKiss: (note?: string) => void;
  onNavigate?: (tab: string) => void;
}

// Moon Phase Calculation
function getMoonPhase(date: Date = new Date()): { phaseName: string; illumination: number; phaseIndex: number } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  let c = 0;
  let e = 0;
  let jd = 0;
  let b = 0;

  if (month < 3) {
    year - 1;
    month + 12;
  }

  const a = Math.floor(year / 100);
  b = 2 - a + Math.floor(a / 4);
  jd = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
  const daysSinceNew = (jd - 2451549.5) % 29.53058867;
  const normalized = daysSinceNew < 0 ? daysSinceNew + 29.53058867 : daysSinceNew;
  const phaseRatio = normalized / 29.53058867;

  // Approximate illumination (0 to 1)
  const illumination = Math.round(0.5 * (1 - Math.cos(2 * Math.PI * phaseRatio)) * 100);

  let phaseName = 'New Moon';
  let phaseIndex = 0;

  if (normalized < 1.84566) {
    phaseName = 'New Moon';
    phaseIndex = 0;
  } else if (normalized < 5.53699) {
    phaseName = 'Waxing Crescent';
    phaseIndex = 1;
  } else if (normalized < 9.22831) {
    phaseName = 'First Quarter';
    phaseIndex = 2;
  } else if (normalized < 12.91963) {
    phaseName = 'Waxing Gibbous';
    phaseIndex = 3;
  } else if (normalized < 16.61096) {
    phaseName = 'Full Moon';
    phaseIndex = 4;
  } else if (normalized < 20.30228) {
    phaseName = 'Waning Gibbous';
    phaseIndex = 5;
  } else if (normalized < 23.99361) {
    phaseName = 'Last Quarter';
    phaseIndex = 6;
  } else if (normalized < 27.68493) {
    phaseName = 'Waning Crescent';
    phaseIndex = 7;
  } else {
    phaseName = 'New Moon';
    phaseIndex = 0;
  }

  return { phaseName, illumination, phaseIndex };
}

// Procedural Audio Engine for Nightstand Bedside Sleep
class NightstandAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseNode: AudioNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private timerInterval: any = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playSoundscape(type: 'rain' | 'theta' | 'campfire', volume: number = 0.4) {
    this.stopSoundscape();
    this.initCtx();
    if (!this.ctx) return;

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.gainNode.gain.exponentialRampToValueAtTime(volume, this.ctx.currentTime + 2.5);
    this.gainNode.connect(this.ctx.destination);

    if (type === 'rain') {
      // Pink noise bed + low-pass filter
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, this.ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(this.gainNode);
      whiteNoise.start();
      this.noiseNode = whiteNoise;

    } else if (type === 'theta') {
      // 432 Hz theta sleep binaural wave
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(108, this.ctx.currentTime); // 108Hz base
      osc2.frequency.setValueAtTime(112.5, this.ctx.currentTime); // 4.5Hz theta delta

      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(54, this.ctx.currentTime); // deep sub drone

      osc1.connect(this.gainNode);
      osc2.connect(this.gainNode);
      subOsc.connect(this.gainNode);

      osc1.start();
      osc2.start();
      subOsc.start();

      this.osc1 = osc1;
      this.osc2 = osc2;

    } else if (type === 'campfire') {
      // Campfire / warm crackle bed
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // intermittent crackle bursts
        if (Math.random() < 0.003) {
          output[i] = (Math.random() * 2 - 1) * 0.7;
        } else {
          output[i] = (Math.random() * 2 - 1) * 0.02;
        }
      }
      const crackleSource = this.ctx.createBufferSource();
      crackleSource.buffer = noiseBuffer;
      crackleSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      crackleSource.connect(filter);
      filter.connect(this.gainNode);
      crackleSource.start();
      this.noiseNode = crackleSource;
    }
  }

  public playKissChime() {
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // 528 Hz Solfeggio Love frequency harmonic chime
    osc.frequency.setValueAtTime(528, now);
    osc.frequency.exponentialRampToValueAtTime(792, now + 0.3);
    osc.frequency.exponentialRampToValueAtTime(528, now + 0.8);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 2.3);
  }

  public stopSoundscape() {
    if (this.gainNode && this.ctx) {
      try {
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.ctx.currentTime);
        this.gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);
      } catch (e) {
        // ignore
      }
    }
    setTimeout(() => {
      if (this.noiseNode) {
        try { (this.noiseNode as any).stop(); } catch (e) {}
        this.noiseNode = null;
      }
      if (this.osc1) {
        try { this.osc1.stop(); } catch (e) {}
        this.osc1 = null;
      }
      if (this.osc2) {
        try { this.osc2.stop(); } catch (e) {}
        this.osc2 = null;
      }
      this.gainNode = null;
    }, 1250);
  }
}

const audioEngine = new NightstandAudioEngine();

export const NightstandClockView: React.FC<NightstandClockViewProps> = ({
  state,
  onUpdateNightstand,
  onSendMidnightKiss,
  onNavigate
}) => {
  const nightstand = state.nightstand || {
    userStatus: { isSleeping: false, wakeAlarmAt: '07:30' },
    partnerStatus: { isSleeping: true, sleptAt: Date.now() - 35 * 60 * 1000 },
    lastMidnightKissAt: Date.now() - 15 * 60 * 1000,
    lastMidnightKissFrom: 'partner',
    ambientSoundscape: 'none',
    sleepTimerMinutes: 30
  };

  const isUserSleeping = state.activeUser === 'user'
    ? nightstand.userStatus?.isSleeping
    : nightstand.partnerStatus?.isSleeping;

  const partnerSleep = state.activeUser === 'user'
    ? nightstand.partnerStatus
    : nightstand.userStatus;

  const partnerName = state.activeUser === 'user' ? 'Partner' : 'You';

  // Local clock state
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [brightnessLevel, setBrightnessLevel] = useState<'ultra' | 'dim' | 'glow'>('dim');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [kissAnimation, setKissAnimation] = useState<boolean>(false);
  const [showNoteInput, setShowNoteInput] = useState<boolean>(false);
  const [pillowNote, setPillowNote] = useState<string>('');
  const [selectedSoundscape, setSelectedSoundscape] = useState<'none' | 'rain' | 'theta' | 'campfire'>(
    nightstand.ambientSoundscape || 'none'
  );
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);

  const moon = getMoonPhase(currentTime);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sleep countdown timer handler
  useEffect(() => {
    let interval: any = null;
    if (selectedSoundscape !== 'none' && timerRemaining !== null && timerRemaining > 0) {
      interval = setInterval(() => {
        setTimerRemaining(prev => {
          if (prev === null || prev <= 1) {
            audioEngine.stopSoundscape();
            setSelectedSoundscape('none');
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedSoundscape, timerRemaining]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      audioEngine.stopSoundscape();
    };
  }, []);

  // Format time strings
  const hours = currentTime.getHours().toString().padStart(2, '0');
  const minutes = currentTime.getMinutes().toString().padStart(2, '0');
  const seconds = currentTime.getSeconds();
  const dateStr = currentTime.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  // Calculate sleeping duration for partner
  const getSleepingDuration = (timestamp?: number) => {
    if (!timestamp) return 'just now';
    const diffMins = Math.floor((Date.now() - timestamp) / (60 * 1000));
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    const hrs = Math.floor(diffMins / 60);
    const rem = diffMins % 60;
    return `${hrs}h ${rem}m`;
  };

  const toggleSleepState = () => {
    const newIsSleeping = !isUserSleeping;
    const updatedStatus: SleepPartnerStatus = {
      isSleeping: newIsSleeping,
      sleptAt: newIsSleeping ? Date.now() : undefined,
      goodnightNote: pillowNote || undefined
    };

    let updatedNightstand: NightstandState;
    if (state.activeUser === 'user') {
      updatedNightstand = {
        ...nightstand,
        userStatus: {
          ...nightstand.userStatus,
          ...updatedStatus
        }
      };
    } else {
      updatedNightstand = {
        ...nightstand,
        partnerStatus: {
          ...nightstand.partnerStatus,
          ...updatedStatus
        }
      };
    }

    onUpdateNightstand(updatedNightstand);
    setShowNoteInput(false);

    // Haptic vibration feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([70, 40, 70]);
    }
  };

  const handleMidnightKiss = () => {
    setKissAnimation(true);
    setTimeout(() => setKissAnimation(false), 2400);

    // Silent haptic flutter
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }

    // Play whisper chime
    audioEngine.playKissChime();

    onSendMidnightKiss(pillowNote || undefined);
  };

  const handleSoundscapeChange = (type: 'none' | 'rain' | 'theta' | 'campfire') => {
    setSelectedSoundscape(type);
    if (type === 'none') {
      audioEngine.stopSoundscape();
      setTimerRemaining(null);
    } else {
      audioEngine.playSoundscape(type);
      setTimerRemaining(30 * 60); // default 30 min timer
    }

    onUpdateNightstand({
      ...nightstand,
      ambientSoundscape: type
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Brightness color themes for OLED zero-blue-light display
  const getBrightnessClasses = () => {
    switch (brightnessLevel) {
      case 'ultra':
        return {
          container: 'bg-black text-amber-600/70',
          clockGlow: 'text-amber-500/80 drop-shadow-[0_0_12px_rgba(217,119,6,0.15)]',
          subtext: 'text-amber-700/60',
          card: 'bg-neutral-950/60 border-amber-950/40 text-amber-600/70',
          buttonPrimary: 'bg-amber-950/40 border-amber-800/40 text-amber-500 hover:bg-amber-900/40',
          accent: 'text-amber-500/80'
        };
      case 'glow':
        return {
          container: 'bg-black text-amber-200',
          clockGlow: 'text-amber-300 drop-shadow-[0_0_35px_rgba(251,191,36,0.45)]',
          subtext: 'text-amber-400/80',
          card: 'bg-neutral-900/70 border-amber-500/30 text-amber-200',
          buttonPrimary: 'bg-amber-500 text-neutral-950 hover:bg-amber-400 font-semibold',
          accent: 'text-amber-300'
        };
      case 'dim':
      default:
        return {
          container: 'bg-black text-amber-400/90',
          clockGlow: 'text-amber-400 drop-shadow-[0_0_24px_rgba(245,158,11,0.3)]',
          subtext: 'text-amber-600/90',
          card: 'bg-neutral-950/90 border-amber-900/50 text-amber-400/90',
          buttonPrimary: 'bg-amber-950/80 border-amber-600/50 text-amber-300 hover:bg-amber-900/60',
          accent: 'text-amber-400'
        };
    }
  };

  const theme = getBrightnessClasses();

  return (
    <div className={`min-h-[85vh] rounded-3xl p-4 sm:p-8 transition-colors duration-700 relative overflow-hidden flex flex-col justify-between select-none ${theme.container}`}>
      {/* Visual Midnight Kiss Ripple Overlay */}
      {kissAnimation && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50 animate-fade-in">
          <div className="absolute w-96 h-96 rounded-full bg-rose-500/10 animate-ping duration-1000" />
          <div className="relative p-6 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 flex flex-col items-center space-y-2 shadow-2xl backdrop-blur-md animate-bounce">
            <Heart className="w-12 h-12 fill-rose-500 text-rose-400 animate-pulse" />
            <span className="text-xs font-serif font-medium tracking-widest uppercase text-rose-200">
              Silent Midnight Kiss Sent
            </span>
          </div>
        </div>
      )}

      {/* Top Bar: Controls & Moon Telemetry */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          {/* Moon Phase Orb SVG */}
          <div className="flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full border border-amber-900/40 bg-neutral-900/60 backdrop-blur-sm">
            <div className="relative w-6 h-6 rounded-full bg-neutral-800 overflow-hidden border border-amber-500/30 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full bg-amber-200/90 transition-transform duration-700"
                style={{
                  clipPath: moon.phaseIndex <= 4
                    ? `inset(0 ${100 - moon.illumination}% 0 0)`
                    : `inset(0 0 0 ${100 - moon.illumination}%)`
                }}
              />
              <Moon className="w-3.5 h-3.5 text-amber-950 relative z-10 opacity-70" />
            </div>
            <div className="text-[11px] leading-tight font-serif">
              <span className="font-semibold block text-amber-300/90">{moon.phaseName}</span>
              <span className={theme.subtext}>{moon.illumination}% lit • Under the same moon</span>
            </div>
          </div>
        </div>

        {/* Right side: Brightness Presets & Fullscreen */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-neutral-950/80 border border-amber-950/60 rounded-full p-0.5 text-xs">
            <button
              onClick={() => setBrightnessLevel('ultra')}
              className={`px-2.5 py-1 rounded-full text-[10px] tracking-wider uppercase transition-colors cursor-pointer ${
                brightnessLevel === 'ultra' ? 'bg-amber-900/40 text-amber-400 font-medium' : 'text-amber-700/60 hover:text-amber-500'
              }`}
              title="Ultra-dim bedside (zero blue light)"
            >
              Bedside
            </button>
            <button
              onClick={() => setBrightnessLevel('dim')}
              className={`px-2.5 py-1 rounded-full text-[10px] tracking-wider uppercase transition-colors cursor-pointer ${
                brightnessLevel === 'dim' ? 'bg-amber-900/60 text-amber-300 font-medium' : 'text-amber-700/60 hover:text-amber-400'
              }`}
              title="Warm candle glow"
            >
              Candle
            </button>
            <button
              onClick={() => setBrightnessLevel('glow')}
              className={`px-2.5 py-1 rounded-full text-[10px] tracking-wider uppercase transition-colors cursor-pointer ${
                brightnessLevel === 'glow' ? 'bg-amber-500/30 text-amber-200 font-medium' : 'text-amber-700/60 hover:text-amber-300'
              }`}
              title="Room glow"
            >
              Glow
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full border border-amber-950/60 bg-neutral-950/80 text-amber-600 hover:text-amber-400 transition-colors cursor-pointer"
            title="Toggle fullscreen dock"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Center: Large Minimalist Glowing Clock Face */}
      <div className="my-auto py-8 sm:py-14 text-center z-10 flex flex-col items-center">
        {/* Living Partner Status Pill */}
        <div className="mb-6 inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full border border-amber-900/50 bg-neutral-950/80 backdrop-blur-md shadow-lg">
          <div className="relative flex items-center justify-center">
            {partnerSleep?.isSleeping ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="absolute w-4 h-4 rounded-full bg-indigo-500/40 animate-ping" />
              </>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            )}
          </div>
          <span className="text-xs font-serif tracking-wide text-amber-200/90">
            {partnerSleep?.isSleeping ? (
              <>
                <span className="font-semibold text-indigo-300">{partnerName}</span> is resting in dreamland{' '}
                <span className={theme.subtext}>({getSleepingDuration(partnerSleep.sleptAt)})</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-emerald-300">{partnerName}</span> is still awake beside the lamp
              </>
            )}
          </span>
        </div>

        {/* The Digital Glowing Clock */}
        <div className="relative inline-block font-mono tracking-tight">
          <div className={`text-6xl sm:text-8xl md:text-9xl font-light select-none transition-all duration-500 ${theme.clockGlow}`}>
            <span>{hours}</span>
            <span className={`inline-block transition-opacity duration-300 ${seconds % 2 === 0 ? 'opacity-90' : 'opacity-30'}`}>:</span>
            <span>{minutes}</span>
          </div>

          {/* Seconds breathing dot line */}
          <div className="w-full h-1 bg-amber-950/40 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-amber-500/70 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${((seconds + 1) / 60) * 100}%` }}
            />
          </div>
        </div>

        {/* Date Display */}
        <div className={`mt-4 font-serif text-sm sm:text-base tracking-widest uppercase ${theme.subtext}`}>
          {dateStr}
        </div>

        {/* Pillow Note (if left by partner) */}
        {partnerSleep?.goodnightNote && (
          <div className="mt-4 max-w-md px-4 py-2 rounded-2xl border border-amber-900/40 bg-neutral-900/40 backdrop-blur-sm text-center">
            <p className="text-xs font-serif italic text-amber-300/80">
              “{partnerSleep.goodnightNote}”
            </p>
            <span className="text-[10px] uppercase tracking-wider text-amber-600/70 mt-0.5 block">
              — {partnerName}'s pillow note
            </span>
          </div>
        )}
      </div>

      {/* Bottom Section: Dual Actions & Audio Soundscape Deck */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end z-10">
        {/* Card 1: Sleep Status Toggle */}
        <div className={`p-4 rounded-2xl border ${theme.card} flex flex-col justify-between space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bed className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">Your Rest Status</span>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
              isUserSleeping
                ? 'bg-indigo-950/80 border-indigo-700/50 text-indigo-300'
                : 'bg-amber-950/60 border-amber-700/40 text-amber-400'
            }`}>
              {isUserSleeping ? 'Sleeping' : 'Awake'}
            </span>
          </div>

          <p className="text-xs font-serif text-amber-400/70">
            {isUserSleeping
              ? 'Your presence is resting. Partner can see you are safe in dreamland.'
              : 'Tap to mark yourself asleep so your partner knows you are resting.'}
          </p>

          {showNoteInput ? (
            <div className="space-y-2">
              <input
                type="text"
                value={pillowNote}
                onChange={e => setPillowNote(e.target.value)}
                placeholder="Leave a sweet pillow note..."
                maxLength={80}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-neutral-900 border border-amber-900/60 text-amber-200 placeholder-amber-800/50 focus:outline-none focus:border-amber-500"
              />
              <div className="flex space-x-2">
                <button
                  onClick={toggleSleepState}
                  className="flex-1 py-1.5 rounded-xl bg-amber-500 text-neutral-950 text-xs font-medium hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Confirm Sleep
                </button>
                <button
                  onClick={() => setShowNoteInput(false)}
                  className="px-3 py-1.5 rounded-xl border border-amber-900/60 text-amber-500 text-xs hover:bg-neutral-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={toggleSleepState}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center justify-center space-x-2 ${
                  isUserSleeping
                    ? 'border-indigo-800/50 bg-indigo-950/50 text-indigo-200 hover:bg-indigo-900/60'
                    : theme.buttonPrimary
                }`}
              >
                {isUserSleeping ? (
                  <>
                    <Sun className="w-3.5 h-3.5 mr-1" />
                    <span>I'm Waking Up</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 mr-1" />
                    <span>I'm Going to Sleep</span>
                  </>
                )}
              </button>

              {!isUserSleeping && (
                <button
                  onClick={() => setShowNoteInput(true)}
                  className="p-2 rounded-xl border border-amber-900/60 bg-neutral-950 text-amber-500 hover:text-amber-300 hover:border-amber-700 transition-colors cursor-pointer"
                  title="Add a pillow note"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Card 2: Silent Midnight Kiss 💋 */}
        <div className={`p-4 rounded-2xl border ${theme.card} flex flex-col items-center text-center space-y-3`}>
          <div className="flex items-center space-x-2">
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-300">
              Silent Midnight Kiss
            </span>
          </div>

          <p className="text-xs font-serif text-amber-400/70">
            Sends a silent haptic flutter and soft glow without waking them up with bright alerts.
          </p>

          <button
            onClick={handleMidnightKiss}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-600/80 to-amber-700/80 border border-rose-400/40 text-rose-100 flex items-center justify-center shadow-lg shadow-rose-950/60 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Send silent midnight kiss"
          >
            <Heart className="w-7 h-7 fill-rose-300 group-hover:scale-110 transition-transform" />
          </button>

          <span className="text-[10px] text-amber-600/80 font-serif">
            {nightstand.lastMidnightKissAt ? (
              <>
                Last exchanged{' '}
                {new Date(nightstand.lastMidnightKissAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                by {nightstand.lastMidnightKissFrom === state.activeUser ? 'You' : partnerName}
              </>
            ) : (
              'Tap to exchange your midnight kiss'
            )}
          </span>
        </div>

        {/* Card 3: Procedural Ambient Sleep Soundscapes */}
        <div className={`p-4 rounded-2xl border ${theme.card} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
                Sleep Soundscape
              </span>
            </div>
            {timerRemaining !== null && (
              <span className="text-[10px] font-mono text-amber-400/80">
                {Math.floor(timerRemaining / 60)}:{(timerRemaining % 60).toString().padStart(2, '0')} left
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => handleSoundscapeChange(selectedSoundscape === 'rain' ? 'none' : 'rain')}
              className={`py-1.5 px-2 rounded-xl text-xs font-serif transition-colors cursor-pointer border ${
                selectedSoundscape === 'rain'
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-medium'
                  : 'bg-neutral-900/60 border-amber-950/60 text-amber-500/80 hover:bg-neutral-800'
              }`}
            >
              🌧️ Rain
            </button>
            <button
              onClick={() => handleSoundscapeChange(selectedSoundscape === 'theta' ? 'none' : 'theta')}
              className={`py-1.5 px-2 rounded-xl text-xs font-serif transition-colors cursor-pointer border ${
                selectedSoundscape === 'theta'
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-medium'
                  : 'bg-neutral-900/60 border-amber-950/60 text-amber-500/80 hover:bg-neutral-800'
              }`}
            >
              🌌 Theta
            </button>
            <button
              onClick={() => handleSoundscapeChange(selectedSoundscape === 'campfire' ? 'none' : 'campfire')}
              className={`py-1.5 px-2 rounded-xl text-xs font-serif transition-colors cursor-pointer border ${
                selectedSoundscape === 'campfire'
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-medium'
                  : 'bg-neutral-900/60 border-amber-950/60 text-amber-500/80 hover:bg-neutral-800'
              }`}
            >
              🕯️ Ember
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-serif text-amber-600/80">
              {selectedSoundscape === 'none' ? 'Soundscape off' : '30-min sleep fade active'}
            </span>
            {selectedSoundscape !== 'none' && (
              <button
                onClick={() => handleSoundscapeChange('none')}
                className="text-[11px] text-amber-400 hover:underline cursor-pointer flex items-center space-x-1"
              >
                <VolumeX className="w-3 h-3 mr-1" />
                <span>Silence</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
