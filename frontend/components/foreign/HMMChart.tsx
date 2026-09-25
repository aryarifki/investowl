"use client";
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '@/store/useAppStore';

export interface HMMTimeSeries {
  dates: string[];
  close_prices: number[];
  hmm_states: number[];
}

export default function HMMChart({ timeSeries }: { timeSeries?: HMMTimeSeries | null }) {
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === "dark";

  const styles = useMemo(() => ({
    surfaceHigh: isDark ? '#36343B' : '#E6E0E9',
    onSurface: isDark ? '#E6E0E9' : '#1D1B20',
    onSurfaceVariant: isDark ? '#CAC4D0' : '#49454F',
    outlineVariant: isDark ? '#49454F' : '#CAC4D0',
  }), [isDark]);

  const { dates, close_prices, hmm_states } = timeSeries || {};

  const markAreaData = useMemo(() => {
    if (!hmm_states || !dates) return [];
    const areas = [];
    let startIdx = 0;
    
    for (let i = 1; i <= hmm_states.length; i++) {
      if (i === hmm_states.length || hmm_states[i] !== hmm_states[i - 1]) {
        const state = hmm_states[i - 1];
        let color = theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'; 
        if (state === 2) color = theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.12)'; 
        if (state === 0) color = theme === 'dark' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(244, 63, 94, 0.12)';  

        areas.push([
          { xAxis: dates[startIdx], itemStyle: { color } },
          { xAxis: dates[i === hmm_states.length ? i - 1 : i] }
        ]);
        startIdx = i;
      }
    }
    return areas;
  }, [dates, hmm_states, theme]);

  if (!timeSeries || !timeSeries.dates || !styles.surfaceHigh) return <div className="h-full w-full bg-transparent"></div>;

  const option = {
    tooltip: { 
      trigger: 'axis',
      backgroundColor: styles.surfaceHigh,
      borderColor: styles.outlineVariant,
      textStyle: { color: styles.onSurface, fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 600 },
      padding: [8, 12],
      borderRadius: 12,
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'
    },
    grid: { left: '2%', right: '2%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: { 
      type: 'category', 
      boundaryGap: false, 
      data: dates,
      axisLabel: { color: styles.onSurfaceVariant, fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700 }
    },
    yAxis: { 
      type: 'value', 
      scale: true,
      splitLine: { lineStyle: { color: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' } },
      axisLabel: { color: styles.onSurfaceVariant, fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700 }
    },
    series: [
      {
        name: 'Close Price',
        type: 'line',
        data: close_prices,
        smooth: true,
        itemStyle: { color: '#f59e0b' },
        lineStyle: { width: 3 },
        symbol: 'none',
        markArea: {
          silent: true,
          data: markAreaData
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%', zIndex: 0 }} />;
}
