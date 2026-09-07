from fastapi import APIRouter, HTTPException
import pandas as pd
from idx_bandarmology import analysis
import math

router = APIRouter(tags=["Causality"])

def _clean(obj):
    if isinstance(obj, dict): return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list): return [_clean(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)): return None
    if hasattr(obj, 'item'): return obj.item()
    return obj

@router.get("/{ticker}")
def get_causality_data(ticker: str):
    ticker = ticker.upper().strip()
    
    try:
        foreign_causality = analysis.causality_foreign_vs_price(ticker, max_lags=5)
    except Exception:
        foreign_causality = None
        
    try:
        part_causality = analysis.causality_by_participant(ticker, max_lags=5)
    except Exception:
        part_causality = pd.DataFrame()
        
    try:
        broker_causality = analysis.causality_by_broker(ticker, top_n=15, max_lags=5)
    except Exception:
        broker_causality = pd.DataFrame()

    def get_english_text(val):
        return {"Asing": "Foreign", "Lokal": "Local", "Pemerintah": "Government"}.get(str(val), val)

    part_list = []
    if not part_causality.empty:
        for _, row in part_causality.iterrows():
            part_list.append({
                "participant": get_english_text(row.get("participant_type", "")),
                "lag": int(row.get("best_lag", 1)),
                "p_value": float(row.get("p_value", 1.0)),
                "is_significant": bool(row.get("significant", False))
            })

    broker_list = []
    if not broker_causality.empty:
        for _, row in broker_causality.iterrows():
            broker_list.append({
                "code": str(row.get("broker_code", "")),
                "lag": int(row.get("best_lag", 1)),
                "p_value": float(row.get("p_value", 1.0)),
                "is_significant": bool(row.get("significant", False))
            })

    raw_response = {
        "granger_test": {
            "is_significant": bool(foreign_causality.get("is_significant", False)),
            "min_p_value": float(foreign_causality.get("min_p_value", 1.0)),
            "best_lag": int(foreign_causality.get("best_lag", 1))
        } if foreign_causality else None,
        "participant_causality": part_list,
        "top_brokers": broker_list
    }
    
    return _clean(raw_response)
