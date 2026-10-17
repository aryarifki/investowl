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


def test_evaluate_market_state_unit_logic():
    """Unit test individual state machine transitions for v2.5 algorithm."""
    from routers.forensic import _evaluate_market_state

    # 1. Empty timeline -> NORMAL
    assert _evaluate_market_state([]) == "NORMAL"

    # 2. Normal market flow
    timeline_normal = [
        {"daily_flow": 200e9, "ihsg_close": 7000.0},
        {"daily_flow": -100e9, "ihsg_close": 7010.0},
        {"daily_flow": 300e9, "ihsg_close": 7020.0},
    ]
    assert _evaluate_market_state(timeline_normal) == "NORMAL"

    # 3. Crash followed by weak noise (+0.1T, +0.2T) -> must reject bottoming and remain CRASH
    timeline_noise = [
        {"daily_flow": -10e12, "ihsg_close": 6000.0},  # CRASH (-10T)
        {"daily_flow": -2e12, "ihsg_close": 5900.0},   # CRASH continues
        {"daily_flow": 0.1e12, "ihsg_close": 5850.0},  # noise buyback 1
        {"daily_flow": 0.2e12, "ihsg_close": 5800.0},  # noise buyback 2 (fails conviction)
    ]
    assert _evaluate_market_state(timeline_noise) == "CRASH"

    # 4. Crash followed by Climactic Whale Absorption (+0.22T, +12.08T) -> BOTTOMING
    timeline_climactic = [
        {"daily_flow": -35e12, "ihsg_close": 6036.0},  # Massive crash
        {"daily_flow": -5e12, "ihsg_close": 6093.0},   # Continued selling
        {"daily_flow": 0.22e12, "ihsg_close": 5863.0}, # Day 1 (+0.22T)
        {"daily_flow": 12.08e12, "ihsg_close": 5185.0}, # Day 2 (+12.08T climactic absorption)
    ]
    assert _evaluate_market_state(timeline_climactic) == "BOTTOMING"

    # 5. Crash followed by Price Stabilization with Conviction (> 1T, price steady) -> BOTTOMING
    timeline_stabilization = [
        {"daily_flow": -6e12, "ihsg_close": 6200.0},   # CRASH
        {"daily_flow": 1.2e12, "ihsg_close": 6150.0},  # Day 1
        {"daily_flow": 1.5e12, "ihsg_close": 6180.0},  # Day 2 (> prev close, conviction met)
    ]
    assert _evaluate_market_state(timeline_stabilization) == "BOTTOMING"

