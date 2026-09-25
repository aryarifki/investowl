"use client";

import React, { useState, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Icon } from "@iconify/react";
import { useAppStore } from "@/store/useAppStore";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const UNIVERSES = [
  "watchlist", "idx80", "lq45", "idx_high_dividend", "idx_bumn", 
  "idx_smc", "esg_kehati", "idxenergy", "idxtrans", "idxinfra", 
  "idxtechno", "idxpropert", "idxfinance", "idxhealth", "idxcyclic", 
  "idxnoncyc", "idxindust", "idxbasic", "bisnis-27"
];
const WINDOWS = [20, 30, 60, 90, 180];
const HORIZONS = [1, 3, 5, 10];

export default function Sidebar() {
  const { mutate } = useSWRConfig();
  const { data: session } = useSession();
  const pathname = usePathname();

  const { 
    sidebarOpen, setSidebarOpen, activeTicker,
    universe, setUniverse, analysisDate, setAnalysisDate,
    windowDays, setWindowDays, horizon, setHorizon,
    minEvents, setMinEvents, minNetBuy, setMinNetBuy,
    localWatchlist, setLocalWatchlist
  } = useAppStore();

  const [universeOpen, setUniverseOpen] = useState(false);
  const [backfillStart, setBackfillStart] = useState("");
  const [backfillEnd, setBackfillEnd] = useState("");
  const [pipelineRunning, setPipelineRunning] = useState<string | null>(null);
  const [isRefreshingMaster, setIsRefreshingMaster] = useState(false);

  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  useEffect(() => {
    try {
      const ls = localStorage.getItem("tradepulse_watchlist");
      if (ls) setLocalWatchlist(JSON.parse(ls));
    } catch {
      // Ignore localStorage parse errors
    }
  }, [setLocalWatchlist]);

  const { data: statusData, mutate: mutateStatus } = useSWR("/api/bandar/system-status", fetcher);
  const { data: datesData } = useSWR(activeTicker ? "/api/bandar/dates/" + activeTicker : null, fetcher);
  const availableDates: string[] = React.useMemo(() => datesData?.dates || [], [datesData?.dates]);
  const latestAvailableDate = availableDates.length > 0 ? availableDates[availableDates.length - 1] : null;

  const defaultBackfillEnd = latestAvailableDate || "";
  const defaultBackfillStart = React.useMemo(() => {
    if (!latestAvailableDate) return "";
    const d = new Date(latestAvailableDate);
    d.setDate(d.getDate() - 90);
    return d.toISOString().split("T")[0];
  }, [latestAvailableDate]);

  const currentBackfillStart = backfillStart || defaultBackfillStart;
  const currentBackfillEnd = backfillEnd || defaultBackfillEnd;

  useEffect(() => {
    if (latestAvailableDate && (!analysisDate || !availableDates.includes(analysisDate))) {
      setAnalysisDate(latestAvailableDate);
    }
  }, [latestAvailableDate, analysisDate, availableDates, setAnalysisDate]);

  if (pathname === "/login" || pathname === "/pending") return null;

  const handleCalendarChange = (selected: string) => {
    if (!selected || availableDates.length === 0) return;
    if (availableDates.includes(selected)) {
      setAnalysisDate(selected);
      return;
    }
    const priorDates = availableDates.filter((d) => d <= selected);
    if (priorDates.length > 0) {
      setAnalysisDate(priorDates[priorDates.length - 1]);
    } else {
      setAnalysisDate(availableDates[0]);
    }
  };

  const handleRefreshMaster = async () => {
    if (isRefreshingMaster) return;
    setIsRefreshingMaster(true);
    try {
      const res = await fetch("/api/bandar/universe/refresh", { method: "POST" });
      const json = await res.json();
      if (json.status === "success") {
        await mutate("/api/bandar/universe/all");
        await mutateStatus();
        alert(`Sukses: ${json.message}`);
      } else {
        alert(`Gagal: ${json.error || "Gagal refresh master tickers"}`);
      }
    } catch (e: unknown) {
      alert(`Error koneksi: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsRefreshingMaster(false);
    }
  };

  const runPipeline = async (type: "today" | "missing" | "backfill") => {
    setPipelineRunning(type);
    try {
      const payload: { universe_mode: string; tickers?: string[]; start_date?: string; end_date?: string } = { universe_mode: universe };
      if (universe === "watchlist" && localWatchlist.length > 0) {
          payload.tickers = localWatchlist;
      }
      let res: Response;
      if (type === "today") {
        res = await fetch("/api/bandar/pipeline/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else if (type === "missing") {
        payload.start_date = analysisDate || statusData?.latest_date;
        payload.end_date = new Date().toISOString().split("T")[0];
        res = await fetch("/api/bandar/pipeline/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        payload.start_date = currentBackfillStart;
        payload.end_date = currentBackfillEnd;
        res = await fetch("/api/bandar/pipeline/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const json = await res.json();
      if (res.ok) {
        alert("Pipeline selesai dijalankan.");
        mutate(() => true, undefined, { revalidate: true });
      } else {
        alert("Pipeline error: " + (json.detail || "Gagal"));
      }
    } catch (e: unknown) {
      alert("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPipelineRunning(null);
    }
  };

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      <aside className={
        "fixed lg:sticky top-0 lg:top-[60px] z-[70] h-screen lg:h-[calc(100vh-60px)] w-72 bg-[var(--md-sys-color-surface-container-low)] border-r border-[var(--md-sys-color-outline-variant)] overflow-y-auto " +
        "transition-transform duration-300 ease-in-out shadow-lg lg:shadow-none " +
        (sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")
      }>
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-extrabold text-[var(--md-sys-color-primary)] uppercase tracking-[0.2em] mb-1">IDX Smart Flow</div>
              <h2 className="text-lg font-bold text-[var(--md-sys-color-on-surface)] tracking-tight">Controls</h2>
            </div>
            <button 
              onClick={handleRefreshMaster} 
              disabled={isRefreshingMaster}
              title="Sinkronisasi Master Tickers"
              className="p-2.5 bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] transition-all active:scale-95 shadow-sm"
            >
              <Icon icon="ph:arrows-clockwise-duotone" width="18" className={isRefreshingMaster ? "animate-spin text-[var(--md-sys-color-primary)]" : ""} />
            </button>
          </div>

          <div className="space-y-5">
            {/* UNIVERSE FILTER */}
            <div>
              <label className="block text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-2">Universe Filter</label>
              <div className="relative">
                <button
                  onClick={() => setUniverseOpen(!universeOpen)}
                  className="w-full flex items-center justify-between bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--md-sys-color-on-surface)] outline-none hover:border-[var(--md-sys-color-primary)] transition-colors shadow-sm"
                >
                  <span>{universe.toUpperCase()}</span>
                  <Icon icon={universeOpen ? "ph:caret-up-bold" : "ph:caret-down-bold"} className="text-[var(--md-sys-color-primary)]" />
                </button>
                
                {universeOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUniverseOpen(false)}></div>
                    <div className="absolute top-full left-0 w-full mt-2 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-[24px] shadow-xl z-50 max-h-60 overflow-y-auto scrollbar-thin p-1">
                      {UNIVERSES.map((u) => (
                        <button
                          key={u}
                          onClick={() => {
                            setUniverse(u);
                            setUniverseOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-[11px] font-bold tracking-wider rounded-[20px] transition-colors ${
                            universe === u ? "text-[var(--md-sys-color-on-primary-container)] bg-[var(--md-sys-color-primary-container)]" : "text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                          }`}
                        >
                          {u.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mt-2 flex flex-col gap-1 bg-[var(--md-sys-color-surface-container-highest)] p-3 rounded-[20px] border border-[var(--md-sys-color-outline-variant)] shadow-sm">
                <span className="flex items-center gap-2 font-mono font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <b className="text-[var(--md-sys-color-on-surface)]">{statusData?.active_tickers ?? "..."}</b> emiten aktif
                </span>
                <span className="font-mono text-[9px] flex items-center gap-2">
                  <Icon icon="ph:clock-duotone" width="12"/>
                  Update BEI: <b className="text-[var(--md-sys-color-on-surface)]">{statusData?.latest_date ?? "-"}</b>
                </span>
              </div>
            </div>

            {/* ANALYSIS DATE */}
            <div>
              <label className="block text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-2">Analysis Date</label>
              <input
                type="date"
                className="w-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] transition-colors shadow-sm"
                value={analysisDate}
                max={availableDates[availableDates.length - 1] || statusData?.latest_date || ""}
                onChange={(e) => handleCalendarChange(e.target.value)}
              />
            </div>

            {/* WINDOW & HORIZON */}
            <div>
              <label className="block text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-2">Broker Window</label>
              <select className="w-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] transition-colors shadow-sm appearance-none" value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
                {WINDOWS.map((w) => <option key={w} value={w}>{w} days</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-2">Validation Horizon</label>
              <select className="w-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] transition-colors shadow-sm appearance-none" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                {HORIZONS.map((h) => <option key={h} value={h}>{h} days</option>)}
              </select>
            </div>

            {/* MIN EVENTS & BUY */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-2">Min Events</label>
                <input type="number" min={3} max={30} className="w-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] transition-colors shadow-sm" value={minEvents} onChange={(e) => setMinEvents(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-2">Min Buy (B)</label>
                <input type="number" min={0} step={0.5} className="w-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] transition-colors shadow-sm" value={minNetBuy} onChange={(e) => setMinNetBuy(Number(e.target.value))} />
              </div>
            </div>
          </div>

          <hr className="border-[var(--md-sys-color-outline-variant)]" />

          {/* PIPELINE ACTIONS */}
          <div className="space-y-3">
            <button onClick={() => runPipeline("today")} disabled={pipelineRunning !== null} className="w-full bg-[var(--md-sys-color-surface-container-highest)] hover:bg-[var(--md-sys-color-surface-variant)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-5 py-3 text-sm font-bold text-[var(--md-sys-color-on-surface)] transition-all active:scale-95 disabled:opacity-50 text-left flex items-center justify-between shadow-sm">
              <span>Run latest pipeline</span>
              {pipelineRunning === "today" ? <Icon icon="ph:spinner-gap" className="animate-spin text-[var(--md-sys-color-primary)]" width="18"/> : <Icon icon="ph:play-bold" width="16" className="text-[var(--md-sys-color-on-surface-variant)]"/>}
            </button>

            <button onClick={() => runPipeline("missing")} disabled={pipelineRunning !== null} className="w-full bg-[var(--md-sys-color-surface-container-highest)] hover:bg-[var(--md-sys-color-surface-variant)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-5 py-3 text-sm font-bold text-[var(--md-sys-color-on-surface)] transition-all active:scale-95 disabled:opacity-50 text-left flex items-center justify-between shadow-sm">
              <span>Fetch missing dates</span>
              {pipelineRunning === "missing" ? <Icon icon="ph:spinner-gap" className="animate-spin text-[var(--md-sys-color-primary)]" width="18"/> : <Icon icon="ph:cloud-arrow-down-bold" width="16" className="text-[var(--md-sys-color-on-surface-variant)]"/>}
            </button>

            <div className="pt-2 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-[24px] p-4 shadow-sm">
              <label className="block text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-2">Backfill Range</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <input
                  type="date"
                  className="w-full bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-3 py-1.5 text-xs font-medium text-[var(--md-sys-color-on-surface)] transition-colors"
                  value={currentBackfillStart}
                  onChange={(e) => setBackfillStart(e.target.value)}
                />
                <input
                  type="date"
                  className="w-full bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-3 py-1.5 text-xs font-medium text-[var(--md-sys-color-on-surface)] transition-colors"
                  value={currentBackfillEnd}
                  onChange={(e) => setBackfillEnd(e.target.value)}
                />
              </div>
              <button 
                onClick={() => runPipeline("backfill")}
                disabled={pipelineRunning !== null || !currentBackfillStart || !currentBackfillEnd}
                className="w-full bg-[var(--md-sys-color-primary)] hover:opacity-90 text-[var(--md-sys-color-on-primary)] rounded-full px-4 py-2.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {pipelineRunning === "backfill" ? <Icon icon="ph:spinner-gap" className="animate-spin" width="16"/> : <Icon icon="ph:database-bold" width="16"/>}
                Execute Backfill
              </button>
            </div>
          </div>

          {isAdmin && (
            <>
              <hr className="border-[var(--md-sys-color-outline-variant)]" />
              <div>
                <label className="block text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-2">Management</label>
                <Link
                  href="/admin"
                  className="w-full flex items-center justify-between bg-[var(--md-sys-color-primary-container)] hover:opacity-90 border border-[var(--md-sys-color-primary)] rounded-full px-5 py-3 text-sm font-bold text-[var(--md-sys-color-on-primary-container)] transition-all active:scale-95 shadow-sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon icon="ph:shield-check-fill" width="20" />
                    <span>User Admin</span>
                  </div>
                  <Icon icon="ph:arrow-right-bold" width="14" />
                </Link>
              </div>
            </>
          )}
          
        </div>
      </aside>
    </>
  );
}
