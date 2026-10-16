"""Test Foreign Exodus Radar Endpoint."""
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_foreign_exodus_radar_endpoint():
    """Verify Foreign Exodus Radar returns correct structure and calculations."""
    resp = client.get("/api/forensic/foreign-exodus?days=45")
    assert resp.status_code == 200
    data = resp.json()

    # Schema validation
    assert "market_state" in data
    assert data["market_state"] in ["NORMAL", "WARNING", "CRASH", "BOTTOMING"]
    assert "ihsg_current" in data
    assert isinstance(data["ihsg_current"], (int, float))
    assert "ihsg_change_pct" in data
    assert isinstance(data["ihsg_change_pct"], (int, float))

    # Timeline validation
    assert "timeline" in data
    assert isinstance(data["timeline"], list)
    assert len(data["timeline"]) > 0

    first_item = data["timeline"][0]
    assert "date" in first_item
    assert "ihsg_close" in first_item
    assert "daily_flow" in first_item
    assert "cumulative_flow" in first_item

    # Culprit brokers validation
    assert "culprit_brokers" in data
    assert isinstance(data["culprit_brokers"], list)
    assert len(data["culprit_brokers"]) <= 5

    if len(data["culprit_brokers"]) > 0:
        first_broker = data["culprit_brokers"][0]
        assert "broker_code" in first_broker
        assert "broker_name" in first_broker
        assert "net_sell_idr" in first_broker
        assert first_broker["net_sell_idr"] <= 0

    # Specifically test MSCI crash date 2026-10-02
    oct2_rows = [p for p in data["timeline"] if p["date"] == "2026-10-02"]
    if oct2_rows:
        oct2 = oct2_rows[0]
        # Inverted math must produce negative flow for foreign selling exodus
        assert oct2["daily_flow"] < 0
        # Oct 2nd outflow was ~35.04 Trillion IDR (-3.504e13)
        assert oct2["daily_flow"] <= -30.0e12
        assert oct2["cumulative_flow"] < 0
