// Where ambient textures and notes get rendered: in workers, so the screen
// never waits for them.
//
// A station's notes take a fraction of a second each to compute, and a
// station needs a few dozen; done in the tap that started it, that froze the
// app for a second or more on a phone. Two workers share the work (most
// phones have the cores to spare), what a sound needs before it can start
// goes ahead of what it will need later, work nobody wants any more is
// dropped before it starts, and the workers stop again once they have been
// idle a while. If a worker cannot start (an old WebView, a page bundled
// without one, or offline before its file was ever cached), the same work is
// done here instead - one piece at a time, so the screen still gets a turn
// between pieces - and a worker is tried again a minute later.

import { Recipe, Rendered, renderRecipe } from './textures';

/** How soon a render is needed: to start at all, or only some time after. */
export type Priority = 'now' | 'later';

interface Job {
  recipe: Recipe;
  priority: Priority;
  resolve: (r: Rendered) => void;
  reject: (e: unknown) => void;
}

interface Slot {
  worker: Worker;
  job: Job | null;
}

const queue: Job[] = [];
const slots: Slot[] = [];
const noWorkers = typeof Worker === 'undefined';
/** When a worker last failed to start or died; none are tried for a while after. */
let workersFailedAt = -Infinity;
const RETRY_MS = 60_000;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_MS = 30_000;

function workersUsable() {
  return !noWorkers && Date.now() - workersFailedAt > RETRY_MS;
}

function poolSize(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return cores >= 4 ? 2 : 1;
}

function startWorker(): Slot | null {
  try {
    const worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
    const slot: Slot = { worker, job: null };
    worker.onmessage = (e: MessageEvent<{ channels?: Float32Array[]; rate?: number; error?: string }>) => {
      const job = slot.job;
      slot.job = null;
      if (job) {
        if (e.data.error || !e.data.channels) job.reject(new Error(e.data.error ?? 'nothing rendered'));
        else job.resolve({ channels: e.data.channels, rate: e.data.rate ?? 48000 });
      }
      pump();
    };
    // It could not load, or died: for now, everything is done here instead.
    worker.onerror = () => {
      workersFailedAt = Date.now();
      const owed = slots.flatMap(s => (s.job ? [s.job] : []));
      stopWorkers();
      queue.unshift(...owed);
      pump();
    };
    return slot;
  } catch {
    workersFailedAt = Date.now();
    return null;
  }
}

function stopWorkers() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  for (const slot of slots) slot.worker.terminate();
  slots.length = 0;
}

/** The next job: anything needed now before anything needed later. */
function nextJob(): Job | undefined {
  const i = queue.findIndex(j => j.priority === 'now');
  return queue.splice(i >= 0 ? i : 0, 1)[0];
}

function pump() {
  if (!workersUsable()) {
    drainHere();
    return;
  }
  while (queue.length) {
    let slot = slots.find(s => !s.job);
    if (!slot && slots.length < poolSize()) {
      const started = startWorker();
      if (!started) return pump();
      slots.push(started);
      slot = started;
    }
    if (!slot) break;
    const job = nextJob()!;
    slot.job = job;
    slot.worker.postMessage({ name: job.recipe.name, args: job.recipe.args });
  }
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = slots.some(s => s.job) || queue.length ? null : setTimeout(stopWorkers, IDLE_MS);
}

// ---------------------------------------------------------------- the fallback

let draining = false;

function drainHere() {
  if (draining) return;
  draining = true;
  const step = () => {
    const job = nextJob();
    if (job) {
      try {
        job.resolve(renderRecipe(job.recipe));
      } catch (e) {
        job.reject(e);
      }
    }
    if (queue.length) setTimeout(step, 0);
    else draining = false;
  };
  setTimeout(step, 0);
}

// ---------------------------------------------------------------- asking

/** A render on its way, which can still be hurried up or called off. */
export interface Ticket {
  promise: Promise<Rendered>;
  /** It turns out to be needed to start something: move it ahead of what is needed later. */
  promote(): void;
  /**
   * Nothing wants it any more. If it has not started, it never will, and the
   * promise rejects with Cancelled; answers whether it was called off.
   */
  cancel(): boolean;
}

export class Cancelled extends Error {
  constructor() {
    super('render no longer needed');
  }
}

/** Renders a recipe, in a worker if there is one. */
export function render(recipe: Recipe, priority: Priority = 'now'): Ticket {
  let job!: Job;
  const promise = new Promise<Rendered>((resolve, reject) => {
    job = { recipe, priority, resolve, reject };
    queue.push(job);
  });
  pump();
  return {
    promise,
    promote() {
      job.priority = 'now';
    },
    cancel() {
      const i = queue.indexOf(job);
      if (i < 0) return false;
      queue.splice(i, 1);
      job.reject(new Cancelled());
      return true;
    }
  };
}
