import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ChatMessage, ChatPin, ChatReplyRef } from '../types';
import { NeedMenuModal } from '../components/NeedMenuModal';
import { VoiceNotePlayer } from '../components/VoiceNotePlayer';
import { VoiceMicButton, VoiceRecordingStrip, useVoiceRecorder } from '../components/VoiceRecorder';
import { MessageMenu, type MessageMenuAction } from '../components/MessageMenu';
import { PhotoViewer } from '../components/PhotoViewer';
import { PhotoSendSheet } from '../components/PhotoSendSheet';
import { ViewOnceIcon } from '../components/ViewOnceIcon';
import { voiceFieldsOf, voiceNoteLabel } from '../core/voice';
import {
  MAX_PINS,
  canEdit,
  canOpenViewOnce,
  canPin,
  canUnsend,
  highlightParts,
  livePins,
  replyRefFor,
  searchMatches,
  snippetOf,
  type MessageExtras
} from '../core/chatActions';
import { shrinkPhoto } from '../core/photo';
import { copyText } from '../core/clipboard';
import { saveFile } from '../core/saveFile';
import { useBackLayer } from '../core/backStack';
import { formatLastSeen, TYPING_REPEAT_MS } from '../core/lastSeen';
import { MAX_CHAT_MESSAGES } from '../core/storage';
import { who } from '../core/who';
import { haptic } from '../core/haptics';
import {
  Send, Sparkles, Feather, Check, CheckCheck, Clock, Smile, RotateCw, Trash2, Phone,
  Search, X, ChevronUp, ChevronDown, CornerUpLeft, Copy, Pencil, Undo2, Image as ImageIcon, Download,
  Camera, Pin, PinOff
} from 'lucide-react';
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

/** A press held this long without moving opens the message's menu. */
const LONG_PRESS_MS = 420;
/** A click this soon after a long press or a drag ended belongs to it, not to what is under the finger. */
const SWALLOW_MS = 800;
/** Dragged this far to the right, a message is answered when let go. */
const SWIPE_REPLY_PX = 56;
/** A photo is shrunk to fit one record with room to spare (core/photo). */
const PHOTO_MAX_CHARS = 600_000;
/** At most this many photos picked at once go. */
const PHOTOS_AT_ONCE = 10;
/** The largest a photo is shown in the conversation; tapped, it fills the screen. */
const PHOTO_MAX_W = 240;
const PHOTO_MAX_H = 300;

/** A photo's size in the conversation: its own shape, within PHOTO_MAX_W by PHOTO_MAX_H. */
function photoSize(m: ChatMessage): { width: number; height: number } {
  const w = m.photoWidth || 4;
  const h = m.photoHeight || 3;
  const s = Math.min(PHOTO_MAX_W / w, PHOTO_MAX_H / h);
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

/** A data: URL as the bytes it holds, for saving. */
function dataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(',');
  const type = /^data:([^;,]+)/.exec(url)?.[1] || 'application/octet-stream';
  const bytes = atob(url.slice(comma + 1));
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i);
  return new Blob([out], { type });
}

