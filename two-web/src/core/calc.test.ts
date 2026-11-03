import { describe, expect, it } from 'vitest';
import {
  CALC_START,
  DIVIDE_BY_ZERO,
  MAX_DIGITS,
  endsWithCode,
  pressBack,
  pressDigit,
  pressEquals,
  pressOp,
  pressPercent,
  pressPoint,
  pressSign,
  preview,
  showNumber,
  showSum,
  type CalcState,
  type Op
} from './calc';

/** Types keys as a person would: digits, ., + − × ÷, = , ⌫ as <, AC as C, ± as ~ and %. */
function type(keys: string, from: CalcState = CALC_START): CalcState {
  let s = from;
  for (const k of keys) {
    if (/\d/.test(k)) s = pressDigit(s, k);
    else if (k === '.') s = pressPoint(s);
    else if (k === '=') s = pressEquals(s);
    else if (k === '<') s = pressBack(s);
    else if (k === 'C') s = CALC_START;
    else if (k === '~') s = pressSign(s);
    else if (k === '%') s = pressPercent(s);
    else s = pressOp(s, k as Op);
  }
  return s;
}
const shown = (s: CalcState) => (s.answered ? showNumber(Number(s.parts[0])) : showSum(s.parts));

describe('a real calculator', () => {
  it('chains a sum: 1 + 2 + 3 = 6', () => {
    expect(shown(type('1+2+3='))).toBe('6');
  });

  it('does × and ÷ before + and −', () => {
    expect(shown(type('2+3×4='))).toBe('14');
    expect(shown(type('10−6÷2='))).toBe('7');
  });

  it('keeps decimals clean', () => {
    expect(shown(type('0.1+0.2='))).toBe('0.3');
    expect(shown(type('1÷3='))).toBe('0.333333333333');
  });

  it('says so when dividing by zero, and starts afresh on the next key', () => {
    const s = type('5÷0=');
    expect(s.error).toBe(DIVIDE_BY_ZERO);
    expect(shown(type('7', s))).toBe('7');
  });

  it('repeats the last step on another =', () => {
    expect(shown(type('2+3=='))).toBe('8');
    expect(shown(type('2+3==='))).toBe('11');
    expect(shown(type('2+3×4=='))).toBe('56');
  });

  it('carries on from an answer with an operator, and starts afresh with a digit', () => {
    expect(shown(type('2+3=×2='))).toBe('10');
    expect(shown(type('2+3=7'))).toBe('7');
  });

  it('takes the last operator when two are pressed in a row', () => {
    expect(shown(type('5+×2='))).toBe('10');
  });

  it('shows the answer so far, once there is something to work out', () => {
    expect(preview(type('12+7×3'))).toBe(33);
    expect(preview(type('12+'))).toBeNull();
    expect(preview(type('12'))).toBeNull();
    expect(preview(type('8÷0'))).toBeNull();
  });

  it('works out a share after + or −, a hundredth otherwise', () => {
    expect(shown(type('200+10%='))).toBe('220');
    expect(shown(type('200−10%='))).toBe('180');
    expect(shown(type('50×10%='))).toBe('5');
    expect(shown(type('50%'))).toBe('0.5');
  });

  it('flips the sign of the number being typed', () => {
    expect(shown(type('5~'))).toBe('−5');
    expect(shown(type('5+~3='))).toBe('2');
    expect(shown(type('~4'))).toBe('−4');
  });

  it('groups thousands, and writes huge answers short', () => {
    expect(shown(type('1234567.50'))).toBe('1,234,567.50');
    expect(shown(type('1000000000×1000000000='))).toBe('1E18');
    expect(showNumber(-0.0000002)).toBe('−2E−7');
  });

  it('stops a number at the digits it can hold', () => {
    expect(type('9'.repeat(MAX_DIGITS + 3)).parts[0]).toBe('9'.repeat(MAX_DIGITS));
  });
});

describe('⌫ and AC', () => {
  it('⌫ takes back one key at a time', () => {
    expect(shown(type('123<'))).toBe('12');
    expect(shown(type('12+<'))).toBe('12');
    expect(shown(type('12+3<'))).toBe('12 +');
    expect(shown(type('7<'))).toBe('0');
    expect(shown(type('7<<<'))).toBe('0');
  });

  it('⌫ after an answer edits the answer', () => {
    const s = type('120+3=<');
    expect(s.answered).toBe(false);
    expect(shown(s)).toBe('12');
  });

  it('AC clears everything', () => {
    expect(type('12+3×4C')).toEqual(CALC_START);
  });
});

describe('the unlock code', () => {
  it('is matched against the keys as typed, leading zeros and all', () => {
    expect(endsWithCode(type('142.85').keys, '142.85')).toBe(true);
    expect(endsWithCode(type('0042').keys, '0042')).toBe(true);
    expect(endsWithCode(type('5+142.85').keys, '142.85')).toBe(true);
  });

  it('can be put right with ⌫', () => {
    expect(endsWithCode(type('142.86<5').keys, '142.85')).toBe(true);
    expect(endsWithCode(type('142.856').keys, '142.85')).toBe(false);
  });

  it('reads a code written with * or / or a minus sign as the keys would type it', () => {
    expect(endsWithCode(type('7×3').keys, '7*3')).toBe(true);
    expect(endsWithCode(type('8÷2').keys, '8/2')).toBe(true);
    expect(endsWithCode(type('9−1').keys, '9-1')).toBe(true);
  });

  it('is forgotten after AC or an answer', () => {
    expect(endsWithCode(type('142.85C').keys, '142.85')).toBe(false);
    expect(endsWithCode(type('1+1=').keys, '1+1')).toBe(false);
    expect(endsWithCode('', '')).toBe(false);
  });
});
