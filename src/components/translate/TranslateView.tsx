import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  Copy,
  History,
  Languages,
  Loader2,
  Search,
  Star,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiUrl } from '../../engine/apiClient';

type TranslateMode = 'standard' | 'technical' | 'student' | 'paragraph';

interface SupportedLanguage {
  language: string;
  name: string;
}

const FALLBACK_LANG_NAMES: Array<{ language: string; name: string }> = [
  { language: 'bn', name: 'Bengali (বাংলা)' },
  { language: 'en', name: 'English' },
  { language: 'ar', name: 'Arabic (العربية)' },
  { language: 'hi', name: 'Hindi (हिन्दी)' },
  { language: 'ur', name: 'Urdu' },
  { language: 'ja', name: 'Japanese' },
  { language: 'zh-CN', name: 'Chinese (Simplified)' },
  { language: 'de', name: 'German' },
  { language: 'fr', name: 'French' },
  { language: 'es', name: 'Spanish' },
  { language: 'ko', name: 'Korean' },
];

export const TranslateView: React.FC = () => {
  const {
    user,
    isAdmin,
    language,
    appSettings,
    translationHistory,
    favouriteTranslations,
    saveTranslationRecord,
    toggleFavouriteTranslation,
    deleteTranslationRecord,
    clearTranslationHistory,
    logApiUsage,
    showToast,
  } = useApp();

  const cfg = appSettings.translateConfig;
  const moduleEnabled = cfg?.enabled !== false && appSettings.moduleFlags?.translateEnabled !== false;

  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [providerName, setProviderName] = useState('Gemini Neural Translation');
  const [supportedLanguages, setSupportedLanguages] = useState<SupportedLanguage[]>(FALLBACK_LANG_NAMES);
  const [sourceLang, setSourceLang] = useState<string>(cfg?.defaultSourceLang || 'auto');
  const [targetLang, setTargetLang] = useState<string>(cfg?.defaultTargetLang || (language === 'bn' ? 'en' : 'bn'));
  const [mode, setMode] = useState<TranslateMode>('standard');

  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [detectedLang, setDetectedLang] = useState<string>('');
  const [translating, setTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'history' | 'favourites'>('history');
  const [historySearch, setHistorySearch] = useState('');

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const res = await fetch(apiUrl('/api/translate/status'));
        const data = (await res.json()) as { configured?: boolean; provider?: string };
        if (!active) return;
        setApiConfigured(Boolean(data.configured));
        if (data.provider) setProviderName(data.provider);

        if (data.configured) {
          const langRes = await fetch(apiUrl(`/api/translate/languages?target=${language}`));
          const langData = (await langRes.json()) as { languages?: SupportedLanguage[] };
          if (active && Array.isArray(langData.languages) && langData.languages.length > 0) {
            setSupportedLanguages(langData.languages);
          }
        }
      } catch {
        if (active) setApiConfigured(false);
      }
    };
    void checkStatus();
    return () => {
      active = false;
    };
  }, [language]);

  const filteredLanguages = useMemo(() => {
    const allowed = cfg?.allowedLanguages;
    if (!allowed || allowed.length === 0) return supportedLanguages;
    return supportedLanguages.filter((l) => allowed.includes(l.language));
  }, [cfg?.allowedLanguages, supportedLanguages]);

  const usageStats = useMemo(() => {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);
    let todayChars = 0;
    let monthChars = 0;
    for (const item of translationHistory) {
      const ts = item.createdAt as { toDate?: () => Date } | undefined;
      const iso = ts && typeof ts.toDate === 'function' ? ts.toDate().toISOString() : '';
      if (iso.startsWith(todayKey)) todayChars += item.sourceText.length;
      if (iso.startsWith(monthKey)) monthChars += item.sourceText.length;
    }
    return { todayChars, monthChars };
  }, [translationHistory]);

  const dailyLimit = cfg?.dailyCharLimit || 50000;
  const monthlyLimit = cfg?.monthlyCharLimit || 500000;
  const overQuota = !isAdmin && (usageStats.todayChars >= dailyLimit || usageStats.monthChars >= monthlyLimit);

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') {
      const fallbackSrc = detectedLang && detectedLang !== 'unknown' ? detectedLang : targetLang;
      setSourceLang(targetLang);
      setTargetLang(fallbackSrc === targetLang ? (targetLang === 'bn' ? 'en' : 'bn') : fallbackSrc);
    } else {
      const prevSrc = sourceLang;
      setSourceLang(targetLang);
      setTargetLang(prevSrc);
    }
    if (translatedText) {
      setSourceText(translatedText);
      setTranslatedText(sourceText);
    }
  };

  const handleTranslate = async () => {
    const clean = sourceText.trim();
    if (!clean) {
      showToast(language === 'bn' ? 'অনুবাদের জন্য টেক্সট লিখুন' : 'Please enter text to translate', 'info');
      return;
    }
    if (overQuota) {
      showToast(
        language === 'bn' ? 'দৈনিক বা মাসিক অনুবাদ সীমা পূর্ণ হয়েছে' : 'Daily or monthly translation character limit reached',
        'error'
      );
      return;
    }

    setTranslating(true);
    setErrorMsg(null);
    try {
      const resp = await fetch(apiUrl('/api/translate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: clean,
          sourceLang,
          targetLang,
          mode,
        }),
      });
      const data = (await resp.json()) as {
        setupRequired?: boolean;
        error?: string;
        translatedText?: string;
        detectedSourceLanguage?: string;
        provider?: string;
      };

      if (resp.status === 503 && data.setupRequired) {
        setApiConfigured(false);
        setErrorMsg(data.error || 'Translation service is unavailable.');
        void logApiUsage({
          service: 'translate',
          status: 'setup_required',
          charsCount: clean.length,
          detail: 'Translation provider unconfigured',
        });
        return;
      }

      if (!resp.ok || typeof data.translatedText !== 'string') {
        const msg = data.error || 'Translation request failed.';
        setErrorMsg(msg);
        void logApiUsage({
          service: 'translate',
          status: 'error',
          charsCount: clean.length,
          detail: msg.slice(0, 180),
        });
        return;
      }

      setTranslatedText(data.translatedText);
      setDetectedLang(data.detectedSourceLanguage || sourceLang);

      if (user) {
        await saveTranslationRecord({
          sourceLang,
          targetLang,
          detectedLang: data.detectedSourceLanguage,
          sourceText: clean,
          translatedText: data.translatedText,
          mode,
          provider: data.provider || providerName,
        });
      }

      void logApiUsage({
        service: 'translate',
        status: 'success',
        charsCount: clean.length,
        detail: `${sourceLang}->${targetLang} (${mode})`,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error during translation.');
    } finally {
      setTranslating(false);
    }
  };

  const handleSpeak = (text: string, langCode: string) => {
    if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast(language === 'bn' ? 'ব্রাউজার ভয়েস সাপোর্ট করছে না' : 'Speech synthesis unavailable', 'info');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode === 'bn' ? 'bn-BD' : langCode === 'auto' ? 'en-US' : langCode;
    window.speechSynthesis.speak(utter);
  };

  const handleCopy = async () => {
    if (!translatedText) return;
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      showToast(language === 'bn' ? 'অনুবাদ কপি করা হয়েছে' : 'Translation copied', 'success');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast(language === 'bn' ? 'কপি করা যায়নি' : 'Clipboard failed', 'error');
    }
  };

  const isCurrentFavourited = useMemo(
    () =>
      favouriteTranslations.some(
        (f) => f.sourceText === sourceText.trim() && f.translatedText === translatedText && f.targetLang === targetLang
      ),
    [favouriteTranslations, sourceText, targetLang, translatedText]
  );

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return translationHistory.filter(
      (item) =>
        !q ||
        item.sourceText.toLowerCase().includes(q) ||
        item.translatedText.toLowerCase().includes(q)
    );
  }, [historySearch, translationHistory]);

  const filteredFavourites = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return favouriteTranslations.filter(
      (item) =>
        !q ||
        item.sourceText.toLowerCase().includes(q) ||
        item.translatedText.toLowerCase().includes(q)
    );
  }, [favouriteTranslations, historySearch]);

  if (!moduleEnabled) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-6 text-center space-y-2">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
          {language === 'bn' ? 'গুগল ট্রান্সলেট মডিউলটি বর্তমানে বন্ধ রয়েছে' : 'Google Translate module is disabled'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Languages className="w-6 h-6 text-brand-primary shrink-0" />
            <span>{language === 'bn' ? 'স্মার্ট ট্রান্সলেট (Bangla ↔ English & Global)' : 'Smart Bilingual Translation'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {language === 'bn'
              ? `${providerName} দ্বারা পরিচালিত — প্রকৌশল, শিক্ষার্থী ও প্রাতিষ্ঠানিক অনুবাদ।`
              : `Powered by ${providerName} — General, Engineering/Technical, Student & Long Paragraph translation.`}
          </p>
        </div>

        <div className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
          {language === 'bn'
            ? `আজ: ${usageStats.todayChars.toLocaleString()} / ${dailyLimit.toLocaleString()} অক্ষর`
            : `Today: ${usageStats.todayChars.toLocaleString()} / ${dailyLimit.toLocaleString()} chars`}
        </div>
      </div>

      {/* API Configuration Notice (Only if no server translation key is present at all) */}
      {apiConfigured === false && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {language === 'bn' ? 'সার্ভার অনুবাদ সেবা প্রস্তুত নয়' : 'Translation Service Unavailable'}
            </h2>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              {language === 'bn'
                ? 'অনুবাদ চালাতে সার্ভারে GEMINI_API_KEY সক্রিয় থাকতে হবে। কোনো Google Cloud Billing ছাড়াই ফ্রি-টিয়ার AI অনুবাদ কাজ করে।'
                : 'Server translation requires GEMINI_API_KEY in Settings > Secrets. Free-tier AI translation works with zero Google Cloud Billing setup.'}
            </p>
          </div>
        </div>
      )}

      {/* Mode Selector + Translator Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {(
              [
                { id: 'standard', en: 'Standard', bn: 'সাধারণ' },
                { id: 'technical', en: 'Technical & Engineering', bn: 'টেকনিক্যাল ও ইঞ্জিনিয়ারিং' },
                { id: 'student', en: 'Student Study', bn: 'শিক্ষার্থী ও একাডেমিক' },
                { id: 'paragraph', en: 'Long Paragraph', bn: 'দীর্ঘ অনুচ্ছেদ' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                  mode === m.id
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {language === 'bn' ? m.bn : m.en}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              aria-label="Source Language"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-medium"
            >
              <option value="auto">{language === 'bn' ? 'স্বয়ংক্রিয় শনাক্ত (Auto)' : 'Auto-Detect'}</option>
              {filteredLanguages.map((l) => (
                <option key={l.language} value={l.language}>
                  {l.name} ({l.language})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSwapLanguages}
              title={language === 'bn' ? 'ভাষা অদলবদল করুন' : 'Swap Languages'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
            </button>

            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              aria-label="Target Language"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-medium"
            >
              {filteredLanguages.map((l) => (
                <option key={l.language} value={l.language}>
                  {l.name} ({l.language})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Side-by-Side Panes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {language === 'bn' ? 'মূল টেক্সট' : 'Original Text'}
                  {detectedLang && sourceLang === 'auto' ? ` · Detected: ${detectedLang}` : ''}
                </span>
                <span className="font-mono-tabular">{sourceText.length.toLocaleString()} / 20,000</span>
              </div>
              <textarea
                rows={mode === 'paragraph' ? 9 : 6}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={
                  language === 'bn'
                    ? 'বাংলা বা ইংরেজি অথবা যেকোনো ভাষায় টেক্সট লিখুন বা পেস্ট করুন...'
                    : 'Type or paste text in Bangla, English, or any supported language...'
                }
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none resize-y"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSpeak(sourceText, detectedLang || sourceLang)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'শুনুন' : 'Listen'}</span>
                </button>
                {sourceText && (
                  <button
                    type="button"
                    onClick={() => {
                      setSourceText('');
                      setTranslatedText('');
                      setDetectedLang('');
                    }}
                    className="text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                  >
                    {language === 'bn' ? 'মুছুন' : 'Clear'}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleTranslate()}
                disabled={translating || apiConfigured === false || overQuota}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
              >
                {translating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{language === 'bn' ? 'অনুবাদ করুন' : 'Translate'}</span>
              </button>
            </div>
          </div>

          {/* Translated Output Pane */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-4 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{language === 'bn' ? 'অনুদিত ফলাফল' : 'Translated Output'}</span>
                <span className="font-mono">{targetLang.toUpperCase()}</span>
              </div>

              {errorMsg ? (
                <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
                  {errorMsg}
                </div>
              ) : (
                <div className="min-h-[144px] text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                  {translatedText || (
                    <span className="text-slate-400">
                      {language === 'bn' ? 'অনুদিত টেক্সট এখানে দেখা যাবে...' : 'Translated text will appear here...'}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSpeak(translatedText, targetLang)}
                  disabled={!translatedText}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'উচ্চারণ' : 'Speak'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  disabled={!translatedText}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{language === 'bn' ? 'কপি' : 'Copy'}</span>
                </button>
              </div>

              {user && translatedText && (
                <button
                  type="button"
                  onClick={() =>
                    void toggleFavouriteTranslation(
                      {
                        id: '',
                        userId: user.uid,
                        sourceLang,
                        targetLang,
                        sourceText: sourceText.trim(),
                        translatedText,
                        mode,
                        provider: providerName,
                        isFavourite: isCurrentFavourited,
                      },
                      !isCurrentFavourited
                    )
                  }
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                    isCurrentFavourited
                      ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isCurrentFavourited ? 'fill-amber-500 text-amber-500' : ''}`} />
                  <span>{language === 'bn' ? 'প্রিয়' : 'Favourite'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History & Favourites */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveSubTab('history')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                activeSubTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? `ইতিহাস (${translationHistory.length})` : `History (${translationHistory.length})`}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('favourites')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                activeSubTab === 'favourites'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? `প্রিয় তালিকা (${favouriteTranslations.length})` : `Favourites (${favouriteTranslations.length})`}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder={language === 'bn' ? 'খুঁজুন...' : 'Search translations...'}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs"
              />
            </div>

            {activeSubTab === 'history' && translationHistory.length > 0 && (
              <button
                type="button"
                onClick={() => void clearTranslationHistory()}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'সব মুছুন' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>

        {!user ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            {language === 'bn' ? 'অনুবাদের ইতিহাস সংরক্ষণ করতে Google দিয়ে সাইন-ইন করুন।' : 'Sign in to sync translation history and favourites.'}
          </p>
        ) : activeSubTab === 'history' ? (
          filteredHistory.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              {language === 'bn' ? 'এখনো কোনো অনুবাদ ইতিহাস নেই।' : 'No translation history yet.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {filteredHistory.map((item) => (
                <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSourceText(item.sourceText);
                      setTranslatedText(item.translatedText);
                      setSourceLang(item.sourceLang);
                      setTargetLang(item.targetLang);
                      setMode(item.mode);
                    }}
                    className="flex-1 min-w-0 text-left space-y-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                      <span>{item.sourceLang} → {item.targetLang}</span>
                      <span>· {item.mode}</span>
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2">{item.sourceText}</p>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 line-clamp-2">{item.translatedText}</p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void toggleFavouriteTranslation(item, !item.isFavourite)}
                      className="p-1.5 text-slate-400 hover:text-amber-500 cursor-pointer"
                    >
                      <Star className={`w-3.5 h-3.5 ${item.isFavourite ? 'fill-amber-500 text-amber-500' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteTranslationRecord(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredFavourites.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            {language === 'bn' ? 'প্রিয় অনুবাদ তালিকা খালি।' : 'No favourite translations saved yet.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {filteredFavourites.map((fav) => (
              <div key={fav.id} className="py-3 flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSourceText(fav.sourceText);
                    setTranslatedText(fav.translatedText);
                    setSourceLang(fav.sourceLang);
                    setTargetLang(fav.targetLang);
                    setMode(fav.mode);
                  }}
                  className="flex-1 min-w-0 text-left space-y-1 cursor-pointer"
                >
                  <p className="text-[11px] font-mono text-slate-500">{fav.sourceLang} → {fav.targetLang}</p>
                  <p className="text-xs text-slate-800 dark:text-slate-200">{fav.sourceText}</p>
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-400">{fav.translatedText}</p>
                </button>
                <button
                  type="button"
                  onClick={() => void toggleFavouriteTranslation(fav, false)}
                  className="p-1.5 text-amber-500 hover:text-red-600 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