/** "two-photo-2026-10-14-2141.jpg" */
function photoFileName(at?: number): string {
  const d = new Date(at && Number.isFinite(at) ? at : Date.now());
  const two = (n: number) => String(n).padStart(2, '0');
  return `two-photo-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.jpg`;
}

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
  onVoiceHeard,
  onReact,
  onEditMessage,
  onUnsendMessage,
  pins,
  onPinMessage,
  onViewOnceOpened
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  /** The message being answered: shown above the composer, and sent with what is written next. */
  const [replyTo, setReplyTo] = useState<ChatReplyRef | null>(null);
  const replyToRef = useRef(replyTo);
  replyToRef.current = replyTo;
  /** One of your messages having its words changed, in the composer; what it said before. */
  const [editing, setEditing] = useState<{ id: string; original: string } | null>(null);

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
    },
    disabled: callInProgress,
    onActiveChange: active => {
      if (active) setShowEmojiPicker(false);
    }
  });
  const showMic = rec.supported && (!inputText.trim() || rec.active);
  /** Photos are offered while nothing is written - not mid-sentence, mid-edit, or mid-note. */
  const showPhotoButton = !inputText && !editing && !rec.active;
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

  // Where the drawn part of the conversation starts. Kept as an index from the
  // oldest message, so new messages add to the end without moving what you are
  // reading; never so late that fewer than DRAWN_AT_FIRST would show.
  const [firstDrawn, setFirstDrawn] = useState(() => Math.max(0, messages.length - DRAWN_AT_FIRST));
  const drawnFrom = Math.max(0, Math.min(firstDrawn, rows.length - DRAWN_AT_FIRST));
  const drawnRows = useMemo(() => rows.slice(drawnFrom), [rows, drawnFrom]);
  /** Set while earlier messages are being added above, to keep your place. */
  const growingRef = useRef<{ height: number; top: number } | null>(null);

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
    // Near the top with more behind it: draw the next part of the history.
    if (log.scrollTop < LOAD_EARLIER_PX && drawnFrom > 0 && !growingRef.current) {
      growingRef.current = { height: log.scrollHeight, top: log.scrollTop };
      setFirstDrawn(Math.max(0, drawnFrom - DRAWN_MORE));
    }
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
        showToast('Too late to change - messages can be edited for 15 minutes');
      } else if (text !== editing.original) {
        onEditMessage?.(editing.id, text);
      }
      setEditing(null);
    } else {
      onSendMessage(text, false, replyTo ? { replyTo } : undefined);
      setReplyTo(null);
    }
    setInputText('');
    haptic('confirm');
    restoreComposerFocus();
  };

  /** Answer a message: its quote goes above the composer, and the keyboard comes up. */
  const answer = (id: string) => {
    const m = messages.find(x => x.id === id);
    if (!m || m.unsent) return;
    if (editing) {
      setEditing(null);
      setInputText('');
    }
    setReplyTo(replyRefFor(m));
    inputRef.current?.focus();
  };

  /** Change one of your messages: its words go into the composer to be written over. */
  const startEdit = (m: ChatMessage) => {
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
    if (picked.length > PHOTOS_AT_ONCE) showToast(`Up to ${PHOTOS_AT_ONCE} photos at a time`);
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
        showToast('That file could not be opened as a photo');
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
      showToast('Saved');
    } catch {
      showToast('Could not save the photo');
    }
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

  /** The message whose menu is open, and where it sits on screen. */
  const [menu, setMenu] = useState<{
    id: string;
    anchor: { top: number; bottom: number; left: number; right: number };
  } | null>(null);
  const menuRef = useRef(menu);
  menuRef.current = menu;
  /** The photo filling the screen. */
  const [viewerId, setViewerId] = useState<string | null>(null);
  /**
   * A view-once photo being looked at. Its picture is held here, because the
   * conversation lets go of it the moment it is opened.
   */
  const [onceView, setOnceView] = useState<{ src: string; caption: string } | null>(null);
  const openViewOnce = (m: ChatMessage) => {
    if (!m.photoDataUrl || !canOpenViewOnce(m, activeUserRef.current)) return;
    setOnceView({
      src: m.photoDataUrl,
      caption: `${who(m.authorId, activeUserRef.current, partnerName)}${m.sentAt ? ' · ' + TIME_FORMAT.format(m.sentAt) : ''}`
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
   * the right, it answers the message. Followed in a ref, with the drag written
   * straight onto the message, so neither goes through a render of the
   * conversation. A drag that starts on a voice note's waveform is the
   * player's: that is how it is scrubbed.
   */
  const pressRef = useRef<{
    id: string;
    pointerId: number;
    x: number;
    y: number;
    timer: number;
    bubble: HTMLElement;
    row: HTMLElement;
    swiping: boolean;
    pull: number;
    armed: boolean;
  } | null>(null);
  /**
   * When a long press or a drag last ended, so the click that comes straight
   * after it does not also open a photo or follow a quote. A moment later it
   * no longer counts: a click from the keyboard is never eaten.
   */
  const swallowClickRef = useRef(0);

  const pressStart = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[role="slider"]')) return;
    const bubble = e.currentTarget;
    const row = bubble.parentElement;
    if (!row) return;
    swallowClickRef.current = 0;
    window.clearTimeout(pressRef.current?.timer);
    const timer = window.setTimeout(() => {
      const p = pressRef.current;
      if (!p || p.swiping) return;
      swallowClickRef.current = Date.now();
      pressRef.current = null;
      openMenuRef.current(p.id, p.bubble);
    }, LONG_PRESS_MS);
    pressRef.current = {
      id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, timer, bubble, row, swiping: false, pull: 0, armed: false
    };
  };

  const pressMove = (e: React.PointerEvent<HTMLElement>) => {
    const p = pressRef.current;
    if (!p || p.pointerId !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.swiping) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      window.clearTimeout(p.timer);
      // Up and down is scrolling; only a pull to the right answers.
      if (dx <= 0 || Math.abs(dx) < Math.abs(dy) * 1.5) {
        pressRef.current = null;
        return;
      }
      p.swiping = true;
      try {
        p.bubble.setPointerCapture(e.pointerId);
      } catch {
        /* the finger is already up */
      }
    }
    p.pull = Math.min(80, dx * 0.6);
    p.row.style.transition = 'none';
    p.row.style.transform = `translateX(${p.pull}px)`;
    p.row.style.setProperty('--pull', String(Math.min(1, p.pull / SWIPE_REPLY_PX)));
    if (p.pull >= SWIPE_REPLY_PX && !p.armed) {
      p.armed = true;
      haptic('tick');
    }
  };

  const pressEnd = (e: React.PointerEvent<HTMLElement>) => {
    const p = pressRef.current;
    if (!p || p.pointerId !== e.pointerId) return;
    window.clearTimeout(p.timer);
    pressRef.current = null;
    if (!p.swiping) return;
    swallowClickRef.current = Date.now();
    p.row.style.transition = 'transform 180ms ease-out';
    p.row.style.transform = '';
    p.row.style.setProperty('--pull', '0');
    if (p.pull >= SWIPE_REPLY_PX) answerRef.current(p.id);
  };

  /** A right click, or a phone's own long press: the same menu. */
  const pressContextMenu = (e: React.MouseEvent<HTMLElement>, id: string) => {
    e.preventDefault();
    if (menuRef.current) return;
    const p = pressRef.current;
    if (p) {
      window.clearTimeout(p.timer);
      pressRef.current = null;
    }
    swallowClickRef.current = Date.now();
    openMenuRef.current(id, e.currentTarget);
  };

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
        const mine = msg.authorId === activeUser;
        const read = !!msg.sentAt && partnerReadAt >= msg.sentAt;
        // Whether it ever left is not a read receipt, so the clock and its
        // retry stay even with receipts switched off - otherwise a message
        // that never went would sit there looking sent.
        const stuck = mine && !msg.delivered && !read;
        const unsent = !!msg.unsent;
        const edited = !!msg.editedAt && !unsent;
        const pin = unsent ? undefined : pinnedBy.get(msg.id);
        const showMeta = lastOfRun || stuck || edited || !!pin;
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

            <div data-mid={msg.id} className={`relative flex flex-col ${mine ? 'items-end' : 'items-start'} ${spacing}`}>
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
                onClickCapture={e => {
                  if (Date.now() - swallowClickRef.current > SWALLOW_MS) return;
                  swallowClickRef.current = 0;
                  e.stopPropagation();
                  e.preventDefault();
                }}
                className={`touch-pan-y sm:max-w-md rounded-2xl ${
                  // A little tighter around a player, which has its own
                  // breathing room, than around words - and a little more of
                  // the width, so its 200px fits a 320px phone. A photo gets a
                  // thin frame of the bubble's own colour.
                  photo ? 'p-1' : msg.isVoiceMemo ? 'max-w-[90%] px-3 py-2' : once ? 'max-w-[85%] py-2 pl-2.5 pr-4' : 'max-w-[85%] px-4 py-2.5'
                } text-sm leading-relaxed ${shape} ${
                  unsent || opened
                    ? 'border border-dashed border-linen-border text-linen-secondary'
                    : msg.isNeedCard
                    ? 'bg-amber-50 border border-amber-300/70 text-linen-primary'
                    : mine
                    ? 'bg-linen-primary text-linen-surface'
                    : 'bg-linen-variant text-linen-primary border border-linen-border'
                } ${flashId === msg.id ? 'message-flash' : ''} ${currentMatch === msg.id ? 'ring-2 ring-amber-400' : ''}`}
              >
                {unsent ? (
                  <p className="flex items-center gap-1.5 italic">
                    <Undo2 className="w-3.5 h-3.5 shrink-0" />
                    {mine ? 'You unsent a message' : `${partnerName} unsent a message`}
                  </p>
                ) : (
                <>
                {msg.isNeedCard && (
                  <div className="text-[11px] font-semibold tracking-wider text-amber-700 uppercase mb-1 flex items-center">
                    <Sparkles className="w-3 h-3 mr-1" />
                    A request
                  </div>
                )}

                {quote && (
                  // What this answers. Tapped, the conversation goes back to it.
                  <button
                    type="button"
                    onClick={() => {
                      if (!jumpToRef.current(quote.id, true)) showToastRef.current('That message is no longer on this phone');
                    }}
                    className={`mb-1.5 block w-full min-w-0 rounded-xl border-l-[3px] px-2.5 py-1.5 text-left text-xs ${
                      // On your own aurora bubble the quote is set back into it,
                      // darker, so its white words stay clear over the orange end.
                      mine ? 'no-remap border-white/70 bg-black/25' : 'border-linen-accent bg-linen-surface/70'
                    } ${photo ? 'mx-0' : ''}`}
                    style={photo ? { maxWidth: photo.width } : undefined}
                  >
                    <span className={`block font-semibold ${mine ? 'text-white' : 'text-linen-accent'}`}>
                      {who(quote.authorId, activeUser, partnerName)}
                    </span>
                    <span className={`block truncate ${mine ? 'text-white/90' : 'text-linen-secondary'}`}>
                      {byId.get(quote.id)?.unsent ? 'Message unsent' : quote.snippet || 'Message'}
                    </span>
                  </button>
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
                    aria-label="Open photo"
                    className="block overflow-hidden rounded-xl"
                  >
                    <img
                      src={msg.photoDataUrl}
                      alt="Photo"
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
                            // a pale mark could not be read at night, nor on the
                            // pink of your own messages.
                            <mark key={k} className="no-remap rounded bg-amber-300 px-0.5 text-[#1d1638]">
                              {part.text}
                            </mark>
                          ) : (
                            <React.Fragment key={k}>{part.text}</React.Fragment>
                          )
                        )
                      : msg.text}
                  </p>
                )}
                </>
                )}
              </div>

              {reactions.length > 0 && (
                // One from each of you, on the bubble's lower edge. Tapped, the
                // reactions come up to be changed.
                <button
                  type="button"
                  onClick={e => {
                    const bubble = e.currentTarget.parentElement?.querySelector<HTMLElement>('[data-bubble]');
                    if (bubble) openMenuRef.current(msg.id, bubble);
                  }}
                  aria-label={`Reactions: ${reactions.join(' ')}`}
                  className={`relative z-[1] -mt-2 inline-flex items-center gap-0.5 rounded-full border border-linen-border bg-linen-surface px-1.5 py-0.5 text-[13px] leading-none shadow-sm ${
                    mine ? 'mr-3' : 'ml-3'
                  }`}
                >
                  {[...new Set(reactions)].map(r => (
                    <span key={r}>{r}</span>
                  ))}
                  {reactions.length > 1 && new Set(reactions).size === 1 && (
                    <span className="ml-0.5 text-[10px] font-semibold text-linen-secondary">2</span>
                  )}
                </button>
              )}

              {showMeta && (
                <span className="text-[10px] text-linen-secondary mt-1 px-1 inline-flex items-center">
                  {pin && (
                    <span className="mr-1.5 inline-flex items-center gap-0.5 font-medium text-linen-accent">
                      <Pin className="w-3 h-3" />
                      Pinned
                    </span>
                  )}
                  {/* The name once per run, under its last bubble with the time. */}
                  {lastOfRun && (
                    <span>
                      {who(msg.authorId, activeUser, partnerName)}
                      {row.time && <> &middot; {row.time}</>}
                    </span>
                  )}
                  {/* Changed after it was sent: said wherever it is, last of a run or not. */}
                  {edited && <span className={lastOfRun ? 'ml-1' : ''}>{lastOfRun ? <>&middot; edited</> : 'edited'}</span>}
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

              {pin && (
                // Who pinned it, in a quiet line under it.
                <span className="mt-2 inline-flex items-center gap-1.5 self-center rounded-full bg-linen-variant/70 px-3 py-1 text-[11px] text-linen-secondary">
                  <Pin className="w-3 h-3" />
                  {pin.by === activeUser ? 'You' : partnerName} pinned this
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
    // The press handlers are left out on purpose: they act only through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawnRows, activeUser, partnerReadAt, shareReceipts, stuckOpen, partnerName, canResolveStuck, autoPlay,
      byId, highlight, matchSet, currentMatch, flashId, pinnedBy]
  );

  /** What can be done with the message whose menu is open. */
  const menuMessage = menu ? byId.get(menu.id) : undefined;
  const menuActions: MessageMenuAction[] = [];
  if (menuMessage && !menuMessage.unsent) {
    const m = menuMessage;
    const close = () => setMenu(null);
    menuActions.push({ key: 'reply', label: 'Reply', icon: CornerUpLeft, onSelect: () => { close(); answer(m.id); } });
    if (!m.isVoiceMemo && !m.isPhoto && m.text) {
      menuActions.push({
        key: 'copy',
        label: 'Copy',
        icon: Copy,
        onSelect: () => {
          close();
          void copyText(m.text).then(ok => showToast(ok ? 'Copied' : 'Could not copy'));
        }
      });
    }
    if (onPinMessage && canPin(m)) {
      const pinned = pinnedBy.has(m.id);
      menuActions.push({
        key: 'pin',
        label: pinned ? 'Unpin' : 'Pin',
        icon: pinned ? PinOff : Pin,
        onSelect: () => {
          close();
          onPinMessage(m.id, !pinned);
          if (!pinned) setPinStep(0);
          showToast(pinned ? 'Unpinned' : pinList.length >= MAX_PINS ? 'Pinned - the oldest pin made room' : 'Pinned');
        }
      });
    }
    if (m.isPhoto && m.photoDataUrl && !m.viewOnce) {
      menuActions.push({ key: 'save', label: 'Save to phone', icon: Download, onSelect: () => { close(); void savePhoto(m); } });
    }
    if (onEditMessage && canEdit(m, activeUser)) {
      menuActions.push({ key: 'edit', label: 'Edit', icon: Pencil, onSelect: () => { close(); startEdit(m); } });
    }
    if (onUnsendMessage && canUnsend(m, activeUser)) {
      menuActions.push({ key: 'unsend', label: 'Unsend', icon: Undo2, danger: true, onSelect: () => { close(); onUnsendMessage(m.id); } });
    }
  }
  /** The photo filling the screen - gone if it was taken back meanwhile. */
  const viewed = viewerId ? byId.get(viewerId) : undefined;
  const viewerMessage = viewed && viewed.isPhoto && viewed.photoDataUrl && !viewed.unsent && !viewed.viewOnce ? viewed : undefined;

  return (
    <div className="relative flex flex-col chat-shell bg-linen-surface rounded-2xl border border-linen-border overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-linen-border bg-linen-variant/40 flex items-center justify-between gap-2">
        {searchOpen ? (
          // Searching: the words, which match is in view, and the way to the
          // earlier and later ones. Enter goes further back, as the first
          // match shown is the newest.
          <div className="flex w-full min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Close search"
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
              aria-label="Search this chat"
              placeholder="Search this chat"
              className="min-w-0 flex-1 rounded-lg border border-linen-border bg-linen-surface px-3 py-1.5 text-sm text-linen-primary placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary select-text"
            />
            <span className="shrink-0 px-1 text-xs tabular-nums text-linen-secondary" aria-live="polite">
              {matchCount ? `${matchIndex + 1}/${matchCount}` : searchQuery.trim() ? 'None' : ''}
            </span>
            <button
              type="button"
              onClick={() => setMatchIndex(i => Math.max(0, i - 1))}
              disabled={matchIndex <= 0}
              aria-label="Earlier match"
              className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-linen-primary hover:bg-linen-variant disabled:opacity-30 transition-colors"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setMatchIndex(i => Math.min(matchCount - 1, i + 1))}
              disabled={matchIndex < 0 || matchIndex >= matchCount - 1}
              aria-label="Later match"
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
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search this chat"
              title="Search this chat"
              className="rounded-lg border border-linen-border bg-linen-surface p-1.5 text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
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
                </>
        )}
</div>

      {/* The pinned message on show; tapped, the conversation goes to it and
          the bar moves on to the one pinned before it. */}
      {shownPin && !searchOpen && (
        <button
          type="button"
          onClick={() => {
            if (!jumpTo(shownPin.messageId, true)) showToast('That message is no longer on this phone');
            setPinStep(step => step + 1);
          }}
          className="relative z-[1] flex w-full items-center gap-2.5 border-b border-linen-border bg-linen-surface/95 px-4 py-2 text-left shadow-[0_4px_12px_-8px_rgba(0,0,0,0.18)]"
        >
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-aurora-violet/12 text-aurora-violet">
            <Pin className="w-4 h-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2 text-[11px] font-semibold text-linen-accent">
              Pinned message
              {pinList.length > 1 && (
                <span className="font-medium tabular-nums text-linen-secondary">
                  {(pinStep % pinList.length) + 1} of {pinList.length}
                </span>
              )}
            </span>
            <span className="block truncate text-[13px] text-linen-primary">
              {(() => {
                const m = byId.get(shownPin.messageId);
                return m ? snippetOf(m) || 'Message' : 'Message';
              })()}
            </span>
          </span>
        </button>
      )}

      {/* Message List */}
      <div
        ref={messagesRef}
        onScroll={handleLogScroll}
        // Sideways hidden: a message drawn to the right to answer it must not
        // make the conversation scroll sideways under the finger.
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-contain p-4 sm:p-6"
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

      {/* What the next message answers, or which message is being changed -
          with the way out of either. */}
      {(replyTo || editing) && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-linen-border bg-linen-variant/50 py-1.5 pl-3 pr-1">
          <div className="w-[3px] self-stretch rounded-full bg-linen-accent" />
          {editing ? (
            <Pencil className="w-4 h-4 shrink-0 text-linen-accent" />
          ) : (
            <CornerUpLeft className="w-4 h-4 shrink-0 text-linen-accent" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-linen-accent">
              {editing
                ? 'Editing your message'
                : `Replying to ${replyTo!.authorId === activeUser ? 'yourself' : partnerName}`}
            </p>
            <p className="truncate text-xs text-linen-secondary">{editing ? editing.original : replyTo!.snippet || 'Message'}</p>
          </div>
          <button
            type="button"
            onPointerDown={keepComposerFocus}
            onMouseDown={keepComposerFocus}
            onClick={() => {
              cancelCompose();
              restoreComposerFocus();
            }}
            aria-label={editing ? 'Stop editing' : 'Cancel reply'}
            className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-linen-secondary hover:bg-linen-variant hover:text-linen-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {preparingPhotos > 0 && (
        <p className="mx-4 mt-2 text-[11px] text-linen-secondary" aria-live="polite">
          {preparingPhotos === 1 ? 'Getting the photo ready…' : `Getting ${preparingPhotos} photos ready…`}
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
              title="Emoji"
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
                  setInputText(e.target.value);
                  announceTyping();
                }}
                onKeyDown={handleComposerKey}
                enterKeyHint={touchFirst ? 'enter' : 'send'}
                autoCapitalize="sentences"
                aria-label={editing ? 'New words for your message' : `Message to ${partnerName}`}
                // Short enough for one line on a small phone; whose chat this is
                // is already in the header right above.
                placeholder="A quiet thought…"
                className={`block w-full resize-none overflow-y-hidden px-4 py-2.5 text-sm leading-5 rounded-xl border border-linen-border bg-linen-variant/30 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary placeholder:text-linen-secondary/60 select-text ${
                  showPhotoButton ? (touchFirst ? 'pr-20' : 'pr-11') : ''
                }`}
              />
              {showPhotoButton && touchFirst && (
                // A phone's camera, straight from the chat. A computer has
                // none to speak of, and its button would only open files.
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  aria-label="Take a photo"
                  title="Take a photo"
                  className="absolute right-10 bottom-1 h-[34px] w-[34px] rounded-lg flex items-center justify-center text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
                >
                  <Camera className="w-5 h-5" />
                </button>
              )}
              {showPhotoButton && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label="Send a photo"
                  title="Send a photo"
                  className="absolute right-1 bottom-1 h-[34px] w-[34px] rounded-lg flex items-center justify-center text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
                >
                  <ImageIcon className="w-5 h-5" />
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
                aria-label="Send"
                className="h-[42px] w-[42px] shrink-0 flex items-center justify-center rounded-xl bg-linen-primary text-linen-surface hover:opacity-90 disabled:opacity-40 transition-all"
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
          reaction={onReact ? menuMessage.reactions?.[activeUser] || '' : null}
          onReact={emoji => {
            setMenu(null);
            onReact?.(menuMessage.id, emoji);
            haptic('confirm');
          }}
          actions={menuActions}
          onClose={() => setMenu(null)}
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
          note="View once. It's gone when you close it."
          onClose={() => setOnceView(null)}
        />
      )}

      {viewerMessage && (
        <PhotoViewer
          src={viewerMessage.photoDataUrl!}
          caption={`${who(viewerMessage.authorId, activeUser, partnerName)}${
            viewerMessage.sentAt ? ' · ' + TIME_FORMAT.format(viewerMessage.sentAt) : ''
          }`}
          onClose={() => setViewerId(null)}
          onSave={() => void savePhoto(viewerMessage)}
        />
      )}

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
  const title = opened ? 'Opened' : 'Photo';
  const detail = opened ? 'View-once photo' : mine ? 'Not opened yet' : canOpen ? 'Tap to view once' : 'View-once photo';
  const body = (
    <>
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          opened ? '' : mine ? 'no-remap bg-white/20 text-white' : 'bg-aurora-violet/14 text-aurora-violet'
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
    <button type="button" onClick={onOpen} aria-label="Open the view-once photo" className="flex items-center gap-2.5">
      {body}
    </button>
  ) : (
    <span className="flex items-center gap-2.5">{body}</span>
  );
};
