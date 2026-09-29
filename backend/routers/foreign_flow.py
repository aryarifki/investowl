"""Foreign Flow Deep Dive Analytics endpoint (Pre-computed Mode)."""
from __future__ import annotations

import json
import redis
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from config import settings
from database import get_db

try:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True
    )
    redis_client.ping()
except Exception:
    redis_client = None

router = APIRouter(prefix="/api/foreign-flow", tags=["Foreign Flow Deep Dive"])

SECTOR_META = {
    "IDXENERGY": {
        "name": "Energi (Energy)",
        "icon": "ph:lightning-duotone",
        "color": "amber",
        "top_stocks": ["ADRO", "BREN", "PTBA", "MEDC", "AKRA"],
    },
    "IDXBASIC": {
        "name": "Barang Baku (Basic Materials)",
        "icon": "ph:cube-duotone",
        "color": "emerald",
        "top_stocks": ["BRPT", "TPIA", "INKP", "MDKA", "ANTM"],
    },
    "IDXINDUST": {
        "name": "Perindustrian (Industrials)",
        "icon": "ph:factory-duotone",
        "color": "indigo",
        "top_stocks": ["UNTR", "ASGR", "MARK", "BNBR"],
    },
    "IDXNONCYC": {
        "name": "Konsumer Primer (Consumer Non-Cyclicals)",
        "icon": "ph:shopping-cart-duotone",
        "color": "teal",
        "top_stocks": ["ICBP", "INDF", "UNVR", "CPIN", "AMRT"],
    },
    "IDXCYCLIC": {
        "name": "Konsumer Non-Primer (Consumer Cyclicals)",
        "icon": "ph:storefront-duotone",
        "color": "sky",
        "top_stocks": ["ASII", "ACES", "MAPI", "AUTO", "ERAA"],
    },
    "IDXHEALTH": {
        "name": "Kesehatan (Healthcare)",
        "icon": "ph:first-aid-duotone",
        "color": "rose",
        "top_stocks": ["KLBF", "MIKA", "HEAL", "SILO"],
    },
    "IDXFINANCE": {
        "name": "Keuangan (Financials)",
        "icon": "ph:bank-duotone",
        "color": "blue",
        "top_stocks": ["BBCA", "BBRI", "BMRI", "BBNI", "BBTN"],
    },
    "IDXPROPERT": {
        "name": "Properti & Real Estat (Real Estate)",
        "icon": "ph:buildings-duotone",
        "color": "purple",
        "top_stocks": ["BSDE", "CTRA", "PWON", "SMRA", "ASRI"],
    },
    "IDXTECHNO": {
        "name": "Teknologi (Technology)",
        "icon": "ph:cpu-duotone",
        "color": "violet",
        "top_stocks": ["GOTO", "EMTK", "DCII", "BUKA", "WIFI"],
    },
    "IDXINFRA": {
        "name": "Infrastruktur (Infrastructure)",
        "icon": "ph:broadcast-duotone",
        "color": "orange",
        "top_stocks": ["TLKM", "JSMR", "TOWR", "TBIG", "PGAS"],
    },
    "IDXTRANS": {
        "name": "Transportasi & Logistik (Logistics)",
        "icon": "ph:airplane-tilt-duotone",
        "color": "cyan",
        "top_stocks": ["BIRD", "SMDR", "ASSA", "TMAS"],
    },
}


