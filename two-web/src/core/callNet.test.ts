import { describe, expect, it } from 'vitest';
import { nextBitrate, noiseReductionOn, playoutTargetMs, redFirst } from './callNet';

const look = (over: Partial<Parameters<typeof nextBitrate>[0]> = {}) => ({
  current: 96,
  ceiling: 96,
  lossPct: 0,
  rttMs: 80,
  goodStreak: 0,
  ...over
});

describe('nextBitrate', () => {
  it('steps down at once when packets are lost', () => {
    expect(nextBitrate(look({ lossPct: 6 })).kbps).toBe(64);
  });

  it('steps down two when it is very bad', () => {
    expect(nextBitrate(look({ lossPct: 20 })).kbps).toBe(48);
    expect(nextBitrate(look({ current: 24, lossPct: 20 })).kbps).toBe(16);
  });

  it('never goes below the last step', () => {
    expect(nextBitrate(look({ current: 16, lossPct: 30 })).kbps).toBe(16);
  });

  it('climbs back only after three calm looks', () => {
    let state = { kbps: 32, goodStreak: 0 };
    state = nextBitrate(look({ current: state.kbps, goodStreak: state.goodStreak }));
    expect(state.kbps).toBe(32);
    state = nextBitrate(look({ current: state.kbps, goodStreak: state.goodStreak }));
    expect(state.kbps).toBe(32);
    state = nextBitrate(look({ current: state.kbps, goodStreak: state.goodStreak }));
    expect(state.kbps).toBe(48);
  });

  it('keeps under the saver ceiling', () => {
    expect(nextBitrate(look({ current: 48, ceiling: 48, goodStreak: 5 })).kbps).toBe(48);
  });

  it('holds still on a middling connection', () => {
    expect(nextBitrate(look({ current: 48, lossPct: 3, goodStreak: 2 }))).toEqual({ kbps: 48, goodStreak: 0 });
  });
});

describe('playoutTargetMs', () => {
  it('holds more back as the network gets worse', () => {
    expect(playoutTargetMs(0, 10)).toBe(60);
    expect(playoutTargetMs(2, 10)).toBe(100);
    expect(playoutTargetMs(0, 80)).toBe(160);
  });
});

describe('redFirst', () => {
  it('puts the redundant voice first and keeps the rest in order', () => {
    const codecs = [{ mimeType: 'audio/opus' }, { mimeType: 'audio/red' }, { mimeType: 'audio/PCMU' }];
    expect(redFirst(codecs).map(c => c.mimeType)).toEqual(['audio/red', 'audio/opus', 'audio/PCMU']);
  });

  it('leaves a phone without it as it was', () => {
    const codecs = [{ mimeType: 'audio/opus' }, { mimeType: 'audio/PCMU' }];
    expect(redFirst(codecs).map(c => c.mimeType)).toEqual(['audio/opus', 'audio/PCMU']);
  });
});

describe('noiseReductionOn', () => {
  it('follows the speaker unless chosen', () => {
    expect(noiseReductionOn(null, false)).toBe(false);
    expect(noiseReductionOn(null, true)).toBe(true);
    expect(noiseReductionOn(true, false)).toBe(true);
    expect(noiseReductionOn(false, true)).toBe(false);
  });
});
