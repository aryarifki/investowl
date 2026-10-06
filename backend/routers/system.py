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

# Definisi Registry Job SMtracker Lengkap
JOB_CONFIGS = {
    "scanner": {
        "label": "Scanner",
        "script": "scanner.py",
        "log_prefix": "scanner",
        "description": "AI & Smart Money Stock Scanner (Wyckoff + Flow)",
        "category": "daily",
        "supports_universe": False,
        "supports_window": False,
        "params": [],
    },
    "auditor": {
        "label": "Auditor",
        "script": "auditor.py",
        "log_prefix": "auditor",
        "description": "Evaluasi sinyal OPEN & Update TP/SL ke Telegram",
        "category": "daily",
        "supports_universe": False,
        "supports_window": False,
        "params": [],
    },
    "backfill": {
        "label": "Daily Backfill",
        "script": "backfill_daily.py",
        "log_prefix": "backfill",
        "description": "Backfill data transaksi & broker harian (IDX + Stockbit)",
        "category": "daily",
        "supports_universe": True,
        "supports_window": False,
        "params": ["universe", "days", "force", "rate_limit"],
    },
    "backfill_monthly": {
        "label": "Monthly Backfill",
        "script": "backfill_monthly.py",
        "log_prefix": "backfill_monthly",
        "description": "Backfill data broker bulanan historis (Hybrid IDX Sequential + Stockbit)",
        "category": "maintenance",
        "supports_universe": True,
        "supports_window": False,
        "params": ["universe", "months", "force", "rate_limit", "status_only"],
    },
    "etl_flow": {
        "label": "ETL Foreign Flow",
        "script": "etl_foreign_flow.py",
        "log_prefix": "etl_flow",
        "description": "Komputasi analitik Foreign Flow (HMM, VAR, Network, Heatmap)",
        "category": "daily",
        "supports_universe": True,
        "supports_window": True,
        "params": ["universe", "windows", "workers"],
    },
    "backfill_fundamentals": {
        "label": "Fundamentals & Governance",
        "script": "backfill_fundamentals.py",
        "log_prefix": "cron_fundamentals",
        "description": "Tarik data fundamental, rasio finansial, corporate actions, dan governance dari IDX",
        "category": "maintenance",
        "supports_universe": False,
        "supports_window": False,
        "params": ["details", "only_missing", "ratios", "actions", "year", "quarter"],
    },
    "db_audit": {
        "label": "DB Health Audit",
        "script": "db_daily_audit.py",
        "log_prefix": "db_audit",
        "description": "Audit integritas database, self-healing, dan vacuuming",
        "category": "daily",
        "supports_universe": False,
        "supports_window": False,
        "params": ["autofix", "vacuum", "notify", "alert_only", "audit_date"],
    },
    "pipeline": {
        "label": "Full Pipeline",
        "script": "run_daily.sh",
        "log_prefix": "cron_daily",
        "description": "Pipeline Harian Lengkap (Backfill + DB Audit + ETL + Audit + Scanner + Backup)",
        "is_shell": True,
        "category": "pipeline",
        "supports_universe": False,
        "supports_window": False,
        "params": [],
    },
    "backup": {
        "label": "Database Backup",
        "script": "auto_backup.sh",
        "log_prefix": "backup",
        "description": "Pencadangan database PostgreSQL (pg_dump) & sync Google Drive",
        "is_shell": True,
        "category": "maintenance",
        "supports_universe": False,
        "supports_window": False,
        "params": [],
    },
}

# Runtime tracking in-memory (per worker)
_RUNNING_JOBS: dict[str, dict[str, Any]] = {}
_LAST_RUN_RESULTS: dict[str, dict[str, Any]] = {}


