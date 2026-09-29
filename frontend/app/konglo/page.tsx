"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import OwnershipNetworkGraph from "@/components/konglo/OwnershipNetworkGraph";
import ShareholderMatrix from "@/components/konglo/ShareholderMatrix";

export default function KongloPage() {
  const [activeTab, setActiveTab] = useState<"network" | "matrix">("network");

  return (
    <main className="min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] p-4 md:p-6 transition-colors duration-300 pb-24">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* HEADER PEMBUNGKUS KONGLOMERASI */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[var(--md-sys-color-primary)] to-emerald-500"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)] shadow-2xs">
                <Icon icon="ph:buildings-bold" width="22" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 text-[10px] font-mono font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider mb-0.5">
                  <span>CORPORATE OWNERSHIP & CONGLOMERATES</span>
                  <span className="opacity-40">•</span>
                  <span>IDX ECOSYSTEM</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                  Konglomerasi
                </h1>
              </div>
            </div>

            {/* TAB TOGGLE: PETA JEJARING vs MATRIKS TABEL */}
            <div className="flex items-center p-1 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] self-start sm:self-auto text-xs font-semibold">
              <button
                onClick={() => setActiveTab("network")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === "network"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs font-bold"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                <Icon icon="ph:tree-structure-duotone" width="16" />
                <span>Peta Jejaring Graf</span>
              </button>
              <button
                onClick={() => setActiveTab("matrix")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === "matrix"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs font-bold"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                <Icon icon="ph:table-duotone" width="16" />
                <span>Matriks & Pencarian</span>
              </button>
            </div>
          </div>
        </div>

        {/* ACTIVE TAB CONTENT */}
        {activeTab === "network" ? (
          <OwnershipNetworkGraph />
        ) : (
          <ShareholderMatrix />
        )}
      </div>
    </main>
  );
}
