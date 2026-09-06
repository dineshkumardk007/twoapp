import React, { useState } from 'react';
import { PairingModal } from './PairingModal';
import { LocalMeshModal } from './LocalMeshModal';
import { AmbientSoundscapeModal } from './AmbientSoundscapeModal';
import { CoRegulationModal } from './CoRegulationModal';
import { SanctuaryToolsModal } from './SanctuaryToolsModal';
import { HeartOptionsModal } from './HeartOptionsModal';
import { Shield, Users, LogOut, Heart, MessageSquare, BookOpen, Handshake, CheckSquare, Layers, DollarSign, Image, Settings, Sparkles, Moon, Calculator, Flame, Mail, Compass, Radio, Star, MapPin, Utensils, Smile, Wind, Hourglass, Coffee, Gift, BookMarked, Sprout, Feather, Mic, Bed, Map, Palette, LayoutGrid } from 'lucide-react';
import { Locale, getTranslation } from '../core/i18n';

interface NavigationProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeUser: 'user' | 'partner';
  onToggleActiveUser: () => void;
  onEmergencyExit: () => void;
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
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  activeUser,
  onToggleActiveUser,
  onEmergencyExit,
  onToggleCamouflage,
  onOpenStoryTour,
  onTriggerPulse,
  locale = 'en',
  relayStatus = 'connected',
  vaultName = '',
  partnerOnline = false,
  unreadChatCount = 0,
  onOpenDirectory,
  partnerName = 'Partner'
}) => {
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showMeshModal, setShowMeshModal] = useState(false);
  const [showSoundscapeModal, setShowSoundscapeModal] = useState(false);
  const [showCoRegulationModal, setShowCoRegulationModal] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [showHeartModal, setShowHeartModal] = useState(false);
  const t = getTranslation(locale);

  const tabs = [
    { id: 'home', label: t.tabs.home, icon: Heart },
    { id: 'chat', label: t.tabs.chat, icon: MessageSquare },
    { id: 'softlanding', label: 'Soft Landing', icon: Feather },
    { id: 'nightstand', label: 'Nightstand', icon: Bed },
    { id: 'garden', label: 'Hearth Garden', icon: Sprout },
    { id: 'whispers', label: 'Whispers', icon: Mic },
    { id: 'coordinates', label: 'Coordinates', icon: Map },
    { id: 'radio', label: 'Midnight Radio', icon: Radio },
    { id: 'stateofunion', label: 'State of Union', icon: Shield },
    { id: 'canvas', label: 'Canvas of Us', icon: Palette },
    { id: 'repairbridge', label: 'Repair Bridge', icon: Handshake },
    { id: 'kintsugi', label: 'Kintsugi Scars', icon: Sparkles },
    { id: 'rituals', label: t.tabs.rituals, icon: Flame },
    { id: 'constellation', label: 'Constellation', icon: Star },
    { id: 'compass', label: 'Care Compass', icon: Compass },
    { id: 'letters', label: t.tabs.letters, icon: Mail },
    { id: 'scratch', label: 'Scratch Cards', icon: Gift },
    { id: 'capsules', label: 'Time Capsule', icon: Hourglass },
    { id: 'presence', label: 'Co-Presence', icon: Coffee },
    { id: 'scrapbook', label: 'Memoir Book', icon: BookMarked },
    { id: 'adventures', label: t.tabs.adventures, icon: MapPin },
    { id: 'recipes', label: 'Cookbook', icon: Utensils },
    { id: 'intuition', label: 'Intuition', icon: Smile },
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

  return (
    <>
      <header className="border-b border-linen-border bg-linen-surface/80 backdrop-blur-md sticky top-0 z-40">
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
              title="End-to-End Encrypted • Click to verify Safety Numbers"
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
                {vaultName || 'Two'}
                {relayStatus === 'connected'
                  ? partnerOnline
                    ? ' • together'
                    : ' • synced'
                  : ' • connecting'}
              </span>
              <span className="sm:hidden font-semibold text-[10px] text-linen-primary">
                {relayStatus === 'connected' ? (partnerOnline ? 'Together' : 'Synced') : 'Sync'}
              </span>
            </button>
          </div>

          {/* Action Menu Buttons: Tour, Heart, Spaces, Tools (All match the Tour button design!) */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5">
            {/* 1. Interactive Story Tour button */}
            {onOpenStoryTour && (
              <button
                onClick={onOpenStoryTour}
                className="inline-flex items-center text-xs font-medium text-linen-accent px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-linen-variant/80 hover:bg-linen-variant border border-linen-border transition-colors cursor-pointer shadow-2xs shrink-0"
                title="Interactive 5-Act Walkthrough: A Day in the Life with Two"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-linen-accent shrink-0" />
                <span>Tour</span>
              </button>
            )}

            {/* 2. Heart Sensory Touch & Options button */}
            <button
              onClick={() => setShowHeartModal(true)}
              className="inline-flex items-center text-xs font-medium text-rose-600 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-rose-50/80 hover:bg-rose-100/80 border border-rose-200/90 transition-colors cursor-pointer shadow-2xs shrink-0 group"
              title="Heart Touch: Send sensory pulse & loving presence"
            >
              <Heart className="w-3.5 h-3.5 mr-1 text-rose-500 fill-rose-500 shrink-0 group-hover:scale-110 transition-transform animate-pulse" />
              <span>Heart</span>
            </button>

            {/* 3. Sanctuary Spaces Explorer button */}
            {onOpenDirectory && (
              <button
                onClick={onOpenDirectory}
                className="inline-flex items-center text-xs font-medium text-linen-primary px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-linen-variant/80 hover:bg-linen-variant border border-linen-border transition-colors cursor-pointer shadow-2xs shrink-0"
                title="Sanctuary Explorer (Browse All 32 Spaces)"
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1 text-linen-accent shrink-0" />
                <span>Spaces</span>
              </button>
            )}

            {/* 4. Sanctuary Tools Menu button */}
            <button
              onClick={() => setShowToolsModal(true)}
              className="inline-flex items-center text-xs font-medium text-linen-primary px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-linen-variant/80 hover:bg-linen-variant border border-linen-border transition-colors cursor-pointer shadow-2xs shrink-0"
              title="Sanctuary Tools (Soundscapes, Breathing, Camouflage, Mesh & More)"
            >
              <Compass className="w-3.5 h-3.5 mr-1 text-linen-accent shrink-0" />
              <span>Tools</span>
            </button>

            {/* Emergency Exit button */}
            <button
              onClick={onEmergencyExit}
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
              className="flex items-center px-2.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap bg-linen-variant/90 hover:bg-linen-variant text-linen-primary border border-linen-border/80 transition-all shrink-0 cursor-pointer shadow-2xs"
              title="Open Sanctuary Explorer"
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1 text-linen-accent" />
              <span>All Spaces</span>
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
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all relative ${
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
        onOpenHeartModal={() => setShowHeartModal(true)}
        onToggleCamouflage={onToggleCamouflage}
        onOpenMesh={() => setShowMeshModal(true)}
        onOpenSafetyNumbers={() => setShowPairingModal(true)}
        onEmergencyExit={onEmergencyExit}
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
    </>
  );
};
