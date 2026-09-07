"use client";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Scatter } from "recharts";
import { fmtRp, fmtPct, signedColor } from "@/components/metric-card";

function signalColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "transparent";
  if (score >= 2) return "#10b981";
  if (score === 1) return "#65a30d";
  if (score === 0) return "#94a3b8";
  if (score === -1) return "#ea580c";
  return "#f43f5e";
}

export function OverviewTab({ data }: { data: any }) {
  if (!data) return null;

  const signalMarkers = (data.signal_overlay || []).filter((d: any) => d.score !== null && d.score !== undefined);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4">
        {/* Price, Volume, and Signal Context */}
        <div className="bg-[#151B26] border border-[#232B3B] rounded-md p-3">
          <h3 className="text-sm font-bold mb-3">Price, Volume, and Signal Context</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.price_chart || []} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232B3B" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} stroke="#232B3B" />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748b" }} stroke="#232B3B" domain={["auto", "auto"]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} stroke="#232B3B" />
                <Tooltip contentStyle={{ background: "#0B0E14", border: "1px solid #232B3B", borderRadius: "8px", fontSize: "12px", color: "#E6E0E9" }} />
                <Bar yAxisId="right" dataKey="volume" fill="#2563eb" opacity={0.3} />
                <Line yAxisId="left" type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Scatter yAxisId="left" data={signalMarkers} dataKey="close" fill="#10b981" shape="circle" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Brokers & Price Performance */}
        <div className="space-y-4">
          <div className="bg-[#151B26] border border-[#232B3B] rounded-md p-3">
            <h3 className="text-sm font-bold mb-2">Top Brokers</h3>
            <p className="text-xs text-[#64748b] mb-2">Broker net buy/sell on analysis date</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#64748b] border-b border-[#232B3B]">
                    <th className="text-left py-1">Side</th>
                    <th className="text-left py-1">Broker</th>
                    <th className="text-left py-1">Type</th>
                    <th className="text-right py-1">Net</th>
                    <th className="text-left py-1 pl-2">5D Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {data.broker_summary?.map((row: any, i: number) => (
                    <tr key={i} className="table-row">
                      <td className="py-1" style={{ color: row.side === "Buy" ? "#0f9f6e" : "#dc3545" }}>{row.side}</td>
                      <td className="py-1 font-mono">{row.broker}</td>
                      <td className="py-1 text-[#64748b]">{row.type}</td>
                      <td className="py-1 text-right font-mono" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</td>
                      <td className="py-1 pl-2 text-[#64748b] font-mono">{row.spark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#151B26] border border-[#232B3B] rounded-md p-3">
            <h3 className="text-sm font-bold mb-2">Price Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#64748b] border-b border-[#232B3B]">
                    <th className="text-left py-1">Period</th>
                    <th className="text-right py-1">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {data.price_performance?.map((row: any, i: number) => (
                    <tr key={i} className="table-row">
                      <td className="py-1 text-[#94A3B8]">{row.period}</td>
                      <td className="py-1 text-right font-mono" style={{ color: signedColor(row.value) }}>{fmtPct(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {/* Smart Flow & Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="bg-[#151B26] border border-[#232B3B] rounded-md p-3">
          <h3 className="text-sm font-bold mb-3">Smart-Money Daily Flow</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.smart_daily || []} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232B3B" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} stroke="#232B3B" />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748b" }} stroke="#232B3B" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} stroke="#232B3B" />
                <Tooltip contentStyle={{ background: "#0B0E14", border: "1px solid #232B3B", borderRadius: "8px", fontSize: "12px", color: "#E6E0E9" }} />
                <Bar yAxisId="left" dataKey="smart_net" fill="#0f9f6e" />
                <Line yAxisId="right" type="monotone" dataKey="cumulative_net" stroke="#2563eb" strokeWidth={2} dot={false} />
                <ReferenceLine yAxisId="left" y={0} stroke="#64748b" strokeWidth={1} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#151B26] border border-[#232B3B] rounded-md p-3">
          <h3 className="text-sm font-bold mb-3">Profile Net Flow</h3>
          {(data.profile_flow || []).length === 0 ? (
            <p className="text-xs text-[#64748b]">No profile flow for this window.</p>
          ) : (
            <div className="space-y-4">
              {data.profile_flow.map((row: any, i: number) => {
                const maxAbs = Math.max(...(data.profile_flow || []).map((r: any) => Math.abs(r.net)), 1);
                const width = Math.max(3, (Math.abs(row.net) / maxAbs) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-[#E6E0E9] font-semibold">{row.label}</span>
                      <span className="font-mono font-bold" style={{ color: signedColor(row.net) }}>{fmtRp(row.net)}</span>
                    </div>
                    <div className="h-1.5 bg-[#232B3B] rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full" style={{ width: width + "%", backgroundColor: signedColor(row.net) }} />
                    </div>
                  </div>
                );
              })}
              
              <details className="mt-4 group">
                <summary className="text-xs font-semibold cursor-pointer text-[#64748b] hover:text-[#94A3B8]">
                  Broker detail by profile
                </summary>
                <div className="overflow-x-auto mt-2 max-h-60 overflow-y-auto">
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
                      {data.profile_broker_detail?.map((row: any, i: number) => (
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
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
