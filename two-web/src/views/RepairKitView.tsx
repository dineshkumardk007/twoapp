import React, { useState, useEffect } from 'react';
import { AgreementItem } from '../types';
import { Handshake, Search, Clock, Lock, Sparkles, Heart, Play, Pause, RotateCcw, CheckCircle } from 'lucide-react';

interface RepairKitViewProps {
  agreements: AgreementItem[];
  activeUser: 'user' | 'partner';
  onAddAgreement: (agreement: Omit<AgreementItem, 'id'>) => void;
}

export const RepairKitView: React.FC<RepairKitViewProps> = ({ agreements, activeUser, onAddAgreement }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Cool-down, 2: Private Reflection, 3: Mirror & Reveal, 4: Agreement Log

  // Cooldown Breathing Timer
  const [timerDuration, setTimerDuration] = useState<number>(300); // 5 mins in seconds
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [breathingPhase, setBreathingPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');

  // Reflection inputs
  const [feltText, setFeltText] = useState('');
  const [neededText, setNeededText] = useState('');
  const [myPartText, setMyPartText] = useState('');
  const [mirrorText, setMirrorText] = useState('');

  // Agreement Log search
  const [searchQuery, setSearchQuery] = useState('');

  // New Agreement Form
  const [newTitle, setNewTitle] = useState('');
  const [newTrigger, setNewTrigger] = useState('');
  const [newResolution, setNewResolution] = useState('');

  // Timer effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  // Breathing cycle animation effect (4s inhale, 4s hold, 4s exhale)
  useEffect(() => {
    let breathInterval: any = null;
    if (isTimerRunning) {
      breathInterval = setInterval(() => {
        setBreathingPhase((prev) => {
          if (prev === 'Inhale') return 'Hold';
          if (prev === 'Hold') return 'Exhale';
          return 'Inhale';
        });
      }, 4000);
    }
    return () => clearInterval(breathInterval);
  }, [isTimerRunning]);

  const handleSelectDuration = (seconds: number) => {
    setIsTimerRunning(false);
    setTimerDuration(seconds);
    setTimeLeft(seconds);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const partnerName = activeUser === 'user' ? 'Partner' : 'You';

  const emotionChips = [
    'Unheard', 'Defensive', 'Overwhelmed', 'Dismissed', 'Rushed',
    'Lonely', 'Anxious', 'Pressured', 'Unappreciated'
  ];

  const needChips = [
    'Gentleness', 'Decompression window', 'Uninterrupted listening',
    'Affection', 'Reassurance', 'Shared responsibility', 'Validation'
  ];

  const handleSaveAgreement = () => {
    if (!newTitle.trim() || !newResolution.trim()) return;
    onAddAgreement({
      title: newTitle.trim(),
      trigger: newTrigger.trim() || 'Emotional friction or stress',
      resolution: newResolution.trim(),
      date: 'Today'
    });
    setNewTitle('');
    setNewTrigger('');
    setNewResolution('');
    setStep(4);
  };

  const filteredAgreements = agreements.filter(
    a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
         a.resolution.toLowerCase().includes(searchQuery.toLowerCase()) ||
         a.trigger.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium text-linen-primary">Conflict Repair Kit</h2>
          <p className="text-sm text-linen-secondary">4-stage de-escalation protocol & permanent agreement archive.</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setStep(1)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              step < 4 ? 'bg-linen-primary text-linen-surface' : 'bg-linen-variant text-linen-primary border-linen-border'
            }`}
          >
            Guided Protocol
          </button>
          <button
            onClick={() => setStep(4)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              step === 4 ? 'bg-linen-primary text-linen-surface' : 'bg-linen-variant text-linen-primary border-linen-border'
            }`}
          >
            Agreement Archive ({agreements.length})
          </button>
        </div>
      </div>

      {/* STEP 1: Regulated Cooldown & Breathing Timer */}
      {step === 1 && (
        <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-semibold text-linen-accent uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            <span>Stage 1 of 4: Regulated Nervous System Cooldown</span>
          </div>
          <div>
            <h3 className="font-serif text-xl font-medium text-linen-primary">Soothe Physiological Arousal First</h3>
            <p className="text-xs sm:text-sm text-linen-secondary mt-1 leading-relaxed">
              When heart rates surpass 100 BPM, empathy centers shut down. Take a pause to breathe, step back, and allow cortisol to clear before attempting to resolve the situation.
            </p>
          </div>

          {/* Interactive Breathing & Timer Display */}
          <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-gradient-to-b from-linen-variant/40 to-linen-variant/20 border border-linen-border text-center">
            {/* Breathing Ring */}
            <div className="relative flex items-center justify-center w-36 h-36 mb-4">
              <div
                className={`absolute inset-0 rounded-full bg-linen-accent/15 transition-transform duration-1000 ease-in-out ${
                  isTimerRunning
                    ? breathingPhase === 'Inhale'
                      ? 'scale-125'
                      : breathingPhase === 'Hold'
                      ? 'scale-125 opacity-75'
                      : 'scale-90 opacity-40'
                    : 'scale-100'
                }`}
              />
              <div className="z-10 flex flex-col items-center">
                <span className="font-serif text-3xl font-medium text-linen-primary font-mono tracking-tight">
                  {formatTimer(timeLeft)}
                </span>
                {isTimerRunning && (
                  <span className="text-[11px] font-medium text-linen-accent uppercase tracking-wider mt-1">
                    {breathingPhase}
                  </span>
                )}
              </div>
            </div>

            {/* Duration Selector */}
            <div className="flex space-x-2 mb-4">
              {[180, 300, 900, 2700].map((sec) => (
                <button
                  key={sec}
                  onClick={() => handleSelectDuration(sec)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${
                    timerDuration === sec
                      ? 'bg-linen-primary text-linen-surface font-medium'
                      : 'bg-linen-surface text-linen-secondary border border-linen-border hover:bg-linen-variant'
                  }`}
                >
                  {sec === 180 ? '3m' : sec === 300 ? '5m' : sec === 900 ? '15m' : '45m'}
                </button>
              ))}
            </div>

            {/* Timer Controls */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="px-5 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 flex items-center space-x-1.5 shadow-xs"
              >
                {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isTimerRunning ? 'Pause Timer' : 'Start Cooldown'}</span>
              </button>

              <button
                onClick={() => handleSelectDuration(timerDuration)}
                className="p-2 rounded-xl border border-linen-border text-linen-secondary hover:text-linen-primary hover:bg-linen-surface transition-colors"
                title="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full py-3 bg-linen-primary text-linen-surface font-medium text-sm rounded-xl hover:opacity-95 transition-opacity"
          >
            I Feel Regulated &rarr; Begin Structured Reflections
          </button>
        </div>
      )}

      {/* STEP 2: "I Feel... When..." Phrasing Assistant */}
      {step === 2 && (
        <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-semibold text-linen-accent uppercase tracking-wider">
            <Lock className="w-4 h-4" />
            <span>Stage 2 of 4: Confidential "I Feel... When..." Reflection</span>
          </div>
          <div>
            <h3 className="font-serif text-xl font-medium text-linen-primary">Express Your Vulnerable Experience</h3>
            <p className="text-xs sm:text-sm text-linen-secondary mt-1 leading-relaxed">
              Use non-accusatory language. These reflections remain locally sealed under your private key until both partners tap Reveal.
            </p>
          </div>

          <div className="space-y-5">
            {/* 1. Emotion */}
            <div>
              <label className="block text-xs font-medium text-linen-primary mb-1">
                1. What core emotion was activated inside me?
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {emotionChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setFeltText(prev => prev ? `${prev}, ${chip}` : chip)}
                    className="text-[11px] px-2.5 py-0.5 rounded-full border border-linen-border bg-linen-variant/40 hover:bg-linen-variant text-linen-primary transition-colors"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={feltText}
                onChange={(e) => setFeltText(e.target.value)}
                placeholder="e.g., Unheard, defensive, overwhelmed..."
                className="w-full px-4 py-2.5 rounded-xl border border-linen-border bg-linen-variant/20 text-xs focus:outline-none focus:ring-1 focus:ring-linen-accent"
              />
            </div>

            {/* 2. Need */}
            <div>
              <label className="block text-xs font-medium text-linen-primary mb-1">
                2. What was my underlying relational need?
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {needChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setNeededText(prev => prev ? `${prev}, ${chip}` : chip)}
                    className="text-[11px] px-2.5 py-0.5 rounded-full border border-linen-border bg-linen-variant/40 hover:bg-linen-variant text-linen-primary transition-colors"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={neededText}
                onChange={(e) => setNeededText(e.target.value)}
                placeholder="e.g., Gentleness, time to transition, reassurance..."
                className="w-full px-4 py-2.5 rounded-xl border border-linen-border bg-linen-variant/20 text-xs focus:outline-none focus:ring-1 focus:ring-linen-accent"
              />
            </div>

            {/* 3. My Part */}
            <div>
              <label className="block text-xs font-medium text-linen-primary mb-1">
                3. What was my part in how things unfolded?
              </label>
              <input
                type="text"
                value={myPartText}
                onChange={(e) => setMyPartText(e.target.value)}
                placeholder="e.g., My tone was sharp; I shut down without explaining why..."
                className="w-full px-4 py-2.5 rounded-xl border border-linen-border bg-linen-variant/20 text-xs focus:outline-none focus:ring-1 focus:ring-linen-accent"
              />
            </div>
          </div>

          <button
            onClick={() => setStep(3)}
            disabled={!feltText || !neededText || !myPartText}
            className="w-full py-3 bg-linen-primary text-linen-surface font-medium text-sm rounded-xl hover:opacity-95 disabled:opacity-40 transition-opacity"
          >
            Submit & Unlock Mutual Understanding &rarr;
          </button>
        </div>
      )}

      {/* STEP 3: Active Listening Mirror & Mutual Reveal */}
      {step === 3 && (
        <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-semibold text-linen-accent uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Stage 3 of 4: Mirroring & Mutual Reveal</span>
          </div>
          <div>
            <h3 className="font-serif text-xl font-medium text-linen-primary">Understanding Both Perspectives</h3>
            <p className="text-xs sm:text-sm text-linen-secondary mt-1 leading-relaxed">
              Read with an intention to understand your partner's experience, not to formulate a counter-argument.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-linen-border bg-linen-variant/30 space-y-2">
              <span className="text-xs font-medium text-linen-accent uppercase tracking-wider block">Your Experience</span>
              <p className="text-xs text-linen-secondary"><strong>Felt:</strong> {feltText}</p>
              <p className="text-xs text-linen-secondary"><strong>Needed:</strong> {neededText}</p>
              <p className="text-xs text-linen-secondary"><strong>My Part:</strong> {myPartText}</p>
            </div>

            <div className="p-4 rounded-2xl border border-linen-border bg-linen-variant/30 space-y-2">
              <span className="text-xs font-medium text-linen-accent uppercase tracking-wider block">{partnerName}’s Experience</span>
              <p className="text-xs text-linen-secondary"><strong>Felt:</strong> Overwhelmed by sudden urgency right after a long day.</p>
              <p className="text-xs text-linen-secondary"><strong>Needed:</strong> A 15-minute quiet decompression buffer before logistics.</p>
              <p className="text-xs text-linen-secondary"><strong>Their Part:</strong> Retreated with a harsh tone instead of calmly asking for space.</p>
            </div>
          </div>

          {/* Active Listening Mirroring Box */}
          <div className="p-4 rounded-2xl border border-linen-border bg-linen-surface space-y-2">
            <label className="block text-xs font-medium text-linen-primary">
              Active Listening Mirror: "What I hear {partnerName} saying is..."
            </label>
            <textarea
              rows={2}
              value={mirrorText}
              onChange={(e) => setMirrorText(e.target.value)}
              placeholder="Reflect back what you heard to prove they were genuinely seen and understood..."
              className="w-full px-3 py-2 rounded-xl border border-linen-border bg-linen-variant/20 text-xs focus:outline-none focus:ring-1 focus:ring-linen-accent resize-none"
            />
          </div>

          {/* Formulate Permanent Agreement */}
          <div className="pt-4 border-t border-linen-border space-y-3">
            <h4 className="font-serif text-base font-medium text-linen-primary">Draft a Mutually Sealed Agreement</h4>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Agreement Title (e.g., Post-work logistical discussions)"
              className="w-full px-4 py-2 text-xs rounded-xl border border-linen-border bg-linen-variant/20"
            />
            <input
              type="text"
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              placeholder="Trigger Situation (e.g., Right after entering the house)"
              className="w-full px-4 py-2 text-xs rounded-xl border border-linen-border bg-linen-variant/20"
            />
            <textarea
              value={newResolution}
              onChange={(e) => setNewResolution(e.target.value)}
              rows={2}
              placeholder="Our Shared Rule (e.g., We ask 'Do you have capacity?' before starting house chores)"
              className="w-full px-4 py-2 text-xs rounded-xl border border-linen-border bg-linen-variant/20 resize-none"
            />

            <button
              onClick={handleSaveAgreement}
              disabled={!newTitle.trim() || !newResolution.trim()}
              className="w-full py-2.5 bg-linen-primary text-linen-surface font-medium text-xs rounded-xl hover:opacity-95 disabled:opacity-40 transition-opacity flex items-center justify-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Seal & Commit Agreement to Permanent Archive</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Permanent Searchable Agreement Log */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-linen-secondary absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search past agreements by keyword..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-linen-border bg-linen-surface text-xs focus:outline-none focus:ring-1 focus:ring-linen-accent"
            />
          </div>

          <div className="space-y-3">
            {filteredAgreements.length === 0 ? (
              <div className="p-8 text-center text-xs text-linen-secondary border border-dashed border-linen-border rounded-2xl">
                No agreements found matching "{searchQuery}".
              </div>
            ) : (
              filteredAgreements.map(item => (
                <div key={item.id} className="p-5 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs text-linen-secondary">
                    <span className="font-semibold text-linen-primary text-sm">{item.title}</span>
                    <span className="font-mono text-[11px]">{item.date}</span>
                  </div>
                  <p className="text-xs text-linen-secondary">
                    <strong>Trigger Situation:</strong> {item.trigger}
                  </p>
                  <p className="text-xs text-linen-primary bg-linen-variant/40 p-3 rounded-xl border border-linen-border/60">
                    <strong>Mutually Sealed Resolution:</strong> {item.resolution}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
