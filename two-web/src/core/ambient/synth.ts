// The synthesizer behind every sound in Two - the short sounds rendered to
// files ahead of time (two-web/sound-design/) and the ambient engines that
// run live (soundscapes, the radio, the nightstand, the breathing exercise).
//
// Pure functions on sample arrays: nothing here touches Web Audio, so the
// same code renders a file in Node and a texture in the browser.
//
// (Moved from sound-design/dsp.mts, which now re-exports it.)
//
// Nothing here is sampled: every sound is built from the way real objects
// vibrate. A struck bell, bar or bowl rings as a set of decaying sine waves
// ("modes") at frequencies particular to its shape - that set, more than
// anything else, is what makes glass sound like glass and a bowl like a bowl.
// Textures (water, paper, a pencil) are shaped noise. Everything then goes
// through one shared room (a convolution reverb) and one mastering stage, so
// the whole app sounds like it happens in the same place.
//
// Deterministic: the same recipe always renders the same file.

export const SR = 48_000;

export interface Stereo {
  L: Float32Array;
  R: Float32Array;
}

export function silence(seconds: number): Stereo {
  const n = Math.ceil(seconds * SR);
  return { L: new Float32Array(n), R: new Float32Array(n) };
}

/**
 * A small seeded generator, so renders are reproducible.
 *
 * The state lives in a typed array rather than a captured variable: a
 * captured number this large is stored boxed, and every step allocated a new
 * box - most of the cost of rendering noise. Same sequence either way.
 */
export function rng(seed: number): () => number {
  const state = new Uint32Array(1);
  state[0] = (seed * 2654435761) >>> 0 || 1;
  return () => {
    let s = state[0];
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    state[0] = s;
    return s / 4294967296;
  };
}

const SEMITONE: Record<string, number> = {
  C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2
};

