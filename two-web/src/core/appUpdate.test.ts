import { describe, it, expect, vi } from 'vitest';
import { appVersion, checkForUpdate, installUpdate, remindLater, isPutOff, sizeLabel } from './appUpdate';

type Reply = Record<string, unknown> & { id: string };
const reply = (r: Reply) => (globalThis as unknown as { __twoUpdate: (r: Reply) => void }).__twoUpdate(r);

/** A phone on version `code`, whose GitHub check answers with `release`. */
function phoneOn(code: number, release: Omit<Reply, 'id'> | null, install: Array<Omit<Reply, 'id'>> = []) {
  const bridge = {
    appVersion: () => JSON.stringify({ code, name: `1.0.${code}`, updatable: true }),
    updateCheck: vi.fn((id: string) => {
      queueMicrotask(() => reply(release ? { id, ...release } : { id, ok: false, reason: 'network' }));
    }),
    updateInstall: vi.fn((id: string) => {
      for (const step of install) queueMicrotask(() => reply({ id, ...step }));
    })
  };
  (globalThis as unknown as { AndroidBridge: typeof bridge }).AndroidBridge = bridge;
  return bridge;
}

const release66 = { ok: true, available: true, code: 66, name: '1.0.66', size: 4_100_000, notes: ['Fingerprint unlock', '', 7] };

describe('Checking for a new version', () => {
  it('does nothing on the website', async () => {
    expect(appVersion()).toBeNull();
    expect(await checkForUpdate(true)).toEqual({ status: 'skipped' });
  });

  it('finds a newer release, with only real lines of what is new', async () => {
    phoneOn(65, release66);
    expect(await checkForUpdate()).toEqual({
      status: 'found',
      update: { code: 66, name: '1.0.66', size: 4_100_000, notes: ['Fingerprint unlock'] }
    });
  });

  it('says there is nothing when the release is not newer', async () => {
    phoneOn(66, release66);
    expect(await checkForUpdate()).toEqual({ status: 'none' });
  });

  it('says it failed when GitHub cannot be reached', async () => {
    phoneOn(65, null);
    expect(await checkForUpdate()).toEqual({ status: 'failed' });
  });

  it('asks at most once a minute, but offers an update it already found again', async () => {
    const bridge = phoneOn(65, release66);
    await checkForUpdate();
    const again = await checkForUpdate();
    expect(bridge.updateCheck).toHaveBeenCalledTimes(1);
    expect(again).toMatchObject({ status: 'found', update: { code: 66 } });
  });

  it('offers a release that came out just after the last check on the next open', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-14T14:35:00Z'));
      phoneOn(65, { ok: true, available: false });
      expect(await checkForUpdate()).toEqual({ status: 'none' });
      // 1.0.66 is published at 14:40; the app is opened again at 14:45.
      vi.setSystemTime(new Date('2026-10-14T14:45:00Z'));
      const bridge = phoneOn(65, release66);
      expect(await checkForUpdate()).toMatchObject({ status: 'found', update: { code: 66 } });
      expect(bridge.updateCheck).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks again straight away when told to', async () => {
    const bridge = phoneOn(65, release66);
    await checkForUpdate();
    await checkForUpdate(true);
    expect(bridge.updateCheck).toHaveBeenCalledTimes(2);
  });

  it('stops offering an update once it is installed', async () => {
    phoneOn(65, release66);
    await checkForUpdate();
    phoneOn(66, release66);
    expect(await checkForUpdate()).toEqual({ status: 'skipped' });
  });
});

describe('Later', () => {
  it('quiets that version for a day, and only that version', () => {
    remindLater(66);
    expect(isPutOff(66)).toBe(true);
    expect(isPutOff(67)).toBe(false);
  });

  it('wears off after a day', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-12T10:00:00Z'));
      remindLater(66);
      vi.setSystemTime(new Date('2026-10-13T10:00:01Z'));
      expect(isPutOff(66)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Installing', () => {
  it('reports progress, then hands over to the installer', async () => {
    phoneOn(65, release66, [{ progress: 0.5 }, { progress: 1 }, { ok: true }]);
    const seen: number[] = [];
    expect(await installUpdate(p => seen.push(p))).toEqual({ ok: true });
    expect(seen).toEqual([0.5, 1]);
  });

  it('passes on why it stopped, and treats anything unknown as an error', async () => {
    phoneOn(65, release66, [{ ok: false, reason: 'permission' }]);
    expect(await installUpdate(() => {})).toEqual({ ok: false, reason: 'permission' });
    phoneOn(65, release66, [{ ok: false, reason: 'verify' }]);
    expect(await installUpdate(() => {})).toEqual({ ok: false, reason: 'verify' });
    phoneOn(65, release66, [{ ok: false, reason: 'gremlins' }]);
    expect(await installUpdate(() => {})).toEqual({ ok: false, reason: 'error' });
  });

  it('is unavailable on an app too old to install updates', async () => {
    (globalThis as unknown as { AndroidBridge: object }).AndroidBridge = {};
    expect(await installUpdate(() => {})).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('Sizes', () => {
  it('reads in megabytes', () => {
    expect(sizeLabel(4_100_000)).toBe('3.9 MB');
    expect(sizeLabel(0)).toBe('');
  });
});
