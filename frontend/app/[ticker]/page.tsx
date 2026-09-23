"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, ComposedChart, ReferenceLine
} from "recharts";

import BrokerFlowTab from "@/components/analysis/BrokerFlowTab";
import CausalityTab from "@/components/analysis/CausalityTab";
import ValidationTab from "@/components/analysis/ValidationTab";
import ScreenerTab from "@/components/analysis/ScreenerTab";
import RawTablesTab from "@/components/analysis/RawTablesTab";
import TickerSearch from "@/components/layout/TickerSearch";
import { useAppStore } from "@/store/useAppStore";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ==================== FORMATTERS ==================== */
function fmtRp(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (v >= 1e12) return sign + "Rp " + (v / 1e12).toFixed(2) + " T";
  if (v >= 1e9) return sign + "Rp " + (v / 1e9).toFixed(2) + " B";
  if (v >= 1e6) return sign + "Rp " + (v / 1e6).toFixed(2) + " M";
  return sign + "Rp " + v.toLocaleString("id-ID");
}

function fmtPct(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%";
}

function signedColor(n: number): string {
  return n >= 0 ? "var(--color-positive)" : "var(--color-negative)";
}

function signalColor(score: number | null): string {
  if (score === null || score === undefined) return "var(--md-sys-color-outline)";
  if (score >= 2) return "var(--color-positive)";
  if (score === 1) return "var(--color-positive)";
  if (score === 0) return "var(--md-sys-color-outline)";
  if (score === -1) return "var(--color-negative)";
  return "var(--color-negative)";
}

export function getProfileTextColor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("foreign smart")) return "var(--color-positive)";
  if (l.includes("local inst")) return "#3b82f6";
  if (l.includes("market maker")) return "#a855f7";
  if (l.includes("speculative")) return "#f59e0b";
  return "var(--md-sys-color-outline)";
}

const TABS = ["Overview", "Broker Flow", "Causality", "Validation", "Screener", "Raw Tables"];