/** 'D5' -> 587.33 Hz, equal temperament, A4 = 440. */
export function hz(note: string): number {
  const m = note.match(/^([A-G]#?)(-?\d)$/);
  if (!m) throw new Error(`Not a note: ${note}`);
  return 440 * 2 ** ((SEMITONE[m[1]] + (Number(m[2]) - 4) * 12) / 12);
}

/** Equal-power pan, -1 (left) .. 1 (right). */
function panGains(pan: number): [number, number] {
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

export interface ModeOptions {
  freq: number;
  amp: number;
  /** Seconds for the ring to fall to 1/e. */
  decay: number;
  start?: number;
  attack?: number;
  pan?: number;
  /** Two sines this many Hz apart instead of one: the slow shimmer of a bowl. */
  beat?: number;
  phase?: number;
  /** Starts at freq * (1 + glide) and settles to freq: + falls, - rises. */
  glide?: number;
  glideTime?: number;
  /** Hard length in seconds (a short fade ends it). Defaults to the ring dying out. */
  length?: number;
}

/** One decaying sinusoid - the building block of every struck sound. */
export function mode(out: Stereo, o: ModeOptions) {
  if (o.freq * (1 + Math.max(0, o.glide ?? 0)) > SR * 0.45) return; // above hearing, and would alias
  const n0 = Math.floor((o.start ?? 0) * SR);
  const total = out.L.length - n0;
  const wanted = Math.ceil((o.length ?? o.decay * 8) * SR);
  const len = Math.min(total, wanted);
  if (len <= 0) return;
  const [gl, gr] = panGains(o.pan ?? 0);
  const atk = Math.max(1, Math.floor((o.attack ?? 0.002) * SR));
  // A ring the buffer cuts short is faded, not chopped: a sine stopped while
  // still audible is a click. A hard length gets a short fade; a ring cut by
  // the end of the buffer gets a longer one.
  const fadeFrom =
    o.length !== undefined
      ? len - Math.floor(0.008 * SR)
      : len < wanted
        ? len - Math.floor(Math.min(0.25, len / SR / 3) * SR)
        : Infinity;
  const glide = o.glide ?? 0;
  const glideTime = o.glideTime ?? 0.05;
  const beat = o.beat ?? 0;
  let p1 = o.phase ?? 0;
  let p2 = p1 + 1.7;
  const w = (2 * Math.PI) / SR;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let env = Math.exp(-t / o.decay);
    if (i < atk) env *= 0.5 - 0.5 * Math.cos((Math.PI * i) / atk);
    if (i > fadeFrom) env *= Math.max(0, (len - i) / (len - fadeFrom));
    if (env < 1e-6 && i > atk) break;
    const f = glide ? o.freq * (1 + glide * Math.exp(-t / glideTime)) : o.freq;
    let s: number;
    if (beat) {
      p1 += w * (f - beat / 2);
      p2 += w * (f + beat / 2);
      s = 0.5 * (Math.sin(p1) + Math.sin(p2));
    } else {
      p1 += w * f;
      s = Math.sin(p1);
    }
    const v = o.amp * env * s;
    out.L[n0 + i] += v * gl;
    out.R[n0 + i] += v * gr;
  }
}

/** A partial of an instrument: ratio to the struck note, level, ring time. */
export interface Partial {
  r: number;
  a: number;
  d: number;
  beat?: number;
}

/**
 * The partials of the instruments, from how each one physically vibrates.
 * Ratios are to the note played.
 */
export const INSTRUMENTS: Record<string, Partial[]> = {
  // Soft glass bell: nearly harmonic, the slight stretch is what reads as glass.
  glass: [
    { r: 1, a: 1, d: 0.9 },
    { r: 2.005, a: 0.32, d: 0.55 },
    { r: 3.02, a: 0.12, d: 0.32 },
    { r: 4.16, a: 0.06, d: 0.2 },
    { r: 5.43, a: 0.03, d: 0.12 }
  ],
  // Kalimba tine: a strong fundamental and a few quick, high overtones.
  kalimba: [
    { r: 1, a: 1, d: 0.6 },
    { r: 2.0, a: 0.08, d: 0.2 },
    { r: 5.42, a: 0.14, d: 0.07 },
    { r: 8.93, a: 0.05, d: 0.04 }
  ],
  // Wooden bar (marimba): the bar's own 1 : 3.93 : 9.24 ladder, short.
  marimba: [
    { r: 1, a: 1, d: 0.32 },
    { r: 3.93, a: 0.22, d: 0.07 },
    { r: 9.24, a: 0.06, d: 0.025 }
  ],
  // Metal bar (glockenspiel): 1 : 2.71 : 5.15, long and bright.
  glock: [
    { r: 1, a: 1, d: 1.1 },
    { r: 2.71, a: 0.3, d: 0.42 },
    { r: 5.15, a: 0.13, d: 0.18 },
    { r: 8.43, a: 0.05, d: 0.09 }
  ],
  // Church-type bell: hum, prime, minor-third tierce, quint, nominal...
  bell: [
    { r: 0.5, a: 0.32, d: 2.4 },
    { r: 1, a: 1, d: 1.5 },
    { r: 1.19, a: 0.42, d: 1.1 },
    { r: 1.5, a: 0.24, d: 0.85 },
    { r: 2, a: 0.48, d: 0.75 },
    { r: 2.51, a: 0.16, d: 0.42 },
    { r: 2.99, a: 0.12, d: 0.32 },
    { r: 4.02, a: 0.06, d: 0.2 }
  ],
  // Singing bowl: 1 : 2.71 : 5.15 again, each mode split in two, which beats.
  bowl: [
    { r: 1, a: 1, d: 3.4, beat: 0.8 },
    { r: 2.71, a: 0.42, d: 2.3, beat: 1.7 },
    { r: 5.15, a: 0.16, d: 1.2, beat: 2.6 },
    { r: 8.43, a: 0.05, d: 0.6, beat: 3.4 }
  ],
  // Felt-dampened piano: harmonic, warm, a softened top.
  felt: [
    { r: 1, a: 1, d: 1.0, beat: 0.35 },
    { r: 2, a: 0.42, d: 0.55 },
    { r: 3, a: 0.17, d: 0.32 },
    { r: 4, a: 0.07, d: 0.2 },
    { r: 5, a: 0.03, d: 0.12 }
  ]
};

export interface StrikeOptions {
  note: number;
  instrument: Partial[];
  start?: number;
  gain?: number;
  pan?: number;
  attack?: number;
  /** How far the overtones wander from the note's position in the stereo field. */
  spread?: number;
  decayScale?: number;
  /** 0..1: how much of the strike itself (mallet on metal) is heard. */
  mallet?: number;
  malletTone?: number;
  /** Multiplies the level of every overtone above the first: softer or harder strike. */
  brightness?: number;
  seed?: number;
}

/** Strikes an instrument: every partial at once, plus the touch of the mallet. */
export function strike(out: Stereo, o: StrikeOptions) {
  const rand = rng(o.seed ?? 1);
  const gain = o.gain ?? 1;
  const pan = o.pan ?? 0;
  const spread = o.spread ?? 0.25;
  const brightness = o.brightness ?? 1;
  o.instrument.forEach((p, i) => {
    mode(out, {
      freq: o.note * p.r,
      amp: gain * p.a * (i === 0 ? 1 : brightness),
      decay: p.d * (o.decayScale ?? 1),
      start: o.start,
      attack: o.attack ?? 0.0015,
      pan: i === 0 ? pan : pan + (rand() * 2 - 1) * spread,
      beat: p.beat,
      phase: rand() * Math.PI * 2
    });
  });
  const mallet = o.mallet ?? 0.25;
  if (mallet > 0) {
    noise(out, {
      start: o.start,
      dur: 0.02,
      gain: gain * mallet * 0.35,
      filter: { type: 'bandpass', f: o.malletTone ?? Math.min(6000, o.note * 3), q: 0.8 },
      attack: 0.0004,
      decay: 0.004,
      pan,
      seed: (o.seed ?? 1) + 101
    });
  }
}

type FilterType = 'lowpass' | 'highpass' | 'bandpass';

/** A biquad filter (Robert Bristow-Johnson's cookbook). */
class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  set(type: FilterType, f: number, q: number) {
    const w0 = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
    const c = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    let b0: number, b1: number, b2: number;
    if (type === 'lowpass') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (type === 'highpass') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0; this.a2 = (1 - alpha) / a0;
  }
  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

export interface NoiseOptions {
  start?: number;
  dur: number;
  gain: number;
  filter: { type: FilterType; f: number; q?: number };
  /** The filter frequency glides (exponentially) to this over the sound. */
  sweepTo?: number;
  attack?: number;
  /** Seconds to 1/e; omit for a flat level that only fades at the end. */
  decay?: number;
  pan?: number;
  seed?: number;
  /** 0..1: random roughness in the level - grit, paper, foil. */
  grain?: number;
  /** Pink rather than white: softer, breathier. */
  pink?: boolean;
}

/** Shaped noise: water, paper, breath, the touch of a pencil. */
export function noise(out: Stereo, o: NoiseOptions) {
  const n0 = Math.floor((o.start ?? 0) * SR);
  const len = Math.min(out.L.length - n0, Math.ceil(o.dur * SR));
  if (len <= 0) return;
  const rand = rng(o.seed ?? 7);
  const [gl, gr] = panGains(o.pan ?? 0);
  const fl = new Biquad();
  const fl2 = new Biquad();
  const q = o.filter.q ?? 0.707;
  const atk = Math.max(1, Math.floor((o.attack ?? 0.003) * SR));
  const fade = Math.max(1, Math.floor(0.006 * SR));
  let b0 = 0, b1 = 0, b2 = 0; // pink state
  let grainLevel = 1;
  for (let i = 0; i < len; i++) {
    if (i % 64 === 0) {
      const p = i / len;
      const f = o.sweepTo ? o.filter.f * (o.sweepTo / o.filter.f) ** p : o.filter.f;
      fl.set(o.filter.type, f, q);
      fl2.set(o.filter.type, f, q);
      if (o.grain) grainLevel = 1 - o.grain + o.grain * rand() * 1.6;
    }
    let x = rand() * 2 - 1;
    if (o.pink) {
      b0 = 0.99765 * b0 + x * 0.099046;
      b1 = 0.963 * b1 + x * 0.2965164;
      b2 = 0.57 * b2 + x * 1.0526913;
      x = (b0 + b1 + b2 + x * 0.1848) * 0.25;
    }
    const y = fl2.process(fl.process(x));
    const t = i / SR;
    let env = o.decay ? Math.exp(-t / o.decay) : 1;
    if (i < atk) env *= 0.5 - 0.5 * Math.cos((Math.PI * i) / atk);
    if (i > len - fade) env *= (len - i) / fade;
    const v = o.gain * env * grainLevel * y;
    out.L[n0 + i] += v * gl;
    out.R[n0 + i] += v * gr;
  }
}

// ---------------------------------------------------------------- the room

/** In-place iterative radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / size;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let start = 0; start < n; start += size) {
      let cr = 1, ci = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k, b = a + size / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

function convolve(x: Float32Array, h: Float32Array): Float32Array {
  const outLen = x.length + h.length - 1;
  let n = 1;
  while (n < outLen) n <<= 1;
  const xr = new Float64Array(n), xi = new Float64Array(n);
  const hr = new Float64Array(n), hi = new Float64Array(n);
  xr.set(x); hr.set(h);
  fft(xr, xi, false);
  fft(hr, hi, false);
  for (let i = 0; i < n; i++) {
    const r = xr[i] * hr[i] - xi[i] * hi[i];
    const im = xr[i] * hi[i] + xi[i] * hr[i];
    xr[i] = r; xi[i] = im;
  }
  fft(xr, xi, true);
  const y = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) y[i] = xr[i];
  return y;
}

export interface RoomOptions {
  /** Seconds for the tail to fall 60 dB. */
  rt60?: number;
  /** Level of the room against the dry sound. */
  wet?: number;
  predelay?: number;
  /** How much faster the highs die than the lows (0.3 = a soft, furnished room). */
  damping?: number;
  seed?: number;
}

/**
 * A room for a sound to ring in: decaying, decorrelated noise with early reflections.
 * At SR unless asked otherwise - a live convolver needs it at its context's rate.
 */
function impulseResponse(o: Required<RoomOptions>, channel: number, rate = SR): Float32Array {
  const len = Math.ceil((o.predelay + o.rt60 * 1.05) * rate);
  const ir = new Float32Array(len);
  const rand = rng(o.seed + channel * 31);
  const pre = Math.floor(o.predelay * rate);
  // Lows and highs decay separately: the highs go first, as in a real room.
  let lp = 0;
  const lpCoef = Math.exp((-2 * Math.PI * 2200) / rate);
  for (let i = pre; i < len; i++) {
    const t = (i - pre) / rate;
    const x = rand() * 2 - 1;
    lp = (1 - lpCoef) * x + lpCoef * lp;
    const high = x - lp;
    ir[i] =
      lp * Math.exp((-6.91 * t) / o.rt60) * 1.6 +
      high * Math.exp((-6.91 * t) / (o.rt60 * o.damping)) * 0.6;
  }
  // A few early reflections, alternating sides.
  const taps = [0.007, 0.0113, 0.0171, 0.0236, 0.0312, 0.0419];
  taps.forEach((d, k) => {
    if ((k + channel) % 2 === 0) {
      const at = pre + Math.floor(d * rate);
      if (at < len) ir[at] += 0.55 * Math.pow(0.78, k);
    }
  });
  // Normalised to unit energy, so "wet" means the same thing in every room.
  let e = 0;
  for (let i = 0; i < len; i++) e += ir[i] * ir[i];
  const g = 1 / Math.sqrt(e || 1);
  for (let i = 0; i < len; i++) ir[i] *= g;
  return ir;
}

/** Places a dry sound in the room; returns a longer buffer with the tail. */
export function room(dry: Stereo, opts: RoomOptions = {}): Stereo {
  const o: Required<RoomOptions> = {
    rt60: opts.rt60 ?? 1.5,
    wet: opts.wet ?? 0.18,
    predelay: opts.predelay ?? 0.014,
    damping: opts.damping ?? 0.45,
    seed: opts.seed ?? 4242
  };
  const irL = impulseResponse(o, 0);
  const irR = impulseResponse(o, 1);
  const wetL = convolve(dry.L, irL);
  const wetR = convolve(dry.R, irR);
  const n = wetL.length;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = (i < dry.L.length ? dry.L[i] : 0) + o.wet * wetL[i];
    R[i] = (i < dry.R.length ? dry.R[i] : 0) + o.wet * wetR[i];
  }
  return { L, R };
}

