"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

// Sementara hardcode; nanti bisa diganti endpoint /watchlist dari backend
const WATCHLIST = [
  "BBCA", "BBRI", "BMRI", "TLKM", "ASII",
  "UNVR", "GOTO", "ANTM", "PGAS", "ADRO",
];

export default function Watchlist() {
  const activeTicker = useAppStore((s) => s.activeTicker);
  const setActiveTicker = useAppStore((s) => s.setActiveTicker);
  const [filter, setFilter] = useState("");

  const filtered = WATCHLIST.filter((t) =>
    t.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col border border-neutral-800 rounded-lg bg-neutral-900">
      <div className="px-3 py-2 border-b border-neutral-800">
        <h2 className="text-sm font-semibold mb-2">📋 Watchlist</h2>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Cari ticker..."
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
        />
      </div>

      <ul className="flex-1 overflow-y-auto">
        {filtered.map((ticker) => (
          <li key={ticker}>
            <button
              onClick={() => setActiveTicker(ticker)}
              className={
                "w-full text-left px-3 py-2 text-sm border-b border-neutral-800/50 transition-colors " +
                (ticker === activeTicker
                  ? "bg-emerald-900/40 text-emerald-300 font-semibold border-l-2 border-l-emerald-500"
                  : "hover:bg-neutral-800 border-l-2 border-l-transparent")
              }
            >
              {ticker}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-sm text-neutral-500">Tidak ditemukan</li>
        )}
      </ul>
    </div>
  );
}
