"""Test Driven Development for Strategy Backtest & Win-Rate Lab."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_get_backtest_stats():
    """RED -> GREEN: Test endpoint returning overall win rate and backtest statistics."""
    resp = client.get("/api/signal/backtest/stats")
    assert resp.status_code == 200
    data = resp.json()

    # Core metric fields must exist
    assert "total_signals" in data
    assert "total_closed" in data
    assert "total_open" in data
    assert "win_count" in data
    assert "loss_count" in data
    assert "win_rate" in data
    assert "avg_win_pct" in data
    assert "avg_loss_pct" in data
    assert "avg_days_held" in data
    assert "profit_factor" in data

    # Logical mathematical invariants
    assert data["total_signals"] >= data["total_closed"]
    assert data["total_closed"] == data["win_count"] + data["loss_count"]
    assert 0.0 <= data["win_rate"] <= 100.0
    if data["win_count"] > 0:
        assert data["avg_win_pct"] > 0


def test_get_backtest_history_default():
    """RED -> GREEN: Test endpoint returning audited historical signals."""
    resp = client.get("/api/signal/backtest/history?limit=10")
    assert resp.status_code == 200
    res = resp.json()

    assert "count" in res
    assert "data" in res
    assert isinstance(res["data"], list)

    if res["data"]:
        first = res["data"][0]
        assert "ticker" in first
        assert "signal_date" in first
        assert "entry_price" in first
        assert "tp_price" in first
        assert "sl_price" in first
        assert "status" in first
        assert "pnl_pct" in first


def test_get_backtest_history_filter_win():
    """RED -> GREEN: Test filtering historical signals by WIN status."""
    resp = client.get("/api/signal/backtest/history?status=WIN&limit=5")
    assert resp.status_code == 200
    res = resp.json()

    for item in res["data"]:
        assert item["status"] == "WIN"
        assert item["pnl_pct"] > 0


def test_get_backtest_history_filter_loss():
    """RED -> GREEN: Test filtering historical signals by LOSS status."""
    resp = client.get("/api/signal/backtest/history?status=LOSS&limit=5")
    assert resp.status_code == 200
    res = resp.json()

    for item in res["data"]:
        assert item["status"] == "LOSS"
        assert item["pnl_pct"] < 0
