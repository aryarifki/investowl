"use client";

import React, { useState, useMemo, useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { useAppStore } from "@/store/useAppStore";

// Dynamic import ReactECharts with SSR disabled
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface GraphNode {
  id: string;
  label: string;
  name: string;
  type: "hub" | "owner" | "emiten";
  sector?: string;
  is_controlling?: boolean;
  degree?: number;
  val?: number;
}

interface GraphLink {
  source: string;
  target: string;
  pct: number;
  is_controlling: boolean;
  label: string;
}

interface GraphData {
  group_id: string;
  group_name: string;
  hub_entity: string;
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    total_nodes: number;
    total_emitens: number;
    total_links: number;
    hub_entity: string;
  };
  available_groups: {
    id: string;
    name: string;
    ticker_count: number;
  }[];
}

export default function OwnershipNetworkGraph() {
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === "dark";

  const [selectedGroup, setSelectedGroup] = useState<string>("barito");
  const [tickerFocus, setTickerFocus] = useState<string>("");
  const [activeTickerParam, setActiveTickerParam] = useState<string | null>(null);
  const [minPct, setMinPct] = useState<number>(1.0);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const queryUrl = useMemo(() => {
    if (activeTickerParam) {
      return `/api/bandar/shareholders/network-graph?ticker=${activeTickerParam}&min_pct=${minPct}`;
    }
    return `/api/bandar/shareholders/network-graph?group=${selectedGroup}&min_pct=${minPct}`;
  }, [activeTickerParam, selectedGroup, minPct]);

  const { data, error, isLoading, isValidating } = useSWR<GraphData>(
    queryUrl,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const nodes = data?.nodes || [];
  const links = data?.links || [];
  const availableGroups = data?.available_groups || [];

  // Theme-aware color palette
  const colors = useMemo(() => ({
    surfaceHigh: isDark ? "#2B2930" : "#ECE6F0",
    surfaceContainer: isDark ? "#1E1C22" : "#F3EDF7",
    onSurface: isDark ? "#E6E0E9" : "#1D1B20",
    onSurfaceVariant: isDark ? "#CAC4D0" : "#49454F",
    outlineVariant: isDark ? "#49454F" : "#CAC4D0",
    primary: isDark ? "#D0BCFF" : "#6750A4",
    hubColor: "#a855f7", // Purple / Violet
    holdingColor: "#3b82f6", // Blue
    emitenColor: "#10b981", // Emerald / Green
    affiliateColor: "#f59e0b", // Amber
  }), [isDark]);

  // Handle ticker search submit
  const handleTickerSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tickerFocus.trim().toUpperCase().replace(".JK", "");
    if (clean) {
      setActiveTickerParam(clean);
      setSelectedNode(null);
    }
  };

  const handleResetGroup = (groupId: string) => {
    setActiveTickerParam(null);
    setTickerFocus("");
    setSelectedGroup(groupId);
    setSelectedNode(null);
  };

  // Pre-process ECharts series data
  const chartOption = useMemo(() => {
    if (!nodes.length) return {};

    const categories = [
      { name: "Beneficial Owner / Hub", itemStyle: { color: colors.hubColor } },
      { name: "Holding / Parent Entity", itemStyle: { color: colors.holdingColor } },
      { name: "Listed Emiten", itemStyle: { color: colors.emitenColor } },
    ];

    const echartsNodes = nodes.map((n) => {
      let catIndex = 1;
      let color = colors.holdingColor;
      let symbolSize = Math.max(22, Math.min(54, (n.val || 20) + (n.degree || 0) * 3));

      if (n.type === "hub") {
        catIndex = 0;
        color = colors.hubColor;
        symbolSize = 46;
      } else if (n.type === "emiten") {
        catIndex = 2;
        color = colors.emitenColor;
        symbolSize = 34;
      }

      return {
        id: n.id,
        name: n.label,
        fullName: n.name,
        category: catIndex,
        symbolSize: symbolSize,
        itemStyle: {
          color: color,
          borderColor: isDark ? "#141218" : "#ffffff",
          borderWidth: 2,
          shadowBlur: 8,
          shadowColor: "rgba(0,0,0,0.25)",
        },
        label: {
          show: true,
          position: "inside",
          formatter: "{b}",
          fontSize: n.type === "emiten" ? 11 : 9,
          fontWeight: 700,
          color: "#ffffff",
        },
        rawNode: n,
      };
    });

    const echartsLinks = links.map((l) => {
      const isControlling = l.is_controlling;
      return {
        source: l.source,
        target: l.target,
        pct: l.pct,
        is_controlling: isControlling,
        lineStyle: {
          color: isControlling
            ? (isDark ? "rgba(168, 85, 247, 0.75)" : "rgba(147, 51, 234, 0.65)")
            : (isDark ? "rgba(148, 163, 184, 0.45)" : "rgba(100, 116, 139, 0.4)"),
          width: Math.max(1.5, Math.min(6, (l.pct / 100) * 7)),
          type: isControlling ? "solid" : "dashed",
          curveness: 0.18,
        },
        label: {
          show: true,
          formatter: `${l.pct}%`,
          fontSize: 9,
          color: colors.onSurfaceVariant,
          fontWeight: 600,
        },
      };
    });

    return {
      tooltip: {
        backgroundColor: colors.surfaceHigh,
        borderColor: colors.outlineVariant,
        textStyle: {
          color: colors.onSurface,
          fontSize: 12,
          fontFamily: "Inter, sans-serif",
        },
        padding: [8, 12],
        borderRadius: 12,
        formatter: (params: any) => {
          if (params.dataType === "edge") {
            const d = params.data;
            return `
              <div style="font-size: 11px; font-weight: 700; margin-bottom: 2px;">
                Relasi Kepemilikan Saham
              </div>
              <div style="font-size: 13px; font-weight: 800; color: ${d.is_controlling ? '#a855f7' : colors.primary};">
                ${d.pct}%
              </div>
              <div style="font-size: 10px; color: ${colors.onSurfaceVariant}; margin-top: 2px;">
                Status: <b>${d.is_controlling ? "Pengendali Saham" : "Pemegang Saham Substantif"}</b>
              </div>
            `;
          }
          const raw = params.data?.rawNode || {};
          return `
            <div style="font-size: 13px; font-weight: 800; color: ${colors.onSurface};">
              ${raw.label}
            </div>
            <div style="font-size: 11px; color: ${colors.onSurfaceVariant}; margin-bottom: 4px;">
              ${raw.name}
            </div>
            <div style="font-size: 10px; font-weight: 600;">
              Sektor/Tipe: <b>${raw.sector || raw.type}</b>
            </div>
            <div style="font-size: 10px; color: ${colors.primary}; margin-top: 4px;">
              Klik node untuk melihat detail relasi
            </div>
          `;
        },
      },
      legend: {
        show: true,
        bottom: 8,
        data: categories.map((c) => c.name),
        textStyle: {
          color: colors.onSurfaceVariant,
          fontSize: 11,
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
        },
        icon: "circle",
      },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          focusNodeAdjacency: true,
          edgeSymbol: ["none", "arrow"],
          edgeSymbolSize: 8,
          categories: categories,
          nodes: echartsNodes,
          links: echartsLinks,
          force: {
            repulsion: 380,
            edgeLength: [90, 190],
            gravity: 0.12,
            friction: 0.8,
          },
          emphasis: {
            focus: "adjacency",
            lineStyle: {
              width: 5,
            },
          },
        },
      ],
    };
  }, [nodes, links, colors, isDark]);

  // Click event on node
  const onChartClick = (params: any) => {
    if (params.dataType === "node" && params.data?.rawNode) {
      setSelectedNode(params.data.rawNode);
    }
  };

  // Connected connections for selected node
  const nodeConnections = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };
    const nodeId = selectedNode.id;
    const nodeLabel = selectedNode.label;

    const incoming = links.filter((l) => l.target === nodeId || l.target.endsWith(`:${nodeLabel}`));
    const outgoing = links.filter((l) => l.source === nodeId || l.source.endsWith(`:${nodeLabel}`));

    return { incoming, outgoing };
  }, [selectedNode, links]);

  return (
    <div className="space-y-4">
      {/* FILTER & KONTROL ATAS */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider mb-0.5">
              <Icon icon="ph:tree-structure-duotone" width="16" />
              <span>INTERACTIVE OWNERSHIP NETWORK PHYSICS</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
              {data?.group_name || "Jejaring Kepemilikan Konglomerasi"}
              {data?.stats && (
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]">
                  {data.stats.total_emitens} Emiten • {data.stats.total_nodes} Simpul • {data.stats.total_links} Relasi
                </span>
              )}
            </h2>
          </div>

          {/* Pencarian Ticker Fokus */}
          <form onSubmit={handleTickerSearch} className="flex items-center gap-2">
            <div className="relative">
              <Icon icon="ph:magnifying-glass-duotone" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)]" width="14" />
              <input
                type="text"
                placeholder="Fokus ticker (cth: BBCA, BREN)..."
                value={tickerFocus}
                onChange={(e) => setTickerFocus(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] focus:outline-none focus:border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-surface)] w-48 sm:w-56"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
            >
              Cari
            </button>
          </form>
        </div>

        {/* PRESET CHIPS KONGLOMERASI */}
        <div className="pt-2 border-t border-[var(--md-sys-color-outline-variant)] flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-[var(--md-sys-color-on-surface-variant)] font-semibold uppercase mr-1">
            Grup:
          </span>
          {availableGroups.map((g) => {
            const active = !activeTickerParam && selectedGroup === g.id;
            return (
              <button
                key={g.id}
                onClick={() => handleResetGroup(g.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  active
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] border-[var(--md-sys-color-primary)] shadow-2xs font-bold"
                    : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                <span>{g.name.split("/")[0].trim()}</span>
                <span className={`text-[10px] font-mono px-1 rounded ${active ? "bg-black/20 text-white" : "bg-[var(--md-sys-color-surface-container-highest)]"}`}>
                  {g.ticker_count}
                </span>
              </button>
            );
          })}
        </div>

        {/* MIN PCT FILTER & STATS */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--md-sys-color-on-surface-variant)] pt-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium">Batas Minimal Kepemilikan:</span>
            <div className="flex items-center gap-1 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] p-0.5 rounded-lg text-[11px] font-semibold">
              {[0.5, 1.0, 5.0, 10.0].map((p) => (
                <button
                  key={p}
                  onClick={() => setMinPct(p)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                    minPct === p
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold shadow-2xs"
                      : "hover:text-[var(--md-sys-color-on-surface)]"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-purple-500 rounded-full inline-block" />
              Garis Solid = Pengendali
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-0.5 border-t border-dashed border-slate-400 inline-block" />
              Garis Putus = Afiliasi
            </span>
          </div>
        </div>
      </div>

      {/* CANVAS GRAF + DETAIL DRAWER */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* GRAPH CANVAS (3 COLS) */}
        <div className="lg:col-span-3 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-3 sm:p-4 shadow-xs relative overflow-hidden h-[540px] sm:h-[600px] flex flex-col">
          {isValidating && (
            <div className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--md-sys-color-surface-container-highest)]/90 backdrop-blur border border-[var(--md-sys-color-outline-variant)] text-[11px] font-mono text-[var(--md-sys-color-primary)]">
              <Icon icon="ph:spinner-bold" className="animate-spin" width="13" />
              <span>Memperbarui graf...</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-xs text-[var(--md-sys-color-on-surface-variant)] animate-pulse">
              <Icon icon="ph:tree-structure-duotone" className="text-[var(--md-sys-color-primary)]" width="36" />
              <span>Menyusun simulasi jejaring kepemilikan saham...</span>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
              <Icon icon="ph:warning-circle-duotone" width="32" className="text-amber-400" />
              <span>Tidak ada relasi kepemilikan yang ditemukan untuk parameter ini.</span>
            </div>
          ) : (
            <ReactECharts
              option={chartOption}
              style={{ height: "100%", width: "100%" }}
              onEvents={{ click: onChartClick }}
              opts={{ renderer: "canvas" }}
            />
          )}

          <div className="absolute bottom-3 left-4 text-[10px] text-[var(--md-sys-color-on-surface-variant)]/70 font-mono select-none pointer-events-none">
            Tips: Geser canvas untuk pan, scroll untuk zoom, drag node untuk eksplorasi posisi.
          </div>
        </div>

        {/* SIDE DETAIL DRAWER (1 COL) */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 shadow-xs flex flex-col justify-between h-[540px] sm:h-[600px] overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <div className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-primary)]">
                  {selectedNode.type === "emiten" ? "Emiten IDX" : selectedNode.type === "hub" ? "Beneficial Owner" : "Entitas Pemegang Saham"}
                </div>
                <h3 className="font-mono font-black text-xl text-[var(--md-sys-color-on-surface)]">
                  {selectedNode.label}
                </h3>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5 leading-snug">
                  {selectedNode.name}
                </p>
                {selectedNode.sector && (
                  <div className="text-[11px] font-mono text-[var(--md-sys-color-on-surface-variant)] mt-1">
                    Sektor: <strong className="text-[var(--md-sys-color-on-surface)]">{selectedNode.sector}</strong>
                  </div>
                )}
              </div>

              {/* RELASI MASUK (PEMILIK DARI ENTITAS INI) */}
              {nodeConnections.incoming.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-[var(--md-sys-color-outline-variant)]">
                  <div className="text-[11px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider flex items-center justify-between">
                    <span>Dimiliki Oleh:</span>
                    <span className="font-mono text-[10px]">{nodeConnections.incoming.length} Entitas</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {nodeConnections.incoming.map((link, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/60 text-xs flex items-center justify-between"
                      >
                        <span className="font-medium text-[var(--md-sys-color-on-surface)] truncate max-w-[130px]" title={link.source}>
                          {link.source.replace("owner:", "").replace("emiten:", "").replace(/-/g, " ").toUpperCase()}
                        </span>
                        <div className="text-right">
                          <span className={`font-mono font-bold text-xs ${link.is_controlling ? "text-purple-400" : "text-emerald-400"}`}>
                            {link.pct}%
                          </span>
                          <div className="text-[9px] text-[var(--md-sys-color-on-surface-variant)]">
                            {link.is_controlling ? "Pengendali" : "Substantif"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RELASI KELUAR (SAHAM YANG DIMILIKI ENTITAS INI) */}
              {nodeConnections.outgoing.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-[var(--md-sys-color-outline-variant)]">
                  <div className="text-[11px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider flex items-center justify-between">
                    <span>Portofolio Kepemilikan:</span>
                    <span className="font-mono text-[10px]">{nodeConnections.outgoing.length} Emiten</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {nodeConnections.outgoing.map((link, idx) => {
                      const targetTicker = link.target.replace("emiten:", "").toUpperCase();
                      return (
                        <div
                          key={idx}
                          className="p-2 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/60 text-xs flex items-center justify-between"
                        >
                          <Link
                            href={`/${targetTicker}`}
                            className="font-mono font-bold text-xs text-[var(--md-sys-color-primary)] hover:underline"
                          >
                            {targetTicker}
                          </Link>
                          <div className="text-right">
                            <span className={`font-mono font-bold text-xs ${link.is_controlling ? "text-purple-400" : "text-emerald-400"}`}>
                              {link.pct}%
                            </span>
                            <div className="text-[9px] text-[var(--md-sys-color-on-surface-variant)]">
                              {link.is_controlling ? "Pengendali" : "Substantif"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ACTION LINKS IF EMITEN */}
              {selectedNode.type === "emiten" && (
                <div className="pt-3 border-t border-[var(--md-sys-color-outline-variant)] space-y-2">
                  <Link
                    href={`/${selectedNode.label}`}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:opacity-90 transition-all"
                  >
                    <span>Analitik Bandarmology</span>
                    <Icon icon="ph:arrow-right-bold" width="12" />
                  </Link>
                  <Link
                    href={`/foreign?ticker=${selectedNode.label}`}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--md-sys-color-surface-container-highest)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)] font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Icon icon="ph:globe-stand-bold" width="13" />
                    <span>Foreign Flow Deep Dive</span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-xs text-[var(--md-sys-color-on-surface-variant)] space-y-2">
              <Icon icon="ph:cursor-click-duotone" width="36" className="text-[var(--md-sys-color-primary)] opacity-70" />
              <div className="font-bold text-[var(--md-sys-color-on-surface)]">
                Pilih Simpul Entitas
              </div>
              <p className="text-[11px] leading-relaxed">
                Klik salah satu lingkaran pada graf untuk melihat struktur pemegang saham, relasi silang konglomerasi, dan jalan pintas analitik.
              </p>
            </div>
          )}

          <div className="mt-auto pt-3 border-t border-[var(--md-sys-color-outline-variant)]/60 text-[10px] text-[var(--md-sys-color-on-surface-variant)] text-center font-mono">
            Investowl Conglomerate Engine
          </div>
        </div>
      </div>
    </div>
  );
}
