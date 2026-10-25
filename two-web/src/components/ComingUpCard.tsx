import React, { useMemo, useState } from 'react';
import { CalendarClock, Check, Plus, Send, Trash2, X } from 'lucide-react';
import {
  type ComingUpDay,
  liveDays,
  readHiddenFestivals,
  upcoming,
  whenWords,
  writeHiddenFestivals
} from '../core/comingUp';
import { FESTIVALS } from '../data/festivals';
import { formatDay } from '../core/ourDates';
import { useBackLayer } from '../core/backStack';
import { haptic } from '../core/haptics';
import { useToday } from '../core/useToday';
import { newId } from '../core/ids';
import { activeLocale, dateLocale, useT } from '../core/i18n';

type Seat = 'user' | 'partner';

interface ComingUpCardProps {
  days?: ComingUpDay[];
  me: Seat;
  partnerName: string;
  /** Saves these days (each stamped now) on both phones. */
  onSave: (changes: ComingUpDay[]) => void;
  /** Puts a wish in the chat. */
  onSendWish: (text: string) => void;
}

// One for each language: Tamil day and month names in Tamil.
const WEEKDAY = new Map<string, Intl.DateTimeFormat>();
const weekday = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  const locale = dateLocale() || 'en-IN';
  let format = WEEKDAY.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    WEEKDAY.set(locale, format);
  }
  return format.format(new Date(y, m - 1, d));
};

/**
 * What is coming: each other's birthdays, the next time you meet, days of
 * your own and Tamil festivals - the next sixty days, soonest first. On the
 * day, a birthday of your partner's or a festival has a wish to send.
 */
