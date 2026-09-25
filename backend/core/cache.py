"""Bounded thread-safe in-memory cache with TTL and LRU eviction."""
from __future__ import annotations

import time
from collections import OrderedDict
from threading import Lock
from typing import Any, Optional


class TTLCache:
    """Thread-safe Bounded In-Memory Cache with Time-To-Live (TTL) and LRU Eviction.
    
    Protects memory against leaks in resource-constrained environments (e.g. ARM VPS).
    """

    def __init__(self, maxsize: int = 128, ttl_seconds: float = 300.0) -> None:
        self.maxsize = maxsize
        self.ttl_seconds = ttl_seconds
        self._cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._cache:
                return None
            ts, val = self._cache[key]
            if (time.time() - ts) > self.ttl_seconds:
                del self._cache[key]
                return None
            self._cache.move_to_end(key)
            return val

    def set(self, key: str, val: Any) -> None:
        with self._lock:
            now = time.time()
            if key in self._cache:
                del self._cache[key]
            elif len(self._cache) >= self.maxsize:
                self._cache.popitem(last=False)  # Evict oldest (LRU)
            self._cache[key] = (now, val)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._cache)

    def __contains__(self, key: str) -> bool:
        return self.get(key) is not None
