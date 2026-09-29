"""Test Driven Development for Sector Rotation & Money Flow Tracker."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_get_sector_rotation_summary():
    """RED -> GREEN: Test fetching sector rotation summary, returns all 11 IDX sectors and benchmark."""
    resp = client.get("/api/foreign-flow/sectors/summary")
    assert resp.status_code == 200
    data = resp.json()
    
    assert "date" in data
    assert "benchmark" in data
    assert data["benchmark"]["code"] == "COMPOSITE"
    assert "close" in data["benchmark"]
    assert "ret_1d" in data["benchmark"]
    
    assert "sectors" in data
    assert isinstance(data["sectors"], list)
    assert len(data["sectors"]) >= 11
    
    first = data["sectors"][0]
    assert "code" in first
    assert "name" in first
    assert "close" in first
    assert "ret_1d" in first
    assert "ret_5d" in first
    assert "ret_20d" in first
    assert "value" in first
    assert "rs_ratio" in first
    assert "rs_momentum" in first
    assert "quadrant" in first
    assert first["quadrant"] in ["Leading", "Weakening", "Lagging", "Improving"]
    assert "top_stocks" in first
    assert isinstance(first["top_stocks"], list)


def test_get_sector_history():
    """RED -> GREEN: Test fetching historical time-series for a specific sector index."""
    resp = client.get("/api/foreign-flow/sectors/history?sector=IDXENERGY&days=20")
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["sector"] == "IDXENERGY"
    assert "name" in data
    assert "data" in data
    assert isinstance(data["data"], list)
    assert len(data["data"]) > 0
    
    first = data["data"][0]
    assert "date" in first
    assert "close" in first
    assert "value" in first
    assert "rs_ratio" in first


def test_get_sector_history_invalid_sector():
    """RED -> GREEN: Test requesting a non-existent sector returns 404."""
    resp = client.get("/api/foreign-flow/sectors/history?sector=INVALID_SECTOR")
    assert resp.status_code == 404
    assert "detail" in resp.json()
