import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../types';
import { IDLE_CALL, type CallState } from './call';
import { applyCallLog, callLogFrom, callWords, durationWords, outcomeOf, readCallLog, type ChatCallInfo } from './callLog';
import { insertBySentAt } from './ordering';

const ended = (over: Partial<CallState>): CallState => ({
  ...IDLE_CALL,
  phase: 'ended',
  callId: 'c1',
  direction: 'out',
  startedAt: 1_000_000,
  endedAt: 1_000_000 + 60_000,
  endReason: 'hangup',
  ...over
});

const text = (id: string, sentAt: number, authorId = 'partner'): ChatMessage => ({
  id, authorId, authorName: '', text: id, timestamp: '', sentAt
});

describe('call outcomes', () => {
  it('a call that connected is a talk, however it ended', () => {
    expect(outcomeOf('hangup', 5)).toBe('talked');
    expect(outcomeOf('dropped', 5)).toBe('talked');
    expect(outcomeOf('remote-hangup', 5)).toBe('talked');
  });
  it('one that never connected says why', () => {
    expect(outcomeOf('declined', 0)).toBe('declined');
    expect(outcomeOf('busy', 0)).toBe('busy');
    expect(outcomeOf('failed', 0)).toBe('failed');
    expect(outcomeOf('mic-denied', 0)).toBe('failed');
    expect(outcomeOf('no-answer', 0)).toBe('missed');
    expect(outcomeOf('cancelled', 0)).toBe('missed');
    expect(outcomeOf('missed', 0)).toBe('missed');
    expect(outcomeOf('hangup', 0)).toBe('missed');
  });
});

describe('what a phone writes when a call ends', () => {
  it('a 12-minute call this phone made', () => {
    const info = callLogFrom(ended({ connectedAt: 1_010_000, endedAt: 1_010_000 + 12 * 60_000 }), 'user');
    expect(info).toEqual({ callId: 'c1', caller: 'user', startedAt: 1_000_000, seconds: 720, outcome: 'talked' });
  });
  it('a call that rang this phone and was missed', () => {
    const info = callLogFrom(ended({ direction: 'in', endReason: 'missed' }), 'user');
    expect(info?.caller).toBe('partner');
    expect(info?.outcome).toBe('missed');
    expect(info?.seconds).toBe(0);
  });
  it('nothing for a call answered on another of your devices, or no call at all', () => {
    expect(callLogFrom(ended({ direction: 'in', endReason: 'answered-elsewhere' }), 'user')).toBeNull();
    expect(callLogFrom(IDLE_CALL, 'user')).toBeNull();
  });
});

describe('reading a CALL_LOG that arrives', () => {
  const good = { callId: 'c1', caller: 'partner', startedAt: 5, seconds: 30, outcome: 'talked' };
  it('takes a good one', () => expect(readCallLog(good)).toEqual(good));
  it('refuses anything broken', () => {
    expect(readCallLog(null)).toBeNull();
    expect(readCallLog({ ...good, caller: 'someone' })).toBeNull();
    expect(readCallLog({ ...good, outcome: 'exploded' })).toBeNull();
    expect(readCallLog({ ...good, startedAt: -1 })).toBeNull();
    expect(readCallLog({ ...good, seconds: 1e9 })).toBeNull();
    expect(readCallLog({ ...good, callId: '' })).toBeNull();
  });
});

describe('the line in the conversation', () => {
  const info: ChatCallInfo = { callId: 'c1', caller: 'user', startedAt: 150, seconds: 0, outcome: 'missed' };

  it('goes in at the time the call started', () => {
    const list = applyCallLog([text('a', 100), text('b', 200)], info, insertBySentAt);
    expect(list.map(m => m.id)).toEqual(['a', 'call-c1', 'b']);
    expect(list[1].call?.outcome).toBe('missed');
  });

  it('the two phones\' accounts become one line, keeping the fuller one', () => {
    let list = applyCallLog([], info, insertBySentAt);
    list = applyCallLog(list, { ...info, outcome: 'talked', seconds: 95, startedAt: 160 }, insertBySentAt);
    list = applyCallLog(list, { ...info, outcome: 'missed' }, insertBySentAt);
    expect(list).toHaveLength(1);
    expect(list[0].call).toMatchObject({ outcome: 'talked', seconds: 95, startedAt: 150 });
  });

  it('a guessed start (an older phone\'s CALL_MISSED) gives way to the real one, and the line moves', () => {
    const guess: ChatCallInfo = { ...info, startedAt: 260, estimated: true };
    let list = applyCallLog([text('a', 100), text('b', 200), text('c', 300)], guess, insertBySentAt);
    expect(list.map(m => m.id)).toEqual(['a', 'b', 'call-c1', 'c']);
    list = applyCallLog(list, { ...info, startedAt: 150 }, insertBySentAt);
    expect(list.map(m => m.id)).toEqual(['a', 'call-c1', 'b', 'c']);
    expect(list[1].sentAt).toBe(150);
    expect(list[1].call?.estimated).toBeUndefined();
    // Another guess after that changes nothing.
    expect(applyCallLog(list, guess, insertBySentAt)).toBe(list);
  });

  it('a real start is never replaced by a guess', () => {
    let list = applyCallLog([], { ...info, startedAt: 150 }, insertBySentAt);
    list = applyCallLog(list, { ...info, startedAt: 260, estimated: true }, insertBySentAt);
    expect(list[0].sentAt).toBe(150);
    expect(list[0].call?.estimated).toBeUndefined();
  });

  it("a microphone refused on the answering phone is a failure on both, not a decline", () => {
    // The caller hears a decline; the phone that answered knows it failed.
    let list = applyCallLog([], { ...info, outcome: 'declined' }, insertBySentAt);
    list = applyCallLog(list, { ...info, outcome: 'failed' }, insertBySentAt);
    expect(list[0].call?.outcome).toBe('failed');
  });

  it('the same account twice changes nothing', () => {
    const once = applyCallLog([], info, insertBySentAt);
    expect(applyCallLog(once, info, insertBySentAt)).toBe(once);
  });

  it('says the right thing on each phone', () => {
    expect(callWords({ ...info, outcome: 'missed' }, 'user', 'Priya').title).toBe('No answer');
    expect(callWords({ ...info, outcome: 'missed' }, 'partner', 'Dinesh').title).toBe('Missed call');
    expect(callWords({ ...info, outcome: 'declined' }, 'user', 'Priya').title).toBe('Priya declined');
    expect(callWords({ ...info, outcome: 'declined' }, 'partner', 'Dinesh').title).toBe('You declined');
    expect(callWords({ ...info, outcome: 'talked', seconds: 720 }, 'partner', 'Dinesh')).toEqual({ title: 'Voice call', detail: '12 min' });
  });

  it('durations read naturally', () => {
    expect(durationWords(45)).toBe('45 sec');
    expect(durationWords(720)).toBe('12 min');
    expect(durationWords(3900)).toBe('1 hr 5 min');
    expect(durationWords(7200)).toBe('2 hr');
  });
});
