import React from 'react';

interface ReactionPillProps {
  /** Each emoji once, in the order to show them. */
  emojis: string[];
  /** A number beside them, when there is one to say. */
  count?: number;
  /** What a screen reader says for it. */
  label: string;
  /** Under your own message: in from the right edge rather than the left. */
  mine: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * The reactions on a message, on its bubble's lower edge - in the couple's
 * chat and in a group's. Tapped, they come up to be seen or changed.
 */
export const ReactionPill: React.FC<ReactionPillProps> = ({ emojis, count, label, mine, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={`relative z-[1] -mt-2 inline-flex items-center gap-0.5 rounded-full border border-linen-border bg-linen-surface px-1.5 py-0.5 text-[13px] leading-none shadow-sm ${
      mine ? 'mr-3' : 'ml-3'
    }`}
  >
    {emojis.map(r => (
      <span key={r}>{r}</span>
    ))}
    {count !== undefined && <span className="ml-0.5 text-[10px] font-semibold text-linen-secondary">{count}</span>}
  </button>
);
