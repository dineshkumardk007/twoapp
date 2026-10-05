import React, { useMemo, useState } from 'react';
import { SpaceState } from '../core/storage';
import { EmotionalWeatherCard } from '../components/EmotionalWeatherCard';
import { NotAboutYouBanner } from '../components/NotAboutYouBanner';
import { getDailyQuestion } from '../data/questions';
import { getResurfacedQuote, LiteraryQuote } from '../data/quotes';
import { Sparkles, Quote, Send, Heart, Wind, ChevronRight } from 'lucide-react';
import { ComfortBoxModal } from '../components/ComfortBoxModal';
import { CoRegulationModal } from '../components/CoRegulationModal';
import { MilestoneTrackerCard } from '../components/MilestoneTrackerCard';
import { OurDatesCard } from '../components/OurDatesCard';
import { HeartOptionsModal } from '../components/HeartOptionsModal';
import { triggerGlobalPulse } from '../components/SensoryPulseOverlay';
import { RelationshipMilestone, ComfortBoxData, WeatherState } from '../types';
import { PartnerActivityCard } from '../components/PartnerActivityCard';
import { ActivityEvent } from '../core/activity';
import { destinationName } from '../data/destinations';
import { localDateKey } from '../core/ourDates';

interface HomeViewProps {
  state: SpaceState;
  onUpdateReport: (report: any) => void;
  onToggleUserFlag: (active: boolean) => void;
  onNavigate: (tab: string) => void;
  /** Puts today's question in the chat, as an ordinary message. */
  onSendQuestion: (prompt: string) => void;
  /** Sets the couple's dates on both phones. Empty means not set. */
  onSetOurDates: (dates: { togetherSince?: string; anniversary?: string }) => void;
  onOpenTour?: () => void;
  onAddMilestone?: (milestone: RelationshipMilestone) => void;
  onSaveComfortBox?: (box: ComfortBoxData) => void;
  /** Partner changes this device has not looked at yet, newest first. */
  partnerNews?: ActivityEvent[];
}

/**
 * The quote for today, kept for the day.
 *
 * getResurfacedQuote draws at random, and it used to be called on every
 * render - so a weather update from the partner, or coming back to Home from
 * another screen, swapped the quote out from under whoever was reading it.
 * Held here, outside the screen, it stays put until the day, the weather or
 * the capacity it was chosen for changes.
 */
const quoteOfTheDay = new Map<string, LiteraryQuote>();

function quoteFor(day: string, weather: WeatherState, capacity: number): LiteraryQuote {
  const key = `${day}|${weather}|${capacity}`;
  let quote = quoteOfTheDay.get(key);
  if (!quote) {
    quote = getResurfacedQuote(weather, capacity);
    quoteOfTheDay.clear();
    quoteOfTheDay.set(key, quote);
  }
  return quote;
}

/**
 * Home: what changed, your days together, how you both are, and one
 * question for today.
 *
 * It used to end in a wall of thirty-odd tiles repeating every destination
 * under a second set of names. The dock and its All sheet already reach all
 * of them, so Home keeps to the few things that are about today.
 */
