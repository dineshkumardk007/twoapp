import React, { useMemo, useState } from 'react';
import { CalendarClock, ChevronRight, Clock } from 'lucide-react';
import { useBackLayer } from '../core/backStack';
import { useT } from '../core/i18n';
import { MAX_AHEAD_MS, fromLocalInput, laterChoices, pickedTimeProblem, toLocalInput } from '../core/sendLater';
import { aheadLabel } from '../core/when';

interface SendLaterSheetProps {
  /** The words about to go, for a last look. */
  text: string;
  partnerName: string;
  /** Send it, to show at this moment. */
  onPick: (showAt: number) => void;
  onClose: () => void;
}

/**
 * When a message is to show in your partner's chat (core/sendLater): a few
 * times a tap away, or a day and time of your own. Back, Cancel or a tap
 * above the sheet puts it down and leaves the words in the box.
 */
export const SendLaterSheet: React.FC<SendLaterSheetProps> = ({ text, partnerName, onPick, onClose }) => {
  const tr = useT();
  useBackLayer(true, onClose);
  // Taken as the sheet opens: the times on offer do not shift under a finger.
  const [opened, setOpened] = useState(() => Date.now());
  const choices = useMemo(() => laterChoices(new Date(opened)), [opened]);
  const [picking, setPicking] = useState(false);
  const [value, setValue] = useState(() => toLocalInput(choices[choices.length - 1].at));
  const [problem, setProblem] = useState<string | null>(null);
  const [movedOn, setMovedOn] = useState(false);

  // Left open a while - Two in the background, say - and a time on offer
  // has gone by: not sent for a time already past, but offered afresh.
  const pickChoice = (at: number) => {
    if (pickedTimeProblem(at)) {
      setOpened(Date.now());
      setMovedOn(true);
      return;
    }
    onPick(at);
  };

  const pickOwn = () => {
    const at = fromLocalInput(value);
    const wrong = pickedTimeProblem(at);
    if (wrong) return setProblem(wrong);
    onPick(at);
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
        aria-labelledby="send-later-title"
        className="flex max-h-[88vh] flex-col rounded-t-[28px] bg-linen-surface surface-solid px-[18px] pt-2.5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-linen-border" />
        <h3 id="send-later-title" className="font-serif text-xl font-semibold text-linen-primary">
          {tr('Send later')}
        </h3>
        <p className="mt-0.5 text-xs leading-relaxed text-linen-secondary">
          {tr("It shows in {name}'s chat at the time you pick, the next time Two is open then. It won't wake their phone.", {
            name: partnerName
          })}
        </p>

        <p className="mt-3 line-clamp-3 rounded-2xl bg-linen-variant/60 px-3.5 py-2.5 text-sm leading-relaxed text-linen-primary whitespace-pre-wrap break-words">
          {text}
        </p>

        {movedOn && (
          <p role="status" className="mt-3 text-xs font-medium text-linen-primary">
            {tr('That time has gone by. Here are the times from now.')}
          </p>
        )}

        <div className="mt-3 min-h-0 overflow-y-auto rounded-[18px] border border-linen-border">
          {choices.map((c, i) => (
            <button
              key={c.key}
              type="button"
              onClick={() => pickChoice(c.at)}
              className={`flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-linen-variant/60 transition-colors ${
                i ? 'border-t border-linen-border' : ''
              }`}
            >
              <Clock className="h-4 w-4 shrink-0 text-linen-accent" />
              <span className="min-w-0 flex-1 text-sm font-medium text-linen-primary">{c.label}</span>
              {c.key === 'hour' && <span className="shrink-0 text-xs text-linen-secondary">{aheadLabel(c.at, opened)}</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPicking(p => !p)}
            aria-expanded={picking}
            className="flex w-full items-center gap-3 border-t border-linen-border px-3.5 py-3 text-left hover:bg-linen-variant/60 transition-colors"
          >
            <CalendarClock className="h-4 w-4 shrink-0 text-linen-accent" />
            <span className="min-w-0 flex-1 text-sm font-medium text-linen-primary">{tr('Pick a day and time')}</span>
            <ChevronRight className={`h-4 w-4 shrink-0 text-linen-secondary transition-transform ${picking ? 'rotate-90' : ''}`} />
          </button>
          {picking && (
            <div className="border-t border-linen-border px-3.5 py-3">
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={value}
                  min={toLocalInput(opened + 60_000)}
                  max={toLocalInput(opened + MAX_AHEAD_MS)}
                  onChange={e => {
                    setValue(e.target.value);
                    setProblem(null);
                  }}
                  aria-label={tr('Day and time to show it')}
                  className="min-w-0 flex-1 rounded-xl border border-linen-border bg-linen-variant/30 px-3 py-2 text-sm text-linen-primary focus:outline-hidden focus:ring-2 focus:ring-linen-primary"
                />
                <button
                  type="button"
                  onClick={pickOwn}
                  className="shrink-0 rounded-xl bg-linen-primary px-3.5 py-2 text-[13px] font-semibold text-linen-surface hover:opacity-90 transition-opacity"
                >
                  {tr('Set')}
                </button>
              </div>
              {problem && (
                <p role="alert" className="mt-1.5 text-xs text-rose-700">
                  {problem}
                </p>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 self-center rounded-lg px-4 py-2 text-sm font-semibold text-linen-secondary hover:bg-linen-variant transition-colors"
        >
          {tr('Cancel')}
        </button>
      </div>
    </div>
  );
};
