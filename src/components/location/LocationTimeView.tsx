import React, { useEffect, useState } from 'react';
import { Clock, Copy, Globe, MapPin, Navigation, NotebookPen } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const WORLD_CITIES = [
  { city: 'Dhaka, Bangladesh', tz: 'Asia/Dhaka' },
  { city: 'London, UK', tz: 'Europe/London' },
  { city: 'Dubai, UAE', tz: 'Asia/Dubai' },
  { city: 'Singapore', tz: 'Asia/Singapore' },
  { city: 'Tokyo, Japan', tz: 'Asia/Tokyo' },
  { city: 'New York, USA', tz: 'America/New_York' },
  { city: 'Riyadh, Saudi Arabia', tz: 'Asia/Riyadh' },
  { city: 'UTC (Coordinated Universal Time)', tz: 'UTC' },
];

export const LocationTimeView: React.FC = () => {
  const { language, user, saveNote, showToast } = useApp();
  const [now, setNow] = useState(() => new Date());
  const [selectedTz, setSelectedTz] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka'
  );
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    capturedAt: string;
  } | null>(null);
  const [locError, setLocError] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [locNoteTitle, setLocNoteTitle] = useState('Site Survey Location');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    setLocLoading(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          capturedAt: new Date().toLocaleTimeString(),
        });
        setLocLoading(false);
      },
      (err) => {
        setLocError(err.message || 'Location permission was denied.');
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveLocationNote = async () => {
    if (!coords) return;
    if (!user) {
      showToast(language === 'bn' ? 'নোট সংরক্ষণ করতে সাইন ইন করুন।' : 'Sign in to save location notes.', 'info');
      return;
    }
    await saveNote({
      title: locNoteTitle.trim() || 'GPS Location Pin',
      content: `Latitude: ${coords.lat.toFixed(6)}\nLongitude: ${coords.lng.toFixed(6)}\nAccuracy: ±${coords.accuracy} m\nCaptured: ${coords.capturedAt}`,
      category: 'site-visit',
      pinned: false,
      date: new Date().toISOString().slice(0, 10),
      locationLabel: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
      latitude: coords.lat,
      longitude: coords.lng,
    });
  };

  const formatTimeForTz = (tz: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(now);
    } catch {
      return now.toLocaleTimeString();
    }
  };

  const formatDateForTz = (tz: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(now);
    } catch {
      return now.toDateString();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          {language === 'bn' ? 'লোকেশন ও বিশ্ব ঘড়ি' : 'Location Services & World Clock'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          {language === 'bn'
            ? 'অনুমতি সাপেক্ষ জিপিএস অক্ষাংশ/দ্রাঘিমাংশ, লোকেশন নোট এবং লাইভ বিশ্ব সময়।'
            : 'Permission-gated GPS coordinates, location-tagged site notes, and live engineering world clock.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* GPS Location Card */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>{language === 'bn' ? 'বর্তমান অবস্থান (জিপিএস)' : 'Current GPS Location'}</span>
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {language === 'bn'
              ? 'আপনার গোপনীয়তা রক্ষার্থে অনুমতি ছাড়া অবস্থান সংগ্রহ করা হয় না।'
              : 'Location is accessed only when you explicitly click the button below and grant browser permission.'}
          </p>

          <button
            type="button"
            onClick={requestLocation}
            disabled={locLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>
              {locLoading
                ? 'Acquiring GPS...'
                : language === 'bn'
                  ? 'অনুমতি দিয়ে লোকেশন দেখুন'
                  : 'Request Current Location'}
            </span>
          </button>

          {locError && (
            <p className="text-xs text-red-600 dark:text-red-400">{locError}</p>
          )}

          {coords && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-[11px] text-slate-500">Latitude</p>
                  <p className="text-sm font-bold font-mono-tabular">{coords.lat.toFixed(6)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-[11px] text-slate-500">Longitude</p>
                  <p className="text-sm font-bold font-mono-tabular">{coords.lng.toFixed(6)}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 tabular-nums">
                Accuracy: ±{coords.accuracy} m · Captured at {coords.capturedAt}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
                    showToast('Coordinates copied.', 'success');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Coordinates</span>
                </button>
              </div>

              <div className="pt-2 space-y-2">
                <input
                  type="text"
                  value={locNoteTitle}
                  onChange={(e) => setLocNoteTitle(e.target.value)}
                  placeholder="Location Note Title"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={handleSaveLocationNote}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 cursor-pointer"
                >
                  <NotebookPen className="w-3.5 h-3.5" />
                  <span>Save Location-Based Note</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* World Clock */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{language === 'bn' ? 'স্থানীয় সময় ও বিশ্ব ঘড়ি' : 'Local Time & World Clock'}</span>
            </h2>
            <select
              value={selectedTz}
              onChange={(e) => setSelectedTz(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
            >
              {WORLD_CITIES.map((c) => (
                <option key={c.tz} value={c.tz}>
                  {c.city} ({c.tz})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 p-5">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Selected Timezone: {selectedTz}</span>
            </p>
            <p className="mt-1 text-3xl font-bold font-mono-tabular text-slate-900 dark:text-white">
              {formatTimeForTz(selectedTz)}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {formatDateForTz(selectedTz)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WORLD_CITIES.map((c) => (
              <div
                key={c.tz}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{c.city}</p>
                  <p className="text-[11px] text-slate-500">{formatDateForTz(c.tz)}</p>
                </div>
                <p className="text-sm font-bold font-mono-tabular text-blue-700 dark:text-blue-400">
                  {formatTimeForTz(c.tz)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
