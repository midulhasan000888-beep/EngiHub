import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Sigma } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { DynamicCalculatorRunner } from './DynamicCalculatorRunner';

export const CategoryView: React.FC = () => {
  const {
    language,
    categories,
    calculators,
    activeCategoryId,
    activeCalculatorId,
    navigateTo,
  } = useApp();

  const [filterText, setFilterText] = useState('');

  const category = useMemo(
    () => categories.find((c) => c.id === activeCategoryId) || categories[0],
    [categories, activeCategoryId]
  );

  const categoryCalcs = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return calculators.filter(
      (c) =>
        c.enabled &&
        c.published &&
        c.categoryId === activeCategoryId &&
        (!q ||
          c.nameEn.toLowerCase().includes(q) ||
          c.nameBn.toLowerCase().includes(q) ||
          c.formulaDisplay.toLowerCase().includes(q))
    );
  }, [calculators, activeCategoryId, filterText]);

  const [selectedCalcId, setSelectedCalcId] = useState<string | null>(activeCalculatorId);

  useEffect(() => {
    if (activeCalculatorId && categoryCalcs.some((c) => c.id === activeCalculatorId)) {
      setSelectedCalcId(activeCalculatorId);
    } else if (categoryCalcs.length > 0 && !categoryCalcs.some((c) => c.id === selectedCalcId)) {
      setSelectedCalcId(categoryCalcs[0].id);
    } else if (categoryCalcs.length === 0) {
      setSelectedCalcId(null);
    }
  }, [activeCalculatorId, categoryCalcs, selectedCalcId]);

  const selectedCalc = useMemo(
    () => categoryCalcs.find((c) => c.id === selectedCalcId) || categoryCalcs[0] || null,
    [categoryCalcs, selectedCalcId]
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Category Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => navigateTo('dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t(language, 'dashboard')}</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {category ? (language === 'bn' ? category.nameBn : category.nameEn) : 'Calculators'}
          </h1>
          {category && (
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              {language === 'bn' ? category.descriptionBn : category.descriptionEn}
            </p>
          )}
        </div>

        {activeCategoryId === 'mathematics' && (
          <button
            type="button"
            onClick={() => navigateTo('math-suite')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sigma className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'সায়েন্টিফিক ও পরিসংখ্যান স্যুইট' : 'Open Scientific & Stats Suite'}</span>
          </button>
        )}
      </div>

      {/* Category Tools Selector + Runner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Tool List */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={language === 'bn' ? 'এই ক্যাটাগরিতে খুঁজুন...' : 'Filter tools...'}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {categoryCalcs.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">{t(language, 'noCalculators')}</p>
          ) : (
            <div className="space-y-1 max-h-[540px] overflow-y-auto pr-1">
              {categoryCalcs.map((calc) => {
                const isSelected = selectedCalc?.id === calc.id;
                return (
                  <button
                    key={calc.id}
                    type="button"
                    onClick={() => setSelectedCalcId(calc.id)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-transparent'
                    }`}
                  >
                    <p className="text-xs font-semibold leading-snug">
                      {language === 'bn' ? calc.nameBn : calc.nameEn}
                    </p>
                    <p className="mt-0.5 text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 truncate">
                      {calc.formulaDisplay}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Calculator Runner */}
        <div className="lg:col-span-8">
          {selectedCalc ? (
            <DynamicCalculatorRunner calculator={selectedCalc} />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
              {t(language, 'noCalculators')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
