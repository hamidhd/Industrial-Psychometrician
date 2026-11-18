import React, { useMemo } from 'react';
import { ALL_TESTS, faDigits, jdate, jdt, testById } from '../data/tests';
import { getAllWorkUnits, getCategoryForDept, OCCUPATIONAL_CATEGORIES } from '../data/workUnits';
import type { OccupationalCategoryId, Person, TestResult, ViewName } from '../types/psychometrics';

interface Props {
  people: Person[];
  results: TestResult[];
  computerLabel: string;
  useCloud: boolean;
  onNavigate: (view: ViewName) => void;
  onOpenCategory: (catId: OccupationalCategoryId) => void;
  onOpenPersonResults: (personId: string) => void;
}

export const DashboardView: React.FC<Props> = ({
  people,
  results,
  computerLabel,
  useCloud,
  onNavigate,
  onOpenCategory,
  onOpenPersonResults,
}) => {
  const allWorkUnits = useMemo(() => getAllWorkUnits(), []);
  const personMap = new Map(people.map((p) => [p.id, p]));

  const alerts = results
    .filter((r) => r.flags && r.flags.some((f) => f.tone === 'bad') && personMap.has(r.personId))
    .slice(0, 5);

  const recent = results.filter((r) => personMap.has(r.personId)).slice(0, 8);

  const categoryStats = useMemo(() => {
    const peopleCount: Record<string, number> = {};
    const riasecCount: Record<string, number> = {};
    const peopleWithRiasec = new Set(
      results.filter((r) => r.testId === 'riasec').map((r) => r.personId)
    );
    people.forEach((p) => {
      const cat = getCategoryForDept(p.dept);
      if (cat) {
        peopleCount[cat.id] = (peopleCount[cat.id] || 0) + 1;
        if (peopleWithRiasec.has(p.id)) {
          riasecCount[cat.id] = (riasecCount[cat.id] || 0) + 1;
        }
      }
    });
    return { peopleCount, riasecCount };
  }, [people, results]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">داشبورد</h1>
        <p className="text-sm text-[#5a6a78] dark:text-[#9aabb8]">
          سامانه روان‌سنجی استاندارد و جایابی شغلی بر اساس واحدهای کاری سازمان ·{' '}
          {useCloud ? 'متصل به پایگاه داده ابری' : 'حالت محلی / آفلاین'} ({computerLabel})
        </p>
      </div>

      <div className="rounded-[10px] px-4 py-3 bg-[#dcedf3] dark:bg-[#17323d] border border-[#0e6a88] text-sm">
        <b className="block mb-0.5">نکته‌ی مهم</b>
        نتایج این برنامه بر پایه آزمون‌های استاندارد علمی (O*NET RIASEC، Mini-IPIP، DASS-21،
        OLBI، اپورث و HEXACO-H) بوده و ابزار غربالگری و کمک‌تصمیم است. تفسیر نهایی باید همراه با
        مصاحبه و سوابق انجام شود.
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-4">
          <div className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">افراد ثبت‌شده</div>
          <div className="text-3xl font-extrabold mt-1 tabular-nums">{faDigits(people.length)}</div>
        </div>
        <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-4">
          <div className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">آزمون‌های انجام‌شده</div>
          <div className="text-3xl font-extrabold mt-1 tabular-nums">
            {faDigits(results.length)}
          </div>
        </div>
        <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-4">
          <div className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">هشدارهای جدی</div>
          <div
            className={`text-3xl font-extrabold mt-1 tabular-nums ${
              alerts.length > 0 ? 'text-[#b83232] dark:text-[#f07a7a]' : ''
            }`}
          >
            {faDigits(alerts.length)}
          </div>
        </div>
        <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-4">
          <div className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">ابزارهای علمی / واحدها</div>
          <div className="text-3xl font-extrabold mt-1 tabular-nums">
            {faDigits(ALL_TESTS.length)} / {faDigits(allWorkUnits.length)}
          </div>
        </div>
      </div>

      {/* Occupational Categories & Work Units */}
      <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">
              دسته‌بندی بر اساس واحدهای کاری ({faDigits(allWorkUnits.length)} واحد)
            </h2>
            <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">
              برای مشاهده پرسنل هر رده‌ی شغلی (پشت‌میزی، میدانی، فنی، آزمایشگاهی) روی آن کلیک کنید.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('people')}
            className="text-xs font-bold text-[#0e6a88] dark:text-[#4fb4d4] hover:underline cursor-pointer whitespace-nowrap"
          >
            مدیریت فهرست پرسنل ←
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {OCCUPATIONAL_CATEGORIES.map((cat) => {
            const unitsInCat = allWorkUnits.filter((u) => u.categoryId === cat.id);
            const count = categoryStats.peopleCount[cat.id] || 0;
            const placed = categoryStats.riasecCount[cat.id] || 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onOpenCategory(cat.id)}
                className="text-right rounded-lg border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] bg-[#f4f6f7]/50 dark:bg-[#222d36]/40 p-3.5 transition-colors cursor-pointer flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="font-bold text-sm text-[#1b2733] dark:text-[#e6ecf0]">
                    {cat.shortTitle}
                  </div>
                  <div className="text-[11px] font-semibold text-[#0e6a88] dark:text-[#4fb4d4] mt-0.5">
                    {cat.workSettingLabel} · {faDigits(unitsInCat.length)} واحد کاری
                  </div>
                  <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8] mt-1.5 line-clamp-2 leading-5">
                    {unitsInCat.map((u) => u.name).join('، ')}
                  </p>
                </div>
                <div className="pt-2 border-t border-[#d5dce1] dark:border-[#33414d] flex items-center justify-between text-xs tabular-nums">
                  <span>ثبت‌شده: {faDigits(count)} نفر</span>
                  <span className="text-[#5a6a78] dark:text-[#9aabb8]">
                    ارزیابی تناسب: {faDigits(placed)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5 space-y-2.5">
          <h2 className="text-lg font-bold">هشدارهای نیازمند پیگیری</h2>
          {alerts.map((r) => {
            const p = personMap.get(r.personId)!;
            const badFlag = r.flags.find((f) => f.tone === 'bad');
            return (
              <div
                key={r.id}
                className="rounded-lg p-3.5 bg-[#fbdcdc] dark:bg-[#431c1c] border border-[#b83232] dark:border-[#f07a7a] text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <b>
                    {p.name} — {testById(r.testId).short} ({jdate(r.date)})
                  </b>
                  <button
                    type="button"
                    onClick={() => onOpenPersonResults(p.id)}
                    className="px-3 py-1 rounded-md text-xs font-bold bg-white dark:bg-[#1b242c] border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] cursor-pointer whitespace-nowrap"
                  >
                    باز کردن نتایج
                  </button>
                </div>
                <p className="text-xs leading-6">{badFlag?.text}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5">
        <h2 className="text-lg font-bold mb-3">شروع سریع</h2>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('people')}
            className="px-4 py-2 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 cursor-pointer text-sm whitespace-nowrap"
          >
            + ثبت فرد جدید
          </button>
          <button
            type="button"
            onClick={() => onNavigate('run')}
            className="px-4 py-2 rounded-lg font-bold border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] cursor-pointer text-sm whitespace-nowrap"
          >
            اجرای آزمون / تعیین واحد کاری
          </button>
          <button
            type="button"
            onClick={() => onNavigate('help')}
            className="px-4 py-2 rounded-lg font-bold border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] cursor-pointer text-sm whitespace-nowrap"
          >
            راهنما و نقشه واحدها
          </button>
        </div>
      </div>

      <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5">
        <h2 className="text-lg font-bold mb-3">آخرین آزمون‌ها (تمام رایانه‌ها)</h2>
        {recent.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[560px]">
              <thead>
                <tr className="bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8]">
                  <th className="text-right p-2.5 font-medium">نام</th>
                  <th className="text-right p-2.5 font-medium">آزمون</th>
                  <th className="text-right p-2.5 font-medium">ایستگاه / رایانه</th>
                  <th className="text-right p-2.5 font-medium">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const p = personMap.get(r.personId)!;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onOpenPersonResults(p.id)}
                      className="border-b border-[#d5dce1] dark:border-[#33414d] hover:bg-[#f4f6f7]/60 dark:hover:bg-[#222d36]/50 cursor-pointer"
                    >
                      <td className="p-2.5 font-semibold">{p.name}</td>
                      <td className="p-2.5">{testById(r.testId).title}</td>
                      <td className="p-2.5 text-xs text-[#5a6a78] dark:text-[#9aabb8]">
                        {r.computerLabel || '—'}
                      </td>
                      <td className="p-2.5 text-xs tabular-nums">{jdt(r.date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#5a6a78] dark:text-[#9aabb8]">
            هنوز آزمونی انجام نشده است. ابتدا یک فرد ثبت کنید.
          </p>
        )}
      </div>
    </div>
  );
};
