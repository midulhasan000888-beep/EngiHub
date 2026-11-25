import React, { useMemo, useRef, useState } from 'react';
import { apiUrl } from '../../engine/apiClient';
import {
  ArrowDown,
  ArrowUp,
  BarChart2,
  Copy,
  Download,
  FileText,
  FolderOpen,
  ImagePlus,
  LayoutTemplate,
  List,
  Maximize2,
  Minimize2,
  Network,
  Play,
  Plus,
  Presentation,
  Printer,
  Save,
  Shapes,
  Sparkles,
  Table,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  Language,
  PresentationAnimation,
  PresentationClassLevel,
  PresentationRecord,
  PresentationSlide,
  PresentationSlideElement,
  PresentationTemplateRecord,
  PresentationTransition,
} from '../../types';
import {
  PRESENTATION_THEMES,
  SEED_PRESENTATION_TEMPLATES,
} from '../../data/seedPresentationTemplates';
import {
  exportPresentationToPdf,
  exportPresentationToPptx,
} from '../../engine/presentationExport';

type ViewTab = 'studio' | 'ai' | 'templates' | 'saved';

const CLASS_LEVELS: PresentationClassLevel[] = [
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'College',
  'University',
];

const SUBJECTS = [
  'Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'ICT',
  'Geography',
  'History',
  'Engineering',
  'Business Studies',
  'Bangla',
  'English',
];

