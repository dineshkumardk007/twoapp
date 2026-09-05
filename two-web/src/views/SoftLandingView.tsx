import React, { useState, useEffect, useRef } from 'react';
import { SoftLandingSession, SoftLandingReflection } from '../types';
import { Shield, Heart, Clock, Volume2, VolumeX, Sparkles, Check, MessageSquare, History, X, Handshake, AlertCircle } from 'lucide-react';

interface SoftLandingViewProps {
  activeSession: SoftLandingSession | null;
  history: SoftLandingSession[];
  activeUser: 'user' | 'partner';
  onUpdateSession: (session: SoftLandingSession | null) => void;
  onSaveToHistory: (session: SoftLandingSession) => void;
  onSendToChat?: (message: string) => void;
}

const REASSURANCE_PRESETS = [
  'I love you deeply. I am not abandoning this conversation or you. I need 20 minutes to regulate my nervous system so I can listen with an open heart.',
  'I am feeling emotionally flooded and overwhelmed right now. Let us take 20 quiet minutes to ground ourselves, then regroup with gentleness.',
  'I care too much about us to speak while defensive. Taking 20 minutes of silence to find my softness again. You are safe with me.',
  'I need a quiet pause to catch my breath. I love you and look forward to reconnecting in a few minutes.'
];

const FEELING_OPTIONS = [
  'Emotionally flooded',
  'Scared of disconnect',
  'Misunderstood',
  'Defensive & on edge',
  'Exhausted & depleted',
  'Tender & vulnerable',
  'Unheard'
];

const NEED_OPTIONS = [
  'Emotional safety & softness',
  'Reassurance of love',
  'To feel truly heard',
  'Slower conversational pacing',
  'Physical comfort / a hug',
  'Space to process thoughts'
];

const REQUEST_PRESETS = [
  'Can we start by sitting side-by-side with a silent 30-second hug before speaking?',
  'Can you hold my hand and let me share for 3 minutes without defending or fixing?',
  'Can we pause this heavy topic for tonight and cuddle with warm tea, then revisit tomorrow?',
  'Can we take turns speaking slowly in soft voices, with zero interruptions?'
];

// Procedural 432Hz Calm Drone Engine
class SoftLandingAudioEngine {
  private ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;

  start() {
    if (this.isPlaying) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();

      const now = this.ctx.currentTime;
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.0001, now);
      this.gainNode.gain.exponentialRampToValueAtTime(0.08, now + 2.0);

      // 432Hz Base Root
      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = 'sine';
      this.osc1.frequency.setValueAtTime(432, now);

      // 436Hz Binaural theta difference (4Hz theta wave for deep parasympathetic relaxation)
      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'sine';
      this.osc2.frequency.setValueAtTime(436, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      this.osc1.connect(filter);
      this.osc2.connect(filter);
      filter.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      this.osc1.start(now);
      this.osc2.start(now);
      this.isPlaying = true;
    } catch (_) {}
  }

  stop() {
    if (!this.isPlaying || !this.ctx || !this.gainNode) return;
    try {
      const now = this.ctx.currentTime;
      this.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      setTimeout(() => {
        try {
          this.osc1?.stop();
          this.osc2?.stop();
          this.ctx?.close();
        } catch (_) {}
        this.isPlaying = false;
      }, 1000);
    } catch (_) {
      this.isPlaying = false;
    }
  }
}

const audioEngine = new SoftLandingAudioEngine();

function playReconnectionChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonic Tibetan Bell (528Hz + 1056Hz shimmer)
    [528, 792, 1056].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2 / (i + 1), t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 2.5);
    });
  } catch (_) {}
}

