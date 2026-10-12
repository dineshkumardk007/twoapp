import { describe, it, expect } from 'vitest';
import { createVault, unlockVault, writeVault, destroyVault, hasEncryptedVault } from './vault';
import { loadState } from './storage';

const payload = () => ({
  state: { ...loadState(), vaultName: 'Our place' },
  session: { code: 'TWO-7K2M-9XQP-R4TN', role: 'user' as const, userName: 'Dinesh', partnerName: 'Priya' }
});

describe('The PIN vault', () => {
  it('opens with the right PIN and gives back exactly what was locked in', async () => {
    await createVault('1234', payload());
    expect(hasEncryptedVault()).toBe(true);
    const opened = await unlockVault('1234');
    expect(opened?.payload.state.vaultName).toBe('Our place');
    expect(opened?.payload.session?.code).toBe('TWO-7K2M-9XQP-R4TN');
  });

  it('does not open with a wrong PIN', async () => {
    await createVault('1234', payload());
    expect(await unlockVault('4321')).toBeNull();
  });

  it('keeps nothing readable in storage: not the PIN, not the link code', async () => {
    await createVault('1234', payload());
    const everything = JSON.stringify({ ...localStorage });
    const stored = Object.keys(localStorage).map(k => localStorage.getItem(k)).join('\n') + everything;
    expect(stored).not.toContain('1234');
    expect(stored).not.toContain('TWO-7K2M');
    expect(stored).not.toContain('Our place');
  });

  it('saves changes under the same PIN', async () => {
    const key = await createVault('1234', payload());
    const changed = payload();
    changed.state.vaultName = 'Our new place';
    expect(await writeVault(key, changed)).toBe(true);
    expect((await unlockVault('1234'))?.payload.state.vaultName).toBe('Our new place');
  });

  it('is gone once the PIN is removed', async () => {
    await createVault('1234', payload());
    destroyVault();
    expect(hasEncryptedVault()).toBe(false);
    expect(await unlockVault('1234')).toBeNull();
  });
});
