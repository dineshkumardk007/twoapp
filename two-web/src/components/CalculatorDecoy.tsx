import React, { useState, useEffect, useRef } from 'react';
import { Delete } from 'lucide-react';
import { haptic } from '../core/haptics';
import {
  CALC_START,
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
} from '../core/calc';

interface CalculatorDecoyProps {
  onUnlock: () => void;
  secretPin?: string;
  /**
   * The way back in when the code has been forgotten.
   *
   * Reached by holding the display down, which is not something anyone does to
   * a calculator by accident. Without it, a mistyped or forgotten code makes
   * the vault on this device unreachable except by reinstalling, which erases
   * it - the disguise would have become a lock with no key.
   */
  onEscape?: () => void;
}

const ESCAPE_HOLD_MS = 5000;
/** Holding ⌫ keeps deleting: after this long, then every BACK_EVERY_MS. */
const BACK_HOLD_MS = 420;
const BACK_EVERY_MS = 70;

/** How big the main line is drawn, stepping down as it grows so it always fits. */
function fit(text: string): string {
  const n = text.length;
  return n <= 8 ? '1' : n <= 11 ? '2' : n <= 15 ? '3' : n <= 21 ? '4' : '5';
}

export const CalculatorDecoy: React.FC<CalculatorDecoyProps> = ({
  onUnlock,
  secretPin = '142.85',
  onEscape
}) => {
  const [askingEscape, setAskingEscape] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [calc, setCalc] = useState<CalcState>(CALC_START);
  // Kept in step at once, so keys pressed faster than the screen redraws
  // each build on the one before.
  const calcRef = useRef(calc);
  // Each answer arrives with a little rise (index.css, calc-answer-in).
  const [answers, setAnswers] = useState(0);

  // Dynamically disguise page title and favicon
  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Calculator';

    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    let originalFavicon = '';
    if (link) {
      originalFavicon = link.href;
      link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔢</text></svg>";
    }

    return () => {
      document.title = originalTitle;
      if (link && originalFavicon) {
        link.href = originalFavicon;
      }
    };
  }, []);

  const act = (step: (s: CalcState) => CalcState) => {
    const next = step(calcRef.current);
    calcRef.current = next;
    setCalc(next);
  };

  const equals = () => {
    // The code, typed and then =, opens Two.
    if (endsWithCode(calcRef.current.keys, secretPin || '142.85')) {
      onUnlock();
      return;
    }
    const next = pressEquals(calcRef.current);
    if (next.answered && next !== calcRef.current) setAnswers(n => n + 1);
    calcRef.current = next;
    setCalc(next);
  };

  const digit = (d: string) => act(s => pressDigit(s, d));
  const operation = (op: Op) => act(s => pressOp(s, op));
  const back = () => act(pressBack);
  const clear = () => act(() => CALC_START);

  // A keyboard works too, as it would on any calculator on a computer.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const ops: Record<string, Op> = { '+': '+', '-': '−', '*': '×', x: '×', X: '×', '/': '÷' };
    if (/^\d$/.test(k)) digit(k);
    else if (k === '.' || k === ',') act(pressPoint);
    else if (ops[k]) operation(ops[k]);
    else if (k === 'Enter' || k === '=') equals();
    else if (k === 'Backspace') back();
    else if (k === 'Escape' || k === 'Delete') clear();
    else if (k === '%') act(pressPercent);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The operation waiting for its second number shows lit, as on a phone's own calculator.
  const waitingOp = !calc.answered && !calc.error && calc.parts.length > 1 ? calc.parts[calc.parts.length - 1] : null;
  const opChosen = (op: Op) => waitingOp === op;

  const main = calc.error ?? (calc.answered ? showNumber(Number(calc.parts[0])) : showSum(calc.parts));
  const soFar = preview(calc);

  const beginHold = () => {
    if (!onEscape || holdTimer.current) return;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      setAskingEscape(true);
    }, ESCAPE_HOLD_MS);
  };

  const cancelHold = () => {
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  // A hold interrupted by unmounting must not fire afterwards.
  useEffect(() => cancelHold, []);

  // The whole screen, edge to edge.
  //
  // This used to be a small rounded card floating in the middle of a dark
  // page, which is not what any calculator on a phone looks like - the
  // letterboxing alone said "this is something else pretending". It now fills
  // the display, insets itself for the notch and the home bar, and ends where
  // the screen ends.
  return (
    <div
      className="no-remap fixed inset-0 z-[100] flex flex-col bg-neutral-900 text-white select-none overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div className="shrink-0 px-6 pt-4 font-mono text-[11px] text-neutral-500">DEG</div>

        {/* Calculator Display Screen: the sum as it is typed, the answer so
            far in grey under it, and on = the answer, big, with the sum it
            answers small above.
            Also the escape hatch: held for five seconds it offers a way out,
            for whoever forgot the code. Nothing about it looks pressable. */}
        <div
          className="calc-screen flex min-h-0 flex-1 flex-col items-end justify-end overflow-hidden px-6 pb-5 text-right"
          onPointerDown={beginHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={e => e.preventDefault()}
          aria-live="polite"
        >
          <div key={`a${answers}`} className={`calc-asked${calc.answered ? ' calc-asked-in' : ''}`}>
            {calc.answered ? `${calc.asked} =` : ''}
          </div>
          <div
            key={calc.answered ? `r${answers}` : 'typing'}
            className={`calc-main${calc.answered ? ' calc-answer-in' : ''}`}
            data-fit={calc.error ? 'error' : fit(main)}
          >
            {main}
          </div>
          <div className="calc-preview">{soFar !== null ? showNumber(soFar) : ''}</div>
        </div>

        {askingEscape && onEscape && (
          <div className="mx-4 mb-3 shrink-0 space-y-3 rounded-2xl border border-neutral-700 bg-neutral-950 p-4">
            <p className="text-xs leading-relaxed text-neutral-300">
              Turn off the calculator screen and open Two? You can switch it back
              on in Settings.
            </p>
            <p className="text-[11px] leading-relaxed text-neutral-500">
              If you set a PIN, you will still be asked for it.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setAskingEscape(false)}
                className="flex-1 rounded-xl bg-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setAskingEscape(false);
                  onEscape();
                }}
                className="flex-1 rounded-xl bg-neutral-200 px-3 py-2 text-xs font-medium text-neutral-900 hover:bg-white transition-colors"
              >
                Open Two
              </button>
            </div>
          </div>
        )}

        {/* Keypad. Each key acts the moment a finger lands on it, as the
            phone's own calculator does, with a press you can see and feel -
            not when the finger lifts. */}
        <div
          className="grid shrink-0 grid-cols-4 grid-rows-5 gap-2 px-3 pb-3 font-medium"
          style={{ height: 'min(62vh, 30rem)' }}
        >
          <CalcKey tone="fn" label="All clear" onPress={clear}>AC</CalcKey>
          <CalcKey tone="fn" label="Delete" repeat onPress={back}>
            <Delete className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
          </CalcKey>
          <CalcKey tone="fn" label="Percent" onPress={() => act(pressPercent)}>%</CalcKey>
          <CalcKey tone="op" label="Divide" chosen={opChosen('÷')} onPress={() => operation('÷')}>÷</CalcKey>

          <CalcKey onPress={() => digit('7')}>7</CalcKey>
          <CalcKey onPress={() => digit('8')}>8</CalcKey>
          <CalcKey onPress={() => digit('9')}>9</CalcKey>
          <CalcKey tone="op" label="Multiply" chosen={opChosen('×')} onPress={() => operation('×')}>×</CalcKey>

          <CalcKey onPress={() => digit('4')}>4</CalcKey>
          <CalcKey onPress={() => digit('5')}>5</CalcKey>
          <CalcKey onPress={() => digit('6')}>6</CalcKey>
          <CalcKey tone="op" label="Minus" chosen={opChosen('−')} onPress={() => operation('−')}>−</CalcKey>

          <CalcKey onPress={() => digit('1')}>1</CalcKey>
          <CalcKey onPress={() => digit('2')}>2</CalcKey>
          <CalcKey onPress={() => digit('3')}>3</CalcKey>
          <CalcKey tone="op" label="Plus" chosen={opChosen('+')} onPress={() => operation('+')}>+</CalcKey>

          <CalcKey label="Plus or minus" onPress={() => act(pressSign)}>±</CalcKey>
          <CalcKey onPress={() => digit('0')}>0</CalcKey>
          <CalcKey label="Point" onPress={() => act(pressPoint)}>.</CalcKey>
          <CalcKey tone="op" label="Equals" onPress={equals}>=</CalcKey>
        </div>

        {/* No footer, no version string, no marker of any kind. A line reading
            "Standard Calculator App" is the sort of thing only a disguise
            says, and the header dot carried a tooltip spelling out the unlock
            code. Both are gone; the way in is the code itself, and the way out
            for whoever forgot it is the five-second hold on the display. */}
    </div>
  );
};

