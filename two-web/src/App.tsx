import React, { useState, useEffect } from 'react';
import { loadState, saveState, clearState, SpaceState } from './core/storage';
import { wsRelay } from './core/ws';
import { ThemeMode, NeedItem, ChatMessage, JournalEntry, AgreementItem, ListItem, ChoreItem, ExpenseItem, CycleRecord, CycleSharingLevel } from './types';
import { Navigation } from './components/Navigation';
import { CalculatorDecoy } from './components/CalculatorDecoy';
import { StoryTourModal } from './components/StoryTourModal';
import { Locale } from './core/i18n';
import { OnboardingView } from './views/OnboardingView';
import { HomeView } from './views/HomeView';
import { ChatView } from './views/ChatView';
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

  // Check URL parameters for dual-window live sync demonstration
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const perspective = params.get('perspective');
    if (perspective === 'partner' || perspective === 'user') {
      setState(prev => ({ ...prev, activeUser: perspective }));
    }
  }, []);

  // Connect to WebSocket Relay on mount and listen for remote updates
  useEffect(() => {
    wsRelay.connect('default-space-id', state.activeUser);

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
          }
        } catch (e) {
          console.error('[Relay Ingest Error]', e);
        }
      }
    });

    return () => unsubscribe();
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

  if (!state.isPaired) {
    return <OnboardingView onComplete={() => setState(prev => ({ ...prev, isPaired: true }))} />;
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
        locale={locale}
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
          />
        )}

        {currentTab === 'chat' && (
          <ChatView
            messages={state.messages}
            activeUser={state.activeUser}
            onSendMessage={handleSendMessage}
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
          />
        )}
      </main>

      {/* Interactive Story Tour Modal */}
      <StoryTourModal
        isOpen={showStoryTour}
        onClose={() => setShowStoryTour(false)}
        onNavigateTab={(tab) => setCurrentTab(tab)}
      />
    </div>
  );
};
