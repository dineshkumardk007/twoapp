import React, { useState } from 'react';
import { PairingModal } from './PairingModal';
import { Shield, Users, LogOut, Heart, MessageSquare, BookOpen, Handshake, CheckSquare, Layers, DollarSign, Image, Settings, Sparkles, Moon, Calculator } from 'lucide-react';
import { Locale, getTranslation } from '../core/i18n';

interface NavigationProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeUser: 'user' | 'partner';
  onToggleActiveUser: () => void;
  onEmergencyExit: () => void;
  onToggleCamouflage?: () => void;
  onOpenStoryTour?: () => void;
  locale?: Locale;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  activeUser,
  onToggleActiveUser,
  onEmergencyExit,
  onToggleCamouflage,
  onOpenStoryTour,
  locale = 'en'
}) => {
  const [showPairingModal, setShowPairingModal] = useState(false);
  const t = getTranslation(locale);

  const tabs = [
    { id: 'home', label: t.tabs.home, icon: Heart },
    { id: 'chat', label: t.tabs.chat, icon: MessageSquare },
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
              className="hidden sm:inline-flex items-center text-xs font-medium text-linen-secondary px-2.5 py-0.5 rounded-full bg-linen-variant hover:bg-linen-border border border-linen-border transition-colors cursor-pointer"
              title="Click to view QR Code or verify Safety Numbers"
            >
              <Shield className="w-3 h-3 mr-1 text-emerald-600" />
              <span>{t.encryptedNotice}</span>
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

          {/* Controls: Camouflage, Perspective Switcher, Emergency Wipe */}
          <div className="flex items-center space-x-2 sm:space-x-3">
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

            {/* Testing Perspective Switcher */}
            <button
              onClick={onToggleActiveUser}
              className="inline-flex items-center text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-lg bg-linen-variant hover:bg-linen-border transition-colors text-linen-primary border border-linen-border"
              title="Switch user perspective to test how your partner sees the app"
            >
              <Users className="w-3.5 h-3.5 mr-1.5 text-linen-accent" />
              <span className="hidden sm:inline">{t.perspective}:</span>
              <strong className="ml-1 text-linen-primary">
                {activeUser === 'user' ? t.you : t.partner}
              </strong>
            </button>

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
        <div className="flex space-x-1 sm:space-x-4 overflow-x-auto pb-2 scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-linen-primary text-linen-surface shadow-sm'
                    : 'text-linen-secondary hover:text-linen-primary hover:bg-linen-variant'
                }`}
              >
                <Icon className="w-4 h-4 mr-1.5" />
                {tab.label}
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
    </header>
  );
};