// ---------------------------------------------------------------- mastering

export interface MasterOptions {
  /** Level of the loudest 300 ms, in dBFS RMS: how loud this sound is meant to be. */
  loudness: number;
  /** Below this the low end is cut: phone speakers cannot play it, and it only eats headroom. */
  highpass?: number;
  ceiling?: number;
  /** Longest the sound may be; a ring still going is faded out over tailFade. */
  maxSeconds?: number;
  tailFade?: number;
}

export function db(x: number) {
  return 20 * Math.log10(Math.max(x, 1e-12));
}

/** Highpass, level to the target, catch peaks, trim the silent tail, fade the end. */
export function master(buf: Stereo, o: MasterOptions): Stereo {
  const n = buf.L.length;
  const L = new Float32Array(buf.L), R = new Float32Array(buf.R);

  // 1. Highpass (two passes of a 2nd-order filter: 24 dB/octave).
  const hp = o.highpass ?? 90;
  for (const ch of [L, R]) {
    for (let pass = 0; pass < 2; pass++) {
      const f = new Biquad();
      f.set('highpass', hp, 0.707);
      for (let i = 0; i < n; i++) ch[i] = f.process(ch[i]);
    }
  }

  // 2. Loudness: RMS of the loudest 300 ms window, brought to the target.
  const win = Math.floor(0.3 * SR);
  let sum = 0, best = 0;
  for (let i = 0; i < n; i++) {
    const m = (L[i] * L[i] + R[i] * R[i]) / 2;
    sum += m;
    if (i >= win) {
      const old = (L[i - win] * L[i - win] + R[i - win] * R[i - win]) / 2;
      sum -= old;
    }
    if (sum > best) best = sum;
  }
  const rms = Math.sqrt(best / Math.min(win, n));
  const gain = 10 ** ((o.loudness - db(rms)) / 20);
  for (let i = 0; i < n; i++) { L[i] *= gain; R[i] *= gain; }

  // 3. Peak limiting with 2 ms lookahead and a 60 ms release - no clipping, no pumping.
  const ceiling = 10 ** ((o.ceiling ?? -1) / 20);
  const look = Math.floor(0.002 * SR);
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  const release = Math.exp(-1 / (0.06 * SR));
  let g = 1;
  const applied = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let target = 1;
    for (let k = 0; k <= look && i + k < n; k++) target = Math.min(target, need[i + k]);
    g = target < g ? target : target + (g - target) * release;
    applied[i] = g;
  }
  for (let i = 0; i < n; i++) { L[i] *= applied[i]; R[i] *= applied[i]; }

  // 4. Trim the tail once it is below -66 dBFS, then fade the last 25 ms -
  //    or, for a long ring, cut at maxSeconds with a long, gentle fade.
  const floor = 10 ** (-66 / 20);
  let end = n;
  if (o.maxSeconds && n > o.maxSeconds * SR) {
    const cut = Math.floor(o.maxSeconds * SR);
    const fadeLen = Math.min(cut, Math.floor((o.tailFade ?? 1) * SR));
    for (let i = 0; i < fadeLen; i++) {
      const k = cut - fadeLen + i;
      const f = 0.5 + 0.5 * Math.cos((Math.PI * i) / fadeLen);
      L[k] *= f;
      R[k] *= f;
    }
    end = cut;
    return { L: L.slice(0, end), R: R.slice(0, end) };
  }
  while (end > 1 && Math.max(Math.abs(L[end - 1]), Math.abs(R[end - 1])) < floor) end--;
  end = Math.min(n, end + Math.floor(0.03 * SR));
  const fade = Math.min(end, Math.floor(0.025 * SR));
  for (let i = 0; i < fade; i++) {
    const k = end - fade + i;
    const f = 1 - i / fade;
    L[k] *= f * f;
    R[k] *= f * f;
  }
  return { L: L.slice(0, end), R: R.slice(0, end) };
}

