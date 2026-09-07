"use client";
import { useState } from "react";
import useSWR from "swr";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { fmtRp, fmtPct, signedColor } from "@/components/metric-card";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function participant_color(label: string): string {
  return {
    "FOREIGN": "#dc3545",
    "LOCAL": "#7c3aed",
    "GOV": "#0f9f6e",
  }[label] || "#94a3b8";
}

export function BrokerFlowTab({ ticker, windowDays }: { ticker: string; windowDays: number }) {
  const [compareMode, setCompareMode] = useState(true);
  const [maxBrokers, setMaxBrokers] = useState(5);
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);
  const [flowMode, setFlowMode] = useState("Cumulative");
  const [selectedProfile, setSelectedProfile] = useState("All Profiles");

  const qs = `?lookback_days=${windowDays}`;
  const { data, error, isLoading } = useSWR(
    `http://127.0.0.1:8080/api/v1/broker_flow/${ticker}/broker_flow${qs}`,
    fetcher
  );

  if (isLoading) return <div className="text-neutral-500 text-sm p-4">Loading broker flow data...</div>;
  if (error) return <div className="text-red-500 text-sm p-4">Error loading broker flow data.</div>;
  if (!data) return null;

  // Default selected brokers
  const defaultCodes = data.default_codes || [];
  const currentSelected = selectedBrokers.length > 0 ? selectedBrokers : defaultCodes;
  
  // Prepare chart data
  const activityData = data.broker_distribution?.dist || [];
  let chartData: any[] = [];
  
  if (activityData.length > 0 && currentSelected.length > 0) {
    const filtered = activityData.filter((d: any) => currentSelected.includes(d.broker_code));
    const grouped: { [key: string]: { [broker: string]: number } } = {};
    
    filtered.forEach((d: any) => {
      const date = d.date;
      if (!grouped[date]) grouped[date] = {};
      grouped[date][d.broker_code] = (grouped[date][d.broker_code] || 0) + (d.net_value || 0);
    });
    
    const sortedDates = Object.keys(grouped).sort();
    let cumulative: { [broker: string]: number } = {};
    
    chartData = sortedDates.map(date => {
      const row: any = { date };
      currentSelected.forEach(broker => {
        const val = grouped[date][broker] || 0;
        if (flowMode === "Cumulative") {
          cumulative[broker] = (cumulative[broker] || 0) + val;
          row[broker] = cumulative[broker] / 1e9;
        } else {
          row[broker] = val / 1e9;
        }
      });
      return row;
    });
  }

  // Profile flow data
  const profileFlow = data.profile_flow || [];
  const profileDetail = data.profile_broker_detail || [];
  
  // Filter profile detail
  const filteredProfileDetail = selectedProfile === "All Profiles" 
    ? profileDetail 
    : profileDetail.filter((r: any) => r.Profile === selectedProfile);

  // Distribution data
  const distData = data.broker_distribution || {};
  const paths = distData.paths || [];
  const summary = distData.summary || [];
  const detail = distData.detail || [];

  // Sankey nodes and links
  const nodeMap: { [key: string]: number } = {};
  const nodeLabels: string[] = [];
  const nodeColors: string[] = [];
  
  paths.forEach((p: any) => {
    const bKey = `B:${p.buyer_code}`;
    const sKey = `S:${p.seller_code}`;
    if (!(bKey in nodeMap)) {
      nodeMap[bKey] = nodeLabels.length;
      nodeLabels.push(p.buyer_code);
      nodeColors.push(participant_color(p.buyer_type));
    }
    if (!(sKey in nodeMap)) {
      nodeMap[sKey] = nodeLabels.length;
      nodeLabels.push(p.seller_code);
      nodeColors.push(participant_color(p.seller_type));
    }
  });

  return (
    <div className="space-y-4">
      {/* Broker Drill-Down */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
        <h3 className="text-sm font-bold mb-3">Broker Drill-Down</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Compare Mode</label>
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`w-full px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                compareMode
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700"
              }`}
            >
              {compareMode ? "ON" : "OFF"}
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Max Brokers</label>
            <select
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm"
              value={maxBrokers}
              onChange={(e) => setMaxBrokers(e.target.value === "All" ? 999 : Number(e.target.value))}
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value="All">All</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Broker Codes</label>
            <select
              multiple
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm min-h-[38px] max-h-[60px]"
              value={currentSelected}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                if (maxBrokers !== 999 && selected.length > maxBrokers) return;
                setSelectedBrokers(selected);
              }}
            >
              {data.broker_codes?.map((code: string) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Flow Mode</label>
            <select
              className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm"
              value={flowMode}
              onChange={(e) => setFlowMode(e.target.value)}
            >
              <option value="Cumulative">Cumulative</option>
              <option value="Daily">Daily</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mb-3">
          Cumulative mode sums broker net flow across the selected broker window. Daily mode shows each date separately.
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: "8px", fontSize: "12px", color: "#fafafa" }} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
              {currentSelected.map((broker: string) => (
                <Line
                  key={broker}
                  type="monotone"
                  dataKey={broker}
                  stroke={`hsl(${Math.random() * 360}, 70%, 50%)`}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Profile Flow & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-4">
        {/* Profile Flow */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">Broker Profile Flow</h3>
          {profileFlow.length === 0 ? (
            <p className="text-xs text-neutral-500">No broker-profile flow for this date window.</p>
          ) : (
            <div className="space-y-4">
              {profileFlow.map((row: any, i: number) => {
                const maxAbs = Math.max(...profileFlow.map((r: any) => Math.abs(r.net)), 1);
                const width = Math.max(3, (Math.abs(row.net) / maxAbs) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <div>
                        <span className="text-neutral-200 font-semibold">{row.label}</span>
                        <span className="block text-[10px] text-neutral-500 mt-0.5">{row.description}</span>
                      </div>
                      <span className="font-mono font-bold" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</span>
                    </div>
                    <div className="h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full" style={{ width: width + "%", backgroundColor: signedColor(row.net) }} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {row.top_brokers?.slice(0, 6).map((b: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[10px] border border-neutral-200 dark:border-neutral-700">
                          <span className="font-mono font-bold">{b.broker_code}</span>
                          <span className="text-neutral-500 border-l border-neutral-300 dark:border-neutral-600 pl-1">{b.participant_type}</span>
                          <span className="font-mono pl-1" style={{ color: signedColor(b.net) }}>{fmtRp(b.net)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {/* Profile Detail Table */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Profile Detail</label>
                <select
                  className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm mb-2"
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
                    <thead className="sticky top-0 bg-white dark:bg-neutral-900">
                      <tr className="text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
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
                        <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800/50">
                          <td className="py-1 pr-2 text-neutral-400">{row.Profile}</td>
                          <td className="py-1 pr-2 font-mono">{row.Broker}</td>
                          <td className="py-1 pr-2 text-neutral-400">{row.Type}</td>
                          <td className="py-1 pr-2 text-right font-mono text-emerald-500">{fmtRp(row.Buy)}</td>
                          <td className="py-1 pr-2 text-right font-mono text-red-500">{fmtRp(row.Sell)}</td>
                          <td className="py-1 pr-2 text-right font-mono" style={{ color: signedColor(row.Net) }}>{fmtRp(row.Net)}</td>
                          <td className="py-1 pr-2 text-right font-mono text-neutral-400">{row.Freq}</td>
                          <td className="py-1 pr-2 text-right font-mono text-neutral-400">{row.Days}</td>
                          <td className="py-1 text-right font-mono text-neutral-400">{fmtRp(row["Avg Value / Tx"])}</td>
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
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">Broker Distribution</h3>
          
          {/* Distribution Date Selector */}
          <div className="flex gap-2 mb-3">
            <select className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm">
              <option>Single day</option>
              <option>Date range</option>
            </select>
            <select className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm flex-1">
              {data.available_dist_dates?.map((d: string) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Sankey Diagram (simplified as text for now) */}
          {paths.length === 0 ? (
            <p className="text-xs text-neutral-500 mb-4">No distribution rows for this date range.</p>
          ) : (
            <>
              <p className="text-xs text-neutral-500 mb-2">
                Exact broker-to-broker counterparties are unavailable. The flow chart below falls back to estimated same-day matching based on broker net buy and sell totals.
              </p>
              
              {/* Broker Summary Table */}
              <div className="overflow-x-auto mb-4 max-h-48 overflow-y-auto">
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead className="sticky top-0 bg-white dark:bg-neutral-900">
                    <tr className="text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
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
                      <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800/50">
                        <td className="py-1 pr-2 font-mono">{row["Buy Broker"] || "-"}</td>
                        <td className="py-1 pr-2 text-neutral-400">{row["Buy Type"] || "-"}</td>
                        <td className="py-1 pr-2 text-right font-mono text-emerald-500">{fmtRp(row["Buy Value"])}</td>
                        <td className="py-1 pr-2 text-right font-mono text-neutral-400">{row["Buy Lot"] ? `${(row["Buy Lot"]/1000).toFixed(1)}K` : "-"}</td>
                        <td className="py-1 pr-2 text-right font-mono text-neutral-400">{row["Buy Avg"] ? fmtRp(row["Buy Avg"]) : "-"}</td>
                        <td className="py-1 pr-2 pl-4 font-mono">{row["Sell Broker"] || "-"}</td>
                        <td className="py-1 pr-2 text-neutral-400">{row["Sell Type"] || "-"}</td>
                        <td className="py-1 pr-2 text-right font-mono text-red-500">{fmtRp(row["Sell Value"])}</td>
                        <td className="py-1 pr-2 text-right font-mono text-neutral-400">{row["Sell Lot"] ? `${(row["Sell Lot"]/1000).toFixed(1)}K` : "-"}</td>
                        <td className="py-1 text-right font-mono text-neutral-400">{row["Sell Avg"] ? fmtRp(row["Sell Avg"]) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Detailed Broker Rows */}
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Detailed Broker Rows</h4>
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead className="sticky top-0 bg-white dark:bg-neutral-900">
                    <tr className="text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                      <th className="text-left py-1 pr-2">Broker</th>
                      <th className="text-left py-1 pr-2">Type</th>
                      <th className="text-right py-1 pr-2">Buy</th>
                      <th className="text-right py-1 pr-2">Sell</th>
                      <th className="text-right py-1 pr-2">Net</th>
                      <th className="text-right py-1 pr-2">Freq</th>
                      <th className="text-right py-1 pr-2">Avg/Tx</th>
                      <th className="text-left py-1">Sub-type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800/50">
                        <td className="py-1 pr-2 font-mono">{row.Broker}</td>
                        <td className="py-1 pr-2 text-neutral-400">{row.Type}</td>
                        <td className="py-1 pr-2 text-right font-mono text-emerald-500">{fmtRp(row.Buy)}</td>
                        <td className="py-1 pr-2 text-right font-mono text-red-500">{fmtRp(row.Sell)}</td>
                        <td className="py-1 pr-2 text-right font-mono" style={{ color: signedColor(row.Net) }}>{fmtRp(row.Net)}</td>
                        <td className="py-1 pr-2 text-right font-mono text-neutral-400">{row.Freq}</td>
                        <td className="py-1 pr-2 text-right font-mono text-neutral-400">{fmtRp(row["Avg Value / Tx"])}</td>
                        <td className="py-1 text-neutral-400">{row["Sub-type"]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
