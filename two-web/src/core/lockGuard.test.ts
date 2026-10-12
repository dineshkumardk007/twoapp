import { describe, it, expect } from 'vitest';
import { registerFailure, lockoutRemaining, clearFailures, failedAttempts } from './lockGuard';

describe('Wrong PIN waits', () => {
  it('lets three wrong PINs through, then makes each wait longer than the last', () => {
    const now = 1_000_000;
    expect([1, 2, 3].map(() => registerFailure(now))).toEqual([0, 0, 0]);
    expect(registerFailure(now)).toBe(15);
    expect(registerFailure(now)).toBe(60);
    expect(registerFailure(now)).toBe(300);
    expect(registerFailure(now)).toBe(900);
    expect(registerFailure(now)).toBe(900);
  });

  it('counts the wait down', () => {
    const now = 5_000_000;
    for (let i = 0; i < 4; i++) registerFailure(now);
    expect(lockoutRemaining(now)).toBe(15);
    expect(lockoutRemaining(now + 10_000)).toBe(5);
    expect(lockoutRemaining(now + 15_000)).toBe(0);
  });

  it('survives the app being closed and opened again', () => {
    registerFailure(1);
    registerFailure(1);
    // A reload reads the count back from storage, not from memory.
    expect(failedAttempts()).toBe(2);
  });

  it('starts again from nothing after the right PIN', () => {
    for (let i = 0; i < 5; i++) registerFailure(1);
    clearFailures();
    expect(failedAttempts()).toBe(0);
    expect(lockoutRemaining(2)).toBe(0);
    expect(registerFailure(2)).toBe(0);
  });
});
