import React from 'react';
import { clamp01 } from '../data/tests';
import type { DimensionResult, ResultFlag, Tone } from '../types/psychometrics';

export const TONE_TEXT_STYLES: Record<Tone, string> = {
  good: 'bg-[#dcfce7] text-[#15803d] dark:bg-[#14532d]/60 dark:text-[#4ade80]',
  mid: 'bg-[#fef9c3] text-[#a16207] dark:bg-[#422006]/70 dark:text-[#facc15]',
  warn: 'bg-[#ffedd5] text-[#c2410c] dark:bg-[#431407]/70 dark:text-[#fb923c]',
  bad: 'bg-[#fee2e2] text-[#b91c1c] dark:bg-[#450a0a]/70 dark:text-[#f87171]',
  info: 'bg-[var(--accent-soft)] text-[var(--accent)]',
};

const BAR_COLORS: Record<Tone, string> = {
  good: 'bg-[#16a34a] dark:bg-[#4ade80]',
  mid: 'bg-[#ca8a04] dark:bg-[#facc15]',
  warn: 'bg-[#ea580c] dark:bg-[#fb923c]',
  bad: 'bg-[#dc2626] dark:bg-[#f87171]',
  info: 'bg-[var(--accent)]',
};

export const ToneTag: React.FC<{ tone: Tone; label: string }> = ({ tone, label }) => (
  <span
    className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap ${
      TONE_TEXT_STYLES[tone] || 'bg-[var(--surface-alt)] text-[var(--ink)]'
    }`}
  >
    {label}
  </span>
);

export const DimensionRow: React.FC<{ dim: DimensionResult }> = ({ dim }) => {
  const widthPct = Math.round(clamp01(dim.pct) * 100);
  return (
    <div className="py-3 border-b border-[var(--ink-faint)] last:border-b-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <strong className="flex-1 min-w-[140px] text-sm font-bold">{dim.name}</strong>
        <span className="num-ltr text-sm font-bold">{dim.display}</span>
        <ToneTag tone={dim.tone} label={dim.label} />
      </div>
      <div className="relative h-2 rounded-full bg-[var(--bg)] border border-[var(--ink-faint)] overflow-hidden my-1.5">
        <span
          className={`absolute inset-y-0 right-0 rounded-full ${
            BAR_COLORS[dim.tone] || 'bg-[var(--accent)]'
          }`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <div className="text-xs text-[var(--ink-muted)]">{dim.text}</div>
    </div>
  );
};

export const FlagBanner: React.FC<{ flag: ResultFlag }> = ({ flag }) => {
  const isBad = flag.tone === 'bad';
  return (
    <div
      className={`rounded-xl px-4 py-3 mb-3 border text-sm ${
        isBad
          ? 'bg-[#fef2f2] border-[#dc2626]/50 text-[#0f172a] dark:bg-[#450a0a]/60 dark:border-[#f87171]/40 dark:text-[#f8fafc]'
          : 'bg-[#fff7ed] border-[#ea580c]/50 text-[#0f172a] dark:bg-[#431407]/60 dark:border-[#fb923c]/40 dark:text-[#f8fafc]'
      }`}
    >
      <b className="block mb-0.5">{isBad ? 'هشدار مهم' : 'توجه'}</b>
      <span>{flag.text}</span>
    </div>
  );
};
