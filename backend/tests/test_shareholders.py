"""Test Driven Development for Substantial Shareholders & Ownership Matrix."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_get_shareholders_valid_ticker():
    """RED -> GREEN: Test fetching shareholders and ownership breakdown for a valid ticker."""
    resp = client.get("/api/bandar/shareholders/BBCA")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "BBCA"
    assert "shareholders" in data
    assert isinstance(data["shareholders"], list)
    assert len(data["shareholders"]) > 0
    
    first = data["shareholders"][0]
    assert "name" in first
    assert "pct" in first
    assert "is_controlling" in first
    assert "category" in first
    
    # Check summary metrics
    assert "summary" in data
    summary = data["summary"]
    assert "controlling_pct" in summary
    assert "public_pct" in summary
    assert "treasury_pct" in summary
    assert "other_substantial_pct" in summary
    assert summary["controlling_pct"] > 50.0  # PT Dwimuria Investama has >50%


def test_get_shareholders_nonexistent_ticker():
    """RED -> GREEN: Test requesting a non-existent ticker returns 404."""
    resp = client.get("/api/bandar/shareholders/NONEXISTENT999")
    assert resp.status_code == 404
    assert "detail" in resp.json()


def test_search_shareholders():
    """RED -> GREEN: Test searching entities/shareholders by name."""
    resp = client.get("/api/bandar/shareholders/search?q=Salim")
    assert resp.status_code == 200
    data = resp.json()
    assert "query" in data
    assert "results" in data
    assert isinstance(data["results"], list)
    assert len(data["results"]) > 0
    
    # Check structure
    match = next((item for item in data["results"] if "Anthoni Salim" in item["name"]), None)
    assert match is not None
    assert "holdings" in match
    assert match["ticker_count"] >= 2


def test_get_top_cross_holdings():
    """RED -> GREEN: Test endpoint returning influential multi-stock holding entities."""
    resp = client.get("/api/bandar/shareholders/top-cross-holdings?limit=15")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0
    
    first = data[0]
    assert "name" in first
    assert "ticker_count" in first
    assert first["ticker_count"] >= 2
    assert "holdings" in first
    assert isinstance(first["holdings"], list)