class JobRunRequest(BaseModel):
    # Parameter Universe & Timeframe
    universe: str | None = Field(default=None, description="Pilihan universe (watchlist, idx80, all)")
    days: int | None = Field(default=1, description="Jumlah hari ke belakang untuk backfill harian")
    months: str | None = Field(default=None, description="Bulan untuk monthly backfill (all, last3, last6, YYYY-MM)")
    windows: list[int] | None = Field(default=None, description="Pilihan lookback window (misal: [20, 60])")
    workers: int | None = Field(default=None, description="Jumlah worker paralel untuk ETL")
    force: bool = Field(default=False, description="Paksa jalankan ulang data yang sudah ada")
    rate_limit: float | None = Field(default=None, description="Rate limit broker API (requests per minute)")

    # Parameter Fundamental & Governance
    details: bool = Field(default=False, description="Ambil Company Details (Governance, Direksi, Pemegang Saham)")
    only_missing: bool = Field(default=False, description="Hanya ambil emiten yang belum ada di database")
    ratios: bool = Field(default=False, description="Ambil Financial Ratios")
    actions: bool = Field(default=False, description="Ambil Corporate Actions")
    year: int | None = Field(default=None, description="Tahun laporan keuangan (misal: 2024, 2025)")
    quarter: int | None = Field(default=4, description="Kuartal laporan keuangan (1-4)")

    # Parameter DB Health Audit
    autofix: bool = Field(default=True, description="Perbaiki anomali data otomatis")
    vacuum: bool = Field(default=True, description="Jalankan VACUUM ANALYZE pada tabel")
    notify: bool = Field(default=True, description="Kirim ringkasan laporan ke Telegram")
    alert_only: bool = Field(default=False, description="Hanya audit tanpa perbaikan (Read-only mode aman)")
    audit_date: str | None = Field(default=None, description="Tanggal audit spesifik (YYYY-MM-DD)")

    # Safe Mode & Testing Flags (Zero Mutation ke Database)
    dry_run: bool = Field(default=False, description="Simulasi penyusunan perintah tanpa mengeksekusi ke OS / database")
    status_only: bool = Field(default=False, description="Cek status tanggal database saja (untuk monthly backfill)")


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
                "category": config.get("category", "daily"),
                "status": "running",
                "pid": proc.pid,
                "started_at": info["started_at"].isoformat(),
                "elapsed_seconds": elapsed,
                "log_file": info.get("log_file"),
                "supports_universe": config.get("supports_universe", False),
                "supports_window": config.get("supports_window", False),
                "params": config.get("params", []),
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
            "category": config.get("category", "daily"),
            "status": "running",
            "pid": ext_pid,
            "is_external": True,
            "supports_universe": config.get("supports_universe", False),
            "supports_window": config.get("supports_window", False),
            "params": config.get("params", []),
        }

    # 3. Job dalam kondisi Idle
    last_run = _LAST_RUN_RESULTS.get(job_name, {})
    return {
        "key": job_name,
        "label": config.get("label", job_name),
        "description": config.get("description", ""),
        "category": config.get("category", "daily"),
        "status": last_run.get("status", "idle"),
        "pid": None,
        "last_finished_at": last_run.get("finished_at"),
        "last_exit_code": last_run.get("exit_code"),
        "last_log_file": last_run.get("log_file"),
        "supports_universe": config.get("supports_universe", False),
        "supports_window": config.get("supports_window", False),
        "params": config.get("params", []),
    }


