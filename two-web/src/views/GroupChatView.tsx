import React, { useEffect, useRef, useState } from 'react';
import { Send, Smile, X, Check, CheckCheck, Info, Users } from 'lucide-react';
import { GroupSpace, readBreakdown, GroupMessage } from '../core/groups';
import { formatLastSeen, TYPING_REPEAT_MS } from '../core/lastSeen';

interface GroupChatViewProps {
  group: GroupSpace;
  /** This device's member id, so its own messages sit on the right. */
  myId: string;
  connected: boolean;
  /** Member ids currently typing, already excluding this device. */
  typingIds: string[];
  /** False when this device has receipts and typing switched off. */
  shareReceipts: boolean;
  onSend: (text: string) => void;
  onTyping: () => void;
}

const EMOJI = [
  '❤️', '\U0001f602', '\U0001f44d', '\U0001f64f', '\U0001f389', '\U0001f525',
  '\U0001f60a', '\U0001f622', '\U0001f44f', '✨', '\U0001f37b', '\U0001f4af'
].map(e => e);

/**
 * Group chat.
 *
 * Deliberately a separate component from ChatView rather than a widening of
 * it. The couple's chat is built around two people - one partner name, one
 * read position, one "online" - and every attempt to make one component serve
 * both would have put that conversation at risk for the sake of code that is
 * mostly different anyway.
 */
export const GroupChatView: React.FC<GroupChatViewProps> = ({
  group,
  myId,
  connected,
  typingIds,
  shareReceipts,
  onSend,
  onTyping
}) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [infoFor, setInfoFor] = useState<GroupMessage | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [group.messages.length]);

  const announceTyping = () => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_REPEAT_MS) return;
    lastTypingSentRef.current = now;
    onTyping();
  };

  const send = () => {
    const body = text.trim();
    if (!body) return;
    onSend(body);
    setText('');
  };

  const nameFor = (id: string) => group.members.find(m => m.id === id)?.name || 'Someone';

  const typingLabel = (() => {
    const names = typingIds.map(nameFor);
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]} and ${names.length - 1} others are typing…`;
  })();

  const others = group.members.filter(m => m.id !== myId);
  const someoneHere = others.some(m => Date.now() - m.lastSeen < 90_000);

  const subtitle = typingLabel
    ? typingLabel
    : someoneHere
    ? 'online'
    : (() => {
        const newest = others.reduce((max, m) => Math.max(max, m.lastSeen), 0);
        return newest ? formatLastSeen(newest) : `${group.members.length || 1} in this group`;
      })();

  return (
    <div className="flex flex-col chat-shell bg-linen-surface rounded-2xl border border-linen-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-linen-border bg-linen-variant/40 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-base font-medium text-linen-primary">
            {group.name}
          </h3>
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-linen-secondary">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate">
              {typingLabel ? (
                <span className="font-medium text-linen-accent">{typingLabel}</span>
              ) : (
                subtitle
              )}
            </span>
            {!connected && <span className="shrink-0 text-amber-700">&middot; Connecting</span>}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-lg border border-linen-border bg-linen-surface px-2 py-1 text-[11px] text-linen-secondary">
          <Users className="h-3.5 w-3.5" />
          {group.members.length || 1}
        </span>
      </div>

      {/* Messages */}
      <div ref={logRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-contain p-4">
        {group.messages.length === 0 && (
          <p className="py-8 text-center text-sm text-linen-secondary">
            Nothing here yet. Say hello.
          </p>
        )}

        {group.messages.map(msg => {
          const mine = msg.authorId === myId;
          const breakdown = readBreakdown(group.members, msg);
          return (
            <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {!mine && (
                <span className="mb-0.5 px-1 text-[10px] font-medium text-linen-accent">
                  {msg.authorName || nameFor(msg.authorId)}
                </span>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? 'bg-linen-primary text-linen-surface'
                    : 'border border-linen-border bg-linen-variant/40 text-linen-primary'
                }`}
              >
                {msg.text}
              </div>
              <span className="mt-1 flex items-center gap-1 px-1 text-[10px] text-linen-secondary">
                {new Date(msg.sentAt).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                {mine && shareReceipts && (
                  <>
                    {breakdown.allRead ? (
                      <CheckCheck className="h-3.5 w-3.5 text-sky-600" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-linen-secondary/70" />
                    )}
                    {/* Who exactly, for when the tick is not enough. */}
                    <button
                      onClick={() => setInfoFor(msg)}
                      aria-label="Who has read this"
                      className="rounded p-0.5 text-linen-secondary/70 hover:text-linen-primary transition-colors cursor-pointer"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Who has read it */}
      {infoFor && (
        <div className="border-t border-linen-border bg-linen-surface px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
              Read by
            </span>
            <button
              onClick={() => setInfoFor(null)}
              aria-label="Close"
              className="rounded-lg p-1 text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {(() => {
            const b = readBreakdown(group.members, infoFor);
            return (
              <div className="max-h-32 space-y-1 overflow-y-auto scroll-contain text-xs">
                {b.read.map(m => (
                  <div key={m.id} className="flex items-center gap-1.5 text-linen-primary">
                    <CheckCheck className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                    {m.name}
                  </div>
                ))}
                {b.unread.map(m => (
                  <div key={m.id} className="flex items-center gap-1.5 text-linen-secondary">
                    <Check className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    {m.name}
                  </div>
                ))}
                {b.read.length === 0 && b.unread.length === 0 && (
                  <p className="text-linen-secondary">Nobody else has joined yet.</p>
                )}
                <p className="pt-1 text-[10px] leading-relaxed text-linen-secondary">
                  Someone who has switched read receipts off looks the same here as someone who
                  has not read it.
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {showEmoji && (
        <div className="border-t border-linen-border bg-linen-surface px-3 py-2">
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJI.map(char => (
              <button
                key={char}
                onClick={() => setText(t => t + char)}
                className="flex h-9 items-center justify-center rounded-xl text-xl hover:bg-linen-variant active:scale-90 transition-all cursor-pointer"
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="flex items-center gap-2 border-t border-linen-border bg-linen-surface p-4 pt-2">
        <button
          onClick={() => setShowEmoji(v => !v)}
          aria-expanded={showEmoji}
          title="Emoji"
          className={`rounded-xl p-2.5 transition-colors ${
            showEmoji
              ? 'bg-linen-variant text-linen-primary'
              : 'text-linen-secondary hover:bg-linen-variant hover:text-linen-primary'
          }`}
        >
          <Smile className="h-5 w-5" />
        </button>
        <input
          value={text}
          onChange={e => {
            setText(e.target.value);
            announceTyping();
          }}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={`Message ${group.name}…`}
          className="flex-1 rounded-xl border border-linen-border bg-linen-variant/30 px-4 py-2.5 text-sm text-linen-primary placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="rounded-xl bg-linen-primary p-2.5 text-linen-surface transition-all hover:opacity-90 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
