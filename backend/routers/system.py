# routers/system.py
import os
import glob
from fastapi import APIRouter
from pathlib import Path
from datetime import datetime

router = APIRouter(prefix="/api/logs", tags=["System Logs"])

# Path absolut menuju folder debug SMtracker
LOG_DIR = Path("/root/SMtracker/debug")

def get_latest_log(prefix: str) -> str:
    """Mencari dan membaca file log terbaru berdasarkan prefix (misal: scanner_*.log)."""
    if not LOG_DIR.exists():
        return f"Error: Folder log tidak ditemukan di {LOG_DIR}. Pastikan path sudah benar."
        
    files = glob.glob(str(LOG_DIR / f"{prefix}_*.log"))
    if not files:
        return f"Belum ada log untuk '{prefix}'. Menunggu cronjob berjalan malam ini..."
        
    # Ambil file yang paling baru diubah
    latest_file = max(files, key=os.path.getmtime)
    
    try:
        with open(latest_file, 'r', encoding='utf-8') as f:
            # Ambil 1000 baris terakhir agar tidak membebani browser
            lines = f.readlines()[-1000:]
            return "".join(lines)
    except Exception as e:
        return f"Error membaca file {latest_file}: {e}"

@router.get("/daily")
def get_daily_logs():
    """Endpoint untuk mengambil log terbaru dari sistem SMtracker."""
    return {
        "timestamp": datetime.now().isoformat(),
        "logs": {
            "backfill": get_latest_log("backfill"),
            "etl_flow": get_latest_log("etl_flow"),
            "scanner": get_latest_log("scanner"),
            "auditor": get_latest_log("auditor")
        }
    }
