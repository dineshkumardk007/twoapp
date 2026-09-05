import React, { useState } from 'react';
import { ScratchCardItem, ScratchFoilType, ScratchCardCategory } from '../types';
import { ScratchCardCanvas } from '../components/ScratchCardCanvas';
import { Gift, Ticket, Sparkles, Heart, Plus, Check, MessageSquare, Clock, Award, X, RefreshCw, Send, ShieldCheck, Star } from 'lucide-react';

interface ScratchCardsViewProps {
  cards: ScratchCardItem[];
  activeUser: 'user' | 'partner';
  onScratchCard: (cardId: string) => void;
  onRedeemCard: (cardId: string) => void;
  onAddCard: (card: ScratchCardItem) => void;
  onSendToChat?: (message: string) => void;
}

const PRESET_CARDS = [
  {
    title: '30-Minute Scalp & Shoulder Massage',
    category: 'coupon' as ScratchCardCategory,
    foilType: 'gold' as ScratchFoilType,
    teaserHeadline: 'Scratch for tonight’s restorative pampering session',
    revealedContent: 'Redeemable for one 30-minute uninterrupted scalp, neck, and shoulder massage with warm lavender essential oil and soft ambient rain music.'
  },
  {
    title: 'Immunity Pass: Movie Choice Without Veto',
    category: 'coupon' as ScratchCardCategory,
    foilType: 'silver' as ScratchFoilType,
    teaserHeadline: 'Scratch for an unconditional couple privilege pass',
    revealedContent: 'You pick whatever movie or show you want tonight, and I will happily watch with freshly salted butter popcorn and zero vetoes or complaints.'
  },
  {
    title: 'Midnight Starlight Balcony Cocoa & Slow Dance',
    category: 'date_invitation' as ScratchCardCategory,
    foilType: 'rose_gold' as ScratchFoilType,
    teaserHeadline: 'Scratch for a midnight rendezvous invitation',
    revealedContent: 'Meet me on the balcony at 10:30 PM. Warm cinnamon hot chocolate, two wool blankets, and our favorite slow songs under the night sky.'
  },
  {
    title: 'Get Out of Dishes Duty Free Pass',
    category: 'coupon' as ScratchCardCategory,
    foilType: 'gold' as ScratchFoilType,
    teaserHeadline: 'Scratch for instant household relief',
    revealedContent: 'Hand this to me right after dinner. I do all the dishes, wipe every counter, take out the trash, and you go curl up on the sofa with a warm tea.'
  },
  {
    title: 'Secret Note: Why I Still Fall For You',
    category: 'secret_note' as ScratchCardCategory,
    foilType: 'holographic' as ScratchFoilType,
    teaserHeadline: 'Scratch to uncover a secret whispered from the heart',
    revealedContent: 'The way your eyes crinkle when you laugh at your own jokes, and the quiet safety I feel the instant you walk through the door. You are my home.'
  },
  {
    title: 'Spontaneous Sunday Sunrise Breakfast',
    category: 'date_invitation' as ScratchCardCategory,
    foilType: 'rose_gold' as ScratchFoilType,
    teaserHeadline: 'Scratch for this weekend’s breakfast treat',
    revealedContent: 'Warm toasted brioche, scrambled eggs with chives, freshly brewed dark roast coffee, and fresh orange juice delivered right to bed.'
  }
];

function playStampRedemptionSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Firm rubber stamp thud + bright celebratory resonance
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // Chime overtone
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'triangle';
    bell.frequency.setValueAtTime(880, now + 0.05);
    bellGain.gain.setValueAtTime(0.12, now + 0.05);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    bell.connect(bellGain);
    bellGain.connect(ctx.destination);
    bell.start(now + 0.05);
    bell.stop(now + 0.5);
  } catch (_) {}
}

