import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useT } from '../core/i18n';
import { STICKERS, recentStickers, rememberSticker, stickerInfo, type StickerSet } from '../core/stickers';
import { StickerArt } from './StickerArt';
import { isPartyToday } from '../core/surprise';

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
  /** Only the characters this allows (a reaction cannot be every character). */
  only?: (char: string) => boolean;
  /** The heading, "Emoji" unless said otherwise. */
  title?: string;
  /**
   * What a tap does, for screen readers: "Add" unless said otherwise. Given in
   * English: it is looked up as "{word} {emoji}" ("React {emoji}"), so each
   * language can put the emoji where it goes.
   */
  pickWord?: string;
  /**
   * Given, the picker has a Stickers tab too, and a sticker tapped there is
   * sent at once.
   */
  onSticker?: (id: string) => void;
  /** Fills the height it is given (KeyboardPanel) rather than keeping to its own. */
  fill?: boolean;
}

/** The tab last used, so the picker opens where you left it. */
let lastTab: 'emoji' | 'stickers' = 'emoji';

const SETS: { set: StickerSet; title: string }[] = [
  { set: 'birthday', title: 'Birthday' },
  { set: 'us', title: 'Us two' },
  { set: 'faces', title: 'Funny faces' }
];

/**
 * Sits between the conversation and the composer, so the draft being added to
 * stays in view, and is capped in height so the conversation never disappears
 * behind it.
 */
export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onPick, onClose, only, title, pickWord = 'Add', onSticker, fill }) => {
  const tr = useT();
  const [tab, setTab] = useState<'emoji' | 'stickers'>(onSticker ? lastTab : 'emoji');
  const [recent, setRecent] = useState(recentStickers);
  const choose = (next: 'emoji' | 'stickers') => {
    lastTab = next;
    setTab(next);
  };
  const tabClass = (on: boolean) =>
    `rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
      on ? 'bg-linen-variant text-linen-primary' : 'text-linen-secondary hover:text-linen-primary'
    }`;
  const sendSticker = (id: string) => {
    onSticker?.(id);
    setRecent(rememberSticker(id));
  };
  const tile = (id: string) => (
    <button
      key={id}
      type="button"
      onClick={() => sendSticker(id)}
      aria-label={tr('Send the sticker "{name}"', { name: tr(stickerInfo(id)?.label || 'Sticker') })}
      className="flex aspect-square items-center justify-center rounded-2xl hover:bg-linen-variant active:scale-90 transition-transform cursor-pointer"
    >
      <StickerArt id={id} size={68} still />
    </button>
  );
  return (
  <div className={`border-t border-linen-border bg-linen-surface ${fill ? 'flex h-full flex-col' : ''}`}>
    <div className="flex shrink-0 items-center justify-between px-4 pt-2.5 pb-1">
      {onSticker ? (
        <div role="tablist" className="-ml-3 flex items-center gap-1">
          <button type="button" role="tab" aria-selected={tab === 'emoji'} onClick={() => choose('emoji')} className={tabClass(tab === 'emoji')}>
            {tr('Emoji')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'stickers'} onClick={() => choose('stickers')} className={tabClass(tab === 'stickers')}>
            {tr('Stickers')}
          </button>
        </div>
      ) : (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-linen-accent">
          {title ?? tr('Emoji')}
        </span>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={tr('Close emoji picker')}
        className="rounded-lg p-1 text-linen-secondary hover:bg-linen-variant active:scale-90 transition-all"
      >
        <X className="h-4 w-4" />
      </button>
    </div>

    {tab === 'stickers' ? (
      // Taller than the emoji: a sticker needs room to be seen.
      <div className={`${fill ? 'min-h-0 flex-1' : 'max-h-60'} overflow-y-auto scroll-contain px-3 pb-2`}>
        {recent.length > 0 && (
          <div className="mb-1.5">
            <p className="px-1 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-linen-secondary/70">{tr('Recent')}</p>
            <div className="grid grid-cols-4 gap-1">{recent.map(tile)}</div>
          </div>
        )}
        {/* The birthday ones lead the tray on a birthday, and are put away again after. */}
        {SETS.filter(({ set }) => set !== 'birthday' || isPartyToday()).map(({ set, title: heading }) => (
          <div key={set} className="mb-1.5">
            <p className="px-1 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-linen-secondary/70">{tr(heading)}</p>
            <div className="grid grid-cols-4 gap-1">{STICKERS.filter(s => s.set === set).map(s => tile(s.id))}</div>
          </div>
        ))}
      </div>
    ) : (
    <div className={`${fill ? 'min-h-0 flex-1' : 'max-h-44'} overflow-y-auto scroll-contain px-3 pb-2`}>
      {EMOJI_GROUPS.map(group => (
        <div key={group.title} className="mb-1.5">
          <p className="px-1 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-linen-secondary/70">
            {tr(group.title)}
          </p>
          <div className="grid grid-cols-8 gap-0.5">
            {(only ? group.chars.filter(only) : group.chars).map(char => (
              <button
                key={char}
                type="button"
                onClick={() => onPick(char)}
                aria-label={tr(`${pickWord} {emoji}`, { emoji: char })}
                className="flex h-9 items-center justify-center rounded-xl text-xl leading-none hover:bg-linen-variant active:scale-90 transition-all cursor-pointer"
              >
                {char}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
    )}
  </div>
  );
};

/**
 * The emoji and sticker panel where the keyboard is, as messaging apps have
 * it: under the composer, as tall as the keyboard was (--two-kb-h, measured
 * by core/keyboard), with the keyboard put away. While it is open the page
 * counts it as the keyboard (html.panel-up, index.css): the dock under a
 * chat stays out of the way and the panel reaches the bottom of the screen.
 *
 * Its height is the keyboard's less whatever of the keyboard is still up, so
 * as one goes the other takes its place and the composer does not move.
 */
export const KeyboardPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('panel-up');
    return () => root.classList.remove('panel-up');
  }, []);
  return (
    // A press here never takes focus from anything.
    <div className="kb-panel shrink-0 overflow-hidden" onMouseDown={e => e.preventDefault()}>
      {children}
    </div>
  );
};
