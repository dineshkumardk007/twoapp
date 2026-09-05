import React, { useState } from 'react';
import { HearthGardenState, GardenBlossom, BlossomType } from '../types';
import { HearthGardenCanvas, playWaterDropSound, playSunlightChime, playBlossomPopSound } from '../components/HearthGardenCanvas';
import { Sprout, Droplets, Sun, Heart, Sparkles, Scissors, Clock, Plus, X, MessageSquare, History, ShieldCheck } from 'lucide-react';

interface HearthGardenViewProps {
  garden: HearthGardenState;
  activeUser: 'user' | 'partner';
  onUpdateGarden: (updated: HearthGardenState) => void;
  onSendToChat?: (message: string) => void;
}

export const HearthGardenView: React.FC<HearthGardenViewProps> = ({
  garden,
  activeUser,
  onUpdateGarden,
  onSendToChat
}) => {
  const [activeTab, setActiveTab] = useState<'blossoms' | 'chronicle'>('blossoms');
  const [isWatering, setIsWatering] = useState(false);
  const [isSunlight, setIsSunlight] = useState(false);
  const [showSproutModal, setShowSproutModal] = useState(false);

  // Sprout form state
  const [blossomType, setBlossomType] = useState<BlossomType>('cherry');
  const [blossomNote, setBlossomNote] = useState('');

  const handleWater = () => {
    playWaterDropSound();
    setIsWatering(true);
    setTimeout(() => setIsWatering(false), 1400);

    const newWater = Math.min(100, garden.waterLevel + 20);
    const newVitality = Math.min(100, garden.vitality + 10);
    const authorName = activeUser === 'user' ? 'You' : 'Partner';

    // Growth calculation
    const newTotalWaterings = garden.totalWaterings + 1;
    let newLevel = garden.level;
    let newStageName = garden.stageName;

    if (newTotalWaterings >= 25 && garden.level < 5) {
      newLevel = 5;
      newStageName = 'Flourishing Hearth Cedar Bonsai';
    } else if (newTotalWaterings >= 18 && garden.level < 4) {
      newLevel = 4;
      newStageName = 'Graceful Flowering Maple Bonsai';
    }

    const updated: HearthGardenState = {
      ...garden,
      level: newLevel,
      stageName: newStageName,
      waterLevel: newWater,
      vitality: newVitality,
      isDormant: false,
      lastNourishedAt: 'Just now',
      totalWaterings: newTotalWaterings,
      growthLog: [
        {
          id: `log-${Date.now()}`,
          event: `${authorName} watered the bonsai with morning dew. Vitality raised to ${newVitality}%.`,
          timestamp: 'Just now'
        },
        ...garden.growthLog
      ]
    };

    onUpdateGarden(updated);
  };

  const handleSunlight = () => {
    playSunlightChime();
    setIsSunlight(true);
    setTimeout(() => setIsSunlight(false), 1400);

    const newSunlight = Math.min(100, garden.sunlightLevel + 20);
    const newVitality = Math.min(100, garden.vitality + 8);
    const authorName = activeUser === 'user' ? 'You' : 'Partner';

    const updated: HearthGardenState = {
      ...garden,
      sunlightLevel: newSunlight,
      vitality: newVitality,
      isDormant: false,
      lastNourishedAt: 'Just now',
      totalSunbaths: garden.totalSunbaths + 1,
      growthLog: [
        {
          id: `log-${Date.now()}`,
          event: `${authorName} opened the window shutters to bask the canopy in warm sunlight.`,
          timestamp: 'Just now'
        },
        ...garden.growthLog
      ]
    };

    onUpdateGarden(updated);
  };

  const handlePrune = () => {
    playWaterDropSound();
    const authorName = activeUser === 'user' ? 'You' : 'Partner';

    const updated: HearthGardenState = {
      ...garden,
      vitality: Math.min(100, garden.vitality + 5),
      lastNourishedAt: 'Just now',
      growthLog: [
        {
          id: `log-${Date.now()}`,
          event: `${authorName} mindfully pruned old twigs and cleared mental noise.`,
          timestamp: 'Just now'
        },
        ...garden.growthLog
      ]
    };

    onUpdateGarden(updated);
  };

  const handleCreateBlossom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blossomNote.trim()) return;

    playBlossomPopSound();

    // Randomize pleasing coordinates within the foliage crown
    // x: 15-85, y: 15-70
    const xPercent = 18 + Math.floor(Math.random() * 64);
    const yPercent = 16 + Math.floor(Math.random() * 52);

    const authorName = activeUser === 'user' ? 'You' : 'Partner';

    const newBlossom: GardenBlossom = {
      id: `blossom-${Date.now()}`,
      type: blossomType,
      note: blossomNote.trim(),
      sproutedBy: activeUser,
      sproutedByName: authorName,
      sproutedAt: 'Just now',
      xPercent,
      yPercent
    };

    const updated: HearthGardenState = {
      ...garden,
      vitality: Math.min(100, garden.vitality + 15),
      isDormant: false,
      blossoms: [newBlossom, ...garden.blossoms],
      growthLog: [
        {
          id: `log-${Date.now()}`,
          event: `${authorName} sprouted a ${blossomType.replace('_', ' ')} blossom: "${blossomNote.trim()}".`,
          timestamp: 'Just now'
        },
        ...garden.growthLog
      ]
    };

    onUpdateGarden(updated);
    setShowSproutModal(false);
    setBlossomNote('');

    if (onSendToChat) {
      onSendToChat(`🌸 I sprouted a new ${blossomType.replace('_', ' ')} blossom in our Hearth Garden: "${blossomNote.trim()}"`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-linen-surface rounded-2xl p-6 border border-linen-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 mb-2">
            <Sprout className="w-3.5 h-3.5 text-emerald-600" />
            <span>Living Hearth Garden</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-linen-primary font-medium">
            The Digital Bonsai
          </h1>
          <p className="text-sm text-linen-secondary mt-1 max-w-xl">
            A botanical companion that thrives on your shared care. Never wilts or induces guilt — it gently enters winter slumber during busy weeks, and blooms the moment you return.
          </p>
        </div>

        <button
          onClick={() => setShowSproutModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-medium text-sm shadow-sm transition-all transform active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Sprout a Blossom</span>
        </button>
      </div>

      {/* Bonsai Canvas */}
      <HearthGardenCanvas
        garden={garden}
        activeUser={activeUser}
        isWateringAnimation={isWatering}
        isSunlightAnimation={isSunlight}
      />

      {/* Interactive Care Actions Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={handleWater}
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-linen-surface border border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50/50 transition-all shadow-xs group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 mb-2 group-hover:scale-110 transition-transform">
            <Droplets className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-linen-primary">Water with Love</span>
          <span className="text-[11px] text-linen-secondary mt-0.5">+20% Hydration</span>
        </button>

        <button
          onClick={handleSunlight}
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-linen-surface border border-amber-200 hover:border-amber-400 hover:bg-amber-50/50 transition-all shadow-xs group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-2 group-hover:scale-110 transition-transform">
            <Sun className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-linen-primary">Bask in Sunlight</span>
          <span className="text-[11px] text-linen-secondary mt-0.5">+20% Warmth</span>
        </button>

        <button
          onClick={() => setShowSproutModal(true)}
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-linen-surface border border-pink-200 hover:border-pink-400 hover:bg-pink-50/50 transition-all shadow-xs group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 mb-2 group-hover:scale-110 transition-transform">
            <Heart className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-linen-primary">Sprout Blossom</span>
          <span className="text-[11px] text-linen-secondary mt-0.5">Dedicate a flower</span>
        </button>

        <button
          onClick={handlePrune}
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-linen-surface border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all shadow-xs group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2 group-hover:scale-110 transition-transform">
            <Scissors className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-linen-primary">Gentle Pruning</span>
          <span className="text-[11px] text-linen-secondary mt-0.5">Clear mental noise</span>
        </button>
      </div>

      {/* Vitality Metrics Strip */}
      <div className="bg-linen-surface rounded-2xl p-5 border border-linen-border grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <span className="text-xs text-linen-secondary block">Tree Vitality</span>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex-1 bg-linen-variant rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${garden.vitality}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-linen-primary">{garden.vitality}%</span>
          </div>
        </div>

        <div>
          <span className="text-xs text-linen-secondary block">Hydration Level</span>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex-1 bg-linen-variant rounded-full h-2 overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${garden.waterLevel}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-linen-primary">{garden.waterLevel}%</span>
          </div>
        </div>

        <div>
          <span className="text-xs text-linen-secondary block">Sunlight Warmth</span>
          <div className="flex items-center space-x-2 mt-1">
            <div className="flex-1 bg-linen-variant rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${garden.sunlightLevel}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-linen-primary">{garden.sunlightLevel}%</span>
          </div>
        </div>

        <div>
          <span className="text-xs text-linen-secondary block">Canopy Blossoms</span>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-lg font-serif font-medium text-linen-primary">{garden.blossoms.length}</span>
            <span className="text-xs text-linen-secondary">blooming flowers</span>
          </div>
        </div>
      </div>

      {/* Tabs: Blossoms vs Growth Chronicle */}
      <div className="border-b border-linen-border flex items-center space-x-4">
        <button
          onClick={() => setActiveTab('blossoms')}
          className={`pb-2.5 text-sm font-medium border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'blossoms'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-linen-secondary hover:text-linen-primary'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Canopy Blossoms ({garden.blossoms.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('chronicle')}
          className={`pb-2.5 text-sm font-medium border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'chronicle'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-linen-secondary hover:text-linen-primary'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Growth Chronicle</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'blossoms' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {garden.blossoms.map(blossom => (
            <div
              key={blossom.id}
              className="p-4 rounded-2xl border border-linen-border bg-linen-surface shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-linen-secondary mb-2">
                  <span className="inline-flex items-center font-medium capitalize text-pink-700 bg-pink-50 px-2 py-0.5 rounded-md border border-pink-200">
                    <Heart className="w-3 h-3 mr-1 fill-pink-500 text-pink-500" />
                    {blossom.type.replace('_', ' ')} Blossom
                  </span>
                  <span>{blossom.sproutedAt}</span>
                </div>
                <p className="font-serif text-sm text-linen-primary italic leading-relaxed mb-3">
                  “{blossom.note}”
                </p>
              </div>

              <div className="text-[11px] text-linen-secondary pt-2 border-t border-linen-border/60 flex items-center justify-between">
                <span>Dedicated by {blossom.sproutedByName}</span>
                {onSendToChat && (
                  <button
                    onClick={() => onSendToChat(`🌸 Remembering this blossom: "${blossom.note}"`)}
                    className="p-1 hover:bg-linen-variant rounded-md text-linen-secondary hover:text-linen-primary"
                    title="Send to chat"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-linen-surface rounded-2xl p-5 border border-linen-border space-y-3">
          {garden.growthLog.map(log => (
            <div key={log.id} className="flex items-start space-x-3 text-xs pb-3 border-b border-linen-border/40 last:border-none last:pb-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <div className="flex-1">
                <p className="text-linen-primary">{log.event}</p>
                <span className="text-[11px] text-linen-secondary mt-0.5 block">{log.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sprout Blossom Modal */}
      {showSproutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-linen-surface rounded-2xl max-w-md w-full border border-linen-border shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-linen-border flex items-center justify-between bg-linen-variant/20">
              <div className="flex items-center space-x-2">
                <Heart className="w-5 h-5 text-pink-600" />
                <h3 className="font-serif text-lg font-medium text-linen-primary">
                  Sprout a Blossom on the Bonsai
                </h3>
              </div>
              <button
                onClick={() => setShowSproutModal(false)}
                className="p-1.5 text-linen-secondary hover:text-linen-primary rounded-lg hover:bg-linen-variant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBlossom} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1.5">
                  Blossom Species
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'cherry', label: '🌸 Cherry Blossom', desc: 'Tenderness & new beginnings' },
                    { id: 'jasmine', label: '⭐ Jasmine Star', desc: 'Quiet, soothing nighttime care' },
                    { id: 'lotus', label: '🪷 Lilac Lotus', desc: 'Overcoming hard storms together' },
                    { id: 'golden_leaf', label: '🍂 Golden Leaf', desc: 'Milestones & gratitude' }
                  ].map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBlossomType(b.id as BlossomType)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        blossomType === b.id
                          ? 'border-pink-500 bg-pink-50 text-pink-950 font-medium ring-1 ring-pink-500'
                          : 'border-linen-border bg-linen-variant/30 text-linen-primary hover:bg-linen-variant'
                      }`}
                    >
                      <div className="text-xs font-medium">{b.label}</div>
                      <div className="text-[10px] text-linen-secondary mt-0.5">{b.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Heartfelt Dedication Note *
                </label>
                <textarea
                  required
                  rows={3}
                  value={blossomNote}
                  onChange={e => setBlossomNote(e.target.value)}
                  placeholder="e.g. For making me tea when I couldn't get out of bed..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="pt-3 border-t border-linen-border flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSproutModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-linen-secondary hover:text-linen-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-medium shadow-xs transition-transform active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Bloom on Tree</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
