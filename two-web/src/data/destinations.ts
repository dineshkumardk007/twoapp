// The single list of everywhere you can go in Two.
//
// Shared deliberately: the website's directory and the app's dock both render
// from this, so adding a screen updates both and neither can quietly fall
// behind the other.

import { 
  X, Heart, MessageSquare, Feather, Bed, Sprout, Mic, Map, Radio, Shield, Palette, 
  Handshake, Sparkles, Flame, Star, Compass, Mail, Gift, Hourglass, Coffee, BookMarked, 
  MapPin, Utensils, Smile, Moon, BookOpen, CheckSquare, Layers, IndianRupee, Image, Settings, 
  Wind, Search, Users, CalendarHeart 
} from 'lucide-react';

/**
 * The five families every destination belongs to, each with its own colour -
 * so the app is colourful without being a jumble: everything about the two of
 * you glows pink, the quiet places teal, memories and play gold, everyday life
 * sky blue, and your own settings violet.
 */
export type Family = 'love' | 'calm' | 'play' | 'everyday' | 'space';

/** Class names per family. Whole strings, so the stylesheet keeps them. */
export const FAMILY_STYLE: Record<Family, { text: string; tile: string; dot: string; ring: string }> = {
  love: { text: 'text-aurora-pink', tile: 'bg-aurora-pink/15', dot: 'bg-aurora-pink', ring: 'ring-aurora-pink/30' },
  calm: { text: 'text-aurora-teal', tile: 'bg-aurora-teal/15', dot: 'bg-aurora-teal', ring: 'ring-aurora-teal/30' },
  play: { text: 'text-aurora-gold', tile: 'bg-aurora-gold/15', dot: 'bg-aurora-gold', ring: 'ring-aurora-gold/30' },
  everyday: { text: 'text-aurora-sky', tile: 'bg-aurora-sky/15', dot: 'bg-aurora-sky', ring: 'ring-aurora-sky/30' },
  space: { text: 'text-aurora-violet', tile: 'bg-aurora-violet/15', dot: 'bg-aurora-violet', ring: 'ring-aurora-violet/30' }
};

export interface Destination {
  id: string;
  name: string;
  desc: string;
  icon: any;
  badge?: string;
  /** Filled in from its group. */
  family?: Family;
}

export interface DestinationGroup {
  title: string;
  emoji: string;
  family: Family;
  items: Destination[];
}

