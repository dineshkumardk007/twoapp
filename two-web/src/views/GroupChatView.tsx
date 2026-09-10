import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Smile,
  X,
  Check,
  CheckCheck,
  Clock,
  Info,
  Users,
  Crown,
  Copy,
  Eye,
  EyeOff,
  UserPlus,
  Pencil,
  RotateCw,
  Trash2
} from 'lucide-react';
import {
  GroupSpace,
  readBreakdown,
  GroupMessage,
  isOverCapacity,
  MAX_GROUP_MEMBERS,
  MAX_GROUP_MESSAGES,
  membersOnline
} from '../core/groups';
import { formatLastSeen, TYPING_REPEAT_MS } from '../core/lastSeen';
import { EmojiPicker } from '../components/EmojiPicker';

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
  /** Founders only; absent for everyone else, which is what hides the control. */
  onRename?: (name: string) => void;
  /** Retry or abandon a message that never left this device. */
  onResolveStuck?: (messageId: string, action: 'retry' | 'delete') => void;
}

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
  onTyping,
  onRename,
  onResolveStuck
}) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [infoFor, setInfoFor] = useState<GroupMessage | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  /** Which stuck message has its retry/discard choice open. */
  const [stuckOpen, setStuckOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const lastTypingSentRef = useRef(0);

  // Covered again whenever the panel closes, so the code is never left on
  // screen from a previous look.
  useEffect(() => {
    if (!showMembers) {
      setShowInvite(false);
      setCopyError('');
      setRenaming(null);
    }
  }, [showMembers]);

  const copyInvite = async () => {
    const phrase = group.joinPhrase ? `\nWords: ${group.joinPhrase}` : '';
    try {
      await navigator.clipboard.writeText(
        `Join "${group.name}" on Two.\nCode: ${group.code}${phrase}`
      );
      setCopied(true);
      setCopyError('');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError('Could not copy — write the code and words down instead.');
    }
  };

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

          {/* Renaming, for the founder alone - the same device whose hello
              tells everyone else what the group is called, so the new name
              travels the way the first one did. */}
          {onRename && (
            <div className="mt-3 border-t border-linen-border pt-2.5">
              {renaming === null ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-linen-primary">
                    <Pencil className="h-3.5 w-3.5 shrink-0 text-linen-accent" />
                    <span className="truncate">{group.name}</span>
                  </span>
                  <button
                    onClick={() => setRenaming(group.name)}
                    className="shrink-0 rounded-lg border border-linen-border bg-linen-surface px-2 py-1 text-[10px] font-medium text-linen-secondary hover:bg-linen-variant hover:text-linen-primary transition-colors cursor-pointer"
                  >
                    Rename
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    value={renaming}
                    onChange={e => setRenaming(e.target.value.slice(0, 40))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && renaming.trim()) {
                        onRename(renaming);
                        setRenaming(null);
                      }
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    autoFocus
                    placeholder="What should this group be called?"
                    className="w-full rounded-xl border border-linen-border bg-linen-variant/40 px-3 py-2 text-xs text-linen-primary placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary/40"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        if (!renaming.trim()) return;
                        onRename(renaming);
                        setRenaming(null);
                      }}
                      disabled={!renaming.trim()}
                      className="rounded-lg bg-linen-primary px-2.5 py-1.5 text-[10px] font-medium text-linen-surface hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
                    >
                      Rename for everyone
                    </button>
                    <button
                      onClick={() => setRenaming(null)}
                      className="rounded-lg border border-linen-border bg-linen-surface px-2.5 py-1.5 text-[10px] text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Adding somebody later.
              The code and the words used to appear once, on the screen that
              created the group, and never again - so a group could not be
              grown after the fact by anyone who had not written them down at
              the time. They are kept covered because they are the whole
              secret: showing them by default would put them on screen every
              time somebody checked who was in the room. */}
          <div className="mt-3 border-t border-linen-border pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-linen-primary">
                <UserPlus className="h-3.5 w-3.5 text-linen-accent" />
                Add someone
              </span>
              <button
                onClick={() => setShowInvite(v => !v)}
                aria-expanded={showInvite}
                className="inline-flex items-center gap-1 rounded-lg border border-linen-border bg-linen-surface px-2 py-1 text-[10px] font-medium text-linen-secondary hover:bg-linen-variant hover:text-linen-primary transition-colors cursor-pointer"
              >
                {showInvite ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showInvite ? 'Hide invite' : 'Show invite'}
              </button>
            </div>

            {showInvite && (
              <div className="mt-2 space-y-1.5 rounded-xl border border-linen-border/70 bg-linen-variant/30 p-2.5">
                <p className="font-mono text-xs break-all text-linen-primary">{group.code}</p>
                {group.joinPhrase && (
                  <p className="text-xs text-linen-primary">{group.joinPhrase}</p>
                )}
                <p className="text-[10px] leading-relaxed text-linen-secondary">
                  Both are needed to get in, and the words are never sent anywhere &mdash; say them
                  out loud rather than typing them into a message beside the code.
                </p>
                <button
                  onClick={copyInvite}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-linen-border bg-linen-surface px-2.5 py-1.5 text-[10px] font-medium text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy invite'}
                </button>
                {copyError && <p className="text-[10px] text-rose-700">{copyError}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={logRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-contain p-4">
        {group.messages.length === 0 && (
          <p className="py-8 text-center text-sm text-linen-secondary">
            Nothing here yet. Say hello.
          </p>
        )}

        {/* Said once the device is full rather than never. The oldest messages
            fall off to keep this from growing without bound, which is a fine
            thing to do and a poor thing to do silently. */}
        {group.messages.length >= MAX_GROUP_MESSAGES && (
          <p className="pb-1 text-center text-[10px] leading-relaxed text-linen-secondary">
            Only the most recent {MAX_GROUP_MESSAGES.toLocaleString()} messages are kept on this
            device. Older ones are gone from here.
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
                {mine && (
                  <>
                    {/* Whether it has left this device is not a receipt about
                        anybody else, so it shows even with receipts off: a
                        message that has not reached the relay looked exactly
                        like one that had, which on a sleeping server is a
                        fifty-second lie. */}
                    {msg.delivered === false ? (
                      <>
                        {/* The clock is the control: a message that never left
                            needs somewhere to go, and nothing else on the row
                            belongs to it. */}
                        <button
                          onClick={() =>
                            onResolveStuck && setStuckOpen(stuckOpen === msg.id ? null : msg.id)
                          }
                          aria-label="Still sending"
                          aria-expanded={stuckOpen === msg.id}
                          className="rounded p-0.5 text-linen-secondary/60 hover:text-linen-primary transition-colors cursor-pointer"
                        >
                          <Clock className="h-3 w-3" />
                        </button>
                        <span className="sr-only">Sending</span>
                      </>
                    ) : shareReceipts && breakdown.allRead ? (
                      <>
                        <CheckCheck className="h-3.5 w-3.5 text-sky-600" />
                        <span className="sr-only">Read by everyone</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 text-linen-secondary/70" />
                        <span className="sr-only">Sent</span>
                      </>
                    )}
                    {/* Who exactly, for when the tick is not enough. */}
                    {shareReceipts && msg.delivered !== false && (
                      <button
                        onClick={() => setInfoFor(msg)}
                        aria-label="Who has read this"
                        className="rounded p-0.5 text-linen-secondary/70 hover:text-linen-primary transition-colors cursor-pointer"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </span>

              {stuckOpen === msg.id && onResolveStuck && (
                <span className="mt-0.5 flex items-center gap-1.5 px-1">
                  <button
                    onClick={() => {
                      setStuckOpen(null);
                      onResolveStuck(msg.id, 'retry');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-linen-border bg-linen-surface px-2 py-1 text-[10px] font-medium text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
                  >
                    <RotateCw className="h-3 w-3" /> Send again
                  </button>
                  <button
                    onClick={() => {
                      setStuckOpen(null);
                      onResolveStuck(msg.id, 'delete');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-linen-border bg-linen-surface px-2 py-1 text-[10px] font-medium text-linen-secondary hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" /> Discard
                  </button>
                </span>
              )}
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
        <EmojiPicker
          onPick={char => setText(t => t + char)}
          onClose={() => setShowEmoji(false)}
        />
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
