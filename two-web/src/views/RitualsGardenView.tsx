import React, { useState, useEffect, useRef } from 'react';
import { RitualItem, PebbleStone } from '../types';
import { Heart, Sparkles, CheckCircle2, Clock, Plus, Flame } from 'lucide-react';
import { newId } from '../core/ids';
import { localDay, isDoneOn, ritualStreak, togetherStreak } from '../core/rituals';
import { who } from '../core/who';
import { haptic } from '../core/haptics';
import { useBackLayer } from '../core/backStack';

interface RitualsGardenViewProps {
  rituals: RitualItem[];
  pebbles: PebbleStone[];
  activeUser: 'user' | 'partner';
  partnerName?: string;
  /** Ticks (true) or un-ticks (false) a ritual for today, for this phone's seat. */
  onSetRitualDone: (ritualId: string, done: boolean) => void;
  onAddRitual: (newRitual: RitualItem) => void;
}

/** "1 day together", "4 days in a row together" - only ever shown for a run of one or more. */
const togetherLabel = (days: number) => (days === 1 ? '1 day together' : `${days} days in a row together`);

/** What the end of the kiss timer did: ticked the kiss off, found it already ticked, or had no kiss ritual to tick. */
type KissResult = 'ticked' | 'already' | 'held';

/**
 * Today's date on this phone, kept current while the screen stays open.
 *
 * "Done today" is worked out from it, so it has to move on at midnight - and
 * when the phone wakes up the next morning with this screen still open, which
 * a midnight timer alone would miss: a sleeping WebView does not run timers.
 */
function useToday(): [string, () => string] {
  const [today, setToday] = useState(() => localDay());

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const timer = window.setTimeout(() => setToday(localDay()), nextMidnight.getTime() - now.getTime());
    return () => window.clearTimeout(timer);
  }, [today]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setToday(localDay());
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const refreshNow = () => {
    const now = localDay();
    setToday(now);
    return now;
  };
  return [today, refreshNow];
}

