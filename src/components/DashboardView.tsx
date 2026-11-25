import React, { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import { ALL_TESTS, faDigits, jdate, jdt, testById } from '../data/tests';
import { getAllWorkUnits, getCategoryForDept, OCCUPATIONAL_CATEGORIES } from '../data/workUnits';
import type { OccupationalCategoryId, Person, TestResult, ViewName } from '../types/psychometrics';

interface Props {
  people: Person[];
  results: TestResult[];
  computerLabel: string;
  useServer: boolean;
  onNavigate: (view: ViewName) => void;
  onOpenCategory: (catId: OccupationalCategoryId) => void;
  onOpenPersonResults: (personId: string) => void;
}

export const DashboardView: React.FC<Props> = ({
  people,
  results,
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
    <div className="space-y-8">
      {/* Notice Banner */}
      <div className="rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)] px-5 py-4 flex items-start sm:items-center gap-3.5 text-sm leading-6">
        <Lightbulb className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5 sm:mt-0" />
        <div>
          <b className="text-[var(--accent)] ml-1.5">نکته‌ی مهم:</b>
          <span>
            نتایج این برنامه بر پایه آزمون‌های استاندارد علمی (O*NET RIASEC، Mini-IPIP، DASS-21،
            OLBI، اپورث و HEXACO-H) بوده و ابزار غربالگری و کمک‌تصمیم است. تفسیر نهایی باید همراه
            با مصاحبه و سوابق انجام شود.
          </span>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 w-10 h-10 bg-[var(--accent-soft)] rounded-tr-full opacity-50"
          />
          <span className="block text-xs font-medium text-[var(--ink-muted)] mb-2">
            افراد ثبت‌شده
          </span>
          <div className="mono text-3xl sm:text-[2.2rem] font-bold num-ltr tabular-nums text-right leading-none">
            {faDigits(people.length)}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 w-10 h-10 bg-[var(--accent-soft)] rounded-tr-full opacity-50"
          />
          <span className="block text-xs font-medium text-[var(--ink-muted)] mb-2">
            آزمون‌های انجام‌شده
          </span>
          <div className="mono text-3xl sm:text-[2.2rem] font-bold num-ltr tabular-nums text-right leading-none">
            {faDigits(results.length)}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 w-10 h-10 bg-[var(--accent-soft)] rounded-tr-full opacity-50"
          />
          <span className="block text-xs font-medium text-[var(--ink-muted)] mb-2">
            هشدارهای جدی
          </span>
          <div
            className={`mono text-3xl sm:text-[2.2rem] font-bold num-ltr tabular-nums text-right leading-none ${
              alerts.length > 0 ? 'text-[#dc2626] dark:text-[#f87171]' : ''
            }`}
          >
            {faDigits(alerts.length)}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 w-10 h-10 bg-[var(--accent-soft)] rounded-tr-full opacity-50"
          />
          <span className="block text-xs font-medium text-[var(--ink-muted)] mb-2">
            ابزارهای علمی / واحدها
          </span>
          <div className="mono text-3xl sm:text-[2.2rem] font-bold num-ltr tabular-nums text-right leading-none">
            {faDigits(ALL_TESTS.length)} / {faDigits(allWorkUnits.length)}
          </div>
        </div>
      </div>

      {/* Occupational Categories & Work Units */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold">
              دسته‌بندی واحدهای کاری ({faDigits(allWorkUnits.length)} واحد)
            </h2>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              برای مشاهده پرسنل هر رده‌ی شغلی (پشت‌میزی، میدانی، فنی، آزمایشگاهی) روی آن کلیک کنید.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('people')}
            className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer whitespace-nowrap"
          >
            مدیریت فهرست ←
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {OCCUPATIONAL_CATEGORIES.map((cat) => {
            const unitsInCat = allWorkUnits.filter((u) => u.categoryId === cat.id);
            const count = categoryStats.peopleCount[cat.id] || 0;
            const placed = categoryStats.riasecCount[cat.id] || 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onOpenCategory(cat.id)}
                className="text-right rounded-2xl border border-[var(--ink-faint)] hover:border-[var(--accent)] bg-[var(--surface)] p-5 sm:p-6 transition-all duration-200 hover:-translate-y-1 cursor-pointer flex flex-col justify-between gap-3"
              >
                <div>
                  <span className="block text-[11px] font-bold text-[var(--accent)] mb-1.5">
                    {cat.workSettingLabel} · {faDigits(unitsInCat.length)} واحد کاری
                  </span>
                  <div className="font-extrabold text-base sm:text-[1.05rem] text-[var(--ink)] mb-1.5">
                    {cat.shortTitle}
                  </div>
                  <p className="text-xs text-[var(--ink-muted)] line-clamp-2 leading-6">
                    {unitsInCat.map((u) => u.name).join('، ')}
                  </p>
                </div>
                <div className="pt-2.5 border-t border-[var(--ink-faint)] flex items-center justify-between text-xs tabular-nums">
                  <span className="text-[var(--accent)] font-semibold">
                    {faDigits(count)} نفر ثبت‌شده
                  </span>
                  <span className="text-[var(--ink-muted)]">
                    ارزیابی تناسب: {faDigits(placed)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('people')}
            className="px-5 py-2.5 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-90 cursor-pointer text-sm whitespace-nowrap transition-opacity"
          >
            + ثبت فرد جدید
          </button>
          <button
            type="button"
            onClick={() => onNavigate('run')}
            className="px-5 py-2.5 rounded-lg font-bold bg-[var(--ink-faint)] text-[var(--ink)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 cursor-pointer text-sm whitespace-nowrap transition-colors"
          >
            اجرای آزمون سریع
          </button>
          <button
            type="button"
            onClick={() => onNavigate('help')}
            className="px-5 py-2.5 rounded-lg font-bold bg-[var(--ink-faint)] text-[var(--ink)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 cursor-pointer text-sm whitespace-nowrap transition-colors"
          >
            نقشه واحدها و راهنما
          </button>
        </div>
      </section>

      {alerts.length > 0 && (
        <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 space-y-3">
          <h2 className="text-lg font-extrabold">هشدارهای نیازمند پیگیری</h2>
          {alerts.map((r) => {
            const p = personMap.get(r.personId)!;
            const badFlag = r.flags.find((f) => f.tone === 'bad');
            return (
              <div
                key={r.id}
                className="rounded-xl p-4 bg-[#fef2f2] dark:bg-[#450a0a]/60 border border-[#dc2626]/40 dark:border-[#f87171]/40 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <b>
                    {p.name} — {testById(r.testId).short} ({jdate(r.date)})
                  </b>
                  <button
                    type="button"
                    onClick={() => onOpenPersonResults(p.id)}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-[var(--surface)] border border-[var(--ink-faint)] hover:border-[var(--accent)] cursor-pointer whitespace-nowrap"
                  >
                    باز کردن نتایج
                  </button>
                </div>
                <p className="text-xs leading-6 text-[var(--ink-muted)]">{badFlag?.text}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6">
        <h2 className="text-lg font-extrabold mb-4">آخرین آزمون‌ها (تمام رایانه‌ها)</h2>
        {recent.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[560px]">
              <thead>
                <tr className="bg-[var(--bg)]/60 border-b border-[var(--ink-faint)] text-[var(--ink-muted)] text-xs">
                  <th className="text-right p-3 font-bold">نام</th>
                  <th className="text-right p-3 font-bold">آزمون</th>
                  <th className="text-right p-3 font-bold">ایستگاه / رایانه</th>
                  <th className="text-right p-3 font-bold">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const p = personMap.get(r.personId)!;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onOpenPersonResults(p.id)}
                      className="border-b border-[var(--ink-faint)] last:border-b-0 hover:bg-[var(--ink-faint)]/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-semibold">{p.name}</td>
                      <td className="p-3">{testById(r.testId).title}</td>
                      <td className="p-3 text-xs text-[var(--ink-muted)]">
                        {r.computerLabel || '—'}
                      </td>
                      <td className="p-3 text-xs tabular-nums text-[var(--ink-muted)]">
                        {jdt(r.date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--ink-muted)]">
            هنوز آزمونی انجام نشده است. ابتدا یک فرد ثبت کنید.
          </p>
        )}
      </div>
    </div>
  );
};
