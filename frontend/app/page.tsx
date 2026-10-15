"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
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
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-2xl p-4 h-[104px] flex flex-col justify-between animate-pulse shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-14 h-5 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
            <div className="w-20 h-4 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
          </div>
          <div className="w-16 h-6 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-[var(--md-sys-color-outline-variant)]/50 pt-3">
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
  const { data: session } = useSession();
  const { localWatchlist, setLocalWatchlist } = useAppStore();
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

    // Jika user login via Google, sinkronkan data watchlist dari server
    if (session?.user?.email) {
      fetch(`/api/users/${encodeURIComponent(session.user.email)}/watchlist`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data?.watchlist) && data.watchlist.length > 0) {
            setMyList(data.watchlist);
            setLocalWatchlist(data.watchlist);
            try {
              localStorage.setItem(LS_PRIMARY, JSON.stringify(data.watchlist));
              localStorage.setItem(LS_FALLBACK, JSON.stringify(data.watchlist));
            } catch {}
          } else {
            // Jika di server belum ada watchlist tersimpan, simpan initial list ke server
            fetch(`/api/users/${encodeURIComponent(session.user!.email!)}/watchlist`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ watchlist: initialList }),
            }).catch(() => {});
            setMyList(initialList);
            setLocalWatchlist(initialList);
          }
          setLoaded(true);
        })
        .catch(() => {
          setMyList(initialList);
          setLocalWatchlist(initialList);
          setLoaded(true);
        });
    } else {
      setMyList(initialList);
      setLocalWatchlist(initialList);
      setLoaded(true);
    }
  }, [setLocalWatchlist, session?.user?.email]);

  const { data: statusData } = useSWR("/api/bandar/system-status", fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });
  const { data: dateData } = useSWR("/api/bandar/dates/BBCA", fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  const latestDate = useMemo(() => {
    if (statusData?.latest_date && statusData.latest_date !== "-") {
      return statusData.latest_date;
    }
    if (dateData?.dates && dateData.dates.length > 0) {
      return dateData.dates[dateData.dates.length - 1];
    }
    return "ONLINE";
  }, [statusData?.latest_date, dateData?.dates]);

  const formattedDate = useMemo(() => {
    if (!latestDate || latestDate === "ONLINE") return "Data Terkini";
    try {
      const parts = latestDate.split("-");
      if (parts.length === 3) {
        const [y, m, d] = parts;
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        const monthName = months[parseInt(m, 10) - 1] || m;
        return `${parseInt(d, 10)} ${monthName} ${y}`;
      }
      return latestDate;
    } catch {
      return latestDate;
    }
  }, [latestDate]);

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
    // Jika user sedang login dengan Google, simpan perubahan ke database server
    if (session?.user?.email) {
      fetch(`/api/users/${encodeURIComponent(session.user.email)}/watchlist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlist: list }),
      }).catch((e) => console.error("Gagal sinkronisasi watchlist:", e));
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

        {/* MARKET HEADER */}
        <section className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl p-6 sm:p-7 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border border-[var(--md-sys-color-outline-variant)]/50 text-xs font-medium">
                <Icon icon="ph:calendar-blank-duotone" width="14" className="text-[var(--md-sys-color-primary)]" />
                <span>Data Terkini: <strong className="font-semibold text-[var(--md-sys-color-on-surface)]">{formattedDate}</strong></span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                Quantitative Market Terminal
              </h1>
              <p className="text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)] max-w-2xl leading-relaxed">
                Platform analitik aliran modal institusi (Smart Money) dan arus kas asing (Foreign Flow) pasar modal Indonesia.
              </p>
            </div>

            {/* SOCIAL MEDIA / CONTACT ICONS */}
            <div className="flex items-center gap-2 pt-2 sm:pt-0">
              <a
                href="mailto:adryanrifky716@gmail.com"
                title="Email: adryanrifky716@gmail.com"
                className="w-9 h-9 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/50 flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-primary)] hover:border-[var(--md-sys-color-primary)]/50 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all duration-200 shadow-2xs"
              >
                <Icon icon="ph:envelope-simple-duotone" width="18" />
              </a>
              <a
                href="https://t.me/theinvestowl"
                target="_blank"
                rel="noopener noreferrer"
                title="Telegram Channel: @theinvestowl"
                className="w-9 h-9 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/50 flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-sky-500 hover:border-sky-500/50 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all duration-200 shadow-2xs"
              >
                <Icon icon="ph:telegram-logo-duotone" width="18" />
              </a>
              <a
                href="https://www.instagram.com/rifqiaarya?dlrf=bzJzbzZhZW1qanFr"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram: @rifqiaarya"
                className="w-9 h-9 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/50 flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-pink-500 hover:border-pink-500/50 hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all duration-200 shadow-2xs"
              >
                <Icon icon="ph:instagram-logo-duotone" width="18" />
              </a>
              <a
                href="https://github.com/aryarifki"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub: aryarifki"
                className="w-9 h-9 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/50 flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:border-[var(--md-sys-color-outline)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-all duration-200 shadow-2xs"
              >
                <Icon icon="ph:github-logo-duotone" width="18" />
              </a>
            </div>
          </div>
        </section>

        {/* WATCHLIST & SCANNER SECTION */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--md-sys-color-outline-variant)]/50 pb-3">
            <div className="flex items-center gap-3">
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
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-full border transition-all cursor-pointer ${
                  editing
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] border-[var(--md-sys-color-primary)] shadow-sm"
                    : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)] border-[var(--md-sys-color-outline-variant)]/60 hover:bg-[var(--md-sys-color-surface-container-high)]"
                }`}
              >
                <Icon icon={editing ? "ph:check-bold" : "ph:pencil-simple-duotone"} width="14" />
                <span>{editing ? "Selesai" : "Edit Pantauan"}</span>
              </button>
            </div>
          </div>

          {/* EDIT & ADD TICKER BAR */}
          {editing && (
            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface)]">
                  Tambah Emiten Baru ke Watchlist
                </span>
                <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                  Ketik kode ticker (contoh: BBRI, ASII, BREN)
                </span>
              </div>

              <div className="relative">
                <Icon 
                  icon="ph:magnifying-glass-duotone" 
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)]" 
                  width="18" 
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari kode saham..."
                  className="w-full bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]/60 focus:border-[var(--md-sys-color-primary)] rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold text-[var(--md-sys-color-on-surface)] outline-none uppercase placeholder:normal-case placeholder:font-normal transition-colors"
                  autoFocus
                />
              </div>

              {query && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {searchResults.map((t: string) => {
                    const added = myList.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => addTicker(t)}
                        disabled={added}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-mono font-medium transition-all cursor-pointer ${
                          added
                            ? "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)] opacity-50 cursor-not-allowed border-[var(--md-sys-color-outline-variant)]/40"
                            : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] border-[var(--md-sys-color-outline-variant)]/60 hover:border-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-primary)]"
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
                  className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-2xl p-4 h-[104px] flex flex-col justify-between animate-pulse shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-5 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
                    <div className="w-16 h-6 bg-[var(--md-sys-color-surface-container-highest)] rounded-md"></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-[var(--md-sys-color-outline-variant)]/50 pt-3">
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
            <div className="py-16 flex flex-col items-center justify-center text-center bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl shadow-xs">
              <Icon icon="ph:binocular-duotone" width="48" className="mb-3 text-[var(--md-sys-color-primary)] opacity-80" />
              <p className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
                Watchlist pantauan Anda masih kosong.
              </p>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                Klik &quot;Edit Pantauan&quot; di atas untuk menambahkan saham favorit Anda.
              </p>
              <button
                onClick={() => setEditing(true)}
                className="mt-4 px-5 py-2 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] rounded-full text-xs font-semibold transition-all hover:opacity-90 shadow-sm cursor-pointer"
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
