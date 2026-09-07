"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { List, X, Database, ChartBar, FlowArrow, Graph, CheckCircle, MagnifyingGlass, Table, House, Globe, Buildings, Lightning, ArrowsClockwise } from "@phosphor-icons/react";
import { ModeToggle } from "@/components/mode-toggle";
import { MetricCard, fmtRp, fmtPct, signedColor } from "@/components/metric-card";
import { OverviewTab } from "@/components/tabs/overview-tab";
import { BrokerFlowTab } from "@/components/tabs/brokerflow-tab";
import { CausalityTab } from "@/components/tabs/causality-tab";
import { ValidationTab } from "@/components/tabs/validation-tab";
import { ScreenerTab } from "@/components/tabs/screener-tab";
import { RawTablesTab } from "@/components/tabs/rawtables-tab";
import { PlaceholderPage } from "@/components/pages/placeholder-page";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DASHBOARD_TABS = [
  { name: "Overview", icon: ChartBar },
  { name: "Broker Flow", icon: FlowArrow },
  { name: "Causality", icon: Graph },
  { name: "Validation", icon: CheckCircle },
  { name: "Screener", icon: MagnifyingGlass },
  { name: "Raw Tables", icon: Table },
];

const BOTTOM_NAV = [
  { name: "Dashboard", icon: House },
  { name: "Broker", icon: FlowArrow },
  { name: "Foreign", icon: Globe },
  { name: "Konglo", icon: Buildings },
  { name: "Signal", icon: Lightning },
];

const WINDOWS = [20, 30, 60, 90, 180];
const HORIZONS = [1, 3, 5, 10];

