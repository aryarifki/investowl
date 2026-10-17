"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { fmtRp, fmtRadarFlow, signedColor } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Gagal mengambil data radar");
  return res.json();
});

interface TimelinePoint {
  date: string;
  ihsg_close: number;
  daily_flow: number;
  cumulative_flow: number;
  market_state?: "NORMAL" | "WARNING" | "CRASH" | "BOTTOMING";
}

interface CulpritBroker {
  broker_code: string;
  broker_name: string;
  net_sell_idr: number;
}

interface RadarData {
  market_state: "NORMAL" | "WARNING" | "CRASH" | "BOTTOMING";
  ihsg_current: number;
  ihsg_change_pct: number;
  timeline: TimelinePoint[];
  culprit_brokers: CulpritBroker[];
}

export default function ForeignExodusRadar() {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const { data, error, isLoading } = useSWR<RadarData>(
    "/api/forensic/foreign-exodus",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  // Status Badge Configuration
  const stateConfig = useMemo(() => {
    const s = data?.market_state || "NORMAL";
    switch (s) {
      case "CRASH":
        return {
          label: "CRASH",
          sublabel: "Forced Liquidation Detected",
          icon: "ph:warning-octagon-fill",
          badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
          dotClass: "bg-rose-500",
          glowClass: "shadow-[0_0_12px_rgba(244,63,94,0.35)]",
          chartGradient: "#f43f5e",
        };
      case "WARNING":
        return {
          label: "WARNING",
          sublabel: "Hidden Foreign Distribution",
          icon: "ph:warning-circle-fill",
          badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
          dotClass: "bg-amber-500",
          glowClass: "shadow-[0_0_12px_rgba(245,158,11,0.35)]",
          chartGradient: "#f59e0b",
        };
      case "BOTTOMING":
        return {
          label: "BOTTOMING",
          sublabel: "Capitulation Buyback",
          icon: "ph:arrow-circle-up-fill",
          badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
          dotClass: "bg-sky-500",
          glowClass: "shadow-[0_0_12px_rgba(14,165,233,0.35)]",
          chartGradient: "#0ea5e9",
        };
      case "NORMAL":
      default:
        return {
          label: "NORMAL",
          sublabel: "Stable Foreign Flow",
          icon: "ph:shield-check-fill",
          badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          dotClass: "bg-emerald-500",
          glowClass: "shadow-[0_0_12px_rgba(16,185,129,0.35)]",
          chartGradient: "#10b981",
        };
    }
  }, [data?.market_state]);

  const timeline = data?.timeline || [];
  const culpritBrokers = data?.culprit_brokers || [];
  const isNetOutflow = useMemo(() => {
    if (!timeline.length) return true;
    return timeline[timeline.length - 1].cumulative_flow < 0;
  }, [timeline]);

  // Dynamic gradient offset: ensures negative cumulative flows fill RED and positive flows fill GREEN
  const gradientOffset = useMemo(() => {
    if (!timeline.length) return 0;
    const flows = timeline.map((d) => d.cumulative_flow);
    const max = Math.max(...flows);
    const min = Math.min(...flows);
    if (max <= 0) return 0;
    if (min >= 0) return 1;
    return max / (max - min);
  }, [timeline]);

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <section className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/70 rounded-3xl p-5 sm:p-6 shadow-xs transition-all relative overflow-hidden">
      
      {/* ====== ALWAYS VISIBLE: MAIN CARD HEADER ====== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* LEFT SECTION: IHSG REAL-TIME/CLOSING PRICE */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)] shadow-2xs">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" className="animate-spin-slow text-[var(--md-sys-color-primary)]">
              <g fill="currentColor">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" opacity=".35" />
                <path d="M11.1256 6.82338C11.846 6.70116 12.6041 6.72817 13.3586 6.93033C16.1585 7.68056 17.8201 10.5585 17.0699 13.3584C16.3196 16.1583 13.4417 17.8199 10.6418 17.0697C7.84187 16.3194 6.18028 13.4415 6.93051 10.6416C7.05879 10.1629 7.24878 9.7184 7.48934 9.31389L11.5283 12.583C11.8503 12.8436 12.3226 12.7938 12.5832 12.4718C12.8438 12.1499 12.794 11.6776 12.472 11.417L8.27423 8.01941C7.7127 7.56491 6.80868 7.60723 6.3558 8.29795C5.97114 8.8846 5.67251 9.54098 5.48162 10.2534C4.51698 13.8535 6.65344 17.5539 10.2535 18.5186C13.8536 19.4832 17.5541 17.3467 18.5187 13.7466C19.4834 10.1465 17.3469 6.44608 13.7468 5.48144C12.7798 5.22232 11.8035 5.18693 10.8747 5.34452C10.4664 5.41381 10.1915 5.80103 10.2608 6.20941C10.33 6.61779 10.7173 6.89267 11.1256 6.82338Z" />
              </g>
            </svg>
          </div>
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-mono font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider mb-0.5">
              <span>FOREIGN EXODUS RADAR</span>
              <span className="opacity-40">•</span>
              <span>IHSG COMPOSITE</span>
            </div>
            
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-[var(--md-sys-color-on-surface)] tracking-tight">
                {isLoading ? (
                  <span className="inline-block w-28 h-7 bg-[var(--md-sys-color-surface-container-highest)] animate-pulse rounded-md" />
                ) : (
                  (data?.ihsg_current || 0).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                )}
              </h2>

              {!isLoading && data && (
                <span
                  className={`inline-flex items-center gap-0.5 text-xs sm:text-sm font-mono font-bold ${
                    data.ihsg_change_pct >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"
                  }`}
                >
                  <Icon
                    icon={data.ihsg_change_pct >= 0 ? "ph:trend-up-bold" : "ph:trend-down-bold"}
                    width="15"
                  />
                  <span>{data.ihsg_change_pct > 0 ? "+" : ""}{data.ihsg_change_pct.toFixed(2)}%</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CENTER SECTION: DETAIL RADAR NAVIGATION (DITEMPATKAN DITENGAH TANPA ELEMEN PEMBUNGKUS) */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center justify-center gap-2 text-xs font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] transition-all cursor-pointer select-none py-1.5 px-3.5 rounded-full hover:bg-[var(--md-sys-color-surface-container-high)]/60 self-center group active:scale-95"
          aria-expanded={isExpanded}
          title={isExpanded ? "Tutup detail radar" : "Buka grafik dan detail arus asing"}
        >
          <span>{isExpanded ? "Tutup Detail Radar" : "Detail Radar"}</span>
          <Icon
            icon={isExpanded ? "ph:caret-up-bold" : "ph:caret-down-bold"}
            width="15"
            className="transition-transform duration-200 text-[var(--md-sys-color-primary)] group-hover:translate-y-0.5"
          />
        </button>

        {/* RIGHT SECTION: STATUS BADGE (STATE MACHINE) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-start md:self-center shrink-0">
          {isLoading ? (
            <div className="w-36 h-9 bg-[var(--md-sys-color-surface-container-highest)] animate-pulse rounded-xl" />
          ) : (
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-extrabold tracking-wider transition-all ${stateConfig.badgeClass} ${stateConfig.glowClass}`}
            >
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stateConfig.dotClass}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${stateConfig.dotClass}`}></span>
              </span>
              <Icon icon={stateConfig.icon} width="16" />
              <span>STATUS: {stateConfig.label}</span>
            </div>
          )}

          {!isLoading && (
            <span className="text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] hidden lg:inline">
              {stateConfig.sublabel}
            </span>
          )}
        </div>
      </div>

      {/* ====== COLLAPSIBLE DETAIL SECTION ====== */}
      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-[var(--md-sys-color-outline-variant)]/60 space-y-6 animate-fade-in">
          
          {/* HEADER EXPLANATION */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
            <div className="flex items-center gap-2">
              <Icon icon="ph:chart-line-up-duotone" width="16" className="text-[var(--md-sys-color-primary)]" />
              <span className="font-bold text-[var(--md-sys-color-on-surface)]">
                Dinamika Kapital Asing vs IHSG (45 Hari Terakhir)
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]"></span>
                <span>IHSG Close (Kiri)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isNetOutflow ? "bg-rose-500" : "bg-emerald-500"}`}></span>
                <span>Kumulatif Flow (Kanan)</span>
              </span>
            </div>
          </div>

          {/* DUAL-AXIS LINE / AREA CHART */}
          <div className="h-[280px] sm:h-[320px] w-full bg-[var(--md-sys-color-surface-container-low)] rounded-2xl p-3 border border-[var(--md-sys-color-outline-variant)]/50">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-[var(--md-sys-color-on-surface-variant)] animate-pulse">
                Memuat data radar historis...
              </div>
            ) : timeline.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-[var(--md-sys-color-on-surface-variant)]">
                Data historis tidak tersedia.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeline} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset={gradientOffset} stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset={gradientOffset} stopColor="#f43f5e" stopOpacity={0.35} />
                      <stop offset="100%" stopColor={isNetOutflow ? "#f43f5e" : "#10b981"} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" opacity={0.35} />
                  
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShortDate}
                    stroke="var(--md-sys-color-on-surface-variant)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: "var(--md-sys-color-outline-variant)", opacity: 0.5 }}
                  />
                  
                  {/* Left Y-Axis: IHSG Close Price */}
                  <YAxis
                    yAxisId="left"
                    domain={["auto", "auto"]}
                    stroke="var(--md-sys-color-on-surface-variant)"
                    fontSize={10}
                    tickFormatter={(v) => Math.round(v).toLocaleString("id-ID")}
                    tickLine={false}
                    axisLine={{ stroke: "var(--md-sys-color-outline-variant)", opacity: 0.5 }}
                  />

                  {/* Right Y-Axis: Cumulative True Foreign Net Flow */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={["auto", "auto"]}
                    stroke="var(--md-sys-color-on-surface-variant)"
                    fontSize={10}
                    tickFormatter={(v) => fmtRadarFlow(v)}
                    tickLine={false}
                    axisLine={{ stroke: "var(--md-sys-color-outline-variant)", opacity: 0.5 }}
                  />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const p = payload[0].payload as TimelinePoint;
                        return (
                          <div className="bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-xl p-3 shadow-lg text-xs font-mono space-y-1.5 z-50">
                            <div className="text-[var(--md-sys-color-on-surface-variant)] font-bold border-b border-[var(--md-sys-color-outline-variant)] pb-1">
                              Tanggal: <span className="text-[var(--md-sys-color-on-surface)]">{p.date}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-[#38bdf8]">IHSG Close:</span>
                              <strong className="text-[var(--md-sys-color-on-surface)]">{p.ihsg_close.toLocaleString("id-ID")}</strong>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Foreign Net (Hari Ini):</span>
                              <strong style={{ color: signedColor(p.daily_flow) }}>
                                {p.daily_flow > 0 ? "+" : ""}{fmtRadarFlow(p.daily_flow)}
                              </strong>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Kumulatif Flow:</span>
                              <strong style={{ color: signedColor(p.cumulative_flow) }}>
                                {p.cumulative_flow > 0 ? "+" : ""}{fmtRadarFlow(p.cumulative_flow)}
                              </strong>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <ReferenceLine yAxisId="right" y={0} stroke="var(--md-sys-color-outline)" strokeDasharray="3 3" opacity={0.6} />

                  {/* Cumulative Area */}
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulative_flow"
                    baseValue={0}
                    fill="url(#flowGradient)"
                    stroke={isNetOutflow ? "#f43f5e" : "#10b981"}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />

                  {/* IHSG Line */}
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="ihsg_close"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: "#38bdf8" }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* LOWER SECTION: CULPRIT BROKERS & TIMELINE TABLE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
            
            {/* CULPRIT BROKERS SECTION (4 COLS) */}
            <div className="lg:col-span-5 bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="ph:skull-duotone" width="18" className="text-rose-500" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--md-sys-color-on-surface)]">
                    Top 5 Culprit Brokers (14D)
                  </h4>
                </div>
                <span className="text-[10px] font-mono font-medium text-[var(--md-sys-color-on-surface-variant)]">
                  Net Sell Asing
                </span>
              </div>

              {culpritBrokers.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  Tidak ada data broker asing yang terdeteksi net sell masif pada periode ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {culpritBrokers.map((broker, idx) => (
                    <div
                      key={broker.broker_code}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 text-xs font-mono hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-rose-500/10 text-rose-500 font-extrabold flex items-center justify-center text-[10px] shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0 truncate">
                          <span className="font-extrabold text-[var(--md-sys-color-on-surface)] mr-2">
                            {broker.broker_code}
                          </span>
                          <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] truncate" title={broker.broker_name}>
                            {broker.broker_name}
                          </span>
                        </div>
                      </div>

                      <div className="font-bold text-rose-600 dark:text-rose-400 tabular-nums shrink-0 ml-2">
                        {fmtRadarFlow(broker.net_sell_idr)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TIMELINE TABLE (7 COLS) */}
            <div className="lg:col-span-7 bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="ph:table-duotone" width="18" className="text-[var(--md-sys-color-primary)]" />
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--md-sys-color-on-surface)]">
                    Timeline Arus Asing Harian
                  </h4>
                </div>
                <span className="text-[10px] font-mono font-medium text-[var(--md-sys-color-on-surface-variant)]">
                  {timeline.length} Hari Perdagangan
                </span>
              </div>

              <div className="max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)]">
                <table className="w-full text-left text-xs whitespace-nowrap font-mono">
                  <thead className="sticky top-0 bg-[var(--md-sys-color-surface-container-high)] text-[10px] uppercase font-bold text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)]">
                    <tr>
                      <th className="py-2 px-3">Tanggal</th>
                      <th className="py-2 px-2 text-center">Status</th>
                      <th className="py-2 px-3 text-right">IHSG</th>
                      <th className="py-2 px-3 text-right">Net Flow Asing</th>
                      <th className="py-2 px-3 text-right">Kumulatif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40 text-[11px]">
                    {[...timeline].reverse().map((row) => (
                      <tr key={row.date} className="hover:bg-[var(--md-sys-color-surface-container)] transition-colors">
                        <td className="py-2 px-3 font-medium text-[var(--md-sys-color-on-surface)]">
                          {row.date}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {row.market_state === "CRASH" && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">CRASH</span>
                          )}
                          {row.market_state === "BOTTOMING" && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">BOTTOM</span>
                          )}
                          {row.market_state === "WARNING" && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">WARN</span>
                          )}
                          {(!row.market_state || row.market_state === "NORMAL") && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)]">NORM</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-[#38bdf8]">
                          {row.ihsg_close.toLocaleString("id-ID")}
                        </td>
                        <td className="py-2 px-3 text-right font-bold tabular-nums" style={{ color: signedColor(row.daily_flow) }}>
                          {row.daily_flow > 0 ? "+" : ""}{fmtRadarFlow(row.daily_flow)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold tabular-nums" style={{ color: signedColor(row.cumulative_flow) }}>
                          {row.cumulative_flow > 0 ? "+" : ""}{fmtRadarFlow(row.cumulative_flow)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* BOTTOM COLLAPSE LINK */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={() => setIsExpanded(false)}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] transition-all cursor-pointer select-none py-1.5 px-4 rounded-full hover:bg-[var(--md-sys-color-surface-container-high)]/60 active:scale-95"
            >
              <span>Tutup Detail Radar</span>
              <Icon icon="ph:caret-up-bold" width="14" className="text-[var(--md-sys-color-primary)]" />
            </button>
          </div>

        </div>
      )}

    </section>
  );
}
