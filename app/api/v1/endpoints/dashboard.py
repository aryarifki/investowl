from fastapi import APIRouter, HTTPException, Query
from datetime import date
from typing import Optional
import pandas as pd
import re

from app.services.analysis_service import (
    safe_val, df_to_records, return_to_date, conviction_score, 
    contradiction_alerts, sparkline_values, profile_flow_from_activity, 
    profile_broker_detail_table, smart_daily_from_activity, fmt_signal
)
from idx_bandarmology import analysis, storage

router = APIRouter()

@router.get("/{ticker}/dashboard")
async def get_dashboard_data(
    ticker: str,
    analysis_date: Optional[date] = Query(None),
    lookback_days: int = Query(60)
):
    ticker = ticker.upper()
    if not re.match(r"^[A-Z]{4}$", ticker):
        raise HTTPException(status_code=400, detail="Ticker tidak valid")

    try:
        all_broker = storage.read_broker_flow([ticker])
        all_activity = storage.read_broker_activity([ticker])
        all_prices = storage.read_prices([ticker])

        if all_broker.empty or all_activity.empty:
            raise HTTPException(status_code=404, detail="Data broker tidak ditemukan di DB")

        analysis_ts = pd.Timestamp(analysis_date) if analysis_date else all_broker["date"].max()
        window_start = analysis_ts - pd.Timedelta(days=lookback_days)

        broker_window = all_broker[(all_broker["date"] >= window_start) & (all_broker["date"] <= analysis_ts)].copy()
        activity_window = all_activity[(all_activity["date"] >= window_start) & (all_activity["date"] <= analysis_ts)].copy()
        price_window = all_prices[(all_prices["date"] >= window_start) & (all_prices["date"] <= analysis_ts)].copy()

        if broker_window.empty or activity_window.empty:
            raise HTTPException(status_code=404, detail="Data tidak tersedia di rentang waktu ini")

        signal_row = broker_window.sort_values("date").iloc[-1].to_dict()
        activity_date = analysis_ts
        
        ret_5d = return_to_date(all_prices, analysis_ts, 5)
        ret_10d = return_to_date(all_prices, analysis_ts, 10)
        foreign_5d = float(broker_window.sort_values("date").tail(5)["foreign_net_broker"].fillna(0).sum())
        
        daily_smart = smart_daily_from_activity(activity_window)
        smart_cum = float(daily_smart["cumulative_net"].iloc[-1]) if not daily_smart.empty and "cumulative_net" in daily_smart.columns else None
        
        top_buy, top_sell = analysis.top_net_broker_summary(ticker, trade_date=activity_date, top_n=6)
        
        # Error handling untuk Machine Learning yang berat (Granger & Alpha Scan)
        try:
            causality = analysis.causality_foreign_vs_price(ticker, max_lags=5)
        except Exception:
            causality = None
            
        try:
            scan_10d = analysis.broker_alpha_scan([ticker], horizon=10, min_events=5, min_net_value=0.0)
        except Exception:
            scan_10d = pd.DataFrame()
        
        # Perbaikan argumen di sini (causality dihapus karena sudah dihitung di dalam service)
        conviction = conviction_score(signal_row.get("bandar_signal"), foreign_5d, scan_10d, ticker)
        alerts = contradiction_alerts(signal_row.get("bandar_signal"), ret_5d, ret_10d, foreign_5d, smart_cum)
        
        sig_10d = scan_10d[scan_10d["significant"].eq(True)].copy() if not scan_10d.empty else pd.DataFrame()
        if sig_10d.empty:
            verdict = f"{ticker} shows {fmt_signal(signal_row.get('bandar_signal'))}. The current read is directional, but broker-specific 10D validation is not yet statistically strong."
        else:
            best = sig_10d.sort_values(["p_value_one_sided", "mean_fwd_return"], ascending=[True, False]).iloc[0]
            verdict = f"{ticker} shows {fmt_signal(signal_row.get('bandar_signal'))}. Broker {best['broker_code']} is the strongest 10D validation: {int(best['n_events'])} events, win rate {best['win_rate']:.0%}, p-value {best['p_value_one_sided']:.4f}."

        top_brokers_compact = []
        for side, df in (("Buy", top_buy.head(3)), ("Sell", top_sell.head(3))):
            for _, row in df.iterrows():
                top_brokers_compact.append({
                    "side": side,
                    "broker_code": row.get("broker_code", "-"),
                    "participant_type": row.get("participant_type", "-"),
                    "net_value": safe_val(row.get("net_value")),
                    "sparkline": sparkline_values(activity_window, row.get("broker_code"), analysis_ts)
                })

        perf_df = analysis.price_performance_table(ticker)
        price_performance = []
        if not perf_df.empty:
            perf_df = perf_df[perf_df["timeframe"].isin(["1D", "1W", "1M", "3M", "6M", "YTD"])]
            price_performance = [{"timeframe": r["timeframe"], "return": safe_val(r["return"])} for _, r in perf_df.iterrows()]

        profile_df = profile_flow_from_activity(activity_window)
        profile_flow = df_to_records(profile_df)
        profile_broker_detail = df_to_records(profile_broker_detail_table(activity_window))
        
        px_context = price_window[["date", "close", "volume"]].copy()
        if not broker_window.empty:
            px_context = px_context.merge(broker_window[["date", "bandar_signal", "bandar_signal_score"]], on="date", how="left")
        px_context["date"] = px_context["date"].astype(str)
        px_context["bandar_signal"] = px_context["bandar_signal"].apply(fmt_signal)

        return {
            "ticker": ticker,
            "analysis_date": str(analysis_ts.date()),
            "window_start": str(window_start.date()),
            "signal_row": {k: safe_val(v) for k, v in signal_row.items()},
            "top_buyers": df_to_records(top_buy),
            "top_sellers": df_to_records(top_sell),
            "top_brokers_compact": top_brokers_compact,
            "daily_smart": df_to_records(daily_smart),
            "profile_flow": profile_flow,
            "profile_broker_detail": profile_broker_detail,
            "price_context": df_to_records(px_context),
            "foreign_5d": foreign_5d,
            "ret_5d": ret_5d,
            "ret_10d": ret_10d,
            "smart_cumulative": smart_cum,
            "price_performance": price_performance,
            "conviction_score": conviction["score"],
            "alerts": alerts,
            "verdict": verdict
        }

    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}\n{traceback.format_exc()}")
