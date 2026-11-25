import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import {
  CalculationHistoryEntry,
  CalendarEvent,
  Language,
  PdfDocumentRecord,
  ReportBlock,
  ReportBlockBindingSource,
  ReportElementType,
  ReportPageDesign,
  ReportSettingsRecord,
  ReportTemplate,
  UserProfile,
} from '../types';
import { getTriCalendarDate } from './calendarUtils';

export interface ElementCatalogItem {
  type: ReportElementType;
  group: 'brand' | 'meta' | 'content' | 'engineering' | 'signoff';
  labelEn: string;
  labelBn: string;
  defaultWidth: ReportBlock['widthPercent'];
}

export const REPORT_ELEMENT_CATALOG: ElementCatalogItem[] = [
  // 1. Brand & Header
  { type: 'company-logo', group: 'brand', labelEn: 'Company Logo', labelBn: 'কোম্পানি লোগো', defaultWidth: 25 },
  { type: 'company-name', group: 'brand', labelEn: 'Company Name', labelBn: 'কোম্পানির নাম', defaultWidth: 50 },
  { type: 'header', group: 'brand', labelEn: 'Header Banner', labelBn: 'হেডার ব্যানার', defaultWidth: 100 },
  { type: 'report-title', group: 'brand', labelEn: 'Report Title', labelBn: 'রিপোর্ট শিরোনাম', defaultWidth: 100 },
  { type: 'subtitle', group: 'brand', labelEn: 'Subtitle', labelBn: 'উপ-শিরোনাম', defaultWidth: 100 },
  // 2. Document Meta
  { type: 'report-number', group: 'meta', labelEn: 'Report Number', labelBn: 'রিপোর্ট নম্বর', defaultWidth: 25 },
  { type: 'date-time', group: 'meta', labelEn: 'Date & Time', labelBn: 'তারিখ ও সময়', defaultWidth: 50 },
  { type: 'user-info', group: 'meta', labelEn: 'User Information', labelBn: 'ব্যবহারকারীর তথ্য', defaultWidth: 50 },
  { type: 'project-info', group: 'meta', labelEn: 'Project Information', labelBn: 'প্রকল্পের তথ্য', defaultWidth: 100 },
  { type: 'qr-code', group: 'meta', labelEn: 'Verification QR Code', labelBn: 'কিউআর কোড', defaultWidth: 25 },
  // 3. Content & Visuals
  { type: 'heading', group: 'content', labelEn: 'Heading', labelBn: 'শিরোনাম (Heading)', defaultWidth: 100 },
  { type: 'paragraph', group: 'content', labelEn: 'Paragraph', labelBn: 'অনুচ্ছেদ', defaultWidth: 100 },
  { type: 'custom-text', group: 'content', labelEn: 'Custom Callout Text', labelBn: 'কাস্টম টেক্সট বক্স', defaultWidth: 100 },
  { type: 'table', group: 'content', labelEn: 'Data Table', labelBn: 'ডেটা টেবিল', defaultWidth: 100 },
  { type: 'chart', group: 'content', labelEn: 'Visual Chart', labelBn: 'চার্ট / গ্রাফ', defaultWidth: 100 },
  { type: 'image', group: 'content', labelEn: 'Image / Site Photo', labelBn: 'ছবি / সাইট ফটো', defaultWidth: 50 },
  { type: 'engineering-drawing', group: 'content', labelEn: 'Engineering Drawing', labelBn: 'ইঞ্জিনিয়ারিং ড্রয়িং', defaultWidth: 100 },
  { type: 'page-break', group: 'content', labelEn: 'Page Break', labelBn: 'নতুন পৃষ্ঠা (Page Break)', defaultWidth: 100 },
  // 4. Calculation & Engineering Analysis
  { type: 'calc-inputs', group: 'engineering', labelEn: 'Calculation Inputs', labelBn: 'হিসাবের ইনপুট', defaultWidth: 50 },
  { type: 'calc-formula', group: 'engineering', labelEn: 'Calculation Formulas', labelBn: 'সূত্র ও ধাপসমূহ', defaultWidth: 100 },
  { type: 'calc-results', group: 'engineering', labelEn: 'Calculation Results', labelBn: 'হিসাবের ফলাফল', defaultWidth: 50 },
  { type: 'observations', group: 'engineering', labelEn: 'Observations', labelBn: 'পর্যবেক্ষণ', defaultWidth: 100 },
  { type: 'recommendations', group: 'engineering', labelEn: 'Recommendations', labelBn: 'সুপারিশমালা', defaultWidth: 100 },
  { type: 'remarks', group: 'engineering', labelEn: 'Remarks', labelBn: 'মন্তব্য (Remarks)', defaultWidth: 100 },
  { type: 'conclusion', group: 'engineering', labelEn: 'Conclusion', labelBn: 'উপসংহার', defaultWidth: 100 },
  // 5. Sign-off & Footer
  { type: 'signature', group: 'signoff', labelEn: 'Signature Block', labelBn: 'স্বাক্ষর ব্লক', defaultWidth: 50 },
  { type: 'prepared-by', group: 'signoff', labelEn: 'Prepared By', labelBn: 'প্রস্তুতকারক', defaultWidth: 33 },
  { type: 'checked-by', group: 'signoff', labelEn: 'Checked By', labelBn: 'যাচাইকারী', defaultWidth: 33 },
  { type: 'approved-by', group: 'signoff', labelEn: 'Approved By', labelBn: 'অনুমোদনকারী', defaultWidth: 33 },
  { type: 'footer', group: 'signoff', labelEn: 'Footer Bar', labelBn: 'ফুটার বার', defaultWidth: 75 },
  { type: 'page-number', group: 'signoff', labelEn: 'Page Number', labelBn: 'পৃষ্ঠা নম্বর', defaultWidth: 25 },
];

