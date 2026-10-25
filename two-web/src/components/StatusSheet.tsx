import React, { useState } from 'react';
import { useBackLayer } from '../core/backStack';
import {
  MAX_STATUS_CHARS,
  STATUS_LASTS,
  STATUS_PRESETS,
  clearsAtFor,
  statusText,
  statusWords,
  type StatusLasts,
  type StatusNote
} from '../core/status';
import { clockTime } from '../core/when';
import { trMeaning, useT } from '../core/i18n';

interface StatusSheetProps {
  partnerName: string;
  /** Your status now, if one is showing. */
  current: StatusNote | null;
  onSet: (status: { text: string; emoji?: string; clearsAt: number }) => void;
  onClear: () => void;
  onClose: () => void;
}

/**
 * Your status, in one tap (core/status): one of the usual ones, or a few
 * words of your own, for an hour, three, or the rest of today. Back, Done or
 * a tap above the sheet closes it.
 */
export const StatusSheet: React.FC<StatusSheetProps> = ({ partnerName, current, onSet, onClear, onClose }) => {
  const tr = useT();
  useBackLayer(true, onClose);
  const [lasts, setLasts] = useState<StatusLasts>('three');
  const [own, setOwn] = useState('');
  const set = (text: string, emoji?: string) => {
    onSet({ text, ...(emoji ? { emoji } : {}), clearsAt: clearsAtFor(lasts) });
    onClose();
  };
  const ownText = statusText(own);

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
        aria-labelledby="status-sheet-title"
        className="flex max-h-[88vh] flex-col overflow-y-auto rounded-t-[28px] bg-linen-surface surface-solid px-[18px] pt-2.5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-linen-border" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="status-sheet-title" className="font-serif text-xl font-semibold text-linen-primary">
              {tr('Your status')}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-linen-secondary">
              {tr('{name} sees it under your name in the chat and on Home. It goes by itself.', { name: partnerName })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl bg-linen-primary px-3.5 py-2 text-[13px] font-semibold text-linen-surface hover:opacity-90 transition-opacity"
          >
            {tr('Done')}
          </button>
        </div>

        {current && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-linen-variant/60 px-3.5 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-linen-primary">{statusWords(current)}</span>
              <span className="block text-[11px] text-linen-secondary">{tr('Until {time}', { time: clockTime(current.clearsAt) })}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="shrink-0 rounded-lg border border-linen-border bg-linen-surface px-3 py-1.5 text-xs font-semibold text-linen-primary hover:bg-linen-variant transition-colors"
            >
              {trMeaning('Clear', 'status')}
            </button>
          </div>
        )}

        <div role="radiogroup" aria-label={tr('How long it lasts')} className="mt-3.5 flex gap-1 rounded-xl bg-linen-variant p-1">
          {STATUS_LASTS.map(l => (
            <button
              key={l.key}
              type="button"
              role="radio"
              aria-checked={lasts === l.key}
              onClick={() => setLasts(l.key)}
              className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                lasts === l.key ? 'bg-linen-surface text-linen-primary shadow-xs' : 'text-linen-secondary hover:text-linen-primary'
              }`}
            >
              {tr(l.label)}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {STATUS_PRESETS.map(p => (
            <button
              key={p.text}
              type="button"
              onClick={() => set(p.text, p.emoji)}
              className="flex min-w-0 items-center gap-2 rounded-2xl border border-linen-border bg-linen-surface px-3 py-2.5 text-left text-sm font-medium text-linen-primary hover:bg-linen-variant transition-colors"
            >
              <span aria-hidden="true" className="text-base leading-none">
                {p.emoji}
              </span>
              <span className="min-w-0 truncate">{tr(p.text)}</span>
            </button>
          ))}
        </div>

        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={e => {
            e.preventDefault();
            if (ownText) set(ownText);
          }}
        >
          <input
            value={own}
            onChange={e => setOwn(e.target.value)}
            maxLength={MAX_STATUS_CHARS}
            placeholder={tr('Or a few words of your own')}
            aria-label={tr('Your own status')}
            enterKeyHint="done"
            className="min-w-0 flex-1 rounded-xl border border-linen-border bg-linen-variant/30 px-3.5 py-2.5 text-sm text-linen-primary placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary"
          />
          <button
            type="submit"
            disabled={!ownText}
            className="shrink-0 rounded-xl bg-linen-primary px-3.5 py-2.5 text-[13px] font-semibold text-linen-surface hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {tr('Set')}
          </button>
        </form>
      </div>
    </div>
  );
};
