import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SpaceState } from '../core/storage';
import {
  LiveRadioStation,
  MidnightRadioState,
  MidnightRadioStationId,
  RadioWhisper
} from '../types';
import { ambientAudioCoordinator } from '../core/ambientAudioCoordinator';
import { liveRadio, LiveRadioStatus } from '../core/liveRadio';
import { TAMIL_FM, cleanStation, sameStation, searchTamilStations } from '../core/liveStations';
import { toggleFavorite } from '../core/radioSync';
import { who } from '../core/who';
import { Session, liveContext } from '../core/ambient/kit';
import { startPreset } from '../core/ambient/presets';
import {
  Radio,
  Play,
  Pause,
  Square,
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
  Disc,
  Star,
  Search,
  Loader2,
  SkipForward
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

/**
 * The radio: four stations of live, never-repeating music - a lo-fi electric
 * piano in the rain, fingerpicked guitar by a fire, a deep meditative pad,
 * and a Sunday-morning cafe. Built in ambient/ (see presets.ts and music.ts)
 * and played through the shared context.
 *
 * Every note used to be kept in a list until the station was stopped, so an
 * evening of radio held thousands of finished oscillators. Notes now let go
 * of themselves when they end.
 */
class ProceduralRadioSynthesizer {
  private session: Session | null = null;
  private currentVolume = 0.6;

  public setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    this.session?.bus.setVolume(this.currentVolume);
  }

  public stop(immediate = true) {
    if (!this.session) return;
    // Even "immediate" fades for a moment: a hard stop is a click.
    this.session.stop(immediate ? 0.08 : 0.8);
    this.session = null;
    ambientAudioCoordinator.notifyStopped('midnight_radio');
  }

  public start(station: MidnightRadioStationId, volume = 0.6) {
    this.session?.stop(0.5);
    this.session = null;
    const ctx = liveContext();
    if (!ctx) return;
    this.currentVolume = volume;
    this.session = startPreset(ctx, station, volume, 1.2);
    ambientAudioCoordinator.notifyRadioPlaying();
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

  // Live radio: the station and favourites come from the shared state - from
  // the partner's phone, possibly - so they are checked before use.
  const band = radio.band === 'live' ? 'live' : 'two';
  const liveStation = useMemo(() => cleanStation(radio.liveStation), [radio.liveStation]);
  const liveFavorites = useMemo(
    () => (Array.isArray(radio.liveFavorites) ? radio.liveFavorites : []).map(cleanStation).filter((s): s is LiveRadioStation => !!s),
    [radio.liveFavorites]
  );
  const onLive = band === 'live' && !!liveStation;

  // Live radio plays on when you leave this screen (and, in the Android app,
  // with the app in the background); coming back, the dial picks it up.
  const liveAlreadyOn = onLive && liveRadio.state !== 'idle' && sameStation(liveRadio.current, liveStation);

  const [whisperInput, setWhisperInput] = useState('');
  const [volume, setVolume] = useState<number>(radio.volume || 0.6);
  const [sleepMinutesRemaining, setSleepMinutesRemaining] = useState<number | null>(() =>
    liveAlreadyOn && liveRadio.sleepsAt ? Math.max(1, Math.ceil((liveRadio.sleepsAt - Date.now()) / 60_000)) : null
  );
  const [isLocalTunedIn, setIsLocalTunedIn] = useState<boolean>(liveAlreadyOn);
  /** Which band's stations are on show; follows the shared band when it changes. */
  const [viewBand, setViewBand] = useState<'two' | 'live'>(band);
  const [liveStatus, setLiveStatus] = useState<LiveRadioStatus>(liveRadio.state);

  // Equalizer spectrum visualization state
  const [eqHeights, setEqHeights] = useState<number[]>(new Array(20).fill(6));

  const currentStationMeta = STATIONS.find(s => s.id === radio.stationId) || STATIONS[0];
  const nowName = onLive ? liveStation!.name : currentStationMeta.name;
  const soundOn = isLocalTunedIn && (!onLive || liveStatus === 'playing');

  /** What this phone is playing right now, so a repeat of the same request changes nothing. */
  const playingRef = useRef<string | null>(liveAlreadyOn ? `live:${liveStation!.url}` : null);
  /** The radio as it is now, for what runs from a timer or a callback set up earlier. */
  const radioRef = useRef(radio);
  radioRef.current = radio;
  const onUpdateRadioRef = useRef(onUpdateRadio);
  onUpdateRadioRef.current = onUpdateRadio;
  const activeUserRef = useRef(state.activeUser);
  activeUserRef.current = state.activeUser;

  const listening = (on: boolean): Pick<MidnightRadioState, 'userListening' | 'partnerListening'> => ({
    userListening: state.activeUser === 'user' ? on : radio.userListening,
    partnerListening: state.activeUser !== 'user' ? on : radio.partnerListening
  });

  /** Plays whatever the dial says - Two's own station, or the live one. */
  const startLocal = (target: MidnightRadioState = radio, fromTap = true) => {
    const live = target.band === 'live' ? cleanStation(target.liveStation) : null;
    const key = live ? `live:${live.url}` : `two:${target.stationId}`;
    if (playingRef.current === key) {
      // Already on. A live station off air, or waiting for a tap, is tried
      // again; one playing carries on (the player knows the difference).
      // One paused from outside - headphones pulled out, say - waits for a
      // tap here: opening this screen must not start it out loud.
      if (live && (fromTap || liveRadio.state !== 'paused')) liveRadio.play(live, volume);
      return;
    }
    playingRef.current = key;
    if (live) {
      radioSynth.stop(true);
      liveRadio.play(live, volume);
    } else {
      liveRadio.stop();
      radioSynth.start(target.stationId, volume);
    }
  };

  const stopLocal = () => {
    playingRef.current = null;
    radioSynth.stop(true);
    liveRadio.stop();
  };

  // Register with ambientAudioCoordinator and cleanup on unmount
  useEffect(() => {
    ambientAudioCoordinator.registerRadio(() => {
      setIsLocalTunedIn(false);
      stopLocal();
    });

    return () => {
      // Two's own stations stop with the screen. Live radio plays on - that
      // is the point of a radio - until it is stopped here, from the
      // notification, by the sleep timer, or by another ambience starting.
      radioSynth.stop(true);
      if (playingRef.current?.startsWith('two:')) playingRef.current = null;
    };
  }, []);

  useEffect(
    () =>
      liveRadio.subscribe(status => {
        setLiveStatus(status);
        // Stopped from outside this screen - the notification swiped away,
        // the sleep timer running out while the screen was closed: the dial
        // follows, and the partner is told this phone is no longer listening.
        if (status === 'idle' && playingRef.current?.startsWith('live:')) {
          playingRef.current = null;
          setIsLocalTunedIn(false);
          setSleepMinutesRemaining(null);
          const r = radioRef.current;
          const mine = activeUserRef.current === 'user';
          onUpdateRadioRef.current({
            ...r,
            userListening: mine ? false : r.userListening,
            partnerListening: mine ? r.partnerListening : false
          });
        }
      }),
    []
  );

  useEffect(() => {
    setViewBand(band);
  }, [band]);

  // Equalizer animation loop when playing
  useEffect(() => {
    let animId: any;
    if (soundOn) {
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
  }, [soundOn]);

  // Handle sleep timer countdown
  useEffect(() => {
    let timer: any = null;
    if (isLocalTunedIn && sleepMinutesRemaining !== null && sleepMinutesRemaining > 0) {
      timer = setInterval(() => {
        setSleepMinutesRemaining(prev => {
          if (prev === null || prev <= 1) {
            handleStopRadio();
            return null;
          }
          return prev - 1;
        });
      }, 60000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLocalTunedIn, sleepMinutesRemaining]);

  // If the station changes - here or on the partner's phone - while this
  // phone is tuned in, follow it: that is listening together.
  useEffect(() => {
    if (isLocalTunedIn) startLocal(radio, false);
  }, [radio.stationId, band, liveStation?.url]);

  // If radio is stopped from remote partner, disengage local audio
  useEffect(() => {
    if (!radio.isPlaying && isLocalTunedIn) {
      setIsLocalTunedIn(false);
      stopLocal();
    }
  }, [radio.isPlaying]);

  const handleTogglePlay = (forceState?: boolean) => {
    // Paused from the lock screen or a headset: the button resumes it.
    if (forceState === undefined && isLocalTunedIn && onLive && liveStatus === 'paused') {
      startLocal();
      return;
    }
    const nextTunedIn = forceState !== undefined ? forceState : !isLocalTunedIn;
    setIsLocalTunedIn(nextTunedIn);

    if (nextTunedIn) {
      startLocal();
    } else {
      stopLocal();
    }

    const updatedRadio: MidnightRadioState = {
      ...radio,
      isPlaying: nextTunedIn,
      ...listening(nextTunedIn),
      startedAt: nextTunedIn ? Date.now() : radio.startedAt
    };
    onUpdateRadio(updatedRadio);

    if ('vibrate' in navigator) {
      navigator.vibrate([60, 30, 60]);
    }
  };

  const handleStopRadio = () => {
    setIsLocalTunedIn(false);
    stopLocal();
    const updatedRadio: MidnightRadioState = {
      ...radioRef.current,
      isPlaying: false,
      userListening: false,
      partnerListening: false
    };
    onUpdateRadio(updatedRadio);
    if ('vibrate' in navigator) {
      navigator.vibrate([40, 20]);
    }
  };

  const handleSelectStation = (stationId: MidnightRadioStationId) => {
    const updatedRadio: MidnightRadioState = {
      ...radio,
      stationId,
      band: 'two',
      isPlaying: true,
      ...listening(true),
      startedAt: Date.now()
    };
    onUpdateRadio(updatedRadio);
    setIsLocalTunedIn(true);
    startLocal(updatedRadio);

    if ('vibrate' in navigator) {
      navigator.vibrate([80]);
    }
  };

  const handleSelectLive = (station: LiveRadioStation) => {
    const updatedRadio: MidnightRadioState = {
      ...radio,
      band: 'live',
      liveForStationId: radio.stationId,
      liveStation: station,
      isPlaying: true,
      ...listening(true),
      startedAt: Date.now()
    };
    onUpdateRadio(updatedRadio);
    setIsLocalTunedIn(true);
    startLocal(updatedRadio);

    if ('vibrate' in navigator) {
      navigator.vibrate([80]);
    }
  };

  /** The next hand-picked station after this one: what to offer when a station is off air. */
  const nextLive = (station: LiveRadioStation | null): LiveRadioStation => {
    const i = station ? TAMIL_FM.findIndex(s => sameStation(s, station)) : -1;
    return TAMIL_FM[(i + 1) % TAMIL_FM.length];
  };

  const isFavorite = (station: LiveRadioStation) => liveFavorites.some(f => sameStation(f, station));

  const handleToggleFavorite = (station: LiveRadioStation) => {
    onUpdateRadio(toggleFavorite(radio, station));
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    radioSynth.setVolume(newVol);
    liveRadio.setVolume(newVol);
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
            Two's own never-repeating stations, or live Tamil FM. Both of you on the same station, at the same time.
          </p>
        </div>

        {/* Dual Listener Synchrony Pill */}
        <div className="inline-flex items-center space-x-2.5 px-4 py-2 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-orange-50/50 shadow-xs self-start sm:self-auto">
          <div className="relative flex items-center justify-center">
            {isLocalTunedIn ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="absolute w-4 h-4 rounded-full bg-emerald-500/40 animate-ping" />
              </>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            )}
          </div>
          <div className="text-xs font-serif text-linen-primary">
            {isLocalTunedIn && isPartnerListening ? (
              <span className="font-medium text-emerald-800">
                ✨ Both listening together in sync
              </span>
            ) : isLocalTunedIn ? (
              <span>You are tuned in • Waiting for {partnerName}</span>
            ) : radio.isPlaying ? (
              <span className="text-amber-800 font-medium">📻 {partnerName} is on {nowName} • Tap play to join</span>
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
                <span className={`w-2 h-2 rounded-full ${isLocalTunedIn ? 'bg-amber-400 animate-pulse' : 'bg-amber-950'}`} />
                <span className="text-[10px] font-mono text-amber-400">
                  {isLocalTunedIn ? 'STEREO SYNC' : 'STANDBY'}
                </span>
              </div>
            </div>

            {onLive ? (
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 sm:gap-3 relative z-10">
                <div className="min-w-0">
                  <h3 className="font-mono text-3xl sm:text-4xl font-light text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)] flex items-center gap-2 whitespace-nowrap">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isLocalTunedIn && liveStatus === 'playing' ? 'bg-rose-500 animate-pulse' : 'bg-rose-950'}`} />
                    {liveStation!.frequency ?? 'LIVE'}
                  </h3>
                  <p className="font-serif text-sm sm:text-base text-amber-100 font-medium mt-0.5 truncate">
                    {liveStation!.name}{liveStation!.place ? ` · ${liveStation!.place}` : ''}
                  </p>
                </div>

                <div className="flex sm:block items-center gap-2 sm:text-right shrink-0">
                  <span className="text-xs font-serif px-2.5 py-1 rounded-full border border-rose-500/30 bg-rose-950/40 text-rose-200 whitespace-nowrap">
                    {liveStation!.broadcaster ?? 'Live radio'}
                  </span>
                  <p className="text-[11px] text-amber-500/70 font-serif italic sm:mt-1" aria-live="polite">
                    {!isLocalTunedIn
                      ? 'Live Tamil FM'
                      : liveStatus === 'tuning'
                        ? 'Tuning in…'
                        : liveStatus === 'buffering'
                          ? 'Reconnecting…'
                          : liveStatus === 'off-air'
                            ? 'Off air right now'
                            : liveStatus === 'needs-tap'
                              ? 'Tap to listen'
                              : liveStatus === 'paused'
                                ? 'Paused'
                                : 'On air'}
                  </p>
                </div>
              </div>
            ) : (
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
            )}

            {/* Floating Live Radio Whisper Ticker */}
            {radio.whispers && radio.whispers.length > 0 && (
              <div className="mt-3 pt-2 border-t border-amber-900/50 flex items-center space-x-2 text-xs font-serif text-amber-200/90 animate-fade-in relative z-10">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 shrink-0 animate-pulse" />
                <span className="truncate">
                  <strong className="text-amber-400">{who(radio.whispers[0].senderId, state.activeUser, state.partnerName, radio.whispers[0].senderName)}:</strong> “{radio.whispers[0].text}”
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
                      isLocalTunedIn
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
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[11px] font-mono text-amber-600/80 uppercase tracking-widest">Band</span>
            <div className="inline-flex rounded-2xl border border-amber-950/60 bg-neutral-950/70 p-1" role="tablist" aria-label="Radio band">
              {([['two', "Two's stations"], ['live', 'Tamil FM · Live']] as const).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={viewBand === id}
                  onClick={() => setViewBand(id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-serif transition-colors cursor-pointer ${
                    viewBand === id ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40' : 'text-amber-600/80 hover:text-amber-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {viewBand === 'live' ? (
            <LiveBand
              current={onLive ? liveStation : null}
              tunedIn={isLocalTunedIn}
              status={liveStatus}
              favorites={liveFavorites}
              isFavorite={isFavorite}
              onPlay={handleSelectLive}
              onToggleFavorite={handleToggleFavorite}
              onNext={() => handleSelectLive(nextLive(liveStation))}
              onRetry={() => liveStation && handleSelectLive(liveStation)}
            />
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {STATIONS.map(station => {
              const isCurrent = !onLive && station.id === radio.stationId;
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
          )}
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
                  backgroundColor: soundOn ? (onLive ? '#fb7185' : currentStationMeta.themeColor) : '#451a03'
                }}
              />
            ))}
          </div>

          {/* Master Transport Play/Pause + Instant Stop + Volume */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleTogglePlay()}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-neutral-950 flex items-center justify-center shadow-lg shadow-amber-900/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title={isLocalTunedIn && !(onLive && liveStatus === 'paused') ? 'Pause Station' : 'Broadcast Live Station'}
            >
              {isLocalTunedIn && !(onLive && liveStatus === 'paused') ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>

            {isLocalTunedIn && (
              <button
                onClick={handleStopRadio}
                className="w-10 h-10 rounded-full bg-neutral-900 border border-amber-900/80 text-amber-400 hover:text-amber-200 hover:bg-neutral-800 flex items-center justify-center transition-all cursor-pointer shadow-md"
                title="Silence & Turn Off Radio"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            )}

            {/* Volume Slider */}
            <div className="flex items-center space-x-2 bg-neutral-950/80 px-3 py-2 rounded-2xl border border-amber-950/60">
              <button
                onClick={() => handleVolumeChange(volume > 0 ? 0 : 0.6)}
                className="text-amber-500 hover:text-amber-300 transition-colors cursor-pointer"
                title={volume === 0 ? "Unmute" : "Mute"}
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
              onClick={() => {
                const next = sleepMinutesRemaining === 30 ? null : 30;
                setSleepMinutesRemaining(next);
                // Live radio keeps its own timer, so it still ends after you leave this screen.
                liveRadio.sleepIn(onLive ? next : null);
              }}
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
                onClick={() => onSendToChat(
                  onLive
                    ? `📻 Listening to ${liveStation!.name}${liveStation!.place ? ` (${liveStation!.place})` : ''}, live on Midnight Radio. Come listen with me.`
                    : `📻 Listening to "${currentStationMeta.name}" (${currentStationMeta.frequency}) on Midnight Radio. Come listen with me.`
                )}
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
                    {/* From the seat, on this phone: the stored name said "You" on both phones. */}
                    <span className="font-semibold text-linen-primary">{who(whisper.senderId, state.activeUser, state.partnerName, whisper.senderName)}:</span>
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

interface LiveBandProps {
  current: LiveRadioStation | null;
  tunedIn: boolean;
  status: LiveRadioStatus;
  favorites: LiveRadioStation[];
  isFavorite: (station: LiveRadioStation) => boolean;
  onPlay: (station: LiveRadioStation) => void;
  onToggleFavorite: (station: LiveRadioStation) => void;
  onNext: () => void;
  /** Tunes the current station again - in a tap, which is also what an iPhone needs to play it. */
  onRetry: () => void;
}

/** The live band: Tamil FM stations, the two of you's favourites, and a search for more. */
const LiveBand: React.FC<LiveBandProps> = ({ current, tunedIn, status, favorites, isFavorite, onPlay, onToggleFavorite, onNext, onRetry }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LiveRadioStation[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  // The hand-picked stations a search matches, shown first: the directory
  // search leaves them out, as they are already on the dial.
  const needle = query.trim().toLowerCase();
  const ownMatches = needle.length < 2
    ? []
    : TAMIL_FM.filter(s => [s.name, s.place, s.broadcaster, s.frequency].some(v => v?.toLowerCase().includes(needle)));

  // Searched as you type, a moment after you stop.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      setSearchError(false);
      return;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(false);
      searchTamilStations(q, abort.signal)
        .then(found => setResults(found.slice(0, 20)))
        .catch(() => {
          if (!abort.signal.aborted) setSearchError(true);
        })
        .finally(() => {
          if (!abort.signal.aborted) setSearching(false);
        });
    }, 450);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query]);

  const card = (station: LiveRadioStation) => {
    const isCurrent = sameStation(station, current);
    const starred = isFavorite(station);
    return (
      <div
        key={station.url}
        className={`relative rounded-2xl border transition-all ${
          isCurrent
            ? 'text-rose-200 border-rose-500/40 bg-rose-950/30 shadow-md'
            : 'border-amber-950/60 bg-neutral-950/60 hover:bg-neutral-900/60 text-amber-600/70'
        }`}
      >
        <button onClick={() => onPlay(station)} className="w-full p-3 pr-9 text-left cursor-pointer">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-mono text-xs font-semibold truncate">{station.frequency ?? station.place ?? 'Live'}</span>
            {isCurrent && tunedIn && status === 'playing' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />}
          </div>
          <h4 className="font-serif text-sm font-medium text-amber-100 truncate">{station.name}</h4>
          <p className="text-[10px] text-amber-500/70 truncate mt-0.5">
            {[station.frequency ? station.place : null, station.broadcaster].filter(Boolean).join(' · ') || 'Tamil'}
          </p>
        </button>
        <button
          onClick={() => onToggleFavorite(station)}
          className="absolute top-2 right-2 p-1 rounded-lg text-amber-500/70 hover:text-amber-300 cursor-pointer"
          aria-label={starred ? `Remove ${station.name} from favourites` : `Add ${station.name} to favourites`}
          aria-pressed={starred}
        >
          <Star className={`w-3.5 h-3.5 ${starred ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>
      </div>
    );
  };

  const heading = (text: string) => (
    <h5 className="text-[10px] font-mono uppercase tracking-widest text-amber-600/80 mb-2">{text}</h5>
  );

  return (
    <div className="space-y-4">
      {current && tunedIn && status === 'off-air' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-xs font-serif text-rose-200">
          <span>{current.name} is off air right now: the station may be down, or your connection.</span>
          <div className="flex gap-2">
            <button onClick={onRetry} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 cursor-pointer">
              Try again
            </button>
            <button onClick={onNext} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 cursor-pointer">
              <SkipForward className="w-3.5 h-3.5" />
              Next station
            </button>
          </div>
        </div>
      )}

      {current && tunedIn && status === 'needs-tap' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs font-serif text-amber-200">
          <span>Your phone wants a tap before it plays {current.name}.</span>
          <button onClick={onRetry} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer">
            <Play className="w-3.5 h-3.5" />
            Listen
          </button>
        </div>
      )}

      {favorites.length > 0 && (
        <div>
          {heading('Your favourites')}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">{favorites.map(card)}</div>
        </div>
      )}

      <div>
        {heading('Tamil FM')}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">{TAMIL_FM.map(card)}</div>
      </div>

      <div>
        <label className="flex items-center gap-2 rounded-2xl border border-amber-950/60 bg-neutral-950/70 px-3 py-2 focus-within:border-amber-600">
          <Search className="w-4 h-4 text-amber-600/80 shrink-0" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search more Tamil stations"
            className="flex-1 bg-transparent text-xs text-amber-100 placeholder-amber-700/80 focus:outline-none"
            aria-label="Search more Tamil stations"
          />
          {searching && <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />}
        </label>
        {searchError && (
          <p className="mt-2 text-[11px] font-serif text-rose-300">The station directory could not be reached. Check your connection and try again.</p>
        )}
        {(ownMatches.length > 0 || (results && results.length > 0)) && (
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[...ownMatches, ...(results ?? [])].map(card)}
          </div>
        )}
        {results && !searching && !searchError && results.length === 0 && ownMatches.length === 0 && (
          <p className="mt-2 text-[11px] font-serif text-amber-500/70">No Tamil stations by that name.</p>
        )}
      </div>

      <p className="text-[10px] leading-relaxed font-serif text-amber-600/70">
        Live radio comes straight from each station over the internet: about 30 to 60 MB an hour on mobile data.
        The station can see your connection, as with any radio app; search goes to the radio-browser.info directory.
        Your messages and your space stay where they are.
      </p>
    </div>
  );
};