/** Peak and loudest-window RMS of a finished sound, for the render report. */
export function measure(buf: Stereo) {
  let peak = 0;
  for (let i = 0; i < buf.L.length; i++) peak = Math.max(peak, Math.abs(buf.L[i]), Math.abs(buf.R[i]));
  const win = Math.floor(0.3 * SR);
  let sum = 0, best = 0;
  for (let i = 0; i < buf.L.length; i++) {
    sum += (buf.L[i] ** 2 + buf.R[i] ** 2) / 2;
    if (i >= win) sum -= (buf.L[i - win] ** 2 + buf.R[i - win] ** 2) / 2;
    best = Math.max(best, sum);
  }
  let firstSound = 0;
  while (firstSound < buf.L.length && Math.max(Math.abs(buf.L[firstSound]), Math.abs(buf.R[firstSound])) < 0.001) firstSound++;
  return {
    seconds: buf.L.length / SR,
    peakDb: db(peak),
    loudDb: db(Math.sqrt(best / Math.min(win, buf.L.length))),
    leadMs: (firstSound / SR) * 1000
  };
}

// ---------------------------------------------------------------- live instruments

/**
 * The room's impulse response, for a live convolver - the same room the files
 * ring in. A ConvolverNode refuses a response at any rate but its context's
 * own, and a phone may run at 44.1 kHz rather than 48, so the rate is asked for.
 */
