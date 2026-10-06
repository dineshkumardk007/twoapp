import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ChatMessage } from '../types';
import { NeedMenuModal } from '../components/NeedMenuModal';
import { VoiceNotePlayer } from '../components/VoiceNotePlayer';
import { VoiceMicButton, VoiceRecordingStrip, useVoiceRecorder } from '../components/VoiceRecorder';
import { voiceFieldsOf, voiceNoteLabel, type VoiceFields } from '../core/voice';
import { formatLastSeen, TYPING_REPEAT_MS } from '../core/lastSeen';
import { MAX_CHAT_MESSAGES } from '../core/storage';
import { who } from '../core/who';
import { haptic } from '../core/haptics';
import { Send, Sparkles, Feather, Check, CheckCheck, Clock, Smile, RotateCw, Trash2, Phone } from 'lucide-react';
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
  /** Retry or abandon a message that never left this device. */
  onResolveStuck?: (messageId: string, action: 'retry' | 'delete') => void;
  /** `extra` makes it a voice note; `text` is then the note's label. */
  onSendMessage: (text: string, isNeed?: boolean, extra?: VoiceFields) => void;
  /**
   * The partner's voice note has just been played for the first time on this
   * phone. Whether that is told to them is the caller's business (it follows
   * the read-receipt setting).
   */
  onVoiceHeard?: (messageId: string) => void;
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
  /** Rings the partner. Absent where calling is not offered. */
  onStartCall?: () => void;
  /** True while a call is ringing or live, so a second cannot be started. */
  callInProgress?: boolean;
  partnerName?: string;
}

// Built once. Formatting a date makes a formatter each time it is asked, and a
// conversation of a few thousand messages asked for one per bubble on every
// keystroke in the composer.
const TIME_FORMAT = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const DAY_FORMAT = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const OLD_DAY_FORMAT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Messages further apart than this start a new run, even from the same person:
 * a run shows its time only once, under its last bubble, and a morning message
 * must not borrow the evening's time.
 */
const RUN_GAP_MS = 5 * 60 * 1000;
/** About five lines of text; past that the composer scrolls inside itself. */
const COMPOSER_MAX_PX = 122;
/** This close to the end of the conversation counts as being at the end. */
const AT_BOTTOM_PX = 48;

function startOfDay(at: number): number {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * "Today", "Yesterday", "Sat, 3 Oct" - the name of a day, for the line between
 * days.
 *
 * Not whenLabel from core/when.ts, which answers "how long ago" ("4 days ago")
 * where a divider has to name the day itself.
 */
function dayLabel(day: number, now: number): string {
  const days = Math.round((startOfDay(now) - day) / 86_400_000);
  // A day in the future is the other phone's clock running ahead, not news.
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Date(day).getFullYear() === new Date(now).getFullYear()
    ? DAY_FORMAT.format(day)
    : OLD_DAY_FORMAT.format(day);
}

/** Local calendar day, as a key that changes exactly at midnight. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface Row {
  msg: ChatMessage;
  /** The name of the day, on the first message of each new one. */
  divider?: string;
  /** First and last of a run of messages from the same person. */
  firstOfRun: boolean;
  lastOfRun: boolean;
  /** "9:41 pm" - or, for messages from before the moment was kept, the word they were stored with. */
  time: string;
}

/**
 * The conversation as it is laid out: days, runs and times.
 *
 * Every bubble used to say "Just now" forever, because the word was what was
 * stored. The moment (sentAt) has been stored alongside it all along, so
 * every message that has one gets its real time back, old ones included.
 */
