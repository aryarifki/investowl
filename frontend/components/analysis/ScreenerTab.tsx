"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import { useAppStore } from "@/store/useAppStore";
import { fmtRp } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ScreenerProps {
  universeMode?: string;
  analysisDate?: string;
  windowDays?: number;
  customTickers?: string[];
}

export default function ScreenerTab({ 
  universeMode, 
  analysisDate = "", 
  windowDays = 20, 
  customTickers 
}: ScreenerProps) {
  const router = useRouter();
  const { universe, setSidebarOpen, localWatchlist, setLocalWatchlist } = useAppStore();
  
  // Universe dikontrol secara terpusat dari Sidebar / global store
  const activeUniverse = universeMode || universe || "watchlist";
  const [minLiq, setMinLiq] = useState<number>(0); 
  const [showOnlyAcc, setShowOnlyAcc] = useState<boolean>(false);

  // Resolusi daftar ticker watchlist: prioritas prop -> Zustand store -> localStorage
  const effectiveWatchlist: string[] = useMemo(() => {
    if (customTickers && customTickers.length > 0) return customTickers;
    if (localWatchlist && localWatchlist.length > 0) return localWatchlist;
    try {
      const ls = localStorage.getItem("investowl_watchlist") || localStorage.getItem("tradepulse_watchlist");
      if (ls) {
        const parsed = JSON.parse(ls);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [];
  }, [customTickers, localWatchlist]);

  // Sinkronisasi jika store lokal masih kosong
  useEffect(() => {
    if (effectiveWatchlist.length > 0 && localWatchlist.length === 0) {
      setLocalWatchlist(effectiveWatchlist);
    }
  }, [effectiveWatchlist, localWatchlist.length, setLocalWatchlist]);

  // Bangun URL API Screener
  const screenerUrl = useMemo(() => {
    let base = `/api/bandar/screener-v2?universe_mode=${activeUniverse}&analysis_date=${analysisDate}&window_days=${windowDays}`;
    if (activeUniverse === "watchlist") {
      if (effectiveWatchlist.length > 0) {
        base += `&tickers=${effectiveWatchlist.join(",")}`;
      } else {
        // Jangan fetch fallback legacy jika watchlist pengguna kosong
        return null;
      }
    }
    return base;
  }, [activeUniverse, analysisDate, windowDays, effectiveWatchlist]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    screenerUrl, 
    fetcher, 
    { 
      refreshInterval: 0, 
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const rawResults = data?.data || [];
  const meta = data?.meta || {};
  
  let results = rawResults.filter((r: any) => (r.total_value || 0) >= minLiq);
  
  if (showOnlyAcc) {
    results = results.filter((r: any) => {
      const sig = (r.signal || "").toUpperCase();
      return sig.includes("ACCUMULATION") || sig.includes("AKUMULASI") || sig.includes("BUY");
    });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* ====== CONTROLS & UNIVERSE INFO ====== */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 sm:p-6 shadow-xs transition-colors duration-200">
        
        {/* HEADER TARGET & STATUS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-[var(--md-sys-color-outline-variant)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Icon icon="ph:funnel-duotone" className="text-[var(--md-sys-color-primary)]" width="20" />
              <h3 className="text-base font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                Terminal Screener
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
              <span>Target Universe:</span>
              <span className="font-mono font-bold text-[var(--md-sys-color-primary)] uppercase bg-[var(--md-sys-color-surface-container-high)] px-2.5 py-0.5 rounded border border-[var(--md-sys-color-outline-variant)]">
                {activeUniverse === "watchlist" 
                  ? `Watchlist Saya (${effectiveWatchlist.length} Saham)` 
                  : activeUniverse.toUpperCase()}
              </span>
              <button
                onClick={() => setSidebarOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] underline cursor-pointer ml-1"
                title="Buka Sidebar untuk mengganti Universe"
              >
                <Icon icon="ph:sliders-horizontal-bold" width="12" />
                <span>Ubah di Sidebar</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] flex items-center gap-2 bg-[var(--md-sys-color-surface-container-high)] px-3 py-1.5 rounded-lg border border-[var(--md-sys-color-outline-variant)] self-start sm:self-auto">
            <span>Periode: <b className="text-[var(--md-sys-color-on-surface)]">{meta.window_start || "-"}</b> s/d <b className="text-[var(--md-sys-color-on-surface)]">{meta.analysis_date || "-"}</b></span>
            <span>•</span>
            <span className="text-[var(--color-positive)] font-extrabold">{results.length} Saham Lolos</span>
          </div>
        </div>

        {/* FILTER SETTINGS & RUN SCAN BUTTON */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Akumulasi Saja */}
            <label className="flex items-center gap-2 text-xs font-bold text-[var(--md-sys-color-on-surface)] cursor-pointer select-none bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] rounded-lg px-3.5 py-2 transition-all">
              <input 
                type="checkbox" 
                checked={showOnlyAcc} 
                onChange={(e) => setShowOnlyAcc(e.target.checked)} 
                className="rounded accent-[var(--md-sys-color-primary)] w-3.5 h-3.5 cursor-pointer" 
              />
              <span>Hanya Akumulasi</span>
            </label>
            
            {/* Filter Minimum Likuiditas */}
            <select 
              className="bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] rounded-lg px-3 py-2 text-xs font-mono font-bold text-[var(--md-sys-color-on-surface)] outline-none cursor-pointer transition-colors"
              value={minLiq}
              onChange={(e) => setMinLiq(Number(e.target.value))}
            >
              <option value={0}>Semua Likuiditas Transaksi</option>
              <option value={1000000000}>&gt; Rp 1 Miliar / hari</option>
              <option value={5000000000}>&gt; Rp 5 Miliar / hari</option>
              <option value={10000000000}>&gt; Rp 10 Miliar / hari</option>
            </select>
          </div>

          {/* Tombol Run Scan / Refresh */}
          <button 
            onClick={() => mutate()}
            disabled={isValidating || !screenerUrl}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--md-sys-color-primary-container)] hover:opacity-90 border border-[var(--md-sys-color-primary)] rounded-lg text-xs font-mono font-bold text-[var(--md-sys-color-on-primary-container)] transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <Icon 
              icon={isValidating ? "ph:spinner-gap-bold" : "ph:arrows-clockwise-bold"} 
              className={isValidating ? "animate-spin" : ""} 
              width="15" 
            />
            <span>{isValidating ? "Memindai Pasar..." : "Jalankan Scan"}</span>
          </button>
        </div>
      </div>

      {/* ====== STATUS / NOTICE JIKA WATCHLIST KOSONG ====== */}
      {activeUniverse === "watchlist" && effectiveWatchlist.length === 0 && (
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-8 text-center space-y-3">
          <Icon icon="ph:binoculars-duotone" width="40" className="mx-auto text-[var(--md-sys-color-primary)] opacity-70" />
          <h4 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
            Watchlist Anda Belum Memiliki Saham
          </h4>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] max-w-md mx-auto">
            Silakan tambahkan emiten ke dalam Watchlist melalui halaman Home, atau ubah Universe (seperti LQ45 atau IDX80) melalui panel Sidebar.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] rounded-lg text-xs font-bold transition-all hover:opacity-90 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <Icon icon="ph:house-bold" width="14" />
              <span>Buka Halaman Home</span>
            </button>
            <button
              onClick={() => setSidebarOpen(true)}
              className="px-4 py-2 bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-lg text-xs font-bold transition-all hover:bg-[var(--md-sys-color-surface-container-highest)] cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <Icon icon="ph:sliders-horizontal-bold" width="14" />
              <span>Buka Sidebar</span>
            </button>
          </div>
        </div>
      )}

      {/* ====== LOADING SKELETON ====== */}
      {isLoading && !data && (
        <div className="p-10 border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] rounded-2xl flex flex-col items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)] shadow-xs animate-pulse">
          <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="28" />
          <span className="text-xs font-mono font-bold tracking-wide">
            Memindai data transaksi broker ({activeUniverse.toUpperCase()})...
          </span>
        </div>
      )}

      {/* ====== ERROR ALERT ====== */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold text-xs font-mono rounded-xl shadow-xs">
          Gagal memuat data screener. Pastikan koneksi backend aktif.
        </div>
      )}

      {/* ====== DATA GRID RESULTS ====== */}
      {!isLoading && data && (
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl shadow-xs overflow-hidden transition-colors duration-200">
          <div className="overflow-x-auto max-h-[640px] scrollbar-thin pb-2">
            <table className="w-full text-left whitespace-nowrap text-xs">
              <thead className="sticky top-0 bg-[var(--md-sys-color-surface-container-high)] z-10 shadow-xs">
                <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[10px] font-mono uppercase tracking-wider font-bold">
                  <th className="py-3 px-4">Emiten</th>
                  <th className="py-3 px-4 text-center">Conviction</th>
                  <th className="py-3 px-4 text-right">Foreign Flow (5D)</th>
                  <th className="py-3 px-4 text-right">Smart Net Flow</th>
                  <th className="py-3 px-4 text-center">Top Buyer</th>
                  <th className="py-3 px-4 text-right">Jarak ke Avg Bandar</th>
                  <th className="py-3 px-4 text-center">Tanggal Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/60">
                {results.map((row: any, idx: number) => {
                  const distanceVal = row.current_price && row.bandar_avg_price ? ((row.current_price - row.bandar_avg_price) / row.bandar_avg_price) * 100 : null;
                  const upperSignal = (row.signal || "").toUpperCase();
                  const isAcc = upperSignal.includes("ACCUMULATION") || upperSignal.includes("AKUMULASI") || upperSignal.includes("BUY");
                  const isDist = upperSignal.includes("DISTRIBUTION") || upperSignal.includes("DISTRIBUSI") || upperSignal.includes("SELL");

                  let sigTheme = "text-[var(--md-sys-color-on-surface-variant)]";
                  if (isAcc) sigTheme = "text-[var(--color-positive)]";
                  else if (isDist) sigTheme = "text-[var(--color-negative)]";

                  return (
                    <tr 
                      key={idx} 
                      onClick={() => router.push(`/${row.ticker}`)}
                      className="hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors cursor-pointer"
                      title={`Klik untuk menganalisis detail emiten ${row.ticker}`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-extrabold font-mono text-sm text-[var(--md-sys-color-on-surface)] flex items-center gap-1.5">
                          <span>{row.ticker}</span>
                          <Icon icon="ph:arrow-up-right-bold" width="11" className="opacity-40" />
                        </div>
                        <div className={`text-[10px] font-mono font-bold uppercase tracking-wider mt-0.5 ${sigTheme}`}>
                          {row.signal}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold font-mono">
                        <span className={`px-2.5 py-1 rounded-md border text-[10px] tabular-nums font-bold ${
                          row.conviction_score >= 70 
                            ? "bg-emerald-500/10 text-[var(--color-positive)] border-emerald-500/30" 
                            : row.conviction_score <= 30 
                            ? "bg-rose-500/10 text-[var(--color-negative)] border-rose-500/30" 
                            : "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)]"
                        }`}>
                          {row.conviction_score?.toFixed(1) || "-"}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold tabular-nums ${row.foreign_net > 0 ? "text-[var(--color-positive)]" : row.foreign_net < 0 ? "text-[var(--color-negative)]" : "text-[var(--md-sys-color-on-surface-variant)]"}`}>
                        {fmtRp(row.foreign_net)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold tabular-nums ${row.net_value > 0 ? "text-[var(--color-positive)]" : row.net_value < 0 ? "text-[var(--color-negative)]" : "text-[var(--md-sys-color-on-surface-variant)]"}`}>
                        {fmtRp(row.net_value)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-1 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)] font-mono text-[11px] font-bold rounded-md">
                          {row.top_buyer || "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                        {distanceVal !== null ? (
                          <span style={{ color: distanceVal <= 3 && distanceVal >= -5 ? "var(--color-positive)" : distanceVal > 3 ? "var(--md-sys-color-on-surface-variant)" : "var(--color-negative)"}}>
                            {distanceVal > 0 ? "+" : ""}{distanceVal.toFixed(2)}%
                          </span>
                        ) : <span className="text-[var(--md-sys-color-on-surface-variant)]">-</span>}
                      </td>
                      <td className="py-3 px-4 text-center text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-mono font-medium">
                        {row.data_date}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {results.length === 0 && (
              <div className="py-14 text-center text-[var(--md-sys-color-on-surface-variant)] text-xs font-mono font-medium">
                Tidak ada emiten yang memenuhi kriteria filter pada target universe ini. Coba sesuaikan filter likuiditas atau nonaktifkan filter akumulasi.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
