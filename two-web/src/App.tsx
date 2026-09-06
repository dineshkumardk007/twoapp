import React, { useState, useEffect } from 'react';
import { loadState, saveState, clearState, SpaceState } from './core/storage';
import { wsRelay, RelayStatus } from './core/ws';
import {
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
import { Locale } from './core/i18n';
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

  // Session & relay connection state
  const [session, setSession] = useState<SpaceSession | null>(loadSpaceSession);
  const [relayStatus, setRelayStatus] = useState<RelayStatus>(() => wsRelay.getStatus());

  // Track live WebSocket relay status
  useEffect(() => {
    return wsRelay.subscribeStatus((status) => {
      setRelayStatus(status);
    });
  }, []);

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
    if (!session) {
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
  }, [session, spaceVersion]);

  // Listen for remote updates
  useEffect(() => {
    const unsubscribe = wsRelay.subscribe((msg) => {
      if (msg.type === 'REMOTE_RECORD') {
        const record = msg.record;
        try {
          const parsed = JSON.parse(record.payload);

          if (record.type === 'CHAT') {
            setState(prev => ({
              ...prev,
              messages: [...prev.messages, parsed]
            }));
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
    saveState(state);
  }, [state]);

  const toggleActiveUser = () => {
    setState(prev => ({
      ...prev,
      activeUser: prev.activeUser === 'user' ? 'partner' : 'user'
    }));
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
    clearState();
    window.location.reload();
  };

  const themeClass = {
    linen: 'bg-linen-bg text-linen-primary',
    slate: 'bg-slate-bg text-slate-primary dark',
    forest: 'bg-forest-bg text-forest-primary',
    terracotta: 'bg-terracotta-bg text-terracotta-primary'
  }[theme];

  if (isCamouflaged) {
    return <CalculatorDecoy onUnlock={() => setIsCamouflaged(false)} />;
  }

  const handleUnpair = () => {
    if (window.confirm('Are you sure you want to disconnect from this space? You can reconnect anytime with your 8-word pairing phrase.')) {
      clearSpaceSession();
      wsRelay.disconnect();
      setSession(null);
      setState(prev => ({ ...prev, isPaired: false }));
      setSpaceVersion(v => v + 1);
    }
  };

  if (!session || !state.isPaired) {
    return (
      <OnboardingView
        onComplete={(newSession: SpaceSession) => {
          saveSpaceSession(newSession);
          setSession(newSession);
          // The partner who created the space is 'user'; the joiner is
          // 'partner'. Every record on the wire is attributed with this role.
          setState(prev => ({ ...prev, isPaired: true, activeUser: newSession.role }));
          setSpaceVersion(v => v + 1);
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${themeClass}`}>
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        activeUser={state.activeUser}
        onToggleActiveUser={toggleActiveUser}
        onEmergencyExit={handleEmergencyExit}
        onToggleCamouflage={() => setIsCamouflaged(true)}
        onOpenStoryTour={() => setShowStoryTour(true)}
        onTriggerPulse={() => triggerGlobalPulse('Warm hug across distance')}
        locale={locale}
        relayStatus={relayStatus}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {currentTab === 'home' && (
          <HomeView
            state={state}
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
            currentTheme={theme}
            onSelectTheme={setTheme}
            onEmergencyWipe={handleEmergencyExit}
            onRestoreState={(restored) => setState(restored)}
            currentLocale={locale}
            onSelectLocale={setLocale}
            onToggleCamouflage={() => setIsCamouflaged(true)}
            onUnpair={handleUnpair}
          />
        )}
      </main>

      {/* Interactive Story Tour Modal */}
      <StoryTourModal
        isOpen={showStoryTour}
        onClose={() => setShowStoryTour(false)}
        onNavigateTab={(tab) => setCurrentTab(tab)}
      />

      {/* Real-Time Sensory Haptic Pulse Overlay */}
      <SensoryPulseOverlay activeUser={state.activeUser} />
    </div>
  );
};
