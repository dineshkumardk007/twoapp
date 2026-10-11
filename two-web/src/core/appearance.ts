// Night or day: which version of the Aurora look this phone shows.
//
// Night is Aurora itself and the default. Day is its lighter version, and
// "match phone" follows the phone's own dark mode. The class is set on <html>
// before the first paint by a line in index.html, so the app never flashes the
// wrong colours on the way in; this module keeps it right afterwards.

export type Appearance = 'night' | 'day' | 'system';

const KEY = 'two_appearance_v1';

export const APPEARANCE_CHOICES: { value: Appearance; label: string; hint: string }[] = [
  { value: 'night', label: 'Night', hint: 'The Aurora sky' },
  { value: 'day', label: 'Day', hint: 'Lavender and light' },
  { value: 'system', label: 'Match phone', hint: "Follows your phone's dark mode" }
];

/** The status bar colours of the sky each look paints behind them. */
const BAR_COLOUR = { night: '#0E0B1F', day: '#F7F5FF' };

export function readAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === 'day' || raw === 'system' ? raw : 'night';
  } catch {
    return 'night';
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

/** Whether a choice comes out dark right now. */
export function isNight(appearance: Appearance = readAppearance()): boolean {
  if (appearance === 'night') return true;
  if (appearance === 'day') return false;
  return prefersDark();
}

/** Paints the page in a choice: the class, the browser's bar colour, and the phone's status bar icons. */
export function applyAppearance(appearance: Appearance = readAppearance()) {
  const night = isNight(appearance);
  document.documentElement.classList.toggle('dark', night);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', night ? BAR_COLOUR.night : BAR_COLOUR.day);
  try {
    // Light icons on the night sky, dark icons on the day one.
    const bridge = (window as unknown as { AndroidBridge?: { setBarsLight?: (light: boolean) => void } }).AndroidBridge;
    bridge?.setBarsLight?.(!night);
  } catch {
    /* an older app keeps the bars it started with */
  }
}

export function writeAppearance(appearance: Appearance) {
  try {
    localStorage.setItem(KEY, appearance);
  } catch {
    /* private mode: this run keeps it */
  }
  applyAppearance(appearance);
}

/** Keeps "match phone" in step when the phone switches between light and dark. */
export function watchPhoneAppearance(): () => void {
  try {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readAppearance() === 'system') applyAppearance('system');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  } catch {
    return () => {};
  }
}