@router.get("/sectors/summary", summary="Ringkasan rotasi sektor IDX, arus transaksi, dan Relative Strength vs IHSG")
def get_sector_rotation_summary(db: Session = Depends(get_db)):
    cache_key = "sector_rotation_summary_v1"
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    query = text("""
        SELECT date, index_code, close, value, volume, market_cap
        FROM idx_index_summary
        WHERE index_code IN (
            'COMPOSITE', 'IDXENERGY', 'IDXBASIC', 'IDXINDUST', 
            'IDXNONCYC', 'IDXCYCLIC', 'IDXHEALTH', 'IDXFINANCE', 
            'IDXPROPERT', 'IDXTECHNO', 'IDXINFRA', 'IDXTRANS'
        )
        ORDER BY date ASC
    """)
    rows = db.execute(query).fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail="Data indeks sektoral belum tersedia di database.")

    import pandas as pd
    df = pd.DataFrame(rows, columns=["date", "index_code", "close", "value", "volume", "market_cap"])
    df["close"] = df["close"].astype(float)
    df["value"] = df["value"].fillna(0).astype(float)

    pivot_close = df.pivot(index="date", columns="index_code", values="close")
    pivot_value = df.pivot(index="date", columns="index_code", values="value")

    latest_date = pivot_close.index[-1]
    prev_date = pivot_close.index[-2] if len(pivot_close) >= 2 else latest_date
    date_5d = pivot_close.index[-5] if len(pivot_close) >= 5 else pivot_close.index[0]
    date_20d = pivot_close.index[-20] if len(pivot_close) >= 20 else pivot_close.index[0]

    # Benchmark: COMPOSITE (IHSG)
    ihsg_now = float(pivot_close.loc[latest_date, "COMPOSITE"])
    ihsg_prev = float(pivot_close.loc[prev_date, "COMPOSITE"])
    ihsg_ret_1d = round(((ihsg_now / ihsg_prev) - 1) * 100, 2) if ihsg_prev else 0.0
    ihsg_val = float(pivot_value.loc[latest_date, "COMPOSITE"]) if "COMPOSITE" in pivot_value.columns else 0.0

    sectors_list = []
    total_sector_val = 0.0

    for s_code, meta in SECTOR_META.items():
        if s_code not in pivot_close.columns:
            continue
        c_now = float(pivot_close.loc[latest_date, s_code])
        c_prev = float(pivot_close.loc[prev_date, s_code])
        c_5d = float(pivot_close.loc[date_5d, s_code])
        c_20d = float(pivot_close.loc[date_20d, s_code])

        ret_1d = round(((c_now / c_prev) - 1) * 100, 2) if c_prev else 0.0
        ret_5d = round(((c_now / c_5d) - 1) * 100, 2) if c_5d else 0.0
        ret_20d = round(((c_now / c_20d) - 1) * 100, 2) if c_20d else 0.0

        val_now = float(pivot_value.loc[latest_date, s_code]) if s_code in pivot_value.columns and pd.notnull(pivot_value.loc[latest_date, s_code]) else 0.0
        total_sector_val += val_now

        # Relative Strength vs COMPOSITE
        rs_ratio_series = pivot_close[s_code] / pivot_close["COMPOSITE"]
        ma_rs = rs_ratio_series.rolling(10, min_periods=3).mean()
        norm_rs = (rs_ratio_series / ma_rs) * 100

        curr_rs = round(float(norm_rs.iloc[-1]), 2)
        prev_rs = float(norm_rs.iloc[-2]) if len(norm_rs) >= 2 else curr_rs
        rs_momentum = round((curr_rs / prev_rs) * 100, 2) if prev_rs != 0 else 100.0

        if curr_rs >= 100.0 and rs_momentum >= 100.0:
            quadrant = "Leading"
        elif curr_rs >= 100.0 and rs_momentum < 100.0:
            quadrant = "Weakening"
        elif curr_rs < 100.0 and rs_momentum < 100.0:
            quadrant = "Lagging"
        else:
            quadrant = "Improving"

        sectors_list.append({
            "code": s_code,
            "name": meta["name"],
            "icon": meta["icon"],
            "color": meta["color"],
            "close": c_now,
            "ret_1d": ret_1d,
            "ret_5d": ret_5d,
            "ret_20d": ret_20d,
            "value": val_now,
            "value_share_pct": 0.0,
            "rs_ratio": curr_rs,
            "rs_momentum": rs_momentum,
            "quadrant": quadrant,
            "top_stocks": meta["top_stocks"],
        })

    for s in sectors_list:
        if total_sector_val > 0:
            s["value_share_pct"] = round((s["value"] / total_sector_val) * 100, 2)

    sectors_list.sort(key=lambda x: x["ret_1d"], reverse=True)

    payload = {
        "date": str(latest_date),
        "benchmark": {
            "code": "COMPOSITE",
            "name": "IHSG (Indeks Harga Saham Gabungan)",
            "close": ihsg_now,
            "ret_1d": ihsg_ret_1d,
            "value": ihsg_val,
        },
        "total_sector_value": total_sector_val,
        "sectors": sectors_list,
    }

    if redis_client:
        try:
            redis_client.setex(cache_key, 300, json.dumps(payload))
        except Exception:
            pass

    return payload


