"use client";

import React from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  tone?: "positive" | "negative" | "warning" | "neutral";
  tooltip?: string;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  tone = "neutral",
  tooltip,
  icon,
}) => {
  // Warna state (Success/Error/Warning) menggunakan utilitas opacity Tailwind 
  // agar terlihat estetis baik di latar gelap maupun terang pastel.
  const toneColors = {
    positive: "text-emerald-500 border-l-emerald-500 bg-emerald-500/[0.05]",
    negative: "text-rose-500 border-l-rose-500 bg-rose-500/[0.05]",
    warning: "text-amber-500 border-l-amber-500 bg-amber-500/[0.05]",
    neutral: "text-[var(--md-sys-color-on-surface-variant)] border-l-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)]",
  };

  const badgeBg = {
    positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    negative: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    neutral: "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] border-[var(--md-sys-color-outline-variant)]",
  };

  return (
    <div
      title={tooltip}
      className={`relative overflow-hidden rounded-xl border border-[var(--md-sys-color-outline-variant)] p-4 transition-all duration-300 hover:border-[var(--md-sys-color-outline)] hover:shadow-md border-l-4 ${toneColors[tone]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-[var(--md-sys-color-on-surface-variant)] uppercase">
          {label}
        </span>
        {icon && <span className="text-[var(--md-sys-color-outline)]">{icon}</span>}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono-nums text-xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] sm:text-2xl">
          {value}
        </span>
      </div>

      {subValue && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium font-mono-nums ${badgeBg[tone]}`}
          >
            {subValue}
          </span>
        </div>
      )}
    </div>
  );
};
