# backend/routers/signal.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import date
import json

from database import get_db

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

    query_str += " ORDER BY s.signal_date DESC, s.id DESC LIMIT :limit OFFSET :offset"

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
