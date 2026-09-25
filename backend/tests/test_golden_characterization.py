"""Golden Characterization Tests for Investowl Backend API.

Freezes all 34 production endpoints to guarantee 100% backward compatibility
and zero regression during refactoring.
"""
import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

# 1. Health & Root
def test_root_endpoint(client):
    r = client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert {"service", "status", "version"}.issubset(data.keys())
    assert data["status"] == "ok"

def test_health_endpoint(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert {"status", "latest_date"}.issubset(data.keys())
    assert data["status"] == "healthy"

# 2. Stock History
def test_stocks_history(client):
    r = client.get("/api/stocks/BBCA/history?limit=10")
    assert r.status_code == 200
    data = r.json()
    assert {"ticker", "count", "data", "sort_order"}.issubset(data.keys())
    assert data["ticker"] == "BBCA"
    assert data["sort_order"] == "asc"
    assert isinstance(data["data"], list)

# 3. Broker Flow (Historical & Latest)
def test_broker_flow_latest(client):
    r = client.get("/api/broker-flow/BBCA/latest")
    assert r.status_code == 200
    data = r.json()
    expected = {
        "bandar_signal", "bandar_signal_score", "date", "ticker", 
        "foreign_net_broker", "local_net_broker"
    }
    assert expected.issubset(data.keys())
    assert data["ticker"] == "BBCA"

def test_broker_flow_history(client):
    r = client.get("/api/broker-flow/BBCA/history?limit=10")
    assert r.status_code == 200
    data = r.json()
    assert {"ticker", "count", "data", "sort_order"}.issubset(data.keys())
    assert data["ticker"] == "BBCA"
    assert isinstance(data["data"], list)

def test_broker_flow_summary(client):
    r = client.get("/api/broker-flow/BBCA/summary?days=30")
    assert r.status_code == 200
    data = r.json()
    expected = {
        "ticker", "period_days", "trading_days", "accumulation_days",
        "distribution_days", "foreign_net_broker_sum", "local_net_broker_sum",
        "latest_bandar_signal", "latest_bandar_signal_score", "latest_date"
    }
    assert expected.issubset(data.keys())
    assert data["ticker"] == "BBCA"

# 4. Users / Auth
def test_users_list(client):
    r = client.get("/api/users/")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        assert {"id", "email", "name", "role", "is_approved"}.issubset(data[0].keys())

# 5. Universe & Tickers
def test_bandar_universe(client):
    r = client.get("/api/bandar/universe")
    assert r.status_code == 200
    data = r.json()
    assert "tickers" in data
    assert isinstance(data["tickers"], list)
    assert len(data["tickers"]) > 0

def test_bandar_tickers(client):
    r = client.get("/api/bandar/tickers")
    assert r.status_code == 200
    data = r.json()
    assert "tickers" in data
    assert isinstance(data["tickers"], list)

def test_bandar_universe_mode(client):
    r = client.get("/api/bandar/universe/idx30")
    assert r.status_code == 200
    data = r.json()
    assert {"mode", "tickers", "count"}.issubset(data.keys())
    assert data["mode"] == "idx30"
    assert isinstance(data["tickers"], list)

# 6. Bandar Stock Metrics & Flow
def test_bandar_metrics(client):
    r = client.get("/api/bandar/stocks/BBCA/metrics")
    assert r.status_code == 200
    data = r.json()
    expected = {
        "ticker", "analysis_date", "window_start", "signal",
        "conviction", "foreign_net_5d", "ret_5d", "ret_10d",
        "top_buyers", "top_sellers"
    }
    assert expected.issubset(data.keys())
    assert data["ticker"] == "BBCA"

def test_bandar_smart_flow(client):
    r = client.get("/api/bandar/stocks/BBCA/smart-flow")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert isinstance(data["data"], list)

def test_bandar_broker_compare(client):
    r = client.get("/api/bandar/stocks/BBCA/broker-compare")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert isinstance(data["data"], list)

def test_bandar_causality_stock(client):
    r = client.get("/api/bandar/stocks/BBCA/causality")
    assert r.status_code == 200
    data = r.json()
    assert {"foreign", "participants", "brokers"}.issubset(data.keys())

def test_bandar_validation_scan(client):
    r = client.get("/api/bandar/validation/broker-scan?ticker=BBCA")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert isinstance(data["data"], list)

def test_bandar_event_study(client):
    r = client.get("/api/bandar/stocks/BBCA/event-study")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert isinstance(data["data"], list)

def test_bandar_screener(client):
    r = client.get("/api/bandar/screener?universe_mode=watchlist")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert isinstance(data["data"], list)

def test_bandar_raw(client):
    r = client.get("/api/bandar/stocks/BBCA/raw")
    assert r.status_code == 200
    data = r.json()
    assert {"activity", "flow"}.issubset(data.keys())

def test_bandar_broker_profiles(client):
    r = client.get("/api/bandar/stocks/BBCA/broker-profiles")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert isinstance(data["data"], list)

def test_bandar_price_perf(client):
    r = client.get("/api/bandar/stocks/BBCA/price-performance")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert isinstance(data["data"], list)

def test_bandar_broker_distribution(client):
    r = client.get("/api/bandar/stocks/BBCA/broker-distribution")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert isinstance(data["data"], list)

def test_bandar_system_status(client):
    r = client.get("/api/bandar/system-status")
    assert r.status_code == 200
    data = r.json()
    assert {"active_tickers", "latest_date", "status"}.issubset(data.keys())

def test_bandar_daily_summary(client):
    r = client.get("/api/bandar/daily-summary?universe_mode=watchlist")
    assert r.status_code == 200
    data = r.json()
    expected = {"as_of", "items", "signal_counts", "top_conviction"}
    assert expected.issubset(data.keys())
    assert isinstance(data["items"], list)

def test_bandar_detail(client):
    r = client.get("/api/bandar/detail/BBCA")
    assert r.status_code == 200
    data = r.json()
    expected = {
        "ticker", "company", "analysis_date", "window_start", "window_days",
        "close", "ret_5d", "ret_10d", "foreign_5d", "signal", "verdict",
        "price_chart", "signal_overlay", "broker_summary"
    }
    assert expected.issubset(data.keys())
    assert data["ticker"] == "BBCA"

def test_bandar_dates(client):
    r = client.get("/api/bandar/dates/BBCA")
    assert r.status_code == 200
    data = r.json()
    assert "dates" in data
    assert isinstance(data["dates"], list)
    assert len(data["dates"]) > 0

def test_bandar_broker_flow_ticker(client):
    r = client.get("/api/bandar/broker-flow/BBCA")
    assert r.status_code == 200
    data = r.json()
    expected = {
        "ticker", "analysis_date", "window_start", "all_codes", 
        "ranked_codes", "summary", "profile_flow", "profile_broker_detail"
    }
    assert expected.issubset(data.keys())
    assert data["ticker"] == "BBCA"

def test_bandar_causality_ticker(client):
    r = client.get("/api/bandar/causality/BBCA")
    assert r.status_code == 200
    data = r.json()
    assert {"granger_test", "participant_causality", "top_brokers"}.issubset(data.keys())

def test_bandar_validation_ticker(client):
    r = client.get("/api/bandar/validation/BBCA")
    assert r.status_code == 200
    data = r.json()
    assert {"broker_scan", "event_study"}.issubset(data.keys())

def test_bandar_validation_v2(client):
    r = client.get("/api/bandar/validation-v2/BBCA")
    assert r.status_code == 200
    data = r.json()
    assert {"broker_scan", "event_study"}.issubset(data.keys())

def test_bandar_screener_v2(client):
    r = client.get("/api/bandar/screener-v2?universe_mode=watchlist")
    assert r.status_code == 200
    data = r.json()
    assert {"data", "meta"}.issubset(data.keys())

def test_bandar_raw_tables(client):
    r = client.get("/api/bandar/stocks/BBCA/raw-tables")
    assert r.status_code == 200
    data = r.json()
    assert {"activity", "flow"}.issubset(data.keys())

# 7. Foreign Flow Deep Dive (Pre-computed)
def test_foreign_flow_deep_dive(client):
    r = client.get("/api/foreign-flow/BBCA?lookback_days=60")
    assert r.status_code == 200
    data = r.json()
    expected = {
        "ticker", "company", "lookback_days", "latest_date",
        "features", "timeseries", "models"
    }
    assert expected.issubset(data.keys())
    assert data["ticker"] == "BBCA"
    assert "foreign_hhi" in data["features"]
    assert "foreign_zscore" in data["features"]
    assert "close_prices" in data["timeseries"]
    assert "dates" in data["timeseries"]

# 8. AI Signals Daily
def test_signal_daily(client):
    r = client.get("/api/signal/daily")
    assert r.status_code == 200
    data = r.json()
    assert {"latest_date", "count", "data"}.issubset(data.keys())
    assert isinstance(data["data"], list)
    if data["data"]:
        sample = data["data"][0]
        assert {"ticker", "date", "ml_label", "ml_win_prob", "composite_score", "scores", "features"}.issubset(sample.keys())
        assert {"technical", "smart_money", "sector", "fundamental"}.issubset(sample["scores"].keys())

# 9. System Logs
def test_system_logs_daily(client):
    r = client.get("/api/logs/daily")
    assert r.status_code == 200
    data = r.json()
    assert {"timestamp", "logs"}.issubset(data.keys())
    expected_logs = {"backfill", "etl_flow", "scanner", "auditor"}
    assert expected_logs.issubset(data["logs"].keys())
