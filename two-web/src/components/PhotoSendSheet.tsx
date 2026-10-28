import React, { useEffect, useMemo, useState } from 'react';
import { Send, X } from 'lucide-react';
import { useBackLayer } from '../core/backStack';
import { useT } from '../core/i18n';
import { ViewOnceIcon } from './ViewOnceIcon';

interface PhotoSendSheetProps {
  /** What was picked or taken, in order. */
  files: File[];
  partnerName: string;
  /** Send them; `viewOnce` only ever for a single photo. */
  onSend: (viewOnce: boolean) => void;
  onClose: () => void;
  /**
   * False where there is no view once: a group, where "one time, then gone
   * from both phones" has no one meaning. `partnerName` is then the group's.
   */
  allowViewOnce?: boolean;
}

/**
 * The photos you are about to send, before they go: a last look, and for a
 * single photo the choice of view once - your partner can open it one time,
 * and then it is gone from both phones.
 *
 * Back or the cross puts them down without sending anything.
 */
export const PhotoSendSheet: React.FC<PhotoSendSheetProps> = ({ files, partnerName, onSend, onClose, allowViewOnce = true }) => {
  const tr = useT();
  useBackLayer(true, onClose);
  const urls = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach(u => URL.revokeObjectURL(u)), [urls]);
  const [shown, setShown] = useState(0);
  const [viewOnce, setViewOnce] = useState(false);
  const single = files.length === 1;
  const canViewOnce = single && allowViewOnce;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        single ? tr('Photo for {name}', { name: partnerName }) : tr('{n} photos for {name}', { n: files.length, name: partnerName })
      }
      className="no-remap fixed inset-0 z-[86] flex flex-col bg-[#0b0816] text-white"
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)]">
        <button
          type="button"
          onClick={onClose}
          aria-label={tr("Don't send")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/12 hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="min-w-0 truncate text-[15px] font-semibold">
          {single ? tr('Photo for {name}', { name: partnerName }) : tr('{n} photos for {name}', { n: files.length, name: partnerName })}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 place-items-center px-4">
        <img
          src={urls[shown]}
          alt=""
          draggable={false}
          className="max-h-full max-w-full rounded-[18px] object-contain shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        />
      </div>

      {!single && (
        // Every photo going, each one tapped to see it larger.
        <div className="flex gap-2 overflow-x-auto px-4 pt-3">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setShown(i)}
              aria-label={tr('Photo {n}', { n: i + 1 })}
              aria-current={i === shown}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl ${i === shown ? 'ring-2 ring-white' : 'opacity-70'}`}
            >
              <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pt-3.5 pb-[max(env(safe-area-inset-bottom),22px)]">
        {canViewOnce && viewOnce && (
          <p className="mb-3 text-center text-xs leading-relaxed text-white/75" aria-live="polite">
            {tr("View once is on. {name} can open it one time, then it's gone from both phones.", { name: partnerName })}
          </p>
        )}
        <div className="flex items-center gap-3">
          {canViewOnce ? (
            <button
              type="button"
              role="switch"
              aria-checked={viewOnce}
              onClick={() => setViewOnce(v => !v)}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-white/10 px-3.5 py-2.5 text-left text-sm font-semibold"
            >
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-white text-[#1d1638]">
                <ViewOnceIcon className="h-5 w-5" />
              </span>
              {tr('View once')}
              <span
                aria-hidden="true"
                className={`relative ml-auto h-6 w-[42px] shrink-0 rounded-full transition-colors ${
                  viewOnce ? 'bg-gradient-to-r from-aurora-violet to-aurora-pink' : 'bg-white/25'
                }`}
              >
                <span
                  className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all ${
                    viewOnce ? 'left-[21px]' : 'left-[3px]'
                  }`}
                />
              </span>
            </button>
          ) : allowViewOnce ? (
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-white/70">{tr('View once is for one photo at a time.')}</p>
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            onClick={() => onSend(canViewOnce && viewOnce)}
            aria-label={single ? tr('Send photo') : tr('Send {n} photos', { n: files.length })}
            className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-aurora-violet via-aurora-pink to-[rgb(var(--c-button-end))] shadow-glow active:scale-95 transition-transform"
          >
            <Send className="h-[22px] w-[22px]" />
          </button>
        </div>
      </div>
    </div>
  );
};
