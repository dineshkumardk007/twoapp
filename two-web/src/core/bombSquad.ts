// Bomb Squad: one of you has the bomb, the other has the book
// (components/BombSquad).
//
// The one with the bomb sees its wires, its buttons and the label on its
// side, but not what to do with them. The one with the book sees every page
// of it - one page for each kind of bomb - but not the bomb. With no call to
// talk on, you tell each other in picture signs: the label first, so the
// right page can be found, then which wire, in which order.
//
// A level is made from its number, the same on both phones. The phone with
// the bomb keeps the clock and says how things stand; the other one shows it.

import type { Seat } from './usTwo';
import { duoDice, duoInt, duoPick } from './duo';

/** Changing how levels are made changes every level: both phones must make them the same way. */
export const BOMB_MAKING = 1;

export const BOMB_COLOURS = [
  { name: 'Red', ink: '#ef4444' },
  { name: 'Blue', ink: '#3b82f6' },
  { name: 'Yellow', ink: '#facc15' },
  { name: 'Green', ink: '#22c55e' },
  { name: 'Purple', ink: '#a855f7' },
  { name: 'White', ink: '#f1f5f9' }
] as const;
/** The shapes on a bomb's label, on its buttons, and tied to its wires. */
export const BOMB_MARKS = ['●', '▲', '■', '◆', '★', '✚'] as const;
export const BOMB_MARK_NAMES = ['Circle', 'Triangle', 'Square', 'Diamond', 'Star', 'Cross'] as const;
/** The signs that are neither a colour nor a shape. */
export const BOMB_WORDS = ['✅', '❌', '⏳', '❓'] as const;
/** Every sign there is, in the order they are sent by: six colours, six shapes, four words. */
export const BOMB_SIGN_COUNT = BOMB_COLOURS.length + BOMB_MARKS.length + BOMB_WORDS.length;

export type BombSign = { kind: 'colour'; i: number } | { kind: 'mark'; i: number } | { kind: 'word'; i: number };
export function bombSign(index: number): BombSign | null {
  if (!Number.isInteger(index) || index < 0 || index >= BOMB_SIGN_COUNT) return null;
  if (index < BOMB_COLOURS.length) return { kind: 'colour', i: index };
  if (index < BOMB_COLOURS.length + BOMB_MARKS.length) return { kind: 'mark', i: index - BOMB_COLOURS.length };
  return { kind: 'word', i: index - BOMB_COLOURS.length - BOMB_MARKS.length };
}

export interface BombWire {
  colour: number;
  /** The shape tied to it, or -1 when its colour alone says which it is. */
  mark: number;
}

export interface BombPage {
  /** The label of the bomb this page is for. */
  tag: number[];
  /** The wires to cut, in order. */
  steps: BombWire[];
  /** The buttons to press after that, in order: their shapes. None on a bomb without buttons. */
  keys: number[];
}

export interface BombLevel {
  level: number;
  tag: number[];
  wires: BombWire[];
  /** The wires to cut, in order: their places among `wires`. */
  cuts: number[];
  /** The buttons as they sit on the bomb: their shapes. */
  pad: number[];
  /** The buttons to press, in order: their places on `pad`. */
  press: number[];
  /** The book: every page, the right one among them. */
  pages: BombPage[];
  truth: number;
  seconds: number;
}

interface Shape {
  wires: number;
  cuts: number;
  pages: number;
  tag: number;
  /** Wires share colours, and are told apart by the shape tied to each. */
  marks: boolean;
  pad: number;
  seconds: number;
}

/** How big a bomb is: small and simple first. */
export function bombShape(level: number): Shape {
  if (level <= 2) return { wires: 3, cuts: 2, pages: 3, tag: 2, marks: false, pad: 0, seconds: 100 };
  if (level <= 5) return { wires: 4, cuts: 3, pages: 4, tag: 2, marks: false, pad: 0, seconds: 90 };
  if (level <= 9) return { wires: 4, cuts: 3, pages: 5, tag: 2, marks: false, pad: 3, seconds: 90 };
  if (level <= 14) return { wires: 5, cuts: 4, pages: 6, tag: 3, marks: true, pad: 4, seconds: 90 };
  if (level <= 24) return { wires: 6, cuts: 4, pages: 6, tag: 3, marks: true, pad: 4, seconds: 80 };
  if (level <= 39) return { wires: 6, cuts: 5, pages: 8, tag: 3, marks: true, pad: 4, seconds: 70 };
  return { wires: 6, cuts: 5, pages: 8, tag: 3, marks: true, pad: 4, seconds: 60 };
}

/** `count` different numbers below `of`, in a thrown order. */
function some(roll: () => number, of: number, count: number): number[] {
  const all = Array.from({ length: of }, (_, i) => i);
  const out: number[] = [];
  while (out.length < count && all.length) out.push(all.splice(duoPick(roll, all.length), 1)[0]);
  return out;
}

const made = new Map<number, BombLevel>();

