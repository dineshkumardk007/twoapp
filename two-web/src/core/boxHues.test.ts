import { describe, expect, it } from 'vitest';
import { HUES, firstHue, huesFrom } from './boxHues';

describe('box colours', () => {
  it('opens each tab in its family colour', () => {
    expect(firstHue('letters')).toBe('pink');
    expect(firstHue('home')).toBe('teal');
    expect(firstHue('adventures')).toBe('gold');
    expect(firstHue('money')).toBe('sky');
    expect(firstHue('settings')).toBe('violet');
  });

  it('gives a screen it does not know the colour of your own space', () => {
    expect(firstHue('no-such-tab')).toBe('violet');
  });

  it('never puts the same colour on two boxes one after the other', () => {
    for (const first of HUES) {
      const hues = huesFrom(first, 20);
      expect(hues[0]).toBe(first);
      hues.slice(1).forEach((hue, i) => expect(hue).not.toBe(hues[i]));
    }
  });

  it('uses every colour before repeating one', () => {
    expect(new Set(huesFrom('sky', HUES.length)).size).toBe(HUES.length);
  });

  it('colours nothing when there are no boxes', () => {
    expect(huesFrom('pink', 0)).toEqual([]);
  });
});
