import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OfflineIndicator } from './components/common/PWAInstallButton';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { CategoryView } from './components/calculators/CategoryView';
import { NormalCalculator } from './components/calculators/NormalCalculator';
import { MathToolsSuite } from './components/calculators/MathToolsSuite';
import { UnitConverterView } from './components/calculators/UnitConverterView';
import { ReportGeneratorView } from './components/reports/ReportGeneratorView';
import { CalendarReminderView } from './components/calendar/CalendarReminderView';
import { SmartNotepadView } from './components/notepad/SmartNotepadView';
import { LocationTimeView } from './components/location/LocationTimeView';
import { HistorySavedView } from './components/history/HistorySavedView';
import { ProfileSettingsView } from './components/profile/ProfileSettingsView';
import { AdminPanel } from './components/admin/AdminPanel';
import { PdfAnalyzerView } from './components/pdf/PdfAnalyzerView';
import { TranslateView } from './components/translate/TranslateView';
import { DictionaryView } from './components/dictionary/DictionaryView';
import { SuggestionFeedbackView } from './components/suggestions/SuggestionFeedbackView';
import { AboutDesignerView } from './components/about/AboutDesignerView';
import { ExcelGeneratorView } from './components/excel/ExcelGeneratorView';
import { PresentationMakerView } from './components/presentations/PresentationMakerView';

const MainShell: React.FC = () => {
  const { activeSection, language, toastMessage, appSettings, designerInfo, navigateTo } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardHome />;
      case 'category':
        return <CategoryView />;
      case 'normal-calculator':
        return <NormalCalculator />;
      case 'math-suite':
        return <MathToolsSuite />;
      case 'unit-converter':
        return <UnitConverterView />;
      case 'translate':
        return <TranslateView />;
      case 'dictionary':
        return <DictionaryView />;
      case 'excel-studio':
        return <ExcelGeneratorView />;
      case 'presentation-maker':
        return <PresentationMakerView />;
      case 'pdf-analyzer':
        return <PdfAnalyzerView />;
      case 'reports':
        return <ReportGeneratorView />;
      case 'calendar':
        return <CalendarReminderView />;
      case 'notepad':
        return <SmartNotepadView />;
      case 'location':
        return <LocationTimeView />;
      case 'history':
        return <HistorySavedView mode="history" />;
      case 'saved':
        return <HistorySavedView mode="saved" />;
      case 'profile':
        return <ProfileSettingsView />;
      case 'suggestions':
        return <SuggestionFeedbackView />;
      case 'about-designer':
        return <AboutDesignerView />;
      case 'admin':
        return <AdminPanel />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="app-shell-root min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <TopBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

      {appSettings.maintenanceMode && (
        <div className="bg-amber-600 text-white text-xs text-center py-1.5 px-4 font-medium no-print">
          {language === 'bn'
            ? 'সিস্টেম রক্ষণাবেক্ষণ মোড চালু রয়েছে — কিছু পরিবর্তন সীমিত হতে পারে।'
            : 'System Maintenance Mode is active — Administrators are updating platform modules.'}
        </div>
      )}

      <div className="app-main-row flex-1 flex">
        <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

        <main className="app-main-content flex-1 min-w-0 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-10 flex flex-col justify-between">
          <div className="max-w-7xl mx-auto w-full">{renderSection()}</div>

          <footer className="max-w-7xl mx-auto w-full mt-10 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 no-print">
            <span>
              {language === 'bn'
                ? 'EngiHub · সূত্রসাথী — সকল হিসাব, সকল সূত্র, এক প্ল্যাটফর্মে।'
                : 'EngiHub · SUTRO SATHI — All calculations, all formulas, one platform.'}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigateTo('suggestions')}
                className="hover:text-blue-700 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                {language === 'bn' ? 'পরামর্শ ও মতামত' : 'Suggestions & Feedback'}
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => navigateTo('about-designer')}
                className="hover:text-blue-700 dark:hover:text-blue-400 transition-colors cursor-pointer font-medium"
              >
                {language === 'bn'
                  ? `ডিজাইনার: ${designerInfo.nameBn}`
                  : `Designed by ${designerInfo.nameEn}`}
              </button>
            </div>
          </footer>
        </main>
      </div>

      <MobileNav onOpenMenu={() => setMobileMenuOpen(true)} />
      <OfflineIndicator language={language} />

      {toastMessage && (
        <div
          role="status"
          className={`fixed bottom-16 lg:bottom-5 right-4 z-50 rounded-lg px-4 py-2.5 text-xs font-medium text-white shadow-lg no-print ${
            toastMessage.type === 'error'
              ? 'bg-red-600'
              : toastMessage.type === 'success'
                ? 'bg-emerald-600'
                : 'bg-slate-900 dark:bg-blue-700'
          }`}
        >
          {toastMessage.text}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
