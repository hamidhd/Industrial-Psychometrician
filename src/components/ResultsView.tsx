import React, { useMemo, useState } from 'react';
import { ALL_TESTS, faDigits, jdt, KIND_LABEL, testById } from '../data/tests';
import { localDeleteTestResult } from '../services/localStoreService';
import { deleteServerResult, type ServerClientContext } from '../services/serverApiService';
import type { Person, TestResult, Workspace } from '../types/psychometrics';
import { DimensionRow, FlagBanner, ToneTag } from './DimensionDisplay';
import { PlacementPanel } from './PlacementPanel';
import { ReportModal } from './ReportModal';

interface Props {
  useServer: boolean;
  serverCtx: ServerClientContext | null;
  canDelete?: boolean;
  workspace: Workspace;
  people: Person[];
  results: TestResult[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onRunNewTest: () => void;
  onRefreshData: () => Promise<void>;
  onToast: (msg: string) => void;
}

export const ResultsView: React.FC<Props> = ({
  useServer,
  serverCtx,
  canDelete = true,
  workspace,
  people,
  results,
  selectedPersonId,
  onSelectPerson,
  onRunNewTest,
  onRefreshData,
  onToast,
}) => {
  const [showReport, setShowReport] = useState(false);

  const person = people.find((p) => p.id === selectedPersonId) || people[0] || null;

  const personResults = useMemo(
    () =>
      person ? results.filter((r) => r.personId === person.id).sort((a, b) => b.date - a.date) : [],
    [results, person]
  );

  const latestByTest = useMemo(() => {
    const map = new Map<string, TestResult>();
    [...personResults].reverse().forEach((r) => map.set(r.testId, r));
    return ALL_TESTS.map((t) => map.get(t.id)).filter(Boolean) as TestResult[];
  }, [personResults]);

  const riasecResult = useMemo(
    () => latestByTest.find((r) => r.testId === 'riasec'),
    [latestByTest]
  );
  const ipipResult = useMemo(
    () => latestByTest.find((r) => r.testId === 'ipip'),
    [latestByTest]
  );

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

  if (!person) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-6">
          <p className="text-sm text-[var(--ink-muted)]">هنوز فردی ثبت نشده است.</p>
        </div>
      </div>
    );
  }

  const handleDeleteResult = async (resultId: string) => {
    try {
      if (useServer && serverCtx) {
        await deleteServerResult(serverCtx, workspace.id, resultId);
        await onRefreshData();
      } else {
        localDeleteTestResult(workspace.id, resultId);
      }
      onToast('نتیجه حذف شد');
    } catch {
      onToast('خطا در حذف نتیجه');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={person.id}
            onChange={(e) => onSelectPerson(e.target.value)}
            className="w-full sm:w-[340px] px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm"
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
            className="px-4 py-2 rounded-lg font-bold bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 cursor-pointer text-sm whitespace-nowrap transition-colors"
          >
            + آزمون جدید
          </button>
          <button
            type="button"
            disabled={latestByTest.length === 0}
            onClick={() => setShowReport(true)}
            className="px-4 py-2 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-90 disabled:opacity-50 cursor-pointer text-sm whitespace-nowrap"
          >
            گزارش کامل / چاپ
          </button>
        </div>

        <p className="text-xs text-[var(--ink-muted)] mt-3">
          {KIND_LABEL[person.kind]}
          {person.dept ? ` · واحد: ${person.dept}` : ''}
          {person.job ? ` · پست: ${person.job}` : ''}
          {person.age ? ` · سن: ${faDigits(person.age)}` : ''}
        </p>
      </div>

      {/* Placement Engine (Desk vs Field vs Technical & Top 5 Work Units) */}
      <PlacementPanel
        riasecResult={riasecResult}
        ipipResult={ipipResult}
        currentDept={person.dept}
        onStartPlacementTest={onRunNewTest}
      />

      {latestByTest.length > 0 ? (
        <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6">
          <h2 className="text-lg font-extrabold mb-2">موارد نیازمند توجه</h2>
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
            <p className="text-sm text-[var(--ink-muted)]">
              هیچ نمره‌ی هشداردهنده‌ای ثبت نشده است.
            </p>
          )}
          <p className="text-xs text-[var(--ink-muted)] mt-3">
            این فهرست فقط راهنمای مصاحبه و پیگیری است و تصمیم نهایی نیست.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6">
          <p className="text-sm text-[var(--ink-muted)]">
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
            className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <h2 className="text-lg font-extrabold">{test.title}</h2>
              <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                {jdt(r.date)}
                {r.computerLabel ? ` · ${r.computerLabel}` : ''}
                {r.examiner ? ` · ارزیاب: ${r.examiner}` : ''}
              </span>
              <div className="flex-1" />
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDeleteResult(r.id)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-[#dc2626]/40 text-[#dc2626] dark:border-[#f87171]/40 dark:text-[#f87171] hover:bg-[#dc2626]/10 cursor-pointer whitespace-nowrap"
                >
                  حذف
                </button>
              )}
            </div>

            {r.flags.map((f, i) => (
              <FlagBanner key={i} flag={f} />
            ))}

            {r.dims.map((d, i) => (
              <DimensionRow key={i} dim={d} />
            ))}

            {prev.length > 0 && (
              <details className="mt-4 editorial-details">
                <summary>نتایج قبلی ({faDigits(prev.length)})</summary>
                <div className="p-4 overflow-x-auto">
                  <table className="w-full border-collapse text-xs min-w-[480px]">
                    <thead>
                      <tr className="bg-[var(--bg)]/60 border-b border-[var(--ink-faint)] text-[var(--ink-muted)]">
                        <th className="text-right p-2.5 font-bold">تاریخ</th>
                        <th className="text-right p-2.5 font-bold">ایستگاه</th>
                        {prev[0].dims.map((d, idx) => (
                          <th key={idx} className="text-right p-2.5 font-bold">
                            {d.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prev.map((x) => (
                        <tr
                          key={x.id}
                          className="border-b border-[var(--ink-faint)] last:border-b-0"
                        >
                          <td className="p-2 tabular-nums">{jdt(x.date)}</td>
                          <td className="p-2 text-[var(--ink-muted)]">
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
