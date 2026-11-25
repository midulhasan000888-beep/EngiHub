import React, { useMemo } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  BookmarkCheck,
  Building2,
  CalendarDays,
  Cog,
  Coins,
  Cpu,
  Factory,
  FileScan,
  FileSpreadsheet,
  GraduationCap,
  HardHat,
  History,
  Info,
  Languages,
  MapPin,
  MessageSquarePlus,
  NotebookPen,
  Presentation,
  RefreshCw,
  Ruler,
  Search,
  Sigma,
  Sliders,
  Table2,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { NavSection } from '../../types';
import { HomeDownloadAppBanner } from '../common/PWAInstallButton';
import { LiveClockBanner } from './LiveClockBanner';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Sigma,
  Ruler,
  Zap,
  Cog,
  Building2,
  Cpu,
  Factory,
  HardHat,
  ArrowLeftRight,
  FileScan,
  FileSpreadsheet,
  CalendarDays,
  NotebookPen,
  MapPin,
  BookmarkCheck,
  History,
  Languages,
  BookOpen,
  MessageSquarePlus,
  Info,
  Table2,
  Presentation,
  Sliders,
  Coins,
  GraduationCap,
  RefreshCw,
};

const SPECIAL_SECTIONS: Record<string, NavSection> = {
  'unit-converter': 'unit-converter',
  'pdf-analyzer': 'pdf-analyzer',
  'excel-studio': 'excel-studio',
  'presentation-maker': 'presentation-maker',
  translate: 'translate',
  dictionary: 'dictionary',
  suggestions: 'suggestions',
  'about-designer': 'about-designer',
  reports: 'reports',
  calendar: 'calendar',
  notepad: 'notepad',
  location: 'location',
  saved: 'saved',
  history: 'history',
};

