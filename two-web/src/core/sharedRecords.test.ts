import { describe, it, expect } from 'vitest';
import {
  applySharedRecord,
  DAILY_ANSWER,
  LETTER_OPENED,
  EXPENSE_ADD,
  EXPENSES_SETTLED,
  LIST_ITEM_SET,
  MEMORY_ADD,
  OUR_DATES,
  MAX_ANSWER_CHARS,
  SHARED_RECORD_TYPES
} from './sharedRecords';
import { CATCH_UP_TYPES } from './seats';
import { loadState, SpaceState } from './storage';

/** A fresh phone, sitting in the creator's seat. */
function phone(changes: Partial<SpaceState> = {}): SpaceState {
  return { ...loadState(), activeUser: 'user', ...changes };
}

const answer = (overrides: Record<string, unknown> = {}) => ({
  day: '2026-10-12',
  questionId: 'p-7',
  prompt: 'What made you smile today?',
  text: 'Your voice note this morning',
  at: 1_000,
  ...overrides
});

describe('Answer together', () => {
  it("files an answer under the sender's seat, not the seat it claims", () => {
    const next = applySharedRecord(phone(), DAILY_ANSWER, answer({ seat: 'user' }), 'partner');
    expect(next?.dailyAnswers).toHaveLength(1);
    expect(next?.dailyAnswers?.[0].seat).toBe('partner');
    expect(next?.dailyAnswers?.[0].id).toBe('2026-10-12|p-7|partner');
  });

  it('keeps the first answer: a second one, or the same one replayed, changes nothing', () => {
    const once = applySharedRecord(phone(), DAILY_ANSWER, answer(), 'partner')!;
    expect(applySharedRecord(once, DAILY_ANSWER, answer(), 'partner')).toBeNull();
    expect(applySharedRecord(once, DAILY_ANSWER, answer({ text: 'Changed my mind' }), 'partner')).toBeNull();
    expect(once.dailyAnswers?.[0].text).toBe('Your voice note this morning');
  });

  it("holds both people's answers to the same question, newest first", () => {
    const mine = applySharedRecord(phone(), DAILY_ANSWER, answer({ at: 1_000 }), 'user')!;
    const both = applySharedRecord(mine, DAILY_ANSWER, answer({ text: 'Our walk', at: 2_000 }), 'partner')!;
    expect(both.dailyAnswers?.map(a => a.seat)).toEqual(['partner', 'user']);
  });

  it('trims an answer and cuts it to the limit', () => {
    const long = '  ' + 'a'.repeat(MAX_ANSWER_CHARS + 50) + '  ';
    const next = applySharedRecord(phone(), DAILY_ANSWER, answer({ text: long }), 'user')!;
    expect(next.dailyAnswers?.[0].text).toHaveLength(MAX_ANSWER_CHARS);
  });

  it('refuses an answer with no real day, question or text', () => {
    expect(applySharedRecord(phone(), DAILY_ANSWER, answer({ day: 'today' }), 'user')).toBeNull();
    expect(applySharedRecord(phone(), DAILY_ANSWER, answer({ questionId: '' }), 'user')).toBeNull();
    expect(applySharedRecord(phone(), DAILY_ANSWER, answer({ text: '   ' }), 'user')).toBeNull();
  });

  it('refuses an answer from nobody in particular', () => {
    expect(applySharedRecord(phone(), DAILY_ANSWER, answer({ seat: 'someone' }), 'device-123')).toBeNull();
  });
});

describe('Love letters', () => {
  const sealed = phone({
    letters: [
      {
        id: 'l1',
        authorId: 'user',
        authorName: 'Dinesh',
        title: 'For you',
        body: '...',
        waxColor: 'burgundy',
        conditionType: 'none',
        sentDate: 'Oct 10',
        isOpened: false
      }
    ]
  });

  it('opens a letter and keeps when it was opened', () => {
    const next = applySharedRecord(sealed, LETTER_OPENED, { id: 'l1', openedDate: 'Oct 12', openedAt: 5_000 }, 'partner')!;
    expect(next.letters[0]).toMatchObject({ isOpened: true, openedDate: 'Oct 12', openedAt: 5_000 });
  });

  it('never re-opens or un-opens a letter that is already open', () => {
    const opened = applySharedRecord(sealed, LETTER_OPENED, { id: 'l1', openedAt: 5_000 }, 'partner')!;
    expect(applySharedRecord(opened, LETTER_OPENED, { id: 'l1', openedAt: 9_000 }, 'partner')).toBeNull();
  });

  it('says who opened it: the one it was written for, never its writer', () => {
    const next = applySharedRecord(sealed, LETTER_OPENED, { id: 'l1', openedAt: 5_000 }, 'partner')!;
    expect(next.letters[0].openedBy).toBe('partner');
    expect(applySharedRecord(sealed, LETTER_OPENED, { id: 'l1', openedAt: 5_000 }, 'user')).toBeNull();
  });

  it('a letter marked opened before who was kept takes the real opening when it comes', () => {
    const reread = phone({ letters: [{ ...sealed.letters[0], isOpened: true, openedDate: 'Today' }] });
    const next = applySharedRecord(reread, LETTER_OPENED, { id: 'l1', openedDate: 'Oct 14', openedAt: 7_000 }, 'partner')!;
    expect(next.letters[0]).toMatchObject({ isOpened: true, openedBy: 'partner', openedAt: 7_000 });
  });
});

