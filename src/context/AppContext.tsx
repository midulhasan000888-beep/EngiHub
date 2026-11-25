import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteUserFileFromStorage } from '../engine/cloudStorage';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  testConnection,
} from '../firebase';
import {
  ApiUsageLogRecord,
  AppSettings,
  AuditLogEntry,
  CalculationHistoryEntry,
  CalculatorDefinition,
  CalculatorHistoryRecord,
  CalendarEvent,
  Category,
  CurrencyHistoryRecord,
  CurrencySettingsRecord,
  CustomFormulaRecord,
  DesignerInfoRecord,
  DictionaryHistoryRecord,
  EmailHistoryRecord,
  FavouriteTranslationRecord,
  FavouriteWordRecord,
  FormulaTestCaseRecord,
  GeneratedReport,
  GoogleConnectionRecord,
  GoogleSyncJobRecord,
  GoogleSyncLogRecord,
  Language,
  NavSection,
  NotificationItem,
  PdfChatThread,
  PdfComparisonRecord,
  PdfDocumentRecord,
  PdfExtractedTable,
  PdfFolderRecord,
  PersonalNote,
  PresentationRecord,
  PresentationTemplateRecord,
  ReminderItem,
  ReportAssetRecord,
  ReportBlock,
  ReportPageDesign,
  ReportPayload,
  ReportSectionRecord,
  ReportSettingsRecord,
  ReportTemplate,
  SchoolFormulaRecord,
  SchoolFormulaReferenceRecord,
  SpreadsheetHistoryRecord,
  SpreadsheetTemplateRecord,
  SpreadsheetWorkbookRecord,
  SuggestionCategory,
  SuggestionRecord,
  SuggestionStatus,
  SuggestionVoteRecord,
  ThemeMode,
  TranslationHistoryRecord,
  UnitDefinition,
  UpdateLogRecord,
  UpdateScheduleRecord,
  UserActivityLogRecord,
  UserAiUsageRecord,
  UserExportRecord,
  UserProfile,
  UserReportTemplate,
  UserStorageUsageRecord,
} from '../types';
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_DESIGNER_INFO,
  SEED_CALCULATORS,
  SEED_CATEGORIES,
  SEED_REPORT_TEMPLATES,
} from '../data/seedCatalog';
import { BUILTIN_UNITS } from '../engine/unitConverter';
import { DEFAULT_REPORT_SETTINGS } from '../engine/reportDesignerUtils';

export interface PendingReportDraft {
  title: string;
  rows: ReportPayload['rows'];
  chartData?: ReportPayload['chartData'];
  remarks?: string;
  sourceType?: 'calculation' | 'pdf_analyzer' | 'saved_calculation';
  formulaDisplay?: string;
  formulaReference?: string;
  stepsText?: string;
  inputsList?: Array<{ label: string; value: string }>;
  outputsList?: Array<{ label: string; value: string }>;
  warnings?: string[];
  tables?: Array<{ title: string; headers: string[]; rows: string[][] }>;
}

export interface PendingNoteDraft {
  title: string;
  content: string;
  category: string;
  linkedCalculationId?: string;
}

export interface PendingCalculatorPrefill {
  calculatorId: string;
  inputs: Record<string, number>;
  units?: Record<string, string>;
  sourceDocTitle?: string;
}

export interface PendingExcelPush {
  title: string;
  sheetName: string;
  headers: string[];
  rows: string[][];
}

interface AppContextValue {
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  isAdmin: boolean;
  language: Language;
  theme: ThemeMode;
  activeSection: NavSection;
  activeCategoryId: string;
  activeCalculatorId: string | null;
  globalSearch: string;
  categories: Category[];
  calculators: CalculatorDefinition[];
  units: UnitDefinition[];
  reportTemplates: ReportTemplate[];
  history: CalculationHistoryEntry[];
  reports: GeneratedReport[];
  userReportTemplates: UserReportTemplate[];
  reportSections: ReportSectionRecord[];
  reportAssets: ReportAssetRecord[];
  emailHistory: EmailHistoryRecord[];
  reportSettings: ReportSettingsRecord;
  events: CalendarEvent[];
  reminders: ReminderItem[];
  notifications: NotificationItem[];
  notes: PersonalNote[];
  appSettings: AppSettings;
  auditLogs: AuditLogEntry[];
  allUsers: UserProfile[];
  pdfDocuments: PdfDocumentRecord[];
  pdfFolders: PdfFolderRecord[];
  userStorageUsage: UserStorageUsageRecord | null;
  pdfChats: PdfChatThread[];
  pdfComparisons: PdfComparisonRecord[];
  todayAiUsage: UserAiUsageRecord | null;
  allAiUsage: UserAiUsageRecord[];
  pendingReportDraft: PendingReportDraft | null;
  pendingNoteDraft: PendingNoteDraft | null;
  pendingCalculatorPrefill: PendingCalculatorPrefill | null;
  pendingExcelPush: PendingExcelPush | null;

  spreadsheets: SpreadsheetWorkbookRecord[];
  spreadsheetTemplates: SpreadsheetTemplateRecord[];
  spreadsheetHistory: SpreadsheetHistoryRecord[];
  presentations: PresentationRecord[];
  presentationTemplates: PresentationTemplateRecord[];
  customFormulas: CustomFormulaRecord[];
  publicCustomFormulas: CustomFormulaRecord[];
  formulaTestCases: FormulaTestCaseRecord[];
  schoolFormulas: SchoolFormulaRecord[];
  schoolReferences: SchoolFormulaReferenceRecord[];
  currencyHistory: CurrencyHistoryRecord[];
  currencySettings: CurrencySettingsRecord;
  googleConnection: GoogleConnectionRecord | null;
  googleSyncJobs: GoogleSyncJobRecord[];
  googleSyncLogs: GoogleSyncLogRecord[];
  updateSchedules: UpdateScheduleRecord[];
  updateLogs: UpdateLogRecord[];
  userExports: UserExportRecord[];

  translationHistory: TranslationHistoryRecord[];
  favouriteTranslations: FavouriteTranslationRecord[];
  dictionaryHistory: DictionaryHistoryRecord[];
  favouriteWords: FavouriteWordRecord[];
  calculatorHistory: CalculatorHistoryRecord[];
  suggestions: SuggestionRecord[];
  adminAllSuggestions: SuggestionRecord[];
  suggestionVotes: SuggestionVoteRecord[];
  designerInfo: DesignerInfoRecord;
  apiUsageLogs: ApiUsageLogRecord[];
  userActivityLogs: UserActivityLogRecord[];

  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;

  setLanguage: (lang: Language) => void;
  setTheme: (mode: ThemeMode) => void;
  navigateTo: (section: NavSection, categoryId?: string, calculatorId?: string | null) => void;
  setGlobalSearch: (q: string) => void;
  setPendingReportDraft: (draft: PendingReportDraft | null) => void;
  setPendingNoteDraft: (draft: PendingNoteDraft | null) => void;
  setPendingCalculatorPrefill: (prefill: PendingCalculatorPrefill | null) => void;
  setPendingExcelPush: (push: PendingExcelPush | null) => void;
  sendToExcel: (push: PendingExcelPush) => void;
  openCalculatorWithPrefill: (
    calculatorId: string,
    categoryId: string,
    inputs: Record<string, number>,
    units?: Record<string, string>,
    sourceDocTitle?: string
  ) => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;

  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (patch: Partial<UserProfile>) => Promise<void>;
  requestAccountDeletion: () => Promise<void>;
  downloadMyData: () => void;
  getUserStorageQuotaBytes: (targetProfile?: UserProfile | null) => number;
  getTotalStorageUsedBytes: () => number;

  recordCalculation: (entry: Omit<CalculationHistoryEntry, 'id' | 'userId' | 'createdAt'>) => Promise<string | null>;
  toggleSaveHistory: (id: string, isSaved: boolean) => Promise<void>;
  deleteHistoryEntry: (id: string) => Promise<void>;

  saveGeneratedReport: (report: Omit<GeneratedReport, 'id' | 'userId' | 'createdAt'>) => Promise<string | null>;
  updateGeneratedReport: (
    id: string,
    patch: Partial<
      Pick<
        GeneratedReport,
        | 'title'
        | 'companyName'
        | 'projectName'
        | 'category'
        | 'orientation'
        | 'payload'
        | 'pageDesign'
        | 'blocks'
        | 'pdfStoragePath'
        | 'pdfDownloadUrl'
        | 'pdfFileSizeBytes'
      >
    >
  ) => Promise<void>;
  deleteGeneratedReport: (id: string) => Promise<void>;

