import React, { useState, useEffect } from 'react';
import { 
  Moon, Volume2, VolumeX, Play, Pause, Clock, Users, X, Sparkles, 
  Check, Waves, CloudRain, Flame, Trees, Coffee
} from 'lucide-react';
import { 
  soundscapeEngine, SOUNDSCAPES, SoundscapeId, SoundscapeState 
} from '../core/soundscapes';
import { wsRelay } from '../core/ws';
import { localMesh } from '../core/localMesh';

interface AmbientSoundscapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: 'user' | 'partner';
}

export const AmbientSoundscapeModal: React.FC<AmbientSoundscapeModalProps> = ({
  isOpen,
  onClose,
  activeUser
}) => {
  const [state, setState] = useState<SoundscapeState>(soundscapeEngine.getState());
  const [partnerActiveTrack, setPartnerActiveTrack] = useState<{
    trackId: SoundscapeId;
    isPlaying: boolean;
    sender: string;
  } | null>(null);

  // Subscribe to soundscape engine updates
  useEffect(() => {
    const unsub = soundscapeEngine.subscribe((newState) => {
      setState(newState);
    });
    return () => unsub();
  }, []);

  // Listen for remote partner SOUNDSCAPE_SYNC events via WebSocket & Local Mesh
  useEffect(() => {
    const handleRemoteSync = (payload: any, authorId: string) => {
      if (authorId === activeUser) return; // Ignore own echoes
      try {
        if (payload.type === 'SOUNDSCAPE_SYNC' || payload.trackId) {
          const trackId = payload.trackId as SoundscapeId;
          const isPlaying = !!payload.isPlaying;
          setPartnerActiveTrack({
            trackId,
            isPlaying,
            sender: authorId === 'user' ? 'You' : 'Partner'
          });

          // If auto-sync is enabled on this client, adopt the partner's track
          if (soundscapeEngine.getState().syncedWithPartner) {
            if (isPlaying) {
              soundscapeEngine.play(trackId);
            } else {
              soundscapeEngine.pause();
            }
          }
        }
      } catch (e) {
        console.error('[Soundscape Sync Parse Error]', e);
      }
    };

    const wsUnsub = wsRelay.subscribe((msg) => {
      if (msg.type === 'REMOTE_RECORD' && msg.record?.type === 'SOUNDSCAPE_SYNC') {
        try {
          const data = JSON.parse(msg.record.payload);
          handleRemoteSync(data, msg.record.authorId);
        } catch (e) {}
      }
    });

    const meshUnsub = localMesh.subscribe((evt) => {
      if (evt.type === 'LOCAL_MESH_PACKET' && evt.subType === 'SOUNDSCAPE_SYNC' && evt.authorId !== activeUser) {
        handleRemoteSync(evt.payload, evt.authorId);
      }
    });

    return () => {
      wsUnsub();
      meshUnsub();
    };
  }, [activeUser]);

  // Broadcast sync state when changed by local user if synced
  const broadcastSync = (trackId: SoundscapeId, isPlaying: boolean, volume: number) => {
    const payload = {
      trackId,
      isPlaying,
      volume,
      senderId: activeUser,
      timestamp: Date.now()
    };
    wsRelay.broadcastUpdate('SOUNDSCAPE_SYNC', payload);
    localMesh.broadcastLocally('SOUNDSCAPE_SYNC', payload, activeUser);
  };

  const handleSelect = (id: SoundscapeId) => {
    soundscapeEngine.selectSoundscape(id);
    if (state.syncedWithPartner) {
      broadcastSync(id, state.isPlaying, state.volume);
    }
  };

  const handleTogglePlay = () => {
    const willPlay = !state.isPlaying;
    soundscapeEngine.togglePlay();
    if (state.syncedWithPartner) {
      broadcastSync(state.currentId, willPlay, state.volume);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    soundscapeEngine.setVolume(val);
  };

  const handleTimerSelect = (mins: number | null) => {
    soundscapeEngine.setSleepTimer(mins);
  };

  const toggleSync = () => {
    const nextSync = !state.syncedWithPartner;
    soundscapeEngine.setSyncedWithPartner(nextSync);
    if (nextSync && state.isPlaying) {
      broadcastSync(state.currentId, true, state.volume);
    }
  };

  const joinPartnerTrack = () => {
    if (partnerActiveTrack) {
      soundscapeEngine.setSyncedWithPartner(true);
      soundscapeEngine.play(partnerActiveTrack.trackId);
    }
  };

  const formatCountdown = (seconds: number | null) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-stone-900 text-stone-100 border border-stone-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-stone-800/80 flex items-center justify-between bg-gradient-to-r from-stone-900 via-indigo-950/30 to-stone-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center text-indigo-300">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-medium tracking-tight text-stone-100 flex items-center space-x-2">
                <span>Fall Asleep Together</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-sans font-normal">
                  Offline Synthesizer
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                Procedural acoustics • Zero external files • Shared night sanctuary
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Partner Active Listening Banner (if remote partner has it playing) */}
          {partnerActiveTrack && partnerActiveTrack.isPlaying && partnerActiveTrack.trackId !== state.currentId && (
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between animate-pulse">
              <div className="flex items-center space-x-2.5">
                <Users className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-indigo-200">
                  Partner is listening to <strong className="text-white capitalize">{partnerActiveTrack.trackId}</strong>
                </span>
              </div>
              <button
                onClick={joinPartnerTrack}
                className="text-xs px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              >
                Listen Together
              </button>
            </div>
          )}

          {/* Soundscape Atmosphere Selection Grid */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Choose Soundscape Atmosphere
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SOUNDSCAPES.map((sc) => {
                const isCurrent = state.currentId === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => handleSelect(sc.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                      isCurrent
                        ? 'border-indigo-500/60 bg-indigo-950/30 shadow-lg shadow-indigo-950/40'
                        : 'border-stone-800 bg-stone-900/60 hover:border-stone-700 hover:bg-stone-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{sc.emoji}</span>
                      {isCurrent && state.isPlaying && (
                        <div className="flex items-end space-x-0.5 h-4">
                          <div className="w-1 bg-indigo-400 rounded-full animate-bounce h-3" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 bg-indigo-400 rounded-full animate-bounce h-4" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 bg-indigo-400 rounded-full animate-bounce h-2" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="font-medium text-sm text-stone-100 flex items-center space-x-1.5">
                        <span>{sc.name}</span>
                      </div>
                      <div className="text-[11px] text-stone-400 line-clamp-1 mt-0.5">
                        {sc.tagline}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Master Play / Pause & Volume Bar */}
          <div className="p-4 rounded-2xl bg-stone-800/50 border border-stone-800 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleTogglePlay}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all shadow-md ${
                    state.isPlaying
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                      : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40'
                  }`}
                >
                  {state.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <div>
                  <div className="text-xs font-semibold text-stone-300">
                    {state.isPlaying ? 'Now Playing' : 'Paused'}
                  </div>
                  <div className="text-sm font-medium text-stone-100">
                    {SOUNDSCAPES.find(s => s.id === state.currentId)?.name}
                  </div>
                </div>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center space-x-2 w-36">
                <button 
                  onClick={() => soundscapeEngine.setVolume(state.volume === 0 ? 0.5 : 0)}
                  className="text-stone-400 hover:text-stone-200"
                >
                  {state.volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={state.volume}
                  onChange={handleVolumeChange}
                  className="w-full accent-indigo-400 bg-stone-700 h-1.5 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Sleep Timer & Fade-Out */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-400 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Sleep Timer & Gentle Fade</span>
              </label>
              {state.secondsRemaining !== null && (
                <span className="text-xs font-mono text-indigo-400 font-medium">
                  {formatCountdown(state.secondsRemaining)} remaining
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[null, 15, 30, 45, 60].map((mins) => {
                const isSelected = state.sleepTimerMinutes === mins;
                return (
                  <button
                    key={mins === null ? 'off' : mins}
                    onClick={() => handleTimerSelect(mins)}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-stone-800/60 text-stone-400 border-stone-800 hover:bg-stone-800 hover:text-stone-200'
                    }`}
                  >
                    {mins === null ? 'Off' : `${mins}m`}
                  </button>
                );
              })}
            </div>
            {state.sleepTimerMinutes && (
              <p className="text-[11px] text-stone-400 italic">
                Acoustics will automatically and smoothly curve to silence in the last 30 seconds.
              </p>
            )}
          </div>

          {/* Partner Synchronized Listening Toggle */}
          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/30 flex items-center justify-between">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-200">
                  Sync Listening with Partner
                </div>
                <div className="text-[11px] text-stone-400">
                  Changes to atmosphere or play state will sync across both phones.
                </div>
              </div>
            </div>
            <button
              onClick={toggleSync}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                state.syncedWithPartner ? 'bg-indigo-600' : 'bg-stone-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                  state.syncedWithPartner ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800/80 bg-stone-900/80 flex items-center justify-between text-xs text-stone-400">
          <span className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Rest well under the same sky</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
