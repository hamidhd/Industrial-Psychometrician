import React, { useEffect } from 'react';
import { faDigits, jdate, KIND_LABEL, testById } from '../data/tests';
import type { Person, TestResult, Workspace } from '../types/psychometrics';
import { DimensionRow, FlagBanner } from './DimensionDisplay';
import { PlacementPanel } from './PlacementPanel';

interface Props {
  person: Person;
  latestResults: TestResult[];
  attentionItems: Array<{ test: string; name: string; label: string }>;
  workspace: Workspace;
  onClose: () => void;
}

export const ReportModal: React.FC<Props> = ({
  person,
  latestResults,
  attentionItems,
  workspace,
  onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePrint = () => {
    window.setTimeout(() => {
      window.print();
    }, 50);
  };

  const riasecResult = latestResults.find((r) => r.testId === 'riasec');
  const ipipResult = latestResults.find((r) => r.testId === 'ipip');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 overflow-auto p-4 print:static print:bg-transparent print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="print-only-sheet bg-[var(--surface)] text-[var(--ink)] max-w-[860px] mx-auto my-5 rounded-2xl border border-[var(--ink-faint)] p-6 shadow-2xl">
        <div className="flex flex-wrap gap-2.5 mb-4 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-90 cursor-pointer whitespace-nowrap"
          >
            چاپ / ذخیره PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-bold bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 cursor-pointer whitespace-nowrap"
          >
            بستن
          </button>
        </div>

        <div>
          <div className="border-b-2 border-[var(--ink)] pb-3 mb-4">
            <h1 className="text-2xl font-extrabold m-0">گزارش ارزیابی روان‌شناختی و جایابی شغلی</h1>
            <div className="text-sm text-[var(--ink-muted)] mt-1">
              {workspace.org ? `${workspace.org} · ` : ''}تاریخ گزارش: {jdate(Date.now())}
            </div>
          </div>

          <table className="w-full border-collapse text-sm mb-4">
            <tbody>
              <tr className="border-b border-[var(--ink-faint)]">
                <th className="text-right py-2 px-2.5 bg-[var(--bg)]/60 text-[var(--ink-muted)] font-bold">
                  نام
                </th>
                <td className="py-2 px-2.5 font-semibold">{person.name}</td>
                <th className="text-right py-2 px-2.5 bg-[var(--bg)]/60 text-[var(--ink-muted)] font-bold">
                  وضعیت
                </th>
                <td className="py-2 px-2.5">{KIND_LABEL[person.kind]}</td>
              </tr>
              <tr className="border-b border-[var(--ink-faint)]">
                <th className="text-right py-2 px-2.5 bg-[var(--bg)]/60 text-[var(--ink-muted)] font-bold">
                  واحد
                </th>
                <td className="py-2 px-2.5">{person.dept || '-'}</td>
                <th className="text-right py-2 px-2.5 bg-[var(--bg)]/60 text-[var(--ink-muted)] font-bold">
                  پست
                </th>
                <td className="py-2 px-2.5">{person.job || '-'}</td>
              </tr>
              <tr className="border-b border-[var(--ink-faint)]">
                <th className="text-right py-2 px-2.5 bg-[var(--bg)]/60 text-[var(--ink-muted)] font-bold">
                  کد
                </th>
                <td className="py-2 px-2.5 num-ltr tabular-nums text-right">{person.code || '-'}</td>
                <th className="text-right py-2 px-2.5 bg-[var(--bg)]/60 text-[var(--ink-muted)] font-bold">
                  سن
                </th>
                <td className="py-2 px-2.5 tabular-nums">
                  {person.age ? faDigits(person.age) : '-'}
                </td>
              </tr>
            </tbody>
          </table>

          {riasecResult && (
            <div className="mb-4">
              <PlacementPanel
                riasecResult={riasecResult}
                ipipResult={ipipResult}
                currentDept={person.dept}
                compact
              />
            </div>
          )}

          <h2 className="text-lg font-extrabold mt-4 mb-2">خلاصه</h2>
          {attentionItems.length > 0 ? (
            <p className="text-sm mb-3">
              موارد نیازمند توجه:{' '}
              {attentionItems.map((a) => `${a.test} ← ${a.name} (${a.label})`).join('؛ ')}.
            </p>
          ) : (
            <p className="text-sm mb-3">
              در آزمون‌های انجام‌شده نمره‌ی هشداردهنده‌ای دیده نشد.
            </p>
          )}

          {latestResults
            .flatMap((r) => r.flags)
            .map((flag, i) => (
              <FlagBanner key={i} flag={flag} />
            ))}

          <div className="space-y-4 my-4">
            {latestResults.map((r) => (
              <div
                key={r.id}
                className="avoid-break rounded-xl border border-[var(--ink-faint)] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-base font-bold">{testById(r.testId).title}</h3>
                  <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                    {jdate(r.date)}
                    {r.computerLabel ? ` · ${r.computerLabel}` : ''}
                  </span>
                </div>
                {r.dims.map((d, idx) => (
                  <DimensionRow key={idx} dim={d} />
                ))}
              </div>
            ))}
          </div>

          <div className="rounded-xl p-4 bg-[var(--accent-soft)] border border-[var(--accent)] text-sm mb-5">
            <b className="block mb-1 text-[var(--accent)]">یادآوری</b>
            این گزارش حاصل ابزارهای غربالگری است و تشخیص بالینی نیست. نتیجه باید با مصاحبه، سوابق
            و مشاهده‌ی رفتار تفسیر شود و به‌تنهایی مبنای رد، اخراج یا تنبیه قرار نگیرد. محرمانه
            است.
          </div>

          <table className="w-full border-collapse text-sm mt-6">
            <tbody>
              <tr className="border-t border-b border-[var(--ink-faint)]">
                <td className="h-[70px] align-top p-2.5 w-1/2 border-l border-[var(--ink-faint)]">
                  نظر و امضای ارزیاب: {workspace.examiner || ''}
                </td>
                <td className="h-[70px] align-top p-2.5 w-1/2">
                  نظر و امضای روان‌شناس / پزشک طب کار
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
