import React, { useEffect, useRef, useState } from 'react';
import { Send, Smile, X, Check, CheckCheck, Info, Users, Crown } from 'lucide-react';
import {
  GroupSpace,
  readBreakdown,
  GroupMessage,
  isOverCapacity,
  MAX_GROUP_MEMBERS,
  membersOnline
} from '../core/groups';
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

/**
 * Written as \u{...} escapes rather than pasted characters.
 *
 * The first version of this list carried Python escapes - \U0001f602 - which
 * JavaScript does not recognise, so ten of the twelve rendered on screen as
 * the literal text "U0001f602".
 */
const EMOJI = [
  '\u2764\ufe0f', '\u{1f602}', '\u{1f44d}', '\u{1f64f}', '\u{1f389}', '\u{1f525}',
  '\u{1f60a}', '\u{1f622}', '\u{1f44f}', '\u2728', '\u{1f37b}', '\u{1f4af}'
];

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
  const [showMembers, setShowMembers] = useState(false);
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

  // Recomputed on a timer: "online" is a claim about now, and a screen that
  // only re-rendered when a message arrived would keep showing somebody as
  // present long after their last beat.
  const [presenceTick, setPresenceTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setPresenceTick(n => n + 1), 20_000);
    return () => clearInterval(timer);
  }, []);

  const online = membersOnline(group, myId);
  void presenceTick;

  const subtitle = typingLabel
    ? typingLabel
    : online.length === 1
    ? `${online[0].name} is online`
    : online.length > 1
    ? `${online.length} online`
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
        <button
          onClick={() => setShowMembers(v => !v)}
          aria-label="Who is in this group"
          aria-expanded={showMembers}
          className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors ${
            showMembers
              ? 'border-linen-primary/40 bg-linen-variant text-linen-primary'
              : 'border-linen-border bg-linen-surface text-linen-secondary hover:bg-linen-variant'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          {group.members.length || 1}
        </button>
      </div>

      {/* A group past its size is said out loud rather than half-recorded.
          Everyone holding the code can walk in, so this is the only honest
          place to notice it. */}
      {isOverCapacity(group.members) && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-950">
          <p className="text-xs font-semibold">
            {group.members.length} people are in this group
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed">
            It is meant for {MAX_GROUP_MEMBERS}. Anyone with the code and the words can join, and
            nobody can be removed &mdash; start a new group if this is not who you expected.
          </p>
        </div>
      )}

      {/* Who is in here. Opened from the count in the header. */}
      {showMembers && (
        <div className="border-b border-linen-border bg-linen-surface px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
              In this group
            </span>
            <button
              onClick={() => setShowMembers(false)}
              aria-label="Close"
              className="rounded-lg p-1 text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ul className="max-h-40 space-y-1.5 overflow-y-auto scroll-contain">
            {group.members.map(m => {
              const isMe = m.id === myId;
              const here = online.some(o => o.id === m.id);
              return (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        isMe || here ? 'bg-emerald-500' : 'bg-stone-300'
                      }`}
                    />
                    <span className="truncate text-xs text-linen-primary">
                      {m.name}
                      {isMe && <span className="text-linen-secondary"> · you</span>}
                    </span>
                    {group.founder && isMe && (
                      <Crown className="h-3 w-3 shrink-0 text-amber-500" />
                    )}
                  </span>
                  <span className="shrink-0 text-[10px] text-linen-secondary">
                    {isMe ? '' : here ? 'online' : formatLastSeen(m.lastSeen) || 'not seen yet'}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-2 text-[10px] leading-relaxed text-linen-secondary">
            Names are what each device says about itself, and anyone with the code and the words
            can join. Nobody can be removed.
          </p>
        </div>
      )}

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
      <div className="flex items-center gap-2 border-t border-linen-border bg-linen-surface px-3 pb-1.5 pt-2">
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
