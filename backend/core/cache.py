"""Unified Redis + In-Memory Fallback Cache Layer with TTL and LRU Eviction."""
from __future__ import annotations

import time
import json
import inspect
import hashlib
import fnmatch
from collections import OrderedDict
from threading import Lock
from functools import wraps
from typing import Any, Optional, Callable

import redis
from config import settings


def _get_shared_redis() -> Optional[redis.Redis]:
    """Helper singleton untuk koneksi Redis dengan socket timeout aman."""
    try:
        client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True,
            socket_timeout=2.0,
            socket_connect_timeout=2.0,
        )
        client.ping()
        return client
    except Exception:
        return None


class TTLCache:
    """Thread-safe Two-Tier Cache (L1 Memory + L2 Redis) with TTL and LRU Eviction.
    
    Menjaga kompatibilitas 100% dengan service yang ada, sekaligus menambahkan
    persistensi Redis di belakang layar agar data tidak hilang saat restart.
    """

    def __init__(self, maxsize: int = 128, ttl_seconds: float = 300.0, redis_prefix: str = "ttl") -> None:
        self.maxsize = maxsize
        self.ttl_seconds = ttl_seconds
        self.redis_prefix = redis_prefix
        self._cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = Lock()
        self._redis = _get_shared_redis()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            # 1. Cek L1 In-Memory Cache (0ms)
            if key in self._cache:
                ts, val = self._cache[key]
                if (time.time() - ts) <= self.ttl_seconds:
                    self._cache.move_to_end(key)
                    return val
                else:
                    del self._cache[key]

            # 2. Cek L2 Redis jika L1 miss
            if self._redis:
                try:
                    rk = f"{self.redis_prefix}:{key}"
                    raw = self._redis.get(rk)
                    if raw is not None:
                        val = json.loads(raw)
                        # Simpan balik ke L1 untuk request berikutnya
                        self._cache[key] = (time.time(), val)
                        return val
                except Exception:
                    pass

            return None

    def set(self, key: str, val: Any) -> None:
        with self._lock:
            now = time.time()
            if key in self._cache:
                del self._cache[key]
            elif len(self._cache) >= self.maxsize:
                self._cache.popitem(last=False)  # Evict oldest (LRU)
            self._cache[key] = (now, val)

            # Persist ke L2 Redis
            if self._redis:
                try:
                    rk = f"{self.redis_prefix}:{key}"
                    payload = json.dumps(val, default=str)
                    self._redis.set(rk, payload, ex=int(self.ttl_seconds))
                except Exception:
                    pass

    def delete(self, key: str) -> bool:
        with self._lock:
            deleted = False
            if key in self._cache:
                del self._cache[key]
                deleted = True
            if self._redis:
                try:
                    rk = f"{self.redis_prefix}:{key}"
                    if self._redis.delete(rk):
                        deleted = True
                except Exception:
                    pass
            return deleted

    def invalidate_by_pattern(self, pattern: str) -> int:
        with self._lock:
            keys_to_del = [k for k in self._cache.keys() if fnmatch.fnmatch(k, pattern)]
            for k in keys_to_del:
                del self._cache[k]
            count = len(keys_to_del)
            if self._redis:
                try:
                    full_pattern = f"{self.redis_prefix}:{pattern}"
                    r_keys = self._redis.keys(full_pattern)
                    if r_keys:
                        self._redis.delete(*r_keys)
                        count = max(count, len(r_keys))
                except Exception:
                    pass
            return count

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
            if self._redis:
                try:
                    r_keys = self._redis.keys(f"{self.redis_prefix}:*")
                    if r_keys:
                        self._redis.delete(*r_keys)
                except Exception:
                    pass

    def __len__(self) -> int:
        with self._lock:
            return len(self._cache)

    def __contains__(self, key: str) -> bool:
        return self.get(key) is not None


