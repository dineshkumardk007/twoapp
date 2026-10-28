import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { useBackLayer } from '../core/backStack';
import { useT } from '../core/i18n';
import { NO_TIME, type MessageInfo } from '../core/messageInfo';

interface MessageInfoSheetProps extends MessageInfo {
  /** A few of its words, or what it is ("Photo"), for a last look at which message this is. */
  preview: string;
  onClose: () => void;
}

/**
 * A message's Info (core/messageInfo): when it went, when it reached her
 * phone and when she read it - or, in a group, who has read it. Drawn from the
 * message as it is now, so a receipt that comes in while it is open shows at
 * once. Back, Close or a tap above the sheet puts it down.
 */
export const MessageInfoSheet: React.FC<MessageInfoSheetProps> = ({ preview, rows, readers, notes, onClose }) => {
  const tr = useT();
  useBackLayer(true, onClose);
  // A dash is read out as what it means.
  const said = (value: string) => (value === NO_TIME ? tr('Time not kept') : undefined);

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
        aria-labelledby="message-info-title"
        data-message-info
        className="flex max-h-[88vh] flex-col rounded-t-[28px] bg-linen-surface surface-solid px-[18px] pt-2.5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-linen-border" />
        <h3 id="message-info-title" className="font-serif text-xl font-semibold text-linen-primary">
          {tr('Message info')}
        </h3>

        <p className="mt-3 line-clamp-3 rounded-2xl bg-linen-variant/60 px-3.5 py-2.5 text-sm leading-relaxed text-linen-primary whitespace-pre-wrap break-words">
          {preview}
        </p>

        <div className="mt-3 min-h-0 overflow-y-auto scroll-contain">
          <dl className="rounded-[18px] border border-linen-border">
            {rows.map((row, i) => (
              <div
                key={row.key}
                data-info-row={row.key}
                className={`flex items-baseline justify-between gap-3 px-3.5 py-2.5 text-sm ${i ? 'border-t border-linen-border' : ''}`}
              >
                <dt className="min-w-0 text-linen-secondary">{row.label}</dt>
                <dd
                  aria-label={said(row.value)}
                  className={`shrink-0 text-right tabular-nums ${
                    row.tone === 'read'
                      ? 'font-medium text-sky-600'
                      : row.tone === 'muted'
                      ? 'text-linen-secondary'
                      : 'font-medium text-linen-primary'
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          {readers && (
            <>
              <h4 className="mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-linen-accent">{tr('Read by')}</h4>
              {readers.read.length ? (
                <ul className="space-y-1.5 text-sm">
                  {readers.read.map(r => (
                    <li key={r.id} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-1.5 text-linen-primary">
                        <CheckCheck className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                        <span className="truncate">{r.name}</span>
                      </span>
                      <span aria-label={said(r.value)} className="shrink-0 tabular-nums text-linen-secondary">
                        {r.value}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-linen-secondary">{tr('Not yet')}</p>
              )}
              {readers.unread.length > 0 && (
                <>
                  <h4 className="mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
                    {tr('Not read yet')}
                  </h4>
                  <ul className="space-y-1.5 text-sm">
                    {readers.unread.map(r => (
                      <li key={r.id} className="flex min-w-0 items-center gap-1.5 text-linen-secondary">
                        <Check className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        <span className="truncate">{r.name}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {notes.map(note => (
            <p key={note} className="mt-3 text-[11px] leading-relaxed text-linen-secondary">
              {note}
            </p>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 self-center rounded-lg px-4 py-2 text-sm font-semibold text-linen-secondary hover:bg-linen-variant transition-colors"
        >
          {tr('Close')}
        </button>
      </div>
    </div>
  );
};
