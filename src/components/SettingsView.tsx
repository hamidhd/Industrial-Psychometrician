import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { faDigits, jdate, KIND_LABEL, testById } from '../data/tests';
import {
  createWorkspace,
  importBackupToWorkspace,
  type LegacyBackupPerson,
  updateWorkspaceAllowedEmails,
  updateWorkspaceMeta,
  wipeWorkspaceData,
} from '../services/firestoreService';
import {
  localCreateWorkspace,
  localImportBackup,
  localUpdateWorkspaceMeta,
  localWipeWorkspace,
} from '../services/localStoreService';
import type { Person, TestResult, Workspace } from '../types/psychometrics';

interface Props {
  useCloud: boolean;
  firebaseUser: User | null;
  currentUserId: string;
  currentUserName: string;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  onSelectWorkspace: (id: string) => void;
  computerLabel: string;
  onChangeComputerLabel: (label: string) => void;
  people: Person[];
  results: TestResult[];
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
  useCloud,
  firebaseUser,
  currentUserId,
  currentUserName,
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  computerLabel,
  onChangeComputerLabel,
  people,
  results,
  onToast,
}) => {
  const [org, setOrg] = useState(activeWorkspace.org);
  const [examiner, setExaminer] = useState(activeWorkspace.examiner);
  const [stationInput, setStationInput] = useState(computerLabel);
  const [newEmail, setNewEmail] = useState('');
  const [newWsOrg, setNewWsOrg] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingEmails, setSavingEmails] = useState(false);
  const [creatingWs, setCreatingWs] = useState(false);

  const [restoreDialog, setRestoreDialog] = useState<{
    org?: string;
    examiner?: string;
    people: LegacyBackupPerson[];
  } | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const isOwner = Boolean(useCloud && firebaseUser && activeWorkspace.ownerId === firebaseUser.uid);

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
      if (useCloud && firebaseUser) {
        await updateWorkspaceMeta(activeWorkspace.id, org, examiner);
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

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!useCloud || !firebaseUser) {
      onToast('اشتراک‌گذاری ابری فقط در حالت ورود با حساب گوگل فعال است');
      return;
    }
    const clean = newEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      onToast('ایمیل معتبر وارد کنید');
      return;
    }
    if (activeWorkspace.allowedEmails.includes(clean)) {
      onToast('این ایمیل از قبل در فهرست است');
      return;
    }
    if (activeWorkspace.allowedEmails.length >= 20) {
      onToast('حداکثر ۲۰ ایمیل همکار در هر پایگاه داده مجاز است');
      return;
    }
    setSavingEmails(true);
    try {
      await updateWorkspaceAllowedEmails(
        activeWorkspace,
        [...activeWorkspace.allowedEmails, clean],
        people.map((p) => p.id),
        results.map((r) => r.id)
      );
      setNewEmail('');
      onToast('دسترسی رایانه/همکار جدید اضافه و همگام شد');
    } catch {
      onToast('خطا در افزودن ایمیل همکار');
    } finally {
      setSavingEmails(false);
    }
  };

  const handleRemoveEmail = async (emailToRemove: string) => {
    if (!useCloud || !firebaseUser) return;
    if (emailToRemove === activeWorkspace.ownerEmail) return;
    setSavingEmails(true);
    try {
      await updateWorkspaceAllowedEmails(
        activeWorkspace,
        activeWorkspace.allowedEmails.filter((em) => em !== emailToRemove),
        people.map((p) => p.id),
        results.map((r) => r.id)
      );
      onToast('دسترسی ایمیل حذف شد');
    } catch {
      onToast('خطا در حذف دسترسی');
    } finally {
      setSavingEmails(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsOrg.trim()) return;
    setCreatingWs(true);
    try {
      const id =
        useCloud && firebaseUser
          ? await createWorkspace(firebaseUser, newWsOrg.trim(), examiner)
          : localCreateWorkspace(newWsOrg.trim(), examiner, currentUserName);
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
        useCloud && firebaseUser
          ? await importBackupToWorkspace(
              activeWorkspace,
              firebaseUser,
              stationInput.trim() || 'رایانه مشترک',
              restoreDialog,
              mode,
              people,
              results
            )
          : localImportBackup(
              activeWorkspace,
              currentUserId,
              stationInput.trim() || 'ایستگاه محلی',
              restoreDialog,
              mode
            );
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
      if (useCloud && firebaseUser) {
        await wipeWorkspaceData(
          activeWorkspace.id,
          people.map((p) => p.id),
          results.map((r) => r.id)
        );
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

      {/* اشتراک‌گذاری بین چند رایانه */}
      <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-lg font-extrabold">اتصال چند رایانه و همگام‌سازی ابری</h2>
          {useCloud ? (
            <p className="text-xs text-[var(--ink-muted)] mt-1 leading-6">
              حساب گوگل شما متصل است. روی تمام رایانه‌ها با همین حساب گوگل (
              <span className="num-ltr font-semibold text-[var(--ink)]">
                {activeWorkspace.ownerEmail}
              </span>
              ) وارد شوید یا ایمیل همکاران را در زیر اضافه کنید تا هم‌زمان به همین پایگاه داده
              دسترسی داشته باشند.
            </p>
          ) : (
            <p className="text-xs text-[var(--ink-muted)] mt-1 leading-6">
              شما در حال حاضر با نام کاربری محلی یا کد پرسنلی وارد شده‌اید؛ داده‌ها روی همین دستگاه
              ذخیره می‌شوند. برای انتقال اطلاعات بین چند رایانه بدون اینترنت/گوگل، از بخش «پشتیبان‌گیری
              و خروجی JSON» در پایین صفحه استفاده کنید.
            </p>
          )}
        </div>

        {useCloud && (
          <>
            <div className="border-t border-[var(--ink-faint)] pt-3">
              <div className="text-xs font-bold mb-2">حساب‌های مجاز به این پایگاه داده:</div>
              <ul className="divide-y divide-[var(--ink-faint)] border border-[var(--ink-faint)] rounded-xl bg-[var(--bg)]">
                {activeWorkspace.allowedEmails.map((em) => (
                  <li key={em} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="num-ltr truncate">{em}</span>
                      <span className="text-xs text-[var(--ink-muted)]">
                        {em === activeWorkspace.ownerEmail ? '· مالک' : '· همکار مجاز'}
                      </span>
                    </div>
                    {isOwner && em !== activeWorkspace.ownerEmail && (
                      <button
                        type="button"
                        disabled={savingEmails}
                        onClick={() => handleRemoveEmail(em)}
                        className="px-2.5 py-1 text-xs rounded-lg border border-[#dc2626]/40 text-[#dc2626] dark:text-[#f87171] dark:border-[#f87171]/40 cursor-pointer whitespace-nowrap"
                      >
                        لغو دسترسی
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {isOwner ? (
              <form onSubmit={handleAddEmail} className="flex flex-wrap gap-2">
                <input
                  type="email"
                  dir="ltr"
                  placeholder="colleague@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
                />
                <button
                  type="submit"
                  disabled={savingEmails}
                  className="px-4 py-2 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-90 disabled:opacity-50 cursor-pointer text-sm whitespace-nowrap"
                >
                  {savingEmails ? 'در حال همگام‌سازی…' : '+ افزودن رایانه / همکار'}
                </button>
              </form>
            ) : (
              <p className="text-xs text-[var(--ink-muted)]">
                فقط مالک پایگاه داده می‌تواند ایمیل همکاران جدید را اضافه یا حذف کند.
              </p>
            )}
          </>
        )}
      </div>

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
              {ws.org || 'پایگاه داده بدون نام'} ({faDigits(ws.allowedEmails.length)} کاربر)
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
            تک‌رایانه‌ی قبلی وجود دارد. می‌توانید آن‌ها را به پایگاه داده مشترک ابری منتقل کنید تا
            روی همه‌ی رایانه‌ها دیده شوند.
          </p>
          <button
            type="button"
            onClick={() => setRestoreDialog(legacyLocalData)}
            className="px-3.5 py-1.5 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] text-xs cursor-pointer"
          >
            انتقال داده‌های محلی به پایگاه داده مشترک
          </button>
        </div>
      )}

      {/* پشتیبان‌گیری و خروجی */}
      <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-extrabold">پشتیبان‌گیری و خروجی</h2>
        <p className="text-xs text-[var(--ink-muted)]">
          گرفتن پشتیبان دوره‌ای و نگهداری فایل در محل امن توصیه می‌شود (فایل شامل اطلاعات حساس
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
          حذف همه‌ی افراد و نتایج این پایگاه داده مشترک. قابل بازگشت نیست مگر پشتیبان داشته باشید.
        </p>
        <button
          type="button"
          onClick={() => setWipeConfirm(true)}
          className="px-4 py-2 rounded-lg font-bold border border-[#dc2626]/40 text-[#dc2626] dark:border-[#f87171]/40 dark:text-[#f87171] hover:bg-[#dc2626]/10 cursor-pointer text-sm"
        >
          حذف همه‌ی داده‌ها
        </button>
      </div>

      {/* مودال بازیابی پشتیبان */}
      {restoreDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--ink-faint)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-extrabold">بازیابی پشتیبان در پایگاه داده مشترک</h2>
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
              این کار تمام پرونده‌ها و نتایج را برای همه‌ی رایانه‌های متصل به این پایگاه داده حذف
              می‌کند و برگشت‌پذیر نیست.
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
