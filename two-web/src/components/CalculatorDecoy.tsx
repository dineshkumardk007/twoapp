import React, { useState, useEffect, useRef } from 'react';
import { haptic } from '../core/haptics';

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

export const CalculatorDecoy: React.FC<CalculatorDecoyProps> = ({
  onUnlock,
  secretPin = '142.85',
  onEscape
}) => {
  const [askingEscape, setAskingEscape] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [clearOnNextDigit, setClearOnNextDigit] = useState(false);
  const [inputHistory, setInputHistory] = useState<string>('');

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

  const handleDigit = (digit: string) => {
    setInputHistory(prev => prev + digit);
    if (display === '0' || clearOnNextDigit) {
      setDisplay(digit);
      setClearOnNextDigit(false);
    } else {
      setDisplay(display + digit);
    }
  };

  const handleDecimal = () => {
    setInputHistory(prev => prev + '.');
    if (clearOnNextDigit) {
      setDisplay('0.');
      setClearOnNextDigit(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setInputHistory('');
  };

  const handleOperation = (op: string) => {
    setInputHistory(prev => prev + op);
    setPrevValue(parseFloat(display));
    setOperation(op);
    setClearOnNextDigit(true);
  };

  const handleEquals = () => {
    // Check if secret unlock sequence was typed
    const cleanPin = (secretPin || '142.85').replace(/=/g, '').trim();
    if (
      display === secretPin ||
      display === cleanPin ||
      inputHistory.endsWith(secretPin) ||
      inputHistory.endsWith(cleanPin)
    ) {
      onUnlock();
      return;
    }

    if (operation && prevValue !== null) {
      const current = parseFloat(display);
      let result = 0;
      switch (operation) {
        case '+': result = prevValue + current; break;
        case '-': result = prevValue - current; break;
        case '×': result = prevValue * current; break;
        case '÷': result = current !== 0 ? prevValue / current : 0; break;
      }
      setDisplay(String(Number(result.toFixed(6))));
      setPrevValue(null);
      setOperation(null);
      setClearOnNextDigit(true);
      setInputHistory('');
    }
  };

  // The operation waiting for its second number shows lit, as on a phone's own calculator.
  const opChosen = (op: string) => operation === op && clearOnNextDigit;

  const handleToggleSign = () => {
    setDisplay(String(parseFloat(display) * -1));
  };

  const handlePercent = () => {
    setDisplay(String(parseFloat(display) / 100));
  };

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

        {/* Calculator Display Screen.
            Also the escape hatch: held for five seconds it offers a way out,
            for whoever forgot the code. Nothing about it looks pressable. */}
        <div
          className="flex min-h-0 flex-1 items-end justify-end overflow-hidden px-6 pb-4 text-right"
          onPointerDown={beginHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={e => e.preventDefault()}
        >
          <span className="block w-full truncate font-mono text-5xl font-light tracking-tight text-white sm:text-6xl">
            {display}
          </span>
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
          <CalcKey tone="fn" onPress={handleClear}>AC</CalcKey>
          <CalcKey tone="fn" onPress={handleToggleSign}>±</CalcKey>
          <CalcKey tone="fn" onPress={handlePercent}>%</CalcKey>
          <CalcKey tone="op" chosen={opChosen('÷')} onPress={() => handleOperation('÷')}>÷</CalcKey>

          <CalcKey onPress={() => handleDigit('7')}>7</CalcKey>
          <CalcKey onPress={() => handleDigit('8')}>8</CalcKey>
          <CalcKey onPress={() => handleDigit('9')}>9</CalcKey>
          <CalcKey tone="op" chosen={opChosen('×')} onPress={() => handleOperation('×')}>×</CalcKey>

          <CalcKey onPress={() => handleDigit('4')}>4</CalcKey>
          <CalcKey onPress={() => handleDigit('5')}>5</CalcKey>
          <CalcKey onPress={() => handleDigit('6')}>6</CalcKey>
          <CalcKey tone="op" chosen={opChosen('-')} onPress={() => handleOperation('-')}>-</CalcKey>

          <CalcKey onPress={() => handleDigit('1')}>1</CalcKey>
          <CalcKey onPress={() => handleDigit('2')}>2</CalcKey>
          <CalcKey onPress={() => handleDigit('3')}>3</CalcKey>
          <CalcKey tone="op" chosen={opChosen('+')} onPress={() => handleOperation('+')}>+</CalcKey>

          <CalcKey wide onPress={() => handleDigit('0')}>0</CalcKey>
          <CalcKey onPress={handleDecimal}>.</CalcKey>
          <CalcKey tone="op" onPress={handleEquals}>=</CalcKey>
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
  /** The 0, two keys wide. */
  wide?: boolean;
  children: React.ReactNode;
}

/**
 * One key. It acts on the finger landing (pointerdown) - a click comes only
 * when the finger lifts, which made fast typing feel late and sticky - with a
 * tick from the phone and a press drawn at once (index.css, .calc-key). A
 * keyboard's Enter or Space still works through the click, which a pointer's
 * press never reaches twice: that click has a `detail` of 1 or more.
 */
const CalcKey: React.FC<CalcKeyProps> = ({ onPress, tone = 'digit', chosen, wide, children }) => {
  const up = (e: React.PointerEvent<HTMLButtonElement>) => {
    delete e.currentTarget.dataset.down;
  };
  return (
    <button
      type="button"
      data-tone={tone}
      data-chosen={chosen || undefined}
      onPointerDown={e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.currentTarget.dataset.down = '';
        haptic('key');
        onPress();
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onClick={e => {
        if (e.detail === 0) onPress();
      }}
      onContextMenu={e => e.preventDefault()}
      className={`calc-key flex items-center rounded-2xl ${
        wide ? 'col-span-2 justify-start pl-6' : 'justify-center'
      } ${tone === 'fn' ? 'text-xl' : tone === 'op' ? 'text-2xl font-semibold' : 'text-2xl'}`}
    >
      {children}
    </button>
  );
};
