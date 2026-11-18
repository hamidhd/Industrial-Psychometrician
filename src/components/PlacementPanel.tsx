import React from 'react';
import { faDigits } from '../data/tests';
import { computePlacementAnalysis } from '../data/workUnits';
import type { TestResult } from '../types/psychometrics';

interface Props {
  riasecResult?: TestResult;
  ipipResult?: TestResult;
  currentDept?: string;
  onStartPlacementTest?: () => void;
  compact?: boolean;
}

export const PlacementPanel: React.FC<Props> = ({
  riasecResult,
  ipipResult,
  currentDept,
  onStartPlacementTest,
  compact = false,
}) => {
  const analysis = computePlacementAnalysis(riasecResult, ipipResult, currentDept);

  if (!analysis) {
    if (compact) return null;
    return (
      <div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <h2 className="text-base font-extrabold text-[var(--accent)]">
            تعیین واحد کاری مناسب (پشت‌میزی / میدانی / فنی / آزمایشگاهی)
          </h2>
          <p className="text-xs text-[var(--ink)] leading-6">
            برای دریافت تحلیل مستقیم تناسب شخصیت با محیط کار (پشت‌میزی در برابر میدانی) و رتبه‌بندی
            واحدهای کاری سازمان، لازم است <b>رغبت‌سنج شغلی هالند (O*NET RIASEC)</b> برای این فرد
            اجرا شود (همراهی با آزمون شخصیت Mini-IPIP دقت پیش‌بینی را افزایش می‌دهد).
          </p>
        </div>
        {onStartPlacementTest && (
          <button
            type="button"
            onClick={onStartPlacementTest}
            className="px-4 py-2.5 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-90 cursor-pointer text-xs whitespace-nowrap shrink-0"
          >
            اجرای آزمون تعیین واحد کاری
          </button>
        )}
      </div>
    );
  }

  const settingBadgeColor = (idx: number) =>
    idx === 0
      ? 'bg-[var(--accent)]'
      : idx === 1
      ? 'bg-[#16a34a] dark:bg-[#4ade80]'
      : 'bg-[var(--ink-muted)]';

  return (
    <div className="avoid-break rounded-2xl border border-[var(--accent)]/60 bg-[var(--surface)] p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--ink-faint)] pb-3">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--accent)]">
            تحلیل تناسب شخصیت و جایابی واحد کاری
          </h2>
          <div className="text-xs text-[var(--ink-muted)] mt-0.5">
            کد سه‌حرفی هالند:{' '}
            <span className="num-ltr font-extrabold text-[var(--ink)]">
              {analysis.hollandCode}
            </span>{' '}
            · {analysis.hollandLabel}
            {analysis.usedBigFive ? ' · تعدیل‌شده با شاخص‌های پنج‌عامل بزرگ (Mini-IPIP)' : ''}
          </div>
        </div>
        <div className="text-sm font-bold text-[var(--ink)]">
          محیط برتر: {analysis.primarySetting.title} ({faDigits(analysis.primarySetting.score)}٪)
        </div>
      </div>

      {/* Direct Desk vs Field Verdict */}
      <div className="rounded-xl p-4 bg-[var(--accent-soft)] border border-[var(--accent)]/50 text-sm leading-7">
        {analysis.verdictSummary}
      </div>

      {/* 5 Work Settings Comparison */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold">
          مقایسه‌ی مستقیم نوع محیط کار (پشت‌میزی در برابر میدانی، فنی و آزمایشگاهی)
        </h3>
        <div className="space-y-2.5">
          {analysis.settingsRanked.map((s, idx) => (
            <div key={s.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className={idx === 0 ? 'font-bold text-[var(--ink)]' : 'font-medium'}>
                  {faDigits(idx + 1)}. {s.title}
                </span>
                <span className="num-ltr tabular-nums font-bold shrink-0">{faDigits(s.score)}٪</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg)] border border-[var(--ink-faint)] overflow-hidden">
                <div
                  className={`h-full rounded-full ${settingBadgeColor(idx)}`}
                  style={{ width: `${Math.min(100, Math.max(0, s.score))}%` }}
                />
              </div>
              {!compact && <div className="text-[11px] text-[var(--ink-muted)]">{s.subtitle}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Current Dept Comparison if assigned */}
      {currentDept && analysis.currentUnitMatch && (
        <div className="rounded-xl p-3.5 border border-[var(--ink-faint)] bg-[var(--bg)] text-xs flex flex-wrap items-center justify-between gap-2">
          <span>
            <b>تناسب با واحد فعلی ({analysis.currentUnitMatch.unit.name}):</b>{' '}
            {analysis.currentUnitMatch.unit.workSettingLabel} — {analysis.currentUnitMatch.reason}
          </span>
          <span
            className={`font-extrabold tabular-nums text-sm ${
              analysis.currentUnitMatch.fitPct >= 75
                ? 'text-[#16a34a] dark:text-[#4ade80]'
                : analysis.currentUnitMatch.fitPct >= 58
                ? 'text-[#ca8a04] dark:text-[#facc15]'
                : 'text-[#dc2626] dark:text-[#f87171]'
            }`}
          >
            {faDigits(analysis.currentUnitMatch.fitPct)}٪ انطباق
          </span>
        </div>
      )}

      {/* Top 5 Matched Work Units */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold">پیشنهاد مستقیم واحدهای کاری سازمان (استاندارد و سفارشی)</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs min-w-[520px]">
            <thead>
              <tr className="bg-[var(--bg)]/60 border-b border-[var(--ink-faint)] text-[var(--ink-muted)]">
                <th className="text-right p-2.5 font-bold">رتبه و واحد کاری</th>
                <th className="text-right p-2.5 font-bold">گروه شغلی</th>
                <th className="text-right p-2.5 font-bold">ماهیت محیط کار</th>
                <th className="text-right p-2.5 font-bold">درصد تناسب</th>
                {!compact && <th className="text-right p-2.5 font-bold">تحلیل علمی</th>}
              </tr>
            </thead>
            <tbody>
              {analysis.topUnits.map((item, idx) => (
                <tr key={item.unit.name} className="border-b border-[var(--ink-faint)] last:border-b-0">
                  <td className="p-2.5 font-bold">
                    {faDigits(idx + 1)}. {item.unit.name}
                  </td>
                  <td className="p-2.5 text-[var(--ink-muted)]">{item.category.shortTitle}</td>
                  <td className="p-2.5">{item.unit.workSettingLabel}</td>
                  <td className="p-2.5 tabular-nums font-extrabold text-[var(--accent)]">
                    {faDigits(item.fitPct)}٪
                  </td>
                  {!compact && <td className="p-2.5 text-[var(--ink-muted)]">{item.reason}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
