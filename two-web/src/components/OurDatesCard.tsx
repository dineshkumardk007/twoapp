import React, { useEffect, useState } from 'react';
import { CalendarHeart, ChevronRight, Pencil, X } from 'lucide-react';
import { OurDates } from '../types';
import {
  daysTogether,
  formatDay,
  hasOurDates,
  isCalendarDate,
  localDateKey,
  nextAnniversary,
  ordinal
} from '../core/ourDates';
import { useBackLayer } from '../core/backStack';
import { haptic } from '../core/haptics';

interface OurDatesCardProps {
  dates?: OurDates;
  /** Both dates as the editor left them; empty means not set. */
  onSave: (dates: { togetherSince?: string; anniversary?: string }) => void;
}

/**
 * Today's date on this phone, kept current.
 *
 * Checked once a minute and whenever the app comes back into view, so a
 * screen left open overnight - or a phone woken the next morning - counts
 * the new day without needing to be touched.
 */
function useToday(): string {
  const [today, setToday] = useState(localDateKey);
  useEffect(() => {
    const check = () => setToday(localDateKey());
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}

/**
 * The top of Home: how long you have been together, and the next day you
 * celebrate.
 *
 * Both are worked out from the dates the two of you entered and nothing
 * else. Until one of you has, the card asks for them instead - it does not
 * count from the day the app was installed, and it never shows a number it
 * made up. Tapping it opens the same small editor either way.
 */
export const OurDatesCard: React.FC<OurDatesCardProps> = ({ dates, onSave }) => {
  const today = useToday();
  const [editing, setEditing] = useState(false);
  useBackLayer(editing, () => setEditing(false));

  const open = () => setEditing(true);

  const editor = editing && (
    <OurDatesEditor
      dates={dates}
      today={today}
      onClose={() => setEditing(false)}
      onSave={next => {
        onSave(next);
        haptic('confirm');
        setEditing(false);
      }}
    />
  );

  if (!dates || !hasOurDates(dates)) {
    return (
      <>
        <button
          type="button"
          onClick={open}
          className="block w-full rounded-3xl border border-dashed border-linen-border bg-linen-surface p-5 text-left transition-colors hover:border-linen-accent/50 cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linen-variant text-linen-accent">
              <CalendarHeart className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-lg font-medium text-linen-primary">When did your story begin?</h3>
              <p className="mt-0.5 text-xs text-linen-secondary">
                Add your dates, and both your phones will keep count with you.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-linen-secondary" />
          </div>
        </button>
        {editor}
      </>
    );
  }

  const since = isCalendarDate(dates.togetherSince) ? dates.togetherSince : undefined;
  const count = since ? daysTogether(since, today) : null;
  const next = nextAnniversary(dates, today);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="block w-full rounded-3xl border border-linen-border bg-gradient-to-br from-linen-surface via-linen-surface to-linen-variant/50 p-5 text-left shadow-xs transition-colors hover:border-linen-accent/40 cursor-pointer"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent">Our days</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-linen-secondary">
            <Pencil className="h-3 w-3" />
            Change
          </span>
        </div>

        {since && count !== null && (
          <div className="mt-2">
            {count === 0 ? (
              <p className="font-serif text-4xl leading-tight text-linen-primary">Day one</p>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-serif text-5xl leading-none text-linen-primary tabular-nums">
                  {Math.abs(count).toLocaleString()}
                </span>
                <span className="text-sm text-linen-secondary">
                  {count < 0
                    ? `${Math.abs(count) === 1 ? 'day' : 'days'} to go`
                    : `${count === 1 ? 'day' : 'days'} together`}
                </span>
              </div>
            )}
            <p className="mt-1.5 text-xs text-linen-secondary">
              {count < 0 ? 'Begins' : 'Since'} {formatDay(since)}
            </p>
          </div>
        )}

        {next && (
          <div
            className={`flex items-center gap-3 ${
              since ? 'mt-4 border-t border-linen-border/60 pt-4' : 'mt-3'
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linen-variant text-linen-accent">
              <CalendarHeart className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              {next.daysUntil === 0 ? (
                <>
                  <p className="font-serif text-base font-medium text-linen-primary">Happy anniversary</p>
                  <p className="text-xs text-linen-secondary">
                    {next.years ? `${next.years} ${next.years === 1 ? 'year' : 'years'} today` : 'Today is the day'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-linen-primary">
                    {next.years ? `Your ${ordinal(next.years)} anniversary` : 'Your anniversary'}{' '}
                    {next.daysUntil === 1 ? 'is tomorrow' : `is in ${next.daysUntil} days`}
                  </p>
                  <p className="text-xs text-linen-secondary">{formatDay(next.date, false)}</p>
                </>
              )}
            </div>
          </div>
        )}
      </button>
      {editor}
    </>
  );
};

interface OurDatesEditorProps {
  dates?: OurDates;
  today: string;
  onClose: () => void;
  onSave: (dates: { togetherSince?: string; anniversary?: string }) => void;
}

/**
 * Two native date fields, so the phone's own calendar picker does the work.
 *
 * Both start as whatever is set now. Emptying both and saving takes the
 * dates away again, and the card goes back to asking.
 */
const OurDatesEditor: React.FC<OurDatesEditorProps> = ({ dates, today, onClose, onSave }) => {
  const storedSince = isCalendarDate(dates?.togetherSince) ? dates!.togetherSince! : '';
  // An anniversary kept without its year cannot sit in a date field. It
  // stays as it is unless this field is actually changed.
  const storedAnniversary = isCalendarDate(dates?.anniversary) ? dates!.anniversary! : '';
  const [since, setSince] = useState(storedSince);
  const [anniversary, setAnniversary] = useState(storedAnniversary);
  const [anniversaryTouched, setAnniversaryTouched] = useState(false);
  const [error, setError] = useState('');

  // What saving would send, compared with what is set now.
  const toSendSince = since || undefined;
  const toSendAnniversary = anniversaryTouched ? anniversary || undefined : dates?.anniversary;
  const changed = toSendSince !== (storedSince || undefined) || toSendAnniversary !== dates?.anniversary;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (since && !isCalendarDate(since)) {
      setError('That does not look like a date.');
      return;
    }
    if (anniversary && !isCalendarDate(anniversary)) {
      setError('That does not look like a date.');
      return;
    }
    if ((since && since > today) || (anniversary && anniversary > today)) {
      setError('Pick a day that has already happened.');
      return;
    }
    onSave({ togetherSince: toSendSince, anniversary: toSendAnniversary });
  };

  const fieldClass =
    'block w-full min-w-0 max-w-full rounded-xl border border-linen-border bg-linen-variant/40 p-2.5 text-sm text-linen-primary focus:outline-none focus:ring-1 focus:ring-linen-primary';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-3xl border border-linen-border bg-linen-surface p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-serif text-lg font-medium text-linen-primary">Your dates</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-linen-secondary hover:text-linen-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-linen-secondary">
          Both your phones show the same dates, and either of you can change them later.
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-linen-primary">The day your story began</span>
          <input
            type="date"
            value={since}
            max={today}
            onChange={e => {
              setSince(e.target.value);
              setError('');
            }}
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-linen-primary">Your anniversary</span>
          <span className="mb-1.5 block text-[11px] leading-relaxed text-linen-secondary">
            A wedding day, or any day you celebrate. Leave it empty to celebrate the day your story began.
          </span>
          <input
            type="date"
            value={anniversary}
            max={today}
            onChange={e => {
              setAnniversary(e.target.value);
              setAnniversaryTouched(true);
              setError('');
            }}
            className={fieldClass}
          />
        </label>

        {error && <p className="text-xs text-linen-accent">{error}</p>}

        <div className="flex items-center justify-between gap-2 border-t border-linen-border/40 pt-3">
          {toSendSince || toSendAnniversary ? (
            <button
              type="button"
              onClick={() => {
                setSince('');
                setAnniversary('');
                setAnniversaryTouched(true);
                setError('');
              }}
              className="px-1 py-1.5 text-xs text-linen-secondary hover:text-linen-primary"
            >
              Clear both
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-linen-secondary hover:text-linen-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!changed}
              className="rounded-xl bg-linen-primary px-4 py-1.5 text-xs font-medium text-linen-surface hover:opacity-90 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
