import sys
from pathlib import Path
import pandas as pd
import numpy as np
import math

_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_ROOT / "src"))

from idx_bandarmology import analysis, broker_api, storage

# --- Constants ---
PROFILE_META = {
    "smart_foreign": ("Foreign Smart Money", "Directional foreign institutions"),
    "local_institutional": ("Local Institutions", "Local institution-like accounts"),
    "market_maker": ("Market Makers", "Active on both sides; net position matters"),
    "bandar_gorengan": ("Speculative Operators", "Speculative operator profile"),
    "retail": ("Retail-Dominant", "Retail-heavy platforms"),
    "lainnya": ("Other Brokers", "Outside defined behavioral profiles"),
}
SMART_PROFILES = {"smart_foreign", "local_institutional"}
ACC_SIGNALS = {"STRONG_ACCUMULATION", "ACCUMULATION", "NET_BUY", "AKUMULASI_KUAT", "AKUMULASI"}
DIST_SIGNALS = {"STRONG_DISTRIBUTION", "DISTRIBUTION", "NET_SELL", "DISTRIBUSI_KUAT", "DISTRIBUSI"}

# --- JSON & DataFrame Helpers ---
def safe_val(v):
    if v is None: return None
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v): return None
        return v
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,)):
        if np.isnan(v) or np.isinf(v): return None
        return float(v)
    if isinstance(v, (pd.Timestamp,)): return v.strftime("%Y-%m-%d")
    if isinstance(v, np.bool_): return bool(v)
    return v

def df_to_records(df: pd.DataFrame) -> list:
    if df is None or df.empty: return []
    df = df.astype(object).where(pd.notnull(df), None)
    return [{k: safe_val(v) for k, v in row.items()} for row in df.to_dict(orient="records")]

# --- Format Helpers ---
def fmt_signal(value: object) -> str:
    if value is None or pd.isna(value): return "-"
    mapping = {
        "AKUMULASI_KUAT": "Strong Accumulation", "AKUMULASI": "Accumulation",
        "DISTRIBUSI_KUAT": "Strong Distribution", "DISTRIBUSI": "Distribution",
        "NETRAL": "Neutral", "STRONG_ACCUMULATION": "Strong Accumulation",
        "ACCUMULATION": "Accumulation", "NET_BUY": "Net Buy",
        "STRONG_DISTRIBUTION": "Strong Distribution", "DISTRIBUTION": "Distribution",
        "NET_SELL": "Net Sell", "NEUTRAL": "Neutral",
    }
    return mapping.get(str(value), str(value).replace("_", " ").title())

def fmt_rp(value: object) -> str:
    if value is None or pd.isna(value): return "-"
    n = float(value)
    sign = "-" if n < 0 else ""
    n = abs(n)
    if n >= 1e12: return f"{sign}Rp {n / 1e12:.2f} T"
    if n >= 1e9: return f"{sign}Rp {n / 1e9:.2f} B"
    if n >= 1e6: return f"{sign}Rp {n / 1e6:.2f} M"
    return f"{sign}Rp {n:,.0f}"

def fmt_pct(value: object) -> str:
    if value is None or pd.isna(value): return "-"
    return f"{float(value):+.2%}"

def participant_label(value: object) -> str:
    return {"Asing": "FOREIGN", "Lokal": "LOCAL", "Pemerintah": "GOV"}.get(str(value), str(value or "-"))

def english_text(value: object) -> object:
    if value is None or pd.isna(value): return value
    mapping = {
        "Asing": "Foreign", "Lokal": "Local", "Pemerintah": "Government",
        "AKUMULASI_KUAT": "Strong Accumulation", "AKUMULASI": "Accumulation",
        "DISTRIBUSI_KUAT": "Strong Distribution", "DISTRIBUSI": "Distribution",
        "NETRAL": "Neutral",
    }
    return mapping.get(str(value), value)

def signed_color(value: float) -> str:
    return "#0f9f6e" if value >= 0 else "#dc3545"

def score_tone(score: float) -> tuple[str, str]:
    if score < 40: return "negative", "#f43f5e"
    if score <= 70: return "warning", "#f59e0b"
    return "positive", "#10b981"

# --- Data Query & Manipulation ---
def price_at_or_before(price_df: pd.DataFrame, ts: pd.Timestamp) -> pd.Series | None:
    sub = price_df[price_df["date"] <= ts].sort_values("date")
    return None if sub.empty else sub.iloc[-1]

