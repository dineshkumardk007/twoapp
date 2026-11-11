import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_TOURS, HOMES_TOUR, HOMES_TOUR_KEY, forgetToursForTest, markTourSeen, tourSeen } from './gameTours';
import { TA } from './i18n.ta';
import { GAME_NAMES, PAPER_KINDS } from './paperGames';

describe('the first-time box for each game', () => {
  beforeEach(() => forgetToursForTest());

  it('every game has one, short and in simple lines', () => {
    for (const kind of PAPER_KINDS) {
      const lines = GAME_TOURS[kind];
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.length).toBeLessThanOrEqual(6);
      for (const line of lines) {
        expect(line.icon.length).toBeGreaterThan(0);
        expect(line.text.split(' ').length).toBeLessThanOrEqual(9);
      }
    }
  });

  it('every line, and every game name, is in Tamil too', () => {
    for (const kind of PAPER_KINDS) {
      expect(TA[GAME_NAMES[kind]], GAME_NAMES[kind]).toBeTruthy();
      for (const line of GAME_TOURS[kind]) expect(TA[line.text], line.text).toBeTruthy();
    }
    expect(TA['Got it']).toBeTruthy();
  });

  it('Cosy Homes, the puzzle for one, has one too: as short, and in Tamil', () => {
    expect(HOMES_TOUR.length).toBeGreaterThanOrEqual(2);
    expect(HOMES_TOUR.length).toBeLessThanOrEqual(6);
    for (const line of HOMES_TOUR) {
      expect(line.icon.length).toBeGreaterThan(0);
      expect(line.text.split(' ').length).toBeLessThanOrEqual(9);
      expect(TA[line.text], line.text).toBeTruthy();
    }
    expect(TA['Cosy Homes']).toBeTruthy();
    // Remembered on its own, apart from the games for two.
    expect(tourSeen(HOMES_TOUR_KEY)).toBe(false);
    markTourSeen(HOMES_TOUR_KEY);
    expect(tourSeen(HOMES_TOUR_KEY)).toBe(true);
    expect(tourSeen('puzzle')).toBe(false);
  });

  it('shows the first time only', () => {
    expect(tourSeen('carrom')).toBe(false);
    markTourSeen('carrom');
    expect(tourSeen('carrom')).toBe(true);
    forgetToursForTest(); // Two closed and opened again.
    expect(tourSeen('carrom')).toBe(true);
  });

  it('each game is remembered on its own', () => {
    markTourSeen('carrom');
    expect(tourSeen('balloon')).toBe(false);
    markTourSeen('balloon');
    expect(tourSeen('carrom')).toBe(true);
    expect(tourSeen('balloon')).toBe(true);
    expect(tourSeen('ttt')).toBe(false);
  });

  it('marking twice changes nothing', () => {
    markTourSeen('ttt');
    markTourSeen('ttt');
    expect(JSON.parse(localStorage.getItem('two_game_tours_seen')!)).toEqual(['ttt']);
  });

  it('something unreadable in storage is treated as nothing seen', () => {
    localStorage.setItem('two_game_tours_seen', '{broken');
    expect(tourSeen('four')).toBe(false);
    localStorage.setItem('two_game_tours_seen', '"four"');
    expect(tourSeen('four')).toBe(false);
    markTourSeen('four');
    expect(tourSeen('four')).toBe(true);
  });
});
