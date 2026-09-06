import React, { useState } from 'react';
import { PairingModal } from './PairingModal';
import { LocalMeshModal } from './LocalMeshModal';
import { AmbientSoundscapeModal } from './AmbientSoundscapeModal';
import { CoRegulationModal } from './CoRegulationModal';
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
  unreadChatCount?: number;
  onOpenDirectory?: () => void;
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
  unreadChatCount = 0,
  onOpenDirectory
}) => {
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showMeshModal, setShowMeshModal] = useState(false);
  const [showSoundscapeModal, setShowSoundscapeModal] = useState(false);
  const [showCoRegulationModal, setShowCoRegulationModal] = useState(false);
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
    <header className="border-b border-linen-border bg-linen-surface/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Privacy Status */}
          <div className="flex items-center space-x-3">
            <span className="font-serif text-2xl font-medium tracking-tight text-linen-primary cursor-pointer" onClick={() => onSelectTab('home')}>
              {t.appName}
            </span>
            <button
              onClick={() => setShowPairingModal(true)}
              className="inline-flex items-center text-xs font-medium text-linen-secondary px-2 sm:px-2.5 py-0.5 rounded-full bg-linen-variant hover:bg-linen-border border border-linen-border transition-colors cursor-pointer"
              title="Click to view QR Code or verify Safety Numbers"
            >
              <Shield className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">{t.encryptedNotice}</span>
              <span className="sm:hidden text-[10px] font-semibold">E2EE</span>
            </button>

            {/* Interactive Story Tour button */}
            {onOpenStoryTour && (
              <button
                onClick={onOpenStoryTour}
                className="inline-flex items-center text-xs font-medium text-linen-accent px-2.5 py-1 rounded-lg bg-linen-variant/60 hover:bg-linen-variant border border-linen-border transition-colors cursor-pointer"
                title="Interactive 5-Act Walkthrough: A Day in the Life with Two"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                <span className="hidden md:inline">Tour</span>
              </button>
            )}
          </div>

          {/* Controls: Sensory Pulse, Mesh, Camouflage, Perspective Switcher, Emergency Wipe */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Sensory Pulse Quick Trigger */}
            {onTriggerPulse && (
              <button
                onClick={onTriggerPulse}
                className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                title={t.actions.sensoryPulse}
              >
                <Heart className="w-4 h-4 fill-rose-500" />
              </button>
            )}

            {/* Synced Ambient Soundscape & Sleep Timer */}
            <button
              onClick={() => setShowSoundscapeModal(true)}
              className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
              title="Ambient Night Soundscapes: Fall Asleep Together"
            >
              <Moon className="w-4 h-4" />
            </button>

            {/* Synchronized Co-Regulation Sanctuary */}
            <button
              onClick={() => setShowCoRegulationModal(true)}
              className="p-1.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors border border-transparent hover:border-teal-200"
              title="Co-Regulation Sanctuary: Synchronized 4-7-8 Breathing"
            >
              <Wind className="w-4 h-4" />
            </button>

            {/* Off-Grid Mesh Sync Status */}
            <button
              onClick={() => setShowMeshModal(true)}
              className="p-1.5 text-linen-secondary hover:text-linen-primary hover:bg-linen-variant rounded-lg transition-colors border border-transparent hover:border-linen-border"
              title={t.actions.meshSync}
            >
              <Radio className="w-4 h-4" />
            </button>

            {/* Camouflage Decoy Button */}
            {onToggleCamouflage && (
              <button
                onClick={onToggleCamouflage}
                className="p-1.5 text-linen-secondary hover:text-linen-primary hover:bg-linen-variant rounded-lg transition-colors border border-transparent hover:border-linen-border"
                title={t.actions.camouflage}
              >
                <Calculator className="w-4 h-4" />
              </button>
            )}

            {/* Sanctuary Directory / All Spaces Drawer Button */}
            {onOpenDirectory && (
              <button
                onClick={onOpenDirectory}
                className="inline-flex items-center space-x-1 p-1.5 sm:px-2.5 sm:py-1.5 text-linen-secondary hover:text-linen-primary hover:bg-linen-variant rounded-lg transition-colors border border-transparent hover:border-linen-border cursor-pointer"
                title="Sanctuary Explorer (All 32 Spaces)"
              >
                <LayoutGrid className="w-4 h-4 text-linen-accent" />
                <span className="hidden md:inline text-xs font-medium">Spaces</span>
              </button>
            )}

            {/* Real-Time E2EE Relay Status Badge */}
            <div
              className="inline-flex items-center text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-lg bg-linen-variant text-linen-primary border border-linen-border select-none"
              title={relayStatus === 'connected' ? 'Connected securely to E2EE Relay' : 'Connecting to Relay...'}
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
              <span className="hidden sm:inline">
                {relayStatus === 'connected' ? 'Two • Connected' : 'Connecting...'}
              </span>
              <span className="sm:hidden">
                {relayStatus === 'connected' ? 'Live' : 'Syncing'}
              </span>
            </div>

            {/* Emergency Exit */}
            <button
              onClick={onEmergencyExit}
              className="p-1.5 text-linen-secondary hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
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
    </header>
  );
};
