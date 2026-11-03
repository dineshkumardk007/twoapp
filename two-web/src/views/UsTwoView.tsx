import React from 'react';
import type { SpaceState } from '../core/storage';
import { UsScene } from '../components/UsScene';
import { triggerGlobalPulse } from '../components/SensoryPulseOverlay';
import { useT } from '../core/i18n';
import type { PlayKind } from '../core/usTwo';

interface UsTwoViewProps {
  state: SpaceState;
  partnerOnline: boolean;
  partnerTyping: boolean;
  onPlay: (kind: PlayKind, quiet: boolean) => void;
}

/** "Us two", on its own tab: the cartoon of you two up top, the plays below. */
export const UsTwoView: React.FC<UsTwoViewProps> = ({ state, partnerOnline, partnerTyping, onPlay }) => {
  const tr = useT();
  const partnerName = state.partnerName && state.partnerName !== 'Partner' ? state.partnerName : tr('Partner');
  const mine = state.activeUser === 'user' ? state.userReport : state.partnerReport;
  const theirs = state.activeUser === 'user' ? state.partnerReport : state.userReport;
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
      />
    </div>
  );
};
