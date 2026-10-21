import React, { useMemo, useState } from 'react';
import { SpaceState } from '../core/storage';
import { EmotionalWeatherCard } from '../components/EmotionalWeatherCard';
import { NotAboutYouBanner } from '../components/NotAboutYouBanner';
import { getResurfacedQuote, LiteraryQuote } from '../data/quotes';
import { Sparkles, Quote, Heart, Wind, ChevronRight, X, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { backupNudge, snoozeBackupNudge, requestBackupOnOpen } from '../core/backupReminder';
import { ComfortBoxModal } from '../components/ComfortBoxModal';
import { comfortBoxesFor, hasComfort } from '../core/comfortBox';
import { CoRegulationModal } from '../components/CoRegulationModal';
import { MilestoneTrackerCard } from '../components/MilestoneTrackerCard';
import { OurDatesCard } from '../components/OurDatesCard';
import { DailyQuestionCard } from '../components/DailyQuestionCard';
import { HeartOptionsModal } from '../components/HeartOptionsModal';
import { triggerGlobalPulse } from '../components/SensoryPulseOverlay';
import { RelationshipMilestone, ComfortBoxData, WeatherState } from '../types';
import { PartnerActivityCard } from '../components/PartnerActivityCard';
import { ActivityEvent } from '../core/activity';
import { destinationName } from '../data/destinations';
import { localDateKey } from '../core/ourDates';
import { ThirukkuralCard } from '../components/ThirukkuralCard';
import { ArrangeHomeSheet } from '../components/ArrangeHomeSheet';
import { HomeCardId, HomeLayout, readHomeLayout, writeHomeLayout } from '../core/homeLayout';

interface HomeViewProps {
  state: SpaceState;
  onUpdateReport: (report: any) => void;
  onToggleUserFlag: (active: boolean) => void;
  onNavigate: (tab: string) => void;
  /** Puts a line about today's question in the chat, as an ordinary message. */
  onSendQuestion: (prompt: string) => void;
  /** Gives this phone's answer to today's question, on both phones. */
  onAnswerQuestion: (answer: { day: string; questionId: string; prompt: string; text: string }) => void;
  /** Sets the couple's dates on both phones. Empty means not set. */
  onSetOurDates: (dates: { togetherSince?: string; anniversary?: string }) => void;
  onOpenTour?: () => void;
  onAddMilestone?: (milestone: RelationshipMilestone) => void;
  onSaveComfortBox?: (box: ComfortBoxData) => void;
  /** Partner changes this device has not looked at yet, newest first. */
  partnerNews?: ActivityEvent[];
  /** Set while the partner's phone runs an older version than this one. */
  partnerUpdate?: { version: string; onDismiss: () => void };
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

/** A weather as the card names it: CALM is "clear", RAINY "turbulent". */
const WEATHER_WORD: Record<WeatherState, string> = {
  SUNNY: 'sunny',
  CALM: 'clear',
  OVERCAST: 'overcast',
  RAINY: 'turbulent',
  STORMY: 'stormy'
};

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
  onAnswerQuestion,
  onSetOurDates,
  onOpenTour,
  onAddMilestone = () => {},
  onSaveComfortBox,
  partnerNews = [],
  partnerUpdate
}) => {
  const [showComfortBox, setShowComfortBox] = useState(false);
  const [showCoRegulation, setShowCoRegulation] = useState(false);
  const [showHeartModal, setShowHeartModal] = useState(false);
  // Worked out once per visit to Home; "Later" hides it straight away.
  const [nudge, setNudge] = useState(() => backupNudge());
  // This phone's own order of the cards below, and the ones switched off.
  const [layout, setLayout] = useState<HomeLayout>(readHomeLayout);
  const [arranging, setArranging] = useState(false);
  const changeLayout = (next: HomeLayout) => {
    setLayout(next);
    writeHomeLayout(next);
  };
  // The phone's Back button closes these popups through the popups themselves
  // (each registers its own layer), so the breathing one can end its session
  // and tell the other phone, as its close button does.

  const isUserFlagActive = state.activeUser === 'user'
    ? state.userReport.notAboutYouActive
    : state.partnerReport.notAboutYouActive;

  const isPartnerFlagActive = state.activeUser === 'user'
    ? state.partnerReport.notAboutYouActive
    : state.userReport.notAboutYouActive;

  const partnerName = state.partnerName || 'Partner';
  // userReport is the creator's seat, not "you": this phone's own report is
  // the one for its seat.
  const myReport = state.activeUser === 'user' ? state.userReport : state.partnerReport;
  const theirReport = state.activeUser === 'user' ? state.partnerReport : state.userReport;
  const myHeavyDay = myReport.capacity <= 2;
  // Whether your partner has left you anything in the comfort box yet.
  const comfortForMe = hasComfort(comfortBoxesFor(state.comfortBoxes, state.activeUser).forMe);
  const heavyDay = myHeavyDay || theirReport.capacity <= 2 || isPartnerFlagActive;

  const today = localDateKey();
  // This phone's own weather, for the quote tuned to it.
  const { weather, capacity } = myReport;
  const resurfacedQuote = useMemo(() => quoteFor(today, weather, capacity), [today, weather, capacity]);

  /**
   * One of Home's cards. Each phone puts them in its own order and may switch
   * some off (core/homeLayout) - except that the comfort box still shows on a
   * heavy day.
   */
  const hidden = (id: HomeCardId) => layout.hidden.includes(id);
  const homeCard = (id: HomeCardId): React.ReactNode => {
    switch (id) {
      case 'ourDays':
        return hidden('ourDays') ? null : (
          <>
            {/* Your days together, from the dates the two of you set - or a quiet
                question until you have. */}
            <OurDatesCard dates={state.ourDates} onSave={onSetOurDates} />
          </>
        );
      case 'kural':
        return hidden('kural') ? null : (
          <>
            {/* A kural a day, on a palm leaf - the same one on both phones. */}
            <ThirukkuralCard onShare={onSendQuestion} />
          </>
        );
      case 'weather':
        return hidden('weather') ? null : (
          <>
            {/* Side-by-Side Emotional Weather & Capacity */}
            <EmotionalWeatherCard
              userReport={state.userReport}
              partnerReport={state.partnerReport}
              activeUser={state.activeUser}
              onUpdateReport={onUpdateReport}
              partnerName={partnerName}
            />
          </>
        );
      case 'comfort':
        return (
          <>
            {/* Emergency Comfort Box Banner on a heavy day; on any other day a
                quiet way in, because the box is filled ahead of time and this is
                the only place it opens from. */}
            {!heavyDay && !hidden('comfort') && (
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
            {/* The button has a row of its own, as on the card below: beside the
                words it left them a column a few letters wide on a phone. */}
            {heavyDay && (
              <div className="rounded-2xl border border-linen-accent/30 bg-linen-variant/50 p-4 shadow-xs space-y-3 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-linen-surface border border-linen-border text-linen-accent shrink-0">
                    <Heart className="w-4 h-4 fill-current" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-serif text-base font-medium text-linen-primary">
                      {myHeavyDay ? 'Go gently today' : `A heavy day for ${partnerName}`}
                    </h4>
                    <p className="text-xs text-linen-secondary mt-0.5">
                      {myHeavyDay
                        ? comfortForMe
                          ? `${partnerName} left something in your comfort box, with nothing asked of you.`
                          : 'Breathing and a hug are here whenever you need them.'
                        : 'Something kind in the comfort box might help.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowComfortBox(true)}
                  className="w-full px-3.5 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
                >
                  Open the comfort box
                </button>
              </div>
            )}
          </>
        );
      case 'thinking':
        return hidden('thinking') ? null : (
          <>
            {/* Thinking of You. The big heart sends it; the two quieter buttons
                sit on their own row so nothing has to squeeze in beside the
                title - three of them side by side pushed the card, and with it
                the whole screen, past the edge of a phone. */}
            <div className="rounded-3xl border border-linen-border bg-linen-surface p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-3.5">
                <button
                  onClick={() => triggerGlobalPulse('Thinking of you')}
                  className="w-14 h-14 rounded-[20px] bg-linen-accent text-linen-surface flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-glow cursor-pointer shrink-0"
                  aria-label={`Send ${partnerName} a heartbeat`}
                >
                  <Heart className="heart-beat w-7 h-7 fill-current" />
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
          </>
        );
      case 'question':
        return hidden('question') ? null : (
          <>
            {/* Today's question, answered together: each answer stays hidden
                from the other until you have both answered. */}
            <DailyQuestionCard
              answers={state.dailyAnswers || []}
              activeUser={state.activeUser}
              partnerName={partnerName}
              onAnswer={onAnswerQuestion}
              onSendToChat={onSendQuestion}
            />
          </>
        );
      case 'quote':
        return hidden('quote') ? null : (
          <>
            {/* Resurfaced Literary Quote, the same one all day */}
            <div className="rounded-3xl border border-linen-border bg-gradient-to-r from-linen-variant/30 via-linen-surface to-linen-variant/20 p-5 sm:p-6">
              <div className="flex items-center space-x-2 text-linen-secondary mb-2">
                <Quote className="w-4 h-4 text-linen-accent shrink-0" />
                <span className="text-xs font-medium uppercase tracking-wider text-linen-secondary">Quote of the day</span>
              </div>
              <p className="font-serif italic text-base sm:text-lg text-linen-primary leading-relaxed mb-2 break-words">
                “{resurfacedQuote.quote}”
              </p>
              <div className="text-xs text-linen-secondary flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium min-w-0">— {resurfacedQuote.author}{resurfacedQuote.source ? `, ${resurfacedQuote.source}` : ''}</span>
                <span className="text-[11px] text-linen-accent bg-linen-surface px-2 py-0.5 rounded-md border border-linen-border/60">
                  Picked for your {WEATHER_WORD[weather]} weather
                </span>
              </div>
            </div>
          </>
        );
      case 'milestones':
        return hidden('milestones') ? null : (
          <>
            {/* The milestones you have added together */}
            <MilestoneTrackerCard
              milestones={state.milestones}
              onAddMilestone={onAddMilestone}
            />
          </>
        );
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

      {/* New things only work properly when both phones have them. */}
      {partnerUpdate && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-linen-border bg-linen-surface p-4 shadow-xs">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-aurora-violet/15">
            <Sparkles className="h-4 w-4 text-aurora-violet" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-linen-primary">
              {partnerName}'s phone has an older Two
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-linen-secondary">
              They're on {partnerUpdate.version}. New things work best when both phones match, so remind{' '}
              {partnerName} to update.
            </p>
          </div>
          <button
            type="button"
            onClick={partnerUpdate.onDismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1 text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Now and then, a backup. Gentle and easy to put off: a week's quiet
          after Later, a month's after a backup (core/backupReminder.ts). */}
      {nudge && (
        <div role="status" className="rounded-2xl border border-linen-border bg-linen-surface p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-aurora-violet/15">
              <ShieldCheck className="h-4 w-4 text-aurora-violet" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-linen-primary">
                {nudge.everBackedUp ? 'Time for a fresh backup' : 'Keep a backup of your space'}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-linen-secondary">
                {nudge.everBackedUp
                  ? `Your last backup was ${nudge.daysSince} days ago. A new one keeps everything since then safe.`
                  : 'If this phone is ever lost, a backup brings everything back. It takes a minute, locked with a password only you know.'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                snoozeBackupNudge();
                setNudge(null);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
            >
              Later
            </button>
            <button
              type="button"
              onClick={() => {
                requestBackupOnOpen();
                onNavigate('settings');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
            >
              Back up now
            </button>
          </div>
        </div>
      )}

      {/* "It's not about you", switched on in Settings: here only while it is
          on, yours or your partner's. */}
      <NotAboutYouBanner
        isPartnerActive={isPartnerFlagActive}
        partnerName={partnerName}
        isUserActive={isUserFlagActive}
        onToggleUserFlag={onToggleUserFlag}
      />

      {/* Story Tour Banner, until it has been seen once */}
      {onOpenTour && (
        <div className="rounded-2xl border border-linen-border bg-gradient-to-r from-linen-variant/60 via-linen-surface to-linen-variant/40 p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-linen-primary text-linen-surface shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-linen-accent">A short tour</h4>
              <p className="text-xs text-linen-primary font-serif font-medium">A day with Two, in five short scenes</p>
            </div>
          </div>
          <button
            onClick={onOpenTour}
            className="inline-flex items-center px-3 py-1.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer shrink-0"
          >
            Start tour
          </button>
        </div>
      )}

      {layout.order.map(id => (
        <React.Fragment key={id}>{homeCard(id)}</React.Fragment>
      ))}

      {/* This phone's own order of the cards above, and which are shown. */}
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setArranging(true)}
          className="inline-flex items-center gap-2 rounded-[14px] border border-linen-border bg-linen-surface px-4 py-2.5 text-[13px] font-semibold text-linen-primary shadow-xs hover:bg-linen-variant/60 transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="h-4 w-4 text-linen-accent" />
          Arrange Home
        </button>
      </div>

      {arranging && (
        <ArrangeHomeSheet
          layout={layout}
          partnerName={partnerName}
          onChange={changeLayout}
          onClose={() => setArranging(false)}
        />
      )}

      <ComfortBoxModal
        isOpen={showComfortBox}
        onClose={() => setShowComfortBox(false)}
        // One box each: the one written for you, and the one you wrote. It
        // used to be a single shared box, where each new note replaced the
        // other person's.
        forMe={comfortBoxesFor(state.comfortBoxes, state.activeUser).forMe}
        mine={comfortBoxesFor(state.comfortBoxes, state.activeUser).mine}
        activeUser={state.activeUser}
        partnerName={state.partnerName}
        myName={state.userName}
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
