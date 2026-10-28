import { describe, expect, it } from 'vitest';
import { chatChrome, signalAsks } from './chatChrome';

describe('the top bar and the chat', () => {
  it('in the app, the chat has no bar and runs to the edges on a phone', () => {
    expect(chatChrome({ inApp: true, tablet: false, tab: 'chat' })).toEqual({ barHidden: true, flush: true });
  });
  it('a tablet hides the bar too, but keeps the card', () => {
    expect(chatChrome({ inApp: true, tablet: true, tab: 'chat' })).toEqual({ barHidden: true, flush: false });
  });
  it('every other tab keeps the bar', () => {
    for (const tab of ['home', 'settings', 'softlanding', 'groups']) {
      expect(chatChrome({ inApp: true, tablet: false, tab })).toEqual({ barHidden: false, flush: false });
    }
  });
  it('the website keeps its header, the chat included', () => {
    expect(chatChrome({ inApp: false, tablet: false, tab: 'chat' })).toEqual({ barHidden: false, flush: false });
  });
});

describe('a bumped counter', () => {
  it('asks once for each bump', () => {
    expect(signalAsks(0, 1)).toBe(true);
    expect(signalAsks(1, 1)).toBe(false);
    expect(signalAsks(1, 2)).toBe(true);
  });
  it('mounting again with the value it had asks for nothing', () => {
    // Heart was opened from the chat three times, then a group was visited:
    // Navigation comes back holding 3 and has handled nothing yet.
    const mountedWith = 3;
    expect(signalAsks(mountedWith, 3)).toBe(false);
  });
});