export function getDestinations(unreadChatCount = 0): DestinationGroup[] {
  return withFamilies([
    {
      title: 'Love & Closeness',
      emoji: '💖',
      family: 'love',
      items: [
        { id: 'chat', name: 'Private Chat', desc: 'Messages, voice notes and calls, just for you two', icon: MessageSquare, badge: unreadChatCount > 0 ? `${unreadChatCount} new` : undefined },
        { id: 'softlanding', name: 'Soft Landing', desc: 'Unwind after a hard day before you talk', icon: Feather },
        { id: 'letters', name: 'Love Letters', desc: 'Sealed letters that open when the time is right', icon: Mail },
        { id: 'whispers', name: 'Whisper Memos', desc: 'Little voice notes to find in the morning or at night', icon: Mic },
        { id: 'repairbridge', name: 'Repair Bridge', desc: 'Say sorry in the way your partner hears it best', icon: Handshake },
        { id: 'kintsugi', name: 'Kintsugi Moments', desc: 'The hard times you came through, mended in gold', icon: Sparkles }
      ]
    },
    {
      title: 'Calm & Care',
      emoji: '🌿',
      family: 'calm',
      items: [
        { id: 'home', name: 'Home', desc: 'Your days together, how you both feel, today\'s question', icon: Heart },
        { id: 'presence', name: 'Quiet Together', desc: 'Read, work or rest side by side, even when apart', icon: Coffee },
        { id: 'nightstand', name: 'Nightstand Clock', desc: 'A bedside clock, sleep sounds and goodnight kisses', icon: Bed },
        { id: 'garden', name: 'Hearth Garden', desc: 'A little tree that grows as you care for each other', icon: Sprout },
        { id: 'constellation', name: 'Gratitude Stars', desc: 'Every thank-you becomes a star in your sky', icon: Star },
        { id: 'compass', name: 'Care Compass', desc: 'How each of you likes to be loved', icon: Compass }
      ]
    },
    {
      title: 'Memories & Play',
      emoji: '🎨',
      family: 'play',
      items: [
        { id: 'canvas', name: 'Canvas of Us', desc: 'Draw and doodle together, live', icon: Palette },
        { id: 'scrapbook', name: 'Memoir Book', desc: 'Your story as a book you can print', icon: BookMarked },
        { id: 'capsules', name: 'Time Capsule', desc: 'Notes and photos that open on a future date', icon: Hourglass },
        { id: 'scratch', name: 'Scratch Cards', desc: 'Love coupons to scratch open', icon: Gift },
        { id: 'coordinates', name: 'Our Map', desc: 'The places that hold your story', icon: Map },
        // Only ever reachable from a tile on Home, which is going; without a
        // line here it would have no way in at all.
        { id: 'adventures', name: 'Adventures', desc: 'Trips and plans you dream of, and the ones you lived', icon: MapPin },
        { id: 'radio', name: 'Midnight Radio', desc: 'Listen to the same station at the same time', icon: Radio },
        { id: 'decks', name: 'Conversation Decks', desc: 'Question cards for long talks', icon: Sparkles },
        { id: 'intuition', name: 'Guess My Mind', desc: 'Guess what your partner would choose', icon: Smile },
        { id: 'timeline', name: 'Timeline & Quotes', desc: 'Moments you want to keep, and words for hard days', icon: Image }
      ]
    },
    {
      title: 'Everyday Life',
      emoji: '📋',
      family: 'everyday',
      items: [
        { id: 'rituals', name: 'Daily Rituals', desc: 'Small habits you keep together, every day', icon: Flame },
        { id: 'lists', name: 'Shared Lists', desc: 'Groceries, plans, and gift ideas kept secret', icon: CheckSquare },
        { id: 'chores', name: 'Chore Split', desc: 'Who plans and who does, made visible', icon: Layers },
        { id: 'money', name: 'Shared Money', desc: 'Split costs and settle up, without awkwardness', icon: IndianRupee },
        { id: 'recipes', name: 'Secret Recipes', desc: 'Your dishes, with the story behind each', icon: Utensils },
        { id: 'journal', name: 'Shared Journal', desc: 'Thoughts to share, or keep to yourself', icon: BookOpen },
        { id: 'cycle', name: 'Cycle Compass', desc: 'Track your cycle and choose what to share', icon: Moon },
        { id: 'repair', name: 'Conflict Repair Kit', desc: 'Cool down, talk it through, keep what you agree', icon: Shield },
        { id: 'stateofunion', name: 'State of Our Union', desc: 'A weekly heart-to-heart, one section at a time', icon: CalendarHeart }
      ]
    },
    {
      title: 'Your Space',
      emoji: '⚙️',
      family: 'space',
      items: [
        { id: 'groups', name: 'Groups', desc: 'Chats with friends and family, kept apart from yours', icon: Users },
        { id: 'settings', name: 'Settings', desc: 'Devices, link code, backups and the app lock', icon: Settings }
      ]
    }
  ]);
}

/** Every destination carries its group's family. */
function withFamilies(groups: DestinationGroup[]): DestinationGroup[] {
  return groups.map(g => ({ ...g, items: g.items.map(item => ({ ...item, family: g.family })) }));
}

/** A destination's family, by its id. */
export function familyOf(tabId: string): Family {
  return allDestinations().find(d => d.id === tabId)?.family || 'space';
}

/** Flat list, for the dock and for search. */
export function allDestinations(unreadChatCount = 0): Destination[] {
  return getDestinations(unreadChatCount).flatMap(g => g.items);
}

/**
 * What a destination is called, by its id.
 *
 * Here rather than in the caller so there is one list of names in the app: the
 * dock, the directory sheet and the activity card all say "Kintsugi Moments"
 * because all three ask this.
 */
export function destinationName(tabId: string): string {
  return allDestinations().find(d => d.id === tabId)?.name || tabId;
}
