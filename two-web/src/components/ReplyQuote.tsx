import React from 'react';

interface ReplyQuoteProps {
  /** Whose message it answers, as this phone says it. */
  who: string;
  /** A few of its words, or what it was ("Photo", "Message unsent"). */
  text: string;
  /** Tapped: the conversation goes back to what it answers. */
  onJump: () => void;
  /** Over a photo, no wider than the picture under it. */
  maxWidth?: number;
}

/**
 * What a message answers, at the top of its bubble - in the couple's chat and
 * in a group's. Set into the bubble a shade off it (bubble-quote), with a bar
 * of the ink: no colour of its own on either side.
 */
export const ReplyQuote: React.FC<ReplyQuoteProps> = ({ who, text, onJump, maxWidth }) => (
  <button
    type="button"
    onClick={onJump}
    className={`bubble-quote mb-1.5 block w-full min-w-0 rounded-xl border-l-[3px] border-linen-primary/40 px-2.5 py-1.5 text-left text-xs ${
      maxWidth !== undefined ? 'mx-0' : ''
    }`}
    style={maxWidth !== undefined ? { maxWidth } : undefined}
  >
    <span className="block font-semibold text-linen-primary">{who}</span>
    <span className="block truncate text-linen-secondary">{text}</span>
  </button>
);