export function roomImpulse(opts: RoomOptions = {}, rate = SR): Stereo {
  const o: Required<RoomOptions> = {
    rt60: opts.rt60 ?? 1.5,
    wet: opts.wet ?? 0.18,
    predelay: opts.predelay ?? 0.014,
    damping: opts.damping ?? 0.45,
    seed: opts.seed ?? 4242
  };
  return { L: impulseResponse(o, 0, rate), R: impulseResponse(o, 1, rate) };
}

export interface PluckOptions {
  note: number;
  start?: number;
  gain?: number;
  /** 0..1: how quickly the string loses its highs - 1 is a bright steel string. */
  brightness?: number;
  /** Seconds the string is allowed to ring. */
  length?: number;
  seed?: number;
}

/**
 * A plucked string (Karplus-Strong): a burst of noise circulating in a delay
 * line one period long, softened a little on every pass - which is very
 * nearly what a real string does with the energy of the pluck.
 *
 * Mono, unplaced: where it sits is up to whoever plays it.
 *
 * In tune: the loop has to come round in exactly one period, and the
 * softening (an average of two neighbouring samples) itself delays by half a
 * sample, so the line is read half a sample short of the period, between
 * its two nearest samples. Rounding the line to whole samples instead, as
 * this first did, put notes of one chord up to 18 cents apart.
 */
