import { describe, expect, it, vi } from 'vitest';
import { TA } from './i18n.ta';
import { cleanVoiceFields, voiceFieldsOf, type VoiceNote } from './voice';
import { VOICE_FX, cleanVoiceFx, setVoiceSpeed, voiceFx, voiceNeedsGraph, wireVoice } from './voiceFx';

// The recorder's file reaches for the radio, which wants a browser: not needed for any of this.
vi.mock('./liveRadio', () => ({ liveRadio: { duck() {} } }));

describe('a voice note in a funny voice', () => {
  it('there are four voices, each with a name in both languages', () => {
    expect(VOICE_FX.map(fx => fx.id)).toEqual(['chipmunk', 'robot', 'giant', 'echo']);
    for (const fx of VOICE_FX) {
      expect(fx.emoji).toBeTruthy();
      expect(TA[fx.name], fx.name).toBeTruthy();
    }
    expect(voiceFx('robot')?.name).toBe('Robot');
    expect(voiceFx('dragon')).toBeNull();
    expect(voiceFx(undefined)).toBeNull();
    expect(cleanVoiceFx('echo')).toBe('echo');
    expect(cleanVoiceFx('ECHO')).toBeUndefined();
    expect(cleanVoiceFx(7)).toBeUndefined();
  });

  it('travels as one word beside the recording, and only a voice there is is taken from the other phone', () => {
    const note: VoiceNote = { dataUrl: 'data:audio/webm;base64,AAAA', durationSeconds: 3, peaks: [10, 20] };
    expect(voiceFieldsOf(note)).not.toHaveProperty('audioFx');
    const funny = voiceFieldsOf({ ...note, fx: 'chipmunk' });
    expect(funny.audioFx).toBe('chipmunk');
    expect(funny.audioDataUrl).toBe(note.dataUrl);
    expect(cleanVoiceFields(funny)?.audioFx).toBe('chipmunk');
    expect(cleanVoiceFields({ ...funny, audioFx: 'dragon' })).not.toHaveProperty('audioFx');
    expect(cleanVoiceFields({ ...funny, audioFx: { id: 'robot' } })).not.toHaveProperty('audioFx');
    // A plain note is as it always was.
    expect(cleanVoiceFields(voiceFieldsOf(note))).toEqual(voiceFieldsOf(note));
  });

  it('a chipmunk is the note played faster with its pitch left to follow; a giant, slower', () => {
    const audio = { playbackRate: 1, defaultPlaybackRate: 1, preservesPitch: true } as unknown as HTMLAudioElement & { preservesPitch: boolean };
    setVoiceSpeed(audio, 1, 'chipmunk');
    expect(audio.playbackRate).toBeGreaterThan(1.3);
    expect(audio.preservesPitch).toBe(false);
    // The speed chosen on this phone still counts, on top.
    setVoiceSpeed(audio, 2, 'chipmunk');
    expect(audio.playbackRate).toBeCloseTo(2 * voiceFx('chipmunk')!.speed, 6);
    setVoiceSpeed(audio, 1, 'giant');
    expect(audio.playbackRate).toBeLessThan(0.85);
    expect(audio.preservesPitch).toBe(false);
    // The plain voice, a robot and an echo keep their speed and their pitch.
    for (const id of [undefined, 'robot', 'echo', 'nonsense']) {
      setVoiceSpeed(audio, 1.5, id);
      expect(audio.playbackRate).toBe(1.5);
      expect(audio.defaultPlaybackRate).toBe(1.5);
      expect(audio.preservesPitch).toBe(true);
    }
  });

  it('only a robot and an echo are passed through a graph, and a phone that cannot make one plays the note plain', () => {
    expect(voiceNeedsGraph('robot')).toBe(true);
    expect(voiceNeedsGraph('echo')).toBe(true);
    expect(voiceNeedsGraph('chipmunk')).toBe(false);
    expect(voiceNeedsGraph('giant')).toBe(false);
    expect(voiceNeedsGraph(undefined)).toBe(false);
    const audio = {} as HTMLAudioElement;
    // Nothing to put on: nothing to take off.
    expect(wireVoice(audio, 'chipmunk')).toBeNull();
    expect(wireVoice(audio, undefined)).toBeNull();
    // No sound graph here (the tests have none): no voice, and no error.
    expect(() => wireVoice(audio, 'robot')).not.toThrow();
  });
});
