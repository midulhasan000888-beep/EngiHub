import React, { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  ArrowUpZA,
  BarChart3,
  Bold,
  CheckCircle2,
  ClipboardPaste,
  Columns3,
  Copy,
  Download,
  FilePlus2,
  FileSpreadsheet,
  Filter,
  FolderOpen,
  HelpCircle,
  Italic,
  LayoutTemplate,
  Merge,
  Palette,
  Plus,
  Printer,
  Redo2,
  Rows3,
  Save,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Underline,
  Undo2,
  Upload,
  WrapText,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  SpreadsheetCellData,
  SpreadsheetCellStyle,
  SpreadsheetChartConfig,
  SpreadsheetConditionalRule,
  SpreadsheetNumberFormat,
  SpreadsheetTemplateRecord,
  SpreadsheetValidationRule,
  SpreadsheetWorkbookRecord,
  SpreadsheetWorksheet,
} from '../../types';
import {
  colIndexToLetter,
  createBlankWorksheet,
  evaluateConditionalStyle,
  evaluateWorkbook,
  exportSheetToCsv,
  exportWorkbookToXlsx,
  formatCellKey,
  importXlsxOrCsvFile,
  parseCellRef,
} from '../../engine/spreadsheetEngine';
import { SEED_SPREADSHEET_TEMPLATES } from '../../data/seedSpreadsheetTemplates';
import { SpreadsheetChartModal } from './SpreadsheetChartModal';

type TabView = 'editor' | 'templates' | 'saved';

const QUICK_FUNCTIONS = [
  '=SUM(A2:A10)',
  '=AVERAGE(B2:B10)',
  '=IF(C2>100,"HIGH","OK")',
  '=MAX(B2:B10)',
  '=MIN(B2:B10)',
  '=COUNTIF(D2:D10,"PASS")',
  '=SUMIF(A2:A10,"Pump",B2:B10)',
  '=ROUND(B2*1.15,2)',
  '=VLOOKUP(A2,A2:D10,3,FALSE)',
];

function createEmptyWorkbook(lang: 'en' | 'bn'): Omit<SpreadsheetWorkbookRecord, 'id' | 'userId'> {
  const s1 = createBlankWorksheet('sheet-1', 'Sheet1', 30, 12);
  return {
    title: lang === 'bn' ? 'নতুন স্প্রেডশিট' : 'Untitled Workbook',
    category: 'general',
    activeSheetId: s1.id,
    sheets: [s1],
    sharedWithLink: false,
  };
}

