import React, { useState } from 'react';
import { Sparkles, Star, Plus, X, Heart, Eye, Filter, Info, Shield } from 'lucide-react';
import { GratitudeStar, StarCategory } from '../types';

interface ConstellationViewProps {
  stars: GratitudeStar[];
  onAddStar: (star: GratitudeStar) => void;
  activeUser: 'user' | 'partner';
}

const CATEGORIES: { id: StarCategory; label: string; color: string; stroke: string; emoji: string }[] = [
  { id: 'mornings', label: 'Gentle Mornings', color: '#f59e0b', stroke: 'stroke-amber-400/50', emoji: '☕' },
  { id: 'support', label: 'Unspoken Support', color: '#10b981', stroke: 'stroke-emerald-400/50', emoji: '🛡️' },
  { id: 'laughter', label: 'Laughter & Silliness', color: '#6366f1', stroke: 'stroke-indigo-400/50', emoji: '✨' },
  { id: 'affection', label: 'Tender Affection', color: '#f43f5e', stroke: 'stroke-rose-400/50', emoji: '🌸' },
  { id: 'visions', label: 'Shared Visions', color: '#8b5cf6', stroke: 'stroke-purple-400/50', emoji: '🌌' },
];

export const ConstellationView: React.FC<ConstellationViewProps> = ({
  stars,
  onAddStar,
  activeUser
}) => {
  const [selectedStar, setSelectedStar] = useState<GratitudeStar | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<StarCategory | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<StarCategory>('mornings');
  const [magnitude, setMagnitude] = useState<number>(2);

  const filteredStars = selectedCategory === 'all'
    ? stars
    : stars.filter(s => s.category === selectedCategory);

  // Group stars by category to draw connecting constellation lines
  const starsByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = stars.filter(s => s.category === cat.id);
    return acc;
  }, {} as Record<StarCategory, GratitudeStar[]>);

  const handleCreateStar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;

    // Place star organically with safe margins (10% to 90%)
    const x = Math.floor(12 + Math.random() * 76);
    const y = Math.floor(15 + Math.random() * 70);

    const newStar: GratitudeStar = {
      id: Date.now().toString(),
      authorId: activeUser,
      authorName: activeUser === 'user' ? 'You' : 'Partner',
      note: note.trim(),
      category,
      x,
      y,
      magnitude,
      createdAt: new Date().toISOString()
    };

    onAddStar(newStar);
    setNote('');
    setShowCreateModal(false);
    setSelectedStar(newStar);
  };

  return (
    <div className="space-y-4">
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-900/90 text-stone-100 p-5 rounded-3xl border border-stone-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center text-indigo-300">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-medium tracking-tight flex items-center space-x-2 text-stone-100">
              <span>The Gratitude Constellation</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-sans">
                {stars.length} Stars Shining
              </span>
            </h2>
            <p className="text-xs text-stone-400">
              Every small appreciation forms a star in your shared celestial night sky.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-900/40 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Plant a Gratitude Star</span>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap font-medium ${
            selectedCategory === 'all'
              ? 'bg-stone-100 text-stone-900 border-stone-100'
              : 'bg-stone-900/80 text-stone-400 border-stone-800 hover:text-stone-200'
          }`}
        >
          🌌 All Constellations
        </button>
        {CATEGORIES.map(cat => {
          const isSelected = selectedCategory === cat.id;
          const count = (starsByCategory[cat.id] || []).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap font-medium flex items-center space-x-1.5 ${
                isSelected
                  ? 'bg-stone-800 text-stone-100 border-stone-600 shadow-xs'
                  : 'bg-stone-900/80 text-stone-400 border-stone-800 hover:text-stone-200'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-800/80 text-stone-400">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* The Celestial Sky Canvas */}
      <div className="relative w-full h-[540px] rounded-3xl border border-stone-800/90 overflow-hidden bg-gradient-to-b from-[#070913] via-[#0d1224] to-[#080b18] shadow-2xl select-none">
        {/* Subtle Background Nebula Glows */}
        <div className="absolute -top-12 -left-12 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-16 w-96 h-96 rounded-full bg-rose-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 left-1/3 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Ambient Distant Stars (Random organic dots) */}
        {[
          { top: '12%', left: '18%', op: '0.4' },
          { top: '24%', left: '72%', op: '0.6' },
          { top: '35%', left: '44%', op: '0.3' },
          { top: '68%', left: '15%', op: '0.5' },
          { top: '82%', left: '84%', op: '0.4' },
          { top: '15%', left: '88%', op: '0.3' },
          { top: '55%', left: '60%', op: '0.5' },
          { top: '78%', left: '38%', op: '0.6' },
        ].map((bgStar, idx) => (
          <div
            key={idx}
            className="absolute w-1 h-1 rounded-full bg-stone-300 animate-pulse"
            style={{
              top: bgStar.top,
              left: bgStar.left,
              opacity: bgStar.op,
              animationDuration: `${3 + (idx % 4)}s`
            }}
          />
        ))}

        {/* SVG Constellation Connecting Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {CATEGORIES.map(cat => {
            if (selectedCategory !== 'all' && selectedCategory !== cat.id) return null;
            const catStars = starsByCategory[cat.id] || [];
            if (catStars.length < 2) return null;

            return catStars.map((star, idx) => {
              if (idx === 0) return null;
              const prev = catStars[idx - 1];
              return (
                <line
                  key={`${prev.id}-${star.id}`}
                  x1={`${prev.x}%`}
                  y1={`${prev.y}%`}
                  x2={`${star.x}%`}
                  y2={`${star.y}%`}
                  stroke={cat.color}
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                  strokeOpacity="0.45"
                />
              );
            });
          })}
        </svg>

        {/* User Gratitude Stars */}
        {filteredStars.map(star => {
          const catMeta = CATEGORIES.find(c => c.id === star.category) || CATEGORIES[0];
          const isSelected = selectedStar?.id === star.id;
          const starSize = star.magnitude === 3 ? 'w-5 h-5' : star.magnitude === 2 ? 'w-4 h-4' : 'w-3 h-3';

          return (
            <div
              key={star.id}
              onClick={() => setSelectedStar(star)}
              className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 group z-20"
              style={{ left: `${star.x}%`, top: `${star.y}%` }}
            >
              {/* Outer Pulsing Aura */}
              <div
                className={`absolute inset-0 rounded-full transition-all duration-500 blur-sm pointer-events-none ${
                  isSelected ? 'scale-250 opacity-90' : 'scale-150 opacity-40 group-hover:opacity-80 group-hover:scale-200'
                }`}
                style={{ backgroundColor: catMeta.color }}
              />

              {/* Core Star Glyph */}
              <div
                className={`relative rounded-full flex items-center justify-center transition-transform duration-300 ${starSize} ${
                  isSelected ? 'scale-125' : 'group-hover:scale-125'
                }`}
                style={{ color: catMeta.color }}
              >
                <Star className="w-full h-full fill-current" />
              </div>

              {/* Gentle Floating Name Tooltip on hover */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2.5 py-1 rounded-lg bg-stone-900/95 border border-stone-700/80 text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl flex items-center space-x-1">
                <span>{catMeta.emoji}</span>
                <span className="truncate max-w-[120px]">{star.note}</span>
              </div>
            </div>
          );
        })}

        {/* Inspection Card Drawer (Bottom-left overlay) */}
        {selectedStar && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm z-30 bg-stone-900/95 border border-stone-700/80 rounded-3xl p-5 shadow-2xl backdrop-blur-xl animate-fade-in text-stone-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xl">
                  {CATEGORIES.find(c => c.id === selectedStar.category)?.emoji}
                </span>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                    {CATEGORIES.find(c => c.id === selectedStar.category)?.label}
                  </span>
                  <div className="text-xs text-stone-400">
                    {selectedStar.authorName} • {new Date(selectedStar.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStar(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-3 font-serif text-sm sm:text-base text-stone-100 leading-relaxed italic">
              “{selectedStar.note}”
            </p>

            <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
              <span className="flex items-center space-x-1">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span>Zero-Knowledge Starlight</span>
              </span>
              <span className="font-mono text-stone-400">
                Mag {selectedStar.magnitude}.0
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Plant a Star Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-stone-900 text-stone-100 border border-stone-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-serif text-lg font-medium text-stone-100">
                  Plant a Gratitude Star
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStar} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
                  Constellation Cluster
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-medium flex items-center space-x-2 transition-all ${
                        category === cat.id
                          ? 'border-indigo-500 bg-indigo-950/40 text-stone-100'
                          : 'border-stone-800 bg-stone-800/40 text-stone-400 hover:bg-stone-800'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
                  Your Gratitude Note
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What small, beautiful thing did you appreciate today?"
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-800 border border-stone-700 text-stone-100 placeholder-stone-400 text-sm focus:outline-hidden focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
                  Starlight Radiance
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { mag: 1, label: 'Gentle Glow' },
                    { mag: 2, label: 'Radiant Star' },
                    { mag: 3, label: 'Supernova' },
                  ].map(m => (
                    <button
                      key={m.mag}
                      type="button"
                      onClick={() => setMagnitude(m.mag)}
                      className={`py-2 rounded-xl border text-xs font-medium text-center transition-all ${
                        magnitude === m.mag
                          ? 'border-indigo-500 bg-indigo-950/40 text-stone-100'
                          : 'border-stone-800 bg-stone-800/40 text-stone-400 hover:bg-stone-800'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-stone-400 hover:text-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-900/30 cursor-pointer"
                >
                  Illuminate in Sky
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
