"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import useSWR from 'swr';
import { useAppStore } from '@/store/useAppStore';
import { useForeignFlowAnalytics } from '@/hooks/useForeignFlow';
import { Icon } from "@iconify/react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const VARChart = dynamic(() => import('./VARChart'), { ssr: false });
const HMMChart = dynamic(() => import('./HMMChart'), { ssr: false });
const BrokerHeatmap = dynamic(() => import('./BrokerHeatmap'), { ssr: false });
const BrokerNetworkGraph = dynamic(() => import('./BrokerNetworkGraph'), { ssr: false });

const POPULAR_TICKERS = ["BBCA", "BBRI", "BMRI", "BBNI", "TLKM", "ASII", "ADRO", "BREN", "AMMN", "BRPT"];
const WINDOW_OPTIONS = [
  { value: 20, label: "20 Hari" },
  { value: 30, label: "30 Hari" },
  { value: 60, label: "60 Hari" },
  { value: 90, label: "90 Hari" },
  { value: 180, label: "180 Hari" },
];

export default function ForeignFlowDeepDiveTab() {
  const { activeTicker, setActiveTicker, windowDays, setWindowDays } = useAppStore();
  const { data, isLoading, isFetching, isError } = useForeignFlowAnalytics(activeTicker, windowDays);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allUniverseData, isLoading: isLoadingUniverse } = useSWR("/api/bandar/universe/all", fetcher);
  const allTickers = useMemo(() => allUniverseData?.tickers || [], [allUniverseData?.tickers]);

  const filteredTickers = useMemo(() => {
    const term = searchTerm.trim().toUpperCase().replace(".JK", "");
    if (!term) return [];
    return allTickers.filter((t: string) => t.includes(term)).slice(0, 10);
  }, [allTickers, searchTerm]);

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

  const handleSelectTicker = (t: string) => {
    const clean = t.trim().toUpperCase().replace(".JK", "");
    if (!clean) return;
    setActiveTicker(clean);
    setSearchTerm("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleEnterSubmit = () => {
    const term = searchTerm.trim().toUpperCase().replace(".JK", "");
    if (!term) return;

    const exact = allTickers.find((t: string) => t === term);
    if (exact) {
      handleSelectTicker(exact);
      return;
    }

    if (filteredTickers.length > 0) {
      handleSelectTicker(filteredTickers[0]);
      return;
    }

    handleSelectTicker(term);
  };

  const getHmmTone = (state: number): string => {
    if (state === 2) return "var(--color-positive)"; 
    if (state === 0) return "var(--color-negative)"; 
    return "var(--md-sys-color-outline)";                  
  };

  const getHmmLabel = (state: number): string => {
    if (state === 2) return "Akumulasi Asing";
    if (state === 0) return "Distribusi Asing";
    return "Netral / Terkonsolidasi";
  };

  const zScoreValue = data?.features?.foreign_zscore || 0;
  const hhiValue = data?.features?.foreign_hhi || 0;
  const latestState = data?.timeseries?.hmm_states?.length > 0 
    ? data.timeseries.hmm_states[data.timeseries.hmm_states.length - 1] 
    : 1;

  const companyName = data?.company?.name || "Perusahaan Terdaftar IDX";
  const groupName = data?.company?.group || "Independen / Non-Afiliasi";

  return (
    <div className="flex flex-col gap-5 sm:gap-6 pb-20 transition-colors duration-300">
      
      {/* KONTROL EMITEN & INTELLIGENCE BAR */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Baris 1: Detail Emiten Aktif & Window Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 pb-3.5 border-b border-[var(--md-sys-color-outline-variant)]/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)] shadow-2xs font-extrabold text-base sm:text-lg">
              {activeTicker}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                  {activeTicker}
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
                  {groupName}
                </span>
                <Link
                  href={`/${activeTicker}`}
                  className="text-xs text-[var(--md-sys-color-primary)] hover:underline flex items-center gap-0.5 font-medium ml-1"
                  title="Lihat halaman analisis lengkap emiten ini"
                >
                  <span>Detail Saham</span>
                  <Icon icon="ph:arrow-square-out-duotone" width="13" />
                </Link>
              </div>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5 font-medium">
                {companyName}
              </p>
            </div>
          </div>

          {/* Window Days & Updating Pill */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {isFetching && !isLoading && (
              <span className="text-[10px] font-bold uppercase text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 shadow-2xs flex items-center gap-1.5">
                <Icon icon="ph:spinner-gap-bold" className="animate-spin" width="12" />
                <span>Update...</span>
              </span>
            )}
            
            <div className="flex items-center p-1 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] text-xs font-semibold">
              {WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setWindowDays(opt.value)}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all text-[11px] ${
                    windowDays === opt.value
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs"
                      : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Baris 2: Search Input & Quick Emiten Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative sm:w-80 z-30">
            <div className="flex items-center bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] focus-within:border-[var(--md-sys-color-primary)] rounded-xl px-3 py-1.5 shadow-2xs transition-all duration-200">
              <Icon
                icon="ph:magnifying-glass-duotone"
                className="text-[var(--md-sys-color-primary)] mr-2 flex-shrink-0"
                width="16"
                height="16"
              />
              <input
                ref={inputRef}
                type="text"
                placeholder="Cari kode saham (misal: BBCA, ASII)..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
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
                className="w-full bg-transparent border-none outline-none text-xs text-[var(--md-sys-color-on-surface)] placeholder-[var(--md-sys-color-on-surface-variant)] font-mono uppercase tracking-wider"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setIsOpen(false);
                  }}
                  className="text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] p-0.5 cursor-pointer"
                >
                  <Icon icon="ph:x-circle-fill" width="14" />
                </button>
              ) : (
                <div className="hidden sm:flex items-center gap-1 text-[9px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] px-1.5 py-0.5 rounded shrink-0">
                  <kbd className="text-[var(--md-sys-color-primary)]">/</kbd>
                </div>
              )}
            </div>

            {/* Dropdown Rekomendasi Ticker */}
            {isOpen && searchTerm.trim() && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-xl overflow-hidden shadow-xl z-50 max-h-72 overflow-y-auto">
                  {isLoadingUniverse && allTickers.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono flex items-center gap-2">
                      <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="14" />
                      <span>Memuat daftar saham bursa...</span>
                    </div>
                  ) : filteredTickers.length > 0 ? (
                    filteredTickers.map((t: string) => (
                      <button
                        key={t}
                        type="button"
                        className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-mono font-bold text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-low)] hover:text-[var(--md-sys-color-primary)] transition-colors border-b border-[var(--md-sys-color-outline-variant)] last:border-0 cursor-pointer text-left"
                        onClick={() => handleSelectTicker(t)}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="text-[var(--md-sys-color-primary)] font-extrabold">{t}</span>
                          <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-normal">Saham IDX</span>
                        </div>
                        <Icon icon="ph:arrow-up-right-bold" className="text-[var(--md-sys-color-on-surface-variant)]" width="12" />
                      </button>
                    ))
                  ) : (
                    <div
                      className="px-4 py-3 text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono flex items-center justify-between hover:bg-[var(--md-sys-color-surface-container-low)] cursor-pointer"
                      onClick={handleEnterSubmit}
                    >
                      <span>Cari langsung saham &quot;{searchTerm.toUpperCase().trim()}&quot;</span>
                      <kbd className="text-[var(--md-sys-color-primary)] font-bold text-[10px] bg-[var(--md-sys-color-surface-container-high)] px-2 py-0.5 rounded border border-[var(--md-sys-color-outline-variant)]">
                        ↵ Enter
                      </kbd>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Quick Emiten Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs font-medium">
            <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase mr-0.5 shrink-0 font-semibold">
              Populer:
            </span>
            {POPULAR_TICKERS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTicker(t)}
                className={`px-2 py-0.5 rounded-md font-mono text-[11px] shrink-0 transition-all ${
                  activeTicker === t
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold shadow-2xs"
                    : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LOADING STATE */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container)] rounded-2xl border border-[var(--md-sys-color-outline-variant)] shadow-xs gap-3">
          <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="28" />
          <span className="font-bold tracking-wider uppercase text-xs">
            Menghitung model VAR, HMM, &amp; Analitik Arus Asing ({activeTicker})...
          </span>
        </div>
      )}
      
      {/* ERROR STATE */}
      {isError && !isLoading && (
        <div className="p-6 text-center bg-[var(--md-sys-color-surface-container-low)] rounded-2xl border border-[var(--md-sys-color-outline-variant)] space-y-3">
          <Icon icon="ph:warning-circle-duotone" width="36" className="mx-auto text-amber-500" />
          <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
            Data Analitik {activeTicker} Belum Lengkap
          </h3>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] max-w-md mx-auto">
            Histori transaksi asing untuk {activeTicker} pada window {windowDays} hari belum mencukupi atau belum diproses oleh pipeline Smtracker.
          </p>
          <div className="pt-2 flex justify-center gap-2">
            {["BBCA", "BBRI", "BMRI"].map((fallback) => (
              <button
                key={fallback}
                onClick={() => setActiveTicker(fallback)}
                className="px-3 py-1 rounded-lg bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] text-xs font-bold shadow-xs hover:opacity-90"
              >
                Coba {fallback}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DASHBOARD KONTEN */}
      {!isLoading && !isError && data && (
        <>
          {/* TACTICAL METRIC CARDS (MD3 Expressive Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
            {/* Regime Card */}
            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: getHmmTone(latestState) }}></div>
              <div className="pl-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--md-sys-color-on-surface-variant)] mb-2">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                    <Icon icon="ph:chart-polar-bold" style={{ color: getHmmTone(latestState) }} width="16" />
                    Regime Aliran Asing
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${getHmmTone(latestState)}20`, color: getHmmTone(latestState) }}>
                    HMM State {latestState}
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-extrabold tracking-tight mt-1" style={{ color: getHmmTone(latestState) }}>
                  {getHmmLabel(latestState)}
                </div>
                <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1.5 leading-relaxed">
                  {latestState === 2
                    ? "Asing aktif memupuk posisi akumulasi bersih."
                    : latestState === 0
                    ? "Tekanan jual asing dominan mendistribusikan saham."
                    : "Arus beli dan jual asing seimbang di pasar."}
                </p>
              </div>
            </div>
            
            {/* Momentum Card */}
            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div
                className="absolute top-0 left-0 w-1.5 h-full"
                style={{ backgroundColor: zScoreValue > 1 ? "var(--color-positive)" : zScoreValue < -1 ? "var(--color-negative)" : "var(--md-sys-color-outline)" }}
              ></div>
              <div className="pl-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--md-sys-color-on-surface-variant)] mb-2">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                    <Icon icon="ph:trend-up-bold" style={{ color: zScoreValue > 1 ? "var(--color-positive)" : zScoreValue < -1 ? "var(--color-negative)" : "var(--md-sys-color-outline)" }} width="16" />
                    Momentum Aliran (Z-Score)
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    zScoreValue > 1
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : zScoreValue < -1
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]"
                  }`}>
                    {zScoreValue > 1 ? "Strong Inflow" : zScoreValue < -1 ? "Strong Outflow" : "Normal"}
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-extrabold tracking-tight font-mono text-[var(--md-sys-color-on-surface)] mt-1">
                  {`${zScoreValue > 0 ? '+' : ''}${zScoreValue.toFixed(2)}σ`}
                </div>
                <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1.5 leading-relaxed">
                  Deviasi aliran dana asing terhadap rata-rata historis {windowDays} hari.
                </p>
              </div>
            </div>

            {/* Concentration Card */}
            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div
                className="absolute top-0 left-0 w-1.5 h-full"
                style={{ backgroundColor: hhiValue > 0.5 ? "#f59e0b" : "var(--md-sys-color-outline)" }}
              ></div>
              <div className="pl-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--md-sys-color-on-surface-variant)] mb-2">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                    <Icon icon="ph:target-bold" style={{ color: hhiValue > 0.5 ? "#f59e0b" : "var(--md-sys-color-outline)" }} width="16" />
                    Konsentrasi Broker (HHI)
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    hhiValue > 0.5
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                  }`}>
                    {hhiValue > 0.5 ? "Terkonsentrasi" : "Terdistribusi"}
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-extrabold tracking-tight font-mono text-[var(--md-sys-color-on-surface)] mt-1">
                  {hhiValue.toFixed(4)}
                </div>
                <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1.5 leading-relaxed">
                  {hhiValue > 0.5 ? "Aksi didominasi oleh sedikit broker jangkar." : "Transaksi terbagi rata ke banyak broker partisipan."}
                </p>
              </div>
            </div>
          </div>

          {/* BARIS CHARTS 1: HMM & VAR */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {/* HMM Chart Card */}
            <div className="bg-[var(--md-sys-color-surface-container)] p-4 sm:p-6 rounded-2xl border border-[var(--md-sys-color-outline-variant)] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--md-sys-color-outline-variant)]/60">
                  <div className="flex items-center gap-2">
                    <Icon icon="ph:chart-line-up-bold" className="text-[var(--md-sys-color-primary)]" width="20" />
                    <h3 className="text-xs sm:text-sm font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight uppercase">
                      HMM Market Regime Detection
                    </h3>
                  </div>
                  {/* Legend pills */}
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[var(--md-sys-color-on-surface-variant)]">Akumulasi</span>
                    <span className="w-2 h-2 rounded-full bg-rose-500 ml-1" />
                    <span className="text-[var(--md-sys-color-on-surface-variant)]">Distribusi</span>
                  </div>
                </div>

                <div className="w-full h-[280px] relative z-0">
                  <HMMChart timeSeries={data.timeseries} />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/50">
                <p className="text-[11px] leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
                  <strong className="text-[var(--md-sys-color-on-surface)]">Cara Membaca:</strong> Latar <span className="text-emerald-500 font-bold">Hijau (Akumulasi)</span>, <span className="text-rose-500 font-bold">Merah (Distribusi)</span>, dan <span className="text-slate-400 font-bold">Abu-Abu (Netral)</span>. Bila harga melemah saat latar hijau, terjadi <em>hidden accumulation</em> yang merupakan indikasi kuat potensi <strong>early reversal</strong>.
                </p>
              </div>
            </div>
            
            {/* VAR Impulse Response Card */}
            <div className="bg-[var(--md-sys-color-surface-container)] p-4 sm:p-6 rounded-2xl border border-[var(--md-sys-color-outline-variant)] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--md-sys-color-outline-variant)]/60">
                  <div className="flex items-center gap-2">
                    <Icon icon="ph:pulse-bold" className="text-[var(--md-sys-color-primary)]" width="20" />
                    <h3 className="text-xs sm:text-sm font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight uppercase">
                      Foreign Shock Causality (VAR)
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--md-sys-color-on-surface-variant)]">
                    Impulse Response
                  </span>
                </div>

                <div className="w-full h-[280px] relative z-0">
                  <VARChart irfData={data.models.impulse_response} />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/50">
                <p className="text-[11px] leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
                  <strong className="text-[var(--md-sys-color-on-surface)]">Cara Membaca:</strong> Sumbu X (T+0 s/d T+10) merefleksikan hari pasca shock dana asing. Garis di atas 0 menunjukkan dampak dorongan harga positif. Jika garis bertahan hingga T+10, efek beli asing berkarakteristik <strong>persisten</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* BARIS CHARTS 2: BROKER HEATMAP & NETWORK GRAPH */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {/* Broker Heatmap */}
            <div className="bg-[var(--md-sys-color-surface-container)] p-4 sm:p-6 rounded-2xl border border-[var(--md-sys-color-outline-variant)] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--md-sys-color-outline-variant)]/60">
                  <div className="flex items-center gap-2">
                    <Icon icon="ph:squares-four-bold" className="text-[var(--md-sys-color-primary)]" width="20" />
                    <h3 className="text-xs sm:text-sm font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight uppercase">
                      Top Broker Heatmap Matrix
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--md-sys-color-on-surface-variant)]">
                    Z-Score Aktivitas Harian
                  </span>
                </div>

                <div className="w-full h-[320px] relative z-0">
                  <BrokerHeatmap heatmapData={data.models.broker_heatmap} />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/50">
                <p className="text-[11px] leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
                  <strong className="text-[var(--md-sys-color-on-surface)]">Cara Membaca:</strong> Matriks aktivitas broker per hari yang dinormalisasi. Warna <span className="text-emerald-500 font-bold">Hijau</span> menandakan akumulasi dominan, sedangkan <span className="text-rose-500 font-bold">Merah</span> menandakan distribusi kuat dari broker institusi asing.
                </p>
              </div>
            </div>

            {/* Syndicate Network Graph */}
            <div className="bg-[var(--md-sys-color-surface-container)] p-4 sm:p-6 rounded-2xl border border-[var(--md-sys-color-outline-variant)] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--md-sys-color-outline-variant)]/60">
                  <div className="flex items-center gap-2">
                    <Icon icon="ph:share-network-bold" className="text-[var(--md-sys-color-primary)]" width="20" />
                    <h3 className="text-xs sm:text-sm font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight uppercase">
                      Syndicate Network Graph
                    </h3>
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--md-sys-color-on-surface-variant)]">
                    Kluster Sindikat Broker
                  </span>
                </div>

                <div className="w-full h-[320px] relative z-0">
                  <BrokerNetworkGraph networkData={data.models.broker_network} />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/50">
                <p className="text-[11px] leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
                  <strong className="text-[var(--md-sys-color-on-surface)]">Cara Membaca:</strong> Menggambarkan korelasi transaksi antar broker. Node berukuran besar menandakan <strong>Anchor Broker</strong>, dan garis hijau tebal merefleksikan aksi beli serempak (sindikat kooperatif).
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
