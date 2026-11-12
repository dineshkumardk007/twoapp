import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MAZE_TOUR, MAZE_TOUR_KEY, markTourSeen, tourSeen } from '../core/gameTours';
import { TA } from '../core/i18n.ta';
import { MAZE_SIGNS, mazeOf } from '../core/twoHearts';
import { HEARTS_NAME, HeartsIcon, MazeBoard } from './TwoHearts';

// The maze drawn once, as it stands at several points: nothing here checks
// how it looks, only that it can be drawn at all, and that what should be on
// it is.

const draw = (level: number, pos?: [number, number], got = 0, signs: [number | null, number | null] = [null, null], shut: number | null = null) => {
  const maze = mazeOf(level);
  return renderToString(<MazeBoard maze={maze} pos={pos ?? maze.start} got={got} signs={signs} shut={shut} stuck={null} />);
};

describe('the maze of Two Hearts can be drawn', () => {
  it('every size, at the start: both of you, both homes, every door shut, every button, three hearts', () => {
    for (const level of [1, 4, 13, 25, 41, 81, 151]) {
      const maze = mazeOf(level);
      const html = draw(level);
      expect(html.match(/class="th-who"/g)?.length).toBe(2);
      expect(html.match(/class="th-home"/g)?.length).toBe(2);
      expect(html.match(/class="th-door"/g)?.length).toBe(maze.doors.length);
      expect(html.match(/class="th-plate"/g)?.length).toBe(maze.doors.length);
      expect(html.match(/class="th-heart"/g)?.length).toBe(3);
      expect(html).not.toContain('data-open');
      expect(html).not.toContain('data-in');
      expect(html).toContain(`--w:${maze.w}`);
      expect(html).toContain(`--h:${maze.h}`);
    }
  });

  it('a door shows open while either of you is on its button', () => {
    const maze = mazeOf(30);
    const plate = maze.doors[1].plate;
    for (const pos of [
      [plate, maze.start[1]],
      [maze.start[0], plate]
    ] as Array<[number, number]>) {
      const html = draw(30, pos);
      expect(html.match(/data-open="true"/g)?.length).toBe(1);
      expect(html.match(/data-down="true"/g)?.length).toBe(1);
    }
  });

  it('hearts picked up are gone, and one of you at home shows it', () => {
    const maze = mazeOf(5);
    expect(draw(5, undefined, 5).match(/class="th-heart"/g)?.length).toBe(1);
    expect(draw(5, undefined, 7)).not.toContain('th-heart');
    const html = draw(5, [maze.home[0], maze.start[1]]);
    expect(html.match(/data-in="true"/g)?.length).toBe(1);
    expect(draw(5, maze.home).match(/data-in="true"/g)?.length).toBe(2);
  });

  it('the two on one square stand side by side; a sign shows over whoever made it; a shut door walked into is marked', () => {
    const maze = mazeOf(2);
    const html = draw(2, [maze.start[0], maze.start[0]], 0, [2, null], 0);
    expect(html).toContain('data-side="0"');
    expect(html).toContain('data-side="1"');
    expect(html).toContain(MAZE_SIGNS[2]);
    expect(html.match(/class="th-sign"/g)?.length).toBe(1);
    expect(html.match(/data-shut="true"/g)?.length).toBe(1);
    expect(draw(2)).not.toContain('data-side');
  });

  it('the picture for its card', () => {
    expect(renderToString(<HeartsIcon />)).toContain('g-icon');
  });
});

describe('the first-time box for Two Hearts', () => {
  it('is as short as the others, in Tamil too, and remembered on its own', () => {
    expect(MAZE_TOUR.length).toBeGreaterThanOrEqual(2);
    expect(MAZE_TOUR.length).toBeLessThanOrEqual(6);
    for (const line of MAZE_TOUR) {
      expect(line.icon.length).toBeGreaterThan(0);
      expect(line.text.split(' ').length).toBeLessThanOrEqual(9);
      expect(TA[line.text], line.text).toBeTruthy();
    }
    expect(TA[HEARTS_NAME]).toBeTruthy();
    expect(tourSeen(MAZE_TOUR_KEY)).toBe(false);
    markTourSeen(MAZE_TOUR_KEY);
    expect(tourSeen(MAZE_TOUR_KEY)).toBe(true);
    expect(tourSeen('homes')).toBe(false);
  });
});
