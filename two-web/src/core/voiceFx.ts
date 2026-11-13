// A voice note sent in a funny voice (components/VoiceNotePlayer,
// components/VoiceRecorder).
//
// The recording that travels is the one that was made: the voice is put on
// as it is played, on whichever phone plays it, from one word the message
// carries with it. So a phone on an older Two plays the note in the plain
// voice rather than not at all, and nothing has to be recorded twice.
//
// A chipmunk and a giant are the note played faster or slower with its pitch
// left to follow. A robot and an echo are made by passing the sound through a
// small graph on the way to the speaker.

import { getAudioContext } from './audioAlerts';

export interface VoiceFx {
  id: 'chipmunk' | 'robot' | 'giant' | 'echo';
  emoji: string;
  /** What it is called, on its chip. */
  name: string;
  /** How much faster it plays, its pitch following: 1 for a voice that keeps its speed. */
  speed: number;
}

export const VOICE_FX: readonly VoiceFx[] = [
  { id: 'chipmunk', emoji: '🐿️', name: 'Chipmunk', speed: 1.45 },
  { id: 'robot', emoji: '🤖', name: 'Robot', speed: 1 },
  { id: 'giant', emoji: '👹', name: 'Giant', speed: 0.74 },
  { id: 'echo', emoji: '🏔️', name: 'Echo', speed: 1 }
];
export type VoiceFxId = VoiceFx['id'];

export const voiceFx = (id: unknown): VoiceFx | null => VOICE_FX.find(fx => fx.id === id) ?? null;
/** Only a voice there is, from whatever a message says. */
export const cleanVoiceFx = (raw: unknown): VoiceFxId | undefined => voiceFx(raw)?.id;

/** How fast a note plays: the speed chosen on this phone, times its voice's own. */
export function setVoiceSpeed(audio: HTMLAudioElement, rate: number, id: unknown) {
  const speed = voiceFx(id)?.speed ?? 1;
  const loose = audio as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean; mozPreservesPitch?: boolean };
  // A chipmunk is high because it is fast: the pitch is left to follow the speed.
  const keep = speed === 1;
  try {
    loose.preservesPitch = keep;
    loose.webkitPreservesPitch = keep;
    loose.mozPreservesPitch = keep;
  } catch {
    /* a phone without it plays the note fast or slow in its own voice */
  }
  audio.defaultPlaybackRate = rate * speed;
  audio.playbackRate = rate * speed;
}

/** Whether a voice is made by a graph, which the earpiece's own player does not have. */
export const voiceNeedsGraph = (id: unknown) => id === 'robot' || id === 'echo';

/**
 * Passes a note's sound through its voice on the way to the speaker. Returns
 * how to take it apart again - or null when there is nothing to put on, or
 * this phone cannot: then the note plays as it was recorded.
 *
 * An element can be wired only once, so this is done as it is first opened.
 */
export function wireVoice(audio: HTMLAudioElement, id: unknown): (() => void) | null {
  if (!voiceNeedsGraph(id)) return null;
  const ctx = getAudioContext();
  if (!ctx) return null;
  const nodes: AudioNode[] = [];
  let osc: OscillatorNode | null = null;
  try {
    const source = ctx.createMediaElementSource(audio);
    nodes.push(source);
    if (id === 'robot') {
      // The voice multiplied by a low hum: every word comes out as a buzz at one flat pitch.
      const ring = ctx.createGain();
      ring.gain.value = 0;
      osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 52;
      osc.connect(ring.gain);
      osc.start();
      const out = ctx.createGain();
      out.gain.value = 1.9;
      // A little of the plain voice under it, so the words can still be made out.
      const plain = ctx.createGain();
      plain.gain.value = 0.18;
      source.connect(ring);
      ring.connect(out);
      source.connect(plain);
      plain.connect(out);
      out.connect(ctx.destination);
      nodes.push(ring, out, plain);
    } else {
      // The voice, and the voice again a little later, and again, each time fainter.
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.27;
      const back = ctx.createGain();
      back.gain.value = 0.46;
      const wet = ctx.createGain();
      wet.gain.value = 0.7;
      source.connect(ctx.destination);
      source.connect(delay);
      delay.connect(back);
      back.connect(delay);
      delay.connect(wet);
      wet.connect(ctx.destination);
      nodes.push(delay, back, wet);
    }
  } catch {
    // Wired or not, the element must still reach the speaker.
    for (const node of nodes) {
      try {
        node.disconnect();
      } catch {
        /* never connected */
      }
    }
    try {
      if (nodes[0]) nodes[0].connect(ctx.destination);
    } catch {
      /* it plays through the element's own way out, if it was never taken */
    }
    return null;
  }
  return () => {
    try {
      osc?.stop();
    } catch {
      /* already stopped */
    }
    for (const node of nodes) {
      try {
        node.disconnect();
      } catch {
        /* already apart */
      }
    }
  };
}

/** The graph only sounds while the phone's sound is awake: asked for as a note is played. */
export function wakeVoiceGraph(id: unknown) {
  if (voiceNeedsGraph(id)) getAudioContext();
}