export function pluck(out: Float32Array, o: PluckOptions) {
  const rand = rng(o.seed ?? 3);
  const n0 = Math.floor((o.start ?? 0) * SR);
  const len = Math.min(out.length - n0, Math.ceil((o.length ?? 2.5) * SR));
  if (len <= 0) return;
  const delay = Math.max(2, SR / o.note - 0.5);
  const whole = Math.floor(delay);
  const frac = delay - whole;
  const size = whole + 2;
  // The string's recent past: line[w] is the newest sample, line[w - k] k samples older.
  const line = new Float32Array(size);
  // A softer pluck: the excitation is low-passed, as a fingertip would.
  let soft = 0;
  for (let i = 0; i < size; i++) {
    soft = 0.55 * soft + 0.45 * (rand() * 2 - 1);
    line[i] = soft;
  }
  const brightness = o.brightness ?? 0.6;
  const loss = 0.4965 + 0.0034 * brightness; // per-pass averaging weight: < 0.5 decays
  const gain = o.gain ?? 1;
  let w = size - 1;
  let prev = 0;
  const fadeFrom = len - Math.floor(0.05 * SR);
  for (let i = 0; i < len; i++) {
    // `delay` samples ago: between `whole` and `whole + 1` samples back.
    const a = line[(w - whole + 1 + size) % size];
    const b = line[(w - whole + size) % size];
    const delayed = a + frac * (b - a);
    const next = loss * (delayed + prev);
    prev = delayed;
    w = (w + 1) % size;
    line[w] = next;
    let v = gain * delayed;
    if (i > fadeFrom) v *= (len - i) / (len - fadeFrom);
    out[n0 + i] += v;
  }
}

