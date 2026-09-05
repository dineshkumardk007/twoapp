import React, { useState } from 'react';
import { SpaceState } from '../core/storage';
import { EmotionalWeatherCard } from '../components/EmotionalWeatherCard';
import { NotAboutYouBanner } from '../components/NotAboutYouBanner';
import { NeedMenuModal } from '../components/NeedMenuModal';
import { NeedItem } from '../types';
import { getDailyQuestion } from '../data/questions';
import { getResurfacedQuote } from '../data/quotes';
import { MessageSquare, Handshake, BookOpen, Layers, CheckSquare, DollarSign, Mail, Sparkles, Quote, Send, Flame, Compass, Moon, Star, Heart, Utensils, Smile, Wind, Hourglass, Coffee, Gift, BookMarked } from 'lucide-react';
import { AmbientSoundscapeModal } from '../components/AmbientSoundscapeModal';
import { ComfortBoxModal } from '../components/ComfortBoxModal';
import { CoRegulationModal } from '../components/CoRegulationModal';
import { MilestoneTrackerCard } from '../components/MilestoneTrackerCard';
import { triggerGlobalPulse } from '../components/SensoryPulseOverlay';
import { RelationshipMilestone, ComfortBoxData } from '../types';

interface HomeViewProps {
  state: SpaceState;
  onUpdateReport: (report: any) => void;
  onToggleUserFlag: (active: boolean) => void;
  onNavigate: (tab: string) => void;
  onSendNeed: (need: NeedItem) => void;
  onOpenTour?: () => void;
  onAddMilestone?: (milestone: RelationshipMilestone) => void;
  onSaveComfortBox?: (box: ComfortBoxData) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  state,
  onUpdateReport,
  onToggleUserFlag,
  onNavigate,
  onSendNeed,
  onOpenTour,
  onAddMilestone = () => {},
  onSaveComfortBox
}) => {
  const [showNeedModal, setShowNeedModal] = useState(false);
  const [showSoundscapes, setShowSoundscapes] = useState(false);
  const [showComfortBox, setShowComfortBox] = useState(false);
  const [showCoRegulation, setShowCoRegulation] = useState(false);
  const [optInSpicy, setOptInSpicy] = useState(false);
  const [questionPromptToast, setQuestionPromptToast] = useState(false);

  const isUserFlagActive = state.activeUser === 'user'
    ? state.userReport.notAboutYouActive
    : state.partnerReport.notAboutYouActive;

  const isPartnerFlagActive = state.activeUser === 'user'
    ? state.partnerReport.notAboutYouActive
    : state.userReport.notAboutYouActive;

  const partnerName = state.activeUser === 'user' ? 'Partner' : 'You';

  const dayIndex = new Date().getDate();
  const dailyQuestion = getDailyQuestion(dayIndex, optInSpicy);
  const resurfacedQuote = getResurfacedQuote(state.userReport.weather, state.userReport.capacity);

  const handleSendQuestionToChat = () => {
    // Navigate to chat with prompt text or trigger need callback
    onSendNeed({
      id: dailyQuestion.id,
      title: `Daily Question [${dailyQuestion.tier.toUpperCase()}]`,
      description: `“${dailyQuestion.prompt}”`,
      icon: 'HelpCircle'
    });
    setQuestionPromptToast(true);
    setTimeout(() => setQuestionPromptToast(false), 2000);
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'playful':
        return <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">Playful</span>;
      case 'curious':
        return <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">Curious</span>;
      case 'deep':
        return <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">Deep</span>;
      case 'spicy':
        return <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">Spicy (Mutual)</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 0. Story Tour Banner */}
      {onOpenTour && (
        <div className="rounded-2xl border border-linen-border bg-gradient-to-r from-linen-variant/60 via-linen-surface to-linen-variant/40 p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-linen-primary text-linen-surface">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Interactive Story Tour</h4>
              <p className="text-xs text-linen-primary font-serif font-medium">A Day in the Life with Two • 5-Act Relational Walkthrough</p>
            </div>
          </div>
          <button
            onClick={onOpenTour}
            className="inline-flex items-center px-3 py-1.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
          >
            Start Tour →
          </button>
        </div>
      )}

      {/* 1. Side-by-Side Emotional Weather & Capacity */}
      <EmotionalWeatherCard
        userReport={state.userReport}
        partnerReport={state.partnerReport}
        activeUser={state.activeUser}
        onUpdateReport={onUpdateReport}
      />

      {/* 2. "It's Not About You" Flag */}
      <NotAboutYouBanner
        isPartnerActive={isPartnerFlagActive}
        partnerName={partnerName}
        isUserActive={isUserFlagActive}
        onToggleUserFlag={onToggleUserFlag}
      />

      {/* 2b. Emergency Comfort Box Banner */}
      {(state.userReport.capacity <= 2 || state.partnerReport.capacity <= 2 || isPartnerFlagActive) && (
        <div className="rounded-2xl border border-rose-200/90 bg-gradient-to-r from-rose-50/90 via-linen-surface to-rose-50/60 p-4 flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 shadow-xs">
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-700">Tender Sanctuary Ready</h4>
              <p className="text-xs text-linen-primary font-serif">Holding heavy feelings? Your Emergency Comfort Box is waiting with zero demands.</p>
            </div>
          </div>
          <button
            onClick={() => setShowComfortBox(true)}
            className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-medium hover:bg-rose-500 transition-colors shadow-xs cursor-pointer shrink-0 ml-3"
          >
            Open Comfort Box
          </button>
        </div>
      )}

      {/* 2c. Sensory Pulse - "Thinking of You" Card */}
      <div className="rounded-3xl border border-rose-200/80 bg-gradient-to-r from-rose-50/80 via-linen-surface to-rose-50/40 p-4 sm:p-5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3.5">
          <button
            onClick={() => triggerGlobalPulse('Thinking of you')}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shadow-rose-200 cursor-pointer shrink-0"
            title="Tap to send warm touch pulse"
          >
            <Heart className="w-5 h-5 sm:w-6 sm:h-6 fill-current animate-pulse" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-serif text-sm sm:text-base font-medium text-linen-primary">Thinking of You</h4>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                Sensory Pulse
              </span>
            </div>
            <p className="text-xs text-linen-secondary mt-0.5">
              Wordless touch • 528Hz Solfeggio chime & gentle mobile vibration
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 shrink-0 ml-3">
          <button
            onClick={() => setShowCoRegulation(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-linen-surface border border-teal-200 text-teal-800 text-xs font-medium hover:bg-teal-50 active:scale-95 transition-all shadow-2xs cursor-pointer"
            title="Open synchronized 4-7-8 breathing sanctuary"
          >
            <Wind className="w-3.5 h-3.5 text-teal-600" />
            <span className="hidden sm:inline">Breathe in Sync</span>
            <span className="sm:hidden">Breathe</span>
          </button>
          <button
            onClick={() => triggerGlobalPulse('Thinking of you')}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-medium hover:bg-rose-500 active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Send Pulse</span>
            <span className="sm:hidden">Pulse</span>
          </button>
        </div>
      </div>

      {/* 3. Daily Question Engine */}
      <div className="rounded-3xl border border-linen-border bg-linen-surface p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-linen-accent" />
            <span className="text-xs font-semibold tracking-wider uppercase text-linen-accent">Today's Daily Question</span>
            {getTierBadge(dailyQuestion.tier)}
          </div>
          <button
            onClick={() => setOptInSpicy(!optInSpicy)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
              optInSpicy
                ? 'bg-rose-50 text-rose-700 border-rose-200 font-medium'
                : 'text-linen-secondary border-linen-border hover:bg-linen-variant'
            }`}
            title="Spicy questions require mutual opt-in"
          >
            {optInSpicy ? '🌶️ Spicy Tier: On' : '🌶️ Spicy: Off'}
          </button>
        </div>

        <p className="font-serif text-lg sm:text-xl text-linen-primary leading-relaxed my-3 font-normal">
          “{dailyQuestion.prompt}”
        </p>

        <div className="flex items-center justify-between pt-3 border-t border-linen-border/40 mt-3">
          <span className="text-xs text-linen-secondary">
            Reflect together over dinner or send to chat
          </span>
          <button
            onClick={handleSendQuestionToChat}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send to Chat</span>
          </button>
        </div>
        {questionPromptToast && (
          <p className="text-[11px] text-emerald-600 mt-2">
            ✓ Sent to chat!
          </p>
        )}
      </div>

      {/* 4. Resurfaced Literary Quote Jar */}
      <div className="rounded-3xl border border-linen-border bg-gradient-to-r from-linen-variant/30 via-linen-surface to-linen-variant/20 p-5 sm:p-6">
        <div className="flex items-center space-x-2 text-linen-secondary mb-2">
          <Quote className="w-4 h-4 text-linen-accent" />
          <span className="text-xs font-medium uppercase tracking-wider text-linen-secondary">Resurfaced from the Literary Quote Jar</span>
        </div>
        <p className="font-serif italic text-base sm:text-lg text-linen-primary leading-relaxed mb-2">
          “{resurfacedQuote.quote}”
        </p>
        <div className="text-xs text-linen-secondary flex items-center justify-between">
          <span className="font-medium">— {resurfacedQuote.author}{resurfacedQuote.source ? `, ${resurfacedQuote.source}` : ''}</span>
          <span className="text-[11px] text-linen-accent bg-linen-surface px-2 py-0.5 rounded-md border border-linen-border/60">
            Tuned to your {state.userReport.weather.toLowerCase()} weather
          </span>
        </div>
      </div>

      {/* 5. Unread Waiting Note Tray */}
      <div
        onClick={() => onNavigate('chat')}
        className="cursor-pointer rounded-2xl border border-linen-border bg-linen-surface p-4 hover:border-linen-accent/40 transition-all flex items-center justify-between shadow-xs"
      >
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-linen-variant text-linen-accent">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-linen-primary">A quiet thought is waiting</h4>
            <p className="text-xs text-linen-secondary">From {partnerName} • Tap to read when you have capacity</p>
          </div>
        </div>
        <span className="text-xs font-medium text-linen-accent">Read &rarr;</span>
      </div>

      {/* 5.5. Relationship Milestones & Anniversary Counter */}
      <MilestoneTrackerCard
        milestones={state.milestones}
        onAddMilestone={onAddMilestone}
      />

      {/* 6. Quick Action Intimacy Tiles */}
      <div>
        <h3 className="font-serif text-lg font-medium text-linen-primary mb-3">Connection & Relational Tools</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            onClick={() => triggerGlobalPulse('Thinking of you')}
            className="text-left p-4 rounded-2xl border border-rose-200/80 bg-rose-50/40 hover:bg-rose-50/80 transition-colors cursor-pointer group"
          >
            <Heart className="w-5 h-5 text-rose-500 mb-2 fill-rose-500 group-hover:scale-110 transition-transform" />
            <h4 className="text-sm font-medium text-linen-primary">Thinking of You</h4>
            <p className="text-xs text-linen-secondary mt-0.5">528Hz Solfeggio touch pulse</p>
          </button>

          <button
            onClick={() => setShowCoRegulation(true)}
            className="text-left p-4 rounded-2xl border border-teal-200/80 bg-teal-50/30 hover:bg-teal-50/70 transition-colors cursor-pointer group"
          >
            <Wind className="w-5 h-5 text-teal-600 mb-2 group-hover:scale-110 transition-transform" />
            <h4 className="text-sm font-medium text-linen-primary">Co-Regulation</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Synchronized 4-7-8 breath</p>
          </button>

          <button
            onClick={() => onNavigate('rituals')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors cursor-pointer"
          >
            <Flame className="w-5 h-5 text-amber-600 mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Pebble Rituals</h4>
            <p className="text-xs text-linen-secondary mt-0.5">6-second kiss & zen cairn</p>
          </button>

          <button
            onClick={() => onNavigate('letters')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <Mail className="w-5 h-5 text-rose-600 mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Wax-Sealed Letters</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Delayed epistolary notes</p>
          </button>

          <button
            onClick={() => onNavigate('scratch')}
            className="text-left p-4 rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50/50 to-yellow-50/30 hover:bg-amber-100/50 transition-colors cursor-pointer group"
          >
            <Gift className="w-5 h-5 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
            <h4 className="text-sm font-medium text-linen-primary">Scratch Surprises</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Gold foil love coupons</p>
          </button>

          <button
            onClick={() => onNavigate('capsules')}
            className="text-left p-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/30 hover:bg-indigo-50/70 transition-colors cursor-pointer group"
          >
            <Hourglass className="w-5 h-5 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
            <h4 className="text-sm font-medium text-linen-primary">Time Capsule</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Locked anniversary vault</p>
          </button>

          <button
            onClick={() => onNavigate('presence')}
            className="text-left p-4 rounded-2xl border border-amber-200/80 bg-amber-50/30 hover:bg-amber-50/70 transition-colors cursor-pointer group"
          >
            <Coffee className="w-5 h-5 text-amber-700 mb-2 group-hover:scale-110 transition-transform" />
            <h4 className="text-sm font-medium text-linen-primary">Co-Presence</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Quiet study & reading room</p>
          </button>

          <button
            onClick={() => onNavigate('scrapbook')}
            className="text-left p-4 rounded-2xl border border-rose-300/80 bg-gradient-to-br from-rose-50/50 to-amber-50/40 hover:bg-rose-100/50 transition-colors cursor-pointer group"
          >
            <BookMarked className="w-5 h-5 text-rose-600 mb-2 group-hover:scale-110 transition-transform" />
            <h4 className="text-sm font-medium text-linen-primary">Keepsake Memoir</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Printable couple book</p>
          </button>

          <button
            onClick={() => setShowSoundscapes(true)}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <Moon className="w-5 h-5 text-indigo-500 mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Night Soundscapes</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Fall asleep together</p>
          </button>

          <button
            onClick={() => onNavigate('constellation')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <Star className="w-5 h-5 text-indigo-400 mb-2 fill-indigo-400/20" />
            <h4 className="text-sm font-medium text-linen-primary">Star Constellation</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Shared gratitude night sky</p>
          </button>

          <button
            onClick={() => onNavigate('compass')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <Compass className="w-5 h-5 text-amber-600 mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Care Compass</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Love language resonance</p>
          </button>

          <button
            onClick={() => setShowComfortBox(true)}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <Heart className="w-5 h-5 text-rose-500 mb-2 fill-rose-500/20" />
            <h4 className="text-sm font-medium text-linen-primary">Comfort Box</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Open when heavy</p>
          </button>

          <button
            onClick={() => onNavigate('recipes')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <Utensils className="w-5 h-5 text-amber-700 mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Couple Cookbook</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Cook together date mode</p>
          </button>

          <button
            onClick={() => onNavigate('intuition')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <Smile className="w-5 h-5 text-indigo-600 mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Guess My Mind</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Intuition dilemma game</p>
          </button>

          <button
            onClick={() => onNavigate('adventures')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <Compass className="w-5 h-5 text-emerald-600 mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Adventure Roulette</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Energy-tuned date night sparks</p>
          </button>

          <button
            onClick={() => onNavigate('decks')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <Sparkles className="w-5 h-5 text-linen-accent mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Curated Decks</h4>
            <p className="text-xs text-linen-secondary mt-0.5">4 connection card decks</p>
          </button>

          <button
            onClick={() => setShowNeedModal(true)}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-linen-accent mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Ask For What You Need</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Structured asks</p>
          </button>

          <button
            onClick={() => onNavigate('repair')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <Handshake className="w-5 h-5 text-linen-accent mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Conflict Repair Kit</h4>
            <p className="text-xs text-linen-secondary mt-0.5">5-step de-escalation</p>
          </button>

          <button
            onClick={() => onNavigate('journal')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <BookOpen className="w-5 h-5 text-linen-accent mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Private & Shared Journal</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Draft first, share later</p>
          </button>

          <button
            onClick={() => onNavigate('lists')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <CheckSquare className="w-5 h-5 text-linen-accent mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Shared Lists</h4>
            <p className="text-xs text-linen-secondary mt-0.5">With surprise gift hiding</p>
          </button>

          <button
            onClick={() => onNavigate('chores')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <Layers className="w-5 h-5 text-linen-accent mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Mental Load Split</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Planning vs doing</p>
          </button>

          <button
            onClick={() => onNavigate('money')}
            className="text-left p-4 rounded-2xl border border-linen-border bg-linen-surface hover:bg-linen-variant/50 transition-colors"
          >
            <DollarSign className="w-5 h-5 text-linen-accent mb-2" />
            <h4 className="text-sm font-medium text-linen-primary">Money-Light Tab</h4>
            <p className="text-xs text-linen-secondary mt-0.5">Running balance</p>
          </button>
        </div>
      </div>

      <NeedMenuModal
        isOpen={showNeedModal}
        onClose={() => setShowNeedModal(false)}
        onSelectNeed={(need) => {
          onSendNeed(need);
          setShowNeedModal(false);
          onNavigate('chat');
        }}
      />

      <AmbientSoundscapeModal
        isOpen={showSoundscapes}
        onClose={() => setShowSoundscapes(false)}
        activeUser={state.activeUser}
      />

      <ComfortBoxModal
        isOpen={showComfortBox}
        onClose={() => setShowComfortBox(false)}
        boxData={state.comfortBoxes[0] || {
          id: 'cb-1',
          authorId: 'partner',
          authorName: 'Partner',
          reassuranceNote: 'Breathe, my love. You are more than enough. You do not have to carry everything alone today. I am right here with you.',
          photoUrls: [],
          calmingExercise: '4-7-8',
          updatedAt: 'Today'
        }}
        activeUser={state.activeUser}
        onSaveBox={(newBox) => onSaveComfortBox && onSaveComfortBox(newBox)}
      />

      <CoRegulationModal
        isOpen={showCoRegulation}
        onClose={() => setShowCoRegulation(false)}
        activeUser={state.activeUser}
      />
    </div>
  );
};

