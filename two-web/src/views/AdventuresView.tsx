import React, { useState } from 'react';
import { AdventureItem, EnergyTier, AdventureCategory } from '../types';
import { Compass, Sparkles, Home, Palette, TreePine, Utensils, CheckCircle2, Plus, Send, Shuffle, DollarSign, X } from 'lucide-react';

interface AdventuresViewProps {
  adventures: AdventureItem[];
  activeUser: 'user' | 'partner';
  onAddAdventure: (adventure: AdventureItem) => void;
  onToggleComplete: (id: string, notes?: string) => void;
  onSendToChat: (message: string) => void;
}

export const AdventuresView: React.FC<AdventuresViewProps> = ({
  adventures,
  activeUser,
  onAddAdventure,
  onToggleComplete,
  onSendToChat
}) => {
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyTier | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'roulette' | 'bucketlist'>('roulette');
  const [currentDraw, setCurrentDraw] = useState<AdventureItem | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [proposedToast, setProposedToast] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEnergy, setNewEnergy] = useState<EnergyTier>('medium');
  const [newCat, setNewCat] = useState<AdventureCategory>('home');
  const [newCost, setNewCost] = useState<'$' | '$$' | 'Free'>('Free');

  // Filtered pool for roulette
  const pool = adventures.filter(a => selectedEnergy === 'all' || a.energyTier === selectedEnergy);

  const handleSpinRoulette = () => {
    if (pool.length === 0) return;
    setIsSpinning(true);
    let count = 0;
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * pool.length);
      setCurrentDraw(pool[randomIdx]);
      count++;
      if (count > 7) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 120);
  };

  const handleProposeInChat = (item: AdventureItem) => {
    onSendToChat(`✨ Date Proposal: "${item.title}" — ${item.description} (${item.energyTier.toUpperCase()} Energy • Cost: ${item.estimatedCost})`);
    setProposedToast(true);
    setTimeout(() => setProposedToast(false), 2500);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created: AdventureItem = {
      id: `adv-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || 'A special adventure to experience together.',
      energyTier: newEnergy,
      category: newCat,
      estimatedCost: newCost,
      isCompleted: false
    };

    onAddAdventure(created);
    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
  };

  const getCategoryIcon = (cat: AdventureCategory) => {
    switch (cat) {
      case 'home': return <Home className="w-4 h-4 text-amber-600" />;
      case 'creative': return <Palette className="w-4 h-4 text-indigo-600" />;
      case 'outdoors': return <TreePine className="w-4 h-4 text-emerald-600" />;
      case 'food': return <Utensils className="w-4 h-4 text-rose-600" />;
    }
  };

  const getEnergyBadge = (tier: EnergyTier) => {
    switch (tier) {
      case 'low':
        return <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">🛋️ Low Energy (Cozy Home)</span>;
      case 'medium':
        return <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">🎨 Medium Energy (Playful)</span>;
      case 'high':
        return <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">🚗 High Energy (Spontaneous)</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-linen-primary tracking-tight">
            Adventure Roulette & Shared Bucket List
          </h2>
          <p className="text-sm text-linen-secondary mt-1">
            Eliminate evening decision fatigue with energy-tuned date sparks and shared future dreams.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="self-start sm:self-auto inline-flex items-center px-4 py-2.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add to Bucket List
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-linen-border pb-2">
        <button
          onClick={() => setActiveTab('roulette')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'roulette'
              ? 'bg-linen-primary text-linen-surface shadow-xs'
              : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant/60'
          }`}
        >
          🎲 Adventure Roulette
        </button>
        <button
          onClick={() => setActiveTab('bucketlist')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'bucketlist'
              ? 'bg-linen-primary text-linen-surface shadow-xs'
              : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant/60'
          }`}
        >
          📋 Shared Bucket List ({adventures.length})
        </button>
      </div>

      {activeTab === 'roulette' ? (
        <div className="space-y-6">
          {/* Energy Level Filter Bar */}
          <div className="p-4 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
            <span className="text-xs font-medium text-linen-primary block">
              What energy level do you two have tonight?
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'all', label: 'All Energy Levels' },
                { id: 'low', label: '🛋️ Low (Cozy Home)' },
                { id: 'medium', label: '🎨 Medium (Creative)' },
                { id: 'high', label: '🚗 High (Spontaneous)' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedEnergy(opt.id as any)}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    selectedEnergy === opt.id
                      ? 'border-linen-primary ring-2 ring-linen-primary/20 bg-linen-variant/70 text-linen-primary'
                      : 'border-linen-border hover:bg-linen-variant/30 text-linen-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drawn Roulette Card */}
          <div className="p-8 rounded-3xl border border-linen-border bg-gradient-to-br from-linen-surface via-linen-surface to-linen-variant/30 shadow-xs flex flex-col items-center text-center space-y-5 min-h-[280px] justify-center relative overflow-hidden">
            {currentDraw ? (
              <div className="space-y-4 max-w-md animate-fade-in">
                <div className="flex items-center justify-center space-x-2">
                  <span className="p-2 rounded-xl bg-linen-variant border border-linen-border text-linen-accent">
                    {getCategoryIcon(currentDraw.category)}
                  </span>
                  {getEnergyBadge(currentDraw.energyTier)}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-linen-variant text-linen-secondary font-mono">
                    {currentDraw.estimatedCost}
                  </span>
                </div>

                <h3 className="font-serif text-2xl font-medium text-linen-primary">
                  {currentDraw.title}
                </h3>
                <p className="text-xs sm:text-sm text-linen-secondary leading-relaxed font-serif italic">
                  "{currentDraw.description}"
                </p>

                <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => handleProposeInChat(currentDraw)}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Propose in Chat
                  </button>

                  <button
                    onClick={handleSpinRoulette}
                    disabled={isSpinning}
                    className="inline-flex items-center px-4 py-2 rounded-xl border border-linen-border bg-linen-variant hover:bg-linen-border text-linen-primary text-xs font-medium transition-colors"
                  >
                    <Shuffle className="w-3.5 h-3.5 mr-1.5 text-linen-accent" />
                    Draw Another
                  </button>
                </div>

                {proposedToast && (
                  <p className="text-xs text-emerald-600 font-medium">
                    ✓ Date proposed directly to encrypted chat!
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4 max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-linen-variant border border-linen-border mx-auto flex items-center justify-center text-linen-accent">
                  <Compass className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-xl font-medium text-linen-primary">
                  Ready to spark tonight's connection?
                </h3>
                <p className="text-xs text-linen-secondary leading-relaxed">
                  Tap the roulette button to draw a thoughtful, zero-friction date tailored to your current energy.
                </p>
                <button
                  onClick={handleSpinRoulette}
                  disabled={isSpinning}
                  className="inline-flex items-center px-5 py-3 rounded-2xl bg-linen-primary text-linen-surface text-sm font-medium hover:opacity-90 transition-opacity shadow-md"
                >
                  <Shuffle className="w-4 h-4 mr-2" />
                  Spin Adventure Roulette
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Shared Bucket List View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {adventures.map(adv => (
              <div
                key={adv.id}
                className={`p-5 rounded-2xl border transition-all ${
                  adv.isCompleted
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-linen-border bg-linen-surface hover:border-linen-accent/50'
                } shadow-xs flex flex-col justify-between`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="p-1 rounded-md bg-linen-variant text-linen-accent">
                        {getCategoryIcon(adv.category)}
                      </span>
                      {getEnergyBadge(adv.energyTier)}
                    </div>
                    <span className="text-[11px] font-mono text-linen-secondary">{adv.estimatedCost}</span>
                  </div>

                  <h4 className={`font-serif text-base font-medium ${adv.isCompleted ? 'line-through text-linen-secondary' : 'text-linen-primary'}`}>
                    {adv.title}
                  </h4>
                  <p className="text-xs text-linen-secondary leading-relaxed">
                    {adv.description}
                  </p>

                  {adv.personalNotes && (
                    <div className="p-2.5 rounded-xl bg-linen-variant/60 text-[11px] text-linen-secondary italic">
                      Memory: "{adv.personalNotes}"
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-linen-border/50 mt-3 flex items-center justify-between">
                  <button
                    onClick={() => onToggleComplete(adv.id)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      adv.isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-linen-variant hover:bg-linen-border text-linen-primary border border-linen-border'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    {adv.isCompleted ? 'Accomplished ✓' : 'Mark as Experienced'}
                  </button>
                  <button
                    onClick={() => handleProposeInChat(adv)}
                    className="text-xs text-linen-accent hover:underline font-medium"
                  >
                    Send to Chat →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Custom Bucket List Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-medium text-linen-primary">Add to Shared Bucket List</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-linen-secondary hover:text-linen-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">Adventure / Idea Title</label>
                <input
                  type="text"
                  placeholder="e.g. Weekend pottery workshop in the woods"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">Details & Inspiration</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Find a studio where we can throw mugs on a pottery wheel together..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Energy</label>
                  <select
                    value={newEnergy}
                    onChange={e => setNewEnergy(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-xl border border-linen-border bg-linen-variant/40"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Category</label>
                  <select
                    value={newCat}
                    onChange={e => setNewCat(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-xl border border-linen-border bg-linen-variant/40"
                  >
                    <option value="home">Home</option>
                    <option value="creative">Creative</option>
                    <option value="outdoors">Outdoors</option>
                    <option value="food">Food</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Cost</label>
                  <select
                    value={newCost}
                    onChange={e => setNewCost(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-xl border border-linen-border bg-linen-variant/40"
                  >
                    <option value="Free">Free</option>
                    <option value="$">$</option>
                    <option value="$$">$$</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-linen-border/40">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-linen-secondary hover:text-linen-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90"
                >
                  Save Idea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
