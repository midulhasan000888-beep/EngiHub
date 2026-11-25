import React from 'react';
import { LogIn, LogOut, Menu } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface TopBarProps {
  onOpenMobileMenu: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobileMenu }) => {
  const { user, isAdmin, language, activeSection, navigateTo, signInWithGoogle, signOut } = useApp();

  const navItems: Array<{ id: 'dashboard' | 'category' | 'reports' | 'calendar' | 'admin'; label: string }> = [
    { id: 'dashboard', label: t(language, 'dashboard') },
    { id: 'category', label: language === 'bn' ? 'ক্যালকুলেটর' : 'Calculators' },
    { id: 'reports', label: language === 'bn' ? 'রিপোর্ট' : 'Reports' },
    { id: 'calendar', label: language === 'bn' ? 'ক্যালেন্ডার' : 'Calendar' },
  ];
  if (isAdmin) {
    navItems.push({ id: 'admin', label: t(language, 'adminPanel') });
  }

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-6 no-print">
      {/* Zone 1: Single-line Brand Wordmark */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => navigateTo('dashboard')}
          className="text-sm sm:text-base font-bold tracking-tight text-brand-primary whitespace-nowrap shrink-0 cursor-pointer"
        >
          {language === 'bn' ? 'EngiHub · সূত্রসাথী' : 'EngiHub · SUTRO SATHI'}
        </button>
      </div>

      {/* Zone 2: Clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
        {navItems.map((item) => {
          const isActive =
            activeSection === item.id ||
            (item.id === 'category' && (activeSection === 'math-suite' || activeSection === 'unit-converter'));
          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                item.id === 'category'
                  ? navigateTo('category', 'electrical')
                  : navigateTo(item.id)
              }
              className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
                isActive
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Download App + Auth Action */}
      <div className="flex items-center gap-2 shrink-0">
        <PWAInstallButton language={language} variant="header" />
        {user ? (
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 min-h-[36px] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">{t(language, 'signOut')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 sm:px-4 py-1.5 min-h-[36px] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{t(language, 'signIn')}</span>
          </button>
        )}
      </div>
    </header>
  );
};
