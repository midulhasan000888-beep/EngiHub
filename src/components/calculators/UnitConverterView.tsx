import React, { useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UNIT_DIMENSIONS, convertUnitValue, getUnitsForDimension } from '../../engine/unitConverter';

export const UnitConverterView: React.FC = () => {
  const { language, units } = useApp();
  const [dimension, setDimension] = useState('length');
  const [inputValue, setInputValue] = useState('1');

  const dimUnits = useMemo(() => getUnitsForDimension(dimension, units), [dimension, units]);
  const [fromSym, setFromSym] = useState('m');
  const [toSym, setToSym] = useState('ft');

  const handleDimChange = (nextDim: string) => {
    setDimension(nextDim);
    const list = getUnitsForDimension(nextDim, units);
    setFromSym(list[0]?.symbol || '');
    setToSym(list[1]?.symbol || list[0]?.symbol || '');
  };

  const numVal = Number(inputValue);
  const converted = useMemo(() => {
    if (!Number.isFinite(numVal)) return NaN;
    return convertUnitValue(numVal, fromSym, toSym, dimension, units);
  }, [numVal, fromSym, toSym, dimension, units]);

  const handleSwap = () => {
    const prevFrom = fromSym;
    setFromSym(toSym);
    setToSym(prevFrom);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          {language === 'bn' ? 'প্রকৌশল ও সাধারণ একক রূপান্তর' : 'Universal Engineering Unit Converter'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          {language === 'bn'
            ? '১৯টি ভৌত রাশির মেট্রিক, ইম্পেরিয়াল ও স্থানীয় এককে নিখুঁত রূপান্তর।'
            : 'Convert instantly across 19 metric, imperial, regional, and engineering dimensions.'}
        </p>
      </div>

      {/* Dimension Selector */}
      <div className="flex flex-wrap gap-1.5">
        {UNIT_DIMENSIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => handleDimChange(d.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              dimension === d.id
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400'
            }`}
          >
            {language === 'bn' ? d.labelBn : d.labelEn}
          </button>
        ))}
      </div>

      {/* Main Converter Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-end">
          <div className="md:col-span-5 space-y-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              {language === 'bn' ? 'ইনপুট মান ও একক' : 'From Value & Unit'}
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-base font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <select
                value={fromSym}
                onChange={(e) => setFromSym(e.target.value)}
                className="w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-xs font-medium"
              >
                {dimUnits.map((u) => (
                  <option key={u.id} value={u.symbol}>
                    {u.symbol} — {language === 'bn' ? u.nameBn || u.nameEn : u.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Swap units"
              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          <div className="md:col-span-5 space-y-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              {language === 'bn' ? 'রূপান্তরিত ফলাফল' : 'To Target Unit'}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 px-3 py-2.5 text-base font-bold font-mono-tabular text-blue-700 dark:text-blue-400 overflow-x-auto">
                {Number.isFinite(converted) ? Number(converted.toPrecision(8)).toLocaleString('en-US', { maximumSignificantDigits: 8 }) : '—'}
              </div>
              <select
                value={toSym}
                onChange={(e) => setToSym(e.target.value)}
                className="w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-xs font-medium"
              >
                {dimUnits.map((u) => (
                  <option key={u.id} value={u.symbol}>
                    {u.symbol} — {language === 'bn' ? u.nameBn || u.nameEn : u.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* All Equivalents Table */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
            {language === 'bn' ? 'সকল এককে সমতুল্য মান' : 'All Dimension Equivalents'}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {dimUnits.map((u) => {
              const val = Number.isFinite(numVal)
                ? convertUnitValue(numVal, fromSym, u.symbol, dimension, units)
                : NaN;
              return (
                <div
                  key={u.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3"
                >
                  <p className="text-[11px] text-slate-500">
                    {language === 'bn' ? u.nameBn || u.nameEn : u.nameEn} ({u.symbol})
                  </p>
                  <p className="mt-1 text-sm font-bold font-mono-tabular text-slate-900 dark:text-white">
                    {Number.isFinite(val) ? Number(val.toPrecision(7)).toLocaleString('en-US', { maximumSignificantDigits: 7 }) : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
