"use client";

import React, { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import { useAppStore } from "@/store/useAppStore";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TickerSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const { setActiveTicker } = useAppStore();
  
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: allUniverseData, isLoading: isLoadingUniverse } = useSWR("/api/bandar/universe/all", fetcher);
  const allTickers = useMemo(() => allUniverseData?.tickers || [], [allUniverseData?.tickers]);

  const filteredTickers = useMemo(() => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return [];
    return allTickers.filter((t: string) => t.includes(term)).slice(0, 10);
  }, [allTickers, searchTerm]);

  const handleSelectTicker = (t: string) => {
    setActiveTicker(t);
    setSearchTerm("");
    if (!pathname.includes("/foreign")) {
      router.push(`/${t}`);
    }
  };

  return (
    <div className="relative z-40 mb-5">
      <div className="flex items-center bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] focus-within:border-[var(--md-sys-color-primary)] rounded-xl px-3.5 py-2.5 shadow-sm transition-all duration-300">
        <Icon icon="ph:magnifying-glass-duotone" className="text-[var(--md-sys-color-primary)] mr-2.5" width="18" height="18" />
        <input
          type="text"
          className="w-full bg-transparent border-none outline-none text-xs sm:text-sm text-[var(--md-sys-color-on-surface)] placeholder-[var(--md-sys-color-on-surface-variant)] font-mono uppercase tracking-wider"
          placeholder="Cari Ticker Saham (Contoh: BBCA)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {searchTerm && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-xl overflow-hidden shadow-lg z-50">
          {isLoadingUniverse && allTickers.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono">Memuat daftar saham bursa...</div>
          ) : filteredTickers.length > 0 ? (
            filteredTickers.map((t: string) => (
              <button
                key={t}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-mono text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-low)] hover:text-[var(--md-sys-color-primary)] transition-colors border-b border-[var(--md-sys-color-outline-variant)] last:border-0"
                onClick={() => handleSelectTicker(t)}
              >
                <span>{t}</span>
                <Icon icon="ph:arrow-up-right-bold" className="text-[var(--md-sys-color-on-surface-variant)]" width="12" />
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono">Saham tidak ditemukan</div>
          )}
        </div>
      )}
    </div>
  );
}