@router.get("/sectors/history", summary="Histori deret waktu harga dan relative strength sektor")
def get_sector_history(
    sector: str = Query(..., description="Kode indeks sektoral (misal: IDXENERGY)"),
    days: int = Query(30, ge=5, le=100),
    db: Session = Depends(get_db)
):
    sector = sector.upper().strip()
    if sector not in SECTOR_META:
        raise HTTPException(status_code=404, detail=f"Sektor '{sector}' tidak valid atau tidak terdaftar.")

    query = text("""
        SELECT date, index_code, close, value
        FROM idx_index_summary
        WHERE index_code IN (:sector, 'COMPOSITE')
        ORDER BY date ASC
    """)
    rows = db.execute(query, {"sector": sector}).fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail=f"Data historis untuk sektor '{sector}' tidak ditemukan.")

    import pandas as pd
    df = pd.DataFrame(rows, columns=["date", "index_code", "close", "value"])
    df["close"] = df["close"].astype(float)
    df["value"] = df["value"].fillna(0).astype(float)

    pivot = df.pivot(index="date", columns="index_code", values="close")
    pivot_val = df.pivot(index="date", columns="index_code", values="value")

    if sector not in pivot.columns or "COMPOSITE" not in pivot.columns:
        raise HTTPException(status_code=404, detail=f"Data indeks {sector} tidak lengkap.")

    rs_ratio_series = pivot[sector] / pivot["COMPOSITE"]
    ma_rs = rs_ratio_series.rolling(10, min_periods=3).mean()
    norm_rs = (rs_ratio_series / ma_rs) * 100

    history_points = []
    recent_dates = pivot.index[-days:]
    for d in recent_dates:
        history_points.append({
            "date": str(d),
            "close": round(float(pivot.loc[d, sector]), 3),
            "value": float(pivot_val.loc[d, sector]) if sector in pivot_val.columns else 0.0,
            "rs_ratio": round(float(norm_rs.loc[d]), 2) if d in norm_rs.index else 100.0,
        })

    return {
        "sector": sector,
        "name": SECTOR_META[sector]["name"],
        "count": len(history_points),
        "data": history_points,
    }


@router.get("/{ticker}")
def get_foreign_flow_analytics(
    ticker: str,
    lookback_days: int = Query(60, ge=20, le=250),
    db: Session = Depends(get_db)
):
    ticker = ticker.upper().strip()
    cache_key = f"ff_deepdive_v3:{ticker}:{lookback_days}"

    # 1. Cek Cache Redis terlebih dahulu
    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception:
            pass 

    # 2. Ambil data dari tabel pre-computed (Sangat cepat, < 10ms)
    query = text("""
        SELECT ticker, lookback_days, latest_date, features, timeseries, models, 
               company_name, group_name
        FROM analytics_foreign_flow
        WHERE ticker = :ticker AND lookback_days = :lookback_days
    """)
    
    row = db.execute(query, {"ticker": ticker, "lookback_days": lookback_days}).fetchone()
    
    if not row:
        raise HTTPException(
            status_code=404, 
            detail=f"Data analitik untuk {ticker} pada window {lookback_days} hari belum dihitung oleh Smtracker."
        )

    # 3. Rangkai payload agar persis dengan struktur frontend
    payload = {
        "ticker": row.ticker,
        "company": {
            "name": row.company_name or "Perusahaan Tidak Diketahui", 
            "group": row.group_name or "Independen / Belum Terpetakan"
        },
        "lookback_days": row.lookback_days,
        "latest_date": str(row.latest_date),
        "features": row.features or {},
        "timeseries": row.timeseries or {},
        "models": row.models or {}
    }

    # 4. Simpan ke Redis (Cache 8 jam)
    if redis_client:
        try:
            redis_client.setex(cache_key, 28800, json.dumps(payload))
        except Exception:
            pass

    return payload
