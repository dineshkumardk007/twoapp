import React, { useState, useEffect, useRef } from 'react';

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

  return (
    <div className="min-h-screen app-min-vh bg-neutral-900 text-white flex flex-col items-center justify-center p-4 selection:bg-none">
      <div className="w-full max-w-xs bg-neutral-950 rounded-3xl p-6 shadow-2xl border border-neutral-800 space-y-5">
        {/* Camouflage Mode Header Info */}
        <div className="flex items-center justify-between text-neutral-500 text-[11px] px-1">
          <span className="font-mono">DEG</span>
          <span
            className="opacity-40 hover:opacity-100 transition-opacity cursor-default"
            title={`Discreet Unlock: Type ${(secretPin || '142.85').replace(/=/g, '')} then press =`}
          >
            ●
          </span>
        </div>

        {/* Calculator Display Screen.
            Also the escape hatch: held for five seconds it offers a way out,
            for whoever forgot the code. Nothing about it looks pressable. */}
        <div
          className="text-right py-4 px-2 overflow-hidden select-none"
          onPointerDown={beginHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={e => e.preventDefault()}
        >
          <span className="font-mono text-4xl sm:text-5xl font-light tracking-tight text-white block truncate">
            {display}
          </span>
        </div>

        {askingEscape && onEscape && (
          <div className="rounded-2xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
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

        {/* Keypad Grid */}
        <div className="grid grid-cols-4 gap-2.5 text-sm font-medium select-none">
          <button
            onClick={handleClear}
            className="p-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
          >
            AC
          </button>
          <button
            onClick={handleToggleSign}
            className="p-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
          >
            ±
          </button>
          <button
            onClick={handlePercent}
            className="p-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
          >
            %
          </button>
          <button
            onClick={() => handleOperation('÷')}
            className="p-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
          >
            ÷
          </button>

          <button
            onClick={() => handleDigit('7')}
            className="p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-white text-base transition-colors"
          >
            7
          </button>
          <button
            onClick={() => handleDigit('8')}
            className="p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-white text-base transition-colors"
          >
            8
          </button>
          <button
            onClick={() => handleDigit('9')}
            className="p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-white text-base transition-colors"
          >
            9
          </button>
          <button
            onClick={() => handleOperation('×')}
            className="p-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
          >
            ×
          </button>

          <button
            onClick={() => handleDigit('4')}
            className="p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-white text-base transition-colors"
          >
            4
          </button>
          <button
            onClick={() => handleDigit('5')}
            className="p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-white text-base transition-colors"
          >
            5
          </button>
          <button
            onClick={() => handleDigit('6')}
            className="p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-white text-base transition-colors"
          >
            6
          </button>
          <button
            onClick={() => handleOperation('-')}
            className="p-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
          >
            -
          </button>

          <button
            onClick={() => handleDigit('1')}
            className="p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-white text-base transition-colors"
          >
            1
          </button>
          <button
            onClick={() => handleDigit('2')}
            className="p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-white text-base transition-colors"
          >
            2
          </button>
          <button
            onClick={() => handleDigit('3')}
            className="p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-white text-base transition-colors"
          >
            3
          </button>
          <button
            onClick={() => handleOperation('+')}
            className="p-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
          >
            +
          </button>

          <button
            onClick={() => handleDigit('0')}
            className="col-span-2 p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-white text-base transition-colors text-left pl-6"
          >
            0
          </button>
          <button
            onClick={handleDecimal}
            className="p-3.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-700 text-white text-base transition-colors"
          >
            .
          </button>
          <button
            onClick={handleEquals}
            className="p-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
          >
            =
          </button>
        </div>

        {/* Subtle Disguise Indicator */}
        <p className="text-[10px] text-neutral-600 text-center pt-2">
          Standard Calculator App • v2.4.1
        </p>
      </div>
    </div>
  );
};
