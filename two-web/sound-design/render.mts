// Renders every recipe to an MP3 in src/assets/sounds/.
//
//   npx tsx sound-design/render.mts [only-these names...] [--spectrograms <dir>]
//
// Needs ffmpeg on the PATH for the encoding. The synthesis, the room and the
// mastering are all in dsp.mts; ffmpeg only turns the finished samples into a
// small file.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { RECIPES } from './recipes.mts';
import { room, master, wav, measure } from './dsp.mts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'src', 'assets', 'sounds');
const args = process.argv.slice(2);
const specAt = args.indexOf('--spectrograms');
const specDir = specAt >= 0 ? args[specAt + 1] : null;
const only = args.filter((a, i) => !a.startsWith('--') && (specAt < 0 || i !== specAt + 1));

mkdirSync(outDir, { recursive: true });
if (specDir) mkdirSync(specDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'two-sounds-'));

let total = 0;
const rows: string[] = [];
for (const [name, recipe] of Object.entries(RECIPES)) {
  if (only.length && !only.includes(name)) continue;
  const dry = recipe.dry();
  const placed = recipe.room ? room(dry, recipe.room) : dry;
  const finished = master(placed, recipe.master);
  const m = measure(finished);

  const wavPath = join(work, `${name}.wav`);
  writeFileSync(wavPath, wav(finished));
  const mp3Path = join(outDir, `${name}.mp3`);
  const enc = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-q:a', '4', mp3Path]);
  if (enc.status !== 0) throw new Error(`ffmpeg failed on ${name}: ${enc.stderr}`);
  if (specDir) {
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-lavfi', 'showspectrumpic=s=640x240:legend=1:scale=log:fscale=log:color=intensity', join(specDir, `${name}.png`)]);
  }
  const bytes = statSync(mp3Path).size;
  total += bytes;
  rows.push(
    `${name.padEnd(14)} ${m.seconds.toFixed(2).padStart(5)}s  peak ${m.peakDb.toFixed(1).padStart(5)} dB  loud ${m.loudDb.toFixed(1).padStart(5)} dB  lead ${m.leadMs.toFixed(1).padStart(4)} ms  ${(bytes / 1024).toFixed(1).padStart(5)} KB  ${recipe.use}`
  );
}
rmSync(work, { recursive: true, force: true });
console.log(rows.join('\n'));
console.log(`\n${rows.length} sounds, ${(total / 1024).toFixed(0)} KB in ${outDir}`);
