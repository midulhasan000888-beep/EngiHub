import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTriCalendarDate, toBengaliNumerals } from '../../engine/calendarUtils';
import { CalendarEvent, ReminderItem } from '../../types';

function getNextOccurrenceDate(
  dateIso: string,
  repeat: ReminderItem['repeat'],
  customIntervalDays = 1
): string {
  const base = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(base.getTime())) return dateIso;
  if (repeat === 'daily') base.setDate(base.getDate() + 1);
  else if (repeat === 'weekly') base.setDate(base.getDate() + 7);
  else if (repeat === 'monthly') base.setMonth(base.getMonth() + 1);
  else if (repeat === 'yearly') base.setFullYear(base.getFullYear() + 1);
  else if (repeat === 'custom') base.setDate(base.getDate() + Math.max(1, Math.round(customIntervalDays)));
  return base.toISOString().slice(0, 10);
}

export const CalendarReminderView: React.FC = () => {
  const {
    user,
    language,
    events,
    reminders,
    notes,
    appSettings,
    saveCalendarEvent,
    deleteCalendarEvent,
    saveReminder,
    deleteReminder,
    navigateTo,
    showToast,
  } = useApp();

  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [selectedIso, setSelectedIso] = useState(() => new Date().toISOString().slice(0, 10));

  // Event form
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evtTitle, setEvtTitle] = useState('');
  const [evtDesc, setEvtDesc] = useState('');
  const [evtTime, setEvtTime] = useState('09:00');
  const [evtRepeat, setEvtRepeat] = useState<CalendarEvent['repeat']>('none');
  const [evtNoteId, setEvtNoteId] = useState('');
  const [expandedNoteEvtId, setExpandedNoteEvtId] = useState<string | null>(null);

  // Reminder form
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [remTitle, setRemTitle] = useState('');
  const [remDesc, setRemDesc] = useState('');
  const [remDate, setRemDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remTime, setRemTime] = useState('10:00');
  const [remRepeat, setRemRepeat] = useState<ReminderItem['repeat']>('none');
  const [remCustomDays, setRemCustomDays] = useState(3);
  const [remPriority, setRemPriority] = useState<ReminderItem['priority']>('medium');
  const [remLocation, setRemLocation] = useState('');

  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const calOpts = useMemo(
    () => ({
      hijriOffsetDays: appSettings.hijriOffsetDays || 0,
      banglaVariant: appSettings.banglaCalendarVariant || 'revised',
    }),
    [appSettings]
  );

  const selectedTri = useMemo(() => getTriCalendarDate(selectedIso, calOpts), [selectedIso, calOpts]);

  const monthGrid = useMemo(() => {
    const y = cursorDate.getFullYear();
    const m = cursorDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(y, m, 1 - (startWeekday - i));
      cells.push({ iso: d.toISOString().slice(0, 10), day: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ iso, day: d, inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const nextIdx = cells.length - (startWeekday + daysInMonth) + 1;
      const d = new Date(y, m + 1, nextIdx);
      cells.push({ iso: d.toISOString().slice(0, 10), day: d.getDate(), inMonth: false });
    }
    return cells;
  }, [cursorDate]);

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      showToast('Browser notifications are not supported on this device.', 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      showToast(language === 'bn' ? 'পুশ নোটিফিকেশন চালু হয়েছে।' : 'Notifications enabled.', 'success');
    }
  };

  const resetEventForm = () => {
    setEditingEventId(null);
    setEvtTitle('');
    setEvtDesc('');
    setEvtTime('09:00');
    setEvtRepeat('none');
    setEvtNoteId('');
  };

  const startEditEvent = (ev: CalendarEvent) => {
    setEditingEventId(ev.id);
    setEvtTitle(ev.title);
    setEvtDesc(ev.description || '');
    setEvtTime(ev.time || '09:00');
    setEvtRepeat(ev.repeat);
    setEvtNoteId(ev.attachedNoteId || '');
  };

  const handleAddOrUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast(language === 'bn' ? 'ইভেন্ট যোগ করতে সাইন ইন করুন।' : 'Please sign in to save events.', 'info');
      return;
    }
    if (!evtTitle.trim()) return;
    await saveCalendarEvent({
      id: editingEventId || undefined,
      title: evtTitle.trim(),
      description: evtDesc.trim(),
      date: selectedIso,
      time: evtTime,
      repeat: evtRepeat,
      attachedNoteId: evtNoteId,
      category: 'schedule',
    });
    resetEventForm();
  };

  const resetReminderForm = () => {
    setEditingReminderId(null);
    setRemTitle('');
    setRemDesc('');
    setRemDate(selectedIso);
    setRemTime('10:00');
    setRemRepeat('none');
    setRemCustomDays(3);
    setRemPriority('medium');
    setRemLocation('');
  };

  const startEditReminder = (rem: ReminderItem) => {
    setEditingReminderId(rem.id);
    setRemTitle(rem.title);
    setRemDesc(rem.description || '');
    setRemDate(rem.date);
    setRemTime(rem.time);
    setRemRepeat(rem.repeat);
    setRemCustomDays(rem.customIntervalDays || 3);
    setRemPriority(rem.priority);
    setRemLocation(rem.location || '');
  };

  const handleAddOrUpdateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast(language === 'bn' ? 'রিমাইন্ডার যোগ করতে সাইন ইন করুন।' : 'Please sign in to save reminders.', 'info');
      return;
    }
    if (!remTitle.trim()) return;
    const existingRem = editingReminderId
      ? reminders.find((r) => r.id === editingReminderId)
      : undefined;
    await saveReminder({
      id: editingReminderId || undefined,
      title: remTitle.trim(),
      description: remDesc.trim(),
      date: remDate,
      time: remTime,
      repeat: remRepeat,
      customIntervalDays: remRepeat === 'custom' ? remCustomDays : 1,
      priority: remPriority,
      completed: existingRem ? existingRem.completed : false,
      location: remLocation.trim(),
      notified: false,
    });
    resetReminderForm();
  };

  const handleToggleReminderComplete = async (rem: ReminderItem) => {
    if (!rem.completed && rem.repeat !== 'none') {
      const nextDate = getNextOccurrenceDate(rem.date, rem.repeat, rem.customIntervalDays || 1);
      await saveReminder({
        ...rem,
        date: nextDate,
        completed: false,
        notified: false,
      });
      showToast(
        language === 'bn'
          ? `পুনরাবৃত্ত রিমাইন্ডার পরবর্তী তারিখ ${nextDate}-এ নির্ধারিত হয়েছে।`
          : `Recurring reminder advanced to next cycle: ${nextDate}.`,
        'info'
      );
      return;
    }
    await saveReminder({ ...rem, completed: !rem.completed });
  };

  const dayEvents = useMemo(
    () => events.filter((ev) => ev.date === selectedIso),
    [events, selectedIso]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {language === 'bn' ? 'ত্রি-ক্যালেন্ডার ও স্মার্ট রিমাইন্ডার' : 'Tri-Calendar & Smart Reminders'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {language === 'bn'
              ? 'ইংরেজি, বাংলা ও ইসলামিক হিজরি তারিখ একসাথে দেখুন এবং ইভেন্ট ও রিমাইন্ডার পরিচালনা করুন।'
              : 'Synchronized Gregorian, Bangla, and Islamic Hijri calendar with events and push reminders.'}
          </p>
        </div>

        <button
          type="button"
          onClick={requestPushPermission}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BellRing className="w-3.5 h-3.5 text-blue-600" />
          <span>
            {notifPermission === 'granted'
              ? language === 'bn'
                ? 'নোটিফিকেশন সক্রিয়'
                : 'Notifications Enabled'
              : language === 'bn'
                ? 'পুশ নোটিফিকেশন চালু করুন'
                : 'Enable Push Notifications'}
          </span>
        </button>
      </div>

      {/* Selected Date Tri-Calendar Banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-[11px] font-medium text-slate-500">Gregorian Date</p>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
            {language === 'bn' ? selectedTri.gregorian.formattedBn : selectedTri.gregorian.formattedEn}
          </p>
          <p className="text-xs text-slate-500">
            {language === 'bn' ? selectedTri.gregorian.weekdayBn : selectedTri.gregorian.weekdayEn}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-500">Bangla Calendar (বাংলা বর্ষ)</p>
          <p className="text-base font-bold text-blue-700 dark:text-blue-400 mt-0.5">
            {selectedTri.bangla.formattedBn}
          </p>
          <p className="text-xs text-slate-500">
            {selectedTri.bangla.formattedEn} · {language === 'bn' ? selectedTri.bangla.seasonBn : selectedTri.bangla.seasonEn}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-500">Islamic Hijri (Estimated)</p>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
            {language === 'bn' ? selectedTri.hijri.formattedBn : selectedTri.hijri.formattedEn}
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            {language === 'bn'
              ? 'চাঁদ দেখার ওপর ভিত্তি করে ±১ দিন পার্থক্য হতে পারে।'
              : 'Estimated astronomical date; local moon sighting may vary ±1 day.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Calendar Grid */}
        <div className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() - 1, 1))
                }
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-slate-900 dark:text-white min-w-[140px] text-center">
                {cursorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 1))
                }
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['month', 'week', 'day'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize cursor-pointer ${
                    viewMode === m
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {viewMode === 'month' && (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthGrid.map((cell) => {
                  const tri = getTriCalendarDate(cell.iso, calOpts);
                  const isSelected = cell.iso === selectedIso;
                  const hasEvents = events.some((e) => e.date === cell.iso);
                  const hasRem = reminders.some((r) => r.date === cell.iso && !r.completed);
                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      onClick={() => setSelectedIso(cell.iso)}
                      className={`min-h-[64px] p-1.5 rounded-lg border text-left transition-colors flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                          : cell.inMonth
                            ? 'border-slate-200 dark:border-slate-800 hover:border-blue-400'
                            : 'border-transparent opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {cell.day}
                        </span>
                        <span className="text-[10px] text-blue-700 dark:text-blue-400">
                          {toBengaliNumerals(tri.bangla.day)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-500">
                        <span>{tri.hijri.day}H</span>
                        {(hasEvents || hasRem) && (
                          <span className="font-semibold text-blue-600">
                            {hasEvents ? 'E' : ''}
                            {hasRem ? 'R' : ''}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {viewMode !== 'month' && (
            <div className="space-y-2 py-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {viewMode === 'day' ? `Schedule for ${selectedIso}` : `7-Day Schedule starting ${selectedIso}`}
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {Array.from({ length: viewMode === 'day' ? 1 : 7 }).map((_, idx) => {
                  const d = new Date(`${selectedIso}T12:00:00`);
                  d.setDate(d.getDate() + idx);
                  const iso = d.toISOString().slice(0, 10);
                  const tri = getTriCalendarDate(iso, calOpts);
                  const list = events.filter((e) => e.date === iso);
                  return (
                    <div key={iso} className="py-3 space-y-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {tri.gregorian.weekdayEn}, {iso} · {tri.bangla.formattedBn} · {tri.hijri.formattedEn}
                      </p>
                      {list.length === 0 ? (
                        <p className="text-xs text-slate-400">No events</p>
                      ) : (
                        list.map((ev) => (
                          <div key={ev.id} className="text-xs text-blue-700 dark:text-blue-400">
                            {ev.time} — {ev.title}
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Day Events + Add Event */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {language === 'bn' ? `${selectedIso} তারিখের ইভেন্টসমূহ` : `Events on ${selectedIso}`}
              </span>
            </h3>

            {dayEvents.map((ev) => {
              const attachedNote = ev.attachedNoteId
                ? notes.find((n) => n.id === ev.attachedNoteId)
                : undefined;
              const isExpanded = expandedNoteEvtId === ev.id;
              return (
                <div
                  key={ev.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {ev.time ? `${ev.time} · ` : ''}
                        {ev.title}
                      </p>
                      {ev.description && <p className="text-slate-500 mt-0.5">{ev.description}</p>}
                      <p className="text-[11px] text-slate-400 mt-0.5">Repeat: {ev.repeat}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditEvent(ev)}
                        aria-label="Edit event"
                        className="text-slate-400 hover:text-blue-600 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCalendarEvent(ev.id)}
                        aria-label="Delete event"
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {attachedNote && (
                    <div className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedNoteEvtId(isExpanded ? null : ev.id)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          <NotebookPen className="w-3 h-3" />
                          <span>Note: {attachedNote.title}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateTo('notepad')}
                          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open</span>
                        </button>
                      </div>
                      {isExpanded && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-line pt-1">
                          {attachedNote.content.slice(0, 320)}
                          {attachedNote.content.length > 320 ? '...' : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <form onSubmit={handleAddOrUpdateEvent} className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2">
              <input
                type="text"
                value={evtTitle}
                onChange={(e) => setEvtTitle(e.target.value)}
                placeholder={language === 'bn' ? 'নতুন ইভেন্টের শিরোনাম' : 'New event title'}
                className="sm:col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <input
                type="time"
                value={evtTime}
                onChange={(e) => setEvtTime(e.target.value)}
                className="sm:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs"
              />
              <select
                value={evtRepeat}
                onChange={(e) => setEvtRepeat(e.target.value as CalendarEvent['repeat'])}
                className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs"
              >
                <option value="none">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <div className="sm:col-span-2 flex gap-1">
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{editingEventId ? 'Save' : 'Add'}</span>
                </button>
                {editingEventId && (
                  <button
                    type="button"
                    onClick={resetEventForm}
                    aria-label="Cancel event edit"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={evtDesc}
                onChange={(e) => setEvtDesc(e.target.value)}
                placeholder="Description (optional)"
                className="sm:col-span-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <select
                value={evtNoteId}
                onChange={(e) => setEvtNoteId(e.target.value)}
                className="sm:col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs"
              >
                <option value="">Attach Note (Optional)</option>
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </form>
          </div>
        </div>

        {/* Right: Smart Reminder System */}
        <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span>{language === 'bn' ? 'স্মার্ট রিমাইন্ডার' : 'Smart Reminders'}</span>
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {reminders.filter((r) => !r.completed).length} active
            </span>
          </div>

          <form onSubmit={handleAddOrUpdateReminder} className="space-y-2.5 border-b border-slate-100 dark:border-slate-800 pb-4">
            <input
              type="text"
              value={remTitle}
              onChange={(e) => setRemTitle(e.target.value)}
              placeholder={language === 'bn' ? 'রিমাইন্ডার শিরোনাম' : 'Reminder title'}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={remDesc}
              onChange={(e) => setRemDesc(e.target.value)}
              placeholder="Description / details"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={remDate}
                onChange={(e) => setRemDate(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
              />
              <input
                type="time"
                value={remTime}
                onChange={(e) => setRemTime(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={remRepeat}
                onChange={(e) => setRemRepeat(e.target.value as ReminderItem['repeat'])}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
              >
                <option value="none">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom Interval</option>
              </select>
              <select
                value={remPriority}
                onChange={(e) => setRemPriority(e.target.value as ReminderItem['priority'])}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
            {remRepeat === 'custom' && (
              <input
                type="number"
                min={1}
                value={remCustomDays}
                onChange={(e) => setRemCustomDays(Number(e.target.value))}
                placeholder="Repeat every N days"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
            )}
            <input
              type="text"
              value={remLocation}
              onChange={(e) => setRemLocation(e.target.value)}
              placeholder="Location (optional)"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 py-2 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {editingReminderId
                    ? language === 'bn'
                      ? 'রিমাইন্ডার আপডেট করুন'
                      : 'Save Reminder Changes'
                    : language === 'bn'
                      ? 'রিমাইন্ডার যোগ করুন'
                      : 'Create Reminder'}
                </span>
              </button>
              {editingReminderId && (
                <button
                  type="button"
                  onClick={resetReminderForm}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            {language === 'bn'
              ? 'দ্রষ্টব্য: ব্রাউজার বা পিডব্লিউএ খোলা অবস্থায় টাইমজোন অনুযায়ী পুশ ও ইন-অ্যাপ নোটিফিকেশন ট্রিগার হয়।'
              : 'Note: Browser push & in-app notifications deliver while the app or service worker session is active in your local timezone.'}
          </p>

          <div className="space-y-2 max-h-[380px] overflow-y-auto">
            {reminders.map((rem) => (
              <div
                key={rem.id}
                className={`rounded-lg border p-3 flex items-start justify-between gap-2.5 text-xs ${
                  rem.completed
                    ? 'border-slate-100 dark:border-slate-800 opacity-60'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleReminderComplete(rem)}
                  title={
                    rem.repeat !== 'none'
                      ? 'Complete current cycle & advance to next occurrence'
                      : 'Toggle completion'
                  }
                  className="mt-0.5 text-blue-600 shrink-0 cursor-pointer"
                >
                  {rem.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold ${rem.completed ? 'line-through' : ''}`}>
                    {rem.title}
                  </p>
                  {rem.description && <p className="text-slate-500 mt-0.5">{rem.description}</p>}
                  <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                    {rem.date} · {rem.time} · {rem.priority} · {rem.repeat}
                    {rem.location ? ` · ${rem.location}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditReminder(rem)}
                    aria-label="Edit reminder"
                    className="text-slate-400 hover:text-blue-600 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteReminder(rem.id)}
                    aria-label="Delete reminder"
                    className="text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
