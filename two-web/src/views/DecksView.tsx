import React, { useState } from 'react';
import { CONVERSATION_DECKS, ConversationDeck, DeckCard } from '../data/decks';
import { Layers, ChevronLeft, ChevronRight, Shuffle, Send, Sparkles, Heart, Brain, Compass } from 'lucide-react';

interface DecksViewProps {
  onSendToChat?: (text: string) => void;
  onNavigate?: (tab: string) => void;
}

export const DecksView: React.FC<DecksViewProps> = ({ onSendToChat, onNavigate }) => {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(CONVERSATION_DECKS[0].id);
  const [cardIndex, setCardIndex] = useState<number>(0);
  const [answerDraft, setAnswerDraft] = useState<string>('');
  const [sentToast, setSentToast] = useState<boolean>(false);

  const currentDeck = CONVERSATION_DECKS.find(d => d.id === selectedDeckId) || CONVERSATION_DECKS[0];
  const currentCard: DeckCard = currentDeck.cards[cardIndex] || currentDeck.cards[0];

  const handleSelectDeck = (deckId: string) => {
    setSelectedDeckId(deckId);
    setCardIndex(0);
    setAnswerDraft('');
  };

  const handleNextCard = () => {
    setCardIndex((prev) => (prev + 1) % currentDeck.cards.length);
    setAnswerDraft('');
  };

  const handlePrevCard = () => {
    setCardIndex((prev) => (prev - 1 + currentDeck.cards.length) % currentDeck.cards.length);
    setAnswerDraft('');
  };

  const handleShuffle = () => {
    const randomIndex = Math.floor(Math.random() * currentDeck.cards.length);
    setCardIndex(randomIndex);
    setAnswerDraft('');
  };

  const handleSendPromptToChat = () => {
    if (onSendToChat) {
      const msg = `🎴 Deck Prompt [${currentDeck.title}]: "${currentCard.prompt}"`;
      onSendToChat(msg);
      setSentToast(true);
      setTimeout(() => setSentToast(false), 2500);
    }
  };

  const handleSendAnswerToChat = () => {
    if (!answerDraft.trim()) return;
    if (onSendToChat) {
      const msg = `🎴 [${currentDeck.title}] Prompt: "${currentCard.prompt}"\n\n💬 My response: ${answerDraft.trim()}`;
      onSendToChat(msg);
      setAnswerDraft('');
      setSentToast(true);
      setTimeout(() => setSentToast(false), 2500);
    }
  };

  const getDeckIcon = (iconName: string) => {
    switch (iconName) {
      case 'Brain': return <Brain className="w-5 h-5" />;
      case 'Heart': return <Heart className="w-5 h-5" />;
      case 'Compass': return <Compass className="w-5 h-5" />;
      case 'Sparkles': return <Sparkles className="w-5 h-5" />;
      default: return <Layers className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-linen-border pb-4">
        <div className="flex items-center space-x-2 text-linen-accent mb-1">
          <Layers className="w-5 h-5" />
          <span className="text-xs font-semibold tracking-wider uppercase">Conversation Card Decks</span>
        </div>
        <h2 className="font-serif text-2xl font-medium text-linen-primary">Curated Connection Decks</h2>
        <p className="text-sm text-linen-secondary mt-1">
          Designed for quiet evenings, long walks, or car rides. No scoring, no winners—only space to be known.
        </p>
      </div>

      {/* Deck Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {CONVERSATION_DECKS.map((deck) => {
          const isSelected = deck.id === selectedDeckId;
          return (
            <button
              key={deck.id}
              onClick={() => handleSelectDeck(deck.id)}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-linen-accent bg-linen-variant shadow-sm'
                  : 'border-linen-border bg-linen-surface hover:bg-linen-variant/40'
              }`}
            >
              <div className={`p-2 rounded-xl w-fit mb-2 ${isSelected ? 'bg-linen-surface text-linen-accent' : 'bg-linen-variant text-linen-secondary'}`}>
                {getDeckIcon(deck.icon)}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-linen-primary line-clamp-1">{deck.title}</h4>
                <span className="text-[11px] text-linen-secondary">{deck.cards.length} cards</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Card Viewer */}
      <div className="relative rounded-3xl border border-linen-border bg-gradient-to-b from-linen-surface to-linen-variant/30 p-6 sm:p-10 shadow-sm flex flex-col items-center justify-between min-h-[340px] text-center">
        {/* Card Header Info */}
        <div className="w-full flex items-center justify-between text-xs text-linen-secondary border-b border-linen-border/50 pb-3 mb-6">
          <span className="font-medium tracking-wide text-linen-accent uppercase">{currentDeck.title}</span>
          <span className="font-mono text-linen-secondary">
            Card {cardIndex + 1} of {currentDeck.cards.length}
          </span>
        </div>

        {/* Card Body Prompt */}
        <div className="my-auto max-w-xl px-2">
          <p className="font-serif text-xl sm:text-2xl text-linen-primary leading-relaxed font-normal">
            “{currentCard.prompt}”
          </p>
          {currentCard.subtext && (
            <p className="text-xs text-linen-secondary mt-3 italic">
              {currentCard.subtext}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="w-full flex items-center justify-between mt-8 pt-4 border-t border-linen-border/50">
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevCard}
              className="p-2.5 rounded-xl border border-linen-border bg-linen-surface hover:bg-linen-variant text-linen-primary transition-colors"
              title="Previous card"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleShuffle}
              className="p-2.5 rounded-xl border border-linen-border bg-linen-surface hover:bg-linen-variant text-linen-primary transition-colors"
              title="Random card"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextCard}
              className="p-2.5 rounded-xl border border-linen-border bg-linen-surface hover:bg-linen-variant text-linen-primary transition-colors"
              title="Next card"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleSendPromptToChat}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Prompt to Chat</span>
          </button>
        </div>
      </div>

      {/* In-Line Reflection / Answer Box */}
      <div className="rounded-2xl border border-linen-border bg-linen-surface p-4">
        <label className="block text-xs font-medium text-linen-secondary mb-2">
          Want to share an answer or reflection for this card?
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            rows={2}
            value={answerDraft}
            onChange={(e) => setAnswerDraft(e.target.value)}
            placeholder="Type your reflection or answer here..."
            className="flex-1 rounded-xl border border-linen-border bg-linen-variant/30 p-2.5 text-xs text-linen-primary focus:outline-none focus:ring-1 focus:ring-linen-accent resize-none"
          />
          <button
            onClick={handleSendAnswerToChat}
            disabled={!answerDraft.trim()}
            className="self-end sm:self-auto px-4 py-2.5 rounded-xl bg-linen-accent text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post Answer</span>
          </button>
        </div>
        {sentToast && (
          <p className="text-[11px] text-emerald-600 mt-2 flex items-center">
            ✓ Sent to your encrypted space chat!
          </p>
        )}
      </div>
    </div>
  );
};
