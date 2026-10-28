// Keeping Two connected while it is closed (the Android app's SyncService).
//
// The phone keeps one small foreground service running for as long as it is
// paired. While this page is alive and its own relay connection is on, the
// service only keeps the app alive and wakes the page. When the page is gone -
// swiped away, locked behind the PIN - a native listener takes the page's place
// on the relay as a member that cannot read anything: it is told only that a
// record arrived, its id and who wrote it, and says back "this phone has it".
// That is the partner's two grey ticks while Two is closed. Never blue: only
// the page, opened and read, can say a message was read.
//
// For that the phone keeps the room details outside the PIN vault: the room id,
// this device's id, its seat and how far it has read. Never the pairing code or
// the key - without those nothing the listener receives can be opened.
//
// Every call here is a no-op on the website and on an older Android app, which
// have none of these bridge methods.

/** What the phone says about its background connection (backgroundState). */
export interface BackgroundState {
  running: boolean;
  mode: 'off' | 'page' | 'listener' | 'waiting';
  hasRoom: boolean;
  /** Excluded from battery optimisation. */
  ignoringBattery: boolean;
  /** Restricted from running in the background in the phone's settings. */
  restricted: boolean;
  /** A brand known to close apps on its own, or '' for any other. */
  oem: 'xiaomi' | 'vivo' | 'oppo' | '';
  /** The "New message" notice switch. */
  notify: boolean;
  /** Whether the phone lets Two show notifications at all. */
  noticeAllowed: boolean;
  sdk: number;
}

/** The room details handed to the phone. Nothing in here opens a message. */
export interface RoomDetails {
  spaceId: string;
  deviceId: string;
  seat: string;
  since: number;
  sinceSeq: number;
  /** The calculator is up, or opens at launch: no notice of any kind. */
  disguised: boolean;
  /** The notice's only words, in this phone's language. */
  noticeText: string;
}

/** The answer to turning the notice on or off. */
export interface NoticeAnswer {
  on: boolean;
  granted: boolean;
  /** False when Android will no longer ask: only the phone's settings can allow it. */
  canAsk: boolean;
}

interface BackgroundBridge {
  backgroundRoomSet?: (json: string) => boolean;
  backgroundPageRelay?: (on: boolean) => void;
  backgroundRoomClear?: () => void;
  backgroundState?: () => string;
  askBatteryExemption?: () => boolean;
  openOemSettings?: () => boolean;
  backgroundNotice?: (on: boolean) => void;
  openNotificationSettings?: () => boolean;
  newMessageNotice?: () => void;
  holdAwake?: (ms: number) => void;
}

function bridge(): BackgroundBridge | null {
  try {
    return (window as unknown as { AndroidBridge?: BackgroundBridge }).AndroidBridge ?? null;
  } catch {
    return null;
  }
}

/** Calls one bridge method if this app has it; `fallback` when it does not, or it throws. */
function call<T>(name: keyof BackgroundBridge, run: (b: Required<BackgroundBridge>) => T, fallback: T): T {
  const b = bridge();
  if (!b || typeof b[name] !== 'function') return fallback;
  try {
    return run(b as Required<BackgroundBridge>);
  } catch {
    return fallback;
  }
}

/** Whether this app can keep Two connected in the background at all. */
export function backgroundAvailable(): boolean {
  const b = bridge();
  return !!b && typeof b.backgroundRoomSet === 'function';
}

/**
 * Hands the phone the room details. Built from the named fields alone, so
 * nothing else that happens to be on the object - a key, a code - can ride
 * along.
 */
export function roomSet(d: RoomDetails): void {
  const json = JSON.stringify({
    v: 1,
    spaceId: d.spaceId,
    deviceId: d.deviceId,
    seat: d.seat,
    since: d.since,
    sinceSeq: d.sinceSeq,
    disguised: d.disguised,
    noticeText: d.noticeText
  });
  call('backgroundRoomSet', b => b.backgroundRoomSet(json), false);
}

/**
 * Tells the phone whether this page's own relay connection is on. Off - locked,
 * on the PIN screen - is when the listener takes over.
 */
export function pageRelay(on: boolean): void {
  call('backgroundPageRelay', b => b.backgroundPageRelay(on), undefined);
}

/** Wipes the room details off the phone and stops the background connection. */
export function roomClear(): void {
  call('backgroundRoomClear', b => b.backgroundRoomClear(), undefined);
}

/**
 * Keeps the phone awake for a moment, while Two is in the background and has
 * something to finish: decrypting what just arrived, saying it has landed.
 */
export function holdAwake(ms: number): void {
  call('holdAwake', b => b.holdAwake(ms), undefined);
}

/** A message of hers arrived while Two is not on screen. The phone decides whether to say so. */
export function newMessageNotice(): void {
  call('newMessageNotice', b => b.newMessageNotice(), undefined);
}

