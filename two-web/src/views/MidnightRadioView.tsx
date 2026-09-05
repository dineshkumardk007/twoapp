import React, { useState, useEffect, useRef } from 'react';
import { SpaceState } from '../core/storage';
import {
  MidnightRadioState,
  MidnightRadioStationId,
  RadioWhisper
} from '../types';
import {
  Radio,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Send,
  Heart,
  Sparkles,
  Users,
  Clock,
  Music,
  Share2,
  Sliders,
  Flame,
  CloudRain,
  Coffee,
  Disc
} from 'lucide-react';

interface MidnightRadioViewProps {
  state: SpaceState;
  onUpdateRadio: (updated: MidnightRadioState) => void;
  onSendRadioWhisper: (text: string) => void;
  onSendToChat?: (text: string) => void;
}

interface StationDefinition {
  id: MidnightRadioStationId;
  name: string;
  frequency: string;
  genre: string;
  tagline: string;
  themeColor: string;
  accentClass: string;
  icon: any;
}

const STATIONS: StationDefinition[] = [
  {
    id: 'tokyo_rain',
    name: 'Tokyo Midnight Rain',
    frequency: '88.5 FM',
    genre: 'Lo-Fi Jazz & Warm Drizzle',
    tagline: 'Muffled streetlamps, tape hiss, and slow jazz Rhodes chords.',
    themeColor: '#38bdf8',
    accentClass: 'text-sky-400 border-sky-500/40 bg-sky-950/30',
    icon: CloudRain
  },
  {
    id: 'hearthside',
    name: 'Cottage Hearthside',
    frequency: '94.2 FM',
    genre: 'Acoustic Folk & Crackling Embers',
    tagline: 'Gentle fingerpicked guitar beside a crackling brick fireplace.',
    themeColor: '#f59e0b',
    accentClass: 'text-amber-400 border-amber-500/40 bg-amber-950/30',
    icon: Flame
  },
  {
    id: 'cosmic_528',
    name: 'Cosmic Resonance',
    frequency: '103.8 FM',
    genre: '528Hz Solfeggio Love Frequency',
    tagline: 'Deep meditative sub-pads tuned to emotional repair and deep rest.',
    themeColor: '#a855f7',
    accentClass: 'text-purple-400 border-purple-500/40 bg-purple-950/30',
    icon: Sparkles
  },
  {
    id: 'sunday_cafe',
    name: 'Sunday Morning Café',
    frequency: '107.1 FM',
    genre: 'Warm Rhodes & Gentle Sunlight',
    tagline: 'Slow morning pour-over, cozy sunlight, and warm acoustic warmth.',
    themeColor: '#fb923c',
    accentClass: 'text-orange-400 border-orange-500/40 bg-orange-950/30',
    icon: Coffee
  }
];

