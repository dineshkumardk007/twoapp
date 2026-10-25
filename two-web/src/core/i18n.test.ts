import { afterEach, describe, expect, it } from 'vitest';
import { activeLocale, chooseLocale, dateLocale, readLocale, tr, trMeaning } from './i18n';
import { TA } from './i18n.ta';
import { clockTime } from './when';

afterEach(() => chooseLocale('en'));

describe('words in the phone’s language', () => {
  it('English stays as it is, names and all', () => {
    expect(tr('Settings')).toBe('Settings');
    expect(tr('{name} is typing…', { name: 'Priya' })).toBe('Priya is typing…');
    expect(tr('Words nobody has translated')).toBe('Words nobody has translated');
  });
  it('in Tamil, from the dictionary, with the name put in', () => {
    chooseLocale('ta');
    expect(tr('Settings')).toBe('அமைப்புகள்');
    expect(tr("{name}'s birthday", { name: 'Priya' })).toBe('Priya பிறந்தநாள்');
    // Not in the dictionary: still said, in English.
    expect(tr('Words nobody has translated')).toBe('Words nobody has translated');
  });
  it('a placeholder with nothing to fill it is left showing, not dropped', () => {
    expect(tr('{name} is typing…', {})).toBe('{name} is typing…');
  });
});

describe('one English word with two meanings', () => {
  it('reads the same in English', () => {
    expect(trMeaning('Clear', 'status')).toBe('Clear');
    expect(trMeaning('Home', 'a new home')).toBe('Home');
  });
  it('has its own Tamil, apart from the other meaning', () => {
    chooseLocale('ta');
    expect(tr('Clear')).toBe('தெளிவு');
    expect(trMeaning('Clear', 'status')).toBe('நீக்கு');
    expect(tr('Home')).toBe('இன்று');
    expect(trMeaning('Home', 'a new home')).toBe('புது வீடு');
    expect(trMeaning('Clear', 'a meaning nobody has written')).toBe('Clear');
  });
});

describe('choosing the language', () => {
  it('is kept on this phone, and only a language on offer is read back', () => {
    expect(readLocale()).toBe('en');
    chooseLocale('ta');
    expect(activeLocale()).toBe('ta');
    expect(readLocale()).toBe('ta');
    expect(dateLocale()).toBe('ta-IN');
    localStorage.setItem('two_locale_v1', 'klingon');
    expect(readLocale()).toBe('en');
    chooseLocale('en');
    expect(dateLocale()).toBeUndefined();
  });
  it('a time of day in Tamil words, not Latin am/pm', () => {
    const at = new Date(2026, 9, 24, 16, 44).getTime();
    expect(clockTime(at)).toBe('4:44 pm');
    chooseLocale('ta');
    expect(clockTime(at)).toBe('மாலை 4:44');
  });
});

describe('the Tamil dictionary', () => {
  const entries = Object.entries(TA);
  const holes = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(' ');

  it('keeps every {placeholder} of the English, and adds none', () => {
    const wrong = entries.filter(([en, ta]) => holes(en) !== holes(ta));
    expect(wrong).toEqual([]);
  });
  it('has Tamil for every entry, not English left in by mistake', () => {
    // "{n} / {total}" has no words to write in Tamil; "Picked for you" would.
    const english = entries.filter(([, ta]) => {
      const words = ta.replace(/\{\w+\}/g, '');
      return !ta.trim() || (!/[஀-௿]/.test(words) && /[A-Za-z]{2,}/.test(words));
    });
    expect(english).toEqual([]);
  });
});
