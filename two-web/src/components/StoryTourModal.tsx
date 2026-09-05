import React, { useState } from 'react';
import { Sparkles, Sun, ShieldAlert, HeartHandshake, Mic, Clock, ArrowRight, ArrowLeft, X, CheckCircle2 } from 'lucide-react';

interface StoryTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface TourAct {
  actNumber: number;
  time: string;
  title: string;
  subtitle: string;
  narrative: string;
  targetTab: string;
  tabName: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  preview: React.ReactNode;
}

export const StoryTourModal: React.FC<StoryTourModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const [currentActIndex, setCurrentActIndex] = useState(0);

  if (!isOpen) return null;

  const acts: TourAct[] = [
    {
      actNumber: 1,
      time: '08:15 AM',
      title: 'Morning Relational Weather',
      subtitle: 'Gentle check-ins without pressure or interrogation',
      narrative: 'Before jumping into morning demands, you check your emotional barometer. Rather than asking "Are you mad at me?", you glance at your partner\'s weather report to understand their inner state before words are even spoken.',
      targetTab: 'home',
      tabName: 'Today',
      icon: Sun,
      accentColor: 'text-amber-600 bg-amber-50 border-amber-200',
      preview: (
        <div className="p-4 rounded-xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Partner's Weather</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Synced Just Now</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-3xl">🌤️</div>
            <div>
              <div className="text-sm font-serif font-medium text-linen-primary">Light & Connected</div>
              <div className="text-xs text-linen-secondary">Slept deeply, feeling gentle and grounded</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <div className="p-2 rounded-lg bg-linen-variant/60">
              <span className="text-linen-secondary block text-[10px]">Social Battery</span>
              <strong className="text-linen-primary">75% (Warmed up)</strong>
            </div>
            <div className="p-2 rounded-lg bg-linen-variant/60">
              <span className="text-linen-secondary block text-[10px]">Craving</span>
              <strong className="text-linen-primary">Quiet coffee together</strong>
            </div>
          </div>
        </div>
      )
    },
    {
      actNumber: 2,
      time: '01:45 PM',
      title: 'The "Not About You" Shield',
      subtitle: 'Defusing defensiveness during workday stress',
      narrative: 'A stressful client call leaves you completely drained and irritable. Instead of giving cold, clipped answers that trigger defensive friction, you activate the "Not About You" shield with a single tap, reassuring your partner that your stress is external.',
      targetTab: 'home',
      tabName: 'Today Flag',
      icon: ShieldAlert,
      accentColor: 'text-orange-600 bg-orange-50 border-orange-200',
      preview: (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 space-y-2 shadow-xs">
          <div className="flex items-center space-x-2 text-amber-900 font-medium text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Active Relational Shield</span>
          </div>
          <p className="text-xs text-amber-950/80 leading-relaxed">
            "My energy is low or tense right now, but <strong>it is NOT about you or anything between us</strong>. Just tough work chaos. I love you."
          </p>
          <div className="text-[11px] text-amber-800 font-medium pt-1">
            ✓ Prevents misunderstanding & defensive spirals automatically.
          </div>
        </div>
      )
    },
    {
      actNumber: 3,
      time: '07:30 PM',
      title: 'Evening Spark & Invisible Load',
      subtitle: 'Curated conversation decks and equal collaboration',
      narrative: 'While unwinding on the sofa after dinner, you avoid doomscrolling and pull a card from the "Curious" intimate question deck. Meanwhile, you both glance at the mental load board to celebrate today\'s completed chores together.',
      targetTab: 'decks',
      tabName: 'Conversation Decks',
      icon: HeartHandshake,
      accentColor: 'text-rose-600 bg-rose-50 border-rose-200',
      preview: (
        <div className="p-4 rounded-xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-medium">Curious Deck • Card #18</span>
            <span className="text-linen-secondary text-[11px]">Playful & Vulnerable</span>
          </div>
          <p className="font-serif text-sm font-medium text-linen-primary italic leading-relaxed">
            "What is a small, quiet ritual from your childhood that you still secretly find comforting today?"
          </p>
          <div className="pt-2 border-t border-linen-border/60 flex items-center justify-between text-xs text-linen-secondary">
            <span>Dishes & Meal Prep: <strong>Balanced 50/50</strong></span>
            <span className="text-emerald-700 font-medium">✓ 4 Chores Complete</span>
          </div>
        </div>
      )
    },
    {
      actNumber: 4,
      time: '10:45 PM',
      title: 'Pillow Talk Voice Whisper',
      subtitle: 'Encrypted acoustic intimacy across any distance',
      narrative: 'When traveling or falling asleep in separate rooms, text feels too sterile. You tap the voice memo microphone to whisper a soft 15-second goodnight message, sealed with client-side AES-GCM encryption and rendered as a warm acoustic waveform.',
      targetTab: 'chat',
      tabName: 'Chat',
      icon: Mic,
      accentColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      preview: (
        <div className="p-4 rounded-xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-linen-accent font-semibold uppercase tracking-wider">Encrypted Audio Memo</span>
            <span className="text-[11px] text-linen-secondary">10:47 PM</span>
          </div>
          <div className="p-3 rounded-xl bg-linen-variant/80 border border-linen-border flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-linen-primary text-linen-surface flex items-center justify-center">
              ▶
            </div>
            <div className="flex-1 flex items-center space-x-1">
              {[4, 12, 24, 18, 28, 14, 20, 32, 16, 22, 10, 6].map((h, i) => (
                <div key={i} className="flex-1 bg-linen-primary/70 rounded-full" style={{ height: `${h}px` }} />
              ))}
            </div>
            <span className="text-xs font-mono text-linen-secondary">0:15</span>
          </div>
          <p className="text-[11px] text-linen-secondary italic">"Goodnight love, hear you in the morning..."</p>
        </div>
      )
    },
    {
      actNumber: 5,
      time: 'Anniversary',
      title: 'Sealed Time Capsule',
      subtitle: 'Memories locked until future milestones',
      narrative: 'During a special getaway, you snap a photo and write a heartfelt secret letter. You seal it inside a cryptographic time capsule, locked securely until your anniversary next autumn when it unlocks automatically.',
      targetTab: 'timeline',
      tabName: 'Memories & Timeline',
      icon: Clock,
      accentColor: 'text-purple-600 bg-purple-50 border-purple-200',
      preview: (
        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 font-medium">Time Capsule Sealed</span>
            <span className="text-purple-800 text-[11px]">Unlocks in 340 days</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg bg-purple-200 flex items-center justify-center text-xl">
              🔒
            </div>
            <div>
              <div className="font-serif text-sm font-medium text-linen-primary">Our Kyoto Trip & Anniversary Letter</div>
              <div className="text-xs text-linen-secondary">Locked until Oct 14, 2027 • AES-256 sealed</div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const currentAct = acts[currentActIndex];
  const Icon = currentAct.icon;

  const handleNext = () => {
    if (currentActIndex < acts.length - 1) {
      setCurrentActIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentActIndex > 0) {
      setCurrentActIndex(prev => prev - 1);
    }
  };

  const handleJumpToFeature = () => {
    if (onNavigateTab) {
      onNavigateTab(currentAct.targetTab);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 relative overflow-hidden">
        {/* Header with Close */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-linen-variant text-linen-accent">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-serif text-lg font-medium text-linen-primary">A Day in the Life with Two</h3>
              <p className="text-[11px] text-linen-secondary">5-act relational intimacy tour</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="grid grid-cols-5 gap-1.5">
          {acts.map((act, index) => (
            <button
              key={act.actNumber}
              onClick={() => setCurrentActIndex(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === currentActIndex
                  ? 'bg-linen-primary'
                  : index < currentActIndex
                  ? 'bg-linen-accent/60'
                  : 'bg-linen-border'
              }`}
            />
          ))}
        </div>

        {/* Act Banner */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className={`p-2 rounded-xl border text-xs font-semibold ${currentAct.accentColor}`}>
                <Icon className="w-4 h-4" />
              </span>
              <div>
                <span className="text-[10px] font-mono tracking-wider uppercase text-linen-accent">
                  Act {currentAct.actNumber} of 5 • {currentAct.time}
                </span>
                <h4 className="font-serif text-xl font-medium text-linen-primary leading-tight">
                  {currentAct.title}
                </h4>
              </div>
            </div>
            <button
              onClick={handleJumpToFeature}
              className="text-xs text-linen-accent hover:underline font-medium hidden sm:inline-block"
            >
              Jump to {currentAct.tabName} →
            </button>
          </div>

          <p className="text-xs sm:text-sm text-linen-secondary leading-relaxed">
            {currentAct.narrative}
          </p>

          {/* Interactive Feature Visual Preview */}
          <div className="pt-2">
            {currentAct.preview}
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="pt-4 border-t border-linen-border flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentActIndex === 0}
            className={`inline-flex items-center px-3 py-2 rounded-xl text-xs font-medium border border-linen-border transition-colors ${
              currentActIndex === 0
                ? 'opacity-40 cursor-not-allowed bg-linen-variant'
                : 'hover:bg-linen-variant text-linen-primary'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Previous
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleJumpToFeature}
              className="px-3 py-2 rounded-xl border border-linen-border text-linen-secondary hover:text-linen-primary text-xs font-medium transition-colors"
            >
              Open {currentAct.tabName}
            </button>

            <button
              onClick={handleNext}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-linen-primary text-linen-surface hover:opacity-90 text-xs font-medium transition-opacity"
            >
              {currentActIndex === acts.length - 1 ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Finish Tour
                </>
              ) : (
                <>
                  Next Act
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
