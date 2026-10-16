"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, ComposedChart, ReferenceLine
} from "recharts";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { Icon } from "@iconify/react";
import TickerSearch from "@/components/layout/TickerSearch";
import { useAppStore } from "@/store/useAppStore";
import { fmtRp, fmtPct, signedColor, signalColor, getProfileTextColor } from "@/lib/format";

function TabSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-6 animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 bg-[var(--md-sys-color-surface-container-highest)] rounded-md" />
        <div className="h-4 w-24 bg-[var(--md-sys-color-surface-container-highest)] rounded-full" />
      </div>
      <div className="h-64 bg-[var(--md-sys-color-surface-container-high)] rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="h-16 bg-[var(--md-sys-color-surface-container-high)] rounded-lg" />
        <div className="h-16 bg-[var(--md-sys-color-surface-container-high)] rounded-lg" />
        <div className="h-16 bg-[var(--md-sys-color-surface-container-high)] rounded-lg" />
      </div>
    </div>
  );
}

const BrokerFlowTab = dynamic(() => import("@/components/analysis/BrokerFlowTab"), {
  ssr: false,
  loading: () => <TabSkeleton title="Broker Flow Analysis" />,
});
const CausalityTab = dynamic(() => import("@/components/analysis/CausalityTab"), {
  ssr: false,
  loading: () => <TabSkeleton title="Causality Engine" />,
});
const ValidationTab = dynamic(() => import("@/components/analysis/ValidationTab"), {
  ssr: false,
  loading: () => <TabSkeleton title="Historical Validation" />,
});
const RawTablesTab = dynamic(() => import("@/components/analysis/RawTablesTab"), {
  ssr: false,
  loading: () => <TabSkeleton title="Raw Records" />,
});

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TABS = [
  { id: "Overview", label: "Overview", icon: "ph:chart-line-up-duotone" },
  { id: "Broker Flow", label: "Broker Flow", icon: "ph:arrows-left-right-duotone" },
  { id: "Causality", label: "Causality", icon: "ph:git-commit-duotone" },
  { id: "Validation", label: "Validation", icon: "ph:check-circle-duotone" },
  { id: "Raw Tables", label: "Raw Records", icon: "ph:table-duotone" },
];

