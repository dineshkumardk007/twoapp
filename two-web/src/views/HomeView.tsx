import React, { useState } from 'react';
import { SpaceState } from '../core/storage';
import { EmotionalWeatherCard } from '../components/EmotionalWeatherCard';
import { NotAboutYouBanner } from '../components/NotAboutYouBanner';
import { NeedMenuModal } from '../components/NeedMenuModal';
import { NeedItem } from '../types';
import { getDailyQuestion } from '../data/questions';
import { getResurfacedQuote } from '../data/quotes';
import { MessageSquare, Handshake, BookOpen, Layers, CheckSquare, DollarSign, Mail, Sparkles, Quote, Send } from 'lucide-react';

interface HomeViewProps {
  state: SpaceState;
  onUpdateReport: (report: any) => void;
  onToggleUserFlag: (active: boolean) => void;
  onNavigate: (tab: string) => void;
  onSendNeed: (need: NeedItem) => void;
  onOpenTour?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  state,
  onUpdateReport,
  onToggleUserFlag,
  onNavigate,
  onSendNeed,
  onOpenTour
}) => {
  const [showNeedModal, setShowNeedModal] = useState(false);
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

      {/* 6. Quick Action Intimacy Tiles */}
      <div>
        <h3 className="font-serif text-lg font-medium text-linen-primary mb-3">Connection & Relational Tools</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
    </div>
  );
};

