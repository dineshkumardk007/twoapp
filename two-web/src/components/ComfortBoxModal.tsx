import React, { useState, useEffect } from 'react';
import { 
  Heart, X, Sparkles, Wind, Image as ImageIcon, Volume2, 
  Shield, Send, Edit3, Check, Play, Pause, AlertCircle 
} from 'lucide-react';
import { ComfortBoxData } from '../types';
import { triggerGlobalPulse } from './SensoryPulseOverlay';
import { CoRegulationModal } from './CoRegulationModal';
import { getAudioContext } from '../core/audioAlerts';
import { playSound } from '../core/sounds';
import { useBackLayer } from '../core/backStack';

interface ComfortBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxData: ComfortBoxData;
  activeUser: 'user' | 'partner';
  onSaveBox: (data: ComfortBoxData) => void;
  /** The other person's name, for whose note this is. */
  partnerName?: string;
  /** This person's own name, saved with a note they write. */
  myName?: string;
}

export const ComfortBoxModal: React.FC<ComfortBoxModalProps> = ({
  isOpen,
  onClose,
  boxData,
  activeUser,
  onSaveBox,
  partnerName,
  myName
}) => {
  const partner = partnerName?.trim() || 'Partner';
  const hasNote = !!boxData.reassuranceNote?.trim();
  // The seat on the box says who wrote it; worked out here, on the phone
  // showing it, so each of you sees the other's name on the other's note.
  const fromMe = boxData.authorId === activeUser;

  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(boxData.reassuranceNote);
  const [photoUrlInput, setPhotoUrlInput] = useState(boxData.photoUrls.join('\n'));
  const [showCoRegulation, setShowCoRegulation] = useState(false);
  
  // 4-7-8 Somatic Breathing Engine State
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');
  const [breathSeconds, setBreathSeconds] = useState(4);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  // Breathing cues on a singing bowl. Called with the frequency the phase used
  // to be tuned to: 432 entering hold, 324 entering the out-breath, 528 the in-breath.
  const playSomaticTone = (freq: number, _duration: number) => {
    playSound(freq === 432 ? 'breath-hold' : freq === 324 ? 'breath-out' : 'breath-in');
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
      // Whoever saves it wrote it. Keeping the earlier author's seat and name
      // labelled a note you had just written as theirs.
      authorId: activeUser,
      // A name rather than "You": a phone on an older version shows this
      // as it is, under the note, on the other person's screen.
      authorName: myName?.trim() || (activeUser === 'user' ? 'You' : 'Partner'),
      reassuranceNote: note,
      photoUrls: urls,
      updatedAt: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    });
    setIsEditing(false);
  };

  /** Opens the editor on what the box holds now, not on what it held when this first appeared. */
  const startEditing = () => {
    setNote(boxData.reassuranceNote || '');
    setPhotoUrlInput((boxData.photoUrls || []).join('\n'));
    setIsEditing(true);
  };

  // The phone's Back button closes this, the same as its X.
  useBackLayer(isOpen, onClose);

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
              onClick={() => (isEditing ? setIsEditing(false) : startEditing())}
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
              {/* The note in the box - or, until one of you writes it, an
                  honest empty box. */}
              {hasNote ? (
                <div className="relative p-6 rounded-3xl bg-rose-50/50 border border-rose-100 text-linen-primary shadow-xs">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 mb-1 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{fromMe ? `Your note for ${partner}` : `A message from ${partner}`}</span>
                  </div>
                  <p className="select-text font-serif text-base sm:text-lg text-linen-primary leading-relaxed italic mt-2">
                    “{boxData.reassuranceNote}”
                  </p>
                  {!fromMe && (
                    <div className="text-right mt-3 text-xs text-linen-secondary font-serif">
                      — Always with you, {partner}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-3xl bg-linen-variant/40 border border-linen-border text-center space-y-3">
                  <p className="font-serif text-base text-linen-primary">Nothing in the box yet</p>
                  <p className="text-xs text-linen-secondary leading-relaxed">
                    Leave a few words for {partner} to find on a heavy day. They will be here whenever
                    the box is opened.
                  </p>
                  <button
                    onClick={startEditing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Write a note
                  </button>
                </div>
              )}

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

                <div className="flex flex-wrap items-center gap-2.5">
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

                  <button
                    onClick={() => setShowCoRegulation(true)}
                    className="px-4 py-2 rounded-2xl text-xs font-semibold flex items-center space-x-1.5 border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors shadow-2xs"
                  >
                    <Wind className="w-4 h-4 text-teal-600" />
                    <span>Sync with Partner</span>
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

      <CoRegulationModal
        isOpen={showCoRegulation}
        onClose={() => setShowCoRegulation(false)}
        activeUser={activeUser}
      />
    </div>
  );
};
