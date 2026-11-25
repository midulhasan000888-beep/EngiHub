import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Scissors,
  Trash2,
} from 'lucide-react';
import { ReportBlock, ReportPageDesign } from '../../types';
import { generateQrCodeDataUrl } from '../../engine/reportDesignerUtils';

interface Props {
  block: ReportBlock;
  pageDesign: ReportPageDesign;
  pageNumber: number;
  totalPages: number;
  isSelected: boolean;
  isPreviewMode: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onToggleVisible: () => void;
  onDelete: () => void;
  onDragStartBlock?: (e: React.DragEvent) => void;
  onDropOnBlock?: (e: React.DragEvent) => void;
}

const WIDTH_CLASS_MAP: Record<ReportBlock['widthPercent'], string> = {
  25: 'col-span-3',
  33: 'col-span-4',
  50: 'col-span-6',
  66: 'col-span-8',
  75: 'col-span-9',
  100: 'col-span-12',
};

export const ReportBlockCanvasItem: React.FC<Props> = ({
  block,
  pageDesign,
  pageNumber,
  totalPages,
  isSelected,
  isPreviewMode,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onToggleVisible,
  onDelete,
  onDragStartBlock,
  onDropOnBlock,
}) => {
  const [qrUrl, setQrUrl] = useState('');
  const [dragHover, setDragHover] = useState(false);

  useEffect(() => {
    let active = true;
    if (block.type === 'qr-code') {
      generateQrCodeDataUrl(block.content.qrValue || 'SUTRO-SATHI').then((url) => {
        if (active) setQrUrl(url);
      });
    }
    return () => {
      active = false;
    };
  }, [block.type, block.content.qrValue]);

  const accent = pageDesign.accentColor || '#1d4ed8';
  const colSpanClass = WIDTH_CLASS_MAP[block.widthPercent] || 'col-span-12';
  const opts = block.bindingOptions || {
    showInputs: true,
    showFormula: true,
    showSteps: true,
    showResults: true,
    showUnits: true,
    showWarnings: true,
    showReference: true,
  };

  const replaceTokens = (txt = '') =>
    txt
      .replace(/\{\{page\}\}/g, String(pageNumber))
      .replace(/\{\{totalPages\}\}/g, String(totalPages));

  const wrapperStyle: React.CSSProperties = {
    fontFamily: block.style.fontFamily || pageDesign.fontFamily,
    fontSize: block.style.fontSizePx ? `${block.style.fontSizePx}px` : `${pageDesign.fontSizePx}px`,
    color: block.style.color || pageDesign.fontColor,
    backgroundColor:
      block.style.backgroundColor && block.style.backgroundColor !== 'transparent'
        ? block.style.backgroundColor
        : undefined,
    borderColor: block.style.borderColor || '#cbd5e1',
    borderWidth: block.style.borderWidthPx ? `${block.style.borderWidthPx}px` : undefined,
    borderStyle: block.style.borderWidthPx ? 'solid' : undefined,
    padding: `${block.style.paddingPx ?? 6}px`,
    marginBottom: `${block.style.marginBottomPx ?? 4}px`,
    textAlign: block.style.textAlign || 'left',
    lineHeight: block.style.lineHeight || pageDesign.lineHeight,
    fontWeight: block.style.bold ? 700 : undefined,
    fontStyle: block.style.italic ? 'italic' : undefined,
    minHeight: block.minHeightPx ? `${block.minHeightPx}px` : undefined,
    borderRadius: block.style.borderWidthPx || (block.style.backgroundColor && block.style.backgroundColor !== 'transparent') ? '6px' : undefined,
  };

  const renderInner = () => {
    switch (block.type) {
      case 'page-break':
        if (isPreviewMode) return null;
        return (
          <div className="flex items-center gap-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-600 border-y border-dashed border-blue-400 bg-blue-50/70 justify-center">
            <Scissors className="w-3 h-3" />
            <span>Page Break Marker — Next section starts on new page</span>
          </div>
        );

      case 'company-logo':
        return (
          <div className="flex items-center justify-center min-h-[54px]">
            {block.content.imageDataUrl ? (
              <img
                src={block.content.imageDataUrl}
                alt={block.content.caption || 'Company Logo'}
                className="max-h-16 max-w-full object-contain"
              />
            ) : (
              <div className="w-full h-14 border border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-[10px] text-slate-400 gap-1">
                <ImageIcon className="w-4 h-4" />
                <span>{block.content.caption || 'Company Logo'}</span>
              </div>
            )}
          </div>
        );

      case 'company-name':
        return (
          <div>
            <p
              className="leading-tight"
              style={{
                color: block.style.color || accent,
                fontSize: `${block.style.fontSizePx || 17}px`,
                fontWeight: 700,
              }}
            >
              {block.content.text}
            </p>
            {block.content.subtext && (
              <p className="text-[11px] text-slate-500 mt-0.5">{block.content.subtext}</p>
            )}
          </div>
        );

      case 'header':
        return (
          <div
            className="flex items-center justify-between gap-3 pb-1"
            style={{ borderBottom: `2px solid ${accent}` }}
          >
            <span className="font-bold tracking-wide text-[11px] uppercase" style={{ color: accent }}>
              {block.content.text}
            </span>
            {block.content.subtext && (
              <span className="text-[11px] font-mono-tabular text-slate-600">{block.content.subtext}</span>
            )}
          </div>
        );

      case 'report-title':
        return (
          <h1
            className="leading-snug"
            style={{
              fontSize: `${block.style.fontSizePx || 20}px`,
              fontWeight: 700,
              color: block.style.color || '#0f172a',
            }}
          >
            {block.content.text}
          </h1>
        );

      case 'subtitle':
        return (
          <p
            style={{
              fontSize: `${block.style.fontSizePx || 13}px`,
              color: block.style.color || '#475569',
            }}
          >
            {block.content.text}
          </p>
        );

      case 'report-number':
        return (
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Report No.</p>
            <p className="font-mono-tabular font-bold text-xs text-slate-900">{block.content.text}</p>
            {block.content.subtext && <p className="text-[10px] text-slate-500">{block.content.subtext}</p>}
          </div>
        );

      case 'date-time':
        return (
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Date &amp; Time</p>
            <p className="font-mono-tabular font-semibold text-xs text-slate-900">{block.content.text}</p>
            {block.content.subtext && <p className="text-[10px] text-slate-500">{block.content.subtext}</p>}
          </div>
        );

      case 'user-info':
      case 'project-info':
        return (
          <div>
            {block.content.text && (
              <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: accent }}>
                {block.content.text}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(block.content.fields || []).map((f, idx) => (
                <div key={idx} className="min-w-0">
                  <span className="block text-[10px] text-slate-500 truncate">{f.label}</span>
                  <span className="block font-semibold text-[11px] text-slate-900 break-words">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'heading': {
        const sz =
          block.content.headingLevel === 1
            ? 18
            : block.content.headingLevel === 3
              ? 13
              : block.style.fontSizePx || 15;
        return (
          <div className="border-b border-slate-200 pb-1">
            <p style={{ fontSize: `${sz}px`, fontWeight: 700, color: block.style.color || accent }}>
              {block.content.text}
            </p>
          </div>
        );
      }

      case 'paragraph':
      case 'custom-text':
      case 'observations':
      case 'recommendations':
      case 'remarks':
      case 'conclusion': {
        const showLabelHeader = ['observations', 'recommendations', 'remarks', 'conclusion'].includes(block.type);
        return (
          <div>
            {showLabelHeader && (
              <p className="text-[11px] font-bold mb-1" style={{ color: accent }}>
                {block.label}
              </p>
            )}
            <p className="whitespace-pre-line">{block.content.text}</p>
          </div>
        );
      }

      case 'calc-inputs':
        if (!opts.showInputs) {
          return isPreviewMode ? null : (
            <p className="text-[10px] italic text-slate-400">Calculation inputs hidden by binding toggle.</p>
          );
        }
        return (
          <div>
            <p className="text-[11px] font-bold mb-1.5" style={{ color: accent }}>
              {block.content.text || 'Calculation Inputs'}
            </p>
            <div className="space-y-1">
              {(block.content.fields || []).map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px] border-b border-slate-100 pb-0.5 last:border-0">
                  <span className="text-slate-600">{f.label}</span>
                  <span className="font-mono-tabular font-semibold text-slate-900">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'calc-formula':
        return (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold" style={{ color: accent }}>
              {block.content.text || 'Governing Formula'}
            </p>
            {opts.showFormula && block.content.formulaExpression && (
              <div className="rounded bg-white border border-slate-200 px-2.5 py-1.5 font-mono-tabular text-[11px] font-semibold text-slate-900">
                {block.content.formulaExpression}
              </div>
            )}
            {opts.showSteps && block.content.formulaSteps && (
              <p className="text-[11px] font-mono-tabular text-slate-700 whitespace-pre-line">
                {block.content.formulaSteps}
              </p>
            )}
            {opts.showReference && block.content.formulaReference && (
              <p className="text-[10px] text-slate-500">Ref: {block.content.formulaReference}</p>
            )}
          </div>
        );

      case 'calc-results':
        return (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold" style={{ color: accent }}>
              {block.content.text || 'Calculation Results'}
            </p>
            {opts.showResults && (
              <div className="space-y-1">
                {(block.content.fields || []).map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-[11px] border-b border-blue-100 pb-0.5 last:border-0">
                    <span className="text-slate-700 font-medium">{f.label}</span>
                    <span className="font-mono-tabular font-bold text-slate-900">{f.value}</span>
                  </div>
                ))}
              </div>
            )}
            {opts.showWarnings && block.content.warnings && block.content.warnings.length > 0 && (
              <div className="mt-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] text-amber-900 space-y-0.5">
                {block.content.warnings.map((w, idx) => (
                  <p key={idx}>• {w}</p>
                ))}
              </div>
            )}
          </div>
        );

      case 'table': {
        const headers = block.content.tableHeaders || [];
        const rows = block.content.tableRows || [];
        const thBg = block.style.tableHeaderBg || '#f1f5f9';
        const thColor = block.style.tableHeaderColor || '#0f172a';
        return (
          <div className="space-y-1.5">
            {block.content.text && (
              <p className="text-[11px] font-bold" style={{ color: accent }}>
                {block.content.text}
              </p>
            )}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full border-collapse text-[11px]">
                <thead style={{ display: 'table-header-group' }}>
                  <tr style={{ backgroundColor: thBg, color: thColor, borderBottom: '1px solid #cbd5e1' }}>
                    {headers.map((h, i) => (
                      <th key={i} className="py-1.5 px-2 text-left font-semibold border border-slate-200">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr
                      key={ri}
                      style={{
                        backgroundColor: block.style.tableStriped && ri % 2 === 1 ? '#f8fafc' : undefined,
                      }}
                    >
                      {headers.map((_, ci) => (
                        <td key={ci} className="py-1.5 px-2 border border-slate-200 tabular-nums break-words">
                          {row[ci] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'chart': {
        const series = block.content.chartSeries || [];
        const maxVal = Math.max(1, ...series.map((s) => Math.abs(s.value)));
        const chartType = block.content.chartType || 'horizontal-bar';
        return (
          <div className="space-y-2">
            <p className="text-[11px] font-bold" style={{ color: accent }}>
              {block.content.text || 'Chart'}
            </p>
            {series.length === 0 ? (
              <p className="text-[11px] text-slate-400">No chart data points.</p>
            ) : chartType === 'horizontal-bar' ? (
              <div className="space-y-1.5">
                {series.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[11px]">
                    <span className="w-28 truncate text-slate-600">{item.label}</span>
                    <div className="flex-1 h-3.5 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${Math.min(100, (Math.abs(item.value) / maxVal) * 100)}%`,
                          backgroundColor: accent,
                        }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono-tabular font-semibold">
                      {Number(item.value).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : chartType === 'bar' ? (
              <svg viewBox={`0 0 ${Math.max(260, series.length * 56)} 130`} className="w-full h-32">
                {series.map((item, idx) => {
                  const barH = Math.max(4, (Math.abs(item.value) / maxVal) * 85);
                  const x = 16 + idx * 52;
                  const y = 98 - barH;
                  return (
                    <g key={idx}>
                      <rect x={x} y={y} width={30} height={barH} rx={3} fill={accent} />
                      <text x={x + 15} y={y - 4} textAnchor="middle" fontSize="8.5" fill="#0f172a">
                        {item.value.toFixed(1)}
                      </text>
                      <text x={x + 15} y={116} textAnchor="middle" fontSize="8.5" fill="#475569">
                        {item.label.slice(0, 8)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <svg viewBox="0 0 320 120" className="w-full h-28">
                <polyline
                  fill="none"
                  stroke={accent}
                  strokeWidth="2.5"
                  points={series
                    .map((item, idx) => {
                      const x = series.length === 1 ? 160 : 20 + (idx / (series.length - 1)) * 280;
                      const y = 95 - (Math.abs(item.value) / maxVal) * 75;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
                {series.map((item, idx) => {
                  const x = series.length === 1 ? 160 : 20 + (idx / (series.length - 1)) * 280;
                  const y = 95 - (Math.abs(item.value) / maxVal) * 75;
                  return (
                    <g key={idx}>
                      <circle cx={x} cy={y} r={3.5} fill={accent} />
                      <text x={x} y={112} textAnchor="middle" fontSize="8" fill="#475569">
                        {item.label.slice(0, 8)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        );
      }

      case 'image':
      case 'engineering-drawing':
        return (
          <div className="space-y-1.5 text-center">
            {block.type === 'engineering-drawing' && (
              <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-600 border-b border-slate-200 pb-1">
                <span>DWG: {block.content.drawingCode || 'DWG-01'}</span>
                <span>{block.content.scaleLabel || 'NTS'}</span>
              </div>
            )}
            {block.content.imageDataUrl ? (
              <img
                src={block.content.imageDataUrl}
                alt={block.content.caption || block.label}
                className="max-h-56 w-auto mx-auto rounded object-contain"
              />
            ) : (
              <div className="h-20 border border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-[11px] text-slate-400 gap-1">
                <Layers className="w-4 h-4" />
                <span>
                  {block.type === 'engineering-drawing'
                    ? 'Upload Engineering Drawing / CAD Snapshot in Inspector'
                    : 'Upload Photo or Figure in Inspector'}
                </span>
              </div>
            )}
            {block.content.caption && (
              <p className="text-[10px] text-slate-500 font-medium">{block.content.caption}</p>
            )}
          </div>
        );

      case 'signature':
      case 'prepared-by':
      case 'checked-by':
      case 'approved-by':
        return (
          <div className="pt-4">
            {block.content.signatureDataUrl && (
              <img
                src={block.content.signatureDataUrl}
                alt="Signature"
                className="h-10 object-contain mb-1"
              />
            )}
            <div className="border-t border-slate-400 pt-1.5 text-[11px]">
              <p className="font-semibold text-slate-900">{block.content.signerName || 'Authorized Signatory'}</p>
              <p className="text-[10px] text-slate-500">{block.content.signerRole || block.label}</p>
              {block.content.subtext && (
                <p className="text-[10px] font-mono-tabular text-slate-400">{block.content.subtext}</p>
              )}
            </div>
          </div>
        );

      case 'footer':
        return (
          <div className="border-t border-slate-200 pt-1.5 text-[10px] text-slate-500">
            {replaceTokens(block.content.text)}
          </div>
        );

      case 'page-number':
        return (
          <div className="border-t border-slate-200 pt-1.5 text-[10px] font-mono-tabular text-slate-500">
            {replaceTokens(block.content.text || 'Page {{page}} of {{totalPages}}')}
          </div>
        );

      case 'qr-code':
        return (
          <div className="flex flex-col items-center justify-center gap-1">
            {qrUrl ? (
              <img src={qrUrl} alt="QR Code" className="w-16 h-16 object-contain border border-slate-200 rounded" />
            ) : (
              <div className="w-16 h-16 border border-dashed border-slate-300 rounded flex items-center justify-center text-[10px] text-slate-400">
                QR
              </div>
            )}
            {block.content.caption && <span className="text-[9px] text-slate-500">{block.content.caption}</span>}
          </div>
        );
    }
  };

  const rendered = renderInner();
  if (rendered === null) return null;

  return (
    <div
      draggable={!isPreviewMode && Boolean(onDragStartBlock)}
      onDragStart={onDragStartBlock}
      onDragOver={(e) => {
        if (isPreviewMode) return;
        e.preventDefault();
        setDragHover(true);
      }}
      onDragLeave={() => setDragHover(false)}
      onDrop={(e) => {
        if (isPreviewMode) return;
        setDragHover(false);
        onDropOnBlock?.(e);
      }}
      onClick={(e) => {
        if (isPreviewMode) return;
        e.stopPropagation();
        onSelect();
      }}
      style={wrapperStyle}
      className={`${colSpanClass} ${block.type === 'table' ? 'report-table-block' : 'report-block-item'} relative group transition-all ${
        !isPreviewMode
          ? isSelected
            ? 'ring-2 ring-blue-600 ring-offset-1 cursor-pointer'
            : 'hover:ring-1 hover:ring-blue-400/70 cursor-pointer'
          : ''
      } ${dragHover ? 'ring-2 ring-emerald-500 bg-emerald-50/30' : ''} ${
        !block.visible && !isPreviewMode ? 'opacity-45' : ''
      }`}
    >
      {!isPreviewMode && (
        <div
          className={`no-print absolute -top-6 right-0 z-20 flex items-center gap-0.5 rounded-md bg-slate-900 text-white px-1.5 py-0.5 text-[10px] shadow transition-opacity ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="inline-flex items-center gap-0.5 px-1 text-slate-300 cursor-grab" title="Drag to reorder">
            <GripVertical className="w-3 h-3" />
            <span className="max-w-[90px] truncate">{block.label}</span>
          </span>
          <button type="button" onClick={onMoveUp} className="p-0.5 hover:text-blue-300 cursor-pointer" title="Move Up">
            <ArrowUp className="w-3 h-3" />
          </button>
          <button type="button" onClick={onMoveDown} className="p-0.5 hover:text-blue-300 cursor-pointer" title="Move Down">
            <ArrowDown className="w-3 h-3" />
          </button>
          <button type="button" onClick={onDuplicate} className="p-0.5 hover:text-blue-300 cursor-pointer" title="Duplicate">
            <Copy className="w-3 h-3" />
          </button>
          <button type="button" onClick={onToggleVisible} className="p-0.5 hover:text-amber-300 cursor-pointer" title={block.visible ? 'Hide' : 'Show'}>
            {block.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
          <button type="button" onClick={onDelete} className="p-0.5 hover:text-red-400 cursor-pointer" title="Delete">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
      {rendered}
    </div>
  );
};
