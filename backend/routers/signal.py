from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional, List
import json
import time
import pandas as pd

from database import get_db
from idx_bandarmology import storage, analysis
from routers.bandarmology import get_dynamic_universe, _conviction_score

router = APIRouter(prefix="/api/signal", tags=["AI Signals"])

@router.get("/daily")
def get_daily_signals(limit: int = 100, db: Session = Depends(get_db)):
    """Mengambil Top AI Signals berdasarkan tanggal scan terbaru."""
    
    # 1. Cari tanggal scan terakhir yang ada di database
    date_query = text("SELECT MAX(date) FROM analytics_daily_signals")
    latest_date = db.execute(date_query).scalar()

    if not latest_date:
        raise HTTPException(status_code=404, detail="Belum ada sinyal yang digenerate oleh AI.")

    # 2. Ambil saham dengan composite_score > 0 (membuang saham gorengan/blocked)
    query = text("""
        SELECT a.ticker, a.date, a.ml_win_prob, a.composite_score, 
               a.technical_score, a.smart_money_score, a.sector_score, 
               a.fundamental_score, a.ml_label, a.features_snapshot, a.gate_notes
        FROM analytics_daily_signals a
        WHERE a.date = :date 
          AND a.composite_score > 0  -- Buang saham yang terkena blokir Hard Gate / Gorengan
        ORDER BY a.composite_score DESC
        LIMIT :limit
    """)
    
    rows = db.execute(query, {"date": latest_date, "limit": limit}).fetchall()
    
    signals = []
    for r in rows:
        features = r.features_snapshot if isinstance(r.features_snapshot, dict) else json.loads(r.features_snapshot or "{}")
        
        signals.append({
            "ticker": r.ticker,
            "date": str(r.date),
            "ml_label": r.ml_label,
            "ml_win_prob": float(r.ml_win_prob) if r.ml_win_prob else 0.0,
            "composite_score": r.composite_score,
            "scores": {
                "technical": r.technical_score,
                "smart_money": r.smart_money_score,
                "sector": r.sector_score,
                "fundamental": r.fundamental_score
            },
            "features": features,
            "gate_notes": r.gate_notes if r.gate_notes else ""
        })
        
    return {
        "latest_date": str(latest_date),
        "count": len(signals),
        "data": signals
    }


@router.get("/backtest/stats")
def get_backtest_stats(db: Session = Depends(get_db)):
    """Mengambil ringkasan statistik performa backtest sinyal historis."""
    q = text("""
        SELECT 
            COUNT(*) as total_signals,
            COUNT(CASE WHEN status IN ('WIN', 'LOSS') THEN 1 END) as total_closed,
            COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as total_open,
            COUNT(CASE WHEN status = 'WIN' THEN 1 END) as win_count,
            COUNT(CASE WHEN status = 'LOSS' THEN 1 END) as loss_count,
            COALESCE(AVG(CASE WHEN status = 'WIN' THEN ((exit_price - entry_price) / entry_price) * 100.0 END), 0.0) as avg_win_pct,
            COALESCE(AVG(CASE WHEN status = 'LOSS' THEN ((exit_price - entry_price) / entry_price) * 100.0 END), 0.0) as avg_loss_pct,
            COALESCE(AVG(CASE WHEN status IN ('WIN', 'LOSS') THEN days_held END), 0.0) as avg_days_held,
            COALESCE(SUM(CASE WHEN status = 'WIN' THEN (exit_price - entry_price) / entry_price END), 0.0) as sum_win_gain,
            COALESCE(SUM(CASE WHEN status = 'LOSS' THEN ABS((exit_price - entry_price) / entry_price) END), 0.0) as sum_loss_drawdown,
            MAX(exit_date) as latest_exit_date,
            MAX(signal_date) as latest_signal_date
        FROM signals
    """)
    row = db.execute(q).fetchone()
    if not row:
        return {
            "total_signals": 0,
            "total_closed": 0,
            "total_open": 0,
            "win_count": 0,
            "loss_count": 0,
            "win_rate": 0.0,
            "avg_win_pct": 0.0,
            "avg_loss_pct": 0.0,
            "avg_days_held": 0.0,
            "profit_factor": 0.0,
            "latest_audit_date": None,
        }

    total_signals = row.total_signals or 0
    total_closed = row.total_closed or 0
    total_open = row.total_open or 0
    win_count = row.win_count or 0
    loss_count = row.loss_count or 0
    win_rate = round((win_count / total_closed) * 100.0, 2) if total_closed > 0 else 0.0
    avg_win_pct = round(float(row.avg_win_pct), 2)
    avg_loss_pct = round(float(row.avg_loss_pct), 2)
    avg_days_held = round(float(row.avg_days_held), 1)

    sum_win = float(row.sum_win_gain or 0.0)
    sum_loss = float(row.sum_loss_drawdown or 0.0)
    profit_factor = round(sum_win / sum_loss, 2) if sum_loss > 0 else (99.0 if sum_win > 0 else 0.0)

    latest_date = row.latest_exit_date or row.latest_signal_date

    return {
        "total_signals": total_signals,
        "total_closed": total_closed,
        "total_open": total_open,
        "win_count": win_count,
        "loss_count": loss_count,
        "win_rate": win_rate,
        "avg_win_pct": avg_win_pct,
        "avg_loss_pct": avg_loss_pct,
        "avg_days_held": avg_days_held,
        "profit_factor": profit_factor,
        "latest_audit_date": str(latest_date) if latest_date else None,
    }