  saveUserReportTemplate: (
    tpl: Omit<UserReportTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<string | null>;
  deleteUserReportTemplate: (id: string) => Promise<void>;

  saveReportSection: (
    sec: Omit<ReportSectionRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<string | null>;
  deleteReportSection: (id: string) => Promise<void>;

  saveReportAsset: (
    asset: Omit<ReportAssetRecord, 'id' | 'userId' | 'createdAt'>
  ) => Promise<string | null>;
  deleteReportAsset: (id: string) => Promise<void>;

  saveEmailHistory: (
    entry: Omit<EmailHistoryRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<string | null>;
  updateEmailHistory: (
    id: string,
    patch: Pick<EmailHistoryRecord, 'deliveryStatus' | 'sentAtIso'> &
      Partial<Pick<EmailHistoryRecord, 'providerMessageId' | 'statusNote' | 'errorDetail'>>
  ) => Promise<void>;
  deleteEmailHistory: (id: string) => Promise<void>;

  saveReportSettings: (settings: Omit<ReportSettingsRecord, 'id' | 'updatedAt' | 'updatedBy'>) => Promise<void>;

  saveCalendarEvent: (event: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  deleteCalendarEvent: (id: string) => Promise<void>;

  saveReminder: (rem: Omit<ReminderItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;

  saveNote: (note: Omit<PersonalNote, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  renamePdfDocument: (docId: string, newTitle: string) => Promise<void>;
  togglePdfSharing: (docId: string, shared: boolean) => Promise<void>;
  updatePdfExtractedTables: (docId: string, tables: PdfExtractedTable[]) => Promise<void>;
  deletePdfDocument: (docItem: PdfDocumentRecord) => Promise<void>;
  incrementAiUsage: (kind: 'analysis' | 'question' | 'comparison') => Promise<void>;

  saveSpreadsheetWorkbook: (
    wb: Omit<SpreadsheetWorkbookRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<string | null>;
  deleteSpreadsheetWorkbook: (id: string) => Promise<void>;
  recordSpreadsheetHistory: (
    entry: Omit<SpreadsheetHistoryRecord, 'id' | 'userId' | 'createdAt'>
  ) => Promise<void>;

  savePresentation: (
    deck: Omit<PresentationRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<string | null>;
  deletePresentation: (id: string) => Promise<void>;

  saveCustomFormula: (
    formula: Omit<CustomFormulaRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<string | null>;
  deleteCustomFormula: (id: string) => Promise<void>;
  saveFormulaTestCase: (
    tc: Omit<FormulaTestCaseRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<string | null>;
  deleteFormulaTestCase: (id: string) => Promise<void>;

  recordCurrencyHistory: (
    entry: Omit<CurrencyHistoryRecord, 'id' | 'userId' | 'createdAt'>
  ) => Promise<void>;
  saveCurrencySettings: (
    settings: Omit<CurrencySettingsRecord, 'id' | 'updatedBy' | 'updatedAt'>
  ) => Promise<void>;

  saveGoogleConnection: (
    patch: Omit<GoogleConnectionRecord, 'id' | 'userId' | 'updatedAt'>
  ) => Promise<void>;
  saveGoogleSyncJob: (
    job: Omit<GoogleSyncJobRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<string | null>;
  deleteGoogleSyncJob: (id: string) => Promise<void>;
  recordGoogleSyncLog: (
    entry: Omit<GoogleSyncLogRecord, 'id' | 'userId' | 'createdAt'>
  ) => Promise<void>;
  saveUpdateSchedule: (
    sched: Omit<UpdateScheduleRecord, 'id' | 'userId' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  recordUpdateLog: (
    entry: Omit<UpdateLogRecord, 'id' | 'userId' | 'createdAt'>
  ) => Promise<void>;
  logUserExport: (
    entry: Omit<UserExportRecord, 'id' | 'userId' | 'createdAt'>
  ) => Promise<void>;

  markNotificationRead: (id: string) => Promise<void>;
  sendAdminBroadcast: (title: string, body: string) => Promise<void>;
  seedInitialCatalogToFirestore: () => Promise<void>;
  syncMissingSeedCatalogToFirestore: (silent?: boolean) => Promise<void>;
  logAdminAudit: (action: string, targetCollection: string, targetId: string, summary: string) => Promise<void>;

  savePdfFolder: (folder: { id?: string; name: string; color?: string }) => Promise<string | null>;
  deletePdfFolder: (folderId: string) => Promise<void>;
  movePdfToFolder: (docId: string, folderId: string) => Promise<void>;
  recomputeUserStorageUsage: (
    overrides?:
      | PdfDocumentRecord[]
      | { docs?: PdfDocumentRecord[]; reportsList?: GeneratedReport[]; assetsList?: ReportAssetRecord[] }
  ) => Promise<void>;

  saveTranslationRecord: (
    entry: Omit<TranslationHistoryRecord, 'id' | 'userId' | 'createdAt' | 'isFavourite'>
  ) => Promise<string | null>;
  toggleFavouriteTranslation: (item: TranslationHistoryRecord | FavouriteTranslationRecord, makeFav: boolean) => Promise<void>;
  deleteTranslationRecord: (id: string) => Promise<void>;
  clearTranslationHistory: () => Promise<void>;

  saveDictionaryHistory: (entry: Omit<DictionaryHistoryRecord, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  toggleFavouriteWord: (item: Omit<FavouriteWordRecord, 'id' | 'userId' | 'createdAt'>) => Promise<boolean>;
  clearDictionaryHistory: () => Promise<void>;

  recordCalculatorRun: (entry: Omit<CalculatorHistoryRecord, 'id' | 'userId' | 'createdAt'>) => Promise<string | null>;
  deleteCalculatorRun: (id: string) => Promise<void>;
  clearCalculatorHistory: () => Promise<void>;

  submitSuggestion: (entry: {
    title: string;
    category: SuggestionCategory;
    description: string;
    relatedModule: string;
    attachmentDataUrl?: string;
    priority: 'low' | 'medium' | 'high';
    visibility: 'public' | 'private';
  }) => Promise<string | null>;
  toggleSuggestionVote: (suggestion: SuggestionRecord) => Promise<void>;
  adminUpdateSuggestion: (
    suggestionId: string,
    patch: Partial<{
      status: SuggestionStatus;
      adminReply: string;
      internalNote: string;
      isImportant: boolean;
      isDevelopmentTask: boolean;
    }>
  ) => Promise<void>;

  saveDesignerInfo: (info: Omit<DesignerInfoRecord, 'id' | 'updatedAt' | 'updatedBy'>) => Promise<void>;
  logApiUsage: (entry: Omit<ApiUsageLogRecord, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  logUserActivity: (action: string, module: string, summary: string) => Promise<void>;
}

const DEFAULT_CURRENCY_SETTINGS: CurrencySettingsRecord = {
  id: 'global',
  preferredProvider: 'open-er-api',
  defaultBaseCurrency: 'USD',
  defaultTargetCurrency: 'BDT',
  autoRefreshMinutes: 30,
  allowHistorical: true,
  allowExcelPdfExport: true,
  enabled: true,
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now()}-${rand}`;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('sutro_lang');
    return saved === 'en' ? 'en' : 'bn';
  });
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('sutro_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('electrical');
  const [activeCalculatorId, setActiveCalculatorId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [dbCalculators, setDbCalculators] = useState<CalculatorDefinition[]>([]);
  const [dbUnits, setDbUnits] = useState<UnitDefinition[]>([]);
  const [dbTemplates, setDbTemplates] = useState<ReportTemplate[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const [history, setHistory] = useState<CalculationHistoryEntry[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [userReportTemplates, setUserReportTemplates] = useState<UserReportTemplate[]>([]);
  const [reportSections, setReportSections] = useState<ReportSectionRecord[]>([]);
  const [reportAssets, setReportAssets] = useState<ReportAssetRecord[]>([]);
  const [emailHistory, setEmailHistory] = useState<EmailHistoryRecord[]>([]);
  const [reportSettings, setReportSettings] = useState<ReportSettingsRecord>(DEFAULT_REPORT_SETTINGS);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [pdfDocuments, setPdfDocuments] = useState<PdfDocumentRecord[]>([]);
  const [pdfFolders, setPdfFolders] = useState<PdfFolderRecord[]>([]);
  const [userStorageUsage, setUserStorageUsage] = useState<UserStorageUsageRecord | null>(null);
  const [pdfChats, setPdfChats] = useState<PdfChatThread[]>([]);
  const [pdfComparisons, setPdfComparisons] = useState<PdfComparisonRecord[]>([]);
  const [todayAiUsage, setTodayAiUsage] = useState<UserAiUsageRecord | null>(null);
  const [allAiUsage, setAllAiUsage] = useState<UserAiUsageRecord[]>([]);

  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetWorkbookRecord[]>([]);
  const [spreadsheetTemplates, setSpreadsheetTemplates] = useState<SpreadsheetTemplateRecord[]>([]);
  const [spreadsheetHistory, setSpreadsheetHistory] = useState<SpreadsheetHistoryRecord[]>([]);
  const [presentations, setPresentations] = useState<PresentationRecord[]>([]);
  const [presentationTemplates, setPresentationTemplates] = useState<PresentationTemplateRecord[]>([]);
  const [customFormulas, setCustomFormulas] = useState<CustomFormulaRecord[]>([]);
  const [publicCustomFormulas, setPublicCustomFormulas] = useState<CustomFormulaRecord[]>([]);
  const [formulaTestCases, setFormulaTestCases] = useState<FormulaTestCaseRecord[]>([]);
  const [schoolFormulas, setSchoolFormulas] = useState<SchoolFormulaRecord[]>([]);
  const [schoolReferences, setSchoolReferences] = useState<SchoolFormulaReferenceRecord[]>([]);
  const [currencyHistory, setCurrencyHistory] = useState<CurrencyHistoryRecord[]>([]);
  const [currencySettings, setCurrencySettings] = useState<CurrencySettingsRecord>(DEFAULT_CURRENCY_SETTINGS);
  const [googleConnection, setGoogleConnection] = useState<GoogleConnectionRecord | null>(null);
  const [googleSyncJobs, setGoogleSyncJobs] = useState<GoogleSyncJobRecord[]>([]);
  const [googleSyncLogs, setGoogleSyncLogs] = useState<GoogleSyncLogRecord[]>([]);
  const [updateSchedules, setUpdateSchedules] = useState<UpdateScheduleRecord[]>([]);
  const [updateLogs, setUpdateLogs] = useState<UpdateLogRecord[]>([]);
  const [userExports, setUserExports] = useState<UserExportRecord[]>([]);

  const [translationHistory, setTranslationHistory] = useState<TranslationHistoryRecord[]>([]);
  const [favouriteTranslations, setFavouriteTranslations] = useState<FavouriteTranslationRecord[]>([]);
  const [dictionaryHistory, setDictionaryHistory] = useState<DictionaryHistoryRecord[]>([]);
  const [favouriteWords, setFavouriteWords] = useState<FavouriteWordRecord[]>([]);
  const [calculatorHistory, setCalculatorHistory] = useState<CalculatorHistoryRecord[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>([]);
  const [adminAllSuggestions, setAdminAllSuggestions] = useState<SuggestionRecord[]>([]);
  const [suggestionVotes, setSuggestionVotes] = useState<SuggestionVoteRecord[]>([]);
  const [designerInfo, setDesignerInfo] = useState<DesignerInfoRecord>(DEFAULT_DESIGNER_INFO);
  const [apiUsageLogs, setApiUsageLogs] = useState<ApiUsageLogRecord[]>([]);
  const [userActivityLogs, setUserActivityLogs] = useState<UserActivityLogRecord[]>([]);

  const [pendingReportDraft, setPendingReportDraft] = useState<PendingReportDraft | null>(null);
  const [pendingNoteDraft, setPendingNoteDraft] = useState<PendingNoteDraft | null>(null);
  const [pendingCalculatorPrefill, setPendingCalculatorPrefill] = useState<PendingCalculatorPrefill | null>(null);
  const [pendingExcelPush, setPendingExcelPush] = useState<PendingExcelPush | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const lastCalcRecordRef = useRef<number>(0);
  const missingSeedSyncedRef = useRef<boolean>(false);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3600);
  }, []);

  // Sync dark class & dynamic brand color palette on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('sutro_theme', theme);
  }, [theme]);

  useEffect(() => {
    const primary = profile?.primaryColor || localStorage.getItem('engihub_primary_color') || '#2563eb';
    const secondary = profile?.secondaryColor || localStorage.getItem('engihub_secondary_color') || '#0f766e';
    const parseHex = (hex: string) => {
      const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
      if (!m) return null;
      return {
        r: parseInt(m[1].slice(0, 2), 16),
        g: parseInt(m[1].slice(2, 4), 16),
        b: parseInt(m[1].slice(4, 6), 16),
      };
    };
    const pRgb = parseHex(primary) || { r: 37, g: 99, b: 235 };
    const sRgb = parseHex(secondary) || { r: 15, g: 118, b: 110 };
    const darken = (c: { r: number; g: number; b: number }, amt = 22) =>
      `rgb(${Math.max(0, c.r - amt)}, ${Math.max(0, c.g - amt)}, ${Math.max(0, c.b - amt)})`;

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--brand-primary', primary);
    rootStyle.setProperty('--brand-primary-hover', darken(pRgb));
    rootStyle.setProperty('--brand-primary-soft', `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.12)`);
    rootStyle.setProperty('--brand-secondary', secondary);
    rootStyle.setProperty('--brand-secondary-soft', `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.12)`);

    if (profile?.primaryColor) localStorage.setItem('engihub_primary_color', profile.primaryColor);
    if (profile?.secondaryColor) localStorage.setItem('engihub_secondary_color', profile.secondaryColor);
  }, [profile?.primaryColor, profile?.secondaryColor]);

  useEffect(() => {
    localStorage.setItem('sutro_lang', language);
  }, [language]);

  // Startup Firestore connectivity check
  useEffect(() => {
    testConnection();
  }, []);

  // Auth listener & User Profile bootstrap
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      try {
        const isBootstrapped =
          firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;
        let adminMarkerExists = false;
        try {
          const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
          adminMarkerExists = adminSnap.exists();
        } catch {
          adminMarkerExists = false;
        }
        const computedAdmin = isBootstrapped || adminMarkerExists;
        setIsAdmin(computedAdmin);

        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || 'user@sutrosathi.app',
            displayName: firebaseUser.displayName || 'Engineer User',
            photoURL: firebaseUser.photoURL || '',
            role: computedAdmin ? 'admin' : 'user',
            language,
            theme,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka',
            status: 'active',
            accountType: 'free',
            loginCount: 1,
            lastLoginAtIso: new Date().toISOString(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        } else {
          const existingData = userSnap.data() as UserProfile;
          const nextLoginCount = (existingData.loginCount || 0) + 1;
          const nextLoginIso = new Date().toISOString();
          setProfile({
            ...existingData,
            loginCount: nextLoginCount,
            lastLoginAtIso: nextLoginIso,
          });
          if (existingData.language) setLanguageState(existingData.language);
          if (existingData.theme) setThemeState(existingData.theme);
          if (existingData.role === 'admin') setIsAdmin(true);
          updateDoc(userRef, {
            loginCount: nextLoginCount,
            lastLoginAtIso: nextLoginIso,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      } catch (err) {
        console.error('Auth profile sync warning:', err);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Public Catalog listeners (Categories, Calculators, Units, Templates, AppSettings)
  useEffect(() => {
    const qCat = isAdmin
      ? query(collection(db, 'categories'), orderBy('order', 'asc'))
      : query(collection(db, 'categories'), where('enabled', '==', true));

    const unsubCats = onSnapshot(
      qCat,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Category).sort((a, b) => a.order - b.order);
        setDbCategories(list);
      },
      (err) => {
        console.warn('Categories listener fallback:', err.message);
      }
    );

    const qCalc = isAdmin
      ? query(collection(db, 'calculators'))
      : query(
          collection(db, 'calculators'),
          where('enabled', '==', true),
          where('published', '==', true)
        );

    const unsubCalcs = onSnapshot(
      qCalc,
      (snap) => {
        setDbCalculators(snap.docs.map((d) => d.data() as CalculatorDefinition));
      },
      (err) => {
        console.warn('Calculators listener fallback:', err.message);
      }
    );

    const qUnits = isAdmin
      ? query(collection(db, 'units'))
      : query(collection(db, 'units'), where('enabled', '==', true));

    const unsubUnits = onSnapshot(
      qUnits,
      (snap) => {
        setDbUnits(snap.docs.map((d) => d.data() as UnitDefinition));
      },
      (err) => {
        console.warn('Units listener fallback:', err.message);
      }
    );

    const qTpl = isAdmin
      ? query(collection(db, 'reportTemplates'))
      : query(collection(db, 'reportTemplates'), where('enabled', '==', true));

    const unsubTpls = onSnapshot(
      qTpl,
      (snap) => {
        setDbTemplates(snap.docs.map((d) => d.data() as ReportTemplate));
      },
      (err) => {
        console.warn('Report templates listener fallback:', err.message);
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'appSettings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as AppSettings;
          setAppSettings({
            ...DEFAULT_APP_SETTINGS,
            ...data,
            aiPdfConfig: {
              ...DEFAULT_APP_SETTINGS.aiPdfConfig!,
              ...(data.aiPdfConfig || {}),
            },
            moduleFlags: {
              ...DEFAULT_APP_SETTINGS.moduleFlags!,
              ...(data.moduleFlags || {}),
            },
            translateConfig: {
              ...DEFAULT_APP_SETTINGS.translateConfig!,
              ...(data.translateConfig || {}),
            },
            dictionaryConfig: {
              ...DEFAULT_APP_SETTINGS.dictionaryConfig!,
              ...(data.dictionaryConfig || {}),
            },
            calculatorConfig: {
              ...DEFAULT_APP_SETTINGS.calculatorConfig!,
              ...(data.calculatorConfig || {}),
            },
            storageConfig: {
              ...DEFAULT_APP_SETTINGS.storageConfig!,
              ...(data.storageConfig || {}),
            },
            profileConfig: {
              ...DEFAULT_APP_SETTINGS.profileConfig!,
              ...(data.profileConfig || {}),
            },
          });
        }
      },
      (err) => {
        console.warn('App settings fallback:', err.message);
      }
    );

    const unsubReportSettings = onSnapshot(
      doc(db, 'reportSettings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ReportSettingsRecord;
          setReportSettings({
            ...DEFAULT_REPORT_SETTINGS,
            ...data,
          });
        }
      },
      (err) => {
        console.warn('Report settings fallback:', err.message);
      }
    );

    const unsubSpreadsheetTpls = onSnapshot(
      isAdmin
        ? query(collection(db, 'spreadsheetTemplates'))
        : query(collection(db, 'spreadsheetTemplates'), where('enabled', '==', true)),
      (snap) => setSpreadsheetTemplates(snap.docs.map((d) => d.data() as SpreadsheetTemplateRecord)),
      () => {}
    );

    const unsubPresentationTpls = onSnapshot(
      isAdmin
        ? query(collection(db, 'presentationTemplates'))
        : query(collection(db, 'presentationTemplates'), where('enabled', '==', true)),
      (snap) => setPresentationTemplates(snap.docs.map((d) => d.data() as PresentationTemplateRecord)),
      () => {}
    );

    const unsubPublicFormulas = onSnapshot(
      isAdmin
        ? query(collection(db, 'customFormulas'), limit(150))
        : query(
            collection(db, 'customFormulas'),
            where('enabled', '==', true),
            where('published', '==', true),
            where('visibility', '==', 'public'),
            where('approvedByAdmin', '==', true),
            limit(100)
          ),
      (snap) => setPublicCustomFormulas(snap.docs.map((d) => d.data() as CustomFormulaRecord)),
      () => {}
    );

    const unsubSchoolFormulas = onSnapshot(
      isAdmin
        ? query(collection(db, 'schoolFormulaLibrary'), limit(300))
        : query(
            collection(db, 'schoolFormulaLibrary'),
            where('verified', '==', true),
            where('published', '==', true),
            limit(300)
          ),
      (snap) => setSchoolFormulas(snap.docs.map((d) => d.data() as SchoolFormulaRecord)),
      () => {}
    );

    const unsubSchoolRefs = onSnapshot(
      query(collection(db, 'schoolFormulaReferences'), limit(100)),
      (snap) => setSchoolReferences(snap.docs.map((d) => d.data() as SchoolFormulaReferenceRecord)),
      () => {}
    );

    const unsubCurrencySettings = onSnapshot(
      doc(db, 'currencySettings', 'global'),
      (snap) => {
        if (snap.exists()) {
          setCurrencySettings({ ...DEFAULT_CURRENCY_SETTINGS, ...(snap.data() as CurrencySettingsRecord) });
        }
      },
      () => {}
    );

    const unsubDesigner = onSnapshot(
      doc(db, 'designerInformation', 'global'),
      (snap) => {
        if (snap.exists()) {
          setDesignerInfo({ ...DEFAULT_DESIGNER_INFO, ...(snap.data() as DesignerInfoRecord) });
        } else {
          setDesignerInfo(DEFAULT_DESIGNER_INFO);
        }
      },
      () => {}
    );

    const unsubPublicSuggestions = onSnapshot(
      query(collection(db, 'suggestions'), where('visibility', '==', 'public'), limit(80)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as SuggestionRecord);
        setSuggestions((prev) => {
          const merged = new Map<string, SuggestionRecord>();
          prev.filter((s) => s.visibility === 'private').forEach((s) => merged.set(s.id, s));
          list.forEach((s) => merged.set(s.id, s));
          return Array.from(merged.values());
        });
      },
      () => {}
    );

    return () => {
      unsubCats();
      unsubCalcs();
      unsubUnits();
      unsubTpls();
      unsubSettings();
      unsubReportSettings();
      unsubSpreadsheetTpls();
      unsubPresentationTpls();
      unsubPublicFormulas();
      unsubSchoolFormulas();
      unsubSchoolRefs();
      unsubCurrencySettings();
      unsubDesigner();
      unsubPublicSuggestions();
    };
  }, [isAdmin]);

  // Authenticated User-Scoped Realtime Listeners
  useEffect(() => {
    if (!authReady || !user) {
      setHistory([]);
      setReports([]);
      setUserReportTemplates([]);
      setReportSections([]);
      setReportAssets([]);
      setEmailHistory([]);
      setEvents([]);
      setReminders([]);
      setNotifications([]);
      setNotes([]);
      setPdfDocuments([]);
      setPdfChats([]);
      setPdfComparisons([]);
      setTodayAiUsage(null);
      setSpreadsheets([]);
      setSpreadsheetHistory([]);
      setPresentations([]);
      setCustomFormulas([]);
      setFormulaTestCases([]);
      setCurrencyHistory([]);
      setGoogleConnection(null);
      setGoogleSyncJobs([]);
      setGoogleSyncLogs([]);
      setUpdateSchedules([]);
      setUpdateLogs([]);
      setUserExports([]);
      setPdfFolders([]);
      setUserStorageUsage(null);
      setTranslationHistory([]);
      setFavouriteTranslations([]);
      setDictionaryHistory([]);
      setFavouriteWords([]);
      setCalculatorHistory([]);
      setSuggestionVotes([]);
      setUserActivityLogs([]);
      return;
    }

    const uid = user.uid;
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const todayUsageId = `${uid}_${todayDateStr}`;

    const unsubHist = onSnapshot(
      query(collection(db, 'calculationHistory'), where('userId', '==', uid), limit(200)),
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as CalculationHistoryEntry);
        rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setHistory(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'calculationHistory')
    );

    const unsubRep = onSnapshot(
      query(collection(db, 'generatedReports'), where('userId', '==', uid), limit(100)),
      (snap) => setReports(snap.docs.map((d) => d.data() as GeneratedReport)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'generatedReports')
    );

    const unsubEvt = onSnapshot(
      query(collection(db, 'calendarEvents'), where('userId', '==', uid), limit(200)),
      (snap) => setEvents(snap.docs.map((d) => d.data() as CalendarEvent)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'calendarEvents')
    );

    const unsubRem = onSnapshot(
      query(collection(db, 'reminders'), where('userId', '==', uid), limit(200)),
      (snap) => setReminders(snap.docs.map((d) => d.data() as ReminderItem)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'reminders')
    );

    const unsubNotif = onSnapshot(
      query(collection(db, 'notifications'), where('userId', 'in', [uid, 'ALL']), limit(100)),
      (snap) => setNotifications(snap.docs.map((d) => d.data() as NotificationItem)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    const unsubNotes = onSnapshot(
      query(collection(db, 'personalNotes'), where('userId', '==', uid), limit(200)),
      (snap) => setNotes(snap.docs.map((d) => d.data() as PersonalNote)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'personalNotes')
    );

    const unsubPdfDocs = onSnapshot(
      query(collection(db, 'pdfDocuments'), where('userId', '==', uid), limit(100)),
      (snap) => setPdfDocuments(snap.docs.map((d) => d.data() as PdfDocumentRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'pdfDocuments')
    );

    const unsubPdfChats = onSnapshot(
      query(collection(db, 'pdfChats'), where('userId', '==', uid), limit(50)),
      (snap) => setPdfChats(snap.docs.map((d) => d.data() as PdfChatThread)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'pdfChats')
    );

    const unsubPdfComps = onSnapshot(
      query(collection(db, 'pdfComparisons'), where('userId', '==', uid), limit(50)),
      (snap) => setPdfComparisons(snap.docs.map((d) => d.data() as PdfComparisonRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'pdfComparisons')
    );

    const unsubUsage = onSnapshot(
      doc(db, 'userAiUsage', todayUsageId),
      (snap) => {
        setTodayAiUsage(snap.exists() ? (snap.data() as UserAiUsageRecord) : null);
      },
      () => {}
    );

    const unsubUserTpls = onSnapshot(
      query(collection(db, 'userReportTemplates'), where('userId', '==', uid), limit(100)),
      (snap) => setUserReportTemplates(snap.docs.map((d) => d.data() as UserReportTemplate)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'userReportTemplates')
    );

    const unsubSections = onSnapshot(
      query(collection(db, 'reportSections'), where('userId', '==', uid), limit(100)),
      (snap) => setReportSections(snap.docs.map((d) => d.data() as ReportSectionRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'reportSections')
    );

    const unsubAssets = onSnapshot(
      query(collection(db, 'reportAssets'), where('userId', '==', uid), limit(60)),
      (snap) => setReportAssets(snap.docs.map((d) => d.data() as ReportAssetRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'reportAssets')
    );

    const unsubEmails = onSnapshot(
      query(collection(db, 'emailHistory'), where('userId', '==', uid), limit(100)),
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as EmailHistoryRecord);
        rows.sort((a, b) => String(b.sentAtIso || '').localeCompare(String(a.sentAtIso || '')));
        setEmailHistory(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'emailHistory')
    );

    const unsubSheets = onSnapshot(
      query(collection(db, 'spreadsheets'), where('userId', '==', uid), limit(60)),
      (snap) => setSpreadsheets(snap.docs.map((d) => d.data() as SpreadsheetWorkbookRecord)),
      () => {}
    );

    const unsubSheetHist = onSnapshot(
      query(collection(db, 'spreadsheetHistory'), where('userId', '==', uid), limit(80)),
      (snap) => setSpreadsheetHistory(snap.docs.map((d) => d.data() as SpreadsheetHistoryRecord)),
      () => {}
    );

    const unsubPres = onSnapshot(
      query(collection(db, 'presentations'), where('userId', '==', uid), limit(60)),
      (snap) => setPresentations(snap.docs.map((d) => d.data() as PresentationRecord)),
      () => {}
    );

    const unsubCustomFormulas = onSnapshot(
      query(collection(db, 'customFormulas'), where('userId', '==', uid), limit(80)),
      (snap) => setCustomFormulas(snap.docs.map((d) => d.data() as CustomFormulaRecord)),
      () => {}
    );

    const unsubFormulaCases = onSnapshot(
      query(collection(db, 'formulaTestCases'), where('userId', '==', uid), limit(120)),
      (snap) => setFormulaTestCases(snap.docs.map((d) => d.data() as FormulaTestCaseRecord)),
      () => {}
    );

    const unsubCurrencyHist = onSnapshot(
      query(collection(db, 'currencyHistory'), where('userId', '==', uid), limit(100)),
      (snap) => setCurrencyHistory(snap.docs.map((d) => d.data() as CurrencyHistoryRecord)),
      () => {}
    );

    const unsubGoogleConn = onSnapshot(
      doc(db, 'googleConnections', uid),
      (snap) => setGoogleConnection(snap.exists() ? (snap.data() as GoogleConnectionRecord) : null),
      () => {}
    );

    const unsubSyncJobs = onSnapshot(
      query(collection(db, 'googleSyncJobs'), where('userId', '==', uid), limit(40)),
      (snap) => setGoogleSyncJobs(snap.docs.map((d) => d.data() as GoogleSyncJobRecord)),
      () => {}
    );

    const unsubSyncLogs = onSnapshot(
      query(collection(db, 'googleSyncLogs'), where('userId', '==', uid), limit(60)),
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as GoogleSyncLogRecord);
        rows.sort((a, b) => b.ranAtIso.localeCompare(a.ranAtIso));
        setGoogleSyncLogs(rows);
      },
      () => {}
    );

    const unsubUpdateSched = onSnapshot(
      query(collection(db, 'updateSchedules'), where('userId', '==', uid), limit(30)),
      (snap) => setUpdateSchedules(snap.docs.map((d) => d.data() as UpdateScheduleRecord)),
      () => {}
    );

    const unsubUpdateLogs = onSnapshot(
      query(collection(db, 'updateLogs'), where('userId', '==', uid), limit(80)),
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as UpdateLogRecord);
        rows.sort((a, b) => b.ranAtIso.localeCompare(a.ranAtIso));
        setUpdateLogs(rows);
      },
      () => {}
    );

    const unsubExports = onSnapshot(
      query(collection(db, 'userExports'), where('userId', '==', uid), limit(80)),
      (snap) => setUserExports(snap.docs.map((d) => d.data() as UserExportRecord)),
      () => {}
    );

    const unsubPdfFolders = onSnapshot(
      query(collection(db, 'pdfFolders'), where('userId', '==', uid), limit(60)),
      (snap) => setPdfFolders(snap.docs.map((d) => d.data() as PdfFolderRecord)),
      () => {}
    );

    const unsubStorageUsage = onSnapshot(
      doc(db, 'userStorageUsage', uid),
      (snap) => setUserStorageUsage(snap.exists() ? (snap.data() as UserStorageUsageRecord) : null),
      () => {}
    );

    const unsubTransHist = onSnapshot(
      query(collection(db, 'translationHistory'), where('userId', '==', uid), limit(120)),
      (snap) => setTranslationHistory(snap.docs.map((d) => d.data() as TranslationHistoryRecord)),
      () => {}
    );

    const unsubFavTrans = onSnapshot(
      query(collection(db, 'favouriteTranslations'), where('userId', '==', uid), limit(100)),
      (snap) => setFavouriteTranslations(snap.docs.map((d) => d.data() as FavouriteTranslationRecord)),
      () => {}
    );

    const unsubDictHist = onSnapshot(
      query(collection(db, 'dictionaryHistory'), where('userId', '==', uid), limit(100)),
      (snap) => setDictionaryHistory(snap.docs.map((d) => d.data() as DictionaryHistoryRecord)),
      () => {}
    );

    const unsubFavWords = onSnapshot(
      query(collection(db, 'favouriteWords'), where('userId', '==', uid), limit(120)),
      (snap) => setFavouriteWords(snap.docs.map((d) => d.data() as FavouriteWordRecord)),
      () => {}
    );

    const unsubCalcHist = onSnapshot(
      query(collection(db, 'calculatorHistory'), where('userId', '==', uid), limit(150)),
      (snap) => setCalculatorHistory(snap.docs.map((d) => d.data() as CalculatorHistoryRecord)),
      () => {}
    );

    const unsubMySuggestions = onSnapshot(
      query(collection(db, 'suggestions'), where('userId', '==', uid), limit(80)),
      (snap) => {
        const myRows = snap.docs.map((d) => d.data() as SuggestionRecord);
        setSuggestions((prev) => {
          const merged = new Map<string, SuggestionRecord>();
          prev.filter((s) => s.visibility === 'public').forEach((s) => merged.set(s.id, s));
          myRows.forEach((s) => merged.set(s.id, s));
          return Array.from(merged.values());
        });
      },
      () => {}
    );

    const unsubMyVotes = onSnapshot(
      query(collection(db, 'suggestionVotes'), where('userId', '==', uid), limit(150)),
      (snap) => setSuggestionVotes(snap.docs.map((d) => d.data() as SuggestionVoteRecord)),
      () => {}
    );

    const unsubActivity = onSnapshot(
      query(collection(db, 'userActivityLogs'), where('userId', '==', uid), limit(80)),
      (snap) => setUserActivityLogs(snap.docs.map((d) => d.data() as UserActivityLogRecord)),
      () => {}
    );

    return () => {
      unsubHist();
      unsubRep();
      unsubEvt();
      unsubRem();
      unsubNotif();
      unsubNotes();
      unsubPdfDocs();
      unsubPdfChats();
      unsubPdfComps();
      unsubUsage();
      unsubUserTpls();
      unsubSections();
      unsubAssets();
      unsubEmails();
      unsubSheets();
      unsubSheetHist();
      unsubPres();
      unsubCustomFormulas();
      unsubFormulaCases();
      unsubCurrencyHist();
      unsubGoogleConn();
      unsubSyncJobs();
      unsubSyncLogs();
      unsubUpdateSched();
      unsubUpdateLogs();
      unsubExports();
      unsubPdfFolders();
      unsubStorageUsage();
      unsubTransHist();
      unsubFavTrans();
      unsubDictHist();
      unsubFavWords();
      unsubCalcHist();
      unsubMySuggestions();
      unsubMyVotes();
      unsubActivity();
    };
  }, [authReady, user]);

  // Admin-only listeners
  useEffect(() => {
    if (!authReady || !user || !isAdmin) {
      setAuditLogs([]);
      setAllUsers([]);
      setAllAiUsage([]);
      setAdminAllSuggestions([]);
      setApiUsageLogs([]);
      return;
    }

    const unsubAudit = onSnapshot(
      query(collection(db, 'auditLogs'), limit(150)),
      (snap) => setAuditLogs(snap.docs.map((d) => d.data() as AuditLogEntry)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    );

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), limit(200)),
      (snap) => setAllUsers(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubAllUsage = onSnapshot(
      query(collection(db, 'userAiUsage'), limit(200)),
      (snap) => setAllAiUsage(snap.docs.map((d) => d.data() as UserAiUsageRecord)),
      () => {}
    );

    const unsubAdminSuggestions = onSnapshot(
      query(collection(db, 'suggestions'), limit(200)),
      (snap) => setAdminAllSuggestions(snap.docs.map((d) => d.data() as SuggestionRecord)),
      () => {}
    );

    const unsubApiLogs = onSnapshot(
      query(collection(db, 'apiUsageLogs'), limit(120)),
      (snap) => setApiUsageLogs(snap.docs.map((d) => d.data() as ApiUsageLogRecord)),
      () => {}
    );

    return () => {
      unsubAudit();
      unsubUsers();
      unsubAllUsage();
      unsubAdminSuggestions();
      unsubApiLogs();
    };
  }, [authReady, user, isAdmin]);

  // Reminder due watcher (fires Browser Notification + In-App Notification)
  useEffect(() => {
    if (!user || reminders.length === 0) return;

    const checkDue = async () => {
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;
      const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
        2,
        '0'
      )}`;

      for (const rem of reminders) {
        if (!rem.completed && !rem.notified && rem.date <= todayIso) {
          const isDue = rem.date < todayIso || rem.time <= nowHm;
          if (isDue) {
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`SUTRO SATHI: ${rem.title}`, {
                  body: rem.description || `${rem.date} ${rem.time}`,
                  icon: '/pwa-192x192.png',
                });
              }
              const notifId = makeSafeId('notif');
              await setDoc(doc(db, 'notifications', notifId), {
                id: notifId,
                userId: user.uid,
                title: rem.title,
                body: rem.description || `Reminder due at ${rem.date} ${rem.time}`,
                type: 'reminder',
                read: false,
                createdAt: serverTimestamp(),
              });
              await updateDoc(doc(db, 'reminders', rem.id), {
                notified: true,
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              console.warn('Reminder notification trigger skipped:', err);
            }
          }
        }
      }
    };

    const timer = setInterval(checkDue, 30000);
    checkDue();
    return () => clearInterval(timer);
  }, [user, reminders]);

  // Merge Firestore catalog with seed catalog so tools are immediately usable even before first admin seed
  const categories = useMemo(() => {
    if (dbCategories.length > 0) return dbCategories;
    return SEED_CATEGORIES;
  }, [dbCategories]);

  const calculators = useMemo(() => {
    if (dbCalculators.length > 0) return dbCalculators;
    return SEED_CALCULATORS;
  }, [dbCalculators]);

  const units = useMemo(() => {
    if (dbUnits.length > 0) return dbUnits;
    return BUILTIN_UNITS.map((u) => ({ ...u, enabled: true }));
  }, [dbUnits]);

  const reportTemplates = useMemo(() => {
    if (dbTemplates.length > 0) return dbTemplates;
    return SEED_REPORT_TEMPLATES;
  }, [dbTemplates]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      if (user) {
        updateDoc(doc(db, 'users', user.uid), {
          language: lang,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    },
    [user]
  );

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeState(mode);
      if (user) {
        updateDoc(doc(db, 'users', user.uid), {
          theme: mode,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    },
    [user]
  );

  const navigateTo = useCallback(
    (section: NavSection, categoryId?: string, calculatorId: string | null = null) => {
      setActiveSection(section);
      if (categoryId) setActiveCategoryId(categoryId);
      setActiveCalculatorId(calculatorId);
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast(language === 'bn' ? 'সফলভাবে সাইন ইন হয়েছে।' : 'Signed in successfully.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      showToast(msg, 'error');
    }
  }, [language, showToast]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    showToast(language === 'bn' ? 'সাইন আউট সম্পন্ন হয়েছে।' : 'Signed out.', 'info');
  }, [language, showToast]);

  const getUserStorageQuotaBytes = useCallback(
    (targetProfile?: UserProfile | null): number => {
      const p = targetProfile !== undefined ? targetProfile : profile;
      const cfg = appSettings.storageConfig || DEFAULT_APP_SETTINGS.storageConfig!;
      if (p?.accountType === 'custom' && typeof p.storageLimitMb === 'number' && p.storageLimitMb > 0) {
        return p.storageLimitMb * 1024 * 1024;
      }
      if (p?.accountType === 'premium') {
        return (cfg.premiumUserQuotaMb || 1024) * 1024 * 1024;
      }
      return (cfg.freeUserQuotaMb || 100) * 1024 * 1024;
    },
    [profile, appSettings.storageConfig]
  );

  const getTotalStorageUsedBytes = useCallback((): number => {
    const pdfBytes = pdfDocuments.reduce((acc, d) => acc + (d.fileSizeBytes || 0), 0);
    const reportBytes = reports.reduce((acc, r) => acc + (r.pdfFileSizeBytes || 0), 0);
    const assetBytes = reportAssets.reduce((acc, a) => acc + (a.fileSizeBytes || 0), 0);
    return pdfBytes + reportBytes + assetBytes;
  }, [pdfDocuments, reports, reportAssets]);

  const recomputeUserStorageUsage = useCallback(
    async (
      overrides?:
        | PdfDocumentRecord[]
        | { docs?: PdfDocumentRecord[]; reportsList?: GeneratedReport[]; assetsList?: ReportAssetRecord[] }
    ) => {
      if (!user) return;
      const docsList = Array.isArray(overrides) ? overrides : overrides?.docs || pdfDocuments;
      const repsList = Array.isArray(overrides) ? reports : overrides?.reportsList || reports;
      const assetsList = Array.isArray(overrides) ? reportAssets : overrides?.assetsList || reportAssets;
      const pdfBytes = docsList.reduce((acc, d) => acc + (d.fileSizeBytes || 0), 0);
      const reportBytes = repsList.reduce((acc, r) => acc + (r.pdfFileSizeBytes || 0), 0);
      const assetBytes = assetsList.reduce((acc, a) => acc + (a.fileSizeBytes || 0), 0);
      const totalBytes = pdfBytes + reportBytes + assetBytes;
      const storedReportsCount = repsList.filter((r) => Boolean(r.pdfStoragePath)).length;
      const storedAssetsCount = assetsList.filter((a) => Boolean(a.storagePath)).length;
      const totalFiles = docsList.length + storedReportsCount + storedAssetsCount;
      const totalPages = docsList.reduce((acc, d) => acc + (d.pageCount || 0), 0);
      const quotaBytes = getUserStorageQuotaBytes();
      try {
        await setDoc(doc(db, 'userStorageUsage', user.uid), {
          id: user.uid,
          userId: user.uid,
          totalBytes,
          totalFiles,
          totalPages,
          quotaBytes,
          lastUploadAtIso: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore quota sync errors silently
      }
    },
    [user, pdfDocuments, reports, reportAssets, getUserStorageQuotaBytes]
  );

  const logUserActivity = useCallback(
    async (action: string, module: string, summary: string) => {
      if (!user) return;
      const id = makeSafeId('act');
      try {
        await setDoc(doc(db, 'userActivityLogs', id), {
          id,
          userId: user.uid,
          action: action.slice(0, 80),
          module: module.slice(0, 60),
          summary: summary.slice(0, 290),
          createdAt: serverTimestamp(),
        });
      } catch {
        // Non-fatal activity log
      }
    },
    [user]
  );

  const updateUserProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!user) return;
      const forbidden = new Set([
        'uid',
        'email',
        'role',
        'status',
        'accountType',
        'storageLimitMb',
        'loginCount',
        'lastLoginAtIso',
        'createdAt',
      ]);
      const sanitized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (!forbidden.has(k) && v !== undefined) {
          sanitized[k] = typeof v === 'string' ? v.slice(0, k === 'photoURL' ? 280000 : 300) : v;
        }
      }
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          ...sanitized,
          updatedAt: serverTimestamp(),
        });
        setProfile((prev) => (prev ? { ...prev, ...sanitized } : prev));
        if (patch.language) setLanguageState(patch.language);
        if (patch.theme) setThemeState(patch.theme);
        void logUserActivity('PROFILE_UPDATE', 'profile', 'Updated personal/educational/professional profile');
        showToast(language === 'bn' ? 'প্রোফাইল আপডেট হয়েছে।' : 'Profile updated.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    },
    [user, language, showToast, logUserActivity]
  );

  const requestAccountDeletion = useCallback(async () => {
    if (!user) return;
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'users', user.uid), {
        deletionRequested: true,
        deletionRequestedAtIso: nowIso,
        updatedAt: serverTimestamp(),
      });
      setProfile((prev) =>
        prev ? { ...prev, deletionRequested: true, deletionRequestedAtIso: nowIso } : prev
      );
      await logUserActivity('DELETION_REQUEST', 'profile', 'Submitted account deletion request');
      showToast(
        language === 'bn'
          ? 'অ্যাকাউন্ট মুছে ফেলার অনুরোধ জমা হয়েছে। অ্যাডমিন এটি পর্যালোচনা করবেন।'
          : 'Account deletion request submitted for admin review.',
        'info'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  }, [user, language, logUserActivity, showToast]);

  const downloadMyData = useCallback(() => {
    if (!user) return;
    const payload = {
      exportedAtIso: new Date().toISOString(),
      profile,
      calculationHistory: history,
      calculatorHistory,
      generatedReports: reports,
      notes,
      calendarEvents: events,
      reminders,
      pdfDocuments,
      translationHistory,
      favouriteTranslations,
      dictionaryHistory,
      favouriteWords,
      suggestions: suggestions.filter((s) => s.userId === user.uid),
      spreadsheets,
      presentations,
      customFormulas,
      currencyHistory,
      userExports,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sutro-sathi-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    void logUserActivity('DOWNLOAD_DATA', 'profile', 'Downloaded personal data JSON archive');
    showToast(language === 'bn' ? 'আপনার সকল ডেটা ডাউনলোড হয়েছে।' : 'Personal data JSON downloaded.', 'success');
  }, [
    user,
    profile,
    history,
    calculatorHistory,
    reports,
    notes,
    events,
    reminders,
    pdfDocuments,
    translationHistory,
    favouriteTranslations,
    dictionaryHistory,
    favouriteWords,
    suggestions,
    spreadsheets,
    presentations,
    customFormulas,
    currencyHistory,
    userExports,
    logUserActivity,
    language,
    showToast,
  ]);

  const assertActiveAccount = useCallback(() => {
    if (profile?.status === 'suspended') {
      showToast(
        language === 'bn'
          ? 'আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।'
          : 'Your account is currently suspended. Contact an administrator.',
        'error'
      );
      return false;
    }
    return true;
  }, [profile?.status, language, showToast]);

  const recordCalculation = useCallback(
    async (entry: Omit<CalculationHistoryEntry, 'id' | 'userId' | 'createdAt'>) => {
      if (!user || !assertActiveAccount()) return null;
      const now = Date.now();
      if (now - lastCalcRecordRef.current < 1500) {
        showToast(language === 'bn' ? 'অনুগ্রহ করে একটু অপেক্ষা করুন।' : 'Please wait a moment before logging again.', 'info');
        return null;
      }
      lastCalcRecordRef.current = now;
      const id = makeSafeId('calc');
      try {
        await setDoc(doc(db, 'calculationHistory', id), {
          ...entry,
          id,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `calculationHistory/${id}`);
      }
    },
    [user, assertActiveAccount, language, showToast]
  );

  const toggleSaveHistory = useCallback(
    async (id: string, isSaved: boolean) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'calculationHistory', id), { isSaved });
        showToast(
          isSaved
            ? language === 'bn'
              ? 'সংরক্ষিত হিসাবে যুক্ত হয়েছে।'
              : 'Saved to bookmarks.'
            : language === 'bn'
              ? 'সংরক্ষণ থেকে সরানো হয়েছে।'
              : 'Removed from saved.',
          'success'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `calculationHistory/${id}`);
      }
    },
    [user, language, showToast]
  );

  const deleteHistoryEntry = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'calculationHistory', id));
        showToast(language === 'bn' ? 'মুছে ফেলা হয়েছে।' : 'Entry deleted.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `calculationHistory/${id}`);
      }
    },
    [user, language, showToast]
  );

