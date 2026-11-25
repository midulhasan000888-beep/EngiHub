import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Briefcase,
  Camera,
  Download,
  Globe,
  GraduationCap,
  HardDrive,
  LogIn,
  LogOut,
  Moon,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PWAInstallButton } from '../common/PWAInstallButton';

const THEME_PRESETS: Array<{ id: string; nameEn: string; nameBn: string; primary: string; secondary: string }> = [
  { id: 'cobalt-teal', nameEn: 'Cobalt & Teal (Default)', nameBn: 'কোবাল্ট ও টিল (ডিফল্ট)', primary: '#2563eb', secondary: '#0f766e' },
  { id: 'emerald-navy', nameEn: 'Emerald & Navy', nameBn: 'এমেরাল্ড ও নেভি', primary: '#059669', secondary: '#1e3a8a' },
  { id: 'indigo-amber', nameEn: 'Indigo & Amber', nameBn: 'ইন্ডিগো ও অ্যাম্বার', primary: '#4f46e5', secondary: '#d97706' },
  { id: 'crimson-slate', nameEn: 'Crimson & Slate', nameBn: 'ক্রিমসন ও স্লেট', primary: '#dc2626', secondary: '#334155' },
  { id: 'violet-cyan', nameEn: 'Violet & Cyan', nameBn: 'ভায়োলেট ও সায়ান', primary: '#7c3aed', secondary: '#0891b2' },
  { id: 'teal-coral', nameEn: 'Deep Teal & Coral', nameBn: 'ডিপ টিল ও কোরাল', primary: '#0d9488', secondary: '#e11d48' },
];

type ProfileTab = 'personal' | 'education' | 'professional' | 'usage' | 'preferences';

