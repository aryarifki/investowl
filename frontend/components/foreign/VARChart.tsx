"use client";
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '@/store/useAppStore';
import { Icon } from "@iconify/react";

export interface IRFData {
  foreign_shock_to_ret: number[];
  lower_bound: number[];
  upper_bound?: number[];
}

export default function VARChart({ irfData }: { irfData?: IRFData | null }) {
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === "dark";

  const styles = useMemo(() => ({
    surfaceHigh: isDark ? '#36343B' : '#FFFFFF',
    onSurface: isDark ? '#E6E0E9' : '#1D1B20',
    onSurfaceVariant: isDark ? '#CAC4D0' : '#49454F',
    outlineVariant: isDark ? '#49454F' : '#CAC4D0',
  }), [isDark]);

  const hasValidData = Boolean(
    irfData &&
    Array.isArray(irfData.foreign_shock_to_ret) &&
    irfData.foreign_shock_to_ret.length > 0 &&
    irfData.foreign_shock_to_ret.some((v) => Math.abs(v) > 0.000001)
  );

  if (!hasValidData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center rounded-xl bg-[var(--md-sys-color-surface-container-high)]/40 border border-dashed border-[var(--md-sys-color-outline-variant)]">
        <Icon icon="ph:chart-line-down-duotone" width="36" className="text-[var(--md-sys-color-on-surface-variant)] opacity-60 mb-2" />
        <span className="text-xs font-bold text-[var(--md-sys-color-on-surface)]">
          Data Impuls VAR Belum Tersedia
        </span>
        <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-1 max-w-xs leading-relaxed">
          Fluktuasi transaksi asing belum mencukupi batas varians statistik pada window ini.
        </span>
      </div>
    );
  }

  const horizon = irfData!.foreign_shock_to_ret.length;
  const xAxisData = Array.from({ length: horizon }, (_, i) => `T+${i}`);
  
  // Konversi desimal return ke format persentase (+0.79%)
  const responsePct = irfData!.foreign_shock_to_ret.map((v) => Number((v * 100).toFixed(4)));
  const lowerBoundPct = (irfData!.lower_bound || []).map((v) => Number((v * 100).toFixed(4)));
  const upperBoundPct = (
    irfData!.upper_bound || 
    irfData!.foreign_shock_to_ret.map((v, i) => v + (v - (irfData!.lower_bound?.[i] || 0)))
  ).map((v) => Number((v * 100).toFixed(4)));

  const option = {
    tooltip: { 
      trigger: 'axis',
      backgroundColor: styles.surfaceHigh,
      borderColor: styles.outlineVariant,
      textStyle: { color: styles.onSurface, fontSize: 11, fontFamily: 'Inter, sans-serif' },
      padding: [8, 12],
      borderRadius: 12,
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);',
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const day = params[0].axisValue;
        let html = `<div class="font-mono font-bold mb-1.5 text-[var(--md-sys-color-on-surface)]">${day} pasca shock foreign:</div>`;
        params.forEach((p: any) => {
          const val = typeof p.value === 'number' ? `${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}%` : '-';
          html += `<div class="flex items-center justify-between gap-4 text-[11px] py-0.5"><span style="color:${p.color}">● ${p.seriesName}</span><strong class="font-mono">${val}</strong></div>`;
        });
        return html;
      }
    },
    legend: {
      data: ['Impulse Response', 'Upper 95% CI', 'Lower 95% CI'],
      textStyle: { color: styles.onSurfaceVariant, fontSize: 10, fontFamily: 'Inter, sans-serif' },
      top: '0%',
      right: '2%'
    },
    grid: { left: '2%', right: '3%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: { 
      type: 'category', 
      boundaryGap: false, 
      data: xAxisData,
      axisLabel: { color: styles.onSurfaceVariant, fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700 }
    },
    yAxis: { 
      type: 'value',
      splitLine: { lineStyle: { color: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' } },
      axisLabel: { 
        color: styles.onSurfaceVariant, 
        fontSize: 10, 
        fontFamily: 'Inter, sans-serif', 
        fontWeight: 700,
        formatter: (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
      }
    },
    series: [
      {
        name: 'Upper 95% CI',
        type: 'line',
        data: upperBoundPct,
        smooth: true,
        lineStyle: { type: 'dashed', width: 1.5, color: isDark ? '#93c5fd' : '#60a5fa', opacity: 0.8 },
        symbol: 'none'
      },
      {
        name: 'Lower 95% CI',
        type: 'line',
        data: lowerBoundPct,
        smooth: true,
        lineStyle: { type: 'dashed', width: 1.5, color: isDark ? '#93c5fd' : '#60a5fa', opacity: 0.8 },
        symbol: 'none'
      },
      {
        name: 'Impulse Response',
        type: 'line',
        data: responsePct,
        smooth: true,
        itemStyle: { color: isDark ? '#60a5fa' : '#2563eb' },
        lineStyle: { width: 3 },
        symbol: 'circle',
        symbolSize: 5,
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)', type: 'solid', width: 1 },
          data: [{ yAxis: 0 }]
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%', zIndex: 0 }} />;
}