export const ComingUpCard: React.FC<ComingUpCardProps> = ({ days, me, partnerName, onSave, onSendWish }) => {
  const tr = useT();
  const today = useToday();
  const [editing, setEditing] = useState(false);
  const [hidden, setHidden] = useState(readHiddenFestivals);
  const [sent, setSent] = useState<string[]>([]);
  useBackLayer(editing, () => setEditing(false));
  const partner = partnerName.trim() || tr('Partner');
  // upcoming() words its titles in the language it is called in, so a new
  // language is a new list.
  const locale = activeLocale();

  const list = useMemo(
    () => upcoming(days, { me, partnerName: partner, hiddenFestivals: hidden, today }).slice(0, 5),
    [days, me, partner, hidden, today, locale]
  );

  return (
    <>
      <div className="rounded-3xl border border-linen-border bg-linen-surface p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linen-variant text-linen-accent">
            <CalendarClock className="h-5 w-5" />
          </div>
          <h3 className="min-w-0 flex-1 font-serif text-lg font-medium text-linen-primary">{tr('Coming up')}</h3>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-xl px-3 py-1.5 text-xs font-medium text-linen-accent hover:bg-linen-variant"
          >
            {liveDays(days).length ? tr('Change') : tr('Add days')}
          </button>
        </div>

        {list.length === 0 ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 block w-full rounded-2xl border border-dashed border-linen-border p-3 text-left text-xs leading-relaxed text-linen-secondary hover:border-linen-accent/50"
          >
            {tr('Add your birthdays and the next time you meet. Both your phones will show what is coming.')}
          </button>
        ) : (
          <ul className="mt-3 space-y-2">
            {list.map(item => {
              const isToday = item.daysUntil === 0;
              const done = sent.includes(item.key);
              return (
                <li
                  key={item.key}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                    isToday ? 'border border-linen-accent/40 bg-linen-variant/60' : 'bg-linen-variant/30'
                  }`}
                >
                  <span aria-hidden="true" className="text-xl leading-none">{item.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-linen-primary">
                      {item.title}
                      {item.sub && <span className="ml-1.5 text-xs font-normal text-linen-secondary">{item.sub}</span>}
                    </p>
                    <p className="text-xs text-linen-secondary">
                      <span className={isToday ? 'font-semibold text-linen-accent' : ''}>{whenWords(item.daysUntil)}</span>
                      {!isToday && <span> · {weekday(item.date)}</span>}
                    </p>
                  </div>
                  {isToday && item.wish && (
                    <button
                      type="button"
                      disabled={done}
                      onClick={() => {
                        onSendWish(item.wish!);
                        haptic('confirm');
                        setSent(s => [...s, item.key]);
                      }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-linen-primary px-3 py-1.5 text-xs font-medium text-linen-surface hover:opacity-90 disabled:opacity-60"
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                      {done ? tr('Sent') : tr('Send a wish')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && (
        <ComingUpEditor
          days={days}
          me={me}
          partner={partner}
          today={today}
          hidden={hidden}
          onClose={() => setEditing(false)}
          onSave={(changes, nextHidden) => {
            if (changes.length) onSave(changes);
            writeHiddenFestivals(nextHidden);
            setHidden(nextHidden);
            haptic('confirm');
            setEditing(false);
          }}
        />
      )}
    </>
  );
};

interface EditorProps {
  days?: ComingUpDay[];
  me: Seat;
  partner: string;
  today: string;
  hidden: string[];
  onClose: () => void;
  onSave: (changes: ComingUpDay[], hidden: string[]) => void;
}

/**
 * Birthdays, the next meet-up, days of your own, and which festivals show.
 * The days are shared by both phones; which festivals show is this phone's.
 */
const ComingUpEditor: React.FC<EditorProps> = ({ days, me, partner, today, hidden, onClose, onSave }) => {
  const tr = useT();
  const them: Seat = me === 'user' ? 'partner' : 'user';
  // The days as they were when this opened. Saving sends only what was
  // changed here, judged against these - not against the days as they are
  // now, or a change the other phone made meanwhile would be put back to
  // what this screen showed.
  const [live] = useState(() => liveDays(days));
  const find = (id: string) => live.find(d => d.id === id);
  const myId = `bday-${me}`;
  const theirId = `bday-${them}`;

  const [myBirthday, setMyBirthday] = useState(find(myId)?.date || '');
  const [theirBirthday, setTheirBirthday] = useState(find(theirId)?.date || '');
  const [meet, setMeet] = useState(find('meet')?.date || '');
  const [own, setOwn] = useState(live.filter(d => d.kind === 'day'));
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [yearly, setYearly] = useState(true);
  const [shown, setShown] = useState(() => new Set(FESTIVALS.map(f => f.id).filter(id => !hidden.includes(id))));
  const [error, setError] = useState('');

  const addOwn = () => {
    if (!label.trim() || !date) {
      setError(tr('Give the day a name and a date.'));
      return;
    }
    setOwn(list => [...list, { id: newId('day'), kind: 'day', label: label.trim().slice(0, 60), date, yearly, at: 0 }]);
    setLabel('');
    setDate('');
    setYearly(true);
    setError('');
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if ((myBirthday && myBirthday > today) || (theirBirthday && theirBirthday > today)) {
      setError(tr('A birthday has to be a day that has already happened.'));
      return;
    }
    // A day written in but not yet added is added, rather than lost.
    if (!!label.trim() !== !!date) {
      setError(tr('Give the day a name and a date, or leave both empty.'));
      return;
    }
    const pending: ComingUpDay[] =
      label.trim() && date ? [{ id: newId('day'), kind: 'day', label: label.trim().slice(0, 60), date, yearly, at: 0 }] : [];
    const at = Date.now();
    const changes: ComingUpDay[] = [];
    // One birthday each and one meet-up: set, changed, or taken off.
    const single = (id: string, value: string, make: (date: string) => ComingUpDay) => {
      const had = find(id);
      if (value && value !== had?.date) changes.push({ ...make(value), at });
      else if (!value && had) changes.push({ ...had, at, removed: true });
    };
    single(myId, myBirthday, d => ({ id: myId, kind: 'birthday', who: me, date: d, yearly: true, at }));
    single(theirId, theirBirthday, d => ({ id: theirId, kind: 'birthday', who: them, date: d, yearly: true, at }));
    single('meet', meet, d => ({ id: 'meet', kind: 'meet', date: d, yearly: false, at }));
    for (const d of [...own, ...pending]) if (!find(d.id)) changes.push({ ...d, at });
    for (const d of live) if (d.kind === 'day' && !own.some(o => o.id === d.id)) changes.push({ ...d, at, removed: true });
    onSave(changes, FESTIVALS.map(f => f.id).filter(id => !shown.has(id)));
  };

  const field =
    'block w-full min-w-0 max-w-full rounded-xl border border-linen-border bg-linen-variant/40 p-2.5 text-sm text-linen-primary focus:outline-none focus:ring-1 focus:ring-linen-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md max-h-[88dvh] overflow-y-auto space-y-4 rounded-3xl border border-linen-border bg-linen-surface p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-serif text-lg font-medium text-linen-primary">{tr('Coming up')}</h3>
          <button type="button" onClick={onClose} aria-label={tr('Close')} className="rounded-lg p-1.5 text-linen-secondary hover:text-linen-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-linen-secondary">
          {tr('Both your phones show these days, and either of you can change them.')}
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-linen-primary">{tr('Your birthday')}</span>
          <input type="date" value={myBirthday} max={today} onChange={e => { setMyBirthday(e.target.value); setError(''); }} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-linen-primary">{tr("{name}'s birthday", { name: partner })}</span>
          <input type="date" value={theirBirthday} max={today} onChange={e => { setTheirBirthday(e.target.value); setError(''); }} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-linen-primary">{tr('The next time you meet')}</span>
          <input type="date" value={meet} min={today} onChange={e => setMeet(e.target.value)} className={field} />
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium text-linen-primary">{tr('Days of your own')}</span>
          {own.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {own.map(d => (
                <li key={d.id} className="flex items-center gap-2 rounded-xl bg-linen-variant/40 px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate text-linen-primary">{d.label}</span>
                  <span className="shrink-0 text-linen-secondary">{d.yearly ? tr('{date} · every year', { date: formatDay(d.date, false) }) : formatDay(d.date, true)}</span>
                  <button
                    type="button"
                    onClick={() => setOwn(list => list.filter(x => x.id !== d.id))}
                    aria-label={tr('Take off {label}', { label: String(d.label) })}
                    className="shrink-0 rounded-lg p-1 text-linen-secondary hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 rounded-xl border border-dashed border-linen-border p-2.5">
            <input value={label} onChange={e => { setLabel(e.target.value); setError(''); }} placeholder={tr("e.g. Amma's birthday")} maxLength={60} className={field} />
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setError(''); }} className={field} aria-label={tr('Its date')} />
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-linen-primary">
                <input type="checkbox" checked={yearly} onChange={e => setYearly(e.target.checked)} className="accent-linen-accent" />
                {tr('Every year')}
              </label>
              <button type="button" onClick={addOwn} className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-linen-accent hover:bg-linen-variant">
                <Plus className="h-3.5 w-3.5" />
                {tr('Add this day')}
              </button>
            </div>
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-linen-primary">{tr('Festivals on this phone')}</span>
          <div className="grid grid-cols-1 gap-1.5 min-[400px]:grid-cols-2">
            {FESTIVALS.map(f => (
              <label key={f.id} className="flex items-center gap-2 rounded-xl bg-linen-variant/40 px-3 py-2 text-xs text-linen-primary">
                <input
                  type="checkbox"
                  checked={shown.has(f.id)}
                  onChange={e =>
                    setShown(prev => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(f.id);
                      else next.delete(f.id);
                      return next;
                    })
                  }
                  className="accent-linen-accent"
                />
                <span aria-hidden="true">{f.emoji}</span>
                <span className="min-w-0 truncate">{activeLocale() === 'ta' && f.tamil ? f.tamil : f.name}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-linen-accent">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-linen-border/40 pt-3">
          <button type="button" onClick={onClose} className="px-3.5 py-1.5 text-xs text-linen-secondary hover:text-linen-primary">
            {tr('Cancel')}
          </button>
          <button type="submit" className="rounded-xl bg-linen-primary px-4 py-1.5 text-xs font-medium text-linen-surface hover:opacity-90">
            {tr('Save')}
          </button>
        </div>
      </form>
    </div>
  );
};
