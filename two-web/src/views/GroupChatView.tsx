import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  Trash2,
  CornerUpLeft,
  Undo2,
  Download,
  Camera,
  Phone,
  Image as ImageIcon
} from 'lucide-react';
import {
  GroupSpace,
  readBreakdown,
  GroupMessage,
  GroupReplyRef,
  isOverCapacity,
  MAX_GROUP_MEMBERS,
  MAX_GROUP_MESSAGES,
  membersOnline
} from '../core/groups';
import { formatLastSeen } from '../core/lastSeen';
import { useTypingSender } from '../core/typing';
import { EmojiPicker } from '../components/EmojiPicker';
import { VoiceNotePlayer } from '../components/VoiceNotePlayer';
import { VoiceMicButton, VoiceRecordingStrip, useVoiceRecorder } from '../components/VoiceRecorder';
import type { VoiceNote } from '../core/voice';
import { copyTextOrThrow } from '../core/clipboard';
import type { ChatDraft } from '../types';
import { BEFORE_LOCK_EVENT } from '../core/autoLock';
import {
  canDeleteGroupForMe,
  canEditGroup,
  canReactGroup,
  canUnsendGroup,
  cleanGroupReplyRef,
  deletedHere,
  groupHasWords,
  groupReplyRefFor,
  groupSnippetOf,
  reactionSummary
} from '../core/groupActions';
import { groupInfo } from '../core/messageInfo';
import { dayLabel, startOfDay } from '../core/when';
import { MessageInfoSheet } from '../components/MessageInfoSheet';
import { FloatingDayChip, useFloatingDay } from '../components/FloatingDayChip';
import type { PhotoFields } from '../core/chatActions';
import { PHOTOS_AT_ONCE, PHOTO_MAX_CHARS, dataUrlToBlob, photoFileName, photoSize, snippetShown } from '../core/chatShow';
import { HEART, useMessageGestures } from '../core/useMessageGestures';
import { shrinkPhoto } from '../core/photo';
import { saveFile } from '../core/saveFile';
import { copyText } from '../core/clipboard';
import { useBackLayer } from '../core/backStack';
import { haptic } from '../core/haptics';
import { activeLocale, useT } from '../core/i18n';
import { MessageMenu, type MessageMenuAction } from '../components/MessageMenu';
import { PhotoViewer } from '../components/PhotoViewer';
import { PhotoSendSheet } from '../components/PhotoSendSheet';
import { ReplyQuote } from '../components/ReplyQuote';
import { ReactionPill } from '../components/ReactionPill';
import { ComposeBanner } from '../components/ComposeBanner';
import { JumpToNewestButton } from '../components/JumpToNewestButton';
import { focusForTyping } from '../core/softKeyboard';

interface GroupChatViewProps {
  group: GroupSpace;
  /** This device's member id, so its own messages sit on the right. */
  myId: string;
  connected: boolean;
  /** Member ids currently typing, already excluding this device. */
  typingIds: string[];
  /** False when this device has receipts and typing switched off. */
  shareReceipts: boolean;
  /** `extras` makes it a photo (`text` is then "Photo"), or an answer to another message. */
  onSend: (text: string, extras?: GroupSendExtras) => void;
  /** A half-typed message to start with, if one was left in this group. */
  draft?: ChatDraft;
  /** Keeps what is half-typed (or, with null, forgets it) - on leaving, never per key press. */
  onSaveDraft?: (draft: ChatDraft | null) => void;
  /** A recorded voice note, to be sent to the group - answering a message, if one was being answered. */
  onSendVoice: (note: VoiceNote, replyTo?: GroupReplyRef) => void;
  /** Sets, changes, or (with '') takes off your reaction to a message. */
  onReact?: (messageId: string, emoji: string) => void;
  /** Rings everyone in the group (core/groupCall); absent where calls cannot be made. */
  onStartCall?: () => void;
  /** A call going on in this group that this phone is not in: how many are in it. */
  groupCallCount?: number;
  /** Joins that call. */
  onJoinCall?: () => void;
  /** This phone is on a call already, here or anywhere: no second one. */
  onACall?: boolean;
  /** New words for one of your own messages; offered for fifteen minutes after sending. */
  onEditMessage?: (messageId: string, text: string) => void;
  /** Takes one of your own messages back from everyone's phone. The caller asks first. */
  onUnsendMessage?: (messageId: string) => void;
  /** Deletes a message, anybody's, from this phone only. The caller asks first. */
  onDeleteForMe?: (messageId: string) => void;
  /** Somebody else's voice note has been played for the first time on this device. */
  onVoicePlayed: (messageId: string) => void;
  /**
   * True while a call with the partner is ringing or live - it can, with a
   * group open. The call has the microphone, so no note is recorded meanwhile.
   */
  callInProgress?: boolean;
  /** Writing started (true) or stopped (false); when each is said is decided in core/typing. */
  onTyping: (typing: boolean) => void;
  /** Founders only; absent for everyone else, which is what hides the control. */
  onRename?: (name: string) => void;
  /** Retry or abandon a message that never left this device. */
  onResolveStuck?: (messageId: string, action: 'retry' | 'delete') => void;
}

/** What a group message can carry besides its words. */
export interface GroupSendExtras {
  photo?: PhotoFields;
  replyTo?: GroupReplyRef;
}