/* ==================== MAIN PAGE COMPONENT ==================== */
export default function TickerPage() {
  const params = useParams();
  const tickerFromUrl = String(params.ticker || "").toUpperCase();
  
  const { 
    activeTicker, setActiveTicker, 
    analysisDate, windowDays, universe, horizon, minEvents,
    localWatchlist, setLocalWatchlist
  } = useAppStore();

  const [activeTab, setActiveTab] = useState("Overview");

  useEffect(() => {
    if (tickerFromUrl && tickerFromUrl !== activeTicker) {
      setActiveTicker(tickerFromUrl);
    }
  }, [tickerFromUrl, activeTicker, setActiveTicker]);

  useEffect(() => {
    if (universe === "watchlist" || activeTab === "Screener") {
      try {
        const ls = localStorage.getItem("tradepulse_watchlist");
        if (ls) {
          setLocalWatchlist(JSON.parse(ls));
        }
      } catch (e) {}
    }
  }, [universe, activeTab, setLocalWatchlist]);

  const qs = "?window_days=" + windowDays + (analysisDate ? "&analysis_date=" + analysisDate : "");
  const { data, error, isLoading } = useSWR(
    activeTicker ? "/api/bandar/detail/" + activeTicker + qs : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  if (!activeTicker) {
    return <div className="min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] flex items-center justify-center transition-colors duration-300">No ticker selected</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 transition-colors duration-300 animate-fade-in pb-20">
      <TickerSearch />

      {/* IDENTITAS EMITEN (HEADER CARD) */}
      <div className="mt-5 mb-6 bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-7 shadow-sm transition-colors duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--md-sys-color-primary)] to-[var(--md-sys-color-tertiary)] opacity-80"></div>
        
        <div className="text-[10px] sm:text-xs font-extrabold text-[var(--md-sys-color-primary)] uppercase tracking-widest mb-1">
          SMART MONEY DASHBOARD
        </div>
        
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-2.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">{activeTicker}</h1>
          <span className="text-[10px] sm:text-xs font-bold bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-3.5 py-1.5 shadow-sm">
            Window: {data?.window_start || "..."} <span className="opacity-60 mx-1">s/d</span> {data?.analysis_date || "..."}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-[10px] sm:text-xs">
          <span className="text-[var(--md-sys-color-on-surface-variant)] font-bold">{data?.company?.name || "Bursa Efek Indonesia"}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--md-sys-color-outline-variant)]" />
          <span className="text-[var(--md-sys-color-primary)] font-bold tracking-wide">{data?.company?.group || "Sektor Perusahaan"}</span>
        </div>
      </div>

      {isLoading && <div className="text-[var(--md-sys-color-on-surface-variant)] text-xs font-medium mb-4 animate-pulse">Memuat data analisis presisi...</div>}
      {error && <div className="text-[var(--color-negative)] text-xs font-bold mb-4">Gagal mengambil data sistem.</div>}

      {/* METRIC CARDS GRID */}
      {data && !data.error && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
          <MetricCard label="Conviction Score" value={data.conviction_score?.toFixed(1) + "/100"} note="weighted model" tone={data.conviction_score} />
          <MetricCard label="Signal" value={data.signal} note="selected date" tone={null} accent={signalColor(data.signal_score)} />
          <MetricCard label="5D Return" value={fmtPct(data.ret_5d)} note="price context" tone={data.ret_5d} />
          <MetricCard label="Foreign Net 5D" value={fmtRp(data.foreign_5d)} note="broker summary" tone={data.foreign_5d} />
          <MetricCard label="Top Buyer" value={data.top_buyer?.broker || "-"} note={fmtRp(data.top_buyer?.net)} tone={1} />
          <MetricCard label="Smart Cumulative" value={fmtRp(data.smart_cumulative)} note={(data.smart_daily?.length || 0) + " broker days"} tone={data.smart_cumulative} />
        </div>
      )}

      {/* ALERTS */}
      {data?.alerts?.length > 0 && (
        <div className="mb-6 border rounded-[20px] px-5 py-4 shadow-sm" style={{ backgroundColor: "var(--md-sys-color-surface-container-high)", borderColor: "var(--color-negative)" }}>
          {data.alerts.map((a: string, i: number) => (
            <div key={i} className="text-xs sm:text-sm font-bold flex items-center gap-2 mb-1 last:mb-0" style={{ color: "var(--color-negative)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-negative)]"></span> {a}
            </div>
          ))}
        </div>
      )}

      {/* VERDICT READ */}
      {data?.verdict && (
        <div className="mb-6 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-[24px] p-5 sm:p-6 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-2 bg-[var(--md-sys-color-primary)]"></div>
          <div className="pl-2">
            <div className="text-[10px] sm:text-xs font-extrabold text-[var(--md-sys-color-primary)] uppercase tracking-widest mb-1.5">Current read</div>
            <div className="text-xs sm:text-sm text-[var(--md-sys-color-on-surface)] font-medium leading-relaxed">{data.verdict}</div>
          </div>
        </div>
      )}

      {/* MD3 PILL TABS */}
      <div className="mb-6 border-b border-[var(--md-sys-color-outline-variant)] pb-4">
        <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={
                "px-5 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap rounded-full transition-all duration-300 active:scale-95 shadow-sm " +
                (activeTab === tab
                  ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]"
                  : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)] border border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-primary)]")
              }
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT RENDERER */}
      <div className="transition-colors duration-300">
        {activeTab === "Overview" && <OverviewTab data={data} isLoading={isLoading} />}
        {activeTab === "Broker Flow" && <BrokerFlowTab ticker={activeTicker} analysisDate={analysisDate} windowDays={windowDays} />}
        {activeTab === "Causality" && <CausalityTab ticker={activeTicker} analysisDate={analysisDate} windowDays={windowDays} />}
        {activeTab === "Validation" && (
          <ValidationTab
            ticker={activeTicker}
            analysisDate={analysisDate}
            windowDays={windowDays}
            universeMode={universe}
            horizon={horizon}
            minEvents={minEvents}
          />
        )}
        {activeTab === "Screener" && (
          <ScreenerTab
            universeMode={universe}
            analysisDate={analysisDate}
            windowDays={windowDays}
            customTickers={universe === "watchlist" ? localWatchlist : []}
          />
        )}
        {activeTab === "Raw Tables" && (
          <RawTablesTab ticker={activeTicker} analysisDate={analysisDate} windowDays={windowDays} />
        )}
      </div>
    </div>
  );
}

// =========================================================================
// KOMPONEN METRIC & OVERVIEW TAB 
// =========================================================================

