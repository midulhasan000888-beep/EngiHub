import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  BookmarkPlus,
  Calendar,
  Copy,
  Divide,
  Equal,
  FileDown,
  FileSpreadsheet,
  FileText,
  History,
  Search,
  Sigma,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { evaluateSafeExpression } from '../../engine/formulaParser';
import { getTriCalendarDate } from '../../engine/calendarUtils';
import { NormalCalculator } from './NormalCalculator';
import {
  EngineeringQuickPanel,
  EquationAlgebraPanel,
  SolverExportPayload,
} from './ScientificPanels';

type MathTab =
  | 'basic'
  | 'scientific'
  | 'equations'
  | 'engineering'
  | 'fraction'
  | 'statistics'
  | 'date-diff';

const UNIT_OPTIONS = ['', 'V', 'A', 'Ω', 'W', 'kW', 'kVA', 'Hz', 'N·m', 'Pa', 'bar', 'm', 'm²', 'm³', 'L/s', 'kg', '°', 'rad', '%'];

export const MathToolsSuite: React.FC = () => {
  const {
    user,
    language,
    appSettings,
    calculatorHistory,
    recordCalculatorRun,
    deleteCalculatorRun,
    clearCalculatorHistory,
    sendToExcel,
    setPendingReportDraft,
    navigateTo,
    showToast,
  } = useApp();

  const sciDisabled =
    appSettings.calculatorConfig?.scientificEnabled === false ||
    appSettings.moduleFlags?.scientificCalculatorEnabled === false;

  const [tab, setTab] = useState<MathTab>('scientific');

  // Scientific Calculator state
  const [expr, setExpr] = useState('sqrt(3) * 400 * 45 * 0.85');
  const [angleMode, setAngleMode] = useState<'deg' | 'rad'>('deg');
  const [unitTag, setUnitTag] = useState<string>('W');
  const [historySearch, setHistorySearch] = useState('');
  const [tape, setTape] = useState<Array<{ expr: string; result: string; unit?: string }>>([]);

  // Fraction Calculator state
  const [fA, setFA] = useState(3);
  const [fB, setFB] = useState(4);
  const [fC, setFC] = useState(5);
  const [fD, setFD] = useState(6);
  const [fOp, setFOp] = useState<'+' | '-' | '*' | '/'>('+');

  // Statistics state
  const [statsInput, setStatsInput] = useState('12, 15, 18, 22, 22, 25, 29, 34, 40');

  // Date Difference state
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-11-23');

  const prepareExpression = (raw: string, mode: 'deg' | 'rad'): string => {
    let prepared = raw.trim();
    if (mode === 'deg') {
      prepared = prepared
        .replace(/\basin\(/g, 'asind(')
        .replace(/\bacos\(/g, 'acosd(')
        .replace(/\batan\(/g, 'atand(')
        .replace(/\bsin\(/g, 'sind(')
        .replace(/\bcos\(/g, 'cosd(')
        .replace(/\btan\(/g, 'tand(');
    }
    return prepared;
  };

  const sciEvaluation = useMemo(() => {
    try {
      const prepared = prepareExpression(expr, angleMode);
      if (!prepared) {
        return { result: '0', error: false, prepared: '' };
      }
      const val = evaluateSafeExpression(prepared, {});
      const out = Number.isFinite(val) ? String(Number(val.toPrecision(10))) : 'Undefined';
      return { result: out, error: !Number.isFinite(val), prepared };
    } catch {
      return { result: '...', error: true, prepared: '' };
    }
  }, [expr, angleMode]);

  const sciStepsText = useMemo(() => {
    if (!expr.trim()) return '';
    return [
      `Mode: ${angleMode.toUpperCase()}`,
      `Input Expression: ${expr.trim()}`,
      sciEvaluation.prepared !== expr.trim() ? `Evaluated Form: ${sciEvaluation.prepared}` : '',
      `Computed Value: ${sciEvaluation.result}${unitTag ? ` ${unitTag}` : ''}`,
    ]
      .filter(Boolean)
      .join('\n');
  }, [angleMode, expr, sciEvaluation, unitTag]);

  const buildSciPayload = (): SolverExportPayload => ({
    mode: 'scientific',
    title: language === 'bn' ? 'সায়েন্টিফিক ক্যালকুলেশন' : 'Scientific Calculation',
    formulaDisplay: expr.trim() || '0',
    inputsSummary: `Angle Mode: ${angleMode.toUpperCase()}`,
    resultDisplay: `${sciEvaluation.result}${unitTag ? ` ${unitTag}` : ''}`,
    unit: unitTag,
    stepsText: sciStepsText,
    rows: [
      { label: 'Expression', value: expr.trim() || '0' },
      { label: 'Angle Mode', value: angleMode.toUpperCase() },
      { label: 'Result', value: sciEvaluation.result, unit: unitTag },
    ],
  });

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(language === 'bn' ? 'ফলাফল কপি করা হয়েছে' : 'Copied to clipboard', 'success');
    } catch {
      showToast(language === 'bn' ? 'কপি করা যায়নি' : 'Clipboard copy failed', 'error');
    }
  };

  const handleSavePayload = async (payload: SolverExportPayload) => {
    if (!user) {
      showToast(
        language === 'bn' ? 'ক্লাউডে সেভ করতে সাইন-ইন করুন' : 'Sign in to save calculation to cloud history',
        'info'
      );
      return;
    }
    if (appSettings.calculatorConfig?.allowCloudHistory === false) {
      showToast(language === 'bn' ? 'ক্লাউড হিস্ট্রি অ্যাডমিন দ্বারা বন্ধ' : 'Cloud history disabled by Admin', 'info');
      return;
    }
    await recordCalculatorRun({
      mode: payload.mode,
      expression: payload.formulaDisplay,
      result: payload.resultDisplay,
      unit: payload.unit,
      steps: payload.stepsText,
      inputsSummary: payload.inputsSummary,
    });
    showToast(language === 'bn' ? 'ক্লাউড হিস্ট্রিতে সেভ হয়েছে' : 'Saved to cloud calculation history', 'success');
  };

  const handleExportPdf = (payload: SolverExportPayload) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(15);
    doc.text('SUTRO SATHI — Calculation Report', 15, 18);
    doc.setFontSize(11);
    doc.text(payload.title, 15, 28);
    doc.setFontSize(10);
    doc.text(`Formula / Expression: ${payload.formulaDisplay}`, 15, 38);
    doc.text(`Inputs: ${payload.inputsSummary}`, 15, 45);
    doc.setFontSize(12);
    doc.text(`Result: ${payload.resultDisplay}`, 15, 55);
    doc.setFontSize(9);
    const stepLines = doc.splitTextToSize(`Steps:\n${payload.stepsText}`, 180);
    doc.text(stepLines, 15, 66);
    doc.save(`sutro-sathi-${payload.mode}-${Date.now()}.pdf`);
    showToast(language === 'bn' ? 'PDF ডাউনলোড হয়েছে' : 'PDF exported', 'success');
  };

  const handleSendToExcel = (payload: SolverExportPayload) => {
    sendToExcel({
      title: payload.title,
      sheetName: payload.mode === 'engineering' ? 'Engineering' : 'Scientific',
      headers: ['Parameter', 'Value', 'Unit'],
      rows: [
        ...payload.rows.map((r) => [r.label, r.value, r.unit || '']),
        ['Formula', payload.formulaDisplay, ''],
        ['Inputs', payload.inputsSummary, ''],
      ],
    });
  };

  const handleInsertToReport = (payload: SolverExportPayload) => {
    setPendingReportDraft({
      title: payload.title,
      sourceType: 'calculation',
      formulaDisplay: payload.formulaDisplay,
      stepsText: payload.stepsText,
      rows: payload.rows.map((r) => ({
        label: r.label,
        value: r.value,
        unit: r.unit || '',
      })),
      inputsList: [{ label: 'Inputs', value: payload.inputsSummary }],
      outputsList: [{ label: 'Result', value: payload.resultDisplay }],
    });
    navigateTo('reports');
  };

  const evalSci = (inputExpr: string) => {
    try {
      const prepared = prepareExpression(inputExpr, angleMode);
      const val = evaluateSafeExpression(prepared, {});
      const out = Number.isFinite(val) ? String(Number(val.toPrecision(12))) : 'Error';
      setTape((prev) => [{ expr: inputExpr, result: out, unit: unitTag }, ...prev.slice(0, 19)]);
      if (user && appSettings.calculatorConfig?.allowCloudHistory !== false && out !== 'Error') {
        void recordCalculatorRun({
          mode: 'scientific',
          expression: inputExpr,
          result: out,
          unit: unitTag,
          steps: `Mode: ${angleMode.toUpperCase()} | ${inputExpr} = ${out} ${unitTag}`.trim(),
        });
      }
      return out;
    } catch (e) {
      return e instanceof Error ? e.message : 'Syntax Error';
    }
  };

  const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

  const fractionResult = useMemo(() => {
    if (fB === 0 || fD === 0) return { error: 'Denominator cannot be zero.' };
    let num = 0;
    let den = fB * fD;
    if (fOp === '+') num = fA * fD + fC * fB;
    else if (fOp === '-') num = fA * fD - fC * fB;
    else if (fOp === '*') num = fA * fC;
    else {
      if (fC === 0) return { error: 'Cannot divide by zero fraction.' };
      num = fA * fD;
      den = fB * fC;
    }
    if (den < 0) {
      num = -num;
      den = -den;
    }
    const g = gcd(num, den) || 1;
    return {
      num: num / g,
      den: den / g,
      decimal: (num / den).toFixed(6),
    };
  }, [fA, fB, fC, fD, fOp]);

  const statsResult = useMemo(() => {
    const nums = statsInput
      .split(/[\s,;]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (nums.length === 0) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;
    const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const freq = new Map<number, number>();
    let maxFreq = 0;
    for (const v of sorted) {
      const f = (freq.get(v) || 0) + 1;
      freq.set(v, f);
      if (f > maxFreq) maxFreq = f;
    }
    const modes = Array.from(freq.entries())
      .filter(([, f]) => f === maxFreq && maxFreq > 1)
      .map(([v]) => v);
    const variancePop = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    const varianceSample = n > 1 ? sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1) : 0;
    return {
      count: n,
      sum,
      mean,
      median,
      mode: modes.length > 0 ? modes.join(', ') : 'None',
      min: sorted[0],
      max: sorted[n - 1],
      range: sorted[n - 1] - sorted[0],
      variancePop,
      stdPop: Math.sqrt(variancePop),
      stdSample: Math.sqrt(varianceSample),
    };
  }, [statsInput]);

  const dateDiffResult = useMemo(() => {
    const d1 = new Date(`${startDate}T00:00:00`);
    const d2 = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
    const diffMs = Math.abs(d2.getTime() - d1.getTime());
    const totalDays = Math.round(diffMs / 86400000);
    const weeks = Math.floor(totalDays / 7);
    const remDays = totalDays % 7;
    const approxYears = Math.floor(totalDays / 365.25);
    const approxMonths = Math.floor((totalDays % 365.25) / 30.4375);
    return {
      totalDays,
      weeks,
      remDays,
      approxYears,
      approxMonths,
      hours: totalDays * 24,
      startTri: getTriCalendarDate(startDate),
      endTri: getTriCalendarDate(endDate),
    };
  }, [startDate, endDate]);

  const sciButtons: Array<{ label: string; insert: string; group?: string }> = [
    { label: 'sin', insert: 'sin(' },
    { label: 'cos', insert: 'cos(' },
    { label: 'tan', insert: 'tan(' },
    { label: 'asin', insert: 'asin(' },
    { label: 'acos', insert: 'acos(' },
    { label: 'atan', insert: 'atan(' },

    { label: 'sinh', insert: 'sinh(' },
    { label: 'cosh', insert: 'cosh(' },
    { label: 'tanh', insert: 'tanh(' },
    { label: 'log₁₀', insert: 'log10(' },
    { label: 'ln', insert: 'ln(' },
    { label: 'log₂', insert: 'log2(' },

    { label: '√', insert: 'sqrt(' },
    { label: 'ⁿ√x', insert: 'nthroot(3, ' },
    { label: 'x²', insert: '^2' },
    { label: 'x³', insert: '^3' },
    { label: 'xʸ', insert: '^' },
    { label: '1/x', insert: '1/(' },

    { label: 'n!', insert: 'fact(' },
    { label: '|x|', insert: 'abs(' },
    { label: 'mod', insert: 'mod(' },
    { label: 'eˣ', insert: 'exp(' },
    { label: 'π', insert: 'pi' },
    { label: 'φ', insert: 'phi' },

    { label: '7', insert: '7' },
    { label: '8', insert: '8' },
    { label: '9', insert: '9' },
    { label: '÷', insert: ' / ' },
    { label: '(', insert: '(' },
    { label: ')', insert: ')' },

    { label: '4', insert: '4' },
    { label: '5', insert: '5' },
    { label: '6', insert: '6' },
    { label: '×', insert: ' * ' },
    { label: 'nPr', insert: 'npr(' },
    { label: 'nCr', insert: 'ncr(' },

    { label: '1', insert: '1' },
    { label: '2', insert: '2' },
    { label: '3', insert: '3' },
    { label: '−', insert: ' - ' },
    { label: 'e', insert: 'e' },
    { label: ',', insert: ', ' },

    { label: '0', insert: '0' },
    { label: '.', insert: '.' },
    { label: '%', insert: '/100' },
    { label: '+', insert: ' + ' },
    { label: 'round', insert: 'round(' },
    { label: '⌫', insert: '__BACK__' },
  ];

  const filteredCloudHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return calculatorHistory.filter((item) => {
      if (!q) return true;
      return (
        item.expression.toLowerCase().includes(q) ||
        item.result.toLowerCase().includes(q) ||
        item.mode.toLowerCase().includes(q)
      );
    });
  }, [calculatorHistory, historySearch]);

  const sharedActionHandlers = {
    language,
    onCopy: handleCopyText,
    onSaveCloud: (p: SolverExportPayload) => void handleSavePayload(p),
    onExportPdf: handleExportPdf,
    onSendExcel: handleSendToExcel,
    onInsertReport: handleInsertToReport,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {language === 'bn'
              ? 'প্রফেশনাল সায়েন্টিফিক, ইঞ্জিনিয়ারিং ও গণিত স্যুইট'
              : 'Professional Scientific, Engineering & Math Suite'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {language === 'bn'
              ? 'উচ্চতর সায়েন্টিফিক ফাংশন, সমীকরণ সলভার, ইঞ্জিনিয়ারিং প্যানেল, পরিসংখ্যান ও ক্লাউড হিস্ট্রি।'
              : 'Full scientific keypad, equation & complex solvers, engineering quick calculators, statistics & cloud history.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('category', 'mathematics')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Sigma className="w-3.5 h-3.5" />
          <span>{language === 'bn' ? 'গণিত ফর্মুলা ক্যাটালগ' : 'Formula Calculators'}</span>
        </button>
      </div>

      {/* Segmented Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-fit">
        {(
          [
            { id: 'scientific', en: 'Scientific Pro', bn: 'সায়েন্টিফিক প্রো' },
            { id: 'equations', en: 'Equations & Complex', bn: 'সমীকরণ ও জটিল সংখ্যা' },
            { id: 'engineering', en: 'Engineering Quick', bn: 'ইঞ্জিনিয়ারিং কুইক' },
            { id: 'basic', en: 'Normal Calc', bn: 'সাধারণ ক্যালকুলেটর' },
            { id: 'fraction', en: 'Fraction', bn: 'ভগ্নাংশ' },
            { id: 'statistics', en: 'Statistics', bn: 'পরিসংখ্যান' },
            { id: 'date-diff', en: 'Date Diff', bn: 'তারিখের পার্থক্য' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === item.id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {language === 'bn' ? item.bn : item.en}
          </button>
        ))}
      </div>

      {sciDisabled && (tab === 'scientific' || tab === 'equations' || tab === 'engineering') ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
            {language === 'bn' ? 'সায়েন্টিফিক ক্যালকুলেটর অ্যাডমিন দ্বারা বন্ধ রাখা হয়েছে' : 'Scientific Calculator is currently disabled'}
          </p>
        </div>
      ) : (
        <>
          {tab === 'basic' && <NormalCalculator embedded />}

          {tab === 'scientific' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setAngleMode('deg')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                          angleMode === 'deg'
                            ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        DEG
                      </button>
                      <button
                        type="button"
                        onClick={() => setAngleMode('rad')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                          angleMode === 'rad'
                            ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        RAD
                      </button>
                    </div>

                    <select
                      value={unitTag}
                      onChange={(e) => setUnitTag(e.target.value)}
                      aria-label="Output Unit"
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-mono"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u || 'none'} value={u}>
                          {u ? `Unit: ${u}` : 'No Unit'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpr('')}
                    className="text-xs font-medium text-slate-500 hover:text-red-600 cursor-pointer"
                  >
                    {language === 'bn' ? 'মুছুন' : 'Clear'}
                  </button>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 space-y-2">
                  <input
                    type="text"
                    value={expr}
                    onChange={(e) => setExpr(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') evalSci(expr);
                    }}
                    placeholder="e.g. sin(30) + nthroot(3, 27) + ncr(6, 2)"
                    className="w-full bg-transparent text-base font-mono-tabular text-slate-900 dark:text-white focus:outline-none"
                  />
                  <div className="text-right text-2xl sm:text-3xl font-bold font-mono-tabular text-blue-700 dark:text-blue-400 break-all">
                    = {sciEvaluation.result} {unitTag && !sciEvaluation.error ? unitTag : ''}
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                  {sciButtons.map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => {
                        if (btn.insert === '__BACK__') {
                          setExpr((p) => p.slice(0, -1));
                        } else {
                          setExpr((p) => p + btn.insert);
                        }
                      }}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 py-2 text-xs font-mono font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => evalSci(expr)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 cursor-pointer"
                >
                  <Equal className="w-4 h-4" />
                  <span>{language === 'bn' ? 'হিসাব করুন ও সেভ করুন' : 'Evaluate & Log'}</span>
                </button>

                {/* Step Breakdown + Result Actions */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-500">
                    {language === 'bn' ? 'সূত্র ও ধাপে ধাপে বিশ্লেষণ' : 'Formula & Step-by-Step Breakdown'}
                  </p>
                  <pre className="text-xs font-mono-tabular text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {sciStepsText || (language === 'bn' ? 'একটি রাশি লিখুন...' : 'Enter an expression...')}
                  </pre>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => void handleCopyText(`${sciEvaluation.result}${unitTag ? ` ${unitTag}` : ''}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'কপি' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSavePayload(buildSciPayload())}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'সেভ' : 'Save'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportPdf(buildSciPayload())}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-rose-600" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendToExcel(buildSciPayload())}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertToReport(buildSciPayload())}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>{language === 'bn' ? 'রিপোর্ট' : 'Report'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Per-User Cloud + Session History */}
              <div className="lg:col-span-5 space-y-5">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <History className="w-4 h-4 text-blue-600" />
                      <span>{language === 'bn' ? 'ক্লাউড হিসাবের ইতিহাস' : 'Cloud Calculation History'}</span>
                    </h3>
                    {user && filteredCloudHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void clearCalculatorHistory()}
                        className="text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                      >
                        {language === 'bn' ? 'সব মুছুন' : 'Clear All'}
                      </button>
                    )}
                  </div>

                  {user && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder={language === 'bn' ? 'হিসাব খুঁজুন...' : 'Search history...'}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs"
                      />
                    </div>
                  )}

                  {!user ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      {language === 'bn'
                        ? 'আপনার সকল সায়েন্টিফিক ও ইঞ্জিনিয়ারিং হিসাব ক্লাউডে রাখতে Google দিয়ে সাইন-ইন করুন।'
                        : 'Sign in to sync your scientific & engineering calculation history to Firestore.'}
                    </p>
                  ) : filteredCloudHistory.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      {language === 'bn' ? 'এখনো কোনো ক্লাউড হিসাব নেই।' : 'No saved cloud runs yet.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                      {filteredCloudHistory.map((item) => (
                        <div
                          key={item.id}
                          className="py-2.5 px-1.5 flex items-start justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (item.mode === 'scientific') setExpr(item.expression);
                            }}
                            className="flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold uppercase text-blue-700 dark:text-blue-400">
                                {item.mode}
                              </span>
                              <span className="text-xs font-mono text-slate-500 truncate">{item.expression}</span>
                            </div>
                            <p className="text-sm font-bold font-mono-tabular text-slate-900 dark:text-white truncate">
                              = {item.result} {item.unit || ''}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteCalculatorRun(item.id)}
                            aria-label="Delete entry"
                            className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {language === 'bn' ? 'সেশন টেপ' : 'Session Tape'}
                  </h3>
                  {tape.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      {language === 'bn' ? 'এখনো কোনো হিসাব যুক্ত হয়নি।' : 'Press Enter or Evaluate to log results.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                      {tape.map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setExpr(item.expr)}
                          className="w-full text-left py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 px-2 rounded cursor-pointer"
                        >
                          <p className="text-xs font-mono text-slate-500 truncate">{item.expr}</p>
                          <p className="text-sm font-bold font-mono-tabular text-blue-700 dark:text-blue-400">
                            = {item.result} {item.unit || ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'equations' && <EquationAlgebraPanel {...sharedActionHandlers} />}
          {tab === 'engineering' && <EngineeringQuickPanel {...sharedActionHandlers} />}
        </>
      )}

      {tab === 'fraction' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 max-w-2xl space-y-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Divide className="w-4 h-4 text-blue-600" />
            <span>{language === 'bn' ? 'ভগ্নাংশ যোগ, বিয়োগ, গুণ ও ভাগ' : 'Fraction Arithmetic & Simplifier'}</span>
          </h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-24 space-y-1">
              <input
                type="number"
                value={fA}
                onChange={(e) => setFA(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-center font-mono-tabular text-sm"
              />
              <div className="h-0.5 bg-slate-400" />
              <input
                type="number"
                value={fB}
                onChange={(e) => setFB(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-center font-mono-tabular text-sm"
              />
            </div>

            <select
              value={fOp}
              onChange={(e) => setFOp(e.target.value as '+' | '-' | '*' | '/')}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-base font-bold"
            >
              <option value="+">+</option>
              <option value="-">−</option>
              <option value="*">×</option>
              <option value="/">÷</option>
            </select>

            <div className="w-24 space-y-1">
              <input
                type="number"
                value={fC}
                onChange={(e) => setFC(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-center font-mono-tabular text-sm"
              />
              <div className="h-0.5 bg-slate-400" />
              <input
                type="number"
                value={fD}
                onChange={(e) => setFD(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-center font-mono-tabular text-sm"
              />
            </div>

            <div className="text-xl font-bold text-slate-400">=</div>

            {'error' in fractionResult ? (
              <p className="text-xs text-red-600">{fractionResult.error}</p>
            ) : (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 px-5 py-3">
                <p className="text-xl font-bold font-mono-tabular text-blue-700 dark:text-blue-400">
                  {fractionResult.num} / {fractionResult.den}
                </p>
                <p className="text-xs font-mono-tabular text-slate-600 dark:text-slate-400">
                  Decimal: {fractionResult.decimal}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'statistics' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {language === 'bn' ? 'সংখ্যাগুলো কমা বা স্পেস দিয়ে লিখুন' : 'Enter numbers separated by commas or spaces'}
            </label>
            <textarea
              rows={3}
              value={statsInput}
              onChange={(e) => setStatsInput(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {statsResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: 'Count (n)', val: statsResult.count },
                { label: 'Sum (Σx)', val: statsResult.sum.toFixed(4) },
                { label: 'Mean (μ)', val: statsResult.mean.toFixed(4) },
                { label: 'Median', val: statsResult.median.toFixed(4) },
                { label: 'Mode', val: statsResult.mode },
                { label: 'Min', val: statsResult.min },
                { label: 'Max', val: statsResult.max },
                { label: 'Range', val: statsResult.range.toFixed(4) },
                { label: 'Variance (σ²)', val: statsResult.variancePop.toFixed(4) },
                { label: 'Std Dev (Pop σ)', val: statsResult.stdPop.toFixed(4) },
                { label: 'Std Dev (Sample s)', val: statsResult.stdSample.toFixed(4) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                  <p className="text-[11px] text-slate-500">{s.label}</p>
                  <p className="mt-1 text-base font-bold font-mono-tabular text-slate-900 dark:text-white">{s.val}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'date-diff' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {language === 'bn' ? 'শুরুর তারিখ' : 'Start Date'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {language === 'bn' ? 'শেষ তারিখ' : 'End Date'}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {dateDiffResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 p-3">
                  <p className="text-[11px] text-slate-500">Total Days</p>
                  <p className="text-xl font-bold font-mono-tabular text-blue-700 dark:text-blue-400">
                    {dateDiffResult.totalDays}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                  <p className="text-[11px] text-slate-500">Weeks + Days</p>
                  <p className="text-base font-bold font-mono-tabular">
                    {dateDiffResult.weeks}w {dateDiffResult.remDays}d
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                  <p className="text-[11px] text-slate-500">Approx Years/Mo</p>
                  <p className="text-base font-bold font-mono-tabular">
                    {dateDiffResult.approxYears}y {dateDiffResult.approxMonths}m
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                  <p className="text-[11px] text-slate-500">Total Hours</p>
                  <p className="text-base font-bold font-mono-tabular">
                    {dateDiffResult.hours.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tri-Calendar Equivalents</span>
                </p>
                <p>Start: {dateDiffResult.startTri.bangla.formattedBn} · {dateDiffResult.startTri.hijri.formattedEn} (Est.)</p>
                <p>End: {dateDiffResult.endTri.bangla.formattedBn} · {dateDiffResult.endTri.hijri.formattedEn} (Est.)</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
