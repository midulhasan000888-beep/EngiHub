import React, { useState } from 'react';
import { CheckCircle2, Download, Laptop, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../../hooks/usePWAInstall';
import { Language } from '../../types';
import { t } from '../../i18n/translations';

interface PWAInstallButtonProps {
  language: Language;
  variant?: 'header' | 'sidebar' | 'home';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  language,
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isMobile, isInIframe, install } =
    usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Hide once running as an installed standalone app
  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') return;
    }
    setShowGuide(true);
  };

  const buttonLabel = isMobile
    ? language === 'bn'
      ? 'ইনস্টল অ্যাপ'
      : 'Install App'
    : language === 'bn'
      ? 'অ্যাপ ডাউনলোড'
      : 'Download App';

  const buttonClass =
    variant === 'header'
      ? 'inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 px-2.5 sm:px-3 py-1.5 min-h-[36px] text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
      : variant === 'sidebar'
        ? 'w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2.5 min-h-[40px] text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer'
        : 'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 min-h-[42px] text-xs sm:text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer';

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        aria-label={buttonLabel}
        className={buttonClass}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={variant === 'header' ? 'hidden sm:inline' : ''}>{buttonLabel}</span>
        {variant === 'header' && (
          <span className="sm:hidden">{language === 'bn' ? 'অ্যাপ' : 'App'}</span>
        )}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 no-print"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {language === 'bn'
                    ? 'EngiHub অ্যাপ ডাউনলোড ও ইনস্টল'
                    : 'Download & Install EngiHub App'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === 'bn'
                    ? 'মোবাইল ও কম্পিউটারে সরাসরি অ্যাপ হিসেবে ব্যবহার করুন'
                    : 'Run EngiHub natively from your Home Screen or Desktop'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInstallable ? (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 p-4 space-y-3">
                <p className="text-xs text-slate-700 dark:text-slate-200">
                  {language === 'bn'
                    ? 'আপনার ডিভাইস সরাসরি ইনস্টলেশনের জন্য প্রস্তুত। নিচের বাটনে চাপ দিয়ে EngiHub ইনস্টল করুন।'
                    : 'Your browser supports one-tap installation for EngiHub.'}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await install();
                    if (res === 'accepted') setShowGuide(false);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{language === 'bn' ? 'এখনই EngiHub ইনস্টল করুন' : 'Install EngiHub Now'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                {isInIframe && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-amber-900 dark:text-amber-200 leading-relaxed">
                    {language === 'bn'
                      ? 'আপনি বর্তমানে এমবেডেড প্রিভিউ ফ্রেমে দেখছেন। সরাসরি এক-ট্যাপে ইনস্টল করতে অ্যাপটি ব্রাউজারের নতুন ট্যাবে (Standalone URL) খুলুন।'
                      : 'You are currently viewing inside an embedded frame. Open the app URL directly in Chrome, Edge, or Safari to enable one-tap installation.'}
                  </div>
                )}

                {isIOS ? (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2">
                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <span>{language === 'bn' ? 'iPhone / iPad (Safari)' : 'iPhone / iPad (Safari)'}</span>
                    </p>
                    <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                      <li>
                        {language === 'bn'
                          ? 'Safari ব্রাউজারের নিচে বা উপরে Share আইকনে ট্যাপ করুন।'
                          : 'Tap the Share button in the Safari toolbar.'}
                      </li>
                      <li>
                        {language === 'bn'
                          ? 'নিচে স্ক্রল করে "Add to Home Screen" নির্বাচন করুন।'
                          : 'Scroll down and tap "Add to Home Screen".'}
                      </li>
                      <li>
                        {language === 'bn'
                          ? '"Add" চাপুন — EngiHub হোম স্ক্রিনে যুক্ত হবে।'
                          : 'Tap "Add" to place EngiHub on your Home Screen.'}
                      </li>
                    </ol>
                  </div>
                ) : (
                  <>
                    <div
                      className={`rounded-lg border p-3.5 space-y-2 ${
                        isAndroid
                          ? 'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
                      }`}
                    >
                      <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-blue-600" />
                        <span>
                          {language === 'bn'
                            ? 'Android মোবাইল (Chrome / Edge)'
                            : 'Android Mobile (Chrome / Edge)'}
                        </span>
                      </p>
                      <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                        <li>
                          {language === 'bn'
                            ? 'ব্রাউজারের উপরে ডানে মেনু (⋮) আইকনে ট্যাপ করুন।'
                            : 'Tap the browser menu (⋮) in the top-right corner.'}
                        </li>
                        <li>
                          {language === 'bn'
                            ? '"Install app" অথবা "Add to Home screen" অপশন নির্বাচন করুন।'
                            : 'Select "Install app" or "Add to Home screen".'}
                        </li>
                        <li>
                          {language === 'bn'
                            ? '"Install" নিশ্চিত করলে EngiHub মোবাইলে অ্যাপ হিসেবে ইনস্টল হবে।'
                            : 'Confirm "Install" to add EngiHub to your phone app drawer.'}
                        </li>
                      </ol>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 space-y-2">
                      <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Laptop className="w-4 h-4 text-blue-600" />
                        <span>
                          {language === 'bn'
                            ? 'কম্পিউটার / ডেস্কটপ (Chrome / Edge)'
                            : 'Desktop Browser (Chrome / Edge)'}
                        </span>
                      </p>
                      <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                        <li>
                          {language === 'bn'
                            ? 'অ্যাড্রেস বারের ডানদিকে থাকা Install আইকনে ক্লিক করুন।'
                            : 'Click the Install icon on the right side of the address bar.'}
                        </li>
                        <li>
                          {language === 'bn'
                            ? 'অথবা মেনু (⋮) → "Save and share" → "Install EngiHub" নির্বাচন করুন।'
                            : 'Or open Menu (⋮) → "Save and share" → "Install EngiHub".'}
                        </li>
                      </ol>
                    </div>
                  </>
                )}

                <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    {language === 'bn'
                      ? 'ডেস্কটপ ও মোবাইলে আপনার একই অ্যাকাউন্ট এবং সংরক্ষিত ডেটা সিঙ্ক থাকবে।'
                      : 'Your account, calculations, PDFs, and reports stay synced across desktop and mobile.'}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const HomeDownloadAppBanner: React.FC<{ language: Language }> = ({ language }) => {
  const { isInstalled, isMobile } = usePWAInstall();

  // Hide once installed
  if (isInstalled) return null;

  return (
    <section
      aria-label="Download EngiHub App"
      className="rounded-xl border border-blue-200 dark:border-blue-900/70 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
          {isMobile ? <Smartphone className="w-5 h-5" /> : <Download className="w-5 h-5" />}
        </div>
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {language === 'bn'
              ? 'EngiHub মোবাইল ও ডেস্কটপ অ্যাপ ডাউনলোড করুন'
              : 'Download EngiHub App for Mobile & Desktop'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {language === 'bn'
              ? 'Android ফোন ও ব্রাউজারে অ্যাপ হিসেবে ইনস্টল করুন — দ্রুত লোডিং, অফলাইন সুবিধা এবং একই অ্যাকাউন্ট সিঙ্ক।'
              : 'Install EngiHub directly to your Android home screen or desktop for fast launch, offline access, and synced data.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <PWAInstallButton language={language} variant="home" />
      </div>
    </section>
  );
};

export const OfflineIndicator: React.FC<{ language: Language }> = ({ language }) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-18 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-600 px-3 py-2 text-xs font-medium text-white shadow-lg no-print">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>{t(language, 'offlineBanner')}</span>
    </div>
  );
};
