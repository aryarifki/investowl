"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import ForeignFlowDeepDiveTab from "@/components/foreign/ForeignFlowDeepDiveTab";
import SectorRotationDashboard from "@/components/foreign/SectorRotationDashboard";

export default function ForeignPage() {
  const [activeTab, setActiveTab] = useState<"deepdive" | "sectors">("deepdive");

  return (
    <main className="min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] p-4 md:p-6 transition-colors duration-300 pb-24">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* HEADER PEMBUNGKUS FOREIGN FLOW */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[var(--md-sys-color-primary)] to-emerald-500"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)] shadow-2xs">
                <Icon icon="ph:chart-polar-duotone" width="22" />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                Foreign Flow
              </h1>
            </div>

            {/* TAB TOGGLE: DEEP DIVE SAHAM (UTAMA) vs ROTASI SEKTOR */}
            <div className="flex items-center p-1 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] self-start sm:self-auto text-xs font-semibold">
              <button
                onClick={() => setActiveTab("deepdive")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === "deepdive"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                <Icon icon="ph:magnifying-glass-duotone" width="16" />
                <span>Deep Dive Saham</span>
              </button>
              <button
                onClick={() => setActiveTab("sectors")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === "sectors"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                <Icon icon="ph:arrows-left-right-bold" width="16" />
                <span>Rotasi Sektor</span>
              </button>
            </div>
          </div>
        </div>

        {activeTab === "deepdive" ? (
          <ForeignFlowDeepDiveTab />
        ) : (
          <SectorRotationDashboard />
        )}
      </div>
    </main>
  );
}
