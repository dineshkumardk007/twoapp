import { describe, expect, it } from 'vitest';
import { bluetoothHeadsetConnected, loudness, wantsEchoCancelling } from './call';

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

describe('a call with earphones', () => {
  it('echo cancelling is off only with wired earphones; a Bluetooth headset keeps it, so its own microphone is the one used', () => {
    // Earpiece, and loudspeaker.
    expect(wantsEchoCancelling(false, false, false)).toBe(true);
    expect(wantsEchoCancelling(true, false, false)).toBe(true);
    // Wired earphones: off, and on again when the speaker is chosen.
    expect(wantsEchoCancelling(false, true, false)).toBe(false);
    expect(wantsEchoCancelling(true, true, false)).toBe(true);
    // A neckband.
    expect(wantsEchoCancelling(false, true, true)).toBe(true);
    expect(wantsEchoCancelling(true, true, true)).toBe(true);
  });
  it('a Bluetooth headset is known only from the phone: never on the website or an older app', () => {
    const w = window as unknown as { AndroidBridge?: unknown };
    const before = w.AndroidBridge;
    try {
      delete w.AndroidBridge;
      expect(bluetoothHeadsetConnected()).toBe(false);
      w.AndroidBridge = { isHeadsetConnected: () => true };
      expect(bluetoothHeadsetConnected()).toBe(false);
      w.AndroidBridge = { isBluetoothCallHeadset: () => true };
      expect(bluetoothHeadsetConnected()).toBe(true);
      w.AndroidBridge = { isBluetoothCallHeadset: () => false };
      expect(bluetoothHeadsetConnected()).toBe(false);
      w.AndroidBridge = {
        isBluetoothCallHeadset: () => {
          throw new Error('no audio service');
        }
      };
      expect(bluetoothHeadsetConnected()).toBe(false);
    } finally {
      if (before === undefined) delete w.AndroidBridge;
      else w.AndroidBridge = before;
    }
  });
});