function layOut(messages: ChatMessage[]): Row[] {
  const now = Date.now();
  const dividers: (string | undefined)[] = [];
  // Messages from before the moment was kept have no day of their own; they
  // stay with whatever came before them rather than starting a new one.
  let day: number | null = null;
  for (const m of messages) {
    const own = m.sentAt && Number.isFinite(m.sentAt) ? startOfDay(m.sentAt) : null;
    if (own !== null && own !== day) {
      dividers.push(dayLabel(own, now));
      day = own;
    } else {
      dividers.push(undefined);
    }
  }

  const joins = (a: ChatMessage, b: ChatMessage, newDay: string | undefined) =>
    a.authorId === b.authorId &&
    !newDay &&
    (!a.sentAt || !b.sentAt || Math.abs(b.sentAt - a.sentAt) < RUN_GAP_MS);

  return messages.map((msg, i) => ({
    msg,
    divider: dividers[i],
    firstOfRun: i === 0 || !joins(messages[i - 1], msg, dividers[i]),
    lastOfRun: i === messages.length - 1 || !joins(msg, messages[i + 1], dividers[i + 1]),
    time: msg.sentAt && Number.isFinite(msg.sentAt) ? TIME_FORMAT.format(msg.sentAt) : msg.timestamp || ''
  }));
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  activeUser,
  onSendMessage,
  onResolveStuck,
  partnerReadAt = 0,
  relayStatus = 'connected',
  onOpenSoftLanding,
  partnerOnline = false,
  partnerLastSeen = 0,
  partnerTyping = false,
  shareReceipts = true,
  onTyping,
  onStartCall,
  callInProgress = false,
  partnerName = 'Partner',
  onVoiceHeard
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  /**
   * Hold-to-talk. The mic takes Send's place while the text box is empty, and
   * the strip lies over the composer while a note is under way. Not during a
   * call: the call has the microphone, and its sound would be in the note.
   */
  const rec = useVoiceRecorder({
    onSend: note => onSendMessage(voiceNoteLabel(note.durationSeconds), false, voiceFieldsOf(note)),
    disabled: callInProgress,
    onActiveChange: active => {
      if (active) setShowEmojiPicker(false);
    }
  });
  const showMic = rec.supported && (!inputText.trim() || rec.active);
  /** Which stuck message has its retry/discard choice open. */
  const [stuckOpen, setStuckOpen] = useState<string | null>(null);

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

  // The same for the day dividers: "Today" becomes "Yesterday" at midnight.
  // Only the day is kept, so the conversation is laid out again once a day
  // rather than once a minute.
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayKey()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const rows = useMemo(
    () => layOut(messages),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, today]
  );

  const [showNeedModal, setShowNeedModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Whether the conversation is scrolled to its newest message.
   *
   * Opening the keyboard shrinks the panel from below, and the log used to
   * keep its scroll position while it shrank - so the last few bubbles slid
   * under the composer just as you started to answer them. While this is
   * true, any change of size keeps the end in view; scrolling up to read
   * something older turns it off, so nothing drags you back down.
   */
  const pinnedRef = useRef(true);
  const handleLogScroll = () => {
    const log = messagesRef.current;
    if (!log) return;
    pinnedRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < AT_BOTTOM_PX;
  };

  useEffect(() => {
    const log = messagesRef.current;
    if (!log || typeof ResizeObserver === 'undefined') return;
    // The log itself (keyboard, composer growing, picker opening) and what is
    // inside it (a voice memo or a long message laying out late).
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) log.scrollTop = log.scrollHeight;
    });
    observer.observe(log);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  // A new message, sent or received, brings the conversation to it, as it
  // always has. Anything else that changes a message - a tick turning blue -
  // only keeps the end in view if that is where you already were.
  const newestId = messages.length ? messages[messages.length - 1].id : '';
  const shownNewestRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    // scrollIntoView walks up and scrolls EVERY scrollable ancestor, including
    // the page, which is what yanked the whole layout around on each message.
    // Driving the log's own scrollTop moves only the log.
    const log = messagesRef.current;
    if (!log) return;
    if (newestId !== shownNewestRef.current) {
      shownNewestRef.current = newestId;
      pinnedRef.current = true;
    }
    if (pinnedRef.current) log.scrollTop = log.scrollHeight;
  }, [messages, newestId]);

  // The composer grows with what is written, up to about five lines, so a
  // long message wraps where it can be read instead of scrolling sideways out
  // of a one-line box.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // Empty, it is one line whatever the placeholder does: a placeholder that
    // wraps on a narrow phone would otherwise be measured as a second line.
    if (!inputText) {
      el.style.height = '';
      el.style.overflowY = 'hidden';
      return;
    }
    el.style.height = 'auto';
    const border = el.offsetHeight - el.clientHeight;
    const wanted = el.scrollHeight + border;
    el.style.height = `${Math.min(wanted, COMPOSER_MAX_PX)}px`;
    el.style.overflowY = wanted > COMPOSER_MAX_PX ? 'auto' : 'hidden';
  }, [inputText]);

  /**
   * Whether a phone's on-screen keyboard is the way in.
   *
   * On a phone, Enter is the only way to start a new line, so it has to make
   * one and Send sends. With a real keyboard, Enter sends and Shift+Enter
   * makes the new line, the way every desktop messenger does.
   */
  const touchFirst = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
    []
  );

  /**
   * Keeps the keyboard up through a tap on Send or the emoji button.
   *
   * A button takes focus from the text when it is pressed, and losing focus
   * is what closes a phone's keyboard - so every message used to end with the
   * keyboard dropping and another tap on the field to bring it back. Refusing
   * the press its default keeps focus where it is. Whether the text had focus
   * is noted too, for the browsers that move it anyway.
   */
  const composerHadFocusRef = useRef(false);
  const keepComposerFocus = (e: React.SyntheticEvent) => {
    composerHadFocusRef.current = document.activeElement === inputRef.current;
    e.preventDefault();
  };
  const restoreComposerFocus = () => {
    if (composerHadFocusRef.current && document.activeElement !== inputRef.current) {
      inputRef.current?.focus();
    }
    composerHadFocusRef.current = false;
  };

  const handleSendText = () => {
    const text = inputText.trim();
    if (!text) return;
    onSendMessage(text);
    setInputText('');
    haptic('confirm');
    restoreComposerFocus();
  };

  const handleComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mid-word in an input method, Enter picks the word; it is not ours.
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    // Ctrl/Cmd+Enter sends everywhere, for a tablet with a keyboard attached.
    const send = e.ctrlKey || e.metaKey || (!touchFirst && !e.shiftKey);
    if (!send) return;
    e.preventDefault();
    handleSendText();
  };

  // Read through a ref so the laid-out conversation below does not have to be
  // built again each time the screen around it hands down a new function.
  const resolveStuckRef = useRef(onResolveStuck);
  resolveStuckRef.current = onResolveStuck;
  const canResolveStuck = !!onResolveStuck;
  const voiceHeardRef = useRef(onVoiceHeard);
  voiceHeardRef.current = onVoiceHeard;

  /**
   * The partner's next voice note, started by itself when the one before it
   * finished - so several notes in a row are heard as one, the way they were
   * said. `signal` only ever grows: each value is a new request to play.
   */
  const [autoPlay, setAutoPlay] = useState<{ id: string; signal: number } | null>(null);
  const latestMessagesRef = useRef(messages);
  latestMessagesRef.current = messages;
  const activeUserRef = useRef(activeUser);
  activeUserRef.current = activeUser;
  /**
   * Called when a note plays to its end. Looks at the conversation as it is
   * now, not as it was when the bubble was drawn: the next note may have been
   * heard, or a message may have arrived between them, in the meantime.
   */
  const playNextAfter = (id: string) => {
    const list = latestMessagesRef.current;
    const i = list.findIndex(m => m.id === id);
    const next = i >= 0 ? list[i + 1] : undefined;
    if (!next || !next.isVoiceMemo || next.authorId === activeUserRef.current || next.heard) return;
    setAutoPlay(prev => ({ id: next.id, signal: (prev?.signal ?? 0) + 1 }));
  };
  const playNextAfterRef = useRef(playNextAfter);
  playNextAfterRef.current = playNextAfter;

  /**
   * The bubbles themselves.
   *
   * Built only when the conversation or how it is shown changes - not on each
   * keystroke in the composer, which used to redraw every message ever kept.
   */
  const conversation = useMemo(
    () =>
      rows.map((row, i) => {
        const { msg, firstOfRun, lastOfRun } = row;
        const mine = msg.authorId === activeUser;
        const read = !!msg.sentAt && partnerReadAt >= msg.sentAt;
        // Whether it ever left is not a read receipt, so the clock and its
        // retry stay even with receipts switched off - otherwise a message
        // that never went would sit there looking sent.
        const stuck = mine && !msg.delivered && !read;
        const showMeta = lastOfRun || stuck;

        // One rounded shape per run: the corners on the sender's side tuck in
        // where bubbles meet, and the last one keeps a small tail.
        const shape = mine
          ? `rounded-br-md ${firstOfRun ? '' : 'rounded-tr-md'}`
          : `rounded-bl-md ${firstOfRun ? '' : 'rounded-tl-md'}`;
        const spacing = row.divider ? 'mt-1' : !firstOfRun ? 'mt-1' : i === 0 ? '' : 'mt-4';

        return (
          <React.Fragment key={msg.id}>
            {row.divider && (
              <div className="flex justify-center pt-4 pb-1 first:pt-0">
                <span className="rounded-full bg-linen-variant px-3 py-0.5 text-[11px] font-medium text-linen-secondary">
                  {row.divider}
                </span>
              </div>
            )}

            <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${spacing}`}>
              <div
                className={`sm:max-w-md rounded-2xl ${
                  // A little tighter around a player, which has its own
                  // breathing room, than around words - and a little more of
                  // the width, so its 200px fits a 320px phone.
                  msg.isVoiceMemo ? 'max-w-[90%] px-3 py-2' : 'max-w-[85%] px-4 py-2.5'
                } text-sm leading-relaxed ${shape} ${
                  msg.isNeedCard
                    ? 'bg-gold-50 border border-gold-500/40 text-linen-primary'
                    : mine
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
                  // The player stands for the note; its label ("Voice note ·
                  // 0:12") is for notifications and older phones, not here.
                  // Heard marks on your own notes follow read receipts, as the
                  // ticks do; the "new" dot on the partner's is this phone's
                  // own business and always shows.
                  <VoiceNotePlayer
                    id={msg.id}
                    audioDataUrl={msg.audioDataUrl}
                    durationSeconds={msg.audioDurationSeconds}
                    peaks={msg.audioPeaks}
                    tone={mine ? 'mine' : 'theirs'}
                    heard={!!msg.heard}
                    showHeard={mine ? shareReceipts : true}
                    onFirstPlay={mine ? undefined : () => voiceHeardRef.current?.(msg.id)}
                    onEnded={() => playNextAfterRef.current(msg.id)}
                    playSignal={autoPlay?.id === msg.id ? autoPlay.signal : undefined}
                  />
                ) : (
                  // Selectable on purpose: the rest of the app is not, so a
                  // long press on a button never selects its label, but a
                  // message is something you copy.
                  <p className="select-text whitespace-pre-wrap break-words">{msg.text}</p>
                )}
              </div>

              {showMeta && (
                <span className="text-[10px] text-linen-secondary mt-1 px-1 inline-flex items-center">
                  {/* The name once per run, under its last bubble with the time. */}
                  {lastOfRun && (
                    <span>
                      {who(msg.authorId, activeUser, partnerName)}
                      {row.time && <> &middot; {row.time}</>}
                    </span>
                  )}
                  {mine && (
                    <span className="ml-1.5 inline-flex items-center align-middle">
                      {stuck ? (
                        <>
                          {/* The clock is the control: a message that never left
                              needs somewhere to go, and nothing else on the row
                              belongs to it. */}
                          <button
                            onClick={() =>
                              canResolveStuck && setStuckOpen(open => (open === msg.id ? null : msg.id))
                            }
                            aria-label="Still sending"
                            aria-expanded={stuckOpen === msg.id}
                            className="rounded p-0.5 text-linen-secondary/60 hover:text-linen-primary transition-colors cursor-pointer"
                          >
                            <Clock className="w-3 h-3" />
                          </button>
                          <span className="sr-only">Sending</span>
                        </>
                      ) : !shareReceipts ? null : read ? (
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-sky-600" />
                          <span className="sr-only">Read</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-linen-secondary/70" />
                          <span className="sr-only">Sent</span>
                        </>
                      )}
                    </span>
                  )}
                </span>
              )}

              {stuckOpen === msg.id && canResolveStuck && (
                <span className="mt-0.5 flex items-center gap-1.5 px-1">
                  <button
                    onClick={() => {
                      setStuckOpen(null);
                      resolveStuckRef.current?.(msg.id, 'retry');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-linen-border bg-linen-surface px-2 py-1 text-[10px] font-medium text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3" /> Send again
                  </button>
                  <button
                    onClick={() => {
                      setStuckOpen(null);
                      resolveStuckRef.current?.(msg.id, 'delete');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-linen-border bg-linen-surface px-2 py-1 text-[10px] font-medium text-linen-secondary hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Discard
                  </button>
                </span>
              )}
            </div>
          </React.Fragment>
        );
      }),
    [rows, activeUser, partnerReadAt, shareReceipts, stuckOpen, partnerName, canResolveStuck, autoPlay]
  );

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
          {/* Enabled whether or not they are online. A call to somebody who
              is away cannot connect, but it still leaves a missed call they
              will see - which is what calling a phone that is off does too. */}
          {onStartCall && (
            <button
              onClick={onStartCall}
              disabled={callInProgress}
              aria-label={`Call ${partnerName}`}
              title={`Call ${partnerName}`}
              className="rounded-lg border border-linen-border bg-linen-surface p-1.5 text-linen-primary hover:bg-linen-variant disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}
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
      <div
        ref={messagesRef}
        onScroll={handleLogScroll}
        className="flex-1 min-h-0 overflow-y-auto scroll-contain p-4 sm:p-6"
      >
        <div ref={contentRef}>
          {/* Said once the device is full rather than never. The oldest fall off
              to keep the vault inside what a browser will store, which is a fine
              thing to do and a poor thing to do silently. */}
          {messages.length >= MAX_CHAT_MESSAGES && (
            <p className="pb-4 text-center text-[10px] leading-relaxed text-linen-secondary">
              Only the most recent {MAX_CHAT_MESSAGES.toLocaleString()} messages are kept on this
              device. Older ones are gone from here &mdash; a backup keeps them.
            </p>
          )}

          {conversation}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* The picker, open only when asked for. It sits between the messages
          and the composer so the draft you are adding to stays in view, and it
          is capped at a third of the panel so the conversation never vanishes
          behind it. Tapping appends rather than sends, so several can be
          combined, or wrapped in words, before it goes.

          Picking keeps the keyboard up, the same as the buttons below. With the
          keyboard up there may not be room for all of it, so it is the part
          that gives way, never the composer. */}
      {showEmojiPicker && (
        <div className="min-h-0 shrink overflow-y-auto" onMouseDown={e => e.preventDefault()}>
          <EmojiPicker
            onPick={char => setInputText(t => t + char)}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}

      {/* Input Bar. Positioned, so a voice note under way can lie over the
          emoji button and the text box (which stay mounted underneath, the
          text box focused if it was, so the keyboard does not drop) while the
          mic - the last control - stays where the thumb is. */}
      <div className="relative p-4 pt-2 border-t-0 bg-linen-surface flex items-end gap-2">
            <VoiceRecordingStrip rec={rec} className="pl-4 pt-2 pb-4" />

            {/* Deliberately the leftmost control, which is exactly where the
                first emoji of the old row sat - the character you reached for
                is still under the same thumb, it just opens the rest now. */}
            <button
              type="button"
              onPointerDown={keepComposerFocus}
              onMouseDown={keepComposerFocus}
              onClick={() => {
                setShowEmojiPicker(v => !v);
                restoreComposerFocus();
              }}
              aria-expanded={showEmojiPicker}
              className={`h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-xl transition-colors ${
                showEmojiPicker
                  ? 'bg-linen-variant text-linen-primary'
                  : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant'
              }`}
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                announceTyping();
              }}
              onKeyDown={handleComposerKey}
              enterKeyHint={touchFirst ? 'enter' : 'send'}
              autoCapitalize="sentences"
              aria-label={`Message to ${partnerName}`}
              // Short enough for one line on a small phone; whose chat this is
              // is already in the header right above.
              placeholder="Write a quiet thought…"
              className="flex-1 min-w-0 resize-none overflow-y-hidden px-4 py-2.5 text-sm leading-5 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary placeholder:text-linen-secondary/60 select-text"
            />

            {/* One slot: Send while there is something written, the mic while
                there is not - and the mic for as long as a note is under way,
                where it is the note's own Send. A phone that cannot record
                keeps the Send button here, greyed until there is text. */}
            {showMic ? (
              <VoiceMicButton rec={rec} />
            ) : (
              <button
                type="button"
                onPointerDown={keepComposerFocus}
                onMouseDown={keepComposerFocus}
                onClick={handleSendText}
                disabled={!inputText.trim()}
                aria-label="Send"
                className="h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-xl bg-linen-primary text-linen-surface hover:opacity-90 disabled:opacity-40 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
      </div>

      <NeedMenuModal
        isOpen={showNeedModal}
        onClose={() => setShowNeedModal(false)}
        onSelectNeed={(need) => {
          onSendMessage(`I need: ${need.title} — ${need.description}`, true);
          haptic('confirm');
          setShowNeedModal(false);
        }}
      />
    </div>
  );
};
