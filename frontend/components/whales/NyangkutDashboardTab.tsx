"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import useSWR from "swr";
import { Icon } from "@iconify/react";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Gagal mengambil data nyangkut tracker");
    return res.json();
  });

interface TickerPrediction {
  ticker: string;
  name: string;
  sector: string;
  isHeroBadge: boolean;
  underwaterPct: number | null;
}

interface StockOverviewStats {
  marketCap: string;
  totalSahamScripless: string;
  scriplessPctText: string;
  freeFloat: string;
  jumlahPemegangSaham: string;
  avgSahamRetail: string;
  konglo: string;
}

interface TrendDataPoint {
  month: string;
  val: number;
}

interface MetricTrendCard {
  label: string;
  value: string;
  change: string;
  color: string;
  points: TrendDataPoint[];
}

interface OwnershipSlice {
  category: string;
  pct: number;
  color: string;
  desc: string;
}

interface VolumeNode {
  price: number;
  volumePct: number;
  isNyangkutZone: boolean;
}

interface NyangkutStockData {
  ticker: string;
  name: string;
  currentPrice: number;
  avgAccumulationPrice: number;
  underwaterPct: number;
  estimatedNyangkutPct: number;
  totalSid: number;
  sidChangeMoM: number;
  sidChangePct: number;
  rarScore: number; // Retail Absorption Rate
  pbiScore: number; // Pahlawan Bursa Index
  isHeroBadge: boolean;
  ownership: OwnershipSlice[];
  volumeNodes: VolumeNode[];
  periodDate: string;
  updateLagLabel: string;
  sparklineSid: number[];
  overviewStats?: StockOverviewStats;
  trendCards?: MetricTrendCard[];
}

interface LeaderboardHeroItem {
  rank: number;
  ticker: string;
  name: string;
  pbiScore: number;
  rarScore: number;
  priceDropPct: number;
  sidGrowthMoM: number;
  currentPrice: number;
  avgAccumulationPrice: number;
}

