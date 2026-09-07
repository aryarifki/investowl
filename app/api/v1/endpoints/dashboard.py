import numpy as np
from datetime import date
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import math
import time

from idx_bandarmology import analysis, storage

router = APIRouter(tags=["Dashboard"])

def _clean(obj):
    if isinstance(obj, dict): return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list): return [_clean(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)): return None
    if hasattr(obj, 'item'): return obj.item()
    return obj

def _fmt_signal(value):
    if value is None or pd.isna(value): return "-"
    mapping = {"AKUMULASI_KUAT": "Strong Accumulation", "AKUMULASI": "Accumulation", "DISTRIBUSI_KUAT": "Strong Distribution", "DISTRIBUSI": "Distribution", "NETRAL": "Neutral", "STRONG_ACCUMULATION": "Strong Accumulation", "ACCUMULATION": "Accumulation", "NET_BUY": "Net Buy", "STRONG_DISTRIBUTION": "Strong Distribution", "DISTRIBUTION": "Distribution", "NET_SELL": "Net Sell", "NEUTRAL": "Neutral"}
    return mapping.get(str(value), str(value).replace("_", " ").title())

def _participant_label(value):
    return {"Asing": "FOREIGN", "Lokal": "LOCAL", "Pemerintah": "GOV"}.get(str(value), str(value or "-"))

ACC_SIGNALS = {"STRONG_ACCUMULATION", "ACCUMULATION", "NET_BUY", "AKUMULASI_KUAT", "AKUMULASI"}
DIST_SIGNALS = {"STRONG_DISTRIBUTION", "DISTRIBUTION", "NET_SELL", "DISTRIBUSI_KUAT", "DISTRIBUSI"}
SMART_PROFILES = {"smart_foreign", "local_institutional"}
PROFILE_META = {"smart_foreign": ("Foreign Smart Money", "Directional foreign institutions"), "local_institutional": ("Local Institutions", "Local institution-like accounts"), "market_maker": ("Market Makers", "Active on both sides; net position matters"), "bandar_gorengan": ("Speculative Operators", "Speculative operator profile"), "retail": ("Retail-Dominant", "Retail-heavy platforms"), "lainnya": ("Other Brokers", "Outside defined behavioral profiles")}

def _label_component(signal):
    raw = str(signal or "").upper()
    if raw in {"AKUMULASI_KUAT", "STRONG_ACCUMULATION"}: return 100
    if raw in {"AKUMULASI", "ACCUMULATION", "NET_BUY"}: return 80
    if raw in {"NETRAL", "NEUTRAL"}: return 50
    if raw in {"DISTRIBUSI", "DISTRIBUTION", "NET_SELL"}: return 25
    if raw in {"DISTRIBUSI_KUAT", "STRONG_DISTRIBUTION"}: return 0
    return 40

def _p_value_component(p_value):
    if p_value is None or pd.isna(p_value): return 50
    if p_value <= 0.01: return 100
    if p_value <= 0.05: return 80
    if p_value <= 0.10: return 55
    return 20

def _foreign_component(value):
    if value is None or pd.isna(value): return 50
    if value > 0: return 100
    if value < 0: return 0
    return 50

def _broker_win_component(scan_df, ticker):
    if scan_df is None or scan_df.empty: return 50, "No broker validation sample"
    sub = scan_df[scan_df["ticker"] == ticker].copy() if "ticker" in scan_df.columns else scan_df.copy()
    if sub.empty: return 50, "No broker validation sample"
    sub = sub.sort_values(["significant", "p_value_one_sided", "mean_fwd_return"], ascending=[False, True, False])
    row = sub.iloc[0]
    win_rate = float(row.get("win_rate", 0.5))
    return max(0, min(100, win_rate * 100)), str(row.get("broker_code", "-")) + " win rate " + "{:.0%}".format(win_rate)

def _conviction_score(signal, foreign_5d, scan_df, ticker):
    # Kembalikan try-catch agar jika Granger error, p_value dianggap None (50)
    try:
        causality = analysis.causality_foreign_vs_price(ticker, max_lags=5)
    except Exception:
        causality = None
        
    p_value = None if not causality else float(causality.get("min_p_value", np.nan))
    p_score = _p_value_component(p_value)
    s_score = _label_component(signal)
    f_score = _foreign_component(foreign_5d)
    w_score, w_note = _broker_win_component(scan_df, ticker)
    score = (p_score * 0.30) + (s_score * 0.30) + (f_score * 0.20) + (w_score * 0.20)
    return {"score": round(float(score), 1), "p_value": None if p_value is None or pd.isna(p_value) else float(p_value), "causality_component": float(p_score), "signal_component": float(s_score), "foreign_component": float(f_score), "broker_component": float(w_score), "broker_note": w_note}

