"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import TickerCard from "@/components/home/TickerCard";
import InvestOwlLoader from "@/components/ui/InvestOwlLoader";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const LS_KEY = "tradepulse_watchlist";

function WatchlistFetcher({ ticker, onRemove }: { ticker: string; onRemove?: (t: string) => void }) {
  const { data, isLoading, error } = useSWR(`/api/bandar/detail/${ticker}?window_days=20`, fetcher, { revalidateOnFocus: false });

  if (isLoading) return (
     <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] p-4 h-[96px] flex flex-col justify-between animate-pulse shadow-sm">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-12 h-6 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
                <div className="w-24 h-4 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
            </div>
            <div className="w-16 h-7 bg-[var(--md-sys-color-surface-container-highest)] rounded-full"></div>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--md-sys-color-outline-variant)]/60 pt-3">
            <div className="w-12 h-3.5 bg-[var(--md-sys-color-surface-container-highest)] rounded-sm"></div>
            <div className="w-14 h-3.5 bg-[var(--md-sys-color-surface-container-highest)] rounded-sm"></div>
            <div className="w-14 h-3.5 bg-[var(--md-sys-color-surface-container-highest)] rounded-sm"></div>
        </div>
     </div>
  );

  if (error || data?.error) return null;

  const item = {
    ticker: data.ticker,
    signal: data.signal_raw || data.signal,
    close: data.close,
    ret_5d: data.ret_5d,
    foreign_net_5d: data.foreign_5d,
    spark: data.price_chart?.slice(-20).map((d: any) => d.close) || []
  };

  return <TickerCard item={item} onRemove={onRemove} />;
}

