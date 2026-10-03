// The plumbing the live ambient engines share: an output chain with the room
// in it, rendered noise, textures and notes shared between sessions (made
// off the main thread, see renderer.ts), and a scheduler.
//
// Everything takes a BaseAudioContext, so the same engine that plays on the
// phone can be rendered offline - which is how its levels are measured.

import { getAudioContext } from '../audioAlerts';
import { Recipe, Rendered, NoiseKind, recipe } from './textures';
import { render, Priority, Ticket } from './renderer';

export { recipe };
export type { Recipe, NoiseKind, Priority };

export type Ctx = BaseAudioContext;

/** The one context the whole app plays through, live. */
export function liveContext(): AudioContext | null {
  return getAudioContext();
}

/** Rendering to a buffer rather than playing: everything is planned before it starts. */
export function isOffline(ctx: Ctx): boolean {
  return typeof (ctx as OfflineAudioContext).startRendering === 'function';
}

// ---------------------------------------------------------------- buffers

/**
 * A rendered buffer, shared by every session on a context that needs it.
 *
 * Kept while a session uses it, and for a while after - a station or a
 * soundscape started again comes back at once - but only up to IDLE_BYTES of
 * what nothing is playing. The app's one live context never closes, so a
 * cache that never let go would end up holding every note of every station
 * for as long as the app ran.
 */
interface Entry {
  key: string;
  promise: Promise<AudioBuffer>;
  /** The render, while it is still to come. */
  ticket: Ticket | null;
  buffer: AudioBuffer | null;
  bytes: number;
  /** Sessions using it right now. */
  users: number;
  /** When it was last used, for letting go of the longest unused first. */
  lastUsed: number;
}

const IDLE_BYTES = 16 * 1024 * 1024;
const caches = new WeakMap<Ctx, Map<string, Entry>>();
let useClock = 0;

function cacheFor(ctx: Ctx): Map<string, Entry> {
  let map = caches.get(ctx);
  if (!map) {
    map = new Map();
    caches.set(ctx, map);
  }
  return map;
}

/** Samples, as something Web Audio can play. */
function toBuffer(ctx: Ctx, r: Rendered): AudioBuffer {
  const buf = ctx.createBuffer(r.channels.length, Math.max(1, r.channels[0].length), r.rate);
  r.channels.forEach((c, i) => buf.getChannelData(i).set(c));
  return buf;
}

/** Takes a buffer for a session, making it if it is not already made or being made. */
function acquire(ctx: Ctx, r: Recipe, priority: Priority): Entry {
  const map = cacheFor(ctx);
  let entry = map.get(r.key);
  if (!entry) {
    const e: Entry = { key: r.key, promise: null!, ticket: null, buffer: null, bytes: 0, users: 0, lastUsed: 0 };
    e.ticket = render(r, priority);
    e.promise = e.ticket.promise.then(out => {
      const buf = toBuffer(ctx, out);
      e.buffer = buf;
      e.ticket = null;
      e.bytes = buf.length * buf.numberOfChannels * 4;
      trim(ctx);
      return buf;
    });
    // One that failed is forgotten, so the next start tries again.
    e.promise.catch(() => {
      if (map.get(r.key) === e) map.delete(r.key);
    });
    map.set(r.key, e);
    entry = e;
  } else if (priority === 'now') {
    // Asked for later by one session, needed now by this one.
    entry.ticket?.promote();
  }
  entry.users++;
  entry.lastUsed = ++useClock;
  return entry;
}

function release(ctx: Ctx, entry: Entry) {
  entry.users = Math.max(0, entry.users - 1);
  entry.lastUsed = ++useClock;
  // Not rendered yet, and nothing wants it: if it has not started, it never
  // will - so a station left straight away does not hold up the next one.
  if (entry.users === 0 && entry.ticket?.cancel()) {
    const map = cacheFor(ctx);
    if (map.get(entry.key) === entry) map.delete(entry.key);
  }
  trim(ctx);
}

/** Lets go of the longest-unused buffers nothing is playing, down to the budget. */
function trim(ctx: Ctx) {
  const map = cacheFor(ctx);
  const idle = [...map.entries()].filter(([, e]) => e.users === 0 && e.buffer);
  let bytes = idle.reduce((sum, [, e]) => sum + e.bytes, 0);
  idle.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [key, e] of idle) {
    if (bytes <= IDLE_BYTES) break;
    map.delete(key);
    bytes -= e.bytes;
  }
}

