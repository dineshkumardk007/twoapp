import React, { useState, useEffect, useRef } from 'react';
import { PairingModal } from './PairingModal';
import { LocalMeshModal } from './LocalMeshModal';
import { AmbientSoundscapeModal } from './AmbientSoundscapeModal';
import { CoRegulationModal } from './CoRegulationModal';
import { SanctuaryToolsModal } from './SanctuaryToolsModal';
import { HeartOptionsModal } from './HeartOptionsModal';
import { NeedMenuModal } from './NeedMenuModal';
import { signalAsks } from '../core/chatChrome';
import { haptic } from '../core/haptics';
import { Shield, Users, LogOut, Heart, MessageSquare, BookOpen, Handshake, CheckSquare, Layers, DollarSign, Image, Settings, Sparkles, Moon, Calculator, Flame, Mail, Compass, Radio, Star, MapPin, Utensils, Smile, Wind, Hourglass, Coffee, Gift, BookMarked, Sprout, Feather, Mic, Bed, Map, Palette, LayoutGrid } from 'lucide-react';
import { Locale, getTranslation, useT } from '../core/i18n';

interface NavigationProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeUser: 'user' | 'partner';
  onToggleActiveUser: () => void;
  /** Hides Two at once - locks it, or shows the calculator - deleting nothing. */
  onQuickExit: () => void;
  /** Whether a PIN is set, so Quick Exit locks rather than disguises. */
  hasPin?: boolean;
  onToggleCamouflage?: () => void;
  onOpenStoryTour?: () => void;
  onTriggerPulse?: () => void;
  locale?: Locale;
  relayStatus?: 'idle' | 'connecting' | 'connected' | 'reconnecting';
  /** What the couple named their space; shown instead of the product name. */
  vaultName?: string;
  /** True only when the partner's device is actually in the space right now. */
  partnerOnline?: boolean;
  unreadChatCount?: number;
  onOpenDirectory?: () => void;
  partnerName?: string;
  /**
   * Render a single slim bar instead of the website's full header.
   *
   * Used by the Android app, where the dock is the navigation. The website's
   * header carries a second row of thirty-two tabs under the brand, and that
   * row is what made it cost a fifth of a phone screen - not the brand row
   * itself. So the app keeps the four things that row never had anywhere else
   * to live (the space's name, whether it is connected, Heart and Tools) and
   * drops the rest: the tab row, the tour, the spaces button and the quick
   * exit, all of which the dock or the tools hub already reach.
   */
  compact?: boolean;
  /** Incremented to open the tools hub from outside. */
  openToolsSignal?: number;
  /** Likewise for the heart panel, which also lives inside this component; the chat's ⋮ bumps it. */
  openHeartSignal?: number;
  /**
   * Private Chat is in front in the app: no bar, because the chat's own header
   * takes the top. The modals stay mounted, so Heart from the chat's ⋮ still
   * opens. Compact (app) only; the website's header never hides.
   */
  barHidden?: boolean;
  /**
   * Sends an "Ask for what you need" card to the couple's chat. The sheet
   * lives here, under Tools, since the chat's ⋮ no longer has it.
   */
  onSendNeed?: (text: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  activeUser,
  onToggleActiveUser,
  onQuickExit,
  hasPin = false,
  onToggleCamouflage,
  onOpenStoryTour,
  onTriggerPulse,
  locale = 'en',
  relayStatus = 'connected',
  vaultName = '',
  partnerOnline = false,
  unreadChatCount = 0,
  onOpenDirectory,
  partnerName = 'Partner',
  compact = false,
  openToolsSignal = 0,
  openHeartSignal = 0,
  barHidden = false,
  onSendNeed
}) => {
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showMeshModal, setShowMeshModal] = useState(false);
  const [showSoundscapeModal, setShowSoundscapeModal] = useState(false);
  const [showCoRegulationModal, setShowCoRegulationModal] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [showHeartModal, setShowHeartModal] = useState(false);
  const [showNeedModal, setShowNeedModal] = useState(false);
  const t = getTranslation(locale);
  const tr = useT();

  const tabs = [
    { id: 'home', label: t.tabs.home, icon: Heart },
    { id: 'chat', label: t.tabs.chat, icon: MessageSquare },
    { id: 'softlanding', label: tr('Soft Landing'), icon: Feather },
    { id: 'nightstand', label: tr('Nightstand'), icon: Bed },
    { id: 'garden', label: tr('Hearth Garden'), icon: Sprout },
    { id: 'whispers', label: tr('Whispers'), icon: Mic },
    { id: 'coordinates', label: tr('Coordinates'), icon: Map },
    { id: 'radio', label: tr('Midnight Radio'), icon: Radio },
    { id: 'stateofunion', label: tr('State of Union'), icon: Shield },
    { id: 'canvas', label: tr('Canvas of Us'), icon: Palette },
    { id: 'repairbridge', label: tr('Repair Bridge'), icon: Handshake },
    { id: 'kintsugi', label: tr('Kintsugi Moments'), icon: Sparkles },
    { id: 'rituals', label: t.tabs.rituals, icon: Flame },
    { id: 'constellation', label: tr('Constellation'), icon: Star },
    { id: 'compass', label: tr('Care Compass'), icon: Compass },
    { id: 'letters', label: t.tabs.letters, icon: Mail },
    { id: 'scratch', label: tr('Scratch Cards'), icon: Gift },
    { id: 'capsules', label: tr('Time Capsule'), icon: Hourglass },
    { id: 'presence', label: tr('Co-Presence'), icon: Coffee },
    { id: 'scrapbook', label: tr('Memoir Book'), icon: BookMarked },
    { id: 'adventures', label: t.tabs.adventures, icon: MapPin },
    { id: 'recipes', label: tr('Cookbook'), icon: Utensils },
    { id: 'intuition', label: tr('Intuition'), icon: Smile },
    { id: 'decks', label: t.tabs.decks, icon: Sparkles },
    { id: 'cycle', label: t.tabs.cycle, icon: Moon },
    { id: 'journal', label: t.tabs.journal, icon: BookOpen },
    { id: 'repair', label: t.tabs.repair, icon: Handshake },
    { id: 'lists', label: t.tabs.lists, icon: CheckSquare },
    { id: 'chores', label: t.tabs.chores, icon: Layers },
    { id: 'money', label: t.tabs.money, icon: DollarSign },
    { id: 'timeline', label: t.tabs.timeline, icon: Image },
    { id: 'settings', label: t.tabs.settings, icon: Settings },
  ];

  const modals = (
    <>
    <PairingModal
        isOpen={showPairingModal}
        onClose={() => setShowPairingModal(false)}
        activeUser={activeUser}
      />

      <LocalMeshModal
        isOpen={showMeshModal}
        onClose={() => setShowMeshModal(false)}
        activeUser={activeUser}
      />

      <AmbientSoundscapeModal
        isOpen={showSoundscapeModal}
        onClose={() => setShowSoundscapeModal(false)}
        activeUser={activeUser}
      />

      <CoRegulationModal
        isOpen={showCoRegulationModal}
        onClose={() => setShowCoRegulationModal(false)}
        activeUser={activeUser}
      />

      <SanctuaryToolsModal
        isOpen={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        onOpenSoundscapes={() => setShowSoundscapeModal(true)}
        onOpenCoRegulation={() => setShowCoRegulationModal(true)}
        onTriggerPulse={onTriggerPulse}
        onOpenStoryTour={onOpenStoryTour}
        onOpenSettings={() => onSelectTab('settings')}
        onOpenHeartModal={() => setShowHeartModal(true)}
        onToggleCamouflage={onToggleCamouflage}
        onOpenMesh={() => setShowMeshModal(true)}
        onOpenSafetyNumbers={() => setShowPairingModal(true)}
        onOpenNeed={onSendNeed ? () => setShowNeedModal(true) : undefined}
        onQuickExit={onQuickExit}
        hasPin={hasPin}
        relayStatus={relayStatus}
        activeUser={activeUser}
        vaultName={vaultName}
        partnerOnline={partnerOnline}
      />

      <HeartOptionsModal
        isOpen={showHeartModal}
        onClose={() => setShowHeartModal(false)}
        partnerName={partnerName}
      />

      <NeedMenuModal
        isOpen={showNeedModal}
        onClose={() => setShowNeedModal(false)}
        onSelectNeed={(need) => {
          // Sent in the words of whoever sends it.
          onSendNeed?.(tr('I need: {title} — {description}', { title: tr(need.title), description: tr(need.description) }));
          haptic('confirm');
          setShowNeedModal(false);
        }}
      />
    </>
  );

  // Asked for from outside by bumping a counter; opening on the value itself
  // would reopen the modal every time the component re-rendered. Each counter
  // remembers the last value it acted on, starting with the one it mounted
  // with: App drops this component on its early returns (a group, the lock,
  // the calculator), and coming back holding a bumped counter must not open
  // Heart or Tools by itself.
  const toolsSeen = useRef(openToolsSignal);
  useEffect(() => {
    if (!signalAsks(toolsSeen.current, openToolsSignal)) return;
    toolsSeen.current = openToolsSignal;
    setShowToolsModal(true);
  }, [openToolsSignal]);

  const heartSeen = useRef(openHeartSignal);
  useEffect(() => {
    if (!signalAsks(heartSeen.current, openHeartSignal)) return;
    heartSeen.current = openHeartSignal;
    setShowHeartModal(true);
  }, [openHeartSignal]);

  if (compact) {
    // The chat's own header is the top of the screen; Heart moved into its ⋮
    // and Tools is one tap away on any other tab.
    if (barHidden) return <>{modals}</>;

    const connected = relayStatus === 'connected';
    const connecting = relayStatus === 'connecting' || relayStatus === 'reconnecting';

    return (
      <>
        {/* Solid, with the sky's light drawn in, not frosted glass (index.css,
            Glass on a phone): the blur was redone on every frame of a scroll. */}
        <header className="app-topbar sticky top-0 z-40 border-b border-linen-border/60 sky-bar">
          <div className="flex h-11 items-center justify-between gap-2 px-3">
            {/* Left: the product name, then the link's state - two things, the
                way the website has always had them. They were briefly merged
                into one label, which read fine until a couple named their
                space: the name they chose replaced the app's own, and there
                was then nothing on the screen saying what the app was. */}
            <div className="flex min-w-0 items-center gap-2">
              <span
                onClick={() => onSelectTab('home')}
                className="aurora-text shrink-0 cursor-pointer select-none font-serif text-[22px] font-semibold tracking-tight"
              >
                {t.appName}
              </span>

              <button
                onClick={() => setShowPairingModal(true)}
                className="tap-target flex min-w-0 items-center gap-1.5 rounded-full border border-linen-border bg-linen-surface/60 px-2 py-1 active:scale-95 transition-transform"
                title={tr('End-to-end encrypted - tap to verify safety numbers')}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    connected
                      ? 'bg-aurora-teal shadow-[0_0_8px_rgb(var(--c-teal)/0.8)]'
                      : connecting
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-stone-400'
                  }`}
                />
                {vaultName && (
                  <span className="truncate text-[11px] font-medium text-linen-primary">
                    {vaultName}
                  </span>
                )}
                <span className="shrink-0 text-[11px] text-linen-secondary">
                  {connected ? (partnerOnline ? tr('together') : tr('synced')) : tr('connecting')}
                </span>
              </button>
            </div>

            {/* Right: the two panels with no other home. Tools is the hub for
                soundscapes, co-regulation, the mesh, safety numbers,
                camouflage and the quick exit. */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => setShowHeartModal(true)}
                className="tap-target inline-flex items-center rounded-full bg-linen-accent text-linen-surface px-3 py-1 text-xs font-semibold shadow-glow active:scale-95 transition-transform"
                title={tr('Heart Touch: send a sensory pulse')}
              >
                <Heart className="heart-beat mr-1 h-3.5 w-3.5 shrink-0 fill-current" />
                <span>{tr('Heart')}</span>
              </button>
              <button
                onClick={() => setShowToolsModal(true)}
                className="tap-target inline-flex items-center rounded-full border border-linen-border bg-linen-surface/60 px-3 py-1 text-xs font-medium text-linen-primary active:scale-95 transition-transform"
                title={tr('Sanctuary Tools (soundscapes, breathing, camouflage, mesh & more)')}
              >
                <Compass className="mr-1 h-3.5 w-3.5 shrink-0 text-linen-accent" />
                <span>{tr('Tools')}</span>
              </button>
            </div>
          </div>
        </header>
        {modals}
      </>
    );
  }

  return (
    <>
      <header className="border-b border-linen-border bar-panel-80 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Privacy Status */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <span
              className="font-serif text-2xl font-medium tracking-tight text-linen-primary cursor-pointer select-none"
              onClick={() => onSelectTab('home')}
            >
              {t.appName}
            </span>
            <button
              onClick={() => setShowPairingModal(true)}
              className="inline-flex items-center text-xs font-medium text-linen-secondary px-2 sm:px-2.5 py-1 rounded-full bg-linen-variant hover:bg-linen-border border border-linen-border transition-colors cursor-pointer select-none"
              title={tr('End-to-End Encrypted • Click to verify Safety Numbers')}
            >
              <span
                className={`w-2 h-2 rounded-full mr-1.5 shrink-0 ${
                  relayStatus === 'connected'
                    ? 'bg-emerald-500 shadow-xs animate-pulse'
                    : relayStatus === 'connecting' || relayStatus === 'reconnecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-stone-400'
                }`}
              />
              <span className="hidden sm:inline font-medium text-linen-primary">
                {/* "Two • Live" only ever meant "I reached the server", which read
                    as "we are connected to each other". Show who you are with,
                    and keep presence a separate, honest signal. */}
                {relayStatus === 'connected'
                  ? partnerOnline
                    ? tr('{name} • together', { name: vaultName || 'Two' })
                    : tr('{name} • synced', { name: vaultName || 'Two' })
                  : tr('{name} • connecting', { name: vaultName || 'Two' })}
              </span>
              <span className="sm:hidden font-semibold text-[10px] text-linen-primary">
                {relayStatus === 'connected' ? (partnerOnline ? tr('Together') : tr('Synced')) : tr('Sync')}
              </span>
            </button>
          </div>

          {/* Action Menu Buttons: Tour, Heart, Spaces, Tools. On a phone-width
              website they are icons only (each keeps its title), so the row
              fits the screen instead of widening the whole page. */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5">
            {/* 1. Interactive Story Tour button */}
            {onOpenStoryTour && (
              <button
                onClick={onOpenStoryTour}
                className="inline-flex items-center text-xs font-medium text-linen-accent px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-linen-variant/80 hover:bg-linen-variant border border-linen-border transition-colors cursor-pointer shadow-2xs shrink-0"
                title={tr('Interactive 5-Act Walkthrough: A Day in the Life with Two')}
              >
                <Sparkles className="w-3.5 h-3.5 sm:mr-1 text-linen-accent shrink-0" />
                <span className="hidden sm:inline">{tr('Tour')}</span>
              </button>
            )}

            {/* 2. Heart Sensory Touch & Options button */}
            <button
              onClick={() => setShowHeartModal(true)}
              className="inline-flex items-center text-xs font-medium text-rose-600 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-rose-50/80 hover:bg-rose-100/80 border border-rose-200/90 transition-colors cursor-pointer shadow-2xs shrink-0 group"
              title={tr('Heart Touch: Send sensory pulse & loving presence')}
            >
              <Heart className="w-3.5 h-3.5 sm:mr-1 text-rose-500 fill-rose-500 shrink-0 group-hover:scale-110 transition-transform animate-pulse" />
              <span className="hidden sm:inline">{tr('Heart')}</span>
            </button>

            {/* 3. Sanctuary Spaces Explorer button */}
            {onOpenDirectory && (
              <button
                onClick={onOpenDirectory}
                className="inline-flex items-center text-xs font-medium text-linen-primary px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-linen-variant/80 hover:bg-linen-variant border border-linen-border transition-colors cursor-pointer shadow-2xs shrink-0"
                title={tr('Sanctuary Explorer (Browse All 32 Spaces)')}
              >
                <LayoutGrid className="w-3.5 h-3.5 sm:mr-1 text-linen-accent shrink-0" />
                <span className="hidden sm:inline">{tr('Spaces')}</span>
              </button>
            )}

            {/* 4. Sanctuary Tools Menu button */}
            <button
              onClick={() => setShowToolsModal(true)}
              className="inline-flex items-center text-xs font-medium text-linen-primary px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-linen-variant/80 hover:bg-linen-variant border border-linen-border transition-colors cursor-pointer shadow-2xs shrink-0"
              title={tr('Sanctuary Tools (Soundscapes, Breathing, Camouflage, Mesh & More)')}
            >
              <Compass className="w-3.5 h-3.5 sm:mr-1 text-linen-accent shrink-0" />
              <span className="hidden sm:inline">{tr('Tools')}</span>
            </button>

            {/* Quick Exit: hides Two, deletes nothing */}
            <button
              onClick={onQuickExit}
              className="p-1 sm:p-1.5 text-linen-secondary hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 cursor-pointer shrink-0"
              title={t.actions.quickExit}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 sm:space-x-3 overflow-x-auto pb-2 scrollbar-none">
          {onOpenDirectory && (
            <button
              onClick={onOpenDirectory}
              className="flex items-center px-2.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap bg-linen-variant/90 hover:bg-linen-variant text-linen-primary border border-linen-border/80 transition-colors shrink-0 cursor-pointer shadow-2xs"
              title={tr('Open Sanctuary Explorer')}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1 text-linen-accent" />
              <span>{tr('All Spaces')}</span>
            </button>
          )}

          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            const isChat = tab.id === 'chat';
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-[color,background-color,box-shadow] relative ${
                  isActive
                    ? 'bg-linen-primary text-linen-surface shadow-sm'
                    : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant'
                }`}
              >
                <Icon className="w-4 h-4 mr-1.5" />
                <span>{tab.label}</span>
                {isChat && unreadChatCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse leading-tight">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
      {modals}
    </>
  );
};
