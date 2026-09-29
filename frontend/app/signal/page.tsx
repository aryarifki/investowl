"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import DailyAlgoSignalsTab from "@/components/signal/DailyAlgoSignalsTab";
import ConfluenceScreenerTab from "@/components/signal/ConfluenceScreenerTab";

export default function SignalPage() {
  const [activeTab, setActiveTab] = useState<"algo" | "confluence">("algo");

  return (
    <main className="min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] p-4 md:p-6 transition-colors duration-300 pb-24">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* HEADER TERMINAL SINYAL */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)] shadow-2xs">
                <Icon icon="ph:broadcast-duotone" width="24" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 text-[10px] font-mono font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider mb-0.5">
                  <span>SIGNAL INTELLIGENCE TERMINAL</span>
                  <span className="opacity-40">•</span>
                  <span>DUAL ENGINE</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                  Signal Terminal
                </h1>
              </div>
            </div>

            {/* TAB TOGGLE: SINYAL HARIAN ALGO vs CONFLUENCE SCREENER */}
            <div className="flex items-center p-1 rounded-xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] self-start sm:self-auto text-xs font-semibold">
              <button
                onClick={() => setActiveTab("algo")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === "algo"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs font-bold"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                <Icon icon="ph:robot-duotone" width="16" />
                <span>Sinyal Harian Algo</span>
              </button>
              <button
                onClick={() => setActiveTab("confluence")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === "confluence"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs font-bold"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                <Icon icon="ph:crosshair-duotone" width="16" />
                <span>Confluence Screener</span>
              </button>
            </div>
          </div>
        </div>

        {/* ACTIVE TAB CONTENT */}
        {activeTab === "algo" ? (
          <DailyAlgoSignalsTab />
        ) : (
          <ConfluenceScreenerTab />
        )}
      </div>
    </main>
  );
}
