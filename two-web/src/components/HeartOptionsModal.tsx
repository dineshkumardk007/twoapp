import React, { useState } from 'react';
import { Heart, Sparkles, X, Send, Smartphone, Volume2, Smile, Check } from 'lucide-react';
import { triggerGlobalPulse } from './SensoryPulseOverlay';
import { playHeartbeatSound } from '../core/audioAlerts';

interface HeartOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName?: string;
}

interface HeartExpression {
  id: string;
  title: string;
  note: string;
  description: string;
  emoji: string;
  badge: string;
  type: 'chime' | 'heartbeat';
}

const HEART_EXPRESSIONS: HeartExpression[] = [
  {
    id: 'thinking_of_you',
    title: 'Thinking of You',
    note: 'Thinking of you right now',
    description: 'Subtle warmth • 528Hz Solfeggio love frequency chime',
    emoji: '💖',
    badge: 'Classic',
    type: 'chime',
  },
  {
    id: 'warm_hug',
    title: 'Warm Hug Across Distance',
    note: 'A long, warm hug across distance',
    description: 'Deep chest resonance • Lingering warmth & double vibration',
    emoji: '🫂',
    badge: 'Comfort',
    type: 'heartbeat',
  },
  {
    id: 'gentle_kiss',
    title: 'Gentle Kiss',
    note: 'A soft, gentle kiss on your forehead',
    description: 'Delicate acoustic chime • Soft vibration flutter',
    emoji: '💋',
    badge: 'Affection',
    type: 'chime',
  },
  {
    id: 'holding_hands',
    title: 'Holding Your Hand',
    note: 'Holding your hand quietly • I am right here',
    description: 'Steadfast grounding presence • Calm reassuring touch',
    emoji: '🤝',
    badge: 'Presence',
    type: 'heartbeat',
  },
  {
    id: 'heartbeat_sync',
    title: 'Heartbeat Rhythm Sync',
    note: 'Our hearts beating as one',
    description: 'Organic chest heartbeat pulse ("lub-dub") & haptic sync',
    emoji: '💓',
    badge: 'Somatic',
    type: 'heartbeat',
  },
  {
    id: 'love_and_light',
    title: 'Sending Love & Peace',
    note: 'Sending you gentle love, peace, and warmth',
    description: 'Harmonic uplifting overtone chime for difficult moments',
    emoji: '✨',
    badge: 'Uplifting',
    type: 'chime',
  },
  {
    id: 'goodnight_touch',
    title: 'Goodnight & Sweet Dreams',
    note: 'Goodnight my love • Sweet dreams under the same stars',
    description: 'Quiet lullaby tone • Soft bedtime presence',
    emoji: '🌙',
    badge: 'Evening',
    type: 'chime',
  },
];

const PRESET_CHIPS = [
  "Can't wait to see you ❤️",
  "I love you so much 🌸",
  "Proud of you always 🌟",
  "Miss your smile ✨",
  "Take a deep breath, you got this 🌿",
];

