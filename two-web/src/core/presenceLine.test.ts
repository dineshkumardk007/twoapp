import { afterEach, describe, expect, it } from 'vitest';
import { chooseLocale } from './i18n';
import { formatLastSeen } from './lastSeen';
import { presenceLine, type PresenceFacts } from './presenceLine';

afterEach(() => chooseLocale('en'));

const facts = (over: Partial<PresenceFacts> = {}): PresenceFacts => ({
  relayStatus: 'connected',
  typing: false,
  online: false,
  lastSeen: '',
  ...over
});

describe('the line under her name', () => {
  it('says typing over online, and online over last seen', () => {
    const seen = 'last seen today at 4:45 pm';
    expect(presenceLine(facts({ typing: true, online: true, lastSeen: seen }))).toEqual({ kind: 'typing', text: 'typing…' });
    expect(presenceLine(facts({ online: true, lastSeen: seen }))).toEqual({ kind: 'online', text: 'online' });
    expect(presenceLine(facts({ lastSeen: seen }))).toEqual({ kind: 'lastSeen', text: seen });
  });

  it('is empty with no last seen to show', () => {
    expect(presenceLine(facts())).toEqual({ kind: 'none', text: '' });
  });

  it('says only Connecting… while this phone is reconnecting, whatever was heard of her', () => {
    for (const relayStatus of ['connecting', 'reconnecting'] as const) {
      expect(presenceLine(facts({ relayStatus, typing: true, online: true, lastSeen: 'last seen today at 4:45 pm' }))).toEqual({
        kind: 'connecting',
        text: 'Connecting…'
      });
    }
  });

  it('says only Offline when this phone is not trying', () => {
    expect(presenceLine(facts({ relayStatus: 'idle', online: true }))).toEqual({ kind: 'offline', text: 'Offline' });
  });

  it('in Tamil', () => {
    chooseLocale('ta');
    expect(presenceLine(facts({ online: true })).text).toBe('ஆன்லைனில்');
    expect(presenceLine(facts({ typing: true })).text).toBe('எழுதுகிறார்…');
    expect(presenceLine(facts({ relayStatus: 'reconnecting' })).text).toBe('இணைக்கிறது…');
  });
});

describe('last seen, in words', () => {
  const NOW = new Date(2026, 9, 27, 21, 0).getTime();

  it('says the hour the way the app\'s own clock does, not with a leading 0', () => {
    expect(formatLastSeen(new Date(2026, 9, 27, 16, 45).getTime(), NOW)).toBe('last seen today at 4:45 pm');
    expect(formatLastSeen(new Date(2026, 9, 27, 9, 5).getTime(), NOW)).toBe('last seen today at 9:05 am');
    expect(formatLastSeen(new Date(2026, 9, 26, 23, 45).getTime(), NOW)).toBe('last seen yesterday at 11:45 pm');
    expect(formatLastSeen(new Date(2026, 9, 27, 0, 10).getTime(), NOW)).toBe('last seen today at 12:10 am');
  });

  it('names the weekday inside a week', () => {
    // 23 October 2026 was a Friday.
    expect(formatLastSeen(new Date(2026, 9, 23, 7, 30).getTime(), NOW)).toBe('last seen Friday at 7:30 am');
  });

  it('says nothing for no time, or one from the future', () => {
    expect(formatLastSeen(0, NOW)).toBe('');
    expect(formatLastSeen(NOW + 5 * 60_000, NOW)).toBe('');
  });

  it('in Tamil, with Tamil words for the time of day', () => {
    chooseLocale('ta');
    expect(formatLastSeen(new Date(2026, 9, 27, 16, 45).getTime(), NOW)).toBe('கடைசியாக இன்று மாலை 4:45 மணிக்கு');
  });
});