export const RitualsGardenView: React.FC<RitualsGardenViewProps> = ({
  rituals,
  pebbles,
  activeUser,
  partnerName,
  onSetRitualDone,
  onAddRitual
}) => {
  const [kissTimerActive, setKissTimerActive] = useState(false);
  const [kissSecondsLeft, setKissSecondsLeft] = useState(6);
  const [kissResult, setKissResult] = useState<KissResult | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newDuration, setNewDuration] = useState('5 mins');
  const [newCategory, setNewCategory] = useState<'affection' | 'presence' | 'reflection' | 'play'>('presence');
  const [today, refreshToday] = useToday();

  useBackLayer(showAddModal, () => setShowAddModal(false));

  const otherSeat = activeUser === 'user' ? 'partner' : 'user';
  const partnerLabel = who(otherSeat, activeUser, partnerName);
  const streak = togetherStreak(rituals, today);
  const doneByMeToday = rituals.filter(r => isDoneOn(r, activeUser, today)).length;

  // Read by the timer when it finishes, which may be several renders after it
  // started: the latest rituals and handler, not the ones it began with.
  const ritualsRef = useRef(rituals);
  ritualsRef.current = rituals;
  const setDoneRef = useRef(onSetRitualDone);
  setDoneRef.current = onSetRitualDone;
  const seatRef = useRef(activeUser);
  seatRef.current = activeUser;

  // The 6-second kiss: one tick a second, and at the end the kiss ritual is
  // marked done for today - only ever marked, never un-ticked. It used to be
  // toggled, so holding a kiss already ticked off took the tick away.
  useEffect(() => {
    if (!kissTimerActive) return;
    if (kissSecondsLeft > 0) {
      const tick = window.setTimeout(() => setKissSecondsLeft(s => s - 1), 1000);
      return () => window.clearTimeout(tick);
    }
    setKissTimerActive(false);
    const kiss = ritualsRef.current.find(r => r.title.toLowerCase().includes('6-second'));
    if (!kiss) {
      setKissResult('held');
    } else if (isDoneOn(kiss, seatRef.current, localDay())) {
      setKissResult('already');
    } else {
      setDoneRef.current(kiss.id, true);
      setKissResult('ticked');
    }
    haptic('confirm');
  }, [kissTimerActive, kissSecondsLeft]);

  // Its own effect, so the message is not cut short by the timer's cleanup.
  useEffect(() => {
    if (!kissResult) return;
    const hide = window.setTimeout(() => setKissResult(null), 3500);
    return () => window.clearTimeout(hide);
  }, [kissResult]);

  const startKissTimer = () => {
    setKissSecondsLeft(6);
    setKissResult(null);
    setKissTimerActive(true);
  };

  const toggleRitual = (ritual: RitualItem) => {
    // The day as it is now, not as it was when the screen last drew: a tap
    // just after midnight is about the new day.
    const day = refreshToday();
    const done = !isDoneOn(ritual, activeUser, day);
    haptic(done ? 'confirm' : 'tick');
    onSetRitualDone(ritual.id, done);
  };

  const handleCreateRitual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created: RitualItem = {
      id: newId('r'),
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || 'A private shared moment for the two of us.',
      duration: newDuration,
      category: newCategory,
      // Not done by either of you yet - planting a ritual is not doing it.
      doneOn: { user: [], partner: [] }
    };

    onAddRitual(created);
    setShowAddModal(false);
    setNewTitle('');
    setNewSubtitle('');
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'affection':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-800 border border-rose-200">Affection</span>;
      case 'presence':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">Presence</span>;
      case 'reflection':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-800 border border-sky-200">Reflection</span>;
      case 'play':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">Play</span>;
      default:
        return null;
    }
  };

  // Stacked pebble stones (bottom up)
  const sortedPebbles = [...pebbles].slice(-10);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title & Philosophy Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-linen-primary tracking-tight">
            Shared Micro-Rituals & Zen Pebble Garden
          </h2>
          <p className="text-sm text-linen-secondary mt-1">
            Intentional micro-habits that release oxytocin, quiet cortisol, and nurture relational safety.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="self-start sm:self-auto inline-flex items-center px-3.5 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Private Ritual
        </button>
      </div>

      {/* Gottman Relationship Research Callout */}
      <div className="p-5 rounded-2xl border border-linen-border bg-gradient-to-r from-linen-variant/50 via-linen-surface to-linen-variant/30 space-y-2 shadow-xs">
        <div className="flex items-center space-x-2 text-linen-accent">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">The Gottman 6-Second Oasis</span>
        </div>
        <p className="font-serif text-sm text-linen-primary italic leading-relaxed">
          "A 6-second kiss acts as an emotional oasis. It stops the hectic rush of the day and signals to your biological nervous system that you are home, treasured, and safe with your partner."
        </p>
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={startKissTimer}
            disabled={kissTimerActive}
            className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              kissTimerActive
                ? 'bg-rose-100 text-rose-900 border border-rose-300 animate-pulse'
                : 'bg-linen-surface hover:bg-linen-variant text-linen-primary border border-linen-border shadow-xs'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 mr-1.5 ${kissTimerActive ? 'text-rose-600 fill-rose-600' : 'text-rose-500'}`} />
            {kissTimerActive ? `Holding Kiss: ${kissSecondsLeft}s...` : 'Start 6-Second Kiss Timer'}
          </button>
          {kissResult && (
            <span role="status" className="text-xs font-medium text-linen-primary bg-linen-variant px-3 py-1 rounded-full border border-linen-border animate-fade-in">
              {kissResult === 'ticked'
                ? 'Six seconds. The kiss is ticked off for today.'
                : kissResult === 'already'
                ? 'Six seconds. Already ticked off today.'
                : 'Six seconds, held.'}
            </span>
          )}
        </div>
      </div>

      {/* The Zen River Pebble Garden (Stacked Cairn Visualization) */}
      <div className="p-6 sm:p-8 rounded-3xl border border-linen-border bg-linen-surface shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-linen-border/60 pb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-linen-accent">Our Living Stone Cairn</span>
            <h3 className="font-serif text-xl font-medium text-linen-primary">The Pebble Garden</h3>
            <p className="text-xs text-linen-secondary mt-0.5">
              Each completed ritual balances an organic river stone in our shared sanctuary.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="px-3 py-1.5 rounded-xl bg-linen-variant/70 border border-linen-border text-linen-primary font-medium">
                <strong>{pebbles.length}</strong> {pebbles.length === 1 ? 'stone' : 'stones'} stacked
              </div>
              {/* Counted from the days each of you actually ticked, and not
                  shown at all until there is a run to show. */}
              {streak > 0 && (
                <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-linen-variant/70 border border-linen-border text-linen-primary font-medium">
                  <Flame className="w-3.5 h-3.5 mr-1.5 text-linen-accent" />
                  {togetherLabel(streak)}
                </div>
              )}
            </div>
            {streak > 0 && (
              <span className="text-[11px] text-linen-secondary">
                A day counts when you both do at least one ritual.
              </span>
            )}
          </div>
        </div>

        {/* Visual Cairn Canvas */}
        <div className="relative min-h-[280px] sm:min-h-[300px] w-full bg-gradient-to-b from-linen-variant/20 via-linen-variant/40 to-linen-variant/60 rounded-2xl flex flex-col items-center justify-end p-6 border border-linen-border/40">
          {/* Ambient watercolor background circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-linen-accent/5 blur-2xl pointer-events-none" />

          {/* Stacked Stones (Top to Bottom rendering) */}
          <div className="flex flex-col-reverse items-center z-10 space-y-reverse space-y-1 mb-2">
            {sortedPebbles.map((stone) => {
              const width = Math.max(36, stone.size);
              const height = Math.max(14, stone.height);

              return (
                <div
                  key={stone.id}
                  className="transition-all duration-300 hover:scale-110 cursor-pointer shadow-sm relative group hover:z-50 z-10"
                  style={{
                    width: `${width}px`,
                    height: `${height}px`,
                    backgroundColor: stone.color,
                    borderRadius: `${height}px`,
                    transform: `rotate(${stone.rotation}deg)`,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.3)'
                  }}
                >
                  {/* Single Floating Tooltip - elevated above all stones */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:flex flex-col items-center whitespace-nowrap pointer-events-none z-50 animate-fade-in">
                    <div className="bg-linen-primary text-linen-surface text-[11px] px-3 py-1.5 rounded-xl shadow-2xl font-medium border border-white/20 flex items-center space-x-1.5">
                      <span className="font-serif">{stone.ritualTitle}</span>
                      <span className="text-[10px] text-linen-surface/75 font-normal">({stone.placedAt})</span>
                    </div>
                    {/* Tooltip downward arrowhead */}
                    <div className="w-2 h-2 bg-linen-primary rotate-45 -mt-1 shadow-xs" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wooden / Slate Pedestal Foundation */}
          <div className="w-56 sm:w-72 h-3.5 bg-[#4A3E39] rounded-full mt-2 shadow-md border-t border-white/10 z-10" />
          <span className="text-[10px] text-linen-secondary mt-2 z-10 italic">
            Ground of intentional partnership • Balanced together
          </span>
        </div>
      </div>

      {/* Micro-Rituals Checklist */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-medium text-linen-primary">Today's Micro-Rituals</h3>
          {rituals.length > 0 && (
            <span className="text-xs text-linen-secondary">
              You've done <strong>{doneByMeToday}</strong> of {rituals.length} today
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {rituals.map(ritual => {
            // Done today means today is among the days ticked - so these are
            // all clear again each morning without anything resetting them.
            const isDoneByMe = isDoneOn(ritual, activeUser, today);
            const isDoneByPartner = isDoneOn(ritual, otherSeat, today);
            const isBothDone = isDoneByMe && isDoneByPartner;
            const run = ritualStreak(ritual, today);

            return (
              <div
                key={ritual.id}
                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                  isBothDone
                    ? 'border-linen-accent/50 bg-linen-variant/50 shadow-xs'
                    : isDoneByMe
                    ? 'border-linen-primary/30 bg-linen-surface shadow-xs'
                    : 'border-linen-border bg-linen-surface hover:border-linen-accent/40'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    {getCategoryBadge(ritual.category)}
                    <div className="flex items-center text-xs text-linen-secondary space-x-1">
                      <Clock className="w-3 h-3 text-linen-accent" />
                      <span>{ritual.duration}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-serif font-medium text-sm text-linen-primary">
                      {ritual.title}
                    </h4>
                    <p className="text-xs text-linen-secondary leading-relaxed mt-0.5">
                      {ritual.subtitle}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-linen-border/40 mt-3 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] min-w-0">
                    {run > 0 && (
                      <span className="inline-flex items-center text-linen-secondary">
                        <Flame className="w-3.5 h-3.5 mr-1 text-linen-accent" />
                        {togetherLabel(run)}
                      </span>
                    )}
                    {isDoneByPartner && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-linen-variant text-linen-accent">
                        {partnerLabel} did it today
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => toggleRitual(ritual)}
                    aria-pressed={isDoneByMe}
                    className={`shrink-0 inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isDoneByMe
                        ? 'bg-linen-primary text-linen-surface shadow-xs'
                        : 'bg-linen-variant hover:bg-linen-border text-linen-primary border border-linen-border'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    {isDoneByMe ? 'Done Today' : 'Mark Done'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Custom Ritual Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fade-in">
            <h3 className="font-serif text-lg font-medium text-linen-primary">Create a Shared Micro-Ritual</h3>
            <p className="text-xs text-linen-secondary">
              Keep it simple and repeatable. A ritual should take under 10 minutes and require zero logistics.
            </p>

            <form onSubmit={handleCreateRitual} className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">Ritual Name</label>
                <input
                  type="text"
                  placeholder="e.g. Evening balcony breathing together"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">Gentle Description</label>
                <input
                  type="text"
                  placeholder="e.g. 5 minutes standing side-by-side watching the twilight sky"
                  value={newSubtitle}
                  onChange={e => setNewSubtitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Duration</label>
                  <select
                    value={newDuration}
                    onChange={e => setNewDuration(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                  >
                    <option value="6 seconds">6 seconds</option>
                    <option value="2 mins">2 minutes</option>
                    <option value="5 mins">5 minutes</option>
                    <option value="10 mins">10 minutes</option>
                    <option value="30 mins">30 minutes</option>
                    <option value="60 mins">1 hour</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                  >
                    <option value="affection">Affection</option>
                    <option value="presence">Presence</option>
                    <option value="reflection">Reflection</option>
                    <option value="play">Play</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-linen-border/40">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 text-xs text-linen-secondary hover:text-linen-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  Plant Ritual
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
