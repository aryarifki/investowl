"""High-performance thread-safe memory caches with LRU eviction and TTL."""
from __future__ import annotations

import threading
import time
from collections import OrderedDict
from typing import Any


class BoundedTTLCache:
    """Thread-safe, size-bounded LRU cache with Time-To-Live (TTL) expiration."""

    def __init__(self, maxsize: int = 300, ttl_seconds: float = 300.0):
        self._maxsize = maxsize
        self._ttl = ttl_seconds
        self._cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            if key not in self._cache:
                return default
            ts, val = self._cache[key]
            if time.time() - ts > self._ttl:
                del self._cache[key]
                return default
            self._cache.move_to_end(key)
            return val

    def __getitem__(self, key: str) -> Any:
        val = self.get(key)
        if val is None:
            raise KeyError(key)
        return val

    def __setitem__(self, key: str, val: Any) -> None:
        with self._lock:
            now = time.time()
            if key in self._cache:
                self._cache[key] = (now, val)
                self._cache.move_to_end(key)
                return
            if len(self._cache) >= self._maxsize:
                self._cache.popitem(last=False)
            self._cache[key] = (now, val)

    def __contains__(self, key: str) -> bool:
        return self.get(key) is not None

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._cache)
