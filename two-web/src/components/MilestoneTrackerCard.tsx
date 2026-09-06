import React, { useState } from 'react';
import { RelationshipMilestone } from '../types';
import { Calendar, Heart, Award, Sparkles, Plus, Clock, Compass, MapPin, X } from 'lucide-react';
import { newId } from '../core/ids';

interface MilestoneTrackerCardProps {
  milestones: RelationshipMilestone[];
  onAddMilestone: (milestone: RelationshipMilestone) => void;
}

export const MilestoneTrackerCard: React.FC<MilestoneTrackerCardProps> = ({
  milestones,
  onAddMilestone
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<'first' | 'home' | 'trip' | 'growth' | 'commitment'>('growth');
  const [description, setDescription] = useState('');

  // Calculate days together starting from first milestone (or 2022-04-18 default)
  const startDate = new Date('2022-04-18');
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const seasons = years * 4 + Math.floor((diffDays % 365) / 91);

  // Next upcoming anniversary: October 14
  const nextAnniversary = new Date('2026-10-14');
  const timeToAnniversary = nextAnniversary.getTime() - today.getTime();
  const daysToAnniversary = Math.max(0, Math.ceil(timeToAnniversary / (1000 * 60 * 60 * 24)));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date.trim()) return;

    onAddMilestone({
      id: newId('ms'),
      title: title.trim(),
      date: date.trim(),
      category,
      description: description.trim() || 'A precious milestone in our shared path.'
    });

    setShowAddModal(false);
    setTitle('');
    setDate('');
    setDescription('');
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'first':
        return <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">Firsts</span>;
      case 'home':
        return <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">Home & Hearth</span>;
      case 'trip':
        return <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200">Journey</span>;
      case 'growth':
        return <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">Growth</span>;
      case 'commitment':
        return <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200">Commitment</span>;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-3xl border border-linen-border bg-gradient-to-br from-linen-surface via-linen-surface to-linen-variant/20 p-6 sm:p-7 shadow-xs space-y-6">
      {/* Top Banner & Days Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-linen-border/50 pb-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-linen-accent">
            <Heart className="w-4 h-4 fill-linen-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider">Our Shared Path & Milestones</span>
          </div>
          <h3 className="font-serif text-2xl sm:text-3xl font-medium text-linen-primary">
            {diffDays.toLocaleString()} Days Together
          </h3>
          <p className="text-xs text-linen-secondary">
            {years} years of choosing each other • {seasons} shared seasons in our calm life.
          </p>
        </div>

        {/* Anniversary Countdown Pill */}
        <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200 space-y-1 self-start sm:self-auto">
          <div className="flex items-center space-x-1.5 text-xs text-rose-900 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-rose-600" />
            <span>4th Anniversary</span>
          </div>
          <div className="text-sm font-serif font-medium text-rose-950">
            {daysToAnniversary > 0 ? `${daysToAnniversary} Days Remaining` : 'Today is our Anniversary! 🎉'}
          </div>
          <span className="text-[10px] text-rose-800 block">October 14 • 4 Years of Love</span>
        </div>
      </div>

      {/* Visual Timeline Stream */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-base font-medium text-linen-primary">Our Milestone Chronicle</h4>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs text-linen-accent hover:underline font-medium inline-flex items-center"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Milestone
          </button>
        </div>

        <div className="relative pl-6 space-y-5 border-l-2 border-linen-border/80">
          {milestones.map(ms => (
            <div key={ms.id} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-linen-primary border-2 border-linen-surface shadow-xs" />

              <div className="p-3.5 rounded-2xl border border-linen-border/70 bg-linen-variant/30 group-hover:bg-linen-variant/60 transition-colors space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-linen-secondary text-[11px]">{ms.date}</span>
                  {getCategoryBadge(ms.category)}
                </div>
                <h5 className="font-serif text-sm font-medium text-linen-primary">{ms.title}</h5>
                <p className="text-xs text-linen-secondary leading-relaxed font-serif italic">
                  "{ms.description}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Milestone Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-medium text-linen-primary">Add a Relationship Milestone</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-linen-secondary hover:text-linen-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">Milestone Name</label>
                <input
                  type="text"
                  placeholder="e.g. The first road trip to the coast"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Date / Month</label>
                  <input
                    type="text"
                    placeholder="e.g. May 12, 2024"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                  >
                    <option value="first">Firsts</option>
                    <option value="home">Home & Hearth</option>
                    <option value="trip">Journey</option>
                    <option value="growth">Growth</option>
                    <option value="commitment">Commitment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">Memory Note</label>
                <textarea
                  rows={3}
                  placeholder="What feelings or quiet moments made this unforgettable?"
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
                  Engrave Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
