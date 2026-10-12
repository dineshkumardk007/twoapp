import { describe, it, expect, vi } from 'vitest';
import { fingerprintStatus, unlockWithFingerprint, enableFingerprint, disableFingerprint } from './fingerprint';

type Reply = { id: string; ok: boolean; pin?: string; reason?: string };
const reply = (r: Reply) => (globalThis as unknown as { __twoFingerprint: (r: Reply) => void }).__twoFingerprint(r);

/** A phone whose sensor answers each prompt with the next of `answers`. */
function phoneWith(status: string, answers: Array<Omit<Reply, 'id'>> = []) {
  const asked: string[] = [];
  const bridge = {
    fingerprintStatus: () => status,
    fingerprintUnlock: vi.fn((id: string) => {
      asked.push(id);
      const next = answers.shift();
      if (next) queueMicrotask(() => reply({ id, ...next }));
    }),
    fingerprintEnable: vi.fn((id: string, _pin: string) => {
      const next = answers.shift();
      if (next) queueMicrotask(() => reply({ id, ...next }));
    }),
    fingerprintDisable: vi.fn()
  };
  (globalThis as unknown as { AndroidBridge: typeof bridge }).AndroidBridge = bridge;
  return { bridge, asked };
}

describe('Fingerprint unlock', () => {
  it('is unavailable on the website, where there is no sensor', async () => {
    expect(fingerprintStatus()).toBe('unavailable');
    expect(await unlockWithFingerprint()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it("reports the phone's status, and treats anything unknown as unavailable", () => {
    phoneWith('on');
    expect(fingerprintStatus()).toBe('on');
    phoneWith('changed');
    expect(fingerprintStatus()).toBe('changed');
    phoneWith('something-new');
    expect(fingerprintStatus()).toBe('unavailable');
  });

  it('hands back the PIN after a touch', async () => {
    phoneWith('on', [{ ok: true, pin: '1234' }]);
    expect(await unlockWithFingerprint()).toEqual({ ok: true, pin: '1234' });
  });

  it('passes on why a prompt ended without a touch', async () => {
    phoneWith('on', [{ ok: false, reason: 'cancel' }, { ok: false, reason: 'lockout' }, { ok: false, reason: 'weird' }]);
    expect(await unlockWithFingerprint()).toEqual({ ok: false, reason: 'cancel' });
    expect(await unlockWithFingerprint()).toEqual({ ok: false, reason: 'lockout' });
    expect(await unlockWithFingerprint()).toEqual({ ok: false, reason: 'error' });
  });

  it('answers an older prompt as cancelled when a new one starts, so nothing waits forever', async () => {
    const { asked } = phoneWith('on');
    const first = unlockWithFingerprint();
    const second = unlockWithFingerprint();
    expect(await first).toEqual({ ok: false, reason: 'cancel' });
    reply({ id: asked[1], ok: true, pin: '5678' });
    expect(await second).toEqual({ ok: true, pin: '5678' });
  });

  it('ignores an answer meant for a different prompt', async () => {
    const { asked } = phoneWith('on');
    const pending = unlockWithFingerprint();
    reply({ id: 'someone-else', ok: true, pin: '0000' });
    reply({ id: asked[0], ok: true, pin: '1234' });
    expect(await pending).toEqual({ ok: true, pin: '1234' });
  });

  it('turns on with the PIN it was given, and off again', async () => {
    const { bridge } = phoneWith('off', [{ ok: true }]);
    expect(await enableFingerprint('1234')).toEqual({ ok: true, pin: undefined });
    expect(bridge.fingerprintEnable).toHaveBeenCalledWith(expect.any(String), '1234');
    disableFingerprint();
    expect(bridge.fingerprintDisable).toHaveBeenCalled();
  });
});
