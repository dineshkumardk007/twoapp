import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBackLayer } from '../core/backStack';
import { GAME_TOURS } from '../core/gameTours';
import { useT } from '../core/i18n';
import { GAME_NAMES, type PaperKind } from '../core/paperGames';

/**
 * The small box the first time you open a game: its picture, a few short
 * lines, and "Got it". Only that button (or the phone's Back) closes it, so a
 * stray tap cannot take it away before it has been read. The game carries on
 * behind it: a move from the other phone still arrives.
 */
export const GameTour: React.FC<{ kind: PaperKind; art: React.ReactNode; onDone: () => void }> = ({ kind, art, onDone }) => {
  const tr = useT();
  const ok = useRef<HTMLButtonElement | null>(null);
  useBackLayer(true, onDone);
  useEffect(() => {
    ok.current?.focus({ preventScroll: true });
  }, []);
  return createPortal(
    <div className="gt-shade fixed inset-0 z-[85] flex items-center justify-center bg-black/60 animate-fade-in">
      <div role="dialog" aria-modal="true" aria-labelledby="gt-title" className="gt-box border border-linen-border animate-scale-up">
        <div className="gt-art" aria-hidden="true">
          {art}
        </div>
        <h2 id="gt-title" className="gt-title text-linen-primary">
          {tr(GAME_NAMES[kind])}
        </h2>
        <ul className="gt-lines">
          {GAME_TOURS[kind].map(line => (
            <li key={line.text} className="text-linen-primary">
              <span className="gt-icon" aria-hidden="true">
                {line.icon}
              </span>
              <span>{tr(line.text)}</span>
            </li>
          ))}
        </ul>
        <button ref={ok} type="button" className="gt-ok bg-linen-primary text-linen-surface" onClick={onDone}>
          {tr('Got it')}
        </button>
      </div>
    </div>,
    document.body
  );
};
