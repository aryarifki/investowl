import numpy as np
"""Router bandarmology — membungkus fungsi paket idx_bandarmology."""
from datetime import date
import threading

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ..idx_bridge import analysis, storage, universe, pipeline

router = APIRouter(prefix="/api/bandar", tags=["bandarmology"])
import math

def _clean(obj):
    """Ganti NaN/Inf menjadi None agar valid JSON."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj


# ══════════════════════════════════════════════════════════
# Universe & Tickers
# ══════════════════════════════════════════════════════════

@router.get("/universe")
def get_universe(mode: str = "watchlist"):
    return {"tickers": universe.get_universe(mode=mode)}


@router.get("/tickers")
def master_tickers():
    try:
        return {"tickers": universe.get_master_tickers(active_only=True)}
    except Exception as e:
        return {"tickers": [], "error": str(e)}


# ══════════════════════════════════════════════════════════
# Metrics (6 kartu di header dashboard)
# ══════════════════════════════════════════════════════════

@router.get("/stocks/{ticker}/metrics")
def metrics(ticker: str, date: str | None = None, window: int = 30):
    ticker = ticker.upper()
    price_df = storage.read_prices([ticker])
    flow_df = storage.read_broker_flow([ticker])
    activity_df = storage.read_broker_activity([ticker])

    if flow_df.empty:
        raise HTTPException(404, f"No broker data for {ticker}")

    ts = pd.Timestamp(date) if date else flow_df["date"].max()
    win_start = ts - pd.Timedelta(days=window)
    flow_win = flow_df[(flow_df["date"] >= win_start) & (flow_df["date"] <= ts)]
    act_win = activity_df[(activity_df["date"] >= win_start) & (activity_df["date"] <= ts)]

    def ret(periods: int):
        sub = price_df[price_df["date"] <= ts].sort_values("date")
        if len(sub) <= periods:
            return None
        base = float(sub.iloc[-periods - 1]["close"])
        if not base:
            return None
        return float(sub.iloc[-1]["close"]) / base - 1

    foreign_5d = None
    if not flow_win.empty and "foreign_net_broker" in flow_win.columns:
        foreign_5d = float(
            flow_win.sort_values("date").tail(5)["foreign_net_broker"].fillna(0).sum()
        )

    top_buy, top_sell = analysis.top_net_broker_summary(ticker, trade_date=ts, top_n=6)

    signal_row = {}
    if not flow_win.empty:
        signal_row = flow_win.sort_values("date").iloc[-1].to_dict()

    causality = analysis.causality_foreign_vs_price(ticker, max_lags=5)
    p = None if causality is None else causality.get("min_p_value")
    if p is None or p != p:
        p_score = 50
    elif p <= 0.01:
        p_score = 100
    elif p <= 0.05:
        p_score = 80
    elif p <= 0.10:
        p_score = 55
    else:
        p_score = 20

    raw = str(signal_row.get("bandar_signal") or "").upper()
    s_map = {
        "AKUMULASI_KUAT": 100, "STRONG_ACCUMULATION": 100,
        "AKUMULASI": 80, "ACCUMULATION": 80, "NET_BUY": 80,
        "NETRAL": 50, "NEUTRAL": 50,
        "DISTRIBUSI": 25, "DISTRIBUTION": 25, "NET_SELL": 25,
        "DISTRIBUSI_KUAT": 0, "STRONG_DISTRIBUTION": 0,
    }
    s_score = s_map.get(raw, 40)

    f_score = 50
    if foreign_5d is not None:
        f_score = 100 if foreign_5d > 0 else (0 if foreign_5d < 0 else 50)

    w_score, w_note = 50.0, "No broker validation sample"
    scan = analysis.broker_alpha_scan(
        [ticker], horizon=10, min_events=5, min_net_value=0,
        group_by=("ticker", "broker_code"),
    )
    if not scan.empty:
        r = scan.sort_values(
            ["significant", "p_value_one_sided", "mean_fwd_return"],
            ascending=[False, True, False],
        ).iloc[0]
        w_score = max(0.0, min(100.0, float(r.get("win_rate", 0.5)) * 100))
        w_note = r["broker_code"] + " win rate " + format(r["win_rate"], ".0%")

    score = p_score * 0.30 + s_score * 0.30 + f_score * 0.20 + w_score * 0.20

    smart_cum = None
    if not act_win.empty and "broker_code" in act_win.columns:
        act_win = act_win.copy()
        act_win["profile"] = act_win["broker_code"].map(analysis.broker_profile_of)
        smart = act_win[act_win["profile"].isin({"smart_foreign", "local_institutional"})]
        if not smart.empty:
            smart_cum = float(smart["net_value"].sum())

    return _clean({
        "ticker": ticker,
        "analysis_date": str(ts.date()),
        "window_start": str(win_start.date()),
        "signal": signal_row.get("bandar_signal"),
        "conviction": {
            "score": round(score, 1),
            "p_value": p,
            "components": {
                "causality": p_score,
                "signal": s_score,
                "foreign": f_score,
                "broker": round(w_score, 1),
            },
            "broker_note": w_note,
        },
        "ret_5d": ret(5),
        "ret_10d": ret(10),
        "foreign_net_5d": foreign_5d,
        "smart_cumulative": smart_cum,
        "top_buyers": top_buy.to_dict("records") if not top_buy.empty else [],
        "top_sellers": top_sell.to_dict("records") if not top_sell.empty else [],
    })


# ══════════════════════════════════════════════════════════
# Tab Analisis
# ══════════════════════════════════════════════════════════

@router.get("/stocks/{ticker}/smart-flow")
def smart_flow(ticker: str, window: int = 30):
    ticker = ticker.upper()
    act = storage.read_broker_activity([ticker])
    if act.empty:
        return {"data": []}
    end = act["date"].max()
    win = act[(act["date"] >= end - pd.Timedelta(days=window)) & (act["date"] <= end)].copy()
    if win.empty:
        return {"data": []}
    win["profile"] = win["broker_code"].map(analysis.broker_profile_of)
    smart = win[win["profile"].isin({"smart_foreign", "local_institutional"})]
    if smart.empty:
        return {"data": []}
    daily = smart.groupby("date")["net_value"].sum().reset_index(name="smart_net").sort_values("date")
    daily["cumulative_net"] = daily["smart_net"].cumsum()
    daily["date"] = daily["date"].astype(str)
    return {"data": _clean(daily.to_dict("records"))}


@router.get("/stocks/{ticker}/broker-compare")
def broker_compare(ticker: str, window: int = 30, mode: str = "cumulative"):
    ticker = ticker.upper()
    act = storage.read_broker_activity([ticker])
    if act.empty:
        return {"data": []}
    end = act["date"].max()
    win = act[(act["date"] >= end - pd.Timedelta(days=window)) & (act["date"] <= end)]
    if win.empty:
        return {"data": []}
    pivot = win.pivot_table(
        index="date", columns="broker_code", values="net_value", aggfunc="sum"
    ).sort_index()
    if mode == "cumulative":
        pivot = pivot.cumsum()
    data = []
    for idx, row in pivot.iterrows():
        rec = {"date": str(idx)}
        for c in pivot.columns:
            v = row[c]
            rec[c] = float(v) if v == v else None
        data.append(rec)
    return {"data": data}


@router.get("/stocks/{ticker}/causality")
def causality(ticker: str):
    ticker = ticker.upper()
    f = analysis.causality_foreign_vs_price(ticker, max_lags=5)
    part = analysis.causality_by_participant(ticker, max_lags=5)
    broker = analysis.causality_by_broker(ticker, top_n=15, max_lags=5)
    return _clean({
        "foreign": f,
        "participants": part.to_dict("records") if part is not None and not part.empty else [],
        "brokers": broker.to_dict("records") if broker is not None and not broker.empty else [],
    })


@router.get("/validation/broker-scan")
def validation(ticker: str, horizon: int = 10, min_events: int = 5, min_net_b: float = 0.0):
    ticker = ticker.upper()
    df = analysis.broker_alpha_scan(
        [ticker], horizon=horizon, min_events=min_events,
        min_net_value=min_net_b * 1e9, group_by=("ticker", "broker_code"),
    )
    return {"data": _clean(df.to_dict("records")) if not df.empty else []}


@router.get("/stocks/{ticker}/event-study")
def event_study(ticker: str, horizons: str = "1,3,5,10", lookback_days: int = 20):
    ticker = ticker.upper()
    hs = tuple(int(h) for h in horizons.split(","))
    table = analysis.event_study_table(
        tickers=[ticker], horizons=hs, lookback_days=lookback_days,
        signals={"AKUMULASI_KUAT", "AKUMULASI", "STRONG_ACCUMULATION",
                 "ACCUMULATION", "NET_BUY"},
    )
    return {"data": _clean(table.to_dict("records")) if not table.empty else []}


@router.get("/screener")
def screener(universe_mode: str = "watchlist", horizon: int = 10):
    tickers = get_dynamic_universe(universe_mode)
    scan = analysis.broker_alpha_scan(
        tickers, horizon=horizon, min_events=5, min_net_value=0,
        group_by=("ticker", "broker_code"),
    )
    return {"data": _clean(scan.to_dict("records")) if not scan.empty else []}


@router.get("/stocks/{ticker}/raw")
def raw_tables(ticker: str, window: int = 30):
    ticker = ticker.upper()
    flow = storage.read_broker_flow([ticker])
    act = storage.read_broker_activity([ticker])
    end = flow["date"].max() if not flow.empty else act["date"].max()
    start = end - pd.Timedelta(days=window)

    def trim(df):
        if df.empty:
            return []
        d = df.copy()
        d["date"] = pd.to_datetime(d["date"])
        w = d[(d["date"] >= start) & (d["date"] <= end)].copy()
        w["date"] = w["date"].astype(str)
        w = w.astype(object).where(pd.notna(w), None)
        return w.to_dict("records")

    return _clean({"flow": trim(flow), "activity": trim(act)})


@router.get("/stocks/{ticker}/broker-profiles")
def broker_profiles(ticker: str, lookback_days: int = 30):
    df = analysis.broker_profile_flow_table(ticker.upper(), lookback_days=lookback_days)
    return {"data": _clean(df.to_dict("records")) if df is not None and not df.empty else []}


@router.get("/stocks/{ticker}/price-performance")
def price_performance(ticker: str):
    df = analysis.price_performance_table(ticker.upper())
    return {"data": _clean(df.to_dict("records")) if df is not None and not df.empty else []}


@router.get("/stocks/{ticker}/broker-distribution")
def broker_distribution(ticker: str, trade_date: str | None = None, top_n: int = 12):
    ts = pd.Timestamp(trade_date) if trade_date else None
    df = analysis.broker_distribution_table(ticker.upper(), trade_date=ts, top_n=top_n)
    return {"data": _clean(df.to_dict("records")) if df is not None and not df.empty else []}


# ══════════════════════════════════════════════════════════
# Pipeline (tombol-tombol di sidebar)
# ══════════════════════════════════════════════════════════

@router.post("/pipeline/run")
def run_pipeline(universe_mode: str = "watchlist"):
    def _job():
        pipeline.run(universe_mode=universe_mode)

    threading.Thread(target=_job, daemon=True).start()
    return {"status": "started", "universe_mode": universe_mode}


@router.post("/pipeline/backfill")
def backfill(tickers: str = "BBCA", start: str = "2024-01-01", end: str | None = None):
    def _job():
        pipeline.backfill_broker_history(
            tickers=tickers.split(","), start=start, end=end
        )

    threading.Thread(target=_job, daemon=True).start()
    return {"status": "started", "tickers": tickers.split(","), "start": start}

# ============================================================
# System Status & Master Refresh Endpoints
# ============================================================

@router.get("/system-status")
def get_system_status():
    """Mengembalikan jumlah ticker aktif dan tanggal transaksi terakhir di database."""
    from sqlalchemy import text
    from idx_bandarmology import storage
    try:
        with storage.engine.connect() as conn:
            # Hitung emiten aktif
            tickers_cnt = conn.execute(
                text("SELECT COUNT(*) FROM tickers WHERE is_active = TRUE")
            ).scalar() or 0
            
            # Ambil tanggal terakhir data broker flow
            latest_dt = conn.execute(
                text("SELECT MAX(date) FROM broker_flow")
            ).scalar()
            latest_date_str = str(latest_dt) if latest_dt else "-"

        return {
            "status": "ok",
            "active_tickers": int(tickers_cnt),
            "latest_date": latest_date_str,
        }
    except Exception as e:
        return {"status": "error", "active_tickers": 0, "latest_date": "-", "error": str(e)}


@router.post("/universe/refresh")
def refresh_universe():
    """Trigger sinkronisasi ulang master tickers langsung dari IDX."""
    from idx_bandarmology import universe
    try:
        count = universe.refresh_master_tickers(force=True)
        return {
            "status": "success",
            "count": count,
            "message": f"Berhasil memperbarui {count} emiten dari IDX.",
        }
    except Exception as e:
        return {"status": "error", "count": 0, "error": str(e)}

# ══════════════════════════════════════════════════════════
# Daily Summary — dengan cache 5 menit
# ══════════════════════════════════════════════════════════

_SUMMARY_CACHE: dict = {}

@router.get("/daily-summary")
def daily_summary(universe_mode: str = "all", refresh: int = 0):
    import time as _time

    cache_key = universe_mode
    now = _time.time()
    cached = _SUMMARY_CACHE.get(cache_key)
    if cached is not None and not refresh and (now - cached["ts"]) < 300:
        return cached["data"]

    tickers = get_dynamic_universe(universe_mode)
    price_df = storage.read_prices(tickers)
    flow_df = storage.read_broker_flow(tickers)

    items = []
    if not flow_df.empty:
        flow_df = flow_df.sort_values("date")
        for t, fsub in flow_df.groupby("ticker"):
            try:
                last = fsub.iloc[-1]
                psub = price_df[price_df["ticker"] == t] if not price_df.empty else fsub.iloc[0:0]
                psub = psub[psub["date"] <= last["date"]].sort_values("date")

                ret_5d = None
                if len(psub) > 5:
                    base = float(psub.iloc[-6]["close"])
                    if base:
                        ret_5d = float(psub.iloc[-1]["close"]) / base - 1

                f5 = None
                tail5 = fsub.tail(5)
                if "foreign_net_broker" in tail5.columns:
                    f5 = float(tail5["foreign_net_broker"].fillna(0).sum())

                items.append({
                    "ticker": t,
                    "date": str(last["date"]),
                    "signal": last.get("bandar_signal"),
                    "signal_score": last.get("bandar_signal_score"),
                    "close": float(psub.iloc[-1]["close"]) if len(psub) else None,
                    "ret_5d": ret_5d,
                    "foreign_net_5d": f5,
                    "spark": [float(x) for x in psub.tail(30)["close"]],
                })
            except Exception:
                continue

    from collections import Counter
    counts = Counter((i["signal"] or "NETRAL").upper() for i in items)
    top = sorted(items, key=lambda x: (x["signal_score"] or 0), reverse=True)[:5]

    result = _clean({
        "as_of": max((i["date"] for i in items), default=None),
        "signal_counts": dict(counts),
        "items": items,
        "top_conviction": top,
    })

    _SUMMARY_CACHE[cache_key] = {"ts": now, "data": result}
    return result

# ============================================================
# Ticker Detail Endpoint
# ============================================================

_DETAIL_CACHE: dict = {}

def _clean_detail(obj):
    if isinstance(obj, dict):
        return {k: _clean_detail(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean_detail(v) for v in obj]
    if isinstance(obj, float) and (pd.isna(obj) or np.isinf(obj)):
        return None
    if hasattr(obj, "item"):
        return obj.item()
    return obj


def _fmt_signal(value):
    if value is None or pd.isna(value):
        return "-"
    mapping = {
        "AKUMULASI_KUAT": "Strong Accumulation",
        "AKUMULASI": "Accumulation",
        "DISTRIBUSI_KUAT": "Strong Distribution",
        "DISTRIBUSI": "Distribution",
        "NETRAL": "Neutral",
        "STRONG_ACCUMULATION": "Strong Accumulation",
        "ACCUMULATION": "Accumulation",
        "NET_BUY": "Net Buy",
        "STRONG_DISTRIBUTION": "Strong Distribution",
        "DISTRIBUTION": "Distribution",
        "NET_SELL": "Net Sell",
        "NEUTRAL": "Neutral",
    }
    return mapping.get(str(value), str(value).replace("_", " ").title())


def _participant_label(value):
    return {"Asing": "FOREIGN", "Lokal": "LOCAL", "Pemerintah": "GOV"}.get(str(value), str(value or "-"))


def _price_at_or_before(price_df, ts):
    sub = price_df[price_df["date"] <= ts].sort_values("date")
    return None if sub.empty else sub.iloc[-1]


def _return_to_date(price_df, ts, periods):
    sub = price_df[price_df["date"] <= ts].sort_values("date")
    if len(sub) <= periods:
        return None
    latest = float(sub.iloc[-1]["close"])
    base = float(sub.iloc[-periods - 1]["close"])
    return latest / base - 1 if base else None


def _flow_row_at(flow_df, ticker, ts):
    sub = flow_df[(flow_df["ticker"] == ticker) & (flow_df["date"] <= ts)].sort_values("date")
    return {} if sub.empty else sub.iloc[-1].to_dict()


def _latest_activity_date(activity_df, ticker, ts):
    sub = activity_df[(activity_df["ticker"] == ticker) & (activity_df["date"] <= ts)]
    if sub.empty:
        return None
    return pd.Timestamp(sub["date"].max())


ACC_SIGNALS = {"STRONG_ACCUMULATION", "ACCUMULATION", "NET_BUY", "AKUMULASI_KUAT", "AKUMULASI"}
DIST_SIGNALS = {"STRONG_DISTRIBUTION", "DISTRIBUTION", "NET_SELL", "DISTRIBUSI_KUAT", "DISTRIBUSI"}
SMART_PROFILES = {"smart_foreign", "local_institutional"}

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
    if scan_df.empty: return 50, "No broker validation sample"
    sub = scan_df[scan_df["ticker"] == ticker].copy() if "ticker" in scan_df.columns else scan_df.copy()
    if sub.empty: return 50, "No broker validation sample"
    sub = sub.sort_values(["significant", "p_value_one_sided", "mean_fwd_return"], ascending=[False, True, False])
    row = sub.iloc[0]
    win_rate = float(row.get("win_rate", 0.5))
    return max(0, min(100, win_rate * 100)), str(row.get("broker_code", "-")) + " win rate " + "{:.0%}".format(win_rate)

def _conviction_score(signal, foreign_5d, scan_df, ticker):
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
    return {
        "score": round(float(score), 1),
        "p_value": None if p_value is None or pd.isna(p_value) else float(p_value),
        "causality_component": float(p_score),
        "signal_component": float(s_score),
        "foreign_component": float(f_score),
        "broker_component": float(w_score),
        "broker_note": w_note,
    }

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
    broker_rows = (
        df.groupby(["profile", "broker_code", "participant_type"], dropna=False)
        .agg(net=("net_value", "sum"), buy=("buy_value", "sum"), sell=("sell_value", "sum"))
        .reset_index()
    )
    rows = []
    PROFILE_META = {
        "smart_foreign": ("Foreign Smart Money", "Directional foreign institutions"),
        "local_institutional": ("Local Institutions", "Local institution-like accounts"),
        "market_maker": ("Market Makers", "Active on both sides; net position matters"),
        "bandar_gorengan": ("Speculative Operators", "Speculative operator profile"),
        "retail": ("Retail-Dominant", "Retail-heavy platforms"),
        "lainnya": ("Other Brokers", "Outside defined behavioral profiles"),
    }
    for profile, (label, desc) in PROFILE_META.items():
        members = broker_rows[broker_rows["profile"] == profile].copy()
        if members.empty: continue
        members["abs_net"] = members["net"].abs()
        rows.append({
            "profile": profile,
            "label": label,
            "description": desc,
            "net": float(members["net"].sum()),
            "top_brokers": members.sort_values("abs_net", ascending=False).head(6)[["broker_code", "participant_type", "net"]].to_dict("records"),
        })
    return pd.DataFrame(rows)

def _profile_broker_detail_table(activity, profile_key=None):
    if activity.empty: return []
    df = activity.copy()
    df["profile"] = df["broker_code"].map(analysis.broker_profile_of)
    if profile_key:
        df = df[df["profile"] == profile_key]
    if df.empty: return []
    grouped = (
        df.groupby(["profile", "broker_code", "participant_type"], dropna=False)
        .agg(
            buy=("buy_value", "sum"),
            sell=("sell_value", "sum"),
            net=("net_value", "sum"),
            freq=("frequency", "sum"),
            days=("date", "nunique"),
        )
        .reset_index()
    )
    PROFILE_META = {
        "smart_foreign": ("Foreign Smart Money", ""),
        "local_institutional": ("Local Institutions", ""),
        "market_maker": ("Market Makers", ""),
        "bandar_gorengan": ("Speculative Operators", ""),
        "retail": ("Retail-Dominant", ""),
        "lainnya": ("Other Brokers", ""),
    }
    grouped["profile_label"] = grouped["profile"].map(lambda key: PROFILE_META.get(key, (key, ""))[0])
    grouped["type_label"] = grouped["participant_type"].map(lambda v: {"Asing": "FOREIGN", "Lokal": "LOCAL", "Pemerintah": "GOV"}.get(str(v), str(v or "-")))
    grouped["avg_value_tx"] = grouped.apply(lambda r: abs(float(r["net"] or 0)) / max(float(r["freq"] or 0), 1), axis=1)
    grouped = grouped.sort_values(["profile", "net"], ascending=[True, False])
    rows = []
    for _, row in grouped.iterrows():
        rows.append({
            "profile": str(row["profile_label"]),
            "profile_key": str(row["profile"]),
            "broker": str(row["broker_code"]),
            "type": str(row["type_label"]),
            "buy": float(row["buy"]),
            "sell": float(row["sell"]),
            "net": float(row["net"]),
            "freq": float(row["freq"]),
            "days": int(row["days"]),
            "avg_value_tx": float(row["avg_value_tx"]),
        })
    return rows

def _broker_distribution_data_range(activity, dist_start, dist_end):
    if activity.empty:
        return {"buyers": [], "sellers": [], "edges": []}
    
    df = activity.copy()
    # Konversi tipe data tanggal Pandas agar perbandingan akurat
    df["date"] = pd.to_datetime(df["date"])
    start_ts = pd.to_datetime(dist_start)
    end_ts = pd.to_datetime(dist_end)
    
    dist = df[(df["date"] >= start_ts) & (df["date"] <= end_ts)].copy()
    if dist.empty:
        return {"buyers": [], "sellers": [], "edges": []}
        
    dist = (
        dist.groupby(["broker_code", "participant_type"], dropna=False)
        .agg(
            buy_value=("buy_value", "sum"),
            sell_value=("sell_value", "sum"),
            net_value=("net_value", "sum"),
            frequency=("frequency", "sum"),
            buy_lot=("buy_lot", "sum"),
            sell_lot=("sell_lot", "sum"),
            buy_avg_price=("buy_avg_price", "mean"),
            sell_avg_price=("sell_avg_price", "mean"),
        )
        .reset_index()
    )
    buyers = dist[dist["net_value"] > 0].copy().sort_values("net_value", ascending=False)
    sellers = dist[dist["net_value"] < 0].copy().sort_values("net_value", ascending=True)

    buyer_rows = buyers.head(8).reset_index(drop=True)
    seller_rows = sellers.head(8).reset_index(drop=True)
    buyer_rows["remaining"] = buyer_rows["net_value"].astype(float)
    seller_rows["remaining"] = seller_rows["net_value"].abs().astype(float)
    edges = []
    seller_idx = 0
    for buyer_i in range(len(buyer_rows)):
        buyer_left = float(buyer_rows.loc[buyer_i, "remaining"])
        while buyer_left > 1e-9 and seller_idx < len(seller_rows):
            seller_left = float(seller_rows.loc[seller_idx, "remaining"])
            if seller_left <= 1e-9:
                seller_idx += 1
                continue
            matched = min(buyer_left, seller_left)
            edges.append({
                "buyer_code": str(buyer_rows.loc[buyer_i, "broker_code"]),
                "buyer_type": _participant_label(buyer_rows.loc[buyer_i, "participant_type"]),
                "seller_code": str(seller_rows.loc[seller_idx, "broker_code"]),
                "seller_type": _participant_label(seller_rows.loc[seller_idx, "participant_type"]),
                "matched_value": float(matched),
            })
            buyer_left -= matched
            seller_rows.loc[seller_idx, "remaining"] = seller_left - matched
            if seller_rows.loc[seller_idx, "remaining"] <= 1e-9:
                seller_idx += 1
        buyer_rows.loc[buyer_i, "remaining"] = buyer_left

    return {
        "buyers": [
            {
                "broker": str(row["broker_code"]),
                "type": _participant_label(row["participant_type"]),
                "buy_value": float(row["buy_value"]),
                "sell_value": float(row["sell_value"]),
                "net_value": float(row["net_value"]),
                "freq": float(row["frequency"]),
                "buy_lot": float(row["buy_lot"]) if pd.notna(row["buy_lot"]) else None,
                "buy_avg": float(row["buy_avg_price"]) if pd.notna(row["buy_avg_price"]) else None,
            }
            for _, row in buyers.head(10).iterrows()
        ],
        "sellers": [
            {
                "broker": str(row["broker_code"]),
                "type": _participant_label(row["participant_type"]),
                "buy_value": float(row["buy_value"]),
                "sell_value": float(row["sell_value"]),
                "net_value": float(row["net_value"]),
                "freq": float(row["frequency"]),
                "sell_lot": float(row["sell_lot"]) if pd.notna(row["sell_lot"]) else None,
                "sell_avg": float(row["sell_avg_price"]) if pd.notna(row["sell_avg_price"]) else None,
            }
            for _, row in sellers.head(10).iterrows()
        ],
        "edges": edges,
        "dist_start": str(dist_start.date() if hasattr(dist_start, "date") else dist_start),
        "dist_end": str(dist_end.date() if hasattr(dist_end, "date") else dist_end),
    }


def _sparkline_values(activity, broker_code, end_ts, days=5):
    sub = activity[(activity["broker_code"] == broker_code) & (activity["date"] <= end_ts)].sort_values("date").tail(days)
    if sub.empty: return "-----"
    chars = []
    for value in sub["net_value"].fillna(0):
        chars.append("+" if value > 0 else "-" if value < 0 else "0")
    return "".join(chars)


@router.get("/detail/{ticker}")
def ticker_detail(
    ticker: str,
    analysis_date: str = None,
    window_days: int = 20,
    horizon: int = 10,
    min_events: int = 5,
    min_net_buy_b: float = 0.0,
):
    import time as _time
    ticker = ticker.upper().strip()

    activity_df = storage.read_broker_activity([ticker]).copy()
    if activity_df.empty:
        return {"error": "No broker history for " + ticker}

    if analysis_date:
        analysis_ts = pd.Timestamp(analysis_date)
    else:
        dates = sorted(activity_df[activity_df["ticker"] == ticker]["date"].dt.date.unique().tolist())
        analysis_ts = pd.Timestamp(max(dates)) if dates else pd.Timestamp.now()

    cache_key = f"{ticker}|{analysis_ts.date()}|{window_days}|{horizon}|v2"
    now = _time.time()
    cached = _DETAIL_CACHE.get(cache_key)
    if cached is not None and (now - cached["ts"]) < 300:
        return cached["data"]

    price_df = storage.read_prices([ticker]).copy()
    broker_df = storage.read_broker_flow([ticker]).copy()

    if broker_df.empty:
        return {"error": "No broker history for " + ticker}

    window_start = analysis_ts - pd.Timedelta(days=window_days)
    price_window = price_df[(price_df["date"] >= window_start) & (price_df["date"] <= analysis_ts)].copy()
    broker_window = broker_df[(broker_df["date"] >= window_start) & (broker_df["date"] <= analysis_ts)].copy()
    activity_window = activity_df[(activity_df["date"] >= window_start) & (activity_df["date"] <= analysis_ts)].copy()

    px_row = _price_at_or_before(price_df, analysis_ts)
    signal_row = _flow_row_at(broker_df, ticker, analysis_ts)
    activity_date = _latest_activity_date(activity_df, ticker, analysis_ts)

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
    ret_5d = _return_to_date(price_df, analysis_ts, 5)
    ret_10d = _return_to_date(price_df, analysis_ts, 10)
    foreign_5d = float(broker_window.sort_values("date").tail(5)["foreign_net_broker"].fillna(0).sum()) if not broker_window.empty else 0.0
    smart_cum = float(daily_smart["cumulative_net"].iloc[-1]) if not daily_smart.empty else None

    top_buyer = top_buy.iloc[0] if not top_buy.empty else None
    top_seller = top_sell.iloc[0] if not top_sell.empty else None

    conviction = _conviction_score(signal_row.get("bandar_signal"), foreign_5d, scan_10d, ticker)
    score_value = float(conviction["score"])
    alerts = _contradiction_alerts(signal_row.get("bandar_signal"), ret_5d, ret_10d, foreign_5d, smart_cum)

    sig_10d = scan_10d[scan_10d["significant"].eq(True)].copy() if not scan_10d.empty else pd.DataFrame()
    if sig_10d.empty:
        verdict = (
            ticker + " shows " + str(signal_row.get("bandar_signal")).replace("_", " ").title() + " with " + "{:+.2%}".format(ret_5d or 0) + " over 5D and "
            + "{:+.2%}".format(ret_10d or 0) + " over 10D. The current read is directional, but broker-specific 10D validation is not yet statistically strong."
        )
    else:
        best = sig_10d.sort_values(["p_value_one_sided", "mean_fwd_return"], ascending=[True, False]).iloc[0]
        verdict = (
            ticker + " shows " + str(signal_row.get("bandar_signal")).replace("_", " ").title() + ". Broker " + str(best["broker_code"]) + " is the strongest 10D validation: "
            + str(int(best["n_events"])) + " events, mean return " + "{:+.2%}".format(best["mean_fwd_return"]) + ", "
            + "win rate " + "{:.0%}".format(best["win_rate"]) + ", p-value " + "{:.4f}".format(best["p_value_one_sided"]) + "."
        )

    broker_summary_rows = []
    for side, df in (("Buy", top_buy.head(3)), ("Sell", top_sell.head(3))):
        for _, row in df.iterrows():
            broker_summary_rows.append({
                "side": side,
                "broker": str(row["broker_code"]),
                "type": _participant_label(row["participant_type"]),
                "net": float(row["net_value"]),
                "spark": _sparkline_values(activity_df, row["broker_code"], analysis_ts),
            })

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
            smart_daily_rows.append({
                "date": str(row["date"]),
                "smart_net": float(row["smart_net"]),
                "cumulative_net": float(row["cumulative_net"]),
            })

    price_chart_rows = []
    if not price_window.empty:
        for _, row in price_window.iterrows():
            price_chart_rows.append({
                "date": str(row["date"]),
                "close": float(row["close"]) if pd.notna(row["close"]) else None,
                "volume": float(row["volume"]) if "volume" in row and pd.notna(row["volume"]) else None,
            })

    signal_overlay = []
    if not broker_window.empty:
        br_overlay = broker_window[["date", "bandar_signal", "bandar_signal_score"]].copy()
        for _, row in br_overlay.iterrows():
            signal_overlay.append({
                "date": str(row["date"]),
                "signal": str(row["bandar_signal"]).replace("_", " ").title(),
                "score": float(row["bandar_signal_score"]) if pd.notna(row["bandar_signal_score"]) else None,
            })

    # === PENAMBAHAN DATA COMPANY UNTUK DASHBOARD ===
    company_data = {"name": "Bursa Efek Indonesia", "group": "Sektor Perusahaan"}
    try:
        from sqlalchemy import text
        with storage.engine.connect() as conn:
            query = text("SELECT company_name, group_name FROM analytics_foreign_flow WHERE ticker = :ticker LIMIT 1")
            row = conn.execute(query, {"ticker": ticker}).fetchone()
            if row:
                company_data["name"] = row[0] or company_data["name"]
                company_data["group"] = row[1] or company_data["group"]
    except Exception:
        pass
    # ===============================================

    result = _clean_detail({
        "ticker": ticker,
        "company": company_data,
        "analysis_date": str(analysis_ts.date()),
        "window_start": str(window_start.date()),
        "window_days": window_days,
        "close": close_value,
        "ret_5d": ret_5d,
        "ret_10d": ret_10d,
        "signal": str(signal_row.get("bandar_signal")).replace("_", " ").title(),
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
    })

    _DETAIL_CACHE[cache_key] = {"ts": now, "data": result}
    return result

# ============================================================
# Supporting endpoints for sidebar controls
# ============================================================

@router.get("/dates/{ticker}")
def ticker_dates(ticker: str):
    ticker = ticker.upper().strip()
    try:
        activity_df = storage.read_broker_activity([ticker])
        if activity_df.empty:
            return {"dates": []}
        dates = sorted(activity_df[activity_df["ticker"] == ticker]["date"].dt.date.unique().tolist())
        return {"dates": [str(d) for d in dates]}
    except Exception as e:
        return {"dates": [], "error": str(e)}


@router.get("/universe/{mode}")
def universe_tickers(mode: str):
    try:
        tickers = universe.get_universe(mode=mode)
        try:
            available = universe.get_master_tickers(active_only=True)
            tickers = [t for t in tickers if t in available]
        except Exception:
            pass
        return {"mode": mode, "tickers": tickers, "count": len(tickers)}
    except Exception as e:
        return {"mode": mode, "tickers": [], "count": 0, "error": str(e)}

# ============================================================
# Broker Flow Tab Endpoint
# ============================================================

_BROKERFLOW_CACHE: dict = {}

def _broker_compare_data(activity, broker_codes, mode):
    if activity.empty or not broker_codes:
        return []
    sub = activity[activity["broker_code"].isin(broker_codes)].copy()
    if sub.empty:
        return []
    pivot = sub.pivot_table(index="date", columns="broker_code", values="net_value", aggfunc="sum").sort_index()
    if mode == "Cumulative":
        pivot = pivot.cumsum()
    pivot = pivot / 1e9
    rows = []
    for idx, row in pivot.iterrows():
        r = {"date": str(idx)}
        for col in pivot.columns:
            r[col] = float(row[col]) if pd.notna(row[col]) else None
        rows.append(r)
    return rows

def _broker_distribution_data(activity, dist_start, dist_end):
    dist = activity[(activity["date"] >= dist_start) & (activity["date"] <= dist_end)].copy()
    if dist.empty:
        return {"buyers": [], "sellers": [], "edges": []}
    dist = (
        dist.groupby(["broker_code", "participant_type"], dropna=False)
        .agg(
            buy_value=("buy_value", "sum"),
            sell_value=("sell_value", "sum"),
            net_value=("net_value", "sum"),
            frequency=("frequency", "sum"),
            buy_lot=("buy_lot", "sum"),
            sell_lot=("sell_lot", "sum"),
            buy_avg_price=("buy_avg_price", "mean"),
            sell_avg_price=("sell_avg_price", "mean"),
        )
        .reset_index()
    )
    buyers = dist[dist["net_value"] > 0].copy().sort_values("net_value", ascending=False)
    sellers = dist[dist["net_value"] < 0].copy().sort_values("net_value", ascending=True)

    buyer_rows = buyers.head(8).reset_index(drop=True)
    seller_rows = sellers.head(8).reset_index(drop=True)
    buyer_rows["remaining"] = buyer_rows["net_value"].astype(float)
    seller_rows["remaining"] = seller_rows["net_value"].abs().astype(float)
    edges = []
    seller_idx = 0
    for buyer_i in range(len(buyer_rows)):
        buyer_left = float(buyer_rows.loc[buyer_i, "remaining"])
        while buyer_left > 1e-9 and seller_idx < len(seller_rows):
            seller_left = float(seller_rows.loc[seller_idx, "remaining"])
            if seller_left <= 1e-9:
                seller_idx += 1
                continue
            matched = min(buyer_left, seller_left)
            edges.append({
                "buyer_code": str(buyer_rows.loc[buyer_i, "broker_code"]),
                "buyer_type": _participant_label(buyer_rows.loc[buyer_i, "participant_type"]),
                "seller_code": str(seller_rows.loc[seller_idx, "broker_code"]),
                "seller_type": _participant_label(seller_rows.loc[seller_idx, "participant_type"]),
                "matched_value": float(matched),
            })
            buyer_left -= matched
            seller_rows.loc[seller_idx, "remaining"] = seller_left - matched
            if seller_rows.loc[seller_idx, "remaining"] <= 1e-9:
                seller_idx += 1
        buyer_rows.loc[buyer_i, "remaining"] = buyer_left

    return {
        "buyers": [
            {
                "broker": str(row["broker_code"]),
                "type": _participant_label(row["participant_type"]),
                "buy_value": float(row["buy_value"]),
                "sell_value": float(row["sell_value"]),
                "net_value": float(row["net_value"]),
                "freq": float(row["frequency"]),
                "buy_lot": float(row["buy_lot"]) if pd.notna(row["buy_lot"]) else None,
                "buy_avg": float(row["buy_avg_price"]) if pd.notna(row["buy_avg_price"]) else None,
            }
            for _, row in buyers.head(10).iterrows()
        ],
        "sellers": [
            {
                "broker": str(row["broker_code"]),
                "type": _participant_label(row["participant_type"]),
                "buy_value": float(row["buy_value"]),
                "sell_value": float(row["sell_value"]),
                "net_value": float(row["net_value"]),
                "freq": float(row["frequency"]),
                "sell_lot": float(row["sell_lot"]) if pd.notna(row["sell_lot"]) else None,
                "sell_avg": float(row["sell_avg_price"]) if pd.notna(row["sell_avg_price"]) else None,
            }
            for _, row in sellers.head(10).iterrows()
        ],
        "edges": edges,
        "dist_date": str(dist_end.date()),
    }


def _broker_summary_table(dist_data):
    buyers = dist_data.get("buyers", [])
    sellers = dist_data.get("sellers", [])
    rows = []
    max_len = max(len(buyers), len(sellers))
    for i in range(min(max_len, 10)):
        row = {}
        if i < len(buyers):
            b = buyers[i]
            row.update({
                "buy_broker": b["broker"],
                "buy_type": b["type"],
                "buy_value": b["buy_value"],
                "buy_lot": b.get("buy_lot"),
                "buy_avg": b.get("buy_avg"),
            })
        else:
            row.update({"buy_broker": "", "buy_type": "", "buy_value": None, "buy_lot": None, "buy_avg": None})
        if i < len(sellers):
            s = sellers[i]
            row.update({
                "sell_broker": s["broker"],
                "sell_type": s["type"],
                "sell_value": abs(s["sell_value"]),
                "sell_lot": s.get("sell_lot"),
                "sell_avg": s.get("sell_avg"),
            })
        else:
            row.update({"sell_broker": "", "sell_type": "", "sell_value": None, "sell_lot": None, "sell_avg": None})
        rows.append(row)
    return rows


# ================= FIX UTAMA ADA DI SINI =================
@router.get("/broker-flow/{ticker}")
def broker_flow_detail(
    ticker: str,
    analysis_date: str = None,
    window_days: int = 20,
    broker_codes: str = "",  # comma-separated
    flow_mode: str = "Cumulative",
    # Menerima filter kalender dari Next.js UI
    dist_mode: Optional[str] = None,
    dist_date: Optional[str] = None,
    dist_start: Optional[str] = None,
    dist_end: Optional[str] = None
):
    import time as _time
    ticker = ticker.upper().strip()
    activity_df = storage.read_broker_activity([ticker]).copy()

    if activity_df.empty:
        return {"error": "No broker history for " + ticker}

    if analysis_date:
        analysis_ts = pd.Timestamp(analysis_date)
    else:
        dates = sorted(activity_df[activity_df["ticker"] == ticker]["date"].dt.date.unique().tolist())
        analysis_ts = pd.Timestamp(max(dates)) if dates else pd.Timestamp.now()

    # Cache key harus memasukkan parameter dist_mode dan dist_end agar FastAPI me-refresh datanya
    cache_key = f"{ticker}|{analysis_ts.date()}|{window_days}|{broker_codes}|{flow_mode}|{dist_mode}|{dist_start}|{dist_end}"
    now = _time.time()
    cached = _BROKERFLOW_CACHE.get(cache_key)
    if cached is not None and (now - cached["ts"]) < 300:
        return cached["data"]

    # Data Window Induk (Untuk Grafik)
    window_start = analysis_ts - pd.Timedelta(days=window_days)
    activity_window = activity_df[(activity_df["date"] >= window_start) & (activity_df["date"] <= analysis_ts)].copy()

    if activity_window.empty:
        return {"error": "No activity in window"}

    all_codes = sorted(activity_window["broker_code"].dropna().unique().tolist())
    ranked = (
        activity_window.assign(abs_net=activity_window["net_value"].abs())
        .groupby("broker_code")["abs_net"]
        .sum()
        .sort_values(ascending=False)
        .index.tolist()
    )

    selected = [c.strip() for c in broker_codes.split(",") if c.strip()] if broker_codes else ranked[:3]
    if not selected and ranked:
        selected = ranked[:3]

    compare_data = _broker_compare_data(activity_window, selected, flow_mode)

    # ================= LOGIKA KALENDER DISTRIBUSI YANG AMAN DARI ERROR =================
    def _parse_ts(d_str, fallback):
        # Fallback jika string kosong, null, atau tidak valid dari frontend
        if not d_str or d_str in ("undefined", "null", ""):
            return fallback
        try:
            return pd.Timestamp(d_str)
        except Exception:
            return fallback

    if dist_mode == "Single day":
        dist_start_ts = _parse_ts(dist_date, analysis_ts)
        dist_end_ts = _parse_ts(dist_date, analysis_ts)
    elif dist_mode == "Date range":
        dist_start_ts = _parse_ts(dist_start, window_start)
        dist_end_ts = _parse_ts(dist_end, analysis_ts)
    else:
        # Fallback default
        dist_start_ts = window_start
        dist_end_ts = analysis_ts

    # Tarik data kalender MENGGUNAKAN FUNGSI ASLI YANG SUDAH DIKEMBALIKAN (bukan '_range')
    dist_data = _broker_distribution_data(activity_df, dist_start_ts, dist_end_ts)

    # TABEL SUMMARY (Fungsi yang hilang sudah dikembalikan)
    summary = _broker_summary_table(dist_data)

    detail_rows = []
    if not activity_window.empty:
        grouped = (
            activity_window.groupby(["broker_code", "participant_type"], dropna=False)
            .agg(
                buy=("buy_value", "sum"),
                sell=("sell_value", "sum"),
                net=("net_value", "sum"),
                freq=("frequency", "sum"),
            )
            .reset_index()
        )
        for _, row in grouped.iterrows():
            detail_rows.append({
                "broker": str(row["broker_code"]),
                "type": _participant_label(row["participant_type"]),
                "buy": float(row["buy"]),
                "sell": float(row["sell"]),
                "net": float(row["net"]),
                "freq": float(row["freq"]),
            })
        detail_rows = sorted(detail_rows, key=lambda x: abs(x["net"]), reverse=True)
        
    profile_df = _profile_flow_from_activity(activity_window)
    profile_rows = []
    if not profile_df.empty:
        for _, row in profile_df.iterrows():
            profile_rows.append({
                "profile": row["profile"],
                "label": row["label"],
                "description": row["description"],
                "net": float(row["net"]),
                "top_brokers": row["top_brokers"],
            })

    profile_detail_rows = _profile_broker_detail_table(activity_window)

    result = _clean_detail({
        "ticker": ticker,
        "analysis_date": str(analysis_ts.date()),
        "window_start": str(window_start.date()),
        "all_codes": all_codes,
        "ranked_codes": ranked,
        "default_codes": ranked[:3] if ranked else [],
        "selected_codes": selected,
        "compare_chart": compare_data,
        "distribution": dist_data,
        "summary": summary,
        "profile_flow": profile_rows,
        "profile_broker_detail": profile_detail_rows,
        "detail_rows": detail_rows,
    })

    _BROKERFLOW_CACHE[cache_key] = {"ts": now, "data": result}
    return result

@router.get("/causality/{ticker}")
def causality_insight(ticker: str, analysis_date: str = None, window_days: int = None):
    from idx_bandarmology import analysis
    import pandas as pd

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
        mapping = {"Asing": "Foreign", "Lokal": "Local", "Pemerintah": "Government"}
        return mapping.get(str(val), val)

    part_list = []
    if not part_causality.empty:
        for _, row in part_causality.iterrows():
            part_list.append({
                "participant": get_english_text(row.get("participant_type", "")),
                "lag": int(row.get("best_lag", 1)),
                "p_value": float(row.get("p_value", 1.0)),
                "is_significant": bool(row.get("significant", False))
            })

    broker_list = []
    if not broker_causality.empty:
        for _, row in broker_causality.iterrows():
            broker_list.append({
                "code": str(row.get("broker_code", "")),
                "lag": int(row.get("best_lag", 1)),
                "p_value": float(row.get("p_value", 1.0)),
                "is_significant": bool(row.get("significant", False))
            })

    raw_response = {
        "granger_test": {
            "is_significant": bool(foreign_causality.get("is_significant", False)),
            "min_p_value": float(foreign_causality.get("min_p_value", 1.0)),
            "best_lag": int(foreign_causality.get("best_lag", 1))
        } if foreign_causality else None,
        "participant_causality": part_list,
        "top_brokers": broker_list
    }
    
    return _clean(raw_response)

@router.get("/validation/{ticker}")
def validation_insight(
    ticker: str,
    analysis_date: str = None,
    window_days: int = 60,
    horizon: int = 10,
    min_events: int = 5,
    min_net_buy: float = 0.0, universe_mode: str = "watchlist"
):
    from idx_bandarmology import analysis
    import pandas as pd
    import numpy as np

    try:
        scan_df = analysis.broker_alpha_scan(
            [ticker],
            horizon=horizon,
            min_events=min_events,
            min_net_value=min_net_buy * 1e9,
            group_by=("ticker", "broker_code")
        )
        scan_rows = scan_df.to_dict("records") if not scan_df.empty else []
    except Exception:
        scan_rows = []

    try:
        ACC_SIGNALS = ["STRONG_ACCUMULATION", "ACCUMULATION", "NET_BUY", "AKUMULASI_KUAT", "AKUMULASI"]
        event_table = analysis.event_study_table(
            tickers=[ticker],
            horizons=(1, 3, 5, 10),
            lookback_days=window_days,
            signals=ACC_SIGNALS
        )

        ribbon_chart = []
        individual_paths = []
        table_data = []

        if not event_table.empty:
            xs = [0, 1, 3, 5, 10]
            cols = [f"t_plus_{h}d" for h in xs]
            valid_cols = [c for c in cols if c in event_table.columns]

            values = event_table[valid_cols].apply(pd.to_numeric, errors="coerce")
            median = values.median()
            q25 = values.quantile(0.25)
            q75 = values.quantile(0.75)

            labels = ["Signal", "+1D", "+3D", "+5D", "+10D"]
            for i, col in enumerate(valid_cols):
                day_label = labels[i]
                ribbon_chart.append({
                    "day": day_label,
                    "median": float(median[col]) if pd.notna(median[col]) else None,
                    "range": [
                        float(q25[col]) if pd.notna(q25[col]) else None,
                        float(q75[col]) if pd.notna(q75[col]) else None
                    ]
                })

            for idx, row in values.iterrows():
                path_data = {}
                for i, col in enumerate(valid_cols):
                    path_data[labels[i]] = float(row[col]) if pd.notna(row[col]) else None
                individual_paths.append({"id": f"event_{idx}", "data": path_data})

            for _, row in event_table.iterrows():
                table_data.append({
                    "ticker": str(row.get("ticker", ticker)),
                    "signal_date": str(row.get("signal_date", "")),
                    "signal": str(row.get("bandar_signal", "")),
                    "signal_score": float(row.get("bandar_signal_score", 0)) if pd.notna(row.get("bandar_signal_score")) else None,
                    "t_plus_0d": float(row.get("t_plus_0d")) if pd.notna(row.get("t_plus_0d")) else None,
                    "t_plus_1d": float(row.get("t_plus_1d")) if pd.notna(row.get("t_plus_1d")) else None,
                    "t_plus_3d": float(row.get("t_plus_3d")) if pd.notna(row.get("t_plus_3d")) else None,
                    "t_plus_5d": float(row.get("t_plus_5d")) if pd.notna(row.get("t_plus_5d")) else None,
                    "t_plus_10d": float(row.get("t_plus_10d")) if pd.notna(row.get("t_plus_10d")) else None,
                })
    except Exception:
        ribbon_chart = []
        individual_paths = []
        table_data = []

    raw_response = {
        "broker_scan": scan_rows,
        "event_study": {
            "chart": ribbon_chart,
            "paths": individual_paths,
            "table": table_data
        }
    }
    return _clean(raw_response)

@router.get("/validation-v2/{ticker}")
def validation_insight_v2(
    ticker: str,
    analysis_date: str = None,
    window_days: int = 60,
    horizon: int = 10,
    min_events: int = 5,
    min_net_buy: float = 0.0, universe_mode: str = "watchlist"
):
    from idx_bandarmology import analysis
    import pandas as pd

    try:
        try:
            from idx_bandarmology.universe import get_universe
            universe_tickers = get_dynamic_universe(universe_mode)
        except Exception:
            universe_tickers = ["ANTM", "GOTO", "BBCA", "BMRI", "BBRI", "BBNI", "ASII", "TLKM", "BREN", "AMMN"]
        
        if ticker not in universe_tickers:
            universe_tickers.append(ticker)

        scan_df = analysis.broker_alpha_scan(
            universe_tickers,
            horizon=horizon,
            min_events=min_events,
            min_net_value=min_net_buy * 1e9,
            group_by=("ticker", "broker_code")
        )
        scan_rows_all = scan_df.to_dict("records") if not scan_df.empty else []
        scan_rows_ticker = scan_df[scan_df["ticker"] == ticker].to_dict("records") if not scan_df.empty else []
    except Exception:
        scan_rows_all = []
        scan_rows_ticker = []

    try:
        ACC_SIGNALS = ["STRONG_ACCUMULATION", "ACCUMULATION", "NET_BUY", "AKUMULASI_KUAT", "AKUMULASI"]
        event_table = analysis.event_study_table(
            tickers=[ticker],
            horizons=(1, 3, 5, 10),
            lookback_days=window_days,
            signals=ACC_SIGNALS
        )
        
        ribbon_chart = []
        individual_paths = []
        table_data = []

        if not event_table.empty:
            xs = [0, 1, 3, 5, 10]
            cols = [f"t_plus_{h}d" for h in xs]
            valid_cols = [c for c in cols if c in event_table.columns]
            values = event_table[valid_cols].apply(pd.to_numeric, errors="coerce")
            median = values.median()
            q25 = values.quantile(0.25)
            q75 = values.quantile(0.75)

            labels = ["Signal", "+1D", "+3D", "+5D", "+10D"]
            for i, col in enumerate(valid_cols):
                ribbon_chart.append({
                    "day": labels[i],
                    "median": float(median[col]) if pd.notna(median[col]) else None,
                    "range": [
                        float(q25[col]) if pd.notna(q25[col]) else None,
                        float(q75[col]) if pd.notna(q75[col]) else None
                    ]
                })
            
            for idx, row in values.iterrows():
                path_data = {}
                for i, col in enumerate(valid_cols):
                    path_data[labels[i]] = float(row[col]) if pd.notna(row[col]) else None
                individual_paths.append({"id": f"event_{idx}", "data": path_data})
            
            for _, row in event_table.iterrows():
                table_data.append({
                    "ticker": str(row.get("ticker", ticker)),
                    "signal_date": str(row.get("signal_date", "")),
                    "signal": str(row.get("bandar_signal", "")),
                    "t_plus_1d": float(row.get("t_plus_1d")) if pd.notna(row.get("t_plus_1d")) else None,
                    "t_plus_3d": float(row.get("t_plus_3d")) if pd.notna(row.get("t_plus_3d")) else None,
                    "t_plus_5d": float(row.get("t_plus_5d")) if pd.notna(row.get("t_plus_5d")) else None,
                    "t_plus_10d": float(row.get("t_plus_10d")) if pd.notna(row.get("t_plus_10d")) else None,
                })
    except Exception:
        pass

    return _clean({
        "broker_scan": {"ticker": scan_rows_ticker, "all": scan_rows_all},
        "event_study": {"chart": ribbon_chart, "paths": individual_paths, "table": table_data}
    })

def get_dynamic_universe(mode: str) -> list[str]:
    from idx_bandarmology.universe import get_universe
    mode = mode.lower().strip()
    
    standard_modes = ["watchlist", "idx30", "lq45", "idx80", "all", "liquid"]
    if mode in standard_modes:
        try:
            return get_universe(mode)
        except Exception:
            pass
            
    _HARDCODED_INDICES = {
        "idx_bumn": ["ADHI", "ANTM", "BBNI", "BBRI", "BBTN", "BMRI", "BRIS", "ELSA", "JSMR", "MTEL", "PGAS", "PGEO", "PTBA", "PTPP", "SMGR", "TINS", "TLKM", "WIKA", "WSKT"],
        "idx_high_dividend": ["ADRO", "AMRT", "ANTM", "ASII", "BBNI", "BBRI", "BBCA", "BMRI", "BNGA", "BRPT", "EXCL", "HEXA", "HMSP", "INDF", "ITMG", "KLBF", "PTBA", "TLKM", "UNTR"],
        "esg_kehati": ["AALI", "ADHI", "ASII", "BBCA", "BBNI", "BBRI", "BBTN", "BMRI", "BSDE", "INDF", "JSMR", "KLBF", "PGAS", "PTBA", "SMGR", "TLKM", "UNTR", "UNVR", "WIKA"],
        "bisnis-27": ["ADRO", "AKRA", "AMRT", "ANTM", "ASII", "BBCA", "BBNI", "BBRI", "BMRI", "BRPT", "CPIN", "CTRA", "EXCL", "INKP", "ITMG", "JSMR", "KLBF", "MAPI", "MIKA", "PGAS", "PTBA", "SMGR", "TLKM", "TOWR", "UNTR"],
        "idx_smc": ["ABMM", "ACES", "AGII", "AKRA", "AMFG", "ARNA", "ASSA", "AUTO", "BIRD", "BNGA", "BSDE", "CLEO", "CTRA", "DRMA", "DSNG", "ELSA", "ENRG", "ESSA", "HEAL", "HRUM", "IMAS", "INDY", "JPFA", "KEEN", "LSIP", "MARK", "MBAP", "MCOL", "MEDC", "MIKA", "MYOR", "NISP", "PANR", "PNLF", "PTRO", "RAJA", "SGER", "SIDO", "SMSM", "SSIA", "TAPG", "TOTL"],
        "idxenergy": ["ADMR", "ADRO", "AKRA", "APEX", "BIPI", "BUMI", "BYAN", "CUAN", "DEWA", "DOID", "DSSA", "ELSA", "ENRG", "ESSA", "GEMS", "GTBO", "HRUM", "INDY", "ITMG", "KKGI", "KOPI", "MBAP", "MCOL", "MEDC", "PGAS", "PGEO", "PTBA", "PTRO", "RAJA", "RMKE", "SGER", "SMMT", "TEBE", "TOBA", "WINS"],
        "idxtechno": ["AWAN", "BELI", "BUKA", "DCII", "DIVA", "EDGE", "ELIT", "EMTK", "GOTO", "KCI", "KIOS", "LUCK", "MCAS", "MLPT", "MTDL", "NFCX", "PTSN", "TECH", "TFAS", "WIFI", "ZATA"],
        "idxfinance": ["ADMF", "AGRO", "AMOR", "ARTO", "BBCA", "BBHI", "BBKP", "BBNI", "BBRI", "BBTN", "BDMN", "BFIN", "BJBR", "BJTM", "BMRI", "BNBA", "BNGA", "BNII", "BNLI", "BRIS", "BTPN", "CFIN", "MEGA", "NISP", "NOBU", "PNBN", "PNBS", "PNLF", "POLA", "SDRA"],
        "idxhealth": ["CARE", "DGNS", "HEAL", "IRRA", "KAEF", "KLBF", "MIKA", "OMNI", "PEHA", "PRDA", "RSGK", "SAME", "SIDO", "SILO", "SOHO"],
        "idxpropert": ["APLN", "ASRI", "BAPA", "BEST", "BKSL", "BSDE", "CITY", "CTRA", "DILD", "DMAS", "DUTI", "GWNG", "KIJA", "LPCK", "LPKR", "MDLN", "MTLA", "PWON", "SMRA", "SSIA"],
        "idxinfra": ["ADHI", "BALI", "BICC", "CASS", "CMNP", "EXCL", "FREN", "ISAT", "JSMR", "KEEN", "META", "MTEL", "PGAS", "PORT", "PTPP", "TBAL", "TBIG", "TLKM", "TOWR", "WIKA", "WSKT"],
        "idxindust": ["ASII", "AUTO", "BIMA", "BMSR", "BUDI", "HEXA", "IMAS", "KBLI", "KOBX", "LION", "MARK", "SCCO", "SMSM", "UNTR"],
        "idxbasic": ["ADMG", "AGII", "AMMN", "ANTM", "ARCI", "AVIA", "BRMS", "BRPT", "CPIN", "ESSA", "FASW", "INCO", "INKP", "INTP", "JPFA", "LTLS", "MDKA", "NCKL", "SMCB", "SMGR", "TPIA"],
        "idxcyclic": ["ACES", "AMRT", "AUTO", "CSAP", "ERAA", "LPPF", "MAPI", "MAPA", "MSKY", "RALS"],
        "idxnoncyc": ["AALI", "CINT", "CLEO", "CMRY", "CPIN", "DSNG", "GGRM", "HMSP", "ICBP", "INDF", "JPFA", "KINO", "LSIP", "MAIN", "MYOR", "ROTI", "SSMS", "STTP", "TBLA", "ULTJ", "UNVR"],
        "idxtrans": ["ASSA", "BIRD", "BPTR", "CASS", "CMPP", "GIAA", "HAIS", "HITS", "IPCC", "KJEN", "NELY", "PORT", "PSSI", "SAPX", "TMAS", "TRUK"]
    }
    
    if mode in _HARDCODED_INDICES:
        return sorted(list(set(_HARDCODED_INDICES[mode])))
        
    return ["ANTM", "BBCA", "BBRI", "BMRI", "GOTO", "TLKM"]

_SCREENER_CACHE = {}

@router.get("/screener-v2")
def smart_screener(
    universe_mode: str = "lq45",
    analysis_date: str = None,
    window_days: int = 20,
    tickers: str = None  # <--- Parameter baru untuk menerima string "BBNI,BBCA,AADI" dari frontend
):
    import time as _time
    import pandas as pd
    from idx_bandarmology import analysis, storage

    # --- PERBARUI CACHE KEY: Tambahkan {tickers} agar cache tidak tertukar ---
    cache_key = f"screener|{universe_mode}|{analysis_date}|{window_days}|{tickers}"
    now = _time.time()

    if cache_key in _SCREENER_CACHE and (now - _SCREENER_CACHE[cache_key]['ts'] < 300):
        return _SCREENER_CACHE[cache_key]['data']

    # --- LOGIKA PENYARINGAN CERDAS ---
    if tickers:
        # Jika ada kiriman "BBNI,BBCA" dari frontend, pecah jadi list dan timpa variabel tickers
        tickers = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    else:
        # Jika kosong (mode normal), gunakan bawaan database
        tickers = get_dynamic_universe(universe_mode)

    if not tickers:
        return {"data": [], "meta": {}}
        
    analysis_ts = pd.Timestamp(analysis_date) if analysis_date else pd.Timestamp.today()
    window_start = analysis_ts - pd.Timedelta(days=window_days)
    
    try:
        scan_10d = analysis.broker_alpha_scan(
            tickers, horizon=10, min_events=5, min_net_value=0,
            group_by=("ticker", "broker_code")
        )
    except Exception:
        scan_10d = pd.DataFrame()
        
    results = []
    
    for ticker in tickers[:100]:
        try:
            try:
                df_flow_full = storage.read_broker_flow([ticker])
            except Exception:
                continue
                
            if df_flow_full.empty:
                continue
                
            df_flow_full = df_flow_full[df_flow_full["date"] <= analysis_ts].sort_values("date")
            if df_flow_full.empty:
                continue
                
            latest_flow = df_flow_full.iloc[-1]
            raw_signal = latest_flow.get("bandar_signal", "NEUTRAL")
            signal = str(raw_signal).replace("_", " ").title() if pd.notna(raw_signal) else "Neutral"
            if signal.upper() == "NET_BUY": signal = "Net Buy"
            elif signal.upper() == "NET_SELL": signal = "Net Sell"
            
            foreign_5d = float(df_flow_full.tail(5)["foreign_net_broker"].fillna(0).sum())
            
            raw_date = latest_flow.get("date")
            data_date_str = str(pd.Timestamp(raw_date).date()) if pd.notna(raw_date) else str(analysis_ts.date())
            
            try:
                conv_data = _conviction_score(raw_signal, foreign_5d, scan_10d, ticker)
                final_score = float(conv_data.get("score", 0.0))
            except Exception:
                final_score = 50.0

            df_smart = analysis.smart_money_daily_flow(ticker, lookback_days=window_days)
            total_net_val = df_smart['smart_net'].sum() if (isinstance(df_smart, pd.DataFrame) and not df_smart.empty and 'smart_net' in df_smart.columns) else 0.0

            top_b, top_s = analysis.top_net_broker_summary(ticker, top_n=150)
            buyer_codes = []
            bandar_avg, market_val, market_lot = 0.0, 0.0, 0.0
            
            if isinstance(top_b, pd.DataFrame) and not top_b.empty:
                if 'broker_code' in top_b.columns: buyer_codes = top_b['broker_code'].tolist()
                if 'buy_value' in top_b.columns and 'buy_lot' in top_b.columns:
                    b_val, b_lot = top_b['buy_value'].head(5).sum(), top_b['buy_lot'].head(5).sum()
                    if b_lot > 0: bandar_avg = b_val / (b_lot * 100)
                    market_val += top_b['buy_value'].sum() + top_b.get('sell_value', pd.Series([0])).sum()
                    market_lot += top_b['buy_lot'].sum() + top_b.get('sell_lot', pd.Series([0])).sum()
                        
            if isinstance(top_s, pd.DataFrame) and not top_s.empty:
                if 'buy_value' in top_s.columns and 'buy_lot' in top_s.columns:
                    market_val += top_s['buy_value'].sum() + top_s.get('sell_value', pd.Series([0])).sum()
                    market_lot += top_s['buy_lot'].sum() + top_s.get('sell_lot', pd.Series([0])).sum()
            
            curr_price = (market_val / (market_lot * 100)) if market_lot > 0 else 0.0
            total_value = float(latest_flow.get("total_value", 0.0))
            
            results.append({
                "ticker": ticker,
                "signal": signal,
                "conviction_score": final_score,
                "foreign_net": foreign_5d,
                "net_value": float(total_net_val),
                "bandar_avg_price": float(bandar_avg),
                "total_value": total_value, 
                "current_price": float(curr_price),
                "top_buyer": str(buyer_codes[0]) if buyer_codes else "-",
                "data_date": data_date_str 
            })
                
        except Exception:
            continue
            
    results = sorted(results, key=lambda x: x["conviction_score"], reverse=True)
    
    output = {
        "data": results,
        "meta": {
            "window_start": str(window_start.date()),
            "analysis_date": str(analysis_ts.date())
        }
    }
    _SCREENER_CACHE[cache_key] = {"ts": now, "data": output}
    
    return output


@router.get("/stocks/{ticker}/raw-tables")
def get_raw_tables(ticker: str, analysis_date: str = None, window_days: int = 20):
    import pandas as pd
    from idx_bandarmology import storage
    
    ticker = ticker.upper()
    analysis_ts = pd.Timestamp(analysis_date) if analysis_date else pd.Timestamp.today()
    window_start = analysis_ts - pd.Timedelta(days=window_days)
    
    def _clean_date(d):
        return str(pd.Timestamp(d).date()) if pd.notna(d) else "-"

    flow_list = []
    try:
        flow_df = storage.read_broker_flow([ticker])
        flow_df = flow_df[(flow_df["date"] >= window_start) & (flow_df["date"] <= analysis_ts)].sort_values("date", ascending=False)
        for _, r in flow_df.iterrows():
            signal = str(r.get("bandar_signal", "NEUTRAL")).replace("_", " ").title()
            if signal.upper() == "NET BUY": signal = "Net Buy"
            if signal.upper() == "NET SELL": signal = "Net Sell"
            
            flow_list.append({
                "date": _clean_date(r.get("date")),
                "signal": signal,
                "score": float(r.get("bandar_signal_score", 0)),
                "foreign_net": float(r.get("foreign_net_broker", 0)),
                "local_net": float(r.get("local_net_broker", 0)),
                "total_value": float(r.get("total_value", 0))
            })
    except Exception:
        pass
        
    act_list = []
    try:
        act_df = storage.read_broker_activity([ticker])
        act_df = act_df[(act_df["date"] >= window_start) & (act_df["date"] <= analysis_ts)].copy()
        
        act_df["_gross"] = act_df["buy_value"].fillna(0) + act_df["sell_value"].fillna(0)
        act_df = act_df.sort_values(["date", "_gross"], ascending=[False, False])
        
        for _, r in act_df.iterrows():
            ptype = str(r.get("participant_type", ""))
            type_label = "FOREIGN" if ptype == "Asing" else "LOCAL" if ptype == "Lokal" else "GOV" if ptype == "Pemerintah" else ptype.upper()
            
            act_list.append({
                "date": _clean_date(r.get("date")),
                "broker": str(r.get("broker_code", "")),
                "type": type_label,
                "buy": float(r.get("buy_value", 0)),
                "sell": float(r.get("sell_value", 0)),
                "net": float(r.get("net_value", 0)),
                "freq": int(r.get("frequency", 0))
            })
    except Exception:
        pass
        
    return {"flow": flow_list, "activity": act_list}
