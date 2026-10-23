import { describe, expect, it } from 'vitest';
import { HEART_KINDS, PLAIN_HEART, SAME_MOMENT_BUZZ, heartKind } from './hearts';

describe('kinds of heart', () => {
  it('each feels different from every other: its own buzz', () => {
    const buzzes = HEART_KINDS.map(k => k.buzz.join(','));
    expect(new Set(buzzes).size).toBe(HEART_KINDS.length);
    expect(buzzes).not.toContain(SAME_MOMENT_BUZZ.join(','));
  });

  it('a hug, a kiss and a heartbeat sound different too', () => {
    const sound = (id: string) => HEART_KINDS.find(k => k.id === id)!.sound;
    expect(new Set([sound('warm_hug'), sound('gentle_kiss'), sound('heartbeat_sync'), sound('thinking_of_you')]).size).toBe(4);
  });

  it('every sound it plays is a file the app ships', () => {
    // Found the way sounds.ts finds them.
    const files = new Set(Object.keys(import.meta.glob('../assets/sounds/*.mp3')).map(p => p.replace(/^.*\/([^/]+)\.mp3$/, '$1')));
    for (const k of HEART_KINDS) expect(files.has(k.sound)).toBe(true);
  });

  it('buzzes a phone can play: short, and alternating buzz and pause', () => {
    for (const k of HEART_KINDS) {
      expect(k.buzz.length % 2).toBe(1);
      expect(k.buzz.reduce((a, b) => a + b, 0)).toBeLessThan(2000);
    }
  });

  it('the plain heart is how every heart felt before', () => {
    expect(PLAIN_HEART.buzz).toEqual([60, 40, 60]);
    expect(PLAIN_HEART.sound).toBe('gentle-chime');
  });

  it('one this phone does not know - or from an older phone, with none - is the plain heart', () => {
    expect(heartKind(undefined)).toBe(PLAIN_HEART);
    expect(heartKind('a_new_kind')).toBe(PLAIN_HEART);
    expect(heartKind(42)).toBe(PLAIN_HEART);
    expect(heartKind('gentle_kiss').emoji).toBe('💋');
  });
});
