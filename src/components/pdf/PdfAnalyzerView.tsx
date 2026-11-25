import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { apiUrl } from '../../engine/apiClient';
import {
  AlertTriangle,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileDiff,
  FileScan,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderPlus,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Link2,
  Lock,
  MessageSquareText,
  Plus,
  Printer,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Table2,
  Trash2,
  Type as TypeIcon,
  Upload,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { makeSafeId, useApp } from '../../context/AppContext';
import { uploadUserFileToStorage } from '../../engine/cloudStorage';
import {
  compressImageForAnalyzer,
  parseOfficeOrTextDocument,
} from '../../engine/documentParser';
import {
  PdfDocumentRecord,
  PdfExtractedFormula,
  PdfExtractedNumber,
  PdfExtractedSpec,
  PdfExtractedTable,
  PdfKeyFinding,
  PdfPageRecord,
  PdfWarningItem,
} from '../../types';
import {
  exportDocumentToJson,
  exportPdfIntelligenceToExcel,
  exportTablesToCsv,
  parsePdfFileLocally,
} from '../../engine/pdfProcessor';
import {
  PdfCalculatorBridgePanel,
  PdfChatPanel,
  PdfComparePanel,
} from './PdfChatComparePanels';

type WorkspaceTab = 'overview' | 'tables' | 'calc-bridge' | 'chat' | 'compare';
type InputSourceMode = 'pdf' | 'text' | 'url' | 'multi_url' | 'document' | 'image';
type AnalysisMode = 'standard' | 'research' | 'engineering';

const SOURCE_BADGE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  text: 'TEXT',
  url: 'URL',
  multi_url: 'MULTI-URL',
  document: 'DOC',
  image: 'IMG',
};

const CATEGORY_OPTIONS = [
  { id: 'general', labelEn: 'General Document', labelBn: 'সাধারণ ডকুমেন্ট' },
  { id: 'electrical', labelEn: 'Electrical (SLD / Cable / Load / Panel / Transformer)', labelBn: 'ইলেকট্রিক্যাল (এসএলডি / ক্যাবল / লোড / ট্রান্সফরমার)' },
  { id: 'mechanical', labelEn: 'Mechanical (Manuals / Pump / Motor / Datasheet)', labelBn: 'মেকানিক্যাল (ম্যানুয়াল / পাম্প / মোটর / ডেটাশিট)' },
  { id: 'civil', labelEn: 'Civil (BOQ / Structural / Material / Report)', labelBn: 'সিভিল (বিওকিউ / স্ট্রাকচারাল / ম্যাটেরিয়াল)' },
  { id: 'drawing', labelEn: 'Engineering Drawing / Schematic', labelBn: 'ইঞ্জিনিয়ারিং ড্রয়িং / স্কিম্যাটিক' },
  { id: 'invoice_boq', labelEn: 'Invoice, Bill & BOQ Schedule', labelBn: 'ইনভয়েস, বিল ও বিওকিউ' },
  { id: 'manual', labelEn: 'Technical Manual & Standard', labelBn: 'টেকনিক্যাল ম্যানুয়াল' },
  { id: 'report', labelEn: 'Inspection & Test Report', labelBn: 'পরিদর্শন ও টেস্ট রিপোর্ট' },
];

