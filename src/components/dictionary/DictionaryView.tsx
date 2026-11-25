import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Brain,
  Check,
  Copy,
  History,
  Loader2,
  Search,
  Sparkles,
  Star,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiUrl } from '../../engine/apiClient';
import { DictionaryDomain, DictionaryLookupResult } from '../../types';

const DOMAINS: Array<{ id: DictionaryDomain; en: string; bn: string }> = [
  { id: 'general', en: 'General', bn: 'সাধারণ' },
  { id: 'engineering', en: 'Engineering', bn: 'প্রকৌশল' },
  { id: 'scientific', en: 'Scientific', bn: 'বিজ্ঞান' },
  { id: 'mathematical', en: 'Mathematics', bn: 'গণিত' },
  { id: 'electrical', en: 'Electrical', bn: 'ইলেকট্রিক্যাল' },
  { id: 'mechanical', en: 'Mechanical', bn: 'মেকানিক্যাল' },
  { id: 'civil', en: 'Civil', bn: 'সিভিল' },
];

const WORD_OF_DAY_BANK = [
  { word: 'Impedance', bn: 'প্রতিবন্ধকতা / ইম্পিড্যান্স', domain: 'electrical' as DictionaryDomain, def: 'The effective resistance of an electric circuit or component to alternating current.' },
  { word: 'Equilibrium', bn: 'সাম্যাবস্থা', domain: 'scientific' as DictionaryDomain, def: 'A state in which opposing forces or influences are balanced.' },
  { word: 'Torque', bn: 'টর্ক / ঘূর্ণন বল', domain: 'mechanical' as DictionaryDomain, def: 'A twisting force that tends to cause rotation around an axis.' },
  { word: 'Algorithm', bn: 'অ্যালগরিদম / ধাপ-নির্দেশিকা', domain: 'mathematical' as DictionaryDomain, def: 'A step-by-step finite set of rules or instructions for solving a problem.' },
  { word: 'Cantilever', bn: 'ক্যান্টিলিভার / ঝুলন্ত বিম', domain: 'civil' as DictionaryDomain, def: 'A rigid structural element supported at only one fixed end.' },
  { word: 'Entropy', bn: 'এনট্রপি / বিশৃঙ্খলার পরিমাপ', domain: 'scientific' as DictionaryDomain, def: 'A thermodynamic quantity representing the unavailability of a system thermal energy for conversion into mechanical work.' },
  { word: 'Capacitance', bn: 'ধারকত্ব', domain: 'electrical' as DictionaryDomain, def: 'The ability of a system to store an electric charge per unit potential difference.' },
  { word: 'Resonance', bn: 'অনুনাদ / রেজোন্যান্স', domain: 'engineering' as DictionaryDomain, def: 'The reinforcement or prolongation of oscillation when driving frequency matches natural frequency.' },
  { word: 'Viscosity', bn: 'সান্দ্রতা', domain: 'mechanical' as DictionaryDomain, def: 'A fluid property measuring internal resistance to flow or shear deformation.' },
  { word: 'Gradient', bn: 'নতি / গ্রেডিয়েন্ট', domain: 'mathematical' as DictionaryDomain, def: 'The rate of change of a quantity with respect to spatial coordinates or slope.' },
];