export const HeartOptionsModal: React.FC<HeartOptionsModalProps> = ({
  isOpen,
  onClose,
  partnerName = 'Partner',
}) => {
  const [customNote, setCustomNote] = useState('');
  const [lastSentText, setLastSentText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'expressions' | 'custom'>('expressions');

  if (!isOpen) return null;

  const handleSend = (note: string, type: 'chime' | 'heartbeat' = 'chime') => {
    if (type === 'heartbeat') {
      playHeartbeatSound();
    }
    triggerGlobalPulse(note);
    setLastSentText(note);
    setTimeout(() => {
      setLastSentText(null);
    }, 2400);
  };

  const handleTestOnDevice = () => {
    playHeartbeatSound();
    triggerGlobalPulse('Test touch on your device');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/50 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-linen-surface border border-rose-200/90 rounded-3xl shadow-2xl max-w-md w-full max-h-[84dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-rose-100 bg-gradient-to-r from-rose-50/70 via-linen-surface to-rose-50/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 shadow-2xs">
              <Heart className="w-5 h-5 fill-rose-500 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif text-lg font-medium text-linen-primary">
                  Heart Touch Options
                </h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  Sensory Pulse
                </span>
              </div>
              <p className="text-xs text-linen-secondary mt-0.5">
                Wordless touch & haptic warmth to {partnerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-rose-100/60 text-linen-secondary hover:text-linen-primary transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick 1-Tap Pulse Banner */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-rose-500 to-rose-600 text-white flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
              <Heart className="w-5 h-5 fill-current animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-semibold text-white truncate">
                Instant Heart Touch
              </h4>
              <p className="text-[11px] text-rose-100 truncate">
                1-tap 528Hz Solfeggio chime & gentle vibration
              </p>
            </div>
          </div>
          <button
            onClick={() => handleSend(`Thinking of you • Sent to ${partnerName}`)}
            className="px-3.5 py-1.5 rounded-xl bg-white text-rose-600 text-xs font-semibold hover:bg-rose-50 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0 ml-3"
          >
            Send Touch
          </button>
        </div>

        {/* Confirmation Feedback */}
        {lastSentText && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200/80 text-emerald-800 text-xs flex items-center justify-between animate-fade-in shrink-0">
            <div className="flex items-center space-x-2 truncate">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate font-medium">Sent: "{lastSentText}"</span>
            </div>
            <span className="text-[10px] text-emerald-700 uppercase tracking-wider font-semibold ml-2 shrink-0">
              Delivered Live ✨
            </span>
          </div>
        )}

        {/* Sub-Tabs: Expressions / Custom Note */}
        <div className="px-4 pt-3 pb-2 border-b border-linen-border/60 flex items-center space-x-2 shrink-0 bg-linen-variant/20">
          <button
            onClick={() => setActiveTab('expressions')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'expressions'
                ? 'bg-linen-primary text-linen-surface shadow-2xs'
                : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant'
            }`}
          >
            Heart Touches ({HEART_EXPRESSIONS.length})
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'custom'
                ? 'bg-linen-primary text-linen-surface shadow-2xs'
                : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant'
            }`}
          >
            Custom Note
          </button>
          <div className="flex-1" />
          <button
            onClick={handleTestOnDevice}
            className="text-[11px] text-linen-accent hover:text-rose-600 inline-flex items-center space-x-1 cursor-pointer transition-colors"
            title="Preview how the sound and vibration feel on your screen"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Test on Device</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 min-h-0 scrollbar-none">
          {activeTab === 'expressions' ? (
            HEART_EXPRESSIONS.map((expr) => (
              <div
                key={expr.id}
                onClick={() => handleSend(expr.note, expr.type)}
                className="group p-3 sm:p-3.5 rounded-2xl border border-linen-border hover:border-rose-200 bg-linen-surface hover:bg-rose-50/40 transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                    {expr.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs sm:text-sm font-semibold text-linen-primary truncate">
                        {expr.title}
                      </h4>
                      <span className="text-[10px] text-linen-accent font-medium px-1.5 py-0.2 rounded bg-linen-variant shrink-0">
                        {expr.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-linen-secondary truncate mt-0.5">
                      {expr.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSend(expr.note, expr.type);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium transition-all shadow-2xs cursor-pointer flex items-center space-x-1 active:scale-95"
                  >
                    <Heart className="w-3 h-3 fill-current" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-linen-primary block mb-1.5">
                  Write a Personal Heart Note:
                </label>
                <div className="relative">
                  <textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder={`e.g. Thinking of you while sitting in the park...`}
                    rows={3}
                    className="w-full text-xs rounded-2xl border border-linen-border bg-linen-variant/30 p-3 text-linen-primary placeholder:text-linen-secondary/60 focus:outline-none focus:ring-1 focus:ring-rose-400 focus:border-rose-400 resize-none"
                  />
                </div>
              </div>

              {/* Preset Chips */}
              <div>
                <span className="text-[11px] font-medium text-linen-secondary block mb-1.5">
                  Quick Loving Suggestions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCustomNote(chip)}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-rose-200/70 bg-rose-50/50 hover:bg-rose-100/70 text-rose-800 transition-colors cursor-pointer text-left"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  const text = customNote.trim() || 'Thinking of you ❤️';
                  handleSend(text, 'chime');
                  setCustomNote('');
                }}
                className="w-full py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer active:scale-98 mt-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Heart Note to {partnerName}</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-linen-border/60 bg-linen-variant/20 flex items-center justify-between text-xs text-linen-secondary shrink-0">
          <span className="text-[11px] truncate flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-rose-500 inline mr-1 shrink-0" />
            <span className="truncate">End-to-end encrypted • Zero tracking</span>
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-linen-variant hover:bg-linen-border text-linen-primary font-medium transition-colors cursor-pointer text-xs shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
