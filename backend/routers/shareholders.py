"""Shareholders and Corporate Ownership Matrix endpoints."""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter(prefix="/api/bandar/shareholders", tags=["Shareholders & Ownership"])


def _classify_shareholder(name: str, pct: float, is_controlling: bool) -> str:
    name_clean = name.strip().lower()
    if is_controlling:
        return "controlling"
    if "treasury" in name_clean:
        return "treasury"
    if name_clean.startswith("masyarakat") or name_clean.startswith("publik"):
        return "public"
    if pct >= 5.0:
        return "substantial"
    return "management"


@router.get(
    "/top-cross-holdings",
    summary="Daftar entitas pengendali/pemegang saham multi-emiten di BEI",
)
def get_top_cross_holdings(
    limit: int = Query(25, ge=1, le=100, description="Jumlah maksimal entitas yang dikembalikan"),
    min_holdings: int = Query(2, ge=2, le=20, description="Minimal kepemilikan saham pada berapa emiten"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Mengembalikan daftar entitas/pemilik yang memiliki porsi saham di beberapa emiten sekaligus."""
    query = text("""
        SELECT 
            name, 
            COUNT(DISTINCT ticker) as ticker_count,
            SUM(pct) as total_pct,
            json_agg(
                json_build_object(
                    'ticker', ticker, 
                    'pct', pct, 
                    'is_controlling', is_controlling
                ) ORDER BY pct DESC
            ) as holdings
        FROM company_shareholders
        WHERE name NOT ILIKE 'Masyarakat%' 
          AND name NOT ILIKE 'Saham Treasury%' 
          AND name NOT ILIKE 'Publik%'
          AND name NOT IN ('-', 'Pengendali Saham', 'Non Pengendali Saham', 'Others', 'Lain-lain')
        GROUP BY name
        HAVING COUNT(DISTINCT ticker) >= :min_holdings
        ORDER BY ticker_count DESC, total_pct DESC, name ASC
        LIMIT :limit
    """)
    
    rows = db.execute(query, {"min_holdings": min_holdings, "limit": limit}).fetchall()
    
    results = []
    for r in rows:
        raw_holdings = r[3] or []
        formatted_holdings = [
            {
                "ticker": h.get("ticker", ""),
                "pct": round(float(h.get("pct", 0.0) or 0.0), 3),
                "is_controlling": bool(h.get("is_controlling", False)),
            }
            for h in raw_holdings
        ]
        results.append({
            "name": r[0],
            "ticker_count": int(r[1]),
            "total_pct": round(float(r[2] or 0.0), 2),
            "holdings": formatted_holdings,
        })
    
    return results


@router.get(
    "/search",
    summary="Pencarian entitas atau pemegang saham dan portofolio kepemilikannya",
)
def search_shareholders(
    q: str = Query(..., min_length=2, description="Kata kunci nama pemilik atau entitas"),
    limit: int = Query(30, ge=1, le=100, description="Maksimum hasil"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Cari entitas pemegang saham berdasarkan nama dan tampilkan seluruh emiten yang dimiliki."""
    search_term = f"%{q.strip()}%"
    
    query = text("""
        SELECT 
            name, 
            COUNT(DISTINCT ticker) as ticker_count,
            SUM(pct) as total_pct,
            json_agg(
                json_build_object(
                    'ticker', ticker, 
                    'pct', pct, 
                    'is_controlling', is_controlling
                ) ORDER BY pct DESC
            ) as holdings
        FROM company_shareholders
        WHERE name ILIKE :search_term
        GROUP BY name
        ORDER BY ticker_count DESC, total_pct DESC, name ASC
        LIMIT :limit
    """)
    
    rows = db.execute(query, {"search_term": search_term, "limit": limit}).fetchall()
    
    results = []
    for r in rows:
        raw_holdings = r[3] or []
        formatted_holdings = [
            {
                "ticker": h.get("ticker", ""),
                "pct": round(float(h.get("pct", 0.0) or 0.0), 3),
                "is_controlling": bool(h.get("is_controlling", False)),
            }
            for h in raw_holdings
        ]
        results.append({
            "name": r[0],
            "ticker_count": int(r[1]),
            "total_pct": round(float(r[2] or 0.0), 2),
            "holdings": formatted_holdings,
        })
    
    return {
        "query": q,
        "count": len(results),
        "results": results,
    }


@router.get(
    "/{ticker}",
    summary="Struktur pemegang saham lengkap untuk satu emiten",
)
def get_stock_shareholders(
    ticker: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Mengembalikan daftar pemegang saham, klasifikasi, serta ringkasan porsi pengendali vs publik."""
    norm_ticker = ticker.upper().replace(".JK", "").strip()
    
    query = text("""
        SELECT name, pct, is_controlling
        FROM company_shareholders
        WHERE ticker = :ticker
        ORDER BY pct DESC, name ASC
    """)
    
    rows = db.execute(query, {"ticker": norm_ticker}).fetchall()
    
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"Tidak ada data pemegang saham untuk ticker '{norm_ticker}'",
        )
    
    shareholders = []
    controlling_pct = 0.0
    other_substantial_pct = 0.0
    public_pct = 0.0
    treasury_pct = 0.0
    management_pct = 0.0
    controlling_entities = []
    
    for r in rows:
        name = r[0]
        pct = round(float(r[1] or 0.0), 4)
        is_ctrl = bool(r[2])
        cat = _classify_shareholder(name, pct, is_ctrl)
        
        if cat == "controlling":
            controlling_pct += pct
            controlling_entities.append(name)
        elif cat == "treasury":
            treasury_pct += pct
        elif cat == "public":
            public_pct += pct
        elif cat == "substantial":
            other_substantial_pct += pct
        else:
            management_pct += pct
        
        shareholders.append({
            "name": name,
            "pct": pct,
            "is_controlling": is_ctrl,
            "category": cat,
        })
    
    return {
        "ticker": norm_ticker,
        "count": len(shareholders),
        "shareholders": shareholders,
        "summary": {
            "controlling_pct": round(controlling_pct, 2),
            "other_substantial_pct": round(other_substantial_pct, 2),
            "public_pct": round(public_pct, 2),
            "treasury_pct": round(treasury_pct, 2),
            "management_pct": round(management_pct, 2),
            "free_float_est": round(public_pct, 2),
            "controlling_entities": controlling_entities,
        },
    }
