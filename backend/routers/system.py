# routers/system.py
from __future__ import annotations

import glob
import os
import signal
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/logs", tags=["System Logs"])

# Path direktori SMtracker dan folder debug
SMTRACKER_DIR = Path("/root/SMtracker")
LOG_DIR = SMTRACKER_DIR / "debug"
PYTHON_BIN = SMTRACKER_DIR / "venv" / "bin" / "python3"
if not PYTHON_BIN.exists():
    PYTHON_BIN = Path(sys.executable)

# Definisi Registry Job
JOB_CONFIGS = {
    "scanner": {
        "label": "Scanner",
        "script": "scanner.py",
        "description": "AI & Smart Money Stock Scanner (Wyckoff + Flow)",
        "supports_universe": False,
        "supports_window": False,
    },
    "auditor": {
        "label": "Auditor",
        "script": "auditor.py",
        "description": "Evaluasi sinyal OPEN & Update TP/SL ke Telegram",
        "supports_universe": False,
        "supports_window": False,
    },
    "backfill": {
        "label": "Backfill",
        "script": "backfill_daily.py",
        "description": "Backfill data transaksi & broker harian (IDX + Stockbit)",
        "supports_universe": True,
        "supports_window": False,
    },
    "etl_flow": {
        "label": "ETL Flow",
        "script": "etl_foreign_flow.py",
        "description": "Komputasi analitik Foreign Flow (HMM, VAR, Network, Heatmap)",
        "supports_universe": True,
        "supports_window": True,
    },
    "pipeline": {
        "label": "Full Pipeline",
        "script": "run_daily.sh",
        "description": "Pipeline Harian Lengkap (Backfill + DB Audit + ETL + Audit + Scanner + Backup)",
        "is_shell": True,
        "supports_universe": False,
        "supports_window": False,
    },
}

# Runtime tracking in-memory (per worker)
_RUNNING_JOBS: dict[str, dict[str, Any]] = {}
_LAST_RUN_RESULTS: dict[str, dict[str, Any]] = {}


class JobRunRequest(BaseModel):
    universe: str | None = Field(default=None, description="Pilihan universe (watchlist, idx80, all)")
    windows: list[int] | None = Field(default=None, description="Pilihan lookback window (misal: [20, 60])")
    days: int | None = Field(default=1, description="Jumlah hari ke belakang untuk backfill")
    force: bool = Field(default=False, description="Paksa jalankan ulang")


def _is_pid_alive(pid: int) -> bool:
    """Cek apakah PID masih aktif di sistem operasi."""
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def _find_external_script_pid(script_name: str) -> int | None:
    """Deteksi jika script sedang berjalan di luar API (misal dijalankan lewat cron atau CLI manual)."""
    try:
        current_pid = os.getpid()
        for pid_entry in os.listdir("/proc"):
            if pid_entry.isdigit() and int(pid_entry) != current_pid:
                try:
                    with open(f"/proc/{pid_entry}/cmdline", "rb") as f:
                        cmd = f.read().decode("utf-8", errors="ignore").replace("\x00", " ")
                        if script_name in cmd:
                            return int(pid_entry)
                except Exception:
                    continue
    except Exception:
        pass
    return None


def _check_and_update_job_status(job_name: str) -> dict[str, Any]:
    """Cek status proses saat ini, hitung durasi, dan perbarui state internal."""
    config = JOB_CONFIGS.get(job_name, {})
    script_name = config.get("script", "")
    info = _RUNNING_JOBS.get(job_name)

    # 1. Cek dari dictionary proses yang di-spawn API
    if info:
        proc: subprocess.Popen = info.get("process")
        poll_status = proc.poll()
        if poll_status is None:
            # Masih aktif berjalan
            elapsed = int((datetime.now() - info["started_at"]).total_seconds())
            return {
                "key": job_name,
                "label": config.get("label", job_name),
                "description": config.get("description", ""),
                "status": "running",
                "pid": proc.pid,
                "started_at": info["started_at"].isoformat(),
                "elapsed_seconds": elapsed,
                "log_file": info.get("log_file"),
                "supports_universe": config.get("supports_universe", False),
                "supports_window": config.get("supports_window", False),
            }
        else:
            # Proses baru saja selesai
            _LAST_RUN_RESULTS[job_name] = {
                "finished_at": datetime.now().isoformat(),
                "exit_code": poll_status,
                "status": "success" if poll_status == 0 else "failed",
                "log_file": info.get("log_file"),
            }
            # Tutup file handle log
            try:
                info.get("file_handle") and info["file_handle"].close()
            except Exception:
                pass
            del _RUNNING_JOBS[job_name]

    # 2. Cek apakah berjalan secara eksternal (cron atau CLI)
    ext_pid = _find_external_script_pid(script_name)
    if ext_pid:
        return {
            "key": job_name,
            "label": config.get("label", job_name),
            "description": config.get("description", ""),
            "status": "running",
            "pid": ext_pid,
            "is_external": True,
            "supports_universe": config.get("supports_universe", False),
            "supports_window": config.get("supports_window", False),
        }

    # 3. Job dalam kondisi Idle
    last_run = _LAST_RUN_RESULTS.get(job_name, {})
    return {
        "key": job_name,
        "label": config.get("label", job_name),
        "description": config.get("description", ""),
        "status": last_run.get("status", "idle"),
        "pid": None,
        "last_finished_at": last_run.get("finished_at"),
        "last_exit_code": last_run.get("exit_code"),
        "last_log_file": last_run.get("log_file"),
        "supports_universe": config.get("supports_universe", False),
        "supports_window": config.get("supports_window", False),
    }


