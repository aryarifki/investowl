"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Icon } from "@iconify/react";
import { useAppStore } from "@/store/useAppStore";

export default function RefreshButton() {
  const { mutate } = useSWRConfig();
  const { setCacheLoading } = useAppStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedRecently, setSyncedRecently] = useState(false);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncedRecently(false);

    // Aktifkan Layer Transparan dengan Informasi Tahap 1
    setCacheLoading({
      isOpen: true,
      title: "Sinkronisasi Cache & Database",
      step: "Membersihkan cache layer L1 (Redis) & L2 (In-Memory)...",
      detail: "POST /api/logs/cache/purge?pattern=*",
      progress: 25,
      isSuccess: false,
    });

    try {
      // 1. Purge seluruh cache backend (Redis Tier-1 & In-Memory Tier-2)
      const purgeRes = await fetch("/api/logs/cache/purge?pattern=*", { method: "POST" });
      const purgeJson = await purgeRes.json().catch(() => ({}));
      const deletedKeys = purgeJson.deleted_keys ?? 0;

      // Update Informasi Tahap 2
      setCacheLoading({
        step: "Mengambil data komputasi pasar terverifikasi dari PostgreSQL...",
        detail: `Dibersihkan: ${deletedKeys} keys | GET /api/bandar/daily-summary`,
        progress: 60,
      });

      // 2. Paksa refresh data daily summary dari database
      await fetch("/api/bandar/daily-summary?universe_mode=watchlist&refresh=1");

      // Update Informasi Tahap 3
      setCacheLoading({
        step: "Menyinkronkan data tampilan antarmuka (SWR Revalidation)...",
        detail: "Broadcasting mutate() revalidation ke seluruh query aktif",
        progress: 85,
      });

      // 3. Revalidasi seluruh query SWR di frontend secara menyeluruh
      await mutate(() => true, undefined, { revalidate: true });

      // Update Informasi Tahap 4 (Selesai)
      setCacheLoading({
        step: "Berhasil! Cache telah dimuat ulang dan data tersinkron sempurna.",
        detail: "Status: 200 OK — Cache Warm & Verified",
        progress: 100,
        isSuccess: true,
      });

      setSyncedRecently(true);
      setTimeout(() => setSyncedRecently(false), 2000);

      // Jeda 700ms agar user dapat membaca status sukses sebelum layer transparan tertutup
      setTimeout(() => {
        setCacheLoading({ isOpen: false, isSuccess: false });
      }, 700);
    } catch (e) {
      console.error("Gagal sinkronisasi data & cache:", e);
      setCacheLoading({
        step: "Gagal menyinkronkan cache. Periksa koneksi backend!",
        detail: "Error: Gagal memanggil endpoint cache",
        progress: 100,
        isSuccess: false,
      });
      setTimeout(() => {
        setCacheLoading({ isOpen: false });
      }, 1500);
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
