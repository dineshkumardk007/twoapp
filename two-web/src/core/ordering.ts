// Where a message belongs in a conversation.
//
// Both chats used to append whatever arrived, which is right until something
// arrives late. A message sent while the relay was asleep sits in the outbox
// until the socket comes back, and is then delivered after everything said in
// the meantime - so the other side appended an eight o'clock message below a
// five-past-eight one, with both times on screen to show it. On a relay that
// sleeps after fifteen minutes idle, sending into a closed socket is the
// ordinary case rather than the rare one.

/** Anything with a moment it was sent. Both chats' messages qualify. */
interface Sent {
  sentAt?: number;
}

/**
 * Returns the list with `incoming` at the position its `sentAt` earns.
 *
 * Walks back from the end rather than sorting, because the end is where all
 * but the late arrivals belong: the usual call compares once and appends. It
 * also means an existing order is never rearranged, only inserted into.
 *
 * Two rules keep it from doing harm to a history it cannot fully read:
 *
 * - A message with no `sentAt` is appended. The couple's chat has carried an
 *   optional one since before any of this, so early messages have nothing to
 *   compare and guessing a position for them would be worse than the end.
 * - The walk stops at any message that has no `sentAt`, rather than stepping
 *   over it. Moving a new message above something undateable would reorder a
 *   conversation on no evidence at all.
 *
 * Equal moments keep the order they arrived in - the walk stops on `<=`, so a
 * tie leaves the earlier arrival first.
 */
export function insertBySentAt<T extends Sent>(list: T[], incoming: T): T[] {
  const at = incoming.sentAt;
  if (!at) return [...list, incoming];

  let i = list.length;
  while (i > 0) {
    const prev = list[i - 1].sentAt;
    if (prev === undefined || prev <= at) break;
    i--;
  }

  if (i === list.length) return [...list, incoming];
  return [...list.slice(0, i), incoming, ...list.slice(i)];
}
