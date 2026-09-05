import React, { useState, useMemo } from 'react';
import { AdventureItem, EnergyTier, AdventureCategory, AdventureSeason } from '../types';
import { 
  Compass, Sparkles, Home, Palette, TreePine, Utensils, CheckCircle2, 
  Plus, Send, Shuffle, DollarSign, X, MapPin, Calendar, Award, 
  Search, Filter, Camera, Heart, BookOpen, Stamp
} from 'lucide-react';

interface AdventuresViewProps {
  adventures: AdventureItem[];
  activeUser: 'user' | 'partner';
  onAddAdventure: (adventure: AdventureItem) => void;
  onToggleComplete: (id: string, notes?: string, photoUrl?: string) => void;
  onSendToChat: (message: string) => void;
}

const CATEGORY_META: Record<AdventureCategory, { label: string; icon: any; color: string }> = {
  home: { label: 'Cozy Sanctuary', icon: Home, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  creative: { label: 'Creative Sparks', icon: Palette, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  outdoors: { label: 'Places to Wander', icon: TreePine, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  food: { label: 'Delicious Feasts', icon: Utensils, color: 'text-rose-600 bg-rose-50 border-rose-200' },
};

const SEASONS: { id: AdventureSeason | 'all'; label: string }[] = [
  { id: 'all', label: '💫 All Seasons' },
  { id: 'spring', label: '🌸 Spring' },
  { id: 'summer', label: '☀️ Summer' },
  { id: 'fall', label: '🍂 Autumn' },
  { id: 'winter', label: '❄️ Winter' },
  { id: 'anytime', label: '✨ Anytime' },
];

function playTickSound(pitch = 600) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (_) {}
}

function playStampSuccessSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // Thump
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.frequency.setValueAtTime(120, now);
    osc1.frequency.exponentialRampToValueAtTime(45, now + 0.2);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(now + 0.3);

    // Chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(528, now + 0.1);
    gain2.gain.setValueAtTime(0.0001, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.18, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 1.0);
  } catch (_) {}
}