export default function TickerPage() {
  const params = useParams();
  const tickerFromUrl = String(params.ticker || "").toUpperCase();
  const { data: session } = useSession();
  
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
    try {
      const ls = localStorage.getItem("investowl_watchlist") || localStorage.getItem("tradepulse_watchlist");
      if (ls) {
        const parsed = JSON.parse(ls);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLocalWatchlist(parsed);
        }
      }
    } catch (e) {}

    // Jika user login dengan Google, tarik watchlist terbaru dari akun mereka
    if (session?.user?.email) {
      fetch(`/api/users/${encodeURIComponent(session.user.email)}/watchlist`)
        .then((res) => res.json())
        .then((d) => {
          if (Array.isArray(d?.watchlist) && d.watchlist.length > 0) {
            setLocalWatchlist(d.watchlist);
            try {
              localStorage.setItem("investowl_watchlist", JSON.stringify(d.watchlist));
              localStorage.setItem("tradepulse_watchlist", JSON.stringify(d.watchlist));
            } catch {}
          }
        })
        .catch(() => {});
    }
  }, [setLocalWatchlist, session?.user?.email]);

  const isBookmarked = localWatchlist.includes(activeTicker);

  const toggleBookmark = () => {
    let nextList: string[];
    if (isBookmarked) {
      nextList = localWatchlist.filter((t) => t !== activeTicker);
    } else {
      nextList = [...localWatchlist, activeTicker];
    }
    setLocalWatchlist(nextList);
    try {
      localStorage.setItem("investowl_watchlist", JSON.stringify(nextList));
      localStorage.setItem("tradepulse_watchlist", JSON.stringify(nextList));
    } catch {}

    // Sinkronkan ke server jika user login
    if (session?.user?.email) {
      fetch(`/api/users/${encodeURIComponent(session.user.email)}/watchlist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlist: nextList }),
      }).catch((e) => console.error("Gagal sinkronisasi bookmark ke server:", e));
    }
  };

  const qs = "?window_days=" + windowDays + (analysisDate ? "&analysis_date=" + analysisDate : "");
  const { data, error, isLoading } = useSWR(
    activeTicker ? "/api/bandar/detail/" + activeTicker + qs : null,
    fetcher,
    { refreshInterval: 60000, dedupingInterval: 30000 }
  );

  if (!activeTicker) {
    return (
      <div className="min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] flex items-center justify-center">
        Pilih emiten untuk melihat analitik kuantitatif
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 transition-colors duration-200">
      <TickerSearch />

      {/* IDENTITAS EMITEN (HEADER CARD) */}
      <div className="mt-2 mb-6 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-mono font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider mb-1">
              <span>BANDARMOLOGY & SMART MONEY DEEP-DIVE</span>
              <span className="opacity-40">•</span>
              <span className="text-[var(--color-positive)] font-bold">LOOKBACK: {windowDays} HARI</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2.5">
                <h1 className="text-3xl sm:text-4xl font-mono font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                  {activeTicker}
                </h1>
                <button
                  onClick={toggleBookmark}
                  className={`p-1.5 sm:p-2 rounded-full border transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center justify-center ${
                    isBookmarked
                      ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-primary)] border-[var(--md-sys-color-primary)]"
                      : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)]/60 hover:text-[var(--md-sys-color-primary)] hover:border-[var(--md-sys-color-primary)]"
                  }`}
                  title={isBookmarked ? `Hapus ${activeTicker} dari Watchlist` : `Simpan ${activeTicker} ke Watchlist`}
                  aria-label={isBookmarked ? `Hapus ${activeTicker} dari Watchlist` : `Simpan ${activeTicker} ke Watchlist`}
                >
                  <Icon 
                    icon={isBookmarked ? "ph:star-fill" : "ph:star-bold"} 
                    width="20" 
                    className={isBookmarked ? "text-amber-500" : ""}
                  />
                </button>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-[var(--md-sys-color-on-surface-variant)]">
                {data?.company?.name || "Bursa Efek Indonesia"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-xl px-3 py-1.5 shadow-2xs">
              Periode: {data?.window_start || "..."} <span className="opacity-50 mx-1">s/d</span> {data?.analysis_date || "..."}
            </span>
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border border-[var(--md-sys-color-outline-variant)]/60">
              {data?.company?.group || "Equities IDX"}
            </span>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-[var(--md-sys-color-on-surface-variant)] text-xs font-mono font-medium mb-4 animate-pulse">
          <Icon icon="ph:spinner-gap-duotone" className="animate-spin" width="16" />
          <span>Memuat data analitik presisi {activeTicker}...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono font-bold rounded-xl mb-4">
          Gagal mengambil data sistem bandarmologi. Pastikan backend FastAPI aktif.
        </div>
      )}

      {/* METRIC CARDS GRID */}
      {data && !data.error && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          <MetricCard 
            label="Conviction Score" 
            value={data.conviction_score != null ? `${data.conviction_score.toFixed(1)}/100` : "-"} 
            note="weighted composite" 
            tone={data.conviction_score} 
          />
          <MetricCard 
            label="Bandar Signal" 
            value={data.signal || "NEUTRAL"} 
            note="selected date" 
            tone={null} 
            accent={signalColor(data.signal_score)} 
          />
          <MetricCard 
            label="5D Return" 
            value={fmtPct(data.ret_5d)} 
            note="price context" 
            tone={data.ret_5d} 
          />
          <MetricCard 
            label="Foreign Net 5D" 
            value={fmtRp(data.foreign_5d)} 
            note="broker summary" 
            tone={data.foreign_5d} 
          />
          <MetricCard 
            label="Top Buyer" 
            value={data.top_buyer?.broker || "-"} 
            note={fmtRp(data.top_buyer?.net)} 
            tone={1} 
          />
          <MetricCard 
            label="Smart Cumulative" 
            value={fmtRp(data.smart_cumulative)} 
            note={`${data.smart_daily?.length || 0} broker days`} 
            tone={data.smart_cumulative} 
          />
        </div>
      )}

      {/* CONTRADICTION ALERTS */}
      {data?.alerts?.length > 0 && (
        <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 shadow-2xs">
          <div className="flex items-center gap-2 mb-1.5 text-rose-500 text-xs font-bold uppercase tracking-wider">
            <Icon icon="ph:warning-circle-bold" width="16" />
            <span>Deteksi Anomali / Kontradiksi Arus Modal</span>
          </div>
          {data.alerts.map((a: string, i: number) => (
            <div key={i} className="text-xs font-medium text-rose-400 flex items-start gap-2 mb-1 last:mb-0">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0"></span>
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* VERDICT READ */}
      {data?.verdict && (
        <div className="mb-6 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-xl p-4 sm:p-5 shadow-2xs relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[var(--md-sys-color-primary)]"></div>
          <div className="pl-2">
            <div className="text-[10px] font-mono font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider mb-1">
              Current Quantitative Read
            </div>
            <div className="text-xs sm:text-sm text-[var(--md-sys-color-on-surface)] leading-relaxed font-medium">
              {data.verdict}
            </div>
          </div>
        </div>
      )}

      {/* MODERN SEGMENTED TABS */}
      <div className="mb-6 border-b border-[var(--md-sys-color-outline-variant)]">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                  isActive
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm"
                    : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]"
                }`}
              >
                <Icon icon={tab.icon} width="16" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT RENDERER */}
      <div className="transition-colors duration-200">
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
        {activeTab === "Raw Tables" && (
          <RawTablesTab ticker={activeTicker} analysisDate={analysisDate} windowDays={windowDays} />
        )}
      </div>
    </div>
  );
}