def _contradiction_alerts(signal, ret_5d, ret_10d, foreign_5d, smart_cum):
    raw = str(signal or "").upper()
    alerts = []
    if raw in DIST_SIGNALS and ((ret_5d is not None and ret_5d > 0) or (ret_10d is not None and ret_10d > 0)):
        alerts.append("Distribution while price is still rising — potential unfinished distribution or new buyer absorption. Monitor volume.")
    if raw in ACC_SIGNALS and ret_5d is not None and ret_5d < 0:
        alerts.append("Accumulation signal with negative 5D return — accumulation may be early, failed, or absorbed by larger supply.")
    if foreign_5d is not None and foreign_5d < 0 and raw in ACC_SIGNALS:
        alerts.append("Aggregate accumulation conflicts with foreign net selling — check whether the move is driven by local brokers.")
    if smart_cum is not None and smart_cum < 0 and raw in ACC_SIGNALS:
        alerts.append("Signal is accumulation but smart-money cumulative flow is negative in the selected window.")
    return alerts

def _smart_daily_from_activity(activity):
    if activity.empty: return pd.DataFrame()
    df = activity.copy()
    df["profile"] = df["broker_code"].map(analysis.broker_profile_of)
    df = df[df["profile"].isin(SMART_PROFILES)]
    if df.empty: return pd.DataFrame()
    daily = df.groupby("date")["net_value"].sum().reset_index(name="smart_net").sort_values("date")
    daily["cumulative_net"] = daily["smart_net"].cumsum()
    return daily

def _profile_flow_from_activity(activity):
    if activity.empty: return pd.DataFrame()
    df = activity.copy()
    df["profile"] = df["broker_code"].map(analysis.broker_profile_of)
    broker_rows = df.groupby(["profile", "broker_code", "participant_type"], dropna=False).agg(net=("net_value", "sum"), buy=("buy_value", "sum"), sell=("sell_value", "sum")).reset_index()
    rows = []
    for profile, (label, desc) in PROFILE_META.items():
        members = broker_rows[broker_rows["profile"] == profile].copy()
        if members.empty: continue
        members["abs_net"] = members["net"].abs()
        rows.append({"profile": profile, "label": label, "description": desc, "net": float(members["net"].sum()), "top_brokers": members.sort_values("abs_net", ascending=False).head(6)[["broker_code", "participant_type", "net"]].to_dict("records")})
    return pd.DataFrame(rows)

def _profile_broker_detail_table(activity, profile_key=None):
    if activity.empty: return []
    df = activity.copy()
    df["profile"] = df["broker_code"].map(analysis.broker_profile_of)
    if profile_key: df = df[df["profile"] == profile_key]
    if df.empty: return []
    grouped = df.groupby(["profile", "broker_code", "participant_type"], dropna=False).agg(buy=("buy_value", "sum"), sell=("sell_value", "sum"), net=("net_value", "sum"), freq=("frequency", "sum"), days=("date", "nunique")).reset_index()
    grouped["profile_label"] = grouped["profile"].map(lambda key: PROFILE_META.get(key, (key, ""))[0])
    grouped["type_label"] = grouped["participant_type"].map(lambda v: _participant_label(v))
    grouped["avg_value_tx"] = grouped.apply(lambda r: abs(float(r["net"] or 0)) / max(float(r["freq"] or 0), 1), axis=1)
    grouped = grouped.sort_values(["profile", "net"], ascending=[True, False])
    rows = []
    for _, row in grouped.iterrows():
        rows.append({"profile": str(row["profile_label"]), "profile_key": str(row["profile"]), "broker": str(row["broker_code"]), "type": str(row["type_label"]), "buy": float(row["buy"]), "sell": float(row["sell"]), "net": float(row["net"]), "freq": float(row["freq"]), "days": int(row["days"]), "avg_value_tx": float(row["avg_value_tx"])})
    return rows

def _sparkline_values(activity, broker_code, end_ts, days=5):
    sub = activity[(activity["broker_code"] == broker_code) & (activity["date"] <= end_ts)].sort_values("date").tail(days)
    if sub.empty: return "-----"
    chars = []
    for value in sub["net_value"].fillna(0):
        chars.append("+" if value > 0 else "-" if value < 0 else "0")
    return "".join(chars)

_DETAIL_CACHE = {}

