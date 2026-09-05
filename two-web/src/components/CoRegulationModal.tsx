import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Volume2, VolumeX, Heart, Sparkles, Wind, Users, Activity, Play, Pause, RefreshCw } from 'lucide-react';
import { BreathPatternType, BreathPatternConfig, CoRegulationSession } from '../types';
import { coRegulationAudio } from '../core/coRegulationAudio';
import { wsRelay } from '../core/ws';

interface CoRegulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: 'user' | 'partner';
}

const PATTERNS: Record<BreathPatternType, BreathPatternConfig> = {
  '4-7-8': {
    id: '4-7-8',
    name: '4-7-8 Deep Sanctuary',
    subtitle: 'Parasympathetic reset for sleep, soothing overstimulation & deep peace',
    inhale: 4,
    holdIn: 7,
    exhale: 8,
    holdOut: 0,
    totalDuration: 19
  },
  'box': {
    id: 'box',
    name: '4-4-4-4 Box Grounding',
    subtitle: 'Steady equilibrium to center anxious thoughts and regain emotional clarity',
    inhale: 4,
    holdIn: 4,
    exhale: 4,
    holdOut: 4,
    totalDuration: 16
  },
  'gentle': {
    id: 'gentle',
    name: '4-6 Vagus Nerve Ease',
    subtitle: 'Effortless extended exhale promoting immediate somatic safety',
    inhale: 4,
    holdIn: 0,
    exhale: 6,
    holdOut: 0,
    totalDuration: 10
  }
};

type BreathPhase = 'inhale' | 'holdIn' | 'exhale' | 'holdOut';

