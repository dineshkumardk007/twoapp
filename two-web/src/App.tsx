import React, { useState, useEffect, useRef } from 'react';
import { loadState, saveState, clearState, pruneForStorage, SpaceState } from './core/storage';
import {
  isAuthConfigured,
  getAccessToken,
  getSession as getAuthSession,
  signOut,
  saveEscrow,
  loadEscrow,
  updateEscrowPayload
} from './core/auth';
import {
  wrapForEscrow,
  unwrapSecret,
  generateMasterKey,
  sealSpaceSecret,
  openSpaceSecret
} from './core/keyEscrow';
import { fetchPendingInvite, acceptInvite } from './core/invites';
import { registerThisDevice, isThisDeviceRevoked } from './core/devices';
import { LoginView } from './views/LoginView';
import { AppDock } from './components/AppDock';
import { InvitePartnerBanner } from './components/InvitePartnerBanner';
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
import { StoryTourModal } from './components/StoryTourModal';
import { SensoryPulseOverlay, triggerGlobalPulse } from './components/SensoryPulseOverlay';
import { playMessageChime, playLetterChime, triggerHaptic } from './core/audioAlerts';
import { InAppNotificationToast, InAppNotification } from './components/InAppNotificationToast';
import { SanctuaryDirectoryModal } from './components/SanctuaryDirectoryModal';
import { Locale } from './core/i18n';
import { Lock } from 'lucide-react';
import { OnboardingView } from './views/OnboardingView';
import { HomeView } from './views/HomeView';
import { ChatView } from './views/ChatView';
import { SoftLandingView } from './views/SoftLandingView';
import { StateOfUnionView } from './views/StateOfUnionView';
import { RepairBridgeView } from './views/RepairBridgeView';
import { KintsugiMomentsView } from './views/KintsugiMomentsView';
import { NightstandClockView } from './views/NightstandClockView';
import { CanvasOfUsView } from './views/CanvasOfUsView';
import { RitualsGardenView } from './views/RitualsGardenView';
import { HearthGardenView } from './views/HearthGardenView';
import { ConstellationView } from './views/ConstellationView';
import { CareCompassView } from './views/CareCompassView';
import { LettersView } from './views/LettersView';
import { WhisperMemosView } from './views/WhisperMemosView';
import { CoordinatesMapView } from './views/CoordinatesMapView';
import { MidnightRadioView } from './views/MidnightRadioView';
import { TimeCapsuleView } from './views/TimeCapsuleView';
import { CoPresenceView } from './views/CoPresenceView';
import { ScratchCardsView } from './views/ScratchCardsView';
import { ScrapbookView } from './views/ScrapbookView';
import { AdventuresView } from './views/AdventuresView';
import { CookbookView } from './views/CookbookView';
import { IntuitionGameView, CURATED_DILEMMAS } from './views/IntuitionGameView';
import { DecksView } from './views/DecksView';
import { CycleView } from './views/CycleView';
import { JournalView } from './views/JournalView';
import { RepairKitView } from './views/RepairKitView';
import { ListsView } from './views/ListsView';
import { ChoreSplitView } from './views/ChoreSplitView';
import { MoneyLightView } from './views/MoneyLightView';
import { TimelineView } from './views/TimelineView';
import { SettingsView } from './views/SettingsView';

