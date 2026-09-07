function fmt_rp(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (v >= 1e12) return sign + "Rp " + (v / 1e12).toFixed(2) + " T";
  if (v >= 1e9) return sign + "Rp " + (v / 1e9).toFixed(2) + " B";
  if (v >= 1e6) return sign + "Rp " + (v / 1e6).toFixed(2) + " M";
  return sign + "Rp " + v.toLocaleString("id-ID");
}

function fmt_pct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%";
}

function signed_color(n: number | null | undefined): string {
  return (n ?? 0) >= 0 ? "#10b981" : "#f43f5e";
}

export function MetricCard({ label, value, note, tone, accent, title }: { label: string; value: string; note: string; tone?: string | null; accent?: string; title?: string }) {
  let color = "inherit";
  if (accent) color = accent;
  else if (tone === "positive") color = "#10b981";
  else if (tone === "negative") color = "#f43f5e";
  else if (tone === "warning") color = "#f59e0b";
  
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 border-l-4" style={{ borderLeftColor: color }} title={title || ""}>
      <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-base font-bold" style={{ color }}>{value}</div>
      <div className="text-[11px] text-neutral-500 truncate mt-1">{note}</div>
    </div>
  );
}

export { fmt_rp, fmt_pct, signed_color };
