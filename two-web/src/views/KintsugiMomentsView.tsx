import React, { useState } from 'react';
import { KintsugiVesselItem, KintsugiThemeTag } from '../types';
import {
  Sparkles,
  Heart,
  Calendar,
  Plus,
  Share2,
  Check,
  Shield,
  MessageCircle,
  Feather,
  Compass,
  Layers,
  ChevronRight,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { newId } from '../core/ids';

interface KintsugiMomentsViewProps {
  moments: KintsugiVesselItem[];
  activeUser: 'user' | 'partner';
  onAddMoment: (moment: KintsugiVesselItem) => void;
  onCherishMoment: (momentId: string, note?: string) => void;
  onSendToChat?: (text: string) => void;
}

const THEME_TAGS: Record<KintsugiThemeTag, { label: string; icon: string; bg: string; text: string; border: string }> = {
  distance: { label: 'Distance & Time', icon: '✈️', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  finances: { label: 'Financial Stress', icon: '🪙', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  family: { label: 'Family & Boundaries', icon: '🏡', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  vulnerability: { label: 'Vulnerability & Fear', icon: '🕊️', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  grief: { label: 'Grief & Loss', icon: '🌧️', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  communication: { label: 'Miscommunication', icon: '💬', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  growth: { label: 'Life Transition & Growth', icon: '🌱', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' }
};

// 5 organic crack seam paths for the SVG vessel
const SEAM_CONFIGS = [
  {
    index: 0,
    title: 'Crown & Shoulder Seam',
    d: 'M 195,95 Q 185,125 205,150 T 175,195 Q 160,230 180,260',
    marker: { cx: 180, cy: 260 }
  },
  {
    index: 1,
    title: 'Right Flank & Belly Seam',
    d: 'M 255,140 Q 285,175 270,225 T 290,285 Q 265,330 235,355',
    marker: { cx: 270, cy: 225 }
  },
  {
    index: 2,
    title: 'Central Heart Seam',
    d: 'M 155,210 Q 185,245 220,240 T 260,280 Q 240,320 200,340',
    marker: { cx: 220, cy: 240 }
  },
  {
    index: 3,
    title: 'Left Hip & Base Seam',
    d: 'M 140,270 Q 120,310 145,350 T 165,390 Q 180,410 190,418',
    marker: { cx: 145, cy: 350 }
  },
  {
    index: 4,
    title: 'Lower Foundation Seam',
    d: 'M 260,340 Q 235,375 245,400 T 215,418 Q 205,420 195,420',
    marker: { cx: 245, cy: 400 }
  }
];

export const KintsugiMomentsView: React.FC<KintsugiMomentsViewProps> = ({
  moments,
  activeUser,
  onAddMoment,
  onCherishMoment,
  onSendToChat
}) => {
  const [selectedSeamIndex, setSelectedSeamIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'vessel' | 'chronicle'>('vessel');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [showInscribeModal, setShowInscribeModal] = useState(false);
  const [seamSlotForModal, setSeamSlotForModal] = useState<number>(0);

  // Inscribe form state
  const [title, setTitle] = useState('');
  const [themeTag, setThemeTag] = useState<KintsugiThemeTag>('growth');
  const [hardshipStory, setHardshipStory] = useState('');
  const [wisdomLearned, setWisdomLearned] = useState('');
  const [overcomeDate, setOvercomeDate] = useState('');
  const [chosenSeam, setChosenSeam] = useState<number>(0);

  // Cherish note modal state
  const [showCherishPrompt, setShowCherishPrompt] = useState(false);
  const [cherishNoteInput, setCherishNoteInput] = useState('');
  const [targetMomentIdForCherish, setTargetMomentIdForCherish] = useState<string | null>(null);

  // Procedural Web Audio: Resonant Japanese porcelain singing bell
  const playKintsugiChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Porcelain fundamental bell (F#5 ~ 740Hz) + upper harmonics
      const freqs = [740, 1480, 2220, 3700];
      const gains = [0.18, 0.09, 0.05, 0.02];

      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, now);

        gainNode.gain.setValueAtTime(gains[i], now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 2.8 + i * 0.4);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 3.2);
      });
    } catch (e) {
      console.warn('Audio Context error', e);
    }
  };

  const handleOpenInscribe = (slotIndex?: number) => {
    const slot = slotIndex !== undefined ? slotIndex : (moments.length % 5);
    setChosenSeam(slot);
    setSeamSlotForModal(slot);
    setTitle('');
    setHardshipStory('');
    setWisdomLearned('');
    setOvercomeDate('Recently');
    setShowInscribeModal(true);
  };

  const handleSubmitInscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !hardshipStory.trim() || !wisdomLearned.trim()) return;

    const newMoment: KintsugiVesselItem = {
      id: newId('kintsugi'),
      title: title.trim(),
      themeTag,
      hardshipStory: hardshipStory.trim(),
      wisdomLearned: wisdomLearned.trim(),
      goldSeamIndex: chosenSeam,
      overcomeDate: overcomeDate.trim() || 'Recently',
      inscribedBy: activeUser,
      inscribedByName: activeUser === 'user' ? 'You' : 'Partner',
      inscribedAt: Date.now(),
      isCherished: false
    };

    onAddMoment(newMoment);
    setSelectedSeamIndex(chosenSeam);
    playKintsugiChime();
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 80]);
    }
    setShowInscribeModal(false);
  };

  const handleOpenCherish = (momentId: string) => {
    setTargetMomentIdForCherish(momentId);
    setCherishNoteInput('');
    setShowCherishPrompt(true);
  };

  const handleConfirmCherish = () => {
    if (!targetMomentIdForCherish) return;
    onCherishMoment(targetMomentIdForCherish, cherishNoteInput.trim() || undefined);
    playKintsugiChime();
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
    setShowCherishPrompt(false);
    setTargetMomentIdForCherish(null);
  };

  const handleShareMomentToChat = (moment: KintsugiVesselItem) => {
    if (!onSendToChat) return;
    const text = `🏺 *Kintsugi Scar Overcome: ${moment.title}*\n"${moment.wisdomLearned}"\n(Weathered: ${moment.overcomeDate})`;
    onSendToChat(text);
  };

  // Find moment currently mapped to selected seam
  const selectedMoment = moments.find(m => m.goldSeamIndex === selectedSeamIndex) || moments[0];

  const filteredMoments = filterTag === 'all'
    ? moments
    : moments.filter(m => m.themeTag === filterTag);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* 1. Header Banner with Japanese Kintsugi Philosophy */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-850 to-amber-950/90 text-stone-100 p-6 sm:p-8 shadow-xl border border-amber-500/30">
        <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-amber-500/15 via-transparent to-transparent pointer-events-none rounded-full blur-2xl -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Kintsugi 金継ぎ • The Art of Golden Joinery</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl text-stone-100 font-normal tracking-wide">
              Kintsugi Moments
            </h2>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              Every long-term love has weathered storms. In Kintsugi, breakage is never concealed or lamented—it is mended with lacquer and dusted with pure gold, making the repaired vessel more resilient and luminous than before it broke.
            </p>
          </div>

          <div className="flex flex-row md:flex-col gap-2 shrink-0">
            <button
              onClick={() => handleOpenInscribe()}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-medium text-xs sm:text-sm shadow-lg shadow-amber-900/40 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-stone-950" />
              <span>Inscribe Golden Seam</span>
            </button>
            <div className="flex rounded-xl bg-stone-800/80 p-1 border border-stone-700">
              <button
                onClick={() => setViewMode('vessel')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'vessel'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                🏺 Ceramic Vessel
              </button>
              <button
                onClick={() => setViewMode('chronicle')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'chronicle'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                📜 Chronicle ({moments.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Mode A: The Interactive Ceramic Vessel View */}
      {viewMode === 'vessel' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Ceramic Vessel Canvas */}
          <div className="lg:col-span-6 rounded-3xl border border-linen-border bg-gradient-to-b from-linen-surface via-amber-50/20 to-linen-variant/40 p-6 flex flex-col items-center justify-center relative shadow-sm">
            <div className="text-center mb-4">
              <p className="text-xs font-medium text-amber-700 tracking-wider uppercase">
                Interactive Ceramic Urn
              </p>
              <p className="text-xs text-linen-secondary mt-0.5">
                Tap any glowing golden seam to unveil the overcome chapter
              </p>
            </div>

            {/* SVG Vessel with Golden Lacquer Cracks */}
            <div className="relative w-full max-w-[340px] aspect-[400/480] flex items-center justify-center">
              <svg
                viewBox="0 0 400 480"
                className="w-full h-full drop-shadow-xl select-none"
                style={{ filter: 'drop-shadow(0 12px 24px rgba(180, 140, 100, 0.15))' }}
              >
                <defs>
                  {/* Ceramic Body Gradients */}
                  <linearGradient id="ceramicGlaze" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f7f3ee" />
                    <stop offset="40%" stopColor="#ede4d8" />
                    <stop offset="75%" stopColor="#d9cbb8" />
                    <stop offset="100%" stopColor="#c5b39e" />
                  </linearGradient>

                  <linearGradient id="ceramicRim" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#bfae9b" />
                    <stop offset="100%" stopColor="#8d7966" />
                  </linearGradient>

                  {/* Golden Lacquer Gradient */}
                  <linearGradient id="goldLacquer" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="35%" stopColor="#f59e0b" />
                    <stop offset="70%" stopColor="#d97706" />
                    <stop offset="100%" stopColor="#fde047" />
                  </linearGradient>

                  {/* Shimmering Golden Glow Filter */}
                  <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="glow" />
                    <feComposite in="SourceGraphic" in2="glow" operator="over" />
                  </filter>

                  <filter id="goldGlowActive" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="5.5" result="glow" />
                    <feComposite in="SourceGraphic" in2="glow" operator="over" />
                  </filter>
                </defs>

                {/* Vessel Shadow */}
                <ellipse cx="200" cy="445" rx="90" ry="14" fill="#a89a88" opacity="0.4" />

                {/* Ceramic Vessel Body (Japanese antique vase silhouette) */}
                <path
                  d="M 160,70
                     C 160,85 150,95 140,110
                     C 115,145 90,200 90,270
                     C 90,360 135,425 160,430
                     L 240,430
                     C 265,425 310,360 310,270
                     C 310,200 285,145 260,110
                     C 250,95 240,85 240,70
                     Z"
                  fill="url(#ceramicGlaze)"
                  stroke="#c5b39e"
                  strokeWidth="2"
                />

                {/* Ceramic Rim Highlight & Opening */}
                <ellipse cx="200" cy="70" rx="40" ry="10" fill="url(#ceramicRim)" stroke="#8d7966" strokeWidth="2" />
                <ellipse cx="200" cy="72" rx="30" ry="6" fill="#6f5e4f" opacity="0.8" />

                {/* Pedestal Base */}
                <path
                  d="M 160,430 L 155,442 C 155,446 175,448 200,448 C 225,448 245,446 245,442 L 240,430 Z"
                  fill="#9a8673"
                  stroke="#7c6a58"
                  strokeWidth="1.5"
                />

                {/* Subtle Ceramic Texture/Light Glaze Arc */}
                <path
                  d="M 125,180 Q 115,260 135,340"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="6"
                  strokeLinecap="round"
                  opacity="0.25"
                />

                {/* 5 Organic Kintsugi Seam Paths */}
                {SEAM_CONFIGS.map(seam => {
                  const moment = moments.find(m => m.goldSeamIndex === seam.index);
                  const isSelected = selectedSeamIndex === seam.index;
                  const hasMoment = !!moment;

                  return (
                    <g
                      key={seam.index}
                      className="cursor-pointer transition-all duration-300 group"
                      onClick={() => {
                        setSelectedSeamIndex(seam.index);
                        playKintsugiChime();
                        if ('vibrate' in navigator) {
                          navigator.vibrate(30);
                        }
                      }}
                    >
                      {/* Wide invisible stroke for easy tapping */}
                      <path
                        d={seam.d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="28"
                        strokeLinecap="round"
                      />

                      {/* The Visible Seam Path */}
                      <path
                        d={seam.d}
                        fill="none"
                        stroke={
                          hasMoment
                            ? 'url(#goldLacquer)'
                            : isSelected
                            ? '#d97706'
                            : '#c5b39e'
                        }
                        strokeWidth={hasMoment ? (isSelected ? '5.5' : '3.8') : '1.8'}
                        strokeDasharray={hasMoment ? 'none' : '4,3'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter={hasMoment ? (isSelected ? 'url(#goldGlowActive)' : 'url(#goldGlow)') : undefined}
                        className={hasMoment ? 'transition-all duration-300' : 'opacity-60 hover:opacity-100'}
                      />

                      {/* Gold Seam Indicator Node */}
                      {hasMoment ? (
                        <g transform={`translate(${seam.marker.cx}, ${seam.marker.cy})`}>
                          <circle
                            r={isSelected ? '8' : '5'}
                            fill="#f59e0b"
                            stroke="#ffffff"
                            strokeWidth="2"
                            filter="url(#goldGlow)"
                            className={isSelected ? 'animate-ping opacity-75' : ''}
                          />
                          <circle
                            r={isSelected ? '6' : '4.5'}
                            fill="#fef08a"
                            stroke="#d97706"
                            strokeWidth="1.5"
                          />
                        </g>
                      ) : (
                        <g transform={`translate(${seam.marker.cx}, ${seam.marker.cy})`} opacity="0.6">
                          <circle r="4" fill="#d9cbb8" stroke="#a89a88" strokeWidth="1" />
                          <text
                            x="0"
                            y="2.5"
                            fontSize="8"
                            textAnchor="middle"
                            fill="#7c6a58"
                            fontWeight="bold"
                          >
                            +
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Quick Seam Selector Ribbon */}
            <div className="w-full flex items-center justify-between gap-1.5 mt-4 pt-4 border-t border-linen-border/70">
              {SEAM_CONFIGS.map(seam => {
                const moment = moments.find(m => m.goldSeamIndex === seam.index);
                const isSelected = selectedSeamIndex === seam.index;

                return (
                  <button
                    key={seam.index}
                    onClick={() => {
                      setSelectedSeamIndex(seam.index);
                      playKintsugiChime();
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium transition-all text-center cursor-pointer ${
                      isSelected
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold shadow-2xs'
                        : moment
                        ? 'bg-amber-50/70 text-amber-800 border border-amber-200/60 hover:bg-amber-100/50'
                        : 'bg-linen-surface/80 text-linen-secondary border border-linen-border/60 hover:text-linen-primary'
                    }`}
                  >
                    <span className="block text-[10px] uppercase tracking-wider text-amber-700/70">
                      Seam {seam.index + 1}
                    </span>
                    <span className="truncate block max-w-[75px] mx-auto text-[11px]">
                      {moment ? moment.title.split(' ')[0] : '+ Open'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Seam Story Card */}
          <div className="lg:col-span-6 space-y-4">
            {selectedMoment ? (
              <div className="rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50/40 via-linen-surface to-linen-surface p-6 sm:p-7 shadow-sm space-y-5">
                {/* Meta header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                        <Sparkles className="w-3 h-3 text-amber-600 mr-1" />
                        Seam #{selectedMoment.goldSeamIndex + 1}
                      </span>
                      {THEME_TAGS[selectedMoment.themeTag] && (
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${THEME_TAGS[selectedMoment.themeTag].bg} ${THEME_TAGS[selectedMoment.themeTag].text} ${THEME_TAGS[selectedMoment.themeTag].border}`}
                        >
                          <span>{THEME_TAGS[selectedMoment.themeTag].icon}</span>
                          <span>{THEME_TAGS[selectedMoment.themeTag].label}</span>
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-xl sm:text-2xl text-linen-primary font-normal leading-snug">
                      {selectedMoment.title}
                    </h3>
                    <p className="text-xs text-linen-secondary flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-700" />
                      <span>Weathered together: {selectedMoment.overcomeDate}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleShareMomentToChat(selectedMoment)}
                    className="p-2 text-linen-secondary hover:text-amber-800 hover:bg-amber-100/60 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Share this overcome memory into chat"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Fracture Section (The Test) */}
                <div className="p-4 rounded-2xl bg-rose-50/40 border border-rose-200/60 space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-rose-800 text-xs font-semibold uppercase tracking-wider">
                    <Feather className="w-3.5 h-3.5 text-rose-600" />
                    <span>The Fracture • What Tested Us</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-700 leading-relaxed italic">
                    “{selectedMoment.hardshipStory}”
                  </p>
                </div>

                {/* Golden Lacquer Section (The Wisdom & Repair) */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/40 border border-amber-300/80 space-y-2 shadow-2xs">
                  <div className="flex items-center space-x-1.5 text-amber-900 text-xs font-semibold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>The Golden Seam • How We Healed & Grew</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">
                    {selectedMoment.wisdomLearned}
                  </p>
                </div>

                {/* Sign-off & Cherish Section */}
                <div className="pt-3 border-t border-linen-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-linen-secondary">
                    Inscribed by <span className="font-medium text-linen-primary">{selectedMoment.inscribedByName}</span>
                  </div>

                  {selectedMoment.isCherished ? (
                    <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-900 text-xs">
                      <Heart className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                      <span className="font-medium">Honored & Cherished</span>
                      {selectedMoment.cherishedNote && (
                        <span className="text-amber-800 text-[11px] italic">
                          • “{selectedMoment.cherishedNote}”
                        </span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenCherish(selectedMoment.id)}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <Heart className="w-3.5 h-3.5 text-amber-600" />
                      <span>Honor & Cherish This Scar</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-linen-border bg-linen-surface/50 p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="font-serif text-lg text-linen-primary font-medium">
                  Seam #{selectedSeamIndex + 1} Awaiting Your History
                </h4>
                <p className="text-xs text-linen-secondary max-w-sm mx-auto">
                  This part of your ceramic vessel has not been inscribed yet. Have you weathered a trial that deserves to be commemorated in gold?
                </p>
                <button
                  onClick={() => handleOpenInscribe(selectedSeamIndex)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-medium hover:bg-amber-500 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Inscribe Seam #{selectedSeamIndex + 1}</span>
                </button>
              </div>
            )}

            {/* Quick Inspiration Accordion / Callout */}
            <div className="p-4 rounded-2xl bg-linen-variant/30 border border-linen-border text-xs text-linen-secondary leading-relaxed flex items-start space-x-3">
              <Shield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-linen-primary block mb-0.5">
                  The Resilience Principle
                </span>
                Couples who thrive long-term do not have conflict-free lives; they possess shared stories of overcoming. Honoring the repairs keeps you grounded when future turbulence arrives.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Mode B: The Chronicle of Resilience (Card Feed) */}
      {viewMode === 'chronicle' && (
        <div className="space-y-6">
          {/* Filter Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-xs font-medium text-linen-secondary flex items-center mr-1">
              <Filter className="w-3.5 h-3.5 mr-1" />
              Filter:
            </span>
            <button
              onClick={() => setFilterTag('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                filterTag === 'all'
                  ? 'bg-amber-700 text-white'
                  : 'bg-linen-surface border border-linen-border text-linen-secondary hover:text-linen-primary'
              }`}
            >
              All Scars ({moments.length})
            </button>
            {(Object.keys(THEME_TAGS) as KintsugiThemeTag[]).map(key => {
              const tag = THEME_TAGS[key];
              const count = moments.filter(m => m.themeTag === key).length;
              if (count === 0) return null;
              return (
                <button
                  key={key}
                  onClick={() => setFilterTag(key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    filterTag === key
                      ? 'bg-amber-700 text-white'
                      : 'bg-linen-surface border border-linen-border text-linen-secondary hover:text-linen-primary'
                  }`}
                >
                  {tag.icon} {tag.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMoments.map(moment => (
              <div
                key={moment.id}
                className="rounded-3xl border border-linen-border bg-linen-surface p-5 hover:border-amber-300 transition-all shadow-xs space-y-3.5 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                      ✨ Seam #{moment.goldSeamIndex + 1}
                    </span>
                    <span className="text-[11px] text-linen-secondary flex items-center">
                      <Calendar className="w-3 h-3 mr-1 text-amber-700" />
                      {moment.overcomeDate}
                    </span>
                  </div>

                  <h4 className="font-serif text-base text-linen-primary font-medium">
                    {moment.title}
                  </h4>

                  <div className="space-y-2 text-xs">
                    <p className="text-stone-600 line-clamp-2 italic bg-stone-50 p-2.5 rounded-xl border border-stone-200/60">
                      “{moment.hardshipStory}”
                    </p>
                    <p className="text-stone-800 font-medium bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/80">
                      💛 {moment.wisdomLearned}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-linen-border/60 flex items-center justify-between text-xs">
                  <span className="text-linen-secondary text-[11px]">
                    Inscribed by {moment.inscribedByName}
                  </span>
                  <div className="flex items-center space-x-2">
                    {moment.isCherished ? (
                      <span className="inline-flex items-center text-amber-700 text-[11px] font-medium">
                        <Heart className="w-3 h-3 fill-amber-500 mr-1" />
                        Cherished
                      </span>
                    ) : (
                      <button
                        onClick={() => handleOpenCherish(moment.id)}
                        className="text-amber-800 hover:text-amber-900 font-medium text-[11px]"
                      >
                        + Cherish
                      </button>
                    )}
                    <button
                      onClick={() => handleShareMomentToChat(moment)}
                      className="p-1 text-linen-secondary hover:text-amber-800"
                      title="Share to chat"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Modal: Inscribe New Golden Seam */}
      {showInscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-linen-border pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-serif">
                  🏺
                </div>
                <div>
                  <h3 className="font-serif text-lg font-medium text-linen-primary">
                    Inscribe an Overcome Challenge
                  </h3>
                  <p className="text-xs text-linen-secondary">
                    Commemorating resilience in golden lacquer
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInscribeModal(false)}
                className="text-linen-secondary hover:text-linen-primary text-xl font-light p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitInscribe} className="space-y-4">
              {/* Seam Slot Selector */}
              <div>
                <label className="block text-xs font-semibold text-linen-primary uppercase tracking-wider mb-1.5">
                  Vessel Seam Slot
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {SEAM_CONFIGS.map(seam => (
                    <button
                      type="button"
                      key={seam.index}
                      onClick={() => setChosenSeam(seam.index)}
                      className={`p-2 rounded-xl text-xs font-medium text-center border transition-all cursor-pointer ${
                        chosenSeam === seam.index
                          ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold shadow-2xs'
                          : 'bg-linen-surface border-linen-border text-linen-secondary hover:bg-linen-variant'
                      }`}
                    >
                      Seam {seam.index + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-linen-primary uppercase tracking-wider mb-1">
                  Title of Hardship or Trial
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., The 4-Month Long Distance Trial, The Moving Day Crisis"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-linen-border bg-linen-variant/40 text-linen-primary text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              {/* Theme Tag */}
              <div>
                <label className="block text-xs font-semibold text-linen-primary uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(THEME_TAGS) as KintsugiThemeTag[]).map(key => {
                    const tag = THEME_TAGS[key];
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setThemeTag(key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          themeTag === key
                            ? 'bg-amber-800 text-white border-amber-800 shadow-2xs'
                            : 'bg-linen-surface border-linen-border text-linen-secondary hover:text-linen-primary'
                        }`}
                      >
                        {tag.icon} {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fracture Story */}
              <div>
                <label className="block text-xs font-semibold text-linen-primary uppercase tracking-wider mb-1">
                  The Fracture • What Felt Broken or Heavy?
                </label>
                <textarea
                  value={hardshipStory}
                  onChange={e => setHardshipStory(e.target.value)}
                  placeholder="Describe the moment or season that tested our love, without sugarcoating or resentment..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-linen-border bg-linen-variant/40 text-linen-primary text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              {/* Golden Seam (Wisdom) */}
              <div>
                <label className="block text-xs font-semibold text-linen-primary uppercase tracking-wider mb-1">
                  The Golden Seam • How Did We Repair & What Did We Learn?
                </label>
                <textarea
                  value={wisdomLearned}
                  onChange={e => setWisdomLearned(e.target.value)}
                  placeholder="What ritual, boundary, or deeper tenderness did we forge from this? What makes us stronger today?"
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-linen-border bg-linen-variant/40 text-linen-primary text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              {/* Season Weathered */}
              <div>
                <label className="block text-xs font-semibold text-linen-primary uppercase tracking-wider mb-1">
                  When Was This Weathered?
                </label>
                <input
                  type="text"
                  value={overcomeDate}
                  onChange={e => setOvercomeDate(e.target.value)}
                  placeholder="e.g., Autumn 2024, Our First Winter"
                  className="w-full px-3.5 py-2 rounded-xl border border-linen-border bg-linen-variant/40 text-linen-primary text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowInscribeModal(false)}
                  className="px-4 py-2 rounded-xl border border-linen-border text-linen-secondary hover:bg-linen-variant text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-medium shadow-md shadow-amber-900/20 cursor-pointer active:scale-95 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Inscribe in Gold</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Cherish Affirmation Prompt */}
      {showCherishPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                <Heart className="w-4 h-4 fill-amber-500" />
              </div>
              <div>
                <h4 className="font-serif text-base font-medium text-linen-primary">
                  Honor & Cherish This Scar
                </h4>
                <p className="text-xs text-linen-secondary">
                  Leave a personal word of gratitude
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-linen-secondary mb-1">
                Optional note or affirmation:
              </label>
              <input
                type="text"
                value={cherishNoteInput}
                onChange={e => setCherishNoteInput(e.target.value)}
                placeholder="e.g., So grateful we chose each other here."
                className="w-full px-3.5 py-2 rounded-xl border border-linen-border bg-linen-variant/40 text-linen-primary text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCherishPrompt(false)}
                className="px-3 py-1.5 rounded-xl border border-linen-border text-linen-secondary text-xs hover:bg-linen-variant"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCherish}
                className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-medium hover:bg-amber-500 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm Honor</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
