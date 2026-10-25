import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ActivityEvent, newsLineFor, routeFor } from '../core/activity';
import { activeLocale, dateLocale, tr, useT } from '../core/i18n';
import { clockTime } from '../core/when';

interface PartnerActivityCardProps {
  /** Already filtered to what this device has not seen, newest first. */
  news: ActivityEvent[];
  partnerName: string;
  onNavigate: (tab: string) => void;
  /** Names the destinations, so this file does not keep a second copy. */
  labelFor: (tabId: string) => string;
}

/** Beyond this the list stops being a glance and starts being a ledger. */
const SHOWN = 4;

/**
 * When it happened, said the short way.
 *
 * Not formatLastSeen, which is written for presence and says "last seen today
 * at 10:18 pm" - true of a person, wrong about an event, and it read as
 * "Private Chat last seen today" here, which is a different claim entirely.
 */
// Made once for each language: toLocaleTimeString with options builds a
// formatter on every call, and this card is drawn again with every change
// that arrives.
const FORMATS = new Map<string, { TIME: Intl.DateTimeFormat; DAY: Intl.DateTimeFormat }>();
function formats() {
  const locale = dateLocale();
  let made = FORMATS.get(locale || '');
  if (!made) {
    made = {
      TIME: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
      DAY: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
    };
    FORMATS.set(locale || '', made);
  }
  return made;
}

function whenFor(at: number): string {
  if (!at) return '';
  const { TIME, DAY } = formats();
  const then = new Date(at);
  // In Tamil the phone's own format still says "PM"; clockTime says "மாலை 4:44",
  // the way the chat does.
  const time = activeLocale() === 'ta' ? clockTime(at) : TIME.format(then);
  if (new Date().toDateString() === then.toDateString()) return time;
  const yesterday = new Date(Date.now() - 86_400_000).toDateString() === then.toDateString();
  if (yesterday) return tr('yesterday, {time}', { time });
  return DAY.format(then);
}

/**
 * What your partner changed while you were elsewhere.
 *
 * The dock carries a dot for the loud ones, which works while you are already
 * scrolling it - and the rail is thirty-two tabs wide with four in view, so a
 * dot alone means hunting. This is the other half: the screen you land on
 * anyway, saying plainly where to look, so nothing has to be found.
 *
 * Absent entirely when there is nothing, rather than sitting there empty. A
 * card that says "nothing new" is a card you learn to stop reading, and this
 * one has to still be worth a glance on the day it matters.
 */
export const PartnerActivityCard: React.FC<PartnerActivityCardProps> = ({
  news,
  partnerName,
  onNavigate,
  labelFor
}) => {
  const tr = useT();
  const [expanded, setExpanded] = useState(false);
  if (news.length === 0) return null;

  const shown = expanded ? news : news.slice(0, SHOWN);
  const hidden = news.length - shown.length;

  return (
    <div className="rounded-2xl border border-linen-border bg-linen-surface p-4 shadow-xs">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-linen-accent">
          {tr('While you were away')}
        </h4>
        <span className="shrink-0 text-[10px] text-linen-secondary">
          {news.length === 1 ? tr('1 thing') : tr('{n} things', { n: news.length })}
        </span>
      </div>

      <ul className="space-y-1">
        {shown.map(event => {
          const loud = routeFor(event.type)?.tier === 'for-you';
          // The name stays bold wherever the sentence puts it.
          const [before, after = ''] = newsLineFor(event.type).split('{name}');
          return (
            <li key={event.id}>
              <button
                onClick={() => onNavigate(event.tabId)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-linen-variant/60 cursor-pointer"
              >
                {/* The same mark the dock uses, so the two read as one thing. */}
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    loud ? 'bg-rose-500' : 'bg-linen-secondary/40'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-linen-primary">
                    {before}<span className="font-medium">{partnerName}</span>{after}
                  </span>
                  <span className="block truncate text-[10px] text-linen-secondary">
                    {labelFor(event.tabId)}
                    {whenFor(event.at) && <> &middot; {whenFor(event.at)}</>}
                  </span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-linen-secondary" />
              </button>
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 w-full rounded-lg px-2 py-1 text-[11px] font-medium text-linen-secondary hover:bg-linen-variant/60 hover:text-linen-primary transition-colors cursor-pointer"
        >
          {tr('{n} more', { n: hidden })}
        </button>
      )}
    </div>
  );
};
