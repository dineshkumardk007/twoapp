import { describe, it, expect } from 'vitest';
import { DAILY_QUESTIONS, questionForDay, questionById } from './questions';

/** Consecutive days from `start`, as 'YYYY-MM-DD'. */
function days(start: string, count: number): string[] {
  const [y, m, d] = start.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}

const everyday = DAILY_QUESTIONS.filter(q => q.tier !== 'spicy');
const spicy = DAILY_QUESTIONS.filter(q => q.tier === 'spicy');

describe("Today's question", () => {
  it('is the same on both phones for the same day', () => {
    expect(questionForDay('2026-10-12').id).toBe(questionForDay('2026-10-12').id);
    expect(questionForDay('2026-10-12', true).id).toBe(questionForDay('2026-10-12', true).id);
  });

  it('asks every everyday question once before any comes back', () => {
    const ids = days('2026-01-01', everyday.length).map(day => questionForDay(day).id);
    expect(new Set(ids).size).toBe(everyday.length);
  });

  it('asks every spicy question once before any comes back', () => {
    const ids = days('2026-01-01', spicy.length).map(day => questionForDay(day, true).id);
    expect(new Set(ids).size).toBe(spicy.length);
  });

  it('keeps the spicy one separate from the everyday one', () => {
    for (const day of days('2026-10-01', 60)) {
      expect(questionForDay(day).tier).not.toBe('spicy');
      expect(questionForDay(day, true).tier).toBe('spicy');
    }
  });

  it('does not bring the same question back on the same date next month', () => {
    expect(questionForDay('2026-10-12').id).not.toBe(questionForDay('2026-11-12').id);
  });
});

describe('The question library', () => {
  it('has a unique id for every question', () => {
    const ids = DAILY_QUESTIONS.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no empty prompts', () => {
    for (const q of DAILY_QUESTIONS) expect(q.prompt.trim().length).toBeGreaterThan(10);
  });

  it('finds an answered question again by its id, and nothing for an unknown one', () => {
    expect(questionById('p-1')?.tier).toBe('playful');
    expect(questionById('zz-99')).toBeUndefined();
  });
});