export const DEFAULT_REPORT_PAGE_DESIGN: ReportPageDesign = {
  pageSize: 'a4',
  customWidthMm: 210,
  customHeightMm: 297,
  orientation: 'portrait',
  marginTopMm: 12,
  marginRightMm: 12,
  marginBottomMm: 12,
  marginLeftMm: 12,
  contentPaddingPx: 20,
  backgroundColor: '#ffffff',
  borderEnabled: false,
  borderColor: '#cbd5e1',
  borderWidthPx: 1,
  fontFamily: '"Plus Jakarta Sans", "Noto Sans Bengali", sans-serif',
  fontSizePx: 12,
  fontColor: '#0f172a',
  lineHeight: 1.55,
  accentColor: '#1d4ed8',
  columnGapPx: 12,
  showHeaderOnPages: true,
  showFooterOnPages: true,
  headerStyleBg: '#f8fafc',
  footerStyleBg: '#ffffff',
  showPageNumbers: true,
};

export const DEFAULT_REPORT_SETTINGS: ReportSettingsRecord = {
  id: 'global',
  defaultCompanyName: 'SUTRO SATHI Engineering Consultants',
  defaultAccentColor: '#1d4ed8',
  defaultFontFamily: '"Plus Jakarta Sans", "Noto Sans Bengali", sans-serif',
  defaultHeaderText: 'ENGINEERING CALCULATION & TECHNICAL REPORT',
  defaultFooterText: 'Prepared with SUTRO SATHI (সূত্রসাথী) — Verify critical parameters prior to execution.',
  defaultMarginMm: 12,
  allowUserCustomTemplates: true,
  allowCustomPageSizes: true,
  allowEmailDispatch: true,
  allowExcelExport: true,
  disabledElementTypes: [],
};

