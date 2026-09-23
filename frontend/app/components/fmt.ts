export function fmtRp(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 1e12) return "Rp " + (n / 1e12).toFixed(2) + " T";
  if (abs >= 1e9) return "Rp " + (n / 1e9).toFixed(2) + " B";
  if (abs >= 1e6) return "Rp " + (n / 1e6).toFixed(2) + " M";
  return "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "-";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export function fmtPct(n: number | null | undefined, digits: number = 2): string {
  if (n == null || isNaN(n)) return "-";
  return (n * 100).toFixed(digits) + "%";
}

export function fmtPctPoint(n: number | null | undefined, digits: number = 1): string {
  if (n == null || isNaN(n)) return "-";
  return n.toFixed(digits) + "%";
}

export function fmtSignal(s: string | null | undefined): string {
  if (!s) return "-";
  return s
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  return String(d).slice(0, 10);
}