export const AdventuresView: React.FC<AdventuresViewProps> = ({
  adventures,
  activeUser,
  onAddAdventure,
  onToggleComplete,
  onSendToChat
}) => {
  const [activeTab, setActiveTab] = useState<'roulette' | 'bucketlist' | 'passport'>('bucketlist');
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyTier | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<AdventureCategory | 'all'>('all');
  const [selectedSeason, setSelectedSeason] = useState<AdventureSeason | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'uncompleted' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Roulette States
  const [currentDraw, setCurrentDraw] = useState<AdventureItem | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [stampingAdventure, setStampingAdventure] = useState<AdventureItem | null>(null);
  const [stampReflection, setStampReflection] = useState('');
  const [stampPhotoUrl, setStampPhotoUrl] = useState('');
  const [proposedToast, setProposedToast] = useState(false);

  // Add Form States
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEnergy, setNewEnergy] = useState<EnergyTier>('medium');
  const [newCat, setNewCat] = useState<AdventureCategory>('outdoors');
  const [newCost, setNewCost] = useState<'$' | '$$' | 'Free'>('Free');
  const [newSeason, setNewSeason] = useState<AdventureSeason>('anytime');
  const [newLocation, setNewLocation] = useState('');

  // Calculations for Passport & Stats
  const completedCount = useMemo(() => adventures.filter(a => a.isCompleted).length, [adventures]);
  const progressPercent = adventures.length > 0 ? Math.round((completedCount / adventures.length) * 100) : 0;

  // Filtered pool for roulette
  const roulettePool = useMemo(() => {
    return adventures.filter(a => !a.isCompleted && (selectedEnergy === 'all' || a.energyTier === selectedEnergy));
  }, [adventures, selectedEnergy]);

  // Filtered list for bucket list view
  const filteredAdventures = useMemo(() => {
    return adventures.filter(a => {
      const matchCat = selectedCategory === 'all' || a.category === selectedCategory;
      const matchSeason = selectedSeason === 'all' || a.season === selectedSeason;
      const matchStatus = 
        statusFilter === 'all' ? true : 
        statusFilter === 'completed' ? a.isCompleted : 
        !a.isCompleted;
      const matchSearch = !searchQuery.trim() || 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.location && a.location.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSeason && matchStatus && matchSearch;
    });
  }, [adventures, selectedCategory, selectedSeason, statusFilter, searchQuery]);

  const handleSpinRoulette = () => {
    if (roulettePool.length === 0) return;
    setIsSpinning(true);
    let count = 0;
    const maxTicks = 12;
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * roulettePool.length);
      setCurrentDraw(roulettePool[randomIdx]);
      playTickSound(500 + count * 25);
      count++;
      if (count >= maxTicks) {
        clearInterval(interval);
        setIsSpinning(false);
        playStampSuccessSound();
      }
    }, 110);
  };

  const handleProposeInChat = (item: AdventureItem) => {
    onSendToChat(`✨ Date Proposal: "${item.title}" — ${item.description} (${item.energyTier.toUpperCase()} Energy • Cost: ${item.estimatedCost}${item.location ? ` • 📍 ${item.location}` : ''})`);
    setProposedToast(true);
    setTimeout(() => setProposedToast(false), 2500);
  };

  const handleOpenStampModal = (item: AdventureItem) => {
    setStampingAdventure(item);
    setStampReflection(item.personalNotes || '');
    setStampPhotoUrl(item.photoUrl || '');
  };

  const handleSaveStamp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stampingAdventure) return;
    playStampSuccessSound();
    onToggleComplete(stampingAdventure.id, stampReflection.trim(), stampPhotoUrl.trim());
    setStampingAdventure(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created: AdventureItem = {
      id: `adv-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || 'A shared dream to experience together.',
      energyTier: newEnergy,
      category: newCat,
      estimatedCost: newCost,
      season: newSeason,
      location: newLocation.trim() || undefined,
      isCompleted: false
    };

    onAddAdventure(created);
    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewLocation('');
  };

  const getEnergyBadge = (tier: EnergyTier) => {
    switch (tier) {
      case 'low':
        return <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">🛋️ Low Energy</span>;
      case 'medium':
        return <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">🎨 Medium Energy</span>;
      case 'high':
        return <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">🚗 High Spontaneous</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="font-serif text-2xl sm:text-3xl font-medium text-linen-primary tracking-tight">
              Shared Wanderlust & Dream Map
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-sans font-medium border border-amber-200">
              Life Bucket List
            </span>
          </div>
          <p className="text-xs sm:text-sm text-linen-secondary mt-1">
            Capture future getaways, micro-adventures, and romantic sparks — stamped into your couple passport.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="self-start sm:self-auto inline-flex items-center px-4 py-2.5 rounded-2xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add to Dream Map
        </button>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center justify-between border-b border-linen-border pb-2">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('bucketlist')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'bucketlist'
                ? 'bg-linen-primary text-linen-surface shadow-xs'
                : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant/60'
            }`}
          >
            🗺️ Dream Map ({adventures.length})
          </button>
          <button
            onClick={() => setActiveTab('roulette')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'roulette'
                ? 'bg-linen-primary text-linen-surface shadow-xs'
                : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant/60'
            }`}
          >
            🎲 Adventure Roulette
          </button>
          <button
            onClick={() => setActiveTab('passport')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center space-x-1.5 ${
              activeTab === 'passport'
                ? 'bg-linen-primary text-linen-surface shadow-xs'
                : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant/60'
            }`}
          >
            <span>🛂 Couple Passport</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/30 text-amber-900 font-semibold">
              {completedCount}
            </span>
          </button>
        </div>

        {/* Mini Stats Bar */}
        <div className="hidden sm:flex items-center space-x-2 text-xs text-linen-secondary">
          <span>{completedCount} of {adventures.length} Lived Together</span>
          <div className="w-16 bg-linen-border rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-600 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="font-mono text-[11px] font-semibold text-linen-primary">{progressPercent}%</span>
        </div>
      </div>

      {/* VIEW 1: DREAM MAP / BUCKET LIST */}
      {activeTab === 'bucketlist' && (
        <div className="space-y-5">
          {/* Filter & Search Bar */}
          <div className="p-4 rounded-3xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-linen-secondary" />
                <input
                  type="text"
                  placeholder="Search shared dreams or locations..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary text-linen-primary"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-1 bg-linen-variant/50 p-1 rounded-xl border border-linen-border text-xs">
                {(['all', 'uncompleted', 'completed'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                      statusFilter === s ? 'bg-linen-surface text-linen-primary font-medium shadow-xs' : 'text-linen-secondary hover:text-linen-primary'
                    }`}
                  >
                    {s === 'uncompleted' ? 'To Experience' : s === 'completed' ? 'Stamped' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-linen-border/40">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-linen-primary text-linen-surface'
                    : 'bg-linen-variant/40 hover:bg-linen-variant text-linen-secondary border border-linen-border/60'
                }`}
              >
                All Categories
              </button>
              {(Object.keys(CATEGORY_META) as AdventureCategory[]).map(cat => {
                const meta = CATEGORY_META[cat];
                const Icon = meta.icon;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`inline-flex items-center space-x-1 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-linen-primary text-linen-surface'
                        : 'bg-linen-surface hover:bg-linen-variant text-linen-secondary border border-linen-border'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid of Dreams */}
          {filteredAdventures.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-linen-border bg-linen-variant/20">
              <Compass className="w-10 h-10 text-linen-secondary/50 mx-auto mb-3" />
              <h4 className="font-serif text-lg font-medium text-linen-primary">No dreams match your filter</h4>
              <p className="text-xs text-linen-secondary mt-1">Try selecting all categories or add a new dream to your map.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90"
              >
                Add New Dream
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredAdventures.map(adv => {
                const catMeta = CATEGORY_META[adv.category];
                const Icon = catMeta.icon;
                return (
                  <div
                    key={adv.id}
                    className={`p-5 rounded-3xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                      adv.isCompleted
                        ? 'border-amber-200/90 bg-gradient-to-br from-amber-50/40 via-linen-surface to-linen-surface shadow-xs'
                        : 'border-linen-border bg-linen-surface hover:border-linen-accent/50 shadow-xs'
                    }`}
                  >
                    {/* Vintage Passport Stamp Imprint Overlay if completed */}
                    {adv.isCompleted && (
                      <div className="absolute top-3 right-3 pointer-events-none transform rotate-12 opacity-85">
                        <div className="border-2 border-dashed border-amber-700/80 rounded-full w-20 h-20 flex flex-col items-center justify-center p-1 text-center bg-amber-50/60 shadow-xs">
                          <span className="text-[7px] font-bold tracking-widest uppercase text-amber-900">PASSPORT</span>
                          <span className="text-[9px] font-black text-amber-800 leading-tight">LIVED</span>
                          <span className="text-[7px] font-mono text-amber-700">{adv.completedDate || 'TOGETHER'}</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center space-x-1 text-[11px] font-medium px-2 py-0.5 rounded-lg border ${catMeta.color}`}>
                          <Icon className="w-3 h-3" />
                          <span>{catMeta.label}</span>
                        </span>
                        {getEnergyBadge(adv.energyTier)}
                        {adv.season && adv.season !== 'anytime' && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-linen-variant text-linen-secondary border border-linen-border">
                            {SEASONS.find(s => s.id === adv.season)?.label}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-linen-secondary ml-auto">{adv.estimatedCost}</span>
                      </div>

                      <div>
                        <h4 className={`font-serif text-lg font-medium text-linen-primary ${adv.isCompleted ? 'text-linen-primary font-semibold' : ''}`}>
                          {adv.title}
                        </h4>
                        {adv.location && (
                          <div className="flex items-center space-x-1 text-xs text-linen-secondary mt-0.5">
                            <MapPin className="w-3 h-3 text-rose-500" />
                            <span>{adv.location}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-linen-secondary leading-relaxed font-sans">
                        {adv.description}
                      </p>

                      {/* Memory & Reflection Card */}
                      {adv.isCompleted && adv.personalNotes && (
                        <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/60 text-xs text-linen-primary italic font-serif">
                          “{adv.personalNotes}”
                        </div>
                      )}

                      {adv.photoUrl && (
                        <div className="rounded-2xl overflow-hidden border border-linen-border h-32 w-full bg-linen-variant">
                          <img src={adv.photoUrl} alt={adv.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-linen-border/50 mt-4 flex items-center justify-between">
                      {adv.isCompleted ? (
                        <button
                          onClick={() => handleOpenStampModal(adv)}
                          className="inline-flex items-center px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Stamp className="w-3.5 h-3.5 mr-1 text-amber-700" />
                          <span>Stamped Memory ✓</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenStampModal(adv)}
                          className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-linen-variant hover:bg-emerald-600 hover:text-white text-linen-primary text-xs font-medium border border-linen-border transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          <span>Mark Accomplished</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleProposeInChat(adv)}
                        className="text-xs text-linen-accent hover:underline font-medium inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Propose in Chat</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ADVENTURE ROULETTE (Surprise Dream Picker) */}
      {activeTab === 'roulette' && (
        <div className="space-y-6">
          <div className="p-4 rounded-3xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
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
                  className={`p-2.5 rounded-2xl border text-xs font-medium transition-all ${
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
          <div className="p-8 rounded-3xl border border-linen-border bg-gradient-to-br from-linen-surface via-linen-surface to-linen-variant/30 shadow-xs flex flex-col items-center text-center space-y-5 min-h-[300px] justify-center relative overflow-hidden">
            {currentDraw ? (
              <div className="space-y-4 max-w-md animate-fade-in">
                <div className="flex items-center justify-center space-x-2">
                  <span className="p-2 rounded-xl bg-linen-variant border border-linen-border text-linen-accent">
                    <Compass className="w-4 h-4" />
                  </span>
                  {getEnergyBadge(currentDraw.energyTier)}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-linen-variant text-linen-secondary font-mono">
                    {currentDraw.estimatedCost}
                  </span>
                </div>

                <h3 className="font-serif text-2xl sm:text-3xl font-medium text-linen-primary">
                  {currentDraw.title}
                </h3>
                {currentDraw.location && (
                  <p className="text-xs text-rose-600 font-medium">
                    📍 {currentDraw.location}
                  </p>
                )}
                <p className="text-xs sm:text-sm text-linen-secondary leading-relaxed font-serif italic">
                  “{currentDraw.description}”
                </p>

                <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => handleProposeInChat(currentDraw)}
                    className="inline-flex items-center px-4 py-2.5 rounded-2xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Propose in Chat
                  </button>

                  <button
                    onClick={handleSpinRoulette}
                    disabled={isSpinning}
                    className="inline-flex items-center px-4 py-2.5 rounded-2xl border border-linen-border bg-linen-variant hover:bg-linen-border text-linen-primary text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5 mr-1.5 text-linen-accent" />
                    Spin Again
                  </button>
                </div>

                {proposedToast && (
                  <p className="text-xs text-emerald-600 font-medium animate-fade-in">
                    ✓ Date proposed directly to encrypted chat!
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4 max-w-sm">
                <div className="w-16 h-16 rounded-3xl bg-linen-variant border border-linen-border mx-auto flex items-center justify-center text-linen-accent shadow-xs">
                  <Compass className="w-8 h-8 animate-spin-slow" />
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-medium text-linen-primary">
                  Ready to spark tonight's adventure?
                </h3>
                <p className="text-xs text-linen-secondary leading-relaxed">
                  Tap the wheel to draw a spontaneous date idea tailored to your mutual energy, taking away the chore of deciding.
                </p>
                <button
                  onClick={handleSpinRoulette}
                  disabled={isSpinning || roulettePool.length === 0}
                  className="inline-flex items-center px-6 py-3 rounded-2xl bg-linen-primary text-linen-surface text-sm font-medium hover:opacity-90 transition-opacity shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Shuffle className="w-4 h-4 mr-2" />
                  {isSpinning ? 'Spinning Destiny...' : 'Spin Adventure Roulette'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: OUR COUPON PASSPORT (Memories & Stamps Gallery) */}
      {activeTab === 'passport' && (
        <div className="space-y-6">
          {/* Passport Cover Header */}
          <div className="rounded-3xl border border-amber-200/90 bg-gradient-to-r from-amber-900 via-stone-900 to-amber-950 p-6 sm:p-8 text-amber-50 shadow-lg relative overflow-hidden">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Stamp className="w-5 h-5 text-amber-300" />
                  <span className="text-xs tracking-widest uppercase font-semibold text-amber-300">Official Couple Passport</span>
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight">
                  Memories Experienced Together
                </h3>
                <p className="text-xs text-amber-200/80 max-w-md">
                  Every stamped dream represents a chapter lived, shared, and preserved in your private sanctuary.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center space-x-4">
                <div className="text-center">
                  <span className="block text-2xl font-serif font-bold text-amber-300">{completedCount}</span>
                  <span className="text-[10px] uppercase tracking-wider text-amber-200">Dreams Lived</span>
                </div>
                <div className="h-8 w-px bg-white/20" />
                <div className="text-center">
                  <span className="block text-2xl font-serif font-bold text-amber-300">{adventures.length - completedCount}</span>
                  <span className="text-[10px] uppercase tracking-wider text-amber-200">Waiting Ahead</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stamped Memories Grid */}
          {adventures.filter(a => a.isCompleted).length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-linen-border bg-linen-surface">
              <Stamp className="w-10 h-10 text-linen-secondary/50 mx-auto mb-3" />
              <h4 className="font-serif text-lg font-medium text-linen-primary">No passport stamps yet</h4>
              <p className="text-xs text-linen-secondary mt-1">Check off an adventure in your Dream Map to stamp your first shared accomplishment!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {adventures.filter(a => a.isCompleted).map(item => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-amber-200/80 bg-linen-surface p-5 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Visual Golden Stamp */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                      ★ Stamped Chapter
                    </span>
                    <span className="text-xs font-mono text-linen-secondary">{item.completedDate || 'Completed'}</span>
                  </div>

                  {item.photoUrl && (
                    <div className="h-36 rounded-2xl overflow-hidden border border-linen-border bg-linen-variant">
                      <img src={item.photoUrl} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <h4 className="font-serif text-base font-semibold text-linen-primary">{item.title}</h4>
                    {item.location && (
                      <p className="text-[11px] text-rose-600 font-medium">📍 {item.location}</p>
                    )}
                    <p className="text-xs text-linen-secondary line-clamp-2">{item.description}</p>
                  </div>

                  {item.personalNotes && (
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/50 text-xs italic font-serif text-linen-primary">
                      “{item.personalNotes}”
                    </div>
                  )}

                  <div className="pt-2 border-t border-linen-border/40 flex justify-end">
                    <button
                      onClick={() => handleOpenStampModal(item)}
                      className="text-[11px] text-amber-800 hover:underline font-medium inline-flex items-center space-x-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Edit Photo & Reflection</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: STAMP CELEBRATION & MEMORY INPUT */}
      {stampingAdventure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Stamp className="w-5 h-5 text-amber-700" />
                <h3 className="font-serif text-lg font-medium text-linen-primary">Couple Passport Seal</h3>
              </div>
              <button onClick={() => setStampingAdventure(null)} className="p-1.5 rounded-lg text-linen-secondary hover:text-linen-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-2">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-amber-700 mx-auto flex flex-col items-center justify-center text-amber-800 animate-bounce">
                <span className="text-[7px] font-bold tracking-widest">OFFICIAL</span>
                <span className="text-[10px] font-black">LIVED</span>
                <span className="text-[7px]">TOGETHER</span>
              </div>
              <h4 className="font-serif text-base font-semibold text-amber-900">{stampingAdventure.title}</h4>
              <p className="text-xs text-amber-800/80">Mark this dream accomplished in your shared history.</p>
            </div>

            <form onSubmit={handleSaveStamp} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">
                  What made this moment special? (Reflection)
                </label>
                <textarea
                  rows={3}
                  value={stampReflection}
                  onChange={e => setStampReflection(e.target.value)}
                  placeholder="e.g. We laughed so hard when the rain started, and had hot cocoa by the radiator..."
                  className="w-full text-xs p-3 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">
                  Memory Photo URL (Optional)
                </label>
                <input
                  type="url"
                  value={stampPhotoUrl}
                  onChange={e => setStampPhotoUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-linen-border/50">
                <button
                  type="button"
                  onClick={() => setStampingAdventure(null)}
                  className="px-4 py-2 text-xs text-linen-secondary hover:text-linen-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-md transition-colors inline-flex items-center space-x-1.5"
                >
                  <Stamp className="w-3.5 h-3.5" />
                  <span>Stamp into Passport</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD CUSTOM DREAM */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Compass className="w-5 h-5 text-linen-accent" />
                <h3 className="font-serif text-lg font-medium text-linen-primary">Add to Dream Map</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-linen-secondary hover:text-linen-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">Dream / Adventure Title</label>
                <input
                  type="text"
                  placeholder="e.g. Rent a lakeside glass cabin for a weekend"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">Destination / Location (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Lake Como, Italy or Living Room"
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">Details & Shared Inspiration</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Wake up to misty mountain views, sip pour-over coffee, read books on the deck..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Category</label>
                  <select
                    value={newCat}
                    onChange={e => setNewCat(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-xl border border-linen-border bg-linen-variant/30"
                  >
                    <option value="outdoors">🌲 Places to Wander</option>
                    <option value="home">🏡 Cozy Sanctuary</option>
                    <option value="creative">🎨 Creative Sparks</option>
                    <option value="food">🍳 Delicious Feasts</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Target Season</label>
                  <select
                    value={newSeason}
                    onChange={e => setNewSeason(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-xl border border-linen-border bg-linen-variant/30"
                  >
                    <option value="anytime">✨ Anytime</option>
                    <option value="spring">🌸 Spring</option>
                    <option value="summer">☀️ Summer</option>
                    <option value="fall">🍂 Autumn</option>
                    <option value="winter">❄️ Winter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Energy</label>
                  <select
                    value={newEnergy}
                    onChange={e => setNewEnergy(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-xl border border-linen-border bg-linen-variant/30"
                  >
                    <option value="low">🛋️ Low Energy</option>
                    <option value="medium">🎨 Medium Energy</option>
                    <option value="high">🚗 High Energy</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Cost</label>
                  <select
                    value={newCost}
                    onChange={e => setNewCost(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-xl border border-linen-border bg-linen-variant/30"
                  >
                    <option value="Free">Free</option>
                    <option value="$">$ (Budget friendly)</option>
                    <option value="$$">$$ (Special date)</option>
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
                  className="px-4 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  Save to Dream Map
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
