import { describe, expect, it } from 'vitest';
import {
  ANSWER_WITHIN_MS,
  MISSES_BEFORE_DEAD,
  bytesLeaving,
  missedHeartbeats,
  utf8Length,
  type HeartbeatLook
} from './heartbeat';

const NOW = 1_000_000_000;
const BEAT = 25_000;

const look = (over: Partial<HeartbeatLook> = {}): HeartbeatLook => ({
  buffered: 0,
  bufferedBefore: -1,
  queuedSince: 0,
  pingSentAt: NOW - BEAT,
  lastInboundAt: NOW - BEAT + 100,
  missed: 0,
  now: NOW,
  ...over
});

describe('missedHeartbeats', () => {
  it('counts nothing against a PING that was answered', () => {
    expect(missedHeartbeats(look())).toBe(0);
    expect(missedHeartbeats(look({ missed: 1 }))).toBe(0);
  });

  it('counts an unanswered PING, and only after it has had its time', () => {
    expect(missedHeartbeats(look({ lastInboundAt: NOW - 2 * BEAT }))).toBe(1);
    expect(missedHeartbeats(look({ pingSentAt: NOW - ANSWER_WITHIN_MS, lastInboundAt: 0 }))).toBe(0);
  });

  it('takes two unanswered heartbeats in a row before the socket is dead', () => {
    const first = missedHeartbeats(look({ lastInboundAt: NOW - 2 * BEAT }));
    expect(first).toBeLessThan(MISSES_BEFORE_DEAD);
    const second = missedHeartbeats(look({ lastInboundAt: NOW - 2 * BEAT, missed: first }));
    expect(second).toBeGreaterThanOrEqual(MISSES_BEFORE_DEAD);
  });

  it('counts nothing while a photo is still going up and its bytes are leaving', () => {
    // The PING is behind it and unanswered - that is not a dead socket.
    const unanswered = { lastInboundAt: NOW - 2 * BEAT, missed: 1 };
    expect(missedHeartbeats(look({ ...unanswered, buffered: 800_000 }))).toBe(0);
    expect(missedHeartbeats(look({ ...unanswered, buffered: 400_000, bufferedBefore: 800_000 }))).toBe(0);
  });

  it('counts a heartbeat in which nothing left a socket still holding bytes', () => {
    const stuck = look({ buffered: 600_000, bufferedBefore: 600_000 });
    expect(missedHeartbeats(stuck)).toBe(1);
    expect(missedHeartbeats({ ...stuck, missed: 1 })).toBe(MISSES_BEFORE_DEAD);
  });

  it('counts nothing while a second photo is handed over as the first goes up', () => {
    // 300k of the first went and 500k more was handed over: it holds more, and works.
    const busy = look({ buffered: 800_000, bufferedBefore: 600_000, queuedSince: 500_000, missed: 1 });
    expect(missedHeartbeats(busy)).toBe(0);
  });

  it('counts a heartbeat in which only the PING was added and nothing left', () => {
    const stuck = look({ buffered: 600_016, bufferedBefore: 600_000, queuedSince: 16 });
    expect(missedHeartbeats(stuck)).toBe(1);
  });

  it('counts nothing with no PING sent yet', () => {
    expect(missedHeartbeats(look({ pingSentAt: 0, lastInboundAt: 0 }))).toBe(0);
  });
});

describe('bytesLeaving', () => {
  it('is bytes gone, allowing for what was handed over since', () => {
    expect(bytesLeaving(400_000, 800_000, 0)).toBe(true);
    expect(bytesLeaving(900_000, 800_000, 200_000)).toBe(true);
    expect(bytesLeaving(1_000_000, 800_000, 200_000)).toBe(false);
    expect(bytesLeaving(800_000, 800_000, 0)).toBe(false);
  });
});

describe('utf8Length', () => {
  it('counts the bytes a text frame takes', () => {
    expect(utf8Length('{"type":"PING"}')).toBe(15);
    expect(utf8Length('é')).toBe(2);
    expect(utf8Length('த')).toBe(3);
    expect(utf8Length('💌')).toBe(4);
    expect(utf8Length('\ud83d')).toBe(3);
    const mixed = 'aத💌b';
    expect(utf8Length(mixed)).toBe(new TextEncoder().encode(mixed).length);
  });
});
