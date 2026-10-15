import React, { useMemo, useState } from 'react';
import { EmotionalReport, WeatherState } from '../types';
import { Sliders, Heart, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useToday } from '../core/useToday';
import { useBackLayer } from '../core/backStack';
import { lastDays, weatherByDay } from '../core/weatherHistory';

interface EmotionalWeatherCardProps {
  userReport: EmotionalReport;
  partnerReport: EmotionalReport;
  activeUser: 'user' | 'partner';
  onUpdateReport: (report: Partial<EmotionalReport>) => void;
  partnerName?: string;
}

const WEATHER_METADATA: Record<WeatherState, { label: string; icon: string; desc: string }> = {
  SUNNY: { label: 'Sunny', icon: '☀️', desc: 'Radiant, energized, expansive' },
  CALM: { label: 'Clear', icon: '🌤️', desc: 'Grounded, peaceful, steady' },
  OVERCAST: { label: 'Overcast', icon: '☁️', desc: 'Reflective, quiet, introspective' },
  RAINY: { label: 'Turbulent', icon: '🌧️', desc: 'Fragile, stressed, tender' },
  STORMY: { label: 'Stormy', icon: '⛈️', desc: 'High friction, depleted, overwhelmed' },
};

/** Days on the card itself, and behind "See 30 days". */
const STRIP_DAYS = 14;
const MONTH_DAYS = 30;

