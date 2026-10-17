"""FastAPI entry point — SM Tracker API.

Run locally:
    uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

from contextlib import asynccontextmanager
import redis
import time

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import BrokerFlow
from routers import stocks, broker, auth, signal, system, foreign_flow, bandarmology, shareholders, nyangkut, forensic
from idx_bandarmology.universe import refresh_master_tickers


# Inisialisasi Redis Terpusat untuk Rate Limiting
try:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST, 
        port=settings.REDIS_PORT, 
        db=settings.REDIS_DB, 
        decode_responses=True,
        socket_timeout=2.0,
        socket_connect_timeout=2.0,
    )
    redis_client.ping()
except Exception:
    redis_client = None
    print("[FastAPI Startup] Peringatan: Redis tidak terhubung. Rate limiting nonaktif.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        count = refresh_master_tickers(force=False)
        print(f"[FastAPI Startup] Master tickers siap: {count} emiten aktif.")
    except Exception as e:
        print(f"[FastAPI Startup] Gagal memuat master tickers: {e}")
    yield

app = FastAPI(
    title="SM Tracker API",
    description="Backend untuk pelacak saham & bandarmologi IDX (migrasi dari Streamlit).",
    version="1.0.0",
    lifespan=lifespan,
)

# ── GZip Middleware (Mempercepat transfer JSON besar ke frontend) ──
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── CORS: izinkan Next.js (localhost:3000) mengakses API ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# ── Custom Rate Limiting Middleware (Keamanan Anti-Spam/Bot) ──
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if "/api/foreign-flow" in request.url.path or "/api/bandar" in request.url.path:
        client_ip = request.client.host
        endpoint = request.url.path
        key = f"rate_limit:{client_ip}:{endpoint}"
        
        if redis_client:
            count = redis_client.incr(key)
            if count == 1:
                redis_client.expire(key, 60)
            if count > 30:
                return JSONResponse(
                    status_code=429, 
                    content={"detail": "Rate limit exceeded. Maksimum 30 request per menit."}
                )
    
    response = await call_next(request)
    return response

# ── Routers ──
app.include_router(stocks.router, prefix=settings.API_V1_PREFIX)
app.include_router(broker.router, prefix=settings.API_V1_PREFIX)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(bandarmology.router)
app.include_router(foreign_flow.router)
app.include_router(signal.router)
app.include_router(system.router)
app.include_router(shareholders.router) 
app.include_router(nyangkut.router)
app.include_router(forensic.router)

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "SM Tracker API", "version": "1.0.0"}

@app.get("/api/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    latest_date = db.query(func.max(BrokerFlow.date)).scalar()
    return {
        "status": "healthy",
        "latest_date": latest_date.isoformat() if latest_date else None
    }
