import { describe, expect, it } from 'vitest';
import {
  EMPTY_BOOK,
  OPEN_FOR_MS,
  WAIT_FOR_PARTS_MS,
  cleanMedia,
  cleanPlan,
  countdown,
  dueSurprise,
  isComplete,
  localDay,
  nextCheck,
  opensAt,
  partyFor,
  withMedia,
  withPlan,
  type SurpriseBook,
  type SurpriseMedia,
  type SurprisePlan
} from './surprise';

const plan = (over: Partial<SurprisePlan> = {}): SurprisePlan => ({
  id: 'sp-1',
  author: 'user',
  day: '2026-11-14',
  time: '00:00',
  title: 'Happy Birthday!',
  letter: 'Love you',
  song: true,
  photoIds: ['ph-1', 'ph-2'],
  voiceId: 'vo-1',
  updatedAt: 1,
  ...over
});
const piece = (id: string, kind: 'photo' | 'voice' = 'photo', surpriseId = 'sp-1'): SurpriseMedia => ({
  id,
  surpriseId,
  kind,
  dataUrl: kind === 'photo' ? 'data:image/jpeg;base64,AAAA' : 'data:audio/webm;base64,AAAA'
});
const full = (p = plan()): SurpriseBook =>
  [piece('ph-1'), piece('ph-2'), piece('vo-1', 'voice')].reduce(withMedia, withPlan(EMPTY_BOOK, p));
const midnight = opensAt({ day: '2026-11-14', time: '00:00' });

describe('a sealed surprise', () => {
  it('opens at its moment on this phone, not a minute before', () => {
    expect(dueSurprise(full(), 'partner', midnight - 60_000)).toBeNull();
    expect(dueSurprise(full(), 'partner', midnight)?.id).toBe('sp-1');
  });

  it('never opens on the phone of the one who planned it', () => {
    expect(dueSurprise(full(), 'user', midnight + 1000)).toBeNull();
  });

  it('opens once: not again once opened', () => {
    const book = { ...full(), opened: ['sp-1'] };
    expect(dueSurprise(book, 'partner', midnight + 1000)).toBeNull();
  });

  it('waits for pieces still on their way, then opens with what has come', () => {
    const missing = withMedia(withPlan(EMPTY_BOOK, plan()), piece('ph-1'));
    expect(isComplete(plan(), missing.media)).toBe(false);
    expect(dueSurprise(missing, 'partner', midnight + 1000)).toBeNull();
    expect(dueSurprise(missing, 'partner', midnight + WAIT_FOR_PARTS_MS)?.id).toBe('sp-1');
  });

  it('does not open by itself once a week has gone, or once called off', () => {
    expect(dueSurprise(full(), 'partner', midnight + OPEN_FOR_MS + 1)).toBeNull();
    expect(dueSurprise(full(plan({ cancelled: true })), 'partner', midnight)).toBeNull();
  });

  it('says when to look again', () => {
    expect(nextCheck(full(), 'partner', midnight - 5000)).toBe(midnight);
    const missing = withPlan(EMPTY_BOOK, plan());
    expect(nextCheck(missing, 'partner', midnight + 1000)).toBe(midnight + WAIT_FOR_PARTS_MS);
    expect(nextCheck(full(), 'partner', midnight + 1000)).toBeNull();
  });

  it('keeps the newest plan from each, and lets go of an old plan’s pieces', () => {
    const newer = plan({ id: 'sp-2', photoIds: [], voiceId: undefined, updatedAt: 2 });
    const book = withPlan(full(), newer);
    expect(book.plans.map(p => p.id)).toEqual(['sp-2']);
    expect(Object.keys(book.media)).toEqual([]);
    // An older copy arriving late changes nothing.
    expect(withPlan(withPlan(EMPTY_BOOK, plan({ updatedAt: 5 })), plan({ updatedAt: 3 })).plans[0].updatedAt).toBe(5);
  });

  it('keeps a piece that arrives before its plan', () => {
    const early = withMedia(EMPTY_BOOK, piece('ph-1'));
    expect(withPlan(early, plan()).media['ph-1']).toBeDefined();
  });
});

describe('the party in Us two', () => {
  it('is on the surprise’s day, for the one it is for', () => {
    expect(partyFor(full(), midnight + 9 * 3600_000)).toBe('partner');
    expect(partyFor(full(plan({ author: 'partner' })), midnight + 1)).toBe('user');
    expect(partyFor(full(), midnight - 1)).toBeNull();
    expect(partyFor(full(plan({ cancelled: true })), midnight + 1)).toBeNull();
  });

  it('counts days on this phone’s clock', () => {
    expect(localDay(midnight)).toBe('2026-11-14');
    expect(localDay(midnight - 1)).toBe('2026-11-13');
  });
});

describe('the countdown to its moment', () => {
  it('counts whole days, then hours, minutes and seconds', () => {
    expect(countdown(((14 * 24 + 3) * 3600 + 12 * 60 + 45) * 1000)).toEqual({ days: 14, clock: '03:12:45' });
    expect(countdown(59_000)).toEqual({ days: 0, clock: '00:00:59' });
  });

  it('rounds part of a second up, and stops at zero', () => {
    expect(countdown(1)).toEqual({ days: 0, clock: '00:00:01' });
    expect(countdown(-5_000)).toEqual({ days: 0, clock: '00:00:00' });
  });
});

describe('what arrives is checked', () => {
  it('takes a well-formed plan, its author from the record', () => {
    const p = cleanPlan({ ...plan(), author: 'partner', age: 25 }, 'user');
    expect(p?.author).toBe('user');
    expect(p?.age).toBe(25);
  });

  it('refuses a plan without a proper day, and trims what is too long', () => {
    expect(cleanPlan({ ...plan(), day: 'soon' }, 'user')).toBeNull();
    expect(cleanPlan({ ...plan(), letter: 'x'.repeat(9000) }, 'user')?.letter.length).toBe(4000);
    expect(cleanPlan({ ...plan(), age: -3 }, 'user')?.age).toBeUndefined();
  });

  it('takes only photos as photos and recordings as voice notes', () => {
    expect(cleanMedia(piece('ph-1'))?.kind).toBe('photo');
    expect(cleanMedia({ ...piece('ph-1'), dataUrl: 'data:text/html;base64,AAAA' })).toBeNull();
    expect(cleanMedia({ ...piece('vo-1', 'voice'), durationSeconds: 12 })?.durationSeconds).toBe(12);
  });
});
