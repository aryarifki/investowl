"""Bandarmology domain services and business computations.

Extracts data calculations, greedy counterparty matching, profiling,
and caching logic from the API router into modular, testable service functions.
"""
from __future__ import annotations

import math
from collections import Counter
from datetime import datetime, date
from typing import Any, Optional

import numpy as np
import pandas as pd
from core.cache import TTLCache
from idx_bandarmology import analysis, storage, universe

# ── Bounded In-Memory Caches (LRU + TTL to protect constrained VPS RAM) ──
summary_cache = TTLCache(maxsize=32, ttl_seconds=300.0)
detail_cache = TTLCache(maxsize=128, ttl_seconds=300.0)
brokerflow_cache = TTLCache(maxsize=128, ttl_seconds=300.0)
screener_cache = TTLCache(maxsize=32, ttl_seconds=300.0)


# ── Data Sanitization Helpers ──
def clean_data(obj: Any) -> Any:
    """Recursively converts NaN/Inf and numpy scalars to valid native JSON values."""
    if isinstance(obj, dict):
        return {k: clean_data(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_data(v) for v in obj]
    if hasattr(obj, "item"):
        val = obj.item()
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if pd.isna(obj):
        return None
    return obj


def clean_detail(obj: Any) -> Any:
    """Specialized deep cleaner for detail/brokerflow payloads."""
    if isinstance(obj, dict):
        return {k: clean_detail(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_detail(v) for v in obj]
    if hasattr(obj, "item"):
        return obj.item()
    if isinstance(obj, float) and (pd.isna(obj) or np.isinf(obj)):
        return None
    return obj


# ── Label & Format Helpers ──
def fmt_signal(value: Any) -> str:
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


def participant_label(value: Any) -> str:
    return {"Asing": "FOREIGN", "Lokal": "LOCAL", "Pemerintah": "GOV"}.get(
        str(value), str(value or "-")
    )


def broker_subtype(row: Any) -> str:
    """Classifies foreign brokers into Institutional, Speculative, or Mixed based on ticket size and frequency."""
    if hasattr(row, "get"):
        p_type = row.get("participant_type") or row.get("Type") or row.get("type")
        net = abs(float(row.get("net_value") or row.get("Net") or row.get("net") or 0))
        freq = max(float(row.get("frequency") or row.get("Freq") or row.get("freq") or 0), 1)
    else:
        p_type = getattr(row, "participant_type", getattr(row, "Type", getattr(row, "type", None)))
        net = abs(float(getattr(row, "net_value", getattr(row, "Net", getattr(row, "net", 0))) or 0))
        freq = max(float(getattr(row, "frequency", getattr(row, "Freq", getattr(row, "freq", 0))) or 0), 1)

    if participant_label(p_type) != "FOREIGN":
        return "-"
    avg_value = net / freq
    if avg_value >= 500_000_000 or (net >= 5_000_000_000 and freq <= 500):
        return "Institutional"
    if freq >= 2_000 or avg_value <= 100_000_000:
        return "Speculative"
    return "Mixed"


ACC_SIGNALS = {"STRONG_ACCUMULATION", "ACCUMULATION", "NET_BUY", "AKUMULASI_KUAT", "AKUMULASI"}
DIST_SIGNALS = {"STRONG_DISTRIBUTION", "DISTRIBUTION", "NET_SELL", "DISTRIBUSI_KUAT", "DISTRIBUSI"}
SMART_PROFILES = {"smart_foreign", "local_institutional"}


def price_at_or_before(price_df: pd.DataFrame, ts: pd.Timestamp):
    sub = price_df[price_df["date"] <= ts].sort_values("date")
    return None if sub.empty else sub.iloc[-1]


def return_to_date(price_df: pd.DataFrame, ts: pd.Timestamp, periods: int) -> Optional[float]:
    sub = price_df[price_df["date"] <= ts].sort_values("date")
    if len(sub) <= periods:
        return None
    latest = float(sub.iloc[-1]["close"])
    base = float(sub.iloc[-periods - 1]["close"])
    return (latest / base - 1) if base else None


def flow_row_at(flow_df: pd.DataFrame, ticker: str, ts: pd.Timestamp) -> dict:
    sub = flow_df[(flow_df["ticker"] == ticker) & (flow_df["date"] <= ts)].sort_values("date")
    return {} if sub.empty else sub.iloc[-1].to_dict()


def latest_activity_date(activity_df: pd.DataFrame, ticker: str, ts: pd.Timestamp) -> Optional[pd.Timestamp]:
    sub = activity_df[(activity_df["ticker"] == ticker) & (activity_df["date"] <= ts)]
    if sub.empty:
        return None
    return pd.Timestamp(sub["date"].max())


def label_component(signal: Any) -> float:
    raw = str(signal or "").upper()
    if raw in {"AKUMULASI_KUAT", "STRONG_ACCUMULATION"}:
        return 100
    if raw in {"AKUMULASI", "ACCUMULATION", "NET_BUY"}:
        return 80
    if raw in {"NETRAL", "NEUTRAL"}:
        return 50
    if raw in {"DISTRIBUSI", "DISTRIBUTION", "NET_SELL"}:
        return 25
    if raw in {"DISTRIBUSI_KUAT", "STRONG_DISTRIBUTION"}:
        return 0
    return 40


def p_value_component(p_value: Any) -> float:
    if p_value is None or pd.isna(p_value):
        return 50
    if p_value <= 0.01:
        return 100
    if p_value <= 0.05:
        return 80
    if p_value <= 0.10:
        return 55
    return 20


def foreign_component(value: Any) -> float:
    if value is None or pd.isna(value):
        return 50
    if value > 0:
        return 100
    if value < 0:
        return 0
    return 50


def broker_win_component(scan_df: pd.DataFrame, ticker: str) -> tuple[float, str]:
    if scan_df.empty:
        return 50, "No broker validation sample"
    sub = (
        scan_df[scan_df["ticker"] == ticker].copy()
        if "ticker" in scan_df.columns
        else scan_df.copy()
    )
    if sub.empty:
        return 50, "No broker validation sample"
    sub = sub.sort_values(
        ["significant", "p_value_one_sided", "mean_fwd_return"],
        ascending=[False, True, False],
    )
    row = sub.iloc[0]
    win_rate = float(row.get("win_rate", 0.5))
    return (
        max(0, min(100, win_rate * 100)),
        str(row.get("broker_code", "-")) + " win rate " + "{:.0%}".format(win_rate),
    )


def conviction_score(
    signal: Any, foreign_5d: float, scan_df: pd.DataFrame, ticker: str
) -> dict:
    try:
        causality = analysis.causality_foreign_vs_price(ticker, max_lags=5)
    except Exception:
        causality = None
    p_value = None if not causality else float(causality.get("min_p_value", np.nan))
    p_score = p_value_component(p_value)
    s_score = label_component(signal)
    f_score = foreign_component(foreign_5d)
    w_score, w_note = broker_win_component(scan_df, ticker)
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


def contradiction_alerts(
    signal: Any,
    ret_5d: Optional[float],
    ret_10d: Optional[float],
    foreign_5d: Optional[float],
    smart_cum: Optional[float],
) -> list[str]:
    raw = str(signal or "").upper()
    alerts = []
    if raw in DIST_SIGNALS and (
        (ret_5d is not None and ret_5d > 0) or (ret_10d is not None and ret_10d > 0)
    ):
        alerts.append(
            "Distribution while price is still rising — potential unfinished distribution or new buyer absorption. Monitor volume."
        )
    if raw in ACC_SIGNALS and ret_5d is not None and ret_5d < 0:
        alerts.append(
            "Accumulation signal with negative 5D return — accumulation may be early, failed, or absorbed by larger supply."
        )
    if foreign_5d is not None and foreign_5d < 0 and raw in ACC_SIGNALS:
        alerts.append(
            "Aggregate accumulation conflicts with foreign net selling — check whether the move is driven by local brokers."
        )
    if smart_cum is not None and smart_cum < 0 and raw in ACC_SIGNALS:
        alerts.append(
            "Signal is accumulation but smart-money cumulative flow is negative in the selected window."
        )
    return alerts


def smart_daily_from_activity(activity: pd.DataFrame) -> pd.DataFrame:
    if activity.empty:
        return pd.DataFrame()
    df = activity.copy()
    df["profile"] = df["broker_code"].map(analysis.broker_profile_of)
    df = df[df["profile"].isin(SMART_PROFILES)]
    if df.empty:
        return pd.DataFrame()
    daily = (
        df.groupby("date")["net_value"]
        .sum()
        .reset_index(name="smart_net")
        .sort_values("date")
    )
    daily["cumulative_net"] = daily["smart_net"].cumsum()
    return daily


def profile_flow_from_activity(activity: pd.DataFrame) -> pd.DataFrame:
    if activity.empty:
        return pd.DataFrame()
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
        if members.empty:
            continue
        members["abs_net"] = members["net"].abs()
        rows.append({
            "profile": profile,
            "label": label,
            "description": desc,
            "net": float(members["net"].sum()),
            "top_brokers": members.sort_values("abs_net", ascending=False)
            .head(6)[["broker_code", "participant_type", "net"]]
            .to_dict("records"),
        })
    return pd.DataFrame(rows)


def profile_broker_detail_table(
    activity: pd.DataFrame, profile_key: Optional[str] = None
) -> list[dict]:
    if activity.empty:
        return []
    df = activity.copy()
    df["profile"] = df["broker_code"].map(analysis.broker_profile_of)
    if profile_key:
        df = df[df["profile"] == profile_key]
    if df.empty:
        return []
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
    grouped["profile_label"] = grouped["profile"].map(
        lambda key: PROFILE_META.get(key, (key, ""))[0]
    )
    grouped["type_label"] = grouped["participant_type"].map(
        lambda v: {"Asing": "FOREIGN", "Lokal": "LOCAL", "Pemerintah": "GOV"}.get(
            str(v), str(v or "-")
        )
    )
    grouped["avg_value_tx"] = grouped.apply(
        lambda r: abs(float(r["net"] or 0)) / max(float(r["freq"] or 0), 1), axis=1
    )
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


# ── Greedy Counterparty Matching Algorithm ──
def broker_distribution_data_range(
    activity: pd.DataFrame, dist_start: Any, dist_end: Any
) -> dict:
    """Greedy matching algorithm connecting buyers and sellers for distribution visualization."""
    if activity.empty:
        return {"buyers": [], "sellers": [], "edges": []}

    df = activity.copy()
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
                "buyer_type": participant_label(buyer_rows.loc[buyer_i, "participant_type"]),
                "seller_code": str(seller_rows.loc[seller_idx, "broker_code"]),
                "seller_type": participant_label(seller_rows.loc[seller_idx, "participant_type"]),
                "matched_value": float(matched),
            })
            buyer_left -= matched
            seller_rows.loc[seller_idx, "remaining"] = seller_left - matched
            if seller_rows.loc[seller_idx, "remaining"] <= 1e-9:
                seller_idx += 1
        buyer_rows.loc[buyer_i, "remaining"] = buyer_left

    result = {
        "buyers": [
            {
                "broker": str(row["broker_code"]),
                "type": participant_label(row["participant_type"]),
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
                "type": participant_label(row["participant_type"]),
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
    }
    if hasattr(start_ts, "date") and hasattr(end_ts, "date"):
        result["dist_start"] = str(start_ts.date())
        result["dist_end"] = str(end_ts.date())
    return result


def broker_summary_table(dist_data: dict) -> list[dict]:
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
                "sell_value": s["sell_value"],
                "sell_lot": s.get("sell_lot"),
                "sell_avg": s.get("sell_avg"),
            })
        else:
            row.update({"sell_broker": "", "sell_type": "", "sell_value": None, "sell_lot": None, "sell_avg": None})
        rows.append(row)
    return rows


