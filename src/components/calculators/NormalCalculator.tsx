import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator,
  Check,
  Copy,
  Delete,
  History,
  Keyboard,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export type ArithmeticOperator = '+' | '-' | '×' | '÷';
export type DecimalPrecisionMode = 'auto' | 0 | 2 | 4 | 6;

export interface NormalCalcHistoryItem {
  id: string;
  expression: string;
  result: string;
  numericValue: number;
  timestamp: string;
}

interface NormalCalculatorProps {
  embedded?: boolean;
}

const MAX_DISPLAY_DIGITS = 15;

function roundFloatingNoise(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toPrecision(12));
}

function formatNumericValue(value: number, precision: DecimalPrecisionMode): string {
  if (!Number.isFinite(value)) return 'Error';
  const clean = roundFloatingNoise(value);
  if (Object.is(clean, -0)) return '0';
  if (precision === 'auto') {
    if (Math.abs(clean) >= 1e14 || (clean !== 0 && Math.abs(clean) < 1e-9)) {
      return clean.toExponential(6);
    }
    return String(clean);
  }
  return clean.toFixed(precision);
}

function formatDisplayWithSeparators(raw: string): string {
  if (!raw || raw === 'Error' || raw.includes('e') || raw.includes('E')) return raw;
  const isNegative = raw.startsWith('-');
  const unsigned = isNegative ? raw.slice(1) : raw;
  const [intPart, decPart] = unsigned.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const prefix = isNegative ? '-' : '';
  return decPart !== undefined ? `${prefix}${formattedInt}.${decPart}` : `${prefix}${formattedInt}`;
}

function applyArithmetic(left: number, right: number, operator: ArithmeticOperator): number {
  switch (operator) {
    case '+':
      return roundFloatingNoise(left + right);
    case '-':
      return roundFloatingNoise(left - right);
    case '×':
      return roundFloatingNoise(left * right);
    case '÷':
      if (right === 0) return NaN;
      return roundFloatingNoise(left / right);
  }
}