def return_to_date(price_df: pd.DataFrame, ts: pd.Timestamp, periods: int) -> float | None:
    sub = price_df[price_df["date"] <= ts].sort_values("date")
    if len(sub) <= periods: return None
    latest = float(sub.iloc[-1]["close"])
    base = float(sub.iloc[-periods - 1]["close"])
    return latest / base - 1 if base else None

def flow_row_at(flow_df: pd.DataFrame, ticker: str, ts: pd.Timestamp) -> dict[str, object]:
    sub = flow_df[(flow_df["ticker"] == ticker) & (flow_df["date"] <= ts)].sort_values("date")
    return {} if sub.empty else sub.iloc[-1].to_dict()

def latest_activity_date(activity_df: pd.DataFrame, ticker: str, ts: pd.Timestamp) -> pd.Timestamp | None:
    sub = activity_df[(activity_df["ticker"] == ticker) & (activity_df["date"] <= ts)]
    if sub.empty: return None
    return pd.Timestamp(sub["date"].max())

def profile_flow_from_activity(activity: pd.DataFrame) -> pd.DataFrame:
    if activity.empty: return pd.DataFrame()
    df = activity.copy()
    df["profile"] = df["broker_code"].map(analysis.broker_profile_of)
    broker_rows = df.groupby(["profile", "broker_code", "participant_type"], dropna=False).agg(net=("net_value", "sum"), buy=("buy_value", "sum"), sell=("sell_value", "sum")).reset_index()
    rows = []
    for profile, (label, desc) in PROFILE_META.items():
        members = broker_rows[broker_rows["profile"] == profile].copy()
        if members.empty: continue
        members["abs_net"] = members["net"].abs()
        rows.append({
            "profile": profile, "label": label, "description": desc,
            "net": float(members["net"].sum()),
            "top_brokers": members.sort_values("abs_net", ascending=False).head(6)[["broker_code", "participant_type", "net"]].to_dict("records")
        })
    return pd.DataFrame(rows)

def smart_daily_from_activity(activity: pd.DataFrame) -> pd.DataFrame:
    if activity.empty: return pd.DataFrame()
    df = activity.copy()
    df["profile"] = df["broker_code"].map(analysis.broker_profile_of)
    df = df[df["profile"].isin(SMART_PROFILES)]
    if df.empty: return pd.DataFrame()
    daily = df.groupby("date")["net_value"].sum().reset_index(name="smart_net").sort_values("date")
    daily["cumulative_net"] = daily["smart_net"].cumsum()
    return daily

def cached_causality(ticker: str) -> dict[str, object] | None:
    return analysis.causality_foreign_vs_price(ticker, max_lags=5)

def cached_broker_scan(tickers: tuple[str, ...], horizon: int, min_events: int, min_net_value: float) -> pd.DataFrame:
    return analysis.broker_alpha_scan(list(tickers), horizon=horizon, min_events=min_events, min_net_value=min_net_value, group_by=("ticker", "broker_code"))

def cached_broker_distribution_api(ticker: str, start_date: pd.Timestamp, end_date: pd.Timestamp) -> dict[str, object]:
    return broker_api.fetch_broker_distribution(ticker, start_date, end_date=end_date)

def sparkline_values(activity: pd.DataFrame, broker_code: str, end_ts: pd.Timestamp, days: int = 5) -> str:
    sub = activity[(activity["broker_code"] == broker_code) & (activity["date"] <= end_ts)].sort_values("date").tail(days)
    if sub.empty: return "-----"
    chars = []
    for value in sub["net_value"].fillna(0):
        chars.append("+" if value > 0 else "-" if value < 0 else "0")
    return "".join(chars)

def top_broker_compact_table(top_buy: pd.DataFrame, top_sell: pd.DataFrame, activity: pd.DataFrame, end_ts: pd.Timestamp) -> pd.DataFrame:
    rows = []
    for side, df in (("Buy", top_buy.head(3)), ("Sell", top_sell.head(3))):
        for row in df.itertuples():
            rows.append({
                "Side": side, "Broker": row.broker_code, "Type": participant_label(row.participant_type),
                "Net on Analysis Date": row.net_value, "5D Flow": sparkline_values(activity, row.broker_code, end_ts)
            })
    return pd.DataFrame(rows)

def profile_compact_table(profile_df: pd.DataFrame) -> pd.DataFrame:
    if profile_df.empty: return pd.DataFrame()
    out = profile_df[["label", "net"]].copy()
    out = out.sort_values("net", ascending=False).head(6)
    out = out.rename(columns={"label": "Profile", "net": "Net"})
    return out.reset_index(drop=True)

