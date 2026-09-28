"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ConglomerateGroup {
  id: string;
  name: string;
  owner: string;
  description: string;
  icon: string;
  accent: string;
  tickers: string[];
}

const CONGLOMERATE_GROUPS: ConglomerateGroup[] = [
  {
    id: "djarum",
    name: "Grup Djarum",
    owner: "Keluarga Hartono",
    description: "Pemimpin industri perbankan swasta dan infrastruktur telekomunikasi.",
    icon: "ph:bank-duotone",
    accent: "from-blue-500/20 to-indigo-500/10 border-blue-500/30",
    tickers: ["BBCA", "TOWR", "BELI", "RANC"],
  },
  {
    id: "barito",
    name: "Grup Barito",
    owner: "Prajogo Pangestu",
    description: "Raksasa energi baru terbarukan, petrokimia, dan diversifikasi tambang.",
    icon: "ph:leaf-duotone",
    accent: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30",
    tickers: ["BREN", "BRPT", "TPIA", "CUAN", "PTRO"],
  },
  {
    id: "astra",
    name: "Grup Astra",
    owner: "Jardine Matheson / Publik",
    description: "Konglomerat konglomerasi otomotif, alat berat, agribisnis, dan finansial.",
    icon: "ph:car-duotone",
    accent: "from-sky-500/20 to-cyan-500/10 border-sky-500/30",
    tickers: ["ASII", "UNTR", "AUTO", "ASGR", "AALI"],
  },
  {
    id: "salim",
    name: "Grup Salim",
    owner: "Anthoni Salim",
    description: "Ekosistem bahan makanan pokok terbesar, agribisnis hulu-hilir, dan tambang emas.",
    icon: "ph:bowl-food-duotone",
    accent: "from-amber-500/20 to-yellow-500/10 border-amber-500/30",
    tickers: ["INDF", "ICBP", "LSIP", "SIMP", "AMMN"],
  },
  {
    id: "sinarmas",
    name: "Grup Sinarmas",
    owner: "Keluarga Widjaja",
    description: "Produsen pulp & kertas kelas dunia, properti perkotaan, dan jasa keuangan.",
    icon: "ph:tree-evergreen-duotone",
    accent: "from-orange-500/20 to-rose-500/10 border-orange-500/30",
    tickers: ["INKP", "TKIM", "SMMA", "BSDE", "DMAS"],
  },
  {
    id: "bakrie",
    name: "Grup Bakrie",
    owner: "Keluarga Bakrie",
    description: "Pemain tambang batubara & mineral skala masif, energi, dan infrastruktur.",
    icon: "ph:flame-duotone",
    accent: "from-red-500/20 to-orange-500/10 border-red-500/30",
    tickers: ["BUMI", "BRMS", "DEWA", "ENRG", "VKTR"],
  },
  {
    id: "bumn-bank",
    name: "BUMN Perbankan",
    owner: "Negara Kesatuan RI",
    description: "Pilar perbankan Himbara penopang likuiditas dan pembiayaan nasional.",
    icon: "ph:vault-duotone",
    accent: "from-violet-500/20 to-purple-500/10 border-violet-500/30",
    tickers: ["BBRI", "BMRI", "BBNI", "BBTN"],
  },
  {
    id: "bumn-resources",
    name: "BUMN Sumber Daya Alam",
    owner: "MIND ID & Pertamina",
    description: "Holding tambang dan energi strategis nikel, gas bumi, emas, dan batubara.",
    icon: "ph:mountains-duotone",
    accent: "from-amber-600/20 to-emerald-600/10 border-amber-600/30",
    tickers: ["PGAS", "ANTM", "PTBA", "TINS", "ELSA"],
  },
];

