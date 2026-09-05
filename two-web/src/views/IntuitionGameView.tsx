import React, { useState } from 'react';
import { 
  Sparkles, Heart, HelpCircle, CheckCircle2, RotateCcw, Send, 
  Smile, Flame, Award, ArrowRight, Shield, Shuffle 
} from 'lucide-react';
import { IntuitionDilemma, IntuitionGameRound } from '../types';

interface IntuitionGameViewProps {
  currentRound: IntuitionGameRound;
  onUpdateRound: (round: IntuitionGameRound) => void;
  onNewDilemma: () => void;
  onSendToChat: (message: string) => void;
  activeUser: 'user' | 'partner';
}

export const CURATED_DILEMMAS: IntuitionDilemma[] = [
  {
    id: 'dil-1',
    prompt: 'If we could drop everything and disappear together this Friday evening, what would we do?',
    optionA: 'Cabin in misty woods with a crackling fire and warm cider',
    optionB: 'Secret oceanside cottage listening to waves crash all night',
    optionC: 'Boutique hotel in a walkable city with late-night jazz & pasta',
    category: 'cozy'
  },
  {
    id: 'dil-2',
    prompt: 'What nostalgic comfort food would instantly turn an exhausting day around for me?',
    optionA: 'Warm sourdough toast with salted butter & honey',
    optionB: 'A huge bowl of piping-hot garlic ramen with jammy eggs',
    optionC: 'Fresh warm chocolate chip cookies straight out of the oven',
    category: 'cozy'
  },
  {
    id: 'dil-3',
    prompt: 'If we were granted one magical superpower for our home, which would you pick?',
    optionA: 'Self-cleaning kitchen counters & dishes in 1 second',
    optionB: 'A secret doorway that opens directly to any quiet beach',
    optionC: 'An enchanted bed where 5 hours of sleep feels like 10 hours of deep rest',
    category: 'dream'
  },
  {
    id: 'dil-4',
    prompt: 'Which spontaneous date night spark would make you smile most this week?',
    optionA: 'Living room blanket fort with fairy lights and our favorite animated movie',
    optionB: 'Midnight stargazing drive into the hills with hot thermoses',
    optionC: 'A $15 supermarket challenge where we each pick 3 wild ingredients to cook',
    category: 'spontaneous'
  },
  {
    id: 'dil-5',
    prompt: 'If we could wake up tomorrow with an eccentric shared hobby, what would it be?',
    optionA: 'Wheel-thrown pottery and making our own morning ceramic mugs',
    optionB: 'Midnight stargazing with a high-powered telescope and field notebook',
    optionC: 'Baking artisanal sourdough and trading loaves with neighbors',
    category: 'quirky'
  },
  {
    id: 'dil-6',
    prompt: 'What is our ultimate rainy Sunday energy?',
    optionA: 'Never leaving bed until 2 PM with coffee and reading books aloud',
    optionB: 'Simmering a 4-hour pot of stew while classic vinyl records play',
    optionC: 'Putting on rain boots, splashing through puddles, and getting warm pastries',
    category: 'cozy'
  }
];

