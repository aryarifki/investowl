"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ValidationProps {
  ticker: string;
  analysisDate: string;
  windowDays: number;
  universeMode: string;
  horizon: number;
  minEvents: number;
}

export default function ValidationTab({ ticker, analysisDate, windowDays, universeMode, horizon, minEvents }: ValidationProps) {
  const [scanMode, setScanMode] = useState<"ticker" | "all">("ticker");
  const [showIndividual, setShowIndividual] = useState(false);

  const url = "/api/bandar/validation-v2/" + ticker + 
              "?analysis_date=" + analysisDate + 
              "&window_days=" + windowDays + 
              "&horizon=" + horizon + 
              "&min_events=" + minEvents + 
              "&universe_mode=" + universeMode;
              
  const { data, error, isLoading } = useSWR(url, fetcher, { refreshInterval: 0, revalidateOnFocus: false });

  const chartData = useMemo(() => {
    if (!data?.event_study?.chart) return [];
    return data.event_study.chart.map((item: any) => {
      const row = { ...item };
      (data.event_study.paths || []).forEach((path: any) => {
        row[path.id] = path.data[item.day];
      });
      return row;
    });
  }, [data]);

  const sortedScanData = useMemo(() => {
    if (!data?.broker_scan) return [];
    
    const rawData = scanMode === "ticker" ? data.broker_scan.ticker : data.broker_scan.all;
    if (!rawData) return [];

    return [...rawData].sort((a, b) => {
      if (a.significant && !b.significant) return -1;
      if (!a.significant && b.significant) return 1;
      const wrA = a.win_rate || 0;
      const wrB = b.win_rate || 0;
      if (wrB !== wrA) return wrB - wrA;
      const pA = a.p_value_one_sided ?? 1;
      const pB = b.p_value_one_sided ?? 1;
      if (pA !== pB) return pA - pB;
      const mrA = a.mean_fwd_return || 0;
      const mrB = b.mean_fwd_return || 0;
      return mrB - mrA;
    });
  }, [data, scanMode]);

  if (isLoading) return <div className="p-8 border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] rounded-[24px] flex items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)] shadow-sm animate-pulse"><Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="24" /> <span className="text-sm font-bold tracking-wide">Running historical validation models...</span></div>;
  if (error || !data) return <div className="p-5 bg-[var(--md-sys-color-error-container)] border border-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error-container)] font-bold text-sm rounded-[24px] shadow-sm">Error loading validation data.</div>;

  const fmtPct = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "-";
    return (val > 0 ? "+" : "") + (val * 100).toFixed(2) + "%";
  };

  const fmtRp = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "-";
    const sign = val < 0 ? "-" : "";
    const n = Math.abs(val);
    if (n >= 1e12) return sign + "Rp " + (n / 1e12).toFixed(2) + " T";
    if (n >= 1e9) return sign + "Rp " + (n / 1e9).toFixed(2) + " B";
    if (n >= 1e6) return sign + "Rp " + (n / 1e6).toFixed(2) + " M";
    return sign + "Rp " + n.toLocaleString("id-ID");
  };

  const isBullish = chartData.length > 0 && chartData[chartData.length - 1].median >= 100;
  // Ini untuk Chart (butuh value hex asli, bukan variable) 
  // Kita fallback ke warna default jika tidak bisa baca
  const themeColor = isBullish ? "#10b981" : "#f43f5e"; 

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      
      {/* ====== BROKER-SPECIFIC RETURN VALIDATION ====== */}
      <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm transition-colors duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-5 border-b border-[var(--md-sys-color-outline-variant)] pb-4">
          <div className="flex items-center gap-2.5">
            <Icon icon="ph:check-square-offset-bold" className="text-[var(--md-sys-color-primary)]" width="22" />
            <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">Broker-Specific Return Validation</h3>
          </div>
          
          <div className="flex items-center bg-[var(--md-sys-color-surface)] p-1.5 rounded-full border border-[var(--md-sys-color-outline-variant)] shadow-sm">
            <button 
              onClick={() => setScanMode("ticker")} 
              className={`px-4 py-2 text-[10px] uppercase tracking-widest font-extrabold rounded-full transition-all duration-300 ${scanMode === "ticker" ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border border-[var(--md-sys-color-primary)] shadow-sm" : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] border border-transparent"}`}
            >
              Current Ticker ({ticker})
            </button>
            <button 
              onClick={() => setScanMode("all")} 
              className={`px-4 py-2 text-[10px] uppercase tracking-widest font-extrabold rounded-full transition-all duration-300 ${scanMode === "all" ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border border-[var(--md-sys-color-primary)] shadow-sm" : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] border border-transparent"}`}
            >
              Watchlist ({universeMode})
            </button>
          </div>
        </div>

        {sortedScanData.length === 0 ? (
          <div className="text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold text-center py-12">No broker passes the current validation settings.</div>
        ) : (
          <div className="bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] shadow-sm overflow-hidden transition-colors duration-300">
            <div className="max-h-[450px] overflow-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] pb-2">
                <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="sticky top-0 bg-[var(--md-sys-color-surface-container-highest)] z-10 shadow-sm">
                    <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                    <th className="py-3 px-4">Ticker</th>
                    <th className="py-3 px-4">Broker</th>
                    <th className="py-3 px-4 text-right">Events</th>
                    <th className="py-3 px-4 text-right">Win Rate</th>
                    <th className="py-3 px-4 text-right">Mean Ret</th>
                    <th className="py-3 px-4 text-right">Median Ret</th>
                    <th className="py-3 px-4 text-right">Total Net Buy</th>
                    <th className="py-3 px-4 text-right">P-Value</th>
                    <th className="py-3 px-4 text-center">Significant</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40">
                    {sortedScanData.map((b: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                        <td className="py-3 px-4 font-extrabold text-[var(--md-sys-color-on-surface)]">{b.ticker}</td>
                        <td className="py-3 px-4 font-extrabold font-mono text-[#3b82f6]">{b.broker_code}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface)]">{b.n_events}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-[var(--color-positive)]">{fmtPct(b.win_rate)}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold" style={{ color: b.mean_fwd_return > 0 ? "var(--color-positive)" : b.mean_fwd_return < 0 ? "var(--color-negative)" : "var(--md-sys-color-on-surface-variant)" }}>{fmtPct(b.mean_fwd_return)}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold" style={{ color: b.median_fwd_return > 0 ? "var(--color-positive)" : b.median_fwd_return < 0 ? "var(--color-negative)" : "var(--md-sys-color-on-surface-variant)" }}>{fmtPct(b.median_fwd_return)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{fmtRp(b.total_net_value)}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-[var(--md-sys-color-on-surface-variant)] opacity-80">{b.p_value_one_sided?.toFixed(4) || "-"}</td>
                        <td className="py-3 px-4 text-center">
                        {b.significant ? (
                            <span className="px-3 py-1.5 rounded-full border font-extrabold tracking-widest text-[9px] bg-emerald-500/15 text-[var(--color-positive)] border-emerald-500/30 shadow-sm">YES</span>
                        ) : (
                            <span className="px-3 py-1.5 rounded-full border font-bold tracking-widest text-[9px] bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)]">NO</span>
                        )}
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
          </div>
        )}
      </div>

      {/* ====== ACCUMULATION EVENT STUDY ====== */}
      <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm transition-colors duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4 border-b border-[var(--md-sys-color-outline-variant)] pb-4">
          <div className="flex items-center gap-2.5">
            <Icon icon="ph:trend-up-bold" className="text-[var(--md-sys-color-primary)]" width="22" />
            <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">Accumulation Event Study</h3>
          </div>
          
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={showIndividual} onChange={(e) => setShowIndividual(e.target.checked)} />
              <div className={`block w-10 h-6 rounded-full transition-colors shadow-inner ${showIndividual ? "bg-[var(--md-sys-color-primary-container)] border border-[var(--md-sys-color-primary)]" : "bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)]"}`}></div>
              <div className={`absolute left-[4px] top-[4px] bg-[var(--md-sys-color-outline-variant)] w-4 h-4 rounded-full transition-transform shadow-sm ${showIndividual ? "transform translate-x-4 bg-[var(--md-sys-color-primary)]" : ""}`}></div>
            </div>
            <span className="text-[10px] font-extrabold text-[var(--md-sys-color-on-surface)] uppercase tracking-widest">Show individual paths</span>
          </label>
        </div>

        {chartData.length === 0 ? (
          <div className="text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold text-center py-12">No accumulation events found in this window.</div>
        ) : (
          <React.Fragment>
            {/* Chart Container */}
            <div className="h-72 mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="day" stroke="var(--md-sys-color-outline-variant)" fontSize={10} fill="var(--md-sys-color-on-surface-variant)" fontWeight={600} tickLine={false} axisLine={false} dy={10} />
                  <YAxis domain={['auto', 'auto']} stroke="var(--md-sys-color-outline-variant)" fontSize={10} fill="var(--md-sys-color-on-surface-variant)" fontWeight={600} tickLine={false} axisLine={false} tickFormatter={(val) => val.toFixed(1)} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', borderColor: 'var(--md-sys-color-outline-variant)', borderRadius: '16px', fontSize: '12px', boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", fontWeight: 700 }}
                    itemStyle={{ color: 'var(--md-sys-color-on-surface)' }}
                    labelStyle={{ color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 800, marginBottom: '4px' }}
                  />
                  <ReferenceLine y={100} stroke="var(--md-sys-color-outline)" strokeDasharray="4 4" strokeWidth={1.5} />
                  
                  {showIndividual && (data.event_study?.paths || []).map((path: any) => (
                    <Line key={path.id} type="monotone" dataKey={path.id} stroke="var(--md-sys-color-outline)" strokeWidth={1.5} dot={false} opacity={0.4} activeDot={false} isAnimationActive={false} />
                  ))}
                  
                  <Area type="monotone" dataKey="range" fill={themeColor} fillOpacity={0.15} stroke="none" isAnimationActive={false} />
                  <Line type="monotone" dataKey="median" stroke={themeColor} strokeWidth={3} dot={{ r: 4, fill: themeColor, strokeWidth: 2, stroke: 'var(--md-sys-color-surface-container)' }} activeDot={{ r: 6 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Event Study Table */}
            <div className="bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] shadow-sm overflow-hidden transition-colors duration-300">
                <div className="max-h-[400px] overflow-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] pb-2">
                <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-[var(--md-sys-color-surface-container)]">
                    <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-highest)] shadow-sm">
                        <th className="py-3 px-4 text-[9px] uppercase tracking-widest font-extrabold">Ticker</th>
                        <th className="py-3 px-4 text-[9px] uppercase tracking-widest font-extrabold">Signal Date</th>
                        <th className="py-3 px-4 text-[9px] uppercase tracking-widest font-extrabold">Signal</th>
                        <th className="py-3 px-4 text-[9px] uppercase tracking-widest font-extrabold text-right">+1D</th>
                        <th className="py-3 px-4 text-[9px] uppercase tracking-widest font-extrabold text-right">+3D</th>
                        <th className="py-3 px-4 text-[9px] uppercase tracking-widest font-extrabold text-right">+5D</th>
                        <th className="py-3 px-4 text-[9px] uppercase tracking-widest font-extrabold text-right">+10D</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40">
                    {(data.event_study?.table || []).map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors text-[var(--md-sys-color-on-surface)]">
                        <td className="py-3 px-4 font-extrabold text-[var(--md-sys-color-on-surface)]">{row.ticker}</td>
                        <td className="py-3 px-4 text-[var(--md-sys-color-on-surface-variant)] font-bold font-mono">{row.signal_date.split(" ")[0]}</td>
                        <td className="py-3 px-4">
                            <span className={`px-3 py-1.5 rounded-full border font-extrabold tracking-widest text-[9px] uppercase shadow-sm ${row.signal.includes("STRONG") ? "bg-emerald-500/15 text-[var(--color-positive)] border-emerald-500/30" : "bg-blue-500/15 text-[#3b82f6] border-[#3b82f6]/30"}`}>
                            {row.signal.replace(/_/g, " ")}
                            </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold">{row.t_plus_1d?.toFixed(2) || "-"}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold">{row.t_plus_3d?.toFixed(2) || "-"}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold">{row.t_plus_5d?.toFixed(2) || "-"}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold">{row.t_plus_10d?.toFixed(2) || "-"}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}