interface CalcKeyProps {
  onPress: () => void;
  /** Digits plain; the top row's functions lighter; the operations amber. */
  tone?: 'digit' | 'fn' | 'op';
  /** An operation waiting for its second number. */
  chosen?: boolean;
  /** Read out instead of what is drawn on it. */
  label?: string;
  /** Held down, it keeps going: ⌫. */
  repeat?: boolean;
  children: React.ReactNode;
}

/**
 * One key. It acts on the finger landing (pointerdown) - a click comes only
 * when the finger lifts, which made fast typing feel late and sticky - with a
 * tick from the phone, a press drawn at once and a ripple spreading from
 * under the finger (index.css, .calc-key). A keyboard's Enter or Space still
 * works through the click, which a pointer's press never reaches twice: that
 * click has a `detail` of 1 or more.
 */
const CalcKey: React.FC<CalcKeyProps> = ({ onPress, tone = 'digit', chosen, label, repeat, children }) => {
  const again = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (again.current) clearTimeout(again.current);
    again.current = null;
  };
  useEffect(() => stop, []);
  const up = (e: React.PointerEvent<HTMLButtonElement>) => {
    delete e.currentTarget.dataset.down;
    stop();
  };
  return (
    <button
      type="button"
      data-tone={tone}
      data-chosen={chosen || undefined}
      aria-label={label}
      onPointerDown={e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const key = e.currentTarget;
        const box = key.getBoundingClientRect();
        // The ripple starts under the finger; a fresh name restarts it on every press.
        key.style.setProperty('--rx', `${e.clientX - box.left}px`);
        key.style.setProperty('--ry', `${e.clientY - box.top}px`);
        key.dataset.ripple = key.dataset.ripple === 'a' ? 'b' : 'a';
        key.dataset.down = '';
        haptic('key');
        onPress();
        if (repeat) {
          stop();
          const tick = () => {
            haptic('key');
            onPress();
            again.current = setTimeout(tick, BACK_EVERY_MS);
          };
          again.current = setTimeout(tick, BACK_HOLD_MS);
        }
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onClick={e => {
        if (e.detail === 0) onPress();
      }}
      onContextMenu={e => e.preventDefault()}
      className={`calc-key flex items-center justify-center rounded-2xl ${
        tone === 'fn' ? 'text-xl' : tone === 'op' ? 'text-3xl font-normal' : 'text-[1.7rem]'
      }`}
    >
      {children}
    </button>
  );
};
