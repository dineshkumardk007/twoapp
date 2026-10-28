import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useT } from '../core/i18n';

interface JumpToNewestButtonProps {
  onClick: () => void;
  /** New messages below from others, shown on the button; none, no badge. */
  count?: number;
}

/**
 * The way back down to the newest message, while you read further up. Held
 * at the bottom of the conversation with no height of its own, so it never
 * moves what you are reading. Goes inside the scrolling log, last.
 */
export const JumpToNewestButton: React.FC<JumpToNewestButtonProps> = ({ onClick, count = 0 }) => {
  const tr = useT();
  return (
    <div className="pointer-events-none sticky bottom-1 flex h-0 justify-end">
      <button
        type="button"
        onClick={onClick}
        aria-label={tr('Go to the newest message')}
        className={`pointer-events-auto -translate-y-full grid h-10 w-10 place-items-center rounded-full border border-linen-border bg-linen-surface text-linen-primary shadow-lg transition-transform active:scale-90${
          count > 0 ? ' relative' : ''
        }`}
      >
        <ChevronDown className="h-5 w-5" />
        {count > 0 && (
          <span
            data-new-count
            className="absolute -top-1.5 -left-1.5 min-w-[20px] rounded-full bg-linen-accent px-1 text-center text-[11px] font-semibold leading-5 text-linen-surface"
          >
            <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
            <span className="sr-only">{count === 1 ? tr('1 new message') : tr('{n} new messages', { n: count })}</span>
          </span>
        )}
      </button>
    </div>
  );
};
