import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { SpaceState } from '../core/storage';
import { UsScene } from '../components/UsScene';
import { triggerGlobalPulse } from '../components/SensoryPulseOverlay';
import { useT } from '../core/i18n';
import { bookOf } from '../core/surprise';
import type { PlayKind, SceneTheme, Seat } from '../core/usTwo';
import type { Wear } from '../core/wear';

interface UsTwoViewProps {
  state: SpaceState;
  partnerOnline: boolean;
  partnerTyping: boolean;
  onPlay: (kind: PlayKind, quiet: boolean, variant?: number) => void;
  /** Picks the sky over the scene, for both phones. */
  onTheme: (theme: SceneTheme) => void;
  /** This phone's own bear or bunny dressed differently (core/wear). */
  onWear?: (wear: Wear) => void;
  /** Whose birthday it is today, if anyone's: a party in the scene. */
  party?: Seat | null;
  /** A surprise of theirs, due and closed before its card: waiting here. */
  surpriseWaitingId?: string | null;
  onOpenSurprise: (id: string) => void;
}

/**
 * "Us two", on its own tab: the cartoon of you two up top, the plays below -
 * and at the foot, once it has opened, a surprise from the other
 * (core/surprise). Planning one is not here, where the other would see a new
 * row: it opens from five taps on the version number in Settings.
 */
export const UsTwoView: React.FC<UsTwoViewProps> = ({
  state,
  partnerOnline,
  partnerTyping,
  onPlay,
  onTheme,
  onWear,
  party = null,
  surpriseWaitingId = null,
  onOpenSurprise
}) => {
  const tr = useT();
  const partnerName = state.partnerName && state.partnerName !== 'Partner' ? state.partnerName : tr('Partner');
  const mine = state.activeUser === 'user' ? state.userReport : state.partnerReport;
  const theirs = state.activeUser === 'user' ? state.partnerReport : state.userReport;
  const book = bookOf(state.surprises);
  // One of theirs already opened, to see again - only once it has opened.
  const opened = book.plans.find(p => p.author !== state.activeUser && !p.cancelled && book.opened.includes(p.id));

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
        theme={state.usTheme?.theme}
        onTheme={onTheme}
        wear={state.usWear}
        onWear={onWear}
      />

      {(surpriseWaitingId || opened) && (
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
        </div>
      )}
    </div>
  );
};
