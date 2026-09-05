import React, { useState, useEffect } from 'react';

interface CalculatorDecoyProps {
  onUnlock: () => void;
  secretPin?: string;
}

export const CalculatorDecoy: React.FC<CalculatorDecoyProps> = ({
  onUnlock,
  secretPin = '142.85'
}) => {
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
    if (display === secretPin || inputHistory.endsWith(secretPin)) {
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

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4 selection:bg-none">
      <div className="w-full max-w-xs bg-neutral-950 rounded-3xl p-6 shadow-2xl border border-neutral-800 space-y-5">
        {/* Camouflage Mode Header Info */}
        <div className="flex items-center justify-between text-neutral-500 text-[11px] px-1">
          <span className="font-mono">DEG</span>
          <span className="opacity-40 hover:opacity-100 transition-opacity cursor-default" title="Discreet Unlock: Type 142.85 then press =">
            ●
          </span>
        </div>

        {/* Calculator Display Screen */}
        <div className="text-right py-4 px-2 overflow-hidden">
          <span className="font-mono text-4xl sm:text-5xl font-light tracking-tight text-white block truncate">
            {display}
          </span>
        </div>

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