class UnifiedCache:
    """Production Multi-tier Cache: Redis Tier-1 with In-Memory TTLCache Tier-2 Fallback."""

    def __init__(self) -> None:
        self._fallback = TTLCache(maxsize=512, ttl_seconds=3600.0, redis_prefix="app")
        self._redis = _get_shared_redis()

    @property
    def is_redis_available(self) -> bool:
        if self._redis is None:
            self._redis = _get_shared_redis()
        return self._redis is not None

    def get(self, key: str) -> Optional[Any]:
        # 1. Coba baca dari Redis (L1)
        if self.is_redis_available and self._redis:
            try:
                raw = self._redis.get(key)
                if raw is not None:
                    return json.loads(raw)
            except Exception:
                pass

        # 2. Fallback ke In-Memory TTLCache (L2)
        return self._fallback.get(key)

    def set(self, key: str, val: Any, ttl_seconds: int = 300) -> bool:
        # Simpan di fallback in-memory (L2)
        self._fallback.set(key, val)

        # Simpan di Redis (L1)
        if self.is_redis_available and self._redis:
            try:
                payload = json.dumps(val, default=str)
                self._redis.set(key, payload, ex=int(ttl_seconds))
                return True
            except Exception:
                return False
        return True

    def delete(self, key: str) -> bool:
        self._fallback.delete(key)
        if self.is_redis_available and self._redis:
            try:
                return bool(self._redis.delete(key))
            except Exception:
                pass
        return True

    def invalidate_by_pattern(self, pattern: str) -> int:
        count = self._fallback.invalidate_by_pattern(pattern)
        if self.is_redis_available and self._redis:
            try:
                keys = self._redis.keys(pattern)
                if keys:
                    self._redis.delete(*keys)
                    count = max(count, len(keys))
            except Exception:
                pass
        return count

    def clear(self) -> None:
        self._fallback.clear()
        if self.is_redis_available and self._redis:
            try:
                self._redis.flushdb()
            except Exception:
                pass

    def get_stats(self) -> dict[str, Any]:
        """Statistik diagnostik status cache."""
        redis_keys = 0
        connected = self.is_redis_available
        if connected and self._redis:
            try:
                redis_keys = self._redis.dbsize()
            except Exception:
                connected = False
        return {
            "redis_connected": connected,
            "redis_keys_count": redis_keys,
            "fallback_memory_keys": len(self._fallback),
        }


# Global singleton instance
cache = UnifiedCache()


def _is_cacheable_arg(v: Any) -> bool:
    """Memfilter argumen non-primitif (misal Session DB / Request) dari pembentukan cache key."""
    if v is None or isinstance(v, (str, int, float, bool)):
        return True
    if isinstance(v, (list, tuple, set)):
        return all(_is_cacheable_arg(x) for x in v)
    if isinstance(v, dict):
        return all(isinstance(k, str) and _is_cacheable_arg(val) for k, val in v.items())
    return False


def build_cache_key(prefix: str, func_name: str, args: tuple, kwargs: dict) -> str:
    """Membangun cache key deterministik berbasis hash SHA-256 dari argumen request."""
    clean_args = [a for a in args if _is_cacheable_arg(a)]
    clean_kwargs = {k: v for k, v in sorted(kwargs.items()) if _is_cacheable_arg(v)}
    serialized = json.dumps({"args": clean_args, "kwargs": clean_kwargs}, sort_keys=True, default=str)
    digest = hashlib.sha256(serialized.encode()).hexdigest()[:12]
    p = f"{prefix}:" if prefix else ""
    return f"{p}{func_name}:{digest}"


def cached(
    ttl_seconds: int = 300,
    prefix: str = "",
    key_builder: Optional[Callable[..., str]] = None,
):
    """Dekorator caching serbaguna untuk route FastAPI (mendukung sync & async)."""
    def decorator(func: Callable):
        is_async = inspect.iscoroutinefunction(func)

        if is_async:
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                try:
                    k = key_builder(*args, **kwargs) if key_builder else build_cache_key(prefix, func.__name__, args, kwargs)
                    cached_val = cache.get(k)
                    if cached_val is not None:
                        return cached_val
                except Exception:
                    k = None

                result = await func(*args, **kwargs)

                if k is not None and result is not None:
                    try:
                        cache.set(k, result, ttl_seconds=ttl_seconds)
                    except Exception:
                        pass
                return result

            return async_wrapper
        else:
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                try:
                    k = key_builder(*args, **kwargs) if key_builder else build_cache_key(prefix, func.__name__, args, kwargs)
                    cached_val = cache.get(k)
                    if cached_val is not None:
                        return cached_val
                except Exception:
                    k = None

                result = func(*args, **kwargs)

                if k is not None and result is not None:
                    try:
                        cache.set(k, result, ttl_seconds=ttl_seconds)
                    except Exception:
                        pass
                return result

            return sync_wrapper

    return decorator


def invalidate_cache(pattern: str = "*") -> int:
    """Helper global untuk menghapus cache berdasarkan pola wildcard (misal 'signal:*')."""
    return cache.invalidate_by_pattern(pattern)
