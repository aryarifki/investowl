"""
Tests for System Jobs Registry & Command Builder in InvestOwl Backend.
All tests use dry_run mode or isolated unit calls: ZERO MUTATION TO DATABASE.
"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from main import app
from routers.system import JOB_CONFIGS, JobRunRequest, build_job_command

client = TestClient(app)


def test_job_configs_registry_completeness():
    """Memastikan semua skrip SMtracker terdaftar lengkap di JOB_CONFIGS."""
    expected_jobs = [
        "scanner",
        "auditor",
        "backfill",
        "backfill_monthly",
        "etl_flow",
        "backfill_fundamentals",
        "db_audit",
        "pipeline",
        "backup",
    ]
    for key in expected_jobs:
        assert key in JOB_CONFIGS, f"Job {key} harus terdaftar di JOB_CONFIGS"
        cfg = JOB_CONFIGS[key]
        assert "label" in cfg
        assert "script" in cfg
        assert "log_prefix" in cfg
        assert "category" in cfg
        assert "params" in cfg


def test_build_command_backfill_monthly():
    """Uji penyusunan perintah backfill_monthly dengan flag -y (non-interaktif)."""
    cfg = JOB_CONFIGS["backfill_monthly"]
    
    # Standard run
    req = JobRunRequest(universe="watchlist", months="last3", force=True)
    cmd = build_job_command("backfill_monthly", cfg, req)
    assert "-y" in cmd, "Flag -y harus selalu disertakan untuk mencegah terminal hang"
    assert "--universe" in cmd and "watchlist" in cmd
    assert "--months" in cmd and "last3" in cmd
    assert "--force" in cmd

    # Status only (read-only safe)
    req_status = JobRunRequest(universe="idx80", status_only=True)
    cmd_status = build_job_command("backfill_monthly", cfg, req_status)
    assert "--status" in cmd_status
    assert "--universe" in cmd_status and "idx80" in cmd_status


def test_build_command_backfill_fundamentals():
    """Uji penyusunan perintah backfill_fundamentals dengan berbagai flag."""
    cfg = JOB_CONFIGS["backfill_fundamentals"]

    # 1. Pilih ratios: harus menyertakan --year dan --quarter
    req_ratios = JobRunRequest(ratios=True, year=2025, quarter=3)
    cmd_ratios = build_job_command("backfill_fundamentals", cfg, req_ratios)
    assert "--ratios" in cmd_ratios
    assert "--year" in cmd_ratios and "2025" in cmd_ratios
    assert "--quarter" in cmd_ratios and "3" in cmd_ratios

    # 2. Pilih details + only_missing + actions
    req_details = JobRunRequest(details=True, only_missing=True, actions=True)
    cmd_details = build_job_command("backfill_fundamentals", cfg, req_details)
    assert "--details" in cmd_details
    assert "--only-missing" in cmd_details
    assert "--actions" in cmd_details
    assert "--ratios" not in cmd_details


def test_build_command_etl_flow():
    """Uji penyusunan perintah etl_foreign_flow dengan custom window & workers."""
    cfg = JOB_CONFIGS["etl_flow"]
    req = JobRunRequest(universe="idx80", windows=[20, 30, 60], workers=4)
    cmd = build_job_command("etl_flow", cfg, req)
    assert "--universe" in cmd and "idx80" in cmd
    assert "--window" in cmd and "20" in cmd and "30" in cmd and "60" in cmd
    assert "--workers" in cmd and "4" in cmd


def test_build_command_db_audit():
    """Uji penyusunan perintah db_audit (alert_only vs autofix/vacuum)."""
    cfg = JOB_CONFIGS["db_audit"]

    # Alert only (100% read-only safe)
    req_alert = JobRunRequest(alert_only=True)
    cmd_alert = build_job_command("db_audit", cfg, req_alert)
    assert "--alert-only" in cmd_alert
    assert "--autofix" not in cmd_alert

    # Autofix + Vacuum
    req_fix = JobRunRequest(autofix=True, vacuum=True, notify=True, audit_date="2026-10-06")
    cmd_fix = build_job_command("db_audit", cfg, req_fix)
    assert "--autofix" in cmd_fix
    assert "--vacuum" in cmd_fix
    assert "--notify" in cmd_fix
    assert "--date" in cmd_fix and "2026-10-06" in cmd_fix


def test_api_jobs_status_endpoint():
    """Uji endpoint GET /api/logs/jobs/status."""
    res = client.get("/api/logs/jobs/status")
    assert res.status_code == 200
    data = res.json()
    assert "jobs" in data
    assert "backfill_fundamentals" in data["jobs"]
    assert "backfill_monthly" in data["jobs"]
    assert "db_audit" in data["jobs"]


def test_api_dry_run_execution():
    """Uji mode dry_run: verifikasi sintaks via API tanpa menjalankan eksekusi apapun ke OS/DB."""
    payload = {
        "details": True,
        "ratios": True,
        "year": 2026,
        "quarter": 2,
        "dry_run": True,
    }
    res = client.post("/api/logs/jobs/backfill_fundamentals/run", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "dry_run"
    assert "backfill_fundamentals.py" in data["command"]
    assert "--details" in data["command"]
    assert "--ratios" in data["command"]
    assert "--year 2026" in data["command"]
    assert "--quarter 2" in data["command"]


def test_api_clear_logs_endpoint(tmp_path, monkeypatch):
    """Uji endpoint DELETE /api/logs/clear dengan mock temporary directory."""
    import routers.system as sys_router
    monkeypatch.setattr(sys_router, "LOG_DIR", tmp_path)

    # 1. Buat dummy log file
    test_file = tmp_path / "scanner_test.log"
    test_file.write_text("dummy log content")
    assert test_file.exists()

    # 2. Hapus file spesifik
    res = client.delete(f"/api/logs/clear?filename=scanner_test.log")
    assert res.status_code == 200
    assert not test_file.exists()

    # 3. Test validation error jika tanpa parameter
    err_res = client.delete("/api/logs/clear")
    assert err_res.status_code == 400

