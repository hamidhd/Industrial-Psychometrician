import React, { useCallback, useEffect, useState } from 'react';
import { faDigits } from '../data/tests';
import type { QuestionnaireDef } from '../types/psychometrics';

interface Props {
  questionnaire: QuestionnaireDef;
  onComplete: (answers: number[]) => void;
}

export const QuestionnaireRunner: React.FC<Props> = ({ questionnaire, onComplete }) => {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const total = questionnaire.items.length;
  const item = questionnaire.items[index];

  const selectOption = useCallback(
    (val: number) => {
      const next = answers.slice();
      next[index] = val;
      if (index + 1 >= total) {
        onComplete(next);
      } else {
        setAnswers(next);
        setIndex(index + 1);
      }
    },
    [answers, index, total, onComplete]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = parseInt(e.key, 10);
      if (k >= 1 && k <= questionnaire.scale.labels.length) {
        e.preventDefault();
        selectOption(questionnaire.scale.min + (k - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [questionnaire.scale.labels.length, questionnaire.scale.min, selectOption]);

  const progress = (index / total) * 100;

  return (
    <div>
      <div className="h-1.5 w-full rounded bg-[#f4f6f7] dark:bg-[#222d36] overflow-hidden mb-4">
        <div
          className="h-full bg-[#0e6a88] dark:bg-[#4fb4d4] transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {index === 0 && (
        <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8] mb-3">{questionnaire.intro}</p>
      )}

      <div className="text-xs text-[#5a6a78] dark:text-[#9aabb8] tabular-nums">
        گویه {faDigits(index + 1)} از {faDigits(total)}
      </div>

      <div className="text-lg sm:text-xl font-semibold my-3 min-h-[3.5rem] text-balance">
        {item[0]}
      </div>

      <div className="grid gap-2">
        {questionnaire.scale.labels.map((label, k) => {
          const val = questionnaire.scale.min + k;
          const active = answers[index] === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => selectOption(val)}
              className={`flex items-center gap-3 text-right w-full px-4 py-3 rounded-lg border text-sm transition-colors cursor-pointer ${
                active
                  ? 'border-[#0e6a88] bg-[#dcedf3] dark:bg-[#17323d] font-bold'
                  : 'border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] hover:border-[#0e6a88] hover:bg-[#dcedf3]/60 dark:hover:bg-[#17323d]/60'
              }`}
            >
              <kbd className="inline-grid place-items-center min-w-[26px] h-[26px] rounded bg-[#f4f6f7] dark:bg-[#222d36] border border-[#d5dce1] dark:border-[#33414d] text-xs tabular-nums">
                {faDigits(k + 1)}
              </kbd>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#d5dce1] dark:border-[#33414d] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          قبلی
        </button>
        <span className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">
          می‌توانید از کلیدهای ۱ تا {faDigits(questionnaire.scale.labels.length)} صفحه‌کلید هم
          استفاده کنید.
        </span>
      </div>
    </div>
  );
};
