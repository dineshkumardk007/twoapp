// The calculator the disguise is (components/CalculatorDecoy): a real one,
// as on a phone. Sums chain, × and ÷ come before + and −, the answer shows
// in grey as you type, = again repeats the last step, ⌫ takes back one key
// and AC everything.
//
// Every key is a pure step from one state to the next, so the arithmetic is
// tested on its own (calc.test.ts) and the screen only draws what it is given.

export type Op = '+' | '−' | '×' | '÷';
const OPS: readonly string[] = ['+', '−', '×', '÷'];
export const isOp = (s: string | undefined): s is Op => !!s && OPS.includes(s);

/** The most digits a number can be typed with: as many as the phone's arithmetic holds exactly. */
export const MAX_DIGITS = 15;
export const DIVIDE_BY_ZERO = "Can't divide by 0";
export const TOO_BIG = 'Too big';

export interface CalcState {
  /** The sum as typed: numbers (as typed - maybe ending in '.') and operators, alternating. ['0'] at rest. */
  parts: string[];
  /** Just answered with =: parts[0] is the answer. A digit starts afresh; an operator carries on from it. */
  answered: boolean;
  /** The sum that was answered, shown small above its answer. */
  asked: string;
  /** What another = repeats: the last step of the sum just answered. */
  repeat: { op: Op; n: number } | null;
  /** Shown instead of a number until the next key. */
  error: string | null;
  /**
   * Every key typed since the last AC or =, just as typed - "0042" stays
   * "0042" - and less any ⌫. The unlock code is checked against this.
   */
  keys: string;
}

export const CALC_START: CalcState = { parts: ['0'], answered: false, asked: '', repeat: null, error: null, keys: '' };

const tail = (parts: string[]) => parts[parts.length - 1];
const digitsIn = (n: string) => n.replace(/[^0-9]/g, '').length;

/** Rounds away the binary noise of decimals: 0.1 + 0.2 is 0.3, not 0.30000000000000004. */
export const tidy = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(12)) : v);

/** A typed number made whole before an operator follows it: "5." is 5, "-0" is 0. */
function settle(n: string): string {
  let s = n.endsWith('.') ? n.slice(0, -1) : n;
  if (s === '-0' || s === '-' || s === '') s = '0';
  return s;
}

/** The sum's value, × and ÷ first. Null when it divides by zero. */
export function evaluate(parts: string[]): number | null {
  const p = isOp(tail(parts)) ? parts.slice(0, -1) : parts;
  const terms: number[] = [Number(settle(p[0]))];
  const adds: Op[] = [];
  for (let i = 1; i + 1 < p.length; i += 2) {
    const op = p[i] as Op;
    const n = Number(settle(p[i + 1]));
    if (op === '×') terms[terms.length - 1] *= n;
    else if (op === '÷') {
      if (n === 0) return null;
      terms[terms.length - 1] /= n;
    } else {
      adds.push(op);
      terms.push(n);
    }
  }
  let v = terms[0];
  adds.forEach((op, i) => {
    v = op === '+' ? v + terms[i + 1] : v - terms[i + 1];
  });
  return tidy(v);
}

const asAnswer = (v: number) => String(Object.is(v, -0) ? 0 : v);

export function pressDigit(s: CalcState, d: string): CalcState {
  if (s.error || s.answered) return { ...CALC_START, parts: [d], keys: d };
  const keys = s.keys + d;
  const parts = [...s.parts];
  const t = tail(parts);
  if (isOp(t)) parts.push(d);
  else if (t === '0') parts[parts.length - 1] = d;
  else if (t === '-0') parts[parts.length - 1] = '-' + d;
  else if (digitsIn(t) >= MAX_DIGITS) return { ...s, keys };
  else parts[parts.length - 1] = t + d;
  return { ...s, parts, keys };
}

export function pressPoint(s: CalcState): CalcState {
  if (s.error || s.answered) return { ...CALC_START, parts: ['0.'], keys: '.' };
  const keys = s.keys + '.';
  const parts = [...s.parts];
  const t = tail(parts);
  if (isOp(t)) parts.push('0.');
  else if (!t.includes('.')) parts[parts.length - 1] = t + '.';
  return { ...s, parts, keys };
}

export function pressOp(s: CalcState, op: Op): CalcState {
  if (s.error) return s;
  // The code was always checked with a plain hyphen for minus.
  const keys = s.keys + (op === '−' ? '-' : op);
  if (s.answered) return { ...s, parts: [s.parts[0], op], answered: false, asked: '', repeat: null, keys };
  const parts = [...s.parts];
  const t = tail(parts);
  // Another operator straight after one: a change of mind.
  if (isOp(t)) parts[parts.length - 1] = op;
  else {
    parts[parts.length - 1] = settle(t);
    parts.push(op);
  }
  return { ...s, parts, keys };
}

/** ⌫: one key back. After an answer, the answer becomes the number being typed. */
export function pressBack(s: CalcState): CalcState {
  if (s.error) return CALC_START;
  const keys = s.keys.slice(0, -1);
  let parts = [...s.parts];
  if (s.answered) {
    if (/e/i.test(parts[0])) return CALC_START;
    parts = [parts[0]];
  }
  const t = tail(parts);
  if (isOp(t)) parts.pop();
  else {
    const shorter = t.slice(0, -1);
    if (shorter === '' || shorter === '-') {
      if (parts.length === 1) parts[0] = '0';
      else parts.pop();
    } else parts[parts.length - 1] = shorter;
  }
  return { ...s, parts, answered: false, asked: '', repeat: null, keys };
}

