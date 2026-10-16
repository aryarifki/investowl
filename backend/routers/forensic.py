"""Market Forensics & Foreign Exodus Radar Router."""
from __future__ import annotations

from typing import List, Dict, Any, Optional
import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from core.cache import TTLCache

router = APIRouter(prefix="/api/forensic", tags=["Market Forensics"])
forensic_cache = TTLCache(maxsize=32, ttl_seconds=300.0, redis_prefix="forensic")

# Kamus pemetaan kode broker asing ke nama institusi
BROKER_NAME_MAP: Dict[str, str] = {
    "ZP": "Credit Suisse",
    "AK": "Morgan Stanley",
    "BK": "Deutsche Bank",
    "KZ": "CLSA Sekuritas",
    "RX": "UBS Sekuritas",
    "TP": "JPMorgan Sekuritas",
    "YU": "CGS-CIMB Sekuritas",
    "CS": "Credit Suisse",
    "CG": "Citigroup Sekuritas",
    "ML": "Merrill Lynch / BofA",
    "MS": "Morgan Stanley",
    "DB": "Deutsche Bank",
    "CC": "Mandiri Sekuritas",
    "NI": "BNI Sekuritas",
    "OD": "BRI Danareksa",
    "PD": "Indo Premier Sekuritas",
    "YP": "Mirae Asset Sekuritas",
    "XC": "Ajaib Sekuritas",
    "SQ": "BCA Sekuritas",
    "MG": "Semesta Indovest",
    "CP": "KB Valbury Sekuritas",
    "EP": "MNC Sekuritas",
    "LG": "Trimegah Sekuritas",
    "GR": "Panin Sekuritas",
    "AZ": "Sucor Sekuritas",
    "DR": "RHB Sekuritas",
    "KI": "Ciptadana Sekuritas",
    "AI": "UOB Kay Hian",
    "AG": "Kiwoom Sekuritas",
    "XA": "Woori Korindo",
}


def _evaluate_market_state(timeline: List[Dict[str, Any]]) -> str:
    """Evaluasi status pasar menggunakan state machine: NORMAL, WARNING, CRASH, BOTTOMING.
    
    Logika PRD:
    - NORMAL: Daily Net Flow > -1 Trillion IDR.
    - WARNING (Hidden Distribution): Cumulative 5-day Net Flow < -5 Trillion IDR, but IHSG drop < 3%.
    - CRASH (Forced Liquidation): Any single day where Daily Net Flow > 5 Trillion IDR (outflow).
    - BOTTOMING (Capitulation): After a CRASH state, Daily Net Flow turns positive (buyback) for 2 consecutive days.
    """
    if not timeline:
        return "NORMAL"

    # Penyesuaian unit: jika data flow bernilai 10^9 (lembar saham dari prices), 1 unit = 1e9.
    # Jika bernilai 10^12 (IDR), 1 unit = 1e12.
    max_abs_flow = max((abs(r["daily_flow"]) for r in timeline), default=0.0)
    unit = 1e9 if max_abs_flow < 1e11 else 1e12

    in_crash_mode = False
    consec_positive = 0
    state = "NORMAL"

    for i in range(len(timeline)):
        row = timeline[i]
        flow = row["daily_flow"]
        ihsg = row["ihsg_close"]

        # Hitung aliran 5 hari dan persentase perubahan IHSG 5 hari
        start_idx = max(0, i - 4)
        flow_5d = sum(r["daily_flow"] for r in timeline[start_idx : i + 1])
        base_ihsg = timeline[start_idx]["ihsg_close"]
        ihsg_drop_5d = ((ihsg - base_ihsg) / base_ihsg) * 100.0 if base_ihsg > 0 else 0.0

        if flow > 0:
            consec_positive += 1
        else:
            consec_positive = 0

        # Prioritas 1: CRASH (single day massive outflow > 5 unit)
        if flow <= (-5.0 * unit):
            state = "CRASH"
            in_crash_mode = True
        # Prioritas 2: BOTTOMING (buyback 2 hari berturut-turut setelah CRASH)
        elif in_crash_mode and consec_positive >= 2:
            state = "BOTTOMING"
            in_crash_mode = False
        # Prioritas 3: WARNING (distribusi tersembunyi akumulasi 5 hari < -5 unit, penurunan IHSG < 3%)
        elif flow_5d <= (-5.0 * unit) and abs(ihsg_drop_5d) < 3.0:
            state = "WARNING"
        elif flow <= (-1.0 * unit):
            state = "WARNING"
        # Prioritas 4: NORMAL (Daily Net Flow > -1 unit)
        elif flow > (-1.0 * unit):
            state = "NORMAL"
        else:
            state = "NORMAL"

    return state


