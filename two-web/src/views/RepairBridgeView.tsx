import React, { useState } from 'react';
import { RepairLetter, ApologyLanguage, RepairStatus } from '../types';
import {
  Handshake,
  Heart,
  Shield,
  Clock,
  Sparkles,
  Send,
  Check,
  MessageCircle,
  HelpCircle,
  Feather,
  Plus,
  Compass,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { newId } from '../core/ids';

interface RepairBridgeViewProps {
  repairLetters: RepairLetter[];
  activeUser: 'user' | 'partner';
  onSendRepair: (letter: RepairLetter) => void;
  onRespondRepair: (letterId: string, status: RepairStatus, note?: string) => void;
  onSendToChat?: (text: string) => void;
}

const APOLOGY_LANGUAGES_META: Record<
  ApologyLanguage,
  { name: string; target: string; example: string; icon: string; prompt: string }
> = {
  regret: {
    name: 'Expressing Regret',
    target: 'Heart & Emotion',
    example: '“I am deeply sorry for causing you pain or loneliness.”',
    icon: '💖',
    prompt: 'Acknowledge the emotional impact your actions had on your partner without minimizing.'
  },
  responsibility: {
    name: 'Accepting Responsibility',
    target: 'Accountability & Ownership',
    example: '“I was wrong. I own my words without excuses or blaming circumstances.”',
    icon: '🛡️',
    prompt: 'Own your exact behavior cleanly. Avoid saying “I was stressed” as an excuse.'
  },
  restitution: {
    name: 'Making Restitution',
    target: 'Restoration of Safety',
    example: '“How can I make this right with you? What do you need to feel safe again?”',
    icon: '🎁',
    prompt: 'Offer a tangible act of service, care, or space to begin rebuilding equilibrium.'
  },
  repentance: {
    name: 'Genuinely Repenting',
    target: 'Future Behavior Change',
    example: '“Here is the specific boundary I am establishing so this doesn’t happen again.”',
    icon: '🔄',
    prompt: 'What concrete change or habit will you practice when this trigger arises next time?'
  },
  forgiveness: {
    name: 'Requesting Forgiveness',
    target: 'Humility & Patience',
    example: '“Will you forgive me? Please take all the time your heart needs.”',
    icon: '🕊️',
    prompt: 'Ask gently for reconciliation, granting your partner complete freedom in their timing.'
  }
};

// Procedural Web Audio 528Hz Reconciliation Chime
function playReconciliationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonic triad: 528Hz, 660Hz, 792Hz
    [528, 660, 792, 1056].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.0001, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.09 / (i + 1), now + i * 0.08 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 3.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 3.2);
    });
  } catch (e) {
    // ignore
  }
}

