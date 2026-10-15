import React from 'react';
import {
  BookOpen, CalendarHeart, ChevronDown, ChevronUp, CloudSun, Flag, Heart, HeartPulse, Info,
  MessageCircleQuestion, Quote
} from 'lucide-react';
import { useBackLayer } from '../core/backStack';
import {
  HOME_CARDS,
  HomeCardId,
  HomeLayout,
  defaultLayout,
  isDefaultLayout,
  moveCard,
  setCardShown
} from '../core/homeLayout';

const ICONS: Record<HomeCardId, React.ComponentType<{ className?: string }>> = {
  ourDays: CalendarHeart,
  kural: BookOpen,
  weather: CloudSun,
  notAboutYou: Info,
  comfort: Heart,
  thinking: HeartPulse,
  question: MessageCircleQuestion,
  quote: Quote,
  milestones: Flag
};

interface ArrangeHomeSheetProps {
  layout: HomeLayout;
  partnerName: string;
  /** Every change, as it is made: Home rearranges behind the sheet. */
  onChange: (layout: HomeLayout) => void;
  onClose: () => void;
}

/**
 * Home's cards, to put in the order you want and switch off the ones you do
 * not use - on this phone only. Each change shows on Home straight away,
 * behind the sheet. Back, Done or a tap above the sheet closes it.
 */
export const ArrangeHomeSheet: React.FC<ArrangeHomeSheetProps> = ({ layout, partnerName, onChange, onClose }) => {
  useBackLayer(true, onClose);
  const byId = new Map(HOME_CARDS.map(c => [c.id, c]));
  const last = layout.order.length - 1;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/35"
      onPointerDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="arrange-home-title"
        className="flex max-h-[88vh] flex-col rounded-t-[28px] bg-linen-surface surface-solid px-[18px] pt-2.5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-linen-border" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="arrange-home-title" className="font-serif text-xl font-semibold text-linen-primary">
              Arrange your Home
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-linen-secondary">
              Move cards up or down, and switch off the ones you don't use. Just this phone.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl bg-linen-primary px-3.5 py-2 text-[13px] font-semibold text-linen-surface hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>

        <div className="mt-3.5 min-h-0 overflow-y-auto rounded-[18px] border border-linen-border px-2.5">
          {layout.order.map((id, i) => {
            const card = byId.get(id)!;
            const Icon = ICONS[id];
            const shown = !layout.hidden.includes(id);
            const note = !shown && card.stillShows ? card.stillShows(partnerName) : '';
            return (
              <div
                key={id}
                className={`flex items-center gap-2.5 py-2 ${i ? 'border-t border-linen-border' : ''}`}
              >
                <Icon className={`ml-1 h-4 w-4 shrink-0 text-linen-accent ${shown ? '' : 'opacity-50'}`} />
                {/* Switched off reads as greyed, not faded: its note has to stay readable. */}
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${shown ? 'text-linen-primary' : 'text-linen-secondary'}`}>
                    {card.label}
                  </span>
                  {note && <span className="block text-[11px] text-linen-secondary">{note}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(moveCard(layout, id, -1))}
                  disabled={i === 0}
                  aria-label={`Move ${card.label} up`}
                  className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-linen-variant text-linen-secondary hover:text-linen-primary disabled:opacity-35 transition-colors"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(moveCard(layout, id, 1))}
                  disabled={i === last}
                  aria-label={`Move ${card.label} down`}
                  className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-linen-variant text-linen-secondary hover:text-linen-primary disabled:opacity-35 transition-colors"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shown}
                  aria-label={`Show ${card.label}`}
                  onClick={() => onChange(setCardShown(layout, id, !shown))}
                  className={`relative ml-1 h-6 w-10 shrink-0 rounded-full transition-colors ${
                    shown ? 'bg-gradient-to-r from-aurora-violet to-aurora-pink' : 'bg-linen-secondary/30'
                  }`}
                >
                  <span
                    className={`no-remap absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all ${
                      shown ? 'left-[19px]' : 'left-[3px]'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-3 px-0.5 text-[11px] leading-relaxed text-linen-secondary">
          News from {partnerName} and reminders always stay at the top, so you never miss them.
        </p>
        {!isDefaultLayout(layout) && (
          <button
            type="button"
            onClick={() => onChange(defaultLayout())}
            className="mt-2 self-center rounded-lg px-3 py-1.5 text-xs font-semibold text-linen-accent hover:bg-linen-variant transition-colors"
          >
            Back to the usual order
          </button>
        )}
      </div>
    </div>
  );
};
