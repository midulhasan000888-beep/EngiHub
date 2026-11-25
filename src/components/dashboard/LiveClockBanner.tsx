import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getTriCalendarDate,
  getZonedClockParts,
  toBengaliNumerals,
} from '../../engine/calendarUtils';

const TIMEZONE_OPTIONS = [
  { tz: 'Asia/Dhaka', labelEn: 'Bangladesh (Asia/Dhaka)', labelBn: 'বাংলাদেশ সময় (ঢাকা)' },
  { tz: 'UTC', labelEn: 'UTC (GMT+0)', labelBn: 'ইউটিসি (UTC)' },
  { tz: 'Asia/Dubai', labelEn: 'Dubai (Asia/Dubai)', labelBn: 'দুবাই (UAE)' },
  { tz: 'Asia/Riyadh', labelEn: 'Riyadh (Asia/Riyadh)', labelBn: 'রিয়াদ (সৌদি আরব)' },
  { tz: 'Asia/Singapore', labelEn: 'Singapore (SGT)', labelBn: 'সিঙ্গাপুর' },
  { tz: 'Europe/London', labelEn: 'London (GMT/BST)', labelBn: 'লন্ডন' },
  { tz: 'America/New_York', labelEn: 'New York (EST/EDT)', labelBn: 'নিউ ইয়র্ক' },
];

export const LiveClockBanner: React.FC = () => {
  const { language, appSettings } = useApp();
  const [now, setNow] = useState<Date>(() => new Date());

  const [use24Hour, setUse24Hour] = useState<boolean>(() => {
    try {
      return localStorage.getItem('engihub_clock_24h') === '1';
    } catch {
      return false;
    }
  });

  const [timeZone, setTimeZone] = useState<string>(() => {
    try {
      return localStorage.getItem('engihub_clock_tz') || 'Asia/Dhaka';
    } catch {
      return 'Asia/Dhaka';
    }
  });

  useEffect(() => {
    const tick = () => setNow(new Date());
    const intervalId = window.setInterval(tick, 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const handleToggleFormat = (is24: boolean) => {
    setUse24Hour(is24);
    try {
      localStorage.setItem('engihub_clock_24h', is24 ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  };

  const handleTimezoneChange = (tz: string) => {
    setTimeZone(tz);
    try {
      localStorage.setItem('engihub_clock_tz', tz);
    } catch {
      // ignore storage errors
    }
  };

  const clockParts = useMemo(() => getZonedClockParts(now, timeZone), [now, timeZone]);

  const triToday = useMemo(
    () =>
      getTriCalendarDate(clockParts.isoDate, {
        hijriOffsetDays: appSettings.hijriOffsetDays || 0,
        banglaVariant: appSettings.banglaCalendarVariant || 'revised',
      }),
    [clockParts.isoDate, appSettings.hijriOffsetDays, appSettings.banglaCalendarVariant]
  );

  const hourDisplay = use24Hour ? clockParts.hour24 : clockParts.hour12;
  const formattedTimeStr = `${hourDisplay}:${clockParts.minute}:${clockParts.second}`;
  const displayTime = language === 'bn' ? toBengaliNumerals(formattedTimeStr) : formattedTimeStr;

  const currentYear = clockParts.year;

  return (
    <section
      aria-label={language === 'bn' ? 'লাইভ ডিজিটাল ঘড়ি ও তারিখ' : 'Live Digital Clock & Calendar'}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Live Digital Time & Controls */}
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {language === 'bn' ? 'লাইভ ডিজিটাল ঘড়ি' : 'Live Digital Clock'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">
              {TIMEZONE_OPTIONS.find((z) => z.tz === timeZone)?.[
                language === 'bn' ? 'labelBn' : 'labelEn'
              ] || timeZone}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <time
              dateTime={now.toISOString()}
              className="text-3xl sm:text-4xl font-bold font-mono-tabular tracking-tight text-slate-900 dark:text-white"
            >
              {displayTime}
            </time>
            {!use24Hour && (
              <span className="text-sm font-semibold font-mono-tabular text-blue-700 dark:text-blue-400">
                {clockParts.period}
              </span>
            )}
          </div>
        </div>

        {/* Right: Dynamic System Year + 12h/24h & Timezone Selectors */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
          {/* Dynamic System Year Display (2026 -> 2027...) */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 flex items-center justify-between sm:justify-center gap-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'সাল' : 'Year'}
            </span>
            <span className="text-base font-bold font-mono-tabular text-blue-700 dark:text-blue-400">
              {currentYear}
            </span>
          </div>

          {/* 12H / 24H Segmented Toggle */}
          <div
            role="group"
            aria-label="Clock format"
            className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <button
              type="button"
              onClick={() => handleToggleFormat(false)}
              className={`px-2.5 py-1.5 min-h-[32px] text-xs font-medium rounded-md transition-colors cursor-pointer ${
                !use24Hour
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              12H
            </button>
            <button
              type="button"
              onClick={() => handleToggleFormat(true)}
              className={`px-2.5 py-1.5 min-h-[32px] text-xs font-medium rounded-md transition-colors cursor-pointer ${
                use24Hour
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              24H
            </button>
          </div>

          {/* Timezone Selector */}
          <div className="relative flex items-center">
            <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={timeZone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              aria-label={language === 'bn' ? 'সময় অঞ্চল নির্বাচন' : 'Select Time Zone'}
              className="w-full sm:w-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-2 min-h-[38px] text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.tz} value={opt.tz}>
                  {language === 'bn' ? opt.labelBn : opt.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Date, Weekday, Month, Year + Bangla & Hijri Dates */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {language === 'bn' ? triToday.gregorian.weekdayBn : triToday.gregorian.weekdayEn}
        </span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">
          {language === 'bn' ? triToday.gregorian.formattedBn : triToday.gregorian.formattedEn}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {language === 'bn' ? triToday.bangla.formattedBn : triToday.bangla.formattedEn}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {language === 'bn' ? triToday.hijri.formattedBn : triToday.hijri.formattedEn}{' '}
          ({language === 'bn' ? 'আনুমানিক' : 'Est.'})
        </span>
      </div>
    </section>
  );
};