/** What a context's cache holds, for measuring. */
export function cacheStats(ctx: Ctx) {
  let bytes = 0, idleBytes = 0, entries = 0;
  for (const e of cacheFor(ctx).values()) {
    entries++;
    bytes += e.bytes;
    if (e.users === 0) idleBytes += e.bytes;
  }
  return { entries, megabytes: +(bytes / 1048576).toFixed(1), idleMegabytes: +(idleBytes / 1048576).toFixed(1) };
}

/** A seamless stereo noise loop (see textures.ts). */
export function noise(kind: NoiseKind, seconds = 10): Recipe {
  return recipe('noise', { kind, seconds });
}

// ---------------------------------------------------------------- the output chain

export interface BusOptions {
  /** 0..1, the engine's volume control. */
  volume: number;
  /** The room this engine plays in. */
  room?: { rt60?: number; damping?: number };
  /** Lowpass on everything (the "through a wall" or "old radio" sound), Hz. */
  lowpass?: number;
  /**
   * Below this everything is cut, Hz. A phone speaker plays nothing down
   * there, so it only fools the level and buries what can be heard - and
   * through headphones it is rumble. 80 Hz unless a preset says otherwise.
   */
  highpass?: number;
  /** Level trim for this engine, so presets sit at a similar loudness. */
  trim?: number;
  /** Where the bus ends; the context's speakers by default. */
  destination?: AudioNode;
}

/** Somewhere a sound can be played into: a bus, or a stage on the way to one. */
export interface Target {
  readonly context: Ctx;
  /** Dry sound goes here. */
  readonly input: AudioNode;
  /** Sound for the room goes here (as well). */
  readonly send: AudioNode;
}

/**
 * One engine's way out: a dry path and a send into the room, a gentle glue
 * compressor, and the volume - with fades that never click.
 */
export class Bus implements Target {
  /** Connect dry sound here. */
  readonly input: GainNode;
  /** Connect sound here (as well) to put it in the room. */
  readonly send: GainNode;
  private readonly tone: BiquadFilterNode | null;
  private readonly volumeNode: GainNode;
  private readonly glue: DynamicsCompressorNode;
  private readonly convolver: ConvolverNode;
  private volume: number;
  private readonly trim: number;
  /** A sleep timer's fade, 0..1, on top of the volume. */
  private fade = 1;
  /** Faded in yet: until then the level stays at nothing, whatever the volume. */
  private started = false;
  /** Fading out for good: nothing brings the level back. */
  private stopping = false;
  /** When the fade-in reaches the volume. */
  private rampEnd = 0;
  private disposed = false;

  constructor(private readonly ctx: Ctx, o: BusOptions) {
    this.volume = o.volume;
    this.trim = o.trim ?? 1;
    this.input = ctx.createGain();
    this.send = ctx.createGain();
    // The room's response arrives when it is rendered (see setRoom); until
    // then the room is silent, which nobody hears, since nothing plays yet.
    this.convolver = ctx.createConvolver();
    this.convolver.normalize = false;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;

    this.glue = ctx.createDynamicsCompressor();
    this.glue.threshold.value = -20;
    this.glue.knee.value = 12;
    this.glue.ratio.value = 2.5;
    this.glue.attack.value = 0.02;
    this.glue.release.value = 0.35;

    this.volumeNode = ctx.createGain();
    this.volumeNode.gain.value = 0;

    this.tone = o.lowpass ? ctx.createBiquadFilter() : null;
    if (this.tone) {
      this.tone.type = 'lowpass';
      this.tone.frequency.value = o.lowpass!;
      this.tone.Q.value = 0.5;
    }

    const floor = ctx.createBiquadFilter();
    floor.type = 'highpass';
    floor.frequency.value = o.highpass ?? 80;
    floor.Q.value = 0.707;

    this.input.connect(floor);
    this.send.connect(this.convolver);
    this.convolver.connect(wet);
    wet.connect(floor);
    floor.connect(this.tone ?? this.glue);
    if (this.tone) this.tone.connect(this.glue);
    this.glue.connect(this.volumeNode);
    this.volumeNode.connect(o.destination ?? ctx.destination);
  }

  get context(): Ctx {
    return this.ctx;
  }

  /** The room's impulse response - rendered at this context's own rate, as a convolver requires. */
  setRoom(response: AudioBuffer) {
    if (!this.disposed) this.convolver.buffer = response;
  }

  private target(): number {
    return this.volume * this.trim * this.fade;
  }

  fadeIn(seconds = 1.5) {
    if (this.stopping || this.disposed) return;
    this.started = true;
    const now = this.ctx.currentTime;
    const g = this.volumeNode.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(0.0001, now);
    g.linearRampToValueAtTime(this.target(), now + seconds);
    this.rampEnd = now + seconds;
  }

