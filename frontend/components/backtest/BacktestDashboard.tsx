"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Icon } from "@iconify/react";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Gagal mengambil data backtest");
    return res.json();
  });

interface BacktestStats {
  total_signals: number;
  total_closed: number;
  total_open: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  avg_days_held: number;
  profit_factor: number;
  latest_audit_date: string | null;
}

interface BacktestSignalItem {
  id: string;
  ticker: string;
  signal_date: string;
  entry_price: number;
  tp_price: number;
  sl_price: number;
  exit_price: number | null;
  exit_date: string | null;
  status: "WIN" | "LOSS" | "OPEN" | string;
  days_held: number;
  pnl_pct: number | null;
  composite_score: number;
  sm_score: number;
  sec_score: number;
}

interface HistoryResponse {
  status_filter: string;
  count: number;
  data: BacktestSignalItem[];
}

export default function BacktestDashboard() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const { data: stats, isLoading: isStatsLoading, mutate: mutateStats } = useSWR<BacktestStats>(
    "/api/signal/backtest/stats",
    fetcher
  );

  const { data: historyData, isLoading: isHistoryLoading, isValidating: isHistoryValidating, mutate: mutateHistory } = useSWR<HistoryResponse>(
    `/api/signal/backtest/history?status=${statusFilter}&limit=200`,
    fetcher
  );

  const handleRefresh = () => {
    mutateStats();
    mutateHistory();
  };

  const filteredSignals = useMemo(() => {
    if (!historyData?.data) return [];
    const term = searchTerm.trim().toUpperCase();
    if (!term) return historyData.data;
    return historyData.data.filter((s) => s.ticker.includes(term));
  }, [historyData, searchTerm]);

  return (
    <div className="space-y-6">
      {/* ── 1. KPI SUMMARY CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Win Rate */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">
              Win Rate Ratio
            </span>
            <div className="w-8 h-8 rounded-lg bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center border border-[var(--md-sys-color-outline-variant)]">
              <Icon icon="ph:trophy-bold" width="16" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
              {isStatsLoading ? "..." : `${stats?.win_rate ?? 0}%`}
            </div>
            <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1 font-medium">
              {stats?.win_count ?? 0} WIN / {stats?.total_closed ?? 0} Selesai
            </p>
          </div>
        </div>

        {/* Card 2: Avg Win Return & Profit Factor */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">
              Avg Target Gain
            </span>
            <div className="w-8 h-8 rounded-lg bg-[var(--md-sys-color-surface-container-high)] text-[var(--color-positive)] flex items-center justify-center border border-[var(--md-sys-color-outline-variant)]">
              <Icon icon="ph:trend-up-bold" width="16" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[var(--color-positive)] tracking-tight">
              {isStatsLoading ? "..." : `+${stats?.avg_win_pct ?? 0}%`}
            </div>
            <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1 font-medium">
              Profit Factor: <strong className="text-[var(--md-sys-color-on-surface)]">{stats?.profit_factor ?? 0}x</strong>
            </p>
          </div>
        </div>

        {/* Card 3: Avg Risk & Hold Time */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">
              Avg Loss & Duration
            </span>
            <div className="w-8 h-8 rounded-lg bg-[var(--md-sys-color-surface-container-high)] text-[var(--color-negative)] flex items-center justify-center border border-[var(--md-sys-color-outline-variant)]">
              <Icon icon="ph:shield-warning-bold" width="16" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[var(--color-negative)] tracking-tight">
              {isStatsLoading ? "..." : `${stats?.avg_loss_pct ?? 0}%`}
            </div>
            <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1 font-medium">
              Rata-rata Hold: <strong className="text-[var(--md-sys-color-on-surface)]">{stats?.avg_days_held ?? 0} Hari</strong>
            </p>
          </div>
        </div>

        {/* Card 4: Dataset Pipeline */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">
              Dataset Pipeline
            </span>
            <div className="w-8 h-8 rounded-lg bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center border border-[var(--md-sys-color-outline-variant)]">
              <Icon icon="ph:database-bold" width="16" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[var(--md-sys-color-primary)] tracking-tight">
              {isStatsLoading ? "..." : `${stats?.total_signals ?? 0}`}
            </div>
            <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1 font-medium">
              {stats?.total_open ?? 0} Sinyal Sedang Aktif (OPEN)
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. FILTER & CONTROLS BAR ── */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            {[
              { key: "ALL", label: "Semua Selesai", count: stats?.total_closed },
              { key: "WIN", label: "Target (WIN)", count: stats?.win_count },
              { key: "LOSS", label: "Cut Loss (LOSS)", count: stats?.loss_count },
              { key: "OPEN", label: "Aktif (OPEN)", count: stats?.total_open },
            ].map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-[var(--md-sys-color-primary)]"
                      : "bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-on-surface)]"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[var(--md-sys-color-surface-container-highest)] font-mono">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search by Ticker & Refresh Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <Icon
                icon="ph:magnifying-glass-duotone"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)]"
                width="16"
              />
              <input
                type="text"
                placeholder="Filter Ticker..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs font-mono uppercase bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-lg text-[var(--md-sys-color-on-surface)] placeholder-[var(--md-sys-color-on-surface-variant)] focus:outline-none focus:ring-1 focus:ring-[var(--md-sys-color-primary)]"
              />
            </div>

            <button
              onClick={handleRefresh}
              disabled={isHistoryValidating}
              className="p-1.5 px-2.5 bg-[var(--md-sys-color-surface)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-lg text-xs font-bold text-[var(--md-sys-color-on-surface)] transition-all flex items-center gap-1.5 shrink-0"
              title="Refresh Matrix"
            >
              <Icon
                icon="ph:arrows-clockwise-bold"
                className={`text-[var(--md-sys-color-primary)] ${isHistoryValidating ? "animate-spin" : ""}`}
                width="14"
              />
              <span className="hidden sm:inline">Sync</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. AUDITED SIGNALS TABLE ── */}
      {isHistoryLoading ? (
        <div className="p-8 border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] rounded-2xl flex items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)] shadow-sm animate-pulse">
          <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="24" />
          <span className="text-sm font-bold tracking-wide">
            Mengambil data histori audit sinyal...
          </span>
        </div>
      ) : filteredSignals.length === 0 ? (
        <div className="p-10 text-center bg-[var(--md-sys-color-surface-container)] rounded-2xl border border-[var(--md-sys-color-outline-variant)]">
          <Icon icon="ph:folder-notch-open-duotone" className="mx-auto text-[var(--md-sys-color-on-surface-variant)] mb-2" width="40" />
          <p className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
            Tidak ada riwayat sinyal dengan filter status &quot;{statusFilter}&quot;
          </p>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
            Gunakan filter lain atau ubah kata kunci pencarian ticker.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] font-mono uppercase text-[10px] tracking-wider border-b border-[var(--md-sys-color-outline-variant)]">
                <tr>
                  <th className="py-3 px-4">Ticker</th>
                  <th className="py-3 px-4">Tgl Sinyal</th>
                  <th className="py-3 px-4 text-right">Entry</th>
                  <th className="py-3 px-4 text-right">Target (TP)</th>
                  <th className="py-3 px-4 text-right">Stop Loss</th>
                  <th className="py-3 px-4 text-right">Exit Price</th>
                  <th className="py-3 px-4 text-right">Realized Return</th>
                  <th className="py-3 px-4 text-center">Durasi</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)] font-mono">
                {filteredSignals.map((item) => {
                  const isWin = item.status === "WIN";
                  const isLoss = item.status === "LOSS";
                  const isOpen = item.status === "OPEN";

                  const pnlColor =
                    item.pnl_pct !== null && item.pnl_pct > 0
                      ? "text-[var(--color-positive)]"
                      : item.pnl_pct !== null && item.pnl_pct < 0
                      ? "text-[var(--color-negative)]"
                      : "text-[var(--md-sys-color-on-surface-variant)]";

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--md-sys-color-surface-container-high)]/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/${item.ticker}`}
                          className="font-extrabold text-sm text-[var(--md-sys-color-primary)] hover:underline inline-flex items-center gap-1"
                        >
                          {item.ticker}
                          <Icon icon="ph:arrow-up-right-bold" width="10" />
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-[var(--md-sys-color-on-surface-variant)] font-sans text-xs">
                        {item.signal_date}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--md-sys-color-on-surface)]">
                        {item.entry_price.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--color-positive)] font-bold">
                        {item.tp_price.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--color-negative)] font-bold">
                        {item.sl_price.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--md-sys-color-on-surface)]">
                        {item.exit_price ? item.exit_price.toLocaleString("id-ID") : "—"}
                      </td>
                      <td className={`py-3 px-4 text-right font-extrabold text-sm ${pnlColor}`}>
                        {item.pnl_pct !== null ? `${item.pnl_pct > 0 ? "+" : ""}${item.pnl_pct.toFixed(2)}%` : "—"}
                      </td>
                      <td className="py-3 px-4 text-center text-[var(--md-sys-color-on-surface-variant)]">
                        {item.days_held ? `${item.days_held} H` : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase border ${
                            isWin
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : isLoss
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