export const PdfAnalyzerView: React.FC = () => {
  const {
    user,
    profile,
    isAdmin,
    language,
    appSettings,
    pdfDocuments,
    pdfFolders,
    history,
    todayAiUsage,
    renamePdfDocument,
    togglePdfSharing,
    updatePdfExtractedTables,
    deletePdfDocument,
    incrementAiUsage,
    getUserStorageQuotaBytes,
    getTotalStorageUsedBytes,
    savePdfFolder,
    deletePdfFolder,
    movePdfToFolder,
    recomputeUserStorageUsage,
    setPendingReportDraft,
    navigateTo,
    signInWithGoogle,
    showToast,
  } = useApp();

  const storageCfg = appSettings.storageConfig;
  const pdfUploadAllowedByAdmin = storageCfg?.pdfUploadEnabled !== false;

  const aiCfg = appSettings.aiPdfConfig || {
    enabled: true,
    maxFileSizeMb: 25,
    maxPagesPerFile: 50,
    dailyUserAnalysisLimit: 25,
    allowOcrAndVision: true,
    allowDocComparison: true,
    allowCalculatorBridge: true,
    allowSharing: true,
    stripPiiBeforeAi: true,
    allowedCategories: CATEGORY_OPTIONS.map((c) => c.id),
    allowedRoles: ['user', 'engineer', 'admin'],
    preferredModel: 'gemini-4-hydrogen' as const,
    reasoningLevel: 'MEDIUM' as const,
    aiProvider: 'gemini' as const,
    allowWebsiteUrls: true,
    allowMultiUrlAnalysis: true,
    allowResearchMode: true,
    allowDocumentUpload: true,
    allowImageInput: true,
    enableEngineeringMode: true,
  };

  const effectiveMaxFileMb = Math.min(
    aiCfg.maxFileSizeMb || 25,
    storageCfg?.maxFileSizeMb || aiCfg.maxFileSizeMb || 25
  );

  const storageStats = useMemo(() => {
    const usedBytes = getTotalStorageUsedBytes();
    const totalPages = pdfDocuments.reduce((acc, d) => acc + (d.pageCount || 0), 0);
    const quotaBytes = getUserStorageQuotaBytes(profile);
    const pct = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
    return {
      usedBytes,
      totalFiles: pdfDocuments.length,
      totalPages,
      quotaBytes,
      availableBytes: Math.max(0, quotaBytes - usedBytes),
      pct,
    };
  }, [getTotalStorageUsedBytes, getUserStorageQuotaBytes, pdfDocuments, profile]);

  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [inputMode, setInputMode] = useState<InputSourceMode>('pdf');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('standard');
  const [analyzerStatus, setAnalyzerStatus] = useState<{
    storageProvider?: string;
    r2Configured?: boolean;
  }>({});
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [sharedDocOverride, setSharedDocOverride] = useState<PdfDocumentRecord | null>(null);
  const [sharedDocInput, setSharedDocInput] = useState('');

  const [uploadCategory, setUploadCategory] = useState<string>('electrical');
  const [uploadSpecialty, setUploadSpecialty] = useState<'general' | 'electrical' | 'mechanical' | 'civil'>('electrical');
  const [uploadFolderId, setUploadFolderId] = useState<string>('');
  const [uploadingQueue, setUploadingQueue] = useState<
    Array<{ id: string; fileName: string; progress: number; stage: string; error?: string }>
  >([]);
  const [dragOver, setDragOver] = useState(false);

  // Additional input source states
  const [textInputTitle, setTextInputTitle] = useState('');
  const [textInputBody, setTextInputBody] = useState('');
  const [singleUrlInput, setSingleUrlInput] = useState('');
  const [multiUrlInput, setMultiUrlInput] = useState('');
  const [submittingSource, setSubmittingSource] = useState(false);
  const [urlWarnings, setUrlWarnings] = useState<string[]>([]);

  const [libSearch, setLibSearch] = useState('');
  const [libCatFilter, setLibCatFilter] = useState('all');
  const [libFolderFilter, setLibFolderFilter] = useState<string>('all');
  const [libSort, setLibSort] = useState<'newest' | 'oldest' | 'name' | 'size' | 'pages'>('newest');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [pagesByDocId, setPagesByDocId] = useState<Record<string, PdfPageRecord[]>>({});
  const [loadingPages, setLoadingPages] = useState(false);
  const [activePageNum, setActivePageNum] = useState(1);

  const [editingTables, setEditingTables] = useState<PdfExtractedTable[]>([]);
  const [tablesDirty, setTablesDirty] = useState(false);
  const [reportLangChoice, setReportLangChoice] = useState<'en' | 'bn'>(language);
  const [includeRecentCalcInReport, setIncludeRecentCalcInReport] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const overviewPrintRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/analyzer/status'))
      .then((r) => r.json())
      .then((d: { storageProvider?: string; r2Configured?: boolean }) => setAnalyzerStatus(d))
      .catch(() => {});
  }, []);

  const activeDoc = useMemo(() => {
    if (sharedDocOverride && sharedDocOverride.id === selectedDocId) return sharedDocOverride;
    return pdfDocuments.find((d) => d.id === selectedDocId) || pdfDocuments[0] || null;
  }, [pdfDocuments, selectedDocId, sharedDocOverride]);

  useEffect(() => {
    if (activeDoc) {
      setEditingTables(activeDoc.extractedTables || []);
      setTablesDirty(false);
    } else {
      setEditingTables([]);
      setTablesDirty(false);
    }
  }, [activeDoc]);

  const ensurePagesLoaded = useCallback(
    async (docId: string): Promise<PdfPageRecord[]> => {
      if (pagesByDocId[docId] && pagesByDocId[docId].length > 0) {
        return pagesByDocId[docId];
      }
      if (!user) return [];
      setLoadingPages(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, 'pdfDocuments', docId, 'pages'),
            where('userId', '==', user.uid),
            orderBy('pageNumber', 'asc')
          )
        );
        const list = snap.docs.map((d) => d.data() as PdfPageRecord);
        setPagesByDocId((prev) => ({ ...prev, [docId]: list }));
        return list;
      } catch {
        // Fallback without orderBy index if composite index isn't built yet
        try {
          const snap = await getDocs(
            query(collection(db, 'pdfDocuments', docId, 'pages'), where('userId', '==', user.uid))
          );
          const list = snap.docs
            .map((d) => d.data() as PdfPageRecord)
            .sort((a, b) => a.pageNumber - b.pageNumber);
          setPagesByDocId((prev) => ({ ...prev, [docId]: list }));
          return list;
        } catch (err) {
          console.warn('Could not load PDF pages:', err);
          return [];
        }
      } finally {
        setLoadingPages(false);
      }
    },
    [pagesByDocId, user]
  );

  useEffect(() => {
    if (activeDoc && activeDoc.processingStatus === 'ready') {
      ensurePagesLoaded(activeDoc.id);
    }
  }, [activeDoc, ensurePagesLoaded]);

  const activePages = activeDoc ? pagesByDocId[activeDoc.id] || [] : [];
  const currentPageObj = activePages.find((p) => p.pageNumber === activePageNum) || activePages[0] || null;

  const userRoleAllowed =
    isAdmin || !profile || aiCfg.allowedRoles.includes(profile.role);

  const runChunkedAnalysisAndSave = async (opts: {
    docId: string;
    title: string;
    fileName: string;
    sourceType: InputSourceMode;
    sourceUrl?: string;
    sourceUrls?: string[];
    mimeType?: string;
    storagePath?: string;
    downloadUrl?: string;
    fileSizeBytes: number;
    pageRecords: PdfPageRecord[];
    ocrPagesCount: number;
    updateQueue: (progress: number, stage: string, error?: string) => void;
  }) => {
    const {
      docId,
      title,
      fileName,
      sourceType,
      sourceUrl,
      sourceUrls,
      mimeType,
      storagePath = '',
      downloadUrl = '',
      fileSizeBytes,
      pageRecords,
      ocrPagesCount,
      updateQueue,
    } = opts;

    if (!user) return;

    // Persist page subcollection records in batches of 15
    for (let i = 0; i < pageRecords.length; i += 15) {
      const batch = writeBatch(db);
      for (const pr of pageRecords.slice(i, i + 15)) {
        batch.set(doc(db, 'pdfDocuments', docId, 'pages', pr.id), {
          ...pr,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    setPagesByDocId((prev) => ({ ...prev, [docId]: pageRecords }));

    await updateDoc(doc(db, 'pdfDocuments', docId), {
      storagePath,
      downloadUrl,
      fileSizeBytes,
      pageCount: pageRecords.length,
      ocrPagesCount,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(sourceUrls && sourceUrls.length > 0 ? { sourceUrls } : {}),
      ...(mimeType ? { mimeType } : {}),
      processingStatus: 'analyzing',
      processingProgress: 75,
      updatedAt: serverTimestamp(),
    });

    const mergedFindings: PdfKeyFinding[] = [];
    const mergedNumbers: PdfExtractedNumber[] = [];
    const mergedFormulas: PdfExtractedFormula[] = [];
    const mergedSpecs: PdfExtractedSpec[] = [];
    const mergedTables: PdfExtractedTable[] = [];
    const mergedWarnings: PdfWarningItem[] = [];
    const summariesEn: string[] = [];
    const summariesBn: string[] = [];
    let detectedType = '';

    const CHUNK_SIZE = 8;
    const totalChunks = Math.max(1, Math.ceil(pageRecords.length / CHUNK_SIZE));
    for (let c = 0; c < totalChunks; c++) {
      const chunk = pageRecords.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
      updateQueue(
        75 + Math.round(((c + 1) / totalChunks) * 20),
        language === 'bn'
          ? `তথ্য, টেবিল ও সূত্র বিশ্লেষণ (ধাপ ${c + 1}/${totalChunks})...`
          : `Extracting facts, tables & insights (Chunk ${c + 1}/${totalChunks})...`
      );

      const analyzeResp = await fetch(apiUrl('/api/pdf/analyze-chunk'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          documentCategory: uploadCategory,
          specialty: uploadSpecialty,
          sourceType,
          analysisMode,
          chunkPages: chunk.map((p) => ({
            pageNumber: p.pageNumber,
            text: p.text,
            diagramSummary: p.diagramSummary,
          })),
          totalPages: pageRecords.length,
          language,
          provider: aiCfg.aiProvider || 'gemini',
          model: aiCfg.preferredModel,
          reasoningLevel: aiCfg.reasoningLevel,
          stripPii: aiCfg.stripPiiBeforeAi,
        }),
      });
      const chunkData = await analyzeResp.json();
      if (!analyzeResp.ok) {
        throw new Error(chunkData.error || 'Information intelligence extraction failed');
      }

      if (!detectedType && chunkData.documentType) detectedType = String(chunkData.documentType);
      if (chunkData.summaryEn) summariesEn.push(String(chunkData.summaryEn));
      if (chunkData.summaryBn) summariesBn.push(String(chunkData.summaryBn));

      if (Array.isArray(chunkData.keyFindings)) {
        for (const kf of chunkData.keyFindings) {
          mergedFindings.push({
            text: String(kf.text || ''),
            page: Number(kf.page) || 1,
            type: kf.type === 'interpretation' || kf.type === 'warning' ? kf.type : 'fact',
          });
        }
      }
      if (Array.isArray(chunkData.extractedNumbers)) {
        for (const num of chunkData.extractedNumbers) {
          const parsedVal = Number(num.value);
          if (Number.isFinite(parsedVal)) {
            mergedNumbers.push({
              label: String(num.label || ''),
              value: parsedVal,
              unit: String(num.unit || ''),
              page: Number(num.page) || 1,
              rawText: String(num.rawText || ''),
              calculatorHint: num.calculatorHint ? String(num.calculatorHint) : undefined,
            });
          }
        }
      }
      if (Array.isArray(chunkData.extractedFormulas)) {
        for (const f of chunkData.extractedFormulas) {
          mergedFormulas.push({
            name: String(f.name || ''),
            expression: String(f.expression || ''),
            variables: f.variables ? String(f.variables) : '',
            page: Number(f.page) || 1,
          });
        }
      }
      if (Array.isArray(chunkData.extractedSpecs)) {
        for (const s of chunkData.extractedSpecs) {
          mergedSpecs.push({
            category: String(s.category || 'General'),
            parameter: String(s.parameter || ''),
            value: String(s.value || ''),
            unit: s.unit ? String(s.unit) : '',
            page: Number(s.page) || 1,
            reference: s.reference ? String(s.reference) : '',
          });
        }
      }
      if (Array.isArray(chunkData.extractedTables)) {
        for (const tbl of chunkData.extractedTables) {
          if (Array.isArray(tbl.headers) && tbl.headers.length > 0) {
            mergedTables.push({
              id: makeSafeId('tbl'),
              title: String(tbl.title || 'Extracted Table'),
              page: Number(tbl.page) || 1,
              headers: tbl.headers.map((h: unknown) => String(h ?? '')),
              rows: Array.isArray(tbl.rows)
                ? tbl.rows.slice(0, 45).map((r: unknown[]) =>
                    Array.isArray(r) ? r.map((cell) => String(cell ?? '')) : []
                  )
                : [],
            });
          }
        }
      }
      if (Array.isArray(chunkData.warnings)) {
        for (const w of chunkData.warnings) {
          mergedWarnings.push({
            severity: w.severity === 'error' || w.severity === 'info' ? w.severity : 'warning',
            message: String(w.message || ''),
            page: Number(w.page) || 1,
            source: w.source ? String(w.source) : 'Analyzer Audit',
          });
        }
      }
    }

    await updateDoc(doc(db, 'pdfDocuments', docId), {
      documentType: detectedType.slice(0, 130) || uploadCategory,
      summaryEn: summariesEn.join('\n\n').slice(0, 5800),
      summaryBn: summariesBn.join('\n\n').slice(0, 5800),
      keyFindings: mergedFindings.slice(0, 48),
      extractedNumbers: mergedNumbers.slice(0, 115),
      extractedFormulas: mergedFormulas.slice(0, 38),
      extractedSpecs: mergedSpecs.slice(0, 75),
      extractedTables: mergedTables.slice(0, 18),
      warnings: mergedWarnings.slice(0, 38),
      processingStatus: 'ready',
      processingProgress: 100,
      updatedAt: serverTimestamp(),
    });

    await incrementAiUsage('analysis');
    void recomputeUserStorageUsage();
    updateQueue(100, language === 'bn' ? 'বিশ্লেষণ সম্পন্ন' : 'Completed');
    setTimeout(() => {
      setUploadingQueue((prev) => prev.filter((q) => q.id !== docId));
    }, 2500);
    showToast(
      language === 'bn' ? `"${title}" সফলভাবে বিশ্লেষিত হয়েছে।` : `"${title}" analyzed and indexed.`,
      'success'
    );
  };

  const checkDailyAndQuota = (sizeBytes: number): boolean => {
    if (!user) return false;
    const maxBytes = effectiveMaxFileMb * 1024 * 1024;
    if (sizeBytes > maxBytes) {
      showToast(`Size exceeds admin limit of ${effectiveMaxFileMb} MB.`, 'error');
      return false;
    }
    if (!isAdmin && storageStats.usedBytes + sizeBytes > storageStats.quotaBytes) {
      showToast(
        language === 'bn'
          ? `ব্যক্তিগত স্টোরেজ কোটা (${(storageStats.quotaBytes / 1024 / 1024).toFixed(0)} MB) পূর্ণ হয়েছে।`
          : `Personal storage quota (${(storageStats.quotaBytes / 1024 / 1024).toFixed(0)} MB) exceeded.`,
        'error'
      );
      return false;
    }
    const usedToday = todayAiUsage?.analysisCount || 0;
    if (!isAdmin && usedToday >= (aiCfg.dailyUserAnalysisLimit || 25)) {
      showToast(`Daily analysis limit (${aiCfg.dailyUserAnalysisLimit}) reached.`, 'error');
      return false;
    }
    return true;
  };

  const processSinglePdfFile = async (file: File) => {
    if (!user) return;
    if (!pdfUploadAllowedByAdmin && !isAdmin) {
      showToast(language === 'bn' ? 'ফাইল আপলোড বর্তমানে বন্ধ রয়েছে' : 'File uploads are temporarily disabled by admin.', 'error');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast(`${file.name}: Only PDF files are supported in PDF Upload tab.`, 'error');
      return;
    }
    if (!checkDailyAndQuota(file.size)) return;

    const docId = makeSafeId('pdf');
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const initialTitle = file.name.replace(/\.pdf$/i, '').slice(0, 180) || 'Uploaded Document';

    const updateQueue = (progress: number, stage: string, error?: string) => {
      setUploadingQueue((prev) => {
        const exists = prev.some((q) => q.id === docId);
        if (!exists) return [...prev, { id: docId, fileName: file.name, progress, stage, error }];
        return prev.map((q) => (q.id === docId ? { ...q, progress, stage, error } : q));
      });
    };

    updateQueue(5, language === 'bn' ? 'ফাইল প্রস্তুত করা হচ্ছে...' : 'Preparing PDF...');

    try {
      const initialRecord: PdfDocumentRecord = {
        id: docId,
        userId: user.uid,
        title: initialTitle,
        fileName: cleanFileName.slice(0, 230),
        category: uploadCategory,
        specialty: uploadSpecialty,
        sourceType: 'pdf',
        mimeType: 'application/pdf',
        ...(uploadFolderId ? { folderId: uploadFolderId } : {}),
        fileSizeBytes: file.size,
        pageCount: 0,
        ocrPagesCount: 0,
        processingStatus: 'uploading',
        processingProgress: 10,
        sharedWithLink: false,
      };
      await setDoc(doc(db, 'pdfDocuments', docId), {
        ...initialRecord,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedDocId(docId);

      // 1. Upload original PDF securely to Cloudflare R2 (or local storage fallback)
      let storagePath = '';
      let downloadUrl = '';
      try {
        updateQueue(15, language === 'bn' ? 'ক্লাউড স্টোরেজে (R2) আপলোড হচ্ছে...' : 'Uploading PDF to Cloud Storage (R2)...');
        const sPath = `users/${user.uid}/pdfs/${docId}/${cleanFileName}`;
        const uploaded = await uploadUserFileToStorage(file, sPath, 'application/pdf');
        storagePath = uploaded.storagePath;
        downloadUrl = uploaded.downloadUrl;
      } catch (storageErr) {
        console.warn('Cloud Storage upload skipped/fallback:', storageErr);
      }

      // 2. Parse pages locally using pdf.js
      updateQueue(28, language === 'bn' ? 'পৃষ্ঠা ও টেক্সট বের করা হচ্ছে...' : 'Extracting pages & rendering previews...');
      await updateDoc(doc(db, 'pdfDocuments', docId), {
        storagePath,
        downloadUrl,
        processingStatus: 'extracting',
        processingProgress: 30,
        updatedAt: serverTimestamp(),
      });

      const parsed = await parsePdfFileLocally(file, aiCfg.maxPagesPerFile || 50, (pct, lbl) => {
        updateQueue(25 + Math.round(pct * 0.25), `${language === 'bn' ? 'পৃষ্ঠা বিশ্লেষণ' : 'Parsing'} ${lbl}`);
      });

      const ocrPagesCount = parsed.pages.filter((p) => p.isScanned).length;
      const pageRecords: PdfPageRecord[] = parsed.pages.map((p) => ({
        id: `page-${p.pageNumber}`,
        documentId: docId,
        userId: user.uid,
        pageNumber: p.pageNumber,
        text: p.text,
        isScanned: p.isScanned,
        ocrApplied: false,
        diagramSummary: '',
        thumbnailDataUrl: p.thumbnailDataUrl,
      }));

      if (aiCfg.allowOcrAndVision !== false) {
        const visionCandidates = parsed.pages.filter((p) => Boolean(p.ocrImageBase64));
        for (let i = 0; i < visionCandidates.length; i += 3) {
          const batchPages = visionCandidates.slice(i, i + 3);
          updateQueue(
            52 + Math.round((i / Math.max(1, visionCandidates.length)) * 20),
            language === 'bn'
              ? `এআই ওসিআর ও ড্রয়িং বিশ্লেষণ (${i + 1}-${Math.min(visionCandidates.length, i + 3)})...`
              : `Vision OCR & Drawing Analysis (Pages ${batchPages.map((b) => b.pageNumber).join(', ')})...`
          );

          const ocrResp = await fetch(apiUrl('/api/pdf/ocr-pages'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pages: batchPages.map((b) => ({
                pageNumber: b.pageNumber,
                imageBase64: b.ocrImageBase64,
                mimeType: 'image/jpeg',
                existingText: b.text,
              })),
              specialty: uploadSpecialty,
              language,
              model: aiCfg.preferredModel,
              reasoningLevel: aiCfg.reasoningLevel,
              stripPii: aiCfg.stripPiiBeforeAi,
            }),
          });
          const ocrData = await ocrResp.json();
          if (!ocrResp.ok) {
            throw new Error(ocrData.error || 'OCR analysis failed');
          }
          for (const outPage of ocrData.pages || []) {
            const target = pageRecords.find((pr) => pr.pageNumber === outPage.pageNumber);
            if (target) {
              const combined = target.isScanned
                ? String(outPage.ocrText || '').slice(0, 32000)
                : target.text || String(outPage.ocrText || '').slice(0, 32000);
              target.text = combined;
              target.ocrApplied = true;
              target.diagramSummary = String(outPage.diagramSummary || '').slice(0, 4800);
            }
          }
        }
      }

      await runChunkedAnalysisAndSave({
        docId,
        title: initialTitle,
        fileName: file.name,
        sourceType: 'pdf',
        mimeType: 'application/pdf',
        storagePath,
        downloadUrl,
        fileSizeBytes: file.size,
        pageRecords,
        ocrPagesCount,
        updateQueue,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PDF processing failed';
      updateQueue(100, 'Failed', msg);
      await updateDoc(doc(db, 'pdfDocuments', docId), {
        processingStatus: 'error',
        processingError: msg.slice(0, 550),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      showToast(msg, 'error');
    }
  };

  const handleAnalyzeOfficeOrImageFiles = async (files: FileList | null, expectedType: 'document' | 'image') => {
    if (!files || files.length === 0 || !user) return;
    if (!pdfUploadAllowedByAdmin && !isAdmin) {
      showToast('File uploads are disabled by admin.', 'error');
      return;
    }

    for (const file of Array.from(files)) {
      if (!checkDailyAndQuota(file.size)) continue;
      const docId = makeSafeId(expectedType === 'image' ? 'img' : 'doc');
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const updateQueue = (progress: number, stage: string, error?: string) => {
        setUploadingQueue((prev) => {
          const exists = prev.some((q) => q.id === docId);
          if (!exists) return [...prev, { id: docId, fileName: file.name, progress, stage, error }];
          return prev.map((q) => (q.id === docId ? { ...q, progress, stage, error } : q));
        });
      };

      try {
        updateQueue(10, expectedType === 'image' ? 'Compressing image & running OCR...' : 'Reading document...');
        const parsed =
          expectedType === 'image'
            ? await compressImageForAnalyzer(file)
            : await parseOfficeOrTextDocument(file);

        const initialRecord: PdfDocumentRecord = {
          id: docId,
          userId: user.uid,
          title: parsed.title,
          fileName: cleanFileName.slice(0, 230),
          category: uploadCategory,
          specialty: uploadSpecialty,
          sourceType: expectedType,
          mimeType: parsed.mimeType.slice(0, 110),
          ...(uploadFolderId ? { folderId: uploadFolderId } : {}),
          fileSizeBytes: file.size,
          pageCount: parsed.pages.length,
          ocrPagesCount: expectedType === 'image' ? 1 : 0,
          processingStatus: 'uploading',
          processingProgress: 20,
          sharedWithLink: false,
        };
        await setDoc(doc(db, 'pdfDocuments', docId), {
          ...initialRecord,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setSelectedDocId(docId);

        let storagePath = '';
        let downloadUrl = '';
        try {
          updateQueue(30, 'Uploading file to Cloud Storage (R2)...');
          const sPath = `users/${user.uid}/${expectedType}s/${docId}/${cleanFileName}`;
          const uploaded = await uploadUserFileToStorage(file, sPath, parsed.mimeType);
          storagePath = uploaded.storagePath;
          downloadUrl = uploaded.downloadUrl;
        } catch (storageErr) {
          console.warn('Cloud Storage upload fallback:', storageErr);
        }

        const pageRecords: PdfPageRecord[] = parsed.pages.map((p) => ({
          id: `page-${p.pageNumber}`,
          documentId: docId,
          userId: user.uid,
          pageNumber: p.pageNumber,
          text: p.text,
          isScanned: p.isScanned,
          ocrApplied: false,
          diagramSummary: '',
          thumbnailDataUrl: p.imageBase64 ? p.imageBase64.slice(0, 175000) : '',
        }));

        if (expectedType === 'image' && parsed.pages[0]?.imageBase64 && aiCfg.allowOcrAndVision !== false) {
          updateQueue(55, language === 'bn' ? 'ছবি থেকে টেক্সট ও ডায়াগ্রাম বিশ্লেষণ (OCR)...' : 'Running Vision OCR on Image...');
          const ocrResp = await fetch(apiUrl('/api/pdf/ocr-pages'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pages: [{ pageNumber: 1, imageBase64: parsed.pages[0].imageBase64, mimeType: 'image/jpeg', existingText: '' }],
              specialty: uploadSpecialty,
              language,
              model: aiCfg.preferredModel,
              reasoningLevel: aiCfg.reasoningLevel,
              stripPii: aiCfg.stripPiiBeforeAi,
            }),
          });
          const ocrData = await ocrResp.json();
          if (!ocrResp.ok) throw new Error(ocrData.error || 'Image OCR failed');
          const out = ocrData.pages?.[0];
          if (out && pageRecords[0]) {
            pageRecords[0].text = String(out.ocrText || '').slice(0, 32000);
            pageRecords[0].diagramSummary = String(out.diagramSummary || '').slice(0, 4800);
            pageRecords[0].ocrApplied = true;
          }
        }

        await runChunkedAnalysisAndSave({
          docId,
          title: parsed.title,
          fileName: cleanFileName,
          sourceType: expectedType,
          mimeType: parsed.mimeType,
          storagePath,
          downloadUrl,
          fileSizeBytes: file.size,
          pageRecords,
          ocrPagesCount: expectedType === 'image' ? 1 : 0,
          updateQueue,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'File analysis failed';
        updateQueue(100, 'Failed', msg);
        await updateDoc(doc(db, 'pdfDocuments', docId), {
          processingStatus: 'error',
          processingError: msg.slice(0, 550),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
        showToast(msg, 'error');
      }
    }
  };

  const handleAnalyzeTextInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const body = textInputBody.trim();
    if (body.length < 15) {
      showToast(language === 'bn' ? 'কমপক্ষে ১৫ অক্ষরের লেখা দিন।' : 'Enter at least 15 characters to analyze.', 'error');
      return;
    }
    const sizeBytes = new Blob([body]).size;
    if (!checkDailyAndQuota(sizeBytes)) return;

    const docId = makeSafeId('txt');
    const title = (textInputTitle.trim() || body.slice(0, 60).replace(/\s+/g, ' ')).slice(0, 180);
    setSubmittingSource(true);
    const updateQueue = (progress: number, stage: string, error?: string) => {
      setUploadingQueue((prev) => {
        const exists = prev.some((q) => q.id === docId);
        if (!exists) return [...prev, { id: docId, fileName: title, progress, stage, error }];
        return prev.map((q) => (q.id === docId ? { ...q, progress, stage, error } : q));
      });
    };

    try {
      const pageRecords: PdfPageRecord[] = [];
      for (let i = 0; i < Math.min(body.length, 180000); i += 4800) {
        const pg = pageRecords.length + 1;
        pageRecords.push({
          id: `page-${pg}`,
          documentId: docId,
          userId: user.uid,
          pageNumber: pg,
          text: body.slice(i, i + 4800),
          isScanned: false,
          ocrApplied: false,
          diagramSummary: '',
          thumbnailDataUrl: '',
        });
      }

      await setDoc(doc(db, 'pdfDocuments', docId), {
        id: docId,
        userId: user.uid,
        title,
        fileName: `${docId}.txt`,
        category: uploadCategory,
        specialty: uploadSpecialty,
        sourceType: 'text',
        mimeType: 'text/plain',
        ...(uploadFolderId ? { folderId: uploadFolderId } : {}),
        fileSizeBytes: sizeBytes,
        pageCount: pageRecords.length,
        ocrPagesCount: 0,
        processingStatus: 'analyzing',
        processingProgress: 40,
        sharedWithLink: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedDocId(docId);

      await runChunkedAnalysisAndSave({
        docId,
        title,
        fileName: `${title}.txt`,
        sourceType: 'text',
        mimeType: 'text/plain',
        fileSizeBytes: sizeBytes,
        pageRecords,
        ocrPagesCount: 0,
        updateQueue,
      });

      setTextInputTitle('');
      setTextInputBody('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Text analysis failed';
      updateQueue(100, 'Failed', msg);
      showToast(msg, 'error');
    } finally {
      setSubmittingSource(false);
    }
  };

  const handleAnalyzeWebsiteUrls = async (mode: 'url' | 'multi_url') => {
    if (!user) return;
    setUrlWarnings([]);
    const rawList =
      mode === 'url'
        ? [singleUrlInput.trim()]
        : multiUrlInput
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 6);

    if (rawList.length === 0 || !rawList[0]) {
      showToast(language === 'bn' ? 'সঠিক ওয়েবসাইট লিংক দিন।' : 'Enter at least one public http/https website URL.', 'error');
      return;
    }
    if (!checkDailyAndQuota(64 * 1024)) return;

    const docId = makeSafeId(mode === 'url' ? 'url' : 'murl');
    setSubmittingSource(true);
    const updateQueue = (progress: number, stage: string, error?: string) => {
      setUploadingQueue((prev) => {
        const exists = prev.some((q) => q.id === docId);
        if (!exists) return [...prev, { id: docId, fileName: rawList[0], progress, stage, error }];
        return prev.map((q) => (q.id === docId ? { ...q, progress, stage, error } : q));
      });
    };

    try {
      const collectedPages: PdfPageRecord[] = [];
      const fetchedUrls: string[] = [];
      const warningsLocal: string[] = [];
      let primaryTitle = '';

      for (let idx = 0; idx < rawList.length; idx++) {
        const targetUrl = rawList[idx];
        updateQueue(
          15 + Math.round(((idx + 1) / rawList.length) * 45),
          language === 'bn' ? `ওয়েবপেজ পড়া হচ্ছে (${idx + 1}/${rawList.length})...` : `Fetching web page ${idx + 1}/${rawList.length}...`
        );
        const resp = await fetch(apiUrl('/api/analyzer/fetch-url'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          warningsLocal.push(`${targetUrl}: ${data.error || 'Failed to read URL'}`);
          continue;
        }
        fetchedUrls.push(String(data.url || targetUrl));
        if (!primaryTitle && data.title) primaryTitle = String(data.title);
        const srcPages = Array.isArray(data.pages) ? data.pages : [];
        for (const sp of srcPages) {
          const pgNum = collectedPages.length + 1;
          collectedPages.push({
            id: `page-${pgNum}`,
            documentId: docId,
            userId: user.uid,
            pageNumber: pgNum,
            text: `[SOURCE URL: ${data.url} | TITLE: ${data.title}]\n\n${String(sp.text || '')}`.slice(0, 32000),
            isScanned: false,
            ocrApplied: false,
            diagramSummary: '',
            thumbnailDataUrl: '',
          });
        }
      }

      if (warningsLocal.length > 0) setUrlWarnings(warningsLocal);

      if (collectedPages.length === 0) {
        throw new Error(warningsLocal[0] || 'Could not extract readable content from the provided URL(s).');
      }

      const finalTitle = (
        mode === 'url'
          ? primaryTitle || fetchedUrls[0]
          : `Multi-URL Research (${fetchedUrls.length} sources): ${primaryTitle || fetchedUrls[0]}`
      ).slice(0, 180);

      const byteSize = collectedPages.reduce((acc, p) => acc + p.text.length, 0);

      await setDoc(doc(db, 'pdfDocuments', docId), {
        id: docId,
        userId: user.uid,
        title: finalTitle,
        fileName: `${docId}.url`,
        category: uploadCategory,
        specialty: uploadSpecialty,
        sourceType: mode,
        sourceUrl: fetchedUrls[0]?.slice(0, 1150),
        sourceUrls: fetchedUrls.slice(0, 10),
        mimeType: 'text/html',
        ...(uploadFolderId ? { folderId: uploadFolderId } : {}),
        fileSizeBytes: byteSize,
        pageCount: collectedPages.length,
        ocrPagesCount: 0,
        processingStatus: 'analyzing',
        processingProgress: 65,
        sharedWithLink: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedDocId(docId);

      await runChunkedAnalysisAndSave({
        docId,
        title: finalTitle,
        fileName: fetchedUrls[0] || finalTitle,
        sourceType: mode,
        sourceUrl: fetchedUrls[0],
        sourceUrls: fetchedUrls,
        mimeType: 'text/html',
        fileSizeBytes: byteSize,
        pageRecords: collectedPages,
        ocrPagesCount: 0,
        updateQueue,
      });

      if (mode === 'url') setSingleUrlInput('');
      else setMultiUrlInput('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Website analysis failed';
      updateQueue(100, 'Failed', msg);
      showToast(msg, 'error');
    } finally {
      setSubmittingSource(false);
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (inputMode === 'document') {
      await handleAnalyzeOfficeOrImageFiles(files, 'document');
      return;
    }
    if (inputMode === 'image') {
      await handleAnalyzeOfficeOrImageFiles(files, 'image');
      return;
    }
    for (const f of Array.from(files)) {
      await processSinglePdfFile(f);
    }
  };

  const handleLoadSharedDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = sharedDocInput.trim();
    if (!id) return;
    try {
      const snap = await getDoc(doc(db, 'pdfDocuments', id));
      if (!snap.exists()) {
        showToast('Shared document not found or sharing is disabled.', 'error');
        return;
      }
      const d = snap.data() as PdfDocumentRecord;
      setSharedDocOverride(d);
      setSelectedDocId(d.id);
      setSharedDocInput('');
      showToast(`Loaded shared document: ${d.title}`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `pdfDocuments/${id}`);
    }
  };

  const filteredDocs = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    const list = pdfDocuments.filter((d) => {
      if (libCatFilter !== 'all' && d.category !== libCatFilter) return false;
      if (libFolderFilter === 'unfiled' && d.folderId) return false;
      if (libFolderFilter !== 'all' && libFolderFilter !== 'unfiled' && d.folderId !== libFolderFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        (d.documentType || '').toLowerCase().includes(q) ||
        (d.summaryEn || '').toLowerCase().includes(q)
      );
    });
    const toMillis = (ts: unknown): number => {
      const t = ts as { toMillis?: () => number } | undefined;
      return t && typeof t.toMillis === 'function' ? t.toMillis() : 0;
    };
    return [...list].sort((a, b) => {
      if (libSort === 'name') return a.title.localeCompare(b.title);
      if (libSort === 'size') return (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0);
      if (libSort === 'pages') return (b.pageCount || 0) - (a.pageCount || 0);
      if (libSort === 'oldest') return toMillis(a.createdAt) - toMillis(b.createdAt);
      return toMillis(b.createdAt) - toMillis(a.createdAt);
    });
  }, [pdfDocuments, libSearch, libCatFilter, libFolderFilter, libSort]);

  const handleGenerateAiDocumentReport = () => {
    if (!activeDoc) return;
    const isBn = reportLangChoice === 'bn';
    const summaryText = isBn
      ? activeDoc.summaryBn || activeDoc.summaryEn || ''
      : activeDoc.summaryEn || activeDoc.summaryBn || '';

    const rows: Array<{ label: string; value: string; unit: string; notes?: string }> = [];

    for (const s of (activeDoc.extractedSpecs || []).slice(0, 15)) {
      rows.push({
        label: `[Spec] ${s.parameter}`,
        value: s.value,
        unit: s.unit || '-',
        notes: `${s.category} · Page ${s.page}`,
      });
    }

    for (const tbl of editingTables.slice(0, 3)) {
      for (const r of tbl.rows.slice(0, 8)) {
        rows.push({
          label: `[${tbl.title}] ${r[0] || 'Row'}`,
          value: r.slice(1, 3).join(' | ') || '-',
          unit: r[3] || '-',
          notes: `Page ${tbl.page}`,
        });
      }
    }

    if (includeRecentCalcInReport && history.length > 0) {
      for (const h of history.slice(0, 3)) {
        const firstOut = Object.values(h.outputs)[0];
        if (firstOut) {
          rows.push({
            label: `[Calc] ${isBn ? h.calculatorNameBn || h.calculatorNameEn : h.calculatorNameEn}`,
            value: firstOut.formatted,
            unit: firstOut.unit || '-',
            notes: h.formulaDisplay || 'SUTRO SATHI Engine',
          });
        }
      }
    }

    const findingsBlock = (activeDoc.keyFindings || [])
      .slice(0, 10)
      .map((kf) => `- [${kf.type.toUpperCase()} · Page ${kf.page}] ${kf.text}`)
      .join('\n');

    const warningsBlock = (activeDoc.warnings || [])
      .slice(0, 8)
      .map((w) => `- [${w.severity.toUpperCase()} · Page ${w.page}] ${w.message}`)
      .join('\n');

    const conclusion = isBn
      ? `উপসংহার: "${activeDoc.title}" (${activeDoc.pageCount} পৃষ্ঠা) ডকুমেন্ট থেকে প্রাপ্ত তথ্য যাচাইপূর্বক চূড়ান্ত প্রকৌশল অনুমোদনের আগে প্রাসঙ্গিক মানদণ্ডের সাথে মিলিয়ে দেখুন।`
      : `Conclusion: Analysis of "${activeDoc.title}" (${activeDoc.pageCount} pages, ${activeDoc.ocrPagesCount} OCR pages) completed. Verify critical engineering ratings against site standards prior to execution.`;

    setPendingReportDraft({
      title: isBn
        ? `এআই ডকুমেন্ট বিশ্লেষণ প্রতিবেদন: ${activeDoc.title}`
        : `AI Document Intelligence Report: ${activeDoc.title}`,
      sourceType: 'pdf_analyzer',
      warnings: (activeDoc.warnings || []).slice(0, 8).map((w) => `[${w.severity.toUpperCase()} · Page ${w.page}] ${w.message}`),
      tables: editingTables.slice(0, 3).map((t) => ({
        title: `${t.title} (Page ${t.page})`,
        headers: t.headers,
        rows: t.rows,
      })),
      rows:
        rows.length > 0
          ? rows
          : [{ label: 'Document Pages', value: String(activeDoc.pageCount), unit: 'Pages', notes: activeDoc.documentType }],
      chartData: [
        { label: 'Specs', value: (activeDoc.extractedSpecs || []).length },
        { label: 'Numbers', value: (activeDoc.extractedNumbers || []).length },
        { label: 'Tables', value: editingTables.length },
        { label: 'Warnings', value: (activeDoc.warnings || []).length },
      ],
      remarks: [
        `=== ${isBn ? 'ডকুমেন্ট সারসংক্ষেপ' : 'DOCUMENT SUMMARY'} ===\n${summaryText}`,
        findingsBlock ? `\n=== ${isBn ? 'গুরুত্বপূর্ণ তথ্য ও ফলাফল' : 'KEY FINDINGS & PAGE REFERENCES'} ===\n${findingsBlock}` : '',
        warningsBlock ? `\n=== ${isBn ? 'সতর্কবার্তা ও অসঙ্গতি' : 'WARNINGS & INCONSISTENCIES'} ===\n${warningsBlock}` : '',
        `\n=== ${isBn ? 'উপসংহার' : 'CONCLUSION'} ===\n${conclusion}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
    navigateTo('reports');
  };

  const handleCopyAnalysisText = async () => {
    if (!activeDoc) return;
    const isBn = language === 'bn';
    const summary = isBn ? activeDoc.summaryBn || activeDoc.summaryEn || '' : activeDoc.summaryEn || activeDoc.summaryBn || '';
    const findings = (activeDoc.keyFindings || [])
      .map((kf) => `- [${kf.type.toUpperCase()} · p.${kf.page}] ${kf.text}`)
      .join('\n');
    const text = [
      `${activeDoc.title} (${activeDoc.documentType || activeDoc.category})`,
      activeDoc.sourceUrl ? `Source URL: ${activeDoc.sourceUrl}` : '',
      `\nSummary:\n${summary}`,
      findings ? `\nKey Findings:\n${findings}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast(isBn ? 'বিশ্লেষণ টেক্সট কপি করা হয়েছে।' : 'Analysis text copied to clipboard.', 'success');
    } catch {
      showToast('Unable to copy text to clipboard.', 'error');
    }
  };

  const handleDownloadAnalysisPdf = async () => {
    if (!activeDoc || !overviewPrintRef.current) return;
    setExportingPdf(true);
    try {
      const dataUrl = await toPng(overviewPrintRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(dataUrl);
      const imgWidth = pageWidth - 16;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      let y = 8;
      let remaining = imgHeight;
      pdf.addImage(dataUrl, 'PNG', 8, y, imgWidth, imgHeight);
      remaining -= pageHeight - 16;
      while (remaining > 0) {
        pdf.addPage();
        y = -(imgHeight - remaining) + 8;
        pdf.addImage(dataUrl, 'PNG', 8, y, imgWidth, imgHeight);
        remaining -= pageHeight - 16;
      }
      const safeName = activeDoc.title.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'analysis';
      pdf.save(`${safeName}_smart_analysis.pdf`);
      showToast(language === 'bn' ? 'বিশ্লেষণ PDF ডাউনলোড হয়েছে।' : 'Analysis PDF downloaded.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'PDF export failed', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  if (!aiCfg.enabled && !isAdmin) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2 max-w-lg mx-auto">
        <Lock className="w-8 h-8 text-slate-400 mx-auto" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {language === 'bn' ? 'এআই পিডিএফ বিশ্লেষক সাময়িকভাবে বন্ধ' : 'AI PDF Analyzer Disabled'}
        </h2>
        <p className="text-xs text-slate-500">
          Administrators have temporarily disabled the AI PDF Document Intelligence module.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4 max-w-xl mx-auto">
        <FileScan className="w-10 h-10 text-blue-700 dark:text-blue-400 mx-auto" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {language === 'bn'
            ? 'এআই পিডিএফ বিশ্লেষক ও ডকুমেন্ট ইন্টেলিজেন্স'
            : 'AI PDF Analyzer & Document Intelligence'}
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {language === 'bn'
            ? 'আপনার ব্যক্তিগত পিডিএফ, ইঞ্জিনিয়ারিং ড্রয়িং, ক্যাবল শিডিউল ও বিওকিউ নিরাপদে আপলোড, ওসিআর এবং প্রশ্নোত্তর করতে গুগল দিয়ে সাইন ইন করুন।'
            : 'Sign in with Google to securely upload private PDFs, run Vision OCR on engineering drawings, extract editable tables, ask grounded questions, and sync numbers directly with SUTRO SATHI calculators.'}
        </p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
        >
          <span>{language === 'bn' ? 'গুগল দিয়ে সাইন ইন করুন' : 'Sign in with Google'}</span>
        </button>
      </div>
    );
  }

  if (!userRoleAllowed) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-8 text-center space-y-2 max-w-lg mx-auto">
        <ShieldAlert className="w-8 h-8 text-red-600 mx-auto" />
        <h2 className="text-base font-bold">Access Restricted by Administrator</h2>
        <p className="text-xs text-slate-500">
          Your role ({profile?.role}) does not currently have permission to run AI PDF analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Usage Telemetry */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {language === 'bn'
                ? 'এআই স্মার্ট তথ্য বিশ্লেষক ও রিসার্চ অ্যাসিস্ট্যান্ট'
                : 'AI Smart Information Analyzer & Research Assistant'}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {language === 'bn'
                ? 'পিডিএফ, টেক্সট, ওয়েবসাইট লিংক, DOCX/XLSX/CSV ফাইল, ছবি ও ড্রয়িং থেকে ওসিআর, রিসার্চ প্রশ্নোত্তর ও রিপোর্ট তৈরি করুন।'
                : 'Analyze PDFs, pasted text, public URLs, DOCX/XLSX/CSV files & images with Vision OCR, grounded Q&A, research synthesis & multi-format exports.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            <span>
              Provider: <strong className="uppercase text-brand-primary">{aiCfg.aiProvider || 'gemini'}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Storage:{' '}
              <strong>{analyzerStatus.r2Configured ? 'Cloudflare R2' : 'Cloud Storage (Local Fallback)'}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Today: {todayAiUsage?.analysisCount || 0}/{aiCfg.dailyUserAnalysisLimit}
            </span>
          </div>
        </div>

        {/* Personal Cloud Storage Quota Dashboard Strip */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <HardDrive className="w-4 h-4 text-brand-primary" />
              <span>{language === 'bn' ? 'ক্লাউড স্টোরেজ (R2) কোটা' : 'Cloud Storage (R2) Quota'}</span>
              <span className="text-[11px] font-mono text-slate-500">
                ({(profile?.accountType || 'free').toUpperCase()})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tabular text-slate-600 dark:text-slate-400">
              <span>{storageStats.totalFiles} Sources</span>
              <span>{storageStats.totalPages} Pages/Sec</span>
              <span>
                {language === 'bn' ? 'ব্যবহৃত:' : 'Used:'} {(storageStats.usedBytes / 1024 / 1024).toFixed(2)} MB /{' '}
                {(storageStats.quotaBytes / 1024 / 1024).toFixed(0)} MB ({storageStats.pct}%)
              </span>
              <span className="text-emerald-700 dark:text-emerald-400">
                {language === 'bn' ? 'বাকি:' : 'Remaining:'} {(storageStats.availableBytes / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all ${
                storageStats.pct >= 95 ? 'bg-red-600' : storageStats.pct >= 80 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${storageStats.pct}%` }}
            />
          </div>
        </div>

        {/* Source Input Mode Tabs & Analysis Controls */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'pdf' as const, en: 'PDF Upload', bn: 'PDF আপলোড', icon: FileScan, show: true },
                  { id: 'text' as const, en: 'Text Input', bn: 'টেক্সট ইনপুট', icon: TypeIcon, show: true },
                  { id: 'url' as const, en: 'Website URL', bn: 'ওয়েবসাইট লিংক', icon: Link2, show: aiCfg.allowWebsiteUrls !== false },
                  { id: 'multi_url' as const, en: 'Multiple URLs', bn: 'একাধিক লিংক', icon: Layers, show: aiCfg.allowMultiUrlAnalysis !== false },
                  { id: 'document' as const, en: 'Docs (DOCX/XLSX/CSV/TXT)', bn: 'ডকুমেন্ট ফাইল', icon: FileText, show: aiCfg.allowDocumentUpload !== false },
                  { id: 'image' as const, en: 'Image / Scan (OCR)', bn: 'ছবি / স্ক্যান OCR', icon: ImageIcon, show: aiCfg.allowImageInput !== false },
                ] as const
              )
                .filter((m) => m.show)
                .map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setInputMode(m.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        inputMode === m.id
                          ? 'border-brand-primary bg-brand-soft text-brand-primary'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? m.bn : m.en}</span>
                    </button>
                  );
                })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-medium text-slate-500">Mode:</span>
              <button
                type="button"
                onClick={() => setAnalysisMode('standard')}
                className={`px-2 py-1 rounded border text-[11px] cursor-pointer ${
                  analysisMode === 'standard'
                    ? 'border-brand-primary bg-brand-soft text-brand-primary font-semibold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                Standard
              </button>
              {aiCfg.allowResearchMode !== false && (
                <button
                  type="button"
                  onClick={() => setAnalysisMode('research')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] cursor-pointer ${
                    analysisMode === 'research'
                      ? 'border-brand-primary bg-brand-soft text-brand-primary font-semibold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Compass className="w-3 h-3" />
                  <span>AI Research</span>
                </button>
              )}
              {aiCfg.enableEngineeringMode !== false && (
                <button
                  type="button"
                  onClick={() => setAnalysisMode('engineering')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] cursor-pointer ${
                    analysisMode === 'engineering'
                      ? 'border-brand-primary bg-brand-soft text-brand-primary font-semibold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Engineering</span>
                </button>
              )}
            </div>
          </div>

          {/* Shared Metadata Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={uploadCategory}
              onChange={(e) => {
                setUploadCategory(e.target.value);
                if (['electrical', 'mechanical', 'civil'].includes(e.target.value)) {
                  setUploadSpecialty(e.target.value as typeof uploadSpecialty);
                }
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
            >
              {CATEGORY_OPTIONS.filter((c) => aiCfg.allowedCategories.includes(c.id)).map((c) => (
                <option key={c.id} value={c.id}>
                  {language === 'bn' ? c.labelBn : c.labelEn}
                </option>
              ))}
            </select>

            <select
              value={uploadSpecialty}
              onChange={(e) => setUploadSpecialty(e.target.value as typeof uploadSpecialty)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
            >
              <option value="general">General Analysis</option>
              <option value="electrical">Electrical Engineering</option>
              <option value="mechanical">Mechanical Engineering</option>
              <option value="civil">Civil &amp; Construction</option>
            </select>

            {pdfFolders.length > 0 && (
              <select
                value={uploadFolderId}
                onChange={(e) => setUploadFolderId(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
              >
                <option value="">{language === 'bn' ? 'ফোল্ডার (ঐচ্ছিক)' : 'No Folder'}</option>
                {pdfFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* File Upload Zone (PDF, Document, or Image) */}
          {(inputMode === 'pdf' || inputMode === 'document' || inputMode === 'image') && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFilesSelected(e.dataTransfer.files);
              }}
              className={`rounded-xl border-2 border-dashed p-5 transition-colors ${
                dragOver
                  ? 'border-brand-primary bg-brand-soft'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/50'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-brand-primary" />
                    <span>
                      {inputMode === 'pdf'
                        ? language === 'bn'
                          ? 'একাধিক পিডিএফ, স্ক্যান বা ড্রয়িং আপলোড করুন'
                          : 'Upload Single or Multiple PDFs, Scanned Docs & Engineering Drawings'
                        : inputMode === 'document'
                          ? language === 'bn'
                            ? 'TXT, DOCX, XLSX, CSV বা JSON ডকুমেন্ট আপলোড করুন'
                            : 'Upload TXT, DOCX, XLSX, XLS, CSV, MD or JSON Documents'
                          : language === 'bn'
                            ? 'JPG বা PNG ছবি/স্ক্যান আপলোড করুন (Vision OCR)'
                            : 'Upload JPG or PNG Image / Scanned Document (Vision OCR)'}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {inputMode === 'pdf'
                      ? `Max ${effectiveMaxFileMb} MB · Up to ${aiCfg.maxPagesPerFile} pages · Archived securely in ${analyzerStatus.r2Configured ? 'Cloudflare R2' : 'Cloud Storage'}.`
                      : inputMode === 'document'
                        ? 'Extracts spreadsheets, tables, specifications, and bilingual summaries automatically.'
                        : 'Runs Vision OCR to read Bangla & English text, schematic labels, specs, and tables from images.'}
                  </p>
                </div>

                <label className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs font-medium cursor-pointer whitespace-nowrap shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {inputMode === 'pdf'
                      ? language === 'bn'
                        ? 'PDF নির্বাচন করুন'
                        : 'Select PDF Files'
                      : inputMode === 'document'
                        ? language === 'bn'
                          ? 'ফাইল নির্বাচন করুন'
                          : 'Select Documents'
                        : language === 'bn'
                          ? 'ছবি নির্বাচন করুন'
                          : 'Select Images'}
                  </span>
                  <input
                    type="file"
                    accept={
                      inputMode === 'pdf'
                        ? 'application/pdf,.pdf'
                        : inputMode === 'document'
                          ? '.txt,.md,.csv,.docx,.xlsx,.xls,.json'
                          : 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp'
                    }
                    multiple
                    onChange={(e) => {
                      handleFilesSelected(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Direct Text Input Mode */}
          {inputMode === 'text' && (
            <form onSubmit={handleAnalyzeTextInput} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3">
              <input
                type="text"
                value={textInputTitle}
                onChange={(e) => setTextInputTitle(e.target.value)}
                placeholder={language === 'bn' ? 'তথ্যের শিরোনাম (ঐচ্ছিক)...' : 'Title for this text analysis (optional)...'}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
              <textarea
                rows={4}
                value={textInputBody}
                onChange={(e) => setTextInputBody(e.target.value)}
                placeholder={
                  language === 'bn'
                    ? 'বাংলা বা ইংরেজি লেখা, রিপোর্ট, স্পেসিফিকেশন বা নোট এখানে Paste বা Type করুন...'
                    : 'Paste or type Bangla or English text, technical notes, specs, or articles here...'
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs"
              />
              <button
                type="submit"
                disabled={submittingSource || textInputBody.trim().length < 15}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{submittingSource ? (language === 'bn' ? 'বিশ্লেষণ হচ্ছে...' : 'Analyzing...') : language === 'bn' ? 'টেক্সট বিশ্লেষণ করুন' : 'Analyze Text'}</span>
              </button>
            </form>
          )}

          {/* Single Website URL Mode */}
          {inputMode === 'url' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAnalyzeWebsiteUrls('url');
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3"
            >
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  required
                  value={singleUrlInput}
                  onChange={(e) => setSingleUrlInput(e.target.value)}
                  placeholder="https://example.com/engineering-spec-or-article"
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  disabled={submittingSource || !singleUrlInput.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs font-medium cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{submittingSource ? (language === 'bn' ? 'তথ্য সংগ্রহ হচ্ছে...' : 'Fetching...') : language === 'bn' ? 'লিংক বিশ্লেষণ করুন' : 'Fetch & Analyze URL'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Public HTTP/HTTPS pages only. Login-gated or paywalled websites are flagged clearly so you can paste readable text instead.
              </p>
            </form>
          )}

          {/* Multiple URLs Comparative Analysis Mode */}
          {inputMode === 'multi_url' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAnalyzeWebsiteUrls('multi_url');
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3"
            >
              <textarea
                rows={4}
                value={multiUrlInput}
                onChange={(e) => setMultiUrlInput(e.target.value)}
                placeholder={'https://site-one.com/datasheet\nhttps://site-two.com/comparison\n(Paste 2 to 6 public URLs, one per line)'}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs font-mono"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  Combines up to 6 public web sources into a unified multi-URL research & comparison index.
                </span>
                <button
                  type="submit"
                  disabled={submittingSource || !multiUrlInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs font-medium cursor-pointer disabled:opacity-50"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{submittingSource ? (language === 'bn' ? 'বিশ্লেষণ হচ্ছে...' : 'Analyzing URLs...') : language === 'bn' ? 'একাধিক লিংক বিশ্লেষণ' : 'Analyze Multiple URLs'}</span>
                </button>
              </div>
            </form>
          )}

          {urlWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1 text-xs text-amber-800 dark:text-amber-300">
              {urlWarnings.map((w, i) => (
                <p key={i}>• {w}</p>
              ))}
            </div>
          )}

          {uploadingQueue.length > 0 && (
            <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
              {uploadingQueue.map((q) => (
                <div key={q.id} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{q.fileName}</span>
                    <span className={`tabular-nums ${q.error ? 'text-red-600' : 'text-brand-primary'}`}>
                      {q.error ? q.error : `${q.stage} (${q.progress}%)`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${q.error ? 'bg-red-600' : 'bg-blue-700'}`}
                      style={{ width: `${q.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Split: Private Document Library + Intelligence Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Document Library */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {language === 'bn' ? 'ডকুমেন্ট লাইব্রেরি' : 'Document Library'} ({pdfDocuments.length})
              </h2>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Private</span>
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={libSearch}
                onChange={(e) => setLibSearch(e.target.value)}
                placeholder={language === 'bn' ? 'ডকুমেন্ট খুঁজুন...' : 'Search PDFs, types, summaries...'}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={libCatFilter}
                onChange={(e) => setLibCatFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs"
              >
                <option value="all">{language === 'bn' ? 'সকল ক্যাটাগরি' : 'All Categories'}</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {language === 'bn' ? c.labelBn : c.labelEn}
                  </option>
                ))}
              </select>

              <select
                value={libSort}
                onChange={(e) => setLibSort(e.target.value as typeof libSort)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs"
              >
                <option value="newest">{language === 'bn' ? 'নতুন আগে' : 'Newest First'}</option>
                <option value="oldest">{language === 'bn' ? 'পুরাতন আগে' : 'Oldest First'}</option>
                <option value="name">{language === 'bn' ? 'নাম (A-Z)' : 'Name (A-Z)'}</option>
                <option value="size">{language === 'bn' ? 'বড় ফাইল আগে' : 'Largest Size'}</option>
                <option value="pages">{language === 'bn' ? 'বেশি পৃষ্ঠা' : 'Most Pages'}</option>
              </select>
            </div>

            {/* Folder Management Bar */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <Folder className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'ফোল্ডার' : 'Folders'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewFolderForm((v) => !v)}
                  className="text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>{language === 'bn' ? 'নতুন ফোল্ডার' : 'New Folder'}</span>
                </button>
              </div>

              {showNewFolderForm && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newFolderName.trim()) return;
                    await savePdfFolder({ name: newFolderName.trim() });
                    setNewFolderName('');
                    setShowNewFolderForm(false);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder={language === 'bn' ? 'ফোল্ডারের নাম...' : 'Folder name...'}
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs"
                  />
                  <button type="submit" className="px-2.5 py-1 rounded-lg bg-blue-700 text-white text-xs cursor-pointer">
                    Add
                  </button>
                </form>
              )}

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setLibFolderFilter('all')}
                  className={`px-2 py-1 rounded-md border text-[11px] cursor-pointer ${
                    libFolderFilter === 'all'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setLibFolderFilter('unfiled')}
                  className={`px-2 py-1 rounded-md border text-[11px] cursor-pointer ${
                    libFolderFilter === 'unfiled'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Unfiled
                </button>
                {pdfFolders.map((f) => (
                  <div key={f.id} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => setLibFolderFilter(f.id)}
                      className={`px-2 py-1 rounded-l-md border text-[11px] cursor-pointer ${
                        libFolderFilter === f.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {f.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deletePdfFolder(f.id)}
                      title="Delete folder"
                      className="px-1.5 py-1 rounded-r-md border border-l-0 border-slate-200 dark:border-slate-700 text-[11px] text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-0.5">
              {filteredDocs.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  {language === 'bn'
                    ? 'কোনো পিডিএফ পাওয়া যায়নি। উপরে একটি পিডিএফ আপলোড করুন।'
                    : 'No PDF documents in your private library yet. Upload a PDF above to begin.'}
                </p>
              ) : (
                filteredDocs.map((d) => {
                  const isActive = activeDoc?.id === d.id;
                  return (
                    <div
                      key={d.id}
                      className={`rounded-xl border p-3 space-y-2 transition-colors ${
                        isActive
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {renamingDocId === d.id ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            await renamePdfDocument(d.id, renameText);
                            setRenamingDocId(null);
                          }}
                          className="flex gap-1.5"
                        >
                          <input
                            type="text"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            className="flex-1 rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs"
                            autoFocus
                          />
                          <button type="submit" className="px-2 py-1 rounded bg-blue-700 text-white text-xs cursor-pointer">
                            Save
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSharedDocOverride(null);
                            setSelectedDocId(d.id);
                            setActivePageNum(1);
                          }}
                          className="w-full text-left space-y-1 cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1 flex items-center gap-1.5">
                              <span className="rounded bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                                {SOURCE_BADGE_LABELS[d.sourceType || 'pdf'] || 'PDF'}
                              </span>
                              <span className="truncate">{d.title}</span>
                            </p>
                            <span
                              className={`text-[10px] font-semibold shrink-0 ${
                                d.processingStatus === 'ready'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : d.processingStatus === 'error'
                                    ? 'text-red-600'
                                    : 'text-amber-600'
                              }`}
                            >
                              {d.processingStatus.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {d.documentType || d.category} · {d.pageCount}p · {(d.fileSizeBytes / 1024).toFixed(0)} KB
                            {d.ocrPagesCount > 0 ? ` · ${d.ocrPagesCount} OCR` : ''}
                          </p>
                        </button>
                      )}

                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingDocId(d.id);
                              setRenameText(d.title);
                            }}
                            className="text-slate-500 hover:text-blue-700 cursor-pointer inline-flex items-center gap-0.5"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Rename</span>
                          </button>
                          {aiCfg.allowSharing !== false && (
                            <button
                              type="button"
                              onClick={() => togglePdfSharing(d.id, !d.sharedWithLink)}
                              className={`cursor-pointer inline-flex items-center gap-0.5 ${
                                d.sharedWithLink ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-slate-500'
                              }`}
                            >
                              <Share2 className="w-3 h-3" />
                              <span>{d.sharedWithLink ? 'Shared' : 'Private'}</span>
                            </button>
                          )}
                          {d.downloadUrl && (
                            <a
                              href={d.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-500 hover:text-blue-700 inline-flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>PDF</span>
                            </a>
                          )}
                          {pdfFolders.length > 0 && (
                            <select
                              value={d.folderId || ''}
                              onChange={(e) => void movePdfToFolder(d.id, e.target.value)}
                              aria-label="Move to folder"
                              className="rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[10px] text-slate-600 dark:text-slate-300"
                            >
                              <option value="">Unfiled</option>
                              {pdfFolders.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {confirmDeleteId === d.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await deletePdfDocument(d);
                                void recomputeUserStorageUsage(pdfDocuments.filter((x) => x.id !== d.id));
                                setConfirmDeleteId(null);
                              }}
                              className="text-red-600 font-semibold cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-slate-500 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(d.id)}
                            className="text-slate-400 hover:text-red-600 cursor-pointer"
                            aria-label="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {aiCfg.allowSharing !== false && (
              <form onSubmit={handleLoadSharedDoc} className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-1.5">
                <input
                  type="text"
                  value={sharedDocInput}
                  onChange={(e) => setSharedDocInput(e.target.value)}
                  placeholder="Open shared Document ID..."
                  className="flex-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-[11px]"
                />
                <button
                  type="submit"
                  className="rounded border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium cursor-pointer"
                >
                  Open
                </button>
              </form>
            )}
          </div>
        </aside>

        {/* Right Column: Intelligence Workspace */}
        <div className="lg:col-span-8 space-y-5">
          {/* Sub-module Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            {[
              { id: 'overview' as const, labelEn: 'Summary & Findings', labelBn: 'সারসংক্ষেপ ও পৃষ্ঠা', icon: FileText },
              { id: 'tables' as const, labelEn: 'Tables & Exports', labelBn: 'টেবিল ও এক্সপোর্ট', icon: Table2 },
              { id: 'calc-bridge' as const, labelEn: 'AI Calculation Bridge', labelBn: 'ক্যালকুলেটর ব্রিজ', icon: Calculator },
              { id: 'chat' as const, labelEn: 'Ask PDF AI', labelBn: 'প্রশ্নোত্তর (Q&A)', icon: MessageSquareText },
              ...(aiCfg.allowDocComparison !== false
                ? [{ id: 'compare' as const, labelEn: 'Compare PDFs', labelBn: 'তুলনা করুন', icon: FileDiff }]
                : []),
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    tab === item.id
                      ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? item.labelBn : item.labelEn}</span>
                </button>
              );
            })}
          </div>

          {!activeDoc && tab !== 'compare' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
              <FileScan className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {language === 'bn' ? 'কোনো ডকুমেন্ট নির্বাচিত নেই' : 'No PDF Document Selected'}
              </p>
              <p className="text-xs text-slate-500">
                Upload a PDF document above or select an existing file from your Document Library.
              </p>
            </div>
          )}

          {/* TAB 1: Overview, Findings, Warnings, Formulas & Interactive Page Viewer */}
          {tab === 'overview' && activeDoc && (
            <div ref={overviewPrintRef} className="space-y-5">
              {/* Top Document Metadata & Multi-Format Exports Bar */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded bg-brand-soft text-brand-primary px-2 py-0.5 text-[10px] font-bold">
                        {SOURCE_BADGE_LABELS[activeDoc.sourceType || 'pdf'] || 'PDF'}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">{activeDoc.title}</h2>
                    </div>
                    <p className="text-xs text-slate-500">
                      {activeDoc.documentType || activeDoc.category} · Specialty: {activeDoc.specialty} ·{' '}
                      {activeDoc.pageCount} sections/pages · {activeDoc.ocrPagesCount} OCR · ID:{' '}
                      <code className="font-mono">{activeDoc.id}</code>
                    </p>
                    {activeDoc.sourceUrl && (
                      <a
                        href={activeDoc.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-brand-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate max-w-md">{activeDoc.sourceUrl}</span>
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadAnalysisPdf}
                      disabled={exportingPdf}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-2.5 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{exportingPdf ? 'Exporting...' : 'PDF'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportPdfIntelligenceToExcel(activeDoc)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportTablesToCsv(editingTables, activeDoc.title)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportDocumentToJson(activeDoc)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyAnalysisText}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                      title="Copy Text"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'কপি' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                      title="Print"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
                    </button>
                  </div>
                </div>

                {activeDoc.processingStatus === 'error' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
                    Processing Error: {activeDoc.processingError}
                  </div>
                )}

                {/* Bilingual Summary */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {language === 'bn' ? 'তথ্য সারসংক্ষেপ' : 'Executive Information Summary'}
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {language === 'bn'
                      ? activeDoc.summaryBn || activeDoc.summaryEn || 'Processing summary...'
                      : activeDoc.summaryEn || activeDoc.summaryBn || 'Processing summary...'}
                  </p>
                </div>

                {/* AI Document Report Generator Launcher */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {language === 'bn' ? 'প্রফেশনাল রিপোর্ট বিল্ডারে পাঠান:' : 'Send to Report Builder:'}
                    </span>
                    <select
                      value={reportLangChoice}
                      onChange={(e) => setReportLangChoice(e.target.value as 'en' | 'bn')}
                      className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                    >
                      <option value="en">English Report</option>
                      <option value="bn">বাংলা রিপোর্ট</option>
                    </select>
                    <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={includeRecentCalcInReport}
                        onChange={(e) => setIncludeRecentCalcInReport(e.target.checked)}
                      />
                      <span>Include recent calculation results</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAiDocumentReport}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'রিপোর্ট জেনারেটরে খুলুন' : 'Open in Report Generator'}</span>
                  </button>
                </div>
              </div>

              {/* Warnings & Inconsistencies */}
              {(activeDoc.warnings || []).length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-5 space-y-2.5">
                  <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                      {language === 'bn'
                        ? `শনাক্তকৃত ত্রুটি ও অসঙ্গতি (${activeDoc.warnings!.length})`
                        : `Detected Errors, Discrepancies & Warnings (${activeDoc.warnings!.length})`}
                    </span>
                  </h3>
                  <div className="space-y-1.5">
                    {activeDoc.warnings!.map((w, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 text-xs text-slate-800 dark:text-slate-200">
                        <span>
                          <strong className="uppercase text-[10px] mr-1.5">[{w.severity}]</strong>
                          {w.message}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActivePageNum(w.page)}
                          className="text-blue-700 dark:text-blue-400 hover:underline shrink-0 tabular-nums cursor-pointer"
                        >
                          Page {w.page}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Facts vs Interpretations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
                  <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4" />
                    <span>{language === 'bn' ? 'নথিতে উল্লিখিত তথ্য (Facts)' : 'Extracted Document Facts'}</span>
                  </h3>
                  <ul className="space-y-2 text-xs">
                    {(activeDoc.keyFindings || [])
                      .filter((k) => k.type === 'fact')
                      .map((k, idx) => (
                        <li key={idx} className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <span className="text-slate-700 dark:text-slate-300">{k.text}</span>
                          <button
                            type="button"
                            onClick={() => setActivePageNum(k.page)}
                            className="text-[11px] text-blue-700 dark:text-blue-400 hover:underline shrink-0 tabular-nums cursor-pointer"
                          >
                            p.{k.page}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
                  <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    {language === 'bn' ? 'এআই ব্যাখ্যা ও সূত্র (Interpretations & Formulas)' : 'AI Interpretations & Extracted Formulas'}
                  </h3>
                  <ul className="space-y-2 text-xs">
                    {(activeDoc.keyFindings || [])
                      .filter((k) => k.type !== 'fact')
                      .map((k, idx) => (
                        <li key={idx} className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                          <span className="text-slate-700 dark:text-slate-300">{k.text}</span>
                          <button
                            type="button"
                            onClick={() => setActivePageNum(k.page)}
                            className="text-[11px] text-blue-700 dark:text-blue-400 hover:underline shrink-0 tabular-nums cursor-pointer"
                          >
                            p.{k.page}
                          </button>
                        </li>
                      ))}
                    {(activeDoc.extractedFormulas || []).map((f, idx) => (
                      <li key={`f-${idx}`} className="rounded bg-slate-50 dark:bg-slate-950 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => setActivePageNum(f.page)}
                            className="text-[11px] text-blue-700 dark:text-blue-400 hover:underline tabular-nums cursor-pointer"
                          >
                            p.{f.page}
                          </button>
                        </div>
                        <code className="block font-mono text-blue-700 dark:text-blue-400 mt-0.5">{f.expression}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Interactive Page-by-Page Preview & OCR Text Inspector */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <h3 className="text-sm font-semibold">
                      {language === 'bn' ? 'পৃষ্ঠা প্রিভিউ ও ওসিআর টেক্সট' : 'Page Preview, Diagram Vision & Extracted Text'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      disabled={activePageNum <= 1}
                      onClick={() => setActivePageNum((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="tabular-nums font-medium">
                      Page {activePageNum} / {activePages.length || activeDoc.pageCount || 1}
                    </span>
                    <button
                      type="button"
                      disabled={activePageNum >= (activePages.length || activeDoc.pageCount)}
                      onClick={() => setActivePageNum((p) => p + 1)}
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {loadingPages ? (
                  <p className="text-xs text-slate-500 py-8 text-center">Loading document pages...</p>
                ) : !currentPageObj ? (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    No page records indexed for this document yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 flex flex-col items-center justify-center min-h-[280px]">
                      {currentPageObj.thumbnailDataUrl ? (
                        <img
                          src={currentPageObj.thumbnailDataUrl}
                          alt={`Page ${currentPageObj.pageNumber}`}
                          referrerPolicy="no-referrer"
                          className="max-h-[420px] w-auto object-contain rounded"
                        />
                      ) : (
                        <p className="text-xs text-slate-500">Preview unavailable</p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-2">
                        {currentPageObj.isScanned ? 'Scanned Image Page' : 'Digital Text Layer'} ·{' '}
                        {currentPageObj.ocrApplied ? 'Vision OCR Applied' : 'Native Text'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {currentPageObj.diagramSummary && (
                        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 p-3 text-xs space-y-1">
                          <p className="font-semibold text-blue-800 dark:text-blue-300">
                            Drawing / Diagram Interpretation (Page {currentPageObj.pageNumber})
                          </p>
                          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {currentPageObj.diagramSummary}
                          </p>
                        </div>
                      )}
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono max-h-[340px] overflow-y-auto whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                        {currentPageObj.text || '[No readable text extracted on this page]'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Editable Tables, Technical Specifications & Exports */}
          {tab === 'tables' && activeDoc && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {language === 'bn'
                      ? 'এক্সট্রাক্টেড টেবিল সম্পাদনা ও এক্সপোর্ট'
                      : 'Extracted Structured Tables & Multi-Format Export'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Edit any extracted table cell below before exporting to Excel, CSV, JSON, or PDF Report.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tablesDirty && (
                    <button
                      type="button"
                      onClick={async () => {
                        await updatePdfExtractedTables(activeDoc.id, editingTables);
                        setTablesDirty(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Table Edits</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => exportPdfIntelligenceToExcel({ ...activeDoc, extractedTables: editingTables })}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportTablesToCsv(editingTables, activeDoc.title)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportDocumentToJson({ ...activeDoc, extractedTables: editingTables })}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateAiDocumentReport}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>PDF Report</span>
                  </button>
                </div>
              </div>

              {editingTables.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500">
                  No structured tables extracted from this PDF. Use "Ask PDF AI" to convert extracted info into a custom table.
                </div>
              ) : (
                editingTables.map((tbl, tIdx) => (
                  <div
                    key={tbl.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {tbl.title} <span className="text-slate-500 font-normal">· Page {tbl.page}</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const next = editingTables.map((item, idx) =>
                            idx === tIdx
                              ? { ...item, rows: [...item.rows, new Array(item.headers.length).fill('')] }
                              : item
                          );
                          setEditingTables(next);
                          setTablesDirty(true);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Row</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800">
                            {tbl.headers.map((h, hIdx) => (
                              <th key={hIdx} className="p-1.5 font-semibold text-slate-600 dark:text-slate-300">
                                {h}
                              </th>
                            ))}
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {tbl.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {tbl.headers.map((_, cIdx) => (
                                <td key={cIdx} className="p-1">
                                  <input
                                    type="text"
                                    value={row[cIdx] ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const next = editingTables.map((item, ti) => {
                                        if (ti !== tIdx) return item;
                                        const nextRows = item.rows.map((rw, ri) => {
                                          if (ri !== rIdx) return rw;
                                          const copy = [...rw];
                                          copy[cIdx] = val;
                                          return copy;
                                        });
                                        return { ...item, rows: nextRows };
                                      });
                                      setEditingTables(next);
                                      setTablesDirty(true);
                                    }}
                                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-mono-tabular"
                                  />
                                </td>
                              ))}
                              <td className="p-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = editingTables.map((item, ti) =>
                                      ti === tIdx
                                        ? { ...item, rows: item.rows.filter((_, ri) => ri !== rIdx) }
                                        : item
                                    );
                                    setEditingTables(next);
                                    setTablesDirty(true);
                                  }}
                                  className="text-slate-400 hover:text-red-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}

              {/* Technical Specifications Table */}
              {(activeDoc.extractedSpecs || []).length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Technical Specifications ({activeDoc.extractedSpecs!.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="py-2 pr-3">Category</th>
                          <th className="py-2 pr-3">Parameter</th>
                          <th className="py-2 pr-3">Value</th>
                          <th className="py-2 pr-3">Unit</th>
                          <th className="py-2">Page</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {activeDoc.extractedSpecs!.map((s, idx) => (
                          <tr key={idx}>
                            <td className="py-2 pr-3 text-slate-500">{s.category}</td>
                            <td className="py-2 pr-3 font-medium">{s.parameter}</td>
                            <td className="py-2 pr-3 font-mono-tabular">{s.value}</td>
                            <td className="py-2 pr-3">{s.unit || '-'}</td>
                            <td className="py-2 tabular-nums">p.{s.page}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI Calculation Integration */}
          {tab === 'calc-bridge' && activeDoc && (
            <PdfCalculatorBridgePanel docItem={activeDoc} />
          )}

          {/* TAB 4: Ask Questions About PDF */}
          {tab === 'chat' && (
            <PdfChatPanel
              docs={pdfDocuments}
              activeDoc={activeDoc}
              pagesByDocId={pagesByDocId}
              ensurePagesLoaded={ensurePagesLoaded}
              onJumpToPage={(docId, pageNum) => {
                setSelectedDocId(docId);
                setActivePageNum(pageNum);
                setTab('overview');
              }}
            />
          )}

          {/* TAB 5: Multi-Document Comparison */}
          {tab === 'compare' && (
            <PdfComparePanel docs={pdfDocuments} ensurePagesLoaded={ensurePagesLoaded} />
          )}
        </div>
      </div>
    </div>
  );
};
