"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Icon } from "@iconify/react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();

  // Ambil daftar ticker secara global
  const { data } = useSWR("/api/bandar/universe/all", fetcher, { revalidateOnFocus: false });
  const allTickers = data?.tickers || [];

  const results = useMemo(() => {
    if (!query) return [];
    const q = query.toUpperCase();
    return allTickers.filter((t: string) => t.includes(q)).slice(0, 8);
  }, [query, allTickers]);

  const handleSelect = (t: string) => {
    setQuery("");
    setIsFocused(false);
    router.push(`/${t}`);
  };

  return (
    <div className="relative z-50">
      <div 
        className={`flex items-center bg-[#08090C] border transition-all duration-300 rounded-md px-2 py-1.5 ${
          isFocused ? "border-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.2)] w-48 sm:w-64" : "border-white/[0.07] w-32 sm:w-48 hover:border-orange-500/50"
        }`}
      >
        <Icon icon="ph:magnifying-glass-duotone" className="text-orange-500/70 mr-1.5 flex-shrink-0" width="14" />
        <input
          type="text"
          className="bg-transparent border-none outline-none text-[10px] sm:text-xs text-neutral-200 placeholder-neutral-600 font-mono uppercase w-full"
          placeholder="CARI SAHAM..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        />
      </div>
      
      {isFocused && query && (
        <div className="absolute top-full right-0 mt-1.5 w-48 sm:w-64 bg-[#0F1117] border border-neutral-800 rounded-lg overflow-hidden shadow-2xl">
          {results.length > 0 ? (
            results.map((t: string) => (
              <button 
                key={t} 
                onClick={() => handleSelect(t)} 
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-mono text-neutral-300 hover:bg-neutral-800 hover:text-orange-400 transition-colors border-b border-neutral-800/40 last:border-0"
              >
                <span>{t}</span>
                <Icon icon="ph:arrow-up-right-bold" className="text-neutral-600" width="12" />
              </button>
            ))
          ) : (
            <div className="px-3 py-2.5 text-xs text-neutral-500 font-mono">Tidak ditemukan</div>
          )}
        </div>
      )}
    </div>
  );
}
