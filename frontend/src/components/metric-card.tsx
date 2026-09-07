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
  return (n ?? 0) >= 0 ? "#0f9f6e" : "#dc3545";
}

export function MetricCard({ label, value, note, tone, accent, title }: { label: string; value: string; note: string; tone?: string | null; accent?: string; title?: string }) {
  let color = "#64748b"; // Default muted
  if (accent) color = accent;
  else if (tone === "positive") color = "#0f9f6e";
  else if (tone === "negative") color = "#dc3545";
  else if (tone === "warning") color = "#b7791f";
  
  return (
    <div className="metric-card" style={{ borderLeftColor: color }} title={title || ""}>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color }}>{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

export { fmt_rp as fmtRp, fmt_pct as fmtPct, signed_color as signedColor };
