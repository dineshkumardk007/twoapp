import React from 'react';
import { NeedItem } from '../types';
import { Ear, Wrench, Heart, Hourglass, Smile, Sparkles, X } from 'lucide-react';

interface NeedMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNeed: (need: NeedItem) => void;
}

export const NEED_OPTIONS: NeedItem[] = [
  {
    id: 'listen',
    title: 'Listen without fixing',
    description: 'I just need to vent and feel heard. Please hold space without offering solutions right now.',
    icon: 'Ear'
  },
  {
    id: 'solve',
    title: 'Help me solve this',
    description: 'I’m feeling stuck or overwhelmed. I would genuinely appreciate your practical ideas and advice.',
    icon: 'Wrench'
  },
  {
    id: 'comfort',
    title: 'Physical comfort or hug',
    description: 'I’m feeling tender. I just want to be held quietly without needing to explain anything.',
    icon: 'Heart'
  },
  {
    id: 'space',
    title: 'Space for two hours',
    description: 'I need quiet alone time to decompress. I love you and will reconnect when I recharge.',
    icon: 'Hourglass'
  },
  {
    id: 'distract',
    title: 'Distract me with humor or fun',
    description: 'Take my mind off heavy thoughts with a funny story, silly video, or lighthearted banter.',
    icon: 'Smile'
  },
  {
    id: 'sit',
    title: 'Just sit quietly with me',
    description: 'You don’t need to say or do anything. Your quiet, grounded presence in the room is enough.',
    icon: 'Sparkles'
  }
];

export const NeedMenuModal: React.FC<NeedMenuModalProps> = ({ isOpen, onClose, onSelectNeed }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-linen-surface border border-linen-border rounded-3xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif text-xl font-medium text-linen-primary">Ask For What You Need</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-linen-secondary hover:bg-linen-variant">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-linen-secondary mb-6">
          Skip the guesswork and avoid misaligned support. Choose a concrete request to send to your partner:
        </p>

        <div className="space-y-3">
          {NEED_OPTIONS.map(item => (
            <button
              key={item.id}
              onClick={() => onSelectNeed(item)}
              className="w-full text-left p-4 rounded-2xl border border-linen-border bg-linen-variant/40 hover:bg-linen-variant hover:border-linen-accent/40 transition-all flex items-start space-x-3.5 group"
            >
              <div className="p-2 rounded-xl bg-linen-surface text-linen-accent group-hover:scale-105 transition-transform shadow-xs">
                {item.id === 'listen' && <Ear className="w-5 h-5" />}
                {item.id === 'solve' && <Wrench className="w-5 h-5" />}
                {item.id === 'comfort' && <Heart className="w-5 h-5" />}
                {item.id === 'space' && <Hourglass className="w-5 h-5" />}
                {item.id === 'distract' && <Smile className="w-5 h-5" />}
                {item.id === 'sit' && <Sparkles className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-medium text-sm text-linen-primary group-hover:text-linen-accent transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-linen-secondary mt-0.5 leading-relaxed">{item.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