def broker_compare_data(
    activity_df: pd.DataFrame, selected_codes: list[str], flow_mode: str = "both"
) -> list[dict]:
    if activity_df.empty or not selected_codes:
        return []
    sub = activity_df[activity_df["broker_code"].isin(selected_codes)].copy()
    if sub.empty:
        return []

    piv = (
        sub.groupby(["date", "broker_code"])["net_value"]
        .sum()
        .unstack(fill_value=0)
        .sort_index()
    )
    cum = piv.cumsum()

    result = []
    for dt, row in cum.iterrows():
        item = {"date": str(pd.Timestamp(dt).date())}
        for code in selected_codes:
            item[code] = float(row.get(code, 0.0))
        result.append(item)
    return result


def signal_overlay(flow_df: pd.DataFrame, price_df: pd.DataFrame, window_days: int = 20) -> list[dict]:
    if flow_df.empty or price_df.empty:
        return []
    merged = pd.merge(
        price_df[["date", "close", "high", "low", "open", "volume"]],
        flow_df[["date", "bandar_signal", "bandar_signal_score", "foreign_net_broker"]],
        on="date",
        how="inner",
    ).sort_values("date")
    if merged.empty:
        return []
    merged = merged.tail(window_days)
    rows = []
    for _, r in merged.iterrows():
        rows.append({
            "date": str(pd.Timestamp(r["date"]).date()),
            "close": float(r["close"]) if pd.notna(r["close"]) else None,
            "open": float(r["open"]) if pd.notna(r["open"]) else None,
            "high": float(r["high"]) if pd.notna(r["high"]) else None,
            "low": float(r["low"]) if pd.notna(r["low"]) else None,
            "volume": int(r["volume"]) if pd.notna(r["volume"]) else None,
            "signal": r.get("bandar_signal"),
            "signal_score": float(r.get("bandar_signal_score")) if pd.notna(r.get("bandar_signal_score")) else None,
            "foreign_net_broker": float(r.get("foreign_net_broker")) if pd.notna(r.get("foreign_net_broker")) else None,
        })
    return rows


