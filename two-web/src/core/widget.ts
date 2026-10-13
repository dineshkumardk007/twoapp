// The home-screen widget (Android: TwoWidget.kt and its pop-up).
//
// The widget can't open the vault, so the page hands it a small summary
// whenever any of it changes while Two is open: names, dates, a count and a
// few times - never a word of any message. The widget shows it as of the last
// time Two was open, and says when that was.
//
// The other way round, the widget opens Two to do something: 'chat' or
// 'heartbeat'. The phone holds that until the page asks for it - which the
// page does only once it is unlocked and linked.

export interface WidgetSummary {
  /** The partner's name as this phone knows it. */
  partner: string;
  /** 'YYYY-MM-DD' the story began; the widget counts the days itself. */
  since?: string;
  /** 'YYYY-MM-DD' of the next anniversary, and which one it is. */
  annivDate?: string;
  annivYears?: number;
  /** Messages from the partner this phone has not read. */
  unread: number;
  /** When the newest of them came, epoch ms. */
  lastMessageAt?: number;
  /** How the partner is: their emotional weather, and capacity 0..5. */
  weather?: string;
  capacity?: number;
  /** In Two right now, as of the last update. */
  online: boolean;
  /** Last seen, epoch ms - only when they share it. */
  lastSeenAt?: number;
}

export type LaunchAction = 'chat' | 'heartbeat';

type Bridge = {
  widgetUpdate?: (json: string) => void;
  takeLaunchAction?: () => string;
};

function bridge(): Bridge | null {
  return ((globalThis as unknown as { AndroidBridge?: Bridge }).AndroidBridge) ?? null;
}

let lastSent = '';

/** Hands the widget its summary, when it changed. Null clears it (unpaired, wiped). */
export function updateWidget(summary: WidgetSummary | null) {
  const b = bridge();
  if (!b?.widgetUpdate) return;
  const json = summary ? JSON.stringify(summary) : '{}';
  if (json === lastSent) return;
  lastSent = json;
  try {
    b.widgetUpdate(json);
  } catch {
    lastSent = '';
  }
}

/** What the widget opened Two to do, asked once; null when nothing. */
export function takeLaunchAction(): LaunchAction | null {
  try {
    const action = bridge()?.takeLaunchAction?.();
    return action === 'chat' || action === 'heartbeat' ? action : null;
  } catch {
    return null;
  }
}

/** A weather word as the widget shows it: 'overcast' -> 'Overcast'. */
export function weatherLabel(weather: string | undefined): string | undefined {
  if (!weather) return undefined;
  return weather.charAt(0).toUpperCase() + weather.slice(1);
}

/** For tests: forget what was last sent. */
export function resetWidgetForTests() {
  lastSent = '';
}
