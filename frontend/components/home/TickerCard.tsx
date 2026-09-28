"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import SignalBadge from "./SignalBadge";
import Sparkline from "./Sparkline";
import { fmtB, fmtPct, signedColor } from "@/lib/format";

export interface TickerCardItem {
  ticker: string;
  signal?: string | null;
  close?: number | null;
  ret_5d?: number | null;
  foreign_net_5d?: number | null;
  spark?: number[];
}

export default function TickerCard({ 
  item, 
  onRemove 
}: { 
  item: TickerCardItem; 
  onRemove?: (t: string) => void;
}) {
  const up = (item.ret_5d ?? 0) >= 0;
  
  return (
    <div className="relative group transition-all">
      <Link
        href={`/${item.ticker}`}
        className="block bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] rounded-xl p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      >
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <span className="font-mono font-extrabold text-base tracking-tight text-[var(--md-sys-color-on-surface)]">
              {item.ticker}
            </span>
            <SignalBadge signal={item.signal} />
          </div>
          <Sparkline data={item.spark || []} up={up} />
        </div>
        
        <div className="grid grid-cols-3 gap-2 border-t border-[var(--md-sys-color-outline-variant)] pt-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-0.5">
              Close
            </span>
            <span className="text-xs sm:text-sm font-mono font-bold text-[var(--md-sys-color-on-surface)] tabular-nums">
              {item.close != null ? item.close.toLocaleString("id-ID") : "-"}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-0.5">
              Return 5D
            </span>
            <span 
              className="text-xs sm:text-sm font-mono font-bold tabular-nums" 
              style={{ color: signedColor(item.ret_5d) }}
            >
              {fmtPct(item.ret_5d)}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mb-0.5">
              Foreign 5D
            </span>
            <span 
              className="text-xs sm:text-sm font-mono font-bold tabular-nums" 
              style={{ color: signedColor(item.foreign_net_5d) }}
            >
              {fmtB(item.foreign_net_5d)}
            </span>
          </div>
        </div>
      </Link>
      
      {onRemove && (
        <button
          onClick={(e) => { 
            e.preventDefault(); 
            e.stopPropagation();
            onRemove(item.ticker); 
          }}
          className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--md-sys-color-surface-container-highest)] hover:bg-rose-600 text-[var(--md-sys-color-on-surface-variant)] hover:text-white border border-[var(--md-sys-color-outline-variant)] hover:border-rose-600 transition-all shadow-xs cursor-pointer z-10"
          title={`Hapus ${item.ticker} dari Watchlist`}
          aria-label={`Hapus ${item.ticker}`}
        >
          <Icon icon="ph:x-bold" width="12" />
        </button>
      )}
    </div>
  );
}