/** The bomb of a level, and its book: the same on both phones. There is no last level. */
export function bombOf(levelNumber: number): BombLevel {
  const level = Math.max(1, Math.floor(levelNumber) || 1);
  const held = made.get(level);
  if (held) return held;
  const shape = bombShape(level);
  const roll = duoDice((Math.imul(level, 2654435761) + BOMB_MAKING * 7919) >>> 0);

  // The wires: every one its own colour, or - on the harder bombs - colours
  // shared and a shape tied to each, no two wires the same in both.
  const wires: BombWire[] = [];
  if (!shape.marks) {
    for (const colour of some(roll, BOMB_COLOURS.length, shape.wires)) wires.push({ colour, mark: -1 });
  } else {
    const colours = some(roll, BOMB_COLOURS.length, Math.max(2, shape.wires - 2));
    const used = new Set<string>();
    while (wires.length < shape.wires) {
      const colour = colours[wires.length < colours.length ? wires.length : duoPick(roll, colours.length)];
      const mark = duoPick(roll, BOMB_MARKS.length);
      if (used.has(`${colour}:${mark}`)) continue;
      used.add(`${colour}:${mark}`);
      wires.push({ colour, mark });
    }
    // Not left in the order they were made in, which put one of each colour first.
    for (let i = wires.length - 1; i > 0; i--) {
      const j = duoPick(roll, i + 1);
      [wires[i], wires[j]] = [wires[j], wires[i]];
    }
  }
  const cuts = some(roll, shape.wires, shape.cuts);
  const pad = some(roll, BOMB_MARKS.length, shape.pad);
  const press = some(roll, shape.pad, shape.pad);
  const tag = some(roll, BOMB_MARKS.length, shape.tag);

  const truth: BombPage = { tag, steps: cuts.map(i => wires[i]), keys: press.map(i => pad[i]) };
  const pages: BombPage[] = [truth];
  const tags = new Set<string>([tag.join()]);
  const anyWire = (): BombWire => ({ colour: duoPick(roll, BOMB_COLOURS.length), mark: shape.marks ? duoPick(roll, BOMB_MARKS.length) : -1 });
  for (let guard = 0; pages.length < shape.pages && guard < 500; guard++) {
    // The first few wrong pages are near misses: the same shapes another way
    // round, or all but one of them - so the label has to be told with care.
    let other: number[];
    const n = pages.length;
    if (n === 1) other = [...tag].reverse();
    else if (n === 2) other = tag.map((mark, i) => (i === tag.length - 1 ? (mark + 1 + duoPick(roll, BOMB_MARKS.length - 1)) % BOMB_MARKS.length : mark));
    else other = some(roll, BOMB_MARKS.length, shape.tag);
    if (new Set(other).size !== other.length || tags.has(other.join())) continue;
    tags.add(other.join());
    // What a wrong page says to do: mostly this bomb's own wires in another
    // order, so it looks every bit as likely as the right one.
    const order = some(roll, shape.wires, shape.cuts);
    let steps = order.map(i => (roll() < 0.75 ? wires[i] : anyWire()));
    if (steps.every((step, i) => step === truth.steps[i])) steps = [...steps].reverse();
    const keys = some(roll, shape.pad, shape.pad).map(i => pad[i]);
    pages.push({ tag: other, steps, keys });
  }
  // The right page is not always the first.
  const order = some(roll, pages.length, pages.length);
  const shuffled = order.map(i => pages[i]);
  const bomb: BombLevel = { level, tag, wires, cuts, pad, press, pages: shuffled, truth: shuffled.indexOf(truth), seconds: shape.seconds };
  if (made.size > 40) made.clear();
  made.set(level, bomb);
  return bomb;
}

/** Forgets the bombs already made (for the tests). */
export function forgetBombsForTest() {
  made.clear();
}

/** Who has the bomb on a level: you take it in turns, the first seat on the odd ones. */
export const defuserOf = (level: number): Seat => (level % 2 === 1 ? 'user' : 'partner');

// --------------------------------------------------------------- a bomb, live

export const BOMB_STRIKES = 3;
/** What a mistake costs, besides the strike. */
export const BOMB_PENALTY_S = 8;

/** A bomb being worked on, as the phone that has it keeps it. */
export interface BombRun {
  level: number;
  /** Which go at this level it is: a new go is a new clock. 0 before any. */
  e: number;
  /** The wires cut so far: their places among the bomb's wires. */
  cut: number[];
  /** How many of its buttons have been pressed, in order. */
  pressed: number;
  strikes: number;
  /** Seconds left on the clock. */
  left: number;
  /** Still going (0), made safe (1), or gone off (2). */
  over: 0 | 1 | 2;
}

export const newRun = (bomb: BombLevel, e: number): BombRun => ({ level: bomb.level, e, cut: [], pressed: 0, strikes: 0, left: bomb.seconds, over: 0 });

const wiresDone = (run: BombRun, bomb: BombLevel) => run.cut.length >= bomb.cuts.length;

