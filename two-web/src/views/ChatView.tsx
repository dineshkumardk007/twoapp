import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ChatDraft, ChatMessage, ChatPin, ChatReplyRef } from '../types';
import { countUnread, firstUnreadId } from '../core/unread';
import { BEFORE_LOCK_EVENT } from '../core/autoLock';
import { callWords } from '../core/callLog';
import { linkParts } from '../core/links';
import { isAndroidApp } from '../core/platform';
import { isWaiting, nextShowAt } from '../core/sendLater';
import { liveStatus, statusWords, type StatusNote } from '../core/status';
import { useNowAt } from '../core/useToday';
import { aheadLabel, clockTime, dayLabel, startOfDay } from '../core/when';
import { SendLaterSheet } from '../components/SendLaterSheet';
import { VoiceNotePlayer } from '../components/VoiceNotePlayer';
import { VoiceMicButton, VoiceRecordingStrip, useVoiceRecorder } from '../components/VoiceRecorder';
import { MessageMenu, type MessageMenuAction } from '../components/MessageMenu';
import { PhotoViewer } from '../components/PhotoViewer';
import { ChatMediaSheet, isGalleryPhoto } from '../components/ChatMediaSheet';
import { PhotoSendSheet } from '../components/PhotoSendSheet';
import { ViewOnceIcon } from '../components/ViewOnceIcon';
import { voiceFieldsOf, voiceNoteLabel } from '../core/voice';
import { MessageInfoSheet } from '../components/MessageInfoSheet';
import { FloatingDayChip, useFloatingDay } from '../components/FloatingDayChip';
import { coupleInfo } from '../core/messageInfo';
import {
  MAX_PINS,
  canDeleteForMe,
  canEdit,
  canOpenViewOnce,
  canPin,
  canUnsend,
  highlightParts,
  livePins,
  readByPartner,
  replyRefFor,
  searchMatches,
  snippetOf,
  type MessageExtras
} from '../core/chatActions';
import { shrinkPhoto } from '../core/photo';
import { PHOTOS_AT_ONCE, PHOTO_MAX_CHARS, dataUrlToBlob, photoFileName, photoSize, snippetShown } from '../core/chatShow';
import { useMessageGestures } from '../core/useMessageGestures';
import { ReplyQuote } from '../components/ReplyQuote';
import { ReactionPill } from '../components/ReactionPill';
import { ComposeBanner } from '../components/ComposeBanner';
import { JumpToNewestButton } from '../components/JumpToNewestButton';
import { copyText } from '../core/clipboard';
import { saveFile } from '../core/saveFile';
import { useBackLayer } from '../core/backStack';
import { formatLastSeen } from '../core/lastSeen';
import { presenceLine } from '../core/presenceLine';
import { useTypingSender } from '../core/typing';
import { MAX_CHAT_MESSAGES } from '../core/storage';
import { who } from '../core/who';
import { activeLocale, tr, useT } from '../core/i18n';
import { focusForTyping } from '../core/softKeyboard';
import { haptic } from '../core/haptics';
import {
  Send, Sparkles, Heart, EyeOff, Check, CheckCheck, Clock, Smile, RotateCw, Trash2, Phone,
  Search, X, ChevronUp, ChevronDown, CornerUpLeft, Copy, Pencil, Undo2, Image as ImageIcon, Download,
  Camera, Pin, PinOff, PhoneIncoming, PhoneOutgoing, PhoneMissed, AlarmClock, EllipsisVertical, Info
} from 'lucide-react';
import { EmojiPicker } from '../components/EmojiPicker';

interface ChatViewProps {
  messages: ChatMessage[];
  activeUser: 'user' | 'partner';
  /** Newest sentAt the partner has confirmed reading. */
  partnerReadAt?: number;
  /**
   * When, by this phone's clock, that was heard here (core/chatActions,
   * readByPartner). Left out, the watermark alone says what is read.
   */
  partnerReadHeardAt?: number;
  /**
   * When you had last looked, as the chat came in front of you (core/unread):
   * where "New messages" goes.
   */
  readAt?: number;
  /** Goes up each time the chat comes in front of you: the chat takes a fresh look. */
  openKey?: number;
  /** A half-typed message to start with, if one was left. */
  draft?: ChatDraft;
  /** Keeps what is half-typed (or, with null, forgets it) - on leaving, never per key press. */
  onSaveDraft?: (draft: ChatDraft | null) => void;
  /**
   * Connection state, shown here because in the app the chat is the one screen
   * without the bar, whose pill said it everywhere else: without it there would
   * be nothing on screen to say a message is queued rather than sent.
   */
  relayStatus?: 'idle' | 'connecting' | 'connected' | 'reconnecting';
  /** Retry or abandon a message that never left this device. */
  onResolveStuck?: (messageId: string, action: 'retry' | 'delete') => void;
  /**
   * `extra` makes it a voice note or a photo (`text` is then its label), or an
   * answer to another message.
   */
  onSendMessage: (text: string, isNeed?: boolean, extra?: MessageExtras) => void;
  /** Sets, changes, or (with '') takes off your reaction to a message. */
  onReact?: (messageId: string, emoji: string) => void;
  /** New words for one of your own messages; offered for fifteen minutes after sending. */
  onEditMessage?: (messageId: string, text: string) => void;
  /** Takes one of your own messages back from both phones. The caller asks first. */
  onUnsendMessage?: (messageId: string) => void;
  /** Deletes a message, yours or theirs, from this phone only. The caller asks first. */
  onDeleteForMe?: (messageId: string) => void;
  /** Messages deleted on this phone, id to when: a quote of one says so. */
  deletedForMe?: Record<string, number>;
  /**
   * Her phone says when a message reaches it (CHAT_DELIVERED). False for an
   * older one, whose Info explains why it never says Reached.
   */
  partnerSaysDelivered?: boolean;
  /** Messages pinned to the top of the chat, newest last (core/chatActions). */
  pins?: ChatPin[];
  /** Pins a message, or takes its pin down, on both phones. */
  onPinMessage?: (messageId: string, pinned: boolean) => void;
  /** A view-once photo sent to you is being opened; its picture goes from this phone. */
  onViewOnceOpened?: (messageId: string) => void;
  /**
   * The partner's voice note has just been played for the first time on this
   * phone. Whether that is told to them is the caller's business (it follows
   * the read-receipt setting).
   */
  onVoiceHeard?: (messageId: string) => void;
  /** Opens the Heart Touch panel. It lives in Navigation; App bumps its signal. */
  onOpenHeart?: () => void;
  /** Hides Two at once, exactly as Tools' Quick Exit does - locks it, or shows the calculator. */
  onQuickExit?: () => void;
  /** Square to the screen's top and sides: the app on a phone, where no bar sits above. */
  flush?: boolean;
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
  /** The partner's one-tap status (core/status): under their name while it lasts. */
  partnerStatus?: StatusNote;
  /** "Send later" is offered: the partner's phone can hold a message back (core/sendLater). */
  canSendLater?: boolean;
  /** False when this device has switched read receipts and typing off. */
  shareReceipts?: boolean;
  /** Writing started (true) or stopped (false); when each is said is decided in core/typing. */
  onTyping?: (typing: boolean) => void;
  /** Rings the partner. Absent where calling is not offered. */
  onStartCall?: () => void;
  /** True while a call is ringing or live, so a second cannot be started. */
  callInProgress?: boolean;
  partnerName?: string;
}

// Built once. Formatting a date makes a formatter each time it is asked, and a
// conversation of a few thousand messages asked for one per bubble on every
// keystroke in the composer.
// The day names (dayLabel) are in core/when, shared with a group's chat.
const TIME_FORMAT = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
/** "9:41 pm" - in Tamil, the way the rest of Two says a time (core/when). */
function timeOf(at: number): string {
  return activeLocale() === 'ta' ? clockTime(at) : TIME_FORMAT.format(at);
}

/** who(), as this phone says it: "You" (and the stand-in "Partner") in its own language. */
function whoShown(author: string | undefined | null, activeUser: string, partnerName: string): string {
  const name = who(author, activeUser, partnerName);
  return name === 'You' ? tr('You') : name === 'Partner' ? tr('Partner') : name;
}

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

/**
 * How much of the conversation is drawn: the newest DRAWN_AT_FIRST messages
 * when the chat opens, and DRAWN_MORE further back each time you scroll to
 * within LOAD_EARLIER_PX of the top.
 *
 * Drawing every message ever kept made opening the chat stall: nine hundred
 * bubbles - most of them aurora gradients, almost all of them off screen -
 * took a mid-range phone about two seconds to style, lay out and paint, and a
 * chat may keep five thousand. The history is all still here; it is drawn as
 * you go back into it, the way a messenger does.
 */
const DRAWN_AT_FIRST = 80;
const DRAWN_MORE = 80;
const LOAD_EARLIER_PX = 600;