def get_latest_log(prefix: str) -> str:
    """Mencari dan membaca file log terbaru berdasarkan prefix (misal: scanner_*.log)."""
    if not LOG_DIR.exists():
        return f"Error: Folder log tidak ditemukan di {LOG_DIR}. Pastikan path sudah benar."

    files = glob.glob(str(LOG_DIR / f"{prefix}_*.log"))
    if not files:
        return f"Belum ada log untuk '{prefix}'. Siap dijalankan kapan saja."

    latest_file = max(files, key=os.path.getmtime)
    try:
        with open(latest_file, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()[-1000:]
            return "".join(lines)
    except Exception as e:
        return f"Error membaca file {latest_file}: {e}"


# ── ENDPOINTS ─────────────────────────────────────────────────────────────────

@router.get("/daily")
def get_daily_logs():
    """Endpoint bawaan untuk kompatibilitas penuh: mengambil log terbaru dari sistem SMtracker."""
    return {
        "timestamp": datetime.now().isoformat(),
        "logs": {
            "backfill": get_latest_log("backfill"),
            "etl_flow": get_latest_log("etl_flow"),
            "scanner": get_latest_log("scanner"),
            "auditor": get_latest_log("auditor"),
        },
    }


@router.get("/jobs/status")
def get_all_jobs_status():
    """Mendapatkan status real-time untuk semua job automation (Running, Idle, PID, durasi)."""
    results = {}
    for job_key in JOB_CONFIGS:
        results[job_key] = _check_and_update_job_status(job_key)
    return {"timestamp": datetime.now().isoformat(), "jobs": results}


@router.post("/jobs/{job_name}/run")
def trigger_job(job_name: str, req: JobRunRequest = JobRunRequest()):
    """Menjalankan job automation secara manual dari UI dengan proteksi concurrency."""
    if job_name not in JOB_CONFIGS:
        raise HTTPException(status_code=404, detail=f"Job '{job_name}' tidak terdaftar.")

    # Cek apakah job sedang berjalan
    status_info = _check_and_update_job_status(job_name)
    if status_info.get("status") == "running":
        pid = status_info.get("pid")
        raise HTTPException(
            status_code=409,
            detail=f"Job '{job_name}' sedang berjalan (PID: {pid}). Harap tunggu hingga selesai atau hentikan proses.",
        )

    # Cek jika pipeline penuh sedang berjalan
    if job_name != "pipeline":
        pipeline_status = _check_and_update_job_status("pipeline")
        if pipeline_status.get("status") == "running":
            raise HTTPException(
                status_code=409,
                detail="Full Pipeline sedang berjalan. Tidak disarankan menjalankan individual job bersamaan.",
            )

    cfg = JOB_CONFIGS[job_name]
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    today_str = datetime.now().strftime("%Y%m%d")
    log_file_path = LOG_DIR / f"{job_name}_{today_str}.log"

    # Susun perintah eksekusi
    cmd: list[str] = []
    if cfg.get("is_shell"):
        cmd = ["/bin/bash", str(SMTRACKER_DIR / cfg["script"])]
    else:
        cmd = [str(PYTHON_BIN), cfg["script"]]
        if cfg.get("supports_universe"):
            u = req.universe or "watchlist"
            cmd.extend(["--universe", u])
        if cfg.get("supports_window") and req.windows:
            cmd.extend(["--window"] + [str(w) for w in req.windows])
        if job_name == "backfill" and req.days and req.days > 1:
            cmd.extend(["--days", str(req.days)])
        if req.force:
            cmd.append("--force")

    # Buka file log (append mode) dan tulis banner penanda
    f_handle = open(log_file_path, "a", encoding="utf-8")
    banner = (
        f"\n\n{'='*60}\n"
        f"🚀 MANUAL TRIGGER [{job_name.upper()}] PADA {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"Perintah : {' '.join(cmd)}\n"
        f"{'='*60}\n\n"
    )
    f_handle.write(banner)
    f_handle.flush()

    env = dict(os.environ)
    env["PYTHONPATH"] = str(SMTRACKER_DIR / "src")

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(SMTRACKER_DIR),
            stdout=f_handle,
            stderr=subprocess.STDOUT,
            env=env,
            start_new_session=True,  # Detach process group
        )
    except Exception as e:
        f_handle.close()
        raise HTTPException(status_code=500, detail=f"Gagal menjalankan subprocess: {e}")

    _RUNNING_JOBS[job_name] = {
        "process": proc,
        "pid": proc.pid,
        "started_at": datetime.now(),
        "log_file": log_file_path.name,
        "file_handle": f_handle,
        "cmd": cmd,
    }

    return {
        "status": "started",
        "job": job_name,
        "pid": proc.pid,
        "log_file": log_file_path.name,
        "command": " ".join(cmd),
    }