/** ±: flips the number being typed, or the answer. */
export function pressSign(s: CalcState): CalcState {
  if (s.error) return s;
  const parts = [...s.parts];
  if (s.answered) {
    parts[0] = asAnswer(-Number(parts[0]));
    return { ...s, parts, repeat: null };
  }
  const t = tail(parts);
  if (isOp(t)) parts.push('-0');
  else parts[parts.length - 1] = t.startsWith('-') ? t.slice(1) : '-' + t;
  return { ...s, parts };
}

/**
 * %: a hundredth - or, after + or −, that share of what comes before it, as a
 * phone does it: 200 + 10% is 200 + 20.
 */
export function pressPercent(s: CalcState): CalcState {
  if (s.error) return s;
  const parts = [...s.parts];
  if (s.answered) {
    parts[0] = asAnswer(tidy(Number(parts[0]) / 100));
    return { ...s, parts, repeat: null };
  }
  const t = tail(parts);
  if (isOp(t)) return s;
  const n = Number(settle(t));
  const before = parts.length >= 3 ? parts[parts.length - 2] : null;
  const left = before === '+' || before === '−' ? evaluate(parts.slice(0, -2)) : null;
  parts[parts.length - 1] = asAnswer(tidy(left !== null ? (left * n) / 100 : n / 100));
  return { ...s, parts };
}

function apply(a: number, op: Op, b: number): number | null {
  if (op === '÷' && b === 0) return null;
  return tidy(op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b);
}

function answer(s: CalcState, v: number | null, asked: string, repeat: CalcState['repeat']): CalcState {
  if (v === null) return { ...CALC_START, error: DIVIDE_BY_ZERO };
  if (!Number.isFinite(v)) return { ...CALC_START, error: TOO_BIG };
  return { ...s, parts: [asAnswer(v)], answered: true, asked, repeat, error: null, keys: '' };
}

/** =: the answer. Pressed again, the last step again: 2 + 3 = 5, = 8, = 11. */
export function pressEquals(s: CalcState): CalcState {
  if (s.error) return CALC_START;
  if (s.answered) {
    if (!s.repeat) return s;
    const a = Number(s.parts[0]);
    return answer(s, apply(a, s.repeat.op, s.repeat.n), showSum([s.parts[0], s.repeat.op, String(s.repeat.n)]), s.repeat);
  }
  const parts = isOp(tail(s.parts)) ? s.parts.slice(0, -1) : s.parts;
  // A number on its own: nothing to work out.
  if (parts.length < 3) return { ...s, parts: [settle(parts[0])], keys: '' };
  const done = parts.map((p, i) => (i % 2 ? p : settle(p)));
  return answer(s, evaluate(done), showSum(done), { op: done[done.length - 2] as Op, n: Number(done[done.length - 1]) });
}

/** The answer so far, shown in grey under the sum - once there is an operator to work out. */
export function preview(s: CalcState): number | null {
  if (s.answered || s.error) return null;
  const parts = isOp(tail(s.parts)) ? s.parts.slice(0, -1) : s.parts;
  if (parts.length < 3) return null;
  const v = evaluate(parts);
  return v !== null && Number.isFinite(v) ? v : null;
}

/** A number as typed, thousands marked: "-1234.50" is "−1,234.50". */
export function showTyped(n: string): string {
  if (/e/i.test(n)) return showNumber(Number(n));
  const negative = n.startsWith('-');
  const [whole, fraction] = (negative ? n.slice(1) : n).split('.');
  return (negative ? '−' : '') + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction !== undefined ? '.' + fraction : '');
}

/** An answer: grouped, and very big or very small ones as 1.5E21. */
export function showNumber(v: number): string {
  if (Object.is(v, -0)) v = 0;
  const size = Math.abs(v);
  if (size !== 0 && (size >= 1e15 || size < 1e-6)) {
    const [mantissa, exponent] = v.toExponential(9).split('e');
    const m = mantissa.replace(/\.?0+$/, '');
    return `${m.replace('-', '−')}E${exponent.replace('+', '').replace('-', '−')}`;
  }
  return showTyped(String(tidy(v)));
}

/** The sum as it reads: "12 + 7 × 3". */
export function showSum(parts: string[]): string {
  return parts.map(p => (isOp(p) ? p : showTyped(p))).join(' ');
}

/**
 * Whether the keys typed end with the unlock code. Spaces, = and thousands
 * marks are ignored, and * / x read as × ÷ ×, so a code set as "7*3" works
 * however it was written.
 */
export function endsWithCode(keys: string, code: string): boolean {
  const plain = (x: string) =>
    x
      .replace(/[\s=,]/g, '')
      .replace(/[*xX]/g, '×')
      .replace(/\//g, '÷')
      .replace(/−/g, '-');
  const c = plain(code);
  return c.length > 0 && plain(keys).endsWith(c);
}
