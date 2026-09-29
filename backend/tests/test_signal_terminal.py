"""Test Driven Development for Signal Terminal & Confluence Screener."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_get_daily_signals():
    """RED -> GREEN: Test endpoint returning algorithmic daily signals from scanner.py."""
    resp = client.get("/api/signal/daily?limit=10")
    assert resp.status_code == 200
    res = resp.json()

    assert "latest_date" in res
    assert "count" in res
    assert "data" in res
    assert isinstance(res["data"], list)

    if res["data"]:
        first = res["data"][0]
        assert "ticker" in first
        assert "date" in first
        assert "composite_score" in first
        assert "ml_win_prob" in first
        assert "ml_label" in first
        assert "scores" in first
        assert "technical" in first["scores"]
        assert "smart_money" in first["scores"]
        assert "sector" in first["scores"]
        assert "features" in first
        assert "wyckoff_phase" in first["features"]


def test_get_active_signals():
    """RED -> GREEN: Test endpoint returning actionable open signals with TP, SL, R:R."""
    resp = client.get("/api/signal/active?limit=10")
    assert resp.status_code == 200
    res = resp.json()

    assert "count" in res
    assert "data" in res
    assert isinstance(res["data"], list)

    if res["data"]:
        first = res["data"][0]
        assert "id" in first
        assert "ticker" in first
        assert "entry_price" in first
        assert "tp_price" in first
        assert "sl_price" in first
        assert "target_gain_pct" in first
        assert "stop_risk_pct" in first
        assert "risk_reward_ratio" in first
        assert first["status"] == "OPEN"


def test_get_confluence_screener():
    """RED -> GREEN: Test endpoint returning multi-parameter confluence screener."""
    resp = client.get("/api/signal/confluence-screener?universe_mode=lq45&window_days=20")
    assert resp.status_code == 200
    res = resp.json()

    assert "meta" in res
    assert "count" in res
    assert "data" in res
    assert isinstance(res["data"], list)

    if res["data"]:
        first = res["data"][0]
        assert "ticker" in first
        assert "current_price" in first
        assert "conviction_score" in first
        assert "signal" in first
        assert "bandar_avg_price" in first
        assert "bandar_price_distance_pct" in first
        assert "foreign_hmm_state" in first
        assert "free_float_est" in first
        assert "top_buyer" in first
        assert "quick_tags" in first
        assert isinstance(first["quick_tags"], list)
