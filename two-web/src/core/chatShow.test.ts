import { afterEach, describe, expect, it } from 'vitest';
import { photoFileName, photoSize, snippetShown } from './chatShow';
import { chooseLocale } from './i18n';

afterEach(() => chooseLocale('en'));

describe('a photo in the conversation', () => {
  it('keeps its own shape within 240 by 300', () => {
    expect(photoSize({ photoWidth: 4000, photoHeight: 3000 })).toEqual({ width: 240, height: 180 });
    expect(photoSize({ photoWidth: 1000, photoHeight: 2000 })).toEqual({ width: 150, height: 300 });
  });
  it('is four by three when its size is not known', () => {
    expect(photoSize({})).toEqual({ width: 240, height: 180 });
  });
  it('is saved under the time it was sent', () => {
    expect(photoFileName(new Date(2026, 9, 14, 21, 41).getTime())).toBe('two-photo-2026-10-14-2141.jpg');
  });
});

describe('a quote as shown', () => {
  it('says the fixed words in this phone’s language, and a message’s own as written', () => {
    expect(snippetShown('Photo')).toBe('Photo');
    expect(snippetShown(undefined)).toBe('Message');
    chooseLocale('ta');
    expect(snippetShown('Photo')).toBe('புகைப்படம்');
    expect(snippetShown('see you')).toBe('see you');
  });
});