export const IntuitionGameView: React.FC<IntuitionGameViewProps> = ({
  currentRound,
  onUpdateRound,
  onNewDilemma,
  onSendToChat,
  activeUser
}) => {
  const isAuthor = currentRound.authorId === activeUser;
  const dilemma = currentRound.dilemma;

  // Sound effects for reveal
  const playCelebrationChord = (isMatch: boolean) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      const notes = isMatch ? [523.25, 659.25, 783.99, 1046.50] : [440, 554.37, 659.25];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.1, now + idx * 0.08 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 1.0);
      });
    } catch (e) {}
  };

  const handlePickChoice = (choice: 'A' | 'B' | 'C') => {
    const updated: IntuitionGameRound = {
      ...currentRound,
      authorChoice: choice,
      authorId: activeUser
    };
    onUpdateRound(updated);
  };

  const handleGuessChoice = (guess: 'A' | 'B' | 'C') => {
    const isMatch = currentRound.authorChoice === guess;
    const updated: IntuitionGameRound = {
      ...currentRound,
      partnerGuess: guess,
      revealed: true
    };
    playCelebrationChord(isMatch);
    onUpdateRound(updated);
  };

  const handleShuffleNewRound = () => {
    const nextDilemma = CURATED_DILEMMAS[Math.floor(Math.random() * CURATED_DILEMMAS.length)];
    const newRound: IntuitionGameRound = {
      id: `round-${Date.now()}`,
      date: 'Today',
      dilemma: nextDilemma,
      authorId: activeUser,
      authorChoice: undefined,
      partnerGuess: undefined,
      revealed: false
    };
    onUpdateRound(newRound);
  };

  const isMatch = currentRound.revealed && currentRound.authorChoice === currentRound.partnerGuess;

  const getOptionText = (key?: 'A' | 'B' | 'C') => {
    if (key === 'A') return dilemma.optionA;
    if (key === 'B') return dilemma.optionB;
    if (key === 'C') return dilemma.optionC;
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-medium tracking-tight text-linen-primary flex items-center space-x-2">
              <span>Guess My Mind</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-sans font-normal">
                Intuition Mini-Game
              </span>
            </h2>
            <p className="text-xs text-linen-secondary mt-0.5">
              Lock in your secret preference • Test how intuitively you know each other's hearts.
            </p>
          </div>
        </div>

        <button
          onClick={handleShuffleNewRound}
          className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-linen-variant hover:bg-linen-border text-linen-primary text-xs font-medium border border-linen-border transition-colors cursor-pointer"
        >
          <Shuffle className="w-4 h-4 text-linen-accent" />
          <span>New Dilemma</span>
        </button>
      </div>

      {/* Dilemma Arena Card */}
      <div className="bg-linen-surface border border-linen-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Category & Status Banner */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-linen-accent">
            Daily Dilemma • {dilemma.category}
          </span>
          <div className="text-xs text-linen-secondary">
            {currentRound.revealed
              ? 'Results Revealed'
              : currentRound.authorChoice
              ? 'Secret Pick Locked • Ready to Guess'
              : 'Waiting for Secret Pick'}
          </div>
        </div>

        {/* Prompt Question */}
        <h3 className="font-serif text-xl sm:text-2xl text-linen-primary leading-relaxed font-normal">
          “{dilemma.prompt}”
        </h3>

        {/* Results Banner if Revealed */}
        {currentRound.revealed && (
          <div
            className={`p-5 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in ${
              isMatch
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                  isMatch ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isMatch ? '🎉' : '✨'}
              </div>
              <div>
                <h4 className="font-serif text-base font-semibold">
                  {isMatch ? 'Perfect Resonance! You Guessed It!' : 'A Tender Difference!'}
                </h4>
                <p className="text-xs mt-0.5 opacity-85">
                  {isMatch
                    ? 'Your intuitive connection is in beautiful sync.'
                    : 'A delightful new perspective to explore over tea tonight.'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() =>
                  onSendToChat(
                    `We played Guess My Mind! ${
                      isMatch ? 'We both picked: ' : 'I guessed your pick! Let’s talk about: '
                    } "${getOptionText(currentRound.authorChoice)}"`
                  )
                }
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Share in Chat</span>
              </button>
            </div>
          </div>
        )}

        {/* Options List */}
        <div className="space-y-3">
          {(['A', 'B', 'C'] as const).map(key => {
            const text = dilemma[`option${key}` as keyof IntuitionDilemma];
            const isPickedByAuthor = currentRound.authorChoice === key;
            const isGuessedByPartner = currentRound.partnerGuess === key;

            return (
              <div
                key={key}
                className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${
                  currentRound.revealed
                    ? isPickedByAuthor && isGuessedByPartner
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/40 shadow-xs'
                      : isPickedByAuthor
                      ? 'bg-indigo-50/70 border-indigo-300'
                      : isGuessedByPartner
                      ? 'bg-amber-50/70 border-amber-300'
                      : 'bg-linen-surface border-linen-border opacity-70'
                    : 'bg-linen-surface border-linen-border hover:bg-linen-variant/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <span className="w-6 h-6 rounded-lg bg-linen-variant border border-linen-border font-mono text-xs font-bold flex items-center justify-center text-linen-accent shrink-0 mt-0.5">
                      {key}
                    </span>
                    <p className="text-sm font-medium text-linen-primary leading-relaxed">
                      {text}
                    </p>
                  </div>

                  {/* Actions depending on stage */}
                  {!currentRound.revealed && (
                    <div className="flex items-center space-x-2 shrink-0">
                      {/* If secret pick not yet chosen */}
                      {!currentRound.authorChoice && (
                        <button
                          onClick={() => handlePickChoice(key)}
                          className="px-3.5 py-1.5 rounded-xl bg-linen-primary text-linen-surface text-xs font-medium hover:opacity-90 transition-opacity"
                        >
                          Lock as My Choice
                        </button>
                      )}

                      {/* If secret pick is chosen and waiting for guess */}
                      {currentRound.authorChoice && (
                        <button
                          onClick={() => handleGuessChoice(key)}
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-xs"
                        >
                          Guess This Option
                        </button>
                      )}
                    </div>
                  )}

                  {/* Reveal Badges */}
                  {currentRound.revealed && (
                    <div className="flex items-center space-x-1.5 shrink-0 text-[11px] font-medium">
                      {isPickedByAuthor && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Partner's Choice
                        </span>
                      )}
                      {isGuessedByPartner && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          Your Guess
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Guidance */}
        <div className="pt-4 border-t border-linen-border flex flex-col sm:flex-row items-center justify-between text-xs text-linen-secondary gap-2">
          <div className="flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted zero-knowledge guesses</span>
          </div>

          <div className="flex items-center space-x-3">
            {currentRound.authorChoice && !currentRound.revealed && (
              <span className="italic text-indigo-600 font-medium">
                Secret pick is locked! Tap "Guess This Option" on the choice you believe they picked.
              </span>
            )}
            {currentRound.revealed && (
              <button
                onClick={handleShuffleNewRound}
                className="font-medium text-linen-accent hover:underline flex items-center space-x-1"
              >
                <span>Play Next Round</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
