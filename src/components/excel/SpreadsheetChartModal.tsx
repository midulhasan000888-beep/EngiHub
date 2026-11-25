import React, { useMemo, useState } from 'react';
import { BarChart3, Check, Download, Plus, Trash2, X } from 'lucide-react';
import {
  Language,
  SpreadsheetChartConfig,
  SpreadsheetChartType,
  SpreadsheetWorksheet,
} from '../../types';
import {
  EvaluatedSheetResult,
  expandRangeMatrix,
  formatCellKey,
} from '../../engine/spreadsheetEngine';

interface Props {
  language: Language;
  sheet: SpreadsheetWorksheet;
  evalResult: EvaluatedSheetResult;
  initialChart?: SpreadsheetChartConfig | null;
  onSaveChart: (chart: SpreadsheetChartConfig) => void;
  onDeleteChart?: (chartId: string) => void;
  onClose: () => void;
}

const CHART_PALETTE = [
  '#1d4ed8',
  '#0d9488',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0284c7',
  '#059669',
  '#ea580c',
];

const CHART_TYPES: Array<{ id: SpreadsheetChartType; labelEn: string; labelBn: string }> = [
  { id: 'bar', labelEn: 'Bar Chart', labelBn: 'বার চার্ট' },
  { id: 'line', labelEn: 'Line Chart', labelBn: 'লাইন চার্ট' },
  { id: 'pie', labelEn: 'Pie Chart', labelBn: 'পাই চার্ট' },
  { id: 'doughnut', labelEn: 'Doughnut Chart', labelBn: 'ডোনাট চার্ট' },
  { id: 'area', labelEn: 'Area Chart', labelBn: 'এরিয়া চার্ট' },
  { id: 'scatter', labelEn: 'Scatter Plot', labelBn: 'স্ক্যাটার প্লট' },
  { id: 'data-table', labelEn: 'Data Summary Table', labelBn: 'ডেটা সারাংশ টেবিল' },
];