export const ScratchCardsView: React.FC<ScratchCardsViewProps> = ({
  cards,
  activeUser,
  onScratchCard,
  onRedeemCard,
  onAddCard,
  onSendToChat
}) => {
  const [activeTab, setActiveTab] = useState<'surprises' | 'vault'>('surprises');
  const [filterRecipient, setFilterRecipient] = useState<'all' | 'for_you' | 'from_you'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ScratchCardCategory>('coupon');
  const [foilType, setFoilType] = useState<ScratchFoilType>('gold');
  const [recipient, setRecipient] = useState<'partner' | 'user'>('partner');
  const [teaserHeadline, setTeaserHeadline] = useState('');
  const [revealedContent, setRevealedContent] = useState('');
  const [revealedPhotoUrl, setRevealedPhotoUrl] = useState('');

  const filteredCards = cards.filter(card => {
    // Tab filter
    if (activeTab === 'surprises' && card.isRedeemed) return false;
    if (activeTab === 'vault' && !card.isRedeemed) return false;

    // Recipient filter
    if (filterRecipient === 'for_you' && card.recipientId !== activeUser) return false;
    if (filterRecipient === 'from_you' && card.authorId !== activeUser) return false;

    return true;
  });

  const handleApplyPreset = (preset: typeof PRESET_CARDS[0]) => {
    setTitle(preset.title);
    setCategory(preset.category);
    setFoilType(preset.foilType);
    setTeaserHeadline(preset.teaserHeadline);
    setRevealedContent(preset.revealedContent);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !revealedContent.trim()) return;

    const newCard: ScratchCardItem = {
      id: `scratch-${Date.now()}`,
      title: title.trim(),
      category,
      foilType,
      authorId: activeUser,
      authorName: activeUser === 'user' ? 'You' : 'Partner',
      recipientId: recipient,
      createdAt: 'Just now',
      teaserHeadline: teaserHeadline.trim() || 'Scratch with love to reveal what’s inside',
      revealedContent: revealedContent.trim(),
      revealedPhotoUrl: revealedPhotoUrl.trim() || undefined,
      isScratched: false,
      isRedeemed: false
    };

    onAddCard(newCard);
    setShowCreateModal(false);

    // Reset
    setTitle('');
    setTeaserHeadline('');
    setRevealedContent('');
    setRevealedPhotoUrl('');
  };

  const handleRedeem = (card: ScratchCardItem) => {
    playStampRedemptionSound();
    onRedeemCard(card.id);
    if (onSendToChat) {
      onSendToChat(`🎟️ I just redeemed our scratch coupon: "${card.title}"! ✨`);
    }
  };

  const getFoilBadgeStyle = (type: ScratchFoilType) => {
    switch (type) {
      case 'gold':
        return 'bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-500 text-amber-950 shadow-sm border border-amber-300';
      case 'rose_gold':
        return 'bg-gradient-to-r from-rose-300 via-pink-200 to-rose-400 text-rose-950 shadow-sm border border-rose-300';
      case 'silver':
        return 'bg-gradient-to-r from-slate-300 via-gray-100 to-slate-400 text-slate-900 shadow-sm border border-slate-300';
      case 'holographic':
        return 'bg-gradient-to-r from-pink-300 via-purple-300 to-cyan-300 text-purple-950 shadow-sm border border-purple-200';
    }
  };

  const getCategoryIcon = (cat: ScratchCardCategory) => {
    switch (cat) {
      case 'coupon':
        return <Ticket className="w-4 h-4 mr-1 text-amber-600" />;
      case 'secret_note':
        return <Heart className="w-4 h-4 mr-1 text-rose-500" />;
      case 'date_invitation':
        return <Sparkles className="w-4 h-4 mr-1 text-indigo-500" />;
      case 'compliment':
        return <Star className="w-4 h-4 mr-1 text-yellow-500" />;
    }
  };

  const activeSurprisesCount = cards.filter(c => !c.isRedeemed).length;
  const redeemedVaultCount = cards.filter(c => c.isRedeemed).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-linen-surface rounded-2xl p-6 border border-linen-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 mb-2">
            <Gift className="w-3.5 h-3.5 text-amber-600" />
            <span>Golden Scratch Surprises</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-linen-primary font-medium">
            Love Coupons & Scratch Surprises
          </h1>
          <p className="text-sm text-linen-secondary mt-1 max-w-xl">
            Scratch off shimmering gold foil with realistic friction audio to uncover secret pampering vouchers, sweet immunity passes, and tender date invitations.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-medium text-sm shadow-sm transition-all transform active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Craft a Surprise Card</span>
        </button>
      </div>

      {/* Navigation & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-linen-border pb-3">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('surprises')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'surprises'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant'
            }`}
          >
            Surprises to Scratch ({activeSurprisesCount})
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'vault'
                ? 'bg-linen-primary text-linen-surface shadow-sm'
                : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant'
            }`}
          >
            Redeemed Vault ({redeemedVaultCount})
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-linen-secondary">View:</span>
          <button
            onClick={() => setFilterRecipient('all')}
            className={`px-2.5 py-1 rounded-lg border transition-colors ${
              filterRecipient === 'all'
                ? 'bg-linen-variant text-linen-primary border-linen-primary/30 font-medium'
                : 'text-linen-secondary border-linen-border hover:bg-linen-variant/50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterRecipient('for_you')}
            className={`px-2.5 py-1 rounded-lg border transition-colors ${
              filterRecipient === 'for_you'
                ? 'bg-linen-variant text-linen-primary border-linen-primary/30 font-medium'
                : 'text-linen-secondary border-linen-border hover:bg-linen-variant/50'
            }`}
          >
            For You
          </button>
          <button
            onClick={() => setFilterRecipient('from_you')}
            className={`px-2.5 py-1 rounded-lg border transition-colors ${
              filterRecipient === 'from_you'
                ? 'bg-linen-variant text-linen-primary border-linen-primary/30 font-medium'
                : 'text-linen-secondary border-linen-border hover:bg-linen-variant/50'
            }`}
          >
            Created by You
          </button>
        </div>
      </div>

      {/* Cards List */}
      {filteredCards.length === 0 ? (
        <div className="bg-linen-surface rounded-2xl p-12 border border-dashed border-linen-border text-center">
          <Gift className="w-12 h-12 text-amber-400 mx-auto mb-3 opacity-60" />
          <h3 className="font-serif text-lg text-linen-primary font-medium">No surprise cards here yet</h3>
          <p className="text-sm text-linen-secondary max-w-sm mx-auto mt-1 mb-5">
            {activeTab === 'surprises'
              ? 'Surprise your partner with a gentle massage voucher, immunity pass, or spontaneous date invitation.'
              : 'Redeemed cards you have enjoyed together will be preserved here as cherished memories.'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-linen-variant hover:bg-linen-border text-linen-primary text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create a Scratch Card</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCards.map(card => {
            const isRecipient = card.recipientId === activeUser;

            return (
              <div
                key={card.id}
                className="bg-linen-surface rounded-2xl border border-linen-border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
              >
                {/* Card Top Metadata */}
                <div className="p-4 border-b border-linen-border/60 bg-linen-variant/20 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-linen-variant text-linen-primary border border-linen-border">
                      {getCategoryIcon(card.category)}
                      {card.category.replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getFoilBadgeStyle(card.foilType)}`}>
                      {card.foilType.replace('_', ' ')} foil
                    </span>
                  </div>

                  <div className="text-[11px] text-linen-secondary flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{card.createdAt}</span>
                  </div>
                </div>

                {/* Card Header */}
                <div className="px-5 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-linen-secondary">
                      {card.authorId === activeUser ? 'From you' : 'From partner'}{' '}
                      <span className="text-linen-secondary/60">→</span>{' '}
                      {isRecipient ? 'to you' : 'to partner'}
                    </span>
                    {card.isRedeemed && (
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Redeemed
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-lg font-medium text-linen-primary leading-snug">
                    {card.title}
                  </h3>
                  {!card.isScratched && (
                    <p className="text-xs text-amber-700/80 font-medium mt-0.5">
                      ✨ {card.teaserHeadline}
                    </p>
                  )}
                </div>

                {/* Scratchable Canvas & Revealed Area */}
                <div className="p-5 flex-1 flex flex-col justify-center">
                  <ScratchCardCanvas
                    foilType={card.foilType}
                    isCompleted={card.isScratched}
                    onScratchComplete={() => onScratchCard(card.id)}
                  >
                    {/* Content inside / revealed underneath */}
                    <div className="relative p-5 rounded-xl bg-gradient-to-br from-amber-50/70 via-rose-50/30 to-amber-100/40 border border-amber-200/70 text-center min-h-[160px] flex flex-col items-center justify-center">
                      {/* Redeemed Stamp Overlay */}
                      {card.isRedeemed && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <div className="transform -rotate-12 border-4 border-dashed border-rose-600/80 rounded-xl px-4 py-2 bg-white/70 backdrop-blur-xs shadow-sm">
                            <span className="font-serif text-base sm:text-lg font-black tracking-widest text-rose-700 uppercase">
                              REDEEMED & LOVED
                            </span>
                            <div className="text-[10px] tracking-normal font-sans text-rose-600/90 text-center mt-0.5">
                              {card.redeemedAt || 'Cherished memory'}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="max-w-xs mx-auto">
                        <Sparkles className="w-5 h-5 text-amber-500 mx-auto mb-2 opacity-80" />
                        <p className="font-serif text-sm sm:text-base text-linen-primary leading-relaxed italic">
                          "{card.revealedContent}"
                        </p>

                        {card.revealedPhotoUrl && (
                          <img
                            src={card.revealedPhotoUrl}
                            alt="Surprise attachment"
                            className="w-full max-h-36 object-cover rounded-lg mt-3 border border-linen-border shadow-xs"
                          />
                        )}
                      </div>
                    </div>
                  </ScratchCardCanvas>
                </div>

                {/* Card Footer Actions */}
                <div className="p-4 bg-linen-variant/20 border-t border-linen-border/60 flex items-center justify-between gap-2">
                  {!card.isScratched ? (
                    <div className="w-full flex items-center justify-between text-xs text-linen-secondary">
                      <span>Drag cursor or finger across foil to scratch</span>
                      <button
                        onClick={() => onScratchCard(card.id)}
                        className="text-[11px] text-amber-700 hover:text-amber-800 underline underline-offset-2 cursor-pointer"
                        title="Skip scratching animation"
                      >
                        Reveal all
                      </button>
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs text-linen-secondary font-medium">
                          {card.isRedeemed ? 'Honored in vault' : 'Unlocked & ready'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {onSendToChat && (
                          <button
                            onClick={() => onSendToChat(`💌 Regarding "${card.title}": ${card.revealedContent}`)}
                            className="p-1.5 text-linen-secondary hover:text-linen-primary hover:bg-linen-variant rounded-lg transition-colors"
                            title="Send to chat"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}

                        {!card.isRedeemed && (
                          <button
                            onClick={() => handleRedeem(card)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition-transform active:scale-95 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Redeem Coupon</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-linen-surface rounded-2xl max-w-lg w-full border border-linen-border shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-linen-border flex items-center justify-between bg-linen-variant/20">
              <div className="flex items-center space-x-2">
                <Gift className="w-5 h-5 text-amber-600" />
                <h3 className="font-serif text-lg font-medium text-linen-primary">
                  Craft a Scratch Surprise
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-linen-secondary hover:text-linen-primary rounded-lg hover:bg-linen-variant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 overflow-y-auto">
              {/* Presets Row */}
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1.5">
                  Quick Inspiration Presets
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pb-1">
                  {PRESET_CARDS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-linen-variant/60 hover:bg-linen-variant text-linen-primary border border-linen-border/60 transition-colors text-left"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Surprise Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Warm Candlelight Foot Massage"
                  className="w-full px-3.5 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {/* Foil Style Selector */}
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Metallic Scratch Foil *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['gold', 'rose_gold', 'silver', 'holographic'] as ScratchFoilType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFoilType(type)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all capitalize ${
                        foilType === type
                          ? `${getFoilBadgeStyle(type)} ring-2 ring-amber-500/50`
                          : 'bg-linen-variant text-linen-secondary border-linen-border hover:text-linen-primary'
                      }`}
                    >
                      {type.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category & Recipient */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as ScratchCardCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-xs focus:outline-hidden"
                  >
                    <option value="coupon">Love Coupon</option>
                    <option value="date_invitation">Date Invitation</option>
                    <option value="secret_note">Secret Note</option>
                    <option value="compliment">Tender Compliment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                    Recipient
                  </label>
                  <select
                    value={recipient}
                    onChange={e => setRecipient(e.target.value as 'partner' | 'user')}
                    className="w-full px-3 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-xs focus:outline-hidden"
                  >
                    <option value="partner">For Partner</option>
                    <option value="user">For You</option>
                  </select>
                </div>
              </div>

              {/* Teaser Headline */}
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Card Teaser (Visible on foil)
                </label>
                <input
                  type="text"
                  value={teaserHeadline}
                  onChange={e => setTeaserHeadline(e.target.value)}
                  placeholder="e.g. Scratch to uncover tonight’s pampering treat"
                  className="w-full px-3.5 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-sm focus:outline-hidden"
                />
              </div>

              {/* Revealed Secret Content */}
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Hidden Secret Content * (Revealed beneath foil)
                </label>
                <textarea
                  required
                  rows={3}
                  value={revealedContent}
                  onChange={e => setRevealedContent(e.target.value)}
                  placeholder="Write the full promise, sweet love letter, or coupon terms..."
                  className="w-full px-3.5 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {/* Photo URL (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-linen-secondary uppercase tracking-wider mb-1">
                  Optional Surprise Photo URL
                </label>
                <input
                  type="url"
                  value={revealedPhotoUrl}
                  onChange={e => setRevealedPhotoUrl(e.target.value)}
                  placeholder="https://... (photo reveals when scratched)"
                  className="w-full px-3.5 py-2 rounded-xl bg-linen-variant/50 border border-linen-border text-linen-primary text-xs focus:outline-hidden"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-linen-border flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-medium text-sm shadow-xs transition-transform active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Foil & Seal Card</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
