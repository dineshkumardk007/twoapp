import React, { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { liveStatus, type StatusNote } from '../core/status';
import { useNowAt } from '../core/useToday';
import { clockTime } from '../core/when';
import { useT } from '../core/i18n';
import { StatusSheet } from './StatusSheet';

interface StatusStripProps {
  partnerName: string;
  mine?: StatusNote;
  theirs?: StatusNote;
  onSet: (status: { text: string; emoji?: string; clearsAt: number }) => void;
  onClear: () => void;
}

/**
 * The top of Home: your partner's status, if they have one showing, and
 * yours - or a way to set one (core/status). Each goes from here by itself
 * when its time is up.
 */
export const StatusStrip: React.FC<StatusStripProps> = ({ partnerName, mine, theirs, onSet, onClear }) => {
  const tr = useT();
  const [open, setOpen] = useState(false);
  // Drawn again when the sooner of the two runs out; what shows is decided
  // by the clock as it is now, not as it was when last drawn.
  const ends = [mine?.clearsAt, theirs?.clearsAt].filter((t): t is number => typeof t === 'number' && t > Date.now());
  useNowAt(ends.length ? Math.min(...ends) : undefined);
  const myLive = liveStatus(mine);
  const theirLive = liveStatus(theirs);

  return (
    <>
    <section aria-label={tr('Statuses')} className="overflow-hidden rounded-2xl border border-linen-border bg-linen-surface shadow-xs">
      {theirLive && (
        <div className="flex items-center gap-3 px-4 py-3" role="status">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linen-variant text-lg leading-none">
            {theirLive.emoji || '💬'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-linen-primary">
              {partnerName} · {tr(theirLive.text)}
            </span>
            <span className="block text-[11px] text-linen-secondary">{tr('Since {time}', { time: clockTime(theirLive.setAt) })}</span>
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-linen-variant/50 transition-colors ${
          theirLive ? 'border-t border-linen-border' : ''
        }`}
      >
        {myLive ? (
          <>
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linen-variant text-lg leading-none">
              {myLive.emoji || '💬'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-linen-primary">{tr('You')} · {tr(myLive.text)}</span>
              <span className="block text-[11px] text-linen-secondary">{tr('Until {time}', { time: clockTime(myLive.clearsAt) })}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-linen-accent">{tr('Change')}</span>
          </>
        ) : (
          <>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-aurora-violet/15">
              <Plus className="h-4 w-4 text-aurora-violet" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-linen-primary">{tr('Set your status')}</span>
              <span className="block truncate text-[11px] text-linen-secondary">
                {tr('On the way, reached home, free to talk - {name} sees it', { name: partnerName })}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-linen-secondary" />
          </>
        )}
      </button>
    </section>
    {open && (
      <StatusSheet
        partnerName={partnerName}
        current={myLive}
        onSet={onSet}
        onClear={onClear}
        onClose={() => setOpen(false)}
      />
    )}
    </>
  );
};
