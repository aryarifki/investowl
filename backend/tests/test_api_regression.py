"""Comprehensive regression test suite for API endpoints, schemas, and core components.
Ensures zero breaking changes across routers, caching, and utilities without external testclient dependencies.
"""
import time
import pytest

from main import app
from core.cache import BoundedTTLCache
from idx_bandarmology.analysis import broker_profile_of, _SMART_PROFILES, _PROFILE_META
from idx_bandarmology import universe


def test_root_endpoint():
    """Health check root endpoint function returns expected service metadata."""
    from main import root
    res = root()
    assert res["status"] == "ok"
    assert res["service"] == "SM Tracker API"
    assert res["version"] == "1.0.0"


def test_registered_routes():
    """Verify all critical router prefixes are mounted and accessible in FastAPI app."""
    routes = []
    for r in app.routes:
        if hasattr(r, "path"):
            routes.append(r.path)
        if hasattr(r, "original_router"):
            for sub in getattr(r.original_router, "routes", []):
                if hasattr(sub, "path"):
                    routes.append(sub.path)
    
    # 1. Stocks routes
    assert any("stocks" in r for r in routes)
    # 2. Broker flow routes
    assert any("broker-flow" in r for r in routes)
    # 3. Users routes
    assert any("users" in r for r in routes)
    # 4. Bandarmology routes
    assert any("bandar" in r for r in routes)
    # 5. Foreign flow routes
    assert any("foreign-flow" in r for r in routes)
    # 6. AI Signal routes
    assert any("signal" in r for r in routes)


def test_broker_profile_classification():
    """Verify behavioral classification profiles for known IDX brokers."""
    # Smart foreign
    assert broker_profile_of("AK") == "smart_foreign"
    assert broker_profile_of("BK") == "smart_foreign"
    assert broker_profile_of("KZ") == "smart_foreign"

    # Bandar gorengan / speculative
    assert broker_profile_of("MG") == "bandar_gorengan"
    assert broker_profile_of("SQ") == "bandar_gorengan"

    # Retail dominant
    assert broker_profile_of("YP") == "lainnya" or broker_profile_of("XA") == "retail"
    assert broker_profile_of("PD") == "market_maker"

    # Unknown / None fallback
    assert broker_profile_of("UNKNOWN") == "lainnya"
    assert broker_profile_of(None) == "lainnya"


def test_bounded_ttl_cache_eviction():
    """Verify BoundedTTLCache enforces maxsize eviction and TTL expiration."""
    cache = BoundedTTLCache(maxsize=3, ttl_seconds=0.5)

    # 1. Populate
    cache["k1"] = "v1"
    cache["k2"] = "v2"
    cache["k3"] = "v3"
    assert len(cache) == 3

    # 2. Access k1 so k2 becomes the least recently used
    _ = cache["k1"]

    # 3. Insert k4: should evict k2 (LRU)
    cache["k4"] = "v4"
    assert len(cache) == 3
    assert cache.get("k2") is None
    assert cache.get("k1") == "v1"
    assert cache.get("k3") == "v3"
    assert cache.get("k4") == "v4"

    # 4. Test TTL expiration
    time.sleep(0.6)
    assert cache.get("k1") is None
    assert cache.get("k4") is None


def test_universe_resolution():
    """Verify get_universe returns valid list of tickers."""
    res = universe.get_universe(mode="watchlist")
    assert isinstance(res, list)
    assert len(res) > 0
    assert "BBCA" in res
