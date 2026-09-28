/**
 * Centralized formatting and color utility for financial metrics in Investowl.
 * Adheres strictly to WCAG AA color tokens and consistent numerical representations.
 */

export function fmtRp(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (v >= 1e12) return `${sign}Rp ${(v / 1e12).toFixed(2)} T`;
  if (v >= 1e9) return `${sign}Rp ${(v / 1e9).toFixed(2)} B`;
  if (v >= 1e6) return `${sign}Rp ${(v / 1e6).toFixed(2)} M`;
  return `${sign}Rp ${v.toLocaleString("id-ID")}`;
}

export function fmtPct(n: number | null | undefined, decimals: number = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(decimals)}%`;
}

export function fmtB(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  const s = (Math.abs(v) / 1e9).toFixed(1);
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${s}B`;
}

export function signedColor(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "var(--md-sys-color-on-surface-variant)";
  return n >= 0 ? "var(--color-positive)" : "var(--color-negative)";
}

export function signalColor(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return "var(--md-sys-color-outline)";
  }
  if (score > 0) return "var(--color-positive)";
  if (score < 0) return "var(--color-negative)";
  return "var(--md-sys-color-on-surface-variant)";
}

export function getProfileTextColor(label: string): string {
  const l = (label || "").toLowerCase();
  if (l.includes("foreign smart")) return "var(--color-positive)";
  if (l.includes("local inst")) return "#38bdf8"; // Light Blue / Sky
  if (l.includes("market maker")) return "#a855f7"; // Purple
  if (l.includes("speculative")) return "#f59e0b"; // Amber
  return "var(--md-sys-color-on-surface-variant)";
}
