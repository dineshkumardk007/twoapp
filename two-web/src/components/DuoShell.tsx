import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, CircleHelp } from 'lucide-react';
import { useBackLayer } from '../core/backStack';
import { DUO_NAMES, type DuoGame } from '../core/duo';
import { DUO_TOURS, markTourSeen, tourSeen } from '../core/gameTours';
import { haptic } from '../core/haptics';
import { useT } from '../core/i18n';
import type { Seat } from '../core/usTwo';
import { wearOf } from '../core/wear';
import { BearFace, BunnyFace } from './CosyHomes';
import { EmoteBubble, EmoteKey, type GameEmotes } from './Emotes';
import { GameTour } from './GameTour';

/** One of you, as a face: the bear is whoever sits in the first seat, as everywhere in Two. */
export const DuoFace: React.FC<{ seat: Seat }> = ({ seat }) => (seat === 'user' ? <BearFace wear={wearOf('user')} /> : <BunnyFace wear={wearOf('partner')} />);

interface DuoShellProps {
  game: DuoGame;
  /** Under the name: "Level 4", "Best 31". */
  sub?: string;
  me: Seat;
  partnerName: string;
  /** The faces you pull at each other, and whether they are here (useGameEmotes). */
  em: GameEmotes;
  /** Their phone has emotes. */
  emotes: boolean;
  /** What each of you is doing in this game: a word or two under each name. */
  myPart?: string;
  theirPart?: string;
  /** The game's picture, for its how-to-play box. */
  art: React.ReactNode;
  /** Something for the right of the top row: a score, a clock. */
  top?: React.ReactNode;
  onBack: () => void;
  /** Over everything: the card when a round or level is done. */
  over?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The frame the games for two at once share (core/duo): the whole screen, a
 * top row with the way back and the how-to-play, and the two of you with
 * whether the other one is here - none of these can be played alone.
 */
export const DuoShell: React.FC<DuoShellProps> = ({ game, sub, me, partnerName, em, emotes, myPart, theirPart, art, top, onBack, over, children }) => {
  const tr = useT();
  const them: Seat = me === 'user' ? 'partner' : 'user';
  const [touring, setTouring] = useState(() => !tourSeen(game));
  const tourDone = () => {
    markTourSeen(game);
    setTouring(false);
    haptic('tick');
  };
  useBackLayer(true, onBack);
  // The how-to-play box goes up after that, so Back closes it first.
  const [settled, setSettled] = useState(false);
  useEffect(() => setSettled(true), []);

  return createPortal(
    <div className={`ch th dg fixed inset-0 z-[46]`} data-game={game}>
      <div className="ch-page">
        <header className="ch-top">
          <button type="button" className="ch-round" onClick={onBack} aria-label={tr('All games')}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h2 className="ch-title">
            {tr(DUO_NAMES[game])}
            {sub && <small>{sub}</small>}
          </h2>
          {top}
          {emotes && <EmoteKey emotes={em} seat={me} partnerName={partnerName} />}
          <button type="button" className="ch-round" onClick={() => setTouring(true)} aria-label={tr('How to play')}>
            <CircleHelp className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="th-two">
          <span className="th-chip" data-who={me === 'user' ? 0 : 1}>
            <span className="th-chip-face" aria-hidden="true">
              <DuoFace seat={me} />
            </span>
            {tr('You')}
            {myPart && <small>{myPart}</small>}
            {emotes && <EmoteBubble shown={em.mine} seat={me} side="left" />}
          </span>
          <span className="th-chip" data-who={them === 'user' ? 0 : 1} data-here={em.theirHere || undefined}>
            <span className="th-chip-face" aria-hidden="true">
              <DuoFace seat={them} />
            </span>
            <span className="th-chip-name">{partnerName}</span>
            <small>{em.theirHere ? theirPart || tr('here now') : tr('not here now')}</small>
            {emotes && <EmoteBubble shown={em.theirs} seat={them} side="left" />}
          </span>
        </div>

        {children}
      </div>
      {over}
      {touring && settled && <GameTour title={DUO_NAMES[game]} lines={DUO_TOURS[game]} art={art} onDone={tourDone} />}
    </div>,
    document.body
  );
};

/** The card over a game when a round or a level is done, with confetti behind it when it went well. */
export const DuoCard: React.FC<{ title: string; line?: React.ReactNode; tip?: string; party?: boolean; children: React.ReactNode }> = ({ title, line, tip, party, children }) => (
  <div className="ch-shade">
    {party && (
      <div className="pg-party" aria-hidden="true">
        {Array.from({ length: 30 }, (_, i) => (
          <i
            key={i}
            style={
              {
                background: ['#f43f5e', '#ffd23f', '#0ea5e9', '#22c55e', '#ffffff'][i % 5],
                left: `${8 + ((i * 37) % 84)}%`,
                '--dx': `${((i * 53) % 120) - 60}px`,
                '--spin': `${((i * 97) % 720) - 360}deg`,
                animationDelay: `${(i % 9) * 40}ms`,
                borderRadius: i % 3 ? '2px' : '50%'
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    )}
    <div className="ch-card" role="dialog" aria-modal="true" aria-label={title}>
      <h3 className="ch-card-title">{title}</h3>
      {line && <p className="ch-card-line">{line}</p>}
      {tip && <p className="ch-card-tip">{tip}</p>}
      <div className="ch-card-buttons">{children}</div>
    </div>
  </div>
);
