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
