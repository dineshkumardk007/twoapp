/**
 * Telling a dead socket from a busy one.
 *
 * A socket can stay OPEN long after the network under it has gone, so each
 * heartbeat asks whether the PING before it was answered. But a PING waits
 * its turn behind whatever is still going up: a photo or a voice note, up to
 * a megabyte on a slow line, holds it back for longer than the answer is
 * given. Taking that for dead dropped a socket that was working, and on the
 * new one the outbox sent the same megabyte again - round and round, every
 * replacement.
 *
 * So a PING only counts when nothing was waiting ahead of it, a socket still
 * sending is judged by whether its bytes are leaving, and it takes two
 * heartbeats in a row with no answer - one could be a moment's bad line.
 */

/**
 * How long an open socket gets to answer a PING before it is taken for dead
 * and replaced. The relay answers at once; this is room for a slow network,
 * and a wrong guess costs one reconnect.
 */
export const ANSWER_WITHIN_MS = 6_000;

/** Heartbeats in a row with no answer before the socket is replaced. */
export const MISSES_BEFORE_DEAD = 2;

export interface HeartbeatLook {
  /** Bytes the socket holds that have not gone yet (WebSocket.bufferedAmount). */
  buffered: number;
  /** What it held at the heartbeat before; -1 when it held nothing then. */
  bufferedBefore: number;
  /** Bytes handed to it since the heartbeat before (utf8Length of each send). */
  queuedSince: number;
  /** When the last PING went with nothing ahead of it; 0 for none. */
  pingSentAt: number;
  /** When anything last arrived on this socket. */
  lastInboundAt: number;
  /** Heartbeats in a row already gone with no answer. */
  missed: number;
  now: number;
}

/**
 * Heartbeats in a row now gone with no answer; MISSES_BEFORE_DEAD or more
 * means replace the socket.
 */
export function missedHeartbeats(h: HeartbeatLook): number {
  if (h.buffered > 0) {
    // Still sending: the PING is behind it and cannot have been answered.
    // Bytes leaving since the last heartbeat are the sign of life instead;
    // none leaving for a whole heartbeat is a socket with nothing under it.
    const leaving = h.bufferedBefore < 0 || bytesLeaving(h.buffered, h.bufferedBefore, h.queuedSince);
    return leaving ? 0 : h.missed + 1;
  }
  const unanswered =
    h.pingSentAt > 0 && h.lastInboundAt < h.pingSentAt && h.now - h.pingSentAt > ANSWER_WITHIN_MS;
  return unanswered ? h.missed + 1 : 0;
}

/**
 * Whether any bytes have gone from a socket since it was last looked at: it
 * holds less than it did then plus what it has been handed since. What it
 * holds going down is not enough on its own - a second photo handed over
 * while the first is going up adds more than has gone, and a socket working
 * hard would be taken for dead and the lot sent again on a new one.
 */
export function bytesLeaving(buffered: number, bufferedBefore: number, queuedSince: number): boolean {
  return buffered < bufferedBefore + queuedSince;
}

/**
 * Bytes a string takes as UTF-8, which is what bufferedAmount counts of a
 * text frame. Its length alone would undercount anything past plain ASCII,
 * and a socket would look stuck while it drains.
 */
export function utf8Length(s: string): number {
  let n = s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) continue;
    if (c < 0x800) {
      n += 1;
    } else if (c >= 0xd800 && c <= 0xdbff && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      // A pair of UTF-16 units is one character of four bytes.
      n += 2;
      i++;
    } else {
      n += 2;
    }
  }
  return n;
}
