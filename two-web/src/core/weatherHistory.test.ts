import { describe, expect, it } from 'vitest';
import type { EmotionalReport } from '../types';
import { WEATHER_DAYS_KEPT, cleanWeatherDays, lastDays, mergeReport, recordDay, weatherByDay } from './weatherHistory';

const held: EmotionalReport = { weather: 'CALM', capacity: 4, notAboutYouActive: false, updatedAt: 'Today' };

describe('keeping the days', () => {
  it('keeps the last weather set each day, and only the newest days', () => {
    let days = recordDay(undefined, '2026-10-01', 'SUNNY');
    days = recordDay(days, '2026-10-01', 'RAINY');
    expect(days).toEqual({ '2026-10-01': 'RAINY' });
    for (const day of lastDays(WEATHER_DAYS_KEPT + 5, new Date(2027, 1, 20))) days = recordDay(days, day, 'CALM');
    expect(Object.keys(days).length).toBe(WEATHER_DAYS_KEPT);
    expect(days['2026-10-01']).toBeUndefined();
  });

  it('takes days from the wire only as real dates and real weathers', () => {
    expect(cleanWeatherDays({ '2026-10-01': 'SUNNY', 'yesterday': 'CALM', '2026-10-02': 'HAPPY', '2026-10-03': 7 })).toEqual({ '2026-10-01': 'SUNNY' });
    expect(cleanWeatherDays(['2026-10-01'])).toBeUndefined();
    expect(cleanWeatherDays(null)).toBeUndefined();
  });
});

describe('a report from the other phone', () => {
  it("replaces the days with the author's own", () => {
    const mine = { ...held, days: { '2026-10-01': 'STORMY' as const } };
    const next = mergeReport(mine, { weather: 'SUNNY', capacity: 5, days: { '2026-10-14': 'SUNNY' } }, '2026-10-14');
    expect(next).toMatchObject({ weather: 'SUNNY', capacity: 5, days: { '2026-10-14': 'SUNNY' } });
  });

  it('counts an update from an older phone for the day it was sent, when that is known', () => {
    expect(mergeReport(held, { weather: 'RAINY' }, '2026-10-14').days).toEqual({ '2026-10-14': 'RAINY' });
    expect(mergeReport(held, { weather: 'RAINY' }, null).days).toBeUndefined();
  });

  it('takes only what a report holds, checked', () => {
    const next = mergeReport(held, { weather: 'HAPPY', capacity: 99, evil: true, updatedAt: 'x'.repeat(500) }, null);
    expect(next.weather).toBe('CALM');
    expect(next.capacity).toBe(5);
    expect(next.updatedAt.length).toBe(64);
    expect('evil' in next).toBe(false);
  });
});

describe('the days shown', () => {
  it('lists dates oldest first, ending today', () => {
    expect(lastDays(3, new Date(2026, 9, 1, 9))).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
  });

  it('carries a weather on until it changes, shows nothing before the first, and today as it is now', () => {
    const report: EmotionalReport = { ...held, weather: 'SUNNY', days: { '2026-10-02': 'RAINY', '2026-10-04': 'OVERCAST' } };
    const keys = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'];
    expect(weatherByDay(report, keys, '2026-10-06')).toEqual([null, 'RAINY', 'RAINY', 'OVERCAST', 'OVERCAST', 'SUNNY']);
  });
});
