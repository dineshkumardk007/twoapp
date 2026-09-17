import React, { useState } from 'react';
import { QuoteItem, MemoryItem } from '../types';
import { Quote, Plus, Sparkles, Image as ImageIcon, Lock, Unlock, Calendar, Clock, Heart, Camera, X } from 'lucide-react';

export type { MemoryItem };

/** Today, written the way a person would date a memory. */
function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Shrinks a photo before it becomes part of a memory.
 *
 * A memory travels to your partner's phone inside one encrypted record, and
 * the relay refuses any record over 256 KB - so the photo has to fit, not just
 * be smaller. It starts at 1600 pixels on the long side, sharp full-screen on a
 * phone, and steps down in size and quality only as far as it must.
 */
const MAX_PHOTO_CHARS = 150_000; // leaves room for encryption's base64 growth and the rest of the record

function shrinkPhoto(file: File): Promise<string> {
  const STEPS: Array<[number, number]> = [
    [1600, 0.85], [1600, 0.72], [1280, 0.72], [1280, 0.6], [1024, 0.6], [800, 0.6], [640, 0.55]
  ];
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas'));
      let dataUrl = '';
      for (const [edge, quality] of STEPS) {
        const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= MAX_PHOTO_CHARS) break;
      }
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('not an image'));
    };
    img.src = url;
  });
}