export const PresentationMakerView: React.FC = () => {
  const {
    user,
    language,
    presentations,
    presentationTemplates,
    savePresentation,
    deletePresentation,
    logUserExport,
    showToast,
  } = useApp();

  const [tab, setTab] = useState<ViewTab>('studio');
  const [deckId, setDeckId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState(() =>
    language === 'bn' ? 'আমার প্রথম প্রেজেন্টেশন' : 'My Student Presentation'
  );
  const [topic, setTopic] = useState('সালোকসংশ্লেষণ ও উদ্ভিদে খাদ্য তৈরি');
  const [classLevel, setClassLevel] = useState<PresentationClassLevel>('Class 8');
  const [subject, setSubject] = useState('Science');
  const [deckLang, setDeckLang] = useState<Language>(language);
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [themeId, setThemeId] = useState('academic-blue');
  const [audience, setAudience] = useState('Classroom Students & Teacher');
  const [purpose, setPurpose] = useState('Concept explanation & class seminar');
  const [slideCount, setSlideCount] = useState(8);
  const [references, setReferences] = useState<string[]>([]);
  const [slides, setSlides] = useState<PresentationSlide[]>(() =>
    JSON.parse(JSON.stringify(SEED_PRESENTATION_TEMPLATES[0].slides))
  );
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [selectedElId, setSelectedElId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [presenterMode, setPresenterMode] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const activeSlide = slides[activeSlideIdx] || slides[0];
  const selectedElement = useMemo(
    () => activeSlide?.elements.find((e) => e.id === selectedElId) || null,
    [activeSlide, selectedElId]
  );

  const allTemplates = useMemo<PresentationTemplateRecord[]>(() => {
    const map = new Map<string, PresentationTemplateRecord>();
    for (const tpl of SEED_PRESENTATION_TEMPLATES) map.set(tpl.id, tpl);
    for (const tpl of presentationTemplates) map.set(tpl.id, tpl);
    return Array.from(map.values()).filter((t) => t.enabled);
  }, [presentationTemplates]);

  const applyThemeToAllSlides = (newThemeId: string) => {
    setThemeId(newThemeId);
    const th = PRESENTATION_THEMES.find((t) => t.id === newThemeId) || PRESENTATION_THEMES[0];
    setSlides((prev) =>
      prev.map((s) => ({
        ...s,
        backgroundColor: s.layout === 'title' ? th.titleBgColor : th.bgColor,
        accentColor: th.accentColor,
        fontFamily: th.fontFamily,
        titleColor: s.layout === 'title' ? '#ffffff' : th.titleColor,
        textColor: s.layout === 'title' ? '#e2e8f0' : th.textColor,
      }))
    );
  };

  // AI Slide Generation via /api/presentation/generate
  const handleGenerateWithAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      showToast(language === 'bn' ? 'বিষয় লিখুন।' : 'Please enter a topic.', 'error');
      return;
    }
    setGenerating(true);
    try {
      const resp = await fetch(apiUrl('/api/presentation/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          classLevel,
          subject,
          language: deckLang,
          slideCount,
          level,
          audience,
          purpose,
        }),
      });
      const json = (await resp.json()) as {
        error?: string;
        title?: string;
        references?: string[];
        slides?: Array<{
          layout: string;
          title: string;
          subtitle?: string;
          speakerNotes?: string;
          bullets?: string[];
          diagramNodes?: string[];
          diagramType?: string;
          chartTitle?: string;
          chartType?: string;
          chartSeries?: Array<{ label: string; value: number }>;
          tableHeaders?: string[];
          tableRows?: string[][];
          calloutText?: string;
        }>;
      };

      if (!resp.ok || !json.slides || json.slides.length === 0) {
        throw new Error(json.error || 'Failed to generate slides');
      }

      const th = PRESENTATION_THEMES.find((t) => t.id === themeId) || PRESENTATION_THEMES[0];
      const mappedSlides: PresentationSlide[] = json.slides.map((raw, idx) => {
        const layout = (['title', 'content', 'two-column', 'diagram', 'chart', 'conclusion', 'references'].includes(
          raw.layout
        )
          ? raw.layout
          : 'content') as PresentationSlide['layout'];

        const elements: PresentationSlideElement[] = [];
        if (raw.bullets && raw.bullets.length > 0) {
          elements.push({
            id: `ai-el-${idx}-b`,
            kind: 'bullets',
            xPercent: 7,
            yPercent: 26,
            wPercent: raw.calloutText ? 54 : 86,
            hPercent: 60,
            bullets: raw.bullets,
            fontSize: 17,
            fontColor: layout === 'title' ? '#e2e8f0' : th.textColor,
            animation: 'slide-up',
          });
        }
        if (raw.calloutText) {
          elements.push({
            id: `ai-el-${idx}-c`,
            kind: 'shape',
            shapeType: 'rounded',
            xPercent: raw.bullets?.length ? 65 : 10,
            yPercent: 28,
            wPercent: raw.bullets?.length ? 28 : 80,
            hPercent: 40,
            text: raw.calloutText,
            fontSize: 14,
            bgColor: th.accentColor,
            fontColor: '#ffffff',
            animation: 'fade-in',
          });
        }
        if (raw.diagramNodes && raw.diagramNodes.length > 0) {
          elements.push({
            id: `ai-el-${idx}-d`,
            kind: 'diagram',
            xPercent: 6,
            yPercent: 32,
            wPercent: 88,
            hPercent: 45,
            diagramType: (raw.diagramType as 'process' | 'hierarchy' | 'cycle') || 'process',
            diagramNodes: raw.diagramNodes,
            bgColor: th.accentColor,
            fontColor: '#ffffff',
            animation: 'pop',
          });
        }
        if (raw.chartSeries && raw.chartSeries.length > 0) {
          elements.push({
            id: `ai-el-${idx}-ch`,
            kind: 'chart',
            xPercent: 8,
            yPercent: 26,
            wPercent: 84,
            hPercent: 62,
            chartType: (raw.chartType as 'bar' | 'line' | 'pie') || 'bar',
            chartTitle: raw.chartTitle || raw.title,
            chartSeries: raw.chartSeries,
            bgColor: th.accentColor,
            fontColor: th.textColor,
            animation: 'fade-in',
          });
        }
        if (raw.tableHeaders && raw.tableHeaders.length > 0 && raw.tableRows) {
          elements.push({
            id: `ai-el-${idx}-t`,
            kind: 'table',
            xPercent: 8,
            yPercent: 28,
            wPercent: 84,
            hPercent: 56,
            tableHeaders: raw.tableHeaders,
            tableRows: raw.tableRows,
            bgColor: th.accentColor,
            fontColor: th.textColor,
          });
        }
        if (layout === 'title' && elements.length === 0) {
          elements.push({
            id: `ai-el-${idx}-meta`,
            kind: 'text',
            xPercent: 8,
            yPercent: 64,
            wPercent: 84,
            hPercent: 18,
            text: `${classLevel} · ${subject}${audience ? ` · ${audience}` : ''}`,
            fontSize: 15,
            fontColor: '#cbd5e1',
          });
        }

        return {
          id: `slide-${Date.now()}-${idx}`,
          order: idx,
          layout,
          title: raw.title,
          subtitle: raw.subtitle || '',
          backgroundColor: layout === 'title' ? th.titleBgColor : th.bgColor,
          accentColor: th.accentColor,
          fontFamily: th.fontFamily,
          titleColor: layout === 'title' ? '#ffffff' : th.titleColor,
          textColor: layout === 'title' ? '#e2e8f0' : th.textColor,
          transition: 'fade',
          speakerNotes: raw.speakerNotes || '',
          elements,
        };
      });

      setDeckId(undefined);
      setTitle(json.title || topic);
      setReferences(json.references || []);
      setSlides(mappedSlides);
      setActiveSlideIdx(0);
      setSelectedElId(null);
      setTab('studio');
      showToast(
        language === 'bn' ? `${mappedSlides.length}টি স্লাইড এআই দিয়ে তৈরি হয়েছে!` : `Generated ${mappedSlides.length} slides!`,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI slide generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Slide Mutations
  const updateActiveSlide = (patch: Partial<PresentationSlide>) => {
    setSlides((prev) => prev.map((s, i) => (i === activeSlideIdx ? { ...s, ...patch } : s)));
  };

  const handleAddSlide = () => {
    const th = PRESENTATION_THEMES.find((t) => t.id === themeId) || PRESENTATION_THEMES[0];
    const newSlide: PresentationSlide = {
      id: `slide-${Date.now()}`,
      order: slides.length,
      layout: 'content',
      title: language === 'bn' ? 'নতুন স্লাইড শিরোনাম' : 'New Slide Title',
      subtitle: '',
      backgroundColor: th.bgColor,
      accentColor: th.accentColor,
      fontFamily: th.fontFamily,
      titleColor: th.titleColor,
      textColor: th.textColor,
      transition: 'fade',
      speakerNotes: '',
      elements: [
        {
          id: `el-${Date.now()}`,
          kind: 'bullets',
          xPercent: 7,
          yPercent: 26,
          wPercent: 86,
          hPercent: 55,
          bullets: [
            language === 'bn' ? 'প্রথম পয়েন্ট লিখুন' : 'First key point',
            language === 'bn' ? 'দ্বিতীয় পয়েন্ট লিখুন' : 'Second key point',
          ],
          fontSize: 17,
          fontColor: th.textColor,
          animation: 'fade-in',
        },
      ],
    };
    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideIdx(slides.length);
    setSelectedElId(null);
  };

  const handleDuplicateSlide = () => {
    const copy: PresentationSlide = {
      ...JSON.parse(JSON.stringify(activeSlide)),
      id: `slide-${Date.now()}`,
    };
    const next = [...slides];
    next.splice(activeSlideIdx + 1, 0, copy);
    setSlides(next.map((s, i) => ({ ...s, order: i })));
    setActiveSlideIdx(activeSlideIdx + 1);
  };

  const handleDeleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i }));
    setSlides(next);
    setActiveSlideIdx(Math.max(0, Math.min(idx, next.length - 1)));
    setSelectedElId(null);
  };

  const handleMoveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    setSlides(next.map((s, i) => ({ ...s, order: i })));
    setActiveSlideIdx(target);
  };

  // Element Mutations
  const addElementToSlide = (kind: PresentationSlideElement['kind'], extra?: Partial<PresentationSlideElement>) => {
    const th = PRESENTATION_THEMES.find((t) => t.id === themeId) || PRESENTATION_THEMES[0];
    const el: PresentationSlideElement = {
      id: `el-${Date.now()}`,
      kind,
      xPercent: 8,
      yPercent: 28,
      wPercent: kind === 'shape' ? 35 : 80,
      hPercent: kind === 'shape' ? 28 : 48,
      fontSize: 16,
      fontColor: activeSlide.textColor,
      bgColor: th.accentColor,
      animation: 'fade-in',
      ...(kind === 'text' ? { text: language === 'bn' ? 'নতুন টেক্সট বক্স' : 'Editable text block' } : {}),
      ...(kind === 'bullets' ? { bullets: ['Point 1', 'Point 2', 'Point 3'] } : {}),
      ...(kind === 'shape' ? { shapeType: 'rounded', text: 'Callout / Box', fontColor: '#ffffff' } : {}),
      ...(kind === 'diagram' ? { diagramType: 'process', diagramNodes: ['Step 1', 'Step 2', 'Step 3'], fontColor: '#ffffff' } : {}),
      ...(kind === 'chart'
        ? {
            chartType: 'bar',
            chartTitle: 'Sample Data',
            chartSeries: [
              { label: 'A', value: 40 },
              { label: 'B', value: 75 },
              { label: 'C', value: 55 },
            ],
          }
        : {}),
      ...(kind === 'table'
        ? {
            tableHeaders: ['Parameter', 'Value', 'Unit'],
            tableRows: [
              ['Item 1', '25', 'kW'],
              ['Item 2', '40', 'A'],
            ],
          }
        : {}),
      ...extra,
    };
    updateActiveSlide({ elements: [...activeSlide.elements, el] });
    setSelectedElId(el.id);
  };

  const updateSelectedElement = (patch: Partial<PresentationSlideElement>) => {
    if (!selectedElId) return;
    updateActiveSlide({
      elements: activeSlide.elements.map((el) => (el.id === selectedElId ? { ...el, ...patch } : el)),
    });
  };

  const deleteSelectedElement = () => {
    if (!selectedElId) return;
    updateActiveSlide({
      elements: activeSlide.elements.filter((el) => el.id !== selectedElId),
    });
    setSelectedElId(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        addElementToSlide('image', {
          imageDataUrl: reader.result,
          imageCaption: file.name,
          wPercent: 45,
          hPercent: 52,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const buildDeckPayload = (): PresentationRecord => ({
    id: deckId || `pres-local`,
    userId: user?.uid || 'guest',
    title: title.trim() || 'Presentation',
    topic: topic.trim() || title,
    classLevel,
    subject,
    language: deckLang,
    level,
    themeId,
    audience,
    purpose,
    slides,
    references,
    sharedWithLink: false,
  });

  const handleSaveCloud = async () => {
    if (!user) {
      showToast(language === 'bn' ? 'ক্লাউডে সেভ করতে সাইন-ইন করুন।' : 'Sign in to save presentation.', 'info');
      return;
    }
    const id = await savePresentation({
      id: deckId,
      title: title.trim() || 'Presentation',
      topic: topic.trim() || title,
      classLevel,
      subject,
      language: deckLang,
      level,
      themeId,
      audience,
      purpose,
      slides,
      references,
      sharedWithLink: false,
    });
    if (id) setDeckId(id);
  };

  const handleExportPptx = async () => {
    const deck = buildDeckPayload();
    await exportPresentationToPptx(deck);
    if (user) {
      await logUserExport({ module: 'presentation', title: deck.title, format: 'pptx' });
    }
    showToast(language === 'bn' ? 'PowerPoint (.pptx) ডাউনলোড সম্পন্ন!' : 'Exported .pptx cleanly!', 'success');
  };

  const handleExportPdf = async () => {
    const deck = buildDeckPayload();
    await exportPresentationToPdf(deck);
    if (user) {
      await logUserExport({ module: 'presentation', title: deck.title, format: 'pdf' });
    }
  };

  const renderSlideElementVisual = (el: PresentationSlideElement, slide: PresentationSlide, interactive: boolean) => {
    const isSel = interactive && el.id === selectedElId;
    return (
      <div
        key={el.id}
        onClick={(ev) => {
          if (!interactive) return;
          ev.stopPropagation();
          setSelectedElId(el.id);
        }}
        style={{
          position: 'absolute',
          left: `${el.xPercent}%`,
          top: `${el.yPercent}%`,
          width: `${el.wPercent}%`,
          height: `${el.hPercent}%`,
          color: el.fontColor || slide.textColor,
          fontSize: `${el.fontSize || 15}px`,
          textAlign: el.align || 'left',
        }}
        className={`p-2 rounded-lg transition-all ${
          interactive ? 'cursor-pointer hover:ring-2 hover:ring-blue-400/70' : ''
        } ${isSel ? 'ring-2 ring-blue-600 bg-blue-500/5' : ''}`}
      >
        {el.kind === 'text' && (
          <p className={`whitespace-pre-wrap leading-snug ${el.bold ? 'font-bold' : ''}`}>{el.text}</p>
        )}

        {el.kind === 'bullets' && (
          <ul className="list-disc pl-5 space-y-1.5 leading-snug">
            {(el.bullets || []).map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}

        {el.kind === 'shape' && (
          <div
            style={{
              backgroundColor: el.bgColor || slide.accentColor,
              color: el.fontColor || '#ffffff',
            }}
            className={`w-full h-full flex items-center justify-center p-3 text-center font-medium ${
              el.shapeType === 'circle' ? 'rounded-full' : el.shapeType === 'rounded' ? 'rounded-xl' : 'rounded'
            }`}
          >
            {el.text}
          </div>
        )}

        {el.kind === 'diagram' && (
          <div className="w-full h-full flex items-center justify-around gap-2 flex-wrap">
            {(el.diagramNodes || []).map((node, i, arr) => (
              <React.Fragment key={i}>
                <div
                  style={{ backgroundColor: el.bgColor || slide.accentColor }}
                  className="px-3 py-2.5 rounded-lg text-white text-xs font-semibold text-center min-w-[85px] shadow-sm"
                >
                  {node}
                </div>
                {i < arr.length - 1 && <span className="text-sm font-bold opacity-60">→</span>}
              </React.Fragment>
            ))}
          </div>
        )}

        {el.kind === 'chart' && (
          <div className="w-full h-full rounded-lg border border-slate-300/40 bg-white/85 text-slate-900 p-3 flex flex-col justify-between">
            {el.chartTitle && <p className="text-xs font-bold text-center">{el.chartTitle}</p>}
            <div className="flex-1 flex items-end justify-around gap-2 pt-3 pb-1 px-2">
              {(() => {
                const maxV = Math.max(1, ...(el.chartSeries || []).map((c) => Math.abs(c.value)));
                return (el.chartSeries || []).map((c, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1 flex-1 h-full justify-end">
                    <span className="text-[10px] font-mono-tabular font-semibold">{c.value}</span>
                    <div
                      style={{
                        height: `${Math.max(10, (Math.abs(c.value) / maxV) * 80)}%`,
                        backgroundColor: el.bgColor || slide.accentColor,
                      }}
                      className="w-full max-w-[44px] rounded-t"
                    />
                    <span className="text-[10px] truncate max-w-[60px]">{c.label}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {el.kind === 'table' && (
          <div className="w-full h-full overflow-auto rounded border border-slate-300/60 bg-white text-slate-900">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr style={{ backgroundColor: el.bgColor || slide.accentColor }} className="text-white">
                  {(el.tableHeaders || []).map((h, i) => (
                    <th key={i} className="px-2 py-1 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(el.tableRows || []).map((row, ri) => (
                  <tr key={ri} className="border-t border-slate-200">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {el.kind === 'image' && el.imageDataUrl && (
          <img
            src={el.imageDataUrl}
            alt={el.imageCaption || 'Slide visual'}
            className="w-full h-full object-contain rounded"
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Presentation className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {language === 'bn' ? 'স্টুডেন্ট প্রেজেন্টেশন মেকার' : 'Student Presentation Maker'}
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {language === 'bn'
              ? 'ক্লাস ১–১০, কলেজ ও বিশ্ববিদ্যালয়ের জন্য এআই স্লাইড জেনারেটর, ভিজ্যুয়াল এডিটর ও .pptx / PDF এক্সপোর্ট।'
              : 'AI-powered academic slide creator for Classes 1–10, College & University with visual editor and PowerPoint/PDF export.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('studio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              tab === 'studio' ? 'bg-blue-700 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            {language === 'bn' ? 'স্লাইড এডিটর' : 'Slide Editor'}
          </button>
          <button
            type="button"
            onClick={() => setTab('ai')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              tab === 'ai' ? 'bg-blue-700 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'এআই স্লাইড তৈরি' : 'AI Generator'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('templates')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              tab === 'templates' ? 'bg-blue-700 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? `টেমপ্লেট (${allTemplates.length})` : `Templates (${allTemplates.length})`}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('saved')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              tab === 'saved' ? 'bg-blue-700 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? `সংরক্ষিত (${presentations.length})` : `Saved (${presentations.length})`}</span>
          </button>
        </div>
      </div>

      {/* AI GENERATOR TAB */}
      {tab === 'ai' && (
        <form
          onSubmit={handleGenerateWithAi}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 max-w-3xl mx-auto space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>{language === 'bn' ? 'এআই দিয়ে পূর্ণাঙ্গ প্রেজেন্টেশন তৈরি করুন' : 'Generate Complete Presentation with AI'}</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-medium mb-1">{language === 'bn' ? 'প্রেজেন্টেশনের বিষয় (Topic)' : 'Presentation Topic'}</label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={language === 'bn' ? 'যেমন: নিউটনের গতিসূত্র ও বাস্তব প্রয়োগ' : 'e.g. Photosynthesis Process & Factors'}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">{language === 'bn' ? 'শ্রেণি / স্তর' : 'Class / Level'}</label>
              <select value={classLevel} onChange={(e) => setClassLevel(e.target.value as PresentationClassLevel)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2">
                {CLASS_LEVELS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">{language === 'bn' ? 'বিষয় (Subject)' : 'Subject'}</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2">
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">{language === 'bn' ? 'ভাষা' : 'Presentation Language'}</label>
              <select value={deckLang} onChange={(e) => setDeckLang(e.target.value as Language)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2">
                <option value="bn">বাংলা (Bangla)</option>
                <option value="en">English</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">{language === 'bn' ? 'স্লাইড সংখ্যা' : 'Slide Count'}</label>
              <input type="number" min={4} max={20} value={slideCount} onChange={(e) => setSlideCount(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2" />
            </div>

            <div>
              <label className="block font-medium mb-1">{language === 'bn' ? 'গভীরতা' : 'Detail Depth'}</label>
              <select value={level} onChange={(e) => setLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced')} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2">
                <option value="beginner">{language === 'bn' ? 'সহজ (Beginner)' : 'Beginner'}</option>
                <option value="intermediate">{language === 'bn' ? 'মাধ্যমিক (Intermediate)' : 'Intermediate'}</option>
                <option value="advanced">{language === 'bn' ? 'উচ্চতর (Advanced)' : 'Advanced'}</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">{language === 'bn' ? 'ভিজ্যুয়াল থিম' : 'Visual Theme'}</label>
              <select value={themeId} onChange={(e) => setThemeId(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2">
                {PRESENTATION_THEMES.map((t) => (
                  <option key={t.id} value={t.id}>{language === 'bn' ? t.nameBn : t.nameEn}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">{language === 'bn' ? 'শ্রোতা (Audience)' : 'Audience'}</label>
              <input type="text" value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2" />
            </div>

            <div>
              <label className="block font-medium mb-1">{language === 'bn' ? 'উদ্দেশ্য (Purpose)' : 'Purpose'}</label>
              <input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {generating
                ? language === 'bn'
                  ? 'এআই স্লাইড তৈরি হচ্ছে...'
                  : 'Generating Slides...'
                : language === 'bn'
                  ? 'স্লাইড ডেক তৈরি করুন'
                  : 'Generate Slide Deck'}
            </span>
          </button>
        </form>
      )}

      {/* TEMPLATES TAB */}
      {tab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase text-blue-700 dark:text-blue-400">
                  {tpl.category} · {tpl.classLevel}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'bn' ? tpl.nameBn : tpl.nameEn}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {language === 'bn' ? tpl.descriptionBn : tpl.descriptionEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeckId(undefined);
                  setTitle(language === 'bn' ? tpl.nameBn : tpl.nameEn);
                  setSubject(tpl.subject);
                  setClassLevel(tpl.classLevel);
                  setThemeId(tpl.themeId);
                  setSlides(JSON.parse(JSON.stringify(tpl.slides)));
                  setActiveSlideIdx(0);
                  setSelectedElId(null);
                  setTab('studio');
                }}
                className="w-full rounded-lg bg-blue-700 py-2 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
              >
                {language === 'bn' ? 'টেমপ্লেট খুলুন' : 'Use Template'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SAVED DECKS TAB */}
      {tab === 'saved' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {language === 'bn' ? 'সংরক্ষিত প্রেজেন্টেশনসমূহ' : 'Saved Presentations'}
          </h2>
          {!user ? (
            <p className="text-xs text-slate-500">
              {language === 'bn' ? 'সংরক্ষিত প্রেজেন্টেশন দেখতে সাইন-ইন করুন।' : 'Sign in to access saved decks.'}
            </p>
          ) : presentations.length === 0 ? (
            <p className="text-xs text-slate-500">
              {language === 'bn' ? 'এখনো কোনো প্রেজেন্টেশন সংরক্ষণ করা হয়নি।' : 'No presentations saved yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {presentations.map((deck) => (
                <div key={deck.id} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{deck.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {deck.classLevel} · {deck.subject} · {deck.slides.length} slides
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeckId(deck.id);
                        setTitle(deck.title);
                        setTopic(deck.topic);
                        setClassLevel(deck.classLevel);
                        setSubject(deck.subject);
                        setThemeId(deck.themeId);
                        setSlides(JSON.parse(JSON.stringify(deck.slides)));
                        setReferences(deck.references || []);
                        setActiveSlideIdx(0);
                        setSelectedElId(null);
                        setTab('studio');
                      }}
                      className="flex-1 rounded-lg bg-blue-700 py-1.5 text-xs font-medium text-white cursor-pointer"
                    >
                      {language === 'bn' ? 'এডিট করুন' : 'Open'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePresentation(deck.id)}
                      className="p-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SLIDE EDITOR STUDIO */}
      {tab === 'studio' && activeSlide && (
        <div className="space-y-3">
          {/* Top Action Toolbar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-2 no-print">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-56 sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold"
              />
              <select
                value={themeId}
                onChange={(e) => applyThemeToAllSlides(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
              >
                {PRESENTATION_THEMES.map((th) => (
                  <option key={th.id} value={th.id}>{language === 'bn' ? th.nameBn : th.nameEn}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSaveCloud}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'সংরক্ষণ' : 'Save'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPresenterMode(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'স্লাইডশো' : 'Present'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportPptx}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.PPTX</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>.PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Print"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3-Pane Studio */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Slide Thumbnail List */}
            <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2 no-print">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {language === 'bn' ? `স্লাইডসমূহ (${slides.length})` : `Slides (${slides.length})`}
                </span>
                <button
                  type="button"
                  onClick={handleAddSlide}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 px-2 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{language === 'bn' ? 'নতুন' : 'Add'}</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {slides.map((sl, idx) => (
                  <div
                    key={sl.id}
                    onClick={() => {
                      setActiveSlideIdx(idx);
                      setSelectedElId(null);
                    }}
                    className={`rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      idx === activeSlideIdx
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-bold text-slate-500 tabular-nums">#{idx + 1}</span>
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => handleMoveSlide(idx, -1)} className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => handleMoveSlide(idx, 1)} className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => { setActiveSlideIdx(idx); handleDuplicateSlide(); }} className="p-0.5 text-slate-400 hover:text-blue-600 cursor-pointer">
                          <Copy className="w-3 h-3" />
                        </button>
                        {slides.length > 1 && (
                          <button type="button" onClick={() => handleDeleteSlide(idx)} className="p-0.5 text-slate-400 hover:text-red-600 cursor-pointer">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{sl.title}</p>
                    <p className="text-[10px] text-slate-500 uppercase">{sl.layout}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Center 16:9 Canvas + Speaker Notes */}
            <div className="lg:col-span-6 space-y-3">
              {/* Add Element Strip */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 flex flex-wrap items-center gap-1.5 no-print">
                <button type="button" onClick={() => addElementToSlide('text')} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <Type className="w-3 h-3" /> Text
                </button>
                <button type="button" onClick={() => addElementToSlide('bullets')} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <List className="w-3 h-3" /> Bullets
                </button>
                <button type="button" onClick={() => addElementToSlide('shape')} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <Shapes className="w-3 h-3" /> Shape
                </button>
                <button type="button" onClick={() => addElementToSlide('diagram')} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <Network className="w-3 h-3" /> Diagram
                </button>
                <button type="button" onClick={() => addElementToSlide('chart')} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <BarChart2 className="w-3 h-3" /> Chart
                </button>
                <button type="button" onClick={() => addElementToSlide('table')} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <Table className="w-3 h-3" /> Table
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <button type="button" onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <ImagePlus className="w-3 h-3" /> Image
                </button>
              </div>

              {/* 16:9 Slide Canvas */}
              <div
                onClick={() => setSelectedElId(null)}
                style={{
                  backgroundColor: activeSlide.backgroundColor,
                  fontFamily: activeSlide.fontFamily,
                }}
                className="relative w-full aspect-video rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                <div style={{ backgroundColor: activeSlide.accentColor }} className="absolute top-0 inset-x-0 h-1.5" />

                <div className={`px-[6%] ${activeSlide.layout === 'title' ? 'pt-[16%]' : 'pt-[4.5%]'}`}>
                  <h2
                    style={{ color: activeSlide.titleColor }}
                    className={`font-bold leading-tight ${activeSlide.layout === 'title' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}`}
                  >
                    {activeSlide.title}
                  </h2>
                  {activeSlide.subtitle && (
                    <p style={{ color: activeSlide.accentColor }} className="text-xs sm:text-sm mt-1 font-medium">
                      {activeSlide.subtitle}
                    </p>
                  )}
                </div>

                {activeSlide.elements.map((el) => renderSlideElementVisual(el, activeSlide, true))}

                <div className="absolute bottom-2 right-3 text-[10px] opacity-60 tabular-nums" style={{ color: activeSlide.textColor }}>
                  {activeSlideIdx + 1} / {slides.length}
                </div>
              </div>

              {/* Speaker Notes */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-1.5 no-print">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {language === 'bn' ? 'স্পিকার নোটস (উপস্থাপকের নোট)' : 'Speaker Notes'}
                </label>
                <textarea
                  rows={2}
                  value={activeSlide.speakerNotes || ''}
                  onChange={(e) => updateActiveSlide({ speakerNotes: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
              </div>
            </div>

            {/* Right Slide & Element Inspector */}
            <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4 no-print">
              <div className="space-y-2.5 text-xs">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {language === 'bn' ? 'স্লাইড সেটিংস' : 'Slide Properties'}
                </h3>
                <div>
                  <label className="block text-[11px] font-medium mb-1">{language === 'bn' ? 'শিরোনাম' : 'Title'}</label>
                  <input
                    type="text"
                    value={activeSlide.title}
                    onChange={(e) => updateActiveSlide({ title: e.target.value })}
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">{language === 'bn' ? 'উপ-শিরোনাম' : 'Subtitle'}</label>
                  <input
                    type="text"
                    value={activeSlide.subtitle || ''}
                    onChange={(e) => updateActiveSlide({ subtitle: e.target.value })}
                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Layout</label>
                    <select
                      value={activeSlide.layout}
                      onChange={(e) => updateActiveSlide({ layout: e.target.value as PresentationSlide['layout'] })}
                      className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1"
                    >
                      <option value="title">Title</option>
                      <option value="content">Content</option>
                      <option value="two-column">Two Column</option>
                      <option value="diagram">Diagram</option>
                      <option value="chart">Chart</option>
                      <option value="conclusion">Conclusion</option>
                      <option value="references">References</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1">Transition</label>
                    <select
                      value={activeSlide.transition}
                      onChange={(e) => updateActiveSlide({ transition: e.target.value as PresentationTransition })}
                      className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1"
                    >
                      <option value="none">None</option>
                      <option value="fade">Fade</option>
                      <option value="slide">Slide</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </div>
                </div>
              </div>

              {selectedElement && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-blue-700 dark:text-blue-400">
                      {language === 'bn' ? 'নির্বাচিত এলিমেন্ট' : 'Selected Element'} ({selectedElement.kind})
                    </h4>
                    <button type="button" onClick={deleteSelectedElement} className="text-red-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {(selectedElement.kind === 'text' || selectedElement.kind === 'shape') && (
                    <textarea
                      rows={3}
                      value={selectedElement.text || ''}
                      onChange={(e) => updateSelectedElement({ text: e.target.value })}
                      className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                    />
                  )}

                  {selectedElement.kind === 'bullets' && (
                    <div>
                      <label className="block text-[11px] mb-1">{language === 'bn' ? 'প্রতি লাইনে একটি পয়েন্ট' : 'One bullet per line'}</label>
                      <textarea
                        rows={4}
                        value={(selectedElement.bullets || []).join('\n')}
                        onChange={(e) => updateSelectedElement({ bullets: e.target.value.split('\n') })}
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                      />
                    </div>
                  )}

                  {selectedElement.kind === 'diagram' && (
                    <div>
                      <label className="block text-[11px] mb-1">Nodes (comma separated)</label>
                      <input
                        type="text"
                        value={(selectedElement.diagramNodes || []).join(', ')}
                        onChange={(e) =>
                          updateSelectedElement({ diagramNodes: e.target.value.split(',').map((s) => s.trim()) })
                        }
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                      />
                    </div>
                  )}

                  {selectedElement.kind === 'chart' && (
                    <div>
                      <label className="block text-[11px] mb-1">Series (Label:Value per line)</label>
                      <textarea
                        rows={3}
                        value={(selectedElement.chartSeries || []).map((c) => `${c.label}:${c.value}`).join('\n')}
                        onChange={(e) => {
                          const series = e.target.value
                            .split('\n')
                            .map((line) => {
                              const [l, v] = line.split(':');
                              return { label: (l || '').trim(), value: Number(v) || 0 };
                            })
                            .filter((x) => x.label);
                          updateSelectedElement({ chartSeries: series });
                        }}
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] mb-1">X / Y (%)</label>
                      <div className="flex gap-1">
                        <input type="number" value={selectedElement.xPercent} onChange={(e) => updateSelectedElement({ xPercent: Number(e.target.value) })} className="w-1/2 rounded border border-slate-200 dark:border-slate-700 px-1.5 py-1" />
                        <input type="number" value={selectedElement.yPercent} onChange={(e) => updateSelectedElement({ yPercent: Number(e.target.value) })} className="w-1/2 rounded border border-slate-200 dark:border-slate-700 px-1.5 py-1" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] mb-1">W / H (%)</label>
                      <div className="flex gap-1">
                        <input type="number" value={selectedElement.wPercent} onChange={(e) => updateSelectedElement({ wPercent: Number(e.target.value) })} className="w-1/2 rounded border border-slate-200 dark:border-slate-700 px-1.5 py-1" />
                        <input type="number" value={selectedElement.hPercent} onChange={(e) => updateSelectedElement({ hPercent: Number(e.target.value) })} className="w-1/2 rounded border border-slate-200 dark:border-slate-700 px-1.5 py-1" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] mb-1">Animation</label>
                    <select
                      value={selectedElement.animation || 'none'}
                      onChange={(e) => updateSelectedElement({ animation: e.target.value as PresentationAnimation })}
                      className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1"
                    >
                      <option value="none">None</option>
                      <option value="fade-in">Fade In</option>
                      <option value="slide-up">Slide Up</option>
                      <option value="pop">Pop</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN PRESENTER OVERLAY */}
      {presenterMode && activeSlide && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4 sm:p-8">
          <div className="flex items-center justify-between text-white/80 text-xs">
            <span>{title} — {activeSlideIdx + 1} / {slides.length}</span>
            <button
              type="button"
              onClick={() => setPresenterMode(false)}
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20 cursor-pointer"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'বন্ধ করুন' : 'Exit'}</span>
            </button>
          </div>

          <div
            style={{ backgroundColor: activeSlide.backgroundColor, fontFamily: activeSlide.fontFamily }}
            className="relative w-full max-w-5xl mx-auto aspect-video rounded-xl overflow-hidden shadow-2xl"
          >
            <div style={{ backgroundColor: activeSlide.accentColor }} className="absolute top-0 inset-x-0 h-2" />
            <div className={`px-[6%] ${activeSlide.layout === 'title' ? 'pt-[16%]' : 'pt-[5%]'}`}>
              <h2
                style={{ color: activeSlide.titleColor }}
                className={`font-bold ${activeSlide.layout === 'title' ? 'text-4xl' : 'text-2xl sm:text-3xl'}`}
              >
                {activeSlide.title}
              </h2>
              {activeSlide.subtitle && (
                <p style={{ color: activeSlide.accentColor }} className="text-base mt-1 font-medium">
                  {activeSlide.subtitle}
                </p>
              )}
            </div>
            {activeSlide.elements.map((el) => renderSlideElementVisual(el, activeSlide, false))}
          </div>

          <div className="flex items-center justify-between max-w-5xl mx-auto w-full text-white text-xs gap-4">
            <button
              type="button"
              disabled={activeSlideIdx === 0}
              onClick={() => setActiveSlideIdx((i) => Math.max(0, i - 1))}
              className="rounded-lg bg-white/15 px-4 py-2 disabled:opacity-30 cursor-pointer"
            >
              ← {language === 'bn' ? 'পূর্ববর্তী' : 'Previous'}
            </button>
            <p className="text-white/70 truncate text-center flex-1">{activeSlide.speakerNotes}</p>
            <button
              type="button"
              disabled={activeSlideIdx >= slides.length - 1}
              onClick={() => setActiveSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
              className="rounded-lg bg-blue-600 px-4 py-2 disabled:opacity-30 cursor-pointer"
            >
              {language === 'bn' ? 'পরবর্তী' : 'Next'} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