@router.get("/foreign-exodus")
def get_foreign_exodus_radar(
    days: int = Query(default=45, ge=10, le=90),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Endpoint radar kapital asing dan korelasi IHSG (Foreign Exodus Radar)."""
    cache_key = f"foreign_exodus:{days}"
    cached_data = forensic_cache.get(cache_key)
    if cached_data is not None:
        return cached_data

    # 1. Query Makro: IHSG Close dan True Foreign Net Flow (prices + idx_index_summary)
    q_macro = text("""
        WITH latest_dates AS (
            SELECT DISTINCT date FROM prices ORDER BY date DESC LIMIT :days
        )
        SELECT p.date,
               ROUND(s.close, 2) as ihsg_close,
               SUM(p.foreign_sell - p.foreign_buy) as daily_flow
        FROM prices p
        JOIN latest_dates ld ON p.date = ld.date
        LEFT JOIN idx_index_summary s ON p.date = s.date AND s.index_code = 'COMPOSITE'
        GROUP BY p.date, s.close
        ORDER BY p.date ASC
    """)
    rows = db.execute(q_macro, {"days": days}).fetchall()

    timeline: List[Dict[str, Any]] = []
    running_cumulative = 0.0

    for r in rows:
        d_flow = float(r.daily_flow) if r.daily_flow is not None else 0.0
        running_cumulative += d_flow
        ihsg_val = float(r.ihsg_close) if r.ihsg_close is not None else 0.0

        timeline.append({
            "date": str(r.date),
            "ihsg_close": ihsg_val,
            "daily_flow": d_flow,
            "cumulative_flow": running_cumulative
        })

    # Jika ada data yang ihsg_close-nya 0/null (misal tanggal libur idx_index_summary), forward fill
    last_valid_ihsg = 0.0
    for item in timeline:
        if item["ihsg_close"] > 0:
            last_valid_ihsg = item["ihsg_close"]
        elif last_valid_ihsg > 0:
            item["ihsg_close"] = last_valid_ihsg

    # Hitung IHSG terkini dan persentase perubahan harian
    ihsg_current = timeline[-1]["ihsg_close"] if timeline else 0.0
    ihsg_prev = timeline[-2]["ihsg_close"] if len(timeline) > 1 else ihsg_current
    ihsg_change_pct = (
        round(((ihsg_current - ihsg_prev) / ihsg_prev) * 100.0, 2)
        if ihsg_prev > 0
        else 0.0
    )

    # 2. Hitung State Machine
    market_state = _evaluate_market_state(timeline)

    # 3. Query Mikro: Top 5 Broker Asing dengan Net Sell Tertinggi (14 hari terakhir)
    q_culprits = text("""
        SELECT broker_code, SUM(net_value) as net_sell_idr
        FROM broker_activity
        WHERE participant_type ILIKE '%asing%' 
          AND net_value < 0 
          AND date >= (SELECT MAX(date) - INTERVAL '14 days' FROM broker_activity)
        GROUP BY broker_code
        ORDER BY net_sell_idr ASC
        LIMIT 5
    """)
    culprit_rows = db.execute(q_culprits).fetchall()

    culprit_brokers: List[Dict[str, Any]] = []
    for cr in culprit_rows:
        code = str(cr.broker_code).strip().upper()
        name = BROKER_NAME_MAP.get(code, f"Broker {code}")
        culprit_brokers.append({
            "broker_code": code,
            "broker_name": name,
            "net_sell_idr": float(cr.net_sell_idr) if cr.net_sell_idr is not None else 0.0
        })

    result = {
        "market_state": market_state,
        "ihsg_current": ihsg_current,
        "ihsg_change_pct": ihsg_change_pct,
        "timeline": timeline,
        "culprit_brokers": culprit_brokers
    }

    forensic_cache.set(cache_key, result)
    return result