interface TimelineViewProps {
  quotes: QuoteItem[];
  memories: MemoryItem[];
  activeUser: 'user' | 'partner';
  onAddQuote: (quote: string) => void;
  onAddMemory: (memory: Omit<MemoryItem, 'id' | 'authorId' | 'authorName'>) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  quotes,
  memories,
  activeUser,
  onAddQuote,
  onAddMemory
}) => {
  const [tab, setTab] = useState<'timeline' | 'quotes'>('timeline');
  const [newQuoteText, setNewQuoteText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Memory Form States
  const [newTitle, setNewTitle] = useState('');
  // A real date rather than "Today", which would still say today next year.
  const [newDate, setNewDate] = useState(todayLabel);
  const [newTag, setNewTag] = useState<MemoryItem['tag']>('Moment');
  const [newDesc, setNewDesc] = useState('');
  const [newImage, setNewImage] = useState<string | undefined>(undefined);
  const [isTimeCapsule, setIsTimeCapsule] = useState(false);
  const [lockDate, setLockDate] = useState('2026-12-31');

  const partnerName = activeUser === 'user' ? 'Partner' : 'You';

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      shrinkPhoto(file)
        .then(setNewImage)
        .catch(() => setNewImage(undefined));
    }
  };

  const handleSaveMemory = () => {
    if (!newTitle.trim() || !newDesc.trim()) return;

    onAddMemory({
      title: newTitle.trim(),
      date: newDate.trim() || todayLabel(),
      tag: newTag,
      desc: newDesc.trim(),
      imageDataUrl: newImage,
      lockedUntil: isTimeCapsule ? lockDate : undefined
    });
    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewImage(undefined);
    setIsTimeCapsule(false);
  };

  const handleAddCustomQuote = () => {
    if (!newQuoteText.trim()) return;
    onAddQuote(newQuoteText.trim());
    setNewQuoteText('');
  };

  const isMemoryLocked = (item: MemoryItem): boolean => {
    if (!item.lockedUntil) return false;
    const lockTime = new Date(item.lockedUntil).getTime();
    // The real clock. This was a fixed date, so a capsule sealed "until next
    // week" would never have opened.
    const now = Date.now();
    return lockTime > now;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium text-linen-primary">Encrypted Memories & Time Capsule</h2>
          <p className="text-sm text-linen-secondary">Polaroid keepsakes, sealed anniversary capsules, and the Quote Jar.</p>
        </div>

        <div className="flex items-center space-x-2">
          {tab === 'timeline' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-3 py-1.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Add Memory</span>
            </button>
          )}

          <div className="flex p-1 bg-linen-variant rounded-xl border border-linen-border">
            <button
              onClick={() => setTab('timeline')}
              className={`py-1.5 px-3 text-xs font-medium rounded-lg transition-all ${
                tab === 'timeline' ? 'bg-linen-surface text-linen-primary shadow-xs' : 'text-linen-secondary'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setTab('quotes')}
              className={`py-1.5 px-3 text-xs font-medium rounded-lg transition-all ${
                tab === 'quotes' ? 'bg-linen-surface text-linen-primary shadow-xs' : 'text-linen-secondary'
              }`}
            >
              Quote Jar
            </button>
          </div>
        </div>
      </div>

      {tab === 'timeline' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {memories.map(item => {
            const locked = isMemoryLocked(item);

            return (
              <div
                key={item.id}
                className="group relative rounded-3xl border border-linen-border bg-linen-surface p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Polaroid Frame Image */}
                {item.imageDataUrl && (
                  <div className="relative aspect-4/3 w-full rounded-2xl overflow-hidden bg-linen-variant mb-4 border border-linen-border/40">
                    <img
                      src={item.imageDataUrl}
                      alt={item.title}
                      className={`w-full h-full object-cover transition-all duration-300 ${locked ? 'blur-xl grayscale scale-110' : ''}`}
                    />

                    {/* Time Capsule Lock Screen */}
                    {locked && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-black/40 backdrop-blur-md text-center text-white">
                        <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm mb-2">
                          <Lock className="w-6 h-6 text-white" />
                        </div>
                        <span className="font-serif text-base font-medium">Sealed in Time Capsule</span>
                        <span className="text-[11px] opacity-90 mt-1">
                          Unlocks on {item.lockedUntil}
                        </span>
                        <span className="text-[10px] opacity-75 mt-2 bg-white/15 px-2.5 py-0.5 rounded-full">
                          🔒 Sealed until then
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Memory Meta */}
                <div className="space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-linen-secondary mb-1">
                      <span className="font-semibold text-linen-accent uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-linen-variant border border-linen-border">
                        {item.tag}
                      </span>
                      <span className="font-mono text-[11px]">{item.date}</span>
                    </div>

                    <h3 className="font-serif text-lg font-medium text-linen-primary leading-snug">
                      {locked ? 'Secret Memory Capsule' : item.title}
                    </h3>

                    <p className="text-xs text-linen-secondary leading-relaxed mt-1">
                      {locked ? 'This note and photo are sealed until your special milestone date.' : item.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-linen-border/50 flex items-center justify-between text-[11px] text-linen-secondary">
                    <span>
                      Added by{' '}
                      {item.authorId ? (item.authorId === activeUser ? 'you' : 'your partner') : item.authorName}
                    </span>
                    {locked ? (
                      <span className="text-amber-600 font-medium flex items-center">
                        <Lock className="w-3 h-3 mr-1" /> Time Capsule
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" /> Encrypted Vault
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Add custom note to jar */}
          <div className="p-4 rounded-2xl border border-linen-border bg-linen-surface shadow-xs flex items-center space-x-2">
            <input
              type="text"
              value={newQuoteText}
              onChange={(e) => setNewQuoteText(e.target.value)}
              placeholder="Drop a note into the Quote Jar for hard days..."
              className="flex-1 px-4 py-2 text-sm rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-hidden focus:ring-2 focus:ring-linen-primary"
            />
            <button
              onClick={handleAddCustomQuote}
              disabled={!newQuoteText.trim()}
              className="px-4 py-2 bg-linen-primary text-linen-surface rounded-xl text-sm font-medium hover:opacity-95 disabled:opacity-40 transition-all"
            >
              Add Note
            </button>
          </div>

          <div className="space-y-4">
            {quotes.map(q => (
              <div key={q.id} className="p-6 rounded-2xl border border-linen-border bg-linen-surface shadow-xs space-y-3">
                <p className="font-serif text-base italic text-linen-primary leading-relaxed">
                  “{q.quote}”
                </p>
                <div className="text-right">
                  <span className={`text-xs ${q.isCustom ? 'text-linen-accent font-medium' : 'text-linen-secondary'}`}>
                    — {q.isCustom ? (q.author === 'You' ? 'You' : 'Your partner') : q.author}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-linen-surface border border-linen-border shadow-xl p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-linen-border">
              <h3 className="font-serif text-lg font-medium text-linen-primary">Seal a New Memory</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-linen-secondary hover:text-linen-primary rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-linen-primary mb-1">Memory Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., The Rainy Bookstore Afternoon"
                  className="w-full px-3 py-2 rounded-xl border border-linen-border bg-linen-variant/20 focus:outline-none focus:ring-1 focus:ring-linen-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-linen-primary mb-1">Date</label>
                  <input
                    type="text"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    placeholder="e.g., September 5"
                    className="w-full px-3 py-2 rounded-xl border border-linen-border bg-linen-variant/20"
                  />
                </div>
                <div>
                  <label className="block font-medium text-linen-primary mb-1">Tag</label>
                  <select
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-linen-border bg-linen-variant/20"
                  >
                    <option value="Moment">Moment</option>
                    <option value="Milestone">Milestone</option>
                    <option value="Trip">Trip</option>
                    <option value="Anniversary">Anniversary</option>
                    <option value="Whisper">Whisper</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-linen-primary mb-1">Photo Attachment</label>
                <label className="flex items-center space-x-2 px-3 py-2.5 rounded-xl border border-dashed border-linen-border bg-linen-variant/20 hover:bg-linen-variant/40 cursor-pointer">
                  <Camera className="w-4 h-4 text-linen-secondary" />
                  <span className="text-linen-secondary">
                    {newImage ? 'Photo attached ✓ (click to change)' : 'Upload polaroid photo...'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block font-medium text-linen-primary mb-1">Caption / Story</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What made this moment tender, funny, or unforgettable?"
                  className="w-full px-3 py-2 rounded-xl border border-linen-border bg-linen-variant/20 focus:outline-none focus:ring-1 focus:ring-linen-accent resize-none"
                />
              </div>

              {/* Time Capsule Toggle */}
              <div className="p-3.5 rounded-2xl border border-linen-border bg-linen-variant/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-linen-primary flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-linen-accent" />
                    <span>Seal in Time Capsule</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isTimeCapsule}
                    onChange={(e) => setIsTimeCapsule(e.target.checked)}
                    className="accent-linen-primary cursor-pointer w-4 h-4"
                  />
                </div>
                {isTimeCapsule && (
                  <div className="pt-2 border-t border-linen-border/50">
                    <label className="block text-[11px] text-linen-secondary mb-1">
                      Lock memory and photo until:
                    </label>
                    <input
                      type="date"
                      value={lockDate}
                      onChange={(e) => setLockDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-linen-border bg-linen-surface font-mono"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveMemory}
                disabled={!newTitle.trim() || !newDesc.trim()}
                className="w-full py-2.5 rounded-xl bg-linen-primary text-linen-surface font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Seal Memory into Encrypted Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
