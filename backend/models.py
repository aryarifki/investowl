"""SQLAlchemy models mapping to EXISTING tables created by the data pipeline.

Schema verified via `\d prices` and `\d broker_flow` on 2025.
IMPORTANT: Do NOT run metadata.create_all() — the cron pipeline owns the schema.
This API layer is READ-ONLY.
"""
from __future__ import annotations

from datetime import date as date_type
from datetime import datetime

from sqlalchemy import BigInteger, Date, DateTime, Numeric, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Price(Base):
    """Mirror of `prices` (OHLCV daily bars).
    PK komposit: (date, ticker). OHLC boleh NULL di DB → gunakan Optional.
    """
    __tablename__ = "prices"
    __table_args__ = {"extend_existing": True}

    date: Mapped[date_type] = mapped_column(Date, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), primary_key=True)

    open: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    high: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    low: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    close: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    volume: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


class BrokerFlow(Base):
    """Mirror of `broker_flow` (daily bandarmology summary).
    PK komposit: (date, ticker).
    """
    __tablename__ = "broker_flow"
    __table_args__ = {"extend_existing": True}

    date: Mapped[date_type] = mapped_column(Date, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), primary_key=True)

    # ── Sinyal ──
    bandar_signal: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bandar_signal_score: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    foreign_signal: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ── Net Broker per kategori ──
    foreign_net_broker: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    local_net_broker: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    gov_net_broker: Mapped[float | None] = mapped_column(Numeric, nullable=True)

    # ── Net Flow ──
    foreign_net_flow: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    domestic_net_flow: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    total_value: Mapped[float | None] = mapped_column(Numeric, nullable=True)

    # ── Narasi otomatis dari pipeline ──
    conclusion_broker: Mapped[str | None] = mapped_column(Text, nullable=True)
    conclusion_flow: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Metadata ──
    fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class BrokerActivity(Base):
    """Mirror of `broker_activity` (granular broker-level transactions per stock).
    PK komposit: (date, ticker, broker_code).
    """
    __tablename__ = "broker_activity"
    __table_args__ = {"extend_existing": True}

    date: Mapped[date_type] = mapped_column(Date, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(10), primary_key=True)
    broker_code: Mapped[str] = mapped_column(String(10), primary_key=True)

    participant_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    buy_value: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    sell_value: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    net_value: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    buy_lot: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    sell_lot: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    frequency: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    buy_avg_price: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    sell_avg_price: Mapped[float | None] = mapped_column(Numeric(18, 4), nullable=True)
    fetched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ══════════════════════════════════════════════════════════
# Authentication Models
# ══════════════════════════════════════════════════════════

class User(Base):
    """Model untuk menyimpan daftar user yang login via NextAuth."""
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[str] = mapped_column(String(50), default="user")
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
