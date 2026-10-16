"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import WhalesDashboard from "@/components/whales/WhalesDashboard";
import NyangkutDashboardTab from "@/components/whales/NyangkutDashboardTab";

const TABS = [
  { id: "whales", label: "Whales Tracker (Smart Money)", icon: "ph:fish-simple-bold" },
  { id: "nyangkut", label: "Radar Nyangkut & Ritel", icon: "ph:anchor-bold" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function WhalesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as TabId | null;

  const [activeTab, setActiveTab] = useState<TabId>("whales");

  useEffect(() => {
    if (tabParam && ["whales", "nyangkut"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", id);
    router.replace(`/whales?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* HEADER PEMBUNGKUS WHALES & RITEL (STYLED LIKE DETAIL PAGE) */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)] shadow-2xs">
              <Icon icon={activeTab === "whales" ? "ph:fish-simple-bold" : "ph:anchor-bold"} width="26" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] font-mono font-bold text-[var(--md-sys-color-primary)] uppercase tracking-wider mb-0.5">
                <span>MARKET OWNERSHIP INTELLIGENCE</span>
                <span className="opacity-40">•</span>
                <span>BIG MONEY VS RETAIL</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
                Whales & Retail Tracker
              </h1>
            </div>
          </div>

          <div className="text-xs font-mono text-[var(--md-sys-color-on-surface-variant)] flex items-center gap-2 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
            <span>Broker & KSEI Institutional Data</span>
          </div>
        </div>
      </div>

      {/* MODERN SEGMENTED TABS (IDENTICAL TO DETAIL PAGE TABS) */}
      <div className="border-b border-[var(--md-sys-color-outline-variant)]">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                  isActive
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm"
                    : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]"
                }`}
              >
                <Icon icon={tab.icon} width="16" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT RENDERER */}
      <div className="transition-colors duration-200">
        {activeTab === "whales" && <WhalesDashboard />}
        {activeTab === "nyangkut" && <NyangkutDashboardTab />}
      </div>
    </div>
  );
}

export default function WhalesPage() {
  return (
    <main className="min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] p-4 md:p-6 transition-colors duration-300 pb-24">
      <Suspense
        fallback={
          <div className="max-w-7xl mx-auto p-8 text-center text-xs font-mono text-[var(--md-sys-color-on-surface-variant)] animate-pulse">
            Memuat dashboard whales & ritel...
          </div>
        }
      >
        <WhalesContent />
      </Suspense>
    </main>
  );
}
