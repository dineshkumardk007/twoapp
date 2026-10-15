import React, { useLayoutEffect, useRef, useState } from 'react';
import { useBackLayer } from '../core/backStack';
import { REACTIONS } from '../core/chatActions';

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
  onReact: (emoji: string) => void;
  actions: MessageMenuAction[];
  onClose: () => void;
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
 * Back, or a tap anywhere else, closes it.
 */
export const MessageMenu: React.FC<MessageMenuProps> = ({ anchor, side, reaction, onReact, actions, onClose }) => {
  useBackLayer(true, onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  // Placed once it can be measured: above if it fits, below if that fits,
  // and otherwise wherever it stays whole on the screen.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const { width, height } = panel.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.visualViewport?.height ?? window.innerHeight;
    let top = anchor.top - height - GAP;
    if (top < EDGE) top = anchor.bottom + GAP;
    if (top + height > viewH - EDGE) top = Math.max(EDGE, viewH - EDGE - height);
    const wanted = side === 'right' ? anchor.right - width : anchor.left;
    const left = Math.min(Math.max(EDGE, wanted), viewW - EDGE - width);
    setPlace({ top, left });
  }, [anchor.top, anchor.bottom, anchor.left, anchor.right, side]);

  return (
    <div
      // A light dimming, so the menu stands clear of the conversation behind it.
      className="no-remap fixed inset-0 z-[80] bg-black/25"
      onPointerDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <div
        ref={panelRef}
        role="menu"
        aria-label="Message"
        className={`absolute w-[260px] max-w-[calc(100vw-24px)] rounded-2xl border border-linen-border bg-linen-surface surface-solid shadow-2xl overflow-hidden ${
          place ? 'menu-pop' : 'invisible'
        } ${side === 'right' ? 'origin-bottom-right' : 'origin-bottom-left'}`}
        style={place ? { top: place.top, left: place.left } : { top: 0, left: 0 }}
      >
        {reaction !== null && (
          <div className="flex items-center justify-between px-2 py-2 border-b border-linen-border">
            {REACTIONS.map(emoji => {
              const chosen = reaction === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  aria-label={chosen ? `Take off ${emoji}` : `React ${emoji}`}
                  aria-pressed={chosen}
                  onClick={() => onReact(chosen ? '' : emoji)}
                  className={`h-11 w-11 rounded-full text-[24px] leading-none flex items-center justify-center transition-transform active:scale-90 ${
                    chosen ? 'bg-linen-variant ring-2 ring-linen-accent/60' : 'hover:bg-linen-variant'
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}
        <div className="py-1">
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                onClick={action.onSelect}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors hover:bg-linen-variant ${
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
