"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Icon } from "@iconify/react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ScreenerProps {
  universeMode: string;
  analysisDate: string;
  windowDays: number;
  customTickers?: string[];
}

export default function ScreenerTab({ universeMode, analysisDate, windowDays, customTickers }: ScreenerProps) {
  const [minLiq, setMinLiq] = useState<number>(0); 
  const [showOnlyAcc, setShowOnlyAcc] = useState<boolean>(false);

  let url = `/api/bandar/screener-v2?universe_mode=${universeMode}&analysis_date=${analysisDate}&window_days=${windowDays}`;
  if (customTickers && customTickers.length > 0) {
    url += `&tickers=${customTickers.join(",")}`;
  }
  
  const { data, error, isLoading, isValidating, mutate } = useSWR(url, fetcher, { 
    refreshInterval: 0, 
    revalidateOnFocus: false 
  });

  if (isLoading && !data) return <div className="p-8 border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] rounded-[24px] flex items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)] shadow-sm animate-pulse"><Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="24" /> <span className="text-sm font-bold tracking-wide">Scanning market & compiling metrics...</span></div>;
  if (error) return <div className="p-5 bg-[var(--md-sys-color-error-container)] border border-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error-container)] font-bold text-sm rounded-[24px] shadow-sm">Error loading screener data.</div>;

  const rawResults = data?.data || [];
  const meta = data?.meta || {};
  
  let results = rawResults.filter((r: any) => r.total_value >= minLiq);
  
  if (showOnlyAcc) {
    results = results.filter((r: any) => {
      const sig = (r.signal || "").toUpperCase();
      return sig.includes("ACCUMULATION") || sig.includes("BUY");
    });
  }

  const fmtRp = (val: number) => {
    if (!val) return "-";
    const sign = val < 0 ? "-" : "";
    const n = Math.abs(val);
    if (n >= 1e12) return sign + "Rp " + (n / 1e12).toFixed(2) + " T";
    if (n >= 1e9) return sign + "Rp " + (n / 1e9).toFixed(2) + " B";
    if (n >= 1e6) return sign + "Rp " + (n / 1e6).toFixed(2) + " M";
    return sign + "Rp " + n.toLocaleString("id-ID");
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      
      {/* ====== CONTROLS ====== */}
      <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm transition-colors duration-300">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
            <div>
                <div className="flex items-center gap-2.5 mb-2">
                    <Icon icon="ph:funnel-bold" className="text-[var(--md-sys-color-primary)]" width="22" />
                    <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">Terminal Screener</h3>
                </div>
                <div className="text-[9px] sm:text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest flex items-center gap-2.5 font-extrabold">
                    <span>Target: <span className="text-[var(--md-sys-color-primary)]">{universeMode}</span></span>
                    <span className="w-1.5 h-1.5 bg-[var(--md-sys-color-outline)] rounded-full"></span>
                    <span>{meta.window_start || "-"} to {meta.analysis_date || "-"}</span>
                    <span className="w-1.5 h-1.5 bg-[var(--md-sys-color-outline)] rounded-full"></span>
                    <span className="text-[var(--md-sys-color-on-surface)] px-2 py-0.5 bg-[var(--md-sys-color-surface-container-highest)] rounded shadow-sm">{results.length} Setups</span>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                {/* CHECKBOX KAPSUL */}
                <label className="flex items-center gap-2.5 text-sm font-bold text-[var(--md-sys-color-on-surface)] cursor-pointer select-none border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] hover:border-[var(--md-sys-color-primary)] rounded-full px-4 py-2.5 active:scale-[0.98] transition-all shadow-sm">
                    <input type="checkbox" checked={showOnlyAcc} onChange={(e) => setShowOnlyAcc(e.target.checked)} className="rounded accent-[var(--md-sys-color-primary)] w-4 h-4 cursor-pointer" />
                    <span className="text-xs uppercase tracking-wide">Accumulation Only</span>
                </label>
                
                {/* SELECT KAPSUL */}
                <select 
                    className="bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] rounded-full px-4 py-2.5 text-xs font-bold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] flex-grow xl:flex-grow-0 shadow-sm cursor-pointer transition-colors"
                    value={minLiq}
                    onChange={(e) => setMinLiq(Number(e.target.value))}
                >
                    <option value={0}>Any Liquidity</option>
                    <option value={1000000000}>&gt; Rp 1B Daily</option>
                    <option value={5000000000}>&gt; Rp 5B Daily</option>
                    <option value={10000000000}>&gt; Rp 10B Daily</option>
                </select>

                {/* TOMBOL RUN KAPSUL */}
                <button 
                    onClick={() => mutate()}
                    disabled={isValidating}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--md-sys-color-primary-container)] hover:opacity-90 border border-[var(--md-sys-color-primary)] rounded-full text-xs font-extrabold text-[var(--md-sys-color-on-primary-container)] transition-all active:scale-95 disabled:opacity-50 flex-grow xl:flex-grow-0 shadow-sm"
                >
                    <Icon icon={isValidating ? "ph:spinner-gap-bold" : "ph:play-bold"} className={isValidating ? "animate-spin" : ""} width="16" />
                    {isValidating ? "Scanning" : "Run Scan"}
                </button>
            </div>
        </div>
      </div>

      {/* ====== DATA GRID ====== */}
      <div className="bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-[24px] shadow-sm overflow-hidden transition-colors duration-300">
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] pb-2">
          <table className="w-full text-left whitespace-nowrap text-xs">
            <thead className="sticky top-0 bg-[var(--md-sys-color-surface-container-highest)] z-10 shadow-sm">
              <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                <th className="py-4 px-5">Asset</th>
                <th className="py-4 px-5 text-center">Conviction</th>
                <th className="py-4 px-5 text-right">Foreign (5D)</th>
                <th className="py-4 px-5 text-right">Smart Net</th>
                <th className="py-4 px-5 text-center">Top Buyer</th>
                <th className="py-4 px-5 text-right">Distance</th>
                <th className="py-4 px-5 text-center">As Of</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40">
              {results.map((row: any, idx: number) => {
                const distanceVal = row.current_price && row.bandar_avg_price ? ((row.current_price - row.bandar_avg_price) / row.bandar_avg_price) * 100 : null;
                const upperSignal = (row.signal || "").toUpperCase();
                const isAcc = upperSignal.includes("ACCUMULATION") || upperSignal.includes("BUY");
                const isDist = upperSignal.includes("DISTRIBUTION") || upperSignal.includes("SELL");

                let sigTheme = "text-[var(--md-sys-color-on-surface-variant)]";
                if (isAcc) sigTheme = "text-[var(--color-positive)]";
                else if (isDist) sigTheme = "text-[var(--color-negative)]";

                return (
                  <tr key={idx} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-extrabold font-mono text-[var(--md-sys-color-on-surface)]">{row.ticker}</div>
                      <div className={`text-[9px] font-extrabold uppercase tracking-widest mt-1 ${sigTheme}`}>
                        {row.signal}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-center font-bold">
                      <span className={`px-3 py-1.5 rounded-full border tracking-wider text-[10px] shadow-sm ${row.conviction_score >= 70 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : row.conviction_score <= 30 ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)]"}`}>
                        {row.conviction_score.toFixed(1)}
                      </span>
                    </td>
                    <td className={`py-3.5 px-5 text-right font-mono font-extrabold ${row.foreign_net > 0 ? "text-[var(--color-positive)]" : row.foreign_net < 0 ? "text-[var(--color-negative)]" : "text-[var(--md-sys-color-on-surface-variant)]"}`}>
                      {fmtRp(row.foreign_net)}
                    </td>
                    <td className={`py-3.5 px-5 text-right font-mono font-extrabold ${row.net_value > 0 ? "text-[var(--color-positive)]" : row.net_value < 0 ? "text-[var(--color-negative)]" : "text-[var(--md-sys-color-on-surface-variant)]"}`}>
                      {fmtRp(row.net_value)}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <span className="px-3 py-1 bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)] font-mono text-[10px] font-extrabold rounded-full shadow-sm">
                        {row.top_buyer || "-"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-extrabold">
                      {distanceVal !== null ? (
                        <span style={{ color: distanceVal <= 3 && distanceVal >= -5 ? "var(--color-positive)" : distanceVal > 3 ? "var(--md-sys-color-on-surface-variant)" : "var(--color-negative)"}}>
                          {distanceVal > 0 ? "+" : ""}{distanceVal.toFixed(2)}%
                        </span>
                      ) : <span className="text-[var(--md-sys-color-on-surface-variant)]">-</span>}
                    </td>
                    <td className="py-3.5 px-5 text-center text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-bold font-mono">
                      {row.data_date}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {results.length === 0 && (
            <div className="py-16 text-center text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold tracking-wide">
              No setups match your target matrix. Adjust filters or re-run scan.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