function struck(run: BombRun): BombRun {
  const strikes = run.strikes + 1;
  const left = Math.max(0, run.left - BOMB_PENALTY_S);
  return { ...run, strikes, left, over: strikes >= BOMB_STRIKES || left <= 0 ? 2 : 0 };
}

export type BombTouch = 'ok' | 'wrong' | 'safe' | 'boom' | 'nothing';

/** A wire cut. Cutting the wrong one is a strike, and leaves it whole. */
export function cutWire(run: BombRun, bomb: BombLevel, wire: number): { run: BombRun; did: BombTouch } {
  if (run.over || wire < 0 || wire >= bomb.wires.length || run.cut.includes(wire) || wiresDone(run, bomb)) return { run, did: 'nothing' };
  if (bomb.cuts[run.cut.length] !== wire) {
    const next = struck(run);
    return { run: next, did: next.over ? 'boom' : 'wrong' };
  }
  const next: BombRun = { ...run, cut: [...run.cut, wire] };
  if (wiresDone(next, bomb) && !bomb.press.length) return { run: { ...next, over: 1 }, did: 'safe' };
  return { run: next, did: 'ok' };
}

/** A button pressed, once the wires are done. The wrong one is a strike, and the buttons start again. */
export function pressKey(run: BombRun, bomb: BombLevel, key: number): { run: BombRun; did: BombTouch } {
  if (run.over || !wiresDone(run, bomb) || key < 0 || key >= bomb.pad.length || run.pressed >= bomb.press.length) return { run, did: 'nothing' };
  // One already pressed, pressed again: nothing.
  if (bomb.press.slice(0, run.pressed).includes(key)) return { run, did: 'nothing' };
  if (bomb.press[run.pressed] !== key) {
    const next = struck({ ...run, pressed: 0 });
    return { run: next, did: next.over ? 'boom' : 'wrong' };
  }
  const pressed = run.pressed + 1;
  if (pressed >= bomb.press.length) return { run: { ...run, pressed, over: 1 }, did: 'safe' };
  return { run: { ...run, pressed }, did: 'ok' };
}

/** The clock run down by this much. At nothing, it goes off. */
export function ticked(run: BombRun, seconds: number): BombRun {
  if (run.over || seconds <= 0) return run;
  const left = Math.max(0, run.left - seconds);
  return { ...run, left, over: left <= 0 ? 2 : 0 };
}

/** What goes down the unkept channel. */
export interface BombSaid {
  /** How the bomb stands, from the phone that has it. */
  run?: BombRun;
  /** A sign: its place among all the signs. */
  sign?: number;
  /** From the one with the book: start this level. */
  go?: number;
}

export const runToWire = (run: BombRun) => ({ l: run.level, e: run.e, c: run.cut, p: run.pressed, x: run.strikes, t: Math.round(run.left * 10), o: run.over });

/** Only what a bomb could have said. */
export function cleanBombSaid(raw: unknown): BombSaid | null {
  const r = raw as { s?: unknown; g?: unknown; go?: unknown } | null;
  if (!r || typeof r !== 'object') return null;
  const said: BombSaid = {};
  const s = r.s as { l?: unknown; e?: unknown; c?: unknown; p?: unknown; x?: unknown; t?: unknown; o?: unknown } | undefined;
  if (s && typeof s === 'object') {
    const level = duoInt(s.l, 1, 1_000_000);
    const e = duoInt(s.e, 0, 1_000_000_000);
    const pressed = duoInt(s.p, 0, 8);
    const strikes = duoInt(s.x, 0, BOMB_STRIKES);
    const tenths = duoInt(s.t, 0, 100_000);
    const over = duoInt(s.o, 0, 2);
    const cut = Array.isArray(s.c) && s.c.length <= 8 && s.c.every(i => duoInt(i, 0, 7) !== null) ? (s.c as number[]) : null;
    if (level !== null && e !== null && pressed !== null && strikes !== null && tenths !== null && over !== null && cut && new Set(cut).size === cut.length) {
      said.run = { level, e, cut: [...cut], pressed, strikes, left: tenths / 10, over: over as 0 | 1 | 2 };
    }
  }
  const sign = duoInt(r.g, 0, BOMB_SIGN_COUNT - 1);
  if (sign !== null) said.sign = sign;
  const go = duoInt(r.go, 1, 1_000_000);
  if (go !== null) said.go = go;
  return said.run || said.sign !== undefined || said.go !== undefined ? said : null;
}

/** Whether `b` is later word about the bomb than `a`. */
export function laterRun(a: BombRun | null, b: BombRun): boolean {
  if (!a) return true;
  if (b.level !== a.level) return b.level > a.level;
  if (b.e !== a.e) return b.e > a.e;
  if (a.over && !b.over) return false;
  if (b.over && !a.over) return true;
  // A wrong button puts the buttons back to none pressed: the strike is what says it is later.
  if (b.strikes !== a.strikes) return b.strikes > a.strikes;
  return b.cut.length + b.pressed >= a.cut.length + a.pressed;
}
