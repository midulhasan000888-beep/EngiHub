import React, { useEffect, useMemo, useState } from 'react';
import { ImagePlus, MapPin, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SmartNotepadView: React.FC = () => {
  const {
    user,
    language,
    notes,
    events,
    pendingNoteDraft,
    setPendingNoteDraft,
    saveNote,
    deleteNote,
    showToast,
  } = useApp();

  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('engineering');
  const [pinned, setPinned] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [linkedEventId, setLinkedEventId] = useState('');
  const [linkedCalculationId, setLinkedCalculationId] = useState('');

  useEffect(() => {
    if (pendingNoteDraft) {
      setEditingId(undefined);
      setTitle(pendingNoteDraft.title);
      setContent(pendingNoteDraft.content);
      setCategory(pendingNoteDraft.category || 'calculation');
      setLinkedCalculationId(pendingNoteDraft.linkedCalculationId || '');
      setPendingNoteDraft(null);
    }
  }, [pendingNoteDraft, setPendingNoteDraft]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...notes]
      .sort((a, b) => Number(b.pinned) - Number(a.pinned))
      .filter(
        (n) =>
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q)
      );
  }, [notes, search]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 300000) {
      showToast('Please select an image smaller than 300 KB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImageDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setEditingId(undefined);
    setTitle('');
    setContent('');
    setCategory('engineering');
    setPinned(false);
    setDate(new Date().toISOString().slice(0, 10));
    setImageDataUrl('');
    setLocationLabel('');
    setLinkedEventId('');
    setLinkedCalculationId('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast(language === 'bn' ? 'নোট সংরক্ষণ করতে সাইন ইন করুন।' : 'Sign in to save private notes.', 'info');
      return;
    }
    if (!title.trim()) return;
    await saveNote({
      id: editingId,
      title: title.trim(),
      content,
      category,
      pinned,
      date,
      imageDataUrl,
      locationLabel,
      linkedEventId,
      linkedCalculationId,
    });
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          {language === 'bn' ? 'ব্যক্তিগত স্মার্ট নোটপ্যাড' : 'Private Smart Notepad'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          {language === 'bn'
            ? 'পিন করা নোট, ছবি, তারিখ, লোকেশন ও হিসাবের ফলাফল সম্পূর্ণ ব্যক্তিগতভাবে সংরক্ষণ করুন।'
            : 'Private owner-locked notes with categories, pinning, images, calendar links, and calculation snapshots.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {editingId ? 'Edit Note' : language === 'bn' ? 'নতুন নোট লিখুন' : 'Create Note'}
            </h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-xs text-blue-600 hover:underline cursor-pointer">
                New Note
              </button>
            )}
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={language === 'bn' ? 'নোটের শিরোনাম' : 'Note title'}
            required
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
            >
              <option value="engineering">Engineering</option>
              <option value="calculation">Calculation</option>
              <option value="site-visit">Site Visit</option>
              <option value="personal">Personal</option>
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
            />
          </div>

          <textarea
            rows={7}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={language === 'bn' ? 'বিস্তারিত নোট লিখুন...' : 'Write your technical or personal note...'}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs leading-relaxed"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="Location tag (optional)"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
            />
            <select
              value={linkedEventId}
              onChange={(e) => setLinkedEventId(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
            >
              <option value="">Link Calendar Event</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.date} — {ev.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Pin note</span>
            </label>

            <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              <ImagePlus className="w-3.5 h-3.5" />
              <span>{imageDataUrl ? 'Replace Image' : 'Attach Image'}</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>

          {imageDataUrl && (
            <div className="relative">
              <img src={imageDataUrl} alt="Note attachment" className="w-full max-h-40 object-cover rounded-lg border border-slate-200" />
              <button
                type="button"
                onClick={() => setImageDataUrl('')}
                className="mt-1 text-[11px] text-red-600 hover:underline cursor-pointer"
              >
                Remove image
              </button>
            </div>
          )}

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 py-2 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{editingId ? 'Update Note' : 'Save Note'}</span>
          </button>
        </form>

        {/* Notes List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'bn' ? 'নোট খুঁজুন...' : 'Search personal notes...'}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 py-2 text-xs"
            />
          </div>

          {filteredNotes.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500">
              {language === 'bn' ? 'কোনো নোট পাওয়া যায়নি।' : 'No notes yet. Create your first private engineering note.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredNotes.map((n) => (
                <div
                  key={n.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {n.title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => saveNote({ ...n, pinned: !n.pinned })}
                        className={`p-1 rounded cursor-pointer ${
                          n.pinned ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                        aria-label="Toggle pin"
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {n.category} · {n.date || 'No date'}
                      {n.locationLabel ? ` · ${n.locationLabel}` : ''}
                    </p>
                    {n.imageDataUrl && (
                      <img
                        src={n.imageDataUrl}
                        alt={n.title}
                        className="w-full h-32 object-cover rounded-lg border border-slate-200 dark:border-slate-800"
                      />
                    )}
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line line-clamp-5">
                      {n.content}
                    </p>
                    {n.locationLabel && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{n.locationLabel}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(n.id);
                        setTitle(n.title);
                        setContent(n.content);
                        setCategory(n.category);
                        setPinned(n.pinned);
                        setDate(n.date || '');
                        setImageDataUrl(n.imageDataUrl || '');
                        setLocationLabel(n.locationLabel || '');
                        setLinkedEventId(n.linkedEventId || '');
                      }}
                      className="text-blue-700 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNote(n.id)}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
