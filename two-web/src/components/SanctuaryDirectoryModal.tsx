import React, { useState } from 'react';
import { 
  X, Heart, MessageSquare, Feather, Bed, Sprout, Mic, Map, Radio, Shield, Palette, 
  Handshake, Sparkles, Flame, Star, Compass, Mail, Gift, Hourglass, Coffee, BookMarked, 
  MapPin, Utensils, Smile, Moon, BookOpen, CheckSquare, Layers, DollarSign, Image, Settings, 
  Wind, Search 
} from 'lucide-react';

interface SanctuaryDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  unreadChatCount?: number;
}

interface CategoryItem {
  id: string;
  name: string;
  desc: string;
  icon: any;
  badge?: string;
}

export const SanctuaryDirectoryModal: React.FC<SanctuaryDirectoryModalProps> = ({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  unreadChatCount = 0
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const categories: { title: string; emoji: string; items: CategoryItem[] }[] = [
    {
      title: 'Intimacy & Heart Connection',
      emoji: '💖',
      items: [
        { id: 'chat', name: 'Private Chat', desc: 'Secure two-person messaging with gentle prompts', icon: MessageSquare, badge: unreadChatCount > 0 ? `${unreadChatCount} new` : undefined },
        { id: 'softlanding', name: 'Soft Landing', desc: 'Decompress after a long day before speaking', icon: Feather },
        { id: 'letters', name: 'Love Letters', desc: 'Sealed written letters with timed unlocks', icon: Mail },
        { id: 'whispers', name: 'Whisper Memos', desc: 'Audio & text whispers left for each other', icon: Mic },
        { id: 'repairbridge', name: 'Repair Bridge', desc: 'Walk through de-escalation step by step', icon: Handshake },
        { id: 'kintsugi', name: 'Kintsugi Scars', desc: 'Cherishing what we repaired together', icon: Sparkles }
      ]
    },
    {
      title: 'Our Parallel Sanctuary',
      emoji: '🌿',
      items: [
        { id: 'home', name: 'Sanctuary Home', desc: 'Emotional weather, daily check-ins & milestones', icon: Heart },
        { id: 'presence', name: 'Quiet Co-Presence', desc: 'Study & rest beside each other with synchronized timer', icon: Coffee },
        { id: 'nightstand', name: 'Nightstand Clock', desc: 'Bedside analogue clock, sleep sounds & midnight kisses', icon: Bed },
        { id: 'garden', name: 'Hearth Garden', desc: 'Living digital flowers that grow as you care', icon: Sprout },
        { id: 'constellation', name: 'Constellation Stars', desc: 'Gratitude starlight map across your universe', icon: Star },
        { id: 'compass', name: 'Care Compass', desc: 'Decompression & love language cheat sheets', icon: Compass }
      ]
    },
    {
      title: 'Memories, Creativity & Play',
      emoji: '🎨',
      items: [
        { id: 'canvas', name: 'Canvas of Us', desc: 'Live shared drawing & doodle canvas', icon: Palette },
        { id: 'scrapbook', name: 'Memoir Book', desc: 'Your private photo scrapbooks & album pages', icon: BookMarked },
        { id: 'capsules', name: 'Time Capsule', desc: 'Bury letters and photos to open on future anniversaries', icon: Hourglass },
        { id: 'scratch', name: 'Scratch Cards', desc: 'Interactive scratch-off love coupons & secrets', icon: Gift },
        { id: 'coordinates', name: 'Coordinates Map', desc: 'Pinned physical places that hold special meaning', icon: Map },
        { id: 'radio', name: 'Midnight Radio', desc: 'Shared radio station & voice whispers', icon: Radio },
        { id: 'decks', name: 'Conversation Decks', desc: 'Curated card decks for deep midnight talks', icon: Sparkles },
        { id: 'intuition', name: 'Intuition Game', desc: 'Guess what your partner would choose in dilemmas', icon: Smile },
        { id: 'timeline', name: 'Timeline & Quotes', desc: 'Our favorite resurfaced love quotes & memory moments', icon: Image }
      ]
    },
    {
      title: 'Daily Shared Life',
      emoji: '📋',
      items: [
        { id: 'rituals', name: 'Daily Rituals', desc: 'Shared micro-habits & daily grounding moments', icon: Flame },
        { id: 'lists', name: 'Shared Lists', desc: 'Groceries, trip wishlists & secret gift items', icon: CheckSquare },
        { id: 'chores', name: 'Chore Split', desc: 'Invisible labor balance & appreciative chore splits', icon: Layers },
        { id: 'money', name: 'Money Light', desc: 'Gentle expense sharing with zero awkwardness', icon: DollarSign },
        { id: 'recipes', name: 'Secret Recipes', desc: 'Our favorite dishes, ingredients & cook notes', icon: Utensils },
        { id: 'journal', name: 'Shared Journal', desc: 'Shared reflections & joint writing prompts', icon: BookOpen },
        { id: 'cycle', name: 'Cycle Compass', desc: 'Private hormonal cycle tracking & support compass', icon: Moon },
        { id: 'repair', name: 'Relationship Agreements', desc: 'Gentle boundaries & relationship compass rules', icon: Shield },
        { id: 'stateofunion', name: 'State of Union', desc: 'Weekly or monthly heart-to-heart alignment session', icon: Shield }
      ]
    }
  ];

  const filteredCategories = categories.map(cat => ({
    ...cat,
    items: cat.items.filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase()) || 
      item.desc.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0);

  const handleSelect = (id: string) => {
    onSelectTab(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-linen-surface border border-linen-border rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-linen-border/60 flex items-center justify-between bg-linen-variant/30">
          <div>
            <h3 className="font-serif text-xl font-medium text-linen-primary flex items-center">
              <span>Sanctuary Explorer</span>
              <span className="ml-2 text-xs font-sans px-2 py-0.5 rounded-full bg-linen-primary/10 text-linen-accent font-medium">
                32 Spaces
              </span>
            </h3>
            <p className="text-xs text-linen-secondary mt-0.5">
              Jump directly to any private corner in your sanctuary
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-linen-secondary hover:text-linen-primary hover:bg-linen-variant transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Filter */}
        <div className="px-5 py-3 border-b border-linen-border/40 bg-linen-surface">
          <div className="relative">
            <Search className="w-4 h-4 text-linen-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tools (e.g. Chat, Recipes, Timer, Lists)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-linen-border bg-linen-variant/40 focus:outline-hidden focus:ring-1 focus:ring-linen-primary text-linen-primary"
            />
          </div>
        </div>

        {/* Scrollable Spaces Directory */}
        <div className="p-5 overflow-y-auto space-y-6">
          {filteredCategories.map(cat => (
            <div key={cat.title} className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-linen-accent">
                <span>{cat.emoji}</span>
                <span>{cat.title}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {cat.items.map(item => {
                  const Icon = item.icon;
                  const isCurrent = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-start space-x-3 cursor-pointer ${
                        isCurrent
                          ? 'border-linen-primary bg-linen-variant/70 ring-1 ring-linen-primary/20 shadow-xs'
                          : 'border-linen-border/70 hover:bg-linen-variant/40 hover:border-linen-border'
                      }`}
                    >
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        isCurrent ? 'bg-linen-primary text-linen-surface' : 'bg-linen-variant text-linen-accent border border-linen-border/50'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold truncate ${
                            isCurrent ? 'text-linen-primary font-bold' : 'text-linen-primary'
                          }`}>
                            {item.name}
                          </span>
                          {item.badge && (
                            <span className="ml-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white animate-pulse">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-linen-secondary line-clamp-1 mt-0.5 leading-tight">
                          {item.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="text-center py-8 text-xs text-linen-secondary">
              No spaces found matching “{search}”
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-linen-border/60 bg-linen-variant/30 flex items-center justify-between text-xs text-linen-secondary px-5">
          <span>End-to-End Encrypted Sanctuary</span>
          <button
            onClick={() => handleSelect('settings')}
            className="hover:text-linen-primary flex items-center space-x-1 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 mr-1" />
            <span>Settings</span>
          </button>
        </div>

      </div>
    </div>
  );
};