export const SpreadsheetChartModal: React.FC<Props> = ({
  language,
  sheet,
  evalResult,
  initialChart,
  onSaveChart,
  onDeleteChart,
  onClose,
}) => {
  const [type, setType] = useState<SpreadsheetChartType>(initialChart?.type || 'bar');
  const [title, setTitle] = useState(
    initialChart?.title || (language === 'bn' ? `${sheet.name} চার্ট` : `${sheet.name} Chart`)
  );
  const [labelRange, setLabelRange] = useState(initialChart?.labelRange || 'A2:A6');
  const [dataRange, setDataRange] = useState(initialChart?.dataRange || 'B2:B6');
  const [showLegend, setShowLegend] = useState(initialChart?.showLegend ?? true);
  const [xAxisLabel, setXAxisLabel] = useState(initialChart?.xAxisLabel || '');
  const [yAxisLabel, setYAxisLabel] = useState(initialChart?.yAxisLabel || '');

  const parsedSeries = useMemo(() => {
    const labelMat = expandRangeMatrix(labelRange.trim() || 'A2:A6');
    const dataMat = expandRangeMatrix(dataRange.trim() || 'B2:B6');

    const labels: string[] = [];
    for (let r = 0; r < labelMat.rows; r++) {
      const k = labelMat.keys[r]?.[0];
      const v = k ? evalResult.formatted[k] || String(evalResult.values[k] ?? '') : '';
      labels.push(v || `Item ${r + 1}`);
    }

    const seriesList: Array<{ name: string; values: number[]; color: string }> = [];
    const seriesCount = Math.max(1, dataMat.cols);
    const rowCount = Math.max(labels.length, dataMat.rows);

    for (let c = 0; c < seriesCount; c++) {
      const firstKey = dataMat.keys[0]?.[c];
      let headerName = `Series ${c + 1}`;
      if (firstKey) {
        // Try header row above firstKey if row > 0
        const colLetter = firstKey.replace(/\d+$/, '');
        const rowNum = Number(firstKey.replace(/^[A-Z]+/, ''));
        if (rowNum > 1) {
          const headerKey = `${colLetter}1`;
          const hVal = evalResult.formatted[headerKey];
          if (hVal) headerName = hVal;
        }
      }
      const vals: number[] = [];
      for (let r = 0; r < rowCount; r++) {
        const k = dataMat.keys[r]?.[c];
        const raw = k ? evalResult.values[k] : 0;
        const num = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[৳$€£,\s%]/g, ''));
        vals.push(Number.isFinite(num) ? num : 0);
      }
      seriesList.push({
        name: headerName,
        values: vals,
        color: CHART_PALETTE[c % CHART_PALETTE.length],
      });
    }

    while (labels.length < rowCount) {
      labels.push(`Row ${labels.length + 1}`);
    }

    const allNums = seriesList.flatMap((s) => s.values);
    const maxVal = Math.max(1, ...allNums.map((n) => Math.abs(n)));
    return { labels, seriesList, maxVal };
  }, [labelRange, dataRange, evalResult]);

  const handleSave = () => {
    onSaveChart({
      id: initialChart?.id || `chart-${Date.now()}`,
      type,
      title: title.trim() || 'Chart',
      labelRange: labelRange.trim() || 'A2:A6',
      dataRange: dataRange.trim() || 'B2:B6',
      showLegend,
      xAxisLabel: xAxisLabel.trim(),
      yAxisLabel: yAxisLabel.trim(),
    });
  };

  const handleDownloadSvg = () => {
    const svgEl = document.getElementById('sutro-excel-chart-svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_') || 'chart'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderSvgChart = () => {
    const { labels, seriesList, maxVal } = parsedSeries;
    const width = 620;
    const height = 310;
    const padL = 56;
    const padR = 24;
    const padT = 36;
    const padB = 54;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    if (type === 'data-table') {
      return (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">
                  {xAxisLabel || (language === 'bn' ? 'লেবেল' : 'Label')}
                </th>
                {seriesList.map((s) => (
                  <th key={s.name} className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100 text-right">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {labels.map((lbl, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">{lbl}</td>
                  {seriesList.map((s) => (
                    <td key={s.name} className="px-3 py-2 text-right font-mono-tabular text-slate-900 dark:text-white">
                      {(s.values[idx] ?? 0).toLocaleString('en-US', { maximumFractionDigits: 3 })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (type === 'pie' || type === 'doughnut') {
      const firstSeries = seriesList[0]?.values || [];
      const total = firstSeries.reduce((a, b) => a + Math.max(0, b), 0) || 1;
      const cx = width / 2 - 40;
      const cy = height / 2 + 6;
      const r = 104;
      const innerR = type === 'doughnut' ? 54 : 0;

      let cumAngle = -Math.PI / 2;
      const slices = firstSeries.map((val, idx) => {
        const angle = (Math.max(0, val) / total) * Math.PI * 2;
        const startA = cumAngle;
        const endA = cumAngle + angle;
        cumAngle = endA;

        const x1 = cx + r * Math.cos(startA);
        const y1 = cy + r * Math.sin(startA);
        const x2 = cx + r * Math.cos(endA);
        const y2 = cy + r * Math.sin(endA);
        const largeArc = angle > Math.PI ? 1 : 0;

        let path = '';
        if (innerR > 0) {
          const ix1 = cx + innerR * Math.cos(endA);
          const iy1 = cy + innerR * Math.sin(endA);
          const ix2 = cx + innerR * Math.cos(startA);
          const iy2 = cy + innerR * Math.sin(startA);
          path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
        } else {
          path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        }
        return {
          path,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
          label: labels[idx] || `Item ${idx + 1}`,
          val,
          pct: ((Math.max(0, val) / total) * 100).toFixed(1),
        };
      });

      return (
        <svg id="sutro-excel-chart-svg" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-white rounded-lg border border-slate-200">
          <text x={width / 2} y={22} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a">
            {title}
          </text>
          {slices.map((sl, i) => (
            <path key={i} d={sl.path} fill={sl.color} stroke="#ffffff" strokeWidth="1.5" />
          ))}
          {showLegend &&
            slices.slice(0, 8).map((sl, i) => (
              <g key={i} transform={`translate(${width - 170}, ${48 + i * 22})`}>
                <rect width="11" height="11" rx="2" fill={sl.color} />
                <text x="16" y="10" fontSize="10.5" fill="#334155">
                  {sl.label.slice(0, 12)} ({sl.pct}%)
                </text>
              </g>
            ))}
        </svg>
      );
    }

    const groupCount = Math.max(1, labels.length);
    const groupWidth = plotW / groupCount;

    return (
      <svg id="sutro-excel-chart-svg" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-white rounded-lg border border-slate-200">
        <text x={width / 2} y={22} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a">
          {title}
        </text>

        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
          const y = padT + plotH * (1 - t);
          const gridVal = maxVal * t;
          return (
            <g key={idx}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#e2e8f0" strokeDasharray="3,3" />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#64748b">
                {gridVal >= 1000 ? `${(gridVal / 1000).toFixed(1)}k` : gridVal.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#94a3b8" />
        <line x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke="#94a3b8" />

        {/* Data rendering */}
        {type === 'bar' &&
          labels.map((_, rowIdx) => {
            const innerW = Math.min(44, (groupWidth * 0.72) / seriesList.length);
            const startX = padL + rowIdx * groupWidth + (groupWidth - innerW * seriesList.length) / 2;
            return seriesList.map((s, sIdx) => {
              const v = Math.max(0, s.values[rowIdx] ?? 0);
              const bh = (v / maxVal) * plotH;
              const x = startX + sIdx * innerW;
              const y = padT + plotH - bh;
              return (
                <g key={`${rowIdx}-${sIdx}`}>
                  <rect x={x} y={y} width={Math.max(4, innerW - 2)} height={bh} rx="2" fill={s.color} />
                </g>
              );
            });
          })}

        {(type === 'line' || type === 'area') &&
          seriesList.map((s, sIdx) => {
            const pts = labels.map((_, rowIdx) => {
              const x = padL + rowIdx * groupWidth + groupWidth / 2;
              const v = Math.max(0, s.values[rowIdx] ?? 0);
              const y = padT + plotH - (v / maxVal) * plotH;
              return { x, y };
            });
            const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
            const areaPoly =
              pts.length > 0
                ? `${pts[0].x},${padT + plotH} ${poly} ${pts[pts.length - 1].x},${padT + plotH}`
                : '';
            return (
              <g key={sIdx}>
                {type === 'area' && pts.length > 1 && (
                  <polygon points={areaPoly} fill={s.color} fillOpacity="0.18" />
                )}
                {pts.length > 1 && (
                  <polyline fill="none" stroke={s.color} strokeWidth="2.5" points={poly} />
                )}
                {pts.map((p, idx) => (
                  <circle key={idx} cx={p.x} cy={p.y} r="4" fill={s.color} stroke="#ffffff" strokeWidth="1.5" />
                ))}
              </g>
            );
          })}

        {type === 'scatter' &&
          seriesList.map((s, sIdx) =>
            labels.map((_, rowIdx) => {
              const x = padL + rowIdx * groupWidth + groupWidth / 2;
              const v = Math.max(0, s.values[rowIdx] ?? 0);
              const y = padT + plotH - (v / maxVal) * plotH;
              return <circle key={`${sIdx}-${rowIdx}`} cx={x} cy={y} r="5.5" fill={s.color} fillOpacity="0.85" />;
            })
          )}

        {/* X labels */}
        {labels.map((lbl, idx) => (
          <text
            key={idx}
            x={padL + idx * groupWidth + groupWidth / 2}
            y={padT + plotH + 16}
            textAnchor="middle"
            fontSize="10"
            fill="#475569"
          >
            {lbl.slice(0, 10)}
          </text>
        ))}

        {/* Axis Titles */}
        {xAxisLabel && (
          <text x={padL + plotW / 2} y={height - 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="#334155">
            {xAxisLabel}
          </text>
        )}
        {yAxisLabel && (
          <text
            x={16}
            y={padT + plotH / 2}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="#334155"
            transform={`rotate(-90, 16, ${padT + plotH / 2})`}
          >
            {yAxisLabel}
          </text>
        )}

        {/* Legend */}
        {showLegend && (
          <g transform={`translate(${padL}, ${height - 26})`}>
            {seriesList.slice(0, 5).map((s, i) => (
              <g key={s.name} transform={`translate(${i * 105}, 0)`}>
                <rect width="10" height="10" rx="2" fill={s.color} />
                <text x="14" y="9" fontSize="10" fill="#334155">
                  {s.name.slice(0, 12)}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'bn' ? 'এক্সেল চার্ট ও গ্রাফ বিল্ডার' : 'Spreadsheet Chart & Graph Builder'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Controls */}
          <div className="lg:col-span-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {language === 'bn' ? 'চার্টের ধরন' : 'Chart Type'}
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SpreadsheetChartType)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                {CHART_TYPES.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {language === 'bn' ? ct.labelBn : ct.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {language === 'bn' ? 'চার্ট শিরোনাম' : 'Chart Title'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'লেবেল রেঞ্জ (যেমন A2:A6)' : 'Label Range (e.g. A2:A6)'}
                </label>
                <input
                  type="text"
                  value={labelRange}
                  onChange={(e) => setLabelRange(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono-tabular text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'ডেটা রেঞ্জ (যেমন B2:C6)' : 'Data Range (e.g. B2:C6)'}
                </label>
                <input
                  type="text"
                  value={dataRange}
                  onChange={(e) => setDataRange(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono-tabular text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'X-অক্ষের নাম' : 'X-Axis Label'}
                </label>
                <input
                  type="text"
                  value={xAxisLabel}
                  onChange={(e) => setXAxisLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'bn' ? 'Y-অক্ষের নাম' : 'Y-Axis Label'}
                </label>
                <input
                  type="text"
                  value={yAxisLabel}
                  onChange={(e) => setYAxisLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={showLegend}
                onChange={(e) => setShowLegend(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              <span>{language === 'bn' ? 'লিজেন্ড (Legend) দেখান' : 'Show Chart Legend'}</span>
            </label>

            <div className="pt-2 text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'bn'
                ? `বর্তমান শিটের সক্রিয় রেঞ্জ অনুযায়ী স্বয়ংক্রিয়ভাবে মান আপডেট হয়। (${formatCellKey(0, 0)} থেকে শুরু)`
                : `Values automatically reflect evaluated formulas from "${sheet.name}".`}
            </div>
          </div>

          {/* Live Chart Preview */}
          <div className="lg:col-span-7 space-y-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
              {renderSvgChart()}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {type !== 'data-table' && (
                  <button
                    type="button"
                    onClick={handleDownloadSvg}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'SVG ডাউনলোড' : 'Download SVG'}</span>
                  </button>
                )}
                {initialChart && onDeleteChart && (
                  <button
                    type="button"
                    onClick={() => onDeleteChart(initialChart.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'চার্ট মুছুন' : 'Remove Chart'}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
              >
                {initialChart ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{language === 'bn' ? 'শিটে চার্ট যুক্ত করুন' : 'Save Chart to Sheet'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
