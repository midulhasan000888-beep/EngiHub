import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  Activity,
  Bell,
  Database,
  Download,
  FileScan,
  FileSpreadsheet,
  FolderCog,
  Info,
  MessageSquare,
  Plus,
  Send,
  Settings,
  ShieldAlert,
  Sigma,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { makeSafeId, useApp } from '../../context/AppContext';
import { apiUrl } from '../../engine/apiClient';
import { DEFAULT_APP_SETTINGS } from '../../data/seedCatalog';
import { REPORT_ELEMENT_CATALOG } from '../../engine/reportDesignerUtils';
import { AdminFormulaBuilder } from './AdminFormulaBuilder';
import {
  AdminDesignerInfoPanel,
  AdminSuggestionsPanel,
  AdminUserDirectoryPanel,
} from './AdminExpansionPanels';
import {
  AiPdfConfig,
  AppSettings,
  Category,
  DictionaryDomain,
  ReportElementType,
  ReportSettingsRecord,
  ReportTemplate,
  UnitDefinition,
  UserRole,
} from '../../types';

type AdminTab =
  | 'overview'
  | 'formulas'
  | 'categories'
  | 'users'
  | 'suggestions'
  | 'templates'
  | 'ai-pdf'
  | 'notifications'
  | 'designer'
  | 'settings';