export const ExcelGeneratorView: React.FC = () => {
  const {
    user,
    language,
    spreadsheets,
    spreadsheetTemplates,
    spreadsheetHistory,
    pendingExcelPush,
    setPendingExcelPush,
    saveSpreadsheetWorkbook,
    deleteSpreadsheetWorkbook,
    recordSpreadsheetHistory,
    logUserExport,
    showToast,
  } = useApp();

  const [tab, setTab] = useState<TabView>('editor');
  const [workbookId, setWorkbookId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState(() => (language === 'bn' ? 'নতুন স্প্রেডশিট' : 'Untitled Workbook'));
  const [category, setCategory] = useState('engineering');
  const [sheets, setSheets] = useState<SpreadsheetWorksheet[]>(() => createEmptyWorkbook(language).sheets);
  const [activeSheetId, setActiveSheetId] = useState<string>('sheet-1');

  // Undo / Redo history
  const [undoStack, setUndoStack] = useState<SpreadsheetWorksheet[][]>([]);
  const [redoStack, setRedoStack] = useState<SpreadsheetWorksheet[][]>([]);

  // Selection state
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [rangeEnd, setRangeEnd] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [formulaBarText, setFormulaBarText] = useState('');
  const [clipboardCells, setClipboardCells] = useState<{
    rows: number;
    cols: number;
    data: Array<Array<SpreadsheetCellData | undefined>>;
    isCut: boolean;
    sourceKeys: string[];
  } | null>(null);

  // Filters, Find & Replace, Modals
  const [rowFilterText, setRowFilterText] = useState('');
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showCondModal, setShowCondModal] = useState(false);
  const [showValModal, setShowValModal] = useState(false);
  const [showFnHelp, setShowFnHelp] = useState(false);
  const [chartModalTarget, setChartModalTarget] = useState<{ open: boolean; chart: SpreadsheetChartConfig | null }>({
    open: false,
    chart: null,
  });

  // Conditional Rule Draft
  const [condRange, setCondRange] = useState('B2:B20');
  const [condOp, setCondOp] = useState<SpreadsheetConditionalRule['operator']>('gt');
  const [condVal, setCondVal] = useState('100');
  const [condBg, setCondBg] = useState('#fef3c7');
  const [condFont, setCondFont] = useState('#92400e');

  // Validation Rule Draft
  const [valType, setValType] = useState<SpreadsheetValidationRule['type']>('number_range');
  const [valListStr, setValListStr] = useState('PASS,CHECK,FAIL');
  const [valMin, setValMin] = useState('0');
  const [valMax, setValMax] = useState('10000');

  // Rename Sheet State
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSheet = useMemo(
    () => sheets.find((s) => s.id === activeSheetId) || sheets[0],
    [sheets, activeSheetId]
  );

  // Merge built-in + Firestore templates
  const allTemplates = useMemo<SpreadsheetTemplateRecord[]>(() => {
    const byId = new Map<string, SpreadsheetTemplateRecord>();
    for (const tpl of SEED_SPREADSHEET_TEMPLATES) byId.set(tpl.id, tpl);
    for (const tpl of spreadsheetTemplates) byId.set(tpl.id, tpl);
    return Array.from(byId.values()).filter((t) => t.enabled);
  }, [spreadsheetTemplates]);

  // Evaluate entire workbook formulas safely without eval()
  const evalResults = useMemo(() => evaluateWorkbook(sheets), [sheets]);
  const activeEval = evalResults[activeSheet.id] || { values: {}, formatted: {} };

  const activeCellKey = formatCellKey(selectedCell.row, selectedCell.col);
  const activeCellData = activeSheet.cells[activeCellKey];

  useEffect(() => {
    setFormulaBarText(activeCellData?.raw ?? '');
  }, [activeCellKey, activeSheet.id, activeCellData?.raw]);

  // Handle "Send to Excel" push from Calculators / Formula Studio / Currency / School Library
  useEffect(() => {
    if (!pendingExcelPush) return;
    const sheetId = `sheet-calc-${Date.now()}`;
    const cells: Record<string, SpreadsheetCellData> = {};
    pendingExcelPush.headers.forEach((h, c) => {
      cells[formatCellKey(0, c)] = {
        raw: h,
        style: { bold: true, bgColor: '#1d4ed8', fontColor: '#ffffff', border: true, align: 'center' },
      };
    });
    pendingExcelPush.rows.forEach((row, rIdx) => {
      row.forEach((val, cIdx) => {
        cells[formatCellKey(rIdx + 1, cIdx)] = {
          raw: val,
          style: { border: true, align: val.startsWith('=') || /^\d/.test(val) ? 'right' : 'left' },
        };
      });
    });
    const newSheet: SpreadsheetWorksheet = {
      id: sheetId,
      name: pendingExcelPush.sheetName.slice(0, 28) || 'Calculation',
      rowCount: Math.max(25, pendingExcelPush.rows.length + 10),
      colCount: Math.max(10, pendingExcelPush.headers.length + 3),
      freezeRows: 1,
      freezeCols: 0,
      cells,
      merges: [],
      conditionalRules: [],
      charts: [],
    };
    setWorkbookId(undefined);
    setTitle(pendingExcelPush.title);
    setSheets([newSheet]);
    setActiveSheetId(sheetId);
    setSelectedCell({ row: 0, col: 0 });
    setRangeEnd({ row: 0, col: 0 });
    setTab('editor');
    setPendingExcelPush(null);
    showToast(
      language === 'bn' ? 'হিসাবের ডেটা এক্সেল শিটে পাঠানো হয়েছে!' : 'Calculation data loaded into Excel Sheet.',
      'success'
    );
  }, [pendingExcelPush, setPendingExcelPush, language, showToast]);

  const commitSheetsChange = (updater: (prev: SpreadsheetWorksheet[]) => SpreadsheetWorksheet[]) => {
    setUndoStack((u) => [...u.slice(-39), JSON.parse(JSON.stringify(sheets))]);
    setRedoStack([]);
    setSheets((prev) => updater(prev));
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, JSON.parse(JSON.stringify(sheets))]);
    setUndoStack((u) => u.slice(0, -1));
    setSheets(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, JSON.parse(JSON.stringify(sheets))]);
    setRedoStack((r) => r.slice(0, -1));
    setSheets(next);
  };

  const selectionBounds = useMemo(() => {
    return {
      rMin: Math.min(selectedCell.row, rangeEnd.row),
      rMax: Math.max(selectedCell.row, rangeEnd.row),
      cMin: Math.min(selectedCell.col, rangeEnd.col),
      cMax: Math.max(selectedCell.col, rangeEnd.col),
    };
  }, [selectedCell, rangeEnd]);

  const getSelectedKeys = (): string[] => {
    const keys: string[] = [];
    for (let r = selectionBounds.rMin; r <= selectionBounds.rMax; r++) {
      for (let c = selectionBounds.cMin; c <= selectionBounds.cMax; c++) {
        keys.push(formatCellKey(r, c));
      }
    }
    return keys;
  };

  const validateCellValue = (val: string, rule?: SpreadsheetValidationRule): string | null => {
    if (!rule) return null;
    if (rule.type === 'required' && val.trim() === '') {
      return language === 'bn' ? 'এই ঘরটি খালি রাখা যাবে না।' : 'This cell is required.';
    }
    if (rule.type === 'list' && rule.listOptions && rule.listOptions.length > 0 && val.trim() !== '') {
      if (!rule.listOptions.some((opt) => opt.toLowerCase() === val.trim().toLowerCase())) {
        return language === 'bn'
          ? `অনুমোদিত মান: ${rule.listOptions.join(', ')}`
          : `Allowed values: ${rule.listOptions.join(', ')}`;
      }
    }
    if (rule.type === 'number_range' && val.trim() !== '' && !val.startsWith('=')) {
      const n = Number(val);
      if (!Number.isFinite(n)) {
        return language === 'bn' ? 'সঠিক সংখ্যা লিখুন।' : 'Must be a valid number.';
      }
      if (rule.min !== undefined && n < rule.min) {
        return `Minimum allowed value is ${rule.min}`;
      }
      if (rule.max !== undefined && n > rule.max) {
        return `Maximum allowed value is ${rule.max}`;
      }
    }
    return null;
  };

  const updateCellRaw = (row: number, col: number, newRaw: string) => {
    const key = formatCellKey(row, col);
    const existing = activeSheet.cells[key];
    const validationErr = validateCellValue(newRaw, existing?.validation);
    if (validationErr) {
      showToast(validationErr, 'error');
      return;
    }
    commitSheetsChange((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheet.id) return s;
        const nextCells = { ...s.cells };
        if (newRaw === '' && !existing?.style && !existing?.validation) {
          delete nextCells[key];
        } else {
          nextCells[key] = { ...existing, raw: newRaw };
        }
        return { ...s, cells: nextCells };
      })
    );
  };

  const applyStyleToSelection = (stylePatch: Partial<SpreadsheetCellStyle>) => {
    const keys = getSelectedKeys();
    commitSheetsChange((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheet.id) return s;
        const nextCells = { ...s.cells };
        for (const k of keys) {
          const cur = nextCells[k] || { raw: '' };
          nextCells[k] = {
            ...cur,
            style: { ...cur.style, ...stylePatch },
          };
        }
        return { ...s, cells: nextCells };
      })
    );
  };

  // Worksheet Operations
  const handleAddSheet = () => {
    const newId = `sheet-${Date.now()}`;
    const newName = `Sheet${sheets.length + 1}`;
    const blank = createBlankWorksheet(newId, newName, 30, 12);
    commitSheetsChange((prev) => [...prev, blank]);
    setActiveSheetId(newId);
  };

  const handleDuplicateSheet = () => {
    const newId = `sheet-${Date.now()}`;
    const copy: SpreadsheetWorksheet = {
      ...JSON.parse(JSON.stringify(activeSheet)),
      id: newId,
      name: `${activeSheet.name.slice(0, 22)} Copy`,
    };
    commitSheetsChange((prev) => [...prev, copy]);
    setActiveSheetId(newId);
  };

  const handleDeleteSheet = (sheetId: string) => {
    if (sheets.length <= 1) {
      showToast(language === 'bn' ? 'অন্তত একটি ওয়ার্কশিট থাকতে হবে।' : 'At least one worksheet is required.', 'error');
      return;
    }
    const remaining = sheets.filter((s) => s.id !== sheetId);
    commitSheetsChange(() => remaining);
    if (activeSheetId === sheetId) {
      setActiveSheetId(remaining[0].id);
    }
  };

  const handleCommitRenameSheet = () => {
    if (!renamingSheetId || !renameValue.trim()) {
      setRenamingSheetId(null);
      return;
    }
    const clean = renameValue.trim().slice(0, 30);
    commitSheetsChange((prev) =>
      prev.map((s) => (s.id === renamingSheetId ? { ...s, name: clean } : s))
    );
    setRenamingSheetId(null);
  };

  // Insert / Delete Rows & Columns
  const handleInsertRow = () => {
    const targetRow = selectedCell.row;
    commitSheetsChange((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheet.id) return s;
        const shifted: Record<string, SpreadsheetCellData> = {};
        for (const [k, cell] of Object.entries(s.cells)) {
          const parsed = parseCellRef(k);
          if (!parsed) continue;
          const nextRow = parsed.row >= targetRow ? parsed.row + 1 : parsed.row;
          shifted[formatCellKey(nextRow, parsed.col)] = cell;
        }
        return { ...s, rowCount: s.rowCount + 1, cells: shifted };
      })
    );
  };

  const handleDeleteRow = () => {
    if (activeSheet.rowCount <= 5) return;
    const targetRow = selectedCell.row;
    commitSheetsChange((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheet.id) return s;
        const shifted: Record<string, SpreadsheetCellData> = {};
        for (const [k, cell] of Object.entries(s.cells)) {
          const parsed = parseCellRef(k);
          if (!parsed || parsed.row === targetRow) continue;
          const nextRow = parsed.row > targetRow ? parsed.row - 1 : parsed.row;
          shifted[formatCellKey(nextRow, parsed.col)] = cell;
        }
        return { ...s, rowCount: s.rowCount - 1, cells: shifted };
      })
    );
  };

  const handleInsertCol = () => {
    const targetCol = selectedCell.col;
    commitSheetsChange((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheet.id) return s;
        const shifted: Record<string, SpreadsheetCellData> = {};
        for (const [k, cell] of Object.entries(s.cells)) {
          const parsed = parseCellRef(k);
          if (!parsed) continue;
          const nextCol = parsed.col >= targetCol ? parsed.col + 1 : parsed.col;
          shifted[formatCellKey(parsed.row, nextCol)] = cell;
        }
        return { ...s, colCount: s.colCount + 1, cells: shifted };
      })
    );
  };

  const handleDeleteCol = () => {
    if (activeSheet.colCount <= 3) return;
    const targetCol = selectedCell.col;
    commitSheetsChange((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheet.id) return s;
        const shifted: Record<string, SpreadsheetCellData> = {};
        for (const [k, cell] of Object.entries(s.cells)) {
          const parsed = parseCellRef(k);
          if (!parsed || parsed.col === targetCol) continue;
          const nextCol = parsed.col > targetCol ? parsed.col - 1 : parsed.col;
          shifted[formatCellKey(parsed.row, nextCol)] = cell;
        }
        return { ...s, colCount: s.colCount - 1, cells: shifted };
      })
    );
  };

  // Merge / Unmerge
  const handleToggleMerge = () => {
    const { rMin, rMax, cMin, cMax } = selectionBounds;
    const existingIdx = (activeSheet.merges || []).findIndex(
      (m) => m.startRow === rMin && m.startCol === cMin && m.endRow === rMax && m.endCol === cMax
    );
    commitSheetsChange((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheet.id) return s;
        const merges = [...(s.merges || [])];
        if (existingIdx !== -1) {
          merges.splice(existingIdx, 1);
        } else if (rMax > rMin || cMax > cMin) {
          merges.push({ startRow: rMin, startCol: cMin, endRow: rMax, endCol: cMax });
        }
        return { ...s, merges };
      })
    );
  };

  // Copy / Cut / Paste
  const handleCopyOrCut = (isCut: boolean) => {
    const { rMin, rMax, cMin, cMax } = selectionBounds;
    const data: Array<Array<SpreadsheetCellData | undefined>> = [];
    const sourceKeys: string[] = [];
    for (let r = rMin; r <= rMax; r++) {
      const rowData: Array<SpreadsheetCellData | undefined> = [];
      for (let c = cMin; c <= cMax; c++) {
        const k = formatCellKey(r, c);
        sourceKeys.push(k);
        rowData.push(activeSheet.cells[k] ? JSON.parse(JSON.stringify(activeSheet.cells[k])) : undefined);
      }
      data.push(rowData);
    }
    setClipboardCells({ rows: rMax - rMin + 1, cols: cMax - cMin + 1, data, isCut, sourceKeys });
    showToast(isCut ? (language === 'bn' ? 'কাট করা হয়েছে' : 'Cut to clipboard') : (language === 'bn' ? 'কপি করা হয়েছে' : 'Copied to clipboard'), 'info');
  };

  const handlePaste = () => {
    if (!clipboardCells) return;
    commitSheetsChange((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheet.id) return s;
        const nextCells = { ...s.cells };
        if (clipboardCells.isCut) {
          for (const k of clipboardCells.sourceKeys) delete nextCells[k];
        }
        for (let r = 0; r < clipboardCells.rows; r++) {
          for (let c = 0; c < clipboardCells.cols; c++) {
            const targetKey = formatCellKey(selectedCell.row + r, selectedCell.col + c);
            const cell = clipboardCells.data[r]?.[c];
            if (cell) nextCells[targetKey] = JSON.parse(JSON.stringify(cell));
          }
        }
        return { ...s, cells: nextCells };
      })
    );
  };

  // Sort active column (skips header row 0)
  const handleSortColumn = (ascending: boolean) => {
    const sortCol = selectedCell.col;
    const rowsData: Array<{ rowIdx: number; sortKey: string | number; rowCells: Array<SpreadsheetCellData | undefined> }> = [];
    for (let r = 1; r < activeSheet.rowCount; r++) {
      const rowCells: Array<SpreadsheetCellData | undefined> = [];
      let hasAny = false;
      for (let c = 0; c < activeSheet.colCount; c++) {
        const cell = activeSheet.cells[formatCellKey(r, c)];
        if (cell?.raw) hasAny = true;
        rowCells.push(cell);
      }
      if (hasAny) {
        const val = activeEval.values[formatCellKey(r, sortCol)] ?? '';
        rowsData.push({ rowIdx: r, sortKey: typeof val === 'boolean' ? String(val) : val, rowCells });
      }
    }
    rowsData.sort((a, b) => {
      const an = Number(a.sortKey);
      const bn = Number(b.sortKey);
      if (String(a.sortKey) !== '' && String(b.sortKey) !== '' && Number.isFinite(an) && Number.isFinite(bn)) {
        return ascending ? an - bn : bn - an;
      }
      return ascending
        ? String(a.sortKey).localeCompare(String(b.sortKey))
        : String(b.sortKey).localeCompare(String(a.sortKey));
    });
    commitSheetsChange((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheet.id) return s;
        const nextCells: Record<string, SpreadsheetCellData> = {};
        // Keep header row 0
        for (let c = 0; c < s.colCount; c++) {
          const hk = formatCellKey(0, c);
          if (s.cells[hk]) nextCells[hk] = s.cells[hk];
        }
        rowsData.forEach((item, idx) => {
          item.rowCells.forEach((cell, c) => {
            if (cell) nextCells[formatCellKey(idx + 1, c)] = cell;
          });
        });
        return { ...s, cells: nextCells };
      })
    );
  };

  // Find & Replace
  const handleFindReplaceAll = () => {
    if (!findText) return;
    let count = 0;
    commitSheetsChange((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheet.id) return s;
        const nextCells = { ...s.cells };
        for (const [k, cell] of Object.entries(nextCells)) {
          if (cell.raw && cell.raw.includes(findText)) {
            nextCells[k] = { ...cell, raw: cell.raw.split(findText).join(replaceText) };
            count++;
          }
        }
        return { ...s, cells: nextCells };
      })
    );
    showToast(language === 'bn' ? `${count}টি ঘর পরিবর্তন করা হয়েছে।` : `Replaced in ${count} cell(s).`, 'success');
  };

  // Cloud Save
  const handleSaveWorkbook = async () => {
    if (!user) {
      showToast(language === 'bn' ? 'ক্লাউডে সেভ করতে অনুগ্রহ করে সাইন-ইন করুন।' : 'Sign in to save spreadsheets to cloud.', 'info');
      return;
    }
    const savedId = await saveSpreadsheetWorkbook({
      id: workbookId,
      title: title.trim() || 'Untitled Workbook',
      category,
      activeSheetId: activeSheet.id,
      sheets,
      sharedWithLink: false,
    });
    if (savedId) {
      setWorkbookId(savedId);
      await recordSpreadsheetHistory({
        spreadsheetId: savedId,
        title: title.trim() || 'Untitled Workbook',
        action: workbookId ? 'save' : 'create',
        summary: `${sheets.length} sheet(s)`,
      });
    }
  };

  // Load Template or Saved Workbook
  const handleUseTemplate = (tpl: SpreadsheetTemplateRecord) => {
    const clonedSheets: SpreadsheetWorksheet[] = JSON.parse(JSON.stringify(tpl.sheets));
    setWorkbookId(undefined);
    setTitle(language === 'bn' ? tpl.nameBn : tpl.nameEn);
    setCategory(tpl.category);
    setSheets(clonedSheets);
    setActiveSheetId(clonedSheets[0].id);
    setUndoStack([]);
    setRedoStack([]);
    setTab('editor');
    showToast(language === 'bn' ? `"${tpl.nameBn}" টেমপ্লেট লোড হয়েছে।` : `Loaded template "${tpl.nameEn}".`, 'success');
  };

  const handleLoadWorkbook = (wb: SpreadsheetWorkbookRecord) => {
    const clonedSheets: SpreadsheetWorksheet[] = JSON.parse(JSON.stringify(wb.sheets));
    setWorkbookId(wb.id);
    setTitle(wb.title);
    setCategory(wb.category);
    setSheets(clonedSheets);
    setActiveSheetId(wb.activeSheetId || clonedSheets[0]?.id || '');
    setUndoStack([]);
    setRedoStack([]);
    setTab('editor');
  };

  const handleNewBlank = () => {
    const blank = createEmptyWorkbook(language);
    setWorkbookId(undefined);
    setTitle(blank.title);
    setSheets(blank.sheets);
    setActiveSheetId(blank.activeSheetId);
    setUndoStack([]);
    setRedoStack([]);
    setTab('editor');
  };

  // Exports & Imports
  const handleExportXlsx = async () => {
    const wbRecord: SpreadsheetWorkbookRecord = {
      id: workbookId || 'local',
      userId: user?.uid || 'guest',
      title,
      category,
      activeSheetId: activeSheet.id,
      sheets,
      sharedWithLink: false,
    };
    exportWorkbookToXlsx(wbRecord, evalResults);
    if (user) {
      await recordSpreadsheetHistory({
        spreadsheetId: workbookId || 'local',
        title,
        action: 'export_xlsx',
        summary: `Exported .xlsx (${sheets.length} sheets)`,
      });
      await logUserExport({ module: 'excel', title, format: 'xlsx' });
    }
  };

  const handleExportCsv = async () => {
    exportSheetToCsv(activeSheet, activeEval, title);
    if (user) {
      await logUserExport({ module: 'excel', title: `${title} - ${activeSheet.name}`, format: 'csv' });
    }
  };

  const handleExportPdf = async () => {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.setFontSize(14);
    pdf.text(`${title} — ${activeSheet.name}`, 14, 15);
    pdf.setFontSize(9);
    pdf.text(`SUTRO SATHI Excel Studio · Generated ${new Date().toLocaleDateString()}`, 14, 21);

    let maxUsedRow = 0;
    let maxUsedCol = 0;
    for (const k of Object.keys(activeSheet.cells)) {
      const p = parseCellRef(k);
      if (p) {
        if (p.row > maxUsedRow) maxUsedRow = p.row;
        if (p.col > maxUsedCol) maxUsedCol = p.col;
      }
    }
    const colsToShow = Math.min(maxUsedCol + 1, 10);
    const colWidth = (297 - 28) / Math.max(1, colsToShow);

    let y = 28;
    for (let r = 0; r <= maxUsedRow; r++) {
      if (y > 192) {
        pdf.addPage();
        y = 18;
      }
      if (r === 0) {
        pdf.setFillColor(29, 78, 216);
        pdf.rect(14, y - 4, 297 - 28, 7, 'F');
        pdf.setTextColor(255, 255, 255);
      } else {
        pdf.setTextColor(15, 23, 42);
      }
      for (let c = 0; c < colsToShow; c++) {
        const txt = String(activeEval.formatted[formatCellKey(r, c)] ?? '').slice(0, 22);
        pdf.text(txt, 15 + c * colWidth, y);
      }
      pdf.setDrawColor(226, 232, 240);
      pdf.line(14, y + 2, 297 - 14, y + 2);
      y += 7;
    }
    pdf.save(`${title.replace(/\s+/g, '_') || 'sheet'}.pdf`);
    if (user) {
      await logUserExport({ module: 'excel', title, format: 'pdf' });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const importedSheets = await importXlsxOrCsvFile(file);
      if (importedSheets.length > 0) {
        setWorkbookId(undefined);
        setTitle(file.name.replace(/\.(xlsx|xls|csv)$/i, ''));
        setSheets(importedSheets);
        setActiveSheetId(importedSheets[0].id);
        showToast(language === 'bn' ? 'ফাইল সফলভাবে ইমপোর্ট হয়েছে!' : 'Spreadsheet imported cleanly.', 'success');
      }
    } catch {
      showToast(language === 'bn' ? 'ফাইল ইমপোর্ট ব্যর্থ হয়েছে।' : 'Failed to parse Excel/CSV file.', 'error');
    }
    e.target.value = '';
  };

  // Merge helpers for rendering
  const getMergeForCell = (r: number, c: number) => {
    for (const m of activeSheet.merges || []) {
      if (r >= m.startRow && r <= m.endRow && c >= m.startCol && c <= m.endCol) {
        return {
          isAnchor: r === m.startRow && c === m.startCol,
          rowSpan: m.endRow - m.startRow + 1,
          colSpan: m.endCol - m.startCol + 1,
        };
      }
    }
    return null;
  };

  const visibleRowIndices = useMemo(() => {
    const q = rowFilterText.trim().toLowerCase();
    const indices: number[] = [];
    for (let r = 0; r < activeSheet.rowCount; r++) {
      if (!q || r === 0) {
        indices.push(r);
        continue;
      }
      let matches = false;
      for (let c = 0; c < activeSheet.colCount; c++) {
        const k = formatCellKey(r, c);
        const f = (activeEval.formatted[k] || '').toLowerCase();
        if (f.includes(q)) {
          matches = true;
          break;
        }
      }
      if (matches) indices.push(r);
    }
    return indices;
  }, [activeSheet, activeEval, rowFilterText]);

  const activeStyle = activeCellData?.style || {};

  return (
    <div className="space-y-4">
      {/* Module Header */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {language === 'bn' ? 'অ্যাডভান্সড এক্সেল শিট জেনারেটর' : 'Advanced Excel Sheet Generator'}
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {language === 'bn'
              ? 'ফর্মুলা ইঞ্জিন, মাল্টি-শিট, কন্ডিশনাল ফরম্যাটিং, ৭ ধরনের চার্ট ও .xlsx / .csv / PDF এক্সপোর্ট।'
              : 'Multi-sheet spreadsheet editor with safe formula engine, charts, conditional formatting, and XLSX/CSV/PDF exports.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('editor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              tab === 'editor'
                ? 'bg-blue-700 text-white'
                : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {language === 'bn' ? 'স্প্রেডশিট এডিটর' : 'Editor'}
          </button>
          <button
            type="button"
            onClick={() => setTab('templates')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              tab === 'templates'
                ? 'bg-blue-700 text-white'
                : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? `টেমপ্লেট (${allTemplates.length})` : `Templates (${allTemplates.length})`}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('saved')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              tab === 'saved'
                ? 'bg-blue-700 text-white'
                : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? `সংরক্ষিত (${spreadsheets.length})` : `Saved (${spreadsheets.length})`}</span>
          </button>
        </div>
      </div>

      {/* TEMPLATES VIEW */}
      {tab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                    {tpl.category}
                  </span>
                  {tpl.recommended && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                      <Sparkles className="w-3 h-3" />
                      {language === 'bn' ? 'জনপ্রিয়' : 'Popular'}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'bn' ? tpl.nameBn : tpl.nameEn}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {language === 'bn' ? tpl.descriptionBn : tpl.descriptionEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleUseTemplate(tpl)}
                className="w-full rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
              >
                {language === 'bn' ? 'টেমপ্লেট ব্যবহার করুন' : 'Open Template'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SAVED WORKBOOKS VIEW */}
      {tab === 'saved' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'bn' ? 'আপনার ক্লাউড স্প্রেডশিটসমূহ' : 'Saved Cloud Spreadsheets'}
            </h2>
            {!user ? (
              <p className="text-xs text-slate-500">
                {language === 'bn' ? 'সংরক্ষিত শিট দেখতে সাইন-ইন করুন।' : 'Sign in to view your saved cloud spreadsheets.'}
              </p>
            ) : spreadsheets.length === 0 ? (
              <p className="text-xs text-slate-500">
                {language === 'bn' ? 'এখনো কোনো স্প্রেডশিট সংরক্ষণ করা হয়নি।' : 'No saved spreadsheets yet.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {spreadsheets.map((wb) => (
                  <div
                    key={wb.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{wb.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {wb.sheets.length} {language === 'bn' ? 'টি শিট' : 'sheet(s)'} · {wb.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadWorkbook(wb)}
                        className="flex-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
                      >
                        {language === 'bn' ? 'লোড করুন' : 'Open'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSpreadsheetWorkbook(wb.id)}
                        className="p-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        aria-label="Delete spreadsheet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {spreadsheetHistory.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {language === 'bn' ? 'সাম্প্রতিক কার্যক্রম' : 'Recent Activity'}
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {spreadsheetHistory.slice(0, 8).map((h) => (
                  <div key={h.id} className="py-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{h.title}</span>
                    <span className="text-slate-500">{h.action} · {h.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EDITOR VIEW */}
      {tab === 'editor' && (
        <div className="space-y-3">
          {/* File & Export Bar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-2 no-print">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Workbook Title"
                className="w-52 sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleNewBlank}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'নতুন' : 'New'}</span>
              </button>
              <button
                type="button"
                onClick={handleSaveWorkbook}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'সংরক্ষণ' : 'Save'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'ইমপোর্ট' : 'Import'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportXlsx}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.XLSX</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span>.CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span>.PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Formatting & Editing Ribbon */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 space-y-2 no-print">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Undo / Redo / Clipboard */}
              <button type="button" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo" className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo" className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => handleCopyOrCut(false)} title="Copy" className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => handleCopyOrCut(true)} title="Cut" className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <Scissors className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={handlePaste} disabled={!clipboardCells} title="Paste" className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <ClipboardPaste className="w-3.5 h-3.5" />
              </button>

              <span className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

              {/* Font & Style */}
              <button
                type="button"
                onClick={() => applyStyleToSelection({ bold: !activeStyle.bold })}
                className={`p-1.5 rounded border cursor-pointer ${activeStyle.bold ? 'bg-blue-100 border-blue-400 text-blue-800' : 'border-slate-200 dark:border-slate-700'}`}
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyStyleToSelection({ italic: !activeStyle.italic })}
                className={`p-1.5 rounded border cursor-pointer ${activeStyle.italic ? 'bg-blue-100 border-blue-400 text-blue-800' : 'border-slate-200 dark:border-slate-700'}`}
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyStyleToSelection({ underline: !activeStyle.underline })}
                className={`p-1.5 rounded border cursor-pointer ${activeStyle.underline ? 'bg-blue-100 border-blue-400 text-blue-800' : 'border-slate-200 dark:border-slate-700'}`}
                title="Underline"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>

              <select
                value={activeStyle.fontSize || 12}
                onChange={(e) => applyStyleToSelection({ fontSize: Number(e.target.value) })}
                aria-label="Font size"
                className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-1 text-xs"
              >
                {[10, 11, 12, 14, 16, 18].map((sz) => (
                  <option key={sz} value={sz}>{sz}px</option>
                ))}
              </select>

              <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5" title="Text Color">
                <span>A</span>
                <input type="color" value={activeStyle.fontColor || '#0f172a'} onChange={(e) => applyStyleToSelection({ fontColor: e.target.value })} className="w-4 h-4 border-0 p-0 cursor-pointer" />
              </label>

              <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5" title="Fill Color">
                <Palette className="w-3 h-3" />
                <input type="color" value={activeStyle.bgColor || '#ffffff'} onChange={(e) => applyStyleToSelection({ bgColor: e.target.value })} className="w-4 h-4 border-0 p-0 cursor-pointer" />
              </label>

              {/* Alignment & Wrap & Borders */}
              <button type="button" onClick={() => applyStyleToSelection({ align: 'left' })} className="p-1.5 rounded border border-slate-200 dark:border-slate-700 cursor-pointer" title="Align Left">
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => applyStyleToSelection({ align: 'center' })} className="p-1.5 rounded border border-slate-200 dark:border-slate-700 cursor-pointer" title="Align Center">
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => applyStyleToSelection({ align: 'right' })} className="p-1.5 rounded border border-slate-200 dark:border-slate-700 cursor-pointer" title="Align Right">
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => applyStyleToSelection({ wrapText: !activeStyle.wrapText })} className={`p-1.5 rounded border cursor-pointer ${activeStyle.wrapText ? 'bg-blue-100 border-blue-400' : 'border-slate-200 dark:border-slate-700'}`} title="Wrap Text">
                <WrapText className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => applyStyleToSelection({ border: !activeStyle.border })} className={`px-2 py-1 rounded border text-[11px] cursor-pointer ${activeStyle.border ? 'bg-blue-100 border-blue-400 text-blue-800' : 'border-slate-200 dark:border-slate-700'}`}>
                Border
              </button>

              {/* Number Format */}
              <select
                value={activeStyle.numberFormat || 'general'}
                onChange={(e) => applyStyleToSelection({ numberFormat: e.target.value as SpreadsheetNumberFormat })}
                aria-label="Number format"
                className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs"
              >
                <option value="general">General</option>
                <option value="number">Number (0.00)</option>
                <option value="currency">Currency (৳)</option>
                <option value="percentage">Percentage (%)</option>
                <option value="date">Date</option>
              </select>

              <span className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

              {/* Structure & Data Tools */}
              <button type="button" onClick={handleToggleMerge} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <Merge className="w-3 h-3" />
                <span>{language === 'bn' ? 'মার্জ' : 'Merge'}</span>
              </button>
              <button type="button" onClick={handleInsertRow} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="Insert Row">
                <Rows3 className="w-3 h-3" />
                <span>+Row</span>
              </button>
              <button type="button" onClick={handleDeleteRow} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="Delete Row">
                <span>-Row</span>
              </button>
              <button type="button" onClick={handleInsertCol} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="Insert Column">
                <Columns3 className="w-3 h-3" />
                <span>+Col</span>
              </button>
              <button type="button" onClick={handleDeleteCol} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="Delete Column">
                <span>-Col</span>
              </button>
              <button type="button" onClick={() => handleSortColumn(true)} className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="Sort A-Z">
                <ArrowDownAZ className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => handleSortColumn(false)} className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="Sort Z-A">
                <ArrowUpZA className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setShowFindReplace((v) => !v)} className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="Find & Replace">
                <Search className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setShowValModal(true)} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>{language === 'bn' ? 'ভ্যালিডেশন' : 'Validation'}</span>
              </button>
              <button type="button" onClick={() => setShowCondModal(true)} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <span>{language === 'bn' ? 'কন্ডিশনাল' : 'Cond. Format'}</span>
              </button>
              <button
                type="button"
                onClick={() => setChartModalTarget({ open: true, chart: null })}
                className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'চার্ট তৈরি' : 'Insert Chart'}</span>
              </button>
            </div>

            {/* Filter + Formula Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono-tabular font-bold text-slate-800 dark:text-slate-100 min-w-[54px] text-center">
                  {activeCellKey}
                </span>
                <span className="text-xs font-serif italic font-bold text-blue-700 dark:text-blue-400 px-1">fx</span>
              </div>
              <input
                type="text"
                value={formulaBarText}
                onChange={(e) => {
                  setFormulaBarText(e.target.value);
                  updateCellRaw(selectedCell.row, selectedCell.col, e.target.value);
                }}
                placeholder={language === 'bn' ? 'মান বা ফর্মুলা লিখুন (যেমন =SUM(B2:B10))' : 'Enter value or formula (e.g. =SUM(B2:B10))'}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono-tabular text-slate-900 dark:text-slate-100"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="relative">
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={rowFilterText}
                    onChange={(e) => setRowFilterText(e.target.value)}
                    placeholder={language === 'bn' ? 'সারি ফিল্টার...' : 'Filter rows...'}
                    className="w-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-2 py-1.5 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFnHelp((v) => !v)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Formula Quick Reference"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {showFnHelp && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mr-1">
                  {language === 'bn' ? 'দ্রুত ফর্মুলা:' : 'Quick Formulas:'}
                </span>
                {QUICK_FUNCTIONS.map((fn) => (
                  <button
                    key={fn}
                    type="button"
                    onClick={() => updateCellRaw(selectedCell.row, selectedCell.col, fn)}
                    className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-blue-700 dark:text-blue-400 hover:border-blue-500 cursor-pointer"
                  >
                    {fn}
                  </button>
                ))}
              </div>
            )}

            {showFindReplace && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder={language === 'bn' ? 'খুঁজুন...' : 'Find...'}
                  className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs"
                />
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder={language === 'bn' ? 'প্রতিস্থাপন...' : 'Replace with...'}
                  className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={handleFindReplaceAll}
                  className="rounded bg-blue-700 px-3 py-1 text-xs font-medium text-white cursor-pointer"
                >
                  {language === 'bn' ? 'সব পরিবর্তন করুন' : 'Replace All'}
                </button>
                <button type="button" onClick={() => setShowFindReplace(false)} className="text-slate-500 p-1 cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Freeze Controls & Interactive Grid */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="overflow-auto max-h-[540px]">
              <table className="border-collapse text-xs select-none min-w-full">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-20">
                    <th className="w-10 min-w-[40px] border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-500 sticky left-0 z-30">
                      #
                    </th>
                    {Array.from({ length: activeSheet.colCount }).map((_, c) => (
                      <th
                        key={c}
                        className={`min-w-[104px] border border-slate-200 dark:border-slate-700 py-1 px-2 text-[11px] font-semibold ${
                          c >= selectionBounds.cMin && c <= selectionBounds.cMax
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {colIndexToLetter(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRowIndices.map((r) => {
                    const isFrozenRow = r < (activeSheet.freezeRows || 0);
                    return (
                      <tr key={r} className={isFrozenRow ? 'sticky top-6 z-10' : ''}>
                        <td
                          className={`border border-slate-200 dark:border-slate-700 text-center text-[11px] font-medium sticky left-0 z-10 ${
                            r >= selectionBounds.rMin && r <= selectionBounds.rMax
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {r + 1}
                        </td>
                        {Array.from({ length: activeSheet.colCount }).map((_, c) => {
                          const merge = getMergeForCell(r, c);
                          if (merge && !merge.isAnchor) return null;

                          const key = formatCellKey(r, c);
                          const cell = activeSheet.cells[key];
                          const isSelected = r === selectedCell.row && c === selectedCell.col;
                          const inRange =
                            r >= selectionBounds.rMin &&
                            r <= selectionBounds.rMax &&
                            c >= selectionBounds.cMin &&
                            c <= selectionBounds.cMax;

                          const evalScalar = activeEval.values[key] ?? '';
                          const formattedText = activeEval.formatted[key] ?? '';
                          const condOverride = evaluateConditionalStyle(
                            key,
                            evalScalar,
                            activeSheet.conditionalRules || []
                          );

                          const st = cell?.style || {};
                          const bgColor = condOverride?.bgColor || st.bgColor;
                          const fontColor = condOverride?.fontColor || st.fontColor;

                          return (
                            <td
                              key={key}
                              rowSpan={merge?.rowSpan}
                              colSpan={merge?.colSpan}
                              onClick={(e) => {
                                if (e.shiftKey) {
                                  setRangeEnd({ row: r, col: c });
                                } else {
                                  setSelectedCell({ row: r, col: c });
                                  setRangeEnd({ row: r, col: c });
                                }
                              }}
                              style={{
                                backgroundColor: bgColor || (inRange && !isSelected ? '#eff6ff' : undefined),
                                color: fontColor,
                                fontWeight: st.bold ? 700 : undefined,
                                fontStyle: st.italic ? 'italic' : undefined,
                                textDecoration: st.underline ? 'underline' : undefined,
                                fontSize: st.fontSize ? `${st.fontSize}px` : undefined,
                                textAlign: st.align || 'left',
                                whiteSpace: st.wrapText ? 'normal' : 'nowrap',
                              }}
                              className={`border min-w-[104px] max-w-[220px] p-0 relative ${
                                isSelected
                                  ? 'ring-2 ring-blue-700 ring-inset border-blue-700 z-10'
                                  : st.border
                                    ? 'border-slate-300 dark:border-slate-700'
                                    : 'border-slate-200/80 dark:border-slate-800'
                              }`}
                            >
                              {isSelected ? (
                                <input
                                  type="text"
                                  value={cell?.raw ?? ''}
                                  onChange={(e) => updateCellRaw(r, c, e.target.value)}
                                  className="w-full h-full px-2 py-1.5 bg-transparent focus:outline-none text-inherit font-inherit"
                                  style={{ textAlign: st.align || 'left' }}
                                />
                              ) : (
                                <div className="px-2 py-1.5 min-h-[28px] overflow-hidden text-ellipsis tabular-nums">
                                  {formattedText}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Worksheet Tabs Footer */}
            <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 flex flex-wrap items-center justify-between gap-2 no-print">
              <div className="flex flex-wrap items-center gap-1.5">
                {sheets.map((s) => (
                  <div key={s.id} className="inline-flex items-center">
                    {renamingSheetId === s.id ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleCommitRenameSheet}
                        onKeyDown={(e) => e.key === 'Enter' && handleCommitRenameSheet()}
                        autoFocus
                        className="w-24 rounded border border-blue-500 px-2 py-0.5 text-xs bg-white dark:bg-slate-900"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSheetId(s.id)}
                        onDoubleClick={() => {
                          setRenamingSheetId(s.id);
                          setRenameValue(s.name);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                          s.id === activeSheet.id
                            ? 'bg-blue-700 text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {s.name}
                      </button>
                    )}
                    {sheets.length > 1 && s.id === activeSheet.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSheet(s.id)}
                        className="ml-0.5 p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Delete Sheet"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddSheet}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'নতুন শিট' : 'Add Sheet'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDuplicateSheet}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                >
                  {language === 'bn' ? 'ডুপ্লিকেট' : 'Duplicate'}
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <label className="inline-flex items-center gap-1">
                  <span>{language === 'bn' ? 'ফ্রিজ সারি:' : 'Freeze Rows:'}</span>
                  <select
                    value={activeSheet.freezeRows || 0}
                    onChange={(e) =>
                      commitSheetsChange((prev) =>
                        prev.map((s) => (s.id === activeSheet.id ? { ...s, freezeRows: Number(e.target.value) } : s))
                      )
                    }
                    className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5"
                  >
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <span>{language === 'bn' ? 'ডাবল-ক্লিক করে রিনেম করুন' : 'Double-click tab to rename'}</span>
              </div>
            </div>
          </div>

          {/* Saved Charts Strip for Active Worksheet */}
          {(activeSheet.charts || []).length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {language === 'bn' ? 'এই শিটের চার্টসমূহ' : 'Worksheet Charts'}
                </h3>
                <button
                  type="button"
                  onClick={() => setChartModalTarget({ open: true, chart: null })}
                  className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  + {language === 'bn' ? 'নতুন চার্ট' : 'Add Chart'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(activeSheet.charts || []).map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setChartModalTarget({ open: true, chart: ch })}
                    className="text-left rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 hover:border-blue-500 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{ch.title}</p>
                      <p className="text-[11px] text-slate-500 uppercase">
                        {ch.type} · {ch.labelRange} / {ch.dataRange}
                      </p>
                    </div>
                    <BarChart3 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONDITIONAL FORMATTING MODAL */}
      {showCondModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'bn' ? 'কন্ডিশনাল ফরম্যাটিং' : 'Conditional Formatting'}
              </h3>
              <button type="button" onClick={() => setShowCondModal(false)} className="text-slate-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-medium">{language === 'bn' ? 'সেল রেঞ্জ' : 'Cell Range'}</label>
                <input type="text" value={condRange} onChange={(e) => setCondRange(e.target.value.toUpperCase())} className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 font-medium">Condition</label>
                  <select value={condOp} onChange={(e) => setCondOp(e.target.value as SpreadsheetConditionalRule['operator'])} className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5">
                    <option value="gt">&gt; Greater than</option>
                    <option value="lt">&lt; Less than</option>
                    <option value="gte">&gt;= Greater or equal</option>
                    <option value="lte">&lt;= Less or equal</option>
                    <option value="eq">= Equal to</option>
                    <option value="contains">Contains text</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Value</label>
                  <input type="text" value={condVal} onChange={(e) => setCondVal(e.target.value)} className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5">
                  <span>Fill</span>
                  <input type="color" value={condBg} onChange={(e) => setCondBg(e.target.value)} />
                </label>
                <label className="flex items-center justify-between border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5">
                  <span>Text</span>
                  <input type="color" value={condFont} onChange={(e) => setCondFont(e.target.value)} />
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newRule: SpreadsheetConditionalRule = {
                    id: `cf-${Date.now()}`,
                    range: condRange,
                    operator: condOp,
                    value: condVal,
                    bgColor: condBg,
                    fontColor: condFont,
                  };
                  commitSheetsChange((prev) =>
                    prev.map((s) =>
                      s.id === activeSheet.id
                        ? { ...s, conditionalRules: [...(s.conditionalRules || []), newRule] }
                        : s
                    )
                  );
                  setShowCondModal(false);
                }}
                className="w-full rounded-lg bg-blue-700 py-2 font-medium text-white cursor-pointer"
              >
                {language === 'bn' ? 'নিয়ম যুক্ত করুন' : 'Add Formatting Rule'}
              </button>

              {(activeSheet.conditionalRules || []).length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                  {(activeSheet.conditionalRules || []).map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded">
                      <span>{r.range} {r.operator} {r.value}</span>
                      <button
                        type="button"
                        onClick={() =>
                          commitSheetsChange((prev) =>
                            prev.map((s) =>
                              s.id === activeSheet.id
                                ? { ...s, conditionalRules: (s.conditionalRules || []).filter((x) => x.id !== r.id) }
                                : s
                            )
                          )
                        }
                        className="text-red-600 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DATA VALIDATION MODAL */}
      {showValModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'bn' ? `সেল ভ্যালিডেশন (${activeCellKey})` : `Cell Validation (${activeCellKey})`}
              </h3>
              <button type="button" onClick={() => setShowValModal(false)} className="text-slate-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <select value={valType} onChange={(e) => setValType(e.target.value as SpreadsheetValidationRule['type'])} className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2">
                <option value="number_range">Number Range (Min / Max)</option>
                <option value="list">Allowed Value List</option>
                <option value="required">Required (Non-empty)</option>
              </select>
              {valType === 'list' && (
                <input
                  type="text"
                  value={valListStr}
                  onChange={(e) => setValListStr(e.target.value)}
                  placeholder="Comma-separated values (e.g. PASS,FAIL)"
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              )}
              {valType === 'number_range' && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={valMin} onChange={(e) => setValMin(e.target.value)} placeholder="Min" className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2" />
                  <input type="number" value={valMax} onChange={(e) => setValMax(e.target.value)} placeholder="Max" className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2" />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const rule: SpreadsheetValidationRule =
                      valType === 'list'
                        ? { type: 'list', listOptions: valListStr.split(',').map((x) => x.trim()).filter(Boolean) }
                        : valType === 'number_range'
                          ? { type: 'number_range', min: Number(valMin), max: Number(valMax) }
                          : { type: 'required' };
                    const keys = getSelectedKeys();
                    commitSheetsChange((prev) =>
                      prev.map((s) => {
                        if (s.id !== activeSheet.id) return s;
                        const nextCells = { ...s.cells };
                        for (const k of keys) {
                          nextCells[k] = { ...(nextCells[k] || { raw: '' }), validation: rule };
                        }
                        return { ...s, cells: nextCells };
                      })
                    );
                    setShowValModal(false);
                    showToast(language === 'bn' ? 'ভ্যালিডেশন প্রয়োগ করা হয়েছে।' : 'Validation rule applied.', 'success');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-700 py-2 font-medium text-white cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'প্রয়োগ করুন' : 'Apply Rule'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHART MODAL */}
      {chartModalTarget.open && (
        <SpreadsheetChartModal
          language={language}
          sheet={activeSheet}
          evalResult={activeEval}
          initialChart={chartModalTarget.chart}
          onSaveChart={(chart) => {
            commitSheetsChange((prev) =>
              prev.map((s) => {
                if (s.id !== activeSheet.id) return s;
                const existing = s.charts || [];
                const idx = existing.findIndex((c) => c.id === chart.id);
                const nextCharts = idx === -1 ? [...existing, chart] : existing.map((c, i) => (i === idx ? chart : c));
                return { ...s, charts: nextCharts };
              })
            );
            setChartModalTarget({ open: false, chart: null });
          }}
          onDeleteChart={(chartId) => {
            commitSheetsChange((prev) =>
              prev.map((s) =>
                s.id === activeSheet.id ? { ...s, charts: (s.charts || []).filter((c) => c.id !== chartId) } : s
              )
            );
            setChartModalTarget({ open: false, chart: null });
          }}
          onClose={() => setChartModalTarget({ open: false, chart: null })}
        />
      )}
    </div>
  );
};