export const DashboardHome: React.FC = () => {
  const {
    language,
    categories,
    calculators,
    history,
    reminders,
    globalSearch,
    setGlobalSearch,
    navigateTo,
    appSettings,
  } = useApp();

  const filteredCategories = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.nameEn.toLowerCase().includes(q) ||
        c.nameBn.toLowerCase().includes(q) ||
        (c.descriptionEn || '').toLowerCase().includes(q)
    );
  }, [categories, globalSearch]);

  const matchingCalculators = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    return calculators
      .filter(
        (calc) =>
          calc.enabled &&
          calc.published &&
          (calc.nameEn.toLowerCase().includes(q) ||
            calc.nameBn.toLowerCase().includes(q) ||
            calc.formulaDisplay.toLowerCase().includes(q) ||
            (calc.descriptionEn || '').toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [calculators, globalSearch]);

  const openCategory = (catId: string) => {
    const special = SPECIAL_SECTIONS[catId];
    if (special) {
      navigateTo(special);
    } else {
      navigateTo('category', catId);
    }
  };

  const pendingReminders = useMemo(
    () => reminders.filter((r) => !r.completed).slice(0, 4),
    [reminders]
  );

  return (
    <div className="space-y-8">
      {/* Announcement Banner if configured by Admin */}
      {appSettings.announcementBanner && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
          {appSettings.announcementBanner}
        </div>
      )}

      {/* Live Digital Clock & Dynamic 2026 Tri-Calendar Banner */}
      <LiveClockBanner />

      {/* Always-visible Download / Install EngiHub App Banner (auto-hides once installed) */}
      <HomeDownloadAppBanner language={language} />

      {/* Workspace Header & Search */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              {language === 'bn'
                ? 'EngiHub · সূত্রসাথী — ইঞ্জিনিয়ারিং ও ক্যালকুলেশন প্ল্যাটফর্ম'
                : 'EngiHub · SUTRO SATHI — Engineering & Calculation Workspace'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t(language, 'tagline')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo('pdf-analyzer')}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3.5 py-2 min-h-[40px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileScan className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'এআই স্মার্ট তথ্য বিশ্লেষক' : 'AI Smart Info Analyzer'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('math-suite')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sigma className="w-3.5 h-3.5" />
              <span>{t(language, 'mathSuite')}</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('translate')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{t(language, 'translateTool')}</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('dictionary')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t(language, 'dictionaryTool')}</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('reports')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{t(language, 'reports')}</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder={t(language, 'searchPlaceholder')}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2.5 min-h-[44px] text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </section>

      {/* Direct Calculator Search Results */}
      {matchingCalculators.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {language === 'bn'
              ? `অনুসন্ধান ফলাফল (${matchingCalculators.length})`
              : `Matching Calculators (${matchingCalculators.length})`}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matchingCalculators.map((calc) => (
              <button
                key={calc.id}
                type="button"
                onClick={() => navigateTo('category', calc.categoryId, calc.id)}
                className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-brand-primary transition-colors cursor-pointer space-y-1.5"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {language === 'bn' ? calc.nameBn : calc.nameEn}
                </p>
                <p className="text-xs font-mono-tabular text-brand-primary truncate">
                  {calc.formulaDisplay}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {language === 'bn' ? calc.descriptionBn : calc.descriptionEn}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 15 Category Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t(language, 'allTools')}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {filteredCategories.length} {language === 'bn' ? 'টি মডিউল' : 'modules'} ·{' '}
            {calculators.filter((c) => c.enabled && c.published).length}{' '}
            {language === 'bn' ? 'টি সূত্র' : 'formulas'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const Icon = ICON_MAP[cat.icon || 'Sigma'] || Sigma;
            const calcCount = calculators.filter(
              (c) => c.categoryId === cat.id && c.enabled && c.published
            ).length;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => openCategory(cat.id)}
                className="group text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-brand-primary transition-colors flex flex-col justify-between gap-4 cursor-pointer"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-lg bg-brand-soft text-brand-primary flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-primary transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {language === 'bn' ? cat.nameBn : cat.nameEn}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {language === 'bn' ? cat.descriptionBn : cat.descriptionEn}
                  </p>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 tabular-nums">
                  {calcCount > 0 ? (
                    <span>
                      {calcCount} {language === 'bn' ? 'টি ক্যালকুলেটর' : 'calculators'}
                    </span>
                  ) : (
                    <span>{language === 'bn' ? 'ওয়ার্কস্পেস খুলুন' : 'Open workspace'}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Bottom Workspace Snapshot: Recent Calculations & Upcoming Reminders */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t(language, 'recentCalculations')}
            </h3>
            <button
              type="button"
              onClick={() => navigateTo('history')}
              className="text-xs font-medium text-brand-primary hover:underline cursor-pointer"
            >
              {language === 'bn' ? 'সব দেখুন' : 'View all'}
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              {language === 'bn'
                ? 'কোনো হিসাব এখনো সংরক্ষিত হয়নি। যেকোনো ক্যালকুলেটর থেকে হিসাব শুরু করুন।'
                : 'No calculations recorded yet. Open any calculator to compute and save results.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.slice(0, 4).map((item) => {
                const firstOut = Object.values(item.outputs)[0];
                return (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {language === 'bn'
                          ? item.calculatorNameBn || item.calculatorNameEn
                          : item.calculatorNameEn}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono-tabular">
                        {item.formulaDisplay}
                      </p>
                    </div>
                    {firstOut && (
                      <span className="text-xs font-semibold font-mono-tabular text-brand-primary shrink-0">
                        {firstOut.formatted} {firstOut.unit || ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t(language, 'upcomingReminders')}
            </h3>
            <button
              type="button"
              onClick={() => navigateTo('calendar')}
              className="text-xs font-medium text-brand-primary hover:underline cursor-pointer"
            >
              {language === 'bn' ? 'ক্যালেন্ডার খুলুন' : 'Open calendar'}
            </button>
          </div>
          {pendingReminders.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              {language === 'bn'
                ? 'কোনো আসন্ন রিমাইন্ডার নেই। ক্যালেন্ডার ও রিমাইন্ডার প্যানেল থেকে যুক্ত করুন।'
                : 'No active reminders scheduled. Add reminders in Calendar & Reminders.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingReminders.map((rem) => (
                <div key={rem.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {rem.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {rem.date} · {rem.time} · {rem.priority}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