describe('Money Light', () => {
  it('settles only the expenses it names, not one added in the meantime', () => {
    let state = phone({ expenses: [] });
    state = applySharedRecord(state, EXPENSE_ADD, { id: 'e1', title: 'Dinner', amount: 900 }, 'user')!;
    state = applySharedRecord(state, EXPENSE_ADD, { id: 'e2', title: 'Movie', amount: 400 }, 'partner')!;
    const settled = applySharedRecord(state, EXPENSES_SETTLED, { ids: ['e1'] }, 'user')!;
    expect(settled.expenses.map(e => e.id)).toEqual(['e2']);
  });

  it('refuses an expense with no amount', () => {
    expect(applySharedRecord(phone(), EXPENSE_ADD, { id: 'e3', title: 'Free', amount: 0 }, 'user')).toBeNull();
  });
});

describe('Shared lists', () => {
  it('sets an item to the state it was sent with, so applying twice is not a toggle', () => {
    const state = phone({
      lists: [{ id: 'i1', title: 'Milk', isCompleted: false, isHiddenFromPartner: false, addedBy: 'user' }]
    });
    const once = applySharedRecord(state, LIST_ITEM_SET, { id: 'i1', isCompleted: true }, 'partner')!;
    const twice = applySharedRecord(once, LIST_ITEM_SET, { id: 'i1', isCompleted: true }, 'partner')!;
    expect(twice.lists[0].isCompleted).toBe(true);
  });
});

describe('Memories', () => {
  it('keeps a photo carried inside the memory, and drops a web address', () => {
    const base = { title: 'Beach', desc: 'Sunset', date: '2026-09-01' };
    const inside = applySharedRecord(phone(), MEMORY_ADD, { ...base, id: 'm1', imageDataUrl: 'data:image/png;base64,AAA' }, 'partner')!;
    const outside = applySharedRecord(phone(), MEMORY_ADD, { ...base, id: 'm2', imageDataUrl: 'https://example.com/spy.png' }, 'partner')!;
    expect(inside.memories?.[0].imageDataUrl).toBe('data:image/png;base64,AAA');
    expect(outside.memories?.[0].imageDataUrl).toBeUndefined();
  });

  it('leaves a memory already here alone during a catch-up', () => {
    const base = { id: 'm1', title: 'Beach', desc: 'Sunset' };
    const state = applySharedRecord(phone(), MEMORY_ADD, base, 'partner')!;
    expect(applySharedRecord(state, MEMORY_ADD, { ...base, title: 'Old title' }, 'partner', { addOnly: true })).toBeNull();
  });
});

describe('Our dates', () => {
  it('takes newer dates and ignores older ones arriving late', () => {
    const newer = { togetherSince: '2022-02-14', at: 2_000 };
    const older = { togetherSince: '2021-01-01', at: 1_000 };
    const state = applySharedRecord(phone(), OUR_DATES, newer, 'partner')!;
    expect(state.ourDates?.togetherSince).toBe('2022-02-14');
    expect(applySharedRecord(state, OUR_DATES, older, 'user')).toBeNull();
  });
});

describe('Catching up after being offline', () => {
  it('replays every shared record except a settle-up, which would settle new debts', () => {
    for (const type of SHARED_RECORD_TYPES) {
      expect(CATCH_UP_TYPES.has(type)).toBe(type !== EXPENSES_SETTLED);
    }
  });

  it('includes the daily answers', () => {
    expect(CATCH_UP_TYPES.has(DAILY_ANSWER)).toBe(true);
  });
});

describe('Bad records', () => {
  it('ignores a record with no payload or no id', () => {
    expect(applySharedRecord(phone(), EXPENSE_ADD, null, 'user')).toBeNull();
    expect(applySharedRecord(phone(), EXPENSE_ADD, { title: 'No id', amount: 5 }, 'user')).toBeNull();
  });

  it('ignores a type it does not know', () => {
    expect(applySharedRecord(phone(), 'SOMETHING_NEW', { id: 'x' }, 'user')).toBeNull();
  });
});
