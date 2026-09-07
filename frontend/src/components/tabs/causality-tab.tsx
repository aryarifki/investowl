"use client";
import { MetricCard } from "@/components/metric-card";

export function CausalityTab({ data }: { data: any }) {
  if (!data) return null;

  const foreignCausality = data.foreign_causality;
  const partCausality = data.part_causality || [];
  const brokerCausality = data.broker_causality || [];

  return (
    <div className="space-y-4">
      <div className="panel-base">
        <h3 className="text-sm font-bold mb-3">Causality Insight</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <MetricCard 
            label="Foreign Flow Granger" 
            value={foreignCausality ? (foreignCausality.is_significant ? "Significant" : "Not Significant") : "Unavailable"} 
            note={foreignCausality ? `p=${foreignCausality.min_p_value?.toFixed(4)}, lag ${foreignCausality.best_lag}` : "insufficient observations"} 
            tone={foreignCausality ? (foreignCausality.is_significant ? "positive" : "warning") : "warning"} 
          />
          <MetricCard 
            label="Conviction Model" 
            value={`${data.conviction_score?.toFixed(1) || "-"}/100`} 
            note="hover score card for formula" 
            tone={data.conviction_breakdown?.score >= 70 ? "positive" : data.conviction_breakdown?.score >= 40 ? "warning" : "negative"} 
          />
          <MetricCard 
            label="Broker Validation" 
            value={data.conviction_breakdown?.broker_note || "-"} 
            note="historical forward returns" 
            tone={null} 
          />
        </div>

        <div className="mb-4 p-3 bg-[#232B3B] rounded-md text-xs text-[#94A3B8] border border-[#232B3B]">
          <span className="font-bold text-[#E6E0E9]">Score Breakdown: </span>
          {data.breakdown}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Participant Type</h4>
            {partCausality.length === 0 ? (
              <p className="text-xs text-[#64748b]">Insufficient participant history.</p>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead className="sticky top-0 bg-[#151B26]">
                    <tr className="text-[#64748b] border-b border-[#232B3B]">
                      <th className="text-left py-1 pr-2">Participant</th>
                      <th className="text-right py-1 pr-2">Lag</th>
                      <th className="text-right py-1 pr-2">P Value</th>
                      <th className="text-center py-1">Significant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partCausality.map((row: any, i: number) => (
                      <tr key={i} className="table-row">
                        <td className="py-1 pr-2 text-[#94A3B8]">{row.participant}</td>
                        <td className="py-1 pr-2 text-right font-mono text-[#64748b]">{row.lag}</td>
                        <td className="py-1 pr-2 text-right font-mono text-[#64748b]">{row.p_value?.toFixed(4)}</td>
                        <td className="py-1 text-center">
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
            <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Top Broker Causality</h4>
            {brokerCausality.length === 0 ? (
              <p className="text-xs text-[#64748b]">Insufficient broker history.</p>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead className="sticky top-0 bg-[#151B26]">
                    <tr className="text-[#64748b] border-b border-[#232B3B]">
                      <th className="text-left py-1 pr-2">Broker</th>
                      <th className="text-right py-1 pr-2">Lag</th>
                      <th className="text-right py-1 pr-2">P Value</th>
                      <th className="text-center py-1">Significant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokerCausality.map((row: any, i: number) => (
                      <tr key={i} className="table-row">
                        <td className="py-1 pr-2 font-mono">{row.code}</td>
                        <td className="py-1 pr-2 text-right font-mono text-[#64748b]">{row.lag}</td>
                        <td className="py-1 pr-2 text-right font-mono text-[#64748b]">{row.p_value?.toFixed(4)}</td>
                        <td className="py-1 text-center">
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
