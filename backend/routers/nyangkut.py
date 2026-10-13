"""FastAPI Router for Dashboard Nyangkut (Retail Underwater & Ownership Metrics)."""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from core.cache import cached
from schemas import (
    NyangkutStockDataResponse,
    LeaderboardHeroItem,
    NyangkutLeaderboardResponse,
    TickerSearchResult,
)
from services.nyangkut_service import (
    get_or_calculate_nyangkut_data,
    get_leaderboard,
    get_nyangkut_summary_stats,
    search_tickers_prediction,
)

router = APIRouter(tags=["Dashboard Nyangkut"])


@router.get(
    "/api/v1/stock/{ticker}/nyangkut-tracker",
    response_model=NyangkutStockDataResponse,
    summary="Data lengkap kepemilikan saham & deteksi zona nyangkut investor ritel",
)
@router.get(
    "/api/nyangkut/stock/{ticker}",
    response_model=NyangkutStockDataResponse,
    summary="Alias: Data lengkap kepemilikan saham & deteksi zona nyangkut",
)
@cached(ttl_seconds=3600, prefix="nyangkut_tracker")
def get_stock_nyangkut_tracker(
    ticker: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Mengembalikan metrik kepemilikan saham (Donut Chart), Nyangkut Meter, Volume Nodes, dan Skor PBI/RAR."""
    ticker_clean = ticker.strip().upper()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Ticker saham tidak valid")
    try:
        data = get_or_calculate_nyangkut_data(ticker_clean, db)
        return data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal memproses data nyangkut {ticker_clean}: {exc}")


@router.get(
    "/api/v1/nyangkut/leaderboard",
    response_model=list[LeaderboardHeroItem],
    summary="Leaderboard Pahlawan Bursa (saham dengan akumulasi ritel saat harga turun)",
)
@router.get(
    "/api/nyangkut/leaderboard",
    response_model=list[LeaderboardHeroItem],
    summary="Alias: Leaderboard Pahlawan Bursa",
)
@cached(ttl_seconds=3600, prefix="nyangkut_leaderboard")
def get_pahlawan_bursa_leaderboard(
    limit: int = Query(20, ge=1, le=100, description="Maksimal jumlah emiten dalam leaderboard"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Daftar peringkat saham yang paling banyak ditahan/diakumulasi oleh investor ritel ketika harga sedang turun."""
    try:
        return get_leaderboard(db, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal memuat leaderboard: {exc}")


@router.get(
    "/api/v1/nyangkut/summary",
    summary="Statistik makro ringkasan zona nyangkut dan pahlawan bursa",
)
@router.get(
    "/api/nyangkut/summary",
    summary="Alias: Statistik makro ringkasan zona nyangkut",
)
@cached(ttl_seconds=3600, prefix="nyangkut_summary")
def get_nyangkut_summary(
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Ringkasan statistik agregat bursa terkait persentase ritel nyangkut dan total investor yang dipantau."""
    try:
        return get_nyangkut_summary_stats(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal memuat ringkasan nyangkut: {exc}")


@router.get(
    "/api/v1/stock/search",
    response_model=list[TickerSearchResult],
    summary="Pencarian & prediksi otomatis kode saham dan nama emiten",
)
@router.get(
    "/api/nyangkut/search",
    response_model=list[TickerSearchResult],
    summary="Alias: Pencarian & prediksi emiten",
)
@cached(ttl_seconds=300, prefix="ticker_search")
def search_stocks(
    q: str = Query(..., min_length=1, description="Kata kunci ticker atau nama perusahaan"),
    limit: int = Query(8, ge=1, le=20, description="Batas hasil prediksi"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Prediksi ticker dan nama emiten saat pengguna mengetik huruf di kolom pencarian."""
    try:
        return search_tickers_prediction(q, db, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Gagal melakukan pencarian ticker: {exc}")

