import React from 'react';
import { CloudOff, X } from 'lucide-react';

interface RelayStorageWarningProps {
  /** Null while nothing is known - not connected, so nothing to claim. */
  durable: boolean | null;
  onDismiss: () => void;
}

/**
 * Says when the relay has stopped keeping what it is sent.
 *
 * This is the one failure that looks exactly like everything working. Messages
 * still reach a partner who is online, so both screens behave normally, while
 * nothing is being stored for a phone that is not - and a free database that
 * pauses itself after a quiet week does precisely this. It happened, and the
 * only reason anyone noticed was somebody checking the server by hand.
 *
 * Deliberately not a toast: a warning that disappears on its own is no use for
 * a condition that lasts until somebody acts on it.
 */
export const RelayStorageWarning: React.FC<RelayStorageWarningProps> = ({ durable, onDismiss }) => {
  if (durable !== false) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-start gap-2.5 border-b border-amber-300/60 bg-amber-50 px-4 py-2.5 text-amber-900 shadow-xs"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.625rem)' }}
    >
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">Your history is not being saved</p>
        <p className="mt-0.5 text-[11px] leading-relaxed">
          Anything you send still reaches each other while you are both online, but the server is not
          keeping it - so a phone that is off right now may never get it. Check that the relay's
          database is awake.
        </p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="mt-0.5 shrink-0 rounded-lg p-1 transition-colors hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
