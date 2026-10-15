"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import { fmtRp, fmtPct, signedColor } from "@/lib/format";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Gagal memuat data`);
  }
  return res.json();
};

interface ActiveSignal {
  id: string;
  ticker: string;
  company_name: string;
  group_name: string;
  signal_date: string;
  entry_price: number;
  tp_price: number;
  sl_price: number;
  target_gain_pct: number;
  stop_risk_pct: number;
  risk_reward_ratio: number;
  status: string;
  days_held: number;
  composite_score: number;
  wyckoff_phase: string;
  wyckoff_name?: string;
  smart_money_notes?: string;
  sector_notes?: string;
  persistence_5d?: number;
  turnover_idr?: number;
  ml_win_prob?: number;
  cmf: number | null;
  mfi: number | null;
  rsi: number | null;
  vcp_grade: string;
  gate_notes: string;
  features: Record<string, any>;
}

interface DailySignalRow {
  ticker: string;
  date: string;
  ml_label: string;
  ml_win_prob: number;
  composite_score: number;
  scores: {
    technical: number;
    smart_money: number;
    sector: number;
    fundamental: number;
  };
  features: {
    wyckoff_phase?: string;
    wyckoff_name?: string;
    smart_money_notes?: string;
    sector_notes?: string;
    persistence_5d?: number;
    turnover_idr?: number;
    rr_ratio?: number;
    wp?: string;
    cmf_v?: number;
    mfi_v?: number;
    rsi_v?: number;
    vcp_grade?: string;
    [key: string]: any;
  };
  wyckoff_phase?: string;
  wyckoff_name?: string;
  smart_money_notes?: string;
  sector_notes?: string;
  persistence_5d?: number;
  turnover_idr?: number;
  rr_ratio?: number;
  gate_notes: string;
}

