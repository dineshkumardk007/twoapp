import { afterEach, describe, expect, it } from 'vitest';
import { crashNoteToTell, dismissCrashNote, readCrashNote } from './crashNote';

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
