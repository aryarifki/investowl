from fastapi import APIRouter, HTTPException
import sys
from pathlib import Path
from sqlalchemy import text

_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_ROOT / "src"))

from idx_bandarmology import storage, universe

router = APIRouter()

@router.get("/available_tickers")
async def get_available_tickers():
    try:
        # Coba ambil daftar ticker unik langsung dari tabel broker_flow di PostgreSQL
        if hasattr(storage, 'engine') and storage.engine is not None:
            with storage.engine.connect() as conn:
                res = conn.execute(text("SELECT DISTINCT ticker FROM broker_flow ORDER BY ticker"))
                tickers = [row[0] for row in res.fetchall()]
                if tickers:
                    return {"tickers": tickers}
        
        # Fallback jika tabel kosong atau tidak bisa diakses
        return {"tickers": universe.get_universe("idx80")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
