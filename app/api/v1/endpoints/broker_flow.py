from fastapi import APIRouter, HTTPException, Query
from datetime import date
from typing import Optional
import pandas as pd
import re

from app.services.analysis_service import (
    safe_val, df_to_records, profile_flow_from_activity, 
    profile_broker_detail_table, broker_distribution_data
)
from idx_bandarmology import analysis, storage

router = APIRouter()

@router.get("/{ticker}/broker_flow")
async def get_broker_flow_data(
    ticker: str,
    analysis_date: Optional[date] = Query(None),
    lookback_days: int = Query(60),
    dist_start: Optional[str] = Query(None),
    dist_end: Optional[str] = Query(None)
):
    ticker = ticker.upper()
    if not re.match(r"^[A-Z]{4}$", ticker):
        raise HTTPException(status_code=400, detail="Ticker tidak valid")

    try:
        all_broker = storage.read_broker_flow([ticker])
        all_activity = storage.read_broker_activity([ticker])

        if all_broker.empty or all_activity.empty:
            raise HTTPException(status_code=404, detail="Data broker tidak ditemukan di DB")

        analysis_ts = pd.Timestamp(analysis_date) if analysis_date else all_broker["date"].max()
        window_start = analysis_ts - pd.Timedelta(days=lookback_days)

        broker_window = all_broker[(all_broker["date"] >= window_start) & (all_broker["date"] <= analysis_ts)].copy()
        activity_window = all_activity[(all_activity["date"] >= window_start) & (all_activity["date"] <= analysis_ts)].copy()

        if broker_window.empty or activity_window.empty:
            raise HTTPException(status_code=404, detail="Data tidak tersedia di rentang waktu ini")

        # 1. Broker Compare Data
        broker_codes = sorted(activity_window["broker_code"].dropna().unique().tolist())
        ranked_codes = (
            activity_window.assign(abs_net=activity_window["net_value"].abs())
            .groupby("broker_code")["abs_net"]
            .sum()
            .sort_values(ascending=False)
            .index.tolist()
        )
        default_codes = ranked_codes[:3] if ranked_codes else broker_codes[:3]
        
        # 2. Profile Flow
        profile_df = profile_flow_from_activity(activity_window)
        profile_flow = df_to_records(profile_df)
        profile_broker_detail = df_to_records(profile_broker_detail_table(activity_window))

        # 3. Broker Distribution
        available_dist_dates = sorted(activity_window["date"].dt.date.unique().tolist())
        if not dist_start or not dist_end:
            if available_dist_dates:
                dist_end_date = available_dist_dates[-1]
                dist_start_date = available_dist_dates[max(0, len(available_dist_dates) - 5)]
            else:
                dist_end_date = analysis_ts.date()
                dist_start_date = dist_end_date
        else:
            dist_start_date = pd.to_datetime(dist_start).date()
            dist_end_date = pd.to_datetime(dist_end).date()

        dist_data = broker_distribution_data(activity_window, pd.Timestamp(dist_start_date), pd.Timestamp(dist_end_date))

        return {
            "ticker": ticker,
            "analysis_date": str(analysis_ts.date()),
            "window_start": str(window_start.date()),
            "broker_codes": broker_codes,
            "ranked_codes": ranked_codes,
            "default_codes": default_codes,
            "profile_flow": profile_flow,
            "profile_broker_detail": profile_broker_detail,
            "broker_distribution": dist_data,
            "available_dist_dates": [str(d) for d in available_dist_dates],
            "dist_start": str(dist_start_date),
            "dist_end": str(dist_end_date)
        }

    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}\n{traceback.format_exc()}")
