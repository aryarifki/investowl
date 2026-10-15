"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { useAppStore } from "@/store/useAppStore";

// Dynamic import ReactECharts with SSR disabled
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Gagal memuat data relasi kepemilikan`);
  }
  return res.json();
};

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

  // State navigasi & filter
  const [selectedGroup, setSelectedGroup] = useState<string>("barito");
  const [activeTickerParam, setActiveTickerParam] = useState<string | null>(null);
  const [minPct, setMinPct] = useState<number>(1.0);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [viewMode, setViewMode] = useState<"hierarchy" | "graph">("hierarchy");
  const [onlyControlling, setOnlyControlling] = useState<boolean>(false);

  // Autocomplete search states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const rawNodes = data?.nodes || [];
  const rawLinks = data?.links || [];
  const availableGroups = data?.available_groups || [];

  // Filter links if user chooses only controlling
  const filteredLinks = useMemo(() => {
    if (!onlyControlling) return rawLinks;
    return rawLinks.filter((l) => l.is_controlling || l.pct >= 50);
  }, [rawLinks, onlyControlling]);

  // Connected nodes based on filtered links
  const nodes = useMemo(() => {
    if (!onlyControlling) return rawNodes;
    const connectedIds = new Set<string>();
    filteredLinks.forEach((l) => {
      connectedIds.add(l.source);
      connectedIds.add(l.target);
    });
    return rawNodes.filter((n) => connectedIds.has(n.id) || n.type === "hub");
  }, [rawNodes, filteredLinks, onlyControlling]);

  const links = filteredLinks;

  // Node Map for fast lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Theme-aware color palette
  const colors = useMemo(
    () => ({
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
    }),
    [isDark]
  );

  // Debounce search query 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch universe tickers for autocomplete suggestions
  const { data: allUniverseData } = useSWR<{ tickers: string[] }>(
    "/api/bandar/universe/all",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );
  const allTickers = useMemo(() => allUniverseData?.tickers || [], [allUniverseData?.tickers]);

  // Filtered tickers matching search term
  const filteredTickers = useMemo(() => {
    const term = searchQuery.trim().toUpperCase().replace(".JK", "");
    if (!term) return [];
    return allTickers.filter((t: string) => t.includes(term)).slice(0, 8);
  }, [allTickers, searchQuery]);

  // Matching preset groups
  const matchingGroups = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return [];
    return availableGroups.filter(
      (g) => g.name.toLowerCase().includes(term) || g.id.toLowerCase().includes(term)
    );
  }, [availableGroups, searchQuery]);

  // Search entity results if debouncedQuery is >= 2 chars
  const { data: searchResults } = useSWR<{
    query: string;
    count: number;
    results: {
      name: string;
      ticker_count: number;
      total_pct: number;
      holdings: { ticker: string; pct: number; is_controlling: boolean }[];
    }[];
  }>(
    debouncedQuery.length >= 2
      ? `/api/bandar/shareholders/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const matchingEntities = useMemo(() => {
    return searchResults?.results || [];
  }, [searchResults]);

  // Keyboard shortcut: '/' focuses search input, 'Escape' closes dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectGroup = (groupId: string) => {
    setActiveTickerParam(null);
    setSelectedGroup(groupId);
    setSelectedNode(null);
    setSearchQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleSelectTicker = (ticker: string) => {
    const clean = ticker.trim().toUpperCase().replace(".JK", "");
    if (!clean) return;
    setActiveTickerParam(clean);
    setSelectedNode(null);
    setSearchQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleSelectEntity = (entity: {
    name: string;
    holdings: { ticker: string; pct: number; is_controlling: boolean }[];
  }) => {
    if (entity.holdings && entity.holdings.length > 0) {
      handleSelectTicker(entity.holdings[0].ticker);
    } else {
      setSearchQuery("");
      setIsOpen(false);
    }
  };

  const handleEnterSubmit = () => {
    const term = searchQuery.trim().toUpperCase().replace(".JK", "");
    if (!term) return;

    // 1. Match group
    const exactGroup = availableGroups.find(
      (g) => g.id.toUpperCase() === term || g.name.toUpperCase().includes(term)
    );
    if (exactGroup) {
      handleSelectGroup(exactGroup.id);
      return;
    }

    // 2. Exact match ticker
    const exactTicker = allTickers.find((t: string) => t === term);
    if (exactTicker) {
      handleSelectTicker(exactTicker);
      return;
    }

    // 3. First group match
    if (matchingGroups.length > 0) {
      handleSelectGroup(matchingGroups[0].id);
      return;
    }

    // 4. First ticker match
    if (filteredTickers.length > 0) {
      handleSelectTicker(filteredTickers[0]);
      return;
    }

    // 5. First entity match
    if (matchingEntities.length > 0) {
      handleSelectEntity(matchingEntities[0]);
      return;
    }

    // Fallback: search as ticker
    handleSelectTicker(term);
  };

  const handleResetGroup = (groupId: string) => {
    setActiveTickerParam(null);
    setSearchQuery("");
    setSelectedGroup(groupId);
    setSelectedNode(null);
  };

  // Structured Hierarchy computation for clean readability
  const hierarchyData = useMemo(() => {
    // 1. Identify Tier 1: Hubs (Ultimate Beneficial Owners)
    let hubNodes = nodes.filter((n) => n.type === "hub");
    if (hubNodes.length === 0 && nodes.length > 0) {
      // Fallback: node with highest out-degree and 0 in-degree
      const inDegree = new Map<string, number>();
      links.forEach((l) => inDegree.set(l.target, (inDegree.get(l.target) || 0) + 1));
      hubNodes = nodes.filter((n) => !inDegree.has(n.id) && (n.degree || 0) > 0);
      if (hubNodes.length === 0) hubNodes = [nodes[0]];
    }

    const hubIds = new Set(hubNodes.map((h) => h.id));

    // 2. Identify Tier 2: Holding Entities (Owners with outgoing links OR Emitens that own other emitens)
    const outgoingTargets = new Map<string, string[]>();
    links.forEach((l) => {
      const arr = outgoingTargets.get(l.source) || [];
      arr.push(l.target);
      outgoingTargets.set(l.source, arr);
    });

    const holdingNodes = nodes.filter(
      (n) => !hubIds.has(n.id) && (n.type === "owner" || (outgoingTargets.get(n.id)?.length || 0) > 0)
    );
    const holdingIds = new Set(holdingNodes.map((h) => h.id));

    // 3. Identify Tier 3: Operating Emitens (Listed on IDX)
    const emitenNodes = nodes.filter(
      (n) => n.type === "emiten" && !hubIds.has(n.id)
    );

    // Parent & Children mapping for every node
    const parentsOf = (targetId: string) => {
      return links
        .filter((l) => l.target === targetId)
        .map((l) => ({
          parent: nodeMap.get(l.source),
          link: l,
        }))
        .filter((item) => item.parent !== undefined)
        .sort((a, b) => b.link.pct - a.link.pct);
    };

    const childrenOf = (sourceId: string) => {
      return links
        .filter((l) => l.source === sourceId)
        .map((l) => ({
          child: nodeMap.get(l.target),
          link: l,
        }))
        .filter((item) => item.child !== undefined)
        .sort((a, b) => b.link.pct - a.link.pct);
    };

    return {
      hubNodes,
      holdingNodes,
      emitenNodes,
      parentsOf,
      childrenOf,
    };
  }, [nodes, links, nodeMap]);

  // Pre-process ECharts series data for visual graph mode
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
      let symbolSize = 28;

      if (n.type === "hub") {
        catIndex = 0;
        color = colors.hubColor;
        symbolSize = 42;
      } else if (n.type === "emiten") {
        catIndex = 2;
        color = colors.emitenColor;
        symbolSize = 34;
      }

      const isSelected = selectedNode?.id === n.id;

      return {
        id: n.id,
        name: n.label,
        fullName: n.name,
        category: catIndex,
        symbolSize: isSelected ? symbolSize + 8 : symbolSize,
        itemStyle: {
          color: color,
          borderColor: isSelected ? "#ffffff" : isDark ? "#141218" : "#ffffff",
          borderWidth: isSelected ? 3 : 2,
          shadowBlur: isSelected ? 16 : 6,
          shadowColor: isSelected ? color : "rgba(0,0,0,0.25)",
        },
        label: {
          show: true,
          position: "bottom",
          distance: 6,
          formatter: "{b}",
          fontSize: n.type === "emiten" ? 11 : 10,
          fontWeight: 700,
          color: isDark ? "#E6E0E9" : "#1D1B20",
          backgroundColor: isDark ? "rgba(30, 28, 34, 0.85)" : "rgba(255, 255, 255, 0.85)",
          padding: [2, 6],
          borderRadius: 6,
        },
        rawNode: n,
      };
    });

    const echartsLinks = links.map((l) => {
      const isControlling = l.is_controlling;
      const isSelected =
        selectedNode && (selectedNode.id === l.source || selectedNode.id === l.target);

      return {
        source: l.source,
        target: l.target,
        pct: l.pct,
        is_controlling: isControlling,
        lineStyle: {
          color: isSelected
            ? isControlling
              ? "#a855f7"
              : "#3b82f6"
            : isControlling
            ? isDark
              ? "rgba(168, 85, 247, 0.75)"
              : "rgba(147, 51, 234, 0.65)"
            : isDark
            ? "rgba(148, 163, 184, 0.35)"
            : "rgba(100, 116, 139, 0.35)",
          width: isSelected ? 3.5 : Math.max(1.5, Math.min(5, (l.pct / 100) * 6)),
          type: isControlling ? "solid" : "dashed",
          curveness: 0.12,
        },
        label: {
          show: l.pct >= 5.0,
          formatter: `${l.pct}%`,
          fontSize: 9,
          color: colors.onSurfaceVariant,
          fontWeight: 600,
          backgroundColor: isDark ? "rgba(30,28,34,0.7)" : "rgba(255,255,255,0.7)",
          padding: [1, 4],
          borderRadius: 4,
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
            const srcNode = nodeMap.get(d.source);
            const tgtNode = nodeMap.get(d.target);
            return `
              <div style="font-size: 11px; font-weight: 700; margin-bottom: 2px;">
                Relasi Kepemilikan
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                <b>${srcNode?.label || d.source}</b> ➔ <b>${tgtNode?.label || d.target}</b>
              </div>
              <div style="font-size: 13px; font-weight: 800; color: ${d.is_controlling ? '#a855f7' : colors.primary};">
                ${d.pct}%
              </div>
              <div style="font-size: 10px; color: ${colors.onSurfaceVariant}; margin-top: 2px;">
                Status: <b>${d.is_controlling ? "Pengendali Saham (>50%)" : "Pemegang Saham Substantif"}</b>
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
              Tipe: <b>${raw.type === "emiten" ? "Emiten IDX" : raw.type === "hub" ? "Beneficial Owner" : "Holding Entity"}</b>
            </div>
            ${raw.sector ? `<div style="font-size: 10px; color: ${colors.onSurfaceVariant};">Sektor: ${raw.sector}</div>` : ""}
            <div style="font-size: 10px; color: ${colors.primary}; margin-top: 4px;">
              Klik node untuk membuka detail relasi
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
          edgeSymbolSize: 7,
          categories: categories,
          nodes: echartsNodes,
          links: echartsLinks,
          force: {
            repulsion: 550,
            edgeLength: [120, 220],
            gravity: 0.1,
            friction: 0.85,
          },
          emphasis: {
            focus: "adjacency",
            lineStyle: {
              width: 4,
            },
          },
        },
      ],
    };
  }, [nodes, links, colors, isDark, selectedNode, nodeMap]);

  // Click event on graph node
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

  // Ownership Breadcrumb / Pathway for selected emiten
  const ownershipPathway = useMemo(() => {
    if (!selectedNode) return [];
    const chain: { node: GraphNode; pct?: number; isControlling?: boolean }[] = [{ node: selectedNode }];

    let currId = selectedNode.id;
    const visited = new Set<string>([currId]);

    // Trace backwards to find controlling parents up to 4 hops
    for (let hop = 0; hop < 4; hop++) {
      const directParents = links
        .filter((l) => l.target === currId && !visited.has(l.source))
        .sort((a, b) => (b.is_controlling ? 1 : 0) - (a.is_controlling ? 1 : 0) || b.pct - a.pct);

      if (directParents.length > 0) {
        const topParentLink = directParents[0];
        const parentNode = nodeMap.get(topParentLink.source);
        if (parentNode) {
          chain.unshift({
            node: parentNode,
            pct: topParentLink.pct,
            isControlling: topParentLink.is_controlling,
          });
          visited.add(parentNode.id);
          currId = parentNode.id;
          if (parentNode.type === "hub") break;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return chain;
  }, [selectedNode, links, nodeMap]);

  return (
    <div className="space-y-4">
      {/* ── KONTROL ATAS & FILTER PRESET ── */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider mb-1">
              <Icon icon="ph:tree-structure-duotone" width="16" />
              <span>CORPORATE OWNERSHIP INTELLIGENCE</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
              {activeTickerParam ? `Fokus Emiten: ${activeTickerParam}` : data?.group_name || "Struktur Kepemilikan Konglomerasi"}
              {data?.stats && (
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]">
                  {data.stats.total_emitens} Emiten Bursa • {data.stats.total_nodes} Entitas
                </span>
              )}
            </h2>
          </div>

          {/* Kolom Pencarian Autocomplete */}
          <div className="relative z-30 w-full sm:w-80 md:w-96">
            <div className="flex items-center bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] focus-within:border-[var(--md-sys-color-primary)] rounded-xl px-3.5 py-2 shadow-2xs transition-all">
              <Icon
                icon="ph:magnifying-glass-duotone"
                className="text-[var(--md-sys-color-primary)] mr-2 shrink-0"
                width="16"
              />
              <input
                ref={inputRef}
                type="text"
                placeholder="Cari emiten, grup, atau konglomerat..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleEnterSubmit();
                  } else if (e.key === "Escape") {
                    setIsOpen(false);
                    inputRef.current?.blur();
                  }
                }}
                className="w-full bg-transparent border-none outline-none text-xs text-[var(--md-sys-color-on-surface)] placeholder-[var(--md-sys-color-on-surface-variant)] font-sans"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setDebouncedQuery("");
                    setIsOpen(false);
                  }}
                  className="text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] p-0.5 cursor-pointer"
                >
                  <Icon icon="ph:x-circle-fill" width="15" />
                </button>
              ) : (
                <div className="hidden sm:flex items-center gap-1 text-[9px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] px-1.5 py-0.5 rounded shrink-0">
                  <kbd className="text-[var(--md-sys-color-primary)]">/</kbd>
                </div>
              )}
            </div>

            {/* Autocomplete Recommendation Dropdown */}
            {isOpen && searchQuery.trim() && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] rounded-xl overflow-hidden shadow-2xl z-50 max-h-80 overflow-y-auto">
                  {/* 1. KELOMPOK GRUP KONGLOMERASI */}
                  {matchingGroups.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 bg-[var(--md-sys-color-surface-container-high)] text-[9px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)]">
                        <div className="flex items-center gap-1.5">
                          <Icon icon="ph:buildings-duotone" width="13" className="text-blue-700 dark:text-blue-400" />
                          <span>Grup Konglomerasi</span>
                        </div>
                        <span>{matchingGroups.length} grup</span>
                      </div>
                      {matchingGroups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-low)] hover:text-[var(--md-sys-color-primary)] transition-colors border-b border-[var(--md-sys-color-outline-variant)]/60 last:border-0 cursor-pointer text-left"
                          onClick={() => handleSelectGroup(g.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400"></span>
                            <span className="font-bold text-xs">{g.name}</span>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)]">
                            {g.ticker_count} Emiten
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 2. KELOMPOK EMITEN / TICKER */}
                  {filteredTickers.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 bg-[var(--md-sys-color-surface-container-high)] text-[9px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>Emiten Saham BEI</span>
                        </div>
                        <span>{filteredTickers.length} rekomendasi</span>
                      </div>
                      {filteredTickers.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-mono font-bold text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-low)] hover:text-[var(--md-sys-color-primary)] transition-colors border-b border-[var(--md-sys-color-outline-variant)]/60 last:border-0 cursor-pointer text-left"
                          onClick={() => handleSelectTicker(t)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[var(--md-sys-color-primary)] font-extrabold text-sm">{t}</span>
                            <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] font-normal font-sans">
                              Buka jejaring kepemilikan {t}
                            </span>
                          </div>
                          <Icon icon="ph:arrow-up-right-bold" className="text-[var(--md-sys-color-on-surface-variant)]" width="12" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 3. KELOMPOK ENTITAS / PEMEGANG SAHAM / KONGLOMERAT */}
                  {matchingEntities.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 bg-[var(--md-sys-color-surface-container-high)] text-[9px] font-mono font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)]">
                        <div className="flex items-center gap-1.5">
                          <Icon icon="ph:crown-duotone" width="13" className="text-amber-500" />
                          <span>Entitas Pemegang Saham &amp; Konglomerat</span>
                        </div>
                        <span>{matchingEntities.length} entitas</span>
                      </div>
                      {matchingEntities.map((ent, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-low)] hover:text-[var(--md-sys-color-primary)] transition-colors border-b border-[var(--md-sys-color-outline-variant)]/60 last:border-0 cursor-pointer text-left"
                          onClick={() => handleSelectEntity(ent)}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-xs">{ent.name}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                              <span className="font-mono text-purple-700 dark:text-purple-400 font-semibold">
                                {ent.ticker_count} saham di portofolio
                              </span>
                              {ent.holdings && ent.holdings.length > 0 && (
                                <span className="font-mono text-[9px]">
                                  ({ent.holdings.map((h) => h.ticker).join(", ")})
                                </span>
                              )}
                            </div>
                          </div>
                          <Icon icon="ph:arrow-right-bold" className="text-[var(--md-sys-color-on-surface-variant)]" width="12" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* TIDAK ADA HASIL */}
                  {matchingGroups.length === 0 && filteredTickers.length === 0 && matchingEntities.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      <Icon icon="ph:magnifying-glass-duotone" width="24" className="mx-auto mb-1.5 opacity-50" />
                      <span>Tidak ditemukan emiten, grup, atau entitas yang cocok.</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Banner Reset jika sedang fokus pada emiten tertentu */}
        {activeTickerParam && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--md-sys-color-primary-container)]/40 border border-[var(--md-sys-color-primary)]/30 text-xs">
            <div className="flex items-center gap-2">
              <Icon icon="ph:crosshair-duotone" width="16" className="text-[var(--md-sys-color-primary)] shrink-0" />
              <span className="text-[var(--md-sys-color-on-surface)]">
                Menampilkan jejaring kepemilikan terpusat pada emiten <strong className="font-mono text-[var(--md-sys-color-primary)]">{activeTickerParam}</strong>
              </span>
            </div>
            <button
              onClick={() => handleResetGroup("barito")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] text-[10px] font-mono font-bold text-[var(--md-sys-color-primary)] border border-[var(--md-sys-color-outline-variant)] transition-all cursor-pointer self-start sm:self-auto"
            >
              <Icon icon="ph:arrow-counter-clockwise-bold" width="11" />
              <span>Reset ke Konglomerasi</span>
            </button>
          </div>
        )}

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
                <span
                  className={`text-[10px] font-mono px-1 rounded ${
                    active ? "bg-black/20 text-white" : "bg-[var(--md-sys-color-surface-container-highest)]"
                  }`}
                >
                  {g.ticker_count}
                </span>
              </button>
            );
          })}
        </div>

        {/* TOOLBAR FILTER & MODE SWITCHER */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-[var(--md-sys-color-outline-variant)]/60">
          {/* TOGGLE MODE TAMPILAN: HIERARKI POHON vs GRAF INTERAKTIF */}
          <div className="flex items-center gap-1 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] p-1 rounded-xl">
            <button
              onClick={() => setViewMode("hierarchy")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "hierarchy"
                  ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs font-bold"
                  : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
              }`}
            >
              <Icon icon="ph:tree-structure-fill" width="15" />
              <span>Struktur Alur Hierarki (Pohon)</span>
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "graph"
                  ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs font-bold"
                  : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
              }`}
            >
              <Icon icon="ph:circles-three-duotone" width="15" />
              <span>Visual Graf Jaringan</span>
            </button>
          </div>

          {/* OPSI FILTER LAINNYA */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Pengendali Saja */}
            <button
              onClick={() => setOnlyControlling(!onlyControlling)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                onlyControlling
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/40 font-bold"
                  : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)] hover:text-[var(--md-sys-color-on-surface)]"
              }`}
            >
              <Icon icon={onlyControlling ? "ph:check-square-fill" : "ph:square"} width="14" />
              <span>Hanya Pengendali Langsung</span>
            </button>

            {/* Batas Minimal Kepemilikan */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium">
                Min Kepemilikan:
              </span>
              <div className="flex items-center gap-0.5 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] p-0.5 rounded-lg text-[11px] font-semibold">
                {[0.5, 1.0, 5.0, 10.0].map((p) => (
                  <button
                    key={p}
                    onClick={() => setMinPct(p)}
                    className={`px-2 py-0.5 rounded transition-all ${
                      minPct === p
                        ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold shadow-2xs"
                        : "hover:text-[var(--md-sys-color-on-surface)] text-[var(--md-sys-color-on-surface-variant)]"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BREADCRUMB ALUR KEPEMILIKAN AKTIF (JIKA ENTITAS DIPILIH) ── */}
      {selectedNode && ownershipPathway.length > 1 && (
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-xl p-3 shadow-xs flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider">
            <Icon icon="ph:git-commit-duotone" width="16" />
            <span>Rantai Alur Kendali:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ownershipPathway.map((item, idx) => {
              const isLast = idx === ownershipPathway.length - 1;
              return (
                <React.Fragment key={item.node.id}>
                  <div
                    onClick={() => setSelectedNode(item.node)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-all ${
                      isLast
                        ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] border-[var(--md-sys-color-primary)] font-bold"
                        : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)]"
                    }`}
                  >
                    <span className="font-mono font-bold">{item.node.label}</span>
                  </div>
                  {!isLast && (
                    <div className="inline-flex items-center text-[11px] font-mono text-[var(--md-sys-color-on-surface-variant)]">
                      <span className="text-[10px] px-1 font-semibold text-purple-700 dark:text-purple-400">
                        {item.pct ? `${item.pct}%` : ""}
                      </span>
                      <Icon icon="ph:arrow-right-bold" width="12" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ── KONTEN UTAMA: MODE HIERARKI ATAU MODE GRAF + PANEL DETAIL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* KOLOM KIRI (3 COLS): KANVAS VISUALISASI */}
        <div className="lg:col-span-3 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs min-h-[580px] flex flex-col justify-between relative overflow-hidden">
          {isValidating && (
            <div className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--md-sys-color-surface-container-highest)]/90 backdrop-blur border border-[var(--md-sys-color-outline-variant)] text-[11px] font-mono text-[var(--md-sys-color-primary)]">
              <Icon icon="ph:spinner-bold" className="animate-spin" width="13" />
              <span>Memperbarui data...</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-xs text-[var(--md-sys-color-on-surface-variant)] animate-pulse">
              <Icon icon="ph:tree-structure-duotone" className="text-[var(--md-sys-color-primary)]" width="40" />
              <span>Menyusun struktur hierarki konglomerasi...</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-rose-700 dark:text-rose-400 p-6 text-center">
              <Icon icon="ph:warning-circle-duotone" width="36" />
              <div className="font-bold text-sm">Gagal Memuat Relasi Kepemilikan</div>
              <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] max-w-sm">
                {error.message || "Terjadi kesalahan saat menarik data dari backend."}
              </p>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)] p-8 text-center">
              <Icon icon="ph:warning-circle-duotone" width="36" className="text-amber-600 dark:text-amber-400" />
              <div className="font-bold text-sm text-[var(--md-sys-color-on-surface)]">
                Tidak Ada Relasi Kepemilikan yang Cocok
              </div>
              <p className="text-[11px] max-w-xs">
                Coba turunkan batas minimal kepemilikan atau pilih grup konglomerasi lain.
              </p>
            </div>
          ) : viewMode === "hierarchy" ? (
            /* ══════════════════════════════════════════════════════════════════════════
               MODE 1: STRUKTUR ALUR HIERARKI BERTINGKAT (SANGAT MUDAH DIBACA!)
               ══════════════════════════════════════════════════════════════════════════ */
            <div className="space-y-6 flex-1">
              {/* TINGKAT 1: ULTIMATE BENEFICIAL OWNER (HUB) */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                  <span>TINGKAT 1: PENGENDALI AKHIR (ULTIMATE BENEFICIAL OWNER)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {hierarchyData.hubNodes.map((hub) => {
                    const isSelected = selectedNode?.id === hub.id;
                    const children = hierarchyData.childrenOf(hub.id);

                    return (
                      <div
                        key={hub.id}
                        onClick={() => setSelectedNode(hub)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden shadow-2xs ${
                          isSelected
                            ? "bg-purple-500/15 border-purple-500 shadow-purple-500/10 shadow-md ring-2 ring-purple-500/30"
                            : "bg-[var(--md-sys-color-surface-container-high)] border-[var(--md-sys-color-outline-variant)] hover:border-purple-500 dark:hover:border-purple-400"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
                              <Icon icon="ph:crown-bold" width="18" />
                            </div>
                            <div>
                              <div className="font-extrabold text-sm text-[var(--md-sys-color-on-surface)]">
                                {hub.label}
                              </div>
                              <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1">
                                {hub.name}
                              </div>
                            </div>
                          </div>
                          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30">
                            HUB
                          </span>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-[var(--md-sys-color-outline-variant)]/60 flex items-center justify-between text-[11px] font-mono">
                          <span className="text-[var(--md-sys-color-on-surface-variant)]">Mengendalikan:</span>
                          <span className="font-bold text-purple-700 dark:text-purple-400">{children.length} Entitas Utama</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* INDIKATOR ALUR PANAH KEPEMILIKAN */}
              <div className="flex justify-center items-center gap-2 text-[var(--md-sys-color-on-surface-variant)] opacity-60">
                <Icon icon="ph:arrow-down-bold" width="16" />
                <span className="text-[10px] font-mono uppercase tracking-widest">
                  Alur Kepemilikan & Struktur Induk
                </span>
                <Icon icon="ph:arrow-down-bold" width="16" />
              </div>

              {/* TINGKAT 2: PERUSAHAAN INDUK / HOLDING ENTITY */}
              {hierarchyData.holdingNodes.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                    <span>TINGKAT 2: HOLDING / ENTITAS INDUK PERANTARA</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {hierarchyData.holdingNodes.map((holding) => {
                      const isSelected = selectedNode?.id === holding.id;
                      const parents = hierarchyData.parentsOf(holding.id);
                      const children = hierarchyData.childrenOf(holding.id);
                      const topParent = parents[0];

                      return (
                        <div
                          key={holding.id}
                          onClick={() => setSelectedNode(holding)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative shadow-2xs ${
                            isSelected
                              ? "bg-blue-500/15 border-blue-500 shadow-blue-500/10 shadow-md ring-2 ring-blue-500/30"
                              : "bg-[var(--md-sys-color-surface-container-high)] border-[var(--md-sys-color-outline-variant)] hover:border-blue-500 dark:hover:border-blue-400"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-extrabold text-sm text-[var(--md-sys-color-on-surface)]">
                                  {holding.label}
                                </span>
                                {holding.type === "emiten" && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold">
                                    IDX
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1 mt-0.5">
                                {holding.name}
                              </div>
                            </div>
                            <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                              <Icon icon="ph:buildings-bold" width="14" />
                            </div>
                          </div>

                          {/* Keterangan Pemilik Induk */}
                          {topParent && (
                            <div className="mt-2.5 pt-2 border-t border-[var(--md-sys-color-outline-variant)]/60 text-[10px] text-[var(--md-sys-color-on-surface-variant)] flex items-center justify-between font-mono">
                              <span>Dimiliki oleh:</span>
                              <span className="font-bold text-purple-700 dark:text-purple-400">
                                {topParent.parent?.label} ({topParent.link.pct}%)
                              </span>
                            </div>
                          )}

                          {/* Keterangan Anak Usaha */}
                          <div className="mt-1 text-[10px] text-[var(--md-sys-color-on-surface-variant)] flex items-center justify-between font-mono">
                            <span>Memegang:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {children.length} Saham Terbuka
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* INDIKATOR ALUR PANAH KEPEMILIKAN */}
              <div className="flex justify-center items-center gap-2 text-[var(--md-sys-color-on-surface-variant)] opacity-60">
                <Icon icon="ph:arrow-down-bold" width="16" />
                <span className="text-[10px] font-mono uppercase tracking-widest">
                  Emiten Publik Tercatat di Bursa
                </span>
                <Icon icon="ph:arrow-down-bold" width="16" />
              </div>

              {/* TINGKAT 3: EMITEN BURSA EFEK INDONESIA (LISTED IDX) */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span>TINGKAT 3: EMITEN IDX (SAHAM PUBLIK)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {hierarchyData.emitenNodes.map((emiten) => {
                    const isSelected = selectedNode?.id === emiten.id;
                    const parents = hierarchyData.parentsOf(emiten.id);
                    const controllingParent = parents.find((p) => p.link.is_controlling) || parents[0];

                    return (
                      <div
                        key={emiten.id}
                        onClick={() => setSelectedNode(emiten)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative shadow-2xs ${
                          isSelected
                            ? "bg-emerald-500/15 border-emerald-500 shadow-emerald-500/10 shadow-md ring-2 ring-emerald-500/30"
                            : "bg-[var(--md-sys-color-surface-container-high)] border-[var(--md-sys-color-outline-variant)] hover:border-emerald-500 dark:hover:border-emerald-400"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-base text-[var(--md-sys-color-on-surface)]">
                                {emiten.label}
                              </span>
                              {emiten.sector && (
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]">
                                  {emiten.sector}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1 mt-0.5">
                              {emiten.name}
                            </div>
                          </div>
                          <Link
                            href={`/${emiten.label}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded-lg bg-[var(--md-sys-color-surface-container-highest)] hover:bg-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-on-primary)] transition-all text-[var(--md-sys-color-on-surface-variant)]"
                            title="Buka Analitik"
                          >
                            <Icon icon="ph:arrow-square-out-bold" width="13" />
                          </Link>
                        </div>

                        {/* Induk Pengendali Langsung */}
                        {controllingParent && (
                          <div className="mt-2.5 pt-2 border-t border-[var(--md-sys-color-outline-variant)]/60 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-[var(--md-sys-color-on-surface-variant)]">Pengendali:</span>
                              <span className="font-bold text-[var(--md-sys-color-on-surface)] truncate max-w-[120px]">
                                {controllingParent.parent?.label}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono">
                              <span className="text-[var(--md-sys-color-on-surface-variant)]">Porsi:</span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {controllingParent.link.pct}%{" "}
                                <span className="text-[9px] font-normal text-[var(--md-sys-color-on-surface-variant)]">
                                  ({controllingParent.link.is_controlling ? "Pengendali" : "Substantif"})
                                </span>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════════════════════
               MODE 2: GRAF VISUAL JARINGAN (CLEAN & OPTIMIZED ECHARTS)
               ══════════════════════════════════════════════════════════════════════════ */
            <div className="flex-1 flex flex-col h-[560px] relative">
              <ReactECharts
                option={chartOption}
                style={{ height: "100%", width: "100%" }}
                onEvents={{ click: onChartClick }}
                opts={{ renderer: "canvas" }}
              />
              <div className="absolute bottom-2 left-3 text-[10px] text-[var(--md-sys-color-on-surface-variant)]/70 font-mono select-none pointer-events-none">
                Tips: Drag simpul untuk merapikan posisi • Scroll untuk zoom • Klik simpul untuk melihat detail
              </div>
            </div>
          )}

          {/* FOOTER INFORMASI STATUS */}
          <div className="mt-4 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/60 flex flex-wrap items-center justify-between text-[11px] font-mono text-[var(--md-sys-color-on-surface-variant)]">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                <span>Ungu = Beneficial Owner</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                <span>Biru = Holding Entity</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>Hijau = Emiten IDX</span>
              </span>
            </div>
            <div className="text-[10px] text-right">
              Klik salah satu kartu untuk melihat peta kepemilikan lengkap
            </div>
          </div>
        </div>

        {/* ── KOLOM KANAN (1 COL): DRAWER DETAIL ENTITAS TERPILIH ── */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[580px] overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <div
                  className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 border ${
                    selectedNode.type === "emiten"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      : selectedNode.type === "hub"
                      ? "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30"
                      : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
                  }`}
                >
                  {selectedNode.type === "emiten"
                    ? "Emiten IDX"
                    : selectedNode.type === "hub"
                    ? "Beneficial Owner (Hub)"
                    : "Holding Entity"}
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
                <div className="space-y-2 pt-3 border-t border-[var(--md-sys-color-outline-variant)]">
                  <div className="text-[11px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider flex items-center justify-between">
                    <span>Pemegang Saham:</span>
                    <span className="font-mono text-[10px]">{nodeConnections.incoming.length} Entitas</span>
                  </div>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {nodeConnections.incoming.map((link, idx) => {
                      const srcNode = nodeMap.get(link.source);
                      return (
                        <div
                          key={idx}
                          onClick={() => srcNode && setSelectedNode(srcNode)}
                          className="p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/60 text-xs flex items-center justify-between hover:border-[var(--md-sys-color-primary)] transition-all cursor-pointer"
                        >
                          <span
                            className="font-semibold text-[var(--md-sys-color-on-surface)] truncate max-w-[130px]"
                            title={srcNode?.name || link.source}
                          >
                            {srcNode?.label || link.source.replace("owner:", "").replace("emiten:", "")}
                          </span>
                          <div className="text-right">
                            <span
                              className={`font-mono font-bold text-xs ${
                                link.is_controlling ? "text-purple-700 dark:text-purple-400" : "text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {link.pct}%
                            </span>
                            <div className="text-[9px] text-[var(--md-sys-color-on-surface-variant)] font-mono">
                              {link.is_controlling ? "Pengendali" : "Substantif"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* RELASI KELUAR (SAHAM/ANAK USAHA YANG DIMILIKI ENTITAS INI) */}
              {nodeConnections.outgoing.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-[var(--md-sys-color-outline-variant)]">
                  <div className="text-[11px] font-bold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider flex items-center justify-between">
                    <span>Anak Usaha / Portofolio:</span>
                    <span className="font-mono text-[10px]">{nodeConnections.outgoing.length} Emiten</span>
                  </div>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {nodeConnections.outgoing.map((link, idx) => {
                      const tgtNode = nodeMap.get(link.target);
                      const targetTicker = tgtNode?.label || link.target.replace("emiten:", "").toUpperCase();

                      return (
                        <div
                          key={idx}
                          onClick={() => tgtNode && setSelectedNode(tgtNode)}
                          className="p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/60 text-xs flex items-center justify-between hover:border-[var(--md-sys-color-primary)] transition-all cursor-pointer"
                        >
                          <div>
                            <span className="font-mono font-bold text-xs text-[var(--md-sys-color-primary)]">
                              {targetTicker}
                            </span>
                            <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1 max-w-[110px]">
                              {tgtNode?.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`font-mono font-bold text-xs ${
                                link.is_controlling ? "text-purple-700 dark:text-purple-400" : "text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {link.pct}%
                            </span>
                            <div className="text-[9px] text-[var(--md-sys-color-on-surface-variant)] font-mono">
                              {link.is_controlling ? "Pengendali" : "Substantif"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TOMBOL PINTAS ANALITIK (JIKA EMITEN BURSA) */}
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
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-xs text-[var(--md-sys-color-on-surface-variant)] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center text-[var(--md-sys-color-primary)] border border-[var(--md-sys-color-outline-variant)]">
                <Icon icon="ph:cursor-click-duotone" width="28" />
              </div>
              <div className="font-bold text-sm text-[var(--md-sys-color-on-surface)]">
                Pilih Entitas / Emiten
              </div>
              <p className="text-[11px] leading-relaxed max-w-[200px]">
                Klik kartu atau lingkaran untuk melihat rantai kepemilikan saham, pemegang saham pengendali, dan tautan analitik lengkap.
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