export const App: React.FC = () => {
  const [state, setState] = useState<SpaceState>(loadState);
  const [currentTab, setCurrentTab] = useState('home');
  const [theme, setTheme] = useState<ThemeMode>('linen');
  const [isCamouflaged, setIsCamouflaged] = useState(false);
  const [showStoryTour, setShowStoryTour] = useState(false);
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

  // The login password is held in memory only, for the lifetime of the tab. It
  // is what unlocks the local vault (replacing the old 4-digit PIN) and what
  // unwraps the pairing code held in escrow, so the app asks for it on every
  // open even when the Supabase session is still valid.
  const [authPassword, setAuthPassword] = useState<string | null>(null);
  const [authError, setAuthError] = useState('');
  // Opens the escrowed payload. Held in memory for the session so the join
  // phrase can be re-sealed later without the recovery phrase.
  const masterKeyRef = useRef<string | null>(null);

  // Whether the partner's device is actually in the space right now, and when
  // we last heard anything from them.
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // An invite was found, but the space cannot be opened until the partner
  // supplies the words that were spoken aloud.
  const [awaitingPhrase, setAwaitingPhrase] = useState<{ code: string; fromName: string } | null>(null);
  const [phraseInput, setPhraseInput] = useState('');
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

  // Hand the relay a token whenever one is available, so a refreshed Supabase
  // session reconnects without the user doing anything.
  useEffect(() => {
    if (!isAuthConfigured) return;
    let cancelled = false;
    getAccessToken().then(token => {
      if (!cancelled) wsRelay.setAccessToken(token);
    });
    return () => {
      cancelled = true;
    };
  }, [authPassword]);

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

  // A device signed out from elsewhere finds out here. Cooperative by nature:
  // it can only act once it is actually running again.
  useEffect(() => {
    if (!isAuthConfigured || !authPassword) return;

    const check = async () => {
      if (await isThisDeviceRevoked()) {
        setAuthError('This device was signed out from another device.');
        await handleSignOut();
      }
    };

    void check();
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authPassword]);

  useEffect(
    () =>
      wsRelay.subscribePresence(online => {
        setPartnerOnline(online);
        if (online) setState(prev => (prev.partnerEverSeen ? prev : { ...prev, partnerEverSeen: true }));
      }),
    []
  );

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
                  id: String(Date.now()),
                  title: partnerNameRef.current || 'Partner',
                  body: parsed.text || 'Sent you a message',
                  type: 'chat',
                  tabId: 'chat'
                });
              }
              if (typeof document !== 'undefined' && document.hidden) {
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
                  id: String(Date.now()),
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
          } else if (record.type === 'READ_RECEIPT') {
            // Our own laptop shares this role; its receipt must not mark our
            // messages as read by the partner.
            if (record.authorId === state.activeUser) return;
            const upTo = Number(parsed.upTo) || 0;
            setState(prev => ({
              ...prev,
              partnerReadAt: Math.max(prev.partnerReadAt || 0, upTo)
            }));
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
              id: String(Date.now()),
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
      void writeVault(vaultKey, { state: pruneForStorage(state), session }).then(ok =>
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

  const handleSelectTab = (tabId: string) => {
    setCurrentTab(tabId);
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
      id: Date.now().toString(),
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
      id: Date.now().toString()
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
      id: Date.now().toString()
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
      id: Date.now().toString(),
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
      id: Date.now().toString()
    };
    setState(prev => ({
      ...prev,
      chores: [newChore, ...prev.chores]
    }));
  };

  const handleAddExpense = (expense: Omit<ExpenseItem, 'id'>) => {
    const newExpense: ExpenseItem = {
      ...expense,
      id: Date.now().toString()
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
          id: Date.now().toString(),
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
          id: Date.now().toString(),
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
      id: Date.now().toString()
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
        id: `peb-${Date.now()}`,
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
      id: 'whisper-' + Date.now(),
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
      id: `round-${Date.now()}`,
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
    return <CalculatorDecoy onUnlock={() => setIsCamouflaged(false)} secretPin={decoyCode} />;
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
  const handleRotateCode = (newCode: string) => {
    if (!session || newCode === session.code) return;

    const rotated = { ...session, code: newCode };
    setSession(rotated);
    if (!vaultKey) saveSpaceSession(rotated);
    setSpaceVersion(v => v + 1);
  };

  /**
   * Everything that has to happen once an account is confirmed.
   *
   * Resolves which space this person belongs to, in priority order:
   *   1. an escrowed pairing code they already have (restoring a new device)
   *   2. an invite a partner left for them (joining an existing space)
   *   3. a freshly generated code (a brand new space)
   *
   * The code itself is never asked for and never shown; it is escrowed under
   * the password and the recovery phrase so it can survive a new device.
   */
  const handleAuthenticated = async (
    password: string,
    recoveryPhrase: string | null,
    displayName: string
  ) => {
    setAuthError('');
    wsRelay.setAccessToken(await getAccessToken());
    void registerThisDevice();

    let code: string | null = null;
    let role: SpaceRole = 'user';

    try {
      let joinPhrase: string | undefined;

      const escrow = await loadEscrow();
      if (escrow) {
        const master = await unwrapSecret(escrow.wrapped_by_password, password);
        if (master) {
          masterKeyRef.current = master;
          const secret = escrow.payload ? await openSpaceSecret(master, escrow.payload) : null;
          code = secret?.code || null;
          joinPhrase = secret?.joinPhrase;
        }
        if (!code) {
          // The account is fine but this password cannot open the escrow, which
          // means it was changed after the space was sealed.
          setAuthError(
            'Your account opened, but this password cannot unlock your sanctuary. Use the password you had when you created it, or restore with your 12-word phrase.'
          );
          return;
        }
      }

      if (!code) {
        const invite = await fetchPendingInvite();
        if (invite) {
          // The code came through the server, so it is not sufficient on its
          // own. Ask for the words the partner spoke before opening anything.
          await acceptInvite(invite.id);
          setAuthPassword(password);
          setAwaitingPhrase({ code: invite.code, fromName: invite.from_name || 'Your partner' });
          return;
        }
      }

      const isNewSpace = !code;
      if (!code) code = generatePairingCode();

      // Only a fresh signup carries a recovery phrase, and that is the only
      // moment both wrappings can be written together.
      if (recoveryPhrase) {
        const master = generateMasterKey();
        masterKeyRef.current = master;
        const wrapped = await wrapForEscrow(master, password, recoveryPhrase);
        await saveEscrow({
          wrapped_by_password: wrapped.byPassword,
          wrapped_by_recovery: wrapped.byRecovery,
          payload: await sealSpaceSecret(master, { code, joinPhrase })
        });
      }

      const nextSession: SpaceSession = {
        code,
        role,
        joinPhrase,
        userName: displayName || state.userName || (role === 'user' ? 'You' : 'Partner')
      };

      setAuthPassword(password);
      setSession(nextSession);

      // The password replaces the PIN, so the local vault is keyed on it.
      if (hasEncryptedVault()) {
        const opened = await unlockVault(password);
        if (opened) {
          setState({ ...opened.payload.state, isPaired: true, activeUser: role, pinEnabled: true });
          setVaultKey(opened.key);
          setIsLocked(false);
        } else {
          setAuthError('This device holds a sanctuary sealed with a different password.');
          return;
        }
      } else {
        const nextState: SpaceState = {
          ...state,
          isPaired: true,
          activeUser: role,
          userName: nextSession.userName || state.userName,
          pinEnabled: true
        };
        setState(nextState);
        const key = await createVault(password, { state: nextState, session: nextSession });
        setVaultKey(key);
        setIsLocked(false);
        clearState();
        clearSpaceSession();
      }

      if (isNewSpace) console.info('[Auth] New sanctuary created for this account.');
      setSpaceVersion(v => v + 1);
    } catch (e: any) {
      console.error('[Auth] Sign-in flow failed', e);
      setAuthError('Could not open your sanctuary. Check your connection and try again.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    wsRelay.setAccessToken(null);
    wsRelay.disconnect();
    setAuthPassword(null);
    setVaultKey(null);
    setSession(null);
    setIsLocked(hasEncryptedVault());
  };

  /** Adopts a space from an invite once the spoken words are supplied. */
  const handleJoinWithPhrase = () => {
    if (!awaitingPhrase) return;
    const phrase = normalizeJoinPhrase(phraseInput);
    if (!phrase) return;

    const joined: SpaceSession = {
      code: awaitingPhrase.code,
      role: 'partner',
      joinPhrase: phrase,
      userName: state.userName || 'Partner'
    };
    setSession(joined);
    setState(prev => ({ ...prev, isPaired: true, activeUser: 'partner' }));
    setAwaitingPhrase(null);
    setPhraseInput('');
    setSpaceVersion(v => v + 1);
  };

  /** Records the phrase this space uses, so reconnects derive the same key. */
  const handleSetJoinPhrase = (phrase: string) => {
    const clean = normalizeJoinPhrase(phrase);
    setSession(prev => (prev ? { ...prev, joinPhrase: clean } : prev));
    setSpaceVersion(v => v + 1);

    // Push it into escrow as well, or a laptop signing in later would join the
    // right room holding the wrong key and see nothing but undecryptable noise.
    const master = masterKeyRef.current;
    if (master && session?.code) {
      void sealSpaceSecret(master, { code: session.code, joinPhrase: clean }).then(updateEscrowPayload);
    }
  };

  /** Renames the space on both devices. */
  const handleRenameVault = (name: string) => {
    const clean = name.trim().slice(0, 40);
    setState(prev => ({ ...prev, vaultName: clean }));
    wsRelay.broadcastUpdate('VAULT_NAME', { name: clean });
    localMesh.broadcastLocally('VAULT_NAME', { name: clean }, state.activeUser);
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
  // An invite was accepted, but the space stays sealed until the spoken words
  // arrive. The server delivered the code; it cannot supply this.
  if (awaitingPhrase) {
    return (
      <div className="min-h-screen bg-linen-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="text-center space-y-2">
            <h1 className="font-serif text-2xl font-medium text-linen-primary">
              {awaitingPhrase.fromName} invited you
            </h1>
            <p className="text-xs text-linen-secondary leading-relaxed">
              Ask them for the four words shown on their screen, and type them here. They were
              never sent through the internet, which is what keeps this space private.
            </p>
          </div>

          <input
            type="text"
            autoFocus
            value={phraseInput}
            onChange={(e) => setPhraseInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinWithPhrase()}
            placeholder="four words they read out"
            className="w-full px-4 py-3 rounded-2xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-2 focus:ring-linen-primary text-linen-primary text-base"
          />

          <button
            disabled={normalizeJoinPhrase(phraseInput).split(' ').filter(Boolean).length < 2}
            onClick={handleJoinWithPhrase}
            className="w-full py-3.5 bg-linen-primary text-linen-surface font-medium rounded-2xl hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            Open our space
          </button>

          <p className="text-[11px] text-linen-secondary text-center leading-relaxed">
            If the words are wrong you will land in the right place but see nothing — come back
            here and try again.
          </p>
        </div>
      </div>
    );
  }

  // Accounts gate everything. The password is held only in memory, so it is
  // asked for on each open - it is both the sign-in and the device unlock.
  if (isAuthConfigured && !authPassword) {
    return (
      <>
        {authError && (
          <div className="fixed top-3 inset-x-3 z-50 max-w-md mx-auto rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 shadow-sm">
            <p className="text-xs text-rose-900 leading-relaxed">{authError}</p>
          </div>
        )}
        <LoginView onAuthenticated={handleAuthenticated} />
      </>
    );
  }

  if (isLocked && !isAuthConfigured) {
    const handlePinInput = (val: string) => {
      if (isUnlocking) return;
      const next = (pinAttempt + val).slice(0, 4);
      setPinAttempt(next);
      setPinError(false);

      if (next.length === 4) {
        setIsUnlocking(true);
        void unlockVault(next)
          .then(opened => {
            if (opened) {
              setState(opened.payload.state);
              setSession(opened.payload.session);
              setVaultKey(opened.key);
              setIsLocked(false);
              setPinAttempt('');
              setSpaceVersion(v => v + 1);
            } else {
              setPinError(true);
              setTimeout(() => {
                setPinAttempt('');
                setPinError(false);
              }, 700);
            }
          })
          .finally(() => setIsUnlocking(false));
      }
    };

    return (
      <div className="min-h-screen bg-linen-bg flex items-center justify-center p-4">
        <div className="max-w-xs w-full bg-linen-surface border border-linen-border rounded-3xl p-8 shadow-sm text-center space-y-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 shadow-xs">
            <Lock className="w-7 h-7 text-rose-500" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-medium text-linen-primary">Sanctuary Locked</h2>
            <p className="text-xs text-linen-secondary mt-1">Enter your 4-digit PIN to open</p>
          </div>

          <div className="flex justify-center space-x-3 py-2">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-10 h-12 rounded-xl border flex items-center justify-center text-xl font-mono transition-all ${
                  pinError
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
                className="py-3.5 rounded-xl border border-linen-border bg-linen-variant/40 hover:bg-linen-variant text-linen-primary text-lg font-medium transition-colors cursor-pointer"
              >
                {btn}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!session || !state.isPaired) {
    return (
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
    );
  }


  return (
    <div className={`min-h-screen transition-colors duration-200 ${themeClass}`}>
      <Navigation
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

      {isAuthConfigured && session && !state.partnerEverSeen && (
        <InvitePartnerBanner
          spaceCode={session.code}
          userName={state.userName}
          joinPhrase={session.joinPhrase}
          onSetJoinPhrase={handleSetJoinPhrase}
        />
      )}

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

      <main
        className={`mx-auto px-4 sm:px-6 py-6 ${inApp ? 'pb-32' : 'pb-20'} ${
          isTablet ? 'max-w-5xl' : 'max-w-3xl'
        }`}
      >
        {currentTab === 'home' && (
          <HomeView
            state={state}
            spaceCode={session?.code}
            onUpdateReport={handleUpdateReport}
            onToggleUserFlag={handleToggleUserFlag}
            onNavigate={setCurrentTab}
            onSendNeed={(need) => handleSendMessage(`I need: ${need.title} — ${need.description}`, true)}
            onOpenTour={() => setShowStoryTour(true)}
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
            vaultName={state.vaultName}
            onRenameVault={handleRenameVault}
            joinPhrase={session?.joinPhrase || ''}
            onSetJoinPhrase={handleSetJoinPhrase}
            partnerOnline={partnerOnline}
            relayStatus={relayStatus}
            lastSyncedAt={lastSyncedAt}
            onSignOut={handleSignOut}
            userName={state.userName}
            onToggleActiveUser={toggleActiveUser}
            decoyCode={decoyCode}
            onUpdateDecoyCode={(newCode) => {
              setDecoyCode(newCode);
              localStorage.setItem('two_decoy_code', newCode);
            }}
            autoCamouflageOnBlur={autoCamouflageOnBlur}
            onToggleAutoCamouflage={(val) => {
              setAutoCamouflageOnBlur(val);
              localStorage.setItem('two_auto_camo', String(val));
            }}
          />
        )}
      </main>

      {/* In-App Notification Toast for Messages & Letters */}
      <InAppNotificationToast
        notification={inAppNotification}
        onDismiss={() => setInAppNotification(null)}
        onOpenTab={handleSelectTab}
      />

      {/* Sanctuary Directory Modal (All 32 Spaces) */}
      <SanctuaryDirectoryModal
        isOpen={showDirectoryModal}
        onClose={() => setShowDirectoryModal(false)}
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        unreadChatCount={unreadChatCount}
      />

      {/* Interactive Story Tour Modal */}
      {inApp && (
        <AppDock
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          unreadChatCount={unreadChatCount}
          isTablet={isTablet}
        />
      )}

      <StoryTourModal
        isOpen={showStoryTour}
        onClose={() => setShowStoryTour(false)}
        onNavigateTab={(tab) => handleSelectTab(tab)}
      />

      {/* Real-Time Sensory Haptic Pulse Overlay */}
      <SensoryPulseOverlay activeUser={state.activeUser} />
    </div>
  );
};