export const DictionaryView: React.FC = () => {
  const {
    user,
    language,
    appSettings,
    dictionaryHistory,
    favouriteWords,
    saveDictionaryHistory,
    toggleFavouriteWord,
    clearDictionaryHistory,
    logApiUsage,
    showToast,
  } = useApp();

  const dictCfg = appSettings.dictionaryConfig;
  const moduleEnabled = dictCfg?.enabled !== false && appSettings.moduleFlags?.dictionaryEnabled !== false;
  const allowAiExplanations = dictCfg?.allowAiExplanations !== false;

  const [queryWord, setQueryWord] = useState('');
  const [direction, setDirection] = useState<'auto' | 'en-bn' | 'bn-en'>('auto');
  const [domain, setDomain] = useState<DictionaryDomain>(dictCfg?.defaultDomain || 'general');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DictionaryLookupResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'recent' | 'favourites' | 'practice'>('recent');
  const [copiedWord, setCopiedWord] = useState(false);

  // Vocabulary Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Day-indexed Word of the Day
  const wordOfTheDay = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    return WORD_OF_DAY_BANK[dayOfYear % WORD_OF_DAY_BANK.length];
  }, []);

  // Debounced Datamuse suggestions
  useEffect(() => {
    const trimmed = queryWord.trim();
    if (trimmed.length < 2 || !/^[a-zA-Z\s-]+$/.test(trimmed)) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/dictionary/suggestions?q=${encodeURIComponent(trimmed)}`));
        const data = (await res.json()) as { suggestions?: string[] };
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 6) : []);
      } catch {
        setSuggestions([]);
      }
    }, 240);
    return () => window.clearTimeout(timer);
  }, [queryWord]);

  const handleLookup = async (overrideWord?: string, overrideDomain?: DictionaryDomain) => {
    const target = (overrideWord ?? queryWord).trim();
    const targetDomain = overrideDomain ?? domain;
    if (!target) {
      showToast(language === 'bn' ? 'একটি শব্দ লিখুন' : 'Please enter a word to look up', 'info');
      return;
    }
    setQueryWord(target);
    setSuggestions([]);
    setLoading(true);
    setErrorMsg(null);

    try {
      const resp = await fetch(apiUrl('/api/dictionary/lookup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: target,
          direction,
          domain: targetDomain,
          allowAiExplanations,
        }),
      });
      const data = (await resp.json()) as DictionaryLookupResult & { error?: string };
      if (!resp.ok || data.error) {
        const msg = data.error || 'Dictionary lookup failed.';
        setErrorMsg(msg);
        void logApiUsage({
          service: 'dictionary',
          status: 'error',
          charsCount: target.length,
          detail: msg.slice(0, 160),
        });
        return;
      }

      setResult(data);
      if (user) {
        await saveDictionaryHistory({
          word: data.word,
          direction,
          domain: targetDomain,
          meaningBn: data.meaningBn,
          englishDefinition: data.englishDefinition,
          partOfSpeech: data.partOfSpeech,
          phonetic: data.phonetic,
          sourceName: data.sourceName,
          aiExplanationGenerated: data.aiExplanationGenerated,
        });
      }
      void logApiUsage({
        service: 'dictionary',
        status: 'success',
        charsCount: target.length,
        detail: `${data.word} (${targetDomain})`,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error looking up word.');
    } finally {
      setLoading(false);
    }
  };

  const handlePronounce = (wordText: string, audioUrl?: string) => {
    if (audioUrl) {
      try {
        if (!audioRef.current) audioRef.current = new Audio(audioUrl);
        else audioRef.current.src = audioUrl;
        void audioRef.current.play();
        return;
      } catch {
        // Fallback to Web Speech
      }
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(wordText);
      utter.lang = /[\u0980-\u09FF]/.test(wordText) ? 'bn-BD' : 'en-US';
      window.speechSynthesis.speak(utter);
    }
  };

  const isFavourited = useMemo(
    () => Boolean(result && favouriteWords.some((f) => f.word.toLowerCase() === result.word.toLowerCase())),
    [favouriteWords, result]
  );

  // Build vocabulary quiz deck from user favourites + Word of Day bank
  const quizDeck = useMemo(() => {
    const items = [
      ...favouriteWords.map((f) => ({
        word: f.word,
        correctBn: f.meaningBn || f.englishDefinition,
        hint: f.partOfSpeech,
      })),
      ...WORD_OF_DAY_BANK.map((w) => ({
        word: w.word,
        correctBn: w.bn,
        hint: w.domain,
      })),
    ];
    return items.slice(0, 12);
  }, [favouriteWords]);

  const currentQuizItem = quizDeck[quizIndex % quizDeck.length];
  const quizOptions = useMemo(() => {
    if (!currentQuizItem) return [];
    const distractors = WORD_OF_DAY_BANK.filter((w) => w.word !== currentQuizItem.word)
      .slice(0, 3)
      .map((w) => w.bn);
    const combined = [currentQuizItem.correctBn, ...distractors];
    // Deterministic rotation based on quizIndex so options don't jump on re-render
    const shift = quizIndex % combined.length;
    return [...combined.slice(shift), ...combined.slice(0, shift)];
  }, [currentQuizItem, quizIndex]);

  if (!moduleEnabled) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-6 text-center space-y-2">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
          {language === 'bn' ? 'স্মার্ট ডিকশনারি মডিউলটি বর্তমানে বন্ধ রয়েছে' : 'Smart Dictionary module is disabled'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-blue-700 dark:text-blue-400 shrink-0" />
            <span>{language === 'bn' ? 'স্মার্ট ও টেকনিক্যাল ডিকশনারি' : 'Smart Bilingual & Technical Dictionary'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {language === 'bn'
              ? 'ইংরেজি ↔ বাংলা অর্থ, উচ্চারণ, প্রকৌশল ও বিজ্ঞানভিত্তিক ব্যাখ্যা ও ভোকাবুলারি অনুশীলন।'
              : 'English ↔ Bangla definitions, IPA phonetics, engineering terminology & vocabulary quiz.'}
          </p>
        </div>
      </div>

      {/* Search & Word of the Day Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={queryWord}
                onChange={(e) => setQueryWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleLookup();
                }}
                placeholder={language === 'bn' ? 'শব্দ বা টেকনিক্যাল টার্ম লিখুন...' : 'Enter word or engineering term...'}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-20 divide-y divide-slate-100 dark:divide-slate-800">
                  {suggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => void handleLookup(sug)}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-3">
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'auto' | 'en-bn' | 'bn-en')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2.5 text-xs font-medium"
              >
                <option value="auto">{language === 'bn' ? 'Auto (EN ↔ BN)' : 'Auto (EN ↔ BN)'}</option>
                <option value="en-bn">English → বাংলা</option>
                <option value="bn-en">বাংলা → English</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={() => void handleLookup()}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 py-2.5 px-4 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>{language === 'bn' ? 'খুঁজুন' : 'Look Up'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {DOMAINS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDomain(d.id)}
                className={`px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer ${
                  domain === d.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {language === 'bn' ? d.bn : d.en}
              </button>
            ))}
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Lookup Result */}
          {result && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{result.word}</h2>
                    {result.partOfSpeech && (
                      <span className="text-xs font-mono text-blue-700 dark:text-blue-400">
                        [{result.partOfSpeech}]
                      </span>
                    )}
                    {result.phonetic && (
                      <span className="text-xs font-mono text-slate-500">{result.phonetic}</span>
                    )}
                  </div>
                  {result.meaningBn && (
                    <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                      {result.meaningBn}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePronounce(result.word, result.audioUrl)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>{language === 'bn' ? 'উচ্চারণ' : 'Audio'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${result.word} — ${result.meaningBn || result.englishDefinition}`);
                      setCopiedWord(true);
                      window.setTimeout(() => setCopiedWord(false), 1200);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
                  >
                    {copiedWord ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {user && (
                    <button
                      type="button"
                      onClick={() =>
                        void toggleFavouriteWord({
                          word: result.word,
                          meaningBn: result.meaningBn,
                          englishDefinition: result.englishDefinition,
                          partOfSpeech: result.partOfSpeech,
                          phonetic: result.phonetic,
                          domain,
                          examples: result.examples,
                          synonyms: result.synonyms,
                          antonyms: result.antonyms,
                        })
                      }
                      className={`p-1.5 rounded-lg border cursor-pointer ${
                        isFavourited
                          ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-600'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFavourited ? 'fill-amber-500 text-amber-500' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              {result.multipleMeaningsBn.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">
                    {language === 'bn' ? 'একাধিক বাংলা অর্থ' : 'Bangla Meanings'}
                  </p>
                  <p className="text-xs text-slate-800 dark:text-slate-200">
                    {result.multipleMeaningsBn.join(' · ')}
                  </p>
                </div>
              )}

              {result.englishDefinition && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">
                    {language === 'bn' ? 'ইংরেজি সংজ্ঞা' : 'English Definition'}
                  </p>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{result.englishDefinition}</p>
                </div>
              )}

              {result.domainNote && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-3 text-xs text-blue-900 dark:text-blue-200">
                  <span className="font-semibold">{language === 'bn' ? 'প্রকৌশল নোট: ' : 'Technical Note: '}</span>
                  {result.domainNote}
                </div>
              )}

              {result.examples.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">
                    {language === 'bn' ? 'উদাহরণ বাক্য' : 'Examples'}
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {result.examples.map((ex, idx) => (
                      <li key={idx}>{ex}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {result.synonyms.length > 0 && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                    <p className="text-[11px] font-semibold text-slate-500 mb-1">Synonyms</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.synonyms.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void handleLookup(s)}
                          className="text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {result.antonyms.length > 0 && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                    <p className="text-[11px] font-semibold text-slate-500 mb-1">Antonyms</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.antonyms.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void handleLookup(s)}
                          className="text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {result.relatedWords.length > 0 && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                    <p className="text-[11px] font-semibold text-slate-500 mb-1">Related Terms</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.relatedWords.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void handleLookup(s)}
                          className="text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Honest Attribution Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                <span>Source: {result.sourceName}</span>
                {result.aiExplanationGenerated && (
                  <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-medium">
                    <Sparkles className="w-3 h-3" />
                    <span>AI-generated Explanation (Gemini)</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Word of the Day Card */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              {language === 'bn' ? 'আজকের শব্দ (Word of the Day)' : 'Word of the Day'}
            </span>
            <span className="text-[11px] font-mono text-slate-500">{wordOfTheDay.domain}</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{wordOfTheDay.word}</h3>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{wordOfTheDay.bn}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{wordOfTheDay.def}</p>
          <button
            type="button"
            onClick={() => void handleLookup(wordOfTheDay.word, wordOfTheDay.domain)}
            className="w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 cursor-pointer"
          >
            {language === 'bn' ? 'সম্পূর্ণ বিশ্লেষণ দেখুন' : 'Look Up Full Entry'}
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Recent Searches, Favourite Words, Vocabulary Practice */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSubTab('recent')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                subTab === 'recent' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? `সাম্প্রতিক (${dictionaryHistory.length})` : `Recent (${dictionaryHistory.length})`}</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('favourites')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                subTab === 'favourites' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? `প্রিয় শব্দ (${favouriteWords.length})` : `Favourites (${favouriteWords.length})`}</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('practice')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                subTab === 'practice' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'শব্দভাণ্ডার অনুশীলন' : 'Vocabulary Quiz'}</span>
            </button>
          </div>

          {subTab === 'recent' && dictionaryHistory.length > 0 && (
            <button
              type="button"
              onClick={() => void clearDictionaryHistory()}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'সব মুছুন' : 'Clear'}</span>
            </button>
          )}
        </div>

        {subTab === 'recent' && (
          dictionaryHistory.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              {language === 'bn' ? 'সাম্প্রতিক খোঁজা কোনো শব্দ নেই।' : 'No recent dictionary lookups yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dictionaryHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleLookup(item.word, item.domain)}
                  className="text-left rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 hover:border-blue-400 cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{item.word}</span>
                    <span className="text-[11px] font-mono text-slate-500">{item.domain}</span>
                  </div>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 truncate">
                    {item.meaningBn || item.englishDefinition}
                  </p>
                </button>
              ))}
            </div>
          )
        )}

        {subTab === 'favourites' && (
          favouriteWords.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              {language === 'bn' ? 'এখনো কোনো প্রিয় শব্দ সংরক্ষণ করেননি।' : 'No favourite words saved yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {favouriteWords.map((fav) => (
                <div
                  key={fav.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 flex items-start justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => void handleLookup(fav.word, fav.domain)}
                    className="flex-1 text-left cursor-pointer space-y-1"
                  >
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{fav.word}</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">{fav.meaningBn}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{fav.englishDefinition}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleFavouriteWord(fav)}
                    className="p-1 text-amber-500 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {subTab === 'practice' && currentQuizItem && (
          <div className="max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono-tabular">
              <span>Question {(quizIndex % quizDeck.length) + 1} / {quizDeck.length}</span>
              <span>Score: {quizScore}</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">
                {language === 'bn' ? 'নিচের শব্দটির সঠিক অর্থ কোনটি?' : 'Select the correct Bangla meaning for:'}
              </p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{currentQuizItem.word}</h3>
            </div>
            <div className="space-y-2">
              {quizOptions.map((opt) => {
                const isCorrect = opt === currentQuizItem.correctBn;
                const isSelected = quizAnswered === opt;
                let cls = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-500';
                if (quizAnswered) {
                  if (isCorrect) cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300';
                  else if (isSelected) cls = 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300';
                }
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={Boolean(quizAnswered)}
                    onClick={() => {
                      setQuizAnswered(opt);
                      if (opt === currentQuizItem.correctBn) setQuizScore((s) => s + 1);
                    }}
                    className={`w-full text-left rounded-lg border px-4 py-2.5 text-xs font-medium cursor-pointer ${cls}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {quizAnswered && (
              <button
                type="button"
                onClick={() => {
                  setQuizAnswered(null);
                  setQuizIndex((i) => i + 1);
                }}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
              >
                {language === 'bn' ? 'পরবর্তী প্রশ্ন' : 'Next Question'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
