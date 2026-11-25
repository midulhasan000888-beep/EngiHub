import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as XLSX from 'xlsx';
import {
  CalculatorDefinition,
  PdfDocumentRecord,
  PdfExtractedNumber,
  PdfExtractedTable,
  PdfPageRecord,
} from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ParsedLocalPdfPage {
  pageNumber: number;
  text: string;
  isScanned: boolean;
  thumbnailDataUrl: string;
  ocrImageBase64?: string;
}

export interface ParsedLocalPdf {
  pageCount: number;
  pages: ParsedLocalPdfPage[];
}

export async function parsePdfFileLocally(
  file: File,
  maxPages: number,
  onProgress?: (pct: number, stageLabel: string) => void
): Promise<ParsedLocalPdf> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  if (pdf.numPages > maxPages) {
    throw new Error(
      `PDF has ${pdf.numPages} pages, which exceeds the administrator limit of ${maxPages} pages per document.`
    );
  }

  const pages: ParsedLocalPdfPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const lines: string[] = [];
    let lastY: number | null = null;
    let currentLine = '';

    for (const item of textContent.items) {
      if ('str' in item) {
        const y = Array.isArray(item.transform) ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4 && currentLine.trim()) {
          lines.push(currentLine.trim());
          currentLine = item.str;
        } else {
          currentLine += (currentLine && !currentLine.endsWith(' ') ? ' ' : '') + item.str;
        }
        if (y !== null) lastY = y;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    const text = lines.join('\n').replace(/\s+\n/g, '\n').trim();
    const isScanned = text.length < 45;

    // Render compressed thumbnail for page preview (and higher-res OCR image if scanned/drawing)
    const viewportThumb = page.getViewport({ scale: 0.75 });
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = Math.min(720, Math.round(viewportThumb.width));
    thumbCanvas.height = Math.round((thumbCanvas.width / viewportThumb.width) * viewportThumb.height);
    const thumbCtx = thumbCanvas.getContext('2d');
    if (thumbCtx) {
      const thumbScale = thumbCanvas.width / page.getViewport({ scale: 1 }).width;
      await page.render({ canvasContext: thumbCtx, viewport: page.getViewport({ scale: thumbScale }), canvas: thumbCanvas }).promise;
    }
    let thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.65);
    if (thumbnailDataUrl.length > 165000) {
      thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.45).slice(0, 175000);
    }

    let ocrImageBase64: string | undefined;
    if (isScanned || i <= 4) {
      // Render crisp page image for scanned OCR or engineering drawing vision analysis
      const ocrViewport = page.getViewport({ scale: isScanned ? 1.5 : 1.15 });
      const ocrCanvas = document.createElement('canvas');
      ocrCanvas.width = Math.min(1300, Math.round(ocrViewport.width));
      ocrCanvas.height = Math.round((ocrCanvas.width / ocrViewport.width) * ocrViewport.height);
      const ocrCtx = ocrCanvas.getContext('2d');
      if (ocrCtx) {
        const s = ocrCanvas.width / page.getViewport({ scale: 1 }).width;
        await page.render({ canvasContext: ocrCtx, viewport: page.getViewport({ scale: s }), canvas: ocrCanvas }).promise;
        ocrImageBase64 = ocrCanvas.toDataURL('image/jpeg', 0.8);
      }
    }

    pages.push({
      pageNumber: i,
      text: text.slice(0, 32000),
      isScanned,
      thumbnailDataUrl,
      ocrImageBase64,
    });

    if (onProgress) {
      onProgress(Math.round((i / pdf.numPages) * 100), `Page ${i}/${pdf.numPages}`);
    }
  }

  return { pageCount: pdf.numPages, pages };
}

/**
 * Retrieval-based page selection for large multi-page PDFs.
 * Matches explicit page number references ("page 15", "পৃষ্ঠা ১৫", "p.12") and keyword TF overlap.
 */