# ── High-Performance Service Workflows ──

def get_dynamic_universe(mode: str) -> list[str]:
    """Retrieve universe tickers dynamically."""
    try:
        from idx_bandarmology.universe import get_universe
        tickers = get_universe(mode=mode)
        if tickers:
            return tickers
    except Exception:
        pass
    fallback_map = {
        "idx30": ["BBCA", "BBRI", "BMRI", "BBNI", "ASII", "TLKM", "AMMN", "BREN", "ADRO", "ICBP"],
        "watchlist": ["BBCA", "BBRI", "BMRI", "BBNI", "ASII", "TLKM", "AMMN", "BREN", "ADRO", "ICBP"],
    }
    return fallback_map.get(mode, ["BBCA", "BBRI", "BMRI", "BBNI", "ASII", "TLKM"])


def compute_daily_summary(universe_mode: str = "all", refresh: int = 0) -> dict:
    """Computes daily market overview with bounded cache and 90-day SQL date pushdown."""
    cache_key = universe_mode
    if not refresh:
        cached = summary_cache.get(cache_key)
        if cached is not None:
            return cached

    tickers = get_dynamic_universe(universe_mode)
    cutoff = (pd.Timestamp.now() - pd.Timedelta(days=90)).strftime("%Y-%m-%d")

    price_df = storage.read_prices(tickers, start_date=cutoff)
    flow_df = storage.read_broker_flow(tickers, start_date=cutoff)

    items = []
    if not flow_df.empty:
        flow_df = flow_df.sort_values("date")
        for t, fsub in flow_df.groupby("ticker"):
            try:
                last = fsub.iloc[-1]
                psub = (
                    price_df[price_df["ticker"] == t]
                    if not price_df.empty
                    else fsub.iloc[0:0]
                )
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

                signal_score = last.get("bandar_signal_score")
                if hasattr(signal_score, "item"):
                    signal_score = signal_score.item()
                elif pd.isna(signal_score):
                    signal_score = None
                else:
                    signal_score = int(signal_score)

                items.append({
                    "ticker": t,
                    "date": str(last["date"]),
                    "signal": last.get("bandar_signal"),
                    "signal_score": signal_score,
                    "close": float(psub.iloc[-1]["close"]) if len(psub) else None,
                    "ret_5d": ret_5d,
                    "foreign_net_5d": f5,
                    "spark": [float(x) for x in psub.tail(30)["close"]],
                })
            except Exception:
                continue

    counts = Counter((i["signal"] or "NETRAL").upper() for i in items)
    top = sorted(items, key=lambda x: (x["signal_score"] or 0), reverse=True)[:5]

    result = clean_data({
        "as_of": max((i["date"] for i in items), default=None),
        "signal_counts": dict(counts),
        "items": items,
        "top_conviction": top,
    })

    summary_cache.set(cache_key, result)
    return result
