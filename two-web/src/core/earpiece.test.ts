import { describe, it, expect, vi, beforeEach } from 'vitest';
import { armEar, disarmEar, earIsNear, earSupported, stopEar, resetEarForTests, EarNote } from './earpiece';

type Ev = Record<string, unknown>;
const phone = (e: Ev) => (globalThis as unknown as { __twoEar: (e: Ev) => void }).__twoEar(e);

function fakeBridge(headset = false) {
  const bridge = {
    earAvailable: () => true,
    earWatch: vi.fn(),
    earPlay: vi.fn(),
    earStop: vi.fn(),
    isHeadsetConnected: () => headset
  };
  (globalThis as unknown as { AndroidBridge: typeof bridge }).AndroidBridge = bridge;
  return bridge;
}

function fakeNote(id = 'n1', at = 3.25) {
  const calls: string[] = [];
  const note: EarNote = {
    id,
    dataUrl: 'data:audio/webm;codecs=opus;base64,AAAA',
    position: () => at,
    rate: () => 1.5,
    toEar: () => calls.push('toEar'),
    back: (reason, pos) => calls.push(`back:${reason}:${pos}`)
  };
  return { note, calls };
}

beforeEach(() => resetEarForTests());

describe('Voice notes at your ear', () => {
  it('is off on the website and on phones without a sensor', () => {
    expect(earSupported()).toBe(false);
    const b = fakeBridge();
    b.earAvailable = () => false;
    expect(earSupported()).toBe(false);
  });

  it('watches while a note plays, and hands it over when the phone is raised', () => {
    const b = fakeBridge();
    const { note, calls } = fakeNote();
    armEar(note);
    expect(b.earWatch).toHaveBeenLastCalledWith(true);
    phone({ event: 'near' });
    expect(calls).toEqual(['toEar']);
    expect(b.earPlay).toHaveBeenCalledWith('n1', 'AAAA', 3250, 1.5);
  });

  it('gets the note back, paused where it was, when the phone is lowered', () => {
    const b = fakeBridge();
    const { note, calls } = fakeNote();
    armEar(note);
    phone({ event: 'near' });
    phone({ event: 'stopped', id: 'n1', positionMs: 7500, reason: 'lowered' });
    expect(calls).toEqual(['toEar', 'back:lowered:7.5']);
    expect(b.earWatch).toHaveBeenLastCalledWith(false);
  });

  it('stops watching when the note is paused on the speaker', () => {
    const b = fakeBridge();
    const { note } = fakeNote();
    armEar(note);
    disarmEar('n1');
    expect(b.earWatch).toHaveBeenLastCalledWith(false);
    phone({ event: 'near' });
    expect(b.earPlay).not.toHaveBeenCalled();
  });

  it('does nothing with earphones in', () => {
    const b = fakeBridge(true);
    armEar(fakeNote().note);
    expect(b.earWatch).not.toHaveBeenCalled();
  });

  it('starts the next note at the ear when one ends there', () => {
    vi.useFakeTimers();
    const b = fakeBridge();
    const first = fakeNote('n1');
    armEar(first.note);
    phone({ event: 'near' });
    phone({ event: 'stopped', id: 'n1', positionMs: 9000, reason: 'ended' });
    expect(first.calls).toEqual(['toEar', 'back:ended:9']);
    // Still watching, and still near: the next note goes straight there.
    expect(earIsNear()).toBe(true);
    const second = fakeNote('n2', 0);
    armEar(second.note);
    expect(second.calls).toEqual(['toEar']);
    expect(b.earPlay).toHaveBeenLastCalledWith('n2', 'AAAA', 0, 1.5);
    vi.useRealTimers();
  });

  it('lets go of the sensor if no next note comes', () => {
    vi.useFakeTimers();
    const b = fakeBridge();
    armEar(fakeNote().note);
    phone({ event: 'near' });
    phone({ event: 'stopped', id: 'n1', positionMs: 9000, reason: 'ended' });
    vi.advanceTimersByTime(3000);
    expect(b.earWatch).toHaveBeenLastCalledWith(false);
    vi.useRealTimers();
  });

  it('stops the earpiece when the bubble goes away mid-note', () => {
    const b = fakeBridge();
    armEar(fakeNote().note);
    phone({ event: 'near' });
    stopEar('n1');
    expect(b.earStop).toHaveBeenCalled();
  });

  it('keeps the note on the speaker when a call has the earpiece', () => {
    fakeBridge();
    const { note, calls } = fakeNote();
    armEar(note);
    phone({ event: 'near' });
    phone({ event: 'stopped', id: 'n1', positionMs: 3250, reason: 'busy' });
    expect(calls).toEqual(['toEar', 'back:busy:3.25']);
  });
});
