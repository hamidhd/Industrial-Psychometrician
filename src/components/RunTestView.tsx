import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ALL_TESTS,
  BATTERIES,
  faDigits,
  KIND_LABEL,
  scoreQuestionnaire,
  testById,
} from '../data/tests';
import { createTestResult } from '../services/firestoreService';
import type { Person, TestId, Workspace } from '../types/psychometrics';
import { PerformanceTaskRunner } from './PerformanceTasks';
import { QuestionnaireRunner } from './QuestionnaireRunner';

interface Props {
  user: User;
  workspace: Workspace;
  computerLabel: string;
  people: Person[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onGoPeople: () => void;
  onFinishAll: (personId: string) => void;
  onToast: (msg: string) => void;
}

export const RunTestView: React.FC<Props> = ({
  user,
  workspace,
  computerLabel,
  people,
  selectedPersonId,
  onSelectPerson,
  onGoPeople,
  onFinishAll,
  onToast,
}) => {
  const [checkedIds, setCheckedIds] = useState<TestId[]>([]);
  const [queue, setQueue] = useState<TestId[] | null>(null);
  const [queueIdx, setQueueIdx] = useState(0);
  const [stepState, setStepState] = useState<'intro' | 'active' | 'saved'>('intro');
  const [savingResult, setSavingResult] = useState(false);

  if (people.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold">اجرای آزمون</h1>
        <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5 space-y-3">
          <p className="text-sm">ابتدا باید فردی ثبت شود.</p>
          <button
            type="button"
            onClick={onGoPeople}
            className="px-4 py-2 rounded-lg font-bold bg-[#0e6a88] text-white text-sm cursor-pointer"
          >
            ثبت فرد جدید
          </button>
        </div>
      </div>
    );
  }

  const activePerson = people.find((p) => p.id === selectedPersonId) || people[0];

