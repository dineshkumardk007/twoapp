// A secret message in the chat (components/SecretScratch): its words are
// under a foil until the one it was sent to rubs it away with a finger.
//
// The message itself is an ordinary one with `secret` set. That it has been
// rubbed open is this phone's own business, kept here and nowhere else: the
// sender is never told, and nothing about it is sent.

import type { ChatMessage } from '../types';

/** A phone that shows a secret message under its foil (said with its version, App's CAN_DO). */
export const CAN_SECRET = 'secret-1';

/** What stands in for its words anywhere they would otherwise show: a pop-up, the quote above an answer. */
export const SECRET_WORDS = 'Secret message';

/** Only words can be secret: a photo has view-once, and the rest have nothing to hide. */
export const isSecret = (m: Pick<ChatMessage, 'secret' | 'unsent' | 'isPhoto' | 'isVoiceMemo' | 'sticker' | 'file'>): boolean =>
  m.secret === true && !m.unsent && !m.isPhoto && !m.isVoiceMemo && !m.sticker && !m.file;

const KEY = 'two_secrets_open';
const KEPT = 400;
/** Also held here, so a phone that cannot save still keeps one open until Two is closed. */
const thisTime = new Set<string>();

function saved(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Whether this phone has already rubbed this one open. */
export const secretOpened = (id: string) => thisTime.has(id) || saved().includes(id);

export function openSecret(id: string) {
  thisTime.add(id);
  try {
    const list = saved();
    if (!list.includes(id)) localStorage.setItem(KEY, JSON.stringify([...list, id].slice(-KEPT)));
  } catch {
    /* it is under its foil again next time Two is opened */
  }
}

/** Forgets what this session has opened (for the tests). */
export function forgetSecretsForTest() {
  thisTime.clear();
}

/** How much of the foil has to be rubbed away before the rest goes by itself. */
export const RUB_ENOUGH = 0.55;

/**
 * How much of a foil has been rubbed away, without reading its picture back:
 * the foil in squares, each one counted once a finger has been over it.
 */
export class RubGrid {
  private readonly done: boolean[];
  private count = 0;

  constructor(
    readonly cols: number,
    readonly rows: number
  ) {
    this.done = new Array(Math.max(1, cols) * Math.max(1, rows)).fill(false);
  }

  /** A finger at this point of the foil (each 0 to 1 across and down), rubbing a circle this wide. */
  rub(x: number, y: number, radius: number) {
    const { cols, rows } = this;
    const c0 = Math.max(0, Math.floor((x - radius) * cols));
    const c1 = Math.min(cols - 1, Math.floor((x + radius) * cols));
    // The foil is wider than it is tall: the same circle covers more of its height.
    const ry = (radius * cols) / rows;
    const r0 = Math.max(0, Math.floor((y - ry) * rows));
    const r1 = Math.min(rows - 1, Math.floor((y + ry) * rows));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (!this.done[i]) {
          this.done[i] = true;
          this.count++;
        }
      }
    }
  }

  /** The share of it rubbed away, 0 to 1. */
  get share(): number {
    return this.count / this.done.length;
  }
}