/** Local calendar day, as a key that changes exactly at midnight. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface Row {
  msg: ChatMessage;
  /** The name of the day, on the first message of each new one. */
  divider?: string;
  /** The name of the day it is under, on every message: the date that floats while you scroll. */
  day: string;
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
function layOut(messages: ChatMessage[], markId?: string): Row[] {
  const now = Date.now();
  const dividers: (string | undefined)[] = [];
  const days: string[] = [];
  // Messages from before the moment was kept have no day of their own; they
  // stay with whatever came before them rather than starting a new one.
  let day: number | null = null;
  let dayName = '';
  for (const m of messages) {
    const own = m.sentAt && Number.isFinite(m.sentAt) ? startOfDay(m.sentAt) : null;
    if (own !== null && own !== day) {
      dayName = dayLabel(own, now, typeof m.showAt === 'number');
      dividers.push(dayName);
      day = own;
    } else {
      dividers.push(undefined);
    }
    days.push(dayName);
  }

  // A call's line stands on its own: bubbles either side of it do not join through it.
  // Nor through "New messages": the last one read keeps its name and time.
  const joins = (a: ChatMessage, b: ChatMessage, newDay: string | undefined) =>
    !a.call &&
    !b.call &&
    b.id !== markId &&
    a.authorId === b.authorId &&
    !newDay &&
    (!a.sentAt || !b.sentAt || Math.abs(b.sentAt - a.sentAt) < RUN_GAP_MS);

  return messages.map((msg, i) => ({
    msg,
    divider: dividers[i],
    day: days[i],
    firstOfRun: i === 0 || !joins(messages[i - 1], msg, dividers[i]),
    lastOfRun: i === messages.length - 1 || !joins(msg, messages[i + 1], dividers[i + 1]),
    // The stored word ("Just now") stays English; it is said in this phone's language.
    time: msg.sentAt && Number.isFinite(msg.sentAt) ? timeOf(msg.sentAt) : tr(msg.timestamp || '')
  }));
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  activeUser,
  onSendMessage,
  onResolveStuck,
  partnerReadAt = 0,
  partnerReadHeardAt = Infinity,
  readAt,
  openKey = 0,
  draft,
  onSaveDraft,
  relayStatus = 'connected',
  onOpenHeart,
  onQuickExit,
  flush = false,
  partnerOnline = false,
  partnerLastSeen = 0,
  partnerTyping = false,
  partnerStatus,
  canSendLater = false,
  shareReceipts = true,
  onTyping,
  onStartCall,
  callInProgress = false,
  partnerName = 'Partner',
  onVoiceHeard,
  onReact,
  onEditMessage,
  onUnsendMessage,
  onDeleteForMe,
  deletedForMe,
  partnerSaysDelivered = true,
  pins,
  onPinMessage,
  onViewOnceOpened
}) => {
  const tr = useT();
  // What the laid-out conversation is said in: built again if it changes.
  const lang = activeLocale();
  // Back in the box: whatever was half-typed when the chat was last left.
  const [inputText, setInputText] = useState(() => draft?.text ?? '');
  const inApp = useMemo(() => isAndroidApp(), []);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  /** The "Send later" times are open, for what is in the box. */
  const [laterOpen, setLaterOpen] = useState(false);
  // Drawn again the moment a message of yours set for later comes due, and
  // when your partner's status runs out. What shows is decided by the clock
  // as it is then (core/sendLater, core/status).
  const waitClock = useNowAt(nextShowAt(messages));
  useNowAt(partnerStatus && partnerStatus.clearsAt > Date.now() ? partnerStatus.clearsAt : undefined);
  const theirStatus = liveStatus(partnerStatus);

  /** The message being answered: shown above the composer, and sent with what is written next. */
  const [replyTo, setReplyTo] = useState<ChatReplyRef | null>(() => draft?.replyTo ?? null);
  const replyToRef = useRef(replyTo);
  replyToRef.current = replyTo;
  /** One of your messages having its words changed, in the composer; what it said before. */
  const [editing, setEditing] = useState<{ id: string; original: string } | null>(null);

  /**
   * What is half-typed is kept when you leave - for another screen, another
   * app, or a locked phone - and is back in the box next time. Put down on
   * the way out rather than on every key press, because each save
   * re-encrypts everything. Not an edit under way: those are an old
   * message's words, not something new.
   */
  const draftNowRef = useRef<ChatDraft | null>(null);
  draftNowRef.current =
    editing || (!inputText.trim() && !replyTo) ? null : { text: inputText, ...(replyTo ? { replyTo } : {}), at: 0 };
  const draftKey = (d: ChatDraft | null | undefined) => JSON.stringify(d ? [d.text, d.replyTo?.id ?? null] : null);
  const savedDraftRef = useRef(draftKey(draft));
  const onSaveDraftRef = useRef(onSaveDraft);
  onSaveDraftRef.current = onSaveDraft;
  const putDraftDown = () => {
    const now = draftNowRef.current;
    const key = draftKey(now);
    if (key === savedDraftRef.current) return;
    savedDraftRef.current = key;
    onSaveDraftRef.current?.(now ? { ...now, at: Date.now() } : null);
  };
  const putDraftDownRef = useRef(putDraftDown);
  putDraftDownRef.current = putDraftDown;
  /**
   * A draft that was only a reply, used by a voice note or photos: gone at
   * once, as a sent message's is, so a lock straight after cannot bring the
   * reply back. Words still in the box stay a draft.
   */
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  const forgetUsedDraft = () => {
    if (inputTextRef.current.trim() || savedDraftRef.current === draftKey(null)) return;
    savedDraftRef.current = draftKey(null);
    onSaveDraftRef.current?.(null);
  };
  const startCallRef = useRef(onStartCall);
  startCallRef.current = onStartCall;
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') putDraftDownRef.current();
    };
    const onPageHide = () => putDraftDownRef.current();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener(BEFORE_LOCK_EVENT, onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener(BEFORE_LOCK_EVENT, onPageHide);
      putDraftDownRef.current();
    };
  }, []);

  /**
   * Hold-to-talk. The mic takes Send's place while the text box is empty, and
   * the strip lies over the composer while a note is under way. Not during a
   * call: the call has the microphone, and its sound would be in the note.
   * A note recorded while answering a message answers it.
   */
  const rec = useVoiceRecorder({
    onSend: note => {
      const reply = replyToRef.current;
      onSendMessage(voiceNoteLabel(note.durationSeconds), false, {
        ...voiceFieldsOf(note),
        ...(reply ? { replyTo: reply } : {})
      });
      if (reply) setReplyTo(null);
      forgetUsedDraft();
    },
    disabled: callInProgress,
    onActiveChange: active => {
      if (active) setShowEmojiPicker(false);
    }
  });
  const showMic = rec.supported && (!inputText.trim() || rec.active);
  /** Photos are offered while nothing is written - not mid-sentence, mid-edit, or mid-note. */
  const showPhotoButton = !inputText && !editing && !rec.active;
  // Where the photo buttons sit while the box is empty: once there are
  // words, the way to send them later.
  const showLaterButton = canSendLater && !!inputText.trim() && !editing && !rec.active;
  /** Which stuck message has its retry/discard choice open. */
  const [stuckOpen, setStuckOpen] = useState<string | null>(null);

  /**
   * Says "typing…" on the first key, keeps it alive while the keys keep
   * coming, and says stopped when they do (core/typing). Never at Send: her
   * phone takes the message itself as the end.
   */
  const typing = useTypingSender(onTyping);

  // Re-rendered on a timer only because the wording ages: "today at 23:58"
  // has to become "yesterday at 23:58" without the screen being touched.
  const [lastSeenLabel, setLastSeenLabel] = useState(() => formatLastSeen(partnerLastSeen));
  useEffect(() => {
    setLastSeenLabel(formatLastSeen(partnerLastSeen));
    if (!partnerLastSeen) return;
    const timer = setInterval(() => setLastSeenLabel(formatLastSeen(partnerLastSeen)), 60_000);
    return () => clearInterval(timer);
  }, [partnerLastSeen, lang]);

  // The same for the day dividers: "Today" becomes "Yesterday" at midnight.
  // Only the day is kept, so the conversation is laid out again once a day
  // rather than once a minute.
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayKey()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // "New messages": where the unread ones began as the chat came in front of
  // you. Kept from that moment, because looking marks them read at once -
  // and shown only if there were some then, not above each message that
  // arrives while you are reading. Taken again each time the chat comes back
  // in front (openKey): from the lock screen, another app, a group.
  const takeLook = () => ({ key: openKey, readAt, hadUnread: countUnread(messages, activeUser, readAt) > 0 });
  const [opening, setOpening] = useState(takeLook);
  if (opening.key !== openKey) setOpening(takeLook());
  const newMarkId = useMemo(
    () => (opening.hadUnread ? firstUnreadId(messages, activeUser, opening.readAt) : undefined),
    [messages, activeUser, opening]
  );

  const rows = useMemo(
    () => layOut(messages, newMarkId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, today, newMarkId, lang]
  );

  // Where the drawn part of the conversation starts. Kept as an index from the
  // oldest message, so new messages add to the end without moving what you are
  // reading; never so late that fewer than DRAWN_AT_FIRST would show - and far
  // enough back to show where the new messages begin.
  // Never more than three screens' worth at first, however much is new: past
  // that the chat opens at the oldest drawn, and scrolling up draws more.
  const startFor = (markId: string | undefined) => {
    const last = Math.max(0, messages.length - DRAWN_AT_FIRST);
    const mark = markId ? messages.findIndex(m => m.id === markId) : -1;
    return mark >= 0 && mark < last ? Math.max(mark - 5, messages.length - DRAWN_AT_FIRST * 3, 0) : last;
  };
  const [firstDrawn, setFirstDrawn] = useState(() => startFor(newMarkId));
  // A fresh look with new messages further back than is drawn: draw back to them.
  const [drawnForLook, setDrawnForLook] = useState(opening.key);
  if (drawnForLook !== opening.key) {
    setDrawnForLook(opening.key);
    const start = startFor(newMarkId);
    if (start < firstDrawn) setFirstDrawn(start);
  }
  const drawnFrom = Math.max(0, Math.min(firstDrawn, rows.length - DRAWN_AT_FIRST));
  const drawnRows = useMemo(() => rows.slice(drawnFrom), [rows, drawnFrom]);
  /** Set while earlier messages are being added above, to keep your place. */
  const growingRef = useRef<{ height: number; top: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** The day at the top while you scroll (components/FloatingDayChip), from each row's data-day. */
  const floatingDay = useFloatingDay(messagesRef);

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
  /** More than a screen above the newest message: the way back down is offered. */
  const [awayFromEnd, setAwayFromEnd] = useState(false);
  const handleLogScroll = () => {
    const log = messagesRef.current;
    if (!log) return;
    const fromEnd = log.scrollHeight - log.scrollTop - log.clientHeight;
    pinnedRef.current = fromEnd < AT_BOTTOM_PX;
    setAwayFromEnd(fromEnd > log.clientHeight);
    // Near the top with more behind it: draw the next part of the history.
    if (log.scrollTop < LOAD_EARLIER_PX && drawnFrom > 0 && !growingRef.current) {
      growingRef.current = { height: log.scrollHeight, top: log.scrollTop };
      setFirstDrawn(Math.max(0, drawnFrom - DRAWN_MORE));
    }
    floatingDay.onScroll();
  };

  // Earlier messages were just drawn above: move down by exactly what they
  // added, so the message you were reading stays where it was.
  useLayoutEffect(() => {
    const log = messagesRef.current;
    const growing = growingRef.current;
    if (!log || !growing) return;
    log.scrollTop = log.scrollHeight - growing.height + growing.top;
    growingRef.current = null;
  }, [drawnFrom]);

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
  //
  // Yours set to show later sit at their time, so at the end until then
  // (core/sendLater). The newest is the last of the others - one you send
  // goes in before those - and setting one more for later is a message of
  // yours too.
  const newest = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!(m.authorId === activeUser && typeof m.showAt === 'number')) return m;
    }
    return undefined;
  }, [messages, activeUser]);
  const newestId = newest?.id ?? '';
  const shownNewestRef = useRef<string | null>(null);
  const laterIds = useMemo(
    () => messages.filter(m => m.authorId === activeUser && typeof m.showAt === 'number').map(m => m.id),
    [messages, activeUser]
  );
  const shownLaterRef = useRef(laterIds);

  // More new messages than fit on a screen: start at "New messages" rather
  // than at the end, so they are read from the first - each time the chat
  // comes in front with new ones. Before the effect below, which then has
  // nothing new to scroll to. When so many are new that "New messages" is
  // further back than is drawn, the chat starts at the oldest drawn.
  const placedForRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (placedForRef.current === opening.key) return;
    placedForRef.current = opening.key;
    const log = messagesRef.current;
    if (!log || !opening.hadUnread || !newMarkId) return;
    const mark = log.querySelector<HTMLElement>('[data-new-mark]');
    const markTop = mark
      ? mark.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop
      : 0;
    if (log.scrollHeight - markTop <= log.clientHeight) return;
    shownNewestRef.current = newestId;
    pinnedRef.current = false;
    log.scrollTop = Math.max(0, markTop - 8);
    setAwayFromEnd(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening.key, drawnFrom]);

  /** Back down to the newest message, drawing just the last part again. */
  const goToNewest = () => {
    const log = messagesRef.current;
    if (!log) return;
    pinnedRef.current = true;
    setAwayFromEnd(false);
    if (rows.length - drawnFrom > DRAWN_AT_FIRST * 3) setFirstDrawn(rows.length - DRAWN_AT_FIRST);
    log.scrollTop = log.scrollHeight;
    haptic('tick');
  };

  useLayoutEffect(() => {
    // scrollIntoView walks up and scrolls EVERY scrollable ancestor, including
    // the page, which is what yanked the whole layout around on each message.
    // Driving the log's own scrollTop moves only the log.
    const log = messagesRef.current;
    if (!log) return;
    if (newestId !== shownNewestRef.current) {
      const first = shownNewestRef.current === null;
      shownNewestRef.current = newestId;
      // Your own message brings you to the end, as it always has. One of
      // theirs, arriving while you read further up, leaves you where you
      // are: the way down is the button at the bottom.
      if (first || newest?.authorId === activeUser) pinnedRef.current = true;
    }
    if (laterIds !== shownLaterRef.current) {
      const before = new Set(shownLaterRef.current);
      shownLaterRef.current = laterIds;
      if (laterIds.some(id => !before.has(id))) pinnedRef.current = true;
    }
    if (pinnedRef.current) log.scrollTop = log.scrollHeight;
    // Opened while a long catch-up was arriving, the drawn part grows with it.
    // At the end of the conversation, it goes back to the newest few.
    if (pinnedRef.current && rows.length - drawnFrom > DRAWN_AT_FIRST * 3) {
      setFirstDrawn(rows.length - DRAWN_AT_FIRST);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (editing) {
      const target = messages.find(m => m.id === editing.id);
      if (!target || !canEdit(target, activeUser)) {
        // The fifteen minutes ran out while the new words were being written.
        showToast(tr('Too late to change - messages can be edited for 15 minutes'));
      } else if (text !== editing.original) {
        onEditMessage?.(editing.id, text);
      }
      setEditing(null);
    } else {
      onSendMessage(text, false, replyTo ? { replyTo } : undefined);
      typing.sent();
      setReplyTo(null);
    }
    setInputText('');
    if (savedDraftRef.current !== draftKey(null)) {
      savedDraftRef.current = draftKey(null);
      onSaveDraftRef.current?.(null);
    }
    haptic('confirm');
    restoreComposerFocus();
  };

  /** What is in the box, sent now to show at the time picked (core/sendLater). */
  const sendLater = (showAt: number) => {
    setLaterOpen(false);
    const text = inputText.trim();
    if (!text || editing) return;
    onSendMessage(text, false, { ...(replyTo ? { replyTo } : {}), showAt });
    typing.sent();
    setReplyTo(null);
    setInputText('');
    if (savedDraftRef.current !== draftKey(null)) {
      savedDraftRef.current = draftKey(null);
      onSaveDraftRef.current?.(null);
    }
    haptic('confirm');
    showToast(tr('Set to show {when}', { when: aheadLabel(showAt) }));
  };

  /** Answer a message: its quote goes above the composer, and the keyboard comes up. */
  const answer = (id: string) => {
    const m = messages.find(x => x.id === id);
    // Not to one of yours still waiting to show: it is not there for them yet.
    if (!m || m.unsent || isWaiting(m, activeUser)) return;
    if (editing) {
      setEditing(null);
      setInputText('');
    }
    setReplyTo(replyRefFor(m));
    focusForTyping(inputRef.current);
  };

  /** Change one of your messages: its words go into the composer to be written over. */
  const startEdit = (m: ChatMessage) => {
    // The new message being written is put aside: changing an old one is not typing.
    typing.stop();
    setReplyTo(null);
    setEditing({ id: m.id, original: m.text });
    setInputText(m.text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  /** Put down an answer or an edit without sending it. */
  const cancelCompose = () => {
    setReplyTo(null);
    if (editing) {
      setEditing(null);
      setInputText('');
    }
  };
  useBackLayer(!!(replyTo || editing), cancelCompose);
  // Deleted from this phone meanwhile: not there to answer or change any more.
  useEffect(() => {
    if (!deletedForMe) return;
    if (replyTo && deletedForMe[replyTo.id]) setReplyTo(null);
    if (editing && deletedForMe[editing.id]) {
      setEditing(null);
      setInputText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletedForMe]);

  /** A word or two for a moment, over the conversation: "Copied", "Saved". */
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef(0);
  const showToast = (text: string) => {
    setToast(text);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1800);
  };
  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  /**
   * Photos chosen from the phone or just taken with its camera. They wait for
   * a last look first (PhotoSendSheet), where a single one can be made view
   * once; then they go one message each, in the order picked.
   */
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [pickedPhotos, setPickedPhotos] = useState<File[] | null>(null);
  const pickPhotos = (files: FileList | null) => {
    const picked = files ? Array.from(files).filter(f => !f.type || f.type.startsWith('image/')) : [];
    if (!picked.length) return;
    if (picked.length > PHOTOS_AT_ONCE) showToast(tr('Up to {n} photos at a time', { n: PHOTOS_AT_ONCE }));
    setPickedPhotos(picked.slice(0, PHOTOS_AT_ONCE));
  };

  /**
   * Sends photos one message each. Each is shrunk to fit one record first
   * (core/photo); the first of them answers the message being answered, if
   * there is one.
   */
  const [preparingPhotos, setPreparingPhotos] = useState(0);
  const sendPhotos = async (list: File[], viewOnce: boolean) => {
    let reply = replyToRef.current;
    setReplyTo(null);
    forgetUsedDraft();
    setPreparingPhotos(n => n + list.length);
    for (const file of list) {
      try {
        const photo = await shrinkPhoto(file, PHOTO_MAX_CHARS);
        onSendMessage('Photo', false, {
          isPhoto: true,
          photoDataUrl: photo.dataUrl,
          photoWidth: photo.width,
          photoHeight: photo.height,
          ...(viewOnce ? { viewOnce: true as const } : {}),
          ...(reply ? { replyTo: reply } : {})
        });
        reply = null;
        haptic('confirm');
      } catch {
        showToast(tr('That file could not be opened as a photo'));
      } finally {
        setPreparingPhotos(n => Math.max(0, n - 1));
      }
    }
  };

  /** A photo, out of the chat and into the phone's own storage, where the person chooses. */
  const savePhoto = async (m: ChatMessage) => {
    if (!m.photoDataUrl) return;
    try {
      await saveFile(dataUrlToBlob(m.photoDataUrl), photoFileName(m.sentAt));
      showToast(tr('Saved'));
    } catch {
      showToast(tr('Could not save the photo'));
    }
  };

  const handleComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mid-word in an input method, Enter picks the word; it is not ours.
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    // The keyboard's own key sends, as its label says (enterKeyHint): a
    // second line there was a jump nobody asked for. Shift+Enter on a
    // keyboard attached still starts one.
    const send = e.ctrlKey || e.metaKey || !e.shiftKey;
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

  /** The message whose menu is open, and where it sits on screen. */
  const [menu, setMenu] = useState<{
    id: string;
    anchor: { top: number; bottom: number; left: number; right: number };
  } | null>(null);
  const menuRef = useRef(menu);
  menuRef.current = menu;
  /** The photo filling the screen. */
  const [viewerId, setViewerId] = useState<string | null>(null);
  /** The page of every photo and voice note in the chat is open. */
  const [mediaOpen, setMediaOpen] = useState(false);
  /** The header's ⋮ menu is open: where its button is on screen. */
  const [moreAt, setMoreAt] = useState<{ top: number; bottom: number; left: number; right: number } | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const openMore = () => {
    const r = moreButtonRef.current?.getBoundingClientRect();
    if (r) setMoreAt({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
  };
  // Closed without a choice (Back, Escape, a tap elsewhere): the keyboard goes back to ⋮.
  const closeMore = () => {
    setMoreAt(null);
    moreButtonRef.current?.focus({ preventScroll: true });
  };
  /** The message whose Info is open (MessageInfoSheet). */
  const [infoId, setInfoId] = useState<string | null>(null);
  // A call coming in must not sit under the menu's tap-catcher (z-80 over the
  // call's z-70), nor share its layer with a message's Info.
  useEffect(() => {
    if (callInProgress) {
      setMoreAt(null);
      setInfoId(null);
    }
  }, [callInProgress]);
  /**
   * A view-once photo being looked at. Its picture is held here, because the
   * conversation lets go of it the moment it is opened.
   */
  const [onceView, setOnceView] = useState<{ src: string; caption: string } | null>(null);
  const openViewOnce = (m: ChatMessage) => {
    if (!m.photoDataUrl || !canOpenViewOnce(m, activeUserRef.current)) return;
    setOnceView({
      src: m.photoDataUrl,
      caption: `${whoShown(m.authorId, activeUserRef.current, partnerName)}${m.sentAt ? ' · ' + timeOf(m.sentAt) : ''}`
    });
    onViewOnceOpened?.(m.id);
  };
  const openViewOnceRef = useRef(openViewOnce);
  openViewOnceRef.current = openViewOnce;
  /** A message just jumped to, lit for a moment so the eye finds it. */
  const [flashId, setFlashId] = useState<string | null>(null);

  /** Every message by id: a reply's quote looks up whether what it answers was since taken back. */
  const byId = useMemo(() => new Map(messages.map(m => [m.id, m])), [messages]);

  /**
   * The pinned messages still here, newest last, and which one the bar at the
   * top shows: the newest first, then - each time the bar is tapped and the
   * conversation goes to it - the one before, round again after the oldest.
   */
  const pinList = useMemo(() => livePins(pins, byId), [pins, byId]);
  const pinnedBy = useMemo(() => new Map(pinList.map(p => [p.messageId, p])), [pinList]);
  const [pinStep, setPinStep] = useState(0);
  const shownPin = pinList.length ? pinList[pinList.length - 1 - (pinStep % pinList.length)] : null;

  const openMenu = (id: string, bubble: HTMLElement) => {
    const m = latestMessagesRef.current.find(x => x.id === id);
    if (!m || m.unsent) return;
    const r = bubble.getBoundingClientRect();
    setMenu({ id, anchor: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } });
    haptic('tick');
  };

  /**
   * A finger on a message. Held still, it opens the message's menu; drawn to
   * the right, it answers the message (core/useMessageGestures, the same in a
   * group's chat).
   */
  const gestures = useMessageGestures({
    onLongPress: (id, bubble) => openMenuRef.current(id, bubble),
    onSwipeReply: id => answerRef.current(id),
    menuOpen: () => !!menuRef.current
  });
  const { pressStart, pressMove, pressEnd, pressContextMenu } = gestures;

  /**
   * Brings a message into view - drawing further back first when it is older
   * than what is drawn - and, from a quote, lights it up for a moment. False
   * when it is not on this phone.
   */
  const pendingJumpRef = useRef<{ id: string; flash: boolean } | null>(null);
  const scrollToMessage = (id: string, flash: boolean) => {
    const log = messagesRef.current;
    const el = log?.querySelector<HTMLElement>(`[data-mid="${CSS.escape(id)}"]`);
    if (!log || !el) return;
    pinnedRef.current = false;
    log.scrollTop += el.getBoundingClientRect().top - log.getBoundingClientRect().top - log.clientHeight / 3;
    if (flash) {
      setFlashId(id);
      window.setTimeout(() => setFlashId(current => (current === id ? null : current)), 1500);
    }
  };
  const jumpTo = (id: string, flash: boolean): boolean => {
    const index = rows.findIndex(r => r.msg.id === id);
    if (index < 0) return false;
    if (index < drawnFrom) {
      pendingJumpRef.current = { id, flash };
      setFirstDrawn(Math.max(0, index - 20));
    } else {
      scrollToMessage(id, flash);
    }
    return true;
  };
  // Drawn further back for a jump: now it is there to go to.
  useLayoutEffect(() => {
    const jump = pendingJumpRef.current;
    if (!jump) return;
    pendingJumpRef.current = null;
    scrollToMessage(jump.id, jump.flash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawnFrom]);

  /** Searching the conversation: the words, which match is in view, and the matches oldest first. */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const matches = useMemo(
    () => (searchOpen ? searchMatches(messages, searchQuery) : []),
    [messages, searchQuery, searchOpen]
  );
  const matchSet = useMemo(() => new Set(matches), [matches]);
  const [matchIndex, setMatchIndex] = useState(-1);
  // New words start at the newest match, the way a messenger's search does -
  // and only new words: messages arriving mid-search do not move it.
  const matchCount = matches.length;
  useEffect(() => {
    setMatchIndex(matchCount ? matchCount - 1 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchOpen]);
  const currentMatch = matchIndex >= 0 && matchIndex < matchCount ? matches[matchIndex] : null;
  useEffect(() => {
    if (currentMatch) jumpToRef.current(currentMatch, false);
  }, [currentMatch]);
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };
  useBackLayer(searchOpen, closeSearch);
  const highlight = searchOpen ? searchQuery.trim() : '';

  // Read through refs inside the laid-out conversation, which is not built
  // again for each of these changing.
  const openMenuRef = useRef(openMenu);
  openMenuRef.current = openMenu;
  const answerRef = useRef(answer);
  answerRef.current = answer;
  const jumpToRef = useRef(jumpTo);
  jumpToRef.current = jumpTo;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  /** Where her dots go (shown, below the bubbles). */
  const typingAt = useMemo(() => {
    let i = drawnRows.length;
    while (i > 0 && drawnRows[i - 1].msg.authorId === activeUser && isWaiting(drawnRows[i - 1].msg, activeUser)) i--;
    return i;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawnRows, activeUser, waitClock]);
  // One of yours set to show later today, the first of today, carries the
  // "Today" line. With her dots above it the dots draw that line over
  // themselves, so it is left off this one: two "Today" lines otherwise, and
  // the chat jumps by one when her message lands and takes the line.
  const underDots = partnerTyping ? drawnRows[typingAt] : undefined;
  const dayTakenBy =
    underDots?.divider && underDots.msg.sentAt && startOfDay(underDots.msg.sentAt) === startOfDay(Date.now())
      ? underDots.msg.id
      : undefined;

  /**
   * The bubbles themselves.
   *
   * Built only when the conversation or how it is shown changes - not on each
   * keystroke in the composer, which used to redraw every message ever kept.
   */
  const conversation = useMemo(
    () =>
      drawnRows.map((row, i) => {
        const { msg, firstOfRun, lastOfRun } = row;
        const divider = msg.id === dayTakenBy ? undefined : row.divider;
        const mine = msg.authorId === activeUser;
        // Left this phone: the relay said so, or her phone did. One with no
        // `delivered` at all is from before it was kept, and left long ago.
        const left = msg.delivered !== false || !!msg.reached;
        // Read only once it has left, and by a receipt heard here since: her
        // watermark is this phone's clock, and a message still waiting here,
        // or in your other phone's outbox, can fall under it.
        const read = readByPartner(msg, partnerReadAt, partnerReadHeardAt);
        // Whether it ever left is not a read receipt, so the clock and its
        // retry stay even with receipts switched off - otherwise a message
        // that never went would sit there looking sent.
        const stuck = mine && !left;
        const unsent = !!msg.unsent;
        // Yours, set to show later and not yet shown (core/sendLater).
        const waiting = mine && isWaiting(msg, activeUser);
        const edited = !!msg.editedAt && !unsent;
        const pin = unsent ? undefined : pinnedBy.get(msg.id);
        const showMeta = lastOfRun || stuck || edited || !!pin || waiting;
        const reactions = unsent || !msg.reactions ? [] : (Object.values(msg.reactions).filter(Boolean) as string[]);
        const quote = unsent ? undefined : msg.replyTo;
        // A view-once photo shows as a mark you open, never as its picture.
        const once = !unsent && !!msg.viewOnce;
        const opened = once && !!msg.viewedAt;
        const photo = !unsent && !once && msg.isPhoto && msg.photoDataUrl ? photoSize(msg) : null;

        // One rounded shape per run: the corners on the sender's side tuck in
        // where bubbles meet, and the last one keeps a small tail.
        const shape = mine
          ? `rounded-br-md ${firstOfRun ? '' : 'rounded-tr-md'}`
          : `rounded-bl-md ${firstOfRun ? '' : 'rounded-tl-md'}`;
        const spacing = divider ? 'mt-1' : !firstOfRun ? 'mt-1' : i === 0 ? '' : 'mt-4';

        const before = (
          <>
            {divider && (
              <div data-divider className="flex justify-center pt-4 pb-1 first:pt-0">
                <span className="rounded-full bg-linen-variant px-3 py-0.5 text-[11px] font-medium text-linen-secondary">
                  {divider}
                </span>
              </div>
            )}
            {msg.id === newMarkId && (
              <div data-new-mark role="separator" aria-label={tr('New messages')} className="flex items-center gap-3 pt-4 pb-1">
                <span className="h-px flex-1 bg-linen-accent/40" />
                <span className="text-[11px] font-semibold text-linen-accent">{tr('New messages')}</span>
                <span className="h-px flex-1 bg-linen-accent/40" />
              </div>
            )}
          </>
        );

        // A call: one quiet line in the middle, with a way to ring back.
        if (msg.call) {
          const call = msg.call;
          const words = callWords(call, activeUser, partnerName);
          const theyRang = call.caller !== activeUser;
          const missed = theyRang && (call.outcome === 'missed' || call.outcome === 'busy');
          const CallIcon = missed ? PhoneMissed : theyRang ? PhoneIncoming : PhoneOutgoing;
          return (
            <React.Fragment key={msg.id}>
              {before}
              <div data-mid={msg.id} data-day={row.day || undefined} data-call-line className={`flex justify-center ${divider ? 'mt-1' : 'mt-3'}`}>
                <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-2xl border border-linen-border bg-linen-surface/80 px-3 py-1.5 text-xs text-linen-secondary">
                  <CallIcon aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${missed ? 'text-rose-500' : 'text-linen-accent'}`} />
                  <span className={`font-medium ${missed ? 'text-rose-500' : 'text-linen-primary'}`}>{words.title}</span>
                  {words.detail && <span>· {words.detail}</span>}
                  {row.time && <span className="tabular-nums">· {row.time}</span>}
                  {onStartCall && (
                    <button
                      type="button"
                      onClick={() => startCallRef.current?.()}
                      disabled={callInProgress}
                      className="ml-1 rounded-full px-2 py-0.5 font-semibold text-linen-accent transition-colors hover:bg-linen-variant disabled:opacity-40"
                    >
                      {theyRang ? tr('Call back') : tr('Call again')}
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={msg.id}>
            {before}

            <div
              data-mid={msg.id}
              data-day={row.day || undefined}
              className={`relative flex flex-col ${mine ? 'items-end' : 'items-start'} ${spacing}`}
            >
              {/* Comes into view as the message is drawn to the right to answer it. */}
              {!unsent && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-1/2 -translate-x-8 -translate-y-1/2 text-linen-secondary"
                  style={{ opacity: 'var(--pull, 0)' }}
                >
                  <CornerUpLeft className="w-5 h-5" />
                </span>
              )}
              <div
                data-bubble
                // A long press opens the message's menu and a pull to the right
                // answers it; up and down stays the conversation's scroll.
                onPointerDown={unsent ? undefined : e => pressStart(e, msg.id)}
                onPointerMove={unsent ? undefined : pressMove}
                onPointerUp={unsent ? undefined : pressEnd}
                onPointerCancel={unsent ? undefined : pressEnd}
                onContextMenu={unsent ? undefined : e => pressContextMenu(e, msg.id)}
                onClickCapture={gestures.swallowClick}
                className={`touch-pan-y sm:max-w-md rounded-2xl ${
                  // A little tighter around a player, which has its own
                  // breathing room, than around words - and a little more of
                  // the width, so its 200px fits a 320px phone. A photo gets a
                  // thin frame of the bubble's own colour.
                  photo ? 'p-1' : msg.isVoiceMemo ? 'max-w-[90%] px-3 py-2' : once ? 'max-w-[85%] py-2 pl-2.5 pr-4' : 'max-w-[85%] px-4 py-2.5'
                } text-sm leading-relaxed ${shape} ${
                  // Plain on both sides (index.css): yours grey, theirs outlined.
                  // A request looks like any other message from its side.
                  unsent || opened
                    ? 'bubble-edge border border-dashed text-linen-secondary'
                    : mine
                    ? 'bubble-mine text-linen-primary'
                    : 'bubble-edge border text-linen-primary'
                } ${
                  // Dimmed until it shows, but its words still hold 4.5:1 on the grey.
                  waiting ? 'opacity-65' : ''
                } ${flashId === msg.id ? 'message-flash' : ''} ${currentMatch === msg.id ? 'ring-2 ring-amber-400' : ''}`}
              >
                {unsent ? (
                  <p className="flex items-center gap-1.5 italic">
                    <Undo2 className="w-3.5 h-3.5 shrink-0" />
                    {mine ? tr('You unsent a message') : tr('{name} unsent a message', { name: partnerName })}
                  </p>
                ) : (
                <>
                {msg.isNeedCard && (
                  <div className="text-[11px] font-semibold tracking-wider text-linen-secondary uppercase mb-1 flex items-center">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {tr('A request')}
                  </div>
                )}

                {quote && (
                  // What this answers. Tapped, the conversation goes back to it.
                  <ReplyQuote
                    who={whoShown(quote.authorId, activeUser, partnerName)}
                    text={
                      byId.get(quote.id)?.unsent
                        ? tr('Message unsent')
                        : deletedForMe?.[quote.id]
                        ? tr('You deleted this message')
                        : snippetShown(quote.snippet)
                    }
                    onJump={() => {
                      if (deletedForMe?.[quote.id]) showToastRef.current(tr('You deleted this message'));
                      else if (!jumpToRef.current(quote.id, true)) showToastRef.current(tr('That message is no longer on this phone'));
                    }}
                    maxWidth={photo ? photo.width : undefined}
                  />
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
                ) : once ? (
                  // Sent to you and not yet opened, it opens once, here. Your
                  // own says whether it has been - its picture is not kept.
                  <ViewOnceMark
                    mine={mine}
                    opened={opened}
                    canOpen={!mine && canOpenViewOnce(msg, activeUser)}
                    onOpen={() => openViewOnceRef.current(msg)}
                  />
                ) : photo ? (
                  // Its own shape at a size that fits the conversation; tapped,
                  // it has the whole screen.
                  <button
                    type="button"
                    onClick={() => setViewerId(msg.id)}
                    aria-label={tr('Open photo')}
                    className="block overflow-hidden rounded-xl"
                  >
                    <img
                      src={msg.photoDataUrl}
                      alt={tr('Photo')}
                      width={photo.width}
                      height={photo.height}
                      decoding="async"
                      draggable={false}
                      className="block object-cover"
                      style={photo}
                    />
                  </button>
                ) : (
                  // Copied from the message's menu rather than selected: a
                  // long press here opens the menu, so it cannot also start
                  // selecting words.
                  <p className="whitespace-pre-wrap break-words">
                    {highlight && matchSet.has(msg.id)
                      ? highlightParts(msg.text, highlight).map((part, k) =>
                          part.match ? (
                            // Dark ink on amber whatever is behind it: light words on
                            // a pale mark could not be read at night.
                            <mark key={k} className="no-remap rounded bg-amber-300 px-0.5 text-[#1d1638]">
                              {part.text}
                            </mark>
                          ) : (
                            <React.Fragment key={k}>{part.text}</React.Fragment>
                          )
                        )
                      : linkParts(msg.text).map((part, k) =>
                          part.href ? (
                            // A plain link: the app hands it to the phone's own
                            // browser or dialer; on the website it opens beside
                            // Two rather than in its place. A long press or a
                            // pull to answer swallows the tap (onClickCapture).
                            // The bubble's own ink, told apart by its underline.
                            <a
                              key={k}
                              href={part.href}
                              {...(inApp ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                              className="underline underline-offset-2 decoration-current break-all"
                            >
                              {part.text}
                            </a>
                          ) : (
                            <React.Fragment key={k}>{part.text}</React.Fragment>
                          )
                        )}
                  </p>
                )}
                </>
                )}
              </div>

              {reactions.length > 0 && (
                // One from each of you, on the bubble's lower edge. Tapped, the
                // reactions come up to be changed.
                <ReactionPill
                  emojis={[...new Set(reactions)]}
                  // Both of you chose the same one: it shows once, with a 2.
                  count={reactions.length > 1 && new Set(reactions).size === 1 ? 2 : undefined}
                  onClick={e => {
                    const bubble = e.currentTarget.parentElement?.querySelector<HTMLElement>('[data-bubble]');
                    if (bubble) openMenuRef.current(msg.id, bubble);
                  }}
                  label={tr('Reactions: {emoji}', { emoji: reactions.join(' ') })}
                  mine={mine}
                />
              )}

              {showMeta && (
                <span className="text-[10px] text-linen-secondary mt-1 px-1 inline-flex items-center">
                  {pin && (
                    <span className="mr-1.5 inline-flex items-center gap-0.5 font-medium text-linen-accent">
                      <Pin className="w-3 h-3" />
                      {tr('Pinned')}
                    </span>
                  )}
                  {/* The name once per run, under its last bubble with the time. */}
                  {lastOfRun && (
                    <span>
                      {whoShown(msg.authorId, activeUser, partnerName)}
                      {row.time && !waiting && <> &middot; {row.time}</>}
                    </span>
                  )}
                  {waiting && (
                    <span className={`inline-flex items-center gap-1 font-medium text-linen-accent ${lastOfRun ? 'ml-1.5' : ''}`}>
                      <AlarmClock className="w-3 h-3" />
                      {tr('Shows {when}', { when: aheadLabel(msg.showAt!) })}
                    </span>
                  )}
                  {/* Changed after it was sent: said wherever it is, last of a run or not. */}
                  {edited && <span className={lastOfRun ? 'ml-1' : ''}>{lastOfRun ? <>&middot; {tr('edited')}</> : tr('edited')}</span>}
                  {mine && !unsent && (
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
                            aria-label={tr('Still sending')}
                            aria-expanded={stuckOpen === msg.id}
                            className="rounded p-0.5 text-linen-secondary/60 hover:text-linen-primary transition-colors cursor-pointer"
                          >
                            <Clock className="w-3 h-3" />
                          </button>
                          <span className="sr-only">{tr('Sending')}</span>
                        </>
                      ) : waiting ? null : read && shareReceipts ? (
                        // Blue only while you share read receipts yourself. The
                        // grey ticks say where it is, not whether it was read,
                        // so they show either way.
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-sky-600" />
                          <span className="sr-only">{tr('Read')}</span>
                        </>
                      ) : msg.reached ? (
                        // On one of her devices, as it said (CHAT_DELIVERED).
                        // Not inferred from her reading it: with receipts off
                        // that would be a read receipt in grey.
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-linen-secondary/70" />
                          <span className="sr-only">{tr('Delivered')}</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-linen-secondary/70" />
                          <span className="sr-only">{tr('Sent')}</span>
                        </>
                      )}
                    </span>
                  )}
                </span>
              )}

              {pin && (
                // Who pinned it, in a quiet line under it.
                <span className="mt-2 inline-flex items-center gap-1.5 self-center rounded-full bg-linen-variant/70 px-3 py-1 text-[11px] text-linen-secondary">
                  <Pin className="w-3 h-3" />
                  {pin.by === activeUser ? tr('You pinned this') : tr('{name} pinned this', { name: partnerName })}
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
                    <RotateCw className="w-3 h-3" /> {tr('Send again')}
                  </button>
                  <button
                    onClick={() => {
                      setStuckOpen(null);
                      resolveStuckRef.current?.(msg.id, 'delete');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-linen-border bg-linen-surface px-2 py-1 text-[10px] font-medium text-linen-secondary hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> {tr('Discard')}
                  </button>
                </span>
              )}
            </div>
          </React.Fragment>
        );
      }),
    // The press handlers are left out on purpose: they act only through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawnRows, activeUser, partnerReadAt, partnerReadHeardAt, shareReceipts, stuckOpen, partnerName, canResolveStuck, autoPlay,
      byId, highlight, matchSet, currentMatch, flashId, pinnedBy, callInProgress, newMarkId, waitClock, lang, dayTakenBy,
      deletedForMe]
  );

  /**
   * Her dots: a bubble of hers, three dots in it, where her next message will
   * land - after the last one shown, but before yours still waiting to show.
   * Shaped like a one-line message of hers with its name line, so when it
   * comes it takes the dots' place without moving anything.
   */
  let shown: React.ReactNode[] = conversation;
  if (partnerTyping) {
    const before = drawnRows[typingAt - 1]?.msg;
    const now = Date.now();
    // Joins her run as her message would (layOut's rule).
    const joins =
      !!before &&
      !before.call &&
      before.authorId !== activeUser &&
      !!before.sentAt &&
      startOfDay(before.sentAt) === startOfDay(now) &&
      now - before.sentAt < RUN_GAP_MS;
    // The first of a new day: her message will come under "Today", so the
    // dots come under it too, or the chat jumps by the line as it lands.
    // The day it follows is the last one with a day of its own, as layOut
    // counts it - looked for in all of them, not just the ones drawn.
    let lastDay: number | null = null;
    for (let j = drawnFrom + typingAt - 1; j >= 0 && lastDay === null; j--) {
      const at = rows[j].msg.sentAt;
      if (at && Number.isFinite(at)) lastDay = startOfDay(at);
    }
    const newDay = lastDay !== startOfDay(now);
    const dots = (
      <div
        key="typing"
        data-typing
        aria-hidden="true"
        className={`flex flex-col items-start ${joins || newDay ? 'mt-1' : typingAt === 0 ? '' : 'mt-4'}`}
      >
        <div className={`typing-in rounded-2xl rounded-bl-md ${joins ? 'rounded-tl-md' : ''} bubble-edge border px-4 py-2.5 text-sm leading-relaxed`}>
          <span className="typing-dots h-[1.625em] text-linen-secondary">
            <span />
            <span />
            <span />
          </span>
        </div>
        {/* As tall as her name and time under the message that replaces it.
            Joining her run there is none: the bubble above gives its own up
            to the message, so the height comes out the same either way. */}
        {!joins && <span className="invisible mt-1 px-1 text-[10px]">&nbsp;</span>}
      </div>
    );
    // The same line layOut's rows draw (conversation, above), so the two are the same height.
    // When the row under the dots had it, that row's is left off (dayTakenBy).
    const day = newDay && (
      <div key="typing-day" data-divider aria-hidden="true" className="flex justify-center pt-4 pb-1 first:pt-0">
        <span className="rounded-full bg-linen-variant px-3 py-0.5 text-[11px] font-medium text-linen-secondary">
          {dayLabel(startOfDay(now), now)}
        </span>
      </div>
    );
    // One keyed list, so nothing already drawn is drawn again as the dots come and go.
    shown = [...conversation.slice(0, typingAt), ...(day ? [day] : []), dots, ...conversation.slice(typingAt)];
  }
  // At the end when they came: brought into view. Reading further up: left alone.
  useLayoutEffect(() => {
    const log = messagesRef.current;
    if (log && pinnedRef.current) log.scrollTop = log.scrollHeight;
  }, [partnerTyping]);

  /** What can be done with the message whose menu is open. */
  const menuMessage = menu ? byId.get(menu.id) : undefined;
  const menuActions: MessageMenuAction[] = [];
  // One of yours still waiting to show can be copied, or not sent after all.
  const menuWaiting = !!menuMessage && isWaiting(menuMessage, activeUser);
  if (menuMessage && !menuMessage.unsent) {
    const m = menuMessage;
    const close = () => setMenu(null);
    if (!menuWaiting) {
      menuActions.push({ key: 'reply', label: tr('Reply'), icon: CornerUpLeft, onSelect: () => { close(); answer(m.id); } });
    }
    if (!m.isVoiceMemo && !m.isPhoto && m.text) {
      menuActions.push({
        key: 'copy',
        label: tr('Copy'),
        icon: Copy,
        onSelect: () => {
          close();
          void copyText(m.text).then(ok => showToast(ok ? tr('Copied') : tr('Could not copy')));
        }
      });
    }
    if (onPinMessage && canPin(m) && !menuWaiting) {
      const pinned = pinnedBy.has(m.id);
      menuActions.push({
        key: 'pin',
        label: pinned ? tr('Unpin') : tr('Pin'),
        icon: pinned ? PinOff : Pin,
        onSelect: () => {
          close();
          onPinMessage(m.id, !pinned);
          if (!pinned) setPinStep(0);
          showToast(pinned ? tr('Unpinned') : pinList.length >= MAX_PINS ? tr('Pinned - the oldest pin made room') : tr('Pinned'));
        }
      });
    }
    if (m.isPhoto && m.photoDataUrl && !m.viewOnce) {
      menuActions.push({ key: 'save', label: tr('Save to phone'), icon: Download, onSelect: () => { close(); void savePhoto(m); } });
    }
    if (onEditMessage && canEdit(m, activeUser)) {
      menuActions.push({ key: 'edit', label: tr('Edit'), icon: Pencil, onSelect: () => { close(); startEdit(m); } });
    }
    // When it went, reached her and was read. Not for one still waiting to
    // show: it has not gone anywhere yet.
    if (!menuWaiting) {
      menuActions.push({ key: 'info', label: tr('Info'), icon: Info, onSelect: () => { close(); setInfoId(m.id); } });
    }
    if (onUnsendMessage && canUnsend(m, activeUser)) {
      menuActions.push({
        key: 'unsend',
        label: menuWaiting ? tr("Don't send") : tr('Unsend'),
        icon: menuWaiting ? X : Undo2,
        danger: true,
        onSelect: () => { close(); onUnsendMessage(m.id); }
      });
    }
    // From this phone only, hers or yours: Unsend is the way off both.
    if (onDeleteForMe && canDeleteForMe(m, activeUser)) {
      menuActions.push({
        key: 'delete-me',
        label: tr('Delete for me'),
        icon: Trash2,
        danger: true,
        onSelect: () => { close(); onDeleteForMe(m.id); }
      });
    }
  }
  /** The message whose Info is open - gone with it, if it is deleted or taken back meanwhile. */
  const infoMessage = infoId ? byId.get(infoId) : undefined;
  /** The photo filling the screen - gone if it was taken back meanwhile. */
  const viewed = viewerId ? byId.get(viewerId) : undefined;
  const viewerMessage = viewed && viewed.isPhoto && viewed.photoDataUrl && !viewed.unsent && !viewed.viewOnce ? viewed : undefined;
  // Every photo in the chat, oldest first: the viewer turns through them.
  // From the photos page the newest come first, so there "next" is older.
  const photoIds = useMemo(() => messages.filter(isGalleryPhoto).map(m => m.id), [messages]);
  const viewerIndex = viewerMessage ? photoIds.indexOf(viewerMessage.id) : -1;
  const step = mediaOpen ? -1 : 1;
  const nextId = viewerIndex >= 0 ? photoIds[viewerIndex + step] : undefined;
  const prevId = viewerIndex >= 0 ? photoIds[viewerIndex - step] : undefined;
  const showInChat = (id: string) => {
    setViewerId(null);
    setMediaOpen(false);
    // After the page has closed, so the conversation is there to scroll.
    requestAnimationFrame(() => {
      if (!jumpToRef.current(id, true)) showToastRef.current(tr('That message is no longer on this phone'));
    });
  };

  // The header's ⋮: what used to be four buttons in a row beside her name,
  // which left her status no room. Choosing closes the menu in the same
  // update, so its Back is gone before the page it opens adds its own.
  const chooseMore = (go: () => void) => () => {
    setMoreAt(null);
    go();
  };
  const moreActions: MessageMenuAction[] = [
    { key: 'media', label: tr('Photos and voice notes'), icon: ImageIcon, onSelect: chooseMore(() => setMediaOpen(true)) },
    { key: 'search', label: tr('Search this chat'), icon: Search, onSelect: chooseMore(() => setSearchOpen(true)) },
    // In the app the bar is not above the chat, so its Heart is here, and
    // Tools' Quick Exit too: hiding Two cannot be four taps away from the one
    // screen it is most needed on. Neither marked as danger, as nothing is
    // deleted. Breather is under the dock's Soft Landing, and Ask for what you
    // need is in Tools.
    ...(onOpenHeart ? [{ key: 'heart', label: tr('Heart'), icon: Heart, onSelect: chooseMore(onOpenHeart) }] : []),
    ...(onQuickExit ? [{ key: 'quick-exit', label: tr('Quick exit'), icon: EyeOff, onSelect: chooseMore(onQuickExit) }] : [])
  ];
  const presence = presenceLine({ relayStatus, typing: partnerTyping, online: partnerOnline, lastSeen: lastSeenLabel });

  return (
    <div
      className={`relative flex flex-col chat-shell bg-linen-surface overflow-hidden ${
        // Flush, the header is the top of the screen and the panel its width,
        // as a messenger has it; a card everywhere else.
        flush ? 'chat-flush border-b border-linen-border' : 'rounded-2xl border border-linen-border shadow-sm'
      }`}
    >
      {/* Header */}
      <div
        // In the app the WebView already starts below the status bar, so the
        // inset is 0 there and this is the py-1.5 below; a browser that
        // reports one keeps the header clear of it.
        style={flush ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.375rem)' } : undefined}
        className={`min-h-[56px] py-1.5 border-b border-linen-border bg-linen-variant/40 flex items-center justify-between gap-2 ${
          searchOpen ? 'px-4' : 'pl-4 pr-1.5'
        }`}
      >
        {searchOpen ? (
          // Searching: the words, which match is in view, and the way to the
          // earlier and later ones. Enter goes further back, as the first
          // match shown is the newest.
          <div className="flex w-full min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={closeSearch}
              aria-label={tr('Close search')}
              className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-linen-secondary hover:bg-linen-variant hover:text-linen-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <input
              autoFocus
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                e.preventDefault();
                setMatchIndex(i => Math.max(0, i - 1));
              }}
              enterKeyHint="search"
              aria-label={tr('Search this chat')}
              placeholder={tr('Search this chat')}
              className="min-w-0 flex-1 rounded-lg border border-linen-border bg-linen-surface px-3 py-1.5 text-sm text-linen-primary placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary select-text"
            />
            <span className="shrink-0 px-1 text-xs tabular-nums text-linen-secondary" aria-live="polite">
              {matchCount ? `${matchIndex + 1}/${matchCount}` : searchQuery.trim() ? tr('None') : ''}
            </span>
            <button
              type="button"
              onClick={() => setMatchIndex(i => Math.max(0, i - 1))}
              disabled={matchIndex <= 0}
              aria-label={tr('Earlier match')}
              className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-linen-primary hover:bg-linen-variant disabled:opacity-30 transition-colors"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setMatchIndex(i => Math.min(matchCount - 1, i + 1))}
              disabled={matchIndex < 0 || matchIndex >= matchCount - 1}
              aria-label={tr('Later match')}
              className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-linen-primary hover:bg-linen-variant disabled:opacity-30 transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-base font-medium text-linen-primary truncate">
              {partnerName}
            </h3>
            {/* Her status, whole and one fact at a time (core/presenceLine).
                A second line rather than an ellipsis: "last seen yesterday at
                11:45 pm" in Tamil is wider than a narrow phone leaves beside
                two buttons. Cut only past two lines. With nothing to say it is
                empty, and the name sits alone in the middle. No dot: a green
                one under her name read as "online" next to "last seen". */}
            <div
              data-chat-presence={presence.kind}
              className={`text-xs leading-4 line-clamp-2 ${
                presence.kind === 'connecting' || presence.kind === 'offline'
                  ? 'text-amber-700'
                  : presence.kind === 'typing'
                    ? 'font-medium text-linen-accent'
                    : presence.kind === 'online'
                      ? 'text-emerald-700'
                      : 'text-linen-secondary'
              }`}
            >
              {presence.text}
            </div>
          </div>
          {/* Two buttons, as a messenger has them: the call, and ⋮ for the rest. */}
          <div className="flex shrink-0 items-center">
            {/* Enabled whether or not they are online. A call to somebody who
                is away cannot connect, but it still leaves a missed call they
                will see - which is what calling a phone that is off does too. */}
            {onStartCall && (
              <button
                type="button"
                onClick={onStartCall}
                disabled={callInProgress}
                aria-label={tr('Call {name}', { name: partnerName })}
                title={tr('Call {name}', { name: partnerName })}
                className="h-11 w-11 rounded-full flex items-center justify-center text-linen-primary hover:bg-linen-variant active:scale-95 disabled:opacity-40 transition cursor-pointer"
              >
                <Phone className="w-5 h-5" />
              </button>
            )}
            <button
              ref={moreButtonRef}
              type="button"
              onClick={openMore}
              aria-label={tr('More options')}
              title={tr('More options')}
              aria-haspopup="menu"
              aria-expanded={!!moreAt}
              aria-controls={moreAt ? 'chat-more-menu' : undefined}
              className="h-11 w-11 rounded-full flex items-center justify-center text-linen-primary hover:bg-linen-variant active:scale-95 transition cursor-pointer"
            >
              <EllipsisVertical className="w-5 h-5" />
            </button>
          </div>
                </>
        )}
</div>

      {/* Where they are, in their words (core/status): a line of its own
          under the header while it lasts. The line beside their name has no
          room for it next to the buttons. */}
      {theirStatus && !searchOpen && (
        <div
          role="status"
          data-partner-status
          aria-label={tr('{name}: {status}, since {time}', {
            name: partnerName,
            status: statusWords(theirStatus),
            time: clockTime(theirStatus.setAt)
          })}
          className="flex items-center gap-2 border-b border-linen-border bg-linen-variant/20 px-4 py-1.5 text-xs text-linen-secondary"
        >
          <span aria-hidden="true">{theirStatus.emoji || '💬'}</span>
          <span className="min-w-0 truncate font-medium text-linen-primary">{tr(theirStatus.text)}</span>
          <span className="shrink-0">&middot; {tr('since {time}', { time: clockTime(theirStatus.setAt) })}</span>
        </div>
      )}

      {/* The pinned message on show; tapped, the conversation goes to it and
          the bar moves on to the one pinned before it. */}
      {shownPin && !searchOpen && (
        <button
          type="button"
          onClick={() => {
            if (!jumpTo(shownPin.messageId, true)) showToast(tr('That message is no longer on this phone'));
            setPinStep(step => step + 1);
          }}
          className="relative z-[1] flex w-full items-center gap-2.5 border-b border-linen-border bg-linen-surface/95 px-4 py-2 text-left shadow-[0_4px_12px_-8px_rgba(0,0,0,0.18)]"
        >
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-aurora-violet/12 text-aurora-violet">
            <Pin className="w-4 h-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2 text-[11px] font-semibold text-linen-accent">
              {tr('Pinned message')}
              {pinList.length > 1 && (
                <span className="font-medium tabular-nums text-linen-secondary">
                  {tr('{n} of {total}', { n: (pinStep % pinList.length) + 1, total: pinList.length })}
                </span>
              )}
            </span>
            <span className="block truncate text-[13px] text-linen-primary">
              {(() => {
                const m = byId.get(shownPin.messageId);
                return snippetShown(m ? snippetOf(m) : undefined);
              })()}
            </span>
          </span>
        </button>
      )}

      {/* Said once when she starts writing; the dots themselves are hidden from it. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {partnerTyping ? tr('{name} is typing…', { name: partnerName }) : ''}
      </p>

      {/* Message List */}
      <div
        ref={messagesRef}
        onScroll={handleLogScroll}
        {...floatingDay.inputHandlers}
        // Sideways hidden: a message drawn to the right to answer it must not
        // make the conversation scroll sideways under the finger.
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-contain p-4 sm:p-6"
      >
        <FloatingDayChip label={floatingDay.label} shown={floatingDay.shown} />
        <div ref={contentRef}>
          {/* Said once the device is full rather than never. The oldest fall off
              to keep the vault inside what a browser will store, which is a fine
              thing to do and a poor thing to do silently. */}
          {messages.length >= MAX_CHAT_MESSAGES && (
            <p className="pb-4 text-center text-[10px] leading-relaxed text-linen-secondary">
              {tr('Only the most recent {n} messages are kept on this device. Older ones are gone from here — a backup keeps them.', {
                n: MAX_CHAT_MESSAGES.toLocaleString()
              })}
            </p>
          )}

          {shown}
          <div ref={messagesEndRef} />
        </div>
        {/* Held at the bottom of the view while you read further up, with no
            height of its own, so it never moves the conversation. */}
        {awayFromEnd && <JumpToNewestButton onClick={goToNewest} />}
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
            onPick={char => {
              setInputText(t => t + char);
              if (!editing) typing.keystroke();
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}

      {/* What the next message answers, or which message is being changed -
          with the way out of either. */}
      {(replyTo || editing) && (
        <ComposeBanner
          mode={editing ? 'edit' : 'reply'}
          title={
            editing
              ? tr('Editing your message')
              : replyTo!.authorId === activeUser
              ? tr('Replying to yourself')
              : tr('Replying to {name}', { name: partnerName })
          }
          snippet={editing ? editing.original : snippetShown(replyTo!.snippet)}
          cancelLabel={editing ? tr('Stop editing') : tr('Cancel reply')}
          keepFocus={keepComposerFocus}
          onCancel={() => {
            cancelCompose();
            restoreComposerFocus();
          }}
        />
      )}

      {preparingPhotos > 0 && (
        <p className="mx-4 mt-2 text-[11px] text-linen-secondary" aria-live="polite">
          {preparingPhotos === 1 ? tr('Getting the photo ready…') : tr('Getting {n} photos ready…', { n: preparingPhotos })}
        </p>
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
              title={tr('Emoji')}
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* The photo button sits inside the text box while it is empty, so
                it takes none of the width the words need once there are some. */}
            <div className="relative flex-1 min-w-0">
              <textarea
                ref={inputRef}
                rows={1}
                value={inputText}
                onChange={(e) => {
                  const words = e.target.value;
                  setInputText(words);
                  // Changing an old message is not writing to her; an emptied box is not either.
                  if (editing) return;
                  if (words.trim()) typing.keystroke();
                  else typing.stop();
                }}
                // Left the box. A moment's grace: a tap on a button beside it is not leaving.
                onBlur={() => typing.stopSoon()}
                onKeyDown={handleComposerKey}
                enterKeyHint="send"
                autoCapitalize="sentences"
                aria-label={editing ? tr('New words for your message') : tr('Message to {name}', { name: partnerName })}
                // Short enough for one line on a small phone; whose chat this is
                // is already in the header right above.
                placeholder={tr('A quiet thought…')}
                className={`block w-full resize-none overflow-y-hidden px-4 py-2.5 text-sm leading-5 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary placeholder:text-linen-secondary/60 select-text ${
                  showPhotoButton ? (touchFirst ? 'pr-20' : 'pr-11') : showLaterButton ? 'pr-11' : ''
                }`}
              />
              {showPhotoButton && touchFirst && (
                // A phone's camera, straight from the chat. A computer has
                // none to speak of, and its button would only open files.
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  aria-label={tr('Take a photo')}
                  title={tr('Take a photo')}
                  className="absolute right-10 bottom-1 h-[34px] w-[34px] rounded-lg flex items-center justify-center text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
                >
                  <Camera className="w-5 h-5" />
                </button>
              )}
              {showPhotoButton && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label={tr('Send a photo')}
                  title={tr('Send a photo')}
                  className="absolute right-1 bottom-1 h-[34px] w-[34px] rounded-lg flex items-center justify-center text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
              )}
              {showLaterButton && (
                <button
                  type="button"
                  onClick={() => setLaterOpen(true)}
                  aria-label={tr('Send later')}
                  title={tr('Send later')}
                  className="absolute right-1 bottom-1 h-[34px] w-[34px] rounded-lg flex items-center justify-center text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
                >
                  <AlarmClock className="w-5 h-5" />
                </button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={e => {
                  pickPhotos(e.target.files);
                  // So the same photo can be picked again.
                  e.target.value = '';
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={e => {
                  pickPhotos(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

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
                aria-label={tr('Send')}
                className="h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-xl bg-linen-primary text-linen-surface hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
      </div>

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4" aria-live="polite">
          <span className="rounded-full bg-linen-primary text-linen-surface px-3.5 py-1.5 text-xs font-medium shadow-lg">
            {toast}
          </span>
        </div>
      )}

      {menu && menuMessage && !menuMessage.unsent && (
        <MessageMenu
          anchor={menu.anchor}
          side={menuMessage.authorId === activeUser ? 'right' : 'left'}
          reaction={onReact && !menuWaiting ? menuMessage.reactions?.[activeUser] || '' : null}
          onReact={emoji => {
            setMenu(null);
            onReact?.(menuMessage.id, emoji);
            haptic('confirm');
          }}
          actions={menuActions}
          onClose={() => setMenu(null)}
        />
      )}

      {/* Drawn from the message as it is now: a receipt arriving while it
          is open shows straight away. */}
      {infoMessage && !infoMessage.unsent && (
        <MessageInfoSheet
          preview={snippetShown(snippetOf(infoMessage))}
          {...coupleInfo(infoMessage, {
            me: activeUser,
            partnerName,
            partnerReadAt,
            partnerReadHeardAt,
            shareReceipts,
            partnerSaysDelivered
          })}
          onClose={() => setInfoId(null)}
        />
      )}

      {/* The header's ⋮ menu, under its button. Only while open: a message's
          menu is found on the page as the one [role=menu]. */}
      {moreAt && !searchOpen && (
        <MessageMenu
          id="chat-more-menu"
          label={tr('More options')}
          anchor={moreAt}
          side="right"
          below
          dim={false}
          autoFocus
          reaction={null}
          actions={moreActions}
          onClose={closeMore}
        />
      )}

      {laterOpen && (
        <SendLaterSheet
          text={inputText.trim()}
          partnerName={partnerName}
          onPick={sendLater}
          onClose={() => setLaterOpen(false)}
        />
      )}

      {pickedPhotos && (
        <PhotoSendSheet
          files={pickedPhotos}
          partnerName={partnerName}
          onClose={() => setPickedPhotos(null)}
          onSend={viewOnce => {
            const list = pickedPhotos;
            setPickedPhotos(null);
            void sendPhotos(list, viewOnce);
          }}
        />
      )}

      {onceView && (
        <PhotoViewer
          src={onceView.src}
          caption={onceView.caption}
          note={tr("View once. It's gone when you close it.")}
          onClose={() => setOnceView(null)}
        />
      )}

      {mediaOpen && (
        <ChatMediaSheet
          messages={messages}
          activeUser={activeUser}
          partnerName={partnerName}
          shareReceipts={shareReceipts}
          onClose={() => setMediaOpen(false)}
          onOpenPhoto={id => setViewerId(id)}
          onShowInChat={showInChat}
          onVoiceHeard={id => voiceHeardRef.current?.(id)}
        />
      )}

      {viewerMessage && (
        <PhotoViewer
          // A new photo starts unzoomed.
          key={viewerMessage.id}
          onPrev={prevId ? () => setViewerId(prevId) : undefined}
          onNext={nextId ? () => setViewerId(nextId) : undefined}
          position={
            photoIds.length > 1
              ? tr('{n} of {total}', { n: mediaOpen ? photoIds.length - viewerIndex : viewerIndex + 1, total: photoIds.length })
              : undefined
          }
          onShowInChat={mediaOpen ? () => showInChat(viewerMessage.id) : undefined}
          src={viewerMessage.photoDataUrl!}
          caption={`${whoShown(viewerMessage.authorId, activeUser, partnerName)}${
            viewerMessage.sentAt ? ' · ' + timeOf(viewerMessage.sentAt) : ''
          }`}
          onClose={() => setViewerId(null)}
          onSave={() => void savePhoto(viewerMessage)}
        />
      )}
    </div>
  );
};

/**
 * A view-once photo in the conversation: never its picture, only whether it
 * can still be opened. Yours says whether your partner has opened it.
 */
const ViewOnceMark: React.FC<{ mine: boolean; opened: boolean; canOpen: boolean; onOpen: () => void }> = ({
  mine,
  opened,
  canOpen,
  onOpen
}) => {
  const tr = useT();
  const title = opened ? tr('Opened') : tr('Photo');
  const detail = opened
    ? tr('View-once photo')
    : mine
    ? tr('Not opened yet')
    : canOpen
    ? tr('Tap to view once')
    : tr('View-once photo');
  const body = (
    <>
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          opened ? '' : 'bg-linen-primary/10 text-linen-primary'
        }`}
      >
        <ViewOnceIcon className="h-[22px] w-[22px]" />
      </span>
      <span className="flex flex-col text-left leading-tight">
        <span className="text-sm font-semibold">{title}</span>
        <span className={`text-[11px] ${opened ? '' : 'opacity-85'}`}>{detail}</span>
      </span>
    </>
  );
  return canOpen ? (
    <button type="button" onClick={onOpen} aria-label={tr('Open the view-once photo')} className="flex items-center gap-2.5">
      {body}
    </button>
  ) : (
    <span className="flex items-center gap-2.5">{body}</span>
  );
};
