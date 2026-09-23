"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Icon } from "@iconify/react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface RawTablesProps {
  ticker: string;
  analysisDate: string;
  windowDays: number;
}

export default function RawTablesTab({ ticker, analysisDate, windowDays }: RawTablesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 100;

  const url = `/api/bandar/stocks/${ticker}/raw-tables?analysis_date=${analysisDate}&window_days=${windowDays}`;
  const { data, error, isLoading, isValidating, mutate } = useSWR(url, fetcher, { revalidateOnFocus: false });

  if (isLoading && !data) return <div className="p-8 border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] rounded-[24px] flex items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)] shadow-sm animate-pulse"><Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="24" /> <span className="text-sm font-bold tracking-wide">Extracting raw database records...</span></div>;
  if (error) return <div className="p-5 bg-[var(--md-sys-color-error-container)] border border-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error-container)] font-bold text-sm rounded-[24px] shadow-sm">Error loading raw tables.</div>;

  const flowRows = data?.flow || [];
  const actRows = data?.activity || [];

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const filteredActRows = actRows.filter((r: any) => 
    (r.broker || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredActRows.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentActRows = filteredActRows.slice(indexOfFirstRow, indexOfLastRow);

  const fmtRp = (val: any) => {
    if (val === null || val === undefined || Number.isNaN(val)) return "-";
    if (Number(val) === 0) return "Rp 0";
    const sign = val < 0 ? "-" : "";
    const n = Math.abs(val);
    if (n >= 1e12) return sign + "Rp " + (n / 1e12).toFixed(2) + " T";
    if (n >= 1e9) return sign + "Rp " + (n / 1e9).toFixed(2) + " B";
    if (n >= 1e6) return sign + "Rp " + (n / 1e6).toFixed(2) + " M";
    return sign + "Rp " + n.toLocaleString("id-ID");
  };

  const getTypeChip = (type: string) => {
    const t = (type || "").toUpperCase();
    if (t === "FOREIGN" || t === "ASING") return "text-blue-600 dark:text-blue-400 bg-blue-500/15 border-blue-500/30";
    if (t === "LOCAL" || t === "LOKAL") return "text-indigo-600 dark:text-indigo-400 bg-indigo-500/15 border-indigo-500/30";
    if (t === "GOV" || t === "PEMERINTAH") return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
    return "text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-highest)] border-[var(--md-sys-color-outline-variant)]";
  };

  const getSignalTheme = (sig: string) => {
    const s = (sig || "").toUpperCase();
    if (s.includes("ACCUMULATION") || s.includes("BUY")) return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
    if (s.includes("DISTRIBUTION") || s.includes("SELL")) return "text-rose-600 dark:text-rose-400 bg-rose-500/15 border-rose-500/30";
    return "text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-highest)] border-[var(--md-sys-color-outline-variant)]";
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      
      {/* ====== TABLE 1: BROKER FLOW ROWS ====== */}
      <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm transition-colors duration-300">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 border-b border-[var(--md-sys-color-outline-variant)] pb-4 gap-4">
            <div className="flex items-center gap-2.5">
                <Icon icon="ph:database-bold" className="text-[var(--md-sys-color-primary)]" width="22" height="22" />
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">Broker Flow Records</h3>
            </div>
            
            <button 
              onClick={() => mutate()}
              disabled={isValidating}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--md-sys-color-primary-container)] hover:opacity-90 border border-[var(--md-sys-color-primary)] rounded-full text-xs font-extrabold text-[var(--md-sys-color-on-primary-container)] transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            >
              <Icon 
                icon={isValidating ? "ph:spinner-gap-bold" : "ph:arrows-clockwise-bold"} 
                className={isValidating ? "animate-spin text-[var(--md-sys-color-primary)]" : "text-[var(--md-sys-color-primary)]"} 
                width="16" height="16" 
              />
              <span>{isValidating ? "Syncing..." : "Refresh Matrix"}</span>
            </button>
        </div>

        <div className="bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] shadow-sm overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] pb-2">
            <table className="w-full text-left whitespace-nowrap text-xs">
              <thead className="sticky top-0 bg-[var(--md-sys-color-surface-container-highest)] z-10 shadow-sm">
                <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Signal</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 text-right">Foreign Net</th>
                  <th className="py-3 px-4 text-right">Local Net</th>
                  <th className="py-3 px-4 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40">
                {flowRows.map((row: any, idx: number) => {
                  return (
                    <tr key={idx} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors text-[var(--md-sys-color-on-surface)]">
                      <td className="py-3 px-4 font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.date}</td>
                      <td className="py-3 px-4 font-extrabold uppercase tracking-widest text-[9px]">
                          <span className={`px-2.5 py-1 rounded-full border shadow-sm ${getSignalTheme(row.signal)}`}>
                              {row.signal}
                          </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                          <span className={`px-2 py-[2px] rounded font-mono shadow-sm border ${row.score > 0 ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : row.score < 0 ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30" : "text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-highest)] border-[var(--md-sys-color-outline-variant)]"}`}>
                              {row.score}
                          </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-extrabold ${row.foreign_net > 0 ? "text-[var(--color-positive)]" : row.foreign_net < 0 ? "text-[var(--color-negative)]" : "text-[var(--md-sys-color-on-surface-variant)]"}`}>
                          {fmtRp(row.foreign_net)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-extrabold ${row.local_net > 0 ? "text-[var(--color-positive)]" : row.local_net < 0 ? "text-[var(--color-negative)]" : "text-[var(--md-sys-color-on-surface-variant)]"}`}>
                          {fmtRp(row.local_net)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-[var(--md-sys-color-on-surface)]">{fmtRp(row.total_value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {flowRows.length === 0 && <div className="p-10 text-center text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold">No flow records found in active window.</div>}
          </div>
        </div>
      </div>

      {/* ====== TABLE 2: BROKER ACTIVITY ROWS ====== */}
      <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm flex flex-col h-[700px] transition-colors duration-300">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4 border-b border-[var(--md-sys-color-outline-variant)] pb-4 flex-shrink-0">
            <div className="flex items-center gap-2.5">
                <Icon icon="ph:list-numbers-bold" className="text-[var(--md-sys-color-primary)]" width="22" height="22" />
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">Broker Activity Logs</h3>
            </div>
            
            <div className="flex items-center bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2 focus-within:border-[var(--md-sys-color-primary)] transition-colors shadow-sm">
                <Icon icon="ph:magnifying-glass-bold" className="text-[var(--md-sys-color-on-surface-variant)] mr-2.5" width="16" height="16" />
                <input 
                    type="text" 
                    placeholder="Search broker (e.g. YP)" 
                    value={searchTerm}
                    onChange={handleSearch}
                    className="bg-transparent border-none outline-none text-xs font-bold text-[var(--md-sys-color-on-surface)] w-48 sm:w-64 uppercase placeholder-[var(--md-sys-color-on-surface-variant)] placeholder:font-medium font-mono"
                />
            </div>
        </div>

        <div className="bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] shadow-sm overflow-hidden flex-grow flex flex-col transition-colors duration-300">
          <div className="overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] flex-grow">
            <table className="w-full text-left whitespace-nowrap text-xs">
              <thead className="sticky top-0 bg-[var(--md-sys-color-surface-container-highest)] z-10 shadow-sm">
                <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Broker</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Buy</th>
                  <th className="py-3 px-4 text-right">Sell</th>
                  <th className="py-3 px-4 text-right">Net</th>
                  <th className="py-3 px-4 text-right">Freq</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40">
                {currentActRows.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors text-[var(--md-sys-color-on-surface)]">
                    <td className="py-3 px-4 font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.date}</td>
                    <td className="py-3 px-4 font-mono font-extrabold text-[var(--md-sys-color-on-surface)]">{row.broker}</td>
                    <td className="py-3 px-4">
                       <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold border tracking-widest uppercase shadow-sm ${getTypeChip(row.type)}`}>
                          {row.type}
                       </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[var(--color-positive)] opacity-90">{fmtRp(row.buy)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[var(--color-negative)] opacity-90">{fmtRp(row.sell)}</td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold" style={{ color: row.net > 0 ? "var(--color-positive)" : row.net < 0 ? "var(--color-negative)" : "var(--md-sys-color-on-surface-variant)" }}>
                        {fmtRp(row.net)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.freq.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {currentActRows.length === 0 && (
              <div className="p-10 text-center text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold">
                {searchTerm ? `No activity found for broker "${searchTerm.toUpperCase()}".` : "No activity records found."}
              </div>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {filteredActRows.length > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--md-sys-color-outline-variant)] pt-4 mt-4 flex-shrink-0">
            <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-bold">
              Showing <span className="text-[var(--md-sys-color-on-surface)] font-mono font-extrabold">{indexOfFirstRow + 1}</span> to <span className="text-[var(--md-sys-color-on-surface)] font-mono font-extrabold">{Math.min(indexOfLastRow, filteredActRows.length)}</span> of <span className="text-[var(--md-sys-color-on-surface)] font-mono font-extrabold">{filteredActRows.length}</span> rows
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-full text-xs font-extrabold text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-primary)] hover:border-[var(--md-sys-color-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2 active:scale-95 shadow-sm"
              >
                <Icon icon="ph:caret-left-bold" width="14" /> Prev
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-4 py-2 bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-full text-xs font-extrabold text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-primary)] hover:border-[var(--md-sys-color-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2 active:scale-95 shadow-sm"
              >
                Next <Icon icon="ph:caret-right-bold" width="14" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
