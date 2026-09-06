import React, { useState } from 'react';
import { LoveLetter, WaxColor, LetterCondition } from '../types';
import { Mail, Feather, Heart, Sparkles, Lock, Unlock, Calendar, Moon, Plane, Shield, X, CheckCircle2 } from 'lucide-react';
import { newId } from '../core/ids';

interface LettersViewProps {
  letters: LoveLetter[];
  activeUser: 'user' | 'partner';
  onSendLetter: (newLetter: LoveLetter) => void;
  onOpenLetter: (letterId: string) => void;
}

export const LettersView: React.FC<LettersViewProps> = ({
  letters,
  activeUser,
  onSendLetter,
  onOpenLetter
}) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<LoveLetter | null>(null);
  const [sealBreaking, setSealBreaking] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [waxColor, setWaxColor] = useState<WaxColor>('gold');
  const [conditionType, setConditionType] = useState<LetterCondition>('night');
  const [conditionDetail, setConditionDetail] = useState('Open when unwinding tonight with warm tea');

  const receivedLetters = letters.filter(l => l.authorId !== activeUser);
  const sentLetters = letters.filter(l => l.authorId === activeUser);

  const handleOpenLetterClick = (letter: LoveLetter) => {
    setSelectedLetter(letter);
    if (!letter.isOpened) {
      setSealBreaking(true);
      setTimeout(() => {
        setSealBreaking(false);
        onOpenLetter(letter.id);
      }, 1000);
    }
  };

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    const newLetter: LoveLetter = {
      id: newId('let'),
      authorId: activeUser,
      authorName: activeUser === 'user' ? 'You' : 'Partner',
      title: title.trim(),
      body: body.trim(),
      waxColor,
      conditionType,
      conditionDetail: conditionDetail.trim() || undefined,
      sentDate: 'Today',
      isOpened: false
    };

    onSendLetter(newLetter);
    setShowComposeModal(false);
    setTitle('');
    setBody('');
  };

  const getWaxStyles = (color: WaxColor) => {
    switch (color) {
      case 'burgundy':
        return {
          bg: 'bg-[#7B1E2B]',
          border: 'border-[#58141F]',
          shadow: 'shadow-[0_4px_12px_rgba(123,30,43,0.35)]',
          text: 'text-rose-100',
          label: 'Burgundy (Passion & Devotion)'
        };
      case 'gold':
        return {
          bg: 'bg-[#C5A059]',
          border: 'border-[#947437]',
          shadow: 'shadow-[0_4px_12px_rgba(197,160,89,0.35)]',
          text: 'text-amber-100',
          label: 'Antique Gold (Promise & Light)'
        };
      case 'sage':
        return {
          bg: 'bg-[#4A6B53]',
          border: 'border-[#304837]',
          shadow: 'shadow-[0_4px_12px_rgba(74,107,83,0.35)]',
          text: 'text-emerald-100',
          label: 'Forest Sage (Peace & Healing)'
        };
      case 'midnight':
        return {
          bg: 'bg-[#1B263B]',
          border: 'border-[#0D131D]',
          shadow: 'shadow-[0_4px_12px_rgba(27,38,59,0.35)]',
          text: 'text-slate-100',
          label: 'Deep Midnight (Intimacy & Stars)'
        };
    }
  };

  const getConditionIcon = (type: LetterCondition) => {
    switch (type) {
      case 'date': return <Calendar className="w-3.5 h-3.5 text-linen-accent" />;
      case 'night': return <Moon className="w-3.5 h-3.5 text-indigo-500" />;
      case 'anxious': return <Heart className="w-3.5 h-3.5 text-rose-500" />;
      case 'travel': return <Plane className="w-3.5 h-3.5 text-sky-500" />;
      default: return <Sparkles className="w-3.5 h-3.5 text-linen-accent" />;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-linen-primary tracking-tight">
            Wax-Sealed Love Letters
          </h2>
          <p className="text-sm text-linen-secondary mt-1">
            Epistolary intimacy sealed with digital wax, created to be unsealed in intentional moments.
          </p>
        </div>
        <button
          onClick={() => setShowComposeModal(true)}
          className="self-start sm:self-auto inline-flex items-center px-4 py-2.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs"
        >
          <Feather className="w-3.5 h-3.5 mr-1.5" />
          Write Sealed Letter
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-linen-border pb-2">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'inbox'
              ? 'bg-linen-primary text-linen-surface shadow-xs'
              : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant/60'
          }`}
        >
          Received Letters ({receivedLetters.length})
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'sent'
              ? 'bg-linen-primary text-linen-surface shadow-xs'
              : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant/60'
          }`}
        >
          Sent Letters ({sentLetters.length})
        </button>
      </div>

      {/* Envelopes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {(activeTab === 'inbox' ? receivedLetters : sentLetters).map(letter => {
          const wax = getWaxStyles(letter.waxColor);
          return (
            <div
              key={letter.id}
              onClick={() => handleOpenLetterClick(letter)}
              className="relative rounded-3xl border border-linen-border bg-gradient-to-br from-linen-surface via-linen-surface to-linen-variant/30 p-6 shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden group hover:border-linen-accent/60"
            >
              {/* Envelope flap aesthetic styling */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-linen-accent/30" />
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-linen-accent">
                    From {letter.authorName} • {letter.sentDate}
                  </span>
                  <h3 className="font-serif text-lg font-medium text-linen-primary group-hover:text-linen-accent transition-colors">
                    {letter.title}
                  </h3>
                </div>

                {/* Wax Seal Stamp Icon */}
                <div
                  className={`w-11 h-11 rounded-full ${wax.bg} ${wax.border} ${wax.shadow} border-2 flex items-center justify-center ${wax.text} transform group-hover:rotate-6 transition-transform duration-300 relative`}
                  title={`Sealed with ${wax.label}`}
                >
                  {letter.isOpened ? (
                    <Unlock className="w-5 h-5 opacity-90" />
                  ) : (
                    <Lock className="w-5 h-5 opacity-90" />
                  )}
                  {/* Subtle inner seal ring */}
                  <div className="absolute inset-1 rounded-full border border-white/20 pointer-events-none" />
                </div>
              </div>

              {/* Excerpt or Condition */}
              <div className="mt-4 pt-4 border-t border-linen-border/50">
                {letter.isOpened ? (
                  <p className="font-serif italic text-xs text-linen-secondary line-clamp-2 leading-relaxed">
                    "{letter.body}"
                  </p>
                ) : (
                  <div className="flex items-center space-x-2 text-xs text-linen-primary font-medium bg-linen-variant/60 p-2.5 rounded-xl border border-linen-border/60">
                    {getConditionIcon(letter.conditionType)}
                    <span className="truncate">{letter.conditionDetail || 'Sealed with love'}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-linen-secondary">
                <span>{letter.isOpened ? '✓ Seal broken & read' : '🔒 Tap to break wax seal'}</span>
                <span className="text-linen-accent group-hover:underline">View Parchment →</span>
              </div>
            </div>
          );
        })}

        {(activeTab === 'inbox' ? receivedLetters : sentLetters).length === 0 && (
          <div className="col-span-full p-12 text-center border-2 border-dashed border-linen-border rounded-3xl bg-linen-surface/40 space-y-3">
            <Mail className="w-8 h-8 text-linen-accent/60 mx-auto" />
            <p className="font-serif text-base text-linen-primary">No letters in this tray yet</p>
            <p className="text-xs text-linen-secondary">
              Take 5 quiet minutes to write a letter to be opened on your partner's next long week.
            </p>
          </div>
        )}
      </div>

      {/* Read Letter Modal with Parchment Texture */}
      {selectedLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#FAF7EE] border border-[#E3DCB8] rounded-3xl p-6 sm:p-10 max-w-lg w-full shadow-2xl space-y-6 relative overflow-hidden text-[#3B322C]">
            {/* Close Button */}
            <button
              onClick={() => setSelectedLetter(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 text-[#736357] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Breaking Wax Animation Toast */}
            {sealBreaking && (
              <div className="absolute inset-0 bg-[#FAF7EE]/90 flex flex-col items-center justify-center space-y-3 z-30 animate-pulse">
                <div className={`w-16 h-16 rounded-full ${getWaxStyles(selectedLetter.waxColor).bg} flex items-center justify-center text-white text-2xl shadow-xl animate-bounce`}>
                  ✨
                </div>
                <span className="font-serif text-sm font-medium tracking-wide">Breaking wax seal with care...</span>
              </div>
            )}

            {/* Letter Header */}
            <div className="border-b border-[#D8CEB0] pb-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#736357]">
                <span className="font-mono uppercase tracking-wider">From: {selectedLetter.authorName}</span>
                <span>{selectedLetter.sentDate}</span>
              </div>
              <h3 className="font-serif text-2xl font-medium tracking-tight text-[#2B231D]">
                {selectedLetter.title}
              </h3>
              {selectedLetter.conditionDetail && (
                <div className="text-[11px] text-[#8C7A6B] italic pt-1">
                  Intended moment: "{selectedLetter.conditionDetail}"
                </div>
              )}
            </div>

            {/* Letter Parchment Body */}
            <div className="font-serif text-base leading-relaxed text-[#2F2721] whitespace-pre-wrap min-h-[140px]">
              {selectedLetter.body}
            </div>

            {/* Letter Footer */}
            <div className="pt-4 border-t border-[#D8CEB0] flex items-center justify-between text-xs text-[#736357]">
              <span>Two • Sealed in Sanctuary</span>
              <span className="italic font-serif">Always yours.</span>
            </div>
          </div>
        </div>
      )}

      {/* Compose Letter Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-linen-primary font-serif text-lg font-medium">
                <Feather className="w-5 h-5 text-linen-accent" />
                <span>Compose Wax-Sealed Letter</span>
              </div>
              <button
                onClick={() => setShowComposeModal(false)}
                className="p-1.5 rounded-lg text-linen-secondary hover:text-linen-primary hover:bg-linen-variant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">Letter Title</label>
                <input
                  type="text"
                  placeholder="e.g. For Our Next Rainy Sunday Morning"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1">Parchment Words</label>
                <textarea
                  rows={6}
                  placeholder="Write deeply and honestly. Speak to your partner across time..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary font-serif text-sm leading-relaxed"
                  required
                />
              </div>

              {/* Wax Seal Stamp Picker */}
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1.5">Select Wax Seal Color</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['burgundy', 'gold', 'sage', 'midnight'] as WaxColor[]).map(color => {
                    const wax = getWaxStyles(color);
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setWaxColor(color)}
                        className={`p-2.5 rounded-xl border text-left flex items-center space-x-2 transition-all ${
                          waxColor === color
                            ? 'border-linen-primary ring-2 ring-linen-primary/20 bg-linen-variant/70'
                            : 'border-linen-border hover:bg-linen-variant/30'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full ${wax.bg} border border-black/20`} />
                        <span className="text-[11px] capitalize font-medium text-linen-primary">{color}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Delivery Gate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">When should it be opened?</label>
                  <select
                    value={conditionType}
                    onChange={e => setConditionType(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                  >
                    <option value="night">Night time / Unwinding</option>
                    <option value="anxious">When feeling anxious or stressed</option>
                    <option value="travel">During travel / distance</option>
                    <option value="date">Specific calendar milestone</option>
                    <option value="none">Immediate (Open anytime)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-linen-primary block mb-1">Instruction Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Open with hot tea on our balcony"
                    value={conditionDetail}
                    onChange={e => setConditionDetail(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-none focus:ring-1 focus:ring-linen-primary"
                  />
                </div>
              </div>

              {/* Submit / Pour Wax Button */}
              <div className="pt-3 border-t border-linen-border flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="px-3.5 py-2 text-xs text-linen-secondary hover:text-linen-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                  Pour Wax & Seal Envelope
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