function dateOf(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * Two weeks of one of you in a few words: "mostly clear" when one weather
 * held at least half of the days kept, "a mix" otherwise - and nothing until
 * a few days are known.
 */
function summaryOf(days: (WeatherState | null)[]): string {
  const known = days.filter((w): w is WeatherState => !!w);
  if (known.length < 3) return '';
  const counts = new Map<WeatherState, number>();
  for (const w of known) counts.set(w, (counts.get(w) || 0) + 1);
  const [top, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return count * 2 >= known.length ? `mostly ${WEATHER_METADATA[top].label.toLowerCase()}` : 'a mix';
}

/** "Today", "Yesterday", "Tue 8 Oct". */
function dayName(key: string, today: string): string {
  if (key === today) return 'Today';
  const yesterday = new Date(dateOf(today).getTime() - 86_400_000);
  if (dateOf(key).toDateString() === yesterday.toDateString()) return 'Yesterday';
  return dateOf(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export const EmotionalWeatherCard: React.FC<EmotionalWeatherCardProps> = ({
  userReport,
  partnerReport,
  activeUser,
  onUpdateReport,
  partnerName = 'Partner'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showMonth, setShowMonth] = useState(false);
  // The two weeks stay folded away until the arrow under the card opens them.
  const [showHistory, setShowHistory] = useState(false);

  // Determine current active person's report vs partner's report
  const myReport = activeUser === 'user' ? userReport : partnerReport;
  const theirReport = activeUser === 'user' ? partnerReport : userReport;

  // The last two weeks, oldest on the left and today on the right.
  const today = useToday();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stripKeys = useMemo(() => lastDays(STRIP_DAYS), [today]);
  const theirDays = weatherByDay(theirReport, stripKeys, today);
  const myDays = weatherByDay(myReport, stripKeys, today);

  return (
    <div className="bg-linen-surface rounded-2xl border border-linen-border p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-medium text-linen-primary">Emotional Weather</h2>
          <p className="text-xs text-linen-secondary">How each of you is doing today. No explaining needed.</p>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="shrink-0 whitespace-nowrap inline-flex items-center text-xs font-medium px-2.5 py-1.5 rounded-lg bg-linen-variant hover:bg-linen-border text-linen-primary transition-colors"
        >
          <Sliders className="w-3.5 h-3.5 mr-1 text-linen-accent" />
          {/* "Update" on a phone: the full label left the card's title three
              words wide, on three lines. */}
          {isEditing ? (
            'Close'
          ) : (
            <>
              <span className="sm:hidden">Update</span>
              <span className="hidden sm:inline">Update Your State</span>
            </>
          )}
        </button>
      </div>

      {/* Side-by-side display */}
      <div className="grid grid-cols-2 gap-4 divide-x divide-linen-border">
        {/* Partner Column */}
        <div className="pr-4 flex flex-col items-center text-center">
          <span className="text-xs font-medium text-linen-secondary uppercase tracking-wider">{partnerName}</span>
          <div className="text-3xl my-2">{WEATHER_METADATA[theirReport.weather].icon}</div>
          <span className="text-base font-serif font-medium text-linen-primary">
            {WEATHER_METADATA[theirReport.weather].label}
          </span>
          <div className="flex items-center space-x-1 mt-3" title={`Energy: ${theirReport.capacity} of 5`}>
            {[1, 2, 3, 4, 5].map(i => (
              <Heart
                key={i}
                className={`w-3.5 h-3.5 transition-colors ${
                  i <= theirReport.capacity
                    ? 'fill-rose-500 text-rose-500'
                    : 'text-linen-border fill-transparent'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-linen-secondary mt-1">Energy: {theirReport.capacity} of 5</span>
        </div>

        {/* You Column */}
        <div className="pl-4 flex flex-col items-center text-center">
          <span className="text-xs font-medium text-linen-accent uppercase tracking-wider">
            Your Status
          </span>
          <div className="text-3xl my-2">{WEATHER_METADATA[myReport.weather].icon}</div>
          <span className="text-base font-serif font-medium text-linen-primary">
            {WEATHER_METADATA[myReport.weather].label}
          </span>
          <div className="flex items-center space-x-1 mt-3" title={`Energy: ${myReport.capacity} of 5`}>
            {[1, 2, 3, 4, 5].map(i => (
              <Heart
                key={i}
                className={`w-3.5 h-3.5 transition-colors ${
                  i <= myReport.capacity
                    ? 'fill-rose-500 text-rose-500'
                    : 'text-linen-border fill-transparent'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-linen-secondary mt-1">Energy: {myReport.capacity} of 5</span>
        </div>
      </div>

      {/* How each of you has been lately: the weather each day, carried on
          over days with no update. Folded away until the arrow below opens
          it, and drawn open with the card rather than popping in. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          showHistory ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
        aria-hidden={!showHistory}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id="weather-history"
            className="mt-5 rounded-2xl border border-linen-border/70 bg-gradient-to-b from-linen-variant/70 to-linen-variant/20 p-3.5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-linen-secondary">Last 2 weeks</span>
              <button
                type="button"
                onClick={() => setShowMonth(true)}
                tabIndex={showHistory ? 0 : -1}
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-linen-accent hover:underline"
              >
                See 30 days
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <HistoryRow name={partnerName} tone="text-linen-secondary" days={theirDays} />
            <HistoryRow name="You" tone="text-linen-accent" days={myDays} />
            <div
              className="mt-1.5 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px] text-center text-[10px] text-linen-secondary"
              aria-hidden="true"
            >
              {stripKeys.map((key, i) => (
                <span key={key} className={i === STRIP_DAYS - 1 ? 'font-bold text-linen-primary' : ''}>
                  {dateOf(key).toLocaleDateString('en-GB', { weekday: 'narrow' })}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* The arrow at the foot of the card: opens and closes the two weeks. */}
      <button
        type="button"
        onClick={() => setShowHistory(v => !v)}
        aria-expanded={showHistory}
        aria-controls="weather-history"
        className="group mt-4 flex w-full items-center gap-3 text-[11px] font-semibold text-linen-secondary cursor-pointer"
      >
        <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-transparent to-linen-border" />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-linen-border bg-linen-surface px-3 py-1 shadow-xs transition-colors group-hover:text-linen-primary">
          {showHistory ? 'Hide' : 'Last 2 weeks'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${showHistory ? 'rotate-180' : ''}`} />
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-l from-transparent to-linen-border" />
      </button>

      {showMonth && (
        <WeatherMonthSheet
          partnerName={partnerName}
          theirReport={theirReport}
          myReport={myReport}
          today={today}
          onClose={() => setShowMonth(false)}
        />
      )}

      {/* Inline Editing Drawer */}
      {isEditing && (
        <div className="mt-6 pt-6 border-t border-linen-border space-y-5 animate-in fade-in duration-200">
          <div>
            <label className="block text-xs font-medium text-linen-secondary mb-2">How are you feeling today?</label>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(WEATHER_METADATA) as WeatherState[]).map(state => {
                const meta = WEATHER_METADATA[state];
                const isSelected = myReport.weather === state;
                return (
                  <button
                    key={state}
                    onClick={() => onUpdateReport({ weather: state })}
                    className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-linen-primary bg-linen-variant ring-1 ring-linen-primary'
                        : 'border-linen-border hover:bg-linen-variant/60'
                    }`}
                  >
                    <span className="text-2xl">{meta.icon}</span>
                    <span className="text-xs font-medium text-linen-primary mt-1">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-linen-secondary flex items-center space-x-1.5">
                <span>Energy:</span>
                <span className="inline-flex items-center space-x-0.5 ml-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Heart
                      key={i}
                      className={`w-3 h-3 ${
                        i <= myReport.capacity
                          ? 'fill-rose-500 text-rose-500'
                          : 'text-linen-border fill-transparent'
                      }`}
                    />
                  ))}
                </span>
                <strong className="text-linen-primary ml-1">({myReport.capacity}/5)</strong>
              </label>
              <span className="text-xs text-linen-accent">
                {myReport.capacity <= 1 ? 'Very little energy - go gently' : myReport.capacity >= 4 ? 'Plenty of energy to give' : 'Some energy to give'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={myReport.capacity}
              onChange={(e) => onUpdateReport({ capacity: parseInt(e.target.value) })}
              className="w-full accent-linen-primary cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * One of you over the last two weeks: a tile a day, today last and ringed,
 * and the fortnight in a few words beside the name.
 */
const HistoryRow: React.FC<{ name: string; tone: string; days: (WeatherState | null)[] }> = ({ name, tone, days }) => {
  const summary = summaryOf(days);
  return (
    <>
      <p className="mt-3 flex items-baseline justify-between gap-2 text-[11px]">
        <span className={`font-semibold ${tone}`}>{name}</span>
        {summary && <span className="text-linen-secondary">{summary}</span>}
      </p>
      <div
        role="img"
        aria-label={`${name}, last two weeks${summary ? ` (${summary})` : ''}: ${days
          .map(w => (w ? WEATHER_METADATA[w].label : 'nothing yet'))
          .join(', ')}`}
        className="mt-1.5 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]"
      >
        {days.map((w, i) => (
          <span
            key={i}
            className={`grid aspect-square place-items-center rounded-[7px] text-[13px] leading-none ${
              w ? 'bg-linen-surface/80 shadow-[0_1px_2px_rgba(29,22,56,0.08)]' : ''
            } ${i === days.length - 1 ? 'ring-2 ring-linen-accent/45' : ''}`}
          >
            {w ? WEATHER_METADATA[w].icon : <span className="h-1 w-1 rounded-full bg-linen-border" />}
          </span>
        ))}
      </div>
    </>
  );
};

/** Thirty days, newest first: a row a day, with each of your weathers. */
const WeatherMonthSheet: React.FC<{
  partnerName: string;
  theirReport: EmotionalReport;
  myReport: EmotionalReport;
  today: string;
  onClose: () => void;
}> = ({ partnerName, theirReport, myReport, today, onClose }) => {
  useBackLayer(true, onClose);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const keys = useMemo(() => lastDays(MONTH_DAYS), [today]);
  const theirs = weatherByDay(theirReport, keys, today);
  const mine = weatherByDay(myReport, keys, today);
  const rows = keys.map((key, i) => ({ key, theirs: theirs[i], mine: mine[i] })).reverse();
  const cell = (w: WeatherState | null) =>
    w ? (
      <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-linen-primary">
        <span className="text-base leading-none">{WEATHER_METADATA[w].icon}</span>
        <span className="truncate">{WEATHER_METADATA[w].label}</span>
      </span>
    ) : (
      <span className="text-xs text-linen-secondary/70">-</span>
    );

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
        aria-labelledby="weather-month-title"
        className="flex max-h-[85vh] flex-col rounded-t-[28px] bg-linen-surface surface-solid px-5 pt-3 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-linen-border" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="weather-month-title" className="font-serif text-xl font-semibold text-linen-primary">
              Last 30 days
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-linen-secondary">
              A day with no update keeps the weather from the day before.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-linen-variant text-linen-secondary hover:text-linen-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-[1.1fr_1fr_1fr] gap-2 border-b border-linen-border pb-2 text-[11px] font-semibold uppercase tracking-wider">
          <span className="text-linen-secondary">Day</span>
          <span className="truncate text-linen-secondary">{partnerName}</span>
          <span className="text-linen-accent">You</span>
        </div>
        <div className="min-h-0 overflow-y-auto">
          {rows.map(row => (
            <div key={row.key} className="grid grid-cols-[1.1fr_1fr_1fr] items-center gap-2 border-b border-linen-border/60 py-2.5 last:border-b-0">
              <span className={`text-xs ${row.key === today ? 'font-semibold text-linen-primary' : 'text-linen-secondary'}`}>
                {dayName(row.key, today)}
              </span>
              {cell(row.theirs)}
              {cell(row.mine)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
