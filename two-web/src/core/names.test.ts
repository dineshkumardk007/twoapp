import { describe, expect, it } from 'vitest';
import { MAX_NAME_CHARS, cleanName, nameProblem, nameStampFor, readNameExchange, startedFromMine, takesOver } from './names';

describe('a name as typed', () => {
  it('one line, single spaces, not too long', () => {
    expect(cleanName('  Dinesh \n Kumar ')).toBe('Dinesh Kumar');
    expect(Array.from(cleanName('த'.repeat(60)))).toHaveLength(MAX_NAME_CHARS);
  });
  it('must be a name of your own', () => {
    expect(nameProblem('   ')).toBe('Type a name');
    expect(nameProblem('you')).toBe('Pick a name of your own');
    expect(nameProblem('Partner')).toBe('Pick a name of your own');
    expect(nameProblem('DK')).toBeNull();
  });
});

describe('a name as it arrives', () => {
  it('with when it was chosen, or without from a phone on the version before', () => {
    expect(readNameExchange({ name: ' DK ', role: 'user', setAt: 50, was: ['Dinesh', 7, ' '] })).toEqual({
      name: 'DK',
      setAt: 50,
      was: ['Dinesh']
    });
    expect(readNameExchange({ name: 'Dinesh', role: 'user' })).toEqual({ name: 'Dinesh', was: [] });
    expect(readNameExchange({ name: 'Dinesh', setAt: 'soon' })).toEqual({ name: 'Dinesh', was: [] });
  });
  it('refuses what is not one', () => {
    expect(readNameExchange(null)).toBeNull();
    expect(readNameExchange({ name: '   ' })).toBeNull();
    expect(readNameExchange({ name: 42 })).toBeNull();
  });
});

describe('a changed name from your own seat', () => {
  const none = () => false;
  it('is yours when it started from a name of yours', () => {
    expect(startedFromMine({ name: 'DK', setAt: 5, was: ['Dinesh'] }, 'dinesh', none)).toBe(true);
    expect(startedFromMine({ name: 'DK', setAt: 5, was: [] }, 'DK', none)).toBe(true);
    expect(startedFromMine({ name: 'DK', setAt: 5, was: ['Dinu'] }, 'Dinesh', n => n === 'Dinu')).toBe(true);
  });
  it("is not when it did not - somebody else's phone in your seat", () => {
    expect(startedFromMine({ name: 'Priya R', setAt: 5, was: ['Priya'] }, 'Dinesh', none)).toBe(false);
  });
});

describe('which name wins', () => {
  it('the one chosen later', () => {
    expect(takesOver(20, 10)).toBe(true);
    expect(takesOver(10, 20)).toBe(false);
    expect(takesOver(10, 10)).toBe(false);
  });
  it('a chosen one over the name from setting up', () => {
    expect(takesOver(10, undefined)).toBe(true);
  });
  it('one with no time - the old name, from a device that has not heard - never undoes a chosen one', () => {
    expect(takesOver(undefined, 10)).toBe(false);
  });
  it('with no time on either, the last heard, as names always behaved', () => {
    expect(takesOver(undefined, undefined)).toBe(true);
  });
  it('chosen here: after the one held, even from a clock ahead', () => {
    expect(nameStampFor(undefined, 100)).toBe(100);
    expect(nameStampFor(50, 100)).toBe(100);
    expect(nameStampFor(500, 100)).toBe(501);
  });
});
