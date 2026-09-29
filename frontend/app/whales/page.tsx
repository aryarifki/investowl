import React from "react";
import { Icon } from "@iconify/react";
import WhalesDashboard from "@/components/whales/WhalesDashboard";

export const metadata = {
  title: "Whales Tracker | The Investowl",
  description: "Lacak akumulasi dan distribusi modal besar broker di seluruh saham IDX.",
};

export default function WhalesPage() {
  return (
    <main className="min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] p-4 md:p-6 transition-colors duration-300 pb-24">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* HEADER PEMBUNGKUS WHALES TRACKER */}
        <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] flex items-center justify-center shrink-0 border border-[var(--md-sys-color-outline-variant)] shadow-2xs">
              <Icon icon="ph:fish-simple-bold" width="22" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">
              Whales Tracker
            </h1>
          </div>
        </div>

        <WhalesDashboard />
      </div>
    </main>
  );
}
