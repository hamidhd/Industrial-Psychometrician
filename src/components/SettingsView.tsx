import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { faDigits, jdate, KIND_LABEL, testById } from '../data/tests';
import {
  changeLocalPassword,
  createLocalUser,
  deleteLocalUser,
  listLocalUsers,
} from '../services/localAuthService';
import {
  localCreateWorkspace,
  localImportBackup,
  localUpdateWorkspaceMeta,
  localWipeWorkspace,
} from '../services/localStoreService';
import {
  changeServerPassword,
  createServerUser,
  createServerWorkspace,
  deleteServerUser,
  importServerBackup,
  listServerUsers,
  updateServerWorkspaceMeta,
  wipeServerWorkspace,
  type ServerClientContext,
} from '../services/serverApiService';
import {
  checkBackendHealth,
  getConfiguredBackendUrl,
  isTauriRuntime,
  setConfiguredBackendUrl,
} from '../utils/tauriBridge';
import type {
  AppUser,
  LegacyBackupPerson,
  ManagedAuthUser,
  Person,
  TestResult,
  Workspace,
} from '../types/psychometrics';

interface Props {
  useServer: boolean;
  serverCtx: ServerClientContext | null;
  currentUser: AppUser;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  onSelectWorkspace: (id: string) => void;
  computerLabel: string;
  onChangeComputerLabel: (label: string) => void;
  people: Person[];
  results: TestResult[];
  onRefreshAll: () => Promise<void>;
  onToast: (msg: string) => void;
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

export const SettingsView: React.FC<Props> = ({
  useServer,
  serverCtx,
  currentUser,
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  computerLabel,
  onChangeComputerLabel,
  people,
  results,
  onRefreshAll,
  onToast,
}) => {
  const [org, setOrg] = useState(activeWorkspace.org);
  const [examiner, setExaminer] = useState(activeWorkspace.examiner);
  const [stationInput, setStationInput] = useState(computerLabel);
  const [newWsOrg, setNewWsOrg] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [creatingWs, setCreatingWs] = useState(false);

  // Change own password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // Admin-only user management
  const [managedUsers, setManagedUsers] = useState<ManagedAuthUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserDept, setNewUserDept] = useState('ایمنی و بهداشت');
  const [newUserRole, setNewUserRole] = useState<'evaluator' | 'admin'>('evaluator');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  const [restoreDialog, setRestoreDialog] = useState<{
    org?: string;
    examiner?: string;
    people: LegacyBackupPerson[];
  } | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const inTauri = isTauriRuntime();
  const [backendUrl, setBackendUrl] = useState(() => getConfiguredBackendUrl());
  const [testingBackend, setTestingBackend] = useState(false);
  const [backendCheckMsg, setBackendCheckMsg] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    setOrg(activeWorkspace.org);
    setExaminer(activeWorkspace.examiner);
  }, [activeWorkspace.id, activeWorkspace.org, activeWorkspace.examiner]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        if (useServer && serverCtx) {
          const list = await listServerUsers(serverCtx);
          if (active) setManagedUsers(list);
        } else {
          if (active) setManagedUsers(listLocalUsers());
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoadingUsers(false);
      }
    };
    void loadUsers();
    return () => {
      active = false;
    };
  }, [isAdmin, useServer, serverCtx]);

  const legacyLocalData = useMemo(() => {
    try {
      const raw = localStorage.getItem('rsi_v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.people) && parsed.people.length > 0) {
        return parsed as { org?: string; examiner?: string; people: LegacyBackupPerson[] };
      }
    } catch {
      // ignore invalid local data
    }
    return null;
  }, []);

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMeta(true);
    try {
      if (useServer && serverCtx) {
        await updateServerWorkspaceMeta(serverCtx, activeWorkspace.id, org, examiner);
        await onRefreshAll();
      } else {
        localUpdateWorkspaceMeta(activeWorkspace.id, org, examiner);
      }
      onChangeComputerLabel(stationInput.trim() || 'رایانه مشترک');
      onToast('تنظیمات ذخیره شد');
    } catch {
      onToast('خطا در ذخیره‌ی تنظیمات');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      onToast('رمز عبور جدید باید حداقل ۸ کاراکتر باشد');
      return;
    }
    if (newPassword !== confirmPassword) {
      onToast('تکرار رمز عبور جدید مطابقت ندارد');
      return;
    }
    setChangingPass(true);
    try {
      if (useServer && serverCtx) {
        await changeServerPassword(serverCtx, currentPassword, newPassword);
      } else {
        await changeLocalPassword(currentUser.id, currentPassword, newPassword);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onToast('رمز عبور شما با موفقیت تغییر یافت');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'خطا در تغییر رمز عبور');
    } finally {
      setChangingPass(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(newUserUsername.trim())) {
      onToast('نام کاربری باید حداقل ۳ کاراکتر انگلیسی/عدد باشد');
      return;
    }
    if (newUserPassword.length < 8) {
      onToast('رمز عبور باید حداقل ۸ کاراکتر باشد');
      return;
    }
    setCreatingUser(true);
    try {
      const payload = {
        username: newUserUsername.trim(),
        name: newUserName.trim(),
        dept: newUserDept.trim() || 'ایمنی و بهداشت',
        role: newUserRole,
        password: newUserPassword,
      };
      const created =
        useServer && serverCtx
          ? await createServerUser(serverCtx, payload)
          : await createLocalUser(payload);
      setManagedUsers((prev) => [...prev, created]);
      setNewUserUsername('');
      setNewUserName('');
      setNewUserPassword('');
      onToast(`حساب ${created.name} ایجاد شد`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'خطا در ایجاد حساب کاربری');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (target: ManagedAuthUser) => {
    if (!isAdmin) return;
    try {
      if (useServer && serverCtx) {
        await deleteServerUser(serverCtx, target.id);
      } else {
        deleteLocalUser(currentUser.id, target.id);
      }
      setManagedUsers((prev) => prev.filter((u) => u.id !== target.id));
      onToast(`حساب ${target.name} حذف شد`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'خطا در حذف حساب کاربری');
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsOrg.trim()) return;
    setCreatingWs(true);
    try {
      const id =
        useServer && serverCtx
          ? await createServerWorkspace(serverCtx, newWsOrg.trim(), examiner)
          : localCreateWorkspace(newWsOrg.trim(), examiner, currentUser.name);
      if (useServer) await onRefreshAll();
      onSelectWorkspace(id);
      setNewWsOrg('');
      onToast('پایگاه داده جدید ایجاد شد');
    } catch {
      onToast('خطا در ایجاد پایگاه داده');
    } finally {
      setCreatingWs(false);
    }
  };

  const handleExportJSON = () => {
    const peopleWithResults = people.map((p) => ({
      ...p,
      results: results.filter((r) => r.personId === p.id),
    }));
    const payload = {
      org: activeWorkspace.org,
      examiner: activeWorkspace.examiner,
      people: peopleWithResults,
    };
    downloadFile(
      `psychotest-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    onToast('پشتیبان دریافت شد');
  };

  const handleExportCSV = () => {
    const personMap = new Map(people.map((p) => [p.id, p]));
    const rows: string[][] = [
      ['نام', 'کد', 'وضعیت', 'واحد', 'پست', 'آزمون', 'تاریخ', 'رایانه', 'شاخص', 'نمره', 'سطح'],
    ];
    results.forEach((r) => {
      const p = personMap.get(r.personId);
      if (!p) return;
      r.dims.forEach((d) => {
        rows.push([
          p.name,
          p.code,
          KIND_LABEL[p.kind],
          p.dept,
          p.job,
          testById(r.testId).title,
          jdate(r.date),
          r.computerLabel || '',
          d.name,
          d.display,
          d.label,
        ]);
      });
    });
    const csv =
      '\uFEFF' +
      rows
        .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
    downloadFile('psychotest-results.csv', csv, 'text/csv;charset=utf-8');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.people)) {
          onToast('فایل پشتیبان معتبر نیست');
          return;
        }
        setRestoreDialog(parsed);
      } catch {
        onToast('فایل پشتیبان معتبر نیست');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeImport = async (mode: 'merge' | 'replace') => {
    if (!restoreDialog) return;
    setBusyAction(true);
    try {
      const stats =
        useServer && serverCtx
          ? await importServerBackup(
              serverCtx,
              activeWorkspace.id,
              stationInput.trim() || 'سرور داخلی',
              restoreDialog,
              mode
            )
          : localImportBackup(
              activeWorkspace,
              currentUser.id,
              stationInput.trim() || 'ایستگاه محلی',
              restoreDialog,
              mode
            );
      if (useServer) await onRefreshAll();
      setRestoreDialog(null);
      onToast(
        `${faDigits(stats.importedPeople)} فرد و ${faDigits(stats.importedResults)} نتیجه وارد شد`
      );
    } catch {
      onToast('خطا در بازیابی پشتیبان');
    } finally {
      setBusyAction(false);
    }
  };

  const executeWipe = async () => {
    setBusyAction(true);
    try {
      if (useServer && serverCtx) {
        await wipeServerWorkspace(serverCtx, activeWorkspace.id);
        await onRefreshAll();
      } else {
        localWipeWorkspace(activeWorkspace.id);
      }
      setWipeConfirm(false);
      onToast('همه‌ی داده‌های این پایگاه داده حذف شد');
    } catch {
      onToast('خطا در حذف داده‌ها');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* اطلاعات گزارش و این رایانه */}
      <form
        onSubmit={handleSaveMeta}
        className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 space-y-4"
      >
        <h2 className="text-lg font-extrabold">اطلاعات گزارش و نام این رایانه</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label htmlFor="so" className="block text-xs font-medium mb-1">
              نام سازمان / شرکت / مجموعه
            </label>
            <input
              id="so"
              value={org}
              maxLength={120}
              onChange={(e) => setOrg(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm"
            />
          </div>
          <div>
            <label htmlFor="se" className="block text-xs font-medium mb-1">
              نام ارزیاب / مسئول HSE
            </label>
            <input
              id="se"
              value={examiner}
              maxLength={120}
              onChange={(e) => setExaminer(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm"
            />
          </div>
          <div>
            <label htmlFor="sc" className="block text-xs font-medium mb-1">
              برچسب این رایانه (ایستگاه آزمون)
            </label>
            <input
              id="sc"
              value={stationInput}
              maxLength={80}
              placeholder="مثلاً: رایانه ۱ — اتاق طب کار"
              onChange={(e) => setStationInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={savingMeta}
          className="px-5 py-2.5 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-90 disabled:opacity-50 cursor-pointer text-sm whitespace-nowrap"
        >
          {savingMeta ? 'در حال ذخیره…' : 'ذخیره'}
        </button>
      </form>

      {/* تغییر رمز عبور حساب فعلی */}
      <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-lg font-extrabold">امنیت و تغییر رمز عبور حساب فعلی</h2>
        </div>

        {currentUser.isEnvAdmin ? (
          <p className="text-xs leading-6 text-[var(--ink-muted)]">
            شما با حساب مدیر تعریف‌شده در تنظیمات محیطی سرور (<code className="num-ltr">ADMIN_PASSCODE</code>)
            وارد شده‌اید. برای تغییر این رمز، مقدار متغیر محیطی را در سرور سازمان به‌روزرسانی کنید.
          </p>
        ) : (
          <form onSubmit={handleChangeOwnPassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">رمز عبور فعلی</label>
              <input
                type="password"
                required
                dir="ltr"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">رمز جدید (حداقل ۸ کاراکتر)</label>
              <input
                type="password"
                required
                dir="ltr"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">تکرار رمز جدید</label>
              <input
                type="password"
                required
                dir="ltr"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={changingPass}
                className="px-5 py-2 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] text-sm cursor-pointer disabled:opacity-50"
              >
                {changingPass ? 'در حال ذخیره…' : 'به‌روزرسانی رمز عبور'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* مدیریت حساب‌های مدیران و ارزیابان (فقط مدیر ارشد) */}
      {isAdmin && (
        <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
            <div>
              <h2 className="text-lg font-extrabold">مدیریت حساب‌های مدیران و ارزیابان</h2>
              <p className="text-xs text-[var(--ink-muted)]">
                فقط مدیر ارشد می‌تواند حساب‌های جدید ارزیاب (طب کار / منابع انسانی) با رمز عبور
                مجزا تعریف یا دسترسی آن‌ها را لغو کند.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <input
              required
              dir="ltr"
              placeholder="نام کاربری (انگلیسی)"
              value={newUserUsername}
              onChange={(e) => setNewUserUsername(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-xs num-ltr"
            />
            <input
              required
              maxLength={120}
              placeholder="نام و نام خانوادگی"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-xs"
            />
            <input
              maxLength={100}
              placeholder="واحد (مثلاً: طب کار)"
              value={newUserDept}
              onChange={(e) => setNewUserDept(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-xs"
            />
            <select
              aria-label="نقش کاربری"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as 'evaluator' | 'admin')}
              className="px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-xs"
            >
              <option value="evaluator">ارزیاب / طب کار</option>
              <option value="admin">مدیر ارشد</option>
            </select>
            <input
              type="password"
              required
              dir="ltr"
              minLength={8}
              placeholder="رمز عبور (حداقل ۸ کاراکتر)"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-xs num-ltr"
            />
            <div className="sm:col-span-2 lg:col-span-5">
              <button
                type="submit"
                disabled={creatingUser}
                className="px-4 py-2 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] text-xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{creatingUser ? 'در حال ثبت…' : '+ ایجاد حساب ارزیاب / مدیر جدید'}</span>
              </button>
            </div>
          </form>

          {loadingUsers ? (
            <p className="text-xs text-[var(--ink-muted)]">در حال بارگذاری فهرست حساب‌ها…</p>
          ) : managedUsers.length > 0 ? (
            <ul className="divide-y divide-[var(--ink-faint)] border border-[var(--ink-faint)] rounded-xl bg-[var(--bg)]">
              {managedUsers.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm">{u.name}</span>
                    <span className="num-ltr px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--ink-faint)]">
                      {u.username}
                    </span>
                    <span className="text-[var(--ink-muted)]">
                      {u.role === 'admin' ? 'مدیر ارشد' : 'ارزیاب / طب کار'} · {u.dept}
                    </span>
                  </div>
                  {u.id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteUser(u)}
                      className="px-2.5 py-1 rounded-lg border border-[#dc2626]/40 text-[#dc2626] dark:text-[#f87171] hover:bg-[#dc2626]/10 cursor-pointer inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--ink-muted)]">
              حساب ذخیره‌شده‌ای در فهرست یافت نشد.
            </p>
          )}
        </div>
      )}

      {/* تغییر یا ایجاد پایگاه داده */}
      <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-extrabold">پایگاه‌های داده‌ی در دسترس شما</h2>
        <div className="flex flex-wrap items-center gap-2">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => onSelectWorkspace(ws.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer whitespace-nowrap transition-colors ${
                ws.id === activeWorkspace.id
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-fg)]'
                  : 'bg-[var(--ink-faint)] border-[var(--ink-faint)] hover:border-[var(--accent)]/40'
              }`}
            >
              {ws.org || 'پایگاه داده بدون نام'}
            </button>
          ))}
        </div>
        <form onSubmit={handleCreateWorkspace} className="flex flex-wrap gap-2 pt-2">
          <input
            value={newWsOrg}
            maxLength={120}
            placeholder="نام سازمان برای پایگاه داده جدید (مثلاً شعبه‌ی دوم)"
            onChange={(e) => setNewWsOrg(e.target.value)}
            className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm"
          />
          <button
            type="submit"
            disabled={creatingWs}
            className="px-4 py-2 rounded-lg font-bold bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 cursor-pointer text-sm whitespace-nowrap transition-colors"
          >
            + ایجاد پایگاه داده مجزا
          </button>
        </form>
      </div>

      {/* انتقال داده قدیمی مرورگر (در صورت وجود) */}
      {legacyLocalData && (
        <div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-5 text-sm space-y-2">
          <b className="text-[var(--accent)]">داده‌های قدیمی روی این رایانه یافت شد</b>
          <p className="text-xs">
            در حافظه‌ی محلی این مرورگر ({faDigits(legacyLocalData.people.length)} پرونده) از نسخه‌ی
            قبلی وجود دارد. می‌توانید آن‌ها را به پایگاه داده فعلی منتقل کنید.
          </p>
          <button
            type="button"
            onClick={() => setRestoreDialog(legacyLocalData)}
            className="px-3.5 py-1.5 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] text-xs cursor-pointer"
          >
            انتقال داده‌های محلی به پایگاه داده فعلی
          </button>
        </div>
      )}

      {/* پشتیبان‌گیری و خروجی */}
      <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-extrabold">پشتیبان‌گیری و خروجی</h2>
        <p className="text-xs text-[var(--ink-muted)]">
          گرفتن پشتیبان دوره‌ای و نگهداری فایل در محل امن توصیه می‌شود (فایل شامل اطلاعات محرمانه
          کارکنان است).
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportJSON}
            className="px-4 py-2 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-90 cursor-pointer text-sm whitespace-nowrap"
          >
            دریافت پشتیبان (JSON)
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-lg font-bold bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 cursor-pointer text-sm whitespace-nowrap transition-colors"
          >
            خروجی جدول (CSV برای Excel)
          </button>
          <label className="px-4 py-2 rounded-lg font-bold bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 cursor-pointer text-sm whitespace-nowrap transition-colors">
            بازیابی از پشتیبان
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* پاک‌سازی */}
      <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-extrabold">پاک‌سازی</h2>
        <p className="text-xs text-[var(--ink-muted)]">
          حذف همه‌ی افراد و نتایج این پایگاه داده. قابل بازگشت نیست مگر پشتیبان داشته باشید.
        </p>
        <button
          type="button"
          onClick={() => setWipeConfirm(true)}
          className="px-4 py-2 rounded-lg font-bold border border-[#dc2626]/40 text-[#dc2626] dark:border-[#f87171]/40 dark:text-[#f87171] hover:bg-[#dc2626]/10 cursor-pointer text-sm"
        >
          حذف همه‌ی داده‌ها
        </button>
      </div>

      {/* تنظیم سرور داخلی سازمان (برای ویندوز و اندروید) */}
      <div className="bg-[var(--surface)] border border-[var(--ink-faint)] rounded-2xl p-6 space-y-3">
        <h2 className="text-base font-extrabold">اتصال به سرور داخلی سازمان</h2>
        <p className="text-xs leading-6 text-[var(--ink-muted)]">
          {inTauri
            ? 'برای همگام‌سازی خودکار پرونده‌ها و نتایج بین ویندوز، اندروید و مرورگرهای شبکه داخلی سازمان، آدرس سرور داخلی (node server.ts) را وارد کنید.'
            : 'این نسخه مستقیماً به سرور داخلی سازمان متصل است. برای استفاده در نرم‌افزار نصبی ویندوز یا اندروید نیز می‌توانید آدرس این سرور را در دستگاه‌ها تنظیم کنید.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            dir="ltr"
            placeholder="http://192.168.1.10:3000"
            value={backendUrl}
            onChange={(e) => {
              setBackendUrl(e.target.value);
              setBackendCheckMsg(null);
            }}
            className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-xs num-ltr"
          />
          <button
            type="button"
            disabled={testingBackend}
            onClick={async () => {
              const saved = setConfiguredBackendUrl(backendUrl);
              setBackendUrl(saved);
              if (!saved) {
                setBackendCheckMsg('آدرس سرور پاک شد.');
                onToast('آدرس سرور داخلی پاک شد');
                return;
              }
              setTestingBackend(true);
              try {
                const res = await checkBackendHealth(saved);
                if (res.ok) {
                  const msg = `اتصال موفق (نسخه ${res.version || 'سرور داخلی'})`;
                  setBackendCheckMsg(msg);
                  onToast('آدرس سرور داخلی ذخیره و ارتباط تایید شد');
                } else {
                  setBackendCheckMsg(res.error || 'خطا در اتصال به سرور');
                  onToast('آدرس ذخیره شد اما سرور پاسخ نداد');
                }
              } finally {
                setTestingBackend(false);
              }
            }}
            className="px-4 py-2 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] text-xs cursor-pointer disabled:opacity-50"
          >
            {testingBackend ? 'در حال بررسی…' : 'ذخیره و بررسی اتصال'}
          </button>
        </div>
        {backendCheckMsg && (
          <p className="text-xs text-[var(--accent)] font-medium">{backendCheckMsg}</p>
        )}
      </div>

      {/* مودال بازیابی پشتیبان */}
      {restoreDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--ink-faint)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-extrabold">بازیابی پشتیبان در پایگاه داده</h2>
            <p className="text-sm text-[var(--ink-muted)]">
              {faDigits(restoreDialog.people.length)} فرد در فایل است. داده‌های فعلی جایگزین شود یا
              با آنها ادغام شود؟
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyAction}
                onClick={() => executeImport('replace')}
                className="px-4 py-2 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] text-sm cursor-pointer disabled:opacity-50"
              >
                جایگزین
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => executeImport('merge')}
                className="px-4 py-2 rounded-lg font-bold bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 text-sm cursor-pointer disabled:opacity-50"
              >
                ادغام
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => setRestoreDialog(null)}
                className="px-4 py-2 rounded-lg font-bold bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 text-sm cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال تایید پاک‌سازی */}
      {wipeConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--ink-faint)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-extrabold">حذف همه‌ی داده‌ها؟</h2>
            <p className="text-sm text-[var(--ink-muted)]">
              این کار تمام پرونده‌ها و نتایج این پایگاه داده را حذف می‌کند و برگشت‌پذیر نیست.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyAction}
                onClick={executeWipe}
                className="px-4 py-2 rounded-lg font-bold bg-[#dc2626] text-white text-sm cursor-pointer disabled:opacity-50"
              >
                {busyAction ? 'در حال حذف…' : 'بله، حذف شود'}
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={() => setWipeConfirm(false)}
                className="px-4 py-2 rounded-lg font-bold bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 text-sm cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
