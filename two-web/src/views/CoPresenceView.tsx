import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CoPresenceActivity, 
  CoPresenceRoomId, 
  CoPresenceUserStatus, 
  CoPresenceInteractionEvent,
  CoPresenceTimerEvent
} from '../types';
import { wsRelay } from '../core/ws';
import { localMesh } from '../core/localMesh';
import { soundscapeEngine, SOUNDSCAPES } from '../core/soundscapes';
import { 
  Coffee, BookOpen, Laptop, PenTool, Palette, Headphones, Moon, 
  Flame, CloudRain, Volume2, VolumeX, Heart, Sparkles, Clock, 
  Send, Users, Smile, Play, Pause, RefreshCw, Eye
} from 'lucide-react';

interface CoPresenceViewProps {
  activeUser: 'user' | 'partner';
  userName?: string;
  partnerName?: string;
  onSendToChat?: (message: string) => void;
}

const ROOMS: Record<CoPresenceRoomId, {
  id: CoPresenceRoomId;
  name: string;
  tagline: string;
  emoji: string;
  soundscapeId: 'rain' | 'fireplace' | 'cafe' | 'forest';
  bgGradient: string;
  lampColor: string;
}> = {
  rainy_window: {
    id: 'rainy_window',
    name: 'Rainy Window Alcove',
    tagline: 'Misty glass, streaming droplets, and cozy windowsill cushions',
    emoji: '🌧️',
    soundscapeId: 'rain',
    bgGradient: 'from-slate-900 via-sky-950 to-neutral-950',
    lampColor: 'rgba(56, 189, 248, 0.25)'
  },
  fireside: {
    id: 'fireside',
    name: 'Amber Fireside Hearth',
    tagline: 'Crackling cedar logs, deep reading armchairs, and warm hearth embers',
    emoji: '🪵',
    soundscapeId: 'fireplace',
    bgGradient: 'from-amber-950/90 via-stone-950 to-neutral-950',
    lampColor: 'rgba(245, 158, 11, 0.3)'
  },
  bookshop: {
    id: 'bookshop',
    name: 'Quiet Cedar Bookshop',
    tagline: 'Old parchment smell, rustic oak tables, and endless quiet shelves',
    emoji: '☕',
    soundscapeId: 'cafe',
    bgGradient: 'from-stone-900 via-amber-950/60 to-neutral-950',
    lampColor: 'rgba(251, 191, 36, 0.25)'
  },
  midnight_balcony: {
    id: 'midnight_balcony',
    name: 'Midnight Starlit Balcony',
    tagline: 'Soft night breeze, crickets singing in pine branches, and clear constellations',
    emoji: '🌌',
    soundscapeId: 'forest',
    bgGradient: 'from-indigo-950 via-slate-950 to-black',
    lampColor: 'rgba(168, 85, 247, 0.25)'
  }
};

const ACTIVITIES: Record<CoPresenceActivity, { id: CoPresenceActivity; label: string; icon: any; verb: string }> = {
  reading: { id: 'reading', label: 'Reading a Book', icon: BookOpen, verb: 'immersed in a book' },
  working: { id: 'working', label: 'Deep Focus Work', icon: Laptop, verb: 'in deep focus' },
  writing: { id: 'writing', label: 'Journaling / Writing', icon: PenTool, verb: 'putting quiet thoughts onto paper' },
  crafting: { id: 'crafting', label: 'Sketching & Crafting', icon: Palette, verb: 'creating with gentle hands' },
  music: { id: 'music', label: 'Listening to Music', icon: Headphones, verb: 'resting inside the melodies' },
  resting: { id: 'resting', label: 'Resting & Daydreaming', icon: Moon, verb: 'resting peacefully with eyes closed' },
  tea: { id: 'tea', label: 'Sipping Warm Tea', icon: Coffee, verb: 'enjoying a warm cup of herbal tea' }
};

function playInteractionSound(type: string) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'tea') {
      // Ceramic clink
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.16);
    } else if (type === 'glance') {
      // Gentle warm chime
      [660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + i * 0.1;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.9);
      });
    } else {
      // Soft touch tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(432, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 1.3);
    }
  } catch (_) {}
}

