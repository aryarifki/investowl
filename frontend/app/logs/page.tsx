"use client";

import React, { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { Icon } from "@iconify/react";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  });

type JobKey = "scanner" | "auditor" | "backfill" | "etl_flow" | "pipeline";

interface JobStatus {
  key: JobKey;
  label: string;
  description: string;
  status: "idle" | "running" | "success" | "failed" | "stopped";
  pid?: number | null;
  started_at?: string | null;
  elapsed_seconds?: number | null;
  last_finished_at?: string | null;
  last_exit_code?: number | null;
  last_log_file?: string | null;
  supports_universe?: boolean;
  supports_window?: boolean;
}

interface LogFileInfo {
  filename: string;
  size_bytes: number;
  size_kb: number;
  modified_at: string;
}

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState<JobKey>("backfill");
  const [selectedFile, setSelectedFile] = useState<string>("latest");
  const [copied, setCopied] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form options untuk parameter job
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [universe, setUniverse] = useState<string>("watchlist");
  const [windowPreset, setWindowPreset] = useState<string>("standard");

  const terminalRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { key: "backfill", label: "1. Backfill", icon: "ph:download-simple-duotone" },
    { key: "auditor", label: "2. Auditor", icon: "ph:robot-duotone" },
    { key: "etl_flow", label: "3. ETL Flow", icon: "ph:graph-duotone" },
    { key: "scanner", label: "4. Scanner", icon: "ph:lightning-duotone" },
    { key: "pipeline", label: "Full Pipeline", icon: "ph:stack-duotone" },
  ] as const;

  // 1. Polling status semua jobs (dinamis: lebih cepat jika ada yang running)
  const { data: statusData, mutate: mutateStatus } = useSWR<{ jobs: Record<JobKey, JobStatus> }>(
    "/api/logs/jobs/status",
    fetcher,
    {
      refreshInterval: (data) => {
        const isAnyRunning = data?.jobs && Object.values(data.jobs).some((j) => j.status === "running");
        return isAnyRunning ? 2500 : 8000;
      },
      revalidateOnFocus: true,
    }
  );

  const currentJobStatus = statusData?.jobs?.[activeTab];
  const isJobRunning = currentJobStatus?.status === "running";

  // 2. Mengambil riwayat file log untuk job yang sedang aktif
  const { data: historyData } = useSWR<{ files: LogFileInfo[] }>(
    `/api/logs/history?job=${activeTab === "pipeline" ? "cron_daily" : activeTab}`,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: false }
  );

  // 3. Mengambil isi teks log (baik file spesifik atau latest)
  const logApiUrl =
    selectedFile === "latest"
      ? activeTab === "pipeline"
        ? "/api/logs/view?filename=cron_daily.log"
        : "/api/logs/daily"
      : `/api/logs/view?filename=${encodeURIComponent(selectedFile)}`;

  const {
    data: logData,
    error: logError,
    isLoading: isLogLoading,
    isValidating: isLogValidating,
    mutate: mutateLog,
  } = useSWR(logApiUrl, fetcher, {
    refreshInterval: isJobRunning ? 3000 : 0,
    revalidateOnFocus: false,
  });

  // Tentukan teks log yang ditampilkan
  let currentLogContent = "Menunggu data log...";
  if (selectedFile === "latest") {
    if (activeTab === "pipeline") {
      currentLogContent = logData?.content || "Belum ada log untuk cron_daily.log.";
    } else {
      currentLogContent = logData?.logs?.[activeTab] || "Belum ada log untuk job ini.";
    }
  } else {
    currentLogContent = logData?.content || "Memuat riwayat file...";
  }

  // Auto-scroll ke bawah terminal saat ada update log
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [currentLogContent, autoScroll]);

  // Reset file selector saat tab berganti
  useEffect(() => {
    setSelectedFile("latest");
    setActionError(null);
  }, [activeTab]);

  // Handler Trigger Job
  const handleTriggerJob = async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const payload: Record<string, any> = {};
      if (currentJobStatus?.supports_universe) {
        payload.universe = universe;
      }
      if (currentJobStatus?.supports_window) {
        payload.windows = windowPreset === "full" ? [20, 30, 60, 90, 180] : [20, 60];
      }

      const res = await fetch(`/api/logs/jobs/${activeTab}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || "Gagal memulai job.");
      }

      setShowConfigModal(false);
      setSelectedFile("latest");
      // Refresh status dan log segera
      mutateStatus();
      setTimeout(() => mutateLog(), 1000);
    } catch (err: any) {
      setActionError(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Stop Job
  const handleStopJob = async () => {
    if (!confirm(`Hentikan proses ${currentJobStatus?.label || activeTab} yang sedang berjalan?`)) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/logs/jobs/${activeTab}/stop`, { method: "POST" });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.detail || "Gagal menghentikan job.");
      mutateStatus();
      mutateLog();
    } catch (err: any) {
      setActionError(err.message || "Terjadi kesalahan saat menghentikan job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLog = () => {
    if (!currentLogContent) return;
    navigator.clipboard.writeText(currentLogContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 pb-24 animate-fade-in max-w-7xl mx-auto">
      {/* ── HEADER & OVERVIEW ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--md-sys-color-outline-variant)] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center">
              <Icon icon="ph:terminal-window-duotone" width="20" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[var(--md-sys-color-on-surface)] tracking-tight">
              SYSTEM LOGS & JOB RUNNER
            </h1>
          </div>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
            Pusat pemantauan log cronjob dan kontrol eksekusi analitik data pasar SMtracker.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tombol Sinkronisasi Manual */}
          <button
            onClick={() => {
              mutateStatus();
              mutateLog();
            }}
            disabled={isLogValidating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] rounded-lg text-xs font-semibold text-[var(--md-sys-color-on-surface)] transition-all active:scale-[0.98] disabled:opacity-50"
            title="Perbarui log dan status proses"
          >
            <Icon
              icon={isLogValidating ? "ph:spinner-gap-duotone" : "ph:arrows-clockwise-bold"}
              className={isLogValidating ? "animate-spin" : "text-[var(--md-sys-color-primary)]"}
              width="14"
              height="14"
            />
            <span>{isLogValidating ? "Menyinkronkan..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ── TABS DAFTAR JOB ── */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const jobStat = statusData?.jobs?.[tab.key];
          const isRunning = jobStat?.status === "running";

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold border transition-all active:scale-[0.98] shadow-sm ${
                isActive
                  ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-[var(--md-sys-color-primary)]"
                  : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
              }`}
            >
              <Icon icon={tab.icon} width="16" />
              <span>{tab.label}</span>
              {isRunning && (
                <span className="flex h-2 w-2 relative ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── ACTION & STATUS BAR ── */}
      <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Info Job & Status Badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-bold text-[var(--md-sys-color-on-surface)]">
              {currentJobStatus?.label || activeTab}
            </h2>

            {/* Status Badge */}
            {isJobRunning ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                <Icon icon="ph:spinner-gap-duotone" className="animate-spin" width="13" />
                <span>Running {currentJobStatus?.elapsed_seconds ? `(${currentJobStatus.elapsed_seconds}s)` : ""}</span>
                {currentJobStatus?.pid && <span className="opacity-70 font-mono text-[10px]">PID: {currentJobStatus.pid}</span>}
              </span>
            ) : currentJobStatus?.status === "success" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <Icon icon="ph:check-circle-duotone" width="13" />
                <span>Success</span>
              </span>
            ) : currentJobStatus?.status === "failed" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                <Icon icon="ph:warning-circle-duotone" width="13" />
                <span>Failed</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border border-neutral-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                <span>Idle / Siap</span>
              </span>
            )}
          </div>

          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
            {currentJobStatus?.description}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Dropdown File Riwayat */}
          <div className="flex items-center gap-1.5 bg-[var(--md-sys-color-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--md-sys-color-on-surface)]">
            <Icon icon="ph:calendar-blank-duotone" className="text-[var(--md-sys-color-on-surface-variant)]" width="15" />
            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="bg-transparent border-none outline-none font-medium text-xs cursor-pointer pr-1"
            >
              <option value="latest">Log Terkini (Live)</option>
              {historyData?.files?.map((f) => (
                <option key={f.filename} value={f.filename}>
                  {f.filename} ({f.size_kb} KB)
                </option>
              ))}
            </select>
          </div>

          {/* Tombol Run / Stop */}
          {isJobRunning ? (
            <button
              onClick={handleStopJob}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Icon icon="ph:stop-bold" width="14" />
              <span>Hentikan</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (currentJobStatus?.supports_universe || currentJobStatus?.supports_window) {
                  setShowConfigModal(true);
                } else {
                  handleTriggerJob();
                }
              }}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--md-sys-color-primary)] hover:opacity-90 text-[var(--md-sys-color-on-primary)] rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
              <Icon icon="ph:play-bold" width="13" />
              <span>Jalankan Sekarang</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner Error Aksi (jika ada) */}
      {actionError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon icon="ph:warning-circle-duotone" width="18" className="shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:opacity-80">
            <Icon icon="ph:x-bold" width="14" />
          </button>
        </div>
      )}

      {/* ── MODAL KONFIGURASI PARAMETER (Untuk job yang mendukung flag) ── */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--md-sys-color-outline-variant)] pb-3">
              <div className="flex items-center gap-2">
                <Icon icon="ph:sliders-horizontal-duotone" width="20" className="text-[var(--md-sys-color-primary)]" />
                <h3 className="text-base font-bold text-[var(--md-sys-color-on-surface)]">
                  Parameter {currentJobStatus?.label}
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
              >
                <Icon icon="ph:x-bold" width="16" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {currentJobStatus?.supports_universe && (
                <div>
                  <label className="block font-semibold text-[var(--md-sys-color-on-surface)] mb-1.5">
                    Universe Saham:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "watchlist", label: "Watchlist (10)" },
                      { id: "idx80", label: "IDX80 (80)" },
                      { id: "all", label: "Semua (~960)" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setUniverse(opt.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-center font-medium transition-all ${
                          universe === opt.id
                            ? "bg-[var(--md-sys-color-primary-container)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary-container)]"
                            : "bg-[var(--md-sys-color-surface)] border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentJobStatus?.supports_window && (
                <div>
                  <label className="block font-semibold text-[var(--md-sys-color-on-surface)] mb-1.5">
                    Lookback Windows:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "standard", label: "Standard (20, 60 Hari)" },
                      { id: "full", label: "Lengkap (20, 30, 60, 90, 180)" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setWindowPreset(opt.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-center font-medium transition-all ${
                          windowPreset === opt.id
                            ? "bg-[var(--md-sys-color-primary-container)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary-container)]"
                            : "bg-[var(--md-sys-color-surface)] border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface)] p-2.5 rounded-lg border border-[var(--md-sys-color-outline-variant)]">
                ℹ️ Skrip akan berjalan di latar belakang (background process) dan output-nya dicatat langsung ke file log.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--md-sys-color-outline-variant)]">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-3 py-1.5 rounded-lg border border-[var(--md-sys-color-outline-variant)] text-xs font-semibold text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleTriggerJob}
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-[var(--md-sys-color-primary)] hover:opacity-90 text-[var(--md-sys-color-on-primary)] text-xs font-bold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? "Memulai..." : "Eksekusi Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TERMINAL EMULATOR UI ── */}
      <div className="bg-[var(--md-sys-color-surface-container-lowest)] dark:bg-black/50 border border-[var(--md-sys-color-outline-variant)] rounded-2xl overflow-hidden shadow-sm">
        {/* Terminal Title Bar */}
        <div className="flex items-center justify-between bg-[var(--md-sys-color-surface-container-high)] dark:bg-black/30 border-b border-[var(--md-sys-color-outline-variant)] px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
            </div>
            <span className="text-[11px] font-mono font-medium text-[var(--md-sys-color-on-surface-variant)]">
              {selectedFile === "latest" ? `${activeTab}_latest.log` : selectedFile}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
                autoScroll ? "text-[var(--md-sys-color-primary)] font-bold" : "text-[var(--md-sys-color-on-surface-variant)]"
              }`}
              title="Gulir otomatis ke baris terbawah"
            >
              <Icon icon={autoScroll ? "ph:lock-simple-bold" : "ph:lock-simple-open-bold"} width="13" />
              <span className="hidden sm:inline">Auto-scroll</span>
            </button>

            {/* Copy button */}
            <button
              onClick={handleCopyLog}
              className="flex items-center gap-1 text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] transition-colors"
              title="Salin isi log ke clipboard"
            >
              <Icon icon={copied ? "ph:check-bold" : "ph:copy-bold"} width="13" className={copied ? "text-emerald-500" : ""} />
              <span className="hidden sm:inline">{copied ? "Disalin!" : "Salin Log"}</span>
            </button>
          </div>
        </div>

        {/* Terminal Screen Content */}
        <div
          ref={terminalRef}
          className="p-4 h-[62vh] overflow-auto scrollbar-thin scrollbar-thumb-[var(--md-sys-color-outline-variant)] font-mono text-[11px] sm:text-xs leading-relaxed"
        >
          {isLogLoading ? (
            <div className="flex items-center justify-center h-full text-[var(--md-sys-color-on-surface-variant)]">
              <Icon icon="ph:spinner-gap-duotone" className="animate-spin mr-2" width="20" />
              <span>Memuat file log...</span>
            </div>
          ) : logError ? (
            <div className="p-4 text-rose-500 text-xs">
              Gagal memuat log. Pastikan file log tersedia dan backend FastAPI aktif.
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-[var(--md-sys-color-on-surface)] dark:text-emerald-400/90 selection:bg-emerald-500/30">
              {currentLogContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
