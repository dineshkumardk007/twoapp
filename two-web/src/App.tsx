import React, { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense, startTransition } from 'react';
import { loadState, saveState, clearState, pruneForStorage, forStorage, SpaceState } from './core/storage';
import { AppDock } from './components/AppDock';
import { isAndroidApp, formFactor } from './core/platform';
import { wsRelay, RelayStatus } from './core/ws';
import {
  hasEncryptedVault,
  unlockVault,
  createVault,
  writeVault,
  destroyVault
} from './core/vault';
import type { SpaceRole } from './core/space';
import {
  isWeakPairingCode,
  generatePairingCode,
  getDeviceId,
  describeThisDevice,
  normalizeJoinPhrase,
  deriveSpaceCredentials,
  loadSpaceSession,
  saveSpaceSession,
  clearSpaceSession,
  SpaceSession
} from './core/space';
import { localMesh } from './core/localMesh';
import {
  ThemeMode,
  NeedItem,
  ChatMessage,
  JournalEntry,
  AgreementItem,
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
import { Locale } from './core/i18n';
import { Lock } from 'lucide-react';
import { CURATED_DILEMMAS } from './data/dilemmas';
import { newId } from './core/ids';
import { hydrateMedia, containsMediaRefs, collectMediaGarbage, clearMedia } from './core/media';
import {
  lockoutRemaining,
  registerFailure,
  clearFailures,
  isUnderSuspicion
} from './core/lockGuard';
import { readAutoLock, writeAutoLock, watchForAbsence, lockNow, AutoLockSetting } from './core/autoLock';
import {
  PRESENCE_BEAT,
  BEAT_INTERVAL_MS,
  readShareLastSeen,
  writeShareLastSeen
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
  const [showStoryTour, setShowStoryTour] = useState(false);

  /**
   * The home screen's tour card, shown on a first run and never again.
   *
   * Captured once at mount rather than read on every render, so the card cannot
   * vanish underneath you the moment the flag is written - it stays for the
   * whole of this run and is gone on the next launch.
   */
  const [showTourCard] = useState(() => {
    try {
      return localStorage.getItem(TOUR_CARD_SEEN_KEY) !== 'true';
    } catch {
      // Private mode: showing it every launch beats hiding it forever.
      return true;
    }
  });

  // Written only once home has actually been on screen. Opening the app
  // straight into chat and closing it again should not burn the one showing.
  useEffect(() => {
    if (!showTourCard || currentTab !== 'home') return;
    try {
      localStorage.setItem(TOUR_CARD_SEEN_KEY, 'true');
    } catch {
      /* private mode - nothing to remember it with */
    }
  }, [showTourCard, currentTab]);
  const [locale, setLocale] = useState<Locale>('en');
  // Bumped when pairing completes so the relay effect re-runs and joins the new space.
  const [spaceVersion, setSpaceVersion] = useState(0);

  // Notifications, audio alerts, and directory drawer states
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [inAppNotification, setInAppNotification] = useState<InAppNotification | null>(null);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [decoyCode, setDecoyCode] = useState(() => localStorage.getItem('two_decoy_code') || '142.85');
  const [autoCamouflageOnBlur, setAutoCamouflageOnBlur] = useState(() => localStorage.getItem('two_auto_camo') === 'true');

  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;
  const partnerNameRef = useRef(state.partnerName);
  partnerNameRef.current = state.partnerName;

  // Session & relay connection state
  const [session, setSession] = useState<SpaceSession | null>(loadSpaceSession);
  const [relayStatus, setRelayStatus] = useState<RelayStatus>(() => wsRelay.getStatus());

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

    hydrateMedia(state, vaultKey)
      .then(hydrated => {
        if (cancelled) return;
        setState(hydrated);
        setMediaReady(true);
        // The live set of references is only known once everything is loaded,
        // so this is the moment to drop stored media nothing points at.
        void collectMediaGarbage(hydrated);
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
  const [passphraseAttempt, setPassphraseAttempt] = useState('');

  // Track live WebSocket relay status
  useEffect(() => {
    return wsRelay.subscribeStatus((status) => {
      setRelayStatus(status);
    });
  }, []);

  // Broadcast user name to partner whenever relay connects
  useEffect(() => {
    if (relayStatus === 'connected' && state.userName && state.userName !== 'You') {
      wsRelay.broadcastUpdate('NAME_EXCHANGE', { name: state.userName, role: state.activeUser });
    }
  }, [relayStatus, state.userName, state.activeUser]);

  // Check URL parameters for dual-window live sync demonstration
  useEffect(() => {
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
        setState(prev => ({
          ...prev,
          messages: prev.messages.map(m =>
            m.id === msg.correlationId ? { ...m, delivered: true } : m
          )
        }));
      }),
    []
  );

  // Listen for remote updates
  useEffect(() => {
    const unsubscribe = wsRelay.subscribe((msg) => {
      if (msg.type === 'REMOTE_RECORD') {
        const record = msg.record;
        setLastSyncedAt(Date.now());
        // Anything arriving proves a partner exists on the other end.
        setState(prev => (prev.partnerEverSeen ? prev : { ...prev, partnerEverSeen: true }));
        try {
          const parsed = JSON.parse(record.payload);

          if (record.type === 'NAME_EXCHANGE') {
            if (parsed.name && typeof parsed.name === 'string') {
              setState(prev => ({
                ...prev,
                partnerName: parsed.name
              }));
              const currentSession = loadSpaceSession();
              if (currentSession) {
                saveSpaceSession({ ...currentSession, partnerName: parsed.name });
              }
            }
          } else if (record.type === 'CHAT') {
            setState(prev => ({
              ...prev,
              messages: [...prev.messages, parsed]
            }));
            const isFromPartner = record.authorId !== state.activeUser;
            if (isFromPartner) {
              playMessageChime();
              triggerHaptic([35, 45, 35]);
              if (currentTabRef.current !== 'chat') {
                setUnreadChatCount(c => c + 1);
                setInAppNotification({
                  id: newId(),
                  title: partnerNameRef.current || 'Partner',
                  body: parsed.text || 'Sent you a message',
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
            }
          } else if (record.type === 'WEATHER') {
            setState(prev => {
              const isPartner = record.authorId !== prev.activeUser;
              return {
                ...prev,
                partnerReport: isPartner ? { ...prev.partnerReport, ...parsed } : prev.partnerReport,
                userReport: !isPartner ? { ...prev.userReport, ...parsed } : prev.userReport
              };
            });
          } else if (record.type === 'NOT_ABOUT_YOU') {
            setState(prev => {
              const isPartner = record.authorId !== prev.activeUser;
              return {
                ...prev,
                partnerReport: isPartner ? { ...prev.partnerReport, notAboutYouActive: parsed.active } : prev.partnerReport,
                userReport: !isPartner ? { ...prev.userReport, notAboutYouActive: parsed.active } : prev.userReport
              };
            });
          } else if (record.type === 'LIST_ITEM') {
            setState(prev => ({
              ...prev,
              lists: [parsed, ...prev.lists]
            }));
          } else if (record.type === 'LOVE_LETTER') {
            setState(prev => ({
              ...prev,
              letters: [parsed, ...prev.letters.filter(l => l.id !== parsed.id)]
            }));
            const isFromPartner = record.authorId !== state.activeUser;
            if (isFromPartner) {
              playLetterChime();
              triggerHaptic([45, 55, 45]);
              if (currentTabRef.current !== 'letters') {
                setInAppNotification({
                  id: newId(),
                  title: `${partnerNameRef.current || 'Partner'} sent a Love Letter`,
                  body: parsed.title || 'A new sealed letter awaits in your Sanctuary',
                  type: 'letter',
                  tabId: 'letters'
                });
              }
            }
          } else if (record.type === 'RITUAL_COMPLETE') {
            setState(prev => {
              const updatedRituals = prev.rituals.map(r => {
                if (r.id === parsed.ritualId) {
                  return {
                    ...r,
                    completedTodayByPartner: parsed.activeUser === 'partner' ? true : r.completedTodayByPartner,
                    completedTodayByUser: parsed.activeUser === 'user' ? true : r.completedTodayByUser
                  };
                }
                return r;
              });
              return { ...prev, rituals: updatedRituals };
            });
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
            // Our own laptop shares this role; its receipt must not mark our
            // messages as read by the partner.
            if (record.authorId === state.activeUser) return;
            const upTo = Number(parsed.upTo) || 0;
            setState(prev => ({
              ...prev,
              partnerReadAt: Math.max(prev.partnerReadAt || 0, upTo)
            }));
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
            setState(prev => ({
              ...prev,
              comfortBoxes: [parsed, ...prev.comfortBoxes.filter(b => b.id !== parsed.id)]
            }));
          } else if (record.type === 'RECIPE_ADD') {
            setState(prev => ({
              ...prev,
              recipes: [parsed, ...prev.recipes.filter(r => r.id !== parsed.id)]
            }));
          } else if (record.type === 'INGREDIENT_TOGGLE') {
            setState(prev => ({
              ...prev,
              recipes: prev.recipes.map(r => {
                if (r.id === parsed.recipeId) {
                  return {
                    ...r,
                    ingredients: r.ingredients.map(ing =>
                      ing.id === parsed.ingredientId ? { ...ing, checked: !ing.checked } : ing
                    )
                  };
                }
                return r;
              })
            }));
          } else if (record.type === 'INTUITION_ROUND') {
            setState(prev => ({
              ...prev,
              intuitionRounds: [parsed, ...prev.intuitionRounds.filter(r => r.id !== parsed.id)]
            }));
          } else if (record.type === 'ADVENTURE_UPDATE') {
            setState(prev => ({
              ...prev,
              adventures: parsed
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
              midnightRadio: parsed
            }));
          } else if (record.type === 'MIDNIGHT_RADIO_WHISPER') {
            setState(prev => ({
              ...prev,
              midnightRadio: {
                ...prev.midnightRadio,
                whispers: [parsed, ...(prev.midnightRadio.whispers || [])]
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
              stateOfUnionHistory: [parsed, ...prev.stateOfUnionHistory]
            }));
          } else if (record.type === 'CANVAS_STROKE') {
            setState(prev => ({
              ...prev,
              sharedCanvas: {
                ...prev.sharedCanvas,
                strokes: [...(prev.sharedCanvas?.strokes || []), parsed],
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
                savedSketches: [parsed, ...(prev.sharedCanvas?.savedSketches || [])]
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
        if (packet.subType === 'LOVE_LETTER') {
          setState(prev => ({
            ...prev,
            letters: [packet.payload, ...prev.letters.filter(l => l.id !== packet.payload.id)]
          }));
          playLetterChime();
          triggerHaptic([45, 55, 45]);
          if (currentTabRef.current !== 'letters') {
            setInAppNotification({
              id: newId(),
              title: `${partnerNameRef.current || 'Partner'} sent a Love Letter (Mesh)`,
              body: packet.payload.title || 'A sealed letter arrived offline',
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
          setState(prev => ({
            ...prev,
            comfortBoxes: [packet.payload, ...prev.comfortBoxes.filter(b => b.id !== packet.payload.id)]
          }));
        } else if (packet.subType === 'RECIPE_ADD') {
          setState(prev => ({
            ...prev,
            recipes: [packet.payload, ...prev.recipes.filter(r => r.id !== packet.payload.id)]
          }));
        } else if (packet.subType === 'INGREDIENT_TOGGLE') {
          setState(prev => ({
            ...prev,
            recipes: prev.recipes.map(r => {
              if (r.id === packet.payload.recipeId) {
                return {
                  ...r,
                  ingredients: r.ingredients.map(ing =>
                    ing.id === packet.payload.ingredientId ? { ...ing, checked: !ing.checked } : ing
                  )
                };
              }
              return r;
            })
          }));
        } else if (packet.subType === 'INTUITION_ROUND') {
          setState(prev => ({
            ...prev,
            intuitionRounds: [packet.payload, ...prev.intuitionRounds.filter(r => r.id !== packet.payload.id)]
          }));
        } else if (packet.subType === 'ADVENTURE_UPDATE') {
          setState(prev => ({
            ...prev,
            adventures: packet.payload
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
            midnightRadio: packet.payload
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

  useEffect(() => {
    if (isLocked) return; // nothing meaningful to persist before unlock

    if (vaultKey) {
      // forStorage rather than pruneForStorage: media has to be moved out here
      // too, and encrypted with the vault key on its way, so a space with a PIN
      // does not end up with its photos sitting in the clear.
      void writeVault(vaultKey, { state: forStorage(state, vaultKey), session }).then(ok =>
        setStorageFull(!ok)
      );
    } else {
      setStorageFull(saveState(state).quotaExceeded);
    }
  }, [state, session, vaultKey, isLocked]);

  const toggleActiveUser = () => {
    setState(prev => {
      const nextUser = prev.activeUser === 'user' ? 'partner' : 'user';
      const curSession = loadSpaceSession();
      if (curSession) {
        const updated: SpaceSession = { ...curSession, role: nextUser };
        saveSpaceSession(updated);
        setSession(updated);
      }
      return {
        ...prev,
        activeUser: nextUser
      };
    });
    setSpaceVersion(v => v + 1);
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
    const newest = state.messages.reduce(
      (max, m) => (m.authorId !== state.activeUser && m.sentAt && m.sentAt > max ? m.sentAt : max),
      0
    );
    if (!newest || newest <= lastSentReceiptRef.current) return;
    lastSentReceiptRef.current = newest;
    wsRelay.broadcastUpdate('READ_RECEIPT', { upTo: newest });
  };

  // Opening the chat is not the only way to read something: a message arriving
  // while the chat is already open has also been seen.
  useEffect(() => {
    if (currentTab === 'chat') sendReadReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages.length, currentTab]);

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
  const publishChromeHeight = () => {
    const el = headerRef.current;
    if (!el) return;
    document.documentElement.style.setProperty(
      '--two-header-h',
      `${Math.round(el.getBoundingClientRect().height)}px`
    );
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
      enabled: () => !!vaultKey && !isLocked,
      getSetting: () => readAutoLock(),
      onLock: lockNow
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

  const handleSelectTab = (tabId: string) => {
    // Screens load as separate chunks, so switching tab can suspend. Marked as
    // a transition, React keeps the screen you are on until the next one is
    // ready instead of tearing it down for a placeholder - the difference
    // between a tap that feels instant and one that blinks.
    startTransition(() => setCurrentTab(tabId));
    if (tabId === 'chat') {
      setUnreadChatCount(0);
      sendReadReceipt();
      if (typeof document !== 'undefined') {
        document.title = 'Two — Private Encrypted Space';
      }
    }
  };

  // Reset unread title if user focuses tab while on chat
  useEffect(() => {
    const handleFocus = () => {
      if (currentTabRef.current === 'chat') {
        setUnreadChatCount(0);
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
    wsRelay.broadcastUpdate('WEATHER', updatedFields);
    setState(prev => {
      const isMe = prev.activeUser === 'user';
      return {
        ...prev,
        userReport: isMe ? { ...prev.userReport, ...updatedFields } : prev.userReport,
        partnerReport: !isMe ? { ...prev.partnerReport, ...updatedFields } : prev.partnerReport,
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

  const handleSendMessage = (
    text: string,
    isNeedCard: boolean = false,
    extra?: { isVoiceMemo?: boolean; audioDataUrl?: string; audioDurationSeconds?: number }
  ) => {
    const newMessage: ChatMessage = {
      id: newId(),
      authorId: state.activeUser,
      authorName: state.activeUser === 'user' ? 'You' : 'Partner',
      text,
      timestamp: 'Just now',
      sentAt: Date.now(),
      delivered: false,
      isNeedCard,
      ...extra
    };
    // The message id doubles as the correlation id, so the relay's ack can be
    // matched back to this exact bubble.
    wsRelay.broadcastUpdate('CHAT', newMessage, newMessage.id);
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }));
  };

  const handleAddJournalEntry = (entry: Omit<JournalEntry, 'id'>) => {
    const newEntry: JournalEntry = {
      ...entry,
      id: newId()
    };
    setState(prev => ({
      ...prev,
      journalEntries: [newEntry, ...prev.journalEntries]
    }));
  };

  const handlePromoteJournalEntry = (id: string) => {
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
    setState(prev => ({
      ...prev,
      agreements: [newAgreement, ...prev.agreements]
    }));
  };

  const handleToggleListItem = (id: string) => {
    setState(prev => ({
      ...prev,
      lists: prev.lists.map(item =>
        item.id === id ? { ...item, isCompleted: !item.isCompleted } : item
      )
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
    setState(prev => ({
      ...prev,
      expenses: [newExpense, ...prev.expenses]
    }));
  };

  const handleSettleUpExpenses = () => {
    setState(prev => ({
      ...prev,
      expenses: []
    }));
  };

  const handleAddQuote = (quoteText: string) => {
    setState(prev => ({
      ...prev,
      quotes: [
        {
          id: newId(),
          quote: quoteText,
          author: prev.activeUser === 'user' ? 'You' : 'Partner',
          isCustom: true
        },
        ...prev.quotes
      ]
    }));
  };

  const handleUpdateCycleSharingLevel = (level: CycleSharingLevel) => {
    setState(prev => ({
      ...prev,
      cycleSharingLevel: level,
      consentLogs: [
        {
          id: newId(),
          kind: 'cycle',
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
    setState(prev => ({
      ...prev,
      cycleRecords: [newRecord, ...prev.cycleRecords]
    }));
  };

  const handleToggleRitual = (ritualId: string) => {
    setState(prev => {
      const isMe = prev.activeUser === 'user';
      let ritualTitle = '';
      const updated = prev.rituals.map(r => {
        if (r.id === ritualId) {
          ritualTitle = r.title;
          return {
            ...r,
            completedTodayByUser: isMe ? !r.completedTodayByUser : r.completedTodayByUser,
            completedTodayByPartner: !isMe ? !r.completedTodayByPartner : r.completedTodayByPartner,
            streakDays: r.streakDays + 1
          };
        }
        return r;
      });

      const pebbleColors = ['#D4A373', '#B5A895', '#C48B71', '#8F9E8B', '#938581', '#C9ADA7'];
      const newPebble: PebbleStone = {
        id: newId('peb'),
        color: pebbleColors[Math.floor(Math.random() * pebbleColors.length)],
        size: Math.floor(Math.random() * 35) + 50,
        height: Math.floor(Math.random() * 8) + 18,
        rotation: Math.floor(Math.random() * 6) - 3,
        placedAt: 'Just now',
        ritualTitle: ritualTitle || 'Micro-Ritual'
      };

      wsRelay.broadcastUpdate('RITUAL_COMPLETE', { ritualId, activeUser: prev.activeUser });
      localMesh.broadcastLocally('RITUAL_COMPLETE', { ritualId }, prev.activeUser);

      return {
        ...prev,
        rituals: updated,
        pebbles: [...prev.pebbles, newPebble]
      };
    });
  };

  const handleAddRitual = (newRitual: RitualItem) => {
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
    setState(prev => ({
      ...prev,
      letters: prev.letters.map(l => l.id === letterId ? { ...l, isOpened: true, openedDate: 'Today' } : l)
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

  const handleToggleAdventureComplete = (id: string, notes?: string, photoUrl?: string) => {
    setState(prev => {
      const updated = prev.adventures.map(a => {
        if (a.id === id) {
          const willBeCompleted = !a.isCompleted;
          return {
            ...a,
            isCompleted: willBeCompleted,
            completedDate: willBeCompleted ? (a.completedDate || 'Recently') : undefined,
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
        c.id === cardId ? { ...c, isScratched: true, scratchedAt: 'Just now' } : c
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
        c.id === cardId ? { ...c, isRedeemed: true, redeemedAt: 'Just now' } : c
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

  const handleAddWhisperMemo = (newMemo: WhisperMemoItem) => {
    setState(prev => {
      const updated = [newMemo, ...prev.whisperMemos];
      wsRelay.broadcastUpdate('WHISPER_MEMO_UPDATE', updated);
      localMesh.broadcastLocally('WHISPER_MEMO_UPDATE', updated, prev.activeUser);
      return {
        ...prev,
        whisperMemos: updated
      };
    });
  };

  const handleMarkWhisperListened = (memoId: string) => {
    setState(prev => {
      const updated = prev.whisperMemos.map(m =>
        m.id === memoId ? { ...m, isListened: true, listenedAt: 'Just now' } : m
      );
      wsRelay.broadcastUpdate('WHISPER_MEMO_UPDATE', updated);
      localMesh.broadcastLocally('WHISPER_MEMO_UPDATE', updated, prev.activeUser);
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
    setState(prev => ({
      ...prev,
      milestones: [...prev.milestones, newMs]
    }));
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
    setState(prev => ({
      ...prev,
      comfortBoxes: [newBox, ...prev.comfortBoxes.filter(b => b.id !== newBox.id)]
    }));
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

  const handleToggleIngredient = (recipeId: string, ingredientId: string) => {
    setState(prev => ({
      ...prev,
      recipes: prev.recipes.map(r => {
        if (r.id === recipeId) {
          return {
            ...r,
            ingredients: r.ingredients.map(ing =>
              ing.id === ingredientId ? { ...ing, checked: !ing.checked } : ing
            )
          };
        }
        return r;
      })
    }));
    wsRelay.broadcastUpdate('INGREDIENT_TOGGLE', { recipeId, ingredientId });
    localMesh.broadcastLocally('INGREDIENT_TOGGLE', { recipeId, ingredientId }, state.activeUser);
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

  const handleEmergencyExit = () => {
    // Wipe the encrypted vault too, or the panic button leaves everything behind.
    clearState();
    void clearMedia();
    clearSpaceSession();
    destroyVault();
    window.location.reload();
  };

  const themeClass = {
    linen: 'bg-linen-bg text-linen-primary',
    slate: 'bg-slate-bg text-slate-primary dark',
    forest: 'bg-forest-bg text-forest-primary',
    terracotta: 'bg-terracotta-bg text-terracotta-primary'
  }[theme];

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
      return 'ok';
    } catch (e) {
      console.error('[Vault] Could not change the app lock', e);
      return 'error';
    }
  };

  const handleUnpair = () => {
    if (window.confirm('Are you sure you want to disconnect from this space? You can reconnect anytime using your Space Link Code.')) {
      clearSpaceSession();
      wsRelay.disconnect();
      setSession(null);
      setState(prev => ({ ...prev, isPaired: false }));
      setSpaceVersion(v => v + 1);
    }
  };

  // App Lock PIN Screen. The vault is genuinely encrypted, so this is not a
  // comparison against a stored PIN - the PIN derives the key, and a wrong one
  // simply fails to decrypt.


  if (isLocked) {
    const attemptUnlock = (secret: string) => {
      if (!secret || isUnlocking) return;

      // Refuse before deriving anything. Checked here rather than only in the
      // UI so that a wait cannot be skipped by reloading the page, which is
      // what re-enables every button on this screen.
      const waiting = lockoutRemaining();
      if (waiting > 0) {
        setLockoutLeft(waiting);
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
            clearFailures();
            setLockoutLeft(0);
            // The vault carries the same references localStorage does.
            setMediaReady(!containsMediaRefs(opened.payload.state));
            setState(opened.payload.state);
            setSession(opened.payload.session);
            setVaultKey(opened.key);
            setIsLocked(false);
            setPinAttempt('');
            setPassphraseAttempt('');
            setSpaceVersion(v => v + 1);
          } else {
            const penalty = registerFailure();
            setLockoutLeft(penalty);
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
    const startFresh = () => {
      if (
        !window.confirm(
          'Start fresh on this device? Everything stored here will be erased. ' +
            'If you know your space link code you can enter it again and your shared ' +
            'history will come back from the relay.'
        )
      ) {
        return;
      }
      destroyVault();
      clearState();
      void clearMedia();
      clearSpaceSession();
      window.location.reload();
    };

    const handlePinInput = (val: string) => {
      if (isUnlocking || lockoutLeft > 0) return;
      const next = (pinAttempt + val).slice(0, 4);
      setPinAttempt(next);
      setPinError(false);

      if (next.length === 4) attemptUnlock(next);
    };

    return (
      <div className="min-h-screen app-min-vh bg-linen-bg flex items-center justify-center p-4">
        <div className="max-w-xs w-full bg-linen-surface border border-linen-border rounded-3xl p-8 shadow-sm text-center space-y-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 shadow-xs">
            <Lock className="w-7 h-7 text-rose-500" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-medium text-linen-primary">Sanctuary Locked</h2>
            <p className="text-xs text-linen-secondary mt-1">
              {lockoutLeft > 0
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

          <div className="flex justify-center space-x-3 py-2">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-10 h-12 rounded-xl border flex items-center justify-center text-xl font-mono transition-all ${
                  lockoutLeft > 0
                    ? 'border-linen-border bg-linen-variant/30 text-linen-secondary/30'
                    : pinError
                    ? 'border-red-500 bg-red-50 text-red-600'
                    : pinAttempt.length > idx
                    ? 'border-linen-primary bg-linen-variant text-linen-primary font-bold'
                    : 'border-linen-border bg-linen-surface text-linen-secondary/30'
                }`}
              >
                {pinAttempt.length > idx ? '•' : ''}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
              <button
                key={btn}
                onClick={() => {
                  if (btn === 'C') setPinAttempt('');
                  else if (btn === '⌫') setPinAttempt(prev => prev.slice(0, -1));
                  else handlePinInput(btn);
                }}
                disabled={lockoutLeft > 0}
                className="py-3.5 rounded-xl border border-linen-border bg-linen-variant/40 hover:bg-linen-variant text-linen-primary text-lg font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-linen-variant/40"
              >
                {btn}
              </button>
            ))}
          </div>
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
      <div className="min-h-screen app-min-vh bg-linen-bg flex items-center justify-center">
        {/* Inlined rather than loaded from /icon-192.svg: inside the Android
            WebView the assets are served from a base this path would miss. */}
        <svg
          viewBox="0 0 108 108"
          className="w-14 h-14 animate-pulse"
          fill="none"
          strokeLinecap="round"
          aria-label="Loading"
        >
          <path d="M54,84 C51,70 51,56 54,44 C56,36 56,30 54,25" stroke="#4E5A2E" strokeWidth="4.5" />
          <path d="M54,47 C58,32 66,25 80,24 C79,38 70,46 54,47 Z" fill="#606C38" />
          <path d="M54,64 C50,49 42,42 28,41 C29,55 38,63 54,64 Z" fill="#8A9A5B" />
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
            pinEnabled: !!chosenPin,
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
          } else {
            saveSpaceSession(namedSession);
          }
        }}
      />
      </Suspense>
    );
  }


  return (
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
        onEmergencyExit={handleEmergencyExit}
        onToggleCamouflage={() => setIsCamouflaged(true)}
        onOpenStoryTour={() => setShowStoryTour(true)}
        onTriggerPulse={() => triggerGlobalPulse('Warm hug across distance')}
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
            waits for one; the navigation around it never moves. */}
        <Suspense fallback={<ScreenFallback />}>
        {currentTab === 'home' && (
          <HomeView
            state={state}
            spaceCode={session?.code}
            onUpdateReport={handleUpdateReport}
            onToggleUserFlag={handleToggleUserFlag}
            onNavigate={setCurrentTab}
            onSendNeed={(need) => handleSendMessage(`I need: ${need.title} — ${need.description}`, true)}
            onOpenTour={showTourCard ? () => setShowStoryTour(true) : undefined}
            onAddMilestone={handleAddMilestone}
            onSaveComfortBox={handleSaveComfortBox}
          />
        )}

        {currentTab === 'chat' && (
          <ChatView
            messages={state.messages}
            activeUser={state.activeUser}
            onSendMessage={handleSendMessage}
            onOpenSoftLanding={() => setCurrentTab('softlanding')}
            partnerName={state.partnerName || 'Partner'}
            partnerReadAt={state.partnerReadAt}
            relayStatus={relayStatus}
            partnerOnline={partnerOnline}
            // Reciprocal, as every messenger does it: hiding your own last
            // seen hides theirs too, so it cannot become a one-way window.
            partnerLastSeen={shareLastSeen ? state.partnerLastSeen : 0}
          />
        )}

        {currentTab === 'softlanding' && (
          <SoftLandingView
            activeSession={state.activeSoftLanding}
            history={state.softLandingHistory}
            activeUser={state.activeUser}
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
            onToggleRitual={handleToggleRitual}
            onAddRitual={handleAddRitual}
          />
        )}

        {currentTab === 'garden' && (
          <HearthGardenView
            garden={state.hearthGarden}
            activeUser={state.activeUser}
            onUpdateGarden={handleUpdateGarden}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'constellation' && (
          <ConstellationView
            stars={state.constellationStars}
            onAddStar={handleAddStar}
            activeUser={state.activeUser}
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
            onSendLetter={handleSendLetter}
            onOpenLetter={handleOpenLetter}
          />
        )}

        {currentTab === 'whispers' && (
          <WhisperMemosView
            memos={state.whisperMemos}
            activeUser={state.activeUser}
            onAddMemo={handleAddWhisperMemo}
            onMarkListened={handleMarkWhisperListened}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'coordinates' && (
          <CoordinatesMapView
            pins={state.coordinatePins}
            activeUser={state.activeUser}
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
          />
        )}

        {currentTab === 'canvas' && (
          <CanvasOfUsView
            canvasState={state.sharedCanvas}
            activeUser={state.activeUser}
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
            onSendRepair={handleSendRepair}
            onRespondRepair={handleRespondRepair}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'kintsugi' && (
          <KintsugiMomentsView
            moments={state.kintsugiMoments}
            activeUser={state.activeUser}
            onAddMoment={handleAddKintsugiMoment}
            onCherishMoment={handleCherishKintsugiMoment}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'scratch' && (
          <ScratchCardsView
            cards={state.scratchCards}
            activeUser={state.activeUser}
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
            onToggleComplete={handleToggleAdventureComplete}
            onSendToChat={(msg) => handleSendMessage(msg, false)}
          />
        )}

        {currentTab === 'recipes' && (
          <CookbookView
            recipes={state.recipes}
            onAddRecipe={handleAddRecipe}
            onToggleIngredient={handleToggleIngredient}
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
          />
        )}

        {currentTab === 'lists' && (
          <ListsView
            lists={state.lists}
            activeUser={state.activeUser}
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
            onAddExpense={handleAddExpense}
            onSettleUp={handleSettleUpExpenses}
          />
        )}

        {currentTab === 'timeline' && (
          <TimelineView
            quotes={state.quotes}
            activeUser={state.activeUser}
            onAddQuote={handleAddQuote}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            state={state}
            spaceCode={session?.code}
            currentTheme={theme}
            onSelectTheme={setTheme}
            onEmergencyWipe={handleEmergencyExit}
            onRestoreState={(restored) => setState(restored)}
            currentLocale={locale}
            onSelectLocale={setLocale}
            onToggleCamouflage={() => setIsCamouflaged(true)}
            onUnpair={handleUnpair}
            onRotateCode={handleRotateCode}
            connectedDeviceCount={occupancy.total}
            vaultName={state.vaultName}
            onRenameVault={handleRenameVault}
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
      </main>

      {/* In-App Notification Toast for Messages & Letters */}
      <InAppNotificationToast
        notification={inAppNotification}
        onDismiss={() => setInAppNotification(null)}
        onOpenTab={handleSelectTab}
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

      {/* Real-Time Sensory Haptic Pulse Overlay */}
      <SensoryPulseOverlay activeUser={state.activeUser} />
    </div>
  );
};
