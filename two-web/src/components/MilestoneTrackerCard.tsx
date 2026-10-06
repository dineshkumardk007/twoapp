import React, { useState } from 'react';
import { RelationshipMilestone } from '../types';
import { Plus, X } from 'lucide-react';
import { newId } from '../core/ids';
import { formatDay, isCalendarDate, localDateKey } from '../core/ourDates';
import { useBackLayer } from '../core/backStack';

interface MilestoneTrackerCardProps {
  milestones: RelationshipMilestone[];
  onAddMilestone: (milestone: RelationshipMilestone) => void;
}

const CATEGORY_LABELS: Record<RelationshipMilestone['category'], string> = {
  first: 'Firsts',
  home: 'Home',
  trip: 'Journey',
  growth: 'Growth',
  commitment: 'Commitment'
};

/**
 * A milestone's date as people say it.
 *
 * New milestones are picked from a calendar and stored as 'YYYY-MM-DD'.
 * Older ones were typed by hand ("May 12, 2024") and are shown exactly as
 * they were written.
 */
function milestoneDate(date: string): string {
  return isCalendarDate(date) ? formatDay(date) : date;
}

/**
 * The milestones the two of you have added, in the order you added them, and
 * a way to add another.
 *
 * The day count and the anniversary used to sit at the top of this card,
 * worked out from a sample couple's dates. They live in OurDatesCard now,
 * from your own.
 */
export const MilestoneTrackerCard: React.FC<MilestoneTrackerCardProps> = ({
  milestones,
  onAddMilestone
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<RelationshipMilestone['category']>('growth');
  const [description, setDescription] = useState('');
  useBackLayer(showAddModal, () => setShowAddModal(false));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date.trim()) return;

    onAddMilestone({
      id: newId('ms'),
      title: title.trim(),
      date: date.trim(),
      category,
      // Left empty rather than filled with a line nobody wrote.
      description: description.trim()
    });

    setShowAddModal(false);
    setTitle('');
    setDate('');
    setDescription('');
  };

  return (
    <div className="rounded-3xl border border-linen-border bg-linen-surface p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-lg font-medium text-linen-primary">Milestones</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-xs text-linen-accent hover:underline font-medium inline-flex items-center shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add milestone
        </button>
      </div>

      {milestones.length === 0 ? (
        <p className="text-xs text-linen-secondary leading-relaxed">
          Nothing here yet. Add the days you want to remember - a first trip, a new home.
        </p>
      ) : (
        <div className="relative pl-6 space-y-5 border-l-2 border-linen-border/80">
          {milestones.map(ms => (
            <div key={ms.id} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-linen-primary border-2 border-linen-surface shadow-xs" />

              <div className="p-3.5 rounded-2xl border border-linen-border/70 bg-linen-variant/30 group-hover:bg-linen-variant/60 transition-colors space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-linen-secondary text-[11px] min-w-0 truncate">{milestoneDate(ms.date)}</span>
                  <span className="shrink-0 text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-md bg-linen-surface text-linen-secondary border border-linen-border">
                    {CATEGORY_LABELS[ms.category] || CATEGORY_LABELS.growth}
                  </span>
                </div>
                <h5 className="font-serif text-sm font-medium text-linen-primary break-words">{ms.title}</h5>
                {ms.description && (
                  <p className="text-xs text-linen-secondary leading-relaxed font-serif italic break-words">
                    "{ms.description}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Milestone Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-medium text-linen-primary">Add a milestone</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-linen-secondary hover:text-linen-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">What happened</label>
                <input
                  type="text"
                  placeholder="e.g. Our first trip to the coast"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <label className="text-xs font-medium text-linen-primary block mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    max={localDateKey()}
                    onChange={e => setDate(e.target.value)}
                    className="block w-full min-w-0 max-w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                    required
                  />
                </div>

                <div className="min-w-0">
                  <label className="text-xs font-medium text-linen-primary block mb-1">Kind</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as RelationshipMilestone['category'])}
                    className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                  >
                    <option value="first">Firsts</option>
                    <option value="home">Home</option>
                    <option value="trip">Journey</option>
                    <option value="growth">Growth</option>
                    <option value="commitment">Commitment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">A note (optional)</label>
                <textarea
                  rows={3}
                  placeholder="What do you want to remember about it?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                />
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
                  className="px-4 py-1.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90"
                >
                  Add milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