// Procedural Lo-Fi & Generative Music Synthesizer
class ProceduralRadioSynthesizer {
  private ctx: AudioContext | null = null;
  private isRunning = false;
  private currentStation: MidnightRadioStationId = 'tokyo_rain';
  private masterGain: GainNode | null = null;
  private noiseNode: AudioNode | null = null;
  private loopInterval: any = null;
  private currentVolume = 0.6;

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.currentVolume = vol;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }

  public start(station: MidnightRadioStationId, volume = 0.6) {
    this.stop();
    this.initCtx();
    if (!this.ctx) return;

    this.isRunning = true;
    this.currentStation = station;
    this.currentVolume = volume;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.masterGain.gain.exponentialRampToValueAtTime(volume, this.ctx.currentTime + 1.5);
    this.masterGain.connect(this.ctx.destination);

    if (station === 'tokyo_rain') {
      this.startTokyoRain();
    } else if (station === 'hearthside') {
      this.startHearthside();
    } else if (station === 'cosmic_528') {
      this.startCosmic528();
    } else if (station === 'sunday_cafe') {
      this.startSundayCafe();
    }
  }

  // Station 1: Tokyo Midnight Rain (Vinyl crackle + rain + Rhodes jazz chords)
  private startTokyoRain() {
    if (!this.ctx || !this.masterGain) return;

    // 1. Rain and Vinyl Noise Bed
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Soft vinyl clicks
      const crackle = Math.random() < 0.002 ? (Math.random() * 2 - 1) * 0.4 : 0;
      data[i] = white * 0.03 + crackle;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, this.ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(this.masterGain);
    noiseSource.start();
    this.noiseNode = noiseSource;

    // 2. Repeating Jazz Chord Progression: Fmaj9 -> Em9 -> Dm9 -> Cmaj7
    const chords = [
      [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
      [164.81, 196.0, 246.94, 293.66, 370.0], // Em9
      [146.83, 174.61, 220.0, 261.63, 329.63], // Dm9
      [130.81, 164.81, 196.0, 246.94, 293.66]  // Cmaj9
    ];

    let chordIdx = 0;
    const playChord = () => {
      if (!this.ctx || !this.isRunning || !this.masterGain) return;
      const notes = chords[chordIdx];
      chordIdx = (chordIdx + 1) % chords.length;

      const now = this.ctx.currentTime;
      notes.forEach((freq, i) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const chordGain = this.ctx.createGain();

        // Warm Rhodes-like sine + slight triangle overtone
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);

        chordGain.gain.setValueAtTime(0.0001, now);
        chordGain.gain.linearRampToValueAtTime(0.045, now + 0.15 + i * 0.04);
        chordGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

        osc.connect(chordGain);
        chordGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 4.0);
      });
    };

    playChord();
    this.loopInterval = setInterval(playChord, 4200);
  }

  // Station 2: Cottage Hearthside (Wood crackle + acoustic fingerpicking)
  private startHearthside() {
    if (!this.ctx || !this.masterGain) return;

    // Fireplace crackle bed
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      if (Math.random() < 0.004) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      } else {
        data[i] = (Math.random() * 2 - 1) * 0.015;
      }
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.masterGain);
    noise.start();
    this.noiseNode = noise;

    // Folk Acoustic Plucks (D - A - Bm - G arpeggios)
    const arpeggios = [
      [146.83, 220.0, 293.66, 369.99, 440.0],
      [110.0, 164.81, 220.0, 277.18, 329.63],
      [123.47, 185.0, 246.94, 293.66, 369.99],
      [98.0, 146.83, 196.0, 246.94, 293.66]
    ];

    let patternIdx = 0;
    const playPluckSequence = () => {
      if (!this.ctx || !this.isRunning || !this.masterGain) return;
      const notes = arpeggios[patternIdx];
      patternIdx = (patternIdx + 1) % arpeggios.length;

      const baseNow = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const noteTime = baseNow + idx * 0.38;
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        noteGain.gain.setValueAtTime(0.0001, noteTime);
        noteGain.gain.linearRampToValueAtTime(0.05, noteTime + 0.03);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.2);

        osc.connect(noteGain);
        noteGain.connect(this.masterGain);

        osc.start(noteTime);
        osc.stop(noteTime + 1.3);
      });
    };

    playPluckSequence();
    this.loopInterval = setInterval(playPluckSequence, 3200);
  }

  // Station 3: Cosmic Resonance (528Hz Solfeggio Love Frequency & Deep Pad)
  private startCosmic528() {
    if (!this.ctx || !this.masterGain) return;

    // 528Hz primary sine oscillator
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();

    osc1.type = 'sine';
    osc2.type = 'sine';
    subOsc.type = 'sine';

    osc1.frequency.setValueAtTime(528, this.ctx.currentTime); // 528Hz Solfeggio
    osc2.frequency.setValueAtTime(530.5, this.ctx.currentTime); // 2.5Hz binaural wave
    subOsc.frequency.setValueAtTime(132, this.ctx.currentTime); // 2 octaves down sub

    const padGain = this.ctx.createGain();
    padGain.gain.setValueAtTime(0.035, this.ctx.currentTime);

    osc1.connect(padGain);
    osc2.connect(padGain);
    subOsc.connect(padGain);
    padGain.connect(this.masterGain);

    osc1.start();
    osc2.start();
    subOsc.start();
    this.noiseNode = osc1;

    // Periodic soft celestial bell overtone
    const bellPitches = [792, 1056, 1320, 1584];
    const ringBell = () => {
      if (!this.ctx || !this.isRunning || !this.masterGain) return;
      const pitch = bellPitches[Math.floor(Math.random() * bellPitches.length)];
      const now = this.ctx.currentTime;
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();

      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(pitch, now);

      bGain.gain.setValueAtTime(0.0001, now);
      bGain.gain.linearRampToValueAtTime(0.02, now + 0.1);
      bGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      bOsc.connect(bGain);
      bGain.connect(this.masterGain);

      bOsc.start(now);
      bOsc.stop(now + 3.1);
    };

    ringBell();
    this.loopInterval = setInterval(ringBell, 4500);
  }

  // Station 4: Sunday Morning Cafe (Warm Rhodes & Room Presence)
  private startSundayCafe() {
    if (!this.ctx || !this.masterGain) return;

    // Gentle room presence
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.015;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.masterGain);
    noise.start();
    this.noiseNode = noise;

    // Warm Sunday Chords (Gmaj7 -> Cmaj7 -> Am7 -> D7)
    const chords = [
      [196.0, 246.94, 293.66, 369.99],
      [130.81, 164.81, 196.0, 246.94],
      [220.0, 261.63, 329.63, 392.0],
      [146.83, 185.0, 220.0, 261.63]
    ];

    let idx = 0;
    const playMorningChord = () => {
      if (!this.ctx || !this.isRunning || !this.masterGain) return;
      const notes = chords[idx];
      idx = (idx + 1) % chords.length;

      const now = this.ctx.currentTime;
      notes.forEach((f, i) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.05);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.04, now + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

        osc.connect(g);
        g.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 3.4);
      });
    };

    playMorningChord();
    this.loopInterval = setInterval(playMorningChord, 3800);
  }

  public stop() {
    this.isRunning = false;
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
        this.masterGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
      } catch (e) {}
    }
    setTimeout(() => {
      if (this.noiseNode) {
        try { (this.noiseNode as any).stop(); } catch (e) {}
        this.noiseNode = null;
      }
      this.masterGain = null;
    }, 850);
  }
}

