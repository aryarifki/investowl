/**
 * Centralized formatting utilities for The Investowl.
 * Single source of truth for currency, percentage, and financial color tokens.
 */

export function fmtRp(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (v >= 1e12) return sign + "Rp " + (v / 1e12).toFixed(2) + " T";
  if (v >= 1e9) return sign + "Rp " + (v / 1e9).toFixed(2) + " B";
  if (v >= 1e6) return sign + "Rp " + (v / 1e6).toFixed(2) + " M";
  return sign + "Rp " + v.toLocaleString("id-ID");
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%";
}

export function signedColor(n: number | null | undefined): string {
  if (n === null || n === undefined) return "var(--md-sys-color-outline)";
  return n >= 0 ? "var(--color-positive)" : "var(--color-negative)";
}

export function signalColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "var(--md-sys-color-outline)";
  if (score >= 2) return "var(--color-positive)";
  if (score === 1) return "var(--color-positive)";
  if (score === 0) return "var(--md-sys-color-outline)";
  if (score === -1) return "var(--color-negative)";
  return "var(--color-negative)";
}

export function getProfileTextColor(label: string): string {
  const l = (label || "").toLowerCase();
  if (l.includes("foreign smart")) return "var(--color-positive)";
  if (l.includes("local inst")) return "#3b82f6";
  if (l.includes("market maker")) return "#a855f7";
  if (l.includes("speculative")) return "#f59e0b";
  return "var(--md-sys-color-outline)";
}
