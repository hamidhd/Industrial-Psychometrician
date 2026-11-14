import React, { useMemo, useState } from 'react';
import { ALL_TESTS, faDigits, jdt, KIND_LABEL, testById } from '../data/tests';
import { deleteTestResult } from '../services/firestoreService';
import type { Person, TestResult, Workspace } from '../types/psychometrics';
import { DimensionRow, FlagBanner, ToneTag } from './DimensionDisplay';
import { ReportModal } from './ReportModal';

interface Props {
  workspace: Workspace;
  people: Person[];
  results: TestResult[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onRunNewTest: () => void;
  onToast: (msg: string) => void;
}

export const ResultsView: React.FC<Props> = ({
  workspace,
  people,
  results,
  selectedPersonId,
  onSelectPerson,
  onRunNewTest,
  onToast,
}) => {
  const [showReport, setShowReport] = useState(false);

  if (people.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">نتایج و گزارش</h1>
        <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5">
          <p className="text-sm text-[#5a6a78] dark:text-[#9aabb8]">هنوز فردی ثبت نشده است.</p>
        </div>
      </div>
    );
  }

  const person = people.find((p) => p.id === selectedPersonId) || people[0];

  const personResults = useMemo(
    () => results.filter((r) => r.personId === person.id).sort((a, b) => b.date - a.date),
    [results, person.id]
  );

  const latestByTest = useMemo(() => {
    const map = new Map<string, TestResult>();
    [...personResults].reverse().forEach((r) => map.set(r.testId, r));
    return ALL_TESTS.map((t) => map.get(t.id)).filter(Boolean) as TestResult[];
  }, [personResults]);

  const attentionItems = useMemo(() => {
    const out: Array<{
      test: string;
      name: string;
      label: string;
      tone: 'warn' | 'bad';
    }> = [];
    latestByTest.forEach((r) => {
      r.dims.forEach((d) => {
        if (d.tone === 'warn' || d.tone === 'bad') {
          out.push({
            test: testById(r.testId).short,
            name: d.name,
            label: d.label,
            tone: d.tone,
          });
        }
      });
    });
    return out;
  }, [latestByTest]);

  const handleDeleteResult = async (resultId: string) => {
    try {
      await deleteTestResult(workspace.id, resultId);
      onToast('نتیجه حذف شد');
    } catch {
      onToast('خطا در حذف نتیجه');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">نتایج و گزارش</h1>

      <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={person.id}
            onChange={(e) => onSelectPerson(e.target.value)}
            className="w-full sm:w-[340px] px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
          >
            {people.map((x) => {
              const cnt = results.filter((r) => r.personId === x.id).length;
              return (
                <option key={x.id} value={x.id}>
                  {x.name} ({faDigits(cnt)} آزمون)
                </option>
              );
            })}
          </select>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onRunNewTest}
            className="px-4 py-2 rounded-lg font-bold border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] cursor-pointer text-sm whitespace-nowrap"
          >
            + آزمون جدید
          </button>
          <button
            type="button"
            disabled={latestByTest.length === 0}
            onClick={() => setShowReport(true)}
            className="px-4 py-2 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer text-sm whitespace-nowrap"
          >
            گزارش کامل / چاپ
          </button>
        </div>

        <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8] mt-3">
          {KIND_LABEL[person.kind]}
          {person.dept ? ` · واحد: ${person.dept}` : ''}
          {person.job ? ` · پست: ${person.job}` : ''}
          {person.age ? ` · سن: ${faDigits(person.age)}` : ''}
        </p>
      </div>

      {latestByTest.length > 0 ? (
        <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5">
          <h2 className="text-lg font-bold mb-2">موارد نیازمند توجه</h2>
          {attentionItems.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {attentionItems.map((a, idx) => (
                <ToneTag
                  key={idx}
                  tone={a.tone}
                  label={`${a.test} · ${a.name}: ${a.label}`}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#5a6a78] dark:text-[#9aabb8]">
              هیچ نمره‌ی هشداردهنده‌ای ثبت نشده است.
            </p>
          )}
          <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8] mt-3">
            این فهرست فقط راهنمای مصاحبه و پیگیری است و تصمیم نهایی نیست.
          </p>
        </div>
      ) : (
        <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5">
          <p className="text-sm text-[#5a6a78] dark:text-[#9aabb8]">
            برای این فرد هنوز آزمونی انجام نشده است.
          </p>
        </div>
      )}

      {latestByTest.map((r) => {
        const test = testById(r.testId);
        const prev = personResults.filter((x) => x.testId === r.testId && x.id !== r.id);
        return (
          <div
            key={r.id}
            className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5"
          >
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <h2 className="text-lg font-bold">{test.title}</h2>
              <span className="text-xs text-[#5a6a78] dark:text-[#9aabb8] tabular-nums">
                {jdt(r.date)}
                {r.computerLabel ? ` · ${r.computerLabel}` : ''}
                {r.examiner ? ` · ارزیاب: ${r.examiner}` : ''}
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => handleDeleteResult(r.id)}
                className="px-2.5 py-1 text-xs rounded-md border border-[#b83232] text-[#b83232] dark:border-[#f07a7a] dark:text-[#f07a7a] cursor-pointer whitespace-nowrap"
              >
                حذف
              </button>
            </div>

            {r.flags.map((f, i) => (
              <FlagBanner key={i} flag={f} />
            ))}

            {r.dims.map((d, i) => (
              <DimensionRow key={i} dim={d} />
            ))}

            {prev.length > 0 && (
              <details className="mt-3 rounded-lg border border-[#d5dce1] dark:border-[#33414d]">
                <summary className="cursor-pointer px-3.5 py-2 text-xs font-bold">
                  نتایج قبلی ({faDigits(prev.length)})
                </summary>
                <div className="px-3.5 pb-3 overflow-x-auto">
                  <table className="w-full border-collapse text-xs min-w-[480px]">
                    <thead>
                      <tr className="bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8]">
                        <th className="text-right p-2 font-medium">تاریخ</th>
                        <th className="text-right p-2 font-medium">ایستگاه</th>
                        {prev[0].dims.map((d, idx) => (
                          <th key={idx} className="text-right p-2 font-medium">
                            {d.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prev.map((x) => (
                        <tr
                          key={x.id}
                          className="border-b border-[#d5dce1] dark:border-[#33414d]"
                        >
                          <td className="p-2 tabular-nums">{jdt(x.date)}</td>
                          <td className="p-2 text-[#5a6a78] dark:text-[#9aabb8]">
                            {x.computerLabel || '—'}
                          </td>
                          {x.dims.map((d, idx) => (
                            <td key={idx} className="p-2">
                              <span className="num-ltr ml-1">{d.display}</span>
                              <ToneTag tone={d.tone} label={d.label} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        );
      })}

      {showReport && (
        <ReportModal
          person={person}
          latestResults={latestByTest}
          attentionItems={attentionItems}
          workspace={workspace}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
};
