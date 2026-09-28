"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import { useAppStore } from "@/store/useAppStore";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TickerSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const { setActiveTicker } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: allUniverseData, isLoading: isLoadingUniverse } = useSWR("/api/bandar/universe/all", fetcher);
  const allTickers = useMemo(() => allUniverseData?.tickers || [], [allUniverseData?.tickers]);

  const filteredTickers = useMemo(() => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return [];
    return allTickers.filter((t: string) => t.includes(term)).slice(0, 10);
  }, [allTickers, searchTerm]);

  // Keyboard shortcut: '/' focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectTicker = (t: string) => {
    setActiveTicker(t);
    setSearchTerm("");
    setIsOpen(false);
    if (!pathname.includes("/foreign")) {
      router.push(`/${t}`);
    }
  };

  return (
    <div className="relative z-40 mb-5">
      <div className="flex items-center bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] focus-within:border-[var(--md-sys-color-primary)] rounded-xl px-3.5 py-2.5 shadow-2xs transition-all duration-200">
        <Icon icon="ph:magnifying-glass-duotone" className="text-[var(--md-sys-color-primary)] mr-2.5 flex-shrink-0" width="18" height="18" />
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent border-none outline-none text-xs sm:text-sm text-[var(--md-sys-color-on-surface)] placeholder-[var(--md-sys-color-on-surface-variant)] font-mono uppercase tracking-wider"
          placeholder="Cari Ticker Saham (Contoh: BBCA, ASII, BMRI)..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] px-2 py-0.5 rounded">
          <span>Tekan</span>
          <kbd className="text-[var(--md-sys-color-primary)]">/</kbd>
        </div>
      </div>
      
      {isOpen && searchTerm && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-xl overflow-hidden shadow-xl z-50">
            {isLoadingUniverse && allTickers.length === 0 ? (
              <div className="px-4 py-3 text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono">Memuat daftar saham bursa...</div>
            ) : filteredTickers.length > 0 ? (
              filteredTickers.map((t: string) => (
                <button
                  key={t}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-mono font-bold text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-low)] hover:text-[var(--md-sys-color-primary)] transition-colors border-b border-[var(--md-sys-color-outline-variant)] last:border-0 cursor-pointer text-left"
                  onClick={() => handleSelectTicker(t)}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>{t}</span>
                  </div>
                  <Icon icon="ph:arrow-up-right-bold" className="text-[var(--md-sys-color-on-surface-variant)]" width="12" />
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono">Saham tidak ditemukan dalam universe aktif</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
