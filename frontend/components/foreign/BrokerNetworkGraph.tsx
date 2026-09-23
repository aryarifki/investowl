"use client";
import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '@/store/useAppStore';

export default function BrokerNetworkGraph({ networkData }: { networkData: any }) {
  const theme = useAppStore((state) => state.theme);
  const [styles, setStyles] = useState<any>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rootStyle = getComputedStyle(document.documentElement);
    setStyles({
      surfaceHigh: rootStyle.getPropertyValue('--md-sys-color-surface-container-high').trim() || (theme === 'dark' ? '#2B2930' : '#ECE6F0'),
      surface: rootStyle.getPropertyValue('--md-sys-color-surface').trim() || (theme === 'dark' ? '#141218' : '#FEF7FF'),
      onSurface: rootStyle.getPropertyValue('--md-sys-color-on-surface').trim() || (theme === 'dark' ? '#E6E0E9' : '#1D1B20'),
      onSurfaceVariant: rootStyle.getPropertyValue('--md-sys-color-on-surface-variant').trim() || (theme === 'dark' ? '#CAC4D0' : '#49454F'),
      outlineVariant: rootStyle.getPropertyValue('--md-sys-color-outline-variant').trim() || (theme === 'dark' ? '#49454F' : '#CAC4D0'),
      positive: rootStyle.getPropertyValue('--color-positive').trim() || '#10b981',
      negative: rootStyle.getPropertyValue('--color-negative').trim() || '#f43f5e',
      primary: rootStyle.getPropertyValue('--md-sys-color-primary').trim() || '#D0BCFF',
    });
  }, [theme]);

  if (!networkData || !networkData.nodes || networkData.nodes.length === 0) {
    return <div className="flex h-full items-center justify-center text-[var(--md-sys-color-on-surface-variant)] text-xs font-bold">Jaringan broker terlalu sepi/terpecah</div>;
  }

  // Pre-process links menggunakan variabel warna absolut untuk hijau/merah
  const styledLinks = networkData.links.map((link: any) => ({
    ...link,
    lineStyle: {
      color: link.value > 0 ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(5, 150, 105, 0.5)') : (theme === 'dark' ? 'rgba(244, 63, 94, 0.6)' : 'rgba(225, 29, 72, 0.5)'),
      width: Math.max(1, Math.abs(link.value) * 6), 
      curveness: 0.2
    }
  }));

  const option = {
    tooltip: {
      backgroundColor: styles.surfaceHigh,
      borderColor: styles.outlineVariant,
      textStyle: { color: styles.onSurface, fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600 },
      padding: [8, 12],
      borderRadius: 12,
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);',
      formatter: function (params: any) {
        if (params.dataType === 'edge') {
          const type = params.data.value > 0 ? 'Sync Action' : 'Opposite Action';
          const color = params.data.value > 0 ? styles.positive : styles.negative;
          return `<div style="font-weight: 800; margin-bottom: 2px;">${params.data.source} <span style="font-weight: 500; opacity: 0.5;">&</span> ${params.data.target}</div>Correlation: <span style="color:${color}; font-weight:800;">${params.data.value}</span> <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 1px;">(${type})</span>`;
        }
        return `<div style="font-weight: 800; font-size: 14px; margin-bottom: 2px;">${params.data.name}</div>Syndicate Cluster: <span style="font-weight: 800;">${params.data.category + 1}</span>`;
      }
    },
    // Palet warna cerah/bold (Tailwind base) untuk kluster
    color: ['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981'],
    legend: {
      show: true,
      bottom: '0%',
      textStyle: { color: styles.onSurfaceVariant, fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 700 },
      icon: 'circle'
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        nodes: networkData.nodes,
        links: styledLinks,
        categories: networkData.categories,
        roam: true,
        label: {
          show: true,
          position: 'right',
          color: styles.onSurface,
          fontSize: 10,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 800
        },
        force: {
          repulsion: 300, // Membuat node tidak terlalu menumpuk
          edgeLength: 70,
          gravity: 0.1
        },
        itemStyle: {
          borderColor: styles.surface, // Outline menyesuaikan background
          borderWidth: 2,
          shadowBlur: 15,
          shadowColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)'
        }
      }
    ]
  };

  if (!styles.surfaceHigh) return <div className="h-full w-full bg-transparent"></div>;

  return <ReactECharts option={option} style={{ height: '100%', width: '100%', zIndex: 0 }} />;
}
