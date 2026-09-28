"""Test Driven Development for Broker Whales Tracker."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_get_whales_list():
    """RED -> GREEN: Test endpoint listing active brokers and their taxonomy profile."""
    resp = client.get("/api/broker-flow/whales")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0
    # Must contain broker code, profile name, and category label
    first = data[0]
    assert "broker_code" in first
    assert "profile" in first
    assert "profile_label" in first


def test_get_whale_detail_valid_broker():
    """RED -> GREEN: Test endpoint returning top accumulations & distributions for a broker."""
    # Test with well-known smart foreign broker 'AK' or 'BK'
    resp = client.get("/api/broker-flow/whales/AK?days=30&limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["broker_code"] == "AK"
    assert "profile" in data
    assert "total_buy_value" in data
    assert "total_sell_value" in data
    assert "total_net_value" in data
    assert "top_accumulations" in data
    assert "top_distributions" in data
    assert isinstance(data["top_accumulations"], list)
    assert isinstance(data["top_distributions"], list)

    # Check structure of accumulated items if present
    if data["top_accumulations"]:
        item = data["top_accumulations"][0]
        assert "ticker" in item
        assert "net_value" in item
        assert item["net_value"] >= 0
        assert "buy_avg_price" in item


def test_get_whale_detail_nonexistent_broker():
    """RED -> GREEN: Test requesting a non-existent broker returns 404."""
    resp = client.get("/api/broker-flow/whales/NONEXISTENT999")
    assert resp.status_code == 404
    assert "detail" in resp.json()
