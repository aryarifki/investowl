"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Icon } from "@iconify/react";

export default function RefreshButton() {
  const { mutate } = useSWRConfig();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedRecently, setSyncedRecently] = useState(false);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncedRecently(false);
    try {
      // 1. Purge seluruh cache backend (Redis Tier-1 & In-Memory Tier-2)
      await fetch("/api/logs/cache/purge?pattern=*", { method: "POST" });

      // 2. Paksa refresh data daily summary dari database
      await fetch("/api/bandar/daily-summary?universe_mode=watchlist&refresh=1");

      // 3. Revalidasi seluruh query SWR di frontend secara menyeluruh
      await mutate(() => true, undefined, { revalidate: true });

      setSyncedRecently(true);
      setTimeout(() => setSyncedRecently(false), 2000);
    } catch (e) {
      console.error("Gagal sinkronisasi data & cache:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md transition-all active:scale-95 disabled:opacity-60 cursor-pointer ${
        syncedRecently
          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
          : "bg-[var(--md-sys-color-surface-container-highest)] hover:bg-[var(--md-sys-color-surface-container-high)] border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
      }`}
      title="Sinkronisasi Database & Bersihkan Cache Aplikasi (Redis + Memory)"
    >
      <Icon
        icon={
          syncedRecently
            ? "ph:check-bold"
            : "ph:arrows-clockwise-duotone"
        }
        width="16"
        className={
          isSyncing
            ? "animate-spin text-[var(--md-sys-color-primary)]"
            : syncedRecently
            ? "text-emerald-400"
            : ""
        }
      />
      <span className="text-[10px] font-mono font-bold uppercase tracking-wider hidden sm:inline">
        {isSyncing ? "Syncing..." : syncedRecently ? "Synced!" : "Sync DB"}
      </span>
    </button>
  );
}