export interface KeysOptions {
  note: number;
  gain?: number;
  /** Seconds to 1/e - shortened automatically for higher notes, as on a real instrument. */
  decay?: number;
}

/**
 * An electric piano in the classic FM way: a sine modulated by a sine at the
 * same pitch, with the modulation fading fast (the bright "bark" of the
 * hammer becoming the round sustained tone), plus a quiet high tine that is
 * gone almost at once.
 *
 * Mono and dry, filling `out` and fading out by its end. The stereo tremolo
 * that makes it a Rhodes belongs to the amplifier it plays through, so it is
 * added live (see music.ts) - which also keeps each note half the size.
 * Envelopes run as products rather than an exp a sample, which with the
 * shorter tine makes a note several times quicker to render.
 */
export function keys(out: Float32Array, o: KeysOptions) {
  const len = out.length;
  if (len <= 0) return;
  const decay = (o.decay ?? 1.6) * Math.min(1, 220 / o.note) ** 0.35;
  const gain = o.gain ?? 1;
  const step = (2 * Math.PI * o.note) / SR;
  const tineStep = step * 14.1;
  const kIndex = Math.exp(-1 / (0.22 * SR));
  const kTine = Math.exp(-1 / (0.025 * SR));
  const kBody = Math.exp(-1 / (decay * SR));
  const tineLen = Math.min(len, Math.ceil(0.3 * SR)); // e^-12 by then
  const atk = Math.floor(0.004 * SR);
  // The ring is let go of gently over the last stretch, never cut.
  const fade = Math.min(len, Math.floor(Math.min(1.2, len / SR / 3) * SR));
  const fadeFrom = len - fade;
  let phase = 0;
  let tinePhase = 0;
  let index = 2.6;
  let tine = 0.18;
  let env = gain;
  for (let i = 0; i < len; i++) {
    let v = Math.sin(phase + (index + 0.35) * Math.sin(phase));
    if (i < tineLen) {
      v += tine * Math.sin(tinePhase);
      tine *= kTine;
      tinePhase += tineStep;
    }
    let e = env;
    if (i < atk) e *= i / atk;
    if (i >= fadeFrom) e *= 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeFrom)) / fade);
    out[i] += e * v;
    phase += step;
    index *= kIndex;
    env *= kBody;
  }
}
