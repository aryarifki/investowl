"use client";

import { Icon } from "@iconify/react";
import ShareholderMatrix from "@/components/konglo/ShareholderMatrix";

export default function KongloPage() {
  return (
    <main className="min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] p-4 md:p-6 transition-colors duration-300 pb-24">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* HEADER PEMBUNGKUS KONGLOMERASI */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[var(--md-sys-color-primary)] to-emerald-500"></div>

          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)] shadow-2xs">
              <Icon icon="ph:buildings-bold" width="22" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
              Konglomerasi
            </h1>
          </div>
        </div>

        {/* PETA PEMEGANG SAHAM & CROSS-HOLDING */}
        <ShareholderMatrix />
      </div>
    </main>
  );
}
