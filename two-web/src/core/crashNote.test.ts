import { afterEach, describe, expect, it } from 'vitest';
import { crashNoteToTell, dismissCrashNote, readCrashNote } from './crashNote';
import { loudness } from './call';

/** A pretend Android app holding a note, as CrashNote.kt answers. */
function phoneWith(note: { at: number; text: string } | null) {
  const state = { note, cleared: 0 };
  (window as any).AndroidBridge = {
    lastCrash: () => (state.note ? JSON.stringify(state.note) : ''),
    clearLastCrash: () => {
      state.note = null;
      state.cleared++;
    }
  };
  return state;
}

afterEach(() => {
  delete (window as any).AndroidBridge;
});

describe('the crash note', () => {
  it('is read from the Android app', () => {
    phoneWith({ at: 1_700_000_000_000, text: 'Two closed: an error\nat Foo.bar' });
    expect(readCrashNote()).toEqual({ at: 1_700_000_000_000, text: 'Two closed: an error\nat Foo.bar' });
  });

  it('is nothing without the app, without a note, or with something unreadable', () => {
    expect(readCrashNote()).toBeNull();
    phoneWith(null);
    expect(readCrashNote()).toBeNull();
    (window as any).AndroidBridge = { lastCrash: () => '{not json' };
    expect(readCrashNote()).toBeNull();
    (window as any).AndroidBridge = { lastCrash: () => JSON.stringify({ at: 5, text: '   ' }) };
    expect(readCrashNote()).toBeNull();
    (window as any).AndroidBridge = {
      lastCrash: () => {
        throw new Error('Java exception was raised during method invocation');
      }
    };
    expect(readCrashNote()).toBeNull();
  });

  it('is mentioned once per note, then waits in Settings', () => {
    phoneWith({ at: 111, text: 'first' });
    expect(crashNoteToTell()?.text).toBe('first');
    expect(crashNoteToTell()).toBeNull();
    phoneWith({ at: 222, text: 'second' });
    expect(crashNoteToTell()?.text).toBe('second');
  });

  it('goes when dismissed', () => {
    const phone = phoneWith({ at: 1, text: 'gone soon' });
    dismissCrashNote();
    expect(phone.cleared).toBe(1);
    expect(readCrashNote()).toBeNull();
  });
});

describe('how loud a voice looks', () => {
  it('runs from a hush to a raised voice', () => {
    expect(loudness(0)).toBe(0);
    expect(loudness(-1)).toBe(0);
    expect(loudness(NaN)).toBe(0);
    // -50 dB and below is still; -6 dB and above is full.
    expect(loudness(10 ** (-50 / 20))).toBeCloseTo(0, 5);
    expect(loudness(10 ** (-60 / 20))).toBe(0);
    expect(loudness(10 ** (-6 / 20))).toBeCloseTo(1, 5);
    expect(loudness(1)).toBe(1);
    // Ordinary speech lands in the middle, not at the floor.
    const speech = loudness(10 ** (-28 / 20));
    expect(speech).toBeGreaterThan(0.4);
    expect(speech).toBeLessThan(0.6);
  });
});
