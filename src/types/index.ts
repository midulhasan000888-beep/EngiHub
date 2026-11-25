export type Language = 'en' | 'bn';
export type ThemeMode = 'light' | 'dark';
export type UserRole = 'user' | 'engineer' | 'admin';

export type NavSection =
  | 'dashboard'
  | 'category'
  | 'normal-calculator'
  | 'math-suite'
  | 'unit-converter'
  | 'translate'
  | 'dictionary'
  | 'excel-studio'
  | 'presentation-maker'
  | 'formula-studio'
  | 'currency-calculator'
  | 'school-formulas'
  | 'google-sync'
  | 'pdf-analyzer'
  | 'reports'
  | 'calendar'
  | 'notepad'
  | 'location'
  | 'history'
  | 'saved'
  | 'profile'
  | 'suggestions'
  | 'about-designer'
  | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  language: Language;
  theme: ThemeMode;
  timezone?: string;
  status: 'active' | 'suspended';
  // Extended Personal Info (optional)
  mobile?: string;
  dateOfBirth?: string;
  gender?: string;
  country?: string;
  division?: string;
  district?: string;
  city?: string;
  address?: string;
  // Educational Info (optional)
  educationLevel?: string;
  institutionName?: string;
  department?: string;
  subject?: string;
  classOrSemester?: string;
  passingYear?: string;
  qualification?: string;
  // Professional Info (optional)
  profession?: string;
  jobTitle?: string;
  companyName?: string;
  workDepartment?: string;
  workExperience?: string;
  skills?: string;
  specialization?: string;
  engineeringDiscipline?: string;
  designation?: string;
  licenseNumber?: string;
  // Account, Quota & Usage
  accountType?: 'free' | 'premium' | 'custom';
  storageLimitMb?: number;
  loginCount?: number;
  lastLoginAtIso?: string;
  deletionRequested?: boolean;
  deletionRequestedAtIso?: string;
  // User Preferences
  defaultCalculator?: 'normal' | 'scientific' | 'engineering';
  preferredUnitSystem?: 'SI' | 'Imperial' | 'Mixed';
  inAppNotifications?: boolean;
  emailNotifications?: boolean;
  profileVisibility?: 'private' | 'team';
  primaryColor?: string;
  secondaryColor?: string;
  themePreset?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameBn: string;
  descriptionEn?: string;
  descriptionBn?: string;
  icon?: string;
  order: number;
  enabled: boolean;
  updatedAt?: unknown;
}

export interface CalculatorInputOption {
  labelEn: string;
  labelBn: string;
  value: number;
}

export interface CalculatorInputField {
  key: string;
  labelEn: string;
  labelBn: string;
  dataType: 'number' | 'select';
  required: boolean;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  unitDimension?: string;
  defaultUnit?: string;
  options?: CalculatorInputOption[];
  helpEn?: string;
  helpBn?: string;
}

export interface CalculatorOutputField {
  key: string;
  labelEn: string;
  labelBn: string;
  expression: string;
  unit?: string;
  precision: number;
  format?: 'decimal' | 'scientific' | 'currency' | 'percentage';
  primary?: boolean;
}

export interface CalculatorCondition {
  id: string;
  expression: string;
  severity: 'info' | 'warning' | 'error';
  messageEn: string;
  messageBn: string;
}

