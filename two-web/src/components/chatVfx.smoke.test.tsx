import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VFX } from '../core/chatVfx';
import { VfxArt, VfxEmoji, type VfxPlay } from './ChatVfx';
import { EmojiPicker } from './EmojiPicker';

// The effects drawn once each: nothing here checks how they look, only that
// each can be drawn, is its own thing, and has nothing broken in its numbers.

const play = (i: number, seed = 7): VfxPlay => ({ key: i, vfx: VFX[i], ox: 280, oy: 520, w: 360, h: 760, seed });

describe('the effects over the chat can be drawn', () => {
  it('all sixteen, each different from the others', () => {
    const seen = new Set<string>();
    VFX.forEach((v, i) => {
      const html = renderToString(<VfxArt play={play(i)} />);
      expect(html).toContain(`data-v="${v.id}"`);
      expect(html, v.id).not.toContain('NaN');
      expect(html, v.id).not.toContain('undefined');
      expect(html, v.id).not.toContain('Infinity');
      // Enough pieces to be an effect, not so many a phone would stumble.
      const pieces = (html.match(/<(i|b|u|s|em|polyline) /g) ?? []).length;
      expect(pieces, v.id).toBeGreaterThanOrEqual(12);
      expect(pieces, v.id).toBeLessThanOrEqual(130);
      seen.add(html.replace(/data-v="[a-z]+"/, ''));
    });
    expect(seen.size).toBe(16);
  });

  it('is laid out the same for the same seed, and differently for another', () => {
    const once = renderToString(<VfxArt play={play(0, 11)} />);
    expect(renderToString(<VfxArt play={play(0, 11)} />)).toBe(once);
    expect(renderToString(<VfxArt play={play(0, 12)} />)).not.toBe(once);
  });

  it('starts from where the emoji is', () => {
    const html = renderToString(<VfxArt play={{ ...play(0), ox: 123, oy: 456 }} />);
    expect(html).toContain('--x:123px');
    expect(html).toContain('--y:456px');
  });

  it('the emoji in the conversation is a button that says what it plays', () => {
    const html = renderToString(<VfxEmoji vfx={VFX[1]} id="m1" label="Fire: tap to play" onPlay={() => {}} />);
    expect(html).toContain('data-vfx-msg="m1"');
    expect(html).toContain('aria-label="Fire: tap to play"');
    expect(html).toContain('data-idle="flicker"');
    expect(html).toContain('🔥');
  });
});

describe('the emoji panel', () => {
  it('leads with VFX in the chat, and has no such row anywhere else', () => {
    const chat = renderToString(<EmojiPicker onPick={() => {}} onClose={() => {}} vfx />);
    expect(chat).toContain('VFX');
    expect(chat.indexOf('VFX')).toBeLessThan(chat.indexOf('Hearts'));
    for (const v of VFX) expect(chat).toContain(v.emoji);
    const other = renderToString(<EmojiPicker onPick={() => {}} onClose={() => {}} />);
    expect(other).not.toContain('VFX');
    expect(other).toContain('Hearts');
  });
});
