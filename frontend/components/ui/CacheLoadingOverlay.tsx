"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { useAppStore } from "@/store/useAppStore";

export default function CacheLoadingOverlay() {
  const { cacheLoading } = useAppStore();

  if (!cacheLoading?.isOpen) {
    return null;
  }

  const progress = cacheLoading.progress ?? 50;
  const isSuccess = cacheLoading.isSuccess ?? false;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none transition-all"
    >
      {/* CARD CONTAINER */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]/95 p-6 sm:p-7 shadow-2xl backdrop-blur-xl transition-all duration-300">
        {/* SUBTLE BACKGROUND GRID PATTERN */}
        <div className="absolute inset-0 bg-terminal-grid opacity-25 pointer-events-none rounded-2xl" />

        {/* AMBIENT GLOW EFFECTS */}
        <div className="absolute -top-20 -left-20 w-44 h-44 rounded-full bg-[var(--md-sys-color-primary)]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-44 h-44 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        {/* CONTENT */}
        <div className="relative z-10 flex flex-col items-center text-center">
          
          {/* ANIMATED RADAR / SPINNER VISUAL */}
          <div className="relative flex items-center justify-center w-20 h-20 mb-5">
            {/* Outer ambient pulse */}
            <div
              className={`absolute inset-0 rounded-full transition-all duration-500 ${
                isSuccess
                  ? "bg-emerald-500/20 scale-110"
                  : "bg-[var(--md-sys-color-primary)]/20 animate-ping opacity-35"
              }`}
            />
            {/* Outer spinning ring */}
            <div
              className={`absolute inset-0 rounded-full border-2 border-dashed transition-colors duration-500 ${
                isSuccess
                  ? "border-emerald-500/50"
                  : "border-[var(--md-sys-color-primary)]/60 animate-spin [animation-duration:5s]"
              }`}
            />
            {/* Intermediate spinning ring */}
            <div
              className={`absolute inset-1 rounded-full border-2 border-t-transparent border-r-transparent transition-colors duration-500 ${
                isSuccess
                  ? "border-b-emerald-400 border-l-emerald-400"
                  : "border-b-[var(--md-sys-color-primary)] border-l-[var(--md-sys-color-primary)] animate-spin [animation-duration:1.2s]"
              }`}
            />
            {/* Center Icon badge */}
            <div
              className={`relative w-12 h-12 rounded-xl border flex items-center justify-center shadow-lg transition-all duration-500 ${
                isSuccess
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 scale-105"
                  : "bg-[var(--md-sys-color-surface-container-highest)] border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-primary)]"
              }`}
            >
              {isSuccess ? (
                <Icon
                  icon="ph:check-bold"
                  className="animate-in zoom-in-50 duration-300"
                  width="26"
                  height="26"
                />
              ) : (
                <Icon
                  icon="ph:lightning-duotone"
                  className="animate-pulse"
                  width="26"
                  height="26"
                />
              )}
            </div>
          </div>

          {/* ENGINE BADGE */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mb-2 rounded-full border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-highest)] text-[10px] font-mono font-bold tracking-widest uppercase text-[var(--md-sys-color-primary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--md-sys-color-primary)] animate-ping" />
            <span>INVESTOWL CACHE ENGINE</span>
          </div>

          {/* TITLE */}
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-[var(--md-sys-color-on-surface)]">
            {cacheLoading.title || "Sinkronisasi Cache & Database"}
          </h3>

          {/* STEP / DESKRIPSI INFORMASI */}
          <p className="text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)] mt-1.5 max-w-sm font-medium transition-all duration-300">
            {cacheLoading.step || "Sedang memproses pembersihan dan pembaruan data cache..."}
          </p>

          {/* PROGRESS BAR */}
          <div className="w-full mt-5 mb-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--md-sys-color-on-surface-variant)] mb-1.5">
              <span>Proses Sinkronisasi</span>
              <span className="font-bold text-[var(--md-sys-color-on-surface)]">
                {progress}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--md-sys-color-surface-container-highest)] overflow-hidden border border-[var(--md-sys-color-outline-variant)]/60">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isSuccess
                    ? "bg-emerald-500"
                    : "bg-gradient-to-r from-[var(--md-sys-color-primary)] to-amber-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
              />
            </div>
          </div>

          {/* TECHNICAL INFORMATION BOX */}
          <div className="w-full mt-3 rounded-xl border border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface-container-lowest)]/80 p-3 text-left font-mono space-y-1.5 text-xs shadow-inner">
            <div className="flex items-center justify-between text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
              <span className="flex items-center gap-1.5">
                <Icon icon="ph:cpu-duotone" width="13" />
                <span>Cache Tier</span>
              </span>
              <span className="text-[var(--md-sys-color-on-surface)] font-semibold">
                Redis L1 + Memory L2
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
              <span className="flex items-center gap-1.5">
                <Icon icon="ph:terminal-window-duotone" width="13" />
                <span>Operation</span>
              </span>
              <span className="truncate max-w-[210px] text-[var(--md-sys-color-primary)] font-semibold">
                {cacheLoading.detail || "Atomic Cache Invalidation & Warmup"}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
              <span className="flex items-center gap-1.5">
                <Icon icon="ph:activity-bold" width="13" />
                <span>Status</span>
              </span>
              <span
                className={`font-bold flex items-center gap-1 ${
                  isSuccess ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {!isSuccess && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                )}
                {isSuccess ? "COMPLETED (200 OK)" : "PROCESSING..."}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
