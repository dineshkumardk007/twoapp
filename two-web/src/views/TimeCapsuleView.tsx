import React, { useState, useEffect, useMemo } from 'react';
import { TimeCapsuleItem, CapsuleSealType } from '../types';
import { 
  Hourglass, Lock, Unlock, Key, Sparkles, Heart, Flame, Calendar, 
  Clock, Plus, X, Image as ImageIcon, Send, ShieldCheck, CheckCircle2, 
  Eye, EyeOff
} from 'lucide-react';

interface TimeCapsuleViewProps {
  capsules: TimeCapsuleItem[];
  activeUser: 'user' | 'partner';
  onAddCapsule: (capsule: TimeCapsuleItem) => void;
  onOpenCapsule: (capsuleId: string) => void;
  onSendToChat?: (message: string) => void;
}

const SEAL_META: Record<CapsuleSealType, { name: string; emoji: string; icon: any; color: string; desc: string }> = {
  gold_key: {
    name: 'Golden Key of Eternity',
    emoji: '🗝️',
    icon: Key,
    color: 'border-amber-400/80 bg-amber-500/10 text-amber-300',
    desc: 'Classic antique key sealing a momentous anniversary promise'
  },
  wax_crest: {
    name: 'Crimson Wax Seal',
    emoji: '🕯️',
    icon: Flame,
    color: 'border-rose-500/80 bg-rose-500/10 text-rose-300',
    desc: 'Hand-stamped warm sealing wax holding an intimate epistolary confession'
  },
  starlight: {
    name: 'Celestial Starlight',
    emoji: '✨',
    icon: Sparkles,
    color: 'border-indigo-400/80 bg-indigo-500/10 text-indigo-300',
    desc: 'Starlit celestial cipher locked until the constellations align'
  },
  heart_lock: {
    name: 'Sacred Heart Padlock',
    emoji: '💖',
    icon: Heart,
    color: 'border-pink-400/80 bg-pink-500/10 text-pink-300',
    desc: 'Unbreakable relational lock honoring our tender devotion'
  }
};

function playUnsealChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonic arpeggio (C# minor / 528Hz Solfeggio sequence)
    [528, 660, 792, 1056].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.12;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.8);
    });
  } catch (_) {}
}