def profile_broker_detail_table(activity: pd.DataFrame, profile_key: str | None = None) -> pd.DataFrame:
    if activity.empty: return pd.DataFrame()
    df = activity.copy()
    df["Profile Key"] = df["broker_code"].map(analysis.broker_profile_of)
    if profile_key: df = df[df["Profile Key"] == profile_key]
    if df.empty: return pd.DataFrame()
    grouped = df.groupby(["Profile Key", "broker_code", "participant_type"], dropna=False).agg(
        Buy=("buy_value", "sum"), Sell=("sell_value", "sum"), Net=("net_value", "sum"), Freq=("frequency", "sum"), Days=("date", "nunique")
    ).reset_index()
    grouped["Profile"] = grouped["Profile Key"].map(lambda key: PROFILE_META.get(key, (key, ""))[0])
    grouped["Broker"] = grouped["broker_code"]
    grouped["Type"] = grouped["participant_type"].map(participant_label)
    grouped["Avg Value / Tx"] = grouped.apply(lambda r: abs(float(r["Net"] or 0)) / max(float(r["Freq"] or 0), 1), axis=1)
    grouped = grouped.sort_values(["Profile", "Net"], ascending=[True, False])
    return grouped[["Profile", "Broker", "Type", "Buy", "Sell", "Net", "Freq", "Days", "Avg Value / Tx"]].reset_index(drop=True)

def broker_subtype(row: pd.Series) -> str:
    if participant_label(row.get("Type") or row.get("participant_type")) != "FOREIGN": return "-"
    net = abs(float(row.get("Net", row.get("net_value", 0)) or 0))
    freq = max(float(row.get("Freq", row.get("frequency", 0)) or 0), 1)
    avg_value = net / freq
    if avg_value >= 500_000_000 or (net >= 5_000_000_000 and freq <= 500): return "Institutional"
    if freq >= 2_000 or avg_value <= 100_000_000: return "Speculative"
    return "Mixed"

def participant_color(label: str) -> str:
    return {"FOREIGN": "#dc3545", "LOCAL": "#7c3aed", "GOV": "#0f9f6e"}.get(label, "#94a3b8")

