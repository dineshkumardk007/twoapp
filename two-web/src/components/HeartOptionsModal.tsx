import React, { useEffect, useState } from 'react';
import { Heart, Sparkles, X, Send, Smartphone, Check, Clock } from 'lucide-react';
import { triggerGlobalPulse, previewGlobalPulse } from './SensoryPulseOverlay';
import { useBackLayer } from '../core/backStack';
import { HEART_KINDS, PLAIN_HEART, type HeartKindId } from '../core/hearts';
import { wsRelay } from '../core/ws';

interface HeartOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName?: string;
}

const PRESET_CHIPS = [
  "Can't wait to see you ❤️",
  "I love you so much 🌸",
  "Proud of you always 🌟",
  "Miss your smile ✨",
  "Take a deep breath, you got this 🌿",
];

/** How long "Sent" stays once the relay has the heart. */
const SENT_SHOWS_MS = 2400;

export const HeartOptionsModal: React.FC<HeartOptionsModalProps> = ({
  isOpen,
  onClose,
  partnerName = 'Partner',
}) => {
  const [customNote, setCustomNote] = useState('');
  // The heart just sent: its words, and whether the relay has it yet. It
  // used to say "Delivered Live" at once, whether or not anything had gone.
  const [lastSent, setLastSent] = useState<{ text: string; id?: string; acked: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'expressions' | 'custom'>('expressions');

  // The phone's Back button closes this, the same as its X.
  useBackLayer(isOpen, onClose);

  // "Sent" once the relay has stored it, which is when it is sure to reach
  // them; until then it waits, and says so.
  const pendingId = lastSent && !lastSent.acked ? lastSent.id : undefined;
  useEffect(() => {
    if (!pendingId) return;
    return wsRelay.subscribe(msg => {
      if (msg.type === 'RECORD_ACK' && msg.correlationId === pendingId) {
        setLastSent(s => (s && s.id === pendingId ? { ...s, acked: true } : s));
      }
    });
  }, [pendingId]);
  // Whether it can go now, for what is said while it goes.
  const [online, setOnline] = useState(() => wsRelay.getStatus() === 'connected');
  useEffect(() => wsRelay.subscribeStatus(s => setOnline(s === 'connected')), []);
  const ackedId = lastSent?.acked ? lastSent.id : undefined;
  useEffect(() => {
    if (!ackedId) return;
    const t = window.setTimeout(() => setLastSent(s => (s && s.id === ackedId ? null : s)), SENT_SHOWS_MS);
    return () => window.clearTimeout(t);
  }, [ackedId]);

  if (!isOpen) return null;

  const handleSend = (note: string, kind: HeartKindId) => {
    // Its own line below says when it has gone, so no "Sent to" toast too.
    const id = triggerGlobalPulse(note, kind, { quiet: true });
    setLastSent({ text: note, id, acked: false });
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-serif text-lg font-medium text-linen-primary">
                  Heart Touches
                </h3>
              </div>
              <p className="text-xs text-linen-secondary mt-0.5">
                Each one feels different on {partnerName}'s phone
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-rose-100/60 text-linen-secondary hover:text-linen-primary transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
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
                A heart in one tap
              </h4>
              <p className="text-[11px] leading-snug text-rose-100">
                {PLAIN_HEART.feels}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleSend('Thinking of you', PLAIN_HEART.id)}
            className="px-3.5 py-1.5 rounded-xl bg-white text-rose-600 text-xs font-semibold hover:bg-rose-50 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0 ml-3"
          >
            Send Touch
          </button>
        </div>

        {/* Confirmation Feedback */}
        {lastSent && (
          <div
            role="status"
            className={`px-4 py-2 border-b text-xs flex items-center justify-between animate-fade-in shrink-0 ${
              lastSent.acked
                ? 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
                : 'bg-linen-variant/60 border-linen-border text-linen-secondary'
            }`}
          >
            <div className="flex items-center space-x-2 truncate">
              {lastSent.acked ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Clock className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate font-medium">"{lastSent.text}"</span>
            </div>
            <span className="text-[11px] font-semibold ml-2 shrink-0">
              {lastSent.acked ? 'Sent' : online ? 'Sending…' : 'Waiting for a connection'}
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
            Heart Touches ({HEART_KINDS.length})
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
        </div>

        {/* Scrollable Body */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 min-h-0 scrollbar-none">
          {activeTab === 'expressions' ? (
            HEART_KINDS.map((kind) => (
              <div
                key={kind.id}
                className="p-3 sm:p-3.5 rounded-2xl border border-linen-border bg-linen-surface shadow-2xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-lg shrink-0">
                    {kind.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-semibold text-linen-primary truncate">
                      {kind.title}
                    </h4>
                    {/* In full, on two lines if need be: it is what tells them apart. */}
                    <p className="text-[11px] leading-snug text-linen-secondary mt-0.5">
                      {kind.feels}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {/* How it arrives, on this phone only: nothing is sent. */}
                  <button
                    type="button"
                    onClick={() => previewGlobalPulse(kind.id)}
                    aria-label={`Feel "${kind.title}" here`}
                    title="Feel it here - nothing is sent"
                    className="h-[30px] w-[30px] rounded-xl flex items-center justify-center text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend(kind.note, kind.id)}
                    aria-label={`Send "${kind.title}"`}
                    className="px-3 py-1.5 rounded-xl bg-linen-accent text-linen-surface hover:opacity-90 text-xs font-medium transition-all shadow-2xs cursor-pointer flex items-center space-x-1 active:scale-95"
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
                  handleSend(text, PLAIN_HEART.id);
                  setCustomNote('');
                }}
                className="w-full py-2.5 rounded-2xl bg-linen-accent text-linen-surface hover:opacity-90 text-xs font-semibold transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer active:scale-98 mt-2"
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
            <span className="truncate">Private to you two</span>
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
