"use client";
import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { fmtRp, fmtPct, signedColor } from "@/components/metric-card";
import { CaretDown, Check, X, MagnifyingGlass, Spinner } from "@phosphor-icons/react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function participant_color(label: string): string {
  return {
    "FOREIGN": "#dc3545",
    "LOCAL": "#7c3aed",
    "GOV": "#0f9f6e",
  }[label] || "#94a3b8";
}

// Helper untuk warna garis yang deterministik (bukan Math.random)
const COLORS = ["#2563eb", "#dc3545", "#0f9f6e", "#f59e0b", "#7c3aed", "#06b6d4", "#ec4899", "#84cc16"];
function getChartColor(index: number) {
  return COLORS[index % COLORS.length];
}

export function BrokerFlowTab({ ticker, windowDays }: { ticker: string; windowDays: number }) {
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
  const [flowMode, setFlowMode] = useState("Cumulative");
  const [selectedProfile, setSelectedProfile] = useState("All Profiles");
  
  const [distMode, setDistMode] = useState("Single day");
  const [distDate, setDistDate] = useState("");
  const [distStart, setDistStart] = useState("");
  const [distEnd, setDistEnd] = useState("");
  
  const [brokerDropdownOpen, setBrokerDropdownOpen] = useState(false);
  const [searchBroker, setSearchBroker] = useState("");
  const brokerDropdownRef = useRef<HTMLDivElement>(null);

  const distParams = distMode === "Single day"
    ? (distDate ? `&dist_mode=Single%20day&dist_date=${distDate}` : '')
    : (distStart && distEnd ? `&dist_mode=Date%20range&dist_start=${distStart}&dist_end=${distEnd}` : '');

  const qs = `?lookback_days=${windowDays}${distParams}`;
  
  const { data, error, isLoading, isValidating } = useSWR(
    `http://127.0.0.1:8080/api/v1/broker_flow/${ticker}/broker_flow${qs}`,
    fetcher,
    { keepPreviousData: true }
  );

  useEffect(() => {
    if (data?.distribution?.dist_date && !distDate && !distStart) {
      setDistDate(data.distribution.dist_date);
      setDistEnd(data.distribution.dist_date);
      setDistStart(data.window_start);
    }
  }, [data, distDate, distStart]);

  useEffect(() => {
    if (data?.default_codes && selectedBrokers.length === 0) {
      setSelectedBrokers(data.default_codes);
    }
  }, [data, selectedBrokers]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (brokerDropdownRef.current && !brokerDropdownRef.current.contains(event.target as Node)) {
        setBrokerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading && !data) return <div className="text-[#64748b] text-sm p-4">Loading broker flow data...</div>;
  if (error && !data) return <div className="text-red-500 text-sm p-4">Error loading broker flow data.</div>;
  if (!data) return null;

  const allBrokerCodes = data.all_codes || [];
  const rankedCodes = data.ranked_codes || [];
  const filteredRankedCodes = searchBroker
    ? rankedCodes.filter((code: string) => code.includes(searchBroker.toUpperCase()))
    : rankedCodes;
  
  const handleBrokerToggle = (code: string) => {
    if (selectedBrokers.includes(code)) {
      setSelectedBrokers(selectedBrokers.filter(c => c !== code));
    } else {
      setSelectedBrokers([...selectedBrokers, code]);
    }
  };

  const handleSelectAllBrokers = () => {
    if (selectedBrokers.length === allBrokerCodes.length) {
      setSelectedBrokers([]);
    } else {
      setSelectedBrokers([...allBrokerCodes]);
    }
  };

  const chartData = data.compare_chart || [];

  const profileFlow = data.profile_flow || [];
  const profileDetail = data.profile_broker_detail || [];
  const filteredProfileDetail = selectedProfile === "All Profiles" 
    ? profileDetail 
    : profileDetail.filter((r: any) => r.profile === selectedProfile);

  const distData = data.distribution || {};
  const paths = distData.edges || [];
  const summary = data.summary || [];
  const detail = data.detail_rows || [];

  return (
    <div className="space-y-4 relative">
      {isValidating && (
        <div className="absolute top-2 right-2 z-50 flex items-center gap-2 text-xs text-blue-500 bg-blue-950/50 px-3 py-1 rounded-full shadow">
          <Spinner size={14} weight="bold" className="animate-spin" />
          <span>Updating...</span>
        </div>
      )}

      {/* Broker Drill-Down */}
      <div className="bg-[#151B26] border border-[#232B3B] rounded-md p-3">
        <h3 className="text-sm font-bold mb-3">Broker Drill-Down</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="col-span-2" ref={brokerDropdownRef}>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Broker Codes</label>
            <div className="relative">
              <button
                onClick={() => setBrokerDropdownOpen(!brokerDropdownOpen)}
                className="w-full flex items-center justify-between bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm"
              >
                <span className="truncate">
                  {selectedBrokers.length === 0 ? "Select Brokers..." : `${selectedBrokers.length} selected`}
                </span>
                <CaretDown size={16} className="text-[#64748b]" />
              </button>
              {brokerDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-[#151B26] border border-[#232B3B] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <div className="sticky top-0 bg-[#151B26] p-2 border-b border-[#232B3B] space-y-2">
                    <div className="relative">
                      <MagnifyingGlass size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#64748b]" />
                      <input
                        type="text"
                        placeholder="Search broker..."
                        value={searchBroker}
                        onChange={(e) => setSearchBroker(e.target.value.toUpperCase())}
                        className="w-full bg-[#232B3B] border border-[#232B3B] rounded pl-7 pr-2 py-1 text-xs focus:outline-none text-[#E6E0E9]"
                      />
                    </div>
                    <button
                      onClick={handleSelectAllBrokers}
                      className="w-full text-left px-2 py-1 text-xs font-semibold text-blue-500 hover:bg-[#232B3B] rounded"
                    >
                      {selectedBrokers.length === allBrokerCodes.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  {filteredRankedCodes.map((code: string) => (
                    <div
                      key={code}
                      onClick={() => handleBrokerToggle(code)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[#232B3B] ${
                        selectedBrokers.includes(code) ? "bg-blue-950/20" : ""
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedBrokers.includes(code) ? "bg-blue-500 border-blue-500" : "border-[#232B3B]"
                      }`}>
                        {selectedBrokers.includes(code) && <Check size={12} className="text-white" weight="bold" />}
                      </div>
                      <span className="font-mono">{code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Flow Mode</label>
            <select
              className="w-full bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm"
              value={flowMode}
              onChange={(e) => setFlowMode(e.target.value)}
            >
              <option value="Cumulative">Cumulative</option>
              <option value="Daily">Daily</option>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="col-span-4">
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Selected Brokers</label>
            <div className="flex flex-wrap gap-2 items-center min-h-[38px]">
              {selectedBrokers.map(code => (
                <div key={code} className="flex items-center gap-1 bg-blue-950/30 text-blue-400 px-2 py-1 rounded text-xs font-mono font-bold border border-blue-900/50">
                  {code}
                  <button onClick={() => handleBrokerToggle(code)} className="hover:text-red-500">
                    <X size={12} weight="bold" />
                  </button>
                </div>
              ))}
              {selectedBrokers.length === 0 && (
                <span className="text-xs text-[#64748b]">No brokers selected</span>
              )}
            </div>
          </div>
        </div>
        
        <p className="text-xs text-[#64748b] mb-3">
          Cumulative mode sums broker net flow across the selected broker window. Daily mode shows each date separately.
        </p>
        <div className="h-72">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232B3B" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} stroke="#232B3B" />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} stroke="#232B3B" />
                <Tooltip contentStyle={{ background: "#0B0E14", border: "1px solid #232B3B", borderRadius: "8px", fontSize: "12px", color: "#E6E0E9" }} />
                <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
                {selectedBrokers.map((broker: string, index: number) => (
                  <Line
                    key={broker}
                    type="monotone"
                    dataKey={broker}
                    stroke={getChartColor(index)}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-[#64748b]">No data to display</div>
          )}
        </div>
      </div>

      {/* Profile Flow & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-4">
        {/* Profile Flow */}
        <div className="bg-[#151B26] border border-[#232B3B] rounded-md p-3">
          <h3 className="text-sm font-bold mb-3">Broker Profile Flow</h3>
          {profileFlow.length === 0 ? (
            <p className="text-xs text-[#64748b]">No broker-profile flow for this date window.</p>
          ) : (
            <div className="space-y-4">
              {profileFlow.map((row: any, i: number) => {
                const maxAbs = Math.max(...profileFlow.map((r: any) => Math.abs(r.net)), 1);
                const width = Math.max(3, (Math.abs(row.net) / maxAbs) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <div>
                        <span className="text-[#E6E0E9] font-semibold">{row.label}</span>
                        <span className="block text-[10px] text-[#64748b] mt-0.5">{row.description}</span>
                      </div>
                      <span className="font-mono font-bold" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</span>
                    </div>
                    <div className="h-1.5 bg-[#232B3B] rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full" style={{ width: width + "%", backgroundColor: signedColor(row.net) }} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {row.top_brokers?.slice(0, 6).map((b: any, idx: number) => (
                        <div key={idx} className="chip">
                          <span className="font-mono font-bold">{b.broker_code}</span>
                          <span className="text-[#64748b] border-l border-[#232B3B] pl-1">{b.participant_type}</span>
                          <span className="font-mono pl-1" style={{ color: signedColor(b.net) }}>{fmtRp(b.net)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              <div>
                <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Profile Detail</label>
                <select
                  className="w-full bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm mb-2"
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                >
                  <option value="All Profiles">All Profiles</option>
                  {profileFlow.map((p: any) => (
                    <option key={p.profile} value={p.label}>{p.label}</option>
                  ))}
                </select>
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-[11px] whitespace-nowrap">
                    <thead className="sticky top-0 bg-[#151B26]">
                      <tr className="text-[#64748b] border-b border-[#232B3B]">
                        <th className="text-left py-1 pr-2">Profile</th>
                        <th className="text-left py-1 pr-2">Broker</th>
                        <th className="text-left py-1 pr-2">Type</th>
                        <th className="text-right py-1 pr-2">Buy</th>
                        <th className="text-right py-1 pr-2">Sell</th>
                        <th className="text-right py-1 pr-2">Net</th>
                        <th className="text-right py-1 pr-2">Freq</th>
                        <th className="text-right py-1 pr-2">Days</th>
                        <th className="text-right py-1">Avg/Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProfileDetail.map((row: any, i: number) => (
                        <tr key={i} className="table-row">
                          <td className="py-1 pr-2 text-[#64748b]">{row.profile}</td>
                          <td className="py-1 pr-2 font-mono">{row.broker}</td>
                          <td className="py-1 pr-2 text-[#64748b]">{row.type}</td>
                          <td className="py-1 pr-2 text-right font-mono text-emerald-500">{fmtRp(row.buy)}</td>
                          <td className="py-1 pr-2 text-right font-mono text-red-500">{fmtRp(row.sell)}</td>
                          <td className="py-1 pr-2 text-right font-mono" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</td>
                          <td className="py-1 pr-2 text-right font-mono text-[#64748b]">{row.freq}</td>
                          <td className="py-1 pr-2 text-right font-mono text-[#64748b]">{row.days}</td>
                          <td className="py-1 text-right font-mono text-[#64748b]">{fmtRp(row.avg_value_tx)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Broker Distribution */}
        <div className="bg-[#151B26] border border-[#232B3B] rounded-md p-3">
          <h3 className="text-sm font-bold mb-3">Broker Distribution</h3>
          
          <div className="grid grid-cols-3 gap-2 mb-3">
            <select 
              className="bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm"
              value={distMode}
              onChange={(e) => setDistMode(e.target.value)}
            >
              <option value="Single day">Single day</option>
              <option value="Date range">Date range</option>
            </select>
            
            {distMode === "Single day" ? (
              <input
                type="date"
                className="col-span-2 bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm"
                value={distDate}
                onChange={(e) => setDistDate(e.target.value)}
              />
            ) : (
              <>
                <input
                  type="date"
                  className="bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm"
                  value={distStart}
                  onChange={(e) => setDistStart(e.target.value)}
                  max={distEnd}
                />
                <input
                  type="date"
                  className="bg-[#0B0E14] border border-[#232B3B] rounded-lg px-3 py-2 text-sm"
                  value={distEnd}
                  onChange={(e) => setDistEnd(e.target.value)}
                  min={distStart}
                />
              </>
            )}
          </div>

          {paths.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Estimated Counterparties on {data.dist_start} to {data.dist_end}</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {paths.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-[#0B0E14] p-2 rounded border border-[#232B3B]">
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold">{p.buyer_code}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded text-white" style={{ backgroundColor: participant_color(p.buyer_type) }}>{p.buyer_type}</span>
                    </div>
                    <span className="text-[#64748b]">→</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold">{p.seller_code}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded text-white" style={{ backgroundColor: participant_color(p.seller_type) }}>{p.seller_type}</span>
                    </div>
                    <span className="ml-auto font-mono font-bold" style={{ color: signedColor(p.matched_value) }}>{fmtRp(p.matched_value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Broker Summary</h4>
          <div className="overflow-x-auto mb-4 max-h-48 overflow-y-auto">
            <table className="w-full text-[11px] whitespace-nowrap">
              <thead className="sticky top-0 bg-[#151B26]">
                <tr className="text-[#64748b] border-b border-[#232B3B]">
                  <th className="text-left py-1 pr-2">Buy Broker</th>
                  <th className="text-left py-1 pr-2">Type</th>
                  <th className="text-right py-1 pr-2">Value</th>
                  <th className="text-right py-1 pr-2">Lot</th>
                  <th className="text-right py-1 pr-2">Avg</th>
                  <th className="text-left py-1 pr-2 pl-4">Sell Broker</th>
                  <th className="text-left py-1 pr-2">Type</th>
                  <th className="text-right py-1 pr-2">Value</th>
                  <th className="text-right py-1 pr-2">Lot</th>
                  <th className="text-right py-1">Avg</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row: any, i: number) => (
                  <tr key={i} className="table-row">
                    <td className="py-1 pr-2 font-mono">{row.buy_broker || "-"}</td>
                    <td className="py-1 pr-2 text-[#64748b]">{row.buy_type || "-"}</td>
                    <td className="py-1 pr-2 text-right font-mono text-emerald-500">{fmtRp(row.buy_value)}</td>
                    <td className="py-1 pr-2 text-right font-mono text-[#64748b]">{row.buy_lot ? `${(row.buy_lot/1000).toFixed(1)}K` : "-"}</td>
                    <td className="py-1 pr-2 text-right font-mono text-[#64748b]">{row.buy_avg ? fmtRp(row.buy_avg) : "-"}</td>
                    <td className="py-1 pr-2 pl-4 font-mono">{row.sell_broker || "-"}</td>
                    <td className="py-1 pr-2 text-[#64748b]">{row.sell_type || "-"}</td>
                    <td className="py-1 pr-2 text-right font-mono text-red-500">{fmtRp(row.sell_value)}</td>
                    <td className="py-1 pr-2 text-right font-mono text-[#64748b]">{row.sell_lot ? `${(row.sell_lot/1000).toFixed(1)}K` : "-"}</td>
                    <td className="py-1 text-right font-mono text-[#64748b]">{row.sell_avg ? fmtRp(row.sell_avg) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Detailed Broker Rows</h4>
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-[11px] whitespace-nowrap">
              <thead className="sticky top-0 bg-[#151B26]">
                <tr className="text-[#64748b] border-b border-[#232B3B]">
                  <th className="text-left py-1 pr-2">Broker</th>
                  <th className="text-left py-1 pr-2">Type</th>
                  <th className="text-right py-1 pr-2">Buy</th>
                  <th className="text-right py-1 pr-2">Sell</th>
                  <th className="text-right py-1 pr-2">Net</th>
                  <th className="text-right py-1 pr-2">Freq</th>
                </tr>
              </thead>
              <tbody>
                {detail.map((row: any, i: number) => (
                  <tr key={i} className="table-row">
                    <td className="py-1 pr-2 font-mono">{row.broker}</td>
                    <td className="py-1 pr-2 text-[#64748b]">{row.type}</td>
                    <td className="py-1 pr-2 text-right font-mono text-emerald-500">{fmtRp(row.buy)}</td>
                    <td className="py-1 pr-2 text-right font-mono text-red-500">{fmtRp(row.sell)}</td>
                    <td className="py-1 pr-2 text-right font-mono" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</td>
                    <td className="py-1 pr-2 text-right font-mono text-[#64748b]">{row.freq}</td>
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
