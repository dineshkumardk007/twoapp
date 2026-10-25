import React, { useMemo, useState } from 'react';
import { Sparkles, Flame, Lock, Hourglass, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { DailyAnswer } from '../types';
import { questionById, questionForDay } from '../data/questions';
import { MAX_ANSWER_CHARS } from '../core/sharedRecords';
import { formatDay, localDateKey } from '../core/ourDates';
import { useToday } from '../core/useToday';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';

interface DailyQuestionCardProps {
  answers: DailyAnswer[];
  activeUser: 'user' | 'partner';
  partnerName: string;
  /** Gives this phone's answer - final, and sent to both phones. */
  onAnswer: (answer: { day: string; questionId: string; prompt: string; text: string }) => void;
  /** Puts a line in the chat, as an ordinary message. */
  onSendToChat: (text: string) => void;
}

/** Which question this phone last mentioned in the chat, and on what day. */
const SENT_QUESTION_KEY = 'two_daily_question_sent';

function readSent(): string | null {
  try {
    return localStorage.getItem(SENT_QUESTION_KEY);
  } catch {
    return null;
  }
}

/**
 * The tier's badge: one quiet badge in the theme's colours. The four tiers
 * used to come in four colours of their own, amber to rose, on a screen meant
 * to be calm.
 */
const TIER_LABELS: Record<string, string> = {
  playful: 'Playful',
  curious: 'Curious',
  deep: 'Deep',
  spicy: 'Spicy'
};

/** How many earlier days are shown before "Show more". */
const EARLIER_SHOWN = 5;

interface Pair {
  day: string;
  prompt: string;
  mine: DailyAnswer;
  theirs: DailyAnswer;
}

/** One of yesterday's questions the other person answered. */
interface LateQuestion {
  questionId: string;
  prompt: string;
  theirs: DailyAnswer;
  mine?: DailyAnswer;
}

/** The calendar day before `day`, worked out at midday, clear of any clock change. */
function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const noon = new Date(y, m - 1, d, 12);
  noon.setDate(noon.getDate() - 1);
  return localDateKey(noon);
}

/**
 * Today's question, answered together.
 *
 * Each of you answers on your own phone, and neither answer is shown to the
 * other until both are in - so you each say what you really think rather than
 * echoing the first one. An answer is final once locked in: changing it after
 * reading the other's would undo the point.
 *
 * Every day has an everyday question and a spicy one. Both come from the date
 * alone, so the two phones agree without asking each other; each is its own
 * question to answer.
 */
