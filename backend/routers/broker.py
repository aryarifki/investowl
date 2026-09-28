"""Broker Flow (Bandarmology) endpoints."""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, desc, text
from sqlalchemy.orm import Session

from database import get_db
from models import BrokerFlow, BrokerActivity
from schemas import (
    BrokerFlowHistoryResponse,
    BrokerFlowRow,
    BrokerFlowSummary,
    BrokerWhaleListItem,
    BrokerWhalesDetailResponse,
    WhaleStockItem,
)
from idx_bandarmology.analysis import PROFILE_META, SMART_PROFILES, broker_profile_of

router = APIRouter(prefix="/broker-flow", tags=["Broker Flow (Bandarmology)"])

# Kata kunci klasifikasi sinyal — sesuaikan dengan output pipeline Anda
ACCUMULATION_KEYWORDS = ("akumulasi", "accumulation", "bullish")
DISTRIBUTION_KEYWORDS = ("distribusi", "distribution", "bearish")


def _normalize_ticker(ticker: str) -> str:
    return ticker.upper().replace(".JK", "").strip()


@router.get(
    "/{ticker}/latest",
    response_model=BrokerFlowRow,
    summary="Baris bandarmologi terakhir untuk satu ticker",
    responses={404: {"description": "Ticker tidak ditemukan / belum ada data"}},
)
def get_latest_broker_flow(
    ticker: str,
    db: Session = Depends(get_db),
) -> BrokerFlowRow:
    ticker = _normalize_ticker(ticker)

    row = db.execute(
        select(BrokerFlow)
        .where(BrokerFlow.ticker == ticker)
        .order_by(BrokerFlow.date.desc())
        .limit(1)
    ).scalar_one_or_none()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"Tidak ada data broker_flow untuk ticker '{ticker}'",
        )
    return row


@router.get(
    "/{ticker}/history",
    response_model=BrokerFlowHistoryResponse,
    summary="Histori bandarmologi (deret waktu) untuk satu ticker",
)
def get_broker_flow_history(
    ticker: str,
    start_date: date | None = Query(None, description="Filter start (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="Filter end (YYYY-MM-DD)"),
    limit: int = Query(250, ge=1, le=2500),
    db: Session = Depends(get_db),
) -> BrokerFlowHistoryResponse:
    ticker = _normalize_ticker(ticker)

    stmt = select(BrokerFlow).where(BrokerFlow.ticker == ticker)
    if start_date:
        stmt = stmt.where(BrokerFlow.date >= start_date)
    if end_date:
        stmt = stmt.where(BrokerFlow.date <= end_date)

    stmt = stmt.order_by(BrokerFlow.date.desc()).limit(limit)
    rows = list(reversed(db.execute(stmt).scalars().all()))  # ascending

    return BrokerFlowHistoryResponse(
        ticker=ticker,
        count=len(rows),
        data=rows,
        sort_order="asc",
    )


@router.get(
    "/{ticker}/summary",
    response_model=BrokerFlowSummary,
    summary="Agregat bandarmologi N hari terakhir (default 30 hari)",
)
def get_broker_flow_summary(
    ticker: str,
    days: int = Query(30, ge=1, le=365, description="Periode agregasi"),
    db: Session = Depends(get_db),
) -> BrokerFlowSummary:
    ticker = _normalize_ticker(ticker)
    cutoff = date.today() - timedelta(days=days)

    rows = db.execute(
        select(BrokerFlow)
        .where(BrokerFlow.ticker == ticker, BrokerFlow.date >= cutoff)
        .order_by(BrokerFlow.date.asc())
    ).scalars().all()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"Tidak ada data broker_flow untuk '{ticker}' dalam {days} hari terakhir",
        )

    # ── Agregasi di Python (dataset kecil, <1 tahun ≈ 250 baris — aman & fleksibel) ──
    foreign_sum = sum(float(r.foreign_net_broker or 0) for r in rows)
    local_sum = sum(float(r.local_net_broker or 0) for r in rows)
    gov_sum = sum(float(r.gov_net_broker or 0) for r in rows)
    total_sum = sum(float(r.total_value or 0) for r in rows)

    total_parties = abs(foreign_sum) + abs(local_sum) + abs(gov_sum)
    foreign_dominance = (
        abs(foreign_sum) / total_parties * 100 if total_parties > 0 else 0.0
    )

    acc_days = sum(
        1 for r in rows
        if r.bandar_signal and any(k in r.bandar_signal.lower() for k in ACCUMULATION_KEYWORDS)
    )
    dist_days = sum(
        1 for r in rows
        if r.bandar_signal and any(k in r.bandar_signal.lower() for k in DISTRIBUTION_KEYWORDS)
    )

    latest = rows[-1]

    return BrokerFlowSummary(
        ticker=ticker,
        period_days=days,
        trading_days=len(rows),
        foreign_net_broker_sum=round(foreign_sum, 2),
        local_net_broker_sum=round(local_sum, 2),
        gov_net_broker_sum=round(gov_sum, 2),
        total_value_sum=round(total_sum, 2),
        foreign_dominance_pct=round(foreign_dominance, 2),
        latest_bandar_signal=latest.bandar_signal,
        latest_bandar_signal_score=float(latest.bandar_signal_score) if latest.bandar_signal_score else None,
        latest_foreign_signal=latest.foreign_signal,
        accumulation_days=acc_days,
        distribution_days=dist_days,
        latest_date=latest.date,
    )


