from fastapi import APIRouter
from typing import Optional
import pandas as pd
import time
from idx_bandarmology import storage, analysis
from app.services.analysis_service import safe_val, df_to_records
import math

router = APIRouter(tags=["Broker Flow"])

def _participant_label(value):
    return {"Asing": "FOREIGN", "Lokal": "LOCAL", "Pemerintah": "GOV"}.get(str(value), str(value or "-"))

def _broker_compare_data(activity, broker_codes, mode):
    if activity.empty or not broker_codes: return []
    sub = activity[activity["broker_code"].isin(broker_codes)].copy()
    if sub.empty: return []
    pivot = sub.pivot_table(index="date", columns="broker_code", values="net_value", aggfunc="sum").sort_index()
    if mode == "Cumulative": pivot = pivot.cumsum()
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
    if dist.empty: return {"buyers": [], "sellers": [], "edges": []}
    dist = dist.groupby(["broker_code", "participant_type"], dropna=False).agg(buy_value=("buy_value", "sum"), sell_value=("sell_value", "sum"), net_value=("net_value", "sum"), frequency=("frequency", "sum"), buy_lot=("buy_lot", "sum"), sell_lot=("sell_lot", "sum"), buy_avg_price=("buy_avg_price", "mean"), sell_avg_price=("sell_avg_price", "mean")).reset_index()
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
            if seller_left <= 1e-9: seller_idx += 1; continue
            matched = min(buyer_left, seller_left)
            edges.append({"buyer_code": str(buyer_rows.loc[buyer_i, "broker_code"]), "buyer_type": _participant_label(buyer_rows.loc[buyer_i, "participant_type"]), "seller_code": str(seller_rows.loc[seller_idx, "broker_code"]), "seller_type": _participant_label(seller_rows.loc[seller_idx, "participant_type"]), "matched_value": float(matched)})
            buyer_left -= matched
            seller_rows.loc[seller_idx, "remaining"] = seller_left - matched
            if seller_rows.loc[seller_idx, "remaining"] <= 1e-9: seller_idx += 1
        buyer_rows.loc[buyer_i, "remaining"] = buyer_left

    return {
        "buyers": [{"broker": str(r["broker_code"]), "type": _participant_label(r["participant_type"]), "buy_value": float(r["buy_value"]), "sell_value": float(r["sell_value"]), "net_value": float(r["net_value"]), "freq": float(r["frequency"]), "buy_lot": float(r["buy_lot"]) if pd.notna(r["buy_lot"]) else None, "buy_avg": float(r["buy_avg_price"]) if pd.notna(r["buy_avg_price"]) else None} for _, r in buyers.head(10).iterrows()],
        "sellers": [{"broker": str(r["broker_code"]), "type": _participant_label(r["participant_type"]), "buy_value": float(r["buy_value"]), "sell_value": float(r["sell_value"]), "net_value": float(r["net_value"]), "freq": float(r["frequency"]), "sell_lot": float(r["sell_lot"]) if pd.notna(r["sell_lot"]) else None, "sell_avg": float(r["sell_avg_price"]) if pd.notna(r["sell_avg_price"]) else None} for _, r in sellers.head(10).iterrows()],
        "edges": edges,
        "dist_date": str(dist_end.date())
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
            row.update({"buy_broker": b["broker"], "buy_type": b["type"], "buy_value": b["buy_value"], "buy_lot": b.get("buy_lot"), "buy_avg": b.get("buy_avg")})
        else:
            row.update({"buy_broker": "", "buy_type": "", "buy_value": None, "buy_lot": None, "buy_avg": None})
        if i < len(sellers):
            s = sellers[i]
            row.update({"sell_broker": s["broker"], "sell_type": s["type"], "sell_value": abs(s["sell_value"]), "sell_lot": s.get("sell_lot"), "sell_avg": s.get("sell_avg")})
        else:
            row.update({"sell_broker": "", "sell_type": "", "sell_value": None, "sell_lot": None, "sell_avg": None})
        rows.append(row)
    return rows

_BROKERFLOW_CACHE = {}

@router.get("/{ticker}/broker_flow")
def broker_flow_detail(
    ticker: str,
    analysis_date: str = None,
    lookback_days: int = 60,
    broker_codes: str = "",
    flow_mode: str = "Cumulative",
    dist_mode: Optional[str] = None,
    dist_date: Optional[str] = None,
    dist_start: Optional[str] = None,
    dist_end: Optional[str] = None
):
    ticker = ticker.upper().strip()
    activity_df = storage.read_broker_activity([ticker]).copy()
    if activity_df.empty: return {"error": "No broker history for " + ticker}

    if analysis_date:
        analysis_ts = pd.Timestamp(analysis_date)
    else:
        dates = sorted(activity_df[activity_df["ticker"] == ticker]["date"].dt.date.unique().tolist())
        analysis_ts = pd.Timestamp(max(dates)) if dates else pd.Timestamp.now()

    cache_key = f"{ticker}|{analysis_ts.date()}|{lookback_days}|{broker_codes}|{flow_mode}|{dist_mode}|{dist_start}|{dist_end}"
    now = time.time()
    cached = _BROKERFLOW_CACHE.get(cache_key)
    if cached is not None and (now - cached["ts"]) < 300:
        return cached["data"]

    window_start = analysis_ts - pd.Timedelta(days=lookback_days)
    activity_window = activity_df[(activity_df["date"] >= window_start) & (activity_df["date"] <= analysis_ts)].copy()
    if activity_window.empty: return {"error": "No activity in window"}

    all_codes = sorted(activity_window["broker_code"].dropna().unique().tolist())
    ranked = activity_window.assign(abs_net=activity_window["net_value"].abs()).groupby("broker_code")["abs_net"].sum().sort_values(ascending=False).index.tolist()

    selected = [c.strip() for c in broker_codes.split(",") if c.strip()] if broker_codes else ranked[:3]
    if not selected and ranked: selected = ranked[:3]

    compare_data = _broker_compare_data(activity_window, selected, flow_mode)

    def _parse_ts(d_str, fallback):
        if not d_str or d_str in ("undefined", "null", ""): return fallback
        try: return pd.Timestamp(d_str)
        except: return fallback

    if dist_mode == "Single day":
        dist_start_ts = _parse_ts(dist_date, analysis_ts)
        dist_end_ts = _parse_ts(dist_date, analysis_ts)
    elif dist_mode == "Date range":
        dist_start_ts = _parse_ts(dist_start, window_start)
        dist_end_ts = _parse_ts(dist_end, analysis_ts)
    else:
        dist_start_ts = window_start
        dist_end_ts = analysis_ts

    dist_data = _broker_distribution_data(activity_df, dist_start_ts, dist_end_ts)
    summary = _broker_summary_table(dist_data)

    detail_rows = []
    if not activity_window.empty:
        grouped = activity_window.groupby(["broker_code", "participant_type"], dropna=False).agg(buy=("buy_value", "sum"), sell=("sell_value", "sum"), net=("net_value", "sum"), freq=("frequency", "sum")).reset_index()
        for _, row in grouped.iterrows():
            detail_rows.append({"broker": str(row["broker_code"]), "type": _participant_label(row["participant_type"]), "buy": float(row["buy"]), "sell": float(row["sell"]), "net": float(row["net"]), "freq": float(row["freq"])})
        detail_rows = sorted(detail_rows, key=lambda x: abs(x["net"]), reverse=True)

    PROFILE_META = {"smart_foreign": ("Foreign Smart Money", "Directional foreign institutions"), "local_institutional": ("Local Institutions", "Local institution-like accounts"), "market_maker": ("Market Makers", "Active on both sides; net position matters"), "bandar_gorengan": ("Speculative Operators", "Speculative operator profile"), "retail": ("Retail-Dominant", "Retail-heavy platforms"), "lainnya": ("Other Brokers", "Outside defined behavioral profiles")}
    SMART_PROFILES = {"smart_foreign", "local_institutional"}
    
    profile_df = pd.DataFrame()
    if not activity_window.empty:
        df = activity_window.copy()
        df["profile"] = df["broker_code"].map(analysis.broker_profile_of)
        broker_rows = df.groupby(["profile", "broker_code", "participant_type"], dropna=False).agg(net=("net_value", "sum"), buy=("buy_value", "sum"), sell=("sell_value", "sum")).reset_index()
        rows = []
        for profile, (label, desc) in PROFILE_META.items():
            members = broker_rows[broker_rows["profile"] == profile].copy()
            if members.empty: continue
            members["abs_net"] = members["net"].abs()
            rows.append({"profile": profile, "label": label, "description": desc, "net": float(members["net"].sum()), "top_brokers": members.sort_values("abs_net", ascending=False).head(6)[["broker_code", "participant_type", "net"]].to_dict("records")})
        profile_df = pd.DataFrame(rows)

    profile_rows = []
    if not profile_df.empty:
        for _, row in profile_df.iterrows():
            profile_rows.append({"profile": row["profile"], "label": row["label"], "description": row["description"], "net": float(row["net"]), "top_brokers": row["top_brokers"]})

    profile_detail_rows = []
    if not activity_window.empty:
        df = activity_window.copy()
        df["profile"] = df["broker_code"].map(analysis.broker_profile_of)
        grouped = df.groupby(["profile", "broker_code", "participant_type"], dropna=False).agg(buy=("buy_value", "sum"), sell=("sell_value", "sum"), net=("net_value", "sum"), freq=("frequency", "sum"), days=("date", "nunique")).reset_index()
        grouped["profile_label"] = grouped["profile"].map(lambda key: PROFILE_META.get(key, (key, ""))[0])
        grouped["type_label"] = grouped["participant_type"].map(lambda v: _participant_label(v))
        grouped["avg_value_tx"] = grouped.apply(lambda r: abs(float(r["net"] or 0)) / max(float(r["freq"] or 0), 1), axis=1)
        grouped = grouped.sort_values(["profile", "net"], ascending=[True, False])
        for _, row in grouped.iterrows():
            profile_detail_rows.append({"profile": str(row["profile_label"]), "profile_key": str(row["profile"]), "broker": str(row["broker_code"]), "type": str(row["type_label"]), "buy": float(row["buy"]), "sell": float(row["sell"]), "net": float(row["net"]), "freq": float(row["freq"]), "days": int(row["days"]), "avg_value_tx": float(row["avg_value_tx"])})

    result = {
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
        "dist_start": str(dist_start_ts.date()),
        "dist_end": str(dist_end_ts.date())
    }

    _BROKERFLOW_CACHE[cache_key] = {"ts": now, "data": result}
    return result
