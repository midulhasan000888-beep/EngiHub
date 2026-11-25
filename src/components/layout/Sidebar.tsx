import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  BookOpen,
  BookmarkCheck,
  Building2,
  Calculator,
  CalendarDays,
  Cog,
  Cpu,
  Factory,
  FileScan,
  FileSpreadsheet,
  Globe,
  HardHat,
  History,
  Info,
  Languages,
  LayoutDashboard,
  MapPin,
  MessageSquarePlus,
  Moon,
  NotebookPen,
  Presentation,
  Ruler,
  ShieldCheck,
  Sigma,
  Sun,
  Table2,
  UserCircle,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { NavSection } from '../../types';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Sigma,
  Ruler,
  Zap,
  Cog,
  Building2,
  Cpu,
  Factory,
  HardHat,
  ArrowLeftRight,
  FileScan,
  FileSpreadsheet,
  CalendarDays,
  NotebookPen,
  MapPin,
  BookmarkCheck,
  History,
  Languages,
  BookOpen,
  MessageSquarePlus,
  Info,
  Table2,
  Presentation,
};

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const {
    user,
    profile,
    isAdmin,
    language,
    theme,
    activeSection,
    activeCategoryId,
    categories,
    notifications,
    appSettings,
    setLanguage,
    setTheme,
    navigateTo,
    markNotificationRead,
  } = useApp();

  const [showNotifs, setShowNotifs] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNav = (section: NavSection, catId?: string) => {
    navigateTo(section, catId);
    onCloseMobile();
  };

  const engineeringCats = categories.filter((c) =>
    [
      'mathematics',
      'measurement',
      'electrical',
      'mechanical',
      'civil',
      'electronics',
      'industrial',
      'construction',
    ].includes(c.id)
  );

  const rawProductivityLinks: Array<{
    section: NavSection;
    labelEn: string;
    labelBn: string;
    icon: React.FC<{ className?: string }>;
    visible?: boolean;
  }> = [
    {
      section: 'normal-calculator',
      labelEn: 'Normal Calculator',
      labelBn: 'সাধারণ ক্যালকুলেটর',
      icon: Calculator,
      visible: appSettings.calculatorConfig?.normalEnabled !== false && appSettings.moduleFlags?.normalCalculatorEnabled !== false,
    },
    {
      section: 'math-suite',
      labelEn: 'Scientific & Math Tools',
      labelBn: 'সায়েন্টিফিক ও গণিত টুলস',
      icon: Sigma,
      visible: appSettings.calculatorConfig?.scientificEnabled !== false && appSettings.moduleFlags?.scientificCalculatorEnabled !== false,
    },
    { section: 'unit-converter', labelEn: 'Unit Converter', labelBn: 'একক রূপান্তর', icon: ArrowLeftRight },
    {
      section: 'translate',
      labelEn: 'Google Translate',
      labelBn: 'গুগল ট্রান্সলেট',
      icon: Languages,
      visible: appSettings.translateConfig?.enabled !== false && appSettings.moduleFlags?.translateEnabled !== false,
    },
    {
      section: 'dictionary',
      labelEn: 'Smart Dictionary',
      labelBn: 'স্মার্ট ডিকশনারি',
      icon: BookOpen,
      visible: appSettings.dictionaryConfig?.enabled !== false && appSettings.moduleFlags?.dictionaryEnabled !== false,
    },
    {
      section: 'excel-studio',
      labelEn: 'Excel Sheet Generator',
      labelBn: 'এক্সেল শিট জেনারেটর',
      icon: Table2,
      visible: appSettings.moduleFlags?.excelEnabled !== false,
    },
    {
      section: 'presentation-maker',
      labelEn: 'Presentation Maker',
      labelBn: 'প্রেজেন্টেশন মেকার',
      icon: Presentation,
      visible: appSettings.moduleFlags?.presentationEnabled !== false,
    },
    { section: 'pdf-analyzer', labelEn: 'AI Smart Info Analyzer', labelBn: 'এআই স্মার্ট ইনফো বিশ্লেষক', icon: FileScan },
    { section: 'reports', labelEn: 'Report Generator', labelBn: 'রিপোর্ট জেনারেটর', icon: FileSpreadsheet },
    { section: 'calendar', labelEn: 'Calendar & Reminders', labelBn: 'ক্যালেন্ডার ও রিমাইন্ডার', icon: CalendarDays },
    { section: 'notepad', labelEn: 'Smart Notepad', labelBn: 'স্মার্ট নোটপ্যাড', icon: NotebookPen },
    { section: 'location', labelEn: 'Location & World Clock', labelBn: 'লোকেশন ও বিশ্ব ঘড়ি', icon: MapPin },
    { section: 'saved', labelEn: 'Saved Calculations', labelBn: 'সংরক্ষিত হিসাব', icon: BookmarkCheck },
    { section: 'history', labelEn: 'Calculation History', labelBn: 'হিসাবের ইতিহাস', icon: History },
    { section: 'profile', labelEn: 'Profile & Settings', labelBn: 'প্রোফাইল ও সেটিংস', icon: UserCircle },
    {
      section: 'suggestions',
      labelEn: 'Suggestion & Feedback',
      labelBn: 'পরামর্শ ও মতামত',
      icon: MessageSquarePlus,
      visible: appSettings.moduleFlags?.suggestionsEnabled !== false,
    },
    { section: 'about-designer', labelEn: 'Designer Info', labelBn: 'ডিজাইনার পরিচিতি', icon: Info },
  ];

  const productivityLinks = rawProductivityLinks.filter((item) => isAdmin || item.visible !== false);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 lg:hidden">
        <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
          {language === 'bn' ? 'EngiHub মেনু' : 'EngiHub Menu'}
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* User Summary */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
            {profile?.displayName || user?.displayName || t(language, 'guestMode')}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {user?.email || (language === 'bn' ? 'সাইন-ইন করুন' : 'Not signed in')}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifs((v) => !v)}
            aria-label={t(language, 'notifications')}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-primary text-[10px] font-semibold text-white flex items-center justify-center tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute left-0 lg:left-auto lg:right-0 mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-50 p-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {t(language, 'notifications')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowNotifs(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 mt-1">
                {notifications.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500 text-center">
                    {t(language, 'noNotifications')}
                  </p>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markNotificationRead(n.id)}
                      className={`w-full text-left py-2 px-1.5 rounded transition-colors ${
                        n.read ? 'opacity-65' : 'bg-blue-50/60 dark:bg-blue-950/30'
                      }`}
                    >
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{n.title}</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">{n.body}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        <div>
          <button
            type="button"
            onClick={() => handleNav('dashboard')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeSection === 'dashboard'
                ? 'bg-brand-soft text-brand-primary'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span className="truncate">{t(language, 'dashboard')}</span>
          </button>
        </div>

        <div>
          <p className="px-3 mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {language === 'bn' ? 'প্রকৌশল ও গণনা' : 'Engineering & Math'}
          </p>
          <div className="space-y-0.5">
            {engineeringCats.map((cat) => {
              const Icon = ICON_MAP[cat.icon || 'Sigma'] || Sigma;
              const isActive = activeSection === 'category' && activeCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleNav('category', cat.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-brand-soft text-brand-primary'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{language === 'bn' ? cat.nameBn : cat.nameEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="px-3 mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {language === 'bn' ? 'টুলস ও প্রোডাক্টিভিটি' : 'Tools & Productivity'}
          </p>
          <div className="space-y-0.5">
            {productivityLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.section;
              return (
                <button
                  key={item.section}
                  type="button"
                  onClick={() => handleNav(item.section)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-brand-soft text-brand-primary'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{language === 'bn' ? item.labelBn : item.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => handleNav('admin')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeSection === 'admin'
                  ? 'bg-brand-primary text-white'
                  : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="truncate">{t(language, 'adminPanel')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Workspace Controls Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'বাংলা' : 'English'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
        <div className="flex justify-center">
          <PWAInstallButton language={language} variant="sidebar" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 no-print">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-black/40" onClick={onCloseMobile} />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
