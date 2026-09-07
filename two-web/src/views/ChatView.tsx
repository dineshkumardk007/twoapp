import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, NeedItem } from '../types';
import { NeedMenuModal } from '../components/NeedMenuModal';
import { VoiceMemoPlayer } from '../components/VoiceMemoPlayer';
import { Send, Sparkles, Feather, Check, CheckCheck, Clock, Smile, X } from 'lucide-react';

/**
 * The picker's contents, grouped the way you would reach for them.
 *
 * These used to sit in an always-open row above the composer, which spent a
 * permanent strip of a phone screen on ten characters and still could not
 * offer an eleventh. Behind a button the same space holds all of this, and
 * gives it back to the conversation when it is closed.
 */
const EMOJI_GROUPS: { title: string; chars: string[] }[] = [
  {
    title: 'Us',
    chars: [
      '❤️', '🥰', '😘', '😍', '🫂', '🤗', '💋', '💕',
      '💞', '💝', '🧡', '💛', '💚', '💙', '💜', '🤍'
    ]
  },
  {
    title: 'Faces',
    chars: [
      '😂', '🤣', '😅', '😊', '🙂', '🙃', '😜', '😝',
      '🤩', '🥳', '😎', '🤔', '😐', '😑', '😶', '🙄',
      '😬', '😥', '😢', '😭', '😩', '🥺', '😨', '😱',
      '😠', '😡', '😴', '🤤', '🤒', '🤕', '🤧', '🤯'
    ]
  },
  {
    title: 'Hands',
    chars: [
      '👍', '👎', '👏', '🙌', '🙏', '🤝', '✌️', '🤞',
      '👋', '🤙', '👆', '👇', '💪', '✍️', '👌', '👊'
    ]
  },
  {
    title: 'Life',
    chars: [
      '🌟', '✨', '🔥', '🎉', '🎊', '🎁', '🎂', '🍾',
      '☕', '🍵', '🍫', '🍓', '🍊', '🍕', '🍜', '🍦',
      '🌸', '🌻', '🌹', '🌷', '🌱', '🌳', '🌊', '🌄',
      '🌙', '☀️', '☁️', '🌧️', '❄️', '🌈', '⭐', '💫'
    ]
  },
  {
    title: 'Things',
    chars: [
      '🎵', '🎶', '📷', '📞', '💤', '🛌', '🏠', '✈️',
      '🚗', '🧳', '📚', '✏️', '📦', '🔑', '⏰', '🧩'
    ]
  }
];

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
  partnerName?: string;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  activeUser,
  onSendMessage,
  partnerReadAt = 0,
  relayStatus = 'connected',
  onOpenSoftLanding,
  partnerName = 'Partner'
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
      <div className="px-6 py-3.5 border-b border-linen-border bg-linen-variant/40 flex items-center justify-between">
        <div>
          <h3 className="font-serif text-base font-medium text-linen-primary">{partnerName}</h3>
          <div className="flex items-center text-xs text-linen-secondary space-x-1">
            {/* Encryption is unconditional, so this dot stays green: it is a
                statement about the room, not the connection. The connection
                gets its own words, and only when there is something to say. */}
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>Encrypted Room</span>
            {relayStatus !== 'connected' && (
              <span className="text-amber-700">
                &middot;{' '}
                {relayStatus === 'connecting' || relayStatus === 'reconnecting'
                  ? 'Connecting'
                  : 'Offline'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2.5">
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
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Ask For What You Need
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
                {isFromCurrentPerspective && (
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
        <div className="border-t border-linen-border bg-linen-surface">
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
              Emoji
            </span>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(false)}
              aria-label="Close emoji picker"
              className="rounded-lg p-1 text-linen-secondary hover:bg-linen-variant active:scale-90 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-44 overflow-y-auto scroll-contain px-3 pb-2">
            {EMOJI_GROUPS.map(group => (
              <div key={group.title} className="mb-1.5">
                <p className="px-1 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-linen-secondary/70">
                  {group.title}
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {group.chars.map(char => (
                    <button
                      key={char}
                      type="button"
                      onClick={() => setInputText(t => t + char)}
                      aria-label={`Add ${char}`}
                      className="flex h-9 items-center justify-center rounded-xl text-xl leading-none hover:bg-linen-variant active:scale-90 transition-all cursor-pointer"
                    >
                      {char}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
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
              onChange={(e) => setInputText(e.target.value)}
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
