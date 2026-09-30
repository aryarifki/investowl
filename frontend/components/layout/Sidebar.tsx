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
    localWatchlist, setLocalWatchlist,
    setCacheLoading
  } = useAppStore();

  const [universeOpen, setUniverseOpen] = useState(false);
  const [backfillStart, setBackfillStart] = useState("");
  const [backfillEnd, setBackfillEnd] = useState("");
  const [pipelineRunning, setPipelineRunning] = useState<string | null>(null);
  const [isRefreshingMaster, setIsRefreshingMaster] = useState(false);

  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  useEffect(() => {
    try {
      const ls = localStorage.getItem("investowl_watchlist") || localStorage.getItem("tradepulse_watchlist");
      if (ls) setLocalWatchlist(JSON.parse(ls));
    } catch {
      // Ignore localStorage parse errors
    }
  }, [setLocalWatchlist]);

  const { data: statusData, mutate: mutateStatus } = useSWR("/api/bandar/system-status", fetcher);
  const { data: datesData } = useSWR(activeTicker ? `/api/bandar/dates/${activeTicker}` : null, fetcher);
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
    setCacheLoading({
      isOpen: true,
      title: "Pembaruan Master Tickers & Cache",
      step: "Mengunduh dan memperbarui daftar universe ticker emiten...",
      detail: "POST /api/bandar/universe/refresh",
      progress: 30,
      isSuccess: false,
    });
    try {
      const res = await fetch("/api/bandar/universe/refresh", { method: "POST" });
      const json = await res.json();
      if (json.status === "success") {
        setCacheLoading({
          step: "Membersihkan cache aplikasi untuk memuat universe baru...",
          detail: "POST /api/logs/cache/purge?pattern=*",
          progress: 75,
        });
        await fetch("/api/logs/cache/purge?pattern=*", { method: "POST" });
        await mutate("/api/bandar/universe/all");
        await mutateStatus();
        await mutate(() => true, undefined, { revalidate: true });

        setCacheLoading({
          step: `Sukses: ${json.message || "Master tickers berhasil diperbarui!"}`,
          detail: "Status: 200 OK — Cache Invalidated",
          progress: 100,
          isSuccess: true,
        });
        setTimeout(() => setCacheLoading({ isOpen: false, isSuccess: false }), 800);
      } else {
        setCacheLoading({
          step: `Gagal: ${json.error || "Gagal refresh master tickers"}`,
          detail: "Status: Error",
          progress: 100,
          isSuccess: false,
        });
        setTimeout(() => setCacheLoading({ isOpen: false }), 1200);
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setCacheLoading({
        step: `Error koneksi: ${errMsg}`,
        detail: "Status: Connection Failed",
        progress: 100,
        isSuccess: false,
      });
      setTimeout(() => setCacheLoading({ isOpen: false }), 1500);
    } finally {
      setIsRefreshingMaster(false);
    }
  };

  const runPipeline = async (type: "today" | "missing" | "backfill") => {
    setPipelineRunning(type);
    setCacheLoading({
      isOpen: true,
      title: "Menjalankan Pipeline Otomasi & Sinkronisasi",
      step: `Memulai eksekusi pipeline [${type.toUpperCase()}]...`,
      detail: `POST /api/bandar/pipeline/${type === "today" ? "run" : "backfill"}`,
      progress: 35,
      isSuccess: false,
    });
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
        setCacheLoading({
          step: "Membersihkan cache aplikasi pasca eksekusi pipeline...",
          detail: "POST /api/logs/cache/purge?pattern=*",
          progress: 80,
        });
        await fetch("/api/logs/cache/purge?pattern=*", { method: "POST" });
        await mutate(() => true, undefined, { revalidate: true });

        setCacheLoading({
          step: "Pipeline selesai dan seluruh cache berhasil dimuat ulang!",
          detail: "Status: 200 OK — Pipeline & Cache Synced",
          progress: 100,
          isSuccess: true,
        });
        setTimeout(() => setCacheLoading({ isOpen: false, isSuccess: false }), 800);
      } else {
        setCacheLoading({
          step: `Pipeline error: ${json.detail || "Gagal menjalankan pipeline"}`,
          detail: "Status: Execution Error",
          progress: 100,
          isSuccess: false,
        });
        setTimeout(() => setCacheLoading({ isOpen: false }), 1500);
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setCacheLoading({
        step: `Error: ${errMsg}`,
        detail: "Status: Connection Failed",
        progress: 100,
        isSuccess: false,
      });
      setTimeout(() => setCacheLoading({ isOpen: false }), 1500);
    } finally {
      setPipelineRunning(null);
    }
  };

  return (
    <>
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-xs" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}
      
      <aside className={
        "fixed top-0 bottom-0 left-0 z-[70] h-screen w-80 bg-[var(--md-sys-color-surface-container-low)] border-r border-[var(--md-sys-color-outline-variant)] overflow-y-auto " +
        "transition-transform duration-200 ease-in-out shadow-2xl " +
        (sidebarOpen ? "translate-x-0" : "-translate-x-full")
      }>
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--md-sys-color-outline-variant)]">
            <div className="flex items-center gap-2">
              <Icon icon="ph:sliders-horizontal-duotone" width="20" className="text-[var(--md-sys-color-primary)]" />
              <div>
                <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] tracking-tight">Parameters & Pipeline</h2>
                <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">Konfigurasi Model Kuantitatif</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleRefreshMaster} 
                disabled={isRefreshingMaster}
                title="Sinkronisasi Master Tickers BEI"
                className="p-1.5 bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-lg text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] transition-all cursor-pointer"
              >
                <Icon icon="ph:arrows-clockwise-duotone" width="16" className={isRefreshingMaster ? "animate-spin text-[var(--md-sys-color-primary)]" : ""} />
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] transition-colors cursor-pointer"
                title="Tutup Panel"
              >
                <Icon icon="ph:x-bold" width="16" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* UNIVERSE FILTER */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-1.5">Universe Filter</label>
              <div className="relative">
                <button
                  onClick={() => setUniverseOpen(!universeOpen)}
                  className="w-full flex items-center justify-between bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] rounded-lg px-3.5 py-2 text-xs font-semibold text-[var(--md-sys-color-on-surface)] outline-none transition-colors cursor-pointer"
                >
                  <span className="font-mono">{universe.toUpperCase()}</span>
                  <Icon icon={universeOpen ? "ph:caret-up-bold" : "ph:caret-down-bold"} className="text-[var(--md-sys-color-primary)]" width="14" />
                </button>
                
                {universeOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUniverseOpen(false)}></div>
                    <div className="absolute top-full left-0 w-full mt-1.5 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto p-1">
                      {UNIVERSES.map((u) => (
                        <button
                          key={u}
                          onClick={() => {
                            setUniverse(u);
                            setUniverseOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                            universe === u 
                              ? "text-[var(--md-sys-color-on-primary-container)] bg-[var(--md-sys-color-primary-container)] font-bold" 
                              : "text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                          }`}
                        >
                          {u.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] mt-2 flex flex-col gap-1 bg-[var(--md-sys-color-surface-container)] p-2.5 rounded-lg border border-[var(--md-sys-color-outline-variant)]">
                <span className="flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <b className="text-[var(--md-sys-color-on-surface)]">{statusData?.active_tickers ?? "..."}</b> emiten aktif
                </span>
                <span className="font-mono text-[9px] flex items-center gap-1.5">
                  <Icon icon="ph:clock-duotone" width="12"/>
                  Update BEI: <b className="text-[var(--md-sys-color-on-surface)]">{statusData?.latest_date ?? "-"}</b>
                </span>
              </div>
            </div>

            {/* ANALYSIS DATE */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-1.5">Analysis Date</label>
              <input
                type="date"
                className="w-full bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] focus:border-[var(--md-sys-color-primary)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--md-sys-color-on-surface)] outline-none transition-colors"
                value={analysisDate}
                max={availableDates[availableDates.length - 1] || statusData?.latest_date || ""}
                onChange={(e) => handleCalendarChange(e.target.value)}
              />
            </div>

            {/* WINDOW & HORIZON */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-1.5">Broker Window</label>
                <select 
                  className="w-full bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-lg px-2.5 py-2 text-xs font-mono text-[var(--md-sys-color-on-surface)] outline-none cursor-pointer"
                  value={windowDays} 
                  onChange={(e) => setWindowDays(Number(e.target.value))}
                >
                  {WINDOWS.map((w) => <option key={w} value={w}>{w} Hari</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-1.5">Validation</label>
                <select 
                  className="w-full bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-lg px-2.5 py-2 text-xs font-mono text-[var(--md-sys-color-on-surface)] outline-none cursor-pointer"
                  value={horizon} 
                  onChange={(e) => setHorizon(Number(e.target.value))}
                >
                  {HORIZONS.map((h) => <option key={h} value={h}>{h} days</option>)}
                </select>
              </div>
            </div>

            {/* MIN EVENTS & BUY */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-1.5">Min Events</label>
                <input 
                  type="number" 
                  min={3} 
                  max={30} 
                  className="w-full bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-lg px-2.5 py-2 text-xs font-mono text-[var(--md-sys-color-on-surface)] outline-none" 
                  value={minEvents} 
                  onChange={(e) => setMinEvents(Number(e.target.value))} 
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-1.5">Min Buy (B)</label>
                <input 
                  type="number" 
                  min={0} 
                  step={0.5} 
                  className="w-full bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-lg px-2.5 py-2 text-xs font-mono text-[var(--md-sys-color-on-surface)] outline-none" 
                  value={minNetBuy} 
                  onChange={(e) => setMinNetBuy(Number(e.target.value))} 
                />
              </div>
            </div>
          </div>

          <hr className="border-[var(--md-sys-color-outline-variant)]" />

          {/* PIPELINE ACTIONS */}
          <div className="space-y-2.5">
            <label className="block text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">Pipeline Execution</label>

            <button 
              onClick={() => runPipeline("today")} 
              disabled={pipelineRunning !== null} 
              className="w-full bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-lg px-3.5 py-2.5 text-xs font-semibold text-[var(--md-sys-color-on-surface)] transition-all active:scale-[0.98] disabled:opacity-50 text-left flex items-center justify-between cursor-pointer"
            >
              <span>Run latest pipeline</span>
              {pipelineRunning === "today" ? <Icon icon="ph:spinner-gap" className="animate-spin text-[var(--md-sys-color-primary)]" width="16"/> : <Icon icon="ph:play-bold" width="14" className="text-[var(--md-sys-color-on-surface-variant)]"/>}
            </button>

            <button 
              onClick={() => runPipeline("missing")} 
              disabled={pipelineRunning !== null} 
              className="w-full bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-lg px-3.5 py-2.5 text-xs font-semibold text-[var(--md-sys-color-on-surface)] transition-all active:scale-[0.98] disabled:opacity-50 text-left flex items-center justify-between cursor-pointer"
            >
              <span>Fetch missing dates</span>
              {pipelineRunning === "missing" ? <Icon icon="ph:spinner-gap" className="animate-spin text-[var(--md-sys-color-primary)]" width="16"/> : <Icon icon="ph:cloud-arrow-down-bold" width="14" className="text-[var(--md-sys-color-on-surface-variant)]"/>}
            </button>

            <div className="pt-2 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-xl p-3">
              <label className="block text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-1.5">Backfill Range</label>
              <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                <input
                  type="date"
                  className="w-full bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-lg px-2 py-1.5 text-[11px] font-mono text-[var(--md-sys-color-on-surface)]"
                  value={currentBackfillStart}
                  onChange={(e) => setBackfillStart(e.target.value)}
                />
                <input
                  type="date"
                  className="w-full bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-lg px-2 py-1.5 text-[11px] font-mono text-[var(--md-sys-color-on-surface)]"
                  value={currentBackfillEnd}
                  onChange={(e) => setBackfillEnd(e.target.value)}
                />
              </div>
              <button 
                onClick={() => runPipeline("backfill")}
                disabled={pipelineRunning !== null || !currentBackfillStart || !currentBackfillEnd}
                className="w-full bg-[var(--md-sys-color-primary)] hover:opacity-90 text-[var(--md-sys-color-on-primary)] rounded-lg px-3 py-2 text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {pipelineRunning === "backfill" ? <Icon icon="ph:spinner-gap" className="animate-spin" width="14"/> : <Icon icon="ph:database-bold" width="14"/>}
                <span>Execute Backfill</span>
              </button>
            </div>
          </div>

          {isAdmin && (
            <>
              <hr className="border-[var(--md-sys-color-outline-variant)]" />
              <div>
                <label className="block text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-2">Management</label>
                <Link
                  href="/admin"
                  className="w-full flex items-center justify-between bg-[var(--md-sys-color-primary-container)] hover:opacity-90 border border-[var(--md-sys-color-primary)] rounded-lg px-3.5 py-2.5 text-xs font-bold text-[var(--md-sys-color-on-primary-container)] transition-all active:scale-95 shadow-2xs"
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    <Icon icon="ph:shield-check-fill" width="18" />
                    <span>User Admin Console</span>
                  </div>
                  <Icon icon="ph:arrow-right-bold" width="12" />
                </Link>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
