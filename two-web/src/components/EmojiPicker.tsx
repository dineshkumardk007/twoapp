import React from 'react';
import { X } from 'lucide-react';

/**
 * One list, used by both conversations.
 *
 * The couple's chat has had a categorised picker since the emoji row was
 * replaced; group chat shipped with twelve characters hardcoded into its own
 * composer, so the same button opened two different things depending on which
 * room you were in. Keeping the list here means there is one place to add a
 * character to, and neither screen can drift from the other again.
 */
export const EMOJI_GROUPS: { title: string; chars: string[] }[] = [
  {
    title: 'Hearts',
    chars: [
      '❤️', '🥰', '😘', '😍', '🫂', '🤗', '💋', '💕',
      '💞', '💝', '🧡', '💛', '💚', '💙', '💜', '🤍'
    ]
  },
  {
    title: 'Faces',
    chars: [
      '😂', '🤣', '😅', '😊', '🙂', '🙃', '😜', '😝',
      '🤩', '🥳', '😎', '🤔', '😐', '😑', '😶', '🙄',
      '😬', '😥', '😢', '😭', '😩', '🥺', '😨', '😱',
      '😠', '😡', '😴', '🤤', '🤒', '🤕', '🤧', '🤯'
    ]
  },
  {
    title: 'Hands',
    chars: [
      '👍', '👎', '👏', '🙌', '🙏', '🤝', '✌️', '🤞',
      '👋', '🤙', '👆', '👇', '💪', '✍️', '👌', '👊'
    ]
  },
  {
    title: 'Life',
    chars: [
      '🌟', '✨', '🔥', '🎉', '🎊', '🎁', '🎂', '🍾',
      '☕', '🍵', '🍫', '🍓', '🍊', '🍕', '🍜', '🍦',
      '🌸', '🌻', '🌹', '🌷', '🌱', '🌳', '🌊', '🌄',
      '🌙', '☀️', '☁️', '🌧️', '❄️', '🌈', '⭐', '💫'
    ]
  },
  {
    title: 'Things',
    chars: [
      '🎵', '🎶', '📷', '📞', '💤', '🛌', '🏠', '✈️',
      '🚗', '🧳', '📚', '✏️', '📦', '🔑', '⏰', '🧩'
    ]
  }
];

interface EmojiPickerProps {
  /** Appends rather than sends, so several can be combined before it goes. */
  onPick: (char: string) => void;
  onClose: () => void;
}

/**
 * Sits between the conversation and the composer, so the draft being added to
 * stays in view, and is capped in height so the conversation never disappears
 * behind it.
 */
export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onPick, onClose }) => (
  <div className="border-t border-linen-border bg-linen-surface">
    <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
        Emoji
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close emoji picker"
        className="rounded-lg p-1 text-linen-secondary hover:bg-linen-variant active:scale-90 transition-all"
      >
        <X className="h-4 w-4" />
      </button>
    </div>

    <div className="max-h-44 overflow-y-auto scroll-contain px-3 pb-2">
      {EMOJI_GROUPS.map(group => (
        <div key={group.title} className="mb-1.5">
          <p className="px-1 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-linen-secondary/70">
            {group.title}
          </p>
          <div className="grid grid-cols-8 gap-0.5">
            {group.chars.map(char => (
              <button
                key={char}
                type="button"
                onClick={() => onPick(char)}
                aria-label={`Add ${char}`}
                className="flex h-9 items-center justify-center rounded-xl text-xl leading-none hover:bg-linen-variant active:scale-90 transition-all cursor-pointer"
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);
