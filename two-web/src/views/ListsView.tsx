import React, { useState } from 'react';
import { ListItem } from '../types';
import { Check, Plus, Trash2, EyeOff, Gift } from 'lucide-react';

interface ListsViewProps {
  lists: ListItem[];
  activeUser: 'user' | 'partner';
  onToggleItem: (id: string) => void;
  onAddItem: (title: string, isSecret: boolean) => void;
  onDeleteItem: (id: string) => void;
  /** The other person's name, as this phone knows it. */
  partnerName?: string;
}

export const ListsView: React.FC<ListsViewProps> = ({
  lists,
  activeUser,
  onToggleItem,
  onAddItem,
  onDeleteItem,
  partnerName: knownPartnerName
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [isSecret, setIsSecret] = useState(false);

  // Who a hidden item is hidden from. This used to be worked out from the
  // seat - "Partner" on one phone and "You" on the other - so the joiner's
  // phone offered to hide a gift from themselves.
  const partnerName = knownPartnerName?.trim() || 'your partner';

  // Omit secret items added by the OTHER person!
  // If activeUser is 'user', hide secret items added by 'partner'.
  // If activeUser is 'partner', hide secret items added by 'user'.
  const visibleItems = lists.filter(item => {
    if (!item.isHiddenFromPartner) return true;
    return item.addedBy === activeUser; // Only show secret item to the author!
  });

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAddItem(newTitle.trim(), isSecret);
    setNewTitle('');
    setIsSecret(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-linen-primary">Shared Lists</h2>
        <p className="text-sm text-linen-secondary">Plan together, and keep a gift idea hidden until it's given.</p>
      </div>

      {/* Add Item Card */}
      <div className="p-4 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add date idea, watchlist item, or surprise gift..."
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-hidden focus:ring-2 focus:ring-linen-primary"
          />
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            className="px-4 py-2.5 bg-linen-primary text-linen-surface rounded-xl text-sm font-medium hover:opacity-95 disabled:opacity-40 transition-all"
          >
            Add
          </button>
        </div>

        <label className="flex items-center space-x-2 text-xs text-linen-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isSecret}
            onChange={(e) => setIsSecret(e.target.checked)}
            className="rounded accent-linen-accent"
          />
          <span className="flex items-center">
            <Gift className="w-3.5 h-3.5 mr-1 text-linen-accent" />
            Hide from {partnerName} (Surprise / Gift item)
          </span>
        </label>
      </div>

      {visibleItems.length === 0 && (
        <div className="p-10 text-center border-2 border-dashed border-linen-border rounded-3xl bg-linen-surface/40 space-y-3">
          <Gift className="w-8 h-8 text-linen-accent/60 mx-auto" />
          <p className="font-serif text-base text-linen-primary">Your lists are empty</p>
          <p className="text-xs text-linen-secondary max-w-xs mx-auto leading-relaxed text-balance">
            Date ideas, films to watch, things to buy. Tick the box above to keep a gift hidden from{' '}
            {partnerName} until it is given.
          </p>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2.5">
        {visibleItems.map(item => (
          <div
            key={item.id}
            className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
              item.isCompleted
                ? 'bg-linen-variant/30 border-linen-border/60 text-linen-secondary line-through'
                : 'bg-linen-surface border-linen-border shadow-xs text-linen-primary'
            }`}
          >
            <div className="flex items-center space-x-3">
              <button
                onClick={() => onToggleItem(item.id)}
                aria-label={item.isCompleted ? 'Mark not done' : 'Mark done'}
                className={`tap-target-icon w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
                  item.isCompleted
                    ? 'bg-linen-primary border-transparent text-linen-surface'
                    : 'border-linen-secondary/40 hover:border-linen-primary'
                }`}
              >
                {item.isCompleted && <Check className="w-3.5 h-3.5" />}
              </button>
              <div>
                <span className="text-sm font-medium">{item.title}</span>
                {item.isHiddenFromPartner && (
                  <span className="inline-flex items-center ml-2 text-[10px] font-semibold text-linen-accent bg-linen-variant px-2 py-0.5 rounded-full">
                    <EyeOff className="w-3 h-3 mr-1" />
                    Hidden from {partnerName}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => onDeleteItem(item.id)}
              aria-label="Delete"
              className="tap-target-icon shrink-0 p-1 text-linen-secondary hover:text-red-600 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
