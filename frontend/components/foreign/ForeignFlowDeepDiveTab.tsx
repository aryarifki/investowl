"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import { useForeignFlowAnalytics } from '@/hooks/useForeignFlow';
import { Icon } from "@iconify/react";

const VARChart = dynamic(() => import('./VARChart'), { ssr: false });
const HMMChart = dynamic(() => import('./HMMChart'), { ssr: false });
const BrokerHeatmap = dynamic(() => import('./BrokerHeatmap'), { ssr: false });
const BrokerNetworkGraph = dynamic(() => import('./BrokerNetworkGraph'), { ssr: false });

export default function ForeignFlowDeepDiveTab() {
  const { activeTicker, windowDays } = useAppStore();
  const { data, isLoading, isFetching, isError } = useForeignFlowAnalytics(activeTicker, windowDays);

  const getHmmTone = (state: number): string => {
    if (state === 2) return "var(--color-positive)"; 
    if (state === 0) return "var(--color-negative)"; 
    return "var(--md-sys-color-outline)";                  
  };

  const getHmmLabel = (state: number): string => {
    if (state === 2) return "Accumulation";
    if (state === 0) return "Distribution";
    return "Neutral";
  };

  const zScoreValue = data?.features?.foreign_zscore || 0;
  const hhiValue = data?.features?.foreign_hhi || 0;
  const latestState = data?.timeseries?.hmm_states?.length > 0 
    ? data.timeseries.hmm_states[data.timeseries.hmm_states.length - 1] 
    : 1;

  const companyName = data?.company?.name || "Perusahaan Tidak Diketahui";
  const groupName = data?.company?.group || "Independen / Belum Terpetakan";

  return (
    <div className="flex flex-col gap-5 sm:gap-6 pb-24 transition-colors duration-300 animate-fade-in">
      
      {/* HEADER EMITEN */}
      <div className="mt-2 bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[28px] p-5 sm:p-7 shadow-sm transition-colors duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--md-sys-color-primary)] to-[var(--md-sys-color-tertiary)] opacity-80"></div>
        <div className="text-[10px] sm:text-xs font-extrabold text-[var(--md-sys-color-primary)] uppercase tracking-widest mb-1.5">
          FOREIGN FLOW DEEP DIVE
        </div>
        
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-2.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--md-sys-color-on-surface)] tracking-tight">{activeTicker}</h1>
          <span className="text-[10px] sm:text-xs font-bold bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] border border-[var(--md-sys-color-outline-variant)] rounded-full px-3.5 py-1.5 shadow-sm">
            {windowDays} Days Window
          </span>
          {isFetching && !isLoading && (
            <span className="text-[10px] font-bold tracking-widest uppercase text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20 shadow-sm animate-pulse flex items-center gap-1.5">
              <Icon icon="ph:spinner-gap-bold" className="animate-spin" width="14" />
              Updating...
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2.5 text-[10px] sm:text-xs">
          <span className="text-[var(--md-sys-color-on-surface-variant)] font-bold">{companyName}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--md-sys-color-outline-variant)]" />
          <span className="text-[var(--md-sys-color-primary)] font-extrabold tracking-wide">{groupName}</span>
        </div>
      </div>

      {/* LOADING STATE */}
      {isLoading && (
        <div className="flex items-center justify-center py-24 text-[var(--md-sys-color-on-surface-variant)] animate-pulse bg-[var(--md-sys-color-surface-container-low)] rounded-[28px] border border-[var(--md-sys-color-outline-variant)] shadow-sm">
          <Icon icon="ph:spinner-gap-bold" className="animate-spin mr-3 text-[var(--md-sys-color-primary)]" width="24" /> 
          <span className="font-extrabold tracking-widest uppercase text-sm">RUNNING ALGORITHMS...</span>
        </div>
      )}
      
      {/* ERROR STATE */}
      {isError && !isLoading && (
        <div className="p-5 text-[var(--md-sys-color-on-error-container)] bg-[var(--md-sys-color-error-container)] rounded-[24px] border-l-4 border-l-[var(--md-sys-color-error)] border border-[var(--md-sys-color-error)] text-sm font-bold shadow-sm">
          Gagal memuat analitik. Histori aliran dana asing untuk {activeTicker} pada window {windowDays} hari tidak mencukupi (Min 20 hari).
        </div>
      )}

      {/* DASHBOARD KONTEN */}
      {!isLoading && !isError && data && (
        <>
          {/* Compact Metric Cards (MD3 Expressive Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
            {/* Regime Card */}
            <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[24px] p-5 shadow-sm transition-all duration-300 relative overflow-hidden group hover:shadow-md">
              <div className="absolute top-0 left-0 w-1.5 h-full opacity-80 group-hover:opacity-100 transition-all duration-300" style={{ backgroundColor: getHmmTone(latestState) }}></div>
              <div className="pl-2">
                <div className="flex items-center gap-2 mb-2">
                   <Icon icon="ph:chart-polar-bold" style={{ color: getHmmTone(latestState) }} width="20" />
                   <div className="text-[9px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest opacity-90">CURRENT REGIME</div>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1" style={{ color: getHmmTone(latestState) }}>{getHmmLabel(latestState)}</div>
                <div className="text-[10px] sm:text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] mt-1.5 opacity-80">Hidden Markov Model</div>
              </div>
            </div>
            
            {/* Momentum Card */}
            <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[24px] p-5 shadow-sm transition-all duration-300 relative overflow-hidden group hover:shadow-md">
              <div className="absolute top-0 left-0 w-1.5 h-full opacity-80 group-hover:opacity-100 transition-all duration-300" style={{ backgroundColor: zScoreValue > 1 ? "var(--color-positive)" : zScoreValue < -1 ? "var(--color-negative)" : "var(--md-sys-color-outline)" }}></div>
              <div className="pl-2">
                <div className="flex items-center gap-2 mb-2">
                   <Icon icon="ph:trend-up-bold" style={{ color: zScoreValue > 1 ? "var(--color-positive)" : zScoreValue < -1 ? "var(--color-negative)" : "var(--md-sys-color-outline)" }} width="20" />
                   <div className="text-[9px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest opacity-90">FLOW MOMENTUM</div>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums text-[var(--md-sys-color-on-surface)] mt-1">{`${zScoreValue > 0 ? '+' : ''}${zScoreValue.toFixed(2)}`}</div>
                <div className="text-[10px] sm:text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] mt-1.5 opacity-80">Z-Score (Std Deviasi)</div>
              </div>
            </div>

            {/* Concentration Card */}
            <div className="bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)] rounded-[24px] p-5 shadow-sm transition-all duration-300 relative overflow-hidden group hover:shadow-md">
              <div className="absolute top-0 left-0 w-1.5 h-full opacity-80 group-hover:opacity-100 transition-all duration-300" style={{ backgroundColor: hhiValue > 0.5 ? "#f59e0b" : "var(--md-sys-color-outline)" }}></div>
              <div className="pl-2">
                <div className="flex items-center gap-2 mb-2">
                   <Icon icon="ph:target-bold" style={{ color: hhiValue > 0.5 ? "#f59e0b" : "var(--md-sys-color-outline)" }} width="20" />
                   <div className="text-[9px] font-extrabold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-widest opacity-90">CONCENTRATION (HHI)</div>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums text-[var(--md-sys-color-on-surface)] mt-1">{hhiValue.toFixed(4)}</div>
                <div className="text-[10px] sm:text-xs font-bold text-[var(--md-sys-color-on-surface-variant)] mt-1.5 opacity-80">{hhiValue > 0.5 ? "Highly Concentrated" : "Distributed"}</div>
              </div>
            </div>
          </div>

          {/* Baris Charts 1: HMM & VAR */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            <div className="bg-[var(--md-sys-color-surface-container-low)] p-5 sm:p-6 rounded-[28px] border border-[var(--md-sys-color-outline-variant)] shadow-sm flex flex-col transition-colors">
              <div className="flex items-center gap-2.5 mb-5 border-b border-[var(--md-sys-color-outline-variant)] pb-3">
                <Icon icon="ph:chart-line-up-bold" className="text-[var(--md-sys-color-primary)]" width="22" />
                <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--md-sys-color-on-surface)] uppercase">HMM Market Regime</h3>
              </div>
              <div className="w-full h-[280px] relative z-0">
                <HMMChart timeSeries={data.timeseries} />
              </div>
              <div className="mt-5 pt-4 border-t border-[var(--md-sys-color-outline-variant)] flex-grow">
                <p className="text-[11px] sm:text-xs leading-relaxed text-[var(--md-sys-color-on-surface-variant)] text-justify font-medium">
                  <strong className="text-[var(--md-sys-color-on-surface)] font-extrabold">Cara Membaca:</strong> Latar area <span className="text-[var(--color-positive)] font-extrabold bg-[var(--color-positive)]/10 px-1.5 py-0.5 rounded">Hijau (Akumulasi)</span>, <span className="text-[var(--color-negative)] font-extrabold bg-[var(--color-negative)]/10 px-1.5 py-0.5 rounded">Merah (Distribusi)</span>, dan <span className="text-neutral-500 font-extrabold bg-neutral-500/10 px-1.5 py-0.5 rounded dark:bg-neutral-400/10 dark:text-neutral-400">Abu-Abu (Netral)</span> menunjukkan fase aliran dana asing. Jika harga saham turun namun latar berubah hijau, hal tersebut mengindikasikan sinyal <span className="font-extrabold italic border-b border-[var(--md-sys-color-on-surface-variant)]">hidden accumulation</span> (asing diam-diam akumulasi saat harga lemah), yang sering menjadi indikator <strong className="text-[var(--color-positive)] font-extrabold">early reversal</strong>.
                </p>
              </div>
            </div>
            
            <div className="bg-[var(--md-sys-color-surface-container-low)] p-5 sm:p-6 rounded-[28px] border border-[var(--md-sys-color-outline-variant)] shadow-sm flex flex-col transition-colors">
              <div className="flex items-center gap-2.5 mb-5 border-b border-[var(--md-sys-color-outline-variant)] pb-3">
                <Icon icon="ph:pulse-bold" className="text-[var(--md-sys-color-primary)]" width="22" />
                <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--md-sys-color-on-surface)] uppercase">Foreign Shock Causality (VAR)</h3>
              </div>
              <div className="w-full h-[280px] relative z-0">
                <VARChart irfData={data.models.impulse_response} />
              </div>
              <div className="mt-5 pt-4 border-t border-[var(--md-sys-color-outline-variant)] flex-grow">
                <p className="text-[11px] sm:text-xs leading-relaxed text-[var(--md-sys-color-on-surface-variant)] text-justify font-medium">
                  <strong className="text-[var(--md-sys-color-on-surface)] font-extrabold">Cara Membaca:</strong> Sumbu X (T+0 s/d T+10) adalah hari pasca shock dana asing. Garis biru jauh di atas 0 menandakan dampak positif kuat terhadap harga. Jika garis melengkung turun mendekati 0 di T+5, efeknya sangat <span className="text-[var(--color-negative)] font-extrabold">sementara</span>. Jika konsisten di atas 0 hingga T+10, pembelian asing tersebut memiliki efek <strong className="text-blue-500 font-extrabold">persisten</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Baris Charts 2: Broker Heatmap & Network Graph */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mt-2">
            
            <div className="bg-[var(--md-sys-color-surface-container-low)] p-5 sm:p-6 rounded-[28px] border border-[var(--md-sys-color-outline-variant)] shadow-sm flex flex-col transition-colors">
              <div className="flex items-center gap-2.5 mb-5 border-b border-[var(--md-sys-color-outline-variant)] pb-3">
                <Icon icon="ph:squares-four-bold" className="text-[var(--md-sys-color-primary)]" width="22" />
                <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--md-sys-color-on-surface)] uppercase">Top Broker Heatmap</h3>
              </div>
              <div className="w-full h-[320px] relative z-0">
                <BrokerHeatmap heatmapData={data.models.broker_heatmap} />
              </div>
              <div className="mt-5 pt-4 border-t border-[var(--md-sys-color-outline-variant)] flex-grow">
                <p className="text-[11px] sm:text-xs leading-relaxed text-[var(--md-sys-color-on-surface-variant)] text-justify font-medium">
                  <strong className="text-[var(--md-sys-color-on-surface)] font-extrabold">Cara Membaca:</strong> Matriks aktivitas broker harian yang telah di-normalisasi (Z-Score). Warna <span className="text-[var(--color-positive)] font-extrabold bg-[var(--color-positive)]/10 px-1.5 py-0.5 rounded">Hijau</span> menandakan akumulasi dominan, sedangkan <span className="text-[var(--color-negative)] font-extrabold bg-[var(--color-negative)]/10 px-1.5 py-0.5 rounded">Merah</span> menandakan distribusi kuat. Membantu melacak konsistensi akumulasi broker asing spesifik.
                </p>
              </div>
            </div>

            <div className="bg-[var(--md-sys-color-surface-container-low)] p-5 sm:p-6 rounded-[28px] border border-[var(--md-sys-color-outline-variant)] shadow-sm flex flex-col transition-colors">
              <div className="flex items-center gap-2.5 mb-5 border-b border-[var(--md-sys-color-outline-variant)] pb-3">
                <Icon icon="ph:share-network-bold" className="text-[var(--md-sys-color-primary)]" width="22" />
                <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--md-sys-color-on-surface)] uppercase">Syndicate Network Graph</h3>
              </div>
              <div className="w-full h-[320px] relative z-0">
                <BrokerNetworkGraph networkData={data.models.broker_network} />
              </div>
              <div className="mt-5 pt-4 border-t border-[var(--md-sys-color-outline-variant)] flex-grow">
                <p className="text-[11px] sm:text-xs leading-relaxed text-[var(--md-sys-color-on-surface-variant)] text-justify font-medium">
                  <strong className="text-[var(--md-sys-color-on-surface)] font-extrabold">Cara Membaca:</strong> Analisis hubungan antar broker. Ukuran lingkaran menunjukkan dominasi broker penggerak utama (<span className="italic font-bold">Anchor Broker</span>). Garis <span className="text-[var(--color-positive)] font-extrabold">Hijau</span> menandakan sinkronisasi akumulasi bersama, dan kluster warna yang sama menandakan satu sindikat aksi.
                </p>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
