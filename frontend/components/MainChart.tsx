"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
} from "lightweight-charts";
import { fetchStockHistory, fetchBrokerHistory } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export default function MainChart() {
  const activeTicker = useAppStore((s) => s.activeTicker);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: priceData, error: priceError } = useSWR(
    ["stock-history", activeTicker],
    function ([, t]: [string, string]) {
      return fetchStockHistory(t, 250);
    }
  );
  const { data: flowData } = useSWR(
    ["broker-history", activeTicker],
    function ([, t]: [string, string]) {
      return fetchBrokerHistory(t, 60);
    }
  );

  useEffect(() => {
    if (!containerRef.current || !priceData) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#171717" },
        textColor: "#a3a3a3",
      },
      grid: {
        vertLines: { color: "#262626" },
        horzLines: { color: "#262626" },
      },
      autoSize: true,
      timeScale: { timeVisible: false },
    });

    // ── Candlestick (API v5: addSeries + definisi series) ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeries.setData(
      priceData.data.map(function (b: any) {
        return {
          time: b.date,
          open: b.open ?? 0,
          high: b.high ?? 0,
          low: b.low ?? 0,
          close: b.close ?? 0,
        };
      })
    );

    // ── Volume histogram ──
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(
      priceData.data.map(function (b: any) {
        return {
          time: b.date,
          value: b.volume ?? 0,
          color: (b.close ?? 0) >= (b.open ?? 0) ? "#22c55e55" : "#ef444455",
        };
      })
    );

    // ── Overlay: Foreign Net Broker (juta Rupiah) ──
    if (flowData && flowData.data.length > 0) {
      const flowSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "vol",
        priceFormat: { type: "volume" },
      });
      flowSeries.setData(
        flowData.data.map(function (r: any) {
          const v = r.foreign_net_broker ?? 0;
          return {
            time: r.date,
            value: v / 1000000,
            color: v >= 0 ? "#38bdf8aa" : "#f97316aa",
          };
        })
      );
    }

    chart.timeScale().fitContent();

    return function cleanup() {
      chart.remove();
    };
  }, [priceData, flowData]);

  const lastBar = priceData?.data[priceData.data.length - 1];
  const prevBar = priceData?.data[priceData.data.length - 2];
  const change =
    lastBar && prevBar && lastBar.close != null && prevBar.close != null
      ? lastBar.close - prevBar.close
      : null;
  const changePct =
    change !== null && prevBar?.close ? (change / prevBar.close) * 100 : null;

  return (
    <div className="h-full flex flex-col border border-neutral-800 rounded-lg bg-neutral-900">
      <div className="px-4 py-2 border-b border-neutral-800 flex items-baseline gap-3">
        <h2 className="text-lg font-bold">{activeTicker}</h2>
        {lastBar?.close != null && (
          <>
            <span className="text-xl font-semibold">{lastBar.close}</span>
            {change !== null && (
              <span
                className={
                  "text-sm font-medium " +
                  (change >= 0 ? "text-emerald-500" : "text-red-500")
                }
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(0)} ({changePct?.toFixed(2)}%)
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex-1 relative">
        {priceError && (
          <div className="absolute inset-0 flex items-center justify-center text-red-500 text-sm">
            Gagal memuat data: {priceError.message}
          </div>
        )}
        {!priceData && !priceError && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-sm">
            Memuat grafik…
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
