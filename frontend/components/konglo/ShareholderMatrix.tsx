"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Gagal mengambil data pemegang saham");
    return res.json();
  });

interface Holding {
  ticker: string;
  pct: number;
  is_controlling: boolean;
}

interface CrossHoldingEntity {
  name: string;
  ticker_count: number;
  total_pct: number;
  holdings: Holding[];
}

interface ShareholderItem {
  name: string;
  pct: number;
  is_controlling: boolean;
  category: "controlling" | "substantial" | "public" | "treasury" | "management" | string;
}

interface StockShareholderDetail {
  ticker: string;
  count: number;
  shareholders: ShareholderItem[];
  summary: {
    controlling_pct: number;
    other_substantial_pct: number;
    public_pct: number;
    treasury_pct: number;
    management_pct: number;
    free_float_est: number;
    controlling_entities: string[];
  };
}

export default function ShareholderMatrix() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedTicker, setSelectedTicker] = useState<string | null>("BBCA");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [selectedEntityData, setSelectedEntityData] = useState<CrossHoldingEntity | null>(null);

  // Debounce search query 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch universe tickers for autocomplete recommendations
  const { data: allUniverseData } = useSWR<{ tickers: string[] }>(
    "/api/bandar/universe/all",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );
  const allTickers = useMemo(() => allUniverseData?.tickers || [], [allUniverseData?.tickers]);

  // Filtered tickers matching search term
  const filteredTickers = useMemo(() => {
    const term = searchQuery.trim().toUpperCase().replace(".JK", "");
    if (!term) return [];
    return allTickers.filter((t: string) => t.includes(term)).slice(0, 8);
  }, [allTickers, searchQuery]);

  // Fetch top multi-holding entities for quick chips
  const { data: topEntities, isLoading: isTopLoading } = useSWR<CrossHoldingEntity[]>(
    "/api/bandar/shareholders/top-cross-holdings?limit=16&min_holdings=2",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  );

  // Search entity results if debouncedQuery is >= 2 chars
  const { data: searchResults, isLoading: isSearchLoading } = useSWR<{
    query: string;
    count: number;
    results: CrossHoldingEntity[];
  }>(
    debouncedQuery.length >= 2
      ? `/api/bandar/shareholders/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const matchingEntities = useMemo(() => {
    return searchResults?.results || [];
  }, [searchResults]);

  // Fetch single ticker shareholder breakdown
  const { data: tickerData, isLoading: isTickerLoading, error: tickerError } = useSWR<StockShareholderDetail>(
    selectedTicker ? `/api/bandar/shareholders/${selectedTicker}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // Keyboard shortcut: '/' focuses search input, 'Escape' closes dropdown
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

  const handleSelectEntity = (entity: CrossHoldingEntity) => {
    setSelectedEntity(entity.name);
    setSelectedEntityData(entity);
    setSelectedTicker(null);
    setSearchQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleSelectTicker = (ticker: string) => {
    const clean = ticker.trim().toUpperCase().replace(".JK", "");
    if (!clean) return;
    setSelectedTicker(clean);
    setSelectedEntity(null);
    setSelectedEntityData(null);
    setSearchQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleEnterSubmit = () => {
    const term = searchQuery.trim().toUpperCase().replace(".JK", "");
    if (!term) return;

    // 1. Exact match with any ticker
    const exactTicker = allTickers.find((t: string) => t === term);
    if (exactTicker) {
      handleSelectTicker(exactTicker);
      return;
    }

    // 2. Exact match with any entity
    const exactEntity = matchingEntities.find((e) => e.name.toUpperCase() === term);
    if (exactEntity) {
      handleSelectEntity(exactEntity);
      return;
    }

    // 3. First ticker match if available
    if (filteredTickers.length > 0) {
      handleSelectTicker(filteredTickers[0]);
      return;
    }

    // 4. First entity match if available
    if (matchingEntities.length > 0) {
      handleSelectEntity(matchingEntities[0]);
      return;
    }

    // 5. Fallback as ticker
    handleSelectTicker(term);
  };

  // Find entity object if selectedEntity is active
  const activeEntityData = useMemo(() => {
    if (selectedEntityData) return selectedEntityData;
    if (!selectedEntity) return null;
    const fromSearch = searchResults?.results?.find((r) => r.name === selectedEntity);
    if (fromSearch) return fromSearch;
    const fromTop = topEntities?.find((r) => r.name === selectedEntity);
    return fromTop || null;
  }, [selectedEntityData, selectedEntity, searchResults, topEntities]);

  return (
    <div className="space-y-5">
      {/* Search & Controller Quick Filter Bar */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)]">
              <Icon icon="ph:tree-structure-duotone" width="18" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
                Peta Pemegang Saham & Cross-Holding
              </h2>
              <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                Lacak konglomerat pengendali, pemegang saham &gt;5%, kepemilikan silang, dan estimasi free float
              </p>
            </div>
          </div>
          {selectedTicker && (
            <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs font-semibold px-2.5 py-1 rounded-lg bg-[var(--md-sys-color-primary-container)]/50 text-[var(--md-sys-color-on-primary-container)] border border-[var(--md-sys-color-primary)]/20">
              <Icon icon="ph:check-circle-fill" width="14" className="text-[var(--md-sys-color-primary)]" />
              <span>Emiten Terpilih: {selectedTicker}</span>
            </div>
          )}
        </div>

        {/* Input Pencarian & Dropdown Rekomendasi */}
        <div className="relative z-30">
          <div className="flex items-center bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] focus-within:border-[var(--md-sys-color-primary)] rounded-xl px-3.5 py-2.5 shadow-2xs transition-all duration-200">
            <Icon
              icon="ph:magnifying-glass-duotone"
              className="text-[var(--md-sys-color-primary)] mr-2.5 flex-shrink-0"
              width="18"
              height="18"
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Ketik kode emiten atau nama konglomerat (misal: BBCA, BREN, Salim, Thohir, Danantara)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleEnterSubmit();
                } else if (e.key === "Escape") {
                  setIsOpen(false);
                  inputRef.current?.blur();
                }
              }}
              className="w-full bg-transparent border-none outline-none text-xs sm:text-sm text-[var(--md-sys-color-on-surface)] placeholder-[var(--md-sys-color-on-surface-variant)] font-sans"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setDebouncedQuery("");
                  setIsOpen(false);
                }}
                className="text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] p-1 cursor-pointer"
              >
                <Icon icon="ph:x-circle-fill" width="16" />
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] px-2 py-0.5 rounded shrink-0">
                <span>Tekan</span>
                <kbd className="text-[var(--md-sys-color-primary)]">/</kbd>
              </div>
            )}
          </div>

          {/* Autocomplete Recommendation Dropdown */}
          {isOpen && searchQuery.trim() && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-xl overflow-hidden shadow-xl z-50 max-h-80 overflow-y-auto">
                {/* 1. KELOMPOK EMITEN / TICKER */}
                {filteredTickers.length > 0 && (
                  <div>
                    <div className="px-3.5 py-1.5 bg-[var(--md-sys-color-surface-container-high)] text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Emiten Saham BEI</span>
                      </div>
                      <span>{filteredTickers.length} rekomendasi</span>
                    </div>
                    {filteredTickers.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-mono font-bold text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-low)] hover:text-[var(--md-sys-color-primary)] transition-colors border-b border-[var(--md-sys-color-outline-variant)] last:border-0 cursor-pointer text-left"
                        onClick={() => handleSelectTicker(t)}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="text-[var(--md-sys-color-primary)] font-extrabold text-sm">{t}</span>
                          <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-normal font-sans">
                            Lihat komposisi pemegang saham
                          </span>
                        </div>
                        <Icon icon="ph:arrow-up-right-bold" className="text-[var(--md-sys-color-on-surface-variant)]" width="12" />
                      </button>
                    ))}
                  </div>
                )}

                {/* 2. KELOMPOK ENTITAS / PEMEGANG SAHAM / KONGLOMERAT */}
                {matchingEntities.length > 0 && (
                  <div>
                    <div className="px-3.5 py-1.5 bg-[var(--md-sys-color-surface-container-high)] text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)]">
                      <div className="flex items-center gap-1.5">
                        <Icon icon="ph:crown-duotone" width="13" className="text-amber-500" />
                        <span>Entitas Pemegang Saham &amp; Konglomerat</span>
                      </div>
                      <span>{matchingEntities.length} rekomendasi</span>
                    </div>
                    {matchingEntities.map((entity) => (
                      <button
                        key={entity.name}
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-low)] hover:text-[var(--md-sys-color-primary)] transition-colors border-b border-[var(--md-sys-color-outline-variant)] last:border-0 cursor-pointer text-left"
                        onClick={() => handleSelectEntity(entity)}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs truncate">{entity.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] font-semibold shrink-0">
                              {entity.ticker_count} Emiten
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-mono mt-0.5 truncate">
                            <span>Portofolio: {entity.holdings.map((h) => h.ticker).join(", ")}</span>
                          </div>
                        </div>
                        <Icon icon="ph:arrow-up-right-bold" className="text-[var(--md-sys-color-on-surface-variant)] shrink-0" width="12" />
                      </button>
                    ))}
                  </div>
                )}

                {/* 3. LOADING STATE JIKA SEDANG MENCARI ENTITAS */}
                {isSearchLoading && matchingEntities.length === 0 && (
                  <div className="px-4 py-2.5 text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono flex items-center gap-2 border-b border-[var(--md-sys-color-outline-variant)]">
                    <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="14" />
                    <span>Mencari entitas pemegang saham...</span>
                  </div>
                )}

                {/* 4. JIKA TIDAK ADA HASIL SAMA SEKALI */}
                {filteredTickers.length === 0 && matchingEntities.length === 0 && !isSearchLoading && (
                  <div
                    className="px-4 py-3 text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono flex items-center justify-between hover:bg-[var(--md-sys-color-surface-container-low)] cursor-pointer"
                    onClick={handleEnterSubmit}
                  >
                    <span>Cari langsung saham &quot;{searchQuery.toUpperCase().trim()}&quot;</span>
                    <kbd className="text-[var(--md-sys-color-primary)] font-bold text-[10px] bg-[var(--md-sys-color-surface-container-high)] px-2 py-0.5 rounded border border-[var(--md-sys-color-outline-variant)]">
                      ↵ Enter
                    </kbd>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Top Multi-Holding Entities Quick Chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[var(--md-sys-color-on-surface-variant)] flex items-center gap-1.5">
              <Icon icon="ph:crown-duotone" width="14" className="text-amber-500" />
              Konglomerat &amp; Entitas Multi-Emiten Berpengaruh:
            </span>
            <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
              Klik chip untuk inspect
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {isTopLoading ? (
              <div className="flex items-center gap-2 py-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                <Icon icon="ph:spinner-gap-bold" className="animate-spin" width="14" />
                <span>Memuat entitas...</span>
              </div>
            ) : (
              topEntities?.map((entity) => {
                const isSelected = selectedEntity === entity.name;
                return (
                  <button
                    key={entity.name}
                    onClick={() => handleSelectEntity(entity)}
                    className={`px-2.5 py-1 rounded-full shrink-0 transition-all text-[11px] font-medium flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] border-transparent shadow-xs"
                        : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)]/50"
                    }`}
                  >
                    <span>{entity.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                        isSelected
                          ? "bg-[var(--md-sys-color-on-primary)]/20 text-[var(--md-sys-color-on-primary)]"
                          : "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
                      }`}
                    >
                      {entity.ticker_count} Emiten
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
      {/* ENTITY CROSS-HOLDING DETAIL CARD (When an entity is selected) */}
      {selectedEntity && activeEntityData && (
        <div className="rounded-[20px] bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-primary)]/40 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--md-sys-color-outline-variant)]/60 gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <Icon icon="ph:crown-duotone" width="22" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
                  <span>{activeEntityData.name}</span>
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
                    Cross-Holding Entitas
                  </span>
                </h3>
                <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                  Terdeteksi memegang saham di {activeEntityData.ticker_count} emiten terdaftar di BEI
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedEntity(null)}
              className="text-xs text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] flex items-center gap-1 self-start sm:self-auto py-1 px-2 rounded-lg hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors"
            >
              <Icon icon="ph:x-bold" width="12" />
              <span>Tutup Detail Entitas</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeEntityData.holdings.map((h) => (
              <div
                key={h.ticker}
                className="p-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)]/50 transition-all flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-sm font-extrabold text-[var(--md-sys-color-on-surface)]">
                      {h.ticker}
                    </span>
                    <span
                      className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        h.is_controlling
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {h.is_controlling ? "Pengendali" : "Substantial (>5%)"}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[var(--md-sys-color-primary)]">
                    {h.pct}%
                  </span>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--md-sys-color-outline-variant)]/50 text-[11px]">
                  <button
                    onClick={() => handleSelectTicker(h.ticker)}
                    className="font-medium text-[var(--md-sys-color-primary)] hover:underline flex items-center gap-1"
                  >
                    <Icon icon="ph:chart-pie-slice-duotone" width="14" />
                    <span>Lihat Struktur Emiten</span>
                  </button>
                  <Link
                    href={`/${h.ticker}`}
                    className="text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] flex items-center gap-0.5"
                  >
                    <span>Analisis</span>
                    <Icon icon="ph:arrow-square-out-duotone" width="12" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SINGLE TICKER SHAREHOLDER BREAKDOWN VIEW */}
      {selectedTicker && (
        <div className="rounded-[20px] bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] p-4 sm:p-6 shadow-xs space-y-5">
          {/* Header Emiten Terpilih */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-[var(--md-sys-color-outline-variant)]/60 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)] shadow-2xs font-extrabold text-sm sm:text-base">
                {selectedTicker}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                    Struktur Kepemilikan Saham: {selectedTicker}
                  </h3>
                  <Link
                    href={`/${selectedTicker}`}
                    className="text-xs text-[var(--md-sys-color-primary)] hover:underline flex items-center gap-0.5 font-medium"
                    title="Buka halaman analisis lengkap emiten ini"
                  >
                    <span>Buka Detail</span>
                    <Icon icon="ph:arrow-square-out-duotone" width="14" />
                  </Link>
                </div>
                <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                  Distribusi pemegang saham pengendali, kepemilikan substansial (&gt;5%), saham treasury, dan publik
                </p>
              </div>
            </div>

            {/* Quick Switch Ticker dropdown / buttons */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-0.5 text-xs font-semibold">
              <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase mr-1">
                Contoh:
              </span>
              {["BBCA", "BREN", "BBRI", "ADRO", "DNET", "CUAN"].map((t) => (
                <button
                  key={t}
                  onClick={() => handleSelectTicker(t)}
                  className={`px-2 py-1 rounded-md transition-all text-[11px] ${
                    selectedTicker === t
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs"
                      : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {isTickerLoading ? (
            <div className="py-12 text-center text-xs text-[var(--md-sys-color-on-surface-variant)] flex flex-col items-center justify-center gap-2.5">
              <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="24" />
              <span>Memuat struktur pemegang saham {selectedTicker}...</span>
            </div>
          ) : tickerError ? (
            <div className="py-8 text-center text-xs text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-low)] rounded-xl border border-[var(--md-sys-color-outline-variant)]">
              <Icon icon="ph:warning-circle-duotone" width="32" className="mx-auto text-amber-500 mb-1.5" />
              <p className="font-semibold text-[var(--md-sys-color-on-surface)]">
                Data pemegang saham untuk {selectedTicker} tidak ditemukan di database.
              </p>
              <p className="mt-1 text-[11px]">
                Pastikan kode saham terdaftar di Bursa Efek Indonesia.
              </p>
            </div>
          ) : tickerData ? (
            <>
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Pengendali */}
                <div className="p-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]">
                  <div className="flex items-center justify-between text-[11px] text-[var(--md-sys-color-on-surface-variant)] mb-1">
                    <span className="flex items-center gap-1 font-medium">
                      <Icon icon="ph:crown-duotone" width="14" className="text-emerald-500" />
                      Pengendali
                    </span>
                    <span className="text-[10px] font-bold text-emerald-500">
                      {tickerData.summary.controlling_pct}%
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-[var(--md-sys-color-on-surface)] truncate" title={tickerData.summary.controlling_entities.join(", ") || "-"}>
                    {tickerData.summary.controlling_entities.length > 0
                      ? tickerData.summary.controlling_entities[0]
                      : "Tidak Ada"}
                  </div>
                  {tickerData.summary.controlling_entities.length > 1 && (
                    <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                      +{tickerData.summary.controlling_entities.length - 1} entitas pengendali lain
                    </div>
                  )}
                </div>

                {/* Free Float / Publik */}
                <div className="p-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]">
                  <div className="flex items-center justify-between text-[11px] text-[var(--md-sys-color-on-surface-variant)] mb-1">
                    <span className="flex items-center gap-1 font-medium">
                      <Icon icon="ph:globe-duotone" width="14" className="text-blue-500" />
                      Free Float (Publik)
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-[var(--md-sys-color-on-surface)]">
                    {tickerData.summary.public_pct}%
                  </div>
                  <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                    Masyarakat Warkat &amp; Non-Warkat
                  </div>
                </div>

                {/* Substantial Non-Controlling */}
                <div className="p-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]">
                  <div className="flex items-center justify-between text-[11px] text-[var(--md-sys-color-on-surface-variant)] mb-1">
                    <span className="flex items-center gap-1 font-medium">
                      <Icon icon="ph:users-three-duotone" width="14" className="text-indigo-500" />
                      Non-Pengendali &gt;5%
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-[var(--md-sys-color-on-surface)]">
                    {tickerData.summary.other_substantial_pct}%
                  </div>
                  <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                    Institusi &amp; Investor Strategis
                  </div>
                </div>

                {/* Saham Treasury & Manajemen */}
                <div className="p-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]">
                  <div className="flex items-center justify-between text-[11px] text-[var(--md-sys-color-on-surface-variant)] mb-1">
                    <span className="flex items-center gap-1 font-medium">
                      <Icon icon="ph:vault-duotone" width="14" className="text-amber-500" />
                      Treasury &amp; Direksi
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-[var(--md-sys-color-on-surface)]">
                    {(tickerData.summary.treasury_pct + tickerData.summary.management_pct).toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                    Treasury: {tickerData.summary.treasury_pct}% | Direksi: {tickerData.summary.management_pct}%
                  </div>
                </div>
              </div>

              {/* Visual Ownership Stacked Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--md-sys-color-on-surface)]">
                  <span className="flex items-center gap-1.5">
                    <Icon icon="ph:chart-pie-slice-duotone" width="15" className="text-[var(--md-sys-color-primary)]" />
                    Proporsi Kepemilikan Saham
                  </span>
                  <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-normal">
                    Total: 100%
                  </span>
                </div>
                <div className="h-3.5 w-full bg-[var(--md-sys-color-surface-container-high)] rounded-full overflow-hidden flex shadow-inner">
                  {tickerData.summary.controlling_pct > 0 && (
                    <div
                      style={{ width: `${tickerData.summary.controlling_pct}%` }}
                      className="bg-emerald-500 dark:bg-emerald-400 h-full transition-all"
                      title={`Pengendali: ${tickerData.summary.controlling_pct}%`}
                    />
                  )}
                  {tickerData.summary.other_substantial_pct > 0 && (
                    <div
                      style={{ width: `${tickerData.summary.other_substantial_pct}%` }}
                      className="bg-indigo-500 dark:bg-indigo-400 h-full transition-all"
                      title={`Substantial >5%: ${tickerData.summary.other_substantial_pct}%`}
                    />
                  )}
                  {tickerData.summary.public_pct > 0 && (
                    <div
                      style={{ width: `${tickerData.summary.public_pct}%` }}
                      className="bg-sky-500 dark:bg-sky-400 h-full transition-all"
                      title={`Publik: ${tickerData.summary.public_pct}%`}
                    />
                  )}
                  {tickerData.summary.treasury_pct > 0 && (
                    <div
                      style={{ width: `${tickerData.summary.treasury_pct}%` }}
                      className="bg-amber-500 dark:bg-amber-400 h-full transition-all"
                      title={`Treasury: ${tickerData.summary.treasury_pct}%`}
                    />
                  )}
                  {tickerData.summary.management_pct > 0 && (
                    <div
                      style={{ width: `${tickerData.summary.management_pct}%` }}
                      className="bg-purple-500 dark:bg-purple-400 h-full transition-all"
                      title={`Manajemen: ${tickerData.summary.management_pct}%`}
                    />
                  )}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Pengendali ({tickerData.summary.controlling_pct}%)</span>
                  </div>
                  {tickerData.summary.other_substantial_pct > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                      <span>Non-Pengendali &gt;5% ({tickerData.summary.other_substantial_pct}%)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                    <span>Publik / Free Float ({tickerData.summary.public_pct}%)</span>
                  </div>
                  {tickerData.summary.treasury_pct > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Treasury ({tickerData.summary.treasury_pct}%)</span>
                    </div>
                  )}
                  {tickerData.summary.management_pct > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                      <span>Direksi / Afiliasi ({tickerData.summary.management_pct}%)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Shareholder Breakdown Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--md-sys-color-on-surface)]">
                  <span>Daftar Pemegang Saham Terdaftar ({tickerData.count})</span>
                  <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-normal">
                    Diurutkan dari porsi kepemilikan tertinggi
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] font-semibold text-[11px]">
                        <th className="py-2.5 px-3.5">Nama Pemegang Saham</th>
                        <th className="py-2.5 px-3 text-right">Persentase</th>
                        <th className="py-2.5 px-3 text-center">Klasifikasi</th>
                        <th className="py-2.5 px-3.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/60">
                      {tickerData.shareholders.map((sh, idx) => {
                        const isCtrl = sh.is_controlling;
                        const isPub = sh.category === "public";
                        const isTreas = sh.category === "treasury";
                        const isSubst = sh.category === "substantial";

                        return (
                          <tr
                            key={`${sh.name}-${idx}`}
                            className="hover:bg-[var(--md-sys-color-surface-container)] transition-colors"
                          >
                            <td className="py-2.5 px-3.5 font-medium text-[var(--md-sys-color-on-surface)]">
                              <div className="flex items-center gap-2">
                                {isCtrl && (
                                  <Icon icon="ph:crown-fill" width="14" className="text-amber-500 shrink-0" />
                                )}
                                <span>{sh.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-[var(--md-sys-color-on-surface)]">
                              {sh.pct.toFixed(2)}%
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block ${
                                  isCtrl
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                    : isSubst
                                    ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                                    : isPub
                                    ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
                                    : isTreas
                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                    : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]"
                                }`}
                              >
                                {isCtrl
                                  ? "Pengendali"
                                  : isSubst
                                  ? "Substansial >5%"
                                  : isPub
                                  ? "Publik"
                                  : isTreas
                                  ? "Treasury"
                                  : "Direksi / Lainnya"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right">
                              {!isPub && !isTreas && sh.pct > 0.5 && (
                                <button
                                  onClick={() => {
                                    setSearchQuery(sh.name);
                                    setDebouncedQuery(sh.name);
                                  }}
                                  className="text-[10px] font-medium text-[var(--md-sys-color-primary)] hover:underline flex items-center gap-1 ml-auto"
                                  title={`Cari emiten lain yang dimiliki oleh ${sh.name}`}
                                >
                                  <Icon icon="ph:magnifying-glass-duotone" width="12" />
                                  <span>Cek Cross-Holdings</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
