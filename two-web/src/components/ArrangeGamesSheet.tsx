import React from 'react';
import { ChevronDown, ChevronUp, Smartphone } from 'lucide-react';
import { useBackLayer } from '../core/backStack';
import { defaultShelf, isDefaultShelf, setGameShown, type ShelfLayout } from '../core/gameShelf';
import { useT } from '../core/i18n';

interface ArrangeGamesSheetProps {
  layout: ShelfLayout;
  /** The games this phone has: anything else in the layout is left out of the list. */
  games: string[];
  nameOf: (id: string) => string;
  iconOf: (id: string) => React.ReactNode;
  /** The same order on both phones. */
  sync: boolean;
  partnerName: string;
  /** Every change, as it is made: the games rearrange behind the sheet. */
  onChange: (layout: ShelfLayout) => void;
  onSync: (on: boolean) => void;
  onClose: () => void;
}

/** A switch, as Home's arrange sheet has them. */
const Switch: React.FC<{ on: boolean; label: string; onToggle: () => void }> = ({ on, label, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onToggle}
    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-gradient-to-r from-aurora-violet to-aurora-pink' : 'bg-linen-secondary/30'}`}
  >
    <span className={`no-remap absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all ${on ? 'left-[19px]' : 'left-[3px]'}`} />
  </button>
);

/**
 * The games on Canvas of Us, to put in the order you like and switch off the
 * ones you do not play - on both phones while "same order on both phones" is
 * on. Each change shows straight away, behind the sheet.
 */
export const ArrangeGamesSheet: React.FC<ArrangeGamesSheetProps> = ({ layout, games, nameOf, iconOf, sync, partnerName, onChange, onSync, onClose }) => {
  const tr = useT();
  useBackLayer(true, onClose);
  const list = layout.order.filter(id => games.includes(id));
  const last = list.length - 1;
  // A game this phone does not have, between two that it does, stays where it is.
  const move = (id: string, by: -1 | 1) => {
    const target = list[list.indexOf(id) + by];
    if (!target) return;
    const order = layout.order.slice();
    const a = order.indexOf(id);
    const b = order.indexOf(target);
    [order[a], order[b]] = [order[b], order[a]];
    onChange({ ...layout, order, at: Date.now() });
  };

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
        aria-labelledby="arrange-games-title"
        className="flex max-h-[88vh] flex-col rounded-t-[28px] bg-linen-surface surface-solid px-[18px] pt-2.5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-linen-border" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="arrange-games-title" className="font-serif text-xl font-semibold text-linen-primary">
              {tr('Arrange the games')}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-linen-secondary">{tr("Put the ones you love first, and switch off the ones you don't play.")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl bg-linen-primary px-3.5 py-2 text-[13px] font-semibold text-linen-surface hover:opacity-90 transition-opacity"
          >
            {tr('Done')}
          </button>
        </div>

        {/* The same order on both phones, or each its own. */}
        <div className="mt-3 flex items-center gap-3 rounded-[18px] bg-linen-variant/70 px-3 py-2.5">
          <Smartphone className="h-4 w-4 shrink-0 text-linen-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-linen-primary">{tr('Same order on both phones')}</span>
            <span className="block text-[11px] leading-snug text-linen-secondary">
              {sync
                ? tr('What either of you changes here changes on both phones.')
                : tr("Just this phone. Switch on to give {name}'s phone this order too.", { name: partnerName })}
            </span>
          </span>
          <Switch on={sync} label={tr('Same order on both phones')} onToggle={() => onSync(!sync)} />
        </div>

        <div className="mt-3 min-h-0 overflow-y-auto rounded-[18px] border border-linen-border px-2.5">
          {list.map((id, i) => {
            const shown = !layout.hidden.includes(id);
            const name = nameOf(id);
            return (
              <div key={id} className={`flex items-center gap-2.5 py-2 ${i ? 'border-t border-linen-border' : ''}`}>
                <span className={`ag-icon shrink-0 ${shown ? '' : 'opacity-40 grayscale'}`} aria-hidden="true">
                  {iconOf(id)}
                </span>
                <span className={`min-w-0 flex-1 truncate text-sm font-medium ${shown ? 'text-linen-primary' : 'text-linen-secondary'}`}>{name}</span>
                <button
                  type="button"
                  onClick={() => move(id, -1)}
                  disabled={i === 0}
                  aria-label={tr('Move {card} up', { card: name })}
                  className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-linen-variant text-linen-secondary hover:text-linen-primary disabled:opacity-35 transition-colors"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(id, 1)}
                  disabled={i === last}
                  aria-label={tr('Move {card} down', { card: name })}
                  className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-linen-variant text-linen-secondary hover:text-linen-primary disabled:opacity-35 transition-colors"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <span className="ml-1">
                  <Switch on={shown} label={tr('Show {card}', { card: name })} onToggle={() => onChange(setGameShown(layout, id, !shown, Date.now()))} />
                </span>
              </div>
            );
          })}
        </div>

        {!isDefaultShelf(layout) && (
          <button
            type="button"
            onClick={() => onChange({ ...defaultShelf(), at: Date.now() })}
            className="mt-3 self-center rounded-lg px-3 py-1.5 text-xs font-semibold text-linen-accent hover:bg-linen-variant transition-colors"
          >
            {tr('Back to the usual order')}
          </button>
        )}
      </div>
    </div>
  );
};
