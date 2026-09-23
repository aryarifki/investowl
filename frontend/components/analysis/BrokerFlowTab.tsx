"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Icon } from "@iconify/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ==================== Formatters ==================== */
function fmtRp(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (v >= 1e12) return sign + "Rp " + (v / 1e12).toFixed(2) + " T";
  if (v >= 1e9) return sign + "Rp " + (v / 1e9).toFixed(2) + " B";
  if (v >= 1e6) return sign + "Rp " + (v / 1e6).toFixed(2) + " M";
  return sign + "Rp " + v.toLocaleString("id-ID");
}

function signedColor(n: number): string {
  return n >= 0 ? "var(--color-positive)" : "var(--color-negative)";
}

function getProfileTextColor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("foreign smart")) return "var(--color-positive)"; 
  if (l.includes("local inst")) return "#3b82f6"; 
  if (l.includes("market maker")) return "#a855f7"; 
  if (l.includes("speculative")) return "#f59e0b"; 
  return "var(--md-sys-color-on-surface-variant)"; 
}

const COLORS = ["#3b82f6", "var(--color-negative)", "var(--color-positive)", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"];

const PROFILE_OPTIONS = [
  { key: "all", label: "All Profiles" },
  { key: "smart_foreign", label: "Foreign Smart Money" },
  { key: "local_institutional", label: "Local Institutions" },
  { key: "market_maker", label: "Market Makers" },
  { key: "bandar_gorengan", label: "Speculative Operators" },
  { key: "retail", label: "Retail-Dominant" },
  { key: "lainnya", label: "Other Brokers" },
];

export default function BrokerFlowTab({ ticker, analysisDate, windowDays }: { ticker: string; analysisDate: string; windowDays: number }) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [flowMode, setFlowMode] = useState("Cumulative");
  const [distMode, setDistMode] = useState("Date range");
  const [distDate, setDistDate] = useState(analysisDate);
  const [distStart, setDistStart] = useState(analysisDate);
  const [distEnd, setDistEnd] = useState(analysisDate);
  const [profileFilter, setProfileFilter] = useState("all");

  const qs = "?window_days=" + windowDays + 
             (analysisDate ? "&analysis_date=" + analysisDate : "") + 
             "&flow_mode=" + flowMode + 
             "&dist_mode=" + encodeURIComponent(distMode) + 
             "&dist_date=" + distDate + 
             "&dist_start=" + distStart + 
             "&dist_end=" + distEnd + 
             (selectedCodes.length > 0 ? "&broker_codes=" + selectedCodes.join(",") : "");
             
  const { data, error, isLoading, isValidating } = useSWR(
    ticker ? "/api/bandar/broker-flow/" + ticker + qs : null,
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: false, keepPreviousData: true }
  );

  useEffect(() => {
    if (!data) return;
    if (selectedCodes.length === 0 && data.default_codes) {
      setSelectedCodes(data.default_codes.slice(0, 3));
    }
  }, [data?.default_codes]);

  useEffect(() => {
    if (analysisDate) {
      setDistDate(analysisDate);
      setDistEnd(analysisDate);
      
      const dateObj = new Date(analysisDate);
      if (!isNaN(dateObj.getTime())) {
         dateObj.setDate(dateObj.getDate() - windowDays);
         const yyyy = dateObj.getFullYear();
         const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
         const dd = String(dateObj.getDate()).padStart(2, '0');
         setDistStart(`${yyyy}-${mm}-${dd}`);
      }
    }
  }, [analysisDate, windowDays]);

  const toggleCode = (code: string) => {
    if (selectedCodes.includes(code)) {
      setSelectedCodes(selectedCodes.filter((c) => c !== code));
    } else {
      if (selectedCodes.length >= 10) return; 
      setSelectedCodes([...selectedCodes, code]);
    }
  };

  if (isLoading && !data) return <div className="p-8 border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] rounded-[24px] flex items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)] shadow-sm animate-pulse"><Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="24" /> <span className="text-sm font-bold tracking-wide">Extracting broker flow data...</span></div>;
  if (error) return <div className="p-5 bg-[var(--md-sys-color-error-container)] border border-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error-container)] font-bold text-sm rounded-[24px] shadow-sm">Error processing data.</div>;

  const chartData = data?.compare_chart || [];
  const dist = data?.distribution || { buyers: [], sellers: [], edges: [], dist_start: "-", dist_end: "-" };
  const summary = data?.summary || [];
  const detailRows = data?.detail_rows || [];
  const profileFlow = data?.profile_flow || [];
  const profileDetail = data?.profile_broker_detail || [];

  const filteredProfileDetail = profileFilter === "all" ? profileDetail : profileDetail.filter((r: any) => r.profile_key === profileFilter);

  return (
    <div className={`space-y-6 sm:space-y-8 transition-opacity duration-300 ${isValidating ? "opacity-70" : "opacity-100"} animate-fade-in`}>
      
      {/* ====== CHART CONTROLS & BROKER SELECTION ====== */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
            <select 
              className="bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-bold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] shadow-sm cursor-pointer"
              onChange={(e) => {
                if (e.target.value) toggleCode(e.target.value);
                e.target.value = ""; 
              }}
            >
              <option value="">+ Add Broker</option>
              {(data?.all_codes || []).map((code: string) => (
                <option key={code} value={code} disabled={selectedCodes.includes(code)}>{code}</option>
              ))}
            </select>
            
            <div className="flex flex-wrap gap-2">
              {selectedCodes.map((code: string) => (
                <div key={code} className="flex items-center gap-2 pl-3.5 pr-1.5 py-1.5 bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border border-[var(--md-sys-color-primary)] rounded-full text-sm font-extrabold tracking-wide shadow-sm">
                  {code}
                  <button onClick={() => toggleCode(code)} className="bg-[var(--md-sys-color-surface)]/20 hover:bg-[var(--color-negative)] hover:text-white transition-colors p-1 rounded-full"><Icon icon="ph:x-bold" width="14" /></button>
                </div>
              ))}
            </div>
        </div>

        <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] p-4 sm:p-5 rounded-[24px] shadow-sm">
            <label className="block text-[10px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest mb-2.5">Flow mode</label>
            <select className="w-full md:w-72 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-bold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] shadow-sm cursor-pointer" value={flowMode} onChange={(e) => setFlowMode(e.target.value)}>
                <option value="Cumulative">Cumulative</option>
                <option value="Daily">Daily</option>
            </select>
            <p className="text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] mt-3">Cumulative mode sums broker net flow across the selected broker window. Daily mode shows each date separately.</p>
        </div>
      </div>

      {/* ====== BROKER FLOW COMPARISON CHART ====== */}
      {selectedCodes.length > 0 && (
        <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm transition-colors duration-300">
          <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] mb-5 tracking-tight">Broker Flow Comparison <span className="opacity-60 text-[var(--md-sys-color-on-surface-variant)] text-sm font-semibold ml-1">({flowMode})</span></h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--md-sys-color-outline-variant)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 10, fill: "var(--md-sys-color-on-surface-variant)", fontWeight: 600 }} stroke="var(--md-sys-color-outline-variant)" axisLine={false} tickLine={false} label={{ value: 'Cumulative Net (Rp B)', angle: -90, position: 'insideLeft', fill: 'var(--md-sys-color-on-surface-variant)', fontSize: 10, fontWeight: 700 }} />
                <Tooltip contentStyle={{ background: "var(--md-sys-color-surface-container-highest)", border: "1px solid var(--md-sys-color-outline-variant)", borderRadius: "16px", fontSize: "12px", color: "var(--md-sys-color-on-surface)", fontWeight: 700, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} labelStyle={{ color: "var(--md-sys-color-on-surface-variant)", fontWeight: 800, marginBottom: "4px" }} formatter={(value: any, name: any) => ["Rp " + Number(value).toFixed(2) + " B", name]} />
                <ReferenceLine y={0} stroke="var(--md-sys-color-outline)" strokeWidth={1.5} />
                {selectedCodes.map((code: string, i: number) => (
                  <Line key={code} type="monotone" dataKey={code} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{ r: 3, strokeWidth: 1 }} activeDot={{ r: 6, stroke: "var(--md-sys-color-surface)", strokeWidth: 2 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ====== BROKER PROFILE FLOW ====== */}
      <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2 mb-5 border-b border-[var(--md-sys-color-outline-variant)] pb-3">
            <Icon icon="ph:link-bold" className="text-[var(--md-sys-color-primary)]" width="20" />
            <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">Broker Profile Flow</h3>
        </div>
        
        {profileFlow.length === 0 ? (
          <p className="text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] text-center py-6">No profile flow detected.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {profileFlow.map((row: any, i: number) => {
                const maxAbs = Math.max(...profileFlow.map((r: any) => Math.abs(r.net)), 1);
                const width = Math.max(3, (Math.abs(row.net) / maxAbs) * 100);
                return (
                <div key={i} className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] p-5 flex flex-col justify-between transition-colors shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="text-sm sm:text-base font-extrabold tracking-tight uppercase" style={{ color: getProfileTextColor(row.label) }}>{row.label}</div>
                            <div className="text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] mt-1">{row.description}</div>
                        </div>
                        <span className="font-mono font-extrabold text-sm sm:text-base" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</span>
                    </div>
                    <div>
                        <div className="h-2 bg-[var(--md-sys-color-surface-container-highest)] rounded-full overflow-hidden border border-[var(--md-sys-color-outline-variant)] mb-4">
                          <div className="h-full rounded-full transition-all duration-1000" style={{ width: width + "%", backgroundColor: signedColor(row.net) }} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                        {(row.top_brokers || []).map((b: any, j: number) => (
                            <span key={j} className="inline-flex items-center gap-1.5 text-[10px] bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-3 py-1.5 shadow-sm">
                                <span className="font-mono font-extrabold text-[var(--md-sys-color-on-surface)]">{b.broker_code}</span>
                                <span className="text-[var(--md-sys-color-on-surface-variant)] font-bold uppercase">{b.participant_type === "Asing" ? "FOREIGN" : b.participant_type === "Lokal" ? "LOCAL" : b.participant_type}</span>
                                <span className="font-mono font-extrabold" style={{ color: signedColor(b.net) }}>{fmtRp(b.net)}</span>
                            </span>
                        ))}
                        </div>
                    </div>
                </div>
                );
            })}
          </div>
        )}
      </div>

      {/* ====== PROFILE DETAIL ====== */}
      <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm transition-colors duration-300">
        <label className="block text-[10px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest mb-2.5">Profile detail filter</label>
        <select className="w-full md:w-72 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-bold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] shadow-sm cursor-pointer mb-5" value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)}>
            {PROFILE_OPTIONS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        
        <div className="bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] shadow-sm overflow-hidden transition-colors duration-300">
            <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] pb-2">
                <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="sticky top-0 bg-[var(--md-sys-color-surface-container-highest)] z-10 shadow-sm">
                    <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                        <th className="py-3 px-4">Profile</th>
                        <th className="py-3 px-4">Broker</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Buy</th>
                        <th className="py-3 px-4 text-right">Sell</th>
                        <th className="py-3 px-4 text-right">Net</th>
                        <th className="py-3 px-4 text-right">Freq</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40">
                    {filteredProfileDetail.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                        <td className="py-3 px-4 font-extrabold uppercase tracking-wide" style={{ color: getProfileTextColor(row.profile) }}>{row.profile}</td>
                        <td className="py-3 px-4 text-[var(--md-sys-color-on-surface)] font-extrabold font-mono">{row.broker}</td>
                        <td className="py-3 px-4 font-bold uppercase text-[var(--md-sys-color-on-surface-variant)]">{row.type}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface)]">{fmtRp(row.buy)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface)]">{fmtRp(row.sell)}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.freq.toLocaleString("id-ID")}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                {filteredProfileDetail.length === 0 && <div className="text-center text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] py-8">No data for selected profile.</div>}
            </div>
        </div>
      </div>

      {/* ====== BROKER DISTRIBUTION ====== */}
      <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2 mb-5 border-b border-[var(--md-sys-color-outline-variant)] pb-3">
            <Icon icon="ph:link-bold" className="text-[var(--md-sys-color-primary)]" width="20" />
            <h3 className="text-sm sm:text-base font-extrabold text-[var(--md-sys-color-on-surface)] flex items-center gap-2 tracking-tight">
                Broker Distribution
                {isValidating && <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[var(--md-sys-color-primary)]" width="16" />}
            </h3>
        </div>
        
        <div className="flex flex-col md:flex-row gap-5 mb-5">
            <div className="flex-1">
                <label className="block text-[10px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest mb-2.5">Distribution mode</label>
                <select className="w-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-bold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] shadow-sm cursor-pointer" value={distMode} onChange={(e) => setDistMode(e.target.value)}>
                    <option value="Single day">Single day</option>
                    <option value="Date range">Date range</option>
                </select>
            </div>
            
            <div className="flex-1">
                <label className="block text-[10px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest mb-2.5">Distribution date</label>
                {distMode === "Single day" ? (
                    <input type="date" className="w-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-bold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] shadow-sm" value={distDate} onChange={(e) => setDistDate(e.target.value)} />
                ) : (
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input type="date" className="w-full sm:w-1/2 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-bold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] shadow-sm" value={distStart} onChange={(e) => setDistStart(e.target.value)} />
                    <span className="text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold uppercase">to</span>
                    <input type="date" className="w-full sm:w-1/2 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-4 py-2.5 text-sm font-bold text-[var(--md-sys-color-on-surface)] outline-none focus:border-[var(--md-sys-color-primary)] shadow-sm" value={distEnd} onChange={(e) => setDistEnd(e.target.value)} />
                    </div>
                )}
            </div>
        </div>
        <p className="text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] mb-5">The flow chart below uses broker-to-broker distribution edges returned by the live API.</p>

        {/* Estimated Counterparties */}
        {dist.edges.length > 0 ? (
            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] p-5 shadow-sm transition-colors duration-300">
                <h4 className="text-sm font-extrabold text-[var(--md-sys-color-on-surface)] mb-4 tracking-tight">
                   Estimated Counterparties on {distMode === "Single day" ? distDate : `${distStart} to ${distEnd}`}
                </h4>
                <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] space-y-2 pr-2">
                {dist.edges.map((e: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-xl px-4 py-3 shadow-sm hover:border-[var(--md-sys-color-primary)] transition-colors">
                    <div className="flex items-center gap-2.5 w-1/3">
                        <span className="text-[var(--color-positive)] font-mono font-extrabold">{e.buyer_code}</span>
                        <span className="text-[9px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">{e.buyer_type}</span>
                    </div>
                    <div className="w-1/3 text-center">
                        <Icon icon="ph:arrow-right-bold" className="text-[var(--md-sys-color-outline)] inline-block" width="16" />
                    </div>
                    <div className="flex items-center justify-end gap-2.5 w-1/3">
                        <span className="text-[9px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider">{e.seller_type}</span>
                        <span className="text-[var(--color-negative)] font-mono font-extrabold">{e.seller_code}</span>
                    </div>
                    <span className="text-[var(--md-sys-color-on-surface)] font-mono font-extrabold tabular-nums ml-4">{fmtRp(e.matched_value)}</span>
                    </div>
                ))}
                </div>
            </div>
        ) : (
            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] p-5 shadow-sm mt-4 text-center text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] py-8 transition-colors duration-300">
                No distribution data found for the selected dates.
            </div>
        )}
      </div>

      {/* ====== BROKER SUMMARY ====== */}
      <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm transition-colors duration-300">
        <label className="block text-[10px] font-extrabold text-[var(--md-sys-color-on-surface)] uppercase tracking-widest mb-4">Broker Summary</label>
        <div className="bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] shadow-sm overflow-hidden transition-colors duration-300">
            <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] pb-2">
                <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="sticky top-0 bg-[var(--md-sys-color-surface-container-highest)] z-10 shadow-sm">
                    <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                        <th className="py-3 px-4">Buy Broker</th>
                        <th className="py-3 px-4">Buy Type</th>
                        <th className="py-3 px-4 text-right">Buy Value</th>
                        <th className="py-3 px-4 text-right">Buy Lot</th>
                        <th className="py-3 px-4 text-right">Buy Avg</th>
                        <th className="py-3 px-4">Sell Broker</th>
                        <th className="py-3 px-4">Sell Type</th>
                        <th className="py-3 px-4 text-right">Sell Value</th>
                        <th className="py-3 px-4 text-right">Sell Lot</th>
                        <th className="py-3 px-4 text-right">Sell Avg</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40">
                    {summary.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                        <td className="py-3 px-4 text-[var(--md-sys-color-on-surface)] font-extrabold font-mono">{row.buy_broker || ""}</td>
                        <td className="py-3 px-4 font-bold uppercase text-[var(--md-sys-color-on-surface-variant)]">{row.buy_type || ""}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface)]">{fmtRp(row.buy_value)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.buy_lot ? row.buy_lot.toLocaleString("id-ID") : "None"}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.buy_avg ? row.buy_avg.toFixed(0) : "None"}</td>
                        <td className="py-3 px-4 text-[var(--md-sys-color-on-surface)] font-extrabold font-mono">{row.sell_broker || ""}</td>
                        <td className="py-3 px-4 font-bold uppercase text-[var(--md-sys-color-on-surface-variant)]">{row.sell_type || ""}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface)]">{fmtRp(row.sell_value)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.sell_lot ? row.sell_lot.toLocaleString("id-ID") : "None"}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.sell_avg ? row.sell_avg.toFixed(0) : "None"}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* ====== DETAILED BROKER ROWS ====== */}
      <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-6 shadow-sm transition-colors duration-300">
        <label className="block text-[10px] font-extrabold text-[var(--md-sys-color-on-surface)] uppercase tracking-widest mb-4">Detailed broker rows</label>
        <div className="bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-[20px] shadow-sm overflow-hidden transition-colors duration-300">
            <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] pb-2">
                <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="sticky top-0 bg-[var(--md-sys-color-surface-container-highest)] z-10 shadow-sm">
                    <tr className="text-[var(--md-sys-color-on-surface-variant)] border-b border-[var(--md-sys-color-outline-variant)] text-[9px] uppercase tracking-widest font-extrabold">
                        <th className="py-3 px-4">Broker</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Buy</th>
                        <th className="py-3 px-4 text-right">Sell</th>
                        <th className="py-3 px-4 text-right">Net</th>
                        <th className="py-3 px-4 text-right">Freq</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40">
                    {detailRows.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors">
                        <td className="py-3 px-4 text-[var(--md-sys-color-on-surface)] font-extrabold font-mono">{row.broker}</td>
                        <td className="py-3 px-4 font-bold uppercase text-[var(--md-sys-color-on-surface-variant)]">{row.type}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface)]">{row.buy ? fmtRp(row.buy) : "Rp 0"}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface)]">{row.sell ? fmtRp(row.sell) : "Rp 0"}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[var(--md-sys-color-on-surface-variant)]">{row.freq ? row.freq.toFixed(6) : "0"}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
      
    </div>
  );
}