export const CoRegulationModal: React.FC<CoRegulationModalProps> = ({
  isOpen,
  onClose,
  activeUser
}) => {
  const [patternType, setPatternType] = useState<BreathPatternType>('4-7-8');
  const [isActive, setIsActive] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [heartbeatEnabled, setHeartbeatEnabled] = useState<boolean>(false);
  const [thetaDroneEnabled, setThetaDroneEnabled] = useState<boolean>(true);
  const [partnerActive, setPartnerActive] = useState<boolean>(false);
  const [completedCycles, setCompletedCycles] = useState<number>(0);
  const [targetCycles, setTargetCycles] = useState<number>(6);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Current sub-second progress for fluid animations
  const [currentPhase, setCurrentPhase] = useState<BreathPhase>('inhale');
  const [phaseSecondsRemaining, setPhaseSecondsRemaining] = useState<number>(4);
  const [phaseProgress, setPhaseProgress] = useState<number>(0); // 0 to 1

  const currentPattern = useMemo(() => PATTERNS[patternType], [patternType]);
  const lastPhaseRef = useRef<BreathPhase>('inhale');
  const heartbeatIntervalRef = useRef<any>(null);

  // Broadcast sync state when changed
  const broadcastBreathState = (active: boolean, newStartTime: number, newPattern: BreathPatternType) => {
    wsRelay.broadcastUpdate('BREATH_SYNC', {
      isActive: active,
      pattern: newPattern,
      startedAt: newStartTime,
      initiatorId: activeUser,
      targetCycles,
      completedCycles,
      soundEnabled,
      heartbeatEnabled
    });
  };

  // Listen for remote breath sync from partner
  useEffect(() => {
    const unsub = wsRelay.subscribe((msg) => {
      if (msg.type === 'REMOTE_RECORD' && msg.record?.type === 'BREATH_SYNC') {
        try {
          const data = JSON.parse(msg.record.payload);
          if (msg.record.authorId !== activeUser) {
            setPartnerActive(data.isActive);
            if (data.isActive && !isActive) {
              setPatternType(data.pattern);
              setStartTime(data.startedAt);
              setIsActive(true);
            } else if (!data.isActive && isActive) {
              setPartnerActive(false);
            }
          }
        } catch (e) {
          console.error('[CoRegulation] sync parse error', e);
        }
      }
    });

    return () => unsub();
  }, [activeUser, isActive]);

  // Handle Heartbeat Audio Interval (~60 bpm = 1000ms)
  useEffect(() => {
    if (isActive && heartbeatEnabled && soundEnabled) {
      heartbeatIntervalRef.current = setInterval(() => {
        coRegulationAudio.playHeartbeat();
      }, 1000);
    } else {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [isActive, heartbeatEnabled, soundEnabled]);

  // Handle Theta Drone Audio
  useEffect(() => {
    if (isActive && thetaDroneEnabled && soundEnabled) {
      coRegulationAudio.startThetaDrone();
    } else {
      coRegulationAudio.stopThetaDrone();
    }

    return () => {
      coRegulationAudio.stopThetaDrone();
    };
  }, [isActive, thetaDroneEnabled, soundEnabled]);

  // High-frequency animation loop & phase transition detector
  useEffect(() => {
    if (!isActive || !startTime) return;

    let animFrame: number;

    const tick = () => {
      const now = Date.now();
      const elapsedTotalMs = now - startTime;
      const cycleMs = currentPattern.totalDuration * 1000;
      const currentCycleIndex = Math.floor(elapsedTotalMs / cycleMs);
      setCompletedCycles(currentCycleIndex);

      if (targetCycles > 0 && currentCycleIndex >= targetCycles) {
        setIsActive(false);
        setIsFinished(true);
        coRegulationAudio.stopThetaDrone();
        broadcastBreathState(false, 0, patternType);
        return;
      }

      const elapsedInCycleMs = elapsedTotalMs % cycleMs;
      const elapsedInCycleSec = elapsedInCycleMs / 1000;

      const inhaleEnd = currentPattern.inhale;
      const holdInEnd = inhaleEnd + currentPattern.holdIn;
      const exhaleEnd = holdInEnd + currentPattern.exhale;

      let phase: BreathPhase;
      let phaseStart = 0;
      let phaseDuration = currentPattern.inhale;

      if (elapsedInCycleSec < inhaleEnd) {
        phase = 'inhale';
        phaseStart = 0;
        phaseDuration = currentPattern.inhale;
      } else if (elapsedInCycleSec < holdInEnd) {
        phase = 'holdIn';
        phaseStart = inhaleEnd;
        phaseDuration = currentPattern.holdIn;
      } else if (elapsedInCycleSec < exhaleEnd) {
        phase = 'exhale';
        phaseStart = holdInEnd;
        phaseDuration = currentPattern.exhale;
      } else {
        phase = 'holdOut';
        phaseStart = exhaleEnd;
        phaseDuration = currentPattern.holdOut;
      }

      const elapsedInPhase = elapsedInCycleSec - phaseStart;
      const remainingSec = Math.max(0, Math.ceil(phaseDuration - elapsedInPhase));
      const progress = Math.min(1, Math.max(0, elapsedInPhase / phaseDuration));

      setCurrentPhase(phase);
      setPhaseSecondsRemaining(remainingSec);
      setPhaseProgress(progress);

      // Phase change transition trigger (audio chime + mobile haptic)
      if (lastPhaseRef.current !== phase) {
        lastPhaseRef.current = phase;
        if (soundEnabled) {
          coRegulationAudio.playPhaseChime(phase);
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            if (phase === 'inhale') navigator.vibrate([60]);
            else if (phase === 'holdIn') navigator.vibrate([30, 40, 30]);
            else if (phase === 'exhale') navigator.vibrate([80]);
            else navigator.vibrate([20]);
          } catch (_) {}
        }
      }

      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animFrame);
  }, [isActive, startTime, currentPattern, targetCycles, patternType, soundEnabled]);

  const handleToggleSession = () => {
    if (!isActive) {
      const now = Date.now();
      setStartTime(now);
      setIsActive(true);
      setIsFinished(false);
      setCompletedCycles(0);
      lastPhaseRef.current = 'inhale';
      if (soundEnabled) {
        coRegulationAudio.playPhaseChime('inhale');
      }
      broadcastBreathState(true, now, patternType);
    } else {
      setIsActive(false);
      coRegulationAudio.stopThetaDrone();
      broadcastBreathState(false, 0, patternType);
    }
  };

  const handleSelectPattern = (newPattern: BreathPatternType) => {
    setPatternType(newPattern);
    if (isActive) {
      const now = Date.now();
      setStartTime(now);
      setCompletedCycles(0);
      lastPhaseRef.current = 'inhale';
      broadcastBreathState(true, now, newPattern);
    }
  };

  if (!isOpen) return null;

  // Visual calculation for breathing orb scale and glow
  let scale = 1.0;
  let phaseText = 'Inhale Gently';
  let phaseInstruction = 'Breathe in slowly through the nose, filling your lower lungs...';
  let orbGradient = 'from-rose-400 via-amber-200 to-rose-300';
  let glowColor = 'rgba(244, 114, 182, 0.45)';

  if (isActive) {
    if (currentPhase === 'inhale') {
      scale = 0.85 + 0.5 * phaseProgress;
      phaseText = 'Inhale Peace';
      phaseInstruction = 'Slowly fill your belly with calm air through your nose...';
      orbGradient = 'from-rose-400 via-rose-300 to-amber-200';
      glowColor = 'rgba(251, 146, 60, 0.4)';
    } else if (currentPhase === 'holdIn') {
      scale = 1.35;
      phaseText = 'Gently Hold';
      phaseInstruction = 'Rest in stillness. Feel your chest warm and supported...';
      orbGradient = 'from-amber-300 via-rose-300 to-indigo-300';
      glowColor = 'rgba(245, 158, 11, 0.45)';
    } else if (currentPhase === 'exhale') {
      scale = 1.35 - 0.5 * phaseProgress;
      phaseText = 'Release & Let Go';
      phaseInstruction = 'Slowly whisper out all tension through relaxed lips...';
      orbGradient = 'from-indigo-400 via-sky-300 to-teal-200';
      glowColor = 'rgba(99, 102, 241, 0.4)';
    } else {
      scale = 0.85;
      phaseText = 'Quiet Rest';
      phaseInstruction = 'Grounded stillness before the next breath arrives...';
      orbGradient = 'from-teal-300 via-linen-secondary to-indigo-300';
      glowColor = 'rgba(20, 184, 166, 0.35)';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-linen-surface border border-linen-border rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col relative max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-linen-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs">
              <Wind className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif text-lg font-medium text-linen-primary">Co-Regulation Sanctuary</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  432Hz Bio-Sync
                </span>
              </div>
              <p className="text-xs text-linen-secondary">
                Synchronized parasympathetic breathing across physical distance
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isActive) handleToggleSession();
              onClose();
            }}
            className="p-2 text-linen-secondary hover:text-linen-primary hover:bg-linen-variant rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Partner Connection Banner */}
        <div className="px-6 py-2.5 bg-gradient-to-r from-linen-variant/40 via-linen-surface to-linen-variant/40 border-b border-linen-border/60 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${partnerActive ? 'bg-emerald-500 animate-ping' : 'bg-linen-accent/50'}`} />
            <span className="text-linen-primary font-medium">
              {partnerActive ? 'Partner is breathing in sync with you now ✨' : 'Waiting for partner • Breathing solo'}
            </span>
          </div>
          <button
            onClick={() => {
              wsRelay.broadcastUpdate('PULSE', {
                sender: activeUser,
                note: 'Invited you to Co-Regulation Sanctuary 🫀'
              });
              if (!isActive) handleToggleSession();
            }}
            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center space-x-1"
            title="Sends instant gentle sensory pulse invite"
          >
            <Users className="w-3 h-3" />
            <span>Invite Partner</span>
          </button>
        </div>

        {/* Main Breathing Stage */}
        <div className="p-6 sm:p-8 flex-1 flex flex-col items-center justify-center min-h-[340px] relative overflow-hidden bg-radial from-linen-variant/20 via-linen-surface to-linen-bg/80">
          {/* Subtle Ambient Background Water Ripples */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20 transition-all duration-1000"
            style={{
              background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 65%)`
            }}
          />

          {isFinished ? (
            /* Session Completed Card */
            <div className="text-center py-8 px-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 mx-auto flex items-center justify-center mb-4 shadow-md">
                <Sparkles className="w-8 h-8" />
              </div>
              <h4 className="font-serif text-2xl font-medium text-linen-primary mb-2">Nervous Systems Calmed</h4>
              <p className="text-sm text-linen-secondary max-w-sm mx-auto leading-relaxed mb-6">
                You shared {targetCycles} deep breaths together. Your heart rates, vagal tone, and emotional presence are now centered.
              </p>
              <button
                onClick={() => {
                  setIsFinished(false);
                  handleToggleSession();
                }}
                className="px-5 py-2.5 rounded-2xl bg-linen-primary text-linen-surface text-xs font-semibold hover:opacity-90 transition-opacity inline-flex items-center space-x-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Begin Another Round</span>
              </button>
            </div>
          ) : (
            /* Live Breathing Orb */
            <>
              <div className="relative flex items-center justify-center my-6">
                {/* Outer Glow Halo Ring */}
                <div
                  className="absolute w-60 h-60 sm:w-68 sm:h-68 rounded-full pointer-events-none transition-transform duration-300 ease-out blur-xl"
                  style={{
                    transform: `scale(${scale * 1.15})`,
                    backgroundColor: glowColor,
                    opacity: isActive ? 0.6 : 0.2
                  }}
                />

                {/* Secondary Ripple Wave */}
                <div
                  className="absolute w-52 h-52 sm:w-60 sm:h-60 rounded-full border border-rose-300/40 pointer-events-none transition-transform duration-500 ease-out"
                  style={{
                    transform: `scale(${scale * 1.05})`
                  }}
                />

                {/* Primary Pulsating Liquid Orb */}
                <div
                  className={`w-44 h-44 sm:w-52 sm:h-52 rounded-full shadow-2xl flex flex-col items-center justify-center text-center p-4 text-white relative transition-transform duration-150 ease-out bg-gradient-to-tr ${orbGradient}`}
                  style={{
                    transform: `scale(${scale})`,
                    boxShadow: `0 10px 40px -10px ${glowColor}`
                  }}
                >
                  <span className="font-serif text-xl sm:text-2xl font-medium tracking-wide drop-shadow-sm text-stone-900">
                    {isActive ? phaseText : 'Ready to Breathe'}
                  </span>

                  {isActive ? (
                    <span className="text-3xl sm:text-4xl font-mono font-semibold my-1 text-stone-800 drop-shadow-xs">
                      {phaseSecondsRemaining}s
                    </span>
                  ) : (
                    <span className="text-xs text-stone-700/80 mt-2 font-medium">
                      Tap Start below
                    </span>
                  )}

                  {isActive && (
                    <span className="text-[11px] text-stone-700 uppercase tracking-widest font-semibold">
                      Cycle {completedCycles + 1} / {targetCycles}
                    </span>
                  )}
                </div>
              </div>

              {/* Soothing Somatic Guidance */}
              <p className="text-center text-xs sm:text-sm text-linen-secondary font-serif italic max-w-sm mt-3 h-10 transition-opacity duration-300">
                {isActive ? phaseInstruction : currentPattern.subtitle}
              </p>
            </>
          )}
        </div>

        {/* Breath Pattern Selector */}
        <div className="p-4 border-t border-linen-border bg-linen-variant/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-linen-secondary">
              Breathing Rhythm
            </span>
            <span className="text-xs text-linen-accent font-medium">
              {currentPattern.name} ({currentPattern.totalDuration}s/cycle)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PATTERNS) as BreathPatternType[]).map((type) => {
              const p = PATTERNS[type];
              const isSelected = patternType === type;
              return (
                <button
                  key={type}
                  onClick={() => handleSelectPattern(type)}
                  className={`p-2.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'border-rose-300 bg-rose-50/70 text-rose-900 shadow-xs'
                      : 'border-linen-border bg-linen-surface hover:bg-linen-variant/60 text-linen-primary'
                  }`}
                >
                  <span className="block text-xs font-semibold">{p.id}</span>
                  <span className="block text-[10px] text-linen-secondary truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Audio & Haptic Controls Bar */}
        <div className="p-4 border-t border-linen-border flex flex-wrap items-center justify-between gap-3 bg-linen-surface">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Audio Master Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs font-medium inline-flex items-center space-x-1.5 transition-colors ${
                soundEnabled
                  ? 'border-linen-border bg-linen-variant text-linen-primary'
                  : 'border-linen-border/40 text-linen-secondary opacity-60'
              }`}
              title="432Hz Harmonic Phase Bells"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-rose-600" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">432Hz Chimes</span>
            </button>

            {/* Theta Drone Toggle */}
            <button
              onClick={() => setThetaDroneEnabled(!thetaDroneEnabled)}
              className={`p-2 rounded-xl border text-xs font-medium inline-flex items-center space-x-1.5 transition-colors ${
                thetaDroneEnabled
                  ? 'border-linen-border bg-linen-variant text-linen-primary'
                  : 'border-linen-border/40 text-linen-secondary opacity-60'
              }`}
              title="Continuous 6Hz Theta Brainwave Drone"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Theta Wave</span>
            </button>

            {/* Resting Heartbeat Sound Toggle */}
            <button
              onClick={() => setHeartbeatEnabled(!heartbeatEnabled)}
              className={`p-2 rounded-xl border text-xs font-medium inline-flex items-center space-x-1.5 transition-colors ${
                heartbeatEnabled
                  ? 'border-linen-border bg-rose-50 text-rose-700 border-rose-200'
                  : 'border-linen-border/40 text-linen-secondary opacity-60'
              }`}
              title="Acoustic 60bpm Chest Resonance"
            >
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              <span className="hidden sm:inline">Heartbeat</span>
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handleToggleSession}
            className={`px-6 py-2.5 rounded-2xl text-xs font-semibold inline-flex items-center space-x-2 transition-all shadow-md cursor-pointer ${
              isActive
                ? 'bg-stone-800 text-stone-100 hover:bg-stone-700'
                : 'bg-rose-600 text-white hover:bg-rose-500'
            }`}
          >
            {isActive ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause Breath</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Begin Co-Regulation</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