export const CoPresenceView: React.FC<CoPresenceViewProps> = ({ 
  activeUser, 
  userName = 'You', 
  partnerName = 'Partner',
  onSendToChat 
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<CoPresenceRoomId>('rainy_window');
  const [myActivity, setMyActivity] = useState<CoPresenceActivity>('reading');
  const [myCustomNote, setMyCustomNote] = useState<string>('');
  const [isJoined, setIsJoined] = useState<boolean>(true);
  const [joinedTimestamp, setJoinedTimestamp] = useState<number>(Date.now());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.35);

  // Partner status received from network
  const [partnerStatus, setPartnerStatus] = useState<CoPresenceUserStatus>({
    userId: activeUser === 'user' ? 'partner' : 'user',
    name: partnerName || (activeUser === 'user' ? 'Partner' : 'You'),
    activity: 'reading',
    room: 'rainy_window',
    customNote: 'Reading chapter 4 by the lamp',
    isJoined: true,
    joinedAt: Date.now() - 1000 * 60 * 25
  });

  // Active micro-interaction toast overlay
  const [activeInteractionToast, setActiveInteractionToast] = useState<{
    text: string;
    icon: string;
  } | null>(null);

  // Pomodoro shared synchronized timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(25 * 60);

  const currentRoom = useMemo(() => ROOMS[selectedRoomId], [selectedRoomId]);

  // Audio Ambience management
  useEffect(() => {
    if (soundEnabled) {
      soundscapeEngine.setVolume(volume);
      soundscapeEngine.play(currentRoom.soundscapeId);
    } else {
      soundscapeEngine.pause();
    }

    return () => {
      soundscapeEngine.pause();
    };
  }, [soundEnabled, currentRoom, volume]);

  // Real-time wall-clock countdown tick (zero drift across network)
  useEffect(() => {
    if (!timerActive || !timerEndsAt) return;

    const tick = () => {
      const remaining = Math.max(0, Math.round((timerEndsAt - Date.now()) / 1000));
      setTimerSecondsLeft(remaining);

      if (remaining <= 0) {
        setTimerActive(false);
        setTimerEndsAt(null);
        setTimerSecondsLeft(25 * 60);
        playInteractionSound('glance');
        setActiveInteractionToast({ text: 'Co-Focus session completed together! 🍵✨', icon: '🎉' });
        setTimeout(() => setActiveInteractionToast(null), 5000);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timerEndsAt]);

  // Listen for remote presence updates, interactions, and timer sync
  useEffect(() => {
    const unsubWs = wsRelay.subscribe((msg) => {
      if (msg.type === 'REMOTE_RECORD') {
        if (msg.record?.type === 'CO_PRESENCE_STATUS') {
          try {
            const data: CoPresenceUserStatus = JSON.parse(msg.record.payload);
            if (data.userId !== activeUser) {
              setPartnerStatus(data);
              // If partner has an active focus session running, sync our timer to it!
              if (data.timerActive && data.timerEndsAt && data.timerEndsAt > Date.now()) {
                const remaining = Math.max(0, Math.round((data.timerEndsAt - Date.now()) / 1000));
                setTimerActive(true);
                setTimerEndsAt(data.timerEndsAt);
                setTimerSecondsLeft(remaining);
              }
            }
          } catch (_) {}
        } else if (msg.record?.type === 'CO_PRESENCE_INTERACTION') {
          try {
            const data: CoPresenceInteractionEvent = JSON.parse(msg.record.payload);
            if (data.senderId !== activeUser) {
              handleReceiveInteraction(data);
            }
          } catch (_) {}
        } else if (msg.record?.type === 'CO_PRESENCE_TIMER') {
          try {
            const data: CoPresenceTimerEvent = JSON.parse(msg.record.payload);
            if (data.senderId !== activeUser) {
              handleReceiveTimerEvent(data);
            }
          } catch (_) {}
        }
      }
    });

    const unsubMesh = localMesh.subscribe((packet) => {
      if (packet.authorId !== activeUser) {
        if (packet.subType === 'CO_PRESENCE_STATUS') {
          setPartnerStatus(packet.payload);
          if (packet.payload?.timerActive && packet.payload?.timerEndsAt && packet.payload.timerEndsAt > Date.now()) {
            const remaining = Math.max(0, Math.round((packet.payload.timerEndsAt - Date.now()) / 1000));
            setTimerActive(true);
            setTimerEndsAt(packet.payload.timerEndsAt);
            setTimerSecondsLeft(remaining);
          }
        } else if (packet.subType === 'CO_PRESENCE_INTERACTION') {
          handleReceiveInteraction(packet.payload);
        } else if (packet.subType === 'CO_PRESENCE_TIMER') {
          handleReceiveTimerEvent(packet.payload);
        }
      }
    });

    // Broadcast our initial arrival into the sanctuary room on mount
    broadcastMyStatus(myActivity, selectedRoomId, myCustomNote);

    return () => {
      unsubWs();
      unsubMesh();
    };
  }, [activeUser, myActivity, selectedRoomId, myCustomNote]);

  const broadcastMyStatus = (
    activity: CoPresenceActivity, 
    room: CoPresenceRoomId, 
    note?: string,
    isTimerRunning?: boolean,
    targetEndsAt?: number | null,
    secsLeft?: number
  ) => {
    const status: CoPresenceUserStatus = {
      userId: activeUser,
      name: userName || (activeUser === 'user' ? 'You' : 'Partner'),
      activity,
      room,
      customNote: note !== undefined ? note : myCustomNote,
      isJoined,
      joinedAt: joinedTimestamp,
      timerActive: isTimerRunning !== undefined ? isTimerRunning : timerActive,
      timerEndsAt: targetEndsAt !== undefined ? (targetEndsAt || undefined) : (timerEndsAt || undefined),
      timerSecondsLeft: secsLeft !== undefined ? secsLeft : timerSecondsLeft
    };
    wsRelay.broadcastUpdate('CO_PRESENCE_STATUS', status);
    localMesh.broadcastLocally('CO_PRESENCE_STATUS', status, activeUser);
  };

  const handleStartTimer = () => {
    const currentLeft = timerSecondsLeft > 0 ? timerSecondsLeft : 25 * 60;
    const endsAt = Date.now() + currentLeft * 1000;
    setTimerActive(true);
    setTimerEndsAt(endsAt);
    setTimerSecondsLeft(currentLeft);
    playInteractionSound('glance');

    const event: CoPresenceTimerEvent = {
      action: 'start',
      isActive: true,
      secondsLeft: currentLeft,
      timerEndsAt: endsAt,
      senderId: activeUser,
      senderName: userName || (activeUser === 'user' ? 'You' : 'Partner'),
      timestamp: Date.now()
    };
    wsRelay.broadcastUpdate('CO_PRESENCE_TIMER', event);
    localMesh.broadcastLocally('CO_PRESENCE_TIMER', event, activeUser);

    broadcastMyStatus(myActivity, selectedRoomId, myCustomNote, true, endsAt, currentLeft);

    setActiveInteractionToast({ text: 'Started shared Co-Focus timer ⏱️', icon: '⏱️' });
    setTimeout(() => setActiveInteractionToast(null), 3000);
  };

  const handlePauseTimer = () => {
    setTimerActive(false);
    setTimerEndsAt(null);

    const event: CoPresenceTimerEvent = {
      action: 'pause',
      isActive: false,
      secondsLeft: timerSecondsLeft,
      timerEndsAt: null,
      senderId: activeUser,
      senderName: userName || (activeUser === 'user' ? 'You' : 'Partner'),
      timestamp: Date.now()
    };
    wsRelay.broadcastUpdate('CO_PRESENCE_TIMER', event);
    localMesh.broadcastLocally('CO_PRESENCE_TIMER', event, activeUser);

    broadcastMyStatus(myActivity, selectedRoomId, myCustomNote, false, null, timerSecondsLeft);

    setActiveInteractionToast({ text: 'Paused shared Co-Focus timer ⏸️', icon: '⏸️' });
    setTimeout(() => setActiveInteractionToast(null), 3000);
  };

  const handleResetTimer = () => {
    setTimerActive(false);
    setTimerEndsAt(null);
    setTimerSecondsLeft(25 * 60);

    const event: CoPresenceTimerEvent = {
      action: 'reset',
      isActive: false,
      secondsLeft: 25 * 60,
      timerEndsAt: null,
      senderId: activeUser,
      senderName: userName || (activeUser === 'user' ? 'You' : 'Partner'),
      timestamp: Date.now()
    };
    wsRelay.broadcastUpdate('CO_PRESENCE_TIMER', event);
    localMesh.broadcastLocally('CO_PRESENCE_TIMER', event, activeUser);

    broadcastMyStatus(myActivity, selectedRoomId, myCustomNote, false, null, 25 * 60);

    setActiveInteractionToast({ text: 'Reset Co-Focus timer to 25:00 🔄', icon: '🔄' });
    setTimeout(() => setActiveInteractionToast(null), 3000);
  };

  const handleReceiveTimerEvent = (event: CoPresenceTimerEvent) => {
    if (event.action === 'start') {
      const endsAt = event.timerEndsAt || (Date.now() + (event.secondsLeft || 25 * 60) * 1000);
      const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setTimerActive(true);
      setTimerEndsAt(endsAt);
      setTimerSecondsLeft(remaining);
      playInteractionSound('glance');
      setActiveInteractionToast({
        text: `${event.senderName || partnerName || 'Partner'} started a 25m Co-Focus session ⏱️`,
        icon: '⏱️'
      });
      setTimeout(() => setActiveInteractionToast(null), 4000);
    } else if (event.action === 'pause') {
      setTimerActive(false);
      setTimerEndsAt(null);
      setTimerSecondsLeft(event.secondsLeft);
      setActiveInteractionToast({
        text: `${event.senderName || partnerName || 'Partner'} paused the Co-Focus timer ⏸️`,
        icon: '⏸️'
      });
      setTimeout(() => setActiveInteractionToast(null), 4000);
    } else if (event.action === 'reset') {
      setTimerActive(false);
      setTimerEndsAt(null);
      setTimerSecondsLeft(event.secondsLeft || 25 * 60);
      setActiveInteractionToast({
        text: `${event.senderName || partnerName || 'Partner'} reset the timer 🔄`,
        icon: '🔄'
      });
      setTimeout(() => setActiveInteractionToast(null), 4000);
    } else if (event.action === 'complete') {
      setTimerActive(false);
      setTimerEndsAt(null);
      setTimerSecondsLeft(25 * 60);
      playInteractionSound('glance');
      setActiveInteractionToast({
        text: 'Co-Focus session completed together! 🍵✨',
        icon: '🎉'
      });
      setTimeout(() => setActiveInteractionToast(null), 5000);
    }
  };

  const handleReceiveInteraction = (event: CoPresenceInteractionEvent) => {
    playInteractionSound(event.type);
    let message = '';
    let emoji = '';

    switch (event.type) {
      case 'tea':
        message = `${event.senderName} placed a warm herbal tea on your desk 🍵`;
        emoji = '🍵';
        break;
      case 'glance':
        message = `${event.senderName} gently looked up and smiled at you across the room ✨`;
        emoji = '👀';
        break;
      case 'blanket':
        message = `${event.senderName} draped a soft, warm knit blanket over your shoulders 🧶`;
        emoji = '🧶';
        break;
      case 'hand':
        message = `${event.senderName} is holding your hand quietly across the table 🤝`;
        emoji = '🤝';
        break;
      case 'kiss':
        message = `${event.senderName} blew a quiet whisper kiss from across the room 💋`;
        emoji = '💋';
        break;
    }

    setActiveInteractionToast({ text: message, icon: emoji });
    setTimeout(() => setActiveInteractionToast(null), 4500);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([40, 50, 40]);
      } catch (_) {}
    }
  };

  const sendInteraction = (type: CoPresenceInteractionEvent['type']) => {
    playInteractionSound(type);
    const event: CoPresenceInteractionEvent = {
      type,
      senderId: activeUser,
      senderName: userName || (activeUser === 'user' ? 'You' : 'Partner'),
      timestamp: Date.now()
    };
    wsRelay.broadcastUpdate('CO_PRESENCE_INTERACTION', event);
    localMesh.broadcastLocally('CO_PRESENCE_INTERACTION', event, activeUser);

    let feedback = '';
    if (type === 'tea') feedback = 'Placed a warm cup of herbal tea on partner’s desk 🍵';
    else if (type === 'glance') feedback = 'Sent a gentle, loving glance across the room 👀';
    else if (type === 'blanket') feedback = 'Wrapped partner in a soft knit blanket 🧶';
    else if (type === 'hand') feedback = 'Holding hands quietly across the table 🤝';
    else if (type === 'kiss') feedback = 'Blew a quiet whisper kiss across the room 💋';

    setActiveInteractionToast({ text: feedback, icon: '✨' });
    setTimeout(() => setActiveInteractionToast(null), 3500);
  };

  const handleSelectRoom = (roomId: CoPresenceRoomId) => {
    setSelectedRoomId(roomId);
    broadcastMyStatus(myActivity, roomId);
  };

  const handleSelectActivity = (act: CoPresenceActivity) => {
    setMyActivity(act);
    broadcastMyStatus(act, selectedRoomId);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getMinutesTogether = () => {
    const elapsedMs = Date.now() - joinedTimestamp;
    const mins = Math.floor(elapsedMs / (1000 * 60));
    return mins < 1 ? 'Just arrived' : `${mins} min together`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="font-serif text-2xl sm:text-3xl font-medium text-linen-primary tracking-tight">
              Quiet Co-Presence Room
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-sans font-medium border border-amber-200">
              Parallel Sanctuary
            </span>
          </div>
          <p className="text-xs sm:text-sm text-linen-secondary mt-1">
            Read, study, or rest alongside your partner across distance with zero pressure to speak.
          </p>
        </div>

        {/* Ambient Audio Controls */}
        <div className="flex items-center space-x-3 bg-linen-surface border border-linen-border px-3.5 py-2 rounded-2xl shadow-xs self-start sm:self-auto">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              soundEnabled ? 'text-amber-600 bg-amber-50' : 'text-linen-secondary hover:text-linen-primary'
            }`}
            title="Toggle Room Ambient Sounds"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <span className="text-xs text-linen-secondary hidden md:inline">Room Ambience</span>
          <input
            type="range"
            min="0.05"
            max="1.0"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 accent-linen-primary cursor-pointer"
            disabled={!soundEnabled}
          />
        </div>
      </div>

      {/* Main Sanctuary Room Stage */}
      <div className={`rounded-3xl border border-stone-800 p-6 sm:p-8 text-stone-100 shadow-2xl relative overflow-hidden bg-gradient-to-br ${currentRoom.bgGradient} transition-all duration-700`}>
        {/* Soft Ambient Lamp Glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-1000"
          style={{ backgroundColor: currentRoom.lampColor }}
        />

        {/* Interaction Floating Toast Banner */}
        {activeInteractionToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-stone-900/95 backdrop-blur-md border border-amber-400/70 px-5 py-2.5 rounded-2xl text-amber-200 text-xs font-serif font-medium shadow-2xl flex items-center space-x-2 animate-in slide-in-from-top-4 duration-300">
            <span className="text-lg">{activeInteractionToast.icon}</span>
            <span>{activeInteractionToast.text}</span>
          </div>
        )}

        <div className="relative z-10 space-y-6">
          {/* Room Environment Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{currentRoom.emoji}</span>
              <div>
                <h3 className="font-serif text-lg font-medium text-amber-100">{currentRoom.name}</h3>
                <p className="text-xs text-stone-400">{currentRoom.tagline}</p>
              </div>
            </div>

            {/* Room Picker Buttons */}
            <div className="flex items-center space-x-1.5 bg-black/40 p-1 rounded-2xl border border-white/10">
              {(Object.keys(ROOMS) as CoPresenceRoomId[]).map(id => {
                const r = ROOMS[id];
                const isSelected = selectedRoomId === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleSelectRoom(id)}
                    className={`px-3 py-1 rounded-xl text-xs transition-all flex items-center space-x-1 cursor-pointer ${
                      isSelected ? 'bg-white/20 text-white font-medium shadow-xs' : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <span>{r.emoji}</span>
                    <span className="hidden sm:inline">{r.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shared Parallel Desk: Two Desks Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-6">
            {/* Partner's Desk Side */}
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6 flex flex-col justify-between space-y-4 backdrop-blur-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-300">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider font-semibold text-amber-300/80">Partner's Side</span>
                    <h4 className="font-serif text-base font-medium text-stone-100">
                      {partnerName || partnerStatus.name || 'Partner'}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {timerActive && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center">
                      <Clock className="w-2.5 h-2.5 mr-1" />
                      Co-Focusing
                    </span>
                  )}
                  <span className="inline-flex items-center text-[10px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-ping" />
                    Beside You
                  </span>
                </div>
              </div>

              {/* Partner's Activity */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-1.5">
                <div className="flex items-center space-x-2 text-xs text-amber-200 font-medium">
                  {React.createElement(ACTIVITIES[partnerStatus.activity].icon, { className: 'w-4 h-4 text-amber-400' })}
                  <span>{ACTIVITIES[partnerStatus.activity].label}</span>
                </div>
                <p className="text-xs text-stone-300 italic font-serif">
                  {partnerStatus.customNote 
                    ? `“${partnerStatus.customNote}”` 
                    : `${partnerName || partnerStatus.name} is ${ACTIVITIES[partnerStatus.activity].verb}.`}
                </p>
              </div>

              <div className="text-[11px] text-stone-400 flex items-center justify-between pt-2 border-t border-white/10">
                <span>In {ROOMS[partnerStatus.room]?.name || 'Quiet Sanctuary'}</span>
                <span>Reading in calm stillness</span>
              </div>
            </div>

            {/* Your Desk Side */}
            <div className="rounded-3xl bg-white/5 border border-white/10 p-6 flex flex-col justify-between space-y-4 backdrop-blur-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-rose-400/10 border border-rose-400/30 flex items-center justify-center text-rose-300">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider font-semibold text-rose-300/80">Your Side</span>
                    <h4 className="font-serif text-base font-medium text-stone-100">
                      {userName || (activeUser === 'user' ? 'You' : 'Partner')}
                    </h4>
                  </div>
                </div>

                <span className="text-[11px] text-stone-400 font-mono">
                  {getMinutesTogether()}
                </span>
              </div>

              {/* Your Activity Display */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-2">
                <div className="flex items-center space-x-2 text-xs text-rose-200 font-medium">
                  {React.createElement(ACTIVITIES[myActivity].icon, { className: 'w-4 h-4 text-rose-400' })}
                  <span>{ACTIVITIES[myActivity].label}</span>
                </div>
                <input
                  type="text"
                  placeholder="Add a quiet note (e.g. Sipping peppermint tea)..."
                  value={myCustomNote}
                  onChange={(e) => {
                    setMyCustomNote(e.target.value);
                    broadcastMyStatus(myActivity, selectedRoomId, e.target.value);
                  }}
                  className="w-full text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-stone-200 placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>

              <div className="text-[11px] text-stone-400 flex items-center justify-between pt-2 border-t border-white/10">
                <span>Ambient presence active</span>
                <span className="text-emerald-400">Zero pressure</span>
              </div>
            </div>
          </div>

          {/* Micro-Interactions Bar: Wordless Cuddles & Touches */}
          <div className="p-4 rounded-3xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest font-semibold text-amber-300/80">
                Wordless Micro-Touches • Send to Partner
              </span>
              <span className="text-[11px] text-stone-400">Tactile acoustic feedback</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                onClick={() => sendInteraction('tea')}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center text-center transition-all hover:scale-102 cursor-pointer group"
              >
                <span className="text-xl group-hover:scale-120 transition-transform">🍵</span>
                <span className="text-xs font-medium text-stone-200 mt-1">Warm Tea</span>
                <span className="text-[9px] text-stone-400">Place on desk</span>
              </button>

              <button
                onClick={() => sendInteraction('glance')}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center text-center transition-all hover:scale-102 cursor-pointer group"
              >
                <span className="text-xl group-hover:scale-120 transition-transform">👀</span>
                <span className="text-xs font-medium text-stone-200 mt-1">Loving Glance</span>
                <span className="text-[9px] text-stone-400">Gentle eye contact</span>
              </button>

              <button
                onClick={() => sendInteraction('blanket')}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center text-center transition-all hover:scale-102 cursor-pointer group"
              >
                <span className="text-xl group-hover:scale-120 transition-transform">🧶</span>
                <span className="text-xs font-medium text-stone-200 mt-1">Knit Blanket</span>
                <span className="text-[9px] text-stone-400">Wrap shoulders</span>
              </button>

              <button
                onClick={() => sendInteraction('hand')}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center text-center transition-all hover:scale-102 cursor-pointer group"
              >
                <span className="text-xl group-hover:scale-120 transition-transform">🤝</span>
                <span className="text-xs font-medium text-stone-200 mt-1">Hold Hands</span>
                <span className="text-[9px] text-stone-400">Touch across desk</span>
              </button>

              <button
                onClick={() => sendInteraction('kiss')}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center text-center transition-all hover:scale-102 cursor-pointer group col-span-2 sm:col-span-1"
              >
                <span className="text-xl group-hover:scale-120 transition-transform">💋</span>
                <span className="text-xs font-medium text-stone-200 mt-1">Whisper Kiss</span>
                <span className="text-[9px] text-stone-400">Blow across room</span>
              </button>
            </div>
          </div>

          {/* Activity Selector & Shared Pomodoro Timer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Activity Picker */}
            <div className="md:col-span-2 p-4 rounded-3xl bg-white/5 border border-white/10 space-y-2.5">
              <span className="text-xs font-medium text-stone-300 block">
                What are you focusing on right now?
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(ACTIVITIES) as CoPresenceActivity[]).map(act => {
                  const meta = ACTIVITIES[act];
                  const Icon = meta.icon;
                  const isSelected = myActivity === act;
                  return (
                    <button
                      key={act}
                      onClick={() => handleSelectActivity(act)}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-rose-500 text-white font-medium shadow-xs'
                          : 'bg-black/30 hover:bg-white/10 text-stone-300 border border-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Shared Real-Time Co-Focus Timer */}
            <div className="p-4 rounded-3xl bg-white/5 border border-white/10 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-medium text-stone-300">Shared Co-Focus Timer</span>
                  {timerActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>
                <Clock className={`w-3.5 h-3.5 ${timerActive ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
              </div>

              <div className="text-center py-1">
                <span className={`font-mono text-3xl font-bold tracking-wider ${timerActive ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {formatTimer(timerSecondsLeft)}
                </span>
                <span className="block text-[10px] text-stone-400 mt-0.5">
                  {timerActive ? 'Both focusing in quiet flow ✨' : '25m Focus • 5m Cuddle Break'}
                </span>
              </div>

              <div className="flex items-center justify-center space-x-2">
                <button
                  onClick={timerActive ? handlePauseTimer : handleStartTimer}
                  className={`px-4 py-1.5 rounded-xl text-stone-950 text-xs font-semibold inline-flex items-center space-x-1 transition-all cursor-pointer shadow-xs ${
                    timerActive
                      ? 'bg-amber-400 hover:bg-amber-300'
                      : 'bg-emerald-400 hover:bg-emerald-300'
                  }`}
                >
                  {timerActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                  <span>{timerActive ? 'Pause' : 'Start Focus'}</span>
                </button>
                <button
                  onClick={handleResetTimer}
                  className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Reset Timer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
