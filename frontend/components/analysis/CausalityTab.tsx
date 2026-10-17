"use client";

import React from "react";
import useSWR from "swr";
import { Icon } from "@iconify/react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CausalityProps {
  ticker: string;
  analysisDate: string;
  windowDays: number;
  initialDetail?: any;
}

export default function CausalityTab({ ticker, analysisDate, windowDays, initialDetail }: CausalityProps) {
  const qs = "?window_days=" + windowDays + (analysisDate ? "&analysis_date=" + analysisDate : "");
  const url = `/api/bandar/causality/${ticker}${qs}`;
  const { data: causalityData, error, isLoading } = useSWR(ticker ? url : null, fetcher, { refreshInterval: 0, revalidateOnFocus: false });

  // Gunakan initialDetail jika dioper dari page induk untuk menghemat 1 network roundtrip
  const detailUrl = !initialDetail && ticker ? `/api/bandar/detail/${ticker}${qs}` : null;
  const { data: fetchedDetail } = useSWR(detailUrl, fetcher, { refreshInterval: 0, revalidateOnFocus: false });
  const detailData = initialDetail || fetchedDetail;

  if (isLoading && !causalityData) return <div className="p-8 border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] rounded-[24px] flex items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)] shadow-sm animate-pulse"><Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="24" /> <span className="text-sm font-bold tracking-wide">Analyzing Granger causality matrix...</span></div>;
  if (error || !causalityData) return <div className="p-5 bg-[var(--md-sys-color-error-container)] border border-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error-container)] font-bold text-sm rounded-[24px] shadow-sm">Failed to load causality insights.</div>;

  const granger = causalityData.granger_test;
  const score = detailData?.conviction?.score ?? detailData?.conviction_score ?? detailData?.score ?? 0;
  
  let brokerNote = detailData?.conviction_breakdown?.broker_note || detailData?.conviction?.broker_note || detailData?.broker_note;
  if (!brokerNote && detailData?.verdict) {
    const v = detailData.verdict;
    const matchBroker = v.match(/Broker ([A-Z0-9]+) is/i);
    const matchWinRate = v.match(/win rate (\d+%)/i);
    if (matchBroker && matchWinRate) {
      brokerNote = `${matchBroker[1]} win rate ${matchWinRate[1]}`;
    } else if (v.includes("not yet statistically strong")) {
      brokerNote = "No broker validation sample";
    }
  }
  brokerNote = brokerNote || "Unavailable";

  let scoreThemeText = "var(--color-positive)";
  let scoreThemeBorder = "border-[var(--color-positive)]";
  let scoreBg = "bg-[var(--color-positive)] opacity-80";
  if (score < 40) {
      scoreThemeText = "var(--color-negative)";
      scoreThemeBorder = "border-[var(--color-negative)]";
      scoreBg = "bg-[var(--color-negative)] opacity-80";
  } else if (score <= 70) {
      scoreThemeText = "#f59e0b";
      scoreThemeBorder = "border-[#f59e0b]";
      scoreBg = "bg-[#f59e0b] opacity-80";
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      
      {/* ====== METRIC CARDS (MD3 Expressive Style) ====== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        
        {/* Card 1: Granger */}
        <div className={`bg-[var(--md-sys-color-surface-container-low)] border rounded-[24px] p-5 sm:p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden group ${granger?.is_significant ? "border-[var(--color-positive)]" : "border-[#f59e0b]/50"}`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full transition-all duration-300 opacity-80 group-hover:opacity-100 ${granger?.is_significant ? "bg-[var(--color-positive)]" : "bg-[#f59e0b]"}`}></div>
            <div className="pl-2">
                <div className="flex items-center gap-2 mb-4">
                    <Icon icon="ph:chart-line-up-bold" style={{ color: granger?.is_significant ? "var(--color-positive)" : "#f59e0b" }} width="20" />
                    <span className="text-[9px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest opacity-90">Foreign flow granger</span>
                </div>
                {granger ? (
                    <div>
                        <div className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1" style={{ color: granger?.is_significant ? "var(--color-positive)" : "#f59e0b" }}>
                            {granger.is_significant ? "Significant" : "Not significant"}
                        </div>
                        <div className="text-[11px] sm:text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] mt-1 font-mono tabular-nums opacity-80">
                            p={granger.min_p_value.toFixed(4)} <span className="mx-1">•</span> lag {granger.best_lag}
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--md-sys-color-on-surface-variant)] opacity-70">Unavailable</div>
                        <div className="text-[10px] sm:text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] mt-2 opacity-60">Insufficient observations</div>
                    </div>
                )}
            </div>
        </div>

        {/* Card 2: Conviction */}
        <div className={`bg-[var(--md-sys-color-surface-container-low)] border rounded-[24px] p-5 sm:p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden group ${scoreThemeBorder} border-opacity-50`}>
            <div className={`absolute top-0 left-0 w-1.5 h-full transition-all duration-300 opacity-80 group-hover:opacity-100 ${scoreBg}`}></div>
            <div className="pl-2">
                <div className="flex items-center gap-2 mb-4">
                    <Icon icon="ph:scales-bold" style={{ color: scoreThemeText }} width="20" />
                    <span className="text-[9px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest opacity-90">Conviction model</span>
                </div>
                <div>
                    <div className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums" style={{ color: scoreThemeText }}>
                        {score.toFixed(1)}<span className="text-sm font-bold opacity-60 ml-1">/100</span>
                    </div>
                    <div className="text-[10px] sm:text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] mt-1.5 opacity-80">Weighted validation score</div>
                </div>
            </div>
        </div>

        {/* Card 3: Validation */}
        <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[#3b82f6]/40 rounded-[24px] p-5 sm:p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full opacity-80 group-hover:opacity-100 bg-[#3b82f6] transition-all duration-300"></div>
            <div className="pl-2">
                <div className="flex items-center gap-2 mb-4">
                    <Icon icon="ph:check-circle-bold" className="text-[#3b82f6]" width="20" />
                    <span className="text-[9px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest opacity-90">Broker validation</span>
                </div>
                <div>
                    <div className="text-lg sm:text-xl font-extrabold tracking-tight text-[#3b82f6] truncate" title={brokerNote}>
                        {brokerNote}
                    </div>
                    <div className="text-[10px] sm:text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] mt-1.5 opacity-80">Historical forward returns</div>
                </div>
            </div>
        </div>
      </div>

      {/* ====== DATA MATRICES ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        
        {/* Matrix 1: Participant */}
        <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm flex flex-col h-fit transition-colors duration-300">
            <div className="flex items-center gap-2.5 mb-5 border-b border-[var(--md-sys-color-outline-variant)] pb-3 flex-shrink-0">
                <Icon icon="ph:users-three-bold" className="text-[var(--md-sys-color-primary)]" width="22" height="22" />
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">Participant Causality</h3>
            </div>
          
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] pb-2 flex-grow">
                <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="sticky top-0 bg-[var(--md-sys-color-surface-container-highest)] z-10 shadow-sm">
                    <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                        <th className="py-3 px-4">Participant</th>
                        <th className="py-3 px-4 text-right">Lag</th>
                        <th className="py-3 px-4 text-right">P-Value</th>
                        <th className="py-3 px-4 text-center">Significant</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40">
                    {(causalityData.participant_causality || []).map((p: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                        <td className="py-3 px-4 font-extrabold text-[var(--md-sys-color-on-surface)] uppercase">{p.participant}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-[var(--md-sys-color-on-surface-variant)]">{p.lag}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold tabular-nums text-[var(--md-sys-color-on-surface)]">{p.p_value.toFixed(4)}</td>
                        <td className="py-3 px-4 text-center">
                        {p.is_significant ? (
                            <span className="px-3 py-1 rounded-full border font-extrabold tracking-widest text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-sm">YES</span>
                        ) : (
                            <span className="px-3 py-1 rounded-full border font-bold tracking-widest text-[9px] bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)]">NO</span>
                        )}
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
                {(causalityData.participant_causality || []).length === 0 && (
                    <div className="py-8 text-center text-[var(--md-sys-color-on-surface-variant)] font-bold text-xs">Insufficient participant history.</div>
                )}
            </div>
        </div>

        {/* Matrix 2: Top Broker */}
        <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm flex flex-col h-[450px] transition-colors duration-300">
            <div className="flex items-center gap-2.5 mb-5 border-b border-[var(--md-sys-color-outline-variant)] pb-3 flex-shrink-0">
                <Icon icon="ph:buildings-bold" className="text-[var(--md-sys-color-primary)]" width="22" height="22" />
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">Top Broker Causality</h3>
            </div>
          
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] pb-2 flex-grow">
                <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="sticky top-0 bg-[var(--md-sys-color-surface-container-highest)] z-10 shadow-sm">
                    <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                        <th className="py-3 px-4">Broker</th>
                        <th className="py-3 px-4 text-right">Lag</th>
                        <th className="py-3 px-4 text-right">P-Value</th>
                        <th className="py-3 px-4 text-center">Significant</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40">
                    {(causalityData.top_brokers || []).map((b: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                        <td className="py-3 px-4 font-mono font-extrabold text-[#3b82f6]">{b.code}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-[var(--md-sys-color-on-surface-variant)]">{b.lag}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold tabular-nums text-[var(--md-sys-color-on-surface)]">{b.p_value.toFixed(4)}</td>
                        <td className="py-3 px-4 text-center">
                        {b.is_significant ? (
                            <span className="px-3 py-1 rounded-full border font-extrabold tracking-widest text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-sm">YES</span>
                        ) : (
                            <span className="px-3 py-1 rounded-full border font-bold tracking-widest text-[9px] bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)]">NO</span>
                        )}
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
                {(causalityData.top_brokers || []).length === 0 && (
                    <div className="py-8 text-center text-[var(--md-sys-color-on-surface-variant)] font-bold text-xs">Insufficient broker history.</div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