export default function TickerPage() {
  const [ticker, setTicker] = useState("BBCA");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState("Dashboard");
  const [activeTab, setActiveTab] = useState("Overview");
  const [windowDays, setWindowDays] = useState(60);
  const [horizon, setHorizon] = useState(10);
  const [minEvents, setMinEvents] = useState(5);
  const [minNetBuy, setMinNetBuy] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{latest_broker_date: string | null, latest_price_date: string | null, active_count: number | null} | null>(null);

  const { data: tickersData, mutate: mutateTickers } = useSWR("http://127.0.0.1:8080/api/v1/stocks/available_tickers", fetcher);
  const availableTickers = tickersData?.tickers || [];
  const tickerCount = syncInfo?.active_count || tickersData?.count || availableTickers.length;

  const filteredTickers = useMemo(() => {
    if (!searchQuery) return availableTickers.slice(0, 8);
    return availableTickers.filter((t: string) => t.includes(searchQuery.toUpperCase())).slice(0, 8);
  }, [searchQuery, availableTickers]);

  const qs = `?lookback_days=${windowDays}&horizon=${horizon}&min_events=${minEvents}&min_net_buy_b=${minNetBuy}`;
  const { data, error, isLoading } = useSWR(
    ticker ? `http://127.0.0.1:8080/api/v1/dashboard/${ticker}/dashboard${qs}` : null,
    fetcher
  );

  const handleSelectTicker = (t: string) => {
    setTicker(t);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleSyncStocks = async () => {
    setIsSyncing(true);
    setSyncInfo(null);
    try {
      const res = await fetch("http://127.0.0.1:8080/api/v1/stocks/sync_latest_data", { method: "POST" });
      const syncData = await res.json();
      setSyncInfo({
        latest_broker_date: syncData.latest_broker_date,
        latest_price_date: syncData.latest_price_date,
        active_count: syncData.active_count
      });
      mutateTickers();
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const scoreTone = data?.conviction_score >= 70 ? "positive" : data?.conviction_score >= 40 ? "warning" : "negative";

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#E6E0E9] flex pb-16 lg:pb-0">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:sticky top-0 z-50 h-screen w-72 bg-[#151B26] border-r border-[#232B3B] overflow-y-auto transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-4 space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">IDX Broker Flow</div>
              <h2 className="text-sm font-bold">Controls</h2>
            </div>
            <button className="lg:hidden p-2 rounded hover:bg-[#232B3B]" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Analysis Date</label>
            <select className="w-full bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm">
              <option>{data?.analysis_date || "Latest Available"}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Broker Window</label>
            <select className="w-full bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm" value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
              {WINDOWS.map((w) => <option key={w} value={w}>{w} calendar days</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Validation Horizon</label>
            <select 
              className="w-full bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm" 
              value={horizon} 
              onChange={(e) => setHorizon(Number(e.target.value))}
            >
              {HORIZONS.map((h) => <option key={h} value={h}>{h} trading days</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Min Broker Events</label>
            <input 
              type="number" 
              min={3} 
              max={30} 
              className="w-full bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm" 
              value={minEvents} 
              onChange={(e) => setMinEvents(Number(e.target.value))} 
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Min Net Buy, Rp B</label>
            <input 
              type="number" 
              min={0} 
              step={0.5} 
              className="w-full bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm" 
              value={minNetBuy} 
              onChange={(e) => setMinNetBuy(Number(e.target.value))} 
            />
          </div>
          
          <div>
            <button 
              onClick={handleSyncStocks} 
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <ArrowsClockwise size={16} weight="bold" className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing IDX..." : "Sync Latest Data"}
            </button>
            {syncInfo && (
              <div className="mt-2 p-2 bg-[#232B3B] rounded text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Active Stocks:</span>
                  <span className="font-mono font-bold text-blue-500">{syncInfo.active_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Latest Broker DB:</span>
                  <span className="font-mono font-bold text-blue-500">{syncInfo.latest_broker_date || "Empty"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Latest Price DB:</span>
                  <span className="font-mono font-bold text-blue-500">{syncInfo.latest_price_date || "Empty"}</span>
                </div>
              </div>
            )}
          </div>

          <hr className="border-[#232B3B]" />
          
          <div className="space-y-2">
            <button className="w-full bg-[#0B0E14] hover:opacity-80 border border-[#232B3B] rounded-lg px-3 py-2 text-xs font-semibold transition-colors">
              Run latest pipeline to today
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 bg-[#151B26] border-b border-[#232B3B] sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-[#0B0E14] border border-[#232B3B] lg:hidden">
            <List size={20} />
          </button>
          <span className="font-bold text-lg">{activePage === "Dashboard" ? ticker : activePage}</span>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs text-[#64748b]">
              <Database size={16} weight="bold" />
              <span>DB Date: {data?.analysis_date || "..."}</span>
            </div>
            <div className="hidden md:flex items-center gap-1 text-xs text-[#64748b] bg-[#232B3B] px-2 py-1 rounded-full">
              <ChartBar size={14} weight="bold" />
              <span>Active: {tickerCount}</span>
            </div>
            <ModeToggle />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-4">
            
            {activePage === "Dashboard" && (
              <>
                <div className="mb-5 bg-[#151B26] border border-[#232B3B] rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">IDX Broker Flow Research</div>
                      <h1 className="text-xl sm:text-2xl font-bold">Smart Money Dashboard</h1>
                    </div>
                    {/* KOLOM PENCARIAN KEMBALI DI HEADER */}
                    <div className="relative w-full sm:w-64">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]">
                        <MagnifyingGlass size={16} weight="bold" />
                      </div>
                      <input 
                        type="text"
                        placeholder="Search ticker..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value.toUpperCase()); setShowDropdown(true); }}
                        onFocus={() => setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                        className="w-full bg-[#0B0E14] border border-[#232B3B] rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                      {showDropdown && filteredTickers.length > 0 && (
                        <div className="absolute top-full mt-1 w-full bg-[#151B26] border border-[#232B3B] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                          {filteredTickers.map((t: string) => (
                            <button key={t} onClick={() => handleSelectTicker(t)} className="w-full text-left px-4 py-2 text-sm hover:bg-[#232B3B] transition-colors">
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="text-[11px] font-semibold bg-[#232B3B] border border-[#232B3B] rounded-full px-3 py-1.5 shadow-sm">
                      Ticker: <span className="text-blue-500">{ticker}</span>
                    </span>
                    <span className="text-[11px] font-semibold bg-[#232B3B] border border-[#232B3B] rounded-full px-3 py-1.5 shadow-sm">
                      Window {data?.window_start || "..."} to {data?.analysis_date || "..."}
                    </span>
                  </div>
                </div>

                {isLoading && <div className="text-[#64748b] text-sm mb-4">Loading data for {ticker}...</div>}
                {error && <div className="text-red-500 text-sm mb-4">Error loading data. Make sure FastAPI is running.</div>}

                {data && !error && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
                    <MetricCard label="Conviction Score" value={`${data.conviction_score?.toFixed(1) || "-"}/100`} note="weighted model" tone={scoreTone} title={data.breakdown} />
                    <MetricCard label="Signal" value={data.signal || "-"} note="selected date" tone={null} accent={data.signal_score >= 1 ? "#0f9f6e" : data.signal_score <= -1 ? "#dc3545" : "#64748b"} />
                    <MetricCard label="5D Return" value={fmtPct(data.ret_5d)} note="price context" tone={data.ret_5d >= 0 ? "positive" : "negative"} />
                    <MetricCard label="Foreign Net 5D" value={fmtRp(data.foreign_5d)} note="broker summary" tone={data.foreign_5d >= 0 ? "positive" : "negative"} />
                    <MetricCard label="Top Buyer" value={data.top_buyer?.broker || "-"} note={fmtRp(data.top_buyer?.net)} tone="positive" />
                    <MetricCard label="Smart Cumulative" value={fmtRp(data.smart_cumulative)} note={`${data.smart_daily?.length || 0} broker days`} tone={data.smart_cumulative >= 0 ? "positive" : "negative"} />
                  </div>
                )}

                {data?.alerts?.length > 0 && (
                  <div className="mb-4 bg-amber-950/30 border border-amber-800/50 rounded-xl px-4 py-3">
                    {data.alerts.map((a: string, i: number) => (
                      <div key={i} className="text-sm text-amber-300">{a}</div>
                    ))}
                  </div>
                )}

                {data?.verdict && (
                  <div className="mb-4 bg-blue-950/30 border-l-4 border-blue-500 rounded-r-xl px-4 py-3">
                    <div className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Current read</div>
                    <div className="text-sm text-[#E6E0E9] leading-relaxed">{data.verdict}</div>
                  </div>
                )}

                <div className="border-b border-[#232B3B] mb-4 mt-6">
                  <div className="flex gap-1 overflow-x-auto">
                    {DASHBOARD_TABS.map((tab) => (
                      <button
                        key={tab.name}
                        onClick={() => setActiveTab(tab.name)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-t-lg transition-colors ${
                          activeTab === tab.name
                            ? "text-blue-500 border-b-2 border-blue-500"
                            : "text-[#64748b] hover:text-[#E6E0E9]"
                        }`}
                      >
                        <tab.icon size={16} weight="bold" />
                        {tab.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pb-8">
                  {activeTab === "Overview" && data && !error && <OverviewTab data={data} />}
                  {activeTab === "Broker Flow" && <BrokerFlowTab ticker={ticker} windowDays={windowDays} />}
                  {activeTab === "Causality" && data && !error && <CausalityTab data={data} />}
                  {activeTab === "Validation" && <ValidationTab />}
                  {activeTab === "Screener" && <ScreenerTab />}
                  {activeTab === "Raw Tables" && <RawTablesTab />}
                </div>
              </>
            )}

            {activePage === "Broker" && (
              <PlaceholderPage title="Broker Analysis" description="Halaman ini akan berisi analisis mendalam per broker (akumulasi/distribusi historis)." />
            )}
            {activePage === "Foreign" && (
              <PlaceholderPage title="Foreign Flow Analysis" description="Halaman ini akan berisi analisis pergerakan dana asing secara menyeluruh." />
            )}
            {activePage === "Konglo" && (
              <PlaceholderPage title="Konglomerasi Movement" description="Halaman ini akan menganalisis pergerakan saham berdasarkan grup konglomerasi." />
            )}
            {activePage === "Signal" && (
              <PlaceholderPage title="Custom Signal Builder" description="Halaman ini untuk membuat dan backtest sinyal trading kustom Anda." />
            )}

          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#151B26] border-t border-[#232B3B] flex justify-around items-center h-16">
        {BOTTOM_NAV.map((nav) => {
          const Icon = nav.icon;
          const isActive = activePage === nav.name;
          return (
            <button
              key={nav.name}
              onClick={() => setActivePage(nav.name)}
              className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors ${
                isActive ? "text-blue-500" : "text-[#64748b]"
              }`}
            >
              <Icon size={22} weight={isActive ? "fill" : "regular"} />
              <span className="mt-0.5">{nav.name}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
