"use client";

import React, { useState } from 'react';
import useSWR from 'swr';
import { Icon } from "@iconify/react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LogsPage() {
  const { data, error, isLoading, isValidating, mutate } = useSWR('/api/logs/daily', fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false
  });

  const [activeTab, setActiveTab] = useState<'scanner' | 'auditor' | 'backfill' | 'etl_flow'>('scanner');

  const tabs = [
    { key: 'scanner', label: 'Scanner', icon: 'ph:lightning-duotone' },
    { key: 'auditor', label: 'Auditor', icon: 'ph:robot-duotone' },
    { key: 'backfill', label: 'Backfill', icon: 'ph:download-simple-duotone' },
    { key: 'etl_flow', label: 'ETL Flow', icon: 'ph:graph-duotone' },
  ] as const;

  const currentLog = data?.logs?.[activeTab] || "Menunggu data...";

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)]">
      <Icon icon="ph:spinner-gap-duotone" className="animate-spin mr-2" width="20" />
      Loading System Logs...
    </div>
  );

  if (error) return (
    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm rounded-xl m-4">
      Gagal memuat log. Pastikan backend FastAPI aktif.
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 pb-24 animate-fade-in">
      
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
        <h1 className="text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight leading-none">SYSTEM LOGS</h1>
        <button 
          onClick={() => mutate()}
          disabled={isValidating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--md-sys-color-surface)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-md text-xs font-semibold text-[var(--md-sys-color-on-surface)] transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <Icon icon={isValidating ? "ph:spinner-gap-duotone" : "ph:arrows-clockwise-bold"} className={isValidating ? "animate-spin" : "text-[var(--md-sys-color-primary)]"} width="14" height="14" />
          <span>{isValidating ? "Syncing..." : "Refresh"}</span>
        </button>
      </div>

      {/* TABS PILIHAN LOG */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all active:scale-[0.98] shadow-sm ${
                isActive
                  ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-[var(--md-sys-color-primary)]"
                  : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
              }`}
            >
              <Icon icon={tab.icon} width="14" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TERMINAL EMULATOR UI */}
      <div className="bg-[var(--md-sys-color-surface-container-lowest)] dark:bg-black/40 border border-[var(--md-sys-color-outline-variant)] rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 bg-[var(--md-sys-color-surface-container-high)] dark:bg-black/20 border-b border-[var(--md-sys-color-outline-variant)] px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
          </div>
          <span className="text-[10px] font-mono font-medium text-[var(--md-sys-color-on-surface-variant)] ml-2">
            {activeTab}_log.txt
          </span>
        </div>
        
        <div className="p-4 h-[60vh] overflow-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)]">
          <pre className="text-[11px] sm:text-xs font-mono whitespace-pre-wrap text-[var(--md-sys-color-on-surface)] dark:text-emerald-400/90 leading-relaxed">
            {currentLog}
          </pre>
        </div>
      </div>
      
    </div>
  );
}
