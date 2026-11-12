import { afterEach, describe, expect, it } from 'vitest';
import { VFX, cleanVfxSaid, hearVfx, onVfx, sayVfx, scatter, setVfxSender, vfxOf, type VfxSaid } from './chatVfx';
import { TA } from './i18n.ta';

describe('an emoji that plays an effect in the chat', () => {
  it('there are sixteen, each its own emoji, name and sound', () => {
    expect(VFX.length).toBe(16);
    expect(new Set(VFX.map(v => v.id)).size).toBe(16);
    expect(new Set(VFX.map(v => v.emoji)).size).toBe(16);
    expect(new Set(VFX.map(v => v.sound)).size).toBe(16);
    expect(new Set(VFX.map(v => v.name)).size).toBe(16);
    for (const v of VFX) {
      expect(v.sound.startsWith('vx-')).toBe(true);
      expect(v.ms).toBeGreaterThan(2000);
      expect(TA[v.name], v.name).toBeTruthy();
    }
    // Their order is what a tap sends: the first eight stay where they are.
    expect(VFX.slice(0, 8).map(v => v.id)).toEqual(['heart', 'fire', 'laugh', 'party', 'kiss', 'broken', 'rose', 'ghost']);
  });

  it('every sound it plays has been made', () => {
    const files = Object.keys(import.meta.glob('../assets/sounds/vx-*.mp3'));
    for (const v of VFX) expect(files.some(f => f.endsWith(`/${v.sound}.mp3`)), v.sound).toBe(true);
    expect(files.length).toBe(16);
  });

  it('only a message that is nothing but the emoji plays one', () => {
    for (const v of VFX) expect(vfxOf(v.emoji)).toBe(v);
    expect(vfxOf('  ❤️ ')?.id).toBe('heart');
    // With or without the mark some keyboards add after it.
    expect(vfxOf('❤')?.id).toBe('heart');
    expect(vfxOf('❤️')?.id).toBe('heart');
    expect(vfxOf('⚡')?.id).toBe('bolt');
    expect(vfxOf('love you ❤️')).toBeNull();
    expect(vfxOf('❤️❤️')).toBeNull();
    expect(vfxOf('👍')).toBeNull();
    expect(vfxOf('')).toBeNull();
    expect(vfxOf(undefined)).toBeNull();
  });

  it('takes from the other phone only what a tap could have said', () => {
    expect(cleanVfxSaid({ k: 3, m: 'abc' })).toEqual({ k: 3, m: 'abc' });
    expect(cleanVfxSaid({ k: 0 })).toEqual({ k: 0 });
    expect(cleanVfxSaid({ k: 16 })).toBeNull();
    expect(cleanVfxSaid({ k: -1 })).toBeNull();
    expect(cleanVfxSaid({ k: 1.5 })).toBeNull();
    expect(cleanVfxSaid({ k: 2, m: 'x'.repeat(200) })).toEqual({ k: 2 });
    expect(cleanVfxSaid({ k: 2, m: 7 })).toEqual({ k: 2 });
    expect(cleanVfxSaid('boo')).toBeNull();
    expect(cleanVfxSaid(null)).toBeNull();
  });
});

describe('a tap on one, told to the other phone', () => {
  afterEach(() => setVfxSender(null));

  it('goes out by the way App gives, and nowhere when there is none', () => {
    const sent: VfxSaid[] = [];
    sayVfx({ k: 1 });
    setVfxSender(said => sent.push(said));
    sayVfx({ k: 4, m: 'm1' });
    expect(sent).toEqual([{ k: 4, m: 'm1' }]);
    setVfxSender(() => {
      throw new Error('not connected');
    });
    expect(() => sayVfx({ k: 4 })).not.toThrow();
  });

  it('is heard by the chat on screen, and by nothing once that has gone', () => {
    const heard: VfxSaid[] = [];
    expect(hearVfx({ k: 2 })).toBe(false);
    const stop = onVfx(said => heard.push(said));
    expect(hearVfx({ k: 2, m: 'm9' })).toBe(true);
    expect(hearVfx({ k: 99 })).toBe(false);
    expect(heard).toEqual([{ k: 2, m: 'm9' }]);
    stop();
    expect(hearVfx({ k: 2 })).toBe(false);
    expect(heard.length).toBe(1);
  });
});

describe('where the pieces of an effect are thrown', () => {
  it('is the same for the same seed, different for another, and always between 0 and 1', () => {
    const a = scatter(42);
    const b = scatter(42);
    const c = scatter(43);
    const first = Array.from({ length: 200 }, () => a());
    expect(Array.from({ length: 200 }, () => b())).toEqual(first);
    expect(Array.from({ length: 200 }, () => c())).not.toEqual(first);
    for (const n of first) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
    // Spread out, not bunched at one end.
    const mean = first.reduce((s, n) => s + n, 0) / first.length;
    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
  });
});