export function makeBlockId(prefix = 'blk'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getPageDimensionsMm(design: ReportPageDesign): { widthMm: number; heightMm: number } {
  let baseW = 210;
  let baseH = 297;
  if (design.pageSize === 'letter') {
    baseW = 215.9;
    baseH = 279.4;
  } else if (design.pageSize === 'legal') {
    baseW = 215.9;
    baseH = 355.6;
  } else if (design.pageSize === 'custom') {
    baseW = Math.max(100, Math.min(450, design.customWidthMm || 210));
    baseH = Math.max(100, Math.min(600, design.customHeightMm || 297));
  }
  if (design.orientation === 'landscape' && baseW < baseH) {
    return { widthMm: baseH, heightMm: baseW };
  }
  if (design.orientation === 'portrait' && baseW > baseH) {
    return { widthMm: baseH, heightMm: baseW };
  }
  return { widthMm: baseW, heightMm: baseH };
}

export function createReportBlock(
  type: ReportElementType,
  language: Language = 'en',
  defaults?: {
    companyName?: string;
    reportNumber?: string;
    title?: string;
    userName?: string;
    userEmail?: string;
    accentColor?: string;
  }
): ReportBlock {
  const catalogMeta = REPORT_ELEMENT_CATALOG.find((c) => c.type === type);
  const label = catalogMeta ? (language === 'bn' ? catalogMeta.labelBn : catalogMeta.labelEn) : type;
  const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const tri = getTriCalendarDate(new Date(), { hijriOffsetDays: 0, banglaVariant: 'revised' });

  const base: ReportBlock = {
    id: makeBlockId('blk'),
    type,
    label,
    visible: true,
    widthPercent: catalogMeta?.defaultWidth || 100,
    style: {
      paddingPx: 8,
      marginBottomPx: 6,
      textAlign: 'left',
      borderWidthPx: 0,
      borderColor: '#e2e8f0',
      backgroundColor: 'transparent',
    },
    bindingSource: 'manual',
    bindingOptions: {
      showInputs: true,
      showFormula: true,
      showSteps: true,
      showResults: true,
      showUnits: true,
      showWarnings: true,
      showReference: true,
    },
    content: {},
  };

  switch (type) {
    case 'company-logo':
      base.content = { caption: 'Company Logo', imageDataUrl: '' };
      break;
    case 'company-name':
      base.style.fontSizePx = 18;
      base.style.bold = true;
      base.style.color = defaults?.accentColor || '#1d4ed8';
      base.content = {
        text: defaults?.companyName || 'SUTRO SATHI Engineering Consultants',
        subtext: 'Precision Engineering · MEP · Structural Design',
      };
      break;
    case 'header':
      base.style.backgroundColor = '#f8fafc';
      base.style.borderWidthPx = 1;
      base.style.borderColor = '#cbd5e1';
      base.content = {
        text: 'TECHNICAL VERIFICATION & CALCULATION DOCUMENT',
        subtext: defaults?.reportNumber || 'SS-2026-001',
      };
      break;
    case 'report-title':
      base.style.fontSizePx = 20;
      base.style.bold = true;
      base.content = {
        text: defaults?.title || (language === 'bn' ? 'ইঞ্জিনিয়ারিং বিশ্লেষণ প্রতিবেদন' : 'Engineering Calculation & Analysis Report'),
      };
      break;
    case 'subtitle':
      base.style.fontSizePx = 13;
      base.style.color = '#475569';
      base.content = {
        text: language === 'bn' ? 'কারিগরি নকশা, সূত্র ও যাচাইকরণ বিবরণী' : 'Technical Design Verification, Standards & Parameter Schedule',
      };
      break;
    case 'report-number':
      base.style.textAlign = 'right';
      base.style.backgroundColor = '#f8fafc';
      base.style.borderWidthPx = 1;
      base.content = {
        text: defaults?.reportNumber || `SS-${new Date().getFullYear()}-1001`,
        subtext: 'Rev 01',
      };
      break;
    case 'date-time':
      base.content = {
        text: nowStr,
        subtext: `${tri.bangla.formattedEn} · ${tri.hijri.formattedEn}`,
      };
      break;
    case 'user-info':
      base.style.backgroundColor = '#f8fafc';
      base.style.borderWidthPx = 1;
      base.content = {
        fields: [
          { label: language === 'bn' ? 'প্রকৌশলী' : 'Engineer', value: defaults?.userName || 'Lead Engineer' },
          { label: language === 'bn' ? 'ইমেইল' : 'Email', value: defaults?.userEmail || '-' },
          { label: language === 'bn' ? 'তারিখ' : 'Date', value: new Date().toISOString().slice(0, 10) },
        ],
      };
      break;
    case 'project-info':
      base.style.backgroundColor = '#f8fafc';
      base.style.borderWidthPx = 1;
      base.content = {
        fields: [
          { label: language === 'bn' ? 'প্রকল্প' : 'Project', value: 'Industrial Facility Expansion' },
          { label: language === 'bn' ? 'ক্লায়েন্ট' : 'Client', value: 'Client Organization' },
          { label: language === 'bn' ? 'অবস্থান' : 'Location', value: 'Dhaka, Bangladesh' },
          { label: language === 'bn' ? 'কোড / স্ট্যান্ডার্ড' : 'Design Code', value: 'IEC / BNBC / ASTM' },
        ],
      };
      break;
    case 'heading':
      base.style.fontSizePx = 15;
      base.style.bold = true;
      base.content = { text: language === 'bn' ? '১. কারিগরি সারসংক্ষেপ' : '1. Technical Scope & Methodology', headingLevel: 2 };
      break;
    case 'paragraph':
      base.content = {
        text:
          language === 'bn'
            ? 'এই প্রতিবেদনে প্রাসঙ্গিক প্রকৌশল সূত্র, ইনপুট প্যারামিটার এবং গণনাকৃত ফলাফল মানদণ্ড অনুযায়ী উপস্থাপন করা হয়েছে।'
            : 'This technical document summarizes input design parameters, governing equations, and verified calculation outputs for project review.',
      };
      break;
    case 'custom-text':
      base.style.backgroundColor = '#eff6ff';
      base.style.borderWidthPx = 1;
      base.style.borderColor = '#bfdbfe';
      base.content = {
        text: language === 'bn' ? 'গুরুত্বপূর্ণ কারিগরি নোট: মাঠ পর্যায়ে প্রয়োগের আগে অনুগ্রহ করে মানসমূহ যাচাই করুন।' : 'Design Note: Confirm field installation ratings and safety factors prior to commissioning.',
      };
      break;
    case 'table':
      base.style.tableStriped = true;
      base.style.tableHeaderBg = '#f1f5f9';
      base.style.tableHeaderColor = '#0f172a';
      base.content = {
        text: language === 'bn' ? 'প্যারামিটার ও ফলাফল সারণি' : 'Parameter & Output Schedule',
        tableHeaders: ['#', 'Parameter', 'Value', 'Unit', 'Notes'],
        tableRows: [
          ['1', 'Line-to-Line Voltage (V)', '415', 'V', 'Nominal 3-Phase'],
          ['2', 'Load Current (I)', '60', 'A', 'Balanced'],
          ['3', 'Active Power (P)', '37.95', 'kW', 'Verified'],
        ],
      };
      break;
    case 'chart':
      base.style.borderWidthPx = 1;
      base.content = {
        text: language === 'bn' ? 'ফলাফল তুলনামূলক চার্ট' : 'Magnitude Comparison Chart',
        chartType: 'horizontal-bar',
        chartSeries: [
          { label: 'Active kW', value: 37.95 },
          { label: 'Apparent kVA', value: 43.13 },
          { label: 'Reactive kVAR', value: 20.48 },
        ],
      };
      break;
    case 'image':
      base.style.borderWidthPx = 1;
      base.content = { caption: language === 'bn' ? 'সাইট পরিদর্শন ছবি' : 'Site Inspection Photo', imageDataUrl: '' };
      break;
    case 'engineering-drawing':
      base.style.borderWidthPx = 1;
      base.content = {
        caption: language === 'bn' ? 'ইঞ্জিনিয়ারিং ড্রয়িং / ডায়াগ্রাম' : 'Single Line Diagram / Structural Detail',
        drawingCode: 'DWG-EL-01',
        scaleLabel: 'Scale 1:50',
        imageDataUrl: '',
      };
      break;
    case 'calc-inputs':
      base.bindingSource = 'calculation';
      base.style.borderWidthPx = 1;
      base.content = {
        text: language === 'bn' ? 'ইনপুট প্যারামিটার' : 'Calculation Input Parameters',
        fields: [
          { label: 'Line Voltage (V)', value: '415 V' },
          { label: 'Current (I)', value: '60 A' },
          { label: 'Power Factor', value: '0.88' },
        ],
      };
      break;
    case 'calc-formula':
      base.bindingSource = 'calculation';
      base.style.backgroundColor = '#f8fafc';
      base.style.borderWidthPx = 1;
      base.content = {
        text: language === 'bn' ? 'ব্যবহৃত সূত্র ও ধাপসমূহ' : 'Governing Formula & Step-by-Step Substitution',
        formulaExpression: 'P = √3 × V × I × PF / 1000',
        formulaSteps: 'P = 1.732 × 415 × 60 × 0.88 / 1000 = 37.95 kW',
        formulaReference: 'IEC 60364 / Standard Three-Phase AC Power',
      };
      break;
    case 'calc-results':
      base.bindingSource = 'calculation';
      base.style.backgroundColor = '#eff6ff';
      base.style.borderWidthPx = 1;
      base.style.borderColor = '#bfdbfe';
      base.content = {
        text: language === 'bn' ? 'চূড়ান্ত ফলাফল' : 'Calculated Results & Warnings',
        fields: [
          { label: 'Active Power (P)', value: '37.95 kW' },
          { label: 'Apparent Power (S)', value: '43.13 kVA' },
        ],
        warnings: [],
      };
      break;
    case 'observations':
      base.style.borderWidthPx = 1;
      base.content = {
        text:
          language === 'bn'
            ? 'পর্যবেক্ষণ: লোড ভারসাম্য এবং ভোল্টেজ ড্রপ অনুমোদিত সীমার মধ্যে রয়েছে।'
            : 'Observations: Load balance across phases and calculated voltage drop fall within acceptable design limits.',
      };
      break;
    case 'recommendations':
      base.style.borderWidthPx = 1;
      base.content = {
        text:
          language === 'bn'
            ? 'সুপারিশ: নির্ধারিত রেটিং অনুযায়ী সার্কিট ব্রেকার ও ক্যাবল ব্যবহার করুন।'
            : 'Recommendations: Select MCCB and XLPE armored cable ratings with appropriate ambient temperature derating.',
      };
      break;
    case 'remarks':
      base.style.borderWidthPx = 1;
      base.content = {
        text:
          language === 'bn'
            ? 'মন্তব্য: প্রাসঙ্গিক মানদণ্ড অনুযায়ী সকল হিসাব যাচাইকৃত।'
            : 'Remarks: Calculations verified under steady-state design conditions.',
      };
      break;
    case 'conclusion':
      base.style.borderWidthPx = 1;
      base.style.backgroundColor = '#f8fafc';
      base.content = {
        text:
          language === 'bn'
            ? 'উপসংহার: প্রস্তাবিত সিস্টেম কনফিগারেশন অনুমোদন ও বাস্তবায়নের জন্য উপযুক্ত।'
            : 'Conclusion: Proposed engineering design parameters satisfy code criteria and are recommended for approval.',
      };
      break;
    case 'signature':
      base.content = {
        signerName: defaults?.userName || 'Lead Engineer',
        signerRole: language === 'bn' ? 'ডিজাইন প্রকৌশলী' : 'Design Engineer',
        signatureDataUrl: '',
      };
      break;
    case 'prepared-by':
      base.content = {
        signerName: defaults?.userName || 'Lead Engineer',
        signerRole: language === 'bn' ? 'প্রস্তুতকারক' : 'Prepared By',
        subtext: new Date().toISOString().slice(0, 10),
      };
      break;
    case 'checked-by':
      base.content = {
        signerName: 'Senior QA Reviewer',
        signerRole: language === 'bn' ? 'যাচাইকারী' : 'Checked By',
        subtext: new Date().toISOString().slice(0, 10),
      };
      break;
    case 'approved-by':
      base.content = {
        signerName: 'Principal Engineer',
        signerRole: language === 'bn' ? 'অনুমোদনকারী' : 'Approved By',
        subtext: new Date().toISOString().slice(0, 10),
      };
      break;
    case 'footer':
      base.style.fontSizePx = 10;
      base.style.color = '#64748b';
      base.content = {
        text: 'Generated via SUTRO SATHI (সূত্রসাথী) — Confidential Engineering Record',
      };
      break;
    case 'page-number':
      base.style.fontSizePx = 10;
      base.style.textAlign = 'right';
      base.style.color = '#64748b';
      base.content = { text: 'Page {{page}} of {{totalPages}}' };
      break;
    case 'qr-code':
      base.style.textAlign = 'center';
      base.content = {
        qrValue: `SUTRO-SATHI|${defaults?.reportNumber || 'SS-2026'}|${defaults?.title || 'Engineering Report'}`,
        caption: 'Verify Document',
      };
      break;
    case 'page-break':
      base.content = { text: 'Page Break' };
      break;
  }

  return base;
}

export function buildDefaultBlocksFromTemplate(
  template: ReportTemplate | undefined,
  language: Language,
  settings: ReportSettingsRecord,
  defaults: {
    companyName?: string;
    reportNumber?: string;
    title?: string;
    userName?: string;
    userEmail?: string;
  }
): { pageDesign: ReportPageDesign; blocks: ReportBlock[] } {
  const accent = template?.accentColor || settings.defaultAccentColor || '#1d4ed8';
  const pageDesign: ReportPageDesign = {
    ...DEFAULT_REPORT_PAGE_DESIGN,
    ...(template?.pageDesign || {}),
    orientation: template?.orientation || template?.pageDesign?.orientation || 'portrait',
    accentColor: accent,
    fontFamily: template?.pageDesign?.fontFamily || settings.defaultFontFamily || DEFAULT_REPORT_PAGE_DESIGN.fontFamily,
    marginTopMm: template?.pageDesign?.marginTopMm ?? settings.defaultMarginMm ?? 12,
    marginRightMm: template?.pageDesign?.marginRightMm ?? settings.defaultMarginMm ?? 12,
    marginBottomMm: template?.pageDesign?.marginBottomMm ?? settings.defaultMarginMm ?? 12,
    marginLeftMm: template?.pageDesign?.marginLeftMm ?? settings.defaultMarginMm ?? 12,
  };

  if (template?.blocks && template.blocks.length > 0) {
    const cloned = JSON.parse(JSON.stringify(template.blocks)) as ReportBlock[];
    return { pageDesign, blocks: cloned };
  }

  const companyBlock = createReportBlock('company-name', language, { ...defaults, accentColor: accent });
  companyBlock.widthPercent = 50;
  if (template?.headerText) companyBlock.content.subtext = template.headerText;

  const logoBlock = createReportBlock('company-logo', language, defaults);
  logoBlock.widthPercent = 25;

  const numBlock = createReportBlock('report-number', language, defaults);
  numBlock.widthPercent = 25;

  const titleBlock = createReportBlock('report-title', language, defaults);
  const projectBlock = createReportBlock('project-info', language, defaults);
  if (template?.customFields?.length) {
    projectBlock.content.fields = [
      ...(projectBlock.content.fields || []),
      ...template.customFields.map((cf) => ({
        label: language === 'bn' ? cf.labelBn : cf.labelEn,
        value: cf.defaultValue || '-',
      })),
    ];
  }

  const tableBlock = createReportBlock('table', language, defaults);
  const blocks: ReportBlock[] = [logoBlock, companyBlock, numBlock, titleBlock, projectBlock, tableBlock];

  if (template?.showChart !== false) {
    blocks.push(createReportBlock('chart', language, defaults));
  }
  blocks.push(createReportBlock('remarks', language, defaults));

  if (template?.showSignature !== false) {
    const prep = createReportBlock('prepared-by', language, defaults);
    prep.widthPercent = 50;
    const appr = createReportBlock('approved-by', language, defaults);
    appr.widthPercent = 50;
    blocks.push(prep, appr);
  }

  const footer = createReportBlock('footer', language, defaults);
  if (template?.footerText || settings.defaultFooterText) {
    footer.content.text = template?.footerText || settings.defaultFooterText;
  }
  const pg = createReportBlock('page-number', language, defaults);
  blocks.push(footer, pg);

  return { pageDesign, blocks };
}

export interface DynamicBindContext {
  profile?: UserProfile | null;
  latestCalculation?: CalculationHistoryEntry | null;
  latestPdf?: PdfDocumentRecord | null;
  upcomingEvents?: CalendarEvent[];
}

export function bindBlockToDataSource(
  block: ReportBlock,
  source: ReportBlockBindingSource,
  ctx: DynamicBindContext,
  language: Language
): ReportBlock {
  const updated: ReportBlock = {
    ...block,
    bindingSource: source,
    content: { ...block.content },
  };
  const opts = block.bindingOptions || {
    showInputs: true,
    showFormula: true,
    showSteps: true,
    showResults: true,
    showUnits: true,
    showWarnings: true,
    showReference: true,
  };

  if (source === 'user_profile' && ctx.profile) {
    const profileFields = [
      { label: language === 'bn' ? 'নাম' : 'Name', value: ctx.profile.displayName },
      { label: language === 'bn' ? 'ইমেইল' : 'Email', value: ctx.profile.email },
      { label: language === 'bn' ? 'পদবি' : 'Role', value: ctx.profile.role.toUpperCase() },
      { label: language === 'bn' ? 'সময় অঞ্চল' : 'Timezone', value: ctx.profile.timezone || 'Asia/Dhaka' },
    ];
    if (block.type === 'prepared-by' || block.type === 'signature') {
      updated.content.signerName = ctx.profile.displayName;
    } else if (block.type === 'table') {
      updated.content.tableHeaders = ['Field', 'Value'];
      updated.content.tableRows = profileFields.map((f) => [f.label, f.value]);
    } else {
      updated.content.fields = profileFields;
      updated.content.text = `${ctx.profile.displayName} (${ctx.profile.email})`;
    }
    return updated;
  }

  if ((source === 'calculation' || source === 'saved_calculation') && ctx.latestCalculation) {
    const calc = ctx.latestCalculation;
    const calcTitle = language === 'bn' ? calc.calculatorNameBn || calc.calculatorNameEn : calc.calculatorNameEn;
    if (block.type === 'report-title' || block.type === 'heading') {
      updated.content.text = calcTitle;
    } else if (block.type === 'calc-inputs') {
      updated.content.fields = Object.entries(calc.inputs).map(([k, v]) => ({
        label: k,
        value: opts.showUnits && v.unit ? `${v.value} ${v.unit}` : String(v.value),
      }));
    } else if (block.type === 'calc-formula') {
      updated.content.formulaExpression = opts.showFormula ? calc.formulaDisplay || '' : '';
      updated.content.formulaSteps = opts.showSteps
        ? Object.entries(calc.inputs)
            .map(([k, v]) => `${k}=${v.value}${v.unit || ''}`)
            .join(', ') +
          ' -> ' +
          Object.values(calc.outputs)
            .map((o) => `${o.formatted}${o.unit || ''}`)
            .join(', ')
        : '';
    } else if (block.type === 'calc-results') {
      updated.content.fields = Object.values(calc.outputs).map((o) => ({
        label: language === 'bn' ? o.labelBn : o.labelEn,
        value: opts.showUnits && o.unit ? `${o.formatted} ${o.unit}` : o.formatted,
      }));
    } else if (block.type === 'chart') {
      updated.content.chartSeries = Object.entries(calc.outputs)
        .filter(([, o]) => Number.isFinite(o.value))
        .slice(0, 6)
        .map(([k, o]) => ({ label: k, value: Math.abs(o.value) }));
    } else if (block.type === 'table') {
      const rows: string[][] = [];
      let idx = 1;
      if (opts.showInputs) {
        for (const [k, v] of Object.entries(calc.inputs)) {
          rows.push([String(idx++), `Input: ${k}`, String(v.value), opts.showUnits ? v.unit || '-' : '-', 'Input']);
        }
      }
      if (opts.showResults) {
        for (const o of Object.values(calc.outputs)) {
          rows.push([
            String(idx++),
            language === 'bn' ? o.labelBn : o.labelEn,
            o.formatted,
            opts.showUnits ? o.unit || '-' : '-',
            'Result',
          ]);
        }
      }
      updated.content.text = calcTitle;
      updated.content.tableHeaders = ['#', 'Parameter', 'Value', 'Unit', 'Type'];
      updated.content.tableRows = rows;
    } else {
      updated.content.text = `${calcTitle}${calc.formulaDisplay ? ` (${calc.formulaDisplay})` : ''}`;
    }
    return updated;
  }

  if (source === 'pdf_analyzer' && ctx.latestPdf) {
    const doc = ctx.latestPdf;
    if (block.type === 'table' && doc.extractedTables && doc.extractedTables.length > 0) {
      const t0 = doc.extractedTables[0];
      updated.content.text = `${doc.title} — ${t0.title}`;
      updated.content.tableHeaders = t0.headers;
      updated.content.tableRows = t0.rows;
    } else if (block.type === 'table' && doc.extractedSpecs && doc.extractedSpecs.length > 0) {
      updated.content.text = `${doc.title} — Extracted Specifications`;
      updated.content.tableHeaders = ['Category', 'Parameter', 'Value', 'Unit', 'Page'];
      updated.content.tableRows = doc.extractedSpecs.slice(0, 30).map((s) => [
        s.category,
        s.parameter,
        s.value,
        s.unit || '-',
        `p.${s.page}`,
      ]);
    } else if (block.type === 'chart' && doc.extractedNumbers && doc.extractedNumbers.length > 0) {
      updated.content.chartSeries = doc.extractedNumbers.slice(0, 6).map((n) => ({
        label: n.label.slice(0, 20),
        value: Math.abs(n.value),
      }));
    } else {
      updated.content.text =
        (language === 'bn' ? doc.summaryBn : doc.summaryEn) ||
        doc.summaryEn ||
        `Analyzed Document: ${doc.title} (${doc.pageCount} pages)`;
    }
    return updated;
  }

  if (source === 'calendar') {
    const tri = getTriCalendarDate(new Date(), { hijriOffsetDays: 0, banglaVariant: 'revised' });
    if (block.type === 'date-time') {
      updated.content.text = new Date().toISOString().slice(0, 16).replace('T', ' ');
      updated.content.subtext = `${tri.bangla.formattedBn} · ${tri.hijri.formattedEn}`;
    } else if (block.type === 'table') {
      const evts = (ctx.upcomingEvents || []).slice(0, 15);
      updated.content.text = language === 'bn' ? 'আসন্ন প্রকল্প ইভেন্ট তালিকা' : 'Project Schedule & Calendar Events';
      updated.content.tableHeaders = ['#', 'Date', 'Time', 'Event Title', 'Repeat'];
      updated.content.tableRows =
        evts.length > 0
          ? evts.map((e, i) => [String(i + 1), e.date, e.time || '-', e.title, e.repeat])
          : [['1', new Date().toISOString().slice(0, 10), '-', 'No scheduled events', 'none']];
    } else {
      const gregText = language === 'bn' ? tri.gregorian.formattedBn : tri.gregorian.formattedEn;
      updated.content.text = `${gregText} | ${tri.bangla.formattedBn} | ${tri.hijri.formattedEn}`;
    }
    return updated;
  }

  return updated;
}

/**
 * Splits visible blocks into discrete physical pages, honoring explicit 'page-break' blocks
 * and automatically breaking oversized tables across pages with repeated headers!
 */
export function paginateReportBlocks(
  blocks: ReportBlock[],
  pageDesign: ReportPageDesign
): ReportBlock[][] {
  const visible = blocks.filter((b) => b.visible);
  const { heightMm } = getPageDimensionsMm(pageDesign);
  const runningChromePx =
    (pageDesign.showHeaderOnPages ? 44 : 0) +
    (pageDesign.showFooterOnPages || pageDesign.showPageNumbers ? 44 : 0) +
    28;
  const printableHeightPx = Math.max(
    360,
    ((heightMm - pageDesign.marginTopMm - pageDesign.marginBottomMm) * 96) / 25.4 - runningChromePx
  );

  const pages: ReportBlock[][] = [];
  let currentPage: ReportBlock[] = [];
  let currentRowWidth = 0;
  let rowMaxHeight = 0;
  let usedHeight = 0;

  const estimateHeight = (blk: ReportBlock): number => {
    if (blk.minHeightPx && blk.minHeightPx > 0) return blk.minHeightPx;
    switch (blk.type) {
      case 'company-logo':
        return 76;
      case 'company-name':
      case 'report-number':
      case 'date-time':
      case 'header':
      case 'footer':
      case 'page-number':
        return 66;
      case 'report-title':
      case 'heading':
      case 'subtitle':
        return 52;
      case 'qr-code':
        return 115;
      case 'image':
      case 'engineering-drawing':
        return blk.content.imageDataUrl ? 260 : 90;
      case 'chart':
        return 70 + (blk.content.chartSeries?.length || 3) * 26;
      case 'table':
        return 68 + (blk.content.tableRows?.length || 2) * 30;
      case 'project-info':
      case 'user-info':
      case 'calc-inputs':
      case 'calc-results':
        return 54 + Math.ceil((blk.content.fields?.length || 3) / 2) * 34;
      case 'signature':
      case 'prepared-by':
      case 'checked-by':
      case 'approved-by':
        return 100;
      default:
        return 78 + Math.min(200, Math.ceil((blk.content.text?.length || 40) / 90) * 20);
    }
  };

  const pushCurrentPage = () => {
    if (currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
    }
    currentRowWidth = 0;
    rowMaxHeight = 0;
    usedHeight = 0;
  };

  for (const blk of visible) {
    if (blk.type === 'page-break') {
      pushCurrentPage();
      continue;
    }

    // Handle multi-page splitting for tall tables with repeated header
    if (blk.type === 'table' && (blk.content.tableRows?.length || 0) > 5) {
      const allRows = blk.content.tableRows || [];
      const availablePx = Math.max(120, printableHeightPx - usedHeight - rowMaxHeight - 75);
      const firstBatchCapacity = Math.max(3, Math.floor(availablePx / 32));
      if (allRows.length > firstBatchCapacity) {
        let cursor = 0;
        let partIndex = 0;
        while (cursor < allRows.length) {
          const cap =
            partIndex === 0
              ? firstBatchCapacity
              : Math.max(6, Math.floor((printableHeightPx - 95) / 30));
          const chunk = allRows.slice(cursor, cursor + cap);
          const partBlock: ReportBlock = {
            ...blk,
            id: `${blk.id}_part_${partIndex}`,
            content: {
              ...blk.content,
              text:
                partIndex === 0
                  ? blk.content.text
                  : `${blk.content.text || 'Data Table'} (Continued)`,
              tableRows: chunk,
            },
          };
          if (partIndex > 0) {
            pushCurrentPage();
          }
          currentPage.push(partBlock);
          usedHeight += 68 + chunk.length * 30;
          cursor += cap;
          partIndex++;
        }
        currentRowWidth = 0;
        rowMaxHeight = 0;
        continue;
      }
    }

    const estH = estimateHeight(blk);
    const willWrapRow = currentRowWidth + blk.widthPercent > 100;
    const projectedH = willWrapRow
      ? usedHeight + rowMaxHeight + estH
      : usedHeight + Math.max(rowMaxHeight, estH);

    if (currentPage.length > 0 && projectedH > printableHeightPx) {
      pushCurrentPage();
    }

    if (currentRowWidth + blk.widthPercent > 100) {
      usedHeight += rowMaxHeight;
      currentRowWidth = 0;
      rowMaxHeight = 0;
    }
    currentPage.push(blk);
    currentRowWidth += blk.widthPercent;
    rowMaxHeight = Math.max(rowMaxHeight, estH);
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }
  if (pages.length === 0) {
    pages.push([]);
  }
  return pages;
}

export async function generateQrCodeDataUrl(value: string): Promise<string> {
  if (!value.trim()) return '';
  try {
    return await QRCode.toDataURL(value.trim(), {
      width: 180,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch {
    return '';
  }
}

export async function renderPagesToPdf(
  pageElements: HTMLElement[],
  design: ReportPageDesign,
  fileNameBase: string
): Promise<{ pdf: jsPDF; base64: string; filename: string }> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font readiness rejection
    }
  }

  const { widthMm, heightMm } = getPageDimensionsMm(design);
  const pageWidthPx = Math.round((widthMm * 96) / 25.4);
  const pageHeightPx = Math.round((heightMm * 96) / 25.4);
  const orientation: 'portrait' | 'landscape' = widthMm > heightMm ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [widthMm, heightMm],
  });

  for (let i = 0; i < pageElements.length; i++) {
    const el = pageElements[i];
    if (!el) continue;
    if (i > 0) {
      pdf.addPage([widthMm, heightMm], orientation);
    }

    const captureW = el.offsetWidth || pageWidthPx;
    const captureH = el.offsetHeight || pageHeightPx;
    const captureOpts = {
      quality: 0.98,
      pixelRatio: 2,
      backgroundColor: design.backgroundColor || '#ffffff',
      width: captureW,
      height: captureH,
      style: {
        transform: 'none',
        transformOrigin: 'top left',
        margin: '0',
      },
    };

    let dataUrl = '';
    try {
      dataUrl = await toPng(el, captureOpts);
    } catch {
      dataUrl = await toPng(el, { ...captureOpts, skipFonts: true });
    }

    const ratioH = (captureH / Math.max(1, captureW)) * widthMm;
    const drawH = Math.min(heightMm, ratioH);
    pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, drawH);
  }

  const safeName = `${fileNameBase.replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`;
  const dataUri = pdf.output('datauristring');
  const base64 = dataUri.split(',')[1] || '';
  return { pdf, base64, filename: safeName };
}

