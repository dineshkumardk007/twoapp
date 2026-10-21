import { describe, expect, it } from 'vitest';
import { ComfortBoxData } from '../types';
import { comfortBoxId, comfortBoxesFor, hasComfort, withBox } from './comfortBox';

const box = (id: string, authorId: 'user' | 'partner', note: string, photoUrls: string[] = []): ComfortBoxData => ({
  id,
  authorId,
  authorName: authorId === 'user' ? 'Arun' : 'Meera',
  reassuranceNote: note,
  photoUrls,
  calmingExercise: '4-7-8',
  updatedAt: ''
});

/** What the app does on a save or an arrival: newest first, one per id. */
const save = (boxes: ComfortBoxData[], next: ComfortBoxData) => [next, ...boxes.filter(b => b.id !== next.id)];

describe('comfort box', () => {
  it('keeps the note each of you wrote - neither replaces the other', () => {
    let boxes: ComfortBoxData[] = [];
    boxes = save(boxes, box(comfortBoxId('user'), 'user', 'For Meera'));
    boxes = save(boxes, box(comfortBoxId('partner'), 'partner', 'For Arun'));

    expect(comfortBoxesFor(boxes, 'user').forMe?.reassuranceNote).toBe('For Arun');
    expect(comfortBoxesFor(boxes, 'user').mine?.reassuranceNote).toBe('For Meera');
    expect(comfortBoxesFor(boxes, 'partner').forMe?.reassuranceNote).toBe('For Meera');
    expect(comfortBoxesFor(boxes, 'partner').mine?.reassuranceNote).toBe('For Arun');
  });

  it('a new note from the same person replaces only their own', () => {
    let boxes: ComfortBoxData[] = [];
    boxes = save(boxes, box(comfortBoxId('partner'), 'partner', 'For Arun'));
    boxes = save(boxes, box(comfortBoxId('user'), 'user', 'For Meera'));
    boxes = save(boxes, box(comfortBoxId('user'), 'user', 'For Meera, again'));

    expect(boxes).toHaveLength(2);
    expect(comfortBoxesFor(boxes, 'user').mine?.reassuranceNote).toBe('For Meera, again');
    expect(comfortBoxesFor(boxes, 'user').forMe?.reassuranceNote).toBe('For Arun');
  });

  it('a box saved under the old shared id still counts for whoever wrote it', () => {
    const legacy = [box('cb-1', 'partner', 'Old note for Arun')];
    expect(comfortBoxesFor(legacy, 'user').forMe?.reassuranceNote).toBe('Old note for Arun');
    expect(comfortBoxesFor(legacy, 'user').mine).toBeUndefined();

    // Its author writing again puts the new note first; the old one is shadowed.
    const later = save(legacy, box(comfortBoxId('partner'), 'partner', 'New note for Arun'));
    expect(comfortBoxesFor(later, 'user').forMe?.reassuranceNote).toBe('New note for Arun');
    // And the other person writing does not touch it.
    const both = save(later, box(comfortBoxId('user'), 'user', 'For Meera'));
    expect(comfortBoxesFor(both, 'user').forMe?.reassuranceNote).toBe('New note for Arun');
  });

  it('an emptied note is not replaced by an older one', () => {
    let boxes = [box('cb-1', 'partner', 'Old note')];
    boxes = save(boxes, box(comfortBoxId('partner'), 'partner', ''));
    expect(hasComfort(comfortBoxesFor(boxes, 'user').forMe)).toBe(false);
  });

  it('a note from a phone on the old version cannot replace the other person\'s', () => {
    // Dinesh (seat 'user', this version) writes; Priya's old phone opens the
    // newest box it holds - his - and saves her note over it, under his id.
    let boxes = withBox([], box(comfortBoxId('user'), 'user', 'For Meera'));
    boxes = withBox(boxes, box(comfortBoxId('user'), 'partner', 'For Arun, from the old phone'));
    expect(comfortBoxesFor(boxes, 'user').mine?.reassuranceNote).toBe('For Meera');
    expect(comfortBoxesFor(boxes, 'user').forMe?.reassuranceNote).toBe('For Arun, from the old phone');
    // And Dinesh writing again replaces only his own.
    boxes = withBox(boxes, box(comfortBoxId('user'), 'user', 'For Meera, again'));
    expect(comfortBoxesFor(boxes, 'user').forMe?.reassuranceNote).toBe('For Arun, from the old phone');
    expect(boxes).toHaveLength(2);
  });

  it('an old shared-id box arriving is filed under its author', () => {
    const boxes = withBox([box(comfortBoxId('user'), 'user', 'For Meera')], box('cb-1', 'partner', 'For Arun'));
    expect(boxes.map(b => b.id).sort()).toEqual(['cb-partner', 'cb-user']);
  });

  it('a box with only photos still has comfort in it', () => {
    expect(hasComfort(box('cb-user', 'user', '  ', ['https://example.com/a.jpg']))).toBe(true);
    expect(hasComfort(box('cb-user', 'user', '  '))).toBe(false);
    expect(hasComfort(undefined)).toBe(false);
  });
});
