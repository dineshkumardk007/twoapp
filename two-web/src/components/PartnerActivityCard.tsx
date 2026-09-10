import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ActivityEvent, phraseFor, routeFor } from '../core/activity';

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
function whenFor(at: number): string {
  if (!at) return '';
  const time = new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const today = new Date().toDateString() === new Date(at).toDateString();
  if (today) return time;
  const yesterday = new Date(Date.now() - 86_400_000).toDateString() === new Date(at).toDateString();
  if (yesterday) return `yesterday, ${time}`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
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
  const [expanded, setExpanded] = useState(false);
  if (news.length === 0) return null;

  const shown = expanded ? news : news.slice(0, SHOWN);
  const hidden = news.length - shown.length;

  return (
    <div className="rounded-2xl border border-linen-border bg-linen-surface p-4 shadow-xs">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-linen-accent">
          While you were away
        </h4>
        <span className="shrink-0 text-[10px] text-linen-secondary">
          {news.length} {news.length === 1 ? 'thing' : 'things'}
        </span>
      </div>

      <ul className="space-y-1">
        {shown.map(event => {
          const loud = routeFor(event.type)?.tier === 'for-you';
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
                    <span className="font-medium">{partnerName}</span> {phraseFor(event.type)}
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
          {hidden} more
        </button>
      )}
    </div>
  );
};
