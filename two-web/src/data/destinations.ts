// The single list of everywhere you can go in Two.
//
// Shared deliberately: the website's directory and the app's dock both render
// from this, so adding a screen updates both and neither can quietly fall
// behind the other.

import { 
  X, Heart, MessageSquare, Feather, Bed, Sprout, Mic, Map, Radio, Shield, Palette, 
  Handshake, Sparkles, Flame, Star, Compass, Mail, Gift, Hourglass, Coffee, BookMarked, 
  MapPin, Utensils, Smile, Moon, BookOpen, CheckSquare, Layers, DollarSign, Image, Settings, 
  Wind, Search, Users 
} from 'lucide-react';

export interface Destination {
  id: string;
  name: string;
  desc: string;
  icon: any;
  badge?: string;
}

export interface DestinationGroup {
  title: string;
  emoji: string;
  items: Destination[];
}

export function getDestinations(unreadChatCount = 0): DestinationGroup[] {
  return [
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
    },
    {
      title: 'Your Space',
      emoji: '⚙️',
      items: [
        { id: 'groups', name: 'Groups', desc: 'Chat rooms for more than two, kept apart from your sanctuary', icon: Users },
        { id: 'settings', name: 'Settings', desc: 'Devices, link code, backups & how this space is locked', icon: Settings }
      ]
    }
  ];
}

/** Flat list, for the dock and for search. */
export function allDestinations(unreadChatCount = 0): Destination[] {
  return getDestinations(unreadChatCount).flatMap(g => g.items);
}
