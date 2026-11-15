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
      className="fixed inset-0 z-50 bg-black/60 overflow-auto p-4 print:static print:bg-transparent print:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="print-only-sheet bg-white dark:bg-[#1b242c] text-[#1b2733] dark:text-[#e6ecf0] max-w-[860px] mx-auto my-5 rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] p-6">
        <div className="flex flex-wrap gap-2.5 mb-4 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 cursor-pointer whitespace-nowrap"
          >
            چاپ / ذخیره PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-bold border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] cursor-pointer whitespace-nowrap"
          >
            بستن
          </button>
        </div>

        <div>
          <div className="border-b-[3px] border-[#0e6a88] pb-2 mb-4">
            <h1 className="text-2xl font-extrabold m-0">گزارش ارزیابی روان‌شناختی و جایابی شغلی</h1>
            <div className="text-sm text-[#5a6a78] dark:text-[#9aabb8]">
              {workspace.org ? `${workspace.org} · ` : ''}تاریخ گزارش: {jdate(Date.now())}
            </div>
          </div>

          <table className="w-full border-collapse text-sm mb-4">
            <tbody>
              <tr className="border-b border-[#d5dce1] dark:border-[#33414d]">
                <th className="text-right py-2 px-2.5 bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8] font-medium">
                  نام
                </th>
                <td className="py-2 px-2.5 font-semibold">{person.name}</td>
                <th className="text-right py-2 px-2.5 bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8] font-medium">
                  وضعیت
                </th>
                <td className="py-2 px-2.5">{KIND_LABEL[person.kind]}</td>
              </tr>
              <tr className="border-b border-[#d5dce1] dark:border-[#33414d]">
                <th className="text-right py-2 px-2.5 bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8] font-medium">
                  واحد
                </th>
                <td className="py-2 px-2.5">{person.dept || '-'}</td>
                <th className="text-right py-2 px-2.5 bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8] font-medium">
                  پست
                </th>
                <td className="py-2 px-2.5">{person.job || '-'}</td>
              </tr>
              <tr className="border-b border-[#d5dce1] dark:border-[#33414d]">
                <th className="text-right py-2 px-2.5 bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8] font-medium">
                  کد
                </th>
                <td className="py-2 px-2.5 tabular-nums">{person.code || '-'}</td>
                <th className="text-right py-2 px-2.5 bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8] font-medium">
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

          <h2 className="text-lg font-bold mt-4 mb-2">خلاصه</h2>
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
                className="avoid-break rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-base font-bold">{testById(r.testId).title}</h3>
                  <span className="text-xs text-[#5a6a78] dark:text-[#9aabb8] tabular-nums">
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

          <div className="rounded-lg p-3.5 bg-[#dcedf3] dark:bg-[#17323d] border border-[#0e6a88] text-sm mb-5">
            <b className="block mb-1">یادآوری</b>
            این گزارش حاصل ابزارهای غربالگری است و تشخیص بالینی نیست. نتیجه باید با مصاحبه، سوابق
            و مشاهده‌ی رفتار تفسیر شود و به‌تنهایی مبنای رد، اخراج یا تنبیه قرار نگیرد. محرمانه
            است.
          </div>

          <table className="w-full border-collapse text-sm mt-6">
            <tbody>
              <tr className="border-t border-b border-[#d5dce1] dark:border-[#33414d]">
                <td className="h-[70px] align-top p-2.5 w-1/2 border-l border-[#d5dce1] dark:border-[#33414d]">
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
