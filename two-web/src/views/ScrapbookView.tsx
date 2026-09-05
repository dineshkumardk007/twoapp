import React, { useState } from 'react';
import { SpaceState } from '../core/storage';
import { ScrapbookSettings } from '../types';
import { BookOpen, Printer, Download, Sliders, Check, Star, Mail, MapPin, Heart, Utensils, Gift, Hourglass, Flame, Sparkles, X, ChevronRight, Calendar, ShieldCheck } from 'lucide-react';

interface ScrapbookViewProps {
  state: SpaceState;
  activeUser: 'user' | 'partner';
  onNavigate?: (tab: string) => void;
}

const DEFAULT_SETTINGS: ScrapbookSettings = {
  bookTitle: 'The Chronicle of Us',
  subtitle: 'Volume I · A Sanctuary of Two',
  dedication: 'To the quiet mornings, the uncontrollable laughter, and every storm weathered together in safe harbor.',
  coupleEstablishedYear: '2022',
  includeGratitude: true,
  includeLetters: true,
  includeAdventures: true,
  includeMilestones: true,
  includeRecipes: true,
  includeScratchCards: true,
  includeTimeCapsules: true,
  includeRituals: true,
};

export const ScrapbookView: React.FC<ScrapbookViewProps> = ({
  state,
  activeUser,
  onNavigate
}) => {
  const [settings, setSettings] = useState<ScrapbookSettings>(DEFAULT_SETTINGS);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const archiveData = {
      title: settings.bookTitle,
      subtitle: settings.subtitle,
      dedication: settings.dedication,
      exportedAt: new Date().toISOString(),
      activeUser,
      milestones: state.milestones,
      constellationStars: state.constellationStars,
      letters: state.letters,
      adventures: state.adventures.filter(a => a.isCompleted),
      recipes: state.recipes,
      scratchCards: state.scratchCards,
      timeCapsules: state.timeCapsules,
      rituals: state.rituals,
      pebblesCount: state.pebbles.length
    };

    const blob = new Blob([JSON.stringify(archiveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `two-keepsake-scrapbook-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportNotice('Archive JSON downloaded successfully!');
    setTimeout(() => setExportNotice(null), 4000);
  };

  const completedAdventures = state.adventures.filter(a => a.isCompleted);
  const totalMemoriesCount =
    state.constellationStars.length +
    state.letters.length +
    completedAdventures.length +
    state.milestones.length +
    state.recipes.length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Screen-Only Control Toolbar */}
      <div className="print:hidden bg-linen-surface rounded-2xl p-5 border border-linen-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 mb-1.5">
            <BookOpen className="w-3.5 h-3.5 text-rose-600" />
            <span>Annual Relational Memoir</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-linen-primary font-medium">
            Keepsake Memory Book
          </h1>
          <p className="text-xs sm:text-sm text-linen-secondary mt-0.5">
            Editorial compilation of your letters, stars, passport journeys, and milestones. Formatted for fine printing or archival export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-linen-variant hover:bg-linen-border text-linen-primary font-medium text-xs border border-linen-border transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-linen-accent" />
            <span>Customize</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-linen-variant hover:bg-linen-border text-linen-primary font-medium text-xs border border-linen-border transition-colors cursor-pointer"
            title="Download complete raw relational vault backup"
          >
            <Download className="w-3.5 h-3.5 text-linen-accent" />
            <span>Backup JSON</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-medium text-xs shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="print:hidden p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{exportNotice}</span>
          </div>
          <button onClick={() => setExportNotice(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 
        ============================================================
        PRINTABLE MEMOIR BOOK CONTAINER
        Uses custom styling for both elegant on-screen preview 
        and high-fidelity print-to-PDF (@media print)
        ============================================================
      */}
      <div className="scrapbook-memoir bg-[#faf8f5] text-[#2c2825] rounded-3xl p-6 sm:p-12 border border-[#e5ded4] shadow-md print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white print:text-black">

        {/* ----------------- COVER / FRONTISPIECE PAGE ----------------- */}
        <div className="scrapbook-page min-h-[500px] flex flex-col items-center justify-center text-center p-8 sm:p-16 border-4 border-double border-[#d8cdbf] rounded-2xl bg-[#fdfbf7] print:border-[#bbb] print:min-h-[90vh] print:break-after-page mb-12">
          <div className="w-16 h-16 rounded-full border border-[#c4b5a2] flex items-center justify-center mb-6 text-[#9e8b75]">
            <Sparkles className="w-8 h-8" />
          </div>

          <span className="text-xs font-serif uppercase tracking-[0.3em] text-[#8e7e6b] mb-3">
            Two · Relational Memoir
          </span>

          <h1 className="font-serif text-3xl sm:text-5xl font-medium tracking-tight text-[#221e1a] mb-3">
            {settings.bookTitle}
          </h1>

          <p className="font-serif italic text-base sm:text-lg text-[#6f6153] mb-8">
            {settings.subtitle}
          </p>

          <div className="w-24 h-px bg-[#d8cdbf] mb-8" />

          <p className="font-serif text-sm sm:text-base max-w-lg leading-relaxed text-[#4a4036] italic mb-10 px-4">
            “{settings.dedication}”
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-xs font-serif uppercase tracking-widest text-[#8e7e6b]">
            <span>Established {settings.coupleEstablishedYear}</span>
            <span className="hidden sm:inline">·</span>
            <span>{totalMemoriesCount} Captured Memories</span>
            <span className="hidden sm:inline">·</span>
            <span>You & Partner</span>
          </div>

          <div className="mt-12 text-[10px] text-[#a89b8c] uppercase tracking-wider flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero-Knowledge Encrypted Archive</span>
          </div>
        </div>

        {/* ----------------- CHAPTER I: GRATITUDE STARS ----------------- */}
        {settings.includeGratitude && state.constellationStars.length > 0 && (
          <div className="scrapbook-chapter mb-14 print:break-before-page">
            <div className="border-b border-[#d8cdbf] pb-3 mb-6 flex items-baseline justify-between">
              <div>
                <span className="text-[11px] font-serif uppercase tracking-widest text-[#8e7e6b] block">Chapter I</span>
                <h2 className="font-serif text-2xl font-medium text-[#221e1a]">Constellations of Gratitude</h2>
              </div>
              <span className="text-xs font-serif italic text-[#8e7e6b]">{state.constellationStars.length} Stars</span>
            </div>

            <p className="font-serif italic text-xs text-[#6f6153] mb-6">
              The micro-moments of everyday tenderness, whispered affirmations, and feelings of safe harbor.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {state.constellationStars.map((star) => (
                <div
                  key={star.id}
                  className="p-4 rounded-xl border border-[#e5ded4] bg-[#fbf9f6] print:border-[#ddd] print:bg-white print:break-inside-avoid"
                >
                  <div className="flex items-center justify-between text-[11px] text-[#8e7e6b] mb-2 font-serif">
                    <span className="inline-flex items-center font-medium capitalize">
                      <Star className="w-3 h-3 text-amber-600 mr-1 fill-amber-600/20" />
                      {star.category}
                    </span>
                    <span>{star.authorName}</span>
                  </div>
                  <p className="font-serif text-sm text-[#38312a] leading-relaxed italic">
                    “{star.note}”
                  </p>
                  <div className="text-[10px] text-[#a89b8c] mt-3 font-serif">
                    Recorded {new Date(star.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- CHAPTER II: LETTERS ACROSS TIME ----------------- */}
        {settings.includeLetters && state.letters.length > 0 && (
          <div className="scrapbook-chapter mb-14 print:break-before-page">
            <div className="border-b border-[#d8cdbf] pb-3 mb-6 flex items-baseline justify-between">
              <div>
                <span className="text-[11px] font-serif uppercase tracking-widest text-[#8e7e6b] block">Chapter II</span>
                <h2 className="font-serif text-2xl font-medium text-[#221e1a]">Letters Across Time</h2>
              </div>
              <span className="text-xs font-serif italic text-[#8e7e6b]">{state.letters.length} Letters</span>
            </div>

            <p className="font-serif italic text-xs text-[#6f6153] mb-6">
              Epistolary love letters sealed in wax, written slowly and opened with reverent presence.
            </p>

            <div className="space-y-6">
              {state.letters.map((letter) => (
                <div
                  key={letter.id}
                  className="p-6 rounded-2xl border border-[#e5ded4] bg-[#fbf9f6] print:border-[#ccc] print:bg-white print:break-inside-avoid"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#ebdcd0] mb-4 gap-2">
                    <div>
                      <h3 className="font-serif text-lg font-medium text-[#221e1a]">{letter.title}</h3>
                      <div className="text-xs text-[#8e7e6b] font-serif mt-0.5">
                        Penned by {letter.authorName} · Sealed with {letter.waxColor} wax
                      </div>
                    </div>
                    <div className="text-[11px] text-[#8e7e6b] font-serif">
                      {letter.openedDate ? `Opened ${letter.openedDate}` : `Delivered ${letter.sentDate}`}
                    </div>
                  </div>

                  <p className="font-serif text-sm sm:text-base text-[#38312a] leading-relaxed whitespace-pre-line italic">
                    {letter.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- CHAPTER III: PASSPORT & ADVENTURES ----------------- */}
        {settings.includeAdventures && completedAdventures.length > 0 && (
          <div className="scrapbook-chapter mb-14 print:break-before-page">
            <div className="border-b border-[#d8cdbf] pb-3 mb-6 flex items-baseline justify-between">
              <div>
                <span className="text-[11px] font-serif uppercase tracking-widest text-[#8e7e6b] block">Chapter III</span>
                <h2 className="font-serif text-2xl font-medium text-[#221e1a]">Shared Horizons & Passport</h2>
              </div>
              <span className="text-xs font-serif italic text-[#8e7e6b]">{completedAdventures.length} Stamp Entries</span>
            </div>

            <p className="font-serif italic text-xs text-[#6f6153] mb-6">
              Our couple passport of journeys fulfilled, horizons explored, and dreams experienced side by side.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {completedAdventures.map((adv) => (
                <div
                  key={adv.id}
                  className="p-5 rounded-2xl border border-[#e5ded4] bg-[#fdfbf7] print:border-[#ccc] print:bg-white print:break-inside-avoid flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#f0e8dc] text-[#7a6a57]">
                        {adv.category}
                      </span>
                      {adv.completedDate && (
                        <span className="text-[11px] text-[#8e7e6b] font-serif">
                          Stamped: {adv.completedDate}
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif text-base font-medium text-[#221e1a] mb-1">
                      {adv.title}
                    </h3>
                    <p className="text-xs text-[#6f6153] leading-relaxed mb-3">
                      {adv.description}
                    </p>

                    {adv.personalNotes && (
                      <div className="p-3 rounded-xl bg-[#f5ede2] text-xs font-serif italic text-[#4a4036] mb-3">
                        “{adv.personalNotes}”
                      </div>
                    )}
                  </div>

                  {adv.photoUrl && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-[#d8cdbf] shadow-xs">
                      <img
                        src={adv.photoUrl}
                        alt={adv.title}
                        className="w-full h-40 object-cover"
                      />
                    </div>
                  )}

                  {adv.location && (
                    <div className="text-[11px] text-[#8e7e6b] flex items-center space-x-1 mt-3 pt-2 border-t border-[#ebdcd0]">
                      <MapPin className="w-3 h-3 text-rose-600" />
                      <span>{adv.location} {adv.season ? `(${adv.season})` : ''}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- CHAPTER IV: SACRED MILESTONES ----------------- */}
        {settings.includeMilestones && state.milestones.length > 0 && (
          <div className="scrapbook-chapter mb-14 print:break-before-page">
            <div className="border-b border-[#d8cdbf] pb-3 mb-6 flex items-baseline justify-between">
              <div>
                <span className="text-[11px] font-serif uppercase tracking-widest text-[#8e7e6b] block">Chapter IV</span>
                <h2 className="font-serif text-2xl font-medium text-[#221e1a]">Milestones & Sacred Epochs</h2>
              </div>
              <span className="text-xs font-serif italic text-[#8e7e6b]">{state.milestones.length} Epochs</span>
            </div>

            <p className="font-serif italic text-xs text-[#6f6153] mb-6">
              The foundational markers in our love story that anchored who we have grown to be together.
            </p>

            <div className="relative pl-6 sm:pl-8 border-l-2 border-[#d8cdbf] space-y-6">
              {state.milestones.map((ms) => (
                <div key={ms.id} className="relative print:break-inside-avoid">
                  {/* Timeline dot */}
                  <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-[#8e7e6b] border-2 border-white" />

                  <div className="p-4 rounded-xl border border-[#e5ded4] bg-[#fbf9f6] print:border-[#ddd] print:bg-white">
                    <div className="flex items-center justify-between text-xs text-[#8e7e6b] font-serif mb-1">
                      <span className="font-medium text-[#7a6a57] uppercase tracking-wider text-[10px]">{ms.category}</span>
                      <span>{ms.date}</span>
                    </div>
                    <h3 className="font-serif text-base font-medium text-[#221e1a] mb-1">
                      {ms.title}
                    </h3>
                    <p className="text-xs text-[#5c5044] leading-relaxed">
                      {ms.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- CHAPTER V: THE HEARTH & TABLE ----------------- */}
        {settings.includeRecipes && state.recipes.length > 0 && (
          <div className="scrapbook-chapter mb-14 print:break-before-page">
            <div className="border-b border-[#d8cdbf] pb-3 mb-6 flex items-baseline justify-between">
              <div>
                <span className="text-[11px] font-serif uppercase tracking-widest text-[#8e7e6b] block">Chapter V</span>
                <h2 className="font-serif text-2xl font-medium text-[#221e1a]">The Hearth & Shared Table</h2>
              </div>
              <span className="text-xs font-serif italic text-[#8e7e6b]">{state.recipes.length} Recipes</span>
            </div>

            <p className="font-serif italic text-xs text-[#6f6153] mb-6">
              Meals prepared side-by-side, flour on the countertops, music playing quietly in the warm kitchen.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {state.recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="p-5 rounded-2xl border border-[#e5ded4] bg-[#fdfbf7] print:border-[#ccc] print:bg-white print:break-inside-avoid"
                >
                  <div className="flex items-center justify-between text-[11px] text-[#8e7e6b] font-serif mb-1">
                    <span className="capitalize">{recipe.comfortTag.replace('_', ' ')}</span>
                    <span>{recipe.prepTime} prep</span>
                  </div>
                  <h3 className="font-serif text-base font-medium text-[#221e1a] mb-2">
                    {recipe.title}
                  </h3>
                  {recipe.story && (
                    <p className="text-xs font-serif italic text-[#6f6153] mb-3">
                      “{recipe.story}”
                    </p>
                  )}

                  <div className="text-xs font-medium text-[#4a4036] uppercase tracking-wider text-[10px] mb-1.5">
                    Ingredients ({recipe.ingredients.length})
                  </div>
                  <ul className="text-xs text-[#5c5044] space-y-1 mb-3 list-disc list-inside">
                    {recipe.ingredients.slice(0, 5).map((ing) => (
                      <li key={ing.id}>{ing.name}</li>
                    ))}
                    {recipe.ingredients.length > 5 && (
                      <li className="list-none text-[#8e7e6b] italic">+ {recipe.ingredients.length - 5} more ingredients...</li>
                    )}
                  </ul>

                  {recipe.favoriteWineOrDrink && (
                    <div className="text-[11px] text-[#7a6a57] font-serif pt-2 border-t border-[#ebdcd0]">
                      🍷 Recommended pairing: {recipe.favoriteWineOrDrink}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- CHAPTER VI: SCRATCH SURPRISES & ARCHIVES ----------------- */}
        {settings.includeScratchCards && state.scratchCards.filter(c => c.isRedeemed).length > 0 && (
          <div className="scrapbook-chapter mb-14 print:break-before-page">
            <div className="border-b border-[#d8cdbf] pb-3 mb-6 flex items-baseline justify-between">
              <div>
                <span className="text-[11px] font-serif uppercase tracking-widest text-[#8e7e6b] block">Chapter VI</span>
                <h2 className="font-serif text-2xl font-medium text-[#221e1a]">Vows, Surprises & Archives</h2>
              </div>
              <span className="text-xs font-serif italic text-[#8e7e6b]">Redeemed Coupons</span>
            </div>

            <p className="font-serif italic text-xs text-[#6f6153] mb-6">
              Golden scratch-off surprise cards that were given, unveiled, and redeemed in unconditional love.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {state.scratchCards.filter(c => c.isRedeemed).map((card) => (
                <div
                  key={card.id}
                  className="p-4 rounded-xl border border-dashed border-[#c4b5a2] bg-[#fcfaf7] print:border-[#999] print:bg-white print:break-inside-avoid relative"
                >
                  <div className="text-[10px] font-serif uppercase tracking-wider text-[#8e7e6b] mb-1">
                    {card.foilType} Foil Coupon · {card.authorId === 'user' ? 'From You' : 'From Partner'}
                  </div>
                  <h3 className="font-serif text-sm font-medium text-[#221e1a] mb-1.5">
                    {card.title}
                  </h3>
                  <p className="font-serif italic text-xs text-[#4a4036] leading-relaxed">
                    “{card.revealedContent}”
                  </p>
                  <div className="mt-3 inline-block border border-rose-700/60 rounded px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase tracking-widest">
                    ✓ Redeemed & Loved ({card.redeemedAt || 'Archived'})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- EPILOGUE & COLOPHON ----------------- */}
        <div className="border-t-2 border-[#d8cdbf] pt-8 mt-12 text-center print:break-inside-avoid">
          <p className="font-serif italic text-sm text-[#6f6153] mb-2">
            End of {settings.subtitle}
          </p>
          <p className="font-serif text-xs text-[#8e7e6b] max-w-sm mx-auto leading-relaxed">
            Preserved privately on your personal device with end-to-end zero-knowledge encryption. Our story continues tomorrow morning.
          </p>
          <div className="text-[10px] text-[#a89b8c] font-mono mt-4">
            ARCHIVE ID: TWO-{new Date().getFullYear()}-{state.activeUser.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-linen-surface rounded-2xl max-w-lg w-full border border-linen-border shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-linen-border flex items-center justify-between bg-linen-variant/20">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-linen-accent" />
                <h3 className="font-serif text-lg font-medium text-linen-primary">
                  Customize Keepsake Memoir
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 text-linen-secondary hover:text-linen-primary rounded-lg hover:bg-linen-variant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Book Title
                </label>
                <input
                  type="text"
                  value={settings.bookTitle}
                  onChange={e => setSettings({ ...settings, bookTitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-sm focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Volume Subtitle
                </label>
                <input
                  type="text"
                  value={settings.subtitle}
                  onChange={e => setSettings({ ...settings, subtitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-sm focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Dedication Message
                </label>
                <textarea
                  rows={3}
                  value={settings.dedication}
                  onChange={e => setSettings({ ...settings, dedication: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-sm focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Established Year
                </label>
                <input
                  type="text"
                  value={settings.coupleEstablishedYear}
                  onChange={e => setSettings({ ...settings, coupleEstablishedYear: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-sm focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-2">
                  Include Memoir Chapters
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center space-x-2 p-2 rounded-lg bg-linen-variant/40 hover:bg-linen-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.includeGratitude}
                      onChange={e => setSettings({ ...settings, includeGratitude: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-0"
                    />
                    <span>Gratitude Stars</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 rounded-lg bg-linen-variant/40 hover:bg-linen-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.includeLetters}
                      onChange={e => setSettings({ ...settings, includeLetters: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-0"
                    />
                    <span>Love Letters</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 rounded-lg bg-linen-variant/40 hover:bg-linen-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.includeAdventures}
                      onChange={e => setSettings({ ...settings, includeAdventures: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-0"
                    />
                    <span>Passport Adventures</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 rounded-lg bg-linen-variant/40 hover:bg-linen-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.includeMilestones}
                      onChange={e => setSettings({ ...settings, includeMilestones: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-0"
                    />
                    <span>Sacred Milestones</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 rounded-lg bg-linen-variant/40 hover:bg-linen-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.includeRecipes}
                      onChange={e => setSettings({ ...settings, includeRecipes: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-0"
                    />
                    <span>Couple Cookbook</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 rounded-lg bg-linen-variant/40 hover:bg-linen-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.includeScratchCards}
                      onChange={e => setSettings({ ...settings, includeScratchCards: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-0"
                    />
                    <span>Scratch Coupons</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-linen-border flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
