import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CloudUpload,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FilePlus2,
  FileSpreadsheet,
  FolderOpen,
  HardDrive,
  History,
  LayoutGrid,
  Lock,
  Mail,
  Plus,
  Printer,
  Redo2,
  Save,
  Search,
  Share2,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { uploadUserFileToStorage } from '../../engine/cloudStorage';
import { useApp } from '../../context/AppContext';
import {
  EmailHistoryRecord,
  GeneratedReport,
  ReportBlock,
  ReportElementType,
  ReportPageDesign,
  ReportPayload,
  ReportTemplate,
  UserReportTemplate,
} from '../../types';
import {
  buildDefaultBlocksFromTemplate,
  buildReportExcelWorkbook,
  createReportBlock,
  DEFAULT_REPORT_PAGE_DESIGN,
  downloadReportCsv,
  getPageDimensionsMm,
  hasReportTableData,
  makeBlockId,
  paginateReportBlocks,
  renderPagesToPdf,
  REPORT_ELEMENT_CATALOG,
} from '../../engine/reportDesignerUtils';
import { ReportBlockCanvasItem } from './ReportBlockCanvasItem';
import { ReportPropertyInspector } from './ReportPropertyInspector';
import { EmailAttachmentBundle, EmailHistoryPanel, ReportEmailModal } from './ReportEmailModal';

type MainTab = 'designer' | 'templates' | 'history' | 'emails';
type MobilePane = 'elements' | 'canvas' | 'inspector';

const GROUP_LABELS: Record<string, { en: string; bn: string }> = {
  brand: { en: 'Brand & Headers', bn: 'ব্র্যান্ড ও হেডার' },
  meta: { en: 'Document Meta & QR', bn: 'ডকুমেন্ট মেটা ও কিউআর' },
  content: { en: 'Content, Tables & Media', bn: 'টেবিল, চার্ট ও ছবি' },
  engineering: { en: 'Calculation & Analysis', bn: 'হিসাব ও বিশ্লেষণ' },
  signoff: { en: 'Sign-off & Footer', bn: 'স্বাক্ষর ও ফুটার' },
};