function MetricCard({ 
  label, 
  value, 
  note, 
  tone, 
  accent 
}: { 
  label: string; 
  value: string; 
  note: string; 
  tone: number | null; 
  accent?: string;
}) {
  let color = "var(--md-sys-color-on-surface)";
  if (accent) color = accent;
  else if (tone !== null && tone !== undefined) color = signedColor(Number(tone));

  return (
    <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] rounded-xl p-3.5 transition-all duration-200 shadow-2xs relative overflow-hidden group">
      <div className="absolute top-0 left-0 bottom-0 w-1 transition-all opacity-80 group-hover:opacity-100" style={{ backgroundColor: color }}></div>
      <div className="pl-2">
        <div className="text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-1 truncate">
          {label}
        </div>
        <div className="text-base sm:text-lg font-mono font-extrabold tracking-tight truncate" style={{ color }}>
          {value}
        </div>
        <div className="text-[10px] font-mono font-medium text-[var(--md-sys-color-on-surface-variant)] truncate mt-1">
          {note}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return <div className="text-[var(--md-sys-color-on-surface-variant)] text-xs font-mono font-bold animate-pulse">Memuat ringkasan overview...</div>;
  if (!data || data.error) return <div className="text-rose-500 text-xs font-mono font-bold">{data?.error || "Tidak ada data"}</div>;

  const chartData = (data.price_chart || []).map((p: any) => {
    const sig = (data.signal_overlay || []).find((s: any) => s.date === p.date);
    return { ...p, signal: sig?.signal || null, signalScore: sig?.score ?? null };
  });

  return (
    <div className="space-y-5">
      {/* 1. Price Chart + Top Brokers */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--md-sys-color-on-surface)] tracking-tight">
                Price, Volume & Signal Overlay
              </h3>
              <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                Korelasi pergerakan harga close terhadap volume harian
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono font-bold">
              <span className="flex items-center gap-1.5 text-amber-500">
                <span className="w-2.5 h-0.5 bg-amber-500"></span> Close
              </span>
              <span className="flex items-center gap-1.5 text-[var(--md-sys-color-on-surface-variant)]">
                <span className="w-2 h-2 bg-[var(--md-sys-color-outline)] rounded-xs"></span> Volume
              </span>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" opacity={0.6} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" domain={["auto", "auto"]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" />
                <Tooltip
                  contentStyle={{ 
                    background: "var(--md-sys-color-surface-container-highest)", 
                    border: "1px solid var(--md-sys-color-outline-variant)", 
                    borderRadius: "12px", 
                    fontSize: "11px", 
                    color: "var(--md-sys-color-on-surface)", 
                    fontWeight: 700 
                  }}
                  labelStyle={{ color: "var(--md-sys-color-on-surface-variant)", fontWeight: 800, marginBottom: "4px" }}
                  formatter={(value: any, name: any) => [fmtRp(Number(value)), String(name)]}
                />
                <Bar yAxisId="right" dataKey="volume" fill="var(--md-sys-color-outline)" opacity={0.3} radius={[3, 3, 0, 0]} />
                <Line yAxisId="left" type="monotone" dataKey="close" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] mb-1 tracking-tight">Top Broker Summary</h3>
            <p className="text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-3">Net buy/sell tanggal analisis</p>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[10px] font-mono uppercase tracking-wider font-bold">
                    <th className="text-left py-2">Side</th>
                    <th className="text-left py-2">Broker</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-right py-2">Net</th>
                    <th className="text-left py-2 pl-3">5D</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.broker_summary || []).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-[var(--md-sys-color-outline-variant)]/60 hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors">
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

          <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] mb-2 tracking-tight">Price Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[10px] font-mono uppercase tracking-wider font-bold">
                    <th className="text-left py-2">Period</th>
                    <th className="text-right py-2">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.price_performance || []).map((row: any, i: number) => (
                    <tr key={i} className="border-b border-[var(--md-sys-color-outline-variant)]/60 hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors">
                      <td className="py-2 text-[var(--md-sys-color-on-surface)] font-medium">{row.period}</td>
                      <td className="py-2 text-right font-mono font-bold" style={{ color: signedColor(row.value) }}>{fmtPct(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Smart Flow + Profile Net Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5">
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm sm:text-base font-bold text-[var(--md-sys-color-on-surface)] mb-4 tracking-tight">Smart-Money Daily Flow</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.smart_daily || []} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" opacity={0.6} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" />
                <Tooltip
                  contentStyle={{ 
                    background: "var(--md-sys-color-surface-container-highest)", 
                    border: "1px solid var(--md-sys-color-outline-variant)", 
                    borderRadius: "12px", 
                    fontSize: "11px", 
                    color: "var(--md-sys-color-on-surface)", 
                    fontWeight: 700 
                  }}
                  labelStyle={{ color: "var(--md-sys-color-on-surface-variant)", fontWeight: 800, marginBottom: "4px" }}
                  formatter={((value: any, name: any) => [fmtRp(Number(value)), String(name)]) as any}
                />
                <Bar
                  yAxisId="left"
                  dataKey="smart_net"
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const color = payload.smart_net >= 0 ? "var(--color-positive)" : "var(--color-negative)";
                    return <rect x={x} y={y} width={width} height={height} fill={color} opacity={0.9} rx={3} />;
                  }}
                />
                <Line yAxisId="right" type="monotone" dataKey="cumulative_net" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                <ReferenceLine yAxisId="left" y={0} stroke="var(--md-sys-color-outline)" strokeWidth={1} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm sm:text-base font-bold text-[var(--md-sys-color-on-surface)] mb-4 tracking-tight">Participant Profile Net Flow</h3>
          {(data.profile_flow || []).length === 0 ? (
            <p className="text-xs font-mono font-medium text-[var(--md-sys-color-on-surface-variant)]">Tidak ada arus profil transaksi untuk periode ini.</p>
          ) : (
            <div className="space-y-4">
              {(data.profile_flow || []).map((row: any, i: number) => {
                const maxAbs = Math.max(...(data.profile_flow || []).map((r: any) => Math.abs(r.net)), 1);
                const width = Math.max(3, (Math.abs(row.net) / maxAbs) * 100);
                
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-bold uppercase tracking-wider" style={{ color: getProfileTextColor(row.label) }}>{row.label}</span>
                      <span className="font-mono font-bold" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</span>
                    </div>
                    <div className="h-2 bg-[var(--md-sys-color-surface-container-high)] rounded-full overflow-hidden border border-[var(--md-sys-color-outline-variant)]">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: width + "%", backgroundColor: signedColor(row.net) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* 3. Broker Detail by Profile */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 shadow-xs">
        <h3 className="text-sm sm:text-base font-bold text-[var(--md-sys-color-on-surface)] mb-4 tracking-tight">Broker Detail by Profile Breakdown</h3>
        {(data.profile_broker_detail || []).length === 0 ? (
          <p className="text-xs font-mono font-medium text-[var(--md-sys-color-on-surface-variant)]">Tidak ada rincian broker untuk periode ini.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[10px] font-mono uppercase tracking-wider font-bold">
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
                  <tr key={i} className="border-b border-[var(--md-sys-color-outline-variant)]/60 hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors">
                    <td className="py-2.5 pr-3 font-bold uppercase" style={{ color: getProfileTextColor(row.profile) }}>{row.profile}</td>
                    <td className="py-2.5 pr-3 text-[var(--md-sys-color-on-surface)] font-extrabold font-mono">{row.broker}</td>
                    <td className="py-2.5 pr-3 text-[var(--md-sys-color-on-surface-variant)] font-medium">{row.type}</td>
                    <td className="py-2.5 pr-3 text-right font-mono font-bold" style={{ color: "var(--color-positive)" }}>{fmtRp(row.buy)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono font-bold" style={{ color: "var(--color-negative)" }}>{fmtRp(row.sell)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono font-bold" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.freq?.toLocaleString("id-ID") || 0}</td>
                    <td className="py-2.5 pr-3 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.days || 0}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{fmtRp(row.avg_value_tx)}</td>
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
