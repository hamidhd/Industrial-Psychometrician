import React from 'react';
import { clamp01 } from '../data/tests';
import type { DimensionResult, ResultFlag, Tone } from '../types/psychometrics';

export const TONE_TEXT_STYLES: Record<Tone, string> = {
  good: 'bg-[#dff3e8] text-[#23804f] dark:bg-[#173826] dark:text-[#5cc78d]',
  mid: 'bg-[#fbf0cc] text-[#8a6a00] dark:bg-[#3b3213] dark:text-[#e3c24d]',
  warn: 'bg-[#fde6d2] text-[#b4560f] dark:bg-[#41290f] dark:text-[#f0954f]',
  bad: 'bg-[#fbdcdc] text-[#b83232] dark:bg-[#431c1c] dark:text-[#f07a7a]',
  info: 'bg-[#dcedf3] text-[#0e6a88] dark:bg-[#17323d] dark:text-[#4fb4d4]',
};

const BAR_COLORS: Record<Tone, string> = {
  good: 'bg-[#23804f] dark:bg-[#5cc78d]',
  mid: 'bg-[#8a6a00] dark:bg-[#e3c24d]',
  warn: 'bg-[#b4560f] dark:bg-[#f0954f]',
  bad: 'bg-[#b83232] dark:bg-[#f07a7a]',
  info: 'bg-[#0e6a88] dark:bg-[#4fb4d4]',
};

export const ToneTag: React.FC<{ tone: Tone; label: string }> = ({ tone, label }) => (
  <span
    className={`inline-block px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
      TONE_TEXT_STYLES[tone] || 'bg-[#f4f6f7] dark:bg-[#222d36]'
    }`}
  >
    {label}
  </span>
);

export const DimensionRow: React.FC<{ dim: DimensionResult }> = ({ dim }) => {
  const widthPct = Math.round(clamp01(dim.pct) * 100);
  return (
    <div className="py-3 border-b border-dashed border-[#d5dce1] dark:border-[#33414d] last:border-b-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <strong className="flex-1 min-w-[140px] text-sm font-bold">{dim.name}</strong>
        <span className="num-ltr text-sm font-semibold">{dim.display}</span>
        <ToneTag tone={dim.tone} label={dim.label} />
      </div>
      <div className="relative h-2.5 rounded bg-[#f4f6f7] dark:bg-[#222d36] border border-[#d5dce1] dark:border-[#33414d] overflow-hidden my-1.5">
        <span
          className={`absolute inset-y-0 right-0 ${BAR_COLORS[dim.tone] || 'bg-[#0e6a88]'}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <div className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">{dim.text}</div>
    </div>
  );
};

export const FlagBanner: React.FC<{ flag: ResultFlag }> = ({ flag }) => {
  const isBad = flag.tone === 'bad';
  return (
    <div
      className={`rounded-lg px-3.5 py-2.5 mb-3 border text-sm ${
        isBad
          ? 'bg-[#fbdcdc] border-[#b83232] text-[#1b2733] dark:bg-[#431c1c] dark:border-[#f07a7a] dark:text-[#e6ecf0]'
          : 'bg-[#fde6d2] border-[#b4560f] text-[#1b2733] dark:bg-[#41290f] dark:border-[#f0954f] dark:text-[#e6ecf0]'
      }`}
    >
      <b className="block mb-0.5">{isBad ? 'هشدار مهم' : 'توجه'}</b>
      <span>{flag.text}</span>
    </div>
  );
};
