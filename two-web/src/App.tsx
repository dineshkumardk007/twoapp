import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense, startTransition, useMemo } from 'react';
import { loadState, saveState, clearState, pruneForStorage, forStorage, upgradeState, SpaceState, MAX_CHAT_MESSAGES } from './core/storage';
import { AppDock } from './components/AppDock';
import { GroupDock } from './components/GroupDock';
import {
  GROUP_CHAT,
  GROUP_HELLO,
  GROUP_READ,
  GroupMessage,
  GroupSpace,
  myMemberId,
  newGroup,
  MAX_GROUP_MESSAGES,
  withMember,
  withRead,
  unreadCount
} from './core/groups';
import {
  connectGroup,
  disconnectGroup,
  forgetGroup,
  dropPendingInGroup,
  disconnectAllGroups,
  sendToGroup,
  signalToGroup,
  subscribeGroupStatus
} from './core/groupRelays';
import { isAndroidApp, formFactor } from './core/platform';
import { withoutSampleAdventures } from './core/sampleData';
import { setBackFallback } from './core/backStack';
import { haptic } from './core/haptics';
import { wsRelay, RelayStatus, recordSizeOf, MAX_RECORD_BYTES } from './core/ws';
import {
  cleanVoiceFields,
  isVoiceRecorderAskingForMic,
  voiceFieldsOf,
  voiceNoteLabel,
  type VoiceFields
} from './core/voice';
import {
  hasEncryptedVault,
  unlockVault,
  createVault,
  writeVault,
  destroyVault
} from './core/vault';
import { fingerprintStatus, unlockWithFingerprint, disableFingerprint } from './core/fingerprint';
import type { SpaceRole } from './core/space';
import {
  isWeakPairingCode,
  generatePairingCode,
  getDeviceId,
  describeThisDevice,
  normalizeJoinPhrase,
  normalizePairingCode,
  deriveSpaceCredentials,
  loadSpaceSession,
  saveSpaceSession,
  clearSpaceSession,
  forgetLastSpace,
  SpaceSession
} from './core/space';
import { localMesh } from './core/localMesh';
import { insertBySentAt } from './core/ordering';
import { CallEngine, CallState, IDLE_CALL, CALL_SIGNAL, CALL_MISSED } from './core/call';
import { CALL_LOG, applyCallLog, callLogFrom, readCallLog, type ChatCallInfo } from './core/callLog';
import { crashNoteToTell } from './core/crashNote';
import { CallOverlay } from './components/CallOverlay';
import { RelayStorageWarning } from './components/RelayStorageWarning';
import { RoleClashDialog } from './components/RoleClashDialog';
import { preloadSounds } from './core/sounds';
import { mergeIncomingRadio } from './core/radioSync';
import { liveRadioHold } from './core/liveRadio';
import {
  isRealName,
  isOwnDeviceName,
  ownDeviceNames,
  rememberOwnDeviceName,
  CATCH_UP_TYPES,
  addOnce
} from './core/seats';
import { UpdateReadyToast } from './components/UpdateReadyToast';
import { UpdatePrompt } from './components/UpdatePrompt';
import { appVersion, checkForUpdate, isPutOff, UpdateInfo } from './core/appUpdate';
import { routeFor, isNews, NEWS_READS_PAYLOAD, withActivity, unseen, dottedTabs } from './core/activity';
import {
  ThemeMode,
  NeedItem,
  ChatMessage,
  JournalEntry,
  AgreementItem,
  QuoteItem,
  MemoryItem,
  ListItem,
  ChoreItem,
  ExpenseItem,
  CycleRecord,
  CycleSharingLevel,
  RitualItem,
  PebbleStone,
  LoveLetter,
  AdventureItem,
  RelationshipMilestone,
  GratitudeStar,
  CareCompassProfile,
  ComfortBoxData,
  ChatDraft,
  SecretRecipe,
  IntuitionGameRound,
  TimeCapsuleItem,
  ScratchCardItem,
  HearthGardenState,
  SoftLandingSession,
  WhisperMemoItem,
  NightstandState,
  MemoryCoordinatePin,
  MidnightRadioState,
  RadioWhisper,
  StateOfUnionSession,
  DrawStroke,
  CanvasSavedSketch,
  SharedDrawingCanvasState,
  RepairLetter,
  RepairStatus,
  KintsugiVesselItem
} from './types';
import { Navigation } from './components/Navigation';
import { CalculatorDecoy } from './components/CalculatorDecoy';
import { SensoryPulseOverlay, triggerGlobalPulse } from './components/SensoryPulseOverlay';
import { playMessageChime, playLetterChime, triggerHaptic } from './core/audioAlerts';
import { InAppNotificationToast, InAppNotification } from './components/InAppNotificationToast';
import { Locale, LocaleContext, activeLocale, chooseLocale, tr } from './core/i18n';
import { Lock, Fingerprint } from 'lucide-react';
import { CURATED_DILEMMAS } from './data/dilemmas';
import { newId } from './core/ids';
import {
  SHARED_RECORD_TYPES,
  applySharedRecord,
  choreToWire,
  expenseToWire,
  quoteToWire,
  journalToWire,
  cycleRecordToWire,
  memoryToWire,
  ritualToWire,
  WHISPER_MEMO,
  WHISPER_MEMO_HEARD,
  MEMORY_ADD,
  LIST_ITEM_SET,
  LIST_ITEM_DELETE,
  RITUAL_ADD,
  RITUAL_SET,
  MILESTONE_ADD,
  LETTER_OPENED,
  CHORE_ADD,
  EXPENSE_ADD,
  EXPENSES_SETTLED,
  JOURNAL_SHARED,
  QUOTE_ADD,
  AGREEMENT_ADD,
  CYCLE_RECORD,
  CYCLE_SHARING
} from './core/sharedRecords';
import { localDay, isDoneOn, withRitualDay } from './core/rituals';
import { OUR_DATES, DAILY_ANSWER } from './core/sharedRecords';
import { cleanOurDates, newerOurDates, nextAnniversary } from './core/ourDates';
import { updateWidget, takeLaunchAction } from './core/widget';
import { resolveMediaRefs, withResolvedMedia, containsMediaRefs, collectMediaGarbage, clearMedia } from './core/media';
import {
  lockoutRemaining,
  registerFailure,
  clearFailures,
  isUnderSuspicion
} from './core/lockGuard';
import { readAutoLock, writeAutoLock, watchForAbsence, lockNow, AutoLockSetting, BEFORE_LOCK_EVENT } from './core/autoLock';
import { applyIngredientTick } from './core/recipes';
import { countUnread, newestArrival, newestFrom, readAtForReceipt } from './core/unread';
import { withBox } from './core/comfortBox';
import { COMING_UP, mergeDays, type ComingUpDay } from './core/comingUp';
import {
  CAN_SHOW_LATER,
  cleanShowAt,
  dueNow,
  isHeld,
  isWaiting,
  newsWithout,
  waitsWith,
  withHeld,
  withHeldMessages,
  withdrawn
} from './core/sendLater';
import { STATUS_SET, applyStatus, cleanStatus, liveStatus, stampFor, statusWords } from './core/status';
import { CAN_DATE_LETTERS, cleanLetter, openOnWords, opensNow } from './core/letters';
import { cleanName, nameProblem, nameStampFor, readNameExchange, startedFromMine, takesOver } from './core/names';
import { heartKind } from './core/hearts';
import { aheadLabel } from './core/when';
import { leaveBedside } from './core/bedside';
import { askConfirm } from './core/dialog';
import { firstHue, watchBoxes } from './core/boxHues';
import {
  CHAT_EDIT,
  CHAT_PIN,
  CHAT_REACTION,
  CHAT_UNSEND,
  CHAT_VIEWED,
  applyEdit,
  applyPin,
  applyReaction,
  applyUnsend,
  applyViewed,
  canEdit,
  canOpenViewOnce,
  canUnsend,
  cleanPhotoFields,
  cleanReplyRef,
  deliveredCopy,
  type MessageExtras
} from './core/chatActions';
import { mergeReport, recordDay } from './core/weatherHistory';
import { localDateKey } from './core/ourDates';
import {
  PRESENCE_BEAT,
  BEAT_INTERVAL_MS,
  readShareLastSeen,
  writeShareLastSeen,
  readShareReceipts,
  writeShareReceipts,
  TYPING_SIGNAL,
  TYPING_TTL_MS
} from './core/lastSeen';


// Screens are fetched the first time they are opened rather than all at once.
// Thirty-three of them in a single file meant every one had to arrive before
// anything could be drawn.
/** "45 seconds" / "2 minutes" - a wait you can read at a glance. */
function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** Set the first time the home screen shows the tour card. */
const TOUR_CARD_SEEN_KEY = 'two_story_tour_card_seen_v1';

/** Said on the lock screen once the phone has switched fingerprint unlock off itself. */
const FINGERPRINT_CHANGED_NOTE =
  "The fingerprints on this phone changed, so fingerprint unlock switched itself off. Use your PIN, then turn it on again in Settings.";

/**
 * The partner has played one of your voice notes: `{ messageId }`.
 *
 * Sent only while the listener shares read receipts - hearing a note is
 * reading it. A phone on an older version does not know the type and passes
 * over it, as it does any record it has no branch for.
 */
const VOICE_HEARD = 'VOICE_HEARD';

/**
 * Which version of the app this phone runs: `{ code, name }`.
 *
 * Sent once per version rather than with every presence beat: the beat is
 * not sent at all to someone who has turned off "last seen", and a version is
 * not a way of being seen. A phone on an older version passes over the type.
 */
const APP_VERSION = 'APP_VERSION';
/**
 * What this phone tells the other, with its version, that an older one
 * cannot do: hold back a message set for later (core/sendLater), and keep a
 * letter for a day closed until then (core/letters).
 */
const CAN_DO = [CAN_SHOW_LATER, CAN_DATE_LETTERS];

/** What a letter's toast says: its title, and its day when it waits for one. */
function letterNotice(letter: LoveLetter, fallback: string): string {
  const title = letter.title || fallback;
  const today = localDateKey();
  return letter.openOn && letter.openOn > today ? `${title} - to open on ${openOnWords(letter.openOn, today)}` : title;
}

/**
 * What is said when a message is too big for one record: the relay takes a
 * megabyte. Said by the relay client when it refuses to send one, and before
 * that by the senders of voice notes, which check first.
 */
function tooLargeNotice(bytes: number, isChat: boolean, tabId: string): InAppNotification {
  const mb = (Number(bytes) / (1024 * 1024)).toFixed(1);
  return {
    id: newId(),
    title: isChat ? 'Message too large to send' : 'Too large to send',
    body: isChat
      ? `That one is ${mb} MB, past the 1 MB a single message can carry. A shorter voice note will go through.`
      : `That one is ${mb} MB, past the 1 MB a single message can carry.`,
    type: 'general',
    tabId
  };
}

/**
 * A chat message from the partner's phone, made safe to keep.
 *
 * A recording is kept only as cleanVoiceFields accepts it - an audio data:
 * URL, nothing that would be fetched from anywhere - and a photo only as
 * cleanPhotoFields does, an image data: URL. A message that claims either and
 * fails loses the claim, and shows as its text: the label every one carries
 * ("Voice note · 0:12", "Photo"). A reply's quote is kept only as a quote.
 * `heard` is never taken from the wire; it is this phone's own record of who
 * has played what. Nor are edits, unsending, reactions or a view-once photo
 * being opened: those arrive as records of their own (core/chatActions),
 * never inside the message. A photo keeps its view-once mark only if it is a
 * photo at all.
 */
function chatFromWire(parsed: any): ChatMessage {
  // Taken off whatever they say, so only the checked copies below go back on.
  const {
    isVoiceMemo, audioDataUrl, audioDurationSeconds, audioPeaks, heard,
    isPhoto, photoDataUrl, photoWidth, photoHeight, replyTo,
    editedAt, unsent, reactions, viewOnce, viewedAt,
    // Never a message's to claim: a call's line is made here from a CALL_LOG,
    // and when a message arrived is this phone's own record.
    call, receivedAt,
    showAt,
    ...rest
  } = parsed;
  const voice = cleanVoiceFields(parsed);
  const photo = voice ? null : cleanPhotoFields(parsed);
  const reply = cleanReplyRef(replyTo);
  // Set to show later: in its place at that time (core/sendLater).
  const later = cleanShowAt(showAt);
  return {
    ...rest,
    ...(voice || photo || {}),
    ...(photo && viewOnce === true ? { viewOnce: true } : {}),
    ...(reply ? { replyTo: reply } : {}),
    ...(later ? { showAt: later, sentAt: later } : {})
  };
}

const AdventuresView = lazy(() => import('./views/AdventuresView').then(m => ({ default: m.AdventuresView })));
const CanvasOfUsView = lazy(() => import('./views/CanvasOfUsView').then(m => ({ default: m.CanvasOfUsView })));
const CareCompassView = lazy(() => import('./views/CareCompassView').then(m => ({ default: m.CareCompassView })));
const ChatView = lazy(() => import('./views/ChatView').then(m => ({ default: m.ChatView })));
const ChoreSplitView = lazy(() => import('./views/ChoreSplitView').then(m => ({ default: m.ChoreSplitView })));
const CoPresenceView = lazy(() => import('./views/CoPresenceView').then(m => ({ default: m.CoPresenceView })));
const ConstellationView = lazy(() => import('./views/ConstellationView').then(m => ({ default: m.ConstellationView })));
const CookbookView = lazy(() => import('./views/CookbookView').then(m => ({ default: m.CookbookView })));
const CoordinatesMapView = lazy(() => import('./views/CoordinatesMapView').then(m => ({ default: m.CoordinatesMapView })));
const CycleView = lazy(() => import('./views/CycleView').then(m => ({ default: m.CycleView })));
const DecksView = lazy(() => import('./views/DecksView').then(m => ({ default: m.DecksView })));
const HearthGardenView = lazy(() => import('./views/HearthGardenView').then(m => ({ default: m.HearthGardenView })));
const HomeView = lazy(() => import('./views/HomeView').then(m => ({ default: m.HomeView })));
const IntuitionGameView = lazy(() => import('./views/IntuitionGameView').then(m => ({ default: m.IntuitionGameView })));
const JournalView = lazy(() => import('./views/JournalView').then(m => ({ default: m.JournalView })));
const KintsugiMomentsView = lazy(() => import('./views/KintsugiMomentsView').then(m => ({ default: m.KintsugiMomentsView })));
const LettersView = lazy(() => import('./views/LettersView').then(m => ({ default: m.LettersView })));
const ListsView = lazy(() => import('./views/ListsView').then(m => ({ default: m.ListsView })));
const MidnightRadioView = lazy(() => import('./views/MidnightRadioView').then(m => ({ default: m.MidnightRadioView })));
const MoneyLightView = lazy(() => import('./views/MoneyLightView').then(m => ({ default: m.MoneyLightView })));
const NightstandClockView = lazy(() => import('./views/NightstandClockView').then(m => ({ default: m.NightstandClockView })));
const OnboardingView = lazy(() => import('./views/OnboardingView').then(m => ({ default: m.OnboardingView })));
const RepairBridgeView = lazy(() => import('./views/RepairBridgeView').then(m => ({ default: m.RepairBridgeView })));
const RepairKitView = lazy(() => import('./views/RepairKitView').then(m => ({ default: m.RepairKitView })));
const RitualsGardenView = lazy(() => import('./views/RitualsGardenView').then(m => ({ default: m.RitualsGardenView })));
const SanctuaryDirectoryModal = lazy(() => import('./components/SanctuaryDirectoryModal').then(m => ({ default: m.SanctuaryDirectoryModal })));
const ScrapbookView = lazy(() => import('./views/ScrapbookView').then(m => ({ default: m.ScrapbookView })));
const ScratchCardsView = lazy(() => import('./views/ScratchCardsView').then(m => ({ default: m.ScratchCardsView })));
const GroupsView = lazy(() => import('./views/GroupsView').then(m => ({ default: m.GroupsView })));
const GroupChatView = lazy(() => import('./views/GroupChatView').then(m => ({ default: m.GroupChatView })));
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const SoftLandingView = lazy(() => import('./views/SoftLandingView').then(m => ({ default: m.SoftLandingView })));
const StateOfUnionView = lazy(() => import('./views/StateOfUnionView').then(m => ({ default: m.StateOfUnionView })));
const StoryTourModal = lazy(() => import('./components/StoryTourModal').then(m => ({ default: m.StoryTourModal })));
const TimeCapsuleView = lazy(() => import('./views/TimeCapsuleView').then(m => ({ default: m.TimeCapsuleView })));
const TimelineView = lazy(() => import('./views/TimelineView').then(m => ({ default: m.TimelineView })));
const WhisperMemosView = lazy(() => import('./views/WhisperMemosView').then(m => ({ default: m.WhisperMemosView })));

/**
 * Held while a screen's chunk arrives.
 *
 * Deliberately close to nothing: the chunks are small and, inside the Android
 * app, read straight off local storage, so anything more elaborate would flash
 * for a frame and read as a glitch. It keeps the page from collapsing to zero
 * height while it waits.
 */
const ScreenFallback: React.FC = () => (
  <div className="min-h-[60vh]" aria-busy="true" />
);

