import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  Download,
  Eye,
  FileSpreadsheet,
  Info,
  MessageSquare,
  Save,
  Search,
  User,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useApp } from '../../context/AppContext';
import {
  DesignerInfoRecord,
  SuggestionRecord,
  SuggestionStatus,
  UserActivityLogRecord,
  UserProfile,
  UserRole,
  UserStorageUsageRecord,
} from '../../types';

const SUGGESTION_STATUSES: SuggestionStatus[] = [
  'Submitted',
  'Under Review',
  'Accepted',
  'In Development',
  'Completed',
  'Rejected',
];

function formatCreatedDate(ts: unknown): string {
  const t = ts as { toDate?: () => Date } | undefined;
  if (t && typeof t.toDate === 'function') {
    return t.toDate().toISOString().slice(0, 10);
  }
  return '—';
}

// =========================================================================
// 1. ADMIN 16-COLUMN USER DIRECTORY & 8-TAB DETAILS MODAL
// =========================================================================
export const AdminUserDirectoryPanel: React.FC = () => {
  const {
    user: adminUser,
    allUsers,
    getUserStorageQuotaBytes,
    logAdminAudit,
    showToast,
  } = useApp();

  const [storageMap, setStorageMap] = useState<Map<string, UserStorageUsageRecord>>(new Map());
  const [calcCountMap, setCalcCountMap] = useState<Map<string, number>>(new Map());

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'premium' | 'custom'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'logins' | 'storage' | 'pdfs'>('name');

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<
    'personal' | 'education' | 'professional' | 'usage' | 'storage' | 'calcs' | 'activity' | 'permissions'
  >('personal');
  const [editDraft, setEditDraft] = useState<Partial<UserProfile>>({});
  const [savingUser, setSavingUser] = useState(false);

  const [userActivity, setUserActivity] = useState<UserActivityLogRecord[]>([]);
  const [userCalcBreakdown, setUserCalcBreakdown] = useState<{ dynamicCount: number; sciNormalCount: number }>({
    dynamicCount: 0,
    sciNormalCount: 0,
  });

  // Load admin-wide storage usage records & calculation counts safely
  useEffect(() => {
    let active = true;
    const loadTelemetry = async () => {
      try {
        const stSnap = await getDocs(collection(db, 'userStorageUsage'));
        if (!active) return;
        const map = new Map<string, UserStorageUsageRecord>();
        stSnap.docs.forEach((d) => {
          const rec = d.data() as UserStorageUsageRecord;
          map.set(rec.userId || d.id, rec);
        });
        setStorageMap(map);
      } catch {
        // Ignore if index or permission not ready
      }

      try {
        const [dynSnap, calcSnap] = await Promise.all([
          getDocs(collection(db, 'calculationHistory')),
          getDocs(collection(db, 'calculatorHistory')),
        ]);
        if (!active) return;
        const counts = new Map<string, number>();
        dynSnap.docs.forEach((d) => {
          const uid = String((d.data() as { userId?: string }).userId || '');
          if (uid) counts.set(uid, (counts.get(uid) || 0) + 1);
        });
        calcSnap.docs.forEach((d) => {
          const uid = String((d.data() as { userId?: string }).userId || '');
          if (uid) counts.set(uid, (counts.get(uid) || 0) + 1);
        });
        setCalcCountMap(counts);
      } catch {
        // Ignore
      }
    };
    void loadTelemetry();
    return () => {
      active = false;
    };
  }, [allUsers.length]);

  const selectedUser = useMemo(
    () => allUsers.find((u) => u.uid === selectedUid) || null,
    [allUsers, selectedUid]
  );

  useEffect(() => {
    if (!selectedUser) return;
    setEditDraft({ ...selectedUser });

    let active = true;
    const loadUserDetails = async () => {
      try {
        const [actSnap, dynSnap, calcSnap] = await Promise.all([
          getDocs(query(collection(db, 'userActivityLogs'), where('userId', '==', selectedUser.uid), limit(50))),
          getDocs(query(collection(db, 'calculationHistory'), where('userId', '==', selectedUser.uid))),
          getDocs(query(collection(db, 'calculatorHistory'), where('userId', '==', selectedUser.uid))),
        ]);
        if (!active) return;
        const acts = actSnap.docs.map((d) => d.data() as UserActivityLogRecord);
        acts.sort((a, b) => {
          const ta = (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() || 0;
          const tb = (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() || 0;
          return tb - ta;
        });
        setUserActivity(acts);
        setUserCalcBreakdown({
          dynamicCount: dynSnap.size,
          sciNormalCount: calcSnap.size,
        });
      } catch {
        // ignore
      }
    };
    void loadUserDetails();
    return () => {
      active = false;
    };
  }, [selectedUser]);

  const enrichedUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allUsers
      .map((u) => {
        const st = storageMap.get(u.uid);
        const totalPdfs = st?.totalFiles || 0;
        const totalBytes = st?.totalBytes || 0;
        const totalCalcs = calcCountMap.get(u.uid) || 0;
        return { u, st, totalPdfs, totalBytes, totalCalcs };
      })
      .filter(({ u }) => {
        if (roleFilter !== 'all' && u.role !== roleFilter) return false;
        if (statusFilter !== 'all' && u.status !== statusFilter) return false;
        const acct = u.accountType || 'free';
        if (planFilter !== 'all' && acct !== planFilter) return false;
        if (!q) return true;
        return (
          (u.displayName || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.mobile || '').toLowerCase().includes(q) ||
          (u.profession || '').toLowerCase().includes(q) ||
          (u.department || '').toLowerCase().includes(q) ||
          (u.country || '').toLowerCase().includes(q)
        );
      });

    return list.sort((a, b) => {
      if (sortBy === 'logins') return (b.u.loginCount || 0) - (a.u.loginCount || 0);
      if (sortBy === 'storage') return b.totalBytes - a.totalBytes;
      if (sortBy === 'pdfs') return b.totalPdfs - a.totalPdfs;
      return (a.u.displayName || '').localeCompare(b.u.displayName || '');
    });
  }, [allUsers, calcCountMap, planFilter, roleFilter, search, sortBy, statusFilter, storageMap]);

  const kpis = useMemo(() => {
    const total = allUsers.length;
    const active = allUsers.filter((u) => u.status === 'active').length;
    const suspended = allUsers.filter((u) => u.status === 'suspended').length;
    const deletionReqs = allUsers.filter((u) => u.deletionRequested).length;
    const totalBytes = Array.from(storageMap.values()).reduce((acc, s) => acc + (s.totalBytes || 0), 0);
    return { total, active, suspended, deletionReqs, totalMb: (totalBytes / 1024 / 1024).toFixed(2) };
  }, [allUsers, storageMap]);

  const handleSaveDrawerUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSavingUser(true);
    try {
      const payload: Record<string, unknown> = {
        displayName: editDraft.displayName || selectedUser.displayName,
        mobile: editDraft.mobile || '',
        gender: editDraft.gender || '',
        country: editDraft.country || '',
        division: editDraft.division || '',
        district: editDraft.district || '',
        city: editDraft.city || '',
        address: editDraft.address || '',
        educationLevel: editDraft.educationLevel || '',
        institutionName: editDraft.institutionName || '',
        department: editDraft.department || '',
        subject: editDraft.subject || '',
        classOrSemester: editDraft.classOrSemester || '',
        passingYear: editDraft.passingYear || '',
        qualification: editDraft.qualification || '',
        profession: editDraft.profession || '',
        jobTitle: editDraft.jobTitle || '',
        companyName: editDraft.companyName || '',
        workDepartment: editDraft.workDepartment || '',
        workExperience: editDraft.workExperience || '',
        skills: editDraft.skills || '',
        specialization: editDraft.specialization || '',
        engineeringDiscipline: editDraft.engineeringDiscipline || '',
        designation: editDraft.designation || '',
        licenseNumber: editDraft.licenseNumber || '',
        role: editDraft.role || selectedUser.role,
        status: editDraft.status || selectedUser.status,
        accountType: editDraft.accountType || 'free',
        storageLimitMb: Number(editDraft.storageLimitMb) || 100,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, 'users', selectedUser.uid), payload);
      if (payload.role === 'admin') {
        await setDoc(doc(db, 'admins', selectedUser.uid), {
          uid: selectedUser.uid,
          email: selectedUser.email,
          grantedBy: adminUser?.uid || 'admin',
          createdAt: serverTimestamp(),
        });
      } else if (selectedUser.role === 'admin' && payload.role !== 'admin') {
        await deleteDoc(doc(db, 'admins', selectedUser.uid)).catch(() => {});
      }
      await logAdminAudit(
        'ADMIN_UPDATE_USER',
        'users',
        selectedUser.uid,
        `Updated profile/quota/RBAC for ${selectedUser.email}: role=${payload.role}, status=${payload.status}, plan=${payload.accountType}, limitMb=${payload.storageLimitMb}`
      );
      showToast('User profile, quota, and permissions updated.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${selectedUser.uid}`);
    } finally {
      setSavingUser(false);
    }
  };

  const handleExportUsers = (format: 'xlsx' | 'csv') => {
    const rows = enrichedUsers.map(({ u, totalPdfs, totalBytes, totalCalcs }, idx) => ({
      'S/N': idx + 1,
      'Full Name': u.displayName || '',
      Email: u.email || '',
      Mobile: u.mobile || '',
      Profession: u.profession || '',
      Education: u.educationLevel || '',
      Department: u.department || u.workDepartment || '',
      Country: u.country || '',
      'Created Date': formatCreatedDate(u.createdAt),
      'Last Login': u.lastLoginAtIso ? u.lastLoginAtIso.slice(0, 16).replace('T', ' ') : '—',
      Status: u.status,
      Role: u.role,
      'Total PDFs': totalPdfs,
      'Storage Used (MB)': (totalBytes / 1024 / 1024).toFixed(2),
      'Total Calculations': totalCalcs,
      'Account Type': u.accountType || 'free',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    if (format === 'xlsx') {
      XLSX.writeFile(wb, `sutro-sathi-users-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      XLSX.writeFile(wb, `sutro-sathi-users-${new Date().toISOString().slice(0, 10)}.csv`, { bookType: 'csv' });
    }
    showToast(`Exported ${rows.length} users as ${format.toUpperCase()}`, 'success');
  };

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Users', val: kpis.total },
          { label: 'Active', val: kpis.active },
          { label: 'Suspended', val: kpis.suspended },
          { label: 'Deletion Requests', val: kpis.deletionReqs },
          { label: 'Cloud Storage (R2) Used', val: `${kpis.totalMb} MB` },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-[11px] text-slate-500">{k.label}</p>
            <p className="mt-1 text-xl font-bold font-mono-tabular text-slate-900 dark:text-white">{k.val}</p>
          </div>
        ))}
      </div>

      {/* Filters & Export Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Complete User Directory &amp; Storage Management ({enrichedUsers.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportUsers('xlsx')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportUsers('csv')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="lg:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, mobile, profession, dept..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs">
            <option value="all">All Roles</option>
            <option value="user">user</option>
            <option value="engineer">engineer</option>
            <option value="admin">admin</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'suspended')} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs">
            <option value="all">All Status</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </select>
          <div className="flex gap-2">
            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as 'all' | 'free' | 'premium' | 'custom')} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs">
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
              <option value="custom">Custom</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs">
              <option value="name">Sort: Name</option>
              <option value="logins">Sort: Logins</option>
              <option value="storage">Sort: Storage</option>
              <option value="pdfs">Sort: PDFs</option>
            </select>
          </div>
        </div>

        {/* 16-Column User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 pr-3">S/N</th>
                <th className="py-2 pr-3">Photo</th>
                <th className="py-2 pr-3">Full Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Mobile</th>
                <th className="py-2 pr-3">Profession</th>
                <th className="py-2 pr-3">Education</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2 pr-3">Country</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Last Login</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">PDFs</th>
                <th className="py-2 pr-3">Storage Used</th>
                <th className="py-2 pr-3">Calculations</th>
                <th className="py-2 pr-3">Account Type</th>
                <th className="py-2">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {enrichedUsers.map(({ u, totalPdfs, totalBytes, totalCalcs }, idx) => (
                <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-3 font-mono-tabular text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 pr-3">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt={u.displayName} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-white">
                    {u.displayName}
                    {u.deletionRequested && <span className="ml-1.5 text-[10px] text-red-600">[DEL REQ]</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-500">{u.email}</td>
                  <td className="py-2.5 pr-3 font-mono-tabular">{u.mobile || '—'}</td>
                  <td className="py-2.5 pr-3">{u.profession || '—'}</td>
                  <td className="py-2.5 pr-3">{u.educationLevel || '—'}</td>
                  <td className="py-2.5 pr-3">{u.department || u.workDepartment || '—'}</td>
                  <td className="py-2.5 pr-3">{u.country || '—'}</td>
                  <td className="py-2.5 pr-3 font-mono-tabular">{formatCreatedDate(u.createdAt)}</td>
                  <td className="py-2.5 pr-3 font-mono-tabular">
                    {u.lastLoginAtIso ? u.lastLoginAtIso.slice(0, 10) : '—'}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`font-semibold ${u.status === 'active' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono-tabular">{totalPdfs}</td>
                  <td className="py-2.5 pr-3 font-mono-tabular">
                    {(totalBytes / 1024 / 1024).toFixed(2)} / {(getUserStorageQuotaBytes(u) / 1024 / 1024).toFixed(0)} MB
                  </td>
                  <td className="py-2.5 pr-3 font-mono-tabular">{totalCalcs}</td>
                  <td className="py-2.5 pr-3 uppercase font-mono text-[11px]">{u.accountType || 'free'}</td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUid(u.uid);
                        setDrawerTab('personal');
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8-Tab User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  User Inspector — {selectedUser.displayName}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedUser.email} · UID: {selectedUser.uid}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUid(null)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 8 Drawer Tabs */}
            <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              {(
                [
                  { id: 'personal', label: '1. Personal' },
                  { id: 'education', label: '2. Education' },
                  { id: 'professional', label: '3. Professional' },
                  { id: 'usage', label: '4. App Usage' },
                  { id: 'storage', label: '5. Cloud Storage (R2)' },
                  { id: 'calcs', label: '6. Calculations' },
                  { id: 'activity', label: '7. Activity Logs' },
                  { id: 'permissions', label: '8. Permissions & Quota' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDrawerTab(t.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                    drawerTab === t.id
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveDrawerUser} className="space-y-4">
              {drawerTab === 'personal' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {(
                    [
                      ['displayName', 'Full Name'],
                      ['mobile', 'Mobile'],
                      ['gender', 'Gender'],
                      ['country', 'Country'],
                      ['division', 'Division'],
                      ['district', 'District'],
                      ['city', 'City'],
                      ['address', 'Address'],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className="block font-medium mb-1">{label}</label>
                      <input
                        type="text"
                        value={String(editDraft[field] || '')}
                        onChange={(e) => setEditDraft((p) => ({ ...p, [field]: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5"
                      />
                    </div>
                  ))}
                </div>
              )}

              {drawerTab === 'education' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {(
                    [
                      ['educationLevel', 'Education Level'],
                      ['institutionName', 'Institution Name'],
                      ['department', 'Department'],
                      ['subject', 'Subject'],
                      ['classOrSemester', 'Class / Semester'],
                      ['passingYear', 'Passing Year'],
                      ['qualification', 'Qualification'],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className="block font-medium mb-1">{label}</label>
                      <input
                        type="text"
                        value={String(editDraft[field] || '')}
                        onChange={(e) => setEditDraft((p) => ({ ...p, [field]: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5"
                      />
                    </div>
                  ))}
                </div>
              )}

              {drawerTab === 'professional' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {(
                    [
                      ['profession', 'Profession'],
                      ['jobTitle', 'Job Title'],
                      ['companyName', 'Company Name'],
                      ['workDepartment', 'Work Department'],
                      ['workExperience', 'Work Experience'],
                      ['skills', 'Skills'],
                      ['specialization', 'Specialization'],
                      ['engineeringDiscipline', 'Engineering Discipline'],
                      ['designation', 'Designation'],
                      ['licenseNumber', 'License / Cert No.'],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className="block font-medium mb-1">{label}</label>
                      <input
                        type="text"
                        value={String(editDraft[field] || '')}
                        onChange={(e) => setEditDraft((p) => ({ ...p, [field]: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5"
                      />
                    </div>
                  ))}
                </div>
              )}

              {drawerTab === 'usage' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-slate-500">Account Created</p>
                    <p className="font-bold font-mono-tabular mt-1">{formatCreatedDate(selectedUser.createdAt)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-slate-500">Last Login</p>
                    <p className="font-bold font-mono-tabular mt-1">{selectedUser.lastLoginAtIso || '—'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-slate-500">Total Logins</p>
                    <p className="font-bold font-mono-tabular mt-1">{selectedUser.loginCount || 0}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-slate-500">Account Status</p>
                    <p className="font-bold uppercase mt-1">{selectedUser.status}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-slate-500">Deletion Requested</p>
                    <p className="font-bold mt-1">{selectedUser.deletionRequested ? `YES (${selectedUser.deletionRequestedAtIso || ''})` : 'No'}</p>
                  </div>
                </div>
              )}

              {drawerTab === 'storage' && (() => {
                const st = storageMap.get(selectedUser.uid);
                const quotaBytes = getUserStorageQuotaBytes(selectedUser);
                const usedBytes = st?.totalBytes || 0;
                const remainingBytes = Math.max(0, quotaBytes - usedBytes);
                const usedMb = (usedBytes / 1024 / 1024).toFixed(2);
                const remainingMb = (remainingBytes / 1024 / 1024).toFixed(1);
                const quotaMb = (quotaBytes / 1024 / 1024).toFixed(0);
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <p className="text-slate-500">Stored Files</p>
                      <p className="font-bold text-lg font-mono-tabular">{st?.totalFiles || 0}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <p className="text-slate-500">PDF Pages</p>
                      <p className="font-bold text-lg font-mono-tabular">{st?.totalPages || 0}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <p className="text-slate-500">Used Storage</p>
                      <p className="font-bold text-lg font-mono-tabular">{usedMb} MB</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <p className="text-slate-500">Remaining</p>
                      <p className="font-bold text-lg font-mono-tabular text-emerald-700 dark:text-emerald-400">{remainingMb} MB</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <p className="text-slate-500">Active Quota</p>
                      <p className="font-bold text-lg font-mono-tabular">{quotaMb} MB</p>
                    </div>
                  </div>
                );
              })()}

              {drawerTab === 'calcs' && (
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-slate-500">Engineering Formula Runs</p>
                    <p className="font-bold text-lg font-mono-tabular">{userCalcBreakdown.dynamicCount}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-slate-500">Normal &amp; Scientific Runs</p>
                    <p className="font-bold text-lg font-mono-tabular">{userCalcBreakdown.sciNormalCount}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-slate-500">Total Cloud Calculations</p>
                    <p className="font-bold text-lg font-mono-tabular text-blue-700 dark:text-blue-400">
                      {userCalcBreakdown.dynamicCount + userCalcBreakdown.sciNormalCount}
                    </p>
                  </div>
                </div>
              )}

              {drawerTab === 'activity' && (
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {userActivity.length === 0 ? (
                    <p className="py-6 text-center text-slate-500">No user activity events logged yet.</p>
                  ) : (
                    userActivity.map((act) => (
                      <div key={act.id} className="py-2 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">{act.action}</span>
                          <span className="mx-1.5 text-slate-400">·</span>
                          <span className="text-slate-600 dark:text-slate-300">{act.summary}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">{act.module}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {drawerTab === 'permissions' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block font-medium mb-1">Role (RBAC)</label>
                    <select
                      value={editDraft.role || 'user'}
                      onChange={(e) => setEditDraft((p) => ({ ...p, role: e.target.value as UserRole }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5"
                    >
                      <option value="user">user</option>
                      <option value="engineer">engineer</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Account Status</label>
                    <select
                      value={editDraft.status || 'active'}
                      onChange={(e) => setEditDraft((p) => ({ ...p, status: e.target.value as 'active' | 'suspended' }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5"
                    >
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Account Plan</label>
                    <select
                      value={editDraft.accountType || 'free'}
                      onChange={(e) => setEditDraft((p) => ({ ...p, accountType: e.target.value as 'free' | 'premium' | 'custom' }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5"
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                      <option value="custom">Custom Quota</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Custom Storage Limit (MB)</label>
                    <input
                      type="number"
                      min={10}
                      max={102400}
                      value={editDraft.storageLimitMb ?? 100}
                      onChange={(e) => setEditDraft((p) => ({ ...p, storageLimitMb: Number(e.target.value) || 100 }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 font-mono-tabular"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUid(null)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingUser ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// 2. ADMIN SUGGESTIONS & FEEDBACK MANAGEMENT PANEL
// =========================================================================
export const AdminSuggestionsPanel: React.FC = () => {
  const { adminAllSuggestions, adminUpdateSuggestion, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SuggestionStatus>('all');
  const [selectedSug, setSelectedSug] = useState<SuggestionRecord | null>(null);
  const [replyText, setReplyText] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [nextStatus, setNextStatus] = useState<SuggestionStatus>('Under Review');
  const [isImportant, setIsImportant] = useState(false);
  const [isDevTask, setIsDevTask] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return adminAllSuggestions.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.userName.toLowerCase().includes(q) ||
        s.userEmail.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });
  }, [adminAllSuggestions, search, statusFilter]);

  const openDetail = (s: SuggestionRecord) => {
    setSelectedSug(s);
    setReplyText(s.adminReply || '');
    setInternalNote(s.internalNote || '');
    setNextStatus(s.status);
    setIsImportant(Boolean(s.isImportant));
    setIsDevTask(Boolean(s.isDevelopmentTask));
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSug) return;
    await adminUpdateSuggestion(selectedSug.id, {
      status: nextStatus,
      adminReply: replyText.trim(),
      internalNote: internalNote.trim(),
      isImportant,
      isDevelopmentTask: isDevTask,
    });
    setSelectedSug(null);
  };

  const handleExport = (fmt: 'xlsx' | 'csv') => {
    const rows = filtered.map((s) => ({
      ID: s.id,
      Title: s.title,
      Category: s.category,
      Module: s.relatedModule,
      User: s.userName,
      Email: s.userEmail,
      Priority: s.priority,
      Visibility: s.visibility,
      Votes: s.voteCount || 0,
      Status: s.status,
      Important: s.isImportant ? 'Yes' : 'No',
      DevTask: s.isDevelopmentTask ? 'Yes' : 'No',
      AdminReply: s.adminReply || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suggestions');
    XLSX.writeFile(wb, `sutro-sathi-suggestions.${fmt}`, fmt === 'csv' ? { bookType: 'csv' } : undefined);
    showToast(`Exported ${rows.length} suggestions`, 'success');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span>User Suggestions &amp; Feature Requests ({filtered.length})</span>
          </h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleExport('xlsx')} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs cursor-pointer">Export Excel</button>
            <button type="button" onClick={() => handleExport('csv')} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs cursor-pointer">Export CSV</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suggestions..."
            className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | SuggestionStatus)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
          >
            <option value="all">All Statuses</option>
            {SUGGESTION_STATUSES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2 pr-3">Votes</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-white">
                    {s.isImportant ? '★ ' : ''}
                    {s.title}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-500">{s.category}</td>
                  <td className="py-2.5 pr-3">{s.userName}</td>
                  <td className="py-2.5 pr-3 uppercase font-mono">{s.priority}</td>
                  <td className="py-2.5 pr-3 font-mono-tabular">{s.voteCount || 0}</td>
                  <td className="py-2.5 pr-3 font-semibold text-blue-700 dark:text-blue-400">{s.status}</td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      onClick={() => openDetail(s)}
                      className="text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Review / Reply
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSug && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveReview}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold">{selectedSug.title}</h3>
                <p className="text-xs text-slate-500">
                  {selectedSug.userName} ({selectedSug.userEmail}) · {selectedSug.category} · {selectedSug.relatedModule}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedSug(null)} className="p-1.5 text-slate-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800">
              {selectedSug.description}
            </p>
            {selectedSug.attachmentDataUrl && (
              <img src={selectedSug.attachmentDataUrl} alt="User Attachment" className="max-h-48 rounded-lg border border-slate-200 dark:border-slate-700" />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Status</label>
                <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as SuggestionStatus)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5">
                  {SUGGESTION_STATUSES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
              <label className="inline-flex items-center gap-2 pt-5 cursor-pointer">
                <input type="checkbox" checked={isImportant} onChange={(e) => setIsImportant(e.target.checked)} />
                <span>Mark Important</span>
              </label>
              <label className="inline-flex items-center gap-2 pt-5 cursor-pointer">
                <input type="checkbox" checked={isDevTask} onChange={(e) => setIsDevTask(e.target.checked)} />
                <span>Convert to Dev Task</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Public Admin Reply (Visible to User)</label>
              <textarea rows={2} value={replyText} onChange={(e) => setReplyText(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs" />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Internal Admin Note (Admin Only)</label>
              <textarea rows={2} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs" />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSelectedSug(null)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs cursor-pointer">Cancel</button>
              <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white cursor-pointer">Update Suggestion</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// 3. ADMIN DESIGNER INFORMATION EDITOR PANEL
// =========================================================================
export const AdminDesignerInfoPanel: React.FC = () => {
  const { designerInfo, saveDesignerInfo } = useApp();
  const [draft, setDraft] = useState<Omit<DesignerInfoRecord, 'id' | 'updatedAt' | 'updatedBy'>>({
    nameBn: designerInfo.nameBn,
    nameEn: designerInfo.nameEn,
    designationBn: designerInfo.designationBn,
    designationEn: designerInfo.designationEn,
    mobile: designerInfo.mobile,
    email: designerInfo.email || '',
    aboutBn: designerInfo.aboutBn,
    aboutEn: designerInfo.aboutEn,
    visionBn: designerInfo.visionBn,
    visionEn: designerInfo.visionEn,
    missionBn: designerInfo.missionBn,
    missionEn: designerInfo.missionEn,
  });

  useEffect(() => {
    setDraft({
      nameBn: designerInfo.nameBn,
      nameEn: designerInfo.nameEn,
      designationBn: designerInfo.designationBn,
      designationEn: designerInfo.designationEn,
      mobile: designerInfo.mobile,
      email: designerInfo.email || '',
      aboutBn: designerInfo.aboutBn,
      aboutEn: designerInfo.aboutEn,
      visionBn: designerInfo.visionBn,
      visionEn: designerInfo.visionEn,
      missionBn: designerInfo.missionBn,
      missionEn: designerInfo.missionEn,
    });
  }, [designerInfo]);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await saveDesignerInfo(draft);
      }}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 max-w-4xl"
    >
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Info className="w-4 h-4 text-blue-600" />
        <span>Designer Information Page Settings (designerInformation/global)</span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block font-medium mb-1">Designer Name (Bangla)</label>
          <input type="text" value={draft.nameBn} onChange={(e) => setDraft({ ...draft, nameBn: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5" />
        </div>
        <div>
          <label className="block font-medium mb-1">Designer Name (English)</label>
          <input type="text" value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5" />
        </div>
        <div>
          <label className="block font-medium mb-1">Mobile Number</label>
          <input type="text" value={draft.mobile} onChange={(e) => setDraft({ ...draft, mobile: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5" />
        </div>
        <div>
          <label className="block font-medium mb-1">Designation (Bangla)</label>
          <input type="text" value={draft.designationBn} onChange={(e) => setDraft({ ...draft, designationBn: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5" />
        </div>
        <div>
          <label className="block font-medium mb-1">Designation (English)</label>
          <input type="text" value={draft.designationEn} onChange={(e) => setDraft({ ...draft, designationEn: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5" />
        </div>
        <div>
          <label className="block font-medium mb-1">Contact Email (Optional)</label>
          <input type="email" value={draft.email || ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block font-medium mb-1">About (Bangla)</label>
          <textarea rows={3} value={draft.aboutBn} onChange={(e) => setDraft({ ...draft, aboutBn: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5" />
        </div>
        <div>
          <label className="block font-medium mb-1">About (English)</label>
          <textarea rows={3} value={draft.aboutEn} onChange={(e) => setDraft({ ...draft, aboutEn: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5" />
        </div>
        <div>
          <label className="block font-medium mb-1">Project Vision (Bangla)</label>
          <textarea rows={2} value={draft.visionBn} onChange={(e) => setDraft({ ...draft, visionBn: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5" />
        </div>
        <div>
          <label className="block font-medium mb-1">Project Vision (English)</label>
          <textarea rows={2} value={draft.visionEn} onChange={(e) => setDraft({ ...draft, visionEn: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5" />
        </div>
        <div>
          <label className="block font-medium mb-1">App Mission (Bangla)</label>
          <textarea rows={2} value={draft.missionBn} onChange={(e) => setDraft({ ...draft, missionBn: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5" />
        </div>
        <div>
          <label className="block font-medium mb-1">App Mission (English)</label>
          <textarea rows={2} value={draft.missionEn} onChange={(e) => setDraft({ ...draft, missionEn: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5" />
        </div>
      </div>

      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer"
      >
        <Save className="w-3.5 h-3.5" />
        <span>Save Designer Information</span>
      </button>
    </form>
  );
};