export const RepairBridgeView: React.FC<RepairBridgeViewProps> = ({
  repairLetters,
  activeUser,
  onSendRepair,
  onRespondRepair,
  onSendToChat
}) => {
  const partnerName = activeUser === 'user' ? 'Partner' : 'You';
  const partnerId = activeUser === 'user' ? 'partner' : 'user';

  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'compose'>('received');

  // Form states for creating a new sincere apology
  const [title, setTitle] = useState('');
  const [situationSummary, setSituationSummary] = useState('');
  const [primaryLang, setPrimaryLang] = useState<ApologyLanguage>('responsibility');
  const [regret, setRegret] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [restitution, setRestitution] = useState('');
  const [repentance, setRepentance] = useState('');
  const [forgiveness, setForgiveness] = useState('');

  // Selected letter for detailed inspection
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(
    repairLetters[0]?.id || null
  );
  const [responseNote, setResponseNote] = useState('');

  const receivedLetters = repairLetters.filter(l => l.recipientId === activeUser);
  const sentLetters = repairLetters.filter(l => l.authorId === activeUser);

  const selectedLetter = repairLetters.find(l => l.id === selectedLetterId) || repairLetters[0] || null;

  const handleSendRepairLetter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !situationSummary.trim()) return;

    const letter: RepairLetter = {
      id: newId('repair'),
      authorId: activeUser,
      authorName: activeUser === 'user' ? 'You' : 'Partner',
      recipientId: partnerId,
      title: title.trim(),
      situationSummary: situationSummary.trim(),
      primaryLanguage: primaryLang,
      expressionOfRegret: regret.trim() || 'I am deeply sorry that my actions hurt you.',
      ownershipNote: responsibility.trim() || 'I take complete ownership without excuses.',
      restitutionOffer: restitution.trim() || 'I want to do whatever is needed to restore your trust.',
      commitmentForNextTime: repentance.trim() || 'I am committing to pausing and breathing before responding next time.',
      forgivenessRequest: forgiveness.trim() || 'Will you forgive me whenever you feel ready?',
      sentAt: Date.now(),
      status: 'sent'
    };

    onSendRepair(letter);
    setSelectedLetterId(letter.id);
    setActiveTab('sent');

    // Reset fields
    setTitle('');
    setSituationSummary('');
    setRegret('');
    setResponsibility('');
    setRestitution('');
    setRepentance('');
    setForgiveness('');

    if ('vibrate' in navigator) {
      navigator.vibrate([70, 40, 90]);
    }
  };

  const handleAcceptRepair = (letterId: string) => {
    playReconciliationChime();
    onRespondRepair(letterId, 'accepted', responseNote.trim() || undefined);
    setResponseNote('');

    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
  };

  const handleNeedTime = (letterId: string) => {
    onRespondRepair(letterId, 'processing', responseNote.trim() || 'Thank you. I need a little quiet time for my feelings to settle.');
    setResponseNote('');

    if ('vibrate' in navigator) {
      navigator.vibrate([60, 40]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Handshake className="w-5 h-5 text-indigo-600" />
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-700">
              Wholehearted Reconciliation
            </span>
          </div>
          <h2 className="font-serif text-2xl font-bold text-linen-primary mt-1">
            The Repair Bridge
          </h2>
          <p className="text-xs text-linen-secondary mt-0.5">
            Based on the 5 Languages of Apology: craft wholehearted, non-defensive repairs and receive them with grace and zero pressure.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center space-x-1 bg-linen-surface border border-linen-border p-1 rounded-2xl shadow-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('received')}
            className={`px-3 py-1.5 rounded-xl text-xs font-serif transition-colors cursor-pointer ${
              activeTab === 'received' ? 'bg-linen-primary text-linen-surface font-semibold' : 'text-linen-secondary hover:text-linen-primary'
            }`}
          >
            Received ({receivedLetters.length})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-serif transition-colors cursor-pointer ${
              activeTab === 'sent' ? 'bg-linen-primary text-linen-surface font-semibold' : 'text-linen-secondary hover:text-linen-primary'
            }`}
          >
            Sent ({sentLetters.length})
          </button>
          <button
            onClick={() => setActiveTab('compose')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-serif transition-colors cursor-pointer flex items-center space-x-1 ${
              activeTab === 'compose' ? 'bg-indigo-600 text-white font-semibold' : 'text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Craft Repair</span>
          </button>
        </div>
      </div>

      {/* Anti-Defensiveness Reminder Card */}
      <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 via-linen-surface to-blue-50/40 p-4 sm:p-5 flex items-start space-x-3.5 shadow-xs">
        <Feather className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-900">
            The Non-Defensive Heart
          </h4>
          <p className="text-xs font-serif text-linen-primary leading-relaxed">
            A real apology never uses the word <em>“but”</em>. It owns the rupture, cares for the wound, and gives the other person permission to heal in their own time.
          </p>
        </div>
      </div>

      {/* View Mode: Compose New Repair Letter */}
      {activeTab === 'compose' && (
        <form onSubmit={handleSendRepairLetter} className="rounded-3xl border border-linen-border bg-linen-surface p-6 shadow-xs space-y-6 animate-fade-in">
          <div className="border-b border-linen-border pb-3">
            <h3 className="font-serif text-lg font-bold text-linen-primary">
              Craft a Wholehearted Apology
            </h3>
            <p className="text-xs text-linen-secondary mt-0.5">
              Follow the 5 steps to ensure your apology is complete, clear, and comforting.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-linen-secondary mb-1">
              What Happened (The Rupture)
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Raising my voice during dinner prep on Tuesday..."
              className="w-full px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-indigo-600 font-serif"
            />
          </div>

          {/* Primary Apology Language Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-linen-secondary mb-2">
              Select Primary Apology Language
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {Object.entries(APOLOGY_LANGUAGES_META).map(([key, meta]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setPrimaryLang(key as ApologyLanguage)}
                  className={`p-3 rounded-2xl border text-left transition-colors cursor-pointer space-y-1 ${
                    primaryLang === key
                      ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                      : 'border-linen-border hover:bg-linen-variant/40'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{meta.icon}</span>
                    <span className="font-serif text-xs font-semibold text-linen-primary">{meta.name}</span>
                  </div>
                  <p className="text-[10px] text-linen-secondary font-serif">{meta.target}</p>
                </button>
              ))}
            </div>
          </div>

          {/* The 5 Non-Defensive Steps */}
          <div className="space-y-4 pt-2 border-t border-linen-border">
            <div>
              <span className="text-xs font-semibold text-linen-primary flex items-center space-x-1.5 mb-1">
                <span>1.</span>
                <span>Expressing Regret (The Hurt Caused)</span>
              </span>
              <textarea
                rows={2}
                value={regret}
                onChange={e => setRegret(e.target.value)}
                placeholder="e.g. I am deeply sorry for how my harsh tone made you feel small and unsafe..."
                className="w-full px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-indigo-600 font-serif"
              />
            </div>

            <div>
              <span className="text-xs font-semibold text-linen-primary flex items-center space-x-1.5 mb-1">
                <span>2.</span>
                <span>Accepting Clean Responsibility (Zero Excuses)</span>
              </span>
              <textarea
                rows={2}
                value={responsibility}
                onChange={e => setResponsibility(e.target.value)}
                placeholder="e.g. I was tired, but taking that out on you was completely wrong. You did nothing to deserve that..."
                className="w-full px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-indigo-600 font-serif"
              />
            </div>

            <div>
              <span className="text-xs font-semibold text-linen-primary flex items-center space-x-1.5 mb-1">
                <span>3.</span>
                <span>Making Restitution (Restoring Care & Balance)</span>
              </span>
              <textarea
                rows={2}
                value={restitution}
                onChange={e => setRestitution(e.target.value)}
                placeholder="e.g. I want to take complete care of dinner tonight while you relax with your book..."
                className="w-full px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-indigo-600 font-serif"
              />
            </div>

            <div>
              <span className="text-xs font-semibold text-linen-primary flex items-center space-x-1.5 mb-1">
                <span>4.</span>
                <span>Repentance (My Concrete Commitment for Next Time)</span>
              </span>
              <textarea
                rows={2}
                value={repentance}
                onChange={e => setRepentance(e.target.value)}
                placeholder="e.g. When I arrive home feeling overwhelmed, I will explicitly ask for 15 mins of decompression before talking logistics..."
                className="w-full px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-indigo-600 font-serif"
              />
            </div>

            <div>
              <span className="text-xs font-semibold text-linen-primary flex items-center space-x-1.5 mb-1">
                <span>5.</span>
                <span>Requesting Forgiveness (With Patient Freedom)</span>
              </span>
              <input
                type="text"
                value={forgiveness}
                onChange={e => setForgiveness(e.target.value)}
                placeholder="e.g. I love and respect you deeply. Will you forgive me in your own time?"
                className="w-full px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-indigo-600 font-serif"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-linen-border flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setActiveTab('received')}
              className="px-4 py-2 rounded-xl border border-linen-border text-xs text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Wholehearted Repair</span>
            </button>
          </div>
        </form>
      )}

      {/* View Mode: Letter Inspection (Received or Sent) */}
      {activeTab !== 'compose' && selectedLetter && (
        <div className="rounded-3xl border border-linen-border bg-linen-surface p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-linen-border pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-serif px-2.5 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800">
                  {APOLOGY_LANGUAGES_META[selectedLetter.primaryLanguage]?.icon}{' '}
                  {APOLOGY_LANGUAGES_META[selectedLetter.primaryLanguage]?.name}
                </span>
                <span className="text-xs text-linen-secondary">
                  {new Date(selectedLetter.sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <h3 className="font-serif text-xl font-bold text-linen-primary mt-1">
                {selectedLetter.title}
              </h3>
              <p className="text-xs text-linen-secondary mt-0.5">
                From: <strong>{selectedLetter.authorName}</strong>
              </p>
            </div>

            <div className="self-start sm:self-auto">
              <span className={`px-3 py-1 rounded-full text-xs font-serif font-medium border ${
                selectedLetter.status === 'accepted'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : selectedLetter.status === 'processing'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-800'
              }`}>
                {selectedLetter.status === 'accepted' ? '✓ Reconciled & Accepted' : selectedLetter.status === 'processing' ? '⏳ Feelings In Process' : 'Waiting for Response'}
              </span>
            </div>
          </div>

          {/* Letter Contents Deck */}
          <div className="space-y-4 text-xs font-serif text-linen-primary">
            <div className="p-3.5 rounded-2xl bg-linen-variant/40 border border-linen-border/60">
              <span className="font-semibold text-linen-secondary uppercase tracking-wider text-[10px] block mb-1">
                1. Expression of Regret
              </span>
              <p className="leading-relaxed italic">“{selectedLetter.expressionOfRegret}”</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-linen-variant/40 border border-linen-border/60">
              <span className="font-semibold text-linen-secondary uppercase tracking-wider text-[10px] block mb-1">
                2. Clean Responsibility & Ownership
              </span>
              <p className="leading-relaxed italic">“{selectedLetter.ownershipNote}”</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-linen-variant/40 border border-linen-border/60">
              <span className="font-semibold text-linen-secondary uppercase tracking-wider text-[10px] block mb-1">
                3. Offer of Restitution
              </span>
              <p className="leading-relaxed italic">“{selectedLetter.restitutionOffer}”</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-linen-variant/40 border border-linen-border/60">
              <span className="font-semibold text-linen-secondary uppercase tracking-wider text-[10px] block mb-1">
                4. Concrete Change Commitment
              </span>
              <p className="leading-relaxed italic">“{selectedLetter.commitmentForNextTime}”</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200/80">
              <span className="font-semibold text-indigo-800 uppercase tracking-wider text-[10px] block mb-1">
                5. Gentle Request for Forgiveness
              </span>
              <p className="leading-relaxed text-indigo-950 font-medium italic">“{selectedLetter.forgivenessRequest}”</p>
            </div>
          </div>

          {/* Partner Response Note (if already responded) */}
          {selectedLetter.recipientResponseNote && (
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-1">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                Response Received:
              </span>
              <p className="text-xs font-serif text-linen-primary italic">
                “{selectedLetter.recipientResponseNote}”
              </p>
            </div>
          )}

          {/* Recipient Response Action Panel (Only if user is recipient and not accepted) */}
          {selectedLetter.recipientId === activeUser && selectedLetter.status !== 'accepted' && (
            <div className="pt-4 border-t border-linen-border space-y-3">
              <span className="text-xs font-serif font-medium text-linen-primary block">
                How does your heart feel about this repair? (Take all the time you need)
              </span>

              <input
                type="text"
                value={responseNote}
                onChange={e => setResponseNote(e.target.value)}
                placeholder="Optional gentle reflection or reassurance back to them..."
                className="w-full px-3.5 py-2 text-xs rounded-2xl bg-linen-bg border border-linen-border text-linen-primary focus:outline-none focus:border-indigo-600 font-serif"
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleAcceptRepair(selectedLetter.id)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>I Accept Your Apology (Reconcile)</span>
                </button>

                <button
                  onClick={() => handleNeedTime(selectedLetter.id)}
                  className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-medium hover:bg-amber-100 transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Thank you • I need quiet time to process</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
