import React, { useState, useEffect, useRef } from 'react';
import { loadState, saveState, clearState, pruneForStorage, SpaceState } from './core/storage';
import { wsRelay, RelayStatus } from './core/ws';
import {
  hasEncryptedVault,
  unlockVault,
  createVault,
  writeVault,
  destroyVault
} from './core/vault';
import {
  isWeakPairingCode,
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
  const [isUnlocking, setIsUnlocking] = useState(false);
  // Device storage is full: the app still runs from memory, but nothing is
  // being saved. Silence here would cost the user everything on refresh.
  const [storageFull, setStorageFull] = useState(false);
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

  // Derive this couple's room id and content key from the stored pairing code,
  // then join the relay. Nothing is sent until the key exists, so records are
  // never broadcast in the clear.
  useEffect(() => {
    if (isLocked || !session) {
      wsRelay.disconnect();
      return;
    }

    let cancelled = false;
    deriveSpaceCredentials(session.code, session.role)
      .then(creds => {
        if (!cancelled) wsRelay.connect(creds);
      })
      .catch(e => console.error('[Space] Key derivation failed', e));

    return () => {
      cancelled = true;
    };
  }, [session, spaceVersion, isLocked]);

  // Listen for remote updates
  useEffect(() => {
    const unsubscribe = wsRelay.subscribe((msg) => {
      if (msg.type === 'REMOTE_RECORD') {
        const record = msg.record;
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

  const handleSelectTab = (tabId: string) => {
    setCurrentTab(tabId);
    if (tabId === 'chat') {
      setUnreadChatCount(0);
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
      isNeedCard,
      ...extra
    };
    wsRelay.broadcastUpdate('CHAT', newMessage);
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
        onComplete={(newSession: SpaceSession, enteredName: string, chosenPin: string | null) => {
          const namedSession = { ...newSession, userName: enteredName };

          // The partner who created the space is 'user'; the joiner is
          // 'partner'. Every record on the wire is attributed with this role.
          const nextState: SpaceState = {
            ...state,
            isPaired: true,
            activeUser: newSession.role,
            userName: enteredName,
            pinEnabled: !!chosenPin
          };

          setSession(namedSession);
          setState(nextState);
          setSpaceVersion(v => v + 1);

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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-20">
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