export const NormalCalculator: React.FC<NormalCalculatorProps> = ({ embedded = false }) => {
  const {
    user,
    language,
    appSettings,
    calculatorHistory,
    recordCalculatorRun,
    deleteCalculatorRun,
    clearCalculatorHistory,
    showToast,
  } = useApp();

  const calcCfg = appSettings.calculatorConfig;
  const normalDisabled = calcCfg?.normalEnabled === false;
  const allowCloudHistory = Boolean(user && calcCfg?.allowCloudHistory !== false);

  // Calculator state machine
  const [display, setDisplay] = useState<string>('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [pendingOperator, setPendingOperator] = useState<ArithmeticOperator | null>(null);
  const [waitingForNewInput, setWaitingForNewInput] = useState<boolean>(false);
  const [lastRepeatOp, setLastRepeatOp] = useState<{
    operator: ArithmeticOperator;
    operand: number;
  } | null>(null);
  const [expressionLine, setExpressionLine] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Memory state
  const [memory, setMemory] = useState<number>(0);

  // Local calculation history state
  const [history, setHistory] = useState<NormalCalcHistoryItem[]>([]);

  // UX preferences
  const [precision, setPrecision] = useState<DecimalPrecisionMode>(() => {
    const def = calcCfg?.defaultPrecision;
    if (def === '0' || def === '2' || def === '4' || def === '6') {
      return Number(def) as DecimalPrecisionMode;
    }
    return 'auto';
  });
  const [historySource, setHistorySource] = useState<'local' | 'cloud'>('local');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeKeyFeedback, setActiveKeyFeedback] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const playClickTone = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, ctx.currentTime);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // Ignore audio failures on restricted browsers
    }
  }, [soundEnabled]);

  const triggerKeyFeedback = useCallback((keyLabel: string) => {
    setActiveKeyFeedback(keyLabel);
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setActiveKeyFeedback(null);
    }, 130);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close();
      }
    };
  }, []);

  const pushHistory = useCallback(
    (expression: string, numericValue: number, prec: DecimalPrecisionMode) => {
      const resultStr = formatNumericValue(numericValue, prec);
      const now = new Date();
      const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          expression,
          result: resultStr,
          numericValue,
          timestamp,
        },
        ...prev.slice(0, 49),
      ]);
      if (allowCloudHistory) {
        void recordCalculatorRun({
          mode: 'normal',
          expression,
          result: resultStr,
        });
      }
    },
    [allowCloudHistory, recordCalculatorRun]
  );

  const clearAll = useCallback(() => {
    playClickTone();
    setDisplay('0');
    setPreviousValue(null);
    setPendingOperator(null);
    setWaitingForNewInput(false);
    setLastRepeatOp(null);
    setExpressionLine('');
    setErrorMessage(null);
  }, [playClickTone]);

  const clearEntry = useCallback(() => {
    playClickTone();
    if (errorMessage) {
      clearAll();
      return;
    }
    setDisplay('0');
    setWaitingForNewInput(false);
  }, [clearAll, errorMessage, playClickTone]);

  const handleDigit = useCallback(
    (digit: string) => {
      playClickTone();
      if (errorMessage) {
        setErrorMessage(null);
        setPreviousValue(null);
        setPendingOperator(null);
        setExpressionLine('');
        setDisplay(digit);
        setWaitingForNewInput(false);
        return;
      }

      if (waitingForNewInput) {
        setDisplay(digit);
        setWaitingForNewInput(false);
        if (!pendingOperator) {
          setExpressionLine('');
          setLastRepeatOp(null);
        }
        return;
      }

      setDisplay((prev) => {
        if (prev === '0') return digit;
        if (prev === '-0') return `-${digit}`;
        const digitCount = prev.replace(/[^0-9]/g, '').length;
        if (digitCount >= MAX_DISPLAY_DIGITS) return prev;
        return prev + digit;
      });
    },
    [errorMessage, pendingOperator, playClickTone, waitingForNewInput]
  );

  const handleDecimal = useCallback(() => {
    playClickTone();
    if (errorMessage) {
      setErrorMessage(null);
      setPreviousValue(null);
      setPendingOperator(null);
      setExpressionLine('');
      setDisplay('0.');
      setWaitingForNewInput(false);
      return;
    }
    if (waitingForNewInput) {
      setDisplay('0.');
      setWaitingForNewInput(false);
      if (!pendingOperator) {
        setExpressionLine('');
        setLastRepeatOp(null);
      }
      return;
    }
    setDisplay((prev) => (prev.includes('.') ? prev : `${prev}.`));
  }, [errorMessage, pendingOperator, playClickTone, waitingForNewInput]);

  const handleBackspace = useCallback(() => {
    playClickTone();
    if (errorMessage) {
      clearAll();
      return;
    }
    if (waitingForNewInput) return;
    setDisplay((prev) => {
      if (prev.length <= 1 || (prev.length === 2 && prev.startsWith('-'))) {
        return '0';
      }
      return prev.slice(0, -1);
    });
  }, [clearAll, errorMessage, playClickTone, waitingForNewInput]);

  const handleToggleSign = useCallback(() => {
    playClickTone();
    if (errorMessage) return;
    setDisplay((prev) => {
      if (prev === '0' || prev === '0.') return prev;
      return prev.startsWith('-') ? prev.slice(1) : `-${prev}`;
    });
  }, [errorMessage, playClickTone]);

  const handleOperator = useCallback(
    (nextOp: ArithmeticOperator) => {
      playClickTone();
      if (errorMessage) return;

      const currentNum = Number(display);
      if (!Number.isFinite(currentNum)) return;

      if (pendingOperator && !waitingForNewInput && previousValue !== null) {
        const computed = applyArithmetic(previousValue, currentNum, pendingOperator);
        if (Number.isNaN(computed)) {
          setErrorMessage(language === 'bn' ? 'শূন্য দিয়ে ভাগ করা যায় না' : 'Cannot divide by zero');
          setDisplay('Error');
          setPreviousValue(null);
          setPendingOperator(null);
          setWaitingForNewInput(true);
          return;
        }
        const formatted = formatNumericValue(computed, precision);
        setPreviousValue(computed);
        setDisplay(formatted);
        setPendingOperator(nextOp);
        setWaitingForNewInput(true);
        setExpressionLine(`${formatDisplayWithSeparators(formatted)} ${nextOp}`);
        setLastRepeatOp(null);
        return;
      }

      const baseVal = previousValue !== null && waitingForNewInput ? previousValue : currentNum;
      setPreviousValue(baseVal);
      setPendingOperator(nextOp);
      setWaitingForNewInput(true);
      setExpressionLine(`${formatDisplayWithSeparators(formatNumericValue(baseVal, 'auto'))} ${nextOp}`);
      setLastRepeatOp(null);
    },
    [display, errorMessage, language, pendingOperator, playClickTone, precision, previousValue, waitingForNewInput]
  );

  const handlePercentage = useCallback(() => {
    playClickTone();
    if (errorMessage) return;
    const currentNum = Number(display);
    if (!Number.isFinite(currentNum)) return;

    let pctValue: number;
    if (previousValue !== null && (pendingOperator === '+' || pendingOperator === '-')) {
      pctValue = roundFloatingNoise(previousValue * (currentNum / 100));
    } else {
      pctValue = roundFloatingNoise(currentNum / 100);
    }

    const formatted = formatNumericValue(pctValue, 'auto');
    setDisplay(formatted);
    setWaitingForNewInput(false);

    if (previousValue === null || !pendingOperator) {
      setExpressionLine(`${formatDisplayWithSeparators(String(currentNum))}%`);
      pushHistory(`${currentNum}%`, pctValue, precision);
    } else {
      setExpressionLine(
        `${formatDisplayWithSeparators(formatNumericValue(previousValue, 'auto'))} ${pendingOperator} ${formatDisplayWithSeparators(formatted)}`
      );
    }
  }, [display, errorMessage, pendingOperator, playClickTone, precision, previousValue, pushHistory]);

  const handleEquals = useCallback(() => {
    playClickTone();
    if (errorMessage) return;

    const currentNum = Number(display);
    if (!Number.isFinite(currentNum)) return;

    // Case 1: Active pending operation
    if (pendingOperator && previousValue !== null) {
      const result = applyArithmetic(previousValue, currentNum, pendingOperator);
      if (Number.isNaN(result)) {
        setErrorMessage(language === 'bn' ? 'শূন্য দিয়ে ভাগ করা যায় না' : 'Cannot divide by zero');
        setDisplay('Error');
        setPreviousValue(null);
        setPendingOperator(null);
        setWaitingForNewInput(true);
        return;
      }

      const leftText = formatDisplayWithSeparators(formatNumericValue(previousValue, 'auto'));
      const rightText = formatDisplayWithSeparators(formatNumericValue(currentNum, 'auto'));
      const exprText = `${leftText} ${pendingOperator} ${rightText}`;

      const formattedResult = formatNumericValue(result, precision);
      setDisplay(formattedResult);
      setExpressionLine(`${exprText} =`);
      setLastRepeatOp({ operator: pendingOperator, operand: currentNum });
      setPreviousValue(null);
      setPendingOperator(null);
      setWaitingForNewInput(true);
      pushHistory(exprText, result, precision);
      return;
    }

    // Case 2: Repeat equals with last operation
    if (lastRepeatOp) {
      const result = applyArithmetic(currentNum, lastRepeatOp.operand, lastRepeatOp.operator);
      if (Number.isNaN(result)) {
        setErrorMessage(language === 'bn' ? 'শূন্য দিয়ে ভাগ করা যায় না' : 'Cannot divide by zero');
        setDisplay('Error');
        setLastRepeatOp(null);
        setWaitingForNewInput(true);
        return;
      }
      const leftText = formatDisplayWithSeparators(formatNumericValue(currentNum, 'auto'));
      const rightText = formatDisplayWithSeparators(formatNumericValue(lastRepeatOp.operand, 'auto'));
      const exprText = `${leftText} ${lastRepeatOp.operator} ${rightText}`;
      const formattedResult = formatNumericValue(result, precision);

      setDisplay(formattedResult);
      setExpressionLine(`${exprText} =`);
      setWaitingForNewInput(true);
      pushHistory(exprText, result, precision);
    }
  }, [display, errorMessage, language, lastRepeatOp, pendingOperator, playClickTone, precision, previousValue, pushHistory]);

  // Memory operations
  const handleMemoryClear = useCallback(() => {
    playClickTone();
    setMemory(0);
  }, [playClickTone]);

  const handleMemoryRecall = useCallback(() => {
    playClickTone();
    if (errorMessage) setErrorMessage(null);
    const formatted = formatNumericValue(memory, 'auto');
    setDisplay(formatted);
    setWaitingForNewInput(false);
  }, [errorMessage, memory, playClickTone]);

  const handleMemoryAdd = useCallback(() => {
    playClickTone();
    if (errorMessage) return;
    const val = Number(display);
    if (!Number.isFinite(val)) return;
    setMemory((prev) => roundFloatingNoise(prev + val));
    setWaitingForNewInput(true);
  }, [display, errorMessage, playClickTone]);

  const handleMemorySubtract = useCallback(() => {
    playClickTone();
    if (errorMessage) return;
    const val = Number(display);
    if (!Number.isFinite(val)) return;
    setMemory((prev) => roundFloatingNoise(prev - val));
    setWaitingForNewInput(true);
  }, [display, errorMessage, playClickTone]);

  const handleCopyDisplay = useCallback(async () => {
    if (errorMessage) return;
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      showToast(language === 'bn' ? 'ফলাফল কপি করা হয়েছে' : 'Result copied to clipboard', 'success');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast(language === 'bn' ? 'কপি করা যায়নি' : 'Could not copy to clipboard', 'error');
    }
  }, [display, errorMessage, language, showToast]);

  // Full Keyboard Support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
          void handleCopyDisplay();
        }
        return;
      }

      const key = e.key;
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        triggerKeyFeedback(key);
        handleDigit(key);
      } else if (key === '.' || key === ',') {
        e.preventDefault();
        triggerKeyFeedback('.');
        handleDecimal();
      } else if (key === '+') {
        e.preventDefault();
        triggerKeyFeedback('+');
        handleOperator('+');
      } else if (key === '-') {
        e.preventDefault();
        triggerKeyFeedback('-');
        handleOperator('-');
      } else if (key === '*' || key.toLowerCase() === 'x') {
        e.preventDefault();
        triggerKeyFeedback('×');
        handleOperator('×');
      } else if (key === '/') {
        e.preventDefault();
        triggerKeyFeedback('÷');
        handleOperator('÷');
      } else if (key === '%') {
        e.preventDefault();
        triggerKeyFeedback('%');
        handlePercentage();
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        triggerKeyFeedback('=');
        handleEquals();
      } else if (key === 'Backspace') {
        e.preventDefault();
        triggerKeyFeedback('BKSP');
        handleBackspace();
      } else if (key === 'Escape' || key === 'Delete') {
        e.preventDefault();
        triggerKeyFeedback('AC');
        clearAll();
      } else if (key.toLowerCase() === 'c') {
        e.preventDefault();
        triggerKeyFeedback('C');
        clearEntry();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    clearAll,
    clearEntry,
    handleBackspace,
    handleCopyDisplay,
    handleDecimal,
    handleDigit,
    handleEquals,
    handleOperator,
    handlePercentage,
    triggerKeyFeedback,
  ]);

  const formattedMainDisplay = useMemo(() => {
    if (errorMessage) return errorMessage;
    return formatDisplayWithSeparators(display);
  }, [display, errorMessage]);

  const loadFromHistory = (item: NormalCalcHistoryItem) => {
    playClickTone();
    setErrorMessage(null);
    setPreviousValue(null);
    setPendingOperator(null);
    setLastRepeatOp(null);
    setDisplay(formatNumericValue(item.numericValue, 'auto'));
    setExpressionLine(`${item.expression} =`);
    setWaitingForNewInput(true);
  };

  const memoryButtons = [
    {
      label: 'MC',
      titleEn: 'Memory Clear',
      titleBn: 'মেমোরি মুছুন',
      disabled: memory === 0,
      onClick: handleMemoryClear,
    },
    {
      label: 'MR',
      titleEn: 'Memory Recall',
      titleBn: 'মেমোরি আনুন',
      disabled: memory === 0,
      onClick: handleMemoryRecall,
    },
    {
      label: 'M+',
      titleEn: 'Add to Memory',
      titleBn: 'মেমোরিতে যোগ করুন',
      disabled: Boolean(errorMessage),
      onClick: handleMemoryAdd,
    },
    {
      label: 'M-',
      titleEn: 'Subtract from Memory',
      titleBn: 'মেমোরি থেকে বিয়োগ করুন',
      disabled: Boolean(errorMessage),
      onClick: handleMemorySubtract,
    },
  ];

  const keypadRows = [
    [
      { id: 'AC', label: 'AC', role: 'danger' as const, action: clearAll },
      { id: 'C', label: 'C', role: 'utility' as const, action: clearEntry },
      { id: '%', label: '%', role: 'utility' as const, action: handlePercentage },
      { id: '÷', label: '÷', role: 'operator' as const, action: () => handleOperator('÷') },
    ],
    [
      { id: '7', label: '7', role: 'digit' as const, action: () => handleDigit('7') },
      { id: '8', label: '8', role: 'digit' as const, action: () => handleDigit('8') },
      { id: '9', label: '9', role: 'digit' as const, action: () => handleDigit('9') },
      { id: '×', label: '×', role: 'operator' as const, action: () => handleOperator('×') },
    ],
    [
      { id: '4', label: '4', role: 'digit' as const, action: () => handleDigit('4') },
      { id: '5', label: '5', role: 'digit' as const, action: () => handleDigit('5') },
      { id: '6', label: '6', role: 'digit' as const, action: () => handleDigit('6') },
      { id: '-', label: '−', role: 'operator' as const, action: () => handleOperator('-') },
    ],
    [
      { id: '1', label: '1', role: 'digit' as const, action: () => handleDigit('1') },
      { id: '2', label: '2', role: 'digit' as const, action: () => handleDigit('2') },
      { id: '3', label: '3', role: 'digit' as const, action: () => handleDigit('3') },
      { id: '+', label: '+', role: 'operator' as const, action: () => handleOperator('+') },
    ],
    [
      { id: '±', label: '±', role: 'utility' as const, action: handleToggleSign },
      { id: '0', label: '0', role: 'digit' as const, action: () => handleDigit('0') },
      { id: '.', label: '.', role: 'digit' as const, action: handleDecimal },
      { id: '=', label: '=', role: 'equals' as const, action: handleEquals },
    ],
  ];

  const cloudNormalHistory = useMemo(
    () => calculatorHistory.filter((item) => item.mode === 'normal'),
    [calculatorHistory]
  );

  if (normalDisabled) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-6 text-center space-y-2">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
          {language === 'bn' ? 'সাধারণ ক্যালকুলেটর সাময়িকভাবে বন্ধ রয়েছে' : 'Normal Calculator is currently disabled'}
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-400">
          {language === 'bn'
            ? 'অ্যাডমিন সেটিংস থেকে এই মডিউলটি পুনরায় চালু করা যাবে।'
            : 'An administrator can re-enable this module in Admin Settings.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Calculator className="w-6 h-6 text-blue-700 dark:text-blue-400 shrink-0" />
              <span>{language === 'bn' ? 'সাধারণ ক্যালকুলেটর' : 'Normal Calculator'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {language === 'bn'
                ? 'দৈনন্দিন যোগ, বিয়োগ, গুণ, ভাগ, শতকরা (%), মেমোরি ও কিবোর্ড সাপোর্টসহ হিসাব।'
                : 'Fast arithmetic, percentage, memory registers (M+, M-, MR, MC), keyboard shortcuts, and calculation tape.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              title={language === 'bn' ? 'ক্লিক সাউন্ড' : 'Key Click Sound'}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                soundEnabled
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{language === 'bn' ? (soundEnabled ? 'সাউন্ড চালু' : 'সাউন্ড বন্ধ') : soundEnabled ? 'Sound On' : 'Sound Off'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Calculator Instrument Panel */}
        <section
          aria-label={language === 'bn' ? 'ক্যালকুলেটর কীপ্যাড' : 'Calculator Keypad'}
          className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
        >
          {/* Top Utility Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {language === 'bn' ? 'দশমিক:' : 'Precision:'}
              </span>
              <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {(['auto', 0, 2, 4, 6] as DecimalPrecisionMode[]).map((mode) => (
                  <button
                    key={String(mode)}
                    type="button"
                    onClick={() => setPrecision(mode)}
                    className={`px-2 py-1 text-[11px] font-mono font-medium rounded-md transition-colors cursor-pointer ${
                      precision === mode
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {mode === 'auto' ? 'Auto' : `.${mode}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {embedded && (
                <button
                  type="button"
                  onClick={() => setSoundEnabled((v) => !v)}
                  aria-label={language === 'bn' ? 'সাউন্ড টগল' : 'Toggle key click sound'}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyDisplay}
                disabled={Boolean(errorMessage)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{language === 'bn' ? (copied ? 'কপি হয়েছে' : 'কপি') : copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Segmented Readout Screen */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between gap-3 min-h-[20px]">
              <div className="text-[11px] font-mono-tabular font-semibold text-blue-700 dark:text-blue-400">
                {memory !== 0 ? `M = ${formatDisplayWithSeparators(formatNumericValue(memory, 'auto'))}` : ''}
              </div>
              <div
                aria-live="polite"
                className="text-xs sm:text-sm font-mono-tabular text-slate-500 dark:text-slate-400 truncate text-right"
              >
                {expressionLine || '\u00A0'}
              </div>
            </div>

            <div
              data-testid="normal-calc-display"
              className={`text-right font-bold font-mono-tabular tracking-tight break-all leading-tight min-h-[44px] flex items-center justify-end ${
                errorMessage
                  ? 'text-lg sm:text-xl text-red-600 dark:text-red-400'
                  : formattedMainDisplay.length > 14
                    ? 'text-2xl sm:text-3xl text-slate-900 dark:text-white'
                    : 'text-3xl sm:text-4xl text-slate-900 dark:text-white'
              }`}
            >
              {formattedMainDisplay}
            </div>
          </div>

          {/* Memory Row + Backspace */}
          <div className="grid grid-cols-5 gap-2">
            {memoryButtons.map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={btn.onClick}
                disabled={btn.disabled}
                title={language === 'bn' ? btn.titleBn : btn.titleEn}
                className="min-h-[42px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {btn.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              aria-label={language === 'bn' ? 'ব্যাকস্পেস' : 'Backspace'}
              title={language === 'bn' ? 'শেষ অঙ্ক মুছুন (Backspace)' : 'Delete last digit (Backspace)'}
              className={`min-h-[42px] inline-flex items-center justify-center rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                activeKeyFeedback === 'BKSP'
                  ? 'border-blue-600 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          {/* Main 4x5 Keypad Grid */}
          <div className="grid grid-cols-4 gap-2.5">
            {keypadRows.flat().map((btn) => {
              const isPressed = activeKeyFeedback === btn.id;
              const isActiveOp =
                btn.role === 'operator' && pendingOperator === btn.id && waitingForNewInput;

              let styleClass =
                'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800';

              if (btn.role === 'equals') {
                styleClass =
                  'bg-blue-700 border-blue-700 text-white hover:bg-blue-800 dark:bg-blue-600 dark:border-blue-600 dark:hover:bg-blue-700';
              } else if (btn.role === 'operator') {
                styleClass = isActiveOp
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700';
              } else if (btn.role === 'danger') {
                styleClass =
                  'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/70 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/70';
              } else if (btn.role === 'utility') {
                styleClass =
                  'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700';
              }

              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={btn.action}
                  className={`min-h-[52px] sm:min-h-[56px] rounded-lg border text-base sm:text-lg font-semibold font-mono-tabular transition-all cursor-pointer select-none active:scale-[0.98] ${styleClass} ${
                    isPressed ? 'ring-2 ring-blue-500 scale-[0.98]' : ''
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Keyboard Shortcut Legend */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <Keyboard className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span>
              {language === 'bn'
                ? 'কিবোর্ড শর্টকাট: 0-9, +, -, *, /, %, Enter (=), Backspace, Esc (AC), C'
                : 'Keyboard shortcuts: 0-9, +, -, *, /, %, Enter (=), Backspace, Esc (AC), C'}
            </span>
          </div>
        </section>

        {/* Calculation History Panel (Local & Synced Cloud) */}
        <section
          aria-label={language === 'bn' ? 'হিসাবের ইতিহাস' : 'Calculation History'}
          className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {language === 'bn' ? 'হিসাবের ইতিহাস' : 'Calculation History'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {allowCloudHistory && (
                <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setHistorySource('local')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-md cursor-pointer ${
                      historySource === 'local'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {language === 'bn' ? `লোকাল (${history.length})` : `Local (${history.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistorySource('cloud')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded-md cursor-pointer ${
                      historySource === 'cloud'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {language === 'bn' ? `ক্লাউড (${cloudNormalHistory.length})` : `Cloud (${cloudNormalHistory.length})`}
                  </button>
                </div>
              )}

              {historySource === 'local' && history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'সব মুছুন' : 'Clear'}</span>
                </button>
              )}

              {historySource === 'cloud' && cloudNormalHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => void clearCalculatorHistory()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'সব মুছুন' : 'Clear All'}</span>
                </button>
              )}
            </div>
          </div>

          {historySource === 'cloud' && allowCloudHistory ? (
            cloudNormalHistory.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <RotateCcw className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'ক্লাউডে এখনো কোনো হিসাব নেই' : 'No cloud calculations yet'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto pr-1">
                {cloudNormalHistory.map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-2 group"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const num = Number(String(item.result).replace(/,/g, ''));
                        if (Number.isFinite(num)) {
                          loadFromHistory({
                            id: item.id,
                            expression: item.expression,
                            result: item.result,
                            numericValue: num,
                            timestamp: '',
                          });
                        }
                      }}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <p className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 truncate">
                        {item.expression}
                      </p>
                      <p className="text-base font-bold font-mono-tabular text-blue-700 dark:text-blue-400 mt-0.5 truncate">
                        = {formatDisplayWithSeparators(item.result)}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(item.result);
                            showToast(language === 'bn' ? 'ফলাফল কপি হয়েছে' : 'Copied result', 'success');
                          } catch {
                            // ignore
                          }
                        }}
                        aria-label={language === 'bn' ? 'কপি' : 'Copy'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteCalculatorRun(item.id)}
                        aria-label={language === 'bn' ? 'মুছুন' : 'Delete'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : history.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <RotateCcw className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {language === 'bn' ? 'এখনো কোনো হিসাব নেই' : 'No calculations yet'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                {language === 'bn'
                  ? 'হিসাব সম্পন্ন করতে "=" অথবা Enter চাপুন। প্রতিটি হিসাব এখানে সংরক্ষিত থাকবে।'
                  : 'Press "=" or Enter to compute. Completed calculations will appear here for quick recall.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto pr-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-3 group"
                >
                  <button
                    type="button"
                    onClick={() => loadFromHistory(item)}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 truncate">
                        {item.expression}
                      </span>
                      <span className="text-[11px] font-mono-tabular text-slate-400 dark:text-slate-500 shrink-0">
                        {item.timestamp}
                      </span>
                    </div>
                    <p className="text-base font-bold font-mono-tabular text-blue-700 dark:text-blue-400 mt-0.5 truncate">
                      = {formatDisplayWithSeparators(item.result)}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(item.result);
                        showToast(
                          language === 'bn' ? 'ফলাফল কপি হয়েছে' : 'Copied result',
                          'success'
                        );
                      } catch {
                        // ignore clipboard failure
                      }
                    }}
                    aria-label={language === 'bn' ? 'ফলাফল কপি করুন' : 'Copy result'}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-70 group-hover:opacity-100 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