  /**
   * Moves the level to a new target from wherever it is now.
   *
   * Cancelling what is scheduled first is needed, but on its own it is a
   * trap: a cancelled ramp falls back to where it started, so a volume
   * change half way through the fade-in used to drop the sound to nothing
   * for a moment - a click, then a swell. The current level is held first,
   * and a fade-in still under way carries on to the new target.
   */
  private glide(tau: number) {
    if (!this.started || this.stopping || this.disposed) return;
    const now = this.ctx.currentTime;
    const g = this.volumeNode.gain;
    const current = g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(current, now);
    if (now < this.rampEnd) g.linearRampToValueAtTime(this.target(), this.rampEnd);
    else g.setTargetAtTime(this.target(), now, tau);
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.glide(0.08);
  }

  /** Scales the volume for a sleep-timer fade, 0..1, without forgetting the setting. */
  setFade(ratio: number) {
    this.fade = Math.max(0, Math.min(1, ratio));
    this.glide(0.3);
  }

  fadeOut(seconds = 0.8) {
    this.stopping = true;
    const now = this.ctx.currentTime;
    const g = this.volumeNode.gain;
    const current = g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(current, now);
    g.linearRampToValueAtTime(0.0001, now + seconds);
  }

  /** Disconnects everything. Anything still scheduled plays into nothing. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.volumeNode.disconnect();
      this.input.disconnect();
      this.send.disconnect();
      this.convolver.disconnect();
    } catch {
      /* already gone */
    }
  }
}

// ---------------------------------------------------------------- playing things

export interface PlayOpts {
  when?: number;
  gain?: number;
  rate?: number;
  pan?: number;
  /** 0..1 of the sound also sent into the room. */
  room?: number;
  loop?: boolean;
  /** Where in the buffer to start, seconds. */
  offset?: number;
  /** Nodes the sound passes through on the way, in order (filters, mostly). */
  through?: AudioNode[];
  /** Stop by itself after this many seconds (for a looped source). */
  duration?: number;
}

/** A sound playing in a bus, with the controls an engine might move. */
export interface Voice {
  source: AudioBufferSourceNode;
  /** Its level - automate this for swells and gusts. */
  level: GainNode;
}

/** Plays a buffer into a bus, or into a stage on the way to one. */
export function play(to: Target, buffer: AudioBuffer, o: PlayOpts = {}): Voice {
  const ctx = to.context;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = !!o.loop;
  source.playbackRate.value = o.rate ?? 1;
  const level = ctx.createGain();
  level.gain.value = o.gain ?? 1;
  source.connect(level);
  let out: AudioNode = level;
  for (const node of o.through ?? []) {
    out.connect(node);
    out = node;
  }
  // A mono sound always goes through a panner, even to the centre: a panner
  // keeps it at one level wherever it is placed, while a mono sound with none
  // would come out of each speaker 3 dB louder than one at pan 0.01.
  if (o.pan || buffer.numberOfChannels === 1) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan ?? 0));
    out.connect(p);
    out = p;
  }
  out.connect(to.input);
  if (o.room) {
    const s = ctx.createGain();
    s.gain.value = o.room;
    out.connect(s);
    s.connect(to.send);
  }
  const when = o.when ?? ctx.currentTime;
  source.start(when, o.offset ?? 0);
  if (o.duration !== undefined) source.stop(when + o.duration);
  return { source, level };
}

/** A filter, ready to put in a `through` chain. */
export function filter(ctx: Ctx, type: BiquadFilterType, frequency: number, q = 0.707): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

/** A slow sine wobble on a parameter: depth either side of where it is. */
export function wobble(ctx: Ctx, param: AudioParam, rateHz: number, depth: number): Running {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rateHz;
  const amount = ctx.createGain();
  amount.gain.value = depth;
  lfo.connect(amount);
  amount.connect(param);
  lfo.start();
  return running(lfo);
}

/** Something running that has to be stopped: a loop, an oscillator. */
export interface Running {
  stop(): void;
}

export function stopAll(items: Running[]) {
  for (const item of items) {
    try {
      item.stop();
    } catch {
      /* already stopped */
    }
  }
}

/** Wraps an AudioScheduledSourceNode so stopping twice is harmless. */
export function running(node: AudioScheduledSourceNode): Running {
  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        node.stop();
      } catch {
        /* never started, or already stopped */
      }
    }
  };
}

// ---------------------------------------------------------------- time

/**
 * Plans events a few seconds ahead of the clock.
 *
 * Each stream is a function given the time of its next event, which schedules
 * it and answers how long until the one after. Offline, the whole render is
 * planned at once. Live, a timer tops the plan up - and when a phone has
 * held the app's timers back (the screen off, the app in the background),
 * whatever fell in the gap is skipped rather than played all at once.
 */