export const SoftLandingView: React.FC<SoftLandingViewProps> = ({
  activeSession,
  history,
  activeUser,
  onUpdateSession,
  onSaveToHistory,
  onSendToChat
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [reassuranceNote, setReassuranceNote] = useState(REASSURANCE_PRESETS[0]);
  const [customNote, setCustomNote] = useState('');
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // NVC Reflection form
  const [selectedFeeling, setSelectedFeeling] = useState(FEELING_OPTIONS[0]);
  const [selectedNeed, setSelectedNeed] = useState(NEED_OPTIONS[0]);
  const [selectedRequest, setSelectedRequest] = useState(REQUEST_PRESETS[0]);
  const [customRequest, setCustomRequest] = useState('');

  // Countdown timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    if (!activeSession) {
      if (isAudioPlaying) {
        audioEngine.stop();
        setIsAudioPlaying(false);
      }
      return;
    }

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((activeSession.breatherEndsAt - Date.now()) / 1000));
      setSecondsRemaining(diff);
    }, 1000);

    const initialDiff = Math.max(0, Math.floor((activeSession.breatherEndsAt - Date.now()) / 1000));
    setSecondsRemaining(initialDiff);

    return () => clearInterval(interval);
  }, [activeSession]);

  const toggleAudio = () => {
    if (isAudioPlaying) {
      audioEngine.stop();
      setIsAudioPlaying(false);
    } else {
      audioEngine.start();
      setIsAudioPlaying(true);
    }
  };

  const handleStartBreather = () => {
    const note = customNote.trim() || reassuranceNote;
    const authorName = activeUser === 'user' ? 'You' : 'Partner';
    const endsAt = Date.now() + durationMinutes * 60 * 1000;

    const newSession: SoftLandingSession = {
      id: `soft-landing-${Date.now()}`,
      initiatedBy: activeUser,
      initiatedByName: authorName,
      initiatedAt: Date.now(),
      breatherDurationMinutes: durationMinutes,
      breatherEndsAt: endsAt,
      status: 'breather_active',
      loveReassuranceNote: note
    };

    onUpdateSession(newSession);
    audioEngine.start();
    setIsAudioPlaying(true);

    if (onSendToChat) {
      onSendToChat(`🕊️ Soft Landing Initiated (${durationMinutes}m breather): "${note}"`);
    }
  };

  const handleSaveReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    const req = customRequest.trim() || selectedRequest;
    const reflection: SoftLandingReflection = {
      feeling: selectedFeeling,
      underlyingNeed: selectedNeed,
      gentleRequest: req,
      isReady: true,
      submittedAt: 'Just now'
    };

    const isUser = activeUser === 'user';
    const updated: SoftLandingSession = {
      ...activeSession,
      userReflection: isUser ? reflection : activeSession.userReflection,
      partnerReflection: !isUser ? reflection : activeSession.partnerReflection,
      status: 'nvc_reflection'
    };

    onUpdateSession(updated);
  };

  const handleCompleteReconnection = () => {
    if (!activeSession) return;

    audioEngine.stop();
    setIsAudioPlaying(false);
    playReconnectionChime();

    const completedSession: SoftLandingSession = {
      ...activeSession,
      status: 'resolved',
      resolvedAt: Date.now()
    };

    onSaveToHistory(completedSession);
    onUpdateSession(null);

    if (onSendToChat) {
      onSendToChat('🕊️ Reconnected in safe harbor. We weathered the storm together with gentleness and love.');
    }
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isUser = activeUser === 'user';
  const myReflection = isUser ? activeSession?.userReflection : activeSession?.partnerReflection;
  const partnerReflection = isUser ? activeSession?.partnerReflection : activeSession?.userReflection;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-linen-surface rounded-2xl p-6 border border-linen-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200 mb-2">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            <span>Safe Harbor & Conflict Haven</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-linen-primary font-medium">
            Soft Landing Protocol
          </h1>
          <p className="text-sm text-linen-secondary mt-1 max-w-xl">
            A structured emotional safety valve for moments of overwhelm or misunderstanding. Takes space without triggering abandonment, soothes the nervous system, and guides reconnection.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('current')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'current'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-linen-variant text-linen-secondary hover:text-linen-primary'
            }`}
          >
            Sanctuary
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-linen-variant text-linen-secondary hover:text-linen-primary'
            }`}
          >
            History ({history.length})
          </button>
        </div>
      </div>

      {activeTab === 'history' ? (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="bg-linen-surface rounded-2xl p-12 border border-dashed border-linen-border text-center">
              <Shield className="w-10 h-10 text-indigo-300 mx-auto mb-2 opacity-60" />
              <h3 className="font-serif text-base font-medium text-linen-primary">No previous sessions</h3>
              <p className="text-xs text-linen-secondary mt-1">
                Resolved soft landing breathers will be archived here as testaments to your capacity to repair with love.
              </p>
            </div>
          ) : (
            history.map(item => (
              <div key={item.id} className="bg-linen-surface rounded-2xl p-5 border border-linen-border shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs text-linen-secondary pb-2 border-b border-linen-border/60">
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ✓ Weathered in Love
                  </span>
                  <span>{new Date(item.initiatedAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-linen-secondary italic">
                  “{item.loveReassuranceNote}”
                </p>
                {(item.userReflection || item.partnerReflection) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                    {item.userReflection && (
                      <div className="p-3 rounded-xl bg-linen-variant/40 border border-linen-border/60">
                        <span className="font-semibold text-linen-primary block mb-1">You felt:</span>
                        <p className="text-linen-secondary">{item.userReflection.feeling} · Needed {item.userReflection.underlyingNeed}</p>
                        <p className="mt-1 text-linen-primary italic font-serif">“{item.userReflection.gentleRequest}”</p>
                      </div>
                    )}
                    {item.partnerReflection && (
                      <div className="p-3 rounded-xl bg-linen-variant/40 border border-linen-border/60">
                        <span className="font-semibold text-linen-primary block mb-1">Partner felt:</span>
                        <p className="text-linen-secondary">{item.partnerReflection.feeling} · Needed {item.partnerReflection.underlyingNeed}</p>
                        <p className="mt-1 text-linen-primary italic font-serif">“{item.partnerReflection.gentleRequest}”</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeSession ? (
        /* ACTIVE SESSION SANCTUARY */
        <div className="space-y-6">
          {/* Live Countdown Card */}
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-800/60 text-center relative overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="inline-flex items-center space-x-2 text-xs font-medium uppercase tracking-widest text-indigo-300 bg-indigo-900/60 px-3 py-1 rounded-full border border-indigo-700/60 mb-4">
                <Clock className="w-3.5 h-3.5" />
                <span>Nervous System Reset Breather</span>
              </div>

              {/* Timer Display */}
              <div className="font-mono text-5xl sm:text-7xl font-light tracking-tight my-2 drop-shadow-md">
                {formatTime(secondsRemaining)}
              </div>

              <p className="text-xs sm:text-sm text-indigo-200/90 max-w-md mt-1 mb-6 font-serif italic">
                “{activeSession.loveReassuranceNote}”
              </p>

              {/* Audio & Control Buttons */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={toggleAudio}
                  className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isAudioPlaying
                      ? 'bg-indigo-500/40 text-indigo-100 border border-indigo-400/60'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                >
                  {isAudioPlaying ? <Volume2 className="w-4 h-4 text-indigo-300" /> : <VolumeX className="w-4 h-4" />}
                  <span>{isAudioPlaying ? '432Hz Reset Sound: On' : 'Play 432Hz Sound'}</span>
                </button>

                <button
                  onClick={handleCompleteReconnection}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-transform active:scale-95 cursor-pointer"
                >
                  <Handshake className="w-4 h-4" />
                  <span>Ready to Reconnect</span>
                </button>
              </div>
            </div>
          </div>

          {/* Guided NVC Reflection Form */}
          <div className="bg-linen-surface rounded-3xl p-6 sm:p-7 border border-linen-border shadow-sm space-y-5">
            <div>
              <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-700 mb-1">
                <Sparkles className="w-4 h-4" />
                <span>Nonviolent Self-Reflection (Private Sandbox)</span>
              </div>
              <h2 className="font-serif text-xl font-medium text-linen-primary">
                Sift Through the Noise to Find What Truly Matters
              </h2>
              <p className="text-xs text-linen-secondary mt-0.5">
                Answer these 3 gentle prompts. When both are ready, your gentle requests will be shared safely side-by-side.
              </p>
            </div>

            <form onSubmit={handleSaveReflection} className="space-y-4">
              {/* Step 1: Feeling */}
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1.5">
                  1. What is alive in your body right now?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FEELING_OPTIONS.map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSelectedFeeling(f)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                        selectedFeeling === f
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-medium'
                          : 'bg-linen-variant/40 border-linen-border text-linen-secondary hover:text-linen-primary'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Unmet Need */}
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1.5">
                  2. What core universal need was unmet in that moment?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {NEED_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSelectedNeed(n)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                        selectedNeed === n
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-medium'
                          : 'bg-linen-variant/40 border-linen-border text-linen-secondary hover:text-linen-primary'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Gentle Request */}
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1.5">
                  3. What gentle, doable request would help you reconnect?
                </label>
                <div className="space-y-1.5 mb-2">
                  {REQUEST_PRESETS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { setSelectedRequest(r); setCustomRequest(''); }}
                      className={`w-full text-left text-xs p-2.5 rounded-xl border transition-all ${
                        selectedRequest === r && !customRequest
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-medium'
                          : 'bg-linen-variant/30 border-linen-border text-linen-secondary hover:text-linen-primary'
                      }`}
                    >
                      “{r}”
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={customRequest}
                  onChange={e => setCustomRequest(e.target.value)}
                  placeholder="Or write a custom, gentle request..."
                  className="w-full px-3.5 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-xs focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-linen-border flex items-center justify-between">
                <div className="text-xs text-linen-secondary flex items-center space-x-1.5">
                  {myReflection ? (
                    <span className="text-emerald-600 font-medium flex items-center">
                      <Check className="w-4 h-4 mr-1" />
                      Reflection saved & ready
                    </span>
                  ) : (
                    <span>Take your time. No rush.</span>
                  )}
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs transition-transform active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{myReflection ? 'Update Reflection' : 'Save Reflection'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Reconnection Bridge: Both Partners Status */}
          <div className="bg-linen-surface rounded-2xl p-5 border border-linen-border space-y-4">
            <h3 className="font-serif text-base font-medium text-linen-primary flex items-center space-x-2">
              <Handshake className="w-4 h-4 text-indigo-600" />
              <span>Reconnection Status</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-linen-border bg-linen-variant/20">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-linen-primary">Your Status</span>
                  {myReflection?.isReady ? (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px] font-bold uppercase">
                      Ready
                    </span>
                  ) : (
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px] font-bold uppercase">
                      Reflecting
                    </span>
                  )}
                </div>
                {myReflection && (
                  <p className="text-xs text-linen-secondary italic mt-2 font-serif">
                    “{myReflection.gentleRequest}”
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl border border-linen-border bg-linen-variant/20">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-linen-primary">Partner's Status</span>
                  {partnerReflection?.isReady ? (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px] font-bold uppercase">
                      Ready
                    </span>
                  ) : (
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px] font-bold uppercase">
                      Reflecting
                    </span>
                  )}
                </div>
                {partnerReflection?.isReady ? (
                  <p className="text-xs text-linen-secondary italic mt-2 font-serif">
                    “{partnerReflection.gentleRequest}”
                  </p>
                ) : (
                  <p className="text-xs text-linen-secondary italic mt-2">
                    Partner is quietly taking their breather in safe harbor...
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleCompleteReconnection}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-semibold shadow-sm transition-transform active:scale-95 cursor-pointer"
              >
                <Heart className="w-4 h-4 fill-white" />
                <span>Complete Soft Landing & Reconnect</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* INITIATE BREATHER FORM */
        <div className="bg-linen-surface rounded-3xl p-6 sm:p-8 border border-linen-border shadow-sm space-y-6">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-indigo-600" />
              <span>Pause Before Flooding</span>
            </div>
            <h2 className="font-serif text-2xl font-medium text-linen-primary">
              Initiate a 20-Minute Safe Breather
            </h2>
            <p className="text-sm text-linen-secondary mt-1">
              Select a reassuring affirmation so your partner knows you are taking space out of love for the relationship, not out of withdrawal or abandonment.
            </p>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-2">
              Breather Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 20, 30, 45].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${
                    durationMinutes === mins
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-linen-variant/40 border-linen-border text-linen-secondary hover:text-linen-primary'
                  }`}
                >
                  {mins} mins
                </button>
              ))}
            </div>
          </div>

          {/* Reassurance Message Presets */}
          <div>
            <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-2">
              Reassurance Affirmation for Your Partner
            </label>
            <div className="space-y-2 mb-3">
              {REASSURANCE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { setReassuranceNote(preset); setCustomNote(''); }}
                  className={`w-full text-left p-3 rounded-2xl border text-xs leading-relaxed transition-all ${
                    reassuranceNote === preset && !customNote
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-medium ring-1 ring-indigo-500'
                      : 'bg-linen-variant/30 border-linen-border text-linen-secondary hover:bg-linen-variant/60'
                  }`}
                >
                  “{preset}”
                </button>
              ))}
            </div>

            <input
              type="text"
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              placeholder="Or type a custom reassuring note..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-xs focus:outline-hidden"
            />
          </div>

          {/* Action Trigger */}
          <div className="pt-4 border-t border-linen-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-linen-secondary">
              Both phones enter soothing 432Hz sanctuary mode.
            </span>

            <button
              onClick={handleStartBreather}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-medium shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Begin Soft Landing Breather</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