export const DailyQuestionCard: React.FC<DailyQuestionCardProps> = ({
  answers,
  activeUser,
  partnerName,
  onAnswer,
  onSendToChat
}) => {
  const tr = useT();
  const today = useToday();
  const [spicy, setSpicy] = useState(false);
  // A draft per question, so looking at the spicy one and back keeps what
  // you had started.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<string | null>(readSent);
  const [showAllEarlier, setShowAllEarlier] = useState(false);
  const [earlierOpen, setEarlierOpen] = useState(false);

  const question = questionForDay(today, spicy);
  const otherQuestion = questionForDay(today, !spicy);
  const other: 'user' | 'partner' = activeUser === 'user' ? 'partner' : 'user';

  const find = (questionId: string, seat: 'user' | 'partner') =>
    answers.find(a => a.day === today && a.questionId === questionId && a.seat === seat);
  const mine = find(question.id, activeUser);
  const theirs = find(question.id, other);
  // They answered the other of today's two questions - worth a word, or you
  // might be looking at the one they did not answer.
  const theirsOnOther = find(otherQuestion.id, other);
  const mineOnOther = find(otherQuestion.id, activeUser);

  const draftKey = `${today}|${question.id}`;
  const draft = drafts[draftKey] || '';
  const setDraft = (key: string, value: string) => setDrafts(prev => ({ ...prev, [key]: value }));
  const clearDraft = (key: string) =>
    setDrafts(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  const sentKey = `${today}|${question.id}`;
  const alreadySent = sent === sentKey;

  const markSent = () => {
    setSent(sentKey);
    try {
      localStorage.setItem(SENT_QUESTION_KEY, sentKey);
    } catch {
      /* storage unavailable: the button simply forgets on leaving Home */
    }
  };

  const lockIn = () => {
    const text = draft.trim();
    if (!text || mine) return;
    haptic('confirm');
    onAnswer({ day: today, questionId: question.id, prompt: question.prompt, text });
    clearDraft(draftKey);
  };

  /**
   * Yesterday's questions the other person answered.
   *
   * The question moves on at midnight, so an answer given late one evening
   * used to wait for an answer that could no longer be given: the card had
   * already moved to the next day, and theirs stayed hidden for good. Each
   * stays here, open to answer, until you have - and once you both have, the
   * pair stays here for the rest of the day an answer came in late, so the
   * reveal is seen rather than filed straight away under earlier answers.
   */
  const yesterday = dayBefore(today);
  const late = useMemo<LateQuestion[]>(() => {
    const answeredToday = (a?: DailyAnswer) => !!a && localDateKey(new Date(a.at)) === today;
    const byQuestion = new Map<string, { mine?: DailyAnswer; theirs?: DailyAnswer }>();
    for (const a of answers) {
      if (a.day !== yesterday) continue;
      const entry = byQuestion.get(a.questionId) || {};
      if (a.seat === activeUser) entry.mine = entry.mine || a;
      else entry.theirs = entry.theirs || a;
      byQuestion.set(a.questionId, entry);
    }
    const list: LateQuestion[] = [];
    for (const [questionId, entry] of byQuestion) {
      if (!entry.theirs) continue;
      if (entry.mine && !answeredToday(entry.mine) && !answeredToday(entry.theirs)) continue;
      list.push({
        questionId,
        prompt: entry.theirs.prompt || entry.mine?.prompt || questionById(questionId)?.prompt || '',
        theirs: entry.theirs,
        mine: entry.mine
      });
    }
    return list;
  }, [answers, today, yesterday, activeUser]);

  const lockInLate = (item: LateQuestion) => {
    const key = `${yesterday}|${item.questionId}`;
    const text = (drafts[key] || '').trim();
    if (!text || item.mine) return;
    haptic('confirm');
    onAnswer({ day: yesterday, questionId: item.questionId, prompt: item.prompt, text });
    clearDraft(key);
  };

  const askInChat = () => {
    onSendToChat(tr('Today\'s question: “{prompt}”', { prompt: question.prompt }));
    markSent();
  };

  const remindInChat = () => {
    onSendToChat(tr('I\'ve answered today\'s question - your turn: “{prompt}”', { prompt: question.prompt }));
    markSent();
  };

  // Earlier questions you both answered, newest first. Today's other
  // question counts too once it is open to both of you.
  const earlier = useMemo<Pair[]>(() => {
    const byQuestion = new Map<string, { mine?: DailyAnswer; theirs?: DailyAnswer }>();
    const shownAbove = new Set(late.map(item => item.questionId));
    for (const a of answers) {
      if (a.day === today && a.questionId === question.id) continue;
      if (a.day === yesterday && shownAbove.has(a.questionId)) continue;
      const key = `${a.day}|${a.questionId}`;
      const entry = byQuestion.get(key) || {};
      if (a.seat === activeUser) entry.mine = entry.mine || a;
      else entry.theirs = entry.theirs || a;
      byQuestion.set(key, entry);
    }
    const pairs: Pair[] = [];
    for (const entry of byQuestion.values()) {
      if (!entry.mine || !entry.theirs) continue;
      pairs.push({
        day: entry.mine.day,
        prompt: entry.mine.prompt || entry.theirs.prompt,
        mine: entry.mine,
        theirs: entry.theirs
      });
    }
    return pairs.sort((a, b) =>
      a.day === b.day ? Math.max(b.mine.at, b.theirs.at) - Math.max(a.mine.at, a.theirs.at) : b.day.localeCompare(a.day)
    );
  }, [answers, today, yesterday, late, question.id, activeUser]);

  const shownEarlier = showAllEarlier ? earlier : earlier.slice(0, EARLIER_SHOWN);

  return (
    <div className="rounded-3xl border border-linen-border bg-linen-surface p-5 sm:p-6 shadow-xs">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-linen-accent shrink-0" />
          <span className="text-xs font-semibold tracking-wider uppercase text-linen-accent">{tr("Today's question")}</span>
          {TIER_LABELS[question.tier] && (
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-linen-variant text-linen-secondary border border-linen-border">
              {tr(TIER_LABELS[question.tier])}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            haptic('tick');
            setSpicy(!spicy);
          }}
          aria-pressed={spicy}
          className={`inline-flex shrink-0 items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all ${
            spicy
              ? 'bg-linen-variant text-linen-primary border-linen-accent/40 font-medium'
              : 'text-linen-secondary border-linen-border hover:bg-linen-variant'
          }`}
          title={tr('Spicy questions are for when you both want them')}
        >
          <Flame className={`w-3 h-3 shrink-0 ${spicy ? 'text-linen-accent' : ''}`} />
          {spicy ? tr('Spicy: on') : tr('Spicy: off')}
        </button>
      </div>

      {/* The questions are in English (data/questions), whatever the phone's language. */}
      <p lang="en" className="font-serif text-lg sm:text-xl text-linen-primary leading-relaxed my-3 font-normal break-words">
        “{question.prompt}”
      </p>

      {/* Both answered: the reveal. Theirs first - it is the one you have
          not read yet. */}
      {mine && theirs && (
        <div className="space-y-2.5 mt-4 animate-scale-up">
          <AnswerBubble label={partnerName} text={theirs.text} tone="theirs" />
          <AnswerBubble label={tr('You')} text={mine.text} tone="mine" />
          <p className="text-[11px] text-linen-secondary text-center pt-1">{tr('You both answered - talk it over tonight')}</p>
        </div>
      )}

      {/* Yours is in; theirs is not yet. */}
      {mine && !theirs && (
        <div className="space-y-3 mt-4">
          <AnswerBubble label={tr('Your answer')} text={mine.text} tone="mine" />
          <div className="flex items-start gap-2 text-xs text-linen-secondary">
            <Hourglass className="w-3.5 h-3.5 mt-0.5 shrink-0 text-linen-accent" />
            <span>
              {tr("Waiting for {name}. You'll see each other's answers as soon as they answer.", { name: partnerName })}
            </span>
          </div>
          <button
            onClick={remindInChat}
            disabled={alreadySent}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-linen-border bg-linen-variant/50 text-linen-primary text-xs font-medium hover:bg-linen-variant transition-colors disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            {alreadySent ? tr('Sent to chat') : tr('Tell {name} in chat', { name: partnerName })}
          </button>
        </div>
      )}

      {/* Not answered yet. */}
      {!mine && (
        <div className="space-y-3 mt-4">
          {theirs ? (
            <div className="flex items-center gap-2 rounded-xl bg-linen-variant/60 border border-linen-border px-3 py-2 text-xs text-linen-primary">
              <Lock className="w-3.5 h-3.5 shrink-0 text-linen-accent" />
              <span>{tr('{name} has answered. Answer to see theirs.', { name: partnerName })}</span>
            </div>
          ) : (
            <p className="text-xs text-linen-secondary">
              {tr("Answer on your own. You'll both see each other's answers once you've both answered.")}
            </p>
          )}
          <textarea
            value={draft}
            onChange={e => setDraft(draftKey, e.target.value)}
            maxLength={MAX_ANSWER_CHARS}
            rows={3}
            placeholder={tr('Your answer…')}
            aria-label={tr('Your answer')}
            className="w-full px-3.5 py-2.5 rounded-xl bg-linen-variant/40 border border-linen-border text-linen-primary text-sm leading-relaxed placeholder:text-linen-secondary/70 focus:outline-hidden focus:border-linen-accent/60 resize-none"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={askInChat}
              disabled={alreadySent}
              className="text-xs text-linen-secondary hover:text-linen-primary underline-offset-2 hover:underline disabled:no-underline disabled:opacity-60 min-w-0 text-left"
            >
              {alreadySent ? tr('Sent to chat') : tr('Ask in chat instead')}
            </button>
            <button
              onClick={lockIn}
              disabled={!draft.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Lock className="w-3.5 h-3.5" />
              {tr('Lock in my answer')}
            </button>
          </div>
          <p className="text-[10px] text-linen-secondary text-right -mt-1">{tr("Answers can't be changed once locked in")}</p>
        </div>
      )}

      {/* The other of today's questions, answered by them and not yet by you. */}
      {theirsOnOther && !mineOnOther && (
        <button
          onClick={() => setSpicy(!spicy)}
          className="mt-4 w-full flex items-center justify-between gap-2 rounded-xl border border-dashed border-linen-border px-3 py-2 text-left text-xs text-linen-secondary hover:bg-linen-variant/40 transition-colors"
        >
          <span className="min-w-0">
            {spicy
              ? tr("{name} answered today's everyday question too", { name: partnerName })
              : tr("{name} answered today's spicy question too", { name: partnerName })}
          </span>
          <span className="shrink-0 font-medium text-linen-primary">{tr('Show it')}</span>
        </button>
      )}

      {late.map(item => {
        const key = `${yesterday}|${item.questionId}`;
        const lateDraft = drafts[key] || '';
        return (
          <div key={key} className="mt-4 pt-3 border-t border-linen-border/50 space-y-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-linen-secondary">
              {tr("Yesterday's question")}
            </div>
            {item.prompt && <p lang="en" className="font-serif text-sm text-linen-primary leading-snug">“{item.prompt}”</p>}
            {item.mine ? (
              <div className="space-y-2 animate-scale-up">
                <AnswerBubble label={partnerName} text={item.theirs.text} tone="theirs" compact />
                <AnswerBubble label={tr('You')} text={item.mine.text} tone="mine" compact />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-linen-variant/60 border border-linen-border px-3 py-2 text-xs text-linen-primary">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-linen-accent" />
                  <span>{tr("{name} answered. There's still time - answer to see theirs.", { name: partnerName })}</span>
                </div>
                <textarea
                  value={lateDraft}
                  onChange={e => setDraft(key, e.target.value)}
                  maxLength={MAX_ANSWER_CHARS}
                  rows={2}
                  placeholder={tr('Your answer…')}
                  aria-label={tr("Your answer to yesterday's question")}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-linen-variant/40 border border-linen-border text-linen-primary text-sm leading-relaxed placeholder:text-linen-secondary/70 focus:outline-hidden focus:border-linen-accent/60 resize-none"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => lockInLate(item)}
                    disabled={!lateDraft.trim()}
                    className="inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {tr('Lock in my answer')}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      {earlier.length > 0 && (
        <div className="mt-4 pt-3 border-t border-linen-border/50">
          <button
            onClick={() => setEarlierOpen(!earlierOpen)}
            aria-expanded={earlierOpen}
            className="w-full flex items-center justify-between text-xs text-linen-secondary hover:text-linen-primary"
          >
            <span>{tr('Earlier answers ({n})', { n: earlier.length })}</span>
            {earlierOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {earlierOpen && (
            <div className="mt-3 space-y-4 animate-fade-in">
              {shownEarlier.map(pair => (
                <div key={`${pair.day}|${pair.mine.questionId}`} className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-linen-secondary">
                    {pair.day === today ? tr('Today') : formatDay(pair.day, false)}
                  </div>
                  {pair.prompt && (
                    <p lang="en" className="font-serif text-sm text-linen-primary leading-snug">“{pair.prompt}”</p>
                  )}
                  <AnswerBubble label={partnerName} text={pair.theirs.text} tone="theirs" compact />
                  <AnswerBubble label={tr('You')} text={pair.mine.text} tone="mine" compact />
                </div>
              ))}
              {earlier.length > EARLIER_SHOWN && (
                <button
                  onClick={() => setShowAllEarlier(!showAllEarlier)}
                  className="text-xs font-medium text-linen-primary hover:underline underline-offset-2"
                >
                  {showAllEarlier ? tr('Show fewer') : tr('Show all {n}', { n: earlier.length })}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AnswerBubble: React.FC<{ label: string; text: string; tone: 'mine' | 'theirs'; compact?: boolean }> = ({
  label,
  text,
  tone,
  compact
}) => (
  <div
    className={`rounded-2xl border ${compact ? 'px-3 py-2' : 'px-3.5 py-2.5'} ${
      tone === 'theirs' ? 'bg-linen-variant/60 border-linen-accent/25' : 'bg-linen-surface border-linen-border'
    }`}
  >
    <div className="text-[10px] font-semibold uppercase tracking-wider text-linen-accent mb-0.5">{label}</div>
    <p className={`select-text whitespace-pre-line break-words text-linen-primary ${compact ? 'text-xs' : 'text-sm'} leading-relaxed`}>
      {text}
    </p>
  </div>
);