@router.get(
    "/whales",
    response_model=list[BrokerWhaleListItem],
    summary="Daftar broker aktif beserta klasifikasi profil pasar",
)
def get_whales_list(
    db: Session = Depends(get_db),
) -> list[BrokerWhaleListItem]:
    stmt = select(BrokerActivity.broker_code).distinct().order_by(BrokerActivity.broker_code.asc())
    rows = db.execute(stmt).scalars().all()

    result = []
    for code in rows:
        if not code:
            continue
        c = code.upper().strip()
        prof = broker_profile_of(c)
        label, desc_text = PROFILE_META.get(prof, ("Lainnya", "Profil broker lainnya"))
        result.append(
            BrokerWhaleListItem(
                broker_code=c,
                profile=prof,
                profile_label=label,
                profile_desc=desc_text,
                is_smart=prof in SMART_PROFILES,
            )
        )
    result.sort(key=lambda x: (not x.is_smart, x.broker_code))
    return result


@router.get(
    "/whales/{broker_code}",
    response_model=BrokerWhalesDetailResponse,
    summary="Analisis portofolio akumulasi dan distribusi broker tertentu (Whales Tracker)",
)
def get_whale_detail(
    broker_code: str,
    days: int = Query(20, ge=1, le=100, description="Jumlah hari bursa terakhir"),
    limit: int = Query(20, ge=1, le=100, description="Maksimal emiten per daftar"),
    db: Session = Depends(get_db),
) -> BrokerWhalesDetailResponse:
    code = broker_code.upper().strip()

    date_stmt = (
        select(BrokerActivity.date)
        .where(BrokerActivity.broker_code == code)
        .distinct()
        .order_by(desc(BrokerActivity.date))
        .limit(days)
    )
    trading_dates = db.execute(date_stmt).scalars().all()
    if not trading_dates:
        raise HTTPException(
            status_code=404,
            detail=f"Tidak ada data aktivitas transaksi untuk broker '{code}'",
        )

    end_date = max(trading_dates)
    start_date = min(trading_dates)

    agg_query = text("""
        SELECT 
            ticker,
            COALESCE(SUM(buy_value), 0) AS total_buy,
            COALESCE(SUM(sell_value), 0) AS total_sell,
            COALESCE(SUM(net_value), 0) AS total_net,
            COALESCE(SUM(buy_lot - sell_lot), 0) AS net_lot,
            CASE WHEN SUM(buy_lot) > 0 THEN SUM(buy_value) / (SUM(buy_lot) * 100) ELSE NULL END AS buy_avg_price,
            CASE WHEN SUM(sell_lot) > 0 THEN SUM(sell_value) / (SUM(sell_lot) * 100) ELSE NULL END AS sell_avg_price
        FROM broker_activity
        WHERE broker_code = :code AND date >= :start_date AND date <= :end_date
        GROUP BY ticker
    """)
    rows = db.execute(agg_query, {
        "code": code,
        "start_date": start_date,
        "end_date": end_date,
    }).fetchall()

    accumulations: list[WhaleStockItem] = []
    distributions: list[WhaleStockItem] = []
    total_buy = 0.0
    total_sell = 0.0
    total_net = 0.0

    for r in rows:
        t_buy = float(r.total_buy or 0)
        t_sell = float(r.total_sell or 0)
        t_net = float(r.total_net or 0)
        n_lot = float(r.net_lot or 0)
        b_avg = float(r.buy_avg_price) if r.buy_avg_price is not None else None
        s_avg = float(r.sell_avg_price) if r.sell_avg_price is not None else None

        total_buy += t_buy
        total_sell += t_sell
        total_net += t_net

        item = WhaleStockItem(
            ticker=r.ticker,
            net_value=round(t_net, 2),
            buy_value=round(t_buy, 2),
            sell_value=round(t_sell, 2),
            net_lot=round(n_lot, 2),
            buy_avg_price=round(b_avg, 2) if b_avg is not None else None,
            sell_avg_price=round(s_avg, 2) if s_avg is not None else None,
        )

        if t_net > 0:
            accumulations.append(item)
        elif t_net < 0:
            distributions.append(item)

    accumulations.sort(key=lambda x: x.net_value, reverse=True)
    distributions.sort(key=lambda x: x.net_value, reverse=False)

    prof = broker_profile_of(code)
    label, desc_text = PROFILE_META.get(prof, ("Lainnya", "Profil broker lainnya"))

    return BrokerWhalesDetailResponse(
        broker_code=code,
        profile=prof,
        profile_label=label,
        profile_desc=desc_text,
        is_smart=prof in SMART_PROFILES,
        period_days=len(trading_dates),
        start_date=start_date,
        end_date=end_date,
        total_buy_value=round(total_buy, 2),
        total_sell_value=round(total_sell, 2),
        total_net_value=round(total_net, 2),
        top_accumulations=accumulations[:limit],
        top_distributions=distributions[:limit],
    )

