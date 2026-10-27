import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useBackLayer } from '../core/backStack';
import { isReactionEmoji, reactionRow, rememberReaction } from '../core/chatActions';
import { useT } from '../core/i18n';
import { EmojiPicker } from './EmojiPicker';

export interface MessageMenuAction {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
  onSelect: () => void;
}

interface MessageMenuProps {
  /** Where the pressed message is on screen. */
  anchor: { top: number; bottom: number; left: number; right: number };
  /** Your own messages sit on the right; the menu lines up with the message. */
  side: 'left' | 'right';
  /** Null when the message cannot take a reaction; otherwise your reaction now ('' for none). */
  reaction: string | null;
  onReact?: (emoji: string) => void;
  actions: MessageMenuAction[];
  onClose: () => void;
  /** What a screen reader calls it; a message's menu by default. */
  label?: string;
  id?: string;
  /** Under its anchor when there is room, rather than above (the header's ⋮). */
  below?: boolean;
  /** The conversation dimmed behind it; a message's menu does, the header's does not. */
  dim?: boolean;
  /** The first item takes the keyboard on opening, as a menu button's menu does. */
  autoFocus?: boolean;
}

/** Kept this far from the edges of the screen. */
const EDGE = 12;
const GAP = 8;

/**
 * What a long press on a message opens: the reactions in a row, and what can
 * be done with it - answer it, copy it, change or take back your own.
 *
 * It sits just above the message (below it when there is no room above), on
 * the message's own side, so the thumb that pressed is already close to it.
 * Back, Escape, or a tap anywhere else, closes it.
 *
 * The chat header's ⋮ opens the same menu with no reactions, under the button.
 */
export const MessageMenu: React.FC<MessageMenuProps> = ({
  anchor, side, reaction, onReact, actions, onClose, label, id, below = false, dim = true, autoFocus = false
}) => {
  const tr = useT();
  useBackLayer(true, onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number; below: boolean } | null>(null);
  /** The full list of emoji is open, to react with any of them. */
  const [picking, setPicking] = useState(false);
  // Read once: the row should not change under your finger.
  const [row] = useState(() => reactionRow(reaction || ''));

  // Placed once it can be measured: above if it fits, below if that fits,
  // and otherwise wherever it stays whole on the screen.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const { width, height } = panel.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.visualViewport?.height ?? window.innerHeight;
    const above = anchor.top - height - GAP;
    const under = anchor.bottom + GAP;
    let top = below ? (under + height <= viewH - EDGE ? under : above) : above;
    if (top < EDGE) top = under;
    if (top + height > viewH - EDGE) top = Math.max(EDGE, viewH - EDGE - height);
    const wanted = side === 'right' ? anchor.right - width : anchor.left;
    const left = Math.min(Math.max(EDGE, wanted), viewW - EDGE - width);
    setPlace({ top, left, below: top >= anchor.bottom });
  }, [anchor.top, anchor.bottom, anchor.left, anchor.right, side, picking, below]);

  // Once it shows (it is invisible, so unfocusable, until placed).
  const shown = !!place;
  useEffect(() => {
    if (shown && autoFocus) panelRef.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus({ preventScroll: true });
  }, [shown, autoFocus]);

  // Escape closes it; the arrows, Home and End go through its items, round.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // The emoji list's own search box keeps its keys, Escape included.
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    // Tab leaves a menu, as it does everywhere else.
    if (e.key === 'Tab') {
      onClose();
      return;
    }
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])].filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const to =
      e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? (at < 0 ? -1 : at - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? -1 : null;
    if (to === null) return;
    e.preventDefault();
    items[(to + items.length) % items.length].focus();
  };

  return (
    <div
      // A light dimming, so the menu stands clear of the conversation behind it.
      className={`no-remap fixed inset-0 z-[80] ${dim ? 'bg-black/25' : ''}`}
      onPointerDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <div
        ref={panelRef}
        id={id}
        role="menu"
        aria-label={label ?? tr('Message')}
        onKeyDown={onKeyDown}
        className={`absolute w-[260px] max-w-[calc(100vw-24px)] rounded-2xl border border-linen-border bg-linen-surface surface-solid shadow-2xl overflow-hidden ${
          place ? 'menu-pop' : 'invisible'
        } ${
          // It grows out of what it belongs to, above or below.
          place?.below
            ? side === 'right' ? 'origin-top-right' : 'origin-top-left'
            : side === 'right' ? 'origin-bottom-right' : 'origin-bottom-left'
        }`}
        style={place ? { top: place.top, left: place.left } : { top: 0, left: 0 }}
      >
        {reaction !== null && (
          <div className="flex items-center justify-between px-2 py-2 border-b border-linen-border">
            {row.map(emoji => {
              const chosen = reaction === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  aria-label={chosen ? tr('Take off {emoji}', { emoji }) : tr('React {emoji}', { emoji })}
                  aria-pressed={chosen}
                  onClick={() => onReact?.(chosen ? '' : emoji)}
                  className={`h-10 w-10 rounded-full text-[22px] leading-none flex items-center justify-center transition-transform active:scale-90 ${
                    chosen ? 'bg-linen-variant ring-2 ring-linen-accent/60' : 'hover:bg-linen-variant'
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
            {/* Any other emoji, from the full list. */}
            <button
              type="button"
              role="menuitem"
              aria-label={tr('React with another emoji')}
              aria-expanded={picking}
              onClick={() => setPicking(p => !p)}
              className={`h-10 w-10 rounded-full flex items-center justify-center text-linen-secondary transition-transform active:scale-90 ${
                picking ? 'bg-linen-variant ring-2 ring-linen-accent/60' : 'hover:bg-linen-variant'
              }`}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        )}
        {reaction !== null && picking && (
          <EmojiPicker
            title={tr('React with')}
            pickWord="React"
            only={isReactionEmoji}
            onClose={() => setPicking(false)}
            onPick={char => {
              rememberReaction(char);
              onReact?.(char === reaction ? '' : char);
            }}
          />
        )}
        <div className={`py-1 ${picking ? 'hidden' : ''}`}>
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                onClick={action.onSelect}
                // 44px at least, a thumb's width; a long Tamil label wraps rather than being cut.
                className={`w-full min-h-[44px] flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors hover:bg-linen-variant focus-visible:bg-linen-variant ${
                  action.danger ? 'text-rose-600' : 'text-linen-primary'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0 opacity-80" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
