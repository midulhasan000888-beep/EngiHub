import React, { useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Compass,
  Download,
  ExternalLink,
  FileDiff,
  FileSpreadsheet,
  Globe,
  MessageSquareText,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { makeSafeId, useApp } from '../../context/AppContext';
import { apiUrl } from '../../engine/apiClient';
import {
  CalculatorDefinition,
  PdfChatMessage,
  PdfChatThread,
  PdfComparisonRecord,
  PdfDocumentRecord,
  PdfPageRecord,
} from '../../types';
import {
  exportTablesToCsv,
  matchNumbersToCalculators,
  selectRelevantPagesForQuery,
} from '../../engine/pdfProcessor';

interface ChatPanelProps {
  docs: PdfDocumentRecord[];
  activeDoc: PdfDocumentRecord | null;
  pagesByDocId: Record<string, PdfPageRecord[]>;
  ensurePagesLoaded: (docId: string) => Promise<PdfPageRecord[]>;
  onJumpToPage: (docId: string, pageNumber: number) => void;
}

const SOURCE_BADGE_MAP: Record<string, string> = {
  pdf: 'PDF',
  text: 'TEXT',
  url: 'URL',
  multi_url: 'MULTI-URL',
  document: 'DOC',
  image: 'IMG',
};

export const PdfChatPanel: React.FC<ChatPanelProps> = ({
  docs,
  activeDoc,
  ensurePagesLoaded,
  onJumpToPage,
}) => {
  const {
    user,
    language,
    appSettings,
    pdfChats,
    todayAiUsage,
    incrementAiUsage,
    showToast,
  } = useApp();

  const readyDocs = useMemo(() => docs.filter((d) => d.processingStatus === 'ready'), [docs]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(() =>
    activeDoc ? [activeDoc.id] : readyDocs[0] ? [readyDocs[0].id] : []
  );
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'standard' | 'research' | 'engineering'>('standard');

  const aiCfg = appSettings.aiPdfConfig;
  const activeChat = pdfChats.find((c) => c.id === activeChatId) || null;

  const effectiveDocIds = useMemo(() => {
    const validSet = new Set(readyDocs.map((d) => d.id));
    const filtered = selectedDocIds.filter((id) => validSet.has(id));
    if (filtered.length > 0) return filtered;
    if (activeDoc && validSet.has(activeDoc.id)) return [activeDoc.id];
    return readyDocs[0] ? [readyDocs[0].id] : [];
  }, [selectedDocIds, readyDocs, activeDoc]);

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev.slice(0, 7), id]
    );
  };

  const quickPrompts =
    language === 'bn'
      ? [
          'সব নির্বাচিত উৎসের মূল তথ্য সারসংক্ষেপ করুন',
          'উৎসগুলোর মধ্যে তুলনা করে একটি টেবিল তৈরি করুন',
          'সকল ক্যাবল ও ইকুইপমেন্ট স্পেসিফিকেশন বের করুন',
          'মোট ইলেকট্রিক্যাল লোড ও গুরুত্বপূর্ণ সংখ্যাগুলো দেখান',
          'উৎসে কোনো ভুল, অসঙ্গতি বা সতর্কতা থাকলে চিহ্নিত করুন',
          'বিষয়টি গভীর রিসার্চ দৃষ্টিভঙ্গি ও সহজ বাংলায় ব্যাখ্যা করুন',
        ]
      : [
          'Summarize key facts across all selected sources',
          'Compare selected sources in a structured table',
          'Extract all cable, motor & equipment specifications',
          'Find total electrical load & key numeric metrics',
          'Identify errors, contradictions, or gaps in these sources',
          'Synthesize findings in Research Mode with citations',
        ];

  const handleAsk = async (promptOverride?: string) => {
    const q = (promptOverride ?? question).trim();
    if (!q || !user) return;
    if (effectiveDocIds.length === 0) {
      showToast(
        language === 'bn' ? 'প্রথমে কমপক্ষে একটি বিশ্লেষিত উৎস নির্বাচন করুন।' : 'Select at least one analyzed source first.',
        'info'
      );
      return;
    }
    const dailyLimit = aiCfg?.dailyUserAnalysisLimit ?? 25;
    if ((todayAiUsage?.analysisCount || 0) + (todayAiUsage?.questionCount || 0) > dailyLimit * 3) {
      showToast('Daily AI query quota reached. Contact admin.', 'error');
      return;
    }

    setAsking(true);
    try {
      const docsContextPayload = [];
      for (const docId of effectiveDocIds) {
        const d = readyDocs.find((item) => item.id === docId);
        if (!d) continue;
        const allPages = await ensurePagesLoaded(docId);
        const selectedPages = selectRelevantPagesForQuery(q, allPages, effectiveDocIds.length > 1 ? 4 : 6);
        docsContextPayload.push({
          id: d.id,
          title: d.title,
          sourceType: d.sourceType || 'pdf',
          sourceUrl: d.sourceUrl,
          documentType: d.documentType || d.category,
          summaryEn: d.summaryEn || '',
          relevantPages: selectedPages.map((p) => ({
            pageNumber: p.pageNumber,
            text: p.text,
            diagramSummary: p.diagramSummary || '',
            imageBase64:
              aiCfg?.allowOcrAndVision !== false &&
              (p.isScanned || q.toLowerCase().includes('drawing') || q.toLowerCase().includes('diagram') || q.includes('ড্রয়িং'))
                ? p.thumbnailDataUrl
                : undefined,
          })),
        });
      }

      const historyMsgs = (activeChat?.messages || []).slice(-6).map((m) => ({
        role: m.role,
        text: m.sourceBasedAnswer || m.text,
      }));

      const resp = await fetch(apiUrl('/api/pdf/ask'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          language,
          documents: docsContextPayload,
          history: historyMsgs,
          analysisMode,
          provider: aiCfg?.aiProvider || 'gemini',
          model: aiCfg?.preferredModel,
          reasoningLevel: aiCfg?.reasoningLevel,
          stripPii: aiCfg?.stripPiiBeforeAi ?? true,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to get AI response');
      }

      const userMsg: PdfChatMessage = {
        id: makeSafeId('msg'),
        role: 'user',
        text: q,
        analysisMode,
        createdAtIso: new Date().toISOString(),
      };

      const sourceAns = String(data.sourceBasedAnswer || data.answer || 'No response generated.');
      const generalAns = String(data.aiGeneralKnowledge || data.aiInterpretation || '');
      const confidenceVal: PdfChatMessage['confidence'] =
        data.confidence === 'high' || data.confidence === 'medium' || data.confidence === 'low' || data.confidence === 'none'
          ? data.confidence
          : data.missingInfo
            ? 'none'
            : 'medium';

      const assistantMsg: PdfChatMessage = {
        id: makeSafeId('msg'),
        role: 'assistant',
        text: sourceAns,
        sourceBasedAnswer: sourceAns,
        aiGeneralKnowledge: generalAns,
        confidence: confidenceVal,
        analysisMode,
        missingInfo: Boolean(data.missingInfo),
        extractedFacts: Array.isArray(data.extractedFacts) ? data.extractedFacts : [],
        aiInterpretation: generalAns,
        citations: Array.isArray(data.citations) ? data.citations : [],
        table:
          data.table && Array.isArray(data.table.headers) && data.table.headers.length > 0
            ? {
                title: data.table.title || 'Extracted Table',
                headers: data.table.headers,
                rows: Array.isArray(data.table.rows) ? data.table.rows : [],
              }
            : undefined,
        createdAtIso: new Date().toISOString(),
      };

      const chatId = activeChat?.id || makeSafeId('chat');
      const nextMessages = [...(activeChat?.messages || []), userMsg, assistantMsg].slice(-80);
      const threadPayload: PdfChatThread = {
        id: chatId,
        userId: user.uid,
        title: activeChat?.title || q.slice(0, 70),
        documentIds: effectiveDocIds,
        messages: nextMessages,
      };

      await setDoc(doc(db, 'pdfChats', chatId), {
        ...threadPayload,
        createdAt: activeChat?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setActiveChatId(chatId);
      if (!promptOverride) setQuestion('');
      await incrementAiUsage('question');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Smart Analyzer Q&A error';
      showToast(msg, 'error');
    } finally {
      setAsking(false);
    }
  };

  const renderConfidenceBadge = (m: PdfChatMessage) => {
    const conf = m.confidence || (m.missingInfo ? 'none' : 'medium');
    if (conf === 'high') {
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <ShieldCheck className="w-3 h-3" />
          <span>{language === 'bn' ? 'উচ্চ নির্ভরযোগ্যতা' : 'High Grounding'}</span>
        </span>
      );
    }
    if (conf === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
          <span>{language === 'bn' ? 'মাঝারি নির্ভরযোগ্যতা' : 'Medium Grounding'}</span>
        </span>
      );
    }
    if (conf === 'low') {
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <span>{language === 'bn' ? 'সীমিত তথ্য' : 'Partial Match'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
        <span>{language === 'bn' ? 'উৎসে পাওয়া যায়নি' : 'Not in Source'}</span>
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left: Multi-Source Context & Chat Threads */}
      <div className="lg:col-span-4 space-y-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
              {language === 'bn' ? 'বহু-উৎস ওয়ার্কস্পেস কনটেক্সট' : 'Multi-Source Q&A Context'}
            </h3>
            <span className="text-[11px] text-slate-500 tabular-nums">{effectiveDocIds.length}/8 selected</span>
          </div>
          {readyDocs.length === 0 ? (
            <p className="text-xs text-slate-500">
              {language === 'bn'
                ? 'প্রথমে পিডিএফ, টেক্সট, লিংক বা ফাইল বিশ্লেষণ করুন।'
                : 'Analyze at least one PDF, URL, text, doc, or image first.'}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {readyDocs.map((d) => {
                const checked = effectiveDocIds.includes(d.id);
                const badge = SOURCE_BADGE_MAP[d.sourceType || 'pdf'] || 'PDF';
                return (
                  <label
                    key={d.id}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs cursor-pointer ${
                      checked
                        ? 'border-brand-primary bg-brand-soft text-brand-primary'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDocSelection(d.id)}
                    />
                    <span className="rounded bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                      {badge}
                    </span>
                    <span className="truncate font-medium flex-1 text-slate-900 dark:text-slate-100">{d.title}</span>
                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{d.pageCount}p</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
              {language === 'bn' ? 'আগের কথোপকথন' : 'Saved Research Threads'}
            </h3>
            <button
              type="button"
              onClick={() => setActiveChatId(null)}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'নতুন চ্যাট' : 'New Chat'}</span>
            </button>
          </div>
          {pdfChats.length === 0 ? (
            <p className="text-xs text-slate-500">
              {language === 'bn' ? 'এখনো কোনো প্রশ্ন করা হয়নি।' : 'No saved conversations yet.'}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {pdfChats.map((thread) => (
                <div
                  key={thread.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                    activeChatId === thread.id
                      ? 'border-brand-primary bg-brand-soft'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChatId(thread.id);
                      setSelectedDocIds(thread.documentIds);
                    }}
                    className="text-left truncate flex-1 font-medium cursor-pointer"
                  >
                    {thread.title}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await deleteDoc(doc(db, 'pdfChats', thread.id));
                        if (activeChatId === thread.id) setActiveChatId(null);
                      } catch (err) {
                        handleFirestoreError(err, OperationType.DELETE, `pdfChats/${thread.id}`);
                      }
                    }}
                    className="text-slate-400 hover:text-red-600 cursor-pointer"
                    aria-label="Delete thread"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Dual-Layer Grounded AI & Research Assistant */}
      <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col gap-4 min-h-[560px]">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <MessageSquareText className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {language === 'bn'
                ? 'স্মার্ট প্রশ্নোত্তর ও রিসার্চ অ্যাসিস্ট্যান্ট'
                : 'Grounded Multi-Source Q&A & Research Assistant'}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAnalysisMode('standard')}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-medium cursor-pointer ${
                analysisMode === 'standard'
                  ? 'border-brand-primary bg-brand-soft text-brand-primary'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {language === 'bn' ? 'স্ট্যান্ডার্ড' : 'Standard'}
            </button>
            {aiCfg?.allowResearchMode !== false && (
              <button
                type="button"
                onClick={() => setAnalysisMode('research')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium cursor-pointer ${
                  analysisMode === 'research'
                    ? 'border-brand-primary bg-brand-soft text-brand-primary'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Compass className="w-3 h-3" />
                <span>{language === 'bn' ? 'রিসার্চ মোড' : 'AI Research'}</span>
              </button>
            )}
            {aiCfg?.enableEngineeringMode !== false && (
              <button
                type="button"
                onClick={() => setAnalysisMode('engineering')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium cursor-pointer ${
                  analysisMode === 'engineering'
                    ? 'border-brand-primary bg-brand-soft text-brand-primary'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>{language === 'bn' ? 'ইঞ্জিনিয়ারিং' : 'Engineering'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Prompt Suggestions */}
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((qp) => (
            <button
              key={qp}
              type="button"
              disabled={asking || readyDocs.length === 0}
              onClick={() => handleAsk(qp)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-300 hover:border-brand-primary hover:text-brand-primary transition-colors cursor-pointer disabled:opacity-50"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 space-y-4 overflow-y-auto max-h-[500px] pr-1">
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-xs text-slate-500">
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {language === 'bn'
                  ? 'নির্বাচিত পিডিএফ, টেক্সট, ওয়েবসাইট লিংক, ডকুমেন্ট বা ছবি থেকে প্রশ্ন করুন'
                  : 'Ask questions combining any selected PDFs, Website URLs, Text, Docs, or Images'}
              </p>
              <p>
                {language === 'bn'
                  ? 'প্রতিটি উত্তরে "উৎস ভিত্তিক উত্তর" ও "AI সাধারণ জ্ঞান" আলাদা প্যানেলে প্রদর্শিত হবে।'
                  : 'Every reply strictly separates Grounded Source-Based Answers (with citations) from AI General Knowledge.'}
              </p>
            </div>
          ) : (
            activeChat.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl p-4 text-xs space-y-3 ${
                  m.role === 'user'
                    ? 'bg-brand-soft border border-brand-primary ml-8'
                    : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 mr-2'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {m.role === 'user'
                      ? language === 'bn'
                        ? 'আপনি'
                        : 'You'
                      : `EngiHub Smart AI (${(aiCfg?.aiProvider || 'gemini').toUpperCase()})`}
                  </span>
                  {m.role === 'assistant' && renderConfidenceBadge(m)}
                </div>

                {m.role === 'user' ? (
                  <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {m.text}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* PANEL 1: Strictly Grounded Source-Based Answer */}
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-white dark:bg-slate-900 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>
                            {language === 'bn'
                              ? '১. উৎস ভিত্তিক উত্তর (Source-Based Answer)'
                              : '1. Source-Based Answer (Strictly Grounded)'}
                          </span>
                        </span>
                      </div>

                      {m.missingInfo && (
                        <div className="rounded border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                          {language === 'bn'
                            ? 'এই তথ্য প্রদত্ত উৎসে পাওয়া যায়নি।'
                            : 'This information was not found in the provided sources.'}
                        </div>
                      )}

                      <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                        {m.sourceBasedAnswer || m.text}
                      </p>

                      {m.extractedFacts && m.extractedFacts.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                          <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            {language === 'bn' ? 'উৎস থেকে উদ্ধৃত তথ্য (Verified Facts):' : 'Verified Source Facts:'}
                          </p>
                          <ul className="list-disc pl-4 space-y-0.5 text-slate-700 dark:text-slate-300">
                            {m.extractedFacts.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {m.citations && m.citations.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {language === 'bn' ? 'তথ্যসূত্র ও উদ্ধৃতি (Citations):' : 'Source Citations:'}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {m.citations.map((cit, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                                title={cit.excerpt}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (cit.docId) onJumpToPage(cit.docId, cit.page);
                                  }}
                                  className="text-brand-primary hover:underline cursor-pointer font-medium tabular-nums"
                                >
                                  {cit.sourceTitle || cit.docTitle} · {cit.sourceType === 'url' ? `Sec ${cit.page}` : `p.${cit.page}`}
                                </button>
                                {cit.url && (
                                  <a
                                    href={cit.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-slate-400 hover:text-brand-primary"
                                    title={cit.url}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Structured Table if returned */}
                    {m.table && m.table.headers.length > 0 && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {m.table.title || 'Extracted Comparison Table'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              exportTablesToCsv(
                                [{ id: m.id, title: m.table?.title || 'AI Table', page: 1, headers: m.table!.headers, rows: m.table!.rows }],
                                'qa_extracted_table'
                              )
                            }
                            className="inline-flex items-center gap-1 text-[11px] text-brand-primary hover:underline cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>CSV</span>
                          </button>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-100 dark:bg-slate-950">
                              <tr>
                                {m.table.headers.map((h, i) => (
                                  <th key={i} className="px-2.5 py-1.5 font-semibold">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {m.table.rows.map((row, ri) => (
                                <tr key={ri}>
                                  {row.map((cell, ci) => (
                                    <td key={ci} className="px-2.5 py-1.5 tabular-nums">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* PANEL 2: Clearly Separated AI General Knowledge */}
                    {(m.aiGeneralKnowledge || m.aiInterpretation) && (
                      <div className="rounded-lg border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" />
                          <span>
                            {language === 'bn'
                              ? '২. এআই সাধারণ জ্ঞান (প্রদত্ত উৎসের বাইরের সহায়ক ব্যাখ্যা)'
                              : '2. AI General Knowledge (External Context — Not From Source)'}
                          </span>
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {m.aiGeneralKnowledge || m.aiInterpretation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              language === 'bn'
                ? 'সব নির্বাচিত উৎস সম্পর্কে প্রশ্ন লিখুন (বাংলা বা ইংরেজি)...'
                : 'Ask or research across all selected sources (English / Bangla)...'
            }
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={asking || !question.trim() || readyDocs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{asking ? (language === 'bn' ? 'বিশ্লেষণ হচ্ছে...' : 'Analyzing...') : language === 'bn' ? 'জিজ্ঞাসা করুন' : 'Ask AI'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

interface ComparePanelProps {
  docs: PdfDocumentRecord[];
  ensurePagesLoaded: (docId: string) => Promise<PdfPageRecord[]>;
}

export const PdfComparePanel: React.FC<ComparePanelProps> = ({ docs, ensurePagesLoaded }) => {
  const {
    user,
    language,
    appSettings,
    pdfComparisons,
    incrementAiUsage,
    setPendingReportDraft,
    navigateTo,
    showToast,
  } = useApp();

  const readyDocs = useMemo(() => docs.filter((d) => d.processingStatus === 'ready'), [docs]);
  const [baseId, setBaseId] = useState(readyDocs[0]?.id || '');
  const [compareId, setCompareId] = useState(readyDocs[1]?.id || '');
  const [focusArea, setFocusArea] = useState<'general' | 'cable_schedule' | 'boq' | 'equipment_specs' | 'version_diff'>('version_diff');
  const [comparing, setComparing] = useState(false);
  const [activeComp, setActiveComp] = useState<PdfComparisonRecord | null>(pdfComparisons[0] || null);

  const aiCfg = appSettings.aiPdfConfig;

  const handleCompare = async () => {
    if (!user) return;
    if (!baseId || !compareId || baseId === compareId) {
      showToast(
        language === 'bn'
          ? 'তুলনা করার জন্য দুটি ভিন্ন বিশ্লেষিত উৎস নির্বাচন করুন।'
          : 'Select two different analyzed sources to compare.',
        'info'
      );
      return;
    }

    const docA = readyDocs.find((d) => d.id === baseId);
    const docB = readyDocs.find((d) => d.id === compareId);
    if (!docA || !docB) return;

    setComparing(true);
    try {
      const [pagesA, pagesB] = await Promise.all([
        ensurePagesLoaded(docA.id),
        ensurePagesLoaded(docB.id),
      ]);

      const resp = await fetch(apiUrl('/api/pdf/compare'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseDoc: {
            title: docA.title,
            documentType: docA.documentType,
            summaryEn: docA.summaryEn,
            specs: docA.extractedSpecs,
            tables: docA.extractedTables,
            pages: pagesA.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
          },
          compareDoc: {
            title: docB.title,
            documentType: docB.documentType,
            summaryEn: docB.summaryEn,
            specs: docB.extractedSpecs,
            tables: docB.extractedTables,
            pages: pagesB.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
          },
          focusArea,
          language,
          provider: aiCfg?.aiProvider || 'gemini',
          model: aiCfg?.preferredModel,
          reasoningLevel: aiCfg?.reasoningLevel,
          stripPii: aiCfg?.stripPiiBeforeAi ?? true,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Comparison failed');

      const compId = makeSafeId('cmp');
      const record: PdfComparisonRecord = {
        id: compId,
        userId: user.uid,
        title: `${docA.title} vs ${docB.title}`,
        baseDocId: docA.id,
        compareDocId: docB.id,
        focusArea,
        summary: String(data.summary || '').slice(0, 5800),
        addedItems: Array.isArray(data.addedItems) ? data.addedItems.slice(0, 90) : [],
        removedItems: Array.isArray(data.removedItems) ? data.removedItems.slice(0, 90) : [],
        modifiedItems: Array.isArray(data.modifiedItems) ? data.modifiedItems.slice(0, 90) : [],
      };

      await setDoc(doc(db, 'pdfComparisons', compId), {
        ...record,
        createdAt: serverTimestamp(),
      });
      setActiveComp(record);
      await incrementAiUsage('comparison');
      showToast(language === 'bn' ? 'তথ্যসূত্র তুলনা সম্পন্ন হয়েছে।' : 'Source comparison completed.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Comparison failed', 'error');
    } finally {
      setComparing(false);
    }
  };

  const sendComparisonToReport = (comp: PdfComparisonRecord) => {
    const rows = [
      ...comp.modifiedItems.map((m) => ({
        label: `[MODIFIED] ${m.parameter}`,
        value: `${m.oldValue} -> ${m.newValue}`,
        unit: `${m.basePageRef || ''} / ${m.comparePageRef || ''}`.trim(),
        notes: m.deltaNote || '',
      })),
      ...comp.addedItems.map((a) => ({
        label: `[ADDED] ${a.item}`,
        value: a.details,
        unit: a.pageRef,
        notes: a.impact || '',
      })),
      ...comp.removedItems.map((r) => ({
        label: `[REMOVED] ${r.item}`,
        value: r.details,
        unit: r.pageRef,
        notes: r.impact || '',
      })),
    ];

    setPendingReportDraft({
      title: `PDF Comparison Report: ${comp.title}`,
      sourceType: 'pdf_analyzer',
      rows: rows.length > 0 ? rows : [{ label: 'Comparison Summary', value: comp.summary, unit: '-' }],
      chartData: [
        { label: 'Added', value: comp.addedItems.length },
        { label: 'Removed', value: comp.removedItems.length },
        { label: 'Modified', value: comp.modifiedItems.length },
      ],
      remarks: `Focus: ${comp.focusArea}\n\n${comp.summary}`,
    });
    navigateTo('reports');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileDiff className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {language === 'bn' ? 'একাধিক পিডিএফ তুলনা ও পরিবর্তন শনাক্তকরণ' : 'Multi-Document Technical Comparison'}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              {language === 'bn' ? 'বেসলাইন ডকুমেন্ট (A)' : 'Baseline Document (A)'}
            </label>
            <select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="">-- Select PDF A --</option>
              {readyDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.pageCount}p)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              {language === 'bn' ? 'তুলনীয় ডকুমেন্ট (B)' : 'Comparison Document (B)'}
            </label>
            <select
              value={compareId}
              onChange={(e) => setCompareId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="">-- Select PDF B --</option>
              {readyDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.pageCount}p)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              {language === 'bn' ? 'তুলনার ক্ষেত্র' : 'Comparison Focus'}
            </label>
            <select
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value as typeof focusArea)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="version_diff">Document Revision / Version Diff</option>
              <option value="cable_schedule">Cable Schedules & Load Ratings</option>
              <option value="equipment_specs">Equipment Specifications & Datasheets</option>
              <option value="boq">BOQ Quantities & Cost Changes</option>
              <option value="general">General Technical Findings</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCompare}
          disabled={comparing || readyDocs.length < 2}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
        >
          <FileDiff className="w-3.5 h-3.5" />
          <span>{comparing ? (language === 'bn' ? 'তুলনা করা হচ্ছে...' : 'Comparing Documents...') : language === 'bn' ? 'তুলনা শুরু করুন' : 'Run Comparison'}</span>
        </button>
      </div>

      {activeComp && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{activeComp.title}</h4>
              <p className="text-xs text-slate-500">
                Focus: {activeComp.focusArea} · Added: {activeComp.addedItems.length} · Removed:{' '}
                {activeComp.removedItems.length} · Modified: {activeComp.modifiedItems.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => sendComparisonToReport(activeComp)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'রিপোর্টে পাঠান' : 'Export to Report Generator'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {activeComp.summary}
          </p>

          {/* Modified Table */}
          {activeComp.modifiedItems.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Modified Parameters ({activeComp.modifiedItems.length})
              </h5>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Parameter / Item</th>
                      <th className="px-3 py-2 font-semibold">Baseline (Doc A)</th>
                      <th className="px-3 py-2 font-semibold">Revised (Doc B)</th>
                      <th className="px-3 py-2 font-semibold">Pages & Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeComp.modifiedItems.map((m, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-medium">{m.parameter}</td>
                        <td className="px-3 py-2 text-red-700 dark:text-red-400 font-mono-tabular">{m.oldValue}</td>
                        <td className="px-3 py-2 text-emerald-700 dark:text-emerald-400 font-mono-tabular">{m.newValue}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {[m.basePageRef, m.comparePageRef].filter(Boolean).join(' -> ')} {m.deltaNote ? `· ${m.deltaNote}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Added & Removed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-2">
              <h5 className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Added in Document B ({activeComp.addedItems.length})
              </h5>
              {activeComp.addedItems.length === 0 ? (
                <p className="text-xs text-slate-500">No newly added items detected.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {activeComp.addedItems.map((a, i) => (
                    <li key={i} className="border-b border-emerald-100 dark:border-emerald-900/40 pb-1.5 last:border-0">
                      <span className="font-semibold">{a.item}</span> ({a.pageRef}): {a.details}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 p-4 space-y-2">
              <h5 className="text-xs font-semibold text-red-800 dark:text-red-300">
                Removed from Document A ({activeComp.removedItems.length})
              </h5>
              {activeComp.removedItems.length === 0 ? (
                <p className="text-xs text-slate-500">No removed items detected.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {activeComp.removedItems.map((r, i) => (
                    <li key={i} className="border-b border-red-100 dark:border-red-900/40 pb-1.5 last:border-0">
                      <span className="font-semibold">{r.item}</span> ({r.pageRef}): {r.details}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {pdfComparisons.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {language === 'bn' ? 'পূর্ববর্তী তুলনাসমূহ' : 'Saved Comparison History'}
          </h4>
          <div className="flex flex-wrap gap-2">
            {pdfComparisons.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveComp(c)}
                className={`rounded-lg border px-3 py-1.5 text-xs cursor-pointer ${
                  activeComp?.id === c.id
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface CalculatorBridgeProps {
  docItem: PdfDocumentRecord;
}

export const PdfCalculatorBridgePanel: React.FC<CalculatorBridgeProps> = ({ docItem }) => {
  const { language, calculators, openCalculatorWithPrefill, appSettings } = useApp();
  const [confirmTarget, setConfirmTarget] = useState<{
    calculator: CalculatorDefinition;
    mappedInputs: Record<string, number>;
    mappedUnits: Record<string, string>;
    assumptions: string[];
  } | null>(null);

  const numbers = docItem.extractedNumbers || [];
  const matches = useMemo(
    () => matchNumbersToCalculators(numbers, calculators),
    [numbers, calculators]
  );

  if (appSettings.aiPdfConfig?.allowCalculatorBridge === false) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-xs text-slate-500">
        {language === 'bn'
          ? 'অ্যাডমিন সেটিংস থেকে এআই ক্যালকুলেটর ব্রিজ সাময়িকভাবে বন্ধ রাখা হয়েছে।'
          : 'AI Calculator Integration is currently disabled by administrator settings.'}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Confirmation Modal / Card */}
      {confirmTarget && (
        <div className="rounded-xl border-2 border-blue-600 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <span>
                  {language === 'bn'
                    ? 'হিসাবে পিডিএফের মান ব্যবহার করার পূর্বে নিশ্চিত করুন'
                    : 'Confirm Extracted PDF Values Before Calculating'}
                </span>
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Target Calculator:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {language === 'bn' ? confirmTarget.calculator.nameBn : confirmTarget.calculator.nameEn}
                </strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {confirmTarget.calculator.inputs.map((field) => (
              <div key={field.key} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1">
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  {language === 'bn' ? field.labelBn : field.labelEn} ({field.defaultUnit || '-'})
                </label>
                <input
                  type="number"
                  step="any"
                  value={confirmTarget.mappedInputs[field.key] ?? field.defaultValue}
                  onChange={(e) =>
                    setConfirmTarget((prev) =>
                      prev
                        ? {
                            ...prev,
                            mappedInputs: {
                              ...prev.mappedInputs,
                              [field.key]: Number(e.target.value),
                            },
                          }
                        : null
                    )
                  }
                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono-tabular"
                />
              </div>
            ))}
          </div>

          {confirmTarget.assumptions.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-3 space-y-1 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'একক ও অনুমান যাচাই:' : 'Unit Validation & Assumptions:'}</span>
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                {confirmTarget.assumptions.map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                openCalculatorWithPrefill(
                  confirmTarget.calculator.id,
                  confirmTarget.calculator.categoryId,
                  confirmTarget.mappedInputs,
                  confirmTarget.mappedUnits,
                  docItem.title
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {language === 'bn' ? 'নিশ্চিত করুন ও ক্যালকুলেটর খুলুন' : 'Confirm & Open Calculator'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmTarget(null)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium cursor-pointer"
            >
              {language === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Recommended Calculators Matched From PDF Numbers */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {language === 'bn'
              ? 'উপযুক্ত সূত্রসাথী ক্যালকুলেটরে মান পাঠান'
              : 'Send Extracted Parameters to Dynamic Calculators'}
          </h3>
        </div>

        {matches.length === 0 ? (
          <p className="text-xs text-slate-500">
            {language === 'bn'
              ? 'এই ডকুমেন্ট থেকে কোনো সংখ্যাগত প্রকৌশল মান ক্যালকুলেটরের সাথে মেলেনি।'
              : 'No extracted numerical engineering values matched built-in calculator parameters yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {matches.map((m) => (
              <div
                key={m.calculator.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {language === 'bn' ? m.calculator.nameBn : m.calculator.nameEn}
                  </p>
                  <p className="text-[11px] font-mono-tabular text-blue-700 dark:text-blue-400 truncate">
                    {m.calculator.formulaDisplay}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Matched {m.matchedCount} of {m.calculator.inputs.length} input fields
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmTarget({
                      calculator: m.calculator,
                      mappedInputs: m.mappedInputs,
                      mappedUnits: m.mappedUnits,
                      assumptions: m.assumptions,
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
                >
                  <span>{language === 'bn' ? 'মান যাচাই করে ব্যবহার করুন' : 'Review & Use Values'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extracted Numerical Values Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {language === 'bn'
            ? `পিডিএফ থেকে প্রাপ্ত সংখ্যা ও একক (${numbers.length})`
            : `Validated Numbers & Units Extracted (${numbers.length})`}
        </h3>
        {numbers.length === 0 ? (
          <p className="text-xs text-slate-500">No structured numerical parameters extracted.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Parameter</th>
                  <th className="py-2 pr-3 font-semibold">Value</th>
                  <th className="py-2 pr-3 font-semibold">Unit</th>
                  <th className="py-2 pr-3 font-semibold">Page</th>
                  <th className="py-2 font-semibold">Raw Document Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {numbers.map((n, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 font-medium">{n.label}</td>
                    <td className="py-2 pr-3 font-mono-tabular font-semibold text-blue-700 dark:text-blue-400">
                      {n.value}
                    </td>
                    <td className="py-2 pr-3">{n.unit || '-'}</td>
                    <td className="py-2 pr-3 tabular-nums">p.{n.page}</td>
                    <td className="py-2 text-slate-500">{n.rawText}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
