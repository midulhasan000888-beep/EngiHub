import React, { useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Copy,
  FileDown,
  FileSpreadsheet,
  FileText,
  FunctionSquare,
  Zap,
} from 'lucide-react';
import { Language } from '../../types';

export interface SolverExportPayload {
  mode: 'scientific' | 'engineering';
  title: string;
  formulaDisplay: string;
  inputsSummary: string;
  resultDisplay: string;
  unit: string;
  stepsText: string;
  rows: Array<{ label: string; value: string; unit?: string }>;
}

interface ActionHandlers {
  language: Language;
  onCopy: (text: string) => void;
  onSaveCloud: (payload: SolverExportPayload) => void;
  onExportPdf: (payload: SolverExportPayload) => void;
  onSendExcel: (payload: SolverExportPayload) => void;
  onInsertReport: (payload: SolverExportPayload) => void;
}

const SolverResultToolbar: React.FC<{
  payload: SolverExportPayload;
  handlers: ActionHandlers;
}> = ({ payload, handlers }) => {
  const { language, onCopy, onSaveCloud, onExportPdf, onSendExcel, onInsertReport } = handlers;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => onCopy(payload.resultDisplay)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5" />
        <span>{language === 'bn' ? 'ফলাফল কপি' : 'Copy'}</span>
      </button>
      <button
        type="button"
        onClick={() => onSaveCloud(payload)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70 cursor-pointer"
      >
        <BookmarkPlus className="w-3.5 h-3.5" />
        <span>{language === 'bn' ? 'ক্লাউডে সেভ' : 'Save'}</span>
      </button>
      <button
        type="button"
        onClick={() => onExportPdf(payload)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
      >
        <FileDown className="w-3.5 h-3.5 text-rose-600" />
        <span>{language === 'bn' ? 'PDF এক্সপোর্ট' : 'Export PDF'}</span>
      </button>
      <button
        type="button"
        onClick={() => onSendExcel(payload)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
        <span>{language === 'bn' ? 'এক্সেলে পাঠান' : 'Send to Excel'}</span>
      </button>
      <button
        type="button"
        onClick={() => onInsertReport(payload)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
      >
        <FileText className="w-3.5 h-3.5 text-blue-600" />
        <span>{language === 'bn' ? 'রিপোর্টে যুক্ত করুন' : 'Insert into Report'}</span>
      </button>
    </div>
  );
};

// =========================================================================
// EQUATION, ALGEBRA, COMBINATORICS & COMPLEX NUMBER SOLVER PANEL
// =========================================================================
export const EquationAlgebraPanel: React.FC<ActionHandlers> = (handlers) => {
  const { language } = handlers;
  const [solverKind, setSolverKind] = useState<'linear' | 'quadratic' | 'simultaneous' | 'ratio' | 'combo' | 'complex'>('quadratic');

  // Linear: ax + b = c
  const [linA, setLinA] = useState(4);
  const [linB, setLinB] = useState(-12);
  const [linC, setLinC] = useState(20);

  // Quadratic: ax^2 + bx + c = 0
  const [qA, setQA] = useState(1);
  const [qB, setQB] = useState(-5);
  const [qC, setQC] = useState(6);

  // Simultaneous: a1x + b1y = c1, a2x + b2y = c2
  const [sA1, setSA1] = useState(2);
  const [sB1, setSB1] = useState(3);
  const [sC1, setSC1] = useState(13);
  const [sA2, setSA2] = useState(5);
  const [sB2, setSB2] = useState(-2);
  const [sC2, setSC2] = useState(4);

  // Ratio & Percentage
  const [partVal, setPartVal] = useState(45);
  const [wholeVal, setWholeVal] = useState(180);
  const [ratioA, setRatioA] = useState(3);
  const [ratioB, setRatioB] = useState(5);
  const [ratioTotal, setRatioTotal] = useState(240);

  // Combinatorics
  const [combN, setCombN] = useState(10);
  const [combR, setCombR] = useState(3);

  // Complex numbers: (ar + ai*i) op (br + bi*i)
  const [cAr, setCAr] = useState(3);
  const [cAi, setCAi] = useState(4);
  const [cBr, setCBr] = useState(1);
  const [cBi, setCBi] = useState(-2);
  const [cOp, setCOp] = useState<'+' | '-' | '*' | '/'>('*');

  const factorial = (n: number): number => {
    const k = Math.floor(n);
    if (k < 0 || k > 170) return NaN;
    let res = 1;
    for (let i = 2; i <= k; i++) res *= i;
    return res;
  };

  const payload = useMemo((): SolverExportPayload => {
    if (solverKind === 'linear') {
      const x = linA !== 0 ? (linC - linB) / linA : NaN;
      const resStr = Number.isFinite(x) ? Number(x.toPrecision(10)).toString() : 'Undefined (a = 0)';
      const steps =
        linA === 0
          ? 'Coefficient a = 0, cannot divide by zero.'
          : `1) ${linA}x + (${linB}) = ${linC}\n2) ${linA}x = ${linC} - (${linB}) = ${linC - linB}\n3) x = ${linC - linB} / ${linA} = ${resStr}`;
      return {
        mode: 'scientific',
        title: `Linear Equation: ${linA}x + (${linB}) = ${linC}`,
        formulaDisplay: 'ax + b = c  =>  x = (c - b) / a',
        inputsSummary: `a=${linA}, b=${linB}, c=${linC}`,
        resultDisplay: `x = ${resStr}`,
        unit: '',
        stepsText: steps,
        rows: [
          { label: 'Coefficient a', value: String(linA) },
          { label: 'Constant b', value: String(linB) },
          { label: 'Right side c', value: String(linC) },
          { label: 'Solution (x)', value: resStr },
        ],
      };
    }

    if (solverKind === 'quadratic') {
      if (qA === 0) {
        const x = qB !== 0 ? -qC / qB : NaN;
        const r = Number.isFinite(x) ? Number(x.toPrecision(10)).toString() : 'Undefined';
        return {
          mode: 'scientific',
          title: 'Quadratic Solver (Degenerate Linear)',
          formulaDisplay: 'ax^2 + bx + c = 0 (with a = 0 => bx + c = 0)',
          inputsSummary: `a=${qA}, b=${qB}, c=${qC}`,
          resultDisplay: `x = ${r}`,
          unit: '',
          stepsText: `Since a = 0, equation reduces to ${qB}x + ${qC} = 0 => x = ${r}`,
          rows: [{ label: 'Linear Root (x)', value: r }],
        };
      }
      const disc = qB * qB - 4 * qA * qC;
      const vx = -qB / (2 * qA);
      const vy = qA * vx * vx + qB * vx + qC;
      let rootsText = '';
      let x1Str = '';
      let x2Str = '';
      if (disc > 0) {
        const x1 = (-qB + Math.sqrt(disc)) / (2 * qA);
        const x2 = (-qB - Math.sqrt(disc)) / (2 * qA);
        x1Str = Number(x1.toPrecision(8)).toString();
        x2Str = Number(x2.toPrecision(8)).toString();
        rootsText = `x1 = ${x1Str}, x2 = ${x2Str}`;
      } else if (disc === 0) {
        const x = -qB / (2 * qA);
        x1Str = x2Str = Number(x.toPrecision(8)).toString();
        rootsText = `x1 = x2 = ${x1Str} (Repeated Real Root)`;
      } else {
        const real = Number((-qB / (2 * qA)).toPrecision(6));
        const imag = Number((Math.sqrt(-disc) / Math.abs(2 * qA)).toPrecision(6));
        x1Str = `${real} + ${imag}i`;
        x2Str = `${real} - ${imag}i`;
        rootsText = `x1 = ${x1Str}, x2 = ${x2Str}`;
      }
      const steps = [
        `1) Standard form: (${qA})x² + (${qB})x + (${qC}) = 0`,
        `2) Discriminant Δ = b² - 4ac = (${qB})² - 4(${qA})(${qC}) = ${disc}`,
        `3) x = (-b ± √Δ) / (2a) = (${-qB} ± √${disc}) / ${2 * qA}`,
        `4) Roots: ${rootsText}`,
        `5) Vertex: (${Number(vx.toPrecision(6))}, ${Number(vy.toPrecision(6))})`,
      ].join('\n');
      return {
        mode: 'scientific',
        title: `Quadratic: ${qA}x² + (${qB})x + (${qC}) = 0`,
        formulaDisplay: 'x = (-b ± √(b² - 4ac)) / 2a',
        inputsSummary: `a=${qA}, b=${qB}, c=${qC}`,
        resultDisplay: rootsText,
        unit: '',
        stepsText: steps,
        rows: [
          { label: 'Discriminant (Δ)', value: String(disc) },
          { label: 'Root 1 (x₁)', value: x1Str },
          { label: 'Root 2 (x₂)', value: x2Str },
          { label: 'Vertex (h, k)', value: `(${Number(vx.toPrecision(5))}, ${Number(vy.toPrecision(5))})` },
        ],
      };
    }

    if (solverKind === 'simultaneous') {
      const det = sA1 * sB2 - sA2 * sB1;
      if (det === 0) {
        return {
          mode: 'scientific',
          title: 'Simultaneous Equations (2×2)',
          formulaDisplay: 'Cramer’s Rule: Δ = a1·b2 - a2·b1',
          inputsSummary: `${sA1}x+${sB1}y=${sC1}; ${sA2}x+${sB2}y=${sC2}`,
          resultDisplay: 'No unique solution (Δ = 0)',
          unit: '',
          stepsText: 'Determinant Δ = a1·b2 - a2·b1 = 0. Lines are parallel or coincident.',
          rows: [{ label: 'Determinant (Δ)', value: '0' }],
        };
      }
      const dx = sC1 * sB2 - sC2 * sB1;
      const dy = sA1 * sC2 - sA2 * sC1;
      const x = Number((dx / det).toPrecision(8));
      const y = Number((dy / det).toPrecision(8));
      const steps = [
        `1) Δ = (${sA1}×${sB2}) - (${sA2}×${sB1}) = ${det}`,
        `2) Δx = (${sC1}×${sB2}) - (${sC2}×${sB1}) = ${dx} => x = Δx/Δ = ${x}`,
        `3) Δy = (${sA1}×${sC2}) - (${sA2}×${sC1}) = ${dy} => y = Δy/Δ = ${y}`,
      ].join('\n');
      return {
        mode: 'scientific',
        title: 'Simultaneous Linear Equations (2×2)',
        formulaDisplay: 'x = Δx/Δ,  y = Δy/Δ',
        inputsSummary: `${sA1}x+${sB1}y=${sC1}; ${sA2}x+${sB2}y=${sC2}`,
        resultDisplay: `x = ${x}, y = ${y}`,
        unit: '',
        stepsText: steps,
        rows: [
          { label: 'Determinant Δ', value: String(det) },
          { label: 'x', value: String(x) },
          { label: 'y', value: String(y) },
        ],
      };
    }

    if (solverKind === 'ratio') {
      const pct = wholeVal !== 0 ? (partVal / wholeVal) * 100 : 0;
      const sumParts = ratioA + ratioB;
      const shareA = sumParts !== 0 ? (ratioA / sumParts) * ratioTotal : 0;
      const shareB = sumParts !== 0 ? (ratioB / sumParts) * ratioTotal : 0;
      return {
        mode: 'scientific',
        title: 'Ratio & Percentage Analyzer',
        formulaDisplay: '% = (Part / Whole) × 100 ; Share = (PartRatio / SumRatio) × Total',
        inputsSummary: `Part=${partVal}/${wholeVal}, Ratio=${ratioA}:${ratioB} of ${ratioTotal}`,
        resultDisplay: `${pct.toFixed(2)}% | Shares: ${shareA.toFixed(2)} & ${shareB.toFixed(2)}`,
        unit: '%',
        stepsText: `1) Percentage = (${partVal} / ${wholeVal}) × 100 = ${pct.toFixed(4)}%\n2) Ratio sum = ${ratioA} + ${ratioB} = ${sumParts}\n3) Share A = ${shareA.toFixed(4)}, Share B = ${shareB.toFixed(4)}`,
        rows: [
          { label: 'Percentage', value: pct.toFixed(4), unit: '%' },
          { label: 'Ratio Share A', value: shareA.toFixed(4) },
          { label: 'Ratio Share B', value: shareB.toFixed(4) },
        ],
      };
    }

    if (solverKind === 'combo') {
      const n = Math.floor(combN);
      const r = Math.floor(combR);
      const valid = n >= 0 && r >= 0 && r <= n && n <= 170;
      const nPr = valid ? factorial(n) / factorial(n - r) : NaN;
      const nCr = valid ? nPr / factorial(r) : NaN;
      return {
        mode: 'scientific',
        title: `Permutation & Combination (n=${n}, r=${r})`,
        formulaDisplay: 'nPr = n! / (n-r)!  |  nCr = n! / (r!(n-r)!)',
        inputsSummary: `n=${n}, r=${r}`,
        resultDisplay: valid ? `nPr = ${Math.round(nPr).toLocaleString()}, nCr = ${Math.round(nCr).toLocaleString()}` : 'Invalid (Require 0 ≤ r ≤ n ≤ 170)',
        unit: '',
        stepsText: valid
          ? `1) ${n}P${r} = ${n}! / (${n - r})! = ${Math.round(nPr).toLocaleString()}\n2) ${n}C${r} = ${n}P${r} / ${r}! = ${Math.round(nCr).toLocaleString()}`
          : 'Ensure integer values with 0 ≤ r ≤ n ≤ 170.',
        rows: [
          { label: 'nPr (Permutation)', value: valid ? Math.round(nPr).toLocaleString() : 'Invalid' },
          { label: 'nCr (Combination)', value: valid ? Math.round(nCr).toLocaleString() : 'Invalid' },
        ],
      };
    }

    // Complex
    let rr = 0;
    let ri = 0;
    if (cOp === '+') {
      rr = cAr + cBr;
      ri = cAi + cBi;
    } else if (cOp === '-') {
      rr = cAr - cBr;
      ri = cAi - cBi;
    } else if (cOp === '*') {
      rr = cAr * cBr - cAi * cBi;
      ri = cAr * cBi + cAi * cBr;
    } else {
      const denom = cBr * cBr + cBi * cBi;
      if (denom === 0) {
        rr = NaN;
        ri = NaN;
      } else {
        rr = (cAr * cBr + cAi * cBi) / denom;
        ri = (cAi * cBr - cAr * cBi) / denom;
      }
    }
    const mod = Number.isFinite(rr) ? Math.hypot(rr, ri) : NaN;
    const argDeg = Number.isFinite(rr) ? (Math.atan2(ri, rr) * 180) / Math.PI : NaN;
    const zText = Number.isFinite(rr)
      ? `${Number(rr.toPrecision(6))} ${ri >= 0 ? '+' : '-'} ${Math.abs(Number(ri.toPrecision(6)))}i`
      : 'Division by zero';

    return {
      mode: 'scientific',
      title: `Complex Arithmetic (${cAr}${cAi >= 0 ? '+' : ''}${cAi}i) ${cOp} (${cBr}${cBi >= 0 ? '+' : ''}${cBi}i)`,
      formulaDisplay: 'z = a + bi ; |z| = √(a² + b²) ; θ = atan2(b, a)',
      inputsSummary: `z1=${cAr}+${cAi}i, z2=${cBr}+${cBi}i, op=${cOp}`,
      resultDisplay: zText,
      unit: '',
      stepsText: `Result z = ${zText}\nModulus |z| = ${Number.isFinite(mod) ? mod.toFixed(4) : 'N/A'}\nArgument θ = ${Number.isFinite(argDeg) ? argDeg.toFixed(2) : 'N/A'}°`,
      rows: [
        { label: 'Rectangular Form', value: zText },
        { label: 'Modulus |z|', value: Number.isFinite(mod) ? mod.toFixed(5) : 'N/A' },
        { label: 'Argument (θ)', value: Number.isFinite(argDeg) ? `${argDeg.toFixed(2)}°` : 'N/A' },
      ],
    };
  }, [cAi, cAr, cBi, cBr, cOp, combN, combR, linA, linB, linC, partVal, qA, qB, qC, ratioA, ratioB, ratioTotal, sA1, sA2, sB1, sB2, sC1, sC2, solverKind, wholeVal]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <FunctionSquare className="w-4 h-4 text-blue-600" />
          <span>{language === 'bn' ? 'সমীকরণ, অনুপাত, বিন্যাস-সমাবেশ ও জটিল সংখ্যা সলভার' : 'Equation, Algebra, Combinatorics & Complex Solver'}</span>
        </h3>

        <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          {(
            [
              { id: 'quadratic', en: 'Quadratic', bn: 'দ্বিঘাত (ax²+bx+c)' },
              { id: 'linear', en: 'Linear', bn: 'সরল (ax+b=c)' },
              { id: 'simultaneous', en: '2×2 System', bn: 'সহসমীকরণ (2×2)' },
              { id: 'ratio', en: 'Ratio & %', bn: 'অনুপাত ও %' },
              { id: 'combo', en: 'nPr / nCr', bn: 'nPr / nCr' },
              { id: 'complex', en: 'Complex (a+bi)', bn: 'জটিল সংখ্যা' },
            ] as const
          ).map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setSolverKind(k.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                solverKind === k.id
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {language === 'bn' ? k.bn : k.en}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
          {solverKind === 'linear' && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'a (coeff x)', val: linA, set: setLinA },
                { label: 'b (const)', val: linB, set: setLinB },
                { label: 'c (RHS)', val: linC, set: setLinC },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">{f.label}</label>
                  <input
                    type="number"
                    value={f.val}
                    onChange={(e) => f.set(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular"
                  />
                </div>
              ))}
            </div>
          )}

          {solverKind === 'quadratic' && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'a (x²)', val: qA, set: setQA },
                { label: 'b (x)', val: qB, set: setQB },
                { label: 'c', val: qC, set: setQC },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">{f.label}</label>
                  <input
                    type="number"
                    value={f.val}
                    onChange={(e) => f.set(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular"
                  />
                </div>
              ))}
            </div>
          )}

          {solverKind === 'simultaneous' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">a₁ (x)</label>
                  <input type="number" value={sA1} onChange={(e) => setSA1(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">b₁ (y)</label>
                  <input type="number" value={sB1} onChange={(e) => setSB1(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">c₁ (=)</label>
                  <input type="number" value={sC1} onChange={(e) => setSC1(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">a₂ (x)</label>
                  <input type="number" value={sA2} onChange={(e) => setSA2(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">b₂ (y)</label>
                  <input type="number" value={sB2} onChange={(e) => setSB2(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">c₂ (=)</label>
                  <input type="number" value={sC2} onChange={(e) => setSC2(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
              </div>
            </div>
          )}

          {solverKind === 'ratio' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Part Value</label>
                  <input type="number" value={partVal} onChange={(e) => setPartVal(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Whole Value</label>
                  <input type="number" value={wholeVal} onChange={(e) => setWholeVal(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono-tabular" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Ratio A</label>
                  <input type="number" value={ratioA} onChange={(e) => setRatioA(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Ratio B</label>
                  <input type="number" value={ratioB} onChange={(e) => setRatioB(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Total Qty</label>
                  <input type="number" value={ratioTotal} onChange={(e) => setRatioTotal(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
              </div>
            </div>
          )}

          {solverKind === 'combo' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Total items (n)</label>
                <input type="number" min={0} max={170} value={combN} onChange={(e) => setCombN(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Selected (r)</label>
                <input type="number" min={0} max={170} value={combR} onChange={(e) => setCombR(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular" />
              </div>
            </div>
          )}

          {solverKind === 'complex' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">z₁ Real (a)</label>
                  <input type="number" value={cAr} onChange={(e) => setCAr(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">z₁ Imag (bi)</label>
                  <input type="number" value={cAi} onChange={(e) => setCAi(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Operation</label>
                <select value={cOp} onChange={(e) => setCOp(e.target.value as '+' | '-' | '*' | '/')} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono">
                  <option value="+">+ (Add)</option>
                  <option value="-">− (Subtract)</option>
                  <option value="*">× (Multiply)</option>
                  <option value="/">÷ (Divide)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">z₂ Real (c)</label>
                  <input type="number" value={cBr} onChange={(e) => setCBr(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">z₂ Imag (di)</label>
                  <input type="number" value={cBi} onChange={(e) => setCBi(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono-tabular" />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs">
            <p className="text-[11px] font-semibold text-slate-500 mb-0.5">{language === 'bn' ? 'সূত্র' : 'Formula'}</p>
            <p className="font-mono text-slate-800 dark:text-slate-200">{payload.formulaDisplay}</p>
          </div>
        </div>

        {/* Solution & Step Breakdown */}
        <div className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {payload.rows.map((r) => (
              <div key={r.label} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                <p className="text-[11px] text-slate-500 truncate">{r.label}</p>
                <p className="mt-1 text-sm font-bold font-mono-tabular text-blue-700 dark:text-blue-400 break-words">
                  {r.value} {r.unit || ''}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[11px] font-semibold text-slate-500 mb-1">
              {language === 'bn' ? 'ধাপে ধাপে সমাধান' : 'Step-by-Step Solution'}
            </p>
            <pre className="text-xs font-mono-tabular text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {payload.stepsText}
            </pre>
          </div>

          <SolverResultToolbar payload={payload} handlers={handlers} />
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// ENGINEERING QUICK CALCULATOR PANEL
// =========================================================================
export const EngineeringQuickPanel: React.FC<ActionHandlers> = (handlers) => {
  const { language } = handlers;
  const [engKind, setEngKind] = useState<'ohm' | 'power3p' | 'energy' | 'torque' | 'flow' | 'density'>('power3p');

  // Ohm's Law (V, I -> R, P)
  const [ohmV, setOhmV] = useState(220);
  const [ohmI, setOhmI] = useState(5);

  // 1-Phase / 3-Phase AC Power
  const [phaseType, setPhaseType] = useState<'1p' | '3p'>('3p');
  const [acV, setAcV] = useState(400);
  const [acI, setAcI] = useState(32);
  const [acPf, setAcPf] = useState(0.85);
  const [acEff, setAcEff] = useState(92);

  // Energy & Tariff
  const [loadKw, setLoadKw] = useState(15);
  const [runHours, setRunHours] = useState(8);
  const [daysCount, setDaysCount] = useState(30);
  const [tariff, setTariff] = useState(9.5);

  // Motor Torque & RPM
  const [motorKw, setMotorKw] = useState(7.5);
  const [motorRpm, setMotorRpm] = useState(1450);

  // Pipe Flow & Velocity
  const [pipeDiaMm, setPipeDiaMm] = useState(100);
  const [velocityMs, setVelocityMs] = useState(1.8);

  // Mass & Density
  const [densityKgM3, setDensityKgM3] = useState(7850); // Steel
  const [volLiters, setVolLiters] = useState(25);

  const payload = useMemo((): SolverExportPayload => {
    if (engKind === 'ohm') {
      const r = ohmI !== 0 ? ohmV / ohmI : NaN;
      const p = ohmV * ohmI;
      return {
        mode: 'engineering',
        title: "Ohm's Law & DC Power",
        formulaDisplay: 'R = V / I  |  P = V × I',
        inputsSummary: `V=${ohmV} V, I=${ohmI} A`,
        resultDisplay: `R = ${Number.isFinite(r) ? r.toFixed(3) : '∞'} Ω, P = ${p.toFixed(2)} W`,
        unit: 'Ω / W',
        stepsText: `1) Resistance R = ${ohmV} / ${ohmI} = ${Number.isFinite(r) ? r.toFixed(4) : '∞'} Ω\n2) Electrical Power P = ${ohmV} × ${ohmI} = ${p.toFixed(2)} W (${(p / 1000).toFixed(4)} kW)`,
        rows: [
          { label: 'Resistance (R)', value: Number.isFinite(r) ? r.toFixed(3) : '∞', unit: 'Ω' },
          { label: 'Power (P)', value: p.toFixed(2), unit: 'W' },
          { label: 'Power (kW)', value: (p / 1000).toFixed(4), unit: 'kW' },
        ],
      };
    }

    if (engKind === 'power3p') {
      const factor = phaseType === '3p' ? Math.sqrt(3) : 1;
      const kva = (factor * acV * acI) / 1000;
      const kw = kva * acPf;
      const kvar = Math.sqrt(Math.max(0, kva * kva - kw * kw));
      const shaftKw = kw * (acEff / 100);
      return {
        mode: 'engineering',
        title: phaseType === '3p' ? 'Three-Phase AC Power (3Φ)' : 'Single-Phase AC Power (1Φ)',
        formulaDisplay:
          phaseType === '3p'
            ? 'S = √3·V·I/1000 (kVA), P = S·cosφ (kW), Q = √(S²-P²) (kVAR)'
            : 'S = V·I/1000 (kVA), P = S·cosφ (kW)',
        inputsSummary: `${phaseType === '3p' ? '3Φ' : '1Φ'}, V=${acV}V, I=${acI}A, PF=${acPf}, η=${acEff}%`,
        resultDisplay: `P = ${kw.toFixed(3)} kW (${kva.toFixed(3)} kVA)`,
        unit: 'kW',
        stepsText: `1) Apparent Power S = ${factor.toFixed(4)} × ${acV} × ${acI} / 1000 = ${kva.toFixed(4)} kVA\n2) Active Power P = ${kva.toFixed(4)} × ${acPf} = ${kw.toFixed(4)} kW\n3) Reactive Power Q = ${kvar.toFixed(4)} kVAR\n4) Output Shaft Power = ${shaftKw.toFixed(4)} kW`,
        rows: [
          { label: 'Active Power (P)', value: kw.toFixed(3), unit: 'kW' },
          { label: 'Apparent (S)', value: kva.toFixed(3), unit: 'kVA' },
          { label: 'Reactive (Q)', value: kvar.toFixed(3), unit: 'kVAR' },
          { label: 'Shaft Output', value: shaftKw.toFixed(3), unit: 'kW' },
        ],
      };
    }

    if (engKind === 'energy') {
      const dailyKwh = loadKw * runHours;
      const totalKwh = dailyKwh * daysCount;
      const totalCost = totalKwh * tariff;
      return {
        mode: 'engineering',
        title: 'Electrical Energy & Tariff Estimation',
        formulaDisplay: 'E (kWh) = P(kW) × Hours × Days ; Cost = E × Rate',
        inputsSummary: `Load=${loadKw} kW, ${runHours} h/day × ${daysCount} days @ ${tariff}/kWh`,
        resultDisplay: `${totalKwh.toFixed(2)} kWh (${totalCost.toFixed(2)} BDT)`,
        unit: 'kWh',
        stepsText: `1) Daily Energy = ${loadKw} × ${runHours} = ${dailyKwh.toFixed(2)} kWh/day\n2) Total Energy = ${dailyKwh.toFixed(2)} × ${daysCount} = ${totalKwh.toFixed(2)} kWh\n3) Estimated Cost = ${totalKwh.toFixed(2)} × ${tariff} = ${totalCost.toFixed(2)}`,
        rows: [
          { label: 'Daily Energy', value: dailyKwh.toFixed(2), unit: 'kWh' },
          { label: 'Period Energy', value: totalKwh.toFixed(2), unit: 'kWh' },
          { label: 'Estimated Bill', value: totalCost.toFixed(2), unit: 'Currency' },
        ],
      };
    }

    if (engKind === 'torque') {
      const torqueNm = motorRpm > 0 ? (9550 * motorKw) / motorRpm : 0;
      const omega = (2 * Math.PI * motorRpm) / 60;
      return {
        mode: 'engineering',
        title: 'Motor Shaft Torque & Angular Speed',
        formulaDisplay: 'T (N·m) = 9550 × P(kW) / N(RPM)',
        inputsSummary: `P=${motorKw} kW, Speed=${motorRpm} RPM`,
        resultDisplay: `T = ${torqueNm.toFixed(2)} N·m`,
        unit: 'N·m',
        stepsText: `1) T = (9550 × ${motorKw}) / ${motorRpm} = ${torqueNm.toFixed(3)} N·m\n2) Angular velocity ω = 2πN/60 = ${omega.toFixed(2)} rad/s`,
        rows: [
          { label: 'Torque (T)', value: torqueNm.toFixed(2), unit: 'N·m' },
          { label: 'Angular Speed (ω)', value: omega.toFixed(2), unit: 'rad/s' },
          { label: 'Power (W)', value: (motorKw * 1000).toFixed(0), unit: 'W' },
        ],
      };
    }

    if (engKind === 'flow') {
      const dM = pipeDiaMm / 1000;
      const areaM2 = (Math.PI * dM * dM) / 4;
      const qM3s = areaM2 * velocityMs;
      const qLps = qM3s * 1000;
      const qM3h = qM3s * 3600;
      return {
        mode: 'engineering',
        title: 'Pipe Flow Rate & Velocity',
        formulaDisplay: 'A = π·D²/4 ; Q = A × v',
        inputsSummary: `D=${pipeDiaMm} mm, v=${velocityMs} m/s`,
        resultDisplay: `Q = ${qLps.toFixed(2)} L/s (${qM3h.toFixed(2)} m³/h)`,
        unit: 'L/s',
        stepsText: `1) Diameter D = ${dM.toFixed(4)} m\n2) Area A = π × ${dM.toFixed(4)}² / 4 = ${areaM2.toFixed(6)} m²\n3) Flow Q = ${areaM2.toFixed(6)} × ${velocityMs} = ${qM3s.toFixed(5)} m³/s = ${qLps.toFixed(2)} L/s`,
        rows: [
          { label: 'Area (A)', value: (areaM2 * 10000).toFixed(2), unit: 'cm²' },
          { label: 'Flow (L/s)', value: qLps.toFixed(2), unit: 'L/s' },
          { label: 'Flow (m³/h)', value: qM3h.toFixed(2), unit: 'm³/h' },
        ],
      };
    }

    // Density / Mass
    const volM3 = volLiters / 1000;
    const massKg = densityKgM3 * volM3;
    const weightN = massKg * 9.81;
    return {
      mode: 'engineering',
      title: 'Volume, Density & Mass Calculator',
      formulaDisplay: 'm = ρ × V  |  W = m × g (9.81 m/s²)',
      inputsSummary: `ρ=${densityKgM3} kg/m³, V=${volLiters} L (${volM3} m³)`,
      resultDisplay: `Mass = ${massKg.toFixed(3)} kg`,
      unit: 'kg',
      stepsText: `1) Volume V = ${volLiters} / 1000 = ${volM3.toFixed(4)} m³\n2) Mass m = ${densityKgM3} × ${volM3.toFixed(4)} = ${massKg.toFixed(4)} kg\n3) Weight W = ${massKg.toFixed(4)} × 9.81 = ${weightN.toFixed(2)} N`,
      rows: [
        { label: 'Volume', value: volM3.toFixed(4), unit: 'm³' },
        { label: 'Mass (m)', value: massKg.toFixed(3), unit: 'kg' },
        { label: 'Weight (W)', value: weightN.toFixed(2), unit: 'N' },
      ],
    };
  }, [acEff, acI, acPf, acV, daysCount, densityKgM3, engKind, loadKw, motorKw, motorRpm, ohmI, ohmV, phaseType, pipeDiaMm, runHours, tariff, velocityMs, volLiters]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-600" />
          <span>{language === 'bn' ? 'ইঞ্জিনিয়ারিং কুইক ক্যালকুলেটর প্যানেল' : 'Engineering Quick Calculation Panel'}</span>
        </h3>

        <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          {(
            [
              { id: 'power3p', en: 'AC Power (1Φ/3Φ)', bn: 'AC পাওয়ার (1Φ/3Φ)' },
              { id: 'ohm', en: "Ohm's Law", bn: 'ওহমের সূত্র' },
              { id: 'energy', en: 'Energy & Bill', bn: 'এনার্জি ও বিল' },
              { id: 'torque', en: 'Motor Torque', bn: 'মোটর টর্ক ও RPM' },
              { id: 'flow', en: 'Pipe Flow', bn: 'পাইপ ফ্লো (Q)' },
              { id: 'density', en: 'Mass & Density', bn: 'ভর ও ঘনত্ব' },
            ] as const
          ).map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setEngKind(k.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                engKind === k.id
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {language === 'bn' ? k.bn : k.en}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
          {engKind === 'ohm' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Voltage V (Volts)</label>
                <input type="number" value={ohmV} onChange={(e) => setOhmV(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Current I (Amps)</label>
                <input type="number" value={ohmI} onChange={(e) => setOhmI(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular" />
              </div>
            </div>
          )}

          {engKind === 'power3p' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPhaseType('1p')} className={`py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${phaseType === '1p' ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>1-Phase (1Φ)</button>
                <button type="button" onClick={() => setPhaseType('3p')} className={`py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${phaseType === '3p' ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>3-Phase (3Φ)</button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Voltage V (V)</label>
                  <input type="number" value={acV} onChange={(e) => setAcV(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Current I (A)</label>
                  <input type="number" value={acI} onChange={(e) => setAcI(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Power Factor (cosφ)</label>
                  <input type="number" step="0.01" min={0} max={1} value={acPf} onChange={(e) => setAcPf(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono-tabular" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Efficiency η (%)</label>
                  <input type="number" min={1} max={100} value={acEff} onChange={(e) => setAcEff(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono-tabular" />
                </div>
              </div>
            </div>
          )}

          {engKind === 'energy' && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Load (kW)</label>
                <input type="number" value={loadKw} onChange={(e) => setLoadKw(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Hours / Day</label>
                <input type="number" value={runHours} onChange={(e) => setRunHours(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Days</label>
                <input type="number" value={daysCount} onChange={(e) => setDaysCount(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Tariff / kWh</label>
                <input type="number" step="0.1" value={tariff} onChange={(e) => setTariff(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm font-mono-tabular" />
              </div>
            </div>
          )}

          {engKind === 'torque' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Motor Power (kW)</label>
                <input type="number" step="0.1" value={motorKw} onChange={(e) => setMotorKw(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Speed (RPM)</label>
                <input type="number" value={motorRpm} onChange={(e) => setMotorRpm(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular" />
              </div>
            </div>
          )}

          {engKind === 'flow' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Pipe Inner Dia (mm)</label>
                <input type="number" value={pipeDiaMm} onChange={(e) => setPipeDiaMm(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Velocity (m/s)</label>
                <input type="number" step="0.1" value={velocityMs} onChange={(e) => setVelocityMs(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular" />
              </div>
            </div>
          )}

          {engKind === 'density' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Density ρ (kg/m³)</label>
                <input type="number" value={densityKgM3} onChange={(e) => setDensityKgM3(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Volume (Liters)</label>
                <input type="number" value={volLiters} onChange={(e) => setVolLiters(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm font-mono-tabular" />
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs">
            <p className="text-[11px] font-semibold text-slate-500 mb-0.5">{language === 'bn' ? 'প্রকৌশল সূত্র' : 'Engineering Formula'}</p>
            <p className="font-mono text-slate-800 dark:text-slate-200">{payload.formulaDisplay}</p>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {payload.rows.map((r) => (
              <div key={r.label} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                <p className="text-[11px] text-slate-500 truncate">{r.label}</p>
                <p className="mt-1 text-sm font-bold font-mono-tabular text-blue-700 dark:text-blue-400">
                  {r.value} <span className="text-[11px] font-normal text-slate-500">{r.unit || ''}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-[11px] font-semibold text-slate-500 mb-1">
              {language === 'bn' ? 'ধাপে ধাপে হিসাব' : 'Step-by-Step Breakdown'}
            </p>
            <pre className="text-xs font-mono-tabular text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {payload.stepsText}
            </pre>
          </div>

          <SolverResultToolbar payload={payload} handlers={handlers} />
        </div>
      </div>
    </div>
  );
};