function MiniTrendAreaChart({
  id,
  points,
  color,
}: {
  id: string;
  points: TrendDataPoint[];
  color: string;
}) {
  if (!points || points.length === 0) return null;

  const width = 240;
  const height = 76;
  const padX = 20;
  const topY = 12;
  const botY = 48;

  const vals = points.map((p) => p.val);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const range = maxVal - minVal || 1;

  const coords = points.map((p, i) => {
    const x = padX + i * ((width - padX * 2) / Math.max(1, points.length - 1));
    const y = botY - ((p.val - minVal) / range) * (botY - topY);
    return { x, y, month: p.month, val: p.val };
  });

  let linePath = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const mx = (p0.x + p1.x) / 2;
    linePath += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const first = coords[0];
  const last = coords[coords.length - 1];
  const areaPath = `${linePath} L ${last.x} ${botY + 2} L ${first.x} ${botY + 2} Z`;
  const gradId = `grad-${id}-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Gradient fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Bezier stroke line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points and labels */}
        {coords.map((c, idx) => (
          <g key={idx}>
            <circle
              cx={c.x}
              cy={c.y}
              r="3"
              fill="var(--md-sys-color-surface-container, #131722)"
              stroke={color}
              strokeWidth="2"
            />
            <text
              x={c.x}
              y={botY + 16}
              textAnchor="middle"
              className="text-[9px] font-mono fill-[var(--md-sys-color-on-surface-variant)] opacity-75 font-semibold"
            >
              {c.month}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// Mock initial data untuk initial preview sebelum endpoint live (dikalibrasi persis ke snapshot resmi KSEI & gambar acuan)
const DEFAULT_PREVIEWS: Record<string, NyangkutStockData> = {
  GOTO: {
    ticker: "GOTO",
    name: "GOTO GOJEK TOKOPEDIA Tbk",
    currentPrice: 52,
    avgAccumulationPrice: 68,
    underwaterPct: -23.5,
    estimatedNyangkutPct: 68.4,
    totalSid: 464710,
    sidChangeMoM: 14230,
    sidChangePct: 3.16,
    rarScore: 142.5,
    pbiScore: 92.4,
    isHeroBadge: true,
    ownership: [
      { category: "Foreign Named", pct: 44.1, color: "#3b82f6", desc: "Foreign Named (Institusi Asing Langsung)" },
      { category: "Foreign Hidden Player", pct: 25.9, color: "#0ea5e9", desc: "Foreign Hidden Player (Nominee / Custodian)" },
      { category: "Retail (Pahlawan Bursa)", pct: 15.8, color: "#10b981", desc: "Retail (Pahlawan Bursa Ritel Eceran)" },
      { category: "Lokal Non-Ritel", pct: 14.1, color: "#475569", desc: "Lokal Non-Ritel (Institusi Domestik)" },
    ],
    volumeNodes: [
      { price: 82, volumePct: 15, isNyangkutZone: true },
      { price: 74, volumePct: 28, isNyangkutZone: true },
      { price: 68, volumePct: 35, isNyangkutZone: true },
      { price: 58, volumePct: 14, isNyangkutZone: true },
      { price: 52, volumePct: 8, isNyangkutZone: false },
    ],
    periodDate: "30 September 2026",
    updateLagLabel: "Data Resmi KSEI/BAE per 30 Sep 2026 (T+10) • EOD 13 Okt 2026",
    sparklineSid: [412000, 425000, 439000, 448000, 450480, 464710],
    overviewStats: {
      marketCap: "38.117 M",
      totalSahamScripless: "11.377.144",
      scriplessPctText: "95.51% dari total saham",
      freeFloat: "70.20%",
      jumlahPemegangSaham: "464.710 SID",
      avgSahamRetail: "3.943 lot / Rp12,6 jt",
      konglo: "-",
    },
    trendCards: [
      {
        label: "% FOREIGN TOTAL",
        value: "70.07%",
        change: "-1.85pp vs Agu",
        color: "#3b82f6",
        points: [
          { month: "Mei", val: 73.80 },
          { month: "Jun", val: 73.50 },
          { month: "Jul", val: 72.50 },
          { month: "Agu", val: 71.92 },
          { month: "Sep", val: 70.07 },
        ],
      },
      {
        label: "% FOREIGN HIDDEN PLAYER",
        value: "25.92%",
        change: "-3.90pp vs Agu",
        color: "#f59e0b",
        points: [
          { month: "Mei", val: 29.80 },
          { month: "Jun", val: 29.82 },
          { month: "Jul", val: 29.80 },
          { month: "Agu", val: 29.82 },
          { month: "Sep", val: 25.92 },
        ],
      },
      {
        label: "% RETAIL (PAHLAWAN BURSA)",
        value: "15.78%",
        change: "+1.23pp vs Agu",
        color: "#10b981",
        points: [
          { month: "Mei", val: 14.50 },
          { month: "Jun", val: 14.55 },
          { month: "Jul", val: 14.50 },
          { month: "Agu", val: 14.55 },
          { month: "Sep", val: 15.78 },
        ],
      },
      {
        label: "JUMLAH SID (INVESTOR)",
        value: "464.710",
        change: "+1.80% vs Jul",
        color: "#8b5cf6",
        points: [
          { month: "Mei", val: 440000 },
          { month: "Jun", val: 445000 },
          { month: "Jul", val: 450000 },
          { month: "Agu", val: 456500 },
          { month: "Sep", val: 464710 },
        ],
      },
    ],
  },
  BBRI: {
    ticker: "BBRI",
    name: "Bank Rakyat Indonesia (Persero) Tbk",
    currentPrice: 4890,
    avgAccumulationPrice: 5210,
    underwaterPct: -6.14,
    estimatedNyangkutPct: 41.2,
    totalSid: 512940,
    sidChangeMoM: 18450,
    sidChangePct: 3.73,
    rarScore: 118.2,
    pbiScore: 84.1,
    isHeroBadge: true,
    ownership: [
      { category: "Lokal Non-Ritel", pct: 53.2, color: "#475569", desc: "Pemerintah RI & Institusi (Gov/IS)" },
      { category: "Foreign Named", pct: 24.5, color: "#3b82f6", desc: "Foreign Funds & Asset Managers" },
      { category: "Retail (Pahlawan Bursa)", pct: 14.8, color: "#10b981", desc: "Investor Individu Lokal" },
      { category: "Foreign Hidden Player", pct: 7.5, color: "#0ea5e9", desc: "Offshore Custody" },
    ],
    volumeNodes: [
      { price: 5500, volumePct: 22, isNyangkutZone: true },
      { price: 5350, volumePct: 31, isNyangkutZone: true },
      { price: 5100, volumePct: 26, isNyangkutZone: true },
      { price: 4890, volumePct: 21, isNyangkutZone: false },
    ],
    periodDate: "30 September 2026",
    updateLagLabel: "Data Resmi KSEI/BAE per 30 Sep 2026 (T+10) • EOD 13 Okt 2026",
    sparklineSid: [440000, 461000, 478000, 489000, 494490, 512940],
    overviewStats: {
      marketCap: "741.120 M",
      totalSahamScripless: "151.559.000",
      scriplessPctText: "99.80% dari total saham",
      freeFloat: "46.80%",
      jumlahPemegangSaham: "512.940 SID",
      avgSahamRetail: "4.120 lot / Rp20,1 jt",
      konglo: "BUMN",
    },
    trendCards: [
      {
        label: "% FOREIGN TOTAL",
        value: "32.00%",
        change: "-0.85pp vs Agu",
        color: "#3b82f6",
        points: [
          { month: "Mei", val: 34.50 },
          { month: "Jun", val: 33.80 },
          { month: "Jul", val: 33.20 },
          { month: "Agu", val: 32.85 },
          { month: "Sep", val: 32.00 },
        ],
      },
      {
        label: "% FOREIGN HIDDEN PLAYER",
        value: "7.50%",
        change: "-0.40pp vs Agu",
        color: "#f59e0b",
        points: [
          { month: "Mei", val: 8.80 },
          { month: "Jun", val: 8.50 },
          { month: "Jul", val: 8.20 },
          { month: "Agu", val: 7.90 },
          { month: "Sep", val: 7.50 },
        ],
      },
      {
        label: "% RETAIL (PAHLAWAN BURSA)",
        value: "14.80%",
        change: "+0.92pp vs Agu",
        color: "#10b981",
        points: [
          { month: "Mei", val: 13.10 },
          { month: "Jun", val: 13.50 },
          { month: "Jul", val: 13.80 },
          { month: "Agu", val: 14.10 },
          { month: "Sep", val: 14.80 },
        ],
      },
      {
        label: "JUMLAH SID (INVESTOR)",
        value: "512.940",
        change: "+3.73% vs Agu",
        color: "#8b5cf6",
        points: [
          { month: "Mei", val: 440000 },
          { month: "Jun", val: 461000 },
          { month: "Jul", val: 478000 },
          { month: "Agu", val: 494490 },
          { month: "Sep", val: 512940 },
        ],
      },
    ],
  },
  BUMI: {
    ticker: "BUMI",
    name: "Bumi Resources Tbk",
    currentPrice: 94,
    avgAccumulationPrice: 128,
    underwaterPct: -26.56,
    estimatedNyangkutPct: 76.8,
    totalSid: 389200,
    sidChangeMoM: 9800,
    sidChangePct: 2.58,
    rarScore: 165.0,
    pbiScore: 95.8,
    isHeroBadge: true,
    ownership: [
      { category: "Retail (Pahlawan Bursa)", pct: 44.2, color: "#10b981", desc: "Ritel Eceran Tersebar Luas" },
      { category: "Foreign Named", pct: 29.8, color: "#3b82f6", desc: "Strategic Consortium & Offshore" },
      { category: "Lokal Non-Ritel", pct: 18.0, color: "#475569", desc: "Afiliasi Korporasi Domestik" },
      { category: "Foreign Hidden Player", pct: 8.0, color: "#0ea5e9", desc: "Custodian Banks" },
    ],
    volumeNodes: [
      { price: 145, volumePct: 18, isNyangkutZone: true },
      { price: 132, volumePct: 34, isNyangkutZone: true },
      { price: 118, volumePct: 27, isNyangkutZone: true },
      { price: 94, volumePct: 21, isNyangkutZone: false },
    ],
    periodDate: "30 September 2026",
    updateLagLabel: "Data Resmi KSEI/BAE per 30 Sep 2026 (T+10) • EOD 13 Okt 2026",
    sparklineSid: [340000, 355000, 368000, 375000, 379400, 389200],
    overviewStats: {
      marketCap: "34.900 M",
      totalSahamScripless: "371.300.000",
      scriplessPctText: "99.10% dari total saham",
      freeFloat: "78.40%",
      jumlahPemegangSaham: "389.200 SID",
      avgSahamRetail: "9.520 lot / Rp8,9 jt",
      konglo: "Bakrie / Salim",
    },
    trendCards: [
      {
        label: "% FOREIGN TOTAL",
        value: "37.80%",
        change: "-2.10pp vs Agu",
        color: "#3b82f6",
        points: [
          { month: "Mei", val: 42.10 },
          { month: "Jun", val: 41.50 },
          { month: "Jul", val: 40.20 },
          { month: "Agu", val: 39.90 },
          { month: "Sep", val: 37.80 },
        ],
      },
      {
        label: "% FOREIGN HIDDEN PLAYER",
        value: "8.00%",
        change: "-1.20pp vs Agu",
        color: "#f59e0b",
        points: [
          { month: "Mei", val: 10.50 },
          { month: "Jun", val: 10.10 },
          { month: "Jul", val: 9.60 },
          { month: "Agu", val: 9.20 },
          { month: "Sep", val: 8.00 },
        ],
      },
      {
        label: "% RETAIL (PAHLAWAN BURSA)",
        value: "44.20%",
        change: "+3.10pp vs Agu",
        color: "#10b981",
        points: [
          { month: "Mei", val: 38.50 },
          { month: "Jun", val: 39.80 },
          { month: "Jul", val: 41.20 },
          { month: "Agu", val: 42.50 },
          { month: "Sep", val: 44.20 },
        ],
      },
      {
        label: "JUMLAH SID (INVESTOR)",
        value: "389.200",
        change: "+2.58% vs Agu",
        color: "#8b5cf6",
        points: [
          { month: "Mei", val: 340000 },
          { month: "Jun", val: 355000 },
          { month: "Jul", val: 368000 },
          { month: "Agu", val: 379400 },
          { month: "Sep", val: 389200 },
        ],
      },
    ],
  },
};

const MOCK_LEADERBOARD: LeaderboardHeroItem[] = [
  { rank: 1, ticker: "BUMI", name: "Bumi Resources", pbiScore: 95.8, rarScore: 165.0, priceDropPct: -26.5, sidGrowthMoM: 9800, currentPrice: 94, avgAccumulationPrice: 128 },
  { rank: 2, ticker: "GOTO", name: "GoTo Gojek Tokopedia", pbiScore: 92.4, rarScore: 142.5, priceDropPct: -23.5, sidGrowthMoM: 14230, currentPrice: 52, avgAccumulationPrice: 68 },
  { rank: 3, ticker: "BUKA", name: "Bukalapak.com", pbiScore: 89.1, rarScore: 134.8, priceDropPct: -18.2, sidGrowthMoM: 6150, currentPrice: 114, avgAccumulationPrice: 139 },
  { rank: 4, ticker: "BBRI", name: "Bank Rakyat Indonesia", pbiScore: 84.1, rarScore: 118.2, priceDropPct: -6.1, sidGrowthMoM: 18450, currentPrice: 4890, avgAccumulationPrice: 5210 },
  { rank: 5, ticker: "ASII", name: "Astra International", pbiScore: 78.6, rarScore: 109.5, priceDropPct: -8.9, sidGrowthMoM: 7800, currentPrice: 4780, avgAccumulationPrice: 5250 },
  { rank: 6, ticker: "TLKM", name: "Telkom Indonesia", pbiScore: 75.2, rarScore: 104.2, priceDropPct: -11.4, sidGrowthMoM: 8900, currentPrice: 2890, avgAccumulationPrice: 3260 },
  { rank: 7, ticker: "INCO", name: "Vale Indonesia", pbiScore: 72.9, rarScore: 98.4, priceDropPct: -14.6, sidGrowthMoM: 4200, currentPrice: 3750, avgAccumulationPrice: 4390 },
  { rank: 8, ticker: "BRPT", name: "Barito Pacific", pbiScore: 69.4, rarScore: 95.1, priceDropPct: -12.1, sidGrowthMoM: 5300, currentPrice: 965, avgAccumulationPrice: 1098 },
];

export default function NyangkutDashboardTab() {
  const [selectedTicker, setSelectedTicker] = useState("GOTO");
  const [activeTab, setActiveTab] = useState<"detail" | "leaderboard">("detail");
  const [showShareModal, setShowShareModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce input pencarian 150ms agar responsif dan hemat request
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Endpoint prediksi pencarian saham real-time
  const { data: searchPredictions, isValidating: isSearching } = useSWR<TickerPrediction[]>(
    debouncedQuery ? `/api/v1/stock/search?q=${encodeURIComponent(debouncedQuery)}&limit=8` : null,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  const predictions = useMemo(() => searchPredictions || [], [searchPredictions]);

  // Shortcut keyboard: '/' untuk fokus kolom pencarian, Esc untuk menutup
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement !== searchInputRef.current) {
        event.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isSearchOpen || predictions.length === 0) {
      if (e.key === "Enter" && searchQuery.trim()) {
        setSelectedTicker(searchQuery.trim().toUpperCase());
        setIsSearchOpen(false);
        setSearchQuery("");
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % predictions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + predictions.length) % predictions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = predictions[highlightedIndex];
      if (selected) {
        setSelectedTicker(selected.ticker);
        setIsSearchOpen(false);
        setSearchQuery("");
      } else if (searchQuery.trim()) {
        setSelectedTicker(searchQuery.trim().toUpperCase());
        setIsSearchOpen(false);
        setSearchQuery("");
      }
    } else if (e.key === "Escape") {
      setIsSearchOpen(false);
    }
  }

  // Endpoint API di backend (fallback ke mock data jika belum dieksekusi data pipeline)
  const { data: apiData } = useSWR<NyangkutStockData>(
    `/api/v1/stock/${selectedTicker}/nyangkut-tracker`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: leaderboardApiData } = useSWR<LeaderboardHeroItem[]>(
    "/api/v1/nyangkut/leaderboard",
    fetcher,
    { revalidateOnFocus: false }
  );

  const stockData: NyangkutStockData = useMemo(() => {
    if (apiData) return apiData;
    return DEFAULT_PREVIEWS[selectedTicker] || DEFAULT_PREVIEWS["GOTO"];
  }, [apiData, selectedTicker]);

  const overviewStats: StockOverviewStats = useMemo(() => {
    if (stockData.overviewStats) return stockData.overviewStats;
    return {
      marketCap: "38.117 M",
      totalSahamScripless: "11.377.144",
      scriplessPctText: "95.51% dari total saham",
      freeFloat: "70.20%",
      jumlahPemegangSaham: `${stockData.totalSid.toLocaleString("id-ID")} SID`,
      avgSahamRetail: "3.943 lot / Rp12,6 jt",
      konglo: "-",
    };
  }, [stockData]);

  const trendCards: MetricTrendCard[] = useMemo(() => {
    if (stockData.trendCards && stockData.trendCards.length > 0) {
      return stockData.trendCards;
    }
    return [
      {
        label: "% FOREIGN TOTAL",
        value: "70.07%",
        change: "-1.85pp vs Agu",
        color: "#3b82f6",
        points: [
          { month: "Mei", val: 73.80 },
          { month: "Jun", val: 73.50 },
          { month: "Jul", val: 72.50 },
          { month: "Agu", val: 71.92 },
          { month: "Sep", val: 70.07 },
        ],
      },
      {
        label: "% FOREIGN HIDDEN PLAYER",
        value: "25.92%",
        change: "-3.90pp vs Agu",
        color: "#f59e0b",
        points: [
          { month: "Mei", val: 29.80 },
          { month: "Jun", val: 29.82 },
          { month: "Jul", val: 29.80 },
          { month: "Agu", val: 29.82 },
          { month: "Sep", val: 25.92 },
        ],
      },
      {
        label: "% RETAIL (PAHLAWAN BURSA)",
        value: "15.78%",
        change: "+1.23pp vs Agu",
        color: "#10b981",
        points: [
          { month: "Mei", val: 14.50 },
          { month: "Jun", val: 14.55 },
          { month: "Jul", val: 14.50 },
          { month: "Agu", val: 14.55 },
          { month: "Sep", val: 15.78 },
        ],
      },
      {
        label: "JUMLAH SID (INVESTOR)",
        value: stockData.totalSid.toLocaleString("id-ID"),
        change: "+1.80% vs Jul",
        color: "#8b5cf6",
        points: [
          { month: "Mei", val: 440000 },
          { month: "Jun", val: 445000 },
          { month: "Jul", val: 450000 },
          { month: "Agu", val: 456500 },
          { month: "Sep", val: stockData.totalSid },
        ],
      },
    ];
  }, [stockData]);

  const leaderboardList: LeaderboardHeroItem[] = useMemo(() => {
    return leaderboardApiData && leaderboardApiData.length > 0
      ? leaderboardApiData
      : MOCK_LEADERBOARD;
  }, [leaderboardApiData]);

  const quickTickers = ["GOTO", "BBRI", "BUMI", "BUKA", "ASII", "TLKM"];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* HEADER DASHBOARD */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-2xs">
                <Icon icon="ph:lifebuoy-duotone" width="24" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-[var(--md-sys-color-on-surface)] tracking-tight">
                    Dashboard Nyangkut
                  </h1>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    Inferensial Radar
                  </span>
                </div>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                  Transparansi dinamika pemegang saham BEI & deteksi zona perangkap modal ritel.
                </p>
              </div>
            </div>

            {/* TAB SELECTOR & SHARE */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center p-1 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] text-xs font-semibold">
                <button
                  onClick={() => setActiveTab("detail")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                    activeTab === "detail"
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs font-bold"
                      : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                  }`}
                >
                  <Icon icon="ph:chart-pie-slice-duotone" width="16" />
                  <span>Emiten Tracker</span>
                </button>
                <button
                  onClick={() => setActiveTab("leaderboard")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                    activeTab === "leaderboard"
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs font-bold"
                      : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                  }`}
                >
                  <Icon icon="ph:shield-star-duotone" width="16" />
                  <span>Pahlawan Bursa</span>
                </button>
              </div>

              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all shadow-2xs"
                title="Bagikan kartu nyangkut ke sosial media"
              >
                <Icon icon="ph:share-network-duotone" width="16" />
                <span>Share Card</span>
              </button>
            </div>
          </div>

          {/* SEARCH & QUICK PICKER BAR */}
          {activeTab === "detail" && (
            <div className="mt-5 pt-4 border-t border-[var(--md-sys-color-outline-variant)]/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 relative z-30">
              {/* KOLOM PENCARIAN DENGAN AUTOCOMPLETE PREDIKSI */}
              <div ref={searchContainerRef} className="relative flex-1 max-w-lg">
                <div className="relative flex items-center">
                  <Icon
                    icon="ph:magnifying-glass-duotone"
                    className="absolute left-3.5 text-[var(--md-sys-color-on-surface-variant)] pointer-events-none"
                    width="18"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Cari kode ticker atau nama emiten (cth: BBRI, GOTO, Telkom)..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsSearchOpen(true);
                      setHighlightedIndex(0);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] focus:border-[var(--md-sys-color-primary)] focus:ring-2 focus:ring-[var(--md-sys-color-primary)]/20 rounded-2xl pl-10 pr-20 py-2.5 text-xs font-sans text-[var(--md-sys-color-on-surface)] placeholder:text-[var(--md-sys-color-on-surface-variant)]/70 transition-all outline-none shadow-xs"
                  />

                  {/* SHORTCUT / CLEAR BUTTONS */}
                  <div className="absolute right-2.5 flex items-center gap-1.5 pointer-events-auto">
                    {searchQuery ? (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setIsSearchOpen(false);
                          searchInputRef.current?.focus();
                        }}
                        className="p-1 rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)] transition-colors"
                        title="Hapus pencarian"
                      >
                        <Icon icon="ph:x-bold" width="12" />
                      </button>
                    ) : (
                      <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-md shadow-2xs">
                        /
                      </kbd>
                    )}
                  </div>
                </div>

                {/* PREDICTION DROPDOWN */}
                {isSearchOpen && debouncedQuery && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl shadow-xl overflow-hidden z-50 backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3.5 py-2 bg-[var(--md-sys-color-surface-container-high)]/60 border-b border-[var(--md-sys-color-outline-variant)]/40 flex items-center justify-between text-[11px] font-semibold text-[var(--md-sys-color-on-surface-variant)]">
                      <span className="flex items-center gap-1">
                        <Icon icon="ph:sparkle-duotone" className="text-amber-400" width="13" />
                        Prediksi Saham Terkait
                      </span>
                      {isSearching && (
                        <span className="text-[10px] text-[var(--md-sys-color-primary)] animate-pulse">
                          Mencari...
                        </span>
                      )}
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-[var(--md-sys-color-outline-variant)]/20 p-1">
                      {predictions.length > 0 ? (
                        predictions.map((item, idx) => {
                          const isHighlighted = idx === highlightedIndex;
                          const isSelected = item.ticker === selectedTicker;

                          return (
                            <button
                              key={item.ticker}
                              onClick={() => {
                                setSelectedTicker(item.ticker);
                                setIsSearchOpen(false);
                                setSearchQuery("");
                              }}
                              onMouseEnter={() => setHighlightedIndex(idx)}
                              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                                isHighlighted
                                  ? "bg-[var(--md-sys-color-primary)]/15 text-[var(--md-sys-color-on-surface)]"
                                  : isSelected
                                  ? "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)]"
                                  : "hover:bg-[var(--md-sys-color-surface-container-high)]/70 text-[var(--md-sys-color-on-surface)]"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`px-2 py-1 rounded-lg text-xs font-mono font-black ${
                                  isSelected 
                                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]" 
                                    : "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)]"
                                }`}>
                                  {item.ticker}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate max-w-[180px] sm:max-w-[240px]">
                                    {item.name}
                                  </div>
                                  <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] truncate">
                                    {item.sector}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-1.5">
                                {item.isHeroBadge && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold flex items-center gap-0.5">
                                    <span>🛡️</span>
                                    <span className="hidden sm:inline">Pahlawan</span>
                                  </span>
                                )}
                                {item.underwaterPct !== null && item.underwaterPct !== undefined && (
                                  <span className={`text-[10px] font-mono font-bold ${
                                    item.underwaterPct < 0 ? "text-rose-400" : "text-emerald-400"
                                  }`}>
                                    {item.underwaterPct > 0 ? "+" : ""}{item.underwaterPct}%
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-4 text-center text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          Tidak ada emiten yang cocok dengan &quot;{debouncedQuery}&quot;. Tekan Enter untuk mencari langsung kode tersebut.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* QUICK TICKER CHIPS DENGAN BADGE AKTIF */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--md-sys-color-on-surface-variant)] mr-1 hidden sm:inline">
                  Populer:
                </span>
                {quickTickers.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setSelectedTicker(t);
                      setIsSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black transition-all cursor-pointer ${
                      selectedTicker === t
                        ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs scale-105"
                        : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)]/60"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: DETAIL EMITEN */}
        {activeTab === "detail" && (
          <div className="space-y-5">
            {/* 1. TOP OVERVIEW CARD (MATCHING GAMBAR ACUAN KSEI / EMITEN SUMMARY) */}
            <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl p-5 sm:p-6 shadow-xs relative">
              {/* HEADER EMITEN */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--md-sys-color-outline-variant)]/40 mb-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl sm:text-3xl font-black text-[var(--md-sys-color-on-surface)] tracking-tight">
                    {stockData.ticker}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wide">
                    {stockData.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[10px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-high)] px-2.5 py-1 rounded-lg border border-[var(--md-sys-color-outline-variant)]/40">
                    Periode: {stockData.periodDate}
                  </span>
                </div>
              </div>

              {/* 2 COLS: KEY STATS TABLE & DONUT CHART */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* LEFT: 6-ROW STATS TABLE */}
                <div className="lg:col-span-7 divide-y divide-[var(--md-sys-color-outline-variant)]/30 text-xs font-sans">
                  {/* Row 1: Market Cap */}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[var(--md-sys-color-on-surface-variant)] font-medium">
                      Market Cap
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--md-sys-color-on-surface)]">
                      {overviewStats.marketCap}
                    </span>
                  </div>

                  {/* Row 2: Total Saham Scripless */}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[var(--md-sys-color-on-surface-variant)] font-medium">
                      Total Saham Scripless (Ribu Lot)
                    </span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-[var(--md-sys-color-on-surface)] block">
                        {overviewStats.totalSahamScripless}
                      </span>
                      {overviewStats.scriplessPctText && (
                        <span className="text-[10px] text-sky-400 font-semibold block">
                          {overviewStats.scriplessPctText}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Free Float */}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[var(--md-sys-color-on-surface-variant)] font-medium">
                      Free Float
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--md-sys-color-on-surface)]">
                      {overviewStats.freeFloat}
                    </span>
                  </div>

                  {/* Row 4: Jumlah Pemegang Saham */}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[var(--md-sys-color-on-surface-variant)] font-medium">
                      Jumlah Pemegang Saham
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--md-sys-color-on-surface)]">
                      {overviewStats.jumlahPemegangSaham}
                    </span>
                  </div>

                  {/* Row 5: Average Jumlah Saham / Investor Retail */}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[var(--md-sys-color-on-surface-variant)] font-medium">
                      Average Jumlah Saham / Investor Retail
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--md-sys-color-on-surface)]">
                      {overviewStats.avgSahamRetail}
                    </span>
                  </div>

                  {/* Row 6: Konglo */}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[var(--md-sys-color-on-surface-variant)] font-medium">
                      Konglo
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--md-sys-color-on-surface)]">
                      {overviewStats.konglo}
                    </span>
                  </div>
                </div>

                {/* RIGHT: DONUT CHART PERSIS GAMBAR */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[var(--md-sys-color-outline-variant)]/40 lg:pl-6">
                  <div className="relative w-44 h-44 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      {(() => {
                        let offset = 0;
                        return stockData.ownership.map((s, idx) => {
                          const strokeDasharray = `${s.pct} ${100 - s.pct}`;
                          const strokeDashoffset = -offset;
                          offset += s.pct;
                          return (
                            <circle
                              key={idx}
                              cx="18"
                              cy="18"
                              r="15.91549430918954"
                              fill="transparent"
                              stroke={s.color}
                              strokeWidth="3.6"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              className="transition-all duration-300 hover:opacity-80"
                            />
                          );
                        });
                      })()}
                    </svg>

                    {/* Center Text (e.g. 44.1% FOREIGN NAMED) */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
                      <span className="text-xl sm:text-2xl font-black text-[var(--md-sys-color-on-surface)] font-mono leading-none">
                        {stockData.ownership[0]?.pct}%
                      </span>
                      <span
                        className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider mt-1"
                        style={{ color: stockData.ownership[0]?.color || "#3b82f6" }}
                      >
                        {stockData.ownership[0]?.category.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* LEGEND UNDER DONUT */}
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 text-xs font-sans">
                    {stockData.ownership.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-[var(--md-sys-color-on-surface-variant)] text-[11px]">
                          {s.category}
                        </span>
                        <span className="font-mono font-bold text-[var(--md-sys-color-on-surface)] text-[11px]">
                          {s.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* CARD FOOTER */}
              <div className="mt-5 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/40 text-[11px] text-[var(--md-sys-color-on-surface-variant)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                <span>Struktur Kepemilikan KSEI Saham Scripless</span>
                <span className="text-amber-400 font-semibold">{stockData.updateLagLabel}</span>
              </div>
            </div>

            {/* 2. 4 METRIC TREND CARDS WITH AREA SPARKLINE CHARTS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {trendCards.map((card, idx) => {
                const isNegative = card.change.trim().startsWith("-");
                return (
                  <div
                    key={idx}
                    className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider block">
                        {card.label}
                      </span>
                      <div className="flex items-baseline justify-between gap-2 mt-1.5">
                        <span className="text-xl sm:text-2xl font-black font-mono text-[var(--md-sys-color-on-surface)]">
                          {card.value}
                        </span>
                        <span
                          className={`text-[11px] font-mono font-bold flex items-center gap-0.5 ${
                            isNegative ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          <Icon
                            icon={isNegative ? "ph:trend-down-bold" : "ph:trend-up-bold"}
                            width="13"
                          />
                          <span>{card.change}</span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-2">
                      <MiniTrendAreaChart
                        id={`trend-${idx}`}
                        points={card.points}
                        color={card.color}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3. BADGE PAHLAWAN BURSA BANNER (IF APPLICABLE) */}
            {stockData.isHeroBadge && (
              <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
                    <Icon icon="ph:shield-chevron-duotone" width="22" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[var(--md-sys-color-on-surface)] flex items-center gap-1.5">
                      <span>Pahlawan Bursa Menahan Tangguh!</span>
                      <span className="text-[10px] px-2 py-0.2 bg-amber-500 text-black font-black rounded-md">
                        PBI Score: {stockData.pbiScore}
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                      Di saat harga {stockData.ticker} terkoreksi, jumlah SID ritel bertambah{" "}
                      <strong className="text-amber-400 font-bold">+{stockData.sidChangeMoM.toLocaleString("id-ID")} SID (+{stockData.sidChangePct}%)</strong> menyerap aksi jual.
                    </p>
                  </div>
                </div>
                <div className="text-right self-end sm:self-auto shrink-0">
                  <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] uppercase font-bold tracking-wider">
                    Retail Absorption (RAR)
                  </div>
                  <div className="text-lg font-black text-amber-400 font-mono">
                    {stockData.rarScore}%
                  </div>
                </div>
              </div>
            )}

            {/* 4. NYANGKUT METER & VOLUME BY PRICE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* NYANGKUT METER PROXY CARD (6 COLS) */}
              <div className="lg:col-span-6 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Icon icon="ph:gauge-duotone" width="20" className="text-rose-400" />
                      <h2 className="text-sm font-black text-[var(--md-sys-color-on-surface)]">
                        Nyangkut Meter (Inferensial Proxy)
                      </h2>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30">
                      Zona Underwater
                    </span>
                  </div>

                  {/* MAIN ESTIMATE CALLOUT */}
                  <div className="bg-[var(--md-sys-color-surface-container-high)] rounded-2xl p-4 border border-[var(--md-sys-color-outline-variant)]/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight flex items-center gap-2">
                          <span>Estimasi {stockData.estimatedNyangkutPct}% Ritel Nyangkut</span>
                          <span className="text-xl">🪤</span>
                        </div>
                        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                          Harga rata-rata akumulasi ritel (proxy VWAP) berada di{" "}
                          <strong className="text-[var(--md-sys-color-on-surface)] font-bold">
                            Rp {stockData.avgAccumulationPrice}
                          </strong>
                          . Harga pasar saat ini{" "}
                          <strong className="text-rose-400 font-bold">
                            Rp {stockData.currentPrice} ({stockData.underwaterPct}%)
                          </strong>
                          .
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider block">
                          Modal Rata-Rata
                        </span>
                        <span className="text-lg font-black text-[var(--md-sys-color-on-surface)] font-mono">
                          Rp {stockData.avgAccumulationPrice}
                        </span>
                      </div>
                    </div>

                    {/* PROGRESS BAR UNDERWATER */}
                    <div className="mt-3.5 space-y-1">
                      <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-rose-500 transition-all duration-700"
                          style={{ width: `${stockData.estimatedNyangkutPct}%` }}
                        />
                        <div
                          className="h-full bg-emerald-500 transition-all duration-700"
                          style={{ width: `${100 - stockData.estimatedNyangkutPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-[var(--md-sys-color-on-surface-variant)]">
                        <span>Nyangkut: {stockData.estimatedNyangkutPct}%</span>
                        <span>Aman/Untung: {(100 - stockData.estimatedNyangkutPct).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* SPARKLINE TREN SID (6 BULAN TERAKHIR) */}
                  <div className="mt-4 pt-4 border-t border-[var(--md-sys-color-outline-variant)]/40">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-1.5">
                        <Icon icon="ph:users-duotone" width="16" className="text-sky-400" />
                        Tren Pertumbuhan Investor Ritel (6 Bulan)
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">
                        +{stockData.sidChangeMoM.toLocaleString("id-ID")} SID Bulan Ini
                      </span>
                    </div>

                    <div className="h-14 flex items-end gap-2 pt-2 px-1">
                      {stockData.sparklineSid.map((val, i) => {
                        const min = Math.min(...stockData.sparklineSid);
                        const max = Math.max(...stockData.sparklineSid);
                        const heightPct = Math.max(20, Math.round(((val - min) / (max - min || 1)) * 100));
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                            <div
                              className="w-full bg-sky-500/30 group-hover:bg-sky-400 rounded-t transition-all"
                              style={{ height: `${heightPct}%` }}
                            />
                            <span className="text-[9px] font-mono text-[var(--md-sys-color-on-surface-variant)] hidden sm:block">
                              M-{6 - i}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* VOLUME BY PRICE (NODES NYANGKUT) (6 COLS) */}
              <div className="lg:col-span-6 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon icon="ph:chart-bar-horizontal-duotone" width="20" className="text-amber-400" />
                      <h2 className="text-sm font-black text-[var(--md-sys-color-on-surface)]">
                        Distribusi Volume di Tiap Level Harga
                      </h2>
                    </div>
                    <span className="text-[10px] font-bold text-rose-400">
                      Merah = Zona Ritel Terjebak
                    </span>
                  </div>

                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mb-3">
                    Node harga dengan volume transaksi terbanyak dalam 6 bulan terakhir. Level di atas harga sekarang menjadi resistensi psikologis kuat.
                  </p>

                  <div className="space-y-2.5">
                    {stockData.volumeNodes.map((node, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs font-mono">
                        <span className="w-14 text-right font-bold text-[var(--md-sys-color-on-surface)]">
                          Rp {node.price}
                        </span>
                        <div className="flex-1 h-5 bg-[var(--md-sys-color-surface-container-high)] rounded-md overflow-hidden relative">
                          <div
                            className={`h-full rounded-md transition-all ${
                              node.isNyangkutZone
                                ? "bg-rose-500/70 border-r-2 border-rose-400"
                                : "bg-emerald-500/70 border-r-2 border-emerald-400"
                            }`}
                            style={{ width: `${node.volumePct * 2}%` }}
                          />
                          <span className="absolute inset-y-0 right-2 flex items-center text-[10px] text-[var(--md-sys-color-on-surface)] font-bold">
                            {node.volumePct}% Vol
                          </span>
                        </div>
                        <span className="w-24 text-[10px] font-sans font-bold text-right">
                          {node.isNyangkutZone ? (
                            <span className="text-rose-400">Nyangkut</span>
                          ) : (
                            <span className="text-emerald-400">Harga Sekarang</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/40 text-[10px] text-[var(--md-sys-color-on-surface-variant)] flex items-center justify-between">
                  <span>Proxy VWAP Transaksi Historis</span>
                  <span className="font-mono">Current: Rp {stockData.currentPrice}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LEADERBOARD PAHLAWAN BURSA */}
        {activeTab === "leaderboard" && (
          <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
                  <Icon icon="ph:trophy-duotone" width="22" className="text-amber-400" />
                  <span>Leaderboard: Pahlawan Bursa Terbesar Bulan Ini</span>
                </h2>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                  Emiten dengan skor PBI tertinggi: Saham di mana investor ritel menyerap kejatuhan harga paling masif.
                </p>
              </div>
              <div className="text-xs font-mono text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 self-start sm:self-auto flex items-center gap-1.5">
                <Icon icon="ph:calendar-blank-duotone" width="14" />
                <span>KSEI Snapshot: {stockData.periodDate}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] uppercase text-[10px] font-black tracking-wider">
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">Emiten</th>
                    <th className="py-3 px-3 text-right">PBI Score</th>
                    <th className="py-3 px-3 text-right">RAR Score</th>
                    <th className="py-3 px-3 text-right">Penurunan Harga</th>
                    <th className="py-3 px-3 text-right">Pertumbuhan SID</th>
                    <th className="py-3 px-3 text-right">Harga Beli Proxy</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/30 font-mono">
                  {leaderboardList.map((item) => (
                    <tr
                      key={item.ticker}
                      className="hover:bg-[var(--md-sys-color-surface-container-high)]/60 transition-colors"
                    >
                      <td className="py-3.5 px-3">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs ${
                            item.rank === 1
                              ? "bg-amber-400 text-black"
                              : item.rank === 2
                              ? "bg-slate-300 text-black"
                              : item.rank === 3
                              ? "bg-amber-700 text-white"
                              : "text-[var(--md-sys-color-on-surface-variant)]"
                          }`}
                        >
                          {item.rank}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-sans font-black text-sm text-[var(--md-sys-color-on-surface)] flex items-center gap-1.5">
                          <span>{item.ticker}</span>
                          <span className="text-[10px] text-amber-400">🛡️</span>
                        </div>
                        <div className="font-sans text-[11px] text-[var(--md-sys-color-on-surface-variant)] truncate max-w-[140px]">
                          {item.name}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-amber-400">
                        {item.pbiScore}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-sky-400">
                        {item.rarScore}%
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-rose-400">
                        {item.priceDropPct}%
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-400">
                        +{item.sidGrowthMoM.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3.5 px-3 text-right text-[var(--md-sys-color-on-surface)]">
                        Rp {item.avgAccumulationPrice}
                      </td>
                      <td className="py-3.5 px-3 text-center font-sans">
                        <button
                          onClick={() => {
                            setSelectedTicker(item.ticker);
                            setActiveTab("detail");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] text-[11px] font-bold hover:brightness-110 transition-all cursor-pointer"
                        >
                          Analisis
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COMPLIANCE DISCLAIMER BOX */}
        <div className="bg-[var(--md-sys-color-surface-container-high)]/60 border border-[var(--md-sys-color-outline-variant)]/60 rounded-2xl p-4 text-[11px] text-[var(--md-sys-color-on-surface-variant)] space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-[var(--md-sys-color-on-surface)]">
            <Icon icon="ph:info-duotone" width="16" className="text-amber-400" />
            <span>Kepatuhan Regulasi & Batasan Inferensi (Disclaimer)</span>
          </div>
          <p>
            1. Data kepemilikan bersumber dari publikasi resmi <strong>KSEI & BEI (T+10)</strong> per akhir bulan.
          </p>
          <p>
            2. Estimasi <em>&quot;Nyangkut&quot;</em> dihitung secara <strong>inferensial kuantitatif</strong> berbasis proxy Volume-Weighted Average Price (VWAP) akumulasi ritel dan <u>bukan data riil portofolio individu nasabah</u>. Hanya ditujukan untuk edukasi dan analisis riset.
          </p>
          <p>
            3. Naiknya jumlah investor saat harga terkoreksi dapat mencerminkan strategi <em>Dollar Cost Averaging (DCA)</em> atau <em>Averaging Down</em> institusional.
          </p>
        </div>

      {/* MODAL SOSIAL SHARING (CARD NYANGKUT) */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]"
            >
              <Icon icon="ph:x-bold" width="18" />
            </button>

            <h3 className="text-base font-extrabold text-[var(--md-sys-color-on-surface)] mb-4 flex items-center gap-2">
              <Icon icon="ph:instagram-logo-duotone" width="20" className="text-pink-400" />
              <span>Kartu Share Media Sosial</span>
            </h3>

            {/* PREVIEW CARD SIAP SCREENSHOT */}
            <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-2xl p-5 text-white space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-xs">
                    IO
                  </div>
                  <span className="font-black text-sm tracking-tight">Investowl Quant</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                  RADAR NYANGKUT
                </span>
              </div>

              <div>
                <div className="text-3xl font-black tracking-tight">{stockData.ticker}</div>
                <div className="text-xs text-zinc-400">{stockData.name}</div>
              </div>

              <div className="bg-zinc-900/80 rounded-xl p-3 border border-zinc-800 space-y-2">
                <div className="text-xl font-black text-rose-400">
                  Estimasi {stockData.estimatedNyangkutPct}% Ritel Nyangkut 🪤
                </div>
                <div className="text-xs text-zinc-300">
                  Rata-rata modal beli ritel di <strong>Rp {stockData.avgAccumulationPrice}</strong>, harga sekarang <strong>Rp {stockData.currentPrice}</strong>.
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-mono pt-2 border-t border-zinc-800/80">
                <span>Total SID: {stockData.totalSid.toLocaleString("id-ID")}</span>
                <span className="text-amber-400 font-bold">PBI Score: {stockData.pbiScore}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Radar Nyangkut ${stockData.ticker}: Estimasi ${stockData.estimatedNyangkutPct}% ritel nyangkut di avg Rp ${stockData.avgAccumulationPrice} (Harga Rp ${stockData.currentPrice}). Cek di Investowl!`
                  );
                  alert("Teks ringkasan berhasil disalin!");
                }}
                className="flex-1 py-2.5 rounded-xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold text-xs flex items-center justify-center gap-2"
              >
                <Icon icon="ph:copy-duotone" width="16" />
                <span>Salin Teks Ringkasan</span>
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className="py-2.5 px-4 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
