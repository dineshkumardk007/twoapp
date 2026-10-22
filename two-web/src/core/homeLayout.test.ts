import { describe, expect, it } from 'vitest';
import {
  HOME_CARDS,
  cleanLayout,
  defaultLayout,
  isDefaultLayout,
  moveCard,
  readHomeLayout,
  setCardShown,
  writeHomeLayout
} from './homeLayout';

describe('arranging Home', () => {
  it('starts in the usual order, with everything shown', () => {
    const layout = readHomeLayout();
    expect(layout.order).toEqual(HOME_CARDS.map(c => c.id));
    expect(layout.hidden).toEqual([]);
    expect(isDefaultLayout(layout)).toBe(true);
  });

  it('moves a card up or down, and not past either end', () => {
    const start = defaultLayout();
    const down = moveCard(start, 'ourDays', 1);
    expect(down.order.slice(0, 2)).toEqual(['comingUp', 'ourDays']);
    expect(moveCard(start, 'ourDays', -1)).toBe(start);
    expect(moveCard(start, 'milestones', 1)).toBe(start);
  });

  it('switches cards off and on', () => {
    const off = setCardShown(defaultLayout(), 'quote', false);
    expect(off.hidden).toEqual(['quote']);
    expect(setCardShown(off, 'quote', true).hidden).toEqual([]);
  });

  it('keeps what was arranged, and forgets it when it is the usual order again', () => {
    writeHomeLayout(setCardShown(moveCard(defaultLayout(), 'weather', -1), 'kural', false));
    const kept = readHomeLayout();
    expect(kept.order.slice(0, 4)).toEqual(['ourDays', 'comingUp', 'weather', 'kural']);
    expect(kept.hidden).toEqual(['kural']);
    writeHomeLayout(defaultLayout());
    expect(localStorage.getItem('two_home_layout_v1')).toBeNull();
  });

  it('drops what is not a card, and puts a card it never knew after the one it follows', () => {
    const layout = cleanLayout({
      order: ['milestones', 'quote', 'nonsense', 'quote', 7, 'ourDays'],
      hidden: ['quote', 'nonsense']
    });
    expect(layout.order.length).toBe(HOME_CARDS.length);
    expect(layout.order.slice(0, 3)).toEqual(['milestones', 'quote', 'ourDays']);
    // Coming up, which a Home arranged before it existed never mentions, goes
    // in after Our days, where it is by default; the kural after it.
    expect(layout.order.indexOf('comingUp')).toBe(layout.order.indexOf('ourDays') + 1);
    expect(layout.order.indexOf('kural')).toBe(layout.order.indexOf('comingUp') + 1);
    expect(layout.hidden).toEqual(['quote']);
    expect(cleanLayout('garbage').order).toEqual(defaultLayout().order);
  });
});