@router.get("/{ticker}/dashboard")
def ticker_detail(ticker: str, analysis_date: str = None, lookback_days: int = 60):
    ticker = ticker.upper().strip()
    activity_df = storage.read_broker_activity([ticker]).copy()
    if activity_df.empty:
        raise HTTPException(404, "No broker history for " + ticker)

    if analysis_date:
        analysis_ts = pd.Timestamp(analysis_date)
    else:
        dates = sorted(activity_df[activity_df["ticker"] == ticker]["date"].dt.date.unique().tolist())
        analysis_ts = pd.Timestamp(max(dates)) if dates else pd.Timestamp.now()

    cache_key = f"{ticker}|{analysis_ts.date()}|{lookback_days}"
    now = time.time()
    cached = _DETAIL_CACHE.get(cache_key)
    if cached is not None and (now - cached["ts"]) < 300:
        return cached["data"]

    price_df = storage.read_prices([ticker]).copy()
    broker_df = storage.read_broker_flow([ticker]).copy()
    if broker_df.empty:
        raise HTTPException(404, "No broker history for " + ticker)

    window_start = analysis_ts - pd.Timedelta(days=lookback_days)
    price_window = price_df[(price_df["date"] >= window_start) & (price_df["date"] <= analysis_ts)].copy()
    broker_window = broker_df[(broker_df["date"] >= window_start) & (broker_df["date"] <= analysis_ts)].copy()
    activity_window = activity_df[(activity_df["date"] >= window_start) & (activity_df["date"] <= analysis_ts)].copy()

    px_row = price_df[price_df["date"] <= analysis_ts].sort_values("date").iloc[-1] if not price_df.empty else None
    signal_row = broker_df[broker_df["date"] <= analysis_ts].sort_values("date").iloc[-1].to_dict() if not broker_df.empty else {}
    activity_date = analysis_ts

    try:
        top_buy, top_sell = analysis.top_net_broker_summary(ticker, trade_date=activity_date, top_n=6)
    except Exception:
        top_buy, top_sell = pd.DataFrame(), pd.DataFrame()

    daily_smart = _smart_daily_from_activity(activity_window)
    profile_df = _profile_flow_from_activity(activity_window)

    try:
        scan_10d = analysis.broker_alpha_scan([ticker], horizon=10, min_events=5, min_net_value=0.0, group_by=("ticker", "broker_code"))
    except Exception:
        scan_10d = pd.DataFrame()

    close_value = float(px_row["close"]) if px_row is not None and pd.notna(px_row["close"]) else None
    
    def ret(periods):
        sub = price_df[price_df["date"] <= analysis_ts].sort_values("date")
        if len(sub) <= periods: return None
        base = float(sub.iloc[-periods - 1]["close"])
        return float(sub.iloc[-1]["close"]) / base - 1 if base else None

    ret_5d = ret(5)
    ret_10d = ret(10)
    foreign_5d = float(broker_window.sort_values("date").tail(5)["foreign_net_broker"].fillna(0).sum()) if not broker_window.empty else 0.0
    smart_cum = float(daily_smart["cumulative_net"].iloc[-1]) if not daily_smart.empty else None

    top_buyer = top_buy.iloc[0] if not top_buy.empty else None
    top_seller = top_sell.iloc[0] if not top_sell.empty else None

    conviction = _conviction_score(signal_row.get("bandar_signal"), foreign_5d, scan_10d, ticker)
    score_value = float(conviction["score"])
    alerts = _contradiction_alerts(signal_row.get("bandar_signal"), ret_5d, ret_10d, foreign_5d, smart_cum)

    sig_10d = scan_10d[scan_10d["significant"].eq(True)].copy() if not scan_10d.empty else pd.DataFrame()
    if sig_10d.empty:
        verdict = f"{ticker} shows {_fmt_signal(signal_row.get('bandar_signal'))} with {ret_5d or 0:+.2%} over 5D and {ret_10d or 0:+.2%} over 10D. The current read is directional, but broker-specific 10D validation is not yet statistically strong."
    else:
        best = sig_10d.sort_values(["p_value_one_sided", "mean_fwd_return"], ascending=[True, False]).iloc[0]
        verdict = f"{ticker} shows {_fmt_signal(signal_row.get('bandar_signal'))}. Broker {best['broker_code']} is the strongest 10D validation: {int(best['n_events'])} events, mean return {best['mean_fwd_return']:+.2%}, win rate {best['win_rate']:.0%}, p-value {best['p_value_one_sided']:.4f}."

    broker_summary_rows = []
    for side, df in (("Buy", top_buy.head(3)), ("Sell", top_sell.head(3))):
        for _, row in df.iterrows():
            broker_summary_rows.append({"side": side, "broker": str(row["broker_code"]), "type": _participant_label(row["participant_type"]), "net": float(row["net_value"]), "spark": _sparkline_values(activity_df, row["broker_code"], analysis_ts)})

    try:
        perf = analysis.price_performance_table(ticker)
        perf = perf[perf["timeframe"].isin(["1D", "1W", "1M", "3M", "6M", "YTD"])]
        perf_rows = perf[["timeframe", "return"]].rename(columns={"timeframe": "period", "return": "value"}).to_dict("records")
    except Exception:
        perf_rows = []

    profile_rows = []
    if not profile_df.empty:
        for _, row in profile_df.sort_values("net", ascending=False).head(6).iterrows():
            profile_rows.append({"label": row["label"], "net": float(row["net"])})

    smart_daily_rows = []
    if not daily_smart.empty:
        for _, row in daily_smart.iterrows():
            smart_daily_rows.append({"date": str(row["date"]), "smart_net": float(row["smart_net"]), "cumulative_net": float(row["cumulative_net"])})

    price_chart_rows = []
    if not price_window.empty:
        for _, row in price_window.iterrows():
            price_chart_rows.append({"date": str(row["date"]), "close": float(row["close"]) if pd.notna(row["close"]) else None, "volume": float(row["volume"]) if "volume" in row and pd.notna(row["volume"]) else None})

    signal_overlay = []
    if not broker_window.empty:
        for _, row in broker_window[["date", "bandar_signal", "bandar_signal_score"]].copy().iterrows():
            signal_overlay.append({"date": str(row["date"]), "signal": _fmt_signal(row["bandar_signal"]), "score": float(row["bandar_signal_score"]) if pd.notna(row["bandar_signal_score"]) else None})

    # Causality Data dengan try-catch agar tidak 500
    try:
        foreign_causality = analysis.causality_foreign_vs_price(ticker, max_lags=5)
    except Exception:
        foreign_causality = None
        
    try:
        part_causality = analysis.causality_by_participant(ticker, max_lags=5)
    except Exception:
        part_causality = pd.DataFrame()
        
    try:
        broker_causality = analysis.causality_by_broker(ticker, top_n=15, max_lags=5)
    except Exception:
        broker_causality = pd.DataFrame()

    def get_english_text(val):
        return {"Asing": "Foreign", "Lokal": "Local", "Pemerintah": "Government"}.get(str(val), val)

    part_list = []
    if not part_causality.empty:
        for _, row in part_causality.iterrows():
            part_list.append({"participant": get_english_text(row.get("participant_type", "")), "lag": int(row.get("best_lag", 1)), "p_value": float(row.get("p_value", 1.0)), "is_significant": bool(row.get("significant", False))})

    broker_list = []
    if not broker_causality.empty:
        for _, row in broker_causality.iterrows():
            broker_list.append({"code": str(row.get("broker_code", "")), "lag": int(row.get("best_lag", 1)), "p_value": float(row.get("p_value", 1.0)), "is_significant": bool(row.get("significant", False))})

    result = _clean({
        "ticker": ticker,
        "analysis_date": str(analysis_ts.date()),
        "window_start": str(window_start.date()),
        "close": close_value,
        "ret_5d": ret_5d,
        "ret_10d": ret_10d,
        "signal": _fmt_signal(signal_row.get("bandar_signal")),
        "signal_raw": str(signal_row.get("bandar_signal", "")),
        "signal_score": float(signal_row.get("bandar_signal_score", 0)) if pd.notna(signal_row.get("bandar_signal_score", 0)) else 0,
        "foreign_5d": foreign_5d,
        "smart_cumulative": smart_cum,
        "conviction_score": score_value,
        "conviction_breakdown": conviction,
        "top_buyer": {"broker": str(top_buyer["broker_code"]) if top_buyer is not None else "-", "net": float(top_buyer["net_value"]) if top_buyer is not None else None},
        "top_seller": {"broker": str(top_seller["broker_code"]) if top_seller is not None else "-", "net": float(top_seller["net_value"]) if top_seller is not None else None},
        "alerts": alerts,
        "verdict": verdict,
        "broker_summary": broker_summary_rows,
        "price_performance": perf_rows,
        "profile_flow": profile_rows,
        "profile_broker_detail": _profile_broker_detail_table(activity_window),
        "smart_daily": smart_daily_rows,
        "price_chart": price_chart_rows,
        "signal_overlay": signal_overlay,
        "activity_date": str(activity_date.date()) if activity_date else None,
        "foreign_causality": {"is_significant": bool(foreign_causality.get("is_significant", False)), "min_p_value": float(foreign_causality.get("min_p_value", 1.0)), "best_lag": int(foreign_causality.get("best_lag", 1))} if foreign_causality else None,
        "part_causality": part_list,
        "broker_causality": broker_list,
        "breakdown": f"Granger p-value component: {conviction['causality_component']:.0f}/100 (p={conviction['p_value'] if conviction['p_value'] is not None else 'n/a'}); Signal component: {conviction['signal_component']:.0f}/100; Foreign 5D component: {conviction['foreign_component']:.0f}/100; Broker win-rate component: {conviction['broker_component']:.0f}/100 ({conviction['broker_note']})."
    })

    _DETAIL_CACHE[cache_key] = {"ts": now, "data": result}
    return result
