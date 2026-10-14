import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateWidget, takeLaunchAction, resetWidgetForTests, WidgetSummary } from './widget';

const summary: WidgetSummary = {
  partner: 'Priya',
  since: '2022-02-14',
  annivDate: '2027-02-14',
  annivYears: 5,
  unread: 3,
  lastMessageAt: 1_760_000_000_000,
  weather: 'CALM',
  capacity: 4,
  myWeather: 'SUNNY',
  myCapacity: 5,
  online: false,
  lastSeenAt: 1_760_000_100_000
};

function phone(action = '') {
  const bridge = { widgetUpdate: vi.fn(), takeLaunchAction: vi.fn(() => action) };
  (globalThis as unknown as { AndroidBridge: typeof bridge }).AndroidBridge = bridge;
  return bridge;
}

beforeEach(() => resetWidgetForTests());

describe('The home-screen widget', () => {
  it('does nothing on the website', () => {
    expect(() => updateWidget(summary)).not.toThrow();
    expect(takeLaunchAction()).toBeNull();
  });

  it('sends the summary when it changes, and only then', () => {
    const b = phone();
    updateWidget(summary);
    updateWidget({ ...summary });
    expect(b.widgetUpdate).toHaveBeenCalledTimes(1);
    expect(JSON.parse(b.widgetUpdate.mock.calls[0][0])).toEqual(summary);
    updateWidget({ ...summary, unread: 4 });
    expect(b.widgetUpdate).toHaveBeenCalledTimes(2);
  });

  it('never carries message words', () => {
    const b = phone();
    updateWidget(summary);
    const sent = JSON.parse(b.widgetUpdate.mock.calls[0][0]);
    expect(Object.keys(sent).sort()).toEqual(
      ['annivDate', 'annivYears', 'capacity', 'lastMessageAt', 'lastSeenAt', 'myCapacity', 'myWeather', 'online', 'partner', 'since', 'unread', 'weather']
    );
  });

  it('clears the widget when the space is left', () => {
    const b = phone();
    updateWidget(summary);
    updateWidget(null);
    expect(b.widgetUpdate).toHaveBeenLastCalledWith('{}');
  });

  it('opens on what the widget asked for, and nothing else', () => {
    phone('chat');
    expect(takeLaunchAction()).toBe('chat');
    phone('heartbeat');
    expect(takeLaunchAction()).toBe('heartbeat');
    phone('settings');
    expect(takeLaunchAction()).toBeNull();
  });
});
