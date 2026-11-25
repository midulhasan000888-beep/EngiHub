import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Send,
  ThumbsUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SuggestionCategory } from '../../types';

const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  'New Feature Request',
  'Calculator Improvement',
  'Formula Request',
  'Engineering Feature',
  'Excel Feature',
  'Presentation Feature',
  'PDF Feature',
  'Translation Improvement',
  'Dictionary Improvement',
  'Bug Report',
  'Design Improvement',
  'Other Suggestions',
];

const RELATED_MODULES = [
  'General Platform',
  'Normal Calculator',
  'Scientific & Math Suite',
  'Engineering Calculators',
  'AI PDF Analyzer',
  'Report Designer',
  'Excel Generator',
  'Presentation Maker',
  'Google Translate',
  'Smart Dictionary',
  'Class 1-10 Formula Library',
  'Currency Calculator',
  'User Profile',
];

async function compressAttachment(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

export const SuggestionFeedbackView: React.FC = () => {
  const {
    user,
    language,
    appSettings,
    suggestions,
    suggestionVotes,
    submitSuggestion,
    toggleSuggestionVote,
    signInWithGoogle,
    showToast,
  } = useApp();

  const enabled = appSettings.moduleFlags?.suggestionsEnabled !== false;

  const [tab, setTab] = useState<'submit' | 'my' | 'public'>('submit');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<SuggestionCategory>('New Feature Request');
  const [relatedModule, setRelatedModule] = useState('General Platform');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState('');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [publicSort, setPublicSort] = useState<'votes' | 'newest'>('votes');

  const votedIds = useMemo(
    () => new Set(suggestionVotes.map((v) => v.suggestionId)),
    [suggestionVotes]
  );

  const mySuggestions = useMemo(
    () => (user ? suggestions.filter((s) => s.userId === user.uid) : []),
    [suggestions, user]
  );

  const publicSuggestions = useMemo(() => {
    const pub = suggestions.filter((s) => s.visibility === 'public');
    return [...pub].sort((a, b) => {
      if (publicSort === 'votes') return (b.voteCount || 0) - (a.voteCount || 0);
      const ta = (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() || 0;
      const tb = (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() || 0;
      return tb - ta;
    });
  }, [publicSort, suggestions]);

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await compressAttachment(file);
      if (dataUrl.length > 350000) {
        showToast('Image too large after compression. Please pick a smaller screenshot.', 'error');
        return;
      }
      setAttachmentDataUrl(dataUrl);
    } catch {
      showToast('Could not process attachment image.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      await signInWithGoogle();
      return;
    }
    if (!title.trim() || !description.trim()) {
      showToast(language === 'bn' ? 'শিরোনাম ও বিবরণ লিখুন' : 'Please enter title and description', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const id = await submitSuggestion({
        title: title.trim(),
        category,
        relatedModule,
        priority,
        visibility,
        description: description.trim(),
        attachmentDataUrl: attachmentDataUrl || undefined,
      });
      if (id) {
        setTitle('');
        setDescription('');
        setAttachmentDataUrl('');
        setTab('my');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!enabled) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-6 text-center">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
          {language === 'bn' ? 'পরামর্শ ও মতামত মডিউলটি বর্তমানে বন্ধ রয়েছে' : 'Suggestion & Feedback module is disabled'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
          <MessageSquarePlus className="w-6 h-6 text-blue-700 dark:text-blue-400 shrink-0" />
          <span>{language === 'bn' ? 'পরামর্শ, ফিচার অনুরোধ ও মতামত' : 'Suggestions, Feature Requests & Feedback'}</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          {language === 'bn'
            ? 'নতুন ফিচারের প্রস্তাব দিন, বাগ রিপোর্ট করুন, অ্যাডমিনের উত্তর দেখুন এবং জনপ্রিয় ফিচারে ভোট দিন।'
            : 'Propose new features, report issues, track admin responses, and upvote community requests.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setTab('submit')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'submit' ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {language === 'bn' ? 'নতুন পরামর্শ পাঠান' : 'Submit Suggestion'}
        </button>
        <button
          type="button"
          onClick={() => setTab('my')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'my' ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {language === 'bn' ? `আমার পরামর্শ (${mySuggestions.length})` : `My Submissions (${mySuggestions.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTab('public')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'public' ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {language === 'bn' ? `পাবলিক ভোটিং বোর্ড (${publicSuggestions.length})` : `Public Requests (${publicSuggestions.length})`}
        </button>
      </div>

      {tab === 'submit' && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 max-w-3xl"
        >
          {!user && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-3 flex items-center justify-between gap-3 text-xs">
              <span>{language === 'bn' ? 'পরামর্শ পাঠাতে Google দিয়ে সাইন-ইন করুন।' : 'Sign in with Google to submit a suggestion and receive status updates.'}</span>
              <button type="button" onClick={signInWithGoogle} className="rounded-lg bg-blue-700 px-3 py-1.5 text-white font-medium cursor-pointer">
                Sign In
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1">
              {language === 'bn' ? 'শিরোনাম *' : 'Suggestion Title *'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={language === 'bn' ? 'যেমন: ইলেকট্রিক্যাল মোটর স্টার্টার ক্যালকুলেটর যুক্ত করুন' : 'e.g., Add Motor Starter Breaker Sizing Calculator'}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SuggestionCategory)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
              >
                {SUGGESTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Related Module</label>
              <select
                value={relatedModule}
                onChange={(e) => setRelatedModule(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
              >
                {RELATED_MODULES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
              >
                <option value="public">Public (Allow Votes)</option>
                <option value="private">Private (Admin Only)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              {language === 'bn' ? 'বিস্তারিত বিবরণ *' : 'Detailed Description *'}
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === 'bn' ? 'আপনার আইডিয়া বা সমস্যার বিস্তারিত লিখুন...' : 'Describe your suggestion, formula details, or bug steps...'}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              <ImagePlus className="w-3.5 h-3.5 text-blue-600" />
              <span>{attachmentDataUrl ? 'Screenshot Attached (Replace)' : 'Attach Screenshot (Optional)'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  void handleFileChange(e.target.files?.[0]);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{language === 'bn' ? 'পরামর্শ জমা দিন' : 'Submit Suggestion'}</span>
            </button>
          </div>

          {attachmentDataUrl && (
            <div className="pt-2">
              <img src={attachmentDataUrl} alt="Attachment preview" className="max-h-40 rounded-lg border border-slate-200 dark:border-slate-700" />
            </div>
          )}
        </form>
      )}

      {tab === 'my' && (
        <div className="space-y-3">
          {mySuggestions.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500">
              {language === 'bn' ? 'আপনি এখনো কোনো পরামর্শ পাঠাননি।' : 'You have not submitted any suggestions yet.'}
            </div>
          ) : (
            mySuggestions.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{s.title}</h3>
                    <p className="text-[11px] text-slate-500">
                      {s.category} · {s.relatedModule} · Priority: {s.priority.toUpperCase()} · {s.visibility}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      s.status === 'Completed'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : s.status === 'Rejected'
                          ? 'text-red-600'
                          : 'text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{s.description}</p>
                {s.attachmentDataUrl && (
                  <img src={s.attachmentDataUrl} alt="Screenshot" className="max-h-40 rounded-lg border border-slate-200 dark:border-slate-700" />
                )}
                {s.adminReply && (
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'অ্যাডমিন উত্তর:' : 'Admin Response:'}</span>
                    </p>
                    <p>{s.adminReply}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'public' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {language === 'bn' ? 'পছন্দের ফিচার রিকোয়েস্টে ভোট দিন (ইউজার প্রতি ১টি ভোট)' : 'Upvote public feature requests (1 vote per user per request)'}
            </p>
            <select
              value={publicSort}
              onChange={(e) => setPublicSort(e.target.value as 'votes' | 'newest')}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
            >
              <option value="votes">Most Voted</option>
              <option value="newest">Newest First</option>
            </select>
          </div>

          {publicSuggestions.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500">
              No public feature requests yet.
            </div>
          ) : (
            <div className="space-y-3">
              {publicSuggestions.map((s) => {
                const hasVoted = votedIds.has(s.id);
                return (
                  <div key={s.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{s.title}</h3>
                        <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">[{s.status}]</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {s.category} · {s.relatedModule} · by {s.userName}
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{s.description}</p>
                      {s.adminReply && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 pt-1">
                          Admin: {s.adminReply}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void toggleSuggestionVote(s)}
                      className={`shrink-0 flex flex-col items-center justify-center min-w-[58px] rounded-xl border px-3 py-2 text-xs font-mono-tabular cursor-pointer transition-colors ${
                        hasVoted
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <ThumbsUp className={`w-4 h-4 mb-0.5 ${hasVoted ? 'fill-blue-600 text-blue-600' : ''}`} />
                      <span>{s.voteCount || 0}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