const OEMS: ReadonlyArray<BackgroundState['oem']> = ['xiaomi', 'vivo', 'oppo', ''];
const MODES: ReadonlyArray<BackgroundState['mode']> = ['off', 'page', 'listener', 'waiting'];

/** What the phone says now, or null on the website, an older app, or an answer that does not parse. */
export function readBackgroundState(): BackgroundState | null {
  const raw = call('backgroundState', b => b.backgroundState(), null as string | null);
  if (typeof raw !== 'string' || !raw) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  return {
    running: parsed.running === true,
    mode: MODES.includes(parsed.mode) ? parsed.mode : 'off',
    hasRoom: parsed.hasRoom === true,
    ignoringBattery: parsed.ignoringBattery === true,
    restricted: parsed.restricted === true,
    oem: OEMS.includes(parsed.oem) ? parsed.oem : '',
    notify: parsed.notify === true,
    noticeAllowed: parsed.noticeAllowed === true,
    sdk: Number.isFinite(Number(parsed.sdk)) ? Number(parsed.sdk) : 0
  };
}

/** Asks to be left out of battery optimisation. True when the phone opened something to ask. */
export function askBatteryExemption(): boolean {
  return call('askBatteryExemption', b => b.askBatteryExemption() === true, false);
}

/** Opens this brand's Autostart or battery screen, or the app's own details. */
export function openOemSettings(): boolean {
  return call('openOemSettings', b => b.openOemSettings() === true, false);
}

/** Opens the phone's notification settings for Two. */
export function openNotificationSettings(): boolean {
  return call('openNotificationSettings', b => b.openNotificationSettings() === true, false);
}

/** The one-time cards (components/BackgroundCards). */
export type BackgroundCard = 'battery' | 'oem';

/**
 * Which one-time card to show now, if any.
 *
 * The battery question first, while the phone still optimises Two's battery.
 * A phone that already leaves Two alone has nothing to ask, which counts as
 * asked ('mark-battery'). Then, on a phone whose maker closes apps on its
 * own, the way to its Autostart screen - but on a later time Two comes on
 * screen, never straight after the battery question. Nothing without an
 * answer from the phone.
 */
export function backgroundCardToShow(
  s: BackgroundState | null,
  batteryAsked: boolean,
  oemShown: boolean,
  sameVisitAsBattery: boolean
): BackgroundCard | 'mark-battery' | null {
  if (!s) return null;
  if (!batteryAsked) return s.ignoringBattery ? 'mark-battery' : 'battery';
  if (s.oem && !oemShown && !sameVisitAsBattery) return 'oem';
  return null;
}

/** How long to wait for the phone's answer before reading where it stands instead. */
export const NOTICE_ANSWER_WAIT_MS = 60_000;

// Everyone waiting for the phone's answer: asking twice before it comes gets
// the same answer twice, rather than one of them waiting forever.
let noticeWaiters: Array<(answer: NoticeAnswer) => void> = [];
let noticeListening = false;

function answerNotice(answer: NoticeAnswer) {
  const waiters = noticeWaiters;
  noticeWaiters = [];
  waiters.forEach(done => done(answer));
}

function listenForNotice() {
  if (noticeListening) return;
  noticeListening = true;
  (window as unknown as { __twoNotice?: (reply: unknown) => void }).__twoNotice = reply => {
    let r: any = reply;
    if (typeof r === 'string') {
      try {
        r = JSON.parse(r);
      } catch {
        return;
      }
    }
    if (!r || typeof r !== 'object') return;
    answerNotice({ on: r.on === true, granted: r.granted === true, canAsk: r.canAsk !== false });
  };
}

/** Where the notice stands, read from the phone, for when it gives no answer. */
function noticeFromState(): NoticeAnswer {
  const s = readBackgroundState();
  return { on: !!s?.notify, granted: !!s?.noticeAllowed, canAsk: true };
}

/**
 * Turns the "New message" notice on or off. On is what asks Android for
 * permission to show notifications, on Android 13 and later - nothing else
 * asks for it.
 */
export function setNotice(on: boolean): Promise<NoticeAnswer> {
  const b = bridge();
  if (!b || typeof b.backgroundNotice !== 'function') {
    return Promise.resolve({ on: false, granted: false, canAsk: true });
  }
  listenForNotice();
  return new Promise(resolve => {
    let settled = false;
    const done = (answer: NoticeAnswer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(answer);
    };
    // The permission question can sit on screen for as long as she likes, and
    // an answer can go missing with the page behind it; the switch then shows
    // what the phone has stored.
    const timer = setTimeout(() => {
      noticeWaiters = noticeWaiters.filter(w => w !== done);
      done(noticeFromState());
    }, NOTICE_ANSWER_WAIT_MS);
    noticeWaiters.push(done);
    try {
      b.backgroundNotice!(on);
    } catch {
      noticeWaiters = noticeWaiters.filter(w => w !== done);
      done(noticeFromState());
    }
  });
}
