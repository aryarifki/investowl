"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { fmtRp, signedColor, getProfileTextColor } from "@/lib/format";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Gagal mengambil data");
    return res.json();
  });

interface WhaleStockItem {
  ticker: string;
  net_value: number;
  buy_value: number;
  sell_value: number;
  net_lot: number;
  buy_avg_price?: number | null;
  sell_avg_price?: number | null;
}

interface BrokerWhaleListItem {
  broker_code: string;
  profile: string;
  profile_label: string;
  profile_desc: string;
  is_smart: boolean;
}

interface BrokerWhalesDetailResponse {
  broker_code: string;
  profile: string;
  profile_label: string;
  profile_desc: string;
  is_smart: boolean;
  period_days: number;
  start_date: string;
  end_date: string;
  total_buy_value: number;
  total_sell_value: number;
  total_net_value: number;
  top_accumulations: WhaleStockItem[];
  top_distributions: WhaleStockItem[];
}

export default function WhalesDashboard() {
  const [selectedBroker, setSelectedBroker] = useState("AK");
  const [days, setDays] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: brokersList } = useSWR<BrokerWhaleListItem[]>(
    "/api/broker-flow/whales",
    fetcher
  );

  const { data: detail, error: detailError, isLoading: isDetailLoading } = useSWR<BrokerWhalesDetailResponse>(
    selectedBroker ? `/api/broker-flow/whales/${selectedBroker}?days=${days}&limit=20` : null,
    fetcher
  );

  const filteredBrokers = useMemo(() => {
    if (!brokersList) return [];
    const term = searchTerm.trim().toUpperCase();
    if (!term) return [];
    return brokersList
      .filter((b) => b.broker_code.includes(term) || b.profile_label.toUpperCase().includes(term))
      .slice(0, 10);
  }, [brokersList, searchTerm]);

  // Keyboard shortcut: '/' focuses search input, 'Escape' closes dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectBroker = (code: string) => {
    const clean = code.toUpperCase().trim();
    if (!clean) return;
    setSelectedBroker(clean);
    setSearchTerm("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleEnterSubmit = () => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return;

    // 1. Exact match with any broker
    const exact = brokersList?.find((b) => b.broker_code === term);
    if (exact) {
      handleSelectBroker(exact.broker_code);
      return;
    }

    // 2. Select first match in filtered list if available
    if (filteredBrokers.length > 0) {
      handleSelectBroker(filteredBrokers[0].broker_code);
      return;
    }

    // 3. Fallback: try user input directly
    handleSelectBroker(term);
  };

  const QUICK_WHALES = [
    { code: "AK", label: "AK (Smart Foreign)" },
    { code: "BK", label: "BK (Smart Foreign)" },
    { code: "KZ", label: "KZ (Smart Foreign)" },
    { code: "CS", label: "CS (Smart Foreign)" },
    { code: "MG", label: "MG (Bandar Gorengan)" },
    { code: "SQ", label: "SQ (Bandar Gorengan)" },
    { code: "CC", label: "CC (Local Inst)" },
    { code: "NI", label: "NI (Local Inst)" },
  ];

  return (
    <div className="space-y-6">
      {/* ── 1. BROKER SEARCH BAR (PERSIS SEPERTI TICKER SEARCH) ── */}
      <div className="relative z-40">
        <div className="flex items-center bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] focus-within:border-[var(--md-sys-color-primary)] rounded-xl px-3.5 py-2.5 shadow-2xs transition-all duration-200">
          <Icon
            icon="ph:magnifying-glass-duotone"
            className="text-[var(--md-sys-color-primary)] mr-2.5 flex-shrink-0"
            width="18"
            height="18"
          />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none outline-none text-xs sm:text-sm text-[var(--md-sys-color-on-surface)] placeholder-[var(--md-sys-color-on-surface-variant)] font-mono uppercase tracking-wider"
            placeholder="Cari Kode Broker (Contoh: AK, BK, MG, SQ, YP, CC) lalu tekan Enter..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleEnterSubmit();
              } else if (e.key === "Escape") {
                setIsOpen(false);
                inputRef.current?.blur();
              }
            }}
          />
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] px-2 py-0.5 rounded flex-shrink-0">
            <span>Tekan</span>
            <kbd className="text-[var(--md-sys-color-primary)]">Enter ↵</kbd>
          </div>
        </div>

        {/* Autocomplete Dropdown Popup */}
        {isOpen && searchTerm && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-xl overflow-hidden shadow-xl z-50 max-h-80 overflow-y-auto">
              {filteredBrokers.length > 0 ? (
                filteredBrokers.map((b) => (
                  <button
                    key={b.broker_code}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-mono font-bold text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-low)] hover:text-[var(--md-sys-color-primary)] transition-colors border-b border-[var(--md-sys-color-outline-variant)] last:border-0 cursor-pointer text-left"
                    onClick={() => handleSelectBroker(b.broker_code)}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${b.is_smart ? "bg-amber-400" : "bg-emerald-500"}`} />
                      <span className="text-[var(--md-sys-color-primary)] font-extrabold text-sm">{b.broker_code}</span>
                      <span className="text-[var(--md-sys-color-on-surface-variant)] font-normal text-[11px]">— {b.profile_label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase">{b.profile}</span>
                      <Icon icon="ph:arrow-up-right-bold" className="text-[var(--md-sys-color-on-surface-variant)]" width="12" />
                    </div>
                  </button>
                ))
              ) : (
                <div
                  className="px-4 py-3 text-xs text-[var(--md-sys-color-on-surface-variant)] font-mono flex items-center justify-between hover:bg-[var(--md-sys-color-surface-container-low)] cursor-pointer"
                  onClick={handleEnterSubmit}
                >
                  <span>Cari langsung broker &quot;{searchTerm.toUpperCase().trim()}&quot;</span>
                  <kbd className="text-[var(--md-sys-color-primary)] font-bold text-[10px] bg-[var(--md-sys-color-surface-container-high)] px-2 py-0.5 rounded border border-[var(--md-sys-color-outline-variant)]">
                    ↵ Enter
                  </kbd>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 2. QUICK ACCESS & TIMEFRAME SELECTOR ── */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Icon icon="ph:sparkle-duotone" className="text-[var(--md-sys-color-primary)]" width="16" />
              <span className="text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">
                Whales Terpilih: <strong className="text-[var(--md-sys-color-primary)] text-sm ml-1">{selectedBroker}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {QUICK_WHALES.map((w) => (
                <button
                  key={w.code}
                  onClick={() => setSelectedBroker(w.code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedBroker === w.code
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs scale-102"
                      : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)]"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-2 self-start md:self-center flex-shrink-0">
            <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">Periode:</span>
            {[5, 10, 20, 60].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  days === d
                    ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border border-[var(--md-sys-color-primary)]"
                    : "bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]"
                }`}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. DETAIL CONTENT ── */}
      {isDetailLoading ? (
        <div className="p-8 border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] rounded-2xl flex items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)] shadow-sm animate-pulse">
          <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="24" />
          <span className="text-sm font-bold tracking-wide">
            Mengambil data transaksi broker {selectedBroker}...
          </span>
        </div>
      ) : detailError || !detail ? (
        <div className="p-8 text-center bg-[var(--md-sys-color-surface-container)] rounded-2xl border border-[var(--md-sys-color-outline-variant)]">
          <Icon icon="ph:warning-circle-duotone" className="mx-auto text-[var(--color-negative)] mb-2" width="36" />
          <p className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
            Data tidak ditemukan untuk broker &quot;{selectedBroker}&quot; pada rentang {days} hari bursa terakhir.
          </p>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
            Pastikan kode broker yang dimasukkan benar (2 huruf, misal: AK, BK, MG, YP).
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[var(--md-sys-color-on-surface-variant)]">Profil Partisipan</span>
                <span className="text-lg font-black text-[var(--md-sys-color-primary)]">{detail.broker_code}</span>
              </div>
              <p className="text-sm font-extrabold" style={{ color: getProfileTextColor(detail.profile_label) }}>
                {detail.profile_label}
              </p>
              <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1 line-clamp-1">
                {detail.profile_desc}
              </p>
            </div>

            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-bold text-[var(--md-sys-color-on-surface-variant)]">
                Total Net Flow ({detail.period_days} Hari)
              </span>
              <p className="text-lg font-black mt-1" style={{ color: signedColor(detail.total_net_value) }}>
                {fmtRp(detail.total_net_value)}
              </p>
              <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1">
                {detail.start_date} s/d {detail.end_date}
              </p>
            </div>

            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-bold text-[var(--md-sys-color-on-surface-variant)]">Total Akumulasi (Gross Buy)</span>
              <p className="text-lg font-black text-[var(--color-positive)] mt-1">{fmtRp(detail.total_buy_value)}</p>
              <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1">Total belanja modal</p>
            </div>

            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-bold text-[var(--md-sys-color-on-surface-variant)]">Total Distribusi (Gross Sell)</span>
              <p className="text-lg font-black text-[var(--color-negative)] mt-1">{fmtRp(detail.total_sell_value)}</p>
              <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1">Total pelepasan posisi</p>
            </div>
          </div>

          {/* ── TWO COLUMN TABLES: ACCUMULATION VS DISTRIBUTION ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* TOP ACCUMULATION */}
            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[var(--md-sys-color-outline-variant)]">
                <Icon icon="ph:arrow-circle-up-right-duotone" className="text-[var(--color-positive)]" width="22" />
                <h3 className="text-sm font-extrabold text-[var(--md-sys-color-on-surface)]">
                  Top Akumulasi Bersih ({detail.top_accumulations.length} Saham)
                </h3>
              </div>

              {detail.top_accumulations.length === 0 ? (
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] py-4 text-center">
                  Tidak ada akumulasi bersih pada periode ini.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]">
                        <th className="py-2 font-bold">Saham</th>
                        <th className="py-2 font-bold text-right">Net Value</th>
                        <th className="py-2 font-bold text-right">Buy Avg</th>
                        <th className="py-2 font-bold text-right">Net Lot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40 font-medium">
                      {detail.top_accumulations.map((item) => (
                        <tr key={item.ticker} className="hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors">
                          <td className="py-2.5">
                            <Link href={`/${item.ticker}`} className="font-extrabold text-[var(--md-sys-color-primary)] hover:underline">
                              {item.ticker}
                            </Link>
                          </td>
                          <td className="py-2.5 text-right font-extrabold text-[var(--color-positive)]">
                            {fmtRp(item.net_value)}
                          </td>
                          <td className="py-2.5 text-right text-[var(--md-sys-color-on-surface)] font-mono">
                            {item.buy_avg_price ? `Rp ${item.buy_avg_price.toLocaleString("id-ID")}` : "-"}
                          </td>
                          <td className="py-2.5 text-right text-[var(--md-sys-color-on-surface-variant)] font-mono">
                            {item.net_lot.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* TOP DISTRIBUTION */}
            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[var(--md-sys-color-outline-variant)]">
                <Icon icon="ph:arrow-circle-down-right-duotone" className="text-[var(--color-negative)]" width="22" />
                <h3 className="text-sm font-extrabold text-[var(--md-sys-color-on-surface)]">
                  Top Distribusi Bersih ({detail.top_distributions.length} Saham)
                </h3>
              </div>

              {detail.top_distributions.length === 0 ? (
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] py-4 text-center">
                  Tidak ada distribusi bersih pada periode ini.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]">
                        <th className="py-2 font-bold">Saham</th>
                        <th className="py-2 font-bold text-right">Net Value</th>
                        <th className="py-2 font-bold text-right">Sell Avg</th>
                        <th className="py-2 font-bold text-right">Net Lot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40 font-medium">
                      {detail.top_distributions.map((item) => (
                        <tr key={item.ticker} className="hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors">
                          <td className="py-2.5">
                            <Link href={`/${item.ticker}`} className="font-extrabold text-[var(--md-sys-color-primary)] hover:underline">
                              {item.ticker}
                            </Link>
                          </td>
                          <td className="py-2.5 text-right font-extrabold text-[var(--color-negative)]">
                            {fmtRp(item.net_value)}
                          </td>
                          <td className="py-2.5 text-right text-[var(--md-sys-color-on-surface)] font-mono">
                            {item.sell_avg_price ? `Rp ${item.sell_avg_price.toLocaleString("id-ID")}` : "-"}
                          </td>
                          <td className="py-2.5 text-right text-[var(--md-sys-color-on-surface-variant)] font-mono">
                            {item.net_lot.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
