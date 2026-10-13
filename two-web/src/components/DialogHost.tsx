import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { answerDialog, currentDialog, subscribeDialogs } from '../core/dialog';
import { pushBackLayer } from '../core/backStack';
import { haptic } from '../core/haptics';

/**
 * Draws the app's confirm and notice pop-ups (core/dialog.ts).
 *
 * Mounted next to the app rather than inside it, so a question asked from the
 * lock screen or the welcome screens - which the app renders instead of its
 * usual tree - still has somewhere to appear.
 */
export const DialogHost: React.FC = () => {
  const dialog = useSyncExternalStore(subscribeDialogs, currentDialog, currentDialog);
  const goRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!dialog) return;
    // Back answers "no", one dialog at a time - registered per dialog, so the
    // next one in line is covered too after Back has closed this one.
    const unregister = pushBackLayer(() => answerDialog(false));
    // A question that loses something starts on the safe answer.
    (dialog.danger ? cancelRef.current : goRef.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        answerDialog(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unregister();
      window.removeEventListener('keydown', onKey);
    };
  }, [dialog]);

  if (!dialog) return null;

  const isConfirm = dialog.kind === 'confirm';
  const answer = (yes: boolean) => {
    haptic('tick');
    answerDialog(yes);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
      onClick={() => answer(false)}
    >
      <div
        role={isConfirm ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby={dialog.body ? 'app-dialog-body' : undefined}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-linen-border bg-linen-surface p-6 shadow-2xl animate-scale-up"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <h2 id="app-dialog-title" className="font-serif text-lg font-semibold leading-snug text-linen-primary text-balance">
          {dialog.title}
        </h2>
        {dialog.body && (
          <p id="app-dialog-body" className="mt-2 text-sm leading-relaxed text-linen-secondary">
            {dialog.body}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          {isConfirm && (
            <button
              ref={cancelRef}
              type="button"
              onClick={() => answer(false)}
              className="flex-1 rounded-xl border border-linen-border bg-linen-surface px-4 py-3 text-sm font-medium text-linen-secondary hover:bg-linen-variant active:scale-[0.98] transition-all cursor-pointer"
            >
              {dialog.cancelLabel}
            </button>
          )}
          <button
            ref={goRef}
            type="button"
            onClick={() => answer(true)}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold active:scale-[0.98] transition-all cursor-pointer ${
              dialog.danger
                ? 'no-remap bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-linen-primary text-linen-surface shadow-glow hover:opacity-90'
            }`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