async function compressImageToDataUrl(file: File, maxDim = 256, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unsupported'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export const ProfileSettingsView: React.FC = () => {
  const {
    user,
    profile,
    isAdmin,
    language,
    theme,
    appSettings,
    history,
    calculatorHistory,
    reports,
    reportAssets,
    pdfDocuments,
    spreadsheets,
    presentations,
    suggestions,
    getUserStorageQuotaBytes,
    getTotalStorageUsedBytes,
    setLanguage,
    setTheme,
    signInWithGoogle,
    signOut,
    updateUserProfile,
    requestAccountDeletion,
    downloadMyData,
    showToast,
  } = useApp();

  const pCfg = appSettings.profileConfig;
  const allowMobile = pCfg?.allowMobileField !== false;
  const allowEdu = pCfg?.allowEducationFields !== false;
  const allowProf = pCfg?.allowProfessionalFields !== false;
  const allowDeleteReq = pCfg?.allowAccountDeletionRequest !== false;

  const [tab, setTab] = useState<ProfileTab>('personal');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [form, setForm] = useState({
    displayName: '',
    photoURL: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka',
    mobile: '',
    dateOfBirth: '',
    gender: '',
    country: 'Bangladesh',
    division: '',
    district: '',
    city: '',
    address: '',
    educationLevel: '',
    institutionName: '',
    department: '',
    subject: '',
    classOrSemester: '',
    passingYear: '',
    qualification: '',
    profession: '',
    jobTitle: '',
    companyName: '',
    workDepartment: '',
    workExperience: '',
    skills: '',
    specialization: '',
    engineeringDiscipline: '',
    designation: '',
    licenseNumber: '',
    defaultCalculator: 'scientific' as 'normal' | 'scientific' | 'engineering',
    preferredUnitSystem: 'SI' as 'SI' | 'Imperial' | 'Mixed',
    inAppNotifications: true,
    emailNotifications: true,
    profileVisibility: 'private' as 'private' | 'team',
    primaryColor: (typeof window !== 'undefined' && localStorage.getItem('engihub_primary_color')) || '#2563eb',
    secondaryColor: (typeof window !== 'undefined' && localStorage.getItem('engihub_secondary_color')) || '#0f766e',
    themePreset: 'cobalt-teal',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName || user?.displayName || '',
        photoURL: profile.photoURL || user?.photoURL || '',
        timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka',
        mobile: profile.mobile || '',
        dateOfBirth: profile.dateOfBirth || '',
        gender: profile.gender || '',
        country: profile.country || 'Bangladesh',
        division: profile.division || '',
        district: profile.district || '',
        city: profile.city || '',
        address: profile.address || '',
        educationLevel: profile.educationLevel || '',
        institutionName: profile.institutionName || '',
        department: profile.department || '',
        subject: profile.subject || '',
        classOrSemester: profile.classOrSemester || '',
        passingYear: profile.passingYear || '',
        qualification: profile.qualification || '',
        profession: profile.profession || '',
        jobTitle: profile.jobTitle || '',
        companyName: profile.companyName || '',
        workDepartment: profile.workDepartment || '',
        workExperience: profile.workExperience || '',
        skills: profile.skills || '',
        specialization: profile.specialization || '',
        engineeringDiscipline: profile.engineeringDiscipline || '',
        designation: profile.designation || '',
        licenseNumber: profile.licenseNumber || '',
        defaultCalculator: profile.defaultCalculator || 'scientific',
        preferredUnitSystem: profile.preferredUnitSystem || 'SI',
        inAppNotifications: profile.inAppNotifications !== false,
        emailNotifications: profile.emailNotifications !== false,
        profileVisibility: profile.profileVisibility || 'private',
        primaryColor: profile.primaryColor || localStorage.getItem('engihub_primary_color') || '#2563eb',
        secondaryColor: profile.secondaryColor || localStorage.getItem('engihub_secondary_color') || '#0f766e',
        themePreset: profile.themePreset || 'cobalt-teal',
      });
    }
  }, [profile, user]);

  const applyPaletteLive = (primary: string, secondary: string, preset = 'custom') => {
    setForm((prev) => ({ ...prev, primaryColor: primary, secondaryColor: secondary, themePreset: preset }));
    const m1 = /^#?([0-9a-fA-F]{6})$/.exec(primary.trim());
    const m2 = /^#?([0-9a-fA-F]{6})$/.exec(secondary.trim());
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--brand-primary', primary);
    rootStyle.setProperty('--brand-secondary', secondary);
    if (m1) {
      const r = parseInt(m1[1].slice(0, 2), 16);
      const g = parseInt(m1[1].slice(2, 4), 16);
      const b = parseInt(m1[1].slice(4, 6), 16);
      rootStyle.setProperty('--brand-primary-hover', `rgb(${Math.max(0, r - 22)}, ${Math.max(0, g - 22)}, ${Math.max(0, b - 22)})`);
      rootStyle.setProperty('--brand-primary-soft', `rgba(${r}, ${g}, ${b}, 0.12)`);
    }
    if (m2) {
      const r = parseInt(m2[1].slice(0, 2), 16);
      const g = parseInt(m2[1].slice(2, 4), 16);
      const b = parseInt(m2[1].slice(4, 6), 16);
      rootStyle.setProperty('--brand-secondary-soft', `rgba(${r}, ${g}, ${b}, 0.12)`);
    }
    localStorage.setItem('engihub_primary_color', primary);
    localStorage.setItem('engihub_secondary_color', secondary);
  };

  const storageMetrics = useMemo(() => {
    const pdfBytes = pdfDocuments.reduce((acc, d) => acc + (d.fileSizeBytes || 0), 0);
    const reportBytes = reports.reduce((acc, r) => acc + (r.pdfFileSizeBytes || 0), 0);
    const assetBytes = reportAssets.reduce((acc, a) => acc + (a.fileSizeBytes || 0), 0);
    const usedBytes = getTotalStorageUsedBytes();
    const quotaBytes = getUserStorageQuotaBytes(profile);
    const remainingBytes = Math.max(0, quotaBytes - usedBytes);
    return {
      usedMb: (usedBytes / 1024 / 1024).toFixed(2),
      quotaMb: (quotaBytes / 1024 / 1024).toFixed(0),
      remainingMb: (remainingBytes / 1024 / 1024).toFixed(1),
      pdfMb: (pdfBytes / 1024 / 1024).toFixed(2),
      reportMb: (reportBytes / 1024 / 1024).toFixed(2),
      assetMb: (assetBytes / 1024 / 1024).toFixed(2),
      storedReportsCount: reports.filter((r) => Boolean(r.pdfStoragePath)).length,
      storedAssetsCount: reportAssets.filter((a) => Boolean(a.storagePath)).length,
      pct: quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0,
    };
  }, [getTotalStorageUsedBytes, getUserStorageQuotaBytes, pdfDocuments, profile, reportAssets, reports]);

  const mySuggestionsCount = useMemo(
    () => (user ? suggestions.filter((s) => s.userId === user.uid).length : 0),
    [suggestions, user]
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateUserProfile({
        displayName: form.displayName.trim() || 'Engineer',
        photoURL: form.photoURL,
        timezone: form.timezone.trim(),
        language,
        theme,
        mobile: form.mobile.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        country: form.country.trim(),
        division: form.division.trim(),
        district: form.district.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        educationLevel: form.educationLevel.trim(),
        institutionName: form.institutionName.trim(),
        department: form.department.trim(),
        subject: form.subject.trim(),
        classOrSemester: form.classOrSemester.trim(),
        passingYear: form.passingYear.trim(),
        qualification: form.qualification.trim(),
        profession: form.profession.trim(),
        jobTitle: form.jobTitle.trim(),
        companyName: form.companyName.trim(),
        workDepartment: form.workDepartment.trim(),
        workExperience: form.workExperience.trim(),
        skills: form.skills.trim(),
        specialization: form.specialization.trim(),
        engineeringDiscipline: form.engineeringDiscipline.trim(),
        designation: form.designation.trim(),
        licenseNumber: form.licenseNumber.trim(),
        defaultCalculator: form.defaultCalculator,
        preferredUnitSystem: form.preferredUnitSystem,
        inAppNotifications: form.inAppNotifications,
        emailNotifications: form.emailNotifications,
        profileVisibility: form.profileVisibility,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        themePreset: form.themePreset,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File | undefined) => {
    if (!file || !user) return;
    try {
      const dataUrl = await compressImageToDataUrl(file, 256, 0.78);
      if (dataUrl.length > 260000) {
        showToast(language === 'bn' ? 'ছবির আকার অনেক বড়, ছোট ছবি দিন' : 'Compressed image still too large', 'error');
        return;
      }
      setForm((prev) => ({ ...prev, photoURL: dataUrl }));
      await updateUserProfile({ photoURL: dataUrl });
    } catch {
      showToast(language === 'bn' ? 'প্রোফাইল ছবি প্রসেস করা যায়নি' : 'Could not process profile photo', 'error');
    }
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      showToast('Browser notifications not supported here.', 'error');
      return;
    }
    const res = await Notification.requestPermission();
    showToast(`Notification permission: ${res}`, res === 'granted' ? 'success' : 'info');
  };

  const createdStr = useMemo(() => {
    const ts = profile?.createdAt as { toDate?: () => Date } | undefined;
    return ts && typeof ts.toDate === 'function' ? ts.toDate().toLocaleDateString() : '—';
  }, [profile]);

  const setField = (key: keyof typeof form, val: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          {language === 'bn' ? 'প্রোফাইল ও অ্যাকাউন্ট সেটিংস' : 'Advanced Profile & Preferences'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          {language === 'bn'
            ? 'ব্যক্তিগত, শিক্ষাগত, পেশাগত তথ্য, স্টোরেজ ব্যবহার, প্রাইভেসি ও ডেটা এক্সপোর্ট নিয়ন্ত্রণ করুন।'
            : 'Manage your optional personal, educational, and professional profile, usage telemetry, privacy & data export.'}
        </p>
      </div>

      {/* Header Profile Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {form.photoURL ? (
                <img
                  src={form.photoURL}
                  alt={form.displayName || 'Profile'}
                  className="w-16 h-16 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                  <User className="w-7 h-7" />
                </div>
              )}
              {user && (
                <>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    title={language === 'bn' ? 'প্রোফাইল ছবি পরিবর্তন করুন' : 'Change Profile Photo'}
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-blue-700 text-white shadow hover:bg-blue-800 cursor-pointer"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      void handleAvatarUpload(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </>
              )}
            </div>

            <div className="space-y-0.5">
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {profile?.displayName || user?.displayName || 'Guest User'}
              </p>
              <p className="text-xs text-slate-500">
                {user?.email || 'Not signed in'} · Role: {isAdmin ? 'Administrator' : profile?.role || 'Guest'} · Plan:{' '}
                <span className="uppercase font-semibold">{profile?.accountType || 'free'}</span>
              </p>
              {user && (
                <p className="text-[11px] font-mono-tabular text-slate-500">
                  Cloud Storage (R2): {storageMetrics.usedMb} MB / {storageMetrics.quotaMb} MB ({storageMetrics.pct}% · {storageMetrics.remainingMb} MB left)
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user ? (
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'সাইন আউট' : 'Sign Out'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'গুগল দিয়ে সাইন ইন করুন' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-3 flex items-center gap-2 text-xs text-blue-800 dark:text-blue-200">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Administrator role verified. You have access to the Admin Console.</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
        {(
          [
            { id: 'personal', en: 'Personal Info', bn: 'ব্যক্তিগত তথ্য', icon: User, show: true },
            { id: 'education', en: 'Education', bn: 'শিক্ষাগত তথ্য', icon: GraduationCap, show: allowEdu },
            { id: 'professional', en: 'Professional', bn: 'পেশাগত তথ্য', icon: Briefcase, show: allowProf },
            { id: 'usage', en: 'App Usage & Data', bn: 'ব্যবহার ও ডেটা', icon: Activity, show: true },
            { id: 'preferences', en: 'Preferences & Privacy', bn: 'পছন্দ ও প্রাইভেসি', icon: Globe, show: true },
          ] as const
        )
          .filter((t) => t.show)
          .map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  tab === item.id
                    ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? item.bn : item.en}</span>
              </button>
            );
          })}
      </div>

      {/* Form Tabs: Personal / Education / Professional */}
      {(tab === 'personal' || tab === 'education' || tab === 'professional') && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          {!user && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {language === 'bn' ? 'প্রোফাইল সংরক্ষণ করতে অনুগ্রহ করে সাইন-ইন করুন।' : 'Please sign in with Google to edit and save your profile.'}
            </p>
          )}

          {tab === 'personal' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full / Display Name</label>
                <input type="text" value={form.displayName} onChange={(e) => setField('displayName', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              {allowMobile && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mobile Number (Optional)</label>
                  <input type="tel" value={form.mobile} onChange={(e) => setField('mobile', e.target.value)} placeholder="01XXXXXXXXX" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date of Birth</label>
                <input type="date" value={form.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                <select value={form.gender} onChange={(e) => setField('gender', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs">
                  <option value="">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Country</label>
                <input type="text" value={form.country} onChange={(e) => setField('country', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Division / State</label>
                <input type="text" value={form.division} onChange={(e) => setField('division', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">District</label>
                <input type="text" value={form.district} onChange={(e) => setField('district', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">City / Town</label>
                <input type="text" value={form.city} onChange={(e) => setField('city', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Timezone</label>
                <input type="text" value={form.timezone} onChange={(e) => setField('timezone', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                <input type="text" value={form.address} onChange={(e) => setField('address', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
            </div>
          )}

          {tab === 'education' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Education Level</label>
                <input type="text" value={form.educationLevel} onChange={(e) => setField('educationLevel', e.target.value)} placeholder="e.g. Diploma / B.Sc / HSC" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Institution Name</label>
                <input type="text" value={form.institutionName} onChange={(e) => setField('institutionName', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <input type="text" value={form.department} onChange={(e) => setField('department', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Subject / Major</label>
                <input type="text" value={form.subject} onChange={(e) => setField('subject', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Class / Semester</label>
                <input type="text" value={form.classOrSemester} onChange={(e) => setField('classOrSemester', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Passing Year</label>
                <input type="text" value={form.passingYear} onChange={(e) => setField('passingYear', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Qualification Summary</label>
                <input type="text" value={form.qualification} onChange={(e) => setField('qualification', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
            </div>
          )}

          {tab === 'professional' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Profession</label>
                <input type="text" value={form.profession} onChange={(e) => setField('profession', e.target.value)} placeholder="e.g. Engineer, Student, Teacher" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Job Title</label>
                <input type="text" value={form.jobTitle} onChange={(e) => setField('jobTitle', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Company / Organization</label>
                <input type="text" value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Work Department</label>
                <input type="text" value={form.workDepartment} onChange={(e) => setField('workDepartment', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Experience (Years)</label>
                <input type="text" value={form.workExperience} onChange={(e) => setField('workExperience', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Engineering Discipline</label>
                <input type="text" value={form.engineeringDiscipline} onChange={(e) => setField('engineeringDiscipline', e.target.value)} placeholder="Electrical / Civil / Mechanical..." className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Designation</label>
                <input type="text" value={form.designation} onChange={(e) => setField('designation', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Specialization</label>
                <input type="text" value={form.specialization} onChange={(e) => setField('specialization', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">License / Cert No.</label>
                <input type="text" value={form.licenseNumber} onChange={(e) => setField('licenseNumber', e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Skills</label>
                <input type="text" value={form.skills} onChange={(e) => setField('skills', e.target.value)} placeholder="AutoCAD, PLC, MATLAB, Excel..." className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs" />
              </div>
            </div>
          )}

          {user && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? (language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : language === 'bn' ? 'প্রোফাইল সেভ করুন' : 'Save Profile'}</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* App Usage & Account Security Tab */}
      {tab === 'usage' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: language === 'bn' ? 'অ্যাকাউন্ট তৈরি' : 'Account Created', val: createdStr },
              { label: language === 'bn' ? 'মোট লগইন' : 'Total Logins', val: String(profile?.loginCount || 1) },
              { label: language === 'bn' ? 'মোট হিসাব' : 'Calculations', val: String(history.length + calculatorHistory.length) },
              { label: language === 'bn' ? 'পিডিএফ ফাইল' : 'PDF Files', val: String(pdfDocuments.length) },
              { label: language === 'bn' ? 'সংরক্ষিত রিপোর্ট' : 'Saved Reports', val: String(reports.length) },
              { label: language === 'bn' ? 'এক্সেল ওয়ার্কবুক' : 'Spreadsheets', val: String(spreadsheets.length) },
              { label: language === 'bn' ? 'প্রেজেন্টেশন' : 'Presentations', val: String(presentations.length) },
              { label: language === 'bn' ? 'আমার পরামর্শ' : 'Suggestions Sent', val: String(mySuggestionsCount) },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <p className="text-[11px] text-slate-500">{k.label}</p>
                <p className="mt-1 text-lg font-bold font-mono-tabular text-slate-900 dark:text-white">{k.val}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-600" />
                <span>{language === 'bn' ? 'ক্লাউড স্টোরেজ (R2) ব্যবহারের বিবরণ' : 'Cloud Storage (R2) Allocation'}</span>
              </h3>
              <div className="flex items-center gap-3 text-xs font-mono-tabular">
                <span className="text-slate-600 dark:text-slate-300">
                  {language === 'bn' ? 'ব্যবহৃত:' : 'Used:'} {storageMetrics.usedMb} MB / {storageMetrics.quotaMb} MB ({storageMetrics.pct}%)
                </span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  {language === 'bn' ? 'বাকি:' : 'Remaining:'} {storageMetrics.remainingMb} MB
                </span>
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  storageMetrics.pct >= 95 ? 'bg-red-600' : storageMetrics.pct >= 80 ? 'bg-amber-500' : 'bg-blue-600'
                }`}
                style={{ width: `${storageMetrics.pct}%` }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono-tabular">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950 px-3 py-2 border border-slate-200 dark:border-slate-800">
                PDF Library ({pdfDocuments.length}): {storageMetrics.pdfMb} MB
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950 px-3 py-2 border border-slate-200 dark:border-slate-800">
                Archived Reports ({storageMetrics.storedReportsCount}): {storageMetrics.reportMb} MB
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950 px-3 py-2 border border-slate-200 dark:border-slate-800">
                Report Assets ({storageMetrics.storedAssetsCount}): {storageMetrics.assetMb} MB
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {language === 'bn'
                ? 'সকল ডকুমেন্ট, রিপোর্ট ও ছবি Firebase Authentication UID দ্বারা আপনার ব্যক্তিগত Cloudflare R2 ক্লাউড স্টোরেজে সুরক্ষিত থাকে।'
                : 'All uploaded documents, archived report PDFs, and report assets are stored privately under your authenticated UID in Cloudflare R2 / Private Cloud Storage.'}
            </p>
          </div>

          {user && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={downloadMyData}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>{language === 'bn' ? 'আমার সকল ডেটা ডাউনলোড করুন (JSON)' : 'Download My Data (JSON)'}</span>
              </button>

              {allowDeleteReq && (
                profile?.deletionRequested ? (
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    {language === 'bn' ? 'অ্যাকাউন্ট ডিলিট অনুরোধ পাঠানো হয়েছে (অ্যাডমিন পর্যালোচনায়)।' : 'Account deletion request submitted (pending admin review).'}
                  </span>
                ) : confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Confirm request?
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await requestAccountDeletion();
                        setConfirmDelete(false);
                      }}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/60 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{language === 'bn' ? 'অ্যাকাউন্ট মুছে ফেলার অনুরোধ' : 'Request Account Deletion'}</span>
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Preferences & Privacy Tab */}
      {tab === 'preferences' && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs font-semibold">Language / ভাষা</p>
                  <p className="text-[11px] text-slate-500">{language === 'en' ? 'English' : 'বাংলা (Bengali)'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
              >
                Switch to {language === 'en' ? 'বাংলা' : 'English'}
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="flex items-center gap-2.5">
                {theme === 'light' ? <Sun className="w-4 h-4 text-blue-600" /> : <Moon className="w-4 h-4 text-blue-400" />}
                <div>
                  <p className="text-xs font-semibold">Appearance</p>
                  <p className="text-[11px] text-slate-500 capitalize">{theme} mode</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
              >
                Toggle {theme === 'light' ? 'Dark' : 'Light'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Default Calculator</label>
              <select
                value={form.defaultCalculator}
                onChange={(e) => setField('defaultCalculator', e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="normal">Normal Calculator</option>
                <option value="scientific">Scientific Calculator</option>
                <option value="engineering">Engineering Calculators</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Preferred Unit System</label>
              <select
                value={form.preferredUnitSystem}
                onChange={(e) => setField('preferredUnitSystem', e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="SI">SI (Metric)</option>
                <option value="Imperial">Imperial</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Profile Visibility</label>
              <select
                value={form.profileVisibility}
                onChange={(e) => setField('profileVisibility', e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="private">Private (Owner & Admin Only)</option>
                <option value="team">Team / Engineering Directory</option>
              </select>
            </div>
          </div>

          {/* Dynamic Theme Brand Color Palette Picker */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-brand-primary" />
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                    {language === 'bn' ? 'ডাইনামিক ব্র্যান্ড কালার প্যালেট' : 'Dynamic Brand Color Palette'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {language === 'bn'
                      ? 'প্রাইমারি ও সেকেন্ডারি ব্র্যান্ড কালার বেছে নিন যা পুরো অ্যাপে প্রতিফলিত হবে।'
                      : 'Choose primary and secondary brand colors that reflect across navigation, highlights, and actions.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => applyPaletteLive('#2563eb', '#0f766e', 'cobalt-teal')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{language === 'bn' ? 'ডিফল্ট' : 'Reset'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {THEME_PRESETS.map((preset) => {
                const selected = form.primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                  form.secondaryColor.toLowerCase() === preset.secondary.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPaletteLive(preset.primary, preset.secondary, preset.id)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-all cursor-pointer ${
                      selected
                        ? 'border-brand-primary bg-brand-soft font-semibold text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="flex items-center -space-x-1 shrink-0">
                      <span className="w-4 h-4 rounded-full border border-white dark:border-slate-900" style={{ backgroundColor: preset.primary }} />
                      <span className="w-4 h-4 rounded-full border border-white dark:border-slate-900" style={{ backgroundColor: preset.secondary }} />
                    </span>
                    <span className="truncate">{language === 'bn' ? preset.nameBn : preset.nameEn}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs">
                <div>
                  <span className="font-semibold block">{language === 'bn' ? 'প্রাইমারি কালার' : 'Primary Brand Color'}</span>
                  <span className="text-[11px] font-mono-tabular text-slate-500 uppercase">{form.primaryColor}</span>
                </div>
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => applyPaletteLive(e.target.value, form.secondaryColor, 'custom')}
                  aria-label="Primary Brand Color"
                  className="w-9 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs">
                <div>
                  <span className="font-semibold block">{language === 'bn' ? 'সেকেন্ডারি কালার' : 'Secondary Accent Color'}</span>
                  <span className="text-[11px] font-mono-tabular text-slate-500 uppercase">{form.secondaryColor}</span>
                </div>
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => applyPaletteLive(form.primaryColor, e.target.value, 'custom')}
                  aria-label="Secondary Accent Color"
                  className="w-9 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.inAppNotifications}
                onChange={(e) => setField('inAppNotifications', e.target.checked)}
              />
              <span>Enable In-App Notifications</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.emailNotifications}
                onChange={(e) => setField('emailNotifications', e.target.checked)}
              />
              <span>Enable Email Updates</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={requestNotifications}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-blue-600" />
                <span>Browser Notifications</span>
              </button>
              <PWAInstallButton language={language} />
            </div>

            {user && (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'পছন্দ সংরক্ষণ করুন' : 'Save Preferences'}</span>
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
