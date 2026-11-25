import React, { useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Download, ExternalLink, FileSpreadsheet, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CalculationHistoryEntry } from '../../types';

export const HistorySavedView: React.FC<{ mode: 'history' | 'saved' }> = ({ mode }) => {
  const {
    user,
    language,
    history,
    toggleSaveHistory,
    deleteHistoryEntry,
    navigateTo,
    setPendingReportDraft,
  } = useApp();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter((item) => {
      if (mode === 'saved' && !item.isSaved) return false;
      if (!q) return true;
      return (
        item.calculatorNameEn.toLowerCase().includes(q) ||
        (item.calculatorNameBn || '').toLowerCase().includes(q) ||
        (item.formulaDisplay || '').toLowerCase().includes(q)
      );
    });
  }, [history, mode, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportCsv = () => {
    const headers = ['ID', 'Calculator', 'Formula', 'Inputs', 'Outputs', 'Saved'];
    const lines = [headers.join(',')];
    for (const h of filtered) {
      const inp = Object.entries(h.inputs)
        .map(([k, v]) => `${k}=${v.value}${v.unit || ''}`)
        .join('; ');
      const out = Object.values(h.outputs)
        .map((o) => `${o.labelEn}=${o.formatted}${o.unit || ''}`)
        .join('; ');
      lines.push(
        [
          h.id,
          `"${h.calculatorNameEn.replace(/"/g, '""')}"`,
          `"${(h.formulaDisplay || '').replace(/"/g, '""')}"`,
          `"${inp}"`,
          `"${out}"`,
          h.isSaved ? 'Yes' : 'No',
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sutro-sathi-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendToReport = (entry: CalculationHistoryEntry) => {
    const inputsList = Object.entries(entry.inputs).map(([k, v]) => ({
      label: k,
      value: v.unit ? `${v.value} ${v.unit}` : String(v.value),
    }));
    const outputsList = Object.values(entry.outputs).map((o) => ({
      label: language === 'bn' ? o.labelBn : o.labelEn,
      value: o.unit ? `${o.formatted} ${o.unit}` : o.formatted,
    }));
    const rows = [
      ...Object.entries(entry.inputs).map(([k, v]) => ({
        label: `Input: ${k}`,
        value: String(v.value),
        unit: v.unit || '-',
        notes: 'Parameter',
      })),
      ...Object.values(entry.outputs).map((o) => ({
        label: `Output: ${language === 'bn' ? o.labelBn : o.labelEn}`,
        value: o.formatted,
        unit: o.unit || '-',
        notes: 'Calculated',
      })),
    ];
    setPendingReportDraft({
      title: language === 'bn' ? entry.calculatorNameBn || entry.calculatorNameEn : entry.calculatorNameEn,
      sourceType: 'saved_calculation',
      formulaDisplay: entry.formulaDisplay || '',
      inputsList,
      outputsList,
      rows,
      chartData: Object.entries(entry.outputs).map(([k, o]) => ({
        label: k,
        value: Math.abs(o.value),
      })),
      remarks: entry.formulaDisplay ? `Formula: ${entry.formulaDisplay}` : '',
    });
    navigateTo('reports');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {mode === 'saved'
              ? language === 'bn'
                ? 'সংরক্ষিত হিসাব'
                : 'Saved Calculations'
              : language === 'bn'
                ? 'হিসাবের ইতিহাস'
                : 'Calculation History'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {language === 'bn'
              ? 'পূর্ববর্তী সকল হিসাব দেখুন, বুকমার্ক করুন, সিএসভি এক্সপোর্ট বা রিপোর্টে পাঠান।'
              : 'Browse, filter, bookmark, export CSV, or push past calculations into reports.'}
          </p>
        </div>

        {filtered.length > 0 && (
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={language === 'bn' ? 'হিসাব খুঁজুন...' : 'Search by calculator or formula...'}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 py-2 text-xs"
        />
      </div>

      {!user ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
          {language === 'bn'
            ? 'হিসাবের ইতিহাস দেখতে অনুগ্রহ করে গুগল দিয়ে সাইন ইন করুন।'
            : 'Please sign in with Google to view your persistent calculation history.'}
        </div>
      ) : paged.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
          {mode === 'saved'
            ? language === 'bn'
              ? 'কোনো সংরক্ষিত হিসাব নেই।'
              : 'No saved calculations yet.'
            : language === 'bn'
              ? 'কোনো হিসাবের ইতিহাস নেই।'
              : 'No calculation history recorded yet.'}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Calculator</th>
                  <th className="py-3 px-4 font-semibold">Inputs</th>
                  <th className="py-3 px-4 font-semibold">Primary Outputs</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paged.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {language === 'bn'
                          ? entry.calculatorNameBn || entry.calculatorNameEn
                          : entry.calculatorNameEn}
                      </p>
                      <p className="text-[11px] font-mono-tabular text-slate-500">
                        {entry.formulaDisplay}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-600 dark:text-slate-300">
                      {Object.entries(entry.inputs)
                        .map(([k, v]) => `${k}: ${v.value}${v.unit || ''}`)
                        .join(' · ')}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular font-semibold text-blue-700 dark:text-blue-400">
                      {Object.values(entry.outputs)
                        .slice(0, 2)
                        .map((o) => `${o.formatted} ${o.unit || ''}`)
                        .join(' · ')}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => toggleSaveHistory(entry.id, !entry.isSaved)}
                        title="Toggle Bookmark"
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 cursor-pointer"
                      >
                        {entry.isSaved ? (
                          <BookmarkCheck className="w-4 h-4" />
                        ) : (
                          <Bookmark className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => sendToReport(entry)}
                        title="Export to Report"
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>
                      {entry.categoryId && (
                        <button
                          type="button"
                          onClick={() => navigateTo('category', entry.categoryId, entry.calculatorId)}
                          title="Open Calculator"
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteHistoryEntry(entry.id)}
                        title="Delete"
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 tabular-nums">
                Page {page} of {totalPages} ({filtered.length} entries)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