def rgba_from_hex(hex_color: str, alpha: float) -> str:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6: return f"rgba(148,163,184,{alpha})"
    r = int(hex_color[0:2], 16); g = int(hex_color[2:4], 16); b = int(hex_color[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"

def estimated_broker_paths(dist: pd.DataFrame, top_n: int = 8) -> pd.DataFrame:
    if dist.empty: return pd.DataFrame()
    buyers = dist[dist["net_value"] > 0].copy().sort_values("net_value", ascending=False).head(top_n)
    sellers = dist[dist["net_value"] < 0].copy().sort_values("net_value", ascending=True).head(top_n)
    if buyers.empty or sellers.empty: return pd.DataFrame()
    buyers["remaining"] = buyers["net_value"].astype(float)
    sellers["remaining"] = sellers["net_value"].abs().astype(float)
    edges = []
    seller_idx = 0
    seller_rows = sellers.reset_index(drop=True)
    buyer_rows = buyers.reset_index(drop=True)
    for buyer_i in range(len(buyer_rows)):
        buyer_left = float(buyer_rows.loc[buyer_i, "remaining"])
        while buyer_left > 1e-9 and seller_idx < len(seller_rows):
            seller_left = float(seller_rows.loc[seller_idx, "remaining"])
            if seller_left <= 1e-9: seller_idx += 1; continue
            matched = min(buyer_left, seller_left)
            edges.append({
                "buyer_code": buyer_rows.loc[buyer_i, "broker_code"], "buyer_type": participant_label(buyer_rows.loc[buyer_i, "participant_type"]),
                "seller_code": seller_rows.loc[seller_idx, "broker_code"], "seller_type": participant_label(seller_rows.loc[seller_idx, "participant_type"]),
                "matched_value": matched
            })
            buyer_left -= matched
            seller_rows.loc[seller_idx, "remaining"] = seller_left - matched
            if seller_rows.loc[seller_idx, "remaining"] <= 1e-9: seller_idx += 1
        buyer_rows.loc[buyer_i, "remaining"] = buyer_left
    return pd.DataFrame(edges)

def exact_broker_paths(distribution_data: dict[str, object], top_n: int = 8) -> pd.DataFrame:
    rows = []
    by_value = (distribution_data or {}).get("by_value") or {}
    for buyer in (by_value.get("top_broker_buy") or [])[:top_n]:
        detail = buyer.get("detail") or {}
        for counterparty in buyer.get("distribute_to") or []:
            rows.append({
                "buyer_code": detail.get("code"), "buyer_type": participant_label(detail.get("type")),
                "seller_code": counterparty.get("code"), "seller_type": participant_label(counterparty.get("type")),
                "matched_value": float(counterparty.get("amount") or 0)
            })
    return pd.DataFrame(rows)

def broker_summary_table(dist: pd.DataFrame, distribution_data: dict[str, object] | None = None, top_n: int = 10) -> pd.DataFrame:
    by_value = (distribution_data or {}).get("by_value") or {}
    if by_value.get("top_broker_buy") or by_value.get("top_broker_sell"):
        buy_rows = by_value.get("top_broker_buy") or []
        sell_rows = by_value.get("top_broker_sell") or []
        rows = []
        max_len = max(len(buy_rows), len(sell_rows), 0)
        for i in range(min(max_len, top_n)):
            row = {}
            if i < len(buy_rows):
                b = buy_rows[i].get("detail") or {}
                row.update({"Buy Broker": b.get("code", ""), "Buy Type": participant_label(b.get("type")), "Buy Value": b.get("amount"), "Buy Lot": np.nan, "Buy Avg": np.nan})
            else: row.update({"Buy Broker": "", "Buy Type": "", "Buy Value": np.nan, "Buy Lot": np.nan, "Buy Avg": np.nan})
            if i < len(sell_rows):
                s = sell_rows[i].get("detail") or {}
                row.update({"Sell Broker": s.get("code", ""), "Sell Type": participant_label(s.get("type")), "Sell Value": s.get("amount"), "Sell Lot": np.nan, "Sell Avg": np.nan})
            else: row.update({"Sell Broker": "", "Sell Type": "", "Sell Value": np.nan, "Sell Lot": np.nan, "Sell Avg": np.nan})
            rows.append(row)
        return pd.DataFrame(rows)
    if dist.empty: return pd.DataFrame()
    buyers = dist[dist["net_value"] > 0].copy().sort_values("net_value", ascending=False).head(top_n).reset_index(drop=True)
    sellers = dist[dist["net_value"] < 0].copy().sort_values("net_value", ascending=True).head(top_n).reset_index(drop=True)
    rows = []
    max_len = max(len(buyers), len(sellers))
    for i in range(max_len):
        row = {}
        if i < len(buyers):
            b = buyers.iloc[i]
            row.update({"Buy Broker": b["broker_code"], "Buy Type": participant_label(b["participant_type"]), "Buy Value": b["buy_value"], "Buy Lot": b["buy_lot"], "Buy Avg": b["buy_avg_price"]})
        else: row.update({"Buy Broker": "", "Buy Type": "", "Buy Value": np.nan, "Buy Lot": np.nan, "Buy Avg": np.nan})
        if i < len(sellers):
            s = sellers.iloc[i]
            row.update({"Sell Broker": s["broker_code"], "Sell Type": participant_label(s["participant_type"]), "Sell Value": s["sell_value"], "Sell Lot": s["sell_lot"], "Sell Avg": s["sell_avg_price"]})
        else: row.update({"Sell Broker": "", "Sell Type": "", "Sell Value": np.nan, "Sell Lot": np.nan, "Sell Avg": np.nan})
        rows.append(row)
    return pd.DataFrame(rows)

def build_screener(watchlist: list[str], as_of: pd.Timestamp, scan_df: pd.DataFrame, all_prices: pd.DataFrame, all_flow: pd.DataFrame, all_activity: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for ticker in watchlist:
        flow_row = flow_row_at(all_flow, ticker, as_of)
        act_date = latest_activity_date(all_activity, ticker, as_of)
        if not flow_row or act_date is None: continue
        px = all_prices[all_prices["ticker"] == ticker]
        flow_sub = all_flow[(all_flow["ticker"] == ticker) & (all_flow["date"] <= as_of)].sort_values("date")
        foreign_5d = float(flow_sub.tail(5)["foreign_net_broker"].fillna(0).sum()) if not flow_sub.empty else np.nan
        buyers, _ = analysis.top_net_broker_summary(ticker, trade_date=act_date, top_n=1)
        top_buyer = "-" if buyers.empty else str(buyers.iloc[0]["broker_code"])
        ret_5d = return_to_date(px, as_of, 5)
        conv = conviction_score(flow_row.get("bandar_signal"), foreign_5d, scan_df, ticker)
        rows.append({
            "Ticker": ticker, "Signal": fmt_signal(flow_row.get("bandar_signal")), "Conviction Score": conv["score"],
            "Foreign Net (5D)": foreign_5d, "Top Buyer": top_buyer, "5D Return": ret_5d, "Data Date": pd.Timestamp(flow_row.get("date")).date()
        })
    if not rows: return pd.DataFrame()
    return pd.DataFrame(rows).sort_values("Conviction Score", ascending=False).reset_index(drop=True)

# --- Kalkulasi Machine Learning & Conviction ---
def label_component(signal: object) -> float:
    raw = str(signal or "").upper()
    if raw in {"AKUMULASI_KUAT", "STRONG_ACCUMULATION"}: return 100
    if raw in {"AKUMULASI", "ACCUMULATION", "NET_BUY"}: return 80
    if raw in {"NETRAL", "NEUTRAL"}: return 50
    if raw in {"DISTRIBUSI", "DISTRIBUTION", "NET_SELL"}: return 25
    if raw in {"DISTRIBUSI_KUAT", "STRONG_DISTRIBUTION"}: return 0
    return 40

def p_value_component(p_value: float | None) -> float:
    if p_value is None or pd.isna(p_value): return 50
    if p_value <= 0.01: return 100
    if p_value <= 0.05: return 80
    if p_value <= 0.10: return 55
    return 20

def foreign_component(value: float | None) -> float:
    if value is None or pd.isna(value): return 50
    if value > 0: return 100
    if value < 0: return 0
    return 50

def broker_win_component(scan_df: pd.DataFrame, ticker: str) -> tuple[float, str]:
    if scan_df.empty: return 50, "No broker validation sample"
    sub = scan_df[scan_df["ticker"] == ticker].copy() if "ticker" in scan_df.columns else scan_df.copy()
    if sub.empty: return 50, "No broker validation sample"
    sub = sub.sort_values(["significant", "p_value_one_sided", "mean_fwd_return"], ascending=[False, True, False])
    row = sub.iloc[0]
    win_rate = float(row.get("win_rate", 0.5))
    return max(0, min(100, win_rate * 100)), f"{row.get('broker_code', '-')} win rate {win_rate:.0%}"

def conviction_score(signal: object, foreign_5d: float | None, scan_df: pd.DataFrame, ticker: str) -> dict[str, object]:
    causality = cached_causality(ticker)
    p_value = None if not causality else float(causality.get("min_p_value", np.nan))
    p_score = p_value_component(p_value)
    s_score = label_component(signal)
    f_score = foreign_component(foreign_5d)
    w_score, w_note = broker_win_component(scan_df, ticker)
    score = (p_score * 0.30) + (s_score * 0.30) + (f_score * 0.20) + (w_score * 0.20)
    return {
        "score": round(float(score), 1), "p_value": p_value,
        "causality_component": p_score, "signal_component": s_score,
        "foreign_component": f_score, "broker_component": w_score, "broker_note": w_note
    }

def contradiction_alerts(signal: object, ret_5d: float | None, ret_10d: float | None, foreign_5d: float | None, smart_cum: float | None) -> list[str]:
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

# ==========================================
# BROKER FLOW FUNCTIONS (untuk tab Broker Flow)
# ==========================================

def estimated_broker_paths(dist: pd.DataFrame, top_n: int = 8) -> pd.DataFrame:
    """Estimasi jalur buyer-seller berdasarkan net value."""
    if dist.empty: return pd.DataFrame()
    buyers = dist[dist["net_value"] > 0].copy().sort_values("net_value", ascending=False).head(top_n)
    sellers = dist[dist["net_value"] < 0].copy().sort_values("net_value", ascending=True).head(top_n)
    if buyers.empty or sellers.empty: return pd.DataFrame()
    
    buyers["remaining"] = buyers["net_value"].astype(float)
    sellers["remaining"] = sellers["net_value"].abs().astype(float)
    edges = []
    seller_idx = 0
    seller_rows = sellers.reset_index(drop=True)
    buyer_rows = buyers.reset_index(drop=True)
    
    for buyer_i in range(len(buyer_rows)):
        buyer_left = float(buyer_rows.loc[buyer_i, "remaining"])
        while buyer_left > 1e-9 and seller_idx < len(seller_rows):
            seller_left = float(seller_rows.loc[seller_idx, "remaining"])
            if seller_left <= 1e-9:
                seller_idx += 1
                continue
            matched = min(buyer_left, seller_left)
            edges.append({
                "buyer_code": buyer_rows.loc[buyer_i, "broker_code"],
                "buyer_type": participant_label(buyer_rows.loc[buyer_i, "participant_type"]),
                "seller_code": seller_rows.loc[seller_idx, "broker_code"],
                "seller_type": participant_label(seller_rows.loc[seller_idx, "participant_type"]),
                "matched_value": matched
            })
            buyer_left -= matched
            seller_rows.loc[seller_idx, "remaining"] = seller_left - matched
            if seller_rows.loc[seller_idx, "remaining"] <= 1e-9:
                seller_idx += 1
        buyer_rows.loc[buyer_i, "remaining"] = buyer_left
    return pd.DataFrame(edges)

def broker_summary_table(dist: pd.DataFrame, top_n: int = 10) -> pd.DataFrame:
    """Tabel summary buy/sell broker."""
    if dist.empty: return pd.DataFrame()
    buyers = dist[dist["net_value"] > 0].copy().sort_values("net_value", ascending=False).head(top_n).reset_index(drop=True)
    sellers = dist[dist["net_value"] < 0].copy().sort_values("net_value", ascending=True).head(top_n).reset_index(drop=True)
    rows = []
    max_len = max(len(buyers), len(sellers))
    for i in range(max_len):
        row = {}
        if i < len(buyers):
            b = buyers.iloc[i]
            row.update({
                "Buy Broker": b["broker_code"], "Buy Type": participant_label(b["participant_type"]),
                "Buy Value": b.get("buy_value", 0), "Buy Lot": b.get("buy_lot", 0), "Buy Avg": b.get("buy_avg_price", 0)
            })
        else:
            row.update({"Buy Broker": "", "Buy Type": "", "Buy Value": None, "Buy Lot": None, "Buy Avg": None})
        if i < len(sellers):
            s = sellers.iloc[i]
            row.update({
                "Sell Broker": s["broker_code"], "Sell Type": participant_label(s["participant_type"]),
                "Sell Value": s.get("sell_value", 0), "Sell Lot": s.get("sell_lot", 0), "Sell Avg": s.get("sell_avg_price", 0)
            })
        else:
            row.update({"Sell Broker": "", "Sell Type": "", "Sell Value": None, "Sell Lot": None, "Sell Avg": None})
        rows.append(row)
    return pd.DataFrame(rows)

def broker_distribution_data(activity_window: pd.DataFrame, dist_start, dist_end) -> dict:
    """Siapkan data untuk Sankey diagram dan tabel distribution."""
    dist = activity_window[
        (activity_window["date"] >= dist_start) & (activity_window["date"] <= dist_end)
    ].copy()
    
    if not dist.empty:
        dist = dist.groupby(["broker_code", "participant_type"], dropna=False).agg(
            buy_value=("buy_value", "sum"),
            sell_value=("sell_value", "sum"),
            net_value=("net_value", "sum"),
            frequency=("frequency", "sum"),
            buy_lot=("buy_lot", "sum"),
            sell_lot=("sell_lot", "sum"),
            buy_avg_price=("buy_avg_price", "mean"),
            sell_avg_price=("sell_avg_price", "mean")
        ).reset_index()
    
    if dist.empty:
        return {"dist": [], "paths": [], "summary": [], "detail": []}
    
    paths = estimated_broker_paths(dist, top_n=8)
    summary = broker_summary_table(dist, top_n=10)
    
    # Detail rows dengan sub-type
    detail = dist[["broker_code", "participant_type", "buy_value", "sell_value", "net_value", "frequency"]].copy()
    detail["Type"] = detail["participant_type"].map(participant_label)
    detail["Avg Value / Tx"] = detail.apply(lambda r: abs(float(r["net_value"] or 0)) / max(float(r["frequency"] or 0), 1), axis=1)
    detail["Sub-type"] = detail.apply(broker_subtype, axis=1)
    detail = detail.rename(columns={
        "broker_code": "Broker", "buy_value": "Buy", "sell_value": "Sell",
        "net_value": "Net", "frequency": "Freq"
    })
    
    return {
        "dist": df_to_records(dist),
        "paths": df_to_records(paths),
        "summary": df_to_records(summary),
        "detail": df_to_records(detail)
    }
