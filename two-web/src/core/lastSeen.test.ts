import { describe, expect, it } from 'vitest';
import {
  HERE_TTL_MS,
  LAST_SEEN_OFF_AFTER_MS,
  LEGACY_HERE_MS,
  isLegacyBeat,
  onScreenUntil,
  presenceBeat,
  type PartnerPresence
} from './lastSeen';

const NOW = new Date(2026, 9, 26, 21, 0, 0, 0).getTime();

/** Her phone on this version, with nothing heard from it yet. */
const updated = (over: Partial<PartnerPresence> = {}): PartnerPresence => ({
  relayPeers: 1,
  devices: {},
  partnerSaysAway: true,
  legacyBeatAt: 0,
  now: NOW,
  ...over
});

/** Her phone on the version before: no signals, no capability. */
const before = (over: Partial<PartnerPresence> = {}): PartnerPresence =>
  updated({ partnerSaysAway: false, ...over });

const online = (p: PartnerPresence) => onScreenUntil(p) > 0;

describe('online, for a phone that says when it leaves', () => {
  it('is online for a fresh here, until it runs out', () => {
    const p = updated({ devices: { phone: { at: NOW - 10_000, here: true } } });
    expect(online(p)).toBe(true);
    expect(onScreenUntil(p)).toBe(NOW - 10_000 + HERE_TTL_MS);
  });

  it('runs out after the TTL with nothing more heard', () => {
    expect(online(updated({ devices: { phone: { at: NOW - HERE_TTL_MS + 1, here: true } } }))).toBe(true);
    expect(online(updated({ devices: { phone: { at: NOW - HERE_TTL_MS, here: true } } }))).toBe(false);
  });

  it('is away the moment it says away', () => {
    expect(online(updated({ devices: { phone: { at: NOW - 1_000, here: false } } }))).toBe(false);
  });

  it('is not kept online by a stale here on another device', () => {
    const p = updated({
      devices: {
        laptop: { at: NOW - HERE_TTL_MS - 5_000, here: true },
        phone: { at: NOW - 1_000, here: false }
      }
    });
    expect(online(p)).toBe(false);
  });

  it('is online while any one device says here', () => {
    const p = updated({
      devices: {
        laptop: { at: NOW - 2_000, here: false },
        phone: { at: NOW - 20_000, here: true }
      }
    });
    expect(online(p)).toBe(true);
  });

  it('runs until the latest here among her devices', () => {
    const p = updated({
      devices: {
        laptop: { at: NOW - 50_000, here: true },
        phone: { at: NOW - 5_000, here: true }
      }
    });
    expect(onScreenUntil(p)).toBe(NOW - 5_000 + HERE_TTL_MS);
  });

  it('takes silence for away once her phone has said it can', () => {
    expect(online(updated())).toBe(false);
  });

  it('goes by her signals before her phone has said it can, and ignores beats then', () => {
    const p = before({ devices: { phone: { at: NOW - 1_000, here: false } }, legacyBeatAt: NOW - 10_000 });
    expect(online(p)).toBe(false);
  });

  it('is never online with no socket of hers on the relay', () => {
    expect(online(updated({ relayPeers: 0, devices: { phone: { at: NOW, here: true } } }))).toBe(false);
    expect(online(before({ relayPeers: 0 }))).toBe(false);
    expect(online(before({ relayPeers: 0, legacyBeatAt: NOW }))).toBe(false);
  });
});

describe('online, for a phone on the version before', () => {
  it('is online while her last beat is fresh', () => {
    const p = before({ legacyBeatAt: NOW - LEGACY_HERE_MS + 1 });
    expect(online(p)).toBe(true);
    expect(onScreenUntil(p)).toBe(NOW + 1);
  });

  it('is away once the beats have stopped for longer than one and a bit', () => {
    expect(online(before({ legacyBeatAt: NOW - LEGACY_HERE_MS }))).toBe(false);
    expect(online(before({ legacyBeatAt: NOW - 60 * 60_000 }))).toBe(false);
  });

  it('goes by her socket alone when she sends no beats', () => {
    expect(onScreenUntil(before())).toBe(Infinity);
  });

  it('goes by her socket alone when her beat is stamped well ahead of this clock', () => {
    expect(onScreenUntil(before({ legacyBeatAt: NOW + 10 * 60_000 }))).toBe(Infinity);
    expect(online(before({ legacyBeatAt: NOW + 30_000 }))).toBe(true);
  });
});

