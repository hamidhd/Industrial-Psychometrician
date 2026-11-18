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
      <div className="rounded-[10px] border border-[#0e6a88] bg-[#dcedf3]/50 dark:bg-[#17323d]/60 p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1 max-w-2xl">
          <h2 className="text-base font-bold">تعیین واحد کاری مناسب (پشت‌میزی / میدانی / فنی / آزمایشگاهی)</h2>
          <p className="text-xs text-[#1b2733] dark:text-[#e6ecf0] leading-6">
            برای دریافت تحلیل مستقیم تناسب شخصیت با محیط کار (پشت‌میزی در برابر میدانی) و رتبه‌بندی
            واحدهای کاری سازمان، لازم است <b>رغبت‌سنج شغلی هالند (O*NET RIASEC)</b> برای این فرد
            اجرا شود (همراهی با آزمون شخصیت Mini-IPIP دقت پیش‌بینی را افزایش می‌دهد).
          </p>
        </div>
        {onStartPlacementTest && (
          <button
            type="button"
            onClick={onStartPlacementTest}
            className="px-4 py-2 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-90 cursor-pointer text-xs whitespace-nowrap shrink-0"
          >
            اجرای آزمون تعیین واحد کاری
          </button>
        )}
      </div>
    );
  }

  const settingBadgeColor = (idx: number) =>
    idx === 0
      ? 'bg-[#0e6a88] dark:bg-[#4fb4d4]'
      : idx === 1
      ? 'bg-[#23804f] dark:bg-[#5cc78d]'
      : 'bg-[#7d8f9e] dark:bg-[#607282]';

  return (
    <div className="avoid-break rounded-[10px] border border-[#0e6a88] bg-white dark:bg-[#1b242c] p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#d5dce1] dark:border-[#33414d] pb-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#0e6a88] dark:text-[#4fb4d4]">
            تحلیل تناسب شخصیت و جایابی واحد کاری
          </h2>
          <div className="text-xs text-[#5a6a78] dark:text-[#9aabb8] mt-0.5">
            کد سه‌حرفی هالند:{' '}
            <span className="num-ltr font-extrabold text-[#1b2733] dark:text-[#e6ecf0]">
              {analysis.hollandCode}
            </span>{' '}
            · {analysis.hollandLabel}
            {analysis.usedBigFive ? ' · تعدیل‌شده با شاخص‌های پنج‌عامل بزرگ (Mini-IPIP)' : ''}
          </div>
        </div>
        <div className="text-sm font-bold text-[#1b2733] dark:text-[#e6ecf0]">
          محیط برتر: {analysis.primarySetting.title} ({faDigits(analysis.primarySetting.score)}٪)
        </div>
      </div>

      {/* Direct Desk vs Field Verdict */}
      <div className="rounded-lg p-3.5 bg-[#dcedf3]/70 dark:bg-[#17323d] border border-[#0e6a88]/40 text-sm leading-7">
        {analysis.verdictSummary}
      </div>

      {/* 5 Work Settings Comparison */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold">مقایسه‌ی مستقیم نوع محیط کار (پشت‌میزی در برابر میدانی، فنی و آزمایشگاهی)</h3>
        <div className="space-y-2">
          {analysis.settingsRanked.map((s, idx) => (
            <div key={s.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className={idx === 0 ? 'font-bold text-[#1b2733] dark:text-[#e6ecf0]' : 'font-medium'}>
                  {faDigits(idx + 1)}. {s.title}
                </span>
                <span className="tabular-nums font-bold shrink-0">{faDigits(s.score)}٪</span>
              </div>
              <div className="h-2 rounded bg-[#f4f6f7] dark:bg-[#222d36] border border-[#d5dce1] dark:border-[#33414d] overflow-hidden">
                <div
                  className={`h-full ${settingBadgeColor(idx)}`}
                  style={{ width: `${Math.min(100, Math.max(0, s.score))}%` }}
                />
              </div>
              {!compact && (
                <div className="text-[11px] text-[#5a6a78] dark:text-[#9aabb8]">{s.subtitle}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current Dept Comparison if assigned */}
      {currentDept && analysis.currentUnitMatch && (
        <div className="rounded-lg p-3 border border-[#d5dce1] dark:border-[#33414d] bg-[#f4f6f7]/60 dark:bg-[#222d36]/60 text-xs flex flex-wrap items-center justify-between gap-2">
          <span>
            <b>تناسب با واحد فعلی ({analysis.currentUnitMatch.unit.name}):</b>{' '}
            {analysis.currentUnitMatch.unit.workSettingLabel} — {analysis.currentUnitMatch.reason}
          </span>
          <span
            className={`font-extrabold tabular-nums text-sm ${
              analysis.currentUnitMatch.fitPct >= 75
                ? 'text-[#23804f] dark:text-[#5cc78d]'
                : analysis.currentUnitMatch.fitPct >= 58
                ? 'text-[#8a6a00] dark:text-[#e3c24d]'
                : 'text-[#b83232] dark:text-[#f07a7a]'
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
              <tr className="bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8]">
                <th className="text-right p-2 font-medium">رتبه و واحد کاری</th>
                <th className="text-right p-2 font-medium">گروه شغلی</th>
                <th className="text-right p-2 font-medium">ماهیت محیط کار</th>
                <th className="text-right p-2 font-medium">درصد تناسب</th>
                {!compact && <th className="text-right p-2 font-medium">تحلیل علمی</th>}
              </tr>
            </thead>
            <tbody>
              {analysis.topUnits.map((item, idx) => (
                <tr key={item.unit.name} className="border-b border-[#d5dce1] dark:border-[#33414d]">
                  <td className="p-2 font-bold">
                    {faDigits(idx + 1)}. {item.unit.name}
                  </td>
                  <td className="p-2 text-[#5a6a78] dark:text-[#9aabb8]">{item.category.shortTitle}</td>
                  <td className="p-2">{item.unit.workSettingLabel}</td>
                  <td className="p-2 tabular-nums font-extrabold text-[#0e6a88] dark:text-[#4fb4d4]">
                    {faDigits(item.fitPct)}٪
                  </td>
                  {!compact && (
                    <td className="p-2 text-[#5a6a78] dark:text-[#9aabb8]">{item.reason}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
