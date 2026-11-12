import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EMOTES } from '../core/gameEmotes';
import type { Seat } from '../core/usTwo';
import { EmoteBubble, EmoteFace, EmoteKey, HereMark, type GameEmotes } from './Emotes';
import { PaperGames } from './PaperGames';
import { PAPER_KINDS, newGame } from '../core/paperGames';
import { markTourSeen } from '../core/gameTours';

// Each emote drawn once, as the bear and as the bunny: nothing here checks
// how it looks, only that it can be drawn at all, and that no two are the
// same picture.

const idle: GameEmotes = { mine: null, theirs: null, send: () => {}, muted: false, mute: () => {}, theirHere: false };

describe('the emotes can be drawn', () => {
  it('all ten, as each of you, every one a different picture', () => {
    for (const seat of ['user', 'partner'] as Seat[]) {
      const seen = new Set<string>();
      for (const emote of EMOTES) {
        const html = renderToString(<EmoteFace emote={emote.id} seat={seat} />);
        expect(html).toContain('em-face');
        expect(html).toContain(`data-emote="${emote.id}"`);
        expect(html).toContain('em-head');
        // Nothing in the picture is a number that failed to work out.
        expect(html).not.toContain('NaN');
        expect(html).not.toContain('undefined');
        seen.add(html);
      }
      expect(seen.size).toBe(EMOTES.length);
    }
    // The bear and the bunny are not the same face.
    expect(renderToString(<EmoteFace emote="laugh" seat="user" />)).not.toBe(renderToString(<EmoteFace emote="laugh" seat="partner" />));
  });

  it('held still for the tray, and moving in the bubble', () => {
    expect(renderToString(<EmoteFace emote="cry" seat="user" still />)).toContain('data-still');
    expect(renderToString(<EmoteFace emote="cry" seat="user" />)).not.toContain('data-still');
  });

  it('the bubble by a name: nothing until an emote is sent, then that emote on its side', () => {
    expect(renderToString(<EmoteBubble shown={null} seat="user" side="left" />)).toBe('');
    const html = renderToString(<EmoteBubble shown={{ i: 8, at: 5 }} seat="partner" side="right" />);
    expect(html).toContain('em-bubble');
    expect(html).toContain('data-side="right"');
    expect(html).toContain('data-emote="cool"');
  });

  it('the button in a game, shut until it is tapped', () => {
    const html = renderToString(<EmoteKey emotes={idle} seat="user" partnerName="Priya" />);
    expect(html).toContain('em-open');
    expect(html).not.toContain('em-tray');
  });

  it('the mark by their name says here or away', () => {
    expect(renderToString(<HereMark here />)).toContain('here');
    expect(renderToString(<HereMark here />)).toContain('data-here');
    const away = renderToString(<HereMark here={false} />);
    expect(away).toContain('away');
    expect(away).not.toContain('data-here');
  });
});

describe('every game for two has them', () => {
  it('the button, and the mark by their name, in each - and neither when their Two is too old for it', () => {
    for (const kind of PAPER_KINDS) {
      // The first-time box is its own thing, drawn over the page.
      markTourSeen(kind);
      const game = newGame(kind, undefined, 'user', `smoke-${kind}`, 1);
      const draw = (emotes: boolean) =>
        renderToString(<PaperGames kind={kind} game={game} activeUser="user" partnerName="Priya" onChange={() => {}} onBack={() => {}} emotes={emotes} />);
      const html = draw(true);
      expect(html, kind).toContain('em-open');
      expect(html.match(/class="em-here"/g)?.length, kind).toBe(1);
      expect(html).toContain('data-them');
      const old = draw(false);
      expect(old).not.toContain('em-open');
      expect(old).not.toContain('em-here');
    }
  });
});