function TickerMiniCard({ ticker }: { ticker: string }) {
  const { data, isLoading } = useSWR(`/api/bandar/detail/${ticker}?window_days=20`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="h-14 bg-[var(--md-sys-color-surface-container)] rounded-xl animate-pulse p-2 flex items-center justify-between border border-[var(--md-sys-color-outline-variant)]/50">
        <div className="h-4 w-12 bg-[var(--md-sys-color-surface-container-highest)] rounded" />
        <div className="h-4 w-16 bg-[var(--md-sys-color-surface-container-highest)] rounded" />
      </div>
    );
  }

  const closePrice = data?.close ?? "-";
  const ret5d = data?.ret_5d;
  const isUp = ret5d && ret5d > 0;
  const isDown = ret5d && ret5d < 0;

  return (
    <Link
      href={`/${ticker}`}
      className="group block p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-low)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] transition-all duration-200 active:scale-95"
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)]">
          {ticker}
        </span>
        <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface)]">
          {typeof closePrice === "number" ? closePrice.toLocaleString("id-ID") : closePrice}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1 text-[11px]">
        <span className="text-[var(--md-sys-color-on-surface-variant)] truncate max-w-[80px]">
          {data?.signal_raw || data?.signal || "NETRAL"}
        </span>
        <span
          className={`font-medium ${
            isUp
              ? "text-emerald-500 dark:text-emerald-400"
              : isDown
              ? "text-rose-500 dark:text-rose-400"
              : "text-[var(--md-sys-color-on-surface-variant)]"
          }`}
        >
          {ret5d !== null && ret5d !== undefined
            ? `${(ret5d * 100).toFixed(1)}%`
            : "0.0%"}
        </span>
      </div>
    </Link>
  );
}

export default function KongloPage() {
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredGroups = CONGLOMERATE_GROUPS.filter((group) => {
    const matchesTab = selectedGroup === "all" || group.id === selectedGroup;
    const matchesSearch =
      search === "" ||
      group.name.toLowerCase().includes(search.toLowerCase()) ||
      group.owner.toLowerCase().includes(search.toLowerCase()) ||
      group.tickers.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  return (
    <main className="min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] p-4 md:p-6 transition-colors duration-300 pb-24">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* HEADER PEMBUNGKUS KONGLOMERASI */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[var(--md-sys-color-primary)] to-emerald-500"></div>

          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)] shadow-2xs">
              <Icon icon="ph:buildings-bold" width="22" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
              Konglomerasi
            </h1>
          </div>

          {/* Search Box Filter Konglomerat */}
          <div className="mt-4 relative">
            <Icon
              icon="ph:magnifying-glass-duotone"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)]"
              width="18"
            />
            <input
              type="text"
              placeholder="Cari grup konglomerat atau kode emiten (misal: Salim, BREN, Astra)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] text-xs text-[var(--md-sys-color-on-surface)] placeholder-[var(--md-sys-color-on-surface-variant)] focus:outline-none focus:ring-2 focus:ring-[var(--md-sys-color-primary)] transition-all font-sans"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-medium">
          <button
            onClick={() => setSelectedGroup("all")}
            className={`px-3.5 py-1.5 rounded-full shrink-0 transition-all ${
              selectedGroup === "all"
                ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm"
                : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
            }`}
          >
            Semua Grup ({CONGLOMERATE_GROUPS.length})
          </button>
          {CONGLOMERATE_GROUPS.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(g.id)}
              className={`px-3 py-1.5 rounded-full shrink-0 transition-all ${
                selectedGroup === g.id
                  ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm"
                  : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Group Cards Grid */}
        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className="rounded-[20px] bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] p-4 shadow-sm transition-all hover:border-[var(--md-sys-color-primary)]/40"
            >
              {/* Group Header */}
              <div className="flex items-start justify-between mb-3 pb-2.5 border-b border-[var(--md-sys-color-outline-variant)]/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0">
                    <Icon icon={group.icon} width="22" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
                      {group.name}
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
                        {group.owner}
                      </span>
                    </h2>
                    <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1 mt-0.5">
                      {group.description}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-[var(--md-sys-color-primary)] px-2 py-1 rounded-lg bg-[var(--md-sys-color-primary-container)]/40">
                  {group.tickers.length} Emiten
                </span>
              </div>

              {/* Ticker Mini Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {group.tickers.map((t) => (
                  <TickerMiniCard key={t} ticker={t} />
                ))}
              </div>
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="text-center py-12 rounded-[20px] bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]">
              <Icon icon="ph:magnifying-glass-duotone" className="mx-auto text-[var(--md-sys-color-on-surface-variant)]" width="40" />
              <p className="mt-2 text-sm font-medium text-[var(--md-sys-color-on-surface)]">Tidak ada grup konglomerat ditemukan</p>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">Coba kata kunci pencarian yang berbeda.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
