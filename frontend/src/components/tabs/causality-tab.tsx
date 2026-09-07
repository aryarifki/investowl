"use client";
import { MetricCard } from "@/components/metric-card";

function english_text(value: any): any {
  if (value === null || value === undefined) return value;
  const mapping: { [key: string]: string } = {
    "Asing": "Foreign",
    "Lokal": "Local",
    "Pemerintah": "Government",
  };
  return mapping[String(value)] || value;
}

export function CausalityTab({ data }: { data: any }) {
  if (!data) return null;

  const foreignCausality = data.foreign_causality;
  const partCausality = data.part_causality || [];
  const brokerCausality = data.broker_causality || [];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
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
            tone={data.score_tone_name} 
            accent={data.score_tone_name === "positive" ? "#10b981" : data.score_tone_name === "warning" ? "#f59e0b" : "#f43f5e"}
          />
          <MetricCard 
            label="Broker Validation" 
            value={data.broker_note || "-"} 
            note="historical forward returns" 
            tone={null} 
          />
        </div>

        <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-xs text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
          <span className="font-bold text-neutral-700 dark:text-neutral-200">Score Breakdown: </span>
          {data.breakdown}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Participant Type */}
          <div>
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Participant Type</h4>
            {partCausality.length === 0 ? (
              <p className="text-xs text-neutral-500">Insufficient participant history.</p>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead className="sticky top-0 bg-white dark:bg-neutral-900">
                    <tr className="text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                      <th className="text-left py-1 pr-2">Participant</th>
                      <th className="text-right py-1 pr-2">Lag</th>
                      <th className="text-right py-1 pr-2">P Value</th>
                      <th className="text-center py-1">Significant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partCausality.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800/50">
                        <td className="py-1 pr-2 text-neutral-300">{english_text(row.Participant)}</td>
                        <td className="py-1 pr-2 text-right font-mono text-neutral-400">{row.Lag}</td>
                        <td className="py-1 pr-2 text-right font-mono text-neutral-400">{row["P Value"]?.toFixed(4)}</td>
                        <td className="py-1 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.Significant ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"}`}>
                            {row.Significant ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Broker Causality */}
          <div>
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Top Broker Causality</h4>
            {brokerCausality.length === 0 ? (
              <p className="text-xs text-neutral-500">Insufficient broker history.</p>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-[11px] whitespace-nowrap">
                  <thead className="sticky top-0 bg-white dark:bg-neutral-900">
                    <tr className="text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                      <th className="text-left py-1 pr-2">Broker</th>
                      <th className="text-right py-1 pr-2">Lag</th>
                      <th className="text-right py-1 pr-2">P Value</th>
                      <th className="text-center py-1">Significant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokerCausality.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800/50">
                        <td className="py-1 pr-2 font-mono">{row.Broker}</td>
                        <td className="py-1 pr-2 text-right font-mono text-neutral-400">{row.Lag}</td>
                        <td className="py-1 pr-2 text-right font-mono text-neutral-400">{row["P Value"]?.toFixed(4)}</td>
                        <td className="py-1 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.Significant ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"}`}>
                            {row.Significant ? "Yes" : "No"}
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