function MetricCard({ label, value, note, tone, accent }: { label: string; value: string; note: string; tone: number | null; accent?: string }) {
  let color = "var(--md-sys-color-outline)";
  if (accent) color = accent;
  else if (tone !== null && tone !== undefined) color = signedColor(Number(tone));
  return (
    <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-[24px] p-4 transition-colors duration-300 shadow-sm hover:shadow-md relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1.5 h-full transition-all duration-300 opacity-80 group-hover:opacity-100" style={{ backgroundColor: color }}></div>
      <div className="pl-2.5">
        <div className="text-[9px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest mb-1.5">{label}</div>
        <div className="text-base sm:text-lg font-extrabold tracking-tight" style={{ color }}>{value}</div>
        <div className="text-[10px] font-medium text-[var(--md-sys-color-on-surface-variant)] truncate mt-1 opacity-80">{note}</div>
      </div>
    </div>
  );
}

function OverviewTab({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return <div className="text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold animate-pulse">Loading overview...</div>;
  if (!data || data.error) return <div className="text-[var(--color-negative)] text-xs font-bold">{data?.error || "No data"}</div>;

  const chartData = (data.price_chart || []).map((p: any) => {
    const sig = (data.signal_overlay || []).find((s: any) => s.date === p.date);
    return { ...p, signal: sig?.signal || null, signalScore: sig?.score ?? null };
  });

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Price Chart + Top Brokers */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 sm:gap-5">
        <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 transition-colors duration-300 shadow-sm">
          <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] mb-4 tracking-tight">Price, Volume, and Signal Context</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" domain={["auto", "auto"]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" />
                <Tooltip
                  contentStyle={{ background: "var(--md-sys-color-surface-container-highest)", border: "1px solid var(--md-sys-color-outline-variant)", borderRadius: "16px", fontSize: "11px", color: "var(--md-sys-color-on-surface)", fontWeight: 700, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  labelStyle={{ color: "var(--md-sys-color-on-surface-variant)", fontWeight: 800, marginBottom: "4px" }}
                  formatter={(value: any, name: any) => [fmtRp(Number(value)), String(name)]}
                />
                <Bar yAxisId="right" dataKey="volume" fill="var(--md-sys-color-outline)" opacity={0.2} radius={[4, 4, 0, 0]} />
                <Line yAxisId="left" type="monotone" dataKey="close" stroke="#f59e0b" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[24px] p-5 sm:p-6 transition-colors duration-300 shadow-sm">
            <h3 className="text-sm font-extrabold text-[var(--md-sys-color-on-surface)] mb-1 tracking-tight">Top Brokers</h3>
            <p className="text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-3">Net buy/sell pada tanggal analisis</p>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                    <th className="text-left py-2">Side</th>
                    <th className="text-left py-2">Broker</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-right py-2">Net</th>
                    <th className="text-left py-2 pl-3">5D</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.broker_summary || []).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-[var(--md-sys-color-outline-variant)]/40 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                      <td className="py-2.5 font-bold" style={{ color: row.side === "Buy" ? "var(--color-positive)" : "var(--color-negative)" }}>{row.side}</td>
                      <td className="py-2.5 text-[var(--md-sys-color-on-surface)] font-extrabold font-mono">{row.broker}</td>
                      <td className="py-2.5 text-[var(--md-sys-color-on-surface-variant)] font-medium">{row.type}</td>
                      <td className="py-2.5 text-right font-mono font-bold" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</td>
                      <td className="py-2.5 pl-3 text-[var(--md-sys-color-on-surface-variant)] font-mono font-bold tracking-widest">{row.spark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[24px] p-5 sm:p-6 transition-colors duration-300 shadow-sm">
            <h3 className="text-sm font-extrabold text-[var(--md-sys-color-on-surface)] mb-2 tracking-tight">Price Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                    <th className="text-left py-2">Period</th>
                    <th className="text-right py-2">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.price_performance || []).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-[var(--md-sys-color-outline-variant)]/40 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                      <td className="py-2.5 text-[var(--md-sys-color-on-surface)] font-bold">{row.period}</td>
                      <td className="py-2.5 text-right font-mono font-extrabold" style={{ color: signedColor(row.value) }}>{fmtPct(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Smart Flow + Profile Net Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4 sm:gap-5">
        <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 transition-colors duration-300 shadow-sm">
          <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] mb-4 tracking-tight">Smart-Money Daily Flow</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.smart_daily || []} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" />
                <Tooltip
                  contentStyle={{ background: "var(--md-sys-color-surface-container-highest)", border: "1px solid var(--md-sys-color-outline-variant)", borderRadius: "16px", fontSize: "11px", color: "var(--md-sys-color-on-surface)", fontWeight: 700, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  labelStyle={{ color: "var(--md-sys-color-on-surface-variant)", fontWeight: 800, marginBottom: "4px" }}
                  formatter={((value: any, name: any) => [fmtRp(Number(value)), String(name)]) as any}
                />
                <Bar
                  yAxisId="left"
                  dataKey="smart_net"
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const color = payload.smart_net >= 0 ? "var(--color-positive)" : "var(--color-negative)";
                    return <rect x={x} y={y} width={width} height={height} fill={color} opacity={0.9} rx={4} />;
                  }}
                />
                <Line yAxisId="right" type="monotone" dataKey="cumulative_net" stroke="#3b82f6" strokeWidth={3} dot={false} />
                <ReferenceLine yAxisId="left" y={0} stroke="var(--md-sys-color-outline)" strokeWidth={1.5} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 transition-colors duration-300 shadow-sm">
          <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] mb-4 tracking-tight">Profile Net Flow</h3>
          {(data.profile_flow || []).length === 0 ? (
            <p className="text-xs font-bold text-[var(--md-sys-color-on-surface-variant)]">No profile flow for this window.</p>
          ) : (
            <div className="space-y-4">
              {(data.profile_flow || []).map((row: any, i: number) => {
                const maxAbs = Math.max(...(data.profile_flow || []).map((r: any) => Math.abs(r.net)), 1);
                const width = Math.max(3, (Math.abs(row.net) / maxAbs) * 100);
                
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-extrabold uppercase tracking-wide" style={{ color: getProfileTextColor(row.label) }}>{row.label}</span>
                      <span className="font-mono font-extrabold" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</span>
                    </div>
                    <div className="h-2 bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden border border-[var(--md-sys-color-outline-variant)]">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: width + "%", backgroundColor: signedColor(row.net) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* 3. Broker Detail by Profile */}
      <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 transition-colors duration-300 shadow-sm">
        <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] mb-4 tracking-tight">Broker Detail by Profile</h3>
        {(data.profile_broker_detail || []).length === 0 ? (
          <p className="text-xs font-bold text-[var(--md-sys-color-on-surface-variant)]">No broker detail for this window.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                  <th className="text-left py-2 pr-3">Profile</th>
                  <th className="text-left py-2 pr-3">Broker</th>
                  <th className="text-left py-2 pr-3">Type</th>
                  <th className="text-right py-2 pr-3">Buy</th>
                  <th className="text-right py-2 pr-3">Sell</th>
                  <th className="text-right py-2 pr-3">Net</th>
                  <th className="text-right py-2 pr-3">Freq</th>
                  <th className="text-right py-2 pr-3">Days</th>
                  <th className="text-right py-2">Avg/Tx</th>
                </tr>
              </thead>
              <tbody>
                {(data.profile_broker_detail || []).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-[var(--md-sys-color-outline-variant)]/40 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                    <td className="py-3 pr-3 font-extrabold uppercase" style={{ color: getProfileTextColor(row.profile) }}>{row.profile}</td>
                    <td className="py-3 pr-3 text-[var(--md-sys-color-on-surface)] font-extrabold font-mono">{row.broker}</td>
                    <td className="py-3 pr-3 text-[var(--md-sys-color-on-surface-variant)] font-bold">{row.type}</td>
                    <td className="py-3 pr-3 text-right font-mono font-bold" style={{ color: "var(--color-positive)" }}>{fmtRp(row.buy)}</td>
                    <td className="py-3 pr-3 text-right font-mono font-bold" style={{ color: "var(--color-negative)" }}>{fmtRp(row.sell)}</td>
                    <td className="py-3 pr-3 text-right font-mono font-extrabold" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</td>
                    <td className="py-3 pr-3 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.freq?.toLocaleString("id-ID") || 0}</td>
                    <td className="py-3 pr-3 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.days || 0}</td>
                    <td className="py-3 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{fmtRp(row.avg_value_tx)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
