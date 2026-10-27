import { describe, expect, it } from 'vitest';
import { screenInFront, shownInGroupMode } from './notices';

describe('screenInFront', () => {
  it('is the open group, whatever tab is under it', () => {
    expect(screenInFront('chat', 'g1')).toBe('group:g1');
    expect(screenInFront('home', 'g1')).toBe('group:g1');
  });

  it('is the tab once no group is open', () => {
    expect(screenInFront('chat', null)).toBe('chat');
    expect(screenInFront('letters', null)).toBe('letters');
  });
});

describe('shownInGroupMode', () => {
  it('shows a notice about a group, and a message in the couple chat', () => {
    expect(shownInGroupMode('group:g2')).toBe(true);
    expect(shownInGroupMode('chat')).toBe(true);
  });

  it('keeps the rest of the couple space for when group mode is left', () => {
    expect(shownInGroupMode('letters')).toBe(false);
    expect(shownInGroupMode('home')).toBe(false);
  });
});