describe('online, for a phone on the version before, since her socket came up', () => {
  it('goes by a beat heard since', () => {
    const p = before({ upSince: NOW - 10 * 60_000, legacyBeatAt: NOW - 30_000 });
    expect(onScreenUntil(p)).toBe(NOW - 30_000 + LEGACY_HERE_MS);
  });

  it('is away once the beats heard since have stopped', () => {
    expect(online(before({ upSince: NOW - 10 * 60_000, legacyBeatAt: NOW - LEGACY_HERE_MS }))).toBe(false);
  });

  it('goes by the beat from before while it is still fresh', () => {
    const up = { upSince: NOW - 60_000, legacyBeatAt: NOW - 5 * 60_000 };
    expect(online(before({ ...up, earlierBeatAt: NOW - 60_000 }))).toBe(true);
    expect(online(before({ ...up, earlierBeatAt: NOW - 3 * 86_400_000 }))).toBe(false);
  });

  it('is away with Two in the background there, however long her socket has been up', () => {
    // Last seen on: she beat a while ago, and her phone holds its socket since.
    const hours = { upSince: NOW - 6 * 60 * 60_000, earlierBeatAt: NOW - 2 * 60 * 60_000 };
    expect(onScreenUntil(before(hours))).toBe(0);
    expect(onScreenUntil(before({ ...hours, legacyBeatAt: NOW - 3 * 60 * 60_000 }))).toBe(0);
    // A socket of ours just back: silence since then says nothing new.
    expect(onScreenUntil(before({ upSince: NOW - 10 * 60_000, legacyBeatAt: NOW - LEGACY_HERE_MS - 2 }))).toBe(0);
    // Not even with her newest beat close to a day old.
    expect(onScreenUntil(before({ upSince: NOW - 2 * LEGACY_HERE_MS, earlierBeatAt: NOW - LAST_SEEN_OFF_AFTER_MS }))).toBe(0);
  });

  it('goes by her socket once her newest beat is over a day old and she has had time to beat - last seen is off there', () => {
    const stale = NOW - LAST_SEEN_OFF_AFTER_MS - 1;
    expect(onScreenUntil(before({ upSince: NOW - LEGACY_HERE_MS, earlierBeatAt: stale }))).toBe(Infinity);
    expect(onScreenUntil(before({ upSince: NOW - LEGACY_HERE_MS, legacyBeatAt: stale }))).toBe(Infinity);
    // Not before she has had time to beat, nor with no word of when she came up.
    expect(onScreenUntil(before({ upSince: NOW - LEGACY_HERE_MS + 1, earlierBeatAt: stale }))).toBe(0);
    expect(onScreenUntil(before({ earlierBeatAt: stale }))).toBe(0);
  });

  it('goes by her socket when no beat from her has ever been heard', () => {
    expect(onScreenUntil(before({ upSince: NOW - 1_000 }))).toBe(Infinity);
  });
});

describe('online, for a phone on the version before in a seat that says away', () => {
  it('counts a fresh beat when none of her devices has said anything', () => {
    const p = updated({ legacyBeatAt: NOW - 20_000 });
    expect(onScreenUntil(p)).toBe(NOW - 20_000 + LEGACY_HERE_MS);
  });

  it('counts a fresh beat beside a device that said away long before it', () => {
    const p = updated({
      devices: { laptop: { at: NOW - 60 * 60_000, here: false } },
      legacyBeatAt: NOW - 20_000
    });
    expect(online(p)).toBe(true);
  });

  it('does not count a beat one of her devices said away about then - it may be that one leaving', () => {
    const left = NOW - HERE_TTL_MS - 30_000;
    const p = updated({ devices: { phone: { at: left, here: false } }, legacyBeatAt: left });
    expect(online(p)).toBe(false);
  });

  it('does not count a stale beat, or one from before her socket came up', () => {
    expect(online(updated({ legacyBeatAt: NOW - LEGACY_HERE_MS }))).toBe(false);
    expect(online(updated({ upSince: NOW - 10_000, legacyBeatAt: NOW - 20_000 }))).toBe(false);
  });
});

describe('presence beats', () => {
  it('tells the version before from this one, whose beats include the one sent on leaving', () => {
    expect(isLegacyBeat({ at: NOW })).toBe(true);
    expect(isLegacyBeat(presenceBeat(NOW))).toBe(false);
    expect(presenceBeat(NOW).at).toBe(NOW);
  });
});
