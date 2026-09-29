"""TDD Test Suite for Interactive Ownership Network Graph in Konglomerasi."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_get_network_graph_default_group():
    """RED -> GREEN: Test network graph endpoint with default conglomerate group (barito)."""
    resp = client.get("/api/bandar/shareholders/network-graph?group=barito")
    assert resp.status_code == 200
    res = resp.json()

    assert "group_id" in res
    assert res["group_id"] == "barito"
    assert "group_name" in res
    assert "nodes" in res
    assert "links" in res
    assert "stats" in res
    assert "available_groups" in res

    assert isinstance(res["nodes"], list)
    assert isinstance(res["links"], list)
    assert len(res["nodes"]) > 0
    assert len(res["links"]) > 0

    first_node = res["nodes"][0]
    assert "id" in first_node
    assert "label" in first_node
    assert "type" in first_node

    first_link = res["links"][0]
    assert "source" in first_link
    assert "target" in first_link
    assert "pct" in first_link


def test_get_network_graph_by_ticker():
    """RED -> GREEN: Test network graph endpoint focused on a specific ticker (BBCA)."""
    resp = client.get("/api/bandar/shareholders/network-graph?ticker=BBCA")
    assert resp.status_code == 200
    res = resp.json()

    assert "nodes" in res
    assert "links" in res
    # At least BBCA should be in nodes
    node_labels = [n["label"] for n in res["nodes"]]
    assert "BBCA" in node_labels


def test_get_available_conglomerate_groups():
    """RED -> GREEN: Test endpoint returning preset conglomerate groups with ticker lists."""
    resp = client.get("/api/bandar/shareholders/groups")
    assert resp.status_code == 200
    res = resp.json()

    assert "groups" in res
    assert isinstance(res["groups"], list)
    assert len(res["groups"]) >= 8

    first = res["groups"][0]
    assert "id" in first
    assert "name" in first
    assert "sample_tickers" in first
    assert "ticker_count" in first
