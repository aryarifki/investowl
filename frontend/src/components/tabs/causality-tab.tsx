"use client";
import useSWR from "swr";
import { MetricCard } from "@/components/metric-card";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function CausalityTab({ ticker }: { ticker: string }) {
  const { data, error, isLoading } = useSWR(
    `http://127.0.0.1:8080/api/v1/causality/${ticker}`,
    fetcher
  );

  if (isLoading) return <div className="text-[#64748b] text-sm p-4">Loading causality data...</div>;
  if (error) return <div className="text-red-500 text-sm p-4">Error loading causality data.</div>;
  if (!data) return null;

  const foreignCausality = data.granger_test;
  const partCausality = data.participant_causality || [];
  const brokerCausality = data.top_brokers || [];

  return (
    <div className="space-y-4">
      <div className="bg-[#151B26] border border-[#232B3B] rounded-md p-4">
        <h3 className="text-sm font-bold mb-4">Causality Insight</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <MetricCard 
            label="Foreign Flow Granger" 
            value={foreignCausality ? (foreignCausality.is_significant ? "Significant" : "Not Significant") : "Unavailable"} 
            note={foreignCausality ? `p=${foreignCausality.min_p_value?.toFixed(4)}, lag ${foreignCausality.best_lag}` : "insufficient observations"} 
            tone={foreignCausality ? (foreignCausality.is_significant ? "positive" : "warning") : "warning"} 
          />
          <MetricCard 
            label="Causality Model Status" 
            value={foreignCausality ? "Computed" : "Error"} 
            note="Granger test status" 
            tone={foreignCausality ? "positive" : "negative"} 
          />
          <MetricCard 
            label="Participant History" 
            value={`${partCausality.length} records`} 
            note="participant types found" 
            tone={partCausality.length > 0 ? "positive" : "warning"} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">Participant Type</h4>
            {partCausality.length === 0 ? (
              <p className="text-xs text-[#64748b]">Insufficient participant history.</p>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto border border-[#232B3B] rounded-md">
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead className="sticky top-0 bg-[#151B26]">
                    <tr className="text-[#64748b] border-b border-[#232B3B]">
                      <th className="text-left py-2 px-3">Participant</th>
                      <th className="text-right py-2 px-3">Lag</th>
                      <th className="text-right py-2 px-3">P Value</th>
                      <th className="text-center py-2 px-3">Significant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partCausality.map((row: any, i: number) => (
                      <tr key={i} className="table-row">
                        <td className="py-2 px-3 text-[#E6E0E9]">{row.participant}</td>
                        <td className="py-2 px-3 text-right font-mono text-[#94A3B8]">{row.lag}</td>
                        <td className="py-2 px-3 text-right font-mono text-[#94A3B8]">{row.p_value?.toFixed(4)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.is_significant ? "bg-emerald-900/30 text-emerald-400" : "bg-[#232B3B] text-[#64748b]"}`}>
                            {row.is_significant ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">Top Broker Causality</h4>
            {brokerCausality.length === 0 ? (
              <p className="text-xs text-[#64748b]">Insufficient broker history.</p>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto border border-[#232B3B] rounded-md">
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead className="sticky top-0 bg-[#151B26]">
                    <tr className="text-[#64748b] border-b border-[#232B3B]">
                      <th className="text-left py-2 px-3">Broker</th>
                      <th className="text-right py-2 px-3">Lag</th>
                      <th className="text-right py-2 px-3">P Value</th>
                      <th className="text-center py-2 px-3">Significant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokerCausality.map((row: any, i: number) => (
                      <tr key={i} className="table-row">
                        <td className="py-2 px-3 font-mono text-[#E6E0E9]">{row.code}</td>
                        <td className="py-2 px-3 text-right font-mono text-[#94A3B8]">{row.lag}</td>
                        <td className="py-2 px-3 text-right font-mono text-[#94A3B8]">{row.p_value?.toFixed(4)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.is_significant ? "bg-emerald-900/30 text-emerald-400" : "bg-[#232B3B] text-[#64748b]"}`}>
                            {row.is_significant ? "Yes" : "No"}
                          </span>
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
    </div>
  );
}
