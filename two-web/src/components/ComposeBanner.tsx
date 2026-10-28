import React from 'react';
import { CornerUpLeft, Pencil, X } from 'lucide-react';

interface ComposeBannerProps {
  /** Answering a message, or changing one of yours. */
  mode: 'reply' | 'edit';
  /** "Replying to Asha", "Editing your message". */
  title: string;
  /** What is being answered, or the words before the change. */
  snippet: string;
  /** What the cross is called. */
  cancelLabel: string;
  onCancel: () => void;
  /** Pressing the cross keeps the keyboard up, as Send does. */
  keepFocus?: (e: React.SyntheticEvent) => void;
}

/**
 * Above the composer: what the next message answers, or which message is
 * being changed - with the way out of either. The same in the couple's chat
 * and in a group's.
 */
export const ComposeBanner: React.FC<ComposeBannerProps> = ({ mode, title, snippet, cancelLabel, onCancel, keepFocus }) => (
  <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-linen-border bg-linen-variant/50 py-1.5 pl-3 pr-1">
    <div className="w-[3px] self-stretch rounded-full bg-linen-accent" />
    {mode === 'edit' ? (
      <Pencil className="w-4 h-4 shrink-0 text-linen-accent" />
    ) : (
      <CornerUpLeft className="w-4 h-4 shrink-0 text-linen-accent" />
    )}
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-semibold text-linen-accent">{title}</p>
      <p className="truncate text-xs text-linen-secondary">{snippet}</p>
    </div>
    <button
      type="button"
      onPointerDown={keepFocus}
      onMouseDown={keepFocus}
      onClick={onCancel}
      aria-label={cancelLabel}
      className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-linen-secondary hover:bg-linen-variant hover:text-linen-primary transition-colors"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);