  const saveGeneratedReport = useCallback(
    async (report: Omit<GeneratedReport, 'id' | 'userId' | 'createdAt'>): Promise<string | null> => {
      if (!user) return null;
      const id = makeSafeId('rep');
      try {
        await setDoc(doc(db, 'generatedReports', id), {
          ...report,
          id,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(language === 'bn' ? 'রিপোর্ট সংরক্ষিত হয়েছে।' : 'Report saved to cloud library.', 'success');
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `generatedReports/${id}`);
      }
    },
    [user, language, showToast]
  );

  const updateGeneratedReport = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          GeneratedReport,
          | 'title'
          | 'companyName'
          | 'projectName'
          | 'category'
          | 'orientation'
          | 'payload'
          | 'pageDesign'
          | 'blocks'
          | 'pdfStoragePath'
          | 'pdfDownloadUrl'
          | 'pdfFileSizeBytes'
        >
      >
    ) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'generatedReports', id), {
          ...patch,
          updatedAt: serverTimestamp(),
        });
        showToast(language === 'bn' ? 'রিপোর্ট আপডেট হয়েছে।' : 'Report updated in library.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `generatedReports/${id}`);
      }
    },
    [user, language, showToast]
  );

  const deleteGeneratedReport = useCallback(
    async (id: string) => {
      if (!user) return;
      const existingReport = reports.find((r) => r.id === id);
      try {
        await deleteDoc(doc(db, 'generatedReports', id));
        if (existingReport?.pdfStoragePath) {
          await deleteUserFileFromStorage(existingReport.pdfStoragePath).catch(() => {});
          void recomputeUserStorageUsage({ reportsList: reports.filter((r) => r.id !== id) });
        }
        showToast(language === 'bn' ? 'রিপোর্ট মুছে ফেলা হয়েছে।' : 'Report deleted.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `generatedReports/${id}`);
      }
    },
    [user, reports, recomputeUserStorageUsage, language, showToast]
  );

  const saveUserReportTemplate = useCallback(
    async (
      tpl: Omit<UserReportTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      if (!user) return null;
      const isNew = !tpl.id;
      const id = tpl.id || makeSafeId('utpl');
      try {
        if (isNew) {
          await setDoc(doc(db, 'userReportTemplates', id), {
            id,
            userId: user.uid,
            nameEn: tpl.nameEn.slice(0, 138),
            nameBn: (tpl.nameBn || tpl.nameEn).slice(0, 138),
            category: (tpl.category || 'custom').slice(0, 58),
            description: (tpl.description || '').slice(0, 390),
            sourceTemplateId: tpl.sourceTemplateId || '',
            orientation: tpl.orientation,
            headerText: (tpl.headerText || '').slice(0, 290),
            footerText: (tpl.footerText || '').slice(0, 290),
            accentColor: tpl.accentColor || '#1d4ed8',
            pageDesign: tpl.pageDesign,
            blocks: tpl.blocks.slice(0, 78),
            sharedWithLink: Boolean(tpl.sharedWithLink),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'userReportTemplates', id), {
            nameEn: tpl.nameEn.slice(0, 138),
            nameBn: (tpl.nameBn || tpl.nameEn).slice(0, 138),
            category: (tpl.category || 'custom').slice(0, 58),
            description: (tpl.description || '').slice(0, 390),
            orientation: tpl.orientation,
            headerText: (tpl.headerText || '').slice(0, 290),
            footerText: (tpl.footerText || '').slice(0, 290),
            accentColor: tpl.accentColor || '#1d4ed8',
            pageDesign: tpl.pageDesign,
            blocks: tpl.blocks.slice(0, 78),
            sharedWithLink: Boolean(tpl.sharedWithLink),
            updatedAt: serverTimestamp(),
          });
        }
        showToast(
          language === 'bn' ? 'ব্যক্তিগত টেমপ্লেট সংরক্ষিত হয়েছে।' : 'Personal report template saved.',
          'success'
        );
        return id;
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `userReportTemplates/${id}`);
      }
    },
    [user, language, showToast]
  );

  const deleteUserReportTemplate = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'userReportTemplates', id));
        showToast(language === 'bn' ? 'টেমপ্লেট মুছে ফেলা হয়েছে।' : 'Template deleted.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `userReportTemplates/${id}`);
      }
    },
    [user, language, showToast]
  );

  const saveReportSection = useCallback(
    async (
      sec: Omit<ReportSectionRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      if (!user) return null;
      const isNew = !sec.id;
      const id = sec.id || makeSafeId('rsec');
      try {
        if (isNew) {
          await setDoc(doc(db, 'reportSections', id), {
            id,
            userId: user.uid,
            title: sec.title.slice(0, 138),
            blockType: sec.blockType,
            category: (sec.category || 'custom').slice(0, 58),
            blockData: sec.blockData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'reportSections', id), {
            title: sec.title.slice(0, 138),
            category: (sec.category || 'custom').slice(0, 58),
            blockData: sec.blockData,
            updatedAt: serverTimestamp(),
          });
        }
        showToast(language === 'bn' ? 'পুনর্ব্যবহারযোগ্য সেকশন সংরক্ষিত।' : 'Reusable section saved.', 'success');
        return id;
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `reportSections/${id}`);
      }
    },
    [user, language, showToast]
  );

  const deleteReportSection = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'reportSections', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `reportSections/${id}`);
      }
    },
    [user]
  );

  const saveReportAsset = useCallback(
    async (asset: Omit<ReportAssetRecord, 'id' | 'userId' | 'createdAt'>): Promise<string | null> => {
      if (!user) return null;
      const id = makeSafeId('rast');
      try {
        await setDoc(doc(db, 'reportAssets', id), {
          id,
          userId: user.uid,
          name: asset.name.slice(0, 155),
          assetType: asset.assetType,
          dataUrl: asset.dataUrl.slice(0, 315000),
          ...(asset.storagePath ? { storagePath: asset.storagePath.slice(0, 390) } : {}),
          ...(asset.downloadUrl ? { downloadUrl: asset.downloadUrl.slice(0, 1180) } : {}),
          ...(typeof asset.fileSizeBytes === 'number' && asset.fileSizeBytes >= 0 ? { fileSizeBytes: asset.fileSizeBytes } : {}),
          createdAt: serverTimestamp(),
        });
        if (typeof asset.fileSizeBytes === 'number' && asset.fileSizeBytes > 0) {
          void recomputeUserStorageUsage({
            assetsList: [
              ...reportAssets,
              {
                id,
                userId: user.uid,
                name: asset.name.slice(0, 155),
                assetType: asset.assetType,
                dataUrl: asset.dataUrl.slice(0, 315000),
                storagePath: asset.storagePath,
                downloadUrl: asset.downloadUrl,
                fileSizeBytes: asset.fileSizeBytes,
              },
            ],
          });
        }
        showToast(language === 'bn' ? 'অ্যাসেট লাইব্রেরিতে যুক্ত হয়েছে।' : 'Asset saved to library.', 'success');
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `reportAssets/${id}`);
      }
    },
    [user, reportAssets, recomputeUserStorageUsage, language, showToast]
  );

  const deleteReportAsset = useCallback(
    async (id: string) => {
      if (!user) return;
      const existingAsset = reportAssets.find((a) => a.id === id);
      try {
        await deleteDoc(doc(db, 'reportAssets', id));
        if (existingAsset?.storagePath) {
          await deleteUserFileFromStorage(existingAsset.storagePath).catch(() => {});
          void recomputeUserStorageUsage({ assetsList: reportAssets.filter((a) => a.id !== id) });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `reportAssets/${id}`);
      }
    },
    [user, reportAssets, recomputeUserStorageUsage]
  );

  const saveEmailHistory = useCallback(
    async (entry: Omit<EmailHistoryRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
      if (!user) return null;
      const id = makeSafeId('mail');
      try {
        await setDoc(doc(db, 'emailHistory', id), {
          id,
          userId: user.uid,
          ...(entry.reportId ? { reportId: entry.reportId } : {}),
          ...(entry.reportNumber ? { reportNumber: entry.reportNumber.slice(0, 62) } : {}),
          reportTitle: entry.reportTitle.slice(0, 195),
          to: entry.to.slice(0, 20),
          cc: (entry.cc || []).slice(0, 20),
          bcc: (entry.bcc || []).slice(0, 20),
          subject: entry.subject.slice(0, 295),
          messageBody: (entry.messageBody || '').slice(0, 5900),
          hasPdfAttachment: Boolean(entry.hasPdfAttachment),
          hasExcelAttachment: Boolean(entry.hasExcelAttachment),
          provider: entry.provider,
          providerMessageId: (entry.providerMessageId || '').slice(0, 235),
          deliveryStatus: entry.deliveryStatus,
          statusNote: (entry.statusNote || '').slice(0, 390),
          errorDetail: (entry.errorDetail || '').slice(0, 590),
          sentAtIso: entry.sentAtIso,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `emailHistory/${id}`);
      }
    },
    [user]
  );

  const updateEmailHistory = useCallback(
    async (
      id: string,
      patch: Pick<EmailHistoryRecord, 'deliveryStatus' | 'sentAtIso'> &
        Partial<Pick<EmailHistoryRecord, 'providerMessageId' | 'statusNote' | 'errorDetail'>>
    ) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'emailHistory', id), {
          deliveryStatus: patch.deliveryStatus,
          providerMessageId: (patch.providerMessageId || '').slice(0, 235),
          statusNote: (patch.statusNote || '').slice(0, 390),
          errorDetail: (patch.errorDetail || '').slice(0, 590),
          sentAtIso: patch.sentAtIso,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `emailHistory/${id}`);
      }
    },
    [user]
  );

  const deleteEmailHistory = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'emailHistory', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `emailHistory/${id}`);
      }
    },
    [user]
  );

  const saveReportSettings = useCallback(
    async (settings: Omit<ReportSettingsRecord, 'id' | 'updatedAt' | 'updatedBy'>) => {
      if (!user || !isAdmin) return;
      try {
        await setDoc(doc(db, 'reportSettings', 'global'), {
          ...settings,
          id: 'global',
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
        showToast('Report Designer & Email global settings saved.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'reportSettings/global');
      }
    },
    [user, isAdmin, showToast]
  );

  const saveCalendarEvent = useCallback(
    async (event: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      if (!user) return;
      const isNew = !event.id;
      const id = event.id || makeSafeId('evt');
      try {
        if (isNew) {
          await setDoc(doc(db, 'calendarEvents', id), {
            ...event,
            id,
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'calendarEvents', id), {
            title: event.title,
            description: event.description || '',
            date: event.date,
            time: event.time || '',
            repeat: event.repeat,
            attachedNoteId: event.attachedNoteId || '',
            category: event.category || 'general',
            updatedAt: serverTimestamp(),
          });
        }
        showToast(language === 'bn' ? 'ইভেন্ট সংরক্ষিত হয়েছে।' : 'Calendar event saved.', 'success');
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `calendarEvents/${id}`);
      }
    },
    [user, language, showToast]
  );

  const deleteCalendarEvent = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'calendarEvents', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `calendarEvents/${id}`);
      }
    },
    [user]
  );

  const saveReminder = useCallback(
    async (rem: Omit<ReminderItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      if (!user) return;
      const isNew = !rem.id;
      const id = rem.id || makeSafeId('rem');
      try {
        if (isNew) {
          await setDoc(doc(db, 'reminders', id), {
            ...rem,
            id,
            userId: user.uid,
            notified: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'reminders', id), {
            title: rem.title,
            description: rem.description || '',
            date: rem.date,
            time: rem.time,
            repeat: rem.repeat,
            customIntervalDays: rem.customIntervalDays ?? 1,
            priority: rem.priority,
            completed: rem.completed,
            location: rem.location || '',
            notified: rem.notified ?? false,
            updatedAt: serverTimestamp(),
          });
        }
        showToast(language === 'bn' ? 'রিমাইন্ডার সংরক্ষিত হয়েছে।' : 'Reminder saved.', 'success');
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `reminders/${id}`);
      }
    },
    [user, language, showToast]
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'reminders', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `reminders/${id}`);
      }
    },
    [user]
  );

  const saveNote = useCallback(
    async (note: Omit<PersonalNote, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      if (!user) return;
      const isNew = !note.id;
      const id = note.id || makeSafeId('note');
      try {
        if (isNew) {
          await setDoc(doc(db, 'personalNotes', id), {
            ...note,
            id,
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'personalNotes', id), {
            title: note.title,
            content: note.content,
            category: note.category,
            pinned: note.pinned,
            date: note.date || '',
            imageDataUrl: note.imageDataUrl || '',
            locationLabel: note.locationLabel || '',
            latitude: note.latitude ?? 0,
            longitude: note.longitude ?? 0,
            linkedEventId: note.linkedEventId || '',
            linkedCalculationId: note.linkedCalculationId || '',
            updatedAt: serverTimestamp(),
          });
        }
        showToast(language === 'bn' ? 'নোট সংরক্ষিত হয়েছে।' : 'Note saved securely.', 'success');
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `personalNotes/${id}`);
      }
    },
    [user, language, showToast]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'personalNotes', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `personalNotes/${id}`);
      }
    },
    [user]
  );

  const openCalculatorWithPrefill = useCallback(
    (
      calculatorId: string,
      categoryId: string,
      inputs: Record<string, number>,
      prefillUnits?: Record<string, string>,
      sourceDocTitle?: string
    ) => {
      setPendingCalculatorPrefill({ calculatorId, inputs, units: prefillUnits, sourceDocTitle });
      setActiveSection('category');
      setActiveCategoryId(categoryId);
      setActiveCalculatorId(calculatorId);
    },
    []
  );

  const sendToExcel = useCallback((push: PendingExcelPush) => {
    setPendingExcelPush(push);
    setActiveSection('excel-studio');
  }, []);

  const renamePdfDocument = useCallback(
    async (docId: string, newTitle: string) => {
      if (!user || !newTitle.trim()) return;
      try {
        await updateDoc(doc(db, 'pdfDocuments', docId), {
          title: newTitle.trim().slice(0, 195),
          updatedAt: serverTimestamp(),
        });
        showToast(language === 'bn' ? 'ডকুমেন্টের নাম পরিবর্তন হয়েছে।' : 'Document renamed.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `pdfDocuments/${docId}`);
      }
    },
    [user, language, showToast]
  );

  const togglePdfSharing = useCallback(
    async (docId: string, shared: boolean) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'pdfDocuments', docId), {
          sharedWithLink: shared,
          updatedAt: serverTimestamp(),
        });
        showToast(
          shared
            ? language === 'bn'
              ? 'ডকুমেন্ট শেয়ারিং চালু করা হয়েছে।'
              : 'Document link sharing enabled.'
            : language === 'bn'
              ? 'ডকুমেন্ট ব্যক্তিগত করা হয়েছে।'
              : 'Document set to private.',
          'info'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `pdfDocuments/${docId}`);
      }
    },
    [user, language, showToast]
  );

  const updatePdfExtractedTables = useCallback(
    async (docId: string, tables: PdfExtractedTable[]) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'pdfDocuments', docId), {
          extractedTables: tables.slice(0, 20),
          updatedAt: serverTimestamp(),
        });
        showToast(language === 'bn' ? 'টেবিলের তথ্য সংরক্ষিত হয়েছে।' : 'Edited table changes saved.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `pdfDocuments/${docId}`);
      }
    },
    [user, language, showToast]
  );

  const deletePdfDocument = useCallback(
    async (docItem: PdfDocumentRecord) => {
      if (!user) return;
      try {
        const pagesSnap = await getDocs(
          query(collection(db, 'pdfDocuments', docItem.id, 'pages'), where('userId', '==', user.uid))
        );
        const batch = writeBatch(db);
        pagesSnap.docs.forEach((p) => batch.delete(p.ref));
        batch.delete(doc(db, 'pdfDocuments', docItem.id));
        await batch.commit();

        if (docItem.storagePath) {
          await deleteUserFileFromStorage(docItem.storagePath).catch(() => {});
        }
        showToast(language === 'bn' ? 'ডকুমেন্ট মুছে ফেলা হয়েছে।' : 'Document deleted.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `pdfDocuments/${docItem.id}`);
      }
    },
    [user, language, showToast]
  );

  const incrementAiUsage = useCallback(
    async (kind: 'analysis' | 'question' | 'comparison') => {
      if (!user) return;
      const date = new Date().toISOString().slice(0, 10);
      const usageId = `${user.uid}_${date}`;
      try {
        const snap = await getDoc(doc(db, 'userAiUsage', usageId));
        if (!snap.exists()) {
          await setDoc(doc(db, 'userAiUsage', usageId), {
            id: usageId,
            userId: user.uid,
            date,
            analysisCount: kind === 'analysis' ? 1 : 0,
            questionCount: kind === 'question' ? 1 : 0,
            comparisonCount: kind === 'comparison' ? 1 : 0,
            updatedAt: serverTimestamp(),
          });
        } else {
          const prev = snap.data() as UserAiUsageRecord;
          await updateDoc(doc(db, 'userAiUsage', usageId), {
            analysisCount: prev.analysisCount + (kind === 'analysis' ? 1 : 0),
            questionCount: prev.questionCount + (kind === 'question' ? 1 : 0),
            comparisonCount: prev.comparisonCount + (kind === 'comparison' ? 1 : 0),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn('AI usage update skipped:', err);
      }
    },
    [user]
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      if (!user) return;
      const item = notifications.find((n) => n.id === id);
      if (!item || item.userId !== user.uid) return;
      try {
        await updateDoc(doc(db, 'notifications', id), { read: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
      }
    },
    [user, notifications]
  );

  const logAdminAudit = useCallback(
    async (action: string, targetCollection: string, targetId: string, summary: string) => {
      if (!user || !isAdmin) return;
      const id = makeSafeId('audit');
      try {
        await setDoc(doc(db, 'auditLogs', id), {
          id,
          actorUid: user.uid,
          actorEmail: user.email || '',
          action,
          targetCollection,
          targetId,
          summary: summary.slice(0, 390),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Audit log failed:', err);
      }
    },
    [user, isAdmin]
  );

  const sendAdminBroadcast = useCallback(
    async (title: string, body: string) => {
      if (!user || !isAdmin) return;
      const id = makeSafeId('bcast');
      try {
        await setDoc(doc(db, 'notifications', id), {
          id,
          userId: 'ALL',
          title,
          body,
          type: 'broadcast',
          read: false,
          createdAt: serverTimestamp(),
        });
        await logAdminAudit('BROADCAST_NOTIFICATION', 'notifications', id, `Broadcast: ${title}`);
        showToast(language === 'bn' ? 'সকল ইউজারকে বার্তা পাঠানো হয়েছে।' : 'Broadcast notification sent.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `notifications/${id}`);
      }
    },
    [user, isAdmin, logAdminAudit, language, showToast]
  );

  const seedInitialCatalogToFirestore = useCallback(async () => {
    if (!user || !isAdmin) return;
    try {
      const batch = writeBatch(db);
      for (const cat of SEED_CATEGORIES) {
        batch.set(doc(db, 'categories', cat.id), { ...cat, updatedAt: serverTimestamp() });
      }
      for (const calc of SEED_CALCULATORS) {
        batch.set(doc(db, 'calculators', calc.id), {
          ...calc,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
        const formulaExpr = calc.outputs.map((o) => `${o.key}=${o.expression}`).join('; ').slice(0, 490) || calc.formulaDisplay.slice(0, 490);
        batch.set(doc(db, 'formulas', calc.id), {
          id: calc.id,
          calculatorId: calc.id,
          expression: formulaExpr,
          version: calc.version,
          updatedAt: serverTimestamp(),
        });
      }
      for (const unit of BUILTIN_UNITS) {
        batch.set(doc(db, 'units', unit.id), {
          id: unit.id,
          dimension: unit.dimension,
          symbol: unit.symbol,
          nameEn: unit.nameEn,
          nameBn: unit.nameBn,
          toBaseFactor: unit.toBaseFactor,
          enabled: true,
          updatedAt: serverTimestamp(),
        });
      }
      for (const tpl of SEED_REPORT_TEMPLATES) {
        batch.set(doc(db, 'reportTemplates', tpl.id), { ...tpl, updatedAt: serverTimestamp() });
      }
      batch.set(doc(db, 'appSettings', 'global'), {
        ...DEFAULT_APP_SETTINGS,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      await logAdminAudit(
        'SEED_CATALOG',
        'calculators',
        'batch',
        `Seeded ${SEED_CATEGORIES.length} categories, ${SEED_CALCULATORS.length} calculators, ${BUILTIN_UNITS.length} units.`
      );
      showToast('Database catalog seeded to Firestore successfully.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seedCatalog');
    }
  }, [user, isAdmin, logAdminAudit, showToast]);

  const syncMissingSeedCatalogToFirestore = useCallback(
    async (silent = false) => {
      if (!user || !isAdmin) return;
      try {
        const [catSnap, calcSnap] = await Promise.all([
          getDocs(collection(db, 'categories')),
          getDocs(collection(db, 'calculators')),
        ]);
        const existingCatIds = new Set(catSnap.docs.map((d) => d.id));
        const existingCalcIds = new Set(calcSnap.docs.map((d) => d.id));

        const missingCats = SEED_CATEGORIES.filter((c) => !existingCatIds.has(c.id));
        const missingCalcs = SEED_CALCULATORS.filter((c) => !existingCalcIds.has(c.id));

        if (missingCats.length === 0 && missingCalcs.length === 0) {
          if (!silent) {
            showToast('All built-in categories and calculators are already synced.', 'info');
          }
          return;
        }

        const batch = writeBatch(db);
        for (const cat of missingCats) {
          batch.set(doc(db, 'categories', cat.id), { ...cat, updatedAt: serverTimestamp() });
        }
        for (const calc of missingCalcs) {
          batch.set(doc(db, 'calculators', calc.id), {
            ...calc,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
          const formulaExpr = calc.outputs.map((o) => `${o.key}=${o.expression}`).join('; ').slice(0, 490) || calc.formulaDisplay.slice(0, 490);
          batch.set(doc(db, 'formulas', calc.id), {
            id: calc.id,
            calculatorId: calc.id,
            expression: formulaExpr,
            version: calc.version,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
        await logAdminAudit(
          'SYNC_MISSING_SEEDS',
          'calculators',
          'batch',
          `Synced ${missingCats.length} missing categories and ${missingCalcs.length} new calculators.`
        );
        if (!silent) {
          showToast(`Added ${missingCalcs.length} new calculators to Firestore.`, 'success');
        }
      } catch (err) {
        if (!silent) {
          handleFirestoreError(err, OperationType.WRITE, 'syncMissingSeedCatalog');
        }
      }
    },
    [user, isAdmin, logAdminAudit, showToast]
  );

  // Auto-seed once or sync newly added seed calculators when Admin signs in
  useEffect(() => {
    if (!authReady || !user || !isAdmin || missingSeedSyncedRef.current) return;
    missingSeedSyncedRef.current = true;
    getDocs(query(collection(db, 'categories'), limit(1)))
      .then((snap) => {
        if (snap.empty) {
          return seedInitialCatalogToFirestore();
        }
        return syncMissingSeedCatalogToFirestore(true);
      })
      .catch(() => {});
  }, [authReady, user, isAdmin, seedInitialCatalogToFirestore, syncMissingSeedCatalogToFirestore]);

  const saveSpreadsheetWorkbook = useCallback(
    async (
      wb: Omit<SpreadsheetWorkbookRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      if (!user) return null;
      const isNew = !wb.id;
      const id = wb.id || makeSafeId('xls');
      try {
        if (isNew) {
          await setDoc(doc(db, 'spreadsheets', id), {
            id,
            userId: user.uid,
            title: wb.title.slice(0, 175),
            category: (wb.category || 'general').slice(0, 58),
            activeSheetId: wb.activeSheetId,
            sheets: wb.sheets.slice(0, 24),
            sharedWithLink: Boolean(wb.sharedWithLink),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'spreadsheets', id), {
            title: wb.title.slice(0, 175),
            category: (wb.category || 'general').slice(0, 58),
            activeSheetId: wb.activeSheetId,
            sheets: wb.sheets.slice(0, 24),
            sharedWithLink: Boolean(wb.sharedWithLink),
            updatedAt: serverTimestamp(),
          });
        }
        showToast(language === 'bn' ? 'এক্সেল ওয়ার্কবুক সংরক্ষিত হয়েছে।' : 'Excel workbook saved.', 'success');
        return id;
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `spreadsheets/${id}`);
      }
    },
    [user, language, showToast]
  );

  const deleteSpreadsheetWorkbook = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'spreadsheets', id));
        showToast(language === 'bn' ? 'স্প্রেডশিট মুছে ফেলা হয়েছে।' : 'Spreadsheet deleted.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `spreadsheets/${id}`);
      }
    },
    [user, language, showToast]
  );

  const recordSpreadsheetHistory = useCallback(
    async (entry: Omit<SpreadsheetHistoryRecord, 'id' | 'userId' | 'createdAt'>) => {
      if (!user) return;
      const id = makeSafeId('xlsh');
      try {
        await setDoc(doc(db, 'spreadsheetHistory', id), {
          ...entry,
          id,
          userId: user.uid,
          title: entry.title.slice(0, 175),
          summary: entry.summary.slice(0, 390),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Spreadsheet history log failed:', err);
      }
    },
    [user]
  );

  const savePresentation = useCallback(
    async (
      deck: Omit<PresentationRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      if (!user) return null;
      const isNew = !deck.id;
      const id = deck.id || makeSafeId('pres');
      try {
        if (isNew) {
          await setDoc(doc(db, 'presentations', id), {
            id,
            userId: user.uid,
            title: deck.title.slice(0, 195),
            topic: deck.topic.slice(0, 195),
            classLevel: deck.classLevel,
            subject: deck.subject.slice(0, 78),
            language: deck.language,
            level: deck.level,
            themeId: deck.themeId.slice(0, 60),
            audience: (deck.audience || '').slice(0, 138),
            purpose: (deck.purpose || '').slice(0, 195),
            slides: deck.slides.slice(0, 38),
            references: (deck.references || []).slice(0, 28),
            sharedWithLink: Boolean(deck.sharedWithLink),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'presentations', id), {
            title: deck.title.slice(0, 195),
            topic: deck.topic.slice(0, 195),
            classLevel: deck.classLevel,
            subject: deck.subject.slice(0, 78),
            language: deck.language,
            level: deck.level,
            themeId: deck.themeId.slice(0, 60),
            audience: (deck.audience || '').slice(0, 138),
            purpose: (deck.purpose || '').slice(0, 195),
            slides: deck.slides.slice(0, 38),
            references: (deck.references || []).slice(0, 28),
            sharedWithLink: Boolean(deck.sharedWithLink),
            updatedAt: serverTimestamp(),
          });
        }
        showToast(language === 'bn' ? 'প্রেজেন্টেশন সংরক্ষিত হয়েছে।' : 'Presentation saved.', 'success');
        return id;
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `presentations/${id}`);
      }
    },
    [user, language, showToast]
  );

  const deletePresentation = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'presentations', id));
        showToast(language === 'bn' ? 'প্রেজেন্টেশন মুছে ফেলা হয়েছে।' : 'Presentation deleted.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `presentations/${id}`);
      }
    },
    [user, language, showToast]
  );

  const saveCustomFormula = useCallback(
    async (
      formula: Omit<CustomFormulaRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      if (!user) return null;
      const isNew = !formula.id;
      const id = formula.id || makeSafeId('cform');
      try {
        if (isNew) {
          await setDoc(doc(db, 'customFormulas', id), {
            ...formula,
            id,
            userId: user.uid,
            authorName: (profile?.displayName || user.displayName || 'Engineer').slice(0, 118),
            authorEmail: (user.email || '').slice(0, 195),
            approvedByAdmin: isAdmin ? Boolean(formula.approvedByAdmin) : false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'customFormulas', id), {
            categoryId: formula.categoryId,
            nameEn: formula.nameEn.slice(0, 158),
            nameBn: formula.nameBn.slice(0, 158),
            descriptionEn: (formula.descriptionEn || '').slice(0, 595),
            descriptionBn: (formula.descriptionBn || '').slice(0, 595),
            formulaDisplay: formula.formulaDisplay.slice(0, 395),
            formulaReference: (formula.formulaReference || '').slice(0, 395),
            explanationEn: (formula.explanationEn || '').slice(0, 1490),
            explanationBn: (formula.explanationBn || '').slice(0, 1490),
            disclaimerEn: (formula.disclaimerEn || '').slice(0, 595),
            disclaimerBn: (formula.disclaimerBn || '').slice(0, 595),
            intermediateVars: (formula.intermediateVars || []).slice(0, 20),
            inputs: formula.inputs.slice(0, 30),
            outputs: formula.outputs.slice(0, 20),
            conditions: (formula.conditions || []).slice(0, 25),
            exampleInputs: formula.exampleInputs || {},
            showSteps: Boolean(formula.showSteps),
            showExplanation: Boolean(formula.showExplanation),
            reportTemplateId: formula.reportTemplateId || '',
            version: formula.version,
            visibility: formula.visibility,
            approvedByAdmin: isAdmin ? Boolean(formula.approvedByAdmin) : false,
            enabled: Boolean(formula.enabled),
            published: Boolean(formula.published),
            updatedAt: serverTimestamp(),
          });
        }
        showToast(language === 'bn' ? 'কাস্টম সূত্র সংরক্ষিত হয়েছে।' : 'Custom formula saved.', 'success');
        return id;
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `customFormulas/${id}`);
      }
    },
    [user, profile, isAdmin, language, showToast]
  );

  const deleteCustomFormula = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'customFormulas', id));
        showToast(language === 'bn' ? 'কাস্টম সূত্র মুছে ফেলা হয়েছে।' : 'Custom formula deleted.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `customFormulas/${id}`);
      }
    },
    [user, language, showToast]
  );

  const saveFormulaTestCase = useCallback(
    async (
      tc: Omit<FormulaTestCaseRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      if (!user) return null;
      const isNew = !tc.id;
      const id = tc.id || makeSafeId('ftc');
      try {
        if (isNew) {
          await setDoc(doc(db, 'formulaTestCases', id), {
            ...tc,
            id,
            userId: user.uid,
            name: tc.name.slice(0, 138),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'formulaTestCases', id), {
            name: tc.name.slice(0, 138),
            inputs: tc.inputs,
            expectedOutputs: tc.expectedOutputs,
            tolerancePercent: tc.tolerancePercent,
            ...(tc.lastPassed !== undefined ? { lastPassed: tc.lastPassed } : {}),
            ...(tc.lastRunAtIso ? { lastRunAtIso: tc.lastRunAtIso.slice(0, 38) } : {}),
            updatedAt: serverTimestamp(),
          });
        }
        return id;
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `formulaTestCases/${id}`);
      }
    },
    [user]
  );

  const deleteFormulaTestCase = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'formulaTestCases', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `formulaTestCases/${id}`);
      }
    },
    [user]
  );

  const recordCurrencyHistory = useCallback(
    async (entry: Omit<CurrencyHistoryRecord, 'id' | 'userId' | 'createdAt'>) => {
      if (!user) return;
      const id = makeSafeId('fxh');
      try {
        await setDoc(doc(db, 'currencyHistory', id), {
          ...entry,
          id,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Currency history save skipped:', err);
      }
    },
    [user]
  );

  const saveCurrencySettings = useCallback(
    async (settings: Omit<CurrencySettingsRecord, 'id' | 'updatedBy' | 'updatedAt'>) => {
      if (!user || !isAdmin) return;
      try {
        await setDoc(doc(db, 'currencySettings', 'global'), {
          ...settings,
          id: 'global',
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
        showToast(language === 'bn' ? 'কারেন্সি সেটিংস সংরক্ষিত।' : 'Currency settings saved.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'currencySettings/global');
      }
    },
    [user, isAdmin, language, showToast]
  );

  const saveGoogleConnection = useCallback(
    async (patch: Omit<GoogleConnectionRecord, 'id' | 'userId' | 'updatedAt'>) => {
      if (!user) return;
      try {
        await setDoc(doc(db, 'googleConnections', user.uid), {
          id: user.uid,
          userId: user.uid,
          email: (patch.email || user.email || '').slice(0, 198),
          connectedCalendar: Boolean(patch.connectedCalendar),
          connectedSheets: Boolean(patch.connectedSheets),
          connectedGmail: Boolean(patch.connectedGmail),
          ...(patch.calendarId ? { calendarId: patch.calendarId.slice(0, 178) } : {}),
          ...(patch.lastSyncedAtIso ? { lastSyncedAtIso: patch.lastSyncedAtIso.slice(0, 38) } : {}),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `googleConnections/${user.uid}`);
      }
    },
    [user]
  );

  const saveGoogleSyncJob = useCallback(
    async (
      job: Omit<GoogleSyncJobRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string | null> => {
      if (!user) return null;
      const isNew = !job.id;
      const id = job.id || makeSafeId('gsj');
      try {
        if (isNew) {
          await setDoc(doc(db, 'googleSyncJobs', id), {
            ...job,
            id,
            userId: user.uid,
            resourceName: job.resourceName.slice(0, 178),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'googleSyncJobs', id), {
            service: job.service,
            direction: job.direction,
            resourceName: job.resourceName.slice(0, 178),
            scheduleMinutes: job.scheduleMinutes,
            enabled: job.enabled,
            ...(job.lastRunAtIso ? { lastRunAtIso: job.lastRunAtIso } : {}),
            ...(job.nextRunAtIso ? { nextRunAtIso: job.nextRunAtIso } : {}),
            status: job.status,
            updatedAt: serverTimestamp(),
          });
        }
        return id;
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `googleSyncJobs/${id}`);
      }
    },
    [user]
  );

  const deleteGoogleSyncJob = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'googleSyncJobs', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `googleSyncJobs/${id}`);
      }
    },
    [user]
  );

  const recordGoogleSyncLog = useCallback(
    async (entry: Omit<GoogleSyncLogRecord, 'id' | 'userId' | 'createdAt'>) => {
      if (!user) return;
      const id = makeSafeId('gsl');
      try {
        await setDoc(doc(db, 'googleSyncLogs', id), {
          ...entry,
          id,
          userId: user.uid,
          action: entry.action.slice(0, 178),
          ...(entry.errorMessage ? { errorMessage: entry.errorMessage.slice(0, 495) } : {}),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Google sync log failed:', err);
      }
    },
    [user]
  );

  const saveUpdateSchedule = useCallback(
    async (sched: Omit<UpdateScheduleRecord, 'id' | 'userId' | 'updatedAt'> & { id?: string }) => {
      if (!user) return;
      const id = sched.id || `${user.uid}_${sched.sourceKey}`;
      try {
        await setDoc(doc(db, 'updateSchedules', id), {
          ...sched,
          id,
          userId: user.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `updateSchedules/${id}`);
      }
    },
    [user]
  );

  const recordUpdateLog = useCallback(
    async (entry: Omit<UpdateLogRecord, 'id' | 'userId' | 'createdAt'>) => {
      if (!user) return;
      const id = makeSafeId('upl');
      try {
        await setDoc(doc(db, 'updateLogs', id), {
          ...entry,
          id,
          userId: user.uid,
          summary: entry.summary.slice(0, 395),
          ...(entry.errorMessage ? { errorMessage: entry.errorMessage.slice(0, 495) } : {}),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Update log failed:', err);
      }
    },
    [user]
  );

  const logUserExport = useCallback(
    async (entry: Omit<UserExportRecord, 'id' | 'userId' | 'createdAt'>) => {
      if (!user) return;
      const id = makeSafeId('exp');
      try {
        await setDoc(doc(db, 'userExports', id), {
          id,
          userId: user.uid,
          module: entry.module,
          title: entry.title.slice(0, 195),
          format: entry.format,
          ...(entry.storagePath ? { storagePath: entry.storagePath.slice(0, 390) } : {}),
          ...(entry.downloadUrl ? { downloadUrl: entry.downloadUrl.slice(0, 1180) } : {}),
          ...(typeof entry.fileSizeBytes === 'number' && entry.fileSizeBytes >= 0 ? { fileSizeBytes: entry.fileSizeBytes } : {}),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Export archive log skipped:', err);
      }
    },
    [user]
  );

  // =========================================================================
  // NEW EXPANSION CRUD ACTIONS (PDF FOLDERS, TRANSLATE, DICTIONARY, SUGGESTIONS, DESIGNER)
  // =========================================================================

  const savePdfFolder = useCallback(
    async (folder: { id?: string; name: string; color?: string }): Promise<string | null> => {
      if (!user || !folder.name.trim()) return null;
      const isNew = !folder.id;
      const id = folder.id || makeSafeId('fld');
      try {
        if (isNew) {
          await setDoc(doc(db, 'pdfFolders', id), {
            id,
            userId: user.uid,
            name: folder.name.trim().slice(0, 80),
            color: folder.color || '#1d4ed8',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'pdfFolders', id), {
            name: folder.name.trim().slice(0, 80),
            color: folder.color || '#1d4ed8',
            updatedAt: serverTimestamp(),
          });
        }
        showToast(language === 'bn' ? 'ফোল্ডার সংরক্ষিত হয়েছে।' : 'Folder saved.', 'success');
        return id;
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `pdfFolders/${id}`);
      }
    },
    [user, language, showToast]
  );

  const deletePdfFolder = useCallback(
    async (folderId: string) => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'pdfFolders', folderId));
        const affected = pdfDocuments.filter((d) => d.folderId === folderId);
        for (const d of affected) {
          await updateDoc(doc(db, 'pdfDocuments', d.id), {
            folderId: '',
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
        showToast(language === 'bn' ? 'ফোল্ডার মুছে ফেলা হয়েছে।' : 'Folder deleted.', 'info');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `pdfFolders/${folderId}`);
      }
    },
    [user, pdfDocuments, language, showToast]
  );

  const movePdfToFolder = useCallback(
    async (docId: string, folderId: string) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'pdfDocuments', docId), {
          folderId: folderId.slice(0, 120),
          updatedAt: serverTimestamp(),
        });
        showToast(language === 'bn' ? 'ডকুমেন্ট ফোল্ডারে সরানো হয়েছে।' : 'Document moved to folder.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `pdfDocuments/${docId}`);
      }
    },
    [user, language, showToast]
  );

  const saveTranslationRecord = useCallback(
    async (
      entry: Omit<TranslationHistoryRecord, 'id' | 'userId' | 'createdAt' | 'isFavourite'>
    ): Promise<string | null> => {
      if (!user) return null;
      const id = makeSafeId('trn');
      try {
        await setDoc(doc(db, 'translationHistory', id), {
          id,
          userId: user.uid,
          sourceLang: entry.sourceLang.slice(0, 20),
          targetLang: entry.targetLang.slice(0, 20),
          detectedLang: (entry.detectedLang || '').slice(0, 20),
          sourceText: entry.sourceText.slice(0, 8000),
          translatedText: entry.translatedText.slice(0, 8000),
          mode: entry.mode,
          provider: entry.provider.slice(0, 80),
          isFavourite: false,
          createdAt: serverTimestamp(),
        });
        return id;
      } catch (err) {
        console.warn('Translation history write skipped:', err);
        return null;
      }
    },
    [user]
  );

  const toggleFavouriteTranslation = useCallback(
    async (item: TranslationHistoryRecord | FavouriteTranslationRecord, makeFav: boolean) => {
      if (!user) return;
      try {
        if (makeFav) {
          const favId = `favtrn_${item.id}`;
          await setDoc(doc(db, 'favouriteTranslations', favId), {
            id: favId,
            userId: user.uid,
            sourceLang: item.sourceLang.slice(0, 20),
            targetLang: item.targetLang.slice(0, 20),
            sourceText: item.sourceText.slice(0, 8000),
            translatedText: item.translatedText.slice(0, 8000),
            mode: item.mode,
            createdAt: serverTimestamp(),
          });
          if ('isFavourite' in item) {
            await updateDoc(doc(db, 'translationHistory', item.id), { isFavourite: true }).catch(() => {});
          }
          showToast(language === 'bn' ? 'প্রিয় অনুবাদে সংরক্ষিত হয়েছে।' : 'Saved to favourite translations.', 'success');
        } else {
          await deleteDoc(doc(db, 'favouriteTranslations', item.id.startsWith('favtrn_') ? item.id : `favtrn_${item.id}`)).catch(() => {});
          if ('isFavourite' in item) {
            await updateDoc(doc(db, 'translationHistory', item.id), { isFavourite: false }).catch(() => {});
          }
          showToast(language === 'bn' ? 'প্রিয় তালিকা থেকে সরানো হয়েছে।' : 'Removed from favourites.', 'info');
        }
      } catch (err) {
        console.warn('Favourite translation toggle error:', err);
      }
    },
    [user, language, showToast]
  );

  const deleteTranslationRecord = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, 'translationHistory', id)).catch(() => {});
    },
    [user]
  );

  const clearTranslationHistory = useCallback(async () => {
    if (!user || translationHistory.length === 0) return;
    try {
      const batch = writeBatch(db);
      translationHistory.slice(0, 120).forEach((item) => batch.delete(doc(db, 'translationHistory', item.id)));
      await batch.commit();
      showToast(language === 'bn' ? 'অনুবাদ ইতিহাস মুছে ফেলা হয়েছে।' : 'Translation history cleared.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'translationHistory');
    }
  }, [user, translationHistory, language, showToast]);

  const saveDictionaryHistory = useCallback(
    async (entry: Omit<DictionaryHistoryRecord, 'id' | 'userId' | 'createdAt'>) => {
      if (!user) return;
      const id = makeSafeId('dict');
      try {
        await setDoc(doc(db, 'dictionaryHistory', id), {
          id,
          userId: user.uid,
          word: entry.word.slice(0, 120),
          direction: entry.direction,
          domain: entry.domain,
          meaningBn: entry.meaningBn.slice(0, 600),
          englishDefinition: entry.englishDefinition.slice(0, 1200),
          partOfSpeech: entry.partOfSpeech.slice(0, 60),
          phonetic: (entry.phonetic || '').slice(0, 80),
          sourceName: entry.sourceName.slice(0, 120),
          aiExplanationGenerated: Boolean(entry.aiExplanationGenerated),
          createdAt: serverTimestamp(),
        });
      } catch {
        // Ignore non-fatal dictionary history error
      }
    },
    [user]
  );

  const toggleFavouriteWord = useCallback(
    async (item: Omit<FavouriteWordRecord, 'id' | 'userId' | 'createdAt'>): Promise<boolean> => {
      if (!user) return false;
      const norm = item.word.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff_-]/g, '_').slice(0, 60) || 'word';
      const existing = favouriteWords.find((w) => w.word.toLowerCase() === item.word.toLowerCase());
      try {
        if (existing) {
          await deleteDoc(doc(db, 'favouriteWords', existing.id));
          showToast(language === 'bn' ? 'পছন্দের শব্দ থেকে সরানো হয়েছে।' : 'Removed from favourite words.', 'info');
          return false;
        }
        const id = makeSafeId(`favw_${norm}`);
        await setDoc(doc(db, 'favouriteWords', id), {
          id,
          userId: user.uid,
          word: item.word.slice(0, 120),
          meaningBn: item.meaningBn.slice(0, 600),
          englishDefinition: item.englishDefinition.slice(0, 1200),
          partOfSpeech: item.partOfSpeech.slice(0, 60),
          phonetic: (item.phonetic || '').slice(0, 80),
          domain: item.domain,
          examples: (item.examples || []).slice(0, 5),
          synonyms: (item.synonyms || []).slice(0, 12),
          antonyms: (item.antonyms || []).slice(0, 12),
          createdAt: serverTimestamp(),
        });
        showToast(language === 'bn' ? 'শব্দভাণ্ডারে সংরক্ষিত হয়েছে।' : 'Saved to favourite vocabulary.', 'success');
        return true;
      } catch (err) {
        console.warn('Favourite word toggle skipped:', err);
        return false;
      }
    },
    [user, favouriteWords, language, showToast]
  );

  const clearDictionaryHistory = useCallback(async () => {
    if (!user || dictionaryHistory.length === 0) return;
    try {
      const batch = writeBatch(db);
      dictionaryHistory.slice(0, 100).forEach((item) => batch.delete(doc(db, 'dictionaryHistory', item.id)));
      await batch.commit();
      showToast(language === 'bn' ? 'শব্দ অনুসন্ধান ইতিহাস মুছে ফেলা হয়েছে।' : 'Dictionary history cleared.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'dictionaryHistory');
    }
  }, [user, dictionaryHistory, language, showToast]);

  const recordCalculatorRun = useCallback(
    async (entry: Omit<CalculatorHistoryRecord, 'id' | 'userId' | 'createdAt'>): Promise<string | null> => {
      if (!user || appSettings.calculatorConfig?.allowCloudHistory === false) return null;
      const id = makeSafeId('chist');
      try {
        await setDoc(doc(db, 'calculatorHistory', id), {
          id,
          userId: user.uid,
          mode: entry.mode,
          expression: entry.expression.slice(0, 500),
          result: entry.result.slice(0, 300),
          ...(entry.unit ? { unit: entry.unit.slice(0, 40) } : {}),
          ...(entry.steps ? { steps: entry.steps.slice(0, 2000) } : {}),
          ...(entry.inputsSummary ? { inputsSummary: entry.inputsSummary.slice(0, 500) } : {}),
          createdAt: serverTimestamp(),
        });
        return id;
      } catch {
        return null;
      }
    },
    [user, appSettings.calculatorConfig?.allowCloudHistory]
  );

  const deleteCalculatorRun = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, 'calculatorHistory', id)).catch(() => {});
    },
    [user]
  );

  const clearCalculatorHistory = useCallback(async () => {
    if (!user || calculatorHistory.length === 0) return;
    try {
      const batch = writeBatch(db);
      calculatorHistory.slice(0, 150).forEach((c) => batch.delete(doc(db, 'calculatorHistory', c.id)));
      await batch.commit();
      showToast(language === 'bn' ? 'ক্যালকুলেটর ইতিহাস মুছে ফেলা হয়েছে।' : 'Calculator history cleared.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'calculatorHistory');
    }
  }, [user, calculatorHistory, language, showToast]);

  const submitSuggestion = useCallback(
    async (entry: {
      title: string;
      category: SuggestionCategory;
      description: string;
      relatedModule: string;
      attachmentDataUrl?: string;
      priority: 'low' | 'medium' | 'high';
      visibility: 'public' | 'private';
    }): Promise<string | null> => {
      if (!user) return null;
      const id = makeSafeId('sug');
      try {
        await setDoc(doc(db, 'suggestions', id), {
          id,
          userId: user.uid,
          userName: (profile?.displayName || user.displayName || 'User').slice(0, 120),
          userEmail: (user.email || '').slice(0, 200),
          title: entry.title.trim().slice(0, 180),
          category: entry.category,
          description: entry.description.trim().slice(0, 4000),
          relatedModule: entry.relatedModule.slice(0, 80),
          ...(entry.attachmentDataUrl ? { attachmentDataUrl: entry.attachmentDataUrl.slice(0, 320000) } : {}),
          priority: entry.priority,
          visibility: entry.visibility,
          status: 'Submitted',
          voteCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        void logUserActivity('SUBMIT_SUGGESTION', 'suggestions', entry.title.slice(0, 120));
        showToast(
          language === 'bn' ? 'আপনার পরামর্শ ও মতামত সফলভাবে জমা হয়েছে!' : 'Suggestion submitted successfully!',
          'success'
        );
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `suggestions/${id}`);
      }
    },
    [user, profile, language, logUserActivity, showToast]
  );

  const toggleSuggestionVote = useCallback(
    async (suggestion: SuggestionRecord) => {
      if (!user) {
        showToast(language === 'bn' ? 'ভোট দিতে সাইন ইন করুন।' : 'Sign in to vote on suggestions.', 'info');
        return;
      }
      const voteId = `${suggestion.id}_${user.uid}`;
      const existingVote = suggestionVotes.find((v) => v.id === voteId);
      try {
        if (existingVote) {
          await deleteDoc(doc(db, 'suggestionVotes', voteId));
          await updateDoc(doc(db, 'suggestions', suggestion.id), {
            voteCount: Math.max(0, (suggestion.voteCount || 0) - 1),
          }).catch(() => {});
        } else {
          await setDoc(doc(db, 'suggestionVotes', voteId), {
            id: voteId,
            suggestionId: suggestion.id,
            userId: user.uid,
            createdAt: serverTimestamp(),
          });
          await updateDoc(doc(db, 'suggestions', suggestion.id), {
            voteCount: (suggestion.voteCount || 0) + 1,
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Suggestion vote error:', err);
      }
    },
    [user, suggestionVotes, language, showToast]
  );

  const adminUpdateSuggestion = useCallback(
    async (
      suggestionId: string,
      patch: Partial<{
        status: SuggestionStatus;
        adminReply: string;
        internalNote: string;
        isImportant: boolean;
        isDevelopmentTask: boolean;
      }>
    ) => {
      if (!user || !isAdmin) return;
      try {
        await updateDoc(doc(db, 'suggestions', suggestionId), {
          ...patch,
          updatedAt: serverTimestamp(),
        });
        await logAdminAudit('UPDATE_SUGGESTION', 'suggestions', suggestionId, JSON.stringify(patch).slice(0, 350));
        showToast('Suggestion updated.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `suggestions/${suggestionId}`);
      }
    },
    [user, isAdmin, logAdminAudit, showToast]
  );

  const saveDesignerInfo = useCallback(
    async (info: Omit<DesignerInfoRecord, 'id' | 'updatedAt' | 'updatedBy'>) => {
      if (!user || !isAdmin) return;
      try {
        await setDoc(doc(db, 'designerInformation', 'global'), {
          ...info,
          id: 'global',
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
        await logAdminAudit('UPDATE_DESIGNER_INFO', 'designerInformation', 'global', `Updated designer card (${info.nameEn})`);
        showToast(language === 'bn' ? 'ডিজাইনার তথ্য সংরক্ষিত হয়েছে।' : 'Designer information updated.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'designerInformation/global');
      }
    },
    [user, isAdmin, logAdminAudit, language, showToast]
  );

  const logApiUsage = useCallback(
    async (entry: Omit<ApiUsageLogRecord, 'id' | 'userId' | 'createdAt'>) => {
      if (!user) return;
      const id = makeSafeId('api');
      try {
        await setDoc(doc(db, 'apiUsageLogs', id), {
          id,
          userId: user.uid,
          service: entry.service,
          status: entry.status,
          charsCount: entry.charsCount,
          detail: entry.detail.slice(0, 350),
          createdAt: serverTimestamp(),
        });
      } catch {
        // Ignore non-fatal API telemetry
      }
    },
    [user]
  );

  const value: AppContextValue = {
    user,
    profile,
    authReady,
    isAdmin,
    language,
    theme,
    activeSection,
    activeCategoryId,
    activeCalculatorId,
    globalSearch,
    categories,
    calculators,
    units,
    reportTemplates,
    history,
    reports,
    userReportTemplates,
    reportSections,
    reportAssets,
    emailHistory,
    reportSettings,
    events,
    reminders,
    notifications,
    notes,
    appSettings,
    auditLogs,
    allUsers,
    pdfDocuments,
    pdfFolders,
    userStorageUsage,
    pdfChats,
    pdfComparisons,
    todayAiUsage,
    allAiUsage,
    pendingReportDraft,
    pendingNoteDraft,
    pendingCalculatorPrefill,
    pendingExcelPush,
    spreadsheets,
    spreadsheetTemplates,
    spreadsheetHistory,
    presentations,
    presentationTemplates,
    customFormulas,
    publicCustomFormulas,
    formulaTestCases,
    schoolFormulas,
    schoolReferences,
    currencyHistory,
    currencySettings,
    googleConnection,
    googleSyncJobs,
    googleSyncLogs,
    updateSchedules,
    updateLogs,
    userExports,
    translationHistory,
    favouriteTranslations,
    dictionaryHistory,
    favouriteWords,
    calculatorHistory,
    suggestions,
    adminAllSuggestions,
    suggestionVotes,
    designerInfo,
    apiUsageLogs,
    userActivityLogs,
    toastMessage,
    setLanguage,
    setTheme,
    navigateTo,
    setGlobalSearch,
    setPendingReportDraft,
    setPendingNoteDraft,
    setPendingCalculatorPrefill,
    setPendingExcelPush,
    sendToExcel,
    openCalculatorWithPrefill,
    showToast,
    signInWithGoogle,
    signOut,
    updateUserProfile,
    requestAccountDeletion,
    downloadMyData,
    getUserStorageQuotaBytes,
    getTotalStorageUsedBytes,
    recordCalculation,
    toggleSaveHistory,
    deleteHistoryEntry,
    saveGeneratedReport,
    updateGeneratedReport,
    deleteGeneratedReport,
    saveUserReportTemplate,
    deleteUserReportTemplate,
    saveReportSection,
    deleteReportSection,
    saveReportAsset,
    deleteReportAsset,
    saveEmailHistory,
    updateEmailHistory,
    deleteEmailHistory,
    saveReportSettings,
    saveCalendarEvent,
    deleteCalendarEvent,
    saveReminder,
    deleteReminder,
    saveNote,
    deleteNote,
    renamePdfDocument,
    togglePdfSharing,
    updatePdfExtractedTables,
    deletePdfDocument,
    incrementAiUsage,
    saveSpreadsheetWorkbook,
    deleteSpreadsheetWorkbook,
    recordSpreadsheetHistory,
    savePresentation,
    deletePresentation,
    saveCustomFormula,
    deleteCustomFormula,
    saveFormulaTestCase,
    deleteFormulaTestCase,
    recordCurrencyHistory,
    saveCurrencySettings,
    saveGoogleConnection,
    saveGoogleSyncJob,
    deleteGoogleSyncJob,
    recordGoogleSyncLog,
    saveUpdateSchedule,
    recordUpdateLog,
    logUserExport,
    markNotificationRead,
    sendAdminBroadcast,
    seedInitialCatalogToFirestore,
    syncMissingSeedCatalogToFirestore,
    logAdminAudit,
    savePdfFolder,
    deletePdfFolder,
    movePdfToFolder,
    recomputeUserStorageUsage,
    saveTranslationRecord,
    toggleFavouriteTranslation,
    deleteTranslationRecord,
    clearTranslationHistory,
    saveDictionaryHistory,
    toggleFavouriteWord,
    clearDictionaryHistory,
    recordCalculatorRun,
    deleteCalculatorRun,
    clearCalculatorHistory,
    submitSuggestion,
    toggleSuggestionVote,
    adminUpdateSuggestion,
    saveDesignerInfo,
    logApiUsage,
    logUserActivity,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
