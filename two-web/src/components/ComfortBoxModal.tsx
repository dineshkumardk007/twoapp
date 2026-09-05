import React, { useState, useEffect } from 'react';
import { 
  Heart, X, Sparkles, Wind, Image as ImageIcon, Volume2, 
  Shield, Send, Edit3, Check, Play, Pause, AlertCircle 
} from 'lucide-react';
import { ComfortBoxData } from '../types';
import { triggerGlobalPulse } from './SensoryPulseOverlay';

interface ComfortBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxData: ComfortBoxData;
  activeUser: 'user' | 'partner';
  onSaveBox: (data: ComfortBoxData) => void;
}

export const ComfortBoxModal: React.FC<ComfortBoxModalProps> = ({
  isOpen,
  onClose,
  boxData,
  activeUser,
  onSaveBox
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(boxData.reassuranceNote);
  const [photoUrlInput, setPhotoUrlInput] = useState(boxData.photoUrls.join('\n'));
  
  // 4-7-8 Somatic Breathing Engine State
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [breathSeconds, setBreathSeconds] = useState(4);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  // Calming Audio Chime for Breath Transitions
  const playSomaticTone = (freq: number, duration: number) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  };

  useEffect(() => {
    let timer: any = null;
    if (isBreathing) {
      timer = setInterval(() => {
        setBreathSeconds(prev => {
          if (prev <= 1) {
            // Transition phase
            if (breathPhase === 'Inhale') {
              setBreathPhase('Hold');
              playSomaticTone(432, 1.2);
              return 7;
            } else if (breathPhase === 'Hold') {
              setBreathPhase('Exhale');
              playSomaticTone(324, 1.8);
              return 8;
            } else {
              setBreathPhase('Inhale');
              setCyclesCompleted(c => c + 1);
              playSomaticTone(528, 1.5);
              return 4;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setBreathPhase('Inhale');
      setBreathSeconds(4);
    }
    return () => clearInterval(timer);
  }, [isBreathing, breathPhase]);

  const handleStartBreathing = () => {
    if (!isBreathing) {
      playSomaticTone(528, 1.5);
      setIsBreathing(true);
    } else {
      setIsBreathing(false);
    }
  };

  const handleSendWordlessHug = () => {
    triggerGlobalPulse('A wordless, unconditional hug • I am right here with you');
  };

  const handleSave = () => {
    const urls = photoUrlInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);

    onSaveBox({
      ...boxData,
      reassuranceNote: note,
      photoUrls: urls,
      updatedAt: 'Just now'
    });
    setIsEditing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-linen-surface text-linen-primary border border-linen-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-linen-border flex items-center justify-between bg-gradient-to-r from-linen-surface via-rose-50/40 to-linen-surface">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs">
              <Heart className="w-6 h-6 fill-rose-500 text-rose-500" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-medium tracking-tight text-linen-primary flex items-center space-x-2">
                <span>Emergency Comfort Box</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-sans font-normal border border-rose-200">
                  Open When Heavy
                </span>
              </h3>
              <p className="text-xs text-linen-secondary mt-0.5">
                Prepared with unconditional tenderness • No energy or explaining needed
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 rounded-xl text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
              title="Edit Comfort Box contents"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isEditing ? (
            /* Edit Mode */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-linen-primary mb-1.5">
                  Reassurance Anchor Note
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-2xl bg-linen-variant/40 border border-linen-border text-sm text-linen-primary focus:outline-hidden focus:border-linen-accent"
                  placeholder="Words to remind them that they are safe, loved, and do not have to carry everything alone..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-linen-primary mb-1.5">
                  Grounding Photo URLs (One per line)
                </label>
                <textarea
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-2xl bg-linen-variant/40 border border-linen-border text-xs font-mono text-linen-primary focus:outline-hidden focus:border-linen-accent"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs text-linen-secondary hover:bg-linen-variant"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 shadow-sm"
                >
                  Save Comfort Box
                </button>
              </div>
            </div>
          ) : (
            /* View & Comfort Mode */
            <>
              {/* Partner's Unconditional Love Note */}
              <div className="relative p-6 rounded-3xl bg-rose-50/50 border border-rose-100 text-linen-primary shadow-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 mb-1 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>A Message from Your Partner</span>
                </div>
                <p className="font-serif text-base sm:text-lg text-linen-primary leading-relaxed italic mt-2">
                  “{boxData.reassuranceNote}”
                </p>
                <div className="text-right mt-3 text-xs text-linen-secondary font-serif">
                  — Always with you, {boxData.authorName}
                </div>
              </div>

              {/* 4-7-8 Somatic Relaxation Breath Guide */}
              <div className="p-5 rounded-3xl bg-linen-variant/40 border border-linen-border flex flex-col items-center text-center space-y-3">
                <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-linen-accent">
                  <Wind className="w-4 h-4" />
                  <span>4-7-8 Somatic Parasympathetic Calming</span>
                </div>

                {/* Animated Breath Ring */}
                <div className="relative w-36 h-36 flex items-center justify-center my-2">
                  <div
                    className={`absolute inset-0 rounded-full border-4 border-rose-300 transition-all duration-1000 ${
                      isBreathing && breathPhase === 'Inhale'
                        ? 'scale-110 bg-rose-100/60'
                        : isBreathing && breathPhase === 'Hold'
                        ? 'scale-110 bg-amber-50/60 border-amber-300 animate-pulse'
                        : isBreathing && breathPhase === 'Exhale'
                        ? 'scale-90 bg-blue-50/40 border-blue-200'
                        : 'scale-100 bg-linen-surface/80'
                    }`}
                  />
                  <div className="relative z-10 flex flex-col items-center">
                    <span className="font-serif text-2xl font-semibold text-linen-primary">
                      {isBreathing ? breathSeconds : '4-7-8'}
                    </span>
                    <span className="text-xs font-medium text-linen-accent uppercase tracking-wider mt-0.5">
                      {isBreathing ? breathPhase : 'Breathe'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleStartBreathing}
                    className={`px-5 py-2 rounded-2xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-xs ${
                      isBreathing
                        ? 'bg-amber-700 text-white hover:bg-amber-800'
                        : 'bg-linen-primary text-linen-surface hover:opacity-90'
                    }`}
                  >
                    {isBreathing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    <span>{isBreathing ? 'Pause Breathing' : 'Start 4-7-8 Calm'}</span>
                  </button>

                  {cyclesCompleted > 0 && (
                    <span className="text-xs text-linen-secondary font-medium">
                      {cyclesCompleted} {cyclesCompleted === 1 ? 'cycle' : 'cycles'} complete
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-linen-secondary italic">
                  Inhale 4s • Hold gently 7s • Exhale slowly 8s • Signals safety to the nervous system.
                </p>
              </div>

              {/* Grounding Keepsake Photos */}
              {boxData.photoUrls.length > 0 && (
                <div className="space-y-2.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-linen-secondary flex items-center space-x-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Grounding Moments to Rest Your Eyes On</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {boxData.photoUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl overflow-hidden border border-linen-border bg-linen-variant h-36 shadow-xs relative group"
                      >
                        <img
                          src={url}
                          alt="Grounding memory"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Action: Wordless Hug */}
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-linen-primary">
                    Need your partner to know you're hurting?
                  </div>
                  <div className="text-[11px] text-linen-secondary">
                    Sends a silent haptic pulse and harmonic chime with zero need for words.
                  </div>
                </div>
                <button
                  onClick={handleSendWordlessHug}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors shadow-xs flex items-center space-x-1.5 shrink-0 ml-3"
                >
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  <span>Send Wordless Hug</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-linen-border bg-linen-surface flex items-center justify-between text-xs text-linen-secondary">
          <span className="flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted sovereign sanctuary</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-linen-variant hover:bg-linen-border text-linen-primary font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