export default function DailyAlgoSignalsTab() {
  const [search, setSearch] = useState("");
  const [selectedPhase, setSelectedPhase] = useState("ALL");
  const [selectedMlLabel, setSelectedMlLabel] = useState("ALL");
  const [minComposite, setMinComposite] = useState(0);

  // 1. Fetch Active Open Setups (TP, SL, R:R)
  const { data: activeData, isLoading: activeLoading, error: activeError } = useSWR(
    "/api/signal/active?limit=30",
    fetcher,
    { refreshInterval: 60000, dedupingInterval: 30000 }
  );

  // 2. Fetch Algorithmic Daily Scan from scanner.py
  const { data: dailyData, isLoading: dailyLoading, error: dailyError } = useSWR(
    "/api/signal/daily?limit=100",
    fetcher,
    { refreshInterval: 60000, dedupingInterval: 30000 }
  );

  const activeSignals: ActiveSignal[] = activeData?.data || [];
  const dailySignals: DailySignalRow[] = dailyData?.data || [];
  const latestDate = dailyData?.latest_date || "-";

  // Filter daily signals
  const filteredDaily = useMemo(() => {
    return dailySignals.filter((item) => {
      const matchSearch =
        !search ||
        (item.ticker && item.ticker.toUpperCase().includes(search.toUpperCase()));
      const phase = (item.wyckoff_phase || item.features?.wyckoff_phase || item.features?.wp || "-").toUpperCase();
      const matchPhase = selectedPhase === "ALL" || phase === selectedPhase;
      const matchLabel = selectedMlLabel === "ALL" || item.ml_label === selectedMlLabel;
      const matchComposite = (item.composite_score ?? 0) >= minComposite;
      return Boolean(matchSearch && matchPhase && matchLabel && matchComposite);
    });
  }, [dailySignals, search, selectedPhase, selectedMlLabel, minComposite]);

  const getWyckoffBadge = (phase: string) => {
    const p = (phase || "").toUpperCase();
    if (p === "E") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    if (p === "D") return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30";
    if (p === "C") return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    if (p === "B") return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    if (p === "A") return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    return "bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 70) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    if (score >= 50) return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    if (score >= 40) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: ACTIVE SETUPS (CARDS) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
              <Icon icon="ph:crosshair-bold" width="18" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
                Actionable Setups (Open Position)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                  {activeSignals.length} Setups
                </span>
              </h2>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                Kalkulasi target profit (TP), batasan risiko (SL), dan rasio risk-to-reward algoritma SMtracker.
              </p>
            </div>
          </div>
        </div>

        {activeLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-[var(--md-sys-color-surface-container)] animate-pulse border border-[var(--md-sys-color-outline-variant)]" />
            ))}
          </div>
        ) : activeSignals.length === 0 ? (
          <div className="p-8 text-center bg-[var(--md-sys-color-surface-container)] rounded-2xl border border-[var(--md-sys-color-outline-variant)] text-xs text-[var(--md-sys-color-on-surface-variant)]">
            Tidak ada setup open aktif saat ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {activeSignals.map((item) => {
              const phase = item.wyckoff_phase || "-";
              return (
                <div
                  key={item.id}
                  className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)]/50 rounded-2xl p-4 transition-all duration-200 shadow-2xs relative flex flex-col justify-between group"
                >
                  <div>
                    {/* Header Card */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/${item.ticker}`}
                            className="font-mono font-black text-lg text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)] transition-colors hover:underline"
                          >
                            {item.ticker}
                          </Link>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${getWyckoffBadge(phase)}`}
                            title={item.wyckoff_name || undefined}
                          >
                            Phase {phase}{item.wyckoff_name ? ` · ${item.wyckoff_name}` : ""}
                          </span>
                          {item.vcp_grade && item.vcp_grade !== "NONE" && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30 font-bold">
                              VCP {item.vcp_grade}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1 mt-0.5">
                          {item.company_name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {item.persistence_5d !== undefined && (
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold ${
                                item.persistence_5d >= 0.6
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                  : item.persistence_5d <= 0.4
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                                  : "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20"
                              }`}
                            >
                              {item.persistence_5d >= 0.6 ? "🟢" : item.persistence_5d <= 0.4 ? "🔴" : "⚪"}{" "}
                              {(item.persistence_5d * 100).toFixed(0)}% 5D Flow
                            </span>
                          )}
                          {item.sector_notes && (
                            <span
                              className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)] border border-[var(--md-sys-color-outline-variant)] truncate max-w-[140px]"
                              title={item.sector_notes}
                            >
                              {item.sector_notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-medium">Score</div>
                        <div className={`text-xs font-mono font-black px-2 py-0.5 rounded-md border ${getScoreBadge(item.composite_score)}`}>
                          {item.composite_score}
                        </div>
                        {item.ml_win_prob !== undefined && (
                          <div className="text-[9px] font-mono mt-0.5 text-[var(--md-sys-color-on-surface-variant)]">
                            {(() => {
                              const norm = item.ml_win_prob > 1.0 ? item.ml_win_prob / 100.0 : item.ml_win_prob;
                              return `${(norm * 100).toFixed(0)}% Win`;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Target & Risk Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-high)]/70 border border-[var(--md-sys-color-outline-variant)]/60 mb-3 text-center">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-[var(--md-sys-color-on-surface-variant)]">Entry</div>
                        <div className="font-mono font-bold text-xs text-[var(--md-sys-color-on-surface)]">
                          {item.entry_price ? `Rp ${item.entry_price.toLocaleString("id-ID")}` : "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-400">TP (+{item.target_gain_pct}%)</div>
                        <div className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                          {item.tp_price ? `Rp ${item.tp_price.toLocaleString("id-ID")}` : "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-rose-700 dark:text-rose-400">SL (-{item.stop_risk_pct}%)</div>
                        <div className="font-mono font-bold text-xs text-rose-700 dark:text-rose-400">
                          {item.sl_price ? `Rp ${item.sl_price.toLocaleString("id-ID")}` : "-"}
                        </div>
                      </div>
                    </div>

                    {/* Features snapshot info */}
                    <div className="flex items-center justify-between text-[11px] text-[var(--md-sys-color-on-surface-variant)] mb-1.5 font-mono">
                      <span>R:R: <strong className="text-[var(--md-sys-color-primary)] font-bold">{item.risk_reward_ratio}:1</strong></span>
                      {item.rsi !== null && <span>RSI: {Number(item.rsi).toFixed(1)}</span>}
                      {item.cmf !== null && <span>CMF: {Number(item.cmf).toFixed(2)}</span>}
                    </div>

                    {item.smart_money_notes && (
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400/90 font-mono mb-1.5 truncate" title={item.smart_money_notes}>
                        ⚡ <span className="opacity-80">SM:</span> {item.smart_money_notes}
                      </div>
                    )}

                    {item.gate_notes && (
                      <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface)]/60 px-2 py-1 rounded border border-[var(--md-sys-color-outline-variant)]/40 line-clamp-1">
                        <Icon icon="ph:info-duotone" className="inline mr-1 text-[var(--md-sys-color-primary)]" width="12" />
                        {item.gate_notes}
                      </div>
                    )}
                  </div>

                  {/* Action Link Footer */}
                  <div className="mt-3 pt-2.5 border-t border-[var(--md-sys-color-outline-variant)]/60 flex items-center justify-between">
                    <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-mono">
                      {item.signal_date}
                    </span>
                    <Link
                      href={`/${item.ticker}`}
                      className="text-xs font-semibold text-[var(--md-sys-color-primary)] hover:underline inline-flex items-center gap-1"
                    >
                      Buka Analitik
                      <Icon icon="ph:arrow-right-bold" width="12" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: DAILY ALGO RANKINGS TABLE */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--md-sys-color-outline-variant)]">
          <div>
            <h2 className="text-base font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
              <Icon icon="ph:ranking-duotone" className="text-[var(--md-sys-color-primary)]" width="20" />
              Daily Algorithmic Market Ranking
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]">
                Scan Date: {latestDate}
              </span>
            </h2>
            <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
              Output model kuantitatif multi-faktor (Technical, Smart Money, Sector, Wyckoff Phase) dari <code className="text-[var(--md-sys-color-primary)]">scanner.py</code>.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Icon icon="ph:magnifying-glass-duotone" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)]" width="14" />
              <input
                type="text"
                placeholder="Cari ticker..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] focus:outline-none focus:border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-surface)] w-36 sm:w-44"
              />
            </div>

            {/* Wyckoff Phase Selector */}
            <div className="flex items-center gap-1 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] p-1 rounded-xl text-xs font-semibold overflow-x-auto">
              <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] px-1.5 uppercase font-mono">Phase:</span>
              {["ALL", "A", "B", "C", "D", "E", "UNKNOWN"].map((phase) => (
                <button
                  key={phase}
                  onClick={() => setSelectedPhase(phase)}
                  className={`px-2 py-0.5 rounded-lg text-xs transition-all whitespace-nowrap ${
                    selectedPhase === phase
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs font-bold"
                      : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                  }`}
                >
                  {phase}
                </button>
              ))}
            </div>

            {/* Label Filter */}
            <select
              value={selectedMlLabel}
              onChange={(e) => setSelectedMlLabel(e.target.value)}
              className="py-1.5 px-2.5 text-xs rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)] focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Label</option>
              <option value="WIN">ML Label: WIN</option>
              <option value="HOLD">ML Label: HOLD</option>
              <option value="LOSS">ML Label: LOSS</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Ticker</th>
                <th className="py-2.5 px-3 text-center">Wyckoff</th>
                <th className="py-2.5 px-3 text-right">Composite</th>
                <th className="py-2.5 px-3 text-right">ML Win Prob</th>
                <th className="py-2.5 px-3 text-right">Smart Money</th>
                <th className="py-2.5 px-3 text-right">Technical</th>
                <th className="py-2.5 px-3 text-right">Sector</th>
                <th className="py-2.5 px-3 text-center">VCP</th>
                <th className="py-2.5 px-3">Gate Note / Analysis</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/60">
              {dailyLoading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-[var(--md-sys-color-on-surface-variant)] animate-pulse">
                    Memuat data sinyal harian algoritma...
                  </td>
                </tr>
              ) : dailyError ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-rose-700 dark:text-rose-400">
                    Gagal memuat data sinyal: {dailyError.message || "Koneksi backend terputus"}. Silakan coba lagi.
                  </td>
                </tr>
              ) : filteredDaily.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                    Tidak ada sinyal yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredDaily.map((row, idx) => {
                  const phase = (row.wyckoff_phase || row.features?.wyckoff_phase || row.features?.wp || "-").toUpperCase();
                  const wyckoffName = row.wyckoff_name || row.features?.wyckoff_name || "";
                  const vcp = row.features?.vcp_grade || "NONE";
                  const p5d = row.persistence_5d ?? row.features?.persistence_5d;
                  const secNotes = row.sector_notes || row.features?.sector_notes;

                  return (
                    <tr
                      key={row.ticker}
                      className="hover:bg-[var(--md-sys-color-surface-container-high)]/50 transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-mono text-[var(--md-sys-color-on-surface-variant)]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)]">
                        <Link href={`/${row.ticker}`} className="hover:underline">
                          {row.ticker}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold inline-block ${getWyckoffBadge(phase)}`}
                          title={wyckoffName || undefined}
                        >
                          Phase {phase}
                          {wyckoffName && (
                            <span className="block text-[8px] opacity-85 font-normal tracking-tight">{wyckoffName}</span>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded border ${getScoreBadge(row.composite_score)}`}>
                          {row.composite_score}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">
                        {(() => {
                          const raw = row.ml_win_prob;
                          if (raw === null || raw === undefined) {
                            return <span className="text-[var(--md-sys-color-on-surface-variant)] opacity-50">-</span>;
                          }
                          const norm = raw > 1.0 ? raw / 100.0 : raw;
                          const color = norm >= 0.55 ? "text-emerald-700 dark:text-emerald-400" : norm >= 0.45 ? "text-amber-700 dark:text-amber-400" : "text-[var(--md-sys-color-on-surface-variant)]";
                          return (
                            <span className={color}>
                              {(norm * 100).toFixed(1)}%
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--md-sys-color-on-surface)]">
                        <div className="font-bold">{row.scores.smart_money}</div>
                        {p5d !== undefined && p5d !== null && (
                          <div className={`text-[9px] ${p5d >= 0.6 ? "text-emerald-700 dark:text-emerald-400" : p5d <= 0.4 ? "text-rose-700 dark:text-rose-400" : "text-neutral-600 dark:text-neutral-400"}`}>
                            {(p5d * 100).toFixed(0)}% flow
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--md-sys-color-on-surface)]">
                        {row.scores.technical}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--md-sys-color-on-surface)]">
                        <div className="font-bold">{row.scores.sector}</div>
                        {secNotes && (
                          <div className="text-[8px] text-[var(--md-sys-color-on-surface-variant)] truncate max-w-[85px] ml-auto" title={secNotes}>
                            {secNotes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {vcp !== "NONE" ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30 text-[10px] font-bold">
                            {vcp}
                          </span>
                        ) : (
                          <span className="text-[var(--md-sys-color-on-surface-variant)] opacity-40">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-[var(--md-sys-color-on-surface-variant)] max-w-xs truncate" title={row.gate_notes}>
                        {row.gate_notes || "Clear"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Link
                          href={`/${row.ticker}`}
                          className="px-2.5 py-1 rounded-lg bg-[var(--md-sys-color-surface-container-highest)] hover:bg-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-on-primary)] transition-all font-semibold text-[11px] inline-flex items-center gap-1"
                        >
                          Detail
                          <Icon icon="ph:arrow-square-out-bold" width="12" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
