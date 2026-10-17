#!/usr/bin/env python3
"""Smart Multi-User Cache Pre-Warmer for InvestOwl.

Automatically warms up:
1. Global metadata endpoints (universe, status, daily summary, signals).
2. Dynamic watchlist tickers across all registered users in PostgreSQL.
3. Core benchmark liquid tickers (BBCA, BMRI, ASII, TLKM, etc.).
"""
from __future__ import annotations

import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
import psycopg2

BASE_URL = "http://localhost:8001"
DEFAULT_TICKERS = ["BBCA", "BMRI", "ASII", "TLKM", "BBRI", "BBNI", "GOTO", "BRPT", "ADRO", "MDKA"]
DATABASE_URL = "postgresql://adryan:adryan@localhost:5432/bandarmology"


def get_all_user_watchlist_tickers() -> list[str]:
    """Mengambil semua emiten unik dari seluruh watchlist pengguna terdaftar di DB."""
    tickers = set(DEFAULT_TICKERS)
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT jsonb_array_elements_text(watchlist::jsonb) 
            FROM users 
            WHERE watchlist IS NOT NULL 
              AND watchlist::text != '[]' 
              AND watchlist::text != '';
        """)
        rows = cur.fetchall()
        for r in rows:
            if r and r[0]:
                tickers.add(r[0].strip().upper())
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[warmup] Warning: Gagal query user watchlist ({e}), menggunakan default tickers.")
    return sorted(list(tickers))


def hit_url(path: str) -> tuple[str, bool, float]:
    url = f"{BASE_URL}{path}"
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "InvestOwl-Warmer/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read()
            dur = time.time() - t0
            return path, True, dur
    except Exception as e:
        return path, False, time.time() - t0


def run_warmup(verbose: bool = True) -> dict[str, int]:
    tickers = get_all_user_watchlist_tickers()
    if verbose:
        print(f"\n🔥 [Cache Warm-Up] Memulai pre-warming untuk {len(tickers)} emiten pengguna & global endpoints...")
        print(f"   🎯 Target Emiten: {', '.join(tickers)}")

    urls = [
        "/api/bandar/system-status",
        "/api/bandar/universe/all",
        "/api/bandar/universe/watchlist",
        "/api/bandar/dates/BBCA",
        "/api/bandar/daily-summary?universe_mode=watchlist",
        "/api/signal/daily?limit=100",
        "/api/signal/active?limit=30",
        "/api/foreign-flow/sectors/summary",
    ]

    for ticker in tickers:
        urls.append(f"/api/bandar/detail/{ticker}?window_days=20")
        urls.append(f"/api/bandar/broker-flow/{ticker}?window_days=20&flow_mode=Cumulative&dist_mode=Date%20range")
        urls.append(f"/api/bandar/causality/{ticker}?window_days=20")
        urls.append(f"/api/bandar/validation-v2/{ticker}?window_days=20&horizon=10&min_events=5&universe_mode=watchlist")
        urls.append(f"/api/bandar/stocks/{ticker}/raw-tables?window_days=20")
        urls.append(f"/api/bandar/dates/{ticker}")

    success_count = 0
    fail_count = 0
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(hit_url, path): path for path in urls}
        for future in as_completed(futures):
            path, ok, dur = future.result()
            if ok:
                success_count += 1
                if verbose:
                    print(f"   ✅ Warm: {path:<55} ({dur*1000:.0f}ms)")
            else:
                fail_count += 1
                if verbose:
                    print(f"   ⚠️ Fail: {path:<55} ({dur*1000:.0f}ms)")

    elapsed = time.time() - start_time
    if verbose:
        print(f"\n🎉 [Cache Warm-Up Selesai] {success_count}/{len(urls)} rute berhasil dihangatkan dalam {elapsed:.2f} detik.\n")

    return {"warmed": success_count, "failed": fail_count, "tickers_count": len(tickers)}


if __name__ == "__main__":
    run_warmup(verbose=True)
