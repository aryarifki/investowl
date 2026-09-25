"use client";
import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '@/store/useAppStore';

export interface HeatmapData {
  x_dates: string[];
  y_brokers: string[];
  matrix_data: [number, number, number][];
}

export default function BrokerHeatmap({ heatmapData }: { heatmapData?: HeatmapData | null }) {
  // Mendengarkan perubahan tema dari Zustand agar chart auto-re-render
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === "dark";

  const styles = React.useMemo(() => ({
    surfaceHigh: isDark ? '#2B2930' : '#ECE6F0',
    onSurface: isDark ? '#E6E0E9' : '#1D1B20',
    onSurfaceVariant: isDark ? '#CAC4D0' : '#49454F',
    outlineVariant: isDark ? '#49454F' : '#CAC4D0',
    positive: '#10b981',
    negative: '#f43f5e',
  }), [isDark]);

  if (!heatmapData || !heatmapData.matrix_data || heatmapData.matrix_data.length === 0) {
    return <div className="flex h-full items-center justify-center text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold">Data transaksi broker tidak memadai</div>;
  }

  const { x_dates, y_brokers, matrix_data } = heatmapData;

  const option = {
    tooltip: {
      position: 'top',
      backgroundColor: styles.surfaceHigh,
      borderColor: styles.outlineVariant,
      textStyle: { color: styles.onSurface, fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600 },
      padding: [8, 12],
      borderRadius: 12,
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);',
      formatter: function (params: { value: [number, number, number] }) {
        const date = x_dates[params.value[0]];
        const broker = y_brokers[params.value[1]];
        const zScore = params.value[2].toFixed(2);
        const action = Number(zScore) > 0 ? 'Accumulation' : Number(zScore) < 0 ? 'Distribution' : 'Neutral';
        const color = Number(zScore) > 0 ? styles.positive : Number(zScore) < 0 ? styles.negative : styles.onSurfaceVariant;
        return `<div style="font-weight: 800; margin-bottom: 2px;">${broker} <span style="font-weight: 500; opacity: 0.7;">on ${date}</span></div>Z-Score: <span style="color:${color}; font-weight:800;">${zScore}</span> <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 1px;">(${action})</span>`;
      }
    },
    animation: false,
    grid: { left: '3%', right: '4%', bottom: '15%', top: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: x_dates,
      axisLabel: { color: styles.onSurfaceVariant, fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 600 },
      splitArea: { show: true, areaStyle: { color: ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.05)'] } }
    },
    yAxis: {
      type: 'category',
      data: y_brokers,
      axisLabel: { color: styles.onSurface, fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 800 },
      splitArea: { show: true }
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      itemWidth: 12,
      itemHeight: 160,
      textStyle: { color: styles.onSurfaceVariant, fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700 },
      inRange: {
        // MD3 Gradient Transition
        color: [
          theme === 'dark' ? 'rgba(244, 63, 94, 0.9)' : 'rgba(225, 29, 72, 0.9)', 
          styles.surfaceHigh, 
          theme === 'dark' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(5, 150, 105, 0.9)'
        ]
      }
    },
    series: [
      {
        name: 'Broker Flow Intensity',
        type: 'heatmap',
        data: matrix_data,
        label: { show: false },
        itemStyle: {
          borderColor: styles.outlineVariant,
          borderWidth: 0.5
        }
      }
    ]
  };

  if (!styles.surfaceHigh) return <div className="h-full w-full bg-transparent"></div>;

  return <ReactECharts option={option} style={{ height: '100%', width: '100%', zIndex: 0 }} />;
}