export function hasReportTableData(blocks: ReportBlock[]): boolean {
  return blocks.some(
    (b) =>
      b.visible &&
      ((b.type === 'table' && (b.content.tableRows?.length || 0) > 0) ||
        (b.content.fields && b.content.fields.length > 0) ||
        (b.type === 'chart' && (b.content.chartSeries?.length || 0) > 0))
  );
}

export function buildReportExcelWorkbook(
  reportTitle: string,
  reportNumber: string,
  blocks: ReportBlock[]
): { workbook: XLSX.WorkBook; base64: string; filename: string } {
  const wb = XLSX.utils.book_new();
  const metaRows: Array<Array<string>> = [
    ['Report Title', reportTitle],
    ['Report Number', reportNumber],
    ['Exported At', new Date().toISOString()],
  ];

  for (const blk of blocks.filter((b) => b.visible)) {
    if (blk.content.fields?.length) {
      metaRows.push(['', '']);
      metaRows.push([blk.label, '']);
      for (const f of blk.content.fields) {
        metaRows.push([f.label, f.value]);
      }
    }
    if (blk.type === 'calc-formula' && blk.content.formulaExpression) {
      metaRows.push(['Formula', blk.content.formulaExpression]);
      if (blk.content.formulaSteps) metaRows.push(['Steps', blk.content.formulaSteps]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), 'Summary');

  let tableIdx = 1;
  for (const blk of blocks.filter((b) => b.visible && b.type === 'table')) {
    const headers = blk.content.tableHeaders || [];
    const rows = blk.content.tableRows || [];
    const sheetName = `${tableIdx}_${(blk.content.text || 'Table').replace(/[^a-zA-Z0-9]/g, '')}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), sheetName || `Table_${tableIdx}`);
    tableIdx++;
  }

  let chartIdx = 1;
  for (const blk of blocks.filter((b) => b.visible && b.type === 'chart' && (b.content.chartSeries?.length || 0) > 0)) {
    const chartSheet = [['Label', 'Value'], ...(blk.content.chartSeries || []).map((c) => [c.label, c.value])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(chartSheet), `Chart_${chartIdx++}`);
  }

  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }) as string;
  const filename = `${reportNumber || 'Report'}_${reportTitle.slice(0, 24).replace(/[^a-zA-Z0-9_-]+/g, '_')}.xlsx`;
  return { workbook: wb, base64, filename };
}

export function downloadReportCsv(reportTitle: string, reportNumber: string, blocks: ReportBlock[]) {
  const lines: string[] = [];
  lines.push(`"Report","${reportTitle.replace(/"/g, '""')}"`);
  lines.push(`"Report Number","${reportNumber.replace(/"/g, '""')}"`);
  lines.push('');

  for (const blk of blocks.filter((b) => b.visible)) {
    if (blk.type === 'table' && blk.content.tableHeaders) {
      lines.push(`"${(blk.content.text || blk.label).replace(/"/g, '""')}"`);
      lines.push(blk.content.tableHeaders.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(','));
      for (const row of blk.content.tableRows || []) {
        lines.push(row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
      }
      lines.push('');
    } else if (blk.content.fields?.length) {
      lines.push(`"${blk.label.replace(/"/g, '""')}"`);
      for (const f of blk.content.fields) {
        lines.push(`"${f.label.replace(/"/g, '""')}","${f.value.replace(/"/g, '""')}"`);
      }
      lines.push('');
    }
  }

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportNumber || 'Report'}_${reportTitle.slice(0, 24).replace(/[^a-zA-Z0-9_-]+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