export class Scheduler {
  private streams: { next: number; fn: (when: number) => number }[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(private readonly ctx: Ctx, private readonly lookahead = 6) {}

  private horizon(): number {
    return isOffline(this.ctx)
      ? (this.ctx as OfflineAudioContext).length / this.ctx.sampleRate
      : this.ctx.currentTime + this.lookahead;
  }

  every(fn: (when: number) => number, firstDelay = 0) {
    const stream = { next: this.ctx.currentTime + firstDelay, fn };
    this.streams.push(stream);
    this.fill(stream);
    if (!isOffline(this.ctx) && !this.timer) {
      this.timer = setInterval(() => this.streams.forEach(s => this.fill(s)), 500);
    }
  }

  private fill(s: { next: number; fn: (when: number) => number }) {
    if (this.stopped) return;
    if (!isOffline(this.ctx) && s.next < this.ctx.currentTime) s.next = this.ctx.currentTime + 0.05;
    const horizon = this.horizon();
    let guard = 0;
    while (s.next < horizon && guard++ < 5000) {
      s.next += Math.max(0.02, s.fn(s.next));
    }
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

// ---------------------------------------------------------------- a session

/**
 * One engine's running sound: its bus, its scheduler and everything it
 * started. Stopping fades the bus out and then takes it all down, so
 * nothing is left running - or holding memory - after it.
 *
 * Layers start once what they play has been rendered (see `when`), and the
 * session only fades in once every layer has - so it starts whole, rather
 * than one layer at a time.
 */
export class Session {
  readonly bus: Bus;
  readonly sched: Scheduler;
  private readonly live: Running[] = [];
  private readonly holds = new Map<string, Entry>();
  private readonly pending: Promise<unknown>[] = [];
  private ended = false;

  constructor(readonly ctx: Ctx, opts: BusOptions) {
    this.bus = new Bus(ctx, opts);
    this.sched = new Scheduler(ctx);
    const rt60 = opts.room?.rt60 ?? 2.2;
    const damping = opts.room?.damping ?? 0.45;
    this.when([recipe('room', { rt60, damping, rate: ctx.sampleRate })], ([response]) => this.bus.setRoom(response));
  }

  keep(item: Running) {
    this.live.push(item);
    return item;
  }

  /**
   * A rendered buffer for this session, made the first time anything asks
   * for it. 'later' lets what is needed to start be made first.
   */
  load(r: Recipe, priority: Priority = 'now'): Promise<AudioBuffer> {
    let entry = this.holds.get(r.key);
    if (!entry || cacheFor(this.ctx).get(r.key) !== entry) {
      entry = acquire(this.ctx, r, priority);
      this.holds.set(r.key, entry);
    }
    return entry.promise;
  }

  /**
   * Runs `start` with these buffers once they are ready - unless the session
   * has been stopped by then. A layer that cannot be made is left out; the
   * rest still play.
   */
  when(recipes: Recipe[], start: (buffers: AudioBuffer[]) => void) {
    const done = Promise.all(recipes.map(r => this.load(r)))
      .then(buffers => {
        if (!this.ended) start(buffers);
      })
      .catch(err => {
        if (!this.ended) console.warn('An ambient layer could not start', err);
      });
    this.pending.push(done);
  }

  /** Settles when everything asked for so far is ready, or has failed. */
  get ready(): Promise<void> {
    return Promise.all(this.pending).then(() => undefined);
  }

  start(fadeSeconds = 1.5) {
    void this.ready.then(() => {
      if (!this.ended) this.bus.fadeIn(fadeSeconds);
    });
  }

  stop(fadeSeconds = 0.8) {
    if (this.ended) return;
    this.ended = true;
    this.sched.stop();
    this.bus.fadeOut(fadeSeconds);
    // What is still to be rendered is not needed now; let it go at once
    // rather than after the fade, so it never holds up whatever starts next.
    for (const [key, entry] of this.holds) {
      if (entry.buffer) continue;
      release(this.ctx, entry);
      this.holds.delete(key);
    }
    const finish = () => {
      stopAll(this.live);
      this.bus.dispose();
      for (const entry of this.holds.values()) release(this.ctx, entry);
      this.holds.clear();
    };
    if (isOffline(this.ctx)) finish();
    else setTimeout(finish, fadeSeconds * 1000 + 60);
  }

  get isEnded() {
    return this.ended;
  }
}

/** Randomness for the live engines - different every time, which ambience should be. */
export const random = {
  between: (a: number, b: number) => a + Math.random() * (b - a),
  pick: <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)],
  chance: (p: number) => Math.random() < p
};