const radioSynth = new ProceduralRadioSynthesizer();

export const MidnightRadioView: React.FC<MidnightRadioViewProps> = ({
  state,
  onUpdateRadio,
  onSendRadioWhisper,
  onSendToChat
}) => {
  const radio = state.midnightRadio || {
    isPlaying: false,
    stationId: 'tokyo_rain',
    startedAt: Date.now(),
    volume: 0.6,
    userListening: false,
    partnerListening: true,
    whispers: []
  };

  const partnerName = state.activeUser === 'user' ? 'Partner' : 'You';
  const isUserListening = state.activeUser === 'user' ? radio.userListening : radio.partnerListening;
  const isPartnerListening = state.activeUser === 'user' ? radio.partnerListening : radio.userListening;

  const [whisperInput, setWhisperInput] = useState('');
  const [volume, setVolume] = useState<number>(radio.volume || 0.6);
  const [sleepMinutesRemaining, setSleepMinutesRemaining] = useState<number | null>(null);

  // Equalizer spectrum visualization state
  const [eqHeights, setEqHeights] = useState<number[]>(new Array(20).fill(15));

  const currentStationMeta = STATIONS.find(s => s.id === radio.stationId) || STATIONS[0];

  // Equalizer animation loop when playing
  useEffect(() => {
    let animId: any;
    if (radio.isPlaying) {
      const animate = () => {
        setEqHeights(prev =>
          prev.map(() => Math.floor(Math.random() * 55) + 15)
        );
        animId = setTimeout(animate, 120);
      };
      animate();
    } else {
      setEqHeights(new Array(20).fill(6));
    }
    return () => {
      if (animId) clearTimeout(animId);
    };
  }, [radio.isPlaying]);

  // Handle sleep timer countdown
  useEffect(() => {
    let timer: any = null;
    if (radio.isPlaying && sleepMinutesRemaining !== null && sleepMinutesRemaining > 0) {
      timer = setInterval(() => {
        setSleepMinutesRemaining(prev => {
          if (prev === null || prev <= 1) {
            handleTogglePlay(false);
            return null;
          }
          return prev - 1;
        });
      }, 60000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [radio.isPlaying, sleepMinutesRemaining]);

  // Synchronize audio synthesis with radio.isPlaying and radio.stationId
  useEffect(() => {
    if (radio.isPlaying) {
      radioSynth.start(radio.stationId, volume);
    } else {
      radioSynth.stop();
    }
    return () => {
      radioSynth.stop();
    };
  }, [radio.isPlaying, radio.stationId]);

  const handleTogglePlay = (forceState?: boolean) => {
    const nextIsPlaying = forceState !== undefined ? forceState : !radio.isPlaying;

    let updatedRadio: MidnightRadioState;
    if (state.activeUser === 'user') {
      updatedRadio = {
        ...radio,
        isPlaying: nextIsPlaying,
        userListening: nextIsPlaying,
        startedAt: nextIsPlaying ? Date.now() : radio.startedAt
      };
    } else {
      updatedRadio = {
        ...radio,
        isPlaying: nextIsPlaying,
        partnerListening: nextIsPlaying,
        startedAt: nextIsPlaying ? Date.now() : radio.startedAt
      };
    }

    onUpdateRadio(updatedRadio);

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([60, 30, 60]);
    }
  };

  const handleSelectStation = (stationId: MidnightRadioStationId) => {
    if (stationId === radio.stationId) return;

    const updatedRadio: MidnightRadioState = {
      ...radio,
      stationId,
      isPlaying: true, // auto play on tune
      startedAt: Date.now()
    };

    onUpdateRadio(updatedRadio);

    if ('vibrate' in navigator) {
      navigator.vibrate([80]);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    radioSynth.setVolume(newVol);
    onUpdateRadio({
      ...radio,
      volume: newVol
    });
  };

  const handleSendWhisper = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whisperInput.trim()) return;

    onSendRadioWhisper(whisperInput.trim());
    setWhisperInput('');

    if ('vibrate' in navigator) {
      navigator.vibrate([70, 50, 100]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Relational Philosophy */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              Midnight Airwaves
            </span>
          </div>
          <h2 className="font-serif text-2xl font-bold text-linen-primary mt-1">
            Midnight Radio
          </h2>
          <p className="text-xs text-linen-secondary mt-0.5">
            Private synchronized lo-fi & atmospheric soundscapes. Both lovers listening to the exact same chord, in real-time.
          </p>
        </div>

        {/* Dual Listener Synchrony Pill */}
        <div className="inline-flex items-center space-x-2.5 px-4 py-2 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50/50 shadow-xs self-start sm:self-auto">
          <div className="relative flex items-center justify-center">
            {radio.isPlaying ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="absolute w-4 h-4 rounded-full bg-emerald-500/40 animate-ping" />
              </>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            )}
          </div>
          <div className="text-xs font-serif text-linen-primary">
            {radio.isPlaying && isPartnerListening ? (
              <span className="font-medium text-emerald-800">
                ✨ Both listening together in sync
              </span>
            ) : radio.isPlaying ? (
              <span>You are tuned in • Waiting for {partnerName}</span>
            ) : (
              <span className="text-linen-secondary">Tuned off • Tap Play to start shared session</span>
            )}
          </div>
        </div>
      </div>

      {/* Vintage Wooden Chassis & Analog Vacuum Tube Radio UI */}
      <div className="rounded-3xl border-4 border-[#2b2219] bg-gradient-to-b from-[#1c1712] via-[#14100c] to-[#0a0806] p-6 sm:p-8 shadow-2xl text-amber-100 relative overflow-hidden select-none">
        {/* Brass corner trim highlights */}
        <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-amber-600/40 rounded-tl-lg pointer-events-none" />
        <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-amber-600/40 rounded-tr-lg pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-amber-600/40 rounded-bl-lg pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-amber-600/40 rounded-br-lg pointer-events-none" />

        {/* Top: Station Frequency Display & Vacuum Tubes */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-amber-900/40">
          {/* Backlit Analog Dial Screen */}
          <div className="w-full sm:w-2/3 bg-black/80 rounded-2xl border border-amber-500/30 p-4 shadow-inner relative overflow-hidden">
            {/* Ambient amber glow wash */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/15 to-amber-500/10 pointer-events-none" />

            <div className="flex items-center justify-between relative z-10 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500/80">
                Hi-Fi Vacuum Tube Stereo Receiver
              </span>
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${radio.isPlaying ? 'bg-amber-400 animate-pulse' : 'bg-amber-950'}`} />
                <span className="text-[10px] font-mono text-amber-400">
                  {radio.isPlaying ? 'STEREO SYNC' : 'STANDBY'}
                </span>
              </div>
            </div>

            <div className="flex items-baseline justify-between relative z-10">
              <div>
                <h3 className="font-mono text-3xl sm:text-4xl font-light text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]">
                  {currentStationMeta.frequency}
                </h3>
                <p className="font-serif text-sm sm:text-base text-amber-100 font-medium mt-0.5">
                  {currentStationMeta.name}
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-serif px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-950/60 text-amber-300">
                  {currentStationMeta.genre}
                </span>
                <p className="text-[11px] text-amber-500/70 font-serif italic mt-1 max-w-[200px] hidden sm:block">
                  {currentStationMeta.tagline}
                </p>
              </div>
            </div>

            {/* Floating Live Radio Whisper Ticker */}
            {radio.whispers && radio.whispers.length > 0 && (
              <div className="mt-3 pt-2 border-t border-amber-900/50 flex items-center space-x-2 text-xs font-serif text-amber-200/90 animate-fade-in relative z-10">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 shrink-0 animate-pulse" />
                <span className="truncate">
                  <strong className="text-amber-400">{radio.whispers[0].senderName}:</strong> “{radio.whispers[0].text}”
                </span>
              </div>
            )}
          </div>

          {/* Glowing Vacuum Tube Orbs */}
          <div className="flex items-center space-x-4 shrink-0">
            {[1, 2].map(tubeNum => (
              <div key={tubeNum} className="flex flex-col items-center">
                <div className="relative w-10 h-20 rounded-t-full border-2 border-amber-500/40 bg-gradient-to-b from-amber-900/20 via-black to-neutral-950 p-1 flex flex-col items-center justify-center overflow-hidden shadow-lg">
                  {/* Glowing cathode filament */}
                  <div
                    className={`w-1 transition-all duration-700 rounded-full ${
                      radio.isPlaying
                        ? 'h-10 bg-amber-400 shadow-[0_0_18px_#f59e0b]'
                        : 'h-4 bg-amber-900/60'
                    }`}
                  />
                  <div className="absolute bottom-1 w-6 h-2 rounded-sm bg-amber-950/80 border border-amber-700/50" />
                </div>
                <span className="text-[9px] font-mono uppercase text-amber-700 mt-1">12AX7A</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Interactive Tuner Ribbon */}
        <div className="py-6">
          <div className="text-[11px] font-mono text-amber-600/80 uppercase tracking-widest mb-2 flex items-center justify-between">
            <span>Analog Station Frequency Band</span>
            <span>AM / FM Dial</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {STATIONS.map(station => {
              const isCurrent = station.id === radio.stationId;
              const IconComponent = station.icon;
              return (
                <button
                  key={station.id}
                  onClick={() => handleSelectStation(station.id)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    isCurrent
                      ? `${station.accentClass} shadow-md`
                      : 'border-amber-950/60 bg-neutral-950/60 hover:bg-neutral-900/60 text-amber-600/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-semibold">{station.frequency}</span>
                    <IconComponent className="w-4 h-4 opacity-80 group-hover:scale-110 transition-transform" />
                  </div>
                  <h4 className="font-serif text-sm font-medium text-amber-100 truncate">
                    {station.name}
                  </h4>
                  <p className="text-[10px] text-amber-500/70 truncate mt-0.5">
                    {station.genre}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Bar: Spectrum Equalizer + Transport Controls */}
        <div className="pt-4 border-t border-amber-900/40 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Animated 20-Band Frequency Equalizer */}
          <div className="w-full md:w-1/3 flex items-end justify-between h-14 bg-black/60 rounded-2xl border border-amber-950/60 p-2.5 overflow-hidden">
            {eqHeights.map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-t-sm transition-all duration-100"
                style={{
                  height: `${h}%`,
                  backgroundColor: radio.isPlaying ? currentStationMeta.themeColor : '#451a03'
                }}
              />
            ))}
          </div>

          {/* Master Transport Play/Pause + Volume */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleTogglePlay()}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-900/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title={radio.isPlaying ? 'Pause Station' : 'Broadcast Live Station'}
            >
              {radio.isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>

            {/* Volume Slider */}
            <div className="flex items-center space-x-2 bg-neutral-950/80 px-3 py-2 rounded-2xl border border-amber-950/60">
              <button
                onClick={() => handleVolumeChange(volume > 0 ? 0 : 0.6)}
                className="text-amber-500 hover:text-amber-300 transition-colors cursor-pointer"
              >
                {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 sm:w-24 accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Sleep Timer Preset & Send Station to Chat */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSleepMinutesRemaining(prev => (prev === 30 ? null : 30))}
              className={`px-3 py-2 rounded-2xl border text-xs font-serif transition-colors cursor-pointer flex items-center space-x-1.5 ${
                sleepMinutesRemaining !== null
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-amber-950/60 bg-neutral-950/60 text-amber-500/80 hover:bg-neutral-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{sleepMinutesRemaining ? `${sleepMinutesRemaining}m Timer` : '30m Sleep'}</span>
            </button>

            {onSendToChat && (
              <button
                onClick={() => onSendToChat(`📻 Listening to "${currentStationMeta.name}" (${currentStationMeta.frequency}) on Midnight Radio. Come listen with me.`)}
                className="p-2 rounded-2xl border border-amber-950/60 bg-neutral-950/60 text-amber-500 hover:text-amber-300 hover:bg-neutral-900 transition-colors cursor-pointer"
                title="Share Station in Chat"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Whisper into the Radio Form */}
      <div className="rounded-3xl border border-linen-border bg-linen-surface p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            <h3 className="font-serif text-sm font-semibold text-linen-primary">
              Whisper onto the Airwaves
            </h3>
          </div>
          <span className="text-[11px] text-linen-secondary">
            Floats silently across the analog tuner without pausing music
          </span>
        </div>

        <form onSubmit={handleSendWhisper} className="flex space-x-2">
          <input
            type="text"
            value={whisperInput}
            onChange={e => setWhisperInput(e.target.value)}
            placeholder="Whisper a warm thought onto the dial..."
            maxLength={90}
            className="flex-1 px-4 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary placeholder-linen-secondary/60 focus:outline-none focus:border-amber-600"
          />
          <button
            type="submit"
            disabled={!whisperInput.trim()}
            className="px-4 py-2 rounded-2xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer flex items-center space-x-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>

        {/* History of Recent Airwave Whispers */}
        {radio.whispers && radio.whispers.length > 0 && (
          <div className="mt-4 pt-3 border-t border-linen-border space-y-2">
            <span className="text-[10px] font-serif uppercase tracking-wider text-linen-secondary block">
              Recent Airwave Whispers
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {radio.whispers.slice(0, 5).map(whisper => (
                <div
                  key={whisper.id}
                  className="p-2.5 rounded-xl bg-linen-variant/40 border border-linen-border/60 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-linen-primary">{whisper.senderName}:</span>
                    <span className="font-serif italic text-linen-secondary">“{whisper.text}”</span>
                  </div>
                  <span className="text-[10px] text-linen-secondary shrink-0">
                    {new Date(whisper.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
