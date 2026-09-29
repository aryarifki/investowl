"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import { fmtRp } from "@/lib/format";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Gagal mengambil data rotasi sektor");
    return res.json();
  });

interface BenchmarkInfo {
  code: string;
  name: string;
  close: number;
  ret_1d: number;
  value: number;
}

interface SectorItem {
  code: string;
  name: string;
  icon: string;
  color: string;
  close: number;
  ret_1d: number;
  ret_5d: number;
  ret_20d: number;
  value: number;
  value_share_pct: number;
  rs_ratio: number;
  rs_momentum: number;
  quadrant: "Leading" | "Weakening" | "Lagging" | "Improving";
  top_stocks: string[];
}

interface SectorSummaryResponse {
  date: string;
  benchmark: BenchmarkInfo;
  total_sector_value: number;
  sectors: SectorItem[];
}

interface SectorHistoryPoint {
  date: string;
  close: number;
  value: number;
  rs_ratio: number;
}

interface SectorHistoryResponse {
  sector: string;
  name: string;
  count: number;
  data: SectorHistoryPoint[];
}

export default function SectorRotationDashboard() {
  const [timeframe, setTimeframe] = useState<"1d" | "5d" | "20d">("1d");
  const [selectedQuadrant, setSelectedQuadrant] = useState<string>("all");
  const [selectedSector, setSelectedSector] = useState<string | null>("IDXENERGY");

  const { data, isLoading, error } = useSWR<SectorSummaryResponse>(
    "/api/foreign-flow/sectors/summary",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const { data: historyData, isLoading: isHistoryLoading } = useSWR<SectorHistoryResponse>(
    selectedSector ? `/api/foreign-flow/sectors/history?sector=${selectedSector}&days=25` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const filteredSectors = useMemo(() => {
    if (!data?.sectors) return [];
    let list = [...data.sectors];

    if (selectedQuadrant !== "all") {
      list = list.filter((s) => s.quadrant.toLowerCase() === selectedQuadrant.toLowerCase());
    }

    list.sort((a, b) => {
      if (timeframe === "5d") return b.ret_5d - a.ret_5d;
      if (timeframe === "20d") return b.ret_20d - a.ret_20d;
      return b.ret_1d - a.ret_1d;
    });

    return list;
  }, [data?.sectors, selectedQuadrant, timeframe]);

  // Quadrant counts
  const quadrantCounts = useMemo(() => {
    if (!data?.sectors) return { Leading: 0, Improving: 0, Weakening: 0, Lagging: 0 };
    return data.sectors.reduce(
      (acc, s) => {
        acc[s.quadrant] = (acc[s.quadrant] || 0) + 1;
        return acc;
      },
      { Leading: 0, Improving: 0, Weakening: 0, Lagging: 0 } as Record<string, number>
    );
  }, [data?.sectors]);

  const activeSectorDetail = useMemo(() => {
    if (!selectedSector || !data?.sectors) return null;
    return data.sectors.find((s) => s.code === selectedSector) || null;
  }, [selectedSector, data?.sectors]);

  if (isLoading) {
    return (
      <div className="py-24 text-center bg-[var(--md-sys-color-surface-container)] rounded-2xl border border-[var(--md-sys-color-outline-variant)] shadow-xs flex flex-col items-center justify-center gap-3">
        <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="28" />
        <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">
          Menganalisis rotasi sektor &amp; arus transaksi...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center bg-[var(--md-sys-color-surface-container-low)] rounded-2xl border border-[var(--md-sys-color-outline-variant)] space-y-2">
        <Icon icon="ph:warning-circle-duotone" width="36" className="mx-auto text-amber-500" />
        <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">Gagal Memuat Data Rotasi Sektor</h3>
        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
          Pastikan data `idx_index_summary` telah diperbarui oleh pipeline.
        </p>
      </div>
    );
  }

  const { benchmark, total_sector_value, date } = data;

  return (
    <div className="space-y-5">
      {/* MARKET MACRO & ROTATION OVERVIEW CARD */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-[var(--md-sys-color-outline-variant)]/60 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)] shadow-2xs">
              <Icon icon="ph:chart-polar-duotone" width="24" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                  Peta Rotasi Sektor &amp; Money Flow
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border border-[var(--md-sys-color-outline-variant)]">
                  {date}
                </span>
              </div>
              <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                Relative Strength (RRG) 11 sektor IDX terhadap benchmark IHSG &amp; perputaran arus transaksi
              </p>
            </div>
          </div>

          {/* Benchmark Mini Badge */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] self-start sm:self-auto">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase">
                IHSG (COMPOSITE)
              </span>
              <span className="text-sm font-extrabold text-[var(--md-sys-color-on-surface)]">
                {benchmark.close.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <span
              className={`text-xs font-bold px-2 py-1 rounded-lg ${
                benchmark.ret_1d >= 0
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
              }`}
            >
              {benchmark.ret_1d > 0 ? `+${benchmark.ret_1d}%` : `${benchmark.ret_1d}%`}
            </span>
          </div>
        </div>

        {/* 4 QUADRANTS RRG SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* LEADING */}
          <button
            onClick={() => setSelectedQuadrant(selectedQuadrant === "leading" ? "all" : "leading")}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedQuadrant === "leading"
                ? "bg-emerald-500/15 border-emerald-500 shadow-xs"
                : "bg-[var(--md-sys-color-surface-container-low)] border-[var(--md-sys-color-outline-variant)] hover:border-emerald-500/50"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Leading
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                {quadrantCounts["Leading"] || 0} Sektor
              </span>
            </div>
            <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1">
              Outperforming &amp; Momentum Kuat
            </p>
          </button>

          {/* IMPROVING */}
          <button
            onClick={() => setSelectedQuadrant(selectedQuadrant === "improving" ? "all" : "improving")}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedQuadrant === "improving"
                ? "bg-sky-500/15 border-sky-500 shadow-xs"
                : "bg-[var(--md-sys-color-surface-container-low)] border-[var(--md-sys-color-outline-variant)] hover:border-sky-500/50"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                Improving
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-600 dark:text-sky-400">
                {quadrantCounts["Improving"] || 0} Sektor
              </span>
            </div>
            <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1">
              Momentum Bangkit Menuju Outperform
            </p>
          </button>

          {/* WEAKENING */}
          <button
            onClick={() => setSelectedQuadrant(selectedQuadrant === "weakening" ? "all" : "weakening")}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedQuadrant === "weakening"
                ? "bg-amber-500/15 border-amber-500 shadow-xs"
                : "bg-[var(--md-sys-color-surface-container-low)] border-[var(--md-sys-color-outline-variant)] hover:border-amber-500/50"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Weakening
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                {quadrantCounts["Weakening"] || 0} Sektor
              </span>
            </div>
            <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1">
              Diatas IHSG tapi Momentum Melambat
            </p>
          </button>

          {/* LAGGING */}
          <button
            onClick={() => setSelectedQuadrant(selectedQuadrant === "lagging" ? "all" : "lagging")}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedQuadrant === "lagging"
                ? "bg-rose-500/15 border-rose-500 shadow-xs"
                : "bg-[var(--md-sys-color-surface-container-low)] border-[var(--md-sys-color-outline-variant)] hover:border-rose-500/50"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Lagging
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-600 dark:text-rose-400">
                {quadrantCounts["Lagging"] || 0} Sektor
              </span>
            </div>
            <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1">
              Underperforming &amp; Aliran Lemah
            </p>
          </button>
        </div>
      </div>

      {/* FILTER & TIMEFRAME BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Quadrant Quick Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-medium">
          <button
            onClick={() => setSelectedQuadrant("all")}
            className={`px-3 py-1.5 rounded-full shrink-0 transition-all ${
              selectedQuadrant === "all"
                ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
            }`}
          >
            Semua Sektor (11)
          </button>
          {["Leading", "Improving", "Weakening", "Lagging"].map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQuadrant(q.toLowerCase())}
              className={`px-3 py-1.5 rounded-full shrink-0 transition-all ${
                selectedQuadrant === q.toLowerCase()
                  ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                  : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
              }`}
            >
              {q} ({quadrantCounts[q] || 0})
            </button>
          ))}
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center p-1 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] self-start sm:self-auto text-xs font-semibold">
          <button
            onClick={() => setTimeframe("1d")}
            className={`px-3 py-1 rounded-lg transition-all ${
              timeframe === "1d"
                ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs"
                : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
            }`}
          >
            1 Hari
          </button>
          <button
            onClick={() => setTimeframe("5d")}
            className={`px-3 py-1 rounded-lg transition-all ${
              timeframe === "5d"
                ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs"
                : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
            }`}
          >
            5 Hari
          </button>
          <button
            onClick={() => setTimeframe("20d")}
            className={`px-3 py-1 rounded-lg transition-all ${
              timeframe === "20d"
                ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs"
                : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
            }`}
          >
            20 Hari
          </button>
        </div>
      </div>

      {/* SECTOR CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredSectors.map((sector) => {
          const isSelected = selectedSector === sector.code;
          const ret =
            timeframe === "5d" ? sector.ret_5d : timeframe === "20d" ? sector.ret_20d : sector.ret_1d;
          const isUp = ret > 0;
          const isDown = ret < 0;

          const quadrantBadgeColor =
            sector.quadrant === "Leading"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              : sector.quadrant === "Improving"
              ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
              : sector.quadrant === "Weakening"
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
              : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";

          return (
            <div
              key={sector.code}
              onClick={() => setSelectedSector(sector.code)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "bg-[var(--md-sys-color-surface-container-high)] border-[var(--md-sys-color-primary)] shadow-xs ring-1 ring-[var(--md-sys-color-primary)]/40"
                  : "bg-[var(--md-sys-color-surface-container)] border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)]/40"
              }`}
            >
              <div>
                {/* Sector Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)]">
                      <Icon icon={sector.icon} width="18" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-[var(--md-sys-color-on-surface)] truncate max-w-[170px]" title={sector.name}>
                        {sector.name}
                      </h3>
                      <span className="text-[10px] font-mono text-[var(--md-sys-color-on-surface-variant)]">
                        {sector.code}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${quadrantBadgeColor}`}>
                    {sector.quadrant}
                  </span>
                </div>

                {/* Price & Return Display */}
                <div className="flex items-baseline justify-between mt-3 pt-2.5 border-t border-[var(--md-sys-color-outline-variant)]/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
                      Indeks Terakhir
                    </span>
                    <span className="text-sm font-bold text-[var(--md-sys-color-on-surface)] font-mono">
                      {sector.close.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
                      Return ({timeframe.toUpperCase()})
                    </span>
                    <span
                      className={`text-sm font-extrabold ${
                        isUp
                          ? "text-emerald-500 dark:text-emerald-400"
                          : isDown
                          ? "text-rose-500 dark:text-rose-400"
                          : "text-[var(--md-sys-color-on-surface-variant)]"
                      }`}
                    >
                      {ret > 0 ? `+${ret}%` : `${ret}%`}
                    </span>
                  </div>
                </div>

                {/* Turnover Share Progress Bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
                    <span>Arus Transaksi: {fmtRp(sector.value)}</span>
                    <span className="font-semibold text-[var(--md-sys-color-on-surface)]">{sector.value_share_pct}% market</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(sector.value_share_pct * 3.5, 100)}%` }}
                      className="h-full bg-[var(--md-sys-color-primary)] rounded-full transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Top Constituent Stocks Chips */}
              <div className="mt-3.5 pt-2.5 border-t border-[var(--md-sys-color-outline-variant)]/50">
                <div className="flex items-center justify-between text-[10px] text-[var(--md-sys-color-on-surface-variant)] mb-1.5">
                  <span className="font-semibold">Top Penggerak Sektor:</span>
                  <span className="text-[9px]">Klik emiten</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {sector.top_stocks.map((ticker) => (
                    <Link
                      key={ticker}
                      href={`/${ticker}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-on-primary)] border border-[var(--md-sys-color-outline-variant)] transition-all"
                    >
                      {ticker}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SELECTED SECTOR HISTORICAL TREND DRAWER / DETAIL */}
      {selectedSector && activeSectorDetail && (
        <div className="rounded-[20px] bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-primary)]/40 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--md-sys-color-outline-variant)]/60 gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)]">
                <Icon icon={activeSectorDetail.icon} width="22" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
                  <span>{activeSectorDetail.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
                    {activeSectorDetail.code}
                  </span>
                </h3>
                <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                  Histori Relative Strength vs IHSG, tren perputaran dana, dan emiten kunci
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
                Fase RRG: {activeSectorDetail.quadrant}
              </span>
              <button
                onClick={() => setSelectedSector(null)}
                className="text-xs text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] p-1 rounded-lg hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors"
                title="Tutup Detail"
              >
                <Icon icon="ph:x-bold" width="14" />
              </button>
            </div>
          </div>

          {/* Quick Metrics of Active Sector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]">
              <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] block">RS Ratio vs IHSG</span>
              <span className="text-sm sm:text-base font-bold text-[var(--md-sys-color-on-surface)]">
                {activeSectorDetail.rs_ratio}
              </span>
              <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] block mt-0.5">
                {activeSectorDetail.rs_ratio >= 100 ? "Outperforming (>100)" : "Underperforming (<100)"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]">
              <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] block">RS Momentum</span>
              <span className="text-sm sm:text-base font-bold text-[var(--md-sys-color-on-surface)]">
                {activeSectorDetail.rs_momentum}
              </span>
              <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] block mt-0.5">
                {activeSectorDetail.rs_momentum >= 100 ? "Akselerasi Positif" : "Perlambatan Momentum"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]">
              <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] block">Turnover Harian</span>
              <span className="text-sm sm:text-base font-bold text-[var(--md-sys-color-primary)]">
                {fmtRp(activeSectorDetail.value)}
              </span>
              <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] block mt-0.5">
                Porsi {activeSectorDetail.value_share_pct}% total IHSG
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]">
              <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] block">Return 20 Hari</span>
              <span
                className={`text-sm sm:text-base font-bold ${
                  activeSectorDetail.ret_20d >= 0
                    ? "text-emerald-500 dark:text-emerald-400"
                    : "text-rose-500 dark:text-rose-400"
                }`}
              >
                {activeSectorDetail.ret_20d > 0 ? `+${activeSectorDetail.ret_20d}%` : `${activeSectorDetail.ret_20d}%`}
              </span>
              <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] block mt-0.5">
                1D: {activeSectorDetail.ret_1d}% | 5D: {activeSectorDetail.ret_5d}%
              </span>
            </div>
          </div>

          {/* Historical Table / Points */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface)] flex items-center gap-1.5">
              <Icon icon="ph:clock-counter-clockwise-duotone" width="14" className="text-[var(--md-sys-color-primary)]" />
              Histori Harian Relative Strength ({activeSectorDetail.code} vs COMPOSITE)
            </span>

            {isHistoryLoading ? (
              <div className="py-8 text-center text-xs text-[var(--md-sys-color-on-surface-variant)] flex items-center justify-center gap-2">
                <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="16" />
                <span>Memuat deret waktu sektor...</span>
              </div>
            ) : historyData && historyData.data.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] font-semibold text-[11px]">
                      <th className="py-2 px-3">Tanggal</th>
                      <th className="py-2 px-3 text-right">Close Indeks</th>
                      <th className="py-2 px-3 text-right">Turnover</th>
                      <th className="py-2 px-3 text-right">RS Ratio vs IHSG</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/50">
                    {[...historyData.data].reverse().slice(0, 10).map((pt) => {
                      const isStrong = pt.rs_ratio >= 100;
                      return (
                        <tr key={pt.date} className="hover:bg-[var(--md-sys-color-surface-container)] transition-colors">
                          <td className="py-2 px-3 font-medium text-[var(--md-sys-color-on-surface)] font-mono text-[11px]">
                            {pt.date}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-[var(--md-sys-color-on-surface)]">
                            {pt.close.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--md-sys-color-on-surface-variant)]">
                            {fmtRp(pt.value)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-[var(--md-sys-color-on-surface)]">
                            {pt.rs_ratio}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                isStrong
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {isStrong ? "OUTPERFORM" : "UNDERPERFORM"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
