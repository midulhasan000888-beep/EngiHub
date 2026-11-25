import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

export interface ParsedDocumentSource {
  fileName: string;
  title: string;
  sourceType: 'document' | 'image';
  mimeType: string;
  fileSizeBytes: number;
  pages: Array<{
    pageNumber: number;
    text: string;
    isScanned: boolean;
    imageBase64?: string;
  }>;
}

function chunkTextIntoPages(text: string, chunkSize = 4800): Array<{ pageNumber: number; text: string; isScanned: boolean }> {
  const clean = text.trim();
  if (!clean) {
    return [{ pageNumber: 1, text: '[Empty document]', isScanned: false }];
  }
  const pages: Array<{ pageNumber: number; text: string; isScanned: boolean }> = [];
  for (let i = 0; i < clean.length && pages.length < 60; i += chunkSize) {
    pages.push({
      pageNumber: pages.length + 1,
      text: clean.slice(i, i + chunkSize),
      isScanned: false,
    });
  }
  return pages;
}

export async function parseOfficeOrTextDocument(file: File): Promise<ParsedDocumentSource> {
  const lower = file.name.toLowerCase();
  const baseTitle = file.name.replace(/\.[^.]+$/, '').slice(0, 180) || file.name;

  if (lower.endsWith('.docx')) {
    const buffer = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buffer });
    const text = res.value || '';
    return {
      fileName: file.name,
      title: baseTitle,
      sourceType: 'document',
      mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSizeBytes: file.size,
      pages: chunkTextIntoPages(text),
    };
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const pages: Array<{ pageNumber: number; text: string; isScanned: boolean }> = [];
    wb.SheetNames.slice(0, 20).forEach((sheetName, idx) => {
      const ws = wb.Sheets[sheetName];
      const csvText = XLSX.utils.sheet_to_csv(ws);
      const formatted = `Sheet: ${sheetName}\n${csvText.slice(0, 28000)}`;
      pages.push({
        pageNumber: idx + 1,
        text: formatted,
        isScanned: false,
      });
    });
    return {
      fileName: file.name,
      title: baseTitle,
      sourceType: 'document',
      mimeType: file.type || 'text/csv',
      fileSizeBytes: file.size,
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: '[Empty spreadsheet]', isScanned: false }],
    };
  }

  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.json') || lower.endsWith('.csv')) {
    const text = await file.text();
    return {
      fileName: file.name,
      title: baseTitle,
      sourceType: 'document',
      mimeType: file.type || 'text/plain',
      fileSizeBytes: file.size,
      pages: chunkTextIntoPages(text),
    };
  }

  throw new Error('Supported document formats: PDF, TXT, DOCX, XLSX, XLS, CSV, MD, JSON.');
}

export async function compressImageForAnalyzer(file: File): Promise<ParsedDocumentSource> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1400;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Unable to decode image file.'));
      img.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  const baseTitle = file.name.replace(/\.[^.]+$/, '').slice(0, 180) || file.name;
  return {
    fileName: file.name,
    title: baseTitle,
    sourceType: 'image',
    mimeType: 'image/jpeg',
    fileSizeBytes: file.size,
    pages: [
      {
        pageNumber: 1,
        text: '',
        isScanned: true,
        imageBase64: dataUrl,
      },
    ],
  };
}
