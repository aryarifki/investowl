import React from "react";
import { Icon } from "@iconify/react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4 sm:p-6">
      <div className="p-8 border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] rounded-2xl flex items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)] shadow-sm animate-pulse">
        <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="24" />
        <span className="text-sm font-bold tracking-wide text-[var(--md-sys-color-on-surface)]">
          Memuat data...
        </span>
      </div>
    </div>
  );
}
