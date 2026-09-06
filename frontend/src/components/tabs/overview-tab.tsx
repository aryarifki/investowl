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

  const signalMarkers = (data.price_context || []).filter((d: any) => d.bandar_signal_score !== null && d.bandar_signal_score !== undefined);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4">
        {/* Price, Volume, and Signal Context (Compact Height) */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">Price, Volume, and Signal Context</h3>
          <div className="h-64"> {/* Dikecilkan dari h-96 */}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.price_context || []} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#94a3b8" />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#94a3b8" domain={["auto", "auto"]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: "8px", fontSize: "12px", color: "#fafafa" }} />
                <Bar yAxisId="right" dataKey="volume" fill="#3b82f6" opacity={0.3} />
                <Line yAxisId="left" type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Scatter yAxisId="left" data={signalMarkers} dataKey="close" fill="#10b981" shape="circle" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Brokers & Price Performance */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
            <h3 className="text-sm font-bold mb-2">Top Brokers</h3>
            <p className="text-xs text-neutral-500 mb-2">Broker net buy/sell on analysis date</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                    <th className="text-left py-1">Side</th>
                    <th className="text-left py-1">Broker</th>
                    <th className="text-left py-1">Type</th>
                    <th className="text-right py-1">Net</th>
                    <th className="text-left py-1 pl-2">5D Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_brokers_compact?.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800/50">
                      <td className="py-1" style={{ color: row.side === "Buy" ? "#10b981" : "#f43f5e" }}>{row.side}</td>
                      <td className="py-1 font-mono">{row.broker_code}</td>
                      <td className="py-1 text-neutral-400">{row.participant_type}</td>
                      <td className="py-1 text-right font-mono" style={{ color: signedColor(row.net_value) }}>{fmtRp(row.net_value)}</td>
                      <td className="py-1 pl-2 text-neutral-400 font-mono">{row.sparkline}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
            <h3 className="text-sm font-bold mb-2">Price Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                    <th className="text-left py-1">Period</th>
                    <th className="text-right py-1">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {data.price_performance?.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800/50">
                      <td className="py-1 text-neutral-300">{row.timeframe}</td>
                      <td className="py-1 text-right font-mono" style={{ color: signedColor(row.return) }}>{fmtPct(row.return)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {/* Smart Flow & Profile (Compact Height) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">Smart-Money Daily Flow</h3>
          <div className="h-48"> {/* Dikecilkan dari h-72 */}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.daily_smart || []} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#94a3b8" />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#94a3b8" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", borderRadius: "8px", fontSize: "12px", color: "#fafafa" }} />
                <Bar yAxisId="left" dataKey="smart_net" fill="#10b981" />
                <Line yAxisId="right" type="monotone" dataKey="cumulative_net" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <ReferenceLine yAxisId="left" y={0} stroke="#94a3b8" strokeWidth={1} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">Profile Net Flow</h3>
          {(data.profile_flow || []).length === 0 ? (
            <p className="text-xs text-neutral-500">No profile flow for this window.</p>
          ) : (
            <div className="space-y-3">
              {data.profile_flow.map((row: any, i: number) => {
                const maxAbs = Math.max(...(data.profile_flow || []).map((r: any) => Math.abs(r.net)), 1);
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
                      {row.top_brokers?.slice(0, 3).map((b: any, idx: number) => (
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
              
              {/* Profile Broker Detail Table (Lengkap 9 Kolom) */}
              <details className="mt-4 group">
                <summary className="text-xs font-semibold cursor-pointer text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                  Broker detail by profile
                </summary>
                <div className="overflow-x-auto mt-2 max-h-60 overflow-y-auto"> {/* Tambah max-h agar bisa scroll */}
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
                      {data.profile_broker_detail?.map((row: any, i: number) => (
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
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
