from fastapi import APIRouter, HTTPException
import sys
from pathlib import Path
from sqlalchemy import text
import requests
import time

_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_ROOT / "src"))

from idx_bandarmology import storage, universe

router = APIRouter()

def scrape_idx_tickers():
    """
    Mengadopsi logika NeaByteLab/IDX-API (TypeScript) ke Python 
    untuk menembus WAF 403 Forbidden IDX.
    """
    session = requests.Session()
    
    # Header persis seperti NeaByteLab/IDX-API
    headers = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
        'Referer': 'https://www.idx.co.id/',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
    }
    
    # Langkah 1: Session Warming (Ambil Cookie)
    session.get("https://www.idx.co.id/id", headers=headers, timeout=15)
    time.sleep(1) # Jeda 1 detik seperti di repository asli
    
    # Langkah 2: Validasi sesi dengan GetIndexList
    headers['X-Requested-With'] = 'XMLHttpRequest'
    session.get("https://www.idx.co.id/primary/home/GetIndexList", headers=headers, timeout=15)
    time.sleep(1)
    
    # Langkah 3: Tarik data saham
    url = "https://www.idx.co.id/primary/ListedCompany/GetCompanyProfiles?start=0&length=9999"
    resp = session.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    data = resp.json().get("data", [])
    
    tickers = []
    for row in data:
        code = row.get("KodeEmiten")
        name = row.get("NamaEmiten")
        if code:
            tickers.append({"ticker": code.upper().strip(), "name": name})
    return tickers

@router.get("/available_tickers")
async def get_available_tickers():
    try:
        if hasattr(storage, 'engine') and storage.engine is not None:
            with storage.engine.connect() as conn:
                # Coba ambil dari tabel tickers
                res = conn.execute(text("SELECT ticker FROM tickers WHERE is_active = TRUE ORDER BY ticker"))
                db_tickers = [row[0] for row in res.fetchall()]
                if db_tickers:
                    return {"tickers": db_tickers, "count": len(db_tickers)}
                
                # Fallback ke broker_flow
                res = conn.execute(text("SELECT DISTINCT ticker FROM broker_flow ORDER BY ticker"))
                bf_tickers = [row[0] for row in res.fetchall()]
                if bf_tickers:
                    return {"tickers": bf_tickers, "count": len(bf_tickers)}
        
        u = universe.get_universe("idx80")
        return {"tickers": u, "count": len(u)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync_latest_data")
async def sync_latest_data():
    try:
        scraped_tickers = []
        try:
            # Menggunakan trik bypass WAF yang baru
            scraped_tickers = scrape_idx_tickers()
            print(f"[stocks] Berhasil scrape {len(scraped_tickers)} saham dari IDX.")
        except Exception as scrape_err:
            print(f"[stocks] Scrape gagal: {scrape_err}. Fallback ke modul universe lama...")
            universe.refresh_master_tickers(force=True)
        
        active_count = 0
        if scraped_tickers and hasattr(storage, 'engine') and storage.engine is not None:
            with storage.engine.begin() as conn:
                conn.execute(text("CREATE TABLE IF NOT EXISTS tickers (ticker VARCHAR(20) PRIMARY KEY, name VARCHAR(200), is_active BOOLEAN DEFAULT TRUE)"))
                conn.execute(text("UPDATE tickers SET is_active = FALSE"))
                
                for t in scraped_tickers:
                    conn.execute(text("""
                        INSERT INTO tickers (ticker, name, is_active) 
                        VALUES (:ticker, :name, TRUE) 
                        ON CONFLICT (ticker) DO UPDATE SET name=EXCLUDED.name, is_active=TRUE
                    """), {"ticker": t["ticker"], "name": t["name"]})
                
                res = conn.execute(text("SELECT COUNT(*) FROM tickers WHERE is_active = TRUE"))
                active_count = res.fetchone()[0]
        else:
            active_count = len(universe.get_universe("idx80"))
            
        latest_broker_date = None
        latest_price_date = None
        
        if hasattr(storage, 'engine') and storage.engine is not None:
            with storage.engine.connect() as conn:
                res = conn.execute(text("SELECT MAX(date) FROM broker_flow"))
                row = res.fetchone()
                if row and row[0]: latest_broker_date = str(row[0])
                
                res = conn.execute(text("SELECT MAX(date) FROM prices"))
                row = res.fetchone()
                if row and row[0]: latest_price_date = str(row[0])
                    
        return {
            "status": "success", 
            "message": f"Berhasil menyinkronkan {active_count} saham aktif.",
            "active_count": active_count,
            "latest_broker_date": latest_broker_date,
            "latest_price_date": latest_price_date
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal sinkronisasi: {str(e)}")