export const ReportGeneratorView: React.FC = () => {
  const {
    user,
    profile,
    isAdmin,
    language,
    reportTemplates,
    userReportTemplates,
    reportSections,
    reports,
    emailHistory,
    reportSettings,
    pendingReportDraft,
    setPendingReportDraft,
    saveGeneratedReport,
    updateGeneratedReport,
    deleteGeneratedReport,
    saveUserReportTemplate,
    deleteUserReportTemplate,
    deleteReportSection,
    getUserStorageQuotaBytes,
    getTotalStorageUsedBytes,
    recomputeUserStorageUsage,
    logUserExport,
    showToast,
  } = useApp();

  const [tab, setTab] = useState<MainTab>('designer');
  const [mobilePane, setMobilePane] = useState<MobilePane>('canvas');

  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(
    reportTemplates[0]?.id || 'tpl-engineering-a4-portrait'
  );
  const [reportNumber, setReportNumber] = useState(
    `SS-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`
  );
  const [reportTitle, setReportTitle] = useState(
    'Three-Phase Electrical Load & Technical Verification Report'
  );
  const [reportCategory, setReportCategory] = useState('engineering');

  const [pageDesign, setPageDesign] = useState<ReportPageDesign>(() => ({
    ...DEFAULT_REPORT_PAGE_DESIGN,
    accentColor: reportSettings.defaultAccentColor || '#1d4ed8',
    fontFamily: reportSettings.defaultFontFamily || DEFAULT_REPORT_PAGE_DESIGN.fontFamily,
  }));

  const [blocks, setBlocks] = useState<ReportBlock[]>(() => {
    const initial = buildDefaultBlocksFromTemplate(reportTemplates[0], language, reportSettings, {
      companyName: reportSettings.defaultCompanyName,
      reportNumber: `SS-${new Date().getFullYear()}-1001`,
      title: 'Three-Phase Electrical Load & Technical Verification Report',
      userName: profile?.displayName || user?.displayName || 'Lead Engineer',
      userEmail: user?.email || '',
    });
    return initial.blocks;
  });

  const [undoStack, setUndoStack] = useState<Array<{ blocks: ReportBlock[]; pageDesign: ReportPageDesign }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ blocks: ReportBlock[]; pageDesign: ReportPageDesign }>>([]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [zoomPercent, setZoomPercent] = useState<number>(85);
  const [elementSearch, setElementSearch] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');

  const [exportingPdf, setExportingPdf] = useState(false);
  const [archivingPdf, setArchivingPdf] = useState(false);
  const [savingTplModal, setSavingTplModal] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplCategory, setNewTplCategory] = useState('engineering');
  const [editingUserTplId, setEditingUserTplId] = useState<string | null>(null);
  const [renamingTplId, setRenamingTplId] = useState<string | null>(null);
  const [renameTplText, setRenameTplText] = useState('');

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [retryEmailEntry, setRetryEmailEntry] = useState<EmailHistoryRecord | null>(null);

  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const canvasScrollRef = useRef<HTMLElement | null>(null);
  const [canvasContainerWidth, setCanvasContainerWidth] = useState<number>(0);
  const draggedPaletteTypeRef = useRef<ReportElementType | null>(null);
  const draggedBlockIdRef = useRef<string | null>(null);
  const draggedSavedSectionRef = useRef<ReportBlock | null>(null);

  useEffect(() => {
    const el = canvasScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateWidth = () => setCanvasContainerWidth(el.clientWidth);
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab, mobilePane, isPreviewMode]);

  const allowCustomTemplates = isAdmin || reportSettings.allowUserCustomTemplates !== false;
  const allowEmailDispatch = isAdmin || reportSettings.allowEmailDispatch !== false;
  const allowExcelExport = isAdmin || reportSettings.allowExcelExport !== false;
  const disabledSet = useMemo(
    () => new Set(isAdmin ? [] : reportSettings.disabledElementTypes || []),
    [isAdmin, reportSettings.disabledElementTypes]
  );

  const commitState = useCallback(
    (nextBlocks: ReportBlock[], nextDesign?: ReportPageDesign) => {
      setUndoStack((prev) => [
        ...prev.slice(-34),
        {
          blocks: JSON.parse(JSON.stringify(blocks)) as ReportBlock[],
          pageDesign: { ...pageDesign },
        },
      ]);
      setRedoStack([]);
      setBlocks(nextBlocks);
      if (nextDesign) setPageDesign(nextDesign);
    },
    [blocks, pageDesign]
  );

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, { blocks: JSON.parse(JSON.stringify(blocks)), pageDesign: { ...pageDesign } }]);
    setUndoStack((u) => u.slice(0, -1));
    setBlocks(prev.blocks);
    setPageDesign(prev.pageDesign);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, { blocks: JSON.parse(JSON.stringify(blocks)), pageDesign: { ...pageDesign } }]);
    setRedoStack((r) => r.slice(0, -1));
    setBlocks(next.blocks);
    setPageDesign(next.pageDesign);
  };

  // Ingest incoming data draft from Calculators, History, or AI PDF Analyzer
  useEffect(() => {
    if (!pendingReportDraft) return;
    const draft = pendingReportDraft;
    const freshNum = `SS-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    setReportNumber(freshNum);
    setReportTitle(draft.title);
    setActiveReportId(null);

    const defaults = {
      companyName: reportSettings.defaultCompanyName,
      reportNumber: freshNum,
      title: draft.title,
      userName: profile?.displayName || user?.displayName || 'Lead Engineer',
      userEmail: user?.email || '',
      accentColor: pageDesign.accentColor,
    };

    const nextBlocks: ReportBlock[] = [];
    const logo = createReportBlock('company-logo', language, defaults);
    logo.widthPercent = 25;
    const comp = createReportBlock('company-name', language, defaults);
    comp.widthPercent = 50;
    const rnum = createReportBlock('report-number', language, defaults);
    rnum.widthPercent = 25;
    const titleBlk = createReportBlock('report-title', language, defaults);
    const dtBlk = createReportBlock('date-time', language, defaults);
    dtBlk.widthPercent = 50;
    const usrBlk = createReportBlock('user-info', language, defaults);
    usrBlk.widthPercent = 50;
    nextBlocks.push(logo, comp, rnum, titleBlk, dtBlk, usrBlk);

    if (draft.inputsList && draft.inputsList.length > 0) {
      const inpBlk = createReportBlock('calc-inputs', language, defaults);
      inpBlk.widthPercent = 50;
      inpBlk.content.fields = draft.inputsList;
      nextBlocks.push(inpBlk);
    }

    if (draft.outputsList && draft.outputsList.length > 0) {
      const resBlk = createReportBlock('calc-results', language, defaults);
      resBlk.widthPercent = draft.inputsList?.length ? 50 : 100;
      resBlk.content.fields = draft.outputsList;
      resBlk.content.warnings = draft.warnings || [];
      nextBlocks.push(resBlk);
    }

    if (draft.formulaDisplay) {
      const fBlk = createReportBlock('calc-formula', language, defaults);
      fBlk.content.formulaExpression = draft.formulaDisplay;
      fBlk.content.formulaSteps = draft.stepsText || '';
      fBlk.content.formulaReference = draft.formulaReference || '';
      nextBlocks.push(fBlk);
    }

    if (draft.tables && draft.tables.length > 0) {
      for (const tbl of draft.tables) {
        const tBlk = createReportBlock('table', language, defaults);
        tBlk.content.text = tbl.title;
        tBlk.content.tableHeaders = tbl.headers;
        tBlk.content.tableRows = tbl.rows;
        nextBlocks.push(tBlk);
      }
    } else if (draft.rows && draft.rows.length > 0) {
      const tBlk = createReportBlock('table', language, defaults);
      tBlk.content.text = language === 'bn' ? 'হিসাব ও প্যারামিটার সারণি' : 'Parameter & Output Schedule';
      tBlk.content.tableHeaders = ['#', 'Parameter', 'Value', 'Unit', 'Notes'];
      tBlk.content.tableRows = draft.rows.map((r, i) => [
        String(i + 1),
        r.label,
        r.value,
        r.unit || '-',
        r.notes || '-',
      ]);
      nextBlocks.push(tBlk);
    }

    if (draft.chartData && draft.chartData.length > 0) {
      const cBlk = createReportBlock('chart', language, defaults);
      cBlk.content.chartSeries = draft.chartData;
      nextBlocks.push(cBlk);
    }

    if (draft.remarks) {
      const remBlk = createReportBlock('remarks', language, defaults);
      remBlk.content.text = draft.remarks;
      nextBlocks.push(remBlk);
    }

    const prep = createReportBlock('prepared-by', language, defaults);
    prep.widthPercent = 50;
    const appr = createReportBlock('approved-by', language, defaults);
    appr.widthPercent = 50;
    const footer = createReportBlock('footer', language, defaults);
    footer.content.text = reportSettings.defaultFooterText || footer.content.text;
    const pg = createReportBlock('page-number', language, defaults);
    nextBlocks.push(prep, appr, footer, pg);

    setBlocks(nextBlocks);
    setSelectedBlockId(null);
    setPendingReportDraft(null);
    setTab('designer');
  }, [pendingReportDraft, setPendingReportDraft, language, pageDesign.accentColor, profile?.displayName, reportSettings, user?.displayName, user?.email]);

  const applyAdminTemplate = (tpl: ReportTemplate) => {
    const built = buildDefaultBlocksFromTemplate(tpl, language, reportSettings, {
      companyName: reportSettings.defaultCompanyName,
      reportNumber,
      title: reportTitle,
      userName: profile?.displayName || user?.displayName || 'Lead Engineer',
      userEmail: user?.email || '',
    });
    commitState(built.blocks, built.pageDesign);
    setActiveTemplateId(tpl.id);
    setEditingUserTplId(null);
    setSelectedBlockId(null);
    setTab('designer');
    showToast(`Applied template: ${language === 'bn' ? tpl.nameBn : tpl.nameEn}`, 'success');
  };

  const applyUserTemplate = (utpl: UserReportTemplate) => {
    const clonedBlocks = JSON.parse(JSON.stringify(utpl.blocks)) as ReportBlock[];
    commitState(clonedBlocks, { ...DEFAULT_REPORT_PAGE_DESIGN, ...utpl.pageDesign });
    setActiveTemplateId(utpl.id);
    setEditingUserTplId(utpl.id);
    setSelectedBlockId(null);
    setTab('designer');
    showToast(`Loaded personal template: ${utpl.nameEn}`, 'success');
  };

  const handleDuplicateAdminTemplateToPersonal = async (tpl: ReportTemplate) => {
    if (!user) {
      showToast(language === 'bn' ? 'সংরক্ষণ করতে সাইন ইন করুন।' : 'Sign in to duplicate templates.', 'info');
      return;
    }
    const built = buildDefaultBlocksFromTemplate(tpl, language, reportSettings, {
      companyName: reportSettings.defaultCompanyName,
      reportNumber,
      title: reportTitle,
      userName: profile?.displayName || user?.displayName || 'Lead Engineer',
      userEmail: user?.email || '',
    });
    await saveUserReportTemplate({
      nameEn: `${tpl.nameEn} (My Copy)`,
      nameBn: `${tpl.nameBn} (ব্যক্তিগত কপি)`,
      category: tpl.category || 'custom',
      description: tpl.descriptionEn || '',
      sourceTemplateId: tpl.id,
      orientation: built.pageDesign.orientation,
      headerText: tpl.headerText || '',
      footerText: tpl.footerText || '',
      accentColor: built.pageDesign.accentColor,
      pageDesign: built.pageDesign,
      blocks: built.blocks,
      sharedWithLink: false,
    });
  };

  const handleCreateBlankReport = () => {
    const freshNum = `SS-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    setReportNumber(freshNum);
    setReportTitle(language === 'bn' ? 'নতুন কাস্টম প্রতিবেদন' : 'Untitled Custom Engineering Report');
    setActiveReportId(null);
    setEditingUserTplId(null);
    const titleBlk = createReportBlock('report-title', language, {
      title: language === 'bn' ? 'নতুন কাস্টম প্রতিবেদন' : 'Untitled Custom Engineering Report',
      reportNumber: freshNum,
    });
    const pgBlk = createReportBlock('page-number', language, { reportNumber: freshNum });
    commitState([titleBlk, pgBlk], { ...DEFAULT_REPORT_PAGE_DESIGN });
    setSelectedBlockId(titleBlk.id);
    setTab('designer');
  };

  const addElementToCanvas = (type: ReportElementType, insertIndex?: number) => {
    if (disabledSet.has(type)) return;
    const newBlock = createReportBlock(type, language, {
      companyName: reportSettings.defaultCompanyName,
      reportNumber,
      title: reportTitle,
      userName: profile?.displayName || user?.displayName || 'Lead Engineer',
      userEmail: user?.email || '',
      accentColor: pageDesign.accentColor,
    });
    const next = [...blocks];
    if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= next.length) {
      next.splice(insertIndex, 0, newBlock);
    } else if (selectedBlockId) {
      const selIdx = next.findIndex((b) => b.id === selectedBlockId);
      if (selIdx >= 0) next.splice(selIdx + 1, 0, newBlock);
      else next.push(newBlock);
    } else {
      next.push(newBlock);
    }
    commitState(next);
    setSelectedBlockId(newBlock.id);
  };

  const insertSavedSection = (templateBlock: ReportBlock, insertIndex?: number) => {
    const cloned = JSON.parse(JSON.stringify(templateBlock)) as ReportBlock;
    cloned.id = makeBlockId('blk');
    const next = [...blocks];
    if (typeof insertIndex === 'number') next.splice(insertIndex, 0, cloned);
    else next.push(cloned);
    commitState(next);
    setSelectedBlockId(cloned.id);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [removed] = next.splice(idx, 1);
    next.splice(target, 0, removed);
    commitState(next);
  };

  const reorderBlockTo = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const cleanTargetId = targetId.split('_part_')[0];
    const srcIdx = blocks.findIndex((b) => b.id === sourceId);
    const dstIdx = blocks.findIndex((b) => b.id === cleanTargetId);
    if (srcIdx < 0 || dstIdx < 0) return;
    const next = [...blocks];
    const [removed] = next.splice(srcIdx, 1);
    next.splice(dstIdx, 0, removed);
    commitState(next);
  };

  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const copy = JSON.parse(JSON.stringify(blocks[idx])) as ReportBlock;
    copy.id = makeBlockId('blk');
    copy.label = `${copy.label} (Copy)`;
    const next = [...blocks];
    next.splice(idx + 1, 0, copy);
    commitState(next);
    setSelectedBlockId(copy.id);
  };

  const deleteBlock = (id: string) => {
    const cleanId = id.split('_part_')[0];
    commitState(blocks.filter((b) => b.id !== cleanId));
    if (selectedBlockId === cleanId) setSelectedBlockId(null);
  };

  const updateBlock = (updated: ReportBlock) => {
    const cleanId = updated.id.split('_part_')[0];
    const next = blocks.map((b) => (b.id === cleanId ? { ...updated, id: cleanId } : b));
    setBlocks(next);
    if (updated.type === 'report-title' && updated.content.text) {
      setReportTitle(updated.content.text);
    }
    if (updated.type === 'report-number' && updated.content.text) {
      setReportNumber(updated.content.text);
    }
  };

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedBlockId) || null,
    [blocks, selectedBlockId]
  );

  const paginatedPages = useMemo(
    () => paginateReportBlocks(blocks, pageDesign),
    [blocks, pageDesign]
  );

  const { widthMm, heightMm } = useMemo(() => getPageDimensionsMm(pageDesign), [pageDesign]);
  const pageWidthPx = Math.round((widthMm * 96) / 25.4);
  const pageHeightPx = Math.round((heightMm * 96) / 25.4);

  const buildPayloadSnapshot = (): ReportPayload => {
    const tableBlk = blocks.find((b) => b.visible && b.type === 'table');
    const chartBlk = blocks.find((b) => b.visible && b.type === 'chart');
    const remarksBlk = blocks.find((b) => b.visible && (b.type === 'remarks' || b.type === 'conclusion'));
    const logoBlk = blocks.find((b) => b.type === 'company-logo');
    const prepBlk = blocks.find((b) => b.type === 'prepared-by' || b.type === 'signature');
    const apprBlk = blocks.find((b) => b.type === 'approved-by');
    return {
      reportDate: new Date().toISOString().slice(0, 16).replace('T', ' '),
      authorName: profile?.displayName || user?.displayName || 'Engineer',
      authorEmail: user?.email || '',
      logoDataUrl: (logoBlk?.content.imageDataUrl || '').slice(0, 120000),
      customValues: {},
      rows: (tableBlk?.content.tableRows || []).slice(0, 40).map((r) => ({
        label: r[1] || r[0] || 'Item',
        value: r[2] || r[1] || '-',
        unit: r[3] || '-',
        notes: r[4] || '',
      })),
      chartData: chartBlk?.content.chartSeries || [],
      remarks: remarksBlk?.content.text || '',
      preparedBy: prepBlk?.content.signerName || profile?.displayName || 'Engineer',
      approvedBy: apprBlk?.content.signerName || '',
    };
  };

  const handleSaveReportToCloud = async (): Promise<string | null> => {
    if (!user) {
      showToast(language === 'bn' ? 'রিপোর্ট সংরক্ষণ করতে সাইন ইন করুন।' : 'Sign in to save reports.', 'info');
      return null;
    }
    const companyBlk = blocks.find((b) => b.type === 'company-name');
    const payload = buildPayloadSnapshot();
    const safeBlocks = blocks.map((b) => ({
      ...b,
      content: {
        ...b.content,
        imageDataUrl: b.content.imageDataUrl ? b.content.imageDataUrl.slice(0, 180000) : '',
        signatureDataUrl: b.content.signatureDataUrl ? b.content.signatureDataUrl.slice(0, 120000) : '',
      },
    }));
    if (activeReportId) {
      await updateGeneratedReport(activeReportId, {
        title: reportTitle,
        companyName: companyBlk?.content.text || reportSettings.defaultCompanyName || '',
        projectName: '',
        category: reportCategory,
        orientation: pageDesign.orientation,
        payload,
        pageDesign,
        blocks: safeBlocks,
      });
      return activeReportId;
    } else {
      const id = await saveGeneratedReport({
        templateId: activeTemplateId,
        reportNumber,
        title: reportTitle,
        companyName: companyBlk?.content.text || reportSettings.defaultCompanyName || '',
        projectName: '',
        category: reportCategory,
        orientation: pageDesign.orientation,
        payload,
        pageDesign,
        blocks: safeBlocks,
      });
      if (id) setActiveReportId(id);
      return id || null;
    }
  };

  const archiveReportPdfToStorage = async (targetReportId?: string) => {
    if (!user) {
      showToast(language === 'bn' ? 'ক্লাউড স্টোরেজে (R2) পিডিএফ সেভ করতে সাইন ইন করুন।' : 'Sign in to save PDF to Cloud Storage (R2).', 'info');
      return;
    }
    const printableBlocks = blocks.filter((b) => b.visible && b.type !== 'page-break');
    if (printableBlocks.length === 0) {
      showToast(
        language === 'bn'
          ? 'স্টোরেজে সেভ করার আগে অন্তত একটি এলিমেন্ট দৃশ্যমান করুন।'
          : 'Add or enable at least one element before saving PDF.',
        'error'
      );
      return;
    }

    setArchivingPdf(true);
    const prevPreview = isPreviewMode;
    setIsPreviewMode(true);
    setSelectedBlockId(null);
    try {
      const repId = targetReportId || activeReportId || (await handleSaveReportToCloud());
      if (!repId) return;

      await new Promise((r) => setTimeout(r, 150));
      const elems = pageRefs.current.slice(0, paginatedPages.length).filter((e): e is HTMLDivElement => Boolean(e));
      if (elems.length === 0) throw new Error('No printable pages found');
      const { pdf, filename } = await renderPagesToPdf(elems, pageDesign, `${reportNumber}_${reportTitle.slice(0, 26)}`);
      const blob = pdf.output('blob');

      const quotaBytes = getUserStorageQuotaBytes();
      const currentUsed = getTotalStorageUsedBytes();
      const previousRepSize = reports.find((r) => r.id === repId)?.pdfFileSizeBytes || 0;
      if (!isAdmin && currentUsed - previousRepSize + blob.size > quotaBytes) {
        showToast(
          language === 'bn'
            ? 'আপনার ক্লাউড স্টোরেজ কোটা পূর্ণ হয়েছে। প্রোফাইল বা লাইব্রেরি থেকে পুরনো ফাইল মুছুন।'
            : 'Cloud Storage quota exceeded. Free up space or ask admin for a higher quota.',
          'error'
        );
        return;
      }

      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
      const sPath = `users/${user.uid}/reports/${repId}/${safeFilename}`;
      const uploaded = await uploadUserFileToStorage(blob, sPath, 'application/pdf');
      const downloadUrl = uploaded.downloadUrl;

      await updateGeneratedReport(repId, {
        pdfStoragePath: sPath,
        pdfDownloadUrl: downloadUrl,
        pdfFileSizeBytes: blob.size,
      });
      await logUserExport({
        module: 'report',
        title: reportTitle,
        format: 'pdf',
        storagePath: sPath,
        downloadUrl,
        fileSizeBytes: blob.size,
      });
      const existingRep = reports.find((r) => r.id === repId);
      const nextReports = [
        ...reports.filter((r) => r.id !== repId),
        {
          ...(existingRep || {
            id: repId,
            userId: user.uid,
            templateId: activeTemplateId,
            reportNumber,
            title: reportTitle,
            orientation: pageDesign.orientation,
            payload: buildPayloadSnapshot(),
          }),
          pdfStoragePath: sPath,
          pdfDownloadUrl: downloadUrl,
          pdfFileSizeBytes: blob.size,
        } as GeneratedReport,
      ];
      await recomputeUserStorageUsage({ reportsList: nextReports });
      showToast(
        language === 'bn'
          ? 'রিপোর্ট পিডিএফ ক্লাউড স্টোরেজে (R2) সংরক্ষিত হয়েছে।'
          : 'Report PDF saved to Cloud Storage.',
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to upload report PDF to Cloud Storage.',
        'error'
      );
    } finally {
      setIsPreviewMode(prevPreview);
      setArchivingPdf(false);
    }
  };

  const loadSavedReport = (rep: GeneratedReport) => {
    setActiveReportId(rep.id);
    setActiveTemplateId(rep.templateId);
    setReportNumber(rep.reportNumber);
    setReportTitle(rep.title);
    setReportCategory(rep.category || 'engineering');
    if (rep.pageDesign) {
      setPageDesign({ ...DEFAULT_REPORT_PAGE_DESIGN, ...rep.pageDesign });
    }
    if (rep.blocks && rep.blocks.length > 0) {
      setBlocks(JSON.parse(JSON.stringify(rep.blocks)) as ReportBlock[]);
    } else {
      const tpl = reportTemplates.find((t) => t.id === rep.templateId) || reportTemplates[0];
      const built = buildDefaultBlocksFromTemplate(tpl, language, reportSettings, {
        companyName: rep.companyName,
        reportNumber: rep.reportNumber,
        title: rep.title,
        userName: rep.payload.preparedBy,
        userEmail: rep.payload.authorEmail,
      });
      setBlocks(built.blocks);
      setPageDesign({ ...built.pageDesign, orientation: rep.orientation });
    }
    setSelectedBlockId(null);
    setTab('designer');
  };

  const hasTableData = useMemo(() => hasReportTableData(blocks), [blocks]);

  const handlePrintReport = async () => {
    const printableBlocks = blocks.filter((b) => b.visible && b.type !== 'page-break');
    if (printableBlocks.length === 0) {
      showToast(
        language === 'bn'
          ? 'প্রিন্ট করার আগে অন্তত একটি রিপোর্ট এলিমেন্ট যুক্ত বা দৃশ্যমান করুন।'
          : 'Add or enable at least one report element before printing.',
        'error'
      );
      return;
    }
    setTab('designer');
    setMobilePane('canvas');
    setIsPreviewMode(true);
    setSelectedBlockId(null);

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // ignore font loading wait errors
      }
    }

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 140)))
    );

    if (typeof window.print === 'function') {
      window.print();
    } else {
      showToast(
        language === 'bn'
          ? 'এই ব্রাউজারে সরাসরি প্রিন্ট সমর্থিত নয় — PDF ডাউনলোড ব্যবহার করুন।'
          : 'Print dialog unavailable in this browser — use Download PDF instead.',
        'info'
      );
    }
  };

  const handleExportPdf = async () => {
    const printableBlocks = blocks.filter((b) => b.visible && b.type !== 'page-break');
    if (printableBlocks.length === 0) {
      showToast(
        language === 'bn'
          ? 'PDF ডাউনলোডের আগে অন্তত একটি এলিমেন্ট দৃশ্যমান করুন।'
          : 'Add or enable at least one element before exporting PDF.',
        'error'
      );
      return;
    }
    setExportingPdf(true);
    const prevPreview = isPreviewMode;
    setIsPreviewMode(true);
    setSelectedBlockId(null);
    try {
      await new Promise((r) => setTimeout(r, 150));
      const elems = pageRefs.current.slice(0, paginatedPages.length).filter((e): e is HTMLDivElement => Boolean(e));
      if (elems.length === 0) throw new Error('No printable pages found');
      const { pdf, filename } = await renderPagesToPdf(elems, pageDesign, `${reportNumber}_${reportTitle.slice(0, 26)}`);
      pdf.save(filename);
      if (user) {
        void logUserExport({ module: 'report', title: reportTitle, format: 'pdf' });
      }
      showToast(language === 'bn' ? 'মাল্টি-পেজ পিডিএফ ডাউনলোড সম্পন্ন।' : 'PDF exported successfully.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'PDF export failed', 'error');
    } finally {
      setIsPreviewMode(prevPreview);
      setExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    const { workbook, filename } = buildReportExcelWorkbook(reportTitle, reportNumber, blocks);
    XLSX.writeFile(workbook, filename);
    showToast(language === 'bn' ? 'এক্সেল (.xlsx) ডাউনলোড হয়েছে।' : 'Excel (.xlsx) downloaded.', 'success');
  };

  const buildEmailAttachments = async (opts: {
    includePdf: boolean;
    includeExcel: boolean;
  }): Promise<EmailAttachmentBundle> => {
    const bundle: EmailAttachmentBundle = {};
    if (opts.includePdf) {
      const prevPreview = isPreviewMode;
      setIsPreviewMode(true);
      setSelectedBlockId(null);
      await new Promise((r) => setTimeout(r, 140));
      const elems = pageRefs.current.slice(0, paginatedPages.length).filter((e): e is HTMLDivElement => Boolean(e));
      if (elems.length > 0) {
        const res = await renderPagesToPdf(elems, pageDesign, `${reportNumber}_${reportTitle.slice(0, 24)}`);
        bundle.pdfAttachment = { filename: res.filename, base64: res.base64 };
      }
      setIsPreviewMode(prevPreview);
    }
    if (opts.includeExcel) {
      const xl = buildReportExcelWorkbook(reportTitle, reportNumber, blocks);
      bundle.excelAttachment = { filename: xl.filename, base64: xl.base64 };
    }
    return bundle;
  };

  const handleSavePersonalTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTplName.trim()) return;
    const savedId = await saveUserReportTemplate({
      id: editingUserTplId || undefined,
      nameEn: newTplName.trim(),
      nameBn: newTplName.trim(),
      category: newTplCategory,
      description: `Custom layout (${blocks.length} elements, ${pageDesign.pageSize.toUpperCase()} ${pageDesign.orientation})`,
      sourceTemplateId: activeTemplateId,
      orientation: pageDesign.orientation,
      accentColor: pageDesign.accentColor,
      pageDesign,
      blocks,
      sharedWithLink: false,
    });
    if (savedId) setEditingUserTplId(savedId);
    setSavingTplModal(false);
    setNewTplName('');
  };

  const handleExportTemplateJson = (utpl: UserReportTemplate) => {
    const blob = new Blob([JSON.stringify(utpl, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${utpl.nameEn.replace(/[^a-zA-Z0-9_-]+/g, '_')}_template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTemplateJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}')) as Partial<UserReportTemplate>;
        if (!Array.isArray(parsed.blocks) || !parsed.pageDesign) {
          throw new Error('Invalid Sutro Sathi report template JSON');
        }
        await saveUserReportTemplate({
          nameEn: parsed.nameEn || file.name.replace(/\.json$/i, ''),
          nameBn: parsed.nameBn || parsed.nameEn || file.name,
          category: parsed.category || 'imported',
          description: parsed.description || 'Imported custom template',
          orientation: parsed.orientation === 'landscape' ? 'landscape' : 'portrait',
          accentColor: parsed.accentColor || '#1d4ed8',
          pageDesign: { ...DEFAULT_REPORT_PAGE_DESIGN, ...parsed.pageDesign },
          blocks: parsed.blocks,
          sharedWithLink: false,
        });
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to import template JSON', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredElements = useMemo(() => {
    const q = elementSearch.trim().toLowerCase();
    return REPORT_ELEMENT_CATALOG.filter((el) => {
      if (disabledSet.has(el.type)) return false;
      if (!q) return true;
      return (
        el.labelEn.toLowerCase().includes(q) ||
        el.labelBn.toLowerCase().includes(q) ||
        el.type.toLowerCase().includes(q)
      );
    });
  }, [elementSearch, disabledSet]);

  const filteredAdminTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return reportTemplates.filter((t) => {
      if (templateCategoryFilter !== 'all' && (t.category || 'engineering') !== templateCategoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        t.nameEn.toLowerCase().includes(q) ||
        t.nameBn.toLowerCase().includes(q) ||
        (t.descriptionEn || '').toLowerCase().includes(q)
      );
    });
  }, [reportTemplates, templateSearch, templateCategoryFilter]);

  const filteredUserTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return userReportTemplates.filter((t) => {
      if (templateCategoryFilter !== 'all' && t.category !== templateCategoryFilter) {
        return false;
      }
      if (!q) return true;
      return t.nameEn.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
    });
  }, [userReportTemplates, templateSearch, templateCategoryFilter]);

  const printPageSizeCss = useMemo(() => {
    if (pageDesign.pageSize === 'a4') return `A4 ${pageDesign.orientation}`;
    if (pageDesign.pageSize === 'letter') return `letter ${pageDesign.orientation}`;
    if (pageDesign.pageSize === 'legal') return `legal ${pageDesign.orientation}`;
    return `${widthMm}mm ${heightMm}mm`;
  }, [pageDesign.pageSize, pageDesign.orientation, widthMm, heightMm]);

  const effectiveScale = useMemo(() => {
    const userZoom = zoomPercent / 100;
    if (canvasContainerWidth > 40 && canvasContainerWidth - 28 < pageWidthPx * userZoom) {
      return Math.max(0.32, (canvasContainerWidth - 28) / pageWidthPx);
    }
    return userZoom;
  }, [zoomPercent, canvasContainerWidth, pageWidthPx]);

  return (
    <div className="report-studio-root space-y-4">
      <style id="engihub-report-print-page-style">{`
        @media print {
          @page {
            size: ${printPageSizeCss};
            margin: 0;
          }
          .report-page-sheet {
            width: ${widthMm}mm !important;
            min-height: ${Math.max(50, heightMm - 1)}mm !important;
          }
        }
      `}</style>
      {/* Header & Top Navigation Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {language === 'bn' ? 'স্মার্ট রিপোর্ট ডিজাইনার ও ইমেইল সিস্টেম' : 'Smart Report Designer & Email Studio'}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {language === 'bn'
              ? 'ড্র্যাগ-অ্যান্ড-ড্রপ কাস্টম রিপোর্ট তৈরি, বাংলা/ইংরেজি মাল্টি-পেজ পিডিএফ, এক্সেল এবং সরাসরি ইমেইল পাঠান।'
              : 'Visual drag-and-drop report studio with 30+ components, custom pages, dynamic calculation binding, PDF/Excel export, and Gmail dispatch.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
          {(
            [
              { id: 'designer', label: language === 'bn' ? 'ডিজাইনার' : 'Designer', icon: FilePlus2 },
              {
                id: 'templates',
                label: language === 'bn' ? `টেমপ্লেট (${reportTemplates.length + userReportTemplates.length})` : `Templates (${reportTemplates.length + userReportTemplates.length})`,
                icon: LayoutGrid,
              },
              {
                id: 'history',
                label: language === 'bn' ? `রিপোর্ট (${reports.length})` : `Saved Reports (${reports.length})`,
                icon: History,
              },
              {
                id: 'emails',
                label: language === 'bn' ? `ইমেইল (${emailHistory.length})` : `Email History (${emailHistory.length})`,
                icon: Mail,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  tab === item.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: 3-COLUMN DRAG-AND-DROP STUDIO */}
      {/* =================================================================== */}
      {tab === 'designer' && (
        <div className="space-y-3">
          {/* Studio Action Toolbar */}
          <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={reportNumber}
                onChange={(e) => setReportNumber(e.target.value)}
                aria-label="Report Number"
                className="w-32 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono-tabular font-semibold"
              />
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                aria-label="Report Title"
                className="w-56 sm:w-72 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-medium"
              />
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-35 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Undo"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-35 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Redo"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <select
                value={zoomPercent}
                onChange={(e) => setZoomPercent(Number(e.target.value))}
                aria-label="Canvas Zoom"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs font-mono-tabular"
              >
                <option value={65}>65%</option>
                <option value={75}>75%</option>
                <option value={85}>85%</option>
                <option value={100}>100%</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setIsPreviewMode((v) => !v);
                  setSelectedBlockId(null);
                  setMobilePane('canvas');
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 min-h-[36px] text-xs font-medium cursor-pointer ${
                  isPreviewMode
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isPreviewMode ? (language === 'bn' ? 'প্রিভিউ বন্ধ' : 'Exit Preview') : (language === 'bn' ? 'প্রিভিউ' : 'Preview')}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {allowCustomTemplates && (
                <button
                  type="button"
                  onClick={() => {
                    setNewTplName(editingUserTplId ? reportTitle : `${reportTitle.slice(0, 32)} Template`);
                    setSavingTplModal(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 min-h-[36px] text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>{language === 'bn' ? 'টেমপ্লেট সেভ' : 'Save Template'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveReportToCloud}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 min-h-[36px] text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-blue-600" />
                <span>{activeReportId ? (language === 'bn' ? 'আপডেট' : 'Update') : (language === 'bn' ? 'সেভ' : 'Save Report')}</span>
              </button>
              <button
                type="button"
                onClick={() => archiveReportPdfToStorage()}
                disabled={archivingPdf}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 px-2.5 py-1.5 min-h-[36px] text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-60 cursor-pointer"
                title={language === 'bn' ? 'Cloud Storage (R2)-এ PDF সংরক্ষণ করুন' : 'Archive rendered PDF to Cloud Storage (R2)'}
              >
                <CloudUpload className="w-3.5 h-3.5" />
                <span>
                  {archivingPdf
                    ? language === 'bn'
                      ? 'আপলোড হচ্ছে...'
                      : 'Archiving...'
                    : language === 'bn'
                      ? 'স্টোরেজে PDF'
                      : 'Save PDF to Storage'}
                </span>
              </button>
              <button
                type="button"
                onClick={handlePrintReport}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 min-h-[36px] text-xs font-medium cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'প্রিন্ট রিপোর্ট' : 'Print Report'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 min-h-[36px] text-xs font-medium disabled:opacity-60 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportingPdf ? (language === 'bn' ? 'তৈরি হচ্ছে...' : 'Rendering...') : (language === 'bn' ? 'PDF ডাউনলোড' : 'Download PDF')}</span>
              </button>
              {allowExcelExport && hasTableData && (
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 min-h-[36px] text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{language === 'bn' ? 'Excel ডাউনলোড' : 'Download Excel'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => downloadReportCsv(reportTitle, reportNumber, blocks)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 min-h-[36px] text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span>CSV</span>
              </button>
              {allowEmailDispatch && (
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      showToast(language === 'bn' ? 'ইমেইল পাঠাতে সাইন ইন করুন।' : 'Sign in to email reports.', 'info');
                      return;
                    }
                    setRetryEmailEntry(null);
                    setEmailModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 min-h-[36px] text-xs font-medium cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'ইমেইল রিপোর্ট' : 'Email Report'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Dedicated Print & Export Preview Bar */}
          {isPreviewMode && (
            <div className="no-print rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-blue-900 dark:text-blue-200">
                  {language === 'bn'
                    ? `প্রিন্ট প্রিভিউ (${paginatedPages.length} পৃষ্ঠা · ${pageDesign.pageSize.toUpperCase()})`
                    : `Print Preview (${paginatedPages.length} page${paginatedPages.length > 1 ? 's' : ''} · ${pageDesign.pageSize.toUpperCase()})`}
                </span>
                <div className="inline-flex items-center p-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPageDesign((p) => ({ ...p, orientation: 'portrait' }))}
                    className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer ${
                      pageDesign.orientation === 'portrait'
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {language === 'bn' ? 'Portrait' : 'A4 Portrait'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageDesign((p) => ({ ...p, orientation: 'landscape' }))}
                    className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer ${
                      pageDesign.orientation === 'landscape'
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {language === 'bn' ? 'Landscape' : 'A4 Landscape'}
                  </button>
                </div>
                <select
                  value={pageDesign.marginTopMm}
                  onChange={(e) => {
                    const m = Number(e.target.value) || 12;
                    setPageDesign((p) => ({
                      ...p,
                      marginTopMm: m,
                      marginRightMm: m,
                      marginBottomMm: m,
                      marginLeftMm: m,
                    }));
                  }}
                  aria-label="Page Margin"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px]"
                >
                  <option value={8}>Margin: 8mm</option>
                  <option value={12}>Margin: 12mm</option>
                  <option value={16}>Margin: 16mm</option>
                  <option value={20}>Margin: 20mm</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-medium cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'প্রিন্ট করুন' : 'Print Report'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-60 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingPdf ? '...' : language === 'bn' ? 'PDF' : 'Download PDF'}</span>
                </button>
                {allowExcelExport && hasTableData && (
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Excel</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsPreviewMode(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                >
                  {language === 'bn' ? 'এডিটরে ফিরুন' : 'Back to Editor'}
                </button>
              </div>
            </div>
          )}

          {/* Responsive Mobile/Tablet Pane Switcher */}
          {!isPreviewMode && (
            <div className="xl:hidden no-print grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium">
              <button
                type="button"
                onClick={() => setMobilePane('elements')}
                className={`py-2 rounded-lg cursor-pointer ${
                  mobilePane === 'elements' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                + Elements
              </button>
              <button
                type="button"
                onClick={() => setMobilePane('canvas')}
                className={`py-2 rounded-lg cursor-pointer ${
                  mobilePane === 'canvas' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                Canvas ({paginatedPages.length}p)
              </button>
              <button
                type="button"
                onClick={() => setMobilePane('inspector')}
                className={`py-2 rounded-lg cursor-pointer ${
                  mobilePane === 'inspector' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                Properties
              </button>
            </div>
          )}

          {/* 3-Column Studio Workspace */}
          <div className="report-workspace-grid grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* LEFT SIDEBAR: Report Elements Palette & Saved Sections */}
            <aside
              className={`xl:col-span-3 no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-3 xl:max-h-[820px] xl:overflow-y-auto ${
                !isPreviewMode && mobilePane === 'elements'
                  ? 'block'
                  : isPreviewMode
                    ? 'hidden'
                    : 'hidden xl:block'
              }`}
            >
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={elementSearch}
                  onChange={(e) => setElementSearch(e.target.value)}
                  placeholder={language === 'bn' ? 'এলিমেন্ট খুঁজুন...' : 'Search 30+ report elements...'}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-2.5 py-1.5 text-xs"
                />
              </div>

              {(['brand', 'meta', 'content', 'engineering', 'signoff'] as const).map((grp) => {
                const items = filteredElements.filter((el) => el.group === grp);
                if (items.length === 0) return null;
                return (
                  <div key={grp} className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      {language === 'bn' ? GROUP_LABELS[grp].bn : GROUP_LABELS[grp].en}
                    </p>
                    <div className="grid grid-cols-2 xl:grid-cols-1 gap-1.5">
                      {items.map((el) => (
                        <button
                          key={el.type}
                          type="button"
                          draggable
                          onDragStart={() => {
                            draggedPaletteTypeRef.current = el.type;
                            draggedBlockIdRef.current = null;
                            draggedSavedSectionRef.current = null;
                          }}
                          onClick={() => {
                            addElementToCanvas(el.type);
                            setMobilePane('canvas');
                          }}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 px-2.5 py-1.5 text-left text-xs transition-colors cursor-grab active:cursor-grabbing"
                        >
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {language === 'bn' ? el.labelBn : el.labelEn}
                          </span>
                          <Plus className="w-3 h-3 text-blue-600 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {reportSections.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    Saved Personal Sections ({reportSections.length})
                  </p>
                  <div className="space-y-1">
                    {reportSections.map((sec) => (
                      <div
                        key={sec.id}
                        draggable
                        onDragStart={() => {
                          draggedSavedSectionRef.current = sec.blockData;
                          draggedPaletteTypeRef.current = null;
                          draggedBlockIdRef.current = null;
                        }}
                        className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs bg-slate-50/50 dark:bg-slate-950"
                      >
                        <button
                          type="button"
                          onClick={() => insertSavedSection(sec.blockData)}
                          className="text-left font-medium truncate flex-1 hover:text-blue-700 cursor-pointer"
                        >
                          + {sec.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteReportSection(sec.id)}
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>

            {/* CENTER CANVAS: Multi-Page Live A4 / Custom Document */}
            <main
              ref={canvasScrollRef}
              className={`report-canvas-scroll ${
                isPreviewMode ? 'xl:col-span-12' : 'xl:col-span-6'
              } bg-slate-100/80 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 overflow-auto xl:max-h-[820px] ${
                isPreviewMode || mobilePane === 'canvas' ? 'block' : 'hidden xl:block'
              }`}
              onClick={() => setSelectedBlockId(null)}
            >
              <div className="report-pages-stack flex flex-col items-center gap-6">
                {paginatedPages.map((pageBlocks, pageIdx) => {
                  const scaleFactor = effectiveScale;
                  return (
                    <div
                      key={pageIdx}
                      style={{
                        width: `${Math.round(pageWidthPx * scaleFactor)}px`,
                        minHeight: `${Math.round(pageHeightPx * scaleFactor)}px`,
                      }}
                      className="report-page-wrapper relative"
                    >
                      <div
                        ref={(el) => {
                          pageRefs.current[pageIdx] = el;
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedPaletteTypeRef.current) {
                            addElementToCanvas(draggedPaletteTypeRef.current);
                            draggedPaletteTypeRef.current = null;
                          } else if (draggedSavedSectionRef.current) {
                            insertSavedSection(draggedSavedSectionRef.current);
                            draggedSavedSectionRef.current = null;
                          }
                        }}
                        className="print-only-area report-page-sheet bg-white shadow-md origin-top-left flex flex-col justify-between"
                        style={{
                          width: `${pageWidthPx}px`,
                          minHeight: `${pageHeightPx}px`,
                          transform: `scale(${scaleFactor})`,
                          paddingTop: `${pageDesign.marginTopMm}mm`,
                          paddingRight: `${pageDesign.marginRightMm}mm`,
                          paddingBottom: `${pageDesign.marginBottomMm}mm`,
                          paddingLeft: `${pageDesign.marginLeftMm}mm`,
                          backgroundColor: pageDesign.backgroundColor || '#ffffff',
                          color: pageDesign.fontColor || '#0f172a',
                          fontFamily: pageDesign.fontFamily,
                          border: pageDesign.borderEnabled
                            ? `${pageDesign.borderWidthPx || 1}px solid ${pageDesign.borderColor || '#cbd5e1'}`
                            : '1px solid #e2e8f0',
                        }}
                      >
                        <div className="flex-1 flex flex-col">
                          {pageDesign.showHeaderOnPages !== false && (
                            <div
                              className="px-3 py-1.5 mb-2 border-b border-slate-200 flex items-center justify-between gap-2 text-[10px]"
                              style={{
                                backgroundColor: pageDesign.headerStyleBg || '#f8fafc',
                                borderBottomColor: pageDesign.accentColor || '#cbd5e1',
                              }}
                            >
                              <span className="font-semibold truncate" style={{ color: pageDesign.accentColor }}>
                                {reportTitle}
                              </span>
                              <span className="font-mono-tabular text-slate-500 shrink-0">
                                {reportNumber}
                              </span>
                            </div>
                          )}

                          <div
                            className="grid grid-cols-12 items-start content-start flex-1"
                            style={{
                              gap: `${pageDesign.columnGapPx || 12}px`,
                              padding: `${pageDesign.contentPaddingPx || 12}px`,
                            }}
                          >
                            {pageBlocks.length === 0 ? (
                              <div className="col-span-12 py-24 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                Drag or click elements from the Left Sidebar to build your custom report.
                              </div>
                            ) : (
                              pageBlocks.map((blk) => {
                                const rawId = blk.id.split('_part_')[0];
                                return (
                                  <ReportBlockCanvasItem
                                    key={blk.id}
                                    block={blk}
                                    pageDesign={pageDesign}
                                    pageNumber={pageIdx + 1}
                                    totalPages={paginatedPages.length}
                                    isSelected={selectedBlockId === rawId}
                                    isPreviewMode={isPreviewMode}
                                    onSelect={() => {
                                      setSelectedBlockId(rawId);
                                      setMobilePane('inspector');
                                    }}
                                    onMoveUp={() => moveBlock(rawId, -1)}
                                    onMoveDown={() => moveBlock(rawId, 1)}
                                    onDuplicate={() => duplicateBlock(rawId)}
                                    onToggleVisible={() =>
                                      commitState(
                                        blocks.map((b) =>
                                          b.id === rawId ? { ...b, visible: !b.visible } : b
                                        )
                                      )
                                    }
                                    onDelete={() => deleteBlock(rawId)}
                                    onDragStartBlock={() => {
                                      draggedBlockIdRef.current = rawId;
                                      draggedPaletteTypeRef.current = null;
                                      draggedSavedSectionRef.current = null;
                                    }}
                                    onDropOnBlock={(e) => {
                                      e.stopPropagation();
                                      const targetIdx = blocks.findIndex((b) => b.id === rawId);
                                      if (draggedPaletteTypeRef.current) {
                                        addElementToCanvas(
                                          draggedPaletteTypeRef.current,
                                          targetIdx >= 0 ? targetIdx : undefined
                                        );
                                        draggedPaletteTypeRef.current = null;
                                      } else if (draggedSavedSectionRef.current) {
                                        insertSavedSection(
                                          draggedSavedSectionRef.current,
                                          targetIdx >= 0 ? targetIdx : undefined
                                        );
                                        draggedSavedSectionRef.current = null;
                                      } else if (draggedBlockIdRef.current) {
                                        reorderBlockTo(draggedBlockIdRef.current, rawId);
                                        draggedBlockIdRef.current = null;
                                      }
                                    }}
                                  />
                                );
                              })
                            )}
                          </div>
                        </div>

                        {(pageDesign.showFooterOnPages !== false || pageDesign.showPageNumbers) && (
                          <div
                            className="px-3 py-2 border-t border-slate-200 flex items-center justify-between gap-2 text-[10px] text-slate-500 font-mono-tabular"
                            style={{ backgroundColor: pageDesign.footerStyleBg || '#ffffff' }}
                          >
                            <span className="truncate">
                              {pageDesign.showFooterOnPages !== false
                                ? `${reportSettings.defaultCompanyName || 'EngiHub'} · ${reportNumber}`
                                : reportNumber}
                            </span>
                            {pageDesign.showPageNumbers && (
                              <span className="shrink-0">
                                {language === 'bn'
                                  ? `পৃষ্ঠা ${pageIdx + 1} / ${paginatedPages.length}`
                                  : `Page ${pageIdx + 1} of ${paginatedPages.length}`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hidden/Disabled blocks manager bar if user hid any blocks */}
              {!isPreviewMode && blocks.some((b) => !b.visible || b.type === 'page-break') && (
                <div className="no-print mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-semibold text-slate-500">Hidden / Page-Break Blocks:</span>
                  {blocks
                    .filter((b) => !b.visible || b.type === 'page-break')
                    .map((hb) => (
                      <div
                        key={hb.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1"
                      >
                        <span>{hb.label}</span>
                        {!hb.visible && (
                          <button
                            type="button"
                            onClick={() =>
                              commitState(blocks.map((b) => (b.id === hb.id ? { ...b, visible: true } : b)))
                            }
                            className="text-blue-600 hover:underline cursor-pointer"
                          >
                            Show
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteBlock(hb.id)}
                          className="text-red-500 hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </main>

            {/* RIGHT SIDEBAR: Properties & Page Design Inspector */}
            <aside
              className={`xl:col-span-3 no-print xl:max-h-[820px] ${
                !isPreviewMode && mobilePane === 'inspector'
                  ? 'block'
                  : isPreviewMode
                    ? 'hidden'
                    : 'hidden xl:block'
              }`}
            >
              <ReportPropertyInspector
                selectedBlock={selectedBlock}
                pageDesign={pageDesign}
                onUpdateBlock={updateBlock}
                onUpdatePageDesign={(patch) => setPageDesign((prev) => ({ ...prev, ...patch }))}
                onResetPageDesign={() =>
                  setPageDesign({
                    ...DEFAULT_REPORT_PAGE_DESIGN,
                    accentColor: reportSettings.defaultAccentColor || '#1d4ed8',
                    fontFamily: reportSettings.defaultFontFamily || DEFAULT_REPORT_PAGE_DESIGN.fontFamily,
                  })
                }
              />
            </aside>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: TEMPLATES LIBRARY (ADMIN + PERSONAL USER TEMPLATES) */}
      {/* =================================================================== */}
      {tab === 'templates' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search templates by name, discipline, or layout..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs"
                />
              </div>
              <select
                value={templateCategoryFilter}
                onChange={(e) => setTemplateCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              >
                <option value="all">All Categories</option>
                <option value="engineering">Engineering</option>
                <option value="electrical">Electrical</option>
                <option value="mechanical">Mechanical</option>
                <option value="civil">Civil &amp; BOQ</option>
                <option value="audit">Inspection &amp; Audit</option>
                <option value="custom">Custom / Imported</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCreateBlankReport}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-1.5 text-xs font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create From Scratch</span>
              </button>
              {allowCustomTemplates && user && (
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Import JSON</span>
                  <input type="file" accept=".json,application/json" onChange={handleImportTemplateJson} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Personal User Templates */}
          {allowCustomTemplates && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'bn'
                  ? `আমার ব্যক্তিগত টেমপ্লেট (${filteredUserTemplates.length})`
                  : `My Personal Report Templates (${filteredUserTemplates.length})`}
              </h2>
              {filteredUserTemplates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
                  No personal templates yet. Customize any layout in Designer and click "Save Template", or duplicate an Admin template below.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUserTemplates.map((ut) => (
                    <div
                      key={ut.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        {renamingTplId === ut.id ? (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!renameTplText.trim()) return;
                              await saveUserReportTemplate({ ...ut, nameEn: renameTplText.trim() });
                              setRenamingTplId(null);
                            }}
                            className="flex gap-1.5"
                          >
                            <input
                              type="text"
                              value={renameTplText}
                              onChange={(e) => setRenameTplText(e.target.value)}
                              className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                              autoFocus
                            />
                            <button type="submit" className="px-2 py-1 rounded bg-blue-700 text-white text-xs">
                              Save
                            </button>
                          </form>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{ut.nameEn}</p>
                            <span className="text-[10px] font-mono-tabular px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                              {ut.orientation}
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {ut.description || `${ut.blocks.length} elements · ${ut.category}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <button
                          type="button"
                          onClick={() => applyUserTemplate(ut)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-700 text-white px-3 py-1 text-[11px] font-medium cursor-pointer"
                        >
                          <FolderOpen className="w-3 h-3" />
                          <span>Use</span>
                        </button>
                        <div className="flex items-center gap-2 text-slate-500">
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingTplId(ut.id);
                              setRenameTplText(ut.nameEn);
                            }}
                            title="Rename"
                            className="hover:text-blue-700 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => saveUserReportTemplate({ ...ut, sharedWithLink: !ut.sharedWithLink })}
                            title="Toggle Link Sharing"
                            className={`cursor-pointer ${ut.sharedWithLink ? 'text-blue-600' : ''}`}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportTemplateJson(ut)}
                            title="Export Template JSON"
                            className="hover:text-blue-700 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteUserReportTemplate(ut.id)}
                            title="Delete"
                            className="hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Admin Default Templates */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'bn'
                ? `অফিশিয়াল ও অ্যাডমিন টেমপ্লেট (${filteredAdminTemplates.length})`
                : `Official Platform Templates (${filteredAdminTemplates.length})`}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAdminTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {language === 'bn' ? tpl.nameBn : tpl.nameEn}
                      </p>
                      <span
                        className="w-3 h-3 rounded-full shrink-0 mt-1"
                        style={{ backgroundColor: tpl.accentColor || '#1d4ed8' }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {(language === 'bn' ? tpl.descriptionBn : tpl.descriptionEn) || tpl.headerText}
                    </p>
                    <div className="flex flex-wrap gap-2 text-[10px] font-medium text-slate-500">
                      <span className="uppercase">{tpl.orientation}</span>
                      {tpl.recommended && <span className="text-blue-700 dark:text-blue-400">★ Recommended</span>}
                      {tpl.lockedByAdmin && (
                        <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
                          <Lock className="w-2.5 h-2.5" /> Protected
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => applyAdminTemplate(tpl)}
                      className="flex-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white py-1.5 text-xs font-medium cursor-pointer"
                    >
                      Use Template
                    </button>
                    {allowCustomTemplates && (
                      <button
                        type="button"
                        onClick={() => handleDuplicateAdminTemplateToPersonal(tpl)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        title="Create your own independent copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Duplicate</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: SAVED REPORTS LIBRARY */}
      {/* =================================================================== */}
      {tab === 'history' && (() => {
        const usedBytes = getTotalStorageUsedBytes();
        const quotaBytes = getUserStorageQuotaBytes();
        const availableBytes = Math.max(0, quotaBytes - usedBytes);
        const pct = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
        const storedPdfCount = reports.filter((r) => Boolean(r.pdfDownloadUrl)).length;

        return (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            {/* Cloud Storage (R2) Usage Bar */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                  <HardDrive className="w-4 h-4 text-blue-600" />
                  <span>{language === 'bn' ? 'ক্লাউড রিপোর্ট ও ফাইল স্টোরেজ (R2)' : 'Cloud Storage (R2) Quota'}</span>
                  <span className="text-[11px] font-mono text-slate-500">
                    ({storedPdfCount} {language === 'bn' ? 'সংরক্ষিত PDF' : 'archived PDFs'})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tabular text-slate-600 dark:text-slate-400">
                  <span>
                    {language === 'bn' ? 'ব্যবহৃত:' : 'Used:'} {(usedBytes / 1024 / 1024).toFixed(2)} MB /{' '}
                    {(quotaBytes / 1024 / 1024).toFixed(0)} MB ({pct}%)
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {language === 'bn' ? 'বাকি:' : 'Remaining:'} {(availableBytes / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    pct >= 95 ? 'bg-red-600' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {reports.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                {language === 'bn' ? 'এখনো কোনো রিপোর্ট সংরক্ষিত হয়নি।' : 'No saved reports yet.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2.5 pr-4 font-semibold">Report No.</th>
                      <th className="py-2.5 pr-4 font-semibold">Title</th>
                      <th className="py-2.5 pr-4 font-semibold">Company</th>
                      <th className="py-2.5 pr-4 font-semibold">Layout</th>
                      <th className="py-2.5 pr-4 font-semibold">Stored PDF</th>
                      <th className="py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {reports.map((r) => (
                      <tr key={r.id}>
                        <td className="py-3 pr-4 font-mono-tabular font-medium">{r.reportNumber}</td>
                        <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{r.title}</td>
                        <td className="py-3 pr-4 text-slate-500">{r.companyName || '-'}</td>
                        <td className="py-3 pr-4 capitalize">{r.orientation}</td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {r.pdfDownloadUrl ? (
                            <a
                              href={r.pdfDownloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-medium hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>
                                PDF
                                {r.pdfFileSizeBytes
                                  ? ` (${(r.pdfFileSizeBytes / 1024).toFixed(0)} KB)`
                                  : ''}
                              </span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {language === 'bn' ? 'শুধু মেটাডেটা' : 'Layout only'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right space-x-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => loadSavedReport(r)}
                            className="text-blue-700 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                          >
                            Open in Designer
                          </button>
                          {allowEmailDispatch && (
                            <button
                              type="button"
                              onClick={() => {
                                loadSavedReport(r);
                                setTimeout(() => {
                                  setRetryEmailEntry(null);
                                  setEmailModalOpen(true);
                                }, 150);
                              }}
                              className="text-emerald-700 dark:text-emerald-400 font-medium hover:underline cursor-pointer"
                            >
                              Email
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteGeneratedReport(r.id)}
                            className="text-red-600 font-medium hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* =================================================================== */}
      {/* TAB 4: EMAIL DISPATCH HISTORY */}
      {/* =================================================================== */}
      {tab === 'emails' && (
        <EmailHistoryPanel
          onRetryEmail={(entry) => {
            setRetryEmailEntry(entry);
            setEmailModalOpen(true);
          }}
        />
      )}

      {/* Save Personal Template Modal */}
      {savingTplModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleSavePersonalTemplateSubmit}
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 text-xs shadow-xl"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingUserTplId ? 'Update Personal Template' : 'Save Layout as Personal Template'}
              </h3>
            </div>
            <div>
              <label className="block font-medium mb-1">Template Name *</label>
              <input
                type="text"
                required
                value={newTplName}
                onChange={(e) => setNewTplName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Category</label>
              <select
                value={newTplCategory}
                onChange={(e) => setNewTplCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              >
                <option value="engineering">Engineering</option>
                <option value="electrical">Electrical</option>
                <option value="mechanical">Mechanical</option>
                <option value="civil">Civil &amp; BOQ</option>
                <option value="audit">Inspection &amp; Audit</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSavingTplModal(false)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 text-white px-4 py-1.5 font-medium cursor-pointer"
              >
                Save Template
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Email Dispatch Modal */}
      <ReportEmailModal
        open={emailModalOpen}
        onClose={() => {
          setEmailModalOpen(false);
          setRetryEmailEntry(null);
        }}
        reportId={activeReportId || undefined}
        reportNumber={reportNumber}
        reportTitle={reportTitle}
        defaultMessageSummary={`Dear Recipient,\n\nPlease find attached the engineering report "${reportTitle}" (Ref: ${reportNumber}) prepared with SUTRO SATHI.\n\nBest regards,\n${profile?.displayName || user?.displayName || 'Engineering Team'}`}
        buildAttachments={buildEmailAttachments}
        retryEntry={retryEmailEntry}
      />
    </div>
  );
};
