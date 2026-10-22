import { describe, expect, it } from 'vitest';
import { applyReaction, isReactionEmoji, reactionRow, recentReactions, rememberReaction, REACTIONS } from './chatActions';
import { EMOJI_GROUPS } from '../components/EmojiPicker';
import { ChatMessage } from '../types';

describe('reacting with any emoji', () => {
  it('every emoji the full list offers for reacting is one the other phone accepts', () => {
    const msg: ChatMessage = { id: 'm1', authorId: 'user', authorName: '', text: 'hi', timestamp: '', sentAt: 1 };
    for (const char of EMOJI_GROUPS.flatMap(g => g.chars).filter(isReactionEmoji)) {
      const after = applyReaction([msg], 'partner', { messageId: 'm1', emoji: char });
      expect(after?.[0].reactions?.partner, char).toBe(char);
    }
  });

  it('letters, digits and spaces are not reactions', () => {
    expect(isReactionEmoji('a')).toBe(false);
    expect(isReactionEmoji('1️⃣')).toBe(false);
    expect(isReactionEmoji('🙂 ')).toBe(false);
    expect(isReactionEmoji('')).toBe(false);
    expect(isReactionEmoji('🥹')).toBe(true);
  });

  it('a reaction chosen from the full list comes first next time', () => {
    expect(reactionRow('')).toEqual([...REACTIONS]);
    rememberReaction('🥹');
    rememberReaction('🔥');
    expect(recentReactions()).toEqual(['🔥', '🥹']);
    expect(reactionRow('')).toEqual(['🔥', '🥹', '❤️', '😂', '😮']);
  });

  it('the usual five are not remembered, and only three are kept', () => {
    rememberReaction('❤️');
    expect(recentReactions()).toEqual([]);
    for (const e of ['🔥', '🥹', '🌸', '🎉']) rememberReaction(e);
    expect(recentReactions()).toEqual(['🎉', '🌸', '🥹']);
  });

  it('your reaction now is always in the row, so it can be taken off', () => {
    expect(reactionRow('🌸')[0]).toBe('🌸');
    expect(reactionRow('😂')).toEqual([...REACTIONS]);
  });
});