export const App: React.FC = () => {
  const [state, setState] = useState<SpaceState>(loadState);
  /**
   * False while photos and voice memos are still being read back out of
   * IndexedDB. Seeded from the loaded vault, so a space with no media - which
   * is most of them, most of the time - never waits or flashes a splash.
   */
  const [mediaReady, setMediaReady] = useState(() => !containsMediaRefs(state));

  const [currentTab, setCurrentTab] = useState('home');
  const [theme, setTheme] = useState<ThemeMode>('linen');
  /**
   * Whether the calculator opens instead of the app.
   *
   * Restricted to the Android app deliberately. A browser gives the disguise
   * away by every means it has - the URL, the history, the tab title - so
   * opening a website to a calculator only pretends to hide something.
   */
  const [decoyOnLaunch, setDecoyOnLaunch] = useState(
    () => localStorage.getItem('two_decoy_on_launch') === 'true'
  );
  const [isCamouflaged, setIsCamouflaged] = useState(
    () => isAndroidApp() && localStorage.getItem('two_decoy_on_launch') === 'true'
  );

  /**
   * The message handler is installed once and would otherwise close over the
   * camouflage state from the render that installed it.
   */
  const isCamouflagedRef = useRef(isCamouflaged);
  isCamouflagedRef.current = isCamouflaged;

  /**
   * The disguise ends any call.
   *
   * The calculator replaces everything, the call screen included, so a call
   * left running would go on talking out of a phone showing a calculator with
   * no way to hang up short of unlocking it in front of whoever made you reach
   * for the disguise. However it went up - the button, leaving the app - the
   * call goes with it.
   */
  useEffect(() => {
    if (isCamouflaged) callEngineRef.current?.endForDisguise();
  }, [isCamouflaged]);

  /**
   * The couple's audio call.
   *
   * Held in a ref and created once, because a call has to outlive every
   * screen change - switching tabs, the dock, even the calculator coming up
   * mid-call - and none of that may tear a live connection down.
   */
  const [callState, setCallState] = useState<CallState>(IDLE_CALL);
  const callEngineRef = useRef<CallEngine | null>(null);
  // A call ends the Nightstand's bedside mode: the screen was turned down to
  // almost nothing, and a call needs to be seen.
  useEffect(() => {
    if (callState.phase !== 'idle') leaveBedside();
  }, [callState.phase]);
  useEffect(() => {
    const engine = new CallEngine({
      send: signal => wsRelay.sendSignal(CALL_SIGNAL, signal),
      onChange: setCallState,
      onMissed: callId => wsRelay.broadcastUpdate(CALL_MISSED, { callId, at: Date.now() }),
      canRing: () => !isCamouflagedRef.current,
      nudgeRelay: () => wsRelay.reconnectNow(),
      iceServers: () => wsRelay.getIceServers()
    });
    callEngineRef.current = engine;
    return () => {
      engine.destroy();
      callEngineRef.current = null;
    };
  }, []);
  /**
   * Each call leaves its line in the chat (core/callLog). This phone writes
   * what it saw as the call ends, and sends it; the other phone's account of
   * the same call merges into the same line.
   */
  const addCallLine = (info: ChatCallInfo) =>
    setState(prev => {
      const messages = applyCallLog(prev.messages, info, insertBySentAt);
      return messages === prev.messages ? prev : { ...prev, messages: messages.slice(-MAX_CHAT_MESSAGES) };
    });
  const loggedCallsRef = useRef(new Set<string>());
  useEffect(() => {
    const info = callLogFrom(callState, state.activeUser);
    if (!info || loggedCallsRef.current.has(info.callId)) return;
    loggedCallsRef.current.add(info.callId);
    addCallLine(info);
    // A call that never reached the other phone (the microphone refused here,
    // or it failed before ringing) is this phone's to remember, not theirs.
    if (info.caller !== state.activeUser || callState.offered) wsRelay.broadcastUpdate(CALL_LOG, info);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState.phase, callState.callId]);

  // Steady across renders, or the call screen would restart its listening
  // every second the timer ticks.
  const callVoiceLevels = useCallback(
    () => callEngineRef.current?.voiceLevels() ?? Promise.resolve({ mine: 0, theirs: 0 }),
    []
  );
  const [showStoryTour, setShowStoryTour] = useState(false);

  /**
   * The home screen's tour card, shown until it has been seen once.
   *
   * It goes the moment the tour is opened from it, or when home is left
   * after the card was on screen - not the instant it appears, so it cannot
   * vanish underneath you while you are reading it. Either way it never comes
   * back; the tour itself stays in Tools.
   */
  const [showTourCard, setShowTourCard] = useState(() => {
    try {
      return localStorage.getItem(TOUR_CARD_SEEN_KEY) !== 'true';
    } catch {
      // Private mode: showing it every launch beats hiding it forever.
      return true;
    }
  });

  /** Whether the card has been on screen in this run. */
  const tourCardSeenRef = useRef(false);

  // Seen only once home has actually been on screen. Opening the app
  // straight into chat and closing it again should not burn the one showing.
  useEffect(() => {
    if (!showTourCard) return;
    if (currentTab === 'home') {
      tourCardSeenRef.current = true;
      try {
        localStorage.setItem(TOUR_CARD_SEEN_KEY, 'true');
      } catch {
        /* private mode - nothing to remember it with */
      }
    } else if (tourCardSeenRef.current) {
      setShowTourCard(false);
    }
  }, [showTourCard, currentTab]);
  // This phone's language, kept on it (core/i18n): English or Tamil.
  const [locale, setLocale] = useState<Locale>(() => activeLocale());
  const pickLocale = (next: Locale) => {
    chooseLocale(next);
    setLocale(next);
  };
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  // Bumped when pairing completes so the relay effect re-runs and joins the new space.
  const [spaceVersion, setSpaceVersion] = useState(0);

  // Notifications, audio alerts, and directory drawer states
  //
  // How many of the partner's messages wait unread: worked out from the
  // messages and this phone's read watermark (core/unread), so it counts what
  // came while Two was closed and is still right after a restart. It used to
  // be a number in memory that only live messages added to.
  const unreadChatCount = useMemo(
    () => countUnread(state.messages, state.activeUser, state.chatReadAt),
    [state.messages, state.activeUser, state.chatReadAt]
  );
  const [inAppNotification, setInAppNotification] = useState<InAppNotification | null>(null);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [decoyCode, setDecoyCode] = useState(() => localStorage.getItem('two_decoy_code') || '142.85');
  const [autoCamouflageOnBlur, setAutoCamouflageOnBlur] = useState(() => localStorage.getItem('two_auto_camo') === 'true');

  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;
  const partnerNameRef = useRef(state.partnerName);
  partnerNameRef.current = state.partnerName;
  // Read inside the relay handler, which only re-subscribes when the role
  // changes and would otherwise compare against a name from before a rename.
  const userNameRef = useRef(state.userName);
  userNameRef.current = state.userName;
  /**
   * What this phone says its name is. Once changed in Settings, with when
   * (core/names), and with the names you went by before, so your other
   * devices know it for yours.
   */
  const nameExchange = (name: string, setAt: number | undefined) => ({
    name,
    role: state.activeUser,
    ...(setAt ? { setAt, was: ownDeviceNames() } : {})
  });

  /**
   * Set when another phone announces itself from this phone's own seat.
   *
   * Both phones holding the same role is silent otherwise - see
   * RoleClashDialog for what it breaks.
   */
  const [roleClash, setRoleClash] = useState<{ name: string } | null>(null);
  /**
   * Whether this phone has answered a clash with its own name yet.
   *
   * Only the phone that was already online hears the other announce itself,
   * so it says its name back once - and the other phone, hearing a different
   * name from its own seat, asks the same question. Once, because two phones
   * that answered every announcement with one would never stop.
   */
  const clashAnnouncedRef = useRef(false);
  /**
   * The name last heard clashing with this phone's seat - kept after the
   * dialog is closed, unlike roleClash. When that name is next heard from the
   * other seat, the other phone has moved, and this one fetches what the
   * clash hid from it (see catchUpAfterClash).
   */
  const clashNameRef = useRef<string | null>(null);

  // Session & relay connection state
  const [session, setSession] = useState<SpaceSession | null>(loadSpaceSession);
  const [relayStatus, setRelayStatus] = useState<RelayStatus>(() => wsRelay.getStatus());
  /**
   * Whether the relay is keeping what it is sent. Null until it says.
   *
   * Worth a line on screen because the failure is invisible otherwise: a
   * database that has gone away still lets two phones talk to each other, and
   * silently keeps nothing for the one that is off.
   */
  const [relayDurable, setRelayDurable] = useState<boolean | null>(null);
  const [storageWarningDismissed, setStorageWarningDismissed] = useState(false);
  useEffect(() => wsRelay.subscribeDurable(durable => {
    setRelayDurable(durable);
    // A fresh problem is worth showing again, even if the last one was waved away.
    if (!durable) setStorageWarningDismissed(false);
  }), []);

  // PIN lock protection state
  // When a PIN is set the vault is encrypted, so nothing can be read until it is
  // opened. `vaultKey` is held only in memory and drives every later write.
  const [isLocked, setIsLocked] = useState<boolean>(() => hasEncryptedVault());
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);

  /**
   * Reads photos and voice memos back out of IndexedDB into the shape every
   * component and the relay already expect.
   *
   * Keyed on mediaReady rather than on state: state changes on every keystroke,
   * and there is only work to do here when a vault has just been loaded or
   * unlocked.
   */
  useEffect(() => {
    if (mediaReady) return;
    let cancelled = false;

    // The bytes are read first and put in through an update, not by replacing
    // the vault with a copy taken before the read began: the relay connects
    // without waiting for this, and a message it delivered meanwhile would
    // otherwise be thrown away - after the relay had already moved past it.
    resolveMediaRefs(state, vaultKey)
      .then(({ resolved, unreadable }) => {
        if (cancelled) return;
        setState(prev => withResolvedMedia(prev, resolved));
        setMediaReady(true);
        // A start that could not read some of what is stored is no time to
        // decide what is unused: the references it kept are still wanted.
        if (unreadable > 0) return;
        // The live set of references is only known once everything is loaded,
        // so this is the moment to drop stored media nothing points at.
        //
        // Measured against the vault as it was loaded - with its references -
        // and not against a copy in which every reference has already been
        // swapped back for its bytes. Swept against that, nothing looked
        // referenced and every stored photo and recording was deleted on each
        // launch; the next save kept the references (the bytes were known by
        // then) and the launch after found nothing behind them.
        void collectMediaGarbage(state);
      })
      .catch(() => {
        // Showing the space without its photos beats not showing it at all.
        if (!cancelled) setMediaReady(true);
      });

    return () => {
      cancelled = true;
    };
    // state is read when the effect runs; adding it here would re-run this on
    // every edit for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaReady, vaultKey]);


  // Whether the partner's device is actually in the space right now, and when
  // we last heard anything from them.
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [occupancy, setOccupancy] = useState({ peers: 0, ownDevices: 0, total: 0 });
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const [isUnlocking, setIsUnlocking] = useState(false);
  // Device storage is full: the app still runs from memory, but nothing is
  // being saved. Silence here would cost the user everything on refresh.
  const [storageFull, setStorageFull] = useState(false);

  // The dock is an app-only surface; the website keeps its header and directory.
  const [inApp] = useState(isAndroidApp);
  const [isTablet, setIsTablet] = useState(() => formFactor() === 'tablet');

  useEffect(() => {
    const onResize = () => setIsTablet(formFactor() === 'tablet');
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  const [pinAttempt, setPinAttempt] = useState('');
  const [pinError, setPinError] = useState(false);

  /** Seconds still to wait before another PIN may be tried; 0 when free. */
  const [lockoutLeft, setLockoutLeft] = useState(() => lockoutRemaining());
  const [autoLock, setAutoLock] = useState<AutoLockSetting>(() => readAutoLock());
  const [shareLastSeen, setShareLastSeen] = useState(() => readShareLastSeen());
  const [shareReceipts, setShareReceipts] = useState(() => readShareReceipts());
  /** Epoch ms of the partner's most recent typing signal; 0 when not typing. */
  const [partnerTypingAt, setPartnerTypingAt] = useState(0);

  /** The group being read right now, or null while in the sanctuary. */
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  // Read inside the group message handler, which is captured when a group
  // first connects and would otherwise keep seeing the first value forever.
  const activeGroupIdRef = useRef<string | null>(null);
  activeGroupIdRef.current = activeGroupId;
  const [groupStatuses, setGroupStatuses] = useState<Record<string, string>>({});
  /** memberId -> when they were last seen typing, per group. */
  const [groupTyping, setGroupTyping] = useState<Record<string, Record<string, number>>>({});
  const [passphraseAttempt, setPassphraseAttempt] = useState('');

  // The sounds heard most - a message, a letter, a heartbeat, a call - are
  // decoded ahead of time, so the first of the day plays the moment it should.
  // Once the app has settled, not while it opens: making the audio context and
  // decoding took a tenth of a second from the first frames on a mid-range
  // phone, and nothing can sound before the first tap anyway.
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    const timer = idle
      ? idle(() => preloadSounds(), { timeout: 4000 })
      : window.setTimeout(preloadSounds, 2500);
    return () => {
      const cancel = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idle && cancel) cancel(timer);
      else window.clearTimeout(timer);
    };
  }, []);

  // Track live WebSocket relay status
  useEffect(() => {
    return wsRelay.subscribeStatus((status) => {
      setRelayStatus(status);
    });
  }, []);

  // Broadcast user name to partner whenever relay connects
  useEffect(() => {
    // Only once the connection is sitting in the seat this phone now claims.
    // Straight after a seat switch the old socket is still the one connected,
    // and an announcement sent on it went out under the seat being left - which
    // the phone still in that seat took as a second clash.
    if (wsRelay.currentSeat() !== state.activeUser) return;
    if (relayStatus === 'connected' && state.userName && state.userName !== 'You') {
      // With when it was chosen, once it has been changed (core/names).
      wsRelay.broadcastUpdate('NAME_EXCHANGE', nameExchange(state.userName, state.userNameSetAt));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayStatus, state.userName, state.activeUser]);

  // The couple's dates go out again on every connection, as the name does. A
  // phone still on the previous version when they were set read past the
  // record without keeping it, and would never see it again after updating.
  // The repeat keeps its original stamp, so the newest setting still wins on
  // both phones, and a phone that already holds it changes nothing.
  useEffect(() => {
    if (wsRelay.currentSeat() !== state.activeUser) return;
    if (relayStatus === 'connected' && state.ourDates) {
      wsRelay.broadcastUpdate(OUR_DATES, state.ourDates);
    }
    // Birthdays, the meet-up and days of your own, for the same reasons
    // (core/comingUp): each day keeps its own stamp, so this changes nothing
    // on a phone that already has them.
    if (relayStatus === 'connected' && state.comingUp?.length) {
      wsRelay.broadcastUpdate(COMING_UP, { days: state.comingUp });
    }
    // Your status while it lasts (core/status), stamped as it was set: a
    // phone that has it keeps it as it is, with no second word at the top.
    const mine = liveStatus(state.statuses?.[state.activeUser]);
    if (relayStatus === 'connected' && mine) {
      wsRelay.broadcastUpdate(STATUS_SET, mine);
    }
    // Only on connecting: a change made here is sent by handleSetOurDates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayStatus, state.activeUser]);

  // Check URL parameters for dual-window live sync demonstration.
  //
  // Website only. In the app there is no second window to open: the WebView
  // loaded the link in place, the phone took the other person's seat, and
  // everything sent from it afterwards arrived as theirs. An auto-lock reload
  // keeps the address, so it stayed that way until the app was killed. The
  // seat on a phone comes from its pairing and nothing else.
  useEffect(() => {
    if (isAndroidApp()) return;
    const params = new URLSearchParams(window.location.search);
    const perspective = params.get('perspective');
    if (perspective === 'partner' || perspective === 'user') {
      setState(prev => ({ ...prev, activeUser: perspective }));
    }
  }, []);

  // Derive this couple's room id and content key from the stored pairing code,
  // then join the relay. Nothing is sent until the key exists, so records are
  // never broadcast in the clear.
  useEffect(() => {
    if (isLocked || !session) {
      wsRelay.disconnect();
      return;
    }

    let cancelled = false;
    deriveSpaceCredentials(session.code, session.role, session.joinPhrase)
      .then(creds => {
        if (!cancelled) wsRelay.connect(creds);
      })
      .catch(e => console.error('[Space] Key derivation failed', e));

    return () => {
      cancelled = true;
    };
  }, [session, spaceVersion, isLocked]);

  useEffect(
    () =>
      wsRelay.subscribePresence((online, info) => {
        setPartnerOnline(online);
        setOccupancy(info);
        if (online) setState(prev => (prev.partnerEverSeen ? prev : { ...prev, partnerEverSeen: true }));
      }),
    []
  );

  // Announce this device so the other side can put a name to it. Sent on every
  // (re)connect because the partner may not have been listening the first time.
  useEffect(() => {
    if (!session) return;
    const announce = () =>
      wsRelay.broadcastUpdate('DEVICE_HELLO', {
        deviceId: getDeviceId(),
        label: describeThisDevice()
      });

    const t = setTimeout(announce, 1200);
    const unsub = wsRelay.subscribeStatus(st => {
      if (st === 'connected') setTimeout(announce, 800);
    });
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, [session, spaceVersion]);

  // The relay confirming a record is what turns a pending message into "sent".
  useEffect(
    () =>
      wsRelay.subscribe((msg: any) => {
        if (msg?.type !== 'RECORD_ACK' || !msg.correlationId) return;
        // Your own view-once photo lets go of its picture here: it is safely
        // on its way, and not to be seen again on this phone (core/chatActions).
        setState(prev => ({
          ...prev,
          messages: prev.messages.map(m =>
            m.id === msg.correlationId ? deliveredCopy(m, prev.activeUser) : m
          )
        }));
      }),
    []
  );

  /**
   * A message of the partner's has just come in front of this phone: the
   * chime, a buzz, a toast unless the chat is open, and the tab's title while
   * Two is in the background. Both for one arriving now and for one set to
   * show later whose time has come while Two is open.
   */
  const announceMessage = (text: string | undefined) => {
    playMessageChime();
    triggerHaptic([35, 45, 35]);
    if (currentTabRef.current !== 'chat') {
      setInAppNotification({
        id: newId(),
        title: partnerNameRef.current || 'Partner',
        body: text || 'Sent you a message',
        type: 'chat',
        tabId: 'chat'
      });
    }
    // Not while disguised: rewriting the tab to "New message from
    // ..." is exactly the thing the calculator is there to prevent,
    // and it fires whether or not anyone is looking at the screen.
    if (
      typeof document !== 'undefined' &&
      document.hidden &&
      !isCamouflagedRef.current
    ) {
      document.title = `(1) 💌 New message from ${partnerNameRef.current || 'Partner'}`;
    }
  };

  // Listen for remote updates
  useEffect(() => {
    const unsubscribe = wsRelay.subscribe((msg) => {
      // Signals carry no history and are never stored, so they are handled
      // before the record path rather than inside it.
      if (msg.type === 'RECORD_TOO_LARGE') {
        const isChat = msg.recordType === 'CHAT';
        setInAppNotification(
          tooLargeNotice(msg.bytes, isChat, isChat ? 'chat' : currentTabRef.current || 'home')
        );
        // The bubble was added the moment it was written. It never left this
        // phone and never will, so it does not get to sit in the conversation
        // looking sent.
        if (isChat && msg.correlationId) {
          setState(prev => ({
            ...prev,
            messages: prev.messages.filter(m => m.id !== msg.correlationId)
          }));
        }
        return;
      }

      if (msg.type === 'REMOTE_SIGNAL' && msg.signal?.type === CALL_SIGNAL) {
        let signal: any;
        try {
          signal = JSON.parse(msg.signal.payload);
        } catch {
          return;
        }
        // Not gated on receipts: whether a call rings is not a read receipt.
        callEngineRef.current?.handleSignal(signal, msg.signal.authorId === state.activeUser);
        return;
      }

      if (msg.type === 'REMOTE_SIGNAL' && msg.signal?.type === TYPING_SIGNAL) {
        // Reciprocal: a device that sends nothing sees nothing.
        if (!readShareReceipts()) return;
        if (msg.signal.authorId === state.activeUser) return;
        setPartnerTypingAt(Date.now());
        return;
      }

      if (msg.type === 'REMOTE_RECORD') {
        const record = msg.record;
        // History fetched again after a seat switch: only what can safely be
        // applied twice. See CATCH_UP_TYPES.
        if (msg.catchUp && !CATCH_UP_TYPES.has(record.type)) return;
        setLastSyncedAt(Date.now());
        // Anything arriving proves a partner exists on the other end.
        setState(prev => (prev.partnerEverSeen ? prev : { ...prev, partnerEverSeen: true }));

        /**
         * Note what the partner changed, before working out what it was.
         *
         * Deliberately one hook above the whole type chain rather than a line
         * added to each of its forty branches: every feature gets this at once,
         * a new feature gets it by adding a line to the route table, and none
         * of the forty handlers had to be touched to make it work.
         *
         * Our own records, arriving back from another of our devices, are not
         * news to us.
         */
        // Not while restoring: a phone rebuilding its whole history would
        // otherwise open on every destination marked unread, with a hundred
        // lines of news about things that happened months ago.
        if (record.authorId !== state.activeUser && !msg.restoring) {
          // The dates go out again on every connection, so they are news only
          // when they change what this phone shows - judged against the
          // dates as they are before this record is applied below.
          if (record.type === OUR_DATES) {
            let incoming: ReturnType<typeof cleanOurDates> = null;
            try {
              incoming = cleanOurDates(JSON.parse(record.payload));
            } catch {
              incoming = null;
            }
            if (incoming) {
              const dates = incoming;
              const at = Number(record.clientTs) || Date.now();
              setState(prev => {
                const next = newerOurDates(dates, prev.ourDates);
                const changed =
                  !!next &&
                  ((next.togetherSince || '') !== (prev.ourDates?.togetherSince || '') ||
                    (next.anniversary || '') !== (prev.ourDates?.anniversary || ''));
                if (!changed) return prev;
                return {
                  ...prev,
                  activity: withActivity(prev.activity || [], { id: record.id, tabId: 'home', type: OUR_DATES, at })
                };
              });
            }
          }
          const route = routeFor(record.type);
          // Co-presence sends a status for every change and a goodbye on
          // leaving, and "it's not about you" is taken back as well as said:
          // for those, what the record says decides whether it is news.
          let payload: unknown = null;
          if (route && NEWS_READS_PAYLOAD.has(record.type)) {
            try {
              payload = JSON.parse(record.payload);
            } catch {
              payload = null;
            }
          }
          // A message's news is told where it is read: one set to show later
          // is no news until its time (core/sendLater).
          if (route && record.type !== 'CHAT' && isNews(record.type, payload)) {
            const at = Number(record.clientTs) || Date.now();
            setState(prev => ({
              ...prev,
              activity: withActivity(prev.activity || [], {
                id: record.id,
                tabId: route.tab,
                type: record.type,
                at
              })
            }));
          }
        }

        // A missed call gets a toast as well as its line on the home screen -
        // but only a fresh one. Replay delivers old records on every reconnect,
        // and a toast for a call from yesterday is a false alarm.
        if (
          record.type === CALL_MISSED &&
          record.authorId !== state.activeUser &&
          !isCamouflagedRef.current &&
          Date.now() - (Number(record.clientTs) || 0) < 2 * 60 * 1000
        ) {
          setInAppNotification({
            id: newId(),
            title: partnerNameRef.current || 'Partner',
            body: 'Tried to call you',
            type: 'chat',
            tabId: 'chat'
          });
        }

        try {
          const parsed = JSON.parse(record.payload);

          // Chores, expenses, journal, quotes, agreements, cycle: one reducer
          // for all of them, shared with the local network path below.
          if (SHARED_RECORD_TYPES.has(record.type)) {
            setState(
              prev =>
                applySharedRecord(prev, record.type, parsed, record.authorId, { addOnly: !!msg.catchUp }) ?? prev
            );
          }

          if (record.type === 'NAME_EXCHANGE') {
            const heard = readNameExchange(parsed);
            // Our own name, coming back from another of our devices or from a
            // restore, would otherwise be adopted as the partner's.
            if (record.authorId === state.activeUser) {
              const own = (userNameRef.current || '').trim();
              // Chosen in Settings on another device of ours, starting from a
              // name of ours (core/names): ours now too if it is newer - and,
              // newer or not, ours, never somebody else in our seat.
              if (heard?.setAt !== undefined && startedFromMine(heard, own, isOwnDeviceName)) {
                if (isRealName(heard.name) && takesOver(heard.setAt, latestRef.current.state.userNameSetAt)) {
                  if (isRealName(own) && own.toLowerCase() !== heard.name.toLowerCase()) rememberOwnDeviceName(own);
                  setState(prev =>
                    takesOver(heard.setAt, prev.userNameSetAt)
                      ? { ...prev, userName: heard.name, userNameSetAt: heard.setAt }
                      : prev
                  );
                  const ownSession = loadSpaceSession();
                  if (ownSession) saveSpaceSession({ ...ownSession, userName: heard.name });
                }
                return;
              }
              // Our name from before the change made here, from a device of
              // ours that has not heard of it: the relay never replays a
              // seat's own records to it, so it is told again, and follows.
              const ownAt = latestRef.current.state.userNameSetAt;
              if (
                heard &&
                ownAt !== undefined &&
                !msg.restoring &&
                heard.name.toLowerCase() !== own.toLowerCase() &&
                isOwnDeviceName(heard.name)
              ) {
                wsRelay.broadcastUpdate('NAME_EXCHANGE', nameExchange(own, ownAt));
                return;
              }
              // ...unless it is not our name. Another phone announcing a
              // different name from this phone's seat is the partner, set up
              // on the same side - which breaks catching up, calls and
              // presence without a word. Live only: a replay can carry this
              // phone's own name from before it was changed.
              const announced = typeof parsed.name === 'string' ? parsed.name.trim() : '';
              const mine = (userNameRef.current || '').trim();
              // Live means written moments ago and not part of a restore. The
              // replaying flag is too broad for this: it stays up through a
              // whole multi-page catch-up, and the other phone's one reply
              // would be lost inside it.
              const live =
                !msg.restoring && Date.now() - (Number(record.clientTs) || 0) < 2 * 60 * 1000;
              // Placeholders ('You', 'Partner') say nothing about who is
              // holding the phone, and a name this phone was told is its owner
              // on another device is not a clash.
              if (
                live &&
                isRealName(announced) &&
                isRealName(mine) &&
                announced.toLowerCase() !== mine.toLowerCase() &&
                !isOwnDeviceName(announced)
              ) {
                setRoleClash({ name: announced });
                clashNameRef.current = announced;
                if (!clashAnnouncedRef.current) {
                  clashAnnouncedRef.current = true;
                  wsRelay.broadcastUpdate('NAME_EXCHANGE', nameExchange(mine, latestRef.current.state.userNameSetAt));
                }
              }
              return;
            }
            if (heard) {
              // The phone we were asking about, now heard from the other seat:
              // it has moved, and there is nothing left to ask.
              const heardName = heard.name.toLowerCase();
              setRoleClash(prev => (prev && prev.name.trim().toLowerCase() === heardName ? null : prev));
              if (clashNameRef.current && clashNameRef.current.trim().toLowerCase() === heardName) {
                clashNameRef.current = null;
                clashAnnouncedRef.current = false;
                wsRelay.catchUpAfterClash();
              }
              // The newest name they chose (core/names): not an older one from
              // a device of theirs that has not heard of the change yet. And a
              // changed one only if it started from the name we know them by -
              // from somebody else's phone sitting in their seat it counts for
              // no more than a name never changed.
              const known = (latestRef.current.state.partnerName || '').trim();
              const chosenAt =
                heard.setAt !== undefined && (!isRealName(known) || startedFromMine(heard, known, () => false))
                  ? heard.setAt
                  : undefined;
              if (!takesOver(chosenAt, latestRef.current.state.partnerNameSetAt)) return;
              setState(prev =>
                takesOver(chosenAt, prev.partnerNameSetAt)
                  ? { ...prev, partnerName: heard.name, partnerNameSetAt: chosenAt ?? prev.partnerNameSetAt }
                  : prev
              );
              const currentSession = loadSpaceSession();
              if (currentSession) {
                saveSpaceSession({ ...currentSession, partnerName: heard.name });
              }
            }
          } else if (record.type === 'CHAT') {
            // Not a message at all; there is nothing to keep.
            if (!parsed || typeof parsed !== 'object') return;
            // A voice note's recording checked, `heard` dropped (chatFromWire).
            const wire = chatFromWire(parsed);
            // A reply to one held here waits with it (core/sendLater).
            const theirs = record.authorId !== state.activeUser;
            const withHeldOne = theirs ? waitsWith(wire, latestRef.current.state.heldMessages) : undefined;
            const incoming = withHeldOne === undefined ? wire : { ...wire, showAt: withHeldOne };
            // Set to show later, and not yet time: kept out of sight - no
            // chime, toast or news - until it is (core/sendLater).
            const held = theirs && (withHeldOne !== undefined || isHeld(incoming, state.activeUser));
            setState(prev => {
              // Arriving twice must not mean appearing twice.
              //
              // Until now the only thing standing between a replay and a
              // duplicated conversation was the resume cursor, because the
              // applied-id set the relay client keeps lives in memory and is
              // gone after a reload. That was survivable while the cursor only
              // ever moved forward, and is not something to keep resting on.
              if (prev.messages.some(m => m.id === incoming.id)) return prev;
              if (prev.heldMessages?.some(m => m.id === incoming.id)) return prev;
              if (held) return { ...prev, heldMessages: withHeld(prev.heldMessages, incoming) };

              // A copy of our own message that came back through the relay was,
              // by definition, delivered - the relay had to store it to send
              // it. The sender stamps `delivered: false` into the payload and
              // only its own socket ever hears the acknowledgement, so a second
              // device on the same role used to show everything typed on the
              // first one as forever sending.
              // Your own view-once photo, back from the relay, keeps no picture.
              const copy =
                incoming.delivered === false || incoming.viewOnce ? deliveredCopy(incoming, prev.activeUser) : incoming;
              // When it arrived here, for the unread count (core/unread) - not
              // for a phone being set up again, whose history is not news.
              // A catch-up after a seat change is news: those messages were
              // never on this phone.
              const applied =
                record.authorId !== prev.activeUser && !(msg.restoring && !msg.catchUp)
                  ? { ...copy, receivedAt: Date.now() }
                  : copy;
              return {
                ...prev,
                messages: insertBySentAt(prev.messages, applied).slice(-MAX_CHAT_MESSAGES)
              };
            });
            if (!held) {
              // News on Home and the chat tab - not for a phone being restored,
              // as for every other kind of record above. Named by the message,
              // so one withdrawn before its time can take its line with it.
              if (record.authorId !== state.activeUser && !msg.restoring) {
                const at = Number(record.clientTs) || Date.now();
                setState(prev => ({
                  ...prev,
                  activity: withActivity(prev.activity || [], { id: incoming.id, tabId: 'chat', type: 'CHAT', at })
                }));
              }
              if (record.authorId !== state.activeUser && !msg.replay) announceMessage(parsed.text);
            }
          } else if (record.type === COMING_UP) {
            setState(prev => {
              const comingUp = mergeDays(prev.comingUp, parsed?.days);
              return comingUp === prev.comingUp ? prev : { ...prev, comingUp };
            });
          } else if (record.type === STATUS_SET) {
            // Yours as well as theirs: from your other phone, or a restore.
            // Each phone says its own again on connecting, so one may be here already.
            const isNew = applyStatus(latestRef.current.state.statuses, record.authorId, parsed) !== null;
            setState(prev => {
              const statuses = applyStatus(prev.statuses, record.authorId, parsed);
              return statuses ? { ...prev, statuses } : prev;
            });
            // Theirs, set just now while Two is open: a word at the top too.
            const status = cleanStatus(parsed);
            if (
              isNew &&
              status?.text &&
              record.authorId !== state.activeUser &&
              !msg.replay &&
              !isCamouflagedRef.current &&
              Math.abs(Date.now() - status.setAt) < 2 * 60 * 1000
            ) {
              setInAppNotification({
                id: newId(),
                title: partnerNameRef.current || 'Partner',
                body: statusWords(status),
                type: 'general',
                // Its Reply opens the chat, where an answer to it is written.
                tabId: 'chat'
              });
            }
          } else if (record.type === CALL_LOG) {
            const info = readCallLog(parsed);
            if (info) addCallLine(info);
          } else if (record.type === CALL_MISSED) {
            // All a phone on an older version says about a call that rang out
            // unanswered. A newer phone sends CALL_LOG as well, which merges
            // into the same line.
            const callId = typeof parsed?.callId === 'string' ? parsed.callId : '';
            const at = Number(parsed?.at) || Number(record.clientTs) || 0;
            const caller = record.authorId === 'user' || record.authorId === 'partner' ? record.authorId : null;
            // It says when the ringing stopped, not when it began - a guess
            // the caller's own CALL_LOG, if one comes, puts right.
            const info = readCallLog({ callId, caller, startedAt: at, seconds: 0, outcome: 'missed' });
            if (info) addCallLine({ ...info, estimated: true });
          } else if (record.type === 'WEATHER') {
            // Checked, and with the days its author has had lately. An update
            // from an older phone carries no days, so it counts for the day it
            // was sent (core/weatherHistory).
            //
            // It goes to the report of the seat that sent it: userReport is the
            // creator's seat, not "you". Choosing by "not my own seat" put the
            // creator's weather into the partner's own report on the partner's
            // phone - their card showed the other person's weather as theirs.
            if (record.authorId !== 'user' && record.authorId !== 'partner') return;
            const sentAt = Number(record.clientTs);
            const day = sentAt > 0 ? localDateKey(new Date(sentAt)) : msg.replay ? null : localDateKey();
            setState(prev =>
              record.authorId === 'user'
                ? { ...prev, userReport: mergeReport(prev.userReport, parsed, day) }
                : { ...prev, partnerReport: mergeReport(prev.partnerReport, parsed, day) }
            );
          } else if (record.type === 'NOT_ABOUT_YOU') {
            // The sender's seat's report, as for WEATHER: chosen by "not my own
            // seat", the creator's flag landed on the partner's own report on
            // the partner's phone, so they never saw it was not about them.
            if (record.authorId !== 'user' && record.authorId !== 'partner') return;
            const active = parsed?.active === true;
            setState(prev =>
              record.authorId === 'user'
                ? { ...prev, userReport: { ...prev.userReport, notAboutYouActive: active } }
                : { ...prev, partnerReport: { ...prev.partnerReport, notAboutYouActive: active } }
            );
          } else if (record.type === 'LIST_ITEM') {
            setState(prev => ({
              ...prev,
              lists: addOnce(prev.lists, parsed)
            }));
          } else if (record.type === 'LOVE_LETTER') {
            // The day it opens on, kept only if it is one (core/letters).
            const letter = cleanLetter(parsed);
            if (!letter) return;
            setState(prev =>
              // Add-only during a catch-up: see CATCH_UP_TYPES.
              msg.catchUp && prev.letters.some(l => l.id === letter.id)
                ? prev
                : {
                    ...prev,
                    letters: [letter, ...prev.letters.filter(l => l.id !== letter.id)]
                  }
            );
            const isFromPartner = record.authorId !== state.activeUser && !msg.replay;
            if (isFromPartner) {
              playLetterChime();
              triggerHaptic([45, 55, 45]);
              if (currentTabRef.current !== 'letters') {
                setInAppNotification({
                  id: newId(),
                  title: `${partnerNameRef.current || 'Partner'} sent a Love Letter`,
                  body: letterNotice(letter, 'A new sealed letter awaits in your Sanctuary'),
                  type: 'letter',
                  tabId: 'letters'
                });
              }
            }
          } else if (record.type === 'RITUAL_COMPLETE') {
            // From a phone still on the previous version, which sent this for
            // every tap - ticking and un-ticking alike - with no day and no
            // "done". All it can honestly be read as is done, on the day it
            // was sent (not today: a restore replays months of these).
            //
            // A phone on this version sends one too, beside the RITUAL_SET
            // that carries the real change, so the previous version still
            // hears about ticks. That copy has a date, and is left to the
            // RITUAL_SET.
            const seat = parsed.activeUser === 'user' || parsed.activeUser === 'partner' ? parsed.activeUser : record.authorId;
            if (typeof parsed.date !== 'string' && typeof parsed.ritualId === 'string' && (seat === 'user' || seat === 'partner')) {
              const day = localDay(Number(record.clientTs) || Date.now());
              setState(prev => {
                const rituals = withRitualDay(prev.rituals, parsed.ritualId, seat, day, true);
                return rituals ? { ...prev, rituals } : prev;
              });
            }
          } else if (record.type === 'DEVICE_HELLO') {
            const id = String(parsed.deviceId || '');
            if (id && id !== getDeviceId()) {
              setState(prev => {
                if (prev.knownDevices.some(d => d.id === id)) return prev;
                return {
                  ...prev,
                  knownDevices: [
                    ...prev.knownDevices,
                    {
                      id,
                      label: String(parsed.label || 'Unknown device'),
                      firstSeenAt: Date.now(),
                      // The first device to answer is the partner you just
                      // paired with; anything after that deserves a question.
                      approved: prev.knownDevices.length === 0
                    }
                  ]
                };
              });
            }
          } else if (record.type === 'READ_RECEIPT') {
            const upTo = Number(parsed.upTo) || 0;
            // Our own laptop shares this role; its receipt must not mark our
            // messages as read by the partner. What it says is that we have
            // read this far there - so it is not news here either.
            if (record.authorId === state.activeUser) {
              if (upTo > 0) {
                setState(prev => {
                  const chatReadAt = readAtForReceipt(prev.messages, prev.activeUser, upTo, prev.chatReadAt);
                  return chatReadAt === (prev.chatReadAt ?? 0) ? prev : { ...prev, chatReadAt };
                });
              }
              return;
            }
            setState(prev => ({
              ...prev,
              partnerReadAt: Math.max(prev.partnerReadAt || 0, upTo)
            }));
          } else if (record.type === VOICE_HEARD) {
            // The partner has played one of this phone's voice notes. Like a
            // read receipt, only the partner's say so counts - not one of our
            // own devices - and only about a note this phone wrote. An id it
            // does not hold (a note since dropped, or not yet arrived) is
            // passed over; marking twice changes nothing.
            if (record.authorId === state.activeUser) return;
            const heardId = typeof parsed?.messageId === 'string' ? parsed.messageId : '';
            if (!heardId) return;
            setState(prev => {
              let changed = false;
              const messages = prev.messages.map(m => {
                if (m.id !== heardId || m.authorId !== prev.activeUser || !m.isVoiceMemo || m.heard) return m;
                changed = true;
                return { ...m, heard: true };
              });
              return changed ? { ...prev, messages } : prev;
            });
          } else if (record.type === CHAT_EDIT || record.type === CHAT_UNSEND || record.type === CHAT_REACTION) {
            // A change to a message already here: new words, taking it back,
            // or a reaction. core/chatActions decides what each may do and
            // who may do it; one naming a message this phone does not hold
            // changes nothing.
            const apply =
              record.type === CHAT_EDIT ? applyEdit : record.type === CHAT_UNSEND ? applyUnsend : applyReaction;
            setState(prev => {
              // Taken back before it was due to show: gone, with no "unsent"
              // line for what was never seen (core/sendLater).
              if (record.type === CHAT_UNSEND) {
                const gone = withdrawn(prev, record.authorId, parsed?.messageId, Number(record.clientTs) || Date.now());
                if (gone) {
                  // It reached here after its time, so it had a line on Home.
                  const activity = newsWithout(prev.activity || [], parsed.messageId, gone.messages, record.authorId);
                  return { ...prev, ...gone, ...(activity ? { activity } : {}) };
                }
              }
              const messages = apply(prev.messages, record.authorId, parsed);
              // New words, a reaction, or taking it back after its time, for
              // one still held here - from a phone whose clock is ahead, where
              // it had already shown. Unsent, it shows as unsent straight away.
              const heldMessages = prev.heldMessages?.length ? apply(prev.heldMessages, record.authorId, parsed) : null;
              if (!messages && !heldMessages) return prev;
              return { ...prev, ...(messages ? { messages } : {}), ...(heldMessages ? { heldMessages } : {}) };
            });
          } else if (record.type === CHAT_PIN) {
            // Either of you pinning or unpinning a message (core/chatActions).
            // One still held here counts as here: its pin shows when it does.
            setState(prev => {
              const chatPins = applyPin(prev.chatPins, withHeldMessages(prev), record.authorId, parsed);
              return chatPins ? { ...prev, chatPins } : prev;
            });
          } else if (record.type === CHAT_VIEWED) {
            // A view-once photo opened by the person it was sent to - here, on
            // their other phone, or on yours as the one who sent it.
            setState(prev => {
              const messages = applyViewed(prev.messages, record.authorId, parsed);
              return messages ? { ...prev, messages } : prev;
            });
          } else if (record.type === APP_VERSION) {
            // Which version the partner runs, for the note on Home when
            // theirs is behind. Our own comes back to us on replay.
            if (record.authorId === state.activeUser) return;
            const code = Number(parsed?.code);
            if (!Number.isFinite(code) || code <= 0) return;
            const name = String(parsed?.name || code).slice(0, 32);
            // And what it can do; a phone on an older version says nothing.
            const can: string[] = Array.isArray(parsed?.can)
              ? parsed.can.filter((c: unknown): c is string => typeof c === 'string' && c.length <= 32).slice(0, 16)
              : [];
            setState(prev => {
              if (prev.partnerApp?.code === code && (prev.partnerApp.can || []).join() === can.join()) return prev;
              const partnerApp = { code, name, ...(can.length ? { can } : {}) };
              // Theirs has just changed - updated, most likely. What this phone
              // said about itself went to the version before, which may have
              // read past what it can do, so it says it once more. Not while
              // history is brought back to this phone, which says it anyway.
              return prev.partnerApp?.code === code || (msg.restoring && !msg.catchUp)
                ? { ...prev, partnerApp }
                : { ...prev, partnerApp, appVersionSent: undefined };
            });
          } else if (record.type === PRESENCE_BEAT) {
            // Only the partner's beats say anything; our own come back to us
            // on replay and would otherwise overwrite theirs with our time.
            if (record.authorId === state.activeUser) return;
            const at = Number(parsed.at) || 0;
            if (at > 0) {
              setState(prev => ({
                ...prev,
                partnerLastSeen: Math.max(prev.partnerLastSeen || 0, at)
              }));
            }
          } else if (record.type === 'VAULT_NAME') {
            setState(prev => ({ ...prev, vaultName: String(parsed.name || '') }));
          } else if (record.type === 'GRATITUDE_STAR') {
            setState(prev => ({
              ...prev,
              constellationStars: [parsed, ...prev.constellationStars.filter(s => s.id !== parsed.id)]
            }));
          } else if (record.type === 'CARE_COMPASS') {
            const author = parsed.authorId || record.authorId;
            const target = author === 'user' ? 'user' : 'partner';
            setState(prev => ({
              ...prev,
              careCompass: {
                ...prev.careCompass,
                [target]: parsed.profile
              }
            }));
          } else if (record.type === 'COMFORT_BOX') {
            // Filed under its author, whatever id it came with (core/comfortBox).
            setState(prev => ({ ...prev, comfortBoxes: withBox(prev.comfortBoxes, parsed) }));
          } else if (record.type === 'RECIPE_ADD') {
            setState(prev => ({
              ...prev,
              recipes: [parsed, ...prev.recipes.filter(r => r.id !== parsed.id)]
            }));
          } else if (record.type === 'INGREDIENT_TOGGLE') {
            setState(prev => ({ ...prev, recipes: applyIngredientTick(prev.recipes, parsed) }));
          } else if (record.type === 'INTUITION_ROUND') {
            setState(prev => ({
              ...prev,
              intuitionRounds: [parsed, ...prev.intuitionRounds.filter(r => r.id !== parsed.id)]
            }));
          } else if (record.type === 'ADVENTURE_UPDATE') {
            // The whole list travels each time, and a phone still on the
            // previous version still carries the borrowed sample ideas.
            setState(prev => ({
              ...prev,
              adventures: withoutSampleAdventures(parsed)
            }));
          } else if (record.type === 'TIME_CAPSULE_UPDATE') {
            setState(prev => ({
              ...prev,
              timeCapsules: parsed
            }));
          } else if (record.type === 'SCRATCH_CARD_UPDATE') {
            setState(prev => ({
              ...prev,
              scratchCards: parsed
            }));
          } else if (record.type === 'GARDEN_UPDATE') {
            setState(prev => ({
              ...prev,
              hearthGarden: parsed
            }));
          } else if (record.type === 'SOFT_LANDING_UPDATE') {
            setState(prev => ({
              ...prev,
              activeSoftLanding: parsed
            }));
          } else if (record.type === 'WHISPER_MEMO_UPDATE') {
            setState(prev => ({
              ...prev,
              whisperMemos: parsed
            }));
          } else if (record.type === 'NIGHTSTAND_UPDATE') {
            setState(prev => ({
              ...prev,
              nightstand: parsed
            }));
          } else if (record.type === 'NIGHTSTAND_KISS') {
            setState(prev => ({
              ...prev,
              nightstand: {
                ...prev.nightstand,
                lastMidnightKissAt: parsed.timestamp,
                lastMidnightKissFrom: parsed.from,
                lastMidnightKissNote: parsed.note
              }
            }));
            if ('vibrate' in navigator) {
              navigator.vibrate([100, 50, 100, 50, 200]);
            }
          } else if (record.type === 'COORDINATES_UPDATE') {
            setState(prev => ({
              ...prev,
              coordinatePins: parsed
            }));
          } else if (record.type === 'MIDNIGHT_RADIO_SYNC') {
            setState(prev => ({
              ...prev,
              midnightRadio: mergeIncomingRadio(prev.midnightRadio, parsed)
            }));
          } else if (record.type === 'MIDNIGHT_RADIO_WHISPER') {
            setState(prev => ({
              ...prev,
              midnightRadio: {
                ...prev.midnightRadio,
                whispers: addOnce(prev.midnightRadio.whispers, parsed)
              }
            }));
            if ('vibrate' in navigator) {
              navigator.vibrate([70, 40, 70]);
            }
          } else if (record.type === 'STATE_OF_UNION_UPDATE') {
            setState(prev => ({
              ...prev,
              activeStateOfUnion: parsed
            }));
          } else if (record.type === 'STATE_OF_UNION_SEAL') {
            setState(prev => ({
              ...prev,
              activeStateOfUnion: null,
              stateOfUnionHistory: addOnce(prev.stateOfUnionHistory, parsed)
            }));
          } else if (record.type === 'CANVAS_STROKE') {
            setState(prev => ({
              ...prev,
              sharedCanvas: {
                ...prev.sharedCanvas,
                strokes: addOnce(prev.sharedCanvas?.strokes, parsed, 'end'),
                lastUpdated: Date.now()
              }
            }));
          } else if (record.type === 'CANVAS_CLEAR') {
            setState(prev => ({
              ...prev,
              sharedCanvas: {
                ...prev.sharedCanvas,
                strokes: [],
                lastUpdated: Date.now()
              }
            }));
          } else if (record.type === 'CANVAS_UNDO') {
            setState(prev => ({
              ...prev,
              sharedCanvas: {
                ...prev.sharedCanvas,
                strokes: (prev.sharedCanvas?.strokes || []).slice(0, -1),
                lastUpdated: Date.now()
              }
            }));
          } else if (record.type === 'CANVAS_SAVE_SKETCH') {
            setState(prev => ({
              ...prev,
              sharedCanvas: {
                ...prev.sharedCanvas,
                savedSketches: addOnce(prev.sharedCanvas?.savedSketches, parsed)
              }
            }));
          } else if (record.type === 'REPAIR_BRIDGE_SEND') {
            setState(prev => ({
              ...prev,
              repairLetters: [parsed, ...prev.repairLetters.filter(l => l.id !== parsed.id)]
            }));
          } else if (record.type === 'REPAIR_BRIDGE_RESPOND') {
            setState(prev => ({
              ...prev,
              repairLetters: prev.repairLetters.map(l =>
                l.id === parsed.letterId
                  ? {
                      ...l,
                      status: parsed.status,
                      recipientResponseNote: parsed.note,
                      resolvedAt: parsed.status === 'accepted' ? Date.now() : l.resolvedAt
                    }
                  : l
              )
            }));
            if (parsed.status === 'accepted' && 'vibrate' in navigator) {
              navigator.vibrate([100, 50, 100, 50, 200]);
            }
          } else if (record.type === 'KINTSUGI_ADD') {
            setState(prev => ({
              ...prev,
              kintsugiMoments: [parsed, ...prev.kintsugiMoments.filter(m => m.id !== parsed.id)]
            }));
          } else if (record.type === 'KINTSUGI_CHERISH') {
            setState(prev => ({
              ...prev,
              kintsugiMoments: prev.kintsugiMoments.map(m =>
                m.id === parsed.momentId
                  ? {
                      ...m,
                      isCherished: true,
                      cherishedAt: Date.now(),
                      cherishedNote: parsed.note
                    }
                  : m
              )
            }));
            if ('vibrate' in navigator) {
              navigator.vibrate([60, 30, 60]);
            }
          }
        } catch (e) {
          console.error('[Relay Ingest Error]', e);
        }
      }
    });

    // Also listen to local offline mesh transport
    const unsubscribeMesh = localMesh.subscribe((packet) => {
      if (packet.type === 'LOCAL_MESH_PACKET' && packet.authorId !== state.activeUser) {
        if (SHARED_RECORD_TYPES.has(packet.subType)) {
          setState(prev => applySharedRecord(prev, packet.subType, packet.payload, packet.authorId) ?? prev);
        }
        const meshLetter = packet.subType === 'LOVE_LETTER' ? cleanLetter(packet.payload) : null;
        if (meshLetter) {
          setState(prev => ({
            ...prev,
            letters: [meshLetter, ...prev.letters.filter(l => l.id !== meshLetter.id)]
          }));
          playLetterChime();
          triggerHaptic([45, 55, 45]);
          if (currentTabRef.current !== 'letters') {
            setInAppNotification({
              id: newId(),
              title: `${partnerNameRef.current || 'Partner'} sent a Love Letter (Mesh)`,
              body: letterNotice(meshLetter, 'A sealed letter arrived offline'),
              type: 'letter',
              tabId: 'letters'
            });
          }
        } else if (packet.subType === 'GRATITUDE_STAR') {
          setState(prev => ({
            ...prev,
            constellationStars: [packet.payload, ...prev.constellationStars.filter(s => s.id !== packet.payload.id)]
          }));
        } else if (packet.subType === 'CARE_COMPASS') {
          const author = packet.payload.authorId || packet.authorId;
          const target = author === 'user' ? 'user' : 'partner';
          setState(prev => ({
            ...prev,
            careCompass: {
              ...prev.careCompass,
              [target]: packet.payload.profile
            }
          }));
        } else if (packet.subType === 'COMFORT_BOX') {
          setState(prev => ({ ...prev, comfortBoxes: withBox(prev.comfortBoxes, packet.payload) }));
        } else if (packet.subType === 'RECIPE_ADD') {
          setState(prev => ({
            ...prev,
            recipes: [packet.payload, ...prev.recipes.filter(r => r.id !== packet.payload.id)]
          }));
        } else if (packet.subType === 'INGREDIENT_TOGGLE') {
          setState(prev => ({ ...prev, recipes: applyIngredientTick(prev.recipes, packet.payload) }));
        } else if (packet.subType === 'INTUITION_ROUND') {
          setState(prev => ({
            ...prev,
            intuitionRounds: [packet.payload, ...prev.intuitionRounds.filter(r => r.id !== packet.payload.id)]
          }));
        } else if (packet.subType === 'ADVENTURE_UPDATE') {
          setState(prev => ({
            ...prev,
            adventures: withoutSampleAdventures(packet.payload)
          }));
        } else if (packet.subType === 'TIME_CAPSULE_UPDATE') {
          setState(prev => ({
            ...prev,
            timeCapsules: packet.payload
          }));
        } else if (packet.subType === 'SCRATCH_CARD_UPDATE') {
          setState(prev => ({
            ...prev,
            scratchCards: packet.payload
          }));
        } else if (packet.subType === 'GARDEN_UPDATE') {
          setState(prev => ({
            ...prev,
            hearthGarden: packet.payload
          }));
        } else if (packet.subType === 'SOFT_LANDING_UPDATE') {
          setState(prev => ({
            ...prev,
            activeSoftLanding: packet.payload
          }));
        } else if (packet.subType === 'WHISPER_MEMO_UPDATE') {
          setState(prev => ({
            ...prev,
            whisperMemos: packet.payload
          }));
        } else if (packet.subType === 'NIGHTSTAND_UPDATE') {
          setState(prev => ({
            ...prev,
            nightstand: packet.payload
          }));
        } else if (packet.subType === 'NIGHTSTAND_KISS') {
          setState(prev => ({
            ...prev,
            nightstand: {
              ...prev.nightstand,
              lastMidnightKissAt: packet.payload.timestamp,
              lastMidnightKissFrom: packet.payload.from,
              lastMidnightKissNote: packet.payload.note
            }
          }));
          if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100, 50, 200]);
          }
        } else if (packet.subType === 'COORDINATES_UPDATE') {
          setState(prev => ({
            ...prev,
            coordinatePins: packet.payload
          }));
        } else if (packet.subType === 'MIDNIGHT_RADIO_SYNC') {
          setState(prev => ({
            ...prev,
            midnightRadio: mergeIncomingRadio(prev.midnightRadio, packet.payload)
          }));
        } else if (packet.subType === 'MIDNIGHT_RADIO_WHISPER') {
          setState(prev => ({
            ...prev,
            midnightRadio: {
              ...prev.midnightRadio,
              whispers: [packet.payload, ...(prev.midnightRadio.whispers || [])]
            }
          }));
          if ('vibrate' in navigator) {
            navigator.vibrate([70, 40, 70]);
          }
        } else if (packet.subType === 'STATE_OF_UNION_UPDATE') {
          setState(prev => ({
            ...prev,
            activeStateOfUnion: packet.payload
          }));
        } else if (packet.subType === 'STATE_OF_UNION_SEAL') {
          setState(prev => ({
            ...prev,
            activeStateOfUnion: null,
            stateOfUnionHistory: [packet.payload, ...prev.stateOfUnionHistory]
          }));
        } else if (packet.subType === 'CANVAS_STROKE') {
          setState(prev => ({
            ...prev,
            sharedCanvas: {
              ...prev.sharedCanvas,
              strokes: [...prev.sharedCanvas.strokes, packet.payload],
              lastUpdated: Date.now()
            }
          }));
        } else if (packet.subType === 'CANVAS_CLEAR') {
          setState(prev => ({
            ...prev,
            sharedCanvas: {
              ...prev.sharedCanvas,
              strokes: [],
              lastUpdated: Date.now()
            }
          }));
        } else if (packet.subType === 'CANVAS_UNDO') {
          setState(prev => ({
            ...prev,
            sharedCanvas: {
              ...prev.sharedCanvas,
              strokes: prev.sharedCanvas.strokes.slice(0, -1),
              lastUpdated: Date.now()
            }
          }));
        } else if (packet.subType === 'CANVAS_SAVE_SKETCH') {
          setState(prev => ({
            ...prev,
            sharedCanvas: {
              ...prev.sharedCanvas,
              savedSketches: [packet.payload, ...(prev.sharedCanvas.savedSketches || [])]
            }
          }));
        } else if (packet.subType === 'REPAIR_BRIDGE_SEND') {
          setState(prev => ({
            ...prev,
            repairLetters: [packet.payload, ...prev.repairLetters.filter(l => l.id !== packet.payload.id)]
          }));
        } else if (packet.subType === 'REPAIR_BRIDGE_RESPOND') {
          setState(prev => ({
            ...prev,
            repairLetters: prev.repairLetters.map(l =>
              l.id === packet.payload.letterId
                ? {
                    ...l,
                    status: packet.payload.status,
                    recipientResponseNote: packet.payload.note,
                    resolvedAt: packet.payload.status === 'accepted' ? Date.now() : l.resolvedAt
                  }
                : l
            )
          }));
          if (packet.payload.status === 'accepted' && 'vibrate' in navigator) {
            navigator.vibrate([100, 50, 100, 50, 200]);
          }
        } else if (packet.subType === 'KINTSUGI_ADD') {
          setState(prev => ({
            ...prev,
            kintsugiMoments: [packet.payload, ...prev.kintsugiMoments.filter(m => m.id !== packet.payload.id)]
          }));
        } else if (packet.subType === 'KINTSUGI_CHERISH') {
          setState(prev => ({
            ...prev,
            kintsugiMoments: prev.kintsugiMoments.map(m =>
              m.id === packet.payload.momentId
                ? {
                    ...m,
                    isCherished: true,
                    cherishedAt: Date.now(),
                    cherishedNote: packet.payload.note
                  }
                : m
            )
          }));
          if ('vibrate' in navigator) {
            navigator.vibrate([60, 30, 60]);
          }
        }
      }
    });

    return () => {
      unsubscribe();
      unsubscribeMesh();
    };
  }, [state.activeUser]);

  /** The vault write under way, if any: a lock waits for it (see lockSafely). */
  const vaultWriteRef = useRef<Promise<unknown>>(Promise.resolve());
  /** The latest state and session, for a save that cannot wait for the next render. */
  const latestRef = useRef({ state, session, vaultKey });
  latestRef.current = { state, session, vaultKey };

  useEffect(() => {
    if (isLocked) return; // nothing meaningful to persist before unlock

    if (vaultKey) {
      // forStorage rather than pruneForStorage: media has to be moved out here
      // too, and encrypted with the vault key on its way, so a space with a PIN
      // does not end up with its photos sitting in the clear.
      vaultWriteRef.current = writeVault(vaultKey, { state: forStorage(state, vaultKey), session }).then(ok =>
        setStorageFull(!ok)
      );
    } else {
      setStorageFull(saveState(state).quotaExceeded);
    }
  }, [state, session, vaultKey, isLocked]);

  /**
   * Puts this phone in the given seat of the space.
   *
   * The seat lives in two places that must agree: the session, which the relay
   * connection is made from, and activeUser, which decides what on screen is
   * "you". This used to read the session back from plain storage - which is
   * empty whenever a PIN is set, because the session then lives inside the
   * encrypted vault. With a PIN, switching changed the screen and not the
   * connection, so the phone went on talking from the old seat while showing
   * its own messages as the partner's. The session held in memory is the one
   * that is current either way, and the vault is rewritten from it.
   */
  const setDeviceRole = (nextRole: SpaceRole) => {
    setRoleClash(null);
    clashAnnouncedRef.current = false;
    // Moving seat fetches the hidden history itself (ws.takeNewSeat).
    clashNameRef.current = null;
    if (state.activeUser === nextRole && session?.role === nextRole) return;
    setState(prev => ({ ...prev, activeUser: nextRole }));
    if (session) {
      const updated: SpaceSession = { ...session, role: nextRole };
      setSession(updated);
      if (!vaultKey) saveSpaceSession(updated);
    }
    setSpaceVersion(v => v + 1);
  };

  const toggleActiveUser = () => setDeviceRole(state.activeUser === 'user' ? 'partner' : 'user');

  /** The answer to RoleClashDialog. */
  const handleRoleClashAnswer = (role: SpaceRole) => {
    const otherName = roleClash?.name || 'Your partner';
    if (role === state.activeUser) {
      // This phone was right; the other one has to move, and it is asking the
      // same question. Free to answer it once more if it announces again.
      setRoleClash(null);
      clashAnnouncedRef.current = false;
      setInAppNotification({
        id: newId(),
        title: 'Then the other phone needs to change',
        body: `${otherName}'s phone is asking the same question - they should answer that ${otherName} joined with your code.`,
        type: 'general',
        tabId: currentTabRef.current || 'home'
      });
      return;
    }
    setDeviceRole(role);
  };

  /** "That's me, on another device": not a clash, and never asked about again. */
  const handleRoleClashSamePerson = () => {
    if (roleClash) rememberOwnDeviceName(roleClash.name);
    setRoleClash(null);
    clashAnnouncedRef.current = false;
    clashNameRef.current = null;
  };

  /**
   * Tells the partner how far we have read.
   *
   * Sends one watermark rather than a receipt per message, and stays quiet when
   * nothing new has arrived, so opening the chat repeatedly does not fill the
   * relay with duplicates.
   */
  const lastSentReceiptRef = useRef(0);
  const sendReadReceipt = () => {
    // Read means looked at. A phone locked with the chat as its last screen
    // keeps its connection (the radio holds the app awake), and without this
    // every message that landed in the pocket was ticked read on arrival.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    // Their real messages only: a call's line can carry this phone's clock.
    const newest = newestFrom(state.messages, state.activeUser === 'user' ? 'partner' : 'user');
    if (!newest || newest <= lastSentReceiptRef.current) return;
    // Off means nothing leaves this device - the setting is the send, not a
    // request that the other end politely declines to display.
    if (!readShareReceipts()) return;
    lastSentReceiptRef.current = newest;
    wsRelay.broadcastUpdate('READ_RECEIPT', { upTo: newest });
  };

  /**
   * Whether this page is actually on screen.
   *
   * Kept as state so read receipts can wait for it: whatever arrived while the
   * phone was locked or the app was behind another is read when it is looked
   * at again, not when it landed.
   */
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible'
  );
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  /** The vault is open: everything it held goes into the app. */
  const finishUnlock = (opened: NonNullable<Awaited<ReturnType<typeof unlockVault>>>) => {
    clearFailures();
    setLockoutLeft(0);
    // The vault carries the same references localStorage does.
    setMediaReady(!containsMediaRefs(opened.payload.state));
    // Upgraded like a localStorage load is: new fields filled in, and
    // the old sample content taken out.
    setState(upgradeState(opened.payload.state));
    setSession(opened.payload.session);
    setVaultKey(opened.key);
    // A PIN set under an older build left the code behind in plain
    // storage, under a key nothing else would ever remove.
    forgetLastSpace();
    setIsLocked(false);
    setPinAttempt('');
    setPassphraseAttempt('');
    setFingerprintNote(null);
    setSpaceVersion(v => v + 1);
  };

  /**
   * Fingerprint unlock (core/fingerprint.ts).
   *
   * The lock screen asks by itself when it comes up, and again when the app
   * comes back to the front still locked - never behind the calculator, whose
   * disguise a prompt saying "Open Two" would give away. "Use PIN" on the
   * prompt is an answer, so it is not asked again until the app has really
   * been away; a page that flickers hidden while the prompt is up has not.
   *
   * A fingerprint is allowed through a wrong-PIN wait. The wait is there to
   * slow down someone guessing PINs, and a matching finger is not a guess.
   */
  const [fingerprintOn, setFingerprintOn] = useState(false);
  const [fingerprintNote, setFingerprintNote] = useState<string | null>(null);
  const fingerprintAskedRef = useRef(false);
  const fingerprintBusyRef = useRef(false);

  const askFingerprint = async () => {
    if (fingerprintBusyRef.current) return;
    fingerprintBusyRef.current = true;
    setFingerprintNote(null);
    try {
      const result = await unlockWithFingerprint();
      if (result.ok) {
        if (!result.pin) return;
        setIsUnlocking(true);
        const opened = await unlockVault(result.pin);
        setIsUnlocking(false);
        if (opened) {
          finishUnlock(opened);
          return;
        }
        // The PIN the phone kept no longer opens the vault.
        disableFingerprint();
        setFingerprintOn(false);
        setFingerprintNote('Fingerprint unlock switched off because the PIN changed. Enter your PIN.');
        return;
      }
      if (result.reason === 'changed') {
        setFingerprintOn(false);
        setFingerprintNote(FINGERPRINT_CHANGED_NOTE);
      } else if (result.reason === 'lockout') {
        setFingerprintNote('Too many tries, so the fingerprint is paused for now. Use your PIN.');
      } else if (result.reason !== 'cancel') {
        setFingerprintOn(fingerprintStatus() === 'on');
      }
    } finally {
      fingerprintBusyRef.current = false;
    }
  };

  useEffect(() => {
    if (!isLocked) {
      fingerprintAskedRef.current = false;
      return;
    }
    if (!pageVisible) {
      if (!fingerprintBusyRef.current) fingerprintAskedRef.current = false;
      return;
    }
    if (isCamouflaged || fingerprintAskedRef.current) return;
    fingerprintAskedRef.current = true;
    const status = fingerprintStatus();
    setFingerprintOn(status === 'on');
    if (status === 'changed') setFingerprintNote(FINGERPRINT_CHANGED_NOTE);
    if (status === 'on') void askFingerprint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, pageVisible, isCamouflaged]);

  // Opening the chat is not the only way to read something: a message arriving
  // while the chat is already open has also been seen - when the chat is what
  // is really in front of you, and not a group, the lock screen or the
  // calculator. Coming back to it counts as opening it.
  const chatOnScreen =
    pageVisible && currentTab === 'chat' && !activeGroupId && !isLocked && !isCamouflaged;
  // Watched by when the newest message arrived, not by how many there are:
  // at the 5,000-message cap the count stops changing as new ones arrive.
  const latestArrival = useMemo(() => newestArrival(state.messages), [state.messages]);
  useEffect(() => {
    if (!chatOnScreen) return;
    // Everything that has arrived has now been in front of you.
    setState(prev =>
      countUnread(prev.messages, prev.activeUser, prev.chatReadAt) > 0 ? { ...prev, chatReadAt: Date.now() } : prev
    );
    sendReadReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestArrival, state.messages.length, chatOnScreen]);

  /**
   * When you had last looked as the chat came in front of you - where its
   * "New messages" line goes - and a count of the times it has, so the chat
   * can take a fresh look each time. Taken in the render where it comes in
   * front, before looking at it marks everything read: the chat screen loads
   * on demand, and coming back from the lock screen, the calculator, a group
   * or another app all bring it in front again without leaving the tab.
   */
  const chatEntryRef = useRef<{ shown: boolean; readAt?: number; key: number }>({ shown: false, key: 0 });
  if (chatOnScreen && !chatEntryRef.current.shown) {
    chatEntryRef.current = { shown: true, readAt: state.chatReadAt, key: chatEntryRef.current.key + 1 };
  } else if (!chatOnScreen && chatEntryRef.current.shown) {
    chatEntryRef.current = { ...chatEntryRef.current, shown: false };
  }

  /**
   * Messages set to show later wait in a list of their own (core/sendLater)
   * and go into the conversation when their time comes, as if they had just
   * arrived: counted as new, and news on Home. One that comes due while Two
   * is open gets the chime and toast too; one whose time came while Two was
   * closed or locked simply appears, counted, the next time it is open.
   */
  const [heldWake, setHeldWake] = useState(0);
  useEffect(() => {
    // The soonest; one unsent while held keeps no time, and is due now.
    const held = state.heldMessages;
    const next = held?.length ? Math.min(...held.map(m => m.showAt ?? 0)) : undefined;
    if (isLocked || next === undefined) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      const { due } = dueNow(latestRef.current.state.heldMessages, now);
      // Further off than one timer can wait: wait again.
      if (!due.length) return setHeldWake(n => n + 1);
      setState(prev => {
        const { due: ready, waiting } = dueNow(prev.heldMessages, now);
        if (!ready.length) return prev;
        let messages = prev.messages;
        let activity = prev.activity || [];
        for (const m of ready) {
          if (messages.some(x => x.id === m.id)) continue;
          // Taken back while held: its "unsent" line, and no news.
          if (m.unsent) {
            messages = insertBySentAt(messages, m);
            continue;
          }
          messages = insertBySentAt(messages, { ...m, receivedAt: now });
          activity = withActivity(activity, { id: m.id, tabId: 'chat', type: 'CHAT', at: m.showAt ?? now });
        }
        return { ...prev, messages: messages.slice(-MAX_CHAT_MESSAGES), heldMessages: waiting, activity };
      });
      // Told only when it has just come due - the newest, if several did.
      const fresh = due.filter(m => !m.unsent && now - (m.showAt ?? 0) < 60 * 1000);
      if (fresh.length) announceMessage(fresh[fresh.length - 1].text);
    }, Math.min(Math.max(0, next - Date.now()), 2 ** 31 - 1));
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.heldMessages, isLocked, pageVisible, heldWake]);

  /**
   * Keeps a half-typed message, or (with null) forgets it. Called when the
   * chat is left or put away, never per key press: each change of state
   * re-encrypts the whole vault.
   *
   * With a PIN it is also written straight away rather than on the next
   * render: putting the phone down can lock Two within the same moment
   * (auto-lock "Immediately"), and the lock waits for this write.
   */
  const handleSaveDraft = (key: string, draft: ChatDraft | null) => {
    const withDraft = (prev: SpaceState): SpaceState => {
      // A group left meanwhile keeps no draft.
      if (key !== 'couple' && !prev.groups.some(g => g.id === key)) return prev;
      const current = prev.chatDrafts?.[key];
      if (!draft && !current) return prev;
      if (draft && current && current.text === draft.text && current.replyTo?.id === draft.replyTo?.id) return prev;
      const chatDrafts = { ...(prev.chatDrafts || {}) };
      if (draft) chatDrafts[key] = draft;
      else delete chatDrafts[key];
      return { ...prev, chatDrafts };
    };
    const latest = latestRef.current;
    const next = withDraft(latest.state);
    if (next !== latest.state && latest.vaultKey && !isLocked) {
      vaultWriteRef.current = writeVault(latest.vaultKey, { state: forStorage(next, latest.vaultKey), session: latest.session });
    }
    setState(withDraft);
  };

  /**
   * Locks, once everything is saved: each screen is asked to put down what it
   * has not (BEFORE_LOCK_EVENT), and the reload waits for the vault write.
   */
  const lockSafely = () => {
    window.dispatchEvent(new Event(BEFORE_LOCK_EVENT));
    void vaultWriteRef.current.finally(() => lockNow());
  };

  /**
   * Publishes the real height of everything above the main column.
   *
   * The chat used to size itself with calc(100dvh - 11rem): a guess at how much
   * chrome sits above it, in a unit that is wrong on phones. The guess was
   * already approximate, and it is now wrong in a second way, because the dock
   * is absent on this screen.
   *
   * The measured region covers the header AND the banners that can appear under
   * it - an unrecognised device, a weak link code, storage being full. Each
   * comes and goes at runtime, and measuring only the header left the chat
   * overhanging the bottom of the screen by exactly their height whenever one
   * was showing.
   */
  const headerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Colours the boxes on each screen, the first in its tab's own colour
   * (core/boxHues). The screen's wrapper is made anew for every tab - it is
   * keyed by the tab - so this ref sees each screen arrive and leave. The chat
   * has no boxes and changes with every message, so it is not watched.
   */
  const stopBoxes = useRef<(() => void) | null>(null);
  const screenRef = useCallback((el: HTMLDivElement | null) => {
    stopBoxes.current?.();
    stopBoxes.current = null;
    const tab = el?.dataset.tab;
    if (el && tab && tab !== 'chat') stopBoxes.current = watchBoxes(el, firstHue(tab));
  }, []);

  /**
   * Publishes the real height of everything above the main column.
   *
   * The chat used to size itself with calc(100dvh - 11rem): a guess at how much
   * chrome sits above it, in a unit that is wrong on phones. It was approximate
   * to begin with, and wrong in a second way once the dock stopped appearing on
   * that screen.
   *
   * The measured region is the header AND the banners under it - an
   * unrecognised device, a weak link code, storage full. Each appears and
   * disappears at runtime, and measuring only the header left the chat hanging
   * off the bottom of the screen by exactly their height while one showed.
   *
   * Measured after every render rather than through a ResizeObserver: every one
   * of those banners is driven by state, so a render is precisely when the
   * height can have changed, and there is no observer lifetime to get wrong.
   * The cost is one getBoundingClientRect against one element.
   */
  const publishedHeaderRef = useRef('');
  const publishChromeHeight = () => {
    const el = headerRef.current;
    // No header on screen means no header height. Group mode renders none, and
    // leaving the sanctuary's last measurement in place reserved 45px of room
    // for a bar that was not there - which is why the group composer sat high
    // above its dock with a band of empty surface beneath it.
    const height = el ? `${Math.round(el.getBoundingClientRect().height)}px` : '0px';
    // Written only when it changed: a property on <html> restyles every
    // element that reads it, and this runs after every render.
    if (height === publishedHeaderRef.current) return;
    publishedHeaderRef.current = height;
    document.documentElement.style.setProperty('--two-header-h', height);
  };

  useLayoutEffect(publishChromeHeight);

  // Rotation, window resizing, and the keyboard opening in the app - none of
  // which re-render anything on their own.
  useEffect(() => {
    const onResize = () => publishChromeHeight();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Ticks the lock-out countdown down to zero.
   *
   * Only runs while a wait is actually in progress - there is nothing to
   * animate on a lock screen that will accept a PIN right now.
   */
  useEffect(() => {
    if (!isLocked || lockoutLeft <= 0) return;

    const refresh = () => setLockoutLeft(lockoutRemaining());
    const timer = setInterval(refresh, 1000);

    // A hidden tab has its timers throttled to roughly once a minute, so a
    // wait that ended while the app was in the background would still show as
    // running - keypad greyed out, countdown frozen - until the next tick
    // happened to fire. Recomputing on the way back in fixes the display from
    // the clock rather than from however many ticks were allowed to run.
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [isLocked, lockoutLeft]);

  /**
   * Shuts the app again when it has been left.
   *
   * Only meaningful once there is a vault: with no PIN set there is nothing to
   * lock back to, and reloading an unprotected app would just be a stutter.
   */
  useEffect(() => {
    return watchForAbsence({
      // Not during a call: locking reloads the app, which would hang up
      // on somebody who only switched apps to look something up.
      enabled: () => !!vaultKey && !isLocked && !callEngineRef.current?.busy,
      getSetting: () => readAutoLock(),
      onLock: () => lockSafely(),
      // Nor while live radio plays: listening with the screen off is the
      // point of it. The lock's countdown starts when the radio stops.
      hold: liveRadioHold
    });
  }, [vaultKey, isLocked]);

  /**
   * Tells the other device this one is awake.
   *
   * Sent on connecting, whenever the app comes back to the foreground, and
   * every couple of minutes in between - but only while actually visible, so
   * a phone in a pocket does not report itself as being read.
   *
   * Nothing is sent at all when sharing is off. That is the whole of the
   * privacy control: with no beat there is no timestamp, on the relay or on
   * the partner's device.
   */
  // Tells the partner's phone which version this one runs, once per version.
  useEffect(() => {
    if (relayStatus !== 'connected' || isLocked || !session) return;
    const mine = appVersion();
    const caps = CAN_DO.join();
    if (!mine || (state.appVersionSent === mine.code && state.appCapsSent === caps)) return;
    wsRelay.broadcastUpdate(APP_VERSION, { code: mine.code, name: mine.name, can: CAN_DO });
    setState(prev => ({ ...prev, appVersionSent: mine.code, appCapsSent: caps }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayStatus, isLocked, !!session, state.appVersionSent, state.appCapsSent]);

  /**
   * A new version of the app, offered when it is opened: after unlocking,
   * outside the disguise and calls, a moment after the screen has settled.
   * It asks every time the app is opened, never twice within a minute
   * (core/appUpdate.ts).
   */
  const [updateOffer, setUpdateOffer] = useState<UpdateInfo | null>(null);

  /**
   * Two ran into a problem last time - closed unexpectedly, or had to start
   * its page again: said once, after unlocking, with the details waiting in
   * Settings to be copied and passed on (core/crashNote.ts).
   */
  useEffect(() => {
    if (isLocked || isCamouflaged || !session) return;
    const timer = setTimeout(() => {
      if (!crashNoteToTell()) return;
      setInAppNotification({
        id: newId(),
        title: 'Two ran into a problem',
        body: 'Settings has the details to copy and pass on',
        type: 'general',
        tabId: 'settings'
      });
    }, 3500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, isCamouflaged, !!session]);
  const callIdle = callState.phase === 'idle';
  useEffect(() => {
    if (isLocked || isCamouflaged || !pageVisible || !session || !callIdle || updateOffer) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void checkForUpdate().then(result => {
        if (cancelled || result.status !== 'found' || isPutOff(result.update.code)) return;
        setUpdateOffer(result.update);
      });
    }, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, isCamouflaged, pageVisible, !!session, callIdle]);

  useEffect(() => {
    if (!shareLastSeen || relayStatus !== 'connected' || isLocked) return;

    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      wsRelay.broadcastUpdate(PRESENCE_BEAT, { at: Date.now() });
    };

    beat();
    const timer = setInterval(beat, BEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [shareLastSeen, relayStatus, isLocked]);

  /**
   * Lets "typing…" lapse.
   *
   * The sender repeats every few seconds while they are still writing, so the
   * absence of a repeat is what means they stopped - there is no "stopped
   * typing" message to miss, and closing the app cannot fail to send one.
   */
  useEffect(() => {
    if (!partnerTypingAt) return;
    const timer = setTimeout(() => setPartnerTypingAt(0), TYPING_TTL_MS);
    return () => clearTimeout(timer);
  }, [partnerTypingAt]);

  /**
   * Applies whatever arrived on a group's connection.
   *
   * Kept entirely apart from the couple's message handler: nothing here can
   * reach state.messages, and nothing there can reach a group.
   */
  const handleGroupMessage = (groupId: string, msg: any) => {
    // The relay confirming a record is what turns a pending message into
    // "sent", exactly as in the couple's chat. Hellos and read positions are
    // sent without a correlation id, so their acks fall straight through.
    if (msg?.type === 'RECORD_ACK' && msg.correlationId) {
      const acked = String(msg.correlationId);
      setState(prev => ({
        ...prev,
        groups: prev.groups.map(g =>
          g.id !== groupId
            ? g
            : {
                ...g,
                messages: g.messages.map(m =>
                  m.id === acked ? { ...m, delivered: true } : m
                )
              }
        )
      }));
      return;
    }

    // The group's client refused to send something past the relay's limit.
    // Its bubble never left this phone and never will, so it does not get to
    // sit in the conversation looking as if it might - the same as the
    // couple's chat. Normally a voice note is checked before it is shown at
    // all (handleSendGroupMessage); this is the last line behind that.
    if (msg?.type === 'RECORD_TOO_LARGE') {
      const isChat = msg.recordType === GROUP_CHAT;
      setInAppNotification(tooLargeNotice(msg.bytes, isChat, `group:${groupId}`));
      if (isChat && msg.correlationId) {
        const refused = String(msg.correlationId);
        setState(prev => ({
          ...prev,
          groups: prev.groups.map(g =>
            g.id !== groupId ? g : { ...g, messages: g.messages.filter(m => m.id !== refused) }
          )
        }));
      }
      return;
    }

    if (msg?.type === 'REMOTE_SIGNAL' && msg.signal?.type === TYPING_SIGNAL) {
      if (!readShareReceipts()) return;
      let who = '';
      try {
        who = String(JSON.parse(msg.signal.payload)?.from || '');
      } catch {
        return;
      }
      if (!who || who === myMemberId()) return;
      setGroupTyping(prev => ({
        ...prev,
        [groupId]: { ...(prev[groupId] || {}), [who]: Date.now() }
      }));
      return;
    }

    if (msg?.type !== 'REMOTE_RECORD' || !msg.record) return;
    const record = msg.record;

    let parsed: any;
    try {
      parsed = JSON.parse(record.payload);
    } catch {
      return;
    }

    // The relay's author stamp says only that somebody joined; for a group the
    // real author travels inside the ciphertext.
    const from = String(parsed.from || '');
    if (!from || from === myMemberId()) return;

    setState(prev => ({
      ...prev,
      groups: prev.groups.map(g => {
        if (g.id !== groupId) return g;

        if (record.type === GROUP_HELLO) {
          const withThem = withMember(g.members, {
            id: from,
            name: String(parsed.name || 'Someone'),
            at: Number(parsed.at) || Date.now()
          });

          // Only the founder names the group, and only for devices that have
          // not been told yet. Without the guard a second founder-ish hello
          // could rename a room out from under everyone.
          const announced = String(parsed.groupName || '').trim();
          if (parsed.founder && announced && (!g.nameConfirmed || g.name !== announced)) {
            return { ...g, members: withThem, name: announced.slice(0, 40), nameConfirmed: true };
          }
          return { ...g, members: withThem };
        }

        if (record.type === GROUP_READ) {
          return { ...g, members: withRead(g.members, from, Number(parsed.upTo) || 0) };
        }

        if (record.type === GROUP_CHAT) {
          if (g.messages.some(m => m.id === record.id)) return g;

          // Something arriving in a group you are not looking at used to be
          // silent: the couple's chat raises a toast, groups raised nothing,
          // so the only way to find out was to go and look.
          if (activeGroupIdRef.current !== groupId && !isCamouflagedRef.current) {
            setInAppNotification({
              id: newId(),
              title: `${String(parsed.name || 'Someone')} in ${g.name}`,
              body: String(parsed.text || 'Sent a message'),
              type: 'chat',
              tabId: `group:${groupId}`
            });
          }
          // Built field by field, as ever, so nothing arrives that was not
          // asked for - `heard` included. A voice note's recording is kept
          // only as cleanVoiceFields accepts it; one that fails shows as its
          // text, the note's label.
          const voice = cleanVoiceFields(parsed);
          const message: GroupMessage = {
            id: record.id,
            authorId: from,
            authorName: String(parsed.name || 'Someone'),
            text: String(parsed.text || ''),
            sentAt: Number(parsed.at) || Date.now(),
            ...(voice || {})
          };
          return {
            ...g,
            members: withMember(g.members, { id: from, name: message.authorName, at: message.sentAt }),
            messages: insertBySentAt(g.messages, message).slice(-MAX_GROUP_MESSAGES)
          };
        }

        return g;
      })
    }));
  };

  /**
   * Holds a connection open for every group, alongside the couple's.
   *
   * Keyed on the codes rather than the array, so sending a message - which
   * rewrites state.groups - does not tear the sockets down and rebuild them.
   */
  const groupKeys = state.groups.map(g => `${g.id}:${g.code}:${g.joinPhrase || ''}`).join('|');
  useEffect(() => {
    if (isLocked) {
      disconnectAllGroups();
      return;
    }
    state.groups.forEach(group => {
      void connectGroup(group, handleGroupMessage);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKeys, isLocked]);

  useEffect(() => {
    return subscribeGroupStatus((groupId, status) => {
      setGroupStatuses(prev => (prev[groupId] === status ? prev : { ...prev, [groupId]: status }));
    });
  }, []);

  // Announce this device to every group it is in, so the others learn a name
  // to put on its messages.
  useEffect(() => {
    if (isLocked) return;

    /**
     * Says who this device is, and that it is still here.
     *
     * The same record does both jobs because they are the same claim, and the
     * relay keeps only the newest one per device - so repeating it every
     * minute costs one row rather than one row a minute. Before this, a
     * member's "last seen" only moved when they spoke, which made someone
     * sitting quietly in the group look like they had left an hour ago.
     */
    const hello = (onlyWhenVisible: boolean) => {
      // The first announcement goes out whatever the app is doing: it carries
      // this device's name and, from a founder, the group's - and a member
      // whose phone happened to be in their pocket when they joined would
      // otherwise be "Someone" to everybody until they next opened it.
      // The repeats are the presence signal, and those do wait for the
      // foreground, so a pocketed phone does not report itself as present.
      if (onlyWhenVisible && document.visibilityState !== 'visible') return;
      state.groups.forEach(group => {
        if (groupStatuses[group.id] !== 'connected') return;
        sendToGroup(group.id, GROUP_HELLO, {
          from: myMemberId(),
          name: state.userName || 'Someone',
          groupName: group.name,
          founder: group.founder,
          at: Date.now()
        });
      });
    };

    const announce = () => hello(false);
    const beat = () => hello(true);

    const first = setTimeout(announce, 800);
    const timer = setInterval(beat, 60_000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKeys, groupStatuses, isLocked, state.userName]);

  /**
   * Makes "typing…" lapse without editing the map it lapses from.
   *
   * The first version pruned expired entries on a timer, which meant the
   * displayed truth depended on a background loop getting its arithmetic and
   * its timing right - and when it did not, typing vanished a second after it
   * appeared. Who is typing is now derived at render from the timestamps, and
   * this tick exists only to cause the render that lets a stale one fall off.
   */
  const [typingTick, setTypingTick] = useState(0);
  useEffect(() => {
    const anyRecent = Object.values(groupTyping).some(members =>
      Object.values(members).some(at => Date.now() - at < TYPING_TTL_MS)
    );
    if (!anyRecent) return;
    const timer = setInterval(() => setTypingTick(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, [groupTyping, typingTick]);

  // The code is the one already shown to the user on the create screen.
  // Generating a fresh one here would have handed out an invite for a room
  // nobody was standing in.
  const handleCreateGroup = (name: string, code: string, joinPhrase: string) => {
    const group = newGroup(name, code, joinPhrase, true);
    group.members = [{ id: myMemberId(), name: state.userName || 'Someone', lastSeen: Date.now(), readUpTo: 0 }];
    setState(prev => ({ ...prev, groups: [...prev.groups, group] }));
    setActiveGroupId(group.id);
  };

  /**
   * Joins a group, or explains why it will not.
   *
   * Returns a message rather than throwing, because both refusals are ordinary
   * mistakes that belong next to the field the code was typed into.
   *
   * A room is addressed by its space id, which is derived from the code and
   * the phrase alone - the role plays no part in it. So a second membership
   * pointed at a code you already hold is not a second room: it is a second
   * client on the same one, and the two share every store the relay client
   * keys by space id, including the outbox of records still waiting to be
   * acknowledged. They would overwrite each other's queue, and the server,
   * which evicts an older connection whenever the same device id joins the
   * same space, would close first one and then the other in turn.
   *
   * The couple's own code is the dangerous version of that, and the easiest to
   * type by accident: it sits in Settings under "Space link code", ready to
   * copy, which makes it the most copied string in the app. Pointing a group at it
   * would put a second client on the conversation this whole app exists for.
   */
  const handleJoinGroup = (code: string, joinPhrase: string): string | null => {
    const wanted = normalizePairingCode(code);

    if (session && normalizePairingCode(session.code) === wanted) {
      return 'That is your own space link code, not a group code. Joining it here would disturb your private chat.';
    }

    // Deliberately does not open the group it found. Opening one switches the
    // whole app into group mode, which unmounts the panel this message is
    // about to be shown in - so the explanation would be replaced by the
    // silent, confusing success of arriving somewhere unasked.
    const already = state.groups.find(g => normalizePairingCode(g.code) === wanted);
    if (already) {
      return `You are already in this group${
        already.nameConfirmed ? ` — "${already.name}"` : ''
      }. It is in the list below.`;
    }

    // Named "Group" until the founder's hello says otherwise.
    const group = newGroup('', code, joinPhrase, false);
    group.members = [{ id: myMemberId(), name: state.userName || 'Someone', lastSeen: Date.now(), readUpTo: 0 }];
    setState(prev => ({ ...prev, groups: [...prev.groups, group] }));
    setActiveGroupId(group.id);
    return null;
  };

  const handleLeaveGroup = (groupId: string) => {
    // forget, not merely disconnect: leaving must not leave the room's queue
    // and read cursor behind in storage.
    forgetGroup(groupId);
    setActiveGroupId(current => (current === groupId ? null : current));
    setState(prev => {
      // Nor its half-typed message.
      const chatDrafts = { ...(prev.chatDrafts || {}) };
      delete chatDrafts[groupId];
      return { ...prev, groups: prev.groups.filter(g => g.id !== groupId), chatDrafts };
    });
  };

  /**
   * Renames a group, for everyone.
   *
   * Founders only, which is the rule the room already runs on: a joiner's name
   * is provisional until the founder's hello says what the group is called, and
   * letting anybody rename would put two devices in a loop overwriting each
   * other with no way to settle it.
   *
   * Announced at once rather than waiting for the next beat, which is a minute
   * away and only sent while the app is on screen - long enough for the rename
   * to look like it had not worked.
   */
  const handleRenameGroup = (groupId: string, rawName: string) => {
    const name = rawName.trim().slice(0, 40);
    if (!name) return;

    setState(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId && g.founder ? { ...g, name, nameConfirmed: true } : g
      )
    }));

    const group = state.groups.find(g => g.id === groupId);
    if (!group?.founder) return;
    sendToGroup(groupId, GROUP_HELLO, {
      from: myMemberId(),
      name: state.userName || 'Someone',
      groupName: name,
      founder: true,
      at: Date.now()
    });
  };

  /**
   * Gives up on a message that never left, or sends it again as a new one.
   *
   * A record the relay will not accept is retried on every reconnect forever,
   * so without this a single bad message means a clock on screen that nothing
   * can clear. Retrying re-sends the text rather than the record: the old one
   * is abandoned and a fresh id, nonce and encryption go out, because whatever
   * the relay objected to is in the record itself.
   */
  const handleResolveStuck = (
    scope: { groupId?: string },
    messageId: string,
    action: 'retry' | 'delete'
  ) => {
    const { groupId } = scope;
    const stuck: ChatMessage | GroupMessage | undefined = groupId
      ? state.groups.find(g => g.id === groupId)?.messages.find(m => m.id === messageId)
      : state.messages.find(m => m.id === messageId);

    // A voice note goes again as a voice note - its recording, length and
    // shape - not as the label that stands in for it as text.
    const voice = stuck?.isVoiceMemo ? cleanVoiceFields(stuck) : null;
    // A photo likewise, picture and all - and view-once still, if it was.
    // Only the couple's chat sends photos.
    const stuckPhoto = groupId ? undefined : (stuck as ChatMessage | undefined);
    const photo = stuckPhoto?.isPhoto ? cleanPhotoFields(stuckPhoto) : null;
    if (action === 'retry' && stuckPhoto?.isPhoto && !photo) {
      setInAppNotification({
        id: newId(),
        title: "Can't send that photo again",
        body: 'The picture is no longer on this phone. Discard it and send the photo again.',
        type: 'general',
        tabId: 'chat'
      });
      return;
    }
    if (action === 'retry' && stuck?.isVoiceMemo && !voice) {
      // Its recording did not come back from this phone's storage, so there
      // is nothing to send again - and its label sent as a text message
      // would only look like a note that cannot be played. Left where it
      // is, to be discarded.
      setInAppNotification({
        id: newId(),
        title: "Can't send that voice note again",
        body: 'Its recording is no longer on this phone. Discard it and record it again.',
        type: 'general',
        tabId: groupId ? `group:${groupId}` : 'chat'
      });
      return;
    }
    const text = stuck?.text || (voice ? voiceNoteLabel(voice.audioDurationSeconds) : '');

    if (groupId) {
      dropPendingInGroup(groupId, messageId);
      setState(prev => ({
        ...prev,
        groups: prev.groups.map(g =>
          g.id === groupId ? { ...g, messages: g.messages.filter(m => m.id !== messageId) } : g
        )
      }));
    } else {
      wsRelay.dropPending(messageId);
      setState(prev => ({
        ...prev,
        messages: prev.messages.filter(m => m.id !== messageId)
      }));
    }

    if (action !== 'retry' || !text) return;
    if (groupId) handleSendGroupMessage(groupId, text, voice ?? undefined);
    else {
      // Still an answer to what it answered, and one set to show later still
      // waits for its time - sent again now, it would show at once.
      const kept = {
        ...(stuckPhoto?.replyTo ? { replyTo: stuckPhoto.replyTo } : {}),
        ...(stuckPhoto && isWaiting(stuckPhoto, state.activeUser) ? { showAt: stuckPhoto.showAt } : {})
      };
      handleSendMessage(text, false, {
        ...kept,
        ...(voice ?? (photo ? { ...photo, ...(stuckPhoto?.viewOnce ? { viewOnce: true as const } : {}) } : {}))
      });
    }
  };

  /** `voice` makes it a voice note; `text` is then the note's label. */
  const handleSendGroupMessage = (groupId: string, text: string, voice?: VoiceFields) => {
    const at = Date.now();
    const id = newId('gmsg');
    const name = state.userName || 'Someone';
    const payload = { from: myMemberId(), name, text, at, ...voice };

    // A voice note is measured against the relay's limit before it is shown.
    // The group's client refuses an oversized record too, but only once it
    // holds the group's key, so until then a bubble would sit there for a
    // note that can never go. Refused here, where somebody can be told.
    if (voice) {
      const bytes = recordSizeOf(payload);
      if (bytes > MAX_RECORD_BYTES) {
        setInAppNotification(tooLargeNotice(bytes, true, `group:${groupId}`));
        return;
      }
    }

    setState(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === groupId
          ? {
              ...g,
              messages: insertBySentAt(g.messages, {
                id,
                authorId: myMemberId(),
                authorName: name,
                text,
                sentAt: at,
                delivered: false,
                ...voice
              }).slice(-MAX_GROUP_MESSAGES)
            }
          : g
      )
    }));

    // The local message id doubles as the correlation id, so the relay's
    // acknowledgement can be matched back to this exact bubble.
    sendToGroup(groupId, GROUP_CHAT, payload, id);
  };

  /**
   * Somebody else's voice note in a group has been played on this device:
   * its "new" dot goes, and it no longer plays by itself after the note
   * before it. Kept here only - a group has no per-note receipts.
   */
  const handleGroupVoicePlayed = (groupId: string, messageId: string) => {
    setState(prev => {
      let changed = false;
      const groups = prev.groups.map(g => {
        if (g.id !== groupId) return g;
        const messages = g.messages.map(m => {
          if (m.id !== messageId || m.heard) return m;
          changed = true;
          return { ...m, heard: true };
        });
        return changed ? { ...g, messages } : g;
      });
      return changed ? { ...prev, groups } : prev;
    });
  };

  /**
   * Tells a group what has been read, while it is open on screen.
   *
   * Sent as a record rather than a signal: unlike typing, a read position has
   * to survive the reader closing the app, or the info panel would empty out
   * the moment everyone went offline.
   */
  useEffect(() => {
    if (!activeGroupId || isLocked || !readShareReceipts()) return;
    // The same rule as the couple's chat: a group left open on a locked phone,
    // or behind the calculator, has not been read. Re-run on coming back.
    if (!pageVisible || isCamouflaged) return;
    const group = state.groups.find(g => g.id === activeGroupId);
    if (!group || group.messages.length === 0) return;

    const newest = group.messages.reduce((max, m) => (m.sentAt > max ? m.sentAt : max), 0);
    const mine = group.members.find(m => m.id === myMemberId());
    if (!newest || (mine && mine.readUpTo >= newest)) return;

    setState(prev => ({
      ...prev,
      groups: prev.groups.map(g =>
        g.id === activeGroupId ? { ...g, members: withRead(g.members, myMemberId(), newest) } : g
      )
    }));
    sendToGroup(activeGroupId, GROUP_READ, { from: myMemberId(), upTo: newest });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, state.groups, isLocked, pageVisible, isCamouflaged]);

  /**
   * The two surfaces, from one log.
   *
   * Nothing here is kept in state of its own: a dot and a home-screen line are
   * two readings of the same events against the same marks, so they cannot
   * disagree about what is new.
   */
  const partnerDots = useMemo(
    () => dottedTabs(state.activity || [], state.activitySeen || {}),
    [state.activity, state.activitySeen]
  );
  const partnerNews = useMemo(
    () => unseen(state.activity || [], state.activitySeen || {}),
    [state.activity, state.activitySeen]
  );

  const handleSelectTab = (tabId: string) => {
    // Screens load as separate chunks, so switching tab can suspend. Marked as
    // a transition, React keeps the screen you are on until the next one is
    // ready instead of tearing it down for a placeholder - the difference
    // between a tap that feels instant and one that blinks.
    startTransition(() => setCurrentTab(tabId));

    // Opening a destination is what marks it read. Stamped now rather than
    // from the newest event, so anything that lands while you are sitting on
    // the screen is already accounted for and does not reappear as news the
    // moment you leave.
    setState(prev => ({
      ...prev,
      activitySeen: { ...(prev.activitySeen || {}), [tabId]: Date.now() }
    }));

    if (tabId === 'chat') {
      sendReadReceipt();
      if (typeof document !== 'undefined') {
        document.title = 'Two — Private Encrypted Space';
      }
    }
  };

  /**
   * Every screen opens at its top.
   *
   * The page is one long document, and changing screen only swapped what was
   * in it - so a screen reached from the bottom of Home opened partway down,
   * or at its own bottom, instead of at its title. Done here, after the new
   * screen is in place and before it is painted, rather than in
   * handleSelectTab: there it would jerk the old screen to the top while the
   * new one was still loading, and it would miss the screens that are opened
   * by setting the tab directly (Home's cards, Soft Landing). Leaving a group
   * is a change of screen too.
   */
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentTab, activeGroupId]);

  /**
   * The home-screen widget's summary (core/widget.ts): your days together,
   * the next anniversary, how many messages from your partner wait unread and
   * how they are. Only while the space is open - a locked vault has nothing
   * to tell it - and never a word of any message.
   */
  const partnerSeat = state.activeUser === 'user' ? 'partner' : 'user';
  const theirReport = state.activeUser === 'user' ? state.partnerReport : state.userReport;
  const myReport = state.activeUser === 'user' ? state.userReport : state.partnerReport;
  const newestFromThem = useMemo(() => {
    // A real message: not a call's line, nor one taken back.
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const m = state.messages[i];
      if (m.authorId === partnerSeat && !m.call && !m.unsent) return m.sentAt;
    }
    return undefined;
  }, [state.messages, partnerSeat]);
  useEffect(() => {
    if (isLocked || !session || !state.isPaired) return;
    const next = state.ourDates ? nextAnniversary(state.ourDates) : null;
    updateWidget({
      partner: state.partnerName || 'Partner',
      since: state.ourDates?.togetherSince,
      annivDate: next?.date,
      annivYears: next?.years,
      unread: unreadChatCount,
      lastMessageAt: unreadChatCount > 0 ? newestFromThem : undefined,
      weather: theirReport?.weather,
      capacity: theirReport?.capacity,
      myWeather: myReport?.weather,
      myCapacity: myReport?.capacity,
      online: partnerOnline,
      lastSeenAt: shareLastSeen && state.partnerLastSeen ? state.partnerLastSeen : undefined
    });
  }, [
    isLocked, session, state.isPaired, state.partnerName, state.ourDates, unreadChatCount, newestFromThem,
    theirReport?.weather, theirReport?.capacity, myReport?.weather, myReport?.capacity,
    partnerOnline, shareLastSeen, state.partnerLastSeen
  ]);

  /**
   * Opened from the widget to do something: go to the chat, or send a
   * heartbeat. Asked whenever Two comes to the front, and only once it is
   * unlocked and linked - a heartbeat asked for on the lock screen goes as
   * soon as the PIN is in.
   */
  useEffect(() => {
    if (isLocked || !session || !state.isPaired) return;
    const act = () => {
      if (document.visibilityState !== 'visible') return;
      const action = takeLaunchAction();
      if (action === 'chat') handleSelectTab('chat');
      else if (action === 'heartbeat') triggerGlobalPulse('Thinking of you');
    };
    act();
    document.addEventListener('visibilitychange', act);
    return () => document.removeEventListener('visibilitychange', act);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, session, state.isPaired]);

  /**
   * The phone's Back button once nothing is open on top (see core/backStack).
   *
   * Back leaves a group for the couple's space, then any screen for Home, and
   * only at Home does it say no, so that the phone can put the app in the
   * background. On the lock screen, the calculator and the first-run screens
   * there is nowhere to go back to, so it says no straight away.
   *
   * Registered once and read through refs, so it always sees the screen as it
   * is now rather than as it was on the first render.
   */
  const selectTabRef = useRef(handleSelectTab);
  selectTabRef.current = handleSelectTab;
  const inSpaceRef = useRef(false);
  inSpaceRef.current = !isLocked && !isCamouflaged && mediaReady && !!session && state.isPaired;

  useEffect(() => {
    setBackFallback(() => {
      if (!inSpaceRef.current) return false;
      if (activeGroupIdRef.current) {
        setActiveGroupId(null);
        return true;
      }
      if (currentTabRef.current !== 'home') {
        selectTabRef.current('home');
        return true;
      }
      return false;
    });
    return () => setBackFallback(null);
  }, []);

  /**
   * Tells the Android app that the first real screen is up - the lock screen,
   * the calculator, the first-run screens or the space itself - so its launch
   * splash steps aside for that rather than for an empty cream page.
   *
   * Once per page load. Screens that load as their own chunk show an empty
   * placeholder first (ScreenFallback, marked aria-busy), so this waits until
   * none is left, for a few seconds at most. Then one frame for the screen to
   * be painted - with a timer alongside, because while the splash is up the
   * phone may not be drawing the page's frames at all. The media spinner is
   * not counted: it is the splash's own leaf, still waiting.
   */
  const appReadySentRef = useRef(false);
  const firstScreenUp = isCamouflaged || isLocked || mediaReady;
  useEffect(() => {
    if (appReadySentRef.current || !firstScreenUp) return;
    const started = Date.now();
    let timer = 0;
    let frame = 0;
    const send = () => {
      if (appReadySentRef.current) return;
      appReadySentRef.current = true;
      try {
        (window as unknown as { AndroidBridge?: { appReady?: () => void } }).AndroidBridge?.appReady?.();
      } catch {
        /* an older app without the hook: its splash has its own time limit */
      }
    };
    const check = () => {
      if (document.querySelector('[aria-busy="true"]') && Date.now() - started < 4000) {
        timer = window.setTimeout(check, 50);
        return;
      }
      frame = requestAnimationFrame(send);
      timer = window.setTimeout(send, 120);
    };
    check();
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [firstScreenUp]);

  // Reset unread title if user focuses tab while on chat
  useEffect(() => {
    const handleFocus = () => {
      if (currentTabRef.current === 'chat') {
        if (typeof document !== 'undefined') {
          document.title = 'Two — Private Encrypted Space';
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Auto-Camouflage when switching away from the tab or app
  useEffect(() => {
    if (!autoCamouflageOnBlur) return;
    const handleBlur = () => {
      // Android's microphone permission dialog takes focus like leaving the
      // app does. Disguising for it would end the first call before it rang,
      // and hide the chat behind the calculator in the middle of the first
      // voice note.
      if (callEngineRef.current?.askingForMic || isVoiceRecorderAskingForMic()) return;
      setIsCamouflaged(true);
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [autoCamouflageOnBlur]);

  /**
   * Bumped by the dock to open the tools hub.
   *
   * The hub and its five sibling modals live inside Navigation. In the app that
   * component renders no bar, but it still has to be mounted, because Tools is
   * the only route to soundscapes, co-regulation, the mesh, safety numbers,
   * camouflage and the quick exit.
   */
  const [toolsSignal, setToolsSignal] = useState(0);
  const [heartSignal, setHeartSignal] = useState(0);

  const handleToggleDecoyOnLaunch = (enabled: boolean) => {
    setDecoyOnLaunch(enabled);
    try {
      localStorage.setItem('two_decoy_on_launch', String(enabled));
    } catch {
      /* private mode - the setting simply will not survive a restart */
    }
  };

  /**
   * The way back in when the code has been forgotten.
   *
   * Turns the setting off as well as leaving the calculator, because otherwise
   * the next launch drops you straight back behind a door you already could not
   * open. If a PIN is set it still stands directly behind this - the gesture
   * skips the disguise, never the vault.
   */
  const handleDecoyEscape = () => {
    handleToggleDecoyOnLaunch(false);
    setIsCamouflaged(false);
  };

  const handleUpdateReport = (updatedFields: any) => {
    // The whole report, not the field that changed. The relay keeps only the
    // newest of these now, and a newest that says "capacity 3" and nothing
    // about the weather would lose the weather. For the same reason it
    // carries your days too, today's included (core/weatherHistory).
    const mine = state.activeUser === 'user' ? state.userReport : state.partnerReport;
    const next = { ...mine, ...updatedFields };
    next.days = recordDay(mine.days, localDateKey(), next.weather);
    wsRelay.broadcastUpdate('WEATHER', next);
    setState(prev => {
      const isMe = prev.activeUser === 'user';
      return {
        ...prev,
        userReport: isMe ? { ...prev.userReport, ...updatedFields, days: next.days } : prev.userReport,
        partnerReport: !isMe ? { ...prev.partnerReport, ...updatedFields, days: next.days } : prev.partnerReport,
      };
    });
  };

  const handleToggleUserFlag = (active: boolean) => {
    wsRelay.broadcastUpdate('NOT_ABOUT_YOU', { active });
    setState(prev => {
      const isMe = prev.activeUser === 'user';
      return {
        ...prev,
        userReport: isMe ? { ...prev.userReport, notAboutYouActive: active } : prev.userReport,
        partnerReport: !isMe ? { ...prev.partnerReport, notAboutYouActive: active } : prev.partnerReport,
      };
    });
  };

  /**
   * `extra` makes it a voice note or a photo (`text` is then its label), or an
   * answer to another message.
   */
  const handleSendMessage = (text: string, isNeedCard: boolean = false, extra?: MessageExtras) => {
    const newMessage: ChatMessage = {
      id: newId(),
      authorId: state.activeUser,
      authorName: state.activeUser === 'user' ? 'You' : 'Partner',
      text,
      timestamp: 'Just now',
      // One set to show later takes its place at that time (core/sendLater).
      sentAt: typeof extra?.showAt === 'number' ? extra.showAt : Date.now(),
      delivered: false,
      isNeedCard,
      ...extra
    };
    // A voice note or a photo is measured against the relay's limit before it
    // is shown. The relay client refuses an oversized record too, but only
    // once it holds the space's key, so until then a bubble would sit there
    // for a message that can never go. Refused here, where somebody can be told.
    if (extra?.isVoiceMemo || extra?.isPhoto) {
      const bytes = recordSizeOf(newMessage);
      if (bytes > MAX_RECORD_BYTES) {
        setInAppNotification(tooLargeNotice(bytes, true, 'chat'));
        return;
      }
    }
    // The message id doubles as the correlation id, so the relay's ack can be
    // matched back to this exact bubble.
    wsRelay.broadcastUpdate('CHAT', newMessage, newMessage.id);
    setState(prev => ({
      ...prev,
      messages: insertBySentAt(prev.messages, newMessage).slice(-MAX_CHAT_MESSAGES)
    }));
  };

  /**
   * The partner's voice note has just been played here for the first time.
   *
   * Marked heard on this phone whatever the setting: that is what takes its
   * "new" dot away and keeps it from playing by itself again after the note
   * before it. The partner is told only while read receipts are shared -
   * hearing a note is reading it, and off means nothing leaves this phone.
   */
  const handleVoiceHeard = (messageId: string) => {
    const note = state.messages.find(m => m.id === messageId);
    if (!note || !note.isVoiceMemo || note.authorId === state.activeUser || note.heard) return;
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(m => (m.id === messageId ? { ...m, heard: true } : m))
    }));
    if (readShareReceipts()) wsRelay.broadcastUpdate(VOICE_HEARD, { messageId });
  };

  /**
   * New words for one of your own messages, within fifteen minutes of sending
   * it (core/chatActions decides, here and on the other phone).
   */
  const handleEditMessage = (messageId: string, text: string) => {
    const target = state.messages.find(m => m.id === messageId);
    const words = text.trim();
    if (!target || !words || words === target.text || !canEdit(target, state.activeUser)) return;
    const payload = { messageId, text: words, editedAt: Date.now() };
    setState(prev => {
      const messages = applyEdit(prev.messages, prev.activeUser, payload);
      return messages ? { ...prev, messages } : prev;
    });
    wsRelay.broadcastUpdate(CHAT_EDIT, payload);
  };

  /**
   * Takes one of your messages back, from both phones, once you have said so.
   * What it said goes; a line saying it was unsent stays in its place, so
   * nothing disappears without a trace.
   */
  const handleUnsendMessage = async (messageId: string) => {
    const target = state.messages.find(m => m.id === messageId);
    if (!target || !canUnsend(target, state.activeUser)) return;
    const partner = state.partnerName || 'your partner';
    // Still waiting to show (core/sendLater): it goes without a trace.
    const waiting = isWaiting(target, state.activeUser);
    const ok = await askConfirm(
      waiting
        ? {
            title: "Don't send this message?",
            body: `It was set to show ${aheadLabel(target.showAt!)}. ${partner} won't see it, and it comes off your phone too.`,
            confirm: "Don't send",
            cancel: 'Keep it',
            danger: true
          }
        : {
            title: 'Unsend this message?',
            body: `It will be taken off your phone and ${partner}'s. A line saying you unsent a message stays in its place.`,
            confirm: 'Unsend',
            cancel: 'Keep it',
            danger: true
          }
    );
    if (!ok) return;
    // Not yet off this phone: it does not go at all. Sent after its time, it
    // would show and chime before the unsend behind it took it away. Whether
    // the relay already has it this phone cannot tell, so the unsend still goes.
    if (waiting) wsRelay.dropPending(messageId);
    setState(prev => {
      const gone = withdrawn(prev, prev.activeUser, messageId);
      if (gone) return { ...prev, ...gone };
      const messages = applyUnsend(prev.messages, prev.activeUser, { messageId });
      return messages ? { ...prev, messages } : prev;
    });
    wsRelay.broadcastUpdate(CHAT_UNSEND, { messageId });
  };

  /**
   * Your one-tap status, set or (with null) cleared, on both phones
   * (core/status). Always newer than the last, even within the same moment.
   */
  const handleSetStatus = (next: { text: string; emoji?: string; clearsAt: number } | null) => {
    const now = Date.now();
    const setAt = stampFor(state.statuses?.[state.activeUser], now);
    // The sheet measured how long from now. Stamped later than now - after one
    // set by a clock that was ahead - it lasts as long from that stamp, or it
    // would end before it began and neither phone would take it.
    const payload = next
      ? { text: next.text, ...(next.emoji ? { emoji: next.emoji } : {}), setAt, clearsAt: next.clearsAt + (setAt - now) }
      : { text: '', setAt, clearsAt: setAt };
    setState(prev => {
      const statuses = applyStatus(prev.statuses, prev.activeUser, payload);
      return statuses ? { ...prev, statuses } : prev;
    });
    wsRelay.broadcastUpdate(STATUS_SET, payload);
  };

  /** Your reaction to a message: set, changed, or taken off with ''. */
  const handleReactToMessage = (messageId: string, emoji: string) => {
    const payload = { messageId, emoji };
    setState(prev => {
      const messages = applyReaction(prev.messages, prev.activeUser, payload);
      return messages ? { ...prev, messages } : prev;
    });
    wsRelay.broadcastUpdate(CHAT_REACTION, payload);
  };

  /** Pins a message to the top of the chat, or takes it down, on both phones. */
  const handlePinMessage = (messageId: string, pinned: boolean) => {
    const payload = { messageId, pinned, at: Date.now() };
    setState(prev => {
      const chatPins = applyPin(prev.chatPins, withHeldMessages(prev), prev.activeUser, payload);
      return chatPins ? { ...prev, chatPins } : prev;
    });
    wsRelay.broadcastUpdate(CHAT_PIN, payload);
  };

  /**
   * A view-once photo sent to you has just been opened. Its picture goes from
   * this phone now - the screen showing it keeps its own copy until closed -
   * and from your other phones, and its sender learns it was opened.
   */
  const handleViewOnceOpened = (messageId: string) => {
    const photo = state.messages.find(m => m.id === messageId);
    if (!photo || !canOpenViewOnce(photo, state.activeUser)) return;
    const payload = { messageId, at: Date.now() };
    setState(prev => {
      const messages = applyViewed(prev.messages, prev.activeUser, payload);
      return messages ? { ...prev, messages } : prev;
    });
    wsRelay.broadcastUpdate(CHAT_VIEWED, payload);
  };

  /** Sends one change to the other phone: over the relay, and the local network when there is one. */
  const shareUpdate = (type: string, payload: unknown) => {
    wsRelay.broadcastUpdate(type, payload);
    localMesh.broadcastLocally(type, payload, state.activeUser);
  };

  const handleAddJournalEntry = (entry: Omit<JournalEntry, 'id'>) => {
    const newEntry: JournalEntry = {
      ...entry,
      id: newId()
    };
    // A private entry never leaves this phone, not even encrypted.
    if (!newEntry.isPrivate) shareUpdate(JOURNAL_SHARED, journalToWire(newEntry));
    setState(prev => ({
      ...prev,
      journalEntries: [newEntry, ...prev.journalEntries]
    }));
  };

  const handlePromoteJournalEntry = (id: string) => {
    const entry = state.journalEntries.find(e => e.id === id);
    if (entry) shareUpdate(JOURNAL_SHARED, journalToWire({ ...entry, isPrivate: false }));
    setState(prev => ({
      ...prev,
      journalEntries: prev.journalEntries.map(e =>
        e.id === id ? { ...e, isPrivate: false } : e
      )
    }));
  };

  const handleAddAgreement = (agreement: Omit<AgreementItem, 'id'>) => {
    const newAgreement: AgreementItem = {
      ...agreement,
      id: newId()
    };
    shareUpdate(AGREEMENT_ADD, newAgreement);
    setState(prev => ({
      ...prev,
      agreements: [newAgreement, ...prev.agreements]
    }));
  };

  const handleToggleListItem = (id: string) => {
    const item = state.lists.find(i => i.id === id);
    // A hidden item is a surprise the other phone has never been told about,
    // and ticking one is not the moment to mention it.
    if (item && !item.isHiddenFromPartner) {
      shareUpdate(LIST_ITEM_SET, { id, isCompleted: !item.isCompleted });
    }
    setState(prev => ({
      ...prev,
      lists: prev.lists.map(i => (i.id === id ? { ...i, isCompleted: !i.isCompleted } : i))
    }));
  };

  const handleAddListItem = (title: string, isHidden: boolean) => {
    const newItem: ListItem = {
      id: newId(),
      title,
      isCompleted: false,
      isHiddenFromPartner: isHidden,
      addedBy: state.activeUser
    };
    if (!isHidden) {
      wsRelay.broadcastUpdate('LIST_ITEM', newItem);
    }
    setState(prev => ({
      ...prev,
      lists: [newItem, ...prev.lists]
    }));
  };

  const handleDeleteListItem = (id: string) => {
    const item = state.lists.find(i => i.id === id);
    if (item && !item.isHiddenFromPartner) shareUpdate(LIST_ITEM_DELETE, { id });
    setState(prev => ({
      ...prev,
      lists: prev.lists.filter(i => i.id !== id)
    }));
  };

  const handleAddChore = (chore: Omit<ChoreItem, 'id'>) => {
    const newChore: ChoreItem = {
      ...chore,
      id: newId()
    };
    shareUpdate(CHORE_ADD, choreToWire(newChore, state.activeUser));
    setState(prev => ({
      ...prev,
      chores: [newChore, ...prev.chores]
    }));
  };

  const handleAddExpense = (expense: Omit<ExpenseItem, 'id'>) => {
    const newExpense: ExpenseItem = {
      ...expense,
      id: newId()
    };
    shareUpdate(EXPENSE_ADD, expenseToWire(newExpense, state.activeUser));
    setState(prev => ({
      ...prev,
      expenses: [newExpense, ...prev.expenses]
    }));
  };

  const handleSettleUpExpenses = () => {
    // Settles what is on the tab now, by id, so an expense the other phone is
    // adding at the same moment is not wiped along with it.
    const ids = state.expenses.map(e => e.id);
    shareUpdate(EXPENSES_SETTLED, { ids });
    const settled = new Set(ids);
    setState(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => !settled.has(e.id))
    }));
  };

  const handleAddMemory = (memory: Omit<MemoryItem, 'id' | 'authorId' | 'authorName'>) => {
    const created: MemoryItem = { ...memory, id: newId(), authorId: state.activeUser, authorName: 'You' };
    shareUpdate(MEMORY_ADD, memoryToWire(created, state.activeUser));
    setState(prev => ({
      ...prev,
      memories: [created, ...(prev.memories || [])]
    }));
  };

  const handleAddQuote = (quoteText: string) => {
    // "You" on the phone that wrote it; the other phone reads it as Partner.
    const quote: QuoteItem = { id: newId(), quote: quoteText, author: 'You', isCustom: true };
    shareUpdate(QUOTE_ADD, quoteToWire(quote, state.activeUser));
    setState(prev => ({
      ...prev,
      quotes: [quote, ...prev.quotes]
    }));
  };

  const handleUpdateCycleSharingLevel = (level: CycleSharingLevel) => {
    // The latest record goes with it, cut to the new level: widening sharing
    // shows your partner where you are now, narrowing it takes back what their
    // phone was holding.
    const latest = state.cycleRecords[0];
    shareUpdate(CYCLE_SHARING, { level, latest: latest ? cycleRecordToWire(latest, level) : null });
    setState(prev => ({
      ...prev,
      cycleSharingLevel: level,
      consentLogs: [
        {
          id: newId(),
          kind: 'cycle',
          at: Date.now(),
          action: level === 'private' ? 'revoke' : 'grant',
          details: `Cycle sharing level updated to: ${level}`,
          timestamp: 'Just now'
        },
        ...prev.consentLogs
      ]
    }));
  };

  const handleLogCycleRecord = (record: Omit<CycleRecord, 'id'>) => {
    const newRecord: CycleRecord = {
      ...record,
      id: newId()
    };
    const wire = cycleRecordToWire(newRecord, state.cycleSharingLevel);
    if (wire) shareUpdate(CYCLE_RECORD, wire);
    setState(prev => ({
      ...prev,
      cycleRecords: [newRecord, ...prev.cycleRecords]
    }));
  };

  /**
   * Ticks or un-ticks a ritual for today, for whoever holds this phone.
   *
   * `done` is what it should become, not "flip it": the kiss timer asks for
   * done and must never un-tick a kiss already ticked, and a tap that lands
   * before the screen has caught up asks for the same thing twice.
   */
  const handleSetRitualDone = (ritualId: string, done: boolean) => {
    const seat = state.activeUser;
    const day = localDay();
    const ritual = state.rituals.find(r => r.id === ritualId);
    if (!ritual || isDoneOn(ritual, seat, day) === done) return;

    shareUpdate(RITUAL_SET, { ritualId, seat, date: day, done });
    // Said the old way too, ticks only, for a phone still on the previous
    // version: it knows nothing else, and puts "completed a ritual" on the
    // home screen from it. The date marks this as the RITUAL_SET's companion,
    // which a phone on this version leaves alone.
    if (done) wsRelay.broadcastUpdate('RITUAL_COMPLETE', { ritualId, activeUser: seat, date: day });

    // One stone per ritual, per person, per day. Ticking sets it on the cairn
    // and un-ticking lifts that same stone off, so tapping back and forth no
    // longer piles them up.
    const pebbleId = `peb-${ritualId}-${seat}-${day}`;
    const pebbleColors = ['#D4A373', '#B5A895', '#C48B71', '#8F9E8B', '#938581', '#C9ADA7'];
    const stone: PebbleStone = {
      id: pebbleId,
      color: pebbleColors[Math.floor(Math.random() * pebbleColors.length)],
      size: Math.floor(Math.random() * 35) + 50,
      height: Math.floor(Math.random() * 8) + 18,
      rotation: Math.floor(Math.random() * 6) - 3,
      // Shown beside the stone for as long as it stays, so a date rather
      // than "Just now".
      placedAt: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      ritualTitle: ritual.title || 'Ritual'
    };

    setState(prev => ({
      ...prev,
      rituals: withRitualDay(prev.rituals, ritualId, seat, day, done) ?? prev.rituals,
      pebbles: done ? addOnce(prev.pebbles, stone, 'end') : prev.pebbles.filter(p => p.id !== pebbleId)
    }));
  };

  const handleAddRitual = (newRitual: RitualItem) => {
    shareUpdate(RITUAL_ADD, ritualToWire(newRitual));
    setState(prev => ({
      ...prev,
      rituals: [...prev.rituals, newRitual]
    }));
  };

  const handleSendLetter = (newLetter: LoveLetter) => {
    wsRelay.broadcastUpdate('LOVE_LETTER', newLetter);
    localMesh.broadcastLocally('LOVE_LETTER', newLetter, state.activeUser);
    setState(prev => ({
      ...prev,
      letters: [newLetter, ...prev.letters]
    }));
  };

  const handleOpenLetter = (letterId: string) => {
    const letter = state.letters.find(l => l.id === letterId);
    // Opening is the reader's (core/letters): reading your own changes
    // nothing - it used to mark it opened here, so your Sent tray said so
    // before your partner had - and one for a day still to come stays shut.
    if (!letter || !opensNow(letter, state.activeUser)) return;
    // The moment, and the day in words for a phone on the previous version.
    // It used to be the word "Today", which every opened letter then said
    // for good.
    const openedAt = Date.now();
    const openedDate = new Date(openedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    shareUpdate(LETTER_OPENED, { id: letterId, openedDate, openedAt });
    setState(prev => ({
      ...prev,
      letters: prev.letters.map(l =>
        l.id === letterId && !l.isOpened ? { ...l, isOpened: true, openedBy: prev.activeUser, openedDate, openedAt } : l
      )
    }));
  };

  const handleAddAdventure = (newAdv: AdventureItem) => {
    setState(prev => {
      const updated = [newAdv, ...prev.adventures];
      wsRelay.broadcastUpdate('ADVENTURE_UPDATE', updated);
      localMesh.broadcastLocally('ADVENTURE_UPDATE', updated, prev.activeUser);
      return {
        ...prev,
        adventures: updated
      };
    });
  };

  /**
   * Stamps an adventure as done (with its words and photo), or takes the stamp off.
   *
   * Says which, rather than flipping: it used to flip, so saving new words on
   * an adventure already stamped took its stamp off and lost its date.
   */
  const handleSetAdventureStamp = (id: string, stamped: boolean, notes?: string, photoUrl?: string) => {
    setState(prev => {
      const updated = prev.adventures.map(a => {
        if (a.id === id) {
          const willBeCompleted = stamped;
          return {
            ...a,
            isCompleted: willBeCompleted,
            // The day it was done. It used to be the word "Recently", which
            // the passport stamp and the Memoir Book then said for good.
            completedDate: willBeCompleted
              ? (a.completedDate && a.completedDate !== 'Recently'
                  ? a.completedDate
                  : new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }))
              : undefined,
            personalNotes: notes !== undefined ? notes : a.personalNotes,
            photoUrl: photoUrl !== undefined ? photoUrl : a.photoUrl
          };
        }
        return a;
      });
      wsRelay.broadcastUpdate('ADVENTURE_UPDATE', updated);
      localMesh.broadcastLocally('ADVENTURE_UPDATE', updated, prev.activeUser);
      return {
        ...prev,
        adventures: updated
      };
    });
  };

  const handleAddTimeCapsule = (newCapsule: TimeCapsuleItem) => {
    setState(prev => {
      const updated = [newCapsule, ...prev.timeCapsules];
      wsRelay.broadcastUpdate('TIME_CAPSULE_UPDATE', updated);
      localMesh.broadcastLocally('TIME_CAPSULE_UPDATE', updated, prev.activeUser);
      return {
        ...prev,
        timeCapsules: updated
      };
    });
  };

  const handleOpenTimeCapsule = (capsuleId: string) => {
    setState(prev => {
      const updated = prev.timeCapsules.map(c =>
        c.id === capsuleId ? { ...c, isOpened: true, openedAt: Date.now() } : c
      );
      wsRelay.broadcastUpdate('TIME_CAPSULE_UPDATE', updated);
      localMesh.broadcastLocally('TIME_CAPSULE_UPDATE', updated, prev.activeUser);
      return {
        ...prev,
        timeCapsules: updated
      };
    });
  };

  const handleAddScratchCard = (newCard: ScratchCardItem) => {
    setState(prev => {
      const updated = [newCard, ...prev.scratchCards];
      wsRelay.broadcastUpdate('SCRATCH_CARD_UPDATE', updated);
      localMesh.broadcastLocally('SCRATCH_CARD_UPDATE', updated, prev.activeUser);
      return {
        ...prev,
        scratchCards: updated
      };
    });
  };

  const handleScratchCardComplete = (cardId: string) => {
    setState(prev => {
      const updated = prev.scratchCards.map(c =>
        // The day itself, not "Just now" - which it went on saying for good.
        c.id === cardId ? { ...c, isScratched: true, scratchedAt: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) } : c
      );
      wsRelay.broadcastUpdate('SCRATCH_CARD_UPDATE', updated);
      localMesh.broadcastLocally('SCRATCH_CARD_UPDATE', updated, prev.activeUser);
      return {
        ...prev,
        scratchCards: updated
      };
    });
  };

  const handleRedeemScratchCard = (cardId: string) => {
    setState(prev => {
      const updated = prev.scratchCards.map(c =>
        c.id === cardId ? { ...c, isRedeemed: true, redeemedAt: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) } : c
      );
      wsRelay.broadcastUpdate('SCRATCH_CARD_UPDATE', updated);
      localMesh.broadcastLocally('SCRATCH_CARD_UPDATE', updated, prev.activeUser);
      return {
        ...prev,
        scratchCards: updated
      };
    });
  };

  const handleUpdateGarden = (updated: HearthGardenState) => {
    setState(prev => ({
      ...prev,
      hearthGarden: updated
    }));
    wsRelay.broadcastUpdate('GARDEN_UPDATE', updated);
    localMesh.broadcastLocally('GARDEN_UPDATE', updated, state.activeUser);
  };

  const handleUpdateSoftLanding = (session: SoftLandingSession | null) => {
    setState(prev => ({
      ...prev,
      activeSoftLanding: session
    }));
    wsRelay.broadcastUpdate('SOFT_LANDING_UPDATE', session);
    localMesh.broadcastLocally('SOFT_LANDING_UPDATE', session, state.activeUser);
  };

  const handleSaveSoftLandingHistory = (resolvedSession: SoftLandingSession) => {
    setState(prev => ({
      ...prev,
      softLandingHistory: [resolvedSession, ...prev.softLandingHistory]
    }));
  };

  /**
   * One memo per message, rather than the whole letterbox each time.
   *
   * Every memo carries its own recording, so sending the list meant sending
   * every recording again on every change - past a few memos that is more
   * than a single relay message can hold, and the memo simply did not arrive.
   */
  const handleAddWhisperMemo = (newMemo: WhisperMemoItem) => {
    shareUpdate(WHISPER_MEMO, newMemo);
    setState(prev => ({
      ...prev,
      whisperMemos: [newMemo, ...prev.whisperMemos]
    }));
  };

  const handleMarkWhisperListened = (memoId: string) => {
    // Just the fact that it was heard - not the recording all over again.
    shareUpdate(WHISPER_MEMO_HEARD, { id: memoId, at: Date.now() });
    setState(prev => {
      const updated = prev.whisperMemos.map(m =>
        m.id === memoId ? { ...m, isListened: true, listenedAt: 'Just now' } : m
      );
      return {
        ...prev,
        whisperMemos: updated
      };
    });
  };

  const handleUpdateNightstand = (updated: NightstandState) => {
    setState(prev => ({
      ...prev,
      nightstand: updated
    }));
    wsRelay.broadcastUpdate('NIGHTSTAND_UPDATE', updated);
    localMesh.broadcastLocally('NIGHTSTAND_UPDATE', updated, state.activeUser);
  };

  const handleSendMidnightKiss = (note?: string) => {
    const timestamp = Date.now();
    const payload = {
      timestamp,
      from: state.activeUser,
      note
    };
    setState(prev => ({
      ...prev,
      nightstand: {
        ...prev.nightstand,
        lastMidnightKissAt: timestamp,
        lastMidnightKissFrom: state.activeUser,
        lastMidnightKissNote: note
      }
    }));
    wsRelay.broadcastUpdate('NIGHTSTAND_KISS', payload);
    localMesh.broadcastLocally('NIGHTSTAND_KISS', payload, state.activeUser);
  };

  const handleAddPin = (pin: MemoryCoordinatePin) => {
    setState(prev => {
      const updated = [pin, ...prev.coordinatePins];
      wsRelay.broadcastUpdate('COORDINATES_UPDATE', updated);
      localMesh.broadcastLocally('COORDINATES_UPDATE', updated, prev.activeUser);
      return { ...prev, coordinatePins: updated };
    });
  };

  const handleDeletePin = (pinId: string) => {
    setState(prev => {
      const updated = prev.coordinatePins.filter(p => p.id !== pinId);
      wsRelay.broadcastUpdate('COORDINATES_UPDATE', updated);
      localMesh.broadcastLocally('COORDINATES_UPDATE', updated, prev.activeUser);
      return { ...prev, coordinatePins: updated };
    });
  };

  const handleToggleFavoritePin = (pinId: string) => {
    setState(prev => {
      const updated = prev.coordinatePins.map(p =>
        p.id === pinId ? { ...p, isFavorite: !p.isFavorite } : p
      );
      wsRelay.broadcastUpdate('COORDINATES_UPDATE', updated);
      localMesh.broadcastLocally('COORDINATES_UPDATE', updated, prev.activeUser);
      return { ...prev, coordinatePins: updated };
    });
  };

  const handleUpdateRadio = (updated: MidnightRadioState) => {
    setState(prev => ({
      ...prev,
      midnightRadio: updated
    }));
    wsRelay.broadcastUpdate('MIDNIGHT_RADIO_SYNC', updated);
    localMesh.broadcastLocally('MIDNIGHT_RADIO_SYNC', updated, state.activeUser);
  };

  const handleSendRadioWhisper = (text: string) => {
    const whisper: RadioWhisper = {
      id: newId('whisper'),
      senderId: state.activeUser,
      senderName: state.activeUser === 'user' ? 'You' : 'Partner',
      text,
      timestamp: Date.now()
    };
    setState(prev => ({
      ...prev,
      midnightRadio: {
        ...prev.midnightRadio,
        whispers: [whisper, ...(prev.midnightRadio.whispers || [])]
      }
    }));
    wsRelay.broadcastUpdate('MIDNIGHT_RADIO_WHISPER', whisper);
    localMesh.broadcastLocally('MIDNIGHT_RADIO_WHISPER', whisper, state.activeUser);
  };

  const handleUpdateStateOfUnion = (session: StateOfUnionSession) => {
    setState(prev => ({
      ...prev,
      activeStateOfUnion: session
    }));
    wsRelay.broadcastUpdate('STATE_OF_UNION_UPDATE', session);
    localMesh.broadcastLocally('STATE_OF_UNION_UPDATE', session, state.activeUser);
  };

  const handleSealStateOfUnion = (session: StateOfUnionSession) => {
    setState(prev => ({
      ...prev,
      activeStateOfUnion: null,
      stateOfUnionHistory: [session, ...prev.stateOfUnionHistory]
    }));
    wsRelay.broadcastUpdate('STATE_OF_UNION_SEAL', session);
    localMesh.broadcastLocally('STATE_OF_UNION_SEAL', session, state.activeUser);
  };

  const handleAddCanvasStroke = (stroke: DrawStroke) => {
    setState(prev => ({
      ...prev,
      sharedCanvas: {
        ...prev.sharedCanvas,
        strokes: [...prev.sharedCanvas.strokes, stroke],
        lastUpdated: Date.now()
      }
    }));
    wsRelay.broadcastUpdate('CANVAS_STROKE', stroke);
    localMesh.broadcastLocally('CANVAS_STROKE', stroke, state.activeUser);
  };

  const handleClearCanvas = () => {
    setState(prev => ({
      ...prev,
      sharedCanvas: {
        ...prev.sharedCanvas,
        strokes: [],
        lastUpdated: Date.now()
      }
    }));
    wsRelay.broadcastUpdate('CANVAS_CLEAR', true);
    localMesh.broadcastLocally('CANVAS_CLEAR', true, state.activeUser);
  };

  const handleUndoCanvasStroke = () => {
    setState(prev => ({
      ...prev,
      sharedCanvas: {
        ...prev.sharedCanvas,
        strokes: prev.sharedCanvas.strokes.slice(0, -1),
        lastUpdated: Date.now()
      }
    }));
    wsRelay.broadcastUpdate('CANVAS_UNDO', true);
    localMesh.broadcastLocally('CANVAS_UNDO', true, state.activeUser);
  };

  const handleSaveCanvasSketch = (sketch: CanvasSavedSketch) => {
    setState(prev => ({
      ...prev,
      sharedCanvas: {
        ...prev.sharedCanvas,
        savedSketches: [sketch, ...(prev.sharedCanvas.savedSketches || [])]
      }
    }));
    wsRelay.broadcastUpdate('CANVAS_SAVE_SKETCH', sketch);
    localMesh.broadcastLocally('CANVAS_SAVE_SKETCH', sketch, state.activeUser);
  };

  const handleSendRepair = (letter: RepairLetter) => {
    setState(prev => ({
      ...prev,
      repairLetters: [letter, ...prev.repairLetters.filter(l => l.id !== letter.id)]
    }));
    wsRelay.broadcastUpdate('REPAIR_BRIDGE_SEND', letter);
    localMesh.broadcastLocally('REPAIR_BRIDGE_SEND', letter, state.activeUser);
  };

  const handleRespondRepair = (letterId: string, status: RepairStatus, note?: string) => {
    const payload = { letterId, status, note };
    setState(prev => ({
      ...prev,
      repairLetters: prev.repairLetters.map(l =>
        l.id === letterId
          ? {
              ...l,
              status,
              recipientResponseNote: note,
              resolvedAt: status === 'accepted' ? Date.now() : l.resolvedAt
            }
          : l
      )
    }));
    wsRelay.broadcastUpdate('REPAIR_BRIDGE_RESPOND', payload);
    localMesh.broadcastLocally('REPAIR_BRIDGE_RESPOND', payload, state.activeUser);
  };

  const handleAddKintsugiMoment = (moment: KintsugiVesselItem) => {
    setState(prev => ({
      ...prev,
      kintsugiMoments: [moment, ...prev.kintsugiMoments.filter(m => m.id !== moment.id)]
    }));
    wsRelay.broadcastUpdate('KINTSUGI_ADD', moment);
    localMesh.broadcastLocally('KINTSUGI_ADD', moment, state.activeUser);
  };

  const handleCherishKintsugiMoment = (momentId: string, note?: string) => {
    const payload = { momentId, note };
    setState(prev => ({
      ...prev,
      kintsugiMoments: prev.kintsugiMoments.map(m =>
        m.id === momentId
          ? {
              ...m,
              isCherished: true,
              cherishedAt: Date.now(),
              cherishedNote: note
            }
          : m
      )
    }));
    wsRelay.broadcastUpdate('KINTSUGI_CHERISH', payload);
    localMesh.broadcastLocally('KINTSUGI_CHERISH', payload, state.activeUser);
  };

  const handleAddMilestone = (newMs: RelationshipMilestone) => {
    shareUpdate(MILESTONE_ADD, newMs);
    setState(prev => ({
      ...prev,
      milestones: [...prev.milestones, newMs]
    }));
  };

  /**
   * Sets the couple's dates on both phones.
   *
   * Sent whole and stamped, so the newest setting is the one both phones
   * keep (see OUR_DATES). Stamped just after whatever this phone already
   * holds when the other phone's clock runs ahead, so a change made here
   * always takes. Applied here through the same reducer the other phone
   * uses, so both arrive at exactly the same value.
   */
  /** Saves days for "Coming up" on both phones: every day goes, each with its own stamp. */
  const handleSaveComingUp = (changes: ComingUpDay[]) => {
    const days = mergeDays(state.comingUp, changes);
    setState(prev => ({ ...prev, comingUp: mergeDays(prev.comingUp, changes) }));
    wsRelay.broadcastUpdate(COMING_UP, { days });
  };

  const handleSetOurDates = (dates: { togetherSince?: string; anniversary?: string }) => {
    const at = Math.max(Date.now(), (state.ourDates?.at ?? 0) + 1);
    const record = { ...dates, at };
    shareUpdate(OUR_DATES, record);
    setState(prev => applySharedRecord(prev, OUR_DATES, record, prev.activeUser) ?? prev);
  };

  /**
   * This phone's answer to today's question, on both phones.
   *
   * Applied here through the same reducer the other phone uses, so the first
   * answer stands on both - and a second tap, or a second device in the same
   * seat, cannot replace one the other person may already have read.
   */
  const handleAnswerQuestion = (answer: { day: string; questionId: string; prompt: string; text: string }) => {
    const record = { ...answer, seat: state.activeUser, at: Date.now() };
    shareUpdate(DAILY_ANSWER, record);
    setState(prev => applySharedRecord(prev, DAILY_ANSWER, record, prev.activeUser) ?? prev);
  };

  const handleAddStar = (newStar: GratitudeStar) => {
    wsRelay.broadcastUpdate('GRATITUDE_STAR', newStar);
    localMesh.broadcastLocally('GRATITUDE_STAR', newStar, state.activeUser);
    setState(prev => ({
      ...prev,
      constellationStars: [newStar, ...prev.constellationStars]
    }));
  };

  const handleUpdateCareCompass = (profile: CareCompassProfile) => {
    const isUser = state.activeUser === 'user';
    const updatedCompass = {
      ...state.careCompass,
      [isUser ? 'user' : 'partner']: profile
    };
    setState(prev => ({
      ...prev,
      careCompass: updatedCompass
    }));
    wsRelay.broadcastUpdate('CARE_COMPASS', { authorId: state.activeUser, profile });
    localMesh.broadcastLocally('CARE_COMPASS', { authorId: state.activeUser, profile }, state.activeUser);
  };

  const handleSaveComfortBox = (newBox: ComfortBoxData) => {
    setState(prev => ({ ...prev, comfortBoxes: withBox(prev.comfortBoxes, newBox) }));
    wsRelay.broadcastUpdate('COMFORT_BOX', newBox);
    localMesh.broadcastLocally('COMFORT_BOX', newBox, state.activeUser);
  };

  const handleAddRecipe = (newRecipe: SecretRecipe) => {
    setState(prev => ({
      ...prev,
      recipes: [newRecipe, ...prev.recipes]
    }));
    wsRelay.broadcastUpdate('RECIPE_ADD', newRecipe);
    localMesh.broadcastLocally('RECIPE_ADD', newRecipe, state.activeUser);
  };

  /**
   * Ticks an ingredient on or off - saying which, so the other phone sets the
   * same and a resend or a restore cannot flip it back.
   */
  const handleSetIngredient = (recipeId: string, ingredientId: string, checked: boolean) => {
    const tick = { recipeId, ingredientId, checked };
    setState(prev => ({ ...prev, recipes: applyIngredientTick(prev.recipes, tick) }));
    wsRelay.broadcastUpdate('INGREDIENT_TOGGLE', tick);
    localMesh.broadcastLocally('INGREDIENT_TOGGLE', tick, state.activeUser);
  };

  const handleUpdateIntuitionRound = (updatedRound: IntuitionGameRound) => {
    setState(prev => ({
      ...prev,
      intuitionRounds: [updatedRound, ...prev.intuitionRounds.filter(r => r.id !== updatedRound.id)]
    }));
    wsRelay.broadcastUpdate('INTUITION_ROUND', updatedRound);
    localMesh.broadcastLocally('INTUITION_ROUND', updatedRound, state.activeUser);
  };

  const handleNewDilemma = () => {
    const nextDilemma = CURATED_DILEMMAS[Math.floor(Math.random() * CURATED_DILEMMAS.length)];
    const newRound: IntuitionGameRound = {
      id: newId('round'),
      date: 'Today',
      dilemma: nextDilemma,
      authorId: state.activeUser,
      authorChoice: undefined,
      partnerGuess: undefined,
      revealed: false
    };
    handleUpdateIntuitionRound(newRound);
  };

  /**
   * Hides Two at once and deletes nothing.
   *
   * With a PIN it locks: the reload brings back the PIN screen. Without one
   * there is nothing to lock back to, so it puts up the calculator, which the
   * calculator code (or holding its display) takes down again. A call goes
   * first, hung up properly so the other phone hears it end rather than
   * waiting on a connection that will never come back.
   */
  const handleQuickExit = () => {
    const inCall = !!callEngineRef.current?.busy;
    callEngineRef.current?.endForDisguise();
    if (vaultKey || hasEncryptedVault()) {
      // A moment for the hang-up to leave before the reload cuts the connection.
      if (inCall) setTimeout(lockSafely, 300);
      else lockSafely();
    } else {
      setIsCamouflaged(true);
    }
  };

  /**
   * Erases this phone: every message, photo and note, and the pairing.
   *
   * Only ever reached through the question in Settings that says so. It used to
   * sit behind the Tools card "Quick Exit", one tap and no question.
   */
  const handleEmergencyExit = () => {
    // Wipe the encrypted vault too, or the panic button leaves everything behind.
    updateWidget(null);
    clearState();
    void clearMedia();
    clearSpaceSession();
    destroyVault();
    // And the copy of the PIN the phone kept for the fingerprint.
    disableFingerprint();
    window.location.reload();
  };

  const themeClass = {
    // The canvas lets the Aurora sky drawn behind the page show through.
    linen: 'app-canvas text-linen-primary',
    slate: 'bg-slate-bg text-slate-primary dark',
    forest: 'bg-forest-bg text-forest-primary',
    terracotta: 'bg-terracotta-bg text-terracotta-primary'
  }[theme];

  const callOverlay = (
    <CallOverlay
      call={callState}
      myName={state.userName || 'You'}
      partnerName={state.partnerName || 'Partner'}
      partnerOnline={partnerOnline}
      voiceLevels={callVoiceLevels}
      onAccept={() => void callEngineRef.current?.accept()}
      onDecline={() => callEngineRef.current?.decline()}
      onHangup={() => callEngineRef.current?.hangup()}
      onToggleMute={() => callEngineRef.current?.toggleMute()}
      onToggleSpeaker={() => callEngineRef.current?.toggleSpeaker()}
    />
  );

  if (isCamouflaged) {
    return (
      <CalculatorDecoy
        onUnlock={() => setIsCamouflaged(false)}
        secretPin={decoyCode}
        onEscape={handleDecoyEscape}
      />
    );
  }

  /**
   * Moves the space to a new link code.
   *
   * The code is the whole secret, so rotating it is how a couple recovers from
   * one being overheard or screenshotted: the new code derives a different room
   * and a different key, and the old room's ciphertext becomes unreadable to
   * both of them. Local history is untouched - it lives in the vault, not in
   * the space.
   */
  const handleRotateCode = (newCode: string, joinPhrase?: string) => {
    if (!session || (newCode === session.code && joinPhrase === session.joinPhrase)) return;

    // An explicit phrase replaces whatever this device had; omitting it keeps
    // the current one, so rotating your own code does not silently drop it.
    const rotated = {
      ...session,
      code: newCode,
      joinPhrase: joinPhrase !== undefined ? joinPhrase : session.joinPhrase
    };
    setSession(rotated);
    if (!vaultKey) saveSpaceSession(rotated);
    setSpaceVersion(v => v + 1);
  };


  /** Accepts the current occupancy as normal, without naming a device. */

  /**
   * Rotating is the only response that actually removes someone: it derives a
   * new room and a new key, so the code they hold stops working.
   */

  /** Renames the space on both devices. */
  const handleRenameVault = (name: string) => {
    const clean = name.trim().slice(0, 40);
    setState(prev => ({ ...prev, vaultName: clean }));
    wsRelay.broadcastUpdate('VAULT_NAME', { name: clean });
    localMesh.broadcastLocally('VAULT_NAME', { name: clean }, state.activeUser);
  };

  /**
   * Your own name, changed in Settings (core/names). It goes to your partner,
   * and to your other devices, with the NAME_EXCHANGE announced on every
   * change of name - stamped, so an older one heard later does not undo it.
   */
  const handleChangeName = (raw: string) => {
    const name = cleanName(raw);
    if (nameProblem(name) || name === state.userName) return;
    const old = (state.userName || '').trim();
    // Still you: another device of yours saying it, before it hears of the
    // change, is not somebody else in your seat.
    if (isRealName(old)) rememberOwnDeviceName(old);
    const setAt = nameStampFor(state.userNameSetAt);
    setState(prev => ({ ...prev, userName: name, userNameSetAt: setAt }));
    const currentSession = loadSpaceSession();
    if (currentSession) saveSpaceSession({ ...currentSession, userName: name });
  };

  /**
   * Sets, changes, or removes the app-lock PIN after onboarding.
   *
   * The PIN was previously offered once, on the screen that creates a space -
   * which meant the partner who joined was never asked and could not lock
   * their own device at all, and neither of them could change or remove one
   * afterwards. It is a property of a device, not of the space, so each of you
   * sets your own and they need not match.
   *
   * A wrong current PIN is caught by trying to open the vault with it. There
   * is no stored PIN to compare against: the PIN derives the key, and the
   * wrong one simply fails to decrypt.
   */
  const handleUpdatePin = async (
    currentPin: string | null,
    nextPin: string | null
  ): Promise<'ok' | 'wrong-pin' | 'busy' | 'error'> => {
    if (hasEncryptedVault()) {
      const opened = await unlockVault(currentPin ?? '');
      if (!opened) return 'wrong-pin';
    }

    // Photos and voice memos are encrypted under the vault key, so a new PIN
    // means writing every one of them again. That needs the bytes themselves,
    // which are only in memory once hydration has finished.
    if (!mediaReady) return 'busy';

    try {
      if (nextPin) {
        // The old ciphertext cannot be read under the new key, so drop it
        // first; forStorage below writes every piece back under the new one.
        await clearMedia();

        const key = await createVault(nextPin, newKey => ({
          state: forStorage(state, newKey),
          session
        }));

        setVaultKey(key);
        // Remove the plaintext copies this device kept while it had no PIN -
        // including the link code, which is the key to the whole space.
        clearState();
        clearSpaceSession();
        setState(prev => ({ ...prev, pinEnabled: true }));
        // The phone's copy is of the old PIN; Settings offers one touch to
        // keep fingerprint unlock on with the new one.
        disableFingerprint();
        return 'ok';
      }

      // Removing the lock: media goes back to being stored unencrypted, so it
      // has to be rewritten just the same.
      await clearMedia();
      destroyVault();
      setVaultKey(null);
      setStorageFull(saveState(forStorage({ ...state, pinEnabled: false })).quotaExceeded);
      if (session) saveSpaceSession(session);
      setState(prev => ({ ...prev, pinEnabled: false }));
      disableFingerprint();
      return 'ok';
    } catch (e) {
      console.error('[Vault] Could not change the app lock', e);
      return 'error';
    }
  };

  const handleUnpair = async () => {
    const sure = await askConfirm({
      title: 'Disconnect from this space?',
      body: 'You can reconnect any time with your space link code.',
      confirm: 'Disconnect',
      danger: true
    });
    if (sure) {
      updateWidget(null);
      // Kept for "Rejoin": coming back is what this message promises. With a
      // PIN it is kept inside the vault, with everything else - never in plain
      // storage, where enabling the PIN was meant to stop the code being.
      clearSpaceSession({ keepRejoin: true });
      wsRelay.disconnect();
      const remembered = session
        ? { code: session.code, role: session.role, joinPhrase: session.joinPhrase || undefined }
        : undefined;
      setSession(null);
      setState(prev => ({
        ...prev,
        isPaired: false,
        rejoinSpace: vaultKey ? remembered ?? prev.rejoinSpace : undefined
      }));
      setSpaceVersion(v => v + 1);
    }
  };

  // App Lock PIN Screen. The vault is genuinely encrypted, so this is not a
  // comparison against a stored PIN - the PIN derives the key, and a wrong one
  // simply fails to decrypt.


  if (isLocked) {
    /**
     * A wrong PIN, felt and seen: a refusing buzz, and the four boxes shake
     * their heads the way the phone's own lock screen does. The red boxes on
     * their own were easy to miss with a thumb over them.
     *
     * The shake is skipped for anyone who has asked their phone for less
     * motion; the buzz and the red stay.
     */
    const refusePin = () => {
      haptic('reject');
      const dots = document.querySelector<HTMLElement>('[data-pin-dots]');
      if (!dots || typeof dots.animate !== 'function') return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      dots.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-10px)' },
          { transform: 'translateX(8px)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(3px)' },
          { transform: 'translateX(0)' }
        ],
        { duration: 380, easing: 'ease-out' }
      );
    };

    const attemptUnlock = (secret: string) => {
      if (!secret || isUnlocking) return;

      // Refuse before deriving anything. Checked here rather than only in the
      // UI so that a wait cannot be skipped by reloading the page, which is
      // what re-enables every button on this screen.
      const waiting = lockoutRemaining();
      if (waiting > 0) {
        setLockoutLeft(waiting);
        refusePin();
        setPinError(true);
        setTimeout(() => {
          setPinAttempt('');
          setPinError(false);
        }, 700);
        return;
      }

      setIsUnlocking(true);
      void unlockVault(secret)
        .then(opened => {
          if (opened) {
            finishUnlock(opened);
          } else {
            const penalty = registerFailure();
            setLockoutLeft(penalty);
            refusePin();
            setPinError(true);
            setTimeout(() => {
              setPinAttempt('');
              setPinError(false);
            }, 700);
          }
        })
        .finally(() => setIsUnlocking(false));
    };

    /**
     * Wipes this device and starts over.
     *
     * The escape hatch matters because a vault can outlive the thing that
     * created it: an account password sealed one during the login experiment,
     * and a four-digit keypad cannot express a password. Without this the only
     * way out would be clearing site data by hand.
     */
    const startFresh = async () => {
      const sure = await askConfirm({
        title: 'Start fresh on this device?',
        body:
          'Everything stored here will be erased. If you know your space link code you can ' +
          'enter it again, and your shared history will come back from the relay.',
        confirm: 'Erase and start fresh',
        danger: true
      });
      if (!sure) return;
      updateWidget(null);
      destroyVault();
      disableFingerprint();
      clearState();
      void clearMedia();
      clearSpaceSession();
      window.location.reload();
    };

    const handlePinInput = (val: string) => {
      if (isUnlocking || lockoutLeft > 0) return;
      // The click the phone's own keyboard gives, so each digit is felt as
      // well as seen.
      haptic('key');
      const next = (pinAttempt + val).slice(0, 4);
      setPinAttempt(next);
      setPinError(false);

      if (next.length === 4) attemptUnlock(next);
    };

    return (
      <div className="min-h-screen app-min-vh app-canvas flex items-center justify-center p-4">
        <div className="max-w-xs w-full bg-linen-surface/70 backdrop-blur-xl border border-linen-border rounded-[32px] p-8 shadow-xs text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[22px] bg-linen-primary text-linen-surface shadow-glow">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-semibold text-linen-primary">Sanctuary Locked</h2>
            <p className="text-xs text-linen-secondary mt-1">
              {isUnlocking
                ? 'Opening…'
                : lockoutLeft > 0
                ? 'Too many wrong PINs'
                : 'Enter your 4-digit PIN to open'}
            </p>
          </div>

          {/* The wait, counted down. Saying how long is not a courtesy to
              somebody guessing - they can see the keypad is dead either way -
              it is so that you, having fumbled your own PIN, know the app is
              waiting rather than broken. */}
          {lockoutLeft > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
              <p className="text-sm font-semibold">
                Try again in {formatWait(lockoutLeft)}
              </p>
              {isUnderSuspicion() && (
                <p className="mt-1 text-[11px] leading-relaxed">
                  Each wrong PIN now waits longer than the last. Nothing here is
                  deleted and nothing is sent anywhere &mdash; if this is your device,
                  the wait is the only cost.
                </p>
              )}
            </div>
          )}

          <div data-pin-dots className="flex justify-center space-x-3 py-2">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-11 h-12 rounded-2xl border flex items-center justify-center text-xl font-mono transition-all ${
                  lockoutLeft > 0
                    ? 'border-linen-border bg-linen-variant/30 text-linen-secondary/30'
                    : pinError
                    ? 'border-red-500 bg-red-50 text-red-600'
                    : pinAttempt.length > idx
                    ? 'border-transparent bg-linen-primary text-linen-surface font-bold shadow-glow scale-105'
                    : 'border-linen-border bg-linen-variant/40 text-linen-secondary/30'
                }`}
              >
                {pinAttempt.length > idx ? '•' : ''}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-x-5 gap-y-3 max-w-[236px] mx-auto pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
              <button
                key={btn}
                onClick={() => {
                  if (btn === 'C' || btn === '⌫') {
                    haptic('key');
                    if (btn === 'C') setPinAttempt('');
                    else setPinAttempt(prev => prev.slice(0, -1));
                  } else handlePinInput(btn);
                }}
                disabled={lockoutLeft > 0}
                className="h-[60px] w-[60px] mx-auto rounded-full border border-linen-border bg-linen-variant/40 hover:bg-linen-variant active:scale-90 active:bg-linen-variant text-linen-primary text-xl font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-linen-variant/40"
              >
                {btn}
              </button>
            ))}
          </div>
          {(fingerprintOn || fingerprintNote) && (
            <div className="space-y-2">
              {fingerprintOn && (
                <button
                  type="button"
                  onClick={() => void askFingerprint()}
                  disabled={isUnlocking}
                  className="mx-auto inline-flex items-center gap-2 rounded-full border border-linen-border bg-linen-variant/40 px-4 py-2 text-xs font-medium text-linen-primary hover:bg-linen-variant active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Fingerprint className="h-4 w-4 text-aurora-pink" />
                  Use fingerprint
                </button>
              )}
              {fingerprintNote && (
                <p role="status" className="text-[11px] leading-relaxed text-linen-secondary">
                  {fingerprintNote}
                </p>
              )}
            </div>
          )}
          {/* A vault can outlive whatever created it. The login experiment sealed
              some with an account password, which a four-digit keypad cannot
              express - without this those devices would be permanently shut. */}
          <div className="pt-1 space-y-2">
            <input
              type="password"
              value={passphraseAttempt}
              onChange={(e) => setPassphraseAttempt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && attemptUnlock(passphraseAttempt)}
              disabled={lockoutLeft > 0}
              placeholder="…or the password you used before"
              className="w-full px-3 py-2.5 rounded-xl border border-linen-border bg-linen-variant/40 text-sm text-linen-primary text-center placeholder:text-linen-secondary/60 focus:outline-hidden focus:ring-2 focus:ring-linen-primary"
            />
            <button
              onClick={() => attemptUnlock(passphraseAttempt)}
              disabled={!passphraseAttempt || isUnlocking || lockoutLeft > 0}
              className="w-full py-2.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
            >
              Unlock
            </button>
          </div>

          <button
            onClick={startFresh}
            className="w-full text-[11px] text-linen-secondary hover:text-rose-700 transition-colors cursor-pointer"
          >
            I never set a PIN — start fresh on this device
          </button>

        </div>
      </div>
    );
  }

  /**
   * Media is still being read back out of IndexedDB.
   *
   * Only reached when this space actually has photos or voice memos stored, and
   * only for as long as they take to read - rendering underneath would put
   * empty frames on screen that fill in a moment later.
   */
  if (!mediaReady) {
    return (
      <div className="min-h-screen app-min-vh app-canvas flex items-center justify-center">
        {/* Inlined rather than loaded from /icon-192.svg: inside the Android
            WebView the assets are served from a base this path would miss. */}
        <svg
          viewBox="0 0 108 108"
          className="w-14 h-14 animate-pulse"
          fill="none"
          strokeLinecap="round"
          aria-label="Loading"
        >
          {/* The app's mark: two circles and the space they share. */}
          <defs>
            <linearGradient id="loading-a" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#C4B5FD" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>
            <linearGradient id="loading-b" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F472B6" />
              <stop offset="1" stopColor="#FB923C" />
            </linearGradient>
          </defs>
          <circle cx="44" cy="54" r="18" fill="url(#loading-a)" />
          <circle cx="64" cy="54" r="18" fill="url(#loading-b)" />
          <path d="M54,39.03 A18,18 0 0 1 54,68.97 A18,18 0 0 1 54,39.03 Z" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  if (!session || !state.isPaired) {
    return (
      <Suspense fallback={<ScreenFallback />}>
      <OnboardingView
        onComplete={(newSession: SpaceSession, enteredName: string, chosenPin: string | null, chosenVaultName?: string) => {
          const namedSession = { ...newSession, userName: enteredName };

          // The partner who created the space is 'user'; the joiner is
          // 'partner'. Every record on the wire is attributed with this role.
          const nextState: SpaceState = {
            ...state,
            isPaired: true,
            activeUser: newSession.role,
            userName: enteredName,
            // Still protected if a vault was already in use: joining again
            // does not take the PIN away.
            pinEnabled: !!chosenPin || !!vaultKey,
            vaultName: chosenVaultName?.trim() || state.vaultName
          };

          setSession(namedSession);
          setState(nextState);
          setSpaceVersion(v => v + 1);

          if (nextState.vaultName) {
            // Fire once the relay is up so the partner adopts the same name.
            setTimeout(() => wsRelay.broadcastUpdate('VAULT_NAME', { name: nextState.vaultName }), 1500);
          }

          if (chosenPin) {
            // Encrypt everything under the PIN, then remove the cleartext
            // copies - including the pairing code, which is the key to the
            // whole space on the relay.
            void createVault(chosenPin, { state: nextState, session: namedSession })
              .then(key => {
                setVaultKey(key);
                clearState();
                clearSpaceSession();
              })
              .catch(e => {
                // Don't claim protection we failed to apply.
                console.error('[Vault] Could not enable PIN protection', e);
                setState(prev => ({ ...prev, pinEnabled: false }));
                saveSpaceSession(namedSession);
              });
          } else if (!vaultKey) {
            saveSpaceSession(namedSession);
          }
          // With a vault already in use the session goes into it, through the
          // persistence effect, and nowhere else.
        }}
        rememberedSpace={vaultKey ? state.rejoinSpace ?? null : null}
        vaultActive={!!vaultKey}
      />
      </Suspense>
    );
  }

  /**
   * Group mode.
   *
   * An early return rather than a branch inside the sanctuary's render: the
   * couple's screens, its dock, its header and its modals are all below this
   * line and none of them run while a group is open. A group cannot reach
   * them, and they cannot reach a group.
   */
  const activeGroup = activeGroupId
    ? state.groups.find(g => g.id === activeGroupId) || null
    : null;

  if (activeGroup) {
    // Derived, never stored: a timestamp older than the window simply stops
    // counting, so nothing has to remember to delete it.
    const typingIds = Object.entries(groupTyping[activeGroup.id] || {})
      .filter(([, at]) => Date.now() - at < TYPING_TTL_MS)
      .map(([id]) => id);
    return (
      <LocaleContext.Provider value={locale}>
      <div className={`min-h-screen app-min-vh transition-colors duration-200 ${themeClass}`}>
        <main className={`mx-auto px-4 py-4 sm:px-6 ${isTablet ? 'max-w-5xl' : 'max-w-3xl'}`}>
          <Suspense fallback={<ScreenFallback />}>
            <GroupChatView
              // One screen per group, not one screen re-pointed at another.
              // Switching groups then leaves the old one behind entirely: a
              // voice note being recorded or listened back is discarded and
              // the microphone let go, instead of carrying over and being
              // sent - into a room it was never meant for - by the next tap
              // on Send. Half-typed text is left behind the same way, rather
              // than following you into the next group's box.
              key={activeGroup.id}
              group={activeGroup}
              myId={myMemberId()}
              connected={groupStatuses[activeGroup.id] === 'connected'}
              typingIds={typingIds}
              shareReceipts={shareReceipts}
              onSend={(text) => handleSendGroupMessage(activeGroup.id, text)}
              onSendVoice={(note) =>
                handleSendGroupMessage(
                  activeGroup.id,
                  voiceNoteLabel(note.durationSeconds),
                  voiceFieldsOf(note)
                )
              }
              onVoicePlayed={(messageId) => handleGroupVoicePlayed(activeGroup.id, messageId)}
              draft={state.chatDrafts?.[activeGroup.id]}
              onSaveDraft={draft => handleSaveDraft(activeGroup.id, draft)}
              callInProgress={callState.phase !== 'idle'}
              onTyping={() => {
                if (!readShareReceipts()) return;
                signalToGroup(activeGroup.id, TYPING_SIGNAL, { from: myMemberId() });
              }}
              onRename={
                activeGroup.founder
                  ? (name) => handleRenameGroup(activeGroup.id, name)
                  : undefined
              }
              onResolveStuck={(messageId, action) =>
                handleResolveStuck({ groupId: activeGroup.id }, messageId, action)
              }
            />
          </Suspense>
        </main>

        {/* A couple call can ring while a group is open, so group mode
            carries the call screen too. */}
        {callOverlay}

        {/* Notices about groups - a message in another group, a voice note
            too large to send in this one - are shown here too, or they would
            wait unseen until group mode was left. The couple's own keep
            waiting for the sanctuary, as they always have. */}
        <InAppNotificationToast
          notification={inAppNotification?.tabId.startsWith('group:') ? inAppNotification : null}
          onDismiss={() => setInAppNotification(null)}
          onOpenTab={(tabId) => {
            if (tabId.startsWith('group:')) setActiveGroupId(tabId.slice('group:'.length));
          }}
        />

        <GroupDock
          groups={state.groups}
          activeGroupId={activeGroup.id}
          onSelectGroup={(id) => setActiveGroupId(id)}
          onLeaveGroupMode={() => setActiveGroupId(null)}
          unreadByGroup={Object.fromEntries(
            state.groups.map(g => [g.id, unreadCount(g, myMemberId())])
          )}
        />

        <SensoryPulseOverlay activeUser={state.activeUser} partnerName={state.partnerName} />
      </div>
      </LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={locale}>
    <div className={`min-h-screen app-min-vh transition-colors duration-200 ${themeClass}`}>
      <div ref={headerRef}>
      <Navigation
        compact={inApp}
        openToolsSignal={toolsSignal}
        openHeartSignal={heartSignal}
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        activeUser={state.activeUser}
        onToggleActiveUser={toggleActiveUser}
        onQuickExit={handleQuickExit}
        hasPin={!!vaultKey || hasEncryptedVault()}
        onToggleCamouflage={() => setIsCamouflaged(true)}
        onOpenStoryTour={() => setShowStoryTour(true)}
        onTriggerPulse={() => triggerGlobalPulse(heartKind('warm_hug').note, 'warm_hug')}
        locale={locale}
        relayStatus={relayStatus}
        unreadChatCount={unreadChatCount}
        onOpenDirectory={() => setShowDirectoryModal(true)}
        partnerName={state.partnerName}
        vaultName={state.vaultName}
        partnerOnline={partnerOnline}
      />


      {session && isWeakPairingCode(session.code) && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
          <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-900">
            <p className="text-sm font-semibold">Your link code is from an older, weaker format</p>
            <p className="text-xs mt-1 leading-relaxed">
              Short codes like <span className="font-mono">TWO-8492</span> can be guessed, which would let
              someone else read this space. Disconnect in Settings and link again to get a longer code.
              Your history on this device stays where it is.
            </p>
          </div>
        </div>
      )}

      {storageFull && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
            <p className="text-sm font-semibold">This device is out of storage</p>
            <p className="text-xs mt-1 leading-relaxed">
              Everything still works right now, but nothing new is being saved and it will be lost
              if you refresh. Free up space on your device, or export a vault backup from Settings.
            </p>
          </div>
        </div>
      )}

      </div>

      <main
        className={`mx-auto px-4 sm:px-6 ${
          currentTab === 'chat'
            ? 'py-4'
            : `py-6 ${inApp ? 'pb-32' : 'pb-20'}`
        } ${isTablet ? 'max-w-5xl' : 'max-w-3xl'}`}
      >
        {/* The screens below arrive as separate chunks. Only this region
            waits for one; the navigation around it never moves. Each one
            rises in briefly rather than cutting (screen-enter). */}
        <div key={currentTab} ref={screenRef} data-tab={currentTab} className="screen-enter">
        <Suspense fallback={<ScreenFallback />}>
        {currentTab === 'home' && (
          <HomeView
            state={state}
            onUpdateReport={handleUpdateReport}
            onToggleUserFlag={handleToggleUserFlag}
            // handleSelectTab, not setCurrentTab: arriving from the activity
            // card has to mark the destination read, or the line you just
            // followed would still be sitting there when you came back.
            onNavigate={handleSelectTab}
            // An ordinary message, not a need card: it is a question to
            // talk over, and arrived as "I need: Daily Question [DEEP]".
            onSendQuestion={(text) => handleSendMessage(text, false)}
            onAnswerQuestion={handleAnswerQuestion}
            onSetOurDates={handleSetOurDates}
            onSaveComingUp={handleSaveComingUp}
            onOpenTour={
              showTourCard
                ? () => {
                    setShowTourCard(false);
                    setShowStoryTour(true);
                  }
                : undefined
            }
            onAddMilestone={handleAddMilestone}
            onSaveComfortBox={handleSaveComfortBox}
            onSetStatus={handleSetStatus}
            partnerNews={partnerNews}
            partnerUpdate={(() => {
              const mine = appVersion();
              const theirs = state.partnerApp;
              if (!mine || !theirs || theirs.code >= mine.code) return undefined;
              if (state.partnerUpdateDismissed === theirs.code) return undefined;
              return {
                version: theirs.name,
                onDismiss: () => setState(prev => ({ ...prev, partnerUpdateDismissed: theirs.code }))
              };
            })()}
          />
        )}

        {currentTab === 'groups' && (
          <GroupsView
            groups={state.groups}
            onCreate={handleCreateGroup}
            onJoin={handleJoinGroup}
            onOpen={(id) => setActiveGroupId(id)}
            onLeave={handleLeaveGroup}
          />
        )}

        {currentTab === 'chat' && (
          <ChatView
            messages={state.messages}
            activeUser={state.activeUser}
            onSendMessage={handleSendMessage}
            onResolveStuck={(messageId, action) => handleResolveStuck({}, messageId, action)}
            onStartCall={() => void callEngineRef.current?.start()}
            callInProgress={callState.phase !== 'idle'}
            onOpenSoftLanding={() => setCurrentTab('softlanding')}
            // Until their name arrives, the stand-in in this phone's language (shown, never sent).
            partnerName={state.partnerName && state.partnerName !== 'Partner' ? state.partnerName : tr('Partner')}
            partnerReadAt={state.partnerReadAt}
            partnerStatus={state.statuses?.[state.activeUser === 'user' ? 'partner' : 'user']}
            // Only once their phone has said it can hold a message back:
            // an older one would show it straight away (core/sendLater).
            canSendLater={!!state.partnerApp?.can?.includes(CAN_SHOW_LATER)}
            readAt={chatEntryRef.current.readAt}
            openKey={chatEntryRef.current.key}
            draft={state.chatDrafts?.couple}
            onSaveDraft={draft => handleSaveDraft('couple', draft)}
            relayStatus={relayStatus}
            partnerOnline={partnerOnline}
            // Reciprocal, as every messenger does it: hiding your own last
            // seen hides theirs too, so it cannot become a one-way window.
            partnerLastSeen={shareLastSeen ? state.partnerLastSeen : 0}
            partnerTyping={partnerTypingAt > 0}
            shareReceipts={shareReceipts}
            onVoiceHeard={handleVoiceHeard}
            onReact={handleReactToMessage}
            onEditMessage={handleEditMessage}
            onUnsendMessage={messageId => void handleUnsendMessage(messageId)}
            pins={state.chatPins}
            onPinMessage={handlePinMessage}
            onViewOnceOpened={handleViewOnceOpened}
            onTyping={() => {
              // Read straight from the setting rather than the render's copy:
              // off must mean nothing leaves this device, immediately.
              if (!readShareReceipts()) return;
              wsRelay.sendSignal(TYPING_SIGNAL, { at: Date.now() });
            }}
          />
        )}

        {currentTab === 'softlanding' && (
          <SoftLandingView
            activeSession={state.activeSoftLanding}
            history={state.softLandingHistory}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onUpdateSession={handleUpdateSoftLanding}
            onSaveToHistory={handleSaveSoftLandingHistory}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'nightstand' && (
          <NightstandClockView
            state={state}
            onUpdateNightstand={handleUpdateNightstand}
            onSendMidnightKiss={handleSendMidnightKiss}
            onNavigate={setCurrentTab}
          />
        )}

        {currentTab === 'rituals' && (
          <RitualsGardenView
            rituals={state.rituals}
            pebbles={state.pebbles}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onSetRitualDone={handleSetRitualDone}
            onAddRitual={handleAddRitual}
          />
        )}

        {currentTab === 'garden' && (
          <HearthGardenView
            garden={state.hearthGarden}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            myName={state.userName}
            onUpdateGarden={handleUpdateGarden}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'constellation' && (
          <ConstellationView
            stars={state.constellationStars}
            onAddStar={handleAddStar}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
          />
        )}

        {currentTab === 'compass' && (
          <CareCompassView
            userProfile={state.careCompass.user}
            partnerProfile={state.careCompass.partner}
            activeUser={state.activeUser}
            onUpdateProfile={handleUpdateCareCompass}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'letters' && (
          <LettersView
            letters={state.letters}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onSendLetter={handleSendLetter}
            onOpenLetter={handleOpenLetter}
            canDateLetters={!!state.partnerApp?.can?.includes(CAN_DATE_LETTERS)}
          />
        )}

        {currentTab === 'whispers' && (
          <WhisperMemosView
            memos={state.whisperMemos}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onAddMemo={handleAddWhisperMemo}
            onMarkListened={handleMarkWhisperListened}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'coordinates' && (
          <CoordinatesMapView
            pins={state.coordinatePins}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onAddPin={handleAddPin}
            onDeletePin={handleDeletePin}
            onToggleFavorite={handleToggleFavoritePin}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'radio' && (
          <MidnightRadioView
            state={state}
            onUpdateRadio={handleUpdateRadio}
            onSendRadioWhisper={handleSendRadioWhisper}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'stateofunion' && (
          <StateOfUnionView
            activeSession={state.activeStateOfUnion}
            history={state.stateOfUnionHistory}
            activeUser={state.activeUser}
            onUpdateSession={handleUpdateStateOfUnion}
            onSealSession={handleSealStateOfUnion}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
            partnerName={state.partnerName}
          />
        )}

        {currentTab === 'canvas' && (
          <CanvasOfUsView
            canvasState={state.sharedCanvas}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onAddStroke={handleAddCanvasStroke}
            onClearCanvas={handleClearCanvas}
            onUndoStroke={handleUndoCanvasStroke}
            onSaveSketch={handleSaveCanvasSketch}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'repairbridge' && (
          <RepairBridgeView
            repairLetters={state.repairLetters}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onSendRepair={handleSendRepair}
            onRespondRepair={handleRespondRepair}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'kintsugi' && (
          <KintsugiMomentsView
            moments={state.kintsugiMoments}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onAddMoment={handleAddKintsugiMoment}
            onCherishMoment={handleCherishKintsugiMoment}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'scratch' && (
          <ScratchCardsView
            cards={state.scratchCards}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onScratchCard={handleScratchCardComplete}
            onRedeemCard={handleRedeemScratchCard}
            onAddCard={handleAddScratchCard}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'capsules' && (
          <TimeCapsuleView
            capsules={state.timeCapsules}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onAddCapsule={handleAddTimeCapsule}
            onOpenCapsule={handleOpenTimeCapsule}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'presence' && (
          <CoPresenceView
            activeUser={state.activeUser}
            userName={state.userName}
            partnerName={state.partnerName}
            partnerOnline={partnerOnline}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'scrapbook' && (
          <ScrapbookView
            state={state}
            activeUser={state.activeUser}
            onNavigate={setCurrentTab}
          />
        )}

        {currentTab === 'adventures' && (
          <AdventuresView
            adventures={state.adventures}
            activeUser={state.activeUser}
            onAddAdventure={handleAddAdventure}
            onSetStamp={handleSetAdventureStamp}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'recipes' && (
          <CookbookView
            recipes={state.recipes}
            onAddRecipe={handleAddRecipe}
            onSetIngredient={handleSetIngredient}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
            activeUser={state.activeUser}
          />
        )}

        {currentTab === 'intuition' && (
          <IntuitionGameView
            currentRound={state.intuitionRounds[0] || {
              id: 'round-default',
              date: 'Today',
              dilemma: CURATED_DILEMMAS[0],
              authorId: state.activeUser,
              revealed: false
            }}
            onUpdateRound={handleUpdateIntuitionRound}
            onNewDilemma={handleNewDilemma}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
            activeUser={state.activeUser}
          />
        )}

        {currentTab === 'decks' && (
          <DecksView
            onSendToChat={(msg) => handleSendMessage(msg, false)}
            onNavigate={setCurrentTab}
          />
        )}

        {currentTab === 'cycle' && (
          <CycleView
            records={state.cycleRecords}
            sharingLevel={state.cycleSharingLevel}
            activeUser={state.activeUser}
            onUpdateSharingLevel={handleUpdateCycleSharingLevel}
            onLogRecord={handleLogCycleRecord}
          />
        )}

        {currentTab === 'journal' && (
          <JournalView
            entries={state.journalEntries}
            activeUser={state.activeUser}
            onAddEntry={handleAddJournalEntry}
            onPromoteEntry={handlePromoteJournalEntry}
          />
        )}

        {currentTab === 'repair' && (
          <RepairKitView
            agreements={state.agreements}
            activeUser={state.activeUser}
            onAddAgreement={handleAddAgreement}
            partnerName={state.partnerName}
          />
        )}

        {currentTab === 'lists' && (
          <ListsView
            lists={state.lists}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onToggleItem={handleToggleListItem}
            onAddItem={handleAddListItem}
            onDeleteItem={handleDeleteListItem}
          />
        )}

        {currentTab === 'chores' && (
          <ChoreSplitView
            chores={state.chores}
            activeUser={state.activeUser}
            onAddChore={handleAddChore}
          />
        )}

        {currentTab === 'money' && (
          <MoneyLightView
            expenses={state.expenses}
            activeUser={state.activeUser}
            partnerName={state.partnerName}
            onAddExpense={handleAddExpense}
            onSettleUp={handleSettleUpExpenses}
          />
        )}

        {currentTab === 'timeline' && (
          <TimelineView
            quotes={state.quotes}
            memories={state.memories || []}
            activeUser={state.activeUser}
            onAddQuote={handleAddQuote}
            onAddMemory={handleAddMemory}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            state={state}
            relayDurable={relayDurable}
            spaceCode={session?.code}
            currentTheme={theme}
            onSelectTheme={setTheme}
            onEmergencyWipe={handleEmergencyExit}
            onRestoreState={(restored) => setState(restored)}
            currentLocale={locale}
            onSelectLocale={pickLocale}
            onToggleCamouflage={() => setIsCamouflaged(true)}
            onUnpair={handleUnpair}
            onRotateCode={handleRotateCode}
            connectedDeviceCount={occupancy.total}
            vaultName={state.vaultName}
            onRenameVault={handleRenameVault}
            onChangeName={handleChangeName}
            partnerOnline={partnerOnline}
            relayStatus={relayStatus}
            lastSyncedAt={lastSyncedAt}
            userName={state.userName}
            onToggleActiveUser={toggleActiveUser}
            decoyCode={decoyCode}
            onUpdateDecoyCode={(newCode) => {
              setDecoyCode(newCode);
              localStorage.setItem('two_decoy_code', newCode);
            }}
            pinEnabled={!!vaultKey || hasEncryptedVault()}
            onUpdatePin={handleUpdatePin}
            autoLock={autoLock}
            onSelectAutoLock={(value) => {
              writeAutoLock(value);
              setAutoLock(value);
            }}
            shareLastSeen={shareLastSeen}
            onToggleShareLastSeen={(value) => {
              writeShareLastSeen(value);
              setShareLastSeen(value);
            }}
            shareReceipts={shareReceipts}
            onToggleShareReceipts={(value) => {
              writeShareReceipts(value);
              setShareReceipts(value);
            }}
            onCheckForUpdate={async () => {
              const result = await checkForUpdate(true);
              if (result.status === 'found') setUpdateOffer(result.update);
              return result.status;
            }}
            notAboutYouOn={(state.activeUser === 'user' ? state.userReport : state.partnerReport).notAboutYouActive}
            onToggleNotAboutYou={handleToggleUserFlag}
            decoyOnLaunch={decoyOnLaunch}
            onToggleDecoyOnLaunch={handleToggleDecoyOnLaunch}
            autoCamouflageOnBlur={autoCamouflageOnBlur}
            onToggleAutoCamouflage={(val) => {
              setAutoCamouflageOnBlur(val);
              localStorage.setItem('two_auto_camo', String(val));
            }}
          />
        )}
        </Suspense>
        </div>
      </main>

      {roleClash && (
        <RoleClashDialog
          otherName={roleClash.name}
          onChoose={handleRoleClashAnswer}
          onSamePerson={handleRoleClashSamePerson}
          onDismiss={() => {
            setRoleClash(null);
            clashAnnouncedRef.current = false;
          }}
        />
      )}

      {/* Shown wherever they are in the sanctuary, not only on one screen. */}
      {!storageWarningDismissed && (
        <RelayStorageWarning durable={relayDurable} onDismiss={() => setStorageWarningDismissed(true)} />
      )}

      <UpdateReadyToast suppressed={callState.phase !== 'idle'} />

      {updateOffer && !isLocked && !isCamouflaged && callState.phase === 'idle' && (
        <UpdatePrompt update={updateOffer} onClose={() => setUpdateOffer(null)} />
      )}

      {callOverlay}

      {/* In-App Notification Toast for Messages & Letters */}
      <InAppNotificationToast
        notification={inAppNotification}
        onDismiss={() => setInAppNotification(null)}
        onOpenTab={(tabId) => {
          if (tabId.startsWith('group:')) {
            setActiveGroupId(tabId.slice('group:'.length));
            return;
          }
          handleSelectTab(tabId);
        }}
      />

      {/* Sanctuary Directory Modal (All 32 Spaces) */}
      {showDirectoryModal && (
        <Suspense fallback={null}>
          <SanctuaryDirectoryModal
            isOpen={showDirectoryModal}
            onClose={() => setShowDirectoryModal(false)}
            currentTab={currentTab}
            onSelectTab={handleSelectTab}
            unreadChatCount={unreadChatCount}
          />
        </Suspense>
      )}

      {/* On every screen, chat included. Chat used to be the exception, on the
          grounds that the dock ate height the conversation needed - but that
          made the one screen you live in the one screen you could not leave
          without going somewhere else first. The chat panel now measures the
          dock instead of guessing around it, so it costs the conversation
          exactly the dock's height and nothing more. */}
      {inApp && (
        <AppDock
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          unreadChatCount={unreadChatCount}
          draftInChat={!!state.chatDrafts?.couple}
          dotted={partnerDots}
          isTablet={isTablet}
        />
      )}

      {showStoryTour && (
        <Suspense fallback={null}>
          <StoryTourModal
            isOpen={showStoryTour}
            onClose={() => setShowStoryTour(false)}
            onNavigateTab={(tab) => handleSelectTab(tab)}
          />
        </Suspense>
      )}

      {/* A heart from the partner, and the small "Sent" line for your own. */}
      <SensoryPulseOverlay activeUser={state.activeUser} partnerName={state.partnerName} />
    </div>
    </LocaleContext.Provider>
  );
};