/** This close to the end of the conversation counts as being at the end. */
const AT_BOTTOM_PX = 48;
/**
 * How much of a group's history is drawn, as in the couple's chat: the newest
 * DRAWN_AT_FIRST when it opens, DRAWN_MORE further back each time you scroll
 * within LOAD_EARLIER_PX of the top. Every message ever kept was drawn at
 * once, so a long group stuttered as it scrolled and as each message came.
 */
const DRAWN_AT_FIRST = 80;
const DRAWN_MORE = 80;
const LOAD_EARLIER_PX = 600;

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
  onStartCall,
  groupCallCount = 0,
  onJoinCall,
  onACall = false,
  myId,
  connected,
  typingIds,
  shareReceipts,
  onSend,
  draft,
  onSaveDraft,
  onSendVoice,
  onReact,
  onEditMessage,
  onUnsendMessage,
  onDeleteForMe,
  onVoicePlayed,
  callInProgress = false,
  onTyping,
  onRename,
  onResolveStuck
}) => {
  const tr = useT();
  // Back in the box: whatever was half-typed when this group was last left.
  const [text, setText] = useState(() => draft?.text ?? '');
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** The message being answered: shown above the composer, and sent with what is written next. */
  const [replyTo, setReplyTo] = useState<GroupReplyRef | null>(() => cleanGroupReplyRef(draft?.replyTo) ?? null);
  const replyToRef = useRef(replyTo);
  replyToRef.current = replyTo;
  /** One of your messages having its words changed, in the composer; what it said before. */
  const [editing, setEditing] = useState<{ id: string; original: string } | null>(null);

  /**
   * What is half-typed is kept when you leave - another screen, another app,
   * a locked phone - and put back next time, with the message it answers.
   * Saved on the way out, not per key press: each save re-encrypts
   * everything. Not an edit under way: those are an old message's words.
   */
  const draftNowRef = useRef<ChatDraft | null>(null);
  draftNowRef.current =
    editing || (!text.trim() && !replyTo) ? null : { text: text.trim() ? text : '', ...(replyTo ? { replyTo } : {}), at: 0 };
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
  /**
   * A draft that was only a reply, used by a voice note or photos: gone at
   * once, so a lock straight after cannot bring the reply back. Words still
   * in the box stay a draft.
   */
  const textRef = useRef(text);
  textRef.current = text;
  const forgetUsedDraft = () => {
    if (textRef.current.trim() || savedDraftRef.current === draftKey(null)) return;
    savedDraftRef.current = draftKey(null);
    onSaveDraftRef.current?.(null);
  };
  const putDraftDownRef = useRef(putDraftDown);
  putDraftDownRef.current = putDraftDown;
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
   * Hold-to-talk, as in the couple's chat: the mic sits in Send's place while
   * nothing is written. A note recorded while answering a message answers it.
   */
  const rec = useVoiceRecorder({
    onSend: note => {
      const reply = replyToRef.current;
      onSendVoice(note, reply ?? undefined);
      if (reply) setReplyTo(null);
      forgetUsedDraft();
    },
    disabled: callInProgress,
    onActiveChange: active => {
      if (active) setShowEmoji(false);
    }
  });
  const showMic = rec.supported && (!text.trim() || rec.active);
  /** Photos are offered while nothing is written - not mid-sentence, mid-edit, or mid-note. */
  const showPhotoButton = !text && !editing && !rec.active;
  /** The camera button only where the phone's camera is the way in (as in the couple's chat). */
  const touchFirst = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
    []
  );

  /**
   * The next voice note from somebody else, started by itself when the one
   * before it finished. `signal` only ever grows: each value is a new request.
   */
  const [autoPlay, setAutoPlay] = useState<{ id: string; signal: number } | null>(null);
  /** Looks at the conversation as it is when the note ends, not as it was drawn. */
  const messagesNowRef = useRef(group.messages);
  messagesNowRef.current = group.messages;
  const playNextAfter = (id: string) => {
    const list = messagesNowRef.current;
    const i = list.findIndex(m => m.id === id);
    const next = i >= 0 ? list[i + 1] : undefined;
    if (!next || !next.isVoiceMemo || next.authorId === myId || next.heard) return;
    setAutoPlay(prev => ({ id: next.id, signal: (prev?.signal ?? 0) + 1 }));
  };
  /** The message whose Info is open (MessageInfoSheet): who has read it, and when. */
  const [infoId, setInfoId] = useState<string | null>(null);
  // A call ringing in must not share its layer with it.
  useEffect(() => {
    if (callInProgress) setInfoId(null);
  }, [callInProgress]);
  const [showMembers, setShowMembers] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  /** Which stuck message has its retry/discard choice open. */
  const [stuckOpen, setStuckOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  // As in your own chat: on the first key, kept alive, stopped when the keys
  // stop - and never at Send, which their phones take as the end themselves.
  const typing = useTypingSender(onTyping);

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
      await copyTextOrThrow(
        `Join "${group.name}" on Two.\nCode: ${group.code}${phrase}`
      );
      setCopied(true);
      setCopyError('');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError('Could not copy — write the code and words down instead.');
    }
  };

  /** A word or two for a moment, over the conversation: "Copied", "Saved". */
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef(0);
  const showToast = (words: string) => {
    setToast(words);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1800);
  };
  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  /**
   * Whether the conversation is at its newest message. It used to be pulled
   * to the end by every message that came, even while you read further up;
   * now, as in the couple's chat, only while you are already there, or when
   * the message is your own. Scrolling up turns it off.
   */
  const pinnedRef = useRef(true);
  /** More than a screen above the newest message: the way back down is offered. */
  const [awayFromEnd, setAwayFromEnd] = useState(false);
  /**
   * The newest message when you left the end: what came after it from the
   * others is counted on the way back down. Null at the end.
   */
  const [awayMark, setAwayMark] = useState<string | null>(null);
  const newest = group.messages[group.messages.length - 1];
  const newestId = newest?.id ?? '';
  const newestIdRef = useRef(newestId);
  newestIdRef.current = newestId;
  const contentRef = useRef<HTMLDivElement>(null);
  /** The day at the top while you scroll, as in the couple's chat (components/FloatingDayChip). */
  const floatingDay = useFloatingDay(logRef);

  // Where the drawn part starts, as an index from the oldest message, so new
  // ones add at the end without moving what you are reading.
  const [firstDrawn, setFirstDrawn] = useState(() => Math.max(0, group.messages.length - DRAWN_AT_FIRST));
  const drawnFrom = Math.max(0, Math.min(firstDrawn, group.messages.length - DRAWN_AT_FIRST));
  const drawnFromRef = useRef(drawnFrom);
  drawnFromRef.current = drawnFrom;
  /** Set while earlier messages are being added above, to keep your place. */
  const growingRef = useRef<{ height: number; top: number } | null>(null);
  /** A message to go to once the part of the history it is in has been drawn. */
  const pendingJumpRef = useRef<{ id: string; rid?: string } | null>(null);

  // Read once a frame however many scroll events come in it: the sums below
  // read the page's layout, which on a phone is the slow part of a scroll.
  const scrollFrameRef = useRef(0);
  const handleLogScroll = () => {
    if (scrollFrameRef.current) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = 0;
      const log = logRef.current;
      if (!log) return;
      const fromEnd = log.scrollHeight - log.scrollTop - log.clientHeight;
      const pinned = fromEnd < AT_BOTTOM_PX;
      pinnedRef.current = pinned;
      setAwayFromEnd(fromEnd > log.clientHeight);
      setAwayMark(mark => (pinned ? null : mark ?? newestIdRef.current));
      // Near the top with more behind it: draw the next part of the history.
      if (log.scrollTop < LOAD_EARLIER_PX && drawnFromRef.current > 0 && !growingRef.current) {
        growingRef.current = { height: log.scrollHeight, top: log.scrollTop };
        setFirstDrawn(Math.max(0, drawnFromRef.current - DRAWN_MORE));
      }
    });
    floatingDay.onScroll();
  };
  useEffect(() => () => cancelAnimationFrame(scrollFrameRef.current), []);

  // Earlier messages were just drawn above: move down by exactly what they
  // added, so the message you were reading stays where it was. Or one asked
  // for further back is there now: go to it.
  useLayoutEffect(() => {
    const log = logRef.current;
    const growing = growingRef.current;
    if (log && growing) {
      log.scrollTop = log.scrollHeight - growing.height + growing.top;
      growingRef.current = null;
    }
    const jump = pendingJumpRef.current;
    if (jump) {
      pendingJumpRef.current = null;
      jumpToRef.current(jump.id, jump.rid);
    }
  }, [drawnFrom]);

  // A new message: yours brings you to the end, as it always has; one of
  // theirs, while you read further up, leaves you where you are - the way
  // down is the button, with how many came. Anything else that changes a
  // message - a reaction, a tick - only keeps the end in view if that is
  // where you were.
  const shownNewestRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const log = logRef.current;
    if (!log) return;
    if (newestId !== shownNewestRef.current) {
      const first = shownNewestRef.current === null;
      shownNewestRef.current = newestId;
      if (first || newest?.authorId === myId) pinnedRef.current = true;
    }
    if (pinnedRef.current) {
      log.scrollTop = log.scrollHeight;
      setAwayFromEnd(false);
      setAwayMark(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.messages, newestId]);

  // While at the end it stays in view through any change of size: the
  // keyboard, the emoji picker, a photo or a voice note laying out late.
  useEffect(() => {
    const log = logRef.current;
    if (!log || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) log.scrollTop = log.scrollHeight;
    });
    observer.observe(log);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  /** From the others, since you left the end; what was taken back is not news. */
  const newBelow = useMemo(() => {
    if (!awayMark) return 0;
    const list = group.messages;
    const from = list.findIndex(m => m.id === awayMark);
    if (from < 0) return 0;
    let count = 0;
    for (let i = from + 1; i < list.length; i++) {
      if (list[i].authorId !== myId && !list[i].unsent) count++;
    }
    return count;
  }, [awayMark, group.messages, myId]);

  /** Back down to the newest message. */
  const goToNewest = () => {
    const log = logRef.current;
    if (!log) return;
    pinnedRef.current = true;
    setAwayFromEnd(false);
    setAwayMark(null);
    log.scrollTop = log.scrollHeight;
    haptic('tick');
  };

  /** A message just jumped to, lit for a moment so the eye finds it. */
  const [flashId, setFlashId] = useState<string | null>(null);
  /**
   * Brings a message into view, a third of the way down, and lights it up.
   * Found by its id or by the record id it travelled in. False when it is
   * not on this phone.
   */
  const jumpTo = (id: string, rid?: string): boolean => {
    const list = messagesNowRef.current;
    const m =
      list.find(x => x.id === id) ||
      list.find(x => x.rid === id) ||
      (rid ? list.find(x => x.id === rid || x.rid === rid) : undefined);
    const log = logRef.current;
    if (!m || !log) return false;
    const el = log.querySelector<HTMLElement>(`[data-mid="${CSS.escape(m.id)}"]`);
    if (!el) {
      // Further back than is drawn: draw back to it first, then go.
      const at = list.indexOf(m);
      if (at < 0 || at >= drawnFromRef.current) return false;
      pendingJumpRef.current = { id: m.id };
      setFirstDrawn(Math.max(0, at - 5));
      return true;
    }
    pinnedRef.current = false;
    log.scrollTop += el.getBoundingClientRect().top - log.getBoundingClientRect().top - log.clientHeight / 3;
    setFlashId(m.id);
    window.setTimeout(() => setFlashId(current => (current === m.id ? null : current)), 1500);
    return true;
  };

  /** Answer a message: its quote goes above the composer, and the keyboard comes up. */
  const answer = (id: string) => {
    const m = messagesNowRef.current.find(x => x.id === id);
    if (!m || m.unsent) return;
    if (editing) {
      setEditing(null);
      setText('');
    }
    setReplyTo(groupReplyRefFor(m));
    focusForTyping(inputRef.current);
  };

  /** Change one of your messages: its words go into the composer to be written over. */
  const startEdit = (m: GroupMessage) => {
    // The new message being written is put aside: changing an old one is not typing.
    typing.stop();
    setReplyTo(null);
    setEditing({ id: m.id, original: m.text });
    setText(m.text);
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
      setText('');
    }
  };
  useBackLayer(!!(replyTo || editing), cancelCompose);
  // Deleted from this phone meanwhile: not there to answer or change any more.
  useEffect(() => {
    const deleted = group.deletedForMe;
    if (!deleted) return;
    if (replyTo && deletedHere(deleted, replyTo)) setReplyTo(null);
    if (editing && deleted[editing.id]) {
      setEditing(null);
      setText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.deletedForMe]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    if (editing) {
      const target = messagesNowRef.current.find(m => m.id === editing.id);
      if (!target || !canEditGroup(target, myId)) {
        // The fifteen minutes ran out while the new words were being written.
        showToast(tr('Too late to change - messages can be edited for 15 minutes'));
      } else if (body !== editing.original) {
        onEditMessage?.(editing.id, body);
      }
      setEditing(null);
    } else {
      onSend(body, replyTo ? { replyTo } : undefined);
      typing.sent();
      setReplyTo(null);
    }
    setText('');
    // Gone at once, so a lock straight after cannot bring back sent words.
    if (savedDraftRef.current !== draftKey(null)) {
      savedDraftRef.current = draftKey(null);
      onSaveDraftRef.current?.(null);
    }
  };

  /**
   * Photos chosen from the phone or just taken with its camera, as in the
   * couple's chat: a last look first (PhotoSendSheet, with no view once in a
   * group), then one message each, in the order picked, each shrunk to fit
   * one record (core/photo). The first answers the message being answered.
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
  const [preparingPhotos, setPreparingPhotos] = useState(0);
  const sendPhotos = async (list: File[]) => {
    let reply = replyToRef.current;
    setReplyTo(null);
    forgetUsedDraft();
    setPreparingPhotos(n => n + list.length);
    for (const file of list) {
      try {
        const shrunk = await shrinkPhoto(file, PHOTO_MAX_CHARS);
        onSend('Photo', {
          photo: { isPhoto: true, photoDataUrl: shrunk.dataUrl, photoWidth: shrunk.width, photoHeight: shrunk.height },
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

  /** A photo, out of the group and into the phone's own storage, where the person chooses. */
  const savePhoto = async (m: GroupMessage) => {
    if (!m.photoDataUrl) return;
    try {
      await saveFile(dataUrlToBlob(m.photoDataUrl), photoFileName(m.sentAt));
      showToast(tr('Saved'));
    } catch {
      showToast(tr('Could not save the photo'));
    }
  };
  /** The photo filling the screen. */
  const [viewerId, setViewerId] = useState<string | null>(null);

  /** The message whose menu is open, and where it sits on screen. */
  const [menu, setMenu] = useState<{
    id: string;
    anchor: { top: number; bottom: number; left: number; right: number };
  } | null>(null);
  const menuRef = useRef(menu);
  menuRef.current = menu;
  const openMenu = (id: string, bubble: HTMLElement) => {
    const m = messagesNowRef.current.find(x => x.id === id);
    if (!m || m.unsent) return;
    const r = bubble.getBoundingClientRect();
    setMenu({ id, anchor: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } });
    haptic('tick');
  };
  /** The message whose reactions are listed, member by member. */
  const [reactionsFor, setReactionsFor] = useState<string | null>(null);

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
  const playNextAfterRef = useRef(playNextAfter);
  playNextAfterRef.current = playNextAfter;
  const voicePlayedRef = useRef(onVoicePlayed);
  voicePlayedRef.current = onVoicePlayed;
  const resolveStuckRef = useRef(onResolveStuck);
  resolveStuckRef.current = onResolveStuck;
  const canResolveStuck = !!onResolveStuck;
  /** A long press opens a message's menu and a pull to the right answers it, as in the couple's chat. */
  const reactRef = useRef(onReact);
  reactRef.current = onReact;
  const gestures = useMessageGestures({
    onLongPress: (id, bubble) => openMenuRef.current(id, bubble),
    onSwipeReply: id => answerRef.current(id),
    menuOpen: () => !!menuRef.current,
    // Two taps: a heart, or taken off again when the heart is already yours.
    onDoubleTap: id => {
      const react = reactRef.current;
      const m = messagesNowRef.current.find(x => x.id === id);
      if (!react || !m || !canReactGroup(m, myId)) return;
      react(id, m.reactions?.[myId] === HEART ? '' : HEART);
    }
  });

  const nameFor = (id: string) => group.members.find(m => m.id === id)?.name || 'Someone';

  const typingLabel = (() => {
    const names = typingIds.map(nameFor);
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]} and ${names.length - 1} others are typing…`;
  })();

  // The dots come into view only if you were already at the end: reading
  // further up, nothing moves.
  const typingDotsRef = useRef<HTMLDivElement>(null);
  const someoneTyping = typingIds.length > 0;
  useLayoutEffect(() => {
    const log = logRef.current;
    const dots = typingDotsRef.current;
    if (!log || !dots) return;
    const fromEnd = log.scrollHeight - log.scrollTop - log.clientHeight - dots.offsetHeight;
    if (fromEnd < 48) log.scrollTop = log.scrollHeight;
  }, [someoneTyping]);

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
  // For the day names under the messages: "Today" becomes "Yesterday" at
  // midnight, drawn again by the tick above.
  const today = new Date().toDateString();

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

  /**
   * Every message by its id and by the record id it travelled in: a quote
   * looks up whether what it answers was since taken back.
   */
  const byKey = useMemo(() => {
    const map = new Map<string, GroupMessage>();
    for (const m of group.messages) map.set(m.id, m);
    for (const m of group.messages) if (m.rid && !map.has(m.rid)) map.set(m.rid, m);
    return map;
  }, [group.messages]);
  const lang = activeLocale();

  /**
   * The bubbles themselves.
   *
   * Built only when the conversation or how it is shown changes - not on each
   * key press in the composer, which with up to two thousand messages kept
   * would redraw every one of them, menus and reactions and all.
   */
  const conversation = useMemo(() => {
    // One name per day, not one formatted for each of two thousand messages.
    const now = Date.now();
    const dayNames = new Map<number, string>();
    const dayOf = (at: number) => {
      const day = startOfDay(at);
      let name = dayNames.get(day);
      if (name === undefined) {
        name = dayLabel(day, now);
        dayNames.set(day, name);
      }
      return name;
    };
    return group.messages.slice(drawnFrom).map(msg => {
        const mine = msg.authorId === myId;
        const unsent = !!msg.unsent;
        const breakdown = readBreakdown(group.members, msg);
        const author = msg.authorName || nameFor(msg.authorId);
        const edited = !!msg.editedAt && !unsent;
        const quote = unsent ? undefined : msg.replyTo;
        const quoted = quote ? byKey.get(quote.id) || (quote.rid ? byKey.get(quote.rid) : undefined) : undefined;
        const photo = !unsent && msg.isPhoto && msg.photoDataUrl ? photoSize(msg) : null;
        const reactions = unsent ? [] : reactionSummary(msg.reactions, myId);
        const reacted = reactions.reduce((n, r) => n + r.count, 0);
        return (
          <div
            key={msg.id}
            data-mid={msg.id}
            data-day={msg.sentAt && Number.isFinite(msg.sentAt) ? dayOf(msg.sentAt) : undefined}
            // A long press opens the message's menu, a pull to the right -
            // from anywhere on its line - answers it, and two taps put a
            // heart on it; up and down stays the conversation's scroll. Its
            // words are copied from the menu rather than selected, as in the
            // couple's chat: a long press cannot do both.
            onPointerDown={unsent ? undefined : e => gestures.pressStart(e, msg.id)}
            onPointerMove={unsent ? undefined : gestures.pressMove}
            onPointerUp={unsent ? undefined : gestures.pressEnd}
            onPointerCancel={unsent ? undefined : gestures.pressEnd}
            onContextMenu={unsent ? undefined : e => gestures.pressContextMenu(e, msg.id)}
            onClickCapture={gestures.swallowClick}
            className={`touch-pan-y relative flex flex-col ${mine ? 'items-end' : 'items-start'}`}
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
            {!mine && (
              <span className="mb-0.5 px-1 text-[10px] font-medium text-linen-accent">
                {author}
              </span>
            )}
            <div
              data-bubble
              className={`touch-pan-y ${
                // A voice note takes a little more of the width, so its
                // player (200px at the least) fits a 320px phone. A photo
                // gets a thin frame of the bubble's own colour.
                photo ? 'p-1' : msg.isVoiceMemo && !unsent ? 'max-w-[90%] px-3 py-2' : 'max-w-[80%] px-3.5 py-2'
              } rounded-2xl text-sm ${
                // Plain, as in your own chat (index.css): yours grey, everyone
                // else's outlined; their names above keep their colour.
                unsent
                  ? 'bubble-edge border border-dashed text-linen-secondary'
                  : mine
                  ? 'bubble-mine text-linen-primary'
                  : 'bubble-edge border text-linen-primary'
              } ${flashId === msg.id ? 'message-flash' : ''}`}
            >
              {unsent ? (
                <p className="flex items-center gap-1.5 italic">
                  <Undo2 className="w-3.5 h-3.5 shrink-0" />
                  {mine ? tr('You unsent a message') : tr('{name} unsent a message', { name: author })}
                </p>
              ) : (
                <>
                  {quote && (
                    // What this answers. Tapped, the conversation goes back to it.
                    <ReplyQuote
                      who={
                        quote.authorId === myId
                          ? tr('You')
                          : group.members.find(m => m.id === quote.authorId)?.name || quote.authorName || 'Someone'
                      }
                      text={
                        quoted?.unsent
                          ? tr('Message unsent')
                          : deletedHere(group.deletedForMe, { id: quote.id, rid: quote.rid })
                          ? tr('You deleted this message')
                          : snippetShown(quote.snippet)
                      }
                      onJump={() => {
                        if (deletedHere(group.deletedForMe, { id: quote.id, rid: quote.rid })) {
                          showToastRef.current(tr('You deleted this message'));
                        } else if (!jumpToRef.current(quote.id, quote.rid)) {
                          showToastRef.current(tr('That message is no longer on this phone'));
                        }
                      }}
                      maxWidth={photo ? photo.width : undefined}
                    />
                  )}
                  {msg.isVoiceMemo ? (
                    // The player stands for the note; its label is for the
                    // notification and older phones. A group keeps no receipts
                    // per note, so your own carry no heard mark - only the
                    // "new" dot on somebody else's, until this device plays it.
                    <VoiceNotePlayer
                      id={msg.id}
                      audioDataUrl={msg.audioDataUrl}
                      durationSeconds={msg.audioDurationSeconds}
                      peaks={msg.audioPeaks}
                      tone={mine ? 'mine' : 'theirs'}
                      heard={!!msg.heard}
                      showHeard={!mine}
                      onFirstPlay={mine ? undefined : () => voicePlayedRef.current(msg.id)}
                      onEnded={() => playNextAfterRef.current(msg.id)}
                      playSignal={autoPlay?.id === msg.id ? autoPlay.signal : undefined}
                    />
                  ) : photo ? (
                    // Its own shape at a size that fits the conversation;
                    // tapped, it has the whole screen.
                    <button
                      type="button"
                      data-tap-wait
                      onClick={() => setViewerId(msg.id)}
                      aria-label={tr('Open photo')}
                      className="block overflow-hidden rounded-xl"
                    >
                      <img
                        src={msg.photoDataUrl}
                        alt={tr('Photo')}
                        loading="lazy"
                        width={photo.width}
                        height={photo.height}
                        decoding="async"
                        draggable={false}
                        className="block object-cover"
                        style={photo}
                      />
                    </button>
                  ) : (
                    msg.text
                  )}
                </>
              )}
            </div>

            {reactions.length > 0 && (
              // On the bubble's lower edge: up to three, and how many there
              // are in all. Tapped, who chose which.
              <ReactionPill
                emojis={reactions.slice(0, 3).map(r => r.emoji)}
                count={reacted > 1 ? reacted : undefined}
                label={tr('Reactions: {emoji}', { emoji: reactions.map(r => r.emoji).join(' ') })}
                mine={mine}
                onClick={() => {
                  setInfoId(null);
                  setReactionsFor(msg.id);
                }}
              />
            )}

            <span className="mt-1 flex items-center gap-1 px-1 text-[10px] text-linen-secondary">
              {new Date(msg.sentAt).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
              })}
              {/* Changed after it was sent. */}
              {edited && <span>&middot; {tr('edited')}</span>}
              {mine && !unsent && (
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
                          canResolveStuck && setStuckOpen(open => (open === msg.id ? null : msg.id))
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
                      onClick={() => {
                        setReactionsFor(null);
                        setInfoId(msg.id);
                      }}
                      aria-label={tr('Who has read this')}
                      className="rounded p-0.5 text-linen-secondary/70 hover:text-linen-primary transition-colors cursor-pointer"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </span>

            {stuckOpen === msg.id && canResolveStuck && (
              <span className="mt-0.5 flex items-center gap-1.5 px-1">
                <button
                  onClick={() => {
                    setStuckOpen(null);
                    resolveStuckRef.current?.(msg.id, 'retry');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-linen-border bg-linen-surface px-2 py-1 text-[10px] font-medium text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
                >
                  <RotateCw className="h-3 w-3" /> Send again
                </button>
                <button
                  onClick={() => {
                    setStuckOpen(null);
                    resolveStuckRef.current?.(msg.id, 'delete');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-linen-border bg-linen-surface px-2 py-1 text-[10px] font-medium text-linen-secondary hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" /> Discard
                </button>
              </span>
            )}
          </div>
        );
      });
    // The press handlers and the callbacks are read through refs, and the
    // gestures never change, so none of them rebuild the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.messages, drawnFrom, group.members, myId, shareReceipts, stuckOpen, autoPlay, flashId, canResolveStuck, byKey, lang, gestures,
    group.deletedForMe, today]);

  /** What can be done with the message whose menu is open. */
  const menuMessage = menu ? group.messages.find(m => m.id === menu.id) : undefined;
  const menuActions: MessageMenuAction[] = [];
  if (menuMessage && !menuMessage.unsent) {
    const m = menuMessage;
    const close = () => setMenu(null);
    menuActions.push({ key: 'reply', label: tr('Reply'), icon: CornerUpLeft, onSelect: () => { close(); answer(m.id); } });
    if (groupHasWords(m) && m.text) {
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
    if (m.isPhoto && m.photoDataUrl) {
      menuActions.push({ key: 'save', label: tr('Save to phone'), icon: Download, onSelect: () => { close(); void savePhoto(m); } });
    }
    if (onEditMessage && canEditGroup(m, myId)) {
      menuActions.push({ key: 'edit', label: tr('Edit'), icon: Pencil, onSelect: () => { close(); startEdit(m); } });
    }
    if (onUnsendMessage && canUnsendGroup(m, myId)) {
      menuActions.push({
        key: 'unsend',
        label: tr('Unsend'),
        icon: Undo2,
        danger: true,
        onSelect: () => { close(); onUnsendMessage(m.id); }
      });
    }
    // When it went and arrived - and, for your own, who has read it.
    menuActions.push({
      key: 'info',
      label: tr('Info'),
      icon: Info,
      onSelect: () => { close(); setReactionsFor(null); setInfoId(m.id); }
    });
    // From this phone only, anybody's: Unsend is the way off everyone's.
    if (onDeleteForMe && canDeleteGroupForMe(m, myId)) {
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
  const infoMessage = infoId ? group.messages.find(m => m.id === infoId && !m.unsent) : undefined;
  /** The reactions being listed - gone with the last of them, or with the message. */
  const reactionsMessage = reactionsFor
    ? group.messages.find(m => m.id === reactionsFor && !m.unsent && m.reactions)
    : undefined;
  /** The photo filling the screen - gone if it was taken back meanwhile. */
  const viewed = viewerId ? group.messages.find(m => m.id === viewerId) : undefined;
  const viewerMessage = viewed && viewed.isPhoto && viewed.photoDataUrl && !viewed.unsent ? viewed : undefined;

  return (
    <div className="relative flex flex-col chat-shell bg-linen-surface rounded-2xl border border-linen-border overflow-hidden shadow-sm">
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
        {onStartCall && (
          <button
            type="button"
            onClick={onStartCall}
            disabled={onACall || groupCallCount > 0 || !connected}
            aria-label={tr('Call the group')}
            className="tap-target grid h-9 w-9 shrink-0 place-items-center rounded-full text-linen-primary transition-colors hover:bg-linen-variant active:scale-95 disabled:opacity-40"
          >
            <Phone className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {/* A call going on here that you are not in: one tap to join it. */}
      {groupCallCount > 0 && onJoinCall && !onACall && (
        <div className="border-b border-linen-border px-3 py-2">
          <button type="button" onClick={onJoinCall} className="gcall-join animate-in fade-in slide-in-from-top-1 duration-300">
            <span className="call-pill-dot" aria-hidden="true" />
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1 text-left text-sm font-medium">
              {tr('Join call')} · {tr('{n} in call', { n: groupCallCount })}
            </span>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">{tr('Join')}</span>
          </button>
        </div>
      )}

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

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {typingLabel}
      </p>

      {/* Messages. Sideways hidden: a message drawn to the right to answer
          it must not make the conversation scroll sideways under the finger. */}
      <div
        ref={logRef}
        onScroll={handleLogScroll}
        {...floatingDay.inputHandlers}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-contain p-4"
      >
        <FloatingDayChip label={floatingDay.label} shown={floatingDay.shown} />
        <div ref={contentRef} className="space-y-3">
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

          {conversation}

          {/* Who is writing: dots in a bubble of theirs, where the next message
              will land. The header and the line above say it in words. */}
          {someoneTyping && (
            <div ref={typingDotsRef} data-typing aria-hidden="true" className="flex flex-col items-start">
              <span className="mb-0.5 px-1 text-[10px] font-medium text-linen-accent">
                {typingIds.map(nameFor).join(', ')}
              </span>
              <div className="typing-in rounded-2xl bubble-edge border px-3.5 py-2 text-sm">
                <span className="typing-dots h-5 text-linen-secondary">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          )}
        </div>
        {/* Reading further up: the way back down, with how many came from
            the others meanwhile. */}
        {(awayFromEnd || newBelow > 0) && <JumpToNewestButton onClick={goToNewest} count={newBelow} />}
      </div>

      {/* When it went and arrived, and who has read it - drawn from the
          message as it is now, so a read heard while it is open shows. */}
      {infoMessage && (
        <MessageInfoSheet
          preview={snippetShown(groupSnippetOf(infoMessage))}
          {...groupInfo(infoMessage, group.members, myId, shareReceipts)}
          onClose={() => setInfoId(null)}
        />
      )}

      {/* Who reacted with what, built like "Read by". Your own can be taken off here. */}
      {reactionsMessage && (
        <div className="border-t border-linen-border bg-linen-surface px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
              {tr('Reactions')}
            </span>
            <button
              onClick={() => setReactionsFor(null)}
              aria-label={tr('Close')}
              className="rounded-lg p-1 text-linen-secondary hover:bg-linen-variant transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto scroll-contain text-xs">
            {Object.entries(reactionsMessage.reactions || {}).map(([who, emoji]) =>
              who === myId && onReact ? (
                <button
                  key={who}
                  type="button"
                  onClick={() => onReact(reactionsMessage.id, '')}
                  aria-label={tr('Take off {emoji}', { emoji })}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-left text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
                >
                  <span className="truncate">{tr('You')}</span>
                  <span className="text-sm">{emoji}</span>
                </button>
              ) : (
                <div key={who} className="flex items-center justify-between gap-2 px-1 py-0.5 text-linen-primary">
                  <span className="truncate">{who === myId ? tr('You') : nameFor(who)}</span>
                  <span className="text-sm">{emoji}</span>
                </div>
              )
            )}
            {onReact && reactionsMessage.reactions?.[myId] && (
              <p className="pt-1 text-[10px] leading-relaxed text-linen-secondary">{tr('Tap yours to take it off')}</p>
            )}
          </div>
        </div>
      )}

      {showEmoji && (
        <EmojiPicker
          onPick={char => {
            setText(t => t + char);
            if (!editing) typing.keystroke();
          }}
          onClose={() => setShowEmoji(false)}
        />
      )}

      {/* What the next message answers, or which message is being changed -
          with the way out of either. */}
      {(replyTo || editing) && (
        <ComposeBanner
          mode={editing ? 'edit' : 'reply'}
          title={
            editing
              ? tr('Editing your message')
              : replyTo!.authorId === myId
              ? tr('Replying to yourself')
              : tr('Replying to {name}', {
                  name: group.members.find(m => m.id === replyTo!.authorId)?.name || replyTo!.authorName || 'Someone'
                })
          }
          snippet={editing ? editing.original : snippetShown(replyTo!.snippet)}
          cancelLabel={editing ? tr('Stop editing') : tr('Cancel reply')}
          // The keyboard stays up through the cross.
          keepFocus={e => e.preventDefault()}
          onCancel={cancelCompose}
        />
      )}

      {preparingPhotos > 0 && (
        <p className="mx-4 mt-2 text-[11px] text-linen-secondary" aria-live="polite">
          {preparingPhotos === 1 ? tr('Getting the photo ready…') : tr('Getting {n} photos ready…', { n: preparingPhotos })}
        </p>
      )}

      {/* Composer. Positioned, so a voice note under way can lie over the
          emoji button and the text box, which stay mounted underneath, while
          the mic - the last control - stays where the thumb is. */}
      <div className="relative flex items-center gap-2 border-t border-linen-border bg-linen-surface px-3 pb-1.5 pt-2">
        <VoiceRecordingStrip rec={rec} className="pl-3 pt-2 pb-1.5" />
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
        {/* The photo buttons sit inside the text box while it is empty, as in
            the couple's chat, so they take none of the width words need. */}
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={e => {
              setText(e.target.value);
              // Changing an old message is not writing; an emptied box is not either.
              if (editing) return;
              if (e.target.value.trim()) typing.keystroke();
              else typing.stop();
            }}
            // Left the box. A moment's grace: a tap on the emoji button is not leaving.
            onBlur={() => typing.stopSoon()}
            // Mid-word in an input method, Enter picks the word; it is not ours.
            onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
            enterKeyHint="send"
            aria-label={editing ? tr('New words for your message') : undefined}
            placeholder={`Message ${group.name}…`}
            className={`w-full rounded-xl border border-linen-border bg-linen-variant/30 px-4 py-2.5 text-sm text-linen-primary placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary ${
              showPhotoButton ? (touchFirst ? 'pr-20' : 'pr-11') : ''
            }`}
          />
          {showPhotoButton && touchFirst && (
            // A phone's camera, straight from the group. A computer has none
            // to speak of, and its button would only open files.
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              aria-label={tr('Take a photo')}
              title={tr('Take a photo')}
              className="absolute right-10 top-1/2 -translate-y-1/2 h-[34px] w-[34px] rounded-lg flex items-center justify-center text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
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
              className="absolute right-1 top-1/2 -translate-y-1/2 h-[34px] w-[34px] rounded-lg flex items-center justify-center text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors"
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
        {/* One slot: Send while something is written, the mic while nothing
            is (and for as long as a note is under way). The same size as the
            mic, so the text box does not shift when one replaces the other. */}
        {showMic ? (
          <VoiceMicButton rec={rec} />
        ) : (
          <button
            onClick={send}
            disabled={!text.trim()}
            aria-label="Send"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-linen-primary text-linen-surface transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
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
          side={menuMessage.authorId === myId ? 'right' : 'left'}
          reaction={onReact && canReactGroup(menuMessage, myId) ? menuMessage.reactions?.[myId] || '' : null}
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
          // "Photo for Family": the group's name where a partner's would be.
          partnerName={group.name}
          allowViewOnce={false}
          onClose={() => setPickedPhotos(null)}
          onSend={() => {
            const list = pickedPhotos;
            setPickedPhotos(null);
            void sendPhotos(list);
          }}
        />
      )}

      {viewerMessage && (
        <PhotoViewer
          key={viewerMessage.id}
          src={viewerMessage.photoDataUrl!}
          caption={`${
            viewerMessage.authorId === myId ? tr('You') : viewerMessage.authorName || nameFor(viewerMessage.authorId)
          } · ${new Date(viewerMessage.sentAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}
          onClose={() => setViewerId(null)}
          onSave={() => void savePhoto(viewerMessage)}
        />
      )}
    </div>
  );
};
