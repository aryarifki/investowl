"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import { fmtRp, fmtPct, signedColor } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ConfluenceRow {
  ticker: string;
  company_name: string;
  group_name: string;
  current_price: number;
  signal: string;
  conviction_score: number;
  bandar_avg_price: number;
  bandar_price_distance_pct: number;
  foreign_5d: number;
  smart_foreign_net: number;
  gorengan_net: number;
  foreign_hmm_state: string;
  free_float_est: number;
  top_buyer: string;
  top_seller: string;
  quick_tags: string[];
}

export default function ConfluenceScreenerTab() {
  const [universe, setUniverse] = useState("lq45");
  const [windowDays, setWindowDays] = useState(20);
  const [selectedTag, setSelectedTag] = useState<string>("ALL");
  const [selectedSignal, setSelectedSignal] = useState<string>("ALL");
  const [minConviction, setMinConviction] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"conviction" | "distance" | "foreign" | "gorengan">("conviction");
  const [sortAsc, setSortAsc] = useState(false);

  const endpoint = `/api/signal/confluence-screener?universe_mode=${universe}&window_days=${windowDays}`;
  const { data, error, isLoading, isValidating } = useSWR(endpoint, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const rawRows: ConfluenceRow[] = data?.data || [];

  // Filter & Sort
  const processedRows = useMemo(() => {
    let result = rawRows.filter((row) => {
      const matchSearch =
        !search ||
        row.ticker.toUpperCase().includes(search.toUpperCase()) ||
        (row.company_name && row.company_name.toLowerCase().includes(search.toLowerCase())) ||
        (row.group_name && row.group_name.toLowerCase().includes(search.toLowerCase()));

      const matchTag = selectedTag === "ALL" || (row.quick_tags && row.quick_tags.includes(selectedTag));
      const matchSignal = selectedSignal === "ALL" || row.signal.toLowerCase().includes(selectedSignal.toLowerCase());
      const matchConviction = row.conviction_score >= minConviction;

      return matchSearch && matchTag && matchSignal && matchConviction;
    });

    result.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortBy === "conviction") {
        valA = a.conviction_score;
        valB = b.conviction_score;
      } else if (sortBy === "distance") {
        valA = a.bandar_price_distance_pct;
        valB = b.bandar_price_distance_pct;
      } else if (sortBy === "foreign") {
        valA = a.smart_foreign_net;
        valB = b.smart_foreign_net;
      } else if (sortBy === "gorengan") {
        valA = a.gorengan_net;
        valB = b.gorengan_net;
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }, [rawRows, search, selectedTag, selectedSignal, minConviction, sortBy, sortAsc]);

  const handleSort = (col: "conviction" | "distance" | "foreign" | "gorengan") => {
    if (sortBy === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(col);
      setSortAsc(false);
    }
  };

  const getSignalBadge = (sig: string) => {
    const s = (sig || "").toUpperCase();
    if (s.includes("BIG ACCUMULATION")) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (s.includes("ACCUMULATION") || s.includes("NET BUY")) return "bg-teal-500/15 text-teal-400 border-teal-500/30";
    if (s.includes("BIG DISTRIBUTION")) return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    if (s.includes("DISTRIBUTION") || s.includes("NET SELL")) return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    return "bg-neutral-500/15 text-neutral-400 border-neutral-500/30";
  };

  const getHmmBadge = (state: string) => {
    const s = (state || "").toLowerCase();
    if (s.includes("strong accum")) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (s.includes("accum")) return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
    if (s.includes("strong dist")) return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    if (s.includes("dist")) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-neutral-500/15 text-neutral-400 border-neutral-500/30";
  };

  const PRESET_TAGS = [
    { id: "ALL", label: "Semua Strategi", icon: "ph:squares-four-bold" },
    { id: "GOLDEN_CONFLUENCE", label: "Golden Confluence", icon: "ph:star-bold", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
    { id: "STEALTH_ACCUMULATION", label: "Stealth Accumulation", icon: "ph:shield-check-bold", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
    { id: "GORENGAN_MOMENTUM", label: "Gorengan Momentum", icon: "ph:fire-bold", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
    { id: "DISTRIBUTION_TRAP", label: "Distribution Trap", icon: "ph:warning-bold", color: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
    { id: "LOW_FLOAT", label: "Low Float (<25%)", icon: "ph:feather-bold", color: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
  ];

  return (
    <div className="space-y-5">
      {/* FILTER & CONTROL PANEL */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* TOP ROW: PRESET PILLS */}
        <div>
          <div className="text-[11px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Icon icon="ph:magic-wand-duotone" width="14" className="text-[var(--md-sys-color-primary)]" />
              Preset Strategi Kuantitatif
            </span>
            <span className="text-[10px] font-mono font-medium text-[var(--md-sys-color-on-surface-variant)]">
              {processedRows.length} dari {rawRows.length} Emiten
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_TAGS.map((t) => {
              const active = selectedTag === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTag(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    active
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] border-[var(--md-sys-color-primary)] shadow-2xs font-bold"
                      : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                  }`}
                >
                  <Icon icon={t.icon} width="14" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* BOTTOM ROW: PARAMETER CONTROLS */}
        <div className="pt-3 border-t border-[var(--md-sys-color-outline-variant)] flex flex-wrap items-center gap-3">
          {/* Universe Mode */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium">Universe:</span>
            <select
              value={universe}
              onChange={(e) => setUniverse(e.target.value)}
              className="py-1.5 px-2.5 text-xs rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)] focus:outline-none cursor-pointer font-semibold"
            >
              <option value="lq45">LQ45 (45 Liquid)</option>
              <option value="kompas100">KOMPAS100 (100 Top)</option>
              <option value="idx30">IDX30 (30 Bluechip)</option>
              <option value="watchlist">Watchlist Saya</option>
            </select>
          </div>

          {/* Lookback Window */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium">Window:</span>
            <div className="flex items-center gap-1 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] p-0.5 rounded-xl text-xs font-semibold">
              {[5, 10, 20, 30, 60].map((w) => (
                <button
                  key={w}
                  onClick={() => setWindowDays(w)}
                  className={`px-2 py-0.5 rounded-lg text-xs transition-all ${
                    windowDays === w
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs font-bold"
                      : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                  }`}
                >
                  {w}D
                </button>
              ))}
            </div>
          </div>

          {/* Bandar Signal Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium">Sinyal:</span>
            <select
              value={selectedSignal}
              onChange={(e) => setSelectedSignal(e.target.value)}
              className="py-1.5 px-2.5 text-xs rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)] focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Sinyal</option>
              <option value="accumulation">Akumulasi (Big / Normal)</option>
              <option value="big accumulation">Big Accumulation Saja</option>
              <option value="neutral">Netral</option>
              <option value="distribution">Distribusi</option>
            </select>
          </div>

          {/* Min Conviction Score Slider */}
          <div className="flex items-center gap-2 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] px-3 py-1 rounded-xl">
            <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium whitespace-nowrap">
              Min Conviction: <strong className="text-[var(--md-sys-color-primary)] font-mono">{minConviction}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={minConviction}
              onChange={(e) => setMinConviction(Number(e.target.value))}
              className="w-20 accent-[var(--md-sys-color-primary)] cursor-pointer"
            />
          </div>

          {/* Search Box */}
          <div className="relative ml-auto">
            <Icon icon="ph:magnifying-glass-duotone" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)]" width="14" />
            <input
              type="text"
              placeholder="Cari ticker / emiten..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] focus:outline-none focus:border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-surface)] w-40 sm:w-48"
            />
          </div>
        </div>
      </div>

      {/* DATA TABLE CARD */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
            Menampilkan <strong className="text-[var(--md-sys-color-on-surface)] font-bold">{processedRows.length}</strong> emiten dengan metrik bandarmology dan foreign confluence.
          </div>
          {isValidating && (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--md-sys-color-primary)]">
              <Icon icon="ph:spinner-bold" className="animate-spin" width="14" />
              <span>Memperbarui data...</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Ticker</th>
                <th className="py-2.5 px-3 text-right">Harga</th>
                <th className="py-2.5 px-3 text-right">Modal Bandar</th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-[var(--md-sys-color-primary)] transition-colors select-none"
                  onClick={() => handleSort("distance")}
                >
                  <span className="inline-flex items-center gap-1">
                    Jarak ke Modal
                    <Icon icon={sortBy === "distance" ? (sortAsc ? "ph:sort-ascending-bold" : "ph:sort-descending-bold") : "ph:arrows-down-up-bold"} width="12" />
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center">Sinyal Bandar</th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-[var(--md-sys-color-primary)] transition-colors select-none"
                  onClick={() => handleSort("conviction")}
                >
                  <span className="inline-flex items-center gap-1">
                    Conviction
                    <Icon icon={sortBy === "conviction" ? (sortAsc ? "ph:sort-ascending-bold" : "ph:sort-descending-bold") : "ph:arrows-down-up-bold"} width="12" />
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center">Top Brokers</th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-[var(--md-sys-color-primary)] transition-colors select-none"
                  onClick={() => handleSort("foreign")}
                >
                  <span className="inline-flex items-center gap-1" title="Net Flow Broker Asing Pintar (AK, BK, KZ, CS)">
                    Smart Foreign
                    <Icon icon={sortBy === "foreign" ? (sortAsc ? "ph:sort-ascending-bold" : "ph:sort-descending-bold") : "ph:arrows-down-up-bold"} width="12" />
                  </span>
                </th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-[var(--md-sys-color-primary)] transition-colors select-none"
                  onClick={() => handleSort("gorengan")}
                >
                  <span className="inline-flex items-center gap-1" title="Net Flow Broker Gorengan / Retail Cepat (MG, SQ, dll)">
                    Gorengan Flow
                    <Icon icon={sortBy === "gorengan" ? (sortAsc ? "ph:sort-ascending-bold" : "ph:sort-descending-bold") : "ph:arrows-down-up-bold"} width="12" />
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center">Foreign HMM</th>
                <th className="py-2.5 px-3 text-right">Free Float</th>
                <th className="py-2.5 px-3">Tags</th>
                <th className="py-2.5 px-3 text-center">Navigasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/60">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-[var(--md-sys-color-on-surface-variant)] animate-pulse">
                    Menghitung parameter konfluensi bandarmology & foreign flow...
                  </td>
                </tr>
              ) : processedRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-[var(--md-sys-color-on-surface-variant)]">
                    Tidak ada emiten yang memenuhi kriteria filter saat ini.
                  </td>
                </tr>
              ) : (
                processedRows.map((row) => {
                  const dist = row.bandar_price_distance_pct;
                  const isStealthDiscount = dist < 0;
                  const isSafeNearBandar = dist >= 0 && dist <= 5;
                  const isOverextended = dist > 10;

                  return (
                    <tr
                      key={row.ticker}
                      className="hover:bg-[var(--md-sys-color-surface-container-high)]/50 transition-colors group"
                    >
                      {/* Ticker & Name */}
                      <td className="py-2.5 px-3">
                        <Link
                          href={`/${row.ticker}`}
                          className="font-mono font-bold text-sm text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)] hover:underline block"
                        >
                          {row.ticker}
                        </Link>
                        <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] truncate max-w-[130px]">
                          {row.company_name}
                        </div>
                      </td>

                      {/* Current Price */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[var(--md-sys-color-on-surface)]">
                        {row.current_price ? `Rp ${row.current_price.toLocaleString("id-ID")}` : "-"}
                      </td>

                      {/* Bandar Avg Price */}
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-[var(--md-sys-color-on-surface-variant)]">
                        {row.bandar_avg_price ? `Rp ${row.bandar_avg_price.toLocaleString("id-ID")}` : "-"}
                      </td>

                      {/* Distance % to Bandar Avg */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] ${
                            isStealthDiscount
                              ? "bg-emerald-500/15 text-emerald-400"
                              : isSafeNearBandar
                              ? "bg-cyan-500/15 text-cyan-400"
                              : isOverextended
                              ? "bg-rose-500/15 text-rose-400"
                              : "text-[var(--md-sys-color-on-surface-variant)]"
                          }`}
                        >
                          {dist > 0 ? `+${dist}%` : `${dist}%`}
                        </span>
                      </td>

                      {/* Bandar Signal */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${getSignalBadge(row.signal)}`}>
                          {row.signal}
                        </span>
                      </td>

                      {/* Conviction Score */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded border text-xs ${
                            row.conviction_score >= 70
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : row.conviction_score >= 50
                              ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                              : row.conviction_score >= 40
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {row.conviction_score}
                        </span>
                      </td>

                      {/* Top Buyer / Top Seller */}
                      <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                        <span className="text-emerald-400 font-bold" title="Top Buyer">{row.top_buyer}</span>
                        <span className="text-[var(--md-sys-color-on-surface-variant)] mx-1">/</span>
                        <span className="text-rose-400 font-bold" title="Top Seller">{row.top_seller}</span>
                      </td>

                      {/* Smart Foreign Net */}
                      <td className="py-2.5 px-3 text-right font-mono text-[11px] font-semibold" style={{ color: signedColor(row.smart_foreign_net) }}>
                        {fmtRp(row.smart_foreign_net)}
                      </td>

                      {/* Gorengan Net */}
                      <td className="py-2.5 px-3 text-right font-mono text-[11px] font-semibold" style={{ color: signedColor(row.gorengan_net) }}>
                        {fmtRp(row.gorengan_net)}
                      </td>

                      {/* Foreign HMM State */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold ${getHmmBadge(row.foreign_hmm_state)}`}>
                          {row.foreign_hmm_state}
                        </span>
                      </td>

                      {/* Free Float % */}
                      <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                        <span className={row.free_float_est > 0 && row.free_float_est <= 25 ? "text-amber-400 font-bold" : "text-[var(--md-sys-color-on-surface-variant)]"}>
                          {row.free_float_est > 0 ? `${row.free_float_est}%` : "-"}
                        </span>
                      </td>

                      {/* Quick Strategy Tags */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {row.quick_tags && row.quick_tags.length > 0 ? (
                            row.quick_tags.map((tag) => {
                              const isGolden = tag === "GOLDEN_CONFLUENCE";
                              const isStealth = tag === "STEALTH_ACCUMULATION";
                              const isGorengan = tag === "GORENGAN_MOMENTUM";
                              const isTrap = tag === "DISTRIBUTION_TRAP";
                              return (
                                <span
                                  key={tag}
                                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-bold ${
                                    isGolden
                                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                      : isStealth
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                      : isGorengan
                                      ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                                      : isTrap
                                      ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                      : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                                  }`}
                                >
                                  {tag.replace("_", " ")}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] opacity-40">-</span>
                          )}
                        </div>
                      </td>

                      {/* Navigation Shortcut Links */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/${row.ticker}`}
                            title="Buka Detail Bandarmology"
                            className="p-1 rounded-md bg-[var(--md-sys-color-surface-container-highest)] hover:bg-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-on-primary)] transition-all text-[var(--md-sys-color-on-surface-variant)]"
                          >
                            <Icon icon="ph:chart-line-up-bold" width="13" />
                          </Link>
                          <Link
                            href={`/foreign?ticker=${row.ticker}`}
                            title="Buka Foreign Flow"
                            className="p-1 rounded-md bg-[var(--md-sys-color-surface-container-highest)] hover:bg-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-on-primary)] transition-all text-[var(--md-sys-color-on-surface-variant)]"
                          >
                            <Icon icon="ph:globe-stand-bold" width="13" />
                          </Link>
                        </div>
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
