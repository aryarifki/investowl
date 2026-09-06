from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator
from datetime import date
from typing import List, Optional
import sys
from pathlib import Path
import re

# Import kode asli Anda
_ROOT = Path(__file__).resolve().parents[4]
if str(_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_ROOT / "src"))

from idx_bandarmology import storage, analysis

router = APIRouter()

class BrokerMetric(BaseModel):
    broker_code: str
    investor_type: Optional[str] = None
    net_value: float

class BandarmologySummaryResponse(BaseModel):
    ticker: str
    trade_date: Optional[date] = None
    status: str
    top_buyers: List[BrokerMetric] = []
    top_sellers: List[BrokerMetric] = []

    @field_validator("ticker")
    def validate_ticker(cls, v: str) -> str:
        if not re.match(r"^[A-Z]{4}$", v):
            raise ValueError("Ticker IDX harus berupa 4 huruf kapital (misal: BBCA)")
        return v

@router.get("/{ticker}/summary", response_model=BandarmologySummaryResponse)
async def get_bandarmology_summary(ticker: str):
    ticker = ticker.upper()
    if not re.match(r"^[A-Z]{4}$", ticker):
        raise HTTPException(status_code=400, detail="Ticker tidak valid")

    try:
        # Memanggil fungsi analisis asli Anda
        broker_flow_df = storage.read_broker_flow([ticker])
        if broker_flow_df.empty:
            raise HTTPException(status_code=404, detail="Data broker tidak ditemukan di DB")
        
        latest_flow = broker_flow_df.iloc[-1].to_dict()
        signal = latest_flow.get("bandar_signal", "NEUTRAL")
        trade_date = latest_flow.get("date")
        
        # Ambil top buyers/sellers dari activity
        buyers_df, sellers_df = analysis.top_net_broker_summary(ticker)
        
        top_buyers = []
        if not buyers_df.empty:
            for _, row in buyers_df.head(5).iterrows():
                top_buyers.append(BrokerMetric(
                    broker_code=row.get("broker_code", ""),
                    investor_type=row.get("participant_type"),
                    net_value=float(row.get("net_value", 0.0))
                ))
                
        top_sellers = []
        if not sellers_df.empty:
            for _, row in sellers_df.head(5).iterrows():
                top_sellers.append(BrokerMetric(
                    broker_code=row.get("broker_code", ""),
                    investor_type=row.get("participant_type"),
                    net_value=float(row.get("net_value", 0.0))
                ))

        return BandarmologySummaryResponse(
            ticker=ticker,
            trade_date=trade_date,
            status=signal,
            top_buyers=top_buyers,
            top_sellers=top_sellers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
