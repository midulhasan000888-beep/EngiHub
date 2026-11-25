import React, { useState } from 'react';
import {
  BookmarkPlus,
  Columns,
  DatabaseZap,
  Layout,
  Plus,
  RefreshCw,
  Sliders,
  Trash2,
  Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { uploadUserFileToStorage } from '../../engine/cloudStorage';
import {
  ReportAssetRecord,
  ReportBlock,
  ReportBlockBindingOptions,
  ReportBlockBindingSource,
  ReportPageDesign,
} from '../../types';
import {
  bindBlockToDataSource,
  DEFAULT_REPORT_PAGE_DESIGN,
} from '../../engine/reportDesignerUtils';

interface Props {
  selectedBlock: ReportBlock | null;
  pageDesign: ReportPageDesign;
  onUpdateBlock: (updated: ReportBlock) => void;
  onUpdatePageDesign: (patch: Partial<ReportPageDesign>) => void;
  onResetPageDesign: () => void;
}

function compressUploadImage(file: File, maxW = 800, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof reader.result === 'string' ? reader.result : '');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      if (typeof reader.result === 'string') img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export const ReportPropertyInspector: React.FC<Props> = ({
  selectedBlock,
  pageDesign,
  onUpdateBlock,
  onUpdatePageDesign,
  onResetPageDesign,
}) => {
  const {
    user,
    profile,
    isAdmin,
    language,
    history,
    pdfDocuments,
    events,
    reportAssets,
    reportSettings,
    getUserStorageQuotaBytes,
    getTotalStorageUsedBytes,
    saveReportSection,
    saveReportAsset,
    deleteReportAsset,
    showToast,
  } = useApp();

  const [inspectorTab, setInspectorTab] = useState<'element' | 'page'>('element');
  const [selectedCalcId, setSelectedCalcId] = useState<string>(history[0]?.id || '');
  const [selectedPdfId, setSelectedPdfId] = useState<string>(pdfDocuments[0]?.id || '');
  const [sectionTitleInput, setSectionTitleInput] = useState('');

  const allowCustomPageSizes = isAdmin || reportSettings.allowCustomPageSizes !== false;
  const activeTab = !selectedBlock && inspectorTab === 'element' ? 'page' : inspectorTab;

  const updateContent = (patch: Partial<ReportBlock['content']>) => {
    if (!selectedBlock) return;
    onUpdateBlock({
      ...selectedBlock,
      content: { ...selectedBlock.content, ...patch },
    });
  };

  const updateStyle = (patch: Partial<ReportBlock['style']>) => {
    if (!selectedBlock) return;
    onUpdateBlock({
      ...selectedBlock,
      style: { ...selectedBlock.style, ...patch },
    });
  };

  const updateBindingOption = (key: keyof ReportBlockBindingOptions, val: boolean) => {
    if (!selectedBlock) return;
    const prevOpts = selectedBlock.bindingOptions || {
      showInputs: true,
      showFormula: true,
      showSteps: true,
      showResults: true,
      showUnits: true,
      showWarnings: true,
      showReference: true,
    };
    onUpdateBlock({
      ...selectedBlock,
      bindingOptions: { ...prevOpts, [key]: val },
    });
  };

  const handlePullDynamicData = (sourceOverride?: ReportBlockBindingSource) => {
    if (!selectedBlock) return;
    const src = sourceOverride || selectedBlock.bindingSource || 'calculation';
    const chosenCalc = history.find((h) => h.id === selectedCalcId) || history[0] || null;
    const chosenPdf = pdfDocuments.find((d) => d.id === selectedPdfId) || pdfDocuments[0] || null;
    const bound = bindBlockToDataSource(
      selectedBlock,
      src,
      {
        profile,
        latestCalculation: chosenCalc,
        latestPdf: chosenPdf,
        upcomingEvents: events,
      },
      language
    );
    onUpdateBlock(bound);
    showToast(language === 'bn' ? 'ডায়নামিক ডেটা সিঙ্ক হয়েছে।' : 'Live data synchronized into element.', 'success');
  };

  const handleImageFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetField: 'imageDataUrl' | 'signatureDataUrl',
    assetType: ReportAssetRecord['assetType']
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBlock) return;
    try {
      const dataUrl = await compressUploadImage(file, assetType === 'logo' || assetType === 'signature' ? 420 : 880, 0.78);
      if (dataUrl.length > 290000) {
        showToast('Image is too large after compression. Choose a smaller image.', 'error');
        return;
      }
      updateContent({ [targetField]: dataUrl });
      if (user) {
        let storagePath = '';
        let downloadUrl = '';
        let fileSizeBytes = 0;
        try {
          const blobResp = await fetch(dataUrl);
          const blob = await blobResp.blob();
          const quotaBytes = getUserStorageQuotaBytes(profile);
          const usedBytes = getTotalStorageUsedBytes();
          if (isAdmin || usedBytes + blob.size <= quotaBytes) {
            const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
            const sPath = `users/${user.uid}/report-assets/${Date.now()}_${cleanName}`;
            const uploaded = await uploadUserFileToStorage(blob, sPath, blob.type || 'image/jpeg');
            downloadUrl = uploaded.downloadUrl;
            storagePath = sPath;
            fileSizeBytes = blob.size;
          }
        } catch (storageErr) {
          console.warn('Report asset Cloud Storage upload skipped:', storageErr);
        }

        await saveReportAsset({
          name: file.name.slice(0, 120),
          assetType,
          dataUrl,
          ...(storagePath ? { storagePath, downloadUrl, fileSizeBytes } : {}),
        });
      }
    } catch {
      showToast('Failed to process uploaded image.', 'error');
    }
  };

  const handleSaveAsSection = async () => {
    if (!selectedBlock || !user) {
      showToast(language === 'bn' ? 'সেকশন সংরক্ষণ করতে সাইন ইন করুন।' : 'Sign in to save reusable sections.', 'info');
      return;
    }
    const title = sectionTitleInput.trim() || selectedBlock.label;
    await saveReportSection({
      title,
      blockType: selectedBlock.type,
      category: 'custom',
      blockData: JSON.parse(JSON.stringify(selectedBlock)) as ReportBlock,
    });
    setSectionTitleInput('');
  };

  const fontOptions = [
    { label: 'Plus Jakarta + Noto Sans Bengali', value: '"Plus Jakarta Sans", "Noto Sans Bengali", sans-serif' },
    { label: 'Noto Sans Bengali Primary', value: '"Noto Sans Bengali", "Plus Jakarta Sans", sans-serif' },
    { label: 'JetBrains Mono (Technical)', value: '"JetBrains Mono", "Noto Sans Bengali", monospace' },
    { label: 'Serif Formal (Georgia / Bengali)', value: 'Georgia, "Noto Sans Bengali", serif' },
  ];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full overflow-hidden">
      {/* Top Switch */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-1 bg-slate-50 dark:bg-slate-950">
        <button
          type="button"
          onClick={() => setInspectorTab('element')}
          disabled={!selectedBlock}
          className={`inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40 ${
            activeTab === 'element'
              ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{language === 'bn' ? 'এলিমেন্ট সেটিংস' : 'Element'}</span>
        </button>
        <button
          type="button"
          onClick={() => setInspectorTab('page')}
          className={`inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
            activeTab === 'page'
              ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Layout className="w-3.5 h-3.5" />
          <span>{language === 'bn' ? 'পৃষ্ঠা ডিজাইন' : 'Page Design'}</span>
        </button>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto flex-1 text-xs">
        {activeTab === 'element' && selectedBlock ? (
          <>
            {/* Block Header & Width Resize */}
            <div className="space-y-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 dark:text-white truncate">{selectedBlock.label}</span>
                <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBlock.visible}
                    onChange={(e) => onUpdateBlock({ ...selectedBlock, visible: e.target.checked })}
                  />
                  <span>Visible</span>
                </label>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                  <Columns className="w-3 h-3" />
                  <span>Column Width ({selectedBlock.widthPercent}%)</span>
                </label>
                <div className="grid grid-cols-6 gap-1">
                  {([25, 33, 50, 66, 75, 100] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => onUpdateBlock({ ...selectedBlock, widthPercent: w })}
                      className={`py-1 rounded border text-[11px] font-mono-tabular cursor-pointer ${
                        selectedBlock.widthPercent === w
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {w}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Specific Controls */}
            <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Content</p>

              <div>
                <label className="block text-[11px] font-medium mb-1">Element Label</label>
                <input
                  type="text"
                  value={selectedBlock.label}
                  onChange={(e) => onUpdateBlock({ ...selectedBlock, label: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                />
              </div>

              {'text' in selectedBlock.content && selectedBlock.type !== 'page-break' && (
                <div>
                  <label className="block text-[11px] font-medium mb-1">Text / Heading</label>
                  <textarea
                    rows={['paragraph', 'custom-text', 'observations', 'recommendations', 'remarks', 'conclusion'].includes(selectedBlock.type) ? 4 : 2}
                    value={selectedBlock.content.text || ''}
                    onChange={(e) => updateContent({ text: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2"
                  />
                </div>
              )}

              {selectedBlock.type === 'heading' && (
                <div>
                  <label className="block text-[11px] font-medium mb-1">Heading Level</label>
                  <select
                    value={selectedBlock.content.headingLevel || 2}
                    onChange={(e) => updateContent({ headingLevel: Number(e.target.value) as 1 | 2 | 3 })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                  >
                    <option value={1}>H1 — Major Section</option>
                    <option value={2}>H2 — Standard Heading</option>
                    <option value={3}>H3 — Subheading</option>
                  </select>
                </div>
              )}

              {['company-name', 'header', 'report-number', 'date-time', 'prepared-by', 'checked-by', 'approved-by'].includes(selectedBlock.type) && (
                <div>
                  <label className="block text-[11px] font-medium mb-1">Subtitle / Date / Revision</label>
                  <input
                    type="text"
                    value={selectedBlock.content.subtext || ''}
                    onChange={(e) => updateContent({ subtext: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                  />
                </div>
              )}

              {/* Fields editor (user-info, project-info, calc-inputs, calc-results) */}
              {['user-info', 'project-info', 'calc-inputs', 'calc-results'].includes(selectedBlock.type) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium">Key-Value Fields</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateContent({
                          fields: [...(selectedBlock.content.fields || []), { label: 'Field', value: '-' }],
                        })
                      }
                      className="text-[11px] text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Field</span>
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(selectedBlock.content.fields || []).map((f, idx) => (
                      <div key={idx} className="grid grid-cols-11 gap-1 items-center">
                        <input
                          type="text"
                          value={f.label}
                          onChange={(e) => {
                            const next = [...(selectedBlock.content.fields || [])];
                            next[idx] = { ...f, label: e.target.value };
                            updateContent({ fields: next });
                          }}
                          className="col-span-5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-1 text-[11px]"
                        />
                        <input
                          type="text"
                          value={f.value}
                          onChange={(e) => {
                            const next = [...(selectedBlock.content.fields || [])];
                            next[idx] = { ...f, value: e.target.value };
                            updateContent({ fields: next });
                          }}
                          className="col-span-5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-1 text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateContent({
                              fields: (selectedBlock.content.fields || []).filter((_, i) => i !== idx),
                            })
                          }
                          className="col-span-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calc Formula details */}
              {selectedBlock.type === 'calc-formula' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Formula Expression</label>
                    <input
                      type="text"
                      value={selectedBlock.content.formulaExpression || ''}
                      onChange={(e) => updateContent({ formulaExpression: e.target.value })}
                      className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Calculation Steps</label>
                    <textarea
                      rows={3}
                      value={selectedBlock.content.formulaSteps || ''}
                      onChange={(e) => updateContent({ formulaSteps: e.target.value })}
                      className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Standard / Reference</label>
                    <input
                      type="text"
                      value={selectedBlock.content.formulaReference || ''}
                      onChange={(e) => updateContent({ formulaReference: e.target.value })}
                      className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1"
                    />
                  </div>
                </div>
              )}

              {/* Table Editor */}
              {selectedBlock.type === 'table' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const hdrs = selectedBlock.content.tableHeaders || ['Col'];
                        const rows = selectedBlock.content.tableRows || [];
                        updateContent({
                          tableRows: [...rows, hdrs.map(() => '-')],
                        });
                      }}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      + Add Row
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const hdrs = selectedBlock.content.tableHeaders || [];
                        const rows = selectedBlock.content.tableRows || [];
                        updateContent({
                          tableHeaders: [...hdrs, `Col ${hdrs.length + 1}`],
                          tableRows: rows.map((r) => [...r, '-']),
                        });
                      }}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      + Add Column
                    </button>
                  </div>
                  <div className="overflow-x-auto max-h-56 border border-slate-200 dark:border-slate-800 rounded p-1.5 space-y-1">
                    <div className="flex gap-1">
                      {(selectedBlock.content.tableHeaders || []).map((h, ci) => (
                        <input
                          key={ci}
                          type="text"
                          value={h}
                          onChange={(e) => {
                            const next = [...(selectedBlock.content.tableHeaders || [])];
                            next[ci] = e.target.value;
                            updateContent({ tableHeaders: next });
                          }}
                          className="w-20 shrink-0 rounded border border-blue-200 bg-blue-50/50 dark:bg-slate-950 px-1.5 py-1 text-[10px] font-semibold"
                        />
                      ))}
                    </div>
                    {(selectedBlock.content.tableRows || []).map((row, ri) => (
                      <div key={ri} className="flex gap-1 items-center">
                        {(selectedBlock.content.tableHeaders || []).map((_, ci) => (
                          <input
                            key={ci}
                            type="text"
                            value={row[ci] ?? ''}
                            onChange={(e) => {
                              const nextRows = (selectedBlock.content.tableRows || []).map((r, idx) =>
                                idx === ri ? r.map((c, cIdx) => (cIdx === ci ? e.target.value : c)) : r
                              );
                              updateContent({ tableRows: nextRows });
                            }}
                            className="w-20 shrink-0 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px]"
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            updateContent({
                              tableRows: (selectedBlock.content.tableRows || []).filter((_, i) => i !== ri),
                            })
                          }
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedBlock.style.tableStriped)}
                        onChange={(e) => updateStyle({ tableStriped: e.target.checked })}
                      />
                      <span>Striped Rows</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[11px]">
                      <span>Header Bg</span>
                      <input
                        type="color"
                        value={selectedBlock.style.tableHeaderBg || '#f1f5f9'}
                        onChange={(e) => updateStyle({ tableHeaderBg: e.target.value })}
                        className="w-6 h-5 rounded border border-slate-200"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Chart Editor */}
              {selectedBlock.type === 'chart' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Chart Type</label>
                    <select
                      value={selectedBlock.content.chartType || 'horizontal-bar'}
                      onChange={(e) =>
                        updateContent({ chartType: e.target.value as 'bar' | 'horizontal-bar' | 'line' })
                      }
                      className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5"
                    >
                      <option value="horizontal-bar">Horizontal Bar</option>
                      <option value="bar">Vertical Column Bar</option>
                      <option value="line">Trend Line</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium">Data Series</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateContent({
                          chartSeries: [...(selectedBlock.content.chartSeries || []), { label: 'Item', value: 10 }],
                        })
                      }
                      className="text-[11px] text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      + Add Point
                    </button>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {(selectedBlock.content.chartSeries || []).map((pt, idx) => (
                      <div key={idx} className="grid grid-cols-11 gap-1 items-center">
                        <input
                          type="text"
                          value={pt.label}
                          onChange={(e) => {
                            const next = [...(selectedBlock.content.chartSeries || [])];
                            next[idx] = { ...pt, label: e.target.value };
                            updateContent({ chartSeries: next });
                          }}
                          className="col-span-6 rounded border border-slate-200 dark:border-slate-700 px-1.5 py-1 text-[11px]"
                        />
                        <input
                          type="number"
                          step="any"
                          value={pt.value}
                          onChange={(e) => {
                            const next = [...(selectedBlock.content.chartSeries || [])];
                            next[idx] = { ...pt, value: Number(e.target.value) };
                            updateContent({ chartSeries: next });
                          }}
                          className="col-span-4 rounded border border-slate-200 dark:border-slate-700 px-1.5 py-1 text-[11px] font-mono-tabular"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateContent({
                              chartSeries: (selectedBlock.content.chartSeries || []).filter((_, i) => i !== idx),
                            })
                          }
                          className="col-span-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image / Logo / Engineering Drawing Upload */}
              {['company-logo', 'image', 'engineering-drawing'].includes(selectedBlock.type) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleImageFileUpload(
                            e,
                            'imageDataUrl',
                            selectedBlock.type === 'company-logo'
                              ? 'logo'
                              : selectedBlock.type === 'engineering-drawing'
                                ? 'drawing'
                                : 'image'
                          )
                        }
                        className="hidden"
                      />
                    </label>
                    {selectedBlock.content.imageDataUrl && (
                      <button
                        type="button"
                        onClick={() => updateContent({ imageDataUrl: '' })}
                        className="text-[11px] text-red-600 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {reportAssets.length > 0 && (
                    <div className="space-y-1.5">
                      <select
                        value=""
                        onChange={(e) => {
                          const found = reportAssets.find((a) => a.id === e.target.value);
                          if (found) updateContent({ imageDataUrl: found.dataUrl || found.downloadUrl || '' });
                        }}
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                      >
                        <option value="">-- Reuse Saved Asset ({reportAssets.length}) --</option>
                        {reportAssets.map((a) => (
                          <option key={a.id} value={a.id}>
                            [{a.assetType}] {a.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-wrap gap-1">
                        {reportAssets.slice(0, 6).map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-0.5 text-[10px]"
                          >
                            <button
                              type="button"
                              onClick={() => updateContent({ imageDataUrl: a.dataUrl || a.downloadUrl || '' })}
                              className="hover:text-blue-700 cursor-pointer truncate max-w-[90px]"
                            >
                              {a.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteReportAsset(a.id)}
                              title="Delete saved asset"
                              className="text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <input
                    type="text"
                    value={selectedBlock.content.caption || ''}
                    onChange={(e) => updateContent({ caption: e.target.value })}
                    placeholder="Caption"
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                  />
                  {selectedBlock.type === 'engineering-drawing' && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={selectedBlock.content.drawingCode || ''}
                        onChange={(e) => updateContent({ drawingCode: e.target.value })}
                        placeholder="Drawing Code"
                        className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px]"
                      />
                      <input
                        type="text"
                        value={selectedBlock.content.scaleLabel || ''}
                        onChange={(e) => updateContent({ scaleLabel: e.target.value })}
                        placeholder="Scale 1:50"
                        className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Signoff blocks */}
              {['signature', 'prepared-by', 'checked-by', 'approved-by'].includes(selectedBlock.type) && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={selectedBlock.content.signerName || ''}
                    onChange={(e) => updateContent({ signerName: e.target.value })}
                    placeholder="Signatory Name"
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                  />
                  <input
                    type="text"
                    value={selectedBlock.content.signerRole || ''}
                    onChange={(e) => updateContent({ signerRole: e.target.value })}
                    placeholder="Designation / Role"
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                  />
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] cursor-pointer">
                      <Upload className="w-3 h-3" />
                      <span>Upload Signature PNG</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageFileUpload(e, 'signatureDataUrl', 'signature')}
                        className="hidden"
                      />
                    </label>
                    {selectedBlock.content.signatureDataUrl && (
                      <button
                        type="button"
                        onClick={() => updateContent({ signatureDataUrl: '' })}
                        className="text-[11px] text-red-600 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* QR Code */}
              {selectedBlock.type === 'qr-code' && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium">QR Payload / Verification URL</label>
                  <input
                    type="text"
                    value={selectedBlock.content.qrValue || ''}
                    onChange={(e) => updateContent({ qrValue: e.target.value })}
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px] font-mono-tabular"
                  />
                  <input
                    type="text"
                    value={selectedBlock.content.caption || ''}
                    onChange={(e) => updateContent({ caption: e.target.value })}
                    placeholder="QR Caption"
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                  />
                </div>
              )}
            </div>

            {/* Dynamic Data Binding */}
            <div className="space-y-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <DatabaseZap className="w-3.5 h-3.5 text-blue-600" />
                <span>Dynamic Data Binding</span>
              </p>

              <select
                value={selectedBlock.bindingSource || 'manual'}
                onChange={(e) => {
                  const src = e.target.value as ReportBlockBindingSource;
                  onUpdateBlock({ ...selectedBlock, bindingSource: src });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
              >
                <option value="manual">Manual Entry (Custom)</option>
                <option value="calculation">Calculation Engine / Saved History</option>
                <option value="pdf_analyzer">AI PDF Analyzer Document</option>
                <option value="user_profile">User Profile Information</option>
                <option value="calendar">Tri-Calendar &amp; Schedule Events</option>
              </select>

              {(selectedBlock.bindingSource === 'calculation' || selectedBlock.bindingSource === 'saved_calculation') &&
                history.length > 0 && (
                  <select
                    value={selectedCalcId}
                    onChange={(e) => setSelectedCalcId(e.target.value)}
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                  >
                    {history.slice(0, 20).map((h) => (
                      <option key={h.id} value={h.id}>
                        {language === 'bn' ? h.calculatorNameBn || h.calculatorNameEn : h.calculatorNameEn}
                      </option>
                    ))}
                  </select>
                )}

              {selectedBlock.bindingSource === 'pdf_analyzer' && pdfDocuments.length > 0 && (
                <select
                  value={selectedPdfId}
                  onChange={(e) => setSelectedPdfId(e.target.value)}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                >
                  {pdfDocuments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.pageCount}p)
                    </option>
                  ))}
                </select>
              )}

              {selectedBlock.bindingSource && selectedBlock.bindingSource !== 'manual' && (
                <button
                  type="button"
                  onClick={() => handlePullDynamicData(selectedBlock.bindingSource)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 py-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync Data into Block Now</span>
                </button>
              )}

              {['calc-inputs', 'calc-formula', 'calc-results', 'table'].includes(selectedBlock.type) && (
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                  {(
                    [
                      ['showInputs', 'Inputs'],
                      ['showFormula', 'Formula'],
                      ['showSteps', 'Steps'],
                      ['showResults', 'Results'],
                      ['showUnits', 'Units'],
                      ['showWarnings', 'Warnings'],
                      ['showReference', 'Reference'],
                    ] as const
                  ).map(([optKey, optLabel]) => (
                    <label key={optKey} className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBlock.bindingOptions?.[optKey] ?? true}
                        onChange={(e) => updateBindingOption(optKey, e.target.checked)}
                      />
                      <span>Show {optLabel}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Styling */}
            <div className="space-y-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Typography &amp; Style</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Font Size (px)</label>
                  <input
                    type="number"
                    min={8}
                    max={36}
                    value={selectedBlock.style.fontSizePx || pageDesign.fontSizePx}
                    onChange={(e) => updateStyle({ fontSizePx: Number(e.target.value) })}
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Alignment</label>
                  <select
                    value={selectedBlock.style.textAlign || 'left'}
                    onChange={(e) =>
                      updateStyle({ textAlign: e.target.value as ReportBlock['style']['textAlign'] })
                    }
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                    <option value="justify">Justify</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Text Color</label>
                  <input
                    type="color"
                    value={selectedBlock.style.color || pageDesign.fontColor}
                    onChange={(e) => updateStyle({ color: e.target.value })}
                    className="w-full h-7 rounded border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Fill Background</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={
                        selectedBlock.style.backgroundColor && selectedBlock.style.backgroundColor !== 'transparent'
                          ? selectedBlock.style.backgroundColor
                          : '#ffffff'
                      }
                      onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                      className="flex-1 h-7 rounded border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => updateStyle({ backgroundColor: 'transparent' })}
                      className="text-[10px] px-1.5 py-1 border border-slate-200 dark:border-slate-700 rounded cursor-pointer"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Border Width (px)</label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={selectedBlock.style.borderWidthPx ?? 0}
                    onChange={(e) => updateStyle({ borderWidthPx: Number(e.target.value) })}
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Padding (px)</label>
                  <input
                    type="number"
                    min={0}
                    max={32}
                    value={selectedBlock.style.paddingPx ?? 6}
                    onChange={(e) => updateStyle({ paddingPx: Number(e.target.value) })}
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono-tabular"
                  />
                </div>
              </div>
              <div className="flex gap-3 text-[11px]">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedBlock.style.bold)}
                    onChange={(e) => updateStyle({ bold: e.target.checked })}
                  />
                  <span className="font-bold">Bold</span>
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedBlock.style.italic)}
                    onChange={(e) => updateStyle({ italic: e.target.checked })}
                  />
                  <span className="italic">Italic</span>
                </label>
              </div>
            </div>

            {/* Save as reusable section */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Save as Reusable Section</p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={sectionTitleInput}
                  onChange={(e) => setSectionTitleInput(e.target.value)}
                  placeholder={selectedBlock.label}
                  className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                />
                <button
                  type="button"
                  onClick={handleSaveAsSection}
                  className="inline-flex items-center gap-1 rounded bg-slate-800 dark:bg-blue-700 text-white px-2.5 py-1 text-[11px] font-medium cursor-pointer"
                >
                  <BookmarkPlus className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Page & Document Design Controls */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-900 dark:text-white">Document &amp; Page Setup</p>
              <button
                type="button"
                onClick={onResetPageDesign}
                className="text-[11px] text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium mb-1">Page Size</label>
                <select
                  value={pageDesign.pageSize}
                  onChange={(e) =>
                    onUpdatePageDesign({ pageSize: e.target.value as ReportPageDesign['pageSize'] })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5"
                >
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="letter">Letter (216 × 279 mm)</option>
                  <option value="legal">Legal (216 × 356 mm)</option>
                  {allowCustomPageSizes && <option value="custom">Custom (mm)</option>}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1">Orientation</label>
                <select
                  value={pageDesign.orientation}
                  onChange={(e) =>
                    onUpdatePageDesign({ orientation: e.target.value as 'portrait' | 'landscape' })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>

            {pageDesign.pageSize === 'custom' && allowCustomPageSizes && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Width (mm)</label>
                  <input
                    type="number"
                    min={100}
                    max={450}
                    value={pageDesign.customWidthMm}
                    onChange={(e) => onUpdatePageDesign({ customWidthMm: Number(e.target.value) || 210 })}
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Height (mm)</label>
                  <input
                    type="number"
                    min={100}
                    max={600}
                    value={pageDesign.customHeightMm}
                    onChange={(e) => onUpdatePageDesign({ customHeightMm: Number(e.target.value) || 297 })}
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono-tabular"
                  />
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-medium mb-1">Page Margins (mm)</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {[
                  { label: 'Narrow (8mm)', val: 8 },
                  { label: 'Standard (12mm)', val: 12 },
                  { label: 'Wide (20mm)', val: 20 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() =>
                      onUpdatePageDesign({
                        marginTopMm: preset.val,
                        marginRightMm: preset.val,
                        marginBottomMm: preset.val,
                        marginLeftMm: preset.val,
                      })
                    }
                    className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    ['marginTopMm', 'Top'],
                    ['marginRightMm', 'Right'],
                    ['marginBottomMm', 'Bottom'],
                    ['marginLeftMm', 'Left'],
                  ] as const
                ).map(([k, lbl]) => (
                  <div key={k}>
                    <span className="block text-[10px] text-slate-500">{lbl}</span>
                    <input
                      type="number"
                      min={4}
                      max={40}
                      value={pageDesign[k]}
                      onChange={(e) => onUpdatePageDesign({ [k]: Number(e.target.value) || 10 })}
                      className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-1 font-mono-tabular"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Inner Padding (px)</label>
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={pageDesign.contentPaddingPx}
                  onChange={(e) => onUpdatePageDesign({ contentPaddingPx: Number(e.target.value) })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Column Gap (px)</label>
                <input
                  type="number"
                  min={4}
                  max={32}
                  value={pageDesign.columnGapPx}
                  onChange={(e) => onUpdatePageDesign({ columnGapPx: Number(e.target.value) })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1">Document Font Family</label>
              <select
                value={pageDesign.fontFamily}
                onChange={(e) => onUpdatePageDesign({ fontFamily: e.target.value })}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5"
              >
                {fontOptions.map((f) => (
                  <option key={f.label} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Base Font Size (px)</label>
                <input
                  type="number"
                  min={9}
                  max={18}
                  value={pageDesign.fontSizePx}
                  onChange={(e) => onUpdatePageDesign({ fontSizePx: Number(e.target.value) || 12 })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Line Spacing</label>
                <input
                  type="number"
                  step="0.05"
                  min={1.1}
                  max={2.4}
                  value={pageDesign.lineHeight}
                  onChange={(e) => onUpdatePageDesign({ lineHeight: Number(e.target.value) || 1.5 })}
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Brand Accent</label>
                <input
                  type="color"
                  value={pageDesign.accentColor}
                  onChange={(e) => onUpdatePageDesign({ accentColor: e.target.value })}
                  className="w-full h-7 rounded border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Page Background</label>
                <input
                  type="color"
                  value={pageDesign.backgroundColor}
                  onChange={(e) => onUpdatePageDesign({ backgroundColor: e.target.value })}
                  className="w-full h-7 rounded border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <label className="flex items-center justify-between cursor-pointer">
                <span>Outer Page Border Frame</span>
                <input
                  type="checkbox"
                  checked={pageDesign.borderEnabled}
                  onChange={(e) => onUpdatePageDesign({ borderEnabled: e.target.checked })}
                />
              </label>
              {pageDesign.borderEnabled && (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={pageDesign.borderColor || DEFAULT_REPORT_PAGE_DESIGN.borderColor}
                    onChange={(e) => onUpdatePageDesign({ borderColor: e.target.value })}
                    className="w-10 h-6 rounded border"
                  />
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={pageDesign.borderWidthPx || 1}
                    onChange={(e) => onUpdatePageDesign({ borderWidthPx: Number(e.target.value) || 1 })}
                    className="w-20 rounded border border-slate-200 dark:border-slate-700 px-2 py-0.5 font-mono-tabular"
                  />
                </div>
              )}
              <label className="flex items-center justify-between cursor-pointer">
                <span>Running Header on All Pages</span>
                <input
                  type="checkbox"
                  checked={pageDesign.showHeaderOnPages !== false}
                  onChange={(e) => onUpdatePageDesign({ showHeaderOnPages: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Running Footer on All Pages</span>
                <input
                  type="checkbox"
                  checked={pageDesign.showFooterOnPages !== false}
                  onChange={(e) => onUpdatePageDesign({ showFooterOnPages: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Running Page Numbers (Page X of Y)</span>
                <input
                  type="checkbox"
                  checked={pageDesign.showPageNumbers}
                  onChange={(e) => onUpdatePageDesign({ showPageNumbers: e.target.checked })}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