@router.post("/jobs/{job_name}/stop")
def stop_job(job_name: str):
    """Menghentikan proses job yang sedang berjalan secara paksa/aman."""
    status_info = _check_and_update_job_status(job_name)
    pid = status_info.get("pid")

    if not pid:
        raise HTTPException(status_code=400, detail=f"Tidak ada proses aktif untuk job '{job_name}'.")

    try:
        # Kirim SIGTERM terlebih dahulu
        os.kill(pid, signal.SIGTERM)
        # Hapus dari tracking internal jika ada
        if job_name in _RUNNING_JOBS:
            info = _RUNNING_JOBS.pop(job_name)
            try:
                info.get("file_handle") and info["file_handle"].close()
            except Exception:
                pass
        _LAST_RUN_RESULTS[job_name] = {
            "finished_at": datetime.now().isoformat(),
            "exit_code": -15,
            "status": "stopped",
        }
        return {"status": "stopped", "job": job_name, "pid": pid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menghentikan PID {pid}: {e}")


@router.get("/history")
def get_log_history(job: str = Query(..., description="Key job (scanner, auditor, backfill, etl_flow)")):
    """Mengambil daftar riwayat file log yang tersedia untuk job tertentu."""
    if not LOG_DIR.exists():
        return {"job": job, "files": []}

    pattern = str(LOG_DIR / f"{job}_*.log")
    matched_files = glob.glob(pattern)

    # Urutkan berdasarkan waktu modifikasi terbaru
    matched_files.sort(key=os.path.getmtime, reverse=True)

    history = []
    for fp in matched_files[:15]:  # Ambil maksimal 15 file log terakhir
        p = Path(fp)
        stat = p.stat()
        history.append({
            "filename": p.name,
            "size_bytes": stat.st_size,
            "size_kb": round(stat.st_size / 1024, 1),
            "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })

    return {"job": job, "files": history}


@router.get("/view")
def view_specific_log(filename: str = Query(..., description="Nama file log (misal: scanner_20261005.log)")):
    """Membaca isi file log spesifik dengan sanitasi path traversal."""
    # Proteksi keamanan path traversal
    clean_name = os.path.basename(filename)
    target_path = LOG_DIR / clean_name

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail=f"File log '{clean_name}' tidak ditemukan.")

    try:
        with open(target_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()[-1000:]
            content = "".join(lines)
            return {
                "filename": clean_name,
                "lines_count": len(lines),
                "content": content,
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error membaca file {clean_name}: {e}")


@router.get("/cache/stats")
def get_cache_stats():
    """Melihat status koneksi Redis dan jumlah key ter-cache."""
    from core.cache import cache
    return cache.get_stats()


@router.post("/cache/purge")
def purge_cache(pattern: str = "*"):
    """Membersihkan cache (bisa per pola, misal 'signal:*' atau '*')."""
    from core.cache import invalidate_cache
    deleted_count = invalidate_cache(pattern)
    return {"status": "success", "deleted_keys": deleted_count, "pattern": pattern}