export const HomeView: React.FC<HomeViewProps> = ({
  state,
  onUpdateReport,
  onToggleUserFlag,
  onNavigate,
  onSendQuestion,
  onSetOurDates,
  onOpenTour,
  onAddMilestone = () => {},
  onSaveComfortBox,
  partnerNews = []
}) => {
  const [showComfortBox, setShowComfortBox] = useState(false);
  const [showCoRegulation, setShowCoRegulation] = useState(false);
  const [showHeartModal, setShowHeartModal] = useState(false);
  const [optInSpicy, setOptInSpicy] = useState(false);
  // Which question was sent, so the button says so instead of inviting a
  // second copy of the same message.
  const [sentQuestionId, setSentQuestionId] = useState<string | null>(null);

  const isUserFlagActive = state.activeUser === 'user'
    ? state.userReport.notAboutYouActive
    : state.partnerReport.notAboutYouActive;

  const isPartnerFlagActive = state.activeUser === 'user'
    ? state.partnerReport.notAboutYouActive
    : state.userReport.notAboutYouActive;

  const partnerName = state.partnerName || 'Partner';
  const heavyDay = state.userReport.capacity <= 2 || state.partnerReport.capacity <= 2 || isPartnerFlagActive;

  const dayIndex = new Date().getDate();
  const dailyQuestion = getDailyQuestion(dayIndex, optInSpicy);
  const today = localDateKey();
  // This phone's own weather: userReport is the creator's seat, not "you".
  const { weather, capacity } = state.activeUser === 'user' ? state.userReport : state.partnerReport;
  const resurfacedQuote = useMemo(() => quoteFor(today, weather, capacity), [today, weather, capacity]);

  const handleSendQuestionToChat = () => {
    onSendQuestion(dailyQuestion.prompt);
    setSentQuestionId(dailyQuestion.id);
  };
  const questionSent = sentQuestionId === dailyQuestion.id;

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
      {/* Above everything else, because it is the only thing here that is
          time-sensitive and the only reason the screen might need reading
          twice in a day. */}
      <PartnerActivityCard
        news={partnerNews}
        partnerName={state.partnerName || 'Your partner'}
        onNavigate={onNavigate}
        labelFor={destinationName}
      />

      {/* Your days together, from the dates the two of you set - or a quiet
          question until you have. */}
      <OurDatesCard dates={state.ourDates} onSave={onSetOurDates} />

      {/* Story Tour Banner, until it has been seen once */}
      {onOpenTour && (
        <div className="rounded-2xl border border-linen-border bg-gradient-to-r from-linen-variant/60 via-linen-surface to-linen-variant/40 p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-linen-primary text-linen-surface shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Interactive Story Tour</h4>
              <p className="text-xs text-linen-primary font-serif font-medium">A Day in the Life with Two • 5-Act Relational Walkthrough</p>
            </div>
          </div>
          <button
            onClick={onOpenTour}
            className="inline-flex items-center px-3 py-1.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer shrink-0"
          >
            Start Tour →
          </button>
        </div>
      )}

      {/* Side-by-Side Emotional Weather & Capacity */}
      <EmotionalWeatherCard
        userReport={state.userReport}
        partnerReport={state.partnerReport}
        activeUser={state.activeUser}
        onUpdateReport={onUpdateReport}
        partnerName={partnerName}
      />

      {/* "It's Not About You" Flag */}
      <NotAboutYouBanner
        isPartnerActive={isPartnerFlagActive}
        partnerName={partnerName}
        isUserActive={isUserFlagActive}
        onToggleUserFlag={onToggleUserFlag}
      />

      {/* Emergency Comfort Box Banner on a heavy day; on any other day a
          quiet way in, because the box is filled ahead of time and this is
          the only place it opens from. */}
      {!heavyDay && (
        <button
          onClick={() => setShowComfortBox(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-linen-border bg-linen-surface px-4 py-3 text-left transition-colors hover:bg-linen-variant/50 cursor-pointer"
        >
          <Heart className="w-4 h-4 shrink-0 text-linen-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-linen-primary">Comfort box</span>
            <span className="block text-xs text-linen-secondary">For heavy days - open it, or fill it for {partnerName}</span>
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-linen-secondary" />
        </button>
      )}
      {heavyDay && (
        <div className="rounded-2xl border border-rose-200/90 bg-gradient-to-r from-rose-50/90 via-linen-surface to-rose-50/60 p-4 flex items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 shadow-xs shrink-0">
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-700">Tender Sanctuary Ready</h4>
              <p className="text-xs text-linen-primary font-serif">Holding heavy feelings? Your Emergency Comfort Box is waiting with zero demands.</p>
            </div>
          </div>
          <button
            onClick={() => setShowComfortBox(true)}
            className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-medium hover:bg-rose-500 transition-colors shadow-xs cursor-pointer shrink-0"
          >
            Open Comfort Box
          </button>
        </div>
      )}

      {/* Thinking of You. The big heart sends it; the two quieter buttons
          sit on their own row so nothing has to squeeze in beside the
          title - three of them side by side pushed the card, and with it
          the whole screen, past the edge of a phone. */}
      <div className="rounded-3xl border border-linen-border bg-linen-surface p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => triggerGlobalPulse('Thinking of you')}
            className="w-12 h-12 rounded-2xl bg-linen-accent text-linen-surface flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
            aria-label={`Send ${partnerName} a heartbeat`}
          >
            <Heart className="w-6 h-6 fill-current" />
          </button>
          <div className="min-w-0 flex-1">
            <h4 className="font-serif text-base font-medium text-linen-primary">Thinking of you</h4>
            <p className="text-xs text-linen-secondary mt-0.5">
              Tap the heart to send {partnerName} a heartbeat
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowHeartModal(true)}
            className="inline-flex min-w-0 items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-linen-variant/60 border border-linen-border text-linen-primary text-xs font-medium hover:bg-linen-variant active:scale-95 transition-all cursor-pointer"
          >
            <Heart className="w-3.5 h-3.5 shrink-0 text-linen-accent" />
            <span className="truncate">Heart options</span>
          </button>
          <button
            onClick={() => setShowCoRegulation(true)}
            className="inline-flex min-w-0 items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-linen-variant/60 border border-linen-border text-linen-primary text-xs font-medium hover:bg-linen-variant active:scale-95 transition-all cursor-pointer"
          >
            <Wind className="w-3.5 h-3.5 shrink-0 text-linen-accent" />
            <span className="truncate">Breathe together</span>
          </button>
        </div>
      </div>

      {/* Daily Question */}
      <div className="rounded-3xl border border-linen-border bg-linen-surface p-5 sm:p-6 shadow-xs">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-linen-accent shrink-0" />
            <span className="text-xs font-semibold tracking-wider uppercase text-linen-accent">Today's question</span>
            {getTierBadge(dailyQuestion.tier)}
          </div>
          <button
            onClick={() => setOptInSpicy(!optInSpicy)}
            className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-all ${
              optInSpicy
                ? 'bg-rose-50 text-rose-700 border-rose-200 font-medium'
                : 'text-linen-secondary border-linen-border hover:bg-linen-variant'
            }`}
            title="Spicy questions require mutual opt-in"
          >
            {optInSpicy ? '🌶️ Spicy Tier: On' : '🌶️ Spicy: Off'}
          </button>
        </div>

        <p className="font-serif text-lg sm:text-xl text-linen-primary leading-relaxed my-3 font-normal break-words">
          “{dailyQuestion.prompt}”
        </p>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-linen-border/40 mt-3">
          <span className="text-xs text-linen-secondary min-w-0">
            Talk it over tonight, or send it to {partnerName}
          </span>
          <button
            onClick={handleSendQuestionToChat}
            disabled={questionSent}
            className="inline-flex shrink-0 items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{questionSent ? 'Sent to chat' : 'Send to chat'}</span>
          </button>
        </div>
      </div>

      {/* Resurfaced Literary Quote, the same one all day */}
      <div className="rounded-3xl border border-linen-border bg-gradient-to-r from-linen-variant/30 via-linen-surface to-linen-variant/20 p-5 sm:p-6">
        <div className="flex items-center space-x-2 text-linen-secondary mb-2">
          <Quote className="w-4 h-4 text-linen-accent shrink-0" />
          <span className="text-xs font-medium uppercase tracking-wider text-linen-secondary">Resurfaced from the Literary Quote Jar</span>
        </div>
        <p className="font-serif italic text-base sm:text-lg text-linen-primary leading-relaxed mb-2 break-words">
          “{resurfacedQuote.quote}”
        </p>
        <div className="text-xs text-linen-secondary flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium min-w-0">— {resurfacedQuote.author}{resurfacedQuote.source ? `, ${resurfacedQuote.source}` : ''}</span>
          <span className="text-[11px] text-linen-accent bg-linen-surface px-2 py-0.5 rounded-md border border-linen-border/60">
            Tuned to your {weather.toLowerCase()} weather
          </span>
        </div>
      </div>

      {/* The milestones you have added together */}
      <MilestoneTrackerCard
        milestones={state.milestones}
        onAddMilestone={onAddMilestone}
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

      <HeartOptionsModal
        isOpen={showHeartModal}
        onClose={() => setShowHeartModal(false)}
        partnerName={partnerName}
      />
    </div>
  );
};
