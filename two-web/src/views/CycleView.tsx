import React, { useState } from 'react';
import { CycleRecord, CyclePhase, CycleSharingLevel } from '../types';
import { Shield, Lock, Moon, Sun, Heart, Sparkles, Check, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface CycleViewProps {
  records: CycleRecord[];
  sharingLevel: CycleSharingLevel;
  activeUser: 'user' | 'partner';
  onUpdateSharingLevel: (level: CycleSharingLevel) => void;
  onLogRecord: (record: Omit<CycleRecord, 'id'>) => void;
}

export const CycleView: React.FC<CycleViewProps> = ({
  records,
  sharingLevel,
  activeUser,
  onUpdateSharingLevel,
  onLogRecord
}) => {
  const isOwner = activeUser === 'user';
  const partnerName = isOwner ? 'Partner' : 'You';

  const currentRecord = records[0] || {
    id: 'default',
    dayOfCycle: 22,
    phase: 'LUTEAL',
    energyLevel: 2,
    mood: 'Introspective',
    symptoms: ['Mild fatigue', 'Lower back soreness'],
    loggedDate: 'Today'
  };

  const [selectedPhase, setSelectedPhase] = useState<CyclePhase>(currentRecord.phase);
  const [dayOfCycle, setDayOfCycle] = useState<number>(currentRecord.dayOfCycle);
  const [energyLevel, setEnergyLevel] = useState<number>(currentRecord.energyLevel);
  const [mood, setMood] = useState<string>(currentRecord.mood);
  const [symptoms, setSymptoms] = useState<string[]>(currentRecord.symptoms);
  const [privateNote, setPrivateNote] = useState<string>(currentRecord.privateNotes || '');
  const [revokedToast, setRevokedToast] = useState(false);

  const symptomOptions = [
    'Mild cramps', 'Headache', 'Lower back soreness', 'Fatigue',
    'High stamina', 'Food cravings', 'Emotional sensitivity', 'Restless sleep'
  ];

  const toggleSymptom = (sym: string) => {
    if (symptoms.includes(sym)) {
      setSymptoms(symptoms.filter(s => s !== sym));
    } else {
      setSymptoms([...symptoms, sym]);
    }
  };

  const handleSaveLog = () => {
    onLogRecord({
      dayOfCycle,
      phase: selectedPhase,
      energyLevel,
      mood,
      symptoms,
      privateNotes: privateNote,
      loggedDate: 'Today'
    });
  };

  const handleRevokeAllSharing = () => {
    onUpdateSharingLevel('private');
    setRevokedToast(true);
    setTimeout(() => setRevokedToast(false), 3000);
  };

  const getPhaseColor = (phase: CyclePhase) => {
    switch (phase) {
      case 'MENSTRUAL': return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'FOLLICULAR': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'OVULATORY': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'LUTEAL': return 'text-purple-700 bg-purple-50 border-purple-200';
    }
  };

  const getPhaseAdvice = (phase: CyclePhase) => {
    switch (phase) {
      case 'MENSTRUAL':
        return {
          title: 'Menstrual Phase — Deep Rest & Inward Presence',
          advice: 'Physical stamina is naturally low. Warmth, hydration, hot tea, and zero pressure for heavy cognitive or social exertion.'
        };
      case 'FOLLICULAR':
        return {
          title: 'Follicular Phase — Rising Estrogen & Novelty',
          advice: 'Clarity, physical endurance, and curiosity surge. Great time for adventures, long walks, creative brainstorming, and new projects.'
        };
      case 'OVULATORY':
        return {
          title: 'Ovulatory Phase — Peak Energy & Verbal Fluency',
          advice: 'Highest social vitality and confidence. Ideal window for deep relational conversations, connection card decks, and dates.'
        };
      case 'LUTEAL':
        return {
          title: 'Luteal Phase — Gentle Containment & Calm',
          advice: 'Progesterone rises; nervous system sensitivity increases. Partner support: offering to cook dinner, avoiding sharp debates, and providing quiet reassurance.'
        };
    }
  };

  const advice = getPhaseAdvice(currentRecord.phase);

  return (
    <div className="space-y-6">
      {/* Header with Subpoena Resistance Banner */}
      <div className="border-b border-linen-border pb-4">
        <div className="flex items-center space-x-2 text-linen-accent mb-1">
          <Moon className="w-5 h-5" />
          <span className="text-xs font-semibold tracking-wider uppercase">Reproductive Health Sovereignty</span>
        </div>
        <h2 className="font-serif text-2xl font-medium text-linen-primary">Cycle Sovereignty & Empathy Hub</h2>
        <p className="text-sm text-linen-secondary mt-1">
          Mathematically unreadable to servers. Protected under dedicated domain subkeys with granular selective disclosure.
        </p>
      </div>

      {/* Cryptographic Disclosure Banner */}
      <div className="rounded-2xl border border-linen-border bg-linen-variant/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2.5">
          <Shield className="w-4 h-4 text-emerald-700 shrink-0" />
          <div>
            <span className="font-medium text-linen-primary">Domain Subkey Isolation Active:</span>{' '}
            <span className="text-linen-secondary">
              Current sharing level: <strong className="uppercase text-linen-primary">{sharingLevel.replace('_', ' ')}</strong>
            </span>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={handleRevokeAllSharing}
            className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium transition-colors self-start sm:self-auto flex items-center space-x-1"
          >
            <Lock className="w-3 h-3" />
            <span>Revoke All Partner Access</span>
          </button>
        )}
      </div>

      {revokedToast && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Access revoked! Cycle subkey regenerated; data is now 100% private to your device.</span>
        </div>
      )}

      {/* PARTNER PERSPECTIVE (RESPECTING DISCLOSURE LEVEL) */}
      {!isOwner ? (
        <div className="rounded-3xl border border-linen-border bg-linen-surface p-6 sm:p-8 space-y-6 shadow-xs">
          {sharingLevel === 'private' ? (
            <div className="text-center py-8 space-y-3">
              <Lock className="w-8 h-8 text-linen-secondary mx-auto" />
              <h3 className="font-serif text-lg font-medium text-linen-primary">Cycle Data is Completely Private</h3>
              <p className="text-xs text-linen-secondary max-w-md mx-auto leading-relaxed">
                Your partner has encrypted their reproductive health records strictly under their private subkey. No phase or symptom information is accessible on this device.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold tracking-wider text-linen-accent uppercase">Partner's Shared Cycle Horizon</span>
                  <h3 className="font-serif text-xl font-medium text-linen-primary mt-1">{advice.title}</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPhaseColor(currentRecord.phase)}`}>
                  Day {currentRecord.dayOfCycle} of Cycle
                </span>
              </div>

              {/* Empathy & Supportive Advice Card */}
              <div className="p-5 rounded-2xl bg-linen-variant/40 border border-linen-border space-y-2">
                <div className="flex items-center space-x-2 text-xs font-medium text-linen-primary">
                  <Heart className="w-4 h-4 text-rose-600" />
                  <span>How to best support your partner right now:</span>
                </div>
                <p className="text-xs text-linen-secondary leading-relaxed pl-6">
                  {advice.advice}
                </p>
              </div>

              {/* Energy Level (if shared) */}
              {(sharingLevel === 'phase_and_energy' || sharingLevel === 'full') && (
                <div className="p-4 rounded-2xl border border-linen-border bg-linen-surface space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-linen-primary">Shared Energy Bandwidth</span>
                    <span className="text-linen-secondary">{currentRecord.energyLevel} / 5</span>
                  </div>
                  <div className="w-full bg-linen-variant rounded-full h-2">
                    <div
                      className="bg-linen-accent h-2 rounded-full transition-all"
                      style={{ width: `${(currentRecord.energyLevel / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Symptoms (if full sharing permitted) */}
              {sharingLevel === 'full' && currentRecord.symptoms.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-linen-primary mb-2">Logged Physical Sensations</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {currentRecord.symptoms.map(s => (
                      <span key={s} className="px-2.5 py-1 rounded-full bg-linen-variant text-linen-primary text-xs border border-linen-border">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* OWNER PERSPECTIVE (FULL TRACKING & SHARING CONTROLS) */
        <div className="space-y-6">
          {/* Phase & Dial Card */}
          <div className="rounded-3xl border border-linen-border bg-linen-surface p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold tracking-wider text-linen-accent uppercase">Biological Phase Log</span>
                <h3 className="font-serif text-xl font-medium text-linen-primary mt-0.5">{advice.title}</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-linen-secondary">Cycle Day:</span>
                <input
                  type="number"
                  min="1"
                  max="35"
                  value={dayOfCycle}
                  onChange={(e) => setDayOfCycle(parseInt(e.target.value) || 1)}
                  className="w-14 px-2 py-1 text-center font-mono text-xs rounded-xl border border-linen-border bg-linen-variant/40"
                />
              </div>
            </div>

            {/* Phase Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['MENSTRUAL', 'FOLLICULAR', 'OVULATORY', 'LUTEAL'] as CyclePhase[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPhase(p)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    selectedPhase === p
                      ? `${getPhaseColor(p)} shadow-xs font-semibold`
                      : 'border-linen-border bg-linen-surface text-linen-secondary hover:bg-linen-variant/40'
                  }`}
                >
                  <span className="text-xs block capitalize">{p.toLowerCase()}</span>
                </button>
              ))}
            </div>

            {/* Energy Level Slider */}
            <div>
              <div className="flex justify-between text-xs font-medium text-linen-primary mb-2">
                <span>Energy & Bandwidth Capacity</span>
                <span>{energyLevel} / 5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={energyLevel}
                onChange={(e) => setEnergyLevel(parseInt(e.target.value))}
                className="w-full accent-linen-primary cursor-pointer"
              />
            </div>

            {/* Symptoms Tags */}
            <div>
              <label className="block text-xs font-medium text-linen-primary mb-2">Physical Symptoms & Cues</label>
              <div className="flex flex-wrap gap-2">
                {symptomOptions.map(sym => {
                  const isSelected = symptoms.includes(sym);
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => toggleSymptom(sym)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        isSelected
                          ? 'bg-linen-primary text-linen-surface border-linen-primary shadow-xs'
                          : 'bg-linen-variant/30 text-linen-secondary border-linen-border hover:bg-linen-variant'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}{sym}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Private Notes (Owner Subkey only) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label className="font-medium text-linen-primary flex items-center space-x-1">
                  <Lock className="w-3 h-3 text-linen-accent" />
                  <span>Private Notes (Never shared with partner)</span>
                </label>
                <span className="text-[10px] text-linen-secondary font-mono">Owner Subkey</span>
              </div>
              <textarea
                rows={2}
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                placeholder="Personal thoughts, physical observations, medication or cycle nuances..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-linen-border bg-linen-variant/20 focus:outline-none focus:ring-1 focus:ring-linen-accent resize-none"
              />
            </div>

            {/* Granular Selective Disclosure Settings */}
            <div className="pt-4 border-t border-linen-border space-y-3">
              <h4 className="font-serif text-base font-medium text-linen-primary">Partner Disclosure Level</h4>
              <p className="text-xs text-linen-secondary leading-relaxed">
                Choose exactly how much biological and emotional context your partner's device is allowed to decrypt:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => onUpdateSharingLevel('private')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    sharingLevel === 'private'
                      ? 'border-linen-accent bg-linen-variant shadow-xs font-medium'
                      : 'border-linen-border bg-linen-surface hover:bg-linen-variant/40'
                  }`}
                >
                  <div className="font-semibold text-linen-primary flex items-center space-x-1">
                    <Lock className="w-3 h-3 text-linen-accent" />
                    <span>1. Completely Private</span>
                  </div>
                  <p className="text-[11px] text-linen-secondary mt-0.5">Partner sees nothing.</p>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateSharingLevel('phase_only')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    sharingLevel === 'phase_only'
                      ? 'border-linen-accent bg-linen-variant shadow-xs font-medium'
                      : 'border-linen-border bg-linen-surface hover:bg-linen-variant/40'
                  }`}
                >
                  <div className="font-semibold text-linen-primary flex items-center space-x-1">
                    <Eye className="w-3 h-3 text-linen-accent" />
                    <span>2. Phase Name Only</span>
                  </div>
                  <p className="text-[11px] text-linen-secondary mt-0.5">e.g. "Luteal" + empathy advice.</p>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateSharingLevel('phase_and_energy')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    sharingLevel === 'phase_and_energy'
                      ? 'border-linen-accent bg-linen-variant shadow-xs font-medium'
                      : 'border-linen-border bg-linen-surface hover:bg-linen-variant/40'
                  }`}
                >
                  <div className="font-semibold text-linen-primary flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-linen-accent" />
                    <span>3. Phase + Energy Bandwidth</span>
                  </div>
                  <p className="text-[11px] text-linen-secondary mt-0.5">Share phase and 1-5 energy level.</p>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateSharingLevel('full')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    sharingLevel === 'full'
                      ? 'border-linen-accent bg-linen-variant shadow-xs font-medium'
                      : 'border-linen-border bg-linen-surface hover:bg-linen-variant/40'
                  }`}
                >
                  <div className="font-semibold text-linen-primary flex items-center space-x-1">
                    <Heart className="w-3 h-3 text-rose-600" />
                    <span>4. Full Sharing</span>
                  </div>
                  <p className="text-[11px] text-linen-secondary mt-0.5">Phase, energy, and physical symptoms.</p>
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveLog}
              className="w-full py-2.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Save Cycle Log & Apply Sovereignty Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
