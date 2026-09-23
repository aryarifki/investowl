"""Central configuration, loaded from .env."""
from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip()
    if not DATABASE_URL:
        user = os.environ.get("DB_USER", "bandar").strip()
        password = os.environ.get("DB_PASSWORD", "bandar123").strip()
        host = os.environ.get("DB_HOST", "localhost").strip()
        port = os.environ.get("DB_PORT", "5432").strip()
        dbname = os.environ.get("DB_NAME", "bandarmology").strip()
        DATABASE_URL = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"

    # Frontend Next.js origins allowed to call this API
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if o.strip()
    ]
    API_V1_PREFIX: str = "/api"
    
    # Konfigurasi Redis Terpusat
    REDIS_HOST: str = os.getenv("REDIS_HOST", "127.0.0.1")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", 6379))
    REDIS_DB: int = int(os.getenv("REDIS_DB", 0))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