def get_latest_log(prefix: str) -> str:
    """Mencari dan membaca file log terbaru berdasarkan prefix (misal: scanner_*.log atau cron_*.log)."""
    if not LOG_DIR.exists():
        return f"Error: Folder log tidak ditemukan di {LOG_DIR}. Pastikan path sudah benar."

    files = glob.glob(str(LOG_DIR / f"{prefix}_*.log"))
    standalone = LOG_DIR / f"{prefix}.log"
    if standalone.exists() and str(standalone) not in files:
        files.append(str(standalone))

    if not files:
        return f"Belum ada log untuk '{prefix}'. Siap dijalankan kapan saja."

    latest_file = max(files, key=os.path.getmtime)
    try:
        with open(latest_file, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()[-1000:]
            return "".join(lines)
    except Exception as e:
        return f"Error membaca file {latest_file}: {e}"


def build_job_command(job_name: str, cfg: dict[str, Any], req: JobRunRequest) -> list[str]:
    """Menyusun argumen baris perintah CLI secara aman, valid, dan non-interaktif."""
    if cfg.get("is_shell"):
        return ["/bin/bash", str(SMTRACKER_DIR / cfg["script"])]

    cmd = [str(PYTHON_BIN), cfg["script"]]

    # 1. Backfill Daily
    if job_name == "backfill":
        cmd.extend(["--universe", req.universe or "all"])
        if req.days and req.days > 1:
            cmd.extend(["--days", str(req.days)])
        if req.force:
            cmd.append("--force")
        if req.rate_limit and req.rate_limit > 0:
            cmd.extend(["--rate-limit", str(req.rate_limit)])

    # 2. Backfill Monthly
    elif job_name == "backfill_monthly":
        cmd.extend(["--universe", req.universe or "all"])
        if req.status_only:
            cmd.append("--status")
        else:
            cmd.extend(["--months", req.months or "last3"])
            if req.force:
                cmd.append("--force")
            if req.rate_limit and req.rate_limit > 0:
                cmd.extend(["--rate-limit", str(req.rate_limit)])
            # Selalu tambahkan -y untuk eksekusi non-interaktif (anti-hang)
            cmd.append("-y")

    # 3. ETL Foreign Flow
    elif job_name == "etl_flow":
        cmd.extend(["--universe", req.universe or "watchlist"])
        windows = req.windows if (req.windows and len(req.windows) > 0) else [20, 60]
        cmd.extend(["--window"] + [str(w) for w in windows])
        if req.workers and req.workers > 0:
            cmd.extend(["--workers", str(req.workers)])

    # 4. Backfill Fundamentals & Governance
    elif job_name == "backfill_fundamentals":
        has_selection = req.details or req.ratios or req.actions
        # Jika belum ada yang dipilih, default ke details + only-missing
        if not has_selection or req.details:
            cmd.append("--details")
        if req.only_missing:
            cmd.append("--only-missing")
        if req.ratios:
            cmd.append("--ratios")
            curr_year = datetime.now().year
            selected_year = req.year if (req.year and req.year >= 2000) else curr_year
            selected_q = req.quarter if (req.quarter and 1 <= req.quarter <= 4) else 4
            cmd.extend(["--year", str(selected_year), "--quarter", str(selected_q)])
        if req.actions:
            cmd.append("--actions")

    # 5. DB Health Audit
    elif job_name == "db_audit":
        if req.alert_only:
            cmd.append("--alert-only")
        else:
            if req.autofix:
                cmd.append("--autofix")
            if req.vacuum:
                cmd.append("--vacuum")
            if req.notify:
                cmd.append("--notify")
        if req.audit_date:
            cmd.extend(["--date", req.audit_date])

    # 6. Scanner / Auditor (tanpa argumen tambahan)
    elif job_name in ("scanner", "auditor"):
        pass

    return cmd


# ── ENDPOINTS ─────────────────────────────────────────────────────────────────

@router.get("/daily")
def get_daily_logs():
    """Endpoint bawaan untuk kompatibilitas penuh: mengambil log terbaru dari sistem SMtracker."""
    return {
        "timestamp": datetime.now().isoformat(),
        "logs": {
            job_key: get_latest_log(cfg.get("log_prefix", job_key))
            for job_key, cfg in JOB_CONFIGS.items()
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
    """Menjalankan job automation secara manual dari UI dengan proteksi concurrency dan mode dry-run."""
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
    cmd = build_job_command(job_name, cfg, req)

    # ── DRY RUN MODE (Simulasi Aman: 100% Zero Mutasi Database) ──
    if req.dry_run:
        return {
            "status": "dry_run",
            "job": job_name,
            "label": cfg.get("label", job_name),
            "command": " ".join(cmd),
            "cmd_args": cmd,
            "cwd": str(SMTRACKER_DIR),
            "message": "Simulasi berhasil! Sintaks perintah valid dan tidak ada proses yang dijalankan ke database.",
        }

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    today_str = datetime.now().strftime("%Y%m%d")
    log_prefix = cfg.get("log_prefix", job_name)
    log_file_path = LOG_DIR / f"{log_prefix}_{today_str}.log"

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
def get_log_history(job: str = Query(..., description="Key job (scanner, auditor, backfill, etl_flow, etc.)")):
    """Mengambil daftar riwayat file log yang tersedia untuk job tertentu."""
    if not LOG_DIR.exists():
        return {"job": job, "files": []}

    cfg = JOB_CONFIGS.get(job, {})
    prefix = cfg.get("log_prefix", job)
    pattern = str(LOG_DIR / f"{prefix}_*.log")
    matched_files = glob.glob(pattern)

    standalone = LOG_DIR / f"{prefix}.log"
    if standalone.exists() and str(standalone) not in matched_files:
        matched_files.append(str(standalone))

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


@router.delete("/clear")
def clear_logs(
    filename: str | None = Query(default=None, description="Nama file log spesifik yang ingin dihapus"),
    job: str | None = Query(default=None, description="Key job untuk menghapus log terkait"),
    clear_all: bool = Query(default=False, description="Hapus seluruh file log di direktori debug"),
):
    """Menghapus atau membersihkan file log secara aman."""
    if not LOG_DIR.exists():
        return {"status": "success", "message": "Direktori log tidak ditemukan.", "deleted_count": 0}

    deleted_files: list[str] = []

    # 1. Hapus file spesifik
    if filename and filename != "latest":
        clean_name = os.path.basename(filename)
        target_path = LOG_DIR / clean_name
        if target_path.exists() and target_path.is_file():
            try:
                target_path.unlink()
                deleted_files.append(clean_name)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Gagal menghapus file {clean_name}: {e}")
        else:
            raise HTTPException(status_code=404, detail=f"File log '{clean_name}' tidak ditemukan.")

    # 2. Hapus semua file log untuk job tertentu
    elif job:
        cfg = JOB_CONFIGS.get(job, {})
        prefix = cfg.get("log_prefix", job)
        pattern = str(LOG_DIR / f"{prefix}_*.log")
        matched = glob.glob(pattern)
        standalone = LOG_DIR / f"{prefix}.log"
        if standalone.exists() and str(standalone) not in matched:
            matched.append(str(standalone))

        for f_str in matched:
            p = Path(f_str)
            if p.is_file():
                try:
                    p.unlink()
                    deleted_files.append(p.name)
                except Exception:
                    pass

    # 3. Hapus seluruh file log di folder debug
    elif clear_all:
        for p in LOG_DIR.glob("*.log"):
            if p.is_file():
                try:
                    p.unlink()
                    deleted_files.append(p.name)
                except Exception:
                    pass
    else:
        # Default fallback: jika filename == "latest", hapus log file terbaru dari job aktif bila disertakan
        raise HTTPException(status_code=400, detail="Parameter filename, job, atau clear_all harus disertakan.")

    return {
        "status": "success",
        "deleted_count": len(deleted_files),
        "deleted_files": deleted_files,
        "message": f"Berhasil menghapus {len(deleted_files)} file log.",
    }


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
