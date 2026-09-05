import React, { useState } from 'react';
import { StateOfUnionSession, PartnerCheckInContent } from '../types';
import {
  Heart,
  Sparkles,
  CheckCircle,
  Flame,
  Calendar,
  Shield,
  Send,
  Plus,
  ArrowRight,
  Archive,
  Star,
  Compass,
  MessageSquare,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface StateOfUnionViewProps {
  activeSession: StateOfUnionSession | null;
  history: StateOfUnionSession[];
  activeUser: 'user' | 'partner';
  onUpdateSession: (session: StateOfUnionSession) => void;
  onSealSession: (session: StateOfUnionSession) => void;
  onSendToChat?: (text: string) => void;
}

// Procedural Tibetan Singing Bowl chime for sealing
function playSingingBowlChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonic singing bowl frequencies (fundamental + overtones)
    const freqs = [216, 432, 648, 864, 1296];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.12 / (i + 1), now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5 + i * 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 4.5);
    });
  } catch (e) {
    // ignore
  }
}

export const StateOfUnionView: React.FC<StateOfUnionViewProps> = ({
  activeSession,
  history,
  activeUser,
  onUpdateSession,
  onSealSession,
  onSendToChat
}) => {
  const partnerName = activeUser === 'user' ? 'Partner' : 'You';
  const partnerId = activeUser === 'user' ? 'partner' : 'user';

  // Fallback initial session if null
  const session: StateOfUnionSession = activeSession || {
    id: 'sou-' + Date.now(),
    weekLabel: `Week of ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    createdAt: Date.now(),
    isCompleted: false,
    userCheckIn: {
      appreciations: ['', '', ''],
      whatWentWell: '',
      upcomingWeekCapacity: 4,
      isSubmitted: false
    },
    partnerCheckIn: {
      appreciations: ['', '', ''],
      whatWentWell: '',
      upcomingWeekCapacity: 3,
      isSubmitted: false
    }
  };

  const userContent = activeUser === 'user' ? session.userCheckIn : session.partnerCheckIn;
  const partnerContent = activeUser === 'user' ? session.partnerCheckIn : session.userCheckIn;

  // Local draft editing states
  const [apprec1, setApprec1] = useState(userContent.appreciations?.[0] || '');
  const [apprec2, setApprec2] = useState(userContent.appreciations?.[1] || '');
  const [apprec3, setApprec3] = useState(userContent.appreciations?.[2] || '');
  const [whatWentWell, setWhatWentWell] = useState(userContent.whatWentWell || '');
  const [pebbleInShoe, setPebbleInShoe] = useState(userContent.pebbleInShoe || '');
  const [gentleNeed, setGentleNeed] = useState(userContent.gentleNeed || '');
  const [capacity, setCapacity] = useState<number>(userContent.upcomingWeekCapacity || 4);
  const [capacityNote, setCapacityNote] = useState(userContent.upcomingWeekNote || '');
  const [dateNightIdea, setDateNightIdea] = useState(userContent.dateNightIdea || '');
  const [agreedDate, setAgreedDate] = useState(session.agreedDateNight || '');
  const [isSealing, setIsSealing] = useState(false);
  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(null);

  const isBothSubmitted = userContent.isSubmitted && partnerContent.isSubmitted;

  const handleSaveDraft = (markSubmitted = false) => {
    const updatedContent: PartnerCheckInContent = {
      appreciations: [apprec1.trim(), apprec2.trim(), apprec3.trim()],
      whatWentWell: whatWentWell.trim(),
      pebbleInShoe: pebbleInShoe.trim() || undefined,
      gentleNeed: gentleNeed.trim() || undefined,
      upcomingWeekCapacity: capacity,
      upcomingWeekNote: capacityNote.trim() || undefined,
      dateNightIdea: dateNightIdea.trim() || undefined,
      isSubmitted: markSubmitted ? true : userContent.isSubmitted,
      submittedAt: markSubmitted ? 'Just now' : userContent.submittedAt
    };

    let updatedSession: StateOfUnionSession;
    if (activeUser === 'user') {
      updatedSession = {
        ...session,
        userCheckIn: updatedContent,
        agreedDateNight: agreedDate.trim() || session.agreedDateNight
      };
    } else {
      updatedSession = {
        ...session,
        partnerCheckIn: updatedContent,
        agreedDateNight: agreedDate.trim() || session.agreedDateNight
      };
    }

    onUpdateSession(updatedSession);

    if (markSubmitted && 'vibrate' in navigator) {
      navigator.vibrate([80, 40, 80]);
    }
  };

  const handleSealWeeklyCapsule = () => {
    setIsSealing(true);
    playSingingBowlChime();

    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }

    const sealedSession: StateOfUnionSession = {
      ...session,
      isCompleted: true,
      completedAt: Date.now(),
      agreedDateNight: agreedDate.trim() || 'Cozy date night together'
    };

    setTimeout(() => {
      onSealSession(sealedSession);
      setIsSealing(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Flame className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              Weekly Connection Ritual
            </span>
          </div>
          <h2 className="font-serif text-2xl font-bold text-linen-primary mt-1">
            State of Our Union
          </h2>
          <p className="text-xs text-linen-secondary mt-0.5">
            Inspired by Dr. John Gottman: a safe Sunday container to cherish, calibrate, and care for each other.
          </p>
        </div>

        {/* Dual Submission Readiness Pill */}
        <div className="flex items-center space-x-2 bg-linen-surface border border-linen-border px-3.5 py-2 rounded-2xl shadow-xs self-start sm:self-auto">
          <div className="flex items-center space-x-1.5 text-xs font-serif">
            <span className={`w-2 h-2 rounded-full ${userContent.isSubmitted ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span className="text-linen-primary font-medium">You: {userContent.isSubmitted ? 'Shared' : 'Drafting'}</span>
          </div>
          <span className="text-linen-secondary text-xs">•</span>
          <div className="flex items-center space-x-1.5 text-xs font-serif">
            <span className={`w-2 h-2 rounded-full ${partnerContent.isSubmitted ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span className="text-linen-primary font-medium">{partnerName}: {partnerContent.isSubmitted ? 'Shared' : 'Drafting'}</span>
          </div>
        </div>
      </div>

      {/* Sacred Ground Rules & Safe Container Banner */}
      <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-50/70 via-linen-surface to-amber-50/40 p-4 sm:p-5 flex items-start space-x-3.5 shadow-xs">
        <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Sacred Ground Rule: Attune, Don't Defend
          </h4>
          <p className="text-xs font-serif text-linen-primary leading-relaxed">
            This space is not a courtroom or performance review. It is an intentional garden. Listen to understand, not to rebut. Hold tender feelings with gentle hands.
          </p>
        </div>
      </div>

      {/* Main Check-In Card */}
      <div className="rounded-3xl border border-linen-border bg-linen-surface p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-linen-border pb-4">
          <div>
            <span className="text-xs font-serif uppercase tracking-widest text-linen-secondary">
              {session.weekLabel}
            </span>
            <h3 className="font-serif text-lg font-bold text-linen-primary mt-0.5">
              Weekly Attunement & Harmony
            </h3>
          </div>
          {session.isCompleted ? (
            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-serif font-medium">
              ✓ Harmony Capsule Sealed
            </span>
          ) : isBothSubmitted ? (
            <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-serif font-medium animate-pulse">
              ✨ Both Shared • Ready to Seal
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-linen-variant text-linen-secondary text-xs font-serif">
              In Progress
            </span>
          )}
        </div>

        {/* Step 1: Appreciations */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-serif font-bold text-xs flex items-center justify-center">
              1
            </span>
            <h4 className="font-serif text-sm font-semibold text-linen-primary">
              Appreciations & Cherishing (3 Things I Loved About You)
            </h4>
          </div>
          <p className="text-xs font-serif text-linen-secondary">
            Name three specific, small ways you felt loved, seen, or grateful for {partnerName} this week.
          </p>

          <div className="space-y-2">
            <input
              type="text"
              value={apprec1}
              onChange={e => setApprec1(e.target.value)}
              placeholder="1. e.g. How you made tea when I was overwhelmed on Thursday..."
              className="w-full px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-amber-600 font-serif"
            />
            <input
              type="text"
              value={apprec2}
              onChange={e => setApprec2(e.target.value)}
              placeholder="2. e.g. Listening so patiently while I talked through my stress..."
              className="w-full px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-amber-600 font-serif"
            />
            <input
              type="text"
              value={apprec3}
              onChange={e => setApprec3(e.target.value)}
              placeholder="3. e.g. Leaving the porch light and blanket warm for me..."
              className="w-full px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-amber-600 font-serif"
            />
          </div>

          {/* If Partner has submitted, reveal partner's appreciations side-by-side */}
          {partnerContent.isSubmitted && (
            <div className="mt-3 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-2 animate-fade-in">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block">
                {partnerName}'s Appreciations for You:
              </span>
              <ul className="space-y-1 text-xs font-serif text-linen-primary list-disc list-inside">
                {partnerContent.appreciations.map((app, i) => (
                  <li key={i} className="leading-relaxed italic">“{app}”</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Step 2: What Went Well */}
        <div className="space-y-3 pt-4 border-t border-linen-border">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-serif font-bold text-xs flex items-center justify-center">
              2
            </span>
            <h4 className="font-serif text-sm font-semibold text-linen-primary">
              What Went Well (Shared Victories & Laughter)
            </h4>
          </div>
          <p className="text-xs font-serif text-linen-secondary">
            Celebrate a moment of ease, teamwork, deep conversation, or laughter between you two.
          </p>
          <textarea
            rows={2}
            value={whatWentWell}
            onChange={e => setWhatWentWell(e.target.value)}
            placeholder="e.g. Navigating our grocery trip with complete teamwork and humor..."
            className="w-full px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-amber-600 font-serif"
          />

          {partnerContent.isSubmitted && partnerContent.whatWentWell && (
            <div className="p-3 rounded-2xl bg-linen-variant/50 border border-linen-border text-xs font-serif">
              <span className="font-semibold text-linen-primary">{partnerName}'s View:</span>
              <p className="italic text-linen-secondary mt-0.5">“{partnerContent.whatWentWell}”</p>
            </div>
          )}
        </div>

        {/* Step 3: Tender Spots & Gentle Need */}
        <div className="space-y-3 pt-4 border-t border-linen-border">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-serif font-bold text-xs flex items-center justify-center">
              3
            </span>
            <h4 className="font-serif text-sm font-semibold text-linen-primary">
              The Gentle Pebble (Tender Spots & Positive Needs)
            </h4>
          </div>
          <p className="text-xs font-serif text-linen-secondary">
            Was there a small friction or loneliness this week? State it gently as a feeling + a positive need.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] text-linen-secondary font-medium">The Situation / Feeling</span>
              <input
                type="text"
                value={pebbleInShoe}
                onChange={e => setPebbleInShoe(e.target.value)}
                placeholder="e.g. Felt a bit disconnected Tuesday night..."
                className="w-full mt-1 px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-amber-600 font-serif"
              />
            </div>
            <div>
              <span className="text-[11px] text-linen-secondary font-medium">My Gentle Need for Next Time</span>
              <input
                type="text"
                value={gentleNeed}
                onChange={e => setGentleNeed(e.target.value)}
                placeholder="e.g. Could we do 20 mins screen-free tea time?"
                className="w-full mt-1 px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-amber-600 font-serif"
              />
            </div>
          </div>

          {partnerContent.isSubmitted && (partnerContent.pebbleInShoe || partnerContent.gentleNeed) && (
            <div className="p-3.5 rounded-2xl bg-rose-50/40 border border-rose-200/70 text-xs font-serif space-y-1">
              <span className="font-semibold text-rose-800 block">{partnerName}'s Tender Request:</span>
              {partnerContent.pebbleInShoe && <p className="italic text-linen-primary">“{partnerContent.pebbleInShoe}”</p>}
              {partnerContent.gentleNeed && (
                <p className="text-rose-700 font-medium mt-1">Need: “{partnerContent.gentleNeed}”</p>
              )}
            </div>
          )}
        </div>

        {/* Step 4: Upcoming Week Capacity & Date Night */}
        <div className="space-y-3 pt-4 border-t border-linen-border">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-serif font-bold text-xs flex items-center justify-center">
              4
            </span>
            <h4 className="font-serif text-sm font-semibold text-linen-primary">
              Looking Ahead (Capacity Forecast & Date Night)
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-2xl bg-linen-bg border border-linen-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-linen-secondary font-medium">My Upcoming Week Energy</span>
                <span className="font-serif font-bold text-linen-primary">{capacity}/5 Capacity</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={capacity}
                onChange={e => setCapacity(parseInt(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <input
                type="text"
                value={capacityNote}
                onChange={e => setCapacityNote(e.target.value)}
                placeholder="e.g. Wednesday will be heavy with meetings..."
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-linen-surface border border-linen-border text-linen-primary focus:outline-none"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-linen-bg border border-linen-border space-y-2">
              <span className="text-xs text-linen-secondary font-medium block">
                Proposed Date Night Idea
              </span>
              <input
                type="text"
                value={dateNightIdea}
                onChange={e => setDateNightIdea(e.target.value)}
                placeholder="e.g. Botanical garden walk + homemade pizza"
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-linen-surface border border-linen-border text-linen-primary focus:outline-none"
              />
              {partnerContent.isSubmitted && partnerContent.dateNightIdea && (
                <div className="text-[11px] text-amber-800 font-serif bg-amber-50 p-2 rounded-xl border border-amber-200">
                  {partnerName}'s idea: “{partnerContent.dateNightIdea}”
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Submit / Save / Seal */}
        <div className="pt-4 border-t border-linen-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleSaveDraft(false)}
              className="px-4 py-2 rounded-xl border border-linen-border text-xs text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSaveDraft(true)}
              className="px-4 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              {userContent.isSubmitted ? 'Update Submission' : 'Submit My Part'}
            </button>
          </div>

          {/* Big Seal Button if both partners have shared */}
          {isBothSubmitted && !session.isCompleted && (
            <button
              onClick={handleSealWeeklyCapsule}
              disabled={isSealing}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 text-white text-xs font-semibold hover:opacity-95 shadow-md shadow-amber-900/20 transition-all cursor-pointer flex items-center space-x-2 animate-bounce"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSealing ? 'Sealing Capsule...' : 'Seal Weekly Harmony Capsule 🕊️'}</span>
            </button>
          )}

          {session.isCompleted && onSendToChat && (
            <button
              onClick={() => onSendToChat(`🕊️ Our State of the Union for ${session.weekLabel} has been sealed with love. Looking forward to our date: ${session.agreedDateNight || 'together'}.`)}
              className="text-xs text-linen-accent font-medium hover:underline cursor-pointer flex items-center space-x-1"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Share Sealed Summary in Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* History Archive of Past Harmony Capsules */}
      {history && history.length > 0 && (
        <div className="rounded-3xl border border-linen-border bg-linen-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <Archive className="w-4 h-4 text-linen-accent" />
            <h3 className="font-serif text-base font-semibold text-linen-primary">
              Sealed Harmony Archive ({history.length})
            </h3>
          </div>

          <div className="space-y-3">
            {history.map(past => {
              const isExpanded = expandedArchiveId === past.id;
              return (
                <div
                  key={past.id}
                  className="rounded-2xl border border-linen-border/80 bg-linen-bg/50 p-4 transition-all"
                >
                  <div
                    onClick={() => setExpandedArchiveId(isExpanded ? null : past.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <h4 className="font-serif text-sm font-semibold text-linen-primary">
                        {past.weekLabel}
                      </h4>
                      <p className="text-xs text-linen-secondary mt-0.5">
                        Date Night: {past.agreedDateNight || 'Cherished connection'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Sealed
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-linen-secondary" /> : <ChevronDown className="w-4 h-4 text-linen-secondary" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-linen-border space-y-3 text-xs font-serif animate-fade-in">
                      <div>
                        <strong className="text-amber-800 block mb-1">Appreciations Exchanged:</strong>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-linen-primary italic">
                          <div className="p-2.5 rounded-xl bg-linen-surface border border-linen-border">
                            <span className="font-semibold text-[11px] not-italic text-linen-secondary block">You:</span>
                            {past.userCheckIn.appreciations.map((a, i) => (
                              <p key={i}>• “{a}”</p>
                            ))}
                          </div>
                          <div className="p-2.5 rounded-xl bg-linen-surface border border-linen-border">
                            <span className="font-semibold text-[11px] not-italic text-linen-secondary block">{partnerName}:</span>
                            {past.partnerCheckIn.appreciations.map((a, i) => (
                              <p key={i}>• “{a}”</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