  if (queue) {
    const currentTest = testById(queue[queueIdx]);

    const handleSavePayload = async (payload: {
      answers?: number[];
      taskMetrics?: Record<string, unknown>;
    }) => {
      setSavingResult(true);
      try {
        let scored: { dims: ReturnType<typeof scoreQuestionnaire>['dims']; flags: ReturnType<typeof scoreQuestionnaire>['flags'] };
        if (currentTest.type === 'q') {
          scored = scoreQuestionnaire(currentTest, payload.answers || []);
        } else {
          scored = currentTest.interpret(payload.taskMetrics || {});
        }
        await createTestResult(workspace, user, computerLabel, {
          personId: activePerson.id,
          testId: currentTest.id,
          answers: payload.answers,
          taskMetrics: payload.taskMetrics,
          dims: scored.dims,
          flags: scored.flags,
        });

        if (queueIdx + 1 < queue.length) {
          setStepState('saved');
        } else {
          setQueue(null);
          setQueueIdx(0);
          setStepState('intro');
          onToast('همه‌ی آزمون‌ها در پایگاه داده مشترک ثبت شد');
          onFinishAll(activePerson.id);
        }
      } catch {
        onToast('خطا در ثبت نتیجه در پایگاه داده');
      } finally {
        setSavingResult(false);
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-[#0e6a88] dark:text-[#4fb4d4]">
            {activePerson.name}
          </span>
          <span className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">
            · آزمون {faDigits(queueIdx + 1)} از {faDigits(queue.length)} · {computerLabel}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => {
              setQueue(null);
              setQueueIdx(0);
              setStepState('intro');
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#b83232] text-[#b83232] dark:border-[#f07a7a] dark:text-[#f07a7a] cursor-pointer whitespace-nowrap"
          >
            توقف و خروج
          </button>
        </div>

        <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5">
          <h2 className="text-lg font-bold mb-3">{currentTest.title}</h2>

          {savingResult ? (
            <div className="py-12 text-center text-sm text-[#5a6a78] dark:text-[#9aabb8]">
              در حال ثبت نتیجه در پایگاه داده مشترک…
            </div>
          ) : stepState === 'intro' ? (
            <div className="space-y-3">
              <p className="text-sm leading-7">{currentTest.intro}</p>
              <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">
                زمان تقریبی: {faDigits(currentTest.minutes)} دقیقه
              </p>
              <button
                type="button"
                onClick={() => setStepState('active')}
                className="px-5 py-2 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 cursor-pointer text-sm"
              >
                شروع
              </button>
            </div>
          ) : stepState === 'saved' ? (
            <div className="space-y-3">
              <p className="text-sm">
                <b>ثبت شد.</b> آزمون بعدی: {testById(queue[queueIdx + 1]).title}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQueueIdx((i) => i + 1);
                  setStepState('intro');
                }}
                className="px-5 py-2 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 cursor-pointer text-sm"
              >
                ادامه
              </button>
            </div>
          ) : currentTest.type === 'q' ? (
            <QuestionnaireRunner
              key={`${currentTest.id}-${queueIdx}`}
              questionnaire={currentTest}
              onComplete={(answers) => handleSavePayload({ answers })}
            />
          ) : (
            <PerformanceTaskRunner
              key={`${currentTest.id}-${queueIdx}`}
              taskId={currentTest.id}
              onFinish={(taskMetrics) => handleSavePayload({ taskMetrics })}
            />
          )}
        </div>
      </div>
    );
  }

  const toggleTest = (id: TestId) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const orderedSelected = ALL_TESTS.map((t) => t.id).filter((id) => checkedIds.includes(id));
  const totalMinutes = orderedSelected.reduce((sum, id) => sum + testById(id).minutes, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">اجرای آزمون</h1>

      <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5">
        <h2 className="text-lg font-bold mb-2">۱) فرد</h2>
        <select
          value={activePerson.id}
          onChange={(e) => onSelectPerson(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] text-sm"
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {KIND_LABEL[p.kind]}
              {p.job ? ` — ${p.job}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5 space-y-3">
        <div>
          <h2 className="text-lg font-bold">۲) آزمون‌ها</h2>
          <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">
            یک بسته‌ی پیشنهادی را انتخاب کنید یا آزمون‌ها را دستی علامت بزنید.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {BATTERIES.map((b, i) => (
            <button
              key={i}
              type="button"
              title={b.note}
              onClick={() => {
                setCheckedIds(b.tests);
                onToast(b.note);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] cursor-pointer whitespace-nowrap"
            >
              {b.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_TESTS.map((t) => {
            const checked = checkedIds.includes(t.id);
            return (
              <label
                key={t.id}
                className={`rounded-lg border p-3.5 cursor-pointer flex items-start gap-2.5 transition-colors ${
                  checked
                    ? 'border-[#0e6a88] bg-[#dcedf3]/40 dark:bg-[#17323d]/60'
                    : 'border-[#d5dce1] dark:border-[#33414d] bg-[#f4f6f7]/40 dark:bg-[#222d36]/40 hover:border-[#0e6a88]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTest(t.id)}
                  className="w-4 h-4 mt-1 accent-[#0e6a88]"
                />
                <span className="text-sm">
                  <b className="block">{t.title}</b>
                  <span className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">
                    {t.type === 'q' ? 'پرسشنامه' : 'آزمون عملکردی'} · حدود {faDigits(t.minutes)}{' '}
                    دقیقه
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8] tabular-nums">
          {orderedSelected.length > 0
            ? `${faDigits(orderedSelected.length)} آزمون انتخاب شد — زمان تقریبی: ${faDigits(
                totalMinutes
              )} دقیقه`
            : 'هیچ آزمونی انتخاب نشده است.'}
        </p>
      </div>

      <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-5 space-y-3">
        <h2 className="text-lg font-bold">۳) آماده‌سازی</h2>
        <ul className="list-disc pr-5 text-xs space-y-1 text-[#5a6a78] dark:text-[#9aabb8]">
          <li>محیط ساکت، بدون حضور همکاران؛ گوشی‌ها خاموش.</li>
          <li>
            برای آزمون‌های عملکردی از همان دستگاه و ترجیحاً در صبح (پیش از خستگی) استفاده کنید.
          </li>
          <li>به فرد بگویید پاسخ درست یا غلط نیست و نتیجه محرمانه است.</li>
          <li>نتیجه روی «{computerLabel}» ثبت و فوراً در تمام رایانه‌ها همگام می‌شود.</li>
        </ul>
        <button
          type="button"
          onClick={() => {
            if (orderedSelected.length === 0) {
              onToast('حداقل یک آزمون را انتخاب کنید');
              return;
            }
            setQueue(orderedSelected);
            setQueueIdx(0);
            setStepState('intro');
          }}
          className="px-5 py-2.5 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 cursor-pointer text-sm"
        >
          شروع آزمون‌ها
        </button>
      </div>
    </div>
  );
};
