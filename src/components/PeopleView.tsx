import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { PDF_MASTER_EMPLOYEES } from '../data/initialPersonnel';
import { faDigits, KIND_LABEL } from '../data/tests';
import {
  getCategoryForDept,
  normalizeFa,
  OCCUPATIONAL_CATEGORIES,
  PDF_WORK_UNITS,
} from '../data/workUnits';
import {
  batchCreatePeople,
  createPerson,
  deletePersonAndResults,
  updatePerson,
} from '../services/firestoreService';
import {
  localBatchCreatePeople,
  localCreatePerson,
  localDeletePersonAndResults,
  localUpdatePerson,
} from '../services/localStoreService';
import type {
  OccupationalCategoryId,
  Person,
  PersonKind,
  TestResult,
  Workspace,
} from '../types/psychometrics';

interface Props {
  useCloud: boolean;
  firebaseUser: User | null;
  currentUserId: string;
  workspace: Workspace;
  people: Person[];
  results: TestResult[];
  categoryFilter: '' | OccupationalCategoryId;
  onChangeCategoryFilter: (cat: '' | OccupationalCategoryId) => void;
  onStartTestFor: (personId: string) => void;
  onViewResultsFor: (personId: string) => void;
  onToast: (msg: string) => void;
}

export const PeopleView: React.FC<Props> = ({
  useCloud,
  firebaseUser,
  currentUserId,
  workspace,
  people,
  results,
  categoryFilter,
  onChangeCategoryFilter,
  onStartTestFor,
  onViewResultsFor,
  onToast,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<PersonKind>('candidate');
  const [dept, setDept] = useState('');
  const [job, setJob] = useState('');
  const [age, setAge] = useState('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importingPdf, setImportingPdf] = useState(false);

  const [filterText, setFilterText] = useState('');
  const [kindFilter, setKindFilter] = useState<'' | PersonKind>('');
  const [unitFilter, setUnitFilter] = useState('');
  const [showAllRows, setShowAllRows] = useState(false);

  const [editing, setEditing] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState<Person | null>(null);
  const [busyModal, setBusyModal] = useState(false);

  const resultCounts = useMemo(() => {
    const map = new Map<string, number>();
    results.forEach((r) => map.set(r.personId, (map.get(r.personId) || 0) + 1));
    return map;
  }, [results]);

  const unitsInActiveCategory = useMemo(() => {
    if (!categoryFilter) return PDF_WORK_UNITS;
    return PDF_WORK_UNITS.filter((u) => u.categoryId === categoryFilter);
  }, [categoryFilter]);

  const filtered = useMemo(() => {
    const q = normalizeFa(filterText);
    return people.filter((p) => {
      if (kindFilter && p.kind !== kindFilter) return false;
      if (categoryFilter) {
        const cat = getCategoryForDept(p.dept);
        if (!cat || cat.id !== categoryFilter) return false;
      }
      if (unitFilter && normalizeFa(p.dept) !== normalizeFa(unitFilter)) return false;
      if (!q) return true;
      return normalizeFa(`${p.name} ${p.code} ${p.dept} ${p.job}`).includes(q);
    });
  }, [people, filterText, kindFilter, categoryFilter, unitFilter]);

  const displayedRows = showAllRows ? filtered : filtered.slice(0, 60);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      onToast('ابتدا رضایت آگاهانه‌ی فرد را تأیید کنید');
      return;
    }
    if (!name.trim()) return;
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        code: code.trim(),
        kind,
        dept: dept.trim(),
        job: job.trim(),
        age: age.trim(),
        consent: true,
      };
      if (useCloud && firebaseUser) {
        await createPerson(workspace, firebaseUser, input);
      } else {
        localCreatePerson(workspace, currentUserId, input);
      }
      setName('');
      setCode('');
      setDept('');
      setJob('');
      setAge('');
      setConsent(false);
      onToast(useCloud ? 'فرد در پایگاه داده ابری ذخیره شد' : 'فرد با موفقیت ذخیره شد');
    } catch {
      onToast('خطا در ذخیره‌ی فرد');
    } finally {
      setSaving(false);
    }
  };

  const handleImportPdfRoster = async () => {
    setImportingPdf(true);
    try {
      const items = PDF_MASTER_EMPLOYEES.map((emp) => ({
        name: emp.name,
        code: emp.personnelId || emp.nationalCode,
        kind: 'employee' as PersonKind,
        dept: emp.dept,
        job: '',
        age: '',
      }));
      let added = 0;
      if (useCloud && firebaseUser) {
        const existingCodes = new Set(people.map((p) => p.code.trim()).filter(Boolean));
        added = await batchCreatePeople(workspace, firebaseUser, items, existingCodes);
      } else {
        added = localBatchCreatePeople(workspace, currentUserId, items);
      }
      if (added > 0) {
        onToast(`${faDigits(added)} نفر از لیست پرسنل کارخانه وارد شد`);
      } else {
        onToast('همه‌ی پرسنل لیست PDF از قبل در سامانه ثبت شده‌اند');
      }
    } catch {
      onToast('خطا در ورود دسته‌جمعی پرسنل');
    } finally {
      setImportingPdf(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    setBusyModal(true);
    try {
      const input = {
        name: editing.name,
        code: editing.code,
        kind: editing.kind,
        dept: editing.dept,
        job: editing.job,
        age: editing.age,
      };
      if (useCloud && firebaseUser) {
        await updatePerson(workspace.id, editing.id, input);
      } else {
        localUpdatePerson(workspace.id, editing.id, input);
      }
      setEditing(null);
      onToast('اطلاعات ویرایش شد');
    } catch {
      onToast('خطا در ویرایش اطلاعات');
    } finally {
      setBusyModal(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    setBusyModal(true);
    try {
      const personResultIds = results
        .filter((r) => r.personId === deleting.id)
        .map((r) => r.id);
      if (useCloud && firebaseUser) {
        await deletePersonAndResults(workspace.id, deleting.id, personResultIds);
      } else {
        localDeletePersonAndResults(workspace.id, deleting.id);
      }
      setDeleting(null);
      onToast('پرونده و نتایج حذف شد');
    } catch {
      onToast('خطا در حذف پرونده');
    } finally {
      setBusyModal(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">پرسنل و داوطلبان</h1>
        <button
          type="button"
          disabled={importingPdf}
          onClick={handleImportPdfRoster}
          className="px-3.5 py-2 rounded-lg font-bold border border-[#0e6a88] text-[#0e6a88] dark:text-[#4fb4d4] hover:bg-[#dcedf3]/50 dark:hover:bg-[#17323d]/60 disabled:opacity-50 cursor-pointer text-xs whitespace-nowrap shrink-0"
        >
          {importingPdf
            ? 'در حال بارگذاری…'
            : `ورود خودکار پرسنل کارخانه از PDF (${faDigits(PDF_MASTER_EMPLOYEES.length)} نفر)`}
        </button>
      </div>

      <datalist id="pdf-work-units">
        {PDF_WORK_UNITS.map((u) => (
          <option key={u.name} value={u.name} />
        ))}
      </datalist>

      <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5">
        <h2 className="text-lg font-bold mb-3">ثبت فرد جدید</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label htmlFor="pn" className="block text-xs font-medium mb-1">
              نام و نام خانوادگی *
            </label>
            <input
              id="pn"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
            />
          </div>
          <div>
            <label htmlFor="pc" className="block text-xs font-medium mb-1">
              کد پرسنلی / کد ملی (اختیاری)
            </label>
            <input
              id="pc"
              inputMode="numeric"
              maxLength={40}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
            />
          </div>
          <div>
            <label htmlFor="pk" className="block text-xs font-medium mb-1">
              وضعیت
            </label>
            <select
              id="pk"
              value={kind}
              onChange={(e) => setKind(e.target.value as PersonKind)}
              className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
            >
              <option value="candidate">داوطلب استخدام</option>
              <option value="employee">شاغل (پرسنل)</option>
            </select>
          </div>
          <div>
            <label htmlFor="pd" className="block text-xs font-medium mb-1">
              واحد کاری (مطابق لیست کارخانه)
            </label>
            <input
              id="pd"
              list="pdf-work-units"
              maxLength={100}
              placeholder="مثلاً: تولید نورد سرد، اداری، برق…"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
            />
          </div>
          <div>
            <label htmlFor="pj" className="block text-xs font-medium mb-1">
              پست / شغل موردنظر
            </label>
            <input
              id="pj"
              maxLength={100}
              value={job}
              onChange={(e) => setJob(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
            />
          </div>
          <div>
            <label htmlFor="pa" className="block text-xs font-medium mb-1">
              سن
            </label>
            <input
              id="pa"
              type="number"
              min={16}
              max={80}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="w-4 h-4 accent-[#0e6a88]"
              />
              <span>رضایت آگاهانه گرفته شد (فرد از هدف آزمون و محرمانگی نتایج آگاه است)</span>
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer text-sm"
            >
              {saving ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-lg font-bold tabular-nums">فهرست ({faDigits(filtered.length)})</h2>
          <div className="flex-1" />
          <input
            placeholder="جستجو (نام، کد، واحد)"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full sm:w-[210px] px-3 py-1.5 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
          />
          <select
            aria-label="فیلتر رده شغلی"
            value={categoryFilter}
            onChange={(e) => {
              onChangeCategoryFilter(e.target.value as '' | OccupationalCategoryId);
              setUnitFilter('');
            }}
            className="px-2.5 py-1.5 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-xs font-medium"
          >
            <option value="">همه‌ی گروه‌های شغلی (۷ گروه)</option>
            {OCCUPATIONAL_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortTitle} ({c.workSettingLabel})
              </option>
            ))}
          </select>
          <select
            aria-label="فیلتر واحد کاری"
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-xs font-medium max-w-[200px]"
          >
            <option value="">همه‌ی واحدهای کاری ({faDigits(unitsInActiveCategory.length)})</option>
            {unitsInActiveCategory.map((u) => (
              <option key={u.name} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#f4f6f7] dark:bg-[#222d36]">
            {[
              { id: '', label: 'همه' },
              { id: 'candidate', label: 'داوطلبان' },
              { id: 'employee', label: 'شاغلین' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setKindFilter(tab.id as '' | PersonKind)}
                className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap transition-colors ${
                  kindFilter === tab.id
                    ? 'bg-white dark:bg-[#1b242c] text-[#1b2733] dark:text-[#e6ecf0] shadow-xs font-bold'
                    : 'text-[#5a6a78] dark:text-[#9aabb8] hover:text-[#1b2733]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {displayedRows.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8]">
                    <th className="text-right p-2.5 font-medium">نام</th>
                    <th className="text-right p-2.5 font-medium">وضعیت</th>
                    <th className="text-right p-2.5 font-medium">واحد کاری / رده شغلی</th>
                    <th className="text-right p-2.5 font-medium">آزمون‌ها</th>
                    <th className="text-right p-2.5 font-medium">اقدامات</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((p) => {
                    const count = resultCounts.get(p.id) || 0;
                    const cat = getCategoryForDept(p.dept);
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-[#d5dce1] dark:border-[#33414d] align-top"
                      >
                        <td className="p-2.5">
                          <div className="font-bold">{p.name}</div>
                          {p.code && (
                            <div className="text-xs text-[#5a6a78] dark:text-[#9aabb8] tabular-nums">
                              {p.code}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-xs whitespace-nowrap">
                          <span
                            className={
                              p.kind === 'candidate'
                                ? 'text-[#0e6a88] dark:text-[#4fb4d4] font-semibold'
                                : 'text-[#5a6a78] dark:text-[#9aabb8]'
                            }
                          >
                            {KIND_LABEL[p.kind]}
                          </span>
                        </td>
                        <td className="p-2.5 text-xs">
                          <div className="font-medium">{p.dept || '—'}</div>
                          {(cat || p.job) && (
                            <div className="text-[#5a6a78] dark:text-[#9aabb8]">
                              {[cat?.workSettingLabel, p.job].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 tabular-nums">{faDigits(count)}</td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => onStartTestFor(p.id)}
                              className="px-2.5 py-1 text-xs rounded-md border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] cursor-pointer whitespace-nowrap"
                            >
                              آزمون
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewResultsFor(p.id)}
                              className="px-2.5 py-1 text-xs rounded-md border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] cursor-pointer whitespace-nowrap"
                            >
                              نتایج
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing({ ...p })}
                              className="px-2.5 py-1 text-xs rounded-md border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] cursor-pointer whitespace-nowrap"
                            >
                              ویرایش
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(p)}
                              className="px-2.5 py-1 text-xs rounded-md border border-[#b83232] text-[#b83232] dark:border-[#f07a7a] dark:text-[#f07a7a] cursor-pointer whitespace-nowrap"
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > 60 && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllRows((s) => !s)}
                  className="px-4 py-1.5 rounded-lg border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] text-xs font-bold cursor-pointer"
                >
                  {showAllRows
                    ? 'نمایش کمتر (۶۰ ردیف اول)'
                    : `نمایش همه‌ی ${faDigits(filtered.length)} فرد`}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-[#5a6a78] dark:text-[#9aabb8]">
            فردی با این فیلتر یافت نشد. می‌توانید فرد جدید ثبت کنید یا دکمه‌ی «ورود خودکار پرسنل
            کارخانه از PDF» را بزنید.
          </p>
        )}
      </div>

      {/* ویرایش پرونده */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white dark:bg-[#1b242c] border border-[#d5dce1] dark:border-[#33414d] rounded-xl max-w-lg w-full p-6 space-y-3"
          >
            <h2 className="text-lg font-bold">ویرایش اطلاعات {editing.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">نام *</label>
                <input
                  required
                  maxLength={120}
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">کد پرسنلی / ملی</label>
                <input
                  maxLength={40}
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">وضعیت</label>
                <select
                  value={editing.kind}
                  onChange={(e) => setEditing({ ...editing, kind: e.target.value as PersonKind })}
                  className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
                >
                  <option value="candidate">داوطلب استخدام</option>
                  <option value="employee">شاغل (پرسنل)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">سن</label>
                <input
                  type="number"
                  min={16}
                  max={80}
                  value={editing.age}
                  onChange={(e) => setEditing({ ...editing, age: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">واحد کاری</label>
                <input
                  list="pdf-work-units"
                  maxLength={100}
                  value={editing.dept}
                  onChange={(e) => setEditing({ ...editing, dept: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">پست</label>
                <input
                  maxLength={100}
                  value={editing.job}
                  onChange={(e) => setEditing({ ...editing, job: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={busyModal}
                className="px-4 py-2 rounded-lg font-bold bg-[#0e6a88] text-white text-sm cursor-pointer disabled:opacity-50"
              >
                {busyModal ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg font-bold border border-[#d5dce1] dark:border-[#33414d] text-sm cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </form>
        </div>
      )}

      {/* تأیید حذف */}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1b242c] border border-[#d5dce1] dark:border-[#33414d] rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold">حذف {deleting.name}</h2>
            <p className="text-sm">
              تمام نتایج این فرد از پایگاه داده حذف می‌شود و قابل بازگشت نیست.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyModal}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg font-bold bg-[#b83232] text-white text-sm cursor-pointer disabled:opacity-50"
              >
                {busyModal ? 'در حال حذف…' : 'حذف شود'}
              </button>
              <button
                type="button"
                disabled={busyModal}
                onClick={() => setDeleting(null)}
                className="px-4 py-2 rounded-lg font-bold border border-[#d5dce1] dark:border-[#33414d] text-sm cursor-pointer"
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
