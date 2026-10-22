import { useEffect, useState } from 'react';
import { localDateKey } from './ourDates';

/**
 * Today's date on this phone, as 'YYYY-MM-DD', kept current.
 *
 * Checked once a minute and whenever the app comes back into view, so a
 * screen left open overnight - or a phone woken the next morning - moves to
 * the new day without needing to be touched.
 */
export function useToday(): string {
  const [today, setToday] = useState(localDateKey);
  useEffect(() => {
    const check = () => setToday(localDateKey());
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}

/** The longest a timer can be set for; past it, the wait is taken again on waking. */
const LONGEST_TIMER_MS = 2 ** 31 - 1;

/**
 * This phone's time, looked at again when `next` comes and whenever the app
 * comes back into view - so something set to begin or end at a moment (a
 * status, a message set for later) changes on the screen then, without
 * waiting for something else to redraw it.
 */
export function useNowAt(next: number | undefined): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const check = () => setNow(Date.now());
    document.addEventListener('visibilitychange', check);
    const timer =
      next === undefined ? undefined : window.setTimeout(check, Math.min(Math.max(0, next - Date.now()) + 50, LONGEST_TIMER_MS));
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [next]);
  return now;
}
