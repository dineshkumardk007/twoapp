import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, NeedItem } from '../types';
import { NeedMenuModal } from '../components/NeedMenuModal';
import { VoiceMemoPlayer } from '../components/VoiceMemoPlayer';
import { formatLastSeen, TYPING_REPEAT_MS } from '../core/lastSeen';
import { Send, Sparkles, Feather, Check, CheckCheck, Clock, Smile } from 'lucide-react';
import { EmojiPicker } from '../components/EmojiPicker';

interface ChatViewProps {
  messages: ChatMessage[];
  activeUser: 'user' | 'partner';
  /** Newest sentAt the partner has confirmed reading. */
  partnerReadAt?: number;
  /**
   * Connection state, shown here because chat is the one screen with neither
   * the header nor the dock: without it there would be nothing on screen to say
   * a message is queued rather than sent.
   */
  relayStatus?: 'idle' | 'connecting' | 'connected' | 'reconnecting';
  onSendMessage: (
    text: string,
    isNeed?: boolean,
    extra?: { isVoiceMemo?: boolean; audioDataUrl?: string; audioDurationSeconds?: number }
  ) => void;
  onOpenSoftLanding?: () => void;
  /** True while the partner's device is in the space right now. */
  partnerOnline?: boolean;
  /**
   * When the partner's device was last awake, or 0 when unknown or hidden.
   *
   * Already zeroed by the caller when this device has turned its own sharing
   * off, so there is nothing to decide here.
   */
  partnerLastSeen?: number;
  /** True while the partner is writing something right now. */
  partnerTyping?: boolean;
  /** False when this device has switched read receipts and typing off. */
  shareReceipts?: boolean;
  /** Called as the composer is typed in; throttled inside. */
  onTyping?: () => void;
  partnerName?: string;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  activeUser,
  onSendMessage,
  partnerReadAt = 0,
  relayStatus = 'connected',
  onOpenSoftLanding,
  partnerOnline = false,
  partnerLastSeen = 0,
  partnerTyping = false,
  shareReceipts = true,
  onTyping,
  partnerName = 'Partner'
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  /**
   * Announces typing at most once every few seconds.
   *
   * A signal per keystroke would be a burst of traffic all saying the same
   * thing. The receiver holds the state for longer than this gap, so repeating
   * on a timer is what keeps it true while the writing continues - and letting
   * it lapse is what ends it, with no "stopped typing" message that closing
   * the app could fail to send.
   */
  const lastTypingSentRef = useRef(0);
  const announceTyping = () => {
    if (!onTyping) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_REPEAT_MS) return;
    lastTypingSentRef.current = now;
    onTyping();
  };

  // Re-rendered on a timer only because the wording ages: "today at 23:58"
  // has to become "yesterday at 23:58" without the screen being touched.
  const [lastSeenLabel, setLastSeenLabel] = useState(() => formatLastSeen(partnerLastSeen));
  useEffect(() => {
    setLastSeenLabel(formatLastSeen(partnerLastSeen));
    if (!partnerLastSeen) return;
    const timer = setInterval(() => setLastSeenLabel(formatLastSeen(partnerLastSeen)), 60_000);
    return () => clearInterval(timer);
  }, [partnerLastSeen]);
  const [showNeedModal, setShowNeedModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom whenever a new message is sent or received
  useEffect(() => {
    // scrollIntoView walks up and scrolls EVERY scrollable ancestor, including
    // the page, which is what yanked the whole layout around on each message.
    // Driving the log's own scrollTop moves only the log.
    const log = messagesRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  const handleSendText = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="flex flex-col chat-shell bg-linen-surface rounded-2xl border border-linen-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-linen-border bg-linen-variant/40 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-base font-medium text-linen-primary truncate">
            {partnerName}
          </h3>
          {/* One line, always. Three separate facts used to sit here as
              separate spans and, once presence was added, a phone-width header
              wrapped them into a four-line stack that pushed the conversation
              down the screen. */}
          <div className="flex items-center gap-1.5 text-xs text-linen-secondary min-w-0 whitespace-nowrap overflow-hidden">
            {/* Encryption is unconditional, so this dot stays green: it is a
                statement about the room, not the connection. The connection
                gets its own words, and only when there is something to say. */}
            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-emerald-500 inline-block" />

            {/* Presence takes the line when there is any, the way a messenger
                does it. "Encrypted Room" is what the line says when there is
                nothing else to report - the encryption is unconditional, so it
                is a statement about the room rather than news. */}
            <span className="truncate">
              {partnerTyping ? (
                <span className="font-medium text-linen-accent">typing…</span>
              ) : partnerOnline ? (
                <span className="text-emerald-700">online</span>
              ) : (
                lastSeenLabel || 'Encrypted Room'
              )}
            </span>

            {relayStatus !== 'connected' && (
              <span className="shrink-0 text-amber-700">
                &middot;{' '}
                {relayStatus === 'connecting' || relayStatus === 'reconnecting'
                  ? 'Connecting'
                  : 'Offline'}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          {onOpenSoftLanding && (
            <button
              onClick={onOpenSoftLanding}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center transition-colors cursor-pointer"
              title="Pause and take a 20-minute de-escalation breather"
            >
              <Feather className="w-3.5 h-3.5 mr-1" />
              <span>Breather</span>
            </button>
          )}
          <button
            onClick={() => setShowNeedModal(true)}
            className="text-xs font-medium text-linen-accent hover:underline flex items-center"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 shrink-0" />
            {/* The full phrase wrapped onto three lines in a phone-width
                header, which both made it tall and squeezed the presence line
                beside it into an ellipsis. Same button, fewer words where
                there is no room for them. */}
            <span className="hidden sm:inline">Ask For What You Need</span>
            <span className="sm:hidden">Ask</span>
          </button>
        </div>
      </div>

      {/* Message List */}
      <div ref={messagesRef} className="flex-1 min-h-0 overflow-y-auto scroll-contain p-4 sm:p-6 space-y-4">
        {messages.map(msg => {
          const isFromCurrentPerspective = msg.authorId === activeUser;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isFromCurrentPerspective ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-md rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.isNeedCard
                    ? 'bg-gold-50 border border-gold-500/40 text-linen-primary'
                    : isFromCurrentPerspective
                    ? 'bg-linen-primary text-linen-surface'
                    : 'bg-linen-variant text-linen-primary border border-linen-border'
                }`}
              >
                {msg.isNeedCard && (
                  <div className="text-[11px] font-semibold tracking-wider text-gold-600 uppercase mb-1 flex items-center">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Structured Need Request
                  </div>
                )}

                {msg.isVoiceMemo ? (
                  <VoiceMemoPlayer
                    audioDataUrl={msg.audioDataUrl}
                    durationSeconds={msg.audioDurationSeconds || 8}
                    isFromCurrentPerspective={isFromCurrentPerspective}
                  />
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
              <span className="text-[10px] text-linen-secondary mt-1 px-1">
                {isFromCurrentPerspective ? 'You' : partnerName} • {msg.timestamp}
                {isFromCurrentPerspective && shareReceipts && (
                  <span className="ml-1.5 inline-flex items-center align-middle">
                    {msg.sentAt && partnerReadAt >= msg.sentAt ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-sky-600" />
                        <span className="sr-only">Read</span>
                      </>
                    ) : msg.delivered ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-linen-secondary/70" />
                        <span className="sr-only">Sent</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-linen-secondary/50" />
                        <span className="sr-only">Sending</span>
                      </>
                    )}
                  </span>
                )}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* The picker, open only when asked for. It sits between the messages
          and the composer so the draft you are adding to stays in view, and it
          is capped at a third of the panel so the conversation never vanishes
          behind it. Tapping appends rather than sends, so several can be
          combined, or wrapped in words, before it goes. */}
      {showEmojiPicker && (
        <EmojiPicker
          onPick={char => setInputText(t => t + char)}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Input Bar */}
      <div className="p-4 pt-2 border-t-0 bg-linen-surface flex items-center space-x-2">
            {/* Deliberately the leftmost control, which is exactly where the
                first emoji of the old row sat - the character you reached for
                is still under the same thumb, it just opens the rest now. */}
            <button
              onClick={() => setShowEmojiPicker(v => !v)}
              aria-expanded={showEmojiPicker}
              className={`p-2.5 rounded-xl transition-colors ${
                showEmojiPicker
                  ? 'bg-linen-variant text-linen-primary'
                  : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant'
              }`}
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                announceTyping();
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder={`Write a quiet thought to ${partnerName}...`}
              className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary placeholder:text-linen-secondary/60"
            />

            <button
              onClick={handleSendText}
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-linen-primary text-linen-surface hover:opacity-90 disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
      </div>

      <NeedMenuModal
        isOpen={showNeedModal}
        onClose={() => setShowNeedModal(false)}
        onSelectNeed={(need) => {
          onSendMessage(`I need: ${need.title} — ${need.description}`, true);
          setShowNeedModal(false);
        }}
      />
    </div>
  );
};