export const AdminPanel: React.FC = () => {
  const {
    user,
    isAdmin,
    language,
    categories,
    calculators,
    units,
    reportTemplates,
    reportSettings,
    allUsers,
    allAiUsage,
    auditLogs,
    apiUsageLogs,
    appSettings,
    seedInitialCatalogToFirestore,
    syncMissingSeedCatalogToFirestore,
    saveReportSettings,
    sendAdminBroadcast,
    logAdminAudit,
    showToast,
  } = useApp();

  const [translateApiOk, setTranslateApiOk] = useState<boolean | null>(null);
  const [analyzerStatus, setAnalyzerStatus] = useState<{
    providers: { gemini: boolean; openai: boolean; anthropic: boolean };
    r2Configured: boolean;
  } | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/translate/status'))
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setTranslateApiOk(Boolean(d.configured)))
      .catch(() => setTranslateApiOk(false));

    fetch(apiUrl('/api/analyzer/status'))
      .then((r) => r.json())
      .then((d: { providers?: { gemini?: boolean; openai?: boolean; anthropic?: boolean }; r2Configured?: boolean }) => {
        setAnalyzerStatus({
          providers: {
            gemini: Boolean(d.providers?.gemini),
            openai: Boolean(d.providers?.openai),
            anthropic: Boolean(d.providers?.anthropic),
          },
          r2Configured: Boolean(d.r2Configured),
        });
      })
      .catch(() => null);
  }, []);

  const [tab, setTab] = useState<AdminTab>('overview');

  // Category creation state
  const [catNameEn, setCatNameEn] = useState('');
  const [catNameBn, setCatNameBn] = useState('');
  const [catDescEn, setCatDescEn] = useState('');

  // Unit creation state
  const [unitDim, setUnitDim] = useState('length');
  const [unitSymbol, setUnitSymbol] = useState('');
  const [unitNameEn, setUnitNameEn] = useState('');
  const [unitFactor, setUnitFactor] = useState('1');

  // Template designer state
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [tplNameEn, setTplNameEn] = useState('Custom Engineering Audit Report');
  const [tplNameBn, setTplNameBn] = useState('কাস্টম ইঞ্জিনিয়ারিং অডিট রিপোর্ট');
  const [tplCategory, setTplCategory] = useState('engineering');
  const [tplDescEn, setTplDescEn] = useState('');
  const [tplOrient, setTplOrient] = useState<'portrait' | 'landscape'>('portrait');
  const [tplHeader, setTplHeader] = useState('TECHNICAL AUDIT & CALCULATION RECORD');
  const [tplFooter, setTplFooter] = useState('Prepared via SUTRO SATHI');
  const [tplAccent, setTplAccent] = useState('#1d4ed8');
  const [tplSig, setTplSig] = useState(true);
  const [tplChart, setTplChart] = useState(true);
  const [tplRecommended, setTplRecommended] = useState(false);
  const [tplLocked, setTplLocked] = useState(false);

  const [reportCfgDraft, setReportCfgDraft] = useState<ReportSettingsRecord>(() => ({ ...reportSettings }));
  useEffect(() => {
    setReportCfgDraft({ ...reportSettings });
  }, [reportSettings]);

  // Broadcast state
  const [bcastTitle, setBcastTitle] = useState('');
  const [bcastBody, setBcastBody] = useState('');

  // Settings & Calendar config state
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(() => ({
    ...DEFAULT_APP_SETTINGS,
    ...appSettings,
    aiPdfConfig: {
      ...DEFAULT_APP_SETTINGS.aiPdfConfig!,
      ...(appSettings.aiPdfConfig || {}),
    },
    translateConfig: {
      ...DEFAULT_APP_SETTINGS.translateConfig!,
      ...(appSettings.translateConfig || {}),
    },
    dictionaryConfig: {
      ...DEFAULT_APP_SETTINGS.dictionaryConfig!,
      ...(appSettings.dictionaryConfig || {}),
    },
    calculatorConfig: {
      ...DEFAULT_APP_SETTINGS.calculatorConfig!,
      ...(appSettings.calculatorConfig || {}),
    },
    storageConfig: {
      ...DEFAULT_APP_SETTINGS.storageConfig!,
      ...(appSettings.storageConfig || {}),
    },
    profileConfig: {
      ...DEFAULT_APP_SETTINGS.profileConfig!,
      ...(appSettings.profileConfig || {}),
    },
  }));
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    setSettingsDraft({
      ...DEFAULT_APP_SETTINGS,
      ...appSettings,
      aiPdfConfig: {
        ...DEFAULT_APP_SETTINGS.aiPdfConfig!,
        ...(appSettings.aiPdfConfig || {}),
      },
      translateConfig: {
        ...DEFAULT_APP_SETTINGS.translateConfig!,
        ...(appSettings.translateConfig || {}),
      },
      dictionaryConfig: {
        ...DEFAULT_APP_SETTINGS.dictionaryConfig!,
        ...(appSettings.dictionaryConfig || {}),
      },
      calculatorConfig: {
        ...DEFAULT_APP_SETTINGS.calculatorConfig!,
        ...(appSettings.calculatorConfig || {}),
      },
      storageConfig: {
        ...DEFAULT_APP_SETTINGS.storageConfig!,
        ...(appSettings.storageConfig || {}),
      },
      profileConfig: {
        ...DEFAULT_APP_SETTINGS.profileConfig!,
        ...(appSettings.profileConfig || {}),
      },
    });
  }, [appSettings]);

  const aiUsageTotals = useMemo(() => {
    return allAiUsage.reduce(
      (acc, row) => ({
        analyses: acc.analyses + (row.analysisCount || 0),
        questions: acc.questions + (row.questionCount || 0),
        comparisons: acc.comparisons + (row.comparisonCount || 0),
      }),
      { analyses: 0, questions: 0, comparisons: 0 }
    );
  }, [allAiUsage]);

  const userLookup = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>();
    allUsers.forEach((u) => map.set(u.uid, { name: u.displayName, email: u.email }));
    return map;
  }, [allUsers]);

  if (!user || !isAdmin) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-8 text-center space-y-3 max-w-lg mx-auto">
        <ShieldAlert className="w-8 h-8 text-red-600 mx-auto" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {language === 'bn'
            ? 'এই অ্যাডমিন প্যানেলে প্রবেশের জন্য অনুমোদিত অ্যাডমিন অ্যাকাউন্ট প্রয়োজন।'
            : 'Only verified administrators can access global formula, user, and system configuration controls.'}
        </p>
      </div>
    );
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameEn.trim()) return;
    const id = catNameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48) || makeSafeId('cat');
    const newCat: Category = {
      id,
      slug: id,
      nameEn: catNameEn.trim(),
      nameBn: catNameBn.trim() || catNameEn.trim(),
      descriptionEn: catDescEn.trim(),
      descriptionBn: catDescEn.trim(),
      icon: 'Sigma',
      order: categories.length + 1,
      enabled: true,
    };
    try {
      await setDoc(doc(db, 'categories', id), { ...newCat, updatedAt: serverTimestamp() });
      await logAdminAudit('CREATE_CATEGORY', 'categories', id, `Created category ${newCat.nameEn}`);
      setCatNameEn('');
      setCatNameBn('');
      setCatDescEn('');
      showToast('Category added.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `categories/${id}`);
    }
  };

  const toggleCategoryEnabled = async (cat: Category) => {
    try {
      await setDoc(doc(db, 'categories', cat.id), {
        ...cat,
        enabled: !cat.enabled,
        updatedAt: serverTimestamp(),
      });
      await logAdminAudit('TOGGLE_CATEGORY', 'categories', cat.id, `enabled=${!cat.enabled}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `categories/${cat.id}`);
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitSymbol.trim() || !unitNameEn.trim()) return;
    const id = makeSafeId('unit');
    const newUnit: UnitDefinition = {
      id,
      dimension: unitDim,
      symbol: unitSymbol.trim(),
      nameEn: unitNameEn.trim(),
      nameBn: unitNameEn.trim(),
      toBaseFactor: Number(unitFactor) || 1,
      enabled: true,
    };
    try {
      await setDoc(doc(db, 'units', id), { ...newUnit, updatedAt: serverTimestamp() });
      await logAdminAudit('CREATE_UNIT', 'units', id, `${newUnit.symbol} (${newUnit.dimension})`);
      setUnitSymbol('');
      setUnitNameEn('');
      showToast('Unit saved.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `units/${id}`);
    }
  };



  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingTplId || makeSafeId('tpl');
    const existingTpl = editingTplId ? reportTemplates.find((x) => x.id === editingTplId) : undefined;
    const tpl: ReportTemplate = {
      id,
      nameEn: tplNameEn.trim().slice(0, 138),
      nameBn: (tplNameBn.trim() || tplNameEn.trim()).slice(0, 138),
      category: tplCategory,
      descriptionEn: tplDescEn.trim().slice(0, 390),
      recommended: tplRecommended,
      lockedByAdmin: tplLocked,
      orientation: tplOrient,
      headerText: tplHeader.slice(0, 290),
      footerText: tplFooter.slice(0, 290),
      accentColor: tplAccent,
      showSignature: tplSig,
      showChart: tplChart,
      customFields: existingTpl?.customFields || [],
      enabled: existingTpl?.enabled ?? true,
      updatedBy: user.uid,
    };
    try {
      await setDoc(doc(db, 'reportTemplates', id), { ...tpl, updatedAt: serverTimestamp() });
      await logAdminAudit(
        editingTplId ? 'UPDATE_TEMPLATE' : 'CREATE_TEMPLATE',
        'reportTemplates',
        id,
        `Template: ${tpl.nameEn} (locked=${tplLocked}, rec=${tplRecommended})`
      );
      setEditingTplId(null);
      showToast(editingTplId ? 'Admin template updated.' : 'Report template published.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `reportTemplates/${id}`);
    }
  };

  const handleLoadTplForEdit = (tpl: ReportTemplate) => {
    setEditingTplId(tpl.id);
    setTplNameEn(tpl.nameEn);
    setTplNameBn(tpl.nameBn);
    setTplCategory(tpl.category || 'engineering');
    setTplDescEn(tpl.descriptionEn || '');
    setTplOrient(tpl.orientation);
    setTplHeader(tpl.headerText || '');
    setTplFooter(tpl.footerText || '');
    setTplAccent(tpl.accentColor || '#1d4ed8');
    setTplSig(tpl.showSignature);
    setTplChart(tpl.showChart ?? true);
    setTplRecommended(Boolean(tpl.recommended));
    setTplLocked(Boolean(tpl.lockedByAdmin));
  };

  const handlePatchTemplateFlag = async (
    tpl: ReportTemplate,
    patch: Partial<Pick<ReportTemplate, 'enabled' | 'recommended' | 'lockedByAdmin'>>
  ) => {
    try {
      await setDoc(doc(db, 'reportTemplates', tpl.id), {
        ...tpl,
        ...patch,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      await logAdminAudit('PATCH_TEMPLATE', 'reportTemplates', tpl.id, JSON.stringify(patch));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reportTemplates/${tpl.id}`);
    }
  };

  const handleDeleteAdminTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reportTemplates', id));
      await logAdminAudit('DELETE_TEMPLATE', 'reportTemplates', id, `Deleted template ${id}`);
      showToast('Admin template deleted.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reportTemplates/${id}`);
    }
  };

  const handleToggleDisabledElement = (elType: ReportElementType) => {
    const prev = reportCfgDraft.disabledElementTypes || [];
    const next = prev.includes(elType) ? prev.filter((x) => x !== elType) : [...prev, elType];
    setReportCfgDraft((d) => ({ ...d, disabledElementTypes: next }));
  };

  const handleSaveGlobalReportPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveReportSettings({
      defaultCompanyName: reportCfgDraft.defaultCompanyName || '',
      defaultAccentColor: reportCfgDraft.defaultAccentColor || '#1d4ed8',
      defaultFontFamily: reportCfgDraft.defaultFontFamily || '"Plus Jakarta Sans", "Noto Sans Bengali", sans-serif',
      defaultHeaderText: reportCfgDraft.defaultHeaderText || '',
      defaultFooterText: reportCfgDraft.defaultFooterText || '',
      defaultMarginMm: Number(reportCfgDraft.defaultMarginMm) || 12,
      allowUserCustomTemplates: Boolean(reportCfgDraft.allowUserCustomTemplates),
      allowCustomPageSizes: Boolean(reportCfgDraft.allowCustomPageSizes),
      allowEmailDispatch: Boolean(reportCfgDraft.allowEmailDispatch),
      allowExcelExport: Boolean(reportCfgDraft.allowExcelExport),
      disabledElementTypes: reportCfgDraft.disabledElementTypes || [],
    });
    await logAdminAudit('UPDATE_REPORT_POLICY', 'reportSettings', 'global', 'Updated global report designer & email policies');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'appSettings', 'global'), {
        ...settingsDraft,
        id: 'global',
        updatedAt: serverTimestamp(),
      });
      await logAdminAudit('UPDATE_SETTINGS', 'appSettings', 'global', 'Updated app & calendar settings');
      showToast('Application & calendar settings saved.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'appSettings/global');
    }
  };

  const handleSaveAiPdfConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const aiPdfConfig = settingsDraft.aiPdfConfig || DEFAULT_APP_SETTINGS.aiPdfConfig!;
    try {
      await setDoc(doc(db, 'appSettings', 'global'), {
        ...settingsDraft,
        aiPdfConfig,
        id: 'global',
        updatedAt: serverTimestamp(),
      });
      await logAdminAudit(
        'UPDATE_AI_PDF_CONFIG',
        'appSettings',
        'global',
        `enabled=${aiPdfConfig.enabled}, provider=${aiPdfConfig.aiProvider || 'gemini'}, model=${aiPdfConfig.preferredModel}, maxPages=${aiPdfConfig.maxPagesPerFile}, dailyLimit=${aiPdfConfig.dailyUserAnalysisLimit}`
      );
      showToast('AI Smart Information Analyzer configuration saved.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'appSettings/global');
    }
  };

  const updateAiPdfField = <K extends keyof AiPdfConfig>(key: K, val: AiPdfConfig[K]) => {
    setSettingsDraft((prev) => ({
      ...prev,
      aiPdfConfig: {
        ...DEFAULT_APP_SETTINGS.aiPdfConfig!,
        ...(prev.aiPdfConfig || {}),
        [key]: val,
      },
    }));
  };

  const toggleAiPdfArrayItem = (field: 'allowedCategories' | 'allowedRoles', item: string) => {
    const current = settingsDraft.aiPdfConfig?.[field] || DEFAULT_APP_SETTINGS.aiPdfConfig![field];
    const exists = current.includes(item as never);
    const next = exists ? current.filter((v) => v !== item) : [...current, item];
    updateAiPdfField(field, next as never);
  };

  const handleDatabaseBackup = async () => {
    setBackingUp(true);
    try {
      const collections = [
        'categories',
        'calculators',
        'formulas',
        'formulaVersions',
        'units',
        'reportTemplates',
        'users',
        'userAiUsage',
        'auditLogs',
      ];
      const dump: Record<string, unknown[]> = {};
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        dump[col] = snap.docs.map((d) => d.data());
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sutro-sathi-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await logAdminAudit('DATABASE_BACKUP', 'system', 'export', 'Exported Firestore backup JSON');
      showToast('Full database backup exported.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Backup failed', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'overview', label: 'Analytics & Audit', icon: Activity },
    { id: 'formulas', label: 'Formula & Calc Builder', icon: Sigma },
    { id: 'categories', label: 'Categories & Units', icon: FolderCog },
    { id: 'users', label: 'User Directory & Quota', icon: Users },
    { id: 'suggestions', label: 'Suggestions & Feedback', icon: MessageSquare },
    { id: 'templates', label: 'Report Templates', icon: FileSpreadsheet },
    { id: 'ai-pdf', label: 'AI & PDF Analyzer', icon: FileScan },
    { id: 'notifications', label: 'Broadcasts', icon: Bell },
    { id: 'designer', label: 'Designer Info', icon: Info },
    { id: 'settings', label: 'Settings & Policies', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            SUTRO SATHI — Admin Management Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Manage formulas, calculators, units, report templates, RBAC roles, calendar config, and audit logs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => syncMissingSeedCatalogToFirestore(false)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>Add Missing Built-in Tools</span>
          </button>
          <button
            type="button"
            onClick={seedInitialCatalogToFirestore}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span>Reset Seed Catalog</span>
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
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

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Active Categories', val: categories.length },
              { label: 'Dynamic Calculators', val: calculators.length },
              { label: 'Registered Users', val: allUsers.length },
              { label: 'Report Templates', val: reportTemplates.length },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs text-slate-500">{m.label}</p>
                <p className="mt-1 text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white">
                  {m.val}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold">Recent Security & Admin Audit Logs</h2>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No audit events logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Target</th>
                      <th className="py-2 pr-4">Actor</th>
                      <th className="py-2">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditLogs.slice(0, 25).map((l) => (
                      <tr key={l.id}>
                        <td className="py-2 pr-4 font-mono font-medium text-blue-700 dark:text-blue-400">
                          {l.action}
                        </td>
                        <td className="py-2 pr-4 font-mono">
                          {l.targetCollection}/{l.targetId}
                        </td>
                        <td className="py-2 pr-4 text-slate-500">{l.actorEmail || l.actorUid}</td>
                        <td className="py-2 text-slate-600 dark:text-slate-300">{l.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'formulas' && <AdminFormulaBuilder />}

      {tab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-semibold">Category Management</h2>
            <form onSubmit={handleCreateCategory} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={catNameEn}
                  onChange={(e) => setCatNameEn(e.target.value)}
                  placeholder="Category Name (EN)"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={catNameBn}
                  onChange={(e) => setCatNameBn(e.target.value)}
                  placeholder="Category Name (BN)"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
              </div>
              <input
                type="text"
                value={catDescEn}
                onChange={(e) => setCatDescEn(e.target.value)}
                placeholder="Description"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </button>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {categories.map((c) => (
                <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold">{c.nameEn}</p>
                    <p className="text-slate-500">{c.nameBn}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCategoryEnabled(c)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                      c.enabled
                        ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-semibold">Engineering Unit Management</h2>
            <form onSubmit={handleAddUnit} className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={unitDim}
                onChange={(e) => setUnitDim(e.target.value)}
                placeholder="Dimension (e.g. length)"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <input
                type="text"
                value={unitSymbol}
                onChange={(e) => setUnitSymbol(e.target.value)}
                placeholder="Symbol (e.g. kVA)"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <input
                type="text"
                value={unitNameEn}
                onChange={(e) => setUnitNameEn(e.target.value)}
                placeholder="Unit Name"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <input
                type="number"
                step="any"
                value={unitFactor}
                onChange={(e) => setUnitFactor(e.target.value)}
                placeholder="Factor to Base"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono"
              />
              <button
                type="submit"
                className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 py-1.5 text-xs font-medium text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add / Update Unit</span>
              </button>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {units.slice(0, 30).map((u) => (
                <div key={u.id} className="py-2 flex items-center justify-between text-xs">
                  <span>
                    <strong className="font-mono">{u.symbol}</strong> — {u.nameEn} ({u.dimension})
                  </span>
                  <span className="font-mono-tabular text-slate-500">×{u.toBaseFactor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && <AdminUserDirectoryPanel />}
      {tab === 'suggestions' && <AdminSuggestionsPanel />}
      {tab === 'designer' && <AdminDesignerInfoPanel />}

      {tab === 'templates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleSaveTemplate}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  {editingTplId ? 'Edit Admin Report Template' : 'Publish Admin Report Template'}
                </h2>
                {editingTplId && (
                  <button
                    type="button"
                    onClick={() => setEditingTplId(null)}
                    className="text-xs text-slate-500 hover:underline cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                value={tplNameEn}
                onChange={(e) => setTplNameEn(e.target.value)}
                placeholder="Template Name (EN)"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <input
                type="text"
                value={tplNameBn}
                onChange={(e) => setTplNameBn(e.target.value)}
                placeholder="Template Name (BN)"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={tplCategory}
                  onChange={(e) => setTplCategory(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                >
                  <option value="engineering">Engineering</option>
                  <option value="electrical">Electrical</option>
                  <option value="mechanical">Mechanical</option>
                  <option value="civil">Civil &amp; BOQ</option>
                  <option value="audit">Inspection / Audit</option>
                </select>
                <select
                  value={tplOrient}
                  onChange={(e) => setTplOrient(e.target.value as 'portrait' | 'landscape')}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                >
                  <option value="portrait">A4 Portrait</option>
                  <option value="landscape">A4 Landscape</option>
                </select>
                <input
                  type="color"
                  value={tplAccent}
                  onChange={(e) => setTplAccent(e.target.value)}
                  className="w-full h-8 rounded border border-slate-200 dark:border-slate-700"
                />
              </div>
              <input
                type="text"
                value={tplDescEn}
                onChange={(e) => setTplDescEn(e.target.value)}
                placeholder="Short description"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <input
                type="text"
                value={tplHeader}
                onChange={(e) => setTplHeader(e.target.value)}
                placeholder="Header Text"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <input
                type="text"
                value={tplFooter}
                onChange={(e) => setTplFooter(e.target.value)}
                placeholder="Footer Text"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={tplSig} onChange={(e) => setTplSig(e.target.checked)} />
                  <span>Include Signature</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={tplChart} onChange={(e) => setTplChart(e.target.checked)} />
                  <span>Include Chart</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={tplRecommended} onChange={(e) => setTplRecommended(e.target.checked)} />
                  <span>Mark Recommended</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={tplLocked} onChange={(e) => setTplLocked(e.target.checked)} />
                  <span>Protected (Users Duplicate Copy)</span>
                </label>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingTplId ? 'Update Admin Template' : 'Publish Template'}</span>
              </button>
            </form>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h2 className="text-sm font-semibold">Official Report Templates ({reportTemplates.length})</h2>
              <p className="text-[11px] text-slate-500">
                Editing or deleting global templates does not overwrite users&apos; saved personal templates.
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                {reportTemplates.map((tpl) => (
                  <div key={tpl.id} className="py-2.5 text-xs space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{tpl.nameEn}</p>
                        <p className="text-[11px] text-slate-500">
                          {tpl.category || 'engineering'} · {tpl.orientation} · {tpl.recommended ? '★ Recommended · ' : ''}
                          {tpl.lockedByAdmin ? 'Locked' : 'Standard'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleLoadTplForEdit(tpl)}
                          className="text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePatchTemplateFlag(tpl, { recommended: !tpl.recommended })}
                          className="text-amber-600 hover:underline cursor-pointer"
                        >
                          {tpl.recommended ? 'Unstar' : 'Recommend'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePatchTemplateFlag(tpl, { enabled: !tpl.enabled })}
                          className="text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                        >
                          {tpl.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAdminTemplate(tpl.id)}
                          className="text-red-600 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Global Report Designer Policy & Branding Settings */}
          <form
            onSubmit={handleSaveGlobalReportPolicy}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold">Global Report Designer Policies &amp; Default Branding</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Default Company Name</label>
                <input
                  type="text"
                  value={reportCfgDraft.defaultCompanyName || ''}
                  onChange={(e) => setReportCfgDraft({ ...reportCfgDraft, defaultCompanyName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Default Header Banner Text</label>
                <input
                  type="text"
                  value={reportCfgDraft.defaultHeaderText || ''}
                  onChange={(e) => setReportCfgDraft({ ...reportCfgDraft, defaultHeaderText: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Default Footer Disclaimer</label>
                <input
                  type="text"
                  value={reportCfgDraft.defaultFooterText || ''}
                  onChange={(e) => setReportCfgDraft({ ...reportCfgDraft, defaultFooterText: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Default Margin (mm)</label>
                <input
                  type="number"
                  min={5}
                  max={35}
                  value={reportCfgDraft.defaultMarginMm ?? 12}
                  onChange={(e) =>
                    setReportCfgDraft({ ...reportCfgDraft, defaultMarginMm: Number(e.target.value) || 12 })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Default Accent Color</label>
                <input
                  type="color"
                  value={reportCfgDraft.defaultAccentColor || '#1d4ed8'}
                  onChange={(e) => setReportCfgDraft({ ...reportCfgDraft, defaultAccentColor: e.target.value })}
                  className="w-full h-8 rounded border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-5 text-xs pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportCfgDraft.allowUserCustomTemplates}
                  onChange={(e) =>
                    setReportCfgDraft({ ...reportCfgDraft, allowUserCustomTemplates: e.target.checked })
                  }
                />
                <span>Allow User Custom Templates</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportCfgDraft.allowCustomPageSizes}
                  onChange={(e) =>
                    setReportCfgDraft({ ...reportCfgDraft, allowCustomPageSizes: e.target.checked })
                  }
                />
                <span>Allow Custom Page Sizes (mm)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportCfgDraft.allowEmailDispatch}
                  onChange={(e) =>
                    setReportCfgDraft({ ...reportCfgDraft, allowEmailDispatch: e.target.checked })
                  }
                />
                <span>Allow Email Report Dispatch</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportCfgDraft.allowExcelExport}
                  onChange={(e) =>
                    setReportCfgDraft({ ...reportCfgDraft, allowExcelExport: e.target.checked })
                  }
                />
                <span>Allow Excel (.xlsx) Export</span>
              </label>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-medium">Disable Specific Designer Elements for Standard Users (Optional)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 text-[11px]">
                {REPORT_ELEMENT_CATALOG.map((el) => {
                  const isDisabled = (reportCfgDraft.disabledElementTypes || []).includes(el.type);
                  return (
                    <label key={el.type} className="inline-flex items-center gap-1.5 cursor-pointer truncate">
                      <input
                        type="checkbox"
                        checked={isDisabled}
                        onChange={() => handleToggleDisabledElement(el.type)}
                      />
                      <span className={isDisabled ? 'line-through text-red-600' : ''}>{el.labelEn}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 text-xs font-medium cursor-pointer"
            >
              Save Report Designer Policies
            </button>
          </form>
        </div>
      )}

      {tab === 'ai-pdf' && (
        <div className="space-y-6">
          {/* Telemetry Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'PDFs Analyzed (Total)', val: aiUsageTotals.analyses },
              { label: 'AI Questions Answered', val: aiUsageTotals.questions },
              { label: 'Document Comparisons', val: aiUsageTotals.comparisons },
              { label: 'Daily Usage Records', val: allAiUsage.length },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <p className="text-xs text-slate-500">{m.label}</p>
                <p className="mt-1 text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white">
                  {m.val}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleSaveAiPdfConfig}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">AI Smart Information Analyzer Policy &amp; Limits</h2>
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.enabled ?? true}
                    onChange={(e) => updateAiPdfField('enabled', e.target.checked)}
                  />
                  <span>Module Enabled</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Max File Size (MB)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={settingsDraft.aiPdfConfig?.maxFileSizeMb ?? 25}
                    onChange={(e) =>
                      updateAiPdfField('maxFileSizeMb', Math.max(1, Math.min(100, Number(e.target.value) || 25)))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Max Pages / File</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={settingsDraft.aiPdfConfig?.maxPagesPerFile ?? 50}
                    onChange={(e) =>
                      updateAiPdfField('maxPagesPerFile', Math.max(1, Math.min(200, Number(e.target.value) || 50)))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Daily User Limit</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={settingsDraft.aiPdfConfig?.dailyUserAnalysisLimit ?? 25}
                    onChange={(e) =>
                      updateAiPdfField(
                        'dailyUserAnalysisLimit',
                        Math.max(1, Math.min(500, Number(e.target.value) || 25))
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-semibold">Active AI Provider (Server Env)</label>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {(['gemini', 'openai', 'anthropic'] as const).map((prov) => {
                      const ready = analyzerStatus?.providers?.[prov];
                      return (
                        <span
                          key={prov}
                          className={`px-2 py-0.5 rounded font-medium border ${
                            ready
                              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500'
                          }`}
                        >
                          {prov === 'gemini' ? 'Gemini' : prov === 'openai' ? 'OpenAI' : 'Anthropic'}:{' '}
                          {analyzerStatus === null ? 'Checking...' : ready ? 'Configured' : 'Not set in server env'}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <select
                  value={settingsDraft.aiPdfConfig?.aiProvider || 'gemini'}
                  onChange={(e) =>
                    updateAiPdfField('aiProvider', e.target.value as AiPdfConfig['aiProvider'])
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                >
                  <option value="gemini">Google Gemini (Server GEMINI_API_KEY)</option>
                  <option value="openai">OpenAI GPT-4o Mini (Server OPENAI_API_KEY)</option>
                  <option value="anthropic">Anthropic Claude Sonnet (Server ANTHROPIC_API_KEY)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Preferred Gemini Model</label>
                  <select
                    value={settingsDraft.aiPdfConfig?.preferredModel || 'gemini-4-hydrogen'}
                    onChange={(e) =>
                      updateAiPdfField(
                        'preferredModel',
                        e.target.value as AiPdfConfig['preferredModel']
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  >
                    <option value="gemini-4-hydrogen">gemini-4-hydrogen (Balanced Reasoning)</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (High Speed)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Reasoning Effort (Gemini 4)</label>
                  <select
                    value={settingsDraft.aiPdfConfig?.reasoningLevel || 'MEDIUM'}
                    onChange={(e) =>
                      updateAiPdfField('reasoningLevel', e.target.value as AiPdfConfig['reasoningLevel'])
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  >
                    <option value="LOW">LOW (Fastest)</option>
                    <option value="MEDIUM">MEDIUM (Recommended)</option>
                    <option value="HIGH">HIGH (Deep Technical Audit)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.allowOcrAndVision ?? true}
                    onChange={(e) => updateAiPdfField('allowOcrAndVision', e.target.checked)}
                  />
                  <span>Vision OCR &amp; Engineering Drawings</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.allowDocComparison ?? true}
                    onChange={(e) => updateAiPdfField('allowDocComparison', e.target.checked)}
                  />
                  <span>Multi-Document Comparison</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.allowWebsiteUrls ?? true}
                    onChange={(e) => updateAiPdfField('allowWebsiteUrls', e.target.checked)}
                  />
                  <span>Website URL Reader</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.allowMultiUrlAnalysis ?? true}
                    onChange={(e) => updateAiPdfField('allowMultiUrlAnalysis', e.target.checked)}
                  />
                  <span>Multiple URLs Comparison</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.allowDocumentUpload ?? true}
                    onChange={(e) => updateAiPdfField('allowDocumentUpload', e.target.checked)}
                  />
                  <span>DOCX/XLSX/CSV/TXT Upload</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.allowImageInput ?? true}
                    onChange={(e) => updateAiPdfField('allowImageInput', e.target.checked)}
                  />
                  <span>Image Upload &amp; Vision OCR</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.allowResearchMode ?? true}
                    onChange={(e) => updateAiPdfField('allowResearchMode', e.target.checked)}
                  />
                  <span>AI Research Synthesis Mode</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.enableEngineeringMode ?? true}
                    onChange={(e) => updateAiPdfField('enableEngineeringMode', e.target.checked)}
                  />
                  <span>Engineering Focus Mode</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.allowCalculatorBridge ?? true}
                    onChange={(e) => updateAiPdfField('allowCalculatorBridge', e.target.checked)}
                  />
                  <span>AI-to-Calculator Integration</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.allowSharing ?? true}
                    onChange={(e) => updateAiPdfField('allowSharing', e.target.checked)}
                  />
                  <span>Opt-in Document Link Sharing</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiPdfConfig?.stripPiiBeforeAi ?? true}
                    onChange={(e) => updateAiPdfField('stripPiiBeforeAi', e.target.checked)}
                  />
                  <span>Redact Personal Emails / Phone Numbers Before AI Processing</span>
                </label>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium">Allowed User Roles</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {(['user', 'engineer', 'admin'] as UserRole[]).map((roleItem) => (
                    <label key={roleItem} className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(settingsDraft.aiPdfConfig?.allowedRoles || ['user', 'engineer', 'admin']).includes(roleItem)}
                        onChange={() => toggleAiPdfArrayItem('allowedRoles', roleItem)}
                      />
                      <span className="capitalize">{roleItem}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium">Allowed Document Categories</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {['general', 'electrical', 'mechanical', 'civil', 'manual', 'invoice_boq', 'drawing', 'report'].map(
                    (catId) => (
                      <label key={catId} className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(
                            settingsDraft.aiPdfConfig?.allowedCategories ||
                            DEFAULT_APP_SETTINGS.aiPdfConfig!.allowedCategories
                          ).includes(catId)}
                          onChange={() => toggleAiPdfArrayItem('allowedCategories', catId)}
                        />
                        <span>{catId}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="rounded-lg bg-blue-700 hover:bg-blue-800 px-4 py-2 text-xs font-medium text-white cursor-pointer"
              >
                Save AI PDF Configuration
              </button>
            </form>

            {/* AI Usage Telemetry Breakdown */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">User AI Usage & Quota Telemetry</h2>
                <span className="text-[11px] text-slate-500">Privacy-safe counters only</span>
              </div>
              <p className="text-xs text-slate-500">
                Administrators can audit daily document analyses, Q&amp;A counts, and comparison counts without viewing private user PDF files.
              </p>
              {allAiUsage.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No AI usage counters recorded yet.</p>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">User</th>
                        <th className="py-2 pr-3">Analyses</th>
                        <th className="py-2 pr-3">Questions</th>
                        <th className="py-2">Comparisons</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {[...allAiUsage]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .slice(0, 50)
                        .map((row) => {
                          const uInfo = userLookup.get(row.userId);
                          return (
                            <tr key={row.id}>
                              <td className="py-2 pr-3 font-mono-tabular whitespace-nowrap">{row.date}</td>
                              <td className="py-2 pr-3">
                                <p className="font-medium text-slate-800 dark:text-slate-200">
                                  {uInfo?.name || row.userId.slice(0, 12)}
                                </p>
                                {uInfo?.email && <p className="text-[11px] text-slate-500">{uInfo.email}</p>}
                              </td>
                              <td className="py-2 pr-3 font-mono-tabular">{row.analysisCount}</td>
                              <td className="py-2 pr-3 font-mono-tabular">{row.questionCount}</td>
                              <td className="py-2 font-mono-tabular">{row.comparisonCount}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 max-w-xl space-y-3">
          <h2 className="text-sm font-semibold">Global Notification Broadcast</h2>
          <input
            type="text"
            value={bcastTitle}
            onChange={(e) => setBcastTitle(e.target.value)}
            placeholder="Notification Title"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          />
          <textarea
            rows={3}
            value={bcastBody}
            onChange={(e) => setBcastBody(e.target.value)}
            placeholder="Message body for all users..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs"
          />
          <button
            type="button"
            onClick={async () => {
              if (!bcastTitle.trim()) return;
              await sendAdminBroadcast(bcastTitle.trim(), bcastBody.trim());
              setBcastTitle('');
              setBcastBody('');
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Broadcast</span>
          </button>
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleSaveSettings}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <h2 className="text-sm font-semibold">Application, Calendar &amp; Module Controls</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Announcement Banner</label>
                  <input
                    type="text"
                    value={settingsDraft.announcementBanner || ''}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, announcementBanner: e.target.value })}
                    placeholder="Optional global announcement shown on Dashboard"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Hijri Moon-Sighting Offset (Days)</label>
                    <input
                      type="number"
                      min={-2}
                      max={2}
                      value={settingsDraft.hijriOffsetDays ?? 0}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, hijriOffsetDays: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Bangla Calendar Variant</label>
                    <select
                      value={settingsDraft.banglaCalendarVariant || 'revised'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          banglaCalendarVariant: e.target.value as 'revised' | 'traditional',
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                    >
                      <option value="revised">Revised (Bangla Academy)</option>
                      <option value="traditional">Traditional (Surya Siddhanta)</option>
                    </select>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={settingsDraft.maintenanceMode}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, maintenanceMode: e.target.checked })}
                  />
                  <span>Maintenance Mode Banner</span>
                </label>

                {/* Translate Policy */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">AI &amp; Neural Translation Settings</span>
                    <span className="text-emerald-600 font-medium">
                      {translateApiOk === null
                        ? 'Checking...'
                        : translateApiOk
                          ? 'Translation Engine Active'
                          : 'Free-tier Gemini Fallback Active'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="inline-flex items-center gap-1.5 pt-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.translateConfig?.enabled ?? true}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            translateConfig: { ...p.translateConfig!, enabled: e.target.checked },
                          }))
                        }
                      />
                      <span>Enabled</span>
                    </label>
                    <div>
                      <label className="block text-[11px] mb-1">Daily Char Limit</label>
                      <input
                        type="number"
                        value={settingsDraft.translateConfig?.dailyCharLimit ?? 50000}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            translateConfig: { ...p.translateConfig!, dailyCharLimit: Number(e.target.value) || 50000 },
                          }))
                        }
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] mb-1">Monthly Char Limit</label>
                      <input
                        type="number"
                        value={settingsDraft.translateConfig?.monthlyCharLimit ?? 500000}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            translateConfig: { ...p.translateConfig!, monthlyCharLimit: Number(e.target.value) || 500000 },
                          }))
                        }
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Dictionary & Calculator Policies */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <span className="font-semibold block">Smart Dictionary &amp; Calculator Settings</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.dictionaryConfig?.enabled ?? true}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            dictionaryConfig: { ...p.dictionaryConfig!, enabled: e.target.checked },
                          }))
                        }
                      />
                      <span>Dictionary Enabled</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.dictionaryConfig?.allowAiExplanations ?? true}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            dictionaryConfig: { ...p.dictionaryConfig!, allowAiExplanations: e.target.checked },
                          }))
                        }
                      />
                      <span>Gemini Explanations</span>
                    </label>
                    <select
                      value={settingsDraft.dictionaryConfig?.defaultDomain || 'general'}
                      onChange={(e) =>
                        setSettingsDraft((p) => ({
                          ...p,
                          dictionaryConfig: { ...p.dictionaryConfig!, defaultDomain: e.target.value as DictionaryDomain },
                        }))
                      }
                      className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1"
                    >
                      <option value="general">Default: General</option>
                      <option value="engineering">Default: Engineering</option>
                      <option value="scientific">Default: Scientific</option>
                      <option value="electrical">Default: Electrical</option>
                    </select>

                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.calculatorConfig?.normalEnabled ?? true}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            calculatorConfig: { ...p.calculatorConfig!, normalEnabled: e.target.checked },
                          }))
                        }
                      />
                      <span>Normal Calc</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.calculatorConfig?.scientificEnabled ?? true}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            calculatorConfig: { ...p.calculatorConfig!, scientificEnabled: e.target.checked },
                          }))
                        }
                      />
                      <span>Scientific Calc</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.calculatorConfig?.allowCloudHistory ?? true}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            calculatorConfig: { ...p.calculatorConfig!, allowCloudHistory: e.target.checked },
                          }))
                        }
                      />
                      <span>Cloud Calc History</span>
                    </label>
                  </div>
                </div>

                {/* Cloud Storage (R2) & Profile Field Policies */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold block">Cloud Storage (R2) Quotas &amp; Profile Policies</span>
                    <span className="text-[11px] font-medium text-emerald-600">
                      {analyzerStatus === null
                        ? 'Checking...'
                        : analyzerStatus.r2Configured
                          ? 'Cloudflare R2 Active'
                          : 'Local Storage Fallback (Dev)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] mb-1">Max File (MB)</label>
                      <input
                        type="number"
                        value={settingsDraft.storageConfig?.maxFileSizeMb ?? 25}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            storageConfig: { ...p.storageConfig!, maxFileSizeMb: Number(e.target.value) || 25 },
                          }))
                        }
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] mb-1">Free Quota (MB)</label>
                      <input
                        type="number"
                        value={settingsDraft.storageConfig?.freeUserQuotaMb ?? 100}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            storageConfig: { ...p.storageConfig!, freeUserQuotaMb: Number(e.target.value) || 100 },
                          }))
                        }
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] mb-1">Premium Quota (MB)</label>
                      <input
                        type="number"
                        value={settingsDraft.storageConfig?.premiumUserQuotaMb ?? 1024}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            storageConfig: { ...p.storageConfig!, premiumUserQuotaMb: Number(e.target.value) || 1024 },
                          }))
                        }
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                      />
                    </div>
                    <label className="inline-flex items-center gap-1.5 pt-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.storageConfig?.pdfUploadEnabled ?? true}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            storageConfig: { ...p.storageConfig!, pdfUploadEnabled: e.target.checked },
                          }))
                        }
                      />
                      <span>PDF Upload On</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.profileConfig?.allowMobileField ?? true}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            profileConfig: { ...p.profileConfig!, allowMobileField: e.target.checked },
                          }))
                        }
                      />
                      <span>Profile Mobile Field</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.profileConfig?.allowEducationFields ?? true}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            profileConfig: { ...p.profileConfig!, allowEducationFields: e.target.checked },
                          }))
                        }
                      />
                      <span>Education Fields</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.profileConfig?.allowProfessionalFields ?? true}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            profileConfig: { ...p.profileConfig!, allowProfessionalFields: e.target.checked },
                          }))
                        }
                      />
                      <span>Professional Fields</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.profileConfig?.allowAccountDeletionRequest ?? true}
                        onChange={(e) =>
                          setSettingsDraft((p) => ({
                            ...p,
                            profileConfig: { ...p.profileConfig!, allowAccountDeletionRequest: e.target.checked },
                          }))
                        }
                      />
                      <span>Account Deletion Request</span>
                    </label>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white cursor-pointer"
              >
                Save Global &amp; Module Settings
              </button>
            </form>

            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <h2 className="text-sm font-semibold">Database Backup &amp; Export</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Download a full JSON snapshot of categories, dynamic calculators, engineering units, report templates, user profiles, and audit logs directly from Cloud Firestore.
                </p>
                <button
                  type="button"
                  onClick={handleDatabaseBackup}
                  disabled={backingUp}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-blue-700 px-4 py-2 text-xs font-medium text-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{backingUp ? 'Exporting...' : 'Download Full Firestore Backup (.json)'}</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <h2 className="text-sm font-semibold">Translate &amp; Dictionary API Usage / Error Logs ({apiUsageLogs.length})</h2>
                {apiUsageLogs.length === 0 ? (
                  <p className="text-xs text-slate-500">No Translate/Dictionary API events recorded yet.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {apiUsageLogs.slice(0, 30).map((log) => (
                      <div key={log.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono font-semibold uppercase text-blue-700 dark:text-blue-400">{log.service}</span>
                          <span className={`ml-2 font-mono text-[11px] ${log.status === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                            [{log.status}]
                          </span>
                          <p className="text-[11px] text-slate-500 truncate">{log.detail}</p>
                        </div>
                        <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">{log.charsCount} ch</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