export function selectRelevantPagesForQuery(
  question: string,
  pages: PdfPageRecord[],
  maxPages = 6
): PdfPageRecord[] {
  if (pages.length <= maxPages) return pages;

  const qLower = question.toLowerCase();
  const explicitPageMatches = new Set<number>();

  // Match English & Bengali digits after page/পৃষ্ঠা/p.
  const bnToEn = question.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  const pageRegex = /(?:page|pg|p\.?|পৃষ্ঠা|পাতা)\s*#?\s*(\d{1,4})/gi;
  let m: RegExpExecArray | null;
  while ((m = pageRegex.exec(bnToEn)) !== null) {
    const num = Number(m[1]);
    if (num >= 1) explicitPageMatches.add(num);
  }

  const tokens = qLower
    .replace(/[^\w\u0980-\u09FF\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 2);

  const scored = pages.map((page) => {
    let score = 0;
    if (explicitPageMatches.has(page.pageNumber)) score += 1000;
    const hay = `${page.text}\n${page.diagramSummary || ''}`.toLowerCase();
    for (const tok of tokens) {
      if (hay.includes(tok)) {
        score += 10;
      }
    }
    // Slight preference for earlier overview pages if summary requested
    if ((qLower.includes('summar') || qLower.includes('সারসংক্ষেপ')) && page.pageNumber <= 3) {
      score += 15;
    }
    return { page, score };
  });

  scored.sort((a, b) => b.score - a.score || a.page.pageNumber - b.page.pageNumber);
  const chosen = scored.slice(0, maxPages).map((s) => s.page);
  return chosen.sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * Suggests compatible SUTRO SATHI dynamic calculators and maps extracted PDF values into calculator inputs.
 */
export function matchNumbersToCalculators(
  numbers: PdfExtractedNumber[],
  calculators: CalculatorDefinition[]
): Array<{
  calculator: CalculatorDefinition;
  mappedInputs: Record<string, number>;
  mappedUnits: Record<string, string>;
  assumptions: string[];
  matchedCount: number;
}> {
  const results: Array<{
    calculator: CalculatorDefinition;
    mappedInputs: Record<string, number>;
    mappedUnits: Record<string, string>;
    assumptions: string[];
    matchedCount: number;
  }> = [];

  for (const calc of calculators.filter((c) => c.enabled && c.published)) {
    const mappedInputs: Record<string, number> = {};
    const mappedUnits: Record<string, string> = {};
    const assumptions: string[] = [];
    let matchedCount = 0;

    for (const field of calc.inputs) {
      const fLabel = `${field.key} ${field.labelEn} ${field.defaultUnit || ''}`.toLowerCase();
      const match = numbers.find((n) => {
        if (!Number.isFinite(n.value)) return false;
        if (n.calculatorHint && n.calculatorHint === calc.id) return true;
        const nText = `${n.label} ${n.unit}`.toLowerCase();
        if (field.key === 'V' || fLabel.includes('voltage')) {
          return nText.includes('volt') || n.unit.toLowerCase() === 'v' || n.unit.toLowerCase() === 'kv';
        }
        if (field.key === 'I' || fLabel.includes('current')) {
          return nText.includes('current') || nText.includes('amp') || n.unit.toLowerCase() === 'a';
        }
        if (field.key === 'PF' || fLabel.includes('power factor')) {
          return nText.includes('power factor') || nText.includes('pf') || nText.includes('cos');
        }
        if (field.key === 'P' || fLabel.includes('power')) {
          return n.unit.toLowerCase() === 'kw' || n.unit.toLowerCase() === 'w' || n.unit.toLowerCase() === 'kva' || nText.includes('power');
        }
        if (field.key === 'L' || fLabel.includes('length')) {
          return nText.includes('length') || nText.includes('distance') || ['m', 'ft', 'km'].includes(n.unit.toLowerCase());
        }
        if (field.key === 'A' || fLabel.includes('area') || fLabel.includes('cable size') || fLabel.includes('cross')) {
          return nText.includes('cable') || nText.includes('size') || n.unit.toLowerCase().includes('mm2') || n.unit.includes('mm²');
        }
        return nText.includes(field.labelEn.toLowerCase().split(' ')[0]);
      });

      if (match) {
        let val = match.value;
        // Handle obvious unit scaling (e.g. kV -> V)
        if (field.defaultUnit === 'V' && match.unit.toLowerCase() === 'kv') {
          val = match.value * 1000;
          assumptions.push(`Converted "${match.label}" from ${match.value} kV to ${val} V.`);
        } else if (field.defaultUnit === 'W' && match.unit.toLowerCase() === 'kw') {
          val = match.value * 1000;
          assumptions.push(`Converted "${match.label}" from ${match.value} kW to ${val} W.`);
        }
        mappedInputs[field.key] = val;
        if (field.defaultUnit) mappedUnits[field.key] = field.defaultUnit;
        matchedCount++;
      } else {
        mappedInputs[field.key] = field.defaultValue;
        if (field.defaultUnit) mappedUnits[field.key] = field.defaultUnit;
        assumptions.push(`Used default ${field.labelEn} = ${field.defaultValue} ${field.defaultUnit || ''} (not matched in PDF).`);
      }
    }

    if (matchedCount >= 1) {
      results.push({ calculator: calc, mappedInputs, mappedUnits, assumptions, matchedCount });
    }
  }

  return results.sort((a, b) => b.matchedCount - a.matchedCount).slice(0, 6);
}

export function exportPdfIntelligenceToExcel(docItem: PdfDocumentRecord) {
  const wb = XLSX.utils.book_new();

  const overviewRows = [
    ['Document Title', docItem.title],
    ['File Name', docItem.fileName],
    ['Classified Type', docItem.documentType || docItem.category],
    ['Specialty', docItem.specialty],
    ['Pages', docItem.pageCount],
    ['OCR Scanned Pages', docItem.ocrPagesCount],
    ['English Summary', docItem.summaryEn || ''],
    ['Bangla Summary', docItem.summaryBn || ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewRows), 'Overview');

  if ((docItem.extractedSpecs || []).length > 0) {
    const specRows = [
      ['Category', 'Parameter', 'Value', 'Unit', 'Page', 'Reference'],
      ...(docItem.extractedSpecs || []).map((s) => [
        s.category,
        s.parameter,
        s.value,
        s.unit || '',
        s.page,
        s.reference || '',
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(specRows), 'Specifications');
  }

  if ((docItem.extractedNumbers || []).length > 0) {
    const numRows = [
      ['Parameter Label', 'Numeric Value', 'Unit', 'Page', 'Raw Source Text'],
      ...(docItem.extractedNumbers || []).map((n) => [n.label, n.value, n.unit, n.page, n.rawText]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(numRows), 'Extracted Numbers');
  }

  (docItem.extractedTables || []).forEach((tbl, idx) => {
    const sheetData = [tbl.headers, ...tbl.rows];
    const safeName = `Table_${idx + 1}_p${tbl.page}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), safeName);
  });

  if ((docItem.warnings || []).length > 0) {
    const warnRows = [
      ['Severity', 'Page', 'Warning / Inconsistency', 'Source'],
      ...(docItem.warnings || []).map((w) => [w.severity, w.page, w.message, w.source || '']),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(warnRows), 'Warnings');
  }

  XLSX.writeFile(wb, `${docItem.title.replace(/[^a-zA-Z0-9_-]+/g, '_')}_extraction.xlsx`);
}

export function exportTablesToCsv(tables: PdfExtractedTable[], baseName: string) {
  const lines: string[] = [];
  tables.forEach((tbl, idx) => {
    lines.push(`"Table ${idx + 1}: ${tbl.title.replace(/"/g, '""')} (Page ${tbl.page})"`);
    lines.push(tbl.headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(','));
    tbl.rows.forEach((row) => {
      lines.push(row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
    });
    lines.push('');
  });

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName.replace(/[^a-zA-Z0-9_-]+/g, '_')}_tables.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportDocumentToJson(docItem: PdfDocumentRecord) {
  const blob = new Blob([JSON.stringify(docItem, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${docItem.title.replace(/[^a-zA-Z0-9_-]+/g, '_')}_intelligence.json`;
  a.click();
  URL.revokeObjectURL(url);
}
