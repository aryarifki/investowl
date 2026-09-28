"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import TickerCard from "@/components/home/TickerCard";
import { useAppStore } from "@/store/useAppStore";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const LS_PRIMARY = "investowl_watchlist";
const LS_FALLBACK = "tradepulse_watchlist";

function WatchlistCardFetcher({ 
  ticker, 
  onRemove 
}: { 
  ticker: string; 
  onRemove?: (t: string) => void;
}) {
  const { data, isLoading, error } = useSWR(
    `/api/bandar/detail/${ticker}?window_days=20`, 
    fetcher, 
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  if (isLoading) {
    return (
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-xl p-4 h-[104px] flex flex-col justify-between animate-pulse shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-14 h-5 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
            <div className="w-20 h-4 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
          </div>
          <div className="w-16 h-6 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-[var(--md-sys-color-outline-variant)] pt-3">
          <div className="w-12 h-3.5 bg-[var(--md-sys-color-surface-container-highest)] rounded"></div>
          <div className="w-14 h-3.5 bg-[var(--md-sys-color-surface-container-highest)] rounded mx-auto"></div>
          <div className="w-14 h-3.5 bg-[var(--md-sys-color-surface-container-highest)] rounded ml-auto"></div>
        </div>
      </div>
    );
  }

  if (error || data?.error) return null;

  const item = {
    ticker: data.ticker,
    signal: data.signal_raw || data.signal,
    close: data.close,
    ret_5d: data.ret_5d,
    foreign_net_5d: data.foreign_5d,
    spark: data.price_chart?.slice(-20).map((d: { close: number }) => d.close) || [],
  };

  return <TickerCard item={item} onRemove={onRemove} />;
}

export default function HomePage() {
  const { setSidebarOpen, universe, localWatchlist, setLocalWatchlist } = useAppStore();
  const [myList, setMyList] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let initialList = ["BBCA", "BMRI", "ASII", "TLKM"];
    try {
      const saved = localStorage.getItem(LS_PRIMARY) || localStorage.getItem(LS_FALLBACK);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialList = parsed;
        }
      } else if (localWatchlist && localWatchlist.length > 0) {
        initialList = localWatchlist;
      }
    } catch {
      // Ignore JSON parse error
    }
    setMyList(initialList);
    setLocalWatchlist(initialList);
    setLoaded(true);
  }, [setLocalWatchlist]);

  const { data: dateData } = useSWR("/api/bandar/dates/BBCA", fetcher, { revalidateOnFocus: false });
  const latestDate = dateData?.dates?.[dateData.dates.length - 1] || "ONLINE";

  const { data: universeData } = useSWR("/api/bandar/universe/all", fetcher, { revalidateOnFocus: false });
  const allTickers = useMemo(() => (universeData?.tickers as string[]) || [], [universeData?.tickers]);

  function saveList(list: string[]) {
    setMyList(list);
    setLocalWatchlist(list);
    try {
      localStorage.setItem(LS_PRIMARY, JSON.stringify(list));
      localStorage.setItem(LS_FALLBACK, JSON.stringify(list));
    } catch {
      // Ignore storage errors
    }
  }

  function addTicker(ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (t && !myList.includes(t)) {
      saveList([...myList, t]);
    }
    setQuery("");
  }

  function removeTicker(ticker: string) {
    saveList(myList.filter((t) => t !== ticker));
  }

  const searchResults = useMemo(() => {
    if (!query) return [];
    const q = query.toUpperCase();
    return allTickers.filter((t: string) => t.includes(q)).slice(0, 10);
  }, [query, allTickers]);

  return (
    <div className="min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] transition-colors duration-200">
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* INSTITUTIONAL MARKET PULSE HEADER */}
        <section className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--md-sys-color-primary)] via-amber-500 to-emerald-500"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-positive)] bg-[var(--md-sys-color-surface-container-high)] px-2.5 py-1 rounded-md border border-[var(--md-sys-color-outline-variant)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  IDX LIVE SYNC • {latestDate}
                </span>
                <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">•</span>
                <span className="text-xs font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase">
                  UNIVERSE: {universe.toUpperCase()}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                Quantitative Market Terminal
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[var(--md-sys-color-on-surface-variant)] mt-1 max-w-2xl leading-relaxed">
                Platform analitik aliran modal institusi (*Smart Money*) dan arus kas asing (*Foreign Flow*) dengan model matematis rekonsiliasi counterparty IDX.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-xl text-xs font-bold text-[var(--md-sys-color-on-surface)] transition-all cursor-pointer shadow-2xs"
                title="Buka Panel Parameter & Pipeline"
              >
                <Icon icon="ph:sliders-horizontal-duotone" width="16" className="text-[var(--md-sys-color-primary)]" />
                <span>Parameter Model</span>
              </button>
            </div>
          </div>

          {/* Quick Engine Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[var(--md-sys-color-outline-variant)]">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">
                Universe Assets
              </span>
              <span className="text-base sm:text-lg font-mono font-extrabold text-[var(--md-sys-color-on-surface)]">
                {allTickers.length > 0 ? `${allTickers.length} Tickers` : "80+ Equities"}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">
                Watchlist Active
              </span>
              <span className="text-base sm:text-lg font-mono font-extrabold text-[var(--md-sys-color-primary)]">
                {myList.length} Saham Terpantau
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">
                Engine Regime
              </span>
              <span className="text-base sm:text-lg font-mono font-extrabold text-[var(--color-positive)]">
                Gaussian HMM
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">
                Matching Algorithm
              </span>
              <span className="text-base sm:text-lg font-mono font-extrabold text-[var(--md-sys-color-on-surface)]">
                Greedy Vol-Price
              </span>
            </div>
          </div>
        </section>

        {/* WATCHLIST & SCANNER SECTION */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--md-sys-color-outline-variant)] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center">
                <Icon icon="ph:chart-polar-duotone" width="18" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                  Portfolio Watchlist
                </h2>
                <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                  Pantauan akumulasi bandar & net flow asing 5 hari bursa
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(!editing)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                  editing
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] border-[var(--md-sys-color-primary)]"
                    : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)] border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                }`}
              >
                <Icon icon={editing ? "ph:check-bold" : "ph:pencil-simple-duotone"} width="14" />
                <span>{editing ? "Selesai" : "Edit Pantauan"}</span>
              </button>
            </div>
          </div>

          {/* EDIT & ADD TICKER BAR */}
          {editing && (
            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-primary)] rounded-xl p-4 space-y-3 shadow-sm transition-all animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--md-sys-color-on-surface)]">
                  Tambah Emiten Baru ke Watchlist
                </span>
                <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
                  Ketik kode ticker (e.g. BBRI, ASII, BREN)
                </span>
              </div>

              <div className="relative">
                <Icon 
                  icon="ph:magnifying-glass-bold" 
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--md-sys-color-primary)]" 
                  width="16" 
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari kode saham..."
                  className="w-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] focus:border-[var(--md-sys-color-primary)] rounded-lg pl-10 pr-4 py-2 text-xs font-mono font-bold text-[var(--md-sys-color-on-surface)] outline-none uppercase placeholder:normal-case placeholder:font-normal transition-colors"
                  autoFocus
                />
              </div>

              {query && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {searchResults.map((t: string) => {
                    const added = myList.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => addTicker(t)}
                        disabled={added}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border font-mono font-bold transition-all cursor-pointer ${
                          added
                            ? "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)] opacity-50 cursor-not-allowed border-[var(--md-sys-color-outline-variant)]"
                            : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)]"
                        }`}
                      >
                        <Icon icon={added ? "ph:check-bold" : "ph:plus-bold"} width="12" />
                        <span>{t}</span>
                      </button>
                    );
                  })}
                  {searchResults.length === 0 && (
                    <span className="text-xs text-[var(--md-sys-color-on-surface-variant)] italic px-2">
                      Ticker tidak ditemukan di universe.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* WATCHLIST CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {!loaded ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-xl p-4 h-[104px] flex flex-col justify-between animate-pulse shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-5 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
                    <div className="w-16 h-6 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-[var(--md-sys-color-outline-variant)] pt-3">
                    <div className="w-10 h-3 bg-[var(--md-sys-color-surface-container-highest)] rounded"></div>
                    <div className="w-10 h-3 bg-[var(--md-sys-color-surface-container-highest)] rounded mx-auto"></div>
                    <div className="w-10 h-3 bg-[var(--md-sys-color-surface-container-highest)] rounded ml-auto"></div>
                  </div>
                </div>
              ))
            ) : (
              myList.map((ticker) => (
                <WatchlistCardFetcher
                  key={ticker}
                  ticker={ticker}
                  onRemove={editing ? removeTicker : undefined}
                />
              ))
            )}
          </div>

          {loaded && myList.length === 0 && (
            <div className="py-16 flex flex-col items-center justify-center text-center bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl shadow-xs">
              <Icon icon="ph:binocular-duotone" width="48" className="mb-3 text-[var(--md-sys-color-on-surface-variant)] opacity-60" />
              <p className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
                Watchlist pantauan Anda masih kosong.
              </p>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                Klik &quot;Edit Pantauan&quot; di atas untuk menambahkan saham favorit Anda.
              </p>
              <button
                onClick={() => setEditing(true)}
                className="mt-4 px-4 py-2 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] rounded-lg text-xs font-bold transition-all hover:opacity-90 shadow-2xs cursor-pointer"
              >
                Tambah Emiten
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
