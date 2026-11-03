import React from 'react';
import { ChevronRight, Gift } from 'lucide-react';
import type { SpaceState } from '../core/storage';
import { UsScene } from '../components/UsScene';
import { triggerGlobalPulse } from '../components/SensoryPulseOverlay';
import { useT } from '../core/i18n';
import { bookOf, opensAt } from '../core/surprise';
import type { PlayKind, Seat } from '../core/usTwo';

interface UsTwoViewProps {
  state: SpaceState;
  partnerOnline: boolean;
  partnerTyping: boolean;
  onPlay: (kind: PlayKind, quiet: boolean) => void;
  /** Whose birthday it is today, if anyone's: a party in the scene. */
  party?: Seat | null;
  /** A surprise of theirs, due and closed before its card: waiting here. */
  surpriseWaitingId?: string | null;
  onPlanSurprise: () => void;
  onOpenSurprise: (id: string) => void;
}

const when = (at: number) =>
  new Date(at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * "Us two", on its own tab: the cartoon of you two up top, the plays below -
 * and at the foot, a surprise to plan for the other (core/surprise). That
 * row is the same on both phones: it never says one is on its way to you.
 */
export const UsTwoView: React.FC<UsTwoViewProps> = ({
  state,
  partnerOnline,
  partnerTyping,
  onPlay,
  party = null,
  surpriseWaitingId = null,
  onPlanSurprise,
  onOpenSurprise
}) => {
  const tr = useT();
  const partnerName = state.partnerName && state.partnerName !== 'Partner' ? state.partnerName : tr('Partner');
  const mine = state.activeUser === 'user' ? state.userReport : state.partnerReport;
  const theirs = state.activeUser === 'user' ? state.partnerReport : state.userReport;
  const book = bookOf(state.surprises);
  const planned = book.plans.find(p => p.author === state.activeUser && !p.cancelled);
  // One of theirs already opened, to see again - only once it has opened.
  const opened = book.plans.find(p => p.author !== state.activeUser && !p.cancelled && book.opened.includes(p.id));

  const plannedLine = planned
    ? book.seen[planned.id]
      ? tr('{name} opened it · {when}', { name: partnerName, when: when(book.seen[planned.id]) })
      : book.ready[planned.id] === planned.updatedAt
        ? tr('Ready on {name}’s phone. It opens {when}.', { name: partnerName, when: when(opensAt(planned)) })
        : tr('On its way to {name}’s phone…', { name: partnerName })
    : tr('A birthday at midnight: a cake to blow out, your letter, photos and voice.');

  const row =
    'flex w-full items-center gap-3 rounded-2xl border border-linen-border bg-linen-surface/70 px-4 py-3 text-left transition-colors hover:bg-linen-variant/60 active:scale-[0.99]';

  return (
    <div className="mx-auto w-full max-w-xl">
      <UsScene
        size="tab"
        activeUser={state.activeUser}
        partnerName={partnerName}
        partnerOnline={partnerOnline}
        partnerTyping={partnerTyping}
        partnerLastSeen={state.partnerLastSeen}
        myWeather={mine.weather}
        theirWeather={theirs.weather}
        messages={state.messages}
        boops={state.boops}
        onPlay={onPlay}
        onSendHeart={() => triggerGlobalPulse('Thinking of you')}
        party={party}
      />

      <div className="mt-6 space-y-2">
        {surpriseWaitingId && (
          <button type="button" onClick={() => onOpenSurprise(surpriseWaitingId)} className={`${row} border-linen-accent/40`}>
            <span className="text-2xl" aria-hidden="true">
              🎁
            </span>
            <span className="min-w-0 flex-1 text-[14px] font-semibold text-linen-primary">
              {tr('A surprise from {name} is waiting for you', { name: partnerName })}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-linen-secondary" aria-hidden="true" />
          </button>
        )}
        {opened && (
          <button type="button" onClick={() => onOpenSurprise(opened.id)} className={row}>
            <span className="text-2xl" aria-hidden="true">
              💝
            </span>
            <span className="min-w-0 flex-1 text-[14px] font-semibold text-linen-primary">
              {tr('Open {name}’s surprise again', { name: partnerName })}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-linen-secondary" aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onPlanSurprise} className={row}>
          <Gift className="h-5 w-5 shrink-0 text-linen-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-linen-primary">
              {planned ? tr('Your surprise for {name}', { name: partnerName }) : tr('Plan a surprise for {name}', { name: partnerName })}
            </span>
            <span className="mt-0.5 block text-[12px] leading-snug text-linen-secondary">{plannedLine}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-linen-secondary" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
