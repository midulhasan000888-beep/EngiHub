import React from 'react';
import { CalendarDays, FileSpreadsheet, LayoutDashboard, Menu, Sigma } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MobileNav: React.FC<{ onOpenMenu: () => void }> = ({ onOpenMenu }) => {
  const { activeSection, language, navigateTo } = useApp();

  const items = [
    {
      id: 'dashboard' as const,
      label: language === 'bn' ? 'হোম' : 'Home',
      icon: LayoutDashboard,
      isActive: activeSection === 'dashboard',
      onClick: () => navigateTo('dashboard'),
    },
    {
      id: 'category' as const,
      label: language === 'bn' ? 'সূত্র' : 'Tools',
      icon: Sigma,
      isActive:
        activeSection === 'category' ||
        activeSection === 'normal-calculator' ||
        activeSection === 'math-suite' ||
        activeSection === 'unit-converter',
      onClick: () => navigateTo('category', 'electrical'),
    },
    {
      id: 'reports' as const,
      label: language === 'bn' ? 'রিপোর্ট' : 'Reports',
      icon: FileSpreadsheet,
      isActive: activeSection === 'reports',
      onClick: () => navigateTo('reports'),
    },
    {
      id: 'calendar' as const,
      label: language === 'bn' ? 'ক্যালেন্ডার' : 'Calendar',
      icon: CalendarDays,
      isActive: activeSection === 'calendar',
      onClick: () => navigateTo('calendar'),
    },
  ];

  return (
    <nav
      aria-label={language === 'bn' ? 'মোবাইল নেভিগেশন' : 'Mobile navigation'}
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 min-h-[58px] pb-[env(safe-area-inset-bottom)] border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm grid grid-cols-5 no-print"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[54px] text-[11px] font-medium cursor-pointer transition-colors ${
              item.isActive
                ? 'text-brand-primary'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-[64px]">{item.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[54px] text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
      >
        <Menu className="w-4 h-4 shrink-0" />
        <span>{language === 'bn' ? 'মেনু' : 'More'}</span>
      </button>
    </nav>
  );
};
