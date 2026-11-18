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
      <div className="h-2 w-full rounded-full bg-[var(--bg)] border border-[var(--ink-faint)] overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {index === 0 && (
        <p className="text-xs text-[var(--ink-muted)] mb-3 leading-6">{questionnaire.intro}</p>
      )}

      <div className="text-xs text-[var(--ink-muted)] tabular-nums">
        گویه {faDigits(index + 1)} از {faDigits(total)}
      </div>

      <div className="text-lg sm:text-xl font-bold my-3 min-h-[3.5rem] text-balance leading-8">
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
              className={`flex items-center gap-3 text-right w-full px-4 py-3 rounded-xl border text-sm transition-colors cursor-pointer ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-bold'
                  : 'border-[var(--ink-faint)] bg-[var(--bg)] hover:border-[var(--accent)]/50'
              }`}
            >
              <kbd className="inline-grid place-items-center min-w-[26px] h-[26px] rounded-md bg-[var(--surface)] border border-[var(--ink-faint)] text-xs num-ltr tabular-nums">
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
          className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          قبلی
        </button>
        <span className="text-xs text-[var(--ink-muted)]">
          می‌توانید از کلیدهای ۱ تا {faDigits(questionnaire.scale.labels.length)} صفحه‌کلید هم
          استفاده کنید.
        </span>
      </div>
    </div>
  );
};
