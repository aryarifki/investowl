"use client";

import useSWR from "swr";
import { fetchBrokerLatest, fetchBrokerSummary } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

function fmtRupiah(v: number | null | undefined): string {
  if (v == null) return "-";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return sign + (abs / 1_000_000_000_000).toFixed(2) + " T";
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(2) + " M";
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1) + " Jt";
  return sign + abs.toFixed(0);
}

function NetRow({ label, value }: { label: string; value: number | null }) {
  const color =
    value == null ? "text-neutral-500"
    : value >= 0 ? "text-emerald-500" : "text-red-500";
  return (
    <div className="flex justify-between py-1.5 border-b border-neutral-800/50 text-sm">
      <span className="text-neutral-400">{label}</span>
      <span className={"font-semibold " + color}>{fmtRupiah(value)}</span>
    </div>
  );
}

export default function BrokerDetails() {
  const activeTicker = useAppStore((s) => s.activeTicker);
  const summaryDays = useAppStore((s) => s.summaryDays);

  const { data: latest, error: latestError } = useSWR(
    ["broker-latest", activeTicker],
    ([, t]) => fetchBrokerLatest(t)
  );
  const { data: summary } = useSWR(
    ["broker-summary", activeTicker, summaryDays],
    ([, t, d]) => fetchBrokerSummary(t, d)
  );

  const signal = latest?.bandar_signal;
  const score = latest?.bandar_signal_score;
  const isBullish =
    signal != null && /akumulasi|accumulation|bullish/i.test(signal);

  return (
    <div className="space-y-3">
      {/* Panel 1: Sinyal Terkini */}
      <section className="border border-neutral-800 rounded-lg bg-neutral-900 p-3">
        <h2 className="text-sm font-semibold mb-2">🎯 Sinyal Terkini</h2>
        {latestError ? (
          <p className="text-xs text-neutral-500">Belum ada data bandarmologi.</p>
        ) : !latest ? (
          <p className="text-xs text-neutral-500">Memuat…</p>
        ) : (
          <>
            <div
              className={
                "rounded px-3 py-2 mb-2 font-semibold text-sm " +
                (isBullish
                  ? "bg-emerald-900/40 text-emerald-400"
                  : "bg-red-900/40 text-red-400")
              }
            >
              {signal ?? "Tidak ada sinyal"}
              {score != null && (
                <span className="float-right font-mono">
                  Skor: {Number(score).toFixed(2)}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400">
              Foreign signal: {latest.foreign_signal ?? "-"}
            </p>
          </>
        )}
      </section>

      {/* Panel 2: Net Broker (Agregat N Hari) */}
      <section className="border border-neutral-800 rounded-lg bg-neutral-900 p-3">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold">💰 Net Broker ({summaryDays} Hari)</h2>
          <select
            value={summaryDays}
            onChange={(e) => useAppStore.getState().setSummaryDays(Number(e.target.value))}
            className="bg-neutral-800 border border-neutral-700 rounded text-xs px-1 py-0.5"
          >
            <option value={7}>7H</option>
            <option value={30}>30H</option>
            <option value={90}>90H</option>
          </select>
        </div>
        {summary ? (
          <>
            <NetRow label="Foreign" value={summary.foreign_net_broker_sum} />
            <NetRow label="Local" value={summary.local_net_broker_sum} />
            <NetRow label="Government" value={summary.gov_net_broker_sum} />
            <div className="mt-2 text-xs text-neutral-400">
              Dominasi Foreign:{" "}
              <span className="text-neutral-200 font-semibold">
                {summary.foreign_dominance_pct}%
              </span>
              {" · "}Akumulasi:{" "}
              <span className="text-emerald-500">{summary.accumulation_days} hari</span>
              {" · "}Distribusi:{" "}
              <span className="text-red-500">{summary.distribution_days} hari</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-neutral-500">Memuat…</p>
        )}
      </section>

      {/* Panel 3: Narasi Pipeline */}
      <section className="border border-neutral-800 rounded-lg bg-neutral-900 p-3">
        <h2 className="text-sm font-semibold mb-2">📝 Analisis Pipeline</h2>
        {latest?.conclusion_broker && (
          <div className="mb-2">
            <p className="text-xs text-neutral-500 mb-1">Broker:</p>
            <p className="text-xs text-neutral-300">{latest.conclusion_broker}</p>
          </div>
        )}
        {latest?.conclusion_flow && (
          <div>
            <p className="text-xs text-neutral-500 mb-1">Flow:</p>
            <p className="text-xs text-neutral-300">{latest.conclusion_flow}</p>
          </div>
        )}
        {!latest?.conclusion_broker && !latest?.conclusion_flow && (
          <p className="text-xs text-neutral-500">Tidak ada narasi.</p>
        )}
      </section>
    </div>
  );
}
