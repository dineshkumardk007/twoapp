import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NOTICE_ANSWER_WAIT_MS,
  askBatteryExemption,
  backgroundAvailable,
  backgroundCardToShow,
  holdAwake,
  newMessageNotice,
  openNotificationSettings,
  openOemSettings,
  pageRelay,
  readBackgroundState,
  roomClear,
  roomSet,
  setNotice,
  type BackgroundState
} from './background';

type Answer = { on: boolean; granted: boolean; canAsk: boolean };
const answer = (a: unknown) => (globalThis as unknown as { __twoNotice: (a: unknown) => void }).__twoNotice(a);

const STATE: BackgroundState = {
  running: true,
  mode: 'page',
  hasRoom: true,
  ignoringBattery: false,
  restricted: false,
  oem: 'xiaomi',
  notify: false,
  noticeAllowed: false,
  sdk: 34
};

/** A phone with the background connection, answering the notice switch with the next of `answers`. */
function phoneWith(state: Partial<BackgroundState> = {}, answers: Answer[] = []) {
  const bridge = {
    backgroundRoomSet: vi.fn((_json: string) => true),
    backgroundPageRelay: vi.fn(),
    backgroundRoomClear: vi.fn(),
    backgroundState: vi.fn(() => JSON.stringify({ ...STATE, ...state })),
    askBatteryExemption: vi.fn(() => true),
    openOemSettings: vi.fn(() => true),
    openNotificationSettings: vi.fn(() => true),
    newMessageNotice: vi.fn(),
    holdAwake: vi.fn(),
    backgroundNotice: vi.fn((_on: boolean) => {
      const next = answers.shift();
      if (next) queueMicrotask(() => answer(next));
    })
  };
  (globalThis as unknown as { AndroidBridge: typeof bridge }).AndroidBridge = bridge;
  return bridge;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('on the website, or an older app', () => {
  it('does nothing and says nothing', async () => {
    expect(backgroundAvailable()).toBe(false);
    expect(readBackgroundState()).toBeNull();
    expect(askBatteryExemption()).toBe(false);
    expect(openOemSettings()).toBe(false);
    expect(openNotificationSettings()).toBe(false);
    roomSet({ spaceId: 'ab', deviceId: 'd', seat: 'user', since: 1, sinceSeq: 1, disguised: false, noticeText: 'New message' });
    pageRelay(true);
    roomClear();
    holdAwake(5000);
    newMessageNotice();
    expect(await setNotice(true)).toEqual({ on: false, granted: false, canAsk: true });
  });

  it('an app with only some of the methods is not taken for one that has them', () => {
    (globalThis as unknown as { AndroidBridge: object }).AndroidBridge = { isAndroid: () => true, backgroundState: 7 };
    expect(backgroundAvailable()).toBe(false);
    expect(readBackgroundState()).toBeNull();
  });

  it('a method that throws is a no-op, not a crash', () => {
    (globalThis as unknown as { AndroidBridge: object }).AndroidBridge = {
      backgroundRoomSet: () => {
        throw new Error('gone');
      },
      backgroundState: () => {
        throw new Error('gone');
      }
    };
    expect(() =>
      roomSet({ spaceId: 'ab', deviceId: 'd', seat: 'user', since: 1, sinceSeq: 1, disguised: false, noticeText: 'x' })
    ).not.toThrow();
    expect(readBackgroundState()).toBeNull();
  });
});

describe('the room details handed to the phone', () => {
  it('are the named fields alone, whatever else rides on the object', () => {
    const bridge = phoneWith();
    const withExtras = {
      spaceId: 'ab12',
      deviceId: 'dev',
      seat: 'user',
      since: 1_730_000_000_000,
      sinceSeq: 4211,
      disguised: true,
      noticeText: 'New message',
      key: 'the key',
      code: 'ABCD-EFGH-JKMN'
    };
    roomSet(withExtras);
    const sent = JSON.parse(bridge.backgroundRoomSet.mock.calls[0][0]);
    expect(sent).toEqual({
      v: 1,
      spaceId: 'ab12',
      deviceId: 'dev',
      seat: 'user',
      since: 1_730_000_000_000,
      sinceSeq: 4211,
      disguised: true,
      noticeText: 'New message'
    });
  });

  it('the relay on and off, the wipe, a moment awake and the notice report reach the phone', () => {
    const bridge = phoneWith();
    pageRelay(false);
    pageRelay(true);
    roomClear();
    holdAwake(5000);
    newMessageNotice();
    expect(bridge.backgroundPageRelay.mock.calls).toEqual([[false], [true]]);
    expect(bridge.backgroundRoomClear).toHaveBeenCalledTimes(1);
    expect(bridge.holdAwake).toHaveBeenCalledWith(5000);
    expect(bridge.newMessageNotice).toHaveBeenCalledTimes(1);
  });
});

describe("the phone's state", () => {
  it('is read as the phone said it', () => {
    phoneWith({ mode: 'listener', ignoringBattery: true, oem: 'vivo', notify: true, noticeAllowed: true, sdk: 35 });
    expect(readBackgroundState()).toEqual({
      ...STATE,
      mode: 'listener',
      ignoringBattery: true,
      oem: 'vivo',
      notify: true,
      noticeAllowed: true,
      sdk: 35
    });
  });

  it('anything unknown reads as the safe answer', () => {
    const bridge = phoneWith();
    bridge.backgroundState.mockReturnValue(JSON.stringify({ mode: 'turbo', oem: 'nokia', notify: 'yes', sdk: 'new' }));
    expect(readBackgroundState()).toMatchObject({ mode: 'off', oem: '', notify: false, sdk: 0, ignoringBattery: false });
    bridge.backgroundState.mockReturnValue('not json');
    expect(readBackgroundState()).toBeNull();
  });
});

describe('the New message switch', () => {
  it('answers with what the phone said', async () => {
    const bridge = phoneWith({}, [
      { on: true, granted: true, canAsk: true },
      { on: false, granted: true, canAsk: true }
    ]);
    expect(await setNotice(true)).toEqual({ on: true, granted: true, canAsk: true });
    expect(await setNotice(false)).toEqual({ on: false, granted: true, canAsk: true });
    expect(bridge.backgroundNotice.mock.calls).toEqual([[true], [false]]);
  });

  it('says when Android will no longer ask', async () => {
    phoneWith({}, [{ on: false, granted: false, canAsk: false }]);
    expect(await setNotice(true)).toEqual({ on: false, granted: false, canAsk: false });
  });

  it('two asked before the answer both get it', async () => {
    phoneWith();
    const first = setNotice(true);
    const second = setNotice(true);
    answer({ on: true, granted: true, canAsk: true });
    expect(await first).toEqual({ on: true, granted: true, canAsk: true });
    expect(await second).toEqual({ on: true, granted: true, canAsk: true });
  });

  it('with no answer, reads where the phone stands after a minute', async () => {
    vi.useFakeTimers();
    phoneWith({ notify: true, noticeAllowed: true });
    const pending = setNotice(true);
    vi.advanceTimersByTime(NOTICE_ANSWER_WAIT_MS);
    expect(await pending).toEqual({ on: true, granted: true, canAsk: true });
    // A late answer goes nowhere.
    expect(() => answer({ on: false, granted: false, canAsk: false })).not.toThrow();
  });

  it('ignores an answer that is not one', async () => {
    phoneWith();
    const pending = setNotice(true);
    answer('not json');
    answer(null);
    answer(JSON.stringify({ on: true, granted: true, canAsk: true }));
    expect(await pending).toEqual({ on: true, granted: true, canAsk: true });
  });
});

describe('the one-time cards', () => {
  const s = (over: Partial<BackgroundState> = {}): BackgroundState => ({ ...STATE, ...over });

  it('asks about the battery first, and only while the phone still optimises Two', () => {
    expect(backgroundCardToShow(s(), false, false, false)).toBe('battery');
    expect(backgroundCardToShow(s({ ignoringBattery: true }), false, false, false)).toBe('mark-battery');
  });

  it("points to the brand's own screen on a later visit, once", () => {
    expect(backgroundCardToShow(s(), true, false, true)).toBeNull();
    expect(backgroundCardToShow(s(), true, false, false)).toBe('oem');
    expect(backgroundCardToShow(s(), true, true, false)).toBeNull();
    expect(backgroundCardToShow(s({ oem: '' }), true, false, false)).toBeNull();
  });

  it('shows nothing without an answer from the phone', () => {
    expect(backgroundCardToShow(null, false, false, false)).toBeNull();
  });
});