export default function HomeMobile() {
  const [booted, setBooted] = useState(false);
  const [myList, setMyList] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
         const parsed = JSON.parse(saved);
         setMyList(parsed.length > 0 ? parsed : ["BBCA", "ASII"]);
      } else {
         setMyList(["BBCA", "BMRI", "GOTO"]);
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  const { data: dateData } = useSWR("/api/bandar/dates/BBCA", fetcher, { revalidateOnFocus: false });
  const latestDate = dateData?.dates?.[dateData.dates.length - 1] || "SYNCING...";

  const { data: universeData } = useSWR("/api/bandar/universe/all", fetcher, { revalidateOnFocus: false });
  const allTickers = universeData?.tickers || [];

  function saveList(list: string[]) {
    setMyList(list);
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }

  function addTicker(ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (t && !myList.includes(t)) saveList([...myList, t]);
    setQuery("");
  }

  function removeTicker(ticker: string) {
    saveList(myList.filter((t) => t !== ticker));
  }

  const searchResults = useMemo(() => {
    if (!query) return [];
    const q = query.toUpperCase();
    return allTickers.filter((t: string) => t.includes(q)).slice(0, 8);
  }, [query, allTickers]);

  if (!booted) {
    return (
      <InvestOwlLoader
        title="INITIALIZING SYSTEM"
        subtitle="Loading InvestOwl Engine..."
        fullScreen={true}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] selection:bg-[var(--md-sys-color-primary-container)] transition-colors duration-300 animate-fade-in">
      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-8 pb-8">

        {/* HEADER SECTION */}
        <header className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
          <div>
              <h1 className="text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight leading-none">HOME</h1>
          </div>
          <div className="text-right flex flex-col items-end">
              <div className="text-[10px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest mb-1.5">System Status</div>
              <div className="flex items-center gap-2 text-[10px] font-bold font-mono border px-3 py-1.5 rounded-full shadow-sm" style={{ color: "var(--color-positive)", borderColor: "var(--color-positive)", backgroundColor: "var(--md-sys-color-surface-container)" }}>
                  <span className="w-2 h-2 rounded-full animate-pulse shadow-sm" style={{ backgroundColor: "var(--color-positive)" }}></span>
                  ONLINE <span className="text-[var(--md-sys-color-on-surface-variant)] opacity-70 mx-0.5">•</span> {latestDate}
              </div>
          </div>
        </header>

        {/* SYSTEM INFO CARD */}
        <section className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-6 sm:p-8 relative overflow-hidden shadow-sm transition-colors duration-300">
           <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--md-sys-color-primary)] to-[var(--md-sys-color-tertiary)] opacity-80"></div>
           
           <div className="flex items-center gap-3 mb-4">
               <div className="p-2 rounded-xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shadow-sm">
                 <Icon icon="ph:info-duotone" width="22" />
               </div>
               <h2 className="text-base sm:text-lg font-bold text-[var(--md-sys-color-on-surface)] tracking-tight">The Investowl System</h2>
           </div>
           
           <p className="text-xs sm:text-sm font-medium text-[var(--md-sys-color-on-surface-variant)] leading-relaxed mb-6 text-justify">
             Platform terminal analitik saham komprehensif. Dirancang secara presisi untuk memonitor aliran dana asing (<i>Foreign Flow</i>), membedah jejak transaksi institusi (<i>Smart Money</i>), serta memvalidasi momentum dan kausalitas pergerakan harga di Bursa Efek Indonesia.
           </p>

           <div className="flex flex-wrap gap-4 items-center justify-between border-t border-[var(--md-sys-color-outline-variant)] pt-5">
             <div className="flex items-center gap-2 text-xs font-mono font-medium text-[var(--md-sys-color-on-surface-variant)]">
               <Icon icon="ph:terminal-duotone" width="16" /> Author: <span className="text-[var(--md-sys-color-on-surface)] font-bold">arya rifky</span>
             </div>
             <a
               href="https://www.instagram.com/rifqiaarya?igsi=bzJzbzZhZW1qanFr"
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center gap-2 text-[10px] sm:text-xs font-bold font-mono hover:opacity-80 transition-opacity px-4 py-2 rounded-full border shadow-sm"
               style={{ color: "var(--color-negative)", borderColor: "var(--color-negative)", backgroundColor: "var(--md-sys-color-surface)" }}
             >
               <Icon icon="ph:instagram-logo-duotone" width="16" /> @rifqiaarya
             </a>
           </div>
        </section>

        {/* WATCHLIST SECTION */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-4">
            <h3 className="text-base sm:text-lg font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight flex items-center gap-2.5">
               <Icon icon="ph:binoculars-duotone" className="text-[var(--md-sys-color-primary)]" width="24" />
               Active Watchlist
               <span className="text-[10px] font-bold font-mono text-[var(--md-sys-color-on-surface)] ml-1 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] px-2.5 py-1 rounded-full shadow-sm">
                 {myList.length} ASSETS
               </span>
            </h3>
            <button
              onClick={() => setEditing(!editing)}
              className={`flex items-center gap-2 text-xs sm:text-sm font-bold px-4 py-2 rounded-full border transition-all active:scale-[0.98] shadow-sm ${
                editing
                  ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-[var(--md-sys-color-primary)]"
                  : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)] border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
              }`}
            >
              <Icon icon={editing ? "ph:check-bold" : "ph:pencil-simple-duotone"} width="16" />
              {editing ? "Done" : "Edit List"}
            </button>
          </div>

          {/* EDITING PANEL */}
          {editing && (
            <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-primary)] rounded-[24px] p-5 sm:p-6 space-y-4 shadow-sm transition-colors animate-fade-in">
              <div className="relative">
                  <Icon icon="ph:magnifying-glass-bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--md-sys-color-primary)]" width="18" />
                  <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search ticker (e.g. BBCA)..."
                      className="w-full bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-full pl-11 pr-4 py-3 text-sm font-bold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] uppercase font-mono placeholder:normal-case placeholder:font-sans placeholder:font-medium transition-colors shadow-inner"
                  />
              </div>

              {query && (
                  <div className="flex flex-wrap gap-2.5 pt-2">
                  {searchResults.map((t: string) => {
                      const added = myList.includes(t);
                      return (
                      <button
                          key={t}
                          onClick={() => addTicker(t)}
                          className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border font-extrabold font-mono transition-all active:scale-[0.98] shadow-sm ${
                          added
                              ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-[var(--md-sys-color-primary)] opacity-60 cursor-default"
                              : "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)]"
                          }`}
                      >
                          <Icon icon={added ? "ph:check-bold" : "ph:plus-bold"} width="14" />
                          {t}
                      </button>
                      );
                  })}
                  {searchResults.length === 0 && <span className="text-sm font-medium text-[var(--md-sys-color-on-surface-variant)] italic px-2">No tickers found.</span>}
                  </div>
              )}
            </div>
          )}

          {/* WATCHLIST GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
              {!loaded ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] p-4 h-[96px] flex flex-col justify-between animate-pulse shadow-sm">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="w-12 h-6 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
                              <div className="w-24 h-4 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
                          </div>
                          <div className="w-16 h-7 bg-[var(--md-sys-color-surface-container-highest)] rounded-full"></div>
                      </div>
                      <div className="flex items-center justify-between border-t border-[var(--md-sys-color-outline-variant)]/60 pt-3">
                          <div className="w-12 h-3.5 bg-[var(--md-sys-color-surface-container-highest)] rounded-sm"></div>
                          <div className="w-14 h-3.5 bg-[var(--md-sys-color-surface-container-highest)] rounded-sm"></div>
                          <div className="w-14 h-3.5 bg-[var(--md-sys-color-surface-container-highest)] rounded-sm"></div>
                      </div>
                  </div>
                ))
              ) : (
                myList.map((ticker) => (
                   <WatchlistFetcher
                      key={ticker}
                      ticker={ticker}
                      onRemove={editing ? removeTicker : undefined}
                   />
                ))
              )}
          </div>

          {loaded && myList.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] shadow-sm transition-colors">
               <Icon icon="ph:ghost-duotone" width="48" className="mb-3 opacity-60" />
               <p className="text-sm font-bold tracking-wide">Your watchlist is empty.</p>
               <p className="text-xs font-medium mt-1 opacity-70">Click "Edit List" to add some assets.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