export interface CalculatorDefinition {
  id: string;
  categoryId: string;
  nameEn: string;
  nameBn: string;
  descriptionEn?: string;
  descriptionBn?: string;
  formulaDisplay: string;
  formulaReference?: string;
  explanationEn?: string;
  explanationBn?: string;
  disclaimerEn?: string;
  disclaimerBn?: string;
  inputs: CalculatorInputField[];
  outputs: CalculatorOutputField[];
  conditions?: CalculatorCondition[];
  exampleInputs?: Record<string, number>;
  version: number;
  enabled: boolean;
  published: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface FormulaVersionRecord {
  id: string;
  calculatorId: string;
  version: number;
  snapshot: CalculatorDefinition;
  changeNote?: string;
  createdBy: string;
  createdAt?: unknown;
}

export interface UnitDefinition {
  id: string;
  dimension: string;
  symbol: string;
  nameEn: string;
  nameBn?: string;
  toBaseFactor: number;
  enabled: boolean;
  updatedAt?: unknown;
}

export interface CalculationHistoryEntry {
  id: string;
  userId: string;
  calculatorId: string;
  calculatorNameEn: string;
  calculatorNameBn?: string;
  categoryId?: string;
  inputs: Record<string, { value: number; unit?: string }>;
  outputs: Record<string, { value: number; formatted: string; unit?: string; labelEn: string; labelBn: string }>;
  formulaDisplay?: string;
  note?: string;
  isSaved: boolean;
  createdAt?: unknown;
}

export type ReportElementType =
  | 'company-logo'
  | 'company-name'
  | 'report-title'
  | 'subtitle'
  | 'report-number'
  | 'date-time'
  | 'user-info'
  | 'project-info'
  | 'custom-text'
  | 'paragraph'
  | 'heading'
  | 'table'
  | 'image'
  | 'engineering-drawing'
  | 'chart'
  | 'calc-inputs'
  | 'calc-formula'
  | 'calc-results'
  | 'remarks'
  | 'observations'
  | 'recommendations'
  | 'conclusion'
  | 'signature'
  | 'prepared-by'
  | 'checked-by'
  | 'approved-by'
  | 'header'
  | 'footer'
  | 'page-number'
  | 'qr-code'
  | 'page-break';

export type ReportBlockBindingSource =
  | 'manual'
  | 'calculation'
  | 'pdf_analyzer'
  | 'user_profile'
  | 'calendar'
  | 'saved_calculation';

export interface ReportBlockBindingOptions {
  showInputs: boolean;
  showFormula: boolean;
  showSteps: boolean;
  showResults: boolean;
  showUnits: boolean;
  showWarnings: boolean;
  showReference: boolean;
}

export interface ReportBlockStyle {
  fontFamily?: string;
  fontSizePx?: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidthPx?: number;
  paddingPx?: number;
  marginBottomPx?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  bold?: boolean;
  italic?: boolean;
  tableStriped?: boolean;
  tableHeaderBg?: string;
  tableHeaderColor?: string;
}

export interface ReportBlock {
  id: string;
  type: ReportElementType;
  label: string;
  visible: boolean;
  widthPercent: 25 | 33 | 50 | 66 | 75 | 100;
  minHeightPx?: number;
  style: ReportBlockStyle;
  bindingSource?: ReportBlockBindingSource;
  bindingOptions?: ReportBlockBindingOptions;
  content: {
    text?: string;
    subtext?: string;
    headingLevel?: 1 | 2 | 3;
    imageDataUrl?: string;
    caption?: string;
    scaleLabel?: string;
    drawingCode?: string;
    tableHeaders?: string[];
    tableRows?: string[][];
    chartType?: 'bar' | 'horizontal-bar' | 'line';
    chartSeries?: Array<{ label: string; value: number }>;
    qrValue?: string;
    fields?: Array<{ label: string; value: string }>;
    signerName?: string;
    signerRole?: string;
    signatureDataUrl?: string;
    formulaExpression?: string;
    formulaSteps?: string;
    formulaReference?: string;
    warnings?: string[];
  };
}

export interface ReportPageDesign {
  pageSize: 'a4' | 'letter' | 'legal' | 'custom';
  customWidthMm: number;
  customHeightMm: number;
  orientation: 'portrait' | 'landscape';
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  contentPaddingPx: number;
  backgroundColor: string;
  borderEnabled: boolean;
  borderColor: string;
  borderWidthPx: number;
  fontFamily: string;
  fontSizePx: number;
  fontColor: string;
  lineHeight: number;
  accentColor: string;
  columnGapPx: number;
  showHeaderOnPages: boolean;
  showFooterOnPages: boolean;
  headerStyleBg: string;
  footerStyleBg: string;
  showPageNumbers: boolean;
}

export interface ReportCustomField {
  key: string;
  labelEn: string;
  labelBn: string;
  defaultValue?: string;
}

export interface ReportTemplate {
  id: string;
  nameEn: string;
  nameBn: string;
  category?: string;
  descriptionEn?: string;
  descriptionBn?: string;
  recommended?: boolean;
  lockedByAdmin?: boolean;
  orientation: 'portrait' | 'landscape';
  headerText?: string;
  footerText?: string;
  accentColor?: string;
  showSignature: boolean;
  showChart?: boolean;
  customFields?: ReportCustomField[];
  pageDesign?: ReportPageDesign;
  blocks?: ReportBlock[];
  enabled: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface UserReportTemplate {
  id: string;
  userId: string;
  nameEn: string;
  nameBn?: string;
  category: string;
  description?: string;
  sourceTemplateId?: string;
  orientation: 'portrait' | 'landscape';
  headerText?: string;
  footerText?: string;
  accentColor?: string;
  pageDesign: ReportPageDesign;
  blocks: ReportBlock[];
  sharedWithLink: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReportSectionRecord {
  id: string;
  userId: string;
  title: string;
  blockType: ReportElementType;
  category: string;
  blockData: ReportBlock;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReportAssetRecord {
  id: string;
  userId: string;
  name: string;
  assetType: 'logo' | 'signature' | 'drawing' | 'image';
  dataUrl: string;
  storagePath?: string;
  downloadUrl?: string;
  fileSizeBytes?: number;
  createdAt?: unknown;
}

export interface ReportPayload {
  reportDate: string;
  authorName: string;
  authorEmail?: string;
  clientName?: string;
  projectLocation?: string;
  logoDataUrl?: string;
  attachmentImageDataUrl?: string;
  attachmentCaption?: string;
  customValues: Record<string, string>;
  rows: Array<{ label: string; value: string; unit: string; notes?: string }>;
  chartData?: Array<{ label: string; value: number }>;
  remarks: string;
  preparedBy: string;
  approvedBy?: string;
}

export interface GeneratedReport {
  id: string;
  userId: string;
  templateId: string;
  reportNumber: string;
  title: string;
  companyName?: string;
  projectName?: string;
  category?: string;
  orientation: 'portrait' | 'landscape';
  payload: ReportPayload;
  pageDesign?: ReportPageDesign;
  blocks?: ReportBlock[];
  pdfStoragePath?: string;
  pdfDownloadUrl?: string;
  pdfFileSizeBytes?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EmailHistoryRecord {
  id: string;
  userId: string;
  reportId?: string;
  reportNumber?: string;
  reportTitle: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  messageBody?: string;
  hasPdfAttachment?: boolean;
  hasExcelAttachment?: boolean;
  provider: 'gmail_oauth' | 'resend' | 'smtp_relay';
  providerMessageId?: string;
  deliveryStatus: 'submitted' | 'sent' | 'delivered' | 'failed';
  statusNote?: string;
  errorDetail?: string;
  sentAtIso: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReportSettingsRecord {
  id: string;
  defaultCompanyName?: string;
  defaultAccentColor?: string;
  defaultFontFamily?: string;
  defaultHeaderText?: string;
  defaultFooterText?: string;
  defaultMarginMm?: number;
  allowUserCustomTemplates: boolean;
  allowCustomPageSizes: boolean;
  allowEmailDispatch: boolean;
  allowExcelExport: boolean;
  disabledElementTypes?: ReportElementType[];
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  attachedNoteId?: string;
  category?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReminderItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  customIntervalDays?: number;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  location?: string;
  notified?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'reminder' | 'system' | 'broadcast';
  read: boolean;
  createdAt?: unknown;
}

export interface PersonalNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  date?: string;
  imageDataUrl?: string;
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  linkedEventId?: string;
  linkedCalculationId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AiPdfConfig {
  enabled: boolean;
  maxFileSizeMb: number;
  maxPagesPerFile: number;
  dailyUserAnalysisLimit: number;
  allowOcrAndVision: boolean;
  allowDocComparison: boolean;
  allowCalculatorBridge: boolean;
  allowSharing: boolean;
  stripPiiBeforeAi: boolean;
  allowedCategories: string[];
  allowedRoles: UserRole[];
  preferredModel: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
  reasoningLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  aiProvider?: 'gemini' | 'openai' | 'anthropic';
  allowWebsiteUrls?: boolean;
  allowMultiUrlAnalysis?: boolean;
  allowResearchMode?: boolean;
  allowDocumentUpload?: boolean;
  allowImageInput?: boolean;
  enableEngineeringMode?: boolean;
}

export interface ModuleFeatureFlags {
  excelEnabled: boolean;
  presentationEnabled: boolean;
  formulaStudioEnabled: boolean;
  allowUserCustomFormulas: boolean;
  maxCustomFormulasPerUser: number;
  currencyEnabled: boolean;
  schoolLibraryEnabled: boolean;
  googleSyncEnabled: boolean;
  translateEnabled?: boolean;
  dictionaryEnabled?: boolean;
  normalCalculatorEnabled?: boolean;
  scientificCalculatorEnabled?: boolean;
  suggestionsEnabled?: boolean;
}

export interface TranslateAdminConfig {
  enabled: boolean;
  dailyCharLimit: number;
  monthlyCharLimit: number;
  allowedLanguages: string[];
  defaultSourceLang: string;
  defaultTargetLang: string;
}

export interface DictionaryAdminConfig {
  enabled: boolean;
  allowAiExplanations: boolean;
  defaultDomain: 'general' | 'engineering' | 'scientific' | 'mathematical' | 'electrical' | 'mechanical' | 'civil';
}

export interface CalculatorAdminConfig {
  normalEnabled: boolean;
  scientificEnabled: boolean;
  defaultPrecision: 'auto' | '0' | '2' | '4' | '6';
  allowCloudHistory: boolean;
}

export interface StorageAdminConfig {
  pdfUploadEnabled: boolean;
  maxFileSizeMb: number;
  freeUserQuotaMb: number;
  premiumUserQuotaMb: number;
  fileRetentionDays: number;
}

export interface ProfileAdminConfig {
  allowMobileField: boolean;
  allowEducationFields: boolean;
  allowProfessionalFields: boolean;
  allowAccountDeletionRequest: boolean;
}

export interface AppSettings {
  id: string;
  platformNameEn: string;
  platformNameBn?: string;
  defaultLanguage: Language;
  hijriOffsetDays?: number;
  banglaCalendarVariant?: 'revised' | 'traditional';
  maintenanceMode: boolean;
  announcementBanner?: string;
  aiPdfConfig?: AiPdfConfig;
  moduleFlags?: ModuleFeatureFlags;
  translateConfig?: TranslateAdminConfig;
  dictionaryConfig?: DictionaryAdminConfig;
  calculatorConfig?: CalculatorAdminConfig;
  storageConfig?: StorageAdminConfig;
  profileConfig?: ProfileAdminConfig;
  updatedAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorEmail?: string;
  action: string;
  targetCollection: string;
  targetId: string;
  summary: string;
  createdAt?: unknown;
}

export interface PdfKeyFinding {
  text: string;
  page: number;
  type: 'fact' | 'interpretation' | 'warning';
}

export interface PdfExtractedNumber {
  label: string;
  value: number;
  unit: string;
  page: number;
  rawText: string;
  calculatorHint?: string;
}

export interface PdfExtractedFormula {
  name: string;
  expression: string;
  variables?: string;
  page: number;
}

export interface PdfExtractedSpec {
  category: string;
  parameter: string;
  value: string;
  unit?: string;
  page: number;
  reference?: string;
}

export interface PdfExtractedTable {
  id: string;
  title: string;
  page: number;
  headers: string[];
  rows: string[][];
}

export interface PdfWarningItem {
  severity: 'info' | 'warning' | 'error';
  message: string;
  page: number;
  source?: string;
}

export interface PdfDocumentRecord {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  category: string;
  specialty: 'general' | 'electrical' | 'mechanical' | 'civil';
  fileSizeBytes: number;
  pageCount: number;
  ocrPagesCount: number;
  processingStatus: 'uploading' | 'extracting' | 'analyzing' | 'ready' | 'error';
  processingProgress: number;
  processingError?: string;
  storagePath?: string;
  downloadUrl?: string;
  documentType?: string;
  summaryEn?: string;
  summaryBn?: string;
  keyFindings?: PdfKeyFinding[];
  extractedNumbers?: PdfExtractedNumber[];
  extractedFormulas?: PdfExtractedFormula[];
  extractedSpecs?: PdfExtractedSpec[];
  extractedTables?: PdfExtractedTable[];
  warnings?: PdfWarningItem[];
  sharedWithLink: boolean;
  folderId?: string;
  sourceType?: 'pdf' | 'text' | 'url' | 'multi_url' | 'document' | 'image';
  sourceUrl?: string;
  sourceUrls?: string[];
  mimeType?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PdfPageRecord {
  id: string;
  documentId: string;
  userId: string;
  pageNumber: number;
  text: string;
  isScanned: boolean;
  ocrApplied: boolean;
  diagramSummary?: string;
  thumbnailDataUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PdfChatCitation {
  docId?: string;
  docTitle: string;
  page: number;
  excerpt: string;
  sourceType?: string;
  url?: string;
  sourceTitle?: string;
}

export interface PdfChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sourceBasedAnswer?: string;
  aiGeneralKnowledge?: string;
  confidence?: 'high' | 'medium' | 'low' | 'none';
  analysisMode?: 'standard' | 'research' | 'engineering';
  missingInfo?: boolean;
  extractedFacts?: string[];
  aiInterpretation?: string;
  citations?: PdfChatCitation[];
  table?: {
    title?: string;
    headers: string[];
    rows: string[][];
  };
  createdAtIso: string;
}

export interface PdfChatThread {
  id: string;
  userId: string;
  title: string;
  documentIds: string[];
  messages: PdfChatMessage[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PdfComparisonRecord {
  id: string;
  userId: string;
  title: string;
  baseDocId: string;
  compareDocId: string;
  focusArea: string;
  summary: string;
  addedItems: Array<{ item: string; details: string; pageRef: string; impact?: string }>;
  removedItems: Array<{ item: string; details: string; pageRef: string; impact?: string }>;
  modifiedItems: Array<{
    parameter: string;
    oldValue: string;
    newValue: string;
    basePageRef?: string;
    comparePageRef?: string;
    deltaNote?: string;
  }>;
  createdAt?: unknown;
}

export interface UserAiUsageRecord {
  id: string;
  userId: string;
  date: string;
  analysisCount: number;
  questionCount: number;
  comparisonCount: number;
  updatedAt?: unknown;
}

// =========================================================================
// MODULE 1: ADVANCED EXCEL SHEET GENERATOR
// =========================================================================
export type SpreadsheetNumberFormat = 'general' | 'number' | 'percentage' | 'currency' | 'date';
export type SpreadsheetAlign = 'left' | 'center' | 'right';
export type SpreadsheetChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'data-table';

export interface SpreadsheetCellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontColor?: string;
  bgColor?: string;
  border?: boolean;
  borderColor?: string;
  align?: SpreadsheetAlign;
  wrapText?: boolean;
  numberFormat?: SpreadsheetNumberFormat;
  currencySymbol?: string;
}

export interface SpreadsheetValidationRule {
  type: 'list' | 'number_range' | 'required';
  listOptions?: string[];
  min?: number;
  max?: number;
}

export interface SpreadsheetConditionalRule {
  id: string;
  range: string; // e.g., "C2:C20"
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';
  value: string;
  bgColor: string;
  fontColor: string;
}

export interface SpreadsheetCellData {
  raw: string; // formula starting with '=' or plain value
  style?: SpreadsheetCellStyle;
  validation?: SpreadsheetValidationRule;
}

export interface SpreadsheetMergeRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface SpreadsheetChartConfig {
  id: string;
  type: SpreadsheetChartType;
  title: string;
  labelRange: string; // e.g. "A2:A8"
  dataRange: string; // e.g. "B2:D8"
  showLegend: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface SpreadsheetWorksheet {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
  freezeRows: number;
  freezeCols: number;
  colWidths?: Record<string, number>;
  cells: Record<string, SpreadsheetCellData>; // key: "R0C0" or "A1" -> we use "A1" notation
  merges?: SpreadsheetMergeRange[];
  conditionalRules?: SpreadsheetConditionalRule[];
  charts?: SpreadsheetChartConfig[];
}

export interface SpreadsheetWorkbookRecord {
  id: string;
  userId: string;
  title: string;
  category: string;
  activeSheetId: string;
  sheets: SpreadsheetWorksheet[];
  sharedWithLink: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SpreadsheetTemplateRecord {
  id: string;
  nameEn: string;
  nameBn: string;
  category: string;
  descriptionEn: string;
  descriptionBn: string;
  sheets: SpreadsheetWorksheet[];
  recommended?: boolean;
  enabled: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface SpreadsheetHistoryRecord {
  id: string;
  userId: string;
  spreadsheetId: string;
  title: string;
  action: 'create' | 'save' | 'export_xlsx' | 'export_csv' | 'export_pdf' | 'calc_push';
  summary: string;
  createdAt?: unknown;
}

// =========================================================================
// MODULE 2: STUDENT PRESENTATION MAKER
// =========================================================================
export type PresentationClassLevel =
  | 'Class 1' | 'Class 2' | 'Class 3' | 'Class 4' | 'Class 5'
  | 'Class 6' | 'Class 7' | 'Class 8' | 'Class 9' | 'Class 10'
  | 'College' | 'University';

export type PresentationTransition = 'none' | 'fade' | 'slide' | 'zoom';
export type PresentationAnimation = 'none' | 'fade-in' | 'slide-up' | 'pop';

export interface PresentationSlideElement {
  id: string;
  kind: 'text' | 'bullets' | 'shape' | 'diagram' | 'chart' | 'image' | 'table';
  xPercent: number;
  yPercent: number;
  wPercent: number;
  hPercent: number;
  text?: string;
  bullets?: string[];
  shapeType?: 'rectangle' | 'rounded' | 'circle' | 'arrow-right' | 'callout';
  diagramNodes?: string[];
  diagramType?: 'process' | 'hierarchy' | 'cycle';
  chartType?: 'bar' | 'line' | 'pie';
  chartTitle?: string;
  chartSeries?: Array<{ label: string; value: number }>;
  imageDataUrl?: string;
  imageCaption?: string;
  tableHeaders?: string[];
  tableRows?: string[][];
  fontSize?: number;
  fontColor?: string;
  bgColor?: string;
  borderColor?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  animation?: PresentationAnimation;
}

export interface PresentationSlide {
  id: string;
  order: number;
  layout: 'title' | 'content' | 'two-column' | 'diagram' | 'chart' | 'conclusion' | 'references';
  title: string;
  subtitle?: string;
  backgroundColor: string;
  accentColor: string;
  fontFamily: string;
  titleColor: string;
  textColor: string;
  transition: PresentationTransition;
  speakerNotes?: string;
  elements: PresentationSlideElement[];
}

export interface PresentationTheme {
  id: string;
  nameEn: string;
  nameBn: string;
  bgColor: string;
  titleBgColor: string;
  accentColor: string;
  titleColor: string;
  textColor: string;
  fontFamily: string;
}

export interface PresentationRecord {
  id: string;
  userId: string;
  title: string;
  topic: string;
  classLevel: PresentationClassLevel;
  subject: string;
  language: Language;
  level: 'beginner' | 'intermediate' | 'advanced';
  themeId: string;
  audience?: string;
  purpose?: string;
  slides: PresentationSlide[];
  references?: string[];
  sharedWithLink: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PresentationTemplateRecord {
  id: string;
  nameEn: string;
  nameBn: string;
  category: string;
  subject: string;
  classLevel: PresentationClassLevel;
  descriptionEn: string;
  descriptionBn: string;
  themeId: string;
  slides: PresentationSlide[];
  enabled: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

// =========================================================================
// MODULE 3: CUSTOM ENGINEERING FORMULA STUDIO
// =========================================================================
export interface CustomFormulaIntermediateVar {
  id: string;
  key: string;
  labelEn: string;
  labelBn: string;
  expression: string;
  unit?: string;
}

export interface CustomFormulaRecord extends CalculatorDefinition {
  userId: string;
  authorName?: string;
  authorEmail?: string;
  intermediateVars?: CustomFormulaIntermediateVar[];
  showSteps?: boolean;
  showExplanation?: boolean;
  reportTemplateId?: string;
  visibility: 'private' | 'public' | 'shared';
  approvedByAdmin: boolean;
  createdAt?: unknown;
}

export interface FormulaTestCaseRecord {
  id: string;
  formulaId: string;
  userId: string;
  name: string;
  inputs: Record<string, number>;
  expectedOutputs: Record<string, number>;
  tolerancePercent: number;
  lastPassed?: boolean;
  lastRunAtIso?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// =========================================================================
// MODULE 4: INTERNATIONAL CURRENCY CALCULATOR
// =========================================================================
export interface CurrencyDefinition {
  code: string;
  nameEn: string;
  nameBn: string;
  countryEn: string;
  countryBn: string;
  symbol: string;
}

export interface CurrencyRatesCacheRecord {
  id: string; // e.g., base currency code like 'USD'
  baseCurrency: string;
  rates: Record<string, number>;
  source: string;
  fetchedAtIso: string;
  rateTimestamp: string;
  isStale: boolean;
  updatedAt?: unknown;
}

export interface CurrencyHistoryRecord {
  id: string;
  userId: string;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  rate: number;
  convertedAmount: number;
  rateDate: string;
  source: string;
  isHistorical: boolean;
  isStale?: boolean;
  createdAt?: unknown;
}

export interface CurrencySettingsRecord {
  id: string;
  preferredProvider: 'open-er-api' | 'frankfurter';
  defaultBaseCurrency: string;
  defaultTargetCurrency: string;
  autoRefreshMinutes: number;
  allowHistorical: boolean;
  allowExcelPdfExport: boolean;
  enabled: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

// =========================================================================
// MODULE 5: CLASS 1-10 FORMULA LIBRARY
// =========================================================================
export interface SchoolFormulaSymbol {
  symbol: string;
  meaningEn: string;
  meaningBn: string;
  unit?: string;
}

export interface SchoolPracticeQuestion {
  questionEn: string;
  questionBn: string;
  answerEn: string;
  answerBn: string;
}

export interface SchoolFormulaRecord {
  id: string;
  classLevel: number; // 1..10
  subject:
    | 'Mathematics'
    | 'General Mathematics'
    | 'Higher Mathematics'
    | 'Physics'
    | 'Chemistry'
    | 'Science'
    | 'Geometry'
    | 'Mensuration'
    | 'Algebra'
    | 'Trigonometry'
    | 'Statistics';
  chapterEn: string;
  chapterBn: string;
  nameEn: string;
  nameBn: string;
  expression: string;
  explanationBn: string;
  explanationEn: string;
  symbols: SchoolFormulaSymbol[];
  siUnit: string;
  unitConversionNoteEn?: string;
  unitConversionNoteBn?: string;
  exampleEn: string;
  exampleBn: string;
  stepByStepEn: string;
  stepByStepBn: string;
  commonMistakesEn: string;
  commonMistakesBn: string;
  practiceQuestions: SchoolPracticeQuestion[];
  relatedIds?: string[];
  reference: string;
  curriculumVersion: string;
  calculatorInputs?: CalculatorInputField[];
  calculatorOutputs?: CalculatorOutputField[];
  verified: boolean;
  published: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface SchoolFormulaReferenceRecord {
  id: string;
  classLevel: number;
  subject: string;
  textbookTitleEn: string;
  textbookTitleBn: string;
  edition: string;
  publisher: string;
  chapters: string[];
  updatedAt?: unknown;
}

// =========================================================================
// MODULE 6: GOOGLE INTEGRATION & AUTOMATIC UPDATE CENTER
// =========================================================================
export interface GoogleConnectionRecord {
  id: string;
  userId: string;
  email: string;
  connectedCalendar: boolean;
  connectedSheets: boolean;
  connectedGmail: boolean;
  calendarId?: string;
  lastSyncedAtIso?: string;
  updatedAt?: unknown;
}

export interface GoogleSyncJobRecord {
  id: string;
  userId: string;
  service: 'calendar' | 'sheets';
  direction: 'export' | 'import' | 'two-way';
  resourceName: string;
  scheduleMinutes: number;
  enabled: boolean;
  lastRunAtIso?: string;
  nextRunAtIso?: string;
  status: 'idle' | 'running' | 'success' | 'error';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GoogleSyncLogRecord {
  id: string;
  userId: string;
  service: 'calendar' | 'sheets' | 'auth';
  action: string;
  status: 'success' | 'skipped' | 'error';
  itemsSynced: number;
  conflictsSkipped: number;
  errorMessage?: string;
  ranAtIso: string;
  createdAt?: unknown;
}

export interface UpdateScheduleRecord {
  id: string;
  userId: string;
  sourceKey:
    | 'currency_rates'
    | 'school_formulas'
    | 'custom_formulas'
    | 'google_calendar'
    | 'google_sheets'
    | 'app_catalog';
  labelEn: string;
  labelBn: string;
  intervalMinutes: number;
  enabled: boolean;
  autoRetry: boolean;
  lastRunAtIso?: string;
  nextRunAtIso?: string;
  status: 'idle' | 'success' | 'error';
  updatedAt?: unknown;
}

export interface UpdateLogRecord {
  id: string;
  userId: string;
  sourceKey: string;
  status: 'success' | 'failed' | 'skipped';
  summary: string;
  errorMessage?: string;
  ranAtIso: string;
  createdAt?: unknown;
}

export interface UserExportRecord {
  id: string;
  userId: string;
  module: 'excel' | 'presentation' | 'report' | 'currency' | 'formula';
  title: string;
  format: 'xlsx' | 'csv' | 'pdf' | 'pptx' | 'json';
  storagePath?: string;
  downloadUrl?: string;
  fileSizeBytes?: number;
  createdAt?: unknown;
}

// =========================================================================
// NEW EXPANSION MODULES (TRANSLATE, DICTIONARY, PDF FOLDERS, SUGGESTIONS, DESIGNER)
// =========================================================================
export interface PdfFolderRecord {
  id: string;
  userId: string;
  name: string;
  color?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserStorageUsageRecord {
  id: string;
  userId: string;
  totalBytes: number;
  totalFiles: number;
  totalPages: number;
  quotaBytes: number;
  lastUploadAtIso?: string;
  updatedAt?: unknown;
}

export interface TranslationHistoryRecord {
  id: string;
  userId: string;
  sourceLang: string;
  targetLang: string;
  detectedLang?: string;
  sourceText: string;
  translatedText: string;
  mode: 'standard' | 'technical' | 'student' | 'paragraph';
  provider: string;
  isFavourite: boolean;
  createdAt?: unknown;
}

export interface FavouriteTranslationRecord {
  id: string;
  userId: string;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
  mode: 'standard' | 'technical' | 'student' | 'paragraph';
  createdAt?: unknown;
}

export type DictionaryDomain =
  | 'general'
  | 'engineering'
  | 'scientific'
  | 'mathematical'
  | 'electrical'
  | 'mechanical'
  | 'civil';

export interface DictionaryLookupResult {
  word: string;
  meaningBn: string;
  multipleMeaningsBn: string[];
  englishDefinition: string;
  partOfSpeech: string;
  phonetic: string;
  audioUrl?: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
  relatedWords: string[];
  meaningsByPos?: Array<{
    partOfSpeech: string;
    definitions: Array<{ definition: string; example: string }>;
    synonyms: string[];
    antonyms: string[];
  }>;
  domainNote?: string;
  sourceName: string;
  aiExplanationGenerated: boolean;
}

export interface DictionaryHistoryRecord {
  id: string;
  userId: string;
  word: string;
  direction: 'en-bn' | 'bn-en' | 'auto';
  domain: DictionaryDomain;
  meaningBn: string;
  englishDefinition: string;
  partOfSpeech: string;
  phonetic?: string;
  sourceName: string;
  aiExplanationGenerated: boolean;
  createdAt?: unknown;
}

export interface FavouriteWordRecord {
  id: string;
  userId: string;
  word: string;
  meaningBn: string;
  englishDefinition: string;
  partOfSpeech: string;
  phonetic?: string;
  domain: DictionaryDomain;
  examples?: string[];
  synonyms?: string[];
  antonyms?: string[];
  createdAt?: unknown;
}

export interface CalculatorHistoryRecord {
  id: string;
  userId: string;
  mode: 'normal' | 'scientific' | 'engineering';
  expression: string;
  result: string;
  unit?: string;
  steps?: string;
  inputsSummary?: string;
  createdAt?: unknown;
}

export type SuggestionCategory =
  | 'New Feature Request'
  | 'Calculator Improvement'
  | 'Formula Request'
  | 'Engineering Feature'
  | 'Excel Feature'
  | 'Presentation Feature'
  | 'PDF Feature'
  | 'Translation Improvement'
  | 'Dictionary Improvement'
  | 'Bug Report'
  | 'Design Improvement'
  | 'Other Suggestions';

export type SuggestionStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Accepted'
  | 'In Development'
  | 'Completed'
  | 'Rejected';

export interface SuggestionRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  title: string;
  category: SuggestionCategory;
  description: string;
  relatedModule: string;
  attachmentDataUrl?: string;
  priority: 'low' | 'medium' | 'high';
  visibility: 'public' | 'private';
  status: SuggestionStatus;
  adminReply?: string;
  internalNote?: string;
  isImportant?: boolean;
  isDevelopmentTask?: boolean;
  voteCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SuggestionVoteRecord {
  id: string; // `${suggestionId}_${userId}`
  suggestionId: string;
  userId: string;
  createdAt?: unknown;
}

export interface DesignerInfoRecord {
  id: string;
  nameBn: string;
  nameEn: string;
  designationBn: string;
  designationEn: string;
  mobile: string;
  email?: string;
  aboutBn: string;
  aboutEn: string;
  visionBn: string;
  visionEn: string;
  missionBn: string;
  missionEn: string;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface ApiUsageLogRecord {
  id: string;
  userId: string;
  service: 'translate' | 'dictionary';
  status: 'success' | 'error' | 'setup_required';
  charsCount: number;
  detail: string;
  createdAt?: unknown;
}

export interface UserActivityLogRecord {
  id: string;
  userId: string;
  action: string;
  module: string;
  summary: string;
  createdAt?: unknown;
}



