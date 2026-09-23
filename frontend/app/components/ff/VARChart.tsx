"use client";
import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '@/store/useAppStore';

export default function VARChart({ irfData }: { irfData: any }) {
  const theme = useAppStore((state) => state.theme);
  const [styles, setStyles] = useState<any>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rootStyle = getComputedStyle(document.documentElement);
    setStyles({
      surfaceHigh: rootStyle.getPropertyValue('--md-sys-color-surface-container-highest').trim() || (theme === 'dark' ? '#36343B' : '#E6E0E9'),
      onSurface: rootStyle.getPropertyValue('--md-sys-color-on-surface').trim() || (theme === 'dark' ? '#E6E0E9' : '#1D1B20'),
      onSurfaceVariant: rootStyle.getPropertyValue('--md-sys-color-on-surface-variant').trim() || (theme === 'dark' ? '#CAC4D0' : '#49454F'),
      outlineVariant: rootStyle.getPropertyValue('--md-sys-color-outline-variant').trim() || (theme === 'dark' ? '#49454F' : '#CAC4D0'),
    });
  }, [theme]);

  if (!irfData || !irfData.foreign_shock_to_ret) return null;

  const horizon = irfData.foreign_shock_to_ret.length;
  const xAxisData = Array.from({ length: horizon }, (_, i) => `T+${i}`);
  
  const lowerBound = irfData.lower_bound;
  const upperBound = irfData.foreign_shock_to_ret.map((val: number, i: number) => 
    val + (val - lowerBound[i])
  );
  const bandDifference = upperBound.map((up: number, i: number) => up - lowerBound[i]);

  if (!styles.surfaceHigh) return <div className="h-full w-full bg-transparent"></div>;

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
      data: xAxisData,
      axisLabel: { color: styles.onSurfaceVariant, fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700 }
    },
    yAxis: { 
      type: 'value',
      splitLine: { lineStyle: { color: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' } },
      axisLabel: { color: styles.onSurfaceVariant, fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700 }
    },
    series: [
      {
        name: 'Lower Bound',
        type: 'line',
        data: lowerBound,
        lineStyle: { opacity: 0 },
        stack: 'confidence',
        symbol: 'none'
      },
      {
        name: 'Upper Bound',
        type: 'line',
        data: bandDifference,
        lineStyle: { opacity: 0 },
        areaStyle: { color: '#3b82f6', opacity: theme === 'dark' ? 0.15 : 0.1 }, 
        stack: 'confidence',
        symbol: 'none'
      },
      {
        name: 'Impulse Response',
        type: 'line',
        data: irfData.foreign_shock_to_ret,
        smooth: true,
        itemStyle: { color: '#3b82f6' },
        lineStyle: { width: 3.5 },
        symbol: 'none'
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%', zIndex: 0 }} />;
}
