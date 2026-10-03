// The synthesizer the app's sounds are rendered with lives in the app itself
// (src/core/ambient/synth.ts), because the live ambient engines play the same
// instruments in the same room. This adds only what rendering a file needs.

export * from '../src/core/ambient/synth.ts';
import type { Stereo } from '../src/core/ambient/synth.ts';
import { SR } from '../src/core/ambient/synth.ts';

/** 32-bit float WAV, for the encoder. */
export function wav(buf: Stereo): Buffer {
  const n = buf.L.length;
  const data = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) {
    data.writeFloatLE(buf.L[i], i * 8);
    data.writeFloatLE(buf.R[i], i * 8 + 4);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE float
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 8, 28);
  header.writeUInt16LE(8, 32);
  header.writeUInt16LE(32, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

