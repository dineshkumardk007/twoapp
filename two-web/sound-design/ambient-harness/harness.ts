import { PRESETS, startPreset, PresetName } from '../../src/core/ambient/presets';
import { cacheStats } from '../../src/core/ambient/kit';

function wav16(buf: AudioBuffer): Blob {
  const n = buf.length, ch = 2;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  return new Blob([out.buffer], { type: 'audio/wav' });
}

function stats(buf: AudioBuffer) {
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const from = Math.floor(buf.sampleRate * 3); // after the fade-in
  let e = 0, peak = 0, eL = 0, eR = 0, corr = 0;
  for (let i = from; i < buf.length; i++) {
    e += (L[i] * L[i] + R[i] * R[i]) / 2; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    eL += L[i] * L[i]; eR += R[i] * R[i]; corr += L[i] * R[i];
  }
  const n = buf.length - from;
  // Loudness over 400 ms windows: the spread says how much it moves.
  const win = Math.floor(buf.sampleRate * 0.4); const wins: number[] = [];
  for (let i = from; i + win < buf.length; i += win) { let s = 0; for (let k = i; k < i + win; k++) s += (L[k] * L[k] + R[k] * R[k]) / 2; wins.push(10 * Math.log10(s / win + 1e-12)); }
  wins.sort((a, b) => a - b);
  return {
    rmsDb: +(10 * Math.log10(e / n + 1e-12)).toFixed(1),
    peakDb: +(20 * Math.log10(peak + 1e-12)).toFixed(1),
    quietDb: +wins[Math.floor(wins.length * 0.1)].toFixed(1),
    loudDb: +wins[Math.floor(wins.length * 0.9)].toFixed(1),
    width: +(1 - corr / Math.sqrt(eL * eR + 1e-12)).toFixed(2)
  };
}

/** Renders a preset offline (at 48 kHz unless told otherwise), measures it, optionally uploads the WAV. */
(window as any).renderPreset = async (name: PresetName, seconds: number, upload: boolean, rate = 48000) => {
  const ctx = new OfflineAudioContext(2, Math.floor(rate * seconds), rate);
  const t0 = performance.now();
  const s = startPreset(ctx, name, 1, 0.5);
  if (!s) return { name, error: 'did not start' };
  await s.ready;
  const buf = await ctx.startRendering();
  const ms = Math.round(performance.now() - t0);
  if (upload) await fetch(`http://localhost:8960/upload?name=${name}`, { method: 'POST', body: wav16(buf) });
  return { name, rate, renderMs: ms, ...stats(buf) };
};
(window as any).presetNames = Object.keys(PRESETS);

// ---- live test: the real-time path (timers, stop, cleanup, the main thread, memory)
let starts = 0;
const srcStart = AudioBufferSourceNode.prototype.start;
AudioBufferSourceNode.prototype.start = function (...a: any[]) { starts++; return (srcStart as any).apply(this, a); };

let longTasks: number[] = [];
try {
  new PerformanceObserver(list => { for (const e of list.getEntries()) longTasks.push(Math.round(e.duration)); })
    .observe({ type: 'longtask', buffered: false } as PerformanceObserverInit);
} catch { /* not supported */ }

const contexts = new Map<number, AudioContext>();
(window as any).wakeAudio = async (rate?: number) => {
  const key = rate ?? 0;
  const ctx = contexts.get(key) ?? new AudioContext(rate ? { sampleRate: rate } : undefined);
  contexts.set(key, ctx);
  await ctx.resume();
  return `${ctx.state} at ${ctx.sampleRate} Hz`;
};

/**
 * Plays a preset live for a while and stops it. Reports how long startPreset
 * held the main thread, how long until it could fade in, any long tasks while
 * it started, the cache, and whether anything started after the stop.
 */
(window as any).liveTest = async (name: PresetName, seconds: number, rate?: number) => {
  const ctx = contexts.get(rate ?? 0);
  if (!ctx) throw new Error('wakeAudio first');
  const before = starts;
  longTasks = [];
  const t0 = performance.now();
  const s = startPreset(ctx, name, 0.5, 0.3);
  const syncMs = +(performance.now() - t0).toFixed(1);
  if (!s) return { name, error: 'did not start' };
  await s.ready;
  const readyMs = Math.round(performance.now() - t0);
  const clock0 = ctx.currentTime;
  await new Promise(r => setTimeout(r, seconds * 1000));
  const during = starts - before;
  const advanced = +(ctx.currentTime - clock0).toFixed(1);
  const playing = cacheStats(ctx);
  s.stop(0.3);
  await new Promise(r => setTimeout(r, 600));
  const atStop = starts;
  await new Promise(r => setTimeout(r, 2500));
  return {
    name, rate: ctx.sampleRate, syncMs, readyMs, longTasks: [...longTasks],
    clockAdvanced: advanced, sourcesStarted: during, startedAfterStop: starts - atStop,
    cacheWhilePlaying: playing, cacheAfterStop: cacheStats(ctx)
  };
};