@router.get("/backtest/history")
def get_backtest_history(
    status: str = "ALL",
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Mengambil daftar riwayat sinyal yang telah diaudit."""
    valid_statuses = {"ALL", "WIN", "LOSS", "OPEN"}
    status_filter = status.upper() if status.upper() in valid_statuses else "ALL"

    query_str = """
        SELECT 
            s.id, s.ticker, s.signal_date, s.entry_price, s.tp_price, s.sl_price,
            s.exit_price, s.exit_date, s.status, s.days_held, s.features_snapshot,
            CASE 
                WHEN s.exit_price IS NOT NULL AND s.entry_price > 0 
                THEN ROUND(((s.exit_price - s.entry_price) / s.entry_price) * 100.0, 2)
                ELSE NULL 
            END as pnl_pct
        FROM signals s
    """
    params = {"limit": limit, "offset": offset}

    if status_filter != "ALL":
        query_str += " WHERE s.status = :status_val"
        params["status_val"] = status_filter

    query_str += " ORDER BY s.signal_date DESC, (s.features_snapshot->>'composite_score')::numeric DESC NULLS LAST, s.ticker ASC LIMIT :limit OFFSET :offset"

    rows = db.execute(text(query_str), params).fetchall()

    history = []
    for r in rows:
        feat = r.features_snapshot if isinstance(r.features_snapshot, dict) else json.loads(r.features_snapshot or "{}")
        history.append({
            "id": r.id,
            "ticker": r.ticker,
            "signal_date": str(r.signal_date) if r.signal_date else None,
            "entry_price": float(r.entry_price) if r.entry_price is not None else 0.0,
            "tp_price": float(r.tp_price) if r.tp_price is not None else 0.0,
            "sl_price": float(r.sl_price) if r.sl_price is not None else 0.0,
            "exit_price": float(r.exit_price) if r.exit_price is not None else None,
            "exit_date": str(r.exit_date) if r.exit_date else None,
            "status": r.status or "UNKNOWN",
            "days_held": r.days_held if r.days_held is not None else 0,
            "pnl_pct": float(r.pnl_pct) if r.pnl_pct is not None else None,
            "composite_score": feat.get("composite_score", 0),
            "sm_score": feat.get("sm_score", 0),
            "sec_score": feat.get("sec_score", 0),
        })

    return {
        "status_filter": status_filter,
        "count": len(history),
        "data": history
    }


@router.get("/active")
def get_active_signals(limit: int = 50, db: Session = Depends(get_db)):
    """Mengambil daftar sinyal aktif (status = OPEN) diurutkan berdasarkan skor kuantitatif tertinggi."""
    q = text("""
        SELECT 
            s.id, s.ticker, s.signal_date, s.entry_price, s.tp_price, s.sl_price,
            s.status, s.days_held, s.features_snapshot,
            f.company_name, f.group_name,
            COALESCE(a.composite_score, (s.features_snapshot->>'composite_score')::numeric, 0) as real_composite_score,
            a.features_snapshot as daily_features
        FROM signals s
        LEFT JOIN (
            SELECT DISTINCT ON (ticker) ticker, company_name, group_name
            FROM analytics_foreign_flow
        ) f ON s.ticker = f.ticker
        LEFT JOIN analytics_daily_signals a ON (s.ticker = a.ticker AND s.signal_date = a.date)
        WHERE s.status = 'OPEN'
        ORDER BY s.signal_date DESC, real_composite_score DESC, s.ticker ASC
        LIMIT :limit
    """)
    rows = db.execute(q, {"limit": limit}).fetchall()
    data = []
    for r in rows:
        feat = r.features_snapshot if isinstance(r.features_snapshot, dict) else json.loads(r.features_snapshot or "{}")
        daily_feat = r.daily_features if isinstance(r.daily_features, dict) else (json.loads(r.daily_features) if r.daily_features else {})
        entry = float(r.entry_price) if r.entry_price is not None else 0.0
        tp = float(r.tp_price) if r.tp_price is not None else 0.0
        sl = float(r.sl_price) if r.sl_price is not None else 0.0
        target_gain = round(((tp - entry) / entry) * 100.0, 2) if entry > 0 else 0.0
        stop_risk = round(((entry - sl) / entry) * 100.0, 2) if entry > 0 else 0.0
        rr = round(target_gain / stop_risk, 2) if stop_risk > 0 else 0.0

        comp_score = float(r.real_composite_score) if r.real_composite_score is not None else float(feat.get("composite_score", 0))

        data.append({
            "id": r.id,
            "ticker": r.ticker,
            "company_name": r.company_name or r.ticker,
            "group_name": r.group_name or "-",
            "signal_date": str(r.signal_date) if r.signal_date else None,
            "entry_price": entry,
            "tp_price": tp,
            "sl_price": sl,
            "target_gain_pct": target_gain,
            "stop_risk_pct": stop_risk,
            "risk_reward_ratio": rr,
            "status": r.status or "OPEN",
            "days_held": r.days_held if r.days_held is not None else 0,
            "composite_score": int(round(comp_score)),
            "wyckoff_phase": daily_feat.get("wyckoff_phase") or feat.get("wp", "-"),
            "cmf": daily_feat.get("cmf") if daily_feat.get("cmf") is not None else feat.get("cmf_v"),
            "mfi": daily_feat.get("mfi") if daily_feat.get("mfi") is not None else feat.get("mfi_v"),
            "rsi": daily_feat.get("rsi") if daily_feat.get("rsi") is not None else feat.get("rsi_v"),
            "vcp_grade": daily_feat.get("vcp_grade") or feat.get("vcp_grade", "NONE"),
            "gate_notes": daily_feat.get("gate_notes") or feat.get("gate_notes", ""),
            "features": feat
        })
    return {
        "count": len(data),
        "data": data
    }


_confluence_cache: dict[str, dict] = {}
_CONFLUENCE_TTL = 180  # 3 minutes


@router.get("/confluence-screener")
def get_confluence_screener(
    universe_mode: str = "lq45",
    analysis_date: Optional[str] = None,
    window_days: int = 20,
    tickers: Optional[str] = None,
    min_conviction: float = 0.0,
    tag_filter: Optional[str] = None,
    signal_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Multi-parameter confluence screener combining bandarmology conviction, foreign flow HMM, and float stats."""
    cache_key = f"{universe_mode}|{analysis_date}|{window_days}|{tickers}"
    now_ts = time.time()
    cached_entry = _confluence_cache.get(cache_key)

    if cached_entry and (now_ts - cached_entry["time"] < _CONFLUENCE_TTL):
        raw_results = cached_entry["data"]
        meta_info = cached_entry["meta"]
    else:
        if tickers:
            ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
        else:
            ticker_list = get_dynamic_universe(universe_mode)

        if not ticker_list:
            return {"count": 0, "meta": {}, "data": []}

        ticker_list = ticker_list[:100]

        analysis_ts = pd.Timestamp(analysis_date) if analysis_date else pd.Timestamp.today()
        cutoff_date = (analysis_ts - pd.Timedelta(days=window_days + 30)).strftime("%Y-%m-%d")

        flow_df = storage.read_broker_flow(ticker_list, start_date=cutoff_date)
        act_df = storage.read_broker_activity(ticker_list, start_date=cutoff_date)
        px_df = storage.read_prices(ticker_list, start_date=cutoff_date)

        try:
            scan_10d = analysis.broker_alpha_scan(
                ticker_list, horizon=10, min_events=5, min_net_value=0,
                group_by=("ticker", "broker_code")
            )
        except Exception:
            scan_10d = pd.DataFrame()

        q_meta = text("""
            SELECT f.ticker, f.company_name, f.group_name, f.features,
                   s.free_float_pct
            FROM (
                SELECT DISTINCT ON (ticker) ticker, company_name, group_name, features
                FROM analytics_foreign_flow
                WHERE ticker = ANY(:tickers)
            ) f
            LEFT JOIN (
                SELECT ticker, 100.0 - COALESCE(SUM(pct), 0) as free_float_pct
                FROM company_shareholders
                WHERE ticker = ANY(:tickers) AND (is_controlling = true OR pct >= 5.0)
                GROUP BY ticker
            ) s ON f.ticker = s.ticker
        """)
        meta_rows = db.execute(q_meta, {"tickers": ticker_list}).fetchall()
        meta_map = {r.ticker: r for r in meta_rows}

        flow_groups = {t: sub for t, sub in flow_df.groupby("ticker")} if not flow_df.empty else {}
        act_groups = {t: sub for t, sub in act_df.groupby("ticker")} if not act_df.empty else {}
        px_groups = {t: sub for t, sub in px_df.groupby("ticker")} if not px_df.empty else {}

        raw_results = []
        for t in ticker_list:
            t_flow = flow_groups.get(t, pd.DataFrame())
            t_act = act_groups.get(t, pd.DataFrame())
            t_px = px_groups.get(t, pd.DataFrame())

            if t_flow.empty:
                continue

            t_flow = t_flow[t_flow["date"] <= analysis_ts].sort_values("date")
            if t_flow.empty:
                continue

            latest_flow = t_flow.iloc[-1]
            raw_sig = latest_flow.get("bandar_signal", "NEUTRAL")
            sig = str(raw_sig).replace("_", " ").title() if pd.notna(raw_sig) else "Neutral"

            curr_px = 0.0
            if not t_px.empty:
                t_px_filtered = t_px[t_px["date"] <= analysis_ts].sort_values("date")
                if not t_px_filtered.empty and pd.notna(t_px_filtered.iloc[-1]["close"]):
                    curr_px = float(t_px_filtered.iloc[-1]["close"])

            foreign_5d = float(t_flow.tail(5)["foreign_net_broker"].fillna(0).sum())

            try:
                conv = _conviction_score(raw_sig, foreign_5d, scan_10d, t)
                conv_score = float(conv.get("score", 50.0))
            except Exception:
                conv_score = 50.0

            bandar_avg = 0.0
            top_buyer = "-"
            top_seller = "-"
            smart_foreign_net = 0.0
            gorengan_net = 0.0

            if not t_act.empty:
                t_act_filtered = t_act[t_act["date"] <= analysis_ts].sort_values("date")
                if not t_act_filtered.empty:
                    latest_act_date = t_act_filtered["date"].max()
                    latest_act = t_act_filtered[t_act_filtered["date"] == latest_act_date]

                    buyers = latest_act[latest_act["net_value"] > 0].sort_values("net_value", ascending=False)
                    sellers = latest_act[latest_act["net_value"] < 0].sort_values("net_value", ascending=True)

                    if not buyers.empty:
                        top_buyer = str(buyers.iloc[0]["broker_code"])
                        b5 = buyers.head(5)
                        b_val = b5["buy_value"].sum()
                        b_lot = b5["buy_lot"].sum()
                        if b_lot > 0:
                            bandar_avg = round(float(b_val / (b_lot * 100)), 1)

                    if not sellers.empty:
                        top_seller = str(sellers.iloc[0]["broker_code"])

                    smart_foreign_net = float(latest_act[latest_act["broker_code"].isin(["AK", "BK", "KZ", "CS"])]["net_value"].sum())
                    gorengan_net = float(latest_act[latest_act["broker_code"].isin(["MG", "SQ", "CP", "EP", "XC", "YP"])]["net_value"].sum())

            if curr_px == 0.0 and bandar_avg > 0:
                curr_px = bandar_avg

            distance_pct = round(((curr_px - bandar_avg) / bandar_avg) * 100.0, 2) if bandar_avg > 0 else 0.0

            m = meta_map.get(t)
            comp_name = m.company_name if m and m.company_name else t
            group_name = m.group_name if m and m.group_name else "-"
            free_float = round(float(m.free_float_pct), 1) if m and m.free_float_pct is not None else 0.0
            features = m.features if m and m.features else {}
            foreign_z = features.get("foreign_zscore", 0.0) if isinstance(features, dict) else 0.0

            if foreign_z > 1.0:
                foreign_hmm = "Strong Accumulation"
            elif foreign_z > 0.3:
                foreign_hmm = "Accumulation"
            elif foreign_z < -1.0:
                foreign_hmm = "Strong Distribution"
            elif foreign_z < -0.3:
                foreign_hmm = "Distribution"
            else:
                foreign_hmm = "Neutral / Transition"

            quick_tags = []
            raw_upper = str(raw_sig).upper()
            if conv_score >= 70 and "ACCUMULATION" in raw_upper and -5 <= distance_pct <= 5:
                quick_tags.append("GOLDEN_CONFLUENCE")
            if "ACCUMULATION" in raw_upper and distance_pct < 0:
                quick_tags.append("STEALTH_ACCUMULATION")
            if gorengan_net > 500_000_000 and abs(distance_pct) < 15:
                quick_tags.append("GORENGAN_MOMENTUM")
            if curr_px > bandar_avg and "DISTRIBUTION" in raw_upper:
                quick_tags.append("DISTRIBUTION_TRAP")
            if 0 < free_float <= 25.0:
                quick_tags.append("LOW_FLOAT")

            raw_results.append({
                "ticker": t,
                "company_name": comp_name,
                "group_name": group_name,
                "current_price": curr_px,
                "signal": sig,
                "conviction_score": conv_score,
                "bandar_avg_price": bandar_avg,
                "bandar_price_distance_pct": distance_pct,
                "foreign_5d": foreign_5d,
                "smart_foreign_net": smart_foreign_net,
                "gorengan_net": gorengan_net,
                "foreign_hmm_state": foreign_hmm,
                "free_float_est": free_float,
                "top_buyer": top_buyer,
                "top_seller": top_seller,
                "quick_tags": quick_tags
            })

        raw_results.sort(key=lambda x: x["conviction_score"], reverse=True)
        meta_info = {
            "universe_mode": universe_mode,
            "window_days": window_days,
            "analysis_date": str(analysis_ts.date()),
            "cached": False
        }
        _confluence_cache[cache_key] = {
            "time": now_ts,
            "data": raw_results,
            "meta": {**meta_info, "cached": True}
        }

    filtered = raw_results
    if min_conviction > 0:
        filtered = [x for x in filtered if x["conviction_score"] >= min_conviction]
    if tag_filter:
        filtered = [x for x in filtered if tag_filter.upper() in x["quick_tags"]]
    if signal_filter:
        filtered = [x for x in filtered if signal_filter.lower() in x["signal"].lower()]

    return {
        "count": len(filtered),
        "meta": meta_info,
        "data": filtered
    }

