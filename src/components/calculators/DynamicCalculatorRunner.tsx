import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bookmark,
  Check,
  Copy,
  FileSpreadsheet,
  Info,
  NotebookPen,
  Play,
  RotateCcw,
  Sparkles,
  Table2,
} from 'lucide-react';
import { CalculatorDefinition, CalculationHistoryEntry } from '../../types';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { runDynamicCalculator } from '../../engine/formulaParser';
import { getUnitsForDimension } from '../../engine/unitConverter';

interface Props {
  calculator: CalculatorDefinition;
}

export const DynamicCalculatorRunner: React.FC<Props> = ({ calculator }) => {
  const {
    user,
    language,
    units,
    recordCalculation,
    setPendingReportDraft,
    setPendingNoteDraft,
    pendingCalculatorPrefill,
    setPendingCalculatorPrefill,
    sendToExcel,
    navigateTo,
    showToast,
  } = useApp();

  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [prefillSource, setPrefillSource] = useState<string | null>(null);

  // Initialize defaults whenever calculator changes
  useEffect(() => {
    const defaults: Record<string, string> = {};
    const unitDefaults: Record<string, string> = {};
    for (const f of calculator.inputs) {
      defaults[f.key] = String(f.defaultValue);
      if (f.defaultUnit) unitDefaults[f.key] = f.defaultUnit;
    }
    if (pendingCalculatorPrefill && pendingCalculatorPrefill.calculatorId === calculator.id) {
      for (const [k, v] of Object.entries(pendingCalculatorPrefill.inputs)) {
        if (Number.isFinite(v)) defaults[k] = String(v);
      }
      if (pendingCalculatorPrefill.units) {
        for (const [k, u] of Object.entries(pendingCalculatorPrefill.units)) {
          if (u) unitDefaults[k] = u;
        }
      }
      setPrefillSource(pendingCalculatorPrefill.sourceDocTitle || 'PDF Document');
      setPendingCalculatorPrefill(null);
    } else {
      setPrefillSource(null);
    }
    setInputValues(defaults);
    setSelectedUnits(unitDefaults);
    setSavedId(null);
  }, [calculator, pendingCalculatorPrefill, setPendingCalculatorPrefill]);

  const numericInputs = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of calculator.inputs) {
      const raw = inputValues[f.key];
      map[f.key] = raw === '' || raw === undefined ? NaN : Number(raw);
    }
    return map;
  }, [calculator.inputs, inputValues]);

  const result = useMemo(
    () => runDynamicCalculator(calculator, numericInputs, selectedUnits, units),
    [calculator, numericInputs, selectedUnits, units]
  );

  const handleLoadExample = () => {
    if (!calculator.exampleInputs) return;
    const next: Record<string, string> = { ...inputValues };
    for (const [k, v] of Object.entries(calculator.exampleInputs)) {
      next[k] = String(v);
    }
    setInputValues(next);
    setSavedId(null);
  };

  const handleReset = () => {
    const defaults: Record<string, string> = {};
    const unitDefaults: Record<string, string> = {};
    for (const f of calculator.inputs) {
      defaults[f.key] = String(f.defaultValue);
      if (f.defaultUnit) unitDefaults[f.key] = f.defaultUnit;
    }
    setInputValues(defaults);
    setSelectedUnits(unitDefaults);
    setSavedId(null);
  };

  const buildHistoryPayload = (isSaved: boolean): Omit<CalculationHistoryEntry, 'id' | 'userId' | 'createdAt'> => {
    const inputsPayload: CalculationHistoryEntry['inputs'] = {};
    for (const f of calculator.inputs) {
      inputsPayload[f.key] = {
        value: numericInputs[f.key],
        unit: selectedUnits[f.key] || f.defaultUnit || '',
      };
    }
    const outputsPayload: CalculationHistoryEntry['outputs'] = {};
    for (const o of result.outputs) {
      outputsPayload[o.key] = {
        value: o.value,
        formatted: o.formatted,
        unit: o.unit || '',
        labelEn: o.labelEn,
        labelBn: o.labelBn,
      };
    }
    return {
      calculatorId: calculator.id,
      calculatorNameEn: calculator.nameEn,
      calculatorNameBn: calculator.nameBn,
      categoryId: calculator.categoryId,
      inputs: inputsPayload,
      outputs: outputsPayload,
      formulaDisplay: calculator.formulaDisplay,
      isSaved,
    };
  };

  const handleSave = async (bookmark = true) => {
    if (!result.valid) return;
    if (!user) {
      showToast(t(language, 'signInPrompt'), 'info');
      return;
    }
    const id = await recordCalculation(buildHistoryPayload(bookmark));
    if (id) {
      setSavedId(id);
      showToast(
        bookmark
          ? language === 'bn'
            ? 'হিসাব সংরক্ষিত হয়েছে।'
            : 'Calculation saved to your cloud history.'
          : language === 'bn'
            ? 'হিসাব ইতিহাসে যুক্ত হয়েছে।'
            : 'Recorded in history.',
        'success'
      );
    }
  };

  const handleExportToReport = () => {
    if (!result.valid) return;
    const rows: Array<{ label: string; value: string; unit: string; notes?: string }> = [];
    const inputsList: Array<{ label: string; value: string }> = [];
    const outputsList: Array<{ label: string; value: string }> = [];

    for (const f of calculator.inputs) {
      const unitStr = selectedUnits[f.key] || f.defaultUnit || '';
      const rawVal = String(inputValues[f.key] ?? f.defaultValue);
      const lbl = language === 'bn' ? f.labelBn : f.labelEn;
      inputsList.push({ label: lbl, value: unitStr ? `${rawVal} ${unitStr}` : rawVal });
      rows.push({
        label: `Input: ${lbl}`,
        value: rawVal,
        unit: unitStr || '-',
        notes: 'Parameter',
      });
    }
    for (const o of result.outputs) {
      const lbl = language === 'bn' ? o.labelBn : o.labelEn;
      outputsList.push({ label: lbl, value: o.unit ? `${o.formatted} ${o.unit}` : o.formatted });
      rows.push({
        label: `Output: ${lbl}`,
        value: o.formatted,
        unit: o.unit || '-',
        notes: o.primary ? 'Primary Result' : 'Derived',
      });
    }

    const stepsLines = calculator.outputs.map((out, i) => {
      const computed = result.outputs[i];
      return `${out.key} = ${out.expression} = ${computed?.formatted ?? ''} ${out.unit || ''}`.trim();
    });

    const warnings = result.triggeredConditions.map(
      (c) => `[${c.severity.toUpperCase()}] ${language === 'bn' ? c.messageBn : c.messageEn}`
    );

    setPendingReportDraft({
      title: language === 'bn' ? calculator.nameBn : calculator.nameEn,
      sourceType: 'calculation',
      formulaDisplay: calculator.formulaDisplay,
      formulaReference: calculator.formulaReference || '',
      stepsText: stepsLines.join('\n'),
      inputsList,
      outputsList,
      warnings,
      rows,
      chartData: result.outputs
        .filter((o) => Number.isFinite(o.value))
        .slice(0, 6)
        .map((o) => ({ label: o.key, value: Math.abs(o.value) })),
      remarks: `${t(language, 'formula')}: ${calculator.formulaDisplay}\n${
        calculator.disclaimerEn ? (language === 'bn' ? calculator.disclaimerBn || calculator.disclaimerEn : calculator.disclaimerEn) : ''
      }`.trim(),
    });
    navigateTo('reports');
  };

  const handleSendToExcel = () => {
    if (!result.valid) return;
    const rows: string[][] = [
      ...calculator.inputs.map((f) => [
        language === 'bn' ? 'ইনপুট' : 'Input',
        language === 'bn' ? f.labelBn : f.labelEn,
        String(inputValues[f.key] ?? f.defaultValue),
        selectedUnits[f.key] || f.defaultUnit || '-',
      ]),
      ...result.outputs.map((o) => [
        language === 'bn' ? 'ফলাফল' : 'Output',
        language === 'bn' ? o.labelBn : o.labelEn,
        String(o.value),
        o.unit || '-',
      ]),
      [
        language === 'bn' ? 'সূত্র' : 'Formula',
        calculator.formulaDisplay,
        calculator.formulaReference || '',
        '',
      ],
    ];
    sendToExcel({
      title: language === 'bn' ? calculator.nameBn : calculator.nameEn,
      sheetName: 'Calculation',
      headers: [
        language === 'bn' ? 'ধরন' : 'Type',
        language === 'bn' ? 'বিবরণ' : 'Parameter',
        language === 'bn' ? 'মান' : 'Value',
        language === 'bn' ? 'একক' : 'Unit',
      ],
      rows,
    });
  };

  const handleSaveAsNote = () => {
    if (!result.valid) return;
    const lines = [
      `${t(language, 'formula')}: ${calculator.formulaDisplay}`,
      '',
      `${t(language, 'inputs')}:`,
      ...calculator.inputs.map(
        (f) => `- ${language === 'bn' ? f.labelBn : f.labelEn}: ${inputValues[f.key]} ${selectedUnits[f.key] || f.defaultUnit || ''}`
      ),
      '',
      `${t(language, 'outputs')}:`,
      ...result.outputs.map(
        (o) => `- ${language === 'bn' ? o.labelBn : o.labelEn}: ${o.formatted} ${o.unit || ''}`
      ),
    ];
    setPendingNoteDraft({
      title: language === 'bn' ? calculator.nameBn : calculator.nameEn,
      content: lines.join('\n'),
      category: calculator.categoryId,
      linkedCalculationId: savedId || calculator.id,
    });
    navigateTo('notepad');
  };

  const handleCopy = () => {
    const text = result.outputs
      .map((o) => `${language === 'bn' ? o.labelBn : o.labelEn}: ${o.formatted} ${o.unit || ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      {prefillSource && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-blue-800 dark:text-blue-200">
          <span>
            {language === 'bn'
              ? `পিডিএফ থেকে আমদানিকৃত মান (${prefillSource}) — হিসাবের আগে অনুগ্রহ করে মান ও একক যাচাই করুন।`
              : `Inputs pre-filled from PDF "${prefillSource}" — review units and assumptions before saving.`}
          </span>
          <button
            type="button"
            onClick={() => setPrefillSource(null)}
            className="underline shrink-0 cursor-pointer"
          >
            {language === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
          </button>
        </div>
      )}
      {/* Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {language === 'bn' ? calculator.nameBn : calculator.nameEn}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {language === 'bn' ? calculator.descriptionBn : calculator.descriptionEn}
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
            v{calculator.version}
          </span>
        </div>

        <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-2">
              {t(language, 'formula')}:
            </span>
            <code className="text-xs sm:text-sm font-mono-tabular text-blue-700 dark:text-blue-400 font-medium">
              {calculator.formulaDisplay}
            </code>
          </div>
          {calculator.formulaReference && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {calculator.formulaReference}
            </span>
          )}
        </div>
      </div>

      {/* Main Split: Inputs & Outputs */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Inputs Panel */}
        <div className="xl:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t(language, 'inputs')}
            </h3>
            <div className="flex items-center gap-2">
              {calculator.exampleInputs && (
                <button
                  type="button"
                  onClick={handleLoadExample}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t(language, 'loadExample')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t(language, 'reset')}</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {calculator.inputs.map((field) => {
              const availableUnits = field.unitDimension
                ? getUnitsForDimension(field.unitDimension, units)
                : [];
              return (
                <div key={field.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`input-${field.key}`}
                      className="text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      {language === 'bn' ? field.labelBn : field.labelEn}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    {(field.min !== undefined || field.max !== undefined) && (
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {field.min !== undefined ? `min ${field.min}` : ''}
                        {field.min !== undefined && field.max !== undefined ? ' · ' : ''}
                        {field.max !== undefined ? `max ${field.max}` : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-stretch gap-2">
                    {field.dataType === 'select' && field.options ? (
                      <select
                        id={`input-${field.key}`}
                        value={inputValues[field.key] ?? String(field.defaultValue)}
                        onChange={(e) =>
                          setInputValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {field.options.map((opt) => (
                          <option key={opt.value} value={String(opt.value)}>
                            {language === 'bn' ? opt.labelBn : opt.labelEn}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`input-${field.key}`}
                        type="number"
                        step={field.step ?? 'any'}
                        value={inputValues[field.key] ?? ''}
                        onChange={(e) =>
                          setInputValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono-tabular text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    )}

                    {availableUnits.length > 0 ? (
                      <select
                        aria-label={`Unit for ${field.labelEn}`}
                        value={selectedUnits[field.key] || field.defaultUnit || ''}
                        onChange={(e) =>
                          setSelectedUnits((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {availableUnits.map((u) => (
                          <option key={u.id} value={u.symbol}>
                            {u.symbol}
                          </option>
                        ))}
                      </select>
                    ) : field.defaultUnit ? (
                      <span className="inline-flex items-center px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300">
                        {field.defaultUnit}
                      </span>
                    ) : null}
                  </div>

                  {(field.helpEn || field.helpBn) && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {language === 'bn' ? field.helpBn || field.helpEn : field.helpEn}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={!result.valid}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {user
                  ? language === 'bn'
                    ? 'হিসাব লগ করুন'
                    : 'Log Calculation'
                  : t(language, 'calculate')}
              </span>
            </button>
          </div>
        </div>

        {/* Outputs Panel */}
        <div className="xl:col-span-6 space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t(language, 'outputs')}
              </h3>
              {result.valid && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? (language === 'bn' ? 'কপি হয়েছে' : 'Copied') : language === 'bn' ? 'কপি' : 'Copy'}</span>
                </button>
              )}
            </div>

            {!result.valid ? (
              <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-4 space-y-1.5">
                {result.validationErrors.map((err, idx) => (
                  <p key={idx} className="text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </p>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.outputs.map((out) => (
                    <div
                      key={out.key}
                      className={`rounded-lg border p-3.5 ${
                        out.primary
                          ? 'border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50'
                      }`}
                    >
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {language === 'bn' ? out.labelBn : out.labelEn}
                      </p>
                      <p className="mt-1 text-xl font-bold font-mono-tabular text-slate-900 dark:text-white">
                        {out.formatted}
                        {out.unit && (
                          <span className="ml-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                            {out.unit}
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Triggered Conditions */}
                {result.triggeredConditions.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t(language, 'conditionsAlerts')}
                    </p>
                    {result.triggeredConditions.map((cond) => (
                      <div
                        key={cond.id}
                        className={`rounded-lg border p-3 flex items-start gap-2.5 text-xs ${
                          cond.severity === 'error'
                            ? 'border-red-200 dark:border-red-900 bg-red-50/80 dark:bg-red-950/30 text-red-800 dark:text-red-200'
                            : cond.severity === 'warning'
                              ? 'border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200'
                              : 'border-blue-200 dark:border-blue-900 bg-blue-50/80 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200'
                        }`}
                      >
                        {cond.severity === 'error' ? (
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        ) : cond.severity === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        )}
                        <span>{language === 'bn' ? cond.messageBn : cond.messageEn}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t(language, 'saveCalculation')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportToReport}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t(language, 'createReport')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSendToExcel}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                  >
                    <Table2 className="w-3.5 h-3.5" />
                    <span>{t(language, 'sendToExcel')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAsNote}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <NotebookPen className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t(language, 'saveAsNote')}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Explanation, Step-by-Step Breakdown & Engineering Disclaimer */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            {calculator.explanationEn && (
              <div>
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  {t(language, 'explanation')}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {language === 'bn' ? calculator.explanationBn || calculator.explanationEn : calculator.explanationEn}
                </p>
              </div>
            )}

            {result.valid && (
              <div className="pt-1">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  {language === 'bn' ? 'ধাপে ধাপে হিসাবের রূপরেখা' : 'Step-by-Step Substitution'}
                </h4>
                <div className="space-y-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-[11px] font-mono-tabular">
                  <div className="text-slate-500 dark:text-slate-400">
                    {language === 'bn' ? 'নরমালাইজড ইনপুট:' : 'Normalized Inputs:'}{' '}
                    {calculator.inputs
                      .map((f) => `${f.key}=${Number((result.normalizedScope[f.key] ?? 0).toPrecision(6))}`)
                      .join(', ')}
                  </div>
                  {calculator.outputs.map((out, i) => {
                    const computed = result.outputs[i];
                    return (
                      <div key={out.key} className="text-slate-700 dark:text-slate-300">
                        <span className="text-blue-700 dark:text-blue-400 font-semibold">{out.key}</span>
                        {' = '}
                        <span>{out.expression}</span>
                        {' = '}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {computed?.formatted} {out.unit || ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {calculator.disclaimerEn && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{t(language, 'engineeringNotice')}</p>
                  <p className="mt-0.5 leading-relaxed">
                    {language === 'bn' ? calculator.disclaimerBn || calculator.disclaimerEn : calculator.disclaimerEn}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