export const TimeCapsuleView: React.FC<TimeCapsuleViewProps> = ({
  capsules,
  activeUser,
  onAddCapsule,
  onOpenCapsule,
  onSendToChat
}) => {
  const [activeTab, setActiveTab] = useState<'locked' | 'unsealed'>('locked');
  const [showAddModal, setShowAddModal] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const [readingCapsule, setReadingCapsule] = useState<TimeCapsuleItem | null>(null);

  // Form States
  const [newTitle, setNewTitle] = useState('');
  const [newTeaser, setNewTeaser] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newUnlockDate, setNewUnlockDate] = useState(() => {
    // Default 6 months from now
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 16);
  });
  const [newSeal, setNewSeal] = useState<CapsuleSealType>('gold_key');
  const [newPhotoUrls, setNewPhotoUrls] = useState('');

  // Live timer tick every second for precise countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const lockedCapsules = useMemo(() => {
    return capsules.filter(c => !c.isOpened);
  }, [capsules]);

  const unsealedCapsules = useMemo(() => {
    return capsules.filter(c => c.isOpened);
  }, [capsules]);

  const calculateTimeRemaining = (unlockAt: number) => {
    const diff = unlockAt - now;
    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  };

  const handleUnseal = (capsule: TimeCapsuleItem) => {
    playUnsealChime();
    onOpenCapsule(capsule.id);
    setReadingCapsule({ ...capsule, isOpened: true });
    if (onSendToChat) {
      onSendToChat(`⏳ An encrypted Time Capsule has just reached its unlock date: "${capsule.title}" is now unsealed! 🗝️✨`);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !newUnlockDate) return;

    const unlockMs = new Date(newUnlockDate).getTime();
    const formatted = new Date(newUnlockDate).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const photos = newPhotoUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);

    const created: TimeCapsuleItem = {
      id: `capsule-${Date.now()}`,
      title: newTitle.trim(),
      teaserHint: newTeaser.trim() || 'A secret love message sealed until the right moment.',
      authorId: activeUser,
      authorName: activeUser === 'user' ? 'You' : 'Partner',
      createdAt: 'Just now',
      unlockAt: unlockMs,
      unlockDateFormatted: formatted,
      sealType: newSeal,
      content: newContent.trim(),
      photoUrls: photos,
      isOpened: false
    };

    onAddCapsule(created);
    setShowAddModal(false);
    setNewTitle('');
    setNewTeaser('');
    setNewContent('');
    setNewPhotoUrls('');

    if (onSendToChat) {
      onSendToChat(`⏳ Sealed a new Time Capsule: "${created.title}". Locked until ${formatted} with the ${SEAL_META[created.sealType].name}. 🗝️`);
    }
  };

  const handlePresetDate = (monthsAhead: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthsAhead);
    setNewUnlockDate(d.toISOString().slice(0, 16));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="font-serif text-2xl sm:text-3xl font-medium text-linen-primary tracking-tight">
              Future Time Capsule Vault
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 font-sans font-medium border border-indigo-200">
              Locked Anniversary Vault
            </span>
          </div>
          <p className="text-xs sm:text-sm text-linen-secondary mt-1">
            Seal letters, vows, and photo memories with a cryptographic lock until your next anniversary or future date.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="self-start sm:self-auto inline-flex items-center px-4 py-2.5 rounded-2xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Seal New Capsule
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-linen-border pb-2">
        <button
          onClick={() => setActiveTab('locked')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center space-x-2 ${
            activeTab === 'locked'
              ? 'bg-linen-primary text-linen-surface shadow-xs'
              : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant/60'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Locked Vaults ({lockedCapsules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('unsealed')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center space-x-2 ${
            activeTab === 'unsealed'
              ? 'bg-linen-primary text-linen-surface shadow-xs'
              : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant/60'
          }`}
        >
          <Unlock className="w-3.5 h-3.5" />
          <span>Unsealed Archive ({unsealedCapsules.length})</span>
        </button>
      </div>

      {/* TAB 1: LOCKED TIME CAPSULES */}
      {activeTab === 'locked' && (
        <div className="space-y-5">
          {lockedCapsules.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-linen-border bg-linen-surface">
              <Hourglass className="w-12 h-12 text-linen-secondary/40 mx-auto mb-3" />
              <h3 className="font-serif text-xl font-medium text-linen-primary">No locked time capsules yet</h3>
              <p className="text-xs text-linen-secondary mt-1 max-w-sm mx-auto">
                Write a secret note or anniversary promise to be opened together in the future.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-5 py-2.5 rounded-2xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
              >
                Seal Your First Capsule
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {lockedCapsules.map((capsule) => {
                const remaining = calculateTimeRemaining(capsule.unlockAt);
                const isReadyToOpen = remaining === null;
                const seal = SEAL_META[capsule.sealType];
                const SealIcon = seal.icon;

                return (
                  <div
                    key={capsule.id}
                    className="rounded-3xl border border-stone-800/80 bg-gradient-to-br from-stone-900 via-stone-950 to-neutral-950 p-6 text-stone-100 shadow-xl flex flex-col justify-between relative overflow-hidden group"
                  >
                    {/* Atmospheric Starlight Glow */}
                    <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="space-y-4 relative z-10">
                      {/* Seal Badge & Status */}
                      <div className="flex items-center justify-between">
                        <div className={`inline-flex items-center space-x-1.5 text-xs font-medium px-3 py-1 rounded-xl border ${seal.color}`}>
                          <SealIcon className="w-3.5 h-3.5" />
                          <span>{seal.name}</span>
                        </div>
                        <span className="text-[11px] font-mono text-stone-400">
                          {isReadyToOpen ? '🔓 Ready to Unseal!' : `Target: ${capsule.unlockDateFormatted}`}
                        </span>
                      </div>

                      {/* Title & Author */}
                      <div>
                        <h3 className="font-serif text-xl sm:text-2xl font-medium text-amber-100 leading-snug">
                          {capsule.title}
                        </h3>
                        <p className="text-xs text-stone-400 mt-1">
                          Sealed by <strong className="text-stone-300">{capsule.authorName}</strong> • {capsule.createdAt}
                        </p>
                      </div>

                      {/* Teaser Hint */}
                      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-stone-300 italic font-serif">
                        “{capsule.teaserHint}”
                      </div>

                      {/* Countdown Timer Display */}
                      <div className="p-4 rounded-2xl bg-black/40 border border-stone-800 flex items-center justify-around text-center">
                        {isReadyToOpen ? (
                          <div className="py-2 text-center text-amber-300 animate-pulse">
                            <Sparkles className="w-6 h-6 mx-auto mb-1 text-amber-400" />
                            <span className="font-serif text-lg font-semibold">The Hour Has Arrived</span>
                            <p className="text-[11px] text-stone-300">Tap below to break the seal and reveal the message.</p>
                          </div>
                        ) : (
                          <>
                            <div>
                              <span className="block text-2xl sm:text-3xl font-mono font-bold text-amber-300">{remaining.days}</span>
                              <span className="text-[10px] tracking-wider uppercase text-stone-400">Days</span>
                            </div>
                            <span className="text-stone-600 text-xl font-mono">:</span>
                            <div>
                              <span className="block text-2xl sm:text-3xl font-mono font-bold text-amber-300">{String(remaining.hours).padStart(2, '0')}</span>
                              <span className="text-[10px] tracking-wider uppercase text-stone-400">Hours</span>
                            </div>
                            <span className="text-stone-600 text-xl font-mono">:</span>
                            <div>
                              <span className="block text-2xl sm:text-3xl font-mono font-bold text-amber-300">{String(remaining.minutes).padStart(2, '0')}</span>
                              <span className="text-[10px] tracking-wider uppercase text-stone-400">Mins</span>
                            </div>
                            <span className="text-stone-600 text-xl font-mono">:</span>
                            <div>
                              <span className="block text-2xl sm:text-3xl font-mono font-bold text-amber-300">{String(remaining.seconds).padStart(2, '0')}</span>
                              <span className="text-[10px] tracking-wider uppercase text-stone-400">Secs</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-5 border-t border-white/10 mt-5 flex items-center justify-between relative z-10">
                      <div className="flex items-center space-x-1.5 text-[11px] text-stone-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Cryptographically Sealed</span>
                      </div>

                      {isReadyToOpen ? (
                        <button
                          onClick={() => handleUnseal(capsule)}
                          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-stone-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer inline-flex items-center space-x-1.5 animate-bounce"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Unseal & Reveal Now</span>
                        </button>
                      ) : (
                        <span className="text-xs text-stone-500 font-mono italic">
                          Locked until {capsule.unlockDateFormatted}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UNSEALED ARCHIVE */}
      {activeTab === 'unsealed' && (
        <div className="space-y-5">
          {unsealedCapsules.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-linen-border bg-linen-surface">
              <Unlock className="w-12 h-12 text-linen-secondary/40 mx-auto mb-3" />
              <h3 className="font-serif text-xl font-medium text-linen-primary">No unsealed capsules yet</h3>
              <p className="text-xs text-linen-secondary mt-1">
                When a locked vault passes its unlock date and is opened, its letters and photos will be preserved here forever.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {unsealedCapsules.map((capsule) => {
                const seal = SEAL_META[capsule.sealType];
                return (
                  <div
                    key={capsule.id}
                    onClick={() => setReadingCapsule(capsule)}
                    className="cursor-pointer rounded-3xl border border-linen-border bg-linen-surface p-6 shadow-xs hover:border-amber-400/60 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                          {seal.emoji} Unsealed Chapter
                        </span>
                        <span className="text-xs font-mono text-linen-secondary">
                          {capsule.unlockDateFormatted}
                        </span>
                      </div>

                      <h3 className="font-serif text-xl font-medium text-linen-primary">
                        {capsule.title}
                      </h3>
                      <p className="text-xs text-linen-secondary">
                        From <strong className="text-linen-primary">{capsule.authorName}</strong>
                      </p>

                      <p className="text-xs text-linen-secondary leading-relaxed font-serif italic line-clamp-3">
                        “{capsule.content}”
                      </p>

                      {capsule.photoUrls && capsule.photoUrls.length > 0 && (
                        <div className="h-32 rounded-2xl overflow-hidden border border-linen-border mt-2">
                          <img src={capsule.photoUrls[0]} alt={capsule.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-linen-border/40 flex items-center justify-between text-xs text-amber-800 font-medium">
                      <span>Read Entire Letter →</span>
                      <span className="text-[11px] text-linen-secondary font-mono">
                        {capsule.photoUrls.length} {capsule.photoUrls.length === 1 ? 'photo' : 'photos'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: FULL LETTER VIEWER */}
      {readingCapsule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-linen-border pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{SEAL_META[readingCapsule.sealType].emoji}</span>
                <div>
                  <h3 className="font-serif text-xl font-semibold text-linen-primary">{readingCapsule.title}</h3>
                  <p className="text-xs text-linen-secondary">
                    Written by {readingCapsule.authorName} • Unsealed on {readingCapsule.unlockDateFormatted}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReadingCapsule(null)}
                className="p-1.5 rounded-xl text-linen-secondary hover:text-linen-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Letter Parchment View */}
            <div className="p-6 rounded-3xl bg-amber-50/50 border border-amber-200/70 space-y-4">
              <p className="font-serif text-sm sm:text-base text-linen-primary leading-relaxed whitespace-pre-wrap">
                {readingCapsule.content}
              </p>

              {readingCapsule.photoUrls && readingCapsule.photoUrls.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900 block">
                    Preserved Photos
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {readingCapsule.photoUrls.map((url, idx) => (
                      <div key={idx} className="h-40 rounded-2xl overflow-hidden border border-amber-200 shadow-xs">
                        <img src={url} alt={`Memory ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setReadingCapsule(null)}
                className="px-5 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90"
              >
                Close Capsule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SEAL NEW CAPSULE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Hourglass className="w-5 h-5 text-indigo-600" />
                <h3 className="font-serif text-xl font-medium text-linen-primary">Seal Future Time Capsule</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-xl text-linen-secondary hover:text-linen-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">
                  Time Capsule Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. To open on our 5th Anniversary in Paris"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-none focus:ring-1 focus:ring-linen-primary text-linen-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">
                  Teaser Hint (Visible while locked)
                </label>
                <input
                  type="text"
                  placeholder="e.g. A vow written on a napkin and three secret polaroids"
                  value={newTeaser}
                  onChange={e => setNewTeaser(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-none focus:ring-1 focus:ring-linen-primary text-linen-primary"
                />
              </div>

              {/* Target Unlock Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-linen-primary">
                    Unlock Date & Time
                  </label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handlePresetDate(1)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-linen-variant hover:bg-linen-border text-linen-secondary"
                    >
                      +1 Mo
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetDate(6)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-linen-variant hover:bg-linen-border text-linen-secondary"
                    >
                      +6 Mo
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetDate(12)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-linen-variant hover:bg-linen-border text-linen-secondary"
                    >
                      +1 Yr
                    </button>
                  </div>
                </div>
                <input
                  type="datetime-local"
                  value={newUnlockDate}
                  onChange={e => setNewUnlockDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/30 text-linen-primary"
                  required
                />
              </div>

              {/* Seal Type Selector */}
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1.5">
                  Thematic Lock & Seal
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(SEAL_META) as CapsuleSealType[]).map((type) => {
                    const meta = SEAL_META[type];
                    const Icon = meta.icon;
                    const isSelected = newSeal === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewSeal(type)}
                        className={`p-2.5 rounded-2xl border text-left flex items-start space-x-2 transition-all ${
                          isSelected
                            ? 'border-amber-400 bg-amber-50/80 ring-1 ring-amber-400'
                            : 'border-linen-border bg-linen-surface hover:bg-linen-variant/60'
                        }`}
                      >
                        <span className="text-lg">{meta.emoji}</span>
                        <div>
                          <span className="block text-xs font-semibold text-linen-primary">{meta.name}</span>
                          <span className="block text-[10px] text-linen-secondary leading-tight line-clamp-1">{meta.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Secret Letter Content */}
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">
                  Secret Letter, Vow, or Future Message
                </label>
                <textarea
                  rows={4}
                  placeholder="Write everything you want them to know when this moment arrives..."
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-none focus:ring-1 focus:ring-linen-primary text-linen-primary"
                  required
                />
              </div>

              {/* Photos */}
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">
                  Memory Photo URLs (One per line, optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="https://images.unsplash.com/..."
                  value={newPhotoUrls}
                  onChange={e => setNewPhotoUrls(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-none focus:ring-1 focus:ring-linen-primary text-linen-primary font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-linen-border/50">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs text-linen-secondary hover:text-linen-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-linen-primary text-linen-surface text-xs font-semibold hover:opacity-90 transition-opacity shadow-md inline-flex items-center space-x-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Seal Cryptographically</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
