"use client";
import { MetricCard } from "@/components/metric-card";

// Mapping teks Inggris seperti di app.py
function english_text(value: any): any {
  if (value === null || value === undefined) return value;
  const mapping: { [key: string]: string } = {
    "Asing": "Foreign",
    "Lokal": "Local",
    "Pemerintah": "Government",
    "AKUMULASI_KUAT": "Strong Accumulation",
    "AKUMULASI": "Accumulation",
    "DISTRIBUSI_KUAT": "Strong Distribution",
    "DISTRIBUSI": "Distribution",
    "NETRAL": "Neutral",
  };
  return mapping[String(value)] || value;
}

export function CausalityTab({ data }: { data: any }) {
  if (!data) return null;

  // Data dari backend
  const foreignCausality = data.foreign_causality;
  const partCausality = data.part_causality || [];
  const brokerCausality = data.broker_causality || [];
  
  // Nilai untuk Metric Cards
  const scoreValue = data.conviction_score;
  const scoreToneName = scoreValue >= 70 ? "positive" : scoreValue >= 40 ? "warning" : "negative";
  const brokerNote = data.conviction_breakdown?.broker_note || "-";

  return (
    <div className="space-y-4">
      <div className="bg-[#151B26] border border-[#232B3B] rounded-md p-4">
        <h3 className="text-sm font-bold mb-4">Causality Insight</h3>
        
        {/* 3 Metric Cards (Persis app.py) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <MetricCard 
            label="Foreign Flow Granger" 
            value={foreignCausality ? (foreignCausality.is_significant ? "Significant" : "Not Significant") : "Unavailable"} 
            note={foreignCausality ? `p=${foreignCausality.min_p_value?.toFixed(4)}, lag ${foreignCausality.best_lag}` : "insufficient observations"} 
            tone={foreignCausality ? (foreignCausality.is_significant ? "positive" : "warning") : "warning"} 
          />
          <MetricCard 
            label="Conviction Model" 
            value={`${scoreValue?.toFixed(1) || "-"}/100`} 
            note="hover score card for formula" 
            tone={scoreToneName} 
            title={data.breakdown}
          />
          <MetricCard 
            label="Broker Validation" 
            value={brokerNote} 
            note="historical forward returns" 
            tone={null} 
          />
        </div>

        {/* Score Breakdown Tooltip (Persis app.py) */}
        <div className="mb-6 p-3 bg-[#0B0E14] rounded-md text-xs text-[#94A3B8] border border-[#232B3B]">
          <span className="font-bold text-[#E6E0E9]">Score Breakdown: </span>
          {data.breakdown}
        </div>

        {/* 2 Kolom Tabel (Persis app.py) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Participant Type */}
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
                        <td className="py-2 px-3 text-[#E6E0E9]">{english_text(row.participant)}</td>
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

          {/* Top Broker Causality */}
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
